/**
 * Panely v #sidebar a horní lišta v #topbar — prosté DOM (innerHTML),
 * přerender ze snapshotu (sidebar throttlovaný na ~7 Hz).
 * Akce tlačítek se chytají na pointerdown delegací (přežije přerender).
 */
import { SHIP_CLASSES } from '../data/defs'
import type { Contact, DriveMode, ShipState, SimEvent, SimState, Subsystems } from '../sim/types'

/** stav UI vrstvy předávaný z controlleru (src/ui/input.ts) */
export interface UiState {
  ownShipId: number | null
  targetId: number | null
  courseMode: boolean
  salvoMode: DriveMode
  compression: number
  slowdownText: string | null
}

export type PanelAction =
  | { kind: 'compression'; factor: number }
  | { kind: 'select'; id: number }
  | { kind: 'order'; act: string }

const COMP_BTNS: { f: number; label: string }[] = [
  { f: 0, label: '⏸' },
  { f: 1, label: '1×' },
  { f: 10, label: '10×' },
  { f: 100, label: '100×' },
  { f: 1000, label: '1000×' },
  { f: 10000, label: '10000×' },
]

const SUBSYS: { key: keyof Subsystems; label: string }[] = [
  { key: 'impellerFwd', label: 'impelery příď' },
  { key: 'impellerAft', label: 'impelery záď' },
  { key: 'sidewallPort', label: 'bočník LB' },
  { key: 'sidewallStbd', label: 'bočník PB' },
  { key: 'tubesPort', label: 'šachty LB' },
  { key: 'tubesStbd', label: 'šachty PB' },
  { key: 'energyPort', label: 'energet. LB' },
  { key: 'energyStbd', label: 'energet. PB' },
  { key: 'pdlc', label: 'PDLC' },
  { key: 'cm', label: 'protirakety' },
  { key: 'sensors', label: 'senzory' },
  { key: 'ecm', label: 'ECM' },
]

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

// ---------- panely ----------

export class Panels {
  private log: { t: number; text: string; warn: boolean }[] = []
  private lastSidebarAt = 0

  constructor(
    private sidebar: HTMLElement,
    private topbar: HTMLElement,
    private onAction: (a: PanelAction) => void,
  ) {
    // delegace na pointerdown: elementy se při přerenderu mění, kontejner ne
    const handler = (e: Event): void => {
      const t = e.target as Element | null
      const el = t?.closest?.('[data-comp],[data-sel],[data-act]')
      if (!el) return
      const comp = el.getAttribute('data-comp')
      if (comp != null) { this.onAction({ kind: 'compression', factor: Number(comp) }); return }
      const sel = el.getAttribute('data-sel')
      if (sel != null) { this.onAction({ kind: 'select', id: Number(sel) }); return }
      const act = el.getAttribute('data-act')
      if (act != null) this.onAction({ kind: 'order', act })
    }
    sidebar.addEventListener('pointerdown', handler)
    topbar.addEventListener('pointerdown', handler)
  }

  /** připojí nové události ze snapshotu do logu (worker je po odeslání maže) */
  addEvents(events: SimEvent[]): void {
    for (const ev of events) {
      this.log.unshift({ t: ev.t, text: ev.text, warn: !!ev.slowdown || ev.kind === 'shipDestroyed' })
    }
    if (this.log.length > 40) this.log.length = 40
  }

  update(state: SimState, ui: UiState, force = false): void {
    this.renderTopbar(state, ui)
    const now = performance.now()
    if (!force && now - this.lastSidebarAt < 150) return
    this.lastSidebarAt = now
    this.renderSidebar(state, ui)
  }

