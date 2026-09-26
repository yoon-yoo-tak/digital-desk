// Electron-backed clipboard access (Electron 44+: async, W3C-style ClipboardItem API),
// plus a degraded poller for when desk-helper is unavailable.

import { fileURLToPath } from 'node:url'
import { clipboard, nativeImage } from 'electron'
import type { Clock } from '../clock'
import type { DeskHelper, PasteboardEvent } from '../helper/deskHelper'
import type { ClipboardImage, ClipboardReader } from './clipboardWatcher'
import type { CaptureState } from './captureState'

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
    return clipboard.readText()
  }

  readImage(): Promise<ClipboardImage | null> {
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
    // Fallback: whatever file URLs Chromium exposes.
    const blob = await blobOf('text/uri-list')
    if (!blob) return []
    return (await blob.text())
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('file://'))
      .flatMap((line) => {
        try {
          return [fileURLToPath(line)]
        } catch {
          return []
        }
      })
  }
}

/**
 * Used only when desk-helper can't run: polls Electron's clipboard for changes.
 * Source apps are unknown in this mode, so exclusions by app can't apply (concealed markers still do).
 */
export class FallbackPasteboardPoller {
  private timer: NodeJS.Timeout | null = null
  private signature: string | null = null
  private changeCount = 0
  private polling = false

  constructor(
    private readonly state: CaptureState,
    private readonly now: Clock,
    private readonly onEvent: (event: PasteboardEvent) => void
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.poll(), 500)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async poll(): Promise<void> {
    if (this.polling || this.state.isPaused()) return
    this.polling = true
    try {
      const items = await clipboard.read()
      const formats = items.flatMap((i) => i.types)
      const signature = `${formats.join('|')}\n${await clipboard.readText()}`
      const first = this.signature === null
      if (signature === this.signature) return
      this.signature = signature
      if (first) return // baseline: don't capture what was on the clipboard before launch

      const types: string[] = []
      if (formats.includes('text/uri-list')) types.push('public.file-url')
      if (formats.includes('text/plain')) types.push('public.utf8-plain-text')
      if (formats.some((f) => f.startsWith('image/'))) types.push('public.png')
      const concealed = await clipboard.has(osPasteboardType('org.nspasteboard.ConcealedType')).catch(() => false)
      this.onEvent({
        changeCount: ++this.changeCount,
        app: { name: null, bundleId: null },
        types,
        concealed,
        transient: false,
        at: this.now()
      })
    } catch (error) {
      console.warn('[clipboard] fallback poll failed', error)
    } finally {
      this.polling = false
    }
  }
}
