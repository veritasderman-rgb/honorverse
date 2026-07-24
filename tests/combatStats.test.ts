/**
 * Sdílený akumulátor bojové statistiky (M0): počítá odpaly/zásahy/ztráty raket
 * z eventů, odděleně od prezentace. `side` u launch/kill/hit = strana RAKETY.
 */
import { describe, expect, it } from 'vitest'
import type { SimEvent } from '../src/sim/types'
import { CombatStatsTracker } from '../src/ui/combatStats'

const ev = (e: Partial<SimEvent> & { kind: SimEvent['kind'] }): SimEvent =>
  ({ t: 0, ...e } as SimEvent)

describe('CombatStatsTracker', () => {
  it('počítá odpaly a zásahy vlastní strany (skóre)', () => {
    const s = new CombatStatsTracker()
    s.count(ev({ kind: 'launch', side: 'player', count: 6 }))
    s.count(ev({ kind: 'launch', side: 'player', count: 4 }))
    s.count(ev({ kind: 'missileHit', side: 'player' }))
    s.count(ev({ kind: 'missileHit', side: 'player' }))
    expect(s.scoring).toEqual({ ourLaunched: 10, ourHits: 2 })
  })

  it('odděluje příchozí (enemy) od našich a rozpadá ztráty dle příčiny', () => {
    const s = new CombatStatsTracker()
    s.count(ev({ kind: 'launch', side: 'enemy', count: 8 }))
    s.count(ev({ kind: 'missileKilled', side: 'enemy', cause: 'cm' }))     // naše obrana sestřelila příchozí
    s.count(ev({ kind: 'missileKilled', side: 'enemy', cause: 'pdlc' }))
    s.count(ev({ kind: 'missileHit', side: 'enemy' }))                     // zásah do nás
    s.count(ev({ kind: 'missileMiss', side: 'player', cause: 'lost' }))    // naše raketa ztratila cíl
    const r = s.report
    expect(r.incLaunched).toBe(8)
    expect(r.incKilled).toBe(2)
    expect(r.incHits).toBe(1)
    expect(r.incLoss).toEqual({ cm: 1, pdlc: 1 })
    expect(r.ourLoss).toEqual({ lost: 1 })
  })

  it('report je hluboká kopie (mutace nezmění tracker)', () => {
    const s = new CombatStatsTracker()
    s.count(ev({ kind: 'missileMiss', side: 'player', cause: 'cm' }))
    const r = s.report
    r.ourLoss.cm = 999
    r.ourLaunched = 999
    expect(s.report.ourLoss.cm).toBe(1)
    expect(s.report.ourLaunched).toBe(0)
  })

  it('reset vynuluje statistiku', () => {
    const s = new CombatStatsTracker()
    s.count(ev({ kind: 'launch', side: 'player', count: 5 }))
    s.reset()
    expect(s.scoring).toEqual({ ourLaunched: 0, ourHits: 0 })
  })
})
