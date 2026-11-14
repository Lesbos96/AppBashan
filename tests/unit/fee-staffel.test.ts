import { type FeeTier, splitChange, splitFee, tierFee } from '@pricing'
import { describe, expect, it } from 'vitest'

// Kennung p1-1411-a: Provisionsstaffel, Erwartungswerte aus dem Auftrag s9p-1 (Basis = Kundenbrutto in Cent)
const V1: FeeTier[] = [{ upToCents: null, bp: 1500 }]
const V2: FeeTier[] = [
  { upToCents: 50000, bp: 1200 },
  { upToCents: 100000, bp: 1000 },
  { upToCents: null, bp: 700 },
]
const VAT = 0.2

describe('Provisionsstaffel Version 2 (12/10/7, progressiv, einmal gerundet)', () => {
  it.each([
    [30000, 3600],
    [50000, 6000],
    [50001, 6000],
    [68961, 7896],
    [76041, 8604],
    [80000, 9000],
    [100000, 11000],
    [100001, 11000],
    [150000, 14500],
    [300000, 25000],
    [6900, 828],
  ])('Basis %i ct → Provision %i ct', (base, fee) => {
    expect(tierFee(base, V2)).toBe(fee)
  })
  // Rundung: kaufmännisch, genau ein halber Cent rundet auf (Fable M1); Bruchteile .4 und .9 sichern „nicht abschneiden“
  it.each([
    [50004, 6000], // 6000,4
    [50005, 6001], // 6000,5
    [50009, 6001], // 6000,9
    [100050, 11004], // 11003,5 (halber Cent in Stufe 3)
  ])('Rundung: Basis %i ct → Provision %i ct', (base, fee) => {
    expect(tierFee(base, V2)).toBe(fee)
  })
})

describe('Version 1 (15 % flach) liefert die alten Werte', () => {
  it.each([
    [68961, 10344],
    [7080, 1062],
    [6900, 1035],
    [76041, 11406],
    [10, 2], // 1,5
    [68970, 10346], // 10345,5
  ])('Basis %i ct → Provision %i ct', (base, fee) => {
    expect(tierFee(base, V1)).toBe(fee)
  })
})

describe('Aufteilung und Nachtrag', () => {
  it('Buchung 68961: Provision 7896, Auszahlung 61065', () => {
    const s = splitFee(68961, { tiers: V2, vatRate: VAT })
    expect([s.feeCents, s.payoutCents, s.feeNetCents + s.feeVatCents]).toEqual([7896, 61065, 7896])
  })
  it('Nachtrag 7080 (Gesamt 76041): Provision 708 (8604 − 7896), Auszahlung 6372', () => {
    const rates = { tiers: V2, vatRate: VAT }
    const d = splitChange(76041, rates, splitFee(68961, rates))
    expect([d.totalCents, d.feeCents, d.payoutCents]).toEqual([7080, 708, 6372])
  })
  it('Netto halber Cent rundet auf: Basis 25 → Provision 3, Netto 3, USt. 0', () => {
    const s = splitFee(25, { tiers: V2, vatRate: VAT })
    expect([s.feeCents, s.feeNetCents, s.feeVatCents]).toEqual([3, 3, 0])
  })
  it('Pauschale 6900 allein: Provision 828, Auszahlung 6072', () => {
    const s = splitFee(6900, { tiers: V2, vatRate: VAT })
    expect([s.feeCents, s.payoutCents]).toEqual([828, 6072])
  })
})

describe('kaputte Stufenmengen werden abgelehnt', () => {
  it('ohne offene Stufe, nicht steigend, Stufe nach der offenen', () => {
    expect(() => tierFee(100, [{ upToCents: 50, bp: 100 }])).toThrow()
    expect(() => tierFee(100, [{ upToCents: 50, bp: 100 }, { upToCents: 50, bp: 100 }, { upToCents: null, bp: 100 }])).toThrow()
    expect(() => tierFee(100, [{ upToCents: null, bp: 100 }, { upToCents: 50, bp: 100 }])).toThrow()
  })
})
