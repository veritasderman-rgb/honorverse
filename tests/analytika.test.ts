/**
 * Analytický dashboard (/analytika) — čisté transformace datové vrstvy:
 * řazení funnelu dle kampaně, KPI z denní řady, udržení tutoriálu, formát
 * času. Spouštět: npx vitest run tests/analytika.test.ts
 */
import { describe, expect, it } from 'vitest'
import {
  fmtDur, kpis, MISSION_ORDER, orderFunnel, tutorialFunnel,
  type DailyRow, type TutorialRow,
} from '../src/analytika/data'
import { SCENARIOS } from '../src/data/missions'

describe('orderFunnel', () => {
  it('řadí dle kampaňové linie, neznámé id na konec', () => {
    const rows = [
      { mission_id: 'skirmish' }, { mission_id: 'mission04' },
      { mission_id: 'zzz-nova' }, { mission_id: 'mission01' }, { mission_id: 'side01' },
    ]
    expect(orderFunnel(rows).map(r => r.mission_id))
      .toEqual(['mission01', 'side01', 'mission04', 'skirmish', 'zzz-nova'])
  })

  it('MISSION_ORDER pokrývá všechny registrované scénáře', () => {
    for (const id of Object.keys(SCENARIOS)) {
      expect(MISSION_ORDER, `chybí ${id} v MISSION_ORDER`).toContain(id)
    }
  })
})

describe('kpis', () => {
  const day = (day: string, players: number, sessions: number): DailyRow =>
    ({ day, players, sessions, mission_starts: players * 2, mission_ends: players, events: players * 10 })

  it('sčítá posledních 7 dní a celkové události', () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      day(`2026-07-${String(25 - i).padStart(2, '0')}`, 10, 12))
    const k = kpis(rows)
    expect(k.playerDays7).toBe(70)
    expect(k.sessions7).toBe(84)
    expect(k.starts7).toBe(140)
    expect(k.totalEvents).toBe(1000)
    expect(k.days).toBe(10)
  })

  it('nezávisí na pořadí vstupu (samo si řadí dle dne)', () => {
    const rows = [day('2026-07-20', 1, 1), day('2026-07-25', 5, 5), day('2026-07-22', 2, 2)]
    expect(kpis(rows)).toEqual(kpis([...rows].reverse()))
  })

  it('prázdná řada = nuly (žádné dělení nulou)', () => {
    expect(kpis([]).playerDays7).toBe(0)
    expect(kpis([]).days).toBe(0)
  })
})

describe('tutorialFunnel', () => {
  const row = (mission: string, step: number | null, reached: number, skipped = 0): TutorialRow =>
    ({ mission_id: mission, step, reached, skipped_here: skipped })

  it('kroky vzestupně + % udržení vůči prvnímu kroku', () => {
    const out = tutorialFunnel([
      row('mission01', 2, 40), row('mission01', 0, 100), row('mission01', 1, 80, 5),
    ])
    expect(out.mission01.map(s => s.step)).toEqual([0, 1, 2])
    expect(out.mission01.map(s => s.pctOfFirst)).toEqual([100, 80, 40])
    expect(out.mission01[1].skipped).toBe(5)
  })

  it('řádky s null krokem ignoruje, mise odděluje', () => {
    const out = tutorialFunnel([
      row('mission01', 0, 10), row('mission02', 0, 6), row('mission01', null, 99),
    ])
    expect(Object.keys(out).sort()).toEqual(['mission01', 'mission02'])
    expect(out.mission01).toHaveLength(1)
  })

  it('nulový první krok nedělí nulou', () => {
    const out = tutorialFunnel([row('mission03', 0, 0)])
    expect(out.mission03[0].pctOfFirst).toBe(0)
  })
})

describe('fmtDur', () => {
  it('m:ss pod hodinu, h:mm:ss nad ní, — pro null', () => {
    expect(fmtDur(75)).toBe('1:15')
    expect(fmtDur(3671)).toBe('1:01:11')
    expect(fmtDur(null)).toBe('—')
  })
})
