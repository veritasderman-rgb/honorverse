/**
 * Testy balíku „eskadra": stupňovitý výkon pohonu s nouzovým režimem
 * (throttle 0–1.2, riziko poškození impelerů nad 100 %), hromadný výběr
 * (čistá logika v ui/roster) a formace (station-keeping, taktické efekty,
 * rozpad po ztrátě leadera). Determinismus: rng se pro nouzový výkon čerpá
 * JEN u lodí nad 100 % a referenční pásmo obrany (combat.test) drží.
 */
import { describe, expect, it } from 'vitest'
import type { MissileState, Scenario, ShipState, SimState, Subsystems } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import {
  DISPERSED_ECM_BONUS, EMERGENCY_THROTTLE_MAX, FORMATION_SPACING, G,
  SIM_DT, VEE_SOLUTION_BONUS,
} from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'
import { updateShipPhysics } from '../src/sim/physics'
import { updateDefenses, resolveTerminal } from '../src/sim/defense'
import { fireSolution } from '../src/sim/weapons'
import {
  formationOffset, formationSlotPos, updateFormations, wallDiscipline,
} from '../src/sim/formation'
import { boxSelectShips, normalizeSelection, toggleShipSelection } from '../src/ui/roster'

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
    wedgeOn: true, activeSensors: false, rolledTo: null,
    subsystems: fullSubsystems(),
    hull: def.hullPoints, missiles: def.magazineMissiles, cms: def.magazineCMs,
    decoys: def.decoyCount, decoyActive: false,
    tubeCooldown: 0, energyCooldown: 0, destroyed: false, doctrine: 'player',
    surrendered: false, lastSurrenderDemandAt: -1e9,
    fireControl: { mode: 'hold', targetId: null, salvoSize: def.tubesPerBroadside, driveMode: 0, engaged: false },
    pendingWave: null,
    buffs: { lockBonus: 0, lockUntil: 0, repairBonus: 1, repairUntil: 0 },
    terminalTimes: [],
    formation: null,
    ...over,
  }
}

function makeMissile(id: number, targetId: number, over: Partial<MissileState> = {}): MissileState {
  return {
    id, side: 'enemy', def: 'std-shipkiller',
    pos: vec(2_000_000, 0), vel: vec(0, 0),
    targetId, mode: 1, driveRemaining: 60, phase: 'boost', lock: 1.0, salvoId: 1,
    ...over,
  }
}

function makeScenario(partial: Partial<Scenario>): Scenario {
  return { id: 'test', title: 'Test', briefing: '', seed: 1, ships: [], objectives: [], triggers: [], ...partial }
}

// ---------- stupňovitý výkon pohonu ----------

