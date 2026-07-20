/**
 * Škola raketového boje (tutoriálový balík):
 *   - automatická volba pohonu ('auto' → HI zblízka, LO na dálku),
 *   - tažené raketové plošiny (alfa úder mimo šachty),
 *   - PDLC připravenost dle doby letu salvy (odpal zblízka = vražedný),
 *   - koučovací hlášky (jednou za misi),
 *   - výchozí příděl plošin ze scénáře (hráč ano, AI ne).
 */
import { describe, expect, it } from 'vitest'
import type { Contact, ShipState, Subsystems, SimState } from '../src/sim/types'
import { PODS_PER_POD, PDLC_MIN_READINESS, PDLC_TRACK_TIME } from '../src/sim/constants'
import { SHIP_CLASSES } from '../src/data/defs'
import { vec } from '../src/sim/vec'
import { autoDriveMode, launchPods, launchSalvo, updateMissiles } from '../src/sim/weapons'
import { pdlcReadiness } from '../src/sim/defense'
import { spawnShip } from '../src/sim/scenario'

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

function contactFor(ship: ShipState): Contact {
  return {
    shipId: ship.id, pos: ship.pos, vel: ship.vel, age: 0,
    idQuality: 1, classGuess: ship.classId, wedgeDetected: true,
  }
}

describe('automatická volba pohonu (autoDriveMode)', () => {
  it('zblízka HI, na dálku LO', () => {
    const zero = vec(0, 0)
    expect(autoDriveMode(zero, zero, vec(1_000_000, 0), zero)).toBe(1)  // v HI obálce (~1,6 M)
    expect(autoDriveMode(zero, zero, vec(5_000_000, 0), zero)).toBe(0)  // jen LO
  })

  it('vlastní vektor k cíli HI obálku natahuje', () => {
    const zero = vec(0, 0)
    // 3 M km je nad statickou HI obálkou (~1,6 M), ale s přibližovací
    // rychlostí 30 000 km/s (60 s hoření → +1,8 M km) už HI doletí
    expect(autoDriveMode(zero, vec(30_000, 0), vec(3_000_000, 0), zero)).toBe(1)
  })

  it("launchSalvo s 'auto' odpálí HI rakety zblízka", () => {
    const state = makeState(1)
    const shooter = makeShip(1, 'ca-bastion')
    const target = makeShip(2, 'dd-vichr', { side: 'enemy', pos: vec(1_000_000, 0) })
    state.ships.push(shooter, target)
    launchSalvo(state, shooter, 2, 4, 'auto')
    expect(state.missiles.length).toBe(4)
    expect(state.missiles.every(m => m.mode === 1)).toBe(true)
  })
})

describe('raketové plošiny (launchPods)', () => {
  function setup(): SimState {
    const state = makeState(7)
    const shooter = makeShip(1, 'ca-bastion', { pods: 4 })
    const target = makeShip(2, 'cl-sokol', { side: 'enemy', pos: vec(1_200_000, 0) })
    state.ships.push(shooter, target)
    state.contacts.player = [contactFor(target)]
    return state
  }

  it('odpálí všechny plošiny najednou (pods×6 raket), mimo šachty i zásobníky', () => {
    const state = setup()
    const shooter = state.ships[0]
    const missilesBefore = shooter.missiles
    launchPods(state, shooter, 2)
    expect(state.missiles.length).toBe(4 * PODS_PER_POD)
    expect(shooter.pods).toBe(0)                    // jednorázové
    expect(shooter.missiles).toBe(missilesBefore)   // zásobníky nedotčené
    expect(shooter.tubeCooldown).toBe(0)            // šachty nenabíjejí
  })

  it('funguje i během přebíjení šachet (pody visí mimo trup)', () => {
    const state = setup()
    const shooter = state.ships[0]
    shooter.tubeCooldown = 20
    launchPods(state, shooter, 2)
    expect(state.missiles.length).toBe(4 * PODS_PER_POD)
  })

  it('bez plošin nic neodpálí; bez živého kontaktu odmítne', () => {
    const state = setup()
    const shooter = state.ships[0]
    shooter.pods = 0
    launchPods(state, shooter, 2)
    expect(state.missiles.length).toBe(0)
    shooter.pods = 2
    state.contacts.player = [] // žádný kontakt
    launchPods(state, shooter, 2)
    expect(state.missiles.length).toBe(0)
    expect(shooter.pods).toBe(2) // plošiny se nespotřebovaly
  })
})

describe('PDLC připravenost (odpal zblízka je vražedný)', () => {
  it('plná po PDLC_TRACK_TIME, dno PDLC_MIN_READINESS', () => {
    expect(pdlcReadiness(PDLC_TRACK_TIME)).toBe(1)
    expect(pdlcReadiness(PDLC_TRACK_TIME * 2)).toBe(1)
    expect(pdlcReadiness(PDLC_TRACK_TIME / 2)).toBeCloseTo(0.5)
    expect(pdlcReadiness(0)).toBe(PDLC_MIN_READINESS)
  })
})

