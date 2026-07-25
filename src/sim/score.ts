/**
 * Skórování mise — deterministická čistá funkce (stejný průběh = stejné
 * skóre). Složky: vítězství, splněné cíle, rychlost vůči par času mise,
 * ztráty (přežití bez ztrát bonus), přesnost raket; součet násobí
 * obtížnost mise. Prohra = 0 bodů (do žebříčku se neodesílá).
 */

export interface ScoreInput {
  missionId: string
  outcome: 'win' | 'lose' | 'running'
  /** čas mise (s) */
  t: number
  /** počet splněných cílů (včetně volitelných) */
  objectivesDone: number
  /** ztracené vlastní lodě */
  ownLosses: number
  /** vystřelené vlastní útočné rakety */
  launched: number
  /** zásahy vlastních raket */
  hits: number
}

export interface ScoreLine {
  /** český popisek (kanonický — UI ho při angličtině překládá dle key/n) */
  label: string
  points: number
  /** stabilní klíč složky pro překlad v UI (score.<key>) */
  key: 'win' | 'objectives' | 'speed' | 'losses' | 'noLosses' | 'accuracy' | 'difficulty'
  /** číselný parametr složky (počet cílů/ztrát, % přesnosti, násobič) */
  n?: number
}

export interface MissionScore {
  total: number
  breakdown: ScoreLine[]
}

/** par čas (s) a násobič obtížnosti mise */
export const MISSION_PAR: Record<string, { par: number; mult: number }> = {
  mission01: { par: 8_000, mult: 1.0 },
  mission02: { par: 6_000, mult: 1.1 },
  mission03: { par: 5_000, mult: 1.1 },
  mission04: { par: 12_000, mult: 1.3 },
  mission05: { par: 6_000, mult: 1.3 },
  mission06: { par: 9_000, mult: 1.2 },
  mission07: { par: 7_000, mult: 1.5 },
  mission08: { par: 6_000, mult: 1.5 },
  mission09: { par: 7_000, mult: 1.8 },
  mission10: { par: 7_000, mult: 2.0 },
  mission11: { par: 8_000, mult: 2.5 },
  // boční operace (kratší střety, mírný násobič)
  side01: { par: 5_000, mult: 1.1 },
  side02: { par: 6_000, mult: 1.3 },
  side03: { par: 6_000, mult: 1.8 },
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

export function scoreMission(input: ScoreInput): MissionScore {
  if (input.outcome !== 'win') return { total: 0, breakdown: [] }
  const cfg = MISSION_PAR[input.missionId] ?? { par: 7_000, mult: 1.0 }

  const breakdown: ScoreLine[] = []
  breakdown.push({ label: 'vítězství', points: 1000, key: 'win' })
  if (input.objectivesDone > 0) {
    breakdown.push({
      label: `splněné cíle (${input.objectivesDone}×)`,
      points: 250 * input.objectivesDone, key: 'objectives', n: input.objectivesDone,
    })
  }
  // rychlost: plných 800 do par času, lineárně k nule na 3× par
  const speed = Math.round(800 * clamp01((3 * cfg.par - input.t) / (2 * cfg.par)))
  if (speed > 0) breakdown.push({ label: 'rychlost', points: speed, key: 'speed' })
  // ztráty: −150 za loď; bez ztrát +300
  if (input.ownLosses > 0) {
    breakdown.push({
      label: `ztráty (${input.ownLosses}×)`,
      points: -150 * input.ownLosses, key: 'losses', n: input.ownLosses,
    })
  } else {
    breakdown.push({ label: 'bez ztrát', points: 300, key: 'noLosses' })
  }
  // přesnost: 10 % zásahů = 500 b, 20 %+ = plných 1000
  const hitRate = input.launched > 0 ? input.hits / input.launched : 0
  const acc = Math.round(1000 * clamp01(hitRate * 5))
  if (acc > 0) {
    breakdown.push({
      label: `přesnost raket (${Math.round(hitRate * 100)} %)`,
      points: acc, key: 'accuracy', n: Math.round(hitRate * 100),
    })
  }

  const subtotal = breakdown.reduce((s, l) => s + l.points, 0)
  const total = Math.max(1, Math.round(subtotal * cfg.mult))
  if (cfg.mult !== 1.0) {
    breakdown.push({
      label: `obtížnost ×${cfg.mult.toFixed(1).replace('.', ',')}`,
      points: total - subtotal, key: 'difficulty', n: cfg.mult,
    })
  }
  return { total, breakdown }
}
