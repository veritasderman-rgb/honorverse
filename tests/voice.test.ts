/**
 * Testy situačních hlásek posádky (src/sim/voice.ts):
 * edge-triggered (kategorie s limitem „jednou" se neopakují),
 * deterministický výběr varianty (stejný seed = stejný text),
 * hlásky jen pro stranu hráče.
 */
import { describe, expect, it } from 'vitest'
import type { MissileState, Scenario, ShipState, SimState, Subsystems } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { SIM_DT } from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'
import { launchSalvo } from '../src/sim/weapons'
import { applyBeamDamage } from '../src/sim/damage'
import { resolveTerminal } from '../src/sim/defense'
import { updateCrew } from '../src/sim/crew'
import { collectAIOrders } from '../src/sim/ai'

// ---------- helpery (stejný vzor jako gamefeel.test.ts) ----------

function fullSubsystems(v = 1): Subsystems {
  return {
    impellerFwd: v, impellerAft: v, sidewallPort: v, sidewallStbd: v,
    tubesPort: v, tubesStbd: v, energyPort: v, energyStbd: v,
    pdlc: v, cm: v, sensors: v, ecm: v,
  }
}

function makeState(seed: number): SimState {
  return {
    t: 0, rng: { s: seed >>> 0 }, nextId: 1000, ships: [], missiles: [],
    contacts: { player: [], enemy: [], neutral: [] }, events: [], pendingComms: [], flags: {},
    objectives: [], outcome: 'running', scenarioId: 'test',
  }
}

function makeShip(id: number, classId: string, over: Partial<ShipState> = {}): ShipState {
  const def = SHIP_CLASSES[classId]
  return {
    id, side: 'player', classId, name: `loď ${id}`,
    pos: vec(0, 0), vel: vec(0, 0), heading: 0, throttle: 0.8, nav: null,
    wedgeOn: true, activeSensors: true, rolledTo: null,
    subsystems: fullSubsystems(),
    hull: def.hullPoints, missiles: def.magazineMissiles, cms: def.magazineCMs,
    decoys: def.decoyCount, decoyActive: false,
    tubeCooldown: 0, energyCooldown: 0, destroyed: false, doctrine: 'player',
    surrendered: false, lastSurrenderDemandAt: -1e9,
    fireControl: { mode: 'hold', targetId: null, salvoSize: def.tubesPerBroadside, driveMode: 0, engaged: false },
    pendingWave: null,
    buffs: { lockBonus: 0, lockUntil: 0, repairBonus: 1, repairUntil: 0 },
    terminalTimes: [],
    ...over,
  }
}

function makeScenario(partial: Partial<Scenario>): Scenario {
  return { id: 'test', title: 'Test', briefing: '', seed: 1, ships: [], objectives: [], triggers: [], ...partial }
}

/** kontakt hráče na danou loď (plná pravda — testy senzory obcházejí) */
function addPlayerContact(state: SimState, target: ShipState, quality: 0 | 1 | 2 = 2): void {
  state.contacts.player.push({
    shipId: target.id, pos: { ...target.pos }, vel: { ...target.vel },
    age: 0, idQuality: quality, classGuess: quality > 0 ? target.classId : 'neznámá',
    wedgeDetected: true,
  })
}

