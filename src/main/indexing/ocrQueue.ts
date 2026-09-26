// Screenshot OCR, one image at a time (ARCHITECTURE §6.2). Results update the row, FTS and title.

import type { OcrLine } from '../helper/deskHelper'
import type { ItemsRepo } from '../storage/itemsRepo'
import { titleFromOcr } from '../capture/files'

export interface OcrEngine {
  readonly available: boolean
  ocr(path: string): Promise<OcrLine[]>
}

interface Job {
  itemId: string
  path: string
}

export class OcrQueue {
  private jobs: Job[] = []
  private running = false
  private idleWaiters: (() => void)[] = []

  constructor(
    private readonly deps: { repo: ItemsRepo; engine: OcrEngine; onChanged: () => void }
  ) {}

  enqueue(itemId: string, path: string): void {
    this.jobs.push({ itemId, path })
    void this.drain()
  }

  /** Resolves when nothing is queued or running (tests). */
  idle(): Promise<void> {
    if (!this.running && this.jobs.length === 0) return Promise.resolve()
    return new Promise((resolve) => this.idleWaiters.push(resolve))
  }

  private async drain(): Promise<void> {
    if (this.running) return
    this.running = true
    while (this.jobs.length > 0) {
      const job = this.jobs.shift() as Job
      await this.run(job)
    }
    this.running = false
    this.idleWaiters.splice(0).forEach((resolve) => resolve())
  }

  private async run({ itemId, path }: Job): Promise<void> {
    const { repo, engine, onChanged } = this.deps
    const item = repo.get(itemId)
    if (!item) return // deleted while waiting
    if (!engine.available) {
      repo.update(itemId, { ocrStatus: 'skipped' })
      return
    }
    try {
      const lines = (await engine.ocr(path)).map((l) => l.text)
      const title = titleFromOcr(lines)
      repo.update(itemId, {
        ocrText: lines.join('\n'),
        ocrStatus: 'done',
        ...(title ? { title } : {})
      })
    } catch (error) {
      console.warn('[ocr] failed', error)
      repo.update(itemId, { ocrStatus: 'failed' })
    }
    onChanged()
  }
}
