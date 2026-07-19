/**
 * Testy misí 9–10 (finále kampaně) a nových podmínek triggerů
 * (flagNot, hullBelow). Mise 9: dva sledy invaze s dreadnoughtem Toledo
 * v čele, obranné pody stanice, win AND přes všech osm útočníků; hráč velí
 * eskadře pěti lodí s vlajkovým dreadnoughtem ANS Vladař. Mise 10: zástěna
 * čtyř křižníků + strážný DN Sevilla, pole podů, politický rozkaz a TŘI konce
 * (rozkaz / duch rozkazu / čisté vítězství). E2E běh mise 9 s pevným
 * seedem — deterministický; hráč orchestrován přes applyOrder.
 */
import { describe, expect, it } from 'vitest'
import type { Order, SimState } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { SIM_DT } from '../src/sim/constants'
import { angleDiff, angleOf, dist, sub } from '../src/sim/vec'
import { updateTriggers } from '../src/sim/scenario'
import { SCENARIOS } from '../src/data/missions'
import { mission09 } from '../src/data/missions/mission09'
import { mission10 } from '../src/data/missions/mission10'
import { MISSION_STORY } from '../src/data/story'
import { SHIP_CLASSES } from '../src/data/defs'
import { controllableShips } from '../src/ui/roster'

const objState = (state: SimState, id: string) => state.objectives.find(o => o.id === id)?.state

const shipById = (state: SimState, id: number) => state.ships.find(s => s.id === id)

const M9_STATION = 6
const WAVE1 = [9101, 9102, 9103, 9104]
const WAVE2 = [9201, 9202, 9203, 9204]
const ATTACKERS = [...WAVE1, ...WAVE2]

const M10_BASE = 5
const M10_PATROL = [6, 7, 8, 9]
const M10_GUARDIAN = 10
const M10_BUOY = 11

/** obranné rolování lodi: klín proti nejbližší příchozí raketě */
function rollDefense(state: SimState, shipId: number, range = 700_000): void {
  const ship = shipById(state, shipId)
  if (!ship || ship.destroyed) return
  let threat: number | null = null
  let threatD = Infinity
  for (const m of state.missiles) {
    if (m.side === ship.side || m.targetId !== shipId || m.phase === 'dead') continue
    const md = dist(m.pos, ship.pos)
    if (md < range && md < threatD) { threatD = md; threat = angleOf(sub(m.pos, ship.pos)) }
  }
  if (threat !== null) {
    if (ship.rolledTo === null || Math.abs(angleDiff(threat, ship.rolledTo)) > 0.2) {
      sim.applyOrder(state, { kind: 'roll', shipId, towards: threat })
    }
  } else if (ship.rolledTo !== null) {
    sim.applyOrder(state, { kind: 'roll', shipId, towards: null })
  }
}

