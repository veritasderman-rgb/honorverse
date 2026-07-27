/**
 * Bootstrap UI vrstvy: bridge → plot → panely → controller,
 * briefing overlay na start (pauza), win/lose overlay dle outcome.
 */
import { inject } from '@vercel/analytics'
import { SimBridge } from './worker/bridge'
import { TacticalPlot } from './ui/plot'
import { startFleetView } from './ui/fleetview'
import { sceneFor } from './ui/scenes'
import { Panels, SHIP_IMAGES, esc, fmtTime, type HudView } from './ui/panels'
import { MobileHud } from './ui/mobileHud'
import { TutorialView } from './ui/tutorialView'
import { track } from './ui/analytics'
import { clearVoLinesQueue, configureVoLines, stopVoLines, voLinesOnEvents } from './ui/voLines'
import { fmtDec, fmtNum, getLang, t, t as tr, tf, toggleLang } from './ui/i18n'
import { missionBriefing, missionTitle, objectiveText } from './data/briefings'
import { shipClassLore, shipClassName } from './data/shipsEn'
import type { CombatStats } from './ui/combatStats'
import { UIController } from './ui/input'
import { AudioManager } from './ui/audio'
import { SCENARIOS } from './data/missions'
import { SHIP_CLASSES } from './data/defs'
import {
  buildSkirmish, fleetTotal, IMPERIAL_SURFACE, RANGE_PRESETS, SKIRMISH_CLASSES,
  type SkirmishConfig,
} from './data/skirmish'
import {
  applyVeterancy, loadFleet, recordMissionResult, resetFleet, tierOf,
} from './ui/fleetlog'
import {
  applyLoadout, LOADOUTS, loadPreset, presetById, savePreset, type LoadoutId,
} from './data/loadout'
import { applyBonusRewards } from './data/rewards'
import { campaignIntro, cinematicLines, defeatGeneric, missionStory } from './data/story'
import {
  CAMPAIGN_NODES, GALAXY, GALAXY_TILT, isMissionUnlocked, NEBULAE, podReward,
  shipRewards, type CampaignNode,
} from './data/campaign'
import { scoreMission } from './sim/score'
import {
  fetchOverall, fetchRank, fetchTop, rankSummary, submitScore,
} from './ui/leaderboard'
import type { Scenario, SimEvent, SimState } from './sim/types'
import { localizeEventText } from './data/localizeEvent'

// Initialize Vercel Web Analytics
inject()

const canvas = document.getElementById('plot') as HTMLCanvasElement
const plotContainer = document.getElementById('plot-container') as HTMLElement
const topbar = document.getElementById('topbar') as HTMLElement

const bridge = new SimBridge()
bridge.lang = getLang() === 'en' ? 'en' : 'cs' // texty simu v jazyce hráče
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
  addEvents: e => {
    const evs = localizeEvents(e)
    panels.addEvents(evs); mobileHud.addEvents(evs); tutorial.addEvents(evs); voLinesOnEvents(evs)
  },
  update: (s, ui, f) => { panels.update(s, ui, f); mobileHud.update(s, ui, f); tutorial.update(s, ui, f) },
}
/** EN mutace textů eventů (viz data/localizeEvent) — aplikuje se centrálně
 *  před rozdáním do HUD, toastů, logů i tutorialu */
function localizeEvents(events: SimEvent[]): SimEvent[] {
  if (getLang() !== 'en') return events
  return events.map(ev => {
    const en = localizeEventText(ev)
    return en !== ev.text ? { ...ev, text: en } : ev
  })
}

// namluvené hlásky posádky/komunikace (voId na eventech) — sdílí mute a
// hlasitost efektů se zvukem hry
configureVoLines(() => audio.muted, () => audio.sfxVolume)
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

// analytika: start aplikace (po detekci zařízení, ať je device správně)
track('app_start')

// výsuvné šuplíky HUD sloupců (telefonní breakpoint — z��ložky ◧/◨)
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
  track('mission_start', { loadout: preset ?? loadPreset() }, id)
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

/**
 * Filmové intro (titulní obrazovka): video souboje lodí přes celou obrazovku,
 * epické titulky a voiceover (audio/vo/cinematic-<lang>.mp3, existuje-li).
 * Video jede nejdřív ztlumené pod titulní kartou (autoplay bez zvuku projde
 * všude); zvuk, vyprávění a titulky startuje až tlačítko — uživatelské gesto,
 * po kterém prohlížeče přehrávání se zvukem dovolí. Křížek kdykoli přeskočí.
 */
/** klipy filmového intra — po dojetí se střídají, ať krátká smyčka nebije
 *  do očí; další soubor stačí nahrát do public/vid/ a přidat sem */
