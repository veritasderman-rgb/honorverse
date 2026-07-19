/**
 * Útočné zbraně: raketové salvy, let a navádění raket, energetická palba.
 * Éra jednostupňových raket (knihy 1–6) — jediný typ hlavice (std-shipkiller).
 * Nově: poháněná obálka (poweredEnvelope), odhad doletu (missileFlightTime)
 * a česká zpětná vazba rozkazů hráče (event 'message', speaker 'tactical').
 */
import type { DriveMode, MissileState, ShipState, SimState, Vec2 } from './types'
import {
  AUTONOMOUS_LOCK_FACTOR, CONTROL_RANGE, ENERGY_COOLDOWN, ENERGY_DECISIVE_RANGE,
  ENERGY_MAX_RANGE, G, JAMMER_MIN_SALVO, LINK_LOCK_DECAY, LOCK_LOST,
  RETARGET_LOCK_PENALTY, ROLL_TIME,
  SOLUTION_EMITTING_BONUS, SOLUTION_PASSIVE, SOLUTION_TRACK_BONUS, TUBE_COOLDOWN,
  VEE_SOLUTION_BONUS,
} from './constants'
import { MISSILES, SHIP_CLASSES } from '../data/defs'
import { add, angleOf, clampLen, dist, dot, len, norm, scale, sub } from './vec'
import { applyBeamDamage, effectiveTubes } from './damage'
import { attackAspect, erodeLock, resolveTerminal } from './defense'
import { inVeeFormation } from './formation'
import { voiceIncomingSalvo } from './voice'

const DEFAULT_MISSILE = 'std-shipkiller'

/**
 * Pokles zámku za letu bez pohonu (balistika) — ~0.005/s.
 * (Vyvážení senzorového duelu: startovní zámek je nově 0.7–1.0 dle palebného
 * řešení, dřívějších 0.01/s by dlouhé balistické dojezdy — HI vlna vrstvené
 * salvy — zabíjelo ještě před příletem.)
 */
export const BALLISTIC_LOCK_DECAY = 0.005

/** formát mil. km s českou čárkou („7,2") */
const fmtMkm = (km: number): string => (km / 1e6).toFixed(1).replace('.', ',')

/**
 * Poháněná obálka rakety: dosah poháněného letu vůči cíli — dráha pohonu
 * plus příspěvek aktuálního relativního vektoru lodi k cíli (odpal „po
 * směru" dostřel natahuje, odpal „přes rameno" zkracuje).
 */
export function poweredEnvelope(
  pos: Vec2, vel: Vec2, targetPos: Vec2, targetVel: Vec2, mode: DriveMode,
): number {
  const def = MISSILES[DEFAULT_MISSILE]
  const a = def.accelG[mode] * G
  const T = def.driveTime[mode]
  const rel = sub(targetPos, pos)
  const d = len(rel)
  const dir = d > 0 ? scale(rel, 1 / d) : { x: 1, y: 0 }
  const closing = dot(sub(vel, targetVel), dir) // relativní přibližovací rychlost
  return Math.max(0, closing * T + 0.5 * a * T * T)
}

/**
 * Odhad doby doletu rakety na vzdálenost d při dané přibližovací rychlosti:
 * poháněná fáze (konst. akcelerace do vyhoření), pak balistika konstantní
 * rychlostí. Infinity = balisticky nikdy nedoletí (vzdaluje se).
 */
export function missileFlightTime(d: number, closing: number, mode: DriveMode): number {
  if (d <= 0) return 0
  const def = MISSILES[DEFAULT_MISSILE]
  const a = def.accelG[mode] * G
  const T = def.driveTime[mode]
  // poháněná fáze: closing·t + ½·a·t² = d
  const disc = closing * closing + 2 * a * d
  const tPow = (-closing + Math.sqrt(disc)) / a
  if (tPow <= T) return tPow
  // balistický dojezd rychlostí z vyhoření
  const dBurn = closing * T + 0.5 * a * T * T
  const vBurn = closing + a * T
  if (vBurn <= 0) return Infinity
  return T + (d - dBurn) / vBurn
}

