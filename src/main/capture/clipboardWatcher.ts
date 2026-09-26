// Clipboard capture (ARCHITECTURE §6.1).
// The helper reports *that* the pasteboard changed and which app was in front; this class decides
// whether to read it at all, reads it through an injected reader, dedupes, and stores an item.

import { basename } from 'node:path'
import type { DeskItem, SourceApp } from '@shared/types'
import type { Clock } from '../clock'
import type { PasteboardEvent } from '../helper/deskHelper'
import { newItemId } from '../storage/ids'
import type { ItemsRepo } from '../storage/itemsRepo'
import type { CaptureState } from './captureState'
import { fileHash, looksLikeCode, parseLink, sha256, textHash, textTitle, truncateUtf8 } from './classify'

export const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000
const SELF_WRITE_TTL_MS = 3000
const MAX_IMAGE_BYTES = 20 * 1024 * 1024
const FILE_URL_TYPES = ['public.file-url', 'NSFilenamesPboardType']

export interface ClipboardImage {
  png: Buffer
  width: number
  height: number
}

export interface ClipboardReader {
  readText(): Promise<string>
  readImage(): Promise<ClipboardImage | null>
  /** Paths of copied files (Finder). Empty when none. */
  readFilePaths(): Promise<string[]>
}

export interface FileInfo {
  size: number
  createdAt: number
  isImage: boolean
}

export interface ClipboardAssets {
  /** Writes the image and its thumbnail; returns the thumbnail path relative to the assets root. */
  saveClipboardImage(id: string, image: ClipboardImage): string
  /** Thumbnail for a copied image file; null when none can be made. */
  saveFileThumbnail(id: string, filePath: string): Promise<string | null>
  removeFor(id: string): void
  statFile(path: string): FileInfo | null
}

export interface ClipboardWatcherDeps {
  repo: ItemsRepo
  state: CaptureState
  reader: ClipboardReader
  assets: ClipboardAssets
  now: Clock
  /** Resolves a link title in the background; null when disabled or unavailable. */
  fetchTitle: (url: string) => Promise<string | null>
  onChanged: () => void
}

export type CaptureOutcome =
  | { kind: 'skipped'; reason: 'paused-or-excluded' | 'concealed' | 'self-write' | 'empty' | 'too-large' }
  | { kind: 'created'; items: DeskItem[] }
  | { kind: 'touched'; items: DeskItem[] }

export class ClipboardWatcher {
  private queue: Promise<unknown> = Promise.resolve()
  private selfWrites = new Map<string, number>()

  constructor(private readonly deps: ClipboardWatcherDeps) {}

  /** Call before the app itself writes to the clipboard, so the change isn't captured back. */
  markSelfWrite(hash: string): void {
    this.selfWrites.set(hash, this.deps.now() + SELF_WRITE_TTL_MS)
  }

  /** Events are processed strictly in order. */
  handle(event: PasteboardEvent): Promise<CaptureOutcome> {
    const run = this.queue.then(() => this.process(event))
    this.queue = run.catch((error: unknown) => console.error('[clipboard] capture failed', error))
    return run
  }

  private async process(event: PasteboardEvent): Promise<CaptureOutcome> {
    const { state, reader } = this.deps
    // Decide before touching the contents (CLAUDE.md: paused / excluded / concealed → don't read).
    if (event.concealed || event.transient) return { kind: 'skipped', reason: 'concealed' }
    if (!state.shouldCapture('clipboard', event.app)) return { kind: 'skipped', reason: 'paused-or-excluded' }

    if (event.types.some((t) => FILE_URL_TYPES.includes(t))) {
      const paths = await reader.readFilePaths()
      if (paths.length > 0) return this.captureFiles(paths, event.app)
    }

    const text = await reader.readText()
    if (text.trim()) return this.captureText(text, event.app)

    const image = await reader.readImage()
    if (image) return this.captureImage(image, event.app)

    return { kind: 'skipped', reason: 'empty' }
  }

  private isSelfWrite(hash: string): boolean {
    const now = this.deps.now()
    for (const [h, expires] of this.selfWrites) if (expires < now) this.selfWrites.delete(h)
    if (!this.selfWrites.has(hash)) return false
    this.selfWrites.delete(hash)
    return true
  }

