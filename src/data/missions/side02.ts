/**
 * Boční operace 2 — „Pirátský sklad" (volitelná; odemyká se po misi 5).
 * Zpravodajství z Pomezí zaměřilo skrytý pirátský přístav — depot zásob
 * placený imperiálními penězi. Průzkum bojem: rozbij depot a jeho stráže,
 * než stačí uklidit zásoby a zmizet.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Rampart (hráč, CA, vlajka), 2 = ANS Skua (hráč, DD, doprovod),
 *   3 = depot (stanice, cíl), 4 = stráž Kojot (CL), 5 = stráž Šakal (DD).
 */
import type { Scenario } from '../../sim/types'

const RAMPART = 1
const DEPOT = 3
const GUARD1 = 4
const GUARD2 = 5

/** flag „stráž vyřazena" — zničena NEBO kapitulovala */
const neutralized = (id: number): string => `neutralized-${id}`

const guardNeutralized = (id: number): Scenario['triggers'] => [
  {
    id: `trg-guard-dead-${id}`, once: true,
    conditions: [{ kind: 'shipDestroyed', shipId: id }],
    actions: [{ kind: 'setFlag', flag: neutralized(id) }],
  },
  {
    id: `trg-guard-surrendered-${id}`, once: true,
    conditions: [{ kind: 'shipSurrendered', shipId: id }],
    actions: [
      { kind: 'setFlag', flag: neutralized(id) },
      { kind: 'message', text: 'Stráž skladu kapitulovala.' },
    ],
  },
]

export const side02: Scenario = {
  id: 'side02',
  title: 'Pirátský sklad',
  briefing:
    'BOČNÍ OPERACE. Zpravodajství zaměřilo skrytý pirátský přístav v Pomezí — '
    + 'depot zásob a munice, který drží nájezdy nad vodou. Tvá dvojice, těžký '
    + 'křižník ANS Rampart a torpédoborec ANS Skua, má přístav rozbít. Depot '
    + 'chrání dvě lehké lodě. Znič sklad — a stráže, pokud se postaví. Táhneš '
    + 'i raketové plošiny: nasyp je do stráží, ať Rampart vplují ke skladu čistě.',
  seed: 20240705,
  ambient: '#1a1410',
  decor: [
    { kind: 'asteroids', center: { x: 40_000_000, y: 0 }, radius: 20_000_000, count: 120, seed: 7 },
  ],

  ships: [
    {
      classId: 'ca-bastion', side: 'player', name: 'ANS Rampart',
      pos: { x: 0, y: 1_500_000 }, vel: { x: 250, y: 0 }, doctrine: 'player',
    },
    {
      classId: 'dd-vichr', side: 'player', name: 'ANS Skua',
      pos: { x: 0, y: -1_500_000 }, vel: { x: 250, y: 0 }, doctrine: 'player',
    },
    {
      // depot: statická stanice ukrytá v asteroidovém poli
      classId: 'station-zeta', side: 'enemy', name: 'Pirátský depot',
      pos: { x: 42_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0, activeSensors: true,
      desc: 'Skrytý pirátský přístav — sklad zásob a munice. Rozbij ho.',
    },
    {
      classId: 'cl-korzar', side: 'enemy', name: 'Kojot',
      pos: { x: 34_000_000, y: 6_000_000 }, vel: { x: 0, y: 0 },
      doctrine: 'pirate', activeSensors: true,
    },
    {
      classId: 'dd-korzar', side: 'enemy', name: 'Šakal',
      pos: { x: 34_000_000, y: -6_000_000 }, vel: { x: 0, y: 0 },
      doctrine: 'pirate', activeSensors: true,
    },
  ],

  objectives: [
    { id: 'obj-depot', text: 'Znič pirátský sklad', state: 'open' },
    { id: 'obj-guards', text: 'Vyřaď stráže skladu', state: 'open' },
  ],

  triggers: [
    {
      // stráže zahlásí vetřelce, jakmile hráč vpluje na dosah senzorů
      id: 'trg-comm-alarm', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: RAMPART, shipB: GUARD1, distance: 22_000_000 }],
      actions: [{
        kind: 'comm', vo: 's02-c1', speaker: 'pirate',
        text: '„Máme společnost — námořnictvo našlo přístav! Kryjte sklad, ať stihnou naložit!"',
      }],
    },

    // vyřazení stráží → flagy; obě = splněný vedlejší cíl
    ...guardNeutralized(GUARD1),
    ...guardNeutralized(GUARD2),
    {
      id: 'trg-guards-clear', once: true,
      conditions: [
        { kind: 'flag', flag: neutralized(GUARD1) },
        { kind: 'flag', flag: neutralized(GUARD2) },
      ],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-guards' },
        { kind: 'message', text: 'Stráže vyřazeny — depot je bez krytí.' },
      ],
    },

    {
      // VÍTĚZSTVÍ — depot zničen
      id: 'trg-win-depot', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: DEPOT }],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-depot' },
        { kind: 'winMission', text: 'Pirátský sklad rozbit. Nájezdy Pomezím zůstanou o zásoby kratší.' },
      ],
    },
    {
      // prohra: oba hráčovy trupy zničeny
      id: 'trg-force-lost', once: true,
      conditions: [{ kind: 'shipsDestroyedCount', side: 'player', count: 2 }],
      actions: [{ kind: 'loseMission', text: 'Úderná dvojice zničena. Přístav přežil.' }],
    },
  ],
}
