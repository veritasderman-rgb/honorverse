/**
 * Mise 2 — „Konvoj Pomezím" (eskorta, DD + 4 obchodníci).
 * Ochrana konvoje proti pirátům; první raider je návnada — když se za ním
 * eskorta rozjede, z opačné strany konvoje startují dva další.
 * Lekce: pozice > agrese. Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Dauntless (hráč), 2–5 = obchodníci, 6 = cílová bóje,
 *   7 = pirát Karakal; zvratem spawnuté 8 + 9 = piráti Šakal a Hyena.
 */
import type { Scenario } from '../../sim/types'

const DAUNTLESS = 1
const MERCH = [2, 3, 4, 5]
const BUOY = 6
const PIRATE1 = 7
const PIRATE2 = 8
const PIRATE3 = 9

/** cílová bóje konvoje — ~150 mil. km po ose +x */
const DEST = { x: 150_000_000, y: 0 }

/** obchodník konvoje: rozestup ~200 tis. km, výchozí rychlost ~300 km/s k cíli */
const merchant = (name: string, y: number): Scenario['ships'][0] => ({
  classId: 'merch-freighter', side: 'player', name,
  pos: { x: 0, y }, vel: { x: 300, y: 0 }, doctrine: 'freighter',
  nav: { kind: 'course', dest: { ...DEST }, arriveAtRest: false },
})

/** flag „obchodník i dorazil k cíli" */
const arrived = (id: number): string => `arrived-${id}`

/** vítězný trigger: konkrétní trojice obchodníků dorazila (aspoň 3 ze 4) */
const winTrio = (trio: number[], n: number): Scenario['triggers'][0] => ({
  id: `trg-win-convoy-${n}`, once: true,
  conditions: trio.map(id => ({ kind: 'flag' as const, flag: arrived(id) })),
  actions: [
    { kind: 'objectiveComplete', objectiveId: 'obj-convoy' },
    { kind: 'winMission', text: 'Konvoj dosáhl cíle. Trasa Pomezím je zajištěna.' },
  ],
})

