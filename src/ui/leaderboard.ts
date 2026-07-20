/**
 * Žebříček (Supabase PostgREST, projekt wall-of-battle).
 * Anonymní INSERT do wob_scores; čtení jen přes views bez e-mailů
 * (wob_leaderboard, wob_overall) — e-mail nikdy neopouští databázi.
 * Všechny síťové chyby degradují na null — hra bez sítě funguje dál.
 */

const API = 'https://asvvsygcxdixwgmdumjm.supabase.co/rest/v1'
/** publishable klíč — je určený do klienta, práva hlídá RLS na serveru */
const KEY = 'sb_publishable_USKc7oefEplEPjMAgbEz4g_4HKZSH3u'

const HEADERS: Record<string, string> = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
}

const TIMEOUT_MS = 6_000

async function call(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...HEADERS, ...(init.headers as Record<string, string> | undefined) },
      signal: ctl.signal,
    })
    clearTimeout(timer)
    return res
  } catch {
    return null // offline / blokováno — žebříček prostě není
  }
}

export interface ScoreEntry {
  mission_id: string
  nickname: string
  email: string | null
  consent: boolean
  score: number
  time_s: number
  losses: number
  launched: number
  hits: number
}

export interface LeaderRow {
  nickname: string
  score: number
  time_s: number
  losses: number
  created_at: string
}

export interface OverallRow {
  nickname: string
  total: number
  missions: number
}

/** odešle skóre; true = uloženo */
export async function submitScore(entry: ScoreEntry): Promise<boolean> {
  const res = await call('/wob_scores', {
    method: 'POST',
    body: JSON.stringify(entry),
    headers: { Prefer: 'return=minimal' },
  })
  return res !== null && res.ok
}

/** top N mise (řazeno skóre ↓, při shodě dřívější zápis) */
export async function fetchTop(missionId: string, limit = 10): Promise<LeaderRow[] | null> {
  const res = await call(
    `/wob_leaderboard?mission_id=eq.${encodeURIComponent(missionId)}`
    + `&select=nickname,score,time_s,losses,created_at`
    + `&order=score.desc,created_at.asc&limit=${limit}`)
  if (!res || !res.ok) return null
  return res.json() as Promise<LeaderRow[]>
}

/** kolik zápisů mise je lepších než score + celkový počet zápisů mise */
export async function fetchRank(
  missionId: string, score: number,
): Promise<{ better: number; total: number } | null> {
  const count = async (extra: string): Promise<number | null> => {
    const res = await call(
      `/wob_leaderboard?mission_id=eq.${encodeURIComponent(missionId)}${extra}&select=score`,
      { headers: { Prefer: 'count=exact', Range: '0-0' } })
    if (!res || (res.status !== 200 && res.status !== 206)) return null
    const range = res.headers.get('content-range') // „0-0/57" | „*/0"
    const totalStr = range?.split('/')[1]
    const n = totalStr ? Number(totalStr) : NaN
    return Number.isFinite(n) ? n : null
  }
  const [better, total] = await Promise.all([count(`&score=gt.${score}`), count('')])
  if (better === null || total === null) return null
  return { better, total }
}

/** celkové pořadí (součet nejlepších skóre per mise dle přezdívky) */
export async function fetchOverall(limit = 10): Promise<OverallRow[] | null> {
  const res = await call(`/wob_overall?order=total.desc&limit=${limit}`)
  if (!res || !res.ok) return null
  return res.json() as Promise<OverallRow[]>
}

/**
 * Shrnutí pořadí hráče — čistá funkce (testovatelná):
 * „Jsi 3. z 57 kapitánů (top 6 %). Na 1. místo ti chybí 340 bodů."
 */
export function rankSummary(
  myScore: number, top: LeaderRow[], better: number, total: number,
): string {
  const rank = better + 1
  const parts: string[] = []
  if (total > 0) {
    const pct = Math.max(1, Math.round((rank / total) * 100))
    parts.push(`Jsi ${rank}. z ${total} kapitánů (top ${pct} %).`)
  }
  const best = top[0]
  if (best && best.score > myScore) {
    parts.push(`Na 1. místo ti chybí ${best.score - myScore} bodů.`)
  } else if (best && rank === 1) {
    parts.push('Držíš 1. místo!')
  }
  if (rank > 10 && top.length >= 10) {
    const tenth = top[9]
    if (tenth.score > myScore) parts.push(`Do TOP 10 chybí ${tenth.score - myScore} bodů.`)
  } else if (total > 0 && rank <= 10) {
    parts.push('Jsi v TOP 10 téhle mise!')
  }
  return parts.join(' ')
}
