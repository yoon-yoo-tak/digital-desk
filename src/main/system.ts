// macOS integration: login item, appearance, Dock, global shortcuts, folder access, app info, storage.

import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { BrowserWindow, app, globalShortcut, nativeTheme } from 'electron'
import type { ExcludedApp, FolderAccess, Settings, ShortcutStatus, StorageInfo } from '@shared/types'

/** Login items only make sense for the packaged app; in dev it would register the Electron binary. */
export function applyLoginItem(enabled: boolean): void {
  if (!app.isPackaged) {
    console.log(`[system] launch at login = ${enabled} (not applied to dev builds)`)
    return
  }
  // Only when it changes: unsigned builds may not be allowed to register at all.
  if (app.getLoginItemSettings().openAtLogin === enabled) return
  app.setLoginItemSettings({ openAtLogin: enabled })
}

export function applyAppearance(appearance: Settings['appearance']): void {
  nativeTheme.themeSource = appearance
}

/**
 * Menu-bar app (DESIGN §8.3): the Dock icon shows only while a regular window (main, Settings,
 * Onboarding) is open. The Quick Search panel doesn't count.
 * macOS keeps the icon of the *active* app even after `dock.hide()` (measured on macOS 27), so when
 * the last window closes we also hand focus back to the previous app — unless the panel is up.
 */
export function updateDock(panel: BrowserWindow): void {
  if (panel.isDestroyed()) return // quitting
  const anyWindow = BrowserWindow.getAllWindows().some((w) => w !== panel && !w.isDestroyed() && w.isVisible())
  if (anyWindow) {
    void app.dock?.show()
    return
  }
  app.dock?.hide()
  if (!panel.isVisible()) app.hide()
}

export function registerShortcuts(
  settings: Settings,
  handlers: { quickSearch: () => void; pause: () => void }
): ShortcutStatus {
  globalShortcut.unregisterAll()
  const register = (accelerator: string, fn: () => void): boolean => {
    try {
      return globalShortcut.register(accelerator, fn)
    } catch {
      return false // malformed accelerator
    }
  }
  const status = {
    quickSearch: register(settings.quickSearchShortcut, handlers.quickSearch),
    pause: register(settings.pauseShortcut, handlers.pause)
  }
  if (!status.quickSearch) console.warn(`[shortcuts] could not register ${settings.quickSearchShortcut}`)
  if (!status.pause) console.warn(`[shortcuts] could not register ${settings.pauseShortcut}`)
  return status
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll()
}

/** Reading a folder is what triggers the Files & Folders prompt, so onboarding does it on purpose. */
export function checkFolder(kind: FolderAccess['kind'], path: string): FolderAccess {
  try {
    readdirSync(path)
    return { kind, path, ok: true }
  } catch {
    return { kind, path, ok: false }
  }
}

/** Bundle id and display name from an .app's Info.plist (for "Never capture from"). */
export function readAppInfo(appPath: string): ExcludedApp | null {
  try {
    const json = execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', join(appPath, 'Contents', 'Info.plist')], {
      encoding: 'utf8'
    })
    const info = JSON.parse(json) as Record<string, unknown>
    const bundleId = typeof info.CFBundleIdentifier === 'string' ? info.CFBundleIdentifier : null
    if (!bundleId) return null
    const name =
      (typeof info.CFBundleDisplayName === 'string' && info.CFBundleDisplayName) ||
      (typeof info.CFBundleName === 'string' && info.CFBundleName) ||
      basename(appPath, '.app')
    return { bundleId, name }
  } catch {
    return null
  }
}

function sizeOf(path: string): number {
  try {
    const s = statSync(path)
    if (!s.isDirectory()) return s.size
    return readdirSync(path).reduce((sum, name) => sum + sizeOf(join(path, name)), 0)
  } catch {
    return 0
  }
}

export function storageInfo(userData: string, items: number): StorageInfo {
  const db = join(userData, 'desk.db')
  return {
    path: userData,
    databaseBytes: sizeOf(db) + sizeOf(`${db}-wal`) + sizeOf(`${db}-shm`),
    assetsBytes: sizeOf(join(userData, 'assets')),
    items
  }
}

export const PRIVACY_SETTINGS_URL = 'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders'
