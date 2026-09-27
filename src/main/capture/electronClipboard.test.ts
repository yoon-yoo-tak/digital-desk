import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clipboard } from 'electron'
import type { DeskHelper } from '../helper/deskHelper'
import { ElectronClipboardReader } from './electronClipboard'

vi.mock('electron', () => ({
  clipboard: { read: vi.fn(), readText: vi.fn(), has: vi.fn() },
  nativeImage: { createFromBuffer: vi.fn() }
}))
beforeEach(() => vi.clearAllMocks())

describe('helper unavailable', () => {
  it('never reads clipboard contents without the helper', async () => {
    const helper = { running: false, pasteboardFiles: vi.fn() }
    const reader = new ElectronClipboardReader(helper as unknown as DeskHelper)
    expect(await reader.readText()).toBe('')
    expect(await reader.readImage()).toBeNull()
    expect(await reader.readFilePaths()).toEqual([])
    expect(clipboard.read).not.toHaveBeenCalled()
    expect(clipboard.readText).not.toHaveBeenCalled()
    expect(helper.pasteboardFiles).not.toHaveBeenCalled()
  })

  it('stops reading on loss of the helper and resumes only when it recovers', async () => {
    const helper = { running: true, pasteboardFiles: vi.fn() }
    const reader = new ElectronClipboardReader(helper as unknown as DeskHelper)
    vi.mocked(clipboard.readText).mockResolvedValue('ordinary text')
    expect(await reader.readText()).toBe('ordinary text')
    helper.running = false
    expect(await reader.readText()).toBe('')
    expect(await reader.readImage()).toBeNull()
    helper.running = true
    expect(await reader.readText()).toBe('ordinary text')
    expect(clipboard.readText).toHaveBeenCalledTimes(2)
    expect(clipboard.read).not.toHaveBeenCalled()
  })
})
