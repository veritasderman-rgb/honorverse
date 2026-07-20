/**
 * Testy misí 5–8 a nových rozšíření enginu (setSide, podSalvo, classified,
 * spawn s pevným id). E2E běhy přes engine s pevnými seedy — deterministické;
 * hráč je orchestrován přímými applyOrder.
 */
import { describe, expect, it } from 'vitest'
import type { SimState } from '../src/sim/types'
import { sim } from '../src/sim/engine'
import { SENSOR_UPDATE_INTERVAL, SIM_DT } from '../src/sim/constants'
import { angleDiff, angleOf, dist, norm, sub } from '../src/sim/vec'
import { updateSensors, contactsFor } from '../src/sim/sensors'
import { updateTriggers } from '../src/sim/scenario'
import { SCENARIOS } from '../src/data/missions'
import { mission05 } from '../src/data/missions/mission05'
import { mission06 } from '../src/data/missions/mission06'
import { mission07 } from '../src/data/missions/mission07'
import { mission08 } from '../src/data/missions/mission08'

/** vynutí přepočet senzorů (dt = celý interval) */
const runSensors = (state: SimState) => updateSensors(state, SENSOR_UPDATE_INTERVAL)

const objState = (state: SimState, id: string) => state.objectives.find(o => o.id === id)?.state

const shipById = (state: SimState, id: number) => state.ships.find(s => s.id === id)

/**
 * Obrana hráče (id 1) bez rollu (z UI zrušen): tažená návnada, když na
 * loď letí rakety — zbytek nese CM/PDLC vrstva.
 */
function playerRollDefense(state: SimState): void {
  const p = state.ships[0]
  if (p.destroyed) return
  if (!p.decoyActive && p.decoys > 0
    && state.missiles.some(m => m.side === 'enemy' && m.targetId === 1 && m.phase !== 'dead')) {
    sim.applyOrder(state, { kind: 'deployDecoy', shipId: 1 })
  }
}

describe('registrace misí 5–8', () => {
  it('mise 5–8 jsou v SCENARIOS a mají očekávaný tvar', () => {
    expect(SCENARIOS['mission05']).toBe(mission05)
    expect(SCENARIOS['mission06']).toBe(mission06)
    expect(SCENARIOS['mission07']).toBe(mission07)
    expect(SCENARIOS['mission08']).toBe(mission08)
    expect(mission05.ships).toHaveLength(2)  // hráč + stanice (vlny spawnují triggery)
    expect(mission06.ships).toHaveLength(5)  // hráč + 3 pronásledovatelé + bóje
    expect(mission07.ships).toHaveLength(9)  // hráč + 4 obchodníci + 3 eskorty + bóje
    expect(mission08.ships).toHaveLength(5)  // hráč + Claymore + 3 lodě stěny
    expect(mission05.hyperlimit).toEqual({ kind: 'lineX', x: 45_000_000 })
    expect(mission06.hyperlimit).toEqual({ kind: 'lineX', x: 180_000_000 })
    expect(mission07.hyperlimit).toEqual({ kind: 'lineX', x: 150_000_000 })
    expect(mission08.hyperlimit?.kind).toBe('circle')
  })

  it('nové třídy lodí: bc-praporec a station-zeta jdou spawnout', () => {
    const state = sim.create(mission07)
    expect(state.ships[0].classId).toBe('bc-praporec')
    expect(state.ships[0].missiles).toBe(400)
    const m5 = sim.create(mission05)
    expect(m5.ships[1].classId).toBe('station-zeta')
    expect(m5.ships[1].wedgeOn).toBe(false)
    expect(m5.ships[1].nav).toBeNull()
  })
})

