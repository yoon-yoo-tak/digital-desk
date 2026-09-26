// Generates the sample files used by `npm run seed` into resources/demo/ (committed).
// Run again only when the demo content changes: node scripts/make-demo-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'resources', 'demo')
mkdirSync(out, { recursive: true })

const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** A dark IDE window with a file tab and monospace lines. */
function ideSvg({ tab, lines, width = 1440, height = 900 }) {
  const rows = lines
    .map(([text, color], i) => {
      const y = 132 + i * 30
      return `<text x="96" y="${y}" fill="#5c6370" font-size="16">${i + 1}</text>
        <text x="140" y="${y}" fill="${color ?? '#abb2bf'}" font-size="18">${esc(text)}</text>`
    })
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Menlo, monospace">
    <rect width="100%" height="100%" fill="#1e2127"/>
    <rect width="100%" height="44" fill="#2b2f36"/>
    <circle cx="24" cy="22" r="7" fill="#ff5f57"/><circle cx="48" cy="22" r="7" fill="#febc2e"/><circle cx="72" cy="22" r="7" fill="#28c840"/>
    <rect x="96" y="52" width="${tab.length * 11 + 40}" height="34" rx="6" fill="#1e2127" stroke="#3a3f4b"/>
    <text x="116" y="75" fill="#d7dae0" font-size="15">${esc(tab)}</text>
    <rect x="0" y="96" width="80" height="${height - 96}" fill="#21252b"/>
    ${rows}
  </svg>`
}

const shots = {
  'redis-error.png': ideSvg({
    tab: 'Run: OrderApiApplication',
    lines: [
      ['  .   ____          _            __ _ _', '#5c6370'],
      [':: Spring Boot ::                (v3.3.4)', '#5c6370'],
      ['14:02:57.311  INFO 48213 --- [main] o.s.b.w.e.tomcat.TomcatWebServer : Tomcat initialized'],
      ['14:02:58.904 ERROR 48213 --- [main] o.s.boot.SpringApplication : Application run failed', '#e06c75'],
      ['org.springframework.data.redis.RedisConnectionFailureException: Unable to connect to Redis', '#e5c07b'],
      ['    at o.s.d.r.c.lettuce.LettuceConnectionFactory$ExceptionTranslatingConnectionProvider.translateException'],
      ['    at o.s.d.r.c.lettuce.LettuceConnectionFactory.getConnection(LettuceConnectionFactory.java:1604)'],
      ['Caused by: io.lettuce.core.RedisConnectionException: Unable to connect to localhost/127.0.0.1:6379', '#e06c75'],
      ['    at io.lettuce.core.RedisConnectionException.create(RedisConnectionException.java:78)'],
      ['Caused by: java.net.ConnectException: Connection refused', '#e06c75'],
      ['    ... 42 common frames omitted', '#5c6370'],
      [''],
      ['Process finished with exit code 1', '#5c6370']
    ]
  }),
  'application-yml.png': ideSvg({
    tab: 'application.yml',
    lines: [
      ['spring:', '#e06c75'],
      ['  application:', '#e06c75'],
      ['    name: order-api', '#98c379'],
      ['  data:', '#e06c75'],
      ['    redis:', '#e06c75'],
      ['      host: localhost', '#98c379'],
      ['      port: 6379', '#d19a66'],
      ['      timeout: 2s', '#98c379'],
      ['server:', '#e06c75'],
      ['  port: 8081', '#d19a66']
    ]
  }),
  'figma-frame.png': `<svg xmlns="http://www.w3.org/2000/svg" width="1284" height="720" font-family="Helvetica, Arial">
    <rect width="100%" height="100%" fill="#f5f4f1"/>
    <rect x="222" y="120" width="840" height="480" rx="20" fill="#1e1e21"/>
    <rect x="262" y="160" width="760" height="56" rx="10" fill="#2c2c30"/>
    <text x="292" y="196" fill="#8a8985" font-size="22">Search your desk…</text>
    <rect x="262" y="240" width="360" height="44" rx="8" fill="#3a3a3f"/>
    <rect x="262" y="296" width="360" height="44" rx="8" fill="#2a2a2e"/>
    <rect x="262" y="352" width="360" height="44" rx="8" fill="#2a2a2e"/>
    <rect x="652" y="240" width="370" height="200" rx="10" fill="#15171a"/>
    <rect x="262" y="540" width="140" height="8" rx="4" fill="#f0a94b"/>
  </svg>`,
  'latency-chart.png': `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600" font-family="Helvetica, Arial">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="80" y="70" fill="#1c1b19" font-size="26" font-weight="bold">Search latency</text>
    <line x1="80" y1="520" x2="1140" y2="520" stroke="#dad7d1" stroke-width="2"/>
    <line x1="80" y1="120" x2="80" y2="520" stroke="#dad7d1" stroke-width="2"/>
    <polyline fill="none" stroke="#a85a0a" stroke-width="4" points="80,200 230,230 380,260 530,330 680,380 830,410 980,430 1130,440"/>
  </svg>`
}

for (const [name, svg] of Object.entries(shots)) {
  await sharp(Buffer.from(svg)).png().toFile(join(out, name))
  console.log('demo:', name)
}

/** Minimal one-page PDF (Helvetica, ASCII) — enough for Finder, Quick Look and thumbnails. */
function pdf(title, lines) {
  const content = [
    'BT /F1 28 Tf 72 740 Td',
    `(${title.replace(/[()\\]/g, '\\$&')}) Tj`,
    '/F1 13 Tf 0 -44 Td 18 TL',
    ...lines.map((l) => `(${l.replace(/[()\\]/g, '\\$&')}) '`),
    'ET'
  ].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  ]
  let body = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body))
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xref = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return body
}

const pdfs = {
  'redis-troubleshooting-guide.pdf': pdf('Redis Troubleshooting Guide', [
    '1. Connection refused on port 6379',
    '   - Is redis-server running? Try: redis-cli ping',
    '   - Check bind / protected-mode in redis.conf',
    '2. Timeouts under load',
    '   - Raise the client timeout; check slowlog and latency monitor',
    '3. RedisConnectionFailureException in Spring',
    '   - Verify spring.data.redis.host / port / timeout'
  ]),
  'alen-cup.pdf': pdf('ALEN CUP', ['Submission checklist', '- Demo video', '- Project description', '- Build for macOS']),
  'tax-guide.pdf': pdf('Year-end Tax Settlement 2026', ['Documents to prepare', '- Medical expenses', '- Card spending summary', '- Donation receipts'])
}

for (const [name, content] of Object.entries(pdfs)) {
  writeFileSync(join(out, name), content)
  console.log('demo:', name)
}
