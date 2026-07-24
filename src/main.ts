/**
 * Bootstrap UI vrstvy: bridge → plot → panely → controller,
 * briefing overlay na start (pauza), win/lose overlay dle outcome.
 */
import { SimBridge } from './worker/bridge'
import { TacticalPlot } from './ui/plot'
import { startFleetView } from './ui/fleetview'
import { sceneFor } from './ui/scenes'
import { Panels, esc, fmtTime, type CombatStats } from './ui/panels'
import { UIController } from './ui/input'
import { AudioManager } from './ui/audio'
import { SCENARIOS } from './data/missions'
import { SHIP_CLASSES } from './data/defs'
import {
  buildSkirmish, fleetTotal, RANGE_PRESETS, SKIRMISH_CLASSES, type SkirmishConfig,
} from './data/skirmish'
import {
  applyVeterancy, loadFleet, recordMissionResult, resetFleet, TIER_LABEL, tierOf,
} from './ui/fleetlog'
import {
  applyLoadout, LOADOUTS, loadPreset, presetById, savePreset, type LoadoutId,
} from './data/loadout'
import { CAMPAIGN_INTRO, DEFEAT_GENERIC, MISSION_STORY } from './data/story'
import {
  CAMPAIGN_NODES, isMissionUnlocked, NEBULAE, STARFIELD, type CampaignNode,
} from './data/campaign'
import { scoreMission } from './sim/score'
import {
  fetchOverall, fetchRank, fetchTop, rankSummary, submitScore,
} from './ui/leaderboard'
import type { Scenario, SimState } from './sim/types'

const canvas = document.getElementById('plot') as HTMLCanvasElement
const plotContainer = document.getElementById('plot-container') as HTMLElement
const topbar = document.getElementById('topbar') as HTMLElement

const bridge = new SimBridge()
const plot = new TacticalPlot(canvas)
// zvuk: AudioContext se odemyká prvním gestem (autoplay politika prohlížečů)
const audio = new AudioManager()
audio.setMenuMode(true)
window.addEventListener('pointerdown', () => audio.unlock())
const panels = new Panels(plotContainer, topbar, a => { audio.uiClick(); controller.handleAction(a) }, audio)
const controller = new UIController(bridge, plot, panels)

// hook pro smoke testy (Playwright) — čtení stavu plotu a ovládání zvenku
Object.assign(window, { __wob: { plot, controller } })

// kinematické pozadí menu (flotila za soumraku) — běží jen když je vidět
const menuBgCanvas = document.getElementById('menu-bg') as HTMLCanvasElement | null
let stopFleetView: (() => void) | null = null
function setMenuBg(on: boolean): void {
  if (!menuBgCanvas) return
  menuBgCanvas.classList.toggle('on', on)
  if (on && !stopFleetView) stopFleetView = startFleetView(menuBgCanvas)
  else if (!on && stopFleetView) { stopFleetView(); stopFleetView = null }
}

// ---------- odolnost na iOS Safari ----------

// viditelný banner chyb: pád za běhu jinak na mobilu vypadá jako „nic se
// neděje" — takhle jde nahlásit screenshotem
function showError(msg: string): void {
  const bar = document.getElementById('errbar')
  if (!bar) return
  bar.textContent = `CHYBA: ${msg}`
  bar.style.display = 'block'
}
window.addEventListener('error', e => showError(e.message))
window.addEventListener('unhandledrejection', e =>
  showError(e.reason instanceof Error ? e.reason.message : String(e.reason)))

// iOS Safari ignoruje user-scalable=no — nativní pinch-zoom stránky rozbíjí
// hit-testing fixed overlayů (tapy padají mimo tlačítka). Gesta zoomu UI
// blokujeme; pinch-zoom PLOTU řeší vlastní pointer handlery canvasu.
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, e => e.preventDefault())
}

/**
 * Robustní tap: iOS při zoomu/scrollu občas nedoručí 'click' — poslouchej
 * i 'pointerup' s debounce, ať se akce nespustí dvakrát.
 */
function onTap(el: Element | null, fn: () => void): void {
  if (!el) return
  let last = 0
  const h = (): void => {
    const now = Date.now()
    if (now - last < 400) return
    last = now
    fn()
  }
  el.addEventListener('pointerup', h)
  el.addEventListener('click', h)
}

// ---------- mobil / tablet ----------

// výsuvné šuplíky HUD sloupců (telefonní breakpoint — záložky ◧/◨)
for (const [tabId, hudId] of [['tab-tl', 'hud-tl'], ['tab-tr', 'hud-tr']] as const) {
  const tab = document.getElementById(tabId)
  const hud = document.getElementById(hudId)
  tab?.addEventListener('click', () => {
    const open = hud?.classList.toggle('open') === true
    // otevření jednoho šuplíku zavře druhý (na telefonu se nevejdou oba)
    if (open) {
      const other = hudId === 'hud-tl' ? 'hud-tr' : 'hud-tl'
      document.getElementById(other)?.classList.remove('open')
    }
    tab.classList.toggle('active', open)
  })
}

