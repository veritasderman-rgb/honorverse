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
import { launchSalvo } from './weapons'

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
 * Lodě spawnuté triggery ZA BĚHU smí nést pevné spec.id (mise 5–8: nextId
 * mezitím rostl o id raket/salv, takže by nebylo predikovatelné) — volí se
 * vysoká id (9000+), aby nekolidovala s průběžně přidělovanými.
 */
export function spawnShip(state: SimState, spec: ShipSpec): ShipState {
  const def = SHIP_CLASSES[spec.classId]
  if (!def) throw new Error(`Neznámá třída lodi: ${spec.classId}`)
  if (spec.id !== undefined) state.nextId = Math.max(state.nextId, spec.id + 1)

  const ship: ShipState = {
    id: spec.id ?? state.nextId++,
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
    // plošiny: strana hráče táhne plný příděl třídy; AI jen když jí je dá
    // scénář (spec.pods) — AI je zatím neumí odpálit sama, visely by mrtvé
    pods: spec.pods ?? (spec.side === 'player' ? def.podCapacity ?? 0 : 0),
    cms: spec.cms ?? def.magazineCMs,
    decoys: spec.decoys ?? def.decoyCount,
    decoyActive: spec.decoyActive ?? false,
    tubeCooldown: spec.tubeCooldown ?? 0,
    energyCooldown: spec.energyCooldown ?? 0,
    destroyed: spec.destroyed ?? false,
    surrendered: spec.surrendered ?? false,
    // -1e9: první výzva ke kapitulaci není blokována cooldownem
    lastSurrenderDemandAt: spec.lastSurrenderDemandAt ?? -1e9,
    doctrine: spec.doctrine ?? (spec.side === 'player' ? 'player' : 'freighter'),
    fireControl: spec.fireControl
      ? { ...spec.fireControl }
      : { mode: 'hold', targetId: null, salvoSize: Math.max(1, def.tubesPerBroadside), driveMode: 0, engaged: false },
    pendingWave: spec.pendingWave ? { ...spec.pendingWave } : null,
    buffs: spec.buffs
      ? { ...spec.buffs }
      : { lockBonus: 0, lockUntil: 0, repairBonus: 1, repairUntil: 0 },
    terminalTimes: spec.terminalTimes ? [...spec.terminalTimes] : [],
    formation: spec.formation ? { ...spec.formation } : null,
    desc: spec.desc,
    objective: spec.objective ?? false,
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
    case 'shipSurrendered':
      return byId(state, c.shipId)?.surrendered === true
    case 'flag':
      return c.flag !== undefined && state.flags[c.flag] === true
    case 'flagNot':
      // negace flagu — „dokud se X nestalo": jednorázové obranné pody (mise 9),
      // vzájemně výlučné konce finále (mise 10). Uvnitř JEDNOHO průchodu
      // updateTriggers platí pořadí pole triggers: dřívější trigger, který
      // flag nastaví, pozdějším podmínku flagNot zneplatní.
      return c.flag !== undefined && state.flags[c.flag] !== true
    case 'hullBelow': {
      // loď ŽIJE a trup pod zlomkem hullPoints třídy (poškozená základna —
      // spouštěč politického rozkazu mise 10); zničená loď podmínku NEplní
      const ship = byId(state, c.shipId)
      if (!ship || ship.destroyed || c.fraction === undefined) return false
      const def = SHIP_CLASSES[ship.classId]
      return !!def && ship.hull < c.fraction * def.hullPoints
    }
    case 'wedgeOn': {
      // splněno, když loď žije a má zapnutý klín (prozrazení — mise 4)
      const ship = byId(state, c.shipId)
      return !!ship && !ship.destroyed && ship.wedgeOn
    }
    case 'shipsDestroyedCount':
      // splněno, když počet zničených lodí dané strany >= count
      if (c.side === undefined || c.count === undefined) return false
      return state.ships.filter(s => s.side === c.side && s.destroyed).length >= c.count
    case 'classified':
      // splněno, když pozorující strana (default hráč) drží plnou identifikaci
      // kontaktu (idQuality 2 — aktivní zaměření zblízka); základ zvratu mise 5
      if (c.shipId === undefined) return false
      return state.contacts[c.side ?? 'player']
        .some(ct => ct.shipId === c.shipId && ct.idQuality === 2)
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
    case 'setSide': {
      // převlečená loď mění stranu (zvrat mise 6 — „záchranná" eskadra je léčka).
      // Kontakty přestaví přirozeně nejbližší updateSensors; tady jen vyčistíme
      // zámky AUTO palby, které by po přepnutí mířily na vlastní stranu.
      const ship = byId(state, a.shipId)
      if (!ship || a.side === undefined) break
      ship.side = a.side
      for (const s of state.ships) {
        if (s.fireControl.targetId === null) continue
        const target = byId(state, s.fireControl.targetId)
        if (target && target.side === s.side) {
          s.fireControl.targetId = null
          s.fireControl.mode = 'hold'
          s.fireControl.engaged = false
        }
      }
      break
    }
    case 'podSalvo': {
      // saturační salva z raketových podů (zvrat mise 7): obchází kapacitu
      // šachet i cooldown a neodečítá munici ze zásobníků lodi
      const ship = byId(state, a.shipId)
      const target = byId(state, a.targetId)
      if (ship && !ship.destroyed && target && !target.destroyed
        && a.targetId !== undefined && a.count !== undefined && a.count > 0) {
        launchSalvo(state, ship, a.targetId, a.count, 0,
          { podLaunch: true, ignoreCooldown: true })
      }
      break
    }
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
