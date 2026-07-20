/**
 * Testy misí 2–4 a nových trigger podmínek (wedgeOn, shipsDestroyedCount).
 * E2E běhy přes engine s pevnými seedy — deterministické, žádná flakiness;
 * hráč je orchestrován přímými applyOrder.
 */
import { describe, expect, it } from 'vitest'
import type { Scenario, SimState } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { SENSOR_UPDATE_INTERVAL, SIM_DT } from '../src/sim/constants'
import { add, angleDiff, angleOf, dist, norm, scale, sub } from '../src/sim/vec'
import { updateSensors, contactsFor } from '../src/sim/sensors'
import { updateTriggers } from '../src/sim/scenario'
import { SCENARIOS } from '../src/data/missions'
import { mission02 } from '../src/data/missions/mission02'
import { mission03 } from '../src/data/missions/mission03'
import { mission04 } from '../src/data/missions/mission04'

/** minimální scénář pro testy podmínek */
function makeScenario(partial: Partial<Scenario>): Scenario {
  return { id: 'test', title: 'Test', briefing: '', seed: 1, ships: [], objectives: [], triggers: [], ...partial }
}

/** vynutí přepočet senzorů (dt = celý interval) */
const runSensors = (state: SimState) => updateSensors(state, SENSOR_UPDATE_INTERVAL)

const objState = (state: SimState, id: string) => state.objectives.find(o => o.id === id)?.state

