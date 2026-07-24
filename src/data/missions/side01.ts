/**
 * Boční operace 1 — „Tísňové volání" (volitelná; odemyká se po misi 2).
 * Kurýrní loď Wren vysílá nouzový signál: dva pirátští nájezdníci ji ženou
 * Pomezím k hyperskoku. Vpluješ s lehkým křižníkem a máš ji dovést do bezpečí
 * (nebo nájezdníky vyřídit) dřív, než ji doženou.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Petrel (hráč, CL), 2 = kurýr Wren (chráněný), 3 = pirát Rys (CL),
 *   4 = pirát Sup (DD), 5 = skoková bóje (cíl úniku kurýra).
 */
import type { Scenario } from '../../sim/types'

const PETREL = 1
const WREN = 2
const PIRATE1 = 3
const PIRATE2 = 4
const JUMP = 5

/** skoková bóje — bezpečný výstup z Pomezí (~55 mil. km po ose +x) */
const DEST = { x: 55_000_000, y: 0 }

/** flag „pirát vyřazen" — zničen NEBO kapituloval */
const neutralized = (id: number): string => `neutralized-${id}`

const pirateNeutralized = (id: number): Scenario['triggers'] => [
  {
    id: `trg-pirate-dead-${id}`, once: true,
    conditions: [{ kind: 'shipDestroyed', shipId: id }],
    actions: [{ kind: 'setFlag', flag: neutralized(id) }],
  },
  {
    id: `trg-pirate-surrendered-${id}`, once: true,
    conditions: [{ kind: 'shipSurrendered', shipId: id }],
    actions: [
      { kind: 'setFlag', flag: neutralized(id) },
      { kind: 'message', text: 'Nájezdník kapituloval.' },
    ],
  },
]

export const side01: Scenario = {
  id: 'side01',
  title: 'Tísňové volání',
  briefing:
    'BOČNÍ OPERACE. Kurýr Wren vysílá nouzový signál z Pomezí: dva pirátští '
    + 'nájezdníci ho ženou k hyperskoku. Tvůj lehký křižník ANS Petrel je '
    + 'nejblíž. Interpozuj se mezi kurýra a nájezdníky a doveď Wren ke skokové '
    + 'bóji — nebo nájezdníky vyřaď. Kurýr se sám neubrání; drž se mezi ním '
    + 'a hrozbou, nech piráty zkrátit vzdálenost a ber je zblízka.',
  seed: 20240419,
  ambient: '#101a26',
  decor: [
    { kind: 'asteroids', center: { x: 24_000_000, y: -14_000_000 }, radius: 12_000_000, count: 60, seed: 5 },
  ],
  hyperlimit: { kind: 'lineX', x: 55_000_000 },

  ships: [
    {
      classId: 'cl-sokol', side: 'player', name: 'ANS Petrel',
      pos: { x: 6_000_000, y: 16_000_000 }, vel: { x: 0, y: -200 }, doctrine: 'player',
    },
    {
      // kurýr prchá k bóji, sám bez obrany
      classId: 'disp-courier', side: 'player', name: 'Wren',
      pos: { x: 0, y: 0 }, vel: { x: 300, y: 0 }, doctrine: 'freighter',
      nav: { kind: 'course', dest: { ...DEST }, arriveAtRest: false },
      desc: 'Kurýrní loď v tísni. Bez klínu na obranu, jen rychlost. Doveď ji ke skokové bóji.',
    },
    {
      classId: 'cl-korzar', side: 'enemy', name: 'Rys',
      pos: { x: -13_000_000, y: 2_500_000 }, vel: { x: 300, y: 0 },
      doctrine: 'pirate', activeSensors: true,
    },
    {
      classId: 'dd-korzar', side: 'enemy', name: 'Sup',
      pos: { x: -15_000_000, y: -2_500_000 }, vel: { x: 300, y: 0 },
      doctrine: 'pirate', activeSensors: true,
    },
    {
      classId: 'merch-freighter', side: 'neutral', name: 'Skoková bóje',
      pos: { ...DEST }, vel: { x: 0, y: 0 }, doctrine: 'buoy', wedgeOn: false, throttle: 0,
      desc: 'Skoková bóje na okraji Pomezí — bezpečný výstup pro kurýra.',
    },
  ],

  objectives: [
    { id: 'obj-protect', text: 'Doveď kurýra Wren ke skokové bóji', state: 'open' },
    { id: 'obj-raiders', text: 'Znič nebo zažeň nájezdníky', state: 'open' },
  ],

  triggers: [
    {
      // pirát vyhrožuje, jakmile se přiblíží ke kurýrovi
      id: 'trg-comm-threat', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: WREN, shipB: PIRATE1, distance: 20_000_000 }],
      actions: [{
        kind: 'comm', speaker: 'pirate',
        text: '„Kurýre, vypni stroje. Ta korveta od námořnictva k tobě nedoletí včas."',
      }],
    },

    // vyřazení pirátů → flagy; oba vyřazené = splněný vedlejší cíl
    ...pirateNeutralized(PIRATE1),
    ...pirateNeutralized(PIRATE2),
    {
      id: 'trg-raiders-clear', once: true,
      conditions: [
        { kind: 'flag', flag: neutralized(PIRATE1) },
        { kind: 'flag', flag: neutralized(PIRATE2) },
      ],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-raiders' },
        { kind: 'message', text: 'Oba nájezdníci vyřazeni — kurýr je z nejhoršího venku.' },
      ],
    },

    {
      // ZTRÁTA kurýra — z KONKRÉTNÍ podmínky (ne z obecné smrti lodi):
      // označí vedlejší cíl jako selhaný a končí misi porážkou
      id: 'trg-wren-lost', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: WREN }],
      actions: [
        { kind: 'setFlag', flag: 'wren-lost' },
        { kind: 'objectiveFail', objectiveId: 'obj-protect' },
        { kind: 'loseMission', text: 'Kurýr Wren byl zničen. Tísňové volání utichlo.' },
      ],
    },
    {
      // VÍTĚZSTVÍ — kurýr dorazil ke skokové bóji a JE naživu (flagNot wren-lost)
      id: 'trg-win-escape', once: true,
      conditions: [
        { kind: 'distanceBelow', shipA: WREN, shipB: JUMP, distance: 4_000_000 },
        { kind: 'flagNot', flag: 'wren-lost' },
      ],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-protect' },
        { kind: 'winMission', text: 'Wren skočila do bezpečí. Tísňové volání vyřízeno.' },
      ],
    },
    {
      // prohra: zničení hráčova křižníku
      id: 'trg-player-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: PETREL }],
      actions: [{ kind: 'loseMission', text: 'ANS Petrel byla zničena.' }],
    },
  ],
}
