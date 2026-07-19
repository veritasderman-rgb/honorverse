/**
 * Testy balíku „herní pocit": řízení palby (AUTO, zpětná vazba, vrstvená
 * salva), saturace PDLC, polní opravy + události posádky, hyperlimit
 * ve scénářích a komunikační triggery (kind 'comm', speaker).
 */
import { describe, expect, it } from 'vitest'
import type { MissileState, Scenario, ShipState, SimState, Subsystems } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { REPAIR_CAP, SIM_DT, TUBE_COOLDOWN } from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'
import { launchSalvo, fireEnergy, poweredEnvelope, updateMissiles } from '../src/sim/weapons'
import { updateDefenses } from '../src/sim/defense'
import { updateTriggers } from '../src/sim/scenario'
import { applyBeamDamage } from '../src/sim/damage'
import { mission01 } from '../src/data/missions/mission01'
import { mission02 } from '../src/data/missions/mission02'
import { mission03 } from '../src/data/missions/mission03'
import { mission04 } from '../src/data/missions/mission04'

// ---------- helpery ----------

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

/** scénář: hráčova CL + statický nepřátelský obchodník na dané vzdálenosti */
const duelScenario = (targetX: number): Scenario => makeScenario({
  ships: [
    { classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
    {
      classId: 'merch-freighter', side: 'enemy', name: 'M',
      pos: { x: targetX, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
      subsystems: fullSubsystems(0), cms: 0, // bez obrany — testujeme palbu, ne pipeline
    },
  ],
})

// ---------- řízení palby: AUTO ----------

describe('fire control — AUTO režim', () => {
  it('cíl v poháněné obálce: hláška „Palebné řešení" a opakované salvy', () => {
    const state = sim.create(duelScenario(3_000_000)) // < obálka LO ~7,3 M km
    sim.applyOrder(state, {
      kind: 'setFireControl', shipId: 1,
      fc: { mode: 'auto', targetId: 2, salvoSize: 2, driveMode: 0 },
    })
    sim.tick(state, SIM_DT)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('Palebné řešení'))).toBe(true)
    expect(state.missiles.length).toBe(2)
    expect(state.ships[0].missiles).toBe(148)
    state.events.length = 0

    // po uplynutí cooldownu odpálí sám další salvu
    let launches = 0
    for (let i = 0; i < Math.ceil(TUBE_COOLDOWN / SIM_DT) + 4; i++) {
      sim.tick(state, SIM_DT)
      launches += state.events.filter(e => e.kind === 'launch').length
      state.events.length = 0
    }
    expect(launches).toBeGreaterThanOrEqual(1)
    expect(state.ships[0].missiles).toBeLessThanOrEqual(146)
  })

  it('cíl mimo poháněnou obálku: žádný odpal, žádné „Palebné řešení"', () => {
    const state = sim.create(duelScenario(40_000_000)) // daleko za obálkou
    sim.applyOrder(state, {
      kind: 'setFireControl', shipId: 1,
      fc: { mode: 'auto', targetId: 2, salvoSize: 2, driveMode: 0 },
    })
    for (let i = 0; i < 20; i++) sim.tick(state, SIM_DT)
    expect(state.missiles.length).toBe(0)
    expect(state.ships[0].fireControl.engaged).toBe(false)
  })

  it('poweredEnvelope roste s vektorem k cíli a klesá s vektorem od cíle', () => {
    const rest = poweredEnvelope(vec(0, 0), vec(0, 0), vec(1e7, 0), vec(0, 0), 0)
    const toward = poweredEnvelope(vec(0, 0), vec(1000, 0), vec(1e7, 0), vec(0, 0), 0)
    const away = poweredEnvelope(vec(0, 0), vec(-1000, 0), vec(1e7, 0), vec(0, 0), 0)
    expect(rest).toBeGreaterThan(7_000_000) // ~7,3 M km z klidu (kap. 2)
    expect(rest).toBeLessThan(7_500_000)
    expect(toward).toBeGreaterThan(rest)
    expect(away).toBeLessThan(rest)
  })
})

// ---------- zpětná vazba rozkazů ----------

