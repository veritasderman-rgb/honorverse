/**
 * Testy balíku „férový boj a flotila": rolování blokuje palbu (a AI se
 * od-roluje), dno eroze zámku („posádky se ECM propálí"), odhad průniku
 * salvy (estimatePenetration), tažené návnady, ECM doprovod salvy
 * (eskortní rušička) a čistá logika rosteru flotily.
 */
import { describe, expect, it } from 'vitest'
import type { MissileState, Scenario, ShipState, SimState, Subsystems } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import {
  CM_INTERCEPT_RANGE, LOCK_FLOOR, LOCK_FLOOR_GUIDED, ROLL_TIME,
  SENSOR_UPDATE_INTERVAL, SIM_DT, TUBE_COOLDOWN,
} from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'
import { fireEnergy, launchDouble, launchSalvo, updateMissiles } from '../src/sim/weapons'
import { deployDecoy, updateDefenses } from '../src/sim/defense'
import { collectAIOrders } from '../src/sim/ai'
import { estimatePenetration } from '../src/sim/estimate'
import {
  controllableShips, isControllable, resolveOwnShipId, rosterPick, rosterVisible,
} from '../src/ui/roster'

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
    contacts: { player: [], enemy: [], neutral: [] }, events: [], pendingComms: [],
    flags: {}, objectives: [], outcome: 'running', scenarioId: 'test',
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

function makeMissile(id: number, targetId: number, over: Partial<MissileState> = {}): MissileState {
  return {
    id, side: 'enemy', def: 'std-shipkiller',
    pos: vec(3_000_000, 0), vel: vec(-20_000, 0),
    targetId, mode: 1, driveRemaining: 60, phase: 'boost', lock: 1.0, salvoId: 1,
    ...over,
  }
}

function makeScenario(partial: Partial<Scenario>): Scenario {
  return { id: 'test', title: 'Test', briefing: '', seed: 1, ships: [], objectives: [], triggers: [], ...partial }
}

// ---------- rolování blokuje palbu ----------

describe('rolování blokuje palbu (odvalený nestřílí)', () => {
  it('launchSalvo odvalené lodi je no-op s hláškou; po návratu pálí', () => {
    const state = makeState(1)
    const cl = makeShip(1, 'cl-sokol', { rolledTo: 1.2 })
    const tgt = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(3_000_000, 0) })
    state.ships.push(cl, tgt)

    launchSalvo(state, cl, 2, 4, 0)
    expect(state.missiles.length).toBe(0)
    expect(cl.missiles).toBe(SHIP_CLASSES['cl-sokol'].magazineMissiles)
    expect(cl.tubeCooldown).toBe(0) // cooldown se nenabil — odpal se nestal
    expect(state.events.some(e => e.kind === 'message'
      && e.text.includes('Jsme odvalení'))).toBe(true)

    cl.rolledTo = null
    launchSalvo(state, cl, 2, 4, 0)
    expect(state.missiles.length).toBe(4)
  })

  it('fireEnergy odvalené lodi je no-op s hláškou', () => {
    const state = makeState(2)
    const cl = makeShip(1, 'cl-sokol', { rolledTo: 0 })
    const tgt = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(200_000, 0) })
    state.ships.push(cl, tgt)
    fireEnergy(state, cl, tgt)
    expect(state.events.some(e => e.kind === 'energyHit')).toBe(false)
    expect(state.events.some(e => e.text.includes('Jsme odvalení'))).toBe(true)
    expect(cl.energyCooldown).toBe(0)
  })

  it('AI hlášky negeneruje (crewSay jen pro doctrine player)', () => {
    const state = makeState(3)
    const enemy = makeShip(1, 'cl-sokol', { side: 'enemy', doctrine: 'hunter', rolledTo: 0 })
    state.ships.push(enemy)
    launchSalvo(state, enemy, 2, 4, 0)
    expect(state.events.length).toBe(0)
  })

  it('odpal z podů funguje i z odvalené lodi (pody visí mimo trup)', () => {
    const state = makeState(4)
    const cl = makeShip(1, 'cl-sokol', { rolledTo: 0.5 })
    const tgt = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(3_000_000, 0) })
    state.ships.push(cl, tgt)
    launchSalvo(state, cl, 2, 6, 0, { podLaunch: true, ignoreCooldown: true })
    expect(state.missiles.length).toBe(6)
  })

  it('AUTO palba při odvalení čeká (hláška jen na hraně) a po návratu pokračuje', () => {
    const scenario = makeScenario({
      ships: [
        { classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        {
          classId: 'merch-freighter', side: 'enemy', name: 'M',
          pos: { x: 3_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
          subsystems: fullSubsystems(0), cms: 0,
        },
      ],
    })
    const state = sim.create(scenario)
    sim.applyOrder(state, { kind: 'roll', shipId: 1, towards: 0 })
    sim.applyOrder(state, {
      kind: 'setFireControl', shipId: 1,
      fc: { mode: 'auto', targetId: 2, salvoSize: 2, driveMode: 0 },
    })
    let waitMsgs = 0
    for (let i = 0; i < 40; i++) {
      sim.tick(state, SIM_DT)
      waitMsgs += state.events.filter(e => e.kind === 'message'
        && e.text.includes('AUTO palba čeká')).length
      state.events.length = 0
    }
    expect(state.missiles.length).toBe(0) // odvalená loď nepálí
    expect(waitMsgs).toBe(1)              // hláška jen jednou (hrana, žádný spam)

    sim.applyOrder(state, { kind: 'roll', shipId: 1, towards: null })
    for (let i = 0; i < 10; i++) sim.tick(state, SIM_DT)
    expect(state.missiles.length).toBeGreaterThan(0) // palba obnovena
  })
})

