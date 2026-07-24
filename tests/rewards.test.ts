/**
 * Odměny z bočních operací (F): plošiny navýší vlastní lodě do kapacity;
 * kořistní loď (side02 → ANS Kaper) se přidá do flotily vedle vlajky, jednou.
 * Aplikuje se na klon scénáře; bez sim RNG.
 */
import { describe, expect, it } from 'vitest'
import type { Scenario } from '../src/sim/types'
import { applyBonusRewards } from '../src/data/rewards'
import { BONUS_REWARD } from '../src/data/campaign'
import { SHIP_CLASSES } from '../src/data/defs'

function scenario(): Scenario {
  return {
    id: 'test', title: 'T', briefing: '', seed: 1, objectives: [], triggers: [],
    ships: [
      { classId: 'ca-bastion', side: 'player', name: 'ANS Flag', pos: { x: 1_000, y: 2_000 }, vel: { x: 300, y: 0 } },
      { classId: 'cl-korzar', side: 'enemy', name: 'Pirát', pos: { x: 9_000_000, y: 0 }, vel: { x: 0, y: 0 } },
    ],
  }
}

describe('applyBonusRewards — kořist z bočních operací', () => {
  it('bez dokončených operací scénář nemění', () => {
    const sc = scenario()
    applyBonusRewards(sc, [])
    expect(sc.ships).toHaveLength(2)
    expect(sc.ships[0].pods ?? 0).toBe(0)
  })

  it('side01 (plošiny) navýší vlastní lodě do kapacity třídy', () => {
    const sc = scenario()
    applyBonusRewards(sc, ['side01'])
    const cap = SHIP_CLASSES['ca-bastion'].podCapacity ?? 0
    expect(sc.ships[0].pods).toBe(Math.min(BONUS_REWARD.side01.pods, cap))
    expect(sc.ships).toHaveLength(2) // žádná loď navíc
  })

  it('side02 přidá kořistní loď ANS Kaper do flotily vedle vlajky', () => {
    const sc = scenario()
    applyBonusRewards(sc, ['side02'])
    const prize = sc.ships.find(s => s.name === 'ANS Kaper')
    expect(prize, 'ANS Kaper má být ve flotile').toBeDefined()
    expect(prize!.side).toBe('player')
    expect(prize!.classId).toBe(BONUS_REWARD.side02.ship!.classId)
    expect(prize!.doctrine).toBe('player')
    // umístěná poblíž vlajky (ne na jejích souřadnicích)
    expect(prize!.pos).not.toEqual(sc.ships[0].pos)
  })

  it('kořistní loď se nepřidá dvakrát (opětovná aplikace / už ve flotile)', () => {
    const sc = scenario()
    applyBonusRewards(sc, ['side02'])
    applyBonusRewards(sc, ['side02'])
    expect(sc.ships.filter(s => s.name === 'ANS Kaper')).toHaveLength(1)
  })

  it('všechny odměny naráz: plošiny i kořistní loď', () => {
    const sc = scenario()
    applyBonusRewards(sc, ['side01', 'side02', 'side03'])
    expect(sc.ships.some(s => s.name === 'ANS Kaper')).toBe(true)
    expect((sc.ships[0].pods ?? 0)).toBeGreaterThan(0) // plošiny z side01+side03
  })
})
