// IPC handlers. Renderer input is validated here — the renderer is treated as untrusted.

import { BrowserWindow, Menu, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC } from '@shared/ipc'
import type {
  CaptureStatus,
  ExcludedApp,
  FolderAccess,
  ItemAction,
  Settings,
  SettingsTab,
  ShortcutStatus,
  StorageInfo,
  View
} from '@shared/types'
import type { ItemActions } from '../actions/itemActions'
import { captureMenuModel, toTemplate, type CaptureCommand } from '../captureMenu'
import type { CaptureState } from '../capture/captureState'
import type { Assets } from '../storage/assets'
import type { SearchService } from '../search/searchService'
import type { Deletions } from '../storage/deletions'
import type { ItemsRepo } from '../storage/itemsRepo'
import type { QuickSearchWindow } from '../windows/quickSearch'
import type { Clock } from '../clock'
import type { SettingsRepo } from '../storage/settingsRepo'

const VIEWS: readonly View[] = ['inbox', 'desk', 'archive']
const ACTIONS: readonly ItemAction[] = ['open', 'copy', 'reveal', 'quickLook']
const SETTING_KEYS: readonly (keyof Settings)[] = [
  'excludedApps',
  'fetchLinkTitles',
  'retentionDays',
  'sources',
  'screenshotFolder',
  'downloadsFolder',
  'ocrEnabled',
  'onboarded',
  'launchAtLogin',
  'appearance',
  'quickSearchShortcut',
  'pauseShortcut'
]

/** App-level operations the handlers need; implemented in index.ts. */
export interface AppControl {
  openSettings(tab?: SettingsTab): void
  confirmDeleteRecent(minutes: number, window: BrowserWindow | null): Promise<number>
  pickFolder(kind: 'screenshots' | 'downloads', window: BrowserWindow | null): Promise<string | null>
  pickApp(window: BrowserWindow | null): Promise<ExcludedApp | null>
  shortcutStatus(): ShortcutStatus
  storageInfo(): StorageInfo
  revealData(): void
  openPrivacySettings(): void
  onboardingFolders(): Promise<FolderAccess[]>
  finishOnboarding(): void
  onSettingsChanged(patch: Partial<Settings>): void
}

interface Deps {
  control: AppControl
  deletions: Deletions
  repo: ItemsRepo
  settings: SettingsRepo
  state: CaptureState
  assets: Assets
  actions: ItemActions
  search: SearchService
  quick: QuickSearchWindow
  now: Clock
  status: () => CaptureStatus
  runCommand: (command: CaptureCommand) => void
  onItemsChanged: () => void
}

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 200) throw new Error(`Invalid ${name}`)
}

