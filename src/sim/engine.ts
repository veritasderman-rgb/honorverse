/**
 * Engine — integrace všech modulů do SimApi.
 * Tick smyčka: cooldowny → fyzika → rakety → obrana → senzory → AI
 *   → řízení palby (AUTO/vrstvené salvy) → posádka (opravy/události) → triggery.
 */
import type { Order, Scenario, ShipState, SimApi, SimState } from './types'
import { updateShipPhysics } from './physics'
import { fireEnergy, launchSalvo, missileFlightTime, retargetSalvo, updateMissiles } from './weapons'
import { deployDecoy, updateDefenses } from './defense'
import { updateSensors } from './sensors'
import { updateFireControl } from './firecontrol'
import { updateCrew } from './crew'
import { collectAIOrders } from './ai'
import { demandSurrender, updatePendingComms } from './surrender'
import { spawnShip, updateTriggers } from './scenario'
import { dist, dot, norm, sub } from './vec'
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
  if (!ship || ship.destroyed || ship.surrendered) return

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
        launchSalvo(state, ship, order.targetId, order.count, order.mode,
          { autonomous: order.autonomous === true, escortJammer: order.escortJammer === true })
      }
      break
    case 'deployDecoy':
      deployDecoy(state, ship)
      break
    case 'retargetSalvo':
      retargetSalvo(state, ship, order.salvoId, order.newTargetId)
      break
    case 'launchLayered': {
      // vrstvená salva: LO vlna hned, HI follow-up zpožděný na společný přílet
      const target = liveTarget(state, order.targetId)
      if (!target) break
      const before = state.missiles.length
      launchSalvo(state, ship, order.targetId, order.countLo, 0)
      if (state.missiles.length === before) break // LO neodešla (cooldown/munice) — feedback dal launchSalvo
      const d = dist(ship.pos, target.pos)
      const closing = dot(sub(ship.vel, target.vel), norm(sub(target.pos, ship.pos)))
      const tLo = missileFlightTime(d, closing, 0)
      const tHi = missileFlightTime(d, closing, 1)
      const delay = Number.isFinite(tLo) && Number.isFinite(tHi) ? Math.max(0, tLo - tHi) : 0
      ship.pendingWave = { targetId: order.targetId, count: order.countHi, mode: 1, launchAt: state.t + delay }
      if (ship.doctrine === 'player') {
        state.events.push({
          t: state.t, kind: 'message', shipId: ship.id, side: ship.side, speaker: 'tactical',
          text: `Vrstvená salva: druhá vlna (HI) odstartuje za ${Math.round(delay)} s — společný přílet.`,
        })
      }
      break
    }
    case 'fireEnergy': {
      const target = liveTarget(state, order.targetId)
      if (target) fireEnergy(state, ship, target)
      break
    }
    case 'demandSurrender':
      demandSurrender(state, ship, order.targetId)
      break
    case 'holdFire':
      // zastaví AUTO palbu (nav zůstává)
      ship.fireControl.mode = 'hold'
      ship.fireControl.engaged = false
      break
    case 'setFireControl': {
      const fc = ship.fireControl
      if (order.fc.mode !== undefined) fc.mode = order.fc.mode
      if (order.fc.targetId !== undefined) fc.targetId = order.fc.targetId
      if (order.fc.salvoSize !== undefined) fc.salvoSize = Math.max(1, Math.floor(order.fc.salvoSize))
      if (order.fc.driveMode !== undefined) fc.driveMode = order.fc.driveMode
      if (order.fc.autonomous !== undefined) fc.autonomous = order.fc.autonomous
      fc.engaged = false // hrana „palebné řešení" se vyhodnotí znovu
      break
    }
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
      pendingComms: [],
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
    // (7) řízení palby: AUTO salvy + druhé vlny vrstvených salv
    updateFireControl(state)
    // (8) posádka: polní opravy + náhodné události za boje
    updateCrew(state, dt)
    // (8b) doručení zpráv na cestě (výzvy ke kapitulaci — roll až teď)
    updatePendingComms(state)
    // (9) triggery scénáře
    const scenario = scenarioFor(state)
    if (scenario) updateTriggers(state, scenario)
    // (10) čas
    state.t += dt
  },

  applyOrder,
}
