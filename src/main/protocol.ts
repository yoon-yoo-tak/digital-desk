// desk-asset:// — the only way renderers load thumbnails and clipboard images (ARCHITECTURE §3).
// desk-asset://thumbs/<id>.png → <assets>/thumbs/<id>.png

import { pathToFileURL } from 'node:url'
import { net, protocol } from 'electron'
import type { Assets } from './storage/assets'

export const ASSET_SCHEME = 'desk-asset'

/** Must run before the app is ready. */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

export function handleAssetProtocol(assets: Assets): void {
  protocol.handle(ASSET_SCHEME, (request) => {
    const url = new URL(request.url)
    const file = assets.resolve(decodeURIComponent(`${url.host}${url.pathname}`))
    if (!file) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).href).catch(() => new Response('Not found', { status: 404 }))
  })
}
