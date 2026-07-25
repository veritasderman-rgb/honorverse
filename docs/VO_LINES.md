# Nahrávací skript hlášek ve hře (VO — 2. sada)

Doplněk k `docs/VO_SCRIPT.md` (příběhové prology/epilogy — EN sada hotová).
Tohle jsou **hlášky UVNITŘ mise**: komunikace misí, situační hlásky posádky
a statická systémová hlášení. Vygenerováno ručně z
`src/data/missions/*.ts`, `src/sim/voice.ts`, `src/sim/crew.ts`,
`src/sim/engine.ts` a `src/sim/surrender.ts`.

## Jak nahrávat

- **Formát:** MP3 (mono, 96 kbps+); hra umí i `.m4a`/`.wav` se stejným jménem.
- **Umístění:** `public/audio/vo/lines/<id>-<jazyk>.mp3` — např.
  `m01-c3-en.mp3`, `crew-contact-2-en.mp3`. Id ber PŘESNĚ z tohoto skriptu;
  zapojení do hry (přehrání při události) přijde v navazujícím PR podle
  těchto id.
- Chybějící soubor hra tiše přeskočí — jde nahrávat po částech.
- **Priorita:** ① komunikace misí (§1 — nese příběh), ② hlásky posádky
  (§2 — slyšíš je v každé bitvě), ③ jednorázovky (§3), ④ systémové (§4,
  volitelné).
- Jazyk: hra je anglicky primárně — nahrávej **EN** sloupec; CS je originál
  (a titulky, dokud není sim přeložený).
