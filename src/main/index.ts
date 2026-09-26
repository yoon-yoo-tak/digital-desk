// App bootstrap: storage → capture → UI surfaces.

import { join } from 'node:path'
import { BrowserWindow, Menu, app, dialog, net, shell } from 'electron'
import { IPC } from '@shared/ipc'
import type { CaptureStatus, Settings, SettingsTab, ShortcutStatus } from '@shared/types'
import { ItemActions } from './actions/itemActions'
import { CaptureState } from './capture/captureState'
import { ClipboardWatcher } from './capture/clipboardWatcher'
import { ElectronClipboardReader, FallbackPasteboardPoller } from './capture/electronClipboard'
import { FileCapture } from './capture/fileCapture'
import { DEFAULT_SCREENSHOT_FOLDER, FolderWatcher, electronProbe, helperOcrEngine } from './capture/folderWatchers'
import { OcrQueue } from './indexing/ocrQueue'
import type { CaptureCommand } from './captureMenu'
import { systemClock } from './clock'
import { DeskHelper, type PasteboardEvent } from './helper/deskHelper'
import { fetchLinkTitle } from './indexing/linkTitle'
import { registerIpcHandlers, type AppControl } from './ipc/handlers'
import { SearchService } from './search/searchService'
import { configureUserData, currentProfile, helperBinary } from './paths'
import { handleAssetProtocol, registerAssetScheme } from './protocol'
import { Assets } from './storage/assets'
import { openDatabase } from './storage/db'
import { ItemsRepo } from './storage/itemsRepo'
import { Deletions } from './storage/deletions'
import { SettingsRepo } from './storage/settingsRepo'
import { parseSeedArgs, runSeed, seedDemoData } from './seed/runSeed'
import { DeskTray } from './tray'
import { showMainWindow } from './windows/mainWindow'
import { PageWindow } from './windows/pageWindow'
import { QuickSearchWindow } from './windows/quickSearch'
import {
  PRIVACY_SETTINGS_URL,
  applyAppearance,
  applyLoginItem,
  checkFolder,
  readAppInfo,
  registerShortcuts,
  storageInfo,
  unregisterShortcuts,
  updateDock
} from './system'

app.setName('Digital Desk')
configureUserData()
registerAssetScheme()

if (process.argv.includes('--seed')) {
  // `npm run seed`: write demo data and exit. No windows, no capture, no single-instance lock
  // (the dev app may be running against the same data; SQLite WAL handles the concurrent writer).
  app.dock?.hide()
  void app.whenReady().then(async () => {
    try {
      await runSeed(parseSeedArgs(process.argv))
      app.exit(0)
    } catch (error) {
      console.error('seed failed:', error)
      app.exit(1)
    }
  })
} else if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showMainWindow())
  void app.whenReady().then(start)
}

function broadcast(channel: string, payload?: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }
}

