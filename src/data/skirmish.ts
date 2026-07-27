/**
 * Volná bitva (skirmish, E1): hráč složí obě flotily a spustí vlastní střet.
 * Scénář se generuje deterministicky z konfigurace a posílá workeru přímo
 * (bridge.startScenario) — vítězství/porážka přes shipsDestroyedCount.
 */
import type { Scenario, Side } from '../sim/types'
import { SHIP_CLASSES } from './defs'
import { getLang } from '../ui/i18n'

/** třídy nabízené ve stavbě bitvy — každá strana svou řadu (viz defs:
 *  Avalon = obrana a elektronika, Impérium = šířka salvy a zásobníky) */
export const SKIRMISH_CLASSES = [
  'dd-vichr', 'cl-sokol', 'ca-bastion', 'bc-praporec', 'dn-vladar',
] as const
export const SKIRMISH_CLASSES_ENEMY = [
  'dd-cadiz', 'cl-sevilla', 'ca-burgos', 'bc-aragon', 'dn-ural',
] as const

/** předvolby počáteční vzdálenosti flotil */
export const RANGE_PRESETS: { label: string; km: number }[] = [
  { label: 'Blízko · 1,5 M km', km: 1_500_000 },
  { label: 'Střed · 6 M km', km: 6_000_000 },
  { label: 'Daleko · 18 M km', km: 18_000_000 },
]

export interface SkirmishConfig {
  /** classId → počet lodí */
  player: Record<string, number>
  enemy: Record<string, number>
  /** počáteční vzdálenost flotil (km) */
  rangeKm: number
  /** seed simulace (determinismus) */
  seed: number
}

/** jmenné zásobníky stran — kódová jména (DD-1) měly obě flotily stejná
 *  a na plotu splývaly; vlastní jména strany odliší na první pohled */
const ROYAL_NAMES = [
  'Dauntless', 'Vigilant', 'Resolute', 'Krahujec', 'Ostříž', 'Bouře',
  'Břitva', 'Hradba', 'Koruna', 'Polednice', 'Vichřice', 'Meč',
]
const IMPERIAL_NAMES = [
  'Toledo', 'Sevilla', 'Córdoba', 'Granada', 'Aragon', 'Castilla',
  'Navarra', 'León', 'Murcia', 'Salamanca', 'Zaragoza', 'Burgos',
]

/** postaví jednu flotilu do stěny podél osy y na daném boku */
function fleet(side: Side, counts: Record<string, number>, xSign: number, rangeKm: number): Scenario['ships'] {
  const ships: Scenario['ships'] = []
  const entries = Object.entries(counts).filter(([, n]) => n > 0)
  const total = entries.reduce((s, [, n]) => s + n, 0)
  const x = xSign * rangeKm / 2
  const spacing = 240_000
  const y0 = -((total - 1) * spacing) / 2
  const prefix = side === 'player' ? 'ANS' : 'IDS'
  const pool = side === 'player' ? ROYAL_NAMES : IMPERIAL_NAMES
  const heading = xSign > 0 ? Math.PI : 0 // pravá strana míří vlevo a naopak
  let slot = 0
  let idx = 0
  for (const [classId, n] of entries) {
    for (let i = 0; i < n; i++) {
      const base = pool[idx % pool.length]
      const cycle = Math.floor(idx / pool.length)
      idx++
      ships.push({
        classId, side, name: `${prefix} ${base}${cycle > 0 ? ` ${cycle + 1}` : ''}`,
        pos: { x, y: y0 + slot * spacing }, vel: { x: 0, y: 0 },
        heading, doctrine: side === 'player' ? 'player' : 'hunter',
        activeSensors: true, wedgeOn: true, throttle: 0.6,
      })
      slot++
    }
  }
  return ships
}

/** součet lodí ve flotile */
export const fleetTotal = (counts: Record<string, number>): number =>
  Object.values(counts).reduce((s, n) => s + Math.max(0, n | 0), 0)

/** vygeneruje scénář volné bitvy z konfigurace */
export function buildSkirmish(cfg: SkirmishConfig): Scenario {
  const playerShips = fleet('player', cfg.player, -1, cfg.rangeKm)
  const enemyShips = fleet('enemy', cfg.enemy, 1, cfg.rangeKm)
  const enemyTotal = enemyShips.length
  const playerTotal = playerShips.length
  const en = getLang() === 'en'
  return {
    id: 'skirmish',
    title: en ? 'Skirmish' : 'Volná bitva',
    briefing: en
      ? `Training engagement: ${playerTotal} vs ${enemyTotal} ${enemyTotal === 1 ? 'ship' : 'ships'}.\n\n`
        + 'Build a fleet, pick the range and destroy the opponent. You command your own '
        + 'ships (squadron doctrines work as in the campaign); the enemy attacks on his own.'
      : `Cvičný střet: ${playerTotal} vs ${enemyTotal} ${enemyTotal === 1 ? 'loď' : 'lodí'}.\n\n`
        + 'Slož flotilu, zvol vzdálenost a znič protivníka. Ovládáš vlastní lodě '
        + '(doktríny eskadry funguje jako v kampani); nepřítel útočí sám.',
    seed: cfg.seed >>> 0,
    ships: [...playerShips, ...enemyShips],
    objectives: [{ id: 'win', text: en ? 'Destroy the enemy fleet' : 'Znič nepřátelskou flotilu', state: 'open' }],
    triggers: [
      {
        id: 'win', once: true,
        conditions: [{ kind: 'shipsDestroyedCount', side: 'enemy', count: enemyTotal }],
        actions: [
          { kind: 'objectiveComplete', objectiveId: 'win' },
          { kind: 'winMission', text: en ? 'Enemy fleet destroyed. Skirmish won.' : 'Nepřátelská flotila zničena. Volná bitva vyhrána.' },
        ],
      },
      {
        id: 'lose', once: true,
        conditions: [{ kind: 'shipsDestroyedCount', side: 'player', count: playerTotal }],
        actions: [{ kind: 'loseMission', text: en ? 'Your fleet is destroyed. Skirmish lost.' : 'Vaše flotila zničena. Volná bitva prohrána.' }],
      },
    ],
    ambient: '#12243a',
  }
}