// wake lock: při běžící misi nenech displej zhasnout (dlouhá komprese času);
// zámek zaniká při schování stránky — po návratu ho obnovíme
let wakeLock: { release(): Promise<void> } | null = null
async function acquireWakeLock(): Promise<void> {
  try {
    const wl = (navigator as Navigator & {
      wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> }
    }).wakeLock
    if (wl && !wakeLock) wakeLock = await wl.request('screen')
  } catch { /* zamítnuto/nepodporováno — nevadí */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void acquireWakeLock()
  else wakeLock = null // systém zámek při schování uvolnil sám
})
window.addEventListener('pointerdown', () => { void acquireWakeLock() }, { once: true })

// service worker (jen produkce): offline hraní + instalace na plochu
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* offline nedostupný */ })
  })
}

let outcomeShown = false
let currentMissionId = ''

function overlay(html: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'overlay'
  el.innerHTML = `<div class="box">${html}</div>`
  document.body.appendChild(el)
  return el
}

/** onReady po kampaňové přípravě rovnou spustí (briefing byl v přípravě) */
let skipBriefing = false

/** spustí kampaňovou misi s veteránstvím flotily (C1) + loadoutem (B1) */
function startCampaignMission(id: string, preset?: LoadoutId): void {
  const sc = SCENARIOS[id]
  if (!sc) { bridge.start(id); return } // fallback (demo scénář ve workeru)
  const clone = applyVeterancy(sc)         // klon s buffy veteránů
  applyLoadout(clone, preset ?? loadPreset()) // + zvolená výzbroj
  bridge.startScenario(clone)
}

/** localStorage flag „úvod kampaně už hráč viděl" */
const INTRO_SEEN_KEY = 'wob-campaign-intro-seen'

const introSeen = (): boolean => {
  try { return localStorage.getItem(INTRO_SEEN_KEY) === '1' } catch { return false }
}
const markIntroSeen = (): void => {
  try { localStorage.setItem(INTRO_SEEN_KEY, '1') } catch { /* noop */ }
}

/** localStorage: seznam vyčištěných misí (odemyká další soustavy na mapě) */
const CLEARED_KEY = 'wob-cleared'

function loadCleared(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLEARED_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}
function markCleared(id: string): void {
  const s = new Set(loadCleared())
  s.add(id)
  try { localStorage.setItem(CLEARED_KEY, JSON.stringify([...s])) } catch { /* noop */ }
}

/** úvod kampaně (první spuštění): CAMPAIGN_INTRO + POKRAČOVAT → výběr mise */
function showCampaignIntro(onDone: () => void): void {
  const el = overlay(
    `<h2>WALL OF BATTLE — KAMPAŇ</h2>`
    + `<div class="brief story">${esc(CAMPAIGN_INTRO)}</div>`
    + `<button id="btn-intro-continue">POKRAČOVAT</button>`,
  )
  el.classList.add('menu')
  setMenuBg(true)
  onTap(el.querySelector('#btn-intro-continue'), () => {
    markIntroSeen()
    el.remove()
    onDone()
  })
}

/** stav soustavy na mapě podle postupu kampaně */
type SysState = 'done' | 'open' | 'locked'

/** SVG hvězdné mapy kampaně (viewBox 1000×600): trasy, soustavy, „jsi zde" */
function starMapSvg(cleared: ReadonlySet<string>): string {
  const clearedArr = [...cleared]
  const avail = (n: CampaignNode): boolean => isMissionUnlocked(n.id, clearedArr)
  const stateOf = (n: CampaignNode): SysState =>
    cleared.has(n.id) ? 'done' : avail(n) ? 'open' : 'locked'
  const byId = (id: string): CampaignNode | undefined => CAMPAIGN_NODES.find(n => n.id === id)

  // pozadí — hvězdy a mlhoviny (dekorace z campaign.ts)
  const stars = STARFIELD.map(s =>
    `<circle class="star" cx="${s.x}" cy="${s.y}" r="${s.r}"/>`).join('')
  const nebulae = NEBULAE.map(n =>
    `<ellipse class="neb" cx="${n.x}" cy="${n.y}" rx="${n.rx}" ry="${n.ry}" `
    + `style="fill:hsl(${n.hue} 60% 45%)"/>`).join('')

  // hyperkoridory — čára z uzlu k jeho požadavku, obarvená podle stavu cíle
  const lanes = CAMPAIGN_NODES.filter(n => n.requires).map(n => {
    const from = byId(n.requires!)
    if (!from) return ''
    const cls = `lane ${stateOf(n)}${n.optional ? ' bonus' : ''}`
    return `<line class="${cls}" x1="${from.x}" y1="${from.y}" x2="${n.x}" y2="${n.y}"/>`
  }).join('')

  // soustavy — číslujeme jen hlavní linii; bonusy dostanou ★
  let mainNo = 0
  const systems = CAMPAIGN_NODES.map(n => {
    const st = stateOf(n)
    const done = st === 'done'
    const open = st !== 'locked'
    const num = n.optional ? null : ++mainNo
    const badge = done ? '✔' : n.optional ? '★' : String(num)
    const title = SCENARIOS[n.id]?.title ?? n.id
    const tap = open ? ` data-mission="${esc(n.id)}" tabindex="0" role="button"` : ''
    const anchor = n.x > 860 ? 'end' : n.x < 140 ? 'start' : 'middle'
    const tx = n.x > 860 ? n.x + 18 : n.x < 140 ? n.x - 18 : n.x
    return `<g class="sys ${st}${n.optional ? ' bonus' : ''}"${tap}>`
      + `<circle class="glow" cx="${n.x}" cy="${n.y}" r="20"/>`
      + `<circle class="node" cx="${n.x}" cy="${n.y}" r="13"/>`
      + `<text class="badge" x="${n.x}" y="${n.y}">${badge}</text>`
      + `<text class="title" x="${tx}" y="${n.y + 32}" text-anchor="${anchor}">${esc(title)}</text>`
      + `</g>`
  }).join('')

  // „jsi zde" — první nevyčištěná dostupná soustava (kam skočit dál)
  const here = CAMPAIGN_NODES.find(n => !cleared.has(n.id) && avail(n))
  const hereMark = here
    ? `<g class="here"><circle class="pulse" cx="${here.x}" cy="${here.y}" r="18"/>`
      + `<path class="ship" d="M0,-9 L6,7 L0,3 L-6,7 Z" transform="translate(${here.x},${here.y - 34})"/>`
      + `<text class="here-lbl" x="${here.x}" y="${here.y - 44}" text-anchor="middle">JSI ZDE</text></g>`
    : ''

  return `<svg class="starmap-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" `
    + `role="group" aria-label="Hvězdná mapa kampaně">`
    + `<g class="bg">${nebulae}${stars}</g>`
    + `<g class="lanes">${lanes}</g>`
    + `<g class="systems">${systems}</g>`
    + hereMark
    + `</svg>`
}

