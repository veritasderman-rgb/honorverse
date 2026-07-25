/**
 * Postavy: úplnost medailonků (CS/EN), platné role klíče v obou jazycích
 * a pokrytí všech mluvčích komunikace.
 * Spouštět: npx vitest run tests/characters.test.ts
 */
import { afterEach, describe, expect, it } from 'vitest'
import { CHARACTERS } from '../src/data/characters'
import { setLang, t } from '../src/ui/i18n'

afterEach(() => setLang('cs'))

/** mluvčí používaní scénáři (SPEAKERS v ui/panels.ts) */
const SPEAKER_IDS = [
  'captain', 'xo', 'engineer', 'tactical', 'comms',
  'enemy-captain', 'pirate', 'station', 'governor',
]

describe('postavy (intro karty)', () => {
  it('každý mluvčí má postavu s medailonkem v obou jazycích', () => {
    for (const id of SPEAKER_IDS) {
      const ch = CHARACTERS[id]
      expect(ch, `chybí postava ${id}`).toBeDefined()
      expect(ch.name.length).toBeGreaterThan(3)
      expect(ch.bio.cs.length, `${id}: krátký CS medailonek`).toBeGreaterThan(40)
      expect(ch.bio.en.length, `${id}: krátký EN medailonek`).toBeGreaterThan(40)
    }
    // žádná postava navíc bez mluvčího
    expect(Object.keys(CHARACTERS).sort()).toEqual([...SPEAKER_IDS].sort())
  })

  it('role klíče se překládají v obou jazycích', () => {
    for (const lang of ['cs', 'en'] as const) {
      setLang(lang)
      for (const id of SPEAKER_IDS) {
        const role = t(CHARACTERS[id].roleKey)
        expect(role, `${id}: nepřeložená role (${lang})`).not.toBe(CHARACTERS[id].roleKey)
        expect(role.length).toBeGreaterThan(2)
      }
    }
  })
})
