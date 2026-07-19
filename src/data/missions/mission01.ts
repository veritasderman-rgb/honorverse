/**
 * Mise 1 — „Hlídka u Strážné brány" (tutoriál, DD).
 * Celní kontrola u wormhole terminálu; „obchodník" Cygnus má vojenský
 * kompenzátor a po výzvě prchá k hyperlimitu. Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Dauntless (hráč), 2 = Cygnus, 3 = bóje „Hyperlimit"
 */
import type { Scenario } from '../../sim/types'

const DAUNTLESS = 1
const CYGNUS = 2
const BUOY = 3

export const mission01: Scenario = {
  id: 'mission01',
  title: 'Hlídka u Strážné brány',
  briefing:
    'ANS Dauntless drží celní hlídku u wormhole terminálu Strážné brány. '
    + 'Kontrola Brány hlásí nákladní loď Cygnus s podezřelým manifestem — '
    + 'proveďte kontrolu: přibližte se na 1 milion km a nedovolte jí '
    + 'opustit soustavu přes hyperlimit.',
  seed: 19881003, // pevný seed — determinismus

  // hyperlimitní čára soustavy (plot ji kreslí jantarově); bóje zůstává pro triggery
  hyperlimit: { kind: 'lineX', x: 250_000_000 },

  ships: [
    {
      // hráčův torpédoborec, v klidu u terminálu
      classId: 'dd-vichr', side: 'player', name: 'ANS Dauntless',
      pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      // „obchodník" — ve skutečnosti runner s vojenským kompenzátorem
      classId: 'merch-runner', side: 'enemy', name: 'Cygnus',
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
      // úvodní komunikace: Kontrola Brány nařizuje Cygnu zastavit
      id: 'trg-comm-halt-order', once: true,
      conditions: [{ kind: 'time', t: 8 }],
      actions: [
        {
          kind: 'comm', speaker: 'station',
          text: 'Kontrola Brány volá Cygnus: „Nákladní lodi Cygnus, vypněte klín a připravte se na celní kontrolu. Dauntless je na cestě k vám."',
        },
      ],
    },
    {
      // vzdorovitá odpověď Cygnusu
      id: 'trg-comm-cygnus-reply', once: true,
      conditions: [{ kind: 'time', t: 25 }],
      actions: [
        {
          kind: 'comm', speaker: 'enemy-captain',
          text: 'Cygnus: „Kontrolo, vezeme zemědělské stroje a máme skluz. Tohle si vyřídíme s vaším guvernérem — nezdržujte nás."',
        },
      ],
    },
    {
      // zvrat: při přiblížení hráče Cygnus odhodí masku a prchá
      id: 'trg-runner-flees', once: true,
      conditions: [
        { kind: 'distanceBelow', shipA: DAUNTLESS, shipB: CYGNUS, distance: 5_000_000 },
      ],
      actions: [
        { kind: 'message', text: 'Cygnus zrychluje! Vojenský kompenzátor!' },
        { kind: 'setDoctrine', shipId: CYGNUS, doctrine: 'runner' },
        { kind: 'setFlag', flag: 'runner-fleeing' },
        { kind: 'revealClass', shipId: CYGNUS },
        {
          // automatická výzva ke kapitulaci od hráčova spojaře
          kind: 'comm', speaker: 'comms',
          text: 'Vysílám výzvu: „Cygnusi, zastavte a vypněte klín, nebo zahájíme palbu." …Neodpovídají, kapitáne.',
        },
      ],
    },
    {
      // kontrola provedena: dostih na 1 mil. km po vzplanutí útěku
      id: 'trg-inspection-done', once: true,
      conditions: [
        { kind: 'flag', flag: 'runner-fleeing' },
        { kind: 'distanceBelow', shipA: DAUNTLESS, shipB: CYGNUS, distance: 1_000_000 },
      ],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-inspect' },
      ],
    },
    {
      // Cygnus zničen ⇒ vítězství
      id: 'trg-cygnus-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: CYGNUS }],
      actions: [
        { kind: 'message', text: 'Kontrola Brány: dobrá práce.' },
        { kind: 'objectiveComplete', objectiveId: 'obj-no-escape' },
        { kind: 'winMission' },
      ],
    },
    {
      // Cygnus doletěl k hyperlimitní bóji ⇒ únik, prohra
      id: 'trg-cygnus-escaped', once: true,
      conditions: [
        { kind: 'distanceBelow', shipA: CYGNUS, shipB: BUOY, distance: 5_000_000 },
      ],
      actions: [
        { kind: 'objectiveFail', objectiveId: 'obj-no-escape' },
        { kind: 'loseMission', text: 'Cygnus unikl do hyperprostoru.' },
      ],
    },
    {
      // zničení hráče ⇒ prohra
      id: 'trg-player-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: DAUNTLESS }],
      actions: [
        { kind: 'loseMission', text: 'ANS Dauntless byla zničena.' },
      ],
    },
  ],
}
