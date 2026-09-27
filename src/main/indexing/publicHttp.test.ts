import { lookup } from 'node:dns/promises'
import type { LookupAddress } from 'node:dns'
import { EventEmitter } from 'node:events'
import { request as httpRequest, type ClientRequest, type IncomingMessage, type RequestOptions } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLinkTitle } from './linkTitle'
import { isFetchableUrl, MAX_TITLE_BYTES, publicLookup, requestPublicPage } from './publicHttp'

vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
vi.mock('node:http', () => ({ request: vi.fn() }))
vi.mock('node:https', () => ({ request: vi.fn() }))

const lookupAll = vi.mocked(lookup as (host: string, options: { family: 4; all: true }) => Promise<LookupAddress[]>)

interface Fixture {
  status?: number
  headers?: Record<string, string | undefined>
  body?: string | null
}
let fixtures: Fixture[]
let connections: { host: string; address: string }[]
let responses: PassThrough[]
let optionsSeen: RequestOptions[]

/** Model the socket lookup contract, without contacting DNS, the internet or local services. */
function fakeRequest(url: URL, options: RequestOptions, callback: (res: IncomingMessage) => void): ClientRequest {
  optionsSeen.push(options)
  const req = new EventEmitter() as ClientRequest
  req.end = (() => {
    options.signal?.addEventListener('abort', () => req.emit('error', new Error('aborted')), { once: true })
    options.lookup!(url.hostname, { family: 4 }, (error, address) => {
      if (error) { req.emit('error', error); return }
      if (options.signal?.aborted) return
      connections.push({ host: url.hostname, address: address as string })
      const fixture = fixtures.shift() ?? {}
      const stream = new PassThrough()
      responses.push(stream)
      const res = Object.assign(stream, {
        statusCode: fixture.status ?? 200,
        headers: fixture.headers ?? { 'content-type': 'text/html' }
      }) as unknown as IncomingMessage
      callback(res)
      if (fixture.body !== null && !stream.destroyed) stream.end(fixture.body ?? '<title>Public title</title>')
    })
    return req
  }) as ClientRequest['end']
  return req
}

beforeEach(() => {
  vi.clearAllMocks()
  fixtures = []
  connections = []
  responses = []
  optionsSeen = []
  lookupAll.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
  vi.mocked(httpRequest).mockImplementation(fakeRequest as typeof httpRequest)
  vi.mocked(httpsRequest).mockImplementation(fakeRequest as typeof httpsRequest)
})
afterEach(() => vi.useRealTimers())

