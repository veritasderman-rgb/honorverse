/**
 * Mise 5 — „Stanice Zeta" (obrana pevného bodu, CA).
 * Tři vlny nájezdníků proti orbitální stanici; vlny přicházejí postupně,
 * zásobníky nejsou bezedné — lekce hospodaření s municí. Zvrat: v poslední
 * vlně letí mezi útočníky unesená nákladní loď s civilními rukojmími.
 * Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Bastion (hráč), 2 = stanice Zeta.
 * Lodě spawnuté triggery mají PEVNÁ id 90xx (nextId za běhu roste o id
 * raket/salv, pořadí by nebylo predikovatelné):
 *   vlna 1: 9011–9012 (2× DD), vlna 2: 9021–9023 (3× DD),
 *   vlna 3: 9031 (CL) + 9032–9033 (2× DD) + 9034 (unesený obchodník Meridian).
 *
 * Pacing vln: engine nemá relativní časové podmínky („flag + 600 s"), proto
 * další vlna startuje hned po vyřazení předchozí, ale z ~50 mil. km — doba
 * doletu dává hráči přirozenou pauzu na opravy a rozvahu o munici.
 */
import type { Scenario } from '../../sim/types'

const BASTION = 1
const STATION = 2
const WAVE1 = [9011, 9012]
const WAVE2 = [9021, 9022, 9023]
const WAVE3 = [9031, 9032, 9033]
const CIVILIAN = 9034
const COMBATANTS = [...WAVE1, ...WAVE2, ...WAVE3]

/** flag „nájezdník id vyřazen" — zničen NEBO kapituloval */
const neutralized = (id: number): string => `neutralized-${id}`

/** dvojice triggerů per nájezdník: zničení i kapitulace nastaví tentýž flag */
const raiderNeutralized = (id: number): Scenario['triggers'] => [
  {
    id: `trg-raider-dead-${id}`, once: true,
    conditions: [{ kind: 'shipDestroyed', shipId: id }],
    actions: [{ kind: 'setFlag', flag: neutralized(id) }],
  },
  {
    id: `trg-raider-surrendered-${id}`, once: true,
    conditions: [{ kind: 'shipSurrendered', shipId: id }],
    actions: [
      { kind: 'setFlag', flag: neutralized(id) },
      { kind: 'message', text: 'Nájezdník kapituloval — o jednu hrozbu pro stanici méně.' },
    ],
  },
]

/** nájezdník vlny: pevné id, kurz zhruba na stanici (vektor v pos→[0,0]) */
const raider = (
  id: number, classId: string, name: string, x: number, y: number, speed: number,
): Scenario['triggers'][0]['actions'][0] => {
  const d = Math.hypot(x, y)
  return {
    kind: 'spawnShip',
    ship: {
      id, classId, side: 'enemy', name,
      pos: { x, y }, vel: { x: -speed * (x / d), y: -speed * (y / d) },
      doctrine: 'hunter', activeSensors: true,
    },
  }
}

