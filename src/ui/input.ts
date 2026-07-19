/**
 * UIController — propojení plot ↔ panely ↔ bridge.
 * Drží stav výběru (vlastní loď / cíl), režim „klik = kurz",
 * mapuje akce na Order objekty a obsluhuje klávesy.
 */
import { SHIP_CLASSES } from '../data/defs'
import type { DriveMode, Order, ShipState, SimEvent, SimState, Vec2 } from '../sim/types'
import type { SimBridge } from '../worker/bridge'
import type { TacticalPlot } from './plot'
import { contactEstPos, type PanelAction, type Panels, type UiState } from './panels'
import {
  boxSelectShips, normalizeSelection, resolveOwnShipId, rosterPick, toggleShipSelection,
} from './roster'

const COMP_LADDER = [0, 1, 10, 100, 1000, 10000]

/** localStorage klíč přepínače auto-zpomalování (⚠ v topbaru) */
const AUTOSLOW_KEY = 'wob-autoslow'
/** grace po ruční změně komprese — žádné auto-zpomalení (ms reálného času) */
const AUTOSLOW_GRACE_MS = 5000

export class UIController {
  private state: SimState | null = null
  private ownShipId: number | null = null
  /** hromadný výběr vlastních ovladatelných lodí (vždy obsahuje ownShipId) */
  private selectedShipIds: number[] = []
  private targetId: number | null = null
  private courseMode = false
  /** rozpracovaná vícebodová trasa (Shift-kliky v režimu kurzu) */
  private routeStarted = false
  private salvoMode: DriveMode = 0 // výchozí LO — plný dostřel (HI jen zblízka)
  private compression = 0
  /** poslední nenulová komprese (pro obnovení po pauze) */
  private lastRunning = 1
  private slowdownText: string | null = null
  private slowdownUntil = 0
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

