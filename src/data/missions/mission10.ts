/**
 * Mise 10 — „Kastor" (FINÁLE, dva konce).
 * Kruh se uzavírá: s daty z mise 4 a časem vykoupeným misí 7 vede Rowan
 * útok na nedostavěnou kastorskou základnu. Fáze: průlom hlídkou → pole
 * raketových podů na předvídané ose útoku (zvrat A) → politický rozkaz
 * přerušit útok (zvrat B). Dva plnohodnotné konce: doslovné splnění
 * rozkazu (ústup), nebo jeho duch (dorazit základnu). Padne-li základna
 * dřív, než rozkaz dorazí, je to čisté vítězství a rozkaz už nepřijde.
 * Viz docs/GAME_DESIGN.md kap. 7 a docs/LORE.md M10.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Praporec (vlajková, hráč), 2 = ANS Vanguard (CA),
 *   3 = ANS Aurora (CL — táž loď, která Kastor zmapovala v misi 4),
 *   4 = základna Kastor, 5–6 = hlídkové CA, 7 = hlídkový CL,
 *   8 = ústupová bóje na hyperlimitu.
 */
import type { Scenario, Subsystems } from '../../sim/types'

const FLAGSHIP = 1
const BASE = 4
const PATROL = [5, 6, 7]
const BUOY = 8

/** nedostavěná základna: půlka šachet, díry v protiraketové obraně */
const unfinishedBase = (): Subsystems => ({
  impellerFwd: 1, impellerAft: 1,
  sidewallPort: 1, sidewallStbd: 1,
  tubesPort: 0.5, tubesStbd: 0.5,
  energyPort: 1, energyStbd: 1,
  pdlc: 1, cm: 0.6, sensors: 1, ecm: 1,
})