describe('nové podmínky triggerů', () => {
  it('wedgeOn: splněno jen se zapnutým klínem živé lodi', () => {
    const scenario = makeScenario({
      ships: [{
        classId: 'cl-sokol', side: 'player', name: 'A',
        pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, wedgeOn: false,
      }],
      triggers: [{
        id: 't-wedge', once: true,
        conditions: [{ kind: 'wedgeOn', shipId: 1 }],
        actions: [{ kind: 'setFlag', flag: 'prozrazen' }],
      }],
    })
    const state = sim.create(scenario)
    updateTriggers(state, scenario)
    expect(state.flags['prozrazen']).toBeUndefined() // klín vypnut

    state.ships[0].wedgeOn = true
    updateTriggers(state, scenario)
    expect(state.flags['prozrazen']).toBe(true)

    // zničená loď podmínku nesplní
    const scenario2 = structuredClone(scenario)
    const state2 = sim.create(scenario2)
    state2.ships[0].wedgeOn = true
    state2.ships[0].destroyed = true
    updateTriggers(state2, scenario2)
    expect(state2.flags['prozrazen']).toBeUndefined()
  })

  it('shipsDestroyedCount: počítá zničené lodě jen dané strany', () => {
    const scenario = makeScenario({
      ships: [
        { classId: 'dd-vichr', side: 'player', name: 'DD', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'merch-freighter', side: 'player', name: 'M1', pos: { x: 1, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'merch-freighter', side: 'player', name: 'M2', pos: { x: 2, y: 0 }, vel: { x: 0, y: 0 } },
        { classId: 'cl-sokol', side: 'enemy', name: 'E', pos: { x: 3, y: 0 }, vel: { x: 0, y: 0 } },
      ],
      triggers: [{
        id: 't-losses', once: true,
        conditions: [{ kind: 'shipsDestroyedCount', side: 'player', count: 2 }],
        actions: [{ kind: 'setFlag', flag: 'ztraty' }],
      }],
    })
    const state = sim.create(scenario)
    state.ships[3].destroyed = true // enemy se nepočítá
    state.ships[1].destroyed = true // 1. ztráta player
    updateTriggers(state, scenario)
    expect(state.flags['ztraty']).toBeUndefined()

    state.ships[2].destroyed = true // 2. ztráta player
    updateTriggers(state, scenario)
    expect(state.flags['ztraty']).toBe(true)
  })
})

describe('registrace misí', () => {
  it('mise 2–4 jsou v SCENARIOS a mají očekávaný tvar', () => {
    expect(SCENARIOS['mission02']).toBe(mission02)
    expect(SCENARIOS['mission03']).toBe(mission03)
    expect(SCENARIOS['mission04']).toBe(mission04)
    expect(mission02.ships).toHaveLength(7)     // hráč + 4 obchodníci + bóje + pirát
    expect(mission02.objectives).toHaveLength(2)
    expect(mission03.ships).toHaveLength(3)     // hráč + Q-ship + stanice
    expect(mission04.ships).toHaveLength(5)     // hráč + 3 hlídky + bóje
  })
})

describe('mise 2 — Konvoj Pomezím (E2E)', () => {
  it('obchodníci letí k cíli, zvrat spawne 2 piráty a piráti pronásledují konvoj', () => {
    const state = sim.create(mission02)
    expect(state.ships.map(s => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7])

    // (a) obchodníci s přednastaveným nav kurzem se hýbou k bóji (+x)
    const x0 = state.ships.slice(1, 5).map(s => s.pos.x)
    const d0 = dist(state.ships[1].pos, state.ships[5].pos)
    for (let i = 0; i < 600; i++) sim.tick(state, SIM_DT)
    for (let m = 0; m < 4; m++) {
      expect(state.ships[1 + m].pos.x).toBeGreaterThan(x0[m] + 100_000)
      expect(state.ships[1 + m].vel.x).toBeGreaterThan(300) // akcelerují k cíli
    }
    expect(dist(state.ships[1].pos, state.ships[5].pos)).toBeLessThan(d0)

    // (b) hráč se rozjede za návnadou → zvrat: 2 piráti z opačné strany
    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1 })
    sim.applyOrder(state, { kind: 'intercept', shipId: 1, targetId: 7 })
    while (!state.flags['ambush'] && state.t < 7200) sim.tick(state, SIM_DT)
    expect(state.flags['ambush']).toBe(true)
    expect(state.t).toBeLessThan(7200)
    expect(dist(state.ships[0].pos, state.ships[6].pos)).toBeLessThan(10_000_000)
    expect(state.ships).toHaveLength(9)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('návnada'))).toBe(true)
    for (const id of [8, 9]) {
      const p = state.ships.find(s => s.id === id)!
      expect(p.side).toBe('enemy')
      expect(p.classId).toBe('dd-korzar') // piráti mají opotřebovanou techniku, ne první linii
      expect(p.doctrine).toBe('pirate')
      expect(p.pos.y).toBeLessThan(0) // opačná strana konvoje než návnada
    }

    // (c) po senzorovém intervalu piráti pronásledují lodě konvoje
    for (let i = 0; i < 30; i++) sim.tick(state, SIM_DT)
    const convoyIds = [1, 2, 3, 4, 5]
    for (const id of [7, 8, 9]) {
      const p = state.ships.find(s => s.id === id)!
      expect(p.nav?.kind).toBe('intercept')
      if (p.nav?.kind === 'intercept') expect(convoyIds).toContain(p.nav.targetId)
    }
    // spawnutí piráti jdou po nejbližším obchodníkovi (ne po eskortě)
    for (const id of [8, 9]) {
      const p = state.ships.find(s => s.id === id)!
      if (p.nav?.kind === 'intercept') expect([2, 3, 4, 5]).toContain(p.nav.targetId)
    }
  })

  it('výhra: aspoň 3 obchodníci u bóje (flagy + AND trigger)', () => {
    const state = sim.create(mission02)
    for (const i of [1, 2, 3]) state.ships[i].pos = { x: 147_000_000, y: 0 } // 3M od bóje
    sim.tick(state, SIM_DT)
    expect(state.flags['arrived-2']).toBe(true)
    expect(state.flags['arrived-3']).toBe(true)
    expect(state.flags['arrived-4']).toBe(true)
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-convoy')).toBe('done')
  })

  it('prohra: 2 zničení obchodníci (shipsDestroyedCount side player)', () => {
    const state = sim.create(mission02)
    state.ships[1].destroyed = true
    state.ships[2].destroyed = true
    sim.tick(state, SIM_DT)
    expect(state.outcome).toBe('lose')
    expect(objState(state, 'obj-convoy')).toBe('failed')
    expect(state.events.some(e => e.text.includes('neúnosné ztráty'))).toBe(true)
  })

  it('piráti znají manifest: od startu jdou po obchodnících, ne po eskortě', () => {
    const state = sim.create(mission02)
    for (let i = 0; i < 60; i++) sim.tick(state, SIM_DT) // manifest trigger + senzory
    const karakal = state.ships[6]
    expect(state.flags['revealed:2']).toBe(true)
    expect(karakal.nav?.kind).toBe('intercept')
    if (karakal.nav?.kind === 'intercept') {
      expect([2, 3, 4, 5]).toContain(karakal.nav.targetId) // kořist, ne ANS Dauntless
    }
  })

  it('oblastní obrana: eskorta u konvoje sundává salvy mířící na obchodníky', () => {
    // dva běhy se stejným seedem: bez eskorty poblíž vs. s eskortou poblíž.
    // (Rekalibrace se stropem CM „dva výstřely na cíl": eskorta salvu už
    // NEvynuluje, jen ji výrazně ztenčí — jednotlivý obchodník proto může
    // padnout v obou bězích a bodové srovnání by zaniklo v overkillu.
    // Měříme tedy součet škod na CELÉM konvoji za pevné okno — logika testu,
    // krytý vs. nekrytý konvoj, beze změny.)
    const run = (escortNear: boolean): number => {
      const state = sim.create(mission02)
      const merchant = state.ships[1]
      const escort = state.ships[0]
      const pirate = state.ships[6]
      // pirát 3 mil. km od obchodníka, eskorta buď hned vedle, nebo daleko
      pirate.pos = { x: merchant.pos.x + 3_000_000, y: merchant.pos.y }
      pirate.vel = { ...merchant.vel }
      escort.pos = escortNear
        ? { x: merchant.pos.x + 500_000, y: merchant.pos.y }
        : { x: merchant.pos.x - 80_000_000, y: 0 }
      escort.vel = { ...merchant.vel }
      // pirát nese jen dvě salvy (víc by po pádu konvoje srovnání utopilo
      // v overkillu); jeho AI je odpálí sama — zná manifest
      pirate.missiles = 8
      const before = state.ships.slice(1, 5).reduce((s, m) => s + m.hull, 0)
      for (let t = 0; t < 700; t++) sim.tick(state, SIM_DT)
      return before - state.ships.slice(1, 5).reduce((s, m) => s + Math.max(0, m.hull), 0)
    }
    const dmgUncovered = run(false)
    const dmgCovered = run(true)
    // deštník eskorty musí škody na konvoji výrazně srazit
    expect(dmgCovered).toBeLessThan(dmgUncovered)
    expect(dmgUncovered).toBeGreaterThan(0) // bez krytí konvoj dostává zásahy
  })
})

