/**
 * EN mutace textů misí, které nemají voId: zprávy triggerů (kind: 'message')
 * a popisky lodí/objektů (desc). Klíč je PŘESNÝ český text ze scénáře —
 * česká data zůstávají kanonická (viz briefings.ts), UI při angličtině
 * nahrazuje přes lookup; bez zásahu do simu.
 */
export const MISSION_TEXT_EN: Record<string, string> = {
  // ---------- zprávy triggerů ----------
  'Cygnus zrychluje k hyperlimitu! Vojenský kompenzátor!':
    'Cygnus is accelerating for the hyper limit! Military-grade compensator!',
  'Další dva impelerové kontakty! Byla to návnada!':
    'Two more impeller contacts! It was bait!',
  'Doslovné znění rozkazu, nebo jeho duch? Základna stojí a příměří platí až za hodinu.':
    'The letter of the order, or its spirit? The base still stands — and the ceasefire takes effect in an hour.',
  'Druhá vlna! Tři kontakty ze dvou vektorů — šetři protirakety, tohle není konec.':
    'Second wave! Three contacts from two vectors — save your counter-missiles, this is not over.',
  'Druhý sbor vystupuje z hyperu na opačné straně soustavy!':
    'A second corps is translating out of hyper on the far side of the system!',
  'Dva impelerové kontakty vpředu — vysílají avalonské identifikační kódy a zvou tě k sobě.':
    'Two impeller contacts ahead — squawking Avalon identification codes and inviting you in.',
  'Dva impelerové kontakty za hyperlimitem — první vlna najíždí na stanici!':
    'Two impeller contacts past the hyper limit — the first wave is running in on the station!',
  'Imperiální hlídka kapitulovala.':
    'The Imperial picket has surrendered.',
  'Imperiální loď kapitulovala — invaze o jeden klín slabší.':
    'Imperial ship has surrendered — the invasion is one wedge weaker.',
  'Imperiální loď kapitulovala — stěna se drolí.':
    'Imperial ship has surrendered — the wall is crumbling.',
  'Imperiální stěna mění vektor — jdou po nás. Formace drží.':
    'The Imperial wall is changing vector — they are coming for us. The formation holds.',
  'Kontejnery odhozeny — raketová lůžka! Je to imperiální pomocný křižník!':
    'Containers jettisoned — missile cradles! She is an Imperial auxiliary cruiser!',
  'Kontrola Brány: dobrá práce.':
    'Gate Control: good work.',
  'Křižovatka aktivuje obranné pody!':
    'The Junction is activating its defense pods!',
  'Léčka! „Záchranná eskadra" shazuje falešné transpondéry — jsou to imperiální křižníky!':
    'Ambush! The "rescue squadron" is dropping false transponders — they are Imperial cruisers!',
  'Nouzový signál kurýra Hermes! Loď driftuje bez pohonu hluboko v soustavě.':
    'Distress signal from the courier Hermes! She is adrift without drive, deep in the system.',
  'Nájezdník kapituloval — hrozba pro konvoj zažehnána.':
    'The raider has surrendered — the threat to the convoy is over.',
  'Nájezdník kapituloval — o jednu hrozbu pro stanici méně.':
    'The raider has surrendered — one less threat to the station.',
  'Nájezdník kapituloval.':
    'The raider has surrendered.',
  'Oba nájezdníci vyřazeni — kurýr je z nejhoršího venku.':
    'Both raiders are out of action — the courier is past the worst of it.',
  'Pasivní senzory: emisní profil hlídky zaznamenán.':
    'Passive sensors: picket emission profile recorded.',
  'Pole podů! Salva 32 raket!':
    'Pod field! Thirty-two missile salvo!',
  'Poslední vlna — křižník a dva torpédoborce. Mezi nimi letí čtvrtý kontakt se slabším klínem.':
    'Last wave — a cruiser and two destroyers. A fourth contact with a weaker wedge is flying among them.',
  'Posádka Hermes je na palubě. Teď už jen zmizet ze soustavy.':
    'The Hermes crew is aboard. Now just get out of the system.',
  'Prozrazen! Hlídky zapínají impelery!':
    'Made! The pickets are lighting up their impellers!',
  'Stráž skladu kapitulovala.':
    'The depot guard has surrendered.',
  'Stráže vyřazeny — depot je bez krytí.':
    'Guards down — the depot is uncovered.',
  'Taktický: „Odpaly! Mnohonásobné odpaly — to nejsou šachty křižníku, ti parchanti tahali PODY!"':
    'Tactical: "Launches! Multiple launches — those are not cruiser tubes, the bastards were towing PODS!"',
  'Translace potvrzena — první sled invaze přistál na hyperlimitu a najíždí na Křižovatku! V čele dreadnought!':
    'Translation confirmed — the first invasion echelon has hit the hyper limit and is running in on the Junction! A dreadnought in the van!',
  'Volba je na tobě: rozbít vlastní plán a krýt ho, nebo ho nechat jeho pomstě.':
    'The choice is yours: break your own plan and cover him, or leave him to his revenge.',
  'Všechna čtyři Toleda zničena — jádro imperiální stěny je pryč!':
    'All four Toledos destroyed — the core of the Imperial wall is gone!',
  'Základna Almadén zakreslena do mapy — poslední známá poloha zůstane, i když se senzory odvrátí.':
    'Almadén base charted — the last known position stays on the plot even when the sensors look away.',
  'Základna Cádiz vypíná zbraňové systémy a kapituluje.':
    'Cádiz base is powering down her weapons and surrendering.',
  'Zástěna základny mění vektor — jdou po nás. Průlom začíná.':
    'The base screen is changing vector — they are coming for us. The breakthrough begins.',

  // ---------- mise 0 (akademie) ----------
  'Instruktorka Sarnow: „Vítej na okruhu, kadete. Bez nervů — dnes po tobě nikdo nestřílí. Nejdřív letecké základy: doleť k bóji Alfa. Displej tě povede."':
    'Instructor Sarnow: "Welcome to the circuit, cadet. Relax — nobody shoots back today. Flight basics first: fly to buoy Alfa. The display will guide you."',
  'Instruktorka Sarnow: „Čistý průlet, kadete. Teď ostrá část: na okruhu stojí cvičný kýl Beta. Zapni aktivní senzory, klasifikuj ho a pošli mu první ostrou salvu tvé kariéry."':
    'Instructor Sarnow: "Clean pass, cadet. Now the live part: training hulk Beta sits on the circuit. Light up your active sensors, classify her and send her the first live salvo of your career."',
  'Taktický: „Cíl klasifikován — vyřazený trup, žádná obrana. Palebné řešení připraveno, kapitáne. Až řekneš."':
    'Tactical: "Target classified — decommissioned hull, no defenses. Firing solution ready, captain. On your word."',
  'První salva, první zásah. Akademie tě pouští do služby — celní hlídka u Křižovatky čeká.':
    'First salvo, first hit. The academy clears you for duty — the customs picket at the Watchgate is waiting.',
  'Navigační bóje cvičného okruhu akademie. Generace kadetů ji míjely na první hlídce — a pár jich do ní i narazilo.':
    'Nav buoy of the academy training circuit. Generations of cadets passed her on their first watch — and a few ran into her.',
  'Vyřazený nákladní trup odtažený na okruh jako terč. Pohon mrtvý, zbraně žádné — jeho jediná práce je stát v cestě salvám kadetů.':
    'A decommissioned freighter hull towed onto the circuit as a target. Drive dead, no weapons — her only job is to stand in the way of cadet salvos.',
  'Avalon Prime — trůnní svět Království. Z orbity vypadá mírově; právě proto existuje flotila.':
    'Avalon Prime — throne world of the Kingdom. From orbit it looks peaceful; that is exactly why the fleet exists.',

  // ---------- přidané cíle (addObjective — pro řádek „New objective: …") ----------
  'Znič pomocný křižník': 'Destroy the auxiliary cruiser',
  '(Volitelné) Zachraň posádku Hermes — přibliž se na 500 tis. km':
    '(Optional) Rescue the Hermes crew — close to 500k km',
  '(Skrytý) Nezabij civilisty na palubě Meridianu':
    '(Hidden) Do not kill the civilians aboard Meridian',
  '(Volitelné) KNS Claymore přežije': '(Optional) KNS Claymore survives',
  'Volba: stáhni se za hyperlimit — nebo dokonči útok':
    'Choice: withdraw past the hyper limit — or finish the attack',
  '(Volitelné) Znič zásobovací základnu Almadén':
    '(Optional) Destroy the Almadén supply base',

  // ---------- popisky lodí a objektů (desc) ----------
  'Avalon Prime — trůnní svět Hvězdného království. Parlament, admiralita a královna Eleanor III.; miliarda lidí, kteří právě sledují oblohu.':
    'Avalon Prime — throne world of the Star Kingdom. Parliament, the Admiralty and Queen Eleanor III; a billion people who are watching the sky right now.',
  'Avalon Prime — trůnní svět Království. V simulaci admirality představuje to, co stěna brání: důvod, proč se tahle bitva cvičí.':
    'Avalon Prime — throne world of the Kingdom. In the Admiralty simulation it stands for what the wall defends: the reason this battle is drilled.',
  'Gwynedd — zemědělský svět Království na vnitřní orbitě Křižovatky. Tři sta milionů lidí, sýpka sektoru; mýto vybírané nad jejich hlavami platí jejich školy i orbitální výtah.':
    'Gwynedd — the Kingdom\'s agricultural world on the Junction\'s inner orbit. Three hundred million people, the sector\'s granary; the toll collected above their heads pays for their schools and their orbital elevator.',
  'Kurýrní loď v tísni. Bez klínu na obranu, jen rychlost. Doveď ji ke skokové bóji.':
    'A courier ship in distress. No wedge to defend her, only speed. Get her to the jump buoy.',
  'Meteorologická sonda Kontroly Brány: měří sluneční vítr a mikrometeority na tranzitních koridorech. Majetek správy terminálu — nesestřelovat, papírování je nekonečné.':
    'A Gate Control weather probe: it measures solar wind and micrometeorites on the transit corridors. Terminal authority property — do not shoot it down, the paperwork is endless.',
  'Navigační bod na hyperlimitu soustavy Cádiz. Za touto čarou může Aurora skočit do hyperprostoru — jediná cesta domů se záznamy.':
    'A navigation point on the Cádiz hyper limit. Past this line Aurora can jump into hyperspace — the only way home with the records.',
  'Navigační bóje na hyperlimitu soustavy — hranici, za kterou gravitační studna hvězdy dovolí přechod do hyperprostoru. Kdo ji protne, je pryč.':
    'A navigation buoy on the system\'s hyper limit — the line beyond which the star\'s gravity well permits translation into hyperspace. Whoever crosses it is gone.',
  'Navigační bóje na hyperlimitu — pro Resolute čára života: za ní se dá skočit domů i s tím, co zbylo z eskadry… a se záznamy z Tharsis.':
    'A navigation buoy on the hyper limit — Resolute\'s lifeline: beyond it she can jump home with what is left of the squadron… and the Tharsis records.',
  'Navigační bóje zásobovací trasy — bod předání konvoje eskortě pohraniční stanice. Doveď sem obchodníky a služba je splněna.':
    'A supply-route navigation buoy — the convoy hand-off point to the border station\'s escort. Bring the merchantmen here and the duty is done.',
  'Nákladní loď na lince Křižovatky — civilní provoz s platným tranzitem a manifestem, který výjimečně sedí.':
    'A freighter on the Junction run — civilian traffic with a valid transit and, for once, a manifest that checks out.',
  'Nákladní loď na lince Křižovatky — pravidelná linka do Pomezí, náklad: náhradní díly a spotřební zboží.':
    'A freighter on the Junction run — the regular Marches line, cargo: spare parts and consumer goods.',
  'Orbitální stanice Zeta — pohraniční uzel Království: překladiště, doky a domov dvou tisíc civilistů. Padne-li Zeta, padne s ní zásobování celého sektoru.':
    'Orbital Station Zeta — the Kingdom\'s border hub: transshipment, docks and home to two thousand civilians. If Zeta falls, the whole sector\'s supply line falls with her.',
  'Předsunuté kotviště Velké armády — rozestavěné doky a zásobníky, ze kterých měl vyplout úder na Křižovatku. Zlatá flotila, která je měla dostavět, nedorazila.':
    'The Grand Army\'s forward anchorage — half-built docks and magazines from which the strike at the Junction was meant to sail. The gold fleet that was to finish them never arrived.',
  'Skoková bóje na okraji Pomezí — bezpečný výstup pro kurýra.':
    'A jump buoy on the edge of the Marches — a safe exit for the courier.',
  'Skrytý pirátský přístav — sklad zásob a munice. Rozbij ho.':
    'A hidden pirate haven — a depot of supplies and munitions. Break it.',
  'Stanice Křižovatka — mýtná brána nad svazkem červích děr a srdce bohatství Království. Přesně to, pro co si Velká armáda přiletěla.':
    'Junction Station — the toll gate above the wormhole cluster and the heart of the Kingdom\'s wealth. Exactly what the Grand Army came for.',
  'Stanice Sázava — pohraniční překladiště Království: doky, celnice a pár set dokařů. Poslední civilizovaná zastávka před Pomezím.':
    'Station Sázava — the Kingdom\'s border transshipment point: docks, customs and a few hundred dockers. The last civilized stop before the Marches.',
  'Zeta IV — hraniční kolonie Království. Pár milionů osadníků, doly a atmosférické procesory; orbitální stanice nad hlavou je jejich jediná spojnice se světem.':
    'Zeta IV — a frontier colony of the Kingdom. A few million settlers, mines and atmosphere processors; the orbital station overhead is their only link to the world.',
  'Zásobovací základna Almadén — simulovaný týlový uzel imperiální stěny: munice, izotopy, opravárenské doky. Volitelný bonusový cíl cvičení.':
    'Almadén supply base — the simulated rear node of the Imperial wall: munitions, isotopes, repair docks. An optional bonus objective of the exercise.',
  'Ústupová bóje na hyperlimitu Cádizu. Kdyby se všechno pokazilo, tudy vede cesta domů.':
    'A withdrawal buoy on the Cádiz hyper limit. If everything goes wrong, this is the way home.',
  'Ústupový bod na hyperlimitu. Kaperská doktrína má tři kroky: udeřit, rozbít, zmizet — tohle je ten třetí.':
    'A withdrawal point on the hyper limit. Privateer doctrine has three steps: strike, break, vanish — this is the third.',
}
