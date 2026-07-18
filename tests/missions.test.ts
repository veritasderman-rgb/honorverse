/**
 * Testy misí 2–4 a nových trigger podmínek (wedgeOn, shipsDestroyedCount).
 * E2E běhy přes engine s pevnými seedy — deterministické, žádná flakiness;
 * hráč je orchestrován přímými applyOrder.
 */
import { describe, expect, it } from 'vitest'
import type { Scenario, SimState } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { SENSOR_UPDATE_INTERVAL, SIM_DT } from '../src/sim/constants'
import { add, angleDiff, angleOf, dist, norm, scale, sub } from '../src/sim/vec'
import { updateSensors, contactsFor } from '../src/sim/sensors'
import { updateTriggers } from '../src/sim/scenario'
import { SCENARIOS } from '../src/data/missions'
import { mission02 } from '../src/data/missions/mission02'
import { mission03 } from '../src/data/missions/mission03'
import { mission04 } from '../src/data/missions/mission04'

/** minimální scénář pro testy podmínek */
function makeScenario(partial: Partial<Scenario>): Scenario {
  return { id: 'test', title: 'Test', briefing: '', seed: 1, ships: [], objectives: [], triggers: [], ...partial }
}

/** vynutí přepočet senzorů (dt = celý interval) */
const runSensors = (state: SimState) => updateSensors(state, SENSOR_UPDATE_INTERVAL)

const objState = (state: SimState, id: string) => state.objectives.find(o => o.id === id)?.state

