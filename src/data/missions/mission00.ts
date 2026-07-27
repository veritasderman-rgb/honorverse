/**
 * Mise 0 — „Akademie: první hlídka". Tutoriál úplných začátků na cvičném
 * okruhu nad Avalonem Prime: kamera a čas, kurz a tah, senzory, první salva.
 * Nic tu nestřílí zpátky — cvičný kýl je vyřazený trup bez pohonu a zbraní.
 * Vede za ruku TUTORIALS['mission00'] (src/data/tutorials.ts).
 */
import type { Scenario } from '../../sim/types'

export const mission00: Scenario = {
  id: 'mission00',
  title: 'Akademie: první hlídka',
  briefing:
    'Vítej na akademii, kadete. Tohle je cvičný okruh nad Avalonem Prime — '
    + 'žádný nepřítel, žádné riziko, jen ty, torpédoborec ANS Kadet '
    + 'a instruktorka na lince.\n\n'
    + 'Úkoly: (1) doleť k navigační bóji Alfa, (2) najdi cvičný kýl Beta, '
    + 'klasifikuj ho senzory a znič ho první ostrou salvou.\n\n'
    + 'VÝCVIK: ovládání kamery a času, kurz a tah, senzory a raketová salva '
    + '— všechno, co potřebuješ, než tě pustíme na celní hlídku.',
  seed: 20260701, // pevný seed — determinismus
  ambient: '#0d2030',

  ships: [
    {
      // hráčův cvičný torpédoborec — v klidu na startu okruhu
      classId: 'dd-vichr', side: 'player', name: 'ANS Kadet',
      pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, doctrine: 'player',
    },
    {
      // navigační bóje okruhu — první cíl letu (statická, zakreslená)
      classId: 'probe', side: 'neutral', name: 'Bóje Alfa',
      pos: { x: 6_000_000, y: 2_500_000 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0, objective: true,
      desc: 'Navigační bóje cvičného okruhu akademie. Generace kadetů ji míjely '
        + 'na první hlídce — a pár jich do ní i narazilo.',
    },
    {
      // cvičný kýl — vyřazený trup bez pohonu; terč ostré střelby
      classId: 'merch-freighter', side: 'enemy', name: 'Cvičný kýl Beta',
      // v dosahu aktivních senzorů (5 M km) od bóje Alfa — tutoriál vede
      // hráče jen „zapni senzory", žádný další přelet (Codex review)
      pos: { x: 9_000_000, y: 500_000 }, vel: { x: 0, y: 0 },
      doctrine: 'freighter', wedgeOn: false, throttle: 0,
      // mrtvý pohon (vyřazený trup) — zbytek trupu drží, ať je co rozstřílet
      subsystems: {
        impellerFwd: 0, impellerAft: 0,
        sidewallPort: 0, sidewallStbd: 0,
        tubesPort: 0, tubesStbd: 0,
        energyPort: 0, energyStbd: 0,
        pdlc: 0, cm: 0, sensors: 0.4, ecm: 0,
      },
      desc: 'Vyřazený nákladní trup odtažený na okruh jako terč. Pohon mrtvý, '
        + 'zbraně žádné — jeho jediná práce je stát v cestě salvám kadetů.',
    },
    {
      // domovský svět v pozadí — kosmetika okruhu
      classId: 'planet', side: 'neutral', name: 'Avalon Prime',
      pos: { x: -25_000_000, y: -10_000_000 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
      desc: 'Avalon Prime — trůnní svět Království. Z orbity vypadá mírově; '
        + 'právě proto existuje flotila.',
    },
  ],

  objectives: [
    { id: 'obj-buoy', text: 'Doleť k bóji Alfa (přiblíž se na 500 tis. km)', state: 'open' },
    { id: 'obj-hulk', text: 'Klasifikuj a znič cvičný kýl Beta', state: 'open' },
  ],

  triggers: [
    {
      id: 't-welcome', once: true,
      conditions: [{ kind: 'time', t: 2 }],
      actions: [{
        kind: 'message',
        text: 'Instruktorka Sarnow: „Vítej na okruhu, kadete. Bez nervů — dnes '
          + 'po tobě nikdo nestřílí. Nejdřív letecké základy: doleť k bóji Alfa. '
          + 'Displej tě povede."',
      }],
    },
    {
      id: 't-buoy', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: 1, shipB: 2, distance: 500_000 }],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-buoy' },
        {
          kind: 'message',
          text: 'Instruktorka Sarnow: „Čistý průlet, kadete. Teď ostrá část: '
            + 'na okruhu stojí cvičný kýl Beta. Zapni aktivní senzory, '
            + 'klasifikuj ho a pošli mu první ostrou salvu tvé kariéry."',
        },
      ],
    },
    {
      id: 't-classified', once: true,
      conditions: [{ kind: 'classified', shipId: 3, side: 'player' }],
      actions: [{
        kind: 'message',
        text: 'Taktický: „Cíl klasifikován — vyřazený trup, žádná obrana. '
          + 'Palebné řešení připraveno, kapitáne. Až řekneš."',
      }],
    },
    {
      id: 't-win', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: 3 }],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-hulk' },
        {
          kind: 'winMission',
          text: 'První salva, první zásah. Akademie tě pouští do služby — '
            + 'celní hlídka u Křižovatky čeká.',
        },
      ],
    },
  ],
}