describe('výkon pohonu 20–120 %', () => {
  it('throttle 1.2 dává PŘESNĚ 1.5× vyšší akceleraci než 0.8', () => {
    const run = (throttle: number): number => {
      const ship = makeShip(1, 'dd-vichr', {
        throttle, nav: { kind: 'course', dest: vec(1e9, 0), arriveAtRest: false },
      })
      const state = makeState(1)
      state.ships.push(ship)
      updateShipPhysics(state, ship, SIM_DT)
      return ship.vel.x
    }
    const v08 = run(0.8)
    const v12 = run(1.2)
    expect(v12 / v08).toBeCloseTo(1.5, 9)
    // absolutně: a = maxAccelG·G·1.2 (plné impelery)
    expect(v12).toBeCloseTo(SHIP_CLASSES['dd-vichr'].maxAccelG * G * 1.2 * SIM_DT, 9)
  })

  it('setThrottle clamp 0–1.2 + jednorázové varování inženýra při prvním >100 %', () => {
    const state = sim.create(makeScenario({
      ships: [{ classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } }],
    }))
    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 99 })
    expect(state.ships[0].throttle).toBe(EMERGENCY_THROTTLE_MAX)
    const warn = state.events.filter(e => e.kind === 'comm' && e.speaker === 'engineer'
      && e.text.includes('červenou'))
    expect(warn.length).toBe(1)
    // opakované přepnutí nad 100 % už znovu nevaruje (jednou za misi)
    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 0.8 })
    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1.2 })
    expect(state.events.filter(e => e.kind === 'comm' && e.speaker === 'engineer').length).toBe(1)
  })

  /** izolovaná loď hráče (žádný boj — crew eventy rng nečerpají) */
  const soloScenario = (seed: number): Scenario => makeScenario({
    seed,
    ships: [{ classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } }],
  })

  it('nouzový výkon statisticky poškozuje impelerové prstence (nad seedy)', () => {
    let damagedRuns = 0
    let engineerMsgs = 0
    for (let seed = 1; seed <= 30; seed++) {
      const state = sim.create(soloScenario(seed))
      sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1.2 })
      state.events.length = 0
      for (let i = 0; i < 4000; i++) { // 2000 s: E[selhání] = 1 na loď
        sim.tick(state, SIM_DT)
        engineerMsgs += state.events.filter(e => e.kind === 'comm'
          && e.speaker === 'engineer').length
        state.events.length = 0
      }
      const subs = state.ships[0].subsystems
      const dmg = 2 - subs.impellerFwd - subs.impellerAft
      if (dmg > 0) {
        damagedRuns++
        // jednotlivá ztráta je 0.08–0.15 — celková škoda tomu odpovídá
        expect(dmg).toBeGreaterThanOrEqual(0.08)
      }
      expect(subs.impellerFwd).toBeLessThanOrEqual(1)
      expect(subs.impellerAft).toBeLessThanOrEqual(1)
    }
    expect(damagedRuns).toBeGreaterThan(5)   // ~63 % běhů má aspoň jedno selhání
    expect(damagedRuns).toBeLessThan(30)     // ale ne deterministicky všechny
    expect(engineerMsgs).toBeGreaterThan(0)  // hláška inženýra doprovází poškození
  })

  it('při throttle ≤ 1.0 se impelery NIKDY nepoškodí a rng se nečerpá', () => {
    for (const throttle of [0.8, 1.0]) {
      const state = sim.create(soloScenario(7))
      sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle })
      const rng0 = state.rng.s
      for (let i = 0; i < 4000; i++) sim.tick(state, SIM_DT)
      expect(state.ships[0].subsystems.impellerFwd).toBe(1)
      expect(state.ships[0].subsystems.impellerAft).toBe(1)
      expect(state.rng.s).toBe(rng0) // tok rng nezměněn (determinismus ostatních)
    }
  })

  it('bez klínu nouzový výkon impelery neriskuje (prstence nejedou naplno)', () => {
    const state = sim.create(soloScenario(9))
    sim.applyOrder(state, { kind: 'setWedge', shipId: 1, on: false })
    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1.2 })
    const rng0 = state.rng.s
    for (let i = 0; i < 2000; i++) sim.tick(state, SIM_DT)
    expect(state.ships[0].subsystems.impellerFwd).toBe(1)
    expect(state.rng.s).toBe(rng0)
  })

  it('determinismus: dva běhy s lodí na 120 % jsou bitově identické (JSON)', () => {
    const run = (): SimState => {
      const state = sim.create(makeScenario({
        seed: 42,
        ships: [
          { classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
          { classId: 'dd-vichr', side: 'player', name: 'DD', pos: { x: 0, y: 500_000 }, vel: { x: 0, y: 0 } },
          {
            classId: 'cl-korzar', side: 'enemy', name: 'E', doctrine: 'hunter',
            pos: { x: 6_000_000, y: 0 }, vel: { x: 0, y: 0 },
          },
        ],
      }))
      sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1.2 })
      sim.applyOrder(state, {
        kind: 'setFormation', shipId: 2, leaderId: 1, slot: 1, formation: 'wall',
      })
      sim.applyOrder(state, { kind: 'intercept', shipId: 1, targetId: 3 })
      for (let i = 0; i < 2400; i++) {
        sim.tick(state, SIM_DT)
        state.events.length = 0
      }
      return state
    }
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })
})

