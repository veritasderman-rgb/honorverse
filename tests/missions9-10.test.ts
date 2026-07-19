/**
 * Testy misí 9–10 (finále kampaně) a nových podmínek triggerů
 * (flagNot, hullBelow). Mise 9: dva sledy invaze, obranné pody stanice,
 * win AND přes všech šest útočníků. Mise 10: pole podů, politický rozkaz
 * a TŘI konce (rozkaz / duch rozkazu / čisté vítězství). E2E běh mise 9
 * s pevným seedem — deterministický; hráč orchestrován přes applyOrder.
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

const WAVE1 = [9101, 9102, 9103]
const WAVE2 = [9201, 9202, 9203]
const ATTACKERS = [...WAVE1, ...WAVE2]

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
    expect(Object.keys(SCENARIOS)).toHaveLength(10)
    expect(SCENARIOS['mission09']).toBe(mission09)
    expect(SCENARIOS['mission10']).toBe(mission10)
    // M9: eskadra 4 lodí + stanice; hyperlimit KRUŽNICE kolem hvězdy
    expect(mission09.ships).toHaveLength(5)
    expect(mission09.hyperlimit).toEqual({
      kind: 'circle', center: { x: 0, y: 0 }, radius: 220_000_000,
    })
    // M10: úderný svaz 3 lodí + základna + 3 hlídkové lodě + ústupová bóje
    expect(mission10.ships).toHaveLength(8)
    expect(mission10.hyperlimit).toEqual({ kind: 'lineX', x: 150_000_000 })
  })

  it('M9: všechny 4 lodě eskadry jsou ovladatelné, stanice ne', () => {
    const state = sim.create(mission09)
    const ctrl = controllableShips(state)
    expect(ctrl.map(s => s.id)).toEqual([1, 2, 3, 4])
    expect(ctrl[0].classId).toBe('bc-praporec')  // vlajková loď
    expect(ctrl[0].name).toBe('ANS Praporec')
    const station = shipById(state, 5)!
    expect(station.classId).toBe('station-zeta')
    expect(station.doctrine).toBe('buoy')
    expect(station.wedgeOn).toBe(false)
    expect(station.pos).toEqual({ x: 0, y: 0 })
  })

  it('M10: vlajkový Praporec + Vanguard + Aurora; nedostavěná základna se sníženými subsystémy', () => {
    const state = sim.create(mission10)
    const ctrl = controllableShips(state)
    expect(ctrl.map(s => s.name)).toEqual(['ANS Praporec', 'ANS Vanguard', 'ANS Aurora'])
    expect(ctrl[0].vel.x).toBe(-3_000) // příchod z +x dovnitř soustavy
    const base = shipById(state, 4)!
    expect(base.classId).toBe('station-zeta')
    expect(base.side).toBe('enemy')
    expect(base.hull).toBe(300)
    expect(base.subsystems.tubesPort).toBe(0.5)
    expect(base.subsystems.tubesStbd).toBe(0.5)
    expect(base.subsystems.cm).toBe(0.6)
    expect(base.pos).toEqual({ x: -120_000_000, y: 0 })
    // hlídka startuje jako tichý drift
    for (const id of [5, 6, 7]) expect(shipById(state, id)?.doctrine).toBe('freighter')
    // ústupová bóje za hyperlimitem
    expect(shipById(state, 8)?.pos.x).toBe(155_000_000)
  })
})

describe('mise 9 — Obrana Albionu', () => {
  it('sled 1 přistává v t=300 na [200M, 40M] jako druhá linie (sensors/ecm 0.8)', () => {
    const scenario = structuredClone(mission09)
    const state = sim.create(scenario)
    expect(shipById(state, 9101)).toBeUndefined()
    state.t = 300
    updateTriggers(state, scenario)
    const lead = shipById(state, 9101)!
    expect(lead.classId).toBe('ca-bastion')
    expect(lead.side).toBe('enemy')
    expect(lead.doctrine).toBe('hunter')
    expect(lead.pos).toEqual({ x: 200_000_000, y: 40_000_000 })
    expect(lead.vel.x).toBeLessThan(0) // valí se dovnitř
    expect(lead.subsystems.sensors).toBe(0.8)
    expect(lead.subsystems.ecm).toBe(0.8)
    expect(shipById(state, 9102)?.classId).toBe('ca-bastion')
    expect(shipById(state, 9103)?.classId).toBe('cl-sokol')
    expect(shipById(state, 9201)).toBeUndefined() // sled 2 ještě ne
  })

  it('ZVRAT: sled 2 vystupuje v t=5400 na OPAČNÉ straně soustavy + panika Kontroly', () => {
    const scenario = structuredClone(mission09)
    const state = sim.create(scenario)
    state.t = 5_400
    updateTriggers(state, scenario)
    const lead = shipById(state, 9201)!
    expect(lead.classId).toBe('ca-bastion')
    expect(lead.pos).toEqual({ x: -190_000_000, y: -60_000_000 })
    // opačná strana: sled 1 na +x, sled 2 na −x
    expect(Math.sign(lead.pos.x)).toBe(-Math.sign(shipById(state, 9101)!.pos.x))
    expect(shipById(state, 9202)?.classId).toBe('cl-sokol')
    expect(shipById(state, 9203)?.classId).toBe('cl-sokol')
    expect(state.events.some(e => e.kind === 'message'
      && e.text.includes('Druhý sbor vystupuje z hyperu na opačné straně soustavy'))).toBe(true)
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'station'
      && e.text.includes('MEZI vámi a stanicí'))).toBe(true)
  })

  it('úvodní rozkaz guvernéra a direktoriátní ultimátum (comm)', () => {
    const scenario = structuredClone(mission09)
    const state = sim.create(scenario)
    state.t = 420
    updateTriggers(state, scenario)
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'governor')).toBe(true)
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'enemy-captain'
      && e.text.includes('historická nutnost'))).toBe(true)
  })

  it('stanice odpálí obranné pody (16 raket) na prvního útočníka pod 10 mil. km — jen JEDNOU', () => {
    const scenario = structuredClone(mission09)
    const state = sim.create(scenario)
    state.t = 300
    updateTriggers(state, scenario)

    // první útočník proklouzne ke stanici
    shipById(state, 9101)!.pos = { x: 9_000_000, y: 0 }
    updateTriggers(state, scenario)
    const pods = state.missiles.filter(m => m.shooterId === 5)
    expect(pods).toHaveLength(16)
    expect(pods.every(m => m.side === 'player' && m.targetId === 9101)).toBe(true)
    expect(state.flags['pods-away']).toBe(true)
    expect(state.events.some(e => e.kind === 'message'
      && e.text === 'Křižovatka aktivuje obranné pody!')).toBe(true)

    // druhý útočník u stanice už NIC nespustí (flagNot pods-away)
    shipById(state, 9102)!.pos = { x: 8_000_000, y: 0 }
    updateTriggers(state, scenario)
    expect(state.missiles.filter(m => m.shooterId === 5)).toHaveLength(16)
  })

  it('VÝHRA je AND všech šesti útočníků (zničení i kapitulace)', () => {
    const scenario = structuredClone(mission09)
    const state = sim.create(scenario)
    state.t = 5_400
    updateTriggers(state, scenario) // oba sledy na hřišti

    shipById(state, 9101)!.destroyed = true
    shipById(state, 9102)!.destroyed = true
    shipById(state, 9103)!.surrendered = true
    shipById(state, 9201)!.surrendered = true
    shipById(state, 9202)!.destroyed = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('running') // pět z šesti nestačí
    // hláška XO o geometrii po vyřazení sledu 1
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'xo'
      && e.text.includes('geometri'))).toBe(true)

    shipById(state, 9203)!.destroyed = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-invasion')).toBe('done')
    expect(objState(state, 'obj-station')).toBe('done')
  })

  it('prohra: zničení stanice NEBO vlajkové lodi NEBO 3 vlastních lodí', () => {
    // stanice
    const s1 = sim.create(structuredClone(mission09))
    shipById(s1, 5)!.destroyed = true
    updateTriggers(s1, structuredClone(mission09))
    expect(s1.outcome).toBe('lose')
    // vlajková loď
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
   * DŮKAZ HRATELNOSTI: pevnostní obrana u Křižovatky. Eskadra ve stěně drží
   * pozici v protiraketovém deštníku stanice (oblastní obrana), soustředěnou
   * AUTO palbou s palebnou kázní (na odvalený cíl nestřílet) rozbíjí oba
   * sledy; když dochází munice, torpédoborce se odpoutají hluboko do deštníku
   * stanice a zbytek dorazí poslední útočníky energetickou palbou zblízka
   * a výzvami ke kapitulaci. Deterministický win s pevným seedem.
   */
  it('mise 9 je hratelná: pevnostní obrana u stanice rozbije oba sledy (E2E)', () => {
    const state = sim.create(mission09)
    const order = (o: Order): void => sim.applyOrder(state, o)
    const SQUADRON = [1, 2, 3, 4]

    // stěna: Hradba, Vichr a Bouře drží sloty na vlajkovém Praporci;
    // celá eskadra stojí 1,5 mil. km od stanice — uvnitř jejího CM deštníku
    order({ kind: 'setFormation', shipId: 2, leaderId: 1, slot: 1, formation: 'wall' })
    order({ kind: 'setFormation', shipId: 3, leaderId: 1, slot: 2, formation: 'wall' })
    order({ kind: 'setFormation', shipId: 4, leaderId: 1, slot: 3, formation: 'wall' })
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
    while (state.outcome === 'running' && state.t < 40_000) {
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
      if (!ddsDetached && squadronMissiles < 40) {
        ddsDetached = true
        order({ kind: 'clearFormation', shipId: 3 })
        order({ kind: 'clearFormation', shipId: 4 })
        order({ kind: 'setCourse', shipId: 3, dest: { x: 300_000, y: 900_000 }, arriveAtRest: true })
        order({ kind: 'setCourse', shipId: 4, dest: { x: 300_000, y: -900_000 }, arriveAtRest: true })
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
        for (const sid of [1, 2]) {
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
    expect(shipById(state, 1)!.destroyed).toBe(false) // vlajková loď žije
    expect(shipById(state, 5)!.destroyed).toBe(false) // Křižovatka stojí
    expect(objState(state, 'obj-invasion')).toBe('done')
    expect(objState(state, 'obj-station')).toBe('done')
    // zvrat opravdu proběhl: druhý sled se objevil a byl vyřazen
    expect(WAVE2.every(id => state.flags[`neutralized-${id}`])).toBe(true)
  }, 120_000)
})

describe('mise 10 — Kastor (finále, dva konce)', () => {
  it('fáze 1: hlídka se budí detekcí svazu pod 40 mil. km (drift → hunter, comm)', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    // 38 mil. km od hlídkového CL (VDS Altair, [−66M, 0]), 92M od základny
    shipById(state, 1)!.pos = { x: -28_000_000, y: 0 }
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    for (const id of [5, 6, 7]) expect(shipById(state, id)?.doctrine).toBe('hunter')
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'enemy-captain'
      && e.text.includes('hlídka soustavy Kastor'))).toBe(true)
    // pole podů se v této vzdálenosti ještě NEspustilo
    expect(state.missiles).toHaveLength(0)
  })

  it('ZVRAT A: vlajková loď pod 60 mil. km od základny ⇒ pole podů, salva 32 raket', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, 1)!.pos = { x: -62_000_000, y: 0 } // 58M od základny
    updateTriggers(state, scenario)
    const pods = state.missiles.filter(m => m.shooterId === 4)
    expect(pods).toHaveLength(32)
    expect(pods.every(m => m.side === 'enemy' && m.targetId === 1)).toBe(true)
    expect(state.events.some(e => e.kind === 'message'
      && e.text === 'Pole podů! Salva 32 raket!')).toBe(true)
    // pody neodečítají munici základny
    expect(shipById(state, 4)!.missiles).toBe(300)
  })

  it('ZVRAT B: rozkaz přijde při poškození základny pod 60 %', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, 4)!.hull = 200 // < 0.6 × 400
    updateTriggers(state, scenario)
    expect(state.flags['order-given']).toBe(true)
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'governor'
      && e.text.includes('okamžitě přerušte útok a stáhněte se'))).toBe(true)
    expect(objState(state, 'obj-retreat')).toBe('open')
    expect(state.outcome).toBe('running') // rozkaz sám o sobě nic nekončí
  })

  it('ZVRAT B: rozkaz přijde i po zničení obou hlídkových CA', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, 5)!.destroyed = true
    shipById(state, 6)!.destroyed = true
    updateTriggers(state, scenario)
    expect(state.flags['order-given']).toBe(true)
  })

  it('KONEC A „Rozkaz je rozkaz": ústup vlajkové lodi k bóji bez zničení základny', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, 4)!.hull = 200
    updateTriggers(state, scenario) // rozkaz
    shipById(state, 1)!.pos = { x: 150_000_000, y: 0 } // 5M od ústupové bóje
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(state.flags['ending-orders']).toBe(true)
    expect(state.flags['ending-spirit']).toBeUndefined()
    expect(state.flags['ending-clean']).toBeUndefined()
    expect(objState(state, 'obj-retreat')).toBe('done')
    expect(shipById(state, 4)!.destroyed).toBe(false) // základna stojí
  })

  it('KONEC B „Duch rozkazu": zničení základny PO rozkazu', () => {
    const scenario = structuredClone(mission10)
    const state = sim.create(scenario)
    shipById(state, 4)!.hull = 200
    updateTriggers(state, scenario) // rozkaz
    expect(state.flags['order-given']).toBe(true)
    shipById(state, 4)!.destroyed = true
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
    shipById(state, 4)!.destroyed = true
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
    const base = shipById(state, 4)!
    base.hull = 100
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
    shipById(state, 4)!.surrendered = true
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

  it('kruh se uzavírá: M10 odkazuje na data z mise 4 a čas z mise 7', () => {
    expect(/Auror/.test(MISSION_STORY.mission10.prolog)).toBe(true)   // mapy z mise 4
    expect(/Kerav/.test(MISSION_STORY.mission10.prolog)).toBe(true)   // konvoj z mise 7
    expect(MISSION_STORY.mission09.epilog).toContain('Kastor')        // M9 → M10
  })
})

describe('výkon finále', () => {
  it('mise 10 v plné bitvě (pody 32 raket + hlídka + AUTO palba): 10 000 ticků < 5 s', () => {
    const state = sim.create(mission10)
    // svaz uprostřed průlomu: pole podů (32) letí, hlídka loví, AUTO palba běží
    shipById(state, 1)!.pos = { x: -66_000_000, y: 0 }
    shipById(state, 2)!.pos = { x: -65_000_000, y: 1_000_000 }
    shipById(state, 3)!.pos = { x: -65_000_000, y: -1_000_000 }
    for (const [i, sid] of [1, 2, 3].entries()) {
      sim.applyOrder(state, {
        kind: 'setFireControl', shipId: sid,
        fc: { mode: 'auto', targetId: 5 + i, driveMode: 0 },
      })
    }
    const t0 = performance.now()
    for (let i = 0; i < 10_000; i++) sim.tick(state, SIM_DT)
    const elapsed = performance.now() - t0
    // pody skutečně vyletěly (zátěž je reálná)
    expect(state.events.some(e => e.kind === 'launch' && (e.count ?? 0) >= 32)).toBe(true)
    expect(elapsed).toBeLessThan(5_000)
  })
})
