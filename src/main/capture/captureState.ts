// Pause / exclusion gate. Every capture source asks `shouldCapture` before reading any content.

import { EventEmitter } from 'node:events'
import type { PausedUntil, Settings, SourceApp, SourceToggles } from '@shared/types'
import type { Clock } from '../clock'

export type CaptureSource = keyof SourceToggles

interface SettingsStore {
  get(): Settings
  set(patch: Partial<Settings>): Settings
}

export class CaptureState extends EventEmitter<{ change: [] }> {
  private resumeTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly settings: SettingsStore,
    private readonly now: Clock
  ) {
    super()
  }

  /** Clears an expired pause left over from the last run and arms the auto-resume timer. */
  start(): void {
    const until = this.pausedUntil()
    if (typeof until === 'number' && until <= this.now()) this.settings.set({ pausedUntil: null })
    this.armTimer()
  }

  stop(): void {
    if (this.resumeTimer) clearTimeout(this.resumeTimer)
    this.resumeTimer = null
  }

  pausedUntil(): PausedUntil {
    return this.settings.get().pausedUntil
  }

  isPaused(): boolean {
    const until = this.pausedUntil()
    return until === 'indefinite' || (typeof until === 'number' && this.now() < until)
  }

  /** minutes = null pauses until resumed. */
  pause(minutes: number | null): void {
    this.settings.set({ pausedUntil: minutes === null ? 'indefinite' : this.now() + minutes * 60_000 })
    this.armTimer()
    this.emit('change')
  }

  /** Adds time to a timed pause (or starts one). */
  extend(minutes: number): void {
    const until = this.pausedUntil()
    if (until === 'indefinite') return
    const base = typeof until === 'number' && until > this.now() ? until : this.now()
    this.settings.set({ pausedUntil: base + minutes * 60_000 })
    this.armTimer()
    this.emit('change')
  }

  resume(): void {
    this.settings.set({ pausedUntil: null })
    this.armTimer()
    this.emit('change')
  }

  shouldCapture(source: CaptureSource, app?: SourceApp | null): boolean {
    if (this.isPaused()) return false
    const settings = this.settings.get()
    if (!settings.onboarded) return false // DESIGN §10: nothing before onboarding is finished
    if (!settings.sources[source]) return false
    if (app?.bundleId && settings.excludedApps.some((e) => e.bundleId === app.bundleId)) return false
    return true
  }

  private armTimer(): void {
    if (this.resumeTimer) clearTimeout(this.resumeTimer)
    this.resumeTimer = null
    const until = this.pausedUntil()
    if (typeof until !== 'number') return
    const delay = Math.max(0, until - this.now())
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null
      if (this.pausedUntil() === until) this.settings.set({ pausedUntil: null })
      this.emit('change')
    }, delay)
    this.resumeTimer.unref?.()
  }
}
