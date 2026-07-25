/**
 * Situační hlásky posádky — deterministické, edge-triggered.
 * Výběr varianty jde přes rand() nad FORKEM state.rng (seed = aktuální stav
 * rng ⊕ hash klíče kategorie): volba je plně deterministická (stejný seed
 * a průběh ⇒ stejný text), ale hlavní proud rng se NEPOSOUVÁ — hlásky
 * nesmí měnit průběh bitev (deterministické E2E běhy misí zůstávají
 * bitově identické). Hrany drží state.flags s klíči `said:<kategorie>:<id>`,
 * takže se hlásky neopakují. Hlásky dostává JEN strana hráče: mluví posádka
 * lodi s doctrine 'player' (event kind 'message' se speaker — komunikační
 * panel zůstává misím a kapitulacím).
 *
 * Volající hooky: sensors (kontakt, klasifikace), weapons (příchozí salva),
 * damage (zásah vlastní lodi), defense (pozorovaný zásah nepřítele),
 * ai (útěk piráta), crew (stavové kontroly: trup/munice/CM/obálka).
 */
import type { ShipState, SimState, Speaker } from './types'
import { SHIP_CLASSES } from '../data/defs'
import { rand } from './rng'

/** trupové kódy VÁLEČNÝCH lodí (klasifikační hláška) */
const WARSHIP_HULLS = new Set(['DD', 'CL', 'CA', 'BC', 'DN', 'SD', 'LAC'])

/** práh těžkého zásahu — poškození paprsku prošlé do trupu */
export const HEAVY_HIT_DAMAGE = 12

/** podíl zásobníku, pod kterým padne hláška „dochází munice" */
export const LOW_AMMO_FRACTION = 0.25

/** první nezničená loď ovládaná hráčem (mluvčí flotilových hlášek) */
function playerShip(state: SimState): ShipState | undefined {
  return state.ships.find(s => s.doctrine === 'player' && !s.destroyed)
}

/** hrana: true jen při PRVNÍM volání s daným klíčem (flag v state.flags) */
function once(state: SimState, key: string): boolean {
  if (state.flags[key] === true) return false
  state.flags[key] = true
  return true
}

/** FNV-1a hash klíče kategorie (mix do seedu forku) */
function hashKey(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x01000193)
  }
  return h >>> 0
}

/**
 * Deterministický výběr varianty: rand() nad forkem rng seedovaným
 * z aktuálního state.rng.s ⊕ hash(key). Hlavní proud se neposouvá.
 * Vrací text + voId nahrávky (`<voPrefix>-<index od 1>`, viz docs/VO_LINES.md).
 */
function pick(
  state: SimState, key: string, voPrefix: string, variants: string[],
): { text: string; voId: string } {
  const fork = { s: (state.rng.s ^ hashKey(key)) >>> 0 }
  const i = Math.min(variants.length - 1, Math.floor(rand(fork) * variants.length))
  return { text: variants[i], voId: `${voPrefix}-${i + 1}` }
}

/** hláška posádky (kind 'message' + speaker; UI slowdown řeší jiné eventy) */
function say(
  state: SimState, ship: ShipState, speaker: Speaker,
  line: { text: string; voId: string },
): void {
  state.events.push({
    t: state.t, kind: 'message', shipId: ship.id, side: ship.side, speaker,
    text: line.text, voId: line.voId,
  })
}

// ---------- kategorie ----------

/** první nepřátelský kontakt mise (comms) — hook: sensors při contactNew */
export function voiceFirstContact(state: SimState, target: ShipState): void {
  if (target.side !== 'enemy') return
  const own = playerShip(state)
  if (!own) return
  if (!once(state, 'said:first-contact:mission')) return
  say(state, own, 'comms', pick(state, 'first-contact', 'crew-contact', [
    'Impelerový kontakt, označuji Alfa-1. Kurz a emise zapisuji do taktické mapy.',
    'Kontakt! Pasivní pole zachytilo cizí podpis. Předávám taktickému.',
    'Máme společnost — nový kontakt na scopech. Sledujeme a nahráváme.',
    'Nový kontakt na pasivech, kapitáne. Identifikace až zblízka.',
  ]))
}

