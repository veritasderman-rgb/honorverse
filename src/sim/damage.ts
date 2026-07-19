/**
 * Poškození: bočníky, trup, subsystémy (viz GAME_DESIGN.md kap. 5).
 * Lodě umírají po částech — žádný prostý HP bar.
 */
import type { ShipState, SimState, Subsystems } from './types'
import { REPAIR_CAP, REPAIR_RATE, SIDEWALL_POWER_CURVE, SIDEWALL_WEAR } from './constants'
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
 * Výkon bočníků dle rozkazového tahu (rozpočet reaktoru — pohon a štítové
 * generátory se o výkon dělí): lomená čára SIDEWALL_POWER_CURVE, lineární
 * interpolace. Tah ≤ 40 % ⇒ 1.2, 60 % ⇒ 1.0, 80 % ⇒ 0.6, 100 % ⇒ 0.4,
 * 120 % ⇒ 0.25. Sdílí sim (applyBeamDamage) i UI (readout u ovládání tahu).
 */
export function sidewallPowerFactor(throttle: number): number {
  const curve = SIDEWALL_POWER_CURVE
  if (throttle <= curve[0][0]) return curve[0][1]
  for (let i = 1; i < curve.length; i++) {
    const [x1, y1] = curve[i]
    if (throttle <= x1) {
      const [x0, y0] = curve[i - 1]
      return y0 + ((throttle - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return curve[curve.length - 1][1]
}

/**
 * Aplikuje jeden paprsek (laserová tyč hlavice / energetický mount).
 * Boky: racionální útlum bočníkem — prošlé dmg²/(dmg+práh): silný bočník
 * čtvrtí slabé paprsky (ale VŽDY něco prosákne — žádná věčná imunita),
 * slabý bočník těžký graser skoro nezpomalí. Absorbovaná energie navíc
 * pálí generátory bočníku (SIDEWALL_WEAR) — soustavná palba štít mele.
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
    const wallKey = aspect === 'port' ? 'sidewallPort' : 'sidewallStbd'
    const wall = target.subsystems[wallKey]
    // rozpočet reaktoru: rychlá loď (vysoký tah) má bočníky podvyživené
    const threshold = def.sidewallStrength * wall * sidewallPowerFactor(target.throttle)
    const through = (dmg * dmg) / (dmg + threshold)
    // opotřebení generátorů absorbovanou energií — bočník se palbou mele
    if (threshold > 0) {
      target.subsystems[wallKey] =
        Math.max(0, wall - ((dmg - through) / def.sidewallStrength) * SIDEWALL_WEAR)
    }
    dmg = through
  } else if (aspect === 'throat') {
    dmg *= 1.25 // otevřené hrdlo klínu
  }

  target.hull -= dmg

  // hláska posádky hráče: lehký (inženýr) / těžký (XO) zásah — jednou per typ
  voiceOwnHit(state, target, dmg)

  // Zásah subsystémů: lodě umírají po částech — každý prošlý paprsek má
  // slušnou šanci něco urvat (základ 25 % + úměra poškození), 1–2 systémy.
  // Ztráty na systém menší než dřív: vybavení odchází POSTUPNĚ přes víc
  // zásahů (šachta po šachtě, cluster po clusteru), ne skokově.
  if (rand(state.rng) < Math.min(1, 0.25 + dmg / 35)) {
    const nHits = rand(state.rng) < 0.35 ? 2 : 1
    for (let i = 0; i < nHits; i++) {
      let key: keyof Subsystems
      if (aspect === 'kilt' && i === 0 && rand(state.rng) < 0.4) {
        key = 'impellerAft' // zásah do zádi ohrožuje zadní prstenec
      } else {
        key = SUBSYSTEM_KEYS[Math.floor(rand(state.rng) * SUBSYSTEM_KEYS.length)]
      }
      const loss = 0.12 + rand(state.rng) * 0.22
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