  private renderTopbar(state: SimState, ui: UiState): void {
    const btns = COMP_BTNS
      .map(b => `<button data-comp="${b.f}" class="${b.f === ui.compression ? 'active' : ''}">${b.label}</button>`)
      .join('')
    this.topbar.innerHTML =
      `<span class="tb-time">ČAS ${fmtTime(state.t)}</span>`
      + `<span class="tb-comp">${btns}</span>`
      + (ui.slowdownText ? `<span class="tb-slow">⚠ ZPOMALENO: ${esc(ui.slowdownText)}</span>` : '')
  }

  private renderSidebar(state: SimState, ui: UiState): void {
    const own = state.ships.find(s => s.id === ui.ownShipId) ?? null
    this.sidebar.innerHTML =
      this.panelOwnShip(own)
      + this.panelContacts(state, own, ui)
      + this.panelOrders(own, ui)
      + this.panelObjectives(state)
      + this.panelLog()
  }

  private panelOwnShip(own: ShipState | null): string {
    if (!own) return `<div class="panel"><h3>Vlastní loď</h3><div class="dim">žádná loď</div></div>`
    const def = SHIP_CLASSES[own.classId]
    const speed = Math.hypot(own.vel.x, own.vel.y)
    const impAvg = (own.subsystems.impellerFwd + own.subsystems.impellerAft) / 2
    const accG = own.wedgeOn ? own.throttle * (def?.maxAccelG ?? 0) * impAvg : 0
    const hullPct = def ? Math.max(0, own.hull / def.hullPoints) : 1
    const rows = SUBSYS.map(s => {
      const v = own.subsystems[s.key]
      const cls = pctClass(v)
      return `<div class="subsys ${cls}"><span class="nm">${s.label}</span>`
        + `<span class="bar"><i style="width:${Math.round(v * 100)}%"></i></span>`
        + `<span class="pc ${cls}">${Math.round(v * 100)}%</span></div>`
    }).join('')
    const status = own.destroyed
      ? `<div class="bad">LOĎ ZNIČENA</div>`
      : `<div class="row"><span>klín: <b class="${own.wedgeOn ? 'ok' : 'amber'}">${own.wedgeOn ? 'ZAP' : 'VYP'}</b></span>`
        + `<span>senzory: <b class="${own.activeSensors ? 'amber' : 'ok'}">${own.activeSensors ? 'AKTIVNÍ' : 'PASIVNÍ'}</b></span></div>`
        + `<div class="row"><span>poloha: <b class="${own.rolledTo != null ? 'amber' : 'ok'}">${own.rolledTo != null ? 'ODVALENÁ' : 'normální'}</b></span>`
        + `<span>tah: ${Math.round(own.throttle * 100)} %</span></div>`
    return `<div class="panel"><h3>Vlastní loď</h3>`
      + `<div class="row"><b>${esc(own.name)}</b><span class="dim">${esc(def?.name ?? own.classId)} (${def?.hullCode ?? '?'})</span></div>`
      + `<div class="row"><span>rychlost: ${Math.round(speed).toLocaleString('cs-CZ')} km/s</span><span>akcel.: ${Math.round(accG)} g</span></div>`
      + `<div class="row"><span>trup: <b class="${pctClass(hullPct)}">${Math.round(hullPct * 100)} %</b></span>`
      + `<span>rakety ${own.missiles} · CM ${own.cms}</span></div>`
      + status
      + `<div style="margin-top:5px">${rows}</div>`
      + `</div>`
  }

