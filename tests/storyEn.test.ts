/**
 * Anglická mutace příběhu: úplnost vůči české (klíče, pole, konce dle flagů)
 * a přepínání getterů podle jazyka.
 * Spouštět: npx vitest run tests/storyEn.test.ts
 */
import { afterEach, describe, expect, it } from 'vitest'
import {
  CAMPAIGN_INTRO, CAMPAIGN_INTRO_EN, campaignIntro, DEFEAT_GENERIC_EN,
  defeatGeneric, MISSION_STORY, MISSION_STORY_EN, missionStory,
} from '../src/data/story'
import { setLang } from '../src/ui/i18n'

afterEach(() => setLang('cs'))

describe('úplnost EN mutace', () => {
  it('každá mise má EN mutaci se stejnými poli', () => {
    for (const [id, cs] of Object.entries(MISSION_STORY)) {
      const en = MISSION_STORY_EN[id]
      expect(en, `chybí EN příběh mise ${id}`).toBeDefined()
      expect(en!.prolog.length, `${id}: prázdný EN prolog`).toBeGreaterThan(50)
      expect(en!.epilog.length, `${id}: prázdný EN epilog`).toBeGreaterThan(50)
      expect(!!en!.epilogLose, `${id}: nesouhlasí epilogLose`).toBe(!!cs.epilogLose)
      // konce dle flagů: stejné klíče v obou mutacích
      expect(Object.keys(en!.epilogByFlag ?? {}).sort()).toEqual(
        Object.keys(cs.epilogByFlag ?? {}).sort())
    }
    // a žádná EN mise navíc
    expect(Object.keys(MISSION_STORY_EN).sort()).toEqual(Object.keys(MISSION_STORY).sort())
  })

  it('EN úvod kampaně drží vlastní jména a svět', () => {
    expect(CAMPAIGN_INTRO_EN.length).toBeGreaterThan(200)
    for (const name of ['Avalon', 'Empire', 'Alex Rowan', 'Cádiz', 'Salazar']) {
      expect(CAMPAIGN_INTRO_EN, `EN intro postrádá ${name}`).toContain(name)
    }
  })

  it('EN mutace navazuje mise stejně jako česká (Cádiz přes M3→M4→M9→M10)', () => {
    expect(MISSION_STORY_EN.mission03.epilog).toContain('Cádiz')
    expect(MISSION_STORY_EN.mission09.epilog).toContain('Cádiz')
    expect(MISSION_STORY_EN.mission10.prolog).toContain('Aurora')
    expect(MISSION_STORY_EN.mission10.prolog).toContain('Kerav')
  })
})

describe('gettery přepínají dle jazyka', () => {
  it('campaignIntro/missionStory/defeatGeneric vrací mutaci aktuálního jazyka', () => {
    setLang('cs')
    expect(campaignIntro()).toBe(CAMPAIGN_INTRO)
    expect(missionStory('mission01')?.prolog).toBe(MISSION_STORY.mission01.prolog)
    expect(defeatGeneric()).toContain('Admiralita')
    setLang('en')
    expect(campaignIntro()).toBe(CAMPAIGN_INTRO_EN)
    expect(missionStory('mission01')?.prolog).toBe(MISSION_STORY_EN.mission01.prolog)
    expect(defeatGeneric()).toBe(DEFEAT_GENERIC_EN)
  })

  it('neznámá mise vrací undefined v obou jazycích', () => {
    setLang('en')
    expect(missionStory('nope')).toBeUndefined()
    setLang('cs')
    expect(missionStory('nope')).toBeUndefined()
  })
})
