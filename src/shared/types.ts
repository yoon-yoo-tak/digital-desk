export const ITEM_TYPES = ['text', 'link', 'image', 'file', 'screenshot'] as const
export type ItemType = (typeof ITEM_TYPES)[number]

export type OcrStatus = 'pending' | 'done' | 'failed' | 'skipped'

export interface ItemMetadata {
  width?: number
  height?: number
  /** Bytes. For files: size on disk. For clipboard images: PNG size. */
  size?: number
  /** Text looks like code → render in mono (DESIGN §3). */
  mono?: boolean
  /** Clipboard text longer than the storage limit was cut. */
  truncated?: boolean
  /** Original file no longer exists. */
  missing?: boolean
  whereFroms?: string[]
}

export interface DeskItem {
  id: string
  type: ItemType
  title: string | null
  text: string | null
  ocrText: string | null
  filePath: string | null
  fileName: string | null
  url: string | null
  domain: string | null
  sourceApp: string | null
  sourceBundleId: string | null
  /** epoch ms — when the original came into existence */
  createdAt: number
  /** epoch ms — when Digital Desk first recorded it */
  capturedAt: number
  /** epoch ms — last capture of the same content; timeline order */
  lastUsedAt: number
  useCount: number
  /** Relative to the assets directory. Served as desk-asset://<previewPath>. */
  previewPath: string | null
  contentHash: string | null
  pinned: boolean
  archived: boolean
  ocrStatus: OcrStatus | null
  metadata: ItemMetadata
}

export type View = 'inbox' | 'desk' | 'archive'

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}

export interface SourceApp {
  name: string | null
  bundleId: string | null
}

export interface ExcludedApp {
  bundleId: string
  name: string
}

export interface SourceToggles {
  clipboard: boolean
  screenshots: boolean
  downloads: boolean
}

/** `null` = capturing, number = paused until epoch ms, 'indefinite' = until resumed. */
export type PausedUntil = number | 'indefinite' | null

export interface Settings {
  excludedApps: ExcludedApp[]
  fetchLinkTitles: boolean
  /** Days to keep unpinned temporary items; null = forever. */
  retentionDays: number | null
  pausedUntil: PausedUntil
  sources: SourceToggles
  /** null = where macOS saves screenshots (com.apple.screencapture location, else ~/Desktop). */
  screenshotFolder: string | null
  /** null = ~/Downloads */
  downloadsFolder: string | null
  /** Run OCR on new screenshots. */
  ocrEnabled: boolean
  /** First-run onboarding finished. Nothing is captured before this (DESIGN §10). */
  onboarded: boolean
  launchAtLogin: boolean
  /** Main window theme (the Quick Search panel is always dark). */
  appearance: Appearance
  /** Electron accelerators. */
  quickSearchShortcut: string
  pauseShortcut: string
}

export type Appearance = 'system' | 'light' | 'dark'

export type SettingsTab = 'general' | 'capture' | 'privacy' | 'storage' | 'shortcuts'

/** Onboarding step 3: a watched folder and whether macOS let us read it. */
export interface FolderAccess {
  kind: 'screenshots' | 'downloads'
  path: string
  ok: boolean
}

/** Result of registering the global shortcuts; false = taken by another app. */
export interface ShortcutStatus {
  quickSearch: boolean
  pause: boolean
}

export interface StorageInfo {
  path: string
  databaseBytes: number
  assetsBytes: number
  items: number
}

export interface CaptureStatus {
  paused: boolean
  pausedUntil: PausedUntil
  sources: SourceToggles
  /** Clipboard capture stops while the native helper is unavailable. */
  helper: 'running' | 'unavailable' | 'starting'
  /** false until onboarding is finished: nothing is captured yet. */
  onboarded: boolean
}

export type ItemAction = 'open' | 'copy' | 'reveal' | 'quickLook'

// ── Search (ARCHITECTURE §7) ──────────────────────────────────────────

export interface SearchHit {
  item: DeskItem
  score: number
  /** Text: the first line that matched. Screenshot: OCR lines around the first match. */
  excerpt: string | null
}

export type SearchGroupKind = 'top' | 'session' | 'other'

export interface SearchGroup {
  kind: SearchGroupKind
  /** "Same session · Thu 14:03–14:16" for sessions */
  label: string | null
  hits: SearchHit[]
}

export interface SearchDateRange {
  from: number
  to: number
  label: string
  /** Span of the date words in the query text. */
  start: number
  end: number
}

export interface SearchResponse {
  query: string
  dateRange: SearchDateRange | null
  filters: { type?: ItemType; app?: string; domain?: string }
  terms: string[]
  allTime: boolean
  groups: SearchGroup[]
  /** Results after all filters (before the 50-result cap). */
  total: number
  /** Per type, before the type filter — drives the filter bar. */
  typeCounts: Record<ItemType, number>
  /** Source apps among the results, most frequent first — drives "Any app". */
  apps: string[]
  /** Words that actually matched; the renderer highlights these. */
  matchWords: string[]
  tookMs: number
}

export interface QuickIdle {
  pinned: DeskItem[]
  recent: DeskItem[]
  /** Nothing has ever been captured. */
  empty: boolean
}
