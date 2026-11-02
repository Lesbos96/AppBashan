// Integrationstests für `quote` gegen das Dev-Projekt (npm run test:rls, sequenziell, gepaced): echter Handler mit echter
// Datenbank (Tarife, Gebührensatz, PostGIS-Fakten, Schreib-Funktionen, RLS). Nur der Routenanbieter ist fest (keine echten
// Kilometer, ORS ist nicht live getestet). Zähler laufen unter einem Testpräfix, damit die globalen Limits unberührt bleiben.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { quoteDb } from '../../supabase/functions/_shared/quote/db.ts'
import { handleQuote, type QuoteDeps } from '../../supabase/functions/_shared/quote/handler.ts'
import type { Point, ProviderRoute } from '../../supabase/functions/_shared/route/facts.ts'
import type { RouteProvider } from '../../supabase/functions/_shared/route/provider.ts'
import { anon, DENIED, deleteUsers, makeUser, must, pause, run, service, type TestUser } from '../support/db.ts'
import { assemblyCall, CARGO_VAN, CONTACT, clearanceCall, clearanceInputs, clientRef, geocodeFake, GRAZ, hmac, moveCall, moveInputs, place, post, rentalCall, rentalInput, settle, TERMS, termin, VIENNA_A, VIENNA_B } from '../support/quote.ts'

// Grobe Linien (lon, lat) wie in route.test.ts
const WIEN_WIEN: ProviderRoute = { legMeters: [7500], durationSeconds: 1200, line: [[16.3731, 48.2086], [16.35, 48.2], [16.3122, 48.1845]] }
const WIEN_GRAZ: ProviderRoute = {
  legMeters: [200_000],
  durationSeconds: 7500,
  line: [[16.3731, 48.2086], [16.36, 48.15], [16.3, 48.05], [16.2, 47.9], [16.0, 47.7], [15.8, 47.55], [15.6, 47.3], [15.4395, 47.0707]],
}
const provider: RouteProvider = {
  id: `test-${run}`,
  geocode: async (q: string) => geocodeFake(q),
  route: async (points: Point[]) => (points.every((p) => p.lat > 48) ? WIEN_WIEN : WIEN_GRAZ),
}

