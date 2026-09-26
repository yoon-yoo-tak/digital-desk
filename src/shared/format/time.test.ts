import { describe, expect, it } from 'vitest'
import { daysAgo, formatDayHeader, formatInspectorTime, formatResultTime } from './time'

// Saturday, Sep 26 2026, 15:00 local time
const now = new Date(2026, 8, 26, 15, 0).getTime()
const at = (month: number, day: number, h: number, m: number, year = 2026): number =>
  new Date(year, month - 1, day, h, m).getTime()

describe('daysAgo', () => {
  it('counts calendar days, not 24h windows', () => {
    expect(daysAgo(at(9, 26, 0, 1), now)).toBe(0)
    expect(daysAgo(at(9, 25, 23, 59), now)).toBe(1)
    expect(daysAgo(at(9, 17, 14, 3), now)).toBe(9)
  })
})

describe('formatResultTime', () => {
  it.each([
    [at(9, 26, 14, 3), '14:03'],
    [at(9, 25, 9, 5), 'Yesterday 09:05'],
    [at(9, 24, 14, 3), 'Thu 14:03'],
    [at(9, 20, 14, 3), 'Sun 14:03'],
    [at(9, 17, 14, 3), 'Sep 17'],
    [at(9, 3, 14, 3, 2025), '2025-09-03']
  ])('%s → %s', (ts, expected) => {
    expect(formatResultTime(ts, now)).toBe(expected)
  })
})

describe('formatInspectorTime', () => {
  it.each([
    [at(9, 26, 14, 3), 'Today, 14:03'],
    [at(9, 25, 14, 3), 'Yesterday, 14:03'],
    [at(9, 24, 14, 3), 'Thu, Sep 24, 14:03'],
    [at(9, 3, 14, 3), 'Sep 3, 14:03'],
    [at(9, 3, 14, 3, 2025), 'Sep 3, 2025, 14:03']
  ])('%s → %s', (ts, expected) => {
    expect(formatInspectorTime(ts, now)).toBe(expected)
  })
})

describe('formatDayHeader', () => {
  it('labels today and yesterday with the full date', () => {
    expect(formatDayHeader(at(9, 26, 10, 0), now)).toEqual({ label: 'Today', detail: 'Sat, Sep 26' })
    expect(formatDayHeader(at(9, 25, 10, 0), now)).toEqual({ label: 'Yesterday', detail: 'Fri, Sep 25' })
  })
  it('uses the weekday for older days', () => {
    expect(formatDayHeader(at(9, 24, 10, 0), now)).toEqual({ label: 'Thu', detail: 'Sep 24' })
    expect(formatDayHeader(at(12, 31, 10, 0, 2025), now)).toEqual({ label: 'Wed', detail: 'Dec 31, 2025' })
  })
})
