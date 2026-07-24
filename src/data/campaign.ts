/**
 * Hvězdná mapa kampaně: mise nejsou jen položky v seznamu, ale soustavy na
 * trase války mezi Avalonskou křižovatkou a imperiálním kotvištěm v Cádizu.
 * Každá soustava se odemkne až vyčištěním té předchozí (`requires`); volitelné
 * „boční operace" (`optional`) leží mimo hlavní hyperkoridor a nikdy neblokují
 * postup — nic na ně neukazuje přes `requires`.
 *
 * Souřadnice jsou v prostoru mapy 1000×600 (viewBox SVG). Data jsou čistá a
 * deterministická; vykreslení mapy žije v `showStarMap()` (src/main.ts).
 */

export interface CampaignNode {
  /** id mise = klíč v SCENARIOS */
  id: string
  /** pozice na mapě (0..1000, 0..600) */
  x: number
  y: number
  /** id mise, kterou je nutné vyčistit, aby se tahle odemkla (undefined = start) */
  requires?: string
  /** volitelná boční operace (mimo hlavní linii; neblokuje postup) */
  optional?: boolean
}

/**
 * Hlavní hyperkoridor kampaně (mission01 → mission11) plus boční operace.
 * Trasa se vine mapou od dolního levého rohu (Křižovatka, celní hlídka) do
 * pravého horního (Cádiz, finále). Pořadí `requires` = kampaňová posloupnost.
 */
export const CAMPAIGN_NODES: CampaignNode[] = [
  { id: 'mission01', x: 80, y: 520 },
  { id: 'mission02', x: 195, y: 445, requires: 'mission01' },
  { id: 'mission03', x: 300, y: 505, requires: 'mission02' },
  { id: 'mission04', x: 415, y: 410, requires: 'mission03' },
  { id: 'mission05', x: 520, y: 470, requires: 'mission04' },
  { id: 'mission06', x: 615, y: 360, requires: 'mission05' },
  { id: 'mission07', x: 705, y: 430, requires: 'mission06' },
  { id: 'mission08', x: 785, y: 300, requires: 'mission07' },
  { id: 'mission09', x: 855, y: 355, requires: 'mission08' },
  { id: 'mission10', x: 910, y: 200, requires: 'mission09' },
  { id: 'mission11', x: 945, y: 85, requires: 'mission10' },
]

/** deterministický PRNG (mulberry32) — hvězdné pozadí mapy bez závislostí */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Dekorativní hvězdné pole na pozadí mapy (deterministické z pevného seedu —
 * stabilní mezi rendery, nezávislé na sim RNG). Menší tečky = vzdálené hvězdy.
 */
export const STARFIELD: { x: number; y: number; r: number }[] = (() => {
  const rnd = mulberry32(0x5741_4c4c) // "WALL"
  const stars: { x: number; y: number; r: number }[] = []
  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.round(rnd() * 1000),
      y: Math.round(rnd() * 600),
      r: Math.round((0.3 + rnd() * 1.1) * 10) / 10,
    })
  }
  return stars
})()

/** mlhoviny na pozadí mapy (soft elipsy) — barevný nádech sektoru */
export const NEBULAE: { x: number; y: number; rx: number; ry: number; hue: number }[] = [
  { x: 250, y: 470, rx: 240, ry: 150, hue: 205 }, // Pomezí — chladná modrá
  { x: 780, y: 210, rx: 280, ry: 180, hue: 275 }, // hloubka sektoru — fialová
]

/** je mise odemčená? (start nebo splněný požadavek); vyčištěné zůstávají hratelné */
export function isMissionUnlocked(id: string, cleared: readonly string[]): boolean {
  const n = CAMPAIGN_NODES.find(node => node.id === id)
  if (!n) return false
  return !n.requires || cleared.includes(n.requires)
}
