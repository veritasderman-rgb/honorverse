/**
 * Deterministický seedovaný PRNG (mulberry32).
 * Stav žije v SimState.rng — save/load a replaye jsou tak férové.
 */
import type { RngState } from './types'

/** Vrátí náhodné číslo v [0, 1) a posune stav rng.s. */
export function rand(rng: RngState): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0
  let t = rng.s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
