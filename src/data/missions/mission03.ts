/**
 * Mise 3 — „Q-ship" (souboj 1v1, DD vs. maskovaný pomocný křižník).
 * Doprovod „poškozeného" obchodníka Sirius-B ke stanici; po půl hodině
 * plavby bok po boku odhodí kontejnery a odhalí raketová lůžka.
 * Boj zblízka: rolování, energetický dosah. Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = HMS Fearless (hráč), 2 = Sirius-B, 3 = stanice (bóje)
 */
import type { Scenario } from '../../sim/types'

const FEARLESS = 1
const SIRIUS_B = 2

export const mission03: Scenario = {
  id: 'mission03',
  title: 'Q-ship',
  briefing:
    'Obchodní loď Sirius-B hlásí poškození impelerového prstence a žádá '
    + 'o doprovod ke stanici Medusa (~80 mil. km). HMS Fearless ji má '
    + 'doprovodit — drž se do 800 tisíc km, obchodník zvládne jen '
    + 'pomalé plutí. Zpravodajství nemá o lodi žádné záznamy.',
  seed: 19930411, // pevný seed — determinismus

  ships: [
    {
      // hráčův torpédoborec, letí podél obchodníka
      classId: 'dd-havoc', side: 'player', name: 'HMS Fearless',
      pos: { x: 0, y: 0 }, vel: { x: 200, y: 0 }, doctrine: 'player',
    },
    {
      // „poškozený obchodník" — ve skutečnosti havenský Q-ship;
      // bez nav plánu jen driftuje ~200 km/s ke stanici
      classId: 'merch-qship', side: 'enemy', name: 'Sirius-B',
      pos: { x: 2_000_000, y: 0 }, vel: { x: 200, y: 0 }, doctrine: 'freighter',
    },
    {
      // stanice Medusa — statická bóje (klín vypnut, AI ji ignoruje)
      classId: 'merch-freighter', side: 'neutral', name: 'Stanice Medusa',
      pos: { x: 80_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
    },
  ],

  objectives: [
    { id: 'obj-escort', text: 'Doprovoď obchodníka ke stanici Medusa (drž se do 800 tis. km)', state: 'open' },
  ],

  triggers: [
    {
      // ZVRAT: po 30 minutách plavby bok po boku Q-ship odhodí masku
      id: 'trg-qship-reveal', once: true,
      conditions: [
        { kind: 'time', t: 1800 },
        { kind: 'distanceBelow', shipA: FEARLESS, shipB: SIRIUS_B, distance: 800_000 },
      ],
      actions: [
        { kind: 'message', text: 'Kontejnery odhozeny — raketová lůžka! Je to havenský pomocný křižník!' },
        { kind: 'revealClass', shipId: SIRIUS_B },
        { kind: 'setDoctrine', shipId: SIRIUS_B, doctrine: 'hunter' },
        { kind: 'setFlag', flag: 'qship-revealed' },
        { kind: 'objectiveFail', objectiveId: 'obj-escort', text: 'Doprovod byl léčka — obchodník je nepřátelská bojová loď.' },
        { kind: 'addObjective', objectiveId: 'obj-destroy', text: 'Znič pomocný křižník' },
      ],
    },
    {
      // výhra: Q-ship zničen
      id: 'trg-qship-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: SIRIUS_B }],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-destroy' },
        { kind: 'winMission', text: 'Pomocný křižník zničen. Admiralita bude chtít podrobné hlášení.' },
      ],
    },
    {
      // prohra: zničení hráče
      id: 'trg-player-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: FEARLESS }],
      actions: [
        { kind: 'loseMission', text: 'HMS Fearless byla zničena.' },
      ],
    },
  ],
}
