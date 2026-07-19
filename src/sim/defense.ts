/**
 * Vrstvená obrana (GAME_DESIGN.md kap. 5), pořadí vrstev:
 *   1. ECM/decoye  2. protirakety (CM)  3. PDLC  4. klín/aspekt  5. detonace
 * Vrstvy 1–2 běží průběžně (updateDefenses), 3–5 v terminální fázi
 * (resolveTerminal). CM jsou abstraktní: intercept se vyhodnotí okamžitě
 * při odpalu — deterministické, žádné letící objekty navíc.
 */
import type { MissileState, ShipState, SimState, Vec2 } from './types'
import {
  ACTIVE_GUIDANCE_ECM_FACTOR, C, CM_COOLDOWN, CM_INTERCEPT_RANGE, CM_PK,
  CONTROL_RANGE, DECOY_SEDUCE_BASE, LOCK_FLOOR, LOCK_FLOOR_GUIDED,
  LOCK_LOST, PDLC_JAMMER_FACTOR, PDLC_PK, PDLC_ROLLED_FACTOR, PDLC_SATURATION,
  SATURATION_WINDOW,
} from './constants'
import { MISSILES, SHIP_CLASSES } from '../data/defs'
import { angleDiff, angleOf, dist, len, sub } from './vec'
import { rand } from './rng'
import { applyBeamDamage, type Aspect } from './damage'
import { voiceEnemyHit } from './voice'

/**
 * Dno eroze zámku rakety („posádky se ECM propálí"):
 *   LOCK_FLOOR_GUIDED (0.4) s aktivním řídicím spojem (řízená salva, střelec
 *       žije, v CONTROL_RANGE, střelec svítí aktivními senzory),
 *   LOCK_FLOOR (0.3) s funkčním vlastním seekerem (fáze boost/terminal),
 *   0 = balistický dojezd bez spoje — eroduje dál (pomalu) až k LOCK_LOST.
 * Dno erozi jen zastavuje — zámek už pod dnem se nikdy NEzvedá.
 */
export function lockFloor(state: SimState, m: MissileState): number {
  if (m.shooterId !== undefined && m.autonomous !== true) {
    const shooter = state.ships.find(s => s.id === m.shooterId && !s.destroyed)
    if (shooter && shooter.activeSensors && dist(shooter.pos, m.pos) < CONTROL_RANGE) {
      return LOCK_FLOOR_GUIDED
    }
  }
  if (m.phase === 'boost' || m.phase === 'terminal') return LOCK_FLOOR
  return 0
}

/** aplikuje erozi zámku se dnem: neklesne pod floor, ale ani se k němu nezvedá */
export function erodeLock(state: SimState, m: MissileState, amount: number): void {
  const floor = Math.min(m.lock, lockFloor(state, m))
  m.lock = Math.max(m.lock - amount, floor)
}

/** Aspekt cíle při útoku z pozice fromPos (hrdlo ±0.5 rad, záď ±0.35 rad). */
export function attackAspect(target: ShipState, fromPos: Vec2): Aspect {
  const rel = angleDiff(angleOf(sub(fromPos, target.pos)), target.heading)
  if (Math.abs(rel) < 0.5) return 'throat'
  if (Math.abs(rel) > Math.PI - 0.35) return 'kilt'
  return rel > 0 ? 'port' : 'stbd' // y nahoru: kladný úhel od přídě = levobok
}

/**
 * Vypuštění tažené návnady: aktivní, DOKUD ji svedená raketa nezničí
 * (jedna návnada ≈ jedna pohlcená raketa). Zásoba se odečítá až zničením;
 * po ztrátě lze hned vypustit další — žádný cooldown.
 */
export function deployDecoy(state: SimState, ship: ShipState): void {
  if (ship.destroyed || ship.surrendered) return
  const say = (text: string): void => {
    if (ship.doctrine !== 'player') return
    state.events.push({
      t: state.t, kind: 'message', shipId: ship.id, side: ship.side,
      speaker: 'tactical', text,
    })
  }
  if (ship.decoys <= 0) {
    say('Zásobník návnad prázdný!')
    return
  }
  if (ship.decoyActive) {
    say('Návnada už je za lodí.')
    return
  }
  ship.decoyActive = true
  // nová návnada = nový pokus o svedení i pro rakety, které už testem prošly
  for (const m of state.missiles) {
    if (m.targetId === ship.id && m.decoyChecked === true) m.decoyChecked = false
  }
  say(`Návnada vypuštěna — táhne se za lodí (zásoba ${ship.decoys}).`)
}

