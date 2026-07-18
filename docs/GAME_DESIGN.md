# Honorverse: Tactical — rešerše světa a návrh hry

> Pracovní název: **„Wall of Battle"** — browserová taktická simulace vesmírných bitev
> ze světa Honor Harringtonové (David Weber). Kampaň o 10 misích, důraz na věrný
> fyzikální model, ne na grafiku.

---

## Obsah

1. [Rešerše: jak funguje boj v Honorverse](#1-rešerše-jak-funguje-boj-v-honorverse)
2. [Klíčová čísla (tahák pro simulaci)](#2-klíčová-čísla-tahák-pro-simulaci)
3. [Herní koncept](#3-herní-koncept)
4. [Fyzikální model hry](#4-fyzikální-model-hry)
5. [Model boje: útok a vrstvená obrana](#5-model-boje-útok-a-vrstvená-obrana)
6. [UI a taktický displej](#6-ui-a-taktický-displej)
7. [Kampaň: 10 misí se zvraty](#7-kampaň-10-misí-se-zvraty)
8. [Technická architektura](#8-technická-architektura)
9. [Plán vývoje (MVP → plná hra)](#9-plán-vývoje-mvp--plná-hra)
10. [Rizika a vědomá zjednodušení](#10-rizika-a-vědomá-zjednodušení)
11. [Zdroje](#11-zdroje)

---

## 1. Rešerše: jak funguje boj v Honorverse

Honorverse je vzácný případ space opery, kde jsou taktické bitvy odvozené
z několika pevných fyzikálních pravidel a autor je dodržuje. Právě z těchto
pravidel plyne veškerá taktika — a proto se svět výborně hodí pro simulaci.

### 1.1 Impelerový klín (impeller wedge)

- Loď pohání **impelerový pohon**: dva ploché pásy zakřiveného prostoru
  („stress bands"), jeden **nad** a jeden **pod** lodí, svírající klín —
  vzadu užší, vepředu širší.
- Klín je **absolutně nepropustný** — neprojde jím hmota ani záření (ani
  laser, ani raketa). Loď je tedy shora a zdola **nezranitelná**.
- Otevřené zůstávají čtyři aspekty:
  - **hrdlo klínu (throat)** — otevřená příď; nejširší a nejzranitelnější,
  - **záď (kilt)** — otevřená, ale užší než hrdlo (≈ 1/3 hloubky),
  - **dva boky** — za letu chráněné **bočními štíty (sidewalls)**.
- Z toho plyne základní taktická geometrie:
  - **„Crossing the T"** — dostat se kolmo před hrdlo nepřítele = střílíš mu
    do otevřeného hrdla, on ti může odpovědět jen zlomkem baterie.
  - **Rolování lodi (roll ship!)** — v kritickém okamžiku loď „nastaví břicho":
    otočí se podél podélné osy tak, aby mezi sebe a příchozí salvu vložila
    nepropustný klín. Klasický obranný manévr z knih.
  - **Boční salva (broadside)** — hlavní výzbroj je v bocích (jako u plachetnic);
    lodě bojují bok k boku na paralelních kurzech.

### 1.2 Akcelerace a inerciální kompenzátor

- Impeler negeneruje reakční tah — loď „padá" po gravitační vlně. Uvnitř klínu
  pracuje **inerciální kompenzátor**, který posádku chrání před přetížením.
- Válečné lodě zrychlují **stovky g**: malé LAC ~600 g, torpédoborce ~500+ g,
  superdreadnoughty ~420 g. Čím větší tonáž, tím nižší maximální akcelerace.
- Standardně se jede na **80 % výkonu kompenzátoru** (bezpečnostní rezerva);
  „jít na 100 %" je riskantní rozkaz pro nouzové situace — pěkný herní prvek.
- Maximální rychlost je omezena ochranou proti mikrometeoritům
  (částicové clony): **~0,5c** pro válečné lodě, ~0,8c limit vůbec.
- Důsledek: **bitvy trvají hodiny**. Loď při 500 g nabere za hodinu
  ~17 600 km/s a urazí ~32 milionů km. Vektory a predikce kurzu jsou jádrem hry.

### 1.3 Boční štíty, poškození

- **Sidewall** je slabší gravitační štít kryjící boky klínu. Energetické zbraně
  ho na dálku > ~500 000 km prakticky neprorazí; zblízka ano. Rakety ho
  obcházejí detonací **mimo** něj (viz laserové hlavice).
- Poškození je **lokální a systémové**: jednotlivé zbraňové šachty, senzory,
  impelerové prstence (ztráta alfa/beta nodů = pokles akcelerace), kompenzátor
  (jeho selhání při akceleraci = okamžitá smrt posádky), bočníky, řízení.
  Lodě v knihách umírají po částech — to chceme simulovat, ne „HP bar".

### 1.4 Útočné zbraně

**Rakety s impelerovým pohonem** — hlavní zbraň na dlouhou vzdálenost:

- Vlastní miniaturní impeler; typická útočná raketa (éra prvních knih) umí
  **46 000 g po dobu 180 s**, nebo přepnout na ~**92 000 g po dobu 60 s**
  (výměna akcelerace za výdrž — taktická volba střelce!).
- Po vyhoření pohonu letí **balisticky** — stále smrtící, ale nemanévruje
  a je snadným cílem. „Poháněná obálka" (powered envelope) od stojícího
  odpalu je ~6–7 mil. km při 46k g, ~1,6 mil. km při 92k g. K tomu se
  **přičítá vektor lodi** v okamžiku odpalu.
- Hlavice: **laserová hlavice (laser head)** — jaderná nálož napumpuje svazek
  rentgenových laserových tyčí; detonuje **~20 000–50 000 km od cíle**,
  tedy *mimo dosah bodové obrany a vně bočníku*, a zasáhne cíl několika
  rentgenovými paprsky. Kontaktní jaderný zásah je vzácný bonus.
- Pozdější éra: **vícestupňové rakety (MDM)** se 2–3 pohony → dostřel
  30–65 mil. km, terminální rychlosti ~0,8c; **raketové pody** (kontejnery
  tažené za lodí nebo rozmístěné předem) umožňují obří první salvy; **Apollo**
  = FTL řízení salvy. Pro hru doporučuji **začít v éře jednostupňových raket**
  (knihy 1–6) a MDM/pody nasadit až v posledních misích jako eskalaci.

**Energetické zbraně** — laser a graser (gama laser):

- Drtivé, ale jen **zblízka**: efektivně < 500 000 km, rozhodující
  < 100 000 km. Souboj „na nůž", kde jediná výměna salv rozhodne.
- Nemohou prostřelit klín; proti bočníku účinné až zblízka; do otevřeného
  hrdla/zádi smrtící na jakoukoli energetickou vzdálenost.

### 1.5 Vrstvená obrana (defense in depth)

Obrana proti příchozí salvě má v knihách vždy stejné vrstvy — přesně takhle
to postavíme i v simulaci:

1. **Elektronický boj (ECM, decoye, jamming)** — sníží kvalitu zaměření
   útočících raket; návnady odlákají část salvy.
2. **Protirakety (counter-missiles, CM)** — malé rakety ~**130 000 g**,
   zachytávají útočnou salvu ve střední vzdálenosti (~1–3 mil. km);
   jejich klín při průletu ničí rakety i „otřením".
3. **Bodová obrana (PDLC — point defense laser clusters)** — laserové
   clustery na posledních desítkách tisíc km; při přibližovací rychlosti
   0,2–0,5c mají okno střelby pod jednu sekundu → sestřelí jen část.
4. **Manévr a klín** — rolování lodi vloží klín do dráhy salvy; rakety
   musejí obletět a útočit do horšího aspektu.
5. **Pasivní odolnost** — bočníky, pancíř, redundance systémů.

Typický výsledek z knih: z 50 vystřelených raket se k cíli probije jednotka
kusů — a i „úspěšná" salva většinou poškozuje, nezabíjí. Opotřebovávací boj.

### 1.6 Senzory, světelné zpoždění a velení

- Pasivní senzory (gravitační detekce klínů) jsou FTL v detekci *přítomnosti*
  pohonu, ale detailní data (aktivní radar/lidar) letí **rychlostí světla**:
  na 30 mil. km je obraz 100 s starý. Rakety po odpalu řídíš jen
  s tímto zpožděním — pak si musí poradit samy.
- Loď s **vypnutým klínem** je téměř neviditelná (jen pasivní emise) — základ
  přepadů a špionáže. Zapnutí impeleru je vidět „okamžitě" na obrovské
  vzdálenosti.
- Pozdější éra: **FTL gravitační pulsy** (Ghost Rider) = náskok Manticoru
  v komunikaci. Pro hru: volitelný modul v pozdních misích.

### 1.7 Strategický rámec: hyperprostor a hyperlimit

- Mezihvězdné přesuny přes **hyperprostor**; do soustavy nelze vystoupit
  uvnitř **hyperlimitu** (~20+ svět. minut od hvězdy, závisí na její hmotnosti).
- Obránce tedy ví, že útočník musí „přistát" na okraji a **hodiny** se
  dopravovat dovnitř — geometrie útoku na soustavu je o interceptních
  kurzech mezi hyperlimitem a planetou. Přesně tohle bude náplň misí 9 a 10.
- **Červí díry** (Manticorská junction) = strategické hrdlo: průchod je okamžitý,
  ale lodě vystupují postupně a s „oslepenými" štíty — ideální zvrat pro misi.

### 1.8 Politický kontext (pro příběh kampaně)

Válka **Hvězdného království Manticore** (RMN — hráč) proti **Lidové
republice Haven**. Manticore: menší, technologicky lepší, závislý na obchodu
(konvoje!). Haven: obří, početnější, tonáž nadevše. Vedlejší aktéři: Silesiánská
konfederace (piráti), Grayson (spojenec), Andermanské císařství (neutrál).
Kampaň může volně sledovat oblouk knih 1–3 (Basilisk → Jelcinova hvězda →
vypuknutí války), aniž kopíruje děj.

---

## 2. Klíčová čísla (tahák pro simulaci)

| Veličina | Hodnota | Poznámka |
|---|---|---|
| 1 g | 0,00981 km/s² | |
| Akcelerace LAC | ~600 g (5,9 km/s²) | maximální vojenský kompenzátor |
| Torpédoborec (DD) | ~510–530 g | |
| Křižník (CL/CA) | ~490–510 g | |
| Bitevní křižník (BC) | ~470–490 g | |
| (Super)dreadnought (DN/SD) | ~420–450 g | |
| Obchodní loď | ~200 g | civilní kompenzátor |
| Standardní režim | 80 % maxima | 100 % = riziko, herní volba |
| Max. rychlost válečné lodi | ~0,5c | částicové clony |
| Útočná raketa | 46 000 g / 180 s **nebo** 92 000 g / 60 s | volba při odpalu |
| — poháněná obálka | ~7,3 mil. km / ~1,6 mil. km | z klidu; + vektor lodi |
| — rychlost při vyhoření | ~0,27c / ~0,18c | z klidu |
| Protiraketa (CM) | ~130 000 g, ~75 s | intercept ~1–3 mil. km |
| Laserová hlavice | detonace 20–50 tis. km od cíle | mimo dosah PDLC |
| Energetické zbraně | efektivní < 400–500 tis. km | rozhodující < 100 tis. km |
| Světelné zpoždění | 1 s na 300 000 km | 100 s na 30 mil. km |
| Hyperlimit žluté hvězdy | ~20 svět. minut (~360 mil. km) | vstupní bod útočníka |

*(Hodnoty jsou kanonické či konzistentní aproximace z Weberových dodatků
a Honorverse wiki; kde se éry liší, bereme éru knih 1–6.)*

---

## 3. Herní koncept

### 3.1 Žánr a pocit

**Real-time taktika s kompresí času** — hráč je kapitán/velitel, ne pilot.
Vzorem pocitu není arkáda, ale „tactical plot" z můstku, jak ho Weber popisuje:
vektory, interceptní kužely, čas do dostřelu, rozhodnutí s předstihem minut.

Nejbližší existující vzory: *Children of a Dead Earth* (tvrdá fyzika),
*Nebulous: Fleet Command* (vrstvená obrana, EW), *Defcon* (minimalistická
vektorová grafika). Grafika: **2D vektorový taktický displej** — ikony lodí,
klíny, obálky dostřelů, stopy raket. Žádné 3D modely; „krása" hry je
v čitelnosti informací.

### 3.2 Základní smyčka (core loop)

1. **Briefing** — situace, rozkazy, zpravodajství (někdy záměrně neúplné → zvrat).
2. **Manévrovací fáze** (komprese času 1×–10 000×) — plánování kurzů,
   interceptů, správa emisí (stealth vs. akcelerace).
3. **Bojová fáze** (komprese automaticky padá k 1×, u kritických událostí
   zpomalení) — salvy, alokace obrany, rolování, rozhodnutí o vzdálenosti.
4. **Řešení následků** — poškození, ústup/pronásledování, vedlejší cíle.
5. **Debriefing** — vyhodnocení, ztráty se přenášejí do další mise (posádka,
   loď, munice → lehká kampaňová vrstva).

### 3.3 Co hráč ovládá

- **Kurz a akcelerace** (vektorové plánování, ne WASD): zadává waypointy /
  interceptní cíle, sim spočítá řešení (brachystochrona: půl cesty zrychluj,
  otoč, brzdi — nebo průletový profil).
- **Rakety**: cíl, velikost salvy, režim pohonu (46k/92k g), naprogramovaný
  profil (balistická střední fáze pro delší dostřel = past na protivníka).
- **Obrana**: rozložení CM/PDLC mezi hrozby, ECM módy, decoye, rozkaz k rolování.
- **Emise**: klín vypnut/zapnut, aktivní senzory ano/ne, EMCON.
- Později **eskadra**: rozkazy dalším lodím (formace, cíle, rozdělení palby).

### 3.4 Režim „věrnost fyzice"

Dvě předvolby: **Simulace** (plné světelné zpoždění senzorů, ruční řešení
interceptů, reálné časy — pro nadšence) a **Taktika** (zpoždění zobrazené,
ale automaticky kompenzované, asistent interceptů). Stejný engine, jen UI vrstva.

---

## 4. Fyzikální model hry

### 4.1 Geometrie: 2D s prvky třetího rozměru

Bitvy v knihách se fakticky odehrávají v rovině (síly se srovnají do stejné
roviny, „výška" se používá málo). Navrhuji **plnou 2D simulaci v rovině
ekliptiky** + třetí rozměr abstrahovat:

- **Rolování** = diskrétní stav lodi („bok / břicho ke hrozbě X") s přechodovým
  časem pár sekund; když je klín interponován, salva z daného směru musí
  na koncový oblet (penalizace přesnosti a času pro PDLC navíc).
- Aspekty **hrdlo/záď/bok** se počítají z 2D geometrie kurzu — to zachová
  „crossing the T" i rakety obcházející klín, bez nákladů plného 3D.

Tohle je nejdůležitější designové rozhodnutí: plné 3D by zdvojnásobilo
složitost UI i AI a herně přidá málo. (Engine ale navrhnu s vektory
obecné dimenze, kdybychom later chtěli 3D.)

### 4.2 Kinematika

- Čistý Newton bez tření: `v += a·dt`, `p += v·dt` (semi-implicitní Euler;
  při kompresi času substepping, dt simulace konstantně 0,25–1 s).
- Souřadnice **float64 v km**, počátek v barycentru scény; při vzdálenostech
  do ~1 mld. km je přesnost float64 (cm) bohatě dostačující — žádný floating
  origin není potřeba.
- Relativistiku **nepočítáme** (knihy ji také ignorují až na limit 0,8c);
  zavedeme jen tvrdý rychlostní strop lodí 0,5c a raket 0,8c.
- **Komprese času 1× až 10 000×** s automatickými brzdami: odpal raket,
  vstup do obálky, detekce kontaktu → sim sám zpomalí (jako alarm na můstku).

### 4.3 Intercepty a autopilot

Jádro „kapitánského" pocitu: hráč řekne *co*, loď spočítá *jak*.

- Řešič interceptu: najdi profil konstantní akcelerace (přímý zážeh, nebo
  zrychluj–otoč–brzdi) minimalizující čas do bodu/cíle s daným koncovým
  stavem („prolétnout 500 tis. km od cíle rychlostí ≤ X").
- Pro pohybující se cíle iterativní predikce (cíl extrapolován, řešení
  konverguje během pár iterací — standardní přístup).
- UI ukazuje **kužel dosažitelnosti** a čas/vzdálenost nejbližšího přiblížení
  (CPA) pro zvolený plán — hráč vidí důsledky rozhodnutí dřív, než nastanou.

### 4.4 Rakety jako plnohodnotné objekty

Každá raketa je simulované těleso s vlastním stavem:

```
{ pozice, rychlost, zbývající čas pohonu, režim (46k/92k), fáze
  (boost → balistika → terminální), kvalita zámku (0–1), cíl, seeker stav }
```

- Zdědí vektor lodi při odpalu (odpal „po směru" výrazně natahuje dostřel —
  přesně jako v knihách).
- Kvalitu zámku snižuje: vzdálenost od odpalující lodi (světelné zpoždění
  řízení), ECM cíle, decoye, interponovaný klín. Nízký zámek → raketa
  se nechá strhnout návnadou nebo detonuje na špatný aspekt.
- Salvy letí jako **vlna** (společné časování příletu — knihy: „time on target");
  hráč může salvu rozfázovat, aby přetížil obranu.

---

## 5. Model boje: útok a vrstvená obrana

Souboj salva vs. obrana je herní jádro. Model je **po vrstvách deterministicky
strukturovaný, uvnitř vrstvy pravděpodobnostní** (seedovaný RNG → replaye
a férové save/load):

```
salva N raket
  → ECM/decoye:      každá raketa test zámku; ztracené se odklánějí
  → CM vlna 1..k:    každá CM vybere hrozbu (alokátor), P(kill) dle
                     geometrie, rychlosti přiblížení a kvality dat
  → PDLC:            okno ~0,5–2 s dle rychlosti; každý cluster m výstřelů,
                     P(kill) klesá s příčnou rychlostí cíle
  → klín/aspekt:     rakety proti interponovanému klínu → oblet: přesnost ↓,
                     část ztratí řešení úplně
  → detonace:        laserová hlavice ve standoff vzdálenosti, X paprsků,
                     každý test proti bočníku/pancíři → lokální poškození
```

**Poškození po subsystémech** (ne HP): zbraňové šachty, senzory, impelerové
nody (α/β) → pokles akcelerace, bočníkové generátory, PDLC/CM odpalovače,
kompenzátor, trup/posádka. Kritické zásahy s kaskádami (zásah do zádi →
šance na ztrátu celého zadního prstence). Loď „vyřazená z boje" dřív, než
zničená — možnost kapitulace, sebrání trosečníků (v knihách velké téma cti).

**Munice je konečná** — zásobníky raket a CM jsou tvrdý zdroj v misi
i kampani. Rozhodnutí „vystřílet se na dálku vs. dojít na energetický dosah"
je přesně dilema z knih.

---

## 6. UI a taktický displej

- **Hlavní pohled**: 2D plot s logaritmickým zoomem (od 10 tis. km po
  celou soustavu), ikonografie dle tříd, vektory rychlosti, predikované
  dráhy, obálky dostřelu raket (dynamické — závisí na vlastním vektoru!).
- **Panel kontaktů**: seznam senzorových stop se stářím dat (světelné
  zpoždění), nejistota pozice jako elipsa.
- **Panel lodi**: schéma subsystémů a poškození, munice, stav klínu/bočníků.
- **Časová lišta**: komprese, plánované události (vyhoření pohonů, vstup
  do obálek, CPA).
- Vše **klávesnicí ovladatelné**; estetika CIC displeje (tmavé pozadí, zelené
  /jantarové vektory) — laciné na výrobu, věrné předloze.

---

## 7. Kampaň: 10 misí se zvraty

Rámec: hráč je důstojník RMN, postup od velitele torpédoborce po komodora
malé bitevní eskadry. Období ≈ knihy 1–3 (předvečer a vypuknutí války
s Havenem). Ztráty a spotřeba munice se přenášejí.

Každá mise učí jednu mechaniku a má zvrat, který mění zadání za běhu.

| # | Mise | Nová mechanika | Zvrat |
|---|---|---|---|
| 1 | Hlídka na Basilisku | pohyb, intercepty, senzory | „pašerák" má vojenský kompenzátor |
| 2 | Konvoj Silesií | eskorta, geometrie krytí | druhý pár raiderů čekal na odlákání eskorty |
| 3 | Q-ship | boj DD vs. CL, rolování | obchodní loď = havenský pomocný křižník |
| 4 | Tichý pozorovatel | EMCON, stealth, light-lag | průzkum se mění v záchranu — zapnout klín = prozradit se |
| 5 | Stanice Zeta | obrana pevného bodu, CM/PDLC | mezi rudými stopami je nákladní loď s civilisty |
| 6 | Ústup od Trevoru | stern chase, poškození | „záchranná" eskadra je havenská léčka |
| 7 | Nájezd na konvoj | hráč útočí, volba cílů | eskorta má raketové pody na vleku |
| 8 | Jelcinova hvězda | velení eskadře, spojenci (GSN) | spojenec neposlechne a rozbije formaci |
| 9 | Obrana domácí soustavy | wall of battle, hyperlimit | druhá vlna vystupuje z hyperu jinde: rozdělit stěnu? |
| 10 | Útok na Barnett | plný útok na soustavu | plot twist finále: minová pole z podů + politický rozkaz ustoupit v půlce útoku |

Detailně:

**Mise 1 — Hlídka na Basilisku** *(tutoriál, DD)*
Celní kontroly u wormhole terminálu. Nauč se: intercepty, komprese času,
čtení vektorů. Zvrat: „obchodník" po výzvě zapne vojenský impeler a prchá
k hyperlimitu — první ostrý intercept s časovým tlakem (stihneš ho před
únikem do hyperu?). *Inspirace: On Basilisk Station.*

**Mise 2 — Konvoj Silesií** *(eskorta, DD + 4 obchodníci)*
Klasická ochrana konvoje proti pirátům. Nauč se: krycí geometrii (eskorta
musí být mezi hrozbou a konvojem *s předstihem*, protože intercepty trvají
desítky minut). Zvrat: první raider je návnada; když se za ním hráč rozjede,
z opačného vektoru startují dva další. Lekce: pozice > agrese.

**Mise 3 — Q-ship** *(souboj 1v1)*
Doprovod „poškozeného" obchodníka, který se ukáže být havenským Q-shipem —
z kontejnerů vyjedou raketová lůžka. Boj zblízka bez varování: rolování,
energetický dosah, řízení poškození. První skutečné šrámy na lodi hráče.

**Mise 4 — Tichý pozorovatel** *(stealth/EW, CL)*
S vypnutým klínem, jen na pasivech, zmapovat havenské síly v soustavě.
Nauč se: EMCON, stáří senzorových dat, balistický drift. Zvrat: nouzový
signál manticorského kurýra — zachránit ho znamená zapnout pohon uprostřed
nepřátelské soustavy a proměnit špionáž v útěk o život.

**Mise 5 — Stanice Zeta** *(obrana bodu, CA)*
Obrana orbitální stanice proti raketovým nájezdům. Nauč se: vrstvenou
obranu, alokaci CM/PDLC, hospodaření s municí (vlny přicházejí, zásobníky
nejsou bezedné). Zvrat: v poslední vlně letí mezi útočníky unesená
nákladní loď s civilními rukojmími — rozhodnutí pod časovým tlakem.

**Mise 6 — Ústup od Trevoru** *(running fight)*
Po ztraceném střetnutí ústup poškozené lodi (ztracené β-nody = nižší
akcelerace) před rychlejším pronásledovatelem. Nauč se: geometrii zadního
aspektu (kilt), odpaly „přes rameno", mikrořízení poškozených systémů.
Zvrat: eskadra jdoucí „na pomoc" vysílá správné kódy… ale je to havenská
léčka — poznáš to jen z detailu v senzorových datech.

**Mise 7 — Nájezd na konvoj** *(role se obrací, BC)*
Hráč poprvé útočí na eskortovaný konvoj. Volba: rozstřílet eskortu, nebo
maximalizovat zničený tonáž a utéct před reakcí? Zvrat: eskorta tahá
raketové pody — první salva proti hráči je 4× větší, než čekal (první
setkání s pody = ochutnávka pozdější éry).

**Mise 8 — Jelcinova hvězda** *(velení eskadře)*
Společná operace s Graysonem. Nauč se: rozkazy více lodím, formace stěny,
rozdělení palby, národnostní tření. Zvrat: graysonský kapitán poruší
rozkaz a rozjede se na vlastní pěst — hráč volí: nechat ho zemřít, nebo
rozbít vlastní plán a krýt ho. *Inspirace: The Honor of the Queen.*

**Mise 9 — Obrana domácí soustavy** *(velká obrana, eskadra DN)*
Havenská ofenzíva. Plné využití hyperlimitu: útočník „přistane" 360 mil. km
od planety a hodiny se dopravuje dovnitř — hráč staví interceptní geometrii,
minová pole, LAC zálohy. Zvrat: druhý útočný sbor vystoupí z hyperu na
opačné straně soustavy — rozdělit stěnu, nebo obětovat vedlejší cíl?

**Mise 10 — Útok na Barnett** *(finále)*
Útok na opevněnou havenskou soustavu. Vícefázová mise: průzkum → potlačení
hlídek → průlom k planetě. Dva zvraty: (a) obránce zasel pole raketových
podů na předvídané ose útoku — salva tisíce raket, kterou musí hráč přežít
manévrem a geometrií, ne municí; (b) uprostřed útoku přijde politický
rozkaz zastavit ofenzívu — hráč volí mezi doslovným splněním (ústup pod
palbou) a duchem rozkazu (dokončit průlom = jediná bezpečná cesta ven).
Obě volby vedou k jinému, plnohodnotnému konci kampaně.

---

## 8. Technická architektura

### 8.1 Stack

- **TypeScript + Vite**, bez frameworku pro sim; UI klidně **React** jen
  pro panely (plot je vlastní canvas).
- **Rendering: Canvas 2D** — vektorová grafika, žádné assety, výkonově
  bohatě stačí (stovky objektů). WebGL/PixiJS až kdyby bylo třeba
  (tisíce raket v misi 10 — měřit, pak rozhodnout).
- **Simulace ve Web Workeru** — UI vlákno jen renderuje a posílá rozkazy;
  worker tiká fixním dt a při kompresi času dávkuje kroky. Zůstane
  60 fps UI i při 10 000× kompresi.
- **Deterministický sim**: fixní dt, seedovaný PRNG (mulberry32), žádný
  `Date.now()` v logice → replaye, testovatelnost, férový save/load
  (save = seed + log rozkazů, nebo snapshot stavu).
- **Data-driven obsah**: lodě, zbraně, mise v JSON/TS definicích —
  vyvažování bez zásahů do enginu, snadné modování.

### 8.2 Struktura kódu

```
src/
  sim/            # čistá logika, bez DOM — jednotkově testovatelná
    physics.ts    #   kinematika, integrace, intercept solver
    weapons.ts    #   rakety, energetika, obálky
    defense.ts    #   ECM → CM → PDLC → klín pipeline
    damage.ts     #   subsystémy, kaskády
    sensors.ts    #   kontakty, light-lag, EMCON
    ai/           #   taktická AI (viz níže)
    scenario.ts   #   načítání misí, triggery, zvraty
  data/           # lodě, zbraně, mise (JSON/TS)
  ui/             # plot (canvas), panely (React), input
  worker/         # most sim ↔ UI (postMessage, snapshoty)
```

### 8.3 Taktická AI

Neřešíme „chytrou" AI — řešíme **věrohodné doktríny** (skriptovaný stavový
automat nad stejnými nástroji, které má hráč):

- vyhodnocení geometrie (aspekt, obálky, čas do dostřelu),
- doktríny per frakce: Haven éry 1 = rigidní, drží stěnu, plýtvá municí;
  piráti = zbabělí, utíkají při poškození; RMN spojenci = agresivní,
- skriptované zvraty misí mají přednost před doktrínou (trigger systém:
  `když vzdálenost < X / čas > T / jednotka zničena → akce/zpráva/spawn`).

### 8.4 Testování

Sim bez DOM → **Vitest** jednotkové testy: intercept solver (známá řešení),
obálky raket (ruční výpočty z tabulky v kap. 2), obranná pipeline
(statistické testy na seedech), determinismus (2 běhy = identický stav).

---

## 9. Plán vývoje (MVP → plná hra)

**Fáze 0 — kinematické jádro** *(základ, ~1. milník)*
Sim smyčka ve workeru, float64 vektory, komprese času, canvas plot se
zoomem, jedna loď ovladatelná waypointy, intercept solver. *Hratelné demo:
„dožeň prchající kontakt" (= jádro mise 1).*

**Fáze 1 — rakety a obrana** *(2. milník)*
Rakety jako objekty, obálky, laserové hlavice, pipeline ECM→CM→PDLC→klín,
subsystémové poškození, rolování. *Demo: souboj DD vs. DD (= mise 3 bez
příběhu).* Tady se odehraje většina vyvažování.

**Fáze 2 — mise a scénáře** *(3. milník)*
Scenario/trigger systém, briefingy, senzorový model s light-lagem, EMCON,
mise 1–4 kompletní. První hratelná „epizoda".

**Fáze 3 — eskadry a kampaň** *(4. milník)*
Rozkazy více lodím, doktrínová AI, přenos stavu mezi misemi, mise 5–8.

**Fáze 4 — velké finále a lesk** *(5. milník)*
Výkon pro tisíce raket (mise 9–10), pody, zvukový design (alarmy, hlášení
můstku), oba konce, režim Simulace/Taktika, vyvážení celku.

Každá fáze končí něčím hratelným — kdykoli lze zastavit a mít funkční hru.

---

## 10. Rizika a vědomá zjednodušení

| Riziko / volba | Řešení |
|---|---|
| Plné 3D | **Ne.** 2D + abstrakce rolování (kap. 4.1). Největší úspora projektu. |
| Reálné trvání bitev (hodiny) | Komprese času s automatickými brzdami; mise navrhovat na 20–40 min čistého hraní. |
| Tisíce raket v pozdních misích | Determinismus + worker; při potížích agregace salv do „vln" (statistické řešení místo per-raketa) — pipeline z kap. 5 to umožňuje přepnout. |
| Světelné zpoždění mate hráče | Režim Taktika (asistence) vs. Simulace (puristé); vizualizace stáří dat. |
| Vyvažování obrany (vše prorazí / nic neprorazí) | Čísla z kap. 2 jako výchozí bod + statistické testy nad seedy; ladit „% průniku salvy" na 5–15 % jako v knihách. |
| Autorská práva | Neprodávat; jde o fanouškovský nekomerční projekt, nepoužívat text/obálky knih, jména vlastních postav omezit (kampaň s vlastním protagonistou ve Weberově světě). Pro případné zveřejnění zvážit přejmenování na „inspirováno". |
| Rozsah (10 misí je hodně) | Fázování — hra je hratelná od fáze 2 se 4 misemi. |

**Doporučené pořadí prací:** začít fází 0+1 (fyzika a souboj 1v1) a vyladit
*pocit* z raketové výměny — to je srdce hry. Mise a příběh stavět až na
prokazatelně zábavném jádru.

---

## 11. Zdroje

- [Honorverse Wiki — Impeller drive](https://honorverse.fandom.com/wiki/Impeller_drive)
- [Honorverse Wiki — Missile](https://honorverse.fandom.com/wiki/Missile)
- [Honorverse Wiki — Manticoran missile technology](https://honorverse.fandom.com/wiki/Manticoran_missile_technology)
- [Honorverse Wiki — Space Weapons Technology](https://honorverse.fandom.com/wiki/Space_Weapons_Technology)
- [Honorverse Wiki — Inertial compensator](https://honorverse.fandom.com/wiki/Inertial_compensator)
- [Honorverse Wiki — Technology in the Honorverse (Wikipedia content)](https://honorverse.fandom.com/wiki/Honorverse:Wikipedia_content/Technology_in_the_Honorverse)
- [Honorverse Wiki — Weapons technology (Wikipedia content)](https://honorverse.fandom.com/wiki/Honorverse:Wikipedia_content/Weapons_technology_in_the_Honorverse)
- [Honorverse Wiki — Spacecraft in the Honorverse (Wikipedia content)](https://honorverse.fandom.com/wiki/Honorverse:Wikipedia_content/Spacecraft_in_the_Honorverse)
- David Weber: přílohy a „infodumpy" v knihách *On Basilisk Station*,
  *The Honor of the Queen*, *The Short Victorious War* (éra, ze které hra vychází)
