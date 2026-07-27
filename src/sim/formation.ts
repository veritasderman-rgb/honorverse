/**
 * Formace eskadry (jen hráčem ovladatelné lodě):
 *   - geometrie slotů v soustavě leaderova headingu (wall / vee / dispersed),
 *   - rozpad formace při ztrátě leadera (updateFormations, běží PŘED fyzikou),
 *   - taktické efekty: dotazy pro defense.ts (stěna, rozptyl) a weapons.ts (šíp).
 * Station-keeping samotný řeší physics.ts (formationHeading).
 */
import { L } from './lang'
import type { FormationKind, ShipState, SimState, Vec2 } from './types'
import {
  FORMATION_DISPERSED_SPACING, FORMATION_SPACING, FORMATION_VEE_SPACING,
} from './constants'
import { dist } from './vec'

/**
 * Lokální offset slotu (soustava leadera: +x = směr headingu, +y = levobok).
 * Sloty 1..n se střídají po stranách (1 vlevo, 2 vpravo, 3 dál vlevo…).
 *   wall — kolmá řada vedle leadera (rozestup FORMATION_SPACING),
 *   vee  — šíp za leaderem, křídla svírají 60° (rozestup FORMATION_VEE_SPACING),
 *   dispersed — mřížka 3 sloupců za leaderem (rozestup FORMATION_DISPERSED_SPACING).
 */
export function formationOffset(kind: FormationKind, slot: number): Vec2 {
  const k = Math.max(1, Math.floor(slot))
  const side = k % 2 === 1 ? 1 : -1
  const rank = Math.ceil(k / 2)
  switch (kind) {
    case 'wall':
      return { x: 0, y: side * rank * FORMATION_SPACING }
    case 'vee':
      // půlúhel křídla 30° od osy zádi → plný šíp 60°
      return {
        x: -Math.cos(Math.PI / 6) * rank * FORMATION_VEE_SPACING,
        y: side * Math.sin(Math.PI / 6) * rank * FORMATION_VEE_SPACING,
      }
    case 'dispersed': {
      const idx = k - 1
      const row = Math.floor(idx / 3) + 1
      const col = (idx % 3) - 1 // −1, 0, +1
      return { x: -row * FORMATION_DISPERSED_SPACING, y: col * FORMATION_DISPERSED_SPACING }
    }
  }
}

/** Světová pozice slotu: leader.pos + offset otočený do leaderova headingu. */
export function formationSlotPos(leader: ShipState, kind: FormationKind, slot: number): Vec2 {
  const o = formationOffset(kind, slot)
  const c = Math.cos(leader.heading)
  const s = Math.sin(leader.heading)
  return { x: leader.pos.x + o.x * c - o.y * s, y: leader.pos.y + o.x * s + o.y * c }
}

/** Živý leader formace lodi (null = žádná formace / leader pryč). */
export function formationLeader(state: SimState, ship: ShipState): ShipState | null {
  const f = ship.formation
  if (!f) return null
  const leader = state.ships.find(s => s.id === f.leaderId && !s.destroyed && !s.surrendered)
  return leader ?? null
}

/**
 * Id skupiny stěny, jejíž je loď účastníkem (id leadera), jinak null.
 * Účastník = člen s formation wall, NEBO leader, kterého nějaký člen stěny drží.
 */
function wallGroupId(state: SimState, ship: ShipState): number | null {
  if (ship.formation?.kind === 'wall') return ship.formation.leaderId
  if (state.ships.some(s => !s.destroyed && !s.surrendered
    && s.formation?.kind === 'wall' && s.formation.leaderId === ship.id)) return ship.id
  return null
}

/**
 * Disciplinovaná palebná síť stěny: loď je účastníkem stěny a jiný živý
 * účastník téže stěny je do FORMATION_SPACING × 1.5. Efekty (defense.ts):
 * Pk protiraket ×WALL_CM_PK_FACTOR, příchozí raketa −WALL_TERMINAL_LOCK_MALUS
 * zámku při terminále. Žádné čerpání rng.
 */
export function wallDiscipline(state: SimState, ship: ShipState): boolean {
  const gid = wallGroupId(state, ship)
  if (gid === null) return false
  for (const other of state.ships) {
    if (other.id === ship.id || other.destroyed || other.surrendered) continue
    const inGroup = other.id === gid
      || (other.formation?.kind === 'wall' && other.formation.leaderId === gid)
    if (inGroup && dist(ship.pos, other.pos) <= FORMATION_SPACING * 1.5) return true
  }
  return false
}

/** Člen rozptýlené formace s živým leaderem (+DISPERSED_ECM_BONUS v obraně). */
export function inDispersedFormation(state: SimState, ship: ShipState): boolean {
  return ship.formation?.kind === 'dispersed' && formationLeader(state, ship) !== null
}

/** Člen šípu s živým leaderem (sdílený senzorový obraz: +VEE_SOLUTION_BONUS). */
export function inVeeFormation(state: SimState, ship: ShipState): boolean {
  return ship.formation?.kind === 'vee' && formationLeader(state, ship) !== null
}

/**
 * Rozpad formací: členům se zničeným/kapitulovaným leaderem (nebo sami
 * kapitulovavším) formaci zruš; lodím hráče s hláškou XO. Volat PŘED fyzikou.
 */
export function updateFormations(state: SimState): void {
  for (const ship of state.ships) {
    if (!ship.formation || ship.destroyed) continue
    if (ship.surrendered) {
      ship.formation = null
      continue
    }
    const f = ship.formation
    const leader = state.ships.find(s => s.id === f.leaderId)
    if (!leader || leader.destroyed || leader.surrendered) {
      ship.formation = null
      if (ship.doctrine === 'player') {
        state.events.push({
          t: state.t, kind: 'message', shipId: ship.id, side: ship.side, speaker: 'xo',
          text: L(`${ship.name}: formace rozpuštěna — vlajková loď je pryč, přecházíme na samostatné manévrování.`, `${ship.name}: formation dissolved — the flagship is gone, going independent.`),
        })
      }
    }
  }
}
