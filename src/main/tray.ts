import { Menu, Tray, nativeImage } from 'electron'
import type { CaptureStatus } from '@shared/types'
import { captureMenuModel, toTemplate, type CaptureCommand } from './captureMenu'
import { trayIcon } from './paths'

export class DeskTray {
  private tray: Tray | null = null

  constructor(private readonly run: (command: CaptureCommand) => void) {}

  update(status: CaptureStatus): void {
    const icon = nativeImage.createFromPath(trayIcon(status.paused))
    icon.setTemplateImage(true)
    if (!this.tray) {
      this.tray = new Tray(icon)
    } else {
      this.tray.setImage(icon)
    }
    this.tray.setToolTip(status.paused ? 'Digital Desk — paused' : 'Digital Desk — capturing')
    const entries = captureMenuModel({ ...status, includeAppItems: true })
    this.tray.setContextMenu(Menu.buildFromTemplate(toTemplate(entries, this.run)))
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