export const mission05: Scenario = {
  id: 'mission05',
  title: 'Stanice Zeta',
  briefing:
    'Těžký křižník ANS Bastion drží obrannou pozici u orbitální stanice Zeta '
    + 'na okraji Pomezí. Zpravodajství hlásí velký pirátský svaz — čekej útok '
    + 'v několika vlnách. Stanice se ubrání jen s tvou pomocí: drž se u ní, '
    + 'vrstvi obranu (protirakety, bodová obrana, rolování) a HOSPODAŘ '
    + 'S MUNICÍ — zásobníky nejsou bezedné a nikdo ti je uprostřed boje '
    + 'nedoplní. Znič nebo zažeň všechny nájezdníky.',
  seed: 19950307, // pevný seed — determinismus

  // hyperlimit soustavy: nájezdníci „přistávají" za čárou a najíždějí dovnitř
  hyperlimit: { kind: 'lineX', x: 45_000_000 },

  ships: [
    {
      // hráčův těžký křižník na hlídkové pozici u stanice
      classId: 'ca-bastion', side: 'player', name: 'ANS Bastion',
      pos: { x: 2_000_000, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      // orbitální stanice — nehybný opěrný bod (štítové generátory místo klínu)
      classId: 'station-zeta', side: 'player', name: 'Stanice Zeta',
      pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0, nav: null,
    },
  ],

  objectives: [
    { id: 'obj-defend', text: 'Ubraň stanici Zeta — znič nebo zažeň všechny nájezdníky', state: 'open' },
  ],

  triggers: [
    {
      // VLNA 1: dva torpédoborce z +x, ~50 mil. km
      id: 'trg-wave1', once: true,
      conditions: [{ kind: 'time', t: 600 }],
      actions: [
        { kind: 'message', text: 'Dva impelerové kontakty za hyperlimitem — první vlna najíždí na stanici!' },
        {
          kind: 'comm', speaker: 'station',
          text: 'Stanice Zeta: „Bastione, vidíme je taky. Tři tisíce lidí na palubě spoléhá, že je nepustíte blíž."',
        },
        raider(9011, 'dd-vichr', 'Sup', 50_000_000, 3_000_000, 2_000),
        raider(9012, 'dd-vichr', 'Krahujec', 50_000_000, -3_000_000, 2_000),
      ],
    },
    {
      // VLNA 2: tři torpédoborce ze dvou vektorů (po vyřazení vlny 1)
      id: 'trg-wave2', once: true,
      conditions: WAVE1.map(id => ({ kind: 'flag' as const, flag: neutralized(id) })),
      actions: [
        { kind: 'message', text: 'Druhá vlna! Tři kontakty ze dvou vektorů — šetři protirakety, tohle není konec.' },
        raider(9021, 'dd-vichr', 'Vlk', 40_000_000, 30_000_000, 2_000),
        raider(9022, 'dd-vichr', 'Rys', 44_000_000, 27_000_000, 2_000),
        raider(9023, 'dd-vichr', 'Kuna', 42_000_000, -32_000_000, 2_000),
      ],
    },
    {
      // VLNA 3: lehký křižník + dva DD; mezi nimi „neznámá loď" letící
      // stejným vektorem — unesený obchodník s civilisty (zvrat)
      id: 'trg-wave3', once: true,
      conditions: WAVE2.map(id => ({ kind: 'flag' as const, flag: neutralized(id) })),
      actions: [
        { kind: 'message', text: 'Poslední vlna — křižník a dva torpédoborce. Mezi nimi letí čtvrtý kontakt se slabším klínem.' },
        {
          kind: 'comm', speaker: 'pirate',
          text: '„Stanice Zeta, tohle je poslední nabídka: otevřete doky a vydejte sklady, nebo je rozbijeme i s vámi."',
        },
        raider(9031, 'cl-sokol', 'Drak', 52_000_000, -8_000_000, 2_200),
        raider(9032, 'dd-vichr', 'Zmije', 50_000_000, -5_000_000, 2_200),
        raider(9033, 'dd-vichr', 'Štír', 54_000_000, -11_000_000, 2_200),
        {
          // unesený obchodník: stejný vektor jako vlna, ale civilní doktrína
          // (žádná palba) — do odhalení vypadá jen jako další rudá stopa
          kind: 'spawnShip',
          ship: {
            id: CIVILIAN, classId: 'merch-freighter', side: 'enemy', name: 'Meridian',
            pos: { x: 52_500_000, y: -8_500_000 },
            vel: { x: -2_200 * 0.987, y: 2_200 * 0.16 }, doctrine: 'freighter',
          },
        },
      ],
    },

    // ZVRAT: odhalení civilistů — přiblížením pod 4 mil. km NEBO klasifikací
    {
      id: 'trg-civ-close', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: BASTION, shipB: CIVILIAN, distance: 4_000_000 }],
      actions: [{ kind: 'setFlag', flag: 'civ-known' }],
    },
    {
      id: 'trg-civ-classified', once: true,
      conditions: [{ kind: 'classified', shipId: CIVILIAN, side: 'player' }],
      actions: [{ kind: 'setFlag', flag: 'civ-known' }],
    },
    {
      id: 'trg-civ-reveal', once: true,
      conditions: [{ kind: 'flag', flag: 'civ-known' }],
      actions: [
        {
          kind: 'comm', speaker: 'comms',
          text: 'Spojař: „Kapitáne, ten čtvrtý kontakt… transpondér nákladní lodi Meridian a nouzové kódy — to je unesený obchodník s civilisty! Nestřílet!"',
        },
        { kind: 'revealClass', shipId: CIVILIAN, text: 'Kontakt identifikován: unesená nákladní loď Meridian — civilisté na palubě!' },
        { kind: 'addObjective', objectiveId: 'obj-civ', text: '(Skrytý) Nezabij civilisty na palubě Meridianu' },
      ],
    },
    {
      // zničení civilistů: skrytý úkol selhal (pokud ještě nebyl odhalen,
      // přidá se a hned selže — výčitka dorazí tak jako tak)
      id: 'trg-civ-dead', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: CIVILIAN }],
      actions: [
        { kind: 'addObjective', objectiveId: 'obj-civ', text: '(Skrytý) Nezabij civilisty na palubě Meridianu' },
        { kind: 'objectiveFail', objectiveId: 'obj-civ' },
        {
          kind: 'comm', speaker: 'xo',
          text: 'První důstojník: „…Meridian je pryč, pane. Byli tam civilisté. Tohle si poneseme domů."',
        },
      ],
    },

    // vyřazení nájezdníků: zničení NEBO kapitulace ⇒ flag neutralized-<id>
    ...COMBATANTS.flatMap(raiderNeutralized),
    {
      // VÝHRA: všechny bojové lodě všech vln vyřazeny (civilista se nepočítá);
      // obj-civ se dokončí, jen pokud je stále open (nefailnutý a odhalený)
      id: 'trg-win', once: true,
      conditions: COMBATANTS.map(id => ({ kind: 'flag' as const, flag: neutralized(id) })),
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-defend' },
        { kind: 'objectiveComplete', objectiveId: 'obj-civ', text: 'Úkol splněn: civilisté na palubě Meridianu přežili.' },
        { kind: 'winMission', text: 'Všechny vlny odraženy. Stanice Zeta hlásí: doky otevřené, kafe teplé.' },
      ],
    },
    {
      // prohra: zničení stanice
      id: 'trg-station-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: STATION }],
      actions: [{ kind: 'loseMission', text: 'Stanice Zeta byla zničena i s posádkou.' }],
    },
    {
      // prohra: zničení hráče
      id: 'trg-player-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: BASTION }],
      actions: [{ kind: 'loseMission', text: 'ANS Bastion byla zničena — stanice zůstala bez obrany.' }],
    },
  ],
}
