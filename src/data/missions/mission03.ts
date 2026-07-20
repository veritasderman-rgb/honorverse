/**
 * Mise 3 — „Q-ship" (souboj 1v1, DD vs. maskovaný pomocný křižník).
 * Doprovod „poškozeného" obchodníka Mercator ke stanici; po půl hodině
 * plavby bok po boku odhodí kontejnery a odhalí raketová lůžka.
 * Lekce: kiting — drž si past od těla, rychlost je tvůj pancíř. Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Dauntless (hráč), 2 = Mercator, 3 = stanice (bóje)
 */
import type { Scenario } from '../../sim/types'

const DAUNTLESS = 1
const MERCATOR = 2

export const mission03: Scenario = {
  id: 'mission03',
  title: 'Q-ship',
  briefing:
    'Obchodní loď Mercator hlásí poškození impelerového prstence a žádá '
    + 'o doprovod ke stanici Sázava (~80 mil. km). ANS Dauntless ji má '
    + 'doprovodit — drž se do 2,5 mil. km, obchodník zvládne jen '
    + 'pomalé plutí. Zpravodajství nemá o lodi žádné záznamy.',
  seed: 19930411, // pevný seed — determinismus

  // hyperlimit žluté hvězdy soustavy (stanice Sázava leží hluboko uvnitř)
  hyperlimit: { kind: 'circle', center: { x: 200_000_000, y: 0 }, radius: 360_000_000 },

  ships: [
    {
      // hráčův torpédoborec, letí podél obchodníka
      classId: 'dd-vichr', side: 'player', name: 'ANS Dauntless',
      pos: { x: 0, y: 0 }, vel: { x: 200, y: 0 }, doctrine: 'player',
    },
    {
      // „poškozený obchodník" — ve skutečnosti imperiální Q-ship;
      // bez nav plánu jen driftuje ~200 km/s ke stanici.
      // Pohotovostní munice 90 raket (ne plné zásobníky třídy): past je
      // přestavěný obchodník s improvizovanými zásobníky — a po zrušení
      // rollu z UI by plných 140 raket DD bez klínové obrany neustál.
      classId: 'merch-qship', side: 'enemy', name: 'Mercator',
      pos: { x: 2_000_000, y: 0 }, vel: { x: 200, y: 0 }, doctrine: 'freighter',
      missiles: 90,
    },
    {
      // stanice Sázava — statická bóje (klín vypnut, AI ji ignoruje)
      classId: 'merch-freighter', side: 'neutral', name: 'Stanice Sázava',
      pos: { x: 80_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
    },
  ],

  objectives: [
    { id: 'obj-escort', text: 'Doprovoď obchodníka ke stanici Sázava (drž se do 2,5 mil. km)', state: 'open' },
  ],

  triggers: [
    {
      // Mercator prosí o doprovod (maska „poškozeného obchodníka")
      id: 'trg-comm-mercator-plea', once: true,
      conditions: [{ kind: 'time', t: 10 }],
      actions: [
        {
          kind: 'comm', speaker: 'comms',
          text: 'Mercator vysílá: „Díky, že jste tu, Dauntless. Přední prstenec sotva drží pohromadě — držte se blízko, prosím. Kdyby se něco utrhlo, ať to nikdo neschytá."',
        },
      ],
    },
    {
      // ZVRAT: po 30 minutách plavby bok po boku Q-ship odhodí masku
      id: 'trg-qship-reveal', once: true,
      conditions: [
        { kind: 'time', t: 1800 },
        // past sklapne na 2,6 mil. km: odhalení z bodového doletu (< 1M km)
        // bylo po zrušení rollu nepřežitelné — salva zblízka nedá obraně
        // ŽÁDNÝ interceptní pokus (CM budget 0)
        { kind: 'distanceBelow', shipA: DAUNTLESS, shipB: MERCATOR, distance: 2_600_000 },
      ],
      actions: [
        { kind: 'message', text: 'Kontejnery odhozeny — raketová lůžka! Je to imperiální pomocný křižník!' },
        { kind: 'revealClass', shipId: MERCATOR },
        { kind: 'setDoctrine', shipId: MERCATOR, doctrine: 'hunter' },
        { kind: 'setFlag', flag: 'qship-revealed' },
        { kind: 'objectiveFail', objectiveId: 'obj-escort', text: 'Doprovod byl léčka — obchodník je nepřátelská bojová loď.' },
        { kind: 'addObjective', objectiveId: 'obj-destroy', text: 'Znič pomocný křižník' },
        {
          // výsměšná zpráva imperiálního kapitána
          kind: 'comm', speaker: 'enemy-captain',
          text: '„Vaše Království si myslí, že mu Pomezí patří. Historické právo říká něco jiného — a tohle je odpověď Impéria, Dauntless. Doufám, že jste si užili eskortní službu."',
        },
        {
          // hráčova (automatická) výzva ke kapitulaci
          kind: 'comm', speaker: 'comms',
          text: 'Vysílám výzvu ke kapitulaci: „Mercatore, složte zbraně a vypněte klín." Odpovědí je odpal raket, kapitáne.',
        },
      ],
    },
    {
      // výhra: Q-ship zničen
      id: 'trg-qship-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: MERCATOR }],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-destroy' },
        { kind: 'winMission', text: 'Pomocný křižník zničen. Admiralita bude chtít podrobné hlášení.' },
      ],
    },
    {
      // lepší konec: Q-ship kapituloval — zajatá loď je zpravodajská trofej
      id: 'trg-qship-surrendered', once: true,
      conditions: [{ kind: 'shipSurrendered', shipId: MERCATOR }],
      actions: [
        {
          kind: 'objectiveComplete', objectiveId: 'obj-destroy',
          text: 'Úkol splněn: pomocný křižník vyřazen — kapituloval.',
        },
        {
          kind: 'winMission',
          text: 'Mercator kapituloval — zajali jsme imperiální pomocný křižník i s kódy a dokumentací. Zpravodajská trofej první třídy.',
        },
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
