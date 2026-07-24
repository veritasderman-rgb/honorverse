/**
 * Předmisijní loadout (B1): hráč před bojem zvolí zaměření výzbroje vlastních
 * lodí. Mění jen zásoby (rakety / protirakety / návnady / plošiny) přes klon
 * scénáře — spawnShip respektuje spec.missiles/cms/decoys/pods, simulace se
 * nemění. Volba se pamatuje v localStorage.
 */
import type { Scenario } from '../sim/types'
import { SHIP_CLASSES } from './defs'

export type LoadoutId = 'strike' | 'balanced' | 'defense'

export interface LoadoutPreset {
  id: LoadoutId
  label: string
  desc: string
  /** násobiče zásob vůči přídělu třídy */
  missiles: number
  cms: number
  decoys: number
  /** plošiny: 'full' = plný podCapacity, 'none' = žádné, 'default' = beze změny */
  pods: 'full' | 'none' | 'default'
}

export const LOADOUTS: LoadoutPreset[] = [
  {
    id: 'strike', label: 'Úderný',
    desc: 'Víc raket a plné plošiny, méně protiraket — sázka na proražení obrany.',
    missiles: 1.2, cms: 0.7, decoys: 0.7, pods: 'full',
  },
  {
    id: 'balanced', label: 'Vyvážený',
    desc: 'Standardní příděl výzbroje třídy — bez kompromisů.',
    missiles: 1, cms: 1, decoys: 1, pods: 'default',
  },
  {
    id: 'defense', label: 'Obranný',
    desc: 'Víc protiraket a návnad, méně útočných raket, bez plošin — přežití vlny.',
    missiles: 0.8, cms: 1.35, decoys: 1.35, pods: 'none',
  },
]

const KEY = 'wob-loadout'

export function loadPreset(): LoadoutId {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'strike' || v === 'balanced' || v === 'defense') return v
  } catch { /* noop */ }
  return 'balanced'
}

export function savePreset(id: LoadoutId): void {
  try { localStorage.setItem(KEY, id) } catch { /* noop */ }
}

export const presetById = (id: LoadoutId): LoadoutPreset =>
  LOADOUTS.find(l => l.id === id) ?? LOADOUTS[1]

/**
 * Aplikuje loadout na vlastní lodě scénáře (MUTUJE předaný klon — počítej
 * s tím, že voláš na kopii, ne na originálu). Škáluje zásoby vůči třídě.
 */
export function applyLoadout(scenario: Scenario, id: LoadoutId): void {
  if (id === 'balanced') return
  const p = presetById(id)
  for (const spec of scenario.ships) {
    if (spec.side !== 'player') continue
    const def = SHIP_CLASSES[spec.classId]
    if (!def) continue
    const baseMis = spec.missiles ?? def.magazineMissiles
    const baseCms = spec.cms ?? def.magazineCMs
    const baseDec = spec.decoys ?? def.decoyCount
    spec.missiles = Math.max(0, Math.round(baseMis * p.missiles))
    spec.cms = Math.max(0, Math.round(baseCms * p.cms))
    spec.decoys = Math.max(0, Math.round(baseDec * p.decoys))
    if (p.pods === 'full') spec.pods = def.podCapacity ?? 0
    else if (p.pods === 'none') spec.pods = 0
  }
}
