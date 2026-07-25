/**
 * Kapitulace (GAME_DESIGN.md kap. 5: „loď vyřazená z boje dřív, než zničená
 * — možnost kapitulace"). Hráč pošle výzvu (Order 'demandSurrender'); zpráva
 * letí rychlostí světla tam a odpověď zpět — výsledek dorazí po 2·d/C sim
 * sekund (SimState.pendingComms). Roll ze state.rng probíhá až při DORUČENÍ.
 * AI se sama od sebe nikdy nevzdává — jen jako odpověď na výzvu.
 */
import type { ShipState, SimState, Speaker } from './types'
import { C, SURRENDER_COOLDOWN, SURRENDER_WEAPONS_OUT_BONUS } from './constants'
import { SHIP_CLASSES } from '../data/defs'
import { dist } from './vec'
import { rand } from './rng'

/** morálka dle doktríny — násobí šanci na kapitulaci (nižší = tvrdší posádka) */
const MORALE: Record<string, number> = {
  pirate: 1.5, freighter: 2.0, buoy: 2.0, runner: 1.0, hunter: 0.7, escort: 0.7,
}

export const moraleFor = (doctrine: string): number => MORALE[doctrine] ?? 1.0

/**
 * Bonus platí, když má cíl vyřazené obě zbraňové stránky (tubesPort
 * i tubesStbd < 0.3) nebo prázdné zásobníky — jen u lodí, které šachty mají.
 */
export function weaponsOut(ship: ShipState): boolean {
  const def = SHIP_CLASSES[ship.classId]
  if (!def || def.tubesPerBroadside <= 0) return false
  return (ship.subsystems.tubesPort < 0.3 && ship.subsystems.tubesStbd < 0.3)
    || ship.missiles <= 0
}

/**
 * Šance na kapitulaci: p = clamp(poškození − 0.2, 0, 0.95) · morálka,
 * +0.15 při vyřazených zbraních. Poškození = 1 − hull/hullPoints.
 * Příklad: 80 % poškození → 60 % šance při morálce 1.0.
 */
export function surrenderChance(damage: number, morale: number, weaponsKnockedOut: boolean): number {
  const base = Math.min(0.95, Math.max(0, damage - 0.2)) * morale
  const p = base + (weaponsKnockedOut ? SURRENDER_WEAPONS_OUT_BONUS : 0)
  return Math.min(1, Math.max(0, p))
}

/** skutečná šance cíle (roll při doručení výzvy) */
export function surrenderChanceFor(target: ShipState): number {
  const def = SHIP_CLASSES[target.classId]
  const damage = def ? 1 - Math.max(0, target.hull) / def.hullPoints : 0
  return surrenderChance(damage, moraleFor(target.doctrine), weaponsOut(target))
}

/** hláška spojaře hráči (AI výzvy neposílá, ale pro jistotu filtrujeme) */
function commsSay(state: SimState, ship: ShipState, text: string, voId?: string): void {
  if (ship.doctrine !== 'player') return
  state.events.push({
    t: state.t, kind: 'message', shipId: ship.id, side: ship.side,
    speaker: 'comms', text, voId,
  })
}

/**
 * Rozkaz 'demandSurrender': validace (klasifikace ≥ 1, nepřítel, cooldown)
 * a odeslání výzvy — odpověď dorazí za 2·vzdálenost/C sim sekund.
 */
export function demandSurrender(state: SimState, ship: ShipState, targetId: number): void {
  const target = state.ships.find(s => s.id === targetId)
  if (!target || target.destroyed) return
  if (target.surrendered) {
    commsSay(state, ship, `${target.name} už kapituloval.`)
    return
  }
  const hostile = (ship.side === 'player' && target.side === 'enemy')
    || (ship.side === 'enemy' && target.side === 'player')
  if (!hostile) {
    commsSay(state, ship, 'To není nepřátelské plavidlo — výzva ke kapitulaci nemá smysl.', 'sys-nosurr-neutral')
    return
  }
  const contact = state.contacts[ship.side]?.find(c => c.shipId === targetId)
  if (!contact || contact.idQuality < 1) {
    commsSay(state, ship, 'Kontakt není klasifikován — nejdřív ho identifikuj (přibliž se / aktivní senzory).', 'sys-nosurr-unid')
    return
  }
  if (state.t - target.lastSurrenderDemandAt < SURRENDER_COOLDOWN) {
    commsSay(state, ship, `${target.name} na výzvu neodpovídá — počkej, nebo zvyš tlak.`)
    return
  }

  target.lastSurrenderDemandAt = state.t
  const lag = (2 * dist(ship.pos, target.pos)) / C
  state.pendingComms.push({ deliverAt: state.t + lag, targetId, demanderId: ship.id })
  const eta = lag >= 90
    ? `~${Math.max(1, Math.round(lag / 60))} min`
    : `~${Math.max(1, Math.round(lag))} s`
  commsSay(state, ship, `Výzva ke kapitulaci odeslána na ${target.name} — odpověď nejdřív za ${eta} (světelné zpoždění tam a zpět).`)
}

/** provede kapitulaci: wedge off, nav null, doktrína 'surrendered', eventy */
function acceptSurrender(state: SimState, target: ShipState, speaker: Speaker): void {
  target.surrendered = true
  target.doctrine = 'surrendered'
  target.wedgeOn = false
  target.nav = null
  target.throttle = 0
  target.rolledTo = null
  target.pendingWave = null
  target.fireControl.mode = 'hold'
  target.fireControl.targetId = null
  target.fireControl.engaged = false
  state.events.push({
    t: state.t, kind: 'comm', speaker, shipId: target.id, side: target.side, slowdown: true,
    voId: speaker === 'pirate' ? 'sur-accept-pirate' : 'sur-accept-imperial',
    text: `${target.name}: „Dost… dost! Vypínáme klín a skládáme zbraně. Kapitulujeme — nestřílejte.“`,
  })
  state.events.push({
    t: state.t, kind: 'objective', shipId: target.id, side: target.side, slowdown: true,
    text: `${target.name} kapituloval — klín vypnut, loď se vzdává.`,
  })
}

/**
 * Doručení zpráv na cestě: pro každou pendingComm s deliverAt <= t se AŽ TEĎ
 * rozhodne (roll ze state.rng) — deterministické pořadí = pořadí odeslání.
 */
export function updatePendingComms(state: SimState): void {
  if (state.pendingComms.length === 0) return
  const due = state.pendingComms.filter(pc => pc.deliverAt <= state.t)
  if (due.length === 0) return
  state.pendingComms = state.pendingComms.filter(pc => pc.deliverAt > state.t)

  for (const pc of due) {
    const target = state.ships.find(s => s.id === pc.targetId)
    if (!target || target.destroyed || target.surrendered) continue
    const speaker: Speaker = target.doctrine === 'pirate' ? 'pirate' : 'enemy-captain'
    if (rand(state.rng) < surrenderChanceFor(target)) {
      acceptSurrender(state, target, speaker)
    } else {
      // vzdorovitá odpověď — výzva zamítnuta
      state.events.push({
        t: state.t, kind: 'comm', speaker, shipId: target.id, side: target.side, slowdown: true,
        voId: speaker === 'pirate' ? 'sur-refuse-pirate' : 'sur-refuse-imperial',
        text: `${target.name}: „Kapitulovat? Zapomeňte. Ještě jsme neskončili.“`,
      })
    }
  }
}