export function registerIpcHandlers(deps: Deps): void {
  const { repo, settings, state, actions } = deps

  ipcMain.handle(IPC.listItems, (_e, view: unknown, cursor: unknown, limit: unknown) => {
    if (!VIEWS.includes(view as View)) throw new Error('Invalid view')
    const safeCursor = typeof cursor === 'string' ? cursor : null
    const safeLimit = typeof limit === 'number' && limit > 0 && limit <= 500 ? Math.floor(limit) : 100
    return repo.list(view as View, safeCursor, safeLimit)
  })

  ipcMain.handle(IPC.getItem, (_e, id: unknown) => {
    assertString(id, 'id')
    return repo.get(id)
  })

  ipcMain.handle(IPC.act, async (e: IpcMainInvokeEvent, id: unknown, action: unknown) => {
    assertString(id, 'id')
    if (!ACTIONS.includes(action as ItemAction)) throw new Error('Invalid action')
    const item = repo.get(id)
    if (!item) return
    const window = BrowserWindow.fromWebContents(e.sender)
    if (action === 'quickLook' && window === deps.quick.win) deps.quick.beginQuickLook()
    await actions.run(item, action as ItemAction, window)
  })

  ipcMain.handle(IPC.search, (_e, query: unknown, opts: unknown) => {
    if (typeof query !== 'string' || query.length > 500) throw new Error('Invalid query')
    const allTime = typeof opts === 'object' && opts !== null && (opts as { allTime?: unknown }).allTime === true
    return deps.search.search(query, { allTime }, deps.now())
  })

  ipcMain.handle(IPC.quickIdle, () => deps.search.idle())

  ipcMain.on(IPC.openQuickSearch, () => deps.quick.show())
  ipcMain.on(IPC.hideQuickSearch, () => deps.quick.hide())
  ipcMain.on(IPC.resizeQuickSearch, (e, width: unknown, height: unknown) => {
    if (BrowserWindow.fromWebContents(e.sender) !== deps.quick.win) return
    if (typeof width === 'number' && typeof height === 'number') deps.quick.resize(width, height)
  })

  ipcMain.handle(IPC.setPinned, (_e, id: unknown, pinned: unknown) => {
    assertString(id, 'id')
    repo.setPinned(id, pinned === true)
    deps.onItemsChanged()
  })

  ipcMain.handle(IPC.setArchived, (_e, id: unknown, archived: unknown) => {
    assertString(id, 'id')
    repo.setArchived(id, archived === true)
    deps.onItemsChanged()
  })

  ipcMain.handle(IPC.deleteItem, (_e, id: unknown) => {
    assertString(id, 'id')
    // Only the Desk record and app-owned assets go; the user's original file is never touched.
    return deps.deletions.delete(id)
  })

  ipcMain.handle(IPC.undoDelete, (_e, token: unknown) => {
    assertString(token, 'token')
    return deps.deletions.undo(token)
  })

  ipcMain.handle(IPC.captureDeleteRecent, (e, minutes: unknown) => {
    if (typeof minutes !== 'number' || !(minutes > 0)) throw new Error('Invalid minutes')
    return deps.control.confirmDeleteRecent(minutes, BrowserWindow.fromWebContents(e.sender))
  })

  ipcMain.handle(IPC.settingsPickFolder, (e, kind: unknown) => {
    if (kind !== 'screenshots' && kind !== 'downloads') throw new Error('Invalid folder kind')
    return deps.control.pickFolder(kind, BrowserWindow.fromWebContents(e.sender))
  })
  ipcMain.handle(IPC.settingsPickApp, (e) => deps.control.pickApp(BrowserWindow.fromWebContents(e.sender)))
  ipcMain.handle(IPC.settingsShortcutStatus, () => deps.control.shortcutStatus())
  ipcMain.handle(IPC.settingsStorageInfo, () => deps.control.storageInfo())
  ipcMain.on(IPC.settingsRevealData, () => deps.control.revealData())
  ipcMain.on(IPC.openSettings, (_e, tab: unknown) => {
    const tabs: SettingsTab[] = ['general', 'capture', 'privacy', 'storage', 'shortcuts']
    deps.control.openSettings(tabs.includes(tab as SettingsTab) ? (tab as SettingsTab) : undefined)
  })
  ipcMain.on(IPC.openPrivacySettings, () => deps.control.openPrivacySettings())
  ipcMain.handle(IPC.onboardingFolders, () => deps.control.onboardingFolders())
  ipcMain.handle(IPC.onboardingFinish, () => deps.control.finishOnboarding())

  ipcMain.handle(IPC.captureStatus, () => deps.status())

  ipcMain.handle(IPC.capturePause, (_e, minutes: unknown) => {
    if (minutes === null) state.pause(null)
    else if (typeof minutes === 'number' && minutes > 0 && minutes <= 24 * 60) state.pause(minutes)
    else throw new Error('Invalid pause duration')
  })

  ipcMain.handle(IPC.captureResume, () => state.resume())

  ipcMain.handle(IPC.settingsGet, () => settings.get())

  ipcMain.handle(IPC.settingsSet, (_e, patch: unknown) => {
    if (!patch || typeof patch !== 'object') throw new Error('Invalid settings')
    // Pausing goes through capture:pause so timers stay in sync.
    const allowed = Object.fromEntries(
      Object.entries(patch).filter(([k]) => SETTING_KEYS.includes(k as keyof Settings))
    ) as Partial<Settings>
    settings.set(allowed)
    deps.control.onSettingsChanged(allowed)
  })

  ipcMain.on(IPC.showCaptureMenu, (e, x: unknown, y: unknown) => {
    const window = BrowserWindow.fromWebContents(e.sender)
    if (!window || typeof x !== 'number' || typeof y !== 'number') return
    const entries = captureMenuModel({ ...deps.status(), includeAppItems: false })
    Menu.buildFromTemplate(toTemplate(entries, deps.runCommand)).popup({
      window,
      x: Math.round(x),
      y: Math.round(y)
    })
  })
}
