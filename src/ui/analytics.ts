/**
 * Herní analytika — anonymní telemetrie do Supabase (tabulka wob_events,
 * INSERT-only přes RLS; klient data nikdy nečte). Bez závislostí.
 *
 * Zásady:
 * - žádné PII: náhodné id hráče (localStorage) + id sezení (per načtení),
 * - fire-and-forget: dávkování ve frontě, flush po ~8 s, na odchodu ze
 *   stránky sendBeacon; síťová chyba события zahodí (hra jede dál),
 * - sbírá se jen v PRODUKCI; `localStorage wob-analytics = '0'` vypne
 *   sběr úplně, `'1'` ho vynutí i ve vývoji (ladění),
 * - vyhodnocení: pohledy wob_funnel / wob_daily / wob_tutorial /
 *   wob_segments v Supabase (viz docs/ANALYTICS.md).
 */

const API = 'https://asvvsygcxdixwgmdumjm.supabase.co/rest/v1'
/** publishable klíč — určený do klienta, práva hlídá RLS (insert-only) */
const KEY = 'sb_publishable_USKc7oefEplEPjMAgbEz4g_4HKZSH3u'

const FLUSH_MS = 8_000
const QUEUE_CAP = 40

export interface AnalyticsEvent {
  player_id: string
  session_id: string
  event: string
  mission_id: string | null
  props: Record<string, unknown>
  lang: string
  device: string
  app: string
}

/** náhodné id (16 hex) — UI vrstva, determinismus simulace se netýká */
const rid = (): string =>
  Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')

/** zapnuto? PROD default zapnuto; wob-analytics '0' vypne, '1' vynutí */
export function analyticsEnabled(): boolean {
  try {
    const pref = localStorage.getItem('wob-analytics')
    if (pref === '0') return false
    if (pref === '1') return true
  } catch { /* noop */ }
  try { return !!import.meta.env.PROD } catch { return false }
}

function playerId(): string {
  try {
    let id = localStorage.getItem('wob-pid')
    if (!id || id.length < 8) {
      id = rid()
      localStorage.setItem('wob-pid', id)
    }
    return id
  } catch { return 'no-storage-anon' }
}

const SESSION_ID = rid()

/** zařízení dle aktivních tříd kompaktního UI (viz main.ts detekce) */
function device(): string {
  try {
    const b = document.body.classList
    return b.contains('phone') ? 'phone' : b.contains('tablet') ? 'tablet' : 'desktop'
  } catch { return 'desktop' }
}

/** jazyk bez importu i18n (cyklické závislosti) — čte uloženou volbu/DOM */
function lang(): string {
  try { return document.documentElement.lang === 'en' ? 'en' : (localStorage.getItem('wob-lang') ?? 'cs') } catch { return 'cs' }
}

/** čistý stavitel záznamu (testovatelný bez DOM) */
export function buildEvent(
  event: string, props: Record<string, unknown>, missionId: string | null,
  ids: { player: string; session: string }, ctx: { lang: string; device: string },
): AnalyticsEvent {
  return {
    player_id: ids.player,
    session_id: ids.session,
    event: event.slice(0, 40),
    mission_id: missionId ? missionId.slice(0, 40) : null,
    props,
    lang: ctx.lang === 'en' ? 'en' : 'cs',
    device: ['phone', 'tablet', 'desktop'].includes(ctx.device) ? ctx.device : 'desktop',
    app: 'web',
  }
}

let queue: AnalyticsEvent[] = []
let timer: ReturnType<typeof setInterval> | null = null

function send(events: AnalyticsEvent[], beacon: boolean): void {
  if (events.length === 0) return
  const body = JSON.stringify(events)
  try {
    if (beacon && navigator.sendBeacon) {
      // beacon neumí hlavičky — apikey jde v query (Supabase ho tam přijímá)
      navigator.sendBeacon(`${API}/wob_events?apikey=${KEY}`,
        new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch(`${API}/wob_events`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body,
    }).catch(() => { /* offline — události zahazujeme */ })
  } catch { /* noop */ }
}

function flush(beacon = false): void {
  if (queue.length === 0) return
  const batch = queue
  queue = []
  send(batch, beacon)
}

/** zaznamenej událost (fire-and-forget; mimo produkci no-op) */
export function track(event: string, props: Record<string, unknown> = {}, missionId: string | null = null): void {
  if (!analyticsEnabled()) return
  queue.push(buildEvent(event, props, missionId,
    { player: playerId(), session: SESSION_ID }, { lang: lang(), device: device() }))
  if (queue.length > QUEUE_CAP) queue = queue.slice(-QUEUE_CAP)
  if (!timer) {
    try {
      timer = setInterval(() => flush(), FLUSH_MS)
      window.addEventListener('pagehide', () => flush(true))
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush(true)
      })
    } catch { /* noop */ }
  }
}