/** úvodní menu: hvězdná mapa kampaně (soustavy = mise) + příběh/žebříček/bitva */
function showStarMap(): void {
  const cleared = new Set(loadCleared())
  const total = CAMPAIGN_NODES.filter(n => !n.optional).length
  const doneCount = CAMPAIGN_NODES.filter(n => !n.optional && cleared.has(n.id)).length
  const actions =
    `<div class="sm-actions">`
    + `<button id="btn-story-toggle">▸ PŘÍBĚH</button>`
    + `<button id="btn-hall-toggle">▸ SÍŇ SLÁVY</button>`
    + `<button id="btn-skirmish">⚔ VOLNÁ BITVA</button>`
    + `<button id="btn-fleet">⚓ SÍŇ FLOTILY</button>`
    + `</div>`
    + `<div id="story-body" class="brief story" style="display:none">${esc(CAMPAIGN_INTRO)}</div>`
    + `<div id="hall-body" style="display:none" class="lb-box"><span class="dim">načítám…</span></div>`
  const el = overlay(
    `<h2>HVĚZDNÁ MAPA</h2>`
    + `<div class="sm-progress">Postup kampaně: <b>${doneCount}/${total}</b> soustav — `
    + `klepni na svítící soustavu a vpluj do mise.</div>`
    + `<div class="starmap">${starMapSvg(cleared)}</div>`
    + actions,
  )
  el.classList.add('menu', 'menu-map')
  setMenuBg(true)

  onTap(el.querySelector('#btn-skirmish'), () => { el.remove(); showSkirmishBuilder() })
  onTap(el.querySelector('#btn-fleet'), () => { el.remove(); showFleetHall() })

  // Síň slávy: celkové pořadí (součet nejlepších skóre per mise)
  const hallToggle = el.querySelector<HTMLButtonElement>('#btn-hall-toggle')
  const hallBody = el.querySelector<HTMLElement>('#hall-body')
  let hallLoaded = false
  onTap(hallToggle, () => {
    const open = hallBody!.style.display !== 'none'
    hallBody!.style.display = open ? 'none' : 'block'
    hallToggle!.textContent = `${open ? '▸' : '▾'} SÍŇ SLÁVY`
    if (open || hallLoaded) return
    hallLoaded = true
    void fetchOverall(10).then(rows => {
      if (!rows || rows.length === 0) {
        hallBody!.innerHTML = `<span class="dim">${rows ? 'Žebříček je zatím prázdný — buď první!' : 'Žebříček je nedostupný (offline?).'}</span>`
        return
      }
      hallBody!.innerHTML = `<table class="lb-table"><tr><th>#</th><th>kapitán</th><th>body</th><th>misí</th></tr>`
        + rows.map((r, i) =>
          `<tr><td>${i + 1}.</td><td>${esc(r.nickname)}</td><td>${r.total}</td><td>${r.missions}</td></tr>`).join('')
        + `</table>`
    })
  })

  const toggle = el.querySelector<HTMLButtonElement>('#btn-story-toggle')
  const body = el.querySelector<HTMLElement>('#story-body')
  onTap(toggle, () => {
    const open = body!.style.display !== 'none'
    body!.style.display = open ? 'none' : 'block'
    toggle!.textContent = `${open ? '▸' : '▾'} PŘÍBĚH`
  })

  // klepnutí na odemčenou soustavu → příprava mise (jen uzly s data-mission)
  el.querySelectorAll<SVGGElement>('g[data-mission]').forEach(g => {
    onTap(g, () => {
      el.remove()
      showMissionPrep(g.dataset.mission!)
    })
  })
}