/** Průběžné vrstvy obrany: ECM/decoye a odpaly protiraket. */
export function updateDefenses(state: SimState, dt: number): void {
  // --- vrstva 1: ECM/decoye — eroze zámku poblíž cíle ---
  for (const m of state.missiles) {
    if (m.phase === 'dead') continue
    const target = state.ships.find(s => s.id === m.targetId)
    if (!target || target.destroyed) continue
    const tDef = SHIP_CLASSES[target.classId]

    // tažená návnada: raketa v CM pásmu s aktivní návnadou cíle projde
    // JEDNÍM testem svedení — P = DECOY_SEDUCE_BASE · (0.5 + ecm třídy)
    // · (1 − lock/2); kvalitní elektronika a slabý zámek svádějí líp.
    // Svedená raketa se odkloní NA návnadu a ZNIČÍ ji (decoys--).
    if (target.decoyActive && m.decoyChecked !== true
      && dist(m.pos, target.pos) < CM_INTERCEPT_RANGE) {
      m.decoyChecked = true
      const p = DECOY_SEDUCE_BASE * (0.5 + tDef.ecm)
        * (1 - Math.min(1, Math.max(0, m.lock)) / 2)
      if (rand(state.rng) < p) {
        m.phase = 'dead'
        target.decoys = Math.max(0, target.decoys - 1)
        target.decoyActive = false
        state.events.push({
          t: state.t, kind: 'missileMiss', side: m.side, shipId: target.id,
          cause: 'decoy', salvoId: m.salvoId,
          text: `${target.name}: raketa svedena — návnada zničena`,
        })
        continue
      }
    }

    if (dist(m.pos, target.pos) < tDef.activeSensorRange) {
      // aktivní vedení: střelec s aktivními senzory a cílem v jejich dosahu
      // drží track — ECM eroduje zámek řízené salvy pomaleji (×0.6)
      let ecmFactor = 1
      if (m.shooterId !== undefined && m.autonomous !== true) {
        const shooter = state.ships.find(s => s.id === m.shooterId && !s.destroyed)
        const sDef = shooter ? SHIP_CLASSES[shooter.classId] : undefined
        if (shooter && sDef && shooter.activeSensors
          && dist(shooter.pos, target.pos) < sDef.activeSensorRange) {
          ecmFactor = ACTIVE_GUIDANCE_ECM_FACTOR
        }
      }
      // eroze se dnem: řízené/naváděné rakety ECM nikdy nevymaže úplně
      erodeLock(state, m, tDef.ecm * target.subsystems.ecm * 0.01 * ecmFactor * dt)
      if (m.lock < LOCK_LOST) {
        m.phase = 'dead'
        state.events.push({
          t: state.t, kind: 'missileMiss', side: m.side, shipId: target.id,
          cause: 'ecm', salvoId: m.salvoId,
          text: 'raketa svedena ECM/decoyi — ztráta zámku',
        })
      }
    }
  }

  // --- vrstva 2: protirakety (kapitulovaná loď se nebrání — složila zbraně) ---
  // OBLASTNÍ OBRANA: loď zachytává i rakety mířící na SPŘÁTELENÉ lodě, pokud
  // raketa proletí její interceptní obálkou — eskorta tak kryje konvoj
  // „protiraketovým deštníkem" (vlastní obrana má vždy přednost).
  const sideOf = new Map(state.ships.map(s => [s.id, s.side]))
  for (const ship of state.ships) {
    if (ship.destroyed || ship.surrendered || ship.cms <= 0) continue
    const def = SHIP_CLASSES[ship.classId]
    const rate = (def.cmLaunchers * ship.subsystems.cm) / CM_COOLDOWN // odpalů/s
    if (rate <= 0) continue

    // příchozí hrozby v interceptní obálce: nejdřív vlastní, pak chráněnci;
    // uvnitř skupiny nejbližší první (determinismus: tiebreak id)
    const incoming = state.missiles
      .filter(m => m.phase !== 'dead' && m.side !== ship.side
        && (m.targetId === ship.id || sideOf.get(m.targetId) === ship.side)
        && dist(m.pos, ship.pos) < CM_INTERCEPT_RANGE)
      .map(m => ({ m, d: dist(m.pos, ship.pos), self: m.targetId === ship.id ? 0 : 1 }))
      .sort((a, b) => a.self - b.self || a.d - b.d || a.m.id - b.m.id)
    if (incoming.length === 0) continue

    // budget odpalů za tick: celočíselná část + stochastické zaokrouhlení
    // (nahrazuje cooldown per loď — ShipState nemá kde nést CM cooldown)
    const budget = rate * dt
    let n = Math.floor(budget)
    if (rand(state.rng) < budget - n) n++
    n = Math.min(n, ship.cms, incoming.length)

    for (let i = 0; i < n; i++) {
      ship.cms--
      const threat = incoming[i].m
      if (rand(state.rng) < CM_PK) {
        threat.phase = 'dead'
        state.events.push({
          // side = strana RAKETY (statistika), shipId = bránící se loď
          t: state.t, kind: 'missileKilled', shipId: ship.id, side: threat.side,
          cause: 'cm', salvoId: threat.salvoId,
          text: `${ship.name}: protiraketa zničila útočnou raketu`,
        })
      }
    }
  }

  // úklid mrtvých raket
  if (state.missiles.some(m => m.phase === 'dead')) {
    state.missiles = state.missiles.filter(m => m.phase !== 'dead')
  }
}

