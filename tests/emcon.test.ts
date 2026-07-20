/**
 * Testy balíku „aktivní hratelnost": senzorový duel (fireSolution, EMCON),
 * AI zapínání aktivních senzorů, řízení letících salv (retarget, autonomní
 * salvy) a end-to-end dopad vyzařování cíle na průnik salvy.
 */
import { describe, expect, it } from 'vitest'
import type { Contact, Scenario, ShipState, SimState, Subsystems } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import {
  AUTONOMOUS_LOCK_FACTOR, RETARGET_LOCK_PENALTY, SIM_DT,
} from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'
import { fireSolution, launchSalvo, updateMissiles } from '../src/sim/weapons'
import { updateDefenses } from '../src/sim/defense'

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
    hull: def.hullPoints, missiles: def.magazineMissiles, pods: 0, cms: def.magazineCMs,
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

function makeContact(shipId: number, idQuality: 0 | 1 | 2, classGuess = 'neznámá'): Contact {
  return {
    shipId, pos: vec(0, 0), vel: vec(0, 0), age: 0,
    idQuality, classGuess, wedgeDetected: true,
  }
}

function makeScenario(partial: Partial<Scenario>): Scenario {
  return { id: 'test', title: 'Test', briefing: '', seed: 1, ships: [], objectives: [], triggers: [], ...partial }
}

// ---------- fireSolution ----------

describe('fireSolution — kvalita palebného řešení', () => {
  it('jen pasivní data → 0.7', () => {
    const state = makeState(1)
    const shooter = makeShip(1, 'ca-bastion')
    const target = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(2_000_000, 0) })
    state.ships.push(shooter, target)
    expect(fireSolution(state, shooter, target)).toBeCloseTo(0.7, 5)
  })

  it('aktivní senzory + cíl v dosahu → 1.0; mimo dosah zpět na 0.7', () => {
    const state = makeState(2)
    const shooter = makeShip(1, 'ca-bastion', { activeSensors: true }) // dosah 8 M km
    const target = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(2_000_000, 0) })
    state.ships.push(shooter, target)
    expect(fireSolution(state, shooter, target)).toBeCloseTo(1.0, 5)

    target.pos = vec(20_000_000, 0) // za dosahem aktivních senzorů
    expect(fireSolution(state, shooter, target)).toBeCloseTo(0.7, 5)
  })

  it('vyzařující cíl dává +0.15 — bez ohledu na dosah střelcových senzorů', () => {
    const state = makeState(3)
    const shooter = makeShip(1, 'ca-bastion')
    const target = makeShip(2, 'ca-bastion', {
      side: 'enemy', pos: vec(20_000_000, 0), activeSensors: true,
    })
    state.ships.push(shooter, target)
    expect(fireSolution(state, shooter, target)).toBeCloseTo(0.85, 5)
  })

  it('kvalitní track (kontakt idQuality 2) dává +0.1', () => {
    const state = makeState(4)
    const shooter = makeShip(1, 'ca-bastion')
    const target = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(20_000_000, 0) })
    state.ships.push(shooter, target)
    state.contacts.player.push(makeContact(2, 2, 'ca-bastion'))
    expect(fireSolution(state, shooter, target)).toBeCloseTo(0.8, 5)
  })

  it('cap 1.0: aktivní + vyzařující cíl + track nepřeteče', () => {
    const state = makeState(5)
    const shooter = makeShip(1, 'ca-bastion', { activeSensors: true })
    const target = makeShip(2, 'ca-bastion', {
      side: 'enemy', pos: vec(2_000_000, 0), activeSensors: true,
    })
    state.ships.push(shooter, target)
    state.contacts.player.push(makeContact(2, 2, 'ca-bastion'))
    expect(fireSolution(state, shooter, target)).toBe(1.0)
  })

  it('poškozené senzory střelce řešení škálují ×0.7–1.0', () => {
    const state = makeState(6)
    const shooter = makeShip(1, 'ca-bastion')
    shooter.subsystems.sensors = 0
    const target = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(2_000_000, 0) })
    state.ships.push(shooter, target)
    expect(fireSolution(state, shooter, target)).toBeCloseTo(0.7 * 0.7, 5)
  })

  it('launchSalvo používá fireSolution × missileQuality jako počáteční zámek + lockBonus buff', () => {
    const state = makeState(7)
    const shooter = makeShip(1, 'ca-bastion', {
      buffs: { lockBonus: 0.2, lockUntil: 100, repairBonus: 1, repairUntil: 0 },
    })
    const target = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(20_000_000, 0) })
    state.ships.push(shooter, target)
    launchSalvo(state, shooter, 2, 2, 0)
    expect(state.missiles.length).toBe(2)
    for (const m of state.missiles) {
      // avalonský CA: řešení 0.7 × kvalita raket 1.08 + buff 0.2
      expect(m.lock).toBeCloseTo(0.7 * 1.08 + 0.2, 5)
      expect(m.shooterId).toBe(1)
      expect(m.autonomous).toBe(false)
    }
  })

  it('autonomní salva startuje se zámkem ×0.85', () => {
    const state = makeState(8)
    const shooter = makeShip(1, 'ca-bastion')
    const target = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(20_000_000, 0) })
    state.ships.push(shooter, target)
    launchSalvo(state, shooter, 2, 2, 0, { autonomous: true })
    for (const m of state.missiles) {
      // kvalita raket třídy (1.08) násobí zámek i u autonomní salvy
      expect(m.lock).toBeCloseTo(0.7 * 1.08 * AUTONOMOUS_LOCK_FACTOR, 5)
      expect(m.autonomous).toBe(true)
    }
  })
})

