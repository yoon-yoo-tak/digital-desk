// Demo data, dated relative to `now` so "지난주" always finds the Redis scenario (ROADMAP M2).
// Pure: no Electron, no files. `runSeed.ts` turns it into rows, demo files and thumbnails.

import type { ItemMetadata } from '@shared/types'
import { looksLikeCode } from '../capture/classify'
import type { NewItem } from '../storage/itemsRepo'

export interface DemoItem extends NewItem {
  /** A file from resources/demo copied to <userData>/demo-files/<folder>/<fileName>. */
  demoFile?: { asset: string; folder: 'Desktop' | 'Downloads' }
  /** A PNG from resources/demo stored as a clipboard image. */
  clipboardImage?: string
  pinned?: boolean
  /** Extra copies of the same content (bumps use_count / last_used_at). */
  touches?: number[]
}

const MIN = 60_000
const DAY = 24 * 60 * MIN

const apps = {
  intellij: { sourceApp: 'IntelliJ IDEA', sourceBundleId: 'com.jetbrains.intellij' },
  chrome: { sourceApp: 'Google Chrome', sourceBundleId: 'com.google.Chrome' },
  safari: { sourceApp: 'Safari', sourceBundleId: 'com.apple.Safari' },
  slack: { sourceApp: 'Slack', sourceBundleId: 'com.tinyspeck.slackmacgap' },
  notion: { sourceApp: 'Notion', sourceBundleId: 'notion.id' },
  figma: { sourceApp: 'Figma', sourceBundleId: 'com.figma.Desktop' },
  terminal: { sourceApp: 'Terminal', sourceBundleId: 'com.apple.Terminal' },
  vscode: { sourceApp: 'Visual Studio Code', sourceBundleId: 'com.microsoft.VSCode' },
  kakao: { sourceApp: '카카오톡', sourceBundleId: 'com.kakao.KakaoTalkMac' },
  notes: { sourceApp: '메모', sourceBundleId: 'com.apple.Notes' },
  finder: { sourceApp: 'Finder', sourceBundleId: 'com.apple.finder' }
} as const

/** Monday 00:00 of the week before `now`'s week, plus `dayIndex` days (0 = Monday). */
export function lastWeekDay(now: Date, dayIndex: number, hour: number, minute: number, second = 0): number {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const mondayThisWeek = new Date(day.getFullYear(), day.getMonth(), day.getDate() - ((day.getDay() + 6) % 7))
  return new Date(
    mondayThisWeek.getFullYear(),
    mondayThisWeek.getMonth(),
    mondayThisWeek.getDate() - 7 + dayIndex,
    hour,
    minute,
    second
  ).getTime()
}

function daysAgoAt(now: Date, days: number, hour: number, minute: number): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days, hour, minute).getTime()
}

function screenshotName(at: number): string {
  const d = new Date(at)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `Screenshot ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} at ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}.png`
}

const text = (capturedAt: number, value: string, app: keyof typeof apps, extra: Partial<DemoItem> = {}): DemoItem => ({
  type: 'text',
  title: value.split('\n')[0]?.trim().slice(0, 120) ?? null,
  text: value,
  capturedAt,
  ...apps[app],
  metadata: { mono: looksLikeCode(value) },
  ...extra
})

const link = (capturedAt: number, url: string, title: string, app: keyof typeof apps, extra: Partial<DemoItem> = {}): DemoItem => ({
  type: 'link',
  url,
  text: url,
  domain: new URL(url).hostname.replace(/^www\./u, ''),
  title,
  capturedAt,
  ...apps[app],
  ...extra
})

const REDIS_DOCS = 'https://redis.io/docs/latest/operate/oss_and_stack/management/troubleshooting/'

