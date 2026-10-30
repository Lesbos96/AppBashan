// Preis-Snapshot (S8a): nur Kunden-Positionen und die Felder des Preismoduls, nie Tarife, Gebühr oder Client-Werte.
import type { OfferResult, PriceResult } from '../pricing/index.ts'

export type QuoteService = 'transport' | 'move' | 'clearance' | 'assembly' | 'rental'

/** Zusatzfelder je Service (Anzeige wie „5 h × 70,80 €"); alles andere im Rechenergebnis wird verworfen. */
const EXTRAS: Record<QuoteService, readonly string[]> = {
  transport: ['hourlyRateCents', 'billedHours'],
  move: ['hourlyRateCents', 'billedHours'],
  clearance: ['volumeM3'],
  assembly: [],
  rental: ['days', 'includedKm', 'depositCents'],
}

export type Snapshot = Record<string, unknown>

export function buildSnapshot(service: QuoteService, result: PriceResult | OfferResult): Snapshot {
  if (result.kind === 'offer') {
    return { kind: 'offer', reasons: [...result.reasons], ...(result.pianoGuideCents !== undefined && { pianoGuideCents: result.pianoGuideCents }) }
  }
  const extras = result as unknown as Record<string, unknown>
  return {
    kind: 'price',
    totalCents: result.totalCents,
    lowCents: result.lowCents,
    highCents: result.highCents,
    lines: result.lines.map(({ key, cents }) => ({ key, cents })),
    ...Object.fromEntries(EXTRAS[service].map((k) => [k, extras[k]])),
  }
}
