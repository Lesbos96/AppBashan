import { describe, expect, it, vi } from 'vitest'
import { computeRouteFacts } from '../../supabase/functions/_shared/route/compute.ts'
import { deriveRoute, HttpError, parseGeocode, parseRoute, simplifyLine, type GeoFacts, type Point, type ProviderRoute } from '../../supabase/functions/_shared/route/facts.ts'
import { handleRoute, type HandlerDeps, type RateCheck } from '../../supabase/functions/_shared/route/handler.ts'
import { hmacHex } from '../../supabase/functions/_shared/route/hmac.ts'
import { orsProvider, ProviderError } from '../../supabase/functions/_shared/route/provider.ts'

const A = { lat: 48.2086, lon: 16.3731 }
const B = { lat: 47.0707, lon: 15.4395 }
const line: [number, number][] = [[16.37, 48.2], [15.44, 47.07]]
const pr = (over: Partial<ProviderRoute> = {}): ProviderRoute => ({ legMeters: [200_000], durationSeconds: 7200, line, ...over })
const inAt = (outsideKm: number): GeoFacts => ({ outsideKm, fromInAustria: true, toInAustria: true })

describe('deriveRoute', () => {
  it.each([
    ['Wien → Wien', inAt(0), 'vienna', 0],
    ['0,05 km: noch Wien', inAt(0.05), 'vienna', 0.1],
    ['knapp darüber: Österreich', inAt(0.06), 'austria', 0.1],
    ['Wien → Graz', inAt(190.04), 'austria', 190],
    ['Ziel im Ausland', { outsideKm: 300, fromInAustria: true, toInAustria: false }, 'international', 200],
    ['Start im Ausland', { outsideKm: 0, fromInAustria: false, toInAustria: true }, 'international', 0],
  ] as const)('%s', (_, geo, region, outside) => {
    const r = deriveRoute(pr(), geo)
    expect(r.region).toBe(region)
    expect(r.outsideKm).toBe(outside)
  })

  it('rundet wie der Prototyp: km auf 0,1, Fahrzeit auf 0,1 h aufgerundet, Leg 0 = einfache Strecke', () => {
    const r = deriveRoute(pr({ legMeters: [12_345, 6_000], durationSeconds: 3601 }), inAt(1))
    expect(r.distanceKm).toBe(12.3)
    expect(r.totalKm).toBe(18.3)
    expect(r.driveHours).toBe(1.1)
    expect(deriveRoute(pr({ durationSeconds: 3600 }), inAt(0)).driveHours).toBe(1)
    expect(deriveRoute(pr({ durationSeconds: 0 }), inAt(0)).driveHours).toBe(0)
  })

  it('outsideKm übersteigt nie die Gesamtstrecke', () => {
    expect(deriveRoute(pr({ legMeters: [10_000] }), inAt(12.7)).outsideKm).toBe(10)
  })

  it('lehnt eine leere Anbieterantwort ab', () => {
    expect(() => deriveRoute(pr({ legMeters: [] }), inAt(0))).toThrow(HttpError)
  })
})

describe('simplifyLine', () => {
  it('begrenzt auf 500 Punkte und behält Anfang und Ende', () => {
    const big = Array.from({ length: 4000 }, (_, i) => [i, i] as [number, number])
    const s = simplifyLine(big)
    expect(s).toHaveLength(500)
    expect(s[0]).toEqual(big[0])
    expect(s[499]).toEqual(big[3999])
    expect(simplifyLine(line)).toBe(line)
  })
})

describe('Eingaben', () => {
  it('Geocode: trimmt, 3–200 Zeichen, keine Steuerzeichen', () => {
    expect(parseGeocode({ q: '  Ring 1  ' }).q).toBe('Ring 1')
    for (const q of ['ab', 'a'.repeat(201), 'Ring\n1', 5, undefined]) expect(() => parseGeocode({ q })).toThrow(HttpError)
  })
  it('Route: genau zwei Punkte in Europa, endlich', () => {
    expect(parseRoute({ from: A, to: B })).toEqual({ from: A, to: B, returnTrip: false })
    expect(parseRoute({ from: A, to: B, returnTrip: true }).returnTrip).toBe(true)
    const bad = [
      { from: A },
      { from: A, to: { lat: 0, lon: 0 } },
      { from: A, to: { lat: NaN, lon: 16 } },
      { from: A, to: { lat: '48', lon: 16 } },
      { from: A, to: B, returnTrip: 'ja' },
      null,
    ]
    for (const b of bad) expect(() => parseRoute(b)).toThrow(HttpError)
  })
})

