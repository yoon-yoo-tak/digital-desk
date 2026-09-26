// Local search (ARCHITECTURE §7): SQL finds candidates fast, ranking.ts orders them.
// Candidates are scored from a few light columns; only the results shown are loaded in full.

import { parseQuery, termGroups } from '@shared/query/parseQuery'
import { ITEM_TYPES, type ItemType, type QuickIdle, type SearchHit, type SearchResponse } from '@shared/types'
import type { Db } from '../storage/db'
import { toItem, type ItemRow } from '../storage/itemsRepo'
import { blockExcerpt, lineExcerpt, scoreItem, type ScorableItem } from './ranking'
import { groupHits } from './sessions'

export const MAX_RESULTS = 50
/** Candidates considered for a filter-only query (no words), newest first. */
const FILTER_ONLY_LIMIT = 500

const SEARCHABLE_COLUMNS = ['title', 'text', 'ocr_text', 'file_name', 'url', 'domain', 'source_app'] as const

const LIGHT_COLUMNS = `rowid, type, title, text, ocr_text AS ocrText, file_name AS fileName, url, domain,
  source_app AS sourceApp, last_used_at AS lastUsedAt, pinned, archived`

interface LightRow extends Omit<ScorableItem, 'pinned' | 'archived'> {
  rowid: number
  pinned: number
  archived: number
}

/** trigram FTS only indexes runs of 3+ characters; shorter words fall back to a scan. */
function isLongWord(word: string): boolean {
  return [...word].length >= 3
}

function ftsPhrase(word: string): string {
  return `"${word.replace(/"/gu, '""')}"`
}

/** Column-by-column substring test. Words without Latin letters skip lower() (Hangul has no case). */
function scanClause(param: string, word: string): string {
  const caseless = !/[a-z]/iu.test(word)
  return SEARCHABLE_COLUMNS.map((c) => `instr(${caseless ? c : `lower(${c})`}, @${param}) > 0`).join(' OR ')
}

function emptyCounts(): Record<ItemType, number> {
  return Object.fromEntries(ITEM_TYPES.map((t) => [t, 0])) as Record<ItemType, number>
}

export interface SearchOptions {
  /** Ignore the date expression ("Search all time"). */
  allTime?: boolean
}

export class SearchService {
  constructor(private readonly db: Db) {}

  search(query: string, opts: SearchOptions, now: number): SearchResponse {
    const started = performance.now()
    const parsed = parseQuery(query, new Date(now))
    const dateRange = opts.allTime ? null : parsed.dateRange
    const groups = termGroups(parsed)
    const { filters } = parsed

    // Shared WHERE clauses for date / app / domain (type is applied after counting).
    const where: string[] = []
    const params: Record<string, string | number> = {}
    if (dateRange) {
      where.push('((captured_at >= @from AND captured_at < @to) OR (last_used_at >= @from AND last_used_at < @to))')
      params.from = dateRange.from
      params.to = dateRange.to
    }
    if (filters.app) {
      where.push("instr(lower(coalesce(source_app,'')), lower(@app)) = 1")
      params.app = filters.app
    }
    if (filters.domain) {
      where.push("(domain = @domain OR substr(domain, -length(@domain) - 1) = '.' || @domain)")
      params.domain = filters.domain
    }

    let rows: LightRow[] = []
    if (groups.length > 0) {
      const words = [...new Set(groups.flat())]
      const long = words.filter(isLongWord)
      const short = words.filter((w) => !isLongWord(w))
      const sources: string[] = []
      if (long.length > 0) {
        sources.push('SELECT rowid FROM items_fts WHERE items_fts MATCH @fts')
        params.fts = long.map(ftsPhrase).join(' OR ')
      }
      if (short.length > 0) {
        const scans = short.map((w, i) => {
          params[`s${i}`] = w.toLowerCase()
          return `(${scanClause(`s${i}`, w)})`
        })
        sources.push(`SELECT rowid FROM items WHERE ${[...where, `(${scans.join(' OR ')})`].join(' AND ')}`)
      }
      const filterSql = where.length > 0 ? `AND ${where.join(' AND ')}` : ''
      rows = this.db
        .prepare(`SELECT ${LIGHT_COLUMNS} FROM items WHERE rowid IN (${sources.join(' UNION ')}) ${filterSql}`)
        .all(params) as LightRow[]
    } else if (where.length > 0 || filters.type) {
      const filterSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
      rows = this.db
        .prepare(`SELECT ${LIGHT_COLUMNS} FROM items ${filterSql} ORDER BY last_used_at DESC LIMIT ${FILTER_ONLY_LIMIT}`)
        .all(params) as LightRow[]
    }

    // Score, count by type (before the type filter), then filter by type.
    const typeCounts = emptyCounts()
    const appCounts = new Map<string, number>()
    let scored: { rowid: number; type: ItemType; score: number; lastUsedAt: number; words: string[] }[] = []
    for (const row of rows) {
      const result = scoreItem({ ...row, pinned: row.pinned === 1, archived: row.archived === 1 }, groups, now)
      if (!result) continue
      typeCounts[row.type]++
      if (row.sourceApp) appCounts.set(row.sourceApp, (appCounts.get(row.sourceApp) ?? 0) + 1)
      scored.push({ rowid: row.rowid, type: row.type, score: result.score, lastUsedAt: row.lastUsedAt, words: result.words })
    }
    if (filters.type) scored = scored.filter((s) => s.type === filters.type)
    scored.sort((a, b) => b.score - a.score || b.lastUsedAt - a.lastUsedAt)
    const shown = scored.slice(0, MAX_RESULTS)

    // Load only what is shown.
    const full = new Map<number, ItemRow>()
    if (shown.length > 0) {
      const found = this.db
        .prepare(`SELECT rowid, * FROM items WHERE rowid IN (${shown.map(() => '?').join(',')})`)
        .all(...shown.map((s) => s.rowid)) as ItemRow[]
      for (const row of found) full.set(row.rowid, row)
    }

    const matchWords = new Set<string>()
    const hits: SearchHit[] = []
    for (const s of shown) {
      const row = full.get(s.rowid)
      if (!row) continue
      s.words.forEach((w) => matchWords.add(w))
      const item = toItem(row)
      const excerpt =
        item.type === 'text'
          ? lineExcerpt(item.text, s.words)
          : item.type === 'screenshot'
            ? blockExcerpt(item.ocrText, s.words)
            : null
      hits.push({ item, score: s.score, excerpt })
    }

    return {
      query,
      dateRange: dateRange ?? null,
      filters,
      terms: parsed.terms,
      allTime: opts.allTime === true,
      groups: groupHits(hits, now),
      total: scored.length,
      typeCounts,
      apps: [...appCounts.entries()].sort((a, b) => b[1] - a[1]).map(([app]) => app),
      matchWords: [...matchWords],
      tookMs: Math.round((performance.now() - started) * 10) / 10
    }
  }

  /** What Quick Search shows before anything is typed (DESIGN §6.8). */
  idle(): QuickIdle {
    const pinned = this.db
      .prepare('SELECT rowid, * FROM items WHERE pinned = 1 AND archived = 0 ORDER BY last_used_at DESC LIMIT 3')
      .all() as ItemRow[]
    const recent = this.db
      .prepare('SELECT rowid, * FROM items WHERE archived = 0 ORDER BY last_used_at DESC, id DESC LIMIT 4')
      .all() as ItemRow[]
    const any = this.db.prepare('SELECT 1 FROM items LIMIT 1').get()
    return { pinned: pinned.map(toItem), recent: recent.map(toItem), empty: !any }
  }
}