/** Síň flotily (C1): kariéra vlastních lodí (veteránství) + památník ztrát. */
function showFleetHall(): void {
  const log = loadFleet()
  const active = Object.entries(log.ships).sort((a, b) => b[1].battles - a[1].battles)
  const activeHtml = active.length === 0
    ? `<div class="dim">Zatím žádné veterány — dokonči kampaňovou misi a lodě si začnou nést zkušenost.</div>`
    : active.map(([name, r]) => {
      const tier = tierOf(r.battles)
      const hull = SHIP_CLASSES[r.classId]?.hullCode ?? '?'
      return `<div class="row"><span>${esc(name)} <span class="dim">(${esc(hull)})</span></span>`
        + `<span class="${tier === 'elite' ? 'ok' : ''}">${TIER_LABEL[tier]} · ${r.battles} ${r.battles === 1 ? 'bitva' : r.battles < 5 ? 'bitvy' : 'bitev'}</span></div>`
    }).join('')
  const lostHtml = log.lost.length === 0
    ? `<div class="dim">Zatím bez ztrát. Drž to tak.</div>`
    : log.lost.map(l =>
      `<div class="row"><span class="bad">✕ ${esc(l.name)}</span><span class="dim">${esc(SHIP_CLASSES[l.classId]?.hullCode ?? '?')}</span></div>`).join('')

  const el = overlay(
    `<h2>SÍŇ FLOTILY</h2>`
    + `<div class="brief">Vlastní lodě si mezi misemi kampaně nesou zkušenost — veteráni střílejí těsnější salvy. `
    + `Ztráta lodi je trvalá. Nepřátel zničeno celkem: <b>${log.kills}</b>.</div>`
    + `<div class="score-block"><div class="score-total">POSÁDKY</div>${activeHtml}</div>`
    + `<div class="score-block"><div class="score-total">PAMÁTNÍK</div>${lostHtml}</div>`
    + `<div style="margin-top:14px">`
    + `<button id="fl-back">ZPĚT</button> `
    + `<button id="fl-reset" class="dim">Vynulovat kariéru</button></div>`,
  )
  onTap(el.querySelector('#fl-back'), () => { el.remove(); showStarMap() })
  onTap(el.querySelector('#fl-reset'), () => {
    resetFleet()
    el.remove()
    showFleetHall()
  })
}

