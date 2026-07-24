/**
 * Průletová navigace: intercept solver preferuje NEJČASNĚJŠÍ kořen (dojezd
 * po směru letu), waypointy trasy se prolétají širokou zatáčkou bez zastavení
 * a loď při interceptu necouvá (nelétá dlouze zádí napřed).
 * Spouštět: npx vitest run tests/navflow.test.ts
 */
import { describe, expect, it } from 'vitest'
import type { ShipState, SimState, Subsystems } from '../src/sim/types'
import { interceptSolution } from '../src/sim/intercept'
import { updateShipPhysics } from '../src/sim/physics'
import { G, SIM_DT } from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'

const A = 416 * G * 0.8 // DD na 80 % tahu

function fullSubsystems(v = 1): Subsystems {
  return {
    impellerFwd: v, impellerAft: v, sidewallPort: v, sidewallStbd: v,
    tubesPort: v, tubesStbd: v, energyPort: v, energyStbd: v,
    pdlc: v, cm: v, sensors: v, ecm: v,
  }
}

function makeShip(id: number, over: Partial<ShipState> = {}): ShipState {
  const def = SHIP_CLASSES['dd-vichr']
  return {
    id, side: 'player', classId: 'dd-vichr', name: `s${id}`,
    pos: vec(0, 0), vel: vec(0, 0), heading: 0, throttle: 0.8, nav: null,
    wedgeOn: true, activeSensors: false, rolledTo: null,
    subsystems: fullSubsystems(),
    hull: def.hullPoints, missiles: 0, pods: 0, cms: 0, decoys: 0, decoyActive: false,
    tubeCooldown: 0, energyCooldown: 0, destroyed: false, doctrine: 'player',
    surrendered: false, lastSurrenderDemandAt: -1e9,
    fireControl: { mode: 'hold', targetId: null, salvoSize: 0, driveMode: 0, engaged: false },
    pendingWave: null, buffs: { lockBonus: 0, lockUntil: 0, repairBonus: 1, repairUntil: 0 },
    terminalTimes: [],
    ...over,
  }
}

const mkState = (ships: ShipState[]): SimState => ({
  t: 0, rng: { s: 1 }, nextId: 100, ships, missiles: [],
  contacts: { player: [], enemy: [], neutral: [] }, events: [], pendingComms: [],
  flags: {}, objectives: [], outcome: 'running', scenarioId: 'test',
})

describe('interceptSolution — nejčasnější kořen', () => {
  it('rychlá loď, bod před ní mírně stranou: burn dopředu, ne otočka', () => {
    // dřív: iterace konvergovala k pozdnímu kořenu → aim retrográdně (flip&burn)
    const sol = interceptSolution(vec(0, 0), vec(2000, 0), A, vec(10_000_000, 1_000_000), vec(0, 0))
    expect(sol).not.toBeNull()
    expect(Math.abs(sol!.heading)).toBeLessThan(Math.PI / 2) // prográdní poloprostor
  })

  it('cíl letící proti nám: burn K cíli a čas < čistý dojezd bez akcelerace', () => {
    const sol = interceptSolution(vec(0, 0), vec(0, 0), A, vec(10_000_000, 0), vec(-500, 0))
    expect(sol).not.toBeNull()
    expect(Math.abs(sol!.heading)).toBeLessThan(0.1)
    expect(sol!.time).toBeLessThan(10_000_000 / 500)
  })

  it('řešení sedí do rovnice: ½at² = |R + V·t| (reziduum < 0,1 %)', () => {
    const cases = [
      { v: vec(2000, 0), R: vec(10_000_000, 1_000_000), V: vec(0, 0) },
      { v: vec(1500, 0), R: vec(20_000_000, 0), V: vec(0, 300) },
      { v: vec(0, 0), R: vec(5_000_000, 5_000_000), V: vec(-200, 100) },
    ]
    for (const c of cases) {
      const sol = interceptSolution(vec(0, 0), c.v, A, c.R, c.V)!
      const rx = c.R.x + (c.V.x - c.v.x) * sol.time
      const ry = c.R.y + (c.V.y - c.v.y) * sol.time
      const covered = 0.5 * A * sol.time * sol.time
      expect(Math.abs(covered - Math.hypot(rx, ry)) / covered).toBeLessThan(1e-3)
    }
  })
})

