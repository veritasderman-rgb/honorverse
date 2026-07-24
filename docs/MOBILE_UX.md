# Plán: hratelnost na telefonu (mobilní UX)

Cíl: udělat hru **skutečně hratelnou na telefonu**, ne jen „zmenšený desktop".
Malá obrazovka nesnese dlouhé textové popisky — nahradit je **infografikou
(ikony + měřidla)** a postavit **samostatnou mobilní vrstvu UX**, která se
aktivuje jen na telefonu; tablet/desktop zůstávají beze změny.

Princip: **sdílená logika, jiná prezentace.** Simulace, controller a plot se
nesmí větvit — jen HUD/rozvržení a vstup mají mobilní variantu.

---

## 1. Kde jsme (současný stav)

- Breakpointy `@media (pointer: coarse) and (max-width: 900px)` +
  `orientation: portrait`.
- Výsuvné **šuplíky** HUD (`◧/◨`), jeden otevřený po druhém.
- **Pinch-zoom** a tažení plotu (pointer handlery canvasu).
- **Výzva k otočení** na výšku, haptika (`navigator.vibrate`), redukce hustoty
  hvězd na `pointer: coarse`, bez CRT overlaye.
- Režim **hromadného výběru** (tap = toggle, tažení = box) místo Shiftu.

**Problém:** HUD je pořád textový (panely s řádky „název: hodnota", 12
subsystémů jako popsané pruhy, lišta rozkazů s textovými tlačítky, tooltipy).
Na telefonu je to husté, drobné a špatně se do toho míří palcem.

## 2. Cíle a principy

1. **Ikony první, text minimum.** Řádek „trup: 87 %" → prstencové měřidlo.
   „boční štít LB 100 %" → ikona štítu s výsečí. 12 subsystémů → mřížka
   barevných pipů (zelená/jantar/červená), ne 12 popsaných pruhů.
2. **Progresivní odhalování.** Ve výchozím stavu 5–6 klíčových signálů; detail
   až na dotek (tap/long-press → popover). Nic zbytečného trvale na obrazovce.
3. **Palcové zóny.** Primární akce dolů do dosahu palců (spodní lišta /
   radiální menu), ne drobná tlačítka nahoře. Minimální dotyková plocha 44 px.
4. **Gesta první.** pinch = zoom, tažení = pan, tap = výběr, **long-press =
   kontextové menu** cíle/lodi, dvojtap = recenter. Rozkazy přes gesta +
   velká ikonová tlačítka, ne textové seznamy.
5. **Jeden panel v čase.** Šuplíky zůstávají, ale jako **ikonové dashboardy**,
   ne textové sloupce.
6. **Landscape-first.** Taktický displej potřebuje šířku — výzvu k otočení
   zachovat, ale zbytek UI navrhnout pro šířku telefonu (např. 844×390).

## 3. Detekce a aktivace mobilní vrstvy

- **Telefon** = `matchMedia('(pointer: coarse)')` **a** krátká strana
  viewportu < ~430 px (odliší telefon od tabletu). Nastaví `body.phone`.
- Mobilní HUD je **samostatný render** (nový modul `src/ui/mobileHud.ts`),
  který se zapne jen pro `phone`; desktop/tablet dál používají `panels.ts`.
- **Ruční přepínač** (jako ◈ 3D / 📺 CRT): „🖐 mobilní UI" pro test a pro
  hráče na velkém telefonu/tabletu, kdo chce kompaktní režim. Persist v
  localStorage.

## 4. Infografika místo textu (mapování)

