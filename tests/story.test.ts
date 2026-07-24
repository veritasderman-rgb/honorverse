/**
 * Testy příběhových dat kampaně (src/data/story.ts):
 * každá mise 1–10 má neprázdný prolog i epilog, úvod kampaně existuje
 * a epilogy/prology vážou mise na sebe (cádizská linka).
 */
import { describe, expect, it } from 'vitest'
import { CAMPAIGN_INTRO, DEFEAT_GENERIC, MISSION_STORY } from '../src/data/story'
import { SCENARIOS } from '../src/data/missions'

describe('příběh kampaně (story.ts)', () => {
  it('CAMPAIGN_INTRO je neprázdný a představuje svět i hráče', () => {
    expect(CAMPAIGN_INTRO.length).toBeGreaterThan(200)
    expect(CAMPAIGN_INTRO).toContain('Avalon')
    expect(CAMPAIGN_INTRO).toContain('mpérium')
    expect(CAMPAIGN_INTRO).toContain('Alex Rowan')
    expect(CAMPAIGN_INTRO).toContain('Cádiz')
  })

  it('každá registrovaná mise (včetně bočních) má neprázdný prolog i epilog', () => {
    const ids = Object.keys(SCENARIOS)
    expect(ids.length).toBeGreaterThanOrEqual(11)
    for (const id of ids) {
      const story = MISSION_STORY[id]
      expect(story, `chybí příběh mise ${id}`).toBeDefined()
      expect(story.prolog.trim().length, `prázdný prolog ${id}`).toBeGreaterThan(50)
      expect(story.epilog.trim().length, `prázdný epilog ${id}`).toBeGreaterThan(50)
      if (story.epilogLose !== undefined) {
        expect(story.epilogLose.trim().length).toBeGreaterThan(20)
      }
    }
  })

  it('MISSION_STORY neobsahuje mise mimo registr SCENARIOS', () => {
    for (const id of Object.keys(MISSION_STORY)) {
      expect(SCENARIOS[id], `příběh pro neregistrovanou misi ${id}`).toBeDefined()
    }
  })

  it('prology jsou psané ve druhé osobě („tvoje/tvůj/tvá loď…")', () => {
    for (const [id, story] of Object.entries(MISSION_STORY)) {
      expect(/[Tt]v(oje|ůj|á|ou|é)/.test(story.prolog), `prolog ${id} není ve 2. osobě`).toBe(true)
    }
  })

  it('epilogy vážou mise na sebe (cádizská linka M3 → M4 → M7)', () => {
    // M3: data z Mercatoru ukazují na Cádiz (→ mise 4)
    expect(MISSION_STORY.mission03.epilog).toContain('Cádiz')
    // M4: záznamy se jednou stanou válečným plánem
    expect(MISSION_STORY.mission04.epilog).toContain('válečným plánem')
    // M7: prolog odkazuje na průzkum z mise 4 (Aurora / Cádiz)
    expect(/Auror|Cádiz/.test(MISSION_STORY.mission07.prolog)).toBe(true)
    // M2 epilog: piráti jsou zástupci Impéria (→ eskalace)
    expect(MISSION_STORY.mission02.epilog).toContain('zástupci')
    // M6 epilog: Kaledon podepsal pakt (→ mise 8)
    expect(MISSION_STORY.mission06.epilog).toContain('Kaledon')
  })

  it('obecná porážková věta existuje (fallback pro mise bez epilogLose)', () => {
    expect(DEFEAT_GENERIC.length).toBeGreaterThan(20)
  })
})
