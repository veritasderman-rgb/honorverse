/**
 * Mobilní M2: PALCOVÝ PROUŽEK KONTAKTŮ. Na telefonu je seznam kontaktů schovaný
 * v pravém šuplíku (◨) — zaměřit cíl tak vyžaduje dva kroky. Tento proužek drží
 * nejbližší kontakty trvale na dosah palce (pravý okraj, nad lištou rozkazů);
 * klepnutí zaměří (přes stávající `data-sel` delegaci Panels), podržení otevře
 * šuplík s detailem.
 *
 * Tento modul nese jen ČISTOU logiku (výběr + formát čipů) bez DOM, aby šla
 * testovat v node prostředí (vitest bez jsdom). Vlastní vykreslení dělá MobileHud.
 */
import type { ShipState, SimState } from '../sim/types'
import type { UiState } from './panels'
import { contactEstPos } from './panels'
import { SHIP_CLASSES } from '../data/defs'

/** blízkost/vzdalování cíle podle radiální rychlosti (vůči vlastní lodi) */
export type ContactThreat = 'closing' | 'holding' | 'opening'

/** jeden čip proužku — čistá data, MobileHud je převede na HTML */
export interface MobileContactChip {
  shipId: number
  /** kód třídy (hullCode) nebo '?' u pouhého klínu (idQuality 0) */
  code: string
  /** vzdálenost od vlastní lodi v km (k formátování přes fmtKm) */
  rangeKm: number
  /** kvalita identifikace 0=jen klín, 1=třída, 2=plná */
  quality: 0 | 1 | 2
  /** radiální pohyb vůči nám */
  threat: ContactThreat
  /** loď kapitulovala (klín vypnut, nestřílet) */
  surrendered: boolean
  /** je to právě zaměřený cíl */
  selected: boolean
}

/** práh radiální rychlosti pro „drží vzdálenost" (km/s) — jako v panelTargetDetail */
const RADIAL_DEADBAND = 0.5

/**
 * Vybere nejbližší kontakty a spočítá jejich čipy (seřazené podle vzdálenosti).
 * Čistá funkce — žádný DOM, deterministická (jen extrapolace ze snapshotu).
 */
export function mobileContactChips(state: SimState, ui: UiState, max = 5): MobileContactChip[] {
  const own = ui.ownShipId != null
    ? state.ships.find(s => s.id === ui.ownShipId) ?? null
    : null
  const oPos = own ? own.pos : { x: 0, y: 0 }
  const oVel = own ? own.vel : { x: 0, y: 0 }

  const chips = state.contacts.player.map((c): MobileContactChip => {
    const est = contactEstPos(c)
    const dx = est.x - oPos.x
    const dy = est.y - oPos.y
    const range = Math.hypot(dx, dy)
    // radiální rychlost: − = přibližuje se, + = vzdaluje se
    const ux = range > 0 ? dx / range : 1
    const uy = range > 0 ? dy / range : 0
    const vr = (c.vel.x - oVel.x) * ux + (c.vel.y - oVel.y) * uy
    const threat: ContactThreat = vr < -RADIAL_DEADBAND ? 'closing'
      : vr > RADIAL_DEADBAND ? 'opening' : 'holding'
    const ship: ShipState | undefined = state.ships.find(s => s.id === c.shipId)
    const code = c.idQuality === 0
      ? '?'
      : (SHIP_CLASSES[c.classGuess]?.hullCode ?? c.classGuess)
    return {
      shipId: c.shipId,
      code,
      rangeKm: range,
      quality: c.idQuality,
      threat,
      surrendered: ship?.surrendered === true,
      selected: c.shipId === ui.targetId,
    }
  })

  chips.sort((a, b) => a.rangeKm - b.rangeKm)
  return chips.slice(0, max)
}
