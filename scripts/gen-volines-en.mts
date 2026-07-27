/**
 * Generátor src/data/voLinesEn.ts z docs/VO_LINES.md: mapa voId → EN text.
 * Spouštět po každé změně EN sloupců ve VO_LINES.md:
 *   npx tsx scripts/gen-volines-en.mts
 */
import { readFileSync, writeFileSync } from 'node:fs'

const md = readFileSync('docs/VO_LINES.md', 'utf8').split('\n')
const entries: Array<[string, string]> = []
let cur: string | null = null
for (const ln of md) {
  const id = /^\*\*`([\w-]+)`/.exec(ln)
  if (id) { cur = id[1]; continue }
  const en = /^- EN: (.+)$/.exec(ln)
  if (en && cur) { entries.push([cur, en[1].trim()]); cur = null }
}
if (entries.length < 80) throw new Error(`podezřele málo položek: ${entries.length}`)

const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const out = [
  '/**',
  ' * EN texty hlášek podle voId — VYGENEROVÁNO z docs/VO_LINES.md',
  ' * (scripts/gen-volines-en.mts). Needitovat ručně; hra jimi při',
  ' * angličtině nahrazuje české texty eventů (titulky sedí na EN audio).',
  ' */',
  'export const VO_LINES_EN: Record<string, string> = {',
  ...entries.map(([id, en]) => `  '${id}': '${esc(en)}',`),
  '}',
]
writeFileSync('src/data/voLinesEn.ts', out.join('\n') + '\n')
console.log(`src/data/voLinesEn.ts: ${entries.length} položek`)
