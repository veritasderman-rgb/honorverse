/**
 * Mise 11 — „Stěna proti stěně" (20 vs. 20): struktura, hratelnost (E2E)
 * a výkon velké bitvy. Vítězná doktrína (ověřená měřením):
 *   1. celá stěna do formace WALL za vlajkovou lodí, tah 0,6 (plné štíty),
 *   2. usadit se (arriveAtRest) a nechat imperiální stěnu nabíhat,
 *   3. palbu otevřít až pod 7 mil. km — žhavé zámky s řídicím spojem,
 *   4. ALFA ÚDER: při otevření palby odhodit raketové plošiny, rozdělené
 *      po čtvrtinách stěny na 4 imperiální DN (saturační první vlna),
 *   5. KONCENTRACE: celá stěna na jeden cíl (saturace obrany), DN první,
 *   6. návnady při příchozích salvách; energetické baterie řeší AUTO.
 */
import { describe, expect, it } from 'vitest'
import { sim } from '../src/sim/engine'
import { SIM_DT } from '../src/sim/constants'
import { mission11 } from '../src/data/missions/mission11'
import { SCENARIOS } from '../src/data/missions'
import { SHIP_CLASSES } from '../src/data/defs'

const CORE = Array.from({ length: 20 }, (_, i) => i + 1)
const DNS = [21, 22, 23, 24]

describe('mise 11 — struktura', () => {
  it('je v registru a má 20 vs. 20 + základnu + planetu', () => {
    expect(SCENARIOS['mission11']).toBe(mission11)
    const ships = mission11.ships
    expect(ships.filter(s => s.side === 'player')).toHaveLength(20)
    expect(ships.filter(s => s.side === 'enemy')).toHaveLength(21) // stěna + základna
    expect(ships.filter(s => s.classId === 'planet')).toHaveLength(1)
    expect(ships.filter(s => s.classId === 'dn-ural')).toHaveLength(4)
    // všech 20 avalonských lodí je ovladatelných (admirál velí stěně)
    expect(ships.filter(s => s.side === 'player' && s.doctrine === 'player')).toHaveLength(20)
  })

  it('planeta je statická třída (maxAccelG 0) — kandidát trvalého zakreslení', () => {
    expect(SHIP_CLASSES['planet'].maxAccelG).toBe(0)
    expect(SHIP_CLASSES['station-zeta'].maxAccelG).toBe(0)
  })
})

describe('mise 11 — E2E hratelnost (vítězná doktrína stěny)', () => {
  it('koncentrovaná stěna rozbije imperiální stěnu (win, ztráty ≤ 12)', () => {
    const state = sim.create(mission11)
    // (1) stěna: tah 0,6, formace za vlajkovou lodí
    for (const id of CORE) {
      sim.applyOrder(state, { kind: 'setThrottle', shipId: id, throttle: 0.6 })
    }
    for (let i = 1; i < CORE.length; i++) {
      sim.applyOrder(state, { kind: 'setFormation', shipId: CORE[i], leaderId: 1, slot: i, formation: 'wall' })
    }
    // priorita oprav OBRANA: stěna v raketové výměně žije z bočních štítů,
    // PDLC a protiraket — čety je drží nahoře na úkor šachet a pohonu
    for (const id of CORE) {
      sim.applyOrder(state, { kind: 'setRepairFocus', shipId: id, focus: 'defense' })
    }
    // (2) usadit se na x = 12 mil. km — nabíhat budou oni
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 12_000_000, y: 0 }, arriveAtRest: true })

    let currentTarget = 21
    const engageAll = (): void => {
      for (const id of CORE) {
        sim.applyOrder(state, {
          kind: 'setFireControl', shipId: id,
          fc: { mode: 'auto', targetId: currentTarget, salvoSize: 16, driveMode: 0 },
        })
      }
    }
    let engaged = false
    let lastCheck = 0
    for (let t = 0; t < 3 * 3600 && state.outcome === 'running'; t += SIM_DT) {
      sim.tick(state, SIM_DT)
      state.events.length = 0
      // (3) palbu otevřít pod 7 mil. km
      if (!engaged) {
        const flag = state.ships[0]
        const foe = state.ships.find(x => x.side === 'enemy' && !x.destroyed && x.id !== 41)
        if (foe && Math.hypot(foe.pos.x - flag.pos.x, foe.pos.y - flag.pos.y) < 7_000_000) {
          engaged = true
          engageAll()
          // (4) alfa úder plošinami: čtvrtiny stěny na čtyři imperiální DN
          CORE.forEach((id, i) => {
            sim.applyOrder(state, { kind: 'launchPods', shipId: id, targetId: DNS[i % 4] })
          })
        }
      }
      if (engaged && t - lastCheck > 30) {
        lastCheck = t
        // (4) koncentrace: po pádu cíle celá stěna na dalšího (DN první)
        const tgt = state.ships.find(s => s.id === currentTarget)
        if (!tgt || tgt.destroyed) {
          const nextDn = state.ships.find(x => DNS.includes(x.id) && !x.destroyed)
          const nextAny = state.ships.find(x => x.side === 'enemy' && !x.destroyed && x.id !== 41)
          const nt = nextDn ?? nextAny
          if (nt) { currentTarget = nt.id; engageAll() }
        }
        // (5) návnady pod palbou
        for (const id of CORE) {
          const ship = state.ships.find(s => s.id === id)
          if (ship && !ship.destroyed && !ship.decoyActive && ship.decoys > 0
            && state.missiles.some(m => m.targetId === id && m.phase !== 'dead')) {
            sim.applyOrder(state, { kind: 'deployDecoy', shipId: id })
          }
        }
      }
    }

    expect(state.outcome).toBe('win')
    // všechny 4 DN zničeny, stěna zlomena (≥ 14), naše ztráty snesitelné
    expect(state.ships.filter(s => DNS.includes(s.id) && s.destroyed)).toHaveLength(4)
    expect(state.ships.filter(s => s.side === 'enemy' && s.destroyed).length).toBeGreaterThanOrEqual(14)
    expect(state.ships.filter(s => s.side === 'player' && s.destroyed).length).toBeLessThanOrEqual(12) // symetricky silnější polní opravy zvedly opotřebení obou stěn
    expect(state.ships[0].destroyed).toBe(false) // vlajková loď přežila
  }, 120_000)
})

describe('mise 11 — výkon', () => {
  it('10 000 ticků plné bitvy 40+ lodí pod 15 s', () => {
    const state = sim.create(mission11)
    for (const id of CORE) {
      sim.applyOrder(state, {
        kind: 'setFireControl', shipId: id,
        fc: { mode: 'auto', targetId: 21, salvoSize: 16, driveMode: 0 },
      })
    }
    const t0 = performance.now()
    for (let i = 0; i < 10_000; i++) sim.tick(state, SIM_DT)
    const ms = performance.now() - t0
    expect(ms).toBeLessThan(15_000) // rezerva na paralelní běh celé sady
  }, 30_000)
})
