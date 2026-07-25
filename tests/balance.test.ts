/**
 * Obtížnostní křivka: model bojové síly (balance.ts) + pásma poměru P/E
 * po úrovních. Chrání křivku před tichou regresí při úpravách misí —
 * detaily a tabulka v docs/DIFFICULTY.md.
 * Spouštět: npx vitest run tests/balance.test.ts
 */
import { describe, expect, it } from 'vitest'
import { scenarioPower, shipPower } from '../src/data/balance'
import { SCENARIOS } from '../src/data/missions'

const ratio = (id: string): number => scenarioPower(SCENARIOS[id]).ratio

describe('model síly', () => {
  it('ozbrojená stanice se počítá i jako „buoy" na straně hráče', () => {
    expect(shipPower({ classId: 'station-zeta', side: 'player', doctrine: 'buoy' })).toBeGreaterThan(20)
  })

  it('nepřítel v masce obchodníka (Q-ship) se počítá, skutečný obchodník ne', () => {
    expect(shipPower({ classId: 'merch-qship', side: 'enemy', doctrine: 'freighter' })).toBeGreaterThan(5)
    expect(shipPower({ classId: 'merch-freighter', side: 'player', doctrine: 'freighter' })).toBe(0)
    expect(shipPower({ classId: 'probe', side: 'neutral', doctrine: 'buoy' })).toBe(0)
  })

  it('posily ze spawn triggerů jsou v součtu (mise 2 má 3 pirátské trupy)', () => {
    expect(scenarioPower(SCENARIOS.mission02).enemyShips).toBe(3)
  })
})

describe('pásma křivky (viz docs/DIFFICULTY.md)', () => {
  it('lehké mise 1–3: shovívavé, klesající', () => {
    expect(ratio('mission01')).toBeGreaterThanOrEqual(1.5)
    expect(ratio('mission02')).toBeGreaterThanOrEqual(0.4) // přesila fázovaná v čase
    expect(ratio('mission02')).toBeLessThanOrEqual(0.8)
    expect(ratio('mission03')).toBeGreaterThanOrEqual(0.55)
    expect(ratio('mission03')).toBeLessThanOrEqual(1.0)
  })

  it('střední mise 5: první saturační obrana (stanice pomáhá)', () => {
    expect(ratio('mission05')).toBeGreaterThanOrEqual(0.5)
    expect(ratio('mission05')).toBeLessThanOrEqual(0.9)
  })

  it('těžké mise 7–10: poměr 0,5–0,95 + tlak scénáře', () => {
    for (const id of ['mission07', 'mission08', 'mission09', 'mission10']) {
      expect(ratio(id), `${id} mimo pásmo`).toBeGreaterThanOrEqual(0.5)
      expect(ratio(id), `${id} mimo pásmo`).toBeLessThanOrEqual(0.95)
    }
    // celá těžká úroveň je pod úvodní misí výcviku
    for (const id of ['mission07', 'mission08', 'mission09', 'mission10']) {
      expect(ratio(id)).toBeLessThan(ratio('mission01'))
    }
  })

  it('finále 11 (simulátor): mírná převaha hráče, rozhoduje doktrína', () => {
    expect(ratio('mission11')).toBeGreaterThanOrEqual(0.9)
    expect(ratio('mission11')).toBeLessThanOrEqual(1.4)
  })

  it('bonusy drží úroveň své trojice (side03 je silově snadná záměrně)', () => {
    expect(ratio('side01')).toBeGreaterThanOrEqual(0.8)  // po misi 3
    expect(ratio('side02')).toBeGreaterThanOrEqual(0.5)  // po misi 6
    expect(ratio('side02')).toBeLessThanOrEqual(1.0)
    expect(ratio('side03')).toBeGreaterThanOrEqual(1.5)  // závod s časem, ne síla
  })
})