export const mission02: Scenario = {
  id: 'mission02',
  title: 'Konvoj Pomezím',
  briefing:
    'ANS Dauntless eskortuje konvoj čtyř obchodních lodí Pomezím — '
    + 'pirátským hraničním pásmem — k navigační bóji na okraji soustavy. Zpravodajství hlásí '
    + 'v oblasti pirátské nájezdníky. Drž krycí pozici mezi hrozbou '
    + 'a konvojem — intercepty trvají desítky minut a obchodníci se sami '
    + 'neubrání. Doveď k cíli aspoň tři ze čtyř lodí.',
  seed: 19920217, // pevný seed — determinismus

  // okraj soustavy: za cílovou bójí začíná hyperlimit (vizuální orientace)
  hyperlimit: { kind: 'lineX', x: 150_000_000 },

  ships: [
    {
      // hráčův torpédoborec, drží se u konvoje
      classId: 'dd-vichr', side: 'player', name: 'ANS Dauntless',
      pos: { x: 1_000_000, y: 0 }, vel: { x: 300, y: 0 }, doctrine: 'player',
    },
    // konvoj: formace s rozestupy ~200 tis. km, kurz na bóji
    merchant('Argonaut', 300_000),
    merchant('Bohemia', 100_000),
    merchant('Karlstein', -100_000),
    merchant('Vltava', -300_000),
    {
      // statická cílová bóje (klín vypnut, AI ji ignoruje)
      classId: 'merch-freighter', side: 'neutral', name: 'Cílová bóje',
      pos: { ...DEST }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
    },
    {
      // pirát #1 — návnada; najíždí z boku (~30 mil. km od konvoje)
      classId: 'cl-sokol', side: 'enemy', name: 'Karakal',
      pos: { x: 20_000_000, y: 30_000_000 }, vel: { x: 0, y: -200 },
      doctrine: 'pirate', activeSensors: true,
    },
  ],

  objectives: [
    { id: 'obj-convoy', text: 'Doveď konvoj k cíli (aspoň 3 ze 4 obchodníků)', state: 'open' },
    { id: 'obj-raiders', text: 'Znič nebo zažeň nájezdníky', state: 'open' },
  ],

  triggers: [
    {
      // pirát vyhrožuje konvoji, jakmile se přiblíží na dosah senzorů obchodníků
      id: 'trg-comm-pirate-threat', once: true,
      conditions: [
        { kind: 'distanceBelow', shipA: MERCH[0], shipB: PIRATE1, distance: 25_000_000 },
      ],
      actions: [
        {
          kind: 'comm', speaker: 'pirate',
          text: '„Konvoji Pomezím: vypněte stroje a opusťte lodě, a možná vás necháme dýchat. Ta plechovka od námořnictva vás nezachrání."',
        },
      ],
    },
    {
      // obchodníci prosí o pomoc, když zvrat odhalí přepad ze dvou stran
      id: 'trg-comm-merch-plea', once: true,
      conditions: [{ kind: 'flag', flag: 'ambush' }],
      actions: [
        {
          kind: 'comm', speaker: 'comms',
          text: 'Argonaut volá: „Doprovode, kde jste?! Máme impelerové kontakty ze dvou stran — proboha, vraťte se ke konvoji!"',
        },
      ],
    },
    {
      // ZVRAT: eskorta se rozjela za návnadou → z opačné strany startují dva DD
      id: 'trg-ambush', once: true,
      conditions: [
        { kind: 'distanceBelow', shipA: DAUNTLESS, shipB: PIRATE1, distance: 10_000_000 },
      ],
      actions: [
        { kind: 'message', text: 'Další dva impelerové kontakty! Byla to návnada!' },
        { kind: 'setFlag', flag: 'ambush' },
        {
          kind: 'spawnShip',
          ship: {
            classId: 'dd-vichr', side: 'enemy', name: 'Šakal',
            pos: { x: 25_000_000, y: -25_000_000 }, vel: { x: 0, y: 150 },
            doctrine: 'pirate', activeSensors: true,
          },
        },
        {
          kind: 'spawnShip',
          ship: {
            classId: 'dd-vichr', side: 'enemy', name: 'Hyena',
            pos: { x: 32_000_000, y: -25_000_000 }, vel: { x: 0, y: 150 },
            doctrine: 'pirate', activeSensors: true,
          },
        },
      ],
    },

    // příchod jednotlivých obchodníků k bóji (< 5 mil. km) → flagy
    ...MERCH.map((id): Scenario['triggers'][0] => ({
      id: `trg-arrived-${id}`, once: true,
      conditions: [{ kind: 'distanceBelow', shipA: id, shipB: BUOY, distance: 5_000_000 }],
      actions: [{ kind: 'setFlag', flag: arrived(id) }],
    })),

    // výhra dopravou: kterákoli trojice obchodníků dorazila
    winTrio([2, 3, 4], 1),
    winTrio([2, 3, 5], 2),
    winTrio([2, 4, 5], 3),
    winTrio([3, 4, 5], 4),

    {
      // výhra bojem: všichni tři piráti zničeni
      id: 'trg-win-pirates', once: true,
      conditions: [
        { kind: 'shipDestroyed', shipId: PIRATE1 },
        { kind: 'shipDestroyed', shipId: PIRATE2 },
        { kind: 'shipDestroyed', shipId: PIRATE3 },
      ],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-raiders' },
        { kind: 'winMission', text: 'Všichni nájezdníci zničeni. Konvoj je v bezpečí.' },
      ],
    },
    {
      // prohra: ztráta 2 lodí strany player (obchodníci; zničení hráče končí misi samo)
      id: 'trg-lose-convoy', once: true,
      conditions: [{ kind: 'shipsDestroyedCount', side: 'player', count: 2 }],
      actions: [
        { kind: 'objectiveFail', objectiveId: 'obj-convoy' },
        { kind: 'loseMission', text: 'Konvoj utrpěl neúnosné ztráty.' },
      ],
    },
    {
      // prohra: zničení hráče
      id: 'trg-player-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: DAUNTLESS }],
      actions: [
        { kind: 'loseMission', text: 'ANS Dauntless byla zničena.' },
      ],
    },
  ],
}