/** What OCR would read off the error screenshot (resources/demo/redis-error.png). */
export const REDIS_STACK_TRACE = [
  '14:02:58.904 ERROR 48213 --- [main] o.s.boot.SpringApplication : Application run failed',
  'org.springframework.data.redis.RedisConnectionFailureException: Unable to connect to Redis',
  '    at o.s.d.r.c.lettuce.LettuceConnectionFactory$ExceptionTranslatingConnectionProvider.translateException',
  '    at o.s.d.r.c.lettuce.LettuceConnectionFactory.getConnection(LettuceConnectionFactory.java:1604)',
  'Caused by: io.lettuce.core.RedisConnectionException: Unable to connect to localhost/127.0.0.1:6379',
  '    at io.lettuce.core.RedisConnectionException.create(RedisConnectionException.java:78)',
  'Caused by: java.net.ConnectException: Connection refused'
].join('\n')

/** The ALEN CUP demo story: last week's Thursday, 14:03–14:16 (PRODUCT §19, §43). */
export function redisScenario(now: Date): DemoItem[] {
  const thu = (h: number, m: number, s = 0): number => lastWeekDay(now, 3, h, m, s)
  const shotAt = thu(14, 3, 12)
  const ymlAt = thu(14, 10, 41)
  return [
    {
      type: 'screenshot',
      title: 'RedisConnectionFailureException',
      fileName: screenshotName(shotAt),
      capturedAt: shotAt,
      ocrText: REDIS_STACK_TRACE,
      ocrStatus: 'done',
      ...apps.intellij,
      demoFile: { asset: 'redis-error.png', folder: 'Desktop' }
    },
    text(
      thu(14, 5),
      'org.springframework.data.redis.RedisConnectionFailureException: Unable to connect to Redis',
      'intellij'
    ),
    link(
      thu(14, 7),
      REDIS_DOCS,
      'Redis timeout and connection errors',
      'chrome'
    ),
    {
      type: 'screenshot',
      title: 'application.yml — spring.data.redis.host',
      fileName: screenshotName(ymlAt),
      capturedAt: ymlAt,
      ocrText: 'spring:\n  data:\n    redis:\n      host: localhost\n      port: 6379\n      timeout: 2s',
      ocrStatus: 'done',
      ...apps.intellij,
      demoFile: { asset: 'application-yml.png', folder: 'Desktop' }
    },
    {
      type: 'file',
      title: 'redis-troubleshooting-guide.pdf',
      fileName: 'redis-troubleshooting-guide.pdf',
      capturedAt: thu(14, 12),
      url: REDIS_DOCS,
      domain: 'redis.io',
      ...apps.chrome,
      demoFile: { asset: 'redis-troubleshooting-guide.pdf', folder: 'Downloads' }
    },
    text(thu(14, 16), 'spring.data.redis.timeout: 5s', 'intellij')
  ]
}

