/**
 * Mise 11 — „Stěna proti stěně" (bonusová bitva, 20 vs. 20).
 * Výcviková simulace admirality po válce: plná avalonská bitevní stěna
 * proti rekonstruované imperiální stěně z Velké armády. Žádné zvraty,
 * žádné kličky — čistý střet stěn: doktrína, formace, řízení palby
 * a hospodaření se zásobníky ve velkém.
 *
 * Mapa předvádí paměť senzorů: planeta Avalon Prime (statický objekt,
 * kreslí se trvale) a imperiální zásobovací základna za stěnou — jednou
 * zmapovaná zůstane zakreslená („poslední známá poloha"), i když se
 * senzory odvrátí.
 *
 * Id lodí (pořadí pole ships, od 1):
 *   1–8   = jádro (4× DN Vladař, 4× BC Praporec; 1 = vlajková ANS Sovereign),
 *   9–20  = zástěna (6× CA, 6× CL) — VŠE ovladatelné (admirál velí stěně),
 *   21–40 = imperiální stěna (4× DN Toledo /21–24/, 6× CA, 6× CL, 4× DD),
 *   41    = zásobovací základna (station), 42 = planeta (neutral).
 */
import type { Scenario } from '../../sim/types'

const SOVEREIGN = 1
const ENEMY_DNS = [21, 22, 23, 24]
const BASE = 41

/** avalonská loď ovladatelného jádra */
const core = (classId: string, name: string, y: number): Scenario['ships'][0] => ({
  classId, side: 'player', name, pos: { x: 0, y }, vel: { x: 800, y: 0 },
  doctrine: 'player', activeSensors: true,
})

/**
 * Zástěna — také plně ovladatelná (doctrine player): celá stěna poslouchá
 * admirála. Bez rozkazů drží pozici; zařaď ji do STĚNY za vlajkovou loď
 * a protiraketový deštník oblastní obrany pracuje sám.
 */
const screen = (classId: string, name: string, x: number, y: number): Scenario['ships'][0] => ({
  classId, side: 'player', name, pos: { x, y }, vel: { x: 800, y: 0 },
  doctrine: 'player', activeSensors: true,
})

/** imperiální loď stěny */
/**
 * Imperiální loď stěny. Zásobníky odpovídají POVÁLEČNÝM stavům skladů
 * (simulace je kalibrovaná na skutečné imperiální zásoby — zlaté flotily
 * krvácejí a doky nestíhají): DN 400, CA 160, CL 90, DD 50 raket.
 */
const IMP_MAGS: Record<string, number> = {
  'dn-ural': 400, 'ca-bastion': 160, 'cl-sokol': 90, 'dd-vichr': 50,
}
const imp = (classId: string, name: string, x: number, y: number,
  doctrine: 'hunter' | 'escort' = 'hunter'): Scenario['ships'][0] => ({
  classId, side: 'enemy', name, pos: { x, y }, vel: { x: -800, y: 0 },
  doctrine, activeSensors: true, throttle: 0.6, // stěna drží štíty, ne sprint
  missiles: IMP_MAGS[classId],
})

