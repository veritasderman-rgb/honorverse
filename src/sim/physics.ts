/**
 * Fyzika lodí: autopilot (nav plán), otáčení, akcelerace impelerem,
 * integrace pohybu. Jednotky: km, s, km/s, km/s². Úhly rad.
 */
import type { ShipState, SimState } from './types'
import { EMERGENCY_THROTTLE_MAX, G, SHIP_MAX_SPEED, THRUSTER_G, TURN_RATE } from './constants'
import { add, angleDiff, angleOf, clampLen, dot, fromAngle, len, norm, scale, sub } from './vec'
import { SHIP_CLASSES } from '../data/defs'
import { interceptSolution } from './intercept'
import { formationLeader, formationSlotPos } from './formation'

/** tolerance odchylky headingu, při které loď smí zrychlovat (rad) */
const ACCEL_HEADING_TOLERANCE = 0.3
/** práh „dorazili jsme“: vzdálenost od cíle kurzu (km) */
const ARRIVE_DIST = 100
/** práh „dorazili jsme“ pro arriveAtRest: zbytková rychlost (km/s) */
const ARRIVE_SPEED = 1
/** station-keeping: tlumení přibližovací rychlosti (< 1 ⇒ konverguje bez kmitů) */
const FORMATION_DAMPING = 0.7
/** station-keeping: pod tuto odchylku od žádané rychlosti loď jen koastuje (km/s) */
const FORMATION_VEL_TOLERANCE = 2
/**
 * station-keeping: proporcionální zóna u slotu — žádaná přibližovací rychlost
 * max. d/60 s (√-profil je u nuly příliš strmý → limitní kmity ±40 km/s)
 */
const FORMATION_APPROACH_TIME = 60

/** rozkazový výkon: 0–120 % (nad 100 % nouzový výkon — riziko řeší crew.ts) */
const clampThrottle = (x: number): number =>
  Math.min(EMERGENCY_THROTTLE_MAX, Math.max(0, x))

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
  return def.maxAccelG * G * clampThrottle(ship.throttle) * impellers
}

/**
 * Station-keeping formace: žádaný heading pro držení slotu vůči leaderovi.
 * Žádaná rychlost = leaderova + přibližovací složka √(2·a·d)·tlumení směrem
 * na slot (brachystochrona s tlumením — konverguje bez trvalých kmitů);
 * loď akceleruje ve směru rozdílu rychlostí. Null = v slotu / bez leadera.
 */
export function formationHeading(state: SimState, ship: ShipState): number | null {
  const f = ship.formation
  if (!f) return null
  const leader = formationLeader(state, ship)
  if (!leader) return null
  const a = planningAccel(ship)
  if (a <= 0) return null
  const slot = formationSlotPos(leader, f.kind, f.slot)
  const e = sub(slot, ship.pos)
  const d = len(e)
  const approach = Math.min(
    Math.sqrt(2 * a * d) * FORMATION_DAMPING, d / FORMATION_APPROACH_TIME, SHIP_MAX_SPEED)
  const vDes = d > 0 ? add(leader.vel, scale(e, approach / d)) : { ...leader.vel }
  const dv = sub(vDes, ship.vel)
  if (len(dv) < FORMATION_VEL_TOLERANCE) return null // slot drží — koast
  return angleOf(dv)
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

  // (1) autopilot — loď ve formaci s živým leaderem drží slot (ignoruje
  // vlastní nav), jinak žádaný směr dle nav plánu
  const inFormation = !!ship.formation && formationLeader(state, ship) !== null
  const want = inFormation ? formationHeading(state, ship) : desiredHeading(ship, state)

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
    : THRUSTER_G * G * clampThrottle(ship.throttle)
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
