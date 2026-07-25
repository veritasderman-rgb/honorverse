# Roztřídění nahrávek voiceoveru

Stav třídění nahrávek z 25. 7. Kanonická jména a texty viz `docs/VO_SCRIPT.md`.

## ✅ Zapojeno (jistá shoda stopáže s texty)

| Původní soubor | Nové jméno | Stopáž | Obsah |
| --- | --- | --- | --- |
| Prolog-cs.mp3 | `intro-cs.mp3` | 109 s | úvod kampaně (CS) |
| prolog-en.mp3 | `intro-en.mp3` | 151 s | úvod kampaně (EN) |
| prolog-en-01.mp3 | `mission01-prolog-en.mp3` | 23 s | mise 1 — prolog (EN) |
| epilog-en-01.mp3 | `mission01-epilog-en.mp3` | 16 s | mise 1 — epilog výhry (EN) |
| epiloglose-en-01.mp3 | `mission01-epiloglose-en.mp3` | 13 s | mise 1 — epilog porážky (EN) |

## ⏳ Čeká na určení — `assets-raw/vo/` (44 souborů)

U ElevenLabs exportů nejde z názvu poznat, který text namlouvají, a přiřazení
jen podle stopáže by riskovalo špatný voiceover u špatné mise. Soubory jsou
přesunuté do `assets-raw/vo/` (do hry se nebalí) a čekají na určení.

**Jak to dorazit (stačí jedno z toho):**

1. Napiš, v jakém pořadí jsi generoval (např. „šel jsem po řadě podle
   VO_SCRIPT: Chris = EN, Alberto = CS, od mise 2 dál") — přiřadím je podle
   pořadí a stopáží a přejmenuju za tebe.
2. Nebo soubory rovnou přejmenuj na kanonická jména z `VO_SCRIPT.md`
   (`mission02-prolog-cs.mp3` …) a přesuň do `public/audio/vo/` — hra je
   načte sama, žádná změna kódu.

Změřené stopáže (chronologicky; dvojice se stejným časem = duplicitní stažení):

| # | Čas generování | Hlas | Stopáž |
| --- | --- | --- | --- |
| 00 | 06:39:59 | Chris | 20 s |
| 01 | 06:40:26 | Chris | 13 s |
| 02 | 06:40:46 | Chris | 23 s |
| 03/04 | 06:40:58 (2×) | Chris | 23 s |
| 05 | 06:41:18 | Chris | 28 s |
| 06 | 06:42:06 | Chris | 18 s |
| 07 | 06:42:22 | Chris | 11 s |
| 08 | 06:42:58 | Chris | 21 s |
| 09 | 06:44:15 | Chris | 14 s |
| 10 | 06:45:04 | Alberto | 21 s |
| 11 | 06:45:35 | Alberto | 26 s |
| 12 | 06:45:49 | Alberto | 16 s |
| 13 | 06:46:03 | Alberto | 32 s |
| 14 | 06:46:55 | Alberto | 24 s |
| 15/16 | 06:47:06 (2×) | Alberto | 15 s |
| 17 | 06:48:41 | Alberto | 27 s |
| 18 | 06:48:57 | Alberto | 25 s |
| 19/20 | 06:49:58 (2×) | Alberto | 15 s |
| 21 | 06:50:17 | Alberto | 49 s |
| 22 | 06:50:31 | Alberto | 32 s |
| 23 | 06:50:49 | Alberto | 22 s |
| 24 | 06:52:08 | Alberto | 43 s |
| 25 | 06:52:19 | Alberto | 11 s |
| 26 | 06:52:33 | Alberto | 18 s |
| 27 | 06:53:03 | Alberto | 30 s |
| 28 | 06:53:18 | Alberto | 33 s |
| 29 | 06:53:35 | Alberto | 34 s |
| 30 | 06:53:52 | Alberto | 42 s |
| 31 | 06:54:07 | Alberto | 36 s |
| 32 | 06:54:18 | Alberto | 30 s |
| 33/34 | 06:54:29 (2×) | Alberto | 20 s |
| 35 | 06:54:56 | Alberto | 18 s |
| 36 | 06:55:09 | Alberto | 12 s |
| 37 | 06:55:21 | Alberto | 17 s |
| 38 | 06:55:35 | Alberto | 21 s |
| 39 | 06:55:51 | Alberto | 15 s |
| 40 | 06:56:03 | Alberto | 18 s |
| 41 | 06:56:12 | Alberto | 18 s |
| 42 | 06:56:21 | Alberto | 10 s |
| 43 | 06:56:35 | Alberto | 8 s |

Pozn.: odhady stopáží jednotlivých textů jsou v tabulce `VO_SCRIPT.md`
(u zapojených souborů seděly na ±3 s).

## Videa a obrázky (hotovo)

- `vid/admiral.mp4` — mluvící admirál, ve briefingu jako SMYČKA BEZ ZVUKU
  (hlas dodává voiceover); verze s originálním zvukem je
  v `assets-raw/vid/admiral-with-sound.mp4`.
- `vid/brief-mission02.mp4`, `vid/brief-mission06.mp4` — letící lodě jako
  video briefingy misí 2 a 6.
- 11 příběhových obrázků přejmenováno na `img/scene-*.png` a rozděleno:
  každá mise kampaně má vlastní scénu (viz `MISSION_SCENES` v `src/main.ts`);
  bitevní křižník / superdreadnought / loděnice slouží zároveň jako detailní
  ilustrace tříd BC / DN / stanice v panelu cíle (`SHIP_IMAGES`).
