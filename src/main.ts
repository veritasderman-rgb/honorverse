/**
 * Bootstrap UI vrstvy: bridge → plot → panely → controller,
 * briefing overlay na start (pauza), win/lose overlay dle outcome.
 */
import { SimBridge } from './worker/bridge'
import { TacticalPlot } from './ui/plot'
import { Panels, esc, fmtTime } from './ui/panels'
import { UIController } from './ui/input'
import { AudioManager } from './ui/audio'
import { SCENARIOS } from './data/missions'
import { CAMPAIGN_INTRO, DEFEAT_GENERIC, MISSION_STORY } from './data/story'
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

// hook pro smoke testy (Playwright) — čtení stavu plotu zvenku
Object.assign(window, { __wob: { plot } })

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

/** první věta briefingu (do karty výběru mise) */
function firstSentence(text: string): string {
  const i = text.indexOf('.')
  return i >= 0 ? text.slice(0, i + 1) : text
}

/** localStorage flag „úvod kampaně už hráč viděl" */
const INTRO_SEEN_KEY = 'wob-campaign-intro-seen'

const introSeen = (): boolean => {
  try { return localStorage.getItem(INTRO_SEEN_KEY) === '1' } catch { return false }
}
const markIntroSeen = (): void => {
  try { localStorage.setItem(INTRO_SEEN_KEY, '1') } catch { /* noop */ }
}

/** úvod kampaně (první spuštění): CAMPAIGN_INTRO + POKRAČOVAT → výběr mise */
function showCampaignIntro(onDone: () => void): void {
  const el = overlay(
    `<h2>WALL OF BATTLE — KAMPAŇ</h2>`
    + `<div class="brief story">${esc(CAMPAIGN_INTRO)}</div>`
    + `<button id="btn-intro-continue">POKRAČOVAT</button>`,
  )
  onTap(el.querySelector('#btn-intro-continue'), () => {
    markIntroSeen()
    el.remove()
    onDone()
  })
}

/** úvodní menu: číslovaný seznam misí kampaně (1→10) + rozbalitelný příběh */
function showMissionSelect(): void {
  // kampaňové pořadí = pořadí registrace v SCENARIOS (mission01 → mission10)
  const rows = Object.values(SCENARIOS).map((sc, i) =>
    `<div class="mission-row">`
    + `<button data-mission="${esc(sc.id)}">${i + 1}. ${esc(sc.title)}</button>`
    + `<div class="mission-desc">${esc(firstSentence(sc.briefing))}</div>`
    + `</div>`,
  ).join('')
  const story =
    `<div class="story-section">`
    + `<button id="btn-story-toggle">▸ PŘÍBĚH KAMPANĚ</button>`
    + `<div id="story-body" class="brief story" style="display:none">${esc(CAMPAIGN_INTRO)}</div>`
    + `</div>`
  const el = overlay(`<h2>VÝBĚR MISE</h2>${story}${rows}`)
  const toggle = el.querySelector<HTMLButtonElement>('#btn-story-toggle')
  const body = el.querySelector<HTMLElement>('#story-body')
  onTap(toggle, () => {
    const open = body!.style.display !== 'none'
    body!.style.display = open ? 'none' : 'block'
    toggle!.textContent = `${open ? '▸' : '▾'} PŘÍBĚH KAMPANĚ`
  })
  el.querySelectorAll<HTMLButtonElement>('button[data-mission]').forEach(btn => {
    onTap(btn, () => {
      el.remove()
      bridge.start(btn.dataset.mission!)
    })
  })
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

function showBriefing(sc: Scenario): void {
  const scene = MISSION_SCENES[sc.id]
  const prolog = MISSION_STORY[sc.id]?.prolog
  const el = overlay(
    (scene ? `<img class="brief-img" src="img/${scene}.png" alt="" onerror="this.remove()">` : '')
    + `<h2>${esc(sc.title)}</h2>`
    + (prolog ? `<div class="brief story">${esc(prolog)}</div>` : '')
    + `<div class="brief">${esc(sc.briefing)}</div>`
    + `<button id="btn-start">START</button>`,
  )
  onTap(el.querySelector('#btn-start'), () => {
    el.remove()
    audio.setMenuMode(false) // konec menu/briefingu → adaptivní hudba dle boje
    controller.setCompression(1)
  })
}

function showOutcome(state: SimState): void {
  const win = state.outcome === 'win'
  const objs = state.objectives.map(o => {
    const mark = o.state === 'done' ? '■' : o.state === 'failed' ? '✗' : '□'
    return `<div class="obj ${o.state}">${mark} ${esc(o.text)}</div>`
  }).join('')
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
    + (epilog ? `<div class="brief story story-epilog">${esc(epilog)}</div>` : '')
    + `<div style="margin-top:14px">`
    + `<button id="btn-again">ZNOVU</button> `
    + `<button id="btn-menu">VÝBĚR MISE</button>`
    + `</div>`,
  )
  // ZNOVU = reload se stejnou misí; VÝBĚR MISE = reload bez parametru → menu
  onTap(el.querySelector('#btn-again'), () => {
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
  showBriefing(scenario)
  plot.start()
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
    showOutcome(state)
  }
}

// start: ?mission=id přeskočí menu (tlačítko ZNOVU), jinak výběr mise;
// při prvním spuštění kampaně se před výběrem jednou ukáže úvod příběhu
const requested = new URLSearchParams(location.search).get('mission')
if (requested && SCENARIOS[requested]) bridge.start(requested)
else if (!introSeen()) showCampaignIntro(showMissionSelect)
else showMissionSelect()
