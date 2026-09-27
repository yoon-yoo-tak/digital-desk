import { describe, expect, it } from 'vitest'
import type { CaptureStatus } from '../types'
import { captureLabel } from './capture'

const base: CaptureStatus = {
  paused: false, pausedUntil: null, onboarded: true, helper: 'running',
  sources: { clipboard: true, screenshots: true, downloads: true }
}
describe('capture status labels', () => {
  it('reflects helper loss, recovery, pause, onboarding and disabled sources', () => {
    expect(captureLabel(base)).toBe('Capturing')
    expect(captureLabel({ ...base, helper: 'unavailable' })).toBe('Clipboard unavailable')
    expect(captureLabel({ ...base, helper: 'starting' })).toBe('Starting clipboard')
    expect(captureLabel({ ...base, helper: 'unavailable', paused: true })).toBe('Paused')
    expect(captureLabel({ ...base, helper: 'unavailable', onboarded: false })).toBe('Not capturing yet')
    expect(captureLabel({ ...base, sources: { clipboard: false, screenshots: false, downloads: false } })).toBe('Not capturing')
    expect(captureLabel({ ...base, helper: 'unavailable', sources: { ...base.sources, clipboard: false } })).toBe('Capturing')
  })
})
