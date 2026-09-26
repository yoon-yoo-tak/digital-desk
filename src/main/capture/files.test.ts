import { describe, expect, it } from 'vitest'
import { domainOf, isIgnoredDownload, looksLikeScreenshotName, titleFromOcr } from './files'

describe('looksLikeScreenshotName', () => {
  it.each([
    ['Screenshot 2026-09-26 at 14.03.12.png', true],
    ['Screen Shot 2020-01-01 at 1.00.00 PM.png', true],
    ['스크린샷 2026-09-26 오후 2.03.12.png', true],
    ['Screenshot 2026-09-26 at 14.03.12.pdf', false],
    ['vacation.png', false],
    ['Screenshots.zip', false]
  ])('%s → %s', (name, expected) => {
    expect(looksLikeScreenshotName(name)).toBe(expected)
  })
})

describe('isIgnoredDownload', () => {
  it.each([
    ['report.pdf', false],
    ['Unconfirmed 382910.crdownload', true],
    ['report.pdf.crdownload', true],
    ['report.pdf.download', true],
    ['movie.mp4.part', true],
    ['.DS_Store', true],
    ['.com.google.Chrome.x1', true],
    ['archive.tar.gz', false]
  ])('%s → %s', (name, expected) => {
    expect(isIgnoredDownload(name)).toBe(expected)
  })
})

describe('domainOf', () => {
  it('reads the host of a where-from URL', () => {
    expect(domainOf('https://www.Redis.io/docs/guide.pdf')).toBe('redis.io')
    expect(domainOf('http://localhost:8765/a.pdf')).toBe('localhost')
    expect(domainOf('not a url')).toBeNull()
    expect(domainOf(null)).toBeNull()
  })
})

describe('titleFromOcr (ARCHITECTURE §6.5)', () => {
  it('prefers an exception class name', () => {
    expect(
      titleFromOcr([
        'Run: OrderApiApplication',
        '14:02:58.904 ERROR 48213 --- [main] o.s.boot.SpringApplication',
        'org.springframework.data.redis.RedisConnectionFailureException: Unable to connect to Redis'
      ])
    ).toBe('RedisConnectionFailureException')
  })

  it('falls back to a line with an error word, Korean included', () => {
    expect(titleFromOcr(['메뉴', '결제 모듈 연결 오류 발생', '확인'])).toBe('결제 모듈 연결 오류 발생')
    expect(titleFromOcr(['OK', 'Build Failed: 3 tests', 'x'])).toBe('Build Failed: 3 tests')
  })

  it('then takes the first word-like line of sensible length', () => {
    expect(titleFromOcr(['12:30', '===', 'Quarterly planning notes', 'more'])).toBe('Quarterly planning notes')
  })

  it('returns null when nothing fits', () => {
    expect(titleFromOcr(['1', '2', '— —'])).toBeNull()
    expect(titleFromOcr([])).toBeNull()
  })
})