describe('registrace misí 9–10', () => {
  it('mise 9–10 jsou v SCENARIOS (výběr misí 1→10) a mají očekávaný tvar', () => {
    expect(Object.keys(SCENARIOS)).toHaveLength(11)
    expect(SCENARIOS['mission09']).toBe(mission09)
    expect(SCENARIOS['mission10']).toBe(mission10)
    // M9: eskadra 5 lodí (s dreadnoughtem) + stanice; hyperlimit KRUŽNICE
    expect(mission09.ships).toHaveLength(6)
    expect(mission09.hyperlimit).toEqual({
      kind: 'circle', center: { x: 0, y: 0 }, radius: 220_000_000,
    })
    // M10: úderný svaz 4 lodí + základna + zástěna 4 lodí + strážný DN
    // + ústupová bóje
    expect(mission10.ships).toHaveLength(11)
    expect(mission10.hyperlimit).toEqual({ kind: 'lineX', x: 150_000_000 })
  })

  it('M9: všech 5 lodí eskadry je ovladatelných, vlajkou dreadnought; stanice ne', () => {
    const state = sim.create(mission09)
    const ctrl = controllableShips(state)
    expect(ctrl.map(s => s.id)).toEqual([1, 2, 3, 4, 5])
    expect(ctrl[0].classId).toBe('dn-vladar')   // vlajkový dreadnought
    expect(ctrl[0].name).toBe('ANS Vladař')
    expect(ctrl[1].classId).toBe('bc-praporec') // Praporec druhá
    const station = shipById(state, M9_STATION)!
    expect(station.classId).toBe('station-zeta')
    expect(station.doctrine).toBe('buoy')
    expect(station.wedgeOn).toBe(false)
    expect(station.pos).toEqual({ x: 0, y: 0 })
  })

  it('M10: vlajkový Vladař + Praporec + Vanguard + Aurora; nedostavěná základna; strážná Sevilla', () => {
    const state = sim.create(mission10)
    const ctrl = controllableShips(state)
    expect(ctrl.map(s => s.name)).toEqual(['ANS Vladař', 'ANS Praporec', 'ANS Vanguard', 'ANS Aurora'])
    expect(ctrl[0].classId).toBe('dn-vladar')
    expect(ctrl[0].vel.x).toBe(-3_000) // příchod z +x dovnitř soustavy
    const base = shipById(state, M10_BASE)!
    expect(base.classId).toBe('station-zeta')
    expect(base.side).toBe('enemy')
    expect(base.hull).toBe(600) // nedostavěná — 600 z 800
    expect(base.subsystems.tubesPort).toBe(0.5)
    expect(base.subsystems.tubesStbd).toBe(0.5)
    expect(base.subsystems.cm).toBe(0.6)
    expect(base.pos).toEqual({ x: -120_000_000, y: 0 })
    // zástěna (2× CA + 2× CL) startuje jako tichý drift
    expect(M10_PATROL.map(id => shipById(state, id)?.classId))
      .toEqual(['ca-bastion', 'ca-bastion', 'cl-sokol', 'cl-sokol'])
    for (const id of M10_PATROL) expect(shipById(state, id)?.doctrine).toBe('freighter')
    // strážný dreadnought u základny s podříznutými zásobníky
    const guardian = shipById(state, M10_GUARDIAN)!
    expect(guardian.classId).toBe('dn-ural')
    expect(guardian.missiles).toBe(400)
    // ústupová bóje za hyperlimitem
    expect(shipById(state, M10_BUOY)?.pos.x).toBe(155_000_000)
  })
})

