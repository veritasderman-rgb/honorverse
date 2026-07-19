/**
 * Testy bojového modelu: rng, salvy, vrstvená obrana (statisticky),
 * bočníky a subsystémové umírání. Spouštět: npx vitest run tests/combat.test.ts
 */
import { describe, expect, it } from 'vitest'
import type { MissileState, ShipState, SimState, Subsystems } from '../src/sim/types'
import { TUBE_COOLDOWN } from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'
import { rand } from '../src/sim/rng'
import { fireEnergy, launchSalvo, updateMissiles } from '../src/sim/weapons'
import { attackAspect, updateDefenses } from '../src/sim/defense'
import { applyBeamDamage, effectiveTubes, sidewallPowerFactor } from '../src/sim/damage'

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
    t: 0,
    rng: { s: seed >>> 0 },
    nextId: 1000,
    ships: [],
    missiles: [],
    contacts: { player: [], enemy: [], neutral: [] },
    events: [],
    pendingComms: [],
    flags: {},
    objectives: [],
    outcome: 'running',
    scenarioId: 'test',
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

/**
 * Jeden běh pipeline: 50 raket (HI, start 3 mil. km, zděděný vektor 40 000 km/s)
 * proti CA. Cíl má obří hull, aby přežil a šel měřit čistý průnik obrany.
 * Vrací počet raket, které detonovaly se zásahem ('missileHit').
 */
function runSalvoVsCA(seed: number, healthyDefense: boolean): { hits: number; rngS: number } {
  const state = makeState(seed)
  const ca = makeShip(1, 'ca-bastion', { hull: 1e9 })
  if (!healthyDefense) {
    ca.subsystems = fullSubsystems(0) // vyřazená obrana
    ca.cms = 0
  }
  state.ships.push(ca)
  for (let i = 0; i < 50; i++) state.missiles.push(makeMissile(100 + i, 1))

  let hits = 0
  for (let step = 0; step < 600 && state.missiles.length > 0; step++) {
    updateMissiles(state, 0.5)
    updateDefenses(state, 0.5)
    hits += state.events.filter(e => e.kind === 'missileHit').length
    state.events.length = 0
  }
  return { hits, rngS: state.rng.s }
}

// ---------- rng ----------

describe('rng (mulberry32)', () => {
  it('stejný seed dává stejnou sekvenci, jiný seed jinou', () => {
    const a = { s: 12345 }, b = { s: 12345 }, c = { s: 54321 }
    const seqA = Array.from({ length: 20 }, () => rand(a))
    const seqB = Array.from({ length: 20 }, () => rand(b))
    const seqC = Array.from({ length: 20 }, () => rand(c))
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
    for (const x of seqA) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1) }
  })
})

// ---------- salva ----------

