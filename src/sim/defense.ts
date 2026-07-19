/**
 * Vrstvená obrana (GAME_DESIGN.md kap. 5), pořadí vrstev:
 *   1. ECM/decoye  2. protirakety (CM)  3. PDLC  4. klín/aspekt  5. detonace
 * Vrstvy 1–2 běží průběžně (updateDefenses), 3–5 v terminální fázi
 * (resolveTerminal). CM jsou abstraktní: intercept se vyhodnotí okamžitě
 * při odpalu — deterministické, žádné letící objekty navíc.
 */
import type { MissileState, ShipState, SimState, Vec2 } from './types'
import {
  C, CM_COOLDOWN, CM_INTERCEPT_RANGE, CM_PK, LOCK_LOST,
  PDLC_PK, PDLC_SATURATION, SATURATION_WINDOW,
} from './constants'
import { MISSILES, SHIP_CLASSES } from '../data/defs'
import { angleDiff, angleOf, dist, len, sub } from './vec'
import { rand } from './rng'
import { applyBeamDamage, type Aspect } from './damage'

/** Aspekt cíle při útoku z pozice fromPos (hrdlo ±0.5 rad, záď ±0.35 rad). */
export function attackAspect(target: ShipState, fromPos: Vec2): Aspect {
  const rel = angleDiff(angleOf(sub(fromPos, target.pos)), target.heading)
  if (Math.abs(rel) < 0.5) return 'throat'
  if (Math.abs(rel) > Math.PI - 0.35) return 'kilt'
  return rel > 0 ? 'port' : 'stbd' // y nahoru: kladný úhel od přídě = levobok
}

/** Průběžné vrstvy obrany: ECM/decoye a odpaly protiraket. */
export function updateDefenses(state: SimState, dt: number): void {
  // --- vrstva 1: ECM/decoye — eroze zámku poblíž cíle ---
  for (const m of state.missiles) {
    if (m.phase === 'dead') continue
    const target = state.ships.find(s => s.id === m.targetId)
    if (!target || target.destroyed) continue
    const tDef = SHIP_CLASSES[target.classId]
    if (dist(m.pos, target.pos) < tDef.activeSensorRange) {
      m.lock -= tDef.ecm * target.subsystems.ecm * 0.01 * dt
      if (m.lock < LOCK_LOST) {
        m.phase = 'dead'
        state.events.push({
          t: state.t, kind: 'missileMiss', side: m.side,
          text: 'raketa svedena ECM/decoyi — ztráta zámku',
        })
      }
    }
  }

  // --- vrstva 2: protirakety ---
  for (const ship of state.ships) {
    if (ship.destroyed || ship.cms <= 0) continue
    const def = SHIP_CLASSES[ship.classId]
    const rate = (def.cmLaunchers * ship.subsystems.cm) / CM_COOLDOWN // odpalů/s
    if (rate <= 0) continue

    // příchozí hrozby v interceptní obálce, nejbližší první (determinismus: tiebreak id)
    const incoming = state.missiles
      .filter(m => m.phase !== 'dead' && m.targetId === ship.id && m.side !== ship.side
        && dist(m.pos, ship.pos) < CM_INTERCEPT_RANGE)
      .map(m => ({ m, d: dist(m.pos, ship.pos) }))
      .sort((a, b) => a.d - b.d || a.m.id - b.m.id)
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
          t: state.t, kind: 'missileKilled', shipId: ship.id, side: ship.side,
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
  const pdlcPk = PDLC_PK / (1 + PDLC_SATURATION * (nWindow - 1))
  const vClose = len(sub(missile.vel, target.vel))
  const cFrac = vClose / C
  const window = cFrac <= 0.1 ? 1 : cFrac >= 0.5 ? 1 / 3 : 1 - ((cFrac - 0.1) / 0.4) * (2 / 3)
  const clusters = Math.floor(tDef.pdlcClusters * target.subsystems.pdlc * window)
  for (let i = 0; i < clusters; i++) {
    if (rand(state.rng) < pdlcPk) {
      state.events.push({
        t: state.t, kind: 'missileKilled', shipId: target.id, side: target.side,
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
          t: state.t, kind: 'missileKilled', shipId: target.id, side: target.side,
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
      t: state.t, kind: 'missileMiss', side: missile.side,
      text: 'laserová hlavice detonovala mimo — žádný zásah',
    })
    return
  }
  state.events.push({
    t: state.t, kind: 'missileHit', shipId: target.id, side: target.side,
    text: `${target.name}: zásah laserovou hlavicí (${hits}× paprsek, ${aspect})`,
  })
  for (let i = 0; i < hits; i++) {
    applyBeamDamage(state, target, mDef.rodDamage, aspect)
  }
}
