/**
 * Integrační testy enginu: determinismus, E2E mise 1, validace rozkazů.
 */
import { describe, expect, it } from 'vitest'
import type { SimState } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { SIM_DT } from '../src/sim/constants'
import { dist } from '../src/sim/vec'
import { mission01 } from '../src/data/missions/mission01'

const DAUNTLESS = 1
const CYGNUS = 2

/** vzdálenost hráč–Cygnus */
const gap = (state: SimState): number =>
  dist(state.ships[0].pos, state.ships[1].pos)

/** počáteční rozkazy hráče: plný tah + intercept Cygnusu */
function openingOrders(state: SimState): void {
  sim.applyOrder(state, { kind: 'setThrottle', shipId: DAUNTLESS, throttle: 1 })
  sim.applyOrder(state, { kind: 'intercept', shipId: DAUNTLESS, targetId: CYGNUS })
}

/** bojová logika hráče v jednom ticku: salva kdykoli to cooldown a dosah dovolí */
function fightStep(state: SimState): void {
  const player = state.ships[0]
  if (player.destroyed) return
  if (player.tubeCooldown <= 0 && gap(state) < 6_000_000) {
    sim.applyOrder(state, { kind: 'launchSalvo', shipId: DAUNTLESS, targetId: CYGNUS, count: 6, mode: 0 })
  }
}

describe('determinismus', () => {
  it('dva nezávislé běhy se stejnými rozkazy jsou bitově identické', () => {
    const a = sim.create(mission01)
    const b = sim.create(mission01)
    openingOrders(a)
    openingOrders(b)
    for (let i = 0; i < 2000; i++) {
      sim.tick(a, SIM_DT)
      sim.tick(b, SIM_DT)
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

describe('E2E mise 1 — Hlídka u Strážné brány', () => {
  it('intercept → zvrat → pronásledování → souboj → konec mise', () => {
    const state = sim.create(mission01)
    expect(state.ships.map(s => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7]) // + planeta, provoz, sonda (fáze B)
    expect(state.outcome).toBe('running')
    openingOrders(state)

    // (a) zvrat: Cygnus odhodí masku v t=40 a prchá (honička od začátku)
    while (!state.flags['runner-fleeing'] && state.t < 7200) {
      sim.tick(state, SIM_DT)
    }
    expect(state.flags['runner-fleeing']).toBe(true)
    expect(state.t).toBeLessThan(60)
    expect(state.ships[1].doctrine).toBe('runner')
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('Vojenský kompenzátor'))).toBe(true)

    // (b) Cygnus zrychluje pryč (+x)
    const vx0 = state.ships[1].vel.x
    for (let i = 0; i < 1200 && state.outcome === 'running'; i++) {
      sim.tick(state, SIM_DT)
      fightStep(state)
    }
    expect(state.ships[1].vel.x).toBeGreaterThan(vx0)

    // (c) hráč se drží na dostřel a pálí salvy — boj reálně probíhá
    const cygnusFullHull = 140 // merch-runner hullPoints (zdvojeno)
    while (state.outcome === 'running' && state.t < 6 * 3600) {
      sim.tick(state, SIM_DT)
      fightStep(state)
    }
    expect(state.ships[0].missiles).toBeLessThan(90) // salvy odešly
    expect(
      state.outcome !== 'running' || state.ships[1].hull < cygnusFullHull,
    ).toBe(true)

    // (d) deterministický výsledek: Cygnus zničen, mise vyhrána do ~6 h
    expect(state.outcome).toBe('win')
    expect(state.ships[1].destroyed).toBe(true)
    expect(state.objectives.find(o => o.id === 'obj-no-escape')?.state).toBe('done')
    expect(state.events.some(e => e.kind === 'shipDestroyed' && e.shipId === CYGNUS)).toBe(true)
  })
})

describe('E2E mise 1 — lekce rozpočtu reaktoru', () => {
  it('na standardních 80 % tahu Cygnus unikne (4,08 < 4,12 km/s²)', () => {
    const state = sim.create(mission01)
    sim.applyOrder(state, { kind: 'setThrottle', shipId: DAUNTLESS, throttle: 0.8 })
    sim.applyOrder(state, { kind: 'intercept', shipId: DAUNTLESS, targetId: CYGNUS })
    while (state.outcome === 'running' && state.t < 4 * 3600) {
      sim.tick(state, SIM_DT)
      fightStep(state)
      state.events.length = 0
    }
    expect(state.outcome).toBe('lose') // hyperlimit dřív, než se přiblížíme
  })
})

describe('applyOrder — validace', () => {
  it('rozkaz zničené lodi je ignorován', () => {
    const state = sim.create(mission01)
    state.ships[0].destroyed = true
    sim.applyOrder(state, { kind: 'setThrottle', shipId: DAUNTLESS, throttle: 0.1 })
    expect(state.ships[0].throttle).not.toBe(0.1)
    sim.applyOrder(state, { kind: 'setCourse', shipId: 999, dest: { x: 0, y: 0 }, arriveAtRest: false })
    expect(state.ships.every(s => s.id !== 999)).toBe(true)
  })

  it('setThrottle se ořezává na 0–1.2 (nouzový výkon nad 100 %)', () => {
    const state = sim.create(mission01)
    sim.applyOrder(state, { kind: 'setThrottle', shipId: DAUNTLESS, throttle: 5 })
    expect(state.ships[0].throttle).toBe(1.2)
    sim.applyOrder(state, { kind: 'setThrottle', shipId: DAUNTLESS, throttle: -3 })
    expect(state.ships[0].throttle).toBe(0)
  })

  it('launchSalvo na zničený cíl neodpálí nic', () => {
    const state = sim.create(mission01)
    state.ships[1].destroyed = true
    sim.applyOrder(state, { kind: 'launchSalvo', shipId: DAUNTLESS, targetId: CYGNUS, count: 6, mode: 0 })
    expect(state.missiles).toHaveLength(0)
    expect(state.ships[0].missiles).toBe(90)
  })
})