describe('launchSalvo', () => {
  it('respektuje šachty, munici a cooldown', () => {
    const state = makeState(1)
    const dd = makeShip(1, 'dd-vichr', { missiles: 5 }) // 3 šachty na bok
    const target = makeShip(2, 'ca-bastion', { side: 'enemy', pos: vec(2_000_000, 0) })
    state.ships.push(dd, target)

    launchSalvo(state, dd, 2, 10, 1) // chce 10, šachty dovolí 3
    expect(state.missiles.length).toBe(3)
    expect(dd.missiles).toBe(2)
    expect(dd.tubeCooldown).toBe(TUBE_COOLDOWN)
    // odpaly salv už čas nezpomalují (auto-zpomalování řeší UI filtr)
    expect(state.events.some(e => e.kind === 'launch')).toBe(true)
    expect(state.events.some(e => e.kind === 'launch' && e.slowdown)).toBe(false)

    launchSalvo(state, dd, 2, 3, 1) // cooldown běží → nic
    expect(state.missiles.length).toBe(3)

    dd.tubeCooldown = 0
    launchSalvo(state, dd, 2, 10, 1) // munice dovolí už jen 2
    expect(state.missiles.length).toBe(5)
    expect(dd.missiles).toBe(0)

    dd.tubeCooldown = 0
    launchSalvo(state, dd, 2, 3, 1) // bez munice → nic
    expect(state.missiles.length).toBe(5)
  })

  it('rakety dědí vektor lodi a sdílejí salvoId', () => {
    const state = makeState(2)
    const dd = makeShip(1, 'dd-vichr', { pos: vec(100, 200), vel: vec(5000, -1000) })
    state.ships.push(dd)
    launchSalvo(state, dd, 99, 3, 0)
    expect(state.missiles.length).toBe(3)
    for (const m of state.missiles) {
      expect(m.pos).toEqual({ x: 100, y: 200 })
      expect(m.vel).toEqual({ x: 5000, y: -1000 })
      expect(m.phase).toBe('boost')
      // avalonská kvalita raket (missileQuality 1.08, cap 1.05): zámek nad 1.0
      // funguje jako rezerva proti ECM erozi za letu
      expect(m.lock).toBe(1.05)
      expect(m.driveRemaining).toBe(180) // LO režim
      expect(m.salvoId).toBe(state.missiles[0].salvoId)
    }
  })

  it('poškozené šachty snižují velikost salvy (lepší bok, floor)', () => {
    const dd = makeShip(1, 'dd-vichr')
    dd.subsystems.tubesPort = 0.4
    dd.subsystems.tubesStbd = 0.9
    expect(effectiveTubes(dd)).toBe(2) // floor(3 · 0.9)
  })
})

// ---------- statistika pipeline ----------

describe('vrstvená obrana — statistika (200 seedů)', () => {
  /**
   * REFERENČNÍ PÁSMO po rekalibraci se stropem protiraket („dva výstřely
   * na cíl" + interceptní budget dle reakčního času, CM_PK 0.42):
   * měřený průměr ~3.9/50 ≈ 8 % — přesně knižní „z velké salvy se probije
   * jednotka kusů". Zdravé pásmo volíme 5–16 % (2.5–8 raket z 50):
   * pod 5 % by obrana byla zase sterilní, nad 16 % by CA nepřežil ani
   * dvě salvy a boj by přestal být opotřebovávací.
   */
  it('zdravá obrana CA propustí v průměru 5–16 % z 50 raket', () => {
    const SEEDS = 200
    let total = 0
    for (let seed = 1; seed <= SEEDS; seed++) total += runSalvoVsCA(seed, true).hits
    const avg = total / SEEDS
    expect(avg).toBeGreaterThanOrEqual(2.5)  // ≥ 5 %
    expect(avg).toBeLessThanOrEqual(8)       // ≤ 16 %
  })

  it('bez obrany projde > 80 % salvy', () => {
    let total = 0
    const SEEDS = 30
    for (let seed = 1; seed <= SEEDS; seed++) total += runSalvoVsCA(seed, false).hits
    expect(total / (SEEDS * 50)).toBeGreaterThan(0.8)
  })

  it('celá pipeline je deterministická (stejný seed = stejný výsledek)', () => {
    const a = runSalvoVsCA(42, true)
    const b = runSalvoVsCA(42, true)
    expect(a.hits).toBe(b.hits)
    expect(a.rngS).toBe(b.rngS)
  })
})

// ---------- gradient vzdálenosti ----------

