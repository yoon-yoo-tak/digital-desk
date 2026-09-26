// Watches the screenshot and Downloads folders (depth 0) and hands finished files to FileCapture.

import { statSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import { nativeImage } from 'electron'
import type { DeskHelper } from '../helper/deskHelper'
import type { OcrEngine } from '../indexing/ocrQueue'
import type { Assets } from '../storage/assets'
import type { FileProbe, FileOutcome } from './fileCapture'

export class FolderWatcher {
  private watcher: FSWatcher | null = null
  private dir: string | null = null

  constructor(
    private readonly label: string,
    private readonly stabilityMs: number,
    private readonly onAdd: (path: string) => Promise<FileOutcome>,
    private readonly onUnlink: (path: string) => void
  ) {}

  get folder(): string | null {
    return this.dir
  }

  watch(dir: string): void {
    if (dir === this.dir && this.watcher) return
    void this.close()
    this.dir = dir
    this.watcher = watch(dir, {
      depth: 0,
      ignoreInitial: true,
      // Only files that stopped growing: a half-written screenshot or download is not an item yet.
      awaitWriteFinish: { stabilityThreshold: this.stabilityMs, pollInterval: 100 },
      ignored: (path) => path !== dir && basename(path).startsWith('.')
    })
    this.watcher.on('add', (path) => {
      void this.onAdd(path).then((outcome) => {
        const detail = outcome.kind === 'created' ? outcome.item.type : outcome.reason
        console.log(`[capture] ${this.label} ${outcome.kind} (${detail}): ${basename(path)}`)
      })
    })
    this.watcher.on('unlink', (path) => this.onUnlink(path))
    this.watcher.on('error', (error) => console.warn(`[capture] ${this.label} watcher error`, error))
    console.log(`[capture] watching ${this.label}: ${dir}`)
  }

  async close(): Promise<void> {
    const w = this.watcher
    this.watcher = null
    this.dir = null
    await w?.close()
  }
}

export const DEFAULT_SCREENSHOT_FOLDER = join(homedir(), 'Desktop')

/** Real filesystem / helper access for FileCapture. */
export function electronProbe(helper: DeskHelper, assets: Assets): FileProbe {
  return {
    meta: async (path) => {
      if (!helper.running) return null
      try {
        return await helper.fileMeta(path)
      } catch {
        return null
      }
    },
    frontmost: async () => {
      if (!helper.running) return { name: null, bundleId: null }
      try {
        return await helper.frontmost()
      } catch {
        return { name: null, bundleId: null }
      }
    },
    stat: (path) => {
      try {
        const s = statSync(path)
        return s.isFile() ? { size: s.size, createdAt: Math.round(s.birthtimeMs || s.mtimeMs) } : null
      } catch {
        return null
      }
    },
    imageSize: (path) => {
      const image = nativeImage.createFromPath(path)
      return image.isEmpty() ? null : image.getSize()
    },
    thumbnail: (id, path) => assets.saveFileThumbnail(id, path),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export function helperOcrEngine(helper: DeskHelper, enabled: () => boolean): OcrEngine {
  return {
    get available() {
      return helper.running && enabled()
    },
    ocr: (path) => helper.ocr(path)
  }
}
