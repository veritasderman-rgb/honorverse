/**
 * UIController — propojení plot ↔ panely ↔ bridge.
 * Drží stav výběru (vlastní loď / cíl), režim „klik = kurz",
 * mapuje akce na Order objekty a obsluhuje klávesy.
 */
import { SHIP_CLASSES } from '../data/defs'
import type { DriveMode, Order, ShipState, SimState, Vec2 } from '../sim/types'
import type { SimBridge } from '../worker/bridge'
import type { TacticalPlot } from './plot'
import { contactEstPos, type PanelAction, type Panels, type UiState } from './panels'

const COMP_LADDER = [0, 1, 10, 100, 1000, 10000]

export class UIController {
  private state: SimState | null = null
  private ownShipId: number | null = null
  private targetId: number | null = null
  private courseMode = false
  private salvoMode: DriveMode = 1
  private compression = 0
  /** poslední nenulová komprese (pro obnovení po pauze) */
  private lastRunning = 1
  private slowdownText: string | null = null
  private slowdownUntil = 0

  constructor(
    private bridge: SimBridge,
    private plot: TacticalPlot,
    private panels: Panels,
  ) {
    plot.onPick = (id, world) => this.onPlotClick(id, world)
    window.addEventListener('keydown', e => this.onKey(e))
  }

  // ---------- snapshoty ----------

  handleSnapshot(state: SimState, compression: number): void {
    this.state = state
    this.compression = compression

    // výchozí vlastní loď (nebo náhrada za zničenou)
    const ownValid = state.ships.some(s => s.id === this.ownShipId && s.side === 'player' && !s.destroyed)
    if (!ownValid) {
      const own = state.ships.find(s => s.side === 'player' && !s.destroyed)
      if (own) this.ownShipId = own.id
    }

    // auto-slowdown: událost se slowdown → komprese na 1× + indikátor
    for (const ev of state.events) {
      if (ev.slowdown) {
        this.slowdownText = ev.text
        this.slowdownUntil = performance.now() + 8000
        if (this.compression > 1) this.setCompression(1)
      }
    }
    if (this.slowdownText && performance.now() > this.slowdownUntil) this.slowdownText = null

    this.panels.addEvents(state.events)
    this.plot.followId = this.ownShipId
    this.plot.selectedId = this.targetId ?? this.ownShipId
    this.plot.setSnapshot(state, this.compression)
    this.panels.update(state, this.ui())
  }

  // ---------- komprese ----------

  setCompression(f: number): void {
    if (f > 0) this.lastRunning = f
    this.compression = f
    this.bridge.setCompression(f)
    this.refresh()
  }

  private stepCompression(dir: 1 | -1): void {
    let i = COMP_LADDER.indexOf(this.compression)
    if (i < 0) i = 1
    const ni = Math.max(0, Math.min(COMP_LADDER.length - 1, i + dir))
    this.setCompression(COMP_LADDER[ni])
  }

  // ---------- akce z panelů ----------

  handleAction(a: PanelAction): void {
    switch (a.kind) {
      case 'compression':
        this.setCompression(a.factor)
        break
      case 'select':
        this.targetId = a.id
        this.refresh()
        break
      case 'order':
        this.doOrder(a.act)
        break
    }
  }

