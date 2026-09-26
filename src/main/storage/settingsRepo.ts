import type { ExcludedApp, Settings } from '@shared/types'
import type { Db } from './db'

/** Password managers and keychains are never captured (PRODUCT §27, ARCHITECTURE §6.1). */
export const DEFAULT_EXCLUDED_APPS: ExcludedApp[] = [
  { bundleId: 'com.1password.1password', name: '1Password' },
  { bundleId: 'com.agilebits.onepassword7', name: '1Password 7' },
  { bundleId: 'com.apple.keychainaccess', name: 'Keychain Access' },
  { bundleId: 'com.apple.Passwords', name: 'Passwords' },
  { bundleId: 'com.bitwarden.desktop', name: 'Bitwarden' },
  { bundleId: 'com.lastpass.LastPass', name: 'LastPass' }
]

export const DEFAULT_SETTINGS: Settings = {
  excludedApps: DEFAULT_EXCLUDED_APPS,
  fetchLinkTitles: true,
  retentionDays: 30,
  pausedUntil: null,
  sources: { clipboard: true, screenshots: true, downloads: true },
  screenshotFolder: null,
  downloadsFolder: null,
  ocrEnabled: true,
  onboarded: false,
  launchAtLogin: false,
  appearance: 'system',
  quickSearchShortcut: 'CommandOrControl+Shift+Space',
  pauseShortcut: 'Alt+CommandOrControl+P'
}

export class SettingsRepo {
  constructor(private readonly db: Db) {}

  get(): Settings {
    const rows = this.db.prepare('SELECT key, value_json FROM settings').all() as { key: string; value_json: string }[]
    const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value_json) as unknown]))
    return { ...DEFAULT_SETTINGS, ...stored } as Settings
  }

  set(patch: Partial<Settings>): Settings {
    const upsert = this.db.prepare(
      'INSERT INTO settings (key, value_json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json'
    )
    this.db.transaction(() => {
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) upsert.run(key, JSON.stringify(value))
      }
    })()
    return this.get()
  }
}
