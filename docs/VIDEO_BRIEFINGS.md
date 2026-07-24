# Plán: video briefingy misí

Cíl: každá kampaňová mise má vlastní **video briefing** přehrané na přípravné
obrazovce (`showMissionPrep`) místo statického obrázku scény. Dokud video
neexistuje, přehrávač spadne zpět na statickou scénu — hra funguje pořád.

## Jak to je zapojené (hotovo v kódu)

- **Mapa videí** `MISSION_VIDEOS` v `src/main.ts` (klíč = id mise → basename):
  `mission01 → brief-mission01`, … `mission11 → brief-mission11`.
- **Přehrávač** `briefingMedia(id)` v `src/main.ts`:
  - je-li v mapě video, vytvoří `<video class="brief-vid" autoplay muted playsinline>`
    se `src = vid/<basename>.mp4` a `poster = img/<scéna>.png`,
  - **fallback**: chyba načtení / nepřehratelné video → nahradí se statickou
    scénou (`MISSION_SCENES`), jako dosud,
  - autoplay je **ztlumený** (politika prohlížečů); zvuk lze doladit později
    (unmute tlačítko + gesto uživatele).
- Vloženo do přípravné obrazovky nad titul mise (`#prep-media`).

## Co dodat (assety)

Video soubory do `public/vid/` s názvy dle mapy:

```
public/vid/brief-mission01.mp4
public/vid/brief-mission02.mp4
…
public/vid/brief-mission11.mp4
```

### Doporučený formát
- **Kontejner/kodek:** MP4 (H.264 + AAC) — nejširší podpora; volitelně WebM
  (VP9) jako druhý `<source>` pro menší velikost.
- **Rozlišení:** 1280×540–720 (široký formát, ať sedí do rámu ~300 px výšky).
- **Délka:** 10–25 s (krátký naladovací sestřih, ne celá scéna).
- **Stopáž/velikost:** cílit < 3–5 MB/mise kvůli rychlému načtení a offline
  cache (service worker); delší/větší videa zvážit lazy-load.
- **Zvuk:** volitelný; autoplay běží ztlumeně, plný zvuk až po gestu.

## Možná rozšíření
- Druhý `<source>` WebM + MP4 pro velikost/kompatibilitu.
- Tlačítko „přeskočit / ztlumit / zvuk" nad videem.
- Titulky (`<track kind="captions">`) — hodí se i pro plánovanou lokalizaci
  do angličtiny.
- Přednačtení videa další mise při najetí na kartu mise.
- Cache videí v service workeru pro offline (dnes cachuje app shell).

## Generování videí (mimo kód)
Videa vzniknou externě (render/AI/sestřih). Prompty a styl scén jsou v
`docs/ART_PROMPTS.md`; video briefingy by měly navázat na stejnou vizuální
identitu (soumraková atmosféra, flotila, Honorverse trupy).
