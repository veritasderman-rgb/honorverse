/**
 * Akumulace bojové statistiky (odpaly / zásahy / ztráty raket) mimo prezentaci
 * — aby ji četl controller i libovolný HUD (desktop Panels i mobilní HudView),
 * ne aby ji vlastnil jeden konkrétní panel. Plní ji controller z eventů
 * snapshotu; skóre (D1 after-action) i panely z ní jen čtou.
 */
import type { SimEvent } from '../sim/types'

/** akumulovaná bojová statistika (z eventů; reset při nové misi) */
export interface CombatStats {
  ourLaunched: number; ourKilled: number; ourHits: number
  incLaunched: number; incKilled: number; incHits: number
  /** rozpad ztrát NAŠICH raket podle příčiny (cause z eventů) */
  ourLoss: Record<string, number>
  /** rozpad práce NAŠÍ obrany na příchozích raketách */
  incLoss: Record<string, number>
}

export const emptyStats = (): CombatStats => ({
  ourLaunched: 0, ourKilled: 0, ourHits: 0,
  incLaunched: 0, incKilled: 0, incHits: 0,
  ourLoss: {}, incLoss: {},
})

/** sdílený akumulátor bojové statistiky — jeden zdroj pravdy pro skóre i HUDy */
export class CombatStatsTracker {
  private stats = emptyStats()

  /** započítá jeden event (side u launch/kill/hit = strana RAKETY) */
  count(ev: SimEvent): void {
    const s = this.stats
    if (ev.kind === 'launch') {
      const n = ev.count ?? 0
      if (ev.side === 'player') s.ourLaunched += n
      else if (ev.side === 'enemy') s.incLaunched += n
    } else if (ev.kind === 'missileKilled' || ev.kind === 'missileMiss') {
      // rozpad podle příčiny (kill i miss — hráče zajímá osud každé rakety)
      const cause = ev.cause ?? 'link'
      if (ev.side === 'player') s.ourLoss[cause] = (s.ourLoss[cause] ?? 0) + 1
      else if (ev.side === 'enemy') s.incLoss[cause] = (s.incLoss[cause] ?? 0) + 1
      if (ev.kind === 'missileKilled') {
        if (ev.side === 'player') s.ourKilled++
        else if (ev.side === 'enemy') s.incKilled++
      }
    } else if (ev.kind === 'missileHit') {
      if (ev.side === 'player') s.ourHits++
      else if (ev.side === 'enemy') s.incHits++
    }
  }

  /** statistika pro skórování (odpaly/zásahy vlastní strany) */
  get scoring(): { ourLaunched: number; ourHits: number } {
    return { ourLaunched: this.stats.ourLaunched, ourHits: this.stats.ourHits }
  }

  /** plná bojová statistika pro after-action rozbor (D1) — hluboká kopie */
  get report(): CombatStats {
    return { ...this.stats, ourLoss: { ...this.stats.ourLoss }, incLoss: { ...this.stats.incLoss } }
  }

  /** reset — volat při startu nové mise */
  reset(): void { this.stats = emptyStats() }

  /** obnova ze save rozehrané mise — jinak by skóre po POKRAČOVAT počítalo
   *  jen události po obnově (rozbitá přesnost i leaderboard) */
  restore(s: CombatStats): void {
    this.stats = { ...emptyStats(), ...s, ourLoss: { ...s.ourLoss }, incLoss: { ...s.incLoss } }
  }
}
