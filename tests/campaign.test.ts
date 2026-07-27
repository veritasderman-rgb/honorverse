/**
 * Integrita hvězdné mapy kampaně: uzly odkazují na reálné mise, `requires`
 * míří na existující uzly, a odemykací logika ctí start / splněné požadavky /
 * hratelnost už vyčištěných misí.
 */
import { describe, expect, it } from 'vitest'
import { BONUS_REWARD, CAMPAIGN_NODES, isMissionUnlocked, podReward } from '../src/data/campaign'
import { SCENARIOS } from '../src/data/missions'
import { sim } from '../src/sim/engine'
import { SIM_DT } from '../src/sim/constants'

describe('hvězdná mapa kampaně', () => {
  const ids = new Set(CAMPAIGN_NODES.map(n => n.id))

  it('každý uzel mapy odkazuje na registrovanou misi', () => {
    for (const n of CAMPAIGN_NODES) {
      expect(SCENARIOS[n.id], `uzel ${n.id} není v SCENARIOS`).toBeDefined()
    }
  })

  it('každý požadavek (requires) míří na existující uzel', () => {
    for (const n of CAMPAIGN_NODES) {
      if (n.requires) expect(ids.has(n.requires), `${n.id} vyžaduje neznámý ${n.requires}`).toBe(true)
    }
  })

  it('id uzlů jsou unikátní', () => {
    expect(ids.size).toBe(CAMPAIGN_NODES.length)
  })

  it('právě jeden startovní uzel bez požadavku', () => {
    const starts = CAMPAIGN_NODES.filter(n => !n.requires)
    expect(starts).toHaveLength(1)
  })

  it('souřadnice leží v prostoru mapy 1000×600', () => {
    for (const n of CAMPAIGN_NODES) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.x).toBeLessThanOrEqual(1000)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeLessThanOrEqual(600)
    }
  })

  it('startovní mise je odemčená i bez postupu', () => {
    expect(isMissionUnlocked('mission00', [])).toBe(true)
    // kampaň začíná akademií — mise 1 se odemyká jejím splněním
    expect(isMissionUnlocked('mission01', [])).toBe(false)
    expect(isMissionUnlocked('mission01', ['mission00'])).toBe(true)
  })

  it('navazující mise je zamčená, dokud není splněn požadavek', () => {
    expect(isMissionUnlocked('mission02', [])).toBe(false)
    expect(isMissionUnlocked('mission02', ['mission01'])).toBe(true)
  })

  it('vyčištěná mise zůstává odemčená (opakování je povolené)', () => {
    expect(isMissionUnlocked('mission01', ['mission01'])).toBe(true)
  })

  it('neznámé id není odemčené', () => {
    expect(isMissionUnlocked('nope', ['mission01', 'mission02'])).toBe(false)
  })

  it('volitelné bonusové operace nikdy neblokují postup (nic je nevyžaduje)', () => {
    const optionalIds = new Set(CAMPAIGN_NODES.filter(n => n.optional).map(n => n.id))
    for (const n of CAMPAIGN_NODES) {
      if (n.requires) expect(optionalIds.has(n.requires), `${n.id} závisí na volitelné ${n.requires}`).toBe(false)
    }
  })

  it('boční operace jsou rozmístěné po ~3 misích hlavní linie', () => {
    const optional = CAMPAIGN_NODES.filter(n => n.optional)
    expect(optional.length).toBeGreaterThanOrEqual(3)
    // každá boční operace visí na některé hlavní misi
    for (const n of optional) {
      expect(n.requires, `boční operace ${n.id} nemá požadavek`).toBeDefined()
      const req = CAMPAIGN_NODES.find(m => m.id === n.requires)
      expect(req?.optional ?? false, `${n.id} visí na jiné boční operaci`).toBe(false)
    }
  })
})

describe('odměny za boční operace (plošiny)', () => {
  it('každý bonusový uzel má definovanou odměnu (plošiny nebo loď)', () => {
    for (const n of CAMPAIGN_NODES.filter(x => x.optional)) {
      const r = BONUS_REWARD[n.id]
      expect(r, `chybí odměna pro ${n.id}`).toBeDefined()
      expect(r.pods > 0 || r.ship != null, `${n.id} nemá žádnou odměnu`).toBe(true)
    }
  })

  it('podReward sčítá jen dokončené boční operace', () => {
    expect(podReward([])).toBe(0)
    expect(podReward(['mission01', 'mission02'])).toBe(0) // hlavní mise plošiny nedávají
    expect(podReward(['side01'])).toBe(BONUS_REWARD.side01.pods)
    expect(podReward(['side01', 'side02', 'side03']))
      .toBe(BONUS_REWARD.side01.pods + BONUS_REWARD.side02.pods + BONUS_REWARD.side03.pods)
  })
})

describe('boční operace — stabilita simulace', () => {
  // každá boční operace musí běžet ~250 s bez NaN/rozpadu (nedokončí se v tom
  // čase — jen ověřujeme numerickou stabilitu scénáře)
  for (const id of ['side01', 'side02', 'side03']) {
    it(`${id} běží 250 s stabilně`, () => {
      const state = sim.create(structuredClone(SCENARIOS[id]))
      const steps = Math.ceil(250 / SIM_DT)
      for (let i = 0; i < steps; i++) {
        sim.tick(state, SIM_DT)
        if (state.outcome !== 'running') break
      }
      for (const s of state.ships) {
        expect(Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y), `${id}: NaN pozice ${s.name}`).toBe(true)
        expect(Number.isFinite(s.vel.x) && Number.isFinite(s.vel.y), `${id}: NaN rychlost ${s.name}`).toBe(true)
      }
      for (const m of state.missiles) {
        expect(Number.isFinite(m.pos.x) && Number.isFinite(m.pos.y), `${id}: NaN raketa`).toBe(true)
      }
    })
  }
})
