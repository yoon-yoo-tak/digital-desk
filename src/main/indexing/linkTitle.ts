// Link titles (ARCHITECTURE §6.4). The only network request the app makes, and it can be turned off.

import { isIP } from 'node:net'

const TIMEOUT_MS = 3000
const MAX_BYTES = 64 * 1024

function isPrivateIPv4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split('.').map(Number)
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

/** Only public http(s) hosts on default ports, without credentials, are ever fetched. */
export function isFetchableUrl(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.username || url.password || url.port) return false
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!host.includes('.') && !isIP(host)) return false // "localhost", intranet names
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return false
  }
  const ipVersion = isIP(host)
  if (ipVersion === 4) return !isPrivateIPv4(host)
  if (ipVersion === 6) return false // never fetch IP literals we can't classify cheaply
  return true
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/giu, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
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

type Fetch = (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<Response>

export async function fetchLinkTitle(url: string, fetchImpl: Fetch): Promise<string | null> {
  if (!isFetchableUrl(url)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'text/html' } })
    if (!res.ok || !res.body) return null
    if (!(res.headers.get('content-type') ?? '').includes('html')) return null
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let received = 0
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      received += value.length
    }
    await reader.cancel().catch(() => undefined)
    return extractTitle(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
