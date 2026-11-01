// `quote` ohne Netz: Handler mit Fakes. Die Pflichtkriterien aus docs/ROADMAP.md (S8a) haben je einen eigenen Test.
// Gegen die echte Datenbank laufen dieselben Wege in tests/rls/quote.test.ts. Der Routenanbieter ist fest (keine echten Kilometer).
import {
  computeClearance,
  computeRental,
  computeTransport,
  parseClearanceInput,
  parseTransportInput,
  REQUIRED_TARIFF_KEYS,
} from '@pricing'
import { describe, expect, it } from 'vitest'
import { handleQuote, type OfferRow, type QuoteDeps, type QuoteResponse, type SaveBooking, type SaveRequest } from '../../supabase/functions/_shared/quote/handler.ts'
import { buildTariffs } from '../../supabase/functions/_shared/quote/tariffs.ts'
import { HttpError, type GeoFacts, type ProviderRoute } from '../../supabase/functions/_shared/route/facts.ts'
import { ProviderError } from '../../supabase/functions/_shared/route/provider.ts'
import {
  CARGO_VAN,
  assemblyCall,
  clearanceCall,
  clearanceInputs,
  clientRef,
  fixedProvider,
  grazRoute,
  hmac,
  moveCall,
  moveInputs,
  place,
  post,
  rentalCall,
  rentalInput,
  seedRows,
  VIENNA_A,
  GRAZ,
} from '../support/quote.ts'

const cargoVan: OfferRow = {
  id: CARGO_VAN,
  providerId: null,
  providerName: 'Beispielvermieter Wien',
  name: 'Cargo Van',
  station: 'Wien · Standort Süd',
  sizeM3: 12,
  dailyCents: 9900,
  kmPerDay: 150,
  extraKmCents: 40,
  coverDailyCents: 2400,
  excessCents: 180000,
  coverExcessCents: 50000,
  driverDailyCents: 1000,
  bookingFeeCents: 1000,
  oneWayCents: 5900,
  depositCents: 50000,
}

const tariffs = buildTariffs(seedRows)
const AT_GRAZ: GeoFacts = { outsideKm: 190, fromInAustria: true, toInAustria: true }
const IN_VIENNA: GeoFacts = { outsideKm: 0, fromInAustria: true, toInAustria: true }

function setup(over: Partial<QuoteDeps> = {}, geo: GeoFacts = AT_GRAZ, route: ProviderRoute | Error = grazRoute) {
  const requests: SaveRequest[] = []
  const bookings: SaveBooking[] = []
  const existing = new Map<string, QuoteResponse>()
  const provider = fixedProvider(route)
  const cache = new Map<string, ProviderRoute>()
  const tokens: string[][] = []
  const deps: QuoteDeps = {
    allowedOrigins: [],
    hmac,
    takeTokens: async (checks) => {
      tokens.push(checks.map((c) => c.bucket))
      return true
    },
    getUserId: async (jwt) => (jwt === 'aaa.bbb.ccc' ? 'user-a' : null),
    loadPricing: async () => ({ version: 1, rows: seedRows }),
    loadOffer: async (id) => (id === CARGO_VAN ? cargoVan : null),
    findExisting: async (_user, ref) => existing.get(ref) ?? null,
    saveRequest: async (a) => {
      requests.push(a)
      // wie die Datenbank: total gesetzt = requested, sonst awaiting_offer
      const awaiting = a.totalCents === null
      return { id: 'req-1', status: awaiting ? 'awaiting_offer' : 'requested', needsQuote: awaiting, created: true }
    },
    saveBooking: async (a) => {
      bookings.push(a)
      return { id: 'book-1', status: 'requested', needsQuote: false, created: true }
    },
    route: {
      provider,
      hmac,
      cache: { get: async (k) => cache.get(k) ?? null, set: async (k, v) => void cache.set(k, v) },
      geoFacts: async () => geo,
    },
    now: () => Date.UTC(2026, 10, 1, 12), // 2026-11-01
    log: () => {},
    ...over,
  }
  const run = async (body: unknown, jwt: string | null = 'aaa.bbb.ccc') => {
    const res = await handleQuote(post(body, jwt), deps)
    return { status: res.status, body: (await res.json()) as Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any -- Antwort-JSON
  }
  return { deps, run, requests, bookings, existing, provider, tokens }
}

/** Alle Schlüssel eines JSON-Werts, auch verschachtelt. */
const keysOf = (v: unknown): string[] => (Array.isArray(v) ? v.flatMap(keysOf) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...keysOf(x)]) : [])