// ---------- AI: aktivní senzory ----------

describe('AI — senzorový duel (doktríny)', () => {
  it('hunter si při zahájení palby (< 8 M km) zapne aktivní senzory', () => {
    const scenario = makeScenario({
      ships: [
        { classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        {
          classId: 'dd-vichr', side: 'enemy', name: 'DD',
          pos: { x: 5_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'hunter',
        },
      ],
    })
    const state = sim.create(scenario)
    expect(state.ships[1].activeSensors).toBe(false)
    sim.tick(state, SIM_DT)
    expect(state.ships[1].activeSensors).toBe(true)
  })

  it('hunter daleko od cíle (> 8 M km) aktivy nezapíná', () => {
    const scenario = makeScenario({
      ships: [
        { classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        {
          classId: 'dd-vichr', side: 'enemy', name: 'DD',
          pos: { x: 30_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'hunter',
        },
      ],
    })
    const state = sim.create(scenario)
    sim.tick(state, SIM_DT)
    expect(state.ships[1].activeSensors).toBe(false)
  })

  it('pirát na ústupu (hull < 50 %) aktivní senzory vypne', () => {
    const scenario = makeScenario({
      ships: [
        { classId: 'cl-sokol', side: 'player', name: 'CL', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        {
          classId: 'dd-vichr', side: 'enemy', name: 'DD',
          pos: { x: 5_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'pirate',
          activeSensors: true, hull: 20, // < 50 % ze 120
        },
      ],
    })
    const state = sim.create(scenario)
    sim.tick(state, SIM_DT)
    expect(state.ships[1].activeSensors).toBe(false)
  })
})

// ---------- retarget letící salvy ----------

describe('retargetSalvo — řízení letících salv', () => {
  /** stát: střelec (player) + cíle A (id 2) a B (id 3), B klasifikovaný kontakt */
  function retargetState(): { state: SimState; salvoId: number } {
    const state = makeState(11)
    const shooter = makeShip(1, 'cl-sokol')
    const a = makeShip(2, 'dd-vichr', { side: 'enemy', pos: vec(5_000_000, 0) })
    const b = makeShip(3, 'dd-vichr', { side: 'enemy', pos: vec(5_000_000, 2_000_000) })
    state.ships.push(shooter, a, b)
    state.contacts.player.push(makeContact(3, 1, 'dd-vichr'))
    launchSalvo(state, shooter, 2, 3, 1)
    return { state, salvoId: state.missiles[0].salvoId }
  }

  it('přesměruje boost/ballistic rakety na nový cíl s penalizací zámku ×0.75', () => {
    const { state, salvoId } = retargetState()
    const lock0 = state.missiles[0].lock
    sim.applyOrder(state, { kind: 'retargetSalvo', shipId: 1, salvoId, newTargetId: 3 })
    for (const m of state.missiles) {
      expect(m.targetId).toBe(3)
      expect(m.lock).toBeCloseTo(lock0 * RETARGET_LOCK_PENALTY, 5)
    }
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('přesměrována'))).toBe(true)
  })

  it('terminal rakety se nepřesměrují', () => {
    const { state, salvoId } = retargetState()
    state.missiles[0].phase = 'terminal'
    sim.applyOrder(state, { kind: 'retargetSalvo', shipId: 1, salvoId, newTargetId: 3 })
    expect(state.missiles[0].targetId).toBe(2) // terminal zůstává
    expect(state.missiles[1].targetId).toBe(3)
    expect(state.missiles[2].targetId).toBe(3)
  })

  it('salva mimo dosah řízení (≥ 10 M km) se nepřesměruje a hlásí důvod', () => {
    const { state, salvoId } = retargetState()
    for (const m of state.missiles) m.pos = vec(12_000_000, 0)
    sim.applyOrder(state, { kind: 'retargetSalvo', shipId: 1, salvoId, newTargetId: 3 })
    for (const m of state.missiles) expect(m.targetId).toBe(2)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('mimo dosah řízení'))).toBe(true)
  })

  it('nový cíl musí být klasifikovaný kontakt a nesmí být kapitulovaný', () => {
    const { state, salvoId } = retargetState()
    // cíl A (id 2) není v kontaktech → zamítnuto
    sim.applyOrder(state, { kind: 'retargetSalvo', shipId: 1, salvoId, newTargetId: 2 })
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('klasifikovaný'))).toBe(true)
    // kapitulovaný cíl → zamítnuto
    state.ships[2].surrendered = true
    sim.applyOrder(state, { kind: 'retargetSalvo', shipId: 1, salvoId, newTargetId: 3 })
    for (const m of state.missiles) expect(m.targetId).toBe(2)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('kapituloval'))).toBe(true)
  })
})

