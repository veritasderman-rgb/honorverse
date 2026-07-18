/**
 * Mise 4 — „Tichý pozorovatel" (stealth/EMCON, CL).
 * Balistický průlet nepřátelskou soustavou s vypnutým klínem: zmapovat
 * havenské hlídky jen na pasivech. Zapnutí klínu = okamžité prozrazení.
 * Zvrat: nouzový signál kurýra láká hráče hlouběji do nebezpečí.
 * Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = HMS Apollo (hráč), 2–4 = havenské hlídky, 5 = úniková bóje;
 *   zvratem spawnutý 6 = kurýr Ariel.
 */
import type { Scenario } from '../../sim/types'

const APOLLO = 1
const PATROLS = [2, 3, 4]
const BUOY = 5
const ARIEL = 6

/** flag „hlídka id zmapována" */
const scouted = (id: number): string => `scouted-${id}`

export const mission04: Scenario = {
  id: 'mission04',
  title: 'Tichý pozorovatel',
  briefing:
    'HMS Apollo driftuje s vypnutým klínem do havenské soustavy Seaford. '
    + 'Úkol: jen na pasivních senzorech zmapovat rozmístění hlídek '
    + '(přiblížit se ke každé na 6 mil. km) a vrátit se za hyperlimit. '
    + 'Zapnutí impeleru tě okamžitě prozradí na celou soustavu — bez klínu '
    + 'ale nelze manévrovat. Volba okamžiku je na tobě.',
  seed: 19940829, // pevný seed — determinismus

  ships: [
    {
      // hráčův lehký křižník — balistický drift, klín VYPNUT
      classId: 'cl-courageous', side: 'player', name: 'HMS Apollo',
      pos: { x: 0, y: 0 }, vel: { x: 80, y: 0 },
      doctrine: 'player', wedgeOn: false,
    },
    {
      // havenská hlídka A — drží pozici nad driftovou trasou
      classId: 'cl-courageous', side: 'enemy', name: 'PNS Rousseau',
      pos: { x: 60_000_000, y: 10_000_000 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
    },
    {
      // havenská hlídka B — těžký křižník pod trasou
      classId: 'ca-star-knight', side: 'enemy', name: 'PNS Saladin',
      pos: { x: 90_000_000, y: -12_000_000 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
    },
    {
      // havenská hlídka C — nejhlouběji v soustavě
      classId: 'cl-courageous', side: 'enemy', name: 'PNS Marat',
      pos: { x: 120_000_000, y: 9_000_000 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
    },
    {
      // úniková bóje za hyperlimitem — zpět za startem hráče
      classId: 'merch-freighter', side: 'neutral', name: 'Hyperlimit',
      pos: { x: -200_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
    },
  ],

  objectives: [
    { id: 'obj-map', text: 'Zmapuj havenské síly (ke každé hlídce na 6 mil. km)', state: 'open' },
    { id: 'obj-escape', text: 'Vrať se za hyperlimit', state: 'open' },
  ],

  triggers: [
    // mapování: přiblížení ke každé hlídce na pasivní dosah (< 6 mil. km)
    ...PATROLS.map((id): Scenario['triggers'][0] => ({
      id: `trg-scout-${id}`, once: true,
      conditions: [{ kind: 'distanceBelow', shipA: APOLLO, shipB: id, distance: 6_000_000 }],
      actions: [
        { kind: 'setFlag', flag: scouted(id) },
        { kind: 'message', text: 'Pasivní senzory: emisní profil hlídky zaznamenán.' },
      ],
    })),
    {
      // cíl 1 splněn: všechny tři hlídky zmapovány
      id: 'trg-mapped', once: true,
      conditions: PATROLS.map(id => ({ kind: 'flag' as const, flag: scouted(id) })),
      actions: [
        { kind: 'setFlag', flag: 'mapped' },
        { kind: 'objectiveComplete', objectiveId: 'obj-map' },
      ],
    },
    {
      // ZVRAT: po zmapování zachytíme nouzový signál kurýra
      id: 'trg-ariel', once: true,
      conditions: [{ kind: 'flag', flag: 'mapped' }],
      actions: [
        { kind: 'message', text: 'Nouzový signál kurýra Ariel! Loď driftuje bez pohonu hluboko v soustavě.' },
        {
          kind: 'spawnShip',
          ship: {
            classId: 'disp-courier', side: 'player', name: 'Ariel',
            pos: { x: 100_000_000, y: 30_000_000 }, vel: { x: 30, y: 0 },
            doctrine: 'freighter', wedgeOn: false,
          },
        },
        { kind: 'addObjective', objectiveId: 'obj-rescue', text: '(Volitelné) Zachraň posádku Ariel — přibliž se na 500 tis. km' },
      ],
    },
    {
      // záchrana kurýra
      id: 'trg-rescue', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: APOLLO, shipB: ARIEL, distance: 500_000 }],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-rescue' },
        { kind: 'message', text: 'Posádka Ariel je na palubě. Teď už jen zmizet ze soustavy.' },
      ],
    },

    // DETEKCE: zapnutý klín NEBO přiblížení pod 4 mil. km ke kterékoli hlídce
    {
      id: 'trg-detect-wedge', once: true,
      conditions: [{ kind: 'wedgeOn', shipId: APOLLO }],
      actions: [{ kind: 'setFlag', flag: 'detected' }],
    },
    ...PATROLS.map((id): Scenario['triggers'][0] => ({
      id: `trg-detect-close-${id}`, once: true,
      conditions: [{ kind: 'distanceBelow', shipA: APOLLO, shipB: id, distance: 4_000_000 }],
      actions: [{ kind: 'setFlag', flag: 'detected' }],
    })),
    {
      // prozrazení: hlídky přecházejí do lovu (jen jednou, message jen jednou)
      id: 'trg-detected', once: true,
      conditions: [{ kind: 'flag', flag: 'detected' }],
      actions: [
        { kind: 'message', text: 'Prozrazen! Hlídky zapínají impelery!' },
        { kind: 'setDoctrine', shipId: 2, doctrine: 'hunter' },
        { kind: 'setDoctrine', shipId: 3, doctrine: 'hunter' },
        { kind: 'setDoctrine', shipId: 4, doctrine: 'hunter' },
      ],
    },

    {
      // výhra: se zmapovanými silami zpět za hyperlimit
      id: 'trg-escape', once: true,
      conditions: [
        { kind: 'flag', flag: 'mapped' },
        { kind: 'distanceBelow', shipA: APOLLO, shipB: BUOY, distance: 5_000_000 },
      ],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-escape' },
        { kind: 'winMission', text: 'HMS Apollo unikla za hyperlimit s kompletními průzkumnými daty.' },
      ],
    },
    {
      // prohra: zničení hráče
      id: 'trg-player-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: APOLLO }],
      actions: [
        { kind: 'loseMission', text: 'HMS Apollo byla zničena hluboko v nepřátelské soustavě.' },
      ],
    },
  ],
}
