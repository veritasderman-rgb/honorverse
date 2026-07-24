/**
 * Kariérní deník flotily (C1): přežité bitvy → veteránství, ztráta → památník,
 * veteránům se před misí vloží buff zámku (applyVeterancy klonuje scénář).
 * Spouštět: npx vitest run tests/fleetlog.test.ts
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { Scenario, ShipState, SimState } from '../src/sim/types'
import {
  applyVeterancy, loadFleet, recordMissionResult, resetFleet, tierOf,
} from '../src/ui/fleetlog'

// localStorage stub (vitest běží v node)
beforeEach(() => {
  const store = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    clear: () => store.clear(),
    key: () => null, length: 0,
  } as Storage
  resetFleet()
})

function stateWith(ships: Partial<ShipState>[]): SimState {
  return {
    t: 0, rng: { s: 1 }, nextId: 1, ships: ships as ShipState[], missiles: [],
    contacts: { player: [], enemy: [], neutral: [] }, events: [], pendingComms: [],
    flags: {}, objectives: [], outcome: 'win', scenarioId: 'mission01',
  }
}

describe('C1 — kariérní deník flotily', () => {
  it('tierOf: 0–1 nováček, 2–4 veterán, 5+ elita', () => {
    expect(tierOf(0)).toBe('rookie')
    expect(tierOf(1)).toBe('rookie')
    expect(tierOf(2)).toBe('veteran')
    expect(tierOf(4)).toBe('veteran')
    expect(tierOf(5)).toBe('elite')
  })

  it('přeživší loď sbírá bitvy, zničená jde do památníku', () => {
    const s1 = stateWith([
      { id: 1, side: 'player', classId: 'cl-sokol', name: 'ANS X', destroyed: false },
      { id: 2, side: 'player', classId: 'dd-vichr', name: 'ANS Y', destroyed: true },
      { id: 3, side: 'enemy', classId: 'dd-korzar', name: 'Pirát', destroyed: true },
    ])
    recordMissionResult(s1)
    recordMissionResult(stateWith([{ id: 1, side: 'player', classId: 'cl-sokol', name: 'ANS X', destroyed: false }]))
    const log = loadFleet()
    expect(log.ships['ANS X'].battles).toBe(2)   // přežil dvakrát → veterán
    expect(tierOf(log.ships['ANS X'].battles)).toBe('veteran')
    expect(log.ships['ANS Y']).toBeUndefined()   // zničen — mimo aktivní
    expect(log.lost.some(l => l.name === 'ANS Y')).toBe(true)
    expect(log.kills).toBe(1)
  })

  it('applyVeterancy vloží buff zámku veteránům a NEMĚNÍ originál', () => {
    for (let i = 0; i < 3; i++) {
      recordMissionResult(stateWith([{ id: 1, side: 'player', classId: 'cl-sokol', name: 'ANS X', destroyed: false }]))
    }
    const scenario = {
      id: 'mission01', title: 't', briefing: 'b', seed: 1, objectives: [], triggers: [],
      ships: [
        { classId: 'cl-sokol', side: 'player', name: 'ANS X', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'dd-vichr', side: 'player', name: 'ANS Nový', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
      ],
    } as Scenario
    const out = applyVeterancy(scenario)
    const vet = out.ships.find(s => s.name === 'ANS X')!
    const rookie = out.ships.find(s => s.name === 'ANS Nový')!
    expect((vet.buffs?.lockBonus ?? 0)).toBeGreaterThan(0)   // veterán má buff
    expect(rookie.buffs).toBeUndefined()                     // nováček bez buffu
    expect(scenario.ships[0].buffs).toBeUndefined()          // originál netknut
  })
})
