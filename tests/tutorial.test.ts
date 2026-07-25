/**
 * Tutoriál mise 1: úplnost dat (kotvy, oba jazyky) a čisté podmínky kroků
 * nad snapshotem simulace. Bez DOM.
 * Spouštět: npx vitest run tests/tutorial.test.ts
 */
import { describe, expect, it } from 'vitest'
import type { ShipState, SimState } from '../src/sim/types'
import type { UiState } from '../src/ui/panels'
import { TUTORIALS } from '../src/data/tutorials'
import { emptyStats } from '../src/ui/combatStats'

const steps = TUTORIALS.mission01

function mkState(over: Partial<SimState> = {}): SimState {
  return {
    t: 0, rng: { s: 1 }, nextId: 100, ships: [], missiles: [],
    contacts: { player: [], enemy: [], neutral: [] }, events: [], pendingComms: [],
    flags: {}, objectives: [], outcome: 'running', scenarioId: 'mission01',
    ...over,
  }
}

function mkOwn(over: Partial<ShipState> = {}): ShipState {
  return {
    id: 1, side: 'player', classId: 'dd-vichr', name: 'ANS Dauntless',
    pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, heading: 0, throttle: 0.8, nav: null,
    wedgeOn: true, activeSensors: false, rolledTo: null,
    subsystems: {
      impellerFwd: 1, impellerAft: 1, sidewallPort: 1, sidewallStbd: 1,
      tubesPort: 1, tubesStbd: 1, energyPort: 1, energyStbd: 1,
      pdlc: 1, cm: 1, sensors: 1, ecm: 1,
    },
    hull: 100, missiles: 10, pods: 0, cms: 10, decoys: 0, decoyActive: false,
    tubeCooldown: 0, energyCooldown: 0, destroyed: false, doctrine: 'player',
    surrendered: false, lastSurrenderDemandAt: -1e9,
    fireControl: { mode: 'hold', targetId: null, salvoSize: 2, driveMode: 0, engaged: false },
    pendingWave: null, buffs: { lockBonus: 0, lockUntil: 0, repairBonus: 1, repairUntil: 0 },
    terminalTimes: [],
    ...over,
  }
}

function mkUi(over: Partial<UiState> = {}): UiState {
  return {
    ownShipId: 1, selectedShipIds: [1], targetId: null, courseMode: false,
    compression: 1, slowdownText: null, selectedSalvoId: null, autonomousMode: false,
    escortJammerMode: false, autoSlowEnabled: true, selectMode: false,
    report: emptyStats(), ...over,
  }
}

describe('data tutoriálu mise 1', () => {
  it('má aspoň 6 kroků, oba jazyky a smysluplné kotvy', () => {
    expect(steps.length).toBeGreaterThanOrEqual(6)
    for (const s of steps) {
      expect(s.text.cs.length).toBeGreaterThan(20)
      expect(s.text.en.length).toBeGreaterThan(20)
      if (s.anchor !== null) expect(s.anchor.length).toBeGreaterThan(2)
    }
    // první a poslední krok jsou ruční (uvítání a rozloučení)
    expect(steps[0].done).toBeUndefined()
    expect(steps[steps.length - 1].done).toBeUndefined()
  })
})

describe('podmínky kroků (deterministicky ze snapshotu)', () => {
  /** Cygnus (id 4) = cíl mise; sonda (id 7) = svod, krok posunout nesmí */
  const cygnus = mkOwn({ id: 4, side: 'neutral', name: 'Cygnus', objective: true } as Partial<ShipState>)
  const probe = mkOwn({ id: 7, side: 'neutral', name: 'sonda' })
  const state = mkState({ ships: [mkOwn(), cygnus, probe] })

  it('výběr cíle: splněno jen s vybraným CÍLEM MISE (◎), ne jiným kontaktem', () => {
    const step = steps.find(s => s.anchor === '[data-fold="contacts"]')!
    expect(step.done!(state, mkUi())).toBe(false)
    expect(step.done!(state, mkUi({ targetId: 7 }))).toBe(false) // sonda nestačí
    expect(step.done!(state, mkUi({ targetId: 4 }))).toBe(true)
  })

  it('intercept: splněno jen interceptem na cíl mise', () => {
    const step = steps.find(s => s.anchor === '[data-act="intercept"]')!
    expect(step.done!(state, mkUi())).toBe(false)
    const wrong = mkState({ ships: [mkOwn({ nav: { kind: 'intercept', targetId: 7 } }), cygnus, probe] })
    expect(step.done!(wrong, mkUi())).toBe(false)
    const right = mkState({ ships: [mkOwn({ nav: { kind: 'intercept', targetId: 4 } }), cygnus, probe] })
    expect(step.done!(right, mkUi())).toBe(true)
  })

  it('tah: splněno až při 100 %', () => {
    const step = steps.find(s => s.anchor === '[data-act="throttle:100"]')!
    expect(step.done!(state, mkUi())).toBe(false)
    const st2 = mkState({ ships: [mkOwn({ throttle: 1 })] })
    expect(step.done!(st2, mkUi())).toBe(true)
  })

  it('komprese: splněno od 100×', () => {
    const step = steps.find(s => s.anchor === '[data-comp="100"]')!
    expect(step.done!(state, mkUi({ compression: 10 }))).toBe(false)
    expect(step.done!(state, mkUi({ compression: 100 }))).toBe(true)
  })

  it('senzory: splněno se zapnutými aktivními senzory', () => {
    const step = steps.find(s => s.anchor === '[data-act="sensors"]')!
    expect(step.done!(state, mkUi())).toBe(false)
    const st2 = mkState({ ships: [mkOwn({ activeSensors: true })] })
    expect(step.done!(st2, mkUi())).toBe(true)
  })

  it('cíl mise: splněno se splněným obj-inspect', () => {
    const step = steps.filter(s => s.done).at(-1)!
    expect(step.done!(state, mkUi())).toBe(false)
    const st2 = mkState({
      ships: [mkOwn()],
      objectives: [{ id: 'obj-inspect', text: 'x', state: 'done' }],
    })
    expect(step.done!(st2, mkUi())).toBe(true)
  })
})