interface LaunchOpts {
  /** druhá vlna vrstvené salvy — šachty už jsou přednabité, cooldown neblokuje */
  ignoreCooldown?: boolean
  /** autonomní salva (fire-and-forget): počáteční zámek ×0.85, ale bez řídicího spoje */
  autonomous?: boolean
  /**
   * odpal z raketových podů (zvrat mise 7): obchází kapacitu šachet
   * i zásobníky lodi (munice se NEodečítá) a nenabíjí cooldown šachet;
   * pody visí mimo trup — odpal funguje i z odvalené lodi
   */
  podLaunch?: boolean
  /**
   * ECM doprovod salvy: 1 raketa se obětuje jako eskortní rušička (útočí
   * count−1), zbytek salvy má proti PDLC cíle Pk ×PDLC_JAMMER_FACTOR.
   * Vyžaduje salvu aspoň JAMMER_MIN_SALVO raket.
   */
  escortJammer?: boolean
  /**
   * odpal jen z konkrétního boku (dvojitá boční salva): kapacita se počítá
   * POUZE ze šachet daného boku (tubesPort/tubesStbd), ne z lepšího z obou
   */
  side?: 'port' | 'stbd'
}

/** funkční šachty JEDNOHO boku (floor) */
function sideTubes(ship: ShipState, side: 'port' | 'stbd'): number {
  const def = SHIP_CLASSES[ship.classId]
  const sub = side === 'port' ? ship.subsystems.tubesPort : ship.subsystems.tubesStbd
  return Math.floor(def.tubesPerBroadside * sub)
}


/**
 * Kvalita palebného řešení střelec→cíl = počáteční zámek odpalovaných raket:
 *   0.7  jen z pasivních dat,
 *   1.0  s aktivními senzory střelce a cílem v jejich dosahu,
 *   +0.15 když cíl sám vyzařuje (jeho aktivní senzory = maják, bez ohledu na dosah),
 *   +0.1  za kvalitní track (kontakt strany s idQuality 2),
 *   × (0.7–1.0) dle stavu subsystému senzorů střelce, cap 1.0.
 * SYMETRICKÉ pro hráče i AI (launchSalvo ji volá pro každý odpal).
 */
export function fireSolution(state: SimState, shooter: ShipState, target: ShipState): number {
  const def = SHIP_CLASSES[shooter.classId]
  const activeTrack = !!def && shooter.activeSensors
    && dist(shooter.pos, target.pos) < def.activeSensorRange
  let q = activeTrack ? 1.0 : SOLUTION_PASSIVE
  if (target.activeSensors) q += SOLUTION_EMITTING_BONUS
  if (state.contacts[shooter.side]?.some(c => c.shipId === target.id && c.idQuality === 2)) {
    q += SOLUTION_TRACK_BONUS
  }
  // šíp (vee): členové sdílejí nejlepší senzorový obraz eskadry
  if (inVeeFormation(state, shooter)) q += VEE_SOLUTION_BONUS
  q *= 0.7 + 0.3 * Math.min(1, Math.max(0, shooter.subsystems.sensors))
  return Math.min(1, q)
}

/** hláška posádky hráči (jen lodě ovládané hráčem — AI si nestěžuje) */
function crewSay(state: SimState, ship: ShipState, text: string): void {
  if (ship.doctrine !== 'player') return
  state.events.push({ t: state.t, kind: 'message', shipId: ship.id, side: ship.side, speaker: 'tactical', text })
}

