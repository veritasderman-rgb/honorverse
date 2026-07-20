/**
 * Taktická AI — věrohodné doktríny (viz design kap. 8.3), ne chytrost.
 * AI vidí jen kontakty své strany (state.contacts[side]) a vrací rozkazy;
 * NEaplikuje je — to dělá engine přes applyOrder.
 */
import type { Contact, DriveMode, Order, ShipState, SimState, Side } from './types'
import { AI_ACTIVE_SENSORS_RANGE, CM_INTERCEPT_RANGE, SENSOR_UPDATE_INTERVAL } from './constants'
import { add, angleDiff, angleOf, dist, norm, scale, sub, vec } from './vec'
import { SHIP_CLASSES } from '../data/defs'
import { voiceEnemyFleeing } from './voice'

/** aproximace dostřelu poháněné obálky v režimu LO (mode 0), km */
const SALVO_RANGE_LO = 6_000_000
/** dosah pro salvy eskorty, km */
const ESCORT_SALVO_RANGE = 5_000_000
/** dosah energetické palby AI, km */
const ENERGY_FIRE_RANGE = 400_000
/** runner: vzdálenost pro obrannou salvu, km */
const RUNNER_SALVO_RANGE = 3_000_000
/** hyperlimitní čára mise 1 (x > +250 mil. km) */
const HYPERLIMIT_X = 250_000_000

const hostileTo = (a: Side, b: Side): boolean =>
  (a === 'player' && b === 'enemy') || (a === 'enemy' && b === 'player')

/** odhad aktuální pozice kontaktu (extrapolace o stáří dat) */
const estPos = (c: Contact) => add(c.pos, scale(c.vel, c.age))

interface Near { c: Contact; d: number }

function nearest(ship: ShipState, contacts: Contact[]): Near | null {
  let best: Near | null = null
  for (const c of contacts) {
    const d = dist(ship.pos, estPos(c))
    if (!best || d < best.d) best = { c, d }
  }
  return best
}

/** kontakt vypadá jako obchodník? (jen pokud je třída známa) */
const looksLikeMerch = (c: Contact): boolean =>
  SHIP_CLASSES[c.classGuess]?.hullCode === 'MERCH'

/** společná palebná logika bojových doktrín */
function fireOrders(ship: ShipState, near: Near, salvoRange: number, mode: DriveMode, orders: Order[]): void {
  const def = SHIP_CLASSES[ship.classId]
  if (!def) return
  // senzorový duel: zahájení palby zblízka → zapnout aktivní senzory
  // (plné palebné řešení; hráč vidí, že protivník „rozsvítil")
  if (near.d < AI_ACTIVE_SENSORS_RANGE && !ship.activeSensors) {
    orders.push({ kind: 'setActiveSensors', shipId: ship.id, on: true })
  }
  if (near.d < salvoRange && ship.tubeCooldown <= 0 && ship.missiles > 0 && def.tubesPerBroadside > 0) {
    orders.push({
      kind: 'launchSalvo', shipId: ship.id, targetId: near.c.shipId,
      count: Math.min(def.tubesPerBroadside, ship.missiles), mode,
    })
  }
  if (near.d < ENERGY_FIRE_RANGE && ship.energyCooldown <= 0 && def.energyMountsPerBroadside > 0) {
    orders.push({ kind: 'fireEnergy', shipId: ship.id, targetId: near.c.shipId })
  }
}

/** návnada: minimální velikost příchozí salvy, na kterou AI reaguje */
const AI_DECOY_SALVO = 6

/**
 * Návnady AI: vypustí taženou návnadu, když na loď letí salva aspoň
 * AI_DECOY_SALVO raket a nejbližší je v CM pásmu (viditelnost přes
 * SENSOR_UPDATE_INTERVAL zpoždění — žádná vševědoucnost).
 */
