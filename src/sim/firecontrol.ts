/**
 * Řízení palby (fire control):
 *   - AUTO režim: engine sám opakuje salvy na zvolený cíl, dokud je
 *     v poháněné obálce (reálný výpočet: dosah raket dle driveMode
 *     + aktuální relativní vektor lodi vůči cíli),
 *   - druhá vlna vrstvené salvy (pendingWave) — HI follow-up časovaný
 *     tak, aby dorazil ±10 s s hlavní LO vlnou.
 */
import type { Contact, FireControl, ShipState, Side, SimState, Vec2 } from './types'
import { ENERGY_MAX_RANGE } from './constants'
import { SHIP_CLASSES } from '../data/defs'
import { dist } from './vec'
import { effectiveTubes } from './damage'
import { fireEnergy, launchSalvo, poweredEnvelope } from './weapons'

const hostileTo = (a: Side, b: Side): boolean =>
  (a === 'player' && b === 'enemy') || (a === 'enemy' && b === 'player')

/**
 * Rozdělení tažených plošin eskadry mezi RŮZNÉ cíle: každé střílející lodi
 * (podle id) přiřadí vlastní cíl z klasifikovaných živých kontaktů (bez
 * paměťových pinů), seřazených podle vzdálenosti od `from`. Deterministické;
 * víc lodí než cílů → přebývající se cyklicky opakují (mod). Prázdné, není-li
 * koho napadnout. Zabrání plýtvání, kdy 6×N raket spadne na jednu loď.
 */
export function spreadPodTargets(
  shooterIds: readonly number[], contacts: readonly Contact[], from: Vec2,
): { shipId: number; targetId: number }[] {
  const cands = contacts
    .filter(c => c.memory !== true && c.idQuality >= 1)
    .map(c => ({ id: c.shipId, d: dist(from, c.pos) }))
    .sort((a, b) => a.d - b.d || a.id - b.id)
  if (cands.length === 0) return []
  return [...shooterIds].sort((a, b) => a - b)
    .map((shipId, i) => ({ shipId, targetId: cands[i % cands.length].id }))
}

/**
 * Doktríny palby eskadry (nearest/biggest/spread): DETERMINISTICKÝ výběr
 * cíle z kontaktů vlastní strany (paměťové piny se nepočítají — na duchy
 * se nestřílí). Nastaví fc.targetId; null = žádný kandidát.
 *
 *   nearest — nejbližší nepřátelský kontakt (mírná lepivost ×1.2, ať cíl
 *             nepřeskakuje mezi dvěma stejně vzdálenými),
 *   biggest — nejtěžší ZNÁMÝ trup (tonáž třídy z classGuess; neznámé = 0),
 *             remíza řeší vzdálenost — koncentrace eskadry vzniká sama,
 *   spread  — rozdělení cílů: lodě se spread doktrínou se seřadí dle id
 *             a i-tá si vezme i-tý nejbližší kontakt (mod počtu kandidátů).
 */