/** Odpal salvy: omezena šachtami, municí a cooldownem; no-op hlásí důvod. */
export function launchSalvo(
  state: SimState,
  ship: ShipState,
  targetId: number,
  count: number,
  mode: DriveMode,
  opts: LaunchOpts = {},
): void {
  if (ship.destroyed) return
  // odvalená loď nemůže pálit boky — klín kryje, ale i maskuje vlastní zbraně
  // (pody visí mimo trup, těch se roll netýká)
  if (ship.rolledTo !== null && !opts.podLaunch) {
    crewSay(state, ship, 'Jsme odvalení — boky kryje klín, palba nemožná.')
    return
  }
  if (ship.tubeCooldown > 0 && !opts.ignoreCooldown) {
    crewSay(state, ship, `Šachty přebíjejí — další salva za ${Math.ceil(ship.tubeCooldown)} s.`)
    return
  }
  // pody: vlastní odpalovače mimo šachty — kapacita ani munice lodi neomezují;
  // opts.side: kapacita jen z jednoho boku (dvojitá boční salva)
  const capacity = opts.side ? sideTubes(ship, opts.side) : effectiveTubes(ship)
  const n = opts.podLaunch ? count : Math.min(count, capacity, ship.missiles)
  if (n <= 0) {
    crewSay(state, ship, ship.missiles <= 0
      ? 'Prázdné zásobníky raket!'
      : 'Všechny raketové šachty vyřazeny!')
    return
  }
  // ECM doprovod: 1 raketa se obětuje jako rušička — jen u salvy ≥ 3 raket
  const jammer = opts.escortJammer === true
  if (jammer && n < JAMMER_MIN_SALVO) {
    crewSay(state, ship,
      `Eskortní rušička potřebuje salvu aspoň ${JAMMER_MIN_SALVO} raket — odpal zrušen.`)
    return
  }

  // varování: cíl mimo poháněnou obálku (odpal projde — rakety doletí balisticky)
  const target = state.ships.find(s => s.id === targetId && !s.destroyed)
  if (target && ship.doctrine === 'player') {
    const d = dist(ship.pos, target.pos)
    const env = poweredEnvelope(ship.pos, ship.vel, target.pos, target.vel, mode)
    if (d > env) {
      crewSay(state, ship,
        `Cíl mimo poháněnou obálku (${fmtMkm(d)} mil. km, dosah ${fmtMkm(env)}) — rakety dojedou balisticky.`)
    }
  }

  const def = MISSILES[DEFAULT_MISSILE]
  // buff taktického důstojníka: lepší palebné řešení = vyšší počáteční zámek
  const lockBonus = state.t < ship.buffs.lockUntil ? ship.buffs.lockBonus : 0
  // senzorový duel: počáteční zámek = kvalita palebného řešení (0.7–1.0)
  const autonomous = opts.autonomous === true
  const solution = target ? fireSolution(state, ship, target) : 1.0
  const lock0 = solution * (autonomous ? AUTONOMOUS_LOCK_FACTOR : 1) + lockBonus
  const salvoId = state.nextId++
  // s rušičkou útočí n−1 raket (jedna letí jako jammer — nesimuluje se zvlášť,
  // útočné rakety nesou příznak jammerEscort pro PDLC vrstvu)
  const nAttack = jammer ? n - 1 : n
  for (let i = 0; i < nAttack; i++) {
    const m: MissileState = {
      id: state.nextId++,
      side: ship.side,
      def: def.id,
      pos: { ...ship.pos },   // dědí pozici…
      vel: { ...ship.vel },   // …a vektor lodi (odpal „po směru" natahuje dostřel)
      targetId,
      mode,
      driveRemaining: def.driveTime[mode],
      phase: 'boost',
      lock: lock0,
      salvoId,
      shooterId: ship.id,
      autonomous,
      launchedAt: state.t,
    }
    if (jammer) m.jammerEscort = true
    state.missiles.push(m)
  }
  if (!opts.podLaunch) {
    ship.missiles -= n
    ship.tubeCooldown = TUBE_COOLDOWN
  }
  // hláska taktického: první příchozí salva mise (nepřítel pálí na hráče)
  if (target) voiceIncomingSalvo(state, ship, target, nAttack)
  // odpaly NEzpomalují čas (slowdown false) — UI jen loguje;
  // výjimka: saturační salva z podů je dramatická událost (slowdown true)
  state.events.push(opts.podLaunch
    ? {
      t: state.t, kind: 'launch', shipId: ship.id, side: ship.side, count: n, salvoId,
      slowdown: true, text: `${ship.name}: raketové pody! Salva ${n} raket`,
    }
    : {
      // count = útočné rakety (jammer se nesimuluje — salvo tally sedí)
      t: state.t, kind: 'launch', shipId: ship.id, side: ship.side, count: nAttack, salvoId,
      text: `${ship.name}: odpálena salva ${nAttack} raket`
        + `${opts.ignoreCooldown ? ' (druhá vlna)' : ''}${autonomous ? ' (autonomní)' : ''}`
        + `${jammer ? ' (+rušička)' : ''}`,
    })
}

