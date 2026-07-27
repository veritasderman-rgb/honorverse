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
  /** odolnost bočního štítu: práh poškození, které paprsek musí překonat */
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
  /** počet tažených návnad (decoyů) v zásobě — obranná spotřební munice */
  decoyCount: number
  /**
   * Kvalita raketové elektroniky třídy — násobič počátečního zámku salvy
   * (technologická asymetrie stran): avalonské válečné třídy 1.08 (zámek
   * smí přetéct až na 1.05 — rezerva proti erozi), imperiální 1.0,
   * pirátské kořistní lodě 0.9. Chybí-li, platí 1.0.
   */
  missileQuality?: number
  /**
   * Kolik tažených raketových plošin (podů) třída utáhne za sebou.
   * Každá nese PODS_PER_POD raket; odpal všech najednou = drtivá první
   * salva (alfa úder). CA 4, BC 6, DN 8; lehké trupy jen symbolicky.
   * Chybí-li, 0 (obchodníci, stanice, sondy plošiny netahají).
   */
  podCapacity?: number
  /** lore třídy: původ jména, v čem vyniká, slabiny (rozklikávací detail v UI) */
  lore?: string
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
  /** poškození jednoho paprsku před odečtením bočního štítu */
  rodDamage: number
  /** max. rychlost (km/s) — tvrdý strop */
  maxSpeed: number
}

// ---------- stav simulace ----------

export type DriveMode = 0 | 1 // index do accelG/driveTime: 0=LO(dostřel), 1=HI(akcelerace)

/**
 * Režim pohonu v rozkazech: konkrétní (0/1), nebo 'auto' — engine při odpalu
 * sám zvolí HI, pokud je cíl v HI poháněné obálce (rychlý let = obrana cíle
 * nestíhá), jinak LO. Hráčské UI posílá vždy 'auto' — přepínání LO/HI je
 * technikálie, kterou řeší řízení palby, ne kapitán.
 */
export type DriveModeOrder = DriveMode | 'auto'

/** Mluvčí komunikace/hlášek — přesně názvy avatarů z docs/ART_PROMPTS.md (img/<speaker>.png). */
export type Speaker =
  | 'captain' | 'xo' | 'engineer' | 'tactical' | 'comms'
  | 'enemy-captain' | 'pirate' | 'station' | 'governor'

/**
 * Řízení palby lodi. Režimy:
 *   hold    — nestřílí,
 *   auto    — opakuje salvy na PEVNÝ cíl (targetId), dokud je v obálce,
 *   nearest — doktrína eskadry: sám si vybírá NEJBLIŽŠÍ nepřátelský kontakt
 *             (po zničení plynule roluje na další),
 *   biggest — doktrína eskadry: NEJTĚŽŠÍ známý trup (koncentrace celé
 *             eskadry vzniká sama — všechny lodě volí stejně),
 *   spread  — doktrína eskadry: rozdělit cíle (každá loď jiný — proti hejnu).
 * Doktríny volí cíl deterministicky z kontaktů vlastní strany.
 */
export interface FireControl {
  mode: 'hold' | 'auto' | 'nearest' | 'biggest' | 'spread'
  targetId: number | null
  salvoSize: number
  driveMode: DriveModeOrder
  /** interní stav enginu: cíl byl minulý tick v poháněné obálce (hrana pro hlášky) */
  engaged: boolean
  /** autonomní salvy (fire-and-forget): nižší počáteční zámek, ale bez řídicího spoje */
  autonomous?: boolean
  /** interní stav enginu: AUTO čeká kvůli odvalení (hrana pro hlášku, bez spamu) */
  rolledWait?: boolean
}

