// Datenbank-Anbindung des Routing-Kerns (Cache, Geo-Fakten, Zähler), gemeinsam von `route` und `quote`.
// Nur Typimport des Clients: Deno löst ihn zur Laufzeit nicht auf, der Client kommt aus index.ts.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types.ts'
import type { ProviderRoute } from './facts.ts'
import type { HandlerDeps } from './handler.ts'

export function routeDb(db: SupabaseClient<Database>): Pick<HandlerDeps, 'cache' | 'geoFacts' | 'takeTokens'> {
  return {
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
  }
}
