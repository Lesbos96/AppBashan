// `quote` und Schreib-Funktion nach 0019 gegen das Dev-Projekt (npm run test:rls, sequenziell, gepaced): Haltefenster und Preisabgleich,
// Bedingungen, Adressprüfung und Bezirk, Ausfälle, Journal, Kontakte, Rechte. Jede Sperre: erlaubt UND verweigert mit genauem Fehler.
// Das Haltefenster selbst (Grenze 30 min) prüft tests/unit/quote-checks.test.ts als reine Funktion; hier wird es über die Abhängigkeiten
// des Handlers eingespielt, ohne eine zweite Preisversion zu veröffentlichen. Der Rot-Beweis steht in scripts/redproof-s9a3.mjs.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ProviderError } from '../../supabase/functions/_shared/route/provider.ts'
import { anon, DENIED, deleteUsers, makeUser, must, requestArgs, service, type TestUser } from '../support/db.ts'
import { baseDeps, call, cleanupQuoteRls, ctx, db, initCtx, raw, setLimited, testProvider } from '../support/quote-rls.ts'
import { CONTACT, clearanceCall, clientRef, GRAZ, moveCall, place, rentalCall, rentalInput, TERMS, VIENNA_A } from '../support/quote.ts'

let a: TestUser
const dayAhead = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10)
const requestCount = async () => must(await service.from('service_requests').select('id').eq('customer_id', a.id)).length
/** Deps mit eigenem Anbieter (leerer Geocode-Cache) und optionalen Überschreibungen. */
const fresh = (over: Partial<typeof baseDeps> = {}, fail: Parameters<typeof testProvider>[1] = {}) => ({
  ...baseDeps,
  ...over,
  route: { ...baseDeps.route, provider: testProvider(`h-${crypto.randomUUID()}`, fail) },
})

beforeAll(async () => {
  a = await makeUser('hard-a')
  await initCtx()
})
afterAll(async () => {
  setLimited(false)
  await cleanupQuoteRls()
  await deleteUsers()
})

describe('Haltefenster und Preisabgleich', () => {
  // Version 1 gilt als ersetzt (aktuell: 2), nur die Abhängigkeiten sind simuliert; Tarife und Speichern laufen echt.
  const replacedAgo = (minutes: number) => ({
    currentVersion: async () => 2,
    loadHold: async (v: number) =>
      v === ctx.priceVersion ? { started: true, isCurrent: false, replacedAt: new Date(Date.now() - minutes * 60_000).toISOString(), holdMinutes: 30 } : { started: true, isCurrent: true, replacedAt: null, holdMinutes: 30 },
    loadPricing: async () => ({ ...(await db.loadPricing(ctx.priceVersion)), version: 2 }),
  })

  it('abgelaufenes Haltefenster: 409 price_changed mit neuer Version und neuem Snapshot, nichts gespeichert', async () => {
    const before = await requestCount()
    const res = await call(a, moveCall(), fresh(replacedAgo(31)))
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ error: 'price_changed', priceVersion: 2, snapshot: { kind: 'price', totalCents: 68961 } })
    expect(await requestCount()).toBe(before)
  })

  it('innerhalb von 30 Minuten: gespeichert mit der gezeigten Version', async () => {
    const res = await call(a, moveCall(), fresh(replacedAgo(10)))
    expect(res.status).toBe(200)
    expect(res.body.priceVersion).toBe(ctx.priceVersion)
    expect(must(await service.from('price_revisions').select('price_version').eq('request_id', res.body.id).single()).price_version).toBe(ctx.priceVersion)
  })

  it('künftige oder nie gültige Version: nie haltbar → 409 price_changed', async () => {
    const future = { ...replacedAgo(1), loadHold: async () => ({ started: false, isCurrent: false, replacedAt: new Date().toISOString(), holdMinutes: 30 }) }
    expect(await call(a, moveCall(), fresh(future))).toMatchObject({ status: 409, body: { error: 'price_changed', priceVersion: 2 } })
    const unknown = { ...replacedAgo(1), loadHold: async () => null }
    expect(await call(a, moveCall(), fresh(unknown))).toMatchObject({ status: 409, body: { error: 'price_changed' } })
  })

  it('ersetzte Version ohne Einstellung price_hold_minutes: 500 setting_missing, nichts gespeichert', async () => {
    const before = await requestCount()
    const noSetting = { ...replacedAgo(1), loadHold: async () => ({ started: true, isCurrent: false, replacedAt: new Date().toISOString(), holdMinutes: null }) }
    expect(await call(a, moveCall(), fresh(noSetting))).toMatchObject({ status: 500, body: { error: 'setting_missing' } })
    expect(await requestCount()).toBe(before)
  })

  it('gleiche Version, anderer Betrag (z. B. Strecke): 409 price_changed mit dem berechneten Preis, keine Zeile', async () => {
    const before = await requestCount()
    const shown = { kind: 'price', totalCents: 68960, lowCents: 68960, highCents: 68960 } // gezeigt 689,60 €, berechnet 689,61 €
    const res = await raw(a, { ...moveCall(), priceVersion: ctx.priceVersion, termsHash: ctx.termsHash, contact: CONTACT, shown })
    expect(res).toMatchObject({ status: 409, body: { error: 'price_changed', priceVersion: ctx.priceVersion, snapshot: { totalCents: 68961 } } })
    expect(await requestCount()).toBe(before)
  })

  it('Festpreis als Spanne gezeigt (total null) und Angebot statt Preis gezeigt: ebenfalls 409', async () => {
    const base = { ...moveCall(), priceVersion: ctx.priceVersion, termsHash: ctx.termsHash, contact: CONTACT }
    expect((await raw(a, { ...base, shown: { kind: 'price', totalCents: null, lowCents: 68961, highCents: 68961 } })).status).toBe(409)
    expect((await raw(a, { ...base, shown: { kind: 'offer', reasons: ['special_case'] } })).status).toBe(409)
  })

  it('Positivkontrolle: exakt der gezeigte Betrag wird gespeichert', async () => {
    const res = await call(a, moveCall())
    expect(res.status).toBe(200)
    expect(res.body.snapshot).toMatchObject({ totalCents: 68961 })
  })

  it('Miete: gezeigter Betrag weicht ab → 409 price_changed, keine Mietanfrage (M-3)', async () => {
    const count = async () => must(await service.from('rental_bookings').select('id').eq('customer_id', a.id)).length
    const before = await count()
    const body = rentalCall({ inputs: { ...rentalInput, pickupAt: `${dayAhead(10)}T09:00`, returnAt: `${dayAhead(12)}T09:00` }, priceVersion: ctx.priceVersion, shownTotalCents: 27599 })
    expect(await raw(a, body)).toMatchObject({ status: 409, body: { error: 'price_changed', snapshot: { totalCents: 27600 } } })
    expect(await count()).toBe(before)
    expect((await raw(a, { ...body, shownTotalCents: 27600 })).status).toBe(200)
    expect(await count()).toBe(before + 1)
  })
})

