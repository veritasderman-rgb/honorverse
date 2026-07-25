/**
 * Bootstrap UI vrstvy: bridge → plot → panely → controller,
 * briefing overlay na start (pauza), win/lose overlay dle outcome.
 */
import { SimBridge } from './worker/bridge'
import { TacticalPlot } from './ui/plot'
import { startFleetView } from './ui/fleetview'
import { sceneFor } from './ui/scenes'
import { Panels, esc, fmtTime, type HudView } from './ui/panels'
import { MobileHud } from './ui/mobileHud'
import { TutorialView } from './ui/tutorialView'
import { getLang, t, toggleLang } from './ui/i18n'
import type { CombatStats } from './ui/combatStats'
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
import { applyBonusRewards } from './data/rewards'
import { campaignIntro, defeatGeneric, missionStory } from './data/story'
import {
  CAMPAIGN_NODES, GALAXY, GALAXY_TILT, isMissionUnlocked, NEBULAE, podReward,
  shipRewards, type CampaignNode,
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
// mobilní HUD (M1): stavový prstenec vlastní lodi; aktivní jen na body.phone.
// Composite krmí desktop Panels i mobilní prstenec stejnými snapshoty (HudView).
const mobileHud = new MobileHud(plotContainer)
// tutoriál (guided steps): spotlight + bublina; krmí se stejnými snapshoty
const tutorial = new TutorialView(plotContainer)
const hud: HudView = {
  addEvents: e => { panels.addEvents(e); mobileHud.addEvents(e); tutorial.addEvents(e) },
  update: (s, ui, f) => { panels.update(s, ui, f); mobileHud.update(s, ui, f); tutorial.update(s, ui, f) },
}
const controller = new UIController(bridge, plot, hud)

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

// Detekce telefonu → body.phone (kompaktní mobilní UX). Auto: hrubý ukazatel
// (pointer: coarse) A krátká strana viewportu < 430 px (odliší telefon od
// tabletu). Ruční přepínač 🖐 v topbaru přepíše (localStorage 'wob-mobile').
const MOBILE_KEY = 'wob-mobile'
function detectPhone(): boolean {
  let pref: string | null = null
  try { pref = localStorage.getItem(MOBILE_KEY) } catch { /* noop */ }
  if (pref === '1') return true
  if (pref === '0') return false
  // auto: telefon (hrubý pointer + krátká strana) NEBO úzký viewport ≤ 900 px —
  // body.phone teď řídí celou kompaktní vrstvu (dřív @media max-width:900px),
  // takže musí pokrýt i úzká okna na desktopu, jinak by ztratila kompaktní HUD
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const shortSide = Math.min(window.innerWidth, window.innerHeight)
  return (coarse && shortSide < 430) || window.innerWidth <= 900
}
// Tablet (iPad): hrubý pointer + velká krátká strana (≥ 600 px). Nezávislé na
// body.phone — jen zvětší dotykové cíle. Na šířku iPad drží plné desktop
// rozvržení (panely vidět), na výšku ho doplní kompaktní vrstva (body.phone).
function detectTablet(): boolean {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  const shortSide = Math.min(window.innerWidth, window.innerHeight)
  return coarse && shortSide >= 600
}
function applyDeviceClasses(): void {
  document.body.classList.toggle('phone', detectPhone())
  document.body.classList.toggle('tablet', detectTablet())
}
applyDeviceClasses()
// při otočení/resize přehodnoť (ruční volba phone se v detectPhone nepřepisuje;
// tablet je čistě z media/rozměru, takže se smí přehodnotit vždy)
for (const evt of ['resize', 'orientationchange']) {
  window.addEventListener(evt, () => applyDeviceClasses())
}

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
  applyBonusRewards(clone, loadCleared())  // + kořist z bočních operací (plošiny + lodě)
  bridge.startScenario(clone)
  tutorial.start(id)                       // guided steps (má-li je mise a nebyl dokončen)
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

/** testovací režim: odemkne všechny mise na mapě (localStorage / ?unlockall=1) */
const UNLOCK_ALL_KEY = 'wob-unlock-all'
function unlockAllOn(): boolean {
  try { return localStorage.getItem(UNLOCK_ALL_KEY) === '1' } catch { return false }
}
function setUnlockAll(on: boolean): void {
  try {
    if (on) localStorage.setItem(UNLOCK_ALL_KEY, '1')
    else localStorage.removeItem(UNLOCK_ALL_KEY)
  } catch { /* noop */ }
}
/** odemčení pro účely UI/bootstrapu: test-override NEBO postup kampaně */
function missionAvailable(id: string, cleared: readonly string[]): boolean {
  return unlockAllOn() || isMissionUnlocked(id, cleared)
}

/** úvod kampaně (první spuštění): CAMPAIGN_INTRO + POKRAČOVAT → výběr mise */
function showCampaignIntro(onDone: () => void): void {
  const el = overlay(
    `<h2>${t('intro.title')}</h2>`
    + `<div class="brief story">${esc(campaignIntro())}</div>`
    + `<button id="btn-intro-continue">${t('intro.continue')}</button>`,
  )
  el.classList.add('menu')
  setMenuBg(true)
  // namluvený úvod kampaně (existuje-li nahrávka)
  el.querySelector('h2')?.after(voPlayer('intro'))
  onTap(el.querySelector('#btn-intro-continue'), () => {
    stopVo()
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
  const avail = (n: CampaignNode): boolean => missionAvailable(n.id, clearedArr)
  const stateOf = (n: CampaignNode): SysState =>
    cleared.has(n.id) ? 'done' : avail(n) ? 'open' : 'locked'
  const byId = (id: string): CampaignNode | undefined => CAMPAIGN_NODES.find(n => n.id === id)

  // pozadí — spirální galaxie: prachový disk + jádro + hvězdy v ramenech
  const nebulae = NEBULAE.map(n =>
    `<ellipse class="neb" cx="${n.x}" cy="${n.y}" rx="${n.rx}" ry="${n.ry}" `
    + `style="fill:hsl(${n.hue} 60% 45%)"/>`).join('')
  const galaxyStars = GALAXY.map(s =>
    `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="hsl(${s.hue} 70% 82%)" fill-opacity="${s.b}"/>`
  ).join('')
  const core = `<ellipse class="gx-core" cx="500" cy="300" rx="150" ry="92"/>`
    + `<ellipse class="gx-core2" cx="500" cy="300" rx="60" ry="40"/>`
  // clip na vnější (neotočené) skupině ořeže do rámu; rotace uvnitř
  const galaxy = `<g class="galaxy" clip-path="url(#gxClip)">`
    + `<g transform="rotate(${GALAXY_TILT} 500 300)">`
    + nebulae + core + galaxyStars + `</g></g>`

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
    const tap = open ? ` data-mission="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(title)}"` : ''
    const anchor = n.x > 860 ? 'end' : n.x < 140 ? 'start' : 'middle'
    const tx = n.x > 860 ? n.x + 18 : n.x < 140 ? n.x - 18 : n.x
    // průhledná hit-plocha: zvětší dotykový cíl (na telefonu je uzel jinak
    // jen ~12–16 px) a překryje i popisek — celá skupina je aktivovatelná
    const hit = open
      ? `<rect class="hit" x="${n.x - 46}" y="${n.y - 24}" width="92" height="${68}" rx="8"/>`
      : ''
    return `<g class="sys ${st}${n.optional ? ' bonus' : ''}"${tap}>`
      + hit
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
      + `<text class="here-lbl" x="${here.x}" y="${here.y - 44}" text-anchor="middle">${t('map.youAreHere')}</text></g>`
    : ''

  return `<svg class="starmap-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet" `
    + `role="group" aria-label="Hvězdná mapa kampaně">`
    + `<defs>`
    + `<radialGradient id="gxCore" cx="50%" cy="50%" r="50%">`
    + `<stop offset="0%" stop-color="#fff6e6" stop-opacity="0.95"/>`
    + `<stop offset="28%" stop-color="#ffe6b0" stop-opacity="0.5"/>`
    + `<stop offset="70%" stop-color="#d8b46a" stop-opacity="0.12"/>`
    + `<stop offset="100%" stop-color="#d8b46a" stop-opacity="0"/>`
    + `</radialGradient>`
    + `<clipPath id="gxClip"><rect x="0" y="0" width="1000" height="600"/></clipPath>`
    + `</defs>`
    + galaxy
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
  // kořist z dokončených bočních operací (plošiny + lodě) — hlásíme na mapě
  const pods = podReward([...cleared])
  const prizeShips = shipRewards([...cleared])
  const rewardBits: string[] = []
  if (pods > 0) rewardBits.push(`+${pods} ${t('map.pods')}`)
  for (const s of prizeShips) rewardBits.push(esc(s.name))
  const rewardHint = rewardBits.length > 0
    ? ` · <b class="ok">★ ${rewardBits.join(', ')}</b> ${t('map.fromSideops')}`
    : ''
  const unlocked = unlockAllOn()
  const actions =
    `<div class="sm-actions">`
    + `<button id="btn-story-toggle">${t('menu.story')}</button>`
    + `<button id="btn-hall-toggle">${t('menu.hall')}</button>`
    + `<button id="btn-skirmish">${t('menu.skirmish')}</button>`
    + `<button id="btn-fleet">${t('menu.fleet')}</button>`
    + `<button id="btn-lang" class="dim">${t('menu.lang')}</button>`
    + `<button id="btn-unlock-all" class="${unlocked ? 'active' : 'dim'}">`
    + `${unlocked ? t('menu.unlockedAll') : t('menu.unlockAll')}</button>`
    + `</div>`
    + `<div id="story-body" class="brief story" style="display:none">${esc(campaignIntro())}</div>`
    + `<div id="hall-body" style="display:none" class="lb-box"><span class="dim">${t('hall.loading')}</span></div>`
  const el = overlay(
    `<h2>${t('map.title')}</h2>`
    + `<div class="sm-progress">${t('map.progress')} <b>${doneCount}/${total}</b> ${t('map.systems')}${rewardHint} — `
    + `${t('map.tapHint')} ${t('map.bonusHint')}</div>`
    + `<div class="starmap">${starMapSvg(cleared)}</div>`
    + actions,
  )
  el.classList.add('menu', 'menu-map')
  setMenuBg(true)

  onTap(el.querySelector('#btn-skirmish'), () => { el.remove(); showSkirmishBuilder() })
  onTap(el.querySelector('#btn-fleet'), () => { el.remove(); showFleetHall() })
  // přepínač jazyka (CS ⟷ EN) — překreslí menu v novém jazyce
  onTap(el.querySelector('#btn-lang'), () => { toggleLang(); el.remove(); showStarMap() })
  // testovací přepínač: odemkne/zamkne všechny soustavy a překreslí mapu
  onTap(el.querySelector('#btn-unlock-all'), () => {
    setUnlockAll(!unlockAllOn())
    el.remove()
    showStarMap()
  })

  // Síň slávy: celkové pořadí (součet nejlepších skóre per mise)
  const hallToggle = el.querySelector<HTMLButtonElement>('#btn-hall-toggle')
  const hallBody = el.querySelector<HTMLElement>('#hall-body')
  let hallLoaded = false
  onTap(hallToggle, () => {
    const open = hallBody!.style.display !== 'none'
    hallBody!.style.display = open ? 'none' : 'block'
    hallToggle!.textContent = open ? t('menu.hall') : t('menu.hallOpen')
    if (open || hallLoaded) return
    hallLoaded = true
    void fetchOverall(10).then(rows => {
      if (!rows || rows.length === 0) {
        hallBody!.innerHTML = `<span class="dim">${rows ? t('hall.empty') : t('hall.offline')}</span>`
        return
      }
      hallBody!.innerHTML = `<table class="lb-table"><tr><th>#</th><th>${t('hall.captain')}</th><th>${t('hall.points')}</th><th>${t('hall.missions')}</th></tr>`
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
    toggle!.textContent = open ? t('menu.story') : t('menu.storyOpen')
  })

  // klepnutí / Enter / mezerník na odemčené soustavě → příprava mise. SVG <g>
  // (role=button) nemá nativní aktivaci klávesnicí, proto Enter/Space ručně.
  el.querySelectorAll<SVGGElement>('g[data-mission]').forEach(g => {
    const go = (): void => { el.remove(); showMissionPrep(g.dataset.mission!) }
    onTap(g, go)
    g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        go()
      }
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
  mission01: 'scene-dd-patrol',      // královský DD na celní hlídce
  mission02: 'scene-convoy',
  mission03: 'scene-qship',          // obchodník odhaluje skrytý arzenál (Mercator!)
  mission04: 'scene-imperial-ca',    // imperiální křižník zblízka (co Aurora fotí)
  mission05: 'scene-missile-storm',  // královský křižník v raketové bouři (saturace)
  mission06: 'scene-royal-ca',       // Resolute běží domů
  mission07: 'scene-bc-pods',        // bitevní křižník vypouští plošiny (nájezd)
  mission08: 'scene-crossfire',      // křižná palba do otevřeného hrdla (stěna)
  mission09: 'scene-dn-alpha',       // superdreadnought vypouští roje modulů
  mission10: 'scene-shipyard',       // orbitální loděnice — základna Cádiz
  mission11: 'scene-dn-majesty',     // monumentální superdreadnought nad planetou
  // boční operace
  side01: 'scene-junction',          // mezihvězdná křižovatka (kurýr v Pomezí)
  side02: 'scene-battle',
  side03: 'scene-station',
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
 * scéna s Ken Burns pohybem + MLUVÍCÍ ADMIRÁL v okně (vid/admiral.mp4 —
 * smyčka BEZ zvuku; hlas dodává voiceover z audio/vo). Chyba načtení →
 * graceful fallback na obrázek/nic. Vrací element k vložení, nebo null.
 */
function briefingMedia(id: string): HTMLElement | null {
  const scene = MISSION_SCENES[id]
  const makeImg = (): HTMLImageElement | null => {
    if (!scene) return null
    const img = document.createElement('img')
    img.className = 'brief-img kb' // kb = Ken Burns pan/zoom (filmový prolog)
    img.src = `img/${scene}.png`
    img.alt = ''
    img.onerror = () => img.remove()
    return img
  }
  // okno s admirálem: smyčka bez zvuku (originální stopu nahrazuje VO);
  // když soubor chybí, okno se tiše uklidí
  const makeAdmiral = (): HTMLElement => {
    const box = document.createElement('div')
    box.className = 'brief-admiral'
    const v = document.createElement('video')
    v.src = 'vid/admiral.mp4'
    v.autoplay = true
    v.muted = true
    v.loop = true
    v.setAttribute('playsinline', '')
    v.controls = false
    v.addEventListener('error', () => box.remove())
    const tag = document.createElement('div')
    tag.className = 'brief-admiral-tag'
    tag.textContent = t('brief.admiral')
    box.append(v, tag)
    void v.play?.().catch(() => { /* autoplay blokován */ })
    return box
  }
  const vid = MISSION_VIDEOS[id]
  if (vid) {
    const v = document.createElement('video')
    v.className = 'brief-vid'
    v.src = `vid/${vid}.mp4`
    v.autoplay = true
    v.muted = true
    v.loop = true
    v.setAttribute('playsinline', '')
    v.controls = false
    if (scene) v.poster = `img/${scene}.png`
    // video chybí/nejde přehrát → statická scéna s admirálem (nebo nic)
    v.addEventListener('error', () => {
      const wrap = document.createElement('div')
      wrap.className = 'brief-scene'
      const img = makeImg()
      if (img) wrap.appendChild(img)
      wrap.appendChild(makeAdmiral())
      if (v.parentElement) v.replaceWith(wrap)
      else v.remove()
    })
    void v.play?.().catch(() => { /* autoplay blokován — poster zůstává */ })
    return v
  }
  const img = makeImg()
  if (!img) return null
  const wrap = document.createElement('div')
  wrap.className = 'brief-scene'
  wrap.append(img, makeAdmiral())
  return wrap
}

// ---------- voiceover (namluvené prology/epilogy misí) ----------

/** právě hrající VO — nový přehrávač či zavření overlaye ho zastaví */
let activeVo: HTMLAudioElement | null = null

/** zastaví aktuální voiceover (volat při START/ZPĚT/odchodu z overlaye) */
function stopVo(): void {
  activeVo?.pause()
  activeVo = null
}

/**
 * Voiceover přehrávač: zkusí `audio/vo/<name>-<lang>.mp3`; dokud soubor
 * neexistuje, nezobrazí se nic (stejný vzor jako video briefing). Po
 * načtení se přehraje sám (overlay se otvírá po uživatelském gestu)
 * a nabídne ⏸/▶ přepínač. Názvy souborů viz docs/VO_SCRIPT.md.
 */
function voPlayer(name: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'vo-row'
  wrap.style.display = 'none'
  // <audio> s více <source> — prohlížeč si vybere první přehratelný formát
  // (mp3 preferovaný; m4a/wav pro pohodlí při nahrávání)
  const audio = document.createElement('audio')
  audio.preload = 'auto'
  let lastSource: HTMLSourceElement | null = null
  for (const ext of ['mp3', 'm4a', 'wav']) {
    const s = document.createElement('source')
    s.src = `audio/vo/${name}-${getLang()}.${ext}`
    audio.appendChild(s)
    lastSource = s
  }
  const btn = document.createElement('button')
  btn.className = 'vo-btn'
  const setLabel = (): void => { btn.textContent = audio.paused ? t('vo.play') : t('vo.pause') }
  audio.addEventListener('canplaythrough', () => {
    // overlay mezitím zavřený (START/ZPĚT dřív, než se nahrávka donačetla):
    // opožděný start by hrál přes bojiště — odpojený řádek nic nespouští
    if (!wrap.isConnected) return
    if (wrap.style.display !== 'none') return
    stopVo()
    activeVo = audio
    wrap.style.display = 'block'
    void audio.play().catch(() => { /* autoplay blokován — zůstane ▶ */ })
    setLabel()
  }, { once: true })
  for (const ev of ['play', 'pause', 'ended']) audio.addEventListener(ev, setLabel)
  // selhání VŠECH zdrojů hlásí error na posledním <source> — řádek se uklidí
  lastSource?.addEventListener('error', () => wrap.remove())
  btn.addEventListener('click', () => {
    if (audio.paused) { stopVo(); activeVo = audio; void audio.play().catch(() => { /* noop */ }) }
    else audio.pause()
  })
  setLabel()
  audio.load()
  wrap.appendChild(btn)
  return wrap
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
  const prolog = missionStory(id)?.prolog
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
  // namluvený prolog (existuje-li nahrávka — viz docs/VO_SCRIPT.md)
  el.querySelector('h2')?.after(voPlayer(`${id}-prolog`))
  el.addEventListener('click', e => {
    const t = (e.target as Element).closest<HTMLElement>('[data-ld]')
    if (!t) return
    sel = t.getAttribute('data-ld') as LoadoutId
    el.querySelectorAll('.ld-btn').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-ld') === sel))
    el.querySelector('#ld-desc')!.textContent = presetById(sel).desc
  })
  onTap(el.querySelector('#btn-prep-back'), () => { stopVo(); el.remove(); showStarMap() })
  onTap(el.querySelector('#btn-start'), () => {
    stopVo()
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
  const stats = controller.stats.scoring
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
  const story = missionStory(currentMissionId)
  let epilog = win ? story?.epilog : (story?.epilogLose ?? (story ? defeatGeneric() : undefined))
  // jméno VO nahrávky epilogu (viz docs/VO_SCRIPT.md): výhra/porážka/konec dle flagu
  let epilogVo = win ? `${currentMissionId}-epilog`
    : (story?.epilogLose ? `${currentMissionId}-epiloglose` : 'defeat-generic')
  // finále s více konci: epilog dle flagu stavu (ending-orders/-spirit/-clean)
  if (win && story?.epilogByFlag) {
    for (const [flag, text] of Object.entries(story.epilogByFlag)) {
      if (state.flags[flag]) { epilog = text; epilogVo = `${currentMissionId}-epilog-${flag}`; break }
    }
  }
  const el = overlay(
    `<h2 class="${win ? 'win' : 'lose'}">${win ? 'VÍTĚZSTVÍ' : 'PORÁŽKA'}</h2>`
    + `<div class="brief">Mise ukončena v čase ${fmtTime(state.t)}.</div>`
    + objs
    + afterActionHtml(state, controller.stats.report)
    + scoreHtml
    + (epilog ? `<div class="brief story story-epilog">${esc(epilog)}</div>` : '')
    + `<div style="margin-top:14px">`
    + `<button id="btn-again">ZNOVU</button> `
    + `<button id="btn-menu">VÝBĚR MISE</button>`
    + `</div>`,
  )
  // namluvený epilog (existuje-li nahrávka)
  if (epilog) el.querySelector('.story-epilog')?.before(voPlayer(epilogVo))

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
  controller.stats.reset() // bojová statistika (sdílený tracker) — per mise
  panels.resetStats()      // + HUD logy a rozpracované salvy
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
const params = new URLSearchParams(location.search)
if (params.get('unlockall') === '1') setUnlockAll(true) // testovací odemčení z URL
const requested = params.get('mission')
// bookmark / ručně upravené ?mission= nesmí přeskočit linii — jen odemčené mise
// (test-override „odemknout vše" tuhle bránu obchází záměrně)
if (requested && SCENARIOS[requested] && missionAvailable(requested, loadCleared())) {
  showMissionPrep(requested)
} else if (!introSeen()) {
  showCampaignIntro(showStarMap)
} else {
  showStarMap()
}
