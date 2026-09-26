import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrate } from './db'
import { Deletions, UNDO_MS } from './deletions'
import { ItemsRepo } from './itemsRepo'

const DAY = 24 * 60 * 60 * 1000
let now = new Date(2026, 8, 26, 15, 0).getTime()
let repo: ItemsRepo
let removed: string[]
let deletions: Deletions

beforeEach(() => {
  vi.useFakeTimers()
  now = new Date(2026, 8, 26, 15, 0).getTime()
  const db = new Database(':memory:')
  migrate(db)
  repo = new ItemsRepo(db)
  removed = []
  deletions = new Deletions({
    repo,
    assets: { removeFor: (id) => removed.push(id) },
    now: () => now,
    onChanged: () => undefined
  })
})
afterEach(() => vi.useRealTimers())

describe('delete with undo', () => {
  it('restores the item exactly, including pins and search', () => {
    const item = repo.insert({ type: 'text', text: 'redis timeout', capturedAt: now - 1000, contentHash: 'h' })
    repo.setPinned(item.id, true)
    repo.touch(item.id, now)
    const before = repo.get(item.id)
    const { undoToken } = deletions.delete(item.id) ?? { undoToken: '' }
    expect(repo.get(item.id)).toBeNull()
    expect(deletions.undo(undoToken)).toBe(true)
    expect(repo.get(item.id)).toEqual(before)
    expect(removed).toEqual([])
    const db = (repo as unknown as { db: Database.Database }).db
    expect(db.prepare("SELECT rowid FROM items_fts WHERE items_fts MATCH '\"timeout\"'").all()).toHaveLength(1)
  })

  it('removes app assets only after the undo window', () => {
    const item = repo.insert({ type: 'image', capturedAt: now })
    const { undoToken } = deletions.delete(item.id) ?? { undoToken: '' }
    vi.advanceTimersByTime(UNDO_MS - 1)
    expect(removed).toEqual([])
    vi.advanceTimersByTime(1)
    expect(removed).toEqual([item.id])
    expect(deletions.undo(undoToken)).toBe(false)
  })
})

describe('delete recent', () => {
  it('deletes what was captured in the last N minutes', () => {
    repo.insert({ type: 'text', text: 'old', capturedAt: now - 10 * 60_000 })
    repo.insert({ type: 'text', text: 'new', capturedAt: now - 2 * 60_000 })
    repo.insert({ type: 'screenshot', capturedAt: now - 60_000 })
    expect(deletions.countRecent(5)).toBe(2)
    expect(deletions.deleteRecent(5)).toBe(2)
    expect(repo.list('inbox').items.map((i) => i.text)).toEqual(['old'])
  })
})

describe('retention', () => {
  it('expires unpinned temporary items and keeps screenshots, downloads, pins and archive', () => {
    const at = now - 40 * DAY
    const oldText = repo.insert({ type: 'text', text: 'old', capturedAt: at })
    repo.insert({ type: 'link', url: 'https://a.b', capturedAt: at })
    const pinned = repo.insert({ type: 'text', text: 'pinned', capturedAt: at })
    repo.setPinned(pinned.id, true)
    const archived = repo.insert({ type: 'text', text: 'archived', capturedAt: at })
    repo.setArchived(archived.id, true)
    repo.insert({ type: 'screenshot', capturedAt: at })
    repo.insert({ type: 'file', capturedAt: at })
    repo.insert({ type: 'text', text: 'recent', capturedAt: now - DAY })
    expect(deletions.expire(null)).toBe(0)
    expect(deletions.expire(30)).toBe(2)
    expect(repo.get(oldText.id)).toBeNull()
    expect(removed).toContain(oldText.id)
    expect(repo.count()).toBe(5)
  })
})
