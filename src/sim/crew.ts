/**
 * Posádka a řízení poškození (damage control):
 *   1. polní opravy — subsystémy se pomalu opravují do stropu REPAIR_CAP,
 *   2. náhodné události posádky za boje (taktik / inženýr / spojař) —
 *      deterministicky ze state.rng, hlášky přes eventy se speaker.
 */
import type { Contact, ShipState, Side, SimState, Subsystems } from './types'
import {
  CREW_COMBAT_RANGE, CREW_EVENT_MEAN_TIME,
  LOCK_BUFF, LOCK_BUFF_TIME,
  REPAIR_BUFF, REPAIR_BUFF_TIME, REPAIR_CAP, REPAIR_RATE,
} from './constants'
import { SHIP_CLASSES } from '../data/defs'
import { SUBSYSTEM_NAMES } from './damage'
import { add, dist, scale } from './vec'
import { rand } from './rng'

const SUBSYSTEM_KEYS = Object.keys(SUBSYSTEM_NAMES) as (keyof Subsystems)[]

const hostileTo = (a: Side, b: Side): boolean =>
  (a === 'player' && b === 'enemy') || (a === 'enemy' && b === 'player')

/** odhad aktuální pozice kontaktu (extrapolace o stáří dat) */
const estPos = (c: Contact) => add(c.pos, scale(c.vel, c.age))

/** „za boje": letí rakety s účastí lodi, nebo nepřátelský kontakt v dosahu */
function inCombat(state: SimState, ship: ShipState): boolean {
  for (const m of state.missiles) {
    if (m.phase === 'dead') continue
    if (m.targetId === ship.id || m.side === ship.side) return true
  }
  for (const c of state.contacts[ship.side] ?? []) {
    const target = state.ships.find(s => s.id === c.shipId)
    if (!target || target.destroyed || !hostileTo(ship.side, target.side)) continue
    if (dist(ship.pos, estPos(c)) < CREW_COMBAT_RANGE) return true
  }
  return false
}

/** Polní opravy: pomalý růst poškozených subsystémů do stropu REPAIR_CAP. */
function updateRepairs(state: SimState, ship: ShipState, dt: number): void {
  const boost = state.t < ship.buffs.repairUntil ? ship.buffs.repairBonus : 1
  for (const key of SUBSYSTEM_KEYS) {
    const v = ship.subsystems[key]
    if (v >= REPAIR_CAP) continue // nad strop polní oprava nedosáhne
    const nv = Math.min(REPAIR_CAP, v + REPAIR_RATE * boost * dt)
    ship.subsystems[key] = nv
    if (nv >= REPAIR_CAP && ship.side === 'player') {
      state.events.push({
        t: state.t, kind: 'message', shipId: ship.id, side: ship.side, speaker: 'engineer',
        text: `Inženýr: ${SUBSYSTEM_NAMES[key]} znovu online — máme ${Math.round(REPAIR_CAP * 100)} % výkonu!`,
      })
    }
  }
}

/** Náhodná událost posádky (jen lodě ovládané hráčem, jen za boje). */
function maybeCrewEvent(state: SimState, ship: ShipState, dt: number): void {
  if (rand(state.rng) >= dt / CREW_EVENT_MEAN_TIME) return
  const roll = rand(state.rng)

  if (roll < 1 / 3) {
    // (a) taktický důstojník: mezera v obranném vzorci → lock buff
    ship.buffs.lockBonus = LOCK_BUFF
    ship.buffs.lockUntil = state.t + LOCK_BUFF_TIME
    state.events.push({
      t: state.t, kind: 'comm', shipId: ship.id, side: ship.side, speaker: 'tactical', slowdown: true,
      text: `Našel jsem mezeru v jejich obranném vzorci — zámek našich raket +${Math.round(LOCK_BUFF * 100)} % `
        + `na ${Math.round(LOCK_BUFF_TIME / 60)} minut.`,
    })
    return
  }

  if (roll < 2 / 3) {
    // (b) inženýr: dočasný boost polních oprav
    ship.buffs.repairBonus = REPAIR_BUFF
    ship.buffs.repairUntil = state.t + REPAIR_BUFF_TIME
    state.events.push({
      t: state.t, kind: 'comm', shipId: ship.id, side: ship.side, speaker: 'engineer', slowdown: true,
      text: `Přepojil jsem záložní okruhy — opravy pojedou ${REPAIR_BUFF}× rychleji, `
        + `vydrží to ${Math.round(REPAIR_BUFF_TIME / 60)} minut.`,
    })
    return
  }

  // (c) spojař: zachycená nepřátelská komunikace → odhalí nejbližší neurčitý kontakt
  let best: { c: Contact; d: number } | null = null
  for (const c of state.contacts[ship.side] ?? []) {
    if (c.idQuality >= 2) continue
    const target = state.ships.find(s => s.id === c.shipId)
    if (!target || target.destroyed || !hostileTo(ship.side, target.side)) continue
    const d = dist(ship.pos, estPos(c))
    if (!best || d < best.d) best = { c, d }
  }
  if (best) {
    const target = state.ships.find(s => s.id === best.c.shipId)!
    state.flags[`revealed:${target.id}`] = true
    for (const side of ['player', 'enemy'] as const) {
      for (const ct of state.contacts[side]) {
        if (ct.shipId === target.id) ct.classGuess = target.classId
      }
    }
    const className = SHIP_CLASSES[target.classId]?.name ?? target.classId
    state.events.push({
      t: state.t, kind: 'comm', shipId: ship.id, side: ship.side, speaker: 'comms', slowdown: true,
      text: `Zachytil jsem jejich komunikaci — kontakt #${target.id} je ${className}.`,
    })
  } else {
    state.events.push({
      t: state.t, kind: 'comm', shipId: ship.id, side: ship.side, speaker: 'comms', slowdown: true,
      text: 'Zachycená nepřátelská komunikace — šifrovaná. Nahrávám pro rozvědku.',
    })
  }
}

/** Krok posádky: opravy všech lodí + náhodné události hráčových lodí za boje. */
export function updateCrew(state: SimState, dt: number): void {
  for (const ship of state.ships) {
    if (ship.destroyed) continue
    updateRepairs(state, ship, dt)
    if (ship.doctrine === 'player' && inCombat(state, ship)) {
      maybeCrewEvent(state, ship, dt)
    }
  }
}