describe('mise 9 — Velká armáda', () => {
  it('sled 1 přistává v t=300 s dreadnoughtem Toledo v čele (plná kvalita, oslabené zásobníky)', () => {
    const scenario = structuredClone(mission09)
    const state = sim.create(scenario)
    expect(shipById(state, 9101)).toBeUndefined()
    state.t = 300
    updateTriggers(state, scenario)
    const lead = shipById(state, 9101)!
    expect(lead.classId).toBe('dn-ural')
    expect(lead.side).toBe('enemy')
    expect(lead.doctrine).toBe('hunter')
    expect(lead.pos).toEqual({ x: 200_000_000, y: 42_000_000 })
    expect(lead.vel.x).toBeLessThan(0) // valí se dovnitř
    // sled 1 = první linie: subsystémy plné, ale zásobníky podříznuté (mise 7)
    expect(lead.subsystems.sensors).toBe(1)
    expect(lead.missiles).toBe(300)
    expect(shipById(state, 9102)?.classId).toBe('ca-bastion')
    expect(shipById(state, 9103)?.classId).toBe('ca-bastion')
    expect(shipById(state, 9104)?.classId).toBe('cl-sokol')
    expect(shipById(state, 9201)).toBeUndefined() // sled 2 ještě ne
  })

  it('ZVRAT: sled 2 vystupuje v t=5400 na OPAČNÉ straně jako oslabená druhá linie', () => {
    const scenario = structuredClone(mission09)
    const state = sim.create(scenario)
    state.t = 5_400
    updateTriggers(state, scenario)
    const lead = shipById(state, 9201)!
    expect(lead.classId).toBe('ca-bastion')
    expect(lead.pos).toEqual({ x: -190_000_000, y: -60_000_000 })
    // opačná strana: sled 1 na +x, sled 2 na −x
    expect(Math.sign(lead.pos.x)).toBe(-Math.sign(shipById(state, 9101)!.pos.x))
    // druhá linie: starší senzory/ECM, děravá obrana, poloviční zásobníky
    expect(lead.subsystems.sensors).toBe(0.8)
    expect(lead.subsystems.ecm).toBe(0.8)
    expect(lead.subsystems.pdlc).toBe(0.7)
    expect(lead.subsystems.cm).toBe(0.7)
    expect(lead.missiles).toBe(140)
    expect(shipById(state, 9202)?.classId).toBe('ca-bastion')
    expect(shipById(state, 9203)?.classId).toBe('cl-sokol')
    expect(shipById(state, 9204)?.classId).toBe('cl-sokol')
    expect(state.events.some(e => e.kind === 'message'
      && e.text.includes('Druhý sbor vystupuje z hyperu na opačné straně soustavy'))).toBe(true)
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'station'
      && e.text.includes('MEZI vámi a stanicí'))).toBe(true)
  })

  it('úvodní rozkaz guvernéra a imperiální ultimátum (comm)', () => {
    const scenario = structuredClone(mission09)
    const state = sim.create(scenario)
    state.t = 420
    updateTriggers(state, scenario)
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'governor')).toBe(true)
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'enemy-captain'
      && e.text.includes('historické právo'))).toBe(true)
  })

  it('stanice odpálí obranné pody (16 raket) na prvního útočníka pod 10 mil. km — jen JEDNOU', () => {
    const scenario = structuredClone(mission09)
    const state = sim.create(scenario)
    state.t = 300
    updateTriggers(state, scenario)

    // první útočník proklouzne ke stanici
    shipById(state, 9101)!.pos = { x: 9_000_000, y: 0 }
    updateTriggers(state, scenario)
    const pods = state.missiles.filter(m => m.shooterId === M9_STATION)
    expect(pods).toHaveLength(16)
    expect(pods.every(m => m.side === 'player' && m.targetId === 9101)).toBe(true)
    expect(state.flags['pods-away']).toBe(true)
    expect(state.events.some(e => e.kind === 'message'
      && e.text === 'Křižovatka aktivuje obranné pody!')).toBe(true)

    // druhý útočník u stanice už NIC nespustí (flagNot pods-away)
    shipById(state, 9102)!.pos = { x: 8_000_000, y: 0 }
    updateTriggers(state, scenario)
    expect(state.missiles.filter(m => m.shooterId === M9_STATION)).toHaveLength(16)
  })

  it('VÝHRA je AND všech osmi útočníků (zničení i kapitulace)', () => {
    const scenario = structuredClone(mission09)
    const state = sim.create(scenario)
    state.t = 5_400
    updateTriggers(state, scenario) // oba sledy na hřišti

    shipById(state, 9101)!.destroyed = true
    shipById(state, 9102)!.destroyed = true
    shipById(state, 9103)!.surrendered = true
    shipById(state, 9104)!.surrendered = true
    shipById(state, 9201)!.surrendered = true
    shipById(state, 9202)!.destroyed = true
    shipById(state, 9203)!.destroyed = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('running') // sedm z osmi nestačí
    // hláška XO o geometrii po vyřazení sledu 1
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'xo'
      && e.text.includes('geometri'))).toBe(true)

    shipById(state, 9204)!.destroyed = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-invasion')).toBe('done')
    expect(objState(state, 'obj-station')).toBe('done')
  })

  it('prohra: zničení stanice NEBO vlajkové lodi NEBO 3 vlastních lodí', () => {
    // stanice
    const sc1 = structuredClone(mission09)
    const s1 = sim.create(sc1)
    shipById(s1, M9_STATION)!.destroyed = true
    updateTriggers(s1, sc1)
    expect(s1.outcome).toBe('lose')
    // vlajkový dreadnought
    const sc2 = structuredClone(mission09)
    const s2 = sim.create(sc2)
    shipById(s2, 1)!.destroyed = true
    updateTriggers(s2, sc2)
    expect(s2.outcome).toBe('lose')
    // tři vlastní lodě (eskadra bez vlajkové)
    const sc3 = structuredClone(mission09)
    const s3 = sim.create(sc3)
    for (const id of [2, 3, 4]) shipById(s3, id)!.destroyed = true
    updateTriggers(s3, sc3)
    expect(s3.outcome).toBe('lose')
  })

  /**
   * DŮKAZ HRATELNOSTI: pevnostní obrana u Křižovatky. Eskadra ve stěně
   * (vlajkový dreadnought Vladař uprostřed) drží pozici v protiraketovém
   * deštníku stanice (oblastní obrana), soustředěnou AUTO palbou s palebnou
   * kázní (na odvalený cíl nestřílet) rozbíjí oba sledy včetně dreadnoughtu
   * Toledo; torpédoborce s vystřílenými zásobníky se odpoutají hluboko do
   * deštníku stanice a zbytek dorazí poslední útočníky energetickou palbou
   * zblízka a výzvami ke kapitulaci. Deterministický win s pevným seedem.
   */
  it('mise 9 je hratelná: pevnostní obrana u stanice rozbije oba sledy (E2E)', () => {
    const state = sim.create(mission09)
    const order = (o: Order): void => sim.applyOrder(state, o)
    const SQUADRON = [1, 2, 3, 4, 5]

    // stěna: Praporec, Hradba, Vichr a Bouře drží sloty na vlajkovém
    // Vladaři; celá eskadra stojí 1,5 mil. km od stanice — v CM deštníku
    order({ kind: 'setFormation', shipId: 2, leaderId: 1, slot: 1, formation: 'wall' })
    order({ kind: 'setFormation', shipId: 3, leaderId: 1, slot: 2, formation: 'wall' })
    order({ kind: 'setFormation', shipId: 4, leaderId: 1, slot: 3, formation: 'wall' })
    order({ kind: 'setFormation', shipId: 5, leaderId: 1, slot: 4, formation: 'wall' })
    order({ kind: 'setThrottle', shipId: 1, throttle: 1 })
    for (const sid of SQUADRON) order({ kind: 'setActiveSensors', shipId: sid, on: true })
    order({ kind: 'setCourse', shipId: 1, dest: { x: 1_500_000, y: 0 }, arriveAtRest: true })

    const aliveAttacker = (id: number) => {
      const s = shipById(state, id)
      return s && !s.destroyed && !s.surrendered ? s : undefined
    }
    const deployDecoyIfSwamped = (shipId: number): void => {
      const ship = shipById(state, shipId)
      if (!ship || ship.destroyed || ship.decoys <= 0 || ship.decoyActive) return
      let incoming = 0
      let nearest = Infinity
      for (const m of state.missiles) {
        if (m.side === ship.side || m.targetId !== shipId || m.phase === 'dead') continue
        incoming++
        nearest = Math.min(nearest, dist(m.pos, ship.pos))
      }
      if (incoming >= 6 && nearest < 2_500_000) order({ kind: 'deployDecoy', shipId })
    }

    let focus = -1
    let ddsDetached = false
    while (state.outcome === 'running' && state.t < 60_000) {
      sim.tick(state, SIM_DT)
      const flag = shipById(state, 1)!
      if (flag.destroyed) break

      // soustředěná palba: drž cíl, dokud žije; pak nejbližší další útočník
      if (!aliveAttacker(focus)) {
        focus = -1
        let best = Infinity
        for (const id of ATTACKERS) {
          const a = aliveAttacker(id)
          if (!a) continue
          const d = dist(flag.pos, a.pos)
          if (d < best) { best = d; focus = id }
        }
      }
      if (focus > 0) {
        // palebná kázeň: na odvalený cíl nestřílet — klín by salvu sežral
        const f = shipById(state, focus)!
        const wantMode = f.rolledTo === null ? 'auto' : 'hold'
        for (const sid of SQUADRON) {
          const s = shipById(state, sid)
          if (!s || s.destroyed || s.missiles <= 0) continue
          if (wantMode === 'hold' && s.fireControl.mode !== 'hold') {
            order({ kind: 'setFireControl', shipId: sid, fc: { mode: 'hold' } })
          } else if (wantMode === 'auto'
            && (s.fireControl.targetId !== focus || s.fireControl.mode !== 'auto')) {
            order({ kind: 'setFireControl', shipId: sid, fc: { mode: 'auto', targetId: focus, driveMode: 0 } })
          }
        }
      }

      const squadronMissiles = SQUADRON
        .map(id => shipById(state, id))
        .reduce((sum, s) => sum + (s && !s.destroyed ? s.missiles : 0), 0)

      // ZVRAT vyžaduje rozdělení sil: torpédoborce s prázdnými zásobníky
      // opouštějí stěnu a kryjí stanici zevnitř jejího deštníku
      if (!ddsDetached && (shipById(state, 4)!.missiles + shipById(state, 5)!.missiles) < 20) {
        ddsDetached = true
        order({ kind: 'clearFormation', shipId: 4 })
        order({ kind: 'clearFormation', shipId: 5 })
        order({ kind: 'setCourse', shipId: 4, dest: { x: 300_000, y: 900_000 }, arriveAtRest: true })
        order({ kind: 'setCourse', shipId: 5, dest: { x: 300_000, y: -900_000 }, arriveAtRest: true })
      }

      // energetická poprava: bez raket (naše či jejich) se boj dorazí zblízka
      const living = ATTACKERS.map(aliveAttacker).filter(a => a !== undefined)
      const brawl = living.length > 0
        && (squadronMissiles === 0 || living.every(a => a!.missiles === 0))
      if (brawl && focus > 0) {
        const f = shipById(state, focus)!
        if (!(flag.nav?.kind === 'intercept' && flag.nav.targetId === focus)) {
          order({ kind: 'intercept', shipId: 1, targetId: focus })
        }
        for (const sid of [1, 2, 3]) {
          const s = shipById(state, sid)
          if (!s || s.destroyed) continue
          if (s.energyCooldown <= 0 && dist(s.pos, f.pos) < 380_000) {
            order({ kind: 'fireEnergy', shipId: sid, targetId: focus })
          }
        }
      }

      // výzvy ke kapitulaci: prázdné zásobníky nebo těžké poškození cíle
      for (const id of ATTACKERS) {
        const a = aliveAttacker(id)
        if (!a) continue
        const def = SHIP_CLASSES[a.classId]
        if (a.missiles > 0 && a.hull > 0.5 * def.hullPoints) continue
        if (state.t - a.lastSurrenderDemandAt < 185) continue
        const ct = state.contacts.player.find(c => c.shipId === id)
        if (!ct || ct.idQuality < 1) continue
        order({ kind: 'demandSurrender', shipId: 1, targetId: id })
      }

      for (const sid of SQUADRON) { rollDefense(state, sid); deployDecoyIfSwamped(sid) }
    }

    expect(state.outcome).toBe('win')
    expect(shipById(state, 1)!.destroyed).toBe(false)          // vlajkový Vladař žije
    expect(shipById(state, M9_STATION)!.destroyed).toBe(false) // Křižovatka stojí
    expect(objState(state, 'obj-invasion')).toBe('done')
    expect(objState(state, 'obj-station')).toBe('done')
    // zvrat opravdu proběhl: druhý sled se objevil a byl vyřazen
    expect(WAVE2.every(id => state.flags[`neutralized-${id}`])).toBe(true)
  }, 240_000)
})

