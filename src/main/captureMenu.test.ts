import { describe, expect, it } from 'vitest'
import { captureMenuModel, type MenuEntry } from './captureMenu'

const sources = { clipboard: true, screenshots: true, downloads: true }
const labels = (entries: MenuEntry[]): string[] =>
  entries.map((e) => (e.kind === 'separator' ? '—' : e.label))

describe('captureMenuModel', () => {
  it('offers pause options while capturing', () => {
    const entries = captureMenuModel({ paused: false, pausedUntil: null, sources, includeAppItems: true })
    expect(entries[0]).toEqual({ kind: 'header', label: 'Capturing', sublabel: 'Clipboard · Screenshots · Downloads' })
    expect(labels(entries)).toEqual([
      'Capturing',
      '—',
      'Quick Search',
      'Open Digital Desk',
      '—',
      'Pause for 5 minutes',
      'Pause for 30 minutes',
      'Pause until resumed',
      '—',
      'Delete last 5 minutes…',
      'Delete last hour…',
      '—',
      'Settings…',
      'Quit Digital Desk'
    ])
  })

  it('says nothing is captured before onboarding', () => {
    const entries = captureMenuModel({ paused: false, pausedUntil: null, sources, includeAppItems: true, onboarded: false })
    expect(labels(entries)).toEqual(['Not capturing yet', '—', 'Finish setup…', '—', 'Quit Digital Desk'])
  })

  it('shows when a timed pause ends and allows extending it', () => {
    const until = new Date(2026, 8, 26, 14, 52).getTime()
    const entries = captureMenuModel({ paused: true, pausedUntil: until, sources, includeAppItems: false })
    expect(entries[0]).toEqual({
      kind: 'header',
      label: 'Paused',
      sublabel: 'Nothing is being captured until 14:52'
    })
    expect(labels(entries)).toEqual(['Paused', '—', 'Resume capturing', 'Extend pause by 30 minutes'])
  })

  it('has no extend option for an indefinite pause', () => {
    const entries = captureMenuModel({ paused: true, pausedUntil: 'indefinite', sources, includeAppItems: false })
    expect(labels(entries)).toEqual(['Paused', '—', 'Resume capturing'])
  })

  it('says so when every source is off', () => {
    const off = { clipboard: false, screenshots: false, downloads: false }
    const [header] = captureMenuModel({ paused: false, pausedUntil: null, sources: off, includeAppItems: false })
    expect(header).toMatchObject({ sublabel: 'All sources are off' })
  })
})
