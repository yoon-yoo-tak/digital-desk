// Pure helpers that decide what a piece of clipboard content is (ARCHITECTURE §6.1).

import { createHash } from 'node:crypto'

/** Clipboard text beyond this is cut before storage. */
export const MAX_TEXT_BYTES = 200 * 1024

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/u, ''))
    .join('\n')
    .trim()
}

export function sha256(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

export function textHash(text: string): string {
  return sha256('text:' + normalizeText(text))
}

export function fileHash(path: string): string {
  return sha256('file:' + path)
}

export interface ParsedLink {
  url: string
  domain: string
}

/** A copied string is a link only if it is exactly one http(s) URL with no whitespace. */
export function parseLink(text: string): ParsedLink | null {
  const candidate = text.trim()
  if (!/^https?:\/\/\S+$/iu.test(candidate)) return null
  try {
    const url = new URL(candidate)
    if (!url.hostname) return null
    return { url: url.href, domain: url.hostname.replace(/^www\./, '').toLowerCase() }
  } catch {
    return null
  }
}

/** First non-empty line, capped. */
export function textTitle(text: string, max = 120): string | null {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  if (!line) return null
  return line.length > max ? line.slice(0, max - 1) + '…' : line
}

// Brackets count once per pair so prose like "회의 (본관)" stays prose.
const CODE_PUNCTUATION = ['{}', ';', '=', '()', '<>', '$']
const SQL_START = /^(select|insert|update|delete|create|alter|drop|with)\b/iu
const DOTTED_IDENTIFIER = /^[\w$]+([._][\w$]+){2,}/u

/** Heuristic from DESIGN §3: does this text read as code (render in mono)? */
export function looksLikeCode(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const lines = trimmed.split('\n')
  if (lines.length > 1 && lines.some((l) => /^( {2,}|\t)\S/u.test(l))) return true
  if (SQL_START.test(trimmed)) return true
  const firstToken = trimmed.split(/\s/u)[0] ?? ''
  if (DOTTED_IDENTIFIER.test(firstToken)) return true
  const punctuationKinds = CODE_PUNCTUATION.filter((group) => [...group].some((c) => trimmed.includes(c))).length
  return punctuationKinds >= 2
}

/** Cut text to at most `maxBytes` UTF-8 bytes without splitting a character. */
export function truncateUtf8(text: string, maxBytes = MAX_TEXT_BYTES): { text: string; truncated: boolean } {
  const bytes = Buffer.from(text, 'utf8')
  if (bytes.length <= maxBytes) return { text, truncated: false }
  let cut = bytes.subarray(0, maxBytes).toString('utf8')
  // A split multi-byte sequence decodes to U+FFFD at the end; drop it.
  cut = cut.replace(/�+$/u, '')
  return { text: cut, truncated: true }
}
