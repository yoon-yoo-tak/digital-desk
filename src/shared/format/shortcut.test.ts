import { describe, expect, it } from 'vitest'
import { acceleratorFromKey, formatAccelerator } from './shortcut'

const key = (code: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  code,
  ...mods
})

describe('acceleratorFromKey', () => {
  it('builds accelerators from physical keys', () => {
    expect(acceleratorFromKey(key('Space', { metaKey: true, shiftKey: true }))).toBe('Shift+Command+Space')
    expect(acceleratorFromKey(key('KeyP', { metaKey: true, altKey: true }))).toBe('Alt+Command+P')
    expect(acceleratorFromKey(key('Digit1', { ctrlKey: true }))).toBe('Control+1')
  })
  it('needs a real modifier and a real key', () => {
    expect(acceleratorFromKey(key('KeyK'))).toBeNull()
    expect(acceleratorFromKey(key('KeyK', { shiftKey: true }))).toBeNull()
    expect(acceleratorFromKey(key('MetaLeft', { metaKey: true }))).toBeNull()
  })
})

describe('formatAccelerator', () => {
  it('shows macOS symbols in the standard order', () => {
    expect(formatAccelerator('CommandOrControl+Shift+Space')).toBe('⇧⌘Space')
    expect(formatAccelerator('Alt+CommandOrControl+P')).toBe('⌥⌘P')
    expect(formatAccelerator('Shift+Command+Space')).toBe('⇧⌘Space')
  })
})
