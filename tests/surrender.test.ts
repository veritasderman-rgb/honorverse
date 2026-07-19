/**
 * Testy balíku „bojová zpětná vazba a kapitulace": vzorec šance, doručení
 * odpovědi po 2× světelném zpoždění, trigger shipSurrendered, výhry misí
 * kapitulací, AI nestřílí na kapitulovanou loď a statistické eventy
 * (launch.count, side = strana rakety u kill/hit eventů).
 */
import { describe, expect, it } from 'vitest'
import type { MissileState, Scenario, SimState } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { C, SIM_DT, SURRENDER_COOLDOWN } from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'
import { collectAIOrders } from '../src/sim/ai'
import { resolveTerminal, updateDefenses } from '../src/sim/defense'
import { launchSalvo } from '../src/sim/weapons'
import { updateTriggers } from '../src/sim/scenario'
import { moraleFor, surrenderChance, weaponsOut } from '../src/sim/surrender'
import { mission01 } from '../src/data/missions/mission01'
import { mission02 } from '../src/data/missions/mission02'
import { mission03 } from '../src/data/missions/mission03'

function makeScenario(partial: Partial<Scenario>): Scenario {
  return { id: 'test', title: 'Test', briefing: '', seed: 1, ships: [], objectives: [], triggers: [], ...partial }
}

/**
 * Hráčův DD + těžce poškozený nepřátelský „obchodník" na 8 mil. km:
 * kontakt idQuality 1 (pod 2× activeSensorRange), doktrína freighter
 * (morálka 2.0) + poškození 90 % ⇒ kapitulace při doručení jistá.
 */