describe('mise 5 — Stanice Zeta', () => {
  it('vlny: spawn s pevnými id, vlna 2 po vyřazení vlny 1, vlna 3 s civilistou', () => {
    const scenario = structuredClone(mission05)
    const state = sim.create(scenario)

    // vlna 1 v t = 600 s
    state.t = 600
    updateTriggers(state, scenario)
    expect(shipById(state, 9011)?.classId).toBe('dd-vichr')
    expect(shipById(state, 9012)?.doctrine).toBe('hunter')
    expect(shipById(state, 9011)?.side).toBe('enemy')
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'station')).toBe(true)
    expect(shipById(state, 9021)).toBeUndefined() // vlna 2 ještě ne

    // vlna 2 po vyřazení vlny 1 (zničení I kapitulace nastaví neutralized)
    shipById(state, 9011)!.destroyed = true
    shipById(state, 9012)!.surrendered = true
    updateTriggers(state, scenario) // 1. průchod: flagy
    updateTriggers(state, scenario) // 2. průchod: spawn vlny 2
    expect(state.flags['neutralized-9011']).toBe(true)
    expect(state.flags['neutralized-9012']).toBe(true)
    for (const id of [9021, 9022, 9023]) {
      expect(shipById(state, id)?.doctrine).toBe('hunter')
    }

    // vlna 3 po vyřazení vlny 2 — mezi útočníky letí civilní obchodník
    for (const id of [9021, 9022, 9023]) shipById(state, id)!.destroyed = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(shipById(state, 9031)?.classId).toBe('cl-sokol')
    const civ = shipById(state, 9034)!
    expect(civ.classId).toBe('merch-freighter')
    expect(civ.side).toBe('enemy')
    expect(civ.doctrine).toBe('freighter') // civilista nebojuje
    // „stejný vektor" jako vlna: letí zhruba ke stanici
    expect(civ.vel.x).toBeLessThan(0)
  })

  /** dopraví stav mise 5 do vlny 3 (vlny 1–2 vyřazeny zničením) */
  function toWave3(scenario: typeof mission05): SimState {
    const state = sim.create(scenario)
    state.t = 600
    updateTriggers(state, scenario)
    for (const id of [9011, 9012]) shipById(state, id)!.destroyed = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    for (const id of [9021, 9022, 9023]) shipById(state, id)!.destroyed = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    return state
  }

  it('zvrat: přiblížení pod 4 mil. km odhalí civilisty a přidá skrytý úkol', () => {
    const scenario = structuredClone(mission05)
    const state = toWave3(scenario)
    expect(objState(state, 'obj-civ')).toBeUndefined() // skrytý úkol zatím neexistuje

    const civ = shipById(state, 9034)!
    state.ships[0].pos = { x: civ.pos.x, y: civ.pos.y + 3_000_000 }
    updateTriggers(state, scenario) // flag civ-known
    updateTriggers(state, scenario) // reveal akce
    expect(state.flags['civ-known']).toBe(true)
    expect(objState(state, 'obj-civ')).toBe('open')
    expect(state.events.some(e => e.kind === 'comm' && e.text.includes('Nestřílet'))).toBe(true)
    // revealClass: kontakt hráče teď hlásí skutečnou třídu
    runSensors(state)
    expect(contactsFor(state, 'player').find(c => c.shipId === 9034)?.classGuess).toBe('merch-freighter')
  })

  it('zvrat: klasifikace aktivními senzory (podmínka classified) odhalí civilisty i nad 4 mil. km', () => {
    const scenario = structuredClone(mission05)
    const state = toWave3(scenario)
    const civ = shipById(state, 9034)!
    // 5 mil. km — nad prahem přiblížení (4M), ale v dosahu aktivních senzorů (8M)
    state.ships[0].pos = { x: civ.pos.x, y: civ.pos.y + 5_000_000 }
    updateTriggers(state, scenario)
    expect(state.flags['civ-known']).toBeUndefined() // bez aktivních senzorů nic

    state.ships[0].activeSensors = true
    runSensors(state)
    updateTriggers(state, scenario)
    expect(state.flags['civ-known']).toBe(true)
  })

  it('zničení civilistů ⇒ skrytý úkol selhal a výhra ho už nepřepíše', () => {
    const scenario = structuredClone(mission05)
    const state = toWave3(scenario)
    shipById(state, 9034)!.destroyed = true
    updateTriggers(state, scenario)
    expect(objState(state, 'obj-civ')).toBe('failed')
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'xo')).toBe(true)

    // výhra: vyřazení vlny 3 — obj-civ zůstává failed (complete nepřepisuje)
    for (const id of [9031, 9032, 9033]) shipById(state, id)!.destroyed = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-defend')).toBe('done')
    expect(objState(state, 'obj-civ')).toBe('failed')
  })

  it('výhra s živými civilisty: skrytý úkol splněn', () => {
    const scenario = structuredClone(mission05)
    const state = toWave3(scenario)
    // odhalení + přežití civilistů
    const civ = shipById(state, 9034)!
    state.ships[0].pos = { x: civ.pos.x, y: civ.pos.y + 3_000_000 }
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    for (const id of [9031, 9032, 9033]) shipById(state, id)!.destroyed = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-defend')).toBe('done')
    expect(objState(state, 'obj-civ')).toBe('done')
    expect(shipById(state, 9034)?.destroyed).toBe(false)
  })

  it('prohra: zničení stanice', () => {
    const scenario = structuredClone(mission05)
    const state = sim.create(scenario)
    state.ships[1].destroyed = true
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('lose')
  })
})