export const mission11: Scenario = {
  id: 'mission11',
  title: 'Stěna proti stěně',
  briefing:
    'Výcviková simulace admirality, sál Královny Eleanor: plná bitevní '
    + 'stěna proti plné stěně, dvacet lodí na dvacet — a všech dvacet '
    + 'poslouchá tebe (Shift-tažení vybere eskadru, STĚNA drží formaci, '
    + 'AUTO palba střílí sama). Rozbij imperiální stěnu — znič všechny '
    + 'čtyři Toleda a vyřaď aspoň '
    + '14 z 20 lodí. Pamatuj na rozpočet reaktoru: stěna, která letí '
    + 'pomalu, má štíty; stěna, která spěchá, hoří. Volitelný bonus: '
    + 'zásobovací základna za jejich stěnou.',
  seed: 20260719, // pevný seed — determinismus
  ambient: '#101c30', // nádech mlhoviny soustavy (fáze B)

  hyperlimit: { kind: 'lineX', x: 120_000_000 },

  ships: [
    // --- ovladatelné jádro (1–8): 4× DN, 4× BC, rozestup 1,2 mil. km ---
    core('dn-vladar', 'ANS Sovereign', 600_000),
    core('dn-vladar', 'ANS Vladař', -600_000),
    core('dn-vladar', 'ANS Koruna', 1_800_000),
    core('dn-vladar', 'ANS Excalibur', -1_800_000),
    core('bc-praporec', 'ANS Praporec', 3_000_000),
    core('bc-praporec', 'ANS Lancelot', -3_000_000),
    core('bc-praporec', 'ANS Gauvain', 4_200_000),
    core('bc-praporec', 'ANS Tristan', -4_200_000),
    // --- AI zástěna (9–20): CA linie + DD deštník před jádrem ---
    screen('ca-bastion', 'ANS Bastion', 1_500_000, 900_000),
    screen('ca-bastion', 'ANS Hradba', 1_500_000, -900_000),
    screen('ca-bastion', 'ANS Val', 1_500_000, 2_400_000),
    screen('ca-bastion', 'ANS Palisáda', 1_500_000, -2_400_000),
    screen('ca-bastion', 'ANS Bašta', 1_500_000, 3_900_000),
    screen('ca-bastion', 'ANS Opevnění', 1_500_000, -3_900_000),
    screen('cl-sokol', 'ANS Sokol', 3_000_000, 600_000),
    screen('cl-sokol', 'ANS Krahujec', 3_000_000, -600_000),
    screen('cl-sokol', 'ANS Ostříž', 3_000_000, 1_800_000),
    screen('cl-sokol', 'ANS Raroh', 3_000_000, -1_800_000),
    screen('cl-sokol', 'ANS Dřemlík', 3_000_000, 3_000_000),
    screen('cl-sokol', 'ANS Luňák', 3_000_000, -3_000_000),
    // --- imperiální stěna (21–40): 4× DN jádro, CA linie, CL/DD zástěna ---
    imp('dn-ural', 'IDS Toledo', 40_000_000, 600_000),
    imp('dn-ural', 'IDS Sevilla', 40_000_000, -600_000),
    imp('dn-ural', 'IDS Córdoba', 40_000_000, 1_800_000),
    imp('dn-ural', 'IDS Granada', 40_000_000, -1_800_000),
    imp('ca-bastion', 'IDS Alcázar', 38_500_000, 900_000),
    imp('ca-bastion', 'IDS Escorial', 38_500_000, -900_000),
    imp('ca-bastion', 'IDS Alhambra', 38_500_000, 2_400_000),
    imp('ca-bastion', 'IDS Aranjuez', 38_500_000, -2_400_000),
    imp('ca-bastion', 'IDS Segovia', 38_500_000, 3_900_000),
    imp('ca-bastion', 'IDS Toro', 38_500_000, -3_900_000),
    imp('cl-sokol', 'IDS Jerez', 37_000_000, 600_000, 'escort'),
    imp('cl-sokol', 'IDS Cádiz', 37_000_000, -600_000, 'escort'),
    imp('cl-sokol', 'IDS Málaga', 37_000_000, 1_800_000, 'escort'),
    imp('cl-sokol', 'IDS Bilbao', 37_000_000, -1_800_000, 'escort'),
    imp('cl-sokol', 'IDS Vigo', 37_000_000, 3_000_000, 'escort'),
    imp('cl-sokol', 'IDS Ferrol', 37_000_000, -3_000_000, 'escort'),
    imp('dd-vichr', 'IDS Lanza', 36_000_000, 1_200_000, 'escort'),
    imp('dd-vichr', 'IDS Espada', 36_000_000, -1_200_000, 'escort'),
    imp('dd-vichr', 'IDS Daga', 36_000_000, 2_700_000, 'escort'),
    imp('dd-vichr', 'IDS Puñal', 36_000_000, -2_700_000, 'escort'),
    {
      // zásobovací základna za stěnou — statický objekt (paměťové zakreslení)
      classId: 'station-zeta', side: 'enemy', name: 'Základna Almadén',
      pos: { x: 55_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'freighter', wedgeOn: false, throttle: 0,
      desc: 'Zásobovací základna Almadén — simulovaný týlový uzel imperiální stěny: munice, izotopy, opravárenské doky. Volitelný bonusový cíl cvičení.',
    },
    {
      // planeta — pevný bod mapy, kreslí se trvale
      classId: 'planet', side: 'neutral', name: 'Avalon Prime',
      pos: { x: -20_000_000, y: 0 }, vel: { x: 0, y: 0 },
      doctrine: 'buoy', wedgeOn: false, throttle: 0,
      desc: 'Avalon Prime — trůnní svět Království. V simulaci admirality představuje to, co stěna brání: důvod, proč se tahle bitva cvičí.',
    },
  ],

  objectives: [
    { id: 'obj-dns', text: 'Znič všechny čtyři imperiální dreadnoughty', state: 'open' },
    { id: 'obj-break', text: 'Zlom stěnu: vyřaď aspoň 14 z 20 lodí', state: 'open' },
  ],

  triggers: [
    {
      // úvod simulace
      id: 'trg-comm-intro', once: true,
      conditions: [{ kind: 'time', t: 10 }],
      actions: [
        {
          kind: 'comm', vo: 'm11-c1', speaker: 'xo',
          text: 'První důstojník: „Simulace admirality běží, kapitáne. Plná stěna proti plné stěně — tohle si u Křižovatky nikdo nezkusil naostro. Doporučuju STĚNU pro jádro a nechat zástěnu pracovat."',
        },
      ],
    },
    {
      // imperiální „admirál" simulace
      id: 'trg-comm-enemy', once: true,
      conditions: [{ kind: 'time', t: 40 }],
      actions: [
        {
          kind: 'comm', vo: 'm11-c2', speaker: 'enemy-captain',
          text: 'IDS Toledo: „Dvacet trupů, avalonský admirále. Historie učí, že stěna se neláme elegancí — láme se tonáží. Ukažte, co jste se u Cádizu naučili."',
        },
      ],
    },
    {
      // lekce rozpočtu reaktoru pro velkou bitvu
      id: 'trg-comm-throttle', once: true,
      conditions: [{ kind: 'time', t: 90 }],
      actions: [
        {
          kind: 'comm', vo: 'm11-c3', speaker: 'tactical',
          text: 'Taktický: „Jejich stěna drží šedesát procent tahu — plné boční štíty. Jestli k nim popluje na sto procent, budeme mít boky z papíru; navrhuju šedesát a nechat je nabíhat na naše salvy."',
        },
      ],
    },

    // zničení čtyř DN ⇒ splnění prvního cíle
    ...ENEMY_DNS.map((id): Scenario['triggers'][0] => ({
      id: `trg-dn-${id}`, once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: id }],
      actions: [{ kind: 'setFlag', flag: `dn-${id}` }],
    })),
    {
      id: 'trg-dns-done', once: true,
      conditions: ENEMY_DNS.map(id => ({ kind: 'flag' as const, flag: `dn-${id}` })),
      actions: [
        { kind: 'setFlag', flag: 'dns-down' },
        { kind: 'objectiveComplete', objectiveId: 'obj-dns' },
        { kind: 'message', text: 'Všechna čtyři Toleda zničena — jádro imperiální stěny je pryč!' },
      ],
    },
    {
      // 14 vyřazených lodí stěny ⇒ druhý cíl
      id: 'trg-break', once: true,
      conditions: [{ kind: 'shipsDestroyedCount', side: 'enemy', count: 14 }],
      actions: [
        { kind: 'setFlag', flag: 'wall-broken' },
        { kind: 'objectiveComplete', objectiveId: 'obj-break' },
      ],
    },
    {
      // bonus: zmapování základny (přiblížení = zakreslení do mapy)
      id: 'trg-base-spotted', once: true,
      conditions: [{ kind: 'distanceBelow', shipA: SOVEREIGN, shipB: BASE, distance: 10_000_000 }],
      actions: [
        { kind: 'addObjective', objectiveId: 'obj-base', text: '(Volitelné) Znič zásobovací základnu Almadén' },
        { kind: 'message', text: 'Základna Almadén zakreslena do mapy — poslední známá poloha zůstane, i když se senzory odvrátí.' },
      ],
    },
    {
      id: 'trg-base-killed', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: BASE }],
      actions: [{ kind: 'objectiveComplete', objectiveId: 'obj-base' }],
    },

    {
      // VÝHRA: DN jádro pryč + stěna zlomená
      id: 'trg-win', once: true,
      conditions: [
        { kind: 'flag', flag: 'dns-down' },
        { kind: 'flag', flag: 'wall-broken' },
      ],
      actions: [
        { kind: 'winMission', text: 'Imperiální stěna se zlomila. Simulace ukončena — admiralita zapisuje: stěna Avalonu drží.' },
      ],
    },
    {
      // prohra: vlajková loď zničena
      id: 'trg-flag-lost', once: true,
      conditions: [{ kind: 'shipDestroyed', shipId: SOVEREIGN }],
      actions: [{ kind: 'loseMission', text: 'ANS Sovereign zničena — stěna bez vlajky se hroutí. Simulace ukončena.' }],
    },
    {
      // prohra: vlastní stěna se zlomila (14 z 20 ztraceno)
      id: 'trg-own-broken', once: true,
      conditions: [{ kind: 'shipsDestroyedCount', side: 'player', count: 14 }],
      actions: [{ kind: 'loseMission', text: 'Čtrnáct trupů pryč — avalonská stěna se zlomila. Simulace ukončena.' }],
    },
  ],
}
