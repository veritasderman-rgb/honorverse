/**
 * Mise 6 — „Ústup od Tharsis" (running fight, poškozený CA).
 * Po ztraceném střetnutí ústup poškozené lodi před rychlejším imperiálním
 * svazem. Lekce: geometrie zadního aspektu, mikrořízení poškozených systémů,
 * krytí zádě rolováním. Zvrat: „záchranná" eskadra vysílá správné kódy…
 * ale je to léčka — poznáš to jen z detailu v signálu.
 * Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Resolute (hráč), 2–4 = pronásledovatelé, 5 = bóje „Hyperlimit".
 * Zvratem spawnuté lodě mají pevná id: 9041 = ANS Vytrvalá, 9042 = ANS Naděje
 * (ve skutečnosti imperiální léčka — trigger je přepne na stranu enemy).
 */
import type { Scenario } from '../../sim/types'

const RESOLUTE = 1
const PURSUERS = [2, 3, 4]
const BUOY = 5
const DECOY1 = 9041
const DECOY2 = 9042

export const mission06: Scenario = {
  id: 'mission06',
  title: 'Ústup od Tharsis',
  briefing:
    'Střetnutí u Tharsis jsme prohráli. ANS Resolute ustupuje s vyřazeným '
    + 'zadním impelerovým prstencem, potrhaným pravým bočním štítem a polovinou '
    + 'levobokých šachet — a za zádí visí imperiální svaz, který je '
    + 'RYCHLEJŠÍ než ty. Jediná šance: udržet náskok do hyperlimitu, krýt '
    + 'záď rolováním a nenechat se stáhnout do boje. Každý zbytečný manévr '
    + 'tě stojí metry náskoku.',
  seed: 19960614, // pevný seed — determinismus

  // hyperlimit soustavy Tharsis — úniková čára na +x
  hyperlimit: { kind: 'lineX', x: 180_000_000 },

  ships: [
    {
      // hráčův poškozený těžký křižník v plném úprku (8000 km/s po +x)
      classId: 'ca-bastion', side: 'player', name: 'ANS Resolute',
      pos: { x: 0, y: 0 }, vel: { x: 8_000, y: 0 }, doctrine: 'player',
      hull: 180, // z 300 — šrámy z prohraného střetnutí
      subsystems: {
        impellerFwd: 1, impellerAft: 0.35,
        sidewallPort: 1, sidewallStbd: 0.6,
        tubesPort: 0.5, tubesStbd: 1,
        energyPort: 1, energyStbd: 1,
        pdlc: 1, cm: 1, sensors: 1, ecm: 1,
      },
    },
    {
      // pronásledovatelé: nepoškození a rychlejší — dohánějí
      classId: 'ca-bastion', side: 'enemy', name: 'IDS Vega',
      pos: { x: -35_000_000, y: 2_000_000 }, vel: { x: 9_000, y: 0 },
      doctrine: 'hunter', activeSensors: true,
    },
    {
      classId: 'ca-bastion', side: 'enemy', name: 'IDS Deneb',
      pos: { x: -35_000_000, y: -2_000_000 }, vel: { x: 9_000, y: 0 },
      doctrine: 'hunter', activeSensors: true,
    },
    {
      classId: 'cl-sokol', side: 'enemy', name: 'IDS Mizar',
      pos: { x: -37_000_000, y: 0 }, vel: { x: 9_000, y: 0 },
      doctrine: 'hunter', activeSensors: true,
    },
    {
      // bóje za hyperlimitem — cíl útěku
      classId: 'merch-freighter', side: 'neutral', name: 'Hyperlimit',
      pos: { x: 190_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
    },
  ],

  objectives: [
    { id: 'obj-escape', text: 'Doveď poškozenou Resolute za hyperlimit (k bóji)', state: 'open' },
  ],

  triggers: [
    {
      // úvodní hlášení strojovny — mikrořízení poškozených systémů
      id: 'trg-comm-damage', once: true,
      conditions: [{ kind: 'time', t: 20 }],
      actions: [
        {
          kind: 'comm', speaker: 'engineer',
          text: 'Inženýr: „Zadní prstenec drží na 35 %, víc z něj nedostanu. Jestli nás dohoní, s tímhle bočním štítem druhé kolo nepřežijeme."',
        },
      ],
    },
    {
      // ZVRAT (1. dějství): „záchranná eskadra" se objeví před hráčem
      id: 'trg-rescue-spawn', once: true,
      conditions: [{ kind: 'time', t: 1_800 }],
      actions: [
        { kind: 'message', text: 'Dva impelerové kontakty vpředu — vysílají avalonské identifikační kódy a zvou tě k sobě.' },
        {
          // „eskadra" číhá kousek POD únikovou osou — přímý kurz k bóji vede
          // do pasti (< 12 mil. km), vyhnutí obloukem nad osu je možné
          kind: 'spawnShip',
          ship: {
            id: DECOY1, classId: 'cl-sokol', side: 'player', name: 'ANS Vytrvalá',
            pos: { x: 60_000_000, y: -7_000_000 }, vel: { x: -300, y: 0 },
            doctrine: 'freighter',
          },
        },
        {
          kind: 'spawnShip',
          ship: {
            id: DECOY2, classId: 'cl-sokol', side: 'player', name: 'ANS Naděje',
            pos: { x: 61_000_000, y: -10_000_000 }, vel: { x: -300, y: 0 },
            doctrine: 'freighter',
          },
        },
        {
          // detail v senzorových datech — jediné varování, které dostaneš
          kind: 'comm', speaker: 'comms',
          text: 'Spojař: „Záchranná eskadra Vytrvalá a Naděje vysílá správné kódy… ale signál je o 40 ms mimo protokol. Možná jen rozladěný vysílač. Možná ne."',
        },
      ],
    },
    {
      // ZVRAT (2. dějství): přiblížení k „záchraně" sklapne past
      id: 'trg-trap-close-1', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: RESOLUTE, shipB: DECOY1, distance: 12_000_000 }],
      actions: [{ kind: 'setFlag', flag: 'trap-sprung' }],
    },
    {
      id: 'trg-trap-close-2', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: RESOLUTE, shipB: DECOY2, distance: 12_000_000 }],
      actions: [{ kind: 'setFlag', flag: 'trap-sprung' }],
    },
    {
      id: 'trg-trap', once: true,
      conditions: [{ kind: 'flag', flag: 'trap-sprung' }],
      actions: [
        { kind: 'message', text: 'Léčka! „Záchranná eskadra" shazuje falešné transpondéry — jsou to imperiální křižníky!' },
        { kind: 'setSide', shipId: DECOY1, side: 'enemy' },
        { kind: 'setSide', shipId: DECOY2, side: 'enemy' },
        { kind: 'setDoctrine', shipId: DECOY1, doctrine: 'hunter' },
        { kind: 'setDoctrine', shipId: DECOY2, doctrine: 'hunter' },
        {
          kind: 'comm', speaker: 'enemy-captain',
          text: 'IDS Pollux (alias „Vytrvalá"): „Výborně, Resolute, přesně podle plánu. Kladivo za vámi, kovadlina před vámi. Vypněte klín."',
        },
      ],
    },
    {
      // výhra: poškozená loď za hyperlimitem (u bóje)
      id: 'trg-escape', once: true,
      // velkorysý poloměr: hráč po vyhýbacím oblouku nemusí trefit přesný bod
      conditions: [{ kind: 'distanceBelow', shipA: RESOLUTE, shipB: BUOY, distance: 15_000_000 }],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-escape' },
        { kind: 'winMission', text: 'ANS Resolute přešla hyperlimit a zmizela v hyperprostoru. Tharsis si necháme na jindy.' },
      ],
    },
    {
      // prohra: zničení hráče
      id: 'trg-player-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: RESOLUTE }],
      actions: [{ kind: 'loseMission', text: 'ANS Resolute se nedostala k hyperlimitu.' }],
    },
  ],
}
