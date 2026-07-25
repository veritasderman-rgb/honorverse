/**
 * Lokalizace (i18n) — angličtina (PRIMÁRNÍ) / čeština. Jazyk se určí
 * z prohlížeče (navigator.language) a jde ho ručně přepnout na úvodní
 * obrazovce; volba se pamatuje v localStorage. Překlady jsou ve slovníku po
 * klíčích; `t(key)` vrací text aktuálního jazyka (zdrojová mutace slovníku
 * je česká, výchozí jazyk hry je ale angličtina).
 */
export type Lang = 'cs' | 'en'

const LANG_KEY = 'wob-lang'

/** detekce jazyka: uložená volba > prohlížeč (cs/sk → čeština) > ANGLIČTINA */
function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'cs' || saved === 'en') return saved
  } catch { /* noop */ }
  try {
    const nav = (navigator.language || (navigator.languages && navigator.languages[0]) || 'en').toLowerCase()
    return nav.startsWith('cs') || nav.startsWith('sk') ? 'cs' : 'en'
  } catch { return 'en' }
}

let current: Lang = detectLang()

export function getLang(): Lang { return current }

export function setLang(l: Lang): void {
  current = l
  try { localStorage.setItem(LANG_KEY, l) } catch { /* noop */ }
  try { document.documentElement.lang = l } catch { /* noop */ }
}

/** přepne jazyk a vrátí nový */
export function toggleLang(): Lang {
  setLang(current === 'cs' ? 'en' : 'cs')
  return current
}