describe('nové podmínky triggerů', () => {
  it('wedgeOn: splněno jen se zapnutým klínem živé lodi', () => {
    const scenario = makeScenario({
      ships: [{
        classId: 'cl-sokol', side: 'player', name: 'A',
        pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, wedgeOn: false,
      }],
      triggers: [{
        id: 't-wedge', once: true,
        conditions: [{ kind: 'wedgeOn', shipId: 1 }],
        actions: [{ kind: 'setFlag', flag: 'prozrazen' }],
      }],
    })
    const state = sim.create(scenario)
    updateTriggers(state, scenario)
    expect(state.flags['prozrazen']).toBeUndefined() // klín vypnut

    state.ships[0].wedgeOn = true
    updateTriggers(state, scenario)
    expect(state.flags['prozrazen']).toBe(true)

    // zničená loď podmínku nesplní
    const scenario2 = structuredClone(scenario)
    const state2 = sim.create(scenario2)
    state2.ships[0].wedgeOn = true
    state2.ships[0].destroyed = true
    updateTriggers(state2, scenario2)
    expect(state2.flags['prozrazen']).toBeUndefined()
  })

  it('shipsDestroyedCount: počítá zničené lodě jen dané strany', () => {
    const scenario = makeScenario({
      ships: [
        { classId: 'dd-vichr', side: 'player', name: 'DD', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'merch-freighter', side: 'player', name: 'M1', pos: { x: 1, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'merch-freighter', side: 'player', name: 'M2', pos: { x: 2, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'cl-sokol', side: 'enemy', name: 'E', pos: { x: 3, y: 0 }, vel: { x: 0, y: 0 } },
      ],
      triggers: [{
        id: 't-losses', once: true,
        conditions: [{ kind: 'shipsDestroyedCount', side: 'player', count: 2 }],
        actions: [{ kind: 'setFlag', flag: 'ztraty' }],
      }],
    })
    const state = sim.create(scenario)
    state.ships[3].destroyed = true // enemy se nepočítá
    state.ships[1].destroyed = true // 1. ztráta player
    updateTriggers(state, scenario)
    expect(state.flags['ztraty']).toBeUndefined()

    state.ships[2].destroyed = true // 2. ztráta player
    updateTriggers(state, scenario)
    expect(state.flags['ztraty']).toBe(true)
  })
})

describe('registrace misí', () => {
  it('mise 2–4 jsou v SCENARIOS a mají očekávaný tvar', () => {
    expect(SCENARIOS['mission02']).toBe(mission02)
    expect(SCENARIOS['mission03']).toBe(mission03)
    expect(SCENARIOS['mission04']).toBe(mission04)
    expect(mission02.ships).toHaveLength(7)     // hráč + 4 obchodníci + bóje + pirát
    expect(mission02.objectives).toHaveLength(2)
    expect(mission03.ships).toHaveLength(3)     // hráč + Q-ship + stanice
    expect(mission04.ships).toHaveLength(5)     // hráč + 3 hlídky + bóje
  })
})

describe('mise 2 — Konvoj Pomezím (E2E)', () => {
  it('obchodníci letí k cíli, zvrat spawne 2 piráty a piráti pronásledují konvoj', () => {
    const state = sim.create(mission02)
    expect(state.ships.map(s => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7])

    // (a) obchodníci s přednastaveným nav kurzem se hýbou k bóji (+x)
    const x0 = state.ships.slice(1, 5).map(s => s.pos.x)
    const d0 = dist(state.ships[1].pos, state.ships[5].pos)
    for (let i = 0; i < 600; i++) sim.tick(state, SIM_DT)
    for (let m = 0; m < 4; m++) {
      expect(state.ships[1 + m].pos.x).toBeGreaterThan(x0[m] + 100_000)
      expect(state.ships[1 + m].vel.x).toBeGreaterThan(300) // akcelerují k cíli
    }
    expect(dist(state.ships[1].pos, state.ships[5].pos)).toBeLessThan(d0)

    // (b) hráč se rozjede za návnadou → zvrat: 2 piráti z opačné strany
    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1 })
    sim.applyOrder(state, { kind: 'intercept', shipId: 1, targetId: 7 })
    while (!state.flags['ambush'] && state.t < 7200) sim.tick(state, SIM_DT)
    expect(state.flags['ambush']).toBe(true)
    expect(state.t).toBeLessThan(7200)
    expect(dist(state.ships[0].pos, state.ships[6].pos)).toBeLessThan(10_000_000)
    expect(state.ships).toHaveLength(9)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('návnada'))).toBe(true)
    for (const id of [8, 9]) {
      const p = state.ships.find(s => s.id === id)!
      expect(p.side).toBe('enemy')
      expect(p.classId).toBe('dd-vichr')
      expect(p.doctrine).toBe('pirate')
      expect(p.pos.y).toBeLessThan(0) // opačná strana konvoje než návnada
    }

    // (c) po senzorovém intervalu piráti pronásledují lodě konvoje
    for (let i = 0; i < 30; i++) sim.tick(state, SIM_DT)
    const convoyIds = [1, 2, 3, 4, 5]
    for (const id of [7, 8, 9]) {
      const p = state.ships.find(s => s.id === id)!
      expect(p.nav?.kind).toBe('intercept')
      if (p.nav?.kind === 'intercept') expect(convoyIds).toContain(p.nav.targetId)
    }
    // spawnutí piráti jdou po nejbližším obchodníkovi (ne po eskortě)
    for (const id of [8, 9]) {
      const p = state.ships.find(s => s.id === id)!
      if (p.nav?.kind === 'intercept') expect([2, 3, 4, 5]).toContain(p.nav.targetId)
    }
  })

  it('výhra: aspoň 3 obchodníci u bóje (flagy + AND trigger)', () => {
    const state = sim.create(mission02)
    for (const i of [1, 2, 3]) state.ships[i].pos = { x: 147_000_000, y: 0 } // 3M od bóje
    sim.tick(state, SIM_DT)
    expect(state.flags['arrived-2']).toBe(true)
    expect(state.flags['arrived-3']).toBe(true)
    expect(state.flags['arrived-4']).toBe(true)
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-convoy')).toBe('done')
  })

  it('prohra: 2 zničení obchodníci (shipsDestroyedCount side player)', () => {
    const state = sim.create(mission02)
    state.ships[1].destroyed = true
    state.ships[2].destroyed = true
    sim.tick(state, SIM_DT)
    expect(state.outcome).toBe('lose')
    expect(objState(state, 'obj-convoy')).toBe('failed')
    expect(state.events.some(e => e.text.includes('neúnosné ztráty'))).toBe(true)
  })
})

