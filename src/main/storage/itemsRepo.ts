// All reads and writes of `items`. Keeps `items_fts` in step inside the same transaction.

import type { DeskItem, ItemMetadata, ItemType, OcrStatus, Page, View } from '@shared/types'
import type { Db } from './db'
import { newItemId } from './ids'

export interface ItemRow {
  rowid: number
  id: string
  type: ItemType
  title: string | null
  text: string | null
  ocr_text: string | null
  file_path: string | null
  file_name: string | null
  url: string | null
  domain: string | null
  source_app: string | null
  source_bundle_id: string | null
  created_at: number
  captured_at: number
  last_used_at: number
  use_count: number
  preview_path: string | null
  content_hash: string | null
  pinned: number
  archived: number
  ocr_status: OcrStatus | null
  metadata_json: string
}

export interface NewItem {
  /** Pre-generated ULID when assets must be written before the row exists. */
  id?: string
  type: ItemType
  title?: string | null
  text?: string | null
  ocrText?: string | null
  filePath?: string | null
  fileName?: string | null
  url?: string | null
  domain?: string | null
  sourceApp?: string | null
  sourceBundleId?: string | null
  createdAt?: number
  capturedAt: number
  previewPath?: string | null
  contentHash?: string | null
  ocrStatus?: OcrStatus | null
  metadata?: ItemMetadata
}

export type ItemPatch = Partial<
  Pick<DeskItem, 'title' | 'ocrText' | 'previewPath' | 'ocrStatus' | 'metadata' | 'url' | 'domain'>
>

export function toItem(row: ItemRow): DeskItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    text: row.text,
    ocrText: row.ocr_text,
    filePath: row.file_path,
    fileName: row.file_name,
    url: row.url,
    domain: row.domain,
    sourceApp: row.source_app,
    sourceBundleId: row.source_bundle_id,
    createdAt: row.created_at,
    capturedAt: row.captured_at,
    lastUsedAt: row.last_used_at,
    useCount: row.use_count,
    previewPath: row.preview_path,
    contentHash: row.content_hash,
    pinned: row.pinned === 1,
    archived: row.archived === 1,
    ocrStatus: row.ocr_status,
    metadata: JSON.parse(row.metadata_json) as ItemMetadata
  }
}

const VIEW_FILTER: Record<View, string> = {
  inbox: 'archived = 0',
  desk: 'pinned = 1 AND archived = 0',
  archive: 'archived = 1'
}

function encodeCursor(item: DeskItem): string {
  return `${item.lastUsedAt}:${item.id}`
}

function decodeCursor(cursor: string): { lastUsedAt: number; id: string } | null {
  const i = cursor.indexOf(':')
  const lastUsedAt = Number(cursor.slice(0, i))
  const id = cursor.slice(i + 1)
  return i > 0 && Number.isFinite(lastUsedAt) && id ? { lastUsedAt, id } : null
}

export class ItemsRepo {
  constructor(private readonly db: Db) {}

