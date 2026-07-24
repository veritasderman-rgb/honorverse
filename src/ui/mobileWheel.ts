/**
 * Mobilní M3: PALCOVÉ RADIÁLNÍ KOLO ROZKAZŮ. Lišta rozkazů má na telefonu
 * spoustu tlačítek — v zápalu boje se špatně trefuje. Kolo vytáhne 6 jádrových
 * akcí bojové smyčky (salva, plošiny, energie, kurz, klín, senzory) do velkého
 * palcového oblouku, který se vysune z jednoho tlačítka (FAB) v pravém dolním
 * rohu. Plná lišta zůstává pro vše ostatní.
 *
 * Tento modul nese jen ČISTOU logiku (které akce, jejich stav) bez DOM, aby
 * šla testovat v node prostředí. Akce míří na `data-act` — tedy stejnou
 * delegaci Panels jako lišta, žádné nové dráty. Vykreslení dělá MobileHud.
 */
import type { ShipState } from '../sim/types'

/** jedna akce kola — labelKey se překládá přes t() až při vykreslení */
export interface WheelAction {
  /** hodnota data-act (shodná s tlačítky lišty rozkazů) */
  act: string
  /** barvitelný glyf (ne emoji) */
  glyph: string
  /** i18n klíč popisku */
  labelKey: string
  /** volitelný počet za popiskem (plošiny) */
  count?: number
  /** zvýraznění zapnutého přepínače (klín/senzory/kurz) */
  active: boolean
  /** akce nedostupná (šedá, bez reakce) */
  disabled: boolean
}

/**
 * 6 jádrových akcí bojové smyčky pro palcové kolo. Čistá funkce — dostupnost
 * i zvýraznění počítá jen ze stavu vlastní lodi a toho, zda je vybraný cíl.
 */
export function wheelActions(own: ShipState | null, hasTarget: boolean, courseMode: boolean): WheelAction[] {
  const dead = !own || own.destroyed
  const canFire = !dead && hasTarget
  return [
    { act: 'salvoFull', glyph: '▤', labelKey: 'order.salvoFull', active: false, disabled: !(canFire && (own?.missiles ?? 0) > 0) },
    { act: 'launchPods', glyph: '⧉', labelKey: 'order.launchPods', count: own?.pods ?? 0, active: false, disabled: !(canFire && (own?.pods ?? 0) > 0) },
    { act: 'energy', glyph: '⚡', labelKey: 'order.energy', active: false, disabled: !canFire },
    { act: 'course', glyph: '➤', labelKey: 'order.course', active: courseMode, disabled: dead },
    { act: 'wedge', glyph: '⬡', labelKey: 'order.wedge', active: own?.wedgeOn === true, disabled: dead },
    { act: 'sensors', glyph: '◉', labelKey: 'order.sensors', active: own?.activeSensors === true, disabled: dead },
  ]
}
