import { describe, expect, it } from 'vitest'
import { looksLikeCode, normalizeText, parseLink, textHash, textTitle, truncateUtf8 } from './classify'

describe('normalizeText / textHash', () => {
  it('ignores line endings and trailing whitespace', () => {
    expect(normalizeText('  a  \r\nb\t\r\n\n')).toBe('a\nb')
    expect(textHash('hello\r\nworld  ')).toBe(textHash('hello\nworld'))
    expect(textHash('hello')).not.toBe(textHash('Hello'))
  })
})

describe('parseLink', () => {
  it('accepts a single http(s) URL', () => {
    expect(parseLink('  https://www.Redis.io/docs/  ')).toEqual({ url: 'https://www.redis.io/docs/', domain: 'redis.io' })
    expect(parseLink('http://localhost:3000/a')).toEqual({ url: 'http://localhost:3000/a', domain: 'localhost' })
  })
  it('rejects text that merely contains a URL', () => {
    expect(parseLink('see https://redis.io')).toBeNull()
    expect(parseLink('https://redis.io and more')).toBeNull()
    expect(parseLink('ftp://x.y')).toBeNull()
    expect(parseLink('redis.io')).toBeNull()
  })
})

describe('textTitle', () => {
  it('takes the first non-empty line', () => {
    expect(textTitle('\n\n  SELECT * FROM employee  \nWHERE 1')).toBe('SELECT * FROM employee')
    expect(textTitle('   ')).toBeNull()
    expect(textTitle('x'.repeat(200), 10)).toBe('xxxxxxxxx…')
  })
})

describe('looksLikeCode', () => {
  it.each([
    ['org.springframework.data.redis.RedisConnectionFailureException: Unable to connect', true],
    ['spring.data.redis.timeout: 5s', true],
    ['SELECT * FROM employee WHERE dept_id = 3;', true],
    ['const a = f(b);', true],
    ['function x() {\n  return 1\n}', true],
    ['Meeting notes for Tuesday', false],
    ['내일 3시에 회의 (본관)', false],
    ['Redis timeout and connection errors', false]
  ])('%s → %s', (text, expected) => {
    expect(looksLikeCode(text)).toBe(expected)
  })
})

describe('truncateUtf8', () => {
  it('keeps short text as is', () => {
    expect(truncateUtf8('abc', 10)).toEqual({ text: 'abc', truncated: false })
  })
  it('never splits a multi-byte character', () => {
    const { text, truncated } = truncateUtf8('에러에러', 7) // 3 bytes per syllable
    expect(truncated).toBe(true)
    expect(text).toBe('에러')
  })
})
