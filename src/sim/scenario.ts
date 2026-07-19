/**
 * Scénářový systém: spawn lodí z definic a vyhodnocování triggerů
 * (skriptované zvraty misí mají přednost před doktrínou — design kap. 8.3).
 */
import type {
  Scenario, ShipState, SimState, Subsystems, TriggerAction, TriggerCondition,
} from './types'
import { STANDARD_THROTTLE } from './constants'
import { dist } from './vec'
import { SHIP_CLASSES } from '../data/defs'

type ShipSpec = Scenario['ships'][0]

const fullSubsystems = (): Subsystems => ({
  impellerFwd: 1, impellerAft: 1,
  sidewallPort: 1, sidewallStbd: 1,
  tubesPort: 1, tubesStbd: 1,
  energyPort: 1, energyStbd: 1,
  pdlc: 1, cm: 1, sensors: 1, ecm: 1,
})

/**
 * Vytvoří kompletní ShipState z definice třídy, přidělí id = state.nextId++
 * a vloží do state.ships. Lodě scénáře dostávají id v pořadí pole ships od 1
 * — triggery misí na to smí spoléhat.
 */
export function spawnShip(state: SimState, spec: ShipSpec): ShipState {
  const def = SHIP_CLASSES[spec.classId]
  if (!def) throw new Error(`Neznámá třída lodi: ${spec.classId}`)

  const ship: ShipState = {
    id: state.nextId++,
    side: spec.side,
    classId: spec.classId,
    name: spec.name,
    pos: { ...spec.pos },
    vel: { ...spec.vel },
    heading: spec.heading ?? 0,
    throttle: spec.throttle ?? STANDARD_THROTTLE,
    nav: spec.nav ?? null,
    wedgeOn: spec.wedgeOn ?? true,
    activeSensors: spec.activeSensors ?? false,
    rolledTo: spec.rolledTo ?? null,
    subsystems: spec.subsystems ? { ...spec.subsystems } : fullSubsystems(),
    hull: spec.hull ?? def.hullPoints,
    missiles: spec.missiles ?? def.magazineMissiles,
    cms: spec.cms ?? def.magazineCMs,
    tubeCooldown: spec.tubeCooldown ?? 0,
    energyCooldown: spec.energyCooldown ?? 0,
    destroyed: spec.destroyed ?? false,
    doctrine: spec.doctrine ?? (spec.side === 'player' ? 'player' : 'freighter'),
    fireControl: spec.fireControl
      ? { ...spec.fireControl }
      : { mode: 'hold', targetId: null, salvoSize: Math.max(1, def.tubesPerBroadside), driveMode: 0, engaged: false },
    pendingWave: spec.pendingWave ? { ...spec.pendingWave } : null,
    buffs: spec.buffs
      ? { ...spec.buffs }
      : { lockBonus: 0, lockUntil: 0, repairBonus: 1, repairUntil: 0 },
    terminalTimes: spec.terminalTimes ? [...spec.terminalTimes] : [],
  }
  state.ships.push(ship)
  return ship
}

const byId = (state: SimState, id: number | undefined): ShipState | undefined =>
  id === undefined ? undefined : state.ships.find(s => s.id === id)

/** vyhodnocení jedné podmínky triggeru */
function evalCondition(state: SimState, c: TriggerCondition): boolean {
  switch (c.kind) {
    case 'time':
      return c.t !== undefined && state.t >= c.t
    case 'distanceBelow':
    case 'distanceAbove': {
      const a = byId(state, c.shipA)
      const b = byId(state, c.shipB)
      if (!a || !b || a.destroyed || b.destroyed || c.distance === undefined) return false
      const d = dist(a.pos, b.pos)
      return c.kind === 'distanceBelow' ? d < c.distance : d > c.distance
    }
    case 'shipDestroyed':
      return byId(state, c.shipId)?.destroyed === true
    case 'flag':
      return c.flag !== undefined && state.flags[c.flag] === true
    case 'wedgeOn': {
      // splněno, když loď žije a má zapnutý klín (prozrazení — mise 4)
      const ship = byId(state, c.shipId)
      return !!ship && !ship.destroyed && ship.wedgeOn
    }
    case 'shipsDestroyedCount':
      // splněno, když počet zničených lodí dané strany >= count
      if (c.side === undefined || c.count === undefined) return false
      return state.ships.filter(s => s.side === c.side && s.destroyed).length >= c.count
  }
}

