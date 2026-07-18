/**
 * Testy bojového modelu: rng, salvy, vrstvená obrana (statisticky),
 * bočníky a subsystémové umírání. Spouštět: npx vitest run tests/combat.test.ts
 */
import { describe, expect, it } from 'vitest'
import type { MissileState, ShipState, SimState, Subsystems } from '../src/sim/types'
import { TUBE_COOLDOWN } from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'
import { rand } from '../src/sim/rng'
import { fireEnergy, launchSalvo, updateMissiles } from '../src/sim/weapons'
import { attackAspect, updateDefenses } from '../src/sim/defense'
import { applyBeamDamage, effectiveTubes } from '../src/sim/damage'

// ---------- helpery ----------

function fullSubsystems(v = 1): Subsystems {
  return {
    impellerFwd: v, impellerAft: v, sidewallPort: v, sidewallStbd: v,
    tubesPort: v, tubesStbd: v, energyPort: v, energyStbd: v,
    pdlc: v, cm: v, sensors: v, ecm: v,
  }
}

function makeState(seed: number): SimState {
  return {
    t: 0,
    rng: { s: seed >>> 0 },
    nextId: 1000,
    ships: [],
    missiles: [],
    contacts: { player: [], enemy: [], neutral: [] },
    events: [],
    flags: {},
    objectives: [],
    outcome: 'running',
    scenarioId: 'test',
  }
}

function makeShip(id: number, classId: string, over: Partial<ShipState> = {}): ShipState {
  const def = SHIP_CLASSES[classId]
  return {
    id, side: 'player', classId, name: `loď ${id}`,
    pos: vec(0, 0), vel: vec(0, 0), heading: 0, throttle: 0.8, nav: null,
    wedgeOn: true, activeSensors: true, rolledTo: null,
    subsystems: fullSubsystems(),
    hull: def.hullPoints, missiles: def.magazineMissiles, cms: def.magazineCMs,
    tubeCooldown: 0, energyCooldown: 0, destroyed: false, doctrine: 'player',
    ...over,
  }
}

function makeMissile(id: number, targetId: number, over: Partial<MissileState> = {}): MissileState {
  return {
    id, side: 'enemy', def: 'std-shipkiller',
    pos: vec(3_000_000, 0), vel: vec(-40_000, 0),
    targetId, mode: 1, driveRemaining: 60, phase: 'boost', lock: 1.0, salvoId: 1,
    ...over,
  }
}

/**
 * Jeden běh pipeline: 50 raket (HI, start 3 mil. km, zděděný vektor 40 000 km/s)
 * proti CA. Cíl má obří hull, aby přežil a šel měřit čistý průnik obrany.
 * Vrací počet raket, které detonovaly se zásahem ('missileHit').
 */
function runSalvoVsCA(seed: number, healthyDefense: boolean): { hits: number; rngS: number } {
  const state = makeState(seed)
  const ca = makeShip(1, 'ca-star-knight', { hull: 1e9 })
  if (!healthyDefense) {
    ca.subsystems = fullSubsystems(0) // vyřazená obrana
    ca.cms = 0
  }
  state.ships.push(ca)
  for (let i = 0; i < 50; i++) state.missiles.push(makeMissile(100 + i, 1))

  let hits = 0
  for (let step = 0; step < 600 && state.missiles.length > 0; step++) {
    updateMissiles(state, 0.5)
    updateDefenses(state, 0.5)
    hits += state.events.filter(e => e.kind === 'missileHit').length
    state.events.length = 0
  }
  return { hits, rngS: state.rng.s }
}

// ---------- rng ----------

describe('rng (mulberry32)', () => {
  it('stejný seed dává stejnou sekvenci, jiný seed jinou', () => {
    const a = { s: 12345 }, b = { s: 12345 }, c = { s: 54321 }
    const seqA = Array.from({ length: 20 }, () => rand(a))
    const seqB = Array.from({ length: 20 }, () => rand(b))
    const seqC = Array.from({ length: 20 }, () => rand(c))
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
    for (const x of seqA) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1) }
  })
})

// ---------- salva ----------

describe('launchSalvo', () => {
  it('respektuje šachty, munici a cooldown', () => {
    const state = makeState(1)
    const dd = makeShip(1, 'dd-havoc', { missiles: 5 }) // 3 šachty na bok
    const target = makeShip(2, 'ca-star-knight', { side: 'enemy', pos: vec(2_000_000, 0) })
    state.ships.push(dd, target)

    launchSalvo(state, dd, 2, 10, 1) // chce 10, šachty dovolí 3
    expect(state.missiles.length).toBe(3)
    expect(dd.missiles).toBe(2)
    expect(dd.tubeCooldown).toBe(TUBE_COOLDOWN)
    expect(state.events.some(e => e.kind === 'launch' && e.slowdown)).toBe(true)

    launchSalvo(state, dd, 2, 3, 1) // cooldown běží → nic
    expect(state.missiles.length).toBe(3)

    dd.tubeCooldown = 0
    launchSalvo(state, dd, 2, 10, 1) // munice dovolí už jen 2
    expect(state.missiles.length).toBe(5)
    expect(dd.missiles).toBe(0)

    dd.tubeCooldown = 0
    launchSalvo(state, dd, 2, 3, 1) // bez munice → nic
    expect(state.missiles.length).toBe(5)
  })

  it('rakety dědí vektor lodi a sdílejí salvoId', () => {
    const state = makeState(2)
    const dd = makeShip(1, 'dd-havoc', { pos: vec(100, 200), vel: vec(5000, -1000) })
    state.ships.push(dd)
    launchSalvo(state, dd, 99, 3, 0)
    expect(state.missiles.length).toBe(3)
    for (const m of state.missiles) {
      expect(m.pos).toEqual({ x: 100, y: 200 })
      expect(m.vel).toEqual({ x: 5000, y: -1000 })
      expect(m.phase).toBe('boost')
      expect(m.lock).toBe(1)
      expect(m.driveRemaining).toBe(180) // LO režim
      expect(m.salvoId).toBe(state.missiles[0].salvoId)
    }
  })

  it('poškozené šachty snižují velikost salvy (lepší bok, floor)', () => {
    const dd = makeShip(1, 'dd-havoc')
    dd.subsystems.tubesPort = 0.4
    dd.subsystems.tubesStbd = 0.9
    expect(effectiveTubes(dd)).toBe(2) // floor(3 · 0.9)
  })
})

