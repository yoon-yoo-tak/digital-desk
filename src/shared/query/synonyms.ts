// Tiny Korean ↔ English synonym dictionary (ARCHITECTURE §7.2). No AI.
// Each search term expands to a group; the group matches if any member does.
// This is what lets "redis 에러" find an English "RedisConnectionFailureException" — keep it tested.

export const SYNONYM_GROUPS: readonly string[][] = [
  ['에러', '오류', 'error', 'exception', 'fail'],
  ['연결', '접속', 'connection', 'connect'],
  ['타임아웃', '시간초과', 'timeout'],
  ['다운로드', 'download'],
  ['스크린샷', '캡처', 'screenshot'],
  ['설정', 'config', 'configuration', 'settings'],
  ['로그인', 'login', 'signin'],
  ['권한', 'permission'],
  ['메모리', 'memory'],
  ['서버', 'server']
]

const LOOKUP = new Map<string, string[]>()
for (const group of SYNONYM_GROUPS) for (const word of group) LOOKUP.set(word, group)

// Two-syllable particles first so 에서 / 으로 win over 에 / 로.
const KOREAN_PARTICLES = ['에서', '으로', '이', '가', '은', '는', '을', '를', '의', '에', '로', '와', '과', '도', '만']

function stripParticle(term: string): string | null {
  if (!/[가-힣]$/u.test(term)) return null
  for (const p of KOREAN_PARTICLES) {
    if (term.endsWith(p) && [...term].length - [...p].length >= 2) return term.slice(0, -p.length)
  }
  return null
}

function lookup(word: string): string[] | undefined {
  return LOOKUP.get(word) ?? (word.length > 3 && word.endsWith('s') ? LOOKUP.get(word.slice(0, -1)) : undefined)
}

/** All words that count as a match for this term (lowercased, unique, original first). */
export function expandTerm(term: string): string[] {
  const word = term.toLowerCase()
  const out = new Set<string>([word])
  for (const w of lookup(word) ?? []) out.add(w)
  const stripped = stripParticle(word)
  if (stripped) {
    out.add(stripped)
    for (const w of lookup(stripped) ?? []) out.add(w)
  }
  return [...out]
}