describe('koučovací hlášky (jednou za misi)', () => {
  it('dálkový odpal > 5 M km poučí o škole palby — jen poprvé', () => {
    const state = makeState(3)
    const shooter = makeShip(1, 'ca-bastion')
    const target = makeShip(2, 'dd-vichr', { side: 'enemy', pos: vec(9_000_000, 0) })
    state.ships.push(shooter, target)
    launchSalvo(state, shooter, 2, 4, 'auto')
    const lessons = state.events.filter(e => e.kind === 'message' && e.text?.includes('ŠKOLA PALBY'))
    expect(lessons.length).toBe(1)
    shooter.tubeCooldown = 0
    launchSalvo(state, shooter, 2, 4, 'auto')
    const again = state.events.filter(e => e.kind === 'message' && e.text?.includes('ŠKOLA PALBY'))
    expect(again.length).toBe(1) // podruhé už mlčí
  })

  it('AI kouče nespouští', () => {
    const state = makeState(4)
    const shooter = makeShip(1, 'ca-bastion', { side: 'enemy', doctrine: 'hunter' })
    const target = makeShip(2, 'dd-vichr', { pos: vec(9_000_000, 0) })
    state.ships.push(shooter, target)
    launchSalvo(state, shooter, 2, 4, 'auto')
    expect(state.events.some(e => e.kind === 'message' && e.text?.includes('ŠKOLA'))).toBe(false)
  })
})

describe('navádění — zděděný boční vektor lodi (regrese „střely přeletí")', () => {
  /**
   * Raketa odpálená z lodi s velkým BOČNÍM vektorem musí boční rychlost
   * aktivně vyrušit a doletět. Staré čisté pronásledování (tah slepě NA
   * cíl) ji nechalo letět obloukem kolem cíle: při 10 000 km/s do boku
   * minula o ~530 tis. km a expirovala, při 30 000 km/s se k cíli vůbec
   * nepřiblížila.
   */
  function probe(lateral: number): { resolved: number; expired: number } {
    const state = makeState(11)
    const shooter = makeShip(1, 'ca-bastion', { vel: vec(0, lateral) })
    const target = makeShip(2, 'merch-freighter', {
      side: 'enemy', pos: vec(2_000_000, 0),
      subsystems: fullSubsystems(0), cms: 0, hull: 1e9,
    })
    state.ships.push(shooter, target)
    launchSalvo(state, shooter, 2, 4, 'auto')
    let resolved = 0
    let expired = 0
    for (let i = 0; i < 4000 && state.missiles.length > 0; i++) {
      state.t += 0.5
      updateMissiles(state, 0.5)
      for (const e of state.events) {
        if (e.kind === 'missileMiss' && e.cause === 'expired') expired++
        if (e.kind === 'missileHit' || (e.kind === 'missileMiss' && e.cause === 'dud')) resolved++
      }
      state.events = []
    }
    return { resolved, expired }
  }

  it('rakety doletí i při bočním vektoru 10/30/60 tis. km/s', () => {
    for (const lateral of [10_000, 30_000, 60_000]) {
      const r = probe(lateral)
      expect(r.resolved, `boční ${lateral} km/s`).toBe(4)
      expect(r.expired, `boční ${lateral} km/s`).toBe(0)
    }
  })

  it('odpal „přes rameno" (cíl za zádí) se otočí a doletí', () => {
    const r = (() => {
      const state = makeState(12)
      // loď letí 20 000 km/s OD cíle
      const shooter = makeShip(1, 'ca-bastion', { vel: vec(-20_000, 0) })
      const target = makeShip(2, 'merch-freighter', {
        side: 'enemy', pos: vec(1_500_000, 0),
        subsystems: fullSubsystems(0), cms: 0, hull: 1e9,
      })
      state.ships.push(shooter, target)
      launchSalvo(state, shooter, 2, 4, 0) // LO — dost paliva na otočku
      let resolved = 0
      for (let i = 0; i < 4000 && state.missiles.length > 0; i++) {
        state.t += 0.5
        updateMissiles(state, 0.5)
        for (const e of state.events) {
          if (e.kind === 'missileHit' || (e.kind === 'missileMiss' && e.cause === 'dud')) resolved++
        }
        state.events = []
      }
      return resolved
    })()
    expect(r).toBe(4)
  })
})

describe('výchozí příděl plošin ze scénáře', () => {
  it('hráčova loď dostane podCapacity třídy, AI nic, override vyhrává', () => {
    const state = makeState(5)
    const player = spawnShip(state, {
      classId: 'ca-bastion', side: 'player', name: 'A', pos: vec(0, 0), vel: vec(0, 0),
    })
    const enemy = spawnShip(state, {
      classId: 'ca-bastion', side: 'enemy', name: 'B', pos: vec(0, 0), vel: vec(0, 0),
    })
    const custom = spawnShip(state, {
      classId: 'dd-vichr', side: 'enemy', name: 'C', pos: vec(0, 0), vel: vec(0, 0), pods: 3,
    })
    expect(player.pods).toBe(4)  // CA podCapacity
    expect(enemy.pods).toBe(0)   // AI bez plošin (neumí je odpálit)
    expect(custom.pods).toBe(3)  // scénář může dát AI plošiny explicitně
  })
})
