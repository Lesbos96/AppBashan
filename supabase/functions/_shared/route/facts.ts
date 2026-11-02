// Routenfakten (S5). Rein, ohne Abhängigkeiten, läuft in Vite und Deno; Importe mit .ts-Endung.
// Semantik wie im Prototyp (calculateRoute): einfache Strecke = erstes Leg, Fahrzeit aufgerundet auf 0,1 h,
// Region nur über die Endpunkte und den Streckenanteil außerhalb Wiens (> 0,05 km).
import type { RouteFacts } from '../pricing/transport.ts'

export type Point = { lat: number; lon: number }
export type Candidate = {
  label: string
  lat: number
  lon: number
  postcode: string | null
  country: string | null
  /** Ebene des Anbieters (`address`, `venue`, `street`, …), Straße und Hausnummer für die Genauigkeitsprüfung. */
  layer: string | null
  street: string | null
  housenumber: string | null
  locality: string | null
}

/** Das einzige Adresslabel, das gespeichert und angezeigt wird: „Straße Nr, PLZ Ort“. Fehlen Teile, gilt das Label des Anbieters. */
export function canonicalLabel(c: Candidate): string {
  if (!c.street || !c.housenumber) return c.label
  const place = [c.postcode, c.locality].filter(Boolean).join(' ')
  return place ? `${c.street} ${c.housenumber}, ${place}` : `${c.street} ${c.housenumber}`
}

/** Hausnummerngenau: Ebene `address` oder `venue` mit Straße und Hausnummer. */
export const isPrecise = (c: Candidate): boolean => (c.layer === 'address' || c.layer === 'venue') && !!c.street && !!c.housenumber
/** Rohantwort des Anbieters. `line` als [lon, lat]. */
export type ProviderRoute = { legMeters: number[]; durationSeconds: number; line: [number, number][] }
/** Fakten aus den Grenzen in der DB (PostGIS). */
export type GeoFacts = { outsideKm: number; fromInAustria: boolean; toInAustria: boolean }
export type RouteResult = RouteFacts & { distanceKm: number; totalKm: number; geometry: [number, number][] }

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code)
  }
}

const round1 = (v: number) => Math.round(v / 100) / 10 // Meter → km, 1 Nachkommastelle
export const MAX_GEOMETRY_POINTS = 500

export function deriveRoute(pr: ProviderRoute, geo: GeoFacts): RouteResult {
  const [firstLeg] = pr.legMeters
  if (firstLeg === undefined || pr.line.length < 2) throw new HttpError(502, 'provider_invalid')
  const totalKm = round1(pr.legMeters.reduce((a, b) => a + b, 0))
  const region = !geo.fromInAustria || !geo.toInAustria ? 'international' : geo.outsideKm > 0.05 ? 'austria' : 'vienna'
  return {
    region,
    distanceKm: round1(firstLeg),
    totalKm,
    outsideKm: Math.min(Math.round(geo.outsideKm * 10) / 10, totalKm),
    driveHours: Math.ceil(pr.durationSeconds / 360) / 10,
    geometry: simplifyLine(pr.line),
  }
}

// ponytail: gleichmäßiges Ausdünnen statt Douglas-Peucker; für die Routengrafik reicht es, die Preisfakten nutzen die volle Geometrie.
export function simplifyLine(line: [number, number][], max = MAX_GEOMETRY_POINTS): [number, number][] {
  if (line.length <= max) return line
  const step = (line.length - 1) / (max - 1)
  return Array.from({ length: max }, (_, i) => line[Math.round(i * step)] as [number, number])
}

export const lineGeoJson = (line: [number, number][]) => JSON.stringify({ type: 'LineString', coordinates: line })

// Eingaben -------------------------------------------------------------------

const BBOX = { lat: [34, 72], lon: [-25, 45] } as const // Europa

export function point(v: unknown): Point {
  const p = v as Record<string, unknown> | null
  const lat = p?.lat
  const lon = p?.lon
  if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) throw new HttpError(400, 'invalid_point')
  if (lat < BBOX.lat[0] || lat > BBOX.lat[1] || lon < BBOX.lon[0] || lon > BBOX.lon[1]) throw new HttpError(400, 'invalid_point')
  return { lat, lon }
}

export function parseGeocode(raw: unknown): { q: string } {
  const q = (raw as { q?: unknown } | null)?.q
  if (typeof q !== 'string') throw new HttpError(400, 'invalid_query')
  const t = q.trim()
  // eslint-disable-next-line no-control-regex
  if (t.length < 3 || t.length > 200 || /[\u0000-\u001f\u007f]/.test(t)) throw new HttpError(400, 'invalid_query')
  return { q: t }
}

/** Genau Abholung und Ziel; Depot gibt es in dieser Phase nicht. */
export function parseRoute(raw: unknown): { from: Point; to: Point; returnTrip: boolean } {
  const r = raw as { from?: unknown; to?: unknown; returnTrip?: unknown } | null
  if (r?.returnTrip !== undefined && typeof r.returnTrip !== 'boolean') throw new HttpError(400, 'invalid_point')
  return { from: point(r?.from), to: point(r?.to), returnTrip: r?.returnTrip === true }
}