- Pár hlášek má ve hře v textu dynamické číslo/jméno — VO verze je záměrně
  obecná (označeno „(VO obecná)"): audio zůstane pravdivé, přesné číslo řekne
  titulek.

## Mluvčí (obsazení)

| Klíč | Postava | Poznámka |
| --- | --- | --- |
| `comms` | Spojař | mladší hlas, rychlé hlášení |
| `tactical` | Taktický důstojník | věcný, úsečný |
| `xo` | První důstojník | klidná autorita |
| `engineer` | Inženýr | zadýchaný, praktický |
| `station` | Stanice / řízení provozu | rádiový filtr |
| `pirate` | Pirát | hrubý, výhrůžný |
| `enemy-captain` | Nepřátelský kapitán | chladný, formální |
| `governor` | Guvernér | státnický |

---

## §1 Komunikace misí (45 replik)

### mission01 — Hlídka u Strážné brány

**`m01-c1` · station**
- CS: Kontrola Brány volá Cygnus: „Nákladní lodi Cygnus, vypněte klín a připravte se na celní kontrolu. Dauntless je na cestě k vám."
- EN: Gate Control to Cygnus: "Freighter Cygnus, strike your wedge and stand by for customs inspection. Dauntless is on her way to you."

**`m01-c2` · enemy-captain**
- CS: Cygnus: „Kontrolo, vezeme zemědělské stroje a máme skluz. Tohle si vyřídíme s vaším guvernérem — nezdržujte nás."
- EN: Cygnus: "Control, we're hauling farm machinery and we're behind schedule. We'll take this up with your governor — don't hold us up."

**`m01-c3` · comms**
- CS: Kapitáne… zachytávám provoz Cygnusu s Bránou. Obsah sedí, ale to šifrování ne — civilní bárky jedou na komerčním kódu, tohle je vojenská třída D. Buď si koupili pancéřovanou vysílačku… nebo nevezou zemědělské stroje.
- EN: Captain… I'm picking up Cygnus's traffic with the Gate. The content checks out, but the encryption doesn't — civilian scows run commercial code, and this is military class D. Either they bought themselves an armored transmitter… or they're not hauling farm machinery.

**`m01-c4` · comms**
- CS: Říkal jsem, že ta vysílačka smrdí! Vysílám výzvu: „Cygnusi, zastavte a vypněte klín, nebo zahájíme palbu." …Neodpovídají, kapitáne.
- EN: I told you that transmitter smelled! Sending the challenge: "Cygnus, heave to and strike your wedge, or we open fire." …No answer, Captain.

**`m01-c5` · tactical**
- CS: ŠKOLA MANÉVRU: impelerový klín nedává rychlost, dává ZRYCHLENÍ — rychlost se STŘÁDÁ. Na plný výkon nabíráme přes tři sta kilometrů za sekundu KAŽDOU MINUTU a on taky; kdo zrychlí dřív a víc, jeho náskok neroste lineárně, ale kvadraticky. Honičky se vyhrávají v prvních minutách, ne na konci — každá vteřina zaváhání teď znamená stovky tisíc kilometrů u hyperlimitu.
- EN: SCHOOL OF MANEUVER: the impeller wedge doesn't give you speed, it gives you ACCELERATION — speed ACCUMULATES. At full power we gain over three hundred kilometers per second EVERY MINUTE, and so does he; whoever accelerates first and harder grows his lead not linearly but quadratically. Chases are won in the first minutes, not at the end — every second of hesitation now means hundreds of thousands of kilometers at the hyper limit.

**`m01-c6` · xo**
- CS: První důstojník: „Doháníme ho s velkým převýšením rychlosti — a NEBRZDÍME. Cílem není se s ním potkat, ale PROLÉTNOUT kolem: brzdění by trvalo stejně dlouho jako celý rozjezd a vyrovnat rychlosti znamená bít se za jeho podmínek. Naše salvy náš vektor ZDĚDÍ — odpal po směru letu doletí dál, dorazí rychleji a jeho obraně nedá skoro žádný čas. Vyšší rychlost a správný směr JSOU zbraň: rychlejší loď si vybírá, kdy a kde se bojuje — a jestli vůbec."
- EN: First Officer: "We're overhauling him with a big speed advantage — and we are NOT braking. The goal isn't to meet him, it's to FLY PAST: braking would take as long as the whole run-up, and matching velocities means fighting on his terms. Our volleys INHERIT our vector — a launch along our course flies farther, arrives faster and gives his defense almost no time. Higher speed and the right heading ARE a weapon: the faster ship chooses when and where the fight happens — and whether it happens at all."

**`m01-c7` · xo**
- CS: První důstojník: „Táhne přes čtyři sta g — na standardních osmdesáti procentech ho NEdoženeme. Doporučuju plný výkon; a jestli jsme zaváhali, zbývá jedině nouzových sto dvacet. Boční štíty to položí na kolena, ale on stejně skoro nemá čím střílet."
- EN: First Officer: "He's pulling over four hundred g — at the standard eighty percent we will NOT catch him. I recommend full power; and if we've hesitated, all that's left is emergency one-twenty. It'll bring the sidewalls to their knees, but he's got almost nothing to shoot with anyway."

**`m01-c8` · tactical**
- CS: Jsme na milion kilometrů — a tohle je vzdálenost, na které rakety ZABÍJEJÍ. Krátký let znamená, že obrana cíle skoro nestihne reagovat. Doporučuji plnou salvu; kdyby běžel dál, AUTO palba to dokončí za nás.
- EN: We're at one million kilometers — and this is the range where missiles KILL. A short flight means the target's defense barely has time to react. I recommend a full volley; if he keeps running, AUTO fire will finish it for us.

**`m01-c9` · station**
- CS: Kontrola Brány: „Cygnus kapituloval a vypnul klín. Výsadková četa je na cestě — výborná práce, Dauntless."
- EN: Gate Control: "Cygnus has surrendered and struck her wedge. The boarding party is on its way — fine work, Dauntless."

### mission02 — Konvoj Pomezím

**`m02-c1` · comms**
- CS: Zachycený pirátský provoz: znají složení konvoje — půjdou po nákladních lodích, ne po nás.
- EN: Intercepted pirate traffic: they know the convoy's composition — they'll go for the freighters, not for us.

**`m02-c2` · pirate**
- CS: „Konvoji Pomezím: vypněte stroje a opusťte lodě, a možná vás necháme dýchat. Ta plechovka od námořnictva vás nezachrání."
- EN: "Convoy through the Marches: shut down your drives and abandon ship, and maybe we'll let you keep breathing. That Navy tin can won't save you."

**`m02-c3` · comms**
- CS: Argonaut volá: „Doprovode, kde jste?! Máme impelerové kontakty ze dvou stran — proboha, vraťte se ke konvoji!"
- EN: Argonaut calling: "Escort, where are you?! We have impeller contacts from two sides — for God's sake, get back to the convoy!"

**`m02-c4` · tactical**
- CS: Tři na jednoho — ale ženou se k NÁM, a to je naše výhoda. Vraťte se ke konvoji, nechte je zkrátit vzdálenost a pak je berte zblízka jednoho po druhém. Táhneme i raketovou plošinu: šest raket v jedné vlně — až bude první pirát blízko, odhoďte ji, jeho obrana tolik najednou nechytá.
- EN: Three to one — but they're charging at US, and that's our edge. Get back to the convoy, let them close the range, and take them up close one by one. We're towing a missile pod too: six missiles in one wave — when the first pirate is close, drop it, his defense can't catch that many at once.

### mission03 — Q-ship

**`m03-c1` · comms**
- CS: Mercator vysílá: „Díky, že jste tu, Dauntless. Přední prstenec sotva drží pohromadě — držte se blízko, prosím. Kdyby se něco utrhlo, ať to nikdo neschytá."
- EN: Mercator transmitting: "Thank you for being here, Dauntless. The forward ring is barely holding together — stay close, please. If something tears loose, let no one catch it."

**`m03-c2` · enemy-captain**
- CS: „Vaše Království si myslí, že mu Pomezí patří. Historické právo říká něco jiného — a tohle je odpověď Impéria, Dauntless. Doufám, že jste si užili eskortní službu."
- EN: "Your Kingdom thinks the Marches belong to it. Historical right says otherwise — and this is the Empire's answer, Dauntless. I hope you enjoyed your escort duty."

**`m03-c3` · comms**
- CS: Vysílám výzvu ke kapitulaci: „Mercatore, složte zbraně a vypněte klín." Odpovědí je odpal raket, kapitáne.
- EN: Sending the surrender demand: "Mercator, lay down your arms and strike your wedge." The answer is a missile launch, Captain.

**`m03-c4` · xo**
- CS: První důstojník: „OTEVŘÍT VZDÁLENOST, hned! Zblízka jsou salvy vražedné pro obě strany — a on má víc šachet. Držte ho na dvou až dvou a půl milionech: jeho salvy k nám poletí dost dlouho, aby obrana stihla dva pokusy na každou raketu. My jsme rychlejší — vzdálenost si diktujeme MY. Až vystřílí zásobníky, přijde naše chvíle."
- EN: First Officer: "OPEN THE RANGE, now! Up close the volleys are murderous for both sides — and he has more tubes. Hold him at two to two and a half million: his volleys will fly long enough for our defense to get two attempts at every missile. We're faster — WE dictate the range. When he's shot his magazines dry, our moment comes."

### mission04 — Tichý pozorovatel

**`m04-c1` · comms**
- CS: Zachycené nouzové volání: „…tady kurýr Hermes, pohon vyřazen, driftujeme… kyslík na dva dny… prosím, slyší nás někdo?"
- EN: Intercepted distress call: "…this is courier Hermes, drive disabled, we're drifting… oxygen for two days… please, is anyone hearing us?"

**`m04-c2` · enemy-captain**
- CS: IDS Rigel na všech frekvencích: „Neznámá lodi, tady Doradské impérium. Jste v prostoru, který vám nepatří. Vypněte pohon a vzdejte se, nebo budete zničeni. Druhá výzva nebude."
- EN: IDS Rigel on all frequencies: "Unknown vessel, this is the Dorado Empire. You are in space that does not belong to you. Shut down your drive and surrender, or you will be destroyed. There will be no second warning."

### mission05 — Stanice Zeta

**`m05-c1` · station**
- CS: Stanice Zeta: „Bastione, vidíme je taky. Tři tisíce lidí na palubě spoléhá, že je nepustíte blíž."
- EN: Station Zeta: "Bastion, we see them too. Three thousand people aboard are counting on you not to let them any closer."

**`m05-c2` · pirate**
- CS: „Stanice Zeta, tohle je poslední nabídka: otevřete doky a vydejte sklady, nebo je rozbijeme i s vámi."
- EN: "Station Zeta, this is the last offer: open your docks and hand over the stores, or we break them open with you inside."

**`m05-c3` · comms**
- CS: Spojař: „Kapitáne, ten čtvrtý kontakt… transpondér nákladní lodi Meridian a nouzové kódy — to je unesený obchodník s civilisty! Nestřílet!"
- EN: Comms officer: "Captain, that fourth contact… a freighter transponder, Meridian, and distress codes — that's a hijacked merchantman with civilians aboard! Hold fire!"

**`m05-c4` · xo**
- CS: První důstojník: „…Meridian je pryč, pane. Byli tam civilisté. Tohle si poneseme domů."
- EN: First Officer: "…Meridian is gone, sir. There were civilians aboard. We'll be carrying this one home."

### mission06 — Ústup od Tharsis

**`m06-c1` · engineer**
- CS: Inženýr: „Zadní prstenec drží na 35 %, víc z něj nedostanu. Jestli nás dohoní, s tímhle bočním štítem druhé kolo nepřežijeme."
- EN: Engineer: "The aft ring is holding at thirty-five percent, and I can't get more out of it. If they catch us, with this sidewall we won't survive a second round."

**`m06-c2` · comms**
- CS: Spojař: „Záchranná eskadra Vytrvalá a Naděje vysílá správné kódy… ale signál je o 40 ms mimo protokol. Možná jen rozladěný vysílač. Možná ne."
- EN: Comms officer: "The rescue squadron — Vytrvalá and Naděje — is sending the right codes… but the signal is forty milliseconds off protocol. Maybe just a detuned transmitter. Maybe not."

**`m06-c3` · enemy-captain**
- CS: IDS Pollux (alias „Vytrvalá"): „Výborně, Resolute, přesně podle plánu. Kladivo za vámi, kovadlina před vámi. Vypněte klín."
- EN: IDS Pollux, alias "Vytrvalá": "Well done, Resolute, right on plan. The hammer behind you, the anvil ahead. Strike your wedge."

### mission07 — Zlatá flotila

**`m07-c1` · enemy-captain**
- CS: IDS Centinela: „Avalonské plavidlo, tady eskorta zlaté flotily. Tento konvoj pluje pod ochranou caudilla a předurčení Impéria. Otočte se, dokud můžete — není bez zubů."
- EN: IDS Centinela: "Avalonian vessel, this is the gold fleet escort. This convoy sails under the protection of the caudillo and the Empire's destiny. Turn back while you can — it is not toothless."

**`m07-c2` · enemy-captain**
- CS: IDS Centinela: „Máme pro tebe překvapení, avalonský pirátě."
- EN: IDS Centinela: "We have a surprise for you, Avalonian pirate."

### mission08 — Kaledonská hvězda

**`m08-c1` · comms**
- CS: KNS Claymore: „Vanguarde, tady kapitán MacAllan. Poletíme s vámi, ale Kaledon se neklaní — a caudillovým vrahům už vůbec ne. Konec."
- EN: KNS Claymore: "Vanguard, this is Captain MacAllan. We'll fly with you, but Caledon bows to no one — least of all to the caudillo's murderers. Out."

**`m08-c2` · enemy-captain**
- CS: IDS Polaris: „Avalonsko-kaledonská hlídko, Impérium vám dává jedinou možnost: vypněte klíny. Nevyužijete-li ji, poneseme my vaše jména do hlášení."
- EN: IDS Polaris: "Avalonian-Caledonian patrol, the Empire gives you a single chance: strike your wedges. Decline it, and we will carry your names in our report."

**`m08-c3` · xo**
- CS: První důstojník: „Kaledonský kapitán se odtrhl z formace! Ignoruje volání — jde sám na jejich stěnu!"
- EN: First Officer: "The Caledonian captain has broken formation! He's ignoring our hails — he's going at their wall alone!"

### mission09 — Velká armáda

**`m09-c1` · governor**
- CS: Guvernér: „Kapitáne Rowane, hyperprostorové senzory hlásí translační stopy na limitu. Za vámi jsou tři obydlené světy a Křižovatka, ze které se platí všechno ostatní. Admiralita vám svěřila Vladaře. Očekává, že invaze skončí tady. Nic víc k tomu není."
- EN: Governor: "Captain Rowan, hyperspace sensors report translation footprints at the limit. Behind you are three inhabited worlds — and the Junction that pays for everything else. The Admiralty has entrusted you with the Vladař. It expects the invasion to end here. There is nothing more to say."

**`m09-c2` · enemy-captain**
- CS: IDS Toledo: „Hvězdné království Avalon, historické právo Impéria dorazilo na váš práh — a váží šest a půl milionu tun. Caudillo Ferrante Salazar vám nabízí milost: vydejte Křižovatku a vaše světy zůstanou obyvatelné. Toto je jediná a poslední nabídka."
- EN: IDS Toledo: "Star Kingdom of Avalon, the Empire's historical right has arrived on your doorstep — and it weighs six and a half million tons. Caudillo Ferrante Salazar offers you mercy: hand over the Junction, and your worlds stay habitable. This is the only offer, and the last."

**`m09-c3` · xo**
- CS: První důstojník: „První sled je pryč, pane. I ten jejich dreadnought. Ale podívejte na geometrii — jsme daleko od stanice a všechna naše rychlost míří VEN. Jestli mají druhý sbor, přistane tam, kde nejsme."
- EN: First Officer: "The first echelon is gone, sir. Their dreadnought too. But look at the geometry — we're far from the station and all our velocity is pointing OUT. If they have a second corps, it will land where we aren't."

**`m09-c4` · station**
- CS: Kontrola Křižovatka: „Nové translační stopy — mínus sto devadesát na mínus šedesát! Jsou za vámi, opakuji, druhý sled je MEZI vámi a stanicí! Vladaři, tady jsou tři tisíce lidí!"
- EN: Junction Control: "New translation footprints — minus one-ninety by minus sixty! They're behind you — I say again, the second echelon is BETWEEN you and the station! Vladař, there are three thousand people here!"

### mission10 — Cádiz

**`m10-c1` · xo**
- CS: První důstojník: „Rozestavění hlídek sedí na Auroryny mapy do posledního kilometru, pane. A konvoj, co jsme potopili u Keravu, tady pořád chybí — základna má poloviční šachty. Jen ten dreadnought u ní je nový. Tohle okno jsme si vykoupili sami."
- EN: First Officer: "The picket layout matches Aurora's charts to the last kilometer, sir. And the convoy we sank off Kerav is still missing here — the base has half its tubes. Only that dreadnought beside it is new. We bought this window ourselves."

**`m10-c2` · enemy-captain**
- CS: IDS Córdoba: „Avalonský svaze, tady hlídka soustavy Cádiz. Věděli jsme, že přijdete — předurčení Impéria zná i vaše souřadnice. Palba bez další výzvy."
- EN: IDS Córdoba: "Avalonian force, this is the Cádiz system picket. We knew you would come — the Empire's destiny knows even your coordinates. Firing without further warning."

**`m10-c3` · tactical**
- CS: Taktický: „Zaseli nám je přímo do osy útoku — věděli, kudy poletíme. Manévr a geometrie, kapitáne, municí tohle neustojíme!"
- EN: Tactical: "They seeded them right down our axis of attack — they knew our approach. Maneuver and geometry, Captain; we can't ride this out on ammunition!"

**`m10-c4` · governor**
- CS: Guvernér: „Rozkaz Admirality: okamžitě přerušte útok a stáhněte se — diplomaté podepsali příměří. Opakuji: stáhněte se."
- EN: Governor: "Admiralty order: break off the attack immediately and withdraw — the diplomats have signed an armistice. I say again: withdraw."

### mission11 — Stěna proti stěně

**`m11-c1` · xo**
- CS: První důstojník: „Simulace admirality běží, kapitáne. Plná stěna proti plné stěně — tohle si u Křižovatky nikdo nezkusil naostro. Doporučuju STĚNU pro jádro a nechat zástěnu pracovat."
- EN: First Officer: "The Admiralty simulation is running, Captain. A full wall against a full wall — nobody has tried this for real at the Junction. I recommend the WALL for the core, and let the screen do its work."

**`m11-c2` · enemy-captain**
- CS: IDS Toledo: „Dvacet trupů, avalonský admirále. Historie učí, že stěna se neláme elegancí — láme se tonáží. Ukažte, co jste se u Cádizu naučili."
- EN: IDS Toledo: "Twenty hulls, Avalonian admiral. History teaches that a wall is not broken by elegance — it is broken by tonnage. Show us what you learned at Cádiz."

**`m11-c3` · tactical**
- CS: Taktický: „Jejich stěna drží šedesát procent tahu — plné boční štíty. Jestli k nim popluje na sto procent, budeme mít boky z papíru; navrhuju šedesát a nechat je nabíhat na naše salvy."
- EN: Tactical: "Their wall is holding sixty percent throttle — full sidewalls. If we run at them at a hundred, our flanks will be paper; I suggest sixty, and let them run onto our volleys."

### Boční operace

**`s01-c1` · pirate** (side01 — Nouzové volání)
- CS: „Kurýre, vypni stroje. Ta korveta od námořnictva k tobě nedoletí včas."
- EN: "Courier, shut down your drives. That Navy corvette won't reach you in time."

**`s02-c1` · pirate** (side02 — Pirátský sklad)
- CS: „Máme společnost — námořnictvo našlo přístav! Kryjte sklad, ať stihnou naložit!"
- EN: "We've got company — the Navy found the haven! Cover the depot until they finish loading!"

**`s03-c1` · enemy-captain** (side03 — Předsunutá hlídka)
- CS: „Neznámé impelerové kontakty — dvě lodě, míří na nás. Vyšlete varování k Cádizu!"
- EN: "Unknown impeller contacts — two ships, heading for us. Send the warning to Cádiz!"

---

## §2 Situační hlásky posádky (35 replik, `src/sim/voice.ts`)

Hra vybírá variantu deterministicky — nahraj **všechny varianty** kategorie.

### První kontakt mise · comms

**`crew-contact-1`**
- CS: Impelerový kontakt, označuji Alfa-1. Kurz a emise zapisuji do taktické mapy.
- EN: Impeller contact, designating Alpha One. Logging course and emissions to the tactical plot.

**`crew-contact-2`**
- CS: Kontakt! Pasivní pole zachytilo cizí podpis. Předávám taktickému.
- EN: Contact! The passive array has picked up an unknown signature. Passing it to Tactical.

**`crew-contact-3`**
- CS: Máme společnost — nový kontakt na scopech. Sledujeme a nahráváme.
- EN: We have company — new contact on the scopes. Tracking and recording.

**`crew-contact-4`**
- CS: Nový kontakt na pasivech, kapitáne. Identifikace až zblízka.
- EN: New contact on passives, Captain. Identification only up close.

### Klasifikace válečné lodi · tactical — (VO obecná: titulek doplní třídu)

**`crew-warship-1`**
- CS: Potvrzeno: válečná loď. Přepočítávám palebné řešení.
- EN: Confirmed: warship. Recomputing the firing solution.

**`crew-warship-2`**
- CS: Klasifikace hotová. To není obchodník, kapitáne.
- EN: Classification complete. That's no merchantman, Captain.

**`crew-warship-3`**
- CS: Senzory potvrzují válečnou loď. Doporučuji držet odstup, dokud nemáme řešení.
- EN: Sensors confirm a warship. I recommend keeping our distance until we have a solution.

### První příchozí salva · tactical — (VO obecná: titulek doplní počet)

**`crew-vampire-1`**
- CS: Odpaly raket! Vampýr, vampýr — kurz na nás.
- EN: Missile launches! Vampire, vampire — inbound on us.

**`crew-vampire-2`**
- CS: Raketové odpaly u nepřítele! Sledujeme vampýry na příchodu.
- EN: Missile launches from the enemy! Tracking vampires inbound.

**`crew-vampire-3`**
- CS: Vampýr, vampýr! Salva raket ve vzduchu — obranné systémy připraveny.
- EN: Vampire, vampire! A volley in the air — defensive systems standing by.

**`crew-vampire-4`**
- CS: Nepřítel pálí! Rakety na scopech, protirakety v pohotovosti.
- EN: The enemy is firing! Missiles on the scopes, counter-missiles at the ready.

### Těžký zásah vlastní lodi · xo

**`crew-hitheavy-1`**
- CS: Těžký zásah! Hlášení škod jdou ze tří palub najednou — týmy nasazuji, kde se dá.
- EN: Heavy hit! Damage reports coming in from three decks at once — I'm committing the teams where I can.

**`crew-hitheavy-2`**
- CS: To šlo hluboko, kapitáne. Prosekli boční štít — škody se teprve sčítají.
- EN: That one went deep, Captain. They cut through the sidewall — we're still adding up the damage.

**`crew-hitheavy-3`**
- CS: Průnik trupem! Přetlakové přepážky drží… zatím.
- EN: Hull breach! The pressure bulkheads are holding… for now.

### Lehký zásah vlastní lodi · engineer

**`crew-hitlight-1`**
- CS: Zásah do trupu — škody povrchové. Týmy oprav už běží.
- EN: Hit on the hull — surface damage. Repair teams are already moving.

**`crew-hitlight-2`**
- CS: Dostali jsme šlehanec. Nic, co by se nedalo zalátat za provozu.
- EN: We took a graze. Nothing we can't patch underway.

**`crew-hitlight-3`**
- CS: Lehký zásah, kapitáne. Boční štít pohltil většinu.
- EN: Light hit, Captain. The sidewall soaked up most of it.

### Zásah nepřítele · tactical

**`crew-enemyhit-1`**
- CS: Zásah! Senzory hlásí únik atmosféry z cíle.
- EN: A hit! Sensors report atmosphere venting from the target.

**`crew-enemyhit-2`**
- CS: Přímý zásah — na scopech úlomky trupu a oblak par.
- EN: Direct hit — hull fragments and a vapor cloud on the scopes.

**`crew-enemyhit-3`**
- CS: Dostal to. Impelerový podpis cíle kolísá.
- EN: He felt that one. The target's impeller signature is wavering.

### Nepřítel prchá · tactical

**`crew-fleeing-1`**
- CS: Cíl se otáčí a prchá — vektor pryč od nás, plný výkon.
- EN: The target is turning away and running — vector away from us, full power.

**`crew-fleeing-2`**
- CS: Nepřítel má dost! Otočil se a maže z boje.
- EN: The enemy's had enough! He's turned tail and he's running from the fight.

**`crew-fleeing-3`**
- CS: Kontakt prchá, kapitáne. Můžeme ho nechat běžet — nebo dohnat.
- EN: Contact is fleeing, Captain. We can let him run — or run him down.

### Trup pod 50 % · xo

**`crew-hull50-1`**
- CS: Kapitáne, loď to dlouho nevydrží. Jestli máme plán, teď je čas ho použít.
- EN: Captain, the ship won't take this much longer. If we have a plan, now is the time to use it.

**`crew-hull50-2`**
- CS: Trup pod polovinou, kapitáne. Ještě pár takových zásahů a rozpadneme se.
- EN: Hull below half, Captain. A few more hits like that and we come apart.

**`crew-hull50-3`**
- CS: Hlášení škod se přestávají vejít na jednu obrazovku. Dlouho už to nevydržíme.
- EN: The damage reports don't fit on one screen anymore. We can't take this much longer.

### Docházejí rakety · tactical

**`crew-ammolow-1`**
- CS: Zásobníky raket pod čtvrtinou. Každou další salvu dvakrát zvažte, kapitáne.
- EN: Missile magazines below a quarter. Weigh every next volley twice, Captain.

**`crew-ammolow-2`**
- CS: Docházejí nám rakety — zbývá míň než čtvrtina zásobníků.
- EN: We're running out of missiles — less than a quarter of the magazines left.

**`crew-ammolow-3`**
- CS: Munice na dně: pod 25 procent. Přecházím na úsporné salvy.
- EN: Ammunition at the bottom: below twenty-five percent. Switching to economy volleys.

### Docházejí protirakety · tactical

**`crew-cmlow-1`**
- CS: Protirakety pod čtvrtinou zásobníků. Obrana bude řídnout.
- EN: Counter-missiles below a quarter of the magazines. The defense is going to thin out.

**`crew-cmlow-2`**
- CS: Zásobníky protiraket docházejí — pod 25 procent. Zbytek nechte na PDLC a klín.
- EN: Counter-missile magazines running dry — below twenty-five percent. Leave the rest to the PDLC and the wedge.

**`crew-cmlow-3`**
- CS: Málo protiraket, kapitáne. Šetřím je na salvy, které projdou nejblíž.
- EN: Low on counter-missiles, Captain. I'm saving them for the volleys that get in closest.

### Cíl v poháněné obálce · tactical

**`crew-envelope-1`**
- CS: Cíl vstoupil do naší poháněné obálky — čekám na rozkaz k palbě.
- EN: Target has entered our powered envelope — awaiting the order to fire.

**`crew-envelope-2`**
- CS: Máme ho v obálce. Palebné řešení drží — stačí říct, kapitáne.
- EN: We have him in the envelope. Firing solution holding — just say the word, Captain.

**`crew-envelope-3`**
- CS: Cíl v dosahu poháněného letu. Šachty nabité, čekám na rozkaz.
- EN: Target within powered flight range. Tubes loaded, awaiting your order.

---

## §3 Jednorázovky a odpovědi (8 replik)

### Nouzový výkon (`src/sim/engine.ts`, `src/sim/crew.ts`) · engineer

**`eng-redline-warn`** — první přepnutí nad 100 %
- CS: Rozkaz potvrzen — kompenzátor nad sto procent. Jedeme za červenou čarou; každá minuta navíc je ruleta s impelerovými prstenci!
- EN: Order confirmed — compensator above one hundred percent. We're past the red line now; every extra minute is roulette with the impeller rings!

**`eng-redline-1`** — poškození prstence — (VO obecná: titulek doplní subsystém a %)
- CS: Kompenzátor jede za červenou — jestli to neubereme, přijdeme o prstenec!
- EN: The compensator is past the red line — if we don't throttle down, we lose a ring!

**`eng-redline-2`**
- CS: Přetížení! Alfa nody házejí harmoniky — sto dvacet procent dlouho nevydržíme!
- EN: Overload! The alpha nodes are throwing harmonics — we can't hold one-twenty for long!

**`eng-redline-3`**
- CS: Prstenec se přehřívá! Doporučuju okamžitě stáhnout výkon pod sto procent!
- EN: The ring is overheating! I recommend pulling power below a hundred percent immediately!

### Náhodné události posádky (`src/sim/crew.ts`)

**`crew-event-lock`** · tactical
- CS: Našel jsem mezeru v jejich obranném vzorci — zámek našich raket +20 % na 10 minut.
- EN: I've found a gap in their defensive pattern — our missile lock is up twenty percent for the next ten minutes.

**`crew-event-repair`** · engineer
- CS: Přepojil jsem záložní okruhy — opravy pojedou 4× rychleji, vydrží to 5 minut.
- EN: I've rerouted the backup circuits — repairs will run four times faster, for about five minutes.

**`crew-event-sigint`** · comms — (varianta bez odhalení; s odhalením je dynamická → jen text)
- CS: Zachycená nepřátelská komunikace — šifrovaná. Nahrávám pro rozvědku.
- EN: Intercepted enemy communications — encrypted. Recording for Intelligence.

### Odpovědi na výzvu ke kapitulaci (`src/sim/surrender.ts`) — (VO obecná: titulek doplní jméno lodi)

Mluvčího volí hra podle doktríny cíle (pirát ⟷ imperiální kapitán) — nahraj
každou repliku **oběma hlasy**, id nese mluvčího.

**`sur-accept-pirate`** · pirate / **`sur-accept-imperial`** · enemy-captain
- CS: „Dost… dost! Vypínáme klín a skládáme zbraně. Kapitulujeme — nestřílejte."
- EN: "Enough… enough! We're striking the wedge and laying down arms. We surrender — hold your fire."

**`sur-refuse-pirate`** · pirate / **`sur-refuse-imperial`** · enemy-captain
- CS: „Kapitulovat? Zapomeňte. Ještě jsme neskončili."
- EN: "Surrender? Forget it. We're not finished yet."

---

## §4 Statické systémové hlášky (volitelné, 13 replik)

Krátká potvrzení rozkazů — nahrávat až nakonec, hra je bez VO jen zobrazí.

| Id | Mluvčí | CS | EN |
| --- | --- | --- | --- |
| `sys-rolled` | tactical | Jsme odvalení — boky kryje klín, palba nemožná. | We're rolled — the wedge is covering our flanks, no fire possible. |
| `sys-magsdry` | tactical | Prázdné zásobníky raket! | Missile magazines empty! |
| `sys-tubesout` | tactical | Všechny raketové šachty vyřazeny! | All missile tubes knocked out! |
| `sys-jammer3` | tactical | Eskortní rušička potřebuje salvu aspoň 3 raket — odpal zrušen. | The escort jammer needs a volley of at least three — launch cancelled. |
| `sys-autohold-roll` | tactical | Jsme odvalení — AUTO palba čeká na návrat do normální polohy. | We're rolled — AUTO fire is waiting for normal attitude. |
| `sys-autoresume` | tactical | Zpět v normální poloze — AUTO palba pokračuje. | Back in normal attitude — AUTO fire resuming. |
| `sys-autodone` | tactical | Cíl zničen nebo ztracen — auto palba ukončena. | Target destroyed or lost — AUTO fire ended. |
| `sys-autosurr` | tactical | Cíl kapituloval — zastavuji palbu. | Target has surrendered — checking fire. |
| `sys-autoempty` | tactical | Prázdné zásobníky raket — auto palba ukončena. | Missile magazines empty — AUTO fire ended. |
| `sys-decoyout` | tactical | Zásobník návnad prázdný! | Decoy stores empty! |
| `sys-decoyup` | tactical | Návnada už je za lodí. | The decoy is already trailing. |
| `sys-nosurr-neutral` | comms | To není nepřátelské plavidlo — výzva ke kapitulaci nemá smysl. | That's not a hostile vessel — a surrender demand makes no sense. |
| `sys-nosurr-unid` | comms | Kontakt není klasifikován — nejdřív ho identifikuj. | Contact not classified — identify it first. |

## Jen text (pro VO nevhodné — dynamický obsah)

Nenahrávat: hlášky s proměnnými čísly/jmény v každém výskytu — odpočty
přebíjení („další salva za N s"), ŠKOLA PALBY se vzdálenostmi, „Palebné
řešení na `<jméno>` — zahajuji palbu", vrstvená/alfa salva s časy, hlášení
inženýra o konkrétním subsystému a procentech, „`<subsystém>` znovu
online", rozpuštění formace se jménem lodi, odeslaná výzva ke kapitulaci
s ETA, odhalený kontakt „#N je `<třída>`", systémová hlášení senzorů
(„Nový kontakt: …", „Kontakt identifikován: …"). Ta zůstanou titulky.
