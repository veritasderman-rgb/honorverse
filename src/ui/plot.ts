/**
 * TacticalPlot — vektorový CIC displej (canvas 2D).
 * Svět: km, y nahoru. Obrazovka: px, y dolů. Kamera sleduje vybranou
 * vlastní loď (followId) + pan tažením, log-zoom kolečkem.
 * Mezi snapshoty extrapoluje pozice vel·(reálný čas · komprese).
 */
import { SHIP_CLASSES } from '../data/defs'
import { CM_INTERCEPT_RANGE, ENERGY_MAX_RANGE } from '../sim/constants'
import { predictPath } from '../sim/physics'
import {
  drawEffects, drawWrecks, ingestEvents, shipSilhouette,
  type Effect, type Wreck,
} from './fx'
import {
  enginePlume, HULL_GEOM, hullLights, hullShadow, setLightDir, shipBody,
  type HullPalette,
} from './hull3d'
import { sceneFor, type SceneDef } from './scenes'
import { bodyStyleFor, drawBody } from './celestial'
import type {
  Contact, DecorField, Hyperlimit, MissileState, ShipState, SimState, Vec2,
} from '../sim/types'

const ZOOM_MIN = 50        // km/px
const ZOOM_MAX = 500_000   // km/px
const PICK_PX = 15

/**
 * Pinch-zoom (dotyk): nové měřítko z poměru vzdáleností prstů —
 * roztažení (d1 > d0) přibližuje (méně km/px). Čistá funkce (testy).
 */
export function pinchZoom(kmPerPx: number, d0: number, d1: number): number {
  if (d0 <= 0 || d1 <= 0) return kmPerPx
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, kmPerPx * (d0 / d1)))
}
/** přibližná obálka útočných raket (km) — viz GAME_DESIGN kap. 2 */
/** poháněné obálky z klidu: LO (46k g/180 s) a HI (92k g/60 s) */
const MISSILE_ENVELOPE_LO = 7_300_000
const MISSILE_ENVELOPE_HI = 1_600_000

const CLR = {
  bg: '#05080a',
  grid: '#0d1c10',
  gridLabel: '#31563a',
  own: '#58e06a',
  ownDim: '#2f8a3c',
  rolled: '#d8b34f',
  wedge: '#8fe08a',
  contactUnknown: '#e0c05a',
  contactHostile: '#e06c5a',
  /** kapitulovaná loď — šedobílá, s vlajkou ▽ */
  surrendered: '#cfd8d4',
  sensorRing: '#3f7f8f',
  missileOwn: '#9fe08a',
  missileFoe: '#ff705c',
  ring: '#2a5a2e',
  ringLabel: '#4a7a4e',
  sel: '#eaffea',
  label: '#6fae74',
  path: '#3a8a44',
  hyperlimit: '#d8b34f',
  nav: '#3f7f8f',
  navSel: '#7fd0e0',
}

/** zvětšení objemových trupů v HW režimu (čtou pak jako modely, ne ikonky) */
const HW_SCALE = 1.5

/** palety objemových trupů pro „Homeworld" režim (viz hull3d.ts) */
const HULL_PAL: Record<string, HullPalette> = {
  own: {
    light: '#b8e8c4', mid: '#3f6f5a', dark: '#0d2018', spec: '#eafff2',
    lights: '#8ff6ff', sun: '#ffc49a', window: '#bfeaff',
  },
  rolled: {
    light: '#ffe6a0', mid: '#9a7a3a', dark: '#241a06', spec: '#fff6d8',
    lights: '#ffd27a', sun: '#ffd9a0', window: '#ffe8bf',
  },
  hostile: {
    light: '#e8a68c', mid: '#7a4030', dark: '#1f0d08', spec: '#ffe2d6',
    lights: '#ff8a75', sun: '#ffd0a0', window: '#ffcf9a',
  },
  unknown: {
    light: '#e8cf94', mid: '#75632e', dark: '#211a08', spec: '#fff4cf',
    lights: '#ffe08a', sun: '#ffd9a0', window: '#ffe8bf',
  },
  surrendered: {
    light: '#eef2f0', mid: '#7a877f', dark: '#252d29', spec: '#ffffff',
    lights: '#cfd8d4', sun: '#ffd9c0', window: '#dfe8e4',
  },
}

/**
 * Telegraf záměru nepřátelské lodi (D2): přečte postoj z jejího stavu, ať
 * hráč vidí, co dělá, a jeho protikrok je „zasloužený". Priorita: rolování
 * (klín do dráhy) → chystaná salva → útěk → vysílání. null = nic zásadního.
 */
function telegraph(foe: ShipState): { text: string; warn: boolean } | null {
  if (foe.destroyed) return null
  if (foe.rolledTo !== null) return { text: '⟳ roluje – klín k nám', warn: true }
  if (foe.pendingWave) return { text: '⚠ chystá salvu', warn: true }
  if (foe.doctrine === 'runner') return { text: '⇗ prchá', warn: false }
  if (foe.activeSensors) return { text: '◎ vysílá', warn: false }
  return null
}

interface Pickable { id: number; x: number; y: number; r?: number }

/** stylizovaný poloměr planety (px) — velké těleso na světové pozici */
const PLANET_R = 58

