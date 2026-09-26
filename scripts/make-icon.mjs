// App icon: the tray glyph from design/icons/app-mark.svg on the Quick Search panel color.
// macOS icon grid: 1024 canvas, 824 rounded square centered (100 px margin). electron-builder
// turns build/icon.png into the .icns. Run again only when the icon changes: node scripts/make-icon.mjs
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(root, 'build'), { recursive: true })

// Glyph paths are on a 16-unit grid; scale 16 → 440 px and center it in the tile.
const scale = 440 / 16
const offset = 512 - 8 * scale
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a2a2e"/>
      <stop offset="1" stop-color="#18181b"/>
    </linearGradient>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>
  <rect x="101" y="101" width="822" height="822" rx="184" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="2"/>
  <g transform="translate(${offset} ${offset + 12}) scale(${scale})" fill="none" stroke="#f0a94b"
     stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2.5 9.5h3l1 1.75h3l1-1.75h3"/>
    <path d="M2.5 9.5L4.25 4h7.5l1.75 5.5v3.5h-11z"/>
  </g>
</svg>`

await sharp(Buffer.from(svg)).png().toFile(join(root, 'build', 'icon.png'))
console.log('icon: build/icon.png')
