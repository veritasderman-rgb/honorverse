/**
 * Mise 1 — „Hlídka na Basilisku" (tutoriál, DD).
 * Celní kontrola u wormhole terminálu; „obchodník" Sirius má vojenský
 * kompenzátor a po výzvě prchá k hyperlimitu. Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = HMS Fearless (hráč), 2 = Sirius, 3 = bóje „Hyperlimit"
 */
import type { Scenario } from '../../sim/types'

const FEARLESS = 1
const SIRIUS = 2
const BUOY = 3

export const mission01: Scenario = {
  id: 'mission01',
  title: 'Hlídka na Basilisku',
  briefing:
    'HMS Fearless drží celní hlídku u basiliského wormhole terminálu. '
    + 'Basilisk Control hlásí nákladní loď Sirius s podezřelým manifestem — '
    + 'proveďte kontrolu: přibližte se na 1 milion km a nedovolte jí '
    + 'opustit soustavu přes hyperlimit.',
  seed: 19881003, // pevný seed — determinismus

  ships: [
    {
      // hráčův torpédoborec, v klidu u terminálu
      classId: 'dd-havoc', side: 'player', name: 'HMS Fearless',
      pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      // „obchodník" — ve skutečnosti runner s vojenským kompenzátorem
      classId: 'merch-runner', side: 'enemy', name: 'Sirius',
      pos: { x: 40_000_000, y: 0 }, vel: { x: 500, y: 0 }, doctrine: 'freighter',
    },
    {
      // statická bóje značící hyperlimitní čáru (klín vypnut, AI ji ignoruje)
      classId: 'merch-freighter', side: 'neutral', name: 'Hyperlimit',
      pos: { x: 250_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
    },
  ],

  objectives: [
    { id: 'obj-inspect', text: 'Proveď kontrolu kontaktu (přibliž se na 1 mil. km)', state: 'open' },
    { id: 'obj-no-escape', text: 'Nedovol mu uniknout za hyperlimit', state: 'open' },
  ],

  triggers: [
    {
      // zvrat: při přiblížení hráče Sirius odhodí masku a prchá
      id: 'trg-runner-flees', once: true,
      conditions: [
        { kind: 'distanceBelow', shipA: FEARLESS, shipB: SIRIUS, distance: 5_000_000 },
      ],
      actions: [
        { kind: 'message', text: 'Sirius zrychluje! Vojenský kompenzátor!' },
        { kind: 'setDoctrine', shipId: SIRIUS, doctrine: 'runner' },
        { kind: 'setFlag', flag: 'runner-fleeing' },
        { kind: 'revealClass', shipId: SIRIUS },
      ],
    },
    {
      // kontrola provedena: dostih na 1 mil. km po vzplanutí útěku
      id: 'trg-inspection-done', once: true,
      conditions: [
        { kind: 'flag', flag: 'runner-fleeing' },
        { kind: 'distanceBelow', shipA: FEARLESS, shipB: SIRIUS, distance: 1_000_000 },
      ],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-inspect' },
      ],
    },
    {
      // Sirius zničen ⇒ vítězství
      id: 'trg-sirius-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: SIRIUS }],
      actions: [
        { kind: 'message', text: 'Basilisk Control: dobrá práce.' },
        { kind: 'objectiveComplete', objectiveId: 'obj-no-escape' },
        { kind: 'winMission' },
      ],
    },
    {
      // Sirius doletěl k hyperlimitní bóji ⇒ únik, prohra
      id: 'trg-sirius-escaped', once: true,
      conditions: [
        { kind: 'distanceBelow', shipA: SIRIUS, shipB: BUOY, distance: 5_000_000 },
      ],
      actions: [
        { kind: 'objectiveFail', objectiveId: 'obj-no-escape' },
        { kind: 'loseMission', text: 'Sirius unikl do hyperprostoru.' },
      ],
    },
    {
      // zničení hráče ⇒ prohra
      id: 'trg-player-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: FEARLESS }],
      actions: [
        { kind: 'loseMission', text: 'HMS Fearless byla zničena.' },
      ],
    },
  ],
}