describe('mise 3 — Q-ship (E2E)', () => {
  it('zvrat vyžaduje čas > 1800 s I přiblížení pod 2,6 mil. km (AND)', () => {
    const scenario = structuredClone(mission03)
    const state = sim.create(scenario)
    state.ships[0].pos = { x: 500_000, y: 0 } // 1,5 mil. km od Mercatoru
    updateTriggers(state, scenario)
    expect(state.flags['qship-revealed']).toBeUndefined() // čas ještě neuplynul
    state.t = 1800
    updateTriggers(state, scenario)
    expect(state.flags['qship-revealed']).toBe(true)
  })

  it('doprovod → zvrat → Q-ship útočí → zničení Q-shipu vyhrává', () => {
    const state = sim.create(mission03)

    // (a) doleť před obchodníka a vyrovnej rychlost (zastav se na jeho trase)
    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1 })
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 7_000_000, y: 0 }, arriveAtRest: true })
    while (!state.flags['qship-revealed'] && state.t < 30_000) sim.tick(state, SIM_DT)

    // (b) zvrat: čas > 1800 s a vzdálenost < 2,6 mil. km ⇒ hunter + odhalení
    expect(state.flags['qship-revealed']).toBe(true)
    expect(state.t).toBeGreaterThan(1800)
    expect(dist(state.ships[0].pos, state.ships[1].pos)).toBeLessThan(2_600_000)
    expect(state.ships[1].doctrine).toBe('hunter')
    expect(objState(state, 'obj-escort')).toBe('failed')
    expect(objState(state, 'obj-destroy')).toBe('open') // nový úkol přidán za běhu
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('pomocný křižník'))).toBe(true)
    // revealClass: kontakt hráče teď hlásí skutečnou třídu
    runSensors(state)
    expect(contactsFor(state, 'player').find(c => c.shipId === 2)?.classGuess).toBe('merch-qship')

    // (c) boj: hráč kituje s odstupem, salvy + rolování; Q-ship útočí
    const drive = (): void => {
      const p = state.ships[0], q = state.ships[1]
      if (p.destroyed || q.destroyed) return
      const d = dist(p.pos, q.pos)
      // bang-bang kiting: drž odstup 2.5–4.5 mil. km
      if (d < 2_500_000 && !(p.nav?.kind === 'course')) {
        const away = add(p.pos, scale(norm(sub(p.pos, q.pos)), 100_000_000))
        sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: away, arriveAtRest: false })
      } else if (d > 4_500_000 && !(p.nav?.kind === 'intercept')) {
        sim.applyOrder(state, { kind: 'intercept', shipId: 1, targetId: 2 })
      }
      // palba (roll je z UI zrušený — hráčská strategie se bez něj obejde:
      // obranu nesou CM/PDLC/návnady)
      if (p.tubeCooldown <= 0 && p.missiles > 0 && d < 5_500_000) {
        sim.applyOrder(state, { kind: 'launchSalvo', shipId: 1, targetId: 2, count: 6, mode: d < 1_500_000 ? 1 : 0 })
      }
      if (p.energyCooldown <= 0 && d < 350_000) {
        sim.applyOrder(state, { kind: 'fireEnergy', shipId: 1, targetId: 2 })
      }
      if (!p.decoyActive && p.decoys > 0
        && state.missiles.some(m => m.side === 'enemy' && m.targetId === 1 && m.phase !== 'dead')) {
        sim.applyOrder(state, { kind: 'deployDecoy', shipId: 1 })
      }
    }

    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1 })
    let sawEnemyMissile = false
    while (state.outcome === 'running' && state.t < 8 * 3600) {
      sim.tick(state, SIM_DT)
      drive()
      if (!sawEnemyMissile && state.missiles.some(m => m.side === 'enemy')) sawEnemyMissile = true
    }

    // Q-ship skutečně útočil (salvy letěly a ubylo mu raket) — po rekalibraci
    // obrany (strop CM + zdvojené trupy) může dobře vedený boj s rolováním
    // skončit i bez vlastního poškození, důkazem boje je palba obou stran
    expect(sawEnemyMissile).toBe(true)
    expect(state.ships[1].missiles).toBeLessThan(140) // Q-ship pálil ze zásobníku 140

    // (d) deterministický výsledek: Q-ship zničen ⇒ vítězství
    expect(state.outcome).toBe('win')
    expect(state.ships[1].destroyed).toBe(true)
    expect(objState(state, 'obj-destroy')).toBe('done')
  })

  it('zničení hráče prohrává', () => {
    const scenario = structuredClone(mission03)
    const state = sim.create(scenario)
    state.ships[0].destroyed = true
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('lose')
  })
})