// ---------- formace: geometrie a station-keeping ----------

describe('formace — geometrie slotů', () => {
  it('wall: kolmá řada s rozestupem FORMATION_SPACING, střídavě po stranách', () => {
    expect(formationOffset('wall', 1)).toEqual({ x: 0, y: FORMATION_SPACING })
    expect(formationOffset('wall', 2)).toEqual({ x: 0, y: -FORMATION_SPACING })
    expect(formationOffset('wall', 3)).toEqual({ x: 0, y: 2 * FORMATION_SPACING })
  })

  it('vee: sloty ZA leaderem; dispersed: mřížka za leaderem', () => {
    for (const kind of ['vee', 'dispersed'] as const) {
      for (let slot = 1; slot <= 5; slot++) {
        expect(formationOffset(kind, slot).x).toBeLessThan(0)
      }
    }
  })

  it('formationSlotPos rotuje offset do headingu leadera', () => {
    const leader = makeShip(1, 'ca-bastion', { heading: Math.PI / 2 })
    // wall slot 1: lokálně +y (levobok) → při headingu +90° světově −x
    const p = formationSlotPos(leader, 'wall', 1)
    expect(p.x).toBeCloseTo(-FORMATION_SPACING, 6)
    expect(p.y).toBeCloseTo(0, 6)
  })
})