describe('zpětná vazba rozkazů (no-op hlásí důvod)', () => {
  it('launchSalvo při cooldownu hlásí „Šachty přebíjejí"', () => {
    const state = makeState(1)
    const dd = makeShip(1, 'dd-vichr', { tubeCooldown: 18 })
    state.ships.push(dd)
    launchSalvo(state, dd, 2, 3, 0)
    expect(state.missiles.length).toBe(0)
    const ev = state.events.find(e => e.kind === 'message' && e.text.includes('Šachty přebíjejí'))
    expect(ev).toBeDefined()
    expect(ev?.speaker).toBe('tactical')
  })

  it('launchSalvo bez munice hlásí „Prázdné zásobníky"', () => {
    const state = makeState(2)
    const dd = makeShip(1, 'dd-vichr', { missiles: 0 })
    state.ships.push(dd)
    launchSalvo(state, dd, 2, 3, 0)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('Prázdné zásobníky'))).toBe(true)
  })

  it('launchSalvo na cíl mimo obálku varuje, ale odpálí', () => {
    const state = makeState(3)
    const dd = makeShip(1, 'dd-vichr')
    const tgt = makeShip(2, 'merch-freighter', { side: 'enemy', pos: vec(40_000_000, 0) })
    state.ships.push(dd, tgt)
    launchSalvo(state, dd, 2, 2, 0)
    expect(state.missiles.length).toBe(2)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('mimo poháněnou obálku'))).toBe(true)
  })

  it('fireEnergy mimo dosah hlásí důvod, při cooldownu taky', () => {
    const state = makeState(4)
    const dd = makeShip(1, 'dd-vichr')
    const tgt = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(2_000_000, 0) })
    state.ships.push(dd, tgt)
    fireEnergy(state, dd, tgt)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('mimo dosah energetických'))).toBe(true)

    tgt.pos = vec(300_000, 0)
    dd.energyCooldown = 12
    state.events.length = 0
    fireEnergy(state, dd, tgt)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('nabíjejí'))).toBe(true)
  })

  it('AI lodě (doctrine != player) zpětnou vazbu negenerují', () => {
    const state = makeState(5)
    const dd = makeShip(1, 'dd-vichr', { doctrine: 'pirate', side: 'enemy', missiles: 0 })
    state.ships.push(dd)
    launchSalvo(state, dd, 2, 3, 0)
    expect(state.events.length).toBe(0)
  })
})

// ---------- vrstvená salva ----------

describe('vrstvená salva (launchLayered)', () => {
  it('LO vlna hned, HI follow-up zpožděný; obě dorazí do ±10 s', () => {
    const state = sim.create(duelScenario(6_000_000))
    sim.applyOrder(state, { kind: 'launchLayered', shipId: 1, targetId: 2, countLo: 2, countHi: 1 })
    expect(state.missiles.length).toBe(2)
    expect(state.missiles.every(m => m.mode === 0)).toBe(true)
    const wave = state.ships[0].pendingWave
    expect(wave).not.toBeNull()
    expect(wave!.mode).toBe(1)
    expect(wave!.launchAt).toBeGreaterThan(0) // HI je rychlejší → odpal se zpozdí

    // druhá vlna odstartuje sama (i před koncem cooldownu šachet)
    let hiLaunched = false
    const arrivals: number[] = []
    for (let i = 0; i < 1200 && arrivals.length < 3; i++) {
      sim.tick(state, SIM_DT)
      for (const ev of state.events) {
        if (ev.kind === 'launch' && ev.text.includes('druhá vlna')) hiLaunched = true
        if (ev.kind === 'missileHit' || ev.kind === 'missileMiss') arrivals.push(ev.t)
      }
      state.events.length = 0
    }
    expect(hiLaunched).toBe(true)
    expect(arrivals.length).toBe(3)
    // společný přílet: rozptyl příletů do 10 s
    expect(Math.max(...arrivals) - Math.min(...arrivals)).toBeLessThanOrEqual(10)
  })
})

// ---------- saturace PDLC ----------