const CINE_CLIPS = [
  'vid/intro-battle.mp4', 'vid/intro-battle-2.mp4', 'vid/intro-battle-3.mp4',
  'vid/intro-battle-4.mp4', 'vid/intro-battle-5.mp4',
  'vid/brief-mission02.mp4', 'vid/brief-mission06.mp4',
]

function showCinematicIntro(onDone: () => void): void {
  stopVo()
  const el = document.createElement('div')
  el.id = 'cine'
  el.innerHTML =
    `<video src="${CINE_CLIPS[0]}" muted autoplay playsinline preload="auto"></video>`
    + `<div id="cine-caption"></div>`
    + `<div id="cine-title"><h1>WALL OF BATTLE</h1>`
    + `<button id="cine-enter">${t('cine.enter')}</button></div>`
    + `<button id="cine-skip" aria-label="${t('cine.skip')}" title="${t('cine.skip')}">×</button>`
  document.body.appendChild(el)
  const vid = el.querySelector('video')!
  const caption = el.querySelector<HTMLElement>('#cine-caption')!
  audio.duck(true)
  // rotace klipů místo loopu jednoho videa (mute/hlasitost se na elementu drží)
  let clip = 0
  vid.addEventListener('ended', () => {
    clip = (clip + 1) % CINE_CLIPS.length
    vid.src = CINE_CLIPS[clip]
    void vid.play().catch(() => { /* pauza — nevadí, titulky jedou */ })
  })

  // VO: připravit dopředu; hraje se jen když se nahrávka stihla načíst
  const vo = new Audio(`audio/vo/cinematic-${getLang()}.mp3`)
  vo.preload = 'auto'
  let voReady = false
  vo.addEventListener('canplaythrough', () => { voReady = true }, { once: true })

  const timers: number[] = []
  let finished = false
  const finish = (): void => {
    if (finished) return
    finished = true
    for (const id of timers) clearTimeout(id)
    vo.pause()
    vid.pause()
    audio.duck(false)
    markIntroSeen()
    el.remove()
    onDone()
  }
  onTap(el.querySelector('#cine-skip'), () => { track('cine_skip'); finish() })

  const LINE_MS = 5200 // jedna věta: nájezd, čtení, odchod (viz CSS animace)
  onTap(el.querySelector('#cine-enter'), () => {
    el.querySelector('#cine-title')?.remove()
    // restart od začátku se zvukem — výbuchy z videa jsou součást zážitku;
    // globální mute a hlasitost efektů ale platí i tady (Codex review)
    vid.muted = audio.muted
    vid.volume = audio.sfxVolume
    vo.volume = audio.sfxVolume
    vid.currentTime = 0
    void vid.play().catch(() => { /* blokováno — titulky pojedou i tak */ })
    if (voReady && !audio.muted) void vo.play().catch(() => { /* bez VO */ })
    track('cine_start')
    const lines = cinematicLines()
    lines.forEach((text, i) => {
      timers.push(window.setTimeout(() => {
        caption.textContent = text
        caption.classList.remove('show')
        void caption.offsetWidth // restart CSS animace mezi větami
        caption.classList.add('show')
      }, i * LINE_MS))
    })
    // konec po titulcích; rozehrané vyprávění nechat doznít (tvrdý strop)
    const capEnd = lines.length * LINE_MS + 1200
    timers.push(window.setTimeout(() => {
      if (vo.paused || vo.ended) { finish(); return }
      vo.addEventListener('ended', finish, { once: true })
      timers.push(window.setTimeout(finish, 20_000))
    }, capEnd))
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
    const title = missionTitle(n.id, SCENARIOS[n.id]?.title ?? n.id)
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
    + `role="group" aria-label="${esc(t('map.aria'))}">`
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
    + `<button id="btn-arcade" title="${esc(t('arcade.tip'))}">${t('menu.arcade')} (${arcadeLeft()})</button>`
    + `<button id="btn-fleet">${t('menu.fleet')}</button>`
    + `<button id="btn-cine">${t('menu.intro')}</button>`
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

  // odchod z mapy: rozehrané vyprávění příběhu nesmí hrát přes další obrazovku
  const leave = (): void => { stopVo(); el.remove() }
  onTap(el.querySelector('#btn-skirmish'), () => { leave(); showSkirmishBuilder() })
  // arkáda: limit her — bez zbývajících her jen vysvětlení, mapa zůstává
  onTap(el.querySelector('#btn-arcade'), () => {
    if (!consumeArcadePlay()) {
      const info = overlay(
        `<h2>${t('arcade.noneTitle')}</h2>`
        + `<div class="brief">${esc(t('arcade.none'))}</div>`
        + `<button id="arc-ok">${t('common.ok').toUpperCase()}</button>`,
      )
      info.classList.add('clscard')
      onTap(info.querySelector('#arc-ok'), () => info.remove())
      return
    }
    leave()
    startArcade()
  })
  onTap(el.querySelector('#btn-fleet'), () => { leave(); showFleetHall() })
  // přehrát filmové intro znovu (mapa zůstává pod ním)
  onTap(el.querySelector('#btn-cine'), () => showCinematicIntro(() => { /* zpět na mapu */ }))
  // přepínač jazyka (CS ⟷ EN) — překreslí menu v novém jazyce
  onTap(el.querySelector('#btn-lang'), () => {
    track('lang_set', { to: toggleLang() })
    bridge.lang = getLang() === 'en' ? 'en' : 'cs' // příští mise v novém jazyce
    applyStaticI18n()
    leave()
    showStarMap()
  })
  // testovací přepínač: odemkne/zamkne všechny soustavy a p��ekreslí mapu
  onTap(el.querySelector('#btn-unlock-all'), () => {
    setUnlockAll(!unlockAllOn())
    leave()
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
  let storyVoAdded = false
  onTap(toggle, () => {
    const open = body!.style.display !== 'none'
    body!.style.display = open ? 'none' : 'block'
    toggle!.textContent = open ? t('menu.story') : t('menu.storyOpen')
    // namluvený úvod kampaně přehrávat s otevřeným textem (dřív první spuštění)
    if (open) stopVo()
    else if (!storyVoAdded) { storyVoAdded = true; body!.prepend(voPlayer('intro')) }
  })

  // klepnutí / Enter / mezerník na odemčené soustavě → příprava mise. SVG <g>
  // (role=button) nemá nativní aktivaci klávesnicí, proto Enter/Space ručně.
  el.querySelectorAll<SVGGElement>('g[data-mission]').forEach(g => {
    const go = (): void => { leave(); showMissionPrep(g.dataset.mission!) }
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
    ? `<div class="dim">${esc(t('fh.noVets'))}</div>`
    : active.map(([name, r]) => {
      const tier = tierOf(r.battles)
      const hull = SHIP_CLASSES[r.classId]?.hullCode ?? '?'
      const battles = r.battles === 1 ? t('fh.battle1') : r.battles < 5 ? t('fh.battle2') : t('fh.battle5')
      return `<div class="row"><span>${esc(name)} <span class="dim">(${esc(hull)})</span></span>`
        + `<span class="${tier === 'elite' ? 'ok' : ''}">${t(`fh.tier.${tier}`)} · ${r.battles} ${battles}</span></div>`
    }).join('')
  const lostHtml = log.lost.length === 0
    ? `<div class="dim">${esc(t('fh.noLosses'))}</div>`
    : log.lost.map(l =>
      `<div class="row"><span class="bad">✕ ${esc(l.name)}</span><span class="dim">${esc(SHIP_CLASSES[l.classId]?.hullCode ?? '?')}</span></div>`).join('')

  const el = overlay(
    `<h2>${t('fh.title')}</h2>`
    + `<div class="brief">${tf('fh.intro', { kills: `<b>${log.kills}</b>` })}</div>`
    + `<div class="score-block"><div class="score-total">${t('fh.crews')}</div>${activeHtml}</div>`
    + `<div class="score-block"><div class="score-total">${t('fh.memorial')}</div>${lostHtml}</div>`
    + `<div style="margin-top:14px">`
    + `<button id="fl-back">${t('prep.back')}</button> `
    + `<button id="fl-reset" class="dim">${t('fh.reset')}</button></div>`,
  )
  onTap(el.querySelector('#fl-back'), () => { el.remove(); showStarMap() })
  onTap(el.querySelector('#fl-reset'), () => {
    resetFleet()
    el.remove()
    showFleetHall()
  })
}

/** Stavba volné bitvy (E1): steppery flotil, vzdálenost, seed → BOJ. */
// ---------- ukládání rozehrané mise (lokálně, jeden slot) ----------

/** Save = kompletní SimState (rng i triggery žijí v něm — viz sim/rng.ts);
 *  jen kampaň, skirmish/arkáda jsou krátké. Jeden slot: poslední rozehraná. */
const SAVE_KEY = 'wob-mission-save'
interface MissionSave {
  missionId: string
  t: number
  savedAt: number
  state: SimState
  /** akumulovaná bojová statistika (skóre/leaderboard) — žije v UI, ne v simu */
  stats?: CombatStats
}
/** statistika čekající na obnovu — onReady ji aplikuje PO svém resetu */
let pendingStatsRestore: CombatStats | null = null

function loadMissionSave(): MissionSave | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as MissionSave
    return s && typeof s.missionId === 'string' && s.state ? s : null
  } catch { return null }
}
function clearMissionSave(): void {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* noop */ }
}
/** poslední běžící stav (pro okamžitý save při zavření stránky) */
let runningState: SimState | null = null
let lastAutosaveAt = 0

function autosaveMission(state: SimState): void {
  if (currentMissionId === 'skirmish' || currentMissionId === '' || state.outcome !== 'running') return
  try {
    // events vyprázdnit: snapshotová dávka už je započtená ve statistice
    // i zobrazená — po obnově by se počítala (a ukazovala) podruhé
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionId: currentMissionId, t: state.t, savedAt: Date.now(),
      state: { ...state, events: [] }, stats: controller.stats.report,
    }))
  } catch { /* plné úložiště — zkusíme příště */ }
}

