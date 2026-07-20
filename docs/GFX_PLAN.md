# Plán grafického upgradu — „zaplněný vesmír"

Cíl: zůstat u 2D vektorového CIC stylu (zelený fosfor, čitelnost především),
ale dát mu hloubku, život a bojovou zpětnou vazbu. Vše canvas 2D, žádné
závislosti; **vizuální vrstva nesmí sahat na simulaci** (determinismus) —
efekty se odvozují z eventů a render hodin, ne ze sim RNG.

---

## Fáze A — lodě a střely (největší efekt na pocit)

**Ikony lodí per třída.** Dnes jeden obrys dle hullCode; nově detailní
vektorové siluety: DD úzká jehla, CL štíhlý trup s masty, CA hranatá
pevnost, BC dlouhý klín s předsunutou přídí, DN masivní blok, MERCH
kontejnerová housenka, stanice prstenec, planeta kotouč s terminátorem.
K tomu stavové vrstvy:
- **klín**: dva oblouky nad/pod trupem dle headingu — jas roste s tahem,
  zhasnuté = EMCON (informace, která dnes chybí na první pohled),
- **pohonná záře** za zádí při akceleraci (délka dle tahu, červená při 120 %),
- **poškození**: blikání siluety pod 50 % trupu, jiskřící trhliny pod 25 %,
- kapitulace: bílá vlajka ▽ (už je), + zhasnutý klín.

**Střely s životem.** Boost = kapka s plamenem (animovaný, 2–3 snímky),
balistika = tečka s dohasínající stopou, terminál = jasný záblesk vektoru.
Salva dostane jemné společné halo, ať jde na plotu číst jako JEDNA vlna.

**Neviditelný boj zviditelnit.** Dnes obrana probíhá „potichu" v číslech:
- odpaly protiraket: krátká jiskra od lodi k raketě + tichý flash při zásahu,
- PDLC: tenké laserové čáry v terminální fázi (150 ms),
- detonace laserové hlavice: rentgenový „ježek" paprsků ve standoff bodě,
- zásah do trupu: expandující prstenec + jiskry z boku lodi,
- zničení: exploze s troskami — a **vrak zůstane na mapě** jako šedý
  kříž/pole trosek (ladí s paměťovými piny senzorů).

## Fáze B — prostředí („vesmír nemá být prázdný")

- **Hvězdné pozadí**: 2–3 paralaxní vrstvy teček (deterministicky ze seedu
  mise), jemný barevný nádech mlhoviny per soustava — každá mise dostane
  vlastní „atmosféru" (Cádiz načervenalý, Křižovatka chladně modrá…).
- **Planeta v dáli**: velký gradientní kotouč s terminátorem a tenkým
  prstencem atmosféry; už existuje třída `planet` — doplnit do map misí
  1, 5, 9 (domovské soustavy je mají mít).
- **Pole asteroidů**: pás pomalu driftujících skvrn (kosmetika, vrstva
  plotu). Volitelná druhá etapa s gameplayem: senzorový stín (kontakty
  v poli mají horší idQuality) — jednoduché a tematické.
- **Civilní provoz**: 2–3 neutrální obchodníci na obchodních trasách
  (doctrine buoy/freighter s nav trasou) v misích u stanic a Křižovatky —
  svět žije i mimo bitvu; v misi 1 zapadá do celní služby.
- **Sondy a majáky**: blikající navigační bóje (už jsou — přidat puls),
  občasná meteosonda s slabým transpondérem (nový classId `probe`,
  statická drobnost do map).

## Fáze C — pocit z boje (šťáva)

- jemný **otřes obrazu** při zásahu do vlastní lodi (2–3 px, 200 ms),
- záblesk okraje obrazovky při těžkém zásahu (červený vignette puls),
- **hyperpřechod**: aurora záblesk při útěku za hyperlimit (výhra misí 4/6),
- stopa dohasínajícího fosforu za pohybujícími se kontakty (CRT dojem),
- volitelný **CRT overlay** (scanlines + vinětace, přepínač v topbaru,
  default vypnuto na mobilu — výkon).

## Fáze D — technika a výkon

- hvězdné pozadí a mlhovina do **offscreen canvasu** (kreslí se jednou
  na zoom level, ne každý frame),
- efekty v poolu s tvrdým stropem (např. 200 živých efektů, FIFO),
- animace řízené render časem (`performance.now()`), NIKDY sim stavem —
  determinismus a JSON-identita snapshotů zůstávají nedotčené,
- mobil: poloviční hustota hvězd, bez CRT overlay, efekty zkrácené.

## Odhad a pořadí

| Fáze | Obsah | Odhad |
|---|---|---|
| A | siluety lodí, klín/pohon/poškození, střely, viditelná obrana, vraky | ~1 den |
| B | hvězdy + mlhovina, planety do misí, asteroidy, civilní provoz, sondy | ~1 den |
| C | otřesy, záblesky, hyperpřechod, fosforové stopy, CRT přepínač | ~½ dne |
| D | offscreen cache, efektový pool, mobilní úspory | průběžně s A–C |

Doporučené pořadí: **A → C → B** (nejdřív ať boj „mluví", pak šťáva,
pak svět) — nebo A a B prohodit, jestli chceš dřív atmosféru než efekty.
Každá fáze je samostatně nasaditelná a krytá smoke screenshoty.
