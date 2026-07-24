/**
 * Předmisijní loadout (B1): presety škálují zásoby vlastních lodí přes klon
 * scénáře (spawnShip respektuje spec.missiles/cms/decoys/pods).
 * Spouštět: npx vitest run tests/loadout.test.ts
 */
import { describe, expect, it } from 'vitest'
import type { Scenario } from '../src/sim/types'
import { applyLoadout } from '../src/data/loadout'
import { SHIP_CLASSES } from '../src/data/defs'

function scenario(): Scenario {
  return {
    id: 'mission01', title: 't', briefing: 'b', seed: 1, objectives: [], triggers: [],
    ships: [
      { classId: 'ca-bastion', side: 'player', name: 'ANS X', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
      { classId: 'dd-korzar', side: 'enemy', name: 'Pirát', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
    ],
  }
}

describe('B1 — předmisijní loadout', () => {
  const def = SHIP_CLASSES['ca-bastion']

  it('úderný: víc raket, míň protiraket, plné plošiny; nepřítel netknut', () => {
    const sc = scenario()
    applyLoadout(sc, 'strike')
    const own = sc.ships[0]
    expect(own.missiles!).toBeGreaterThan(def.magazineMissiles)
    expect(own.cms!).toBeLessThan(def.magazineCMs)
    expect(own.pods).toBe(def.podCapacity ?? 0)
    expect(sc.ships[1].missiles).toBeUndefined() // enemy beze změny
  })

  it('obranný: míň raket, víc protiraket a návnad, bez plošin', () => {
    const sc = scenario()
    applyLoadout(sc, 'defense')
    const own = sc.ships[0]
    expect(own.missiles!).toBeLessThan(def.magazineMissiles)
    expect(own.cms!).toBeGreaterThan(def.magazineCMs)
    expect(own.decoys!).toBeGreaterThan(def.decoyCount)
    expect(own.pods).toBe(0)
  })

  it('vyvážený: beze změny', () => {
    const sc = scenario()
    applyLoadout(sc, 'balanced')
    expect(sc.ships[0].missiles).toBeUndefined()
    expect(sc.ships[0].cms).toBeUndefined()
  })
})
