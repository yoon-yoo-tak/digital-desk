/** Case-insensitive occurrences of any word in text, merged and sorted. [start, end) pairs. */
export function highlightRanges(text: string, words: readonly string[]): [number, number][] {
  if (!text) return []
  const lower = text.toLowerCase()
  // toLowerCase can change length for a few characters; fall back to no highlight then.
  if (lower.length !== text.length) return []
  const ranges: [number, number][] = []
  for (const word of words) {
    const w = word.toLowerCase()
    if (!w) continue
    for (let i = lower.indexOf(w); i !== -1; i = lower.indexOf(w, i + w.length)) ranges.push([i, i + w.length])
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}

/** Splits text into plain and highlighted runs. */
export function splitHighlights(text: string, words: readonly string[]): { text: string; match: boolean }[] {
  const parts: { text: string; match: boolean }[] = []
  let cursor = 0
  for (const [start, end] of highlightRanges(text, words)) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false })
    parts.push({ text: text.slice(start, end), match: true })
    cursor = end
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts
}