// zavření/schování stránky (mobil: přepnutí aplikace) → okamžitý save
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && runningState) autosaveMission(runningState)
})
window.addEventListener('pagehide', () => { if (runningState) autosaveMission(runningState) })

// ---------- arkáda: okamžitá bitva zblízka s limitem her ----------

/** volných her za session (sessionStorage); bonusy za vyhrané mise navíc */
const ARCADE_FREE_PER_SESSION = 5
const ARCADE_USED_KEY = 'wob-arcade-used'   // sessionStorage — spotřeba v session
const ARCADE_BONUS_KEY = 'wob-arcade-bonus' // localStorage — +1 za vyhranou misi kampaně

const arcadeUsed = (): number => {
  try { return Number(sessionStorage.getItem(ARCADE_USED_KEY)) || 0 } catch { return 0 }
}
const arcadeBonus = (): number => {
  try { return Number(localStorage.getItem(ARCADE_BONUS_KEY)) || 0 } catch { return 0 }
}
/** kolik arkádových her ještě zbývá (základ session + trvalé bonusy) */
const arcadeLeft = (): number =>
  Math.max(0, ARCADE_FREE_PER_SESSION - arcadeUsed()) + arcadeBonus()

/** odměna za vyhranou kampaňovou misi: +1 arkádová hra (trvalá) */
function grantArcadeBonus(): void {
  try { localStorage.setItem(ARCADE_BONUS_KEY, String(arcadeBonus() + 1)) } catch { /* noop */ }
}

