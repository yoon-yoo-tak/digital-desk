// The capture menu shown from the menu bar and from the toolbar's status pill (DESIGN §8.2).
// `captureMenuModel` is pure so the wording and states are testable; `toTemplate` binds it to Electron.

import type { MenuItemConstructorOptions } from 'electron'
import { formatClock } from '@shared/format/time'
import type { CaptureStatus, PausedUntil, SourceToggles } from '@shared/types'
import { CAPTURE_STRINGS } from '@shared/format/capture'

/** Sources that exist in this build. */
export const IMPLEMENTED_SOURCES: (keyof SourceToggles)[] = ['clipboard', 'screenshots', 'downloads']

const SOURCE_LABELS: Record<keyof SourceToggles, string> = {
  clipboard: 'Clipboard',
  screenshots: 'Screenshots',
  downloads: 'Downloads'
}

export type CaptureCommand =
  | { kind: 'pause'; minutes: number | null }
  | { kind: 'resume' }
  | { kind: 'extend'; minutes: number }
  | { kind: 'openMain' }
  | { kind: 'quickSearch' }
  | { kind: 'deleteRecent'; minutes: number }
  | { kind: 'settings' }
  | { kind: 'quit' }

export type MenuEntry =
  | { kind: 'header'; label: string; sublabel: string }
  | { kind: 'item'; label: string; command: CaptureCommand; accelerator?: string }
  | { kind: 'separator' }

export interface CaptureMenuInput {
  paused: boolean
  pausedUntil: PausedUntil
  sources: SourceToggles
  /** Tray adds Open / Quit; the in-window pill doesn't. */
  includeAppItems: boolean
  /** Before onboarding nothing is captured; the menu says so. */
  onboarded?: boolean
  helper?: CaptureStatus['helper']
}

const appItems: MenuEntry[] = [
  { kind: 'item', label: 'Quick Search', command: { kind: 'quickSearch' }, accelerator: 'CommandOrControl+Shift+Space' },
  { kind: 'item', label: 'Open Digital Desk', command: { kind: 'openMain' } }
]

/** Order follows DESIGN §8.2 and MenuBar.dc.html. */
export function captureMenuModel(input: CaptureMenuInput): MenuEntry[] {
  const entries: MenuEntry[] = []
  if (input.onboarded === false) {
    entries.push({ kind: 'header', label: 'Not capturing yet', sublabel: 'Finish setup to start' })
    entries.push({ kind: 'separator' })
    entries.push({ kind: 'item', label: 'Finish setup…', command: { kind: 'openMain' } })
    if (input.includeAppItems) {
      entries.push({ kind: 'separator' })
      entries.push({ kind: 'item', label: 'Quit Digital Desk', command: { kind: 'quit' }, accelerator: 'Command+Q' })
    }
    return entries
  }
  if (input.paused) {
    const until = input.pausedUntil
    entries.push({
      kind: 'header',
      label: 'Paused',
      sublabel:
        typeof until === 'number' ? `Nothing is being captured until ${formatClock(until)}` : 'Nothing is being captured'
    })
    entries.push({ kind: 'separator' })
    entries.push({ kind: 'item', label: 'Resume capturing', command: { kind: 'resume' } })
    if (typeof until === 'number') {
      entries.push({ kind: 'item', label: 'Extend pause by 30 minutes', command: { kind: 'extend', minutes: 30 } })
    }
    if (input.includeAppItems) entries.push({ kind: 'separator' }, ...appItems)
  } else {
    const clipboardUnavailable = input.sources.clipboard && input.helper !== undefined && input.helper !== 'running'
    const active = IMPLEMENTED_SOURCES
      .filter((s) => input.sources[s] && !(s === 'clipboard' && clipboardUnavailable))
      .map((s) => SOURCE_LABELS[s])
    entries.push({
      kind: 'header',
      label: clipboardUnavailable ? CAPTURE_STRINGS.unavailable : active.length > 0 ? 'Capturing' : CAPTURE_STRINGS.off,
      sublabel: clipboardUnavailable
        ? `${active.length > 0 ? `${active.join(' · ')} still active. ` : ''}${CAPTURE_STRINGS.unavailableDetail}`
        : active.length > 0 ? active.join(' · ') : 'All sources are off'
    })
    entries.push({ kind: 'separator' })
    if (input.includeAppItems) entries.push(...appItems, { kind: 'separator' })
    entries.push({ kind: 'item', label: 'Pause for 5 minutes', command: { kind: 'pause', minutes: 5 } })
    entries.push({ kind: 'item', label: 'Pause for 30 minutes', command: { kind: 'pause', minutes: 30 } })
    entries.push({ kind: 'item', label: 'Pause until resumed', command: { kind: 'pause', minutes: null } })
    if (input.includeAppItems) {
      entries.push({ kind: 'separator' })
      entries.push({ kind: 'item', label: 'Delete last 5 minutes…', command: { kind: 'deleteRecent', minutes: 5 } })
      entries.push({ kind: 'item', label: 'Delete last hour…', command: { kind: 'deleteRecent', minutes: 60 } })
    }
  }
  if (input.includeAppItems) {
    entries.push({ kind: 'separator' })
    entries.push({ kind: 'item', label: 'Settings…', command: { kind: 'settings' }, accelerator: 'Command+,' })
    entries.push({ kind: 'item', label: 'Quit Digital Desk', command: { kind: 'quit' }, accelerator: 'Command+Q' })
  }
  return entries
}

export function toTemplate(
  entries: MenuEntry[],
  run: (command: CaptureCommand) => void
): MenuItemConstructorOptions[] {
  return entries.map((entry): MenuItemConstructorOptions => {
    switch (entry.kind) {
      case 'header':
        return { label: entry.label, sublabel: entry.sublabel, enabled: false }
      case 'separator':
        return { type: 'separator' }
      case 'item':
        return {
          label: entry.label,
          // Shown for reference only; the global shortcut is registered separately.
          accelerator: entry.accelerator,
          registerAccelerator: false,
          click: () => run(entry.command)
        }
    }
  })
}