describe('gradient vzdálenosti — zblízka obrana slábne (statistika nad seedy)', () => {
  /**
   * Stejná salva 8 raket (HI, zděděný vektor 20 000 km/s) proti zdravému CA
   * z 1 / 2,5 / 5 mil. km. Interceptní budget protiraket (reakční čas od
   * odpalu) dává salvě zblízka méně pokusů CM a pomalejší přílet zdálky
   * nechá zámek erodovat — průnik (způsobené poškození) klesá s dálkou.
   */
  function runAtDistance(seed: number, d: number): number {
    const state = makeState(seed)
    const ca = makeShip(1, 'ca-bastion', { hull: 1e9 })
    state.ships.push(ca)
    for (let i = 0; i < 8; i++) {
      state.missiles.push(makeMissile(100 + i, 1, { pos: vec(d, 0), vel: vec(-20_000, 0) }))
    }
    for (let step = 0; step < 1200 && state.missiles.length > 0; step++) {
      updateMissiles(state, 0.5)
      updateDefenses(state, 0.5)
      state.t += 0.5
      state.events.length = 0
    }
    return 1e9 - ca.hull
  }

  it('průnik klesá s dálkou; z 1 mil. km aspoň 2× vyšší než z 5 mil. km', () => {
    const SEEDS = 300
    let near = 0, mid = 0, far = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      near += runAtDistance(seed, 1_000_000)
      mid += runAtDistance(seed, 2_500_000)
      far += runAtDistance(seed, 5_000_000)
    }
    // monotonie: čím dál, tím míň projde (naměřeno ~23 / ~10 / ~7 dmg na běh)
    expect(near).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(far)
    // zblízka (< 2,5M km) útočnost výrazně roste: aspoň 2× proti 5M km
    expect(near).toBeGreaterThanOrEqual(2 * far)
  })
})

// ---------- bočníky a aspekty ----------

describe('bočníky a aspekty', () => {
  it('bočník tlumí boční paprsky (racionální útlum, VŽDY něco prosákne), hrdlo ·1.25', () => {
    const state = makeState(3)
    const ca = makeShip(1, 'ca-bastion') // sidewallStrength 22
    ca.throttle = 0.6 // výkon bočníků 100 % (rozpočet reaktoru)
    state.ships.push(ca)

    applyBeamDamage(state, ca, 14, 'stbd') // práh 22 → projde 14²/(14+22) ≈ 5.4
    expect(ca.hull).toBeCloseTo(300 - (14 * 14) / (14 + 22), 4)
    // absorbovaná energie pálí generátory bočníku (opotřebení)
    expect(ca.subsystems.sidewallStbd).toBeLessThan(1)

    const before = ca.hull
    applyBeamDamage(state, ca, 14, 'throat')
    expect(ca.hull).toBeCloseTo(before - 14 * 1.25, 4)
  })

  it('oslabený bočník propustí víc — a soustavná palba ho mele dál', () => {
    const state = makeState(4)
    const ca = makeShip(1, 'ca-bastion')
    ca.throttle = 0.6
    ca.subsystems.sidewallStbd = 0.3 // práh 6.6
    state.ships.push(ca)
    applyBeamDamage(state, ca, 14, 'stbd')
    expect(ca.hull).toBeCloseTo(300 - (14 * 14) / (14 + 6.6), 4)
    expect(ca.subsystems.sidewallStbd).toBeLessThan(0.3)
  })

  it('rozpočet reaktoru: výkon bočníků klesá s tahem dle lomené čáry', () => {
    expect(sidewallPowerFactor(0)).toBeCloseTo(1.2)
    expect(sidewallPowerFactor(0.4)).toBeCloseTo(1.2)
    expect(sidewallPowerFactor(0.5)).toBeCloseTo(1.1)
    expect(sidewallPowerFactor(0.6)).toBeCloseTo(1.0)
    expect(sidewallPowerFactor(0.8)).toBeCloseTo(0.6)
    expect(sidewallPowerFactor(1.0)).toBeCloseTo(0.4)
    expect(sidewallPowerFactor(1.2)).toBeCloseTo(0.25)
  })

  it('rychlá loď má papírové boky: při tahu 100 % projde bokem ~2× víc než při 40 %', () => {
    // tah 1.0 → práh 22·0.4 = 8.8 → projde 196/22.8 ≈ 8.6
    const fast = makeState(5)
    const caFast = makeShip(1, 'ca-bastion')
    caFast.throttle = 1.0
    fast.ships.push(caFast)
    applyBeamDamage(fast, caFast, 14, 'stbd')
    expect(caFast.hull).toBeCloseTo(300 - (14 * 14) / (14 + 22 * 0.4), 4)

    // tah 0.4 → práh 22·1.2 = 26.4 → projde jen 196/40.4 ≈ 4.9
    const slow = makeState(5)
    const caSlow = makeShip(1, 'ca-bastion')
    caSlow.throttle = 0.4
    slow.ships.push(caSlow)
    applyBeamDamage(slow, caSlow, 14, 'stbd')
    expect(caSlow.hull).toBeCloseTo(300 - (14 * 14) / (14 + 22 * 1.2), 4)

    expect(300 - caFast.hull).toBeGreaterThan((300 - caSlow.hull) * 1.7)
  })

  it('attackAspect rozliší hrdlo, záď a boky', () => {
    const ship = makeShip(1, 'ca-bastion', { heading: 0 })
    expect(attackAspect(ship, vec(1000, 0))).toBe('throat')
    expect(attackAspect(ship, vec(-1000, 0))).toBe('kilt')
    expect(attackAspect(ship, vec(0, 1000))).toBe('port')
    expect(attackAspect(ship, vec(0, -1000))).toBe('stbd')
  })

  it('energetická palba na max. dosah přes zdravý bočník sotva škrábne', () => {
    const state = makeState(5)
    const dd = makeShip(1, 'dd-vichr', { pos: vec(0, 450_000) }) // z boku (port)
    const ca = makeShip(2, 'ca-bastion', { side: 'enemy' })
    ca.throttle = 0.6 // bočníky na 100 %
    state.ships.push(dd, ca)
    fireEnergy(state, dd, ca)
    // 30 · ~0.26 ≈ 7.8 na paprsek, racionální útlum práh 22 → ~2 prosáknou
    expect(state.events.some(e => e.kind === 'energyHit')).toBe(true)
    expect(ca.hull).toBeLessThan(300)
    expect(ca.hull).toBeGreaterThan(290)
    expect(dd.energyCooldown).toBeGreaterThan(0)
  })

  it('energetická palba zblízka je drtivá: BC proti CL bokem urve přes polovinu trupu', () => {
    const state = makeState(6)
    const bc = makeShip(1, 'bc-praporec', { pos: vec(0, 80_000) }) // pod rozhodující vzdáleností
    const cl = makeShip(2, 'cl-sokol', { side: 'enemy' })
    cl.throttle = 0.8 // standardní tah — bočníky na 60 %
    state.ships.push(bc, cl)
    fireEnergy(state, bc, cl)
    // 5 mountů × 65, práh 16·0.6 = 9.6 → ~57/paprsek — CL to FAKT pocítí
    expect(180 - cl.hull).toBeGreaterThan(90)
  })
})