/** scénář: hráčův DD + nepřátelský obchodník se zapnutým klínem v dosahu detekce */
const contactScenario = (seed: number): Scenario => makeScenario({
  seed,
  ships: [
    { classId: 'dd-vichr', side: 'player', name: 'DD', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
    {
      classId: 'merch-freighter', side: 'enemy', name: 'M',
      pos: { x: 40_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
    },
  ],
})

const messagesBy = (state: SimState, speaker: string): string[] =>
  state.events.filter(e => e.kind === 'message' && e.speaker === speaker).map(e => e.text)

// ---------- první kontakt ----------

describe('voice — první nepřátelský kontakt', () => {
  it('hláška spojaře vznikne právě jednou (edge flag)', () => {
    const state = sim.create(contactScenario(42))
    // kontakt vzniká už při create (počáteční senzorová picture)
    expect(state.flags['said:first-contact:mission']).toBe(true)
    const first = messagesBy(state, 'comms')
    expect(first).toHaveLength(1)

    // další ticky žádnou další hlásku první kategorie nepřidají
    state.events.length = 0
    for (let i = 0; i < 40; i++) sim.tick(state, SIM_DT)
    expect(messagesBy(state, 'comms')).toHaveLength(0)
  })

  it('varianta je deterministická dle seedu (2 běhy = stejný text)', () => {
    const a = sim.create(contactScenario(7))
    const b = sim.create(contactScenario(7))
    expect(messagesBy(a, 'comms')).toEqual(messagesBy(b, 'comms'))
    expect(messagesBy(a, 'comms')[0].length).toBeGreaterThan(10)
  })

  it('bez lodi ovládané hráčem hláska nevznikne', () => {
    const scenario = makeScenario({
      ships: [
        {
          classId: 'dd-vichr', side: 'player', name: 'DD',
          pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'escort',
        },
        {
          classId: 'merch-freighter', side: 'enemy', name: 'M',
          pos: { x: 40_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
        },
      ],
    })
    const state = sim.create(scenario)
    expect(messagesBy(state, 'comms')).toHaveLength(0)
    expect(state.flags['said:first-contact:mission']).toBeUndefined()
  })
})

// ---------- klasifikace válečné lodi ----------

describe('voice — klasifikace válečné lodi', () => {
  it('plná identifikace nepřátelského CL ohlásí třídu (jednou)', () => {
    const scenario = makeScenario({
      ships: [
        {
          classId: 'dd-vichr', side: 'player', name: 'DD',
          pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, activeSensors: true,
        },
        {
          classId: 'cl-sokol', side: 'enemy', name: 'E',
          pos: { x: 3_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
        },
      ],
    })
    const state = sim.create(scenario)
    const classMsgs = messagesBy(state, 'tactical').filter(t => t.includes('třída Sokol'))
    expect(classMsgs).toHaveLength(1)
    expect(state.flags['said:warship:2']).toBe(true)

    state.events.length = 0
    for (let i = 0; i < 40; i++) sim.tick(state, SIM_DT)
    expect(messagesBy(state, 'tactical').filter(t => t.includes('třída Sokol'))).toHaveLength(0)
  })

  it('obchodník (MERCH) klasifikační hlásku válečné lodi nevyvolá', () => {
    const scenario = makeScenario({
      ships: [
        {
          classId: 'dd-vichr', side: 'player', name: 'DD',
          pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, activeSensors: true,
        },
        {
          classId: 'merch-freighter', side: 'enemy', name: 'M',
          pos: { x: 3_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
        },
      ],
    })
    const state = sim.create(scenario)
    expect(state.flags['said:warship:2']).toBeUndefined()
  })
})

// ---------- první příchozí salva ----------

describe('voice — první příchozí salva (vampýři)', () => {
  it('nepřátelský odpal na hráče vyvolá hlásku právě jednou', () => {
    const state = makeState(5)
    const player = makeShip(1, 'ca-bastion')
    const enemy = makeShip(2, 'cl-sokol', { side: 'enemy', doctrine: 'hunter', pos: vec(3_000_000, 0) })
    state.ships.push(player, enemy)

    launchSalvo(state, enemy, 1, 4, 0)
    expect(state.missiles.length).toBe(4)
    const tac = messagesBy(state, 'tactical')
    expect(tac).toHaveLength(1)
    expect(state.flags['said:first-vampire:mission']).toBe(true)

    // druhá salva už hlásku nepřidá
    state.events.length = 0
    enemy.tubeCooldown = 0
    launchSalvo(state, enemy, 1, 4, 0)
    expect(messagesBy(state, 'tactical')).toHaveLength(0)
  })
})

// ---------- zásahy vlastní lodi ----------

describe('voice — zásah vlastní lodi (lehký/těžký)', () => {
  it('těžký zásah hlásí XO, lehký inženýr; obě jen jednou', () => {
    const state = makeState(11)
    const ca = makeShip(1, 'ca-bastion')
    state.ships.push(ca)

    // těžký: 45 do hrdla → 56.25 poškození trupu (≥ práh)
    applyBeamDamage(state, ca, 45, 'throat')
    expect(messagesBy(state, 'xo').length).toBeGreaterThanOrEqual(1)
    expect(state.flags['said:hit-heavy:1']).toBe(true)
    const xoCount = messagesBy(state, 'xo').length

    // lehký: malé poškození hrdlem → hláška inženýra (kategorie zvlášť)
    applyBeamDamage(state, ca, 5, 'throat')
    expect(state.flags['said:hit-light:1']).toBe(true)

    // opakované zásahy už hlásky kategorie nepřidají
    const engCount = messagesBy(state, 'engineer')
      .filter(t => !t.startsWith('Inženýr:')).length
    applyBeamDamage(state, ca, 45, 'throat')
    applyBeamDamage(state, ca, 5, 'throat')
    expect(messagesBy(state, 'xo').filter(t => !t.includes('nevydrží')
      && !t.includes('polovinou') && !t.includes('obrazovku')).length).toBe(xoCount)
    expect(messagesBy(state, 'engineer').filter(t => !t.startsWith('Inženýr:')).length).toBe(engCount)
  })
})

// ---------- pozorovaný zásah nepřítele ----------

describe('voice — pozorovaný zásah nepřítele', () => {
  it('missileHit na sledovaného nepřítele vyvolá hlásku taktického (jednou)', () => {
    const state = makeState(3)
    const player = makeShip(1, 'ca-bastion')
    const enemy = makeShip(2, 'merch-freighter', {
      side: 'enemy', doctrine: 'freighter', pos: vec(200_000, 0),
      subsystems: fullSubsystems(0), cms: 0, hull: 1e9,
    })
    state.ships.push(player, enemy)
    addPlayerContact(state, enemy)

    const mk = (id: number): MissileState => ({
      id, side: 'player', def: 'std-shipkiller',
      pos: vec(170_000, 0), vel: vec(20_000, 0),
      targetId: 2, mode: 1, driveRemaining: 60, phase: 'terminal', lock: 1.0, salvoId: 1,
    })
    resolveTerminal(state, mk(100), enemy)
    expect(state.events.some(e => e.kind === 'missileHit')).toBe(true)
    const tac = messagesBy(state, 'tactical')
    expect(tac).toHaveLength(1)
    expect(state.flags['said:enemy-hit:2']).toBe(true)

    state.events.length = 0
    resolveTerminal(state, mk(101), enemy)
    expect(messagesBy(state, 'tactical')).toHaveLength(0)
  })
})

// ---------- stavové hlásky (jednou) ----------

describe('voice — stavové hlásky (trup/munice/CM)', () => {
  it('trup pod 50 % ohlásí XO jednou', () => {
    const state = makeState(21)
    const dd = makeShip(1, 'dd-vichr', { hull: 20 }) // z 60
    state.ships.push(dd)
    updateCrew(state, SIM_DT)
    expect(messagesBy(state, 'xo')).toHaveLength(1)
    state.events.length = 0
    updateCrew(state, SIM_DT)
    expect(messagesBy(state, 'xo')).toHaveLength(0)
  })

  it('rakety a CM pod 25 % zásobníku ohlásí taktický (každé jednou)', () => {
    const state = makeState(22)
    const dd = makeShip(1, 'dd-vichr', { missiles: 10, cms: 30 }) // z 90 / 260
    state.ships.push(dd)
    updateCrew(state, SIM_DT)
    const tac = messagesBy(state, 'tactical')
    expect(tac).toHaveLength(2) // munice + protirakety
    expect(state.flags['said:ammo-low:1']).toBe(true)
    expect(state.flags['said:cm-low:1']).toBe(true)
    state.events.length = 0
    updateCrew(state, SIM_DT)
    expect(messagesBy(state, 'tactical')).toHaveLength(0)
  })

  it('plné zásobníky a zdravý trup žádné hlásky negenerují (rng se nečerpá)', () => {
    const state = makeState(23)
    state.ships.push(makeShip(1, 'dd-vichr'))
    const rng0 = state.rng.s
    for (let i = 0; i < 50; i++) updateCrew(state, SIM_DT)
    expect(state.events.filter(e => e.kind === 'message')).toHaveLength(0)
    expect(state.rng.s).toBe(rng0)
  })
})

// ---------- cíl v poháněné obálce ----------

describe('voice — cíl vstoupil do poháněné obálky', () => {
  it('nepřítel v obálce vyvolá hlásku jednou na cíl', () => {
    const state = makeState(31)
    const dd = makeShip(1, 'dd-vichr')
    const enemy = makeShip(2, 'cl-sokol', { side: 'enemy', doctrine: 'hunter', pos: vec(3_000_000, 0) })
    state.ships.push(dd, enemy)
    addPlayerContact(state, enemy)

    updateCrew(state, SIM_DT)
    const tac = messagesBy(state, 'tactical')
    expect(tac.some(t => t.includes('obálc') || t.includes('obálk') || t.includes('rozkaz'))).toBe(true)
    expect(state.flags['said:in-envelope:2']).toBe(true)

    state.events.length = 0
    updateCrew(state, SIM_DT)
    expect(messagesBy(state, 'tactical')).toHaveLength(0)
  })

  it('cíl daleko za obálkou hlásku nevyvolá', () => {
    const state = makeState(32)
    const dd = makeShip(1, 'dd-vichr')
    const enemy = makeShip(2, 'cl-sokol', { side: 'enemy', doctrine: 'hunter', pos: vec(40_000_000, 0) })
    state.ships.push(dd, enemy)
    addPlayerContact(state, enemy)
    updateCrew(state, SIM_DT)
    expect(state.flags['said:in-envelope:2']).toBeUndefined()
  })
})

// ---------- nepřítel prchá ----------

describe('voice — nepřítel prchá (útěk piráta)', () => {
  it('pirát pod 50 % trupu na útěku vyvolá hlásku (jen když ho vidíme)', () => {
    const state = makeState(41)
    const dd = makeShip(1, 'dd-vichr')
    const def = SHIP_CLASSES['cl-korzar']
    const pirate = makeShip(2, 'cl-korzar', {
      side: 'enemy', doctrine: 'pirate', pos: vec(5_000_000, 0),
      hull: 0.3 * def.hullPoints,
    })
    state.ships.push(dd, pirate)
    addPlayerContact(state, pirate)
    // pirát vidí hráče (aby měl od čeho prchat)
    state.contacts.enemy.push({
      shipId: 1, pos: vec(0, 0), vel: vec(0, 0), age: 0,
      idQuality: 2, classGuess: 'dd-vichr', wedgeDetected: true,
    })

    collectAIOrders(state)
    const tac = messagesBy(state, 'tactical')
    expect(tac.some(t => t.includes('prchá') || t.includes('maže') || t.includes('dost'))).toBe(true)
    expect(state.flags['said:enemy-fleeing:2']).toBe(true)

    state.events.length = 0
    collectAIOrders(state)
    expect(messagesBy(state, 'tactical').filter(t =>
      t.includes('prchá') || t.includes('maže') || t.includes('dost'))).toHaveLength(0)
  })

  it('neviděný pirát na útěku hlásku nevyvolá', () => {
    const state = makeState(42)
    const dd = makeShip(1, 'dd-vichr')
    const def = SHIP_CLASSES['cl-korzar']
    const pirate = makeShip(2, 'cl-korzar', {
      side: 'enemy', doctrine: 'pirate', pos: vec(50_000_000, 0),
      hull: 0.3 * def.hullPoints,
    })
    state.ships.push(dd, pirate)
    collectAIOrders(state)
    expect(state.flags['said:enemy-fleeing:2']).toBeUndefined()
  })
})
