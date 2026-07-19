/**
 * Poškození: bočníky, trup, subsystémy (viz GAME_DESIGN.md kap. 5).
 * Lodě umírají po částech — žádný prostý HP bar.
 */
import type { ShipState, SimState, Subsystems } from './types'
import { REPAIR_CAP, REPAIR_RATE } from './constants'
import { SHIP_CLASSES } from '../data/defs'
import { rand } from './rng'
import { voiceOwnHit } from './voice'

export type Aspect = 'throat' | 'kilt' | 'port' | 'stbd'

/** České názvy subsystémů pro eventy (sdílí i crew.ts). */
export const SUBSYSTEM_NAMES: Record<keyof Subsystems, string> = {
  impellerFwd: 'přední impelerový prstenec',
  impellerAft: 'zadní impelerový prstenec',
  sidewallPort: 'levý bočník',
  sidewallStbd: 'pravý bočník',
  tubesPort: 'raketové šachty (levobok)',
  tubesStbd: 'raketové šachty (pravobok)',
  energyPort: 'energetické zbraně (levobok)',
  energyStbd: 'energetické zbraně (pravobok)',
  pdlc: 'bodová obrana',
  cm: 'odpalovače protiraket',
  sensors: 'senzory',
  ecm: 'elektronický boj',
}

const SUBSYSTEM_KEYS = Object.keys(SUBSYSTEM_NAMES) as (keyof Subsystems)[]

/** Počet funkčních šachet (lepší bok, zaokrouhleno dolů). */
export function effectiveTubes(ship: ShipState): number {
  const def = SHIP_CLASSES[ship.classId]
  const best = Math.max(ship.subsystems.tubesPort, ship.subsystems.tubesStbd)
  return Math.floor(def.tubesPerBroadside * best)
}

/** Faktor akcelerace dle stavu impelerů (průměr obou prstenců). */
export function effectiveAccelFactor(ship: ShipState): number {
  return (ship.subsystems.impellerFwd + ship.subsystems.impellerAft) / 2
}

/**
 * Aplikuje jeden paprsek (laserová tyč hlavice / energetický mount).
 * Boky: bočník odečte práh (slabý paprsek pohltí celý).
 * Hrdlo: bez bočníku, ·1.25. Záď: bez bočníku, bonus šance na zadní impeler.
 */
export function applyBeamDamage(
  state: SimState,
  target: ShipState,
  rawDamage: number,
  aspect: Aspect,
): void {
  if (target.destroyed || rawDamage <= 0) return
  const def = SHIP_CLASSES[target.classId]

  let dmg = rawDamage
  if (aspect === 'port' || aspect === 'stbd') {
    const wall = aspect === 'port' ? target.subsystems.sidewallPort : target.subsystems.sidewallStbd
    const threshold = def.sidewallStrength * wall
    if (dmg <= threshold) return // bočník paprsek pohltil
    dmg -= threshold
  } else if (aspect === 'throat') {
    dmg *= 1.25 // otevřené hrdlo klínu
  }

  target.hull -= dmg

  // hláska posádky hráče: lehký (inženýr) / těžký (XO) zásah — jednou per typ
  voiceOwnHit(state, target, dmg)

  // Zásah subsystémů: šance úměrná prošlému poškození, 1–2 systémy.
  if (rand(state.rng) < Math.min(1, dmg / 45)) {
    const nHits = rand(state.rng) < 0.35 ? 2 : 1
    for (let i = 0; i < nHits; i++) {
      let key: keyof Subsystems
      if (aspect === 'kilt' && i === 0 && rand(state.rng) < 0.4) {
        key = 'impellerAft' // zásah do zádi ohrožuje zadní prstenec
      } else {
        key = SUBSYSTEM_KEYS[Math.floor(rand(state.rng) * SUBSYSTEM_KEYS.length)]
      }
      const loss = 0.15 + rand(state.rng) * 0.25
      const prev = target.subsystems[key]
      target.subsystems[key] = Math.max(0, target.subsystems[key] - loss)
      state.events.push({
        t: state.t,
        kind: 'subsystemHit',
        shipId: target.id,
        side: target.side,
        text: `${target.name}: zásah — ${SUBSYSTEM_NAMES[key]} (${Math.round(target.subsystems[key] * 100)} %)`,
      })
      // hlášení inženýra hráči při prvním poškození subsystému (s odhadem opravy)
      if (target.side === 'player' && prev >= 1 && target.subsystems[key] < 1) {
        const v = target.subsystems[key]
        const text = v < REPAIR_CAP
          ? `Inženýr: ${SUBSYSTEM_NAMES[key]} — poškození na ${Math.round(v * 100)} %, `
            + `provizorní oprava ~${Math.max(1, Math.round((REPAIR_CAP - v) / REPAIR_RATE / 60))} min.`
          : `Inženýr: ${SUBSYSTEM_NAMES[key]} — lehké poškození (${Math.round(v * 100)} %), zvládneme za provozu.`
        state.events.push({
          t: state.t, kind: 'message', shipId: target.id, side: target.side,
          speaker: 'engineer', text,
        })
      }
    }
  }

  if (target.hull <= 0 && !target.destroyed) {
    target.destroyed = true
    state.events.push({
      t: state.t,
      kind: 'shipDestroyed',
      shipId: target.id,
      side: target.side,
      slowdown: true,
      text: `${target.name} zničena`,
    })
  }
}
