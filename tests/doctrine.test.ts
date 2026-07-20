/**
 * Doktríny palby eskadry (nearest / biggest / spread):
 * deterministický výběr cílů z kontaktů, lepivost, rolování po zničení,
 * ignorace paměťových pinů a chování s prázdnými zásobníky.
 */
import { describe, expect, it } from 'vitest'
import type { Contact, ShipState, Subsystems, SimState } from '../src/sim/types'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'
import { updateFireControl } from '../src/sim/firecontrol'

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
    pendingComms: [],
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
    hull: def.hullPoints, missiles: def.magazineMissiles, pods: 0, cms: def.magazineCMs,
    decoys: def.decoyCount, decoyActive: false,
    tubeCooldown: 0, energyCooldown: 0, destroyed: false, doctrine: 'player',
    surrendered: false, lastSurrenderDemandAt: -1e9,
    fireControl: { mode: 'hold', targetId: null, salvoSize: def.tubesPerBroadside, driveMode: 0, engaged: false },
    pendingWave: null,
    buffs: { lockBonus: 0, lockUntil: 0, repairBonus: 1, repairUntil: 0 },
    terminalTimes: [],
    ...over,
  }
}

function contactFor(ship: ShipState, over: Partial<Contact> = {}): Contact {
  return {
    shipId: ship.id, pos: ship.pos, vel: ship.vel, age: 0,
    idQuality: 1, classGuess: ship.classId, wedgeDetected: true,
    ...over,
  }
}

/** stěna: střelec + nepřátelé v dosahu senzorů (kontakty rovnou zapsané) */
function setup(): SimState {
  const state = makeState(42)
  const shooter = makeShip(1, 'ca-bastion')
  const near = makeShip(21, 'dd-vichr', { side: 'enemy', pos: vec(2_000_000, 0) })
  const mid = makeShip(22, 'cl-sokol', { side: 'enemy', pos: vec(3_000_000, 0) })
  const big = makeShip(23, 'dn-ural', { side: 'enemy', pos: vec(5_000_000, 0) })
  state.ships.push(shooter, near, mid, big)
  state.contacts.player = [contactFor(near), contactFor(mid), contactFor(big)]
  return state
}

describe('doktrína NEJBLIŽŠÍ', () => {
  it('vybere nejbližší nepřátelský kontakt', () => {
    const state = setup()
    state.ships[0].fireControl.mode = 'nearest'
    updateFireControl(state)
    expect(state.ships[0].fireControl.targetId).toBe(21)
  })

  it('lepivost: drží stávající cíl do 1,2× vzdálenosti nejbližšího', () => {
    const state = setup()
    const fc = state.ships[0].fireControl
    fc.mode = 'nearest'
    fc.targetId = 22 // 3 M km
    // nejbližší je 21 na 2 M km → 3 M > 2 M × 1,2 → přeskočí na 21
    updateFireControl(state)
    expect(fc.targetId).toBe(21)
    // cíl 22 se přiblíží na 2,3 M km (≤ 2 M × 1,2) → lepivost ho drží
    fc.targetId = 22
    state.ships[2].pos = vec(2_300_000, 0)
    state.contacts.player[1].pos = state.ships[2].pos
    updateFireControl(state)
    expect(fc.targetId).toBe(22)
  })

  it('po zničení cíle plynule přejde na dalšího (bez vypnutí režimu)', () => {
    const state = setup()
    const fc = state.ships[0].fireControl
    fc.mode = 'nearest'
    updateFireControl(state)
    expect(fc.targetId).toBe(21)
    state.ships[1].destroyed = true
    state.contacts.player = state.contacts.player.filter(c => c.shipId !== 21)
    updateFireControl(state)
    expect(fc.mode).toBe('nearest')
    expect(fc.targetId).toBe(22)
  })
})

describe('doktrína NEJVĚTŠÍ', () => {
  it('vybere nejtěžší známý trup, ne nejbližší', () => {
    const state = setup()
    state.ships[0].fireControl.mode = 'biggest'
    updateFireControl(state)
    expect(state.ships[0].fireControl.targetId).toBe(23) // DN 6,5 M t
  })

  it('po zničení nejtěžšího roluje na dalšího nejtěžšího', () => {
    const state = setup()
    const fc = state.ships[0].fireControl
    fc.mode = 'biggest'
    updateFireControl(state)
    expect(fc.targetId).toBe(23)
    state.ships[3].destroyed = true
    state.contacts.player = state.contacts.player.filter(c => c.shipId !== 23)
    updateFireControl(state)
    expect(fc.mode).toBe('biggest')
    expect(fc.targetId).toBe(22) // CL 130 kt > DD 75 kt
  })

  it('celá eskadra se koncentruje na stejný cíl', () => {
    const state = setup()
    const second = makeShip(2, 'ca-bastion', { pos: vec(0, 500_000) })
    state.ships.push(second)
    state.ships[0].fireControl.mode = 'biggest'
    second.fireControl.mode = 'biggest'
    updateFireControl(state)
    expect(state.ships[0].fireControl.targetId).toBe(23)
    expect(second.fireControl.targetId).toBe(23)
  })
})

