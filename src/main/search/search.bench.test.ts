// ROADMAP M2: search p95 ≤ 50 ms on 10k seeded items.
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { buildDemoItems } from '../seed/demoData'
import { migrate } from '../storage/db'
import { ItemsRepo } from '../storage/itemsRepo'
import { SearchService } from './searchService'

const QUERIES = [
  '지난주 redis 에러',
  'redis',
  '에러',
  'redis type:screenshot',
  'connection timeout',
  'db',
  'app:Google github',
  '이번달 config',
  'kubernetes ingress deploy',
  '회의 일정',
  'domain:redis.io',
  'xyz-not-there'
]

describe('search benchmark', () => {
  it('answers in ≤ 50 ms at p95 over 10k items', () => {
    const now = new Date(2026, 8, 26, 15, 0)
    const db = new Database(':memory:')
    migrate(db)
    const repo = new ItemsRepo(db)
    repo.insertMany(buildDemoItems(now, { count: 10_000 }))
    expect(repo.count()).toBeGreaterThan(10_000)

    const service = new SearchService(db)
    for (const q of QUERIES) service.search(q, {}, now.getTime()) // warm up statement cache

    const samples: number[] = []
    for (let round = 0; round < 10; round++) {
      for (const q of QUERIES) {
        const t0 = performance.now()
        service.search(q, {}, now.getTime())
        samples.push(performance.now() - t0)
      }
    }
    samples.sort((a, b) => a - b)
    const p95 = samples[Math.floor(samples.length * 0.95)] as number
    const p50 = samples[Math.floor(samples.length * 0.5)] as number
    console.log(`search over ${repo.count()} items: p50 ${p50.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, max ${samples.at(-1)?.toFixed(1)} ms`)
    expect(p95).toBeLessThanOrEqual(50)
  }, 60_000)
})