describe('public-only title requests', () => {
  it.each([
    '0.0.0.0', '10.1.2.3', '100.64.0.1', '127.0.0.1', '169.254.169.254', '172.16.0.1',
    '192.168.1.1', '192.0.0.1', '192.0.2.1', '198.18.0.1', '198.51.100.1', '203.0.113.1',
    '224.0.0.1', '255.255.255.255', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1'
  ])('rejects DNS answer %s before connecting', async (address) => {
    lookupAll.mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }])
    expect(await fetchLinkTitle('https://public.example/page')).toBeNull()
    expect(connections).toEqual([])
  })

  it.each([
    'http://127.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://localhost./',
    'http://machine.local./', 'http://router.home.arpa/', 'http://[::ffff:127.0.0.1]/'
  ])('rejects alternate local URL spelling %s', async (url) => {
    expect(isFetchableUrl(url)).toBe(false)
    expect(await fetchLinkTitle(url)).toBeNull()
    expect(httpRequest).not.toHaveBeenCalled()
    expect(httpsRequest).not.toHaveBeenCalled()
  })

  it('rejects mixed public/private answers, DNS failure and empty answers', async () => {
    lookupAll.mockResolvedValueOnce([
      { address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }
    ]).mockRejectedValueOnce(new Error('DNS unavailable')).mockResolvedValueOnce([])
    for (let i = 0; i < 3; i++) expect(await fetchLinkTitle('https://public.example/')).toBeNull()
    expect(connections).toEqual([])
  })

  it('pins the checked answer instead of doing another DNS lookup for the connection', async () => {
    lookupAll
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValue([{ address: '127.0.0.1', family: 4 }])
    expect(await fetchLinkTitle('https://public.example/path')).toBe('Public title')
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(connections).toEqual([{ host: 'public.example', address: '93.184.216.34' }])
    expect(optionsSeen[0]).toMatchObject({ agent: false, family: 4, lookup: publicLookup })
    expect(httpsRequest).toHaveBeenCalledWith(new URL('https://public.example/path'), expect.any(Object), expect.any(Function))
  })

  it('checks DNS again on a same-host redirect, rejecting a rebound private answer', async () => {
    fixtures.push({ status: 302, headers: { location: '/next' } })
    lookupAll
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }])
      .mockResolvedValueOnce([{ address: '192.168.1.1', family: 4 }])
    expect(await fetchLinkTitle('https://public.example/')).toBeNull()
    expect(connections).toHaveLength(1)
    expect(responses[0]?.destroyed).toBe(true)
  })

  it.each(['http://127.0.0.1/', 'http://router.local/', 'file:///etc/passwd', 'https://user:secret@example.com/'])(
    'does not follow redirects to %s', async (destination) => {
      fixtures.push({ status: 302, headers: { location: destination } })
      expect(await fetchLinkTitle('https://public.example/')).toBeNull()
      expect(connections).toHaveLength(1)
      expect(httpsRequest).toHaveBeenCalledTimes(1)
      expect(httpRequest).not.toHaveBeenCalled()
    }
  )

  it('follows relative public redirects with a fresh validated socket', async () => {
    fixtures.push({ status: 301, headers: { location: '/docs' } }, { body: '<title>Documentation</title>' })
    expect(await fetchLinkTitle('https://public.example/')).toBe('Documentation')
    expect(lookup).toHaveBeenCalledTimes(2)
    expect(httpsRequest).toHaveBeenLastCalledWith(new URL('https://public.example/docs'), expect.any(Object), expect.any(Function))
    expect(optionsSeen[0]?.signal).toBe(optionsSeen[1]?.signal)
  })

  it('limits redirect loops to three hops', async () => {
    fixtures = Array.from({ length: 5 }, () => ({ status: 302, headers: { location: '/' } }))
    expect(await fetchLinkTitle('https://public.example/')).toBeNull()
    expect(connections).toHaveLength(4)
  })

  it('caps the response body even when one chunk exceeds 64 KiB', async () => {
    fixtures.push({ body: 'x'.repeat(MAX_TITLE_BYTES) + '<title>Outside limit</title>' })
    const result = await requestPublicPage(new URL('https://public.example/'), new AbortController().signal)
    expect(Buffer.byteLength(result.html!)).toBe(MAX_TITLE_BYTES)
    expect(result.html).not.toContain('Outside limit')
    expect(responses[0]?.destroyed).toBe(true)
  })

  it.each([
    { status: 500 },
    { headers: { 'content-type': 'application/pdf' } },
    { headers: { 'content-type': 'text/html', 'content-encoding': 'gzip' } }
  ])('closes unsuccessful or unsupported responses', async (fixture) => {
    fixtures.push(fixture)
    expect(await fetchLinkTitle('https://public.example/')).toBeNull()
    expect(responses[0]?.destroyed).toBe(true)
  })

  it('aborts stalled responses after a total of three seconds', async () => {
    vi.useFakeTimers()
    fixtures.push({ body: null })
    const result = fetchLinkTitle('https://public.example/')
    await vi.advanceTimersByTimeAsync(3000)
    expect(await result).toBeNull()
    expect(optionsSeen[0]?.signal?.aborted).toBe(true)
  })

  it('returns only checked addresses when a socket requests all answers', async () => {
    const callback = vi.fn()
    publicLookup('public.example', { all: true }, callback)
    await vi.waitFor(() => expect(callback).toHaveBeenCalledWith(null, [{ address: '93.184.216.34', family: 4 }]))
  })
})
