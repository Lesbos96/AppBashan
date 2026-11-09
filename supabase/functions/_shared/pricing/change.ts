// Nachtrag (Konzept 5.6, 9.3): Differenzregel und Aufteilung der Journalzeile. Rein; die Gebühr rechnet allein splitFee.
import { type FeeRates, type FeeSplit, splitFee } from './fee.ts'
import type { OfferResult, PriceResult } from './result.ts'

export type ChangeCode = 'not_fixed_price' | 'change_not_increasing'
export class ChangeError extends Error {
  constructor(readonly code: ChangeCode) {
    super(code)
  }
}

/** Festpreis = kind price mit low == high; alles andere ist kein Nachtrag. */
function fixed(r: PriceResult | OfferResult): number {
  if (r.kind !== 'price' || r.lowCents !== r.highCents) throw new ChangeError('not_fixed_price')
  return r.totalCents
}

/**
 * Neuer Gesamtpreis = gebuchter Preis + Modul(neue Eingaben) − Modul(alte Eingaben); beide Aufrufe mit der gebuchten Preisversion.
 * Nur erhöhend: bei Differenz ≤ 0 (auch durch einen Mindestpreis) gibt es keinen Nachtrag.
 */
export function changeTotal(bookedCents: number, newPrice: PriceResult | OfferResult, oldPrice: PriceResult | OfferResult): number {
  const total = bookedCents + fixed(newPrice) - fixed(oldPrice)
  if (!(total > bookedCents)) throw new ChangeError('change_not_increasing')
  return total
}

/**
 * Journalzeile `change`: splitFee(neuer Gesamtpreis) mit dem bei der Annahme eingefrorenen Satz, abzüglich der Summe der bisherigen Zeilen
 * (Differenz der Komponenten, nicht splitFee(Differenz): Rundungen addieren sich nicht, Konzept 9.3).
 */
export function splitChange(newTotalCents: number, rates: FeeRates, prior: FeeSplit): FeeSplit {
  const s = splitFee(newTotalCents, rates)
  const d: FeeSplit = {
    totalCents: s.totalCents - prior.totalCents,
    feeCents: s.feeCents - prior.feeCents,
    feeNetCents: s.feeNetCents - prior.feeNetCents,
    feeVatCents: s.feeVatCents - prior.feeVatCents,
    payoutCents: s.payoutCents - prior.payoutCents,
  }
  if (d.totalCents <= 0 || Object.values(d).some((v) => v < 0)) throw new ChangeError('change_not_increasing')
  return d
}
