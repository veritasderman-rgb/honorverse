/**
 * Analytický dashboard (/analytika) — datová vrstva. Čte VÝHRADNĚ agregační
 * pohledy (wob_daily / wob_funnel / wob_tutorial / wob_segments) přes
 * PostgREST; surová tabulka wob_events zůstává pro klienty zamčená (RLS
 * insert-only). Čisté transformace jsou oddělené kvůli testům.
 */

export const API = 'https://asvvsygcxdixwgmdumjm.supabase.co/rest/v1'
/** publishable klíč — určený do klienta, pohledy jsou jen agregáty bez PII */
export const KEY = 'sb_publishable_USKc7oefEplEPjMAgbEz4g_4HKZSH3u'

export interface DailyRow {
  day: string
  players: number
  sessions: number
  mission_starts: number
  mission_ends: number
  events: number
}

export interface FunnelRow {
  mission_id: string
  starts: number
  wins: number
  losses: number
  win_pct: number | null
  median_win_t: number | null
}

export interface TutorialRow {
  mission_id: string
  step: number | null
  reached: number
  skipped_here: number
}

export interface SegmentRow {
  lang: string
  device: string
  players: number
  sessions: number
  wins: number
  mission_ends: number
}

/** kampaňové pořadí misí — funnel se řadí podle linie, ne abecedně */
export const MISSION_ORDER = [
  'mission00', 'mission01', 'mission02', 'mission03', 'side01', 'mission04', 'mission05',
  'side02', 'mission06', 'mission07', 'mission08', 'side03', 'mission09',
  'mission10', 'mission11', 'skirmish',
]

/** seřadí funnel dle kampaňové linie; neznámá id na konec (dle jména) */
export function orderFunnel<T extends { mission_id: string }>(rows: T[]): T[] {
  const idx = (id: string): number => {
    const i = MISSION_ORDER.indexOf(id)
    return i === -1 ? MISSION_ORDER.length : i
  }
  return [...rows].sort((a, b) =>
    idx(a.mission_id) - idx(b.mission_id) || a.mission_id.localeCompare(b.mission_id))
}

export interface Kpis {
  /** součet denních unikátů v kalendářním okně ⟨dnes−6, dnes⟩ (hráčské dny) */
  playerDays7: number
  sessions7: number
  starts7: number
  ends7: number
  /** za celou historii (view vrací jen dny se záznamem) */
  totalEvents: number
  days: number
}

/** ISO datum (YYYY-MM-DD) o `n` dní dřív — čistá aritmetika nad UTC */
export function isoDaysBefore(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/**
 * Klíčová čísla z denní řady. „7 dní" je kalendářní okno ⟨dnes−6, dnes⟩ —
 * view vrací jen dny se záznamem, takže řez posledních 7 ŘÁDKŮ by po
 * hluchých dnech tiše natáhl období.
 */
export function kpis(daily: DailyRow[], todayIso: string): Kpis {
  const sorted = [...daily].sort((a, b) => b.day.localeCompare(a.day))
  const cutoff = isoDaysBefore(todayIso, 6)
  const last7 = sorted.filter(r => r.day >= cutoff && r.day <= todayIso)
  const sum = (f: (r: DailyRow) => number): number => last7.reduce((s, r) => s + f(r), 0)
  return {
    playerDays7: sum(r => r.players),
    sessions7: sum(r => r.sessions),
    starts7: sum(r => r.mission_starts),
    ends7: sum(r => r.mission_ends),
    totalEvents: sorted.reduce((s, r) => s + r.events, 0),
    days: sorted.length,
  }
}

export interface TutorialStep {
  step: number
  reached: number
  skipped: number
  /** % z prvního kroku mise (dokončenost tutoriálu po krocích) */
  pctOfFirst: number
}

/** rozpad tutoriálu po misích: kroky vzestupně + % udržení vůči 1. kroku */
export function tutorialFunnel(rows: TutorialRow[]): Record<string, TutorialStep[]> {
  const byMission = new Map<string, TutorialRow[]>()
  for (const r of rows) {
    if (r.step === null) continue
    const list = byMission.get(r.mission_id) ?? []
    list.push(r)
    byMission.set(r.mission_id, list)
  }
  const out: Record<string, TutorialStep[]> = {}
  for (const [mission, list] of byMission) {
    const steps = [...list].sort((a, b) => (a.step ?? 0) - (b.step ?? 0))
    const first = steps[0]?.reached ?? 0
    out[mission] = steps.map(s => ({
      step: s.step ?? 0,
      reached: s.reached,
      skipped: s.skipped_here,
      pctOfFirst: first > 0 ? Math.round((100 * s.reached) / first) : 0,
    }))
  }
  return out
}

/** m:ss / h:mm:ss z sekund (medián času výhry) */
export function fmtDur(s: number | null): string {
  if (s === null || !Number.isFinite(s)) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const p = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`
}

/** načte pohled přes PostgREST; chyba → null (UI ukáže offline stav) */
export async function fetchView<T>(view: string, query = ''): Promise<T[] | null> {
  try {
    const res = await fetch(`${API}/${view}${query}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    })
    if (!res.ok) return null
    return await res.json() as T[]
  } catch {
    return null
  }
}
