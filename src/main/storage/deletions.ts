// Deleting items: undo within a few seconds, bulk "delete recent", and retention (ARCHITECTURE §6.6).
// Only Desk records and app-owned assets are removed — never the user's files.

import { randomUUID } from 'node:crypto'
import type { DeskItem } from '@shared/types'
import type { Clock } from '../clock'
import type { ItemsRepo } from './itemsRepo'

export const UNDO_MS = 5000
const DAY_MS = 24 * 60 * 60 * 1000

interface AssetStore {
  removeFor(id: string): void
}

interface Pending {
  item: DeskItem
  timer: ReturnType<typeof setTimeout>
}

export class Deletions {
  private pending = new Map<string, Pending>()

  constructor(
    private readonly deps: { repo: ItemsRepo; assets: AssetStore; now: Clock; onChanged: () => void }
  ) {}

  /** Removes the item now; its assets go only once the undo window has passed. */
  delete(id: string): { undoToken: string } | null {
    const item = this.deps.repo.delete(id)
    if (!item) return null
    const token = randomUUID()
    const timer = setTimeout(() => this.finalize(token), UNDO_MS)
    timer.unref?.()
    this.pending.set(token, { item, timer })
    this.deps.onChanged()
    return { undoToken: token }
  }

  undo(token: string): boolean {
    const entry = this.pending.get(token)
    if (!entry) return false
    clearTimeout(entry.timer)
    this.pending.delete(token)
    this.deps.repo.restore(entry.item)
    this.deps.onChanged()
    return true
  }

  /** minutes = Infinity means everything. */
  countRecent(minutes: number): number {
    return this.deps.repo.capturedSince(this.since(minutes)).length
  }

  private since(minutes: number): number {
    return Number.isFinite(minutes) ? this.deps.now() - minutes * 60_000 : 0
  }

  /** "Delete last 5 minutes…" — no undo; the menu asks for confirmation first. */
  deleteRecent(minutes: number): number {
    return this.removeAll(this.deps.repo.capturedSince(this.since(minutes)))
  }

  /** Retention: temporary items not used for `days` days. null = keep forever. */
  expire(days: number | null): number {
    if (days === null) return 0
    return this.removeAll(this.deps.repo.expired(this.deps.now() - days * DAY_MS))
  }

  /** Runs any pending asset clean-up immediately (app quit). */
  flush(): void {
    for (const token of [...this.pending.keys()]) this.finalize(token)
  }

  private removeAll(items: DeskItem[]): number {
    for (const item of items) {
      this.deps.repo.delete(item.id)
      this.deps.assets.removeFor(item.id)
    }
    if (items.length > 0) this.deps.onChanged()
    return items.length
  }

  private finalize(token: string): void {
    const entry = this.pending.get(token)
    if (!entry) return
    clearTimeout(entry.timer)
    this.pending.delete(token)
    this.deps.assets.removeFor(entry.item.id)
  }
}
