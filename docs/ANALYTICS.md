# Herní analytika

Anonymní telemetrie do Supabase (projekt **wall-of-battle**, tabulka
`wob_events`). Cíl: vidět, co ve hře funguje — kde hráči vypadávají,
které mise jsou moc těžké, jestli tutoriál drží a co se reálně používá.

## Co se sbírá (a co ne)

- **Žádné PII.** Náhodné id hráče (`localStorage wob-pid`) + id sezení
  (per načtení stránky). Žádný e-mail, jméno, IP se neukládá do tabulky.
- Sbírá se **jen v produkčním buildu**. Vypnutí: `localStorage
  wob-analytics = '0'`; vynucení i ve vývoji: `'1'`.
- Klient smí přes RLS **jen INSERT** — publishable klíč data nikdy nepřečte.
- Události se dávkují (~8 s) a při odchodu ze stránky odchází přes
  `sendBeacon`; offline se zahazují (hra nikdy nečeká na síť).

## Události

| event | props | kdy |
| --- | --- | --- |
| `app_start` | — | načtení hry (device/lang v samostatných sloupcích) |
| `mission_start` | `loadout` | start mise/skirmishe |
| `mission_end` | `win, t, score, launched, hits, own_losses` | obrazovka výsledku |
| `tutorial_step` | `step` | dosažení kroku výcviku |
| `tutorial_skip` | `step` | přeskočení výcviku (krok, KDE to vzdali) |
| `tutorial_done` | — | dokončení výcviku |
| `vo_play` | `name` | spuštění voiceoveru |
| `lang_set` | `to` | ruční přepnutí jazyka |

## Vyhodnocení (Supabase → SQL editor)

Hotové pohledy (čitelné jen s dashboard/service přístupem, ne klientem):

- **`wob_funnel`** — starty/výhry/prohry, výhernost a medián času vítězství
  per mise. *„Kde hráči prohrávají?" → srovnej s docs/DIFFICULTY.md.*
- **`wob_daily`** — denní hráči, sezení, odehrané mise.
- **`wob_tutorial`** — dosažené kroky výcviku a kde se přeskakuje.
- **`wob_segments`** — rozpad podle jazyka a zařízení.

Příklady dotazů navíc:

```sql
-- rozehráno vs. dohráno (drop-off uvnitř misí)
select mission_id, starts, wins + losses as finished,
       round(100.0 * (wins + losses) / nullif(starts, 0), 1) as finish_pct
from wob_funnel order by mission_id;

-- retence: hráči s aktivitou ve více dnech
select player_id, count(distinct created_at::date) as days
from wob_events group by 1 having count(distinct created_at::date) > 1
order by days desc;

-- používají hráči voiceover?
select props->>'name' as vo, count(*) from wob_events
where event = 'vo_play' group by 1 order by 2 desc;

-- volba výzbroje (funguje balancování loadoutů?)
select props->>'loadout' as loadout, count(*) from wob_events
where event = 'mission_start' group by 1 order by 2 desc;
```

## Schéma / údržba

Migrace `wob_events_analytics` (tabulka + RLS + pohledy) je aplikovaná
v projektu. Nové události přidávej voláním `track('nazev', {...}, missionId)`
z `src/ui/analytics.ts` — tabulka je generická, migrace není potřeba.
Retenci dat řeš případně mazáním starých řádků
(`delete from wob_events where created_at < now() - interval '180 days'`).

## Dashboard /analytika

Vyhodnocení bez SQL: `https://honorverse.vercel.app/analytika` — statická
stránka (samostatný Vite entry `analytika.html`, kód v `src/analytika/`),
která čte VÝHRADNĚ agregační pohledy (`wob_daily`, `wob_funnel`,
`wob_tutorial`, `wob_segments`) přes PostgREST s publishable klíčem.
Surová tabulka `wob_events` zůstává pro klienty zamčená (RLS insert-only);
pohledy neobsahují žádné PII, takže veřejná čitelnost agregátů je záměr.
Obsah: KPI karty (7denní součty), denní graf hráčů/sezení (Canvas 2D),
funnel misí v kampaňovém pořadí, udržení tutoriálu po krocích a segmenty
jazyk × zařízení. Routing řeší rewrite v `vercel.json`
(`/analytika` → `/analytika.html`).
