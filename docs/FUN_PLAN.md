# Plán zábavnosti — „hráč rozhoduje o výsledku"

Cíl: aby hráč měl **pocit zásadního vlivu na výsledek**. Systémy pro agency
už z velké části existují (doktríny palby, EW, rolování, správa salv, EMCON,
boční štíty, senzory, formace, kampaňové flagy, skóre). Tenhle plán je o tom
dát jejich dopadu **volbu** a **čitelnost** — a přidat pár nových páky.

Design pilíř každé funkce: *rozhodnutí hráče → viditelný následek → pocit
„to jsem zařídil já".*

Omezení (jako u zbytku hry): canvas 2D, žádné závislosti, **simulace zůstává
deterministická** (efekty a UI z render hodin, ne ze sim RNG); mobil první.

---

## A. Dramatické taktické páky během boje (nejvyšší priorita)

### A1. Sesazená alfa-salva („srovnat tuby") ⭐
Hráč může **držet palbu** a naskládat několik po sobě odpálených salv do
jedné synchronizované vlny, která dorazí na cíl naráz a **zahltí obranu**.
- *Proč:* nejikoničtější Honorverse taktika; velké riziko (mezitím schytáváš,
  vyprázdníš zásobník) vs. velká odměna (proražení stěny CM/PDLC).
- *Staví na:* salvo systém + `drawSalvoMarkers` (počty už kreslíme).
- *Mechanika:* rozkaz „nabíjet / držet", indikátor „nachystáno N tub",
  odpal spustí synchronizované dolety (koordinace zásahového času).
- *Odhad:* ~1–1,5 dne (sim: koordinace doletu; UI: tlačítko + indikátor).

### A2. EW gambity jako aktivní schopnosti
Návnady a rušičky jako **aktivní tlačítka s cooldownem**, ne pasivní čísla.
- *Proč:* dobře načasovaná návnada, co zláme zámek a zachrání loď, je
  nezapomenutelný moment vlivu.
- *Staví na:* `decoyCount`, `ecm` v defs; obranná logika `defense.ts`.
- *Mechanika:* „vypustit návnadu" (spotřebuje 1 z decoyCount, na pár s zvýší
  šanci ztráty zámku salv mířících na loď), „přetížit rušičku" (krátký silný
  ECM puls, pak cooldown).
- *Odhad:* ~1 den.

### A3. Fokus palby — zvýraznění a zpětná vazba
Mechanika už existuje: rozkaz **Soustředit** (`fleetFocus` v `input.ts`)
přiřadí všem vybraným lodím `targetId` hráče. Chybí ale **čitelnost**, aby
byl efekt „vidět" — což je jádro pocitu vlivu:
- sbíhající se palebné linie / společný zaměřovací kroužek na cíli,
- indikátor „soustředí se N lodí na TENTO cíl" + jeho klesající trup,
- varování, když soustředěná palba mrhá (cíl už mrtvý / mimo dosah).
- *Staví na:* existující `fleetFocus` + `selectedSalvoId` zvýraznění.
- *Odhad:* ~0,5 dne (jen prezentace, mechanika hotová).

### A4. Manévrové odměny (crossing the T, ambush, útěk)
- **Crossing the T** — bonus přesnosti/průniku, když křížíš kurz nepřítele
  (geometrii aspektu už počítáme).
- **Senzorový stín** — ambush z pole asteroidů (kontakty v poli mají horší
  idQuality — částečně plánováno v GFX fázi B).
- **Okno útěku** — dramatický odpočet k hyperlimitu (mise 4/6 už mají útěk).
- *Odhad:* ~1 den souhrnně.

---

## B. Rozhodnutí před bojem (agency začíná v briefingu)

### B1. Loadout raket a lodi
Volba mixu před misí: LO (dosah) / HI (průraz) / EW-decoy plošiny; hloubka
zásobníku vs. tažené plošiny; poměr štíty ↔ útok.
- *Proč:* hráč ladí nástroj na misi → výsledek je „jeho stavba".
- *Staví na:* `MissileDef`, magazíny, `podCapacity` v defs.
- *Odhad:* ~1 den (UI výběru + propsání do scénáře).

### B2. Sestava a výchozí postoj
Které lodě nasadit, formace (Stěna/Šíp/Rozptyl už jsou) a **postoj**
(agresivní / obranný / stealth-EMCON) jako „bitevní plán".
- *Proč:* plán, který se pak odehraje, = pocit velení.
- *Odhad:* ~1 den.

---

## C. Trvalé následky (kampaň = váha rozhodnutí)

### C1. Přetrvávající lodě a posádky ⭐
Pojmenované lodě si nesou mezi misemi **poškození** a **zkušenost**
(veterán = těsnější salvy, rychlejší obrana). Ztráta lodi bolí trvale.
- *Proč:* vazba a stakes; každé rozhodnutí má váhu napříč kampaní.
- *Staví na:* kampaňové flagy + skóre; nový perzistentní stav flotily
  (localStorage) mezi misemi.
- *Odhad:* ~1,5–2 dny.

### C2. Větvení podle způsobu vítězství
*Jak* vyhraješ mění další misi (ušetřit vs. zničit, ubránit stanici vs.
tlačit útok). Flagy pro epilog už existují — rozšířit na dopad do dalších misí.
- *Odhad:* ~1 den + obsah per větev.