/** odečte jednu hru (nejdřív session základ, pak bonusy); false = vyčerpáno */
function consumeArcadePlay(): boolean {
  if (arcadeUsed() < ARCADE_FREE_PER_SESSION) {
    try { sessionStorage.setItem(ARCADE_USED_KEY, String(arcadeUsed() + 1)) } catch { /* noop */ }
    return true
  }
  if (arcadeBonus() > 0) {
    try { localStorage.setItem(ARCADE_BONUS_KEY, String(arcadeBonus() - 1)) } catch { /* noop */ }
    return true
  }
  return false
}

/** náhodné sestavy arkády — malé flotily, ať je bitva čitelná a rychlá */
const ARCADE_PRESETS: Array<{ player: Record<string, number>; enemy: Record<string, number> }> = [
  { player: { 'dd-vichr': 2 }, enemy: { 'dd-vichr': 2 } },
  { player: { 'cl-sokol': 1, 'dd-vichr': 1 }, enemy: { 'cl-sokol': 1, 'dd-vichr': 1 } },
  { player: { 'ca-bastion': 1 }, enemy: { 'cl-sokol': 2 } },
  { player: { 'bc-praporec': 1 }, enemy: { 'ca-bastion': 1, 'dd-vichr': 2 } },
]

/** start arkády: náhodná sestava zblízka (1,5 M km), bez briefingu — rovnou boj */
function startArcade(): void {
  const preset = ARCADE_PRESETS[Math.floor(Math.random() * ARCADE_PRESETS.length)]
  track('arcade_start', { left: arcadeLeft() })
  setMenuBg(false)
  skipBriefing = true
  bridge.startScenario(buildSkirmish({
    player: { ...preset.player }, enemy: { ...preset.enemy },
    rangeKm: 1_500_000, seed: Math.floor(Math.random() * 1e9),
  }))
}

/**
 * Karta třídy lodi: ilustrace, plný typ (Lehký křižník…), jméno třídy,
 * parametry a lore. Otevírá se ze stavby bitvy klepnutím na název typu;
 * vrství se NAD aktuální overlay (ten zůstává).
 */
