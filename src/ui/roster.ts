/**
 * FLOTILA — čistá logika rosteru vlastních lodí (bez DOM, testovatelné).
 * Ovladatelná loď = side 'player' A doctrine 'player'. Spojenci se side
 * 'player' ale jinou doktrínou (např. 'escort') se v rosteru zobrazují
 * šedě jako „AI" a převzít nejdou.
 */
import type { ShipState, SimState } from '../sim/types'

/** loď může hráč přímo ovládat (a roster ji nabízí k převzetí) */
export const isControllable = (s: ShipState): boolean =>
  s.side === 'player' && s.doctrine === 'player' && !s.destroyed

/** ovladatelné lodě hráče v pořadí pole ships (klávesy 1–9 = index+1) */
export const controllableShips = (state: SimState): ShipState[] =>
  state.ships.filter(isControllable)

/** všechny živé vlastní lodě pro zobrazení rosteru (vč. AI spojenců) */
export const fleetShips = (state: SimState): ShipState[] =>
  state.ships.filter(s => s.side === 'player' && !s.destroyed)

/** roster se zobrazuje až od 2 ovladatelných lodí */
export const rosterVisible = (state: SimState): boolean =>
  controllableShips(state).length >= 2

/**
 * Výběr n-té ovladatelné lodi (1-based — klávesy 1–9).
 * Vrací id lodi, nebo null mimo rozsah.
 */
export function rosterPick(state: SimState, n: number): number | null {
  const ships = controllableShips(state)
  if (n < 1 || n > ships.length) return null
  return ships[n - 1].id
}

/**
 * Platná aktivní loď: ponechá currentId, je-li ovladatelná; jinak první
 * ovladatelná; jinak první živá vlastní loď; jinak currentId beze změny
 * (zničená vlastní loď zůstává vybraná — UI ukáže „LOĎ ZNIČENA").
 */
export function resolveOwnShipId(state: SimState, currentId: number | null): number | null {
  const cur = state.ships.find(s => s.id === currentId)
  if (cur && isControllable(cur)) return cur.id
  const first = controllableShips(state)[0] ?? fleetShips(state)[0]
  return first ? first.id : currentId
}