function doctrineTarget(state: SimState, ship: ShipState, fc: FireControl): void {
  const cands: { id: number; d: number; ton: number }[] = []
  for (const c of state.contacts[ship.side] ?? []) {
    if (c.memory === true) continue
    const t = state.ships.find(s => s.id === c.shipId)
    if (!t || t.destroyed || t.surrendered || !hostileTo(ship.side, t.side)) continue
    cands.push({
      id: t.id,
      d: dist(ship.pos, t.pos),
      ton: SHIP_CLASSES[c.classGuess]?.tonnage ?? 0,
    })
  }
  if (cands.length === 0) {
    fc.targetId = null
    fc.engaged = false
    return
  }
  cands.sort((a, b) => a.d - b.d || a.id - b.id)

  if (fc.mode === 'nearest') {
    const cur = cands.find(x => x.id === fc.targetId)
    fc.targetId = cur && cur.d <= cands[0].d * 1.2 ? cur.id : cands[0].id
    return
  }
  if (fc.mode === 'biggest') {
    let best = cands[0]
    for (const x of cands) {
      if (x.ton > best.ton || (x.ton === best.ton && x.d < best.d)) best = x
    }
    const cur = cands.find(x => x.id === fc.targetId)
    fc.targetId = cur && cur.ton >= best.ton ? cur.id : best.id
    return
  }
  // spread: pořadí lodi mezi spread-loděmi vlastní strany (dle id)
  const spreaders = state.ships
    .filter(s => !s.destroyed && s.side === ship.side && s.fireControl.mode === 'spread')
    .map(s => s.id)
    .sort((a, b) => a - b)
  const rank = Math.max(0, spreaders.indexOf(ship.id))
  fc.targetId = cands[rank % cands.length].id
}

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

    // --- AUTO palba / doktríny eskadry ---
    const fc = ship.fireControl
    const doctrine = fc.mode === 'nearest' || fc.mode === 'biggest' || fc.mode === 'spread'
    if (doctrine) {
      doctrineTarget(state, ship, fc) // deterministický výběr cíle
      if (fc.targetId == null) continue
    }
    if (!doctrine && (fc.mode !== 'auto' || fc.targetId == null)) continue

    const target = state.ships.find(s => s.id === fc.targetId && !s.destroyed && !s.surrendered)
    if (!target) {
      if (doctrine) {
        // doktrína si příští tick vybere dalšího — žádné vypínání
        fc.targetId = null
        fc.engaged = false
        continue
      }
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

    if (ship.missiles <= 0 && !doctrine) {
      if (fc.engaged || fc.mode === 'auto') {
        say(state, ship, 'Prázdné zásobníky raket — auto palba ukončena.', true)
      }
      fc.mode = 'hold'
      fc.engaged = false
      continue
    }
    // doktrína s prázdnými zásobníky pálí dál aspoň energií (launch níž hlídá munici)

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
    // 'auto' pohon: obálka pro rozhodnutí „pálit?" je LO (delší z obou) —
    // konkrétní režim volí až launchSalvo dle vzdálenosti
    const envMode = fc.driveMode === 'auto' ? 0 : fc.driveMode
    const env = poweredEnvelope(ship.pos, ship.vel, target.pos, target.vel, envMode)
    const inRange = d <= env

    // hrana: vstup/výstup z poháněné obálky (doktríny eskadry mlčí —
    // hlášky 20 lodí najednou by byly spam)
    if (inRange !== fc.engaged) {
      fc.engaged = inRange
      if (!doctrine) {
        say(state, ship, inRange
          ? `Palebné řešení na ${target.name} — zahajuji palbu.`
          : `${target.name} mimo poháněnou obálku — palba pozastavena.`, inRange)
      }
    }

    if (inRange && ship.missiles > 0 && ship.tubeCooldown <= 0 && effectiveTubes(ship) > 0) {
      launchSalvo(state, ship, target.id, fc.salvoSize, fc.driveMode,
        { autonomous: fc.autonomous === true })
    }

    // AUTO řídí i energetické baterie: nepřítel v dosahu = palba (stejně
    // jako AI protivníka — bez toho hráčova stěna v energetické rvačce
    // mlčí). Cíl: fc.target, jinak NEJBLIŽŠÍ nepřítel v dosahu.
    if (ship.energyCooldown <= 0) {
      let eTarget: ShipState | null =
        dist(ship.pos, target.pos) < ENERGY_MAX_RANGE ? target : null
      if (!eTarget) {
        let bd = ENERGY_MAX_RANGE
        for (const e of state.ships) {
          if (e.destroyed || e.surrendered || e.side === ship.side || e.side === 'neutral') continue
          if (!state.contacts[ship.side]?.some(c => c.shipId === e.id && c.memory !== true)) continue
          const de = dist(ship.pos, e.pos)
          if (de < bd) { bd = de; eTarget = e }
        }
      }
      if (eTarget) fireEnergy(state, ship, eTarget)
    }
  }
}
