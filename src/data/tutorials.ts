/**
 * Tutoriály misí: deklarativní „veď mě za ruku" kroky. Každý krok ukáže
 * bublinu (CS/EN) a volitelně SPOTLIGHT na prvek UI (CSS selektor); splní se
 * podmínkou nad snapshotem simulace (deterministicky — žádné časovače), nebo
 * ručně tlačítkem POKRAČOVAT (kroky bez `done`).
 *
 * Čistá data + čisté podmínky (bez DOM) — vykreslení dělá ui/tutorialView.
 */
import type { ShipState, SimState } from '../sim/types'
import type { UiState } from '../ui/panels'

export interface TutorialStep {
  /** CSS selektor prvku pro spotlight; null = bublina bez zvýraznění */
  anchor: string | null
  /** text bubliny v obou jazycích */
  text: { cs: string; en: string }
  /** splněno → další krok; bez `done` je krok ruční (tlačítko POKRAČOVAT) */
  done?: (state: SimState, ui: UiState) => boolean
}

/** vlastní loď hráče ze snapshotu (aktivní dle UI) */
const own = (state: SimState, ui: UiState): ShipState | undefined =>
  state.ships.find(s => s.id === ui.ownShipId)

/** je loď daného id CÍLEM MISE (objective — ◎ na displeji)? */
const isObjectiveShip = (state: SimState, id: number | null | undefined): boolean =>
  id != null && state.ships.find(s => s.id === id)?.objective === true

/** MISE 1 — pohyb, čas a senzory (celní kontrola Cygnusu) */
const MISSION01_STEPS: TutorialStep[] = [
  {
    anchor: null,
    text: {
      cs: 'Vítej na můstku, kapitáne. Tohle je taktický displej: tvoje loď je '
        + 'zelená značka uprostřed, vzdálenosti jsou skutečné — miliony '
        + 'kilometrů. Projdeme si základy velení.',
      en: 'Welcome to the bridge, captain. This is the tactical display: your '
        + 'ship is the green marker in the middle, and distances are real — '
        + 'millions of kilometres. Let\'s walk through the basics of command.',
    },
  },
  {
    anchor: '[data-fold="contacts"]',
    text: {
      cs: 'Vpravo nahoře je seznam KONTAKTŮ (řazený podle vzdálenosti). '
        + 'Cíl mise je označený přímo na displeji jako ◎ Cygnus — klepni na '
        + 'jeho značku na displeji, nebo na jeho řádek v seznamu. Tím ho '
        + 'vybereš jako cíl.',
      en: 'Top right is the CONTACTS list (sorted by range). The mission '
        + 'target is marked right on the display as ◎ Cygnus — tap its '
        + 'marker on the display, or its row in the list. That selects it '
        + 'as your target.',
    },
    // musí být vybraný PRÁVĚ Cygnus (◎) — jiný kontakt krok neposune,
    // jinak by nováček poslušně stíhal třeba sondu a misi prohrál
    done: (s, ui) => isObjectiveShip(s, ui.targetId),
  },
  {
    anchor: '[data-act="intercept"]',
    text: {
      cs: 'Autopilot spočítá stíhací kurz za tebe: dej rozkaz INTERCEPT. '
        + 'Loď se sama otočí a poletí cíli naproti.',
      en: 'The autopilot computes the pursuit course for you: order '
        + 'INTERCEPT. The ship will turn and fly to meet the target.',
    },
    done: (s, ui) => {
      const nav = own(s, ui)?.nav
      return nav?.kind === 'intercept' && isObjectiveShip(s, nav.targetId)
    },
  },
  {
    anchor: '[data-act="throttle:100"]',
    text: {
      cs: 'Přidej TAH na 100 %. Pozor na fyziku reaktoru: čím víc energie '
        + 'žere pohon, tím slabší jsou boční štíty — rychlý přílet znamená '
        + 'papírové boky.',
      en: 'Set THROTTLE to 100 %. Mind the reactor: the more power the drive '
        + 'eats, the weaker your sidewalls — a fast approach means paper '
        + 'flanks.',
    },
    done: (s, ui) => (own(s, ui)?.throttle ?? 0) >= 0.99,
  },
  {
    anchor: '[data-comp="100"]',
    text: {
      cs: 'Vesmír je velký a intercept trvá desítky minut. Zrychli ČAS na '
        + '100× — u důležitých událostí se komprese sama zpomalí.',
      en: 'Space is big and an intercept takes tens of minutes. Speed TIME '
        + 'up to 100× — compression drops automatically on important events.',
    },
    done: (_s, ui) => ui.compression >= 100,
  },
  {
    anchor: '[data-act="sensors"]',
    text: {
      cs: 'Pasivní senzory vidí jen impelerový klín. Zapni AKTIVNÍ SENZORY — '
        + 'zblízka dají plnou identifikaci i lepší palebné řešení. Daň: '
        + 'vyzařuješ, a nepřítel tě vidí líp.',
      en: 'Passive sensors only see impeller wedges. Switch ACTIVE SENSORS '
        + 'on — up close they give full identification and a better firing '
        + 'solution. The price: you radiate, and the enemy sees you better.',
    },
    done: (s, ui) => own(s, ui)?.activeSensors === true,
  },
  {
    anchor: null,
    text: {
      cs: 'Teď nech loď letět: přibliž se ke Cygnu na 1 milion km a proveď '
        + 'kontrolu. Postup mise sleduješ v panelu CÍLE MISE vpravo.',
      en: 'Now let the ship fly: close to within 1 million km of Cygnus and '
        + 'run the inspection. Track progress in the MISSION OBJECTIVES '
        + 'panel on the right.',
    },
    done: s => s.objectives.some(o => o.id === 'obj-inspect' && o.state === 'done'),
  },
  {
    anchor: null,
    text: {
      cs: 'Kontrola hotová — a Cygnus se dává na útěk k hyperlimitu! Nedovol '
        + 'mu uniknout: drž intercept a až budeš v dosahu, zkus salvu '
        + '(SALVA 2). Zbytek už je na tobě. Hodně štěstí, kapitáne.',
      en: 'Inspection done — and Cygnus is running for the hyper limit! '
        + 'Don\'t let it escape: hold your intercept and, once in range, try '
        + 'a salvo (SALVO 2). The rest is up to you. Good luck, captain.',
    },
  },
]