function showClassCard(classId: string, side: 'player' | 'enemy' = 'player'): void {
  const def = SHIP_CLASSES[classId]
  if (!def) return
  // nepřátelská strana: stejný trup, ale imperiální jméno třídy a ilustrace
  const imp = side === 'enemy' ? IMPERIAL_SURFACE[classId] : undefined
  const img = imp?.img ?? SHIP_IMAGES[classId] ?? SHIP_IMAGES[def.hullCode]
  const lore = imp ? t('sk.impLore') : shipClassLore(def)
  const kv: [string, string][] = [
    [t('cls.tonnage'), `${fmtNum(def.tonnage / 1000)} kt`],
    [t('cls.maxAccel'), `${def.maxAccelG} g`],
    [t('cls.tubes'), String(def.tubesPerBroadside)],
    [t('cls.cmL'), String(def.cmLaunchers)],
    [t('cls.pdlc'), String(def.pdlcClusters)],
    [t('cls.sidewalls'), String(def.sidewallStrength)],
  ]
  const el = overlay(
    (img ? `<img class="clscard-img" src="img/${esc(img)}.png" alt="" onerror="this.remove()">` : '')
    + `<h2>${esc(t(`hull.${def.hullCode}`))}</h2>`
    + `<div class="dim">${esc(imp ? (getLang() === 'en' ? imp.nameEn : imp.name) : shipClassName(def))} · ${esc(def.hullCode)}</div>`
    + `<div class="cls-table clscard-table">`
    + kv.map(([k, v]) => `<span class="dim">${esc(k)}</span><span>${esc(v)}</span>`).join('')
    + `</div>`
    + (lore ? `<div class="cls-lore">${esc(lore)}</div>` : '')
    + `<div style="margin-top:12px"><button id="clscard-close">${t('clscard.close')}</button></div>`,
  )
  el.classList.add('clscard')
  onTap(el.querySelector('#clscard-close'), () => el.remove())
}

