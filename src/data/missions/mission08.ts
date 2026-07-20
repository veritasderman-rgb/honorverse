/**
 * Mise 8 — „Kaledonská hvězda" (spojenci).
 * Společná hlídka s kaledonským lehkým křižníkem Claymore proti imperiální
 * stěně. Lekce: boj po boku spojence, kterému nevelíš. Zvrat: kaledonský
 * kapitán v půlce boje poruší rozkazy a vrhne se na stěnu sám — hráč volí:
 * rozbít vlastní plán a krýt ho, nebo ho nechat zemřít.
 * Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Vanguard (hráč), 2 = KNS Claymore (spojenec),
 *   3–5 = imperiální stěna (2× CA + 1× CL).
 */
import type { Scenario } from '../../sim/types'

const VANGUARD = 1
const CLAYMORE = 2
const WALL = [3, 4, 5]

/** flag „loď stěny id vyřazena" — zničena NEBO kapitulovala */
const neutralized = (id: number): string => `neutralized-${id}`

const wallNeutralized = (id: number): Scenario['triggers'] => [
  {
    id: `trg-wall-dead-${id}`, once: true,
    conditions: [{ kind: 'shipDestroyed', shipId: id }],
    actions: [{ kind: 'setFlag', flag: neutralized(id) }],
  },
  {
    id: `trg-wall-surrendered-${id}`, once: true,
    conditions: [{ kind: 'shipSurrendered', shipId: id }],
    actions: [
      { kind: 'setFlag', flag: neutralized(id) },
      { kind: 'message', text: 'Imperiální loď kapitulovala — stěna se drolí.' },
    ],
  },
]