const sumOfLines = (snapshot: Record<string, unknown>) => (snapshot.lines as { cents: number }[]).reduce((a, l) => a + l.cents, 0)

describe('Pflichtkriterium: Strecke und Preis rechnet nur der Server', () => {
  it('übernimmt nie Kilometer, Region, Preis, Status oder Gebühr vom Client', async () => {
    const t = setup()
    const forged = {
      route: { region: 'vienna', outsideKm: 0, driveHours: 0, totalKm: 1 },
      region: 'vienna',
      outsideKm: 0,
      driveHours: 0,
      totalKm: 1,
      estimateCents: 100,
      lowCents: 1,
      highCents: 1,
      totalCents: 100,
      price_snapshot: { totalCents: 100 },
      snapshot: { totalCents: 100 },
      status: 'confirmed',
      fee: { feeCents: 1 },
      feeRate: 0.01,
      customerId: 'user-b',
      customer_id: 'user-b',
    }
    const res = await t.run(moveCall({ ...forged, inputs: { ...moveInputs, ...forged } }))
    expect(res.status).toBe(200)
    expect(t.provider.calls).toBe(1) // die Strecke wurde selbst berechnet
    const saved = t.requests[0]!
    expect(saved.route).toMatchObject({ region: 'austria', outsideKm: 190, driveHours: 2, totalKm: 200 })
    const expected = computeTransport(tariffs, parseTransportInput({ ...moveInputs, service: 'move' }), { region: 'austria', outsideKm: 190, driveHours: 2 })
    expect(expected.kind).toBe('price')
    expect(saved.totalCents).toBe(expected.kind === 'price' ? expected.totalCents : null)
    expect(saved.totalCents).not.toBe(100)
    expect(saved.lowCents).toBe(saved.totalCents)
    expect(saved.highCents).toBe(saved.totalCents)
    expect(saved.customerId).toBe('user-a')
    expect(JSON.stringify(saved)).not.toMatch(/user-b|confirmed|"totalKm":1[,}]/)
  })

  it('Wien → Wien: der Server erkennt die Region selbst, auch wenn der Client „international“ behauptet', async () => {
    const t = setup({}, IN_VIENNA)
    const res = await t.run(moveCall({ region: 'international', route: { region: 'international' } }))
    expect(res.status).toBe(200)
    expect(t.requests[0]!.totalCents).toBe(68961) // Umzug-Beispiel aus dem README
    expect(t.requests[0]!.route?.region).toBe('vienna')
  })
})

describe('Pflichtkriterium: nur geprüfte Felder werden gespeichert', () => {
  it('unbekannte Schlüssel erreichen weder inputs noch Snapshot noch die Spalten', async () => {
    const t = setup({}, IN_VIENNA)
    const evil = 'evil-key'
    const res = await t.run(
      moveCall({
        [evil]: 1,
        inputs: { ...moveInputs, [evil]: 1, assembly: { kind: 'standard', lm: 3, [evil]: 1 } },
        from: { ...place('Ring 1', VIENNA_A), [evil]: 1 },
        description: 'Zwei Sofas',
        volume: 12,
      }),
    )
    expect(res.status).toBe(200)
    const saved = t.requests[0]!
    expect(JSON.stringify(saved)).not.toContain(evil)
    expect(JSON.stringify(res.body)).not.toContain(evil)
    // inputs sind exakt das Ergebnis von parseTransportInput
    expect(saved.inputs).toEqual(parseTransportInput({ ...moveInputs, service: 'move' }))
    // Snapshot: nur diese Felder
    expect(Object.keys(saved.snapshot).sort()).toEqual(['billedHours', 'highCents', 'hourlyRateCents', 'kind', 'lines', 'lowCents', 'totalCents'])
    expect(saved.description).toBe('Zwei Sofas')
    expect(saved.volumeM3).toBe(12)
  })

  it('Nicht-Preisfelder haben eigene Grenzen; Montage und Entrümpelung kennen keine Strecke und kein Volumen', async () => {
    const t = setup()
    for (const bad of [{ description: 'x'.repeat(501) }, { description: 'a\u0000b' }, { volume: 0 }, { volume: 101 }, { preferredDate: '2026-10-31' }, { preferredDate: '2028-01-01' }, { preferredDate: '2026-02-30' }]) {
      expect((await t.run(moveCall(bad))).status, JSON.stringify(bad)).toBe(400)
    }
    expect((await t.run(moveCall({ from: { label: 'x', point: { lat: 1, lon: 1 } } }))).status).toBe(400) // außerhalb Europas
    expect((await t.run(moveCall({ timeWindow: 'night' }))).status).toBe(200) // für Transport ohne Wirkung
    expect(t.requests.at(-1)!.timeWindow).toBeNull()
    expect((await t.run(clearanceCall({ timeWindow: 'night' }))).status).toBe(400)
    const c = await t.run(clearanceCall({ timeWindow: 'morning', preferredDate: '2026-11-20', description: 'Keller', volume: 50, to: place('Graz', GRAZ) }))
    expect(c.status).toBe(200)
    expect(t.requests.at(-1)).toMatchObject({ timeWindow: 'morning', preferredDate: '2026-11-20', description: 'Keller', volumeM3: null, to: null, route: null })
    expect(t.provider.calls).toBe(1) // nur der Umzug von oben mit gültiger Strecke; Entrümpelung ruft `route` nie
  })
})