describe('Bedingungen und Pflichtfelder', () => {
  it('falscher termsHash: 409 terms_changed mit den aktuellen Bedingungen, keine Zeile', async () => {
    const before = await requestCount()
    const res = await raw(a, { ...moveCall(), priceVersion: ctx.priceVersion, termsHash: 'b'.repeat(64), contact: CONTACT, shown: { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961 } })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({ error: 'terms_changed', terms: { termsHash: ctx.termsHash } })
    expect(Object.keys(res.body.terms).sort()).toEqual(['call_out_fee_cents', 'cancel_free_hours', 'cancel_full_days_before', 'cancel_full_percent', 'cancel_late_percent', 'termsHash'])
    expect(await requestCount()).toBe(before)
  })

  it.each([
    ['contact', { contact: undefined }],
    ['contact.email', { contact: { ...CONTACT, email: 'kein-mail' } }],
    ['contact.phone', { contact: { ...CONTACT, phone: '.....' } }],
    ['contact.name', { contact: { ...CONTACT, name: '' } }],
    ['shown', { shown: undefined, shownTotalCents: undefined }],
    ['termsHash', { termsHash: undefined }],
    ['priceVersion', { priceVersion: undefined }],
    ['preferredDate', { preferredDate: undefined }],
  ])('fehlendes oder ungültiges Pflichtfeld %s: 400, keine Zeile', async (_, over) => {
    const before = await requestCount()
    const body = { ...moveCall(), priceVersion: ctx.priceVersion, termsHash: ctx.termsHash, contact: CONTACT, shown: { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961 }, ...over }
    expect(await raw(a, body)).toMatchObject({ status: 400, body: { error: 'invalid_input' } })
    expect(await requestCount()).toBe(before)
  })
})

