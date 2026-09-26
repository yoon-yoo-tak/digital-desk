// Small single-instance windows (Settings, Onboarding) that load one renderer page.

import { join } from 'node:path'
import { BrowserWindow, shell, type BrowserWindowConstructorOptions } from 'electron'

export class PageWindow {
  private win: BrowserWindow | null = null

  constructor(
    private readonly page: string,
    private readonly options: BrowserWindowConstructorOptions
  ) {}

  get window(): BrowserWindow | null {
    return this.win && !this.win.isDestroyed() ? this.win : null
  }

  show(): BrowserWindow {
    const existing = this.window
    if (existing) {
      existing.show()
      existing.focus()
      return existing
    }
    const win = new BrowserWindow({
      show: false,
      backgroundColor: '#fbfaf8',
      ...this.options,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    this.win = win
    win.once('ready-to-show', () => win.show())
    win.on('closed', () => {
      if (this.win === win) this.win = null
    })
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//iu.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    win.webContents.on('will-navigate', (event) => event.preventDefault())

    const devServer = process.env.ELECTRON_RENDERER_URL
    if (devServer) {
      win.webContents.on('console-message', (details) => {
        if (details.level === 'warning' || details.level === 'error') {
          console.log(`[${this.page}:${details.level}] ${details.message}`)
        }
      })
      void win.loadURL(`${devServer}/${this.page}/index.html`)
    } else {
      void win.loadFile(join(__dirname, `../renderer/${this.page}/index.html`))
    }
    return win
  }

  close(): void {
    this.window?.close()
  }
}
