/**
 * Sdílený kontrakt simulace. VŠECHNY moduly (physics, weapons, defense,
 * sensors, scenario, ai, engine, UI) pracují proti těmto typům.
 * Jednotky: km, s, km/s, km/s². Úhly v radiánech. 2D rovina ekliptiky.
 */

// ---------- základní ----------

export interface Vec2 { x: number; y: number }

export type Side = 'player' | 'enemy' | 'neutral'

/** Seedovaný PRNG stav (mulberry32) — součást SimState kvůli determinismu. */
export interface RngState { s: number }

// ---------- definice (statická data, src/data) ----------

export interface ShipClassDef {
  id: string
  name: string
  /** DD, CL, CA, BC, DN, SD, LAC, MERCH */
  hullCode: string
  tonnage: number
  /** maximální akcelerace v g (100 % kompenzátoru) */
  maxAccelG: number
  /** odolnost bočníku: práh poškození, které paprsek musí překonat */
  sidewallStrength: number
  /** strukturní body trupu (vyčerpání = zničení) */
  hullPoints: number
  /** raketové šachty na jeden bok */
  tubesPerBroadside: number
  /** odpalovače protiraket (celkem) */
  cmLaunchers: number
  /** clustery bodové obrany (celkem) */
  pdlcClusters: number
  /** energetické zbraně na bok (laser/graser souhrnně) */
  energyMountsPerBroadside: number
  /** síla jedné energetické salvy (poškození na jeden mount) */
  energyDamage: number
  magazineMissiles: number
  magazineCMs: number
  /** dosah pasivních senzorů pro detekci klínu (km) */
  wedgeDetectionRange: number
  /** dosah aktivních senzorů / kvalitního zaměření (km) */
  activeSensorRange: number
  /** síla ECM 0–1 (snižuje zámek útočných raket) */
  ecm: number
}

export interface MissileDef {
  id: string
  name: string
  /** [režim LO, režim HI] akcelerace v g */
  accelG: [number, number]
  /** [režim LO, režim HI] doba hoření pohonu v s */
  driveTime: [number, number]
  /** vzdálenost detonace laserové hlavice od cíle (km) */
  standoffRange: number
  /** počet laserových tyčí (paprsků) na hlavici */
  laserRods: number
  /** poškození jednoho paprsku před odečtením bočníku */
  rodDamage: number
  /** max. rychlost (km/s) — tvrdý strop */
  maxSpeed: number
}

// ---------- stav simulace ----------

export type DriveMode = 0 | 1 // index do accelG/driveTime: 0=LO(dostřel), 1=HI(akcelerace)

/** Mluvčí komunikace/hlášek — přesně názvy avatarů z docs/ART_PROMPTS.md (img/<speaker>.png). */
export type Speaker =
  | 'captain' | 'xo' | 'engineer' | 'tactical' | 'comms'
  | 'enemy-captain' | 'pirate' | 'station' | 'governor'

/** Řízení palby lodi (AUTO režim = engine sám opakuje salvy na cíl v obálce). */
export interface FireControl {
  mode: 'hold' | 'auto'
  targetId: number | null
  salvoSize: number
  driveMode: DriveMode
  /** interní stav enginu: cíl byl minulý tick v poháněné obálce (hrana pro hlášky) */
  engaged: boolean
  /** autonomní salvy (fire-and-forget): nižší počáteční zámek, ale bez řídicího spoje */
  autonomous?: boolean
}

/** Naplánovaná druhá vlna vrstvené salvy (HI follow-up časovaný na společný přílet). */
export interface PendingWave {
  targetId: number
  count: number
  mode: DriveMode
  /** sim čas odpalu druhé vlny */
  launchAt: number
}

/** Dočasné bonusy posádky (náhodné události — taktik/inženýr). */
export interface ShipBuffs {
  /** bonus zámku nově odpálených raket (0.2 = +20 %) */
  lockBonus: number
  /** sim čas konce lock bonusu */
  lockUntil: number
  /** násobič rychlosti polních oprav (1 = normál) */
  repairBonus: number
  /** sim čas konce repair bonusu */
  repairUntil: number
}