/** provedení jedné akce triggeru */
function applyAction(state: SimState, a: TriggerAction): void {
  switch (a.kind) {
    case 'message':
      state.events.push({ t: state.t, kind: 'message', text: a.text ?? '', slowdown: true })
      break
    case 'comm':
      // komunikace (hail) — event se speaker, UI zobrazí avatar + toast
      state.events.push({
        t: state.t, kind: 'comm', text: a.text ?? '', speaker: a.speaker, slowdown: true,
      })
      break
    case 'setDoctrine': {
      const ship = byId(state, a.shipId)
      if (ship && a.doctrine !== undefined) ship.doctrine = a.doctrine
      break
    }
    case 'spawnShip':
      if (a.ship) spawnShip(state, a.ship)
      break
    case 'revealClass': {
      if (a.shipId === undefined) break
      state.flags[`revealed:${a.shipId}`] = true
      const ship = byId(state, a.shipId)
      // okamžitě zpřesni existující kontakty (senzory by to dohnaly až za interval)
      if (ship) {
        for (const side of ['player', 'enemy'] as const) {
          for (const ct of state.contacts[side]) {
            if (ct.shipId === ship.id) ct.classGuess = ship.classId
          }
        }
      }
      const className = ship ? SHIP_CLASSES[ship.classId]?.name ?? ship.classId : ''
      state.events.push({
        t: state.t, kind: 'contactClassified',
        text: a.text ?? `Kontakt identifikován: ${className}`,
        shipId: a.shipId, slowdown: true,
      })
      break
    }
    case 'setFlag':
      if (a.flag !== undefined) state.flags[a.flag] = true
      break
    case 'objectiveComplete':
    case 'objectiveFail': {
      const obj = state.objectives.find(o => o.id === a.objectiveId)
      if (obj && obj.state === 'open') {
        obj.state = a.kind === 'objectiveComplete' ? 'done' : 'failed'
        state.events.push({
          t: state.t, kind: 'objective',
          text: a.text ?? `${a.kind === 'objectiveComplete' ? 'Úkol splněn' : 'Úkol selhal'}: ${obj.text}`,
          slowdown: true,
        })
      }
      break
    }
    case 'addObjective':
      // nový úkol za běhu (zvraty misí 3/4) — id nesmí kolidovat s existujícím
      if (a.objectiveId !== undefined && a.text !== undefined
        && !state.objectives.some(o => o.id === a.objectiveId)) {
        state.objectives.push({ id: a.objectiveId, text: a.text, state: 'open' })
        state.events.push({
          t: state.t, kind: 'objective', text: `Nový úkol: ${a.text}`, slowdown: true,
        })
      }
      break
    case 'winMission':
    case 'loseMission':
      if (state.outcome === 'running') {
        state.outcome = a.kind === 'winMission' ? 'win' : 'lose'
        if (a.text) state.events.push({ t: state.t, kind: 'message', text: a.text, slowdown: true })
      }
      break
  }
}

/**
 * Vyhodnotí triggery scénáře. Podmínky jsou AND; akce se provedou všechny.
 * once ⇒ po prvním spuštění fired = true a trigger už nikdy nevystřelí.
 */
export function updateTriggers(state: SimState, scenario: Scenario): void {
  if (state.outcome !== 'running') return
  for (const trigger of scenario.triggers) {
    if (trigger.once && trigger.fired) continue
    if (!trigger.conditions.every(c => evalCondition(state, c))) continue
    for (const action of trigger.actions) applyAction(state, action)
    if (trigger.once) trigger.fired = true
  }
}