/** Stavba volné bitvy (E1): steppery flotil, vzdálenost, seed → BOJ. */
function showSkirmishBuilder(): void {
  const cfg: SkirmishConfig = {
    player: { 'ca-bastion': 1, 'dd-vichr': 2 },
    enemy: { 'ca-bastion': 1, 'dd-vichr': 2 },
    rangeKm: 6_000_000,
    seed: Math.floor(Math.random() * 1e9),
  }
  const clsRow = (side: 'player' | 'enemy', cls: string): string => {
    const hull = SHIP_CLASSES[cls]?.hullCode ?? '?'
    const nm = SHIP_CLASSES[cls]?.name ?? cls
    return `<div class="sk-row">`
      + `<span class="sk-name" title="${esc(nm)}">${esc(hull)}</span>`
      + `<button class="sk-step" data-sk="dec" data-side="${side}" data-cls="${cls}">−</button>`
      + `<span class="sk-n" id="sk-${side}-${cls}">${cfg[side][cls] ?? 0}</span>`
      + `<button class="sk-step" data-sk="inc" data-side="${side}" data-cls="${cls}">+</button>`
      + `</div>`
  }
  const col = (side: 'player' | 'enemy', title: string): string =>
    `<div class="sk-col"><div class="sk-col-h">${title}</div>`
    + SKIRMISH_CLASSES.map(c => clsRow(side, c)).join('')
    + `<div class="sk-total">celkem <b id="sk-total-${side}">${fleetTotal(cfg[side])}</b></div></div>`
  const ranges = RANGE_PRESETS.map(r =>
    `<button class="sk-range${r.km === cfg.rangeKm ? ' active' : ''}" data-km="${r.km}">${esc(r.label)}</button>`).join('')

  const el = overlay(
    `<h2>VOLNÁ BITVA</h2>`
    + `<div class="sk-grid">${col('player', 'TVOJE FLOTILA')}${col('enemy', 'NEPŘÍTEL')}</div>`
    + `<div class="sk-opts"><span>Vzdálenost:</span> ${ranges}</div>`
    + `<div class="sk-opts"><span>Seed:</span> <b id="sk-seed">${cfg.seed}</b> `
    + `<button id="sk-dice" title="náhodný seed">🎲</button></div>`
    + `<div style="margin-top:14px">`
    + `<button id="sk-fight">⚔ BOJ</button> `
    + `<button id="sk-back">ZPĚT</button></div>`
    + `<div id="sk-warn" class="dim" style="margin-top:8px"></div>`,
  )

  const refresh = (): void => {
    for (const side of ['player', 'enemy'] as const) {
      for (const c of SKIRMISH_CLASSES) {
        const n = el.querySelector(`#sk-${side}-${c}`)
        if (n) n.textContent = String(cfg[side][c] ?? 0)
      }
      const tot = el.querySelector(`#sk-total-${side}`)
      if (tot) tot.textContent = String(fleetTotal(cfg[side]))
    }
    const ok = fleetTotal(cfg.player) > 0 && fleetTotal(cfg.enemy) > 0
    const fight = el.querySelector<HTMLButtonElement>('#sk-fight')!
    fight.disabled = !ok
    el.querySelector('#sk-warn')!.textContent = ok ? '' : 'Obě flotily potřebují aspoň jednu loď.'
  }

  // delegace kliknutí (steppery, vzdálenost) — jeden posluchač na overlay
  el.addEventListener('click', e => {
    const t = (e.target as Element).closest<HTMLElement>('[data-sk],[data-km]')
    if (!t) return
    const km = t.getAttribute('data-km')
    if (km) {
      cfg.rangeKm = Number(km)
      el.querySelectorAll('.sk-range').forEach(b =>
        b.classList.toggle('active', b.getAttribute('data-km') === km))
      return
    }
    const sk = t.getAttribute('data-sk')
    if (sk === 'inc' || sk === 'dec') {
      const side = t.getAttribute('data-side') as 'player' | 'enemy'
      const cls = t.getAttribute('data-cls')!
      const cur = cfg[side][cls] ?? 0
      cfg[side][cls] = Math.max(0, Math.min(12, cur + (sk === 'inc' ? 1 : -1)))
      refresh()
    }
  })
  onTap(el.querySelector('#sk-dice'), () => {
    cfg.seed = Math.floor(Math.random() * 1e9)
    el.querySelector('#sk-seed')!.textContent = String(cfg.seed)
  })
  onTap(el.querySelector('#sk-back'), () => { el.remove(); showStarMap() })
  onTap(el.querySelector('#sk-fight'), () => {
    if (fleetTotal(cfg.player) === 0 || fleetTotal(cfg.enemy) === 0) return
    el.remove()
    setMenuBg(false)
    bridge.startScenario(buildSkirmish(cfg))
  })
  refresh()
}

/** úvodní scéna mise (public/img/<hodnota>.png) */
const MISSION_SCENES: Record<string, string> = {
  mission01: 'scene-station',
  mission02: 'scene-convoy',
  mission03: 'scene-battle',
  mission04: 'scene-hyperwave',
  mission05: 'scene-station',
  mission06: 'scene-hyperwave',
  mission07: 'scene-convoy',
  mission08: 'scene-battle',
  mission09: 'scene-battle',
  mission10: 'scene-hyperwave',
  mission11: 'scene-battle',
}

/**
 * Video briefing per mise (public/vid/<hodnota>.mp4). Každá mise má hook na
 * vlastní video; dokud soubor neexistuje, přehrávač spadne zpět na statickou
 * scénu (MISSION_SCENES). Viz docs/VIDEO_BRIEFINGS.md.
 */
const MISSION_VIDEOS: Record<string, string> = {
  mission01: 'brief-mission01', mission02: 'brief-mission02',
  mission03: 'brief-mission03', mission04: 'brief-mission04',
  mission05: 'brief-mission05', mission06: 'brief-mission06',
  mission07: 'brief-mission07', mission08: 'brief-mission08',
  mission09: 'brief-mission09', mission10: 'brief-mission10',
  mission11: 'brief-mission11',
}

/**
 * Media briefingu: přehraje video mise (pokud existuje), jinak statická
 * scéna. Chyba načtení videa → graceful fallback na obrázek. Vrací element
 * k vložení, nebo null (mise bez scény i videa).
 */
function briefingMedia(id: string): HTMLElement | null {
  const scene = MISSION_SCENES[id]
  const makeImg = (): HTMLImageElement | null => {
    if (!scene) return null
    const img = document.createElement('img')
    img.className = 'brief-img'
    img.src = `img/${scene}.png`
    img.alt = ''
    img.onerror = () => img.remove()
    return img
  }
  const vid = MISSION_VIDEOS[id]
  if (vid) {
    const v = document.createElement('video')
    v.className = 'brief-vid'
    v.src = `vid/${vid}.mp4`
    v.autoplay = true
    v.muted = true
    v.setAttribute('playsinline', '')
    v.controls = false
    if (scene) v.poster = `img/${scene}.png`
    // video chybí/nejde přehrát → statická scéna (nebo nic)
    v.addEventListener('error', () => {
      const img = makeImg()
      if (img && v.parentElement) v.replaceWith(img)
      else v.remove()
    })
    void v.play?.().catch(() => { /* autoplay blokován — poster zůstává */ })
    return v
  }
  return makeImg()
}