export const mission08: Scenario = {
  id: 'mission08',
  title: 'Kaledonská hvězda',
  briefing:
    'První společná operace s Kaledonským královstvím: ANS Vanguard a lehký '
    + 'křižník KNS Claymore hlídkují na okraji kaledonské soustavy. Průzkum '
    + 'hlásí imperiální stěnu — dva těžké křižníky a lehký křižník v tiché '
    + 'formaci. Znič ji, ale pamatuj: Claymore ti nepodléhá. Kaledonci jsou '
    + 'stateční až k sebevraždě a jejich kapitán má padlého bratra k pomstění.',
  seed: 19980405, // pevný seed — determinismus
  ambient: '#0e2418', // nádech mlhoviny soustavy (fáze B)

  // hyperlimit kaledonské hvězdy — hlídková linie leží těsně za kružnicí
  hyperlimit: { kind: 'circle', center: { x: -120_000_000, y: 0 }, radius: 100_000_000 },

  ships: [
    {
      // hráčův těžký křižník
      classId: 'ca-bastion', side: 'player', name: 'ANS Vanguard',
      pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      // kaledonský spojenec — doktrína escort: drží se boje u hráče,
      // sám si vybírá hrozby (nepodléhá přímému velení hráče)
      classId: 'cl-sokol', side: 'player', name: 'KNS Claymore',
      pos: { x: -1_500_000, y: 1_500_000 }, vel: { x: 0, y: 0 },
      doctrine: 'escort',
    },
    // imperiální stěna: tichý drift ve formaci; na kontakt přejde do lovu
    {
      classId: 'ca-bastion', side: 'enemy', name: 'IDS Polaris',
      pos: { x: 60_000_000, y: 4_000_000 }, vel: { x: -600, y: 0 },
      doctrine: 'freighter',
    },
    {
      classId: 'ca-bastion', side: 'enemy', name: 'IDS Procyon',
      pos: { x: 60_000_000, y: -4_000_000 }, vel: { x: -600, y: 0 },
      doctrine: 'freighter',
    },
    {
      classId: 'cl-sokol', side: 'enemy', name: 'IDS Capella',
      pos: { x: 63_000_000, y: 0 }, vel: { x: -600, y: 0 },
      doctrine: 'freighter',
    },
  ],

  objectives: [
    { id: 'obj-wall', text: 'Znič nebo donuť ke kapitulaci imperiální stěnu', state: 'open' },
  ],

  triggers: [
    {
      // úvodní komunikace spojence — národnostní tření od první minuty
      id: 'trg-comm-claymore', once: true,
      conditions: [{ kind: 'time', t: 15 }],
      actions: [
        {
          kind: 'comm', speaker: 'comms',
          text: 'KNS Claymore: „Vanguarde, tady kapitán MacAllan. Poletíme s vámi, ale Kaledon se neklaní — a caudillovým vrahům už vůbec ne. Konec."',
        },
      ],
    },
    {
      // kontakt: stěna zapíná lov, jakmile se hráč přiblíží
      id: 'trg-wall-active', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: VANGUARD, shipB: WALL[0], distance: 30_000_000 }],
      actions: [
        { kind: 'message', text: 'Imperiální stěna mění vektor — jdou po nás. Formace drží.' },
        { kind: 'setDoctrine', shipId: WALL[0], doctrine: 'hunter' },
        { kind: 'setDoctrine', shipId: WALL[1], doctrine: 'hunter' },
        { kind: 'setDoctrine', shipId: WALL[2], doctrine: 'hunter' },
        {
          kind: 'comm', speaker: 'enemy-captain',
          text: 'IDS Polaris: „Avalonsko-kaledonská hlídko, Impérium vám dává jedinou možnost: vypněte klíny. Nevyužijete-li ji, poneseme my vaše jména do hlášení."',
        },
      ],
    },

    // ZVRAT: v půlce boje (první zničená loď stěny NEBO t > 5400 s — co
    // nastane dřív) Claymore poruší rozkazy a jde na stěnu sám
    {
      id: 'trg-break-kill', once: true,
      conditions: [{ kind: 'shipsDestroyedCount', side: 'enemy', count: 1 }],
      actions: [{ kind: 'setFlag', flag: 'claymore-breaks' }],
    },
    {
      id: 'trg-break-time', once: true,
      conditions: [{ kind: 'time', t: 5_400 }],
      actions: [{ kind: 'setFlag', flag: 'claymore-breaks' }],
    },
    {
      id: 'trg-claymore-charges', once: true,
      conditions: [{ kind: 'flag', flag: 'claymore-breaks' }],
      actions: [
        {
          kind: 'comm', speaker: 'xo',
          text: 'První důstojník: „Kaledonský kapitán se odtrhl z formace! Ignoruje volání — jde sám na jejich stěnu!"',
        },
        { kind: 'setDoctrine', shipId: CLAYMORE, doctrine: 'hunter' },
        { kind: 'addObjective', objectiveId: 'obj-claymore', text: '(Volitelné) KNS Claymore přežije' },
        { kind: 'message', text: 'Volba je na tobě: rozbít vlastní plán a krýt ho, nebo ho nechat jeho pomstě.' },
      ],
    },
    {
      // zničení Claymoru ⇒ volitelný úkol selhal. once: false — kdyby zvrat
      // (a s ním addObjective) přišel až PO zničení, selhání se dožene;
      // objectiveFail je idempotentní (mění jen stav 'open').
      id: 'trg-claymore-dead', once: false,
      conditions: [{ kind: 'shipDestroyed', shipId: CLAYMORE }],
      actions: [{ kind: 'objectiveFail', objectiveId: 'obj-claymore', text: 'Úkol selhal: KNS Claymore zničen. Kaledon bude truchlit.' }],
    },

    // vyřazení lodí stěny: zničení NEBO kapitulace ⇒ flagy
    ...WALL.flatMap(wallNeutralized),
    {
      // VÝHRA: celá stěna vyřazena; obj-claymore se dokončí jen, je-li stále
      // 'open' (tj. Claymore žije) — 'failed' stav objectiveComplete nepřepíše
      id: 'trg-win', once: true,
      conditions: WALL.map(id => ({ kind: 'flag' as const, flag: neutralized(id) })),
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-wall' },
        { kind: 'objectiveComplete', objectiveId: 'obj-claymore', text: 'Úkol splněn: KNS Claymore přežil vlastní statečnost.' },
        { kind: 'winMission', text: 'Imperiální stěna zničena. Kaledonská hvězda je dnes o poznání bezpečnější.' },
      ],
    },
    {
      // prohra: zničení hráče
      id: 'trg-player-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: VANGUARD }],
      actions: [{ kind: 'loseMission', text: 'ANS Vanguard byla zničena. Spojenectví začíná pohřbem.' }],
    },
  ],
}
