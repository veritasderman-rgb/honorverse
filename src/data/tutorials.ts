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

/** tutoriály po misích; mise bez záznamu tutoriál nemá */
export const TUTORIALS: Record<string, TutorialStep[]> = {
  mission01: MISSION01_STEPS,
}
