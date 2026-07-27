/**
 * UIController — propojení plot ↔ panely ↔ bridge.
 * Drží stav výběru (vlastní loď / cíl), režim „klik = kurz",
 * mapuje akce na Order objekty a obsluhuje klávesy.
 */
import { SHIP_CLASSES } from '../data/defs'
import type { DriveMode, Order, ShipState, SimEvent, SimState, Vec2 } from '../sim/types'
import type { SimBridge } from '../worker/bridge'
import type { TacticalPlot } from './plot'
import { contactEstPos, type HudView, type PanelAction, type UiState } from './panels'
import { CombatStatsTracker } from './combatStats'
import { helpBoxHtml } from './help'
import {
  boxSelectShips, normalizeSelection, resolveOwnShipId, rosterPick, toggleShipSelection,
} from './roster'
import { spreadPodTargets } from '../sim/firecontrol'
import { localizeEventText } from '../data/localizeEvent'
import { dist } from '../sim/vec'

const COMP_LADDER = [0, 1, 10, 100, 1000, 10000]

/** localStorage klíč přepínače auto-zpomalování (⚠ v topbaru) */
const AUTOSLOW_KEY = 'wob-autoslow'
/** grace po ruční změně komprese — žádné auto-zpomalení (ms reálného času) */
const AUTOSLOW_GRACE_MS = 5000
/** auto-zrychlení: potřebná délka klidu na jeden stupeň komprese */
const AUTOCRUISE_AFTER_MS = 20_000
/** auto-zrychlení: grace po ruční změně komprese */
const AUTOCRUISE_GRACE_MS = 30_000
/** nepřítel blíž než tohle = akce, nezrychlovat (km) */
const AUTOCRUISE_NEAR_KM = 2_000_000

export class UIController {
  private state: SimState | null = null
  private ownShipId: number | null = null
  /** hromadný výběr vlastních ovladatelných lodí (vždy obsahuje ownShipId) */
  private selectedShipIds: number[] = []
  private targetId: number | null = null
  private courseMode = false
  /** rozpracovaná vícebodová trasa (Shift-kliky v režimu kurzu) */
  private routeStarted = false
  private compression = 0
  /** poslední nenulová komprese (pro obnovení po pauze) */
  private lastRunning = 1
  private slowdownText: string | null = null
  private slowdownUntil = 0
  /** auto-zrychlení: od kdy trvá klid (null = právě se něco děje) */
  private quietSince: number | null = null
  /** vybraná vlastní salva (klik na raketu v plotu) */
  private selectedSalvoId: number | null = null
  /** další odpaly jako autonomní salvy (fire-and-forget) */
  private autonomousMode = false
  /** další salvy s eskortní rušičkou (+rušička) */
  private escortJammerMode = false
  /** auto-zpomalování času (⚠ toggle v topbaru, persistentní, default ZAP) */
  private autoSlow = true
  /** čas poslední RUČNÍ změny komprese (grace pro auto-zpomalení) */
  private manualCompAt = -Infinity
  /** lodě, jejichž contactNew už zpomalil (zpomalí jen první detekce) */
  private seenContacts = new Set<number>()

  /** sdílený akumulátor bojové statistiky (skóre i HUDy z něj čtou) */
  readonly stats = new CombatStatsTracker()

  constructor(
    private bridge: SimBridge,
    private plot: TacticalPlot,
    private panels: HudView,
  ) {
    plot.onPick = (id, world, shift) => this.onPlotClick(id, world, shift)
    plot.onBoxSelect = (a, b) => this.onBoxSelect(a, b)
    window.addEventListener('keydown', e => this.onKey(e))
    try {
      this.autoSlow = localStorage.getItem(AUTOSLOW_KEY) !== '0'
    } catch { /* localStorage nedostupná (testy) — default ZAP */ }
  }

  // ---------- snapshoty ----------

