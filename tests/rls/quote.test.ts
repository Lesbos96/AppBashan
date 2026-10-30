// Integrationstests für `quote` gegen das Dev-Projekt (npm run test:rls, sequenziell, gepaced): echter Handler mit echter
// Datenbank (Tarife, Gebührensatz, PostGIS-Fakten, Schreib-Funktionen, RLS). Nur der Routenanbieter ist fest (keine echten
// Kilometer, ORS ist nicht live getestet). Zähler laufen unter einem Testpräfix, damit die globalen Limits unberührt bleiben.
import { splitFee } from '@pricing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { quoteDb } from '../../supabase/functions/_shared/quote/db.ts'
import { handleQuote, type QuoteDeps } from '../../supabase/functions/_shared/quote/handler.ts'
import type { Point, ProviderRoute } from '../../supabase/functions/_shared/route/facts.ts'
import type { RouteProvider } from '../../supabase/functions/_shared/route/provider.ts'
import { anon, DENIED, deleteUsers, makeUser, must, pause, run, service, type TestUser } from '../support/db.ts'
import { assemblyCall, CARGO_VAN, clearanceCall, clearanceInputs, clientRef, GRAZ, hmac, moveCall, moveInputs, place, post, rentalCall, rentalInput, VIENNA_A, VIENNA_B } from '../support/quote.ts'

// Grobe Linien (lon, lat) wie in route.test.ts
const WIEN_WIEN: ProviderRoute = { legMeters: [7500], durationSeconds: 1200, line: [[16.3731, 48.2086], [16.35, 48.2], [16.3122, 48.1845]] }
const WIEN_GRAZ: ProviderRoute = {
  legMeters: [200_000],
  durationSeconds: 7500,
  line: [[16.3731, 48.2086], [16.36, 48.15], [16.3, 48.05], [16.2, 47.9], [16.0, 47.7], [15.8, 47.55], [15.6, 47.3], [15.4395, 47.0707]],
}
const provider: RouteProvider = {
  id: `test-${run}`,
  geocode: () => Promise.reject(new Error('nicht benutzt')),
  route: async (points: Point[]) => (points.every((p) => p.lat > 48) ? WIEN_WIEN : WIEN_GRAZ),
}