// ---------- AI: rolování s hlavou ----------

describe('AI rolování — bez vševědoucnosti, s od-rolováním', () => {
  /** stát: odvalený nepřátelský hunter + volitelné příchozí rakety hráče */
  function hunterState(over: Partial<ShipState> = {}): SimState {
    const state = makeState(11)
    state.ships.push(makeShip(1, 'cl-sokol', {
      side: 'enemy', doctrine: 'hunter', activeSensors: false, ...over,
    }))
    return state
  }

  it('nereaguje na čerstvě odpálenou salvu (letí < SENSOR_UPDATE_INTERVAL)', () => {
    const state = hunterState()
    state.t = 100
    state.missiles.push(makeMissile(50, 1, {
      side: 'player', pos: vec(300_000, 0), launchedAt: 100 - SENSOR_UPDATE_INTERVAL + 1,
    }))
    expect(collectAIOrders(state).some(o => o.kind === 'roll')).toBe(false)

    // po senzorovém intervalu už salvu vidí a roluje
    state.missiles[0].launchedAt = 100 - SENSOR_UPDATE_INTERVAL - 1
    const orders = collectAIOrders(state)
    expect(orders.some(o => o.kind === 'roll' && o.towards !== null)).toBe(true)
  })

  it('odvalená AI se vrátí, když je nejbližší salva dál než 1.5×ROLL_RANGE nebo žádná', () => {
    // žádná salva → roll zpět
    const state = hunterState({ rolledTo: 0.3 })
    expect(collectAIOrders(state).some(o => o.kind === 'roll' && o.towards === null)).toBe(true)

    // salva v hysterezním pásmu (500k–750k) → drží roll (žádný rozkaz)
    const state2 = hunterState({ rolledTo: 0 })
    state2.t = 100
    state2.missiles.push(makeMissile(50, 1, { side: 'player', pos: vec(600_000, 0), launchedAt: 0 }))
    expect(collectAIOrders(state2).some(o => o.kind === 'roll')).toBe(false)

    // salva daleko (> 750k) → roll zpět
    state2.missiles[0].pos = vec(800_000, 0)
    expect(collectAIOrders(state2).some(o => o.kind === 'roll' && o.towards === null)).toBe(true)
  })

  it('od-rolovaná AI obnoví palbu (E2E přes engine)', () => {
    const scenario = makeScenario({
      ships: [
        { classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        {
          classId: 'cl-sokol', side: 'enemy', name: 'E', doctrine: 'hunter',
          pos: { x: 4_000_000, y: 0 }, vel: { x: 0, y: 0 }, rolledTo: 3.14,
        },
      ],
    })
    const state = sim.create(scenario)
    for (let i = 0; i < 30; i++) sim.tick(state, SIM_DT)
    expect(state.ships[1].rolledTo).toBeNull() // žádná hrozba → vrátila se
    expect(state.missiles.some(m => m.side === 'enemy')).toBe(true) // a pálí
  })
})

// ---------- dno eroze zámku ----------

describe('dno eroze zámku („posádky se ECM propálí")', () => {
  /** raketa v ECM bublině cíle s vysokým ECM; erozi žene updateDefenses */
  function erosionState(shooterActive: boolean): SimState {
    const state = makeState(21)
    const shooter = makeShip(1, 'cl-sokol', { activeSensors: shooterActive })
    // bez CM — izolujeme čistě ECM erozi zámku
    const target = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(3_000_000, 0), cms: 0 })
    state.ships.push(shooter, target)
    state.missiles.push(makeMissile(100, 2, {
      side: 'player', shooterId: 1, pos: vec(2_000_000, 0), vel: vec(0, 0),
    }))
    return state
  }

  it('řízená salva s aktivním vedením neklesne pod LOCK_FLOOR_GUIDED = 0.4', () => {
    const state = erosionState(true)
    // dlouhý let v ECM bublině: bez dna by eroze 0.45·0.01·0.6·400 s zámek smazala
    for (let i = 0; i < 800; i++) updateDefenses(state, 0.5)
    const m = state.missiles[0]
    expect(m.phase).not.toBe('dead')
    expect(m.lock).toBeCloseTo(LOCK_FLOOR_GUIDED, 5)
  })

  it('bez aktivních senzorů střelce drží aspoň seeker dno LOCK_FLOOR = 0.3 (boost)', () => {
    const state = erosionState(false)
    for (let i = 0; i < 800; i++) updateDefenses(state, 0.5)
    const m = state.missiles[0]
    expect(m.phase).not.toBe('dead')
    expect(m.lock).toBeCloseTo(LOCK_FLOOR, 5)
  })

  it('zámek už pod dnem se ke dnu NEzvedá', () => {
    const state = erosionState(true)
    state.missiles[0].lock = 0.25 // např. po nouzovém obletu klínu
    updateDefenses(state, 0.5)
    expect(state.missiles[0].lock).toBeLessThanOrEqual(0.25)
  })

  it('balistický dojezd bez vedení eroduje dál až ke ztrátě zámku', () => {
    const state = makeState(22)
    const target = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(50_000_000, 0) })
    state.ships.push(target)
    // autonomní balistická raketa bez spoje, zámek těsně nad prahem
    state.missiles.push(makeMissile(100, 2, {
      side: 'player', autonomous: true, phase: 'ballistic', driveRemaining: 0,
      lock: 0.24, pos: vec(0, 0), vel: vec(10, 0),
    }))
    for (let i = 0; i < 30; i++) updateMissiles(state, 0.5) // 15 s · 0.005/s
    expect(state.missiles.length).toBe(0) // zámek klesl pod LOCK_LOST → mrtvá
  })
})

