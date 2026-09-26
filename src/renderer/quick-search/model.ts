// Quick Search rules that don't need React (DESIGN §6.7, §6.9). Pure and unit-tested.

import { serializeFilter, type QueryFilter } from '@shared/query/filters'
import type { ItemAction, ItemType } from '@shared/types'

/** DOM id of a result row (for aria-activedescendant and scrolling). */
export const optionId = (id: string): string => `qs-${id}`

/** ⌘1 … ⌘5 */
export const TYPE_SHORTCUT_ORDER: ItemType[] = ['screenshot', 'text', 'link', 'file', 'image']

export function buildQuery(chips: QueryFilter[], text: string): string {
  return [...chips.map(serializeFilter), text.trim()].filter(Boolean).join(' ')
}

/** A new chip replaces an existing one with the same key. */
export function mergeChips(existing: QueryFilter[], added: QueryFilter[]): QueryFilter[] {
  let out = existing
  for (const chip of added) out = [...out.filter((c) => c.key !== chip.key), chip]
  return out
}

export interface KeyAction {
  action: ItemAction
  /** Hide the panel afterwards (focus returns to the previous app, ready to paste). */
  hide: boolean
}

/** ↵ */
export function enterAction(type: ItemType): KeyAction {
  return { action: type === 'text' ? 'copy' : 'open', hide: true }
}

/** ⌘↵ — files: reveal in Finder, links: copy URL (DESIGN §6.7). */
export function commandEnterAction(type: ItemType): KeyAction {
  switch (type) {
    case 'text':
    case 'link':
      return { action: 'copy', hide: true }
    case 'file':
    case 'screenshot':
    case 'image':
      return { action: 'reveal', hide: true }
  }
}

export function canQuickLook(type: ItemType): boolean {
  return type === 'file' || type === 'screenshot' || type === 'image'
}

export interface ButtonSpec {
  label: string
  action: ItemAction
  hide: KeyAction['hide']
}

/** Preview buttons: primary + optional secondary. */
export function previewButtons(type: ItemType): [ButtonSpec, ButtonSpec | null] {
  switch (type) {
    case 'text':
      return [{ label: 'Copy', action: 'copy', hide: true }, null]
    case 'link':
      return [
        { label: 'Open', action: 'open', hide: true },
        { label: 'Copy URL', action: 'copy', hide: true }
      ]
    case 'image':
      return [
        { label: 'Open', action: 'open', hide: true },
        { label: 'Copy', action: 'copy', hide: true }
      ]
    case 'file':
    case 'screenshot':
      return [
        { label: 'Open', action: 'open', hide: true },
        { label: 'Reveal in Finder', action: 'reveal', hide: true }
      ]
  }
}

/** Footer key hints for the selected item, at most five (DESIGN §6.9). */
export function footerHints(type: ItemType | null): [string, string][] {
  switch (type) {
    case null:
      return []
    case 'text':
      return [
        ['↵', 'Copy'],
        ['⌘P', 'Pin']
      ]
    case 'link':
      return [
        ['↵', 'Open'],
        ['⌘↵', 'Copy URL'],
        ['⌘P', 'Pin']
      ]
    case 'image':
      return [
        ['↵', 'Open'],
        ['⌘Y', 'Quick Look'],
        ['⌘C', 'Copy'],
        ['⌘P', 'Pin']
      ]
    case 'file':
    case 'screenshot':
      return [
        ['↵', 'Open'],
        ['⌘↵', 'Reveal'],
        ['⌘Y', 'Quick Look'],
        ['⌘C', 'Copy'],
        ['⌘P', 'Pin']
      ]
  }
}

/** Removes a span (the date words) from the text and tidies the spaces around it. */
export function removeSpan(text: string, start: number, end: number): string {
  return (text.slice(0, start) + text.slice(end)).replace(/\s{2,}/gu, ' ').trim()
}
