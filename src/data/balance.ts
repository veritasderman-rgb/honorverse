/**
 * Model bojové síly pro audit obtížnosti kampaně. HRUBÁ heuristika pro
 * porovnávání misí mezi sebou (ne pro simulaci): salvy, obrana, trup, plošiny.
 *
 * Zásady:
 * - civilové (bóje, SKUTEČNÍ obchodníci) sílu nemají,
 * - nepřátelé v masce `freighter` (Q-ship, spící stěna) SE počítají —
 *   triggery je v misi probouzejí,
 * - ozbrojená stanice se počítá vždy (nehybná pevnost je pořád pevnost).
 *
 * Tabulku všech misí generuje `npx tsx scripts/audit-difficulty.mts`
 * do docs/DIFFICULTY.md; pásma po úrovních hlídá tests/balance.test.ts.
 */
import { SHIP_CLASSES } from './defs'
import type { Scenario } from '../sim/types'

export interface ShipLike {
  classId: string
  side?: string
  doctrine?: string
  pods?: number
}

/** hrubá bojová síla lodi (0 pro civilisty) */
export function shipPower(s: ShipLike): number {
  const d = SHIP_CLASSES[s.classId]
  if (!d) return 0
  // ozbrojená stanice není civilista, i když „doktrínou" jen stojí (buoy)
  const armed = d.tubesPerBroadside > 0 || d.energyMountsPerBroadside > 0
  const civil = !armed || ((s.doctrine === 'buoy' || s.doctrine === 'freighter')
    && s.side !== 'enemy' && d.maxAccelG > 0)
  if (civil) return 0
  // salvy: šachty × vytrvalost zásobníku (cap 1,5), energetika poloviční vahou
  const offense = d.tubesPerBroadside
    * Math.min(1.5, d.magazineMissiles / Math.max(1, d.tubesPerBroadside * 20))
    + d.energyMountsPerBroadside * 0.5
  const defense = d.cmLaunchers * 0.4 + d.pdlcClusters * 0.25 + d.sidewallStrength / 60
  const hull = d.hullPoints / 100
  const pods = (s.pods ?? 0) * 1.2
  return offense + defense + hull + pods
}

export interface ScenarioPower {
  player: number
  enemy: number
  playerShips: number
  enemyShips: number
  /** P/E — vyšší = snazší; Infinity u misí bez bojujícího nepřítele */
  ratio: number
}

/** síla stran scénáře vč. posil ze spawnShip triggerů */
export function scenarioPower(sc: Scenario): ScenarioPower {
  const sum = { player: 0, enemy: 0 }
  const cnt = { player: 0, enemy: 0 }
  const add = (sh: ShipLike): void => {
    const side = sh.side
    if (side !== 'player' && side !== 'enemy') return
    const p = shipPower(sh)
    if (p <= 0) return
    sum[side] += p
    cnt[side]++
  }
  for (const sh of sc.ships) add(sh as unknown as ShipLike)
  for (const trg of sc.triggers ?? []) {
    for (const a of trg.actions ?? []) {
      if (a.kind === 'spawnShip') add(a.ship as unknown as ShipLike)
    }
  }
  return {
    player: sum.player, enemy: sum.enemy,
    playerShips: cnt.player, enemyShips: cnt.enemy,
    ratio: sum.enemy > 0 ? sum.player / sum.enemy : Infinity,
  }
}
