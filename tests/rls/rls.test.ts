// RLS-Integrationstests gegen das Dev-Projekt. Start: npm run test:rls (Werte per dotenv-cli).
// Ein durch USING geblocktes UPDATE liefert 0 Zeilen ohne Fehler, daher wird der Zustand
// danach über die Service-Role nachgelesen. Jede Sperre hat eine Positivkontrolle.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '../../supabase/functions/_shared/database.types.ts'
import { makeRequest } from '../support/db.ts'
import { ownerGrantRole, ownerSql } from '../support/owner.ts'
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

  // Rollen nur über Eigentümer-SQL (admin_grant_role, mit Journal); ein Selbst-Upgrade gibt es seit 0022 nicht mehr.
  ownerGrantRole(provider.id, 'rental_provider')
  ownerGrantRole(otherProvider.id, 'rental_provider')
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

  it.each(['profiles', 'service_requests', 'request_photos', 'rental_bookings', 'commission_entries', 'platform_settings'] as const)(
    'liest nichts aus %s',
    async (table) => {
      const { data } = await anon.from(table).select('*')
      expect(data ?? []).toEqual([])
    },
  )

  it('lädt keine Fotos', async () => {
    expect((await anon.storage.from('request-photos').download(photoPathB)).error).not.toBeNull()
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

  it('eigene Anfrage zurückziehen, danach nicht wieder öffnen; die Wiederholung liefert den Status (fh1, 0069)', async () => {
    expect(must(await a.db.rpc('withdraw', { p_request: requestA }))).toBe('withdrawn')
    expect((await a.db.from('service_requests').update({ status: 'requested' }).eq('id', requestA)).error?.code).toBe('42501')
    expect(must(await a.db.rpc('withdraw', { p_request: requestA }))).toBe('withdrawn')
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
  it('Kunden und anon lesen weder das Journal noch platform_settings', async () => {
    for (const db of [a.db, b.db, anon]) {
      const entries = await db.from('commission_entries').select('*')
      if (db === anon) expect(entries.error?.code).toBe('42501')
      else expect(must(entries)).toEqual([])
      expect((await db.from('platform_settings').select('*')).error?.code).toBe('42501') // Spalten-Grant (0027): select * verweigert
    }
    expect(must(await a.db.from('platform_settings').select('key'))).toEqual([])
  })

  it('Vermieter liest weder Journal noch Satz (nur Partner-Mitglieder: journal.test.ts, partner-fee-read.test.ts)', async () => {
    expect(must(await provider.db.from('commission_entries').select('id'))).toEqual([])
    expect(must(await otherProvider.db.from('commission_entries').select('id'))).toEqual([])
    expect(must(await provider.db.from('platform_settings').select('key'))).toEqual([])
  })

  it('Vermieter ändert den Satz nicht', async () => {
    expect((await provider.db.from('platform_settings').insert({ key: 'fee_rate', version: 99, value: 0, effective_from: '2999-01-01' })).error?.code).toBe('42501')
    const result = await provider.db.from('platform_settings').update({ value: 0 }).eq('key', 'fee_rate').select()
    expect(result.error?.code).toBe('42501')
    expect(must(await service.from('platform_settings').select('value').eq('key', 'fee_rate').eq('version', 1).single()).value).toBe(0.15)
  })

  it('admin liest das Journal nur mit aal2 (Anmeldung per Passwort ist aal1: nichts); niemand schreibt es per API', async () => {
    expect(must(await admin.db.from('commission_entries').select('id'))).toEqual([])
    const row = {
      request_id: requestB, partner_id: provider.id, revision_id: requestB, kind: 'booking', total_cents: 1, fee_vat_rate: 0, fee_cents: 0,
      fee_net_cents: 0, fee_vat_cents: 0, payout_cents: 1, vat_rule: 'standard_20', price_version: 1, fee_schedule_version: 1, fee_vat_rate_version: 1,
    } as never
    for (const db of [provider.db, admin.db, a.db]) expect((await db.from('commission_entries').insert(row)).error?.code).toBe('42501')
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

  it('macht platform_settings und das Journal nicht lesbar', async () => {
    expect((await anon.from('platform_settings').select('key')).data ?? []).toEqual([])
    expect((await anon.from('commission_entries').select('id')).data ?? []).toEqual([])
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

  it('kein Selbst-Upgrade: Kunde wird nicht Vermieter und liest keinen Gebührensatz', async () => {
    // Die RPC gibt es seit 0022 nicht mehr; der Name steht deshalb nicht in den generierten Typen.
    expect((await a.db.rpc('become_rental_provider' as never)).error).not.toBeNull()
    expect(must(await service.from('profiles').select('role').eq('id', a.id).single()).role).toBe('customer')
    expect(must(await a.db.from('platform_settings').select('key'))).toEqual([])
  })

  it('SECURITY DEFINER: Eigentümer postgres, fester search_path, EXECUTE für anon/authenticated nur laut Liste', () => {
    const rows = ownerSql(`select p.oid::regprocedure::text as fn, pg_get_userbyid(p.proowner) as owner,
        coalesce(array_to_string(p.proconfig, ','), '') as cfg,
        has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth,
        has_function_privilege('service_role', p.oid, 'execute') as svc
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef order by 1`)
    for (const r of rows) {
      expect.soft(r.owner, String(r.fn)).toBe('postgres')
      expect.soft(r.cfg, String(r.fn)).toBe('search_path=""')
    }
    const open = rows
      .filter((r) => r.anon === true || r.auth === true)
      .map((r) => `${r.fn}:${[r.anon === true && 'anon', r.auth === true && 'authenticated'].filter(Boolean).join('+')}`)
    expect(open).toEqual([
      'booking_open():anon+authenticated',
      'booking_terms():anon+authenticated',
      'complete_job(uuid)',
      'decline_listing(uuid)',
      'job_contact(uuid)',
      'my_cancel_info(uuid)', // s9i-7b: nur der Kunde der Anfrage (auth.uid() in der Funktion), nur die Pauschale in Cent, nie die Gebühr
      'my_commissions(date)',
      'my_job_changes()', // s9i-7a: aal2 und Firma active/payment_hold in der Funktion, nur eigene Zuordnungen, keine Personendaten und keine Gebühr
      'my_job_partner(uuid)',
      'my_jobs()', // s9i-6b: aal2 und Firma active/payment_hold in der Funktion, nur eigene Zuordnungen
      'my_report_info(uuid)', // s9k-1: nur der Kunde der Anfrage (auth.uid() in der Funktion), nur „Meldung möglich“ und die Frist, nie die Gebühr
      'my_request_offers(uuid)',
      'partner_quality()', // S9h-2: nur admin sieht Zeilen (is_admin in der Funktion)
      'payout_preview(bigint)', // s9p-1: nur Firmenmitglieder mit aal2 (in der Funktion), liefert nur „Du erhältst“, nie die Gebühr
      'private.assignment_access(uuid,uuid):authenticated',
      'private.in_scope_request(uuid,uuid):authenticated',
      'private.in_scope(uuid,service_type,smallint):authenticated',
      'private.is_admin():authenticated',
      'private.my_job_partner_id():authenticated',
      'private.my_member_partner_id():authenticated',
      'private.my_partner_id():authenticated',
      'private.my_role():authenticated',
      'private.partner_document_slot(text):authenticated',
      'private.partner_of_user():authenticated',
      'private.staging_photo_count():authenticated',
      'register_partner(text,text,text,boolean,text,text,text,text,text,text,smallint[],text)',
      'reject_offers(uuid)',
      'report_not_done(uuid)',
      'reported_jobs()', // S9h-3: nur admin mit aal2 sieht Zeilen (is_admin und aal2 in der Funktion)
      'send_offer(uuid,integer)',
      'set_en_route(uuid,integer)', // mail1: aal2, Firma active/payment_hold und aktive Zuordnung in der Funktion, liefert nur die Ankunftszeit, nie die Gebühr
      'start_job(uuid)',
      'withdraw_change(uuid)',
      'withdraw_offer(uuid)',
      'withdraw(uuid):authenticated',
    ].map((s) => (s.endsWith(')') ? `${s}:authenticated` : s)))
    // nur service_role (R2-N7): Admin-Funktionen laufen nie mit einem Nutzer-JWT
    const svcOnly = rows.filter((r) => r.svc === true && r.anon !== true && r.auth !== true).map((r) => String(r.fn))
    expect(svcOnly).toContain('admin_approve_partner(uuid,uuid,partner_service[],partner_vat_rule,text)')
    expect(svcOnly).toContain('admin_set_partner_status(uuid,uuid,partner_status,text)')
    expect(svcOnly).toContain('admin_set_partner_scope(uuid,uuid,partner_service[],smallint[],text)')
    expect(svcOnly).toContain('admin_set_vat_rule(uuid,uuid,partner_vat_rule,date,text)')
    expect(svcOnly).toContain('admin_set_partner_master(uuid,uuid,text,text,text,boolean,text,text,text,text,text)')
    expect(svcOnly).toContain('admin_remove_partner_document(uuid,uuid,text)')
    // S9c: Annahme (Art A) und Verteilung nur service_role, Partner-Aufrufe nie mit p_actor aus der Anfrage
    for (const f of ['partner_accept(uuid,uuid,uuid,bigint,numeric,bigint,bigint,bigint,bigint,integer,integer)', 'partner_accept_basis(uuid,uuid)', 'distribute_request(uuid)', 'distribute_pending()', 'expire_requests()', 'outbox_claim(integer)', 'outbox_mark(bigint,boolean,text)', 'admin_contact(uuid,uuid,text)', 'confirm_offer_basis(uuid,uuid)', 'confirm_offer(uuid,uuid,bigint,numeric,bigint,bigint,bigint,bigint,integer,integer)', 'expire_offers()',
      'propose_change_basis(uuid,text,uuid)', 'propose_change(uuid,text,uuid,uuid,jsonb,bigint,uuid[])', 'decide_change_basis(uuid,uuid)',
      'decide_change(uuid,uuid,boolean,bigint,numeric,bigint,bigint,bigint,bigint,integer,integer)', 'expire_changes()', 'complete_due()', 'export_commissions(uuid,date)',
      'cancel_by_partner_basis(uuid,text,uuid,text)', 'cancel_by_partner(uuid,text,uuid,text,uuid[],bigint,numeric,bigint,bigint,bigint,bigint,integer,integer)']) {
      expect(svcOnly, f).toContain(f)
    }
    expect(rows.filter((r) => String(r.fn).startsWith('admin_') && (r.anon === true || r.auth === true))).toEqual([])
    // Journal: die einzige Schreibstelle hat keinen Grant an irgendeine API-Rolle (S9b-4)
    expect(rows.filter((r) => String(r.fn).startsWith('private.commission_book(')).map((r) => [r.anon, r.auth, r.svc])).toEqual([[false, false, false]])
    // Trigger- und Hilfsfunktionen in private (ohne SECURITY DEFINER): kein EXECUTE für Nutzer-Rollen, außer geo_boundaries_make_valid (NA-15)
    const invoker = ownerSql(`select p.oid::regprocedure::text as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'private' and not p.prosecdef and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))`)
    expect(invoker.map((r) => String(r.fn))).toEqual(['private.geo_boundaries_make_valid()'])
  })
})
