import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Settings } from '@shared/types'
import { DEFAULT_SETTINGS } from '../storage/settingsRepo'
import { CaptureState } from './captureState'

class MemorySettings {
  value: Settings = { ...structuredClone(DEFAULT_SETTINGS), onboarded: true }
  get(): Settings {
    return this.value
  }
  set(patch: Partial<Settings>): Settings {
    this.value = { ...this.value, ...patch }
    return this.value
  }
}

const intellij = { name: 'IntelliJ IDEA', bundleId: 'com.jetbrains.intellij' }
const onePassword = { name: '1Password', bundleId: 'com.1password.1password' }

let settings: MemorySettings
let state: CaptureState

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 26, 14, 0))
  settings = new MemorySettings()
  state = new CaptureState(settings, () => Date.now())
})

afterEach(() => {
  state.stop()
  vi.useRealTimers()
})

describe('shouldCapture', () => {
  it('captures from ordinary apps', () => {
    expect(state.shouldCapture('clipboard', intellij)).toBe(true)
  })
  it('never captures from excluded apps', () => {
    expect(state.shouldCapture('clipboard', onePassword)).toBe(false)
  })
  it('captures nothing before onboarding is finished', () => {
    settings.set({ onboarded: false })
    expect(state.shouldCapture('clipboard', intellij)).toBe(false)
  })

  it('respects disabled sources', () => {
    settings.set({ sources: { ...settings.value.sources, clipboard: false } })
    expect(state.shouldCapture('clipboard', intellij)).toBe(false)
    expect(state.shouldCapture('downloads', intellij)).toBe(true)
  })
})

describe('pause', () => {
  it('pauses for a while and resumes by itself', () => {
    const changes = vi.fn()
    state.on('change', changes)
    state.pause(5)
    expect(state.isPaused()).toBe(true)
    expect(state.shouldCapture('clipboard', intellij)).toBe(false)
    vi.advanceTimersByTime(5 * 60_000)
    expect(state.isPaused()).toBe(false)
    expect(settings.value.pausedUntil).toBeNull()
    expect(changes).toHaveBeenCalledTimes(2)
  })

  it('pauses until resumed', () => {
    state.pause(null)
    vi.advanceTimersByTime(24 * 60 * 60_000)
    expect(state.isPaused()).toBe(true)
    state.resume()
    expect(state.isPaused()).toBe(false)
  })

  it('survives a restart and clears expired pauses on start', () => {
    state.pause(30)
    const restarted = new CaptureState(settings, () => Date.now())
    restarted.start()
    expect(restarted.isPaused()).toBe(true)
    restarted.stop()

    vi.setSystemTime(Date.now() + 31 * 60_000)
    const later = new CaptureState(settings, () => Date.now())
    later.start()
    expect(later.isPaused()).toBe(false)
    expect(settings.value.pausedUntil).toBeNull()
    later.stop()
  })

  it('extends a timed pause', () => {
    state.pause(5)
    state.extend(30)
    vi.advanceTimersByTime(20 * 60_000)
    expect(state.isPaused()).toBe(true)
    vi.advanceTimersByTime(15 * 60_000)
    expect(state.isPaused()).toBe(false)
  })
})
