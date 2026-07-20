/**
 * Mise 7 — „Zlatá flotila" (role se obrací, BC).
 * Hráč poprvé útočí: bitevní křižník Praporec proti imperiální zlaté flotile
 * izotopů s eskortou. Volba cílů — rozstřílet eskortu, nebo maximalizovat zničený
 * tonáž a utéct před reakcí? Zvrat: eskortní křižník tahá raketové pody —
 * první salva proti hráči je čtyřnásobná (ochutnávka pozdější éry).
 * Viz docs/GAME_DESIGN.md kap. 7.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1 = ANS Praporec (hráč), 2–5 = obchodníci konvoje,
 *   6–7 = eskortní DD, 8 = eskortní CL (pody!), 9 = úniková bóje.
 */
import type { Scenario } from '../../sim/types'

const PRAPOREC = 1
const MERCH = [2, 3, 4, 5]
const ESCORT_CL = 8
const BUOY = 9

/** flag „obchodník id zničen" */
const sunk = (id: number): string => `sunk-${id}`

/** obchodník konvoje: prchá k bóji za hyperlimitem na −x a tam zastaví
 * (arriveAtRest — „ukryje se" u bóje; drží misi v rozumné geometrii) */
const merchant = (name: string, y: number): Scenario['ships'][0] => ({
  classId: 'merch-freighter', side: 'enemy', name,
  pos: { x: 0, y }, vel: { x: -300, y: 0 }, doctrine: 'freighter',
  nav: { kind: 'course', dest: { x: -70_000_000, y }, arriveAtRest: true },
})

/** trojice zničených obchodníků ⇒ flag + splnění úkolu (kterákoli ze 4 kombinací) */
const sunkTrio = (trio: number[], n: number): Scenario['triggers'][0] => ({
  id: `trg-merch-trio-${n}`, once: true,
  conditions: trio.map(id => ({ kind: 'flag' as const, flag: sunk(id) })),
  actions: [
    { kind: 'setFlag', flag: 'merch-3' },
    { kind: 'objectiveComplete', objectiveId: 'obj-merch' },
  ],
})

