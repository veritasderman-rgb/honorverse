/**
 * Rozprostření tažených plošin eskadry (B): každá střílející loď dostane
 * VLASTNÍ cíl z klasifikovaných živých kontaktů (dle vzdálenosti), aby 6×N
 * raket nespadlo na jednu loď. Deterministické; víc lodí než cílů → mod.
 */
import { describe, expect, it } from 'vitest'
import type { Contact } from '../src/sim/types'
import { spreadPodTargets } from '../src/sim/firecontrol'

const contact = (shipId: number, x: number, over: Partial<Contact> = {}): Contact => ({
  shipId, pos: { x, y: 0 }, vel: { x: 0, y: 0 }, age: 0, idQuality: 1,
  classGuess: 'cl-korzar', wedgeDetected: true, ...over,
})

const from = { x: 0, y: 0 }

describe('spreadPodTargets — rozdělení plošin mezi cíle', () => {
  it('tři lodě, tři nepřátelé → každá jiný cíl (dle vzdálenosti)', () => {
    const cands = [contact(20, 9_000_000), contact(21, 3_000_000), contact(22, 6_000_000)]
    const out = spreadPodTargets([1, 2, 3], cands, from)
    // střílející seřazené dle id; cíle dle vzdálenosti (21@3M, 22@6M, 20@9M)
    expect(out).toEqual([
      { shipId: 1, targetId: 21 },
      { shipId: 2, targetId: 22 },
      { shipId: 3, targetId: 20 },
    ])
    // všechny cíle různé
    expect(new Set(out.map(o => o.targetId)).size).toBe(3)
  })

  it('víc lodí než cílů → přebývající se cyklí (mod), ne všechny na jednu', () => {
    const cands = [contact(20, 2_000_000), contact(21, 5_000_000)]
    const out = spreadPodTargets([1, 2, 3, 4], cands, from)
    expect(out.map(o => o.targetId)).toEqual([20, 21, 20, 21])
  })

  it('jediný nepřítel → všechny plošiny na něj (spread nemá kam)', () => {
    const out = spreadPodTargets([1, 2], [contact(20, 4_000_000)], from)
    expect(out.map(o => o.targetId)).toEqual([20, 20])
  })

  it('žádný klasifikovaný živý kontakt → nic (paměťové piny a neklasifikované pryč)', () => {
    const cands = [
      contact(20, 3_000_000, { memory: true }),   // paměťový pin
      contact(21, 4_000_000, { idQuality: 0 }),    // jen klín, neklasifikováno
    ]
    expect(spreadPodTargets([1, 2], cands, from)).toEqual([])
  })

  it('je deterministické (stejný vstup → stejné přiřazení)', () => {
    const cands = [contact(22, 6_000_000), contact(20, 9_000_000), contact(21, 3_000_000)]
    const a = spreadPodTargets([3, 1, 2], cands, from)
    const b = spreadPodTargets([3, 1, 2], cands, from)
    expect(a).toEqual(b)
    // pořadí střílejících je znormalizováno dle id bez ohledu na vstupní pořadí
    expect(a.map(o => o.shipId)).toEqual([1, 2, 3])
  })
})
