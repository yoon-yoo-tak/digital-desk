import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type DeskApi, type DeskEvent } from '@shared/ipc'

const EVENT_CHANNELS: Record<DeskEvent, string> = {
  'items-changed': IPC.itemsChanged,
  'capture-status': IPC.captureStatusChanged,
  'quick-shown': IPC.quickShown,
  'quick-hidden': IPC.quickHidden,
  'settings-changed': IPC.settingsChanged,
  'open-settings-tab': IPC.openSettingsTab
}

const api: DeskApi = {
  listItems: (view, cursor, limit) => ipcRenderer.invoke(IPC.listItems, view, cursor ?? null, limit),
  getItem: (id) => ipcRenderer.invoke(IPC.getItem, id),
  search: (query, opts) => ipcRenderer.invoke(IPC.search, query, opts ?? {}),
  quickIdle: () => ipcRenderer.invoke(IPC.quickIdle),
  act: (id, action) => ipcRenderer.invoke(IPC.act, id, action),
  setPinned: (id, pinned) => ipcRenderer.invoke(IPC.setPinned, id, pinned),
  setArchived: (id, archived) => ipcRenderer.invoke(IPC.setArchived, id, archived),
  deleteItem: (id) => ipcRenderer.invoke(IPC.deleteItem, id),
  undoDelete: (token) => ipcRenderer.invoke(IPC.undoDelete, token),
  capture: {
    status: () => ipcRenderer.invoke(IPC.captureStatus),
    pause: (minutes) => ipcRenderer.invoke(IPC.capturePause, minutes),
    resume: () => ipcRenderer.invoke(IPC.captureResume),
    deleteRecent: (minutes) => ipcRenderer.invoke(IPC.captureDeleteRecent, minutes)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    set: (patch) => ipcRenderer.invoke(IPC.settingsSet, patch),
    pickFolder: (kind) => ipcRenderer.invoke(IPC.settingsPickFolder, kind),
    pickApp: () => ipcRenderer.invoke(IPC.settingsPickApp),
    shortcutStatus: () => ipcRenderer.invoke(IPC.settingsShortcutStatus),
    storageInfo: () => ipcRenderer.invoke(IPC.settingsStorageInfo),
    revealData: () => ipcRenderer.send(IPC.settingsRevealData)
  },
  onboarding: {
    folders: () => ipcRenderer.invoke(IPC.onboardingFolders),
    finish: () => ipcRenderer.invoke(IPC.onboardingFinish)
  },
  ui: {
    showCaptureMenu: (x, y) => ipcRenderer.send(IPC.showCaptureMenu, x, y),
    openQuickSearch: () => ipcRenderer.send(IPC.openQuickSearch),
    hideQuickSearch: () => ipcRenderer.send(IPC.hideQuickSearch),
    resizeQuickSearch: (width, height) => ipcRenderer.send(IPC.resizeQuickSearch, width, height),
    openSettings: (tab) => ipcRenderer.send(IPC.openSettings, tab),
    openPrivacySettings: () => ipcRenderer.send(IPC.openPrivacySettings)
  },
  on: (event, listener) => {
    const channel = EVENT_CHANNELS[event]
    const handler = (_e: IpcRendererEvent, payload: unknown): void => listener(payload as never)
    ipcRenderer.on(channel, handler)
    return () => {
      ipcRenderer.removeListener(channel, handler)
    }
  }
}

contextBridge.exposeInMainWorld('desk', api)
