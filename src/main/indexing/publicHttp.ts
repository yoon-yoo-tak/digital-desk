// Title requests use a fresh socket and validate DNS inside its lookup, preventing a second lookup
// from rebinding a checked public hostname to a private address. IPv6-only hosts are skipped.
import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'

export const MAX_TITLE_BYTES = 64 * 1024
const blocked = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) blocked.addSubnet(address, prefix, 'ipv4')

export function isPublicIPv4(address: string): boolean {
  return isIP(address) === 4 && !blocked.check(address, 'ipv4')
}

/** Preliminary URL check. Hostnames still need the socket-time DNS check below. */
export function isFetchableUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return false
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/u, '')
    if (isIP(host)) return isPublicIPv4(host)
    if (!host.includes('.')) return false
    return !['localhost', 'local', 'internal', 'home.arpa'].some((suffix) => host === suffix || host.endsWith(`.${suffix}`))
  } catch {
    return false
  }
}

/** Only the checked IPv4 answer(s) can be passed to the socket; there is no subsequent DNS lookup. */
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  void lookup(hostname, { family: 4, all: true }).then((addresses) => {
    if (addresses.length === 0 || addresses.some((entry) => !isPublicIPv4(entry.address))) {
      callback(new Error('Non-public title destination'), '')
      return
    }
    if (options.all) callback(null, addresses)
    else callback(null, addresses[0]!.address, 4)
  }, (error: Error) => callback(error, ''))
}

export interface TitlePage {
  status: number
  location?: string
  html: string | null
}

/** One GET only. Node's request API never follows redirects; the caller validates every next URL. */
export function requestPublicPage(url: URL, signal: AbortSignal): Promise<TitlePage> {
  if (!isFetchableUrl(url.href)) return Promise.reject(new Error('Non-public title URL'))
  return new Promise((resolve, reject) => {
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest
    const req = request(url, {
      method: 'GET',
      agent: false,
      family: 4,
      lookup: publicLookup,
      signal,
      maxHeaderSize: 16 * 1024,
      headers: { Accept: 'text/html', 'Accept-Encoding': 'identity' }
    }, (res) => {
      res.on('error', reject)
      const status = res.statusCode ?? 0
      const page: TitlePage = { status, location: res.headers.location, html: null }
      if (status < 200 || status >= 300 || !res.headers['content-type']?.toLowerCase().includes('html') ||
          (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')) {
        resolve(page)
        res.destroy()
        return
      }
      const chunks: Buffer[] = []
      let received = 0
      const finish = (): void => {
        resolve({ ...page, html: Buffer.concat(chunks).toString('utf8') })
      }
      res.on('data', (chunk: Buffer) => {
        const part = chunk.subarray(0, MAX_TITLE_BYTES - received)
        chunks.push(part)
        received += part.length
        if (received >= MAX_TITLE_BYTES) {
          finish()
          res.destroy()
        }
      })
      res.on('end', finish)
    })
    req.on('error', reject)
    req.end()
  })
}