describe('Pflichtkriterium: Tarife', () => {
  it('bricht bei fehlenden Tarifschlüsseln ab und schreibt nichts', async () => {
    const rows = seedRows.filter((r) => r.key !== 'team_rate.3')
    const t = setup({ loadPricing: async () => ({ version: 1, rows }) })
    // auch eine Anfrage, die den fehlenden Schlüssel gar nicht braucht (Team 2), wird nicht mit Teilpreis gespeichert
    const res = await t.run(moveCall({ inputs: { ...moveInputs, crew: 2 } }))
    expect(res).toMatchObject({ status: 500, body: { error: 'tariff_incomplete' } })
    expect(t.requests).toHaveLength(0)
    expect(t.provider.calls).toBe(0)
  })

  it('übernimmt die Zeile rental.reference (unit ref) weder in die Tarife noch in den Snapshot', async () => {
    const ref = seedRows.find((r) => r.unit === 'ref')
    expect(ref?.key).toBe('rental.reference')
    expect(buildTariffs(seedRows)).not.toHaveProperty('rental.reference')
    const t = setup({}, IN_VIENNA)
    await t.run(moveCall())
    await t.run(clearanceCall())
    await t.run(rentalCall())
    expect(JSON.stringify([t.requests, t.bookings])).not.toMatch(/rental\.reference|"ref"/)
    // eine ref-Zeile mit Wert ändert keinen Preis
    const withValue = seedRows.map((r) => (r.unit === 'ref' ? { ...r, value: 999 } : r))
    expect(buildTariffs(withValue)).toEqual(buildTariffs(seedRows))
  })

  it('REQUIRED_TARIFF_KEYS sind genau die Nicht-ref-Schlüssel aus supabase/seed.sql', () => {
    expect([...REQUIRED_TARIFF_KEYS].sort()).toEqual(seedRows.filter((r) => r.unit !== 'ref').map((r) => r.key).sort())
  })

  it.each([
    ['null', null],
    ['negativ', -1],
    ['Text', 'viel'],
  ])('ungültiger Tarifwert (%s) bricht ab', async (_, value) => {
    const rows = seedRows.map((r) => (r.key === 'box' ? { ...r, value } : r))
    const t = setup({ loadPricing: async () => ({ version: 1, rows }) })
    expect((await t.run(moveCall())).status).toBe(500)
    expect(t.requests).toHaveLength(0)
  })

  it('quote kennt keine Gebühr: der Schreibaufruf trägt weder Satz noch Aufteilung', async () => {
    const t = setup({}, IN_VIENNA)
    for (const call of [moveCall(), clearanceCall(), assemblyCall()]) await t.run(call)
    await t.run(rentalCall())
    expect(keysOf([...t.requests, ...t.bookings]).filter((k) => /^(fee|payout|payee|platform|commission|vat)/i.test(k))).toEqual([])
  })
})

