/**
 * Aplikace odměn z bočních operací (F) na scénář kampaňové mise. Mutuje předaný
 * KLON scénáře (počítej s tím, že voláš na kopii). Dvě složky:
 *   - plošiny: navýší raketové plošiny vlastních lodí (do kapacity třídy),
 *   - kořistní loď: přidá do flotily loď získanou v boční operaci (side02 →
 *     ANS Kaper), umístěnou vedle vlajkové lodi.
 * Vstup `cleared` = seznam dokončených misí (wob-cleared). Bez sim RNG.
 */
import type { Scenario } from '../sim/types'
import { SHIP_CLASSES } from './defs'
import { podReward, shipRewards } from './campaign'

/** rozestup kořistních lodí od vlajky (km) */
const REWARD_SPACING = 260_000

/** navýší plošiny vlastních lodí o plošinovou odměnu (kolo po kole do kapacity) */
function applyPodReward(scenario: Scenario, cleared: readonly string[]): void {
  let remaining = podReward(cleared)
  if (remaining <= 0) return
  const own = scenario.ships.filter(s => s.side === 'player')
  if (own.length === 0) return
  let progressed = true
  while (remaining > 0 && progressed) {
    progressed = false
    for (const spec of own) {
      if (remaining <= 0) break
      const cap = SHIP_CLASSES[spec.classId]?.podCapacity ?? 0
      const cur = spec.pods ?? 0
      if (cur < cap) { spec.pods = cur + 1; remaining--; progressed = true }
    }
  }
}

/** přidá kořistní lodě do flotily (vedle vlajky), pokud tam už nejsou */
function applyShipReward(scenario: Scenario, cleared: readonly string[]): void {
  const rewards = shipRewards(cleared)
  if (rewards.length === 0) return
  const flag = scenario.ships.find(s => s.side === 'player')
  if (!flag) return
  let placed = 0
  for (const r of rewards) {
    if (!SHIP_CLASSES[r.classId]) continue          // neznámá třída — přeskoč
    if (scenario.ships.some(s => s.name === r.name)) continue // už ve flotile
    placed++
    scenario.ships.push({
      classId: r.classId, side: 'player', name: r.name,
      // vedle vlajky, střídavě nad/pod, ať se nekryjí
      pos: {
        x: flag.pos.x - REWARD_SPACING * placed,
        y: flag.pos.y + REWARD_SPACING * placed * (placed % 2 === 0 ? -1 : 1),
      },
      vel: { ...flag.vel },
      heading: flag.heading ?? 0,
      doctrine: 'player',
      activeSensors: true,
      wedgeOn: true,
    })
  }
}

/**
 * Aplikuje všechny odměny bočních operací na klon scénáře. Voláno v přípravě
 * kampaňové mise (po veteránství a loadoutu).
 */
export function applyBonusRewards(scenario: Scenario, cleared: readonly string[]): void {
  applyPodReward(scenario, cleared)
  applyShipReward(scenario, cleared)
}