/** klasifikace VÁLEČNÉ lodi (tactical) — hook: sensors, jednou na loď */
export function voiceWarshipClassified(state: SimState, target: ShipState): void {
  if (target.side !== 'enemy') return
  const def = SHIP_CLASSES[target.classId]
  if (!def || !WARSHIP_HULLS.has(def.hullCode)) return
  const own = playerShip(state)
  if (!own) return
  if (!once(state, `said:warship:${target.id}`)) return
  say(state, own, 'tactical', pick(state, `warship:${target.id}`, 'crew-warship', [
    `Potvrzeno: válečná loď, ${def.name}. Přepočítávám palebné řešení.`,
    `Klasifikace hotová — ${def.name}. To není obchodník, kapitáne.`,
    `Senzory potvrzují válečnou loď: ${def.name}. Doporučuji držet odstup, dokud nemáme řešení.`,
  ]))
}

/** první příchozí salva mise (tactical) — hook: weapons.launchSalvo */
export function voiceIncomingSalvo(state: SimState, shooter: ShipState, target: ShipState, count: number): void {
  if (shooter.side !== 'enemy' || target.side !== 'player') return
  const own = playerShip(state)
  if (!own) return
  if (!once(state, 'said:first-vampire:mission')) return
  say(state, own, 'tactical', pick(state, 'first-vampire', 'crew-vampire', [
    `Odpaly raket! Vampýr, vampýr — počet ${count}, kurz na nás.`,
    `Raketové odpaly u nepřítele! Sledujeme ${count} vampýrů na příchodu.`,
    `Vampýr, vampýr! Salva ${count} raket ve vzduchu — obranné systémy připraveny.`,
    `Nepřítel pálí! ${count} raket na scopech, protirakety v pohotovosti.`,
  ]))
}

/** zásah vlastní lodi: lehký (engineer) / těžký (xo) — hook: damage.applyBeamDamage */
export function voiceOwnHit(state: SimState, ship: ShipState, hullDamage: number): void {
  if (ship.doctrine !== 'player' || ship.destroyed) return
  if (hullDamage >= HEAVY_HIT_DAMAGE) {
    if (!once(state, `said:hit-heavy:${ship.id}`)) return
    say(state, ship, 'xo', pick(state, `hit-heavy:${ship.id}`, 'crew-hitheavy', [
      'Těžký zásah! Hlášení škod jdou ze tří palub najednou — týmy nasazuji, kde se dá.',
      'To šlo hluboko, kapitáne. Prosekli boční štít — škody se teprve sčítají.',
      'Průnik trupem! Přetlakové přepážky drží… zatím.',
    ]))
  } else {
    if (!once(state, `said:hit-light:${ship.id}`)) return
    say(state, ship, 'engineer', pick(state, `hit-light:${ship.id}`, 'crew-hitlight', [
      'Zásah do trupu — škody povrchové. Týmy oprav už běží.',
      'Dostali jsme šlehanec. Nic, co by se nedalo zalátat za provozu.',
      'Lehký zásah, kapitáne. Boční štít pohltil většinu.',
    ]))
  }
}

/** pozorovaný zásah nepřítele (tactical) — hook: defense.resolveTerminal */
export function voiceEnemyHit(state: SimState, target: ShipState): void {
  if (target.side !== 'enemy') return
  const own = playerShip(state)
  if (!own) return
  // hlásíme jen zásah, který naše strana skutečně vidí (kontakt na cíl)
  if (!state.contacts.player.some(c => c.shipId === target.id)) return
  if (!once(state, `said:enemy-hit:${target.id}`)) return
  say(state, own, 'tactical', pick(state, `enemy-hit:${target.id}`, 'crew-enemyhit', [
    'Zásah! Senzory hlásí únik atmosféry z cíle.',
    'Přímý zásah — na scopech úlomky trupu a oblak par.',
    'Dostal to. Impelerový podpis cíle kolísá.',
  ]))
}

