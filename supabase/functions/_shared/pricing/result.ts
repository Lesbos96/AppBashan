// Ergebnisformen der compute*-Funktionen. Kundenpreise enthalten nie Gebührenfelder (Gebühr: fee.ts).
import type { Line } from './money.ts'

/** Gründe für „Persönliches Angebot" bzw. Besichtigung; die deutschen Texte stehen in der UI. */
export type OfferReason =
  | 'route_missing'
  | 'crew_lt_vehicles'
  | 'special_goods'
  | 'large_truck'
  | 'packing'
  | 'international'
  | 'commercial'
  | 'heavily_loaded'
  | 'special_case'

export type PriceResult<K extends string = string> = {
  kind: 'price'
  /** Gesamtpreis inkl. USt. in Cent. */
  totalCents: number
  /** Spanne; außer bei Entrümpelung gleich dem Gesamtpreis. */
  lowCents: number
  highCents: number
  /** Summe der Zeilen = totalCents. */
  lines: Line<K>[]
}

export type OfferResult = {
  kind: 'offer'
  reasons: OfferReason[]
  /** Klavier-Preisorientierung (nur Hinweis, kein Preis). */
  pianoGuideCents?: number
}
