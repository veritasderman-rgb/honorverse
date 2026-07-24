/**
 * Vizuální identita mise (HW režim): hvězda soustavy (barva + pozice na
 * obrazovce = směr světla), mlhovina, atmosféra a nádech planet. Každá mise
 * vypadá jinak; plot z toho odvodí pozadí i směr nasvícení trupů.
 *
 * Pozice hvězdy je normalizovaná (0..1 přes obrazovku). Světlo trupů míří
 * od hvězdy — plot volá setLightDir(0.5 - star.x, 0.5 - star.y).
 */

export interface SceneDef {
  /** jádro hvězdy (nejjasnější) */
  starCore: string
  /** koróna hvězdy (přechod do mlhoviny) */
  starHalo: string
  /** normalizovaná pozice hvězdy na obrazovce (0..1) — i směr světla */
  star: { x: number; y: number }
  /** dvě barvy mlhovinových obláčků */
  nebA: string
  nebB: string
  /** atmosférický opar: nahoře → dole */
  atmTop: string
  atmBot: string
  /** barva plujícího prachu */
  dust: string
  /** nádech planetových těles v této soustavě */
  planet: string
}

/** ručně laděné scény per mise — výrazně odlišné nálady */
const SCENES: Record<string, SceneDef> = {
  // 1 — Strážná brána: chladný modrý wormhole terminál, hvězda nízko vlevo
  mission01: {
    starCore: '#dfe9ff', starHalo: '#4a6a9a', star: { x: 0.16, y: 0.7 },
    nebA: '#1c3a5a', nebB: '#243a6a', atmTop: '#1a2740', atmBot: '#05080f',
    dust: '#9fc4ff', planet: '#2d5a7a',
  },
  // 2 — Konvoj Pomezí: prašný soumrak na okraji soustavy, teplé slunce vpravo
  mission02: {
    starCore: '#fff2d0', starHalo: '#b8702e', star: { x: 0.78, y: 0.22 },
    nebA: '#5a3a1e', nebB: '#3a2a3a', atmTop: '#3a2a1c', atmBot: '#0a0710',
    dust: '#ffcf9a', planet: '#7a5a34',
  },
  // 3 — Q-ship (Cádiz): rudá imperiální mlhovina, nízké krvavé slunce
  mission03: {
    starCore: '#ffe0c0', starHalo: '#a83820', star: { x: 0.28, y: 0.62 },
    nebA: '#5a1e1e', nebB: '#3a1420', atmTop: '#3a1410', atmBot: '#0a0406',
    dust: '#ff9a7a', planet: '#7a3a2a',
  },
  // 4 — Tichý pozorovatel: studený fialový hlubinný stealth, hvězda daleko
  mission04: {
    starCore: '#e6d8ff', starHalo: '#5a3a8a', star: { x: 0.82, y: 0.14 },
    nebA: '#2a1c4a', nebB: '#1a244a', atmTop: '#1c1630', atmBot: '#04040a',
    dust: '#c0a0ff', planet: '#3a2a6a',
  },
  // 5 — Stanice Zeta: chladně zelená obranná soustava s planetou
  mission05: {
    starCore: '#e0fff0', starHalo: '#2a7a6a', star: { x: 0.7, y: 0.6 },
    nebA: '#123a34', nebB: '#1a3a4a', atmTop: '#12281f', atmBot: '#040a08',
    dust: '#9fffd0', planet: '#2a6a54',
  },
  // 6 — Ústup od Tharsis: doutnající červeň porážky, kouř
  mission06: {
    starCore: '#ffd0a0', starHalo: '#8a3018', star: { x: 0.2, y: 0.28 },
    nebA: '#4a1e14', nebB: '#3a2418', atmTop: '#301810', atmBot: '#080404',
    dust: '#ff8a5a', planet: '#6a3420',
  },
  // 7 — Zlatá flotila: zlatá imperiální nádhera, jasné slunce vysoko
  mission07: {
    starCore: '#fff6d8', starHalo: '#c88a2a', star: { x: 0.6, y: 0.12 },
    nebA: '#5a4418', nebB: '#4a3020', atmTop: '#3a2c14', atmBot: '#0a0806',
    dust: '#ffe08a', planet: '#7a5a2a',
  },
  // 8 — Kaledonská hvězda: jasná bílo-azurová hvězda, spojenecká soustava
  mission08: {
    starCore: '#f4fbff', starHalo: '#3a8aca', star: { x: 0.5, y: 0.16 },
    nebA: '#1c3a5a', nebB: '#2a4a6a', atmTop: '#182a3c', atmBot: '#05080f',
    dust: '#bfe6ff', planet: '#2a5a8a',
  },
  // 9 — Velká armáda (Avalon Prime): domovský soumrak, planeta v sázce
  mission09: {
    starCore: '#fff0d8', starHalo: '#a8683a', star: { x: 0.24, y: 0.2 },
    nebA: '#2a3a5a', nebB: '#4a3a3a', atmTop: '#2a2434', atmBot: '#06060e',
    dust: '#ffcf9a', planet: '#3a6a8a',
  },
  // 10 — Cádiz (finále): ohnivá oranžová bitva, nízké palčivé slunce
  mission10: {
    starCore: '#fff0c0', starHalo: '#c85020', star: { x: 0.5, y: 0.66 },
    nebA: '#6a2a14', nebB: '#4a2020', atmTop: '#3a1c10', atmBot: '#0a0505',
    dust: '#ffa060', planet: '#8a4020',
  },
  // 11 — Stěna bitvy (Avalon Prime): chladná modř, planeta jako pevný bod
  mission11: {
    starCore: '#eaf2ff', starHalo: '#3a5a9a', star: { x: 0.3, y: 0.18 },
    nebA: '#1c2c50', nebB: '#2a2c5a', atmTop: '#1a2038', atmBot: '#05070f',
    dust: '#bfd4ff', planet: '#2d5a7a',
  },
}

/** hash → [0,1) pro deterministické odvození barvy fallbacku */
function h01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

/**
 * Scéna pro misi. Pokud není v tabulce, odvodí ji deterministicky z id
 * (a volitelně ambientu), ať i budoucí mise dostanou vlastní nádech.
 */
export function sceneFor(id: string, ambient?: string): SceneDef {
  const s = SCENES[id]
  if (s) return s
  const hue = Math.floor(h01(id) * 360)
  const neb = `hsl(${hue}, 45%, 24%)`
  const nebB = `hsl(${(hue + 40) % 360}, 40%, 22%)`
  const warm = h01(id + 'x') > 0.5
  return {
    starCore: warm ? '#fff2d8' : '#e6f0ff',
    starHalo: `hsl(${hue}, 55%, 40%)`,
    star: { x: 0.3 + h01(id + 's') * 0.4, y: 0.14 + h01(id + 'y') * 0.5 },
    nebA: neb, nebB,
    atmTop: ambient ?? `hsl(${hue}, 30%, 16%)`,
    atmBot: '#05070d',
    dust: warm ? '#ffcf9a' : '#bfd4ff',
    planet: `hsl(${hue}, 40%, 34%)`,
  }
}