  /** Same content within the dedupe window → bump the existing item instead of adding one. */
  private touchDuplicate(hash: string, app: SourceApp): DeskItem | null {
    const { repo, now } = this.deps
    const existing = repo.findRecentByHash(hash, now() - DEDUPE_WINDOW_MS)
    return existing ? repo.touch(existing.id, now(), { app: app.name, bundleId: app.bundleId }) : null
  }

  private captureText(raw: string, app: SourceApp): CaptureOutcome {
    const { repo, now } = this.deps
    const hash = textHash(raw)
    if (this.isSelfWrite(hash)) return { kind: 'skipped', reason: 'self-write' }
    const touched = this.touchDuplicate(hash, app)
    if (touched) return this.changed('touched', [touched])

    const link = parseLink(raw)
    if (link) {
      const item = repo.insert({
        type: 'link',
        url: link.url,
        domain: link.domain,
        text: link.url,
        sourceApp: app.name,
        sourceBundleId: app.bundleId,
        capturedAt: now(),
        contentHash: hash
      })
      void this.resolveLinkTitle(item)
      return this.changed('created', [item])
    }

    const { text, truncated } = truncateUtf8(raw)
    const item = repo.insert({
      type: 'text',
      title: textTitle(text),
      text,
      sourceApp: app.name,
      sourceBundleId: app.bundleId,
      capturedAt: now(),
      contentHash: hash,
      metadata: { mono: looksLikeCode(text), ...(truncated ? { truncated } : {}) }
    })
    return this.changed('created', [item])
  }

  private captureImage(image: ClipboardImage, app: SourceApp): CaptureOutcome {
    const { repo, assets, now } = this.deps
    if (image.png.length > MAX_IMAGE_BYTES) return { kind: 'skipped', reason: 'too-large' }
    const hash = sha256(Buffer.concat([Buffer.from('image:'), image.png]))
    if (this.isSelfWrite(hash)) return { kind: 'skipped', reason: 'self-write' }
    const touched = this.touchDuplicate(hash, app)
    if (touched) return this.changed('touched', [touched])

    const capturedAt = now()
    const id = newItemId(capturedAt)
    const previewPath = assets.saveClipboardImage(id, image)
    try {
      const item = repo.insert({
        id,
        type: 'image',
        sourceApp: app.name,
        sourceBundleId: app.bundleId,
        capturedAt,
        previewPath,
        contentHash: hash,
        metadata: { width: image.width, height: image.height, size: image.png.length }
      })
      return this.changed('created', [item])
    } catch (error) {
      assets.removeFor(id)
      throw error
    }
  }

  private async captureFiles(paths: string[], app: SourceApp): Promise<CaptureOutcome> {
    const { repo, assets, now } = this.deps
    const created: DeskItem[] = []
    const touched: DeskItem[] = []
    for (const path of paths) {
      const hash = fileHash(path)
      if (this.isSelfWrite(hash)) continue
      const dup = this.touchDuplicate(hash, app)
      if (dup) {
        touched.push(dup)
        continue
      }
      const info = assets.statFile(path)
      const capturedAt = now()
      const id = newItemId(capturedAt)
      const previewPath = info?.isImage ? await assets.saveFileThumbnail(id, path) : null
      created.push(
        repo.insert({
          id,
          type: 'file',
          title: basename(path),
          filePath: path,
          fileName: basename(path),
          sourceApp: app.name,
          sourceBundleId: app.bundleId,
          createdAt: info?.createdAt ?? capturedAt,
          capturedAt,
          previewPath,
          contentHash: hash,
          metadata: info ? { size: info.size } : { missing: true }
        })
      )
    }
    if (created.length > 0) return this.changed('created', [...created, ...touched])
    if (touched.length > 0) return this.changed('touched', touched)
    return { kind: 'skipped', reason: 'self-write' }
  }

  private async resolveLinkTitle(item: DeskItem): Promise<void> {
    if (!item.url) return
    const title = await this.deps.fetchTitle(item.url)
    if (!title) return
    // The item may have been deleted meanwhile.
    if (this.deps.repo.update(item.id, { title })) this.deps.onChanged()
  }

  private changed(kind: 'created' | 'touched', items: DeskItem[]): CaptureOutcome {
    this.deps.onChanged()
    return { kind, items }
  }
}