// ---------- odhad průniku ----------

describe('estimatePenetration — deterministický odhad', () => {
  /** cíl s omezenými CM (plný CA by malé salvy z 3 M km spolehlivě vynuloval) */
  function estimateState(cms: number): SimState {
    const state = makeState(31)
    state.ships.push(
      makeShip(1, 'ca-bastion', { vel: vec(20_000, 0) }),
      makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(3_000_000, 0), cms }),
    )
    return state
  }

  it('víc raket → víc průniku (monotonie v počtu)', () => {
    const state = estimateState(20)
    const [a, b] = [state.ships[0], state.ships[1]]
    let prev = -1
    for (const n of [4, 8, 16, 32]) {
      const { through } = estimatePenetration(state, a, b, n, 1)
      expect(through).toBeGreaterThan(prev)
      prev = through
    }
  })

  it('blíž → víc průniku (kratší čas v obraně)', () => {
    const state = estimateState(420)
    const [a, b] = [state.ships[0], state.ships[1]]
    b.classId = 'dd-vichr' // slabší obránce, ať malá salva vůbec proniká
    b.pos = vec(2_400_000, 0)
    const far = estimatePenetration(state, a, b, 8, 1)
    b.pos = vec(800_000, 0)
    const near = estimatePenetration(state, a, b, 8, 1)
    expect(near.through).toBeGreaterThan(far.through)
  })

  it('rozpad je český a sečte se k počtu; funkce nemutuje stav ani rng', () => {
    const state = estimateState(20)
    const rng0 = state.rng.s
    const { through, breakdown } = estimatePenetration(state, state.ships[0], state.ships[1], 16, 1)
    expect(breakdown).toMatch(/CM ~.+· PDLC ~.+· ECM ~.+→ projde ~.+\/16/)
    expect(through).toBeGreaterThanOrEqual(0)
    expect(through).toBeLessThanOrEqual(16)
    expect(state.rng.s).toBe(rng0)
    expect(state.missiles.length).toBe(0)
  })
})