describe('mise 10 — Cádiz (finále, dva konce)', () => {
  it('fáze 1: zástěna (a strážný DN) se budí detekcí svazu pod 40 mil. km', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    // 38 mil. km od hlídkového CL (IDS Altair, [−66M, 0]), 92M od základny
    shipById(state, 1)!.pos = { x: -28_000_000, y: 0 }
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    for (const id of [...M10_PATROL, M10_GUARDIAN]) {
      expect(shipById(state, id)?.doctrine).toBe('hunter')
    }
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'enemy-captain'
      && e.text.includes('hlídka soustavy Cádiz'))).toBe(true)
    // pole podů se v této vzdálenosti ještě NEspustilo
    expect(state.missiles).toHaveLength(0)
  })

  it('ZVRAT A: vlajková loď pod 60 mil. km od základny ⇒ pole podů, salva 32 raket', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, 1)!.pos = { x: -62_000_000, y: 0 } // 58M od základny
    updateTriggers(state, scenario)
    const pods = state.missiles.filter(m => m.shooterId === M10_BASE)
    expect(pods).toHaveLength(32)
    expect(pods.every(m => m.side === 'enemy' && m.targetId === 1)).toBe(true)
    expect(state.events.some(e => e.kind === 'message'
      && e.text === 'Pole podů! Salva 32 raket!')).toBe(true)
    // pody neodečítají munici základny
    expect(shipById(state, M10_BASE)!.missiles).toBe(300)
  })

  it('ZVRAT B: rozkaz přijde při poškození základny pod 60 %', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, M10_BASE)!.hull = 400 // < 0.6 × 800
    updateTriggers(state, scenario)
    expect(state.flags['order-given']).toBe(true)
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'governor'
      && e.text.includes('okamžitě přerušte útok a stáhněte se'))).toBe(true)
    expect(objState(state, 'obj-retreat')).toBe('open')
    expect(state.outcome).toBe('running') // rozkaz sám o sobě nic nekončí
  })

  it('ZVRAT B: rozkaz přijde i po zničení obou hlídkových CA zástěny', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, M10_PATROL[0])!.destroyed = true
    shipById(state, M10_PATROL[1])!.destroyed = true
    updateTriggers(state, scenario)
    expect(state.flags['order-given']).toBe(true)
  })

  it('KONEC A „Rozkaz je rozkaz": ústup vlajkové lodi k bóji bez zničení základny', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, M10_BASE)!.hull = 400
    updateTriggers(state, scenario) // rozkaz
    shipById(state, 1)!.pos = { x: 150_000_000, y: 0 } // 5M od ústupové bóje
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(state.flags['ending-orders']).toBe(true)
    expect(state.flags['ending-spirit']).toBeUndefined()
    expect(state.flags['ending-clean']).toBeUndefined()
    expect(objState(state, 'obj-retreat')).toBe('done')
    expect(shipById(state, M10_BASE)!.destroyed).toBe(false) // základna stojí
  })

  it('KONEC B „Duch rozkazu": zničení základny PO rozkazu', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, M10_BASE)!.hull = 400
    updateTriggers(state, scenario) // rozkaz
    expect(state.flags['order-given']).toBe(true)
    shipById(state, M10_BASE)!.destroyed = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(state.flags['ending-spirit']).toBe(true)
    expect(state.flags['ending-clean']).toBeUndefined()
    expect(objState(state, 'obj-base')).toBe('done')
    expect(state.events.some(e => e.kind === 'message'
      && e.text.includes('minutu před platností příměří'))).toBe(true)
  })

  it('ČISTÉ VÍTĚZSTVÍ: základna padne PŘED rozkazem — rozkaz už nepřijde', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, M10_BASE)!.destroyed = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(state.flags['ending-clean']).toBe(true)
    expect(state.flags['order-given']).toBeUndefined()
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'governor')).toBe(false)
  })

  it('rozkaz nepřijde ani při souběhu „poškozená pod 60 % + zničená" v témže ticku', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    const base = shipById(state, M10_BASE)!
    base.hull = 200
    base.destroyed = true // salva prorazila 60 % i trup naráz
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.flags['order-given']).toBeUndefined() // hullBelow neplatí pro zničenou loď
    expect(state.flags['ending-clean']).toBe(true)
    expect(state.outcome).toBe('win')
  })

  it('kapitulace základny se počítá jako její pád (base-down)', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, M10_BASE)!.surrendered = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(state.flags['ending-clean']).toBe(true)
  })

  it('prohra: zničení vlajkové lodi', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, 1)!.destroyed = true
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('lose')
  })
})