const demandScenario = (over: Partial<Scenario['ships'][0]> = {}): Scenario => makeScenario({
  ships: [
    {
      classId: 'dd-vichr', side: 'player', name: 'ANS Test',
      pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      classId: 'merch-runner', side: 'enemy', name: 'Kořist',
      pos: { x: 8_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
      hull: 7, // 90 % poškození (hullPoints 70)
      ...over,
    },
  ],
})

describe('vzorec šance na kapitulaci', () => {
  it('p = clamp(poškození − 0.2, 0, 0.95) · morálka — 80 % poškození ⇒ 60 % při morálce 1.0', () => {
    expect(surrenderChance(0.8, 1.0, false)).toBeCloseTo(0.6)
    expect(surrenderChance(0.5, 1.0, false)).toBeCloseTo(0.3)
    expect(surrenderChance(0.1, 2.0, false)).toBe(0)   // pod prahem 0.2
    expect(surrenderChance(1.0, 1.0, false)).toBeCloseTo(0.8)
  })

  it('morálka násobí a bonus +0.15 se přičítá; výsledek se ořezává na [0, 1]', () => {
    expect(surrenderChance(0.8, 1.5, false)).toBeCloseTo(0.9)  // pirát
    expect(surrenderChance(0.8, 0.7, false)).toBeCloseTo(0.42) // hunter
    expect(surrenderChance(0.5, 1.0, true)).toBeCloseTo(0.45)  // +0.15 za vyřazené zbraně
    expect(surrenderChance(1.0, 2.0, true)).toBe(1)            // clamp shora
  })

  it('moraleFor odpovídá doktrínám (neznámá = 1.0)', () => {
    expect(moraleFor('pirate')).toBe(1.5)
    expect(moraleFor('freighter')).toBe(2.0)
    expect(moraleFor('buoy')).toBe(2.0)
    expect(moraleFor('runner')).toBe(1.0)
    expect(moraleFor('hunter')).toBe(0.7)
    expect(moraleFor('escort')).toBe(0.7)
    expect(moraleFor('cokoliv')).toBe(1.0)
  })

  it('weaponsOut: obě šachtové stránky < 0.3 nebo prázdný zásobník (jen lodě se šachtami)', () => {
    const state = sim.create(demandScenario())
    const target = state.ships[1] // merch-runner: 2 šachty/bok
    expect(weaponsOut(target)).toBe(false)
    target.subsystems.tubesPort = 0.2
    target.subsystems.tubesStbd = 0.25
    expect(weaponsOut(target)).toBe(true)
    target.subsystems.tubesStbd = 1
    expect(weaponsOut(target)).toBe(false)
    target.missiles = 0
    expect(weaponsOut(target)).toBe(true)
    // loď bez šachet (freighter) bonus nedostává, i když nemá rakety
    const state2 = sim.create(demandScenario({ classId: 'merch-freighter', hull: 8 }))
    expect(weaponsOut(state2.ships[1])).toBe(false)
  })
})

describe('výzva ke kapitulaci — doručení po 2× světelném zpoždění', () => {
  it('odpověď dorazí za 2·d/C; do té doby se nic neděje, pak cíl kapituluje', () => {
    const state = sim.create(demandScenario())
    const lag = (2 * 8_000_000) / C // ~53.4 s

    sim.applyOrder(state, { kind: 'demandSurrender', shipId: 1, targetId: 2 })
    expect(state.pendingComms).toHaveLength(1)
    expect(state.pendingComms[0].deliverAt).toBeCloseTo(lag, 1)
    expect(state.pendingComms[0].targetId).toBe(2)
    expect(state.pendingComms[0].demanderId).toBe(1)
    // spojař potvrdil odeslání s odhadem doby
    expect(state.events.some(e =>
      e.kind === 'message' && e.speaker === 'comms' && e.text.includes('Výzva ke kapitulaci odeslána'))).toBe(true)

    // před doručením: žádná kapitulace
    while (state.t + SIM_DT < lag) sim.tick(state, SIM_DT)
    expect(state.ships[1].surrendered).toBe(false)
    expect(state.pendingComms).toHaveLength(1)

    // po doručení: poškození 0.9, morálka 2.0 ⇒ p = 1 ⇒ jistá kapitulace
    sim.tick(state, SIM_DT)
    sim.tick(state, SIM_DT)
    const target = state.ships[1]
    expect(target.surrendered).toBe(true)
    expect(state.pendingComms).toHaveLength(0)
    expect(target.wedgeOn).toBe(false)
    expect(target.nav).toBeNull()
    expect(target.doctrine).toBe('surrendered')
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'enemy-captain'
      && e.text.includes('Kapitulujeme'))).toBe(true)
    expect(state.events.some(e => e.kind === 'objective' && e.text.includes('kapituloval'))).toBe(true)
  })

  it('odmítnutí: nepoškozený cíl (p = 0) odpoví vzdorovitě', () => {
    const state = sim.create(demandScenario({ hull: 70 })) // bez poškození
    sim.applyOrder(state, { kind: 'demandSurrender', shipId: 1, targetId: 2 })
    for (let i = 0; i < 120; i++) sim.tick(state, SIM_DT) // 60 s > lag
    expect(state.ships[1].surrendered).toBe(false)
    expect(state.events.some(e => e.kind === 'comm' && e.text.includes('Zapomeňte'))).toBe(true)
  })

  it('cooldown 180 s: opakovaná výzva na týž cíl je odmítnuta hláškou', () => {
    const state = sim.create(demandScenario({ hull: 70 }))
    sim.applyOrder(state, { kind: 'demandSurrender', shipId: 1, targetId: 2 })
    expect(state.pendingComms).toHaveLength(1)
    sim.applyOrder(state, { kind: 'demandSurrender', shipId: 1, targetId: 2 })
    expect(state.pendingComms).toHaveLength(1) // druhá výzva neodešla
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('neodpovídá'))).toBe(true)
    // po uplynutí cooldownu výzva znovu projde
    state.t = SURRENDER_COOLDOWN + 1
    sim.applyOrder(state, { kind: 'demandSurrender', shipId: 1, targetId: 2 })
    expect(state.pendingComms).toHaveLength(2)
  })

  it('výzva vyžaduje klasifikovaný kontakt (idQuality ≥ 1)', () => {
    // cíl na 30 mil. km: klín viditelný, ale idQuality 0
    const state = sim.create(demandScenario({ pos: { x: 30_000_000, y: 0 } }))
    expect(state.contacts.player.find(c => c.shipId === 2)?.idQuality).toBe(0)
    sim.applyOrder(state, { kind: 'demandSurrender', shipId: 1, targetId: 2 })
    expect(state.pendingComms).toHaveLength(0)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('není klasifikován'))).toBe(true)
  })

  it('výzva na neutrála je odmítnuta', () => {
    const state = sim.create(demandScenario({ side: 'neutral' }))
    sim.applyOrder(state, { kind: 'demandSurrender', shipId: 1, targetId: 2 })
    expect(state.pendingComms).toHaveLength(0)
    expect(state.events.some(e => e.text.includes('nemá smysl'))).toBe(true)
  })

  it('determinismus: dva běhy s výzvou jsou bitově identické (pendingComms je součást stavu)', () => {
    const run = (): SimState => {
      const s = sim.create(demandScenario())
      sim.applyOrder(s, { kind: 'demandSurrender', shipId: 1, targetId: 2 })
      for (let i = 0; i < 200; i++) sim.tick(s, SIM_DT)
      return s
    }
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })
})