// ---------- tažené návnady ----------

describe('tažené návnady (decoye) — spotřeba raketou', () => {
  it('deployDecoy aktivuje BEZ spotřeby zásoby; dubl a prázdný zásobník jsou no-op', () => {
    const state = makeState(41)
    const cl = makeShip(1, 'cl-sokol')
    state.ships.push(cl)
    state.t = 50
    sim.applyOrder(state, { kind: 'deployDecoy', shipId: 1 })
    expect(cl.decoyActive).toBe(true)
    expect(cl.decoys).toBe(SHIP_CLASSES['cl-sokol'].decoyCount) // odečet až zničením
    // druhá návnada během aktivity je no-op s hláškou
    sim.applyOrder(state, { kind: 'deployDecoy', shipId: 1 })
    expect(state.events.some(e => e.text.includes('už je za lodí'))).toBe(true)
    // bez zásoby taky no-op
    cl.decoys = 0
    cl.decoyActive = false
    state.events.length = 0
    deployDecoy(state, cl)
    expect(cl.decoyActive).toBe(false)
    expect(state.events.some(e => e.text.includes('prázdný'))).toBe(true)
  })

  it('jedna návnada pohltí právě JEDNU svedenou raketu a zanikne (decoys--)', () => {
    let absorbedStates = 0
    for (let seed = 1; seed <= 20; seed++) {
      const state = makeState(seed)
      const ca = makeShip(1, 'ca-bastion', { hull: 1e9, cms: 0, decoyActive: true })
      ca.subsystems.ecm = 0
      const stock0 = ca.decoys
      state.ships.push(ca)
      for (let i = 0; i < 10; i++) {
        state.missiles.push(makeMissile(100 + i, 1, {
          lock: 0.3, pos: vec(CM_INTERCEPT_RANGE - 1000, 0),
        }))
      }
      updateDefenses(state, 0.5)
      const n = state.events.filter(e => e.cause === 'decoy').length
      expect(n).toBeLessThanOrEqual(1) // víc než jednu raketu jedna návnada nepohltí
      if (n === 1) {
        absorbedStates++
        expect(ca.decoyActive).toBe(false)   // návnada zničena
        expect(ca.decoys).toBe(stock0 - 1)   // zásoba odečtena až teď
        expect(state.events.some(e => e.text.includes('návnada zničena'))).toBe(true)
      } else {
        expect(ca.decoyActive).toBe(true)
        expect(ca.decoys).toBe(stock0)
      }
    }
    expect(absorbedStates).toBeGreaterThan(0) // svedení reálně nastává
  })

  it('redeploy: nová návnada dá už prověřeným raketám nový test svedení', () => {
    let done = false
    for (let seed = 1; seed <= 30 && !done; seed++) {
      const state = makeState(seed)
      const ca = makeShip(1, 'ca-bastion', { hull: 1e9, cms: 0, decoyActive: true })
      ca.subsystems.ecm = 0
      state.ships.push(ca)
      state.missiles.push(makeMissile(100, 1, { pos: vec(CM_INTERCEPT_RANGE - 1000, 0), vel: vec(0, 0) }))
      updateDefenses(state, 0.5)
      if (state.missiles.length === 0) continue // raketa svedena — zkus jiný seed
      expect(state.missiles[0].decoyChecked).toBe(true) // test proběhl, raketa přežila
      ca.decoyActive = false // simuluj ztrátu návnady
      deployDecoy(state, ca) // redeploy — žádný cooldown
      expect(ca.decoyActive).toBe(true)
      expect(state.missiles[0].decoyChecked).toBe(false) // čerstvý test pro novou návnadu
      done = true
    }
    expect(done).toBe(true)
  })

  it('šance škáluje kvalitou elektroniky: pirát (ecm 0.15) < Avalon (ecm 0.45)', () => {
    // za seed 8 raket a jedna návnada: počítáme stavy, kde návnada pohltila raketu
    const run = (seed: number, classId: string): number => {
      const state = makeState(seed)
      const ship = makeShip(1, classId, { hull: 1e9, cms: 0, decoyActive: true, decoys: 4 })
      ship.subsystems.ecm = 0
      state.ships.push(ship)
      for (let i = 0; i < 8; i++) {
        state.missiles.push(makeMissile(100 + i, 1, { pos: vec(CM_INTERCEPT_RANGE - 1000, 0) }))
      }
      updateDefenses(state, 0.5)
      return state.events.filter(e => e.cause === 'decoy').length
    }
    const SEEDS = 400
    let avalon = 0
    let pirate = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      avalon += run(seed, 'ca-bastion')       // ecm 0.45
      pirate += run(seed + 50_000, 'dd-korzar') // ecm 0.15
    }
    expect(pirate).toBeLessThan(avalon)
    expect(pirate).toBeGreaterThan(0) // i pirátská návnada občas funguje
  })

  it('zásoba se vyčerpá: každá pohlcená raketa = jedna návnada, pak konec', () => {
    const state = makeState(45)
    const ca = makeShip(1, 'ca-bastion', { hull: 1e9, cms: 0, decoys: 2 })
    ca.subsystems.ecm = 0
    state.ships.push(ca)
    let absorbed = 0
    let mid = 100
    for (let step = 0; step < 400 && (ca.decoys > 0 || ca.decoyActive); step++) {
      if (!ca.decoyActive && ca.decoys > 0) deployDecoy(state, ca)
      state.missiles = [makeMissile(mid++, 1, { lock: 0, pos: vec(CM_INTERCEPT_RANGE - 1000, 0), vel: vec(0, 0) })]
      updateDefenses(state, 0.5)
      absorbed += state.events.filter(e => e.cause === 'decoy').length
      state.events.length = 0
    }
    expect(absorbed).toBe(2)      // dvě návnady ≈ dvě pohlcené rakety
    expect(ca.decoys).toBe(0)
    expect(ca.decoyActive).toBe(false)
    deployDecoy(state, ca)
    expect(state.events.some(e => e.text.includes('prázdný'))).toBe(true)
  })

  it('AI nasadí návnadu proti salvě ≥ 6 raket a ZNOVU po její ztrátě', () => {
    const state = makeState(43)
    const hunter = makeShip(1, 'cl-sokol', { side: 'enemy', doctrine: 'hunter' })
    state.ships.push(hunter)
    state.t = 100
    for (let i = 0; i < 6; i++) {
      state.missiles.push(makeMissile(100 + i, 1, {
        side: 'player', pos: vec(2_000_000, 0), launchedAt: 0,
      }))
    }
    const orders = collectAIOrders(state)
    expect(orders.some(o => o.kind === 'deployDecoy')).toBe(true)
    for (const o of orders) sim.applyOrder(state, o)
    expect(hunter.decoyActive).toBe(true)
    // návnada běží → další rozkaz nepadne
    expect(collectAIOrders(state).some(o => o.kind === 'deployDecoy')).toBe(false)
    // ztráta návnady, salva stále letí → AI nasadí další
    hunter.decoyActive = false
    hunter.decoys--
    expect(collectAIOrders(state).some(o => o.kind === 'deployDecoy')).toBe(true)

    // 5 raket nestačí
    const state2 = makeState(44)
    state2.ships.push(makeShip(1, 'cl-sokol', { side: 'enemy', doctrine: 'hunter' }))
    state2.t = 100
    for (let i = 0; i < 5; i++) {
      state2.missiles.push(makeMissile(100 + i, 1, {
        side: 'player', pos: vec(2_000_000, 0), launchedAt: 0,
      }))
    }
    expect(collectAIOrders(state2).some(o => o.kind === 'deployDecoy')).toBe(false)
  })
})

