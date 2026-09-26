import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/** Vite's dev client starts a blob worker; allow it in dev only. Production CSP stays strict. */
function devWorkerCsp(): Plugin {
  return {
    name: 'dev-worker-csp',
    apply: 'serve',
    transformIndexHtml: (html) => html.replace("script-src 'self';", "script-src 'self'; worker-src 'self' blob:;")
  }
}

const alias = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@design': resolve(__dirname, 'design')
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      alias: { ...alias, '@renderer': resolve(__dirname, 'src/renderer') }
    },
    plugins: [react(), devWorkerCsp()],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/renderer/main-window/index.html'),
          quick: resolve(__dirname, 'src/renderer/quick-search/index.html'),
          settings: resolve(__dirname, 'src/renderer/settings/index.html'),
          onboarding: resolve(__dirname, 'src/renderer/onboarding/index.html')
        }
      }
    }
  }
})
