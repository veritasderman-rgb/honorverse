/**
 * Analytický dashboard (/analytika) — vykreslení. Interní nástroj majitele
 * hry (česky): KPI karty, denní graf (Canvas 2D, bez závislostí), funnel
 * misí, udržení tutoriálu a segmenty jazyk × zařízení.
 */
import {
  fetchView, fmtDur, kpis, orderFunnel, tutorialFunnel,
  type DailyRow, type FunnelRow, type SegmentRow, type TutorialRow,
} from './data'
import { SCENARIOS } from '../data/missions'

const $ = (id: string): HTMLElement => document.getElementById(id)!

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))

const num = (n: number): string => n.toLocaleString('cs-CZ')

/** název mise pro tabulky (id → český titul scénáře; skirmish zvlášť) */
function missionName(id: string): string {
  if (id === 'skirmish') return 'Volná bitva'
  return SCENARIOS[id]?.title ?? id
}

// ---------- KPI karty ----------

function renderKpis(daily: DailyRow[]): void {
  const k = kpis(daily, new Date().toISOString().slice(0, 10))
  $('kpis').innerHTML = [
    ['hráčské dny · 7 dní', num(k.playerDays7)],
    ['sezení · 7 dní', num(k.sessions7)],
    ['startů misí · 7 dní', num(k.starts7)],
    ['dohraných misí · 7 dní', num(k.ends7)],
    ['událostí celkem', num(k.totalEvents)],
    ['dní se záznamem', num(k.days)],
  ].map(([label, value]) =>
    `<div class="kpi"><b>${value}</b><span>${label}</span></div>`).join('')
}

// ---------- denní graf (canvas) ----------

function renderChart(daily: DailyRow[]): void {
  const canvas = $('chart') as HTMLCanvasElement
  const wrap = canvas.parentElement!
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = wrap.clientWidth
  const h = 220
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)

  const rows = [...daily].sort((a, b) => a.day.localeCompare(b.day)).slice(-30)
  if (rows.length === 0) {
    ctx.fillStyle = '#5b7a99'
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillText('zatím žádná data — graf se objeví s prvními hráči', 16, h / 2)
    return
  }
  const max = Math.max(1, ...rows.map(r => Math.max(r.sessions, r.players)))
  const pad = { l: 34, r: 8, t: 10, b: 26 }
  const iw = w - pad.l - pad.r
  const ih = h - pad.t - pad.b
  const bw = iw / rows.length

  // mřížka + osa y
  ctx.strokeStyle = 'rgba(120,160,200,0.15)'
  ctx.fillStyle = '#5b7a99'
  ctx.font = '10px system-ui, sans-serif'
  const gridSteps = 4
  for (let i = 0; i <= gridSteps; i++) {
    const v = Math.round((max * i) / gridSteps)
    const y = pad.t + ih - (ih * i) / gridSteps
    ctx.beginPath()
    ctx.moveTo(pad.l, y)
    ctx.lineTo(w - pad.r, y)
    ctx.stroke()
    ctx.fillText(String(v), 4, y + 3)
  }

  // sloupce: sezení (tlumené) + hráči (jantar)
  rows.forEach((r, i) => {
    const x = pad.l + i * bw
    const hs = (ih * r.sessions) / max
    const hp = (ih * r.players) / max
    ctx.fillStyle = 'rgba(90,140,190,0.45)'
    ctx.fillRect(x + bw * 0.15, pad.t + ih - hs, bw * 0.7, hs)
    ctx.fillStyle = '#e8b34b'
    ctx.fillRect(x + bw * 0.3, pad.t + ih - hp, bw * 0.4, hp)
  })

  // popisky dnů (max ~10, ať se nepřekrývají)
  ctx.fillStyle = '#5b7a99'
  const every = Math.max(1, Math.ceil(rows.length / 10))
  rows.forEach((r, i) => {
    if (i % every !== 0) return
    const x = pad.l + i * bw
    ctx.fillText(r.day.slice(5), x, h - 8)
  })
}

// ---------- tabulky ----------

function bar(pct: number, cls: string): string {
  const p = Math.max(0, Math.min(100, pct))
  return `<span class="bar"><i class="${cls}" style="width:${p}%"></i></span>`
}