function decoyOrders(state: SimState, ship: ShipState, orders: Order[]): void {
  if (ship.decoys <= 0 || ship.decoyActive) return
  let incoming = 0
  let nearest = Infinity
  for (const m of state.missiles) {
    if (m.phase === 'dead' || m.side === ship.side || m.targetId !== ship.id) continue
    if (m.launchedAt !== undefined && state.t - m.launchedAt < SENSOR_UPDATE_INTERVAL) continue
    incoming++
    nearest = Math.min(nearest, dist(m.pos, ship.pos))
  }
  if (incoming >= AI_DECOY_SALVO && nearest < CM_INTERCEPT_RANGE) {
    orders.push({ kind: 'deployDecoy', shipId: ship.id })
  }
}

/**
 * Obranné rozkazy společné všem bojovým doktrínám: návnady.
 * (Reaktivní rolování ZRUŠENO: AI ho uměla načasovat těsně před dopad,
 * což lidský hráč při kompresi času nedokáže — nefér mechanika pryč
 * z obou stran. Klínem se dál točí jen choreografie dvojité salvy.)
 */
function defenseOrders(state: SimState, ship: ShipState, orders: Order[]): void {
  decoyOrders(state, ship, orders)
}

/** runner (zvrat mise 1): po vyhlášení útěku plný výkon k hyperlimitě + obranné salvy */
function runnerOrders(state: SimState, ship: ShipState, hostiles: Contact[], orders: Order[]): void {
  if (!state.flags['runner-fleeing']) return // do zvratu se chová jako freighter

  if (ship.throttle < 1) {
    orders.push({ kind: 'setThrottle', shipId: ship.id, throttle: 1 })
  }
  // kurz pryč od pronásledovatele, daleko za hyperlimitní čáru na +x
  if (!(ship.nav?.kind === 'course' && ship.nav.dest.x >= HYPERLIMIT_X)) {
    orders.push({
      kind: 'setCourse', shipId: ship.id,
      dest: vec(2 * HYPERLIMIT_X, ship.pos.y), arriveAtRest: false,
    })
  }
  const near = nearest(ship, hostiles)
  // útěk s palbou: aktivní senzory zapnout, když je pronásledovatel blízko;
  // jakmile se utrhne (ústup bez palby), zase EMCON
  if (near && near.d < AI_ACTIVE_SENSORS_RANGE) {
    if (!ship.activeSensors) orders.push({ kind: 'setActiveSensors', shipId: ship.id, on: true })
  } else if (ship.activeSensors) {
    orders.push({ kind: 'setActiveSensors', shipId: ship.id, on: false })
  }
  if (near && near.d < RUNNER_SALVO_RANGE && ship.tubeCooldown <= 0 && ship.missiles > 0) {
    orders.push({
      kind: 'launchSalvo', shipId: ship.id, targetId: near.c.shipId,
      count: Math.min(2, ship.missiles), mode: 1,
    })
  }
  defenseOrders(state, ship, orders)
}

/** pirát: intercept nejbližšího obchodníka; při hull < 50 % útěk */
function pirateOrders(state: SimState, ship: ShipState, hostiles: Contact[], orders: Order[]): void {
  const def = SHIP_CLASSES[ship.classId]
  if (!def) return

  if (ship.hull < 0.5 * def.hullPoints) {
    // hláska taktického hráči: pirát se dal na útěk (jen když ho vidíme)
    voiceEnemyFleeing(state, ship)
    // ústup bez palby → EMCON: aktivní senzory vypnout (nevyzařovat)
    if (ship.activeSensors) {
      orders.push({ kind: 'setActiveSensors', shipId: ship.id, on: false })
    }
    // zbabělost: otočit a prchat od nejbližší hrozby
    const near = nearest(ship, hostiles)
    if (near) {
      const away = norm(sub(ship.pos, estPos(near.c)))
      const dir = away.x === 0 && away.y === 0 ? vec(1, 0) : away
      const dest = add(ship.pos, scale(dir, 300_000_000))
      if (!(ship.nav?.kind === 'course' && dist(ship.nav.dest, dest) < 50_000_000)) {
        orders.push({ kind: 'setCourse', shipId: ship.id, dest, arriveAtRest: false })
      }
      if (ship.throttle < 1) orders.push({ kind: 'setThrottle', shipId: ship.id, throttle: 1 })
    }
    defenseOrders(state, ship, orders)
    return
  }

  // kořist: preferuj identifikované obchodníky, jinak nejbližší kontakt
  const merch = hostiles.filter(looksLikeMerch)
  const near = nearest(ship, merch.length > 0 ? merch : hostiles)
  if (near) {
    if (!(ship.nav?.kind === 'intercept' && ship.nav.targetId === near.c.shipId)) {
      orders.push({ kind: 'intercept', shipId: ship.id, targetId: near.c.shipId })
    }
    fireOrders(ship, near, SALVO_RANGE_LO, 0, orders)
  }
  defenseOrders(state, ship, orders)
}