/** Everyday items spread over the last few weeks so the Inbox and search look lived-in. */
export function fillerItems(now: Date): DemoItem[] {
  const t = now.getTime()
  const ago = (days: number, h: number, m: number): number => daysAgoAt(now, days, h, m)
  const lw = (dayIndex: number, h: number, m: number): number => lastWeekDay(now, dayIndex, h, m)
  return [
    // Today (relative to now so nothing lands in the future)
    { type: 'file', title: 'ALEN_CUP.pdf', fileName: 'ALEN_CUP.pdf', capturedAt: t - 190 * MIN, ...apps.chrome, pinned: true, demoFile: { asset: 'alen-cup.pdf', folder: 'Downloads' } },
    link(t - 150 * MIN, 'https://redis.io/docs/latest/develop/reference/eviction/', 'Redis eviction policies', 'chrome'),
    text(t - 100 * MIN, 'SELECT * FROM employee WHERE dept_id = 3;', 'intellij', { touches: [t - 60 * MIN, t - 11 * MIN] }),
    text(t - 70 * MIN, '내일 오후 3시 발표 리허설 — 3층 회의실', 'kakao'),
    { type: 'image', capturedAt: t - 40 * MIN, ...apps.figma, clipboardImage: 'figma-frame.png' },
    link(t - 25 * MIN, 'https://www.electronjs.org/docs/latest/api/tray', 'Tray | Electron', 'chrome'),
    // This week
    text(ago(1, 18, 20), 'git rebase -i HEAD~3', 'terminal'),
    link(ago(1, 16, 5), 'https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API', 'Clipboard API - Web APIs | MDN', 'chrome'),
    text(ago(1, 11, 40), '회의록: 캐시 서버 이전 일정은 다음 주 수요일로 확정', 'notion'),
    text(ago(2, 17, 12), 'kubectl logs deploy/order-api --since=1h | grep -i timeout', 'terminal'),
    link(ago(2, 14, 30), 'https://developer.apple.com/design/resources/', 'Apple Design Resources', 'safari', { pinned: true }),
    text(ago(2, 10, 3), '다음 스프린트 목표: 검색 속도 50ms 이하', 'slack'),
    { type: 'file', title: '2026 연말정산 안내.pdf', fileName: '2026 연말정산 안내.pdf', capturedAt: ago(3, 9, 30), ...apps.chrome, pinned: true, demoFile: { asset: 'tax-guide.pdf', folder: 'Downloads' } },
    text(ago(3, 15, 44), 'export const TIMEOUT_MS = 3000', 'vscode'),
    link(ago(3, 16, 2), 'https://stackoverflow.com/search?q=node+read+file+line+by+line', 'node read file line by line - Stack Overflow', 'chrome'),
    text(ago(4, 13, 15), 'ssh -i ~/.ssh/dev.pem ubuntu@10.0.3.21', 'terminal', { pinned: true }),
    text(ago(4, 9, 58), '제주 항공권 예약번호 K7Q2ZP', 'kakao'),
    // Last week (besides the Redis scenario)
    link(lw(1, 10, 41), 'https://stackoverflow.com/search?q=lettuce+connection+refused+6379', 'Lettuce: connection refused on 6379 (Redis)', 'chrome'),
    text(lw(0, 9, 12), '회의록: 결제 모듈 장애 회고 — 원인은 커넥션 풀 고갈', 'notion'),
    text(lw(0, 11, 3), 'docker run -d -p 6379:6379 redis:7', 'terminal'),
    link(lw(2, 15, 20), 'https://spring.io/guides/gs/messaging-redis/', 'Getting Started | Messaging with Redis', 'chrome'),
    text(lw(2, 16, 45), 'const cache = new Map<string, Promise<Response>>()', 'vscode'),
    { type: 'image', capturedAt: lw(4, 11, 20), ...apps.slack, clipboardImage: 'latency-chart.png' },
    text(lw(4, 17, 30), 'ALEN CUP 제출 체크리스트: 데모 영상, 소개글, 설치 파일', 'notion'),
    text(lw(5, 13, 0), '주말 장보기: 우유, 달걀, 사과, 커피 원두', 'notes'),
    text(lw(6, 21, 10), 'brew install --cask ghostty', 'terminal'),
    // Two weeks ago and earlier
    link(ago(15, 10, 12), 'https://www.electronjs.org/docs/latest/api/clipboard', 'clipboard | Electron', 'chrome'),
    text(ago(15, 14, 22), 'CREATE VIRTUAL TABLE items_fts USING fts5(title, text, tokenize = \'trigram\')', 'intellij'),
    link(ago(16, 9, 45), 'https://sqlite.org/fts5.html', 'SQLite FTS5 Extension', 'safari'),
    text(ago(16, 18, 3), '로그인 권한 오류: 403 Forbidden (관리자 계정으로 재시도)', 'slack'),
    text(ago(17, 11, 30), 'PRODUCT §43 데모 시나리오 초안 공유드립니다', 'slack'),
    link(ago(18, 15, 5), 'https://developer.apple.com/documentation/vision/recognizing-text-in-images', 'Recognizing Text in Images | Apple Developer', 'safari'),
    text(ago(19, 10, 10), 'npm create @quick-start/electron@latest', 'terminal'),
    text(ago(20, 16, 40), 'Q3 OKR: 온보딩 전환율 40% → 55%', 'notion'),
    link(ago(21, 13, 12), 'https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md', 'better-sqlite3 API docs', 'chrome'),
    text(ago(22, 9, 5), 'server.port=8081', 'intellij'),
    text(ago(23, 14, 50), '메모리 사용량 1.2GB → 380MB (이미지 캐시 제거 후)', 'slack'),
    link(ago(24, 11, 0), 'https://www.raycast.com/blog', 'Raycast Blog', 'safari'),
    text(ago(25, 17, 25), 'git stash push -m "wip: quick search"', 'terminal'),
    text(ago(26, 10, 0), '연결 타임아웃 늘리기: spring.datasource.hikari.connection-timeout=30000', 'intellij'),
    link(ago(27, 15, 35), 'https://en.wikipedia.org/wiki/Trigram', 'Trigram - Wikipedia', 'chrome'),
    text(ago(28, 12, 12), '점심: 을지로 평양냉면 12:30', 'kakao'),
    text(ago(29, 9, 40), 'feat: add desk-helper pasteboard watcher', 'terminal')
  ]
}

