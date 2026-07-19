/**
 * Senzory: budování kontaktní picture pro každou stranu.
 * Detekce klínu (pasivní, obří dosah) vs. aktivní/pasivní senzory zblízka.
 * Kontakty nesou světelné zpoždění (age) — obraz je starý vzdálenost/C sekund.
 */
import type { Contact, SimState } from './types'
import { C, SENSOR_UPDATE_INTERVAL } from './constants'
import { dist } from './vec'
import { SHIP_CLASSES } from '../data/defs'
import { voiceFirstContact, voiceWarshipClassified } from './voice'

/** akumulátor času od poslední aktualizace, per stav (mimo SimState kvůli kontraktu) */
const sensorClock = new WeakMap<SimState, number>()

/** Pomocná: kontakty dané strany. */
export function contactsFor(state: SimState, side: 'player' | 'enemy' | 'neutral'): Contact[] {
  return state.contacts[side]
}

/**
 * Každých SENSOR_UPDATE_INTERVAL s přepočte state.contacts pro 'player' a 'enemy'.
 * Strana vidí sjednocení toho, co vidí její lodě. 'neutral' zůstává prázdné.
 */
export function updateSensors(state: SimState, dt: number): void {
  const acc = (sensorClock.get(state) ?? SENSOR_UPDATE_INTERVAL) + dt
  if (acc < SENSOR_UPDATE_INTERVAL) {
    sensorClock.set(state, acc)
    return
  }
  sensorClock.set(state, 0)

  for (const side of ['player', 'enemy'] as const) {
    const observers = state.ships.filter(s => s.side === side && !s.destroyed)
    const prev = state.contacts[side]
    const next: Contact[] = []

    for (const target of state.ships) {
      if (target.side === side || target.destroyed) continue

      let bestDist = Infinity      // vzdálenost nejbližšího pozorovatele
      let wedgeDetected = false
      let quality: 0 | 1 | 2 = 0
      let seen = false

      for (const obs of observers) {
        const def = SHIP_CLASSES[obs.classId]
        if (!def) continue
        const d = dist(obs.pos, target.pos)
        const seesWedge = target.wedgeOn && d < def.wedgeDetectionRange
        const seesClose = d < def.activeSensorRange
        if (!seesWedge && !seesClose) continue
        seen = true
        if (seesWedge) wedgeDetected = true
        if (d < bestDist) bestDist = d
        // kvalita identifikace: 2 = aktivní zaměření zblízka, 1 = blízko, 0 = jen klín
        let q: 0 | 1 | 2 = 0
        if (seesClose && obs.activeSensors) q = 2
        else if (d < 2 * def.activeSensorRange) q = 1
        if (q > quality) quality = q
      }
      if (!seen) continue

      const age = bestDist / C // světelné zpoždění od nejbližšího pozorovatele
      const revealed = state.flags[`revealed:${target.id}`] === true
      const classGuess = quality === 2 || revealed ? target.classId : 'neznámá'

      next.push({
        shipId: target.id,
        // aproximace zpožděného obrazu: skutečná pozice minus vel·age
        pos: { x: target.pos.x - target.vel.x * age, y: target.pos.y - target.vel.y * age },
        vel: { x: target.vel.x, y: target.vel.y },
        age,
        idQuality: quality,
        classGuess,
        wedgeDetected,
      })

      // nová stopa → událost (UI zpomalí čas)
      if (!prev.some(c => c.shipId === target.id)) {
        const known = classGuess !== 'neznámá' ? SHIP_CLASSES[classGuess]?.name ?? classGuess : 'neznámá loď'
        state.events.push({
          t: state.t,
          kind: 'contactNew',
          text: `Nový kontakt: ${known}${wedgeDetected ? ' (impelerový klín)' : ''}`,
          shipId: target.id,
          side,
          slowdown: true,
        })
        // hláska spojaře: první nepřátelský kontakt mise (jen strana hráče)
        if (side === 'player') voiceFirstContact(state, target)
      }
      // hláska taktického: klasifikace VÁLEČNÉ lodi (jednou na loď)
      if (side === 'player' && classGuess !== 'neznámá') {
        voiceWarshipClassified(state, target)
      }
    }

    state.contacts[side] = next
  }

  state.contacts.neutral = []
}
