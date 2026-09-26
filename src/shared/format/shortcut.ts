// Global shortcut recording and display (Settings › Shortcuts).

const MODIFIER_SYMBOLS: [string, string][] = [
  ['Control', '⌃'],
  ['Alt', '⌥'],
  ['Shift', '⇧'],
  ['Command', '⌘'],
  ['CommandOrControl', '⌘']
]

const KEY_NAMES: Record<string, string> = { Space: 'Space', Enter: '↵', Escape: 'Esc', Backspace: '⌫', Tab: '⇥' }

export interface KeyLike {
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  /** KeyboardEvent.code, e.g. "KeyK", "Digit1", "Space" — layout-independent, IME-proof. */
  code: string
}

/**
 * An Electron accelerator from a key press, or null if it can't be a global shortcut
 * (no ⌘/⌃/⌥, or only modifiers pressed).
 */
export function acceleratorFromKey(e: KeyLike): string | null {
  let key: string | null = null
  if (/^Key[A-Z]$/u.test(e.code)) key = e.code.slice(3)
  else if (/^Digit[0-9]$/u.test(e.code)) key = e.code.slice(5)
  else if (/^F([1-9]|1[0-9])$/u.test(e.code)) key = e.code
  else if (['Space', 'Enter', 'Tab', 'Backspace', 'Escape'].includes(e.code)) key = e.code === 'Escape' ? 'Esc' : e.code
  if (!key || !(e.metaKey || e.ctrlKey || e.altKey)) return null
  const parts: string[] = []
  if (e.ctrlKey) parts.push('Control')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Command')
  return [...parts, key].join('+')
}

/** "CommandOrControl+Shift+Space" → "⌘⇧Space" (macOS order: ⌃⌥⇧⌘). */
export function formatAccelerator(accelerator: string): string {
  const parts = accelerator.split('+')
  const key = parts[parts.length - 1] ?? ''
  const mods = new Set(parts.slice(0, -1))
  const symbols = MODIFIER_SYMBOLS.filter(([name]) => mods.has(name)).map(([, s]) => s)
  return [...new Set(symbols)].join('') + (KEY_NAMES[key] ?? key)
}
