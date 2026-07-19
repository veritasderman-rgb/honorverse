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

const COMP_LADDER = [0, 1, 10, 100, 1000, 10000]

/** localStorage klíč přepínače auto-zpomalování (⚠ v topbaru) */
const AUTOSLOW_KEY = 'wob-autoslow'
/** grace po ruční změně komprese — žádné auto-zpomalení (ms reálného času) */
const AUTOSLOW_GRACE_MS = 5000

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
  /** vybraná vlastní salva (klik na raketu v plotu) */
  private selectedSalvoId: number | null = null
  /** další odpaly jako autonomní salvy (fire-and-forget) */
  private autonomousMode = false
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
    plot.onPick = (id, world) => this.onPlotClick(id, world)
    window.addEventListener('keydown', e => this.onKey(e))
    try {
      this.autoSlow = localStorage.getItem(AUTOSLOW_KEY) !== '0'
    } catch { /* localStorage nedostupná (testy) — default ZAP */ }
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
        this.doOrder(a.act)
        break
    }
  }

  private doOrder(act: string): void {
    const s = this.state
    if (!s) return
    // přepínač auto-zpomalování funguje i bez vlastní lodi
    if (act === 'autoSlow') {
      this.autoSlow = !this.autoSlow
      try { localStorage.setItem(AUTOSLOW_KEY, this.autoSlow ? '1' : '0') } catch { /* noop */ }
      this.refresh()
      return
    }
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
      case 'salvoLayered': {
        // vrstvená salva: LO hlavní vlna + HI follow-up (saturace obrany)
        if (t == null || own.missiles <= 0) break
        const tubes = SHIP_CLASSES[own.classId]?.tubesPerBroadside ?? 3
        const hi = Math.max(1, Math.round(tubes / 3))
        const lo = Math.max(1, tubes - hi)
        this.send({ kind: 'launchLayered', shipId: own.id, targetId: t, countLo: lo, countHi: hi })
        break
      }
      case 'autoFire': {
        const enable = own.fireControl.mode !== 'auto'
        if (enable && t == null) break
        this.send({
          kind: 'setFireControl', shipId: own.id,
          fc: enable
            ? {
                mode: 'auto', targetId: t,
                salvoSize: SHIP_CLASSES[own.classId]?.tubesPerBroadside ?? 4,
                driveMode: this.salvoMode,
                autonomous: this.autonomousMode,
              }
            : { mode: 'hold' },
        })
        break
      }
      case 'mode':
        this.salvoMode = this.salvoMode === 1 ? 0 : 1
        break
      case 'autonomous':
        // režim dalších odpalů: řízené / autonomní salvy (fire-and-forget)
        this.autonomousMode = !this.autonomousMode
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
    this.send({
      kind: 'launchSalvo', shipId: own.id, targetId: this.targetId,
      count, mode: this.salvoMode, autonomous: this.autonomousMode,
    })
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
      this.selectedSalvoId = null
      this.refresh()
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
        <b>H nebo ?</b><span>tato nápověda</span>
        <b>kolečko</b><span>zoom plotu, tažení = posun kamery</span>
        <b>klik</b><span>výběr lodi/kontaktu; vlastní loď = převzetí</span>
      </div>
      <h4>Rozkazy</h4>
      <div class="help-grid">
        <b>Intercept</b><span>autopilot spočítá stíhací kurz na cíl</span>
        <b>Kurz sem</b><span>klikni do plotu — loď poletí na bod</span>
        <b>Salva 2/4/plná</b><span>odpal raket na vybraný cíl</span>
        <b>Pohon LO/HI</b><span>LO = 46k g / 180 s (dostřel ~7 M km), HI = 92k g / 60 s (rychlost, ~1,6 M km)</span>
        <b>Salva X+Y</b><span>vrstvená salva: LO vlna + zpožděná HI vlna dorazí spolu a saturují bodovou obranu</span>
        <b>AUTO palba</b><span>loď sama opakuje salvy, dokud je cíl v poháněné obálce</span>
        <b>Energie</b><span>lasery/grasery — drtivé pod 100 tis. km, max. 500 tis. km</span>
        <b>Roll</b><span>vloží nepropustný klín mezi loď a salvu; loď ale nemanévruje</span>
        <b>Klín VYP</b><span>EMCON: skoro neviditelná, ale bez akcelerace a bočníků</span>
        <b>Akt. senzory</b><span>plná identifikace zblízka + lepší zámek našich raket; pozor — vyzařování zlepšuje řešení nepříteli o 15 %</span>
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
        <b>Autonomní salva</b><span>zámek ×0,85 při odpalu, ale letí sama — „vystřel a zhasni" s vypnutým klínem</span>
        <b>⚠ v topbaru</b><span>auto-zpomalování času u důležitých událostí — přepínač ZAP/VYP (odpaly už nezpomalují)</span>
      </div>
      <h4>Mechaniky</h4>
      <div class="help-grid">
        <b>Poháněná obálka</b><span>dostřel raket = pohon + vektor lodi při odpalu; odpal „po směru" dostřel natahuje</span>
        <b>Vrstvená obrana</b><span>ECM → protirakety → PDLC → klín; z velké salvy projde jen zlomek</span>
        <b>Saturace</b><span>víc raket ve stejném okně = PDLC nestíhá (vrstvená salva!)</span>
        <b>Poškození</b><span>subsystémy po částech; posádka provizorně opravuje do 70 %</span>
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
      targetId: this.targetId,
      courseMode: this.courseMode,
      salvoMode: this.salvoMode,
      compression: this.compression,
      slowdownText: this.slowdownText,
      selectedSalvoId: this.selectedSalvoId,
      autonomousMode: this.autonomousMode,
      autoSlowEnabled: this.autoSlow,
    }
  }

  /** okamžitý přerender panelů + synchronizace plotu */
  private refresh(): void {
    this.plot.followId = this.ownShipId
    this.plot.selectedId = this.targetId ?? this.ownShipId
    this.plot.selectedSalvoId = this.selectedSalvoId
    if (this.state) this.panels.update(this.state, this.ui(), true)
  }
}
