/**
 * Kariérní deník flotily (C1): vlastní lodě si mezi misemi kampaně nesou
 * ZKUŠENOST (přežité bitvy → veteránství) a ztráta lodi je TRVALÁ (památník).
 * Veteránská posádka střílí těsnější salvy (vyšší počáteční zámek raket).
 *
 * Perzistence: localStorage. Aplikace: klonujeme scénář mise a veteránům
 * vložíme buffy (spawnShip respektuje spec.buffs) — simulace se nemění.
 * Skirmish (volná bitva) se do deníku nezapočítává.
 */
import type { Scenario, SimState } from '../sim/types'

const KEY = 'wob-fleet'

export type VetTier = 'rookie' | 'veteran' | 'elite'

interface FleetShip { classId: string; battles: number }

export interface FleetLog {
  /** aktivní lodě podle jména → záznam kariéry */
  ships: Record<string, FleetShip>
  /** památník ztracených lodí */
  lost: { name: string; classId: string }[]
  /** celkem zničených nepřátel napříč kampaní (jen pro statistiku) */
  kills: number
}

const empty = (): FleetLog => ({ ships: {}, lost: [], kills: 0 })

export function loadFleet(): FleetLog {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    const p = JSON.parse(raw) as Partial<FleetLog>
    return { ships: p.ships ?? {}, lost: p.lost ?? [], kills: p.kills ?? 0 }
  } catch { return empty() }
}

function save(log: FleetLog): void {
  try { localStorage.setItem(KEY, JSON.stringify(log)) } catch { /* noop */ }
}

export function resetFleet(): void {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
}

/** veteránská hodnost podle počtu přežitých bitev */
export function tierOf(battles: number): VetTier {
  if (battles >= 5) return 'elite'
  if (battles >= 2) return 'veteran'
  return 'rookie'
}

export const TIER_LABEL: Record<VetTier, string> = {
  rookie: 'nováček', veteran: 'veterán', elite: 'elita',
}

/** buff zámku raket dle hodnosti (permanentní — lockUntil daleko v budoucnu) */
function tierLockBonus(tier: VetTier): number {
  return tier === 'elite' ? 0.1 : tier === 'veteran' ? 0.05 : 0
}

/**
 * Zapíše výsledek KAMPAŇOVÉ mise do deníku: přeživší vlastní lodě +1 bitva,
 * zničené do památníku. Voláno jednou po skončení mise (ne pro skirmish).
 */
export function recordMissionResult(state: SimState): void {
  const log = loadFleet()
  const own = state.ships.filter(s => s.side === 'player')
  for (const sh of own) {
    if (sh.destroyed) {
      // ztráta: z aktivních pryč, do památníku (jednou)
      delete log.ships[sh.name]
      if (!log.lost.some(l => l.name === sh.name)) {
        log.lost.push({ name: sh.name, classId: sh.classId })
      }
    } else {
      const rec = log.ships[sh.name] ?? { classId: sh.classId, battles: 0 }
      rec.battles += 1
      rec.classId = sh.classId
      log.ships[sh.name] = rec
      // přeživší už není v památníku (scénáře jsou pevné — udrž konzistenci)
      log.lost = log.lost.filter(l => l.name !== sh.name)
    }
  }
  log.kills += state.ships.filter(s => s.side === 'enemy' && s.destroyed).length
  save(log)
}

/**
 * Vrátí KLON scénáře s veteránskými buffy na odpovídajících vlastních lodích
 * (podle jména). Nemění originál. Pro kampaňové mise před startem.
 */
export function applyVeterancy(scenario: Scenario): Scenario {
  const log = loadFleet()
  const clone: Scenario = structuredClone(scenario)
  for (const spec of clone.ships) {
    if (spec.side !== 'player') continue
    const rec = log.ships[spec.name]
    if (!rec) continue
    const tier = tierOf(rec.battles)
    const bonus = tierLockBonus(tier)
    if (bonus <= 0) continue
    spec.buffs = {
      lockBonus: bonus,
      lockUntil: 1e12,                         // prakticky permanentní
      repairBonus: tier === 'elite' ? 1.4 : 1, // elita opravuje rychleji
      repairUntil: tier === 'elite' ? 1e12 : 0,
    }
  }
  return clone
}

/** hodnost lodi podle jména (pro HUD štítek v rosteru) — null = nováček/neznámá */
export function shipTier(name: string): VetTier | null {
  const rec = loadFleet().ships[name]
  if (!rec) return null
  const t = tierOf(rec.battles)
  return t === 'rookie' ? null : t
}
