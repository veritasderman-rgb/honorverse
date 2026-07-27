/**
 * Mise 0 — akademie: registrace a E2E hratelnost přesně podle tutoriálu
 * (kurz k bóji → aktivní senzory → klasifikace kýlu → salva → výhra).
 */
import { describe, expect, it } from 'vitest'
import { sim } from '../src/sim/engine'
import { SIM_DT } from '../src/sim/constants'
import { mission00 } from '../src/data/missions/mission00'
import { SCENARIOS } from '../src/data/missions'

describe('mise 0 — akademie', () => {
  it('je v registru; kýl je bezzubý (mrtvý pohon, žádné zbraně)', () => {
    expect(SCENARIOS['mission00']).toBe(mission00)
    const hulk = mission00.ships[2]
    expect(hulk.name).toBe('Cvičný kýl Beta')
    expect(hulk.subsystems?.impellerFwd).toBe(0)
    expect(hulk.subsystems?.tubesPort).toBe(0)
  })

  it('E2E: postup tutoriálu vede k výhře', () => {
    const state = sim.create(mission00)
    // (1) kurz k bóji + plný tah
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 6_000_000, y: 2_500_000 }, arriveAtRest: true })
    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1 })
    let t = 0
    for (; t < 3600 && state.objectives.find(o => o.id === 'obj-buoy')?.state !== 'done'; t += SIM_DT) {
      sim.tick(state, SIM_DT)
      state.events.length = 0
    }
    expect(state.objectives.find(o => o.id === 'obj-buoy')?.state).toBe('done')

    // (2) přesně dle tutoriálu: JEN zapnout aktivní senzory — kýl musí být
    // v dosahu (5 M km) od bóje, žádný další přelet (Codex review)
    sim.applyOrder(state, { kind: 'setActiveSensors', shipId: 1, on: true })
    let fired = false
    for (; t < 4 * 3600 && state.outcome === 'running'; t += SIM_DT) {
      sim.tick(state, SIM_DT)
      state.events.length = 0
      const classified = state.contacts.player.some(c => c.shipId === 3 && c.idQuality >= 1)
      if (!fired && classified) {
        fired = true
        sim.applyOrder(state, { kind: 'launchSalvo', shipId: 1, targetId: 3, count: 4, mode: 'auto' })
      }
      // dosalvování, kdyby první vlna nedorazila celá
      if (fired && state.missiles.every(m => m.phase === 'dead') && state.outcome === 'running') fired = false
    }
    expect(state.outcome).toBe('win')
  })
})
