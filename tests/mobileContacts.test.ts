/**
 * Mobilní M2 — palcový proužek kontaktů: čistá logika výběru/formátu čipů
 * (mobileContactChips). Bez DOM (vitest běží v node), testujeme jen data.
 * Spouštět: npx vitest run tests/mobileContacts.test.ts
 */
import { describe, expect, it } from 'vitest'
import type { ShipState, SimState, Subsystems } from '../src/sim/types'
import type { UiState } from '../src/ui/panels'
import { mobileContactChips } from '../src/ui/mobileContacts'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'

function fullSubsystems(v = 1): Subsystems {
  return {
    impellerFwd: v, impellerAft: v, sidewallPort: v, sidewallStbd: v,
    tubesPort: v, tubesStbd: v, energyPort: v, energyStbd: v,
    pdlc: v, cm: v, sensors: v, ecm: v,
  }
}

function makeShip(id: number, over: Partial<ShipState> = {}): ShipState {
  const def = SHIP_CLASSES['ca-bastion']
  return {
    id, side: 'enemy', classId: 'ca-bastion', name: `loď ${id}`,
    pos: vec(0, 0), vel: vec(0, 0), heading: 0, throttle: 0, nav: null,
    wedgeOn: true, activeSensors: false, rolledTo: null,
    subsystems: fullSubsystems(),
    hull: def.hullPoints, missiles: 0, pods: 0, cms: 0,
    decoys: 0, decoyActive: false,
    tubeCooldown: 0, energyCooldown: 0, destroyed: false, doctrine: 'player',
    surrendered: false, lastSurrenderDemandAt: -1e9,
    fireControl: { mode: 'hold', targetId: null, salvoSize: 0, driveMode: 0, engaged: false },
    pendingWave: null,
    buffs: { lockBonus: 0, lockUntil: 0, repairBonus: 1, repairUntil: 0 },
    terminalTimes: [],
    ...over,
  }
}

function contact(shipId: number, over: Record<string, unknown> = {}): SimState['contacts']['player'][number] {
  return {
    shipId, pos: vec(0, 0), vel: vec(0, 0), classGuess: 'ca-bastion',
    idQuality: 2, age: 0, side: 'enemy', wedgeDetected: true, ...over,
  } as unknown as SimState['contacts']['player'][number]
}

function makeState(): SimState {
  return {
    t: 0, rng: { s: 1 }, nextId: 1000, ships: [], missiles: [],
    contacts: { player: [], enemy: [], neutral: [] }, events: [], pendingComms: [],
    flags: {}, objectives: [], outcome: 'running', scenarioId: 'test',
  }
}

function ui(over: Partial<UiState> = {}): UiState {
  return {
    ownShipId: 100, selectedShipIds: [100], targetId: null, courseMode: false,
    compression: 1, slowdownText: null, selectedSalvoId: null, autonomousMode: false,
    escortJammerMode: false, autoSlowEnabled: false, selectMode: false,
    report: {} as UiState['report'], ...over,
  }
}

describe('mobileContactChips — palcový proužek', () => {
  it('řadí podle vzdálenosti a ořezává na max', () => {
    const s = makeState()
    s.ships = [makeShip(100, { side: 'player', pos: vec(0, 0) })]
    s.contacts.player = [
      contact(1, { pos: vec(3_000_000, 0) }),
      contact(2, { pos: vec(1_000_000, 0) }),
      contact(3, { pos: vec(2_000_000, 0) }),
    ]
    const chips = mobileContactChips(s, ui(), 2)
    expect(chips).toHaveLength(2)
    expect(chips.map(c => c.shipId)).toEqual([2, 3]) // nejbližší první
    expect(chips[0].rangeKm).toBeCloseTo(1_000_000)
  })

  it('idQuality 0 = „?", od klasifikace kód třídy (hullCode)', () => {
    const s = makeState()
    s.ships = [makeShip(100, { side: 'player' })]
    s.contacts.player = [contact(1, { idQuality: 0 }), contact(2, { idQuality: 2, pos: vec(500_000, 0) })]
    const chips = mobileContactChips(s, ui())
    const c1 = chips.find(c => c.shipId === 1)!
    const c2 = chips.find(c => c.shipId === 2)!
    expect(c1.code).toBe('?')
    expect(c2.code).toBe('CA')
  })

  it('radiální rychlost určuje blízkost: přibližuje/drží/vzdaluje', () => {
    const s = makeState()
    s.ships = [makeShip(100, { side: 'player', pos: vec(0, 0) })]
    s.contacts.player = [
      contact(1, { pos: vec(1_000_000, 0), vel: vec(-100, 0) }), // letí k nám
      contact(2, { pos: vec(2_000_000, 0), vel: vec(0, 50) }),   // kolmo → drží
      contact(3, { pos: vec(3_000_000, 0), vel: vec(100, 0) }),  // vzdaluje se
    ]
    const chips = mobileContactChips(s, ui())
    expect(chips.find(c => c.shipId === 1)!.threat).toBe('closing')
    expect(chips.find(c => c.shipId === 2)!.threat).toBe('holding')
    expect(chips.find(c => c.shipId === 3)!.threat).toBe('opening')
  })

  it('označí zaměřený cíl a kapitulaci', () => {
    const s = makeState()
    s.ships = [
      makeShip(100, { side: 'player' }),
      makeShip(1, { surrendered: true }),
    ]
    s.contacts.player = [contact(1)]
    const chips = mobileContactChips(s, ui({ targetId: 1 }))
    expect(chips[0].selected).toBe(true)
    expect(chips[0].surrendered).toBe(true)
  })

  it('bez vlastní lodi počítá vzdálenost od počátku (nespadne)', () => {
    const s = makeState()
    s.contacts.player = [contact(1, { pos: vec(400_000, 0) })]
    const chips = mobileContactChips(s, ui({ ownShipId: null }))
    expect(chips).toHaveLength(1)
    expect(chips[0].rangeKm).toBeCloseTo(400_000)
  })
})