  handleSnapshot(state: SimState, compression: number): void {
    this.state = state
    this.compression = compression

    // výchozí vlastní loď (nebo náhrada za zničenou) — preferuj ovladatelné
    this.ownShipId = resolveOwnShipId(state, this.ownShipId)
    // hromadný výběr: vyhoď zaniklé lodě, primární drž vždy uvnitř
    this.selectedShipIds = normalizeSelection(state, this.selectedShipIds, this.ownShipId)

    // auto-slowdown: jen důležité události (filtr eventSlows) → komprese na 1×;
    // při vypnutém přepínači (⚠ VYP) jen indikátor/blik; grace po ruční změně
    let sawPriority = false
    for (const ev of state.events) {
      if (!this.eventSlows(ev)) continue
      sawPriority = true
      this.slowdownText = localizeEventText(ev)
      this.slowdownUntil = performance.now() + 8000
      if (this.autoSlow && this.compression > 1
        && performance.now() - this.manualCompAt > AUTOSLOW_GRACE_MS) {
        this.setCompression(1)
      }
    }
    if (this.slowdownText && performance.now() > this.slowdownUntil) this.slowdownText = null
    this.updateAutoCruise(state, sawPriority)

    // vybraná salva už neexistuje (dorazila/sestřelena) → zrušit výběr
    if (this.selectedSalvoId != null && !state.missiles.some(m =>
      m.side === 'player' && m.salvoId === this.selectedSalvoId && m.phase !== 'dead')) {
      this.selectedSalvoId = null
    }

    for (const ev of state.events) this.stats.count(ev) // bojová statistika (sdílená)
    this.panels.addEvents(state.events)
    this.plot.followId = this.ownShipId
    this.plot.selectedId = this.targetId ?? this.ownShipId
    this.plot.selectedShipIds = this.selectedShipIds
    this.plot.selectedSalvoId = this.selectedSalvoId
    this.plot.setSnapshot(state, this.compression)
    this.panels.update(state, this.ui())
  }

  /**
   * Filtr auto-zpomalení: komunikace, cíle mise, zničení lodi, PRVNÍ detekce
   * kontaktu, zásah do vlastní lodi a zprávy misí (triggery, bez speakera).
   * Odpaly salv NEzpomalují (sim už launch eventy neflaguje).
   */
  private eventSlows(ev: SimEvent): boolean {
    switch (ev.kind) {
      case 'comm':
      case 'objective':
      case 'shipDestroyed':
        return ev.slowdown === true
      case 'contactNew': {
        if (ev.slowdown !== true || ev.side !== 'player' || ev.shipId == null) return false
        if (this.seenContacts.has(ev.shipId)) return false
        this.seenContacts.add(ev.shipId)
        return true
      }
      case 'missileHit':
      case 'energyHit':
        return ev.slowdown === true // sim flaguje jen zásahy do lodí hráče
      case 'message':
        return ev.slowdown === true && !ev.speaker // jen zprávy misí (triggery)
      default:
        return false
    }
  }

  // ---------- komprese ----------

  /**
   * AUTO-ZRYCHLENÍ hluchých pasáží (protipól auto-zpomalení, sdílí přepínač
   * ⚠ AUTO): žádné rakety ve vzduchu, žádná prioritní událost a nepřítel dál
   * než na dosah energií → po AUTOCRUISE_AFTER_MS klidu komprese sama stoupne
   * o stupeň (1→10→100; bez nepřátelských kontaktů až 1000). Prioritní
   * událost ji vrací na 1× (auto-slowdown výš); po ruční změně platí grace.
   */
  private updateAutoCruise(state: SimState, sawPriority: boolean): void {
    const now = performance.now()
    const missilesLive = state.missiles.some(m => m.phase !== 'dead')
    // blízkost měříme ke VŠEM živým lodím hráče — bitva křídla se nesmí
    // zrychlit jen proto, že vlajková loď zrovna křižuje jinde (Codex review)
    const ours = state.ships.filter(s => s.side === 'player' && !s.destroyed)
    let hostiles = 0
    let nearHostile = false
    for (const c of state.contacts.player) {
      const tgt = state.ships.find(s => s.id === c.shipId)
      if (tgt?.side !== 'enemy' || tgt.destroyed || tgt.surrendered) continue
      hostiles++
      const est = contactEstPos(c)
      if (ours.some(s => dist(s.pos, est) < AUTOCRUISE_NEAR_KM)) nearHostile = true
    }
    const busy = sawPriority || missilesLive || nearHostile
    if (busy) { this.quietSince = null; return }
    if (this.quietSince == null) { this.quietSince = now; return }
    if (!this.autoSlow || state.outcome !== 'running') return
    if (this.compression < 1) return // pauza je pauza
    if (now - this.quietSince < AUTOCRUISE_AFTER_MS) return
    if (now - this.manualCompAt < AUTOCRUISE_GRACE_MS) return
    const cap = hostiles > 0 ? 100 : 1000
    if (this.compression >= cap) return
    const next = this.compression < 10 ? 10 : this.compression < 100 ? 100 : 1000
    this.setCompression(Math.min(next, cap))
    this.quietSince = now // další stupeň až po dalším tichém intervalu
  }

