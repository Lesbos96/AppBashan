// Plattformgebühr (CLAUDE.md „Geld"). Die Sätze kommen als Parameter aus `platform_settings`; nur diese Funktion kennt die Gebühr.

/** Eine Stufe der Provisionsstaffel (Tabelle `fee_schedule_tiers`): obere Grenze in Cent (null = letzte, offene Stufe) und Satz in Basispunkten. */
export type FeeTier = { upToCents: number | null; bp: number }
export type FeeRates = { tiers: readonly FeeTier[]; vatRate: number }
export type FeeSplit = { totalCents: number; feeCents: number; feeNetCents: number; feeVatCents: number; payoutCents: number }

/** USt.-Satz als Basispunkte (z. B. 2000). Wirft bei Sätzen mit mehr als 4 Nachkommastellen oder außerhalb [0, 1). */
function basisPoints(rate: number, name: string): number {
  const bp = Math.round(rate * 10000)
  if (!(rate >= 0 && rate < 1) || Math.abs(rate * 10000 - bp) > 1e-6) throw new Error(`Ungültiger Satz: ${name}`)
  return bp
}

/**
 * Provision der Staffel: Summe (Anteil der Stufe × Satz in Basispunkten), EINMAL half-up auf ganze Cent (wie `private.fee_cents` in der Datenbank).
 * Wirft bei kaputter Stufenmenge (Grenzen nicht steigend, nicht genau eine offene Stufe als letzte).
 */
export function tierFee(totalCents: number, tiers: readonly FeeTier[]): number {
  if (!Number.isInteger(totalCents) || !Number.isSafeInteger(totalCents * 20000) || totalCents < 0) throw new Error('Gesamtpreis muss ganze Cent ≥ 0 sein')
  let prev = 0
  let sum = 0
  let open = false
  for (const t of tiers) {
    if (open || !Number.isInteger(t.bp) || t.bp < 0 || t.bp > 9999) throw new Error('Ungültige Staffel')
    let part: number
    if (t.upToCents === null) {
      part = totalCents - prev
      open = true
    } else {
      if (!Number.isInteger(t.upToCents) || t.upToCents <= prev) throw new Error('Ungültige Staffel')
      part = Math.min(totalCents, t.upToCents) - prev
      prev = t.upToCents
    }
    if (part > 0) sum += part * t.bp
  }
  if (!open) throw new Error('Ungültige Staffel')
  return Math.floor((2 * sum + 10000) / 20000)
}

/**
 * fee = Staffel(total); netto = round(fee / (1 + USt.)); USt. = fee − netto; Partner/Vermieter = total − fee.
 * Reine Ganzzahlrechnung, gerundet wird half-up (Abweichung zum Float-Nachbau des Prototyps: PRICING.md).
 */
export function splitFee(totalCents: number, { tiers, vatRate }: FeeRates): FeeSplit {
  if (typeof vatRate !== 'number') throw new Error('Sätze müssen Zahlen sein')
  const d = 10000 + basisPoints(vatRate, 'vatRate')
  const feeCents = tierFee(totalCents, tiers)
  const feeNetCents = Math.floor((2 * feeCents * 10000 + d) / (2 * d))
  return { totalCents, feeCents, feeNetCents, feeVatCents: feeCents - feeNetCents, payoutCents: totalCents - feeCents }
}

/** Gegenbuchung im Journal: jede Betragsspalte exakt negiert (kein −0). Die Datenbank prüft dasselbe im Trigger. */
export function negateSplit(s: FeeSplit): FeeSplit {
  const n = (x: number) => (x === 0 ? 0 : -x)
  return { totalCents: n(s.totalCents), feeCents: n(s.feeCents), feeNetCents: n(s.feeNetCents), feeVatCents: n(s.feeVatCents), payoutCents: n(s.payoutCents) }
}
