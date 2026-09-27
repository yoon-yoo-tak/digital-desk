// Link titles (ARCHITECTURE §6.4). The only network request the app makes, and it can be turned off.

import { isFetchableUrl, requestPublicPage } from './publicHttp'
export { isFetchableUrl } from './publicHttp'

const TIMEOUT_MS = 3000
const MAX_REDIRECTS = 3
const REDIRECTS = new Set([301, 302, 303, 307, 308])

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/giu, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : m
    }
    return ENTITIES[code.toLowerCase()] ?? m
  })
}

/** Prefer og:title, then <title>. Collapses whitespace. */
export function extractTitle(html: string): string | null {
  const og =
    /<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']+)["']/iu.exec(html) ??
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:title["']/iu.exec(html)
  const raw = og?.[1] ?? /<title[^>]*>([\s\S]*?)<\/title>/iu.exec(html)?.[1]
  if (!raw) return null
  const title = decodeEntities(raw).replace(/\s+/gu, ' ').trim()
  return title ? title.slice(0, 200) : null
}

export async function fetchLinkTitle(url: string, requestPage = requestPublicPage): Promise<string | null> {
  if (!isFetchableUrl(url)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let current = new URL(url)
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (controller.signal.aborted || !isFetchableUrl(current.href)) return null
      const page = await requestPage(current, controller.signal)
      if (REDIRECTS.has(page.status)) {
        if (!page.location || hop === MAX_REDIRECTS) return null
        current = new URL(page.location, current)
        continue
      }
      return page.status >= 200 && page.status < 300 && page.html ? extractTitle(page.html) : null
    }
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
