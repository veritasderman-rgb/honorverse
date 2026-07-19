import { describe, expect, it } from 'vitest'
import { desiredHeading, updateShipPhysics } from '../src/sim/physics'
import { G, SHIP_MAX_SPEED, SIM_DT, TURN_RATE } from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { len, vec } from '../src/sim/vec'
import type { ShipState, SimState, Subsystems } from '../src/sim/types'

const fullSubsystems = (): Subsystems => ({
  impellerFwd: 1,
  impellerAft: 1,
  sidewallPort: 1,
  sidewallStbd: 1,
  tubesPort: 1,
  tubesStbd: 1,
  energyPort: 1,
  energyStbd: 1,
  pdlc: 1,
  cm: 1,
  sensors: 1,
  ecm: 1,
})

function makeShip(over: Partial<ShipState> = {}): ShipState {
  return {
    id: 1,
    side: 'player',
    classId: 'dd-vichr',
    name: 'ANS Test',
    pos: vec(0, 0),
    vel: vec(0, 0),
    heading: 0,
    throttle: 1,
    nav: null,
    wedgeOn: true,
    activeSensors: false,
    rolledTo: null,
    subsystems: fullSubsystems(),
    hull: 60,
    missiles: 90,
    cms: 120,
    tubeCooldown: 0,
    energyCooldown: 0,
    destroyed: false,
    surrendered: false,
    lastSurrenderDemandAt: -1e9,
    doctrine: 'player',
    fireControl: { mode: 'hold', targetId: null, salvoSize: 3, driveMode: 0, engaged: false },
    pendingWave: null,
    buffs: { lockBonus: 0, lockUntil: 0, repairBonus: 1, repairUntil: 0 },
    terminalTimes: [],
    ...over,
  }
}

function makeState(ships: ShipState[]): SimState {
  return {
    t: 0,
    rng: { s: 1 },
    nextId: 100,
    ships,
    missiles: [],
    contacts: { player: [], enemy: [], neutral: [] },
    events: [],
    pendingComms: [],
    flags: {},
    objectives: [],
    outcome: 'running',
    scenarioId: 'test',
  }
}

/** plná akcelerace DD Vichr (km/s²) */
const DD_ACCEL = SHIP_CLASSES['dd-vichr']!.maxAccelG * G

describe('updateShipPhysics — akcelerace', () => {
  it('zrychluje po headingu k cíli kurzu (semi-implicitní Euler)', () => {
    const ship = makeShip({ nav: { kind: 'course', dest: vec(1e9, 0), arriveAtRest: false } })
    const state = makeState([ship])
    updateShipPhysics(state, ship, SIM_DT)
    // v = a·dt, p = v·dt (rychlost aktualizovaná před pozicí)
    expect(ship.vel.x).toBeCloseTo(DD_ACCEL * SIM_DT, 6)
    expect(ship.vel.y).toBeCloseTo(0, 6)
    expect(ship.pos.x).toBeCloseTo(DD_ACCEL * SIM_DT * SIM_DT, 6)
  })

  it('respektuje throttle', () => {
    const ship = makeShip({
      throttle: 0.5,
      nav: { kind: 'course', dest: vec(1e9, 0), arriveAtRest: false },
    })
    updateShipPhysics(makeState([ship]), ship, SIM_DT)
    expect(ship.vel.x).toBeCloseTo(0.5 * DD_ACCEL * SIM_DT, 6)
  })

  it('poškozené impelery snižují akceleraci (průměr fwd/aft)', () => {
    const subs = fullSubsystems()
    subs.impellerFwd = 0.4
    subs.impellerAft = 0.8
    const ship = makeShip({
      subsystems: subs,
      nav: { kind: 'course', dest: vec(1e9, 0), arriveAtRest: false },
    })
    updateShipPhysics(makeState([ship]), ship, SIM_DT)
    expect(ship.vel.x).toBeCloseTo(0.6 * DD_ACCEL * SIM_DT, 6)
  })

  it('nepřekročí SHIP_MAX_SPEED', () => {
    const ship = makeShip({
      vel: vec(SHIP_MAX_SPEED - 1, 0),
      nav: { kind: 'course', dest: vec(1e12, 0), arriveAtRest: false },
    })
    const state = makeState([ship])
    for (let i = 0; i < 10; i++) updateShipPhysics(state, ship, 1)
    expect(len(ship.vel)).toBeLessThanOrEqual(SHIP_MAX_SPEED + 1e-9)
  })

  it('s vypnutým klínem driftuje (akcelerace 0)', () => {
    const ship = makeShip({
      wedgeOn: false,
      vel: vec(100, 0),
      nav: { kind: 'course', dest: vec(1e9, 0), arriveAtRest: false },
    })
    updateShipPhysics(makeState([ship]), ship, SIM_DT)
    expect(ship.vel.x).toBeCloseTo(100, 9)
    expect(ship.vel.y).toBeCloseTo(0, 9)
    expect(ship.pos.x).toBeCloseTo(100 * SIM_DT, 9)
  })

  it('bez nav plánu neakceleruje', () => {
    const ship = makeShip({ vel: vec(50, 0) })
    updateShipPhysics(makeState([ship]), ship, SIM_DT)
    expect(ship.vel.x).toBeCloseTo(50, 9)
    expect(ship.pos.x).toBeCloseTo(50 * SIM_DT, 9)
  })
})