export type MissilePhase = 'boost' | 'ballistic' | 'terminal' | 'dead'

export interface MissileState {
  id: number
  side: Side
  def: string            // MissileDef.id
  pos: Vec2
  vel: Vec2
  targetId: number       // ShipState.id
  mode: DriveMode
  driveRemaining: number // s
  phase: MissilePhase
  /** kvalita zámku 0–1; <0.2 = ztracená (decoy/ECM/klín) */
  lock: number
  /** id salvy (rakety jedné salvy útočí koordinovaně) */
  salvoId: number
  /** id lodi, která salvu řídí (řídicí spoj); undefined = bez řízení (testy) */
  shooterId?: number
  /** autonomní raketa (fire-and-forget): neeroduje bez kontaktu, bez dosahu řízení */
  autonomous?: boolean
}

/** Poškoditelné subsystémy — hodnoty 0–1 (1 = plně funkční). */
export interface Subsystems {
  impellerFwd: number   // přední prstenec — škáluje akceleraci
  impellerAft: number   // zadní prstenec
  sidewallPort: number
  sidewallStbd: number
  tubesPort: number     // škáluje počet funkčních šachet
  tubesStbd: number
  energyPort: number
  energyStbd: number
  pdlc: number
  cm: number
  sensors: number
  ecm: number
}

/** Navigační plán autopilota (nastavují rozkazy setCourse/intercept). */
export type NavPlan =
  | { kind: 'course'; dest: Vec2; arriveAtRest: boolean }
  | { kind: 'intercept'; targetId: number }
  | null

/** Orientace boku vůči světu: heading = směr přídě (rad). */
export interface ShipState {
  id: number
  side: Side
  classId: string        // ShipClassDef.id
  name: string
  pos: Vec2
  vel: Vec2
  /** směr přídě (rad); loď akceleruje po ose heading (příď napřed) */
  heading: number
  /** aktuální rozkazová akcelerace 0–1 (podíl max; 0.8 = standard) */
  throttle: number
  /** aktivní navigační plán autopilota */
  nav: NavPlan
  /** klín zapnut (vypnutý = stealth, nulová akcelerace, žádné bočníky) */
  wedgeOn: boolean
  /** aktivní senzory zapnuty */
  activeSensors: boolean
  /** loď je odvalená klínem k hrozbě (směr hrozby v rad), null = normální poloha */
  rolledTo: number | null
  subsystems: Subsystems
  hull: number           // zbývající hullPoints
  missiles: number       // zásoba útočných raket
  cms: number            // zásoba protiraket
  /** cooldowny odpalů (s do další salvy / energetické salvy) */
  tubeCooldown: number
  energyCooldown: number
  destroyed: boolean
  /** loď kapitulovala (klín vypnut, nebojuje, AI na ni nestřílí) */
  surrendered: boolean
  /** sim čas poslední výzvy ke kapitulaci NA tuto loď (cooldown opakování) */
  lastSurrenderDemandAt: number
  /** AI doktrína ('player' = ovládá hráč, 'surrendered' = kapitulovala) */
  doctrine: string
  /** řízení palby (AUTO/HOLD, cíl, velikost salvy, režim pohonu) */
  fireControl: FireControl
  /** čekající druhá vlna vrstvené salvy (null = žádná) */
  pendingWave: PendingWave | null
  /** dočasné bonusy posádky */
  buffs: ShipBuffs
  /** časy nedávných terminálních náletů NA tuto loď (okno saturace PDLC) */
  terminalTimes: number[]
}

/** Senzorový kontakt — co daná strana VÍ (ne pravda). */
export interface Contact {
  shipId: number
  /** poslední známá pozice/rychlost (extrapolovatelné) */
  pos: Vec2
  vel: Vec2
  /** stáří dat v s (světelné zpoždění + interval aktualizace) */
  age: number
  /** kvalita identifikace: 0=jen klín, 1=třída známa, 2=plná */
  idQuality: 0 | 1 | 2
  /** odhad třídy (může být špatně — základ zvratů!) */
  classGuess: string
  wedgeDetected: boolean
}