/** briefing skirmishe (bez loadoutu — výzbroj řeší stavba bitvy) */
function showBriefing(sc: Scenario): void {
  const el = overlay(
    `<h2>${esc(sc.title)}</h2>`
    + `<div class="brief">${esc(sc.briefing)}</div>`
    + `<button id="btn-start">START</button>`,
  )
  onTap(el.querySelector('#btn-start'), () => {
    el.remove()
    audio.setMenuMode(false)
    controller.setCompression(1)
  })
}

/**
 * Příprava kampaňové mise (B1): scéna + příběh + volba LOADOUTU výzbroje,
 * pak START → sim se postaví s veteránstvím i loadoutem a rovnou běží
 * (žádný druhý briefing). Staví se z klientského SCENARIOS[id].
 */
function showMissionPrep(id: string): void {
  const sc = SCENARIOS[id]
  if (!sc) { startCampaignMission(id); return }
  const prolog = MISSION_STORY[id]?.prolog
  let sel: LoadoutId = loadPreset()
  const btns = LOADOUTS.map(l =>
    `<button class="ld-btn${l.id === sel ? ' active' : ''}" data-ld="${l.id}">${esc(l.label)}</button>`).join('')
  const el = overlay(
    `<div id="prep-media"></div>`
    + `<h2>${esc(sc.title)}</h2>`
    + (prolog ? `<div class="brief story">${esc(prolog)}</div>` : '')
    + `<div class="brief">${esc(sc.briefing)}</div>`
    + `<div class="ld-row"><span>VÝZBROJ:</span> ${btns}</div>`
    + `<div id="ld-desc" class="dim">${esc(presetById(sel).desc)}</div>`
    + `<div style="margin-top:12px"><button id="btn-start">START</button> `
    + `<button id="btn-prep-back">ZPĚT</button></div>`,
  )
  // video briefing (nebo statická scéna jako fallback)
  const media = briefingMedia(id)
  if (media) el.querySelector('#prep-media')?.appendChild(media)
  el.addEventListener('click', e => {
    const t = (e.target as Element).closest<HTMLElement>('[data-ld]')
    if (!t) return
    sel = t.getAttribute('data-ld') as LoadoutId
    el.querySelectorAll('.ld-btn').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-ld') === sel))
    el.querySelector('#ld-desc')!.textContent = presetById(sel).desc
  })
  onTap(el.querySelector('#btn-prep-back'), () => { el.remove(); showStarMap() })
  onTap(el.querySelector('#btn-start'), () => {
    savePreset(sel)
    el.remove()
    setMenuBg(false)
    skipBriefing = true          // briefing byl tady — onReady rovnou spustí
    startCampaignMission(id, sel)
  })
}

/** localStorage klíče formuláře žebříčku */
const NICK_KEY = 'wob-nickname'
const EMAIL_KEY = 'wob-email'

const loadPref = (key: string): string => {
  try { return localStorage.getItem(key) ?? '' } catch { return '' }
}
const savePref = (key: string, v: string): void => {
  try { localStorage.setItem(key, v) } catch { /* noop */ }
}

/** české popisky příčin zániku rakety (rozpad obrany v rozboru) */
const CAUSE_LABEL: Record<string, string> = {
  cm: 'protirakety', pdlc: 'bodová obrana', wedge: 'klín', decoy: 'návnady',
  ecm: 'ECM', dud: 'selhání', link: 'ztráta zámku', fizzle: 'minula',
}

/** top 2 příčiny z rozpadu (např. „protirakety 12, bodová obrana 5") */
function causeBreakdown(rec: Record<string, number>): string {
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, v]) => `${CAUSE_LABEL[k] ?? k} ${v}`)
    .join(', ')
}

/** rozhodující faktor bitvy — poučná věta „proč to dopadlo takhle" (D1) */
function decisiveFactor(
  win: boolean, r: CombatStats, succ: number, defPct: number, ownLoss: number,
): string {
  if (win) {
    if (succ >= 30 && r.ourLaunched >= 6) return 'přesné soustředěné salvy prolomily obranu'
    if (defPct >= 60 && r.incLaunched >= 6) return 'vaše protiraketová clona udržela loď celou'
    if (ownLoss === 0) return 'čisté vítězství bez ztrát'
    return 'cíl padl dřív, než stačila rozhodnout přesila'
  }
  if (r.incHits >= 3) return 'nepřátelské salvy prošly obranou — příště hustší clona nebo klín do dráhy'
  if (succ < 12 && r.ourLaunched >= 6) return 'palte z kratší vzdálenosti — na dálku obrana cíle stíhá vše'
  if (ownLoss > 0) return 'ztráty rozhodly — chraňte lodě rolováním a bočními štíty'
  return 'rozhodla přesila nepřítele'
}