// ---------- eskortní rušička ----------

describe('ECM doprovod salvy (+rušička)', () => {
  it('salva obětuje 1 raketu, ale spotřebuje plnou munici; min. 3 rakety', () => {
    const state = makeState(51)
    const cl = makeShip(1, 'cl-sokol')
    const tgt = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(3_000_000, 0) })
    state.ships.push(cl, tgt)
    const ammo0 = cl.missiles

    launchSalvo(state, cl, 2, 5, 0, { escortJammer: true })
    expect(state.missiles.length).toBe(4)          // 5 − 1 rušička
    expect(cl.missiles).toBe(ammo0 - 5)            // munice za všech 5
    expect(state.missiles.every(m => m.jammerEscort === true)).toBe(true)
    expect(state.events.some(e => e.kind === 'launch' && e.text.includes('rušička'))).toBe(true)

    // min. 3: salva 2 s rušičkou je no-op s hláškou
    cl.tubeCooldown = 0
    const missilesBefore = state.missiles.length
    launchSalvo(state, cl, 2, 2, 0, { escortJammer: true })
    expect(state.missiles.length).toBe(missilesBefore)
    expect(state.events.some(e => e.text.includes('aspoň 3'))).toBe(true)
  })

  it('rušička zvedá průnik PDLC vrstvou (statisticky nad seedy)', () => {
    // izolace PDLC: bez CM, bez ECM eroze — 8 raket vs. 7+rušička
    const run = (seed: number, jammer: boolean): number => {
      const state = makeState(seed)
      const ca = makeShip(1, 'ca-bastion', { hull: 1e9, cms: 0 })
      ca.subsystems.ecm = 0
      state.ships.push(ca)
      const n = jammer ? 7 : 8
      for (let i = 0; i < n; i++) {
        state.missiles.push(makeMissile(100 + i, 1, {
          jammerEscort: jammer || undefined,
        }))
      }
      let hits = 0
      for (let step = 0; step < 600 && state.missiles.length > 0; step++) {
        updateMissiles(state, 0.5)
        updateDefenses(state, 0.5)
        state.t += 0.5
        hits += state.events.filter(e => e.kind === 'missileHit').length
        state.events.length = 0
      }
      return hits
    }
    const SEEDS = 250
    let plain = 0
    let escorted = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      plain += run(seed, false)
      escorted += run(seed + 100_000, true)
    }
    // 7 raket s Pk ×0.75 pronikne víc než 8 bez rušičky
    expect(escorted).toBeGreaterThan(plain)
  })
})