// ---------- statistika pipeline ----------

describe('vrstvená obrana — statistika (200 seedů)', () => {
  it('zdravá obrana CA propustí v průměru 4–15 % z 50 raket', () => {
    const SEEDS = 200
    let total = 0
    for (let seed = 1; seed <= SEEDS; seed++) total += runSalvoVsCA(seed, true).hits
    const avg = total / SEEDS
    expect(avg).toBeGreaterThanOrEqual(2)    // ≥ 4 %
    expect(avg).toBeLessThanOrEqual(7.5)     // ≤ 15 %
  })

  it('bez obrany projde > 80 % salvy', () => {
    let total = 0
    const SEEDS = 30
    for (let seed = 1; seed <= SEEDS; seed++) total += runSalvoVsCA(seed, false).hits
    expect(total / (SEEDS * 50)).toBeGreaterThan(0.8)
  })

  it('celá pipeline je deterministická (stejný seed = stejný výsledek)', () => {
    const a = runSalvoVsCA(42, true)
    const b = runSalvoVsCA(42, true)
    expect(a.hits).toBe(b.hits)
    expect(a.rngS).toBe(b.rngS)
  })
})

// ---------- bočníky a aspekty ----------

describe('bočníky a aspekty', () => {
  it('bočník blokuje slabé paprsky na boku, hrdlo dostává plné poškození ·1.25', () => {
    const state = makeState(3)
    const ca = makeShip(1, 'ca-star-knight') // sidewallStrength 22
    state.ships.push(ca)

    applyBeamDamage(state, ca, 14, 'stbd') // 14 < 22 → pohlceno
    expect(ca.hull).toBe(150)

    applyBeamDamage(state, ca, 14, 'throat')
    expect(ca.hull).toBeCloseTo(150 - 14 * 1.25)
  })

  it('oslabený bočník už paprsek propustí', () => {
    const state = makeState(4)
    const ca = makeShip(1, 'ca-star-knight')
    ca.subsystems.sidewallStbd = 0.3 // práh 6.6
    state.ships.push(ca)
    applyBeamDamage(state, ca, 14, 'stbd')
    expect(ca.hull).toBeCloseTo(150 - (14 - 22 * 0.3))
  })

  it('attackAspect rozliší hrdlo, záď a boky', () => {
    const ship = makeShip(1, 'ca-star-knight', { heading: 0 })
    expect(attackAspect(ship, vec(1000, 0))).toBe('throat')
    expect(attackAspect(ship, vec(-1000, 0))).toBe('kilt')
    expect(attackAspect(ship, vec(0, 1000))).toBe('port')
    expect(attackAspect(ship, vec(0, -1000))).toBe('stbd')
  })

  it('energetická palba na max. dosah neprorazí zdravý bočník', () => {
    const state = makeState(5)
    const dd = makeShip(1, 'dd-havoc', { pos: vec(0, 450_000) }) // z boku (port)
    const ca = makeShip(2, 'ca-star-knight', { side: 'enemy' })
    state.ships.push(dd, ca)
    fireEnergy(state, dd, ca)
    // 25 · ~0.26 ≈ 6.5 na paprsek < práh 22 → žádné poškození, ale výstřel proběhl
    expect(state.events.some(e => e.kind === 'energyHit')).toBe(true)
    expect(ca.hull).toBe(150)
    expect(dd.energyCooldown).toBeGreaterThan(0)
  })
})

// ---------- subsystémové umírání ----------

describe('poškození po subsystémech', () => {
  it('loď degraduje po částech a subsystémy padají dřív, než zemře', () => {
    const state = makeState(6)
    const ca = makeShip(1, 'ca-star-knight')
    state.ships.push(ca)

    let beamsToKill = 0
    let subsystemHitsBeforeDeath = 0
    while (!ca.destroyed && beamsToKill < 100) {
      applyBeamDamage(state, ca, 20, 'kilt')
      beamsToKill++
      if (!ca.destroyed) {
        subsystemHitsBeforeDeath += state.events.filter(e => e.kind === 'subsystemHit').length
      }
      state.events.length = 0
    }

    expect(ca.destroyed).toBe(true)
    expect(beamsToKill).toBeGreaterThan(3) // žádná skoková smrt jednou ranou
    expect(subsystemHitsBeforeDeath).toBeGreaterThanOrEqual(3) // umírá po částech
    const damagedSubsystems = Object.values(ca.subsystems).filter(v => v < 1).length
    expect(damagedSubsystems).toBeGreaterThanOrEqual(2)
  })

  it('zničení vyvolá event shipDestroyed se slowdown', () => {
    const state = makeState(7)
    const dd = makeShip(1, 'dd-havoc', { hull: 5 })
    state.ships.push(dd)
    applyBeamDamage(state, dd, 30, 'throat')
    expect(dd.destroyed).toBe(true)
    expect(state.events.some(e => e.kind === 'shipDestroyed' && e.slowdown)).toBe(true)
  })
})
