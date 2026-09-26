// Deterministic scoring (PRODUCT §37, ARCHITECTURE §7.4). Pure.

import type { DeskItem } from '@shared/types'

/** The fields scoring needs — a subset of DeskItem, so search can score rows without loading everything. */
export type ScorableItem = Pick<
  DeskItem,
  'type' | 'title' | 'text' | 'ocrText' | 'fileName' | 'url' | 'domain' | 'sourceApp' | 'lastUsedAt' | 'pinned' | 'archived'
>

const DAY_MS = 24 * 60 * 60 * 1000

export const WEIGHTS = {
  titleExact: 10,
  fileName: 8,
  title: 8,
  ocr: 7,
  text: 7,
  url: 5,
  app: 3,
  allGroups: 15,
  recency: 4,
  pinned: 3,
  archived: -2,
  /** Per extra field that matches the same group, up to maxCoverage. */
  coverage: 1,
  maxCoverage: 2
} as const

type Field = 'title' | 'fileName' | 'ocr' | 'text' | 'url' | 'app'

const FIELD_WEIGHT: Record<Field, number> = {
  title: WEIGHTS.title,
  fileName: WEIGHTS.fileName,
  ocr: WEIGHTS.ocr,
  text: WEIGHTS.text,
  url: WEIGHTS.url,
  app: WEIGHTS.app
}

/** Lowercased searchable fields. A text item's title is just its first line, so it counts as text. */
export function searchableFields(item: ScorableItem): Record<Field, string> {
  const lower = (s: string | null | undefined): string => (s ?? '').toLowerCase()
  return {
    title: item.type === 'text' ? '' : lower(item.title),
    fileName: lower(item.fileName),
    ocr: lower(item.ocrText),
    text: item.type === 'link' ? '' : lower(item.text), // a link's text is its URL
    url: `${lower(item.url)} ${lower(item.domain)}`.trim(),
    app: lower(item.sourceApp)
  }
}

export interface ItemScore {
  score: number
  /** Number of term groups that matched. */
  matchedGroups: number
  /** Words (from any group) found somewhere in the item. */
  words: string[]
}

/**
 * Scores an item against synonym groups. Returns null when no group matches.
 * With no groups (date/filter-only queries) the score is recency alone.
 */
export function scoreItem(item: ScorableItem, groups: string[][], now: number): ItemScore | null {
  const fields = searchableFields(item)
  const title = fields.title
  let score = 0
  let matchedGroups = 0
  const words = new Set<string>()

  for (const group of groups) {
    let best = 0
    let fieldsHit = 0
    for (const [field, value] of Object.entries(fields) as [Field, string][]) {
      if (!value) continue
      const hits = group.filter((w) => value.includes(w))
      if (hits.length === 0) continue
      hits.forEach((w) => words.add(w))
      fieldsHit++
      const weight = field === 'title' && hits.some((w) => w === title) ? WEIGHTS.titleExact : FIELD_WEIGHT[field]
      best = Math.max(best, weight)
    }
    if (fieldsHit === 0) continue
    matchedGroups++
    score += best + Math.min(WEIGHTS.maxCoverage, fieldsHit - 1) * WEIGHTS.coverage
  }

  if (groups.length > 0 && matchedGroups === 0) return null
  if (groups.length > 0 && matchedGroups === groups.length) score += WEIGHTS.allGroups

  const ageDays = Math.max(0, now - item.lastUsedAt) / DAY_MS
  score += WEIGHTS.recency * Math.exp(-ageDays / 7)
  if (item.pinned) score += WEIGHTS.pinned
  if (item.archived) score += WEIGHTS.archived

  return { score, matchedGroups, words: [...words] }
}

/** The first line containing a match (for text rows), trimmed to `max` characters. */
export function lineExcerpt(text: string | null, words: string[], max = 200): string | null {
  if (!text || words.length === 0) return null
  const line = text.split('\n').find((l) => words.some((w) => l.toLowerCase().includes(w)))
  if (!line) return null
  const trimmed = line.trim()
  return trimmed.length > max ? trimmed.slice(0, max - 1) + '…' : trimmed
}

/**
 * Up to `maxLines` OCR lines starting at the first match (for previews). Starting at the match —
 * not before it — keeps screen chrome the OCR also read (rulers, toolbars) out of the visible lines.
 */
export function blockExcerpt(text: string | null, words: string[], maxLines = 6): string | null {
  if (!text) return null
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  const start = Math.max(0, lines.findIndex((l) => words.some((w) => l.toLowerCase().includes(w))))
  return lines.slice(start, start + maxLines).join('\n')
}