const db = quoteDb(service)
const cacheKeys: string[] = []
const geoKeys: string[] = []
let limited = false
const deps: QuoteDeps = {
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
    provider,
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

const send = (user: TestUser | null) => async (body: unknown) => {
  const res = await handleQuote(post(body, user?.jwt ?? null), deps)
  return { status: res.status, body: (await res.json()) as Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any -- Antwort-JSON
}
let ctx: { priceVersion: number; termsHash: string }
/** Wie die App: Preisabfrage und Bestätigung (siehe `settle`); */
const call = (user: TestUser | null, body: unknown) => (body && typeof body === 'object' && !Array.isArray(body) ? settle(send(user), body as Record<string, unknown>, ctx) : send(user)(body))

const dayAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const requestRow = async (id: string) => must(await service.from('service_requests').select('*').eq('id', id).single())
const revisionOf = async (id: string) => must(await service.from('price_revisions').select('*').eq('request_id', id).single())
const splitCount = async (column: 'service_request_id' | 'rental_booking_id', id: string) => must(await service.from('fee_splits').select('id').eq(column, id)).length

/** Länge und Breite aus dem EWKB-Hex einer geography(Point) (PostgREST liefert die Spalte so). */
function lonLat(hex: string): [number, number] {
  const b = Buffer.from(hex, 'hex')
  return [b.readDoubleLE(9), b.readDoubleLE(17)]
}

let a: TestUser
let b: TestUser
let landlord: TestUser
let landlordOffer: string

beforeAll(async () => {
  ctx = { priceVersion: await db.currentVersion(), termsHash: String((await db.loadTerms())['termsHash']) }
  a = await makeUser('quote-a')
  b = await makeUser('quote-b')
  landlord = await makeUser('quote-vermieter')
  must(await landlord.db.rpc('become_rental_provider'))
  const offer = must(
    await landlord.db
      .from('rental_offers')
      .insert({
        provider_name: 'Quote-Test', name: 'Testvan', station: 'Wien', size_m3: 10, daily_cents: 9900, km_per_day: 150, extra_km_cents: 40,
        cover_daily_cents: 2400, excess_cents: 180000, cover_excess_cents: 50000, driver_daily_cents: 1000, one_way_cents: 5900, deposit_cents: 50000,
      })
      .select('id')
      .single(),
  )
  landlordOffer = offer.id
  must(await service.from('rental_offers').update({ status: 'approved' }).eq('id', landlordOffer).select())
})

afterAll(async () => {
  await service.from('rental_offers').delete().eq('id', landlordOffer)
  await service.from('route_rate_limits').delete().like('bucket', `test-${run}:%`)
  for (const key of cacheKeys) await service.from('route_cache').delete().eq('key', key)
  for (const key of geoKeys) await service.from('geocode_cache').delete().eq('key', key)
  await deleteUsers()
})

describe('Anfrage anlegen (echte DB)', () => {
  it('manipulierter Client-Preis und Client-Strecke werden ignoriert; Anfrage gehört dem Token-Nutzer', async () => {
    const res = await call(
      a,
      moveCall({
        estimateCents: 100, totalCents: 100, status: 'confirmed', region: 'international', customerId: b.id, customer_id: b.id,
        route: { region: 'international', outsideKm: 999, driveHours: 99 },
        inputs: { ...moveInputs, totalCents: 100, outsideKm: 999 },
      }),
    )
    expect(res.status).toBe(200)
    const row = await requestRow(res.body.id)
    expect(row).toMatchObject({ customer_id: a.id, status: 'requested', region: 'vienna', service: 'move' })
    const rev = await revisionOf(res.body.id)
    expect(rev).toMatchObject({ n: 1, source: 'submit', total_cents: 68961, low_cents: 68961, high_cents: 68961, price_version: res.body.priceVersion })
    expect(rev.snapshot).toMatchObject({ kind: 'price', totalCents: 68961 })
    expect(rev.content_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(row.current_revision).toBe(rev.id)
    expect(row.route).toMatchObject({ region: 'vienna', outsideKm: 0 })
    expect(rev.inputs).not.toHaveProperty('totalCents')
    expect(rev.inputs).not.toHaveProperty('outsideKm')
  })

  it('Frist und Termin rechnet die Datenbank: Annahmefrist 24 h bei weit entferntem Termin, Termin 00:00 Wiener Zeit', async () => {
    const before = Date.now()
    const res = await call(a, moveCall({ preferredDate: termin(14) }))
    const row = await requestRow(res.body.id)
    const hours = (Date.parse(row.accept_deadline) - before) / 3_600_000
    expect(hours).toBeGreaterThan(23.9)
    expect(hours).toBeLessThan(24.2)
    const wall = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna', dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.termin_at)).replace(' ', 'T')
    expect(wall).toBe(`${termin(14)}T00:00`)
    // Zeitfenster: Beginn laut Einstellung (morning = 08:00)
    const c = await call(a, clearanceCall({ preferredDate: termin(14), timeWindow: 'morning' }))
    const crow = await requestRow(c.body.id)
    expect(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna', dateStyle: 'short', timeStyle: 'short' }).format(new Date(crow.termin_at)).replace(' ', 'T')).toBe(`${termin(14)}T08:00`)
  })

  it('Termin näher als accept_min_hours: 422 too_late, nichts gespeichert', async () => {
    const count = async () => must(await service.from('service_requests').select('id').eq('customer_id', a.id)).length
    const before = await count()
    expect(await call(a, moveCall({ preferredDate: termin(0) }))).toMatchObject({ status: 422, body: { error: 'too_late' } })
    expect(await count()).toBe(before)
  })

  it('Punkte werden als (Länge, Breite) gespeichert, Adresse und Bezirk kommen vom geprüften Kandidaten', async () => {
    const res = await call(a, moveCall())
    const row = await requestRow(res.body.id)
    expect(row).toMatchObject({ from_address: 'Stephansplatz 1, 1010 Wien', to_address: 'Meidlinger Hauptstraße 1, 1120 Wien', district: 1 })
    expect(lonLat(row.from_point as unknown as string)).toEqual([VIENNA_A.lon, VIENNA_A.lat])
    expect(lonLat(row.to_point as unknown as string)).toEqual([VIENNA_B.lon, VIENNA_B.lat])
    expect(row.region).toBe('vienna') // Wien-Punkte landen im Wiener Polygon, nicht vertauscht
  })

  it('Wien → Graz: Region, Kilometer und Preis kommen aus Strecke und PostGIS', async () => {
    const res = await call(a, moveCall({ to: place('Hauptplatz 1, Graz', GRAZ) }))
    expect(res.status).toBe(200)
    const row = await requestRow(res.body.id)
    expect(row.region).toBe('austria')
    const outside = (row.route as { outsideKm: number }).outsideKm
    expect(outside).toBeGreaterThan(100)
    expect((await revisionOf(res.body.id)).total_cents).toBeGreaterThan(68961)
  })

  it('Negativtest: quote schreibt keine fee_splits-Zeile (Anfrage und Mietanfrage), die Antwort enthält keine Gebühr', async () => {
    const res = await call(a, moveCall())
    expect(JSON.stringify(res.body).replaceAll('call_out_fee_cents', '')).not.toMatch(/fee|payout|platform/i) // Anfahrtspauschale ist eine Bedingung, keine Plattformgebühr
    expect(await splitCount('service_request_id', res.body.id)).toBe(0)
    const rent = await call(a, rentalCall({ inputs: { ...rentalInput, pickupAt: `${dayAhead(10)}T09:00`, returnAt: `${dayAhead(12)}T09:00` } }))
    expect(rent.status).toBe(200)
    expect(await splitCount('rental_booking_id', rent.body.id)).toBe(0)
    // Kunde und anon: kein Zugriff auf fee_splits (RLS liefert nichts bzw. Recht fehlt)
    expect(must(await a.db.from('fee_splits').select('*'))).toEqual([])
    expect((await anon.from('fee_splits').select('*')).error?.code).toBe(DENIED)
  })

  it('Sonderfall: awaiting_offer, kein Preis, Revision ohne Beträge', async () => {
    const res = await call(a, clearanceCall({ inputs: { ...clearanceInputs, special: true }, preferredDate: dayAhead(14), timeWindow: 'morning', description: 'Keller' }))
    expect(res.body).toMatchObject({ status: 'awaiting_offer', needsQuote: true })
    const row = await requestRow(res.body.id)
    expect(row).toMatchObject({ description: 'Keller', time_window: 'morning', preferred_date: dayAhead(14), region: null, status: 'awaiting_offer' })
    expect(await revisionOf(res.body.id)).toMatchObject({ total_cents: null, low_cents: null, high_cents: null })
  })

  it('Entrümpelung (Spanne): awaiting_offer, Revision mit low/high ohne total; Montage mit README-Betrag', async () => {
    const res = await call(a, clearanceCall())
    expect(res.body).toMatchObject({ status: 'awaiting_offer', needsQuote: true })
    expect(res.body.snapshot).toMatchObject({ lowCents: 95000, highCents: 155000 })
    expect(res.body.snapshot).not.toHaveProperty('totalCents')
    expect(await revisionOf(res.body.id)).toMatchObject({ total_cents: null, low_cents: 95000, high_cents: 155000 })
    expect((await call(a, assemblyCall())).body.snapshot).toMatchObject({ totalCents: 77040 })
  })

  it('Idempotenz: dieselbe clientRef ergibt genau eine Anfrage, auch bei paralleler Absendung', async () => {
    const body = clearanceCall()
    const [x, y] = await Promise.all([call(a, body), call(a, body)])
    expect([x.status, y.status]).toEqual([200, 200])
    expect(y.body.id).toBe(x.body.id)
    expect(y.body.snapshot).toEqual(x.body.snapshot)
    const again = await call(a, body)
    expect(again.body.id).toBe(x.body.id)
    expect(must(await service.from('service_requests').select('id').eq('customer_id', a.id).eq('client_ref', body.clientRef))).toHaveLength(1)
    expect(must(await service.from('price_revisions').select('id').eq('request_id', x.body.id))).toHaveLength(1)
    // dieselbe clientRef eines anderen Nutzers ist eine andere Anfrage
    const other = await call(b, body)
    expect(other.body.id).not.toBe(x.body.id)
  })

  it('ohne Token 401, mit fremdem Format 400 ohne Schreiben; Bearbeiten mit requestId gibt es nicht', async () => {
    expect((await call(null, moveCall())).status).toBe(401)
    const count = async () => must(await service.from('service_requests').select('id').eq('customer_id', a.id)).length
    const before = await count()
    expect((await call(a, { service: 'move' })).status).toBe(400)
    expect((await call(a, moveCall({ requestId: '99999999-9999-4999-8999-999999999999' }))).status).toBe(400)
    expect((await call(a, moveCall({ preferredDate: undefined }))).status).toBe(400)
    expect(await count()).toBe(before)
  })
})

describe('Mietanfrage (echte DB)', () => {
  const rent = (user: TestUser, over: Record<string, unknown> = {}, input: Record<string, unknown> = {}) =>
    call(user, rentalCall({ inputs: { ...rentalInput, pickupAt: `${dayAhead(10)}T09:00`, returnAt: `${dayAhead(12)}T09:00`, ...input }, ...over }))

  it('Cargo Van: 276,00 €, Kaution 500,00 € separat, Zeiten als Zeitpunkte (Wiener Zeit), keine Gebührenzeile', async () => {
    const res = await rent(a)
    expect(res.status).toBe(200)
    const booking = must(await service.from('rental_bookings').select('*').eq('id', res.body.id).single())
    expect(booking).toMatchObject({ customer_id: a.id, total_cents: 27600, deposit_cents: 50000, km: 350, cover: true, status: 'requested' })
    const wall = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)).replace(' ', 'T')
    expect([wall(booking.pickup_at), wall(booking.return_at)]).toEqual([`${dayAhead(10)}T09:00`, `${dayAhead(12)}T09:00`])
    expect(await splitCount('rental_booking_id', booking.id)).toBe(0)
    expect(res.body.snapshot).toMatchObject({ days: 2, depositCents: 50000, offer: { name: 'Cargo Van' } })
  })

  it('Angebot eines Vermieters: keine Gebührenzeile, die Antwort nennt den Vermieter nicht', async () => {
    const res = await rent(a, { offerId: landlordOffer }, { km: 0, cover: false })
    expect(res.status).toBe(200)
    expect(await splitCount('rental_booking_id', res.body.id)).toBe(0)
    expect(must(await landlord.db.from('fee_splits').select('id'))).toEqual([])
    expect(JSON.stringify(res.body)).not.toContain(landlord.id)
  })

  it('nicht freigegebenes Angebot: 404; Idempotenz: dieselbe clientRef = eine Mietanfrage', async () => {
    must(await service.from('rental_offers').update({ status: 'pending' }).eq('id', landlordOffer).select())
    expect((await rent(a, { offerId: landlordOffer })).status).toBe(404)
    must(await service.from('rental_offers').update({ status: 'approved' }).eq('id', landlordOffer).select())
    const ref = clientRef()
    const [x, y] = await Promise.all([rent(a, { clientRef: ref }), rent(a, { clientRef: ref })])
    expect(y.body.id).toBe(x.body.id)
    expect(must(await service.from('rental_bookings').select('id').eq('customer_id', a.id).eq('client_ref', ref))).toHaveLength(1)
  })
})

describe('Rechte (Verweigerung exakt, Positivkontrolle)', () => {
  // Vollständige Argumente: PostgREST löst die Funktion über die Namen auf, sonst käme PGRST202 statt der Rechteprüfung.
  const ghost = '99999999-9999-4999-8999-999999999999'
  const requestArgs = (): never =>
    ({
      p_customer: ghost, p_client_ref: clientRef(), p_service: 'assembly', p_inputs: {}, p_snapshot: { terms: TERMS }, p_price_version: 1,
      p_total: null, p_low: null, p_high: null, p_from_address: null, p_from_lon: null, p_from_lat: null,
      p_to_address: null, p_to_lon: null, p_to_lat: null, p_route: null, p_region: null, p_district: 1, p_preferred_date: dayAhead(14),
      p_time_window: null, p_description: null, p_volume: null, p_contact: CONTACT, p_confirmed: {},
    }) as never
  const bookingArgs = (): never =>
    ({
      p_customer: ghost, p_client_ref: clientRef(), p_offer: CARGO_VAN, p_pickup: '2030-01-01T08:00:00Z', p_return: '2030-01-02T08:00:00Z', p_km: 0,
      p_cover: false, p_extra_driver: false, p_one_way: false, p_snapshot: {}, p_price_version: 1, p_total: 0, p_deposit: 0,
    }) as never

  it('Schreib-Funktionen: anon und authenticated erhalten 42501, service_role darf', async () => {
    for (const who of [anon, a.db]) {
      // „for function“: Das Recht auf die Funktion fehlt, nicht erst das auf die Tabelle dahinter
      for (const [name, args] of [['quote_save_request', requestArgs()], ['quote_save_booking', bookingArgs()]] as const) {
        const { error } = await who.rpc(name, args)
        expect(error?.code, name).toBe(DENIED)
        expect(error?.message, name).toContain(`permission denied for function ${name}`)
      }
    }
    // Positivkontrolle: service_role erreicht die Funktionen (der unbekannte Kunde scheitert erst am Fremdschlüssel, 23503)
    expect((await service.rpc('quote_save_request', requestArgs())).error?.code).toBe('23503')
    expect((await service.rpc('quote_save_booking', bookingArgs())).error?.code).toBe('23503')
  })

  it('Gebührensatz: Kunde sieht nur NULL, Vermieter den Satz, anon verweigert', async () => {
    expect(must(await a.db.from('current_fee_rates').select('*').single())).toMatchObject({ fee_rate: null, fee_vat_rate: null })
    expect(must(await landlord.db.from('current_fee_rates').select('*').single())).toMatchObject({ fee_rate: 0.15, fee_vat_rate: 0.2, fee_rate_from: '2026-10-28' })
    expect((await anon.from('current_fee_rates').select('*')).error?.code).toBe(DENIED)
  })

  it('Kunde schreibt weder Spalten noch Anfragen; Zurückziehen nur über withdraw (Positivkontrolle)', async () => {
    const id = (await call(a, clearanceCall({ description: 'x' }))).body.id
    for (const patch of [{ description: 'neu' }, { volume_m3: 5 }, { client_ref: clientRef() }, { time_window: 'midday' }, { status: 'withdrawn' }]) {
      expect((await a.db.from('service_requests').update(patch as never).eq('id', id)).error?.code, JSON.stringify(patch)).toBe(DENIED)
    }
    expect((await a.db.from('service_requests').insert({ customer_id: a.id, service: 'move' } as never)).error?.code).toBe(DENIED)
    expect(must(await a.db.rpc('withdraw', { p_request: id }))).toBe('withdrawn')
  })
})

describe('Nutzerlimit (echte Zähler)', () => {
  it('ab dem 7. Aufruf in einer Minute 429', async () => {
    const user = await makeUser('quote-limit')
    limited = true
    try {
      // Die Zähler nutzen feste Minutenfenster (Epoche): nicht kurz vor dem Wechsel starten, sonst beginnt der 7. Aufruf ein neues Fenster.
      const second = new Date().getUTCSeconds()
      if (second > 45) await new Promise((resolve) => setTimeout(resolve, (61 - second) * 1000))
      const results: number[] = []
      for (let i = 0; i < 7; i++) results.push((await call(user, { service: 'move' })).status) // ungültig, zählt trotzdem
      expect(results).toEqual([400, 400, 400, 400, 400, 400, 429])
    } finally {
      limited = false
    }
    await pause()
  })
})