describe('updateShipPhysics — otáčení a tolerance headingu', () => {
  it('otáčí se rychlostí TURN_RATE a bokem nezrychluje', () => {
    // cíl kolmo (π/2), heading 0 → mimo toleranci 0,3 rad
    const ship = makeShip({ nav: { kind: 'course', dest: vec(0, 1e9), arriveAtRest: false } })
    const state = makeState([ship])
    updateShipPhysics(state, ship, SIM_DT)
    expect(ship.heading).toBeCloseTo(TURN_RATE * SIM_DT, 9)
    expect(len(ship.vel)).toBe(0) // žádná akcelerace bokem
  })

  it('po dotočení začne zrychlovat správným směrem', () => {
    const ship = makeShip({ nav: { kind: 'course', dest: vec(0, 1e9), arriveAtRest: false } })
    const state = makeState([ship])
    // π/2 při 0,15 rad/s ≈ 10,5 s otáčení
    for (let i = 0; i < 60; i++) updateShipPhysics(state, ship, SIM_DT)
    expect(ship.heading).toBeCloseTo(Math.PI / 2, 3)
    expect(ship.vel.y).toBeGreaterThan(0)
    expect(Math.abs(ship.vel.x)).toBeLessThan(ship.vel.y) // převážně po ose y
  })
})

describe('updateShipPhysics — rolování', () => {
  it('odvalená loď drží kurz a neakceleruje', () => {
    const ship = makeShip({
      rolledTo: 1.5,
      heading: 0.7,
      vel: vec(100, -20),
      nav: { kind: 'course', dest: vec(1e9, 0), arriveAtRest: false },
    })
    updateShipPhysics(makeState([ship]), ship, SIM_DT)
    expect(ship.heading).toBe(0.7)
    expect(ship.vel).toEqual(vec(100, -20))
    expect(ship.pos.x).toBeCloseTo(100 * SIM_DT, 9)
    expect(ship.pos.y).toBeCloseTo(-20 * SIM_DT, 9)
  })
})

describe('updateShipPhysics — intercept autopilot', () => {
  it('dohoní pohybující se cíl (přiblížení < 1 % počáteční vzdálenosti)', () => {
    const target = makeShip({
      id: 2,
      side: 'enemy',
      classId: 'merch-freighter',
      pos: vec(1_000_000, 200_000),
      vel: vec(-30, 80),
      wedgeOn: false, // cíl driftuje
    })
    const ship = makeShip({ nav: { kind: 'intercept', targetId: 2 } })
    const state = makeState([ship, target])
    const d0 = len(vec(target.pos.x - ship.pos.x, target.pos.y - ship.pos.y))
    let closest = d0
    // ~15 min simulace krokem SIM_DT; heading se přepočítává každý tick
    for (let i = 0; i < 1800; i++) {
      updateShipPhysics(state, ship, SIM_DT)
      target.pos = vec(target.pos.x + target.vel.x * SIM_DT, target.pos.y + target.vel.y * SIM_DT)
      const d = len(vec(target.pos.x - ship.pos.x, target.pos.y - ship.pos.y))
      closest = Math.min(closest, d)
    }
    expect(closest).toBeLessThan(0.01 * d0)
  })
})

describe('desiredHeading', () => {
  it('bez plánu vrací null', () => {
    const ship = makeShip()
    expect(desiredHeading(ship, makeState([ship]))).toBeNull()
  })

  it('intercept míří zhruba na stojící cíl', () => {
    const target = makeShip({ id: 2, side: 'enemy', pos: vec(0, 1e6) })
    const ship = makeShip({ nav: { kind: 'intercept', targetId: 2 } })
    const h = desiredHeading(ship, makeState([ship, target]))
    expect(h).not.toBeNull()
    expect(h!).toBeCloseTo(Math.PI / 2, 6)
  })

  it('intercept zničeného cíle vrací null', () => {
    const target = makeShip({ id: 2, side: 'enemy', pos: vec(1e6, 0), destroyed: true })
    const ship = makeShip({ nav: { kind: 'intercept', targetId: 2 } })
    expect(desiredHeading(ship, makeState([ship, target]))).toBeNull()
  })

  it('course arriveAtRest: v brzdné fázi míří proti rychlosti', () => {
    // v = 200 km/s, brzdná dráha v²/2a ≈ 3921 km > 1000 km do cíle → brzdit
    const ship = makeShip({
      vel: vec(200, 0),
      nav: { kind: 'course', dest: vec(1000, 0), arriveAtRest: true },
    })
    const h = desiredHeading(ship, makeState([ship]))
    expect(h).not.toBeNull()
    expect(Math.abs(h!)).toBeCloseTo(Math.PI, 6)
  })

  it('course arriveAtRest: daleko od cíle zrychluje k němu', () => {
    const ship = makeShip({ nav: { kind: 'course', dest: vec(1e6, 0), arriveAtRest: true } })
    const h = desiredHeading(ship, makeState([ship]))
    expect(h).not.toBeNull()
    expect(h!).toBeCloseTo(0, 6)
  })
})
