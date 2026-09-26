import type { DeskItem } from '../types'

const EXT_LABELS: Record<string, string> = { jpeg: 'JPG' }

export function extensionLabel(fileName: string | null): string {
  const ext = fileName?.includes('.') ? fileName.split('.').pop()?.toLowerCase() : undefined
  if (!ext) return 'File'
  return EXT_LABELS[ext] ?? ext.toUpperCase()
}

function parentFolderName(path: string | null): string | null {
  if (!path) return null
  const parts = path.split('/').filter(Boolean)
  return parts.length >= 2 ? (parts[parts.length - 2] ?? null) : null
}

/** One-line title for rows and the inspector. Never empty. */
export function displayTitle(item: DeskItem): string {
  switch (item.type) {
    case 'text':
      return item.title ?? item.text?.trim().split('\n')[0] ?? 'Text'
    case 'link': {
      if (item.title) return item.title
      if (!item.url) return 'Link'
      try {
        const u = new URL(item.url)
        const path = u.pathname === '/' ? '' : u.pathname
        return `${u.hostname.replace(/^www\./, '')}${path}`
      } catch {
        return item.url
      }
    }
    case 'image': {
      const { width, height } = item.metadata
      return item.title ?? (width && height ? `Image · ${width} × ${height}` : 'Image')
    }
    case 'file':
    case 'screenshot':
      return item.title ?? item.fileName ?? 'File'
  }
}

/** Row meta line: "Copied · IntelliJ IDEA", "redis.io · Chrome", "PDF · Downloads" (DESIGN §6.5). */
export function rowMeta(item: DeskItem): string {
  const app = item.sourceApp
  const parts: string[] = []
  switch (item.type) {
    case 'text':
      parts.push('Copied')
      if (app) parts.push(app)
      if (item.useCount > 1) parts.push(`copied ${item.useCount}×`)
      break
    case 'link':
      parts.push(item.domain ?? 'Link')
      if (app) parts.push(app)
      break
    case 'image':
      parts.push('Copied image')
      if (app) parts.push(app)
      break
    case 'screenshot':
      parts.push('Screenshot')
      if (app) parts.push(app)
      break
    case 'file':
      parts.push(extensionLabel(item.fileName))
      parts.push(parentFolderName(item.filePath) ?? app ?? 'File')
      break
  }
  return parts.join(' · ')
}

/** Short type name used in the inspector subtitle. */
export function typeLabel(item: DeskItem): string {
  switch (item.type) {
    case 'text':
      return 'Copied text'
    case 'link':
      return 'Link'
    case 'image':
      return 'Copied image'
    case 'screenshot':
      return 'Screenshot'
    case 'file':
      return extensionLabel(item.fileName)
  }
}

/** Collapse "/Users/<name>/…" to "~/…" for display. */
export function tildify(path: string, home: string | null): string {
  return home && path.startsWith(home + '/') ? '~' + path.slice(home.length) : path
}

/** "912 B", "48 KB", "2.4 MB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

/** "/Users/<name>/Desktop/a.png" → "~/Desktop/a.png" without needing the home directory. */
export function tildifyUserPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+(?=\/)/u, '~')
}
