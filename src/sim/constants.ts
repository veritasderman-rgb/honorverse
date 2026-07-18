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
/** cooldown odpalu CM na jeden odpalovač (s) */
export const CM_COOLDOWN = 12

/** bodová obrana */
export const PDLC_RANGE = 100_000
/** základní P(kill) jednoho clusteru na raketu v okně průletu */
export const PDLC_PK = 0.25

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