describe('příběh misí 9–10 (story.ts)', () => {
  it('M9 i M10 mají neprázdný prolog, epilog i epilogLose', () => {
    for (const id of ['mission09', 'mission10']) {
      const story = MISSION_STORY[id]
      expect(story, `chybí příběh ${id}`).toBeDefined()
      expect(story.prolog.trim().length).toBeGreaterThan(50)
      expect(story.epilog.trim().length).toBeGreaterThan(50)
      expect(story.epilogLose!.trim().length).toBeGreaterThan(50)
    }
  })

  it('M10 má tři epilogy podle flagů konců', () => {
    const byFlag = MISSION_STORY.mission10.epilogByFlag!
    expect(Object.keys(byFlag).sort()).toEqual(['ending-clean', 'ending-orders', 'ending-spirit'])
    for (const text of Object.values(byFlag)) {
      expect(text.trim().length).toBeGreaterThan(50)
    }
  })

  it('kruh se uzavírá: M10 odkazuje na data z mise 4 a čas z mise 7; vlajkou je Vladař', () => {
    expect(/Auror/.test(MISSION_STORY.mission10.prolog)).toBe(true)   // mapy z mise 4
    expect(/Kerav/.test(MISSION_STORY.mission10.prolog)).toBe(true)   // konvoj z mise 7
    expect(/Vladař/.test(MISSION_STORY.mission10.prolog)).toBe(true)  // dreadnought ve finále
    expect(MISSION_STORY.mission09.epilog).toContain('Cádiz')         // M9 → M10
  })
})