/**
 * Zpráva letící éterem rychlostí světla (výzva ke kapitulaci + odpověď).
 * Plain data (structured-clone-safe) — součást SimState kvůli determinismu;
 * engine ji vyhodnotí (roll ze state.rng) až při DORUČENÍ (deliverAt).
 */
export interface PendingComm {
  /** sim čas doručení odpovědi (odeslání + 2·vzdálenost/C) */
  deliverAt: number
  /** loď, které byla výzva určena */
  targetId: number
  /** loď, která výzvu poslala */
  demanderId: number
}

// ---------- rozkazy (UI/AI -> engine) ----------

export type Order =
  | { kind: 'setCourse'; shipId: number; dest: Vec2; arriveAtRest: boolean }
  | { kind: 'intercept'; shipId: number; targetId: number }
  | { kind: 'setThrottle'; shipId: number; throttle: number }
  | { kind: 'setWedge'; shipId: number; on: boolean }
  | { kind: 'setActiveSensors'; shipId: number; on: boolean }
  | { kind: 'roll'; shipId: number; towards: number | null }
  | { kind: 'launchSalvo'; shipId: number; targetId: number; count: number; mode: DriveMode; autonomous?: boolean }
  /** vrstvená salva: hlavní vlna LO hned + follow-up HI časovaný na společný přílet */
  | { kind: 'launchLayered'; shipId: number; targetId: number; countLo: number; countHi: number }
  /** přesměrování letící salvy (boost/ballistic) na nový cíl — zámek ×0.75, jen v dosahu řízení */
  | { kind: 'retargetSalvo'; shipId: number; salvoId: number; newTargetId: number }
  | { kind: 'fireEnergy'; shipId: number; targetId: number }
  /** výzva ke kapitulaci — odpověď dorazí po 2·vzdálenost/C (pendingComms) */
  | { kind: 'demandSurrender'; shipId: number; targetId: number }
  | { kind: 'holdFire'; shipId: number }
  /** parciální update řízení palby (engaged spravuje engine) */
  | { kind: 'setFireControl'; shipId: number; fc: Partial<Omit<FireControl, 'engaged'>> }

// ---------- události (engine -> UI/scenario) ----------

export interface SimEvent {
  t: number
  kind:
    | 'launch' | 'missileKilled' | 'missileHit' | 'missileMiss'
    | 'energyHit' | 'shipDestroyed' | 'subsystemHit'
    | 'contactNew' | 'contactClassified' | 'message' | 'objective'
    | 'comm'
  text: string
  /** u zásahových eventů (missileHit/Miss/Killed) = ZASAŽENÁ/bráněná loď */
  shipId?: number
  /** u launch/missileKilled/missileHit/missileMiss = strana RAKETY */
  side?: Side
  /** launch: počet odpálených raket (bojová statistika) */
  count?: number
  /** UI: událost, u které má komprese času spadnout na 1× */
  slowdown?: boolean
  /** mluvčí hlášky/komunikace (id avataru z docs/ART_PROMPTS.md) */
  speaker?: Speaker
  /** missileKilled/Miss: PŘÍČINA zániku rakety (rozpad bojové statistiky) */
  cause?: LossCause
  /** launch/missileKilled/Hit/Miss: id salvy (souhrn osudu salvy v UI) */
  salvoId?: number
}

/** Příčina zániku rakety (missileKilled/missileMiss). */
export type LossCause =
  | 'cm'      // protiraketa obránce
  | 'pdlc'    // bodová obrana obránce
  | 'wedge'   // roztříštění o interponovaný klín
  | 'ecm'     // svedena ECM/decoyi obránce
  | 'link'    // ztráta zámku za letu (bez vedení / eroze)
  | 'dud'     // detonace bez jediného zásahu paprsku
  | 'lost'    // cíl zanikl dřív (zničen/kapituloval)

