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

/** ---------- rozpočet reaktoru: pohon vs. boční štíty ---------- */
/**
 * Reaktor neutáhne plný pohon i plné štítové generátory zároveň. Výkon
 * bočních štítů je funkcí rozkazového tahu (lomená čára, lineární interpolace):
 *   tah ≤ 40 %  → boční štíty 120 % (přebytek výkonu přebíjí generátory),
 *   tah 60 %    → boční štíty 100 %,
 *   tah 80 %    → boční štíty  60 %,
 *   tah 100 %   → boční štíty  40 %,
 *   tah 120 %   → boční štíty  25 % („za červenou čarou" nezbývá skoro nic).
 * Reálné taktické dilema: rychle se přiblížit s papírovými boky, nebo
 * zpomalit a nechat boční štíty žrát salvy.
 */
export const SIDEWALL_POWER_CURVE: ReadonlyArray<readonly [number, number]> = [
  [0.0, 1.2], [0.4, 1.2], [0.6, 1.0], [0.8, 0.6], [1.0, 0.4], [1.2, 0.25],
]
/**
 * Opotřebení generátorů bočního štítu palbou: absorbovaná energie paprsku pálí
 * generátory — subsystém bočního štítu ztrácí (absorbováno/síla bočního štítu)·WEAR
 * za paprsek. Soustavná boční palba tak boční štít POSTUPNĚ mele (a s ním roste
 * prošlé poškození) — loď „umírá po částech" i bokem, žádná věčná imunita.
 * Proti tomu běží polní opravy (REPAIR_RATE) — přetahovaná o štít je reálná.
 */
export const SIDEWALL_WEAR = 0.08

/** ---------- nouzový výkon pohonu ---------- */
/** maximální rozkazový výkon kompenzátoru (1.2 = 120 % — „za červenou čarou") */
export const EMERGENCY_THROTTLE_MAX = 1.2
/**
 * Riziko nouzového výkonu (throttle > 1.0 se zapnutým klínem): šance za sekundu
 * na poškození náhodného impelerového prstence o 0.08–0.15
 * (0.0005/s ≈ jednou za ~33 minut).
 */
export const EMERGENCY_DAMAGE_RATE = 0.0005
/** rozsah poškození prstence při selhání pod nouzovým výkonem */
export const EMERGENCY_DAMAGE_MIN = 0.08
export const EMERGENCY_DAMAGE_MAX = 0.15

/** ---------- formace eskadry ---------- */
/** stěna (wall): rozestup lodí v kolmé řadě (km) */
export const FORMATION_SPACING = 400_000
/** šíp (vee): rozestup podél křídel za leaderem (km) */
export const FORMATION_VEE_SPACING = 600_000
/** rozptyl (dispersed): rozestup mřížky (km) */
export const FORMATION_DISPERSED_SPACING = 1_500_000
/** stěna: násobič Pk protiraket člena s jiným členem do FORMATION_SPACING×1.5 */
export const WALL_CM_PK_FACTOR = 1.15
/** stěna: koordinované ECM — příchozí raketa ztrácí při terminále tolik zámku */
export const WALL_TERMINAL_LOCK_MALUS = 0.05
/** rozptyl: efektivní bonus ECM člena (přičítá se k ecm třídy) */
export const DISPERSED_ECM_BONUS = 0.03
/** šíp: sdílený senzorový obraz — bonus palebného řešení člena */
export const VEE_SOLUTION_BONUS = 0.05

/** fixní krok simulace (s) — komprese času = víc kroků na snímek */
export const SIM_DT = 0.5

/** protirakety */
export const CM_ACCEL_G = 130_000
export const CM_DRIVE_TIME = 75
export const CM_INTERCEPT_RANGE = 2_500_000
/**
 * Základní P(kill) jedné CM na jednu útočnou raketu.
 * Rekalibrace se stropem „dva výstřely na cíl": strop drží průchodnost
 * salvy shora, takže jednotlivý pokus smí být přesnější (0.35 → 0.42),
 * aniž by se obrana vrátila do sterilního „všechno sestřelím" režimu.
 */
export const CM_PK = 0.36
/**
 * „Dva výstřely na cíl": interceptní geometrie dovolí na jednu útočnou
 * raketu максимум 2 pokusy protiraket CELKEM. Bez stropu obrana s velkým
 * zásobníkem CM matematicky vždy přestřílí útočníkovy zásobníky raket
 * (souboj malých lodí byl sterilní — 90 raket, 85 sestřelů, 0 zásahů).
 */
