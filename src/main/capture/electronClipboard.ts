// Electron-backed clipboard access. No polling fallback: capture needs a trusted source app.

import { clipboard, nativeImage } from 'electron'
import type { DeskHelper } from '../helper/deskHelper'
import type { ClipboardImage, ClipboardReader } from './clipboardWatcher'

/** Raw macOS pasteboard type, addressed through Electron's custom-format escape hatch. */
export function osPasteboardType(uti: string): string {
  return `electron application/osclipboard;format="${uti}"`
}

async function blobOf(type: string): Promise<Blob | null> {
  const items = await clipboard.read()
  for (const item of items) {
    if (item.types.includes(type)) return (await item.getType(type)) as Blob
  }
  return null
}

export async function readClipboardPng(): Promise<ClipboardImage | null> {
  const blob = await blobOf('image/png')
  if (!blob) return null
  const png = Buffer.from(await blob.arrayBuffer())
  const image = nativeImage.createFromBuffer(png)
  if (image.isEmpty()) return null
  const { width, height } = image.getSize()
  return { png, width, height }
}

export class ElectronClipboardReader implements ClipboardReader {
  constructor(private readonly helper: DeskHelper) {}

  readText(): Promise<string> {
    if (!this.helper.running) return Promise.resolve('')
    return clipboard.readText()
  }

  readImage(): Promise<ClipboardImage | null> {
    if (!this.helper.running) return Promise.resolve(null)
    return readClipboardPng()
  }

  async readFilePaths(): Promise<string[]> {
    if (this.helper.running) {
      try {
        return await this.helper.pasteboardFiles()
      } catch (error) {
        console.warn('[clipboard] helper could not read files', error)
      }
    }
    return []
  }
}
