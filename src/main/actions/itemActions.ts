// Open / copy / reveal / Quick Look for an item (DESIGN §6.7 — the same semantics everywhere).

import { existsSync, readFileSync } from 'node:fs'
import { BrowserWindow, ClipboardItem, clipboard, shell } from 'electron'
import type { DeskItem, ItemAction } from '@shared/types'
import { fileHash, sha256, textHash } from '../capture/classify'
import type { ClipboardWatcher } from '../capture/clipboardWatcher'
import { readClipboardPng } from '../capture/electronClipboard'
import type { DeskHelper } from '../helper/deskHelper'
import type { Assets } from '../storage/assets'
import type { ItemsRepo } from '../storage/itemsRepo'

interface Deps {
  repo: ItemsRepo
  assets: Assets
  watcher: ClipboardWatcher
  helper: DeskHelper
  onChanged: () => void
}

export class ItemActions {
  constructor(private readonly deps: Deps) {}

  async run(item: DeskItem, action: ItemAction, window: BrowserWindow | null): Promise<void> {
    switch (action) {
      case 'open':
        return this.open(item)
      case 'copy':
        return this.copy(item)
      case 'reveal':
        return this.reveal(item)
      case 'quickLook':
        return this.quickLook(item, window)
    }
  }

  /** The file an item stands for on disk, if any. */
  localFile(item: DeskItem): string | null {
    if (item.type === 'image') return this.deps.assets.imagePath(item.id)
    return item.filePath
  }

  private async open(item: DeskItem): Promise<void> {
    if (item.type === 'text') return this.copy(item) // text has nothing to open: ↵ copies (DESIGN §6.7)
    if (item.type === 'link') {
      if (item.url && /^https?:\/\//iu.test(item.url)) await shell.openExternal(item.url)
      return
    }
    const file = this.existingFile(item)
    if (file) {
      const error = await shell.openPath(file)
      if (error) console.warn('[actions] open failed', error)
    }
  }

  private async copy(item: DeskItem): Promise<void> {
    const { watcher } = this.deps
    switch (item.type) {
      case 'text':
      case 'link': {
        const value = (item.type === 'link' ? item.url : item.text) ?? ''
        watcher.markSelfWrite(textHash(value))
        await clipboard.writeText(value)
        return
      }
      case 'image': {
        const file = this.existingFile(item)
        if (!file) return
        const png = readFileSync(file)
        await clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })])
        // Hash what the watcher will read back, which may differ from the stored PNG bytes.
        const readBack = await readClipboardPng()
        if (readBack) watcher.markSelfWrite(sha256(Buffer.concat([Buffer.from('image:'), readBack.png])))
        return
      }
      case 'file':
      case 'screenshot': {
        const file = this.existingFile(item)
        if (!file) return
        watcher.markSelfWrite(fileHash(file))
        await this.deps.helper.writeFiles([file])
        return
      }
    }
  }

  private reveal(item: DeskItem): void {
    const file = this.existingFile(item)
    if (file) shell.showItemInFolder(file)
  }

  private quickLook(item: DeskItem, window: BrowserWindow | null): void {
    const file = this.existingFile(item)
    if (file && window) window.previewFile(file, item.fileName ?? undefined)
  }

  /** Returns the file if it still exists; otherwise records that it went missing. */
  private existingFile(item: DeskItem): string | null {
    const file = this.localFile(item)
    if (!file) return null
    if (existsSync(file)) return file
    if (!item.metadata.missing) {
      this.deps.repo.update(item.id, { metadata: { ...item.metadata, missing: true } })
      this.deps.onChanged()
    }
    return null
  }
}