describe('Adressprüfung und Bezirk', () => {
  const refused = async (over: Record<string, unknown>) => {
    const before = await requestCount()
    const res = await call(a, moveCall(over), fresh())
    expect(await requestCount()).toBe(before)
    return res
  }

  it('Abholung außerhalb Wiens: 422 pickup_outside_vienna, keine Zeile', async () => {
    expect(await refused({ from: place('Hauptplatz 1, Graz', GRAZ), to: place('Stephansplatz 1, Wien', VIENNA_A) })).toMatchObject({ status: 422, body: { error: 'pickup_outside_vienna' } })
  })

  it('manipulierte Koordinaten oder Client-postcode ändern das nicht (Graz mit Wiener Punkt, Wien mit Grazer Punkt, falsche PLZ)', async () => {
    expect(await refused({ from: place('Hauptplatz 1, Graz', VIENNA_A) })).toMatchObject({ status: 422, body: { error: 'address_mismatch' } })
    expect(await refused({ from: place('Stephansplatz 1, Wien', GRAZ) })).toMatchObject({ status: 422, body: { error: 'address_mismatch' } })
    expect(await refused({ from: { ...place('Hauptplatz 1, Graz', GRAZ), postcode: '1010' } })).toMatchObject({ status: 422, body: { error: 'pickup_outside_vienna' } })
  })

  it('Punkt ohne Hausnummer (Straße): 422 address_imprecise; unbekannte Adresse: address_mismatch; ohne Punkt: address_point_required', async () => {
    expect(await refused({ from: place('Kärntner Straße, Wien', VIENNA_A) })).toMatchObject({ status: 422, body: { error: 'address_imprecise' } })
    expect(await refused({ to: place('Kärntner Straße, Wien', VIENNA_A) })).toMatchObject({ status: 422, body: { error: 'address_imprecise' } })
    expect(await refused({ from: place('Nirgendwo 99', VIENNA_A) })).toMatchObject({ status: 422, body: { error: 'address_mismatch' } })
    expect(await refused({ from: place('Stephansplatz 1, Wien', null) })).toMatchObject({ status: 422, body: { error: 'address_point_required' } })
  })

  it('Ziel im Ausland: 422 offer_not_bookable; Ziel im Inland außerhalb Wiens ist buchbar', async () => {
    expect(await refused({ to: place('Marienplatz 1, München', { lat: 48.1374, lon: 11.5755 }) })).toMatchObject({ status: 422, body: { error: 'offer_not_bookable' } })
    const res = await call(a, moveCall({ to: place('Hauptplatz 1, Graz', GRAZ) }), fresh())
    expect(res.status).toBe(200)
    expect(must(await service.from('service_requests').select('region, district, to_address').eq('id', res.body.id).single())).toMatchObject({ region: 'austria', district: 1, to_address: 'Hauptplatz 1, 8010 Graz' })
  })

  it('Entrümpelung und Montage nutzen dieselbe Prüfung; gespeichert wird das kanonische Label', async () => {
    const res = await call(a, clearanceCall(), fresh())
    expect(res.status).toBe(200)
    expect(must(await service.from('service_requests').select('from_address, district').eq('id', res.body.id).single())).toEqual({ from_address: 'Ring 1, 1010 Wien', district: 1 })
    const bad = await call(a, clearanceCall({ from: place('Hauptplatz 1, Graz', GRAZ) }), fresh())
    expect(bad).toMatchObject({ status: 422, body: { error: 'pickup_outside_vienna' } })
  })

  it('Geocode-Cache: zweiter Aufruf mit demselben Label fragt den Anbieter nicht erneut', async () => {
    const deps = fresh()
    const p = deps.route.provider as ReturnType<typeof testProvider>
    await call(a, clearanceCall(), deps)
    const after = p.geocodes
    expect(after).toBeGreaterThan(0)
    await call(a, clearanceCall(), deps)
    expect(p.geocodes).toBe(after)
  })
})