// ---------- scénář / mise ----------

export interface TriggerCondition {
  kind: 'time' | 'distanceBelow' | 'distanceAbove' | 'shipDestroyed' | 'flag'
    | 'wedgeOn' | 'shipsDestroyedCount' | 'shipSurrendered' | 'classified'
  t?: number
  shipA?: number
  shipB?: number
  distance?: number
  shipId?: number
  flag?: string
  /** shipsDestroyedCount: strana, jejíž ztráty se počítají; classified: pozorující strana (default 'player') */
  side?: Side
  /** shipsDestroyedCount: splněno při počtu zničených lodí strany >= count */
  count?: number
}

export interface TriggerAction {
  kind: 'message' | 'setDoctrine' | 'spawnShip' | 'revealClass' | 'setFlag'
    | 'objectiveComplete' | 'objectiveFail' | 'winMission' | 'loseMission'
    | 'addObjective' | 'comm' | 'setSide' | 'podSalvo'
  text?: string
  shipId?: number
  doctrine?: string
  ship?: Partial<ShipState> & { classId: string; side: Side; name: string; pos: Vec2; vel: Vec2 }
  flag?: string
  objectiveId?: string
  /** kind 'comm': mluvčí komunikace */
  speaker?: Speaker
  /** kind 'setSide': nová strana lodi (převlečené lodě — zvraty misí) */
  side?: Side
  /** kind 'podSalvo': cíl a počet raket salvy z raketových podů */
  targetId?: number
  count?: number
}

export interface Trigger {
  id: string
  once: boolean
  fired?: boolean
  conditions: TriggerCondition[]   // AND
  actions: TriggerAction[]
}

export interface Objective { id: string; text: string; state: 'open' | 'done' | 'failed' }

/** Hyperlimit soustavy — kružnice kolem hvězdy, nebo svislá čára (okraj scény). */
export type Hyperlimit =
  | { kind: 'circle'; center: Vec2; radius: number }
  | { kind: 'lineX'; x: number }

export interface Scenario {
  id: string
  title: string
  briefing: string
  seed: number
  ships: (Partial<ShipState> & { classId: string; side: Side; name: string; pos: Vec2; vel: Vec2 })[]
  objectives: Objective[]
  triggers: Trigger[]
  /** volitelný hyperlimit (plot ho vykresluje jantarovou čárou/kružnicí) */
  hyperlimit?: Hyperlimit
}

// ---------- celkový stav ----------

export interface SimState {
  t: number
  rng: RngState
  nextId: number
  ships: ShipState[]
  missiles: MissileState[]
  /** kontakty podle strany */
  contacts: Record<Side, Contact[]>
  events: SimEvent[]        // události od posledního snapshotu (engine je vyprazdňuje)
  /** zprávy na cestě (výzvy ke kapitulaci) — vyhodnocují se při doručení */
  pendingComms: PendingComm[]
  flags: Record<string, boolean>
  objectives: Objective[]
  outcome: 'running' | 'win' | 'lose'
  scenarioId: string
}

// ---------- API enginu (implementuje sim/engine.ts) ----------

export interface SimApi {
  /** vytvoří stav ze scénáře */
  create(scenario: Scenario): SimState
  /** posune simulaci o dt (volat s malým dt, komprese = víc volání) */
  tick(state: SimState, dt: number): void
  /** aplikuje rozkaz (validace uvnitř) */
  applyOrder(state: SimState, order: Order): void
}

// ---------- worker bridge (UI <-> worker) ----------

export type WorkerInMsg =
  | { kind: 'init'; scenarioId: string }
  | { kind: 'order'; order: Order }
  | { kind: 'setCompression'; factor: number }  // 0 = pauza
  | { kind: 'snapshotRequest' }

export type WorkerOutMsg =
  | { kind: 'snapshot'; state: SimState; compression: number }
  | { kind: 'ready'; scenario: Scenario }