  setCompression(f: number, manual = false): void {
    if (manual) this.manualCompAt = performance.now()
    if (f > 0) this.lastRunning = f
    this.compression = f
    this.bridge.setCompression(f)
    this.refresh()
  }

  private stepCompression(dir: 1 | -1): void {
    let i = COMP_LADDER.indexOf(this.compression)
    if (i < 0) i = 1
    const ni = Math.max(0, Math.min(COMP_LADDER.length - 1, i + dir))
    this.setCompression(COMP_LADDER[ni], true)
  }

  // ---------- akce z panelů ----------

  handleAction(a: PanelAction): void {
    switch (a.kind) {
      case 'compression':
        this.setCompression(a.factor, true)
        break
      case 'select':
        this.targetId = a.id
        this.refresh()
        break
      case 'order':
        this.doOrder(a.act, a.shift === true)
        break
    }
  }

  /** vybrané živé lodě pro hromadné rozkazy (primární první) */
  private selectedShips(): ShipState[] {
    const s = this.state
    if (!s) return []
    return this.selectedShipIds
      .map(id => s.ships.find(sh => sh.id === id))
      .filter((sh): sh is ShipState => !!sh && !sh.destroyed)
  }

  private doOrder(act: string, shift = false): void {
    const s = this.state
    if (!s) return
    // režim hromadného výběru (mobil): tap = toggle výběru, tažení = box
    if (act === 'selectMode') {
      this.plot.multiSelectMode = !this.plot.multiSelectMode
      this.refresh()
      return
    }
    // přepínač auto-zpomalování funguje i bez vlastní lodi
    if (act === 'autoSlow') {
      this.autoSlow = !this.autoSlow
      try { localStorage.setItem(AUTOSLOW_KEY, this.autoSlow ? '1' : '0') } catch { /* noop */ }
      this.refresh()
      return
    }
    // roster FLOTILA: klik = převzetí lodi, Shift-klik = přidat/odebrat z výběru
    if (act.startsWith('ownShip:')) {
      const id = Number(act.slice('ownShip:'.length))
      if (shift) {
        this.selectedShipIds = toggleShipSelection(s, this.selectedShipIds, this.ownShipId, id)
        this.refresh()
      } else {
        this.switchOwnShip(id)
      }
      return
    }
    const own = s.ships.find(sh => sh.id === this.ownShipId)
    if (!own || own.destroyed) return
    const t = this.targetId
    // stupňovitý výkon pohonu (20–120 %) — platí pro celý výběr
    if (act.startsWith('throttle:')) {
      const v = Number(act.slice('throttle:'.length)) / 100
      if (Number.isFinite(v)) {
        for (const sh of this.selectedShips()) {
          this.send({ kind: 'setThrottle', shipId: sh.id, throttle: v })
        }
      }
      this.refresh()
      return
    }
    // priorita polních oprav — platí pro celý hromadný výběr
    if (act.startsWith('repair:')) {
      const f = act.slice('repair:'.length)
      if (f === 'balanced' || f === 'weapons' || f === 'drive' || f === 'defense') {
        for (const sh of this.selectedShips()) {
          this.send({ kind: 'setRepairFocus', shipId: sh.id, focus: f })
        }
      }
      this.refresh()
      return
    }
    // formace: primární loď = leader, ostatní vybrané dostanou sloty 1..n dle id
    if (act.startsWith('formation:')) {
      const kind = act.slice('formation:'.length)
      const sel = this.selectedShips()
      const members = sel.filter(sh => sh.id !== own.id).sort((a, b) => a.id - b.id)
      if (kind === 'none') {
        for (const sh of sel) this.send({ kind: 'clearFormation', shipId: sh.id })
      } else if ((kind === 'wall' || kind === 'vee' || kind === 'dispersed') && members.length > 0) {
        this.send({ kind: 'clearFormation', shipId: own.id }) // leader letí normálně
        members.forEach((sh, i) => this.send({
          kind: 'setFormation', shipId: sh.id, leaderId: own.id, slot: i + 1, formation: kind,
        }))
      }
      this.refresh()
      return
    }
    // velení eskadry: doktríny palby pro celý hromadný výběr
    if (act === 'fleetNearest' || act === 'fleetBiggest' || act === 'fleetSpread') {
      const mode = act === 'fleetNearest' ? 'nearest'
        : act === 'fleetBiggest' ? 'biggest' : 'spread'
      for (const sh of this.selectedShips()) {
        this.send({
          kind: 'setFireControl', shipId: sh.id,
          fc: {
            mode, targetId: null,
            salvoSize: SHIP_CLASSES[sh.classId]?.tubesPerBroadside ?? 4,
            driveMode: 'auto',
            autonomous: this.autonomousMode,
          },
        })
      }
      this.refresh()
      return
    }
    if (act === 'fleetFocus') {
      // soustředěná palba: celý výběr AUTO na hráčem vybraný cíl
      if (t == null) return
      for (const sh of this.selectedShips()) {
        this.send({
          kind: 'setFireControl', shipId: sh.id,
          fc: {
            mode: 'auto', targetId: t,
            salvoSize: SHIP_CLASSES[sh.classId]?.tubesPerBroadside ?? 4,
            driveMode: 'auto',
            autonomous: this.autonomousMode,
          },
        })
      }
      this.refresh()
      return
    }
    // koordinovaná salva výběru: každá nabitá loď TEĎ plnou salvu na cíl
    if (act === 'fleetSalvo') {
      if (t == null) return
      for (const sh of this.selectedShips()) {
        if (sh.tubeCooldown > 0 || sh.missiles <= 0) continue // bez spamu hlášek
        this.send({
          kind: 'launchSalvo', shipId: sh.id, targetId: t,
          count: SHIP_CLASSES[sh.classId]?.tubesPerBroadside ?? 4,
          mode: 'auto', autonomous: this.autonomousMode,
        })
      }
      this.refresh()
      return
    }
    // sesazená alfa-salva: vybrané lodě na SPOLEČNÝ dopad (time-on-target)
    if (act === 'fleetAlpha') {
      if (t == null) return
      const ids = this.selectedShips().map(sh => sh.id)
      if (ids.length > 0) this.send({ kind: 'alphaStrike', shipIds: ids, targetId: t })
      this.refresh()
      return
    }
    // rozprostřený odpal plošin: každá vybraná loď s plošinami na VLASTNÍ cíl,
    // rozdělené mezi nejbližší klasifikované nepřátele (ne 6×N raket na jednu loď).
    // Přiřazení je deterministické (spreadPodTargets); pošleme stávající launchPods.
    if (act === 'fleetPods') {
      const ids = this.selectedShips().filter(sh => sh.pods > 0).map(sh => sh.id)
      if (ids.length === 0) return
      const assign = spreadPodTargets(ids, s.contacts.player, own.pos)
      for (const a of assign) this.send({ kind: 'launchPods', shipId: a.shipId, targetId: a.targetId })
      if (assign.length > 0) this.refresh()
      return
    }
    if (act === 'fleetHold') {
      for (const sh of this.selectedShips()) {
        this.send({ kind: 'holdFire', shipId: sh.id })
      }
      this.refresh()
      return
    }
    switch (act) {
      case 'intercept':
        if (t != null) {
          for (const sh of this.selectedShips()) {
            this.send({ kind: 'intercept', shipId: sh.id, targetId: t })
          }
        }
        break
      case 'course':
        this.courseMode = !this.courseMode
        this.plot.setCourseCursor(this.courseMode)
        this.routeStarted = false // nový režim kurzu = nová trasa
        break
      case 'salvo2': this.salvo(own, 2); break
      case 'salvo4': this.salvo(own, 4); break
      case 'salvoFull': this.salvo(own, SHIP_CLASSES[own.classId]?.tubesPerBroadside ?? 4); break
      case 'salvoLayered': {
        // vrstvená salva: LO hlavní vlna + HI follow-up (saturace obrany)
        if (t == null || own.missiles <= 0) break
        const tubes = SHIP_CLASSES[own.classId]?.tubesPerBroadside ?? 3
        const hi = Math.max(1, Math.round(tubes / 3))
        const lo = Math.max(1, tubes - hi)
        this.send({ kind: 'launchLayered', shipId: own.id, targetId: t, countLo: lo, countHi: hi })
        break
      }
      case 'salvoDouble':
        // dvojitá boční salva: LO z levoboku, otočka, HI z pravoboku
        if (t != null && own.missiles > 0) {
          this.send({ kind: 'launchDouble', shipId: own.id, targetId: t })
        }
        break
      case 'launchPods':
        // alfa úder z tažených plošin: všechny najednou na vybraný cíl
        if (t != null && own.pods > 0) {
          this.send({ kind: 'launchPods', shipId: own.id, targetId: t })
        }
        break
      case 'autoFire': {
        // AUTO palba pro celý výběr (zapnutí dle stavu primární lodi)
        const enable = own.fireControl.mode !== 'auto'
        if (enable && t == null) break
        for (const sh of this.selectedShips()) {
          this.send({
            kind: 'setFireControl', shipId: sh.id,
            fc: enable
              ? {
                  mode: 'auto', targetId: t,
                  salvoSize: SHIP_CLASSES[sh.classId]?.tubesPerBroadside ?? 4,
                  driveMode: 'auto',
                  autonomous: this.autonomousMode,
                }
              : { mode: 'hold' },
          })
        }
        break
      }
      case 'autonomous':
        // režim dalších odpalů: řízené / autonomní salvy (fire-and-forget)
        this.autonomousMode = !this.autonomousMode
        break
      case 'escortJammer':
        // +rušička: salva obětuje 1 raketu, zbytek má proti PDLC cíle Pk ×0.75
        this.escortJammerMode = !this.escortJammerMode
        break
      case 'deployDecoy':
        this.send({ kind: 'deployDecoy', shipId: own.id })
        break
      case 'retargetSalvo':
        if (t != null && this.selectedSalvoId != null) {
          this.send({
            kind: 'retargetSalvo', shipId: own.id,
            salvoId: this.selectedSalvoId, newTargetId: t,
          })
        }
        break
      case 'help':
        this.toggleHelp()
        break
      case 'energy':
        if (t != null) this.send({ kind: 'fireEnergy', shipId: own.id, targetId: t })
        break
      case 'demandSurrender':
        // výzva ke kapitulaci — odpověď dorazí po 2·vzdálenost/c (sim čas)
        if (t != null) this.send({ kind: 'demandSurrender', shipId: own.id, targetId: t })
        break
      case 'wedge': {
        const on = !own.wedgeOn // sjednoceno dle primární lodi
        for (const sh of this.selectedShips()) {
          this.send({ kind: 'setWedge', shipId: sh.id, on })
        }
        break
      }
      case 'sensors': {
        const on = !own.activeSensors // sjednoceno dle primární lodi
        for (const sh of this.selectedShips()) {
          this.send({ kind: 'setActiveSensors', shipId: sh.id, on })
        }
        break
      }
    }
    this.refresh()
  }

