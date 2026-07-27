/**
 * Boční operace 3 — „Předsunutá hlídka" (volitelná; odemyká se po misi 9).
 * Imperiální hlídka dvou torpédoborců hlídá skokovou trasu, po které má
 * dorazit posila k Cádizu. Rozbij ji dřív, než stačí varovat — kořistí je
 * skladiště raketových plošin, které hlídka kryla.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Vanguard (hráč, BC, vlajka), 2 = ANS Talon (hráč, CL, doprovod),
 *   3 = imperiální hlídka Tercio (DD), 4 = imperiální hlídka Bandera (DD).
 */
import type { Scenario } from '../../sim/types'

const VANGUARD = 1
const PICKET1 = 3
const PICKET2 = 4

const neutralized = (id: number): string => `neutralized-${id}`

const picketNeutralized = (id: number): Scenario['triggers'] => [
  {
    id: `trg-picket-dead-${id}`, once: true,
    conditions: [{ kind: 'shipDestroyed', shipId: id }],
    actions: [{ kind: 'setFlag', flag: neutralized(id) }],
  },
  {
    id: `trg-picket-surrendered-${id}`, once: true,
    conditions: [{ kind: 'shipSurrendered', shipId: id }],
    actions: [
      { kind: 'setFlag', flag: neutralized(id) },
      { kind: 'message', text: 'Imperiální hlídka kapitulovala.' },
    ],
  },
]

export const side03: Scenario = {
  id: 'side03',
  title: 'Předsunutá hlídka',
  briefing:
    'BOČNÍ OPERACE. Imperiální hlídka dvou torpédoborců hlídá skokovou trasu '
    + 'k Cádizu. Tvá dvojice — bitevní křižník ANS Vanguard a lehký křižník '
    + 'ANS Talon — ji má rozbít dřív, než stačí varovat flotilu. Kořistí je '
    + 'kryté skladiště raketových plošin. Zaskoč hlídku a vyřaď obě lodě.',
  seed: 20241111,
  ambient: '#0e1420',
  decor: [
    { kind: 'asteroids', center: { x: 30_000_000, y: 10_000_000 }, radius: 14_000_000, count: 70, seed: 9 },
  ],

  ships: [
    {
      classId: 'bc-praporec', side: 'player', name: 'ANS Vanguard',
      pos: { x: 0, y: 1_500_000 }, vel: { x: 260, y: 0 }, doctrine: 'player',
    },
    {
      classId: 'cl-sokol', side: 'player', name: 'ANS Talon',
      pos: { x: 0, y: -1_500_000 }, vel: { x: 260, y: 0 }, doctrine: 'player',
    },
    {
      classId: 'dd-cadiz', side: 'enemy', name: 'IDS Tercio',
      pos: { x: 30_000_000, y: 4_000_000 }, vel: { x: 0, y: -150 },
      doctrine: 'hunter', activeSensors: true,
    },
    {
      classId: 'dd-cadiz', side: 'enemy', name: 'IDS Bandera',
      pos: { x: 33_000_000, y: -4_000_000 }, vel: { x: 0, y: 150 },
      doctrine: 'hunter', activeSensors: true,
    },
  ],

  objectives: [
    { id: 'obj-picket', text: 'Vyřaď imperiální hlídku (obě lodě)', state: 'open' },
  ],

  triggers: [
    {
      id: 'trg-comm-contact', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: VANGUARD, shipB: PICKET1, distance: 20_000_000 }],
      actions: [{
        kind: 'comm', vo: 's03-c1', speaker: 'enemy-captain',
        text: '„Neznámé impelerové kontakty — dvě lodě, míří na nás. Vyšlete varování k Cádizu!"',
      }],
    },

    ...picketNeutralized(PICKET1),
    ...picketNeutralized(PICKET2),
    {
      id: 'trg-win-picket', once: true,
      conditions: [
        { kind: 'flag', flag: neutralized(PICKET1) },
        { kind: 'flag', flag: neutralized(PICKET2) },
      ],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-picket' },
        { kind: 'winMission', text: 'Hlídka vyřazena. Skladiště plošin je tvoje — a Cádiz zůstal slepý.' },
      ],
    },
    {
      id: 'trg-force-lost', once: true,
      conditions: [{ kind: 'shipsDestroyedCount', side: 'player', count: 2 }],
      actions: [{ kind: 'loseMission', text: 'Úderná dvojice zničena. Hlídka varovala flotilu.' }],
    },
  ],
}