describe('výkon finále', () => {
  it('mise 10 v plné bitvě (pody 32 raket + zástěna + DN + AUTO palba): 10 000 ticků < 8 s', () => {
    const state = sim.create(mission10)
    // svaz uprostřed průlomu: pole podů (32) letí, zástěna i strážný DN
    // loví, AUTO palba všech čtyř lodí svazu běží
    shipById(state, 1)!.pos = { x: -66_000_000, y: 0 }
    shipById(state, 2)!.pos = { x: -65_000_000, y: 2_000_000 }
    shipById(state, 3)!.pos = { x: -65_000_000, y: 1_000_000 }
    shipById(state, 4)!.pos = { x: -65_000_000, y: -1_000_000 }
    for (const [i, sid] of [1, 2, 3, 4].entries()) {
      sim.applyOrder(state, {
        kind: 'setFireControl', shipId: sid,
        fc: { mode: 'auto', targetId: M10_PATROL[i], driveMode: 0 },
      })
    }
    const t0 = performance.now()
    for (let i = 0; i < 10_000; i++) sim.tick(state, SIM_DT)
    const elapsed = performance.now() - t0
    // pody skutečně vyletěly (zátěž je reálná)
    expect(state.events.some(e => e.kind === 'launch' && (e.count ?? 0) >= 32)).toBe(true)
    expect(elapsed).toBeLessThan(8_000)
  })
})