export const CM_SHOTS_PER_MISSILE = 2
/**
 * Reakční čas jednoho interceptního pokusu (s): vyhodnocení hrozby, odpal
 * CM a její dolet. Počet povolených pokusů na raketu = floor(čas do dopadu
 * od odpalu / CM_REACTION_TIME), strop CM_SHOTS_PER_MISSILE.
 * PŘESNĚ tohle dělá boj zblízka smrtícím: HI salva odpálená pod ~1,7 mil. km
 * (let < 70 s) nechá obraně čas jen na JEDEN pokus, pod ~300 tis. km na
 * žádný. Obrana slábne s klesající vzdáleností přirozeně, ne skriptem.
 * (25 → 35 s: tutoriálová rekalibrace „škola vzdálenosti" — gradient musí
 * být znát už od ~1,5 mil. km, ne až v bodovém doletu.)
 */
export const CM_REACTION_TIME = 35
/** cooldown odpalu CM na jeden odpalovač (s) — vysoká kadence, zásobníky rychle tečou */
export const CM_COOLDOWN = 5

/** bodová obrana */
export const PDLC_RANGE = 100_000
/**
 * Reakční čas bodové obrany na PŘÍCHOZÍ SALVU: plná efektivita clusterů až
 * po PDLC_TRACK_TIME s letu salvy (výpočet palebného řešení, roztočení
 * věží). Salva odpálená zblízka (krátký let) potká obranu nepřipravenou —
 * efektivní clustery ×(let/PDLC_TRACK_TIME), dno PDLC_MIN_READINESS.
 * Spolu s interceptním budgetem CM (CM_REACTION_TIME) tvoří honorverse
 * pravidlo: ODPAL ZBLÍZKA JE VRAŽEDNÝ — obrana slábne, jak se odpalová
 * vzdálenost krátí.
 */
export const PDLC_TRACK_TIME = 90
export const PDLC_MIN_READINESS = 0.4
/** základní P(kill) jednoho clusteru na raketu v okně průletu */
export const PDLC_PK = 0.26
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
/**
 * Tažené raketové plošiny (pody): počet raket na jednu plošinu. Odpalují se
 * VŠECHNY najednou (alfa úder) — smysl podů je jediná drtivá salva, která
 * saturuje obranu, ne kapání po jedné. Jednorázové: po odpalu pods = 0.
 */
export const PODS_PER_POD = 6
/** pod tuto hodnotu zámku raketa ztrácí cíl */
export const LOCK_LOST = 0.2

/** ---------- dno eroze zámku („posádky se ECM propálí") ---------- */
/**
 * Zámek rakety s AKTIVNÍM řídicím spojem (střelec žije, salva řízená,
 * v CONTROL_RANGE, střelec svítí aktivními senzory) neklesá erozí pod 0.4 —
 * posádky se ECM propálí. ECM tak salvu oslabí, ale nikdy nevymaže.
 */
export const LOCK_FLOOR_GUIDED = 0.4
/**
 * Dno eroze pro rakety s funkčním vlastním seekerem (fáze boost/terminal)
 * bez plného vedení. Balistický dojezd bez spoje dno nemá — může erodovat
 * pomalu až pod LOCK_LOST.
 */
export const LOCK_FLOOR = 0.3
/**
 * Dno eroze BALISTICKÉHO dojezdu (pohon vyhořel): seeker degradovaný, ale
 * ŽIVÝ — raketa doletí s mizerným zámkem, místo aby cestou „zmizela".
 * Dřívější dno 0 znamenalo, že KAŽDÁ raketa za poháněnou obálkou umřela na
 * ztrátu zámku („200 raket na konvoj a žádný efekt") — masová palba na
 * dálku teď má malý, ale NENULOVÝ účinek; proti válečným lodím ji dál
 * trestá CM/PDLC/ECM, proti civilistům funguje. Životnost omezuje
 * MISSILE_MAX_FLIGHT.
 */
export const LOCK_FLOOR_BALLISTIC = 0.25
/**
 * Maximální doba letu rakety od odpalu (s): pak sebedestrukce (cause
 * 'expired'). LO: 180 s pohon + 720 s dojezd — pokryje i dlouhé výměny
 * bitevních stěn na 30+ mil. km (let ~500–700 s); kratší strop 600 s
 * zabíjel salvy stěn v půli cesty. Nutné od zavedení balistického dna
 * zámku — jinak by rakety v marném tail-chase letěly navěky.
 */
