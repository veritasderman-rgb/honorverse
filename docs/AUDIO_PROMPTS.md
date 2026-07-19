# Hudba pro Wall of Battle — prompty pro Suno.ai

Hra má **adaptivní hudbu**: sleduje stav boje a plynule prolíná mezi vrstvami
klid → napětí → boj. Stačí vygenerovat skladby v Sunu, stáhnout MP3 a uložit
do `public/audio/` pod přesnými názvy níže. Chybějící soubor = ticho (nic se
nerozbije). Zvukové efekty (odpaly, zásahy, komunikace) hra syntetizuje sama —
ty generovat nemusíš.

## Jak v Sunu postupovat

1. Použij **Custom mode**.
2. Do pole **Lyrics** dej jen `[Instrumental]` — žádný zpěv.
3. Do pole **Style of Music** vlož prompt z tabulky.
4. Vygeneruj 2× a vyber lepší variantu; stáhni jako MP3.
5. Skladby se ve hře **smyčkují** — ideální je verze bez velkého intra/outra.
   (Pokud má skladba dlouhý nástup, v Sunu použij „Extend" z vhodného místa,
   nebo prostě nech — hra prolíná pozvolna, drobný šev nevadí.)

## Skladby (ulož jako `public/audio/<název>.mp3`)

| Soubor | Kdy hraje | Prompt pro Suno (Style of Music) |
|---|---|---|
| `music-menu.mp3` | menu a briefing | Majestic slow orchestral space anthem, noble french horns over deep sustained strings, quiet choir pad, sense of duty and vast distances, cinematic, restrained, 60 BPM, instrumental |
| `music-cruise.mp3` | klidná plavba, žádná hrozba | Calm ambient space drone, warm analog pads, sparse delicate piano notes, faint radio static texture, weightless and patient, meditative, very slow, instrumental |
| `music-tension.mp3` | nepřátelský kontakt na senzorech | Dark suspenseful sci-fi underscore, low pulsing strings, slow ticking percussion like a countdown, subtle rising dissonance, submarine-thriller tension, 80 BPM, instrumental |
| `music-combat.mp3` | letí rakety / boj | Driving hybrid orchestral battle music, pounding taiko and snare ostinato, urgent staccato strings, dark brass stabs, relentless forward motion, naval warfare in space, 120 BPM, instrumental |
| `music-critical.mp3` | těžké poškození, boj zblízka | Intense chaotic orchestral climax, dissonant brass clusters, frantic string runs, massive percussion hits, alarms-like high strings, desperate last stand, 140 BPM, instrumental |
| `music-victory.mp3` | vítězství (jednorázově) | Triumphant but weary orchestral resolution, solo horn theme swelling into full strings, relief after battle, bittersweet undertone, short cinematic outro piece, instrumental |
| `music-defeat.mp3` | porážka (jednorázově) | Somber funeral elegy, low cello and sparse piano, distant fading radio static, mourning and silence of space, very slow, short cinematic outro piece, instrumental |

Tip pro jednotný zvuk: generuj vše v jedné session a do každého promptu můžeš
přidat společný dovětek `cohesive score for a space navy strategy game`.

## Zvukové efekty — NEgenerovat, jsou v kódu

Syntetizuje je přímo hra (WebAudio): odpal salvy, příchozí salva (klakson),
zásah vlastní/nepřátelské lodi, sestřelená raketa, energetická palba,
příchozí komunikace, potvrzení rozkazu. Hlasitost hudby a efektů se ovládá
zvlášť v topbaru; zvuk se aktivuje prvním kliknutím (autoplay politika
prohlížečů).
