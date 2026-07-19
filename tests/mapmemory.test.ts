/**
 * Paměť mapy a gravitická detekce (sensors.ts) + vícebodové trasy
 * (NavPlan course.then, Order setCourse append, physics waypoint advance).
 */
import { describe, expect, it } from 'vitest'
import type { Scenario } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { SENSOR_UPDATE_INTERVAL, SIM_DT } from '../src/sim/constants'
import { predictPath } from '../src/sim/physics'

const makeScenario = (partial: Partial<Scenario>): Scenario => ({
  id: 'test', title: 'Test', briefing: '', seed: 7, ships: [], objectives: [], triggers: [], ...partial,
})

/** hráčův pozorovatel + cíl v dané vzdálenosti a stavu klínu */
const sensorScenario = (targetX: number, wedgeOn: boolean, classId = 'cl-sokol'): Scenario =>
  makeScenario({
    ships: [
      {
        classId: 'ca-bastion', side: 'player', name: 'Pozorovatel',
        pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'player', activeSensors: true,
      },
      {
        classId, side: 'enemy', name: 'Cíl',
        pos: { x: targetX, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter', wedgeOn,
      },
    ],
  })

describe('senzory — gravitika je FTL, EM nese světelné zpoždění', () => {
  it('zapnutý klín v dosahu: kontakt v reálném čase (age 0)', () => {
    const state = sim.create(sensorScenario(50_000_000, true))
    sim.tick(state, SIM_DT)
    const c = state.contacts.player.find(x => x.shipId === 2)
    expect(c).toBeDefined()
    expect(c!.wedgeDetected).toBe(true)
    expect(c!.age).toBe(0) // gravitická FTL detekce
  })

  it('vypnutý klín (jen EM zblízka): obraz starý d/c sekund', () => {
    const state = sim.create(sensorScenario(6_000_000, false)) // v aktivním dosahu CA (8M)
    sim.tick(state, SIM_DT)
    const c = state.contacts.player.find(x => x.shipId === 2)
    expect(c).toBeDefined()
    expect(c!.wedgeDetected).toBe(false)
    expect(c!.age).toBeCloseTo(6_000_000 / 299_792.458, 3) // ~20 s
  })
})

describe('senzory — paměťové piny (poslední známé zakreslení)', () => {
  it('ztracená loď zůstává jako memory pin s degradovanou identifikací', () => {
    const state = sim.create(sensorScenario(6_000_000, false))
    for (let i = 0; i < 12; i++) sim.tick(state, SIM_DT) // plný senzorový interval
    expect(state.contacts.player.some(c => c.shipId === 2 && c.memory !== true)).toBe(true)

    // cíl zmizí z dosahu (teleport daleko, klín vypnut — nic ho nevidí)
    state.ships[1].pos = { x: 500_000_000, y: 0 }
    for (let i = 0; i < 12; i++) sim.tick(state, SIM_DT)
    const pin = state.contacts.player.find(c => c.shipId === 2)
    expect(pin).toBeDefined()
    expect(pin!.memory).toBe(true)
    expect(pin!.idQuality).toBeLessThanOrEqual(1) // plný track bez kontaktu degraduje
    expect(pin!.pos.x).toBeLessThan(100_000_000)  // pin drží STAROU polohu
  })

  it('statický objekt (stanice): pin trvale, bez driftu, vel = 0', () => {
    const state = sim.create(sensorScenario(6_000_000, false, 'station-zeta'))
    for (let i = 0; i < 12; i++) sim.tick(state, SIM_DT)
    // „odletíme": pozorovatel se teleportuje daleko
    state.ships[0].pos = { x: -500_000_000, y: 0 }
    for (let i = 0; i < 40; i++) sim.tick(state, SIM_DT) // několik intervalů
    const pin = state.contacts.player.find(c => c.shipId === 2)
    expect(pin).toBeDefined()
    expect(pin!.memory).toBe(true)
    expect(pin!.staticObject).toBe(true)
    expect(pin!.vel).toEqual({ x: 0, y: 0 })
    expect(pin!.pos.x).toBeCloseTo(6_000_000, -3) // poloha stanice drží
  })

  it('memory pin stárne o senzorový interval za aktualizaci', () => {
    const state = sim.create(sensorScenario(6_000_000, false))
    for (let i = 0; i < 12; i++) sim.tick(state, SIM_DT)
    state.ships[1].pos = { x: 500_000_000, y: 0 }
    for (let i = 0; i < 12; i++) sim.tick(state, SIM_DT)
    const age1 = state.contacts.player.find(c => c.shipId === 2)!.age
    for (let i = 0; i < Math.round(SENSOR_UPDATE_INTERVAL / SIM_DT); i++) sim.tick(state, SIM_DT)
    const age2 = state.contacts.player.find(c => c.shipId === 2)!.age
    expect(age2).toBeGreaterThan(age1)
  })
})

describe('vícebodové trasy (waypointy)', () => {
  const routeScenario = (): Scenario => makeScenario({
    ships: [{
      classId: 'dd-vichr', side: 'player', name: 'DD',
      pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    }],
  })

  it('setCourse append staví frontu then[]; bez append nahrazuje', () => {
    const state = sim.create(routeScenario())
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 1e6, y: 0 }, arriveAtRest: false })
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 1e6, y: 1e6 }, arriveAtRest: false, append: true })
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 0, y: 2e6 }, arriveAtRest: false, append: true })
    const nav = state.ships[0].nav
    expect(nav?.kind).toBe('course')
    if (nav?.kind === 'course') {
      expect(nav.dest).toEqual({ x: 1e6, y: 0 })
      expect(nav.then).toHaveLength(2)
    }
    // bez append: nový kurz frontu zahodí
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 5e6, y: 5e6 }, arriveAtRest: false })
    const nav2 = state.ships[0].nav
    if (nav2?.kind === 'course') expect(nav2.then).toBeUndefined()
  })

  it('loď proletí waypointy postupně (fronta se konzumuje)', () => {
    const state = sim.create(routeScenario())
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 500_000, y: 0 }, arriveAtRest: false })
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 500_000, y: 500_000 }, arriveAtRest: false, append: true })
    let minD2 = Infinity
    for (let i = 0; i < 4000; i++) {
      sim.tick(state, SIM_DT)
      const s = state.ships[0]
      minD2 = Math.min(minD2, Math.hypot(s.pos.x - 500_000, s.pos.y - 500_000))
    }
    const nav = state.ships[0].nav
    if (nav?.kind === 'course') {
      expect(nav.then === undefined || nav.then.length === 0).toBe(true) // fronta spotřebovaná
      expect(nav.dest).toEqual({ x: 500_000, y: 500_000 })              // letí na poslední bod
    }
    expect(minD2).toBeLessThan(400_000) // druhého waypointu se reálně přiblížila
  })

  it('predictPath trasu nemutuje (duch konzumuje kopii fronty)', () => {
    const state = sim.create(routeScenario())
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 300_000, y: 0 }, arriveAtRest: false })
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 300_000, y: 300_000 }, arriveAtRest: false, append: true })
    const ship = state.ships[0]
    const before = JSON.stringify(ship.nav)
    const pts = predictPath(state, ship, 1200, 4)
    expect(pts.length).toBeGreaterThan(0)
    expect(JSON.stringify(ship.nav)).toBe(before) // nav nedotčený
  })
})
