// Quick Search panel (DESIGN §6.1): created once and kept hidden, shown by ⌘⇧Space.

import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { IPC } from '@shared/ipc'
import type { Clock } from '../clock'

export const QUICK_SEARCH_SHORTCUT = 'CommandOrControl+Shift+Space'

const WIDTH = 860
const HEIGHT = 588
/** Top edge sits at this fraction of the display height. */
const TOP_RATIO = 0.22
/** Reopening within this window restores the previous query. */
export const RESTORE_MS = 60_000

/**
 * A `type: 'panel'` window is non-activating: it takes keystrokes while the app the user was in
 * stays active. Hiding it therefore returns focus to that app with no extra work.
 */
export class QuickSearchWindow {
  readonly win: BrowserWindow
  private suppressBlur = false
  private hiddenAt = 0

  constructor(private readonly now: Clock) {
    this.win = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      type: 'panel',
      vibrancy: 'hud',
      visualEffectState: 'active',
      roundedCorners: true,
      hasShadow: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    this.win.on('blur', () => {
      if (this.suppressBlur) return
      this.hide() // the user clicked elsewhere
    })
    this.win.on('focus', () => {
      this.suppressBlur = false
    })
    this.win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    this.win.webContents.on('will-navigate', (event) => event.preventDefault())

    const devServer = process.env.ELECTRON_RENDERER_URL
    if (devServer) {
      this.win.webContents.on('console-message', (details) => {
        if (details.level === 'warning' || details.level === 'error') {
          console.log(`[quick-search:${details.level}] ${details.message}`)
        }
      })
      void this.win.loadURL(`${devServer}/quick-search/index.html`)
    } else {
      void this.win.loadFile(join(__dirname, '../renderer/quick-search/index.html'))
    }
  }

  get visible(): boolean {
    return this.win.isVisible()
  }

  toggle(): void {
    if (this.visible) this.hide()
    else this.show()
  }

  show(): void {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const { width, height } = this.win.getBounds()
    this.win.setBounds({
      x: Math.round(display.workArea.x + (display.workArea.width - width) / 2),
      y: Math.round(display.bounds.y + display.bounds.height * TOP_RATIO),
      width,
      height
    })
    this.win.webContents.send(IPC.quickShown, { restore: this.now() - this.hiddenAt < RESTORE_MS })
    this.win.show()
    this.win.focus()
  }

  hide(): void {
    if (!this.visible) return
    this.hiddenAt = this.now()
    this.win.hide()
    this.win.webContents.send(IPC.quickHidden)
  }

  /** Keeps the top edge and horizontal center fixed. */
  resize(width: number, height: number): void {
    const b = this.win.getBounds()
    const w = Math.round(Math.min(Math.max(width, 480), 1000))
    const h = Math.round(Math.min(Math.max(height, 64), 700))
    if (w === b.width && h === b.height) return
    this.win.setBounds({ x: Math.round(b.x + (b.width - w) / 2), y: b.y, width: w, height: h })
  }

  /** Quick Look takes focus; don't treat that as "clicked away". */
  beginQuickLook(): void {
    this.suppressBlur = true
  }
}
