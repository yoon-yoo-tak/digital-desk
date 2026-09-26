import type {
  CaptureStatus,
  DeskItem,
  ExcludedApp,
  FolderAccess,
  ItemAction,
  Page,
  QuickIdle,
  SearchResponse,
  Settings,
  SettingsTab,
  ShortcutStatus,
  StorageInfo,
  View
} from './types'

/** IPC channel names. The only place they are spelled out. */
export const IPC = {
  listItems: 'items:list',
  getItem: 'items:get',
  act: 'items:act',
  setPinned: 'items:setPinned',
  setArchived: 'items:setArchived',
  deleteItem: 'items:delete',
  undoDelete: 'items:undoDelete',
  captureDeleteRecent: 'capture:deleteRecent',
  settingsPickFolder: 'settings:pickFolder',
  settingsPickApp: 'settings:pickApp',
  settingsShortcutStatus: 'settings:shortcutStatus',
  settingsStorageInfo: 'settings:storageInfo',
  settingsRevealData: 'settings:revealData',
  openSettings: 'ui:openSettings',
  openPrivacySettings: 'ui:openPrivacySettings',
  onboardingFolders: 'onboarding:folders',
  onboardingFinish: 'onboarding:finish',
  captureStatus: 'capture:status',
  capturePause: 'capture:pause',
  captureResume: 'capture:resume',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  showCaptureMenu: 'ui:showCaptureMenu',
  search: 'search:query',
  quickIdle: 'search:idle',
  openQuickSearch: 'ui:openQuickSearch',
  hideQuickSearch: 'ui:hideQuickSearch',
  resizeQuickSearch: 'ui:resizeQuickSearch',
  // main → renderer events
  itemsChanged: 'event:items-changed',
  captureStatusChanged: 'event:capture-status',
  quickShown: 'event:quick-shown',
  quickHidden: 'event:quick-hidden',
  settingsChanged: 'event:settings-changed',
  openSettingsTab: 'event:open-settings-tab'
} as const

export type DeskEvent =
  | 'items-changed'
  | 'capture-status'
  | 'quick-shown'
  | 'quick-hidden'
  | 'settings-changed'
  | 'open-settings-tab'

export interface DeskEventPayloads {
  'items-changed': void
  'capture-status': CaptureStatus
  /** restore: reopened within a minute — keep the previous query. */
  'quick-shown': { restore: boolean }
  'quick-hidden': void
  'settings-changed': Settings
  'open-settings-tab': SettingsTab
}

/** Exposed to renderers as `window.desk` by the preload script. */
export interface DeskApi {
  listItems(view: View, cursor?: string | null, limit?: number): Promise<Page<DeskItem>>
  getItem(id: string): Promise<DeskItem | null>
  search(query: string, opts?: { allTime?: boolean }): Promise<SearchResponse>
  quickIdle(): Promise<QuickIdle>
  act(id: string, action: ItemAction): Promise<void>
  setPinned(id: string, pinned: boolean): Promise<void>
  setArchived(id: string, archived: boolean): Promise<void>
  /** Deletes now; `undoDelete` within 5 s puts it back. */
  deleteItem(id: string): Promise<{ undoToken: string } | null>
  undoDelete(token: string): Promise<boolean>
  capture: {
    status(): Promise<CaptureStatus>
    /** minutes = null → until resumed */
    pause(minutes: number | null): Promise<void>
    resume(): Promise<void>
    /** Asks for confirmation in a native dialog; resolves to the number deleted (0 if cancelled). */
    deleteRecent(minutes: number): Promise<number>
  }
  settings: {
    get(): Promise<Settings>
    set(patch: Partial<Settings>): Promise<void>
    pickFolder(kind: 'screenshots' | 'downloads'): Promise<string | null>
    pickApp(): Promise<ExcludedApp | null>
    shortcutStatus(): Promise<ShortcutStatus>
    storageInfo(): Promise<StorageInfo>
    revealData(): void
  }
  onboarding: {
    folders(): Promise<FolderAccess[]>
    finish(): Promise<void>
  }
  ui: {
    /** Pops up the pause/resume menu anchored at (x, y) in window coordinates. */
    showCaptureMenu(x: number, y: number): void
    openQuickSearch(): void
    /** Focus goes back to the app that was in front (the panel never activates Digital Desk). */
    hideQuickSearch(): void
    resizeQuickSearch(width: number, height: number): void
    openSettings(tab?: SettingsTab): void
    openPrivacySettings(): void
  }
  on<E extends DeskEvent>(event: E, listener: (payload: DeskEventPayloads[E]) => void): () => void
}
