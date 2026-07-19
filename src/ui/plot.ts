/**
 * TacticalPlot — vektorový CIC displej (canvas 2D).
 * Svět: km, y nahoru. Obrazovka: px, y dolů. Kamera sleduje vybranou
 * vlastní loď (followId) + pan tažením, log-zoom kolečkem.
 * Mezi snapshoty extrapoluje pozice vel·(reálný čas · komprese).
 */
import { SHIP_CLASSES } from '../data/defs'
import { CM_INTERCEPT_RANGE, ENERGY_MAX_RANGE } from '../sim/constants'
import { predictPath } from '../sim/physics'
import type { Contact, Hyperlimit, MissileState, ShipState, SimState, Vec2 } from '../sim/types'

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

interface Pickable { id: number; x: number; y: number }

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

  /** aktuální měřítko (km/px) — čtení pro testy/smoke */
  get zoom(): number {
    return this.kmPerPx
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d nedostupný')
    this.ctx = ctx

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

  setSnapshot(state: SimState, compression: number): void {
    this.state = state
    this.compression = compression
    this.snapAt = performance.now()
  }

  setCourseCursor(on: boolean): void {
    this.canvas.style.cursor = on ? 'crosshair' : 'default'
  }

  setHyperlimit(h: Hyperlimit | null): void {
    this.hyperlimit = h
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
    let best: number | null = null
    let bd = PICK_PX
    for (const p of this.pickables) {
      const d = Math.hypot(p.x - sx, p.y - sy)
      if (d <= bd) { bd = d; best = p.id }
    }
    return best
  }

  // ---------- kreslení ----------

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
    ctx.fillStyle = CLR.bg
    ctx.fillRect(0, 0, w, h)
    ctx.font = '10px Consolas, Menlo, monospace'

    this.pickables = []
    this.drawGrid(ctx, w, h)
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
    this.drawSelectionMarker(ctx)
    this.drawSelectionBox(ctx)
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
    ctx.fillText('dílek = ' + fmtDist(step) + '   měřítko ' + fmtDist(this.kmPerPx) + '/px', 4, 14)
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
    // lokální souřadnice: +x = příď
    ctx.beginPath()
    switch (hullCode) {
      case 'DD':
        ctx.moveTo(8, 0); ctx.lineTo(-6, 5); ctx.lineTo(-6, -5)
        break
      case 'MERCH':
        ctx.moveTo(-7, -5); ctx.lineTo(7, -5); ctx.lineTo(7, 5); ctx.lineTo(-7, 5)
        break
      case 'CL':
        ctx.moveTo(8, 0); ctx.lineTo(0, 5); ctx.lineTo(-8, 0); ctx.lineTo(0, -5)
        break
      default: // CA a těžší — větší kosočtverec
        ctx.moveTo(10, 0); ctx.lineTo(0, 6); ctx.lineTo(-10, 0); ctx.lineTo(0, -6)
        break
    }
    ctx.closePath()
    ctx.stroke()
  }

  private drawWedge(ctx: CanvasRenderingContext2D): void {
    // dva krátké oblouky nad/pod osou heading (lokálně: nad/pod osou x)
    ctx.strokeStyle = CLR.wedge
    ctx.beginPath()
    ctx.arc(0, -6, 10, -2.5, -0.64)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(0, 6, 10, 0.64, 2.5)
    ctx.stroke()
  }

  /** navigační bóje/maják: šedý kosočtverec s křížkem a popiskem — vždy viditelná */
  private drawBuoy(ctx: CanvasRenderingContext2D, ship: ShipState): void {
    const p = this.worldToScreen(ship.pos)
    // planeta: velký vyplněný kotouč s obrysem — pevný bod mapy
    if (ship.classId === 'planet') {
      ctx.save()
      ctx.fillStyle = '#123a2a'
      ctx.strokeStyle = CLR.gridLabel
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = CLR.label
      ctx.fillText(ship.name, p.x + 16, p.y + 3)
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
    this.pickables.push({ id: ship.id, x: p.x, y: p.y })
    const hull = SHIP_CLASSES[ship.classId]?.hullCode ?? 'DD'

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

    this.drawVelVector(ctx, p, ship.vel, CLR.ownDim)

    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(-ship.heading) // svět y nahoru → obrazovka y dolů
    ctx.lineWidth = 1.5
    ctx.strokeStyle = ship.rolledTo != null ? CLR.rolled : CLR.own
    this.drawHullIcon(ctx, hull)
    // vybrané lodě: dvojitý obrys (primární — followId — silněji)
    const primary = ship.id === this.followId
    if (primary || this.selectedShipIds.includes(ship.id)) {
      ctx.save()
      ctx.scale(primary ? 1.6 : 1.45, primary ? 1.6 : 1.45)
      ctx.lineWidth = primary ? 1 : 0.7
      ctx.globalAlpha = primary ? 0.8 : 0.55
      this.drawHullIcon(ctx, hull)
      ctx.restore()
    }
    if (ship.wedgeOn) this.drawWedge(ctx)
    ctx.restore()

    ctx.fillStyle = CLR.label
    ctx.fillText(ship.name + (ship.activeSensors ? ' [AKT]' : ''), p.x + 12, p.y - 10)
  }

  private drawContact(ctx: CanvasRenderingContext2D, c: Contact): void {
    // paměťový pin: kreslí se na POSLEDNÍ ZNÁMÉ pozici (bez extrapolace,
    // ta by ducha odnesla přes půl mapy), ztlumeně; statický objekt bez
    // kružnice nejistoty — stanice ani planeta nikam neodletí
    const memory = c.memory === true
    // odhad polohy: poslední známá pozice + vel · (stáří dat + čas od snapshotu)
    const est = memory ? c.pos : this.exPos(c.pos, c.vel, c.age)
    const p = this.worldToScreen(est)
    if (memory) ctx.save()
    if (memory) ctx.globalAlpha = 0.45
    this.pickables.push({ id: c.shipId, x: p.x, y: p.y })
    // kapitulovaná loď: šedobílá + vlajka ▽ (už není hrozba)
    const surrendered = this.state?.ships.find(s => s.id === c.shipId)?.surrendered === true
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

    this.drawVelVector(ctx, p, c.vel, color)

    // značka: otevřený kosočtverec natočený po směru letu
    const ang = Math.hypot(c.vel.x, c.vel.y) > 0.5 ? Math.atan2(c.vel.y, c.vel.x) : 0
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(-ang)
    ctx.lineWidth = 1.5
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(6, 0); ctx.lineTo(0, 6); ctx.lineTo(-6, 0); ctx.lineTo(0, -6)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()

    const cls = c.idQuality === 0 ? '???' : (SHIP_CLASSES[c.classGuess]?.hullCode ?? c.classGuess)
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
    }
    if (memory) ctx.restore()
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
    // stopa: 6 s zpět po vektoru
    const tail = this.worldToScreen({ x: ex.x - m.vel.x * 6, y: ex.y - m.vel.y * 6 })
    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = color
    ctx.beginPath()
    ctx.moveTo(tail.x, tail.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    ctx.restore()
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
  }

  private drawSelectionMarker(ctx: CanvasRenderingContext2D): void {
    if (this.selectedId == null) return
    const p = this.pickables.find(x => x.id === this.selectedId)
    if (!p) return
    const r = 12
    ctx.strokeStyle = CLR.sel
    ctx.lineWidth = 1
    ctx.beginPath()
    // rohové závorky
    ctx.moveTo(p.x - r, p.y - r + 5); ctx.lineTo(p.x - r, p.y - r); ctx.lineTo(p.x - r + 5, p.y - r)
    ctx.moveTo(p.x + r - 5, p.y - r); ctx.lineTo(p.x + r, p.y - r); ctx.lineTo(p.x + r, p.y - r + 5)
    ctx.moveTo(p.x + r, p.y + r - 5); ctx.lineTo(p.x + r, p.y + r); ctx.lineTo(p.x + r - 5, p.y + r)
    ctx.moveTo(p.x - r + 5, p.y + r); ctx.lineTo(p.x - r, p.y + r); ctx.lineTo(p.x - r, p.y + r - 5)
    ctx.stroke()
  }
}