/** MISE 2 — palba a obrana (eskorta konvoje proti nájezdníkům) */
const MISSION02_STEPS: TutorialStep[] = [
  {
    anchor: null,
    text: {
      cs: 'Eskorta konvoje: čtyři obchodníci, ty jsi jediná válečná loď. '
        + 'Zpravodajství hlásí nájezdníky — dnes se naučíš STŘÍLET. '
        + 'Drž se poblíž konvoje: piráti jdou po obchodnících, ne po tobě.',
      en: 'Convoy escort: four merchantmen, and you are the only warship. '
        + 'Intelligence reports raiders — today you learn to SHOOT. Stay '
        + 'near the convoy: pirates hunt the merchants, not you.',
    },
  },
  {
    anchor: '[data-fold="contacts"]',
    text: {
      cs: 'Až se objeví nepřátelský kontakt (rudý ◆), vyber ho jako cíl — '
        + 'klepni na něj v seznamu KONTAKTŮ nebo na displeji.',
      en: 'When a hostile contact appears (red ◆), select it as your '
        + 'target — tap it in the CONTACTS list or on the display.',
    },
    done: (s, ui) => {
      const tgt = s.ships.find(x => x.id === ui.targetId)
      return tgt?.side === 'enemy' && !tgt.destroyed
    },
  },
  {
    anchor: '[data-act="salvo2"]',
    text: {
      cs: 'Odpal SALVU 2 raket. Poletí minuty — sleduj je na displeji. '
        + 'Obrana cíle (protirakety, bodová obrana) část salvy sestřelí; '
        + 'čím blíž odpálíš, tím míň času na obranu cíli dáš.',
      en: 'Fire a SALVO of 2 missiles. They fly for minutes — watch them on '
        + 'the display. The target\'s defences (counter-missiles, point '
        + 'defence) will kill part of the salvo; the closer you launch, the '
        + 'less time you give them.',
    },
    done: (_s, ui) => ui.report.ourLaunched > 0,
  },
  {
    anchor: '[data-act="autoFire"]',
    text: {
      cs: 'Ruční salvy tě u víc cílů zdrží. Zapni AUTO palbu — loď sama '
        + 'opakuje salvy, dokud je cíl v dosahu, a řídí i energetické '
        + 'baterie zblízka.',
      en: 'Manual salvos slow you down with multiple targets. Switch AUTO '
        + 'fire on — the ship repeats salvos while the target is in range '
        + 'and handles the energy batteries up close.',
    },
    done: (s, ui) => own(s, ui)?.fireControl.mode === 'auto',
  },
  {
    anchor: null,
    text: {
      cs: 'Obrana běží sama: protirakety a bodová obrana sestřelují '
        + 'příchozí rakety automaticky. Tvoje práce je pozice — loď MEZI '
        + 'piráty a konvojem chrání obchodníky vlastní obranou.',
      en: 'Defence runs itself: counter-missiles and point defence engage '
        + 'incoming fire automatically. Your job is position — a ship '
        + 'BETWEEN the pirates and the convoy shields the merchants with '
        + 'its own defences.',
    },
  },
  {
    anchor: null,
    text: {
      cs: 'Znič prvního nájezdníka. Sleduj BOJOVOU STATISTIKU vlevo — '
        + 'vidíš v ní úspěšnost svých salv i skóre obrany.',
      en: 'Destroy your first raider. Watch the COMBAT STATS panel on the '
        + 'left — it tracks your salvo hit rate and your defence score.',
    },
    done: s => s.ships.some(sh => sh.side === 'enemy' && sh.destroyed),
  },
  {
    anchor: null,
    text: {
      cs: 'První zářez na pažbě! Dokonči práci: zažeň nebo znič zbytek '
        + 'nájezdníků a doveď konvoj domů. Hodně štěstí, kapitáne.',
      en: 'First notch on the stock! Finish the job: drive off or destroy '
        + 'the remaining raiders and bring the convoy home. Good luck, '
        + 'captain.',
    },
  },
]