### C3. Mezimisní rozhodnutí (oprava / posílení / zdroje)
Omezené zdroje: opravit poškozené lodě, doplnit rakety, povolat posily.
- *Proč:* strategická vrstva nad taktikou; volba s následkem.
- *Odhad:* ~1–1,5 dne.

---

## D. Čitelnost — aby byl vliv CÍTIT (levné, velký efekt)

### D1. After-action report „proč jsi vyhrál/prohrál" ⭐
Po misi rozpad: vypálené vs. proniklé salvy, účinnost obrany (CM/PDLC/klín),
ztráty, a **zvýrazněný rozhodující moment** (kdy se battle zlomila).
- *Proč:* udělá z výsledku **příběh tvých rozhodnutí** — jádro „mám vliv".
- *Staví na:* `combatStats`, `scoreMission` (data už sbíráme).
- *Odhad:* ~0,5–1 den (jen prezentace nad existujícími daty).

### D2. Telegrafování záměru nepřítele
Ukázat, co nepřítel dělá: *roluje, skládá salvu, prchá k hyperlimitu,
zapíná aktivní senzory*. Tvůj protikrok je pak „zasloužený".
- *Odhad:* ~0,5 dne (odvození z existujícího stavu + hlášky/ikony).

### D3. Indikátor převahy / tide bitvy
Jemný ukazatel „jak si stojím" (poměr bojové síly, zásobníků, obrany), ať
hráč vidí, jak jeho tahy houpou výsledek.
- *Odhad:* ~0,5 dne.

### D4. Lepší zpětná vazba zásahů (už rozpracováno v GFX)
Otřesy, pulsy, značky salv, bloom — pokračovat: barevné odlišení typů salv
(LO/HI/plošiny), viditelná protiraketová clona.
- *Odhad:* průběžně.

---

## E. Rozmanitost a znovuhratelnost

### E1. Skirmish / sandbox + stavitel bitvy ⭐
Volné bitvy: vyber lodě obou stran, doktríny, mapu — a hraj. Pro systémovou
hru obrovská hodnota (experiment, „co kdyby").
- *Proč:* prodlužuje životnost mimo kampaň; testuje vlastní taktiky.
- *Odhad:* ~1,5 dne (výběrové UI + generátor scénáře, engine už umí).

### E2. Volitelné podmínky výzvy (skóre)
Bez ztrát / do času / jen EMCON / v přesile — modifikátory pro leaderboard.
- *Staví na:* skóre + žebříček (už jsou).
- *Odhad:* ~0,5 dne.

### E3. Náhodné doktríny / traity velitele
Nepřítel mění chování (opatrný / agresivní / raketový spammer); volitelný
trait hráče (např. rychlejší nabíjení vs. lepší obrana).
- *Odhad:* ~1 den.

### E4. Denní výzva / seed
Jedna sdílená náhodná bitva denně na žebříček (deterministický seed z data).
- *Odhad:* ~0,5 dne (seed už řídí sim).

---

## F. UX, které podporuje agency

- **Rychlé rozkazy / hotkeys a radiální menu** na mobilu — méně tření mezi
  záměrem a akcí.
- **Pauza s rozkazy** (aktivní pauza) — přemýšlej a zadávej v klidu; komprese
  0× už existuje, doladit zadávání za pauzy.
- **Undo/potvrzení nevratných voleb** (útěk, kapitulace).
- **Onboarding taktik** — tutoriály na alfa-salvu, EW, rolování (mise 1–4 už
  učí základ; rozšířit o pokročilé triky).

---

## Priorita a doporučené pořadí

| # | Funkce | Pilíř | Efekt | Odhad |
|---|---|---|---|---|
| A1 | Sesazená alfa-salva | páka v boji | ⭐⭐⭐ | 1–1,5 d |
| D1 | After-action „proč" | čitelnost | ⭐⭐⭐ | 0,5–1 d |
| A2 | EW gambity | páka v boji | ⭐⭐ | 1 d |
| E1 | Skirmish / sandbox | znovuhratelnost | ⭐⭐⭐ | 1,5 d |
| C1 | Přetrvávající flotila | stakes | ⭐⭐⭐ | 1,5–2 d |
| B1 | Loadout před misí | agency před bojem | ⭐⭐ | 1 d |
| A3 | Fokus palby — zvýraznění (mechanika hotová) | čitelnost | ⭐⭐ | 0,5 d |
| D2 | Telegrafování záměru | čitelnost | ⭐⭐ | 0,5 d |

**Doporučený start:** **A1 (alfa-salva) + D1 (after-action)** — spolu dají
velkou *volenou* taktickou páku a zpětnou vazbu, že výsledek způsobil hráč.
Obojí staví na tom, co ve hře už je (salvy + `combatStats`), takže rychlá
cesta k „mám zásadní vliv". Pak **E1 (sandbox)** pro životnost a **C1
(flotila)** pro dlouhodobé stakes.

Každá funkce je samostatně nasaditelná a testovatelná; taktické páky by měly
mít smoke/statistický test (jako `combat.test.ts`), aby balanc držel.
