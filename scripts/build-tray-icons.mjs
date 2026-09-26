// Renders the menu-bar template images from design/icons (DESIGN §4).
// Template images are black + alpha; macOS tints them for light/dark menu bars.
import { mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'resources', 'tray')
const SIZE = 18 // points; @2x is rendered at 36px

const icons = [
  { svg: 'app-mark.svg', name: 'trayTemplate' },
  { svg: 'app-mark-paused.svg', name: 'trayPausedTemplate' }
]

mkdirSync(outDir, { recursive: true })

for (const { svg, name } of icons) {
  const source = join(root, 'design', 'icons', svg)
  const target1x = join(outDir, `${name}.png`)
  try {
    if (statSync(target1x).mtimeMs > statSync(source).mtimeMs) continue
  } catch {
    // not built yet
  }
  const markup = readFileSync(source, 'utf8').replaceAll('currentColor', '#000000')
  for (const [scale, suffix] of [
    [1, ''],
    [2, '@2x']
  ]) {
    const px = SIZE * scale
    await sharp(Buffer.from(markup), { density: (72 * px) / 16 })
      .resize(px, px)
      .png()
      .toFile(join(outDir, `${name}${suffix}.png`))
  }
  console.log(`tray icon: ${name}`)
}