/** MISE 3 — obrana zblízka (eskorta Mercatoru; „obchodník", který nesedí) */
const MISSION03_STEPS: TutorialStep[] = [
  {
    anchor: null,
    text: {
      cs: 'Doprovod „poškozeného obchodníka" ke stanici Sázava. Rozkaz zní: '
        + 'drž se do 2,5 milionu km. Zpravodajství o Mercatoru nemá žádné '
        + 'záznamy… měj oči otevřené.',
      en: 'Escort a "damaged merchantman" to Sázava Station. Orders: stay '
        + 'within 2.5 million km. Intelligence has no records on Mercator '
        + 'at all… keep your eyes open.',
    },
  },
  {
    anchor: '[data-act="course"]',
    text: {
      cs: 'Tentokrát letíš vlastní trasou: aktivuj KURZ SEM a klepni na '
        + 'displej poblíž Mercatoru. SHIFT-klepnutím přidáš další body '
        + 'trasy — loď je proletí širokou zatáčkou bez zastavení.',
      en: 'This time you fly your own route: activate COURSE and tap the '
        + 'display near Mercator. SHIFT-tap adds more waypoints — the ship '
        + 'flies through them in a wide turn without stopping.',
    },
    done: (s, ui) => own(s, ui)?.nav?.kind === 'course',
  },
  {
    anchor: '[data-act="sensors"]',
    text: {
      cs: 'Loď bez záznamů si zaslouží pořádný pohled. Zapni AKTIVNÍ '
        + 'SENZORY a drž se blízko — plná identifikace ti může zachránit '
        + 'život.',
      en: 'A ship with no records deserves a hard look. Switch ACTIVE '
        + 'SENSORS on and stay close — full identification may save your '
        + 'life.',
    },
    done: (s, ui) => own(s, ui)?.activeSensors === true,
  },
  {
    anchor: null,
    text: {
      cs: 'Drž eskortní pozici (do 2,5 M km) a sleduj Mercator. Jestli je '
        + 'to past, sklapne najednou — a zblízka.',
      en: 'Hold escort station (within 2.5 M km) and watch Mercator. If '
        + 'this is a trap, it will spring all at once — and up close.',
    },
    // past sklapla: Mercator odhodil masku (doktrína hunter)
    done: s => s.ships.some(sh => sh.name === 'Mercator' && sh.doctrine === 'hunter'),
  },
  {
    anchor: '[data-act="deployDecoy"]',
    text: {
      cs: 'PAST! Mercator je pomocný křižník. Na příchozí salvu vypusť '
        + 'NÁVNADU — tažený klamný cíl na sebe stáhne část raket. Jedna '
        + 'návnada ≈ jedna pohlcená raketa.',
      en: 'A TRAP! Mercator is an auxiliary cruiser. Against the incoming '
        + 'salvo, deploy a DECOY — a towed false target that soaks up '
        + 'missiles. One decoy ≈ one absorbed missile.',
    },
    done: (s, ui) => own(s, ui)?.decoyActive === true,
  },
  {
    anchor: '[data-act="energy"]',
    text: {
      cs: 'Jste blízko — tohle je souboj na nože. Použij ENERGETICKÉ '
        + 'ZBRANĚ: pod 500 tisíc km pálí lasery a grasery skrz boky '
        + 'okamžitě, bez letu rakety.',
      en: 'You are close — this is a knife fight. Use ENERGY weapons: '
        + 'under 500 thousand km, lasers and grasers hit through flanks '
        + 'instantly, no missile flight time.',
    },
    done: (s, ui) => (own(s, ui)?.energyCooldown ?? 0) > 0,
  },
  {
    anchor: null,
    text: {
      cs: 'Teď je to bitva jako každá jiná — a ty už víš všechno, co '
        + 'potřebuješ. Potop Mercator, kapitáne. Admiralita bude chtít '
        + 'jeho navigační jádro.',
      en: 'Now it\'s a battle like any other — and you already know '
        + 'everything you need. Sink Mercator, captain. The Admiralty will '
        + 'want its navigation core.',
    },
  },
]

