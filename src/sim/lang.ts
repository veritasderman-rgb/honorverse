/**
 * Jazyk simulace: worker ho dostane při init/restore (UI mu ho posílá dle
 * getLang()). Sim pak dynamické texty eventů skládá rovnou v cílovém jazyce
 * přes L(cs, en) — texty s voId řeší UI mapou VO_LINES_EN (titulky sedí na
 * audio), tady jde o texty s interpolací (jména lodí, procenta, časy).
 * Žádný import z ui/ — worker nemá localStorage ani DOM.
 */
export type SimLang = 'cs' | 'en'

let simLang: SimLang = 'cs'

export function setSimLang(lang: SimLang): void {
  simLang = lang
}

/** text dle jazyka simu */
export const L = (cs: string, en: string): string => (simLang === 'en' ? en : cs)

/** anglické názvy subsystémů (CS názvy drží SUBSYSTEM_NAMES v constants) */
const SUBSYS_EN: Record<string, string> = {
  impellerFwd: 'forward impeller', impellerAft: 'aft impeller',
  sidewallPort: 'port sidewall', sidewallStbd: 'starboard sidewall',
  tubesPort: 'port tubes', tubesStbd: 'starboard tubes',
  energyPort: 'port energy mounts', energyStbd: 'starboard energy mounts',
  pdlc: 'PDLC', cm: 'counter-missile launchers', sensors: 'sensors', ecm: 'ECM',
}

/** název subsystému dle jazyka simu (fallback: klíč) */
export function subsysL(csNames: Record<string, string>, key: string): string {
  return simLang === 'en' ? (SUBSYS_EN[key] ?? key) : (csNames[key] ?? key)
}

/** anglické názvy tříd pro hlášky simu (jen kde sim jmenuje třídu) */
const CLASS_EN: Record<string, string> = {
  'dd-vichr': 'Vichr class', 'cl-sokol': 'Sokol class', 'ca-bastion': 'Bastion class',
  'bc-praporec': 'Praporec class', 'dn-vladar': 'Vladař class', 'dn-ural': 'Toledo class',
  'merch-freighter': 'freighter', 'merch-qship': 'armed auxiliary (Q-ship)',
  'merch-runner': 'freighter (?)', 'disp-courier': 'dispatch courier',
  'station-zeta': 'orbital station', 'cl-korzar': 'Korzár class', 'dd-korzar': 'pirate sloop',
  'probe': 'probe', 'planet': 'planet',
}

/** jméno třídy dle jazyka simu (fallback: český název z defs) */
export function classNameL(classId: string, csName: string): string {
  return simLang === 'en' ? (CLASS_EN[classId] ?? csName) : csName
}