/** slovník: klíč → { cs, en } */
const DICT: Record<string, { cs: string; en: string }> = {
  // hvězdná mapa / menu
  'map.title': { cs: 'HVĚZDNÁ MAPA', en: 'STAR CHART' },
  'map.progress': { cs: 'Postup kampaně:', en: 'Campaign progress:' },
  'map.systems': { cs: 'soustav', en: 'systems' },
  'map.tapHint': { cs: 'klepni na svítící soustavu a vpluj do mise.', en: 'tap a lit system to jump into its mission.' },
  'map.bonusHint': { cs: '★ = boční operace (odměnou plošiny nebo loď).', en: '★ = side op (reward: pods or a ship).' },
  'map.fromSideops': { cs: 'z bočních operací', en: 'from side ops' },
  'map.pods': { cs: 'plošin', en: 'pods' },
  'map.youAreHere': { cs: 'JSI ZDE', en: 'YOU ARE HERE' },
  'menu.story': { cs: '▸ PŘÍBĚH', en: '▸ STORY' },
  'menu.storyOpen': { cs: '▾ PŘÍBĚH', en: '▾ STORY' },
  'menu.hall': { cs: '▸ SÍŇ SLÁVY', en: '▸ HALL OF FAME' },
  'menu.hallOpen': { cs: '▾ SÍŇ SLÁVY', en: '▾ HALL OF FAME' },
  'menu.skirmish': { cs: '⚔ VOLNÁ BITVA', en: '⚔ SKIRMISH' },
  'menu.fleet': { cs: '⚓ SÍŇ FLOTILY', en: '⚓ FLEET HALL' },
  'menu.unlockAll': { cs: '🔓 ODEMKNOUT VŠE (test)', en: '🔓 UNLOCK ALL (test)' },
  'menu.unlockedAll': { cs: '🔓 VŠE ODEMČENO (test)', en: '🔓 ALL UNLOCKED (test)' },
  'menu.lang': { cs: '🌐 English', en: '🌐 Čeština' },
  // úvod kampaně
  'intro.title': { cs: 'WALL OF BATTLE — KAMPAŇ', en: 'WALL OF BATTLE — CAMPAIGN' },
  'intro.continue': { cs: 'POKRAČOVAT', en: 'CONTINUE' },
  // voiceover (namluvené prology/epilogy)
  'vo.play': { cs: '🔊 ▶ komentář', en: '🔊 ▶ voiceover' },
  'vo.pause': { cs: '🔊 ⏸ komentář', en: '🔊 ⏸ voiceover' },
  // briefing
  'brief.admiral': { cs: 'ADMIRALITA — BRIEFING', en: 'ADMIRALTY — BRIEFING' },
  // tutoriál (guided steps)
  'tut.title': { cs: 'VÝCVIK', en: 'TRAINING' },
  'tut.next': { cs: 'POKRAČOVAT', en: 'CONTINUE' },
  'tut.skip': { cs: 'přeskočit výcvik', en: 'skip training' },
  'tut.hide': { cs: 'schovat nápovědu', en: 'hide hint' },
  // hall of fame
  'hall.loading': { cs: 'načítám…', en: 'loading…' },
  'hall.empty': { cs: 'Žebříček je zatím prázdný — buď první!', en: 'Leaderboard is empty — be the first!' },
  'hall.offline': { cs: 'Žebříček je nedostupný (offline?).', en: 'Leaderboard unavailable (offline?).' },
  'hall.captain': { cs: 'kapitán', en: 'captain' },
  'hall.points': { cs: 'body', en: 'points' },
  'hall.missions': { cs: 'misí', en: 'missions' },

  // --- HUD fáze 2a: vždy viditelná vrstva ---
  // sdílené tokeny
  'state.on': { cs: 'ZAP', en: 'ON' },
  'state.off': { cs: 'VYP', en: 'OFF' },
  'common.ok': { cs: 'OK', en: 'OK' },
  'common.unknown': { cs: '???', en: '???' },
  // titulky panelů
  'panel.stats': { cs: 'Bojová statistika', en: 'Combat stats' },
  'panel.fleet': { cs: 'Flotila', en: 'Fleet' },
  'panel.ownShip': { cs: 'Vlastní loď', en: 'Own ship' },
  'panel.contacts': { cs: 'Kontakty', en: 'Contacts' },
  'panel.orders': { cs: 'Rozkazy', en: 'Orders' },
  'panel.objectives': { cs: 'Cíle mise', en: 'Objectives' },
  'panel.comms': { cs: 'Komunikace', en: 'Comms' },
  'panel.log': { cs: 'Log událostí', en: 'Event log' },
  // subsystémy
  'subsys.impellerFwd': { cs: 'impelery příď', en: 'impellers fwd' },
  'subsys.impellerAft': { cs: 'impelery záď', en: 'impellers aft' },
  'subsys.sidewallPort': { cs: 'boční štít LB', en: 'sidewall port' },
  'subsys.sidewallStbd': { cs: 'boční štít PB', en: 'sidewall stbd' },
  'subsys.tubesPort': { cs: 'šachty LB', en: 'tubes port' },
  'subsys.tubesStbd': { cs: 'šachty PB', en: 'tubes stbd' },
  'subsys.energyPort': { cs: 'energet. LB', en: 'energy port' },
  'subsys.energyStbd': { cs: 'energet. PB', en: 'energy stbd' },
  'subsys.pdlc': { cs: 'PDLC', en: 'PDLC' },
  'subsys.cm': { cs: 'protirakety', en: 'counter-missiles' },
  'subsys.sensors': { cs: 'senzory', en: 'sensors' },
  'subsys.ecm': { cs: 'ECM', en: 'ECM' },
  // vlastní loď
  'ownShip.none': { cs: 'žádná loď', en: 'no ship' },
  'ownShip.destroyed': { cs: 'LOĎ ZNIČENA', en: 'SHIP DESTROYED' },
  'ownShip.repairs': { cs: 'opravy:', en: 'repairs:' },
  'repair.balanced': { cs: 'Rovnom.', en: 'Even' },
  'repair.weapons': { cs: 'Zbraně', en: 'Weapons' },
  'repair.drive': { cs: 'Pohon', en: 'Drive' },
  'repair.defense': { cs: 'Obrana', en: 'Defense' },
  'ownShip.wedge': { cs: 'klín:', en: 'wedge:' },
  'ownShip.sensors': { cs: 'senzory:', en: 'sensors:' },
  'sensors.active': { cs: 'AKTIVNÍ', en: 'ACTIVE' },
  'sensors.passive': { cs: 'PASIVNÍ', en: 'PASSIVE' },
  'ownShip.attitude': { cs: 'poloha:', en: 'attitude:' },
  'attitude.rolled': { cs: 'ODVALENÁ', en: 'ROLLED' },
  'attitude.normal': { cs: 'normální', en: 'normal' },
  'ownShip.throttle': { cs: 'tah:', en: 'throttle:' },
  'ownShip.sidewallPower': { cs: 'výkon bočních štítů:', en: 'sidewall power:' },
  'ownShip.tubes': { cs: 'šachty:', en: 'tubes:' },
  'ownShip.tubesFunctional': { cs: 'funkční', en: 'functional' },
  'ownShip.salvoMax': { cs: 'salva max', en: 'max volley' },
  'ownShip.missileTubes': { cs: 'raketové šachty', en: 'missile tubes' },
  'ownShip.energyWeapons': { cs: 'energetické zbraně', en: 'energy weapons' },
  'fire.nextSalvo': { cs: 'další salva za', en: 'next volley in' },
  'fire.firing': { cs: 'pálí', en: 'firing' },
  'fire.waitingEnvelope': { cs: 'čeká na obálku', en: 'waiting for envelope' },
  'fire.seeking': { cs: 'hledá cíl…', en: 'seeking target…' },
  'fire.secondWave': { cs: '2. vlna (HI)', en: '2nd wave (HI)' },
  'fire.launchIn': { cs: 'start za', en: 'launch in' },
  'fire.remaining': { cs: 'zbývá', en: 'remaining' },
  'ownShip.hull': { cs: 'trup:', en: 'hull:' },
  'ownShip.speed': { cs: 'rychlost', en: 'speed' },
  'ownShip.accel': { cs: 'akcel.', en: 'accel.' },
  'ownShip.missiles': { cs: 'rakety', en: 'missiles' },
  'ownShip.pods': { cs: 'plošiny', en: 'pods' },
  'ownShip.cm': { cs: 'CM', en: 'CM' },
  'ownShip.decoy': { cs: 'návnada:', en: 'decoy:' },
  'decoy.active': { cs: 'AKTIVNÍ', en: 'ACTIVE' },
  'ownShip.decoyStock': { cs: 'zásoba', en: 'stock' },
  // lišta rozkazů
  'order.formation': { cs: 'FORMACE:', en: 'FORMATION:' },
  'order.formationShort': { cs: 'F:', en: 'F:' },
  'formation.wall': { cs: 'Stěna', en: 'Wall' },
  'formation.vee': { cs: 'Šíp', en: 'Vee' },
  'formation.dispersed': { cs: 'Rozptyl', en: 'Dispersed' },
  'order.squad': { cs: 'ESKADRA:', en: 'SQUADRON:' },
  'order.squadShort': { cs: 'E:', en: 'Sq:' },
  'squad.nearest': { cs: 'Nejbližší', en: 'Nearest' },
  'squad.nearestShort': { cs: 'Nejbl.', en: 'Near.' },
  'squad.biggest': { cs: 'Největší', en: 'Biggest' },
  'squad.biggestShort': { cs: 'Nejv.', en: 'Big.' },
  'squad.spread': { cs: 'Rozdělit', en: 'Spread' },
  'squad.spreadShort': { cs: 'Rozd.', en: 'Spr.' },
  'squad.salvo': { cs: 'Salva výběru', en: 'Volley (sel.)' },
  'squad.alpha': { cs: 'Srovnat tuby', en: 'Time-on-target' },
  'squad.alphaShort': { cs: 'Alfa', en: 'ToT' },
  'squad.pods': { cs: 'Plošiny ⇒ cíle', en: 'Pods ⇒ targets' },
  'squad.focus': { cs: 'Soustředit', en: 'Focus' },
  'squad.focusShort': { cs: 'Soustř.', en: 'Focus' },
  'squad.hold': { cs: 'Držet palbu', en: 'Hold fire' },
  'order.intercept': { cs: 'Intercept', en: 'Intercept' },
  'order.interceptShort': { cs: '⌖ Icpt', en: '⌖ Icpt' },
  'order.course': { cs: 'Kurz sem', en: 'Course here' },
  'order.courseShort': { cs: 'Kurz', en: 'Course' },
  'order.courseActive': { cs: 'Kurz: klikni do plotu…', en: 'Course: tap the plot…' },
  'order.courseActiveShort': { cs: 'Kurz…', en: 'Course…' },
  'order.selectMode': { cs: 'Výběr ⊞', en: 'Select ⊞' },
  'order.salvoFull': { cs: 'Plná', en: 'Full' },
  'order.salvoLayered': { cs: 'Salva', en: 'Volley' },
  'order.salvoDouble': { cs: 'Obě salvy', en: 'Both sides' },
  'order.salvoDoubleShort': { cs: 'Obě', en: 'Both' },
  'order.launchPods': { cs: 'Plošiny', en: 'Pods' },
  'order.autonomous': { cs: 'autonomní', en: 'autonomous' },
  'order.autonomousShort': { cs: 'auto.', en: 'auto.' },
  'order.guided': { cs: 'řízené', en: 'guided' },
  'order.guidedShort': { cs: 'říz.', en: 'gd.' },
  'order.escortJammer': { cs: '+rušička', en: '+jammer' },
  'order.escortJammerShort': { cs: '+ruš', en: '+jam' },
  'order.autoFire': { cs: 'AUTO', en: 'AUTO' },
  'order.energy': { cs: 'Energie', en: 'Energy' },
  'order.decoy': { cs: 'Návnada', en: 'Decoy' },
  'order.wedge': { cs: 'Klín', en: 'Wedge' },
  'order.sensors': { cs: 'Akt. senzory', en: 'Act. sensors' },
  'order.sensorsShort': { cs: 'Senzor', en: 'Sensor' },
  'order.throttle': { cs: 'tah:', en: 'thr:' },
  // režimy palby (roster)
  'firemode.auto': { cs: 'AUTO', en: 'AUTO' },
  'firemode.nearest': { cs: 'AUTO·nejbl.', en: 'AUTO·near.' },
  'firemode.biggest': { cs: 'AUTO·nejv.', en: 'AUTO·big.' },
  'firemode.spread': { cs: 'AUTO·rozděl.', en: 'AUTO·spread' },
  // flotila / kontakty
  'fleet.ai': { cs: 'AI', en: 'AI' },
  'fleet.missiles': { cs: 'rakety', en: 'missiles' },
  'fleet.cm': { cs: 'CM', en: 'CM' },
  'contacts.none': { cs: 'žádné kontakty', en: 'no contacts' },
  'contact.surrendered': { cs: 'kapituloval', en: 'surrendered' },
  'contact.age': { cs: 'stáří', en: 'age' },
  'contact.more': { cs: 'dalších', en: 'more' },
  'idq.wedge': { cs: 'jen klín', en: 'wedge only' },
  'idq.class': { cs: 'třída?', en: 'class?' },
  'idq.ident': { cs: 'ident.', en: 'ident.' },
  // bojová statistika
  'stats.ourFire': { cs: 'NAŠE PALBA', en: 'OUR FIRE' },
  'stats.launched': { cs: 'odpáleno', en: 'launched' },
  'stats.hits': { cs: 'zásahy', en: 'hits' },
  'stats.successRate': { cs: 'úspěšnost', en: 'hit rate' },
  'stats.losses': { cs: 'ztráty:', en: 'losses:' },
  'stats.incoming': { cs: 'PŘÍCHOZÍ', en: 'INCOMING' },
  'stats.launchedAtUs': { cs: 'odpáleno na nás', en: 'launched at us' },
  'stats.killedByDefense': { cs: 'pobráno obranou', en: 'stopped by defense' },
  'stats.hitsOnUs': { cs: 'zásahy do nás', en: 'hits on us' },
  'stats.ourDefense': { cs: 'naše obrana:', en: 'our defense:' },
  // ztráty raket (rozpad)
  'loss.cm': { cs: 'protirakety', en: 'counter-missiles' },
  'loss.pdlc': { cs: 'PDLC', en: 'PDLC' },
  'loss.wedge': { cs: 'klín', en: 'wedge' },
  'loss.ecm': { cs: 'ECM/decoye', en: 'ECM/decoys' },
  'loss.decoy': { cs: 'návnada', en: 'decoy' },
  'loss.link': { cs: 'ztráta zámku', en: 'lock lost' },
  'loss.dud': { cs: 'hlavice mimo', en: 'warhead miss' },
  'loss.expired': { cs: 'konec doletu', en: 'burnt out' },
  'loss.lost': { cs: 'cíl zanikl', en: 'target lost' },
  // topbar
  'topbar.time': { cs: 'ČAS', en: 'TIME' },
  'topbar.autoSlow': { cs: '⚠', en: '⚠' },
  'topbar.slowed': { cs: 'ZPOMALENO', en: 'SLOWED' },
  // mluvčí (komunikace / log)
  'speaker.captain': { cs: 'Kapitán', en: 'Captain' },
  'speaker.xo': { cs: 'První důstojník', en: 'First Officer' },
  'speaker.engineer': { cs: 'Inženýr', en: 'Engineer' },
  'speaker.tactical': { cs: 'Taktický důstojník', en: 'Tactical Officer' },
  'speaker.comms': { cs: 'Spojař', en: 'Comms Officer' },
  'speaker.enemy': { cs: 'Nepřátelský kapitán', en: 'Enemy Captain' },
  'speaker.pirate': { cs: 'Pirát', en: 'Pirate' },
  'speaker.station': { cs: 'Stanice', en: 'Station' },
  'speaker.governor': { cs: 'Guvernér', en: 'Governor' },
  'comms.none': { cs: 'žádná komunikace', en: 'no comms' },
  'log.none': { cs: 'zatím žádné události', en: 'no events yet' },
}

/** překlad podle aktuálního jazyka (fallback čeština, pak samotný klíč) */
export function t(key: string): string {
  const e = DICT[key]
  if (!e) return key
  return e[current] ?? e.cs
}
