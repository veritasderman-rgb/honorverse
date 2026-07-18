/**
 * Engine — integrace všech modulů do SimApi.
 * Tick smyčka: cooldowny → fyzika → rakety → obrana → senzory → AI → triggery.
 */
import type { Order, Scenario, ShipState, SimApi, SimState } from './types'
import { updateShipPhysics } from './physics'
import { fireEnergy, launchSalvo, updateMissiles } from './weapons'
import { updateDefenses } from './defense'
import { updateSensors } from './sensors'
import { collectAIOrders } from './ai'
import { spawnShip, updateTriggers } from './scenario'
import { SCENARIOS } from '../data/missions'

/**
 * Per-stav kopie scénáře: updateTriggers mutuje trigger.fired, sdílený
 * objekt z registru by prosakoval mezi nezávislými běhy (determinismus).
 */
const scenarioCopies = new WeakMap<SimState, Scenario>()

/** mělká kopie s čerstvými triggery (conditions/actions se nemutují) */
const copyScenario = (scenario: Scenario): Scenario => ({
  ...scenario,
  triggers: scenario.triggers.map(t => ({ ...t, fired: false })),
})

/** scénář pro triggery: kopie z create, fallback registr (DEMO mimo registr ⇒ null) */
function scenarioFor(state: SimState): Scenario | null {
  const cached = scenarioCopies.get(state)
  if (cached) return cached
  const src = SCENARIOS[state.scenarioId]
  if (!src) return null
  const copy = copyScenario(src)
  scenarioCopies.set(state, copy)
  return copy
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

const shipById = (state: SimState, id: number): ShipState | undefined =>
  state.ships.find(s => s.id === id)

/** živý cíl rozkazu (zničený/neexistující ⇒ undefined) */
const liveTarget = (state: SimState, id: number): ShipState | undefined => {
  const s = shipById(state, id)
  return s && !s.destroyed ? s : undefined
}

function applyOrder(state: SimState, order: Order): void {
  const ship = shipById(state, order.shipId)
  if (!ship || ship.destroyed) return

  switch (order.kind) {
    case 'setCourse':
      ship.nav = { kind: 'course', dest: { ...order.dest }, arriveAtRest: order.arriveAtRest }
      break
    case 'intercept':
      ship.nav = { kind: 'intercept', targetId: order.targetId }
      break
    case 'setThrottle':
      ship.throttle = clamp01(order.throttle)
      break
    case 'setWedge':
      ship.wedgeOn = order.on // senzory zůstávají — jen klín
      break
    case 'setActiveSensors':
      ship.activeSensors = order.on
      break
    case 'roll':
      ship.rolledTo = order.towards
      break
    case 'launchSalvo':
      if (liveTarget(state, order.targetId)) {
        launchSalvo(state, ship, order.targetId, order.count, order.mode)
      }
      break
    case 'fireEnergy': {
      const target = liveTarget(state, order.targetId)
      if (target) fireEnergy(state, ship, target)
      break
    }
    case 'holdFire':
      break // no-op — nav zůstává
  }
}

export const sim: SimApi = {
  create(scenario: Scenario): SimState {
    const state: SimState = {
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
    // lodě v pořadí pole — id od 1 (triggery na to spoléhají)
    for (const spec of scenario.ships) spawnShip(state, spec)
    // triggery per stav — nesdílet fired s registrem ani jinými běhy
    scenarioCopies.set(state, copyScenario(scenario))
    // počáteční senzorová picture
    updateSensors(state, 0)
    return state
  },

  tick(state: SimState, dt: number): void {
    if (state.outcome !== 'running') return

    // (1) cooldowny
    for (const ship of state.ships) {
      ship.tubeCooldown = Math.max(0, ship.tubeCooldown - dt)
      ship.energyCooldown = Math.max(0, ship.energyCooldown - dt)
    }
    // (2) fyzika lodí
    for (const ship of state.ships) {
      if (!ship.destroyed) updateShipPhysics(state, ship, dt)
    }
    // (3–5) rakety, obrana, senzory
    updateMissiles(state, dt)
    updateDefenses(state, dt)
    updateSensors(state, dt)
    // (6) AI — rozkazy přes stejnou validaci jako UI
    for (const order of collectAIOrders(state)) applyOrder(state, order)
    // (7) triggery scénáře
    const scenario = scenarioFor(state)
    if (scenario) updateTriggers(state, scenario)
    // (8) čas
    state.t += dt
  },

  applyOrder,
}
