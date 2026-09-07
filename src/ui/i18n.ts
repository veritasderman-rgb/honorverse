/**
 * Lokalizace (i18n) — angličtina (PRIMÁRNÍ) / čeština. Jazyk se určí
 * z prohlížeče (navigator.language) a jde ho ručně přepnout na úvodní
 * obrazovce; volba se pamatuje v localStorage. Překlady jsou ve slovníku po
 * klíčích; `t(key)` vrací text aktuálního jazyka (zdrojová mutace slovníku
 * je česká, výchozí jazyk hry je ale angličtina).
 */
export type Lang = 'cs' | 'en'

const LANG_KEY = 'wob-lang'

/** Jazyk: uložená volba > ANGLIČTINA. Hra začíná vždy anglicky — čeština
 *  se zapíná aktivně tlačítkem jazyka (volba se pak pamatuje). */
function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY)
    if (saved === 'cs' || saved === 'en') return saved
  } catch { /* noop */ }
  return 'en'
}

let current: Lang = detectLang()
// DOM v souladu s detekcí (uložená čeština musí přepsat statické lang="en"
// v index.html — čtou to čtečky obrazovky i analytika)
try { document.documentElement.lang = current } catch { /* worker/testy bez DOM */ }

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
  // souhlas s cookies (GA4)
  'consent.text': {
    cs: 'Hra měří anonymní návštěvnost (Google Analytics). Bez souhlasu se neukládají žádné cookies.',
    en: 'This game measures anonymous traffic (Google Analytics). No cookies are stored without your consent.',
  },
  'consent.accept': { cs: 'Souhlasím', en: 'Accept' },
  'consent.decline': { cs: 'Odmítnout', en: 'Decline' },
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
  // filmové intro (titulní obrazovka)
  'cine.enter': { cs: '▶ VSTOUPIT DO BITVY', en: '▶ ENTER THE BATTLE' },
  'cine.skip': { cs: 'přeskočit intro', en: 'skip intro' },
  'menu.intro': { cs: '🎬 INTRO', en: '🎬 INTRO' },
  // plné názvy typů trupů (skirmish, karta třídy)
  'hull.DD': { cs: 'Torpédoborec', en: 'Destroyer' },
  'hull.CL': { cs: 'Lehký křižník', en: 'Light cruiser' },
  'hull.CA': { cs: 'Těžký křižník', en: 'Heavy cruiser' },
  'hull.BC': { cs: 'Bitevní křižník', en: 'Battlecruiser' },
  'hull.DN': { cs: 'Dreadnought', en: 'Dreadnought' },
  'hull.MERCH': { cs: 'Obchodní loď', en: 'Merchantman' },
  'hull.STN': { cs: 'Orbitální stanice', en: 'Orbital station' },
  'hull.DB': { cs: 'Kurýrní loď', en: 'Dispatch courier' },
  'hull.PRB': { cs: 'Sonda', en: 'Probe' },
  'hull.PLT': { cs: 'Planeta', en: 'Planet' },
  'clscard.close': { cs: 'ZAVŘÍT', en: 'CLOSE' },
  'sk.detailTip': { cs: 'klepni pro detail třídy', en: 'tap for class details' },
  // arkáda
  'menu.arcade': { cs: '⚡ ARKÁDA', en: '⚡ ARCADE' },
  'arcade.tip': {
    cs: 'Okamžitá bitva zblízka — náhodná sestava, žádný briefing. 5 her na sezení, +1 za každou vyhranou misi kampaně.',
    en: 'Instant close-range battle — random line-up, no briefing. 5 games per session, +1 for every campaign mission you win.',
  },
  'arcade.noneTitle': { cs: 'ARKÁDA VYČERPÁNA', en: 'ARCADE SPENT' },
  'arcade.none': {
    cs: 'Limit arkádových her pro tohle sezení je vyčerpaný. Další hru získáš za každou vyhranou misi kampaně — nebo se vrať později.',
    en: 'You have used up this session\'s arcade games. Win a campaign mission to earn another — or come back later.',
  },
  // voiceover (namluvené prology/epilogy)
  'vo.play': { cs: '🔊 ▶ komentář', en: '🔊 ▶ voiceover' },
  'vo.pause': { cs: '🔊 ⏸ komentář', en: '🔊 ⏸ voiceover' },
  // briefing / příprava mise
  'brief.admiral': { cs: 'ADMIRALITA — BRIEFING', en: 'ADMIRALTY — BRIEFING' },
  'prep.arms': { cs: 'VÝZBROJ', en: 'ARMAMENT' },
  'tut.fwdTip': { cs: 'další krok', en: 'next step' },
  'prep.start': { cs: 'START', en: 'START' },
  'prep.resume': { cs: '⏵ POKRAČOVAT', en: '⏵ RESUME' },
  'prep.back': { cs: 'ZPĚT', en: 'BACK' },
  'loadout.strike': { cs: 'Úderný', en: 'Strike' },
  'loadout.strike.desc': {
    cs: 'Víc raket a plné plošiny, méně protiraket — sázka na proražení obrany.',
    en: 'More missiles and full pods, fewer counter-missiles — a bet on breaking through.',
  },
  'loadout.balanced': { cs: 'Vyvážený', en: 'Balanced' },
  'loadout.balanced.desc': {
    cs: 'Standardní příděl výzbroje třídy — bez kompromisů.',
    en: 'The class\'s standard armament allotment — no compromises.',
  },
  'loadout.defense': { cs: 'Obranný', en: 'Defensive' },
  'loadout.defense.desc': {
    cs: 'Víc protiraket a návnad, méně útočných raket, bez plošin — přežití vlny.',
    en: 'More counter-missiles and decoys, fewer attack missiles, no pods — surviving the wave.',
  },
  // obrazovka výsledku
  'outcome.win': { cs: 'VÍTĚZSTVÍ', en: 'VICTORY' },
  'outcome.lose': { cs: 'PORÁŽKA', en: 'DEFEAT' },
  'outcome.endedAt': { cs: 'Mise ukončena v čase', en: 'Mission ended at' },
  'outcome.again': { cs: 'ZNOVU', en: 'RETRY' },
  'outcome.missionSelect': { cs: 'VÝBĚR MISE', en: 'MISSION SELECT' },
  'outcome.score': { cs: 'SKÓRE', en: 'SCORE' },
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
  // jednotky / formát
  'unit.kkm': { cs: 'tis. km', en: 'k km' },
  // žebříček (formulář po výhře)
  'lb.nickPh': { cs: 'přezdívka (2–24 znaků)', en: 'nickname (2–24 chars)' },
  'lb.emailPh': { cs: 'e-mail (nepovinný — celkové pořadí)', en: 'e-mail (optional — overall ranking)' },
  'lb.consent': {
    cs: 'souhlasím s uložením e-mailu pro historické skóre',
    en: 'I agree to my e-mail being stored for historical scores',
  },
  'lb.submit': { cs: 'ODESLAT DO ŽEBŘÍČKU', en: 'SUBMIT TO LEADERBOARD' },
  'lb.errNick': { cs: 'Zadej přezdívku (aspoň 2 znaky).', en: 'Enter a nickname (at least 2 characters).' },
  'lb.errConsent': {
    cs: 'E-mail uložíme jen se souhlasem — zaškrtni ho, nebo e-mail smaž.',
    en: 'We only store the e-mail with consent — tick the box, or clear the e-mail.',
  },
  'lb.sending': { cs: 'odesílám…', en: 'submitting…' },
  'lb.failed': { cs: 'Odeslání selhalo (offline?). Zkus to znovu.', en: 'Submission failed (offline?). Try again.' },
  'lb.saved': { cs: 'Skóre uloženo.', en: 'Score saved.' },
  'lb.loadFailed': { cs: 'Žebříček se nepodařilo načíst.', en: 'Could not load the leaderboard.' },
  'lb.time': { cs: 'čas', en: 'time' },
  'lb.losses': { cs: 'ztráty', en: 'losses' },
  // shrnutí pořadí hráče (rankSummary)
  'rank.position': { cs: 'Jsi {rank}. z {total} kapitánů (top {pct} %).', en: 'You are #{rank} of {total} captains (top {pct} %).' },
  'rank.toFirst': { cs: 'Na 1. místo ti chybí {pts} bodů.', en: 'You need {pts} more points for 1st place.' },
  'rank.first': { cs: 'Držíš 1. místo!', en: 'You hold 1st place!' },
  'rank.toTop10': { cs: 'Do TOP 10 chybí {pts} bodů.', en: '{pts} points short of the TOP 10.' },
  'rank.inTop10': { cs: 'Jsi v TOP 10 téhle mise!', en: 'You are in the TOP 10 of this mission!' },
  // řádky skóre (breakdown ze scoreMission — klíče, čísla dosazuje UI)
  'score.win': { cs: 'vítězství', en: 'victory' },
  'score.objectives': { cs: 'splněné cíle ({n}×)', en: 'objectives completed ({n}×)' },
  'score.speed': { cs: 'rychlost', en: 'speed' },
  'score.losses': { cs: 'ztráty ({n}×)', en: 'losses ({n}×)' },
  'score.noLosses': { cs: 'bez ztrát', en: 'no losses' },
  'score.accuracy': { cs: 'přesnost raket ({n} %)', en: 'missile accuracy ({n} %)' },
  'score.difficulty': { cs: 'obtížnost ×{n}', en: 'difficulty ×{n}' },
  // after-action rozbor
  'aa.title': { cs: 'ROZBOR BITVY', en: 'AFTER ACTION REPORT' },
  'aa.ourFire': { cs: 'naše palba', en: 'our fire' },
  'aa.ourFireVal': { cs: '{l} raket · {h} zásahů ({p} %)', en: '{l} missiles · {h} hits ({p} %)' },
  'aa.ourDefense': { cs: 'naše obrana', en: 'our defense' },
  'aa.ourDefenseVal': { cs: '{k}/{l} sestřeleno ({p} %)', en: '{k}/{l} shot down ({p} %)' },
  'aa.hitsOnUs': { cs: 'zásahy do nás', en: 'hits on us' },
  'aa.balance': { cs: 'bilance', en: 'balance' },
  'aa.balanceVal': { cs: 'zničeno {k} · vlastní ztráty {o}', en: '{k} destroyed · {o} own losses' },
  'aa.decisive': { cs: 'rozhodlo', en: 'decisive factor' },
  'aa.v.winSalvos': {
    cs: 'přesné soustředěné salvy prolomily obranu',
    en: 'accurate, concentrated volleys broke the defense',
  },
  'aa.v.winScreen': {
    cs: 'vaše protiraketová clona udržela loď celou',
    en: 'your counter-missile screen kept the ship in one piece',
  },
  'aa.v.winClean': { cs: 'čisté vítězství bez ztrát', en: 'a clean victory without losses' },
  'aa.v.winFast': {
    cs: 'cíl padl dřív, než stačila rozhodnout přesila',
    en: 'the target fell before numbers could decide',
  },
  'aa.v.loseLeaks': {
    cs: 'nepřátelské salvy prošly obranou — příště hustší clona nebo klín do dráhy',
    en: 'enemy volleys got through — next time a denser screen, or roll your wedge into their path',
  },
  'aa.v.loseRange': {
    cs: 'palte z kratší vzdálenosti — na dálku obrana cíle stíhá vše',
    en: 'fire from closer in — at long range the target\'s defense handles everything',
  },
  'aa.v.loseLosses': {
    cs: 'ztráty rozhodly — chraňte lodě rolováním a bočními štíty',
    en: 'losses decided it — protect your ships by rolling and with sidewalls',
  },
  'aa.v.loseOdds': { cs: 'rozhodla přesila nepřítele', en: 'the enemy\'s superior numbers decided it' },
  'loss.fizzle': { cs: 'minula', en: 'missed' },
  // síň flotily
  'fh.title': { cs: 'SÍŇ FLOTILY', en: 'FLEET HALL' },
  'fh.intro': {
    cs: 'Vlastní lodě si mezi misemi kampaně nesou zkušenost — veteráni střílejí těsnější salvy. '
      + 'Ztráta lodi je trvalá. Nepřátel zničeno celkem: {kills}.',
    en: 'Your ships carry experience between campaign missions — veterans fire tighter volleys. '
      + 'Losing a ship is permanent. Total enemies destroyed: {kills}.',
  },
  'fh.noVets': {
    cs: 'Zatím žádní veteráni — dokonči kampaňovou misi a lodě si začnou nést zkušenost.',
    en: 'No veterans yet — finish a campaign mission and your ships will start carrying experience.',
  },
  'fh.noLosses': { cs: 'Zatím bez ztrát. Drž to tak.', en: 'No losses so far. Keep it that way.' },
  'fh.crews': { cs: 'POSÁDKY', en: 'CREWS' },
  'fh.memorial': { cs: 'PAMÁTNÍK', en: 'MEMORIAL' },
  'fh.reset': { cs: 'Vynulovat kariéru', en: 'Reset career' },
  'fh.tier.rookie': { cs: 'nováček', en: 'rookie' },
  'fh.tier.veteran': { cs: 'veterán', en: 'veteran' },
  'fh.tier.elite': { cs: 'elita', en: 'elite' },
  'fh.battle1': { cs: 'bitva', en: 'battle' },
  'fh.battle2': { cs: 'bitvy', en: 'battles' },
  'fh.battle5': { cs: 'bitev', en: 'battles' },
  // volná bitva (builder)
  'sk.title': { cs: 'VOLNÁ BITVA', en: 'SKIRMISH' },
  'sk.yours': { cs: 'TVOJE FLOTILA', en: 'YOUR FLEET' },
  'sk.enemy': { cs: 'NEPŘÍTEL', en: 'ENEMY' },
  'sk.total': { cs: 'celkem', en: 'total' },
  'sk.distance': { cs: 'Vzdálenost:', en: 'Distance:' },
  'sk.range0': { cs: 'Blízko · 1,5 M km', en: 'Close · 1.5 M km' },
  'sk.range1': { cs: 'Střed · 6 M km', en: 'Medium · 6 M km' },
  'sk.range2': { cs: 'Daleko · 18 M km', en: 'Far · 18 M km' },
  'sk.dice': { cs: 'náhodný seed', en: 'random seed' },
  'sk.fight': { cs: '⚔ BOJ', en: '⚔ FIGHT' },
  'sk.warn': { cs: 'Obě flotily potřebují aspoň jednu loď.', en: 'Both fleets need at least one ship.' },
  // hvězdná mapa (aria)
  'map.aria': { cs: 'Hvězdná mapa kampaně', en: 'Campaign star chart' },
  // hint otočení telefonu (statický overlay v index.html)
  'rotate.title': { cs: 'OTOČTE ZAŘÍZENÍ NA ŠÍŘKU', en: 'ROTATE YOUR DEVICE' },
  'rotate.detail': {
    cs: 'taktický displej potřebuje širokou obrazovku',
    en: 'the tactical display needs a wide screen',
  },
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

  // --- HUD fáze 2b: hloubková vrstva (detail cíle, salva, tooltipy, help) ---
  // detail cíle
  'tg.targetTitle': { cs: 'Detail cíle #{id}', en: 'Target detail #{id}' },
  'tg.objectTitle': { cs: 'Objekt #{id}', en: 'Object #{id}' },
  'tg.distance': { cs: 'vzdálenost:', en: 'range:' },
  'tg.radial': { cs: 'radiálně:', en: 'radial:' },
  'tg.closing': { cs: 'přibližuje se {v} km/s', en: 'closing {v} km/s' },
  'tg.receding': { cs: 'vzdaluje se {v} km/s', en: 'opening {v} km/s' },
  'tg.holding': { cs: 'drží vzdálenost', en: 'holding range' },
  'tg.dataAge': { cs: 'stáří dat:', en: 'data age:' },
  'tg.classification': { cs: 'klasifikace:', en: 'classification:' },
  'tg.q0': { cs: 'jen impelerový klín', en: 'impeller wedge only' },
  'tg.q1': { cs: 'přibližná klasifikace', en: 'approximate classification' },
  'tg.q2': { cs: 'plná identifikace', en: 'full identification' },
  'tg.solution': { cs: 'kvalita řešení:', en: 'firing solution:' },
  'tg.solutionHint': { cs: ' (+15 % — cíl vyzařuje)', en: ' (+15 % — target radiating)' },
  'tg.activateNear': {
    cs: 'zapni aktivní senzory pro plné řešení',
    en: 'switch on active sensors for a full solution',
  },
  'tg.activateFar': {
    cs: 'zapni aktivní senzory a přibliž se pro plné řešení',
    en: 'switch on active sensors and close in for a full solution',
  },
  'tg.surrendered': { cs: 'KAPITULOVAL', en: 'SURRENDERED' },
  'tg.surrenderedDetail': { cs: 'klín vypnut, loď se vzdala', en: 'wedge down, the ship has struck' },
  'tg.damageEst': { cs: 'odhad poškození:', en: 'damage estimate:' },
  'tg.critical': { cs: 'kritické', en: 'critical' },
  'tg.tonnage': { cs: 'tonáž:', en: 'tonnage:' },
  'tg.maxAccel': { cs: 'max. akcel.:', en: 'max accel.:' },
  'tg.classUnknown': {
    cs: 'třída neznámá — přibliž se / aktivní senzory',
    en: 'class unknown — close in / active sensors',
  },
  'tg.armament': { cs: 'výzbroj:', en: 'armament:' },
  'tg.armamentVal': { cs: '{t}× šachta/bok · {e}× energet.', en: '{t}× tubes/bd · {e}× energy' },
  'tg.estTubes': { cs: 'odhad funkčních šachet:', en: 'est. working tubes:' },
  'tg.ourEnv': { cs: 'naše obálka:', en: 'our envelope:' },
  'tg.hisEnv': { cs: 'jeho obálka:', en: 'their envelope:' },
  'tg.envReach': { cs: '{km} M km · dostřel {t}', en: '{km} M km · in range {t}' },
  'tg.envReachUs': { cs: '{km} M km · dostřelí nás {t}', en: '{km} M km · reaches us {t}' },
  'tg.now': { cs: 'TEĎ', en: 'NOW' },
  'tg.noMissiles': { cs: 'raketami neozbrojen', en: 'not missile-armed' },
  'tg.penEst': { cs: 'odhad průniku salvy {n}:', en: 'est. leakers, {n}-missile volley:' },
  'tg.penVal': { cs: '~{x} raket', en: '~{x} missiles' },
  'tg.penTip': {
    cs: 'Hrubý deterministický odhad vrstvené obrany cíle (CM, PDLC, ECM) pro plnou salvu '
      + 'v aktuálním režimu pohonu. Není to slib — skutečnost závisí na náhodě, manévrech, '
      + 'saturaci a obraně cíle za letu.',
    en: 'A rough deterministic estimate of the target\'s layered defense (CM, PDLC, ECM) against '
      + 'a full volley in the current drive mode. Not a promise — reality depends on chance, '
      + 'maneuvers, saturation and the target\'s in-flight defense.',
  },
  'pen.line': {
    cs: 'CM {cm} · PDLC {pdlc} · ECM {ecm} → projde {th}/{n}',
    en: 'CM {cm} · PDLC {pdlc} · ECM {ecm} → {th}/{n} leak through',
  },
  'pen.outOfRange': {
    cs: 'mimo dosah — balisticky nedoletí (projde ~0/{n})',
    en: 'out of reach — cannot coast there (~0/{n} leak through)',
  },
  'tg.armUnknown': {
    cs: 'výzbroj neznámá (ident. vyžaduje aktivní senzory zblízka)',
    en: 'armament unknown (ident needs active sensors up close)',
  },
  // výzva ke kapitulaci
  'sur.demand': { cs: 'Vyzvat ke kapitulaci', en: 'Demand surrender' },
  'sur.demandChance': { cs: 'Vyzvat ke kapitulaci (šance ~{p} %)', en: 'Demand surrender (~{p} % chance)' },
  'sur.neutralTip': {
    cs: 'Neutrální plavidlo — výzva ke kapitulaci nemá smysl.',
    en: 'Neutral vessel — a surrender demand makes no sense.',
  },
  'sur.classifyTip': {
    cs: 'Nejdřív kontakt klasifikuj (přibliž se / aktivní senzory).',
    en: 'Classify the contact first (close in / active sensors).',
  },
  'sur.cooldownTip': {
    cs: 'Neodpovídá — další výzva za {s} s. Mezitím zvyš tlak.',
    en: 'No answer — next demand in {s} s. Keep the pressure on meanwhile.',
  },
  'sur.tip': {
    cs: 'Pošle výzvu ke kapitulaci. Odpověď letí rychlostí světla tam a zpět (2×vzdálenost/c). '
      + 'Šance roste s poškozením cíle a klesá s morálkou posádky; +15 % při vyřazených zbraních.',
    en: 'Sends a surrender demand. The reply travels at lightspeed both ways (2×distance/c). '
      + 'The chance rises with target damage and falls with crew morale; +15 % with weapons knocked out.',
  },
  'sur.waiting': { cs: 'na výzvu neodpovídá — počkej {s} s', en: 'not answering — wait {s} s' },
  // panel salvy
  'sv.title': { cs: 'Salva #{id}', en: 'Salvo #{id}' },
  'sv.alive': { cs: 'živých raket:', en: 'missiles alive:' },
  'sv.avgLock': { cs: 'průměrný zámek:', en: 'average lock:' },
  'sv.phase': { cs: 'fáze:', en: 'phase:' },
  'sv.boost': { cs: 'boost {n}', en: 'boost {n}' },
  'sv.ballistic': { cs: 'balistika {n}', en: 'ballistic {n}' },
  'sv.timeToTarget': { cs: 'čas do cíle:', en: 'time to target:' },
  'sv.autonomous': {
    cs: 'autonomní salva — letí bez řídicího spoje',
    en: 'autonomous salvo — flying without a control link',
  },
  'sv.control': { cs: 'řízení:', en: 'control:' },
  'sv.inRange': { cs: 'v dosahu ({d})', en: 'in range ({d})' },
  'sv.outRange': { cs: 'mimo dosah řízení ({d})', en: 'out of control range ({d})' },
  'sv.retarget': { cs: 'Přesměrovat na {t}', en: 'Retarget to {t}' },
  'sv.selTarget': { cs: 'vybraný cíl', en: 'selected target' },
  'sv.tipPick': {
    cs: 'Nejdřív vyber cílový kontakt (klik v plotu nebo v kontaktech).',
    en: 'Select a target contact first (click the plot or the contacts panel).',
  },
  'sv.tipClassify': {
    cs: 'Nový cíl musí být klasifikovaný kontakt (přibliž se / aktivní senzory).',
    en: 'The new target must be a classified contact (close in / active sensors).',
  },
  'sv.tipSurrendered': {
    cs: 'Cíl kapituloval — nestřílíme na něj.',
    en: 'The target has surrendered — we do not fire on it.',
  },
  'sv.tipRange': {
    cs: 'Salva je mimo dosah řízení (10 M km) — povel k ní nedoletí.',
    en: 'The salvo is beyond control range (10 M km) — the order cannot reach it.',
  },
  'sv.tipGo': {
    cs: 'Přesměruje všechny letící rakety salvy (boost/balistika) na vybraný cíl. Penalizace zámku ×0,75.',
    en: 'Retargets every flying missile of the salvo (boost/ballistic) to the selected target. Lock penalty ×0.75.',
  },
  // detail třídy lodi
  'cls.class': { cs: 'třída:', en: 'class:' },
  'cls.tonnage': { cs: 'tonáž', en: 'tonnage' },
  'cls.maxAccel': { cs: 'max. akcelerace', en: 'max acceleration' },
  'cls.tubes': { cs: 'šachty / bok', en: 'tubes / broadside' },
  'cls.cmL': { cs: 'CM odpalovače', en: 'CM launchers' },
  'cls.pdlc': { cs: 'PDLC clustery', en: 'PDLC clusters' },
  'cls.energy': { cs: 'energetika / bok', en: 'energy / broadside' },
  'cls.mags': { cs: 'zásobníky', en: 'magazines' },
  'cls.magsVal': { cs: '{m} raket · {c} CM', en: '{m} missiles · {c} CM' },
  'cls.wedgeDet': { cs: 'detekce klínu', en: 'wedge detection' },
  'cls.activeSens': { cs: 'aktivní senzory', en: 'active sensors' },
  'cls.ecm': { cs: 'ECM', en: 'ECM' },
  'cls.sidewalls': { cs: 'boční štíty', en: 'sidewalls' },
  // roster flotily
  'fr.takeTip': {
    cs: 'převzít loď (klávesa {n}); Shift-klik = přidat/odebrat z výběru',
    en: 'take command (key {n}); Shift-click = add/remove from selection',
  },
  'fr.aiTip': { cs: 'AI spojenec — nelze převzít', en: 'AI ally — cannot take command' },
  'fr.podsTip': {
    cs: 'tažené raketové plošiny ({n}×6 raket — alfa úder)',
    en: 'towed missile pods ({n}×6 missiles — alpha strike)',
  },
  'fr.reloadTip': { cs: 'šachty přebíjejí', en: 'tubes reloading' },
  'fr.readyTip': { cs: 'šachty připraveny k salvě', en: 'tubes ready to fire' },
  'fr.footer': {
    cs: 'klávesy 1–9 přepínají aktivní loď · Shift-klik přidá/odebere loď z hromadného výběru',
    en: 'keys 1–9 switch the active ship · Shift-click adds/removes a ship from the selection',
  },
  // vlastní loď — tooltipy
  'os.fixingTip': {
    cs: 'polní oprava běží (~7 %/min do 70 %, pak dolaďování do 90 %)',
    en: 'field repair under way (~7 %/min up to 70 %, then fine-tuning to 90 %)',
  },
  'os.repairTip': {
    cs: 'Polní opravy: plné tempo do 70 %, doladění do 90 % (víc dá jen dok). Priorita soustředí '
      + 'čety: skupina ×3, ostatní ×0,5. Trup se v poli opravit nedá — strukturální poškození '
      + 'spraví jen loděnice.',
    en: 'Field repairs: full pace up to 70 %, fine-tuning to 90 % (only a dock gives more). Priority '
      + 'concentrates the crews: focus group ×3, the rest ×0.5. The hull cannot be repaired in the '
      + 'field — structural damage takes a shipyard.',
  },
  'os.repBalTip': { cs: 'Rovnoměrné opravy všech subsystémů (výchozí).', en: 'Even repairs across all subsystems (default).' },
  'os.repWeapTip': {
    cs: 'Priorita: raketové šachty a energetické baterie ×3, ostatní ×0,5.',
    en: 'Priority: missile tubes and energy batteries ×3, the rest ×0.5.',
  },
  'os.repDriveTip': {
    cs: 'Priorita: impelerové prstence ×3 (akcelerace!), ostatní ×0,5.',
    en: 'Priority: impeller rings ×3 (acceleration!), the rest ×0.5.',
  },
  'os.repDefTip': {
    cs: 'Priorita: boční štíty, PDLC a protirakety ×3, ostatní ×0,5.',
    en: 'Priority: sidewalls, PDLC and counter-missiles ×3, the rest ×0.5.',
  },
  'os.reactorTip': {
    cs: 'Reaktor neutáhne pohon i štítové generátory: tah ≤ 40 % ⇒ boční štíty 120 %, 60 % ⇒ 100 %, '
      + '80 % ⇒ 60 %, 100 % ⇒ 40 %, 120 % ⇒ 25 %.',
    en: 'The reactor cannot feed both the drive and the shield generators: throttle ≤ 40 % ⇒ sidewalls '
      + '120 %, 60 % ⇒ 100 %, 80 % ⇒ 60 %, 100 % ⇒ 40 %, 120 % ⇒ 25 %.',
  },
  'os.podsTip': {
    cs: 'tažené raketové plošiny: {n} ks × 6 raket — odpal VŠECH najednou (alfa úder), jednorázové',
    en: 'towed missile pods: {n} × 6 missiles — launch ALL at once (alpha strike), single-use',
  },
  // topbar — tooltipy
  'tb.gfxTip': {
    cs: 'Vzhled plotu: objemové (3D shora, Homeworld) ⟷ klasické vektorové siluety',
    en: 'Plot style: volumetric (3D top-down, Homeworld) ⟷ classic vector silhouettes',
  },
  'tb.crtTip': { cs: 'CRT vzhled: scanlines + vinětace (jen kosmetika)', en: 'CRT look: scanlines + vignette (cosmetic only)' },
  'tb.infoTip': {
    cs: 'režim nápovědy (dotyk): klepnutí na prvek ukáže jeho vysvětlení místo akce',
    en: 'help mode (touch): tapping an element shows its explanation instead of acting',
  },
  'tb.mobileTip': {
    cs: 'mobilní UI: kompaktní rozvržení pro telefon (jinak se zapne samo na malém dotykovém displeji)',
    en: 'mobile UI: compact phone layout (otherwise enabled automatically on a small touch screen)',
  },
  'tb.muteTip': { cs: 'ztlumit / zapnout zvuk', en: 'mute / unmute' },
  'tb.musicTip': { cs: 'hlasitost hudby', en: 'music volume' },
  'tb.fxTip': { cs: 'hlasitost efektů', en: 'effects volume' },
  'tb.autoSlowTip': {
    cs: 'Auto-zpomalování: u důležitých událostí (zásah do naší lodi, nový kontakt, komunikace, '
      + 'cíle mise) spadne komprese na 1×. Vypnuto: událost jen blikne v liště.',
    en: 'Auto-slowdown: on important events (a hit on our ship, a new contact, comms, mission '
      + 'objectives) compression drops to 1×. Off: the event just flashes in the bar.',
  },
  'tb.helpTip': { cs: 'nápověda (H)', en: 'help (H)' },
  // toasty / log
  'toast.hit': { cs: 'ZÁSAH', en: 'HIT' },
  'toast.close': { cs: 'zavřít zprávu', en: 'dismiss message' },
  'log.salvoDone': { cs: 'salva dostřílena — {h}/{l} zásahů', en: 'salvo complete — {h}/{l} hits' },
  // lišta rozkazů — tooltipy
  'tip.intercept': {
    cs: 'Autopilot spočítá a drží stíhací kurz na vybraný cíl. Intercepty na miliony km trvají desítky minut.',
    en: 'The autopilot computes and holds an intercept course on the selected target. Intercepts over millions of km take tens of minutes.',
  },
  'tip.course': {
    cs: 'Klikni do plotu — autopilot poletí na zvolený bod. SHIFT-klik přidává další waypointy trasy '
      + '(režim zůstává aktivní); obyčejný klik zadá poslední bod. Predikovaná křivka ukáže, jak se '
      + 'loď pokusí body proletět i se setrvačností.',
    en: 'Click the plot — the autopilot flies to the chosen point. SHIFT-click adds more route '
      + 'waypoints (the mode stays active); a plain click sets the final point. The predicted curve '
      + 'shows how the ship will try to fly through the points, inertia included.',
  },
  'tip.salvo': {
    cs: 'Odpálí {n} raket na vybraný cíl; přebíjení šachet {cd} s. Pohon volí řízení palby SAMO: '
      + 'zblízka (do ~{hi} M km) rychlé HI, na dálku LO (dostřel ~{lo} M km). Pamatuj: čím blíž '
      + 'odpálíš, tím míň času má obrana cíle — pod ~1,5 M km je salva vražedná.',
    en: 'Launches {n} missiles at the selected target; tube reload {cd} s. Fire control picks the '
      + 'drive ITSELF: up close (under ~{hi} M km) fast HI, at range LO (reach ~{lo} M km). Remember: '
      + 'the closer you launch, the less time the target\'s defense gets — under ~1.5 M km a volley is murderous.',
  },
  'tip.salvoAll': { cs: 'všechny ({n})', en: 'all ({n})' },
  'tip.pods': {
    cs: 'Odhodí VŠECHNY tažené raketové plošiny najednou — 6 raket na plošinu v jediné vlně mimo '
      + 'šachty i zásobníky (nepodléhá přebíjení). Drtivá první salva, která saturuje obranu cíle. '
      + 'Jednorázové — nové plošiny až v doku.',
    en: 'Drops ALL towed missile pods at once — 6 missiles per pod in a single wave outside the tubes '
      + 'and magazines (no reload). A crushing first strike that saturates the target\'s defense. '
      + 'Single-use — new pods only in dock.',
  },
  'tip.layered': {
    cs: 'Vrstvená salva: {lo}× LO hned + {hi}× HI se zpožděním tak, aby obě vlny dorazily spolu '
      + 'a saturovaly bodovou obranu (víc raket v okně = nižší Pk obrany).',
    en: 'Layered volley: {lo}× LO now + {hi}× HI delayed so both waves arrive together and saturate '
      + 'point defense (more missiles in the window = lower defensive Pk).',
  },
  'tip.autoFire': {
    cs: 'AUTO palba: loď sama opakuje plné salvy, dokud je cíl v poháněné obálce, a řídí '
      + 'i energetické baterie (cíl či nejbližší nepřítel do 500 tis. km). A',
    en: 'AUTO fire: the ship repeats full volleys on its own while the target stays inside the powered '
      + 'envelope, and also runs the energy batteries (the target or the nearest enemy within 500k km). A',
  },
  'tip.autonomous': {
    cs: 'Režim dalších odpalů. ŘÍZENÁ salva: plný zámek dle palebného řešení, loď ji vede (drží '
      + 'zámek, lze ji přesměrovat) — ale eroduje při ztrátě kontaktu na cíl nebo za dosahem řízení '
      + '10 M km. AUTONOMNÍ: zámek ×0,85, ale letí sama — ideální „vystřel a zhasni" s vypnutým klínem.',
    en: 'Mode for future launches. GUIDED volley: full lock per the firing solution, the ship guides '
      + 'it (holds lock, can be retargeted) — but it erodes when contact on the target is lost or '
      + 'beyond the 10 M km control range. AUTONOMOUS: lock ×0.85, but it flies on its own — ideal '
      + '"fire and forget" with the wedge down.',
  },
  'tip.energy': {
    cs: 'Lasery/grasery: plné poškození pod {full} tis. km, dosah {max} tis. km, nabíjení {cd} s.',
    en: 'Lasers/grasers: full damage under {full}k km, reach {max}k km, recharge {cd} s.',
  },
  'tip.jammer': {
    cs: '+rušička: salva obětuje 1 raketu jako eskortní rušičku — zbytek salvy má proti bodové '
      + 'obraně cíle Pk ×0,75. Vyžaduje salvu aspoň 3 raket.',
    en: '+jammer: the volley sacrifices 1 missile as an escort jammer — the rest of the volley takes '
      + 'Pk ×0.75 against the target\'s point defense. Needs a volley of at least 3 missiles.',
  },
  'tip.decoy': {
    cs: 'Vypustí taženou návnadu: příchozí raketa na ni může přeskočit (šance dle kvality ECM lodi, '
      + 'víc při slabém zámku raket). Svedená raketa návnadu ZNIČÍ — jedna návnada ≈ jedna pohlcená '
      + 'raketa; další lze vypustit hned. Omezená zásoba.',
    en: 'Deploys a towed decoy: an incoming missile may jump to it (chance per the ship\'s ECM quality, '
      + 'higher against weak missile locks). A seduced missile DESTROYS the decoy — one decoy ≈ one '
      + 'absorbed missile; the next can be deployed immediately. Limited stock.',
  },
  'tip.double': {
    cs: 'Plná salva z obou boků s otočkou: levobok LO hned, otočka {roll} s, pravobok HI časovaný '
      + 'na společný dopad — dvojnásobná vlna saturuje obranu. Loď se během otočky nemůže bránit palbou.',
    en: 'Full volley from both broadsides with a roll: port LO now, roll {roll} s, starboard HI timed '
      + 'for simultaneous impact — a doubled wave saturates the defense. The ship cannot defend with '
      + 'fire during the roll.',
  },
  'tip.wedge': {
    cs: 'Vypnutý klín = EMCON: loď je téměř neviditelná (jen aktivní senzory zblízka), bez bočních '
      + 'štítů; k dispozici jen manévrovací trysky ~5 g na korekce driftu.',
    en: 'Wedge down = EMCON: the ship is nearly invisible (only close-range active sensors see her), '
      + 'no sidewalls; only ~5 g maneuvering thrusters remain for drift corrections.',
  },
  'tip.sensors': {
    cs: 'Plná identifikace cílů do {r} mil. km + lepší zámek našich raket (plné palebné řešení 100 % '
      + 'místo 70 %); pozor — vyzařování zlepšuje řešení nepříteli o 15 %. Pasivní detekce cizího '
      + 'klínu funguje vždy.',
    en: 'Full target identification within {r} M km + better lock for our missiles (full 100 % firing '
      + 'solution instead of 70 %); careful — radiating improves the enemy\'s solution by 15 %. '
      + 'Passive wedge detection always works.',
  },
  'tip.throttle': {
    cs: 'Výkon pohonu (kompenzátoru): 80 % je standard, 100 % plný výkon, 120 % = NOUZOVÝ výkon '
      + '„za červenou čarou" (riziko poškození prstence ~1× za 33 min). POZOR — reaktor neutáhne '
      + 'pohon i boční štíty: tah ≤ 40 % ⇒ boční štíty 120 %, 60 % ⇒ 100 %, 80 % ⇒ 60 %, 100 % ⇒ 40 %, '
      + '120 % ⇒ 25 %. Rychlý přílet = papírové boky. Platí pro celý výběr.',
    en: 'Drive (compensator) power: 80 % is standard, 100 % full power, 120 % = EMERGENCY power '
      + '"past the red line" (ring damage risk ~once per 33 min). CAREFUL — the reactor cannot feed '
      + 'both drive and sidewalls: throttle ≤ 40 % ⇒ sidewalls 120 %, 60 % ⇒ 100 %, 80 % ⇒ 60 %, '
      + '100 % ⇒ 40 %, 120 % ⇒ 25 %. A fast approach = paper flanks. Applies to the whole selection.',
  },
  'tip.formation': {
    cs: 'Formace eskadry (aktivní při výběru ≥ 2 ovladatelných lodí; aktivní loď = leader, ostatní '
      + 'dostanou sloty a drží je automaticky — vlastní kurz ignorují). STĚNA: kolmá řada, rozestup '
      + '400 tis. km — disciplinovaná palebná síť: Pk protiraket ×1,15, příchozí rakety −5 % zámku. '
      + 'ŠÍP: sdílený senzorový obraz — +5 % palebného řešení členů. ROZPTYL: rozestupy 1,5 M km — '
      + 'útočník nesaturuje eskadru jako celek, členové +3 % efektivního ECM. „—" formaci zruší. '
      + 'Rozpad při ztrátě leadera.',
    en: 'Squadron formation (active with ≥ 2 controllable ships selected; the active ship is the '
      + 'leader, the rest get slots and hold them automatically — ignoring their own course). WALL: '
      + 'a perpendicular line, 400k km spacing — a disciplined fire net: counter-missile Pk ×1.15, '
      + 'incoming missiles −5 % lock. VEE: shared sensor picture — members +5 % firing solution. '
      + 'DISPERSED: 1.5 M km spacing — an attacker cannot saturate the squadron as a whole, members '
      + '+3 % effective ECM. "—" cancels the formation. It breaks if the leader is lost.',
  },
  'tip.selectMode': {
    cs: 'Režim hromadného výběru (na dotyku nahrazuje Shift): tap přidá/odebere loď z výběru, tažení '
      + 'po plotu = obdélníkový výběr. Vypni pro běžný pan a výběr cílů.',
    en: 'Multi-select mode (replaces Shift on touch): tap adds/removes a ship from the selection, '
      + 'dragging on the plot = rectangle select. Turn off for normal panning and target picking.',
  },
  'tip.squadHdr': {
    cs: 'Velení eskadry: doktríny palby pro celý výběr — cíle si lodě volí samy (deterministicky), '
      + 'i při kompresi času.',
    en: 'Squadron command: fire doctrines for the whole selection — ships pick their own targets '
      + '(deterministically), even under time compression.',
  },
  'tip.fleetNearest': {
    cs: 'Doktrína NEJBLIŽŠÍ: každá vybraná loď si sama drží palbu na svůj nejbližší nepřátelský '
      + 'kontakt a po jeho zničení plynule přejde na další. Rozptýlená sebeobrana — ideální proti '
      + 'dotírající zástěně.',
    en: 'NEAREST doctrine: each selected ship keeps firing at its own nearest enemy contact and rolls '
      + 'smoothly to the next once it is destroyed. Dispersed self-defense — ideal against a pressing screen.',
  },
  'tip.fleetBiggest': {
    cs: 'Doktrína NEJVĚTŠÍ: každá vybraná loď pálí na nejtěžší známý trup — celá eskadra se tak sama '
      + 'koncentruje (saturace obrany!) a po zničení roluje na další nejtěžší. Doktrína stěny proti stěně.',
    en: 'BIGGEST doctrine: each selected ship fires at the heaviest known hull — the whole squadron '
      + 'concentrates by itself (defense saturation!) and rolls to the next heaviest after a kill. '
      + 'The wall-against-wall doctrine.',
  },
  'tip.fleetSpread': {
    cs: 'Doktrína ROZDĚLIT: vybrané lodě si cíle rozdělí (každá jiný) — proti hejnu slabších lodí, '
      + 'kde koncentrace plýtvá salvami.',
    en: 'SPREAD doctrine: the selected ships divide the targets (one each) — against a swarm of weaker '
      + 'ships where concentration wastes volleys.',
  },
  'tip.fleetFocus': {
    cs: 'SOUSTŘEDIT: všechny vybrané lodě AUTO palbou na TEBOU vybraný cíl (klikni na kontakt). '
      + 'Jednorázové přiřazení — po zničení cíle se lodě zastaví.',
    en: 'FOCUS: all selected ships AUTO-fire at the target YOU picked (click a contact). A one-off '
      + 'assignment — the ships stop once the target is destroyed.',
  },
  'tip.fleetHold': {
    cs: 'DRŽET PALBU: všechny vybrané lodě přestanou střílet (doktríny i AUTO vypnuty).',
    en: 'HOLD FIRE: all selected ships stop shooting (doctrines and AUTO off).',
  },
  'tip.fleetSalvo': {
    cs: 'SALVA VÝBĚRU: každá vybraná loď s nabitými šachtami TEĎ odpálí plnou salvu na tebou vybraný '
      + 'cíl — koordinovaný úder bez přepínání lodí. Připravenost šachet vidíš v rosteru FLOTILA (✓/⌛).',
    en: 'SELECTION VOLLEY: every selected ship with loaded tubes launches a full volley NOW at the '
      + 'target you picked — a coordinated strike without switching ships. Tube readiness shows in the '
      + 'FLEET roster (✓/⌛).',
  },
  'tip.fleetAlpha': {
    cs: 'SROVNAT TUBY (sesazená alfa-salva): vybrané lodě naplánují plnou salvu na SPOLEČNÝ dopad — '
      + 'bližší lodě odpal zpozdí, aby všechny salvy dorazily naráz a ZAHLTILY obranu cíle. Klasický '
      + 'Honorverse úder časovaný na cíl (time-on-target). Vyžaduje vybraný cíl a nabité šachty; '
      + 'vyprázdní zásobníky.',
    en: 'TIME-ON-TARGET (staggered alpha strike): the selected ships plan a full volley for a '
      + 'SIMULTANEOUS impact — closer ships delay their launch so every volley arrives at once and '
      + 'FLOODS the target\'s defense. The classic Honorverse time-on-target strike. Needs a selected '
      + 'target and loaded tubes; empties the magazines.',
  },
  'tip.fleetPods': {
    cs: 'PLOŠINY ⇒ CÍLE: každá vybraná loď odpálí VŠECHNY tažené plošiny (6 raket na plošinu) — ale '
      + 'na VLASTNÍ cíl, rozdělené mezi nejbližší klasifikované nepřátele. Zabrání plýtvání, kdy 6×N '
      + 'raket spadne na jednu loď. Vyžaduje živé kontakty; plošiny jsou jednorázové.',
    en: 'PODS ⇒ TARGETS: every selected ship launches ALL towed pods (6 missiles per pod) — but at its '
      + 'OWN target, divided among the nearest classified enemies. Prevents the waste of 6×N missiles '
      + 'landing on one ship. Needs live contacts; pods are single-use.',
  },
  'ord.cdReload': { cs: 'přebíjení šachet — zbývá {s} s', en: 'tube reload — {s} s left' },
  'ord.cdReady': { cs: 'přebíjení šachet — připraveno', en: 'tube reload — ready' },
  'ord.footer': {
    cs: 'mezerník pauza · +/− komprese · A auto · H nápověda',
    en: 'space pause · +/− compression · A auto · H help',
  },
  // plot
  'plot.rolled': { cs: '⟳ roluje – klín k nám', en: '⟳ rolling – wedge at us' },
  'plot.preparing': { cs: '⚠ chystá salvu', en: '⚠ preparing a salvo' },
  'plot.fleeing': { cs: '⇗ prchá', en: '⇗ running' },
  'plot.radiating': { cs: '◎ vysílá', en: '◎ radiating' },
  'plot.scale': { cs: 'dílek = {a}   měřítko {b}/px', en: 'grid = {a}   scale {b}/px' },
  'plot.charted': { cs: 'zakresleno', en: 'charted' },
  'plot.memory': { cs: 'paměť {s} s', en: 'memory {s} s' },
}

/** překlad podle aktuálního jazyka (fallback čeština, pak samotný klíč) */
export function t(key: string): string {
  const e = DICT[key]
  if (!e) return key
  return e[current] ?? e.cs
}

/** překlad s dosazením {jmenných} zástupných hodnot: tf('sv.title', { id: 7 }) */
export function tf(key: string, vars: Record<string, string | number>): string {
  return t(key).replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m)
}

/** locale pro čísla dle jazyka (mezery vs. čárky v tisících) */
export function numLocale(): string {
  return current === 'cs' ? 'cs-CZ' : 'en-US'
}

/** celé číslo s oddělovači tisíců dle jazyka */
export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString(numLocale())
}

/** desetinné číslo s právoplatným oddělovačem (čárka v cs, tečka v en) */
export function fmtDec(x: number, digits = 1): string {
  const s = x.toFixed(digits)
  return current === 'cs' ? s.replace('.', ',') : s
}

/** interní export slovníku pro testy úplnosti překladů */
export const I18N_DICT = DICT