describe('trasa s waypointy — průlet bez zastavení', () => {
  it('zhruba srovnané waypointy se prolétají vysokou rychlostí', () => {
    const ship = makeShip(1)
    ship.nav = {
      kind: 'course', dest: vec(3_000_000, 0), arriveAtRest: false,
      then: [vec(6_000_000, 2_000_000), vec(9_000_000, 3_000_000)],
    }
    const st = mkState([ship])
    const passSpeeds: number[] = []
    for (let t = 0; t < 7200; t += SIM_DT) {
      const before = ship.nav?.kind === 'course' ? ship.nav.then?.length ?? 0 : 0
      updateShipPhysics(st, ship, SIM_DT)
      const after = ship.nav?.kind === 'course' ? ship.nav.then?.length ?? 0 : 0
      if (after < before) passSpeeds.push(Math.hypot(ship.vel.x, ship.vel.y))
      if (passSpeeds.length === 2) break
    }
    expect(passSpeeds).toHaveLength(2)
    // dřív: flip&burn srazil rychlost mezi body skoro na nulu (227 km/s a míň)
    for (const v of passSpeeds) expect(v).toBeGreaterThan(1500)
  })
})

describe('intercept — loď necouvá po rozkazu a dojíždí řízeně', () => {
  it('cíl před letící lodí: zrychluje K cíli, otočku dělá až na brzdění', () => {
    const ship = makeShip(1, { vel: vec(1500, 0) })
    const tgt = makeShip(2, { id: 2, side: 'enemy', pos: vec(15_000_000, 0), vel: vec(0, 100), heading: Math.PI / 2 })
    const st = mkState([ship, tgt])
    ship.nav = { kind: 'intercept', targetId: 2 }
    let backwardsEarly = 0   // zádí napřed v PRVNÍ čtvrthodině po rozkazu (bug)
    let arrived = -1
    let arriveClosing = 0
    let lastD = 15_000_000
    for (let t = 0; t < 7200; t += SIM_DT) {
      tgt.pos.x += tgt.vel.x * SIM_DT
      tgt.pos.y += tgt.vel.y * SIM_DT
      updateShipPhysics(st, ship, SIM_DT)
      const sp = Math.hypot(ship.vel.x, ship.vel.y)
      const prograde = sp > 50
        ? (ship.vel.x * Math.cos(ship.heading) + ship.vel.y * Math.sin(ship.heading)) / sp
        : 1
      if (t < 900 && prograde < -0.5) backwardsEarly += SIM_DT
      const d = Math.hypot(tgt.pos.x - ship.pos.x, tgt.pos.y - ship.pos.y)
      if (d < 100_000) { arrived = t; arriveClosing = (lastD - d) / SIM_DT; break }
      lastD = d
    }
    expect(arrived).toBeGreaterThan(0)         // dorazil
    // dřív (pozdní kořen): flip hned v půlce letu; teď žádné couvání po rozkazu
    expect(backwardsEarly).toBe(0)
    // guvernér: dojezd řízenou rychlostí, ne prosvištění tisíci km/s.
    // Měřeno na hranici 100k km — povolený brzdný profil tam je
    // √(500² + 2·a·100000) ≈ 950 km/s; dřív tudy létala 5000+.
    expect(arriveClosing).toBeLessThan(1000)
    // decelerace kiltem napřed je kanonická — ale nesmí prodloužit let extrémně
    expect(arrived).toBeLessThan(4000)
  })
})