/** After-action rozbor (D1): co se stalo a co o výsledku rozhodlo */
function afterActionHtml(state: SimState, r: CombatStats): string {
  if (r.ourLaunched === 0 && r.incLaunched === 0) return '' // bez boje nemá smysl
  const win = state.outcome === 'win'
  const succ = r.ourLaunched > 0 ? Math.round((100 * r.ourHits) / r.ourLaunched) : 0
  const ownLoss = state.ships.filter(s => s.side === 'player' && s.destroyed).length
  const foeKilled = state.ships.filter(s => s.side === 'enemy' && s.destroyed).length
  const defPct = r.incLaunched > 0 ? Math.round((100 * r.incKilled) / r.incLaunched) : 0
  const defParts = causeBreakdown(r.incLoss)
  const verdict = decisiveFactor(win, r, succ, defPct, ownLoss)
  return `<div class="score-block aa">`
    + `<div class="score-total">ROZBOR BITVY</div>`
    + `<div class="row"><span>naše palba</span><span>${r.ourLaunched} raket · ${r.ourHits} zásahů (${succ} %)</span></div>`
    + (r.incLaunched > 0
      ? `<div class="row"><span>naše obrana</span><span>${r.incKilled}/${r.incLaunched} sestřeleno (${defPct} %)${defParts ? ` · ${esc(defParts)}` : ''}</span></div>`
      : '')
    + (r.incHits > 0 ? `<div class="row"><span>zásahy do nás</span><span class="bad">${r.incHits}</span></div>` : '')
    + `<div class="row"><span>bilance</span><span>zničeno ${foeKilled} · vlastní ztráty ${ownLoss}</span></div>`
    + `<div class="row"><span><b>rozhodlo</b></span><span class="${win ? 'ok' : 'bad'}">${esc(verdict)}</span></div>`
    + `</div>`
}

function showOutcome(state: SimState): void {
  const win = state.outcome === 'win'
  // vyčištěná kampaňová mise odemkne další soustavu na mapě (ne volná bitva)
  if (win && currentMissionId && currentMissionId !== 'skirmish') markCleared(currentMissionId)
  const objs = state.objectives.map(o => {
    const mark = o.state === 'done' ? '■' : o.state === 'failed' ? '✗' : '□'
    return `<div class="obj ${o.state}">${mark} ${esc(o.text)}</div>`
  }).join('')

  // skóre mise (jen výhra) — deterministické z průběhu
  const stats = panels.combatStats
  const score = scoreMission({
    missionId: currentMissionId,
    outcome: state.outcome === 'win' ? 'win' : 'lose',
    t: state.t,
    objectivesDone: state.objectives.filter(o => o.state === 'done').length,
    ownLosses: state.ships.filter(s => s.side === 'player' && s.destroyed).length,
    launched: stats.ourLaunched,
    hits: stats.ourHits,
  })
  // volná bitva nemá skóre do žebříčku (jen rozbor + skóre pro info)
  const isSkirmish = currentMissionId === 'skirmish'
  const scoreHtml = win
    ? `<div class="score-block">`
      + `<div class="score-total">SKÓRE: <b>${score.total}</b></div>`
      + score.breakdown.map(l =>
        `<div class="row"><span>${esc(l.label)}</span><span class="${l.points >= 0 ? 'ok' : 'bad'}">${l.points >= 0 ? '+' : ''}${l.points}</span></div>`).join('')
      + (isSkirmish ? '' :
        `<div class="lb-form">`
        + `<input id="lb-nick" maxlength="24" placeholder="přezdívka (2–24 znaků)" value="${esc(loadPref(NICK_KEY))}">`
        + `<input id="lb-email" maxlength="254" placeholder="e-mail (nepovinný — celkové pořadí)" value="${esc(loadPref(EMAIL_KEY))}">`
        + `<label class="lb-consent"><input type="checkbox" id="lb-consent"${loadPref(EMAIL_KEY) ? ' checked' : ''}> souhlasím s uložením e-mailu pro historické skóre</label>`
        + `<button id="btn-lb-submit">ODESLAT DO ŽEBŘÍČKU</button>`
        + `</div>`
        + `<div id="lb-result" class="lb-box"></div>`)
      + `</div>`
    : ''
  const story = MISSION_STORY[currentMissionId]
  let epilog = win ? story?.epilog : (story?.epilogLose ?? (story ? DEFEAT_GENERIC : undefined))
  // finále s více konci: epilog dle flagu stavu (ending-orders/-spirit/-clean)
  if (win && story?.epilogByFlag) {
    for (const [flag, text] of Object.entries(story.epilogByFlag)) {
      if (state.flags[flag]) { epilog = text; break }
    }
  }
  const el = overlay(
    `<h2 class="${win ? 'win' : 'lose'}">${win ? 'VÍTĚZSTVÍ' : 'PORÁŽKA'}</h2>`
    + `<div class="brief">Mise ukončena v čase ${fmtTime(state.t)}.</div>`
    + objs
    + afterActionHtml(state, panels.combatReport)
    + scoreHtml
    + (epilog ? `<div class="brief story story-epilog">${esc(epilog)}</div>` : '')
    + `<div style="margin-top:14px">`
    + `<button id="btn-again">ZNOVU</button> `
    + `<button id="btn-menu">VÝBĚR MISE</button>`
    + `</div>`,
  )

  // odeslání do žebříčku + top 10 + „chybí ti X bodů"
  const submitBtn = el.querySelector<HTMLButtonElement>('#btn-lb-submit')
  onTap(submitBtn, () => {
    const result = el.querySelector<HTMLElement>('#lb-result')!
    const nick = (el.querySelector<HTMLInputElement>('#lb-nick')?.value ?? '').trim()
    const email = (el.querySelector<HTMLInputElement>('#lb-email')?.value ?? '').trim()
    const consent = el.querySelector<HTMLInputElement>('#lb-consent')?.checked === true
    if (nick.length < 2) {
      result.innerHTML = `<span class="bad">Zadej přezdívku (aspoň 2 znaky).</span>`
      return
    }
    if (email && !consent) {
      result.innerHTML = `<span class="bad">E-mail uložíme jen se souhlasem — zaškrtni ho, nebo e-mail smaž.</span>`
      return
    }
    savePref(NICK_KEY, nick)
    savePref(EMAIL_KEY, consent ? email : '')
    submitBtn!.disabled = true
    result.innerHTML = `<span class="dim">odesílám…</span>`
    void (async () => {
      const ok = await submitScore({
        mission_id: currentMissionId, nickname: nick,
        email: consent && email ? email : null, consent,
        score: score.total, time_s: Math.max(1, Math.round(state.t)),
        losses: state.ships.filter(s => s.side === 'player' && s.destroyed).length,
        launched: stats.ourLaunched, hits: stats.ourHits,
      })
      if (!ok) {
        submitBtn!.disabled = false
        result.innerHTML = `<span class="bad">Odeslání selhalo (offline?). Zkus to znovu.</span>`
        return
      }
      const [top, rank] = await Promise.all([
        fetchTop(currentMissionId, 10), fetchRank(currentMissionId, score.total),
      ])
      let html = `<div class="ok">Skóre uloženo.</div>`
      if (top && rank) {
        html += `<div class="lb-rank">${esc(rankSummary(score.total, top, rank.better, rank.total))}</div>`
        html += `<table class="lb-table"><tr><th>#</th><th>kapitán</th><th>body</th><th>čas</th><th>ztráty</th></tr>`
          + top.map((r, i) =>
            `<tr><td>${i + 1}.</td><td>${esc(r.nickname)}</td><td>${r.score}</td>`
            + `<td>${fmtTime(r.time_s)}</td><td>${r.losses}</td></tr>`).join('')
          + `</table>`
      } else {
        html += `<span class="dim">Žebříček se nepodařilo načíst.</span>`
      }
      result.innerHTML = html
    })()
  })
  // ZNOVU = reload se stejnou misí (skirmish znovu otevře stavbu bitvy);
  // VÝBĚR MISE = reload bez parametru → menu
  onTap(el.querySelector('#btn-again'), () => {
    if (isSkirmish) { el.remove(); showSkirmishBuilder(); return }
    location.href = `${location.pathname}?mission=${encodeURIComponent(currentMissionId)}`
  })
  onTap(el.querySelector('#btn-menu'), () => {
    location.href = location.pathname
  })
}

