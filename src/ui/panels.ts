/**
 * Celoobrazovkový HUD: čtyři průhledné vrstvy nad plotem
 * (#hud-tl vlastní loď + statistika, #hud-tr kontakty/cíl/mise,
 * #hud-bottom vodorovná lišta rozkazů, #hud-br komunikace + log)
 * a horní lišta v #topbar. Prosté DOM (innerHTML), přerender ze
 * snapshotu (HUD throttlovaný na ~7 Hz). Akce tlačítek se chytají
 * na pointerdown delegací na #plot-container (přežije přerender).
 * Panely jsou sbalitelné (▾/▸ v hlavičce, stav v localStorage);
 * detail třídy lodi (lore + parametry) se rozklikává v paměti UI.
 */
import { MISSILES, SHIP_CLASSES } from '../data/defs'
import {
  CONTROL_RANGE, ENERGY_COOLDOWN, ENERGY_DECISIVE_RANGE,
  ENERGY_MAX_RANGE, G, REPAIR_CAP_LIGHT, ROLL_TIME, SURRENDER_COOLDOWN, TUBE_COOLDOWN,
} from '../sim/constants'
import { effectiveTubes, sidewallPowerFactor } from '../sim/damage'
import { estimatePenetration } from '../sim/estimate'
import { moraleFor, surrenderChance, weaponsOut } from '../sim/surrender'
import { autoDriveMode, fireSolution, poweredEnvelope } from '../sim/weapons'
import { controllableShips, fleetShips, isControllable, rosterVisible } from './roster'
import type { Contact, ShipClassDef, ShipState, SimEvent, SimState, Subsystems } from '../sim/types'
import type { AudioManager } from './audio'
import { type CombatStats } from './combatStats'
import { getLang, t } from './i18n'
import { CHARACTERS } from '../data/characters'

/** stav UI vrstvy předávaný z controlleru (src/ui/input.ts) */
export interface UiState {
  ownShipId: number | null
  /** hromadný výběr vlastních lodí (vždy obsahuje ownShipId, první) */
  selectedShipIds: number[]
  targetId: number | null
  courseMode: boolean
  compression: number
  slowdownText: string | null
  /** vybraná vlastní salva na plotu (id salvy) */
  selectedSalvoId: number | null
  /** další odpaly jako autonomní salvy (fire-and-forget) */
  autonomousMode: boolean
  /** další salvy s eskortní rušičkou (+rušička: 1 raketa se obětuje, PDLC ×0.75) */
  escortJammerMode: boolean
  /** auto-zpomalování času u důležitých událostí (toggle ⚠ v topbaru) */
  autoSlowEnabled: boolean
  /** režim hromadného výběru (mobil — tap = toggle, tažení = box výběr) */
  selectMode: boolean
  /** aktuální bojová statistika (z controllerova trackeru) k zobrazení */
  report: CombatStats
}

export type PanelAction =
  | { kind: 'compression'; factor: number }
  | { kind: 'select'; id: number }
  | { kind: 'order'; act: string; shift?: boolean }

/**
 * Rozhraní HUD vrstvy: controller přes něj krmí prezentaci snapshoty a eventy,
 * aniž by znal konkrétní implementaci. Desktop/tablet = Panels; mobil (body.phone)
 * = budoucí MobileHud. Bojová statistika žije v controlleru (CombatStatsTracker),
 * ne tady — HUD ji dostává ve snapshotu (UiState.report).
 */
export interface HudView {
  addEvents(events: SimEvent[]): void
  update(state: SimState, ui: UiState, force?: boolean): void
}

const COMP_BTNS: { f: number; label: string }[] = [
  { f: 0, label: '⏸' },
  { f: 1, label: '1×' },
  { f: 10, label: '10×' },
  { f: 100, label: '100×' },
  { f: 1000, label: '1000×' },
  { f: 10000, label: '10000×' },
]

// label = i18n klíč (překlad se řeší za běhu přes t(), aby šel přepnout jazyk)
const SUBSYS: { key: keyof Subsystems; label: string }[] = [
  { key: 'impellerFwd', label: 'subsys.impellerFwd' },
  { key: 'impellerAft', label: 'subsys.impellerAft' },
  { key: 'sidewallPort', label: 'subsys.sidewallPort' },
  { key: 'sidewallStbd', label: 'subsys.sidewallStbd' },
  { key: 'tubesPort', label: 'subsys.tubesPort' },
  { key: 'tubesStbd', label: 'subsys.tubesStbd' },
  { key: 'energyPort', label: 'subsys.energyPort' },
  { key: 'energyStbd', label: 'subsys.energyStbd' },
  { key: 'pdlc', label: 'subsys.pdlc' },
  { key: 'cm', label: 'subsys.cm' },
  { key: 'sensors', label: 'subsys.sensors' },
  { key: 'ecm', label: 'subsys.ecm' },
]

/** české názvy rolí + iniciály fallbacku (soubory avatarů dle docs/ART_PROMPTS.md) */
/** ilustrace tříd lodí (public/img/<hodnota>.png) — klíč je classId nebo hullCode */
const SHIP_IMAGES: Record<string, string> = {
  'dd-vichr': 'ship-dd', 'cl-sokol': 'ship-cl', 'ca-bastion': 'ship-ca',
  'merch-freighter': 'ship-merch', 'merch-runner': 'ship-merch',
  'merch-qship': 'ship-qship', 'disp-courier': 'ship-courier',
  // dreadnoughty zatím bez vlastní ilustrace — fallback na siluetu CA
  'dn-vladar': 'ship-ca', 'dn-ural': 'ship-ca',
  DD: 'ship-dd', CL: 'ship-cl', CA: 'ship-ca', DN: 'ship-ca',
  MERCH: 'ship-merch', DB: 'ship-courier',
}

// name = i18n klíč (překlad za běhu); initials = krátký kód (beze změny)
const SPEAKERS: Record<string, { name: string; initials: string }> = {
  'captain': { name: 'speaker.captain', initials: 'KPT' },
  'xo': { name: 'speaker.xo', initials: 'XO' },
  'engineer': { name: 'speaker.engineer', initials: 'INŽ' },
  'tactical': { name: 'speaker.tactical', initials: 'TAK' },
  'comms': { name: 'speaker.comms', initials: 'SPO' },
  'enemy-captain': { name: 'speaker.enemy', initials: 'NPŘ' },
  'pirate': { name: 'speaker.pirate', initials: 'PIR' },
  'station': { name: 'speaker.station', initials: 'STN' },
  'governor': { name: 'speaker.governor', initials: 'GUV' },
}

// ---------- formátovací pomocníci (sdílené i pro main.ts) ----------

export const esc = (s: string): string =>
  s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string))

