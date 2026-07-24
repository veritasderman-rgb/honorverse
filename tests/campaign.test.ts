/**
 * Integrita hvězdné mapy kampaně: uzly odkazují na reálné mise, `requires`
 * míří na existující uzly, a odemykací logika ctí start / splněné požadavky /
 * hratelnost už vyčištěných misí.
 */
import { describe, expect, it } from 'vitest'
import { CAMPAIGN_NODES, isMissionUnlocked } from '../src/data/campaign'
import { SCENARIOS } from '../src/data/missions'

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
    expect(isMissionUnlocked('mission01', [])).toBe(true)
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
})
