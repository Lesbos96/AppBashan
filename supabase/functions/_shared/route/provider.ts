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

const ORS = 'https://api.openrouteservice.org'
const TIMEOUT_MS = 8000
const VIENNA = { lon: 16.3738, lat: 48.2082 } // Suchschwerpunkt, keine Einschränkung auf ein Land

type OrsGeocode = {
  features?: { geometry?: { coordinates?: number[] }; properties?: { label?: string; postalcode?: string; country_a?: string } }[]
}
type OrsRoute = {
  features?: {
    geometry?: { coordinates?: [number, number][] }
    properties?: { segments?: { distance?: number; duration?: number }[] }
  }[]
}

export function orsProvider(apiKey: string | undefined, fetchFn: typeof fetch = fetch): RouteProvider {
  async function call(path: string, init: RequestInit): Promise<Response> {
    if (!apiKey) throw new ProviderError('unavailable')
    try {
      return await fetchFn(ORS + path, {
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
      const res = await call(`/geocode/search?${params}`, {})
      if (!res.ok) throw new ProviderError('unavailable')
      const body = (await res.json()) as OrsGeocode
      return (body.features ?? []).slice(0, 5).flatMap((f) => {
        const [lon, lat] = f.geometry?.coordinates ?? []
        if (typeof lon !== 'number' || typeof lat !== 'number' || !f.properties?.label) return []
        return [{ label: f.properties.label, lat, lon, postcode: f.properties.postalcode ?? null, country: f.properties.country_a ?? null }]
      })
    },

    async route(points) {
      const res = await call('/v2/directions/driving-car/geojson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: points.map((p) => [p.lon, p.lat]), instructions: false, geometry_simplify: false }),
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
