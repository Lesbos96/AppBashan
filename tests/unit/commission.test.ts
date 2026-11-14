import { describe, expect, it } from 'vitest'
import { negateSplit, splitFee } from '@pricing'

describe('Gegenbuchung', () => {
  it.each([0, 1, 7, 100, 68961, 123457, 9_999_999])('negiert jede Betragsspalte exakt, Summe mit der Buchung ist 0 (Gesamtpreis %i)', (total) => {
    const s = splitFee(total, { tiers: [{ upToCents: null, bp: 1500 }], vatRate: 0.2 })
    const n = negateSplit(s)
    for (const k of Object.keys(s) as (keyof typeof s)[]) {
      expect(n[k] + s[k], k).toBe(0)
      expect(Object.is(n[k], -0), k).toBe(false)
    }
    expect(n.feeNetCents + n.feeVatCents).toBe(n.feeCents)
    expect(n.payoutCents).toBe(n.totalCents - n.feeCents)
  })
})
