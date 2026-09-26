import { describe, expect, it } from 'vitest'
import type { DeskItem, SearchHit } from '@shared/types'
import { blockExcerpt, lineExcerpt, scoreItem, WEIGHTS } from './ranking'
import { groupHits, sessionSpanLabel } from './sessions'

const now = new Date(2026, 8, 26, 15, 0).getTime()
const MIN = 60_000

const item = (patch: Partial<DeskItem>): DeskItem => ({
  id: patch.id ?? 'x',
  type: 'text',
  title: null,
  text: null,
  ocrText: null,
  filePath: null,
  fileName: null,
  url: null,
  domain: null,
  sourceApp: null,
  sourceBundleId: null,
  createdAt: now,
  capturedAt: now,
  lastUsedAt: now,
  useCount: 1,
  previewPath: null,
  contentHash: null,
  pinned: false,
  archived: false,
  ocrStatus: null,
  metadata: {},
  ...patch
})

const recencyAt = (ageDays: number): number => WEIGHTS.recency * Math.exp(-ageDays / 7)

describe('scoreItem', () => {
  it('returns null when nothing matches', () => {
    expect(scoreItem(item({ text: 'hello' }), [['redis']], now)).toBeNull()
  })

  it('scores the best field per group, plus coverage and the all-groups bonus', () => {
    const shot = item({ type: 'screenshot', title: 'RedisConnectionFailureException', ocrText: 'RedisConnectionFailureException' })
    const result = scoreItem(shot, [['redis'], ['에러', 'exception']], now)
    // title 8 + one extra field (ocr) per group, twice, + all groups + fresh recency
    expect(result?.score).toBeCloseTo(8 + 1 + 8 + 1 + WEIGHTS.allGroups + recencyAt(0))
    expect(result?.words.sort()).toEqual(['exception', 'redis'])
  })

  it('treats a text item’s title as text, not as a title', () => {
    const t = item({ type: 'text', title: 'redis down', text: 'redis down' })
    expect(scoreItem(t, [['redis']], now)?.score).toBeCloseTo(WEIGHTS.text + WEIGHTS.allGroups + recencyAt(0))
  })

  it('rewards an exact title match', () => {
    const f = item({ type: 'file', title: 'alen_cup.pdf' })
    expect(scoreItem(f, [['alen_cup.pdf']], now)?.score).toBeCloseTo(WEIGHTS.titleExact + WEIGHTS.allGroups + recencyAt(0))
  })

  it('prefers matching every term and recent, pinned items', () => {
    const both = scoreItem(item({ text: 'redis error' }), [['redis'], ['error']], now)?.score ?? 0
    const one = scoreItem(item({ text: 'redis only' }), [['redis'], ['error']], now)?.score ?? 0
    expect(both).toBeGreaterThan(one + WEIGHTS.allGroups)
    const old = scoreItem(item({ text: 'redis', lastUsedAt: now - 30 * 24 * 60 * MIN }), [['redis']], now)?.score ?? 0
    const fresh = scoreItem(item({ text: 'redis' }), [['redis']], now)?.score ?? 0
    expect(fresh).toBeGreaterThan(old)
    const pinned = scoreItem(item({ text: 'redis', pinned: true }), [['redis']], now)?.score ?? 0
    expect(pinned - fresh).toBeCloseTo(WEIGHTS.pinned)
  })

  it('scores by recency alone when there are no terms', () => {
    expect(scoreItem(item({ lastUsedAt: now - 7 * 24 * 60 * MIN }), [], now)?.score).toBeCloseTo(recencyAt(7))
  })
})

describe('excerpts', () => {
  it('picks the first matching line', () => {
    expect(lineExcerpt('first\nsecond redis line\nthird', ['redis'])).toBe('second redis line')
    expect(lineExcerpt('nothing here', ['redis'])).toBeNull()
  })
  it('starts OCR excerpts at the first match', () => {
    const ocr = ['26', '32', '34', 'Redis error', 'next', 'more'].join('\n')
    expect(blockExcerpt(ocr, ['redis'])?.split('\n')).toEqual(['Redis error', 'next', 'more'])
    expect(blockExcerpt('a\nb\nc\nd\ne\nf\ng', ['zzz'])?.split('\n')).toHaveLength(6)
  })
})

describe('groupHits', () => {
  const hit = (id: string, minutes: number, score: number): SearchHit => ({
    item: item({ id, capturedAt: now - 3 * 24 * 60 * MIN + minutes * MIN }),
    score,
    excerpt: null
  })

  it('splits top / same session (chronological) / other', () => {
    const groups = groupHits([hit('top', 0, 30), hit('b', 13, 29), hit('far', 90, 25), hit('a', 5, 20)], now)
    expect(groups.map((g) => g.kind)).toEqual(['top', 'session', 'other'])
    expect(groups[1]?.hits.map((h) => h.item.id)).toEqual(['a', 'b'])
    expect(groups[2]?.hits.map((h) => h.item.id)).toEqual(['far'])
  })

  it('omits empty groups', () => {
    expect(groupHits([], now)).toEqual([])
    expect(groupHits([hit('only', 0, 1)], now).map((g) => g.kind)).toEqual(['top'])
  })

  it('labels the session span by how long ago it was', () => {
    const at = (daysAgo: number, h: number, m: number): number =>
      new Date(2026, 8, 26 - daysAgo, h, m).getTime()
    expect(sessionSpanLabel(at(0, 14, 3), at(0, 14, 16), now)).toBe('14:03–14:16')
    expect(sessionSpanLabel(at(1, 14, 3), at(1, 14, 16), now)).toBe('Yesterday 14:03–14:16')
    expect(sessionSpanLabel(at(2, 14, 3), at(2, 14, 16), now)).toBe('Thu 14:03–14:16')
    expect(sessionSpanLabel(at(9, 14, 3), at(9, 14, 16), now)).toBe('Sep 17 14:03–14:16')
  })
})
