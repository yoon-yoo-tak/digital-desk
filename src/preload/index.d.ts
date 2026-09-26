import type { DeskApi } from '../shared/ipc'

declare global {
  interface Window {
    desk: DeskApi
  }
}

export {}