describe('Pflichtkriterium: Miettage in Wiener Ortszeit', () => {
  const rent = (pickupAt: string, returnAt: string, now = Date.UTC(2026, 10, 1)) => {
    const t = setup({ now: () => now })
    return t.run(rentalCall({ inputs: { ...rentalInput, pickupAt, returnAt, km: 0, cover: false } })).then((res) => ({ res, saved: t.bookings[0] }))
  }

  it('Wanduhrzeit: Miettage zählen nach Wiener Uhr, die Spalten bekommen den UTC-Zeitpunkt', async () => {
    // Sommerzeit-Ende 25.10.2026: 11:00 MESZ bis 10:30 MEZ = 23,5 Stunden Wanduhr = 1 Tag
    const october = await rent('2026-10-24T11:00', '2026-10-25T10:30', Date.UTC(2026, 9, 1))
    expect(october.saved?.snapshot.days).toBe(1)
    expect(october.saved).toMatchObject({ pickupAt: '2026-10-24T09:00:00.000Z', returnAt: '2026-10-25T09:30:00.000Z' })
    const winter = await rent('2026-11-10T09:00', '2026-11-12T09:00')
    expect(winter.saved?.pickupAt).toBe('2026-11-10T08:00:00.000Z')
  })

  it.each([
    ['Z', '2026-11-10T08:00:00Z', '2026-11-12T08:00:00Z'],
    ['Z ohne Sekunden', '2026-11-10T08:00Z', '2026-11-12T08:00Z'],
    ['+01:00', '2026-11-10T09:00:00+01:00', '2026-11-12T09:00:00+01:00'],
    ['Sekunden ohne Zone', '2026-11-10T09:00:00', '2026-11-12T09:00:00'],
    ['24:00', '2026-11-10T24:00', '2026-11-12T09:00'],
    ['Minuten 60', '2026-11-10T10:60', '2026-11-12T09:00'],
  ])('lehnt Mietzeit mit %s ab (400 invalid_input, nichts gespeichert)', async (_name, pickupAt, returnAt) => {
    const out = await rent(pickupAt, returnAt)
    expect(out.res.status).toBe(400)
    expect(out.res.body).toMatchObject({ error: 'invalid_input' })
    expect(out.saved).toBeUndefined()
  })

  it('Rückgabe mit Z wird ebenfalls abgelehnt, mit Feldpräfix returnAt', async () => {
    const out = await rent('2026-11-10T09:00', '2026-11-12T08:00:00Z')
    expect(out.res.status).toBe(400)
    expect(out.res.body).toMatchObject({ message: expect.stringMatching(/^returnAt:/) })
  })

  it('Uhrzeit, die es wegen der Zeitumstellung nicht gibt, wird abgelehnt (Präfix pickupAt); die doppelte Stunde gilt als die frühere', async () => {
    const missing = await rent('2027-03-28T02:30', '2027-03-29T02:30', Date.UTC(2027, 2, 1))
    expect(missing.res.status).toBe(400)
    expect(missing.res.body).toMatchObject({ message: expect.stringMatching(/^pickupAt:/) })
    const twice = await rent('2026-10-25T02:30', '2026-10-26T02:30', Date.UTC(2026, 9, 1))
    expect(twice.res.status).toBe(200)
    expect(twice.saved).toMatchObject({ pickupAt: '2026-10-25T00:30:00.000Z', returnAt: '2026-10-26T01:30:00.000Z' })
    expect(twice.saved?.snapshot.days).toBe(1)
  })

  it('Abholung heute zu einer schon vergangenen Uhrzeit wird abgelehnt', async () => {
    const noon = Date.UTC(2026, 10, 1, 11) // 12:00 Wiener Zeit am 01.11.2026
    expect((await rent('2026-11-01T11:00', '2026-11-02T11:00', noon)).res.status).toBe(400)
    expect((await rent('2026-11-01T12:30', '2026-11-02T12:30', noon)).res.status).toBe(200)
  })

  it('Abholung nicht in der Vergangenheit, Rückgabe nach Abholung, höchstens 90 Tage, ganze Kilometer', async () => {
    expect((await rent('2026-10-31T09:00', '2026-11-02T09:00')).res.status).toBe(400)
    expect((await rent('2026-11-10T09:00', '2026-11-10T09:00')).res.status).toBe(400)
    expect((await rent('2026-11-10T09:00', '2027-03-10T09:00')).res.status).toBe(400)
    const t = setup()
    expect((await t.run(rentalCall({ inputs: { ...rentalInput, km: 10.5 } }))).status).toBe(400)
    expect((await t.run(rentalCall({ inputs: { ...rentalInput, pickupAt: 'morgen' } }))).status).toBe(400)
  })
})