describe('trigger shipSurrendered', () => {
  it('splněn právě když loď kapitulovala', () => {
    const scenario = makeScenario({
      ships: [{
        classId: 'merch-runner', side: 'enemy', name: 'X',
        pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 },
      }],
      triggers: [{
        id: 't-cap', once: true,
        conditions: [{ kind: 'shipSurrendered', shipId: 1 }],
        actions: [{ kind: 'setFlag', flag: 'zajat' }],
      }],
    })
    const state = sim.create(scenario)
    updateTriggers(state, scenario)
    expect(state.flags['zajat']).toBeUndefined()
    state.ships[0].surrendered = true
    updateTriggers(state, scenario)
    expect(state.flags['zajat']).toBe(true)
  })
})

describe('kapitulace v misích', () => {
  it('mise 1: plná cesta — výzva na poškozený Cygnus ⇒ kapitulace ⇒ winMission', () => {
    const state = sim.create(mission01)
    // Dauntless 8 mil. km od Cygnusu (idQuality 1, ale nad prahem zvratu 5 mil. km)
    state.ships[0].pos = { x: 32_000_000, y: 0 }
    state.ships[1].vel = { x: 0, y: 0 } // stojí — vzdálenost se nemění
    state.ships[1].hull = 7             // 90 % poškození, doktrína freighter ⇒ p = 1
    for (let i = 0; i < 11; i++) sim.tick(state, SIM_DT) // celý senzorový interval
    sim.applyOrder(state, { kind: 'demandSurrender', shipId: 1, targetId: 2 })
    expect(state.pendingComms).toHaveLength(1)
    for (let i = 0; i < 140 && state.outcome === 'running'; i++) sim.tick(state, SIM_DT)
    expect(state.ships[1].surrendered).toBe(true)
    expect(state.outcome).toBe('win')
    expect(state.objectives.find(o => o.id === 'obj-no-escape')?.state).toBe('done')
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'station'
      && e.text.includes('kapituloval'))).toBe(true)
  })

  it('mise 2: kapitulovaný pirát se počítá jako zažehnaný (flag neutralized)', () => {
    const state = sim.create(mission02)
    state.ships[6].surrendered = true // Karakal (id 7)
    sim.tick(state, SIM_DT)
    expect(state.flags['neutralized-7']).toBe(true)
    expect(state.outcome).toBe('running') // zbylí dva piráti nevyřazeni
    // po vyřazení všech tří (kombinace zničení/kapitulace) ⇒ výhra
    state.flags['neutralized-8'] = true
    state.flags['neutralized-9'] = true
    sim.tick(state, SIM_DT)
    expect(state.outcome).toBe('win')
    expect(state.events.some(e => e.text.includes('zničeni nebo zajati'))).toBe(true)
  })

  it('mise 3: kapitulace Mercatoru = winMission (zpravodajská trofej)', () => {
    const state = sim.create(mission03)
    state.ships[1].surrendered = true
    sim.tick(state, SIM_DT)
    expect(state.outcome).toBe('win')
    expect(state.events.some(e => e.text.includes('Zpravodajská trofej'))).toBe(true)
  })
})

