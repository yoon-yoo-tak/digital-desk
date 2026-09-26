// Structured search prefixes: type: app: domain: (PRODUCT §12 Layer 2, DESIGN §6.3).

import type { ItemType } from '../types'

export type FilterKey = 'type' | 'app' | 'domain'

export interface QueryFilter {
  key: FilterKey
  value: string
}

const TYPE_ALIASES: Record<string, ItemType> = {
  screenshot: 'screenshot',
  screenshots: 'screenshot',
  스크린샷: 'screenshot',
  text: 'text',
  clipboard: 'text',
  텍스트: 'text',
  link: 'link',
  links: 'link',
  url: 'link',
  링크: 'link',
  file: 'file',
  files: 'file',
  파일: 'file',
  image: 'image',
  images: 'image',
  img: 'image',
  이미지: 'image'
}

export const TYPE_LABELS: Record<ItemType, string> = {
  screenshot: 'Screenshot',
  text: 'Text',
  link: 'Link',
  file: 'File',
  image: 'Image'
}

export interface Token {
  text: string
  start: number
  end: number
}

/** Whitespace tokens; a double-quoted run (app:"IntelliJ IDEA") stays one token. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  const re = /(?:[^\s"]+|"[^"]*"?)+/gu
  for (let m = re.exec(input); m; m = re.exec(input)) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length })
  }
  return tokens
}

/** Parses one token like `type:screenshot` or `app:"IntelliJ IDEA"`. Unknown types are not filters. */
export function parseFilterToken(token: string): QueryFilter | null {
  const m = /^(type|app|domain):(.+)$/iu.exec(token)
  if (!m) return null
  const key = (m[1] as string).toLowerCase() as FilterKey
  const value = (m[2] as string).replace(/^"|"$/gu, '').trim()
  if (!value) return null
  if (key === 'type') {
    const type = TYPE_ALIASES[value.toLowerCase()]
    return type ? { key, value: type } : null
  }
  if (key === 'domain') return { key, value: value.toLowerCase().replace(/^www\./u, '') }
  return { key, value }
}

export function serializeFilter(filter: QueryFilter): string {
  return `${filter.key}:${/\s/u.test(filter.value) ? `"${filter.value}"` : filter.value}`
}

/**
 * Filters the user has finished typing (a filter token followed by whitespace) turn into chips.
 * Returns them and the text with those tokens removed.
 */
export function takeCompletedFilters(text: string): { filters: QueryFilter[]; rest: string } {
  const filters: QueryFilter[] = []
  let rest = ''
  let cursor = 0
  for (const token of tokenize(text)) {
    const completed = token.end < text.length && /\s/u.test(text[token.end] ?? '')
    const filter = completed ? parseFilterToken(token.text) : null
    if (!filter) continue
    filters.push(filter)
    rest += text.slice(cursor, token.start)
    cursor = token.end + 1 // drop the separating space too
  }
  rest += text.slice(cursor)
  return { filters, rest }
}
