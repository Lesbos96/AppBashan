// Fakten für eine Route aus Koordinaten und eigenen Daten (S5). `quote` (S8a) ruft dieselbe Funktion auf
// und übernimmt nie Fakten vom Client. Im Cache liegt nur die Rohantwort des Anbieters; Kilometer außerhalb
// Wiens und Region werden bei jedem Aufruf frisch aus den Grenzen berechnet.
import { type GeoFacts, HttpError, type Point, type ProviderRoute, deriveRoute, lineGeoJson, type RouteResult } from './facts.ts'
import { ProviderError, type RouteProvider } from './provider.ts'

export const CACHE_TTL_SECONDS = 24 * 60 * 60

export type RouteDeps = {
  provider: RouteProvider
  cache: { get(key: string): Promise<ProviderRoute | null>; set(key: string, value: ProviderRoute, ttlSeconds: number): Promise<void> }
  geoFacts(lineGeoJson: string, from: Point, to: Point): Promise<GeoFacts>
  /** HMAC-SHA256 mit Server-Secret, hex. */
  hmac(text: string): Promise<string>
}

const valid = (r: ProviderRoute) =>
  r.legMeters.every((m) => Number.isFinite(m) && m >= 0) && Number.isFinite(r.durationSeconds) && r.durationSeconds >= 0

export async function computeRouteFacts(deps: RouteDeps, from: Point, to: Point, returnTrip: boolean): Promise<RouteResult> {
  const points = returnTrip ? [from, to, from] : [from, to]
  const key = await deps.hmac(['cache', deps.provider.id, ...points.map((p) => `${p.lat},${p.lon}`)].join('|'))

  let pr = await deps.cache.get(key)
  if (!pr) {
    try {
      pr = await deps.provider.route(points)
    } catch (e) {
      if (e instanceof ProviderError) throw new HttpError(e.kind === 'no_route' ? 422 : 502, e.kind === 'no_route' ? 'no_route' : 'provider_unavailable')
      throw e
    }
    if (!valid(pr)) throw new HttpError(502, 'provider_invalid')
    await deps.cache.set(key, pr, CACHE_TTL_SECONDS)
  }
  return deriveRoute(pr, await deps.geoFacts(lineGeoJson(pr.line), from, to))
}
