/**
 * Analytika: čistý stavitel záznamu (tvary, ořezy, validace enumů)
 * a vypnutí sběru mimo produkci. Síť se netestuje (fire-and-forget).
 * Spouštět: npx vitest run tests/analytics.test.ts
 */
import { describe, expect, it } from 'vitest'
import { analyticsEnabled, buildEvent } from '../src/ui/analytics'

const ids = { player: 'p123456789abcdef', session: 's123456789abcdef' }

describe('buildEvent', () => {
  it('staví záznam se všemi poli pro wob_events', () => {
    const e = buildEvent('mission_end', { win: true, t: 512 }, 'mission01', ids, { lang: 'en', device: 'phone' })
    expect(e).toEqual({
      player_id: ids.player,
      session_id: ids.session,
      event: 'mission_end',
      mission_id: 'mission01',
      props: { win: true, t: 512 },
      lang: 'en',
      device: 'phone',
      app: 'web',
    })
  })

  it('ořezává délky a normalizuje neznámé hodnoty (CHECK constrainty DB)', () => {
    const e = buildEvent('x'.repeat(80), {}, 'm'.repeat(80), ids, { lang: 'de', device: 'toaster' })
    expect(e.event.length).toBe(40)
    expect(e.mission_id!.length).toBe(40)
    expect(e.lang).toBe('cs')          // neznámý jazyk → cs (fallback slovníku)
    expect(e.device).toBe('desktop')   // neznámé zařízení → desktop
  })

  it('mise může chybět (globální události typu app_start)', () => {
    expect(buildEvent('app_start', {}, null, ids, { lang: 'cs', device: 'desktop' }).mission_id).toBeNull()
  })
})

describe('analyticsEnabled', () => {
  it('mimo produkci (test/node) je sběr vypnutý', () => {
    expect(analyticsEnabled()).toBe(false)
  })
})
