/**
 * EN mutace textu eventu: hlášky s voId přes VO_LINES_EN (titulky sedí na
 * EN audio), zprávy triggerů a popisky přes MISSION_TEXT_EN (přesný CS text
 * jako klíč). Česká data scénářů zůstávají kanonická; bez zásahu do simu.
 */
import { getLang } from '../ui/i18n'
import { VO_LINES_EN } from './voLinesEn'
import { MISSION_TEXT_EN } from './missionTextEn'
import type { SimEvent } from '../sim/types'

export function localizeEventText(ev: SimEvent): string {
  if (getLang() !== 'en') return ev.text
  return (ev.voId ? VO_LINES_EN[ev.voId] : undefined) ?? MISSION_TEXT_EN[ev.text] ?? ev.text
}
