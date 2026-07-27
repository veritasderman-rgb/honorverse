/**
 * EN mutace textu eventu: hlášky s voId přes VO_LINES_EN (titulky sedí na
 * EN audio), zprávy triggerů a popisky přes MISSION_TEXT_EN (přesný CS text
 * jako klíč). Česká data scénářů zůstávají kanonická; bez zásahu do simu.
 */
import { getLang } from '../ui/i18n'
import { VO_LINES_EN } from './voLinesEn'
import { MISSION_TEXT_EN } from './missionTextEn'
import { SCENARIOS } from './missions'
import { objectiveTextEn } from './briefings'
import type { SimEvent } from '../sim/types'

/** CS text cíle → EN (líně z SCENARIOS × briefings; přidané cíle přes
 *  MISSION_TEXT_EN) — pro řádky logu „Objective complete: <cs>" */
let objCsToEn: Record<string, string> | null = null
const objMap = (): Record<string, string> => {
  if (objCsToEn) return objCsToEn
  objCsToEn = {}
  for (const [mid, sc] of Object.entries(SCENARIOS)) {
    for (const o of sc.objectives ?? []) {
      const en = objectiveTextEn(mid, o.id)
      if (en) objCsToEn[o.text] = en
    }
  }
  return objCsToEn
}

/** prefixy složených řádků logu: sim je při EN skládá anglicky, zbytek
 *  (text cíle z českých dat scénáře) domapujeme tady */
const OBJ_PREFIXES = ['Objective complete: ', 'Objective failed: ', 'New objective: ']

export function localizeEventText(ev: SimEvent): string {
  if (getLang() !== 'en') return ev.text
  const direct = (ev.voId ? VO_LINES_EN[ev.voId] : undefined) ?? MISSION_TEXT_EN[ev.text]
  if (direct) return direct
  for (const p of OBJ_PREFIXES) {
    if (!ev.text.startsWith(p)) continue
    const rest = ev.text.slice(p.length)
    return p + (objMap()[rest] ?? MISSION_TEXT_EN[rest] ?? rest)
  }
  return ev.text
}
