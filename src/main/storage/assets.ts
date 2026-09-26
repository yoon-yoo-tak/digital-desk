// Files the app itself owns: clipboard images and thumbnails (ARCHITECTURE §4).
// User files are only ever referenced by path, never copied, moved or deleted.

import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { nativeImage, type NativeImage } from 'electron'
import type { ClipboardAssets, ClipboardImage, FileInfo } from '../capture/clipboardWatcher'

const THUMB_MAX = 640
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.heic', '.tif', '.tiff', '.webp', '.bmp'])

function fit(image: NativeImage): NativeImage {
  const { width, height } = image.getSize()
  if (width <= THUMB_MAX && height <= THUMB_MAX) return image
  return width >= height ? image.resize({ width: THUMB_MAX }) : image.resize({ height: THUMB_MAX })
}

export class Assets implements ClipboardAssets {
  readonly imagesDir: string
  readonly thumbsDir: string

  constructor(readonly root: string) {
    this.imagesDir = join(root, 'images')
    this.thumbsDir = join(root, 'thumbs')
    mkdirSync(this.imagesDir, { recursive: true })
    mkdirSync(this.thumbsDir, { recursive: true })
  }

  saveClipboardImage(id: string, image: ClipboardImage): string {
    writeFileSync(join(this.imagesDir, `${id}.png`), image.png)
    const thumb = fit(nativeImage.createFromBuffer(image.png))
    writeFileSync(join(this.thumbsDir, `${id}.png`), thumb.toPNG())
    return `thumbs/${id}.png`
  }

  async saveFileThumbnail(id: string, filePath: string): Promise<string | null> {
    try {
      const thumb = await nativeImage.createThumbnailFromPath(filePath, { width: THUMB_MAX, height: THUMB_MAX })
      if (thumb.isEmpty()) return null
      writeFileSync(join(this.thumbsDir, `${id}.png`), thumb.toPNG())
      return `thumbs/${id}.png`
    } catch {
      return null
    }
  }

  /** Full-size clipboard image for an `image` item. */
  imagePath(id: string): string {
    return join(this.imagesDir, `${id}.png`)
  }

  removeFor(id: string): void {
    rmSync(join(this.imagesDir, `${id}.png`), { force: true })
    rmSync(join(this.thumbsDir, `${id}.png`), { force: true })
  }

  statFile(path: string): FileInfo | null {
    try {
      const s = statSync(path)
      return {
        size: s.size,
        createdAt: Math.round(s.birthtimeMs || s.mtimeMs),
        isImage: s.isFile() && IMAGE_EXTENSIONS.has(extname(path).toLowerCase())
      }
    } catch {
      return null
    }
  }

  /** Maps a `desk-asset://` path to a file inside the assets root, or null if it escapes it. */
  resolve(relativePath: string): string | null {
    const target = resolve(this.root, relativePath)
    const rel = relative(this.root, target)
    if (!rel || rel.startsWith('..') || rel.includes(`..${sep}`)) return null
    return target
  }
}
