/**
 * Engine — integrace všech modulů do SimApi.
 * Tick smyčka: cooldowny → fyzika → rakety → obrana → senzory → AI
 *   → řízení palby (AUTO/vrstvené salvy) → posádka (opravy/události) → triggery.
 */
import type { Order, Scenario, ShipState, SimApi, SimState } from './types'
import { updateShipPhysics } from './physics'
import { autoDriveMode, fireEnergy, launchDouble, launchPods, launchSalvo, missileFlightTime, retargetSalvo, updateMissiles } from './weapons'
import { effectiveTubes } from './damage'
import { deployDecoy, updateDefenses } from './defense'
import { updateSensors } from './sensors'
import { updateFireControl } from './firecontrol'
import { updateCrew } from './crew'
import { collectAIOrders } from './ai'
import { demandSurrender, updatePendingComms } from './surrender'
import { spawnShip, updateTriggers } from './scenario'
import { updateFormations } from './formation'
import { EMERGENCY_THROTTLE_MAX } from './constants'
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

/** rozkazový výkon pohonu: 0–120 % (nad 100 % nouzový výkon) */
const clampThrottle = (x: number): number =>
  Math.min(EMERGENCY_THROTTLE_MAX, Math.max(0, x))

const shipById = (state: SimState, id: number): ShipState | undefined =>
  state.ships.find(s => s.id === id)

/** živý cíl rozkazu (zničený/neexistující ⇒ undefined) */
const liveTarget = (state: SimState, id: number): ShipState | undefined => {
  const s = shipById(state, id)
  return s && !s.destroyed ? s : undefined
}

/**
 * Sesazená alfa-salva („srovnat tuby"): vybrané lodě naplánují plnou salvu
 * na SPOLEČNÝ dopad (time-on-target). Spočítáme dobu doletu každé lodě k cíli;
 * ta s nejdelším letem pálí hned, bližší se zpozdí (pendingWave), aby všechny
 * salvy dorazily naráz a zahltily obranu. Jen nabité, nezavalené lodě.
 */
function applyAlphaStrike(state: SimState, order: { shipIds: number[]; targetId: number }): void {
  const target = liveTarget(state, order.targetId)
  if (!target || target.surrendered) return
  const plan = order.shipIds
    .map(id => shipById(state, id))
    .filter((sh): sh is ShipState =>
      !!sh && !sh.destroyed && !sh.surrendered && sh.side === 'player'
      && sh.tubeCooldown <= 0 && sh.rolledTo === null && sh.missiles > 0
      && effectiveTubes(sh) > 0)
    .map(sh => {
      const d = dist(sh.pos, target.pos)
      const closing = dot(sub(sh.vel, target.vel), norm(sub(target.pos, sh.pos)))
      const mode = autoDriveMode(sh.pos, sh.vel, target.pos, target.vel)
      const tf = missileFlightTime(d, closing, mode)
      return { sh, mode, tf: Number.isFinite(tf) ? tf : 0 }
    })
  if (plan.length === 0) return
  const maxFlight = plan.reduce((m, p) => Math.max(m, p.tf), 0)
  for (const p of plan) {
    const tubes = effectiveTubes(p.sh)
    const delay = Math.max(0, maxFlight - p.tf)
    if (delay <= 0.05) {
      launchSalvo(state, p.sh, order.targetId, tubes, p.mode)
    } else {
      // přednabito na koordinovaný dopad — odpal ignoruje cooldown (jako vrstvená vlna)
      p.sh.pendingWave = { targetId: order.targetId, count: tubes, mode: p.mode, launchAt: state.t + delay }
    }
  }
  const player = plan.find(p => p.sh.doctrine === 'player')?.sh
  if (player) {
    state.events.push({
      t: state.t, kind: 'message', shipId: player.id, side: player.side, speaker: 'tactical', slowdown: true,
      text: `Srovnat tuby — ${plan.length} ${plan.length === 1 ? 'loď' : plan.length < 5 ? 'lodě' : 'lodí'} `
        + `na společný dopad za ${Math.round(maxFlight)} s. Zahltíme jim obranu jednou vlnou.`,
    })
  }
}

function applyOrder(state: SimState, order: Order): void {
  if (order.kind === 'alphaStrike') { applyAlphaStrike(state, order); return }
  const ship = shipById(state, order.shipId)
  if (!ship || ship.destroyed || ship.surrendered) return

  switch (order.kind) {
    case 'setCourse':
      // append: přidání waypointu na konec trasy (Shift-klik v režimu kurzu)
      if (order.append === true && ship.nav?.kind === 'course') {
        ship.nav.then = [...(ship.nav.then ?? []), { ...order.dest }]
        ship.nav.arriveAtRest = order.arriveAtRest
      } else {
        ship.nav = { kind: 'course', dest: { ...order.dest }, arriveAtRest: order.arriveAtRest }
      }
      break
    case 'intercept':
      ship.nav = { kind: 'intercept', targetId: order.targetId }
      break
    case 'setThrottle': {
      const prev = ship.throttle
      ship.throttle = clampThrottle(order.throttle)
      // první přechod NAD 100 %: jednorázové varování inženýra (per loď a misi)
      if (ship.throttle > 1 && prev <= 1 && ship.doctrine === 'player'
        && state.flags[`said:emergency-power:${ship.id}`] !== true) {
        state.flags[`said:emergency-power:${ship.id}`] = true
        state.events.push({
          t: state.t, kind: 'comm', shipId: ship.id, side: ship.side,
          speaker: 'engineer', slowdown: true, voId: 'eng-redline-warn',
          text: 'Rozkaz potvrzen — kompenzátor nad sto procent. Jedeme za červenou čarou; '
            + 'každá minuta navíc je ruleta s impelerovými prstenci!',
        })
      }
      break
    }
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
    case 'launchPods':
      // alfa úder z tažených plošin (všechny najednou, mimo šachty)
      launchPods(state, ship, order.targetId)
      break
    case 'setRepairFocus':
      // priorita polních oprav (koncentrace damage-control čet)
      ship.repairFocus = order.focus
      break
    case 'deployDecoy':
      deployDecoy(state, ship)
      break
    case 'launchDouble':
      // dvojitá boční salva: LO z levoboku, otočka, HI z pravoboku
      launchDouble(state, ship, order.targetId)
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
    case 'setFormation': {
      // formace jen mezi hráčem OVLADATELNÝMI loděmi (AI se formací neúčastní)
      if (ship.doctrine !== 'player' || ship.side !== 'player') break
      if (order.leaderId === ship.id) break
      const leader = liveTarget(state, order.leaderId)
      if (!leader || leader.surrendered) break
      if (leader.doctrine !== 'player' || leader.side !== 'player') break
      ship.formation = {
        leaderId: order.leaderId,
        slot: Math.max(1, Math.floor(order.slot)),
        kind: order.formation,
      }
      break
    }
    case 'clearFormation':
      ship.formation = null
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
    // (1b) formace: rozpad při ztrátě leadera — PŘED fyzikou (station-keeping
    // v updateShipPhysics už pracuje jen s platnými formacemi)
    updateFormations(state)
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
