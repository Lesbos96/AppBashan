// Plattformgebühr (CLAUDE.md „Geld"). Die Sätze kommen als Parameter aus `platform_settings`; nur diese Funktion kennt die Gebühr.

export type FeeRates = { feeRate: number; vatRate: number }
export type FeeSplit = { totalCents: number; feeCents: number; feeNetCents: number; feeVatCents: number; payoutCents: number }

/** Satz als Basispunkte (z. B. 1500 Basispunkte). Wirft bei Sätzen mit mehr als 4 Nachkommastellen oder außerhalb [0, 1). */
function basisPoints(rate: number, name: string): number {
  const bp = Math.round(rate * 10000)
  if (!(rate >= 0 && rate < 1) || Math.abs(rate * 10000 - bp) > 1e-6) throw new Error(`Ungültiger Satz: ${name}`)
  return bp
}

/**
 * fee = round(total × Satz); netto = round(fee / (1 + USt.)); USt. = fee − netto; Partner/Vermieter = total − fee.
 * Reine Ganzzahlrechnung, gerundet wird half-up (Abweichung zum Float-Nachbau des Prototyps: PRICING.md).
 */
export function splitFee(totalCents: number, { feeRate, vatRate }: FeeRates): FeeSplit {
  if (typeof feeRate !== 'number' || typeof vatRate !== 'number') throw new Error('Sätze müssen Zahlen sein')
  if (!Number.isInteger(totalCents) || !Number.isSafeInteger(totalCents * 20000) || totalCents < 0) throw new Error('Gesamtpreis muss ganze Cent ≥ 0 sein')
  const bp = basisPoints(feeRate, 'feeRate')
  const d = 10000 + basisPoints(vatRate, 'vatRate')
  const feeCents = Math.floor((2 * totalCents * bp + 10000) / 20000)
  const feeNetCents = Math.floor((2 * feeCents * 10000 + d) / (2 * d))
  return { totalCents, feeCents, feeNetCents, feeVatCents: feeCents - feeNetCents, payoutCents: totalCents - feeCents }
}

/** Gegenbuchung im Journal: jede Betragsspalte exakt negiert (kein −0). Die Datenbank prüft dasselbe im Trigger. */
export function negateSplit(s: FeeSplit): FeeSplit {
  const n = (x: number) => (x === 0 ? 0 : -x)
  return { totalCents: n(s.totalCents), feeCents: n(s.feeCents), feeNetCents: n(s.feeNetCents), feeVatCents: n(s.feeVatCents), payoutCents: n(s.payoutCents) }
}