/**
 * Dvojitá boční salva (roll-and-fire):
 *   fáze A — plná salva z LEVOBOKU v režimu LO hned,
 *   otočka  — loď se odvalí (rolledTo kolmo k cíli) na ROLL_TIME; odvalená
 *             podle pravidel nemůže pálit,
 *   fáze B — po otočce plná salva z PRAVOBOKU v režimu HI, časovaná přes
 *            missileFlightTime na SPOLEČNÝ PŘÍLET s vlnou A (když to
 *            geometrie nedovolí, odpal hned po otočce + hláška o zpoždění),
 *   návrat — s vlnou B se loď vrátí z odvalu; obě strany šachet pak nesou
 *            TUBE_COOLDOWN (fáze B ho nabíjí přes launchSalvo).
 */
export function launchDouble(state: SimState, ship: ShipState, targetId: number): void {
  if (ship.destroyed) return
  const def = SHIP_CLASSES[ship.classId]
  const target = state.ships.find(s => s.id === targetId && !s.destroyed)
  if (!def || !target) return
  if (target.surrendered) {
    crewSay(state, ship, 'Cíl kapituloval — nestřílíme na něj.')
    return
  }
  const contact = state.contacts[ship.side]?.find(c => c.shipId === targetId)
  if (!contact || contact.idQuality < 1) {
    crewSay(state, ship, 'Dvojitá salva zamítnuta — cíl není klasifikovaný kontakt.')
    return
  }
  const nPort = sideTubes(ship, 'port')
  const nStbd = sideTubes(ship, 'stbd')
  if (nPort < 1 || nStbd < 1) {
    crewSay(state, ship, 'Dvojitá salva vyžaduje aspoň jednu funkční šachtu na KAŽDÉM boku.')
    return
  }
  if (ship.missiles < nPort + nStbd) {
    crewSay(state, ship,
      `Málo raket pro obě salvy — potřeba ${nPort + nStbd}, v zásobnících ${ship.missiles}.`)
    return
  }
  if (ship.pendingWave) {
    crewSay(state, ship, 'Druhá vlna už čeká — dvojitou salvu teď nelze zahájit.')
    return
  }

  // fáze A: levobok, LO, hned (rolled/cooldown řeší launchSalvo vlastní hláškou)
  const before = state.missiles.length
  launchSalvo(state, ship, targetId, nPort, 0, { side: 'port' })
  if (state.missiles.length === before) return

  // otočka: klín kolmo ke směru na cíl — během ní loď nemůže pálit
  const perp = angleOf(sub(target.pos, ship.pos)) + Math.PI / 2
  ship.rolledTo = Math.atan2(Math.sin(perp), Math.cos(perp))

  // fáze B: pravobok, HI, časovaná na společný přílet s vlnou A
  const d = dist(ship.pos, target.pos)
  const closing = dot(sub(ship.vel, target.vel), norm(sub(target.pos, ship.pos)))
  const tLo = missileFlightTime(d, closing, 0)
  const tHi = missileFlightTime(d, closing, 1)
  const idealDelay = Number.isFinite(tLo) && Number.isFinite(tHi) ? tLo - tHi : 0
  const delay = Math.max(ROLL_TIME, idealDelay)
  if (idealDelay < ROLL_TIME) {
    crewSay(state, ship, `Společný dopad nevyjde — druhá vlna (pravobok) dorazí `
      + `o ~${Math.max(1, Math.round(ROLL_TIME - idealDelay))} s později.`)
  } else {
    crewSay(state, ship,
      `Boční otočka — druhá salva z pravoboku za ${Math.round(delay)} s (společný dopad).`)
  }
  ship.pendingWave = {
    targetId, count: nStbd, mode: 1, launchAt: state.t + delay,
    sourceSide: 'stbd', unrollAfter: true,
  }
}

