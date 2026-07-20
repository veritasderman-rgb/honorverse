/**
 * Senzory: budování kontaktní picture pro každou stranu.
 * Detekce klínu (pasivní, obří dosah) vs. aktivní/pasivní senzory zblízka.
 *
 * Gravitika je FTL: zapnutý klín v dosahu = obraz v REÁLNÉM čase (age 0).
 * EM detekce (klín vypnut) nese světelné zpoždění d/c — obraz je starý.
 * Ztracený kontakt NEmizí: zůstává jako PAMĚŤOVÝ PIN (memory) s poslední
 * známou polohou — statické objekty (stanice, planety) trvale a přesně,
 * lodě s rostoucí nejistotou (plot kreslí kružnici age·|vel|).
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

      // ZAKRESLENO V MAPÁCH: neutrální statické objekty (planety, stanice,
      // navigační bóje, sondy — doctrine 'buoy') zná každý z navigačních
      // map soustavy — jsou vidět a klasifikované VŽDY, bez senzorů.
      // Nepřátelských základen se to netýká (ty je třeba najít).
      const charted = target.side === 'neutral' && target.doctrine === 'buoy'
      if (charted) {
        seen = true
        quality = 2
      }

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
      if (!seen) {
        // ztráta kontaktu → paměťový pin: poslední známé zakreslení zůstává
        const old = prev.find(c => c.shipId === target.id)
        if (old) {
          const def = SHIP_CLASSES[target.classId]
          const isStatic = old.staticObject === true || (def ? def.maxAccelG <= 0 : false)
          next.push({
            ...old,
            // pin dál stárne (nejistota roste); statický objekt drží polohu;
            // plná identifikace (2) bez živého tracku degraduje na 1
            age: old.age + SENSOR_UPDATE_INTERVAL,
            vel: isStatic ? { x: 0, y: 0 } : old.vel,
            idQuality: Math.min(old.idQuality, 1) as 0 | 1,
            memory: true,
            staticObject: isStatic,
          })
        }
        continue
      }

      // gravitika (klín) je FTL → obraz real-time; EM jen rychlostí světla;
      // objekt z map (charted) má polohu kanonickou — bez stáří
      const age = wedgeDetected || !Number.isFinite(bestDist) ? 0 : bestDist / C
      const revealed = state.flags[`revealed:${target.id}`] === true
      const classGuess = quality === 2 || revealed ? target.classId : 'neznámá'
      const def = SHIP_CLASSES[target.classId]

      next.push({
        shipId: target.id,
        // aproximace zpožděného obrazu: skutečná pozice minus vel·age
        pos: { x: target.pos.x - target.vel.x * age, y: target.pos.y - target.vel.y * age },
        vel: { x: target.vel.x, y: target.vel.y },
        age,
        idQuality: quality,
        classGuess,
        wedgeDetected,
        staticObject: def ? def.maxAccelG <= 0 : false,
      })

      // nová stopa → událost (UI zpomalí čas); objekty z map nejsou „nový
      // kontakt" — jsou tam odjakživa, žádné hlášky ani zpomalení
      if (!charted && !prev.some(c => c.shipId === target.id)) {
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