  insert(input: NewItem): DeskItem {
    const id = input.id ?? newItemId(input.capturedAt)
    const insert = this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO items (id, type, title, text, ocr_text, file_path, file_name, url, domain, source_app,
             source_bundle_id, created_at, captured_at, last_used_at, use_count, preview_path, content_hash,
             ocr_status, metadata_json)
           VALUES (@id, @type, @title, @text, @ocrText, @filePath, @fileName, @url, @domain, @sourceApp,
             @sourceBundleId, @createdAt, @capturedAt, @capturedAt, 1, @previewPath, @contentHash,
             @ocrStatus, @metadataJson)`
        )
        .run({
          id,
          type: input.type,
          title: input.title ?? null,
          text: input.text ?? null,
          ocrText: input.ocrText ?? null,
          filePath: input.filePath ?? null,
          fileName: input.fileName ?? null,
          url: input.url ?? null,
          domain: input.domain ?? null,
          sourceApp: input.sourceApp ?? null,
          sourceBundleId: input.sourceBundleId ?? null,
          createdAt: input.createdAt ?? input.capturedAt,
          capturedAt: input.capturedAt,
          previewPath: input.previewPath ?? null,
          contentHash: input.contentHash ?? null,
          ocrStatus: input.ocrStatus ?? null,
          metadataJson: JSON.stringify(input.metadata ?? {})
        })
      this.syncFts(Number(info.lastInsertRowid))
    })
    insert()
    return this.get(id) as DeskItem
  }

  /** Many inserts in one transaction (seed data, benchmarks). */
  insertMany(inputs: NewItem[]): DeskItem[] {
    const ids: string[] = []
    this.db.transaction(() => {
      for (const input of inputs) ids.push(this.insert(input).id)
    })()
    return ids.map((id) => this.get(id) as DeskItem)
  }

  /** Removes every item and its index entry. Only used by `seed --reset`. */
  clearAll(): void {
    this.db.transaction(() => {
      this.db.exec('DELETE FROM items_fts; DELETE FROM items;')
    })()
  }

  get(id: string): DeskItem | null {
    const row = this.db.prepare('SELECT rowid, * FROM items WHERE id = ?').get(id) as ItemRow | undefined
    return row ? toItem(row) : null
  }

  /** Puts a deleted item back exactly as it was (undo). */
  restore(item: DeskItem): void {
    this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO items (id, type, title, text, ocr_text, file_path, file_name, url, domain, source_app,
             source_bundle_id, created_at, captured_at, last_used_at, use_count, preview_path, content_hash,
             pinned, archived, ocr_status, metadata_json)
           VALUES (@id, @type, @title, @text, @ocrText, @filePath, @fileName, @url, @domain, @sourceApp,
             @sourceBundleId, @createdAt, @capturedAt, @lastUsedAt, @useCount, @previewPath, @contentHash,
             @pinned, @archived, @ocrStatus, @metadataJson)`
        )
        .run({
          ...item,
          pinned: item.pinned ? 1 : 0,
          archived: item.archived ? 1 : 0,
          metadataJson: JSON.stringify(item.metadata)
        })
      this.syncFts(Number(info.lastInsertRowid))
    })()
  }

  /** Items captured at or after `since` (Delete last 5 minutes / hour). */
  capturedSince(since: number): DeskItem[] {
    const rows = this.db.prepare('SELECT rowid, * FROM items WHERE captured_at >= ?').all(since) as ItemRow[]
    return rows.map(toItem)
  }

  /**
   * Temporary items past the retention window (ARCHITECTURE §6.6): unpinned, unarchived text,
   * links and clipboard images. Screenshots and downloads keep their records forever.
   */
  expired(before: number): DeskItem[] {
    const rows = this.db
      .prepare(
        `SELECT rowid, * FROM items WHERE pinned = 0 AND archived = 0
           AND type IN ('text','link','image') AND last_used_at < ?`
      )
      .all(before) as ItemRow[]
    return rows.map(toItem)
  }

  /** Screenshots whose OCR never finished (the app quit mid-queue). */
  findPendingOcr(): DeskItem[] {
    const rows = this.db
      .prepare("SELECT rowid, * FROM items WHERE ocr_status = 'pending' ORDER BY captured_at")
      .all() as ItemRow[]
    return rows.map(toItem)
  }

  /** Items that point at this file on disk (screenshots, downloads, copied files). */
  findByFilePath(path: string): DeskItem[] {
    const rows = this.db.prepare('SELECT rowid, * FROM items WHERE file_path = ?').all(path) as ItemRow[]
    return rows.map(toItem)
  }

  /** Most recent item with this content hash captured at or after `since`. */
  findRecentByHash(hash: string, since: number): DeskItem | null {
    const row = this.db
      .prepare(
        'SELECT rowid, * FROM items WHERE content_hash = ? AND last_used_at >= ? ORDER BY last_used_at DESC LIMIT 1'
      )
      .get(hash, since) as ItemRow | undefined
    return row ? toItem(row) : null
  }

  /** Same content captured again: bump it to the top instead of duplicating. */
  touch(id: string, at: number, source?: { app: string | null; bundleId: string | null }): DeskItem | null {
    this.db
      .prepare(
        `UPDATE items SET last_used_at = ?, use_count = use_count + 1,
           source_app = COALESCE(?, source_app), source_bundle_id = COALESCE(?, source_bundle_id)
         WHERE id = ?`
      )
      .run(at, source?.app ?? null, source?.bundleId ?? null, id)
    return this.get(id)
  }

  update(id: string, patch: ItemPatch): DeskItem | null {
    const columns: Record<keyof ItemPatch, string> = {
      title: 'title',
      ocrText: 'ocr_text',
      previewPath: 'preview_path',
      ocrStatus: 'ocr_status',
      metadata: 'metadata_json',
      url: 'url',
      domain: 'domain'
    }
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof ItemPatch, unknown][]
    if (entries.length === 0) return this.get(id)
    const sets = entries.map(([k]) => `${columns[k]} = @${k}`).join(', ')
    const params = Object.fromEntries(entries.map(([k, v]) => [k, k === 'metadata' ? JSON.stringify(v) : v]))
    this.db.transaction(() => {
      this.db.prepare(`UPDATE items SET ${sets} WHERE id = @id`).run({ ...params, id })
      const row = this.db.prepare('SELECT rowid FROM items WHERE id = ?').get(id) as { rowid: number } | undefined
      if (row) this.syncFts(row.rowid)
    })()
    return this.get(id)
  }

  setPinned(id: string, pinned: boolean): void {
    this.db.prepare('UPDATE items SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id)
  }

  setArchived(id: string, archived: boolean): void {
    this.db.prepare('UPDATE items SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id)
  }

  /** Removes the row and its index entry. Returns the removed item so callers can clean up assets. */
  delete(id: string): DeskItem | null {
    const row = this.db.prepare('SELECT rowid, * FROM items WHERE id = ?').get(id) as ItemRow | undefined
    if (!row) return null
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM items_fts WHERE rowid = ?').run(row.rowid)
      this.db.prepare('DELETE FROM items WHERE rowid = ?').run(row.rowid)
    })()
    return toItem(row)
  }

  list(view: View, cursor: string | null = null, limit = 100): Page<DeskItem> {
    const after = cursor ? decodeCursor(cursor) : null
    const where = [VIEW_FILTER[view]]
    if (after) where.push('(last_used_at < @lastUsedAt OR (last_used_at = @lastUsedAt AND id < @id))')
    const rows = this.db
      .prepare(
        `SELECT rowid, * FROM items WHERE ${where.join(' AND ')}
         ORDER BY last_used_at DESC, id DESC LIMIT @limit`
      )
      .all({ lastUsedAt: after?.lastUsedAt ?? 0, id: after?.id ?? '', limit: limit + 1 }) as ItemRow[]
    const items = rows.slice(0, limit).map(toItem)
    const last = items[items.length - 1]
    return { items, nextCursor: rows.length > limit && last ? encodeCursor(last) : null }
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM items').get() as { n: number }).n
  }

  private syncFts(rowid: number): void {
    this.db.prepare('DELETE FROM items_fts WHERE rowid = ?').run(rowid)
    this.db
      .prepare(
        `INSERT INTO items_fts (rowid, title, text, ocr_text, file_name, url, domain, source_app)
         SELECT rowid, title, text, ocr_text, file_name, url, domain, source_app FROM items WHERE rowid = ?`
      )
      .run(rowid)
  }
}
