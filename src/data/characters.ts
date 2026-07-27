/**
 * Postavy posádky a světa: vlastní jména + krátké medailonky (CS/EN).
 * Klíčem je id mluvčího (ev.speaker / SPEAKERS v ui/panels.ts). Při PRVNÍ
 * replice mluvčího v misi se hráči ukáže intro karta (avatar, jméno, role,
 * medailonek) — postavy se představují postupně, jak do příběhu vstupují.
 */

export interface CharacterDef {
  /** vlastní jméno postavy (nepřekládá se) */
  name: string
  /** EN varianta u generických „jmen" (řízení provozu…); vlastní jména ji nemají */
  nameEn?: string
  /** role — i18n klíč (speaker.*) */
  roleKey: string
  /** medailonek na intro kartě */
  bio: { cs: string; en: string }
}

export const CHARACTERS: Record<string, CharacterDef> = {
  captain: {
    name: 'Alex Rowan',
    roleKey: 'speaker.captain',
    bio: {
      cs: 'To jsi ty. Od celní hlídky u Strážné brány po velení útočné '
        + 'eskadře — tvoje kariéra je páteř téhle války.',
      en: 'That\'s you. From customs picket at the Watchgate to strike-force '
        + 'command — your career is the spine of this war.',
    },
  },
  xo: {
    name: 'Elin Sarnow',
    roleKey: 'speaker.xo',
    bio: {
      cs: 'Výkonná důstojnice. Klidná, když hoří přepážky; tvoje rozkazy '
        + 'překládá posádce a posádku brání před tebou.',
      en: 'Executive officer. Calm while the bulkheads burn; she translates '
        + 'your orders to the crew — and defends the crew to you.',
    },
  },
  engineer: {
    name: 'Tomáš „Chief" Havel',
    roleKey: 'speaker.engineer',
    bio: {
      cs: 'Šéfinženýr. Impelerové prstence zná po hmatu a s reaktorem mluví '
        + 'jako se starým psem. Když říká „to vydrží", vydrží to.',
      en: 'Chief engineer. Knows the impeller rings by touch and talks to '
        + 'the reactor like an old dog. When he says "she\'ll hold" — she '
        + 'holds.',
    },
  },
  tactical: {
    name: 'Dana Reyes',
    roleKey: 'speaker.tactical',
    bio: {
      cs: 'Taktická důstojnice. Čte senzorové stopy jako noty a salvy '
        + 'časuje na vteřiny. Nikdy nepřestala počítat rakety.',
      en: 'Tactical officer. Reads sensor tracks like sheet music and times '
        + 'salvos to the second. She never stops counting missiles.',
    },
  },
  comms: {
    name: 'Jules Okafor',
    roleKey: 'speaker.comms',
    bio: {
      cs: 'Spojařský důstojník. Slyší šepot v šumu — zachycené vysílání, '
        + 'šifry, poslední slova. Éter před ním nic neschová.',
      en: 'Communications officer. Hears whispers in the static — intercepts, '
        + 'ciphers, last words. The ether hides nothing from him.',
    },
  },
  'enemy-captain': {
    name: 'imperiální velitel',
    nameEn: 'Imperial commander',
    roleKey: 'speaker.enemy',
    bio: {
      cs: 'Důstojník doradské Velké armády. Profesionál ve službách '
        + 'caudilla — nepřítel, kterého je chyba podceňovat.',
      en: 'An officer of the Doradan Grand Army. A professional in the '
        + 'caudillo\'s service — an enemy you underestimate at your peril.',
    },
  },
  pirate: {
    name: 'korzár Pomezí',
    nameEn: 'corsair of the Marches',
    roleKey: 'speaker.pirate',
    bio: {
      cs: 'Nájezdník z pásma slabých vlád. Někdo si jen přišel pro náklad; '
        + 'někomu platí palivo Impérium. Rozdíl poznáš podle kázně.',
      en: 'A raider from the belt of weak governments. Some just came for '
        + 'cargo; some have their fuel paid by the Empire. You tell them '
        + 'apart by their discipline.',
    },
  },
  station: {
    name: 'řízení provozu',
    nameEn: 'traffic control',
    roleKey: 'speaker.station',
    bio: {
      cs: 'Dispečeři stanic a terminálů. Vidí každý manifest a každý klín '
        + 'v dosahu — a když volají o pomoc, je zle.',
      en: 'Station and terminal controllers. They see every manifest and '
        + 'every wedge in range — and when they call for help, it\'s bad.',
    },
  },
  governor: {
    name: 'guvernér Pomezí',
    nameEn: 'governor of the Marches',
    roleKey: 'speaker.governor',
    bio: {
      cs: 'Civilní správa na hraně mapy. Málo lodí, hodně starostí — '
        + 'a přesně ví, co ho bude stát každá tvoje salva.',
      en: 'Civil administration at the map\'s edge. Few ships, many worries — '
        + 'and he knows exactly what every salvo of yours will cost him.',
    },
  },
}
