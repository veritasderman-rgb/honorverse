/**
 * Útočné zbraně: raketové salvy, let a navádění raket, energetická palba.
 * Éra jednostupňových raket (knihy 1–6) — jediný typ hlavice (std-shipkiller).
 * Nově: poháněná obálka (poweredEnvelope), odhad doletu (missileFlightTime)
 * a česká zpětná vazba rozkazů hráče (event 'message', speaker 'tactical').
 */
import type { DriveMode, MissileState, ShipState, SimState, Vec2 } from './types'
import {
  ENERGY_COOLDOWN, ENERGY_DECISIVE_RANGE, ENERGY_MAX_RANGE,
  G, LOCK_LOST, TUBE_COOLDOWN,
} from './constants'
import { MISSILES, SHIP_CLASSES } from '../data/defs'
import { add, clampLen, dist, dot, len, norm, scale, sub } from './vec'
import { applyBeamDamage, effectiveTubes } from './damage'
import { attackAspect, resolveTerminal } from './defense'

const DEFAULT_MISSILE = 'std-shipkiller'

/** Pokles zámku za letu bez pohonu (balistika) — ~0.01/s. */
const BALLISTIC_LOCK_DECAY = 0.01

/** formát mil. km s českou čárkou („7,2") */
const fmtMkm = (km: number): string => (km / 1e6).toFixed(1).replace('.', ',')

/**
 * Poháněná obálka rakety: dosah poháněného letu vůči cíli — dráha pohonu
 * plus příspěvek aktuálního relativního vektoru lodi k cíli (odpal „po
 * směru" dostřel natahuje, odpal „přes rameno" zkracuje).
 */
export function poweredEnvelope(
  pos: Vec2, vel: Vec2, targetPos: Vec2, targetVel: Vec2, mode: DriveMode,
): number {
  const def = MISSILES[DEFAULT_MISSILE]
  const a = def.accelG[mode] * G
  const T = def.driveTime[mode]
  const rel = sub(targetPos, pos)
  const d = len(rel)
  const dir = d > 0 ? scale(rel, 1 / d) : { x: 1, y: 0 }
  const closing = dot(sub(vel, targetVel), dir) // relativní přibližovací rychlost
  return Math.max(0, closing * T + 0.5 * a * T * T)
}

/**
 * Odhad doby doletu rakety na vzdálenost d při dané přibližovací rychlosti:
 * poháněná fáze (konst. akcelerace do vyhoření), pak balistika konstantní
 * rychlostí. Infinity = balisticky nikdy nedoletí (vzdaluje se).
 */
export function missileFlightTime(d: number, closing: number, mode: DriveMode): number {
  if (d <= 0) return 0
  const def = MISSILES[DEFAULT_MISSILE]
  const a = def.accelG[mode] * G
  const T = def.driveTime[mode]
  // poháněná fáze: closing·t + ½·a·t² = d
  const disc = closing * closing + 2 * a * d
  const tPow = (-closing + Math.sqrt(disc)) / a
  if (tPow <= T) return tPow
  // balistický dojezd rychlostí z vyhoření
  const dBurn = closing * T + 0.5 * a * T * T
  const vBurn = closing + a * T
  if (vBurn <= 0) return Infinity
  return T + (d - dBurn) / vBurn
}

interface LaunchOpts {
  /** druhá vlna vrstvené salvy — šachty už jsou přednabité, cooldown neblokuje */
  ignoreCooldown?: boolean
}

/** hláška posádky hráči (jen lodě ovládané hráčem — AI si nestěžuje) */
function crewSay(state: SimState, ship: ShipState, text: string): void {
  if (ship.doctrine !== 'player') return
  state.events.push({ t: state.t, kind: 'message', shipId: ship.id, side: ship.side, speaker: 'tactical', text })
}

/** Odpal salvy: omezena šachtami, municí a cooldownem; no-op hlásí důvod. */
export function launchSalvo(
  state: SimState,
  ship: ShipState,
  targetId: number,
  count: number,
  mode: DriveMode,
  opts: LaunchOpts = {},
): void {
  if (ship.destroyed) return
  if (ship.tubeCooldown > 0 && !opts.ignoreCooldown) {
    crewSay(state, ship, `Šachty přebíjejí — další salva za ${Math.ceil(ship.tubeCooldown)} s.`)
    return
  }
  const n = Math.min(count, effectiveTubes(ship), ship.missiles)
  if (n <= 0) {
    crewSay(state, ship, ship.missiles <= 0
      ? 'Prázdné zásobníky raket!'
      : 'Všechny raketové šachty vyřazeny!')
    return
  }

  // varování: cíl mimo poháněnou obálku (odpal projde — rakety doletí balisticky)
  const target = state.ships.find(s => s.id === targetId && !s.destroyed)
  if (target && ship.doctrine === 'player') {
    const d = dist(ship.pos, target.pos)
    const env = poweredEnvelope(ship.pos, ship.vel, target.pos, target.vel, mode)
    if (d > env) {
      crewSay(state, ship,
        `Cíl mimo poháněnou obálku (${fmtMkm(d)} mil. km, dosah ${fmtMkm(env)}) — rakety dojedou balisticky.`)
    }
  }

  const def = MISSILES[DEFAULT_MISSILE]
  // buff taktického důstojníka: lepší palebné řešení = vyšší počáteční zámek
  const lockBonus = state.t < ship.buffs.lockUntil ? ship.buffs.lockBonus : 0
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
      lock: 1.0 + lockBonus,
      salvoId,
    }
    state.missiles.push(m)
  }
  ship.missiles -= n
  ship.tubeCooldown = TUBE_COOLDOWN
  state.events.push({
    t: state.t, kind: 'launch', shipId: ship.id, side: ship.side, slowdown: true,
    text: `${ship.name}: odpálena salva ${n} raket${opts.ignoreCooldown ? ' (druhá vlna)' : ''}`,
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

/** Energetická palba (laser/graser) — drtivá zblízka, slabá na max. dosah; no-op hlásí důvod. */
export function fireEnergy(state: SimState, shooter: ShipState, target: ShipState): void {
  if (shooter.destroyed || target.destroyed) return
  if (shooter.energyCooldown > 0) {
    crewSay(state, shooter, `Energetické baterie nabíjejí — připraveny za ${Math.ceil(shooter.energyCooldown)} s.`)
    return
  }
  const d = dist(shooter.pos, target.pos)
  if (d > ENERGY_MAX_RANGE) {
    crewSay(state, shooter,
      `Cíl mimo dosah energetických zbraní (${fmtMkm(d)} mil. km, dosah ${fmtMkm(ENERGY_MAX_RANGE)}).`)
    return
  }

  const def = SHIP_CLASSES[shooter.classId]
  const bestSide = Math.max(shooter.subsystems.energyPort, shooter.subsystems.energyStbd)
  const mounts = Math.floor(def.energyMountsPerBroadside * bestSide)
  if (mounts <= 0 || def.energyDamage <= 0) {
    if (def.energyMountsPerBroadside > 0) crewSay(state, shooter, 'Energetické zbraně vyřazeny!')
    return
  }

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