describe('AI a kapitulovaná loď', () => {
  it('AI nestřílí a nemíří na kapitulovaný cíl (vyřazen z výběru cílů)', () => {
    const scenario = makeScenario({
      ships: [
        {
          classId: 'cl-sokol', side: 'enemy', name: 'Pirát',
          pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'pirate', activeSensors: true,
        },
        {
          classId: 'merch-freighter', side: 'player', name: 'Obchodník',
          pos: { x: 3_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
        },
      ],
    })
    // kontrast: nekapitulovaný cíl AI napadá
    const before = sim.create(scenario)
    expect(collectAIOrders(before).some(o =>
      (o.kind === 'intercept' || o.kind === 'launchSalvo') && o.targetId === 2)).toBe(true)
    // kapitulovaný cíl: žádný intercept, žádná salva
    const after = sim.create(scenario)
    after.ships[1].surrendered = true
    expect(collectAIOrders(after).some(o =>
      (o.kind === 'intercept' || o.kind === 'launchSalvo' || o.kind === 'fireEnergy')
      && o.targetId === 2)).toBe(false)
  })

  it('kapitulovaná AI loď negeneruje žádné rozkazy', () => {
    const scenario = makeScenario({
      ships: [
        {
          classId: 'cl-sokol', side: 'enemy', name: 'Pirát',
          pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'pirate', activeSensors: true,
        },
        {
          classId: 'merch-freighter', side: 'player', name: 'Obchodník',
          pos: { x: 3_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
        },
      ],
    })
    const state = sim.create(scenario)
    state.ships[0].surrendered = true
    state.ships[0].doctrine = 'surrendered'
    expect(collectAIOrders(state)).toHaveLength(0)
  })

  it('AUTO palba se na kapitulovaný cíl zastaví', () => {
    const state = sim.create(demandScenario({ pos: { x: 3_000_000, y: 0 }, hull: 70 }))
    sim.applyOrder(state, {
      kind: 'setFireControl', shipId: 1,
      fc: { mode: 'auto', targetId: 2, salvoSize: 2, driveMode: 0 },
    })
    state.ships[1].surrendered = true
    sim.tick(state, SIM_DT)
    expect(state.missiles).toHaveLength(0) // žádný odpal
    expect(state.ships[0].fireControl.mode).toBe('hold')
  })
})

describe('statistické eventy (side = strana rakety, launch.count)', () => {
  it('launch nese strukturovaný počet raket a stranu střelce', () => {
    const state = sim.create(demandScenario({ pos: { x: 2_000_000, y: 0 }, hull: 70 }))
    launchSalvo(state, state.ships[0], 2, 3, 0)
    const ev = state.events.find(e => e.kind === 'launch')
    expect(ev?.count).toBe(3)
    expect(ev?.side).toBe('player')
  })

  it('missileHit nese stranu RAKETY a shipId zasažené lodi', () => {
    const state = sim.create(demandScenario({ hull: 70 }))
    const target = state.ships[0] // hráčův DD zasažen nepřátelskou raketou
    target.subsystems.pdlc = 0
    const missile: MissileState = {
      id: 900, side: 'enemy', def: 'std-shipkiller',
      pos: vec(100_000, 0), vel: vec(-10_000, 0), targetId: 1,
      mode: 1, driveRemaining: 0, phase: 'terminal', lock: 1, salvoId: 1,
    }
    resolveTerminal(state, missile, target)
    const hit = state.events.find(e => e.kind === 'missileHit')
    expect(hit).toBeDefined()
    expect(hit?.side).toBe('enemy')   // strana rakety, ne zasažené lodi
    expect(hit?.shipId).toBe(1)
  })

  it('missileKilled (CM) nese stranu RAKETY a shipId bránící se lodi', () => {
    // hledáme první seed, kde CM sestřelí — pak ověříme pole eventu
    let found = false
    for (let seed = 1; seed <= 20 && !found; seed++) {
      const state = sim.create(makeScenario({
        seed,
        ships: [{
          classId: 'ca-bastion', side: 'player', name: 'CA',
          pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 },
        }],
      }))
      for (let i = 0; i < 10; i++) {
        state.missiles.push({
          id: 500 + i, side: 'enemy', def: 'std-shipkiller',
          pos: vec(2_000_000, 0), vel: vec(-20_000, 0), targetId: 1,
          mode: 1, driveRemaining: 60, phase: 'boost', lock: 1, salvoId: 1,
        })
      }
      updateDefenses(state, 5)
      const kill = state.events.find(e => e.kind === 'missileKilled')
      if (kill) {
        found = true
        expect(kill.side).toBe('enemy') // strana sestřelené rakety
        expect(kill.shipId).toBe(1)     // bránící se loď
      }
    }
    expect(found).toBe(true)
  })

  it('kapitulovaná loď protirakety neodpaluje (složila zbraně)', () => {
    const state = sim.create(makeScenario({
      ships: [{
        classId: 'ca-bastion', side: 'player', name: 'CA',
        pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 },
      }],
    }))
    state.ships[0].surrendered = true
    const cms0 = state.ships[0].cms
    state.missiles.push({
      id: 500, side: 'enemy', def: 'std-shipkiller',
      pos: vec(2_000_000, 0), vel: vec(-20_000, 0), targetId: 1,
      mode: 1, driveRemaining: 60, phase: 'boost', lock: 1, salvoId: 1,
    })
    updateDefenses(state, 5)
    expect(state.ships[0].cms).toBe(cms0)
  })
})