/** hystereze držení cíle huntera: nepustí pronásledovaný cíl, dokud není 3× dál než nejbližší */
const HUNTER_STICKINESS = 3

/** hunter: intercept nepřátelské lodi JAKÉHOKOLI typu + standardní palba.
 * Cíl drží s hysterezí — nepřeskakuje na jiný kontakt jen proto, že je
 * momentálně o kus blíž (jinak by se honička dala rozbít návnadou stranou). */
function hunterOrders(state: SimState, ship: ShipState, hostiles: Contact[], orders: Order[]): void {
  let near = nearest(ship, hostiles)
  if (near) {
    if (ship.nav?.kind === 'intercept') {
      const curId = ship.nav.targetId
      const cur = hostiles.find(c => c.shipId === curId)
      if (cur) {
        const d = dist(ship.pos, estPos(cur))
        if (d < HUNTER_STICKINESS * near.d) near = { c: cur, d }
      }
    }
    if (!(ship.nav?.kind === 'intercept' && ship.nav.targetId === near.c.shipId)) {
      orders.push({ kind: 'intercept', shipId: ship.id, targetId: near.c.shipId })
    }
    fireOrders(ship, near, SALVO_RANGE_LO, 0, orders)
  }
  defenseOrders(state, ship, orders)
}

/** eskorta: intercept nejbližší nepřátelské válečné lodi, palba dle dosahu */
function escortOrders(state: SimState, ship: ShipState, hostiles: Contact[], orders: Order[]): void {
  // hrozba = vše, co prokazatelně NENÍ obchodník (neznámé kontakty jsou hrozba)
  const threats = hostiles.filter(c => !looksLikeMerch(c))
  const near = nearest(ship, threats)
  if (near) {
    if (!(ship.nav?.kind === 'intercept' && ship.nav.targetId === near.c.shipId)) {
      orders.push({ kind: 'intercept', shipId: ship.id, targetId: near.c.shipId })
    }
    fireOrders(ship, near, ESCORT_SALVO_RANGE, 0, orders)
  }
  defenseOrders(state, ship, orders)
}

/** Vygeneruje rozkazy všech AI lodí (doctrine != 'player'). Nic neaplikuje. */
export function collectAIOrders(state: SimState): Order[] {
  const orders: Order[] = []
  for (const ship of state.ships) {
    if (ship.destroyed || ship.surrendered) continue
    const doctrine = ship.doctrine
    // 'freighter' jen udržuje stávající nav — žádné rozkazy; 'buoy' je statická
    // kotva; 'surrendered' se vzdala (nemanévruje, nestřílí, negeneruje rozkazy)
    if (doctrine === 'player' || doctrine === 'freighter' || doctrine === 'buoy'
      || doctrine === 'surrendered') continue

    const contacts = state.contacts[ship.side] ?? []
    // IFF: cílíme jen na kontakty skutečně nepřátelské strany (transpondér);
    // kapitulované lodě jsou z výběru cílů vyřazené — na ně se nestřílí
    const hostiles = contacts.filter(c => {
      const target = state.ships.find(s => s.id === c.shipId)
      return !!target && !target.destroyed && !target.surrendered
        && hostileTo(ship.side, target.side)
    })

    if (doctrine === 'runner') runnerOrders(state, ship, hostiles, orders)
    else if (doctrine === 'pirate') pirateOrders(state, ship, hostiles, orders)
    else if (doctrine === 'hunter') hunterOrders(state, ship, hostiles, orders)
    else if (doctrine === 'escort') escortOrders(state, ship, hostiles, orders)
  }
  return orders
}