  private salvo(own: ShipState, count: number): void {
    if (this.targetId == null || own.missiles <= 0) return
    this.send({
      kind: 'launchSalvo', shipId: own.id, targetId: this.targetId,
      count, mode: 'auto', autonomous: this.autonomousMode,
      escortJammer: this.escortJammerMode,
    })
  }

  /** přepnutí aktivní lodi (roster / klávesy 1–9) — jen ovladatelné lodě */
  private switchOwnShip(id: number): void {
    const s = this.state
    if (!s) return
    const ship = s.ships.find(sh => sh.id === id)
    if (!ship || ship.side !== 'player' || ship.doctrine !== 'player' || ship.destroyed) return
    this.ownShipId = id
    this.selectedShipIds = [id] // obyčejné přepnutí = jediný výběr
    this.plot.recenter()
    this.refresh()
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

  private onPlotClick(id: number | null, world: Vec2, shift: boolean): void {
    // režim „klik = kurz" — kurz dostanou VŠECHNY vybrané lodě.
    // Shift-klik PŘIDÁVÁ waypoint trasy (režim zůstává aktivní pro další
    // body); klik bez Shiftu zadá poslední bod a režim ukončí.
    if (this.courseMode && this.ownShipId != null) {
      // první bod trasy NAHRAZUJE starý kurz, další body se přidávají
      const append = this.routeStarted
      if (!shift) {
        this.courseMode = false
        this.plot.setCourseCursor(false)
        this.routeStarted = false
      } else {
        this.routeStarted = true
      }
      for (const sh of this.selectedShips()) {
        this.send({ kind: 'setCourse', shipId: sh.id, dest: world, arriveAtRest: false, append })
      }
      this.refresh()
      return
    }
    if (id == null) {
      if (!shift) {
        this.targetId = null
        this.selectedSalvoId = null
        this.refresh()
      }
      return
    }
    // klik na vlastní raketu → výběr celé salvy (panel SALVA + zvýraznění)
    const missile = this.state?.missiles.find(m => m.id === id)
    if (missile) {
      if (missile.side === 'player') this.selectedSalvoId = missile.salvoId
      this.refresh()
      return
    }
    const ship = this.state?.ships.find(sh => sh.id === id)
    if (ship && ship.side === 'player' && ship.doctrine === 'player') {
      if (shift && this.state) {
        // Shift-klik: přidat/odebrat ovladatelnou loď z hromadného výběru
        this.selectedShipIds =
          toggleShipSelection(this.state, this.selectedShipIds, this.ownShipId, id)
      } else {
        // převzít lze jen OVLADATELNOU vlastní loď (AI spojenci ne)
        this.ownShipId = id
        this.selectedShipIds = [id]
        this.plot.recenter()
      }
    } else if (ship && ship.side === 'player') {
      // AI spojenec: převzít nejde, výběr cíle se nemění
    } else {
      this.targetId = id
    }
    this.refresh()
  }

  /** Shift-tažení na plotu: obdélníkový výběr vlastních ovladatelných lodí */
  private onBoxSelect(a: Vec2, b: Vec2): void {
    const s = this.state
    if (!s) return
    const ids = boxSelectShips(s, a, b)
    if (ids.length === 0) return // prázdný rám — výběr se nemění
    const primary = this.ownShipId != null && ids.includes(this.ownShipId)
      ? this.ownShipId
      : ids[0]
    this.ownShipId = primary
    this.selectedShipIds = normalizeSelection(s, ids, primary)
    this.refresh()
  }

  // ---------- klávesy ----------

  private onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
    switch (e.key) {
      case ' ':
        e.preventDefault()
        this.setCompression(this.compression > 0 ? 0 : this.lastRunning, true)
        break
      case '+': case '=':
        this.stepCompression(1)
        break
      case '-': case '_':
        this.stepCompression(-1)
        break
      case 'a': case 'A':
        this.doOrder('autoFire')
        break
      case 'h': case 'H':
        this.toggleHelp()
        break
      case '1': case '2': case '3': case '4': case '5':
      case '6': case '7': case '8': case '9': {
        // roster FLOTILA: přepnutí na n-tou ovladatelnou loď
        if (!this.state) break
        const id = rosterPick(this.state, Number(e.key))
        if (id != null) this.switchOwnShip(id)
        break
      }
      case 'Escape':
        this.helpEl?.remove()
        this.helpEl = null
        break
    }
  }

