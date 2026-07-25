/**
 * Hloubková vrstva i18n (HUD fáze 2b): úplnost slovníku, shoda {zástupných}
 * placeholders mezi cs/en, tf() dosazování, lokalizace čísel a překlad
 * složek skóre. Spouštět: npx vitest run tests/i18nDeep.test.ts
 */
import { afterEach, describe, expect, it } from 'vitest'
import { fmtDec, fmtNum, I18N_DICT, setLang, t, tf } from '../src/ui/i18n'
import { scoreMission } from '../src/sim/score'
import { helpBoxHtml } from '../src/ui/help'
import { SHIP_SURFACE_EN, shipClassLore, shipClassName } from '../src/data/shipsEn'
import { SHIP_CLASSES } from '../src/data/defs'

afterEach(() => setLang('cs'))

describe('úplnost slovníku', () => {
  it('každý klíč má neprázdné cs i en', () => {
    for (const [key, e] of Object.entries(I18N_DICT)) {
      expect(e.cs.length, `${key}: prázdné cs`).toBeGreaterThan(0)
      expect(e.en.length, `${key}: prázdné en`).toBeGreaterThan(0)
    }
  })

  it('cs a en mají shodné {placeholders} (nic se při překladu neztratí)', () => {
    const names = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
    for (const [key, e] of Object.entries(I18N_DICT)) {
      expect(names(e.en), `${key}: nesedí placeholders`).toEqual(names(e.cs))
    }
  })
})

describe('tf() a formát čísel', () => {
  it('tf dosadí pojmenované hodnoty, neznámé nechá být', () => {
    setLang('en')
    expect(tf('sv.title', { id: 7 })).toBe('Salvo #7')
    expect(tf('rank.position', { rank: 4, total: 12, pct: 34 }))
      .toBe('You are #4 of 12 captains (top 34 %).')
    setLang('cs')
    expect(tf('sv.title', { id: 7 })).toBe('Salva #7')
  })

  it('čísla: čeština mezery a čárky, angličtina čárky a tečky', () => {
    setLang('cs')
    expect(fmtNum(12345)).toBe('12 345')
    expect(fmtDec(1.5)).toBe('1,5')
    setLang('en')
    expect(fmtNum(12345)).toBe('12,345')
    expect(fmtDec(1.5)).toBe('1.5')
  })
})

describe('překlad složek skóre (klíč + n z čisté funkce)', () => {
  it('breakdown nese stabilní key/n a EN texty existují', () => {
    const s = scoreMission({
      missionId: 'mission11', outcome: 'win', t: 7_000,
      objectivesDone: 2, ownLosses: 1, launched: 10, hits: 3,
    })
    setLang('en')
    for (const l of s.breakdown) {
      const en = tf(`score.${l.key}`, { n: l.n ?? 0 })
      expect(en, `score.${l.key} nepřeloženo`).not.toContain('score.')
      expect(en).not.toMatch(/[ěščřžýáíéúů]/)
    }
    const diff = s.breakdown.find(l => l.key === 'difficulty')
    expect(diff?.n).toBe(2.5)
  })
})

describe('nápověda (H)', () => {
  it('přepíná jazyk celého overlaye', () => {
    setLang('cs')
    expect(helpBoxHtml()).toContain('NÁPOVĚDA')
    setLang('en')
    const en = helpBoxHtml()
    expect(en).toContain('HELP')
    expect(en).toContain('Powered envelope')
    expect(en).toContain('CLOSE (Esc)')
  })
})

describe('anglický povrch lodních tříd (shipsEn)', () => {
  it('každá třída z defs má EN jméno; lore zrcadlí českou (má-li ji)', () => {
    for (const [id, def] of Object.entries(SHIP_CLASSES)) {
      const en = SHIP_SURFACE_EN[id]
      expect(en, `chybí EN povrch třídy ${id}`).toBeDefined()
      // vlastní jména tříd (Vladař, Korzár…) si diakritiku nechávají —
      // kontrolujeme jen, že jméno není celé české („třída …")
      expect(en.name.length).toBeGreaterThan(2)
      expect(en.name).not.toMatch(/^třída /)
      if (def.lore) {
        expect(en.lore, `${id}: chybí EN lore`).toBeDefined()
        expect(en.lore!.length, `${id}: krátká EN lore`).toBeGreaterThan(60)
      }
    }
  })

  it('gettery přepínají dle jazyka s českým fallbackem', () => {
    const def = SHIP_CLASSES['cl-sokol']
    setLang('en')
    expect(shipClassName(def)).toBe('Sokol class')
    expect(shipClassLore(def)).toContain('falcon')
    setLang('cs')
    expect(shipClassName(def)).toBe('třída Sokol')
    expect(shipClassLore(def)).toContain('sokolovi')
  })
})

describe('anglické HUD texty (vzorky)', () => {
  it('detail cíle, salva, tooltipy', () => {
    setLang('en')
    expect(t('tg.distance')).toBe('range:')
    expect(t('tg.q2')).toBe('full identification')
    expect(t('sur.demand')).toBe('Demand surrender')
    expect(t('lb.failed')).toBe('Submission failed (offline?). Try again.')
    expect(t('tip.fleetAlpha')).toContain('TIME-ON-TARGET')
    expect(t('plot.charted')).toBe('charted')
    setLang('cs')
    expect(t('lb.failed')).toBe('Odeslání selhalo (offline?). Zkus to znovu.')
  })
})