describe('mise 3 — Q-ship (E2E)', () => {
  it('zvrat vyžaduje čas > 1800 s I přiblížení pod 800 tis. km (AND)', () => {
    const scenario = structuredClone(mission03)
    const state = sim.create(scenario)
    state.ships[0].pos = { x: 1_500_000, y: 0 } // 500 tis. km od Mercatoru
    updateTriggers(state, scenario)
    expect(state.flags['qship-revealed']).toBeUndefined() // čas ještě neuplynul
    state.t = 1800
    updateTriggers(state, scenario)
    expect(state.flags['qship-revealed']).toBe(true)
  })

  it('doprovod → zvrat → Q-ship útočí → zničení Q-shipu vyhrává', () => {
    const state = sim.create(mission03)

    // (a) doleť před obchodníka a vyrovnej rychlost (zastav se na jeho trase)
    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1 })
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 7_000_000, y: 0 }, arriveAtRest: true })
    while (!state.flags['qship-revealed'] && state.t < 30_000) sim.tick(state, SIM_DT)

    // (b) zvrat: čas > 1800 s a vzdálenost < 800 tis. km ⇒ hunter + odhalení
    expect(state.flags['qship-revealed']).toBe(true)
    expect(state.t).toBeGreaterThan(1800)
    expect(dist(state.ships[0].pos, state.ships[1].pos)).toBeLessThan(800_000)
    expect(state.ships[1].doctrine).toBe('hunter')
    expect(objState(state, 'obj-escort')).toBe('failed')
    expect(objState(state, 'obj-destroy')).toBe('open') // nový úkol přidán za běhu
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('pomocný křižník'))).toBe(true)
    // revealClass: kontakt hráče teď hlásí skutečnou třídu
    runSensors(state)
    expect(contactsFor(state, 'player').find(c => c.shipId === 2)?.classGuess).toBe('merch-qship')

    // (c) boj: hráč kituje s odstupem, salvy + rolování; Q-ship útočí
    const drive = (): void => {
      const p = state.ships[0], q = state.ships[1]
      if (p.destroyed || q.destroyed) return
      const d = dist(p.pos, q.pos)
      // bang-bang kiting: drž odstup 2.5–4.5 mil. km
      if (d < 2_500_000 && !(p.nav?.kind === 'course')) {
        const away = add(p.pos, scale(norm(sub(p.pos, q.pos)), 100_000_000))
        sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: away, arriveAtRest: false })
      } else if (d > 4_500_000 && !(p.nav?.kind === 'intercept')) {
        sim.applyOrder(state, { kind: 'intercept', shipId: 1, targetId: 2 })
      }
      if (p.tubeCooldown <= 0 && p.missiles > 0 && d < 5_500_000) {
        sim.applyOrder(state, { kind: 'launchSalvo', shipId: 1, targetId: 2, count: 6, mode: d < 1_500_000 ? 1 : 0 })
      }
      if (p.energyCooldown <= 0 && d < 350_000) {
        sim.applyOrder(state, { kind: 'fireEnergy', shipId: 1, targetId: 2 })
      }
      // rolování: klín proti nejbližší příchozí raketě
      let threat: number | null = null
      let threatD = Infinity
      for (const m of state.missiles) {
        if (m.side !== 'enemy' || m.targetId !== 1 || m.phase === 'dead') continue
        const md = dist(m.pos, p.pos)
        if (md < 500_000 && md < threatD) { threatD = md; threat = angleOf(sub(m.pos, p.pos)) }
      }
      if (threat !== null) {
        if (p.rolledTo === null || Math.abs(angleDiff(threat, p.rolledTo)) > 0.2) {
          sim.applyOrder(state, { kind: 'roll', shipId: 1, towards: threat })
        }
      } else if (p.rolledTo !== null) {
        sim.applyOrder(state, { kind: 'roll', shipId: 1, towards: null })
      }
    }

    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1 })
    let sawEnemyMissile = false
    while (state.outcome === 'running' && state.t < 8 * 3600) {
      sim.tick(state, SIM_DT)
      drive()
      if (!sawEnemyMissile && state.missiles.some(m => m.side === 'enemy')) sawEnemyMissile = true
    }

    // Q-ship skutečně útočil (rakety letěly, hráč utržil poškození)
    expect(sawEnemyMissile).toBe(true)
    expect(state.ships[0].hull).toBeLessThan(60)

    // (d) deterministický výsledek: Q-ship zničen ⇒ vítězství
    expect(state.outcome).toBe('win')
    expect(state.ships[1].destroyed).toBe(true)
    expect(objState(state, 'obj-destroy')).toBe('done')
  })

  it('zničení hráče prohrává', () => {
    const scenario = structuredClone(mission03)
    const state = sim.create(scenario)
    state.ships[0].destroyed = true
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('lose')
  })
})

