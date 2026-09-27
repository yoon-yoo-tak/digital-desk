import { beforeEach, describe, expect, it } from 'vitest'
import { migrate, type Db } from './db'
import Database from 'better-sqlite3'
import { ItemsRepo } from './itemsRepo'
import { DEFAULT_SETTINGS, SettingsRepo } from './settingsRepo'
import { MIGRATIONS } from './migrations'

let db: Db
let repo: ItemsRepo

beforeEach(() => {
  db = new Database(':memory:')
  migrate(db)
  repo = new ItemsRepo(db)
})

const fts = (q: string): string[] =>
  (
    db
      .prepare('SELECT i.id FROM items_fts f JOIN items i ON i.rowid = f.rowid WHERE items_fts MATCH ?')
      .all(q) as { id: string }[]
  ).map((r) => r.id)

describe('migrate', () => {
  it('is idempotent', () => {
    migrate(db)
    expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length)
  })

  it('repairs stale FTS in existing v1 databases without changing items', () => {
    const item = repo.insert({ type: 'text', text: 'payload', sourceApp: 'Chrome', capturedAt: 1000 })
    db.prepare('UPDATE items SET source_app = ? WHERE id = ?').run('Safari', item.id)
    db.pragma('user_version = 1')
    const before = repo.get(item.id)
    expect(fts('Safari')).toEqual([])
    migrate(db)
    expect(fts('Safari')).toEqual([item.id])
    expect(fts('Chrome')).toEqual([])
    expect(repo.get(item.id)).toEqual(before)
    migrate(db)
    expect(fts('Safari')).toEqual([item.id])
  })
})

describe('ItemsRepo', () => {
  it('indexes inserted items for substring search, including Korean', () => {
    const a = repo.insert({
      type: 'text',
      text: 'org.springframework.data.redis.RedisConnectionFailureException: Unable to connect',
      capturedAt: 1000
    })
    const b = repo.insert({ type: 'text', text: '연결 오류가 났습니다', capturedAt: 2000 })
    expect(fts('"connectionfailure"')).toEqual([a.id])
    expect(fts('"오류가"')).toEqual([b.id])
  })

  it('updates the index when fields change and removes it on delete', () => {
    const item = repo.insert({ type: 'link', url: 'https://redis.io/docs', domain: 'redis.io', capturedAt: 1 })
    expect(fts('"timeout"')).toEqual([])
    repo.update(item.id, { title: 'Redis timeout and connection errors' })
    expect(fts('"timeout"')).toEqual([item.id])
    expect(repo.delete(item.id)?.id).toBe(item.id)
    expect(fts('"timeout"')).toEqual([])
    expect(repo.get(item.id)).toBeNull()
  })

  it('touch bumps last_used_at and use_count', () => {
    const item = repo.insert({ type: 'text', text: 'x', contentHash: 'h', capturedAt: 1000 })
    expect(repo.findRecentByHash('h', 0)?.id).toBe(item.id)
    expect(repo.findRecentByHash('h', 1001)).toBeNull()
    const touched = repo.touch(item.id, 5000, { app: 'Terminal', bundleId: 'com.apple.Terminal' })
    expect(touched).toMatchObject({ lastUsedAt: 5000, useCount: 2, capturedAt: 1000, sourceApp: 'Terminal' })
  })

  it('pages by last_used_at with a stable cursor', () => {
    const ids = [1, 2, 3, 4, 5].map((t) => repo.insert({ type: 'text', text: `t${t}`, capturedAt: t * 1000 }).id)
    const first = repo.list('inbox', null, 2)
    expect(first.items.map((i) => i.id)).toEqual([ids[4], ids[3]])
    const second = repo.list('inbox', first.nextCursor, 2)
    expect(second.items.map((i) => i.id)).toEqual([ids[2], ids[1]])
    const third = repo.list('inbox', second.nextCursor, 2)
    expect(third.items.map((i) => i.id)).toEqual([ids[0]])
    expect(third.nextCursor).toBeNull()
  })

  it('keeps FTS in sync when a duplicate comes from a different app', () => {
    const item = repo.insert({ type: 'text', text: 'payload', sourceApp: 'Chrome', capturedAt: 1000 })
    repo.touch(item.id, 2000, { app: 'Safari', bundleId: 'com.apple.Safari' })
    expect(fts('Safari')).toEqual([item.id])
    expect(fts('Chrome')).toEqual([])
    repo.touch(item.id, 3000, { app: null, bundleId: null })
    expect(fts('Safari')).toEqual([item.id])
    expect(repo.touch('missing', 4000, { app: 'Safari', bundleId: null })).toBeNull()
  })

  it('rolls back the duplicate update if FTS synchronization fails', () => {
    const item = repo.insert({ type: 'text', text: 'payload', sourceApp: 'Chrome', capturedAt: 1000 })
    db.exec('DROP TABLE items_fts')
    expect(() => repo.touch(item.id, 2000, { app: 'Safari', bundleId: null })).toThrow()
    expect(repo.get(item.id)).toEqual(item)
  })

  it('filters views', () => {
    const a = repo.insert({ type: 'text', text: 'a', capturedAt: 1 })
    const b = repo.insert({ type: 'text', text: 'b', capturedAt: 2 })
    repo.setPinned(a.id, true)
    repo.setArchived(b.id, true)
    expect(repo.list('inbox').items.map((i) => i.id)).toEqual([a.id])
    expect(repo.list('desk').items.map((i) => i.id)).toEqual([a.id])
    expect(repo.list('archive').items.map((i) => i.id)).toEqual([b.id])
  })
})

describe('SettingsRepo', () => {
  it('returns defaults and persists patches', () => {
    const settings = new SettingsRepo(db)
    expect(settings.get()).toEqual(DEFAULT_SETTINGS)
    settings.set({ pausedUntil: 'indefinite' })
    expect(new SettingsRepo(db).get().pausedUntil).toBe('indefinite')
    expect(settings.get().excludedApps.length).toBeGreaterThan(0)
  })
})

describe('ordering', () => {
  it('keeps insertion order for items captured in the same millisecond', () => {
    const ids = Array.from({ length: 50 }, (_, i) => repo.insert({ type: 'text', text: `t${i}`, capturedAt: 1000 }).id)
    expect(repo.list('inbox').items.map((i) => i.id)).toEqual([...ids].reverse())
  })
})