describe('doktrína ROZDĚLIT', () => {
  it('lodě si cíle rozdělí — každá jiný', () => {
    const state = setup()
    const s2 = makeShip(2, 'ca-bastion', { pos: vec(0, 400_000) })
    const s3 = makeShip(3, 'ca-bastion', { pos: vec(0, 800_000) })
    state.ships.push(s2, s3)
    for (const sh of [state.ships[0], s2, s3]) sh.fireControl.mode = 'spread'
    updateFireControl(state)
    const targets = [state.ships[0], s2, s3].map(sh => sh.fireControl.targetId)
    expect(new Set(targets).size).toBe(3)
    expect(targets.every(t => [21, 22, 23].includes(t as number))).toBe(true)
  })

  it('víc lodí než cílů: přiřazení modulo (nikdo nezůstane bez cíle)', () => {
    const state = setup()
    // jen jeden nepřítel
    state.ships = state.ships.filter(sh => sh.id === 1 || sh.id === 21)
    state.contacts.player = state.contacts.player.filter(c => c.shipId === 21)
    const s2 = makeShip(2, 'ca-bastion', { pos: vec(0, 400_000) })
    state.ships.push(s2)
    state.ships[0].fireControl.mode = 'spread'
    s2.fireControl.mode = 'spread'
    updateFireControl(state)
    expect(state.ships[0].fireControl.targetId).toBe(21)
    expect(s2.fireControl.targetId).toBe(21)
  })
})

describe('společná pravidla doktrín', () => {
  it('paměťové piny se ignorují — na duchy se nestřílí', () => {
    const state = setup()
    // nejbližší kontakt je jen paměťový pin
    state.contacts.player[0].memory = true
    state.ships[0].fireControl.mode = 'nearest'
    updateFireControl(state)
    expect(state.ships[0].fireControl.targetId).toBe(22)
  })

  it('bez kandidátů: targetId null, režim zůstává (čeká na nový kontakt)', () => {
    const state = setup()
    state.contacts.player = []
    const fc = state.ships[0].fireControl
    fc.mode = 'nearest'
    fc.targetId = 21
    updateFireControl(state)
    expect(fc.targetId).toBeNull()
    expect(fc.mode).toBe('nearest')
  })

  it('kapitulovaný nepřítel není cíl', () => {
    const state = setup()
    state.ships[1].surrendered = true
    state.ships[0].fireControl.mode = 'nearest'
    updateFireControl(state)
    expect(state.ships[0].fireControl.targetId).toBe(22)
  })

  it('prázdné zásobníky doktrínu NEVYPÍNAJÍ (energie pálí dál)', () => {
    const state = setup()
    const shooter = state.ships[0]
    shooter.missiles = 0
    shooter.fireControl.mode = 'nearest'
    // cíl v dosahu energie → doktrína zůstává a energetická baterie vystřelí
    state.ships[1].pos = vec(300_000, 0)
    state.contacts.player[0].pos = state.ships[1].pos
    updateFireControl(state)
    expect(shooter.fireControl.mode).toBe('nearest')
    expect(shooter.energyCooldown).toBeGreaterThan(0) // baterie vystřelila
  })

  it('doktrína odpálí salvu na zvolený cíl v poháněné obálce', () => {
    const state = setup()
    state.ships[0].fireControl.mode = 'nearest'
    updateFireControl(state) // cíl 21 na 2 M km — v LO obálce
    expect(state.missiles.length).toBeGreaterThan(0)
    expect(state.missiles.every(m => m.targetId === 21)).toBe(true)
  })

  it('determinismus: dva běhy se stejným seedem jsou JSON-identické', () => {
    const run = (): string => {
      const state = setup()
      state.ships[0].fireControl.mode = 'biggest'
      for (let i = 0; i < 20; i++) {
        state.t += 0.5
        updateFireControl(state)
      }
      return JSON.stringify({ ships: state.ships, missiles: state.missiles, rng: state.rng })
    }
    expect(run()).toBe(run())
  })
})
