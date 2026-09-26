// Natural date expressions without AI (PRODUCT §11, ARCHITECTURE §7.1).
// Weeks start on Monday. Ranges are [from, to) in local time.

export interface DateRange {
  from: number
  to: number
  /** Chip label, e.g. "Last week · Sep 14 – 20" */
  label: string
}

export interface DateMatch extends DateRange {
  /** Span in the input (including a trailing Korean particle), for highlighting and removal. */
  start: number
  end: number
}

const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const monthLong = new Intl.DateTimeFormat('en-US', { month: 'long' })
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short' })

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

function startOfWeek(d: Date): Date {
  const day = startOfDay(d)
  const offset = (day.getDay() + 6) % 7 // Monday = 0
  return addDays(day, -offset)
}

function startOfMonth(d: Date, delta = 0): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1)
}

/** "Sep 14 – 20", or "Aug 31 – Sep 6" across months. `to` is exclusive. */
function spanLabel(from: Date, to: Date): string {
  const last = addDays(to, -1)
  if (from.getMonth() === last.getMonth()) return `${monthShort.format(from)} ${from.getDate()} – ${last.getDate()}`
  return `${monthDay.format(from)} – ${monthDay.format(last)}`
}

type RangeFn = (now: Date) => { from: Date; to: Date; label: string }

const day =
  (offset: number, name: string): RangeFn =>
  (now) => {
    const from = addDays(startOfDay(now), -offset)
    return { from, to: addDays(from, 1), label: `${name} · ${monthDay.format(from)}` }
  }

const week =
  (offset: number, name: string): RangeFn =>
  (now) => {
    const from = addDays(startOfWeek(now), -7 * offset)
    const to = addDays(from, 7)
    return { from, to, label: `${name} · ${spanLabel(from, to)}` }
  }

const month =
  (offset: number, name: string): RangeFn =>
  (now) => {
    const from = startOfMonth(now, -offset)
    return { from, to: startOfMonth(now, 1 - offset), label: `${name} · ${monthLong.format(from)}` }
  }

/** Every supported expression. Keep in sync with the table in ARCHITECTURE §7.1. */
export const DATE_EXPRESSIONS: { patterns: string[]; range: RangeFn }[] = [
  { patterns: ['오늘', 'today'], range: day(0, 'Today') },
  { patterns: ['어제', 'yesterday'], range: day(1, 'Yesterday') },
  { patterns: ['그제', '그저께', 'day before yesterday'], range: day(2, 'Day before yesterday') },
  { patterns: ['이번주', '이번 주', 'this week', 'this-week'], range: week(0, 'This week') },
  { patterns: ['지난주', '지난 주', '저번주', '저번 주', 'last week', 'last-week'], range: week(1, 'Last week') },
  { patterns: ['이번달', '이번 달', 'this month', 'this-month'], range: month(0, 'This month') },
  { patterns: ['지난달', '지난 달', '저번달', '저번 달', 'last month', 'last-month'], range: month(1, 'Last month') }
]

// Particles that may follow a Korean date word: "지난주에", "어제부터".
const KOREAN_PARTICLES = '(?:에서|에|의|쯤|부터|까지|동안)?'

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

const COMPILED = DATE_EXPRESSIONS.flatMap(({ patterns, range }) =>
  patterns.map((pattern) => {
    const korean = /[가-힣]/u.test(pattern)
    // Korean spacing is optional (이번 주 = 이번주); English words need a space ("lastweek" is not a date).
    const body = escapeRegExp(pattern).replace(/ /gu, korean ? '\\s*' : '\\s+')
    const regex = new RegExp(`(?<=^|\\s)${body}${korean ? KOREAN_PARTICLES : ''}(?=$|\\s|[,.!?])`, 'giu')
    return { regex, range }
  })
)

/** Finds the first date expression in the input. Earliest wins; on a tie, the longest. */
export function findDateExpression(input: string, now: Date): DateMatch | null {
  let best: { start: number; end: number; range: RangeFn } | null = null
  for (const { regex, range } of COMPILED) {
    regex.lastIndex = 0
    const m = regex.exec(input)
    if (!m) continue
    const start = m.index
    const end = start + m[0].length
    if (!best || start < best.start || (start === best.start && end > best.end)) best = { start, end, range }
  }
  if (!best) return null
  const { from, to, label } = best.range(now)
  return { from: from.getTime(), to: to.getTime(), label, start: best.start, end: best.end }
}
