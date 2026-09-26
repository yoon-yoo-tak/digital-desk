// Result groups: Top match / Same session / Other matches (DESIGN §6.5). Pure.

import { daysAgo, formatClock } from '@shared/format/time'
import type { SearchGroup, SearchHit } from '@shared/types'

/** Until P1 contexts exist, a "session" is anything captured within this distance of the top match. */
export const SESSION_WINDOW_MS = 20 * 60 * 1000

const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/** "14:03–14:16" today, "Yesterday 14:03–14:16", "Thu 14:03–14:16", "Sep 17 14:03–14:16". */
export function sessionSpanLabel(from: number, to: number, now: number): string {
  const days = daysAgo(from, now)
  const prefix =
    days <= 0 ? '' : days === 1 ? 'Yesterday ' : days < 7 ? `${weekday.format(from)} ` : `${monthDay.format(from)} `
  return `${prefix}${formatClock(from)}–${formatClock(to)}`
}

/** `hits` must be sorted best first. */
export function groupHits(hits: SearchHit[], now: number): SearchGroup[] {
  const [top, ...rest] = hits
  if (!top) return []
  const anchor = top.item.capturedAt
  const session = rest
    .filter((h) => Math.abs(h.item.capturedAt - anchor) <= SESSION_WINDOW_MS)
    .sort((a, b) => a.item.capturedAt - b.item.capturedAt)
  const inSession = new Set(session.map((h) => h.item.id))
  const other = rest.filter((h) => !inSession.has(h.item.id))

  const groups: SearchGroup[] = [{ kind: 'top', label: 'Top match', hits: [top] }]
  if (session.length > 0) {
    const times = [anchor, ...session.map((h) => h.item.capturedAt)]
    groups.push({
      kind: 'session',
      label: `Same session · ${sessionSpanLabel(Math.min(...times), Math.max(...times), now)}`,
      hits: session
    })
  }
  if (other.length > 0) groups.push({ kind: 'other', label: 'Other matches', hits: other })
  return groups
}
