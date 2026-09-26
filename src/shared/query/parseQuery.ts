import type { ItemType } from '../types'
import { findDateExpression, type DateMatch } from './dateExpressions'
import { parseFilterToken, tokenize } from './filters'
import { expandTerm } from './synonyms'

export interface ParsedQuery {
  dateRange: DateMatch | null
  filters: { type?: ItemType; app?: string; domain?: string }
  /** Remaining free-text terms, as typed. */
  terms: string[]
}

/** Pure: `now` is injected (CLAUDE.md). Shared by main (search) and renderer (input highlighting). */
export function parseQuery(input: string, now: Date): ParsedQuery {
  const dateRange = findDateExpression(input, now)
  const rest = dateRange
    ? input.slice(0, dateRange.start) + ' '.repeat(dateRange.end - dateRange.start) + input.slice(dateRange.end)
    : input
  const filters: ParsedQuery['filters'] = {}
  const terms: string[] = []
  for (const token of tokenize(rest)) {
    const filter = parseFilterToken(token.text)
    if (filter?.key === 'type') filters.type = filter.value as ItemType
    else if (filter) filters[filter.key] = filter.value
    else terms.push(token.text.replace(/"/gu, ''))
  }
  return { dateRange, filters, terms: terms.filter((t) => t.length > 0) }
}

/** One synonym group per term (ARCHITECTURE §7.2–7.3). */
export function termGroups(parsed: ParsedQuery): string[][] {
  return parsed.terms.map(expandTerm)
}
