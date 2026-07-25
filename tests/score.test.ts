/**
 * Skórování misí (score.ts) a shrnutí pořadí (leaderboard.rankSummary) —
 * čisté funkce, deterministické.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { MISSION_PAR, scoreMission } from '../src/sim/score'
import { rankSummary, type LeaderRow } from '../src/ui/leaderboard'
import { SCENARIOS } from '../src/data/missions'
import { setLang } from '../src/ui/i18n'

afterEach(() => setLang('cs'))

const winInput = {
  missionId: 'mission01', outcome: 'win' as const, t: 7_000,
  objectivesDone: 2, ownLosses: 0, launched: 40, hits: 6,
}

describe('scoreMission', () => {
  it('prohra = 0 bodů (do žebříčku se neodesílá)', () => {
    expect(scoreMission({ ...winInput, outcome: 'lose' }).total).toBe(0)
    expect(scoreMission({ ...winInput, outcome: 'running' }).total).toBe(0)
  })

  it('výhra skládá složky: vítězství + cíle + rychlost + bez ztrát + přesnost', () => {
    const s = scoreMission(winInput)
    // 1000 + 500 (2 cíle) + 800 (t ≤ par) + 300 (bez ztrát) + 750 (15 % zásahů)
    expect(s.total).toBe(1000 + 500 + 800 + 300 + 750)
    expect(s.breakdown.some(l => l.label === 'vítězství')).toBe(true)
    expect(s.breakdown.some(l => l.label === 'bez ztrát')).toBe(true)
  })

  it('je deterministické (stejný vstup = stejný výsledek)', () => {
    expect(scoreMission(winInput)).toEqual(scoreMission(winInput))
  })

  it('ztráty odečítají, pomalost sráží rychlostní bonus na nulu', () => {
    const slow = scoreMission({ ...winInput, t: 3 * 8_000, ownLosses: 3 })
    expect(slow.breakdown.some(l => l.label === 'rychlost')).toBe(false)
    expect(slow.breakdown.find(l => l.label.startsWith('ztráty'))?.points).toBe(-450)
    expect(slow.total).toBeLessThan(scoreMission(winInput).total)
  })

  it('obtížnost násobí (mise 11 ×2,5) a přidává řádek rozpadu', () => {
    const easy = scoreMission(winInput)
    const hard = scoreMission({ ...winInput, missionId: 'mission11', t: 7_000 })
    expect(hard.total).toBeGreaterThan(easy.total * 2)
    expect(hard.breakdown.some(l => l.label.startsWith('obtížnost'))).toBe(true)
  })

  it('přesnost je zastropovaná na 1000 (20 %+ zásahů)', () => {
    const sniper = scoreMission({ ...winInput, launched: 10, hits: 9 })
    expect(sniper.breakdown.find(l => l.label.startsWith('přesnost'))?.points).toBe(1000)
  })

  it('skóre výhry je vždy ≥ 1 (DB constraint)', () => {
    const worst = scoreMission({
      missionId: 'mission01', outcome: 'win', t: 1e6,
      objectivesDone: 0, ownLosses: 20, launched: 0, hits: 0,
    })
    expect(worst.total).toBeGreaterThanOrEqual(1)
  })

  it('každá registrovaná mise má par čas a násobič', () => {
    for (const id of Object.keys(SCENARIOS)) {
      expect(MISSION_PAR[id], `chybí MISSION_PAR pro ${id}`).toBeDefined()
    }
  })
})

describe('rankSummary', () => {
  const row = (score: number): LeaderRow =>
    ({ nickname: 'x', score, time_s: 100, losses: 0, created_at: '' })

  it('„na 1. místo chybí X bodů" počítá rozdíl proti špičce', () => {
    setLang('cs')
    const top = [row(2000), row(1500), row(1200)]
    const s = rankSummary(1000, top, 3, 12)
    expect(s).toContain('4. z 12')
    expect(s).toContain('chybí 1000 bodů')
    expect(s).toContain('TOP 10')
  })

  it('první místo gratuluje', () => {
    setLang('cs')
    const top = [row(3000), row(2000)]
    expect(rankSummary(3000, top, 0, 5)).toContain('Držíš 1. místo')
  })

  it('mimo top 10 hlásí, kolik chybí do desítky', () => {
    setLang('cs')
    const top = Array.from({ length: 10 }, (_, i) => row(2000 - i * 100)) // 10. má 1100
    const s = rankSummary(900, top, 14, 40)
    expect(s).toContain('15. z 40')
    expect(s).toContain('Do TOP 10 chybí 200 bodů')
  })

  it('anglicky mluví celou větou (EN mutace klíčů)', () => {
    setLang('en')
    const top = [row(2000), row(1500), row(1200)]
    const s = rankSummary(1000, top, 3, 12)
    expect(s).toContain('#4 of 12')
    expect(s).toContain('1000 more points')
    expect(rankSummary(2000, top, 0, 5)).toContain('1st place')
  })
})