  private doOrder(act: string): void {
    const s = this.state
    if (!s) return
    const own = s.ships.find(sh => sh.id === this.ownShipId)
    if (!own || own.destroyed) return
    const t = this.targetId
    switch (act) {
      case 'intercept':
        if (t != null) this.send({ kind: 'intercept', shipId: own.id, targetId: t })
        break
      case 'course':
        this.courseMode = !this.courseMode
        this.plot.setCourseCursor(this.courseMode)
        break
      case 'salvo2': this.salvo(own, 2); break
      case 'salvo4': this.salvo(own, 4); break
      case 'salvoFull': this.salvo(own, SHIP_CLASSES[own.classId]?.tubesPerBroadside ?? 4); break
      case 'mode':
        this.salvoMode = this.salvoMode === 1 ? 0 : 1
        break
      case 'energy':
        if (t != null) this.send({ kind: 'fireEnergy', shipId: own.id, targetId: t })
        break
      case 'rollThreat': {
        const dir = this.threatDir(own)
        if (dir != null) this.send({ kind: 'roll', shipId: own.id, towards: dir })
        break
      }
      case 'rollBack':
        this.send({ kind: 'roll', shipId: own.id, towards: null })
        break
      case 'wedge':
        this.send({ kind: 'setWedge', shipId: own.id, on: !own.wedgeOn })
        break
      case 'sensors':
        this.send({ kind: 'setActiveSensors', shipId: own.id, on: !own.activeSensors })
        break
    }
    this.refresh()
  }

  private salvo(own: ShipState, count: number): void {
    if (this.targetId == null || own.missiles <= 0) return
    this.send({ kind: 'launchSalvo', shipId: own.id, targetId: this.targetId, count, mode: this.salvoMode })
  }

  /** směr k hrozbě: vybraný cíl, jinak nejbližší kontakt */
  private threatDir(own: ShipState): number | null {
    const s = this.state
    if (!s) return null
    let p: Vec2 | null = null
    if (this.targetId != null) {
      const c = s.contacts.player.find(x => x.shipId === this.targetId)
      if (c) p = contactEstPos(c)
      else {
        const sh = s.ships.find(x => x.id === this.targetId)
        if (sh) p = sh.pos
      }
    }
    if (!p) {
      let best = Infinity
      for (const c of s.contacts.player) {
        const est = contactEstPos(c)
        const d = Math.hypot(est.x - own.pos.x, est.y - own.pos.y)
        if (d < best) { best = d; p = est }
      }
    }
    if (!p) return null
    return Math.atan2(p.y - own.pos.y, p.x - own.pos.x)
  }

  // ---------- klik do plotu ----------

  private onPlotClick(id: number | null, world: Vec2): void {
    // režim „klik = kurz"
    if (this.courseMode && this.ownShipId != null) {
      this.courseMode = false
      this.plot.setCourseCursor(false)
      this.send({ kind: 'setCourse', shipId: this.ownShipId, dest: world, arriveAtRest: false })
      this.refresh()
      return
    }
    if (id == null) {
      this.targetId = null
      this.refresh()
      return
    }
    const ship = this.state?.ships.find(sh => sh.id === id)
    if (ship && ship.side === 'player') {
      this.ownShipId = id
      this.plot.recenter()
    } else {
      this.targetId = id
    }
    this.refresh()
  }

  // ---------- klávesy ----------

  private onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
    switch (e.key) {
      case ' ':
        e.preventDefault()
        this.setCompression(this.compression > 0 ? 0 : this.lastRunning)
        break
      case '+': case '=':
        this.stepCompression(1)
        break
      case '-': case '_':
        this.stepCompression(-1)
        break
      case 'r': case 'R': {
        const own = this.state?.ships.find(sh => sh.id === this.ownShipId)
        if (!own) break
        this.doOrder(own.rolledTo != null ? 'rollBack' : 'rollThreat')
        break
      }
    }
  }

  // ---------- pomocné ----------

  private send(order: Order): void {
    this.bridge.sendOrder(order)
  }

  private ui(): UiState {
    return {
      ownShipId: this.ownShipId,
      targetId: this.targetId,
      courseMode: this.courseMode,
      salvoMode: this.salvoMode,
      compression: this.compression,
      slowdownText: this.slowdownText,
    }
  }

  /** okamžitý přerender panelů + synchronizace plotu */
  private refresh(): void {
    this.plot.followId = this.ownShipId
    this.plot.selectedId = this.targetId ?? this.ownShipId
    if (this.state) this.panels.update(this.state, this.ui(), true)
  }
}