describe('mise 4 — Tichý pozorovatel', () => {
  it('hráč startuje bez klínu a hlídka ho na 8 mil. km nevidí', () => {
    const state = sim.create(mission04)
    expect(state.ships[0].wedgeOn).toBe(false)

    // 8 mil. km od hlídky Antares (CL, pasivní dosah 6 mil. km)
    state.ships[0].pos = { x: 60_000_000, y: 18_000_000 }
    runSensors(state)
    expect(contactsFor(state, 'enemy').some(c => c.shipId === 1)).toBe(false)
    // hráč naopak hlídky vidí — jejich klíny jsou zapnuté
    for (const id of [2, 3, 4]) {
      expect(contactsFor(state, 'player').some(c => c.shipId === id)).toBe(true)
    }
  })

  it('zapnutí klínu spustí detekci: hlídky přejdou na hunter', () => {
    const state = sim.create(mission04)
    sim.tick(state, SIM_DT)
    expect(state.flags['detected']).toBeUndefined() // drift bez klínu = ticho

    sim.applyOrder(state, { kind: 'setWedge', shipId: 1, on: true })
    sim.tick(state, SIM_DT)
    expect(state.flags['detected']).toBe(true)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('Prozrazen'))).toBe(true)
    for (const i of [1, 2, 3]) expect(state.ships[i].doctrine).toBe('hunter')
  })

  it('přiblížení pod 4 mil. km k hlídce prozradí i bez klínu', () => {
    const scenario = structuredClone(mission04)
    const state = sim.create(scenario)
    state.ships[0].pos = { x: 60_000_000, y: 13_500_000 } // 3.5 mil. km od Antaresu
    updateTriggers(state, scenario)
    expect(state.flags['detected']).toBe(true)
    expect(state.ships[1].doctrine).toBe('hunter')
  })

  it('zmapování všech hlídek spawne kurýra Hermes; záchrana a únik vyhrávají', () => {
    const scenario = structuredClone(mission04)
    const state = sim.create(scenario)

    // (a) postupné přiblížení na 5 mil. km ke každé hlídce (pod 6, nad 4)
    for (const i of [1, 2, 3]) {
      const patrol = state.ships[i]
      state.ships[0].pos = { x: patrol.pos.x, y: patrol.pos.y + 5_000_000 }
      updateTriggers(state, scenario)
    }
    expect(state.flags['scouted-2']).toBe(true)
    expect(state.flags['scouted-3']).toBe(true)
    expect(state.flags['scouted-4']).toBe(true)
    expect(state.flags['mapped']).toBe(true)
    expect(state.flags['detected']).toBeUndefined() // pořád nezpozorován
    expect(objState(state, 'obj-map')).toBe('done')

    // (b) zvrat: kurýr Hermes spawnut + volitelný úkol přidán za běhu
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('Hermes'))).toBe(true)
    const hermes = state.ships.find(s => s.id === 6)
    expect(hermes).toBeDefined()
    expect(hermes?.classId).toBe('disp-courier')
    expect(hermes?.side).toBe('player')
    expect(hermes?.wedgeOn).toBe(false) // driftuje bez pohonu
    expect(objState(state, 'obj-rescue')).toBe('open')

    // (c) záchrana: přiblížení na 500 tis. km ke kurýrovi
    state.ships[0].pos = { x: hermes!.pos.x, y: hermes!.pos.y + 300_000 }
    updateTriggers(state, scenario)
    expect(objState(state, 'obj-rescue')).toBe('done')
    expect(state.events.some(e => e.text.includes('na palubě'))).toBe(true)

    // (d) únik za hyperlimit se zmapovanými silami ⇒ vítězství
    state.ships[0].pos = { x: -198_000_000, y: 0 }
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-escape')).toBe('done')
  })

  it('únik k bóji bez zmapování nevyhrává (AND s flagem mapped)', () => {
    const scenario = structuredClone(mission04)
    const state = sim.create(scenario)
    state.ships[0].pos = { x: -198_000_000, y: 0 }
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('running')
  })
})
