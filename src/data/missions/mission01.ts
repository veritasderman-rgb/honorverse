/**
 * Mise 1 — „Hlídka u Strážné brány" (tutoriál, DD).
 * Celní kontrola u wormhole terminálu; „obchodník" Cygnus po výzvě odhodí
 * masku a od t=40 s PRCHÁ k hyperlimitu na plný vojenský kompenzátor —
 * celá mise je zadní honička s termínem. Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Geometrie honičky (propočet, oba prakticky z klidu):
 *   Dauntless 520 g (5,10 km/s² na 100 %) vs. Cygnus 420 g (4,12 km/s²);
 *   start 25 mil. km, hyperlimit na 250 mil. km. Na 100 % tahu dostih
 *   u ~150 mil. km (rezerva ~40 %); na standardních 80 % (4,08 < 4,12)
 *   Cygnus NEdoženeš — lekce rozpočtu reaktoru. Zaváhání nad ~8 minut
 *   zachrání jen nouzových 120 %.
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
    + 'opustit soustavu přes hyperlimit. Pozor: jestli má ta loď co '
    + 'skrývat, poběží — a hyperlimit je jen 250 milionů km daleko. '
    + 'VÝCVIK: rozpočet reaktoru (tah vs. boční štíty) a první pravidlo '
    + 'raketového boje — nestřílet na dálku, ale DOHNAT a udeřit zblízka.',
  seed: 19881003, // pevný seed — determinismus
  ambient: '#0f2438', // nádech mlhoviny soustavy (fáze B)

  // hyperlimitní čára soustavy (plot ji kreslí jantarově); bóje zůstává pro triggery
  hyperlimit: { kind: 'lineX', x: 250_000_000 },

  ships: [
    {
      // hráčův torpédoborec, v klidu u terminálu
      classId: 'dd-vichr', side: 'player', name: 'ANS Dauntless',
      pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      // „obchodník" — ve skutečnosti runner s vojenským kompenzátorem;
      // start 25 mil. km (viz propočet honičky v hlavičce souboru)
      classId: 'merch-runner', side: 'enemy', name: 'Cygnus',
      pos: { x: 25_000_000, y: 0 }, vel: { x: 500, y: 0 }, doctrine: 'freighter',
    },
    {
      // statická bóje značící hyperlimitní čáru (klín vypnut, AI ji ignoruje)
      classId: 'merch-freighter', side: 'neutral', name: 'Hyperlimit',
      pos: { x: 250_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
      desc: 'Navigační bóje na hyperlimitu soustavy — hranici, za kterou gravitační studna hvězdy dovolí přechod do hyperprostoru. Kdo ji protne, je pryč.',
    },
    // --- kosmetika soustavy (fáze B): svět u Křižovatky žije ---
    {
      // planeta soustavy — pevný bod mapy (kreslí se trvale)
      classId: 'planet', side: 'neutral', name: 'Gwynedd',
      pos: { x: -30_000_000, y: -18_000_000 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
      desc: 'Gwynedd — zemědělský svět Království na vnitřní orbitě Křižovatky. Tři sta milionů lidí, sýpka sektoru; mýto vybírané nad jejich hlavami platí jejich školy i orbitální výtah.',
    },
    {
      // civilní provoz Křižovatky — obchodník na trase (celní hlídka má co sledovat)
      classId: 'merch-freighter', side: 'neutral', name: 'Carmarthen',
      pos: { x: 8_000_000, y: 14_000_000 }, vel: { x: 180, y: -60 },
      doctrine: 'freighter',
      nav: { kind: 'course', dest: { x: 200_000_000, y: -50_000_000 }, arriveAtRest: false },
      throttle: 0.5,
      desc: 'Nákladní loď na lince Křižovatky — civilní provoz s platným tranzitem a manifestem, který výjimečně sedí.',
    },
    {
      classId: 'merch-freighter', side: 'neutral', name: 'Powys',
      pos: { x: 30_000_000, y: -12_000_000 }, vel: { x: -150, y: 40 },
      doctrine: 'freighter',
      nav: { kind: 'course', dest: { x: -60_000_000, y: 25_000_000 }, arriveAtRest: false },
      throttle: 0.5,
      desc: 'Nákladní loď na lince Křižovatky — pravidelná linka do Pomezí, náklad: náhradní díly a spotřební zboží.',
    },
    {
      // meteosonda — pulzující drobnost na plotu
      classId: 'probe', side: 'neutral', name: 'Meteo-7',
      pos: { x: 12_000_000, y: 8_000_000 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
      desc: 'Meteorologická sonda Kontroly Brány: měří sluneční vítr a mikrometeority na tranzitních koridorech. Majetek správy terminálu — nesestřelovat, papírování je nekonečné.',
    },
  ],

  // pole asteroidů u vnitřního pásu — kosmetika (sim je ignoruje)
  decor: [
    { kind: 'asteroids', center: { x: 60_000_000, y: -28_000_000 }, radius: 14_000_000, count: 70, seed: 11 },
  ],

  objectives: [
    { id: 'obj-inspect', text: 'Proveď kontrolu kontaktu (přibliž se na 1 mil. km)', state: 'open' },
    { id: 'obj-no-escape', text: 'Nedovol mu uniknout za hyperlimit', state: 'open' },
  ],

  triggers: [
    {
      // civilní provoz je v celní databázi — identifikace hned (žádný falešný zvrat)
      id: 'trg-traffic-idents', once: true,
      conditions: [{ kind: 'time', t: 2 }],
      actions: [
        { kind: 'revealClass', shipId: 5 },
        { kind: 'revealClass', shipId: 6 },
      ],
    },
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
      // předzvěst: spojař zachytí detail, který k „uhlířské bárce" nesedí
      // (foreshadowing zvratu — přichází PŘED útěkem, hráč dostane šanci zbystřit)
      id: 'trg-comm-foreshadow', once: true,
      conditions: [{ kind: 'time', t: 15 }],
      actions: [
        {
          kind: 'comm', speaker: 'comms',
          text: 'Kapitáne… zachytávám provoz Cygnusu s Bránou. Obsah sedí, ale to šifrování ne — civilní bárky jedou na komerčním kódu, tohle je vojenská třída D. Buď si koupili pancéřovanou vysílačku… nebo nevezou zemědělské stroje.',
        },
      ],
    },
    {
      // ZVRAT: po vzdorovité odpovědi Cygnus odhodí masku a PRCHÁ na plný
      // vojenský kompenzátor — od téhle chvíle běží honička s termínem
      id: 'trg-runner-flees', once: true,
      conditions: [{ kind: 'time', t: 40 }],
      actions: [
        { kind: 'message', text: 'Cygnus zrychluje k hyperlimitu! Vojenský kompenzátor!' },
        { kind: 'setDoctrine', shipId: CYGNUS, doctrine: 'runner' },
        { kind: 'setFlag', flag: 'runner-fleeing' },
        { kind: 'revealClass', shipId: CYGNUS },
        {
          // callback na předzvěst + automatická výzva ke kapitulaci
          kind: 'comm', speaker: 'comms',
          text: 'Říkal jsem, že ta vysílačka smrdí! Vysílám výzvu: „Cygnusi, zastavte a vypněte klín, nebo zahájíme palbu." …Neodpovídají, kapitáne.',
        },
      ],
    },
    {
      // lekce rozpočtu reaktoru: na 80 % tahu runnera NEdoženeš (4,08 < 4,12)
      id: 'trg-comm-throttle-lesson', once: true,
      conditions: [{ kind: 'flag', flag: 'runner-fleeing' }, { kind: 'time', t: 120 }],
      actions: [
        {
          kind: 'comm', speaker: 'xo',
          text: 'První důstojník: „Táhne přes čtyři sta g — na standardních osmdesáti procentech ho NEdoženeme. Doporučuju plný výkon; a jestli jsme zaváhali, zbývá jedině nouzových sto dvacet. Boční štíty to položí na kolena, ale on stejně skoro nemá čím střílet."',
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
        {
          // LEKCE RAKETOVÉHO BOJE: zblízka je salva poprava — tady to hráč
          // poprvé uvidí naživo (runner nemá skoro žádnou obranu)
          kind: 'comm', speaker: 'tactical',
          text: 'Jsme na milion kilometrů — a tohle je vzdálenost, na které rakety ZABÍJEJÍ. '
            + 'Krátký let znamená, že obrana cíle skoro nestihne reagovat. Doporučuji plnou '
            + 'salvu; kdyby běžel dál, AUTO palba to dokončí za nás.',
        },
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
      // Cygnus kapituloval ⇒ vítězství (zajetí lodi, nákladu i posádky)
      id: 'trg-cygnus-surrendered', once: true,
      conditions: [{ kind: 'shipSurrendered', shipId: CYGNUS }],
      actions: [
        {
          kind: 'comm', speaker: 'station',
          text: 'Kontrola Brány: „Cygnus kapituloval a vypnul klín. Výsadková četa je na cestě — výborná práce, Dauntless."',
        },
        { kind: 'objectiveComplete', objectiveId: 'obj-no-escape' },
        { kind: 'winMission', text: 'Cygnus se vzdal i s nákladem. Zadrženou loď převezme Kontrola Brány.' },
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
