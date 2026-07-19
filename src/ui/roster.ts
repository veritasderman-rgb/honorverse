/**
 * FLOTILA — čistá logika rosteru vlastních lodí (bez DOM, testovatelné).
 * Ovladatelná loď = side 'player' A doctrine 'player'. Spojenci se side
 * 'player' ale jinou doktrínou (např. 'escort') se v rosteru zobrazují
 * šedě jako „AI" a převzít nejdou.
 */
import type { ShipState, SimState, Vec2 } from '../sim/types'

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

// ---------- hromadný výběr (čistá logika, testovatelné) ----------

/**
 * Shift-klik: přidá/odebere loď z výběru. Jen vlastní OVLADATELNÉ lodě;
 * primární loď (ownShipId) z výběru odebrat nelze — výběr ji obsahuje vždy.
 */
export function toggleShipSelection(
  state: SimState, selected: number[], primaryId: number | null, id: number,
): number[] {
  const ship = state.ships.find(s => s.id === id)
  if (!ship || !isControllable(ship)) return selected
  if (id === primaryId) return selected
  return selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]
}

/** Obdélníkový výběr (Shift-tažení na plotu): ovladatelné lodě uvnitř rectu. */
export function boxSelectShips(state: SimState, a: Vec2, b: Vec2): number[] {
  const x0 = Math.min(a.x, b.x)
  const x1 = Math.max(a.x, b.x)
  const y0 = Math.min(a.y, b.y)
  const y1 = Math.max(a.y, b.y)
  return controllableShips(state)
    .filter(s => s.pos.x >= x0 && s.pos.x <= x1 && s.pos.y >= y0 && s.pos.y <= y1)
    .map(s => s.id)
}

/**
 * Normalizace výběru po snapshotu: vyhodí zničené/neovladatelné lodě
 * a zaručí, že výběr vždy obsahuje primární loď (na prvním místě).
 */
export function normalizeSelection(
  state: SimState, selected: number[], primaryId: number | null,
): number[] {
  const ids = selected.filter(id => {
    if (id === primaryId) return false // primární přidáme dopředu níže
    const s = state.ships.find(x => x.id === id)
    return !!s && isControllable(s)
  })
  return primaryId != null ? [primaryId, ...ids] : ids
}
