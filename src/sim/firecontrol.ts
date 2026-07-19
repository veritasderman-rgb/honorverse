/**
 * Řízení palby (fire control):
 *   - AUTO režim: engine sám opakuje salvy na zvolený cíl, dokud je
 *     v poháněné obálce (reálný výpočet: dosah raket dle driveMode
 *     + aktuální relativní vektor lodi vůči cíli),
 *   - druhá vlna vrstvené salvy (pendingWave) — HI follow-up časovaný
 *     tak, aby dorazil ±10 s s hlavní LO vlnou.
 */
import type { ShipState, SimState } from './types'
import { dist } from './vec'
import { effectiveTubes } from './damage'
import { launchSalvo, poweredEnvelope } from './weapons'

/** hláška taktického důstojníka hráči */
function say(state: SimState, ship: ShipState, text: string, slowdown = false): void {
  if (ship.doctrine !== 'player') return
  state.events.push({
    t: state.t, kind: 'message', shipId: ship.id, side: ship.side,
    speaker: 'tactical', slowdown, text,
  })
}

/** Krok řízení palby všech lodí: čekající vlny + AUTO salvy. */
export function updateFireControl(state: SimState): void {
  for (const ship of state.ships) {
    if (ship.destroyed) continue

    // --- druhá vlna vrstvené/dvojité salvy ---
    // (odvalená loď nemůže pálit — vlna se NEspotřebuje, čeká na návrat;
    // výjimka: vlna dvojité boční salvy sama otočku ukončuje — unrollAfter)
    if (ship.pendingWave && state.t >= ship.pendingWave.launchAt
      && (ship.rolledTo === null || ship.pendingWave.unrollAfter === true)) {
      const w = ship.pendingWave
      ship.pendingWave = null
      if (w.unrollAfter === true) ship.rolledTo = null // konec boční otočky
      const target = state.ships.find(s => s.id === w.targetId && !s.destroyed && !s.surrendered)
      if (target) {
        launchSalvo(state, ship, w.targetId, w.count, w.mode,
          { ignoreCooldown: true, side: w.sourceSide })
      } else {
        say(state, ship, 'Druhá vlna zrušena — cíl už neexistuje.')
      }
    }

    // --- AUTO palba ---
    const fc = ship.fireControl
    if (fc.mode !== 'auto' || fc.targetId == null) continue

    const target = state.ships.find(s => s.id === fc.targetId && !s.destroyed && !s.surrendered)
    if (!target) {
      const capitulated = state.ships.find(s => s.id === fc.targetId)?.surrendered === true
      if (fc.engaged) {
        say(state, ship, capitulated
          ? 'Cíl kapituloval — zastavuji palbu.'
          : 'Cíl zničen nebo ztracen — auto palba ukončena.')
      }
      fc.mode = 'hold'
      fc.engaged = false
      continue
    }

    if (ship.missiles <= 0) {
      if (fc.engaged || fc.mode === 'auto') {
        say(state, ship, 'Prázdné zásobníky raket — auto palba ukončena.', true)
      }
      fc.mode = 'hold'
      fc.engaged = false
      continue
    }

    // odvalená loď nestřílí — AUTO čeká (hláška jen na hraně, žádný spam)
    if (ship.rolledTo !== null) {
      if (fc.rolledWait !== true) {
        fc.rolledWait = true
        say(state, ship, 'Jsme odvalení — AUTO palba čeká na návrat do normální polohy.')
      }
      continue
    }
    if (fc.rolledWait === true) {
      fc.rolledWait = false
      say(state, ship, 'Zpět v normální poloze — AUTO palba pokračuje.')
    }

    const d = dist(ship.pos, target.pos)
    const env = poweredEnvelope(ship.pos, ship.vel, target.pos, target.vel, fc.driveMode)
    const inRange = d <= env

    // hrana: vstup/výstup z poháněné obálky
    if (inRange !== fc.engaged) {
      fc.engaged = inRange
      say(state, ship, inRange
        ? `Palebné řešení na ${target.name} — zahajuji palbu.`
        : `${target.name} mimo poháněnou obálku — palba pozastavena.`, inRange)
    }

    if (inRange && ship.tubeCooldown <= 0 && effectiveTubes(ship) > 0) {
      launchSalvo(state, ship, fc.targetId, fc.salvoSize, fc.driveMode,
        { autonomous: fc.autonomous === true })
    }
  }
}
