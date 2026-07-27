/**
 * Posádka a řízení poškození (damage control):
 *   1. polní opravy — subsystémy se pomalu opravují do stropu REPAIR_CAP,
 *   2. náhodné události posádky za boje (taktik / inženýr / spojař) —
 *      deterministicky ze state.rng, hlášky přes eventy se speaker.
 */
import type { Contact, RepairFocus, ShipState, Side, SimState, Subsystems } from './types'
import {
  CREW_COMBAT_RANGE, CREW_EVENT_MEAN_TIME,
  EMERGENCY_DAMAGE_MAX, EMERGENCY_DAMAGE_MIN, EMERGENCY_DAMAGE_RATE,
  LOCK_BUFF, LOCK_BUFF_TIME,
  REPAIR_BUFF, REPAIR_BUFF_TIME, REPAIR_CAP, REPAIR_CAP_LIGHT,
  REPAIR_FOCUS_BOOST, REPAIR_FOCUS_OTHERS, REPAIR_LIGHT_FACTOR, REPAIR_RATE,
} from './constants'
import { SHIP_CLASSES } from '../data/defs'
import { SUBSYSTEM_NAMES } from './damage'
import { add, dist, scale } from './vec'
import { rand } from './rng'
import { poweredEnvelope } from './weapons'
import { voiceShipStatus, voiceTargetInEnvelope } from './voice'

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

/** skupiny subsystémů pro prioritu oprav (koncentrace damage-control čet) */
export const REPAIR_GROUPS: Record<Exclude<RepairFocus, 'balanced'>, (keyof Subsystems)[]> = {
  weapons: ['tubesPort', 'tubesStbd', 'energyPort', 'energyStbd'],
  drive: ['impellerFwd', 'impellerAft'],
  defense: ['sidewallPort', 'sidewallStbd', 'pdlc', 'cm'],
}

/**
 * Polní opravy: těžká poškození plným tempem do provizorního stropu
 * REPAIR_CAP (0.7), lehká se dolaďují za provozu polovičním tempem až do
 * REPAIR_CAP_LIGHT (0.9) — plných 100 % vrátí jen dok. Priorita oprav
 * (ship.repairFocus) koncentruje čety: prioritní skupina ×3, ostatní ×0.5.
 */
function updateRepairs(state: SimState, ship: ShipState, dt: number): void {
  const boost = state.t < ship.buffs.repairUntil ? ship.buffs.repairBonus : 1
  const focus = ship.repairFocus ?? 'balanced'
  const focusKeys = focus === 'balanced' ? null : REPAIR_GROUPS[focus]
  for (const key of SUBSYSTEM_KEYS) {
    const v = ship.subsystems[key]
    if (v >= REPAIR_CAP_LIGHT) continue // víc než 90 % polní oprava nedá
    let rate = REPAIR_RATE * boost
    if (focusKeys) rate *= focusKeys.includes(key) ? REPAIR_FOCUS_BOOST : REPAIR_FOCUS_OTHERS
    if (v >= REPAIR_CAP) rate *= REPAIR_LIGHT_FACTOR // dolaďování za provozu
    const cap = v < REPAIR_CAP ? REPAIR_CAP : REPAIR_CAP_LIGHT
    const nv = Math.min(cap, v + rate * dt)
    ship.subsystems[key] = nv
    if (v < REPAIR_CAP && nv >= REPAIR_CAP && ship.side === 'player') {
      state.events.push({
        t: state.t, kind: 'message', shipId: ship.id, side: ship.side, speaker: 'engineer',
        text: `Inženýr: ${SUBSYSTEM_NAMES[key]} znovu online — máme ${Math.round(REPAIR_CAP * 100)} % výkonu!`,
      })
    }
  }
}

/** hlášky inženýra při poškození prstence nouzovým výkonem (výběr ze state.rng) */
const EMERGENCY_MESSAGES = [
  'Kompenzátor jede za červenou — jestli to neubereme, přijdeme o prstenec!',
  'Přetížení! Alfa nody házejí harmoniky — sto dvacet procent dlouho nevydržíme!',
  'Prstenec se přehřívá! Doporučuju okamžitě stáhnout výkon pod sto procent!',
]

