import { describe, expect, it } from 'vitest'
import { buildQuery, commandEnterAction, enterAction, footerHints, mergeChips, removeSpan } from './model'

describe('quick search model', () => {
  it('builds the query from chips and text', () => {
    expect(buildQuery([{ key: 'type', value: 'screenshot' }, { key: 'app', value: 'IntelliJ IDEA' }], ' redis ')).toBe(
      'type:screenshot app:"IntelliJ IDEA" redis'
    )
    expect(buildQuery([], '')).toBe('')
  })

  it('replaces a chip of the same key', () => {
    expect(mergeChips([{ key: 'type', value: 'link' }], [{ key: 'type', value: 'file' }])).toEqual([
      { key: 'type', value: 'file' }
    ])
  })

  it('maps keys to actions per type (DESIGN §6.7)', () => {
    expect(enterAction('text')).toEqual({ action: 'copy', hide: true })
    expect(enterAction('link')).toEqual({ action: 'open', hide: true })
    expect(commandEnterAction('screenshot')).toEqual({ action: 'reveal', hide: true })
    expect(commandEnterAction('link')).toEqual({ action: 'copy', hide: true })
  })

  it('never shows more than five footer hints and no Space', () => {
    for (const type of ['text', 'link', 'image', 'file', 'screenshot', null] as const) {
      const hints = footerHints(type)
      expect(hints.length).toBeLessThanOrEqual(5)
      expect(hints.map(([k]) => k)).not.toContain('Space')
    }
  })

  it('removes the date words from the text', () => {
    expect(removeSpan('지난주 redis 에러', 0, 3)).toBe('redis 에러')
    expect(removeSpan('redis 지난주 에러', 6, 9)).toBe('redis 에러')
  })
})
