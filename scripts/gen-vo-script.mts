/**
 * Generátor nahrávacího skriptu voiceoveru → docs/VO_SCRIPT.md.
 * Vypíše KAŽDÝ očekávaný soubor (public/audio/vo/<jméno>-<jazyk>.mp3)
 * s přesným textem k namluvení, aby se nahrávky nerozjely s titulky.
 *
 * Spouštět po každé změně příběhových textů:
 *   npx tsx scripts/gen-vo-script.mts
 */
import { writeFileSync } from 'node:fs'
import {
  CAMPAIGN_INTRO, CAMPAIGN_INTRO_EN, DEFEAT_GENERIC, DEFEAT_GENERIC_EN,
  MISSION_STORY, MISSION_STORY_EN,
} from '../src/data/story.ts'

interface Entry { name: string; label: string; cs: string; en: string; optional?: boolean }

const entries: Entry[] = [
  { name: 'intro', label: 'Úvod kampaně', cs: CAMPAIGN_INTRO, en: CAMPAIGN_INTRO_EN },
]

for (const id of Object.keys(MISSION_STORY)) {
  const cs = MISSION_STORY[id]
  const en = MISSION_STORY_EN[id]
  if (!en) throw new Error(`chybí EN mutace příběhu mise ${id}`)
  entries.push({ name: `${id}-prolog`, label: `${id} — prolog`, cs: cs.prolog, en: en.prolog })
  entries.push({ name: `${id}-epilog`, label: `${id} — epilog (výhra)`, cs: cs.epilog, en: en.epilog, optional: true })
  if (cs.epilogLose) {
    entries.push({
      name: `${id}-epiloglose`, label: `${id} — epilog (porážka)`,
      cs: cs.epilogLose, en: en.epilogLose ?? '', optional: true,
    })
  }
  if (cs.epilogByFlag) {
    for (const flag of Object.keys(cs.epilogByFlag)) {
      entries.push({
        name: `${id}-epilog-${flag}`, label: `${id} — konec „${flag}"`,
        cs: cs.epilogByFlag[flag], en: en.epilogByFlag?.[flag] ?? '', optional: true,
      })
    }
  }
}
entries.push({
  name: 'defeat-generic', label: 'Obecná porážka (mise bez vlastního epilogu)',
  cs: DEFEAT_GENERIC, en: DEFEAT_GENERIC_EN, optional: true,
})

const words = (s: string): number => s.split(/\s+/).filter(Boolean).length
/** hrubý odhad stopáže: ~140 slov/min klidného čtení */
const dur = (s: string): string => `~${Math.max(10, Math.round((words(s) / 140) * 60))} s`

let md = `# Nahrávací skript voiceoveru (VO)

Vygenerováno z \`src/data/story.ts\` — needituj ručně, spusť
\`npx tsx scripts/gen-vo-script.mts\`.

## Jak nahrávat

- **Formát:** MP3 (mono, 96 kbps+) preferovaný; hra zkusí i \`.m4a\` a \`.wav\`
  se stejným jménem, takže jde nahrát bez převodu.
- **Umístění:** \`public/audio/vo/<jméno souboru>\` přesně dle tabulky.
- Soubor, který neexistuje, hra tiše přeskočí — nahrávat jde po částech.
- **Povinné minimum na zítřek:** \`intro\` + prology misí. Epilogy jsou
  označené _(volitelné)_ — hráč je čte na obrazovce výsledku.
- Čti přesně text níže (zobrazuje se zároveň jako titulky). Tón: klidný
  vojenský briefing, druhá osoba.

## Přehled souborů

| Soubor | Obsah | Stopáž (odhad) |
| --- | --- | --- |
`

for (const e of entries) {
  for (const lang of ['cs', 'en'] as const) {
    const text = e[lang]
    if (!text) continue
    md += `| \`${e.name}-${lang}.mp3\` | ${e.label} (${lang.toUpperCase()})${e.optional ? ' _(volitelné)_' : ''} | ${dur(text)} |\n`
  }
}

md += `\n---\n`

for (const e of entries) {
  md += `\n## ${e.label}${e.optional ? ' _(volitelné)_' : ''}\n`
  for (const lang of ['cs', 'en'] as const) {
    const text = e[lang]
    if (!text) continue
    md += `\n### \`${e.name}-${lang}.mp3\`\n\n> ${text.replace(/\n\n/g, '\n>\n> ')}\n`
  }
}

writeFileSync('docs/VO_SCRIPT.md', md)
console.log(`docs/VO_SCRIPT.md: ${entries.length} položek (${entries.filter(e => !e.optional).length} povinných)`)