// ---------- dvojitá boční salva ----------

describe('dvojitá boční salva (launchDouble)', () => {
  /** hráčova CL s poškozeným levobokem + bezbranný cíl na dané vzdálenosti */
  const doubleScenario = (targetX: number): Scenario => makeScenario({
    ships: [
      {
        classId: 'cl-sokol', side: 'player', name: 'CL',
        pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 },
        subsystems: { ...fullSubsystems(), tubesPort: 0.5 }, // levobok floor(5·0.5)=2
      },
      {
        classId: 'merch-freighter', side: 'enemy', name: 'M', doctrine: 'freighter',
        pos: { x: targetX, y: 0 }, vel: { x: 0, y: 0 },
        subsystems: fullSubsystems(0), cms: 0, hull: 1e9,
      },
    ],
  })

  it('obě vlny odejdou (počty dle boků), otočka blokuje palbu, společný přílet, cooldown', () => {
    const state = sim.create(doubleScenario(5_000_000))
    const ammo0 = state.ships[0].missiles
    sim.applyOrder(state, { kind: 'launchDouble', shipId: 1, targetId: 2 })

    // fáze A: 2 rakety LO z levoboku, loď v otočce (odvalená), vlna B čeká
    expect(state.missiles.length).toBe(2)
    expect(state.missiles.every(m => m.mode === 0)).toBe(true)
    expect(state.ships[0].rolledTo).not.toBeNull()
    const wave = state.ships[0].pendingWave
    expect(wave).not.toBeNull()
    expect(wave!.count).toBe(5)             // pravobok zdravý: 5 šachet
    expect(wave!.mode).toBe(1)
    expect(wave!.sourceSide).toBe('stbd')
    expect(wave!.unrollAfter).toBe(true)
    expect(wave!.launchAt).toBeGreaterThan(ROLL_TIME) // společný dopad > otočka

    // během otočky nelze pálit (roll blokuje) — no-op s hláškou
    state.ships[0].tubeCooldown = 0
    state.events.length = 0
    sim.applyOrder(state, { kind: 'launchSalvo', shipId: 1, targetId: 2, count: 2, mode: 0 })
    expect(state.missiles.length).toBe(2)
    expect(state.events.some(e => e.text.includes('Jsme odvalení'))).toBe(true)

    // tick do odpalu vlny B: pravobok HI, loď zpět z odvalu, cooldown obou stran
    const arrivals: number[] = []
    let waveLaunched = false
    for (let i = 0; i < 2000 && arrivals.length < 7; i++) {
      sim.tick(state, SIM_DT)
      for (const ev of state.events) {
        if (ev.kind === 'launch') {
          waveLaunched = true
          expect(state.ships[0].rolledTo).toBeNull()               // návrat z odvalu
          expect(state.ships[0].tubeCooldown).toBe(TUBE_COOLDOWN)  // obě strany nabíjejí
        }
        if (ev.kind === 'missileHit' || ev.kind === 'missileMiss') arrivals.push(ev.t)
      }
      state.events.length = 0
    }
    expect(waveLaunched).toBe(true)
    expect(state.ships[0].missiles).toBe(ammo0 - 7) // 2 + 5, munice normálně
    expect(arrivals.length).toBe(7)
    // společný přílet obou vln do ±15 s
    expect(Math.max(...arrivals) - Math.min(...arrivals)).toBeLessThanOrEqual(15)
  })

  it('moc blízko na společný dopad: vlna B hned po otočce + hláška o zpoždění', () => {
    const state = makeState(71)
    const cl = makeShip(1, 'cl-sokol')
    const tgt = makeShip(2, 'merch-freighter', { side: 'enemy', pos: vec(100_000, 0) })
    state.ships.push(cl, tgt)
    state.contacts.player.push({
      shipId: 2, pos: vec(100_000, 0), vel: vec(0, 0), age: 0,
      idQuality: 1, classGuess: 'neznámá', wedgeDetected: true,
    })
    state.t = 10
    launchDouble(state, cl, 2)
    expect(state.ships[0].pendingWave?.launchAt).toBeCloseTo(10 + ROLL_TIME, 5)
    expect(state.events.some(e => e.kind === 'message'
      && e.text.includes('dorazí') && e.text.includes('později'))).toBe(true)
  })

  it('validace: neklasifikovaný cíl, mrtvý bok a málo munice odmítnou s hláškou', () => {
    const state = makeState(72)
    const cl = makeShip(1, 'cl-sokol')
    const tgt = makeShip(2, 'merch-freighter', { side: 'enemy', pos: vec(3_000_000, 0) })
    state.ships.push(cl, tgt)

    // bez klasifikovaného kontaktu
    launchDouble(state, cl, 2)
    expect(state.missiles.length).toBe(0)
    expect(state.events.some(e => e.text.includes('klasifikovaný'))).toBe(true)

    state.contacts.player.push({
      shipId: 2, pos: vec(3_000_000, 0), vel: vec(0, 0), age: 0,
      idQuality: 1, classGuess: 'neznámá', wedgeDetected: true,
    })
    // mrtvý levobok
    cl.subsystems.tubesPort = 0.1 // floor(5·0.1)=0
    state.events.length = 0
    launchDouble(state, cl, 2)
    expect(state.missiles.length).toBe(0)
    expect(state.events.some(e => e.text.includes('KAŽDÉM boku'))).toBe(true)

    // málo munice pro obě salvy
    cl.subsystems.tubesPort = 1
    cl.missiles = 7 // potřeba 5 + 5
    state.events.length = 0
    launchDouble(state, cl, 2)
    expect(state.missiles.length).toBe(0)
    expect(state.events.some(e => e.text.includes('Málo raket'))).toBe(true)
    expect(cl.rolledTo).toBeNull() // odmítnutí nesmí loď nechat v otočce
  })

  it('determinismus: dva běhy dvojité salvy jsou bitově identické', () => {
    const run = (): SimState => {
      const state = sim.create(doubleScenario(5_000_000))
      sim.applyOrder(state, { kind: 'launchDouble', shipId: 1, targetId: 2 })
      for (let i = 0; i < 800; i++) sim.tick(state, SIM_DT)
      return state
    }
    const a = run()
    const b = run()
    expect(a.missiles.length).toBe(0) // salvy dolétly
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})

// ---------- roster flotily (čistá logika) ----------

describe('roster flotily (čistá logika výběru)', () => {
  /** syntetický stav: 2 ovladatelné + 1 AI eskorta + 1 nepřítel */
  function fleetState(): SimState {
    const state = makeState(61)
    state.ships.push(
      makeShip(1, 'ca-bastion', { name: 'ANS Bastion' }),
      makeShip(2, 'dd-vichr', { name: 'ANS Vichr' }),
      makeShip(3, 'dd-vichr', { name: 'ANS Eskorta', doctrine: 'escort' }),
      makeShip(4, 'cl-sokol', { side: 'enemy', doctrine: 'hunter', name: 'Nepřítel' }),
    )
    return state
  }

  it('ovladatelné = side player A doctrine player; AI eskorta ne', () => {
    const state = fleetState()
    expect(controllableShips(state).map(s => s.id)).toEqual([1, 2])
    expect(isControllable(state.ships[2])).toBe(false) // escort
    expect(isControllable(state.ships[3])).toBe(false) // enemy
    expect(rosterVisible(state)).toBe(true)
  })

  it('roster je skrytý s jedinou ovladatelnou lodí (mise 1–8)', () => {
    const state = fleetState()
    state.ships[1].doctrine = 'escort'
    expect(rosterVisible(state)).toBe(false)
  })

  it('rosterPick: klávesy 1–9 vybírají n-tou ovladatelnou loď', () => {
    const state = fleetState()
    expect(rosterPick(state, 1)).toBe(1)
    expect(rosterPick(state, 2)).toBe(2)
    expect(rosterPick(state, 3)).toBeNull() // eskorta se nepočítá
    expect(rosterPick(state, 0)).toBeNull()
  })

  it('resolveOwnShipId: drží ovladatelnou, po zničení přejde na další', () => {
    const state = fleetState()
    expect(resolveOwnShipId(state, 2)).toBe(2)
    state.ships[1].destroyed = true
    expect(resolveOwnShipId(state, 2)).toBe(1)
    // AI eskorta se nikdy nevybere jako ovladatelná
    state.ships[0].destroyed = true
    expect(resolveOwnShipId(state, 2)).toBe(3) // nouzově aspoň živá vlastní (zobrazení)
    // všechno pryč → zůstává poslední výběr (UI ukáže „LOĎ ZNIČENA")
    state.ships[2].destroyed = true
    expect(resolveOwnShipId(state, 2)).toBe(2)
  })
})