// ── Bulk data for the search benchmark (--count N) ────────────────────────

const WORDS = [
  'redis', 'connection', 'timeout', 'error', 'exception', 'spring', 'config', 'server', 'client', 'cache',
  'docker', 'kubernetes', 'ingress', 'deploy', 'build', 'test', 'login', 'permission', 'memory', 'query',
  '에러', '오류', '연결', '서버', '설정', '배포', '회의', '일정', '결제', '검색', '데이터', '캐시', '로그',
  'github', 'figma', 'design', 'review', 'release', 'invoice', 'report', 'meeting', 'draft', 'upload'
]
const DOMAINS = ['github.com', 'stackoverflow.com', 'redis.io', 'developer.mozilla.org', 'notion.so', 'figma.com']
const APP_KEYS = Object.keys(apps) as (keyof typeof apps)[]

/** Deterministic PRNG so benchmark data is the same every run. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function bulkItems(now: Date, count: number, seed = 42): DemoItem[] {
  const rand = mulberry32(seed)
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T
  const phrase = (n: number): string => Array.from({ length: n }, () => pick(WORDS)).join(' ')
  const items: DemoItem[] = []
  for (let i = 0; i < count; i++) {
    const capturedAt = now.getTime() - Math.floor(rand() * 180 * DAY) - MIN
    const app = pick(APP_KEYS)
    const roll = rand()
    if (roll < 0.55) {
      items.push(text(capturedAt, `${phrase(4 + Math.floor(rand() * 12))} #${i}`, app))
    } else if (roll < 0.8) {
      const domain = pick(DOMAINS)
      items.push(link(capturedAt, `https://${domain}/${pick(WORDS)}/${i}`, `${phrase(3 + Math.floor(rand() * 5))}`, app))
    } else if (roll < 0.92) {
      const name = `${pick(WORDS)}-${pick(WORDS)}-${i}.pdf`
      items.push({ type: 'file', title: name, fileName: name, filePath: `/Users/demo/Downloads/${name}`, capturedAt, ...apps[app], metadata: { missing: true } as ItemMetadata })
    } else {
      items.push({
        type: 'screenshot',
        title: phrase(2),
        fileName: `${screenshotName(capturedAt)}`,
        filePath: `/Users/demo/Desktop/${screenshotName(capturedAt)}`,
        ocrText: Array.from({ length: 4 + Math.floor(rand() * 8) }, () => phrase(6)).join('\n'),
        ocrStatus: 'done',
        capturedAt,
        ...apps[app],
        metadata: { missing: true }
      })
    }
  }
  return items
}

export function buildDemoItems(now: Date, opts: { count?: number } = {}): DemoItem[] {
  return [...redisScenario(now), ...fillerItems(now), ...(opts.count ? bulkItems(now, opts.count) : [])]
}