describe('Pflichtkriterium: ganze Cent und Summen', () => {
  const calls: [string, () => unknown, GeoFacts][] = [
    ['Umzug', () => moveCall(), IN_VIENNA],
    ['Umzug Graz', () => moveCall(), AT_GRAZ],
    ['Transport', () => moveCall({ service: 'transport', inputs: { ...moveInputs, hours: 2.5, boxes: 0, parking: 0 } }), IN_VIENNA],
    ['Montage Küche', () => assemblyCall(), IN_VIENNA],
  ]
  it.each(calls)('%s: Gesamtpreis = Summe der Zeilen, Festpreis total = low = high', async (_, call, geo) => {
    const t = setup({}, geo)
    const res = await t.run(call())
    expect(res.status).toBe(200)
    const saved = t.requests[0]!
    const total = res.body.snapshot.totalCents as number
    expect(Number.isInteger(total)).toBe(true)
    expect(saved).toMatchObject({ totalCents: total, lowCents: total, highCents: total })
    expect(sumOfLines(res.body.snapshot)).toBe(total)
    for (const l of res.body.snapshot.lines as { cents: number }[]) expect(Number.isInteger(l.cents)).toBe(true)
  })

  it('Entrümpelung (Spanne): kein verbindlicher Gesamtpreis, Zeilen liegen in der Spanne', async () => {
    const t = setup({}, IN_VIENNA)
    const res = await t.run(clearanceCall())
    expect(res.body).toMatchObject({ status: 'awaiting_offer', needsQuote: true })
    expect(res.body.snapshot).not.toHaveProperty('totalCents')
    expect(t.requests[0]).toMatchObject({ totalCents: null, lowCents: 95000, highCents: 155000 })
    for (const l of res.body.snapshot.lines as { cents: number }[]) expect(Number.isInteger(l.cents)).toBe(true)
    expect(sumOfLines(res.body.snapshot)).toBeGreaterThanOrEqual(95000)
    expect(sumOfLines(res.body.snapshot)).toBeLessThanOrEqual(155000)
  })

  it('Entrümpelung 1.175,00 € und Küche 770,40 € wie im README', async () => {
    const t = setup()
    expect(sumOfLines((await t.run(clearanceCall())).body.snapshot)).toBe(117500)
    expect((await t.run(assemblyCall())).body.snapshot).toMatchObject({ totalCents: 77040 })
    const expected = computeClearance(tariffs, parseClearanceInput(clearanceInputs))
    expect(expected.kind).toBe('price')
  })

  it('Miete: Cargo Van 276,00 €, Kaution 500,00 € separat', async () => {
    const t = setup()
    const res = await t.run(rentalCall())
    expect(res.status).toBe(200)
    const b = t.bookings[0]!
    expect(b).toMatchObject({ totalCents: 27600, depositCents: 50000 })
    expect(res.body.snapshot).toMatchObject({ days: 2, includedKm: 300, depositCents: 50000 })
    expect(sumOfLines(res.body.snapshot)).toBe(27600)
    expect(res.body.snapshot.offer).toMatchObject({ name: 'Cargo Van', depositCents: 50000 })
    expect(JSON.stringify(res.body)).not.toMatch(/providerId|provider_id|payee/)
    const { dailyCents, kmPerDay, extraKmCents, coverDailyCents, driverDailyCents, bookingFeeCents, oneWayCents, depositCents } = cargoVan
    const direct = computeRental({ dailyCents, kmPerDay, extraKmCents, coverDailyCents, driverDailyCents, bookingFeeCents, oneWayCents, depositCents }, rentalInput)
    expect(direct.totalCents).toBe(27600)
  })
})

describe('Antwort', () => {
  it('enthält nur Kundenfelder: keine Gebühr, kein Partneranteil, keine Sätze', async () => {
    const t = setup({}, IN_VIENNA)
    for (const call of [moveCall(), clearanceCall(), assemblyCall(), rentalCall()]) {
      const res = await t.run(call)
      expect(Object.keys(res.body).sort()).toEqual(['id', 'needsQuote', 'priceVersion', 'snapshot', 'status'])
      expect(keysOf(res.body).filter((k) => /^(fee|payout|platform|commission|provision|vat)/i.test(k))).toEqual([])
    }
  })
})