/**
 * Přesměrování letící salvy na nový cíl (jen fáze boost/ballistic, terminal ne).
 * Penalizace zámku ×0.75. Funguje jen dokud je salva v dosahu řízení
 * (CONTROL_RANGE) od řídící lodi — jinak „salva mimo dosah řízení".
 * Validace: nový cíl musí být klasifikovaný kontakt střelcovy strany a nesmí
 * být kapitulovaný.
 */
export function retargetSalvo(
  state: SimState, ship: ShipState, salvoId: number, newTargetId: number,
): void {
  const target = state.ships.find(s => s.id === newTargetId && !s.destroyed)
  if (!target || target.surrendered) {
    crewSay(state, ship, target?.surrendered
      ? 'Přesměrování zamítnuto — cíl kapituloval, nestřílíme na něj.'
      : 'Přesměrování zamítnuto — cíl neexistuje.')
    return
  }
  const contact = state.contacts[ship.side]?.find(c => c.shipId === newTargetId)
  if (!contact || contact.idQuality < 1) {
    crewSay(state, ship, 'Přesměrování zamítnuto — nový cíl není klasifikovaný kontakt.')
    return
  }
  const missiles = state.missiles.filter(m => m.side === ship.side && m.salvoId === salvoId
    && (m.phase === 'boost' || m.phase === 'ballistic'))
  if (missiles.length === 0) {
    crewSay(state, ship, 'Přesměrování nelze provést — salva už neletí.')
    return
  }
  let minD = Infinity
  for (const m of missiles) minD = Math.min(minD, dist(m.pos, ship.pos))
  if (minD >= CONTROL_RANGE) {
    crewSay(state, ship,
      `Salva mimo dosah řízení (${fmtMkm(minD)} mil. km, dosah ${fmtMkm(CONTROL_RANGE)}).`)
    return
  }
  for (const m of missiles) {
    m.targetId = newTargetId
    m.lock *= RETARGET_LOCK_PENALTY
  }
  crewSay(state, ship,
    `Salva přesměrována na ${target.name} — ${missiles.length} raket, zámek ×0,75.`)
}