/** Naplánovaná druhá vlna vrstvené salvy (HI follow-up časovaný na společný přílet). */
export interface PendingWave {
  targetId: number
  count: number
  mode: DriveMode
  /** sim čas odpalu druhé vlny */
  launchAt: number
  /** dvojitá boční salva: odpal jen z daného boku (kapacita dle jeho šachet) */
  sourceSide?: 'port' | 'stbd'
  /** dvojitá boční salva: před odpalem vlny ukončit otočku (rolledTo = null) */
  unrollAfter?: boolean
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

/**
 * Priorita polních oprav (volí hráč): 'balanced' = rovnoměrně (výchozí),
 * jinak koncentrace čet na skupinu — zbraně (šachty + energetika),
 * pohon (impelery), obrana (boční štíty + PDLC + protirakety).
 */
export type RepairFocus = 'balanced' | 'weapons' | 'drive' | 'defense'

/** Druh formace eskadry (jen hráčem ovladatelné lodě). */
export type FormationKind = 'wall' | 'vee' | 'dispersed'

/** Členství lodi ve formaci: drží slot vůči leaderovi (plain data). */
export interface FormationState {
  leaderId: number
  /** pořadí slotu 1..n (rozmístění dle druhu formace) */
  slot: number
  kind: FormationKind
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
  /** sim čas odpalu (AI podle něj pozná, jak dlouho salva letí — žádná vševědoucnost) */
  launchedAt?: number
  /** salvu doprovází eskortní rušička: PDLC cíle má proti raketě Pk ×0.75 */
  jammerEscort?: boolean
  /** raketa už prošla testem svedení návnadou (jeden test na aktivaci) */
  decoyChecked?: boolean
  /** počet pokusů protiraket na tuto raketu (strop CM_SHOTS_PER_MISSILE) */
  cmShots?: number
  /**
   * Povolený počet pokusů protiraket na tuto raketu — přidělen JEDNOU při
   * prvním vstupu do interceptní obálky podle zbývajícího času do dopadu
   * (floor(čas / CM_REACTION_TIME), strop CM_SHOTS_PER_MISSILE). Salva
   * odpálená zblízka nechá obraně méně času na reakci ⇒ méně pokusů.
   */
  cmBudget?: number
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
  | {
    kind: 'course'; dest: Vec2; arriveAtRest: boolean
    /** fronta dalších waypointů trasy — po průletu dest se posune na další */
    then?: Vec2[]
  }
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
  /** klín zapnut (vypnutý = stealth, nulová akcelerace, žádné boční štíty) */
  wedgeOn: boolean
  /** aktivní senzory zapnuty */
  activeSensors: boolean
  /** loď je odvalená klínem k hrozbě (směr hrozby v rad), null = normální poloha */
  rolledTo: number | null
  subsystems: Subsystems
  hull: number           // zbývající hullPoints
  missiles: number       // zásoba útočných raket
  /**
   * Tažené raketové plošiny (pody) za lodí: každá nese PODS_PER_POD raket,
   * odpalují se VŠECHNY najednou (jednorázový alfa úder mimo šachty
   * i zásobníky). Výchozí příděl: podCapacity třídy pro stranu hráče,
   * AI jen když jí je dá scénář (spec.pods).
   */
  pods: number
  cms: number            // zásoba protiraket
  /** zásoba tažených návnad (decoyů) — odečítá se až ZNIČENÍM návnady */
  decoys: number
  /** tažená návnada je za lodí (aktivní, dokud ji svedená raketa nezničí) */
  decoyActive: boolean
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
  /** členství ve formaci eskadry (null/chybí = žádná; jen ovladatelné lodě) */
  formation?: FormationState | null
  /**
   * Popisek objektu pro detail po kliknutí na mapě (planety, stanice,
   * sondy, bóje, civilní provoz…) — scénář jím dává neherním objektům
   * příběhový kontext. Zobrazí se u neutrálů vždy, u ostatních od
   * klasifikace (idQuality ≥ 1).
   */
  desc?: string
  /** priorita polních oprav (chybí = 'balanced') */
  repairFocus?: RepairFocus
  /**
   * Cíl mise: plot loď pojmenuje na mapě (jméno z briefingu) i před klasifikací
   * senzory — hráč vidí „tohle je Cygnus". Třída/detaily zůstávají skryté dle
   * idQuality; jde jen o identifikaci předem známého objektu mise.
   */
  objective?: boolean
}

/** Senzorový kontakt — co daná strana VÍ (ne pravda). */
export interface Contact {
  shipId: number
  /** poslední známá pozice/rychlost (extrapolovatelné) */
  pos: Vec2
  vel: Vec2
  /**
   * Stáří dat v s. Gravitika (klín zapnutý v dosahu) je FTL — age 0,
   * obraz real-time; EM detekce (bez klínu) nese světelné zpoždění d/c;
   * paměťový pin (memory) stárne dál od okamžiku ztráty.
   */
  age: number
  /** kvalita identifikace: 0=jen klín, 1=třída známa, 2=plná */
  idQuality: 0 | 1 | 2
  /** odhad třídy (může být špatně — základ zvratů!) */
  classGuess: string
  wedgeDetected: boolean
  /**
   * Paměťový pin: kontakt už NENÍ v dosahu senzorů — na mapě zůstává
   * poslední známé zakreslení. Statické objekty (stanice, planety) trvale;
   * lodě s rostoucí nejistotou (kružnice age·|vel| v plotu).
   */
  memory?: boolean
  /** memory: statický objekt (maxAccelG 0) — poloha se nemění, kreslí se pevně */
  staticObject?: boolean
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
  | {
    kind: 'setCourse'; shipId: number; dest: Vec2; arriveAtRest: boolean
    /** true: přidá bod na konec trasy (Shift-klik) místo nahrazení kurzu */
    append?: boolean
  }
  | { kind: 'intercept'; shipId: number; targetId: number }
  | { kind: 'setThrottle'; shipId: number; throttle: number }
  | { kind: 'setWedge'; shipId: number; on: boolean }
  | { kind: 'setActiveSensors'; shipId: number; on: boolean }
  | { kind: 'roll'; shipId: number; towards: number | null }
  | { kind: 'launchSalvo'; shipId: number; targetId: number; count: number; mode: DriveModeOrder; autonomous?: boolean; escortJammer?: boolean }
  /** odpal VŠECH tažených raketových plošin najednou (PODS_PER_POD raket/ks) — alfa úder */
  | { kind: 'launchPods'; shipId: number; targetId: number }
  /** priorita polních oprav (koncentrace damage-control čet) */
  | { kind: 'setRepairFocus'; shipId: number; focus: RepairFocus }
  /** vypuštění tažené návnady (aktivní, dokud ji svedená raketa nezničí) */
  | { kind: 'deployDecoy'; shipId: number }
  /** dvojitá boční salva: LO z levoboku, otočka, HI z pravoboku na společný dopad */
  | { kind: 'launchDouble'; shipId: number; targetId: number }
  /** vrstvená salva: hlavní vlna LO hned + follow-up HI časovaný na společný přílet */
  | { kind: 'launchLayered'; shipId: number; targetId: number; countLo: number; countHi: number }
  /**
   * Sesazená alfa-salva („srovnat tuby"): více lodí naplánuje plnou salvu na
   * společný dopad (time-on-target) — bližší lodě zpozdí odpal, aby všechny
   * salvy dorazily naráz a zahltily obranu cíle.
   */
  | { kind: 'alphaStrike'; shipIds: number[]; targetId: number }
  /** přesměrování letící salvy (boost/ballistic) na nový cíl — zámek ×0.75, jen v dosahu řízení */
  | { kind: 'retargetSalvo'; shipId: number; salvoId: number; newTargetId: number }
  | { kind: 'fireEnergy'; shipId: number; targetId: number }
  /** výzva ke kapitulaci — odpověď dorazí po 2·vzdálenost/C (pendingComms) */
  | { kind: 'demandSurrender'; shipId: number; targetId: number }
  | { kind: 'holdFire'; shipId: number }
  /** zařazení lodi do formace: drží slot vůči leaderovi (jen ovladatelné lodě) */
  | { kind: 'setFormation'; shipId: number; leaderId: number; slot: number; formation: FormationKind }
  /** vyřazení lodi z formace (samostatné manévrování) */
  | { kind: 'clearFormation'; shipId: number }
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
  /**
   * Světová pozice události (km) — pro vizuální efekty plotu (jiskry CM,
   * paprsky PDLC, detonace, exploze, vraky). Deterministická (pozice
   * rakety/lodi v okamžiku události), sim ji nikdy nečte zpět.
   */
  pos?: Vec2
  /** mluvčí hlášky/komunikace (id avataru z docs/ART_PROMPTS.md) */
  speaker?: Speaker
  /** id namluvené repliky (docs/VO_LINES.md) — UI přehraje audio/vo/lines/<id>-<lang> */
  voId?: string
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
  | 'decoy'   // přeskočila na taženou návnadu obránce
  | 'link'    // ztráta zámku za letu (bez vedení / eroze)
  | 'expired' // konec doletu — sebedestrukce po MISSILE_MAX_FLIGHT
  | 'dud'     // detonace bez jediného zásahu paprsku
  | 'lost'    // cíl zanikl dřív (zničen/kapituloval)

// ---------- scénář / mise ----------

export interface TriggerCondition {
  kind: 'time' | 'distanceBelow' | 'distanceAbove' | 'shipDestroyed' | 'flag'
    | 'wedgeOn' | 'shipsDestroyedCount' | 'shipSurrendered' | 'classified'
    | 'flagNot' | 'hullBelow'
  t?: number
  shipA?: number
  shipB?: number
  distance?: number
  shipId?: number
  /** flag: splněno, když flag JE nastaven; flagNot: splněno, když NENÍ */
  flag?: string
  /** shipsDestroyedCount: strana, jejíž ztráty se počítají; classified: pozorující strana (default 'player') */
  side?: Side
  /** shipsDestroyedCount: splněno při počtu zničených lodí strany >= count */
  count?: number
  /** hullBelow: splněno, když loď ŽIJE a hull < fraction × hullPoints třídy */
  fraction?: number
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
  /** kind 'comm': id namluvené repliky (docs/VO_LINES.md) */
  vo?: string
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

/**
 * Kosmetická výbava mapy (fáze B grafického upgradu) — SIM JI IGNORUJE,
 * kreslí ji jen plot. Deterministická (seed → rozložení bodů).
 */
export interface DecorField {
  kind: 'asteroids'
  center: Vec2
  /** poloměr pole (km) */
  radius: number
  /** počet balvanů (výchozí 60) */
  count?: number
  seed?: number
}

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
  /** kosmetika mapy: pole asteroidů apod. (sim ignoruje, kreslí plot) */
  decor?: DecorField[]
  /** nádech mlhoviny soustavy (css barva) — atmosféra mise na pozadí plotu */
  ambient?: string
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
  /** scenario přítomen = custom bitva (skirmish); jinak lookup dle scenarioId */
  | { kind: 'init'; scenarioId: string; scenario?: Scenario; lang?: 'cs' | 'en' }
  /** obnova uložené mise — stav je kompletní (viz rng.ts: save/load férové) */
  | { kind: 'restore'; state: SimState; lang?: 'cs' | 'en' }
  | { kind: 'order'; order: Order }
  | { kind: 'setCompression'; factor: number }  // 0 = pauza
  | { kind: 'snapshotRequest' }

export type WorkerOutMsg =
  | { kind: 'snapshot'; state: SimState; compression: number }
  | { kind: 'ready'; scenario: Scenario }