  // ---------- nápověda ----------

  private helpEl: HTMLElement | null = null

  /** overlay NÁPOVĚDA — přehled příkazů, kláves a mechanik */
  private toggleHelp(): void {
    if (this.helpEl) {
      this.helpEl.remove()
      this.helpEl = null
      return
    }
    const el = document.createElement('div')
    el.className = 'overlay'
    el.innerHTML = helpBoxHtml()
    el.querySelector('#btn-help-close')?.addEventListener('click', () => {
      el.remove()
      this.helpEl = null
    })
    document.body.appendChild(el)
    this.helpEl = el
  }

  // ---------- pomocné ----------

  private send(order: Order): void {
    this.bridge.sendOrder(order)
  }

  private ui(): UiState {
    return {
      ownShipId: this.ownShipId,
      selectedShipIds: [...this.selectedShipIds],
      targetId: this.targetId,
      courseMode: this.courseMode,
      compression: this.compression,
      slowdownText: this.slowdownText,
      selectedSalvoId: this.selectedSalvoId,
      autonomousMode: this.autonomousMode,
      escortJammerMode: this.escortJammerMode,
      autoSlowEnabled: this.autoSlow,
      selectMode: this.plot.multiSelectMode,
      report: this.stats.report,
    }
  }

  /** okamžitý přerender panelů + synchronizace plotu */
  private refresh(): void {
    this.plot.followId = this.ownShipId
    this.plot.selectedId = this.targetId ?? this.ownShipId
    this.plot.selectedShipIds = this.selectedShipIds
    this.plot.selectedSalvoId = this.selectedSalvoId
    if (this.state) this.panels.update(this.state, this.ui(), true)
  }
}
