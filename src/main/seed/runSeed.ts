// `npm run seed [-- --reset] [-- --count 10000]` — writes demo data into the app's data folder.
// Runs inside Electron so it shares userData resolution, thumbnails and assets with the app.

import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { app, nativeImage } from 'electron'
import { Assets } from '../storage/assets'
import { openDatabase } from '../storage/db'
import { ItemsRepo } from '../storage/itemsRepo'
import { currentProfile, resourcesDir } from '../paths'
import { SettingsRepo } from '../storage/settingsRepo'
import { buildDemoItems, type DemoItem } from './demoData'

export interface SeedOptions {
  reset: boolean
  count: number
}

export function parseSeedArgs(argv: string[]): SeedOptions {
  const i = argv.indexOf('--count')
  const count = i >= 0 ? Number(argv[i + 1]) : 0
  return { reset: argv.includes('--reset'), count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0 }
}

export interface SeedTarget {
  repo: ItemsRepo
  assets: Assets
  /** Demo files are copied here: <userData>/demo-files */
  demoRoot: string
}

/** Writes the demo items (and their files, thumbnails) into an open database. Returns how many. */
export async function seedDemoData({ repo, assets, demoRoot }: SeedTarget, count: number): Promise<number> {
  const demoAssets = join(resourcesDir(), 'demo')
  const now = new Date()
  const items = buildDemoItems(now, { count })

  const withFiles: DemoItem[] = []
  const plain: DemoItem[] = []
  for (const item of items) (item.demoFile || item.clipboardImage ? withFiles : plain).push(item)

  for (const demo of withFiles) {
    let filePath: string | null = null
    if (demo.demoFile) {
      const folder = join(demoRoot, demo.demoFile.folder)
      mkdirSync(folder, { recursive: true })
      filePath = join(folder, demo.fileName ?? demo.demoFile.asset)
      copyFileSync(join(demoAssets, demo.demoFile.asset), filePath)
    }
    const item = repo.insert({ ...demo, filePath })
    if (filePath) {
      const info = assets.statFile(filePath)
      const image = nativeImage.createFromPath(filePath)
      const size = image.isEmpty() ? {} : image.getSize()
      const previewPath = await assets.saveFileThumbnail(item.id, filePath)
      repo.update(item.id, { previewPath, metadata: { ...item.metadata, ...size, ...(info ? { size: info.size } : {}) } })
    }
    if (demo.clipboardImage) {
      const png = readFileSync(join(demoAssets, demo.clipboardImage))
      const { width, height } = nativeImage.createFromBuffer(png).getSize()
      const previewPath = assets.saveClipboardImage(item.id, { png, width, height })
      repo.update(item.id, { previewPath, metadata: { width, height, size: png.length } })
    }
    finish(repo, item.id, demo)
  }

  const inserted = repo.insertMany(plain)
  inserted.forEach((item, i) => finish(repo, item.id, plain[i] as DemoItem))
  return items.length
}

/** `npm run seed` (Electron, no windows). */
export async function runSeed(opts: SeedOptions): Promise<void> {
  if (app.isPackaged && !process.env.DESK_USER_DATA && !currentProfile()) {
    throw new Error('Refusing to seed real data. Use --profile=<name> or set DESK_USER_DATA.')
  }
  const userData = app.getPath('userData')
  const db = openDatabase(join(userData, 'desk.db'))
  const repo = new ItemsRepo(db)
  const assetsRoot = join(userData, 'assets')
  const demoRoot = join(userData, 'demo-files')
  if (opts.reset) {
    repo.clearAll()
    rmSync(assetsRoot, { recursive: true, force: true })
    rmSync(demoRoot, { recursive: true, force: true })
  }
  const written = await seedDemoData({ repo, assets: new Assets(assetsRoot), demoRoot }, opts.count)
  new SettingsRepo(db).set({ onboarded: true })
  console.log(
    `seed: ${written} items (${opts.count} bulk) into ${userData}${opts.reset ? ' after reset' : ''}; total now ${repo.count()}`
  )
  db.close()
}

function finish(repo: ItemsRepo, id: string, demo: DemoItem): void {
  if (demo.pinned) repo.setPinned(id, true)
  for (const at of demo.touches ?? []) repo.touch(id, at)
}
