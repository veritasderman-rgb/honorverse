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
  id?: number
  classId: string
  side?: string
  doctrine?: string
  pods?: number
  missiles?: number
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
  // zásobník: loadout scénáře (spec.missiles) má přednost před třídou —
  // mise 11 např. imperiálům schválně krátí zásobníky (zrcadlí sim/scenario.ts)
  const mag = s.missiles ?? d.magazineMissiles
  // salvy: šachty × vytrvalost zásobníku (cap 1,5), energetika poloviční vahou
  const offense = d.tubesPerBroadside
    * Math.min(1.5, mag / Math.max(1, d.tubesPerBroadside * 20))
    + d.energyMountsPerBroadside * 0.5
  const defense = d.cmLaunchers * 0.4 + d.pdlcClusters * 0.25 + d.sidewallStrength / 60
  const hull = d.hullPoints / 100
  // plošiny: hráčova strana táhne plný příděl třídy, když scénář neurčí
  // jinak (zrcadlí sim/scenario.ts — AI plošiny nedostává)
  const pods = (s.pods ?? (s.side === 'player' ? d.podCapacity ?? 0 : 0)) * 1.2
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

/** síla stran scénáře vč. posil ze spawnShip triggerů a zvratů setSide */
export function scenarioPower(sc: Scenario): ScenarioPower {
  // posbírej lodě: počáteční dostávají id = pořadí od 1 (sim/scenario.ts
  // přiděluje nextId++), spawnuté smí nést pevné spec.id
  const ships: { spec: ShipLike; finalSide?: string }[] = sc.ships.map((sh, i) => {
    const spec = sh as unknown as ShipLike
    return { spec: { ...spec, id: spec.id ?? i + 1 }, finalSide: spec.side }
  })
  for (const trg of sc.triggers ?? []) {
    for (const a of trg.actions ?? []) {
      if (a.kind === 'spawnShip') {
        const spec = a.ship as unknown as ShipLike
        ships.push({ spec: { ...spec }, finalSide: spec.side })
      }
    }
  }
  // ZVRATY: setSide mění stranu PŘED součtem — převlečené lodě (mise 6:
  // „záchranná" eskadra spawnutá jako hráčovi obchodníci → nepřátelští lovci)
  // se počítají za svou KONEČNOU stranu; sílu (plošiny dle strany při
  // vytvoření) si nesou s sebou
  for (const trg of sc.triggers ?? []) {
    for (const a of trg.actions ?? []) {
      if (a.kind === 'setSide') {
        const t = ships.find(s => s.spec.id === a.shipId)
        if (t) t.finalSide = a.side
      }
    }
  }
  const sum = { player: 0, enemy: 0 }
  const cnt = { player: 0, enemy: 0 }
  for (const { spec, finalSide } of ships) {
    if (finalSide !== 'player' && finalSide !== 'enemy') continue
    // maska civilisty se vyhodnocuje vůči KONEČNÉ straně (odhalený Q-ship
    // bojuje), síla vůči stavu při vytvoření (zásobníky, plošiny)
    const p = shipPower({ ...spec, side: finalSide })
    if (p <= 0) continue
    sum[finalSide] += p
    cnt[finalSide]++
  }
  return {
    player: sum.player, enemy: sum.enemy,
    playerShips: cnt.player, enemyShips: cnt.enemy,
    ratio: sum.enemy > 0 ? sum.player / sum.enemy : Infinity,
  }
}
