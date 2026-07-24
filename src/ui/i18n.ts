/**
 * Lokalizace (i18n) — čeština / angličtina. Jazyk se určí z prohlížeče
 * (navigator.language) a jde ho ručně přepnout na úvodní obrazovce; volba se
 * pamatuje v localStorage. Překlady jsou ve slovníku po klíčích; `t(key)` vrací
 * text aktuálního jazyka (fallback čeština).
 *
 * FÁZE 1: úvodní obrazovka (hvězdná mapa, kampaňový úvod, příprava mise).
 * Herní HUD a příběh se dopřekládají v dalších vlnách — mechanismus je hotový.
 */
export type Lang = 'cs' | 'en'

const LANG_KEY = 'wob-lang'

/** detekce jazyka: uložená volba > prohlížeč (en* → en) > čeština */
function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'cs' || saved === 'en') return saved
  } catch { /* noop */ }
  try {
    const nav = (navigator.language || (navigator.languages && navigator.languages[0]) || 'cs').toLowerCase()
    return nav.startsWith('en') ? 'en' : 'cs'
  } catch { return 'cs' }
}

let current: Lang = detectLang()

export function getLang(): Lang { return current }

export function setLang(l: Lang): void {
  current = l
  try { localStorage.setItem(LANG_KEY, l) } catch { /* noop */ }
  try { document.documentElement.lang = l } catch { /* noop */ }
}

/** přepne jazyk a vrátí nový */
export function toggleLang(): Lang {
  setLang(current === 'cs' ? 'en' : 'cs')
  return current
}

/** slovník: klíč → { cs, en } */
const DICT: Record<string, { cs: string; en: string }> = {
  // hvězdná mapa / menu
  'map.title': { cs: 'HVĚZDNÁ MAPA', en: 'STAR CHART' },
  'map.progress': { cs: 'Postup kampaně:', en: 'Campaign progress:' },
  'map.systems': { cs: 'soustav', en: 'systems' },
  'map.tapHint': { cs: 'klepni na svítící soustavu a vpluj do mise.', en: 'tap a lit system to jump into its mission.' },
  'map.bonusHint': { cs: '★ = boční operace (odměnou plošiny nebo loď).', en: '★ = side op (reward: pods or a ship).' },
  'map.fromSideops': { cs: 'z bočních operací', en: 'from side ops' },
  'map.pods': { cs: 'plošin', en: 'pods' },
  'map.youAreHere': { cs: 'JSI ZDE', en: 'YOU ARE HERE' },
  'menu.story': { cs: '▸ PŘÍBĚH', en: '▸ STORY' },
  'menu.storyOpen': { cs: '▾ PŘÍBĚH', en: '▾ STORY' },
  'menu.hall': { cs: '▸ SÍŇ SLÁVY', en: '▸ HALL OF FAME' },
  'menu.hallOpen': { cs: '▾ SÍŇ SLÁVY', en: '▾ HALL OF FAME' },
  'menu.skirmish': { cs: '⚔ VOLNÁ BITVA', en: '⚔ SKIRMISH' },
  'menu.fleet': { cs: '⚓ SÍŇ FLOTILY', en: '⚓ FLEET HALL' },
  'menu.unlockAll': { cs: '🔓 ODEMKNOUT VŠE (test)', en: '🔓 UNLOCK ALL (test)' },
  'menu.unlockedAll': { cs: '🔓 VŠE ODEMČENO (test)', en: '🔓 ALL UNLOCKED (test)' },
  'menu.lang': { cs: '🌐 English', en: '🌐 Čeština' },
  // úvod kampaně
  'intro.title': { cs: 'WALL OF BATTLE — KAMPAŇ', en: 'WALL OF BATTLE — CAMPAIGN' },
  'intro.continue': { cs: 'POKRAČOVAT', en: 'CONTINUE' },
  // hall of fame
  'hall.loading': { cs: 'načítám…', en: 'loading…' },
  'hall.empty': { cs: 'Žebříček je zatím prázdný — buď první!', en: 'Leaderboard is empty — be the first!' },
  'hall.offline': { cs: 'Žebříček je nedostupný (offline?).', en: 'Leaderboard unavailable (offline?).' },
  'hall.captain': { cs: 'kapitán', en: 'captain' },
  'hall.points': { cs: 'body', en: 'points' },
  'hall.missions': { cs: 'misí', en: 'missions' },
}

/** překlad podle aktuálního jazyka (fallback čeština, pak samotný klíč) */
export function t(key: string): string {
  const e = DICT[key]
  if (!e) return key
  return e[current] ?? e.cs
}
