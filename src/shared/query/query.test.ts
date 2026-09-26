import { describe, expect, it } from 'vitest'
import { findDateExpression } from './dateExpressions'
import { parseFilterToken, serializeFilter, takeCompletedFilters, tokenize } from './filters'
import { highlightRanges, splitHighlights } from './highlight'
import { parseQuery, termGroups } from './parseQuery'
import { expandTerm } from './synonyms'

// Saturday, Sep 26 2026, 15:00 local
const now = new Date(2026, 8, 26, 15, 0)
const d = (m: number, day: number): number => new Date(2026, m - 1, day).getTime()

describe('date expressions (now = Sat 2026-09-26)', () => {
  it.each([
    ['오늘', d(9, 26), d(9, 27), 'Today · Sep 26'],
    ['today', d(9, 26), d(9, 27), 'Today · Sep 26'],
    ['어제', d(9, 25), d(9, 26), 'Yesterday · Sep 25'],
    ['yesterday', d(9, 25), d(9, 26), 'Yesterday · Sep 25'],
    ['그제', d(9, 24), d(9, 25), 'Day before yesterday · Sep 24'],
    ['그저께', d(9, 24), d(9, 25), 'Day before yesterday · Sep 24'],
    ['day before yesterday', d(9, 24), d(9, 25), 'Day before yesterday · Sep 24'],
    ['이번주', d(9, 21), d(9, 28), 'This week · Sep 21 – 27'],
    ['이번 주', d(9, 21), d(9, 28), 'This week · Sep 21 – 27'],
    ['this week', d(9, 21), d(9, 28), 'This week · Sep 21 – 27'],
    ['지난주', d(9, 14), d(9, 21), 'Last week · Sep 14 – 20'],
    ['지난 주', d(9, 14), d(9, 21), 'Last week · Sep 14 – 20'],
    ['저번주', d(9, 14), d(9, 21), 'Last week · Sep 14 – 20'],
    ['last week', d(9, 14), d(9, 21), 'Last week · Sep 14 – 20'],
    ['last-week', d(9, 14), d(9, 21), 'Last week · Sep 14 – 20'],
    ['Last Week', d(9, 14), d(9, 21), 'Last week · Sep 14 – 20'],
    ['이번달', d(9, 1), d(10, 1), 'This month · September'],
    ['this month', d(9, 1), d(10, 1), 'This month · September'],
    ['지난달', d(8, 1), d(9, 1), 'Last month · August'],
    ['지난 달', d(8, 1), d(9, 1), 'Last month · August'],
    ['last month', d(8, 1), d(9, 1), 'Last month · August']
  ])('%s', (input, from, to, label) => {
    expect(findDateExpression(input, now)).toMatchObject({ from, to, label, start: 0, end: input.length })
  })

  it('finds the expression inside a query and swallows a Korean particle', () => {
    expect(findDateExpression('redis 지난주에 본 에러', now)).toMatchObject({ start: 6, end: 10, from: d(9, 14) })
  })

  it('prefers the longest expression at the same position', () => {
    expect(findDateExpression('day before yesterday redis', now)?.label).toBe('Day before yesterday · Sep 24')
  })

  it('needs word boundaries', () => {
    expect(findDateExpression('todays redis', now)).toBeNull()
    expect(findDateExpression('지난주말', now)).toBeNull()
    expect(findDateExpression('lastweek', now)).toBeNull()
  })

  it('labels weeks that cross a month boundary and starts weeks on Monday', () => {
    const monday = new Date(2026, 8, 7, 9, 0) // Mon Sep 7
    expect(findDateExpression('last week', monday)).toMatchObject({
      from: new Date(2026, 7, 31).getTime(),
      label: 'Last week · Aug 31 – Sep 6'
    })
    const sunday = new Date(2026, 8, 27, 23, 0) // Sun Sep 27 belongs to the week of Sep 21
    expect(findDateExpression('this week', sunday)?.from).toBe(d(9, 21))
  })

  it('handles January for last month', () => {
    expect(findDateExpression('지난달', new Date(2026, 0, 10))).toMatchObject({
      from: new Date(2025, 11, 1).getTime(),
      to: new Date(2026, 0, 1).getTime(),
      label: 'Last month · December'
    })
  })
})

