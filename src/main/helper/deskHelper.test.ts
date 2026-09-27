import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DeskHelper } from './deskHelper'

vi.mock('node:child_process', () => ({ spawn: vi.fn() }))
vi.mock('node:fs', () => ({ existsSync: vi.fn() }))

function childProcess() {
  return Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn()
  })
}
let child: ReturnType<typeof childProcess>
let helper: DeskHelper
beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(existsSync).mockReturnValue(true)
  child = childProcess()
  vi.mocked(spawn).mockImplementation(() => child as unknown as ReturnType<typeof spawn>)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  helper = new DeskHelper('/test/desk-helper', () => Date.now())
})
afterEach(() => {
  helper.stop()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('helper capture availability', () => {
  it('announces loss immediately and becomes available again only after ready', async () => {
    const unavailable = vi.fn()
    helper.on('unavailable', unavailable)
    helper.start()
    expect(helper.running).toBe(false)
    child.stdout.write('{"event":"ready"}\n')
    expect(helper.running).toBe(true)
    child.emit('close', 1, null)
    expect(helper.running).toBe(false)
    expect(unavailable).toHaveBeenCalledOnce()
    child = childProcess()
    await vi.advanceTimersByTimeAsync(250)
    expect(helper.running).toBe(false)
    child.stdout.write('{"event":"ready"}\n')
    expect(helper.running).toBe(true)
  })

  it('handles spawn errors without waiting for an exit event that will not occur', () => {
    const unavailable = vi.fn()
    helper.on('unavailable', unavailable)
    helper.start()
    child.emit('error', new Error('permission denied'))
    child.emit('close', -1, null)
    expect(helper.running).toBe(false)
    expect(unavailable).toHaveBeenCalledOnce()
  })

  it('reports a missing binary without starting any capture process', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const unavailable = vi.fn()
    helper.on('unavailable', unavailable)
    helper.start()
    expect(helper.running).toBe(false)
    expect(unavailable).toHaveBeenCalledOnce()
  })
})
