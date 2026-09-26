// Pure rules for folder capture (ARCHITECTURE §6.2, §6.3, §6.5).

import { extname } from 'node:path'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.heic', '.tif', '.tiff', '.gif', '.webp', '.bmp'])

export function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(extname(name).toLowerCase())
}

/** Only a fallback: the screencapture metadata flag is the real test. English and Korean macOS names. */
export function looksLikeScreenshotName(name: string): boolean {
  return isImageFile(name) && /^(Screenshot|Screen Shot|스크린샷|화면 캡처)[\s_]/u.test(name)
}

/** In-progress or hidden files in Downloads that must never become items. */
export function isIgnoredDownload(name: string): boolean {
  if (name.startsWith('.')) return true
  return /\.(crdownload|download|part|partial|tmp|opdownload|aria2)$/iu.test(name)
}

/** Host of a URL without "www.", or null. */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./u, '')
    return host || null
  } catch {
    return null
  }
}

const EXCEPTION_TOKEN = /\b[A-Z][A-Za-z0-9]+(Exception|Error)\b/u
const ERROR_WORDS = /(오류|에러|실패|Error|Failed|Warning)/u

function letterRatio(line: string): number {
  const letters = [...line].filter((c) => /\p{L}/u.test(c)).length
  return letters / Math.max(1, [...line].length)
}

/**
 * A screenshot title from its OCR lines (ARCHITECTURE §6.5):
 * an exception class name → a line with an error word → the first word-like line → null (keep the file name).
 */
export function titleFromOcr(lines: string[]): string | null {
  const clean = lines.map((l) => l.trim()).filter((l) => l.length > 0)
  for (const line of clean) {
    const m = EXCEPTION_TOKEN.exec(line)
    if (m) return m[0]
  }
  const fits = (l: string): boolean => [...l].length >= 8 && [...l].length <= 80
  const errorLine = clean.find((l) => ERROR_WORDS.test(l) && fits(l))
  if (errorLine) return errorLine
  return clean.find((l) => fits(l) && letterRatio(l) >= 0.6) ?? null
}