describe('Ausfälle und Limits: Abbruch ohne Zeile', () => {
  it('Geocoder fällt aus: 503 provider_unavailable', async () => {
    const before = await requestCount()
    const res = await call(a, moveCall(), fresh({}, { geocode: new ProviderError('unavailable') }))
    expect(res).toMatchObject({ status: 503, body: { error: 'provider_unavailable' } })
    expect(await requestCount()).toBe(before)
  })

  it('Routing fällt aus: 503 provider_unavailable; keine Route: Angebot route_missing', async () => {
    const before = await requestCount()
    expect(await call(a, moveCall({ to: place('Hauptplatz 1, Graz', GRAZ) }), fresh({}, { route: new ProviderError('unavailable') }))).toMatchObject({ status: 503, body: { error: 'provider_unavailable' } })
    expect(await requestCount()).toBe(before)
    const none = await call(a, moveCall({ to: place('Hauptplatz 1, Graz', GRAZ) }), fresh({}, { route: new ProviderError('no_route') }))
    expect(none).toMatchObject({ status: 200, body: { status: 'awaiting_offer', snapshot: { kind: 'offer', reasons: ['route_missing'] } } })
  })

  it('Geocode-Kontingent erschöpft: 429 rate_limited; Zähler fällt aus: 503 limiter_unavailable', async () => {
    const before = await requestCount()
    const noGeo = { takeTokens: async (c: { bucket: string }[]) => !c.some((x) => x.bucket.startsWith('qgeo:')) }
    expect(await call(a, moveCall(), fresh(noGeo))).toMatchObject({ status: 429, body: { error: 'rate_limited' } })
    const down = { takeTokens: async (c: { bucket: string }[]) => { if (c.some((x) => x.bucket.startsWith('qgeo:'))) throw new Error('db down'); return true } }
    expect(await call(a, moveCall(), fresh(down))).toMatchObject({ status: 503, body: { error: 'limiter_unavailable' } })
    expect(await requestCount()).toBe(before)
  })

  it('Routen-Kontingent erschöpft: 429 rate_limited', async () => {
    const before = await requestCount()
    const noRoute = { takeTokens: async (c: { bucket: string }[]) => !c.some((x) => x.bucket.startsWith('route:')) }
    expect(await call(a, moveCall({ to: place('Hauptplatz 1, Graz', GRAZ) }), fresh(noRoute))).toMatchObject({ status: 429, body: { error: 'rate_limited' } })
    expect(await requestCount()).toBe(before)
  })
})

describe('Journal, Revision und Kontakt', () => {
  it('price_confirmed im Journal mit Betrag, Bedingungen-Hash, Version und Inhalts-Hash; Revision 1 trägt die Bedingungen; Kontakt gespeichert', async () => {
    const res = await call(a, moveCall({ contact: { ...CONTACT, stairsDoor: 'Stiege 2, Tür 5' } }), fresh())
    expect(res.status).toBe(200)
    const rev = must(await service.from('price_revisions').select('*').eq('request_id', res.body.id).single())
    expect(rev.snapshot).toMatchObject({ terms: { termsHash: ctx.termsHash, cancel_free_hours: expect.any(Number), call_out_fee_cents: expect.any(Number) } })
    const log = must(await service.from('audit_log').select('*').eq('entity', 'service_request').eq('entity_id', res.body.id).eq('action', 'price_confirmed'))
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ actor_id: a.id, actor_role: 'customer', detail: { priceVersion: ctx.priceVersion, contentHash: rev.content_hash, termsHash: ctx.termsHash, shown: { kind: 'price', totalCents: 68961 } } })
    expect(must(await service.from('request_contacts').select('name, phone, email, stairs_door').eq('request_id', res.body.id).single())).toEqual({
      name: CONTACT.name, phone: CONTACT.phone, email: CONTACT.email, stairs_door: 'Stiege 2, Tür 5',
    })
  })

  it('der Kunde liest die Antwort ohne Gebühr; fremde Kontakte sieht er nicht', async () => {
    const own = await call(a, moveCall(), fresh())
    expect(JSON.stringify(own.body).replaceAll('call_out_fee_cents', '').replace(/[0-9a-f-]{16,}/gi, '')).not.toMatch(/fee|payout|platform|commission/i) // ohne UUIDs und Hex-Hashes (zufälliges „fee“)
    const b = await makeUser('hard-b')
    expect(must(await b.db.from('request_contacts').select('request_id'))).toEqual([])
    expect(must(await a.db.from('request_contacts').select('request_id').eq('request_id', own.body.id))).toHaveLength(1)
  })
})

describe('quote_save_request: eigene Prüfungen', () => {
  const save = async (over: Record<string, unknown>) => (await service.rpc('quote_save_request', (await requestArgs(a.id, over)) as never)).error
  const pg = (message: string) => ({ code: 'P0001', message })

  it('Positivkontrolle: gültige Argumente werden gespeichert', async () => {
    expect(await save({})).toBeNull()
  })

  it.each([
    ['terms_missing', { p_snapshot: { kind: 'price', totalCents: 1, lowCents: 1, highCents: 1, lines: [] } }],
    ['terms_missing', { p_snapshot: { kind: 'price', totalCents: 1, lowCents: 1, highCents: 1, lines: [], terms: { ...TERMS, termsHash: undefined } } }],
    ['contact_required', { p_contact: null }],
    ['contact_required', { p_contact: { ...CONTACT, phone: '' } }],
    ['confirmed_required', { p_confirmed: null }],
    ['district_required', { p_district: null }],
    ['preferred_date_required', { p_preferred_date: null }],
    ['client_ref_required', { p_client_ref: null }],
  ])('%s', async (message, over) => {
    expect(await save(over)).toMatchObject(pg(message))
  })

  it('Kontaktformat zusätzlich in der Datenbank (Constraint): 23514', async () => {
    expect(await save({ p_contact: { ...CONTACT, email: 'kein-mail' } })).toMatchObject({ code: '23514' })
    expect(await save({ p_contact: { ...CONTACT, phone: '.....' } })).toMatchObject({ code: '23514' })
  })
})