function makeDeps(over: Partial<HandlerDeps> = {}) {
  const store = new Map<string, ProviderRoute>()
  const route = vi.fn<(points: Point[]) => Promise<ProviderRoute>>(async () => pr())
  const geocode = vi.fn(async () => [{ label: 'Ring 1, Wien', lat: 48.2, lon: 16.37, postcode: '1010', country: 'AUT' }])
  const logs: unknown[] = []
  const deps: HandlerDeps = {
    provider: { id: 't', geocode, route },
    cache: { get: async (k) => store.get(k) ?? null, set: async (k, v) => void store.set(k, v) },
    geoFacts: async () => inAt(190),
    hmac: hmacHex('test-secret'),
    publishableKey: 'pk',
    allowedOrigins: ['http://localhost:5173'],
    takeTokens: async () => true,
    log: (e) => void logs.push(e),
    ...over,
  }
  return { deps, route, geocode, store, logs }
}

describe('computeRouteFacts', () => {
  it('cached nur die Rohantwort; Rückfahrt ist ein anderer Schlüssel', async () => {
    const { deps, route, store } = makeDeps()
    await computeRouteFacts(deps, A, B, false)
    await computeRouteFacts(deps, A, B, false)
    expect(route).toHaveBeenCalledTimes(1)
    await computeRouteFacts(deps, A, B, true)
    expect(route).toHaveBeenCalledTimes(2)
    expect(route.mock.calls[1]?.[0]).toHaveLength(3)
    expect(store.size).toBe(2)
    for (const [key, value] of store) {
      expect(key).toMatch(/^[0-9a-f]{64}$/)
      expect(Object.keys(value).sort()).toEqual(['durationSeconds', 'legMeters', 'line'])
    }
  })

  it('Region folgt der Grenze neu, auch bei Cache-Treffer', async () => {
    const { deps } = makeDeps()
    expect((await computeRouteFacts(deps, A, B, false)).region).toBe('austria')
    deps.geoFacts = async () => ({ outsideKm: 0, fromInAustria: true, toInAustria: false })
    expect((await computeRouteFacts(deps, A, B, false)).region).toBe('international')
  })

  it('fehlt die Grenze, gibt es einen Fehler und nicht „Wien"', async () => {
    const { deps } = makeDeps({ geoFacts: async () => Promise.reject(new Error('Grenze fehlt')) })
    await expect(computeRouteFacts(deps, A, B, false)).rejects.toThrow('Grenze fehlt')
  })

  it('verwirft unsinnige Anbieterwerte und cached sie nicht', async () => {
    const { deps, store } = makeDeps()
    deps.provider.route = async () => pr({ legMeters: [NaN] })
    await expect(computeRouteFacts(deps, A, B, false)).rejects.toMatchObject({ status: 502 })
    expect(store.size).toBe(0)
  })

  it('bildet Anbieterfehler ab: keine Route 422, sonst 502', async () => {
    const { deps } = makeDeps()
    deps.provider.route = async () => Promise.reject(new ProviderError('no_route'))
    await expect(computeRouteFacts(deps, A, B, false)).rejects.toMatchObject({ status: 422 })
    deps.provider.route = async () => Promise.reject(new ProviderError('unavailable'))
    await expect(computeRouteFacts(deps, A, B, false)).rejects.toMatchObject({ status: 502 })
  })
})

const post = (body: unknown, headers: Record<string, string> = { apikey: 'pk' }) =>
  new Request('http://x/route', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers })

describe('Handler', () => {
  it('verlangt POST und den apikey', async () => {
    const { deps } = makeDeps()
    expect((await handleRoute(new Request('http://x', { method: 'GET' }), deps)).status).toBe(405)
    expect((await handleRoute(post({ mode: 'geocode', q: 'Ring' }, { apikey: 'x' }), deps)).status).toBe(401)
    expect((await handleRoute(post({ mode: 'geocode', q: 'Ring' }, {}), deps)).status).toBe(401)
  })

  it('prüft Größe, JSON, Modus und Eingaben, ohne Kontingent zu verbrauchen', async () => {
    const takeTokens = vi.fn<(checks: RateCheck[]) => Promise<boolean>>(async () => true)
    const { deps, geocode } = makeDeps({ takeTokens })
    expect((await handleRoute(post('x'.repeat(5000)), deps)).status).toBe(413)
    expect((await handleRoute(post('{}', { apikey: 'pk', 'content-length': '5000' }), deps)).status).toBe(413)
    // Ohne content-length (Stream): der Handler bricht beim Lesen ab, statt alles zu puffern.
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(new TextEncoder().encode('x'.repeat(3000)))
      },
    })
    const streamed = new Request('http://x/route', { method: 'POST', body: stream, headers: { apikey: 'pk' }, duplex: 'half' } as RequestInit)
    expect((await handleRoute(streamed, deps)).status).toBe(413)
    // Gültige Streams werden angenommen, auch wenn ein Multi-Byte-Zeichen („ü“ = 2 Byte) über die Chunk-Grenze reicht.
    const bytes = new TextEncoder().encode(JSON.stringify({ mode: 'geocode', q: 'Mödling' }))
    const split = bytes.indexOf(0xc3) + 1
    const chunked = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, split))
        c.enqueue(bytes.slice(split))
        c.close()
      },
    })
    const ok = new Request('http://x/route', { method: 'POST', body: chunked, headers: { apikey: 'pk' }, duplex: 'half' } as RequestInit)
    expect((await handleRoute(ok, deps)).status).toBe(200)
    expect(geocode).toHaveBeenLastCalledWith('Mödling')
    expect((await handleRoute(new Request('http://x/route', { method: 'POST', headers: { apikey: 'pk' } }), deps)).status).toBe(400)
    expect((await handleRoute(post('{kaputt'), deps)).status).toBe(400)
    expect((await handleRoute(post({ mode: 'x' }), deps)).status).toBe(400)
    expect((await handleRoute(post({ mode: 'geocode', q: 'a' }), deps)).status).toBe(400)
    expect((await handleRoute(post({ mode: 'route', from: A }), deps)).status).toBe(400)
    expect(takeTokens).toHaveBeenCalledTimes(1) // nur der gültige Stream oben
    expect(geocode).toHaveBeenCalledTimes(1)
  })

  it('liefert Kandidaten und Routenfakten', async () => {
    const { deps } = makeDeps()
    const g = await handleRoute(post({ mode: 'geocode', q: 'Ring 1' }), deps)
    expect(await g.json()).toEqual({ candidates: [{ label: 'Ring 1, Wien', lat: 48.2, lon: 16.37, postcode: '1010', country: 'AUT' }] })
    const r = await handleRoute(post({ mode: 'route', from: A, to: B }), deps)
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toBe('no-store')
    expect(await r.json()).toMatchObject({ region: 'austria', distanceKm: 200, totalKm: 200, outsideKm: 190, driveHours: 2 })
  })

  it('zählt vier Buckets (IP gehasht, global) und lehnt über dem Limit mit 429 ab', async () => {
    const takeTokens = vi.fn<(checks: RateCheck[]) => Promise<boolean>>(async () => false)
    const { deps } = makeDeps({ takeTokens })
    const res = await handleRoute(post({ mode: 'route', from: A, to: B }, { apikey: 'pk', 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), deps)
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
    const checks = takeTokens.mock.calls[0]![0]
    expect(checks.map((c) => c.bucket.split(':').slice(0, 2).join(':'))).toEqual(['route:min', 'route:day', 'route:min', 'route:day'])
    expect(JSON.stringify(checks)).not.toContain('203.0.113.7')
    expect(checks.find((c) => c.bucket === 'route:min:global')).toMatchObject({ max: 35, window_seconds: 60 })
  })

  it('gefälschter erster x-forwarded-for-Eintrag ändert den IP-Bucket nicht', async () => {
    const takeTokens = vi.fn<(checks: RateCheck[]) => Promise<boolean>>(async () => true)
    const { deps } = makeDeps({ takeTokens })
    for (const first of ['1.1.1.1', '2.2.2.2']) {
      await handleRoute(post({ mode: 'route', from: A, to: B }, { apikey: 'pk', 'x-forwarded-for': `${first}, 198.51.100.9` }), deps)
    }
    await handleRoute(post({ mode: 'route', from: A, to: B }, { apikey: 'pk', 'cf-connecting-ip': '198.51.100.9', 'x-forwarded-for': '3.3.3.3' }), deps)
    const buckets = takeTokens.mock.calls.map((c) => c[0][0]!.bucket)
    expect(buckets).toHaveLength(3)
    expect(new Set(buckets).size).toBe(1) // letzter Eintrag bzw. cf-connecting-ip, nie der gefälschte erste
  })

  it('schließt bei Ausfall des Limiters (503), meldet Anbieterfehler und fehlende Grenze', async () => {
    const down = makeDeps({ takeTokens: async () => Promise.reject(new Error('db')) })
    expect((await handleRoute(post({ mode: 'geocode', q: 'Ring' }), down.deps)).status).toBe(503)
    const geoDown = makeDeps({ geoFacts: async () => Promise.reject(new Error('Grenze fehlt')) })
    const r = await handleRoute(post({ mode: 'route', from: A, to: B }), geoDown.deps)
    expect(r.status).toBe(500)
    expect(await r.json()).toEqual({ error: 'internal' })
    expect(geoDown.logs.at(-1)).toMatchObject({ code: 'internal:Error' })
    const prov = makeDeps()
    prov.deps.provider.geocode = async () => Promise.reject(new ProviderError('unavailable'))
    expect((await handleRoute(post({ mode: 'geocode', q: 'Ring' }), prov.deps)).status).toBe(502)
  })

  it('CORS nur für App-Origins', async () => {
    const { deps } = makeDeps()
    const ok = await handleRoute(new Request('http://x', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }), deps)
    expect(ok.status).toBe(204)
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    const other = await handleRoute(new Request('http://x', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), deps)
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('loggt nur Modus, Status, Latenz und Fehlercode', async () => {
    const { deps, logs } = makeDeps()
    await handleRoute(post({ mode: 'geocode', q: 'Geheimstraße 12' }, { apikey: 'pk', 'x-forwarded-for': '203.0.113.7' }), deps)
    await handleRoute(post({ mode: 'route', from: A, to: B }), deps)
    await handleRoute(post({ mode: 'route', from: A }), deps)
    expect(logs).toHaveLength(3)
    for (const l of logs as Record<string, unknown>[]) expect(Object.keys(l).every((k) => ['mode', 'status', 'ms', 'code'].includes(k))).toBe(true)
    const all = JSON.stringify(logs)
    for (const s of ['Geheimstraße', '203.0.113.7', '48.2086', '16.3731']) expect(all).not.toContain(s)
  })
})

