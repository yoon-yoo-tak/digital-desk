import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Settings } from '@shared/types'
import type { PasteboardEvent } from '../helper/deskHelper'
import { migrate } from '../storage/db'
import { ItemsRepo } from '../storage/itemsRepo'
import { DEFAULT_SETTINGS } from '../storage/settingsRepo'
import { CaptureState } from './captureState'
import { textHash } from './classify'
import { ClipboardWatcher, DEDUPE_WINDOW_MS, type ClipboardImage, type ClipboardReader } from './clipboardWatcher'

class FakeReader implements ClipboardReader {
  text = ''
  image: ClipboardImage | null = null
  files: string[] = []
  reads = 0
  async readText(): Promise<string> {
    this.reads++
    return this.text
  }
  async readImage(): Promise<ClipboardImage | null> {
    this.reads++
    return this.image
  }
  async readFilePaths(): Promise<string[]> {
    this.reads++
    return this.files
  }
}

const intellij = { name: 'IntelliJ IDEA', bundleId: 'com.jetbrains.intellij' }
const textTypes = ['public.utf8-plain-text']

let now = new Date(2026, 8, 26, 14, 0).getTime()
let settings: Settings
let reader: FakeReader
let repo: ItemsRepo
let state: CaptureState
let watcher: ClipboardWatcher
let onChanged: ReturnType<typeof vi.fn<() => void>>
let fetchTitle: ReturnType<typeof vi.fn<(url: string) => Promise<string | null>>>

const event = (patch: Partial<PasteboardEvent> = {}): PasteboardEvent => ({
  changeCount: 1,
  app: intellij,
  types: textTypes,
  concealed: false,
  transient: false,
  at: now,
  ...patch
})

beforeEach(() => {
  now = new Date(2026, 8, 26, 14, 0).getTime()
  settings = { ...structuredClone(DEFAULT_SETTINGS), onboarded: true }
  const store = {
    get: () => settings,
    set: (patch: Partial<Settings>) => (settings = { ...settings, ...patch })
  }
  const db = new Database(':memory:')
  migrate(db)
  repo = new ItemsRepo(db)
  reader = new FakeReader()
  state = new CaptureState(store, () => now)
  onChanged = vi.fn<() => void>()
  fetchTitle = vi.fn<(url: string) => Promise<string | null>>(async () => 'Redis timeout and connection errors')
  watcher = new ClipboardWatcher({
    repo,
    state,
    reader,
    now: () => now,
    fetchTitle,
    onChanged,
    assets: {
      saveClipboardImage: (id) => `thumbs/${id}.png`,
      saveFileThumbnail: async (id) => `thumbs/${id}.png`,
      removeFor: () => undefined,
      statFile: (path) => ({ size: 10, createdAt: 1, isImage: path.endsWith('.png') })
    }
  })
})

