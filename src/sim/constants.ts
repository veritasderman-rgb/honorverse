/** Fyzikální a herní konstanty. Jednotky: km, s, km/s. */

/** 1 g v km/s² */
export const G = 0.00981

/** rychlost světla, km/s */
export const C = 299_792.458

/** max. rychlost válečné lodi (částicové clony) */
export const SHIP_MAX_SPEED = 0.5 * C

/** max. rychlost rakety */
export const MISSILE_MAX_SPEED = 0.8 * C

/** standardní provozní výkon kompenzátoru */
export const STANDARD_THROTTLE = 0.8

/** fixní krok simulace (s) — komprese času = víc kroků na snímek */
export const SIM_DT = 0.5

/** protirakety */
export const CM_ACCEL_G = 130_000
export const CM_DRIVE_TIME = 75
export const CM_INTERCEPT_RANGE = 2_500_000
/** základní P(kill) jedné CM na jednu útočnou raketu */
export const CM_PK = 0.35
/** cooldown odpalu CM na jeden odpalovač (s) — vysoká kadence, zásobníky rychle tečou */
export const CM_COOLDOWN = 5

/** bodová obrana */
export const PDLC_RANGE = 100_000
/** základní P(kill) jednoho clusteru na raketu v okně průletu */
export const PDLC_PK = 0.32
/** saturace: Pk klesá faktorem 1/(1 + PDLC_SATURATION·(n−1)), n = rakety v okně */
export const PDLC_SATURATION = 0.12
/** okno saturace — terminální nálety na týž cíl v posledních X s (s) */
export const SATURATION_WINDOW = 15

/** energetické zbraně */
export const ENERGY_MAX_RANGE = 500_000
/** vzdálenost, pod kterou je energetická palba plně účinná */
export const ENERGY_DECISIVE_RANGE = 100_000
export const ENERGY_COOLDOWN = 20

/** rakety */
export const TUBE_COOLDOWN = 25
/** pod tuto hodnotu zámku raketa ztrácí cíl */
export const LOCK_LOST = 0.2

/** rolování lodi: doba přechodu (s) */
export const ROLL_TIME = 8

/** interval aktualizace senzorové picture (s, k tomu se přičítá light-lag) */
export const SENSOR_UPDATE_INTERVAL = 5

/** rychlost otáčení lodi (rad/s) — impelerové lodě se otáčejí rychle */
export const TURN_RATE = 0.15

/** polní opravy subsystémů: rychlost (podíl/s) a strop provizorní opravy */
export const REPAIR_RATE = 0.0004
export const REPAIR_CAP = 0.7

/** náhodné události posádky: střední doba mezi událostmi za boje (s) */
export const CREW_EVENT_MEAN_TIME = 240
/** „za boje" = nepřátelský kontakt blíž než (km), nebo letí rakety */
export const CREW_COMBAT_RANGE = 10_000_000
/** buff taktického důstojníka: bonus zámku a trvání (s) */
export const LOCK_BUFF = 0.2
export const LOCK_BUFF_TIME = 600
/** buff inženýra: násobič oprav a trvání (s) */
export const REPAIR_BUFF = 4
export const REPAIR_BUFF_TIME = 300
