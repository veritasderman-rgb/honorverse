# Roztřídění nahrávek voiceoveru

Kanonická jména a texty viz `docs/VO_SCRIPT.md`.

## Stav

- **Angličtina: KOMPLETNÍ (48/48).** Všechny prology, epilogy (výhra/porážka),
  tři konce mise 10 i obecná porážka jsou nahrané pod kanonickými jmény
  v `public/audio/vo/` a stopáže sedí na odhady scénáře (±3 s). Hra je
  načítá automaticky.
- **Čeština: jen úvod kampaně** (`intro-cs.mp3`, 109 s). Zbytek CS mutace
  je otevřený — až budou nahrávky, stačí je pojmenovat dle `VO_SCRIPT.md`
  (`mission01-prolog-cs.mp3` …) a vložit do `public/audio/vo/`.
- Původní neroztříděné ElevenLabs exporty byly duplicitou finální EN sady
  a byly smazány (`assets-raw/vo/`); záloha admirála s původním zvukem
  zůstává v `assets-raw/vid/admiral-with-sound.mp4`.

## Videa a obrázky

- `vid/admiral.mp4` — mluvící admirál, v briefingu jako SMYČKA BEZ ZVUKU
  (hlas dodává voiceover).
- `vid/brief-mission02.mp4`, `vid/brief-mission06.mp4` — video briefingy.
- Příběhové obrázky `img/scene-*.png`: každá mise kampaně má vlastní scénu
  (`MISSION_SCENES` v `src/main.ts`); bitevní křižník / superdreadnought /
  loděnice slouží i jako ilustrace tříd BC / DN / stanice (`SHIP_IMAGES`).