const trimNum = (v: number): string => {
  const s = v.toFixed(1)
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

const fmtDist = (km: number): string => {
  const a = Math.abs(km)
  if (a >= 1e6) return trimNum(km / 1e6) + 'M km'
  if (a >= 1e3) return trimNum(km / 1e3) + 'k km'
  return Math.round(km) + ' km'
}

export class TacticalPlot {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private state: SimState | null = null
  private snapAt = 0
  private compression = 0
  /** hyperlimit scénáře (nastavuje main.ts při onReady) */
  private hyperlimit: Hyperlimit | null = null
  private kmPerPx = 20_000
  /** posun kamery vůči sledované lodi (km) */
  private pan: Vec2 = { x: 0, y: 0 }
  /** loď, na které je střed (vybraná vlastní loď) */
  followId: number | null = null
  selectedId: number | null = null
  /** hromadný výběr vlastních lodí (dvojitý obrys; primární = followId silněji) */
  selectedShipIds: number[] = []
  /** zvýrazněná vlastní salva (id salvy) — nastavuje controller */
  selectedSalvoId: number | null = null
  /** klik do plotu: nejbližší loď/kontakt do ~15 px (jinak null) + světová pozice */
  onPick: ((id: number | null, world: Vec2, shift: boolean) => void) | null = null
  /** Shift-tažení: obdélníkový výběr — rohy ve světových souřadnicích */
  onBoxSelect: ((a: Vec2, b: Vec2) => void) | null = null

  private pickables: Pickable[] = []
  private raf = 0
  private drag: { x: number; y: number; moved: boolean } | null = null
  /** rozpracovaný obdélníkový výběr (Shift-tažení), screen souřadnice */
  private boxSel: { x0: number; y0: number; x1: number; y1: number } | null = null
  /** aktivní pointery (dotyk): id → poloha v canvas souřadnicích */
  private pointers = new Map<number, Vec2>()
  /** rozpracovaný pinch: vzdálenost prstů + střed (canvas souřadnice) */
  private pinch: { d: number; cx: number; cy: number } | null = null
  /** po pinchi potlačit tap/klik (prst se zvedá, nemá vybírat loď) */
  private suppressTap = false
  /**
   * Režim hromadného výběru (mobil — náhrada Shiftu): tap = toggle výběru,
   * tažení = obdélníkový výběr. Přepíná tlačítko „Výběr" v liště rozkazů.
   */
  multiSelectMode = false

  /**
   * Vzhled plotu: 'hw' = objemové nasvícené trupy + mlhovina + přesvit
   * (Homeworld dojem), 'cic' = klasické tenké vektorové siluety.
   * Výchozí HW; persist v localStorage, přepínač v topbaru.
   */
  renderMode: 'hw' | 'cic' = 'hw'

  /** aktuální měřítko (km/px) — čtení pro testy/smoke */
  get zoom(): number {
    return this.kmPerPx
  }

  setRenderMode(mode: 'hw' | 'cic'): void {
    this.renderMode = mode
    try { localStorage.setItem('wob-gfx3d', mode === 'hw' ? '1' : '0') } catch { /* noop */ }
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d nedostupný')
    this.ctx = ctx
    // vzhled z předvolby (výchozí HW/objemový)
    try { if (localStorage.getItem('wob-gfx3d') === '0') this.renderMode = 'cic' } catch { /* noop */ }

    const canvasXY = (e: PointerEvent): Vec2 => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    // syntetické eventy (testy) a exotické prohlížeče: capture nesmí shodit handler
    const capture = (id: number): void => {
      try { canvas.setPointerCapture(id) } catch { /* neplatné pointerId — noop */ }
    }

    canvas.addEventListener('pointerdown', e => {
      const p = canvasXY(e)
      this.pointers.set(e.pointerId, p)
      if (this.pointers.size === 2) {
        // druhý prst = pinch: zruš rozpracovaný pan/box, tap se po něm ruší
        const [a, b] = [...this.pointers.values()]
        this.pinch = { d: Math.hypot(b.x - a.x, b.y - a.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }
        this.drag = null
        this.boxSel = null
        this.suppressTap = true
        capture(e.pointerId)
        return
      }
      // Shift-tažení / režim výběru = obdélníkový výběr; jinak pan
      if (e.shiftKey || this.multiSelectMode) {
        this.boxSel = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }
      } else {
        this.drag = { x: e.clientX, y: e.clientY, moved: false }
      }
      capture(e.pointerId)
    })
    canvas.addEventListener('pointermove', e => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, canvasXY(e))
      // pinch: zoom kolem středu prstů + posun kamery se středem
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()]
        const d1 = Math.hypot(b.x - a.x, b.y - a.y)
        const cx = (a.x + b.x) / 2
        const cy = (a.y + b.y) / 2
        if (d1 > 0) {
          const before = this.screenToWorld(cx, cy)
          this.kmPerPx = pinchZoom(this.kmPerPx, this.pinch.d, d1)
          const after = this.screenToWorld(cx, cy)
          this.pan.x += before.x - after.x
          this.pan.y += before.y - after.y
        }
        this.pan.x -= (cx - this.pinch.cx) * this.kmPerPx
        this.pan.y += (cy - this.pinch.cy) * this.kmPerPx
        this.pinch = { d: d1 > 0 ? d1 : this.pinch.d, cx, cy }
        return
      }
      if (this.boxSel) {
        const p = canvasXY(e)
        this.boxSel.x1 = p.x
        this.boxSel.y1 = p.y
        return
      }
      if (!this.drag) return
      const dx = e.clientX - this.drag.x
      const dy = e.clientY - this.drag.y
      if (!this.drag.moved && Math.hypot(dx, dy) < 4) return
      this.drag.moved = true
      this.pan.x -= dx * this.kmPerPx
      this.pan.y += dy * this.kmPerPx
      this.drag.x = e.clientX
      this.drag.y = e.clientY
    })
    const release = (e: PointerEvent): void => {
      this.pointers.delete(e.pointerId)
      if (this.pointers.size < 2) this.pinch = null
      if (this.pointers.size === 0 && this.suppressTap) {
        // konec pinch gesta — poslední prst nahoře, tap se nekoná
        this.suppressTap = false
        this.drag = null
        this.boxSel = null
        return
      }
      if (this.suppressTap) return
      if (e.type !== 'pointerup') { this.drag = null; this.boxSel = null; return }
      const p = canvasXY(e)
      if (this.boxSel) {
        const box = this.boxSel
        this.boxSel = null
        const movedBox = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) >= 4
        if (movedBox) {
          this.onBoxSelect?.(
            this.screenToWorld(box.x0, box.y0), this.screenToWorld(box.x1, box.y1))
        } else {
          // Shift-klik / tap v režimu výběru bez tažení: toggle výběru lodi
          this.onPick?.(this.pick(p.x, p.y), this.screenToWorld(p.x, p.y), true)
        }
        return
      }
      const wasClick = this.drag !== null && !this.drag.moved
      this.drag = null
      if (!wasClick) return
      this.onPick?.(this.pick(p.x, p.y), this.screenToWorld(p.x, p.y),
        e.shiftKey || this.multiSelectMode)
    }
    canvas.addEventListener('pointerup', release)
    canvas.addEventListener('pointercancel', release)
    canvas.addEventListener('wheel', e => {
      e.preventDefault()
      const r = canvas.getBoundingClientRect()
      const sx = e.clientX - r.left
      const sy = e.clientY - r.top
      const before = this.screenToWorld(sx, sy)
      const f = Math.exp(e.deltaY * 0.0012)
      this.kmPerPx = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.kmPerPx * f))
      const after = this.screenToWorld(sx, sy)
      this.pan.x += before.x - after.x
      this.pan.y += before.y - after.y
    }, { passive: false })
  }

  /** vizuální efekty z eventů simu (fáze A — viditelná obrana, vraky) */
  private effects: Effect[] = []
  private wrecks: Wreck[] = []
  private fxScenario = ''

  setSnapshot(state: SimState, compression: number): void {
    this.state = state
    this.compression = compression
    this.snapAt = performance.now()
    // efekty: nová mise = čistý plot; eventy snapshotu → efekty (jednou,
    // worker eventy po odeslání maže)
    if (state.scenarioId !== this.fxScenario) {
      this.fxScenario = state.scenarioId
      this.effects = []
      this.wrecks = []
      this.outcomeSeen = 'running'
    }
    ingestEvents(state.events, state.ships, this.effects, this.wrecks, this.snapAt)
    // šťáva (fáze C): otřes + rudý puls při zásahu do vlastní lodi
    for (const ev of state.events) {
      if ((ev.kind === 'missileHit' || ev.kind === 'energyHit') && ev.slowdown === true) {
        this.shakeUntil = this.snapAt + 280
        this.pulseUntil = this.snapAt + 550
      }
      if (ev.kind === 'shipDestroyed' && ev.side === 'player') {
        this.shakeUntil = this.snapAt + 450
        this.pulseUntil = this.snapAt + 900
      }
    }
    // hyperpřechod: přechod mise do výhry = aurora záblesk
    if (state.outcome === 'win' && this.outcomeSeen === 'running') {
      this.flashUntil = this.snapAt + 1400
    }
    this.outcomeSeen = state.outcome
  }

  /** šťáva (fáze C): časovače otřesu, pulsu okraje a aurora záblesku */
  private shakeUntil = 0
  private pulseUntil = 0
  private flashUntil = 0
  private outcomeSeen = 'running'

  setCourseCursor(on: boolean): void {
    this.canvas.style.cursor = on ? 'crosshair' : 'default'
  }

  setHyperlimit(h: Hyperlimit | null): void {
    this.hyperlimit = h
  }

  /** kosmetika mapy (fáze B): pole asteroidů + nádech mlhoviny soustavy */
  private decor: DecorField[] = []
  private ambient: string | null = null
  /** dlaždice hvězdného pozadí (2 paralaxní vrstvy) — kreslí se jednou */
  private starTiles: HTMLCanvasElement[] = []

  /** vizuální scéna aktuální mise (hvězda, mlhovina, atmosféra) */
  private scene: SceneDef | null = null
  /** světové ukotvení dekorativních těles scény (spočte se jednou z počáteční
   *  normalizované pozice) — aby panovaly/zoomovaly s mapou, ne s obrazovkou */
  private sceneBodyAnchors: { wx: number; wy: number; wr: number }[] | null = null

  setEnvironment(decor: DecorField[] | undefined, ambient: string | undefined): void {
    this.decor = decor ?? []
    this.ambient = ambient ?? null
  }

  /** nastaví scénu mise + srovná směr světla trupů s hvězdou na pozadí */
  setScene(scene: SceneDef): void {
    this.scene = scene
    this.sceneBodyAnchors = null // nová scéna → přepočítat světové ukotvení těles
    setLightDir(0.5 - scene.star.x, 0.5 - scene.star.y)
  }

  /** hash → [0,1) pro deterministické rozložení hvězd/balvanů */
  private static h01(a: number, b: number): number {
    let h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 40503)) >>> 0
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296
  }

  /** líné vytvoření hvězdných dlaždic 512×512 (jemná/hustá vrstva) */
  private ensureStars(): void {
    if (this.starTiles.length > 0) return
    // mobil: poloviční hustota hvězd (fáze D — výkon)
    const coarse = matchMedia('(pointer: coarse)').matches
    for (const [layer, count] of [[0, coarse ? 42 : 85], [1, coarse ? 24 : 48]] as const) {
      const tile = document.createElement('canvas')
      tile.width = 512
      tile.height = 512
      const tctx = tile.getContext('2d')
      if (!tctx) continue
      for (let i = 0; i < count; i++) {
        const x = TacticalPlot.h01(layer * 977 + i, 11) * 512
        const y = TacticalPlot.h01(layer * 977 + i, 29) * 512
        const b = TacticalPlot.h01(layer * 977 + i, 47)
        tctx.fillStyle = b > 0.85 ? '#9fd8a0' : '#5a7a6a'
        tctx.globalAlpha = 0.25 + b * (layer === 0 ? 0.35 : 0.6)
        const s = layer === 1 && b > 0.9 ? 2 : 1
        tctx.fillRect(x, y, s, s)
      }
      this.starTiles.push(tile)
    }
  }

  /** paralaxní hvězdné pozadí + nádech mlhoviny soustavy */
  private drawBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    this.ensureStars()
    const c = this.camCenter()
    const parallax = [0.05, 0.12] // vrstvy se hýbou zlomkem kamery
    for (let i = 0; i < this.starTiles.length; i++) {
      const tile = this.starTiles[i]
      const px = (c.x / this.kmPerPx) * parallax[i]
      const py = (-c.y / this.kmPerPx) * parallax[i]
      const ox = -(((px % 512) + 512) % 512)
      const oy = -(((py % 512) + 512) % 512)
      for (let x = ox; x < w; x += 512) {
        for (let y = oy; y < h; y += 512) ctx.drawImage(tile, x, y)
      }
    }
    const hw = this.renderMode === 'hw'
    if (this.ambient) {
      // nádech mlhoviny: velký radiální gradient, velmi nízká alfa
      const g = ctx.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, Math.max(w, h))
      g.addColorStop(0, this.ambient)
      g.addColorStop(1, 'transparent')
      ctx.save()
      ctx.globalAlpha = hw ? 0.2 : 0.16
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
    }
    // HW režim: vrstvená mlhovina (pár velkých měkkých obláčků) + prachový
    // pás + vinětace — vesmír dostane hloubku a barvu jako v Homeworldu
    if (hw) this.drawNebula(ctx, w, h)
  }

  /**
   * Soumraková atmosféra (jen HW režim): hvězda v levém horním rohu (souhlasí
   * se směrem světla na trupech), teplý opar planety dole, mlhovinové obláčky
   * a vinětace. Cíl = kinematický „Homeworld za soumraku" dojem.
   */
  private drawNebula(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const coarse = matchMedia('(pointer: coarse)').matches
    const c = this.camCenter()
    const sc = this.scene ?? sceneFor(this.fxScenario, this.ambient ?? undefined)
    const sunX = w * sc.star.x
    const sunY = h * sc.star.y

    // 1) atmosférický opar mise: nahoře → dole
    const atm = ctx.createLinearGradient(0, 0, 0, h)
    atm.addColorStop(0, sc.atmTop)
    atm.addColorStop(0.5, sc.nebA)
    atm.addColorStop(1, sc.atmBot)
    ctx.save()
    ctx.globalAlpha = 0.45
    ctx.fillStyle = atm
    ctx.fillRect(0, 0, w, h)
    ctx.restore()

    // 2) mlhovinové obláčky (aditivně, pomalá paralaxa)
    const clouds = coarse ? 2 : 4
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < clouds; i++) {
      const px = (c.x / this.kmPerPx) * 0.03
      const py = (-c.y / this.kmPerPx) * 0.03
      const cx = ((TacticalPlot.h01(i, 7) * 1.4 - 0.2) * w - px) % (w * 1.4)
      const cy = ((TacticalPlot.h01(i, 19) * 1.4 - 0.2) * h - py) % (h * 1.4)
      const R = (0.35 + TacticalPlot.h01(i, 31) * 0.45) * Math.max(w, h)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R)
      g.addColorStop(0, i % 2 === 0 ? sc.nebA : sc.nebB)
      g.addColorStop(0.5, i % 2 === 0 ? sc.nebB : sc.nebA)
      g.addColorStop(1, 'transparent')
      ctx.globalAlpha = 0.09
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()
    }
    // 3) hvězda soustavy + korónový přesvit (barva dle scény)
    const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(w, h) * 0.6)
    halo.addColorStop(0, sc.starCore)
    halo.addColorStop(0.12, sc.starHalo)
    halo.addColorStop(0.4, sc.nebA)
    halo.addColorStop(1, 'transparent')
    ctx.globalAlpha = 0.5
    ctx.fillStyle = halo
    ctx.beginPath()
    ctx.arc(sunX, sunY, Math.max(w, h) * 0.6, 0, Math.PI * 2)
    ctx.fill()
    // jádro hvězdy (jemné chvění)
    const rc = 20 + Math.sin(performance.now() / 900) * 2
    const core = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, rc)
    core.addColorStop(0, '#ffffff')
    core.addColorStop(0.5, sc.starCore)
    core.addColorStop(1, 'transparent')
    ctx.globalAlpha = 0.95
    ctx.fillStyle = core
    ctx.beginPath()
    ctx.arc(sunX, sunY, rc, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 4) planety a další velká tělesa na SVĚTOVÝCH pozicích (mapa mise)
    this.drawCelestials(ctx, sc, sunX, sunY)

    // 5) vinětace: ztmavení okrajů (drží čitelnost středu)
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.78)
    vg.addColorStop(0, 'transparent')
    vg.addColorStop(1, '#02040688')
    ctx.save()
    ctx.fillStyle = vg
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  /**
   * Velká nebeská tělesa (planety) na svých světových pozicích — kreslí se
   * za mřížkou i loděmi. Nasvícená z hvězdy scény (terminátor na odvrácené
   * straně), s atmosférickým prstencem. Marker/label řeší drawBuoy.
   */
  private drawCelestials(ctx: CanvasRenderingContext2D, sc: SceneDef, sunX: number, sunY: number): void {
    const now = performance.now()
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const star = { core: sc.starCore, halo: sc.starHalo }

    // 1) dekorativní tělesa scény (plynný obr, měsíc…) — UKOTVENÁ VE SVĚTĚ:
    //    světovou pozici odvodíme JEDNOU z počáteční normalizované pozice a
    //    kamery, pak je kreslíme přes worldToScreen. Pan/zoom je odsune z výhledu
    //    jako vzdálenou scenérii (dřív visely na obrazovce a překážely).
    const bodies = sc.bodies ?? []
    if (bodies.length > 0 && w > 0 && h > 0) {
      if (!this.sceneBodyAnchors || this.sceneBodyAnchors.length !== bodies.length) {
        const c0 = this.camCenter()
        this.sceneBodyAnchors = bodies.map(b => ({
          wx: c0.x + (b.x * w - w / 2) * this.kmPerPx,
          wy: c0.y - (b.y * h - h / 2) * this.kmPerPx,
          wr: b.r * this.kmPerPx,
        }))
      }
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i]
        const a = this.sceneBodyAnchors[i]
        const p = this.worldToScreen({ x: a.wx, y: a.wy })
        const R = a.wr / this.kmPerPx
        if (p.x < -R * 3 || p.x > w + R * 3 || p.y < -R * 3 || p.y > h + R * 3) continue
        let lx = sunX - p.x, ly = sunY - p.y
        const lm = Math.hypot(lx, ly) || 1
        drawBody(ctx, p.x, p.y, R, b.style, b.tint ?? sc.planet, star, lx / lm, ly / lm, now, 100 + i)
      }
    }

    // 2) planety na SVĚTOVÝCH pozicích (entity mapy) — styl dle jména
    const s = this.state
    if (!s) return
    for (const body of s.ships) {
      if (body.classId !== 'planet' || body.destroyed) continue
      const p = this.worldToScreen(body.pos)
      const R = PLANET_R
      if (p.x < -R * 3 || p.x > w + R * 3 || p.y < -R * 3 || p.y > h + R * 3) continue
      let lx = sunX - p.x, ly = sunY - p.y
      const lm = Math.hypot(lx, ly) || 1
      const style = bodyStyleFor(body.name)
      drawBody(ctx, p.x, p.y, R, style, sc.planet, star, lx / lm, ly / lm, now, body.id)
    }
  }

  /** pole asteroidů: deterministické balvany s pomalým driftem (kosmetika) */
  private drawDecor(ctx: CanvasRenderingContext2D): void {
    if (this.decor.length === 0) return
    const now = performance.now()
    ctx.save()
    ctx.fillStyle = '#5a7a5e'
    for (let f = 0; f < this.decor.length; f++) {
      const field = this.decor[f]
      const seed = field.seed ?? f + 1
      const n = field.count ?? 60
      const rPx = field.radius / this.kmPerPx
      if (rPx < 8) continue // moc daleko — pole splývá, nekreslit
      for (let i = 0; i < n; i++) {
        const a0 = TacticalPlot.h01(seed, i * 3) * Math.PI * 2
        const rr = Math.sqrt(TacticalPlot.h01(seed, i * 3 + 1)) * field.radius
        // pomalý orbitální drift — čistě vizuální
        const a = a0 + (now / 1e6) * (0.5 + TacticalPlot.h01(seed, i * 3 + 2))
        const p = this.worldToScreen({
          x: field.center.x + Math.cos(a) * rr,
          y: field.center.y + Math.sin(a) * rr,
        })
        const s = 1 + TacticalPlot.h01(seed + 7, i) * 2
        ctx.globalAlpha = 0.3 + TacticalPlot.h01(seed + 13, i) * 0.35
        ctx.fillRect(p.x, p.y, s, s)
      }
    }
    ctx.restore()
  }

  /** vycentruje kameru zpět na sledovanou loď */
  recenter(): void {
    this.pan = { x: 0, y: 0 }
  }

  start(): void {
    if (this.raf) return
    const loop = (): void => {
      this.draw()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  // ---------- transformace ----------

  /** sim-sekundy uplynulé od snapshotu (extrapolace, se stropem) */
  private extraDt(): number {
    if (!this.state) return 0
    const real = (performance.now() - this.snapAt) / 1000
    return Math.min(real * this.compression, this.compression * 0.25 + 2)
  }

  private exPos(pos: Vec2, vel: Vec2, extra = 0): Vec2 {
    const dt = this.extraDt() + extra
    return { x: pos.x + vel.x * dt, y: pos.y + vel.y * dt }
  }

  private camCenter(): Vec2 {
    let base: Vec2 = { x: 0, y: 0 }
    if (this.state && this.followId != null) {
      const ship = this.state.ships.find(sh => sh.id === this.followId)
      if (ship) base = this.exPos(ship.pos, ship.vel)
    }
    return { x: base.x + this.pan.x, y: base.y + this.pan.y }
  }

  private worldToScreen(p: Vec2): Vec2 {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const c = this.camCenter()
    return { x: w / 2 + (p.x - c.x) / this.kmPerPx, y: h / 2 - (p.y - c.y) / this.kmPerPx }
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    const c = this.camCenter()
    return { x: c.x + (sx - w / 2) * this.kmPerPx, y: c.y - (sy - h / 2) * this.kmPerPx }
  }

  private pick(sx: number, sy: number): number | null {
    // nejbližší střed vyhrává; každý pickable má vlastní práh (velká tělesa
    // jako planeta = poloměr vykresleného tělesa, ne globálních 15 px)
    let best: number | null = null
    let bd = Infinity
    for (const p of this.pickables) {
      const d = Math.hypot(p.x - sx, p.y - sy)
      if (d <= (p.r ?? PICK_PX) && d < bd) { bd = d; best = p.id }
    }
    return best
  }

  // ---------- kreslení ----------

  /**
   * Míra přiblížení 0..1 pro LOD lodí: 0 = odzoomováno (malé ikony),
   * 1 = max přiblížení (velké modely s detaily). Logaritmicky dle km/px.
   */
  private zoomLod(): number {
    const a = Math.log(6000), b = Math.log(120)
    return Math.max(0, Math.min(1, (a - Math.log(this.kmPerPx)) / (a - b)))
  }

  /** měřítko objemového trupu: LOD růst + extra zvětšení pod 120 km/px,
   *  ať si hráč loď při maximálním přiblížení opravdu prohlédne (detaily
   *  PDLC/radiátorů/chase zbraní by na ~90 px zanikly) */
  private hullScale(lod: number): number {
    const close = Math.sqrt(120 / Math.max(50, this.kmPerPx))
    return HW_SCALE * (1 + lod * 2) * Math.max(1, Math.min(1.6, close))
  }

  /** poloměr hitboxu lodi: v HW režimu roste s VYKRESLENÝM trupem (půlka
   *  délky × měřítko) — přiblížená loď je ~150 px a klik na trup musí sedět */
  private hullPickR(hullCode: string | undefined): number {
    if (this.renderMode !== 'hw' || !hullCode) return PICK_PX
    const g = HULL_GEOM[hullCode]
    if (!g) return PICK_PX
    return Math.max(PICK_PX, g.len * this.hullScale(this.zoomLod()))
  }

  private draw(): void {
    const dpr = window.devicePixelRatio || 1
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (w === 0 || h === 0) return
    const pw = Math.round(w * dpr)
    const ph = Math.round(h * dpr)
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw
      this.canvas.height = ph
    }
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    // otřes obrazu při zásahu (fáze C): pár px jitteru s dozvukem
    const now = performance.now()
    if (now < this.shakeUntil) {
      const k = (this.shakeUntil - now) / 280
      ctx.translate(
        Math.sin(now / 13) * 3 * k,
        Math.cos(now / 17) * 3 * k,
      )
    }
    ctx.fillStyle = CLR.bg
    ctx.fillRect(-8, -8, w + 16, h + 16)
    ctx.font = '10px Consolas, Menlo, monospace'

    this.pickables = []
    this.drawBackdrop(ctx, w, h)
    this.drawGrid(ctx, w, h)
    this.drawDecor(ctx)
    this.drawHyperlimit(ctx, w, h)

    const s = this.state
    if (!s) return

    this.drawRangeRings(ctx)
    for (const ship of s.ships) {
      if (ship.side === 'player' && !ship.destroyed) this.drawNavPlan(ctx, ship)
    }
    for (const ship of s.ships) {
      if (ship.side === 'player' && !ship.destroyed) this.drawFormationLink(ctx, ship)
    }
    this.drawSalvoMarkers(ctx, s.missiles)
    for (const m of s.missiles) this.drawMissile(ctx, m)
    for (const ship of s.ships) {
      // navigační bóje jsou veřejné majáky — vysílají polohu, kreslí se vždy
      if (ship.side === 'neutral' && ship.doctrine === 'buoy' && !ship.destroyed) {
        this.drawBuoy(ctx, ship)
      }
    }
    for (const ship of s.ships) {
      if (ship.side === 'player' && !ship.destroyed) this.drawOwnShip(ctx, ship)
    }
    for (const c of s.contacts.player) this.drawContact(ctx, c)
    // vraky (trvalé zakreslení) a bojové efekty nad vším
    drawWrecks(ctx, this.wrecks, pt => this.worldToScreen(pt))
    drawEffects(ctx, this.effects, performance.now(), pt => this.worldToScreen(pt))
    this.drawSelectionMarker(ctx)
    this.drawSelectionBox(ctx)
    this.drawJuice(ctx, w, h)
  }

  /** rudý puls okraje při zásahu + aurora hyperpřechodu při výhře (fáze C) */
  private drawJuice(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const now = performance.now()
    if (now < this.pulseUntil) {
      const k = (this.pulseUntil - now) / 550
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72)
      g.addColorStop(0, 'transparent')
      g.addColorStop(1, '#7a2a1f')
      ctx.save()
      ctx.globalAlpha = 0.5 * k
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.restore()
    }
    if (now < this.flashUntil) {
      // aurora: zelenobílé pásy přes obraz, rychle dohasínají
      const k = (this.flashUntil - now) / 1400
      ctx.save()
      ctx.globalAlpha = 0.35 * k
      for (let i = 0; i < 4; i++) {
        const y = h * (0.15 + i * 0.22) + Math.sin(now / 300 + i * 2) * 14
        const g = ctx.createLinearGradient(0, y - 26, 0, y + 26)
        g.addColorStop(0, 'transparent')
        g.addColorStop(0.5, i % 2 === 0 ? '#8fe08a' : '#eaffea')
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.fillRect(0, y - 26, w, 52)
      }
      ctx.restore()
    }
  }

  /** čárkovaný rám rozpracovaného obdélníkového výběru (Shift-tažení) */
  private drawSelectionBox(ctx: CanvasRenderingContext2D): void {
    const b = this.boxSel
    if (!b) return
    ctx.save()
    ctx.strokeStyle = CLR.sel
    ctx.setLineDash([5, 4])
    ctx.lineWidth = 1
    ctx.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1),
      Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0))
    ctx.restore()
  }

  /** tenká čára člen formace → leader */
  private drawFormationLink(ctx: CanvasRenderingContext2D, ship: ShipState): void {
    const s = this.state
    const f = ship.formation
    if (!s || !f) return
    const leader = s.ships.find(x => x.id === f.leaderId && !x.destroyed)
    if (!leader) return
    const p = this.worldToScreen(this.exPos(ship.pos, ship.vel))
    const l = this.worldToScreen(this.exPos(leader.pos, leader.vel))
    ctx.save()
    ctx.strokeStyle = CLR.ownDim
    ctx.globalAlpha = 0.35
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(l.x, l.y)
    ctx.stroke()
    ctx.restore()
  }

  private drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    // krok mřížky: 1/2/5 × 10^n tak, aby dílek vyšel na ~120 px
    const target = 120 * this.kmPerPx
    const pow = Math.pow(10, Math.floor(Math.log10(target)))
    let step = pow * 10
    for (const m of [1, 2, 5, 10]) {
      if (m * pow >= target) { step = m * pow; break }
    }
    const c = this.camCenter()
    const x0 = c.x - (w / 2) * this.kmPerPx
    const x1 = c.x + (w / 2) * this.kmPerPx
    const y0 = c.y - (h / 2) * this.kmPerPx
    const y1 = c.y + (h / 2) * this.kmPerPx

    ctx.strokeStyle = CLR.grid
    ctx.fillStyle = CLR.gridLabel
    ctx.lineWidth = 1
    for (let wx = Math.ceil(x0 / step) * step; wx <= x1; wx += step) {
      const sx = w / 2 + (wx - c.x) / this.kmPerPx
      ctx.beginPath()
      ctx.moveTo(sx, 0)
      ctx.lineTo(sx, h)
      ctx.stroke()
      ctx.fillText(fmtDist(wx), sx + 3, h - 6)
    }
    for (let wy = Math.ceil(y0 / step) * step; wy <= y1; wy += step) {
      const sy = h / 2 - (wy - c.y) / this.kmPerPx
      ctx.beginPath()
      ctx.moveTo(0, sy)
      ctx.lineTo(w, sy)
      ctx.stroke()
      ctx.fillText(fmtDist(wy), 4, sy - 3)
    }
    // popisek měřítka pod topbarem (y=64) — v y=14 ho překrýval topbar,
    // na mobilu (vyšší tlačítka) úplně
    ctx.fillText('dílek = ' + fmtDist(step) + '   měřítko ' + fmtDist(this.kmPerPx) + '/px', 4, 64)
  }

  /** čárkovaná jantarová hyperlimitní čára/kružnice s popiskem */
  private drawHyperlimit(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const hl = this.hyperlimit
    if (!hl) return
    ctx.save()
    ctx.setLineDash([8, 8])
    ctx.strokeStyle = CLR.hyperlimit
    ctx.fillStyle = CLR.hyperlimit
    ctx.globalAlpha = 0.7
    ctx.lineWidth = 1.5
    if (hl.kind === 'lineX') {
      const sx = this.worldToScreen({ x: hl.x, y: 0 }).x
      if (sx > -50 && sx < w + 50) {
        ctx.beginPath()
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, h)
        ctx.stroke()
        ctx.fillText('HYPERLIMIT', sx + 6, 28)
      }
    } else {
      const c = this.worldToScreen(hl.center)
      const rPx = hl.radius / this.kmPerPx
      // kružnice může být obří — kreslíme jen když je aspoň část vidět
      const dCenter = Math.hypot(c.x - w / 2, c.y - h / 2)
      if (rPx > 4 && dCenter - rPx < Math.hypot(w, h)) {
        ctx.beginPath()
        ctx.arc(c.x, c.y, rPx, 0, Math.PI * 2)
        ctx.stroke()
        // popisek na průsečíku kružnice se směrem ke středu obrazovky
        const ang = Math.atan2(h / 2 - c.y, w / 2 - c.x)
        ctx.fillText('HYPERLIMIT', c.x + Math.cos(ang) * rPx + 6, c.y + Math.sin(ang) * rPx - 6)
      }
    }
    ctx.restore()
  }

  /** navigační kurz vlastní/spojenecké lodi: tečkovaná čára k cíli + waypoint */
  private drawNavPlan(ctx: CanvasRenderingContext2D, ship: ShipState): void {
    const s = this.state
    const nav = ship.nav
    if (!s || !nav) return
    let destWorld: Vec2 | null = null
    if (nav.kind === 'course') {
      destWorld = nav.dest
    } else {
      const target = s.ships.find(x => x.id === nav.targetId && !x.destroyed)
      if (target) destWorld = this.exPos(target.pos, target.vel)
    }
    if (!destWorld) return
    const p = this.worldToScreen(this.exPos(ship.pos, ship.vel))
    const d = this.worldToScreen(destWorld)
    const selected = ship.id === this.selectedId || ship.id === this.followId
    // vícebodová trasa: waypointy za aktuálním cílem (course.then)
    const rest = nav.kind === 'course' && nav.then ? nav.then.map(w => this.worldToScreen(w)) : []
    ctx.save()
    ctx.strokeStyle = selected ? CLR.navSel : CLR.nav
    ctx.fillStyle = selected ? CLR.navSel : CLR.nav
    ctx.globalAlpha = selected ? 0.9 : 0.55
    ctx.setLineDash([1, 5])
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(d.x, d.y)
    for (const w of rest) ctx.lineTo(w.x, w.y)
    ctx.stroke()
    // symbol waypointu: malý kosočtverec (course) / kroužek (intercept)
    ctx.setLineDash([])
    const diamond = (q: Vec2): void => {
      ctx.beginPath()
      ctx.moveTo(q.x, q.y - 4); ctx.lineTo(q.x + 4, q.y); ctx.lineTo(q.x, q.y + 4); ctx.lineTo(q.x - 4, q.y)
      ctx.closePath()
      ctx.stroke()
    }
    if (nav.kind === 'course') {
      diamond(d)
      for (const w of rest) diamond(w)
    } else {
      ctx.beginPath()
      ctx.arc(d.x, d.y, 4, 0, Math.PI * 2)
      ctx.stroke()
    }

    // PREDIKOVANÁ TRAJEKTORIE (jen vybraná loď): skutečná křivka manévru
    // stejnou fyzikou jako sim — otáčení, akcelerace, setrvačnost. Vyšší
    // rychlost ⇒ viditelně širší oblouk. Značka každou minutu letu.
    if (selected) {
      const path = predictPath(s, ship, 1200, 4)
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      for (const pt of path) {
        const q = this.worldToScreen(pt)
        ctx.lineTo(q.x, q.y)
      }
      ctx.stroke()
      for (let i = 14; i < path.length; i += 15) { // 15 × 4 s = 60 s
        const q = this.worldToScreen(path[i])
        ctx.fillRect(q.x - 1.5, q.y - 1.5, 3, 3)
      }
    }
    ctx.restore()
  }

  private drawRangeRings(ctx: CanvasRenderingContext2D): void {
    const s = this.state
    if (!s) return
    // kružnice kolem vybrané vlastní lodi (jinak sledované)
    let ship = s.ships.find(x => x.id === this.selectedId && x.side === 'player' && !x.destroyed)
    if (!ship) ship = s.ships.find(x => x.id === this.followId && !x.destroyed)
    if (!ship) return
    const p = this.worldToScreen(this.exPos(ship.pos, ship.vel))
    const sensorRange = SHIP_CLASSES[ship.classId]?.activeSensorRange ?? 0
    const rings: { r: number; label: string; color?: string }[] = [
      { r: MISSILE_ENVELOPE_LO, label: 'rakety LO ~7,3M km' },
      { r: MISSILE_ENVELOPE_HI, label: 'rakety HI ~1,6M km' },
      { r: CM_INTERCEPT_RANGE, label: 'CM 2,5M km' },
      { r: ENERGY_MAX_RANGE, label: 'energie 500k km' },
    ]
    // dosah aktivních senzorů (plná identifikace) — čárkovaně, vlastní barva
    if (sensorRange > 0) {
      rings.push({
        r: sensorRange,
        label: `senzory ${(sensorRange / 1e6).toFixed(0)} M km`,
        color: CLR.sensorRing,
      })
    }
    ctx.save()
    ctx.setLineDash([4, 6])
    for (const ring of rings) {
      const rPx = ring.r / this.kmPerPx
      if (rPx < 12 || rPx > 6000) continue
      ctx.strokeStyle = ring.color ?? CLR.ring
      ctx.fillStyle = ring.color ?? CLR.ringLabel
      ctx.beginPath()
      ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillText(ring.label, p.x + rPx * 0.7071 + 4, p.y - rPx * 0.7071 - 4)
    }
    ctx.restore()
  }

  /** fosforová stopa (fáze C): dohasínající čára ZA lodí proti vektoru */
  private drawTrail(ctx: CanvasRenderingContext2D, p: Vec2, vel: Vec2, color: string): void {
    const v = Math.hypot(vel.x, vel.y)
    if (v < 1) return
    const px = Math.min(80, (v * 25) / this.kmPerPx)
    if (px < 6) return
    const nx = vel.x / v
    const ny = vel.y / v
    ctx.save()
    const g = ctx.createLinearGradient(p.x, p.y, p.x - nx * px, p.y + ny * px)
    g.addColorStop(0, color)
    g.addColorStop(1, 'transparent')
    ctx.strokeStyle = g
    ctx.globalAlpha = 0.28
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x - nx * px, p.y + ny * px)
    ctx.stroke()
    ctx.restore()
  }

  private drawVelVector(ctx: CanvasRenderingContext2D, p: Vec2, vel: Vec2, color: string): void {
    const v = Math.hypot(vel.x, vel.y)
    if (v < 0.5) return
    // délka úměrná |vel| (dráha za 120 s ve světovém měřítku), s rozumným stropem
    const px = Math.min(160, Math.max(8, (v * 120) / this.kmPerPx))
    const nx = vel.x / v
    const ny = vel.y / v
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p.x + nx * px, p.y - ny * px)
    ctx.stroke()
  }

  private drawHullIcon(ctx: CanvasRenderingContext2D, hullCode: string): void {
    // detailní vektorové siluety per třída (fáze A) — viz fx.ts
    shipSilhouette(ctx, hullCode)
  }

  /** klín: jas oblouků roste s tahem, nad 100 % červená (nouzový výkon) */
  private drawWedge(ctx: CanvasRenderingContext2D, throttle = 0.8): void {
    ctx.save()
    ctx.strokeStyle = throttle > 1 ? '#ff8a75' : CLR.wedge
    ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, throttle)
    ctx.beginPath()
    ctx.arc(0, -6, 10, -2.5, -0.64)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 6, 10, 0.64, 2.5)
    ctx.stroke()
    ctx.restore()
  }

  /** pohonná záře za zádí — délka dle tahu, mihotání render časem */
  private drawDrive(ctx: CanvasRenderingContext2D, ship: ShipState, stern: number): void {
    if (!ship.wedgeOn || ship.throttle <= 0) return
    const flick = 1 + 0.18 * Math.sin(performance.now() / 47 + ship.id * 1.7)
    const L = (4 + ship.throttle * 8) * flick
    ctx.save()
    ctx.strokeStyle = ship.throttle > 1 ? '#ff8a75' : '#d8b34f'
    ctx.globalAlpha = 0.75
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(stern, -1.5); ctx.lineTo(stern - L, 0); ctx.lineTo(stern, 1.5)
    ctx.stroke()
    ctx.restore()
  }

  /** navigační bóje/maják: šedý kosočtverec s křížkem a popiskem — vždy viditelná */
  private drawBuoy(ctx: CanvasRenderingContext2D, ship: ShipState): void {
    const p = this.worldToScreen(ship.pos)
    // planeta: gradientní kotouč s terminátorem a prstencem atmosféry.
    // V HW režimu velké těleso kreslí drawCelestials na světové pozici —
    // tady zůstane jen popisek + pickable (bez malého kotouče).
    if (ship.classId === 'planet' && this.renderMode === 'hw') {
      ctx.fillStyle = CLR.label
      ctx.fillText(ship.name, p.x + PLANET_R + 4, p.y + 3)
      // hitbox pokrývá celé vykreslené těleso (drawCelestials, poloměr PLANET_R)
      this.pickables.push({ id: ship.id, x: p.x, y: p.y, r: PLANET_R })
      return
    }
    if (ship.classId === 'planet') {
      const R = 13
      ctx.save()
      const g = ctx.createRadialGradient(p.x - R * 0.4, p.y - R * 0.4, R * 0.15, p.x, p.y, R)
      g.addColorStop(0, '#2d7a54')
      g.addColorStop(0.65, '#123a2a')
      g.addColorStop(1, '#081a10')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(p.x, p.y, R, 0, Math.PI * 2)
      ctx.fill()
      // terminátor: ztmavená odvrácená strana
      ctx.globalAlpha = 0.45
      ctx.fillStyle = '#02060a'
      ctx.beginPath()
      ctx.arc(p.x, p.y, R, -Math.PI * 0.42, Math.PI * 0.58)
      ctx.arc(p.x + R * 0.5, p.y + R * 0.18, R * 0.95, Math.PI * 0.58, -Math.PI * 0.42, true)
      ctx.fill()
      // prstenec atmosféry
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = '#58e06a'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(p.x, p.y, R + 2.5, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = CLR.label
      ctx.fillText(ship.name, p.x + R + 6, p.y + 3)
      ctx.restore()
      // hitbox i výběrový kroužek dle SKUTEČNÉ velikosti kotouče (CIC ~13 px),
      // ne dle HW poloměru PLANET_R — jinak by kroužek trčel kolem drobné planety
      this.pickables.push({ id: ship.id, x: p.x, y: p.y, r: R + 3 })
      return
    }
    // sonda/maják: drobný pulzující bod (kosmetický objekt mapy)
    if (ship.classId === 'probe') {
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 600 + ship.id))
      ctx.save()
      ctx.globalAlpha = pulse
      ctx.fillStyle = CLR.sensorRing
      ctx.beginPath()
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.35
      ctx.strokeStyle = CLR.sensorRing
      ctx.beginPath()
      ctx.arc(p.x, p.y, 5 + pulse * 3, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 0.55
      ctx.fillStyle = CLR.label
      ctx.fillText(ship.name, p.x + 8, p.y + 3)
      ctx.restore()
      this.pickables.push({ id: ship.id, x: p.x, y: p.y })
      return
    }
    const r = 5
    ctx.strokeStyle = CLR.surrendered
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(p.x, p.y - r)
    ctx.lineTo(p.x + r, p.y)
    ctx.lineTo(p.x, p.y + r)
    ctx.lineTo(p.x - r, p.y)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(p.x - r - 3, p.y)
    ctx.lineTo(p.x + r + 3, p.y)
    ctx.moveTo(p.x, p.y - r - 3)
    ctx.lineTo(p.x, p.y + r + 3)
    ctx.stroke()
    ctx.fillStyle = CLR.label
    ctx.fillText(ship.name, p.x + r + 5, p.y + 3)
    this.pickables.push({ id: ship.id, x: p.x, y: p.y })
  }

  private drawOwnShip(ctx: CanvasRenderingContext2D, ship: ShipState): void {
    const p = this.worldToScreen(this.exPos(ship.pos, ship.vel))
    const hull = SHIP_CLASSES[ship.classId]?.hullCode ?? 'DD'
    this.pickables.push({ id: ship.id, x: p.x, y: p.y, r: this.hullPickR(hull) })

    // predikce dráhy: extrapolace 10 min, tečkovaně
    const fut = this.worldToScreen(this.exPos(ship.pos, ship.vel, 600))
    ctx.save()
    ctx.strokeStyle = CLR.path
    ctx.setLineDash([2, 6])
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(fut.x, fut.y)
    ctx.stroke()
    ctx.restore()

    this.drawTrail(ctx, p, ship.vel, CLR.ownDim)
    this.drawVelVector(ctx, p, ship.vel, CLR.ownDim)

    const hw = this.renderMode === 'hw'
    const now = performance.now()
    // poškození: pod 50 % trupu silueta bliká, pod 25 % jiskří
    const hullPct = (SHIP_CLASSES[ship.classId]?.hullPoints ?? 1) > 0
      ? Math.max(0, ship.hull / (SHIP_CLASSES[ship.classId]?.hullPoints ?? 1))
      : 1
    const primary = ship.id === this.followId
    const selected = primary || this.selectedShipIds.includes(ship.id)
    // výběr (HW): měkký přesvitový prstenec kolem lodi (screen souřadnice)
    if (hw && selected) {
      const gr = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, primary ? 22 : 18)
      gr.addColorStop(0, 'transparent')
      gr.addColorStop(0.7, 'transparent')
      gr.addColorStop(1, primary ? '#eaffea' : '#8fe08a')
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = primary ? 0.5 : 0.32
      ctx.fillStyle = gr
      ctx.beginPath()
      ctx.arc(p.x, p.y, primary ? 22 : 18, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(-ship.heading) // svět y nahoru → obrazovka y dolů
    if (hullPct < 0.5) {
      ctx.globalAlpha = 0.65 + 0.35 * Math.abs(Math.sin(now / 130 + ship.id))
    }
    if (hw) {
      const pal = ship.surrendered ? HULL_PAL.surrendered
        : ship.rolledTo != null ? HULL_PAL.rolled : HULL_PAL.own
      const lod = this.zoomLod()
      ctx.save()
      const sc = this.hullScale(lod)
      ctx.scale(sc, sc)
      hullShadow(ctx, hull, ship.heading)
      // pohon z kiltu (záď trupu), ať vlečka nepřekrývá siluetu
      if (ship.wedgeOn && ship.throttle > 0) {
        const stern = (HULL_GEOM[hull] ?? HULL_GEOM.DEFAULT).stern
        enginePlume(ctx, stern, ship.throttle, now, ship.id, '#eaffff', '#3fb0d8')
      }
      shipBody(ctx, hull, ship.heading, pal, lod)
      if (hullPct >= 0.5) hullLights(ctx, hull, pal, now, ship.id)
      ctx.restore()
    } else {
      ctx.lineWidth = 1.5
      ctx.strokeStyle = ship.rolledTo != null ? CLR.rolled : CLR.own
      this.drawHullIcon(ctx, hull)
    }
    if (hullPct < 0.25) {
      // jiskřící trhliny — deterministicky z render času a id lodi
      const ph = Math.floor(now / 180) + ship.id * 13
      ctx.strokeStyle = '#ffd27a'
      ctx.lineWidth = 0.8
      for (let i = 0; i < 2; i++) {
        const a = ((ph * 37 + i * 71) % 100) / 100 * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3)
        ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    // vybrané lodě (CIC): dvojitý obrys (primární — followId — silněji)
    if (!hw && selected) {
      ctx.save()
      ctx.scale(primary ? 1.6 : 1.45, primary ? 1.6 : 1.45)
      ctx.lineWidth = primary ? 1 : 0.7
      ctx.globalAlpha = primary ? 0.8 : 0.55
      ctx.strokeStyle = ship.rolledTo != null ? CLR.rolled : CLR.own
      this.drawHullIcon(ctx, hull)
      ctx.restore()
    }
    if (!hw) this.drawDrive(ctx, ship, hull === 'DN' || hull === 'BC' ? -13 : -8)
    if (ship.wedgeOn) this.drawWedge(ctx, ship.throttle)
    ctx.restore()

    ctx.fillStyle = CLR.label
    ctx.fillText(ship.name + (ship.activeSensors ? ' [AKT]' : ''), p.x + 12, p.y - 10)
  }

  private drawContact(ctx: CanvasRenderingContext2D, c: Contact): void {
    // entita kontaktu (kapitulace, telegraf záměru, filtr zakreslených těles)
    const foe = this.state?.ships.find(s => s.id === c.shipId)
    // ZAKRESLENO V MAPÁCH: neutrální statické objekty (planety, sondy, bóje,
    // civilní stanice) kreslí drawBuoy jako tělesa/majáky včetně pickable.
    // Kontaktní lodní glyf by je překreslil na „loď" — PLT/PRB nemají trupovou
    // geometrii a padaly na DEFAULT vřeteno (planeta vypadala jako loď).
    if (foe?.side === 'neutral' && foe.doctrine === 'buoy') return
    // paměťový pin: kreslí se na POSLEDNÍ ZNÁMÉ pozici (bez extrapolace,
    // ta by ducha odnesla přes půl mapy), ztlumeně; statický objekt bez
    // kružnice nejistoty — stanice ani planeta nikam neodletí
    const memory = c.memory === true
    // odhad polohy: poslední známá pozice + vel · (stáří dat + čas od snapshotu)
    const est = memory ? c.pos : this.exPos(c.pos, c.vel, c.age)
    const p = this.worldToScreen(est)
    if (memory) ctx.save()
    if (memory) ctx.globalAlpha = 0.45
    const guessHullPick = SHIP_CLASSES[c.classGuess]?.hullCode
    this.pickables.push({ id: c.shipId, x: p.x, y: p.y, r: this.hullPickR(guessHullPick) })
    const surrendered = foe?.surrendered === true
    const color = surrendered
      ? CLR.surrendered
      : c.idQuality === 0 ? CLR.contactUnknown : CLR.contactHostile

    // kroužek nejistoty ~ age · |vel| (statický paměťový objekt ho nemá)
    if (c.staticObject !== true) {
      const rKm = c.age * Math.hypot(c.vel.x, c.vel.y)
      const rPx = Math.min(500, Math.max(6, rKm / this.kmPerPx))
      ctx.save()
      ctx.strokeStyle = color
      ctx.globalAlpha = memory ? 0.3 : 0.45
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.arc(p.x, p.y, rPx, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    if (!memory) this.drawTrail(ctx, p, c.vel, color)
    this.drawVelVector(ctx, p, c.vel, color)

    // značka: klasifikovaný kontakt = silueta odhadnuté třídy (menší),
    // neznámý = otevřený kosočtverec; natočení po směru letu
    const ang = Math.hypot(c.vel.x, c.vel.y) > 0.5 ? Math.atan2(c.vel.y, c.vel.x) : 0
    // silueta, jakmile je třída známa (plná identifikace NEBO revealClass)
    const guessHull = SHIP_CLASSES[c.classGuess]?.hullCode
    const hw = this.renderMode === 'hw'
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(-ang)
    ctx.lineWidth = 1.5
    ctx.strokeStyle = color
    if (guessHull && hw) {
      // objemový nepřátelský/neznámý trup, nasvícený a s pohonem
      const pal = surrendered ? HULL_PAL.surrendered
        : c.idQuality === 0 ? HULL_PAL.unknown : HULL_PAL.hostile
      const lod = this.zoomLod()
      const sc = this.hullScale(lod)
      ctx.scale(sc, sc)
      if (!memory) {
        hullShadow(ctx, guessHull, ang)
        if (Math.hypot(c.vel.x, c.vel.y) > 0.5 && !surrendered) {
          const stern = (HULL_GEOM[guessHull] ?? HULL_GEOM.DEFAULT).stern
          enginePlume(ctx, stern, 0.7, performance.now(), c.shipId, '#ffe6d8', '#c85a3a')
        }
      }
      shipBody(ctx, guessHull, ang, pal, lod)
    } else if (guessHull) {
      ctx.scale(0.85, 0.85)
      shipSilhouette(ctx, guessHull)
    } else {
      if (hw) {
        // neznámý kontakt: kosočtverec s jemným přesvitem
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 9)
        gr.addColorStop(0, color)
        gr.addColorStop(1, 'transparent')
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = 0.35
        ctx.fillStyle = gr
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
      }
      ctx.beginPath()
      ctx.moveTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.lineTo(0, -6)
      ctx.closePath()
      ctx.stroke()
    }
    ctx.restore()

    // CÍL MISE: pojmenuj objektivní kontakt jménem z briefingu i před klasifikací
    // senzory (hráč vidí „tohle je Cygnus"); třída/detaily zůstávají skryté níže.
    if (foe?.objective === true && !surrendered) {
      ctx.save()
      ctx.fillStyle = '#ffd24a'
      ctx.fillText(`◎ ${foe.name}`, p.x + 10, p.y + 2)
      ctx.restore()
    }

    const cls = guessHull ?? (c.idQuality === 0 ? '???' : c.classGuess)
    ctx.fillStyle = color
    if (surrendered) {
      // vlajka kapitulace nad značkou
      ctx.fillText('▽', p.x - 4, p.y - 10)
      ctx.fillText(`${cls} · kapituloval`, p.x + 10, p.y + 14)
    } else if (memory) {
      // paměťový pin: poslední známé zakreslení (statika trvale, lodě stárnou)
      ctx.fillText(
        c.staticObject === true ? `${cls} · zakresleno` : `${cls} · paměť ${Math.round(c.age)} s`,
        p.x + 10, p.y + 14)
    } else {
      ctx.fillText(`${cls} · ${Math.round(c.age)} s`, p.x + 10, p.y + 14)
      // TELEGRAF ZÁMĚRU (D2): u sledovaného nepřítele čti jeho postoj, ať je
      // protikrok „zasloužený". Jen dobrý track (idQuality ≥ 1) a AKTUÁLNÍ
      // data (c.age ≈ 0) — u zpožděného EM kontaktu bychom četli živý stav
      // dřív, než by světlorychlostní senzorové zpoždění dovolilo (respekt
      // k senzorovému modelu).
      if (foe && foe.side !== 'player' && c.idQuality >= 1 && c.age < 0.5) {
        const tg = telegraph(foe)
        if (tg) {
          ctx.save()
          ctx.fillStyle = tg.warn ? '#ffb14a' : CLR.ringLabel
          ctx.fillText(tg.text, p.x + 10, p.y + 24)
          ctx.restore()
        }
      }
    }
    if (memory) ctx.restore()
  }

  /**
   * Značky salv: společné halo + počet střel + čelní šipka. Velikost haly,
   * jas a velikost čísla rostou s počtem raket — z plotu je hned vidět, jak
   * silná vlna to je (3 rakety vs 30). Barva dle strany (naše zelené, cizí
   * rudé). Kreslí se POD jednotlivými raketami, ať čísla nezakrývají hlavice.
   */
  private drawSalvoMarkers(ctx: CanvasRenderingContext2D, missiles: MissileState[]): void {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    // seskup živé střely dle salvoId
    const groups = new Map<number, MissileState[]>()
    for (const m of missiles) {
      if (m.phase === 'dead') continue
      let g = groups.get(m.salvoId)
      if (!g) { g = []; groups.set(m.salvoId, g) }
      g.push(m)
    }
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const [salvoId, ms] of groups) {
      const n = ms.length
      if (n < 2) continue
      // centroid + směr (screen) + rozptyl
      let cx = 0, cy = 0, vx = 0, vy = 0
      const pts: Vec2[] = []
      for (const m of ms) {
        const e = this.exPos(m.pos, m.vel)
        const p = this.worldToScreen(e)
        pts.push(p); cx += p.x; cy += p.y
        vx += m.vel.x; vy += m.vel.y   // svět; převod na screen níž
      }
      cx /= n; cy /= n
      if (cx < -100 || cx > w + 100 || cy < -100 || cy > h + 100) continue
      let spread = 0
      for (const p of pts) { const d = Math.hypot(p.x - cx, p.y - cy); if (d > spread) spread = d }
      // směr letu v obrazovce (svět y nahoru → screen y dolů)
      const svx = vx, svy = -vy
      const vlen = Math.hypot(svx, svy) || 1
      const nx = svx / vlen, ny = svy / vlen
      // čelo vlny: nejpřednější střela ve směru letu
      let lead = pts[0], lproj = -Infinity
      for (const p of pts) {
        const proj = (p.x - cx) * nx + (p.y - cy) * ny
        if (proj > lproj) { lproj = proj; lead = p }
      }
      const own = ms[0].side === 'player'
      const col = own ? CLR.missileOwn : CLR.missileFoe
      const sel = this.selectedSalvoId != null && salvoId === this.selectedSalvoId
      // halo: velikost dle rozptylu i počtu, jas dle počtu
      const haloR = Math.max(spread * 0.95 + 6, 10 + 5 * Math.sqrt(n))
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR)
      g.addColorStop(0, col)
      g.addColorStop(0.5, col)
      g.addColorStop(1, 'transparent')
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = Math.min(0.5, 0.14 + n * 0.012) * (sel ? 1.5 : 1)
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(cx, cy, haloR, 0, Math.PI * 2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1

      // čelní šipka vlny (na nejpřednější střele, míří po vektoru)
      const ax = lead.x + nx * 6, ay = lead.y + ny * 6
      ctx.strokeStyle = col
      ctx.globalAlpha = 0.9
      ctx.lineWidth = sel ? 2 : 1.3
      ctx.beginPath()
      ctx.moveTo(ax - ny * 5, ay + nx * 5)
      ctx.lineTo(ax + nx * 7, ay + ny * 7)
      ctx.lineTo(ax + ny * 5, ay - nx * 5)
      ctx.stroke()

      // počet střel: číslo za čelem vlny, velikost roste s počtem
      const fs = 10 + Math.min(11, Math.round(Math.sqrt(n) * 2.4))
      const lx = lead.x + nx * (fs * 0.7 + 8)
      const ly = lead.y + ny * (fs * 0.7 + 8)
      ctx.font = `bold ${fs}px Consolas, Menlo, monospace`
      ctx.lineWidth = 3
      ctx.strokeStyle = '#02060a'
      ctx.strokeText(`${n}`, lx, ly)
      ctx.fillStyle = sel ? CLR.sel : col
      ctx.fillText(`${n}`, lx, ly)
    }
    ctx.restore()
    ctx.textAlign = 'start'
    ctx.textBaseline = 'alphabetic'
  }

  private drawMissile(ctx: CanvasRenderingContext2D, m: MissileState): void {
    if (m.phase === 'dead') return
    const own = m.side === 'player'
    const ex = this.exPos(m.pos, m.vel)
    const p = this.worldToScreen(ex)
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (p.x < -60 || p.x > w + 60 || p.y < -60 || p.y > h + 60) return
    // vlastní rakety lze klikem vybrat (výběr celé salvy)
    if (own) this.pickables.push({ id: m.id, x: p.x, y: p.y })
    const color = own ? CLR.missileOwn : CLR.missileFoe
    // stopa: 6 s zpět po vektoru — boost jasná, balistika dohasíná
    const boost = m.phase === 'boost'
    const tail = this.worldToScreen({ x: ex.x - m.vel.x * 6, y: ex.y - m.vel.y * 6 })
    ctx.save()
    ctx.globalAlpha = boost ? 0.6 : 0.3
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(tail.x, tail.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    // plamen pohonu (jen boost): mihotavý klínek za hlavicí
    if (boost) {
      const dx = p.x - tail.x
      const dy = p.y - tail.y
      const dl = Math.hypot(dx, dy) || 1
      const fl = (4 + 2 * Math.sin(performance.now() / 40 + m.id)) / dl
      if (this.renderMode === 'hw') {
        // aditivní přesvit: hlavice svítí a plamen se sčítá s pozadím
        ctx.globalCompositeOperation = 'lighter'
        const gl = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 4)
        gl.addColorStop(0, own ? '#d9ffd0' : '#ffcf9a')
        gl.addColorStop(1, 'transparent')
        ctx.globalAlpha = 0.8
        ctx.fillStyle = gl
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 0.9
      ctx.strokeStyle = own ? '#d9ffd0' : '#ffb37a'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - dx * fl, p.y - dy * fl)
      ctx.stroke()
    }
    ctx.restore()
    ctx.globalAlpha = boost ? 1 : 0.7
    ctx.fillStyle = color
    // zvýraznění vybrané salvy: větší bod + kroužek
    if (own && this.selectedSalvoId != null && m.salvoId === this.selectedSalvoId) {
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
      ctx.strokeStyle = CLR.sel
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3)
    }
    ctx.globalAlpha = 1
  }

  private drawSelectionMarker(ctx: CanvasRenderingContext2D): void {
    if (this.selectedId == null) return
    const p = this.pickables.find(x => x.id === this.selectedId)
    if (!p) return
    const isBody = this.state?.ships.find(s => s.id === this.selectedId)?.classId === 'planet'
    ctx.strokeStyle = CLR.sel
    ctx.lineWidth = 1
    if (isBody) {
      // nebeské těleso: soustředný kroužek se čtyřmi ryskami (ne lodní závorky)
      const r = (p.r ?? PLANET_R) + 6
      ctx.beginPath()
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        ctx.moveTo(p.x + dx * r, p.y + dy * r)
        ctx.lineTo(p.x + dx * (r + 6), p.y + dy * (r + 6))
      }
      ctx.stroke()
      return
    }
    const r = 12
    ctx.beginPath()
    // rohové závorky (lodě/kontakty)
    ctx.moveTo(p.x - r, p.y - r + 5); ctx.lineTo(p.x - r, p.y - r); ctx.lineTo(p.x - r + 5, p.y - r)
    ctx.moveTo(p.x + r - 5, p.y - r); ctx.lineTo(p.x + r, p.y - r); ctx.lineTo(p.x + r, p.y - r + 5)
    ctx.moveTo(p.x + r, p.y + r - 5); ctx.lineTo(p.x + r, p.y + r); ctx.lineTo(p.x + r - 5, p.y + r)
    ctx.moveTo(p.x - r + 5, p.y + r); ctx.lineTo(p.x - r, p.y + r); ctx.lineTo(p.x - r, p.y + r - 5)
    ctx.stroke()
  }
}