export const mission10: Scenario = {
  id: 'mission10',
  title: 'Kastor',
  briefing:
    'Finále: útok na soustavu Kastor. Mapy z průzkumu Aurory znáš nazpaměť '
    + 'a díky rozbité logistice je základna pořád jen napůl dostavěná — '
    + 'teď, nebo nikdy. Vedeš úderný svaz: vlajkový bitevní křižník ANS '
    + 'Praporec, těžký křižník ANS Vanguard a lehký křižník ANS Aurora. '
    + 'Od hyperlimitu k základně je hluboko — nejdřív prorazíš hlídku, pak '
    + 'přijde všechno, co si obránce na předvídané ose útoku připravil. '
    + 'Rozkaz Admirality zní: základna nesmí být nikdy dokončena.',
  seed: 20051123, // pevný seed — determinismus

  // hyperlimit Kastoru — svaz přistál na +x a padá dovnitř
  hyperlimit: { kind: 'lineX', x: 150_000_000 },

  ships: [
    {
      // vlajková loď — příchod z +x s náběhovou rychlostí dovnitř
      classId: 'bc-praporec', side: 'player', name: 'ANS Praporec',
      pos: { x: 140_000_000, y: 0 }, vel: { x: -3_000, y: 0 }, doctrine: 'player',
    },
    {
      classId: 'ca-bastion', side: 'player', name: 'ANS Vanguard',
      pos: { x: 141_000_000, y: 1_000_000 }, vel: { x: -3_000, y: 0 }, doctrine: 'player',
    },
    {
      classId: 'cl-sokol', side: 'player', name: 'ANS Aurora',
      pos: { x: 141_000_000, y: -1_000_000 }, vel: { x: -3_000, y: 0 }, doctrine: 'player',
    },
    {
      // nedostavěná základna hluboko v soustavě: nehybná, ale střílí —
      // AUTO palba na vlajkovou loď, jakmile se dostane do poháněné obálky
      classId: 'station-zeta', side: 'enemy', name: 'Základna Kastor',
      pos: { x: -120_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0, nav: null,
      hull: 300, subsystems: unfinishedBase(), activeSensors: true,
      fireControl: { mode: 'auto', targetId: FLAGSHIP, salvoSize: 6, driveMode: 0, engaged: false },
    },
    // hlídka základny: tichý drift, na detekci svazu přejde do lovu
    {
      classId: 'ca-bastion', side: 'enemy', name: 'VDS Zarja',
      pos: { x: -104_000_000, y: 6_000_000 }, vel: { x: 250, y: 0 },
      doctrine: 'freighter',
    },
    {
      classId: 'ca-bastion', side: 'enemy', name: 'VDS Uragan',
      pos: { x: -104_000_000, y: -6_000_000 }, vel: { x: 250, y: 0 },
      doctrine: 'freighter',
    },
    {
      classId: 'cl-sokol', side: 'enemy', name: 'VDS Altair',
      pos: { x: -100_000_000, y: 0 }, vel: { x: 250, y: 0 },
      doctrine: 'freighter',
    },
    {
      // ústupová bóje na hyperlimitu (konec A: doslovné splnění rozkazu)
      classId: 'merch-freighter', side: 'neutral', name: 'Hyperlimit',
      pos: { x: 155_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
    },
  ],

  objectives: [
    { id: 'obj-base', text: 'Znič nedostavěnou základnu Kastor', state: 'open' },
  ],

  triggers: [
    {
      // úvod: XO uzavírá kruh — mapy z mise 4, čas z mise 7
      id: 'trg-intro', once: true,
      conditions: [{ kind: 'time', t: 15 }],
      actions: [
        {
          kind: 'comm', speaker: 'xo',
          text: 'První důstojník: „Rozestavění hlídek sedí na Auroryny mapy do posledního kilometru, pane. A konvoj, co jsme potopili u Keravu, tady pořád chybí — základna má poloviční šachty. Tohle okno jsme si vykoupili sami."',
        },
      ],
    },

    // FÁZE 1 — průlom hlídkou: detekce svazu pod 40 mil. km budí hlídku
    ...PATROL.map((id): Scenario['triggers'][0] => ({
      id: `trg-patrol-contact-${id}`, once: true,
      conditions: [{ kind: 'distanceBelow', shipA: FLAGSHIP, shipB: id, distance: 40_000_000 }],
      actions: [{ kind: 'setFlag', flag: 'patrol-alert' }],
    })),
    {
      id: 'trg-patrol-wakes', once: true,
      conditions: [{ kind: 'flag', flag: 'patrol-alert' }],
      actions: [
        { kind: 'message', text: 'Hlídka základny mění vektor — jdou po nás. Průlom začíná.' },
        { kind: 'setDoctrine', shipId: PATROL[0], doctrine: 'hunter' },
        { kind: 'setDoctrine', shipId: PATROL[1], doctrine: 'hunter' },
        { kind: 'setDoctrine', shipId: PATROL[2], doctrine: 'hunter' },
        {
          kind: 'comm', speaker: 'enemy-captain',
          text: 'VDS Zarja: „Albionský svaze, tady hlídka soustavy Kastor. Věděli jsme, že přijdete — historická nutnost má i vaše souřadnice. Palba bez další výzvy."',
        },
      ],
    },

    {
      // ZVRAT A: pole raketových podů na předvídané ose útoku — vlajková
      // loď pod 60 mil. km od základny ⇒ saturační salva 32 raket
      id: 'trg-podfield', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: FLAGSHIP, shipB: BASE, distance: 60_000_000 }],
      actions: [
        { kind: 'podSalvo', shipId: BASE, targetId: FLAGSHIP, count: 32 },
        { kind: 'message', text: 'Pole podů! Salva 32 raket!' },
        {
          kind: 'comm', speaker: 'tactical',
          text: 'Taktický: „Zaseli nám je přímo do osy útoku — věděli, kudy poletíme. Manévr a geometrie, kapitáne, municí tohle neustojíme!"',
        },
      ],
    },

    // ZVRAT B — politický rozkaz: základna poškozená pod 60 % NEBO oba
    // hlídkové CA zničeny ⇒ Admiralita nařizuje přerušit útok
    {
      id: 'trg-order-cause-hull', once: true,
      conditions: [{ kind: 'hullBelow', shipId: BASE, fraction: 0.6 }],
      actions: [{ kind: 'setFlag', flag: 'order-cause' }],
    },
    {
      id: 'trg-order-cause-cas', once: true,
      conditions: [
        { kind: 'shipDestroyed', shipId: PATROL[0] },
        { kind: 'shipDestroyed', shipId: PATROL[1] },
      ],
      actions: [{ kind: 'setFlag', flag: 'order-cause' }],
    },
    // pád základny (zničení či kapitulace) ⇒ flag; MUSÍ být v poli PŘED
    // trg-order — padne-li základna v témže ticku, rozkaz už nedorazí
    {
      id: 'trg-base-dead', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: BASE }],
      actions: [{ kind: 'setFlag', flag: 'base-down' }],
    },
    {
      id: 'trg-base-surrendered', once: true,
      conditions: [{ kind: 'shipSurrendered', shipId: BASE }],
      actions: [
        { kind: 'setFlag', flag: 'base-down' },
        { kind: 'message', text: 'Základna Kastor vypíná zbraňové systémy a kapituluje.' },
      ],
    },
    {
      // rozkaz přijde, jen dokud základna stojí (flagNot base-down)
      id: 'trg-order', once: true,
      conditions: [
        { kind: 'flag', flag: 'order-cause' },
        { kind: 'flagNot', flag: 'base-down' },
      ],
      actions: [
        {
          kind: 'comm', speaker: 'governor',
          text: 'Guvernér: „Rozkaz Admirality: okamžitě přerušte útok a stáhněte se — diplomaté podepsali příměří. Opakuji: stáhněte se."',
        },
        { kind: 'setFlag', flag: 'order-given' },
        { kind: 'addObjective', objectiveId: 'obj-retreat', text: 'Volba: stáhni se za hyperlimit — nebo dokonči útok' },
        { kind: 'message', text: 'Doslovné znění rozkazu, nebo jeho duch? Základna stojí a příměří platí až za hodinu.' },
      ],
    },

    // KONCE (vzájemně výlučné přes flag/flagNot 'order-given')
    {
      // čisté vítězství: základna padla DŘÍV, než rozkaz dorazil
      id: 'trg-ending-clean', once: true,
      conditions: [
        { kind: 'flag', flag: 'base-down' },
        { kind: 'flagNot', flag: 'order-given' },
      ],
      actions: [
        { kind: 'setFlag', flag: 'ending-clean' },
        { kind: 'objectiveComplete', objectiveId: 'obj-base' },
        { kind: 'winMission', text: 'Základna Kastor je pryč. Rozkaz splněn do písmene — a žádný jiný už nedorazil.' },
      ],
    },
    {
      // konec B „Duch rozkazu": hráč základnu dorazil i po příchodu rozkazu
      id: 'trg-ending-spirit', once: true,
      conditions: [
        { kind: 'flag', flag: 'base-down' },
        { kind: 'flag', flag: 'order-given' },
      ],
      actions: [
        { kind: 'setFlag', flag: 'ending-spirit' },
        { kind: 'objectiveComplete', objectiveId: 'obj-base' },
        { kind: 'winMission', text: 'Základna padla minutu před platností příměří — Kastor už Direktoriát nikdy neopevní.' },
      ],
    },
    {
      // konec A „Rozkaz je rozkaz": ústup vlajkové lodi za hyperlimit
      // (k ústupové bóji) BEZ zničení základny
      id: 'trg-ending-orders', once: true,
      conditions: [
        { kind: 'flag', flag: 'order-given' },
        { kind: 'flagNot', flag: 'base-down' },
        { kind: 'distanceBelow', shipA: FLAGSHIP, shipB: BUOY, distance: 8_000_000 },
      ],
      actions: [
        { kind: 'setFlag', flag: 'ending-orders' },
        { kind: 'objectiveComplete', objectiveId: 'obj-retreat' },
        { kind: 'winMission', text: 'Svaz se stáhl za hyperlimit. Příměří platí — a základna Kastor stojí. Hořké vítězství je pořád vítězství. Snad.' },
      ],
    },
    {
      // prohra: zničení vlajkové lodi
      id: 'trg-flagship-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: FLAGSHIP }],
      actions: [{ kind: 'loseMission', text: 'ANS Praporec zůstal v Kastoru navždy. Válka skončí bez tebe.' }],
    },
  ],
}
