# Prompty pro generování grafiky (ChatGPT / DALL·E, Midjourney…)

Hra načítá obrázky z `public/img/` podle pevných názvů souborů (viz tabulka).
Vygeneruj obrázek, ulož ho pod daným názvem (PNG, ideálně čtverec 512×512
u portrétů) do `public/img/` a hra ho automaticky použije v komunikačním
panelu. Když obrázek chybí, zobrazí se textový zástupný symbol — nic se nerozbije.

## Společný styl (přidej ke KAŽDÉMU promptu)

> Painted retro-futuristic military sci-fi portrait, muted colors with green
> and amber phosphor accents, dark background suggesting a dim warship bridge
> with faint holographic displays, consistent art style across a series,
> serious tone, no text, no watermark, square composition.

Tip: generuj celou sadu v jedné konverzaci a odkazuj se na „same art style
as previous image" — udržíš jednotný vzhled.

## Postavy (portréty do komunikačního panelu)

| Soubor | Role | Prompt (přidej společný styl) |
|---|---|---|
| `img/captain.png` | hráčův kapitán | Portrait of a composed starship captain in a black-and-gold royal navy uniform, short hair, calm determined expression, командный presence, mid-30s |
| `img/xo.png` | první důstojník | Portrait of a sharp-eyed executive officer in the same black-and-gold navy uniform, tablet in hand, slightly skeptical expression |
| `img/engineer.png` | palubní inženýr | Portrait of a weary but confident ship's engineer in a stained utility jumpsuit, rolled-up sleeves, tool harness, backdrop of glowing reactor conduits |
| `img/tactical.png` | taktický důstojník | Portrait of a young intense tactical officer with a targeting monocle HUD over one eye, amber holographic fire-control displays reflected on face |
| `img/comms.png` | spojařka/spojař | Portrait of a communications officer wearing a slim headset, hand raised to earpiece, listening intently, green waveform displays behind |
| `img/enemy-captain.png` | direktoriátní kapitán | Portrait of a stern enemy warship commander in a grey high-collared uniform with red state insignia, cold expression, harsh white lighting |
| `img/pirate.png` | pirátský vůdce | Portrait of a scarred pirate leader in mismatched armored clothing, smug grin, cluttered dim cockpit background |
| `img/station.png` | velitel stanice | Portrait of an older station controller in civilian-military attire, orbital station control room with large windows behind |
| `img/governor.png` | planetární guvernér(ka) | Portrait of a dignified planetary governor in formal civilian dress with a subtle sash of office, government office backdrop |

## Lodě (ilustrace pro briefing / detail kontaktu, 16:9 nebo 4:3)

Společný styl lodí:
> Retro-futuristic hard sci-fi warship, hammerhead prow, long slab-sided hull
> with broadside missile hatches, glowing impeller rings fore and aft, flat
> wedge-shaped gravity distortion faintly visible above and below the hull,
> deep space background with distant star, painted style, no text.

| Soubor | Prompt (přidej společný styl lodí) |
|---|---|
| `img/ship-dd.png` | Small fast destroyer, sleek narrow hull, three visible missile hatches per side, running lights, escort posture |
| `img/ship-cl.png` | Light cruiser, mid-sized elegant hull, five broadside hatches, sensor masts |
| `img/ship-ca.png` | Heavy cruiser, muscular armored hull, eight broadside hatches, heavier turrets |
| `img/ship-merch.png` | Massive boxy cargo freighter, container racks along the spine, weak single engine glow, civilian markings |
| `img/ship-qship.png` | Cargo freighter with hidden weapon bays swinging open mid-transformation, missile pods emerging from container stacks, menacing reveal |
| `img/ship-courier.png` | Tiny sleek dispatch boat, mostly engine, minimal hull, built for pure speed |

## Scény (mezititulky misí, událost)

| Soubor | Prompt |
|---|---|
| `img/scene-convoy.png` | Convoy of four huge freighters in loose formation escorted by a small destroyer, seen from behind the escort, deep space, painted hard sci-fi style, green-amber accents, no text |
| `img/scene-battle.png` | Long-range missile exchange between two warships millions of kilometers apart, tiny drive flares of missile salvos crossing black space, laser point-defense flickering, painted style, no text |
| `img/scene-station.png` | Orbital trade station above a blue-green planet, docking arms, navigation lights, small courier ship departing, painted hard sci-fi style, no text |
| `img/scene-hyperwave.png` | Warship vanishing into hyperspace at the system hyper limit, space folding into aurora-like sheets around the hull, painted style, no text |

## Poznámky

- **Formát:** PNG; portréty čtverec (512–1024 px), lodě/scény 16:9.
- **Konzistence:** stejná konverzace + „same art style"; případně vygeneruj
  nejdřív kapitána a u dalších pište „matching the style of this portrait".
- **Práva:** vlastní vygenerovaná grafika, žádné odkazy na existující IP —
  v promptech se nikde nezmiňuje předloha, jen obecná „hard sci-fi" estetika.