describe('saturace PDLC', () => {
  /**
   * Pipeline bez CM (jen PDLC): 3 rakety proti zdravému CA.
   * spacingSteps = 0 → přílet společně (vrstvená salva),
   * spacingSteps = 40 (20 s) → postupně, mimo saturační okno.
   */
  function run3(seed: number, spacingSteps: number): number {
    const state = makeState(seed)
    const ca = makeShip(1, 'ca-bastion', { hull: 1e9, cms: 0 })
    state.ships.push(ca)
    const mk = (id: number): MissileState => ({
      id, side: 'enemy', def: 'std-shipkiller',
      pos: vec(3_000_000, 0), vel: vec(-20_000, 0),
      targetId: 1, mode: 1, driveRemaining: 60, phase: 'boost', lock: 1.0, salvoId: 1,
    })
    let hits = 0
    let spawned = 0
    for (let step = 0; step < 900; step++) {
      while (spawned < 3 && step === spawned * spacingSteps) {
        state.missiles.push(mk(100 + spawned))
        spawned++
      }
      updateMissiles(state, 0.5)
      updateDefenses(state, 0.5)
      state.t += 0.5 // čas musí běžet — saturační okno je vázané na state.t
      hits += state.events.filter(e => e.kind === 'missileHit').length
      state.events.length = 0
      if (spawned === 3 && state.missiles.length === 0) break
    }
    return hits
  }

  it('vrstvená 2+1 (společný přílet) proniká lépe než 3× postupně', () => {
    const SEEDS = 400
    let layered = 0
    let sequential = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      layered += run3(seed, 0)
      sequential += run3(seed, 40)
    }
    expect(layered).toBeGreaterThan(sequential)
  })

  it('terminalTimes drží jen okno 15 s', () => {
    const state = makeState(9)
    const ca = makeShip(1, 'ca-bastion', { hull: 1e9, cms: 0 })
    state.ships.push(ca)
    ca.terminalTimes = [0, 1, 2]
    state.t = 30
    state.missiles.push({
      id: 100, side: 'enemy', def: 'std-shipkiller',
      pos: vec(25_000, 0), vel: vec(-20_000, 0),
      targetId: 1, mode: 1, driveRemaining: 60, phase: 'boost', lock: 1.0, salvoId: 1,
    })
    updateMissiles(state, 0.5) // standoff → terminál
    expect(ca.terminalTimes).toEqual([30]) // staré časy vypadly, nový přidán
  })
})

// ---------- opravy a posádka ----------

describe('polní opravy (damage control)', () => {
  it('subsystém pod stropem se opravuje ~0.0004/s do 0.7 a hlásí „znovu online"', () => {
    const scenario = makeScenario({
      ships: [{
        classId: 'dd-vichr', side: 'player', name: 'DD',
        pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 },
        subsystems: { ...fullSubsystems(), tubesPort: 0.3, pdlc: 0.9 },
      }],
    })
    const state = sim.create(scenario)
    // 500 s: 0.3 + 0.2 = 0.5
    for (let i = 0; i < 1000; i++) sim.tick(state, SIM_DT)
    expect(state.ships[0].subsystems.tubesPort).toBeCloseTo(0.5, 2)
    expect(state.ships[0].subsystems.pdlc).toBe(0.9) // nad stropem se nemění

    // dalších 600 s: dosažení stropu 0.7 + hlášení inženýra
    const events: string[] = []
    for (let i = 0; i < 1200; i++) {
      sim.tick(state, SIM_DT)
      for (const ev of state.events) events.push(ev.text)
      state.events.length = 0
    }
    expect(state.ships[0].subsystems.tubesPort).toBe(REPAIR_CAP)
    expect(events.some(t => t.includes('znovu online'))).toBe(true)
  })

  it('poškození subsystému hráče vyvolá hlášení inženýra s odhadem opravy', () => {
    const state = makeState(11)
    const ca = makeShip(1, 'ca-bastion')
    state.ships.push(ca)
    // dmg 45 → šance zásahu subsystému 100 %
    applyBeamDamage(state, ca, 45, 'throat')
    const eng = state.events.find(e => e.speaker === 'engineer' && e.text.includes('Inženýr'))
    expect(eng).toBeDefined()
  })

  it('za boje vznikají náhodné události posádky (comm + speaker + buff)', () => {
    const scenario = makeScenario({
      seed: 7,
      ships: [
        { classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        {
          classId: 'ca-bastion', side: 'enemy', name: 'CA',
          pos: { x: 8_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
        },
      ],
    })
    const state = sim.create(scenario)
    const crewEvents: string[] = []
    for (let i = 0; i < 6000 && crewEvents.length === 0; i++) { // až 50 min
      sim.tick(state, SIM_DT)
      for (const ev of state.events) {
        if (ev.kind === 'comm' && ev.speaker
          && ['tactical', 'engineer', 'comms'].includes(ev.speaker)) {
          crewEvents.push(`${ev.speaker}: ${ev.text}`)
        }
      }
      state.events.length = 0
    }
    expect(crewEvents.length).toBeGreaterThan(0)
  })

  it('bez boje náhodné události nevznikají (a rng se nečerpá)', () => {
    const scenario = makeScenario({
      ships: [{ classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } }],
    })
    const state = sim.create(scenario)
    const rng0 = state.rng.s
    for (let i = 0; i < 2000; i++) sim.tick(state, SIM_DT)
    expect(state.rng.s).toBe(rng0)
    expect(state.events.every(e => e.kind !== 'comm')).toBe(true)
  })
})