describe('ClipboardWatcher', () => {
  it.each(['unknown app', 'onboarding', 'disabled clipboard', 'transient'])(
    'does not read or store content for %s', async (scenario) => {
      reader.text = 'sensitive content'
      if (scenario === 'onboarding') settings.onboarded = false
      if (scenario === 'disabled clipboard') settings.sources.clipboard = false
      const outcome = await watcher.handle(event({
        ...(scenario === 'unknown app' ? { app: { name: null, bundleId: null } } : {}),
        transient: scenario === 'transient'
      }))
      expect(outcome.kind).toBe('skipped')
      expect(reader.reads).toBe(0)
      expect(repo.count()).toBe(0)
      expect(fetchTitle).not.toHaveBeenCalled()
    }
  )
  it('stores copied text with its source app and a mono hint', async () => {
    reader.text = 'SELECT * FROM employee WHERE dept_id = 3;'
    const outcome = await watcher.handle(event())
    expect(outcome.kind).toBe('created')
    const [item] = repo.list('inbox').items
    expect(item).toMatchObject({
      type: 'text',
      title: 'SELECT * FROM employee WHERE dept_id = 3;',
      sourceApp: 'IntelliJ IDEA',
      metadata: { mono: true }
    })
    expect(onChanged).toHaveBeenCalled()
  })

  it('turns a single URL into a link and resolves its title', async () => {
    reader.text = 'https://redis.io/docs/latest/'
    await watcher.handle(event())
    await vi.waitFor(() => expect(repo.list('inbox').items[0]?.title).toBe('Redis timeout and connection errors'))
    expect(repo.list('inbox').items[0]).toMatchObject({ type: 'link', domain: 'redis.io' })
  })

  it('dedupes the same text within 24h and counts uses', async () => {
    reader.text = 'hello'
    await watcher.handle(event())
    now += 60_000
    reader.text = 'hello  \r\n'
    const outcome = await watcher.handle(event({ changeCount: 2 }))
    expect(outcome.kind).toBe('touched')
    const items = repo.list('inbox').items
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ useCount: 2, lastUsedAt: now })

    now += DEDUPE_WINDOW_MS + 1
    await watcher.handle(event({ changeCount: 3 }))
    expect(repo.list('inbox').items).toHaveLength(2)
  })

  it('does not read anything while paused, from excluded apps, or when concealed', async () => {
    reader.text = 'secret'
    state.pause(5)
    expect(await watcher.handle(event())).toEqual({ kind: 'skipped', reason: 'paused-or-excluded' })
    state.resume()
    expect(await watcher.handle(event({ app: { name: '1Password', bundleId: 'com.1password.1password' } }))).toEqual({
      kind: 'skipped',
      reason: 'paused-or-excluded'
    })
    expect(await watcher.handle(event({ concealed: true }))).toEqual({ kind: 'skipped', reason: 'concealed' })
    expect(await watcher.handle(event({ transient: true }))).toEqual({ kind: 'skipped', reason: 'concealed' })
    expect(reader.reads).toBe(0)
    expect(repo.count()).toBe(0)
  })

  it('ignores clipboard writes made by the app itself', async () => {
    reader.text = 'copied from the inspector'
    watcher.markSelfWrite(textHash(reader.text))
    expect(await watcher.handle(event())).toEqual({ kind: 'skipped', reason: 'self-write' })
    // Only once: a later genuine copy of the same text is captured.
    expect((await watcher.handle(event({ changeCount: 2 }))).kind).toBe('created')
  })

  it('prefers copied files over their text representation', async () => {
    reader.files = ['/Users/me/Downloads/redis-guide.pdf', '/Users/me/Desktop/shot.png']
    reader.text = 'redis-guide.pdf'
    const outcome = await watcher.handle(event({ types: ['public.file-url', 'public.utf8-plain-text'] }))
    expect(outcome.kind).toBe('created')
    const items = repo.list('inbox').items
    expect(items.map((i) => i.fileName).sort()).toEqual(['redis-guide.pdf', 'shot.png'])
    expect(items.find((i) => i.fileName === 'shot.png')?.previewPath).toMatch(/^thumbs\//)
    expect(items.find((i) => i.fileName === 'redis-guide.pdf')?.previewPath).toBeNull()
  })

  it('stores images only when there is no text', async () => {
    reader.image = { png: Buffer.from('png-bytes'), width: 1284, height: 720 }
    await watcher.handle(event({ types: ['public.png'] }))
    expect(repo.list('inbox').items[0]).toMatchObject({ type: 'image', metadata: { width: 1284, height: 720 } })

    reader.text = 'A1\tB1'
    await watcher.handle(event({ types: ['public.utf8-plain-text', 'public.png'] }))
    expect(repo.list('inbox').items[0]?.type).toBe('text')
  })

  it('skips empty clipboards', async () => {
    expect(await watcher.handle(event())).toEqual({ kind: 'skipped', reason: 'empty' })
  })
})