describe('mise 6 — Ústup od Tharsis', () => {
  it('hráč startuje poškozený a pomalejší než pronásledovatelé', () => {
    const state = sim.create(mission06)
    const p = state.ships[0]
    expect(p.hull).toBe(180) // z 300 — šrámy z prohraného střetnutí
    expect(p.subsystems.impellerAft).toBe(0.35)
    expect(p.subsystems.tubesPort).toBe(0.5)
    expect(p.subsystems.sidewallStbd).toBe(0.6)
    expect(p.vel.x).toBe(8_000)
    for (const i of [1, 2, 3]) {
      expect(state.ships[i].side).toBe('enemy')
      expect(state.ships[i].doctrine).toBe('hunter')
      expect(state.ships[i].vel.x).toBe(9_000) // dohánějí
      expect(state.ships[i].pos.x).toBeLessThan(-30_000_000)
    }
  })

  it('zvrat: „záchranná eskadra" spawne v t=1800 jako strana player', () => {
    const scenario = structuredClone(mission06)
    const state = sim.create(scenario)
    state.t = 1_800
    updateTriggers(state, scenario)
    const decoy1 = shipById(state, 9041)!
    const decoy2 = shipById(state, 9042)!
    expect(decoy1.name).toBe('ANS Vytrvalá')
    expect(decoy2.name).toBe('ANS Naděje')
    expect(decoy1.side).toBe('player')
    expect(decoy2.side).toBe('player')
    expect(state.events.some(e => e.kind === 'comm' && e.text.includes('40 ms mimo protokol'))).toBe(true)
  })

  it('léčka: přiblížení pod 12 mil. km přepne strany, vyčistí AUTO zámky a přestaví kontakty', () => {
    const scenario = structuredClone(mission06)
    const state = sim.create(scenario)
    state.t = 1_800
    updateTriggers(state, scenario)

    // pronásledovatel si (legitimně) zamkl „avalonský" křižník 9041
    const pursuer = state.ships[1]
    pursuer.fireControl.mode = 'auto'
    pursuer.fireControl.targetId = 9041

    // před léčkou: decoy je strana player — hráč ho NEMÁ v kontaktech
    runSensors(state)
    expect(contactsFor(state, 'player').some(c => c.shipId === 9041)).toBe(false)

    // hráč se přiblíží pod 12 mil. km ⇒ léčka
    const decoy1 = shipById(state, 9041)!
    state.ships[0].pos = { x: decoy1.pos.x - 10_000_000, y: decoy1.pos.y }
    updateTriggers(state, scenario)
    expect(state.flags['trap-sprung']).toBe(true)
    expect(decoy1.side).toBe('enemy')
    expect(shipById(state, 9042)?.side).toBe('enemy')
    expect(decoy1.doctrine).toBe('hunter')
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'enemy-captain')).toBe(true)

    // AUTO zámek pronásledovatele na (teď vlastní) loď je vyčištěný
    expect(pursuer.fireControl.targetId).toBeNull()
    expect(pursuer.fireControl.mode).toBe('hold')

    // updateSensors přirozeně přestaví kontakty: decoy je teď v picture hráče
    runSensors(state)
    expect(contactsFor(state, 'player').some(c => c.shipId === 9041)).toBe(true)
    expect(contactsFor(state, 'enemy').some(c => c.shipId === 9041)).toBe(false)
  })

  it('naivní přímý kurz k bóji vede do léčky (zvrat se v přímé hře opravdu spustí)', () => {
    const state = sim.create(mission06)
    sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1 })
    sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 190_000_000, y: 0 }, arriveAtRest: false })
    while (!state.flags['trap-sprung'] && state.outcome === 'running' && state.t < 7_000) {
      sim.tick(state, SIM_DT)
    }
    expect(state.flags['trap-sprung']).toBe(true)
    expect(shipById(state, 9041)?.side).toBe('enemy')
  })

  /**
   * DŮKAZ HRATELNOSTI: poškozená Resolute deterministicky doletí za
   * hyperlimit — obloukem přes +y se vyhne léčce (clearance > 12 mil. km),
   * záď kryje rolováním. Pronásledovatelé se drží hráče (sticky hunter),
   * ale polní opravy zadního prstence náskok udrží.
   */
  it('mise 6 je hratelná: oblouk kolem léčky + rolování ⇒ únik (E2E)', () => {
    const state = sim.create(mission06)
    const order = (o: Parameters<typeof sim.applyOrder>[1]): void => sim.applyOrder(state, o)

    order({ kind: 'setThrottle', shipId: 1, throttle: 1 })
    // fáze 1: stoupavý oblouk nad únikovou osu (léčka číhá pod ní);
    // cíl daleko vpředu, ať autopilot nebrzdí u průletového bodu
    order({ kind: 'setCourse', shipId: 1, dest: { x: 300_000_000, y: 60_000_000 }, arriveAtRest: false })
    let phase = 1
    let minGap = Infinity
    while (state.outcome === 'running' && state.t < 13_000) {
      sim.tick(state, SIM_DT)
      const p = state.ships[0]
      if (phase === 1 && p.vel.y > 3_000) {
        phase = 2 // fáze 2: plochý sestup k bóji (opět průletový cíl daleko za ní)
        order({ kind: 'setCourse', shipId: 1, dest: { x: 420_000_000, y: -20_000_000 }, arriveAtRest: false })
      }
      playerRollDefense(state)
      for (const i of [1, 2, 3]) {
        if (!state.ships[i].destroyed) minGap = Math.min(minGap, dist(p.pos, state.ships[i].pos))
      }
    }

    expect(state.flags['trap-sprung']).toBeUndefined() // léčce se vyhnul obloukem
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-escape')).toBe('done')
    expect(state.ships[0].destroyed).toBe(false)
    expect(minGap).toBeLessThan(32_000_000) // pronásledovatelé skutečně doháněli
  })
})

