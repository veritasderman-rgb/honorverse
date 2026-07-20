# Plán kampaně na 30 misí

Návrh rozšíření kampaně z 11 na 30 misí. Stav: **NÁVRH — čeká na realizaci.**
Navazuje na stávající oblouk: mise 1–4 výcvik na Pomezí, 5–8 eskalace,
9–10 finále u Cádizu (dva konce), 11 poválečná „Stěna proti stěně".

Značka ⚙ = mise potřebuje malý nový mechanismus (vždy jen scénářová
vrstva / triggery, žádný zásah do jádra simu).

## Dějství III — Studená válka (mise 12–16)

*Impérium podepsalo mír u Cádizu, ale Pomezí hoří dál.*

| # | Název | Loď | Jádro hry |
|---|-------|-----|-----------|
| 12 | Lov na Krakena | CL | Obrácená mise 2: pirátská eskadra v poli asteroidů, vytáhni je návnadovým konvojem. Doktríny + paměťové piny. |
| 13 | Tichá pošta | DB kurýr | Poprvé neozbrojená loď: proklouznout blokádou jen na EMCON, trysky a světelné zpoždění. Škola mise 4 naostro. |
| 14 | Karanténa | 2× DD | Vynucení blokády: zastavuj a kontroluj neutrály (výzvy ke kapitulaci); jeden je ozbrojený běžec, jeden skutečný neutrál — střelba do špatného = prohra. |
| 15 | Hřbitov u Tharsis | CA | Návrat na bojiště mise 6: mezi vraky (⚙ vraky jako statické objekty s falešnými odezvami) skrytá imperiální odposlechová stanice. Najdi na pasivech, znič před odvysíláním. |
| 16 | Incident Almadén | BC + 2 CL | Imperiální „cvičení" překročí demarkační čáru. Nesmíš vystřelit první; vydrž provokace, po první salvě je rozbij. Politický trigger jako v misi 10. |

## Dějství IV — Druhá válka (mise 17–23)

*Caudillo padl, junta potřebuje rychlé vítězství.*

| # | Název | Loď | Jádro hry |
|---|-------|-----|-----------|
| 17 | První úder | eskadra CA | Přepad kotvící eskadry: start se studenými klíny (⚙ zpožděný náběh klínu), zvedni stěnu dřív, než dopadne první vlna NEPŘÁTELSKÝCH plošin. |
| 18 | Konvoj smrti | 2 DD + 6 obchodníků | Velký eskortní test: vlny nájezdů z různých směrů, dělení eskadry doktrínami (Nejbližší na obranu, Rozdělit na nájezdníky). |
| 19 | Meteorický déšť | BC | Nájezd na loděnici: vícebodová trasa soustavou, alfa úder plošinami na doky, útěk před přesilou. „Udeř a zmiz." |
| 20 | Bratrská pomoc | flotila Kaledonie | Velení cizí eskadře s horší elektronikou (missileQuality 0.9): vyhrávat kvantitou salv a saturací. |
| 21 | Ztracená stěna | DN | Ústupový boj stěny: poškozené subsystémy od startu, polní opravy pod palbou, rozhodování koho odepsat. Mise 6 v měřítku stěny. |
| 22 | Past na lovce | CL + návnada | Imperiální BC loví konvoje; postav past: konvoj-návnada + eskadra na EMCON (⚙ příchod posil hyperskokem na trigger). |
| 23 | Pevnost Sevilla | útočná stěna + pody | Dobývání opevněné soustavy: stanice s obřími zásobníky CM, minové pole (⚙ miny = jednorázové pody stanice). Vystřílet obranu saturací z dálky. |

## Dějství V — Protiofenzíva a konec (mise 24–30)

*Cesta na Doradu.*

| # | Název | Loď | Jádro hry |
|---|-------|-----|-----------|
| 24 | Záchrana Hermes II | rychlá skupina | Zajatecký tábor na měsíci: výsadek (⚙ „drž pozici X s u planety" = boarding), tvrdý časový limit před příletem reakční eskadry. |
| 25 | Souboj admirálů | DN vs DN | Čistý duel vlajkových lodí 1v1: dostat se přes raketové pásmo do graserového dosahu s co nejmenším poškozením. Finále školy vzdálenosti. |
| 26 | Přeběhlík | CL | Imperiální kapitán přebíhá i s lodí: doprovoď ho, honí ho vlastní. Dva konce (past / zpravodajský poklad) podle toho, jestli mu věříš. |
| 27 | Dlouhá noc | stěna 25v25 | Největší bitva hry: plošiny na obou stranách, spojenci pod tvým velením. Test všech doktrín najednou. |
| 28 | Spálená země | eskadra | Impérium při ústupu bombarduje kolonie: priorita cílů (bombardující > eskorta), záchrana pod časem. |
| 29 | Dorada | invazní flotila | Finále: soustava hlavního města — miny, stanice, poslední stěna a politický trigger (znič vlajkovou loď VS. donuť ji ke kapitulaci = dva konce). |
| 30 | Přehlídka / Epilog | sandbox | Volný souboj: vyber lodě obou stran a seed (⚙ konfigurátor šarvátky). Znovuhratelnost + zdroj skóre do Síně slávy. |

## Poznámky k realizaci

- Gradace dějství: III lehké lodě, IV těžké, V stěny — kopíruje růst hráče.
- Každá mise buď recykluje osvědčenou mechaniku v nové roli, nebo přidává
  právě JEDNU malou (⚙): vraky s falešnými odezvami, studené klíny,
  hyperskokové posily, miny, „drž pozici", konfigurátor šarvátky.
- Vše jde přes scénářové triggery (spawnShip, setSide, podSalvo, flagy) —
  jádro simu se nemění.
- Doporučené pořadí realizace: **12, 14, 17, 25** (čtyři různé herní styly:
  lov, policejní práce, obranná krize, duel; jen jedna nová mechanika).
- Nezapomenout: MISSION_PAR ve score.ts, SCENARIOS registr, E2E test
  hratelnosti pro každou novou misi, prolog ve 2. osobě (story.test).
