/**
 * Fyzika lodí: autopilot (nav plán), otáčení, akcelerace impelerem,
 * integrace pohybu. Jednotky: km, s, km/s, km/s². Úhly rad.
 */
import type { ShipState, SimState } from './types'
import { G, SHIP_MAX_SPEED, THRUSTER_G, TURN_RATE } from './constants'
import { add, angleDiff, angleOf, clampLen, dot, fromAngle, len, norm, scale, sub } from './vec'
import { SHIP_CLASSES } from '../data/defs'
import { interceptSolution } from './intercept'

/** tolerance odchylky headingu, při které loď smí zrychlovat (rad) */
const ACCEL_HEADING_TOLERANCE = 0.3
/** práh „dorazili jsme“: vzdálenost od cíle kurzu (km) */
const ARRIVE_DIST = 100
/** práh „dorazili jsme“ pro arriveAtRest: zbytková rychlost (km/s) */
const ARRIVE_SPEED = 1

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

/** normalizace úhlu do (−π, π] */
const normAngle = (a: number): number => angleDiff(a, 0)

/**
 * Plánovací akcelerace: max třídy × throttle × efektivita impelerů.
 * Nezohledňuje wedgeOn — plán má smysl i před zapnutím klínu.
 */
function planningAccel(ship: ShipState): number {
  const def = SHIP_CLASSES[ship.classId]
  if (!def) return 0
  const impellers = (ship.subsystems.impellerFwd + ship.subsystems.impellerAft) / 2
  return def.maxAccelG * G * clamp01(ship.throttle) * impellers
}

/**
 * Žádaný heading dle nav plánu. Null = žádný plán / cíl neexistuje /
 * kurz dokončen — loď nemanévruje.
 */
export function desiredHeading(ship: ShipState, state: SimState): number | null {
  const nav = ship.nav
  if (!nav) return null
  const accel = planningAccel(ship)

  if (nav.kind === 'intercept') {
    // každý tick přepočet na skutečnou pozici cíle
    const target = state.ships.find((s) => s.id === nav.targetId && !s.destroyed)
    if (!target) return null
    const sol = interceptSolution(ship.pos, ship.vel, accel, target.pos, target.vel)
    if (sol) return sol.heading
    // bez řešení do 24 h: aspoň mířit na cíl
    const rel = sub(target.pos, ship.pos)
    return len(rel) > 0 ? angleOf(rel) : null
  }

  // --- kurz na pevný bod ---
  const toDest = sub(nav.dest, ship.pos)
  const d = len(toDest)
  const speed = len(ship.vel)
  // dorazili (u arriveAtRest až po vybrzdění)
  if (d < ARRIVE_DIST && (!nav.arriveAtRest || speed < ARRIVE_SPEED)) return null

  // Bez klínu (trysky): intercept solver je pro poměr malá akcelerace ×
  // velká rychlost špatně podmíněný — místo něj navádění na předpokládaný
  // bod průletu: burn kolmo na predikovanou odchylku (korekce driftu).
  if (!ship.wedgeOn && speed > 1) {
    const tGo = d / speed
    const predictedMiss = sub(nav.dest, add(ship.pos, scale(ship.vel, tGo)))
    if (len(predictedMiss) < ARRIVE_DIST) return null // trefíme se — koast
    return angleOf(predictedMiss)
  }

  if (nav.arriveAtRest && accel > 0) {
    // brachystochrona, 2. půlka: brzdná dráha ≥ zbytek → otočit a brzdit
    const closing = d > 0 ? dot(ship.vel, norm(toDest)) : speed
    if (closing > 0 && (closing * closing) / (2 * accel) >= d) {
      return angleOf(scale(ship.vel, -1))
    }
  }
  // zrychlovací fáze / průlet: intercept nehybného bodu (kompenzuje boční drift)
  const sol = interceptSolution(ship.pos, ship.vel, accel, nav.dest, { x: 0, y: 0 })
  if (sol) return sol.heading
  return d > 0 ? angleOf(toDest) : null
}

/**
 * Kompletní fyzikální krok lodi: autopilot → otáčení → akcelerace →
 * semi-implicitní Euler. Odvalená loď (rolledTo ≠ null) nemanévruje —
 * kryje se klínem, drží kurz a jen driftuje.
 */
export function updateShipPhysics(state: SimState, ship: ShipState, dt: number): void {
  if (ship.destroyed) return

  // (5) odvalená loď: žádné otáčení ani akcelerace, jen drift
  if (ship.rolledTo !== null) {
    ship.pos = add(ship.pos, scale(ship.vel, dt))
    return
  }

  // (1) autopilot — žádaný směr dle nav plánu
  const want = desiredHeading(ship, state)

  // (2) otáčení k žádanému headingu rychlostí TURN_RATE
  if (want !== null) {
    const diff = angleDiff(want, ship.heading)
    const maxTurn = TURN_RATE * dt
    ship.heading =
      Math.abs(diff) <= maxTurn ? want : normAngle(ship.heading + Math.sign(diff) * maxTurn)
  }

  // (3) akcelerace po ose heading — s klínem plný impeler, bez klínu jen
  // manévrovací trysky (~THRUSTER_G — korekce driftu, ne boj); heading musí
  // být v toleranci od žádaného směru (loď nezrychluje bokem)
  let a = ship.wedgeOn
    ? planningAccel(ship)
    : THRUSTER_G * G * clamp01(ship.throttle)
  if (want === null || Math.abs(angleDiff(want, ship.heading)) > ACCEL_HEADING_TOLERANCE) {
    a = 0
  }

  // (4) semi-implicitní Euler + tvrdý rychlostní strop (částicové clony)
  if (a > 0) {
    ship.vel = add(ship.vel, scale(fromAngle(ship.heading), a * dt))
  }
  ship.vel = clampLen(ship.vel, SHIP_MAX_SPEED)
  ship.pos = add(ship.pos, scale(ship.vel, dt))
}