describe('formace — station-keeping a rozpad', () => {
  const squadronScenario = (): Scenario => makeScenario({
    seed: 5,
    ships: [
      { classId: 'ca-bastion', side: 'player', name: 'Vlajková', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
      { classId: 'dd-vichr', side: 'player', name: 'Křídlo 1', pos: { x: -1_500_000, y: 900_000 }, vel: { x: 0, y: 0 } },
      { classId: 'dd-vichr', side: 'player', name: 'Křídlo 2', pos: { x: -1_500_000, y: -900_000 }, vel: { x: 0, y: 0 } },
    ],
  })

  it('členové dojedou do slotů a drží je (statický leader)', () => {
    const state = sim.create(squadronScenario())
    sim.applyOrder(state, { kind: 'setFormation', shipId: 2, leaderId: 1, slot: 1, formation: 'wall' })
    sim.applyOrder(state, { kind: 'setFormation', shipId: 3, leaderId: 1, slot: 2, formation: 'wall' })
    for (let i = 0; i < 6000; i++) sim.tick(state, SIM_DT) // 50 min
    const leader = state.ships[0]
    for (const [idx, slot] of [[1, 1], [2, 2]] as const) {
      const ship = state.ships[idx]
      const p = formationSlotPos(leader, 'wall', slot)
      const d = Math.hypot(ship.pos.x - p.x, ship.pos.y - p.y)
      expect(d).toBeLessThan(FORMATION_SPACING / 8) // konvergence do slotu
      const dv = Math.hypot(ship.vel.x - leader.vel.x, ship.vel.y - leader.vel.y)
      expect(dv).toBeLessThan(20) // a drží leaderovu rychlost
    }
  })

  it('člen formace ignoruje vlastní nav — drží slot i s rozkazem kurzu jinam', () => {
    const state = sim.create(squadronScenario())
    sim.applyOrder(state, { kind: 'setFormation', shipId: 2, leaderId: 1, slot: 1, formation: 'wall' })
    sim.applyOrder(state, { kind: 'setCourse', shipId: 2, dest: { x: 1e9, y: 0 }, arriveAtRest: false })
    for (let i = 0; i < 6000; i++) sim.tick(state, SIM_DT)
    const p = formationSlotPos(state.ships[0], 'wall', 1)
    const d = Math.hypot(state.ships[1].pos.x - p.x, state.ships[1].pos.y - p.y)
    expect(d).toBeLessThan(FORMATION_SPACING / 8)
  })

  it('formace drží slot i za letícím leaderem (kurz + akcelerace)', () => {
    const state = sim.create(squadronScenario())
    sim.applyOrder(state, { kind: 'setFormation', shipId: 2, leaderId: 1, slot: 1, formation: 'wall' })
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 500_000_000, y: 0 }, arriveAtRest: false })
    for (let i = 0; i < 8000; i++) sim.tick(state, SIM_DT) // ~67 min letu
    const leader = state.ships[0]
    expect(Math.hypot(leader.vel.x, leader.vel.y)).toBeGreaterThan(1000) // leader letí
    const p = formationSlotPos(leader, 'wall', 1)
    const d = Math.hypot(state.ships[1].pos.x - p.x, state.ships[1].pos.y - p.y)
    expect(d).toBeLessThan(FORMATION_SPACING) // drží se u slotu i za letu
  })

  it('rozpad: zničený leader → formation null + hláška XO', () => {
    const state = sim.create(squadronScenario())
    sim.applyOrder(state, { kind: 'setFormation', shipId: 2, leaderId: 1, slot: 1, formation: 'wall' })
    sim.applyOrder(state, { kind: 'setFormation', shipId: 3, leaderId: 1, slot: 2, formation: 'wall' })
    sim.tick(state, SIM_DT)
    state.events.length = 0
    state.ships[0].destroyed = true
    sim.tick(state, SIM_DT)
    expect(state.ships[1].formation).toBeNull()
    expect(state.ships[2].formation).toBeNull()
    const msgs = state.events.filter(e => e.speaker === 'xo' && e.text.includes('rozpuštěna'))
    expect(msgs.length).toBe(2)
  })

  it('setFormation validace: AI loď ani AI leader ve formaci být nemohou', () => {
    const state = makeState(11)
    state.ships.push(
      makeShip(1, 'ca-bastion'),
      makeShip(2, 'dd-vichr', { doctrine: 'escort' }),          // AI spojenec
      makeShip(3, 'cl-korzar', { side: 'enemy', doctrine: 'hunter' }),
    )
    // AI spojenec se formace neúčastní
    sim.applyOrder(state, { kind: 'setFormation', shipId: 2, leaderId: 1, slot: 1, formation: 'wall' })
    expect(state.ships[1].formation ?? null).toBeNull()
    // nepřítel taky ne
    sim.applyOrder(state, { kind: 'setFormation', shipId: 3, leaderId: 1, slot: 1, formation: 'wall' })
    expect(state.ships[2].formation ?? null).toBeNull()
    // ovladatelná loď s AI leaderem taky ne
    sim.applyOrder(state, { kind: 'setFormation', shipId: 1, leaderId: 2, slot: 1, formation: 'wall' })
    expect(state.ships[0].formation ?? null).toBeNull()
    // sám sobě leaderem být nemůže
    sim.applyOrder(state, { kind: 'setFormation', shipId: 1, leaderId: 1, slot: 1, formation: 'wall' })
    expect(state.ships[0].formation ?? null).toBeNull()
  })
})

// ---------- formace: taktické efekty ----------

