// Edge Function `route`: Geocoding (Kandidaten) und Routenfakten. Geheimnisse (Function-Secrets):
// ORS_API_KEY, RATE_LIMIT_SECRET, PUBLISHABLE_KEY, ALLOWED_ORIGINS (kommagetrennt). SUPABASE_* setzt die Plattform.
import { createClient } from 'npm:@supabase/supabase-js@2'
import type { Database } from '../_shared/database.types.ts'
import { hmacHex } from '../_shared/route/hmac.ts'
import { handleRoute } from '../_shared/route/handler.ts'
import { orsProvider } from '../_shared/route/provider.ts'
import type { ProviderRoute } from '../_shared/route/facts.ts'

const env = (name: string): string => {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`${name} fehlt`)
  return v
}

const db = createClient<Database>(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
const provider = orsProvider(Deno.env.get('ORS_API_KEY'))
const hmac = hmacHex(env('RATE_LIMIT_SECRET'))
const publishableKey = env('PUBLISHABLE_KEY')
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((o) => o.trim()).filter(Boolean)

Deno.serve((req) =>
  handleRoute(req, {
    provider,
    hmac,
    publishableKey,
    allowedOrigins,
    log: (entry) => console.log(JSON.stringify(entry)),
    cache: {
      async get(key) {
        const { data, error } = await db.from('route_cache').select('value').eq('key', key).gt('expires_at', new Date().toISOString()).maybeSingle()
        if (error) throw error
        return (data?.value as ProviderRoute | undefined) ?? null
      },
      async set(key, value, ttlSeconds) {
        const { error } = await db
          .from('route_cache')
          .upsert({ key, value: value as never, expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString() })
        if (error) throw error
      },
    },
    async geoFacts(lineGeoJson, from, to) {
      const { data, error } = await db.rpc('route_geo_facts', {
        line_geojson: lineGeoJson,
        from_lat: from.lat,
        from_lon: from.lon,
        to_lat: to.lat,
        to_lon: to.lon,
      })
      if (error || !data?.[0]) throw error ?? new Error('keine Geo-Fakten')
      return { outsideKm: data[0].outside_km, fromInAustria: data[0].from_in_austria, toInAustria: data[0].to_in_austria }
    },
    async takeTokens(checks) {
      const { data, error } = await db.rpc('take_rate_tokens', { checks })
      if (error) throw error
      return data
    },
  }),
)