async function start(): Promise<void> {
  const now = systemClock
  const userData = app.getPath('userData')
  const db = openDatabase(join(userData, 'desk.db'))
  const repo = new ItemsRepo(db)
  const settings = new SettingsRepo(db)
  const assets = new Assets(join(userData, 'assets'))
  const state = new CaptureState(settings, now)
  const helper = new DeskHelper(helperBinary(), now)

  // Demo profile (DEMO.md): its own data folder, seeded on first launch, no onboarding.
  if (currentProfile() === 'Demo' && repo.count() === 0) {
    const written = await seedDemoData({ repo, assets, demoRoot: join(userData, 'demo-files') }, 0)
    settings.set({ onboarded: true })
    console.log(`[demo] seeded ${written} items`)
  }
  let helperMode: CaptureStatus['helper'] = 'starting'

  // Coalesce bursts of changes into one renderer refresh.
  let changeTimer: NodeJS.Timeout | null = null
  const onItemsChanged = (): void => {
    if (changeTimer) return
    changeTimer = setTimeout(() => {
      changeTimer = null
      broadcast(IPC.itemsChanged)
    }, 50)
  }

  const watcher = new ClipboardWatcher({
    repo,
    state,
    reader: new ElectronClipboardReader(helper),
    assets,
    now,
    onChanged: onItemsChanged,
    fetchTitle: (url) =>
      settings.get().fetchLinkTitles ? fetchLinkTitle(url, (u, init) => net.fetch(u, init)) : Promise.resolve(null)
  })
  const actions = new ItemActions({ repo, assets, watcher, helper, onChanged: onItemsChanged })
  const search = new SearchService(db)
  const quick = new QuickSearchWindow(now)
  const deletions = new Deletions({ repo, assets, now, onChanged: onItemsChanged })
  const settingsWindow = new PageWindow('settings', {
    width: 760,
    height: 800,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Settings',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 16 }
  })
  const onboardingWindow = new PageWindow('onboarding', {
    width: 480,
    height: 460,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Welcome to Digital Desk',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 14 }
  })

  /** Before onboarding is finished, "open the app" means the onboarding window (DESIGN §10). */
  const showHome = (): void => {
    if (settings.get().onboarded) showMainWindow()
    else onboardingWindow.show()
  }

  const openSettings = (tab?: SettingsTab): void => {
    const win = settingsWindow.show()
    if (!tab) return
    const send = (): void => win.webContents.send(IPC.openSettingsTab, tab)
    if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
    else send()
  }

  /** "Delete last 5 minutes…" asks first (DESIGN §8.2). */
  const confirmDeleteRecent = async (minutes: number, window: BrowserWindow | null): Promise<number> => {
    const count = deletions.countRecent(minutes)
    const everything = !Number.isFinite(minutes)
    const span = minutes >= 60 ? (minutes === 60 ? 'hour' : `${minutes / 60} hours`) : `${minutes} minutes`
    const noun = `${count} ${count === 1 ? 'item' : 'items'}`
    const options = {
      type: 'warning' as const,
      message:
        count === 0
          ? everything
            ? 'Your desk is already empty.'
            : `Nothing was captured in the last ${span}.`
          : everything
            ? `Delete all ${noun}?`
            : `Delete ${noun} captured in the last ${span}?`,
      detail: count > 0 ? 'Files on disk are not touched.' : undefined,
      buttons: count > 0 ? ['Delete', 'Cancel'] : ['OK'],
      defaultId: count > 0 ? 1 : 0,
      cancelId: count > 0 ? 1 : 0
    }
    const { response } = window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options)
    return count > 0 && response === 0 ? deletions.deleteRecent(minutes) : 0
  }

  const status = (): CaptureStatus => ({
    paused: state.isPaused(),
    pausedUntil: state.pausedUntil(),
    sources: settings.get().sources,
    helper: helperMode,
    onboarded: settings.get().onboarded
  })

  const runCommand = (command: CaptureCommand): void => {
    switch (command.kind) {
      case 'pause':
        return state.pause(command.minutes)
      case 'resume':
        return state.resume()
      case 'extend':
        return state.extend(command.minutes)
      case 'openMain':
        showHome()
        return
      case 'deleteRecent':
        void confirmDeleteRecent(command.minutes, null)
        return
      case 'settings':
        openSettings()
        return
      case 'quickSearch':
        quick.show()
        return
      case 'quit':
        app.quit()
        return
    }
  }

  const tray = new DeskTray(runCommand)
  const publishStatus = (): void => {
    const current = status()
    tray.update(current)
    broadcast(IPC.captureStatusChanged, current)
  }
  state.on('change', publishStatus)
  state.start()

  // Capture: the native helper when possible, a degraded poller otherwise.
  // Logs what happened and from which app — never the content.
  const capture = (event: PasteboardEvent): void => {
    void watcher.handle(event).then((outcome) => {
      const detail = outcome.kind === 'skipped' ? outcome.reason : outcome.items.map((i) => i.type).join(',')
      console.log(`[capture] clipboard ${outcome.kind} (${detail}) from ${event.app.name ?? 'unknown app'}`)
    })
  }
  const fallback = new FallbackPasteboardPoller(state, now, capture)
  helper.on('pasteboard', capture)
  // Screenshots and Downloads (ARCHITECTURE §6.2–6.3). The screenshot folder comes from the helper.
  const ocrQueue = new OcrQueue({
    repo,
    engine: helperOcrEngine(helper, () => settings.get().ocrEnabled),
    onChanged: onItemsChanged
  })
  const fileCapture = new FileCapture({
    repo,
    state,
    probe: electronProbe(helper, assets),
    ocr: ocrQueue,
    now,
    onChanged: onItemsChanged
  })
  const screenshotWatcher = new FolderWatcher('screenshots', 400, (p) => fileCapture.screenshot(p), (p) => fileCapture.removed(p))
  const downloadWatcher = new FolderWatcher('downloads', 1000, (p) => fileCapture.download(p), (p) => fileCapture.removed(p))
  const screenshotFolder = async (): Promise<string> =>
    settings.get().screenshotFolder ??
    (helper.running ? await helper.screenshotLocation().catch(() => null) : null) ??
    DEFAULT_SCREENSHOT_FOLDER
  const startFolderWatchers = async (): Promise<void> => {
    const current = settings.get()
    downloadWatcher.watch(current.downloadsFolder ?? app.getPath('downloads'))
    const located = current.screenshotFolder ?? (helper.running ? await helper.screenshotLocation().catch(() => null) : null)
    screenshotWatcher.watch(located ?? DEFAULT_SCREENSHOT_FOLDER)
  }

  helper.on('ready', () => {
    helperMode = 'running'
    fallback.stop()
    publishStatus()
    void startFolderWatchers()
    // OCR that was still queued when the app last quit.
    for (const item of repo.findPendingOcr()) if (item.filePath) ocrQueue.enqueue(item.id, item.filePath)
  })
  helper.on('unavailable', (reason) => {
    console.warn('[desk-helper] unavailable:', reason)
    helperMode = 'fallback'
    fallback.start()
    publishStatus()
    void startFolderWatchers()
  })
  helper.start()

  // Global shortcuts (Settings › Shortcuts). ⌥⌘P toggles pause.
  const togglePause = (): void => (state.isPaused() ? state.resume() : state.pause(null))
  const shortcutHandlers = { quickSearch: () => quick.toggle(), pause: togglePause }
  let shortcutStatus: ShortcutStatus = registerShortcuts(settings.get(), shortcutHandlers)

  // Retention: at launch and every 6 hours (ARCHITECTURE §6.6).
  const runRetention = (): void => {
    const removed = deletions.expire(settings.get().retentionDays)
    if (removed > 0) console.log(`[retention] removed ${removed} expired items`)
  }
  runRetention()
  const retentionTimer = setInterval(runRetention, 6 * 60 * 60 * 1000)

  applyLoginItem(settings.get().launchAtLogin)
  applyAppearance(settings.get().appearance)

  const onSettingsChanged = (patch: Partial<Settings>): void => {
    const current = settings.get()
    if ('screenshotFolder' in patch || 'downloadsFolder' in patch) void startFolderWatchers()
    if ('quickSearchShortcut' in patch || 'pauseShortcut' in patch) {
      shortcutStatus = registerShortcuts(current, shortcutHandlers)
    }
    if ('launchAtLogin' in patch) applyLoginItem(current.launchAtLogin)
    if ('appearance' in patch) applyAppearance(current.appearance)
    if ('retentionDays' in patch) runRetention()
    if ('sources' in patch || 'onboarded' in patch) publishStatus()
    broadcast(IPC.settingsChanged, current)
  }

  const control: AppControl = {
    openSettings,
    confirmDeleteRecent,
    pickFolder: async (kind, window) => {
      const options = {
        defaultPath: kind === 'screenshots' ? await screenshotFolder() : app.getPath('downloads'),
        properties: ['openDirectory' as const, 'createDirectory' as const]
      }
      const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
      return result.canceled ? null : (result.filePaths[0] ?? null)
    },
    pickApp: async (window) => {
      const options = {
        defaultPath: '/Applications',
        properties: ['openFile' as const],
        filters: [{ name: 'Applications', extensions: ['app'] }]
      }
      const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options)
      const path = result.canceled ? null : result.filePaths[0]
      return path ? readAppInfo(path) : null
    },
    shortcutStatus: () => shortcutStatus,
    storageInfo: () => storageInfo(userData, repo.count()),
    revealData: () => void shell.openPath(userData),
    openPrivacySettings: () => void shell.openExternal(PRIVACY_SETTINGS_URL),
    onboardingFolders: async () => [
      checkFolder('screenshots', await screenshotFolder()),
      checkFolder('downloads', settings.get().downloadsFolder ?? app.getPath('downloads'))
    ],
    finishOnboarding: () => {
      settings.set({ onboarded: true })
      onSettingsChanged({ onboarded: true })
      onboardingWindow.close()
    },
    onSettingsChanged
  }

  handleAssetProtocol(assets)
  registerIpcHandlers({
    control,
    deletions,
    repo,
    settings,
    state,
    assets,
    actions,
    search,
    quick,
    now,
    status,
    runCommand,
    onItemsChanged
  })

  // App menu: Settings… ⌘, and the standard Edit menu (copy/paste in text fields needs it).
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { label: 'Settings…', accelerator: 'Command+,', click: () => openSettings() },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      { role: 'editMenu' },
      ...(app.isPackaged ? [] : [{ role: 'viewMenu' as const }]),
      { role: 'windowMenu' }
    ])
  )

  // Menu-bar app (DESIGN §8.3): the Dock icon follows the regular windows.
  let quitting = false
  app.on('browser-window-created', (_e, win) => {
    for (const event of ['show', 'hide', 'closed'] as const) {
      win.on(event as 'show', () => setImmediate(() => !quitting && updateDock(quick.win)))
    }
  })
  publishStatus()
  showHome()
  updateDock(quick.win)

  // Closing the windows keeps capturing.
  app.on('window-all-closed', () => undefined)
  app.on('activate', () => showHome())
  app.on('will-quit', () => unregisterShortcuts())
  // `kill` / logout: quit through the normal path so watchers, helper and database close cleanly.
  process.on('SIGTERM', () => app.quit())
  let cleanedUp = false
  app.on('before-quit', () => {
    quitting = true
    if (cleanedUp) return
    cleanedUp = true
    clearInterval(retentionTimer)
    deletions.flush()
    void screenshotWatcher.close()
    void downloadWatcher.close()
    state.stop()
    fallback.stop()
    helper.stop()
    tray.destroy()
    db.close()
  })
}
