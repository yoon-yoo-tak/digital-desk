import { describe, expect, it } from 'vitest'
import type { DeskItem } from '../types'
import { displayTitle, extensionLabel, formatBytes, rowMeta, tildify, tildifyUserPath } from './item'

const base: DeskItem = {
  id: '01',
  type: 'text',
  title: null,
  text: null,
  ocrText: null,
  filePath: null,
  fileName: null,
  url: null,
  domain: null,
  sourceApp: 'IntelliJ IDEA',
  sourceBundleId: 'com.jetbrains.intellij',
  createdAt: 0,
  capturedAt: 0,
  lastUsedAt: 0,
  useCount: 1,
  previewPath: null,
  contentHash: null,
  pinned: false,
  archived: false,
  ocrStatus: null,
  metadata: {}
}

describe('displayTitle', () => {
  it('falls back to domain + path for untitled links', () => {
    expect(displayTitle({ ...base, type: 'link', url: 'https://www.redis.io/docs/latest/' })).toBe('redis.io/docs/latest/')
    expect(displayTitle({ ...base, type: 'link', url: 'https://redis.io/' })).toBe('redis.io')
  })
  it('describes images by size', () => {
    expect(displayTitle({ ...base, type: 'image', metadata: { width: 1284, height: 720 } })).toBe('Image · 1284 × 720')
  })
  it('uses the first line of text', () => {
    expect(displayTitle({ ...base, text: '\nSELECT *\nFROM t' })).toBe('SELECT *')
  })
})

describe('rowMeta', () => {
  it('formats each type', () => {
    expect(rowMeta(base)).toBe('Copied · IntelliJ IDEA')
    expect(rowMeta({ ...base, useCount: 3 })).toBe('Copied · IntelliJ IDEA · copied 3×')
    expect(rowMeta({ ...base, type: 'link', domain: 'redis.io', sourceApp: 'Chrome' })).toBe('redis.io · Chrome')
    expect(rowMeta({ ...base, type: 'file', fileName: 'a.pdf', filePath: '/Users/me/Downloads/a.pdf' })).toBe(
      'PDF · Downloads'
    )
  })
})

describe('helpers', () => {
  it('labels extensions', () => {
    expect(extensionLabel('x.jpeg')).toBe('JPG')
    expect(extensionLabel('Makefile')).toBe('File')
  })
  it('tildifies home paths', () => {
    expect(tildify('/Users/me/Desktop/a.png', '/Users/me')).toBe('~/Desktop/a.png')
    expect(tildify('/tmp/a', '/Users/me')).toBe('/tmp/a')
  })
})

describe('formatBytes', () => {
  it.each([
    [912, '912 B'],
    [48 * 1024, '48 KB'],
    [2.4 * 1024 * 1024, '2.4 MB'],
    [1536, '1.5 KB']
  ])('%s → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected)
  })
})

describe('tildifyUserPath', () => {
  it('shortens paths under a user folder', () => {
    expect(tildifyUserPath('/Users/me/Downloads/a.pdf')).toBe('~/Downloads/a.pdf')
    expect(tildifyUserPath('/Volumes/x/a.pdf')).toBe('/Volumes/x/a.pdf')
  })
})
