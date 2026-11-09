import { describe, expect, it } from 'vitest'
import { type OfferResult, type PriceResult, ChangeError, changeTotal, splitChange, splitFee } from '@pricing'

const price = (cents: number, high = cents): PriceResult => ({ kind: 'price', totalCents: cents, lowCents: cents, highCents: high, lines: [{ key: 'x', cents }] })
const offer: OfferResult = { kind: 'offer', reasons: ['special_case'] }
const rates = { feeRate: 0.15, vatRate: 0.2 }
const code = (f: () => unknown) => {
  try {
    f()
  } catch (e) {
    return e instanceof ChangeError ? e.code : 'other'
  }
  return 'none'
}

describe('changeTotal (Konzept 5.6)', () => {
  it('gebuchter Preis + Modul(neu) − Modul(alt)', () => {
    expect(changeTotal(100_000, price(120_000), price(100_000))).toBe(120_000)
    // Der gebuchte Preis zählt, nicht der Modulpreis: 900,00 + (1.200,00 − 1.000,00)
    expect(changeTotal(90_000, price(120_000), price(100_000))).toBe(110_000)
  })
  it('nur erhöhend: gleicher oder niedrigerer Preis (auch durch Mindestpreis) ist kein Nachtrag', () => {
    expect(code(() => changeTotal(100_000, price(100_000), price(100_000)))).toBe('change_not_increasing')
    expect(code(() => changeTotal(100_000, price(80_000), price(100_000)))).toBe('change_not_increasing')
  })
  it('nur Festpreis: Angebot und Spanne verweigern', () => {
    expect(code(() => changeTotal(100_000, offer, price(100_000)))).toBe('not_fixed_price')
    expect(code(() => changeTotal(100_000, price(120_000), offer))).toBe('not_fixed_price')
    expect(code(() => changeTotal(100_000, price(120_000, 130_000), price(100_000)))).toBe('not_fixed_price')
  })
})

describe('splitChange (Konzept 9.3)', () => {
  const sum = (a: ReturnType<typeof splitFee>, b: ReturnType<typeof splitFee>) => ({
    totalCents: a.totalCents + b.totalCents,
    feeCents: a.feeCents + b.feeCents,
    feeNetCents: a.feeNetCents + b.feeNetCents,
    feeVatCents: a.feeVatCents + b.feeVatCents,
    payoutCents: a.payoutCents + b.payoutCents,
  })

  it.each([
    [10_000, 10_001],
    [68_961, 68_962],
    [68_961, 123_457],
    [1, 9_999_999],
    [50_000, 50_033],
  ])('Buchung + Änderung = splitFee(neu), Komponente für Komponente (%i → %i)', (a, b) => {
    const prior = splitFee(a, rates)
    const change = splitChange(b, rates, prior)
    expect(sum(prior, change)).toEqual(splitFee(b, rates))
    expect(change.feeNetCents + change.feeVatCents).toBe(change.feeCents)
    expect(change.payoutCents).toBe(change.totalCents - change.feeCents)
    expect(change.totalCents).toBe(b - a)
  })

  it('Kette: zwei Nachträge summieren sich auf splitFee(letzter Gesamtpreis)', () => {
    const b0 = splitFee(68_961, rates)
    const c1 = splitChange(80_001, rates, b0)
    const c2 = splitChange(91_237, rates, sum(b0, c1))
    expect(sum(sum(b0, c1), c2)).toEqual(splitFee(91_237, rates))
  })

  it('Rundung: jede Differenz ≥ 0, auch wenn die Gebühr bei +1 Cent gleich bleibt', () => {
    for (let t = 1; t < 400; t++) {
      const c = splitChange(t + 1, rates, splitFee(t, rates))
      for (const v of Object.values(c)) expect(v).toBeGreaterThanOrEqual(0)
    }
  })

  it('verweigert Gesamtpreis ≤ bisherigem Gesamtpreis', () => {
    expect(() => splitChange(1000, rates, splitFee(1000, rates))).toThrow()
    expect(() => splitChange(900, rates, splitFee(1000, rates))).toThrow()
  })

  it('rechnet mit dem übergebenen (eingefrorenen) Satz, nicht mit einem festen', () => {
    const old = { feeRate: 0.1, vatRate: 0.2 }
    const prior = splitFee(100_000, old)
    const c = splitChange(120_000, old, prior)
    expect(sum(prior, c)).toEqual(splitFee(120_000, old))
  })
})