  constructor(
    private bridge: SimBridge,
    private plot: TacticalPlot,
    private panels: Panels,
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
    for (const ev of state.events) {
      if (!this.eventSlows(ev)) continue
      this.slowdownText = ev.text
      this.slowdownUntil = performance.now() + 8000
      if (this.autoSlow && this.compression > 1
        && performance.now() - this.manualCompAt > AUTOSLOW_GRACE_MS) {
        this.setCompression(1)
      }
    }
    if (this.slowdownText && performance.now() > this.slowdownUntil) this.slowdownText = null

    // vybraná salva už neexistuje (dorazila/sestřelena) → zrušit výběr
    if (this.selectedSalvoId != null && !state.missiles.some(m =>
      m.side === 'player' && m.salvoId === this.selectedSalvoId && m.phase !== 'dead')) {
      this.selectedSalvoId = null
    }

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
                  driveMode: this.salvoMode,
                  autonomous: this.autonomousMode,
                }
              : { mode: 'hold' },
          })
        }
        break
      }
      case 'mode':
        this.salvoMode = this.salvoMode === 1 ? 0 : 1
        break
      case 'modeLo':
        this.salvoMode = 0
        break
      case 'modeHi':
        this.salvoMode = 1
        break
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
      case 'rollThreat': {
        // směr hrozby per loď (každá se odvalí ke SVÉ nejbližší hrozbě/cíli)
        for (const sh of this.selectedShips()) {
          const dir = this.threatDir(sh)
          if (dir != null) this.send({ kind: 'roll', shipId: sh.id, towards: dir })
        }
        break
      }
      case 'rollBack':
        for (const sh of this.selectedShips()) {
          this.send({ kind: 'roll', shipId: sh.id, towards: null })
        }
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
      count, mode: this.salvoMode, autonomous: this.autonomousMode,
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
      case 'r': case 'R': {
        const own = this.state?.ships.find(sh => sh.id === this.ownShipId)
        if (!own) break
        this.doOrder(own.rolledTo != null ? 'rollBack' : 'rollThreat')
        break
      }
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
    el.innerHTML = `<div class="box help-box"><h2>NÁPOVĚDA</h2>
      <h4>Klávesy</h4>
      <div class="help-grid">
        <b>mezerník</b><span>pauza / pokračovat</span>
        <b>+ / −</b><span>komprese času (1× až 10 000×)</span>
        <b>R</b><span>rolování lodi (klín k hrozbě / zpět)</span>
        <b>A</b><span>AUTO palba na vybraný cíl</span>
        <b>1–9</b><span>přepnutí aktivní lodi flotily (panel FLOTILA)</span>
        <b>H nebo ?</b><span>tato nápověda</span>
        <b>kolečko</b><span>zoom plotu, tažení = posun kamery</span>
        <b>klik</b><span>výběr lodi/kontaktu; vlastní loď = převzetí</span>
        <b>Shift-klik</b><span>přidá/odebere vlastní ovladatelnou loď z hromadného výběru (plot i panel FLOTILA)</span>
        <b>Shift-tažení</b><span>obdélníkový výběr vlastních lodí na plotu (čárkovaný rám); bez Shiftu posun kamery</span>
      </div>
      <h4>Rozkazy</h4>
      <div class="help-grid">
        <b>Intercept</b><span>autopilot spočítá stíhací kurz na cíl</span>
        <b>Kurz sem</b><span>klikni do plotu — loď poletí na bod; u vybrané lodi plot kreslí PREDIKOVANOU KŘIVKU manévru (otáčení + setrvačnost, značka = 1 minuta letu) — čím rychleji letíš, tím širší oblouk</span>
        <b>Trasa (Shift)</b><span>v režimu kurzu SHIFT-klik přidává další waypointy (kosočtverce spojené čarou); obyčejný klik zadá poslední bod a režim ukončí — predikovaná křivka ukáže skutečný průlet body včetně setrvačnosti</span>
        <b>Salva 2/4/plná</b><span>odpal raket na vybraný cíl</span>
        <b>Pohon LO/HI</b><span>LO = 46k g / 180 s (dostřel ~7 M km), HI = 92k g / 60 s (rychlost, ~1,6 M km)</span>
        <b>Salva X+Y</b><span>vrstvená salva: LO vlna + zpožděná HI vlna dorazí spolu a saturují bodovou obranu</span>
        <b>Obě salvy</b><span>dvojitá boční salva: levobok LO, otočka (8 s, bez palby), pravobok HI na společný dopad — dvojnásobná vlna</span>
        <b>AUTO palba</b><span>loď sama opakuje salvy, dokud je cíl v poháněné obálce — a řídí i ENERGETICKÉ baterie (pálí na cíl či nejbližšího nepřítele v dosahu 500 tis. km)</span>
        <b>Energie</b><span>lasery/grasery — drtivé pod 100 tis. km, max. 500 tis. km</span>
        <b>Roll</b><span>vloží nepropustný klín mezi loď a salvu — ale ODVALENÝ NESTŘÍLÍ (klín maskuje boky) a PDLC je oslabená; protirakety fungují dál</span>
        <b>Návnada</b><span>tažená návnada: příchozí raketa na ni může přeskočit (šance dle kvality ECM lodi, víc při slabém zámku) a návnadu ZNIČÍ — jedna návnada ≈ jedna raketa, další lze vypustit hned; omezená zásoba</span>
        <b>+rušička</b><span>salva obětuje 1 raketu jako eskortní rušičku — zbytek má proti bodové obraně cíle Pk ×0,75 (min. 3 rakety)</span>
        <b>Klín VYP</b><span>EMCON: skoro neviditelná, ale bez akcelerace a bočních štítů</span>
        <b>Akt. senzory</b><span>plná identifikace zblízka + lepší zámek našich raket; pozor — vyzařování zlepšuje řešení nepříteli o 15 %</span>
      </div>
      <h4>Výkon pohonu a rozpočet reaktoru</h4>
      <div class="help-grid">
        <b>tah 20–120 %</b><span>stupňovitý přepínač v liště rozkazů; 80 % je standard s bezpečnostní rezervou kompenzátoru</span>
        <b>100 %</b><span>plný projektovaný výkon — bez rizika, ale bez rezervy</span>
        <b>120 % (červeně)</b><span>NOUZOVÝ výkon „za červenou čarou": +20 % akcelerace, ale se zapnutým klínem hrozí poškození impelerového prstence (v průměru ~1× za 33 minut) — inženýr varuje</span>
        <b>Tah vs. boční štíty</b><span>reaktor neutáhne pohon i štítové generátory: tah ≤ 40 % ⇒ boční štíty 120 %, 60 % ⇒ 100 %, 80 % ⇒ 60 %, 100 % ⇒ 40 %, 120 % ⇒ 25 % — rychlý přílet znamená papírové boky (readout „výkon bočních štítů" v panelu lodi)</span>
        <b>Hromadně</b><span>přepínač platí pro celý hromadný výběr — „(×N)" u tlačítka</span>
      </div>
      <h4>Poškození a opravy</h4>
      <div class="help-grid">
        <b>Boční štíty tlumí, neblokují</b><span>boční zásah VŽDY něco prosákne (silný boční štít slabý paprsek čtvrtí); absorbovaná energie navíc generátory bočního štítu opotřebovává — soustavná palba štít postupně mele</span>
        <b>Umírání po částech</b><span>loď vydrží řádově 10–15 zásahů; každý prošlý paprsek má slušnou šanci vyřadit kus vybavení (šachty, impelery, senzory…) — bojeschopnost klesá dřív, než dojde trup</span>
        <b>Poškozené impelery</b><span>akcelerace klesá s průměrem obou prstenců — loď se zásahem do pohonu reálně zpomaluje v manévru</span>
        <b>Polní opravy</b><span>poškozené subsystémy se BĚHEM boje samy opravují (~7 % za minutu, provizorně do 70 %); buff inženýra opravy ×4 — o vyřazený boční štít či šachty se dá přetahovat</span>
      </div>
      <h4>Eskadra a formace</h4>
      <div class="help-grid">
        <b>Hromadný výběr</b><span>Shift-klik / Shift-tažení; rozkazy s „(×N)" (kurz, intercept, tah, klín, senzory, AUTO, roll) platí všem vybraným</span>
        <b>Palba výběru</b><span>salvy pálí jen aktivní loď — hromadná palba jde přes AUTO palbu na vybraný cíl</span>
        <b>FORMACE</b><span>při výběru ≥ 2 lodí: aktivní loď = leader, ostatní dostanou sloty a drží je samy (vlastní kurz ignorují); rozpad při ztrátě leadera</span>
        <b>Stěna Σ</b><span>kolmá řada (400 tis. km): disciplinovaná palebná síť — protirakety Pk ×1,15, příchozí rakety −5 % zámku</span>
        <b>Šíp V</b><span>šíp za leaderem (60°): sdílený senzorový obraz — +5 % palebného řešení členů</span>
        <b>Rozptyl ◦</b><span>mřížka 1,5 M km: útočník nesaturuje eskadru jako celek, členové +3 % efektivního ECM</span>
        <b>Plot</b><span>členové mají tenkou čáru k leaderovi; v panelu FLOTILA značky Σ / V / ◦</span>
      </div>
      <h4>Senzorový duel (EMCON)</h4>
      <div class="help-grid">
        <b>Palebné řešení</b><span>počáteční zámek raket: 70 % jen z pasivních dat, 100 % s aktivními senzory a cílem v jejich dosahu</span>
        <b>Vyzařující cíl</b><span>cíl se zapnutými aktivními senzory dává +15 % k řešení PROTI sobě — ticho má cenu</span>
        <b>Kvalitní track</b><span>plná identifikace cíle (ident.) přidává +10 %; poškozené senzory řešení srážejí</span>
        <b>Aktivní vedení</b><span>střelec s aktivy a cílem v dosahu drží track — ECM cíle eroduje zámek raket pomaleji</span>
        <b>AI to hraje taky</b><span>nepřítel „rozsvítí" aktivy, když zahajuje palbu, a zhasne při ústupu — čti to na plotu ([AKT])</span>
      </div>
      <h4>Řízení salv</h4>
      <div class="help-grid">
        <b>Výběr salvy</b><span>klikni na vlastní raketu v plotu — panel SALVA ukáže počet, zámek, fázi a čas do cíle</span>
        <b>Přesměrování</b><span>letící salvu lze poslat na jiný klasifikovaný cíl (zámek ×0,75) — jen do 10 M km od lodi</span>
        <b>Řízená salva</b><span>loď ji vede: při ztrátě kontaktu na cíl nebo za dosahem řízení zámek eroduje</span>
        <b>Dno zámku</b><span>posádky se ECM propálí: řízená salva s aktivními senzory neklesne pod 40 % zámku, raketa s vlastním seekerem pod 30 %; jen balistický dojezd bez vedení eroduje dál</span>
        <b>Odhad průniku</b><span>detail cíle ukazuje očekávaný průnik plné salvy (CM · PDLC · ECM) — odhad, ne slib</span>
        <b>Autonomní salva</b><span>zámek ×0,85 při odpalu, ale letí sama — „vystřel a zhasni" s vypnutým klínem</span>
        <b>⚠ v topbaru</b><span>auto-zpomalování času u důležitých událostí — přepínač ZAP/VYP (odpaly už nezpomalují)</span>
      </div>
      <h4>Mechaniky</h4>
      <div class="help-grid">
        <b>Poháněná obálka</b><span>dostřel raket = pohon + vektor lodi při odpalu; odpal „po směru" dostřel natahuje</span>
        <b>Vrstvená obrana</b><span>ECM → protirakety → PDLC → klín; z velké salvy projde jen zlomek — ale projde: úspěšná salva poškozuje, opotřebovávací boj</span>
        <b>Reakční čas obrany</b><span>protirakety stihnou max. 2 pokusy na raketu — a jen když mají čas: rychlá HI salva zblízka (pod ~1 M km) nechá obraně čas na JEDEN pokus, pod ~300 tis. km na žádný. Zblízka se zabíjí</span>
        <b>Asymetrie stran</b><span>Avalon sází na technologickou převahu (lepší raketová elektronika — zámek salv ×1,08), Impérium na tonáž a kvantitu (víc trupů a šachet, horší senzory); pirátská elektronika je o generaci pozadu (×0,9)</span>
        <b>Saturace</b><span>víc raket ve stejném okně = PDLC nestíhá (vrstvená salva!)</span>
        <b>Poškození</b><span>subsystémy po částech; posádka provizorně opravuje do 70 %</span>
        <b>Trysky</b><span>s vypnutým klínem má loď ~5 g na korekce driftu — neviditelné, ale plánuj hodiny dopředu</span>
        <b>Light-lag</b><span>kontakty jsou staré vzdálenost/c sekund — u 30 M km ~100 s</span>
        <b>Hyperlimit</b><span>jantarová čára — za ní lodě unikají do hyperprostoru</span>
      </div>
      <h4>Kapitulace</h4>
      <div class="help-grid">
        <b>Výzva</b><span>v detailu cíle „Vyzvat ke kapitulaci" — jen na klasifikovaný nepřátelský kontakt</span>
        <b>Šance</b><span>≈ (poškození − 20 %) × morálka posádky; +15 % při vyřazených šachtách či prázdných zásobnících</span>
        <b>Odpověď</b><span>letí rychlostí světla tam i zpět (2×vzdálenost/c); další výzva na týž cíl až po 180 s</span>
        <b>Po kapitulaci</b><span>loď vypne klín a přestane bojovat — na plotu šedá se symbolem ▽; nestřílej na ni</span>
      </div>
      <h4>Bojová statistika</h4>
      <div class="help-grid">
        <b>Panel nad logem</b><span>NAŠE PALBA: odpáleno / sestřeleno / zásahy / úspěšnost; PŘÍCHOZÍ: odpáleno na nás / pobráno obranou / zásahy do nás</span>
        <b>Šachty</b><span>panel vlastní lodi ukazuje „šachty N/M funkční" — poškozené šachty zmenšují salvu</span>
        <b>Nabíjení</b><span>bary „šachty nabití" a „energetika nabití" v panelu vlastní lodi — plný bar = zbraň připravena</span>
      </div>
      <div style="margin-top:12px"><button id="btn-help-close">ZAVŘÍT (Esc)</button></div>
    </div>`
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
      salvoMode: this.salvoMode,
      compression: this.compression,
      slowdownText: this.slowdownText,
      selectedSalvoId: this.selectedSalvoId,
      autonomousMode: this.autonomousMode,
      escortJammerMode: this.escortJammerMode,
      autoSlowEnabled: this.autoSlow,
      selectMode: this.plot.multiSelectMode,
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