export const MISSILE_MAX_FLIGHT = 900

/** ---------- rolování a palba ---------- */
/** PDLC odvalené lodi: klín cloní i části clusterů (násobič počtu clusterů) */
export const PDLC_ROLLED_FACTOR = 0.6

/** ---------- tažené návnady (decoye) ---------- */
/**
 * Základ šance svedení útočné rakety návnadou:
 *   P = DECOY_SEDUCE_BASE · (0.5 + ecm třídy) · (1 − lock/2)
 * — kvalitní avalonská elektronika (ecm 0.35–0.5) svádí výrazně líp než
 * pirátská (0.15–0.2). Svedená raketa návnadu ZNIČÍ (jedna návnada ≈ jedna
 * pohlcená raketa); zásoba se odečítá až zničením.
 */
export const DECOY_SEDUCE_BASE = 0.28

/** ---------- ECM doprovod salvy (eskortní rušička) ---------- */
/** rušička oslepuje bodovou obranu: Pk PDLC cíle ×0.75 proti doprovázené salvě */
export const PDLC_JAMMER_FACTOR = 0.75
/** minimální velikost salvy s rušičkou (1 raketa se obětuje jako jammer) */
export const JAMMER_MIN_SALVO = 3

/** ---------- senzorový duel / palebné řešení ---------- */
/** základ palebného řešení jen z pasivních dat */
export const SOLUTION_PASSIVE = 0.7
/** bonus řešení, když cíl vyzařuje (jeho aktivní senzory = maják pro navádění) */
export const SOLUTION_EMITTING_BONUS = 0.15
/** bonus řešení za kvalitní track (kontakt idQuality 2) */
export const SOLUTION_TRACK_BONUS = 0.1
/** dosah řízení letící salvy od řídící lodi (km) — světelný lag řízení */
export const CONTROL_RANGE = 10_000_000
/** penalizace zámku při přesměrování salvy za letu */
export const RETARGET_LOCK_PENALTY = 0.75
/** autonomní salva (fire-and-forget): násobič počátečního zámku */
export const AUTONOMOUS_LOCK_FACTOR = 0.85
/**
 * Strop počátečního zámku KVALITNÍCH raket (missileQuality > 1): avalonská
 * elektronika smí zámek přetáhnout nad 1.0 — přebytek funguje jako rezerva
 * proti ECM erozi za letu. Pro missileQuality ≤ 1 se cap neuplatní
 * (součin řešení × kvalita je pod 1.0 sám od sebe).
 */
export const MISSILE_QUALITY_LOCK_CAP = 1.05
/** eroze zámku řízené rakety bez řídicího spoje (podíl/s) */
export const LINK_LOCK_DECAY = 0.01
/** aktivní senzory střelce drží track: násobič rychlosti eroze zámku ECM */
export const ACTIVE_GUIDANCE_ECM_FACTOR = 0.6
/** AI: vzdálenost, pod kterou si bojové doktríny zapínají aktivní senzory (km) */
export const AI_ACTIVE_SENSORS_RANGE = 8_000_000

/** kapitulace: cooldown opakované výzvy na tentýž cíl (s) */
export const SURRENDER_COOLDOWN = 180
/** kapitulace: bonus šance při vyřazených zbraních / prázdných zásobnících */
export const SURRENDER_WEAPONS_OUT_BONUS = 0.15

/** manévrovací trysky: akcelerace bez klínu (g) — korekce driftu, ne boj */
export const THRUSTER_G = 5

/** rolování lodi: doba přechodu (s) */
export const ROLL_TIME = 8

/** interval aktualizace senzorové picture (s, k tomu se přičítá light-lag) */
export const SENSOR_UPDATE_INTERVAL = 5

/** rychlost otáčení lodi (rad/s) — impelerové lodě se otáčejí rychle */
export const TURN_RATE = 0.15

/**
 * Polní opravy subsystémů: rychlost (podíl/s) a strop provizorní opravy.
 * 0.0012/s ≈ 7 % za minutu — vyřazený systém se BĚHEM bitvy vrací do hry
 * (s buffem inženýra ×4 pod dvě minuty na půlku výkonu). Loď tak žije
 * v honorverse rytmu: zásah → výpadek → provizorní oprava → zpět v boji.
 */
export const REPAIR_RATE = 0.0012
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