export const fmtTime = (t: number): string => {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = Math.floor(t % 60)
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${h}:${p(m)}:${p(s)}`
}

export const fmtKm = (km: number): string => {
  const a = Math.abs(km)
  if (a >= 1e6) return (km / 1e6).toFixed(2) + ' M km'
  if (a >= 1e4) return Math.round(km / 1e3) + ' tis. km'
  return Math.round(km) + ' km'
}

const pctClass = (v: number): string => (v >= 0.995 ? 'ok' : v >= 0.5 ? 'amber' : 'bad')

/** odhad aktuální polohy kontaktu (extrapolace o stáří dat) */
export const contactEstPos = (c: Contact): { x: number; y: number } =>
  ({ x: c.pos.x + c.vel.x * c.age, y: c.pos.y + c.vel.y * c.age })

/** avatar mluvčího: obrázek img/<speaker>.png, při chybě načtení iniciály */
const avatarHtml = (speaker: string): string => {
  const sp = SPEAKERS[speaker] ?? { name: speaker, initials: '??' }
  return `<span class="comm-ava">`
    + `<img src="img/${esc(speaker)}.png" alt="" onerror="this.parentElement.classList.add('noimg')">`
    + `<i>${esc(sp.initials)}</i></span>`
}

/** přeložené jméno mluvčího (fallback: id) */
const speakerName = (id: string): string => {
  const sp = SPEAKERS[id]
  return sp ? t(sp.name) : id
}

// ---------- panely ----------

/** klíče štítků doktrín palby eskadry (roster, panel lodi) → t() za běhu */
const FIRE_MODE_LABELS: Record<string, string> = {
  auto: 'firemode.auto', nearest: 'firemode.nearest', biggest: 'firemode.biggest', spread: 'firemode.spread',
}

/**
 * Plný / krátký popisek tlačítka: telefonní CSS ukazuje krátký (.lbl-sm),
 * ať se celé bojové menu vejde na obrazovku bez scrollování.
 */
const lbl = (full: string, short: string): string =>
  `<span class="lbl-lg">${full}</span><span class="lbl-sm">${short}</span>`

/** cause → i18n klíč (překlad přes t() za běhu) */
const LOSS_LABELS: Record<string, string> = {
  cm: 'loss.cm', pdlc: 'loss.pdlc', wedge: 'loss.wedge', ecm: 'loss.ecm',
  decoy: 'loss.decoy', link: 'loss.link', dud: 'loss.dud',
  expired: 'loss.expired', lost: 'loss.lost',
}

/** „counter-missiles 4 · PDLC 2 · …" z mapy příčin (stabilní pořadí dle LOSS_LABELS) */
const lossBreakdown = (loss: Record<string, number>): string =>
  Object.keys(LOSS_LABELS)
    .filter(k => loss[k])
    .map(k => `${t(LOSS_LABELS[k])} ${loss[k]}`)
    .join(' · ')

/** rozpracovaný souhrn osudu jedné naší salvy (kompletace → řádek do logu) */
interface SalvoTally { launched: number; resolved: number; hits: number; loss: Record<string, number> }

/** localStorage klíč sbalených panelů ({klíč panelu: true}) */
const FOLDS_KEY = 'wob-hud-folds'

const loadFolds = (): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(FOLDS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch { return {} }
}

export class Panels implements HudView {
  private log: { t: number; text: string; warn: boolean }[] = []
  private commLog: { t: number; speaker: string; text: string }[] = []
  private lastSidebarAt = 0
  private toasts: HTMLElement | null = null
  /** přerenderovávaná část topbaru (audio ovládání se renderuje jen jednou) */
  private tbMain: HTMLElement
  /** HUD kontejnery (absolute vrstvy nad plotem) */
  private hudTl: HTMLElement
  private hudTr: HTMLElement
  private hudBottom: HTMLElement
  private hudBr: HTMLElement
  /** sbalené panely (per panel, persistentní) */
  private folds: Record<string, boolean> = loadFolds()
  /** režim nápovědy (ⓘ v topbaru): klepnutí ukazuje tooltipy místo akcí */
  private infoMode = false
  /** rozbalené detaily třídy lodi ('own' / 'tgt') — jen v paměti UI */
  private classDetailOpen = new Set<string>()
  /** poslední snapshot pro okamžitý přerender po sbalení/rozbalení */
  private lastState: SimState | null = null
  private lastUi: UiState | null = null

  constructor(
    root: HTMLElement,
    topbar: HTMLElement,
    private onAction: (a: PanelAction) => void,
    audio?: AudioManager,
  ) {
    this.hudTl = root.querySelector('#hud-tl') as HTMLElement
    this.hudTr = root.querySelector('#hud-tr') as HTMLElement
    this.hudBottom = root.querySelector('#hud-bottom') as HTMLElement
    this.hudBr = root.querySelector('#hud-br') as HTMLElement
    // dynamická část topbaru (čas, komprese) — přepisuje se každý snapshot;
    // audio ovládání je samostatný sourozenec, ať slidery nepřijdou o drag
    this.tbMain = document.createElement('span')
    this.tbMain.className = 'tb-main'
    topbar.appendChild(this.tbMain)
    if (audio) topbar.appendChild(this.buildAudioBar(audio))
    // delegace na pointerdown: elementy se při přerenderu mění, kontejner ne;
    // root = #plot-container pokrývá HUD vrstvy i topbar (canvas nemá data-*)
    const handler = (e: Event): void => {
      const t = e.target as Element | null
      // režim nápovědy (ⓘ, dotyk): klepnutí UKÁŽE tooltip místo akce —
      // title atributy na dotyku jinak nejsou dostupné
      if (this.infoMode && !t?.closest?.('.tb-audio')) {
        const tt = t?.closest?.('[title]')
        const txt = tt?.getAttribute('title')
        if (txt) this.showToast(`<b>ⓘ</b> ${esc(txt)}`, 'toast-comm', 9000)
        return
      }
      const el = t?.closest?.('[data-comp],[data-sel],[data-act],[data-fold],[data-clsdetail]')
      if (!el) return
      const fold = el.getAttribute('data-fold')
      if (fold != null) { this.toggleFold(fold); return }
      const cls = el.getAttribute('data-clsdetail')
      if (cls != null) { this.toggleClassDetail(cls); return }
      const comp = el.getAttribute('data-comp')
      if (comp != null) { this.onAction({ kind: 'compression', factor: Number(comp) }); return }
      const sel = el.getAttribute('data-sel')
      if (sel != null) { this.onAction({ kind: 'select', id: Number(sel) }); return }
      const act = el.getAttribute('data-act')
      if (act != null) {
        // Shift-klik v rosteru = přidání/odebrání z hromadného výběru
        const shift = (e as PointerEvent).shiftKey === true
        this.onAction({ kind: 'order', act, shift })
      }
    }
    root.addEventListener('pointerdown', handler)

    // kontejner na toasty u plotu (poslední hail + vlastní zásahy)
    this.toasts = document.createElement('div')
    this.toasts.id = 'toasts'
    root.appendChild(this.toasts)
  }

  /** sbalení/rozbalení panelu (▾/▸ v hlavičce) + persist + přerender */
  private toggleFold(key: string): void {
    this.folds[key] = !this.folds[key]
    try { localStorage.setItem(FOLDS_KEY, JSON.stringify(this.folds)) } catch { /* noop */ }
    this.rerender()
  }

  private toggleClassDetail(key: string): void {
    if (this.classDetailOpen.has(key)) this.classDetailOpen.delete(key)
    else this.classDetailOpen.add(key)
    this.rerender()
  }

  /** okamžitý přerender HUD z posledního snapshotu (po UI toggle) */
  private rerender(): void {
    if (!this.lastState || !this.lastUi) return
    this.lastSidebarAt = performance.now()
    this.renderHud(this.lastState, this.lastUi)
  }

  /** obal panelu se sbalitelnou hlavičkou (stav per panel v localStorage) */
  private panel(key: string, title: string, body: string, titleAttr = ''): string {
    const folded = !!this.folds[key]
    return `<div class="panel"><h3 data-fold="${key}"${titleAttr ? ` title="${esc(titleAttr)}"` : ''}>`
      + `<span class="fold-mark">${folded ? '▸' : '▾'}</span> ${title}</h3>`
      + (folded ? '' : body)
      + `</div>`
  }

  /** toast overlay u plotu — zmizí po pár sekundách */
  private showToast(html: string, cls: string, ms: number): void {
    if (!this.toasts) return
    const el = document.createElement('div')
    el.className = `toast ${cls}`
    el.innerHTML = html
    this.toasts.appendChild(el)
    // max 4 toasty najednou; při úklidu přednostně obětuj běžné zprávy —
    // intro karty postav se ukazují jen jednou za misi a nesmí zmizet neviděné
    while (this.toasts.children.length > 4) {
      const kids = [...this.toasts.children]
      const victim = kids.find(k => !k.classList.contains('toast-intro')) ?? kids[0]
      victim.remove()
    }
    setTimeout(() => { el.classList.add('fade'); setTimeout(() => el.remove(), 600) }, ms)
  }

  /** reset HUD logů a rozpracovaných salv — volat při startu nové mise.
   *  (Bojovou statistiku resetuje controller přes CombatStatsTracker.) */
  resetStats(): void {
    this.salvoTallies.clear()
    this.log = []
    this.commLog = []
    this.introduced.clear()
  }

  /** mluvčí už v TÉTO misi dostali intro kartu postavy */
  private introduced = new Set<string>()

  /** sleduje osud NAŠICH salv; po dostřílení celé salvy shrne výsledek do logu */
  private salvoTallies = new Map<number, SalvoTally>()

  private tallySalvo(ev: SimEvent): void {
    if (ev.side !== 'player' || ev.salvoId === undefined) return
    if (ev.kind === 'launch') {
      this.salvoTallies.set(ev.salvoId, { launched: ev.count ?? 0, resolved: 0, hits: 0, loss: {} })
      return
    }
    const t = this.salvoTallies.get(ev.salvoId)
    if (!t) return
    if (ev.kind === 'missileHit') { t.hits++; t.resolved++ }
    else if (ev.kind === 'missileKilled' || ev.kind === 'missileMiss') {
      const cause = ev.cause ?? 'link'
      t.loss[cause] = (t.loss[cause] ?? 0) + 1
      t.resolved++
    } else return
    if (t.resolved >= t.launched) {
      const parts = lossBreakdown(t.loss)
      this.log.unshift({
        t: ev.t,
        text: `Taktický důstojník: salva dostřílena — ${t.hits}/${t.launched} zásahů`
          + (parts ? ` (${parts})` : ''),
        warn: false,
      })
      this.salvoTallies.delete(ev.salvoId)
    }
  }

  /** připojí nové události ze snapshotu do logu (worker je po odeslání maže) */
  addEvents(events: SimEvent[]): void {
    for (const ev of events) {
      this.tallySalvo(ev)
      const spk = ev.speaker ? speakerName(ev.speaker) : null
      const logText = spk && ev.kind !== 'message' ? `${spk}: ${ev.text}` : ev.text
      this.log.unshift({ t: ev.t, text: logText, warn: !!ev.slowdown || ev.kind === 'shipDestroyed' })

      // komunikace → comm log + výrazný toast
      if (ev.kind === 'comm' && ev.speaker) {
        this.commLog.unshift({ t: ev.t, speaker: ev.speaker, text: ev.text })
        if (this.commLog.length > 8) this.commLog.length = 8
        // PRVNÍ replika mluvčího v misi → intro karta postavy (jméno, role,
        // medailonek) — a NESE rovnou i tu repliku: jeden toast místo dvou,
        // jinak by kartu v dávce komunikací vytlačil strop 4 toastů dřív,
        // než by se stihla ukázat
        const ch = CHARACTERS[ev.speaker]
        if (ch && !this.introduced.has(ev.speaker)) {
          this.introduced.add(ev.speaker)
          this.showToast(
            `${avatarHtml(ev.speaker)}<span class="toast-body">`
            + `<b>${esc(ch.name)}</b><span class="intro-role">${esc(t(ch.roleKey))}</span>`
            + `<span class="intro-bio">${esc(ch.bio[getLang()])}</span>`
            + `<span>${esc(ev.text)}</span></span>`,
            'toast-comm toast-intro', 12000)
        } else {
          this.showToast(
            `${avatarHtml(ev.speaker)}<span class="toast-body"><b>${esc(speakerName(ev.speaker))}</b>`
            + `<span>${esc(ev.text)}</span></span>`,
            'toast-comm', 9000)
        }
      }
      // vlastní zásah → červený toast „ZÁSAH — …"
      if (ev.kind === 'subsystemHit' && ev.side === 'player') {
        const detail = ev.text.replace(/^.*?zásah — /, '')
        this.showToast(`<b>ZÁSAH</b> — ${esc(detail)}`, 'toast-hit', 5000)
      }
    }
    if (this.log.length > 40) this.log.length = 40
  }

  update(state: SimState, ui: UiState, force = false): void {
    this.lastState = state
    this.lastUi = ui
    this.renderTopbar(state, ui)
    const now = performance.now()
    if (!force && now - this.lastSidebarAt < 150) return
    this.lastSidebarAt = now
    this.renderHud(state, ui)
  }

  /** audio ovládání topbaru — renderuje se JEDNOU (slidery přežijí drag) */
  private buildAudioBar(audio: AudioManager): HTMLElement {
    const bar = document.createElement('span')
    bar.className = 'tb-audio'
    bar.innerHTML =
      `<button class="tb-gfx" title="Vzhled plotu: objemové (3D shora, Homeworld) ⟷ klasické vektorové siluety">◈</button>`
      + `<button class="tb-crt" title="CRT vzhled: scanlines + vinětace (jen kosmetika)">📺</button>`
      + `<button class="tb-info" title="režim nápovědy (dotyk): klepnutí na prvek ukáže jeho vysvětlení místo akce">ⓘ</button>`
      + `<button class="tb-mobile" title="mobilní UI: kompaktní rozvržení pro telefon (jinak se zapne samo na malém dotykovém displeji)">🖐</button>`
      + `<button class="tb-mute" title="ztlumit / zapnout zvuk">${audio.muted ? '🔇' : '🔊'}</button>`
      + `<label title="hlasitost hudby">♪ <input class="tb-vol-music" type="range" min="0" max="100"`
      + ` value="${Math.round(audio.musicVolume * 100)}"></label>`
      + `<label title="hlasitost efektů">FX <input class="tb-vol-sfx" type="range" min="0" max="100"`
      + ` value="${Math.round(audio.sfxVolume * 100)}"></label>`
    // CRT overlay: persistentní, default VYP na dotyku (výkon — fáze D)
    const crt = bar.querySelector<HTMLButtonElement>('.tb-crt')!
    const plotEl = document.getElementById('plot-container')
    let crtOn = false
    try { crtOn = localStorage.getItem('wob-crt') === '1' } catch { /* noop */ }
    const applyCrt = (): void => {
      plotEl?.classList.toggle('crt', crtOn)
      crt.classList.toggle('active', crtOn)
    }
    applyCrt()
    crt.addEventListener('click', () => {
      crtOn = !crtOn
      try { localStorage.setItem('wob-crt', crtOn ? '1' : '0') } catch { /* noop */ }
      applyCrt()
    })
    // ruční přepínač mobilního UI (jinak se body.phone nastaví autodetekcí v
    // main.ts). Zvýraznění tlačítka řídí CSS (body.phone .tb-mobile), takže je
    // VŽDY v souladu se stavem třídy — i po autodetekci/resize, bez JS synchronizace.
    const mob = bar.querySelector<HTMLButtonElement>('.tb-mobile')!
    mob.addEventListener('click', () => {
      const on = !document.body.classList.contains('phone')
      document.body.classList.toggle('phone', on)
      try { localStorage.setItem('wob-mobile', on ? '1' : '0') } catch { /* noop */ }
    })
    // přepínač vzhledu (objemový HW ⟷ klasický CIC); stav drží plot v localStorage
    const gfx = bar.querySelector<HTMLButtonElement>('.tb-gfx')!
    let gfxHw = true
    try { gfxHw = localStorage.getItem('wob-gfx3d') !== '0' } catch { /* noop */ }
    const applyGfx = (): void => { gfx.classList.toggle('active', gfxHw) }
    applyGfx()
    gfx.addEventListener('click', () => {
      gfxHw = !gfxHw
      const plot = (window as unknown as { __wob?: { plot?: { setRenderMode(m: 'hw' | 'cic'): void } } }).__wob?.plot
      plot?.setRenderMode(gfxHw ? 'hw' : 'cic')
      applyGfx()
    })
    const info = bar.querySelector<HTMLButtonElement>('.tb-info')!
    info.addEventListener('click', () => {
      this.infoMode = !this.infoMode
      info.classList.toggle('active', this.infoMode)
    })
    const mute = bar.querySelector<HTMLButtonElement>('.tb-mute')!
    mute.addEventListener('click', () => {
      audio.setMuted(!audio.muted)
      mute.textContent = audio.muted ? '🔇' : '🔊'
    })
    bar.querySelector<HTMLInputElement>('.tb-vol-music')!.addEventListener('input', e => {
      audio.setMusicVolume(Number((e.target as HTMLInputElement).value) / 100)
    })
    bar.querySelector<HTMLInputElement>('.tb-vol-sfx')!.addEventListener('input', e => {
      audio.setSfxVolume(Number((e.target as HTMLInputElement).value) / 100)
    })
    return bar
  }

  private renderTopbar(state: SimState, ui: UiState): void {
    // tb-cb-<f>: telefonní CSS schovává mezistupně (10×, 1000×) — topbar
    // se jinak na šířku 844 px nevejde a překrývá audio ovládání
    const btns = COMP_BTNS
      .map(b => `<button data-comp="${b.f}" class="tb-cb tb-cb-${b.f}${b.f === ui.compression ? ' active' : ''}">${b.label}</button>`)
      .join('')
    const autoSlowTip = 'Auto-zpomalování: u důležitých událostí (zásah do naší lodi, nový kontakt, '
      + 'komunikace, cíle mise) spadne komprese na 1×. Vypnuto: událost jen blikne v liště.'
    this.tbMain.innerHTML =
      `<span class="tb-time">${t('topbar.time')} ${fmtTime(state.t)}</span>`
      + `<span class="tb-comp">${btns}</span>`
      + `<button data-act="autoSlow" class="${ui.autoSlowEnabled ? 'active' : ''}"`
      + ` title="${esc(autoSlowTip)}">⚠ ${ui.autoSlowEnabled ? t('state.on') : t('state.off')}</button>`
      + `<button data-act="help" title="nápověda (H)">?</button>`
      + (ui.slowdownText ? `<span class="tb-slow">⚠ ${t('topbar.slowed')}: ${esc(ui.slowdownText)}</span>` : '')
  }

  /** přerender všech čtyř HUD vrstev (místo bývalého sidebaru) */
  private renderHud(state: SimState, ui: UiState): void {
    const own = state.ships.find(s => s.id === ui.ownShipId) ?? null
    this.hudTl.innerHTML =
      this.panelFleet(state, ui)
      + this.panelOwnShip(own, state)
      + this.panelStats(ui)
    this.hudTr.innerHTML =
      this.panelContacts(state, own, ui)
      + this.panelTargetDetail(state, own, ui)
      + this.panelSalvo(state, own, ui)
      + this.panelObjectives(state)
    this.hudBottom.innerHTML = this.panelOrders(state, own, ui)
    this.hudBr.innerHTML =
      this.panelComms()
      + this.panelLog()
  }

  /** BOJOVÁ STATISTIKA — naše palba vs. příchozí (z controllerova trackeru) */
  private panelStats(ui: UiState): string {
    const s = ui.report
    if (s.ourLaunched === 0 && s.incLaunched === 0) return ''
    const pct = s.ourLaunched > 0 ? Math.round((100 * s.ourHits) / s.ourLaunched) : 0
    const ourParts = lossBreakdown(s.ourLoss)
    const incParts = lossBreakdown(s.incLoss)
    return this.panel('stats', t('panel.stats'),
      `<div class="row"><b>${t('stats.ourFire')}</b><span>${t('stats.launched')} ${s.ourLaunched}</span></div>`
      + `<div class="row dim"><span>${t('stats.hits')} ${s.ourHits}</span>`
      + `<span>${t('stats.successRate')} ${pct} %</span></div>`
      + (ourParts ? `<div class="row dim"><span>${t('stats.losses')} ${ourParts}</span></div>` : '')
      + `<div class="row"><b>${t('stats.incoming')}</b><span>${t('stats.launchedAtUs')} ${s.incLaunched}</span></div>`
      + `<div class="row dim"><span>${t('stats.killedByDefense')} ${s.incKilled}</span>`
      + `<span class="${s.incHits > 0 ? 'bad' : ''}">${t('stats.hitsOnUs')} ${s.incHits}</span></div>`
      + (incParts ? `<div class="row dim"><span>${t('stats.ourDefense')} ${incParts}</span></div>` : ''))
  }

  /** rozklikávací detail třídy lodi: „▸ třída …" → lore (+ parametry) */
  private classDetail(def: ShipClassDef, key: string, showParams: boolean): string {
    const open = this.classDetailOpen.has(key)
    // názvy tříd už často začínají „třída …" — nezdvojovat prefix
    const label = def.name.startsWith('třída') ? def.name : `třída: ${def.name}`
    let out = `<div class="cls-row" data-clsdetail="${key}">${open ? '▾' : '▸'}`
      + ` ${esc(label)} (${esc(def.hullCode)})</div>`
    if (!open) return out
    if (def.lore) out += `<div class="cls-lore">${esc(def.lore)}</div>`
    if (showParams) {
      const kv: [string, string][] = [
        ['tonáž', `${Math.round(def.tonnage / 1000).toLocaleString('cs-CZ')} kt`],
        ['max. akcelerace', `${def.maxAccelG} g`],
        ['šachty / bok', String(def.tubesPerBroadside)],
        ['CM odpalovače', String(def.cmLaunchers)],
        ['PDLC clustery', String(def.pdlcClusters)],
        ['energetika / bok', def.energyMountsPerBroadside > 0
          ? `${def.energyMountsPerBroadside}× (${def.energyDamage} dmg)` : '—'],
        ['zásobníky', `${def.magazineMissiles} raket · ${def.magazineCMs} CM`],
        ['detekce klínu', fmtKm(def.wedgeDetectionRange)],
        ['aktivní senzory', fmtKm(def.activeSensorRange)],
        ['ECM', `${Math.round(def.ecm * 100)} %`],
        ['boční štíty', String(def.sidewallStrength)],
      ]
      out += `<div class="cls-table">`
        + kv.map(([k, v]) => `<span class="dim">${k}</span><span>${v}</span>`).join('')
        + `</div>`
    }
    return out
  }

  /**
   * FLOTILA — roster vlastních lodí (jen když má hráč ≥ 2 OVLADATELNÉ lodě).
   * Ovladatelné = side player + doctrine player (klik/klávesy 1–9 přepínají);
   * AI spojenci (např. doctrine escort) se zobrazují šedě bez přepnutí.
   */
  private panelFleet(state: SimState, ui: UiState): string {
    if (!rosterVisible(state)) return ''
    const controllable = controllableShips(state)
    const rows = fleetShips(state).map(s => {
      const def = SHIP_CLASSES[s.classId]
      const hullPct = def ? Math.max(0, s.hull / def.hullPoints) : 1
      const ctrl = isControllable(s)
      const idx = controllable.findIndex(c => c.id === s.id)
      const active = s.id === ui.ownShipId
      const inSel = !active && ui.selectedShipIds.includes(s.id)
      const auto = s.fireControl.mode !== 'hold'
      const key = ctrl && idx >= 0 && idx < 9 ? `${idx + 1} ` : ''
      const mark = active ? '▶ ' : ''
      // značka formace: Σ stěna, V šíp, ◦ rozptyl
      const fmark = s.formation
        ? ` <span class="amber">${({ wall: 'Σ', vee: 'V', dispersed: '◦' } as const)[s.formation.kind]}</span>`
        : ''
      return `<div class="fleet-row${active ? ' sel' : ''}${inSel ? ' msel' : ''}${ctrl ? '' : ' dim'}"`
        + (ctrl ? ` data-act="ownShip:${s.id}" title="převzít loď (klávesa ${idx + 1}); Shift-klik = přidat/odebrat z výběru"` : ' title="AI spojenec — nelze převzít"')
        + `><div class="row"><span>${mark}${key}${esc(s.name)} <span class="dim">(${esc(def?.hullCode ?? '?')})</span>${fmark}</span>`
        + `<b class="${pctClass(hullPct)}">${Math.round(hullPct * 100)} %</b></div>`
        + `<div class="row dim"><span>${t('fleet.missiles')} ${s.missiles}${s.pods > 0 ? ` <span class="amber" title="tažené raketové plošiny (${s.pods}×6 raket — alfa úder)">+${s.pods}P</span>` : ''} · CM ${s.cms}</span>`
        + `<span>${ctrl ? (FIRE_MODE_LABELS[s.fireControl.mode] ? t(FIRE_MODE_LABELS[s.fireControl.mode]) : '') : t('fleet.ai')}`
        + `${ctrl ? (s.tubeCooldown > 0 ? ` <span title="šachty přebíjejí">⌛${Math.ceil(s.tubeCooldown)}s</span>` : ' <span class="ok" title="šachty připraveny k salvě">✓</span>') : ''}</span></div></div>`
    }).join('')
    return this.panel('fleet', t('panel.fleet'), rows,
      'klávesy 1–9 přepínají aktivní loď · Shift-klik přidá/odebere loď z hromadného výběru')
  }

  private panelOwnShip(own: ShipState | null, state: SimState): string {
    if (!own) return this.panel('own', t('panel.ownShip'), `<div class="dim">${t('ownShip.none')}</div>`)
    const def = SHIP_CLASSES[own.classId]
    const speed = Math.hypot(own.vel.x, own.vel.y)
    const impAvg = (own.subsystems.impellerFwd + own.subsystems.impellerAft) / 2
    const accG = own.wedgeOn ? own.throttle * (def?.maxAccelG ?? 0) * impAvg : 0
    const hullPct = def ? Math.max(0, own.hull / def.hullPoints) : 1
    const rows = SUBSYS.map(s => {
      const v = own.subsystems[s.key]
      const cls = pctClass(v)
      // ↗ = damage-control čety na subsystému pracují (polní oprava běží)
      const fixing = v < REPAIR_CAP_LIGHT && !own.destroyed
        ? `<span class="ok" title="polní oprava běží (~7 %/min do 70 %, pak dolaďování do 90 %)">↗</span>`
        : ''
      return `<div class="subsys ${cls}"><span class="nm">${t(s.label)}</span>`
        + `<span class="bar"><i style="width:${Math.round(v * 100)}%"></i></span>`
        + `<span class="pc ${cls}">${Math.round(v * 100)}%${fixing}</span></div>`
    }).join('')
    // priorita oprav: koncentrace damage-control čet (×3 skupina, ×0,5 zbytek)
    const anyDamage = SUBSYS.some(s => own.subsystems[s.key] < 1)
    const rf = own.repairFocus ?? 'balanced'
    const rBtn = (f: string, label: string, tip: string): string =>
      `<button data-act="repair:${f}" class="${rf === f ? 'active' : ''}" title="${esc(tip)}"${own.destroyed ? ' disabled' : ''}>${label}</button>`
    const repairRow = anyDamage
      ? `<div class="row"><span title="Polní opravy: plné tempo do 70 %, doladění do 90 % (víc dá jen dok). Priorita soustředí čety: skupina ×3, ostatní ×0,5. Trup se v poli opravit nedá — strukturální poškození spraví jen loděnice.">${t('ownShip.repairs')}</span>`
        + `<span>${rBtn('balanced', t('repair.balanced'), 'Rovnoměrné opravy všech subsystémů (výchozí).')}`
        + `${rBtn('weapons', t('repair.weapons'), 'Priorita: raketové šachty a energetické baterie ×3, ostatní ×0,5.')}`
        + `${rBtn('drive', t('repair.drive'), 'Priorita: impelerové prstence ×3 (akcelerace!), ostatní ×0,5.')}`
        + `${rBtn('defense', t('repair.defense'), 'Priorita: boční štíty, PDLC a protirakety ×3, ostatní ×0,5.')}</span></div>`
      : ''
    const status = own.destroyed
      ? `<div class="bad">${t('ownShip.destroyed')}</div>`
      : `<div class="row"><span>${t('ownShip.wedge')} <b class="${own.wedgeOn ? 'ok' : 'amber'}">${own.wedgeOn ? t('state.on') : t('state.off')}</b></span>`
        + `<span>${t('ownShip.sensors')} <b class="${own.activeSensors ? 'amber' : 'ok'}">${own.activeSensors ? t('sensors.active') : t('sensors.passive')}</b></span></div>`
        + `<div class="row"><span>${t('ownShip.attitude')} <b class="${own.rolledTo != null ? 'amber' : 'ok'}">${own.rolledTo != null ? t('attitude.rolled') : t('attitude.normal')}</b></span>`
        + `<span>${t('ownShip.throttle')} ${Math.round(own.throttle * 100)} %</span></div>`
        // rozpočet reaktoru: výkon bočních štítů klesá s tahem (sim: applyBeamDamage)
        + (() => {
          const sw = sidewallPowerFactor(own.throttle)
          const cls = sw >= 1 ? 'ok' : sw >= 0.6 ? 'amber' : 'bad'
          return `<div class="row" title="Reaktor neutáhne pohon i štítové generátory: tah ≤ 40 % ⇒ boční štíty 120 %, 60 % ⇒ 100 %, 80 % ⇒ 60 %, 100 % ⇒ 40 %, 120 % ⇒ 25 %.">`
            + `<span>${t('ownShip.sidewallPower')}</span><b class="${cls}">${Math.round(sw * 100)} %</b></div>`
        })()

    // funkční šachty (vliv poškození subsystémů na palbu — lepší bok)
    const tubesMax = def?.tubesPerBroadside ?? 0
    const tubesNow = tubesMax > 0 ? effectiveTubes(own) : 0
    const tubesRow = tubesMax > 0
      ? `<div class="row"><span>${t('ownShip.tubes')} <b class="${tubesNow >= tubesMax ? 'ok' : tubesNow > 0 ? 'amber' : 'bad'}">`
        + `${tubesNow}/${tubesMax} ${t('ownShip.tubesFunctional')}</b></span>`
        + `<span class="dim">${t('ownShip.salvoMax')} ${tubesNow}</span></div>`
      : ''

    // cooldown šachet jako progres bar (plný = připraveno)
    const ready = 1 - Math.min(1, own.tubeCooldown / TUBE_COOLDOWN)
    const cdRow = `<div class="subsys ${ready >= 1 ? 'ok' : 'amber'}"><span class="nm">${t('ownShip.missileTubes')}</span>`
      + `<span class="bar"><i style="width:${Math.round(ready * 100)}%"></i></span>`
      + `<span class="pc">${own.tubeCooldown > 0 ? Math.ceil(own.tubeCooldown) + ' s' : t('common.ok')}</span></div>`

    // nabíjení energetických baterií — stejný bar jako šachty (jen u lodí,
    // které energetické zbraně nesou)
    const energyReady = 1 - Math.min(1, own.energyCooldown / ENERGY_COOLDOWN)
    const energyRow = (def?.energyMountsPerBroadside ?? 0) > 0
      ? `<div class="subsys ${energyReady >= 1 ? 'ok' : 'amber'}"><span class="nm">${t('ownShip.energyWeapons')}</span>`
        + `<span class="bar"><i style="width:${Math.round(energyReady * 100)}%"></i></span>`
        + `<span class="pc">${own.energyCooldown > 0 ? Math.ceil(own.energyCooldown) + ' s' : t('common.ok')}</span></div>`
      : ''

    // stav AUTO palby / doktríny eskadry
    const fc = own.fireControl
    let fireRow = ''
    if (fc.mode !== 'hold' && fc.targetId != null) {
      const tgt = state.ships.find(s => s.id === fc.targetId)
      const tgtName = tgt ? tgt.name : `#${fc.targetId}`
      const next = fc.engaged
        ? (own.tubeCooldown > 0 ? `${t('fire.nextSalvo')} ${Math.ceil(own.tubeCooldown)} s` : t('fire.firing'))
        : t('fire.waitingEnvelope')
      fireRow = `<div class="row auto-fire"><span class="amber">${t(FIRE_MODE_LABELS[fc.mode] ?? 'firemode.auto')} → ${esc(tgtName)}</span>`
        + `<span>${next} · ${t('fire.remaining')} ${own.missiles}</span></div>`
    } else if (fc.mode !== 'hold' && fc.mode !== 'auto') {
      fireRow = `<div class="row auto-fire"><span class="amber">${t(FIRE_MODE_LABELS[fc.mode] ?? 'firemode.auto')}</span>`
        + `<span>${t('fire.seeking')}</span></div>`
    }
    // druhá vlna vrstvené salvy
    let waveRow = ''
    if (own.pendingWave) {
      waveRow = `<div class="row auto-fire"><span class="amber">${t('fire.secondWave')}</span>`
        + `<span>${t('fire.launchIn')} ${Math.max(0, Math.ceil(own.pendingWave.launchAt - state.t))} s</span></div>`
    }

    return this.panel('own', `${t('panel.ownShip')} — ${esc(own.name)}`,
      (def ? this.classDetail(def, 'own', true) : '')
      + `<div class="row"><span>${t('ownShip.hull')} <b class="${pctClass(hullPct)}">${Math.round(hullPct * 100)} %</b></span>`
      + `<span>${t('ownShip.speed')} ${Math.round(speed).toLocaleString('cs-CZ')} km/s · ${t('ownShip.accel')} ${Math.round(accG)} g</span></div>`
      + `<div class="row"><span>${t('ownShip.missiles')} ${own.missiles}`
      + `${own.pods > 0 ? ` · <span class="amber" title="tažené raketové plošiny: ${own.pods} ks × 6 raket — odpal VŠECH najednou (alfa úder), jednorázové">${t('ownShip.pods')} ${own.pods}×6</span>` : ''}`
      + ` · CM ${own.cms}</span>`
      + `<span>${t('ownShip.decoy')} ${own.decoyActive ? `<b class="ok">${t('decoy.active')}</b>` : '—'}`
      + ` · ${t('ownShip.decoyStock')} ${own.decoys}</span></div>`
      + tubesRow
      + status
      + cdRow
      + energyRow
      + fireRow
      + waveRow
      + repairRow
      + `<div class="subsys-grid">${rows}</div>`)
  }

  private panelContacts(state: SimState, own: ShipState | null, ui: UiState): string {
    const list = [...state.contacts.player]
    const oPos = own ? own.pos : { x: 0, y: 0 }
    const withRange = list.map(c => {
      const est = contactEstPos(c)
      return { c, range: Math.hypot(est.x - oPos.x, est.y - oPos.y) }
    }).sort((a, b) => a.range - b.range)
    const MAX_ROWS = 6
    const rows = withRange.slice(0, MAX_ROWS).map(({ c, range }) => {
      const cls = c.idQuality === 0 ? t('common.unknown') : (SHIP_CLASSES[c.classGuess]?.hullCode ?? c.classGuess)
      const q = [t('idq.wedge'), t('idq.class'), t('idq.ident')][c.idQuality]
      const speed = Math.hypot(c.vel.x, c.vel.y)
      const sel = c.shipId === ui.targetId ? ' sel' : ''
      const capitulated = state.ships.find(s => s.id === c.shipId)?.surrendered === true
      const mark = capitulated ? '▽' : '◆'
      const clsColor = capitulated ? 'dim' : c.idQuality === 0 ? 'amber' : 'bad'
      return `<div class="contact-row${sel}" data-sel="${c.shipId}">`
        + `<div class="row"><span class="${clsColor}">${mark} ${esc(cls)} #${c.shipId}${capitulated ? ` — ${t('contact.surrendered')}` : ''}</span><span>${fmtKm(range)}</span></div>`
        + `<div class="row dim"><span>${Math.round(speed).toLocaleString('cs-CZ')} km/s · ${q}</span><span>${t('contact.age')} ${Math.round(c.age)} s</span></div>`
        + `</div>`
    }).join('')
    const more = withRange.length > MAX_ROWS
      ? `<div class="dim" style="padding:2px 4px">+${withRange.length - MAX_ROWS} ${t('contact.more')}</div>`
      : ''
    return this.panel('contacts', t('panel.contacts'),
      (rows || `<div class="dim">${t('contacts.none')}</div>`) + more)
  }

  /** DETAIL CÍLE: geometrie, klasifikace, odhad výzbroje a obálek */
  private panelTargetDetail(state: SimState, own: ShipState | null, ui: UiState): string {
    if (ui.targetId == null) return ''
    const c = state.contacts.player.find(x => x.shipId === ui.targetId)
    if (!c || !own) return ''

    const est = contactEstPos(c)
    const dx = est.x - own.pos.x
    const dy = est.y - own.pos.y
    const d = Math.hypot(dx, dy)
    // radiální rychlost: + = vzdaluje se, − = přibližuje
    const ux = d > 0 ? dx / d : 1
    const uy = d > 0 ? dy / d : 0
    const vr = (c.vel.x - own.vel.x) * ux + (c.vel.y - own.vel.y) * uy
    const closingTxt = vr < -0.5
      ? `<span class="bad">přibližuje se ${Math.round(-vr).toLocaleString('cs-CZ')} km/s</span>`
      : vr > 0.5
        ? `vzdaluje se ${Math.round(vr).toLocaleString('cs-CZ')} km/s`
        : 'drží vzdálenost'
    const qLabel = ['jen impelerový klín', 'přibližná klasifikace', 'plná identifikace'][c.idQuality]
    const tgtShip = state.ships.find(s => s.id === c.shipId) ?? null

    let body =
      `<div class="row"><span>vzdálenost:</span><b>${fmtKm(d)}</b></div>`
      + `<div class="row"><span>radiálně:</span><span>${closingTxt}</span></div>`
      + `<div class="row"><span>stáří dat:</span><span>${Math.round(c.age)} s (light-lag)</span></div>`
      + `<div class="row"><span>klasifikace:</span><span>${qLabel}</span></div>`

    // neherní objekt z map (planeta, bóje, sonda…): bez bojových řádků
    const civil = tgtShip?.side === 'neutral' && tgtShip.doctrine === 'buoy'

    // kvalita palebného řešení naší vybrané lodi na tento cíl (senzorový duel)
    if (tgtShip && !civil && !tgtShip.destroyed && !own.destroyed) {
      const sol = fireSolution(state, own, tgtShip)
      const ownDef = SHIP_CLASSES[own.classId]
      const fullActive = own.activeSensors && !!ownDef && d < ownDef.activeSensorRange
      const hint = tgtShip.activeSensors ? ' (+15 % — cíl vyzařuje)' : ''
      body += `<div class="row"><span>kvalita řešení:</span>`
        + `<b class="${sol >= 0.95 ? 'ok' : sol >= 0.8 ? 'amber' : 'bad'}">${Math.round(sol * 100)} %${hint}</b></div>`
      if (!fullActive) {
        const near = !!ownDef && d < ownDef.activeSensorRange
        body += `<div class="row dim"><span>${near
          ? 'zapni aktivní senzory pro plné řešení'
          : 'zapni aktivní senzory a přibliž se pro plné řešení'}</span></div>`
      }
    }

    // kapitulace — výrazný stav (loď se vzdala, nestřílet)
    if (tgtShip?.surrendered) {
      body += `<div class="row surrendered"><b class="ok">▽ KAPITULOVAL</b>`
        + `<span>klín vypnut, loď se vzdala</span></div>`
    }

    // odhad poškození: idQuality 1 → kvantování 25 %, idQuality 2 → 10 %
    let estDamage: number | null = null
    if (c.idQuality >= 1 && tgtShip && !civil) {
      const realDef = SHIP_CLASSES[tgtShip.classId]
      const dmg = realDef ? 1 - Math.max(0, tgtShip.hull) / realDef.hullPoints : 0
      const step = c.idQuality >= 2 ? 0.1 : 0.25
      estDamage = Math.min(1, Math.round(dmg / step) * step)
      const label = estDamage >= 0.995 ? 'kritické' : `~${Math.round(estDamage * 100)} %`
      body += `<div class="row"><span>odhad poškození:</span>`
        + `<b class="${estDamage >= 0.75 ? 'bad' : estDamage >= 0.25 ? 'amber' : 'ok'}">${label}</b></div>`
    }

    const tDef = SHIP_CLASSES[c.classGuess]
    if (c.idQuality >= 1 && tDef) {
      // ilustrace třídy (public/img/ship-*.png; chybějící obrázek se skryje)
      const img = SHIP_IMAGES[c.classGuess] ?? SHIP_IMAGES[tDef.hullCode]
      if (img) {
        body += `<img class="target-img" src="img/${img}.png" alt="" onerror="this.remove()">`
      }
      // odhad třídy / tonáže / akcelerace + rozklikávací detail třídy
      // (lore od klasifikace, kompletní parametry až při plné identifikaci)
      body += this.classDetail(tDef, 'tgt', c.idQuality >= 2)
        + `<div class="row"><span>tonáž:</span><span>~${Math.round(tDef.tonnage / 1000).toLocaleString('cs-CZ')} kt</span></div>`
        + `<div class="row"><span>max. akcel.:</span><span>~${tDef.maxAccelG} g</span></div>`
    } else if (c.idQuality >= 1) {
      body += `<div class="row dim"><span>třída neznámá — přibliž se / aktivní senzory</span></div>`
    }

    // popisek objektu ze scénáře (planety, stanice, sondy, bóje, civilní
    // provoz): neutrálům se ukazuje hned, ostatním od klasifikace
    if (tgtShip?.desc !== undefined && (tgtShip.side === 'neutral' || c.idQuality >= 1)) {
      body += `<div class="cls-lore">${esc(tgtShip.desc)}</div>`
    }

    if (c.idQuality >= 2 && tDef && !civil) {
      // výzbroj + porovnání raketových obálek (dle aktuální geometrie)
      body += `<div class="row"><span>výzbroj:</span>`
        + `<span>${tDef.tubesPerBroadside}× šachta/bok · ${tDef.energyMountsPerBroadside}× energet.</span></div>`
      // odhad funkčních šachet (plná identifikace — zaokrouhlený stav subsystémů)
      if (tDef.tubesPerBroadside > 0 && tgtShip) {
        const best = Math.max(tgtShip.subsystems.tubesPort, tgtShip.subsystems.tubesStbd)
        const estTubes = Math.round(tDef.tubesPerBroadside * best)
        body += `<div class="row"><span>odhad funkčních šachet:</span>`
          + `<span class="${estTubes < tDef.tubesPerBroadside ? 'amber' : ''}">~${estTubes}/${tDef.tubesPerBroadside}</span></div>`
      }
      const ourEnv = poweredEnvelope(own.pos, own.vel, est, c.vel, 0)
      const hisEnv = tDef.tubesPerBroadside > 0
        ? poweredEnvelope(est, c.vel, own.pos, own.vel, 0)
        : 0
      const fmtEnv = (km: number): string => (km / 1e6).toFixed(1).replace('.', ',')
      const timeTo = (env: number): string => {
        if (d <= env) return 'TEĎ'
        if (vr >= -0.5) return '—'
        const min = (d - env) / -vr / 60
        return min > 600 ? '—' : `~${Math.max(1, Math.round(min))} min`
      }
      body += `<div class="row"><span>naše obálka:</span><span>${fmtEnv(ourEnv)} M km · dostřel ${timeTo(ourEnv)}</span></div>`
      body += tDef.tubesPerBroadside > 0
        ? `<div class="row"><span>jeho obálka:</span><span class="amber">${fmtEnv(hisEnv)} M km · dostřelí nás ${timeTo(hisEnv)}</span></div>`
        : `<div class="row dim"><span>raketami neozbrojen</span></div>`
      // odhad průniku aktuální salvy (velikost = funkční šachty, režim dle LO/HI)
      if (tgtShip && !tgtShip.destroyed && !own.destroyed) {
        const n = Math.min(effectiveTubes(own), own.missiles)
        if (n > 0) {
          const est = estimatePenetration(state, own, tgtShip, n,
            autoDriveMode(own.pos, own.vel, tgtShip.pos, tgtShip.vel))
          const tip = 'Hrubý deterministický odhad vrstvené obrany cíle (CM, PDLC, ECM) '
            + 'pro plnou salvu v aktuálním režimu pohonu. Není to slib — skutečnost '
            + 'závisí na náhodě, manévrech, saturaci a obraně cíle za letu.'
          body += `<div class="row" title="${esc(tip)}"><span>odhad průniku salvy ${n}:</span>`
            + `<b class="${est.through >= 1 ? 'ok' : 'amber'}">~${est.through < 0.95
              ? est.through.toFixed(1).replace('.', ',') : Math.round(est.through)} raket</b></div>`
            + `<div class="row dim" title="${esc(tip)}"><span>${esc(est.breakdown)}</span></div>`
        }
      }
    } else if (c.idQuality < 2) {
      body += `<div class="row dim"><span>výzbroj neznámá (ident. vyžaduje aktivní senzory zblízka)</span></div>`
    }

    if (!civil) body += this.surrenderControls(state, own, c, tgtShip, estDamage)

    // neutrální objekty (planety, stanice, sondy, civilní provoz) nejsou „cíl"
    return this.panel('target',
      tgtShip?.side === 'neutral' ? `Objekt #${c.shipId}` : `Detail cíle #${c.shipId}`, body)
  }

  /** tlačítko VYZVAT KE KAPITULACI + odhad šance (z KVANTOVANÉHO poškození) */
  private surrenderControls(
    state: SimState, own: ShipState | null, c: Contact,
    tgtShip: ShipState | null, estDamage: number | null,
  ): string {
    if (!tgtShip || tgtShip.destroyed || tgtShip.surrendered) return ''
    if (tgtShip.side !== 'enemy') {
      // neválečný neutrál — výzva nedává smysl (disabled s vysvětlením)
      return `<div class="btnrow"><button disabled title="Neutrální plavidlo — výzva ke kapitulaci nemá smysl.">`
        + `Vyzvat ke kapitulaci</button></div>`
    }
    const cdLeft = Math.ceil(SURRENDER_COOLDOWN - (state.t - tgtShip.lastSurrenderDemandAt))
    const inCooldown = cdLeft > 0
    const classified = c.idQuality >= 1
    const enabled = !!own && !own.destroyed && classified && !inCooldown
    // šance stejným vzorcem, ale z ODHADNUTÉHO kvantovaného poškození;
    // bonus za vyřazené zbraně vidíme až při plné identifikaci
    const chance = classified && estDamage != null
      ? surrenderChance(estDamage, moraleFor(tgtShip.doctrine), c.idQuality >= 2 && weaponsOut(tgtShip))
      : null
    const label = chance != null
      ? `Vyzvat ke kapitulaci (šance ~${Math.round(chance * 100)} %)`
      : 'Vyzvat ke kapitulaci'
    const title = !classified
      ? 'Nejdřív kontakt klasifikuj (přibliž se / aktivní senzory).'
      : inCooldown
        ? `Neodpovídá — další výzva za ${cdLeft} s. Mezitím zvyš tlak.`
        : 'Pošle výzvu ke kapitulaci. Odpověď letí rychlostí světla tam a zpět (2×vzdálenost/c). '
          + 'Šance roste s poškozením cíle a klesá s morálkou posádky; +15 % při vyřazených zbraních.'
    return `<div class="btnrow"><button data-act="demandSurrender" title="${esc(title)}"`
      + `${enabled ? '' : ' disabled'}>${esc(label)}</button></div>`
      + (inCooldown ? `<div class="row dim"><span>na výzvu neodpovídá — počkej ${cdLeft} s</span></div>` : '')
  }

  /** SALVA: vybraná vlastní letící salva — počet, zámek, fáze, přesměrování */
  private panelSalvo(state: SimState, own: ShipState | null, ui: UiState): string {
    if (ui.selectedSalvoId == null) return ''
    const ms = state.missiles.filter(m =>
      m.side === 'player' && m.salvoId === ui.selectedSalvoId && m.phase !== 'dead')
    if (ms.length === 0) return ''

    const avgLock = ms.reduce((a, m) => a + Math.max(0, Math.min(1, m.lock)), 0) / ms.length
    const boost = ms.filter(m => m.phase === 'boost').length
    const ball = ms.length - boost
    const phaseTxt = [boost > 0 ? `boost ${boost}` : '', ball > 0 ? `balistika ${ball}` : '']
      .filter(Boolean).join(' · ')
    const autonomous = ms.every(m => m.autonomous === true)

    // čas do cíle: nejkratší odhad přes rakety (vzdálenost / přibližovací rychlost)
    let tt = Infinity
    for (const m of ms) {
      const tgt = state.ships.find(s => s.id === m.targetId && !s.destroyed)
      if (!tgt) continue
      const dx = tgt.pos.x - m.pos.x
      const dy = tgt.pos.y - m.pos.y
      const d = Math.hypot(dx, dy)
      if (d <= 0) { tt = 0; continue }
      const closing = ((m.vel.x - tgt.vel.x) * dx + (m.vel.y - tgt.vel.y) * dy) / d
      if (closing > 1) tt = Math.min(tt, d / closing)
    }
    const ttTxt = Number.isFinite(tt) ? `~${Math.max(1, Math.round(tt))} s` : '—'

    // dosah řízení: nejbližší raketa salvy vůči vlastní lodi
    let minD = Infinity
    if (own && !own.destroyed) {
      for (const m of ms) minD = Math.min(minD, Math.hypot(m.pos.x - own.pos.x, m.pos.y - own.pos.y))
    }
    const inRange = minD < CONTROL_RANGE
    const ctrlRow = autonomous
      ? `<div class="row dim"><span>autonomní salva — letí bez řídicího spoje</span></div>`
      : `<div class="row"><span>řízení:</span><span class="${inRange ? 'ok' : 'amber'}">`
        + `${Number.isFinite(minD)
          ? (inRange ? `v dosahu (${fmtKm(minD)})` : `mimo dosah řízení (${fmtKm(minD)})`)
          : '—'}</span></div>`

    // přesměrování: vyžaduje vybraný klasifikovaný kontakt + dosah řízení
    const c = ui.targetId != null ? state.contacts.player.find(x => x.shipId === ui.targetId) : undefined
    const tgtShip = c ? state.ships.find(s => s.id === c.shipId) : undefined
    const tgtLabel = c ? `${SHIP_CLASSES[c.classGuess]?.hullCode ?? '???'} #${c.shipId}` : 'vybraný cíl'
    const canRetarget = !!own && !own.destroyed && !!c && c.idQuality >= 1
      && !!tgtShip && !tgtShip.destroyed && !tgtShip.surrendered && inRange
    const title = !c
      ? 'Nejdřív vyber cílový kontakt (klik v plotu nebo v kontaktech).'
      : c.idQuality < 1
        ? 'Nový cíl musí být klasifikovaný kontakt (přibliž se / aktivní senzory).'
        : tgtShip?.surrendered
          ? 'Cíl kapituloval — nestřílíme na něj.'
          : !inRange
            ? 'Salva je mimo dosah řízení (10 M km) — povel k ní nedoletí.'
            : 'Přesměruje všechny letící rakety salvy (boost/balistika) na vybraný cíl. Penalizace zámku ×0,75.'

    return this.panel('salvo', `Salva #${ui.selectedSalvoId}`,
      `<div class="row"><span>živých raket:</span><b>${ms.length}</b></div>`
      + `<div class="row"><span>průměrný zámek:</span>`
      + `<b class="${avgLock >= 0.7 ? 'ok' : avgLock >= 0.4 ? 'amber' : 'bad'}">${Math.round(avgLock * 100)} %</b></div>`
      + `<div class="row"><span>fáze:</span><span>${phaseTxt || '—'}</span></div>`
      + `<div class="row"><span>čas do cíle:</span><span>${ttTxt}</span></div>`
      + ctrlRow
      + `<div class="btnrow"><button data-act="retargetSalvo" title="${esc(title)}"${canRetarget ? '' : ' disabled'}>`
      + `Přesměrovat na ${esc(tgtLabel)}</button></div>`)
  }

  private panelOrders(state: SimState, own: ShipState | null, ui: UiState): string {
    const hasTarget = ui.targetId != null
    const dis = (cond: boolean): string => (cond ? '' : ' disabled')
    const noShip = !own || own.destroyed
    const canFire = !noShip && hasTarget
    const rolled = own?.rolledTo != null
    const def = SHIP_CLASSES[own?.classId ?? '']
    const tubes = def?.tubesPerBroadside ?? 4
    const hiC = Math.max(1, Math.round(tubes / 3))
    const loC = Math.max(1, tubes - hiC)
    const auto = own?.fireControl.mode === 'auto'
    // hromadný výběr: „(×N)" u tlačítek působících na celý výběr
    const selN = ui.selectedShipIds.length
    const xN = selN > 1 ? ` <span class="dim">(×${selN})</span>` : ''

    // čísla mechanik do tooltipů (z defs/constants — žádná magie v textech)
    const fmtM = (km: number): string => (km / 1e6).toFixed(1).replace(/\.0$/, '').replace('.', ',')
    const mdef = MISSILES['std-shipkiller']
    const envLo = 0.5 * mdef.accelG[0] * G * mdef.driveTime[0] ** 2
    const envHi = 0.5 * mdef.accelG[1] * G * mdef.driveTime[1] ** 2
    const sensM = fmtM(def?.activeSensorRange ?? 5_000_000)
    const tip = {
      intercept: 'Autopilot spočítá a drží stíhací kurz na vybraný cíl. Intercepty na miliony km trvají desítky minut.',
      course: 'Klikni do plotu — autopilot poletí na zvolený bod. '
        + 'SHIFT-klik přidává další waypointy trasy (režim zůstává aktivní); '
        + 'obyčejný klik zadá poslední bod. Predikovaná křivka ukáže, jak se '
        + 'loď pokusí body proletět i se setrvačností.',
      salvo: (n: string): string =>
        `Odpálí ${n} raket na vybraný cíl; přebíjení šachet ${TUBE_COOLDOWN} s. `
        + `Pohon volí řízení palby SAMO: zblízka (do ~${fmtM(envHi)} M km) rychlé HI, `
        + `na dálku LO (dostřel ~${fmtM(envLo)} M km). Pamatuj: čím blíž odpálíš, `
        + `tím míň času má obrana cíle — pod ~1,5 M km je salva vražedná.`,
      pods: 'Odhodí VŠECHNY tažené raketové plošiny najednou — 6 raket na plošinu v jediné '
        + 'vlně mimo šachty i zásobníky (nepodléhá přebíjení). Drtivá první salva, která '
        + 'saturuje obranu cíle. Jednorázové — nové plošiny až v doku.',
      layered: `Vrstvená salva: ${loC}× LO hned + ${hiC}× HI se zpožděním tak, aby obě vlny dorazily spolu `
        + `a saturovaly bodovou obranu (víc raket v okně = nižší Pk obrany).`,
      autoFire: 'AUTO palba: loď sama opakuje plné salvy, dokud je cíl v poháněné obálce, '
        + 'a řídí i energetické baterie (cíl či nejbližší nepřítel do 500 tis. km). A',
      autonomous: 'Režim dalších odpalů. ŘÍZENÁ salva: plný zámek dle palebného řešení, loď ji vede '
        + '(drží zámek, lze ji přesměrovat) — ale eroduje při ztrátě kontaktu na cíl nebo za dosahem '
        + 'řízení 10 M km. AUTONOMNÍ: zámek ×0,85, ale letí sama — ideální „vystřel a zhasni" '
        + 's vypnutým klínem.',
      energy: `Lasery/grasery: plné poškození pod ${Math.round(ENERGY_DECISIVE_RANGE / 1000)} tis. km, `
        + `dosah ${Math.round(ENERGY_MAX_RANGE / 1000)} tis. km, nabíjení ${ENERGY_COOLDOWN} s.`,
      jammer: `+rušička: salva obětuje 1 raketu jako eskortní rušičku — zbytek salvy má proti `
        + `bodové obraně cíle Pk ×0,75. Vyžaduje salvu aspoň 3 raket.`,
      decoy: 'Vypustí taženou návnadu: příchozí raketa na ni může přeskočit (šance dle kvality '
        + 'ECM lodi, víc při slabém zámku raket). Svedená raketa návnadu ZNIČÍ — jedna návnada '
        + '≈ jedna pohlcená raketa; další lze vypustit hned. Omezená zásoba.',
      double: `Plná salva z obou boků s otočkou: levobok LO hned, otočka ${ROLL_TIME} s, pravobok `
        + 'HI časovaný na společný dopad — dvojnásobná vlna saturuje obranu. Loď se během '
        + 'otočky nemůže bránit palbou.',
      wedge: 'Vypnutý klín = EMCON: loď je téměř neviditelná (jen aktivní senzory zblízka), '
        + 'bez bočních štítů; k dispozici jen manévrovací trysky ~5 g na korekce driftu.',
      sensors: `Plná identifikace cílů do ${sensM} mil. km + lepší zámek našich raket (plné palebné `
        + 'řešení 100 % místo 70 %); pozor — vyzařování zlepšuje řešení nepříteli o 15 %. '
        + 'Pasivní detekce cizího klínu funguje vždy.',
      throttle: 'Výkon pohonu (kompenzátoru): 80 % je standard, 100 % plný výkon, '
        + '120 % = NOUZOVÝ výkon „za červenou čarou" (riziko poškození prstence ~1× za 33 min). '
        + 'POZOR — reaktor neutáhne pohon i boční štíty: tah ≤ 40 % ⇒ boční štíty 120 %, 60 % ⇒ 100 %, '
        + '80 % ⇒ 60 %, 100 % ⇒ 40 %, 120 % ⇒ 25 %. Rychlý přílet = papírové boky. Platí pro celý výběr.',
      formation: 'Formace eskadry (aktivní při výběru ≥ 2 ovladatelných lodí; aktivní loď = leader, '
        + 'ostatní dostanou sloty a drží je automaticky — vlastní kurz ignorují). '
        + 'STĚNA: kolmá řada, rozestup 400 tis. km — disciplinovaná palebná síť: Pk protiraket ×1,15, '
        + 'příchozí rakety −5 % zámku. ŠÍP: sdílený senzorový obraz — +5 % palebného řešení členů. '
        + 'ROZPTYL: rozestupy 1,5 M km — útočník nesaturuje eskadru jako celek, členové +3 % efektivního ECM. '
        + '„—" formaci zruší. Rozpad při ztrátě leadera.',
    }

    // stupňovitý přepínač výkonu pohonu 20–120 % (120 = nouzový, červeně)
    const thrNow = own ? Math.round(own.throttle * 100) : null
    const thrBtns = [20, 40, 60, 80, 100, 120].map(v =>
      `<button data-act="throttle:${v}" class="${thrNow === v ? 'active' : ''}${v > 100 ? ' bad' : ''}"`
      + `${dis(!noShip)}>${v}</button>`).join('')
    const throttleSeg = `<span title="${esc(tip.throttle)}">${t('order.throttle')}&nbsp;${thrBtns}&nbsp;%${xN}</span>`

    // skupina FORMACE — aktivní jen s výběrem ≥ 2 ovladatelných lodí
    const selOthers = ui.selectedShipIds.filter(id => id !== ui.ownShipId)
      .map(id => state.ships.find(s => s.id === id))
      .filter((s): s is ShipState => !!s && !s.destroyed)
    const canForm = !noShip && selN >= 2 && selOthers.length > 0
    const kindActive = (k: string): boolean => canForm
      && selOthers.every(s => s.formation?.kind === k && s.formation.leaderId === ui.ownShipId)
    const noneActive = canForm && selOthers.every(s => !s.formation)
    const formBtn = (act: string, label: string, active: boolean): string =>
      `<button data-act="formation:${act}" class="${active ? 'active' : ''}"${dis(canForm)}>${label}</button>`
    const formationSeg = `<span class="obg" title="${esc(tip.formation)}">${lbl(t('order.formation'), t('order.formationShort'))}`
      + formBtn('wall', lbl(t('formation.wall'), 'Σ'), kindActive('wall'))
      + formBtn('vee', lbl(t('formation.vee'), 'V'), kindActive('vee'))
      + formBtn('dispersed', lbl(t('formation.dispersed'), '◦'), kindActive('dispersed'))
      + formBtn('none', '—', noneActive)
      + xN
      + `</span>`

    // VELENÍ ESKADRY: doktríny palby pro hromadný výběr — bez ručního
    // klikání cílů ve velkých bitvách. Viditelné od 3 ovladatelných lodí.
    const fleetCount = controllableShips(state).length
    const selShips = ui.selectedShipIds
      .map(id => state.ships.find(s => s.id === id))
      .filter((s): s is ShipState => !!s && !s.destroyed)
    const allMode = (m: string): boolean =>
      selShips.length > 0 && selShips.every(s => s.fireControl.mode === m)
    const squadPods = selShips.reduce((n, s) => n + s.pods, 0)
    const squadTips: Record<string, string> = {
      fleetNearest: 'Doktrína NEJBLIŽŠÍ: každá vybraná loď si sama drží palbu na svůj nejbližší nepřátelský kontakt a po jeho zničení plynule přejde na další. Rozptýlená sebeobrana — ideální proti dotírající zástěně.',
      fleetBiggest: 'Doktrína NEJVĚTŠÍ: každá vybraná loď pálí na nejtěžší známý trup — celá eskadra se tak sama koncentruje (saturace obrany!) a po zničení roluje na další nejtěžší. Doktrína stěny proti stěně.',
      fleetSpread: 'Doktrína ROZDĚLIT: vybrané lodě si cíle rozdělí (každá jiný) — proti hejnu slabších lodí, kde koncentrace plýtvá salvami.',
      fleetFocus: 'SOUSTŘEDIT: všechny vybrané lodě AUTO palbou na TEBOU vybraný cíl (klikni na kontakt). Jednorázové přiřazení — po zničení cíle se lodě zastaví.',
      fleetHold: 'DRŽET PALBU: všechny vybrané lodě přestanou střílet (doktríny i AUTO vypnuty).',
      fleetSalvo: 'SALVA VÝBĚRU: každá vybraná loď s nabitými šachtami TEĎ odpálí plnou salvu na tebou vybraný cíl — koordinovaný úder bez přepínání lodí. Připravenost šachet vidíš v rosteru FLOTILA (✓/⌛).',
      fleetAlpha: 'SROVNAT TUBY (sesazená alfa-salva): vybrané lodě naplánují plnou salvu na SPOLEČNÝ dopad — bližší lodě odpal zpozdí, aby všechny salvy dorazily naráz a ZAHLTILY obranu cíle. Klasický Honorverse úder časovaný na cíl (time-on-target). Vyžaduje vybraný cíl a nabité šachty; vyprázdní zásobníky.',
      fleetPods: 'PLOŠINY ⇒ CÍLE: každá vybraná loď odpálí VŠECHNY tažené plošiny (6 raket na plošinu) — ale na VLASTNÍ cíl, rozdělené mezi nejbližší klasifikované nepřátele. Zabrání plýtvání, kdy 6×N raket spadne na jednu loď. Vyžaduje živé kontakty; plošiny jsou jednorázové.',
    }
    const squadSeg = fleetCount >= 3
      ? `<span class="obg" title="Velení eskadry: doktríny palby pro celý výběr — cíle si lodě volí samy (deterministicky), i při kompresi času.">${lbl(t('order.squad'), t('order.squadShort'))}`
        + `<button data-act="fleetNearest" class="${allMode('nearest') ? 'active' : ''}" title="${esc(squadTips.fleetNearest)}"${dis(!noShip)}>${lbl(t('squad.nearest'), t('squad.nearestShort'))}</button>`
        + `<button data-act="fleetBiggest" class="${allMode('biggest') ? 'active' : ''}" title="${esc(squadTips.fleetBiggest)}"${dis(!noShip)}>${lbl(t('squad.biggest'), t('squad.biggestShort'))}</button>`
        + `<button data-act="fleetSpread" class="${allMode('spread') ? 'active' : ''}" title="${esc(squadTips.fleetSpread)}"${dis(!noShip)}>${lbl(t('squad.spread'), t('squad.spreadShort'))}</button>`
        + `<button data-act="fleetSalvo" title="${esc(squadTips.fleetSalvo)}"${dis(canFire)}>${lbl(t('squad.salvo'), 'S⊞')}</button>`
        + `<button data-act="fleetAlpha" title="${esc(squadTips.fleetAlpha)}"${dis(canFire)}>${lbl(t('squad.alpha'), t('squad.alphaShort'))}</button>`
        + `<button data-act="fleetPods" title="${esc(squadTips.fleetPods)}"${dis(squadPods > 0)}>${lbl(t('squad.pods'), 'P⇒')}</button>`
        + `<button data-act="fleetFocus" title="${esc(squadTips.fleetFocus)}"${dis(canFire)}>${lbl(t('squad.focus'), t('squad.focusShort'))}</button>`
        + `<button data-act="fleetHold" title="${esc(squadTips.fleetHold)}"${dis(!noShip)}>${lbl(t('squad.hold'), '✋')}</button>`
        + xN
        + `</span>`
      : ''

    // vodorovná command lišta: [pohyb] | [palba] | [obrana/EMCON]
    // progres přebíjení šachet jako tenká linka pod tlačítky
    const ready = own ? 1 - Math.min(1, own.tubeCooldown / TUBE_COOLDOWN) : 1
    const cdLine = `<div class="ob-cd ${ready >= 1 ? '' : 'amber'}" title="přebíjení šachet`
      + `${own && own.tubeCooldown > 0 ? ` — zbývá ${Math.ceil(own.tubeCooldown)} s` : ' — připraveno'}">`
      + `<i style="width:${Math.round(ready * 100)}%"></i></div>`
    return this.panel('orders', t('panel.orders'),
      `<div class="ob">`
      + `<span class="obg">`
      + `<button data-act="intercept" title="${esc(tip.intercept)}"${dis(canFire)}>${lbl(t('order.intercept'), t('order.interceptShort'))}${xN}</button>`
      + `<button data-act="course" title="${esc(tip.course)}" class="${ui.courseMode ? 'active' : ''}"${dis(!noShip)}>${ui.courseMode ? lbl(t('order.courseActive'), t('order.courseActiveShort')) : `${lbl(t('order.course'), t('order.courseShort'))}${xN}`}</button>`
      + throttleSeg
      + `<button data-act="selectMode" class="${ui.selectMode ? 'active' : ''}" `
      + `title="Režim hromadného výběru (na dotyku nahrazuje Shift): tap přidá/odebere loď z výběru, tažení po plotu = obdélníkový výběr. Vypni pro běžný pan a výběr cílů.">${t('order.selectMode')}</button>`
      + `</span>`
      + `<span class="obg">`
      + `<button data-act="salvo2" title="${esc(tip.salvo('2'))}"${dis(canFire && (own?.missiles ?? 0) > 0)}>${lbl(`${t('order.salvoLayered')} 2`, 'S2')}</button>`
      + `<button data-act="salvo4" title="${esc(tip.salvo('4'))}"${dis(canFire && (own?.missiles ?? 0) > 0)}>${lbl(`${t('order.salvoLayered')} 4`, 'S4')}</button>`
      + `<button data-act="salvoFull" title="${esc(tip.salvo(`všechny (${tubes})`))}"${dis(canFire && (own?.missiles ?? 0) > 0)}>${t('order.salvoFull')}</button>`
      + `<button data-act="salvoLayered" title="${esc(tip.layered)}"${dis(canFire && (own?.missiles ?? 0) > 0)}>${lbl(`${t('order.salvoLayered')} ${loC}+${hiC}`, `${loC}+${hiC}`)}</button>`
      + `<button data-act="salvoDouble" title="${esc(tip.double)}"${dis(canFire && (own?.missiles ?? 0) > 0 && !rolled)}>${lbl(t('order.salvoDouble'), t('order.salvoDoubleShort'))}</button>`
      + `<button data-act="launchPods" title="${esc(tip.pods)}"${dis(canFire && (own?.pods ?? 0) > 0)}>${lbl(`${t('order.launchPods')} ${own?.pods ?? 0}×6`, `P${own?.pods ?? 0}`)}</button>`
      + `<button data-act="autonomous" class="${ui.autonomousMode ? 'active' : ''}" title="${esc(tip.autonomous)}"${dis(!noShip)}>`
      + `${ui.autonomousMode ? lbl(t('order.autonomous'), t('order.autonomousShort')) : lbl(t('order.guided'), t('order.guidedShort'))}</button>`
      + `<button data-act="escortJammer" class="${ui.escortJammerMode ? 'active' : ''}" title="${esc(tip.jammer)}"${dis(!noShip)}>${lbl(t('order.escortJammer'), t('order.escortJammerShort'))}</button>`
      + `<button data-act="autoFire" class="${auto ? 'active' : ''}" title="${esc(tip.autoFire)}"${dis(canFire || auto)}>${lbl(`${t('order.autoFire')} ${auto ? t('state.on') : t('state.off')}`, t('order.autoFire'))}${xN}</button>`
      + `</span>`
      + `<span class="obg">`
      + `<button data-act="energy" title="${esc(tip.energy)}"${dis(canFire)}>${lbl(t('order.energy'), '⚡')}</button>`
      + `<button data-act="deployDecoy" title="${esc(tip.decoy)}"${dis(!noShip && (own?.decoys ?? 0) > 0)}>`
      + `${lbl(`${t('order.decoy')} (${own?.decoys ?? 0})`, `◎${own?.decoys ?? 0}`)}</button>`
      + `<button data-act="wedge" class="${own?.wedgeOn ? 'active' : ''}" title="${esc(tip.wedge)}"${dis(!noShip)}>${lbl(`${t('order.wedge')} ${own?.wedgeOn ? t('state.on') : t('state.off')}`, t('order.wedge'))}${xN}</button>`
      + `<button data-act="sensors" class="${own?.activeSensors ? 'active' : ''}" title="${esc(tip.sensors)}"${dis(!noShip)}>${lbl(`${t('order.sensors')} ${own?.activeSensors ? t('state.on') : t('state.off')}`, t('order.sensorsShort'))}${xN}</button>`
      + `</span>`
      + formationSeg
      + squadSeg
      + `</div>`
      + cdLine,
      'mezerník pauza · +/− komprese · A auto · H nápověda')
  }

  private panelObjectives(state: SimState): string {
    const rows = state.objectives.map(o => {
      const mark = o.state === 'done' ? '■' : o.state === 'failed' ? '✗' : '□'
      return `<div class="obj ${o.state}">${mark} ${esc(o.text)}</div>`
    }).join('')
    return this.panel('objectives', t('panel.objectives'), rows || '<div class="dim">—</div>')
  }

  /** komunikační log — poslední 2 hlášky s avatary (kind 'comm') */
  private panelComms(): string {
    const rows = this.commLog.slice(0, 2).map(c => {
      return `<div class="comm-row">${avatarHtml(c.speaker)}`
        + `<div class="comm-body"><div class="comm-name">${esc(speakerName(c.speaker))} <span class="dim">[${fmtTime(c.t)}]</span></div>`
        + `<div class="comm-text">${esc(c.text)}</div></div></div>`
    }).join('')
    return this.panel('comms', t('panel.comms'), rows || `<div class="dim">${t('comms.none')}</div>`)
  }

  private panelLog(): string {
    const rows = this.log.slice(0, 6).map(l =>
      `<div class="${l.warn ? 'ev-warn' : ''}">[${fmtTime(l.t)}] ${esc(l.text)}</div>`,
    ).join('')
    return this.panel('log', t('panel.log'),
      `<div id="log">${rows || `<div class="dim">${t('log.none')}</div>`}</div>`)
  }
}
