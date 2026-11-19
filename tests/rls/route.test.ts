// Integration gegen das Dev-Projekt (npm run test:rls): Zugriff auf Routing-Tabellen und -Funktionen,
// PostGIS-Fakten mit festen Linien (Anbieter gemockt), Zähler. Voraussetzung: npm run geo:import.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../supabase/functions/_shared/database.types.ts'
import { deriveRoute, lineGeoJson, type ProviderRoute } from '../../supabase/functions/_shared/route/facts.ts'
import { CAPTCHA_TEST_TOKEN } from '../support/db.ts'

type Db = SupabaseClient<Database>

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} fehlt. Tests über npm run test:rls starten.`)
  return value
}
const client = (key: string): Db =>
  createClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), key, { auth: { persistSession: false, autoRefreshToken: false } })
const service = client(env('SUPABASE_SECRET_KEY'))
const anon = client(env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
const pause = () => new Promise((resolve) => setTimeout(resolve, 400))
const run = Date.now().toString(36)

let userId: string
let customer: Db

beforeAll(async () => {
  const email = `route-${run}@movenow.test`
  const password = `${crypto.randomUUID()}Aa1!`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  userId = data.user.id
  await pause()
  customer = client(env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
  const signIn = await customer.auth.signInWithPassword({ email, password, options: { captchaToken: CAPTCHA_TEST_TOKEN } })
  if (signIn.error) throw signIn.error
  await pause()
})

afterAll(async () => {
  await service.from('route_cache').delete().like('key', `test-${run}%`)
  await service.from('route_rate_limits').delete().like('bucket', `test-${run}%`)
  if (userId) await service.auth.admin.deleteUser(userId)
})

const geoArgs = (line: [number, number][]) => ({
  line_geojson: lineGeoJson(line),
  from_lat: line[0]![1]!,
  from_lon: line[0]![0]!,
  to_lat: line.at(-1)![1]!,
  to_lon: line.at(-1)![0]!,
})

// Rechte sind für anon/authenticated widerrufen (0001, 0006, 0009): PostgREST antwortet mit 42501, nicht mit leerem Ergebnis.
const DENIED = '42501'
const ROUTE_TABLES = ['route_cache', 'route_rate_limits', 'geo_boundaries'] as const

describe('Zugriff nur für service_role', () => {
  it.each([['anon'], ['authenticated']])('%s: Tabellen und Funktionen mit 42501 verweigert', async (who) => {
    const db = who === 'anon' ? anon : customer
    for (const table of ROUTE_TABLES) {
      expect((await db.from(table).select('*')).error?.code, `select ${table}`).toBe(DENIED)
    }
    expect((await db.from('route_cache').insert({ key: `test-${run}-x`, value: {}, expires_at: new Date().toISOString() })).error?.code).toBe(DENIED)
    expect((await db.from('route_rate_limits').insert({ bucket: `test-${run}-x`, window_start: new Date().toISOString() })).error?.code).toBe(DENIED)
    expect((await db.rpc('take_rate_tokens', { checks: [] })).error?.code).toBe(DENIED)
    expect((await db.rpc('route_cleanup')).error?.code).toBe(DENIED)
    expect((await db.rpc('route_geo_facts', geoArgs([[16.37, 48.2], [16.3, 48.18]]))).error?.code).toBe(DENIED)
  })

  it('service_role darf dieselben Aufrufe', async () => {
    for (const table of ROUTE_TABLES) expect((await service.from(table).select('*').limit(1)).error).toBeNull()
    expect((await service.from('geo_boundaries').select('slug').order('slug')).data?.map((r) => r.slug)).toEqual(['austria', 'vienna'])
    const key = `test-${run}-cache`
    expect((await service.from('route_cache').upsert({ key, value: { a: 1 }, expires_at: new Date(Date.now() + 60_000).toISOString() })).error).toBeNull()
    expect((await service.from('route_cache').select('value').eq('key', key).single()).data?.value).toEqual({ a: 1 })
    expect((await service.rpc('take_rate_tokens', { checks: [] })).data).toBe(true)
    expect((await service.rpc('route_cleanup')).error).toBeNull()
  })
})

describe('Löschung (route_cleanup, stündlicher Job)', () => {
  it('entfernt abgelaufene Cache-Zeilen und alte Zähler, lässt frische stehen', async () => {
    const old = `test-${run}-old`
    const fresh = `test-${run}-fresh`
    const day = 86_400_000
    must(await service.from('route_cache').upsert([
      { key: old, value: {}, expires_at: new Date(Date.now() - 60_000).toISOString() },
      { key: fresh, value: {}, expires_at: new Date(Date.now() + day).toISOString() },
    ]))
    must(await service.from('route_rate_limits').upsert([
      { bucket: old, window_start: new Date(Date.now() - 3 * day).toISOString(), hits: 1 },
      { bucket: fresh, window_start: new Date(Date.now() - day / 2).toISOString(), hits: 1 },
    ]))
    must(await service.rpc('route_cleanup'))
    expect((await service.from('route_cache').select('key').like('key', `test-${run}-%`).in('key', [old, fresh])).data?.map((r) => r.key)).toEqual([fresh])
    expect((await service.from('route_rate_limits').select('bucket').in('bucket', [old, fresh])).data?.map((r) => r.bucket)).toEqual([fresh])
  })
})

describe('Grenzen', () => {
  it('Punkte in Wien und Österreich liegen in den Grenzen (Geometrie gültig, brauchbar)', async () => {
    const { data } = await service.rpc('route_geo_facts', geoArgs([[16.3731, 48.2086], [16.3122, 48.1845]]))
    expect(data).toHaveLength(1)
    // Eine ungültige oder zu kleine Geometrie ließe diesen Punkt-Test nicht bestehen.
    expect(data![0]).toMatchObject({ from_in_austria: true, to_in_austria: true })
  })

  it('fehlende Grenze bricht ab, statt „Wien" zu liefern', async () => {
    must(await service.from('geo_boundaries').update({ slug: `vienna-${run}` }).eq('slug', 'vienna').select())
    try {
      const { error } = await service.rpc('route_geo_facts', geoArgs([[16.37, 48.2], [16.3, 48.18]]))
      expect(error?.message).toContain('Grenze fehlt')
    } finally {
      must(await service.from('geo_boundaries').update({ slug: 'vienna' }).eq('slug', `vienna-${run}`).select())
    }
  })
})

const must = <T>(r: { data: T; error: unknown }) => {
  if (r.error) throw r.error
  return r.data
}

// Grobe Linien (lon, lat) entlang der echten Strecken; Distanz und Dauer wie ein Anbieter sie liefern würde.
const FIXTURES: Record<string, { pr: ProviderRoute; region: string; outside: [number, number] }> = {
  'Wien → Wien': {
    pr: { legMeters: [7500], durationSeconds: 1200, line: [[16.3731, 48.2086], [16.35, 48.2], [16.3122, 48.1845]] },
    region: 'vienna',
    outside: [0, 0],
  },
  'Wien → Graz': {
    pr: {
      legMeters: [200_000],
      durationSeconds: 7500,
      line: [[16.3731, 48.2086], [16.36, 48.15], [16.3, 48.05], [16.2, 47.9], [16.0, 47.7], [15.8, 47.55], [15.6, 47.3], [15.4395, 47.0707]],
    },
    region: 'austria',
    outside: [120, 160],
  },
  'Wien → München': {
    pr: {
      legMeters: [435_000],
      durationSeconds: 16_200,
      line: [[16.3731, 48.2086], [15.62, 48.2], [14.29, 48.31], [13.04, 47.81], [12.12, 47.86], [11.5755, 48.1372]],
    },
    region: 'international',
    outside: [300, 435],
  },
  // Deutsches Eck: der Weg führt über deutsches Gebiet, beide Endpunkte liegen in Österreich.
  'Salzburg → Innsbruck': {
    pr: {
      legMeters: [190_000],
      durationSeconds: 7200,
      line: [[13.0457, 47.8133], [12.6, 47.9], [12.12, 47.856], [12.17, 47.58], [11.4041, 47.2692]],
    },
    region: 'austria',
    outside: [150, 190],
  },
  // Knapp außerhalb Wiens (Vösendorf/SCS): wenige km, aber über der 0,05-km-Schwelle.
  'Wien → Vösendorf': {
    pr: { legMeters: [12_000], durationSeconds: 1200, line: [[16.3731, 48.2086], [16.35, 48.15], [16.3195, 48.1135]] },
    region: 'austria',
    outside: [0.1, 6],
  },
}

describe('Routenfakten aus PostGIS (Anbieter gemockt)', () => {
  it.each(Object.entries(FIXTURES))('%s', async (_, f) => {
    const { data, error } = await service.rpc('route_geo_facts', geoArgs(f.pr.line))
    expect(error).toBeNull()
    const row = data![0]!
    const r = deriveRoute(f.pr, { outsideKm: row.outside_km, fromInAustria: row.from_in_austria, toInAustria: row.to_in_austria })
    expect(r.region).toBe(f.region)
    expect(r.outsideKm).toBeGreaterThanOrEqual(f.outside[0])
    expect(r.outsideKm).toBeLessThanOrEqual(f.outside[1])
    expect(r.outsideKm).toBeLessThanOrEqual(r.totalKm)
  })
})

describe('Zähler', () => {
  it('zählt parallele Aufrufe exakt', async () => {
    const bucket = `test-${run}-parallel`
    const check = [{ bucket, max: 5, window_seconds: 315_360_000 }]
    const results = await Promise.all(Array.from({ length: 12 }, () => service.rpc('take_rate_tokens', { checks: check })))
    expect(results.filter((r) => r.data === true)).toHaveLength(5)
    expect(results.filter((r) => r.data === false)).toHaveLength(7)
  })

  it('ein überschrittener Zähler lehnt ab und lässt die folgenden (globalen) unberührt', async () => {
    const full = { bucket: `test-${run}-full`, max: 0, window_seconds: 315_360_000 }
    const free = { bucket: `test-${run}-free`, max: 10, window_seconds: 315_360_000 }
    expect((await service.rpc('take_rate_tokens', { checks: [full, free] })).data).toBe(false)
    expect((await service.from('route_rate_limits').select('hits').eq('bucket', free.bucket)).data).toEqual([])
    expect((await service.rpc('take_rate_tokens', { checks: [free, full] })).data).toBe(false)
    expect((await service.from('route_rate_limits').select('hits').eq('bucket', free.bucket).single()).data?.hits).toBe(1)
  })

  it('eine ungültige Geometrie wird beim Schreiben repariert', async () => {
    const slug = `schleife-${run}`
    // Schleife („Schmetterling"): ungültig als Polygon, ST_MakeValid macht zwei Dreiecke daraus.
    const bowtie = { type: 'MultiPolygon', coordinates: [[[[0, 0], [2, 2], [2, 0], [0, 2], [0, 0]]]] }
    try {
      const { error } = await service.from('geo_boundaries').insert({ slug, name: 'Test', source: 'Test', geom: bowtie as never })
      expect(error).toBeNull()
    } finally {
      await service.from('geo_boundaries').delete().eq('slug', slug)
    }
  })

  it('eine leere Grenze wird abgelehnt', async () => {
    const { error } = await service.from('geo_boundaries').insert({ slug: `leer-${run}`, name: 'leer', source: 'Test', geom: { type: 'MultiPolygon', coordinates: [] } as never })
    expect(error).not.toBeNull()
  })
})
