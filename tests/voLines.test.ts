/**
 * Konzistence namluvených hlášek: každé voId, které simulace umí vydat,
 * musí existovat v docs/VO_LINES.md i jako vygenerovaný soubor
 * public/audio/vo/lines/<id>-en.mp3 (CS je volitelná mutace). A obráceně:
 * žádné mrtvé nahrávky bez zdroje v simu (kromě záměrně nezapojených).
 * Spouštět: npx vitest run tests/voLines.test.ts
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SCENARIOS } from '../src/data/missions'

const ROOT = new URL('..', import.meta.url).pathname
const read = (p: string): string => readFileSync(`${ROOT}/${p}`, 'utf8')

/** id definovaná ve skriptu VO_LINES.md (nadpisy **`id`** + řádky tabulky §4) */
function docIds(): Set<string> {
  const md = read('docs/VO_LINES.md')
  const ids = new Set<string>()
  for (const m of md.matchAll(/\*\*`([\w-]+)`(?:\s*·\s*[\w-]+)?\*\*/g)) ids.add(m[1])
  // §4 tabulka má 4 buňky (id · mluvčí · CS · EN) — tabulka obsazení jen 3
  for (const m of md.matchAll(/^\|\s*`([\w-]+)`\s*\|\s*[\w-]+\s*\|\s*.+?\s*\|\s*.+?\s*\|$/gm)) {
    ids.add(m[1])
  }
  return ids
}

/** voId, která umí vydat simulace (literály + generované řady) */
function simIds(): Set<string> {
  const ids = new Set<string>()
  const simFiles = readdirSync(`${ROOT}/src/sim`).filter(f => f.endsWith('.ts'))
  for (const f of simFiles) {
    const src = read(`src/sim/${f}`)
    // přímé literály voId: '...' i podmíněné (ternár se dvěma literály)
    for (const m of src.matchAll(/voId[:=]?\s*'([\w-]+)'/g)) ids.add(m[1])
    for (const m of src.matchAll(/voId:\s*[^,\n]*\?\s*'([\w-]+)'\s*:\s*'([\w-]+)'/g)) {
      ids.add(m[1]); ids.add(m[2])
    }
    // statická systémová id jdou přes argumenty helperů (crewSay/say/commsSay)
    for (const m of src.matchAll(/'(sys-[\w-]+)'/g)) ids.add(m[1])
    // šablony `eng-redline-${msgIdx + 1}` → rozvinout dle EMERGENCY_MESSAGES
    if (src.includes('eng-redline-${')) {
      const count = (src.match(/^const EMERGENCY_MESSAGES = \[[^\]]+\]/ms)?.[0]
        .match(/'(?:[^'\\]|\\.)*'/gs) ?? []).length
      for (let i = 1; i <= count; i++) ids.add(`eng-redline-${i}`)
    }
  }
  // voice.ts: pick(state, key, 'prefix', [ varianty ]) → prefix-1..N
  const voice = read('src/sim/voice.ts')
  for (const m of voice.matchAll(/pick\(state,\s*[^,]+,\s*'([\w-]+)',\s*\[((?:[^\]])*?)\]\)/gs)) {
    const variants = (m[2].match(/(?:'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/gs) ?? []).length
    expect(variants, `${m[1]}: nenačetl jsem varianty`).toBeGreaterThan(0)
    for (let i = 1; i <= variants; i++) ids.add(`${m[1]}-${i}`)
  }
  // mise: vo: 'mXX-cN' / 'sXX-cN'
  for (const f of readdirSync(`${ROOT}/src/data/missions`).filter(x => x.endsWith('.ts'))) {
    for (const m of read(`src/data/missions/${f}`).matchAll(/vo:\s*'([\w-]+)'/g)) ids.add(m[1])
  }
  return ids
}

describe('voId ↔ skript ↔ nahrávky', () => {
  const doc = docIds()
  const sim = simIds()

  it('sim vydává jen id ze skriptu a každé má EN nahrávku', () => {
    for (const id of sim) {
      expect(doc.has(id), `voId ${id} není v docs/VO_LINES.md`).toBe(true)
      expect(existsSync(`${ROOT}/public/audio/vo/lines/${id}-en.mp3`),
        `chybí nahrávka ${id}-en.mp3`).toBe(true)
    }
  })

  it('zapojení pokrývá CELÝ skript — žádné mrtvé nahrávky', () => {
    const dead = [...doc].filter(id => !sim.has(id)).sort()
    expect(dead, 'id ze skriptu bez zdroje v simu').toEqual([])
    expect(sim.size).toBe(doc.size)
  })

  it('každá mise má zapojenou aspoň jednu komunikaci s vo', () => {
    for (const id of Object.keys(SCENARIOS)) {
      const src = read(`src/data/missions/${id}.ts`)
      if (!src.includes("kind: 'comm'")) continue
      expect(src.includes("vo: '"), `${id}: comm bez vo id`).toBe(true)
    }
  })
})
