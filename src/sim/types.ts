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
  /** AI doktrína ('player' = ovládá hráč) */
  doctrine: string
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

// ---------- rozkazy (UI/AI -> engine) ----------

export type Order =
  | { kind: 'setCourse'; shipId: number; dest: Vec2; arriveAtRest: boolean }
  | { kind: 'intercept'; shipId: number; targetId: number }
  | { kind: 'setThrottle'; shipId: number; throttle: number }
  | { kind: 'setWedge'; shipId: number; on: boolean }
  | { kind: 'setActiveSensors'; shipId: number; on: boolean }
  | { kind: 'roll'; shipId: number; towards: number | null }
  | { kind: 'launchSalvo'; shipId: number; targetId: number; count: number; mode: DriveMode }
  | { kind: 'fireEnergy'; shipId: number; targetId: number }
  | { kind: 'holdFire'; shipId: number }

// ---------- události (engine -> UI/scenario) ----------

export interface SimEvent {
  t: number
  kind:
    | 'launch' | 'missileKilled' | 'missileHit' | 'missileMiss'
    | 'energyHit' | 'shipDestroyed' | 'subsystemHit'
    | 'contactNew' | 'contactClassified' | 'message' | 'objective'
  text: string
  shipId?: number
  side?: Side
  /** UI: událost, u které má komprese času spadnout na 1× */
  slowdown?: boolean
}

// ---------- scénář / mise ----------

export interface TriggerCondition {
  kind: 'time' | 'distanceBelow' | 'distanceAbove' | 'shipDestroyed' | 'flag'
  t?: number
  shipA?: number
  shipB?: number
  distance?: number
  shipId?: number
  flag?: string
}

export interface TriggerAction {
  kind: 'message' | 'setDoctrine' | 'spawnShip' | 'revealClass' | 'setFlag'
    | 'objectiveComplete' | 'objectiveFail' | 'winMission' | 'loseMission'
  text?: string
  shipId?: number
  doctrine?: string
  ship?: Partial<ShipState> & { classId: string; side: Side; name: string; pos: Vec2; vel: Vec2 }
  flag?: string
  objectiveId?: string
}

export interface Trigger {
  id: string
  once: boolean
  fired?: boolean
  conditions: TriggerCondition[]   // AND
  actions: TriggerAction[]
}

export interface Objective { id: string; text: string; state: 'open' | 'done' | 'failed' }

export interface Scenario {
  id: string
  title: string
  briefing: string
  seed: number
  ships: (Partial<ShipState> & { classId: string; side: Side; name: string; pos: Vec2; vel: Vec2 })[]
  objectives: Objective[]
  triggers: Trigger[]
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