describe('formace — taktické efekty', () => {
  /** stěna: leader + člen ve slotu (rozestup FORMATION_SPACING) */
  function wallPair(state: SimState, wall: boolean): [ShipState, ShipState] {
    const leader = makeShip(1, 'ca-bastion', { cms: 0 })
    const member = makeShip(2, 'ca-bastion', {
      pos: vec(0, FORMATION_SPACING),
      formation: wall ? { leaderId: 1, slot: 1, kind: 'wall' } : null,
    })
    state.ships.push(leader, member)
    return [leader, member]
  }

  it('wallDiscipline: platí pro člena I leadera; daleko od sebe ne', () => {
    const state = makeState(21)
    const [leader, member] = wallPair(state, true)
    expect(wallDiscipline(state, member)).toBe(true)
    expect(wallDiscipline(state, leader)).toBe(true)
    member.pos = vec(0, FORMATION_SPACING * 2) // > 1.5×rozestup
    expect(wallDiscipline(state, member)).toBe(false)
    member.formation = null
    expect(wallDiscipline(state, leader)).toBe(false)
  })

  it('wall bonus CM Pk se statisticky projeví (víc sestřelů než bez formace)', () => {
    const run = (seed: number, wall: boolean): number => {
      const state = makeState(seed)
      const [, member] = wallPair(state, wall)
      member.cms = 25
      for (let i = 0; i < 30; i++) {
        state.missiles.push(makeMissile(100 + i, 2, { pos: vec(2_000_000, FORMATION_SPACING) }))
      }
      let kills = 0
      // dokud členovi nedojdou CM (leader má cms 0 — bonusový vliv je izolovaný)
      for (let step = 0; step < 400 && member.cms > 0 && state.missiles.length > 0; step++) {
        updateDefenses(state, SIM_DT)
        kills += state.events.filter(e => e.cause === 'cm').length
        state.events.length = 0
      }
      return kills
    }
    const SEEDS = 300
    let plain = 0
    let walled = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      plain += run(seed, false)
      walled += run(seed + 100_000, true)
    }
    expect(walled).toBeGreaterThan(plain) // Pk ×1.15
  })

  it('wall: příchozí raketa ztrácí při terminále 0.05 zámku (slabý zámek → nula)', () => {
    // pdlc 0 (žádné clustery), lock 0.05: se stěnou jde zámek na 0 → NIKDY zásah;
    // bez stěny občas zásah padne (nad seedy)
    const run = (seed: number, wall: boolean): number => {
      const state = makeState(seed)
      const [, member] = wallPair(state, wall)
      member.subsystems.pdlc = 0
      const m = makeMissile(100, 2, { lock: 0.05, pos: vec(30_000, FORMATION_SPACING) })
      state.missiles.push(m)
      resolveTerminal(state, m, member)
      return state.events.filter(e => e.kind === 'missileHit').length
    }
    let plainHits = 0
    let wallHits = 0
    for (let seed = 1; seed <= 80; seed++) {
      plainHits += run(seed, false)
      wallHits += run(seed + 100_000, true)
    }
    expect(wallHits).toBe(0)
    expect(plainHits).toBeGreaterThan(0)
  })

  it('dispersed: člen má +0.03 efektivního ECM (rychlejší eroze zámku)', () => {
    const run = (dispersed: boolean): number => {
      const state = makeState(31)
      const leader = makeShip(1, 'ca-bastion', { cms: 0, pos: vec(0, 30_000_000) })
      const member = makeShip(2, 'ca-bastion', {
        cms: 0,
        formation: dispersed ? { leaderId: 1, slot: 1, kind: 'dispersed' } : null,
      })
      state.ships.push(leader, member)
      state.missiles.push(makeMissile(100, 2, { pos: vec(2_000_000, 0) }))
      updateDefenses(state, 1)
      return state.missiles[0].lock
    }
    const plain = run(false)
    const disp = run(true)
    expect(disp).toBeLessThan(plain)
    expect(plain - disp).toBeCloseTo(DISPERSED_ECM_BONUS * 0.01, 6)
  })

  it('vee: člen má +0.05 palebného řešení (sdílený senzorový obraz)', () => {
    const state = makeState(41)
    const leader = makeShip(1, 'ca-bastion')
    const member = makeShip(2, 'cl-sokol', { pos: vec(-600_000, 300_000) })
    const target = makeShip(3, 'cl-korzar', { side: 'enemy', pos: vec(20_000_000, 0) })
    state.ships.push(leader, member, target)
    const before = fireSolution(state, member, target)
    member.formation = { leaderId: 1, slot: 1, kind: 'vee' }
    const after = fireSolution(state, member, target)
    expect(after - before).toBeCloseTo(VEE_SOLUTION_BONUS, 6)
    // mrtvý leader → bonus pryč
    leader.destroyed = true
    expect(fireSolution(state, member, target)).toBeCloseTo(before, 6)
  })

  it('referenční pásmo obrany (4–15 %) nesmí formace bez formace ovlivnit', () => {
    // pojistka: loď BEZ formace nemá žádný z bonusů
    const state = makeState(51)
    const ca = makeShip(1, 'ca-bastion')
    state.ships.push(ca)
    expect(wallDiscipline(state, ca)).toBe(false)
  })

  it('updateFormations: kapitulovaný člen z formace vypadne', () => {
    const state = makeState(61)
    state.ships.push(
      makeShip(1, 'ca-bastion'),
      makeShip(2, 'dd-vichr', {
        surrendered: true, formation: { leaderId: 1, slot: 1, kind: 'wall' },
      }),
    )
    updateFormations(state)
    expect(state.ships[1].formation).toBeNull()
  })
})

