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
import { fmtKm } from './panels'
import { SHIP_CLASSES } from '../data/defs'
import { mobileContactChips, type MobileContactChip } from './mobileContacts'

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
  /** M2: palcový proužek kontaktů (pravý okraj) */
  private contactsEl: HTMLElement

  constructor(root: HTMLElement) {
    this.el = document.createElement('div')
    this.el.id = 'mobile-hud'
    this.el.style.display = 'none'
    root.appendChild(this.el)

    this.contactsEl = document.createElement('div')
    this.contactsEl.id = 'mobile-contacts'
    this.contactsEl.style.display = 'none'
    root.appendChild(this.contactsEl)
    this.wireLongPress()
  }

  // prstenec čte stav přímo ze snapshotu; eventy (log/statistika) nepotřebuje
  addEvents(_events: SimEvent[]): void { /* no-op */ }

  update(state: SimState, ui: UiState, _force?: boolean): void {
    const active = document.body.classList.contains('phone') && ui.ownShipId != null
    const ship = active ? state.ships.find(s => s.id === ui.ownShipId) : undefined
    if (!ship || ship.destroyed) {
      this.el.style.display = 'none'
      this.contactsEl.style.display = 'none'
      return
    }
    this.el.style.display = 'block'
    this.el.innerHTML = this.ring(ship)

    const chips = mobileContactChips(state, ui)
    if (chips.length === 0) {
      this.contactsEl.style.display = 'none'
    } else {
      this.contactsEl.style.display = 'flex'
      this.contactsEl.innerHTML = chips.map(c => this.chip(c)).join('')
    }
  }

  /** jeden čip kontaktu; `data-sel` zaměří přes stávající delegaci Panels */
  private chip(c: MobileContactChip): string {
    const mark = c.surrendered ? '▽' : '◆'
    const cls = c.surrendered ? 'mc-surr' : `mc-t-${c.threat}`
    const arrow = c.surrendered ? '' : c.threat === 'closing' ? '▲' : c.threat === 'opening' ? '▽' : '·'
    // pips kvality identifikace (0–2 vyplněné z 2)
    const pips = [0, 1].map(i => `<i class="${i < c.quality ? 'on' : ''}"></i>`).join('')
    return `<div class="mc-chip ${cls}${c.selected ? ' sel' : ''}" data-sel="${c.shipId}"`
      + ` role="button" tabindex="0" aria-label="Kontakt ${c.code} #${c.shipId}, ${fmtKm(c.rangeKm)}">`
      + `<div class="mc-top"><span class="mc-mark">${mark}</span>`
      + `<span class="mc-code">${c.code}</span><span class="mc-arr">${arrow}</span></div>`
      + `<div class="mc-rng">${fmtKm(c.rangeKm)}</div>`
      + `<div class="mc-pips">${pips}</div>`
      + `</div>`
  }

  /**
   * Podržení čipu (≥ 420 ms bez pohybu) otevře pravý šuplík s detailem cíle.
   * Klepnutí necháváme na delegaci Panels (`data-sel` → zaměření). Časovač
   * rušíme na pohybu/uvolnění, aby scroll proužku detail neotvíral.
   */
  private wireLongPress(): void {
    let timer: ReturnType<typeof setTimeout> | null = null
    let sx = 0, sy = 0
    const clear = (): void => { if (timer) { clearTimeout(timer); timer = null } }
    this.contactsEl.addEventListener('pointerdown', e => {
      const chip = (e.target as Element | null)?.closest('.mc-chip')
      if (!chip) return
      sx = e.clientX; sy = e.clientY
      clear()
      timer = setTimeout(() => {
        // otevři pravý šuplík (kde je detail cíle), zavři levý
        document.getElementById('hud-tr')?.classList.add('open')
        document.getElementById('tab-tr')?.classList.add('active')
        document.getElementById('hud-tl')?.classList.remove('open')
        document.getElementById('tab-tl')?.classList.remove('active')
      }, 420)
    })
    this.contactsEl.addEventListener('pointermove', e => {
      if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clear()
    })
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
      this.contactsEl.addEventListener(ev, clear)
    }
    // klávesnice / asistivní technologie: čipy jsou role="button" + tabindex="0",
    // ale delegace Panels poslouchá jen pointerdown. Enter/mezerník proto
    // převedeme na bublající pointerdown na čipu → stejná cesta zaměření.
    this.contactsEl.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      const chip = (e.target as Element | null)?.closest('.mc-chip')
      if (!chip) return
      e.preventDefault()
      chip.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    })
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
