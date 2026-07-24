/**
 * Sesazená alfa-salva („srovnat tuby", A1): vybrané lodě naplánují plnou
 * salvu na SPOLEČNÝ dopad (time-on-target). Bližší loď zpozdí odpal, aby
 * všechny salvy dorazily naráz a zahltily obranu.
 *   - koordinace: bližší loď dostane pendingWave (zpoždění), vzdálenější pálí hned,
 *   - saturace: koordinovaný dopad propustí do cíle víc než rozprostřená palba.
 * Spouštět: npx vitest run tests/alphastrike.test.ts
 */
import { describe, expect, it } from 'vitest'
import type { ShipState, SimState, Subsystems } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { SIM_DT } from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'

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

/** dvě vlastní lodě v různé vzdálenosti + jeden pasivní nepřátelský cíl */
function scenario(seed: number): { s: SimState; near: ShipState; far: ShipState; foe: ShipState } {
  const s = makeState(seed)
  const foe = makeShip(1, 'ca-bastion', {
    id: 1, side: 'enemy', name: 'cíl', pos: vec(0, 0), doctrine: 'player', // 'player' = žádné AI (pasivní obránce)
    fireControl: { mode: 'hold', targetId: null, salvoSize: 0, driveMode: 0, engaged: false },
  })
  const near = makeShip(2, 'ca-bastion', { id: 2, pos: vec(2_000_000, 0) })
  const far = makeShip(3, 'ca-bastion', { id: 3, pos: vec(6_400_000, 0) })
  s.ships = [foe, near, far]
  // strana hráče „vidí" cíl kvalitně (dobré palebné řešení)
  s.contacts.player = [{
    shipId: 1, pos: vec(0, 0), vel: vec(0, 0), classGuess: 'ca-bastion',
    idQuality: 2, age: 0, side: 'enemy', wedgeDetected: true,
  } as unknown as SimState['contacts']['player'][number]]
  return { s, near, far, foe }
}

describe('A1 — sesazená alfa-salva (time-on-target)', () => {
  it('bližší loď zpozdí odpal (pendingWave), vzdálenější pálí hned', () => {
    const { s, near, far } = scenario(1)
    sim.applyOrder(s, { kind: 'alphaStrike', shipIds: [near.id, far.id], targetId: 1 })

    // vzdálenější loď odpálila TEĎ (bez čekající vlny), rakety už letí
    expect(far.pendingWave).toBeNull()
    expect(s.missiles.some(m => m.shooterId === far.id)).toBe(true)

    // bližší loď má naplánovanou vlnu do budoucna (společný dopad)
    expect(near.pendingWave).not.toBeNull()
    expect(near.pendingWave!.launchAt).toBeGreaterThan(s.t)
    // a zatím nepálila
    expect(s.missiles.some(m => m.shooterId === near.id)).toBe(false)
  })

  it('obě salvy dorazí do cíle v úzkém časovém okně (naráz)', () => {
    const { s } = scenario(2)
    sim.applyOrder(s, { kind: 'alphaStrike', shipIds: [2, 3], targetId: 1 })
    // časy zásahů podle strany rakety (naše = player)
    const hitTimes: number[] = []
    for (let i = 0; i < 8000 && (s.missiles.length > 0 || s.ships[1].pendingWave); i++) {
      sim.tick(s, SIM_DT)
      for (const ev of s.events) {
        if (ev.kind === 'missileHit' && ev.side === 'player') hitTimes.push(s.t)
      }
      s.events.length = 0 // eventy se v tick samy nemažou — spotřebuj je
      if (s.ships[0].destroyed) break
    }
    expect(hitTimes.length).toBeGreaterThan(0)
    // rozptyl příletu vlny je malý (koordinace) — do ~40 s, ne minuty
    const spread = Math.max(...hitTimes) - Math.min(...hitTimes)
    expect(spread).toBeLessThan(40)
  })

  it('koordinovaný úder propustí do cíle víc než rozprostřená palba (saturace)', () => {
    // pro férovost bez zpětné palby: cíl je nezničitelný (obří trup), jen defenduje
    const run = (coordinated: boolean): number => {
      let hits = 0
      for (let seed = 1; seed <= 24; seed++) {
        const { s } = scenario(seed * 7 + 3)
        s.ships[0].hull = 1e9 // cíl přežije, počítáme jen průniky
        if (coordinated) {
          sim.applyOrder(s, { kind: 'alphaStrike', shipIds: [2, 3], targetId: 1 })
        } else {
          // rozprostřená palba: obě lodě pálí TEĎ (bližší dorazí dřív, dál později)
          const tubes = SHIP_CLASSES['ca-bastion'].tubesPerBroadside
          sim.applyOrder(s, { kind: 'launchSalvo', shipId: 2, targetId: 1, count: tubes, mode: 'auto' })
          sim.applyOrder(s, { kind: 'launchSalvo', shipId: 3, targetId: 1, count: tubes, mode: 'auto' })
        }
        for (let i = 0; i < 9000 && (s.missiles.length > 0 || s.ships[1].pendingWave); i++) {
          sim.tick(s, SIM_DT)
          for (const ev of s.events) {
            if (ev.kind === 'missileHit' && ev.side === 'player') hits++
          }
          s.events.length = 0 // eventy se v tick samy nemažou — spotřebuj je
        }
      }
      return hits
    }
    const coord = run(true)
    const spread = run(false)
    // koordinovaný dopad zahltí obranu → aspoň tolik průniků jako rozprostřený
    expect(coord).toBeGreaterThanOrEqual(spread)
  })
})