/** Let raket: navádění, boost/balistika, přechod do terminální fáze. */
export function updateMissiles(state: SimState, dt: number): void {
  for (const m of state.missiles) {
    if (m.phase === 'dead') continue
    const def = MISSILES[m.def]

    const target = state.ships.find(s => s.id === m.targetId)
    if (!target || target.destroyed) {
      m.phase = 'dead'
      state.events.push({
        t: state.t, kind: 'missileMiss', side: m.side, shipId: m.targetId,
        cause: 'lost', salvoId: m.salvoId,
        text: 'raketa ztratila cíl (zničen)',
      })
      continue
    }

    // čisté pronásledování s predikcí: miř na extrapolovanou pozici cíle
    const d0 = dist(m.pos, target.pos)
    const tLead = Math.min(d0 / Math.max(len(m.vel), 1), 120)
    const aim = add(target.pos, scale(target.vel, tLead))
    const dir = norm(sub(aim, m.pos))

    if (m.phase === 'boost') {
      const accel = def.accelG[m.mode] * G
      m.vel = add(m.vel, scale(dir, accel * dt))
      m.driveRemaining -= dt
      if (m.driveRemaining <= 0) {
        m.driveRemaining = 0
        m.phase = 'ballistic' // pohon vyhořel — letí setrvačností
      }
    } else {
      erodeLock(state, m, BALLISTIC_LOCK_DECAY * dt) // bez pohonu zámek pomalu eroduje
    }

    // řídicí spoj řízené salvy: střelec žije, salva v dosahu řízení a jeho
    // strana drží senzorový kontakt na cíl — jinak zámek eroduje.
    // Autonomní salvy (fire-and-forget) spoj nepotřebují.
    if (m.shooterId !== undefined && m.autonomous !== true) {
      const shooter = state.ships.find(s => s.id === m.shooterId && !s.destroyed)
      const linked = !!shooter
        && dist(shooter.pos, m.pos) < CONTROL_RANGE
        && state.contacts[m.side].some(c => c.shipId === m.targetId)
      if (!linked) erodeLock(state, m, LINK_LOCK_DECAY * dt)
    }

    m.vel = clampLen(m.vel, def.maxSpeed)
    m.pos = add(m.pos, scale(m.vel, dt))

    if (m.lock < LOCK_LOST) {
      m.phase = 'dead'
      state.events.push({
        t: state.t, kind: 'missileMiss', side: m.side, shipId: m.targetId,
        cause: 'link', salvoId: m.salvoId,
        text: 'raketa ztratila zámek',
      })
      continue
    }

    // dosažení standoff vzdálenosti → terminální vyhodnocení
    if (dist(m.pos, target.pos) < def.standoffRange + len(m.vel) * dt) {
      m.phase = 'terminal'
      resolveTerminal(state, m, target)
    }
  }

  // mrtvé rakety pryč z pole
  if (state.missiles.some(m => m.phase === 'dead')) {
    state.missiles = state.missiles.filter(m => m.phase !== 'dead')
  }
}

/** Energetická palba (laser/graser) — drtivá zblízka, slabá na max. dosah; no-op hlásí důvod. */
export function fireEnergy(state: SimState, shooter: ShipState, target: ShipState): void {
  if (shooter.destroyed || target.destroyed) return
  // odvalená loď nemůže pálit boky — klín maskuje i energetické baterie
  if (shooter.rolledTo !== null) {
    crewSay(state, shooter, 'Jsme odvalení — boky kryje klín, palba nemožná.')
    return
  }
  if (shooter.energyCooldown > 0) {
    crewSay(state, shooter, `Energetické baterie nabíjejí — připraveny za ${Math.ceil(shooter.energyCooldown)} s.`)
    return
  }
  const d = dist(shooter.pos, target.pos)
  if (d > ENERGY_MAX_RANGE) {
    crewSay(state, shooter,
      `Cíl mimo dosah energetických zbraní (${fmtMkm(d)} mil. km, dosah ${fmtMkm(ENERGY_MAX_RANGE)}).`)
    return
  }

  const def = SHIP_CLASSES[shooter.classId]
  const bestSide = Math.max(shooter.subsystems.energyPort, shooter.subsystems.energyStbd)
  const mounts = Math.floor(def.energyMountsPerBroadside * bestSide)
  if (mounts <= 0 || def.energyDamage <= 0) {
    if (def.energyMountsPerBroadside > 0) crewSay(state, shooter, 'Energetické zbraně vyřazeny!')
    return
  }

  // plné poškození pod rozhodující vzdáleností, ~15 % na maximálním dosahu
  const falloff = d <= ENERGY_DECISIVE_RANGE
    ? 1
    : 1 - ((d - ENERGY_DECISIVE_RANGE) / (ENERGY_MAX_RANGE - ENERGY_DECISIVE_RANGE)) * 0.85
  const aspect = attackAspect(target, shooter.pos)

  shooter.energyCooldown = ENERGY_COOLDOWN
  state.events.push({
    t: state.t, kind: 'energyHit', shipId: target.id, side: target.side,
    // zásah do lodi hráče je důležitá událost (UI auto-zpomalení)
    slowdown: target.side === 'player',
    text: `${shooter.name}: energetická salva na ${target.name} (${mounts}× mount, ${aspect})`,
  })
  for (let i = 0; i < mounts; i++) {
    applyBeamDamage(state, target, def.energyDamage * falloff, aspect)
  }
}