  private panelContacts(state: SimState, own: ShipState | null, ui: UiState): string {
    const list = [...state.contacts.player]
    const oPos = own ? own.pos : { x: 0, y: 0 }
    const withRange = list.map(c => {
      const est = contactEstPos(c)
      return { c, range: Math.hypot(est.x - oPos.x, est.y - oPos.y) }
    }).sort((a, b) => a.range - b.range)
    const rows = withRange.map(({ c, range }) => {
      const cls = c.idQuality === 0 ? '???' : (SHIP_CLASSES[c.classGuess]?.hullCode ?? c.classGuess)
      const q = ['jen klín', 'třída?', 'ident.'][c.idQuality]
      const speed = Math.hypot(c.vel.x, c.vel.y)
      const sel = c.shipId === ui.targetId ? ' sel' : ''
      return `<div class="contact-row${sel}" data-sel="${c.shipId}">`
        + `<div class="row"><span class="${c.idQuality === 0 ? 'amber' : 'bad'}">◆ ${esc(cls)} #${c.shipId}</span><span>${fmtKm(range)}</span></div>`
        + `<div class="row dim"><span>${Math.round(speed).toLocaleString('cs-CZ')} km/s · ${q}</span><span>stáří ${Math.round(c.age)} s</span></div>`
        + `</div>`
    }).join('')
    return `<div class="panel"><h3>Kontakty</h3>${rows || '<div class="dim">žádné kontakty</div>'}</div>`
  }

  private panelOrders(own: ShipState | null, ui: UiState): string {
    const hasTarget = ui.targetId != null
    const dis = (cond: boolean): string => (cond ? '' : ' disabled')
    const noShip = !own || own.destroyed
    const canFire = !noShip && hasTarget
    const rolled = own?.rolledTo != null
    return `<div class="panel"><h3>Rozkazy</h3>`
      + `<div class="btnrow">`
      + `<button data-act="intercept"${dis(canFire)}>Intercept</button>`
      + `<button data-act="course" class="${ui.courseMode ? 'active' : ''}"${dis(!noShip)}>${ui.courseMode ? 'Kurz: klikni do plotu…' : 'Kurz sem'}</button>`
      + `</div>`
      + `<div class="btnrow">`
      + `<button data-act="salvo2"${dis(canFire && (own?.missiles ?? 0) > 0)}>Salva 2</button>`
      + `<button data-act="salvo4"${dis(canFire && (own?.missiles ?? 0) > 0)}>Salva 4</button>`
      + `<button data-act="salvoFull"${dis(canFire && (own?.missiles ?? 0) > 0)}>Plná salva</button>`
      + `<button data-act="mode" title="režim pohonu raket">Pohon: ${ui.salvoMode === 1 ? 'HI' : 'LO'}</button>`
      + `</div>`
      + `<div class="btnrow">`
      + `<button data-act="energy"${dis(canFire)}>Energie</button>`
      + (rolled
        ? `<button data-act="rollBack" class="active">Roll zpět</button>`
        : `<button data-act="rollThreat"${dis(!noShip)}>Roll k hrozbě</button>`)
      + `</div>`
      + `<div class="btnrow">`
      + `<button data-act="wedge" class="${own?.wedgeOn ? 'active' : ''}"${dis(!noShip)}>Klín: ${own?.wedgeOn ? 'ZAP' : 'VYP'}</button>`
      + `<button data-act="sensors" class="${own?.activeSensors ? 'active' : ''}"${dis(!noShip)}>Akt. senzory: ${own?.activeSensors ? 'ZAP' : 'VYP'}</button>`
      + `</div>`
      + `<div class="dim">mezerník pauza · +/− komprese · R roll</div>`
      + `</div>`
  }

  private panelObjectives(state: SimState): string {
    const rows = state.objectives.map(o => {
      const mark = o.state === 'done' ? '■' : o.state === 'failed' ? '✗' : '□'
      return `<div class="obj ${o.state}">${mark} ${esc(o.text)}</div>`
    }).join('')
    return `<div class="panel"><h3>Cíle mise</h3>${rows || '<div class="dim">—</div>'}</div>`
  }

  private panelLog(): string {
    const rows = this.log.slice(0, 12).map(l =>
      `<div class="${l.warn ? 'ev-warn' : ''}">[${fmtTime(l.t)}] ${esc(l.text)}</div>`,
    ).join('')
    return `<div class="panel"><h3>Log událostí</h3><div id="log">${rows || '<div class="dim">zatím žádné události</div>'}</div></div>`
  }
}