/**
 * Terminální fáze: PDLC → klín/aspekt → detonace laserové hlavice.
 * Raketa je po vyhodnocení vždy spotřebovaná (phase 'dead').
 */
export function resolveTerminal(state: SimState, missile: MissileState, target: ShipState): void {
  const mDef = MISSILES[missile.def]
  const tDef = SHIP_CLASSES[target.classId]
  missile.phase = 'dead'

  // --- vrstva 3: PDLC — okno střelby se zavírá s rychlostí přiblížení ---
  // saturace: n-tá raketa v okně SATURATION_WINDOW s na týž cíl přetěžuje
  // clustery — Pk klesá faktorem 1/(1 + PDLC_SATURATION·(n−1))
  target.terminalTimes = target.terminalTimes.filter(t => t > state.t - SATURATION_WINDOW)
  target.terminalTimes.push(state.t)
  const nWindow = target.terminalTimes.length
  // eskortní rušička salvy oslepuje bodovou obranu: Pk ×0.75
  const jammerFactor = missile.jammerEscort === true ? PDLC_JAMMER_FACTOR : 1
  const pdlcPk = (PDLC_PK * jammerFactor) / (1 + PDLC_SATURATION * (nWindow - 1))
  const vClose = len(sub(missile.vel, target.vel))
  const cFrac = vClose / C
  const window = cFrac <= 0.1 ? 1 : cFrac >= 0.5 ? 1 / 3 : 1 - ((cFrac - 0.1) / 0.4) * (2 / 3)
  // odvalená loď: klín cloní i části vlastních clusterů (×0.6)
  const rolledFactor = target.rolledTo !== null ? PDLC_ROLLED_FACTOR : 1
  const clusters = Math.floor(tDef.pdlcClusters * target.subsystems.pdlc * window * rolledFactor)
  for (let i = 0; i < clusters; i++) {
    if (rand(state.rng) < pdlcPk) {
      state.events.push({
        // side = strana RAKETY (statistika), shipId = bránící se loď
        t: state.t, kind: 'missileKilled', shipId: target.id, side: missile.side,
        cause: 'pdlc', salvoId: missile.salvoId,
        text: `${target.name}: bodová obrana sestřelila raketu`,
      })
      return
    }
  }

  // --- vrstva 4: interponovaný klín ---
  if (target.rolledTo !== null) {
    const approach = angleOf(sub(missile.pos, target.pos))
    if (Math.abs(angleDiff(approach, target.rolledTo)) < 1.2) {
      if (rand(state.rng) < 0.7) {
        state.events.push({
          t: state.t, kind: 'missileKilled', shipId: target.id, side: missile.side,
          cause: 'wedge', salvoId: missile.salvoId,
          text: `${target.name}: raketa se roztříštila o klín`,
        })
        return
      }
      missile.lock *= 0.4 // nouzový oblet — mizerné řešení pro detonaci
    }
  }

  // --- vrstva 5: detonace laserové hlavice ve standoff vzdálenosti ---
  const aspect = attackAspect(target, missile.pos)
  let hits = 0
  for (let i = 0; i < mDef.laserRods; i++) {
    if (rand(state.rng) < missile.lock) hits++
  }
  if (hits <= 0) {
    state.events.push({
      t: state.t, kind: 'missileMiss', side: missile.side, shipId: target.id,
      cause: 'dud', salvoId: missile.salvoId,
      text: 'laserová hlavice detonovala mimo — žádný zásah',
    })
    return
  }
  state.events.push({
    // side = strana RAKETY (statistika i SFX), shipId = zasažená loď
    t: state.t, kind: 'missileHit', shipId: target.id, side: missile.side, salvoId: missile.salvoId,
    // zásah do lodi hráče je důležitá událost (UI auto-zpomalení)
    slowdown: target.side === 'player',
    text: `${target.name}: zásah laserovou hlavicí (${hits}× paprsek, ${aspect})`,
  })
  // hláska taktického: pozorovaný zásah nepřítele (jednou na cíl)
  if (missile.side === 'player') voiceEnemyHit(state, target)
  for (let i = 0; i < hits; i++) {
    applyBeamDamage(state, target, mDef.rodDamage, aspect)
  }
}
