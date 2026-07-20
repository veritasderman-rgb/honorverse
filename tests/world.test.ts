/**
 * Testy senzorů, scénářového systému, triggerů a AI doktrín.
 * Stav se staví přes sim.create + spawnShip s minimálními scénáři.
 */
import { describe, expect, it } from 'vitest'
import type { Order, Scenario, SimState } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { C, SENSOR_UPDATE_INTERVAL, STANDARD_THROTTLE } from '../src/sim/constants'
import { updateSensors, contactsFor } from '../src/sim/sensors'
import { collectAIOrders } from '../src/sim/ai'
import { updateTriggers } from '../src/sim/scenario'
import { SCENARIOS } from '../src/data/missions'
import { mission01 } from '../src/data/missions/mission01'

/** minimální scénář pro testy */
function makeScenario(partial: Partial<Scenario>): Scenario {
  return { id: 'test', title: 'Test', briefing: '', seed: 1, ships: [], objectives: [], triggers: [], ...partial }
}

/** postaví stav — plný create už lodě scénáře spawnuje sám (id od 1 dle pořadí) */
function build(scenario: Scenario): SimState {
  return sim.create(scenario)
}

/** vynutí přepočet senzorů (dt = celý interval) */
const runSensors = (state: SimState) => updateSensors(state, SENSOR_UPDATE_INTERVAL)

describe('spawnShip', () => {
  it('přiděluje id dle pořadí pole ships od 1 a plní výchozí hodnoty z defs', () => {
    const scenario = makeScenario({
      ships: [
        { classId: 'dd-vichr', side: 'player', name: 'A', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'merch-runner', side: 'enemy', name: 'B', pos: { x: 1, y: 0 }, vel: { x: 0, y: 0 } },
      ],
    })
    const state = build(scenario)
    expect(state.ships.map(s => s.id)).toEqual([1, 2])
    const dd = state.ships[0]
    expect(dd.hull).toBe(120)                    // hullPoints dd-vichr (zdvojeno — lodě umírají po částech)
    expect(dd.missiles).toBe(90)                 // magazineMissiles
    expect(dd.throttle).toBe(STANDARD_THROTTLE)
    expect(dd.wedgeOn).toBe(true)
    expect(dd.nav).toBeNull()
    expect(dd.heading).toBe(0)
    expect(dd.doctrine).toBe('player')           // default pro side player
    expect(dd.subsystems.impellerFwd).toBe(1)
    expect(state.ships[1].doctrine).toBe('freighter') // default pro ostatní strany
  })
})