describe('Status und Angebote', () => {
  it('Sonderfall bei Entrümpelung → wartet auf Angebot, ohne Preis', async () => {
    const t = setup()
    const res = await t.run(clearanceCall({ inputs: { ...clearanceInputs, special: true } }))
    expect(res.body).toMatchObject({ status: 'awaiting_offer', needsQuote: true })
    expect(res.body.snapshot).toMatchObject({ kind: 'offer', reasons: ['special_case'] })
    expect(t.requests[0]).toMatchObject({ totalCents: null, lowCents: null, highCents: null })
  })

  it('Klavier → Angebot, Status „wartet auf Angebot“', async () => {
    const t = setup({}, IN_VIENNA)
    const res = await t.run(moveCall({ inputs: { ...moveInputs, goods: 'piano' } }))
    expect(res.body).toMatchObject({ status: 'awaiting_offer', needsQuote: true })
    expect(t.requests[0]).toMatchObject({ totalCents: null, lowCents: null, highCents: null })
  })

  it('Ohne Koordinaten: Angebot route_missing, kein Aufruf des Anbieters', async () => {
    const t = setup()
    const res = await t.run(moveCall({ from: place('Irgendwo', null), to: null }))
    expect(res.body.snapshot).toMatchObject({ kind: 'offer', reasons: ['route_missing'] })
    expect(t.provider.calls).toBe(0)
  })

  it.each([
    ['Anbieter nicht erreichbar', { route: new ProviderError('unavailable') }, {}],
    ['keine Route', { route: new ProviderError('no_route') }, {}],
    ['Zähler erschöpft', {}, { takeTokens: async (c: { bucket: string }[]) => !c.some((x) => x.bucket.startsWith('route:')) }],
  ])('%s: Angebot route_missing statt Ablehnung', async (_, { route }: { route?: Error }, over) => {
    const t = setup(over, AT_GRAZ, route)
    const res = await t.run(moveCall())
    expect(res.status).toBe(200)
    expect(res.body.snapshot).toMatchObject({ kind: 'offer', reasons: ['route_missing'] })
    expect(t.requests[0]).toMatchObject({ totalCents: null, route: null })
  })

  it('Ausfall des Limiters beim Anbieter-Aufruf bricht ab (503), nichts wird gespeichert', async () => {
    let n = 0
    const t = setup({ takeTokens: async () => { if (++n > 1) throw new Error('db down'); return true } })
    expect(await t.run(moveCall())).toMatchObject({ status: 503, body: { error: 'limiter_unavailable' } })
    expect(t.requests).toHaveLength(0)
  })

  it('fremder Anbieterfehler außerhalb von HttpError (z. B. DB-Fehler im Cache) bricht ab', async () => {
    const t = setup()
    t.deps.route.cache.get = async () => { throw Object.assign(new Error('x'), { code: '08006' }) }
    expect(await t.run(moveCall())).toMatchObject({ status: 500 })
    expect(t.requests).toHaveLength(0)
  })

  it('Angebot nicht freigegeben oder unbekannt: 404', async () => {
    const t = setup()
    expect((await t.run(rentalCall({ offerId: '00000000-0000-4000-8000-0000000000ff' }))).status).toBe(404)
    expect(t.bookings).toHaveLength(0)
  })
})

