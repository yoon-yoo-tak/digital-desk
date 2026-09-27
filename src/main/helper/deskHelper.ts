// Client for the native `desk-helper` process (ARCHITECTURE §5).
// Spawns it, speaks JSON lines, restarts it with backoff, and reports when it is unavailable.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { createInterface } from 'node:readline'
import type { SourceApp } from '@shared/types'
import { systemClock, type Clock } from '../clock'

export interface FileMeta {
  isScreenCapture: boolean
  whereFroms: string[]
}

export interface OcrLine {
  text: string
  confidence: number
}

export interface PasteboardEvent {
  changeCount: number
  app: SourceApp
  types: string[]
  concealed: boolean
  transient: boolean
  at: number
}

interface HelperEvents {
  ready: []
  pasteboard: [PasteboardEvent]
  /** Not running: crashed, couldn't start, or the binary is missing. May recover on `ready`. */
  unavailable: [reason: string]
}

interface Pending {
  resolve: (value: Record<string, unknown>) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

const REQUEST_TIMEOUT_MS = 10_000
/** A first recognition right after install can take ~25 s while macOS prepares the models. */
const OCR_TIMEOUT_MS = 60_000
const MAX_RESTARTS_PER_MINUTE = 5

function toSourceApp(raw: unknown): SourceApp {
  const app = (raw ?? {}) as { name?: unknown; bundleId?: unknown }
  return {
    name: typeof app.name === 'string' && app.name ? app.name : null,
    bundleId: typeof app.bundleId === 'string' && app.bundleId ? app.bundleId : null
  }
}

export class DeskHelper extends EventEmitter<HelperEvents> {
  private child: ChildProcessWithoutNullStreams | null = null
  private nextId = 1
  private pending = new Map<number, Pending>()
  private restarts: number[] = []
  private stopped = false
  private _running = false

  constructor(
    private readonly binaryPath: string,
    private readonly now: Clock = systemClock
  ) {
    super()
  }

  get running(): boolean {
    return this._running
  }

  start(): void {
    this.stopped = false
    if (!existsSync(this.binaryPath)) {
      this.emit('unavailable', `desk-helper not found at ${this.binaryPath}`)
      return
    }
    this.spawnChild()
  }

  stop(): void {
    this.stopped = true
    this.child?.stdin.end()
    this.child?.kill()
    this.child = null
    this._running = false
  }

  async frontmost(): Promise<SourceApp> {
    const res = await this.request('frontmost')
    return toSourceApp(res.app)
  }

  async pasteboardFiles(): Promise<string[]> {
    const res = await this.request('pasteboardFiles')
    return Array.isArray(res.paths) ? res.paths.filter((p): p is string => typeof p === 'string') : []
  }

  async fileMeta(path: string): Promise<FileMeta> {
    const res = await this.request('mdmeta', { path })
    return {
      isScreenCapture: res.isScreenCapture === true,
      whereFroms: Array.isArray(res.whereFroms) ? res.whereFroms.filter((u): u is string => typeof u === 'string') : []
    }
  }

  async screenshotLocation(): Promise<string | null> {
    const res = await this.request('screenshotLocation')
    return typeof res.path === 'string' && res.path ? res.path : null
  }

  async ocr(path: string): Promise<OcrLine[]> {
    const res = await this.request('ocr', { path }, OCR_TIMEOUT_MS)
    return Array.isArray(res.lines)
      ? res.lines.filter((l): l is OcrLine => typeof (l as OcrLine)?.text === 'string')
      : []
  }

  /** Copies files to the pasteboard like Finder does. */
  async writeFiles(paths: string[]): Promise<void> {
    await this.request('writeFiles', { paths })
  }

  request(cmd: string, args: Record<string, unknown> = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Record<string, unknown>> {
    const child = this.child
    if (!child || !this._running) return Promise.reject(new Error('desk-helper is not running'))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`desk-helper ${cmd} timed out`))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      child.stdin.write(JSON.stringify({ id, cmd, ...args }) + '\n')
    })
  }

  private spawnChild(): void {
    const child = spawn(this.binaryPath, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.child = child
    createInterface({ input: child.stdout }).on('line', (line) => this.onLine(line))
    child.stderr.on('data', (chunk: Buffer) => console.warn('[desk-helper]', chunk.toString().trim()))
    child.on('error', (error) => console.error('[desk-helper] spawn failed', error))
    // `close` also fires after a spawn error, unlike `exit`.
    child.on('close', (code, signal) => {
      if (this.child !== child) return
      this.child = null
      this._running = false
      for (const [, p] of this.pending) {
        clearTimeout(p.timer)
        p.reject(new Error('desk-helper exited'))
      }
      this.pending.clear()
      if (this.stopped) return
      console.warn(`[desk-helper] exited (code ${code}, signal ${signal})`)
      this.emit('unavailable', 'desk-helper stopped; clipboard capture suspended')
      this.scheduleRestart()
    })
  }

  private scheduleRestart(): void {
    const now = this.now()
    this.restarts = this.restarts.filter((t) => now - t < 60_000)
    if (this.restarts.length >= MAX_RESTARTS_PER_MINUTE) {
      this.emit('unavailable', 'desk-helper keeps crashing')
      return
    }
    this.restarts.push(now)
    const delay = 250 * 2 ** (this.restarts.length - 1)
    setTimeout(() => {
      if (!this.stopped) this.spawnChild()
    }, delay).unref()
  }

  private onLine(line: string): void {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(line) as Record<string, unknown>
    } catch {
      console.warn('[desk-helper] bad line', line)
      return
    }
    if (typeof msg.id === 'number') {
      const pending = this.pending.get(msg.id)
      if (!pending) return
      this.pending.delete(msg.id)
      clearTimeout(pending.timer)
      if (msg.ok === true) pending.resolve(msg)
      else pending.reject(new Error(String(msg.error ?? 'desk-helper request failed')))
      return
    }
    switch (msg.event) {
      case 'ready':
        this._running = true
        this.emit('ready')
        break
      case 'pasteboard':
        this.emit('pasteboard', {
          changeCount: Number(msg.changeCount),
          app: toSourceApp(msg.app),
          types: Array.isArray(msg.types) ? msg.types.filter((t): t is string => typeof t === 'string') : [],
          concealed: msg.concealed === true,
          transient: msg.transient === true,
          at: typeof msg.at === 'number' ? msg.at : this.now()
        })
        break
    }
  }
}
