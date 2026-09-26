import { describe, expect, it } from 'vitest'
import { extractTitle, isFetchableUrl } from './linkTitle'

describe('isFetchableUrl', () => {
  it.each([
    ['https://redis.io/docs/', true],
    ['http://stackoverflow.com/q/1', true],
    ['https://8.8.8.8/', true],
    ['http://localhost:3000/', false],
    ['http://localhost/', false],
    ['http://my-nas.local/', false],
    ['http://intranet/', false],
    ['http://192.168.0.10/', false],
    ['http://10.0.3.21/admin', false],
    ['http://172.20.1.1/', false],
    ['http://127.0.0.1/', false],
    ['http://[::1]/', false],
    ['https://user:pass@example.com/', false],
    ['https://example.com:8443/', false],
    ['file:///etc/passwd', false],
    ['not a url', false]
  ])('%s → %s', (url, expected) => {
    expect(isFetchableUrl(url)).toBe(expected)
  })
})

describe('extractTitle', () => {
  it('prefers og:title and decodes entities', () => {
    const html = `<head><title>Fallback</title><meta property="og:title" content="Redis timeout &amp; connection errors"></head>`
    expect(extractTitle(html)).toBe('Redis timeout & connection errors')
  })
  it('reads <title> and collapses whitespace', () => {
    expect(extractTitle('<title>\n  Lettuce:  connection refused &#8212; Stack Overflow\n</title>')).toBe(
      'Lettuce: connection refused — Stack Overflow'
    )
  })
  it('returns null without a title', () => {
    expect(extractTitle('<html><body>hi</body></html>')).toBeNull()
  })
})
