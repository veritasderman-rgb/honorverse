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
  // boční operace mimo hlavní koridor — po každých ~3 misích jedna; nic na ně
  // neukazuje přes `requires`, takže nikdy neblokují postup kampaně
  { id: 'side01', x: 255, y: 585, requires: 'mission03', optional: true },
  { id: 'side02', x: 560, y: 235, requires: 'mission06', optional: true },
  { id: 'side03', x: 800, y: 480, requires: 'mission09', optional: true },
]

/** odměna za dokončenou boční operaci: plošiny NEBO kořistní loď do flotily */
export interface BonusReward {
  /** trvalé navýšení raketových plošin flotily pro další kampaňové mise */
  pods: number
  /** popis odměny do UI */
  label: string
  /** kořistní loď přidaná do flotily pro další kampaňové mise (jednou) */
  ship?: { classId: string; name: string }
}

/**
 * Odměny za boční operace (aplikuje se z `wob-cleared`). side01/side03 dávají
 * raketové plošiny; side02 (dobytý pirátský přístav) přidá do flotily kořistní
 * lehký křižník ANS Kaper — nese se pak do dalších kampaňových misí.
 */
export const BONUS_REWARD: Record<string, BonusReward> = {
  side01: { pods: 2, label: '+2 raketové plošiny pro flotilu' },
  side02: { pods: 0, label: 'kořistní křižník ANS Kaper do flotily', ship: { classId: 'cl-korzar', name: 'ANS Kaper' } },
  side03: { pods: 4, label: '+4 raketové plošiny pro flotilu' },
}

/** součet plošinové odměny za všechny dokončené boční operace */
export function podReward(cleared: readonly string[]): number {
  let n = 0
  for (const id of cleared) n += BONUS_REWARD[id]?.pods ?? 0
  return n
}

/** kořistní lodě za dokončené boční operace (do flotily dalších kampaňových misí) */
export function shipRewards(cleared: readonly string[]): { classId: string; name: string }[] {
  const out: { classId: string; name: string }[] = []
  for (const id of cleared) {
    const ship = BONUS_REWARD[id]?.ship
    if (ship) out.push(ship)
  }
  return out
}

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

/** hvězda galaktického pozadí: pozice, poloměr, jas (0..1) a barevný nádech */
export interface GalaxyStar { x: number; y: number; r: number; b: number; hue: number }

/**
 * Procedurální spirální galaxie na pozadí mapy — mise jsou jednotlivé soustavy
 * v jejích ramenech. Deterministické z pevného seedu (stabilní mezi rendery,
 * nezávislé na sim RNG). Dvě logaritmická ramena hustě u jádra, řídnoucí ven;
 * galaxie je zploštělá (pohled zešikma) a mírně natočená mimo osu koridoru.
 */
export const GALAXY: GalaxyStar[] = (() => {
  const rnd = mulberry32(0x47414c58) // "GALX"
  const stars: GalaxyStar[] = []
  const CX = 500, CY = 300
  const ARMS = 2
  const MAXR = 540
  const SQUASH = 0.6          // zploštění do elipsy (pohled zešikma)
  const WIND = 3.1            // vinutí ramen
  const N = 460
  for (let i = 0; i < N; i++) {
    const arm = i % ARMS
    const t = rnd() ** 1.3     // víc bodů blíž jádru
    const radius = 26 + t * MAXR
    // úhel podél ramene + rozostření ramene (u jádra užší)
    const spread = (rnd() - 0.5) * (0.5 + (radius / MAXR) * 0.7)
    const theta = arm * ((Math.PI * 2) / ARMS) + (radius / MAXR) * WIND + spread
    const jitter = (rnd() - 0.5) * (18 + radius * 0.14)
    const rr = radius + jitter
    const x = CX + Math.cos(theta) * rr
    const y = CY + Math.sin(theta) * rr * SQUASH
    // jas a velikost klesají ven; barva teplá u jádra, chladná na okraji
    const core = 1 - radius / MAXR
    const b = Math.max(0.12, core * (0.65 + rnd() * 0.35))
    const r = 0.4 + core * 1.7 + rnd() * 0.35
    const hue = 210 + core * 40 + (rnd() - 0.5) * 30  // 195(okraj)–250(jádro)
    stars.push({
      x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10,
      r: Math.round(r * 10) / 10, b: Math.round(b * 100) / 100,
      hue: Math.round(hue),
    })
  }
  // řídké vzdálené pole hvězd po celém rámu (mimo galaxii)
  for (let i = 0; i < 70; i++) {
    stars.push({
      x: Math.round(rnd() * 1000), y: Math.round(rnd() * 600),
      r: Math.round((0.3 + rnd() * 0.5) * 10) / 10,
      b: Math.round((0.14 + rnd() * 0.3) * 100) / 100,
      hue: 205 + Math.round((rnd() - 0.5) * 40),
    })
  }
  return stars
})()

/** natočení celé galaxie na mapě (stupně) — vizuálně mimo osu koridoru misí */
export const GALAXY_TILT = -16

/** mlhovinný prach v rovině galaxie (soft elipsy) — barevný nádech ramen */
export const NEBULAE: { x: number; y: number; rx: number; ry: number; hue: number }[] = [
  { x: 500, y: 300, rx: 470, ry: 250, hue: 250 }, // hlavní disk — fialová
  { x: 300, y: 340, rx: 240, ry: 150, hue: 205 }, // rameno — chladná modrá
]

/** je mise odemčená? (start nebo splněný požadavek); vyčištěné zůstávají hratelné */
export function isMissionUnlocked(id: string, cleared: readonly string[]): boolean {
  const n = CAMPAIGN_NODES.find(node => node.id === id)
  if (!n) return false
  return !n.requires || cleared.includes(n.requires)
}