describe('filters', () => {
  it('parses type, app and domain tokens', () => {
    expect(parseFilterToken('type:Screenshot')).toEqual({ key: 'type', value: 'screenshot' })
    expect(parseFilterToken('type:스크린샷')).toEqual({ key: 'type', value: 'screenshot' })
    expect(parseFilterToken('app:"IntelliJ IDEA"')).toEqual({ key: 'app', value: 'IntelliJ IDEA' })
    expect(parseFilterToken('domain:www.GitHub.com')).toEqual({ key: 'domain', value: 'github.com' })
    expect(parseFilterToken('type:banana')).toBeNull()
    expect(parseFilterToken('app:')).toBeNull()
  })

  it('keeps quoted values together when tokenizing', () => {
    expect(tokenize('redis app:"IntelliJ IDEA" x').map((t) => t.text)).toEqual(['redis', 'app:"IntelliJ IDEA"', 'x'])
  })

  it('turns only finished filter tokens into chips', () => {
    expect(takeCompletedFilters('type:screenshot app:IntelliJ redis')).toEqual({
      filters: [
        { key: 'type', value: 'screenshot' },
        { key: 'app', value: 'IntelliJ' }
      ],
      rest: 'redis'
    })
    expect(takeCompletedFilters('redis type:screen')).toEqual({ filters: [], rest: 'redis type:screen' })
    expect(takeCompletedFilters('redis type:link ')).toEqual({ filters: [{ key: 'type', value: 'link' }], rest: 'redis ' })
  })

  it('serializes values with spaces in quotes', () => {
    expect(serializeFilter({ key: 'app', value: 'IntelliJ IDEA' })).toBe('app:"IntelliJ IDEA"')
  })
})

describe('parseQuery', () => {
  it('splits the demo query into a date range and terms', () => {
    const parsed = parseQuery('지난주 redis 에러', now)
    expect(parsed.dateRange).toMatchObject({ from: d(9, 14), to: d(9, 21), label: 'Last week · Sep 14 – 20' })
    expect(parsed.terms).toEqual(['redis', '에러'])
    expect(parsed.filters).toEqual({})
  })

  it('reads filters anywhere in the query', () => {
    expect(parseQuery('redis type:screenshot app:IntelliJ', now)).toMatchObject({
      terms: ['redis'],
      filters: { type: 'screenshot', app: 'IntelliJ' }
    })
  })

  it('expands terms through the synonym dictionary', () => {
    expect(termGroups(parseQuery('redis 에러', now))).toEqual([
      ['redis'],
      ['에러', '오류', 'error', 'exception', 'fail']
    ])
  })
})

describe('expandTerm', () => {
  it('maps Korean to English and back', () => {
    expect(expandTerm('Exception')).toContain('에러')
    expect(expandTerm('errors')).toContain('에러')
    expect(expandTerm('연결')).toEqual(['연결', '접속', 'connection', 'connect'])
  })
  it('also tries the word without a Korean particle', () => {
    expect(expandTerm('에러가')).toEqual(expect.arrayContaining(['에러가', '에러', 'exception']))
    expect(expandTerm('데이터를')).toEqual(['데이터를', '데이터'])
    expect(expandTerm('사과')).toEqual(['사과']) // would leave a single syllable
  })
})

describe('highlight', () => {
  it('finds case-insensitive, merged ranges', () => {
    expect(highlightRanges('RedisConnectionFailureException: redis', ['redis', 'exception'])).toEqual([
      [0, 5],
      [22, 31],
      [33, 38]
    ])
    expect(highlightRanges('aaa', ['aa'])).toEqual([[0, 2]])
  })
  it('splits into runs', () => {
    expect(splitHighlights('spring.data.redis.timeout', ['redis'])).toEqual([
      { text: 'spring.data.', match: false },
      { text: 'redis', match: true },
      { text: '.timeout', match: false }
    ])
  })
})
