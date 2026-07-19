/**
 * Mise 9 — „Velká armáda" (velká obrana, eskadra s dreadnoughtem).
 * Salazar vsadí vše na přímý úder na Avalonskou křižovatku. Hráč velí
 * eskadře pěti lodí u stanice Křižovatka — vlajkou je dreadnought ANS
 * Vladař, technologická odpověď Avalonu na imperiální tonáž; invaze
 * „přistává" na hyperlimitu a valí se dovnitř v čele s DN Toledo. Zvrat:
 * druhý sled vystoupí z hyperu na OPAČNÉ straně soustavy — rozdělit stěnu,
 * nebo obětovat vedlejší cíl?
 * Viz docs/GAME_DESIGN.md kap. 7 a docs/LORE.md M9.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Vladař (DN, vlajková, hráč), 2 = ANS Praporec (BC),
 *   3 = ANS Hradba (CA), 4 = ANS Vichr (DD), 5 = ANS Bouře (DD),
 *   6 = stanice Křižovatka.
 * Lodě spawnuté triggery mají PEVNÁ id (nextId za běhu roste o id raket):
 *   sled 1: 9101–9104 (DN Toledo + 2× CA + CL),
 *   sled 2: 9201–9204 (2× CA + 2× CL, oslabená druhá linie).
 */
import type { Scenario, Subsystems } from '../../sim/types'

const FLAGSHIP = 1
const STATION = 6
const WAVE1 = [9101, 9102, 9103, 9104]
const WAVE2 = [9201, 9202, 9203, 9204]
const ATTACKERS = [...WAVE1, ...WAVE2]

/** flag „útočník id vyřazen" — zničen NEBO kapituloval */
const neutralized = (id: number): string => `neutralized-${id}`

/** dvojice triggerů per útočník: zničení i kapitulace nastaví tentýž flag */
const attackerNeutralized = (id: number): Scenario['triggers'] => [
  {
    id: `trg-att-dead-${id}`, once: true,
    conditions: [{ kind: 'shipDestroyed', shipId: id }],
    actions: [{ kind: 'setFlag', flag: neutralized(id) }],
  },
  {
    id: `trg-att-surrendered-${id}`, once: true,
    conditions: [{ kind: 'shipSurrendered', shipId: id }],
    actions: [
      { kind: 'setFlag', flag: neutralized(id) },
      { kind: 'message', text: 'Imperiální loď kapitulovala — invaze o jeden klín slabší.' },
    ],
  },
]

/** druhá linie Impéria: starší senzory, ECM i obranné baterie —
 * kvantita místo kvality; první sbor dostal, co logistika ještě unesla */
const secondLine = (): Subsystems => ({
  impellerFwd: 1, impellerAft: 1,
  sidewallPort: 1, sidewallStbd: 1,
  tubesPort: 1, tubesStbd: 1,
  energyPort: 1, energyStbd: 1,
  pdlc: 0.7, cm: 0.7, sensors: 0.8, ecm: 0.8,
})

/** zásobníky útočníka: mise 7 podřízla logistiku — sled 1 nese část,
 * sled 2 (rezervy) jen polovinu papírového stavu */
const MAGAZINES: Record<string, { m1: number; c1: number; m2: number; c2: number }> = {
  'dn-ural': { m1: 300, c1: 300, m2: 400, c2: 350 },
  'ca-bastion': { m1: 100, c1: 80, m2: 140, c2: 210 },
  'cl-sokol': { m1: 60, c1: 50, m2: 75, c2: 170 },
}

/** útočník sledu: „přistál" na hyperlimitu, kurz na stanici (brzdí k cíli).
 * Než hlídkové senzory zachytí klíny obránců, drží naplánovaný nájezd;
 * pak doktrína hunter převezme intercept. Sled 2 je oslabená druhá linie. */
const invader = (
  id: number, classId: string, name: string, x: number, y: number, wave: 1 | 2,
): Scenario['triggers'][0]['actions'][0] => {
  const d = Math.hypot(x, y)
  const mag = MAGAZINES[classId]
  return {
    kind: 'spawnShip',
    ship: {
      id, classId, side: 'enemy', name,
      pos: { x, y }, vel: { x: -2_000 * (x / d), y: -2_000 * (y / d) },
      doctrine: 'hunter', activeSensors: true,
      nav: { kind: 'course', dest: { x: 0, y: 0 }, arriveAtRest: true },
      subsystems: wave === 2 ? secondLine() : undefined,
      missiles: wave === 1 ? mag.m1 : mag.m2,
      cms: wave === 1 ? mag.c1 : mag.c2,
    },
  }
}