function renderFunnel(rows: FunnelRow[]): void {
  if (rows.length === 0) {
    $('funnel').innerHTML = `<div class="empty">zatím žádné mise — funnel se naplní s prvními hráči</div>`
    return
  }
  const maxStarts = Math.max(1, ...rows.map(r => r.starts))
  $('funnel').innerHTML =
    `<table><tr><th>mise</th><th>startů</th><th></th><th>výher</th><th>proher</th><th>win %</th><th>medián času výhry</th></tr>`
    + orderFunnel(rows).map(r => {
      const wp = r.win_pct === null ? '—' : `${r.win_pct} %`
      const wpCls = r.win_pct === null ? '' : r.win_pct >= 60 ? 'ok' : r.win_pct >= 30 ? 'amber' : 'bad'
      return `<tr><td>${esc(missionName(r.mission_id))} <span class="dim">${esc(r.mission_id)}</span></td>`
        + `<td>${num(r.starts)}</td><td>${bar((100 * r.starts) / maxStarts, 'b-starts')}</td>`
        + `<td class="ok">${num(r.wins)}</td><td class="bad">${num(r.losses)}</td>`
        + `<td class="${wpCls}">${wp}</td><td>${fmtDur(r.median_win_t)}</td></tr>`
    }).join('')
    + `</table>`
}

function renderTutorial(rows: TutorialRow[]): void {
  const perMission = tutorialFunnel(rows)
  const missions = Object.keys(perMission).sort()
  if (missions.length === 0) {
    $('tutorial').innerHTML = `<div class="empty">zatím žádné kroky tutoriálu</div>`
    return
  }
  $('tutorial').innerHTML = missions.map(m => {
    const steps = perMission[m]
    return `<div class="tut-block"><h3>${esc(missionName(m))} <span class="dim">${esc(m)}</span></h3>`
      + `<table><tr><th>krok</th><th>dosáhlo</th><th></th><th>% z 1. kroku</th><th>přeskočilo tady</th></tr>`
      // kroky jsou už jedničkové (tutorialView trackuje idx + 1)
      + steps.map(s =>
        `<tr><td>${s.step}</td><td>${num(s.reached)}</td><td>${bar(s.pctOfFirst, 'b-tut')}</td>`
        + `<td>${s.pctOfFirst} %</td><td class="${s.skipped > 0 ? 'amber' : 'dim'}">${num(s.skipped)}</td></tr>`).join('')
      + `</table></div>`
  }).join('')
}

function renderSegments(rows: SegmentRow[]): void {
  if (rows.length === 0) {
    $('segments').innerHTML = `<div class="empty">zatím žádné segmenty</div>`
    return
  }
  $('segments').innerHTML =
    `<table><tr><th>jazyk</th><th>zařízení</th><th>hráčů</th><th>sezení</th><th>dohráno</th><th>výher</th><th>win %</th></tr>`
    + rows.map(r => {
      const wp = r.mission_ends > 0 ? `${Math.round((100 * r.wins) / r.mission_ends)} %` : '—'
      return `<tr><td>${esc(r.lang)}</td><td>${esc(r.device)}</td><td>${num(r.players)}</td>`
        + `<td>${num(r.sessions)}</td><td>${num(r.mission_ends)}</td><td class="ok">${num(r.wins)}</td><td>${wp}</td></tr>`
    }).join('')
    + `</table>`
}

// ---------- načtení ----------

let lastDaily: DailyRow[] = []

async function load(): Promise<void> {
  $('status').textContent = 'načítám…'
  // wob_daily bez limitu: řádek = den se záznamem, i roky provozu jsou
  // stovky řádků — celkové karty nesmí být tiše oříznuté (graf si bere
  // posledních 30 dní sám)
  const [daily, funnel, tutorial, segments] = await Promise.all([
    fetchView<DailyRow>('wob_daily', '?order=day.desc'),
    fetchView<FunnelRow>('wob_funnel'),
    fetchView<TutorialRow>('wob_tutorial'),
    fetchView<SegmentRow>('wob_segments'),
  ])
  if (!daily || !funnel || !tutorial || !segments) {
    $('status').textContent = 'nepodařilo se načíst data (offline / Supabase nedostupný) — zkus obnovit'
    return
  }
  lastDaily = daily
  $('status').textContent = `naposledy obnoveno ${new Date().toLocaleTimeString('cs-CZ')}`
  renderKpis(daily)
  renderChart(daily)
  renderFunnel(funnel)
  renderTutorial(tutorial)
  renderSegments(segments)
}

$('refresh').addEventListener('click', () => { void load() })
// resize jen překreslí graf z posledních dat (žádný nový fetch)
window.addEventListener('resize', () => { if (lastDaily.length > 0) renderChart(lastDaily) })
void load()