describe('Zugang, Limits, Idempotenz, Bearbeiten', () => {
  it('ohne gültiges JWT: 401, nichts wird berechnet', async () => {
    const t = setup()
    expect((await t.run(moveCall(), null)).status).toBe(401)
    expect((await t.run(moveCall(), 'falsch')).status).toBe(401)
    // Müll-Token (keine JWT-Form) erreicht die Auth-API nie
    let asked = 0
    t.deps.getUserId = async () => { asked += 1; return null }
    expect((await t.run(moveCall(), 'x'.repeat(2000))).status).toBe(401)
    expect(asked).toBe(0)
    expect((await t.run(moveCall(), 'aaa.bbb.ddd')).status).toBe(401)
    expect(asked).toBe(1)
    expect(t.tokens).toHaveLength(0)
  })

  it('Nutzerlimit: 429 vor allem anderen', async () => {
    const t = setup({ takeTokens: async () => false })
    const res = await handleQuote(post(moveCall()), t.deps)
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
    expect(t.provider.calls).toBe(0)
    expect(t.requests).toHaveLength(0)
  })

  it('Nutzerlimit nutzt eine gehashte Kennung, nie die Nutzer-ID im Klartext', async () => {
    const t = setup({}, IN_VIENNA)
    await t.run(moveCall())
    expect(t.tokens[0]!.every((b) => b.startsWith('quote:') && !b.includes('user-a'))).toBe(true)
  })

  it('ungültiges JSON, falsche Methode, zu großer Body, unbekannter Service', async () => {
    const t = setup()
    expect((await handleQuote(post('{'), t.deps)).status).toBe(400)
    expect((await handleQuote(new Request('https://example.test/quote', { method: 'GET', headers: { authorization: 'Bearer aaa.bbb.ccc' } }), t.deps)).status).toBe(405)
    expect((await handleQuote(post({ service: 'move', pad: 'x'.repeat(20_000) }), t.deps)).status).toBe(413)
    expect((await t.run({ service: 'flug', clientRef: clientRef() })).status).toBe(400)
    expect((await t.run([1, 2])).status).toBe(400)
  })

  it('ohne clientRef (Anlegen) wird abgelehnt', async () => {
    const t = setup()
    expect((await t.run({ ...moveCall(), clientRef: undefined })).status).toBe(400)
    expect((await t.run(rentalCall({ clientRef: 'x' }))).status).toBe(400)
  })

  it('zweiter Aufruf mit derselben clientRef liefert die vorhandene Anfrage, ohne neu zu rechnen', async () => {
    const t = setup({}, IN_VIENNA)
    const call = moveCall()
    const first = await t.run(call)
    t.existing.set(call.clientRef, first.body as QuoteResponse)
    const again = await t.run(call)
    expect(again.body).toEqual(first.body)
    expect(t.requests).toHaveLength(1)
    expect(t.provider.calls).toBe(1)
  })

  it('Rennen: die Schreib-Funktion meldet created=false, die vorhandene Antwort wird geliefert', async () => {
    const stored: QuoteResponse = { id: 'req-0', status: 'requested', needsQuote: false, priceVersion: 1, snapshot: { kind: 'price', totalCents: 1 } }
    const t = setup({ saveRequest: async () => ({ id: 'req-0', status: 'requested', needsQuote: false, created: false }) })
    const call = clearanceCall()
    // findExisting findet erst nach dem Speichern etwas (der parallele Aufruf war schneller)
    let late = false
    t.deps.findExisting = async () => (late ? stored : null)
    const save = t.deps.saveRequest
    t.deps.saveRequest = async (a) => { late = true; return save(a) }
    expect((await t.run(call)).body).toEqual(stored)
  })

  it('Bearbeiten gibt es nicht: ein Body mit requestId wird abgelehnt', async () => {
    const t = setup()
    expect((await t.run(clearanceCall({ requestId: '11111111-1111-4111-8111-111111111111' }))).status).toBe(400)
    expect(t.requests).toHaveLength(0)
  })

  it('preferredDate ist Pflicht', async () => {
    const t = setup()
    expect((await t.run(moveCall({ preferredDate: undefined }))).status).toBe(400)
    expect(t.requests).toHaveLength(0)
  })

  it.each([
    ['too_late', 422],
    ['setting_missing', 500],
  ])('Schreib-Fehler %s → %i', async (message, status) => {
    const t = setup({ saveRequest: async () => { throw Object.assign(new Error(message), { code: 'P0001' }) } })
    expect(await t.run(clearanceCall())).toMatchObject({ status, body: { error: message } })
  })

  it('unerwarteter Fehler: 500 ohne Details', async () => {
    const t = setup({ saveRequest: async () => { throw new HttpError(500, 'x') } })
    const res = await t.run(clearanceCall())
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).not.toMatch(/secret|stack/i)
  })

  it('Logs ohne Nutzer-ID, Adresse und Koordinaten', async () => {
    const logs: unknown[] = []
    const t = setup({ log: (e) => logs.push(e) }, IN_VIENNA)
    await t.run(moveCall())
    expect(JSON.stringify(logs)).not.toMatch(/user-a|Stephansplatz|48\.2/)
    expect(logs).toHaveLength(1)
  })
})