function showSkirmishBuilder(): void {
  const cfg: SkirmishConfig = {
    player: { 'ca-bastion': 1, 'dd-vichr': 2 },
    enemy: { 'ca-bastion': 1, 'dd-vichr': 2 },
    rangeKm: 6_000_000,
    seed: Math.floor(Math.random() * 1e9),
  }
  const clsRow = (side: 'player' | 'enemy', cls: string): string => {
    const hull = SHIP_CLASSES[cls]?.hullCode ?? '?'
    const def = SHIP_CLASSES[cls]
    const nm = def ? shipClassName(def) : cls
    // plný název typu (Lehký křižník…) místo kódu; klepnutí otevře kartu třídy
    // nepřátelský sloupec ukazuje imperiální jméno třídy (viz IMPERIAL_SURFACE);
    // jméno třídy viditelně v řádku — tooltip na dotyku neexistuje
    const impNm = side === 'enemy' ? IMPERIAL_SURFACE[cls] : undefined
    const rowNm = impNm ? (getLang() === 'en' ? impNm.nameEn : impNm.name) : nm
    return `<div class="sk-row">`
      + `<button class="sk-name" data-clscard="${esc(cls)}" data-cardside="${side}" title="${esc(rowNm)} — ${esc(t('sk.detailTip'))}">`
      + `${esc(t(`hull.${hull}`))}<span class="sk-cls">${esc(rowNm)}</span></button>`
      + `<button class="sk-step" data-sk="dec" data-side="${side}" data-cls="${cls}">−</button>`
      + `<span class="sk-n" id="sk-${side}-${cls}">${cfg[side][cls] ?? 0}</span>`
      + `<button class="sk-step" data-sk="inc" data-side="${side}" data-cls="${cls}">+</button>`
      + `</div>`
  }
  const col = (side: 'player' | 'enemy', title: string): string =>
    `<div class="sk-col"><div class="sk-col-h">${title}</div>`
    + SKIRMISH_CLASSES.map(c => clsRow(side, c)).join('')
    + `<div class="sk-total">${t('sk.total')} <b id="sk-total-${side}">${fleetTotal(cfg[side])}</b></div></div>`
  const ranges = RANGE_PRESETS.map((r, i) =>
    `<button class="sk-range${r.km === cfg.rangeKm ? ' active' : ''}" data-km="${r.km}">${esc(t(`sk.range${i}`))}</button>`).join('')

  const el = overlay(
    `<h2>${t('sk.title')}</h2>`
    + `<div class="sk-grid">${col('player', t('sk.yours'))}${col('enemy', t('sk.enemy'))}</div>`
    + `<div class="sk-opts"><span>${t('sk.distance')}</span> ${ranges}</div>`
    + `<div class="sk-opts"><span>Seed:</span> <b id="sk-seed">${cfg.seed}</b> `
    + `<button id="sk-dice" title="${esc(t('sk.dice'))}">🎲</button></div>`
    + `<div style="margin-top:14px">`
    + `<button id="sk-fight">${t('sk.fight')}</button> `
    + `<button id="sk-back">${t('prep.back')}</button></div>`
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
    el.querySelector('#sk-warn')!.textContent = ok ? '' : t('sk.warn')
  }

  // delegace kliknutí (steppery, vzdálenost) — jeden posluchač na overlay
  el.addEventListener('click', e => {
    const t = (e.target as Element).closest<HTMLElement>('[data-sk],[data-km],[data-clscard]')
    if (!t) return
    const card = t.getAttribute('data-clscard')
    if (card) {
      showClassCard(card, t.getAttribute('data-cardside') === 'enemy' ? 'enemy' : 'player')
      return
    }
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
    track('mission_start', {}, 'skirmish')
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
    track('vo_play', { name })
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
    + `<button id="btn-start">${t('prep.start')}</button>`,
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
    `<button class="ld-btn${l.id === sel ? ' active' : ''}" data-ld="${l.id}">${t(`loadout.${l.id}`)}</button>`).join('')
  const el = overlay(
    `<div id="prep-media"></div>`
    + `<h2>${esc(missionTitle(id, sc.title))}</h2>`
    + (prolog ? `<div class="brief story">${esc(prolog)}</div>` : '')
    + `<div class="brief">${esc(missionBriefing(id, sc.briefing))}</div>`
    + `<div class="ld-row"><span>${t('prep.arms')}:</span> ${btns}</div>`
    + `<div id="ld-desc" class="dim">${t(`loadout.${sel}.desc`)}</div>`
    + `<div style="margin-top:12px"><button id="btn-start">${t('prep.start')}</button> `
    + (loadMissionSave()?.missionId === id
      ? `<button id="btn-resume" class="active">${t('prep.resume')} (${fmtTime(loadMissionSave()!.t)})</button> `
      : '')
    + `<button id="btn-prep-back">${t('prep.back')}</button></div>`,
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
    el.querySelector('#ld-desc')!.textContent = tr(`loadout.${sel}.desc`)
  })
  onTap(el.querySelector('#btn-prep-back'), () => { stopVo(); el.remove(); showStarMap() })
  onTap(el.querySelector('#btn-start'), () => {
    stopVo()
    savePreset(sel)
    el.remove()
    setMenuBg(false)
    clearMissionSave()           // nový start = starý rozehraný save neplatí
    skipBriefing = true          // briefing byl tady — onReady rovnou spustí
    startCampaignMission(id, sel)
  })
  // pokračování rozehrané mise: obnova kompletního stavu simu z localStorage
  onTap(el.querySelector('#btn-resume'), () => {
    const save = loadMissionSave()
    if (!save || save.missionId !== id) return
    stopVo()
    el.remove()
    setMenuBg(false)
    skipBriefing = true
    pendingStatsRestore = save.stats ?? null
    track('mission_resume', { t: Math.round(save.t) }, id)
    bridge.restore(save.state)
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

/** příčina zániku rakety → i18n klíč (rozpad obrany v rozboru) */
const CAUSE_KEYS: Record<string, string> = {
  cm: 'loss.cm', pdlc: 'loss.pdlc', wedge: 'loss.wedge', decoy: 'loss.decoy',
  ecm: 'loss.ecm', dud: 'loss.dud', link: 'loss.link', fizzle: 'loss.fizzle',
}

/** top 2 příčiny z rozpadu (např. „protirakety 12, bodová obrana 5") */
function causeBreakdown(rec: Record<string, number>): string {
  return Object.entries(rec)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([k, v]) => `${CAUSE_KEYS[k] ? t(CAUSE_KEYS[k]) : k} ${v}`)
    .join(', ')
}

/** rozhodující faktor bitvy — i18n klíč věty „proč to dopadlo takhle" (D1) */
function decisiveFactor(
  win: boolean, r: CombatStats, succ: number, defPct: number, ownLoss: number,
): string {
  if (win) {
    if (succ >= 30 && r.ourLaunched >= 6) return 'aa.v.winSalvos'
    if (defPct >= 60 && r.incLaunched >= 6) return 'aa.v.winScreen'
    if (ownLoss === 0) return 'aa.v.winClean'
    return 'aa.v.winFast'
  }
  if (r.incHits >= 3) return 'aa.v.loseLeaks'
  if (succ < 12 && r.ourLaunched >= 6) return 'aa.v.loseRange'
  if (ownLoss > 0) return 'aa.v.loseLosses'
  return 'aa.v.loseOdds'
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
  const verdict = t(decisiveFactor(win, r, succ, defPct, ownLoss))
  return `<div class="score-block aa">`
    + `<div class="score-total">${t('aa.title')}</div>`
    + `<div class="row"><span>${t('aa.ourFire')}</span><span>${tf('aa.ourFireVal', { l: r.ourLaunched, h: r.ourHits, p: succ })}</span></div>`
    + (r.incLaunched > 0
      ? `<div class="row"><span>${t('aa.ourDefense')}</span><span>${tf('aa.ourDefenseVal', { k: r.incKilled, l: r.incLaunched, p: defPct })}${defParts ? ` · ${esc(defParts)}` : ''}</span></div>`
      : '')
    + (r.incHits > 0 ? `<div class="row"><span>${t('aa.hitsOnUs')}</span><span class="bad">${r.incHits}</span></div>` : '')
    + `<div class="row"><span>${t('aa.balance')}</span><span>${tf('aa.balanceVal', { k: foeKilled, o: ownLoss })}</span></div>`
    + `<div class="row"><span><b>${t('aa.decisive')}</b></span><span class="${win ? 'ok' : 'bad'}">${esc(verdict)}</span></div>`
    + `</div>`
}

function showOutcome(state: SimState): void {
  const win = state.outcome === 'win'
  // vyčištěná kampaňová mise odemkne další soustavu na mapě (ne volná bitva)
  if (win && currentMissionId && currentMissionId !== 'skirmish') markCleared(currentMissionId)
  const objs = state.objectives.map(o => {
    const mark = o.state === 'done' ? '■' : o.state === 'failed' ? '✗' : '□'
    return `<div class="obj ${o.state}">${mark} ${esc(objectiveText(currentMissionId, o.id, o.text))}</div>`
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
  // analytika: výsledek mise (anonymně — viz docs/ANALYTICS.md)
  track('mission_end', {
    win,
    t: Math.round(state.t),
    score: score.total,
    launched: stats.ourLaunched,
    hits: stats.ourHits,
    own_losses: state.ships.filter(s => s.side === 'player' && s.destroyed).length,
  }, currentMissionId)

  // volná bitva nemá skóre do žebříčku (jen rozbor + skóre pro info)
  const isSkirmish = currentMissionId === 'skirmish'
  // řádek skóre: překlad dle stabilního klíče složky (fallback český label)
  const scoreLine = (l: (typeof score.breakdown)[number]): string =>
    tf(`score.${l.key}`, { n: l.key === 'difficulty' ? fmtDec(l.n ?? 1) : l.n ?? 0 })
  const scoreHtml = win
    ? `<div class="score-block">`
      + `<div class="score-total">${t('outcome.score')}: <b>${score.total}</b></div>`
      + score.breakdown.map(l =>
        `<div class="row"><span>${esc(scoreLine(l))}</span><span class="${l.points >= 0 ? 'ok' : 'bad'}">${l.points >= 0 ? '+' : ''}${l.points}</span></div>`).join('')
      + (isSkirmish ? '' :
        `<div class="lb-form">`
        + `<input id="lb-nick" maxlength="24" placeholder="${esc(t('lb.nickPh'))}" value="${esc(loadPref(NICK_KEY))}">`
        + `<input id="lb-email" maxlength="254" placeholder="${esc(t('lb.emailPh'))}" value="${esc(loadPref(EMAIL_KEY))}">`
        + `<label class="lb-consent"><input type="checkbox" id="lb-consent"${loadPref(EMAIL_KEY) ? ' checked' : ''}> ${esc(t('lb.consent'))}</label>`
        + `<button id="btn-lb-submit">${t('lb.submit')}</button>`
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
    `<h2 class="${win ? 'win' : 'lose'}">${win ? t('outcome.win') : t('outcome.lose')}</h2>`
    + `<div class="brief">${t('outcome.endedAt')} ${fmtTime(state.t)}.</div>`
    + objs
    + afterActionHtml(state, controller.stats.report)
    + scoreHtml
    + (epilog ? `<div class="brief story story-epilog">${esc(epilog)}</div>` : '')
    + `<div style="margin-top:14px">`
    + `<button id="btn-again">${t('outcome.again')}</button> `
    + `<button id="btn-menu">${t('outcome.missionSelect')}</button>`
    + `</div>`,
  )
  // namluvený epilog (existuje-li nahr��vka)
  if (epilog) el.querySelector('.story-epilog')?.before(voPlayer(epilogVo))

  // odeslání do žebříčku + top 10 + „chybí ti X bodů"
  const submitBtn = el.querySelector<HTMLButtonElement>('#btn-lb-submit')
  onTap(submitBtn, () => {
    const result = el.querySelector<HTMLElement>('#lb-result')!
    const nick = (el.querySelector<HTMLInputElement>('#lb-nick')?.value ?? '').trim()
    const email = (el.querySelector<HTMLInputElement>('#lb-email')?.value ?? '').trim()
    const consent = el.querySelector<HTMLInputElement>('#lb-consent')?.checked === true
    if (nick.length < 2) {
      result.innerHTML = `<span class="bad">${esc(t('lb.errNick'))}</span>`
      return
    }
    if (email && !consent) {
      result.innerHTML = `<span class="bad">${esc(t('lb.errConsent'))}</span>`
      return
    }
    savePref(NICK_KEY, nick)
    savePref(EMAIL_KEY, consent ? email : '')
    submitBtn!.disabled = true
    result.innerHTML = `<span class="dim">${esc(t('lb.sending'))}</span>`
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
        result.innerHTML = `<span class="bad">${esc(t('lb.failed'))}</span>`
        return
      }
      const [top, rank] = await Promise.all([
        fetchTop(currentMissionId, 10), fetchRank(currentMissionId, score.total),
      ])
      let html = `<div class="ok">${esc(t('lb.saved'))}</div>`
      if (top && rank) {
        html += `<div class="lb-rank">${esc(rankSummary(score.total, top, rank.better, rank.total))}</div>`
        html += `<table class="lb-table"><tr><th>#</th><th>${t('hall.captain')}</th><th>${t('hall.points')}</th><th>${t('lb.time')}</th><th>${t('lb.losses')}</th></tr>`
          + top.map((r, i) =>
            `<tr><td>${i + 1}.</td><td>${esc(r.nickname)}</td><td>${r.score}</td>`
            + `<td>${fmtTime(r.time_s)}</td><td>${r.losses}</td></tr>`).join('')
          + `</table>`
      } else {
        html += `<span class="dim">${esc(t('lb.loadFailed'))}</span>`
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

/** pořadí trupů pro volbu HUD (DD a menší → kadetský, od CL plný) */
const HULL_RANK: Record<string, number> = { DD: 1, CL: 2, CA: 3, BC: 4, DN: 5, STN: 5 }

bridge.onReady = scenario => {
  currentMissionId = scenario.id
  // hudební sada mise (amb/battle-<id>.mp3); skirmish jede na výchozích stopách
  audio.setMissionMusic(scenario.id === 'skirmish' ? null : scenario.id)
  // kadetský HUD: řídí ho NEJVĚTŠÍ hráčův trup — torpédoborce jedou
  // nalehko, od lehkého křižníku výš plná taktická výbava
  const maxRank = Math.max(0, ...scenario.ships
    .filter(s => s.side === 'player')
    .map(s => HULL_RANK[SHIP_CLASSES[s.classId]?.hullCode ?? ''] ?? 0))
  panels.setSimpleHud(maxRank <= 1)
  stopVoLines()            // čistý start — žádné hlásky z minulé mise
  controller.stats.reset() // bojová statistika (sdílený tracker) — per mise
  // POKRAČOVAT: statistika ze save (jinak by skóre počítalo jen od obnovy)
  if (pendingStatsRestore) { controller.stats.restore(pendingStatsRestore); pendingStatsRestore = null }
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
  // autosave kampaně (~30 s) + stav pro okamžitý save při zavření stránky
  if (state.outcome === 'running' && currentMissionId !== 'skirmish' && currentMissionId !== '') {
    runningState = state
    if (performance.now() - lastAutosaveAt > 30_000) {
      lastAutosaveAt = performance.now()
      autosaveMission(state)
    }
  }
  if (!outcomeShown && state.outcome !== 'running') {
    outcomeShown = true
    runningState = null
    clearMissionSave() // mise skončila — rozehraný save už neplatí
    controller.setCompression(0)
    // konec mise: čekající hlášky zahodit, ale ROZEHRANOU nechat doznít —
    // závěrečná komunikace (m01-c9 apod.) přichází ve stejném snapshotu
    // jako výhra a stopVoLines() by ji umlčel dřív, než zazní
    clearVoLinesQueue()
    // kariérní deník flotily (C1): jen kampaň, ne volná bitva
    if (currentMissionId !== 'skirmish') recordMissionResult(state)
    // vyhraná kampaňová mise = +1 arkádová hra (trvalý bonus nad session limit)
    if (currentMissionId !== 'skirmish' && state.outcome === 'win') grantArcadeBonus()
    showOutcome(state)
  }
}

/** statické texty mimo overlaye (index.html) — přeložit při startu i přepnutí */
function applyStaticI18n(): void {
  const rot = document.getElementById('rotate-hint')
  if (rot) rot.innerHTML = `${esc(t('rotate.title'))}<br>${esc(t('rotate.detail'))}`
}
applyStaticI18n()

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
  showCinematicIntro(showStarMap)
} else {
  showStarMap()
}
