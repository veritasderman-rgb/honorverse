/**
 * Mobilní HUD (M1): infografický STAVOVÝ PRSTENEC vlastní lodi pro telefon.
 * Implementuje HudView — controller ho krmí stejnými snapshoty jako desktop
 * Panels (přes composite). Aktivní jen když je `body.phone`; jinak se skryje.
 *
 * Prstenec nahrazuje na první pohled textový panel lodi: střed = trup %,
 * vnější oblouk = tah, ikony klín/senzory (EMCON), kolem mřížka pipů 12
 * subsystémů (zelená/jantar/červená). Detail zůstává v šuplíku (Panels).
 */
import type { ShipState, SimEvent, SimState, Subsystems } from '../sim/types'
import type { HudView, UiState } from './panels'
import { SHIP_CLASSES } from '../data/defs'

/** 12 subsystémů v pořadí kolem prstence (od horní osy po směru hodin) */
const SUBS: { key: keyof Subsystems; label: string }[] = [
  { key: 'impellerFwd', label: 'imp příď' },
  { key: 'tubesStbd', label: 'šachty PB' },
  { key: 'energyStbd', label: 'energ. PB' },
  { key: 'sidewallStbd', label: 'štít PB' },
  { key: 'pdlc', label: 'PDLC' },
  { key: 'cm', label: 'protirakety' },
  { key: 'impellerAft', label: 'imp záď' },
  { key: 'ecm', label: 'ECM' },
  { key: 'sensors', label: 'senzory' },
  { key: 'sidewallPort', label: 'štít LB' },
  { key: 'energyPort', label: 'energ. LB' },
  { key: 'tubesPort', label: 'šachty LB' },
]

const CX = 60, CY = 60

/** polární → kartézská (0° = nahoře, po směru hodin) */
function polar(r: number, deg: number): { x: number; y: number } {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
}

/** SVG path oblouku od startDeg do endDeg na poloměru r */
function arc(r: number, startDeg: number, endDeg: number): string {
  const s = polar(r, startDeg), e = polar(r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`
}

/** barva zdraví subsystému/trupu */
function health(v: number): string {
  return v > 0.66 ? '#58e06a' : v > 0.33 ? '#e0c24a' : '#e06c5a'
}

export class MobileHud implements HudView {
  private el: HTMLElement

  constructor(root: HTMLElement) {
    this.el = document.createElement('div')
    this.el.id = 'mobile-hud'
    this.el.style.display = 'none'
    root.appendChild(this.el)
  }

  // prstenec čte stav přímo ze snapshotu; eventy (log/statistika) nepotřebuje
  addEvents(_events: SimEvent[]): void { /* no-op */ }

  update(state: SimState, ui: UiState, _force?: boolean): void {
    const active = document.body.classList.contains('phone') && ui.ownShipId != null
    const ship = active ? state.ships.find(s => s.id === ui.ownShipId) : undefined
    if (!ship || ship.destroyed) { this.el.style.display = 'none'; return }
    this.el.style.display = 'block'
    this.el.innerHTML = this.ring(ship)
  }

  private ring(ship: ShipState): string {
    const def = SHIP_CLASSES[ship.classId]
    const hullFrac = def ? Math.max(0, Math.min(1, ship.hull / def.hullPoints)) : 1
    const throttle = Math.max(0, Math.min(1.2, ship.throttle))

    // tah: vnější oblouk 0..300° (0–120 %)
    const thrEnd = 30 + (throttle / 1.2) * 300
    const thrArc = throttle > 0.001
      ? `<path d="${arc(50, 30, thrEnd)}" class="mh-thr"/>` : ''
    // trup: vnitřní oblouk 0..360° podle zlomku, barva dle zdraví
    const hullEnd = 30 + hullFrac * 300
    const hullArc = `<path d="${arc(42, 30, Math.max(30.1, hullEnd))}" style="stroke:${health(hullFrac)}" class="mh-hull"/>`

    // pipy subsystémů kolem prstence
    const pips = SUBS.map((sub, i) => {
      const v = ship.subsystems[sub.key]
      const p = polar(56, (i / SUBS.length) * 360)
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.2" style="fill:${health(v)}"><title>${sub.label} ${Math.round(v * 100)} %</title></circle>`
    }).join('')

    // ikony klín / EMCON nad středem (glyfy — barvitelné přes fill, ne emoji).
    // Klín: ⬡ zapnutý/vypnutý. EMCON: ◉ aktivní senzory (vyzařuješ = riziko) /
    // ○ pasivní (ticho = bezpečno).
    const wedge = `<text x="46" y="52" class="mh-ic ${ship.wedgeOn ? 'on' : 'off'}"><title>klín ${ship.wedgeOn ? 'ZAP' : 'VYP'}</title>⬡</text>`
    const emcon = `<text x="66" y="52" class="mh-ic ${ship.activeSensors ? 'warn' : 'on'}"><title>senzory ${ship.activeSensors ? 'AKTIVNÍ' : 'pasivní'}</title>${ship.activeSensors ? '◉' : '○'}</text>`

    return `<svg viewBox="0 0 120 120" role="img" aria-label="Stav lodi ${ship.name}">`
      + `<circle cx="${CX}" cy="${CY}" r="50" class="mh-bg"/>`
      + thrArc + hullArc + pips + wedge + emcon
      + `<text x="${CX}" y="70" class="mh-hullpct" style="fill:${health(hullFrac)}">${Math.round(hullFrac * 100)}</text>`
      + `<text x="${CX}" y="84" class="mh-lbl">TRUP %</text>`
      + `</svg>`
      + `<div class="mh-name">${ship.name}</div>`
  }
}