describe('mise 7 — Nájezd na konvoj', () => {
  it('zvrat: přiblížení k eskortnímu CL odpálí 24 raket z podů bez odečtu munice', () => {
    const scenario = structuredClone(mission07)
    const state = sim.create(scenario)
    const cl = shipById(state, 8)!
    const missilesBefore = cl.missiles

    // hráč vpluje do 9 mil. km od CL (8,5M — mimo dosah salv eskorty 5M)
    state.ships[0].pos = { x: cl.pos.x + 8_500_000, y: cl.pos.y }
    updateTriggers(state, scenario)

    // 24 raket z podů: strana enemy, střelec CL, munice CL nedotčená
    const pods = state.missiles.filter(m => m.shooterId === 8)
    expect(pods).toHaveLength(24)
    expect(pods.every(m => m.side === 'enemy' && m.targetId === 1)).toBe(true)
    expect(cl.missiles).toBe(missilesBefore) // pody neodečítají zásobníky
    expect(cl.tubeCooldown).toBe(0)          // ani nenabíjejí cooldown šachet
    const launchEvent = state.events.find(e => e.kind === 'launch' && e.text.includes('raketové pody'))
    expect(launchEvent).toBeDefined()
    expect(launchEvent?.count).toBe(24)
    expect(launchEvent?.slowdown).toBe(true)
    expect(state.events.some(e => e.kind === 'comm' && e.text.includes('překvapení'))).toBe(true)
  })

  it('výhra vyžaduje 3+ zničené obchodníky A únik k bóji (AND)', () => {
    const scenario = structuredClone(mission07)
    const state = sim.create(scenario)
    // jen únik bez zničených obchodníků nevyhrává
    state.ships[0].pos = { x: 158_000_000, y: 0 }
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('running')

    // 3 zničení obchodníci ⇒ úkol splněn; s hráčem u bóje ⇒ výhra
    for (const i of [1, 2, 3]) state.ships[i].destroyed = true
    updateTriggers(state, scenario) // flagy sunk
    updateTriggers(state, scenario) // trio ⇒ merch-3 + obj-merch
    updateTriggers(state, scenario) // výhra
    expect(objState(state, 'obj-merch')).toBe('done')
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-escape')).toBe('done')
  })

  /**
   * DŮKAZ HRATELNOSTI: Praporec deterministicky přežije saturační salvu
   * z podů, zničí tři obchodníky a unikne za hyperlimit. Taktika: řízené
   * sbližování s eskortou po brzdné křivce (malá zavírací rychlost = obrana
   * stíhá), po odpálení podů úhybný oblouk kolem pomalé eskorty na bok
   * konvoje, nálet na obchodníky zezadu (kilt) a široký únik k bóji.
   */
  it('mise 7 je hratelná: přežití podů + 3 obchodníci + únik (E2E)', () => {
    const state = sim.create(mission07)
    const order = (o: Parameters<typeof sim.applyOrder>[1]): void => sim.applyOrder(state, o)
    const MERCH = [2, 3, 4, 5]
    const ESCORTS = [6, 7, 8]
    const alive = (id: number) => {
      const s = shipById(state, id)
      return s && !s.destroyed && !s.surrendered ? s : undefined
    }
    const sunkCount = (): number => MERCH.filter(id => shipById(state, id)?.destroyed).length
    const nearestEscort = () => {
      let best: { s: NonNullable<ReturnType<typeof alive>>; d: number } | null = null
      for (const id of ESCORTS) {
        const s = alive(id)
        if (!s) continue
        const d = dist(state.ships[0].pos, s.pos)
        if (!best || d < best.d) best = { s, d }
      }
      return best
    }
    const podsFired = (): boolean =>
      state.events.some(e => e.kind === 'launch' && e.text.includes('raketové pody'))

    order({ kind: 'setThrottle', shipId: 1, throttle: 1 })
    order({ kind: 'setActiveSensors', shipId: 1, on: true })

    let phase: 'bait' | 'dogleg' | 'raid' | 'egress1' | 'egress2' = 'bait'
    let thrustMode = ''
    let raidTarget = -1
    let sawPods = false
    let podsSurvivedHull = 0
    while (state.outcome === 'running' && state.t < 45_000) {
      sim.tick(state, SIM_DT)
      const p = state.ships[0]
      if (p.destroyed) break
      const esc = nearestEscort()

      if (!sawPods && podsFired()) { sawPods = true; podsSurvivedHull = p.hull }
      // přechody fází
      if (phase === 'bait' && sawPods) {
        phase = 'dogleg'
        const m = alive(2) ?? alive(3) ?? alive(4) ?? alive(5)
        order({
          kind: 'setCourse', shipId: 1,
          dest: { x: (m ? m.pos.x : -20_000_000) - 5_000_000, y: (m ? m.pos.y : 0) - 30_000_000 },
          arriveAtRest: false,
        })
      }
      if (phase === 'dogleg' && esc && esc.d > 16_000_000) phase = 'raid'
      if (phase === 'raid' && sunkCount() >= 3) {
        phase = 'egress1'
        order({ kind: 'setCourse', shipId: 1, dest: { x: p.pos.x, y: p.pos.y - 120_000_000 }, arriveAtRest: false })
      }
      if (phase === 'egress1' && (!esc || esc.d > 25_000_000)) {
        phase = 'egress2'
        order({ kind: 'setCourse', shipId: 1, dest: { x: 160_000_000, y: 0 }, arriveAtRest: true })
      }

      if (phase === 'bait' && esc) {
        // brzdná křivka: zavírací rychlost pod odmocninovou mezí k pásmu 6,5M
        const dir = norm(sub(esc.s.pos, p.pos))
        const c = (p.vel.x - esc.s.vel.x) * dir.x + (p.vel.y - esc.s.vel.y) * dir.y
        const cTarget = Math.min(6_000, Math.sqrt(Math.max(0, 2 * 1.6 * (esc.d - 6_500_000))))
        const want = c > cTarget ? 'away' : 'toward'
        if (want !== thrustMode) {
          thrustMode = want
          const k = want === 'away' ? -400_000_000 : 400_000_000
          order({
            kind: 'setCourse', shipId: 1,
            dest: { x: p.pos.x + dir.x * k, y: p.pos.y + dir.y * k }, arriveAtRest: false,
          })
        }
      } else if (phase === 'raid') {
        let target: number | null = null
        let best = Infinity
        for (const id of MERCH) {
          const m = alive(id)
          if (!m) continue
          const d = dist(p.pos, m.pos)
          if (d < best) { best = d; target = id }
        }
        if (target !== null) {
          if (target !== raidTarget) {
            raidTarget = target
            order({ kind: 'intercept', shipId: 1, targetId: target })
          }
          const inFlight = state.missiles.some(m => m.side === 'player' && m.targetId === target)
          if (p.tubeCooldown <= 0 && best < 6_000_000 && !inFlight) {
            order({ kind: 'launchSalvo', shipId: 1, targetId: target, count: 10, mode: 0 })
          }
        }
      }
      playerRollDefense(state)
    }

    // pody skutečně vyletěly a hráč saturační salvu přežil
    expect(sawPods).toBe(true)
    expect(podsSurvivedHull).toBeGreaterThan(0)
    expect(state.ships[0].destroyed).toBe(false)
    expect(sunkCount()).toBeGreaterThanOrEqual(3)
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-merch')).toBe('done')
    expect(objState(state, 'obj-escape')).toBe('done')
  })
})

