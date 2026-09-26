import { join } from 'node:path'
import { app } from 'electron'

/**
 * Where app data lives. Must be applied before `app.whenReady()`.
 * - DESK_USER_DATA overrides it (tests, demo profiles).
 * - Unpackaged dev runs use a separate "Digital Desk (Dev)" folder so they never touch real data.
 */
export function configureUserData(): void {
  const override = process.env.DESK_USER_DATA
  const profile = currentProfile()
  if (override) app.setPath('userData', override)
  else if (profile) app.setPath('userData', join(app.getPath('appData'), `Digital Desk (${profile})`))
  else if (!app.isPackaged) app.setPath('userData', join(app.getPath('appData'), 'Digital Desk (Dev)'))
}

/** `--profile=demo` → "Demo": a separate data folder (DEMO.md). */
export function currentProfile(): string | null {
  const arg = process.argv.find((a) => a.startsWith('--profile='))
  const name = arg?.slice('--profile='.length).replace(/[^\w-]/gu, '')
  return name ? name[0]?.toUpperCase() + name.slice(1) : null
}

/** Bundled resources: `resources/` in dev, Contents/Resources when packaged. */
export function resourcesDir(): string {
  return app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
}

export function helperBinary(): string {
  return join(resourcesDir(), 'bin', 'desk-helper')
}

export function trayIcon(paused: boolean): string {
  return join(resourcesDir(), 'tray', paused ? 'trayPausedTemplate.png' : 'trayTemplate.png')
}