describe('senzory', () => {
  const twoShips = (targetPos: { x: number; y: number }, wedgeOn: boolean) =>
    build(makeScenario({
      ships: [
        { classId: 'dd-vichr', side: 'player', name: 'DD', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'merch-freighter', side: 'enemy', name: 'M', pos: targetPos, vel: { x: 0, y: 0 }, wedgeOn },
      ],
    }))

  it('loď s vypnutým klínem za activeSensorRange není vidět', () => {
    // 10 mil. km > activeSensorRange DD (5 mil. km), klín vypnut
    const state = twoShips({ x: 10_000_000, y: 0 }, false)
    runSensors(state)
    expect(contactsFor(state, 'player')).toHaveLength(0)
  })

  it('stejná loď se zapnutým klínem vidět je (detekce klínu) + event contactNew', () => {
    const state = twoShips({ x: 10_000_000, y: 0 }, true)
    runSensors(state)
    const contacts = contactsFor(state, 'player')
    expect(contacts).toHaveLength(1)
    expect(contacts[0].shipId).toBe(2)
    expect(contacts[0].wedgeDetected).toBe(true)
    expect(contacts[0].idQuality).toBe(0)          // jen klín
    expect(contacts[0].classGuess).toBe('neznámá')
    const ev = state.events.find(e => e.kind === 'contactNew')
    expect(ev).toBeDefined()
    expect(ev?.slowdown).toBe(true)
  })

  it('klín = gravitická FTL detekce (age 0, real-time); bez klínu EM zpoždění d/C', () => {
    // zapnutý klín: obraz v reálném čase
    const wedge = build(makeScenario({
      ships: [
        { classId: 'dd-vichr', side: 'player', name: 'DD', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'merch-freighter', side: 'enemy', name: 'M', pos: { x: 10_000_000, y: 0 }, vel: { x: 500, y: 0 } },
      ],
    }))
    runSensors(wedge)
    const cw = contactsFor(wedge, 'player')[0]
    expect(cw.age).toBe(0)
    expect(cw.pos.x).toBeCloseTo(10_000_000, 3)
    expect(cw.vel.x).toBe(500)

    // vypnutý klín (jen EM zblízka): obraz starý d/C, pozice zpožděná
    const em = build(makeScenario({
      ships: [
        { classId: 'dd-vichr', side: 'player', name: 'DD', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        {
          classId: 'merch-freighter', side: 'enemy', name: 'M',
          pos: { x: 4_000_000, y: 0 }, vel: { x: 500, y: 0 }, wedgeOn: false,
        },
      ],
    }))
    runSensors(em)
    const ce = contactsFor(em, 'player')[0]
    const expectedAge = 4_000_000 / C
    expect(ce.age).toBeCloseTo(expectedAge, 6)
    expect(ce.pos.x).toBeCloseTo(4_000_000 - 500 * expectedAge, 3)
  })

  it('loď bez klínu uvnitř activeSensorRange vidět je; s aktivními senzory idQuality 2', () => {
    const state = twoShips({ x: 1_000_000, y: 0 }, false)
    runSensors(state)
    let c = contactsFor(state, 'player')[0]
    expect(c).toBeDefined()
    expect(c.idQuality).toBe(1)                    // < 2×activeSensorRange, bez aktivních
    expect(c.classGuess).toBe('neznámá')

    state.ships[0].activeSensors = true
    runSensors(state)
    c = contactsFor(state, 'player')[0]
    expect(c.idQuality).toBe(2)
    expect(c.classGuess).toBe('merch-freighter')   // plná identifikace
  })

  it('flag revealed:<id> vynutí skutečnou třídu i při nízké idQuality', () => {
    const state = twoShips({ x: 10_000_000, y: 0 }, true)
    state.flags['revealed:2'] = true
    runSensors(state)
    const c = contactsFor(state, 'player')[0]
    expect(c.idQuality).toBe(0)
    expect(c.classGuess).toBe('merch-freighter')
  })

  it('neutral strana kontakty nedostává', () => {
    const state = twoShips({ x: 1_000_000, y: 0 }, true)
    runSensors(state)
    expect(contactsFor(state, 'neutral')).toHaveLength(0)
  })
})

describe('triggery', () => {
  const scenarioWithTriggers = (): Scenario => makeScenario({
    ships: [
      { classId: 'dd-vichr', side: 'player', name: 'DD', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
      { classId: 'merch-runner', side: 'enemy', name: 'R', pos: { x: 2_000_000, y: 0 }, vel: { x: 0, y: 0 } },
    ],
    objectives: [{ id: 'obj-a', text: 'Úkol A', state: 'open' }],
    triggers: [
      {
        id: 't-close', once: true,
        conditions: [{ kind: 'distanceBelow', shipA: 1, shipB: 2, distance: 3_000_000 }],
        actions: [
          { kind: 'setFlag', flag: 'blizko' },
          { kind: 'message', text: 'Kontakt na dosah.' },
        ],
      },
      {
        id: 't-and', once: true,
        conditions: [
          { kind: 'flag', flag: 'povel' },
          { kind: 'distanceBelow', shipA: 1, shipB: 2, distance: 3_000_000 },
        ],
        actions: [{ kind: 'objectiveComplete', objectiveId: 'obj-a' }],
      },
      {
        id: 't-win', once: true,
        conditions: [{ kind: 'shipDestroyed', shipId: 2 }],
        actions: [{ kind: 'winMission' }],
      },
    ],
  })

  it('distanceBelow spustí akce (flag + message)', () => {
    const scenario = scenarioWithTriggers()
    const state = build(scenario)
    updateTriggers(state, scenario)
    expect(state.flags['blizko']).toBe(true)
    expect(state.events.some(e => e.kind === 'message' && e.text === 'Kontakt na dosah.')).toBe(true)
  })

  it('once trigger nevystřelí dvakrát', () => {
    const scenario = scenarioWithTriggers()
    const state = build(scenario)
    updateTriggers(state, scenario)
    const messagesAfterFirst = state.events.filter(e => e.kind === 'message').length
    updateTriggers(state, scenario)
    expect(state.events.filter(e => e.kind === 'message').length).toBe(messagesAfterFirst)
  })

  it('podmínky jsou AND — bez flagu nevystřelí, s flagem ano', () => {
    const scenario = scenarioWithTriggers()
    const state = build(scenario)
    updateTriggers(state, scenario)
    expect(state.objectives[0].state).toBe('open')   // flag 'povel' chybí
    state.flags['povel'] = true
    updateTriggers(state, scenario)
    expect(state.objectives[0].state).toBe('done')
    expect(state.events.some(e => e.kind === 'objective')).toBe(true)
  })

  it('winMission nastaví outcome', () => {
    const scenario = scenarioWithTriggers()
    const state = build(scenario)
    state.ships[1].destroyed = true
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
  })
})

describe('AI doktríny', () => {
  const runnerScenario = (playerPos: { x: number; y: number }) => makeScenario({
    ships: [
      { classId: 'dd-vichr', side: 'player', name: 'DD', pos: playerPos, vel: { x: 0, y: 0 } },
      { classId: 'merch-runner', side: 'enemy', name: 'Cygnus', pos: { x: 40_000_000, y: 0 }, vel: { x: 500, y: 0 }, doctrine: 'runner' },
    ],
  })

  it('runner se bez flagu chová jako freighter (žádné rozkazy)', () => {
    const state = build(runnerScenario({ x: 35_000_000, y: 0 }))
    runSensors(state)
    expect(collectAIOrders(state)).toHaveLength(0)
  })

  it('runner po nastavení flagu prchá plným tahem k +x', () => {
    const state = build(runnerScenario({ x: 35_000_000, y: 0 }))
    state.flags['runner-fleeing'] = true
    runSensors(state)
    const orders = collectAIOrders(state)
    const throttle = orders.find((o): o is Order & { kind: 'setThrottle' } => o.kind === 'setThrottle')
    expect(throttle?.shipId).toBe(2)
    expect(throttle?.throttle).toBe(1)
    const course = orders.find((o): o is Order & { kind: 'setCourse' } => o.kind === 'setCourse')
    expect(course?.shipId).toBe(2)
    // kurz pryč od pronásledovatele, za hyperlimitní čáru x > 250 mil. km
    expect(course && course.dest.x).toBeGreaterThan(250_000_000)
  })

  it('runner < 3 mil. km od pronásledovatele odpálí salvu 2 raket mode 1', () => {
    const state = build(runnerScenario({ x: 37_500_000, y: 0 })) // 2,5 mil. km
    state.flags['runner-fleeing'] = true
    runSensors(state)
    const orders = collectAIOrders(state)
    const salvo = orders.find((o): o is Order & { kind: 'launchSalvo' } => o.kind === 'launchSalvo')
    expect(salvo).toBeDefined()
    expect(salvo?.shipId).toBe(2)
    expect(salvo?.targetId).toBe(1)
    expect(salvo?.count).toBe(2)
    expect(salvo?.mode).toBe(1)
  })

  it('freighter a buoy negenerují rozkazy', () => {
    const state = build(makeScenario({
      ships: [
        { classId: 'dd-vichr', side: 'player', name: 'DD', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'merch-freighter', side: 'enemy', name: 'M', pos: { x: 1_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter' },
        { classId: 'merch-freighter', side: 'neutral', name: 'B', pos: { x: 2_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'buoy', wedgeOn: false },
      ],
    }))
    runSensors(state)
    expect(collectAIOrders(state)).toHaveLength(0)
  })

  it('pirát pronásleduje obchodníka a při hull < 50 % prchá', () => {
    const state = build(makeScenario({
      ships: [
        { classId: 'merch-freighter', side: 'player', name: 'Obchodník', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'cl-sokol', side: 'enemy', name: 'Pirát', pos: { x: 10_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'pirate', activeSensors: true },
      ],
    }))
    runSensors(state)
    let orders = collectAIOrders(state)
    const icept = orders.find((o): o is Order & { kind: 'intercept' } => o.kind === 'intercept')
    expect(icept?.shipId).toBe(2)
    expect(icept?.targetId).toBe(1)

    // poškození pod 50 % → útěk (course pryč od hrozby, tj. na +x)
    state.ships[1].hull = 60 // CL Korzár má 140 — pod 50 %
    orders = collectAIOrders(state)
    expect(orders.some(o => o.kind === 'intercept')).toBe(false)
    const flee = orders.find((o): o is Order & { kind: 'setCourse' } => o.kind === 'setCourse')
    expect(flee).toBeDefined()
    expect(flee && flee.dest.x).toBeGreaterThan(10_000_000)
  })
})

describe('mise 1 — Hlídka u Strážné brány', () => {
  it('je registrovaná v SCENARIOS a má 3 lodě + 2 objectives', () => {
    expect(SCENARIOS['mission01']).toBe(mission01)
    expect(mission01.ships).toHaveLength(7) // + planeta, 2× provoz, sonda (fáze B)
    expect(mission01.objectives).toHaveLength(2)
  })

  it('zvrat: v t=40 se Cygnus přepne na runnera a odhalí třídu (honička od začátku)', () => {
    const scenario = structuredClone(mission01)
    const state = build(scenario)
    state.t = 45 // po vzdorovité odpovědi Cygnus bolts (t=40)
    updateTriggers(state, scenario)
    expect(state.flags['runner-fleeing']).toBe(true)
    expect(state.flags['revealed:2']).toBe(true)
    expect(state.ships[1].doctrine).toBe('runner')
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('Vojenský kompenzátor'))).toBe(true)
    expect(state.events.some(e => e.kind === 'contactClassified')).toBe(true)
    // senzory teď hlásí skutečnou třídu i bez plné identifikace
    runSensors(state)
    const c = contactsFor(state, 'player').find(ct => ct.shipId === 2)
    expect(c?.classGuess).toBe('merch-runner')
  })

  it('zničení Cygnusu vyhrává misi, dojezd k bóji prohrává', () => {
    // výhra
    let scenario = structuredClone(mission01)
    let state = build(scenario)
    state.ships[1].destroyed = true
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(state.objectives.find(o => o.id === 'obj-no-escape')?.state).toBe('done')

    // prohra: Cygnus u hyperlimitní bóje
    scenario = structuredClone(mission01)
    state = build(scenario)
    state.ships[1].pos = { x: 247_000_000, y: 0 }
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('lose')
    expect(state.objectives.find(o => o.id === 'obj-no-escape')?.state).toBe('failed')
    expect(state.events.some(e => e.text.includes('unikl do hyperprostoru'))).toBe(true)
  })
})
