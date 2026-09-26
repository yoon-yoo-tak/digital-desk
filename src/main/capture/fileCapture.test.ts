import Database from 'better-sqlite3'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Settings } from '@shared/types'
import type { FileMeta, OcrLine } from '../helper/deskHelper'
import { OcrQueue } from '../indexing/ocrQueue'
import { migrate } from '../storage/db'
import { ItemsRepo } from '../storage/itemsRepo'
import { DEFAULT_SETTINGS } from '../storage/settingsRepo'
import { CaptureState } from './captureState'
import { FileCapture, type FileProbe } from './fileCapture'

const DESKTOP = '/Users/me/Desktop'
const DOWNLOADS = '/Users/me/Downloads'
const SHOT = `${DESKTOP}/Screenshot 2026-09-26 at 14.03.12.png`

let now = new Date(2026, 8, 26, 14, 3, 15).getTime()
let settings: Settings
let repo: ItemsRepo
let state: CaptureState
let capture: FileCapture
let queue: OcrQueue
let meta: Map<string, FileMeta | 'late'>
let files: Set<string>
let ocrLines: OcrLine[]
let changes = 0

class FakeProbe implements FileProbe {
  metaCalls = 0
  async meta(path: string): Promise<FileMeta | null> {
    this.metaCalls++
    const m = meta.get(path)
    if (m === 'late') {
      // Spotlight flags it on the third look
      return this.metaCalls >= 3 ? { isScreenCapture: true, whereFroms: [] } : { isScreenCapture: false, whereFroms: [] }
    }
    return m ?? { isScreenCapture: false, whereFroms: [] }
  }
  async frontmost() {
    return { name: 'IntelliJ IDEA', bundleId: 'com.jetbrains.intellij' }
  }
  stat(path: string) {
    return files.has(path) ? { size: 1234, createdAt: now - 1000 } : null
  }
  imageSize() {
    return { width: 2880, height: 1800 }
  }
  async thumbnail(id: string) {
    return `thumbs/${id}.png`
  }
  async sleep() {}
}

let probe: FakeProbe

beforeEach(() => {
  now = new Date(2026, 8, 26, 14, 3, 15).getTime()
  settings = { ...structuredClone(DEFAULT_SETTINGS), onboarded: true }
  const db = new Database(':memory:')
  migrate(db)
  repo = new ItemsRepo(db)
  state = new CaptureState({ get: () => settings, set: (p) => (settings = { ...settings, ...p }) }, () => now)
  meta = new Map()
  files = new Set()
  ocrLines = [
    { text: 'Run: OrderApiApplication', confidence: 1 },
    { text: 'org.springframework.data.redis.RedisConnectionFailureException: Unable to connect', confidence: 1 }
  ]
  changes = 0
  queue = new OcrQueue({
    repo,
    engine: { available: true, ocr: async () => ocrLines },
    onChanged: () => changes++
  })
  probe = new FakeProbe()
  capture = new FileCapture({ repo, state, probe, ocr: queue, now: () => now, onChanged: () => changes++ })
})