export const mission07: Scenario = {
  id: 'mission07',
  title: 'Zlatá flotila',
  briefing:
    'Role se obrací: bitevní křižník ANS Praporec přepadá imperiální '
    + 'zlatou flotilu — konvoj palivových izotopů mířící přes soustavu '
    + 'Kerav do Cádizu. Čtyři obchodníci, eskorta dvou '
    + 'torpédoborců a lehkého křižníku. Rozkaz zní: potopit aspoň tři '
    + 'obchodníky a zmizet za hyperlimit dřív, než dorazí reakční svaz. '
    + 'Vybírej cíle chytře — eskortu nemusíš zničit, jen ji přežít.',
  seed: 19971022, // pevný seed — determinismus
  ambient: '#241a0c', // nádech mlhoviny soustavy (fáze B)

  // hyperlimit soustavy Kerav — úniková čára na +x (směr příletu hráče)
  hyperlimit: { kind: 'lineX', x: 150_000_000 },

  ships: [
    {
      // hráčův bitevní křižník — přilétá z +x s náběhovou rychlostí
      classId: 'bc-praporec', side: 'player', name: 'ANS Praporec',
      pos: { x: 40_000_000, y: 0 }, vel: { x: -1_500, y: 0 }, doctrine: 'player',
    },
    // konvoj: rozestupy ~1 mil. km, kurz k „bóji" hluboko za hyperlimitem na −x
    merchant('Ebro', 1_500_000),
    merchant('Tajo', 500_000),
    merchant('Duero', -500_000),
    merchant('Guadiana', -1_500_000),
    // Eskorta: zadní zástěna konvoje. Vyvážení nájezdu (mise má být o volbě
    // cílů, ne o sebevraždě proti třem plným zásobníkům): eskorta jede na
    // úsporný výkon kompenzátorů (throttle 0.5 — vlečou pody a šetří stroje)
    // a nese jen pohotovostní palebný příděl raket — zato má PODY (zvrat).
    {
      classId: 'dd-vichr', side: 'enemy', name: 'IDS Lanza',
      pos: { x: 5_000_000, y: 2_500_000 }, vel: { x: -300, y: 0 },
      doctrine: 'escort', activeSensors: true, throttle: 0.5, missiles: 30,
    },
    {
      classId: 'dd-vichr', side: 'enemy', name: 'IDS Tormenta',
      pos: { x: 5_000_000, y: -2_500_000 }, vel: { x: -300, y: 0 },
      doctrine: 'escort', activeSensors: true, throttle: 0.5, missiles: 30,
    },
    {
      // eskortní lehký křižník — na vleku raketové pody (zvrat!)
      classId: 'cl-sokol', side: 'enemy', name: 'IDS Centinela',
      pos: { x: 8_000_000, y: 0 }, vel: { x: -300, y: 0 },
      doctrine: 'escort', activeSensors: true, throttle: 0.5, missiles: 40,
    },
    {
      // úniková bóje za hyperlimitem
      classId: 'merch-freighter', side: 'neutral', name: 'Hyperlimit',
      pos: { x: 160_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
      desc: 'Ústupový bod na hyperlimitu. Kaperská doktrína má tři kroky: udeřit, rozbít, zmizet — tohle je ten třetí.',
    },
  ],

  objectives: [
    { id: 'obj-merch', text: 'Znič aspoň 3 obchodníky zlaté flotily', state: 'open' },
    { id: 'obj-escape', text: 'Unikni za hyperlimit (k bóji)', state: 'open' },
  ],

  triggers: [
    {
      // eskorta vyzývá hráče, jakmile je jasné, že jde o útok
      id: 'trg-comm-escort', once: true,
      conditions: [{ kind: 'time', t: 30 }],
      actions: [
        {
          kind: 'comm', speaker: 'enemy-captain',
          text: 'IDS Centinela: „Avalonské plavidlo, tady eskorta zlaté flotily. Tento konvoj pluje pod ochranou caudilla a předurčení Impéria. Otočte se, dokud můžete — není bez zubů."',
        },
      ],
    },
    {
      // ZVRAT: první přiblížení k eskortnímu CL pod 9 mil. km ⇒ saturační
      // salva 24 raket z podů na vleku (obchází šachty, munici i cooldown)
      id: 'trg-pods', once: true,
      conditions: [
        { kind: 'distanceBelow', shipA: PRAPOREC, shipB: ESCORT_CL, distance: 9_000_000 },
      ],
      actions: [
        {
          kind: 'comm', speaker: 'enemy-captain',
          text: 'IDS Centinela: „Máme pro tebe překvapení, avalonský pirátě."',
        },
        { kind: 'podSalvo', shipId: ESCORT_CL, targetId: PRAPOREC, count: 24 },
        { kind: 'message', text: 'Taktický: „Odpaly! Mnohonásobné odpaly — to nejsou šachty křižníku, ti parchanti tahali PODY!"' },
      ],
    },

    // zničení jednotlivých obchodníků ⇒ flagy
    ...MERCH.map((id): Scenario['triggers'][0] => ({
      id: `trg-sunk-${id}`, once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: id }],
      actions: [{ kind: 'setFlag', flag: sunk(id) }],
    })),
    // kterákoli trojice zničených obchodníků splní úkol
    sunkTrio([2, 3, 4], 1),
    sunkTrio([2, 3, 5], 2),
    sunkTrio([2, 4, 5], 3),
    sunkTrio([3, 4, 5], 4),
    {
      // VÝHRA: 3+ obchodníci zničeni A hráč za hyperlimitem u bóje
      id: 'trg-win', once: true,
      conditions: [
        { kind: 'flag', flag: 'merch-3' },
        { kind: 'distanceBelow', shipA: PRAPOREC, shipB: BUOY, distance: 5_000_000 },
      ],
      actions: [
        { kind: 'objectiveComplete', objectiveId: 'obj-escape' },
        { kind: 'winMission', text: 'Zlatá flotila rozbita, Praporec za hyperlimitem. Impérium dnes počítá ztráty — a dvůr účty.' },
      ],
    },
    {
      // prohra: zničení hráče
      id: 'trg-player-destroyed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: PRAPOREC }],
      actions: [{ kind: 'loseMission', text: 'ANS Praporec zůstala u konvoje navždy.' }],
    },
  ],
}