/** nepřítel prchá (tactical) — hook: ai.ts při přechodu piráta do útěku */
export function voiceEnemyFleeing(state: SimState, enemy: ShipState): void {
  if (enemy.side !== 'enemy') return
  const own = playerShip(state)
  if (!own) return
  // hláška jen když hráčova strana loď vidí (kontakt drží)
  if (!state.contacts.player.some(c => c.shipId === enemy.id)) return
  if (!once(state, `said:enemy-fleeing:${enemy.id}`)) return
  say(state, own, 'tactical', pick(state, `enemy-fleeing:${enemy.id}`, 'crew-fleeing', [
    'Cíl se otáčí a prchá — vektor pryč od nás, plný výkon.',
    'Nepřítel má dost! Otočil se a maže z boje.',
    'Kontakt prchá, kapitáne. Můžeme ho nechat běžet — nebo dohnat.',
  ]))
}

// ---------- stavové kontroly (tick z updateCrew) ----------

/** trup lodi hráče pod 50 % (xo, jednou) */
function checkHull(state: SimState, ship: ShipState): void {
  const def = SHIP_CLASSES[ship.classId]
  if (!def || ship.hull >= 0.5 * def.hullPoints) return
  if (!once(state, `said:hull50:${ship.id}`)) return
  say(state, ship, 'xo', pick(state, `hull50:${ship.id}`, 'crew-hull50', [
    'Kapitáne, loď to dlouho nevydrží. Jestli máme plán, teď je čas ho použít.',
    'Trup pod polovinou, kapitáne. Ještě pár takových zásahů a rozpadneme se.',
    'Hlášení škod se přestávají vejít na jednu obrazovku. Dlouho už to nevydržíme.',
  ]))
}

/** rakety pod 25 % zásobníku (tactical, jednou) */
function checkMissiles(state: SimState, ship: ShipState): void {
  const def = SHIP_CLASSES[ship.classId]
  if (!def || def.magazineMissiles <= 0) return
  if (ship.missiles >= LOW_AMMO_FRACTION * def.magazineMissiles) return
  if (!once(state, `said:ammo-low:${ship.id}`)) return
  say(state, ship, 'tactical', pick(state, `ammo-low:${ship.id}`, 'crew-ammolow', [
    'Zásobníky raket pod čtvrtinou. Každou další salvu dvakrát zvažte, kapitáne.',
    'Docházejí nám rakety — zbývá míň než čtvrtina zásobníků.',
    'Munice na dně: pod 25 procent. Přecházím na úsporné salvy.',
  ]))
}

/** protirakety pod 25 % zásobníku (tactical, jednou) */
function checkCMs(state: SimState, ship: ShipState): void {
  const def = SHIP_CLASSES[ship.classId]
  if (!def || def.magazineCMs <= 0) return
  if (ship.cms >= LOW_AMMO_FRACTION * def.magazineCMs) return
  if (!once(state, `said:cm-low:${ship.id}`)) return
  say(state, ship, 'tactical', pick(state, `cm-low:${ship.id}`, 'crew-cmlow', [
    'Protirakety pod čtvrtinou zásobníků. Obrana bude řídnout.',
    'Zásobníky protiraket docházejí — pod 25 procent. Zbytek nechte na PDLC a klín.',
    'Málo protiraket, kapitáne. Šetřím je na salvy, které projdou nejblíž.',
  ]))
}

/**
 * Cíl vstoupil do naší poháněné obálky (tactical, jednou na cíl).
 * Obálku hlásí volající (crew.ts počítá poweredEnvelope) — voice drží hranu.
 */
export function voiceTargetInEnvelope(state: SimState, ship: ShipState, target: ShipState): void {
  if (ship.doctrine !== 'player' || target.side !== 'enemy') return
  if (!once(state, `said:in-envelope:${target.id}`)) return
  say(state, ship, 'tactical', pick(state, `in-envelope:${target.id}`, 'crew-envelope', [
    'Cíl vstoupil do naší poháněné obálky — čekám na rozkaz k palbě.',
    'Máme ho v obálce. Palebné řešení drží — stačí říct, kapitáne.',
    'Cíl v dosahu poháněného letu. Šachty nabité, čekám na rozkaz.',
  ]))
}

/** stavové kontroly jedné lodi hráče (volá updateCrew každý tick) */
export function voiceShipStatus(state: SimState, ship: ShipState): void {
  if (ship.doctrine !== 'player' || ship.destroyed) return
  checkHull(state, ship)
  checkMissiles(state, ship)
  checkCMs(state, ship)
}
