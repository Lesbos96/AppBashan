// Gemeinsamer Aufbau der `quote`-Integrationstests: echter Handler, echte Datenbank, fester Routenanbieter und fester Geocoder.
// Zähler laufen unter einem Testpräfix, damit die globalen Limits unberührt bleiben. Aufräumen: `cleanupQuoteRls()`.
import { quoteDb } from '../../supabase/functions/_shared/quote/db.ts'
import { handleQuote, type QuoteDeps } from '../../supabase/functions/_shared/quote/handler.ts'
import type { Point, ProviderRoute } from '../../supabase/functions/_shared/route/facts.ts'
import type { RouteProvider } from '../../supabase/functions/_shared/route/provider.ts'
import { run, service, type TestUser } from './db.ts'
import { geocodeFake, hmac, post, settle } from './quote.ts'

// Grobe Linien (lon, lat) wie in route.test.ts
const WIEN_WIEN: ProviderRoute = { legMeters: [7500], durationSeconds: 1200, line: [[16.3731, 48.2086], [16.35, 48.2], [16.3122, 48.1845]] }
const WIEN_GRAZ: ProviderRoute = {
  legMeters: [200_000],
  durationSeconds: 7500,
  line: [[16.3731, 48.2086], [16.36, 48.15], [16.3, 48.05], [16.2, 47.9], [16.0, 47.7], [15.8, 47.55], [15.6, 47.3], [15.4395, 47.0707]],
}

/** Anbieter mit fester Antwort; `id` wählt den Cache-Namensraum (neue Kennung = leerer Cache). */
export function testProvider(id = `test-${run}`, fail: { geocode?: Error; route?: Error } = {}): RouteProvider & { geocodes: number } {
  const p = {
    id,
    geocodes: 0,
    geocode: async (q: string) => {
      p.geocodes += 1
      if (fail.geocode) throw fail.geocode
      return geocodeFake(q)
    },
    route: async (points: Point[]) => {
      if (fail.route) throw fail.route
      return points.every((pt) => pt.lat > 48) ? WIEN_WIEN : WIEN_GRAZ
    },
  }
  return p
}

export const db = quoteDb(service)
const cacheKeys: string[] = []
const geoKeys: string[] = []
export let limited = false
export const setLimited = (v: boolean) => {
  limited = v
}

export const baseDeps: QuoteDeps = {
  ...db,
  allowedOrigins: [],
  hmac,
  now: Date.now,
  log: () => {},
  // Zähler unter Testpräfix; ohne `limited` hoch genug, damit die vielen Aufrufe das Nutzerlimit nicht auslösen
  takeTokens: (checks) => db.takeTokens(checks.map((c) => ({ ...c, bucket: `test-${run}:${c.bucket}`, max: limited ? c.max : 100_000 }))),
  geocodeCache: {
    get: db.geocodeCache.get,
    set: async (key, value, ttl) => {
      geoKeys.push(key)
      await db.geocodeCache.set(key, value, ttl)
    },
  },
  route: {
    ...db.route,
    provider: testProvider(),
    hmac,
    cache: {
      get: db.route.cache.get,
      set: async (key, value, ttl) => {
        cacheKeys.push(key)
        await db.route.cache.set(key, value, ttl)
      },
    },
  },
}

export type Reply = { status: number; body: Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any -- Antwort-JSON

export const send = (user: TestUser | null, deps: QuoteDeps = baseDeps) => async (body: unknown): Promise<Reply> => {
  const res = await handleQuote(post(body, user?.jwt ?? null), deps)
  return { status: res.status, body: (await res.json()) as Reply['body'] }
}

export let ctx: { priceVersion: number; termsHash: string }
export async function initCtx(): Promise<void> {
  ctx = { priceVersion: await db.currentVersion(), termsHash: String((await db.loadTerms())['termsHash']) }
}

/** Wie die App: Preisabfrage und Bestätigung (siehe `settle`). */
export const call = (user: TestUser | null, body: unknown, deps: QuoteDeps = baseDeps): Promise<Reply> =>
  body && typeof body === 'object' && !Array.isArray(body) ? settle(send(user, deps), body as Record<string, unknown>, ctx) : send(user, deps)(body)
/** Sendet den Body unverändert. */
export const raw = (user: TestUser | null, body: unknown, deps: QuoteDeps = baseDeps) => send(user, deps)(body)

export async function cleanupQuoteRls(): Promise<void> {
  await service.from('route_rate_limits').delete().like('bucket', `test-${run}:%`)
  for (const key of cacheKeys) await service.from('route_cache').delete().eq('key', key)
  for (const key of geoKeys) await service.from('geocode_cache').delete().eq('key', key)
}