const db = quoteDb(service)
const cacheKeys: string[] = []
let limited = false
const deps: QuoteDeps = {
  ...db,
  allowedOrigins: [],
  hmac,
  now: Date.now,
  log: () => {},
  // Zähler unter Testpräfix; ohne `limited` hoch genug, damit die vielen Aufrufe das Nutzerlimit nicht auslösen
  takeTokens: (checks) => db.takeTokens(checks.map((c) => ({ ...c, bucket: `test-${run}:${c.bucket}`, max: limited ? c.max : 100_000 }))),
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

const call = async (user: TestUser | null, body: unknown) => {
  const res = await handleQuote(post(body, user?.jwt ?? null), deps)
  return { status: res.status, body: (await res.json()) as Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any -- Antwort-JSON
}

const dayAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const requestRow = async (id: string) => must(await service.from('service_requests').select('*').eq('id', id).single())
const splitRow = async (id: string, column: 'service_request_id' | 'rental_booking_id' = 'service_request_id') => (await service.from('fee_splits').select('*').eq(column, id)).data ?? []

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
    expect(row).toMatchObject({ customer_id: a.id, status: 'requested', estimate_cents: 68961, needs_quote: false, region: 'vienna', service: 'move' })
    expect(row.price_snapshot).toMatchObject({ kind: 'price', totalCents: 68961 })
    expect(row.route).toMatchObject({ region: 'vienna', outsideKm: 0 })
    expect(row.inputs).not.toHaveProperty('totalCents')
    expect(row.inputs).not.toHaveProperty('outsideKm')
    expect(row.price_version).toBe(res.body.priceVersion)
  })

  it('Punkte werden als (Länge, Breite) gespeichert', async () => {
    const res = await call(a, moveCall({ from: place('Start', VIENNA_A, '1010'), to: place('Ziel', VIENNA_B, '1120') }))
    const row = await requestRow(res.body.id)
    expect(row.from_postcode).toBe('1010')
    expect(lonLat(row.from_point as unknown as string)).toEqual([VIENNA_A.lon, VIENNA_A.lat])
    expect(lonLat(row.to_point as unknown as string)).toEqual([VIENNA_B.lon, VIENNA_B.lat])
    expect(row.region).toBe('vienna') // Wien-Punkte landen im Wiener Polygon, nicht vertauscht
  })

  it('Wien → Graz: Region, Kilometer und Preis kommen aus Strecke und PostGIS', async () => {
    const res = await call(a, moveCall({ to: place('Graz', GRAZ, '8010') }))
    expect(res.status).toBe(200)
    const row = await requestRow(res.body.id)
    expect(row.region).toBe('austria')
    const outside = (row.route as { outsideKm: number }).outsideKm
    expect(outside).toBeGreaterThan(100)
    expect(row.estimate_cents).toBeGreaterThan(68961)
  })

  it('fee_splits stimmt centgenau mit splitFee überein, der Kunde liest nichts, die Antwort enthält keine Gebühr', async () => {
    const res = await call(a, moveCall())
    expect(JSON.stringify(res.body)).not.toMatch(/fee|payout|platform/i)
    const [split] = await splitRow(res.body.id)
    expect(split).toBeDefined()
    const rates = must(await service.from('current_fee_rates').select('*').single())
    const expected = splitFee(68961, { feeRate: Number(rates.fee_rate), vatRate: Number(rates.fee_vat_rate) })
    expect(split).toMatchObject({
      total_cents: 68961, fee_cents: expected.feeCents, fee_net_cents: expected.feeNetCents, fee_vat_cents: expected.feeVatCents, payout_cents: expected.payoutCents,
      payee_id: null, price_version: res.body.priceVersion,
    })
    expect(expected).toMatchObject({ feeCents: 10344, feeNetCents: 8620, feeVatCents: 1724, payoutCents: 58617 })
    // Kunde und anon: kein Zugriff (RLS liefert nichts bzw. Recht fehlt)
    expect(must(await a.db.from('fee_splits').select('*'))).toEqual([])
    expect((await anon.from('fee_splits').select('*')).error?.code).toBe(DENIED)
  })

  it('Besichtigung: Sonderfall → inspection_requested, kein Preis, keine fee_splits', async () => {
    const res = await call(a, clearanceCall({ inputs: { ...clearanceInputs, special: true }, preferredDate: dayAhead(14), timeWindow: 'morning', description: 'Keller' }))
    expect(res.body).toMatchObject({ status: 'inspection_requested', needsQuote: true })
    const row = await requestRow(res.body.id)
    expect(row).toMatchObject({ estimate_cents: null, needs_quote: true, description: 'Keller', time_window: 'morning', preferred_date: dayAhead(14), region: null })
    expect(await splitRow(res.body.id)).toEqual([])
  })

  it('Entrümpelung und Montage mit den README-Beträgen', async () => {
    expect((await call(a, clearanceCall())).body.snapshot).toMatchObject({ totalCents: 117500, lowCents: 95000, highCents: 155000 })
    expect((await call(a, assemblyCall())).body.snapshot).toMatchObject({ totalCents: 77040 })
  })

  it('Idempotenz: dieselbe clientRef ergibt genau eine Anfrage, auch bei paralleler Absendung', async () => {
    const body = clearanceCall()
    const [x, y] = await Promise.all([call(a, body), call(a, body)])
    expect([x.status, y.status]).toEqual([200, 200])
    expect(y.body.id).toBe(x.body.id)
    const again = await call(a, body)
    expect(again.body.id).toBe(x.body.id)
    expect(must(await service.from('service_requests').select('id').eq('customer_id', a.id).eq('client_ref', body.clientRef))).toHaveLength(1)
    // dieselbe clientRef eines anderen Nutzers ist eine andere Anfrage
    const other = await call(b, body)
    expect(other.body.id).not.toBe(x.body.id)
  })

  it('ohne Token 401, mit fremdem Format 400, ohne Gebührensatz 500 ohne Schreiben', async () => {
    expect((await call(null, moveCall())).status).toBe(401)
    expect((await call(a, { service: 'move' })).status).toBe(400)
    const before = must(await service.from('service_requests').select('id').eq('customer_id', a.id)).length
    // Schlüssel vorübergehend umbenennen (Dev-Projekt, wie die Grenz-Tests in route.test.ts)
    must(await service.from('platform_settings').update({ key: `fee_vat_rate_${run}` }).eq('key', 'fee_vat_rate').select())
    try {
      expect(await call(a, clearanceCall())).toMatchObject({ status: 500, body: { error: 'fee_rates_missing' } })
    } finally {
      must(await service.from('platform_settings').update({ key: 'fee_vat_rate' }).eq('key', `fee_vat_rate_${run}`).select())
    }
    expect(must(await service.from('service_requests').select('id').eq('customer_id', a.id))).toHaveLength(before)
  })
})

