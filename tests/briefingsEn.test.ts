/**
 * Anglický povrch misí: úplnost názvů, briefingů a textů CÍLŮ vůči
 * skutečným scénářům (id cílů se musí krýt 1:1) + přepínání getterů.
 * Spouštět: npx vitest run tests/briefingsEn.test.ts
 */
import { afterEach, describe, expect, it } from 'vitest'
import { MISSION_SURFACE_EN, missionBriefing, missionTitle, objectiveText } from '../src/data/briefings'
import { SCENARIOS } from '../src/data/missions'
import { setLang } from '../src/ui/i18n'

afterEach(() => setLang('cs'))

describe('úplnost EN povrchu misí', () => {
  it('každá mise má EN název a briefing', () => {
    for (const id of Object.keys(SCENARIOS)) {
      const en = MISSION_SURFACE_EN[id]
      expect(en, `chybí EN povrch mise ${id}`).toBeDefined()
      expect(en.title.length).toBeGreaterThan(3)
      expect(en.briefing.length, `${id}: krátký EN briefing`).toBeGreaterThan(100)
    }
  })

  it('texty cílů se kryjí 1:1 s id cílů ve scénářích', () => {
    for (const id of Object.keys(SCENARIOS)) {
      const scIds = SCENARIOS[id].objectives.map(o => o.id).sort()
      const enIds = Object.keys(MISSION_SURFACE_EN[id].objectives).sort()
      expect(enIds, `${id}: nesedí id cílů`).toEqual(scIds)
      for (const oid of scIds) {
        expect(MISSION_SURFACE_EN[id].objectives[oid].length,
          `${id}/${oid}: prázdný EN text cíle`).toBeGreaterThan(10)
      }
    }
  })
})

describe('gettery přepínají dle jazyka', () => {
  it('EN vrací překlad, CS původní text, neznámá mise fallback', () => {
    setLang('en')
    expect(missionTitle('mission01', 'Hlídka')).toBe('Watchgate Patrol')
    expect(missionBriefing('mission03', 'x')).toContain('Mercator')
    expect(objectiveText('mission01', 'obj-inspect', 'x')).toContain('Inspect')
    expect(missionTitle('neexistuje', 'Fallback')).toBe('Fallback')
    expect(objectiveText('mission01', 'obj-neexistuje', 'Fallback')).toBe('Fallback')
    setLang('cs')
    expect(missionTitle('mission01', 'Hlídka u Strážné brány')).toBe('Hlídka u Strážné brány')
    expect(objectiveText('mission01', 'obj-inspect', 'Proveď kontrolu')).toBe('Proveď kontrolu')
  })
})