// ---------- hromadný výběr (čistá UI logika) ----------

describe('hromadný výběr — selekční helpery', () => {
  function fleetState(): SimState {
    const state = makeState(71)
    state.ships.push(
      makeShip(1, 'ca-bastion', { pos: vec(0, 0) }),
      makeShip(2, 'dd-vichr', { pos: vec(100_000, 50_000) }),
      makeShip(3, 'dd-vichr', { pos: vec(-200_000, 0) }),
      makeShip(4, 'dd-vichr', { pos: vec(50_000, 0), doctrine: 'escort' }),   // AI spojenec
      makeShip(5, 'cl-korzar', { pos: vec(0, 100_000), side: 'enemy', doctrine: 'hunter' }),
    )
    return state
  }

  it('toggle: přidá a odebere ovladatelnou loď; primární odebrat nejde', () => {
    const state = fleetState()
    let sel = [1]
    sel = toggleShipSelection(state, sel, 1, 2)
    expect(sel).toEqual([1, 2])
    sel = toggleShipSelection(state, sel, 1, 2)
    expect(sel).toEqual([1])
    sel = toggleShipSelection(state, sel, 1, 1) // primární je nedotknutelná
    expect(sel).toEqual([1])
  })

  it('toggle: AI spojenec a nepřítel do výběru nejdou', () => {
    const state = fleetState()
    expect(toggleShipSelection(state, [1], 1, 4)).toEqual([1])
    expect(toggleShipSelection(state, [1], 1, 5)).toEqual([1])
    state.ships[1].destroyed = true
    expect(toggleShipSelection(state, [1], 1, 2)).toEqual([1]) // zničená taky ne
  })

  it('box select: jen ovladatelné lodě uvnitř rectu (rohy v libovolném pořadí)', () => {
    const state = fleetState()
    const ids = boxSelectShips(state, vec(150_000, 80_000), vec(-50_000, -20_000))
    expect(ids).toEqual([1, 2]) // loď 3 mimo rect, 4 je AI, 5 nepřítel
    expect(boxSelectShips(state, vec(1e9, 1e9), vec(2e9, 2e9))).toEqual([])
  })

  it('normalizace: vyhodí zaniklé, primární vždy první', () => {
    const state = fleetState()
    expect(normalizeSelection(state, [2, 3], 1)).toEqual([1, 2, 3])
    state.ships[2].destroyed = true
    expect(normalizeSelection(state, [2, 3], 1)).toEqual([1, 2])
    expect(normalizeSelection(state, [3, 1], 2)).toEqual([2, 1]) // 3 zničena, 1 žije
    expect(normalizeSelection(state, [3], 2)).toEqual([2])
  })
})