describe('mise 8 — Kaledonská hvězda', () => {
  it('kontakt: stěna přechází z tichého driftu do lovu', () => {
    const scenario = structuredClone(mission08)
    const state = sim.create(scenario)
    for (const i of [2, 3, 4]) expect(state.ships[i].doctrine).toBe('freighter')
    state.ships[0].pos = { x: 32_000_000, y: 4_000_000 } // < 30M od IDS Polaris
    updateTriggers(state, scenario)
    for (const i of [2, 3, 4]) expect(state.ships[i].doctrine).toBe('hunter')
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'enemy-captain')).toBe(true)
  })

  it('zvrat: první zničená loď stěny utrhne Claymore z formace', () => {
    const scenario = structuredClone(mission08)
    const state = sim.create(scenario)
    expect(state.ships[1].doctrine).toBe('escort')
    state.ships[2].destroyed = true
    updateTriggers(state, scenario) // flag claymore-breaks
    updateTriggers(state, scenario) // akce zvratu
    expect(state.flags['claymore-breaks']).toBe(true)
    expect(state.ships[1].doctrine).toBe('hunter')
    expect(objState(state, 'obj-claymore')).toBe('open')
    expect(state.events.some(e => e.kind === 'comm' && e.speaker === 'xo'
      && e.text.includes('odtrhl'))).toBe(true)
  })

  it('zvrat nastane i časem (t > 5400 s) bez jediného sestřelu', () => {
    const scenario = structuredClone(mission08)
    const state = sim.create(scenario)
    state.t = 5_400
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.ships[1].doctrine).toBe('hunter')
    expect(objState(state, 'obj-claymore')).toBe('open')
  })

  it('zničený Claymore ⇒ volitelný úkol selhal a výhra ho nepřepíše', () => {
    const scenario = structuredClone(mission08)
    const state = sim.create(scenario)
    state.ships[2].destroyed = true // zvrat
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    state.ships[1].destroyed = true // Claymore padl
    updateTriggers(state, scenario)
    expect(objState(state, 'obj-claymore')).toBe('failed')

    // výhra: zbytek stěny vyřazen — obj-claymore zůstává failed
    state.ships[3].destroyed = true
    state.ships[4].surrendered = true
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-wall')).toBe('done')
    expect(objState(state, 'obj-claymore')).toBe('failed')
  })

  it('Claymore zničený PŘED zvratem: úkol se po přidání dožene do failed', () => {
    const scenario = structuredClone(mission08)
    const state = sim.create(scenario)
    state.ships[1].destroyed = true // Claymore padl ještě před zvratem
    updateTriggers(state, scenario) // objectiveFail no-op (úkol neexistuje)
    expect(objState(state, 'obj-claymore')).toBeUndefined()

    state.ships[2].destroyed = true // zvrat přidá úkol
    updateTriggers(state, scenario)
    updateTriggers(state, scenario)
    updateTriggers(state, scenario) // once:false trigger ho dožene
    expect(objState(state, 'obj-claymore')).toBe('failed')
  })

  it('výhra s živým Claymorem: volitelný úkol splněn', () => {
    const scenario = structuredClone(mission08)
    const state = sim.create(scenario)
    for (const i of [2, 3, 4]) state.ships[i].destroyed = true
    updateTriggers(state, scenario) // flagy + zvrat flag
    updateTriggers(state, scenario) // zvrat akce + výhra
    expect(state.outcome).toBe('win')
    expect(objState(state, 'obj-wall')).toBe('done')
    expect(objState(state, 'obj-claymore')).toBe('done')
  })
})