// ---------- subsystémové umírání ----------

describe('poškození po subsystémech', () => {
  it('loď degraduje po částech a subsystémy padají dřív, než zemře', () => {
    const state = makeState(6)
    const ca = makeShip(1, 'ca-bastion')
    state.ships.push(ca)

    let beamsToKill = 0
    let subsystemHitsBeforeDeath = 0
    while (!ca.destroyed && beamsToKill < 100) {
      applyBeamDamage(state, ca, 20, 'kilt')
      beamsToKill++
      if (!ca.destroyed) {
        subsystemHitsBeforeDeath += state.events.filter(e => e.kind === 'subsystemHit').length
      }
      state.events.length = 0
    }

    expect(ca.destroyed).toBe(true)
    expect(beamsToKill).toBeGreaterThan(3) // žádná skoková smrt jednou ranou
    expect(subsystemHitsBeforeDeath).toBeGreaterThanOrEqual(3) // umírá po částech
    const damagedSubsystems = Object.values(ca.subsystems).filter(v => v < 1).length
    expect(damagedSubsystems).toBeGreaterThanOrEqual(2)
  })

  it('zničení vyvolá event shipDestroyed se slowdown', () => {
    const state = makeState(7)
    const dd = makeShip(1, 'dd-vichr', { hull: 5 })
    state.ships.push(dd)
    applyBeamDamage(state, dd, 30, 'throat')
    expect(dd.destroyed).toBe(true)
    expect(state.events.some(e => e.kind === 'shipDestroyed' && e.slowdown)).toBe(true)
  })
})
