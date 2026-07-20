/**
 * Odhad průniku salvy PŘED odpalem (transparentnost pro hráče).
 * Hrubý DETERMINISTICKÝ model stejné pipeline jako sim (fireSolution →
 * ECM eroze se dnem → očekávané CM intercepty → PDLC se saturací →
 * detonace hlavice): vrací očekávaný počet pronikších raket a český
 * rozpad („CM ~9 · PDLC ~3 · ECM ~2 → projde ~2/16"). Není to slib —
 * skutečnost závisí na náhodě, manévrech a obraně cíle za letu.
 */
import type { DriveMode, ShipState, SimState } from './types'
import {
  ACTIVE_GUIDANCE_ECM_FACTOR, C, CM_COOLDOWN, CM_INTERCEPT_RANGE, CM_PK,
  CM_REACTION_TIME, CM_SHOTS_PER_MISSILE,
  CONTROL_RANGE, G, LOCK_FLOOR, LOCK_FLOOR_GUIDED, LOCK_LOST,
  MISSILE_QUALITY_LOCK_CAP, PDLC_PK,
  PDLC_ROLLED_FACTOR, PDLC_SATURATION,
} from './constants'
import { MISSILES, SHIP_CLASSES } from '../data/defs'
import { dist, dot, norm, sub } from './vec'
import { BALLISTIC_LOCK_DECAY, fireSolution, missileFlightTime } from './weapons'
import { pdlcReadiness } from './defense'

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

/** „~2" / „~0,4" — malé hodnoty s desetinou, jinak celé číslo */
const fmtN = (x: number): string =>
  x > 0 && x < 0.95 ? `~${x.toFixed(1).replace('.', ',')}` : `~${Math.round(x)}`

export interface PenetrationEstimate {
  /** očekávaný počet raket, které detonují se zásahem */
  through: number
  /** český rozpad vrstev obrany, např. „CM ~9 · PDLC ~3 · ECM ~2 → projde ~2/16" */
  breakdown: string
}

/**
 * Odhad průniku salvy `count` raket (režim `mode`) střelce na cíl.
 * Čistá funkce — nečerpá RNG, nemutuje stav.
 */
export function estimatePenetration(
  state: SimState, shooter: ShipState, target: ShipState, count: number, mode: DriveMode,
): PenetrationEstimate {
  if (count <= 0 || target.destroyed) {
    return { through: 0, breakdown: `projde ~0/${Math.max(0, count)}` }
  }
  const mDef = MISSILES['std-shipkiller']
  const tDef = SHIP_CLASSES[target.classId]
  const sDef = SHIP_CLASSES[shooter.classId]

  const d = dist(shooter.pos, target.pos)
  const dir = norm(sub(target.pos, shooter.pos))
  const closing = dot(sub(shooter.vel, target.vel), dir)
  const tFlight = missileFlightTime(d, closing, mode)
  if (!Number.isFinite(tFlight)) {
    return { through: 0, breakdown: `mimo dosah — balisticky nedoletí (projde ~0/${count})` }
  }

  /** doba letu POSLEDNÍHO úseku dlouhého `range` km před cílem */
  const tailTime = (range: number): number =>
    d <= range ? tFlight : tFlight - missileFlightTime(d - range, closing, mode)

  // --- zámek: palebné řešení × kvalita raket třídy − ECM eroze − balistika ---
  const lockBonus = state.t < shooter.buffs.lockUntil ? shooter.buffs.lockBonus : 0
  const quality = sDef?.missileQuality ?? 1
  const lock0 = Math.min(fireSolution(state, shooter, target) * quality,
    MISSILE_QUALITY_LOCK_CAP) + lockBonus
  const activeGuidance = shooter.activeSensors && !!sDef && d < sDef.activeSensorRange
  const ecmFactor = activeGuidance ? ACTIVE_GUIDANCE_ECM_FACTOR : 1
  const tEcm = tailTime(tDef.activeSensorRange)
  let erosion = tDef.ecm * target.subsystems.ecm * 0.01 * ecmFactor * tEcm
  const T = mDef.driveTime[mode]
  if (tFlight > T) erosion += BALLISTIC_LOCK_DECAY * (tFlight - T)
  // dno eroze: řízená salva s aktivy 0.4, jinak seeker 0.3 (posádky se propálí)
  const floor = shooter.activeSensors && d < CONTROL_RANGE ? LOCK_FLOOR_GUIDED : LOCK_FLOOR
  const lockEnd = Math.max(lock0 - erosion, Math.min(lock0, floor))

  // --- vrstva CM: kadence × čas v obálce × Pk; odpaly omezuje munice
  // a interceptní budget — floor(celkový čas letu / CM_REACTION_TIME)
  // pokusů na raketu (odpal je vidět FTL — reakce běží od odpalu), strop
  // „dva výstřely na cíl" (CM_SHOTS_PER_MISSILE). Salva zblízka nechá
  // obraně čas na jediný pokus, extrémně zblízka na žádný ---
  const cmRate = (tDef.cmLaunchers * target.subsystems.cm) / CM_COOLDOWN
  const tCm = tailTime(CM_INTERCEPT_RANGE)
  const shotsCap = Math.max(0,
    Math.min(CM_SHOTS_PER_MISSILE, Math.floor(tFlight / CM_REACTION_TIME)))
  const cmLaunches = Math.min(
    cmRate * tCm,
    target.cms,
    count * shotsCap,
  )
  // očekávané zásahy při rovnoměrném rozdělení pokusů: 1−(1−Pk)^(pokusy/raketa)
  const shotsPer = count > 0 ? cmLaunches / count : 0
  const cmKills = count * (1 - Math.pow(1 - CM_PK, shotsPer))
  const afterCm = count - cmKills

  // --- vrstva PDLC: okno dle rychlosti přiblížení + saturace celou salvou ---
  const vArrival = Math.min(mDef.maxSpeed, closing + mDef.accelG[mode] * G * Math.min(tFlight, T))
  const cFrac = Math.max(0, vArrival) / C
  const window = cFrac <= 0.1 ? 1 : cFrac >= 0.5 ? 0.55 : 1 - ((cFrac - 0.1) / 0.4) * 0.45
  const rolledFactor = target.rolledTo !== null ? PDLC_ROLLED_FACTOR : 1
  // reakční čas PDLC: krátký let salvy = nepřipravená obrana (pdlcReadiness)
  const clusters = Math.floor(
    tDef.pdlcClusters * target.subsystems.pdlc * window * rolledFactor * pdlcReadiness(tFlight))
  const pdlcPk = PDLC_PK / (1 + PDLC_SATURATION * Math.max(0, afterCm - 1))
  const pdlcSurvive = Math.pow(1 - pdlcPk, Math.max(0, clusters))
  const pdlcKills = afterCm * (1 - pdlcSurvive)
  const afterPdlc = afterCm - pdlcKills

  // --- detonace: šance aspoň jednoho zásahu paprsku (zbytek = ECM/hlavice mimo) ---
  const pHit = lockEnd < LOCK_LOST ? 0 : 1 - Math.pow(1 - clamp01(lockEnd), mDef.laserRods)
  const through = afterPdlc * pHit
  const ecmDud = afterPdlc - through

  const breakdown = `CM ${fmtN(cmKills)} · PDLC ${fmtN(pdlcKills)} · ECM ${fmtN(ecmDud)}`
    + ` → projde ${fmtN(through)}/${count}`
  return { through, breakdown }
}