export const mission09: Scenario = {
  id: 'mission09',
  title: 'Velká armáda',
  briefing:
    'Salazar vsadil všechno: Velká armáda míří přímo na Avalonskou '
    + 'křižovatku a v jejím čele poprvé pluje dreadnought třídy Toledo. '
    + 'Admiralita odpovídá tím nejcennějším, co má — velíš eskadře pěti '
    + 'lodí s vlajkovým dreadnoughtem ANS Vladař: technologická převaha '
    + 'avalonské elektroniky proti imperiální tonáži. Bitevní křižník '
    + 'ANS Praporec, těžký křižník ANS Hradba a torpédoborce ANS Vichr '
    + 'a ANS Bouře doplňují stěnu — a za zády máš stanici Křižovatka '
    + 'u domovské planety. Útočník musí „přistát" na hyperlimitu a hodiny '
    + 'se dopravovat dovnitř: postav interceptní geometrii, drž eskadru '
    + 've formaci (stěna kryje, šíp míří) a rozmysli si předem, KDY '
    + 'eskadru rozdělit — kdo brání všechno, nebrání nic. Stanice má '
    + 'vlastní obranné pody, ale klíny mezi invazí a Křižovatkou jsou '
    + 'jen ty tvoje.',
  seed: 20040814, // pevný seed — determinismus

  // hyperlimit domovské soustavy — kružnice kolem hvězdy [0,0]
  hyperlimit: { kind: 'circle', center: { x: 0, y: 0 }, radius: 220_000_000 },

  ships: [
    {
      // vlajkový dreadnought eskadry — první loď stěny Avalonu
      classId: 'dn-vladar', side: 'player', name: 'ANS Vladař',
      pos: { x: 2_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      classId: 'bc-praporec', side: 'player', name: 'ANS Praporec',
      pos: { x: 2_000_000, y: 800_000 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      classId: 'ca-bastion', side: 'player', name: 'ANS Hradba',
      pos: { x: 2_000_000, y: -800_000 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      classId: 'dd-vichr', side: 'player', name: 'ANS Vichr',
      pos: { x: 2_000_000, y: 1_600_000 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      classId: 'dd-vichr', side: 'player', name: 'ANS Bouře',
      pos: { x: 2_000_000, y: -1_600_000 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      // stanice Křižovatka u domovské planety — nehybný opěrný bod
      classId: 'station-zeta', side: 'player', name: 'Křižovatka',
      pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0, nav: null,
    },
  ],

  objectives: [
    { id: 'obj-invasion', text: 'Znič nebo donuť ke kapitulaci všechny útočníky obou sledů', state: 'open' },
    { id: 'obj-station', text: 'Stanice Křižovatka musí přežít', state: 'open' },
  ],

  triggers: [
    {
      // úvodní rozkaz guvernéra — understatement Admirality
      id: 'trg-governor', once: true,
      conditions: [{ kind: 'time', t: 10 }],
      actions: [
        {
          kind: 'comm', speaker: 'governor',
          text: 'Guvernér: „Kapitáne Rowane, hyperprostorové senzory hlásí translační stopy na limitu. Za vámi jsou tři obydlené světy a Křižovatka, ze které se platí všechno ostatní. Admiralita vám svěřila Vladaře. Očekává, že invaze skončí tady. Nic víc k tomu není."',
        },
      ],
    },
    {
      // SLED 1: dreadnought Toledo + dva těžké křižníky + lehký křižník
      id: 'trg-wave1', once: true,
      conditions: [{ kind: 'time', t: 300 }],
      actions: [
        { kind: 'message', text: 'Translace potvrzena — první sled invaze přistál na hyperlimitu a najíždí na Křižovatku! V čele dreadnought!' },
        invader(9101, 'dn-ural', 'IDS Toledo', 200_000_000, 42_000_000, 1),
        invader(9102, 'ca-bastion', 'IDS Bellatrix', 200_000_000, 40_000_000, 1),
        invader(9103, 'ca-bastion', 'IDS Antares', 200_000_000, 44_000_000, 1),
        invader(9104, 'cl-sokol', 'IDS Rigel', 203_000_000, 38_000_000, 1),
      ],
    },
    {
      // imperiální ultimátum — dorazí se zpožděním po přistání sledu 1
      id: 'trg-ultimatum', once: true,
      conditions: [{ kind: 'time', t: 420 }],
      actions: [
        {
          kind: 'comm', speaker: 'enemy-captain',
          text: 'IDS Toledo: „Hvězdné království Avalon, historické právo Impéria dorazilo na váš práh — a váží šest a půl milionu tun. Caudillo Ferrante Salazar vám nabízí milost: vydejte Křižovatku a vaše světy zůstanou obyvatelné. Toto je jediná a poslední nabídka."',
        },
      ],
    },

    // po vyřazení sledu 1: hláška XO o geometrii (předzvěst zvratu)
    {
      id: 'trg-wave1-down', once: true,
      conditions: WAVE1.map(id => ({ kind: 'flag' as const, flag: neutralized(id) })),
      actions: [
        {
          kind: 'comm', speaker: 'xo',
          text: 'První důstojník: „První sled je pryč, pane. I ten jejich dreadnought. Ale podívejte na geometrii — jsme daleko od stanice a všechna naše rychlost míří VEN. Jestli mají druhý sbor, přistane tam, kde nejsme."',
        },
      ],
    },

    // ZVRAT: druhý sled vystupuje z hyperu na OPAČNÉ straně soustavy
    {
      id: 'trg-wave2', once: true,
      conditions: [{ kind: 'time', t: 5_400 }],
      actions: [
        { kind: 'message', text: 'Druhý sbor vystupuje z hyperu na opačné straně soustavy!' },
        {
          kind: 'comm', speaker: 'station',
          text: 'Kontrola Křižovatka: „Nové translační stopy — mínus sto devadesát na mínus šedesát! Jsou za vámi, opakuji, druhý sled je MEZI vámi a stanicí! Vladaři, tady jsou tři tisíce lidí!"',
        },
        invader(9201, 'ca-bastion', 'IDS Deneb', -190_000_000, -60_000_000, 2),
        invader(9202, 'ca-bastion', 'IDS Dubhe', -193_000_000, -58_000_000, 2),
        invader(9203, 'cl-sokol', 'IDS Mizar', -190_000_000, -56_000_000, 2),
        invader(9204, 'cl-sokol', 'IDS Alkor', -193_000_000, -62_000_000, 2),
      ],
    },

    // obranné pody stanice: PRVNÍ útočník pod 10 mil. km spustí jedinou
    // salvu 16 raket (flagNot ⇒ vystřelí jen jednou, na toho, kdo se přiblížil)
    ...ATTACKERS.map((id): Scenario['triggers'][0] => ({
      id: `trg-station-pods-${id}`, once: true,
      conditions: [
        { kind: 'distanceBelow', shipA: id, shipB: STATION, distance: 10_000_000 },
        { kind: 'flagNot', flag: 'pods-away' },
      ],
      actions: [
        { kind: 'setFlag', flag: 'pods-away' },
        { kind: 'message', text: 'Křižovatka aktivuje obranné pody!' },
        { kind: 'podSalvo', shipId: STATION, targetId: id, count: 16 },
      ],
    })),

    // vyřazení útočníků: zničení NEBO kapitulace ⇒ flagy
    ...ATTACKERS.flatMap(attackerNeutralized),
    {
      // VÝHRA: všech osm útočníků obou sledů vyřazeno (AND)
      id: 'trg-win', once: true,
      conditions: ATTACKERS.map(id => ({ kind: 'flag' as const, flag: neutralized(id) })),
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-invasion' },
        { kind: 'objectiveComplete', objectiveId: 'obj-station' },
        { kind: 'winMission', text: 'Oba sledy Velké armády zničeny. Kontrola Křižovatka děkuje. Dobrá práce.' },
      ],
    },
    {
      // prohra: zničení stanice
      id: 'trg-station-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: STATION }],
      actions: [{ kind: 'loseMission', text: 'Křižovatka je pryč — a s ní mýto, flotila i válka.' }],
    },
    {
      // prohra: zničení vlajkové lodi
      id: 'trg-flagship-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: FLAGSHIP }],
      actions: [{ kind: 'loseMission', text: 'Vlajkový dreadnought ANS Vladař zničen — eskadra bez velení se rozpadá.' }],
    },
    {
      // prohra: ztráta tří vlastních lodí — obrana se zhroutila
      id: 'trg-losses', once: true,
      conditions: [{ kind: 'shipsDestroyedCount', side: 'player', count: 3 }],
      actions: [{ kind: 'loseMission', text: 'Tři lodě obrany zničeny — zbytek eskadry už invazi nezastaví.' }],
    },
  ],
}
