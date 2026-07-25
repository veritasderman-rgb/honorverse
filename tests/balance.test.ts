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

  it('loadout scénáře má přednost: kratší zásobník = nižší síla', () => {
    const full = shipPower({ classId: 'dn-ural', side: 'enemy' })
    const cut = shipPower({ classId: 'dn-ural', side: 'enemy', missiles: 100 })
    expect(cut).toBeLessThan(full)
  })

  it('hráčova loď táhne plný příděl plošin třídy (zrcadlí scenario.ts)', () => {
    const player = shipPower({ classId: 'dd-vichr', side: 'player' })
    const enemy = shipPower({ classId: 'dd-vichr', side: 'enemy' })
    expect(player).toBeGreaterThan(enemy) // + podCapacity × 1,2
  })

  it('posily ze spawn triggerů jsou v součtu (mise 2 má 3 pirátské trupy)', () => {
    expect(scenarioPower(SCENARIOS.mission02).enemyShips).toBe(3)
  })

  it('setSide zvrat: „záchranná" eskadra mise 6 se počítá nepříteli', () => {
    const p = scenarioPower(SCENARIOS.mission06)
    expect(p.enemyShips).toBe(5) // 3 pronásledovatelé + 2 převlečené návnady
    expect(p.playerShips).toBe(1)
  })
})

describe('pásma křivky (viz docs/DIFFICULTY.md)', () => {
  it('lehké mise 1–3: shovívavý úvod', () => {
    expect(ratio('mission01')).toBeGreaterThanOrEqual(1.8)
    expect(ratio('mission02')).toBeGreaterThanOrEqual(0.45) // přesila fázovaná v čase
    expect(ratio('mission02')).toBeLessThanOrEqual(0.85)
    expect(ratio('mission03')).toBeGreaterThanOrEqual(0.7)  // vyrovnaný duel s Q-shipem
    expect(ratio('mission03')).toBeLessThanOrEqual(1.2)
  })

  it('střední mise 5: první saturační obrana (stanice pomáhá)', () => {
    expect(ratio('mission05')).toBeGreaterThanOrEqual(0.55)
    expect(ratio('mission05')).toBeLessThanOrEqual(0.95)
  })

  it('těžké mise: 8 podvážená hlídka; 7 a 9 mají sílu, tlak dělá scénář', () => {
    expect(ratio('mission08')).toBeGreaterThanOrEqual(0.55)
    expect(ratio('mission08')).toBeLessThanOrEqual(0.95)
    // nájezd (7): síla hráče vysoká záměrně — obtížnost je časovka útěku
    expect(ratio('mission07')).toBeGreaterThanOrEqual(1.2)
    expect(ratio('mission07')).toBeLessThanOrEqual(2.0)
    // obrana Křižovatky (9): plošiny + stanice, tlak dělají dva sledy
    expect(ratio('mission09')).toBeGreaterThanOrEqual(1.0)
    expect(ratio('mission09')).toBeLessThanOrEqual(1.5)
  })

  it('finále: 10 hluboký úder do obrany, 11 papírová převaha (doktrína rozhoduje)', () => {
    expect(ratio('mission10')).toBeGreaterThanOrEqual(0.7)
    expect(ratio('mission10')).toBeLessThanOrEqual(1.1)
    expect(ratio('mission11')).toBeGreaterThanOrEqual(1.3)
    expect(ratio('mission11')).toBeLessThanOrEqual(1.8)
  })

  it('bonusy drží úroveň své trojice (side03 je silově snadná záměrně)', () => {
    expect(ratio('side01')).toBeGreaterThanOrEqual(1.0)  // po misi 3
    expect(ratio('side01')).toBeLessThanOrEqual(1.6)
    expect(ratio('side02')).toBeGreaterThanOrEqual(0.6)  // po misi 6
    expect(ratio('side02')).toBeLessThanOrEqual(1.1)
    expect(ratio('side03')).toBeGreaterThanOrEqual(2.0)  // závod s časem, ne síla
  })
})
