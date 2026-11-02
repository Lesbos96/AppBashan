// Serverseitige Adressprüfung (S9a-3, Konzept 5.5): der Client-Punkt bindet nie, nur der passende Kandidat des Geocoders.
import { type Candidate, HttpError, type Point, isPrecise } from '../route/facts.ts'

/** Feste technische Toleranz zwischen Client-Punkt und Kandidat. */
export const TOLERANCE_M = 50

export function distanceM(a: Point, b: Point): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

/**
 * Der hausnummerngenaue Kandidat, der dem Punkt am nächsten liegt und innerhalb der Toleranz bleibt.
 * Kein Kandidat in der Nähe: 422 `address_mismatch`; nur Straße/Ort ohne Hausnummer in der Nähe: 422 `address_imprecise`.
 */
export function pickCandidate(candidates: Candidate[], p: Point): Candidate {
  const near = candidates.filter((c) => distanceM(p, c) <= TOLERANCE_M)
  if (near.length === 0) throw new HttpError(422, 'address_mismatch')
  const precise = near.filter(isPrecise).sort((a, b) => distanceM(p, a) - distanceM(p, b))
  const best = precise[0]
  if (!best) throw new HttpError(422, 'address_imprecise')
  return best
}
