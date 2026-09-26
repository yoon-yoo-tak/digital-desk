// Screenshot and Downloads capture (ARCHITECTURE §6.2, §6.3). Folder watching lives in folderWatchers.ts;
// this class decides what a new file is and records it. Dependencies are injected for tests.

import { basename } from 'node:path'
import type { DeskItem, SourceApp } from '@shared/types'
import type { Clock } from '../clock'
import type { FileMeta } from '../helper/deskHelper'
import type { OcrQueue } from '../indexing/ocrQueue'
import { newItemId } from '../storage/ids'
import type { ItemsRepo } from '../storage/itemsRepo'
import type { CaptureState } from './captureState'
import { fileHash } from './classify'
import { domainOf, isIgnoredDownload, isImageFile, looksLikeScreenshotName } from './files'

export interface FileProbe {
  /** Spotlight/xattr metadata; null when the helper can't answer. */
  meta(path: string): Promise<FileMeta | null>
  frontmost(): Promise<SourceApp>
  stat(path: string): { size: number; createdAt: number } | null
  imageSize(path: string): { width: number; height: number } | null
  thumbnail(id: string, path: string): Promise<string | null>
  sleep(ms: number): Promise<void>
}

export interface FileCaptureDeps {
  repo: ItemsRepo
  state: CaptureState
  probe: FileProbe
  ocr: OcrQueue
  now: Clock
  onChanged: () => void
}

/** Spotlight may flag a fresh screenshot a moment late (ARCHITECTURE §6.2). */
const SCREENSHOT_META_ATTEMPTS = 6
const SCREENSHOT_META_INTERVAL_MS = 500

export type FileOutcome =
  | { kind: 'created'; item: DeskItem }
  | { kind: 'skipped'; reason: 'paused' | 'ignored' | 'not-captured' | 'duplicate' | 'gone' }

export class FileCapture {
  constructor(private readonly deps: FileCaptureDeps) {}

  /**
   * A new file in the screenshot folder (usually the Desktop). Screenshots are recorded; so are files
   * a browser saved there (they carry where-from metadata) — Chrome with "Ask where to save" offers
   * the Desktop by default. Anything else on the Desktop is left alone (PRODUCT §39).
   */
  async screenshot(path: string): Promise<FileOutcome> {
    const { probe, state } = this.deps
    const name = basename(path)
    if (name.startsWith('.')) return { kind: 'skipped', reason: 'ignored' }
    const app = await probe.frontmost()
    if (isImageFile(name) && (await this.isScreenshot(path, name))) {
      if (!state.shouldCapture('screenshots', app)) return { kind: 'skipped', reason: 'paused' }
      return this.record(path, app, { type: 'screenshot', ocr: true })
    }
    if (isIgnoredDownload(name)) return { kind: 'skipped', reason: 'ignored' }
    const meta = await probe.meta(path)
    if (!meta || meta.whereFroms.length === 0) return { kind: 'skipped', reason: 'not-captured' }
    if (!state.shouldCapture('downloads', app)) return { kind: 'skipped', reason: 'paused' }
    return this.record(path, app, { type: 'file', ocr: false, url: meta.whereFroms[0], whereFroms: meta.whereFroms })
  }

  async download(path: string): Promise<FileOutcome> {
    const { probe, state } = this.deps
    if (isIgnoredDownload(basename(path))) return { kind: 'skipped', reason: 'ignored' }
    const app = await probe.frontmost()
    if (!state.shouldCapture('downloads', app)) return { kind: 'skipped', reason: 'paused' }
    const meta = await probe.meta(path)
    const url = meta?.whereFroms[0] ?? null
    return this.record(path, app, { type: 'file', ocr: false, url, whereFroms: meta?.whereFroms })
  }

  /** The original went away: keep the record, thumbnail and OCR text, but say so. */
  removed(path: string): void {
    const { repo, onChanged } = this.deps
    let changed = false
    for (const item of repo.findByFilePath(path)) {
      if (item.metadata.missing) continue
      repo.update(item.id, { metadata: { ...item.metadata, missing: true } })
      changed = true
    }
    if (changed) onChanged()
  }

  private async isScreenshot(path: string, name: string): Promise<boolean> {
    const { probe } = this.deps
    for (let attempt = 0; attempt < SCREENSHOT_META_ATTEMPTS; attempt++) {
      const meta = await probe.meta(path)
      if (meta?.isScreenCapture) return true
      if (meta === null) break // no helper: go by the name
      if (attempt < SCREENSHOT_META_ATTEMPTS - 1) await probe.sleep(SCREENSHOT_META_INTERVAL_MS)
    }
    return looksLikeScreenshotName(name)
  }

  private async record(
    path: string,
    app: SourceApp,
    opts: { type: 'screenshot' | 'file'; ocr: boolean; url?: string | null; whereFroms?: string[] }
  ): Promise<FileOutcome> {
    const { repo, probe, ocr, now, onChanged } = this.deps
    const hash = fileHash(path)
    const existing = repo.findByFilePath(path).find((i) => i.contentHash === hash && !i.metadata.missing)
    if (existing) return { kind: 'skipped', reason: 'duplicate' }
    const info = probe.stat(path)
    if (!info) return { kind: 'skipped', reason: 'gone' }

    const capturedAt = now()
    const id = newItemId(capturedAt)
    const name = basename(path)
    const size = isImageFile(name) ? probe.imageSize(path) : null
    const previewPath = await probe.thumbnail(id, path)
    const item = repo.insert({
      id,
      type: opts.type,
      title: name,
      fileName: name,
      filePath: path,
      url: opts.url ?? null,
      domain: domainOf(opts.url),
      sourceApp: app.name,
      sourceBundleId: app.bundleId,
      createdAt: info.createdAt,
      capturedAt,
      previewPath,
      contentHash: hash,
      ocrStatus: opts.ocr ? 'pending' : null,
      metadata: {
        size: info.size,
        ...(size ?? {}),
        ...(opts.whereFroms && opts.whereFroms.length > 0 ? { whereFroms: opts.whereFroms } : {})
      }
    })
    if (opts.ocr) ocr.enqueue(item.id, path)
    onChanged()
    return { kind: 'created', item }
  }
}