describe('determinismus nových akcí (setSide, podSalvo, pevná id)', () => {
  it('dva nezávislé běhy mise 7 se stejnými rozkazy jsou bitově identické', () => {
    const run = (): SimState => {
      const state = sim.create(mission07)
      sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1 })
      sim.applyOrder(state, { kind: 'intercept', shipId: 1, targetId: 8 })
      // doleť k CL (spustí podSalvo trigger) a nech boj chvíli běžet
      for (let i = 0; i < 7_000; i++) sim.tick(state, SIM_DT)
      return state
    }
    const a = run()
    const b = run()
    // pody vyletěly — nové akce se skutečně vykonaly
    expect(a.events.some(e => e.kind === 'launch' && e.text.includes('raketové pody'))).toBe(true)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('dva nezávislé běhy léčky mise 6 (setSide) jsou bitově identické', () => {
    const run = (): SimState => {
      const state = sim.create(mission06)
      sim.applyOrder(state, { kind: 'setThrottle', shipId: 1, throttle: 1 })
      // přímý kurz = do léčky (setSide + hunter na obou stranách)
      sim.applyOrder(state, { kind: 'setCourse', shipId: 1, dest: { x: 190_000_000, y: 0 }, arriveAtRest: false })
      for (let i = 0; i < 12_000; i++) sim.tick(state, SIM_DT)
      return state
    }
    const a = run()
    const b = run()
    expect(a.flags['trap-sprung']).toBe(true) // léčka opravdu sklapla
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
