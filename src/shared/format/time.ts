// Time labels (DESIGN §5). UI copy is English; all boundaries use the local time zone.

const DAY_MS = 24 * 60 * 60 * 1000

const hm = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const weekdayShort = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const monthDayYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function startOfLocalDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Whole local days between the two timestamps' dates (0 = same day, 1 = yesterday). */
export function daysAgo(ts: number, now: number): number {
  const a = new Date(startOfLocalDay(ts))
  const b = new Date(startOfLocalDay(now))
  // Date arithmetic via calendar fields so DST shifts don't produce 0.96 days.
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((utcB - utcA) / DAY_MS)
}

export function formatClock(ts: number): string {
  return hm.format(ts)
}

function isoDate(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * Time shown at the end of a result row (Quick Search) where there is no day header.
 * Today "14:03" · Yesterday "Yesterday 14:03" · last 7 days "Thu 14:03" · this year "Sep 3" · older "2025-09-03"
 */
export function formatResultTime(ts: number, now: number): string {
  const days = daysAgo(ts, now)
  if (days <= 0) return formatClock(ts)
  if (days === 1) return `Yesterday ${formatClock(ts)}`
  if (days < 7) return `${weekdayShort.format(ts)} ${formatClock(ts)}`
  if (new Date(ts).getFullYear() === new Date(now).getFullYear()) return monthDay.format(ts)
  return isoDate(ts)
}

/** Inspector: "Today, 14:03" · "Yesterday, 14:03" · "Thu, Sep 17, 14:03" · "Sep 3, 14:03" · "Sep 3, 2025, 14:03" */
export function formatInspectorTime(ts: number, now: number): string {
  const days = daysAgo(ts, now)
  const clock = formatClock(ts)
  if (days <= 0) return `Today, ${clock}`
  if (days === 1) return `Yesterday, ${clock}`
  if (days < 7) return `${weekdayShort.format(ts)}, ${monthDay.format(ts)}, ${clock}`
  if (new Date(ts).getFullYear() === new Date(now).getFullYear()) return `${monthDay.format(ts)}, ${clock}`
  return `${monthDayYear.format(ts)}, ${clock}`
}

export interface DayHeader {
  /** Uppercased by CSS: "Today", "Yesterday", "Thu" */
  label: string
  /** "Sat, Sep 26" for today/yesterday, "Sep 24" otherwise, "Sep 24, 2025" in other years */
  detail: string
}

export function formatDayHeader(ts: number, now: number): DayHeader {
  const days = daysAgo(ts, now)
  const sameYear = new Date(ts).getFullYear() === new Date(now).getFullYear()
  const date = sameYear ? monthDay.format(ts) : monthDayYear.format(ts)
  if (days <= 0) return { label: 'Today', detail: `${weekdayShort.format(ts)}, ${date}` }
  if (days === 1) return { label: 'Yesterday', detail: `${weekdayShort.format(ts)}, ${date}` }
  return { label: weekdayShort.format(ts), detail: date }
}