| Dnes (text) | Mobil (infografika) |
|---|---|
| Panel vlastní lodi (trup, tah, klín, senzory, 12 subsystémů) | **Stavový prstenec**: střed = trup %, vnější oblouk = tah, ikony klín/EMCON, kolem mřížka pipů subsystémů; tap → detail |
| Zásoby (rakety/CM/návnady/plošiny) | Řada **ikon se zásobníky** (raketa ×N, štít ×N…), barevně nízký stav |
| Kontakty (textový seznam) | **Ikonové karty**: barva hrozby + silueta třídy + dosah (číslo) + šipka přibližování; tap = cíl, long-press = detail |
| Lišta rozkazů (Salva/Klín/Návnada/doktríny) | **Radiální / segmentové ikonové menu** ve spodní palcové zóně: skupiny pohyb / palba / obrana; „…" rozbalí víc |
| Bojová statistika / after-action | **Mini-grafy** (proužky) místo řádků |
| Telegraf záměru (⟳ ⚠ ⇗ ◎) | Beze změny — už je to ikonografie (ideál pro mobil) |

Kde text musí zůstat (jména lodí, čísla dosahu), držet **krátké** a velké.

## 5. Architektura

```
sim / worker / controller     ← beze změny (sdílené)
plot (TacticalPlot)           ← beze změny (canvas, gesta už má)
panels.ts (desktop/tablet HUD) ← beze změny
── nově ──
mobileHud.ts                  ← kompaktní ikonový HUD (jen body.phone)
mobileOrders.ts               ← radiální/segmentové rozkazy (palcová zóna)
ikony: inline SVG / canvas overlay (bez závislostí)
```

- `main.ts` podle detekce zapne buď `Panels`, nebo `MobileHud` (oba čtou
  stejný snapshot a volají stejné `controller.handleAction`).
- Rozkazy zůstávají stejné `PanelAction` — mění se jen jak je hráč vyvolá.
- Ikony jako **inline SVG** (ostré, malé, bez assetů) nebo dokreslené na
  canvas plotu (stavový prstenec kolem vybrané lodi přímo na mapě).

## 6. Fáze a odhad

| Fáze | Obsah | Odhad |
|---|---|---|
| M0 | Detekce `phone`, ruční přepínač, kostra `mobileHud` (přebírá snapshoty) | ~0,5 d |
| M1 | **Stavový prstenec vlastní lodi** (trup/tah/klín/EMCON + pipy subsystémů) | ~1 d |
| M2 | **Ikonové karty kontaktů** + tap/long-press cíl | ~1 d |
| M3 | **Radiální lišta rozkazů** v palcové zóně (pohyb/palba/obrana) | ~1–1,5 d |
| M4 | Zásoby/statistika jako měřidla; doladění palcových zón, haptiky | ~0,5 d |
| M5 | Test (rozšířit `scripts/mobile-smoke.mjs` o telefonní layout) + ladění | průběžně |

Doporučené pořadí: **M0 → M1 → M3 → M2 → M4** (nejdřív ať vidím loď a umím
rozkazovat palcem, pak kontakty, pak kosmetika).

## 7. Testování

- Rozšířit `scripts/mobile-smoke.mjs`: telefonní viewport (390×844 i
  844×390), ověřit `body.phone`, existenci stavového prstence, dosažitelnost
  rozkazů v palcové zóně, funkční tap/long-press na kontakt.
- Vizuální screenshoty telefonního HUD do `scripts/out/`.

## 8. Synergie s lokalizací do angličtiny

Infografika **snižuje potřebu překladu** — ikony a měřidla jsou nezávislé na
jazyce. Ideál: nejdřív mobilní ikonový HUD (M1–M3), pak dopřeložit zbytek
textu; hodně popisků z mobilu úplně zmizí, takže se nemusí překládat.

## 9. Rizika

- **Nevětvit logiku** — jen prezentace. Kdyby se mobilní HUD rozešel s
  controllerem, dvojí údržba. Držet jediný `PanelAction` a snapshot.
- **Objevitelnost gest** — long-press/radiální menu potřebují nenápadný
  onboarding (první dotek ukáže nápovědu, jednou za instalaci).
- **Výkon** — ikony jako SVG/canvas jsou levné; stavový prstenec kreslit v
  rámci plotu, ne stovky DOM uzlů.
