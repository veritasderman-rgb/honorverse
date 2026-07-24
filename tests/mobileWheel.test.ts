/**
 * Mobilní M3 — palcové kolo rozkazů: čistá logika akcí (wheelActions).
 * Bez DOM. Spouštět: npx vitest run tests/mobileWheel.test.ts
 */
import { describe, expect, it } from 'vitest'
import type { ShipState, Subsystems } from '../src/sim/types'
import { wheelActions, type WheelAction } from '../src/ui/mobileWheel'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'

function fullSubsystems(v = 1): Subsystems {
  return {
    impellerFwd: v, impellerAft: v, sidewallPort: v, sidewallStbd: v,
    tubesPort: v, tubesStbd: v, energyPort: v, energyStbd: v,
    pdlc: v, cm: v, sensors: v, ecm: v,
  }
}

function makeShip(over: Partial<ShipState> = {}): ShipState {
  const def = SHIP_CLASSES['ca-bastion']
  return {
    id: 100, side: 'player', classId: 'ca-bastion', name: 'ANS CA-1',
    pos: vec(0, 0), vel: vec(0, 0), heading: 0, throttle: 0.8, nav: null,
    wedgeOn: true, activeSensors: false, rolledTo: null,
    subsystems: fullSubsystems(),
    hull: def.hullPoints, missiles: 100, pods: 4, cms: def.magazineCMs,
    decoys: def.decoyCount, decoyActive: false,
    tubeCooldown: 0, energyCooldown: 0, destroyed: false, doctrine: 'player',
    surrendered: false, lastSurrenderDemandAt: -1e9,
    fireControl: { mode: 'hold', targetId: null, salvoSize: 4, driveMode: 0, engaged: false },
    pendingWave: null,
    buffs: { lockBonus: 0, lockUntil: 0, repairBonus: 1, repairUntil: 0 },
    terminalTimes: [],
    ...over,
  }
}

const by = (acts: WheelAction[], act: string): WheelAction =>
  acts.find(a => a.act === act)!

describe('wheelActions — palcové kolo rozkazů', () => {
  it('vrací 6 jádrových akcí ve stabilním pořadí', () => {
    const acts = wheelActions(makeShip(), true, false)
    expect(acts.map(a => a.act)).toEqual([
      'salvoFull', 'launchPods', 'energy', 'course', 'wedge', 'sensors',
    ])
  })

  it('palba/energie/plošiny vyžadují vybraný cíl', () => {
    const withT = wheelActions(makeShip(), true, false)
    const noT = wheelActions(makeShip(), false, false)
    expect(by(withT, 'salvoFull').disabled).toBe(false)
    expect(by(withT, 'energy').disabled).toBe(false)
    expect(by(withT, 'launchPods').disabled).toBe(false)
    expect(by(noT, 'salvoFull').disabled).toBe(true)
    expect(by(noT, 'energy').disabled).toBe(true)
    expect(by(noT, 'launchPods').disabled).toBe(true)
  })

  it('plošiny nesou počet a zakážou se bez plošin', () => {
    expect(by(wheelActions(makeShip({ pods: 4 }), true, false), 'launchPods').count).toBe(4)
    expect(by(wheelActions(makeShip({ pods: 0 }), true, false), 'launchPods').disabled).toBe(true)
  })

  it('klín/senzory/kurz zrcadlí zapnutý stav', () => {
    const a = wheelActions(makeShip({ wedgeOn: true, activeSensors: false }), true, true)
    expect(by(a, 'wedge').active).toBe(true)
    expect(by(a, 'sensors').active).toBe(false)
    expect(by(a, 'course').active).toBe(true)
    const b = wheelActions(makeShip({ wedgeOn: false, activeSensors: true }), true, false)
    expect(by(b, 'wedge').active).toBe(false)
    expect(by(b, 'sensors').active).toBe(true)
    expect(by(b, 'course').active).toBe(false)
  })

  it('mrtvá/chybějící loď: vše zakázané, nespadne', () => {
    for (const a of wheelActions(makeShip({ destroyed: true }), true, false)) expect(a.disabled).toBe(true)
    for (const a of wheelActions(null, true, false)) expect(a.disabled).toBe(true)
  })

  it('prázdné šachty zakážou salvu, ne přepínače', () => {
    const a = wheelActions(makeShip({ missiles: 0 }), true, false)
    expect(by(a, 'salvoFull').disabled).toBe(true)
    expect(by(a, 'wedge').disabled).toBe(false)
    expect(by(a, 'sensors').disabled).toBe(false)
  })
})
