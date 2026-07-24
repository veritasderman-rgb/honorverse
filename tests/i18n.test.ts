/**
 * Lokalizace (i18n): přepínání CS/EN, fallback na češtinu, neznámý klíč.
 */
import { describe, expect, it } from 'vitest'
import { getLang, setLang, t, toggleLang } from '../src/ui/i18n'

describe('i18n', () => {
  it('setLang přepne jazyk a t() vrací správnou variantu', () => {
    setLang('cs')
    expect(getLang()).toBe('cs')
    expect(t('menu.skirmish')).toBe('⚔ VOLNÁ BITVA')
    setLang('en')
    expect(getLang()).toBe('en')
    expect(t('menu.skirmish')).toBe('⚔ SKIRMISH')
  })

  it('toggleLang přepíná mezi cs a en', () => {
    setLang('cs')
    expect(toggleLang()).toBe('en')
    expect(toggleLang()).toBe('cs')
  })

  it('neznámý klíč vrátí samotný klíč (bez pádu)', () => {
    setLang('en')
    expect(t('nope.missing')).toBe('nope.missing')
  })

  it('všechny klíče mají obě jazykové varianty a jsou neprázdné', () => {
    setLang('en')
    for (const key of ['map.title', 'menu.story', 'menu.fleet', 'intro.continue', 'hall.captain']) {
      expect(t(key).length, `prázdný/chybějící překlad ${key}`).toBeGreaterThan(0)
      expect(t(key), `EN nepřeloženo ${key}`).not.toBe(key)
    }
    setLang('cs')
    for (const key of ['map.title', 'menu.story', 'menu.fleet', 'intro.continue', 'hall.captain']) {
      expect(t(key), `CS nepřeloženo ${key}`).not.toBe(key)
    }
  })
})