describe('Anfrage bearbeiten (echte DB)', () => {
  const edit = (user: TestUser, requestId: string, over: Record<string, unknown> = {}) => call(user, clearanceCall({ requestId, clientRef: undefined, ...over }))

  it('rechnet neu, ersetzt die Gebührenaufteilung und behält die Anfrage', async () => {
    const created = await call(a, clearanceCall())
    const id = created.body.id
    const res = await edit(a, id, { inputs: { ...clearanceInputs, area: 80 }, description: 'größer' })
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(id)
    const row = await requestRow(id)
    expect(row.estimate_cents).toBe(res.body.snapshot.totalCents)
    expect(row.estimate_cents).not.toBe(117500)
    expect(row.description).toBe('größer')
    const splits = await splitRow(id)
    expect(splits).toHaveLength(1)
    expect(splits[0]).toMatchObject({ total_cents: row.estimate_cents, ...(() => { const s = splitFee(row.estimate_cents!, { feeRate: 0.15, vatRate: 0.2 }); return { fee_cents: s.feeCents, payout_cents: s.payoutCents } })() })
  })

  it('Preis → Angebot: Status Besichtigung, fee_splits entfällt; danach nicht mehr bearbeitbar', async () => {
    const id = (await call(a, clearanceCall())).body.id
    const res = await edit(a, id, { inputs: { ...clearanceInputs, special: true } })
    expect(res.body).toMatchObject({ status: 'inspection_requested', needsQuote: true })
    expect(await splitRow(id)).toEqual([])
    expect(await edit(a, id)).toMatchObject({ status: 409, body: { error: 'not_editable' } })
  })

  it.each(['confirmed', 'in_progress', 'completed', 'withdrawn', 'expired'] as const)('Status %s: Bearbeiten wird abgelehnt (409), nichts ändert sich', async (status) => {
    const id = (await call(a, clearanceCall())).body.id
    must(await service.from('service_requests').update({ status }).eq('id', id).select())
    const before = await requestRow(id)
    expect(await edit(a, id, { inputs: { ...clearanceInputs, area: 99 } })).toMatchObject({ status: 409, body: { error: 'not_editable' } })
    expect(await requestRow(id)).toEqual(before)
  })

  it('fremde oder unbekannte Anfrage: 404; anderer Service: 409', async () => {
    const id = (await call(a, clearanceCall())).body.id
    expect(await edit(b, id)).toMatchObject({ status: 404, body: { error: 'not_found' } })
    expect((await edit(a, '99999999-9999-4999-8999-999999999999')).status).toBe(404)
    expect((await call(a, assemblyCall({ requestId: id, clientRef: undefined }))).status).toBe(409)
    expect((await requestRow(id)).service).toBe('clearance')
  })
})