/** MISE 0 — akademie: úplné základy (kamera, čas, kurz, senzory, salva) */
const MISSION00_STEPS: TutorialStep[] = [
  {
    anchor: null,
    text: {
      cs: 'Vítej na akademii, kadete. Tohle je taktický displej — tvoje loď '
        + 'je zelená značka, vzdálenosti jsou skutečné miliony kilometrů. '
        + 'Dnes nikdo nestřílí zpátky; projdeme úplné základy.',
      en: 'Welcome to the academy, cadet. This is the tactical display — your '
        + 'ship is the green marker, and the distances are real millions of '
        + 'kilometres. Nobody shoots back today; we\'ll cover the very basics.',
    },
  },
  {
    anchor: null,
    text: {
      cs: 'Nejdřív kamera: kolečkem myši (nebo štípnutím prstů) přibližuješ '
        + 'a oddaluješ, tažením posouváš mapu. Vyzkoušej si to a pokračuj.',
      en: 'Camera first: zoom with the mouse wheel (or pinch), drag to pan '
        + 'the map. Try it, then continue.',
    },
  },
  {
    anchor: '[data-fold="contacts"]',
    text: {
      cs: 'Vpravo nahoře je seznam KONTAKTŮ. Tvůj první cíl letu je '
        + 'navigační bóje Alfa — na displeji nese značku ◎. Klepni na ni '
        + '(na displeji, nebo v seznamu).',
      en: 'Top right is the CONTACTS list. Your first waypoint is nav buoy '
        + 'Alfa — it carries the ◎ marker on the display. Tap it (on the '
        + 'display or in the list).',
    },
    done: (s, ui) => isObjectiveShip(s, ui.targetId),
  },
  {
    anchor: '[data-act="course"]',
    text: {
      cs: 'Teď kurz: klepni na KURZ SEM a pak na místo u bóje. Loď si '
        + 'spočítá otočku, zrychlení i brzdění sama — ty velíš, ona letí.',
      en: 'Now the course: tap COURSE HERE, then a spot near the buoy. The '
        + 'ship computes the turn, burn and braking herself — you command, '
        + 'she flies.',
    },
    done: (s, ui) => own(s, ui)?.nav != null,
  },
  {
    anchor: '[data-act="throttle:100"]',
    text: {
      cs: 'Tah rozhoduje, jak rychle se rozkaz stane pohybem: nastav 100 %. '
        + '(Nad 100 % je nouzový výkon — ten si šetři na horší dny.)',
      en: 'Throttle decides how fast orders become motion: set 100%. '
        + '(Above 100% is emergency power — save that for worse days.)',
    },
    done: (s, ui) => (own(s, ui)?.throttle ?? 0) >= 0.99,
  },
  {
    anchor: '.tb-comp',
    text: {
      cs: 'ZDE ovládáš čas: vyšší násobek (10×, 100×…) čas zrychlí, 1× ho '
        + 'vrátí do reálného tempa a ⏸ zastaví úplně. U důležité události '
        + 'hra sama zpomalí na 1× — a v klidných pasážích zase sama přidá. '
        + 'Zrychli teď na 100×.',
      en: 'THIS is the time control: a higher multiplier (10×, 100×…) speeds '
        + 'time up, 1× returns to real time and ⏸ pauses completely. The '
        + 'game slows to 1× on important events by itself — and speeds up '
        + 'again in quiet stretches. Speed up to 100× now.',
    },
    done: (s, ui) => ui.compression >= 10,
  },
  {
    anchor: null,
    text: {
      cs: 'Teď jen doleť k bóji — sleduj, jak se vzdálenost v seznamu '
        + 'kontaktů krátí. Instruktorka se ozve, až budeš u ní.',
      en: 'Now just fly to the buoy — watch the range shrink in the contacts '
        + 'list. The instructor will call when you arrive.',
    },
    done: s => s.objectives.find(o => o.id === 'obj-buoy')?.state === 'done',
  },
  {
    anchor: '[data-act="sensors"]',
    text: {
      cs: 'Ostrá část: na okruhu stojí cvičný kýl Beta. Zapni AKTIVNÍ '
        + 'SENZORY — pasivní odposlech ti řekne, ŽE tam něco je; aktivní '
        + 'radar ti řekne CO. (V boji se tím ale prozradíš.)',
      en: 'Live-fire part: training hulk Beta sits on the circuit. Switch '
        + 'ACTIVE SENSORS on — passive listening tells you something is '
        + 'there; active radar tells you WHAT. (In combat it also gives '
        + 'you away.)',
    },
    done: s => s.contacts.player.some(c => c.shipId === 3 && c.idQuality >= 1),
  },
  {
    anchor: '.ob',
    text: {
      cs: 'OVLÁDÁNÍ ZBRANÍ — každé tlačítko dělá něco jiného:\n'
        + '• SALVA 2 / SALVA 4 / PLNÁ — odpal až 2, až 4, nebo všechny šachty '
        + 'boku (víc, než má loď šachet, nevystřelíš — Vichr má 3)\n'
        + '• SALVA 2+1 — vrstvená: druhá vlna dopadne SPOLEČNĚ s první\n'
        + '• OBĚ SALVY — dvojitá salva z obou boků (loď se mezi nimi otočí)\n'
        + '• PLOŠINY — jednorázový úder z tažených raketových podů\n'
        + '• ŘÍZENÉ — salva letí na řídicím spoji lodi (ztráta spoje = slábnoucí '
        + 'zámek); přepnutím na SAMOSTATNÉ je „vystřel a zapomeň"\n'
        + '• +RUŠIČKA — jedna raketa salvy se obětuje jako rušička\n'
        + '• AUTO — taktický důstojník pak střílí sám\n'
        + '• ENERGIE — energetické baterie zblízka (pod 500 tis. km)\n'
        + '• NÁVNADA svede příchozí rakety; KLÍN a AKT. SENZORY řídí obranu a průzkum\n'
        + 'Pro dnešek bude stačit SALVA 4.',
      en: 'WEAPON CONTROLS — every button does something different:\n'
        + '• VOLLEY 2 / VOLLEY 4 / FULL — launch up to 2, up to 4, or every '
        + 'tube on the broadside (you can\'t fire more tubes than the ship '
        + 'has — a Vichr carries 3)\n'
        + '• VOLLEY 2+1 — layered: the second wave lands TOGETHER with the first\n'
        + '• BOTH SIDES — a double salvo from both broadsides (the ship rolls between them)\n'
        + '• PODS — a one-shot strike from the towed missile pods\n'
        + '• GUIDED — the salvo rides your ship\'s control link (lose the link '
        + 'and the lock erodes); switch to AUTONOMOUS for fire-and-forget\n'
        + '• +JAMMER — one missile of the salvo sacrifices itself as a jammer\n'
        + '• AUTO — the tactical officer keeps firing on his own\n'
        + '• ENERGY — close-range energy batteries (under 500k km)\n'
        + '• DECOY seduces incoming missiles; WEDGE and ACT. SENSORS drive defense and recon\n'
        + 'For today, VOLLEY 4 will do.',
    },
  },
  {
    anchor: '[data-act="salvo4"]',
    text: {
      cs: 'Cíl klasifikován. Vyber kýl Beta jako cíl a pošli SALVU 4 — '
        + 'rakety poletí desítky sekund, u cíle bez obrany ale dopadnou '
        + 'všechny. První ostrá salva tvé kariéry, kadete.',
      en: 'Target classified. Select hulk Beta as your target and send '
        + 'VOLLEY 4 — the missiles fly for tens of seconds, but against an '
        + 'undefended target they all strike home. The first live salvo of '
        + 'your career, cadet.',
    },
    done: s => s.missiles.some(m => m.side === 'player')
      || s.ships.find(x => x.id === 3)?.destroyed === true,
  },
  {
    anchor: null,
    text: {
      cs: 'Salva letí — přibliž si ji na displeji a sleduj dolet. Až kýl '
        + 'zmizí z displeje, akademie tě pouští do služby.',
      en: 'The salvo is away — zoom in and watch it run. When the hulk '
        + 'disappears from the display, the academy clears you for duty.',
    },
    done: s => s.outcome === 'win',
  },
]

/** tutoriály po misích; mise bez záznamu tutoriál nemá */
export const TUTORIALS: Record<string, TutorialStep[]> = {
  mission00: MISSION00_STEPS,
  mission01: MISSION01_STEPS,
  mission02: MISSION02_STEPS,
  mission03: MISSION03_STEPS,
}
