/**
 * Mise 4 — „Tichý pozorovatel" (stealth/EMCON, CL).
 * Balistický průlet nepřátelskou soustavou s vypnutým klínem: zmapovat
 * imperiální hlídky jen na pasivech. Zapnutí klínu = okamžité prozrazení.
 * Zvrat: nouzový signál kurýra láká hráče hlouběji do nebezpečí.
 * Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Aurora (hráč), 2–4 = imperiální hlídky, 5 = úniková bóje;
 *   zvratem spawnutý 6 = kurýr Hermes.
 */
import type { Scenario } from '../../sim/types'

const AURORA = 1
const PATROLS = [2, 3, 4]
const BUOY = 5
const HERMES = 6

/** flag „hlídka id zmapována" */
const scouted = (id: number): string => `scouted-${id}`

export const mission04: Scenario = {
  id: 'mission04',
  title: 'Tichý pozorovatel',
  briefing:
    'ANS Aurora vklouzla do imperiální soustavy Cádiz rychlým průletem '
    + 'a zhasla klín — dál letí balisticky 2 000 km/s. Úkol: jen na pasivech '
    + 'zmapovat hlídky (ke každé na 6 mil. km, ale POZOR — pod 4 mil. km tě '
    + 'zaměří i potichu) a uniknout za protější hyperlimit. Bez klínu máš '
    + 'jen manévrovací trysky (~5 g) — korekce dráhy plánuj hodiny dopředu. '
    + 'Zapnutí impeleru tě prozradí na celou soustavu. '
    + 'VÝCVIK: senzorový duel a EMCON — kdo vyzařuje, toho je vidět; '
    + 'ticho je zbraň.',
  seed: 19940829, // pevný seed — determinismus
  ambient: '#2a1410', // nádech mlhoviny soustavy (fáze B)

  // hyperlimit soustavy Cádiz — úniková čára na +x (průlet soustavou)
  hyperlimit: { kind: 'lineX', x: 250_000_000 },

  ships: [
    {
      // hráčův lehký křižník — balistický drift 2000 km/s, klín VYPNUT;
      // hlídky leží 5–7,5 mil. km od dráhy: mapovací koridor 4–6 mil. km
      // vyžaduje korekce tryskami s hodinovým předstihem (jádro mise)
      classId: 'cl-sokol', side: 'player', name: 'ANS Aurora',
      pos: { x: 0, y: 0 }, vel: { x: 2_000, y: 0 },
      doctrine: 'player', wedgeOn: false,
    },
    {
      // imperiální hlídka A — kousek nad driftovou trasou (v koridoru)
      classId: 'cl-sokol', side: 'enemy', name: 'IDS Antares',
      pos: { x: 60_000_000, y: 5_000_000 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
    },
    {
      // imperiální hlídka B — těžký křižník pod trasou (nutná korekce k −y)
      classId: 'ca-bastion', side: 'enemy', name: 'IDS Rigel',
      pos: { x: 95_000_000, y: -7_500_000 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
    },
    {
      // imperiální hlídka C — nejhlouběji, zpět nad trasou (korekce k +y)
      classId: 'cl-sokol', side: 'enemy', name: 'IDS Altair',
      pos: { x: 130_000_000, y: 5_500_000 }, vel: { x: 0, y: 0 }, doctrine: 'freighter',
    },
    {
      // úniková bóje za protějším hyperlimitem — po směru driftu
      classId: 'merch-freighter', side: 'neutral', name: 'Hyperlimit',
      pos: { x: 260_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
      desc: 'Navigační bod na hyperlimitu soustavy Cádiz. Za touto čarou může Aurora skočit do hyperprostoru — jediná cesta domů se záznamy.',
    },
  ],

  objectives: [
    { id: 'obj-map', text: 'Zmapuj imperiální síly (ke každé hlídce na 6 mil. km)', state: 'open' },
    { id: 'obj-escape', text: 'Vrať se za hyperlimit', state: 'open' },
  ],

  triggers: [
    // mapování: přiblížení ke každé hlídce na pasivní dosah (< 6 mil. km)
    ...PATROLS.map((id): Scenario['triggers'][0] => ({
      id: `trg-scout-${id}`, once: true,
      conditions: [{ kind: 'distanceBelow', shipA: AURORA, shipB: id, distance: 6_000_000 }],
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
      id: 'trg-hermes', once: true,
      conditions: [{ kind: 'flag', flag: 'mapped' }],
      actions: [
        { kind: 'message', text: 'Nouzový signál kurýra Hermes! Loď driftuje bez pohonu hluboko v soustavě.' },
        {
          // zachycené nouzové volání kurýra
          kind: 'comm', speaker: 'comms',
          text: 'Zachycené nouzové volání: „…tady kurýr Hermes, pohon vyřazen, driftujeme… kyslík na dva dny… prosím, slyší nás někdo?"',
        },
        {
          kind: 'spawnShip',
          ship: {
            classId: 'disp-courier', side: 'player', name: 'Hermes',
            pos: { x: 165_000_000, y: -15_000_000 }, vel: { x: 30, y: 0 },
            doctrine: 'freighter', wedgeOn: false,
          },
        },
        { kind: 'addObjective', objectiveId: 'obj-rescue', text: '(Volitelné) Zachraň posádku Hermes — přibliž se na 500 tis. km' },
      ],
    },
    {
      // záchrana kurýra
      id: 'trg-rescue', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: AURORA, shipB: HERMES, distance: 500_000 }],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-rescue' },
        { kind: 'message', text: 'Posádka Hermes je na palubě. Teď už jen zmizet ze soustavy.' },
      ],
    },

    // DETEKCE: zapnutý klín NEBO přiblížení pod 4 mil. km ke kterékoli hlídce
    {
      id: 'trg-detect-wedge', once: true,
      conditions: [{ kind: 'wedgeOn', shipId: AURORA }],
      actions: [{ kind: 'setFlag', flag: 'detected' }],
    },
    ...PATROLS.map((id): Scenario['triggers'][0] => ({
      id: `trg-detect-close-${id}`, once: true,
      conditions: [{ kind: 'distanceBelow', shipA: AURORA, shipB: id, distance: 4_000_000 }],
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
        {
          // imperiální rozkaz zastavit
          kind: 'comm', speaker: 'enemy-captain',
          text: 'IDS Rigel na všech frekvencích: „Neznámá lodi, tady Doradské impérium. Jste v prostoru, který vám nepatří. Vypněte pohon a vzdejte se, nebo budete zničeni. Druhá výzva nebude."',
        },
      ],
    },

    {
      // výhra: se zmapovanými silami zpět za hyperlimit
      id: 'trg-escape', once: true,
      conditions: [
        { kind: 'flag', flag: 'mapped' },
        { kind: 'distanceBelow', shipA: AURORA, shipB: BUOY, distance: 5_000_000 },
      ],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-escape' },
        { kind: 'winMission', text: 'ANS Aurora unikla za hyperlimit s kompletními průzkumnými daty.' },
      ],
    },
    {
      // prohra: zničení hráče
      id: 'trg-player-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: AURORA }],
      actions: [
        { kind: 'loseMission', text: 'ANS Aurora byla zničena hluboko v nepřátelské soustavě.' },
      ],
    },
  ],
}
