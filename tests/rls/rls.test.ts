// RLS-Integrationstests gegen das Dev-Projekt. Start: npm run test:rls (Werte per dotenv-cli).
// Ein durch USING geblocktes UPDATE liefert 0 Zeilen ohne Fehler, daher wird der Zustand
// danach über die Service-Role nachgelesen. Jede Sperre hat eine Positivkontrolle.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../supabase/functions/_shared/database.types.ts'
import { makeRequest } from '../support/db.ts'
import { asUser, ownerGrantRole, ownerSql } from '../support/owner.ts'

type Db = SupabaseClient<Database>

function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} fehlt. Tests über npm run test:rls starten.`)
  return value
}

const url = env('NEXT_PUBLIC_SUPABASE_URL')
const publishableKey = env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
const secretKey = env('SUPABASE_SECRET_KEY')

const client = (key: string): Db =>
  createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const service = client(secretKey)
const anon = client(publishableKey)

// Gepaced wegen der Auth-Rate-Limits.
const pause = () => new Promise((resolve) => setTimeout(resolve, 400))
const run = Date.now().toString(36)
const created: string[] = []

async function makeUser(tag: string): Promise<{ id: string; db: Db }> {
  const email = `rls-${tag}-${run}@movenow.test`
  const password = `${crypto.randomUUID()}Aa1!`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  created.push(data.user.id)
  await pause()
  const db = client(publishableKey)
  const signIn = await db.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error
  await pause()
  return { id: data.user.id, db }
}

const must = <T>(result: { data: T; error: unknown }): NonNullable<T> => {
  if (result.error || result.data == null) throw result.error ?? new Error('keine Daten')
  return result.data
}

const CARGO_VAN = '00000000-0000-4000-8000-000000000002'
const png = new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))], { type: 'image/jpeg' })

let a: Awaited<ReturnType<typeof makeUser>>
let b: Awaited<ReturnType<typeof makeUser>>
let provider: Awaited<ReturnType<typeof makeUser>>
let otherProvider: Awaited<ReturnType<typeof makeUser>>
let admin: Awaited<ReturnType<typeof makeUser>>
let requestA: string
let requestB: string
let bookingA: string
let bookingB: string
let photoPathB: string
let approvedOffer: string
const extraPhotos: string[] = []
const testKey = `rls.test.${run}`
// Künftige Testversion: gilt nie als aktuell, die gültige Version 1 bleibt unberührt.
const testVersion = 9999

const bookingRow = (customerId: string, offerId: string) => ({
  offer_id: offerId,
  customer_id: customerId,
  pickup_at: '2026-11-06T08:00:00Z',
  return_at: '2026-11-08T08:00:00Z',
  km: 350,
  cover: true,
  price_snapshot: { positions: [] },
  price_version: 1,
  total_cents: 27600,
  deposit_cents: 50000,
})

const requestStatus = async (id: string) =>
  must(await service.from('service_requests').select('status').eq('id', id).single()).status
const bookingStatus = async (id: string) =>
  must(await service.from('rental_bookings').select('status').eq('id', id).single()).status

beforeAll(async () => {
  // Reste eines abgebrochenen Laufs entfernen, dann die künftige Testversion anlegen.
  await service.from('price_config').delete().eq('version', testVersion)
  await service.from('price_config').delete().like('key', 'rls.test.%')
  await service.from('price_versions').delete().eq('version', testVersion)
  must(await service.from('price_versions').insert({ version: testVersion, effective_on: '2999-01-01', note: 'RLS-Test' }).select())
  a = await makeUser('kunde-a')
  b = await makeUser('kunde-b')
  provider = await makeUser('vermieter')
  otherProvider = await makeUser('vermieter-2')
  admin = await makeUser('admin')

  // Vermieter-Rolle über den vorgesehenen Weg, admin nur über Eigentümer-SQL (admin_grant_role).
  expect(must(await provider.db.rpc('become_rental_provider'))).toBe('rental_provider')
  expect(must(await otherProvider.db.rpc('become_rental_provider'))).toBe('rental_provider')
  ownerGrantRole(admin.id, 'admin')

  requestA = await makeRequest(a.id)

  // Ablauf seit 0020: erst Upload in den Staging-Ordner {uid}/{client_ref}/, dann übernimmt das Absenden die Datei.
  const refB = crypto.randomUUID()
  const photoIdB = crypto.randomUUID()
  photoPathB = `${b.id}/${refB}/${photoIdB}.jpg`
  must(await b.db.storage.from('request-photos').upload(photoPathB, png, { contentType: 'image/jpeg' }))
  requestB = await makeRequest(b.id, { p_client_ref: refB, p_photo_ids: [photoIdB] })

  const offer = must(
    await provider.db
      .from('rental_offers')
      .insert({
        provider_name: 'RLS-Test',
        name: 'Testvan',
        station: 'Wien',
        size_m3: 10,
        daily_cents: 9900,
        km_per_day: 150,
        extra_km_cents: 40,
        cover_daily_cents: 2400,
        excess_cents: 180000,
        cover_excess_cents: 50000,
        driver_daily_cents: 1000,
        one_way_cents: 5900,
        deposit_cents: 50000,
      })
      .select('id')
      .single(),
  )
  approvedOffer = offer.id
  must(await service.from('rental_offers').update({ status: 'approved' }).eq('id', approvedOffer).select())

  bookingA = must(await service.from('rental_bookings').insert(bookingRow(a.id, CARGO_VAN)).select('id').single()).id
  bookingB = must(await service.from('rental_bookings').insert(bookingRow(b.id, approvedOffer)).select('id').single()).id

  // Gebührenzeilen schreibt niemand mehr außer dem Eigentümer (service_role hat kein Schreibrecht, S9a-2): Fixtures per Eigentümer-SQL.
  ownerSql(`insert into public.fee_splits (rental_booking_id, payee_id, total_cents, fee_rate, fee_vat_rate, fee_cents, fee_net_cents, fee_vat_cents, payout_cents, price_version)
    values ('${bookingB}', '${provider.id}', 27600, 0.15, 0.2, 4140, 3450, 690, 23460, 1);
    insert into public.fee_splits (service_request_id, total_cents, fee_rate, fee_vat_rate, fee_cents, fee_net_cents, fee_vat_cents, payout_cents, price_version)
    values ('${requestA}', 68961, 0.15, 0.2, 10344, 8620, 1724, 58617, 1)`)
})

afterAll(async () => {
  await service.from('price_config').delete().eq('version', testVersion)
  await service.from('price_versions').delete().eq('version', testVersion)
  if (photoPathB) await service.storage.from('request-photos').remove([photoPathB, ...extraPhotos])
  // Kunden zuerst (Anfragen und Mietanfragen kaskadieren), dann Vermieter (Angebote kaskadieren).
  for (const id of created) {
    await service.auth.admin.deleteUser(id)
    await pause()
  }
})

describe('anon', () => {
  it('liest öffentliche Tarife und freigegebene Angebote', async () => {
    expect(must(await anon.from('price_config').select('key')).length).toBeGreaterThan(20)
    const offers = must(await anon.from('rental_offers').select('id, status'))
    expect(offers.map((o) => o.id)).toContain(CARGO_VAN)
    expect(offers.every((o) => o.status === 'approved')).toBe(true)
  })

  it.each(['profiles', 'service_requests', 'request_photos', 'rental_bookings', 'fee_splits', 'platform_settings'] as const)(
    'liest nichts aus %s',
    async (table) => {
      const { data } = await anon.from(table).select('*')
      expect(data ?? []).toEqual([])
    },
  )

  it('lädt keine Fotos und wird nicht Vermieter', async () => {
    expect((await anon.storage.from('request-photos').download(photoPathB)).error).not.toBeNull()
    expect((await anon.rpc('become_rental_provider')).error).not.toBeNull()
  })
})

describe('Kunden sehen nur Eigenes', () => {
  it('Anfragen', async () => {
    const ids = must(await a.db.from('service_requests').select('id')).map((r) => r.id)
    expect(ids).toContain(requestA)
    expect(ids).not.toContain(requestB)
  })

  it('Foto-Einträge und Dateien', async () => {
    expect(must(await b.db.from('request_photos').select('storage_path'))).toHaveLength(1)
    expect(must(await a.db.from('request_photos').select('storage_path'))).toEqual([])
    expect((await b.db.storage.from('request-photos').download(photoPathB)).error).toBeNull()
    expect((await a.db.storage.from('request-photos').download(photoPathB)).error).not.toBeNull()
  })

  it('kein Upload und kein Foto-Eintrag in fremde Anfragen', async () => {
    const foreign = `${b.id}/${requestB}/${crypto.randomUUID()}.jpg`
    expect((await a.db.storage.from('request-photos').upload(foreign, png, { contentType: 'image/jpeg' })).error).not.toBeNull()
    // eigener Ordner, aber zu dessen client_ref gibt es schon eine Anfrage (nach dem Absenden ist Staging zu)
    const refA = must(await service.from('service_requests').select('client_ref').eq('id', requestA).single()).client_ref
    const ownFolder = `${a.id}/${refA}/${crypto.randomUUID()}.jpg`
    expect((await a.db.storage.from('request-photos').upload(ownFolder, png, { contentType: 'image/jpeg' })).error).not.toBeNull()
    // gültiger Pfad der fremden Anfrage: einzige Sperre ist der fehlende INSERT-Grant (0020)
    expect((await a.db.from('request_photos').insert({ request_id: requestB, storage_path: foreign })).error?.code).toBe('42501')
  })

  it('fremde Fotos lassen sich nicht löschen', async () => {
    const row = await a.db.from('request_photos').delete().eq('storage_path', photoPathB).select()
    expect(row.data ?? []).toEqual([])
    await a.db.storage.from('request-photos').remove([photoPathB])
    expect(must(await service.from('request_photos').select('id').eq('storage_path', photoPathB))).toHaveLength(1)
    expect((await service.storage.from('request-photos').download(photoPathB)).error).toBeNull()
  })

  it('Mietanfragen', async () => {
    const ids = must(await a.db.from('rental_bookings').select('id')).map((r) => r.id)
    expect(ids).toContain(bookingA)
    expect(ids).not.toContain(bookingB)
  })

  it('fremde Profile: nicht lesen, nicht ändern', async () => {
    const ids = must(await a.db.from('profiles').select('id')).map((r) => r.id)
    expect(ids).toEqual([a.id])
    const result = await a.db.from('profiles').update({ display_name: 'fremd' }).eq('id', b.id).select()
    expect(result.data ?? []).toEqual([])
    expect(must(await service.from('profiles').select('display_name').eq('id', b.id).single()).display_name).toBeNull()
  })
})

describe('Kunden setzen nur „zurückgezogen"', () => {
  it('legen Anfragen nicht selbst an (nur über quote)', async () => {
    expect((await a.db.from('service_requests').insert({ customer_id: a.id, service: 'move' } as never)).error?.code).toBe('42501')
    expect((await a.db.from('rental_bookings').insert(bookingRow(a.id, CARGO_VAN))).error).not.toBeNull()
  })

  it('kein anderer Status, keine Preisfelder', async () => {
    expect((await a.db.from('service_requests').update({ status: 'accepted' }).eq('id', requestA)).error?.code).toBe('42501')
    expect((await a.db.from('service_requests').update({ description: 'x' }).eq('id', requestA)).error?.code).toBe('42501')
    expect(await requestStatus(requestA)).toBe('requested')
  })

  it('fremde Anfrage bleibt unverändert', async () => {
    expect((await a.db.rpc('withdraw', { p_request: requestB })).error?.message).toBe('not_found')
    expect(await requestStatus(requestB)).toBe('requested')
  })

  it('eigene Anfrage zurückziehen, danach nicht wieder öffnen', async () => {
    expect(must(await a.db.rpc('withdraw', { p_request: requestA }))).toBe('withdrawn')
    expect((await a.db.from('service_requests').update({ status: 'requested' }).eq('id', requestA)).error?.code).toBe('42501')
    expect((await a.db.rpc('withdraw', { p_request: requestA })).error?.message).toBe('invalid_transition')
    expect(await requestStatus(requestA)).toBe('withdrawn')
  })

  it('keine Fotos zu einer zurückgezogenen Anfrage', async () => {
    const refA = must(await service.from('service_requests').select('client_ref').eq('id', requestA).single()).client_ref
    const path = `${a.id}/${refA}/${crypto.randomUUID()}.jpg`
    expect((await a.db.storage.from('request-photos').upload(path, png, { contentType: 'image/jpeg' })).error).not.toBeNull()
    expect((await a.db.from('request_photos').insert({ request_id: requestA, storage_path: path })).error?.code).toBe('42501')
  })

  it('Mietanfrage: nur zurückziehen', async () => {
    expect((await a.db.from('rental_bookings').update({ status: 'in_progress' }).eq('id', bookingA)).error).not.toBeNull()
    expect(await bookingStatus(bookingA)).toBe('requested')
    expect(must(await a.db.from('rental_bookings').update({ status: 'withdrawn' }).eq('id', bookingA).select())).toHaveLength(1)
  })
})

describe('Vermieter und Fahrzeuge', () => {
  let pendingOffer: string

  it('Kunden legen keine Fahrzeuge an', async () => {
    const { error } = await a.db.from('rental_offers').insert({
      provider_name: 'X', name: 'X', station: 'X', size_m3: 1, daily_cents: 1, km_per_day: 1, extra_km_cents: 1,
      cover_daily_cents: 1, excess_cents: 1, cover_excess_cents: 1, driver_daily_cents: 1, one_way_cents: 1, deposit_cents: 1,
    })
    expect(error).not.toBeNull()
  })

  it('neues Fahrzeug ist pending, Status und Demo-Flag nicht setzbar', async () => {
    const offer = must(
      await provider.db
        .from('rental_offers')
        .insert({
          provider_name: 'RLS-Test', name: 'Neu', station: 'Wien', size_m3: 6, daily_cents: 7900, km_per_day: 100,
          extra_km_cents: 35, cover_daily_cents: 1900, excess_cents: 150000, cover_excess_cents: 50000,
          driver_daily_cents: 900, one_way_cents: 4900, deposit_cents: 30000,
        })
        .select('id, status, is_demo, provider_id')
        .single(),
    )
    expect(offer).toMatchObject({ status: 'pending', is_demo: false, provider_id: provider.id })
    pendingOffer = offer.id
    const { error } = await provider.db.from('rental_offers').insert({
      provider_name: 'X', name: 'X', station: 'X', size_m3: 1, daily_cents: 1, km_per_day: 1, extra_km_cents: 1,
      cover_daily_cents: 1, excess_cents: 1, cover_excess_cents: 1, driver_daily_cents: 1, one_way_cents: 1, deposit_cents: 1,
      status: 'approved',
    })
    expect(error).not.toBeNull()
    expect((await provider.db.from('rental_offers').update({ status: 'approved' }).eq('id', pendingOffer)).error).not.toBeNull()
  })

  it('ändert nur eigene Fahrzeuge', async () => {
    expect(must(await provider.db.from('rental_offers').update({ daily_cents: 8900 }).eq('id', pendingOffer).select())).toHaveLength(1)
    const foreign = await otherProvider.db.from('rental_offers').update({ daily_cents: 1 }).eq('id', pendingOffer).select()
    expect(foreign.data ?? []).toEqual([])
    const demo = await provider.db.from('rental_offers').update({ daily_cents: 1 }).eq('id', CARGO_VAN).select()
    expect(demo.data ?? []).toEqual([])
    expect(must(await service.from('rental_offers').select('daily_cents').eq('id', pendingOffer).single()).daily_cents).toBe(8900)
    expect(must(await service.from('rental_offers').select('daily_cents').eq('id', CARGO_VAN).single()).daily_cents).toBe(9900)
  })

  it('fremde unfreigegebene Fahrzeuge bleiben unsichtbar', async () => {
    const forOther = must(await otherProvider.db.from('rental_offers').select('id')).map((o) => o.id)
    const forCustomer = must(await a.db.from('rental_offers').select('id')).map((o) => o.id)
    expect(forOther).not.toContain(pendingOffer)
    expect(forCustomer).not.toContain(pendingOffer)
    expect(forCustomer).toContain(approvedOffer)
    expect(must(await provider.db.from('rental_offers').select('id')).map((o) => o.id)).toContain(pendingOffer)
  })
})

describe('Gebühren', () => {
  it('Kunden und anon lesen weder fee_splits noch platform_settings', async () => {
    for (const db of [a.db, b.db, anon]) {
      expect((await db.from('fee_splits').select('*')).data ?? []).toEqual([])
      expect((await db.from('platform_settings').select('*')).data ?? []).toEqual([])
    }
  })

  it('Vermieter liest nur eigene Aufteilung und den Satz', async () => {
    const own = must(await provider.db.from('fee_splits').select('rental_booking_id'))
    expect(own).toEqual([{ rental_booking_id: bookingB }])
    expect(must(await otherProvider.db.from('fee_splits').select('id'))).toEqual([])
    const keys = must(await provider.db.from('platform_settings').select('key')).map((s) => s.key)
    expect(keys).toEqual(expect.arrayContaining(['fee_rate', 'fee_vat_rate']))
  })

  it('Vermieter ändert den Satz nicht', async () => {
    expect((await provider.db.from('platform_settings').insert({ key: 'fee_rate', version: 99, value: 0, effective_from: '2999-01-01' })).error?.code).toBe('42501')
    const result = await provider.db.from('platform_settings').update({ value: 0 }).eq('key', 'fee_rate').select()
    expect(result.error?.code).toBe('42501')
    expect(must(await service.from('platform_settings').select('value').eq('key', 'fee_rate').eq('version', 1).single()).value).toBe(0.15)
  })

  it('admin liest Aufteilungen nur mit aal2', async () => {
    // Anmeldung per Passwort ist aal1: nichts. Positivkontrolle mit gesetztem Claim aal2 (Eigentümer-SQL).
    expect(must(await admin.db.from('fee_splits').select('id'))).toEqual([])
    expect(Number(asUser(admin.id, 'aal1', 'select count(*)::int as n from public.fee_splits')[0]!.n)).toBe(0)
    expect(Number(asUser(admin.id, 'aal2', 'select count(*)::int as n from public.fee_splits')[0]!.n)).toBeGreaterThanOrEqual(2)
  })

  it('niemand außer dem Server schreibt Aufteilungen', async () => {
    const row = {
      service_request_id: requestB, total_cents: 1, fee_rate: 0, fee_vat_rate: 0, fee_cents: 0,
      fee_net_cents: 0, fee_vat_cents: 0, payout_cents: 1, price_version: 1,
    }
    expect((await provider.db.from('fee_splits').insert(row)).error).not.toBeNull()
    expect((await admin.db.from('fee_splits').insert(row)).error?.code).toBe('42501')
  })
})

describe('price_config', () => {
  // Eigener Testschlüssel in der unveröffentlichten Testversion, damit echte Tarife im Dev-Projekt nie verändert werden.
  const row = () => ({ version: testVersion, key: testKey, value: 100, unit: 'cent', label: 'RLS-Test' })
  const args = (value: number, actor = admin.id) => ({
    p_actor: actor, p_version: testVersion, p_key: testKey, p_value: value, p_unit: 'cent', p_label: 'RLS-Test',
  })
  const stored = async () => must(await service.from('price_config').select('value').eq('version', testVersion).eq('key', testKey))

  it('Kunde, Vermieter, anon und admin (aal1) schreiben nicht direkt (42501)', async () => {
    for (const db of [a.db, provider.db, anon, admin.db]) {
      expect((await db.from('price_config').insert(row())).error?.code).toBe('42501')
      expect((await db.from('price_config').update({ value: 1 }).eq('version', testVersion)).error?.code).toBe('42501')
      expect((await db.from('price_config').delete().eq('version', testVersion)).error?.code).toBe('42501')
    }
    expect(await stored()).toEqual([])
  })

  it('nur die Admin-Funktion (service_role, p_actor admin) legt an und ändert; Nicht-admin als p_actor wird verweigert', async () => {
    const denied = await service.rpc('admin_set_price_config', args(100, a.id))
    expect(denied.error).toMatchObject({ code: '42501', message: 'not_admin' })
    expect(await stored()).toEqual([])
    expect((await service.rpc('admin_set_price_config', args(100))).error).toBeNull()
    expect(await stored()).toEqual([{ value: 100 }])
    expect((await service.rpc('admin_set_price_config', args(101))).error).toBeNull()
    expect(await stored()).toEqual([{ value: 101 }])
    must(await service.from('price_config').delete().eq('version', testVersion).eq('key', testKey).select())
  })

  it('DB-Check: Werte unter 0 werden abgelehnt, 0 ist erlaubt', async () => {
    expect((await service.rpc('admin_set_price_config', args(-1))).error?.code).toBe('23514')
    expect((await service.rpc('admin_set_price_config', args(0))).error).toBeNull()
    expect((await service.rpc('admin_set_price_config', args(-1))).error?.code).toBe('23514')
    expect(await stored()).toEqual([{ value: 0 }])
    must(await service.from('price_config').delete().eq('version', testVersion).eq('key', testKey).select())
  })

  it('Seed: Spanne rate_low ≤ rate ≤ rate_high in der gültigen Version', async () => {
    const { version } = must(await anon.from('current_price_version').select('version').single())
    const rows = must(await anon.from('price_config').select('key, value').eq('version', version!).like('key', 'clearance.rate%'))
    const value = (key: string) => rows.find((r) => r.key === key)?.value
    const [low, rate, high] = [value('clearance.rate_low'), value('clearance.rate'), value('clearance.rate_high')]
    expect([low, rate, high].every((v) => typeof v === 'number')).toBe(true)
    expect(low).toBeLessThanOrEqual(rate!)
    expect(rate).toBeLessThanOrEqual(high!)
  })

  it('Seed: öffentliche Texte ohne Prototyp-Hinweis', async () => {
    const config = must(await anon.from('price_config').select('label, sources').eq('version', 1))
    const versions = must(await anon.from('price_versions').select('note'))
    expect(JSON.stringify([config, versions])).not.toMatch(/Prototyp/i)
  })
})

describe('current_price_version', () => {
  it('liefert für anon und Kunden die höchste bereits gültige Version, keine künftige', async () => {
    // die Testversion ist unveröffentlicht: für anon und Kunden unsichtbar
    expect(must(await anon.from('price_versions').select('version').eq('version', testVersion))).toHaveLength(0)
    for (const db of [anon, a.db]) {
      expect(must(await db.from('current_price_version').select('version')).map((r) => r.version)).toEqual([1])
    }
  })

  it('macht platform_settings und fee_splits nicht lesbar', async () => {
    expect((await anon.from('platform_settings').select('key')).data ?? []).toEqual([])
    expect((await anon.from('fee_splits').select('id')).data ?? []).toEqual([])
  })
})

describe('Rollen', () => {
  it('niemand setzt die eigene Rolle', async () => {
    for (const user of [a, provider]) {
      expect((await user.db.from('profiles').update({ role: 'admin' }).eq('id', user.id)).error).not.toBeNull()
    }
    const roles = must(await service.from('profiles').select('id, role').in('id', [a.id, provider.id]))
    expect(Object.fromEntries(roles.map((r) => [r.id, r.role]))).toEqual({ [a.id]: 'customer', [provider.id]: 'rental_provider' })
  })

  it('Name und Telefon sind änderbar', async () => {
    expect(must(await a.db.from('profiles').update({ display_name: 'Kundin A' }).eq('id', a.id).select('display_name'))).toEqual([
      { display_name: 'Kundin A' },
    ])
  })

  it('der Vermieter-Weg macht nie admin und stuft admin nicht herab', async () => {
    expect(must(await provider.db.rpc('become_rental_provider'))).toBe('rental_provider')
    expect(must(await admin.db.rpc('become_rental_provider'))).toBe('admin')
  })
})
