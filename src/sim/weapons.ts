/**
 * Útočné zbraně: raketové salvy, let a navádění raket, energetická palba.
 * Éra jednostupňových raket (knihy 1–6) — jediný typ hlavice (std-shipkiller).
 */
import type { DriveMode, MissileState, ShipState, SimState } from './types'
import {
  ENERGY_COOLDOWN, ENERGY_DECISIVE_RANGE, ENERGY_MAX_RANGE,
  G, LOCK_LOST, TUBE_COOLDOWN,
} from './constants'
import { MISSILES, SHIP_CLASSES } from '../data/defs'
import { add, clampLen, dist, len, norm, scale, sub } from './vec'
import { applyBeamDamage, effectiveTubes } from './damage'
import { attackAspect, resolveTerminal } from './defense'

const DEFAULT_MISSILE = 'std-shipkiller'

/** Pokles zámku za letu bez pohonu (balistika) — ~0.01/s. */
const BALLISTIC_LOCK_DECAY = 0.01

/** Odpal salvy: omezena šachtami, municí a cooldownem. */
export function launchSalvo(
  state: SimState,
  ship: ShipState,
  targetId: number,
  count: number,
  mode: DriveMode,
): void {
  if (ship.destroyed || ship.tubeCooldown > 0) return
  const n = Math.min(count, effectiveTubes(ship), ship.missiles)
  if (n <= 0) return

  const def = MISSILES[DEFAULT_MISSILE]
  const salvoId = state.nextId++
  for (let i = 0; i < n; i++) {
    const m: MissileState = {
      id: state.nextId++,
      side: ship.side,
      def: def.id,
      pos: { ...ship.pos },   // dědí pozici…
      vel: { ...ship.vel },   // …a vektor lodi (odpal „po směru" natahuje dostřel)
      targetId,
      mode,
      driveRemaining: def.driveTime[mode],
      phase: 'boost',
      lock: 1.0,
      salvoId,
    }
    state.missiles.push(m)
  }
  ship.missiles -= n
  ship.tubeCooldown = TUBE_COOLDOWN
  state.events.push({
    t: state.t, kind: 'launch', shipId: ship.id, side: ship.side, slowdown: true,
    text: `${ship.name}: odpálena salva ${n} raket`,
  })
}

/** Let raket: navádění, boost/balistika, přechod do terminální fáze. */
export function updateMissiles(state: SimState, dt: number): void {
  for (const m of state.missiles) {
    if (m.phase === 'dead') continue
    const def = MISSILES[m.def]

    const target = state.ships.find(s => s.id === m.targetId)
    if (!target || target.destroyed) {
      m.phase = 'dead'
      state.events.push({
        t: state.t, kind: 'missileMiss', side: m.side,
        text: 'raketa ztratila cíl (zničen)',
      })
      continue
    }

    // čisté pronásledování s predikcí: miř na extrapolovanou pozici cíle
    const d0 = dist(m.pos, target.pos)
    const tLead = Math.min(d0 / Math.max(len(m.vel), 1), 120)
    const aim = add(target.pos, scale(target.vel, tLead))
    const dir = norm(sub(aim, m.pos))

    if (m.phase === 'boost') {
      const accel = def.accelG[m.mode] * G
      m.vel = add(m.vel, scale(dir, accel * dt))
      m.driveRemaining -= dt
      if (m.driveRemaining <= 0) {
        m.driveRemaining = 0
        m.phase = 'ballistic' // pohon vyhořel — letí setrvačností
      }
    } else {
      m.lock -= BALLISTIC_LOCK_DECAY * dt // bez pohonu zámek pomalu eroduje
    }

    m.vel = clampLen(m.vel, def.maxSpeed)
    m.pos = add(m.pos, scale(m.vel, dt))

    if (m.lock < LOCK_LOST) {
      m.phase = 'dead'
      state.events.push({
        t: state.t, kind: 'missileMiss', side: m.side,
        text: 'raketa ztratila zámek',
      })
      continue
    }

    // dosažení standoff vzdálenosti → terminální vyhodnocení
    if (dist(m.pos, target.pos) < def.standoffRange + len(m.vel) * dt) {
      m.phase = 'terminal'
      resolveTerminal(state, m, target)
    }
  }

  // mrtvé rakety pryč z pole
  if (state.missiles.some(m => m.phase === 'dead')) {
    state.missiles = state.missiles.filter(m => m.phase !== 'dead')
  }
}

/** Energetická palba (laser/graser) — drtivá zblízka, slabá na max. dosah. */
export function fireEnergy(state: SimState, shooter: ShipState, target: ShipState): void {
  if (shooter.destroyed || target.destroyed || shooter.energyCooldown > 0) return
  const d = dist(shooter.pos, target.pos)
  if (d > ENERGY_MAX_RANGE) return

  const def = SHIP_CLASSES[shooter.classId]
  const bestSide = Math.max(shooter.subsystems.energyPort, shooter.subsystems.energyStbd)
  const mounts = Math.floor(def.energyMountsPerBroadside * bestSide)
  if (mounts <= 0 || def.energyDamage <= 0) return

  // plné poškození pod rozhodující vzdáleností, ~15 % na maximálním dosahu
  const falloff = d <= ENERGY_DECISIVE_RANGE
    ? 1
    : 1 - ((d - ENERGY_DECISIVE_RANGE) / (ENERGY_MAX_RANGE - ENERGY_DECISIVE_RANGE)) * 0.85
  const aspect = attackAspect(target, shooter.pos)

  shooter.energyCooldown = ENERGY_COOLDOWN
  state.events.push({
    t: state.t, kind: 'energyHit', shipId: target.id, side: target.side,
    text: `${shooter.name}: energetická salva na ${target.name} (${mounts}× mount, ${aspect})`,
  })
  for (let i = 0; i < mounts; i++) {
    applyBeamDamage(state, target, def.energyDamage * falloff, aspect)
  }
}