describe('ORS-Adapter (Fixtures im ORS-Format)', () => {
  const res = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status })

  it('mappt Geocoding auf Kandidaten und schickt den Key nur im Header', async () => {
    const f = vi.fn(res(200, { features: [{ geometry: { coordinates: [16.37, 48.2] }, properties: { label: 'Ring 1, Wien', postalcode: '1010', country_a: 'AUT' } }, { geometry: {}, properties: { label: 'ohne Punkt' } }] }))
    const c = await orsProvider('KEY', f as never).geocode('Ring 1')
    expect(c).toEqual([{ label: 'Ring 1, Wien', lat: 48.2, lon: 16.37, postcode: '1010', country: 'AUT' }])
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url.startsWith('https://api.heigit.org/pelias/v1/search?')).toBe(true)
    expect(url).not.toContain('KEY')
    expect((init.headers as Record<string, string>).Authorization).toBe('KEY')
  })

  it('mappt Directions auf Legs, Dauer und Linie; Fehler wie vorgesehen', async () => {
    const ok = { features: [{ geometry: { coordinates: line }, properties: { segments: [{ distance: 1000, duration: 60 }, { distance: 500, duration: 30 }] } }] }
    const fetched = vi.fn(res(200, ok))
    const r = await orsProvider('K', fetched as never).route([A, B, A])
    expect((fetched.mock.calls[0] as unknown as [string])[0]).toBe('https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson')
    expect(((fetched.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>).Accept).toBe('application/geo+json')
    expect(r).toEqual({ legMeters: [1000, 500], durationSeconds: 90, line })
    await expect(orsProvider('K', res(404, {}) as never).route([A, B])).rejects.toMatchObject({ kind: 'no_route' })
    await expect(orsProvider('K', res(500, {}) as never).route([A, B])).rejects.toMatchObject({ kind: 'unavailable' })
    await expect(orsProvider(undefined).route([A, B])).rejects.toMatchObject({ kind: 'unavailable' })
  })
})