describe('Mietanfrage (echte DB)', () => {
  const rent = (user: TestUser, over: Record<string, unknown> = {}, input: Record<string, unknown> = {}) =>
    call(user, rentalCall({ inputs: { ...rentalInput, pickupAt: `${dayAhead(10)}T09:00`, returnAt: `${dayAhead(12)}T09:00`, ...input }, ...over }))

  it('Cargo Van: 276,00 €, Kaution 500,00 € separat, Gebühr, Zeiten als Zeitpunkte (Wiener Zeit)', async () => {
    const res = await rent(a)
    expect(res.status).toBe(200)
    const booking = must(await service.from('rental_bookings').select('*').eq('id', res.body.id).single())
    expect(booking).toMatchObject({ customer_id: a.id, total_cents: 27600, deposit_cents: 50000, km: 350, cover: true, status: 'requested' })
    const wall = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)).replace(' ', 'T')
    expect([wall(booking.pickup_at), wall(booking.return_at)]).toEqual([`${dayAhead(10)}T09:00`, `${dayAhead(12)}T09:00`])
    const [split] = await splitRow(booking.id, 'rental_booking_id')
    expect(split).toMatchObject({ total_cents: 27600, fee_cents: 4140, fee_net_cents: 3450, fee_vat_cents: 690, payout_cents: 23460, payee_id: null })
    expect(res.body.snapshot).toMatchObject({ days: 2, depositCents: 50000, offer: { name: 'Cargo Van' } })
    expect(must(await a.db.from('fee_splits').select('*'))).toEqual([])
  })

  it('Angebot eines Vermieters: Gebühr geht an ihn, nur er (und admin) liest die Aufteilung', async () => {
    const res = await rent(a, { offerId: landlordOffer }, { km: 0, cover: false })
    expect(res.status).toBe(200)
    const [split] = await splitRow(res.body.id, 'rental_booking_id')
    expect(split).toMatchObject({ payee_id: landlord.id, total_cents: 19800 + 0 })
    expect(must(await landlord.db.from('fee_splits').select('rental_booking_id, fee_cents').eq('rental_booking_id', res.body.id))).toHaveLength(1)
    expect(must(await b.db.from('fee_splits').select('*'))).toEqual([])
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
      p_customer: ghost, p_request: null, p_client_ref: clientRef(), p_service: 'assembly', p_status: 'requested', p_inputs: {}, p_snapshot: {},
      p_price_version: 1, p_estimate: null, p_needs_quote: true, p_from_address: null, p_from_postcode: null, p_from_lon: null, p_from_lat: null,
      p_to_address: null, p_to_postcode: null, p_to_lon: null, p_to_lat: null, p_route: null, p_region: null, p_preferred_date: null,
      p_time_window: null, p_description: null, p_volume: null, p_fee_rate: null, p_fee_vat_rate: null, p_fee_cents: null, p_fee_net: null,
      p_fee_vat: null, p_payout: null,
    }) as never
  const bookingArgs = (): never =>
    ({
      p_customer: ghost, p_client_ref: clientRef(), p_offer: CARGO_VAN, p_pickup: '2030-01-01T08:00:00Z', p_return: '2030-01-02T08:00:00Z', p_km: 0,
      p_cover: false, p_extra_driver: false, p_one_way: false, p_snapshot: {}, p_price_version: 1, p_total: 0, p_deposit: 0, p_payee: null,
      p_fee_rate: 0.15, p_fee_vat_rate: 0.2, p_fee_cents: 0, p_fee_net: 0, p_fee_vat: 0, p_payout: 0,
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
    expect(must(await a.db.from('current_fee_rates').select('*').single())).toEqual({ fee_rate: null, fee_vat_rate: null })
    expect(must(await landlord.db.from('current_fee_rates').select('*').single())).toEqual({ fee_rate: 0.15, fee_vat_rate: 0.2 })
    expect((await anon.from('current_fee_rates').select('*')).error?.code).toBe(DENIED)
  })

  it('neue Spalten: Kunde schreibt weder Beschreibung, Volumen, client_ref noch legt er Anfragen an', async () => {
    const id = (await call(a, clearanceCall({ description: 'x' }))).body.id
    for (const patch of [{ description: 'neu' }, { volume_m3: 5 }, { client_ref: clientRef() }, { estimate_cents: 1 }, { time_window: 'midday' }]) {
      expect((await a.db.from('service_requests').update(patch as never).eq('id', id)).error?.code, JSON.stringify(patch)).toBe(DENIED)
    }
    expect((await a.db.from('service_requests').insert({ customer_id: a.id, service: 'move', inputs: {}, price_snapshot: {}, price_version: 1 })).error?.code).toBe(DENIED)
    // Positivkontrolle: Zurückziehen bleibt erlaubt
    must(await a.db.from('service_requests').update({ status: 'withdrawn' }).eq('id', id).select())
  })
})

describe('Nutzerlimit (echte Zähler)', () => {
  it('ab dem 7. Aufruf in einer Minute 429', async () => {
    const user = await makeUser('quote-limit')
    limited = true
    try {
      const results: number[] = []
      for (let i = 0; i < 7; i++) results.push((await call(user, { service: 'move' })).status) // ungültig, zählt trotzdem
      expect(results).toEqual([400, 400, 400, 400, 400, 400, 429])
    } finally {
      limited = false
    }
    await pause()
  })
})