bridge.onReady = scenario => {
  currentMissionId = scenario.id
  panels.resetStats() // bojová statistika se počítá per mise
  plot.setHyperlimit(scenario.hyperlimit ?? null)
  plot.setEnvironment(scenario.decor, scenario.ambient)
  plot.setScene(sceneFor(scenario.id, scenario.ambient)) // vizuál mise (hvězda, mlhovina, planety)
  plot.start()
  if (skipBriefing) {
    // kampaň: příprava (příběh + loadout) už proběhla → rovnou do boje
    skipBriefing = false
    audio.setMenuMode(false)
    controller.setCompression(1)
  } else {
    showBriefing(scenario) // skirmish (volná bitva)
  }
}

bridge.onSnapshot = (state, compression) => {
  audio.onSnapshot(state)
  // haptika (mobil): zásah do vlastní lodi krátce zavibruje
  if (state.events.some(e => (e.kind === 'missileHit' || e.kind === 'energyHit') && e.slowdown)) {
    navigator.vibrate?.(40)
  }
  controller.handleSnapshot(state, compression)
  if (!outcomeShown && state.outcome !== 'running') {
    outcomeShown = true
    controller.setCompression(0)
    // kariérní deník flotily (C1): jen kampaň, ne volná bitva
    if (currentMissionId !== 'skirmish') recordMissionResult(state)
    showOutcome(state)
  }
}

// start: ?mission=id přeskočí menu (tlačítko ZNOVU), jinak výběr mise;
// při prvním spuštění kampaně se před výběrem jednou ukáže úvod příběhu
const requested = new URLSearchParams(location.search).get('mission')
// bookmark / ručně upravené ?mission= nesmí přeskočit linii — jen odemčené mise
if (requested && SCENARIOS[requested] && isMissionUnlocked(requested, loadCleared())) {
  showMissionPrep(requested)
} else if (!introSeen()) {
  showCampaignIntro(showStarMap)
} else {
  showStarMap()
}
