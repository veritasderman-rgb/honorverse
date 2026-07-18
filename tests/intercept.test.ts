import { describe, expect, it } from 'vitest'
import { brachistochrone, interceptSolution, timeToReach } from '../src/sim/intercept'
import { G } from '../src/sim/constants'
import { add, dist, fromAngle, len, scale, vec } from '../src/sim/vec'
import type { Vec2 } from '../src/sim/types'

/** akcelerace 500 g v km/s² */
const A500 = 500 * G

describe('brachistochrone', () => {
  it('1 mil. km při 500 g — ručně spočítané hodnoty', () => {
    // t = 2·√(d/a) = 2·√(1e6 / 4,905) ≈ 903,05 s
    // v_peak = √(d·a) = √(4,905e6) ≈ 2214,7 km/s
    const r = brachistochrone(1_000_000, A500)
    expect(r.time).toBeCloseTo(903.05, 1)
    expect(r.peakSpeed).toBeCloseTo(2214.7, 0)
    // konzistence se vzorci
    expect(r.time).toBeCloseTo(2 * Math.sqrt(1_000_000 / A500), 6)
    expect(r.peakSpeed).toBeCloseTo(Math.sqrt(1_000_000 * A500), 6)
  })

  it('v půlce času urazí půlku dráhy a má špičkovou rychlost', () => {
    const d = 5_000_000
    const r = brachistochrone(d, A500)
    const half = r.time / 2
    expect(0.5 * A500 * half * half).toBeCloseTo(d / 2, 3)
    expect(A500 * half).toBeCloseTo(r.peakSpeed, 6)
  })

  it('okrajové vstupy', () => {
    expect(brachistochrone(0, A500)).toEqual({ time: 0, peakSpeed: 0 })
    expect(brachistochrone(1e6, 0).time).toBe(Infinity)
  })
})

describe('timeToReach', () => {
  it('z klidu: t = √(2d/a)', () => {
    expect(timeToReach(1_000_000, A500, 0)).toBeCloseTo(Math.sqrt((2 * 1_000_000) / A500), 6)
  })

  it('s počáteční rychlostí splňuje ½at² + v₀t = d', () => {
    const d = 2_500_000
    const v0 = 800
    const t = timeToReach(d, A500, v0)
    expect(0.5 * A500 * t * t + v0 * t).toBeCloseTo(d, 3)
    // rychlejší než z klidu
    expect(t).toBeLessThan(timeToReach(d, A500, 0))
  })

  it('bez akcelerace: čistý dolet setrvačností', () => {
    expect(timeToReach(1000, 0, 50)).toBeCloseTo(20, 9)
    expect(timeToReach(1000, 0, 0)).toBe(Infinity)
    expect(timeToReach(0, A500, 0)).toBe(0)
  })
})

/** Eulerova simulace letu konstantní akcelerací po daném headingu. */
function simulateChase(
  pos: Vec2,
  vel: Vec2,
  accel: number,
  heading: number,
  targetPos: Vec2,
  targetVel: Vec2,
  time: number,
  steps = 20_000,
): number {
  const dt = time / steps
  let p = { ...pos }
  let v = { ...vel }
  let tp = { ...targetPos }
  const aVec = fromAngle(heading, accel)
  let best = dist(p, tp)
  for (let i = 0; i < steps; i++) {
    v = add(v, scale(aVec, dt))
    p = add(p, scale(v, dt))
    tp = add(tp, scale(targetVel, dt))
    best = Math.min(best, dist(p, tp))
  }
  return best
}

describe('interceptSolution', () => {
  it('stojící cíl: přímý kurz a čas dle t = √(2d/a)', () => {
    const sol = interceptSolution(vec(0, 0), vec(0, 0), A500, vec(1_000_000, 0), vec(0, 0))
    expect(sol).not.toBeNull()
    expect(sol!.heading).toBeCloseTo(0, 6)
    expect(sol!.time).toBeCloseTo(Math.sqrt((2 * 1_000_000) / A500), 3)
  })

  it('stojící cíl na diagonále: heading π/4', () => {
    const sol = interceptSolution(vec(0, 0), vec(0, 0), A500, vec(1e6, 1e6), vec(0, 0))
    expect(sol).not.toBeNull()
    expect(sol!.heading).toBeCloseTo(Math.PI / 4, 6)
  })

  it('pohybující se cíl: Eulerova simulace se přiblíží < 1 % vzdálenosti', () => {
    const pos = vec(0, 0)
    const vel = vec(0, 0)
    const targetPos = vec(2_000_000, 1_000_000)
    const targetVel = vec(-50, 120)
    const sol = interceptSolution(pos, vel, A500, targetPos, targetVel)
    expect(sol).not.toBeNull()
    const d0 = dist(pos, targetPos)
    const closest = simulateChase(pos, vel, A500, sol!.heading, targetPos, targetVel, sol!.time)
    expect(closest).toBeLessThan(0.01 * d0)
  })

  it('pohybující se cíl + vlastní počáteční rychlost lodi', () => {
    const pos = vec(500_000, -200_000)
    const vel = vec(40, -15)
    const targetPos = vec(-1_500_000, 2_500_000)
    const targetVel = vec(90, -60)
    const sol = interceptSolution(pos, vel, A500, targetPos, targetVel)
    expect(sol).not.toBeNull()
    const d0 = dist(pos, targetPos)
    const closest = simulateChase(pos, vel, A500, sol!.heading, targetPos, targetVel, sol!.time)
    expect(closest).toBeLessThan(0.01 * d0)
  })

  it('nulová akcelerace → null', () => {
    expect(interceptSolution(vec(0, 0), vec(0, 0), 0, vec(1e6, 0), vec(0, 0))).toBeNull()
  })

  it('cíl nedosažitelný do ~24 h → null', () => {
    // slabá akcelerace, cíl daleko a rychle prchá (t řešení ≈ 3e7 s ≫ 24 h)
    const sol = interceptSolution(vec(0, 0), vec(0, 0), 0.01, vec(1e9, 0), vec(150_000, 0))
    expect(sol).toBeNull()
  })

  it('řešení v čase interceptu skutečně pokrývá dráhu (½at² = |R+Vt|)', () => {
    const sol = interceptSolution(vec(0, 0), vec(10, 5), A500, vec(3e6, -1e6), vec(-30, 40))
    expect(sol).not.toBeNull()
    const { time: t } = sol!
    const rel = add(vec(3e6, -1e6), scale(vec(-30 - 10, 40 - 5), t))
    expect(0.5 * A500 * t * t).toBeCloseTo(len(rel), -2) // tolerance ~100 km na 1e6+ km
  })
})
