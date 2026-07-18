/**
 * STUB — plnou implementaci dodá integrační krok (viz docs/GAME_DESIGN.md).
 * Tick smyčka: nav/fyzika → zbraně → obrana → senzory → AI → triggery.
 */
import type { Order, Scenario, SimApi, SimState } from './types'

export const sim: SimApi = {
  create(scenario: Scenario): SimState {
    return {
      t: 0,
      rng: { s: scenario.seed >>> 0 },
      nextId: 1,
      ships: [],
      missiles: [],
      contacts: { player: [], enemy: [], neutral: [] },
      events: [],
      flags: {},
      objectives: scenario.objectives.map(o => ({ ...o })),
      outcome: 'running',
      scenarioId: scenario.id,
    }
  },
  tick(state: SimState, dt: number): void {
    state.t += dt
  },
  applyOrder(_state: SimState, _order: Order): void {},
}