describe('Rechte nach 0019', () => {
  const ghost = '99999999-9999-4999-8999-999999999999'

  it('geocode_cache und geo_districts: anon und authenticated 42501, service_role liest (23 Bezirke)', async () => {
    for (const who of [anon, a.db]) {
      for (const table of ['geocode_cache', 'geo_districts'] as const) {
        const { error } = await who.from(table).select('*').limit(1)
        expect(error?.code, table).toBe(DENIED)
        expect(error?.message, table).toContain(`permission denied for table ${table}`)
      }
      expect((await who.from('geocode_cache').insert({ key: 'x', value: [], expires_at: new Date().toISOString() })).error?.code).toBe(DENIED)
    }
    expect(must(await service.from('geo_districts').select('district'))).toHaveLength(23)
    expect((await service.from('geocode_cache').select('key').limit(1)).error).toBeNull()
  })

  it('price_version_hold und quote_district: anon und authenticated 42501, service_role darf', async () => {
    for (const who of [anon, a.db]) {
      const hold = await who.rpc('price_version_hold', { p_version: 1 })
      expect(hold.error?.code).toBe(DENIED)
      expect(hold.error?.message).toContain('permission denied for function price_version_hold')
      const district = await who.rpc('quote_district', { p_lon: VIENNA_A.lon, p_lat: VIENNA_A.lat })
      expect(district.error?.code).toBe(DENIED)
      expect(district.error?.message).toContain('permission denied for function quote_district')
    }
    expect(must(await service.rpc('quote_district', { p_lon: VIENNA_A.lon, p_lat: VIENNA_A.lat }))[0]).toEqual({ in_vienna: true, in_austria: true, district: 1 })
    expect(must(await service.rpc('quote_district', { p_lon: GRAZ.lon, p_lat: GRAZ.lat }))[0]).toEqual({ in_vienna: false, in_austria: true, district: null })
    expect(must(await service.rpc('price_version_hold', { p_version: ctx.priceVersion }))[0]).toMatchObject({ started: true, is_current: true, replaced_at: null })
  })

  it('rental_bookings: service_role darf einfügen, aber weder ändern noch löschen (42501)', async () => {
    const res = await call(a, rentalCall({ inputs: { ...rentalInput, pickupAt: `${dayAhead(20)}T09:00`, returnAt: `${dayAhead(21)}T09:00` } }))
    expect(res.status).toBe(200)
    const upd = await service.from('rental_bookings').update({ status: 'withdrawn' }).eq('id', res.body.id)
    expect(upd.error?.code).toBe(DENIED)
    expect(upd.error?.message).toContain('permission denied for table rental_bookings')
    expect((await service.from('rental_bookings').delete().eq('id', res.body.id)).error?.code).toBe(DENIED)
    expect(must(await service.from('rental_bookings').select('status').eq('id', res.body.id).single()).status).toBe('requested')
  })

  it('quote_save_request für Dritte: ein unbekannter Kunde scheitert am Fremdschlüssel (23503), nicht an der Prüfung', async () => {
    expect((await service.rpc('quote_save_request', (await requestArgs(ghost)) as never)).error?.code).toBe('23503')
  })
})

describe('Rohaufruf ohne Absender-Hilfe', () => {
  it('Wiederholung derselben clientRef nach 409 legt genau eine Zeile an', async () => {
    const ref = clientRef()
    const body = { ...moveCall({ clientRef: ref }), priceVersion: ctx.priceVersion, termsHash: ctx.termsHash, contact: CONTACT }
    const wrong = { kind: 'price', totalCents: 1, lowCents: 1, highCents: 1 }
    const first = await raw(a, { ...body, shown: wrong })
    expect(first.status).toBe(409)
    expect(must(await service.from('service_requests').select('id').eq('client_ref', ref))).toEqual([])
    const second = await raw(a, { ...body, shown: { kind: 'price', totalCents: first.body.snapshot.totalCents, lowCents: first.body.snapshot.lowCents, highCents: first.body.snapshot.highCents } })
    expect(second.status).toBe(200)
    expect(must(await service.from('service_requests').select('id').eq('client_ref', ref))).toHaveLength(1)
  })
})