describe('mise 4 — Tichý pozorovatel', () => {
  it('hráč startuje bez klínu a hlídka ho na 8 mil. km nevidí', () => {
    const state = sim.create(mission04)
    expect(state.ships[0].wedgeOn).toBe(false)

    // 8 mil. km od hlídky Antares (CL, pasivní dosah 6 mil. km)
    state.ships[0].pos = { x: 60_000_000, y: 18_000_000 }
    runSensors(state)
    expect(contactsFor(state, 'enemy').some(c => c.shipId === 1)).toBe(false)
    // hráč naopak hlídky vidí — jejich klíny jsou zapnuté
    for (const id of [2, 3, 4]) {
      expect(contactsFor(state, 'player').some(c => c.shipId === id)).toBe(true)
    }
  })

  it('zapnutí klínu spustí detekci: hlídky přejdou na hunter', () => {
    const state = sim.create(mission04)
    sim.tick(state, SIM_DT)
    expect(state.flags['detected']).toBeUndefined() // drift bez klínu = ticho

    sim.applyOrder(state, { kind: 'setWedge', shipId: 1, on: true })
    sim.tick(state, SIM_DT)
    expect(state.flags['detected']).toBe(true)
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('Prozrazen'))).toBe(true)
    for (const i of [1, 2, 3]) expect(state.ships[i].doctrine).toBe('hunter')
  })

  it('přiblížení pod 4 mil. km k hlídce prozradí i bez klínu', () => {
    const scenario = structuredClone(mission04)
    const state = sim.create(scenario)
    state.ships[0].pos = { x: 60_000_000, y: 8_500_000 } // 3.5 mil. km od Antaresu (y=5M)
    updateTriggers(state, scenario)
    expect(state.flags['detected']).toBe(true)
    expect(state.ships[1].doctrine).toBe('hunter')
  })

  it('zmapování všech hlídek spawne kurýra Hermes; záchrana a únik vyhrávají', () => {
    const scenario = structuredClone(mission04)
    const state = sim.create(scenario)

    // (a) postupné přiblížení na 5 mil. km ke každé hlídce (pod 6, nad 4)
    for (const i of [1, 2, 3]) {
      const patrol = state.ships[i]
      state.ships[0].pos = { x: patrol.pos.x, y: patrol.pos.y + 5_000_000 }
      updateTriggers(state, scenario)
    }
    expect(state.flags['scouted-2']).toBe(true)
    expect(state.flags['scouted-3']).toBe(true)
    expect(state.flags['scouted-4']).toBe(true)
    expect(state.flags['mapped']).toBe(true)
    expect(state.flags['detected']).toBeUndefined() // pořád nezpozorován
    expect(objState(state, 'obj-map')).toBe('done')

    // (b) zvrat: kurýr Hermes spawnut + volitelný úkol přidán za běhu
    expect(state.events.some(e => e.kind === 'message' && e.text.includes('Hermes'))).toBe(true)
    const hermes = state.ships.find(s => s.id === 6)
    expect(hermes).toBeDefined()
    expect(hermes?.classId).toBe('disp-courier')
    expect(hermes?.side).toBe('player')
    expect(hermes?.wedgeOn).toBe(false) // driftuje bez pohonu
    expect(objState(state, 'obj-rescue')).toBe('open')

    // (c) záchrana: přiblížení na 500 tis. km ke kurýrovi
    state.ships[0].pos = { x: hermes!.pos.x, y: hermes!.pos.y + 300_000 }
    updateTriggers(state, scenario)
    expect(objState(state, 'obj-rescue')).toBe('done')
    expect(state.events.some(e => e.text.includes('na palubě'))).toBe(true)

    // (d) únik za protější hyperlimit se zmapovanými silami ⇒ vítězství
    state.ships[0].pos = { x: 258_000_000, y: 0 }
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-escape')).toBe('done')
  })

  it('únik k bóji bez zmapování nevyhrává (AND s flagem mapped)', () => {
    const scenario = structuredClone(mission04)
    const state = sim.create(scenario)
    state.ships[0].pos = { x: 258_000_000, y: 0 }
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('running')
  })

  it('trysky: bez klínu loď zrychluje ~THRUSTER_G (korekce driftu)', () => {
    const state = sim.create(mission04)
    const aurora = state.ships[0]
    expect(aurora.wedgeOn).toBe(false)
    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1 })
    // cíl stranou od dráhy driftu ⇒ navádění burnuje kolmo (korekce k +y)
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 500_000_000, y: 10_000_000 }, arriveAtRest: false })
    for (let i = 0; i < 120; i++) sim.tick(state, 0.5) // 60 s (z toho ~10 s otočka k +y)
    // a = THRUSTER_G · G = 5 · 0.00981 ≈ 0.049 km/s² → Δvy ≈ 2,4 km/s za ~50 s burnu
    expect(aurora.vel.y).toBeGreaterThan(1.8)
    expect(aurora.vel.y).toBeLessThan(3.2)
  })

  /**
   * DŮKAZ HRATELNOSTI: celá mise 4 deterministicky vyhraná rozumnou hrou —
   * korekce dráhy tryskami do koridoru 4–6 mil. km u každé hlídky (bez
   * prozrazení), pak klín až s odstupem od poslední hlídky a únik vpřed.
   */
  it('mise 4 je hratelná: trysky → zmapování bez prozrazení → únik (E2E)', () => {
    const state = sim.create(mission04)
    const order = (o: Parameters<typeof sim.applyOrder>[1]): void => sim.applyOrder(state, o)
    const tickUntil = (cond: () => boolean, maxT: number): void => {
      while (!cond() && state.t < maxT && state.outcome === 'running') sim.tick(state, 0.5)
    }

    order({ kind: 'setThrottle', shipId: 1, throttle: 1 })
    // hlídka A (60M, +5M): čistý drift ji mine na ~5 mil. km — žádný manévr
    // (kurz vpřed by loď zbytečně zrychlil a zkrátil čas na další korekce)
    tickUntil(() => !!state.flags['scouted-2'], 40_000)
    expect(state.flags['scouted-2']).toBe(true)

    // hlídka B (95M, −7,5M): korekce k −y, průlet koridorem 4–6 mil. km
    order({ kind: 'setCourse', shipId: 1, dest: { x: 95_000_000, y: -3_000_000 }, arriveAtRest: false })
    tickUntil(() => !!state.flags['scouted-3'], 60_000)
    expect(state.flags['scouted-3']).toBe(true)

    // hlídka C (130M, +5,5M): korekce zpět k +y
    order({ kind: 'setCourse', shipId: 1, dest: { x: 130_000_000, y: 1_000_000 }, arriveAtRest: false })
    tickUntil(() => !!state.flags['scouted-4'], 80_000)
    expect(state.flags['scouted-4']).toBe(true)
    expect(state.flags['mapped']).toBe(true)
    expect(state.flags['detected']).toBeUndefined() // celé mapování potichu!

    // únik: dál balisticky, klín až s bezpečným odstupem od Altairu
    tickUntil(() => state.ships[0].pos.x > 150_000_000, 100_000)
    order({ kind: 'setWedge', shipId: 1, on: true })
    order({ kind: 'setCourse', shipId: 1, dest: { x: 258_000_000, y: 0 }, arriveAtRest: false })
    tickUntil(() => state.outcome !== 'running', 130_000)
    expect(state.outcome).toBe('win') // hlídky loví, ale náskok + rychlost stačí
  })
})
