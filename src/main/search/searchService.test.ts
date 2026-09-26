import Database from 'better-sqlite3'
import { beforeAll, describe, expect, it } from 'vitest'
import type { SearchResponse } from '@shared/types'
import { buildDemoItems, lastWeekDay } from '../seed/demoData'
import { migrate } from '../storage/db'
import { ItemsRepo } from '../storage/itemsRepo'
import { SearchService } from './searchService'

// Saturday, Sep 26 2026, 15:00 — "지난주" = Mon Sep 14 … Sun Sep 20, the scenario is Thu Sep 17
const nowDate = new Date(2026, 8, 26, 15, 0)
const now = nowDate.getTime()

let search: SearchService
let repo: ItemsRepo

beforeAll(() => {
  const db = new Database(':memory:')
  migrate(db)
  repo = new ItemsRepo(db)
  for (const demo of buildDemoItems(nowDate)) {
    const item = repo.insert(demo)
    if (demo.pinned) repo.setPinned(item.id, true)
    for (const at of demo.touches ?? []) repo.touch(item.id, at)
  }
  search = new SearchService(db)
})

const allHits = (res: SearchResponse) => res.groups.flatMap((g) => g.hits)
const titles = (res: SearchResponse) => allHits(res).map((h) => h.item.title ?? h.item.text)

describe('demo query: 지난주 redis 에러 (PRODUCT §10, §43)', () => {
  let res: SearchResponse
  beforeAll(() => {
    res = search.search('지난주 redis 에러', {}, now)
  })

  it('reads 지난주 as Sep 14–20', () => {
    expect(res.dateRange).toMatchObject({
      from: new Date(2026, 8, 14).getTime(),
      to: new Date(2026, 8, 21).getTime(),
      label: 'Last week · Sep 14 – 20'
    })
    expect(res.terms).toEqual(['redis', '에러'])
  })

  it('finds the screenshot, the copied error, the docs link and the PDF', () => {
    const hits = allHits(res)
    const types = new Set(hits.map((h) => h.item.type))
    expect(types).toEqual(new Set(['screenshot', 'text', 'link', 'file']))
    expect(titles(res)).toEqual(
      expect.arrayContaining([
        'RedisConnectionFailureException',
        'org.springframework.data.redis.RedisConnectionFailureException: Unable to connect to Redis',
        'Redis timeout and connection errors',
        'redis-troubleshooting-guide.pdf'
      ])
    )
  })

  it('puts the error screenshot on top', () => {
    const [top] = res.groups
    expect(top?.kind).toBe('top')
    expect(top?.hits[0]?.item).toMatchObject({ type: 'screenshot', title: 'RedisConnectionFailureException' })
  })

  it('groups the rest of that Thursday afternoon as one session, in time order', () => {
    const session = res.groups.find((g) => g.kind === 'session')
    expect(session?.label).toBe('Same session · Sep 17 14:03–14:16')
    const times = session?.hits.map((h) => h.item.capturedAt) ?? []
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(session?.hits.map((h) => h.item.type)).toEqual(['text', 'link', 'screenshot', 'file', 'text'])
  })

  it('only returns things from last week', () => {
    const from = new Date(2026, 8, 14).getTime()
    const to = new Date(2026, 8, 21).getTime()
    for (const hit of allHits(res)) expect(hit.item.capturedAt >= from && hit.item.capturedAt < to).toBe(true)
  })

  it('reports the words to highlight, including the English synonyms of 에러', () => {
    expect(res.matchWords).toEqual(expect.arrayContaining(['redis', 'exception']))
    expect(res.typeCounts).toEqual({ screenshot: 2, text: 3, link: 3, file: 1, image: 0 })
  })

  it('gives the screenshot an OCR excerpt and text rows their matching line', () => {
    expect(res.groups[0]?.hits[0]?.excerpt).toContain('RedisConnectionFailureException')
  })
})

describe('other queries', () => {
  it('filters by type and app', () => {
    const res = search.search('redis type:screenshot app:IntelliJ', {}, now)
    expect(allHits(res).length).toBeGreaterThan(0)
    for (const hit of allHits(res)) expect(hit.item).toMatchObject({ type: 'screenshot', sourceApp: 'IntelliJ IDEA' })
    // counts are before the type filter
    expect(res.typeCounts.text).toBeGreaterThan(0)
  })

  it('filters by domain', () => {
    const res = search.search('domain:redis.io', {}, now)
    expect(allHits(res).length).toBeGreaterThan(0)
    for (const hit of allHits(res)) expect(hit.item.domain).toBe('redis.io')
  })

  it('returns nothing, and can widen to all time', () => {
    expect(search.search('어제 kubernetes ingress', {}, now).total).toBe(0)
    const narrow = search.search('어제 trigram', {}, now)
    expect(narrow.total).toBe(0)
    const wide = search.search('어제 trigram', { allTime: true }, now)
    expect(wide.dateRange).toBeNull()
    expect(wide.total).toBeGreaterThan(0)
  })

  it('finds English text from Korean words (연결 오류)', () => {
    const res = search.search('연결 오류', {}, now)
    expect(res.groups[0]?.hits[0]?.item.title).toMatch(/RedisConnectionFailureException/u)
  })

  it('matches short words and Korean without FTS (db, 회의록)', () => {
    expect(search.search('회의록', {}, now).total).toBeGreaterThanOrEqual(2)
    expect(search.search('pem', {}, now).total).toBe(1)
  })

  it('lists a date range on its own, newest first', () => {
    const res = search.search('지난주', {}, now)
    const hits = allHits(res)
    expect(hits.length).toBeGreaterThanOrEqual(10)
    expect(res.groups[0]?.hits[0]?.item.capturedAt).toBe(Math.max(...hits.map((h) => h.item.capturedAt)))
  })

  it('handles quotes and punctuation safely', () => {
    expect(() => search.search('"unterminated redis', {}, now)).not.toThrow()
    expect(() => search.search('a"b OR NOT ( *', {}, now)).not.toThrow()
  })
})

describe('idle', () => {
  it('shows pinned items and the most recent ones', () => {
    const idle = search.idle()
    expect(idle.empty).toBe(false)
    expect(idle.pinned.length).toBeGreaterThan(0)
    expect(idle.pinned.every((i) => i.pinned)).toBe(true)
    expect(idle.recent).toHaveLength(4)
  })
})

describe('seed dates', () => {
  it('always puts the scenario on last week’s Thursday', () => {
    const monday = new Date(2026, 8, 28, 8, 0)
    expect(new Date(lastWeekDay(monday, 3, 14, 3)).toDateString()).toBe(new Date(2026, 8, 24).toDateString())
    const sunday = new Date(2026, 8, 27, 23, 0)
    expect(new Date(lastWeekDay(sunday, 3, 14, 3)).toDateString()).toBe(new Date(2026, 8, 17).toDateString())
  })

  it('never creates items in the future', () => {
    for (const hour of [0, 6, 12, 18, 23]) {
      const at = new Date(2026, 8, 21, hour, 30) // a Monday
      for (const item of buildDemoItems(at)) expect(item.capturedAt).toBeLessThanOrEqual(at.getTime())
    }
  })
})