describe('screenshots', () => {
  it('records a real screenshot, then OCR fills in text and title', async () => {
    files.add(SHOT)
    meta.set(SHOT, { isScreenCapture: true, whereFroms: [] })
    const outcome = await capture.screenshot(SHOT)
    expect(outcome.kind).toBe('created')
    await queue.idle()
    const [item] = repo.list('inbox').items
    expect(item).toMatchObject({
      type: 'screenshot',
      fileName: 'Screenshot 2026-09-26 at 14.03.12.png',
      title: 'RedisConnectionFailureException',
      ocrStatus: 'done',
      sourceApp: 'IntelliJ IDEA',
      metadata: { width: 2880, height: 1800, size: 1234 }
    })
    expect(item?.ocrText).toContain('Unable to connect')
    expect(item?.previewPath).toMatch(/^thumbs\//u)
  })

  it('waits for late screenshot metadata', async () => {
    const renamed = `${DESKTOP}/error.png`
    files.add(renamed)
    meta.set(renamed, 'late')
    expect((await capture.screenshot(renamed)).kind).toBe('created')
  })

  it('ignores ordinary images on the Desktop', async () => {
    const photo = `${DESKTOP}/vacation.png`
    files.add(photo)
    expect(await capture.screenshot(photo)).toEqual({ kind: 'skipped', reason: 'not-captured' })
    files.add(`${DESKTOP}/notes.txt`)
    expect(await capture.screenshot(`${DESKTOP}/notes.txt`)).toEqual({ kind: 'skipped', reason: 'not-captured' })
    expect(repo.count()).toBe(0)
  })

  it('records a browser download saved to the Desktop as a download', async () => {
    const pdf = `${DESKTOP}/invoice.pdf`
    files.add(pdf)
    meta.set(pdf, { isScreenCapture: false, whereFroms: ['https://billing.example.com/invoice.pdf'] })
    expect((await capture.screenshot(pdf)).kind).toBe('created')
    expect(repo.list('inbox').items[0]).toMatchObject({ type: 'file', domain: 'billing.example.com', ocrStatus: null })
    expect(await capture.screenshot(`${DESKTOP}/invoice.pdf.crdownload`)).toEqual({ kind: 'skipped', reason: 'ignored' })
  })

  it('falls back to the file name when metadata is unavailable', async () => {
    files.add(SHOT)
    probe.meta = async () => null
    expect((await capture.screenshot(SHOT)).kind).toBe('created')
  })

  it('skips while paused and never records the same file twice', async () => {
    files.add(SHOT)
    meta.set(SHOT, { isScreenCapture: true, whereFroms: [] })
    state.pause(5)
    expect(await capture.screenshot(SHOT)).toEqual({ kind: 'skipped', reason: 'paused' })
    state.resume()
    expect((await capture.screenshot(SHOT)).kind).toBe('created')
    expect(await capture.screenshot(SHOT)).toEqual({ kind: 'skipped', reason: 'duplicate' })
  })

  it('keeps the record, thumbnail and OCR when the original is deleted', async () => {
    files.add(SHOT)
    meta.set(SHOT, { isScreenCapture: true, whereFroms: [] })
    await capture.screenshot(SHOT)
    await queue.idle()
    capture.removed(SHOT)
    const [item] = repo.list('inbox').items
    expect(item).toMatchObject({ metadata: { missing: true }, ocrStatus: 'done' })
    expect(item?.previewPath).not.toBeNull()
    expect(item?.ocrText).toContain('RedisConnectionFailureException')
  })
})

describe('downloads', () => {
  it('records a finished download with where it came from', async () => {
    const pdf = `${DOWNLOADS}/redis-guide.pdf`
    files.add(pdf)
    meta.set(pdf, { isScreenCapture: false, whereFroms: ['https://www.redis.io/files/redis-guide.pdf', 'https://redis.io/docs/'] })
    expect((await capture.download(pdf)).kind).toBe('created')
    expect(repo.list('inbox').items[0]).toMatchObject({
      type: 'file',
      fileName: 'redis-guide.pdf',
      url: 'https://www.redis.io/files/redis-guide.pdf',
      domain: 'redis.io',
      ocrStatus: null
    })
  })

  it('never records in-progress or hidden files', async () => {
    for (const name of ['redis-guide.pdf.crdownload', 'Unconfirmed 1234.crdownload', '.DS_Store', 'x.part']) {
      files.add(`${DOWNLOADS}/${name}`)
      expect(await capture.download(`${DOWNLOADS}/${name}`)).toEqual({ kind: 'skipped', reason: 'ignored' })
    }
    expect(repo.count()).toBe(0)
  })

  it('respects the downloads toggle', async () => {
    settings.sources = { ...settings.sources, downloads: false }
    files.add(`${DOWNLOADS}/a.pdf`)
    expect(await capture.download(`${DOWNLOADS}/a.pdf`)).toEqual({ kind: 'skipped', reason: 'paused' })
  })
})

describe('ocr queue', () => {
  it('marks OCR as skipped without an engine and failed on errors', async () => {
    const a = repo.insert({ type: 'screenshot', capturedAt: now, ocrStatus: 'pending' })
    const offline = new OcrQueue({ repo, engine: { available: false, ocr: async () => [] }, onChanged: () => undefined })
    offline.enqueue(a.id, '/x.png')
    await offline.idle()
    expect(repo.get(a.id)?.ocrStatus).toBe('skipped')

    const b = repo.insert({ type: 'screenshot', capturedAt: now, ocrStatus: 'pending' })
    const broken = new OcrQueue({
      repo,
      engine: { available: true, ocr: async () => Promise.reject(new Error('boom')) },
      onChanged: () => undefined
    })
    broken.enqueue(b.id, '/y.png')
    await broken.idle()
    expect(repo.get(b.id)?.ocrStatus).toBe('failed')
  })

  it('makes OCR text searchable through the full-text index', async () => {
    files.add(SHOT)
    meta.set(SHOT, { isScreenCapture: true, whereFroms: [] })
    ocrLines = [{ text: '결제 모듈 연결 오류 발생', confidence: 1 }]
    await capture.screenshot(SHOT)
    await queue.idle()
    const db = (repo as unknown as { db: Database.Database }).db
    const hits = db.prepare("SELECT rowid FROM items_fts WHERE items_fts MATCH '\"결제 모듈\"'").all()
    expect(hits).toHaveLength(1)
    expect(repo.list('inbox').items[0]?.title).toBe('결제 모듈 연결 오류 발생')
  })
})