// ---------- hyperlimit ----------

describe('hyperlimit ve scénářích', () => {
  it('mise 1: lineX na 250 mil. km; mise 2–4 mají hyperlimit definován', () => {
    expect(mission01.hyperlimit).toEqual({ kind: 'lineX', x: 250_000_000 })
    expect(mission02.hyperlimit?.kind).toBe('lineX')
    expect(mission03.hyperlimit?.kind).toBe('circle')
    expect(mission04.hyperlimit).toEqual({ kind: 'lineX', x: 250_000_000 })
  })
})

// ---------- komunikace ----------

describe('komunikační triggery (kind comm)', () => {
  it('akce comm vytvoří event kind comm se speaker a slowdown', () => {
    const scenario = makeScenario({
      ships: [{ classId: 'dd-vichr', side: 'player', name: 'DD', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } }],
      triggers: [{
        id: 't-comm', once: true,
        conditions: [{ kind: 'time', t: 0 }],
        actions: [{ kind: 'comm', speaker: 'station', text: 'Zdravím, Dauntless.' }],
      }],
    })
    const state = sim.create(scenario)
    updateTriggers(state, scenario)
    const ev = state.events.find(e => e.kind === 'comm')
    expect(ev).toBeDefined()
    expect(ev?.speaker).toBe('station')
    expect(ev?.text).toBe('Zdravím, Dauntless.')
    expect(ev?.slowdown).toBe(true)
  })

  it('mise 1–4 obsahují komunikaci a speakery jen z ART_PROMPTS sady', () => {
    const allowed = new Set([
      'captain', 'xo', 'engineer', 'tactical', 'comms',
      'enemy-captain', 'pirate', 'station', 'governor',
    ])
    for (const m of [mission01, mission02, mission03, mission04]) {
      const comms = m.triggers.flatMap(t => t.actions.filter(a => a.kind === 'comm'))
      expect(comms.length).toBeGreaterThanOrEqual(1)
      for (const c of comms) {
        expect(c.speaker).toBeDefined()
        expect(allowed.has(c.speaker!)).toBe(true)
        expect((c.text ?? '').length).toBeGreaterThan(0)
      }
    }
  })

  it('mise 1: Kontrola Brány → vzdor Cygnusu → výzva ke kapitulaci po zvratu', () => {
    const scenario = structuredClone(mission01)
    const state = sim.create(scenario)
    state.t = 30
    updateTriggers(state, scenario)
    expect(state.events.filter(e => e.kind === 'comm')).toHaveLength(2) // station + enemy-captain
    state.events.length = 0
    state.ships[0].pos = { x: 36_000_000, y: 0 } // zvrat
    updateTriggers(state, scenario)
    // při skoku na 36 M km vystřelí i předzvěst zvratu (šifrování) — hledej
    // konkrétní výzvu ke kapitulaci mezi comm eventy spojaře
    const comms = state.events.filter(e => e.kind === 'comm' && e.speaker === 'comms')
    expect(comms.some(e => e.text.includes('zastavte'))).toBe(true)
  })
})
