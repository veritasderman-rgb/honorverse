/**
 * Re-akvizice raket (A): když je cíl rakety zničen, raketa se místo zániku
 * stočí na nejbližšího nepřítele v dosahu (za cenu penalizace zámku), dokud
 * má manévrovací prostor (boost/ballistic). Bez cíle v dosahu → sebedestrukce.
 * Deterministické (žádné čerpání sim RNG).
 */
import { describe, expect, it } from 'vitest'
import type { MissileState, Scenario, SimState } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { REACQUIRE_RANGE, RETARGET_LOCK_PENALTY } from '../src/sim/constants'
import { updateMissiles } from '../src/sim/weapons'

/** scénář: hráč (id1) + dva nepřátelské obchodníci (id2, id3) */
function twoEnemies(bx: number): Scenario {
  return {
    id: 'test', title: 'T', briefing: '', seed: 7, objectives: [], triggers: [],
    ships: [
      { classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
      {
        classId: 'merch-freighter', side: 'enemy', name: 'A',
        pos: { x: 4_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
      },
      {
        classId: 'merch-freighter', side: 'enemy', name: 'B',
        pos: { x: bx, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
      },
    ],
  }
}

/** raketa letící na cíl `targetId`, poblíž nepřítele A */
function missileAt(targetId: number, over: Partial<MissileState> = {}): MissileState {
  return {
    id: 500, side: 'player', def: 'std-shipkiller',
    pos: { x: 3_500_000, y: 0 }, vel: { x: 100, y: 0 },
    targetId, mode: 0, driveRemaining: 0, phase: 'ballistic',
    lock: 0.9, salvoId: 1, autonomous: true, launchedAt: 0, ...over,
  }
}

const alive = (s: SimState, id: number): boolean =>
  s.missiles.some(m => m.id === id && m.phase !== 'dead')

describe('re-akvizice raket po zničení cíle', () => {
  it('cíl zničen, jiný nepřítel v dosahu → raketa se přesměruje (penalizace zámku)', () => {
    const state = sim.create(twoEnemies(6_000_000)) // B v dosahu re-akvizice
    state.ships.find(s => s.id === 2)!.destroyed = true // zničíme cíl A
    state.missiles.push(missileAt(2))
    const before = state.missiles[0].lock

    updateMissiles(state, 0.5)

    expect(alive(state, 500), 'raketa neměla zaniknout').toBe(true)
    const m = state.missiles.find(x => x.id === 500)!
    expect(m.targetId, 'raketa se měla stočit na nejbližšího nepřítele B (id3)').toBe(3)
    // penalizace za změnu směru se projevila (plus drobná balistická eroze v témže ticku)
    expect(m.lock).toBeLessThanOrEqual(before * RETARGET_LOCK_PENALTY + 1e-9)
    expect(m.lock).toBeGreaterThan(before * RETARGET_LOCK_PENALTY - 0.02)
  })

  it('cíl zničen, žádný jiný nepřítel v dosahu → sebedestrukce (cause lost)', () => {
    // B daleko za dosahem re-akvizice
    const state = sim.create(twoEnemies(REACQUIRE_RANGE + 20_000_000))
    state.ships.find(s => s.id === 2)!.destroyed = true
    state.missiles.push(missileAt(2))

    updateMissiles(state, 0.5)

    expect(alive(state, 500), 'bez cíle v dosahu má raketa zaniknout').toBe(false)
    expect(state.events.some(e => e.kind === 'missileMiss' && e.cause === 'lost')).toBe(true)
  })

  it('re-akvizice je deterministická (nečerpá sim RNG)', () => {
    const state = sim.create(twoEnemies(6_000_000))
    state.ships.find(s => s.id === 2)!.destroyed = true
    state.missiles.push(missileAt(2))
    const rngBefore = state.rng.s

    updateMissiles(state, 0.5)

    expect(state.rng.s, 're-akvizice nesmí měnit stav RNG').toBe(rngBefore)
  })

  it('terminální raketa se už nepřesměrovává (nemá manévrovací prostor)', () => {
    const state = sim.create(twoEnemies(6_000_000))
    state.ships.find(s => s.id === 2)!.destroyed = true
    state.missiles.push(missileAt(2, { phase: 'terminal' }))

    updateMissiles(state, 0.5)

    expect(alive(state, 500), 'terminální raketa má zaniknout, ne přesměrovat').toBe(false)
  })
})