/**
 * Nouzový výkon (throttle > 1.0 se zapnutým klínem): každou sekundu riziko
 * EMERGENCY_DAMAGE_RATE, že náhodný impelerový prstenec ztratí 0.08–0.15.
 * Rng se čerpá JEN pro lodě nad 100 % — tok rng ostatních se nemění
 * (determinismus referenčních běhů bez nouzového výkonu).
 */
function updateEmergencyPower(state: SimState, ship: ShipState, dt: number): void {
  if (ship.throttle <= 1 || !ship.wedgeOn) return
  if (rand(state.rng) >= EMERGENCY_DAMAGE_RATE * dt) return
  const key: keyof Subsystems = rand(state.rng) < 0.5 ? 'impellerFwd' : 'impellerAft'
  const loss = EMERGENCY_DAMAGE_MIN + rand(state.rng) * (EMERGENCY_DAMAGE_MAX - EMERGENCY_DAMAGE_MIN)
  ship.subsystems[key] = Math.max(0, ship.subsystems[key] - loss)
  const msgIdx = Math.floor(rand(state.rng) * EMERGENCY_MESSAGES.length)
  const msg = EMERGENCY_MESSAGES[msgIdx]
  if (ship.doctrine === 'player') {
    state.events.push({
      t: state.t, kind: 'comm', shipId: ship.id, side: ship.side,
      speaker: 'engineer', slowdown: false, voId: `eng-redline-${msgIdx + 1}`,
      text: `${msg} (${SUBSYSTEM_NAMES[key]} na ${Math.round(ship.subsystems[key] * 100)} %)`,
    })
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
      t: state.t, kind: 'comm', shipId: ship.id, side: ship.side, speaker: 'tactical', slowdown: false, voId: 'crew-event-lock',
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
      t: state.t, kind: 'comm', shipId: ship.id, side: ship.side, speaker: 'engineer', slowdown: false, voId: 'crew-event-repair',
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
      t: state.t, kind: 'comm', shipId: ship.id, side: ship.side, speaker: 'comms', slowdown: false,
      text: `Zachytil jsem jejich komunikaci — kontakt #${target.id} je ${className}.`,
    })
  } else {
    state.events.push({
      t: state.t, kind: 'comm', shipId: ship.id, side: ship.side, speaker: 'comms', slowdown: false, voId: 'crew-event-sigint',
      text: 'Zachycená nepřátelská komunikace — šifrovaná. Nahrávám pro rozvědku.',
    })
  }
}

/**
 * Situační hlásky lodi hráče (edge-triggered, viz voice.ts):
 * stav trupu/munice/CM + hlídání vstupu cílů do poháněné obálky.
 */
function voiceChecks(state: SimState, ship: ShipState): void {
  voiceShipStatus(state, ship)
  // „cíl v obálce": jen loď schopná raketové palby
  const def = SHIP_CLASSES[ship.classId]
  if (!def || def.tubesPerBroadside <= 0 || ship.missiles <= 0) return
  for (const c of state.contacts[ship.side] ?? []) {
    if (state.flags[`said:in-envelope:${c.shipId}`] === true) continue
    const target = state.ships.find(s => s.id === c.shipId)
    if (!target || target.destroyed || target.surrendered || !hostileTo(ship.side, target.side)) continue
    const tPos = estPos(c)
    const d = dist(ship.pos, tPos)
    if (d <= poweredEnvelope(ship.pos, ship.vel, tPos, c.vel, 0)) {
      voiceTargetInEnvelope(state, ship, target)
    }
  }
}

/** Krok posádky: opravy všech lodí + náhodné události hráčových lodí za boje. */
export function updateCrew(state: SimState, dt: number): void {
  for (const ship of state.ships) {
    if (ship.destroyed) continue
    updateRepairs(state, ship, dt)
    updateEmergencyPower(state, ship, dt)
    if (ship.doctrine === 'player') {
      voiceChecks(state, ship)
      if (inCombat(state, ship)) maybeCrewEvent(state, ship, dt)
    }
  }
}
