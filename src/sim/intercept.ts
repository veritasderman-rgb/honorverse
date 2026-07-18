/**
 * Řešiče interceptů a dojezdů — čistá matematika bez stavu simulace.
 * Jednotky: km, s, km/s, km/s². Úhly rad.
 */
import type { Vec2 } from './types'
import { add, angleOf, len, scale, sub } from './vec'

/** maximální uvažovaný čas interceptu (~24 h) */
export const MAX_INTERCEPT_TIME = 86_400

/**
 * Najde směr konstantní akcelerace, kterým loď zachytí pohybující se cíl.
 *
 * V relativní soustavě: R = targetPos − pos, V = targetVel − vel.
 * Hledáme t > 0 tak, aby ujetá dráha akcelerací pokryla relativní posun:
 *   ½·a·t² = |R + V·t|
 * Iterativní predikce: z odhadu t extrapolujeme cíl, z kvadratiky
 * ½·a·t'² = d dostaneme nový odhad t' = √(2d/a), tlumeně iterujeme.
 * Fallback: bisekce (funkce ½at² − |R+Vt| je v 0 nekladná a pro velká t
 * kladná, kořen tedy existuje — jen může ležet za 24h horizontem).
 *
 * @returns čas do interceptu a heading akcelerace, nebo null když
 *          rozumné řešení do ~24 h neexistuje.
 */
export function interceptSolution(
  pos: Vec2,
  vel: Vec2,
  accel: number,
  targetPos: Vec2,
  targetVel: Vec2,
): { time: number; heading: number } | null {
  if (!(accel > 0)) return null
  const R = sub(targetPos, pos) // relativní pozice cíle
  const V = sub(targetVel, vel) // relativní rychlost cíle
  const d0 = len(R)
  // už jsme na cíli — triviální řešení (heading ve směru úniku cíle)
  if (d0 < 1e-6) return { time: 0, heading: angleOf(V) }

  /** přebytek dráhy: kladný ⇔ za čas t doletíme dál, než je cíl */
  const f = (t: number): number => 0.5 * accel * t * t - len(add(R, scale(V, t)))

  // --- tlumená iterace pevného bodu ---
  let t = Math.sqrt((2 * d0) / accel)
  for (let i = 0; i < 64; i++) {
    const d = len(add(R, scale(V, t)))
    const tNext = Math.sqrt((2 * d) / accel)
    const step = 0.5 * (t + tNext) // tlumení proti oscilaci
    if (Math.abs(step - t) <= 1e-9 * Math.max(1, t)) {
      t = step
      break
    }
    t = step
  }

  // ověření konvergence (relativní reziduum rovnice)
  const converged =
    Number.isFinite(t) && t >= 0 && Math.abs(f(t)) <= 1e-4 * (0.5 * accel * t * t + d0)

  if (!converged) {
    // --- fallback: najdi první znaménkovou změnu f a bisekuj ---
    let lo = 0
    let hi = Number.NaN
    for (let i = 1; i <= 256; i++) {
      const probe = (MAX_INTERCEPT_TIME * i) / 256
      if (f(probe) >= 0) {
        hi = probe
        break
      }
      lo = probe
    }
    if (!Number.isFinite(hi)) return null // do 24 h nedosažitelný
    for (let i = 0; i < 128; i++) {
      const mid = 0.5 * (lo + hi)
      if (f(mid) >= 0) hi = mid
      else lo = mid
    }
    t = 0.5 * (lo + hi)
  }

  if (t > MAX_INTERCEPT_TIME) return null
  // bod zachycení v relativní soustavě → heading akcelerace
  const aim = add(R, scale(V, t))
  return { time: t, heading: angleOf(aim) }
}

/**
 * Brachystochrona: půl cesty zrychluj, půl brzdi (z klidu do klidu).
 * t = 2·√(d/a), špičková rychlost uprostřed = a·t/2 = √(d·a).
 */
export function brachistochrone(dist: number, accel: number): { time: number; peakSpeed: number } {
  if (!(dist > 0)) return { time: 0, peakSpeed: 0 }
  if (!(accel > 0)) return { time: Infinity, peakSpeed: 0 }
  const time = 2 * Math.sqrt(dist / accel)
  return { time, peakSpeed: 0.5 * accel * time }
}

/**
 * Čistý dojezd bez brzdění: ½·a·t² + v₀·t = d.
 * @param initialSpeedTowards složka počáteční rychlosti směrem k cíli (km/s)
 */
export function timeToReach(dist: number, accel: number, initialSpeedTowards: number): number {
  if (!(dist > 0)) return 0
  if (!(accel > 0)) {
    return initialSpeedTowards > 0 ? dist / initialSpeedTowards : Infinity
  }
  const disc = initialSpeedTowards * initialSpeedTowards + 2 * accel * dist
  return (Math.sqrt(disc) - initialSpeedTowards) / accel
}
