// Anbieter-Adapter (S5). Austauschbar: `route` kennt nur dieses Interface. Produktion: openrouteservice (ORS),
// Bedingungen in docs/ARCHITECTURE.md. Weder Client-Header noch IP gehen an den Anbieter.
import { type Candidate, type Point, type ProviderRoute } from './facts.ts'

export class ProviderError extends Error {
  constructor(readonly kind: 'no_route' | 'unavailable') {
    super(kind)
  }
}

export interface RouteProvider {
  /** Teil des Cache-Schlüssels; bei geändertem Antwortverhalten hochzählen. */
  readonly id: string
  geocode(q: string): Promise<Candidate[]>
  route(points: Point[]): Promise<ProviderRoute>
}

/**
 * Basis-URLs je Dienst. HeiGIT hat api.openrouteservice.org durch api.heigit.org ersetzt (Struktur: api.heigit.org/<Dienst>/<Version>);
 * Directions liegt unter /openrouteservice, Geocoding (Pelias) unter /pelias/v1. Der Key gilt unverändert.
 */
export const ORS_URLS = {
  directions: 'https://api.heigit.org/openrouteservice',
  geocode: 'https://api.heigit.org/pelias/v1',
} as const
const TIMEOUT_MS = 8000
const VIENNA = { lon: 16.3738, lat: 48.2082 } // Suchschwerpunkt, keine Einschränkung auf ein Land

type OrsGeocode = {
  features?: {
    geometry?: { coordinates?: number[] }
    properties?: { label?: string; postalcode?: string; country_a?: string; layer?: string; street?: string; housenumber?: string; locality?: string }
  }[]
}
type OrsRoute = {
  features?: {
    geometry?: { coordinates?: [number, number][] }
    properties?: { segments?: { distance?: number; duration?: number }[] }
  }[]
}

export function orsProvider(apiKey: string | undefined, fetchFn: typeof fetch = fetch, urls: typeof ORS_URLS = ORS_URLS): RouteProvider {
  async function call(base: string, path: string, init: RequestInit): Promise<Response> {
    if (!apiKey) throw new ProviderError('unavailable')
    try {
      return await fetchFn(base + path, {
        ...init,
        headers: { Authorization: apiKey, Accept: 'application/json', ...init.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new ProviderError('unavailable')
    }
  }

  return {
    id: 'ors-v1',

    async geocode(q) {
      const params = new URLSearchParams({
        text: q,
        size: '5',
        'focus.point.lon': String(VIENNA.lon),
        'focus.point.lat': String(VIENNA.lat),
      })
      const res = await call(urls.geocode, `/search?${params}`, {})
      if (!res.ok) throw new ProviderError('unavailable')
      const body = (await res.json()) as OrsGeocode
      return (body.features ?? []).slice(0, 5).flatMap((f) => {
        const [lon, lat] = f.geometry?.coordinates ?? []
        if (typeof lon !== 'number' || typeof lat !== 'number' || !f.properties?.label) return []
        const p = f.properties
        return [
          {
            label: p.label ?? '',
            lat,
            lon,
            postcode: p.postalcode ?? null,
            country: p.country_a ?? null,
            layer: p.layer ?? null,
            street: p.street ?? null,
            housenumber: p.housenumber ?? null,
            locality: p.locality ?? null,
          },
        ]
      })
    },

    async route(points) {
      // instructions: true, weil der Dienst die Abschnitte (Distanz und Dauer je Leg) nur mit Anweisungen liefert;
      // ohne sie bleibt nur `summary` für die Gesamtstrecke, die einfache Strecke (erstes Leg) ginge verloren.
      const res = await call(urls.directions, '/v2/directions/driving-car/geojson', {
        method: 'POST',
        // Der /geojson-Endpunkt antwortet auf Accept: application/json mit 406 (Fehler 2007)
        headers: { 'Content-Type': 'application/json', Accept: 'application/geo+json' },
        body: JSON.stringify({ coordinates: points.map((p) => [p.lon, p.lat]), instructions: true, geometry_simplify: false }),
      })
      // 400/404: keine Route zwischen den Punkten (z. B. Punkt nicht an der Straße, Distanzlimit).
      if (res.status === 400 || res.status === 404) throw new ProviderError('no_route')
      if (!res.ok) throw new ProviderError('unavailable')
      const f = ((await res.json()) as OrsRoute).features?.[0]
      const segments = f?.properties?.segments ?? []
      const line = f?.geometry?.coordinates
      if (!line || line.length < 2 || segments.length !== points.length - 1) throw new ProviderError('unavailable')
      return {
        legMeters: segments.map((s) => s.distance ?? NaN),
        durationSeconds: segments.reduce((a, s) => a + (s.duration ?? NaN), 0),
        line,
      }
    },
  }
}