// ---------- autonomní salvy a řídicí spoj ----------

describe('řídicí spoj — řízené vs. autonomní salvy', () => {
  /** střelec + vzdálený cíl; kontaktní picture řídí parametr */
  function linkState(seed: number, contact: boolean): SimState {
    const state = makeState(seed)
    const shooter = makeShip(1, 'cl-sokol')
    const target = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(40_000_000, 0) })
    state.ships.push(shooter, target)
    if (contact) state.contacts.player.push(makeContact(2, 1, 'ca-bastion'))
    return state
  }

  it('řízená salva bez senzorového kontaktu střelce eroduje zámek', () => {
    const state = linkState(21, false)
    launchSalvo(state, state.ships[0], 2, 2, 1)
    const lock0 = state.missiles[0].lock
    for (let i = 0; i < 20; i++) updateMissiles(state, 0.5) // 10 s letu (boost)
    expect(state.missiles[0].lock).toBeCloseTo(lock0 - 0.01 * 10, 4)
  })

  it('řízená salva S kontaktem neeroduje (spoj drží)', () => {
    const state = linkState(22, true)
    launchSalvo(state, state.ships[0], 2, 2, 1)
    const lock0 = state.missiles[0].lock
    for (let i = 0; i < 20; i++) updateMissiles(state, 0.5)
    expect(state.missiles[0].lock).toBeCloseTo(lock0, 5)
  })

  it('autonomní salva NEeroduje bez kontaktu (fire-and-forget)', () => {
    const state = linkState(23, false)
    launchSalvo(state, state.ships[0], 2, 2, 1, { autonomous: true })
    const lock0 = state.missiles[0].lock
    expect(lock0).toBeCloseTo(0.7 * 1.08 * AUTONOMOUS_LOCK_FACTOR, 5) // × kvalita raket CL
    for (let i = 0; i < 20; i++) updateMissiles(state, 0.5)
    expect(state.missiles[0].lock).toBeCloseTo(lock0, 5)
  })
})

// ---------- EMCON end-to-end (statisticky) ----------

describe('EMCON dopad end-to-end (statistika nad seedy)', () => {
  /**
   * Stejná salva (3×8 raket CA→CA, 3 M km, zděděný vektor 20 000 km/s jako
   * v referenčním testu) proti VYZAŘUJÍCÍMU vs. tichému cíli: vyzařující
   * dává střelci +15 % řešení → statisticky víc průniků a poškození.
   * Kontakt existuje (řídicí spoj drží), obrana cíle zdravá.
   */
  function runEmcon(seed: number, radiating: boolean): { hits: number; damage: number } {
    const state = makeState(seed)
    const shooter = makeShip(1, 'ca-bastion', { vel: vec(20_000, 0) })
    const target = makeShip(2, 'ca-bastion', {
      side: 'enemy', pos: vec(3_000_000, 0), hull: 1e9, activeSensors: radiating,
    })
    state.ships.push(shooter, target)
    state.contacts.player.push(makeContact(2, 1, 'ca-bastion'))
    // 5×8 raket najednou: CM clona za přelet zvládne ~28 interceptů — menší
    // salva by zanikla celá v obou variantách a rozdíl zámku by nebyl měřitelný
    for (let i = 0; i < 5; i++) {
      shooter.tubeCooldown = 0
      shooter.missiles = 999
      launchSalvo(state, shooter, 2, 8, 1)
    }
    state.events.length = 0

    let hits = 0
    for (let step = 0; step < 600 && state.missiles.length > 0; step++) {
      updateMissiles(state, 0.5)
      updateDefenses(state, 0.5)
      state.t += 0.5
      hits += state.events.filter(e => e.kind === 'missileHit').length
      state.events.length = 0
    }
    return { hits, damage: 1e9 - target.hull }
  }

  it('salva proti vyzařujícímu cíli proniká víc než proti tichému', () => {
    const SEEDS = 150
    let hitsRad = 0, hitsQuiet = 0, dmgRad = 0, dmgQuiet = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = runEmcon(seed, true)
      const q = runEmcon(seed, false)
      hitsRad += r.hits; dmgRad += r.damage
      hitsQuiet += q.hits; dmgQuiet += q.damage
    }
    expect(hitsRad).toBeGreaterThan(0) // salvy reálně pronikají
    expect(dmgRad).toBeGreaterThan(dmgQuiet) // vyzařování se cíli nevyplácí
  })
})
