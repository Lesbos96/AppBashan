// Statusmaschine, Revisionen, Kontakte, status_events (S9a-2, Migrationen 0017/0018). Jede Sperre: erlaubt UND verweigert, genauer Fehler.
// Fehler der Trigger und Funktionen: P0001 mit dem Code als Meldung; fehlende Rechte: 42501. Eigentümer-Proben laufen in begin … rollback.
// Der Rot-Beweis zu diesen Sperren steht in docs/proof/s9a2/ (das Skript redproof-s9a2.mjs ist seit R1 entfernt, git-Verlauf vor dem Entfernen).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { anon, DENIED, deleteUsers, makeRequest, makeUser, must, service, type TestUser } from '../support/db.ts'
import { TERMS } from '../support/quote.ts'
import { asUser, ownerGrantRole, ownerSql, probes } from '../support/owner.ts'

let a: TestUser
let b: TestUser
let admin: TestUser
let partner: TestUser
let reqA: string
let reqB: string
let revA: string
let revB: string

const NO_TABLE = (t: string) => `42501: permission denied for table ${t}`

beforeAll(async () => {
  a = await makeUser('status-a')
  b = await makeUser('status-b')
  admin = await makeUser('status-admin')
  partner = await makeUser('status-partner')
  ownerGrantRole(admin.id, 'admin')
  ownerGrantRole(partner.id, 'partner')
  reqA = await makeRequest(a.id)
  reqB = await makeRequest(b.id)
  revA = must(await service.from('price_revisions').select('id').eq('request_id', reqA).single()).id
  revB = must(await service.from('price_revisions').select('id').eq('request_id', reqB).single()).id
})

afterAll(async () => {
  await deleteUsers()
})

describe('Status nur über Funktionen', () => {
  it('direktes Status-UPDATE: customer, partner, admin (aal1 und aal2), service_role und anon verweigert, Status unverändert', async () => {
    for (const [name, db] of [['customer', a.db], ['partner', partner.db], ['admin aal1', admin.db]] as const) {
      expect((await db.from('service_requests').update({ status: 'withdrawn' }).eq('id', reqA)).error?.code, name).toBe(DENIED)
    }
    expect((await anon.from('service_requests').update({ status: 'withdrawn' }).eq('id', reqA)).error?.code).toBe(DENIED)
    // service_role per API: kein UPDATE-Recht auf status (nur auf current_revision)
    expect((await service.from('service_requests').update({ status: 'withdrawn' }).eq('id', reqA)).error?.code).toBe(DENIED)
    const r = probes('', [
      { name: 'admin aal2', sql: `update public.service_requests set status = 'withdrawn' where id = '${reqA}'`, as: 'authenticated', claims: { sub: admin.id, aal: 'aal2' } },
      { name: 'customer aal2', sql: `update public.service_requests set status = 'withdrawn' where id = '${reqA}'`, as: 'authenticated', claims: { sub: a.id, aal: 'aal2' } },
      { name: 'service_role', sql: `update public.service_requests set status = 'withdrawn' where id = '${reqA}'`, as: 'service_role' },
      { name: 'Ist-Status', sql: `=(select status from public.service_requests where id = '${reqA}')` },
    ])
    expect(r['admin aal2']).toBe(NO_TABLE('service_requests'))
    expect(r['customer aal2']).toBe(NO_TABLE('service_requests'))
    expect(r['service_role']).toBe(NO_TABLE('service_requests'))
    expect(r['Ist-Status']).toBe('= requested')
  })

  it('Trigger gilt auch für den Eigentümer: Paar und Marker sind getrennte Prüfungen', async () => {
    const set = (marker: string) => `perform set_config('app.mv_transition', ${marker}, true);`
    const upd = (id: string, to: string) => `update public.service_requests set status = '${to}' where id = '${id}'`
    const r = probes('', [
      { name: 'gültiges Paar ohne Marker', sql: upd(reqA, 'withdrawn') },
      { name: 'gültiges Paar, Marker einer anderen Anfrage', sql: `${set(`'${reqB}:withdrawn'`)} ${upd(reqA, 'withdrawn')}` },
      { name: 'gültiges Paar, Marker mit anderem Ziel', sql: `${set(`'${reqA}:expired'`)} ${upd(reqA, 'withdrawn')}` },
      { name: 'ungültiges Paar mit Marker', sql: `${set(`'${reqA}:accepted'`)} ${upd(reqA, 'accepted')}` },
      { name: 'ungültiges Paar (completed) mit Marker', sql: `${set(`'${reqA}:completed'`)} ${upd(reqA, 'completed')}` },
      { name: 'Positivkontrolle: Paar und Marker', sql: `${set(`'${reqA}:withdrawn'`)} ${upd(reqA, 'withdrawn')}` },
      { name: 'Positivkontrolle: Ereignis ohne Akteur ist „sql“', sql: `=(select actor_role from public.status_events where request_id = '${reqA}')` },
    ])
    expect(r['gültiges Paar ohne Marker']).toBe('P0001: invalid_transition')
    expect(r['gültiges Paar, Marker einer anderen Anfrage']).toBe('P0001: invalid_transition')
    expect(r['gültiges Paar, Marker mit anderem Ziel']).toBe('P0001: invalid_transition')
    expect(r['ungültiges Paar mit Marker']).toBe('P0001: invalid_transition')
    expect(r['ungültiges Paar (completed) mit Marker']).toBe('P0001: invalid_transition')
    expect(r['Positivkontrolle: Paar und Marker']).toBe('ok')
    expect(r['Positivkontrolle: Ereignis ohne Akteur ist „sql“']).toBe('= sql')
  })

  it('INSERT: nur requested/awaiting_offer; eine Anfrage ohne Revision wird beim Commit verworfen', async () => {
    const row = (status: string) => ({
      customer_id: a.id, client_ref: crypto.randomUUID(), service: 'move' as const, status: status as 'requested', district: 1,
      termin_at: new Date(Date.now() + 14 * 86_400_000).toISOString(), accept_deadline: new Date(Date.now() + 86_400_000).toISOString(),
    })
    expect((await service.from('service_requests').insert(row('accepted'))).error).toMatchObject({ code: 'P0001', message: 'invalid_transition' })
    expect((await service.from('service_requests').insert(row('completed'))).error).toMatchObject({ code: 'P0001', message: 'invalid_transition' })
    expect((await service.from('service_requests').insert(row('requested'))).error).toMatchObject({ code: 'P0001', message: 'revision_missing' })
    expect((await a.db.from('service_requests').insert({ customer_id: a.id, service: 'move' } as never)).error?.code).toBe(DENIED)
  })

  it('withdraw: Kunde ok (Ereignis mit Akteur), zweites Mal invalid_transition, fremd not_found, anon 42501', async () => {
    const id = await makeRequest(a.id)
    expect(must(await a.db.rpc('withdraw', { p_request: id }))).toBe('withdrawn')
    expect(must(await service.from('service_requests').select('status').eq('id', id).single()).status).toBe('withdrawn')
    const events = ownerSql(`select from_status, to_status, actor_id, actor_role from public.status_events where request_id = '${id}'`)
    expect(events).toEqual([{ from_status: 'requested', to_status: 'withdrawn', actor_id: a.id, actor_role: 'customer' }])
    expect((await a.db.rpc('withdraw', { p_request: id })).error).toMatchObject({ code: 'P0001', message: 'invalid_transition' })
    const other = await makeRequest(b.id)
    expect((await a.db.rpc('withdraw', { p_request: other })).error).toMatchObject({ code: 'P0001', message: 'not_found' })
    expect((await a.db.rpc('withdraw', { p_request: '99999999-9999-4999-8999-999999999999' })).error).toMatchObject({ message: 'not_found' })
    expect(must(await service.from('service_requests').select('status').eq('id', other).single()).status).toBe('requested')
    const denied = await anon.rpc('withdraw', { p_request: other })
    expect(denied.error?.code).toBe(DENIED)
    expect(denied.error?.message).toContain('permission denied for function withdraw')
  })

  it('withdraw aus awaiting_offer ok; die Marker der Funktion bleiben nicht in der Sitzung stehen', async () => {
    const id = await makeRequest(a.id, { p_total: null, p_low: null, p_high: null, p_snapshot: { kind: 'offer', reasons: ['special_case'], terms: TERMS } })
    expect(must(await service.from('service_requests').select('status').eq('id', id).single()).status).toBe('awaiting_offer')
    expect(must(await a.db.rpc('withdraw', { p_request: id }))).toBe('withdrawn')
    const r = probes('', [
      { name: 'Marker nach withdraw', sql: `=(select current_setting('app.mv_transition', true))` },
    ])
    expect(r['Marker nach withdraw']).toMatch(/^= (<null>|)$/)
  })

  it('Miete: nur requested → withdrawn, auch für den Eigentümer; ungültige Paare invalid_transition', async () => {
    const offer = must(await service.from('rental_offers').select('id').eq('status', 'approved').limit(1).single()).id
    const booking = must(
      await service.from('rental_bookings').insert({
        offer_id: offer, customer_id: a.id, pickup_at: '2030-01-01T08:00:00Z', return_at: '2030-01-02T08:00:00Z', km: 0,
        price_snapshot: {}, price_version: 1, total_cents: 100, deposit_cents: 0, client_ref: crypto.randomUUID(),
      }).select('id').single(),
    ).id
    const upd = (to: string) => `update public.rental_bookings set status = '${to}' where id = '${booking}'`
    const r = probes('', [
      { name: 'completed (Eigentümer)', sql: upd('completed') },
      { name: 'accepted (Eigentümer)', sql: upd('accepted') },
      // „not found“ = 0 Zeilen (RLS blendet aus): ohne diese Prüfung wäre ein wirkungsloses UPDATE ein falsches „ok“
      { name: 'Kunde setzt withdrawn', sql: `${upd('withdrawn')}; if not found then raise exception 'zero_rows'; end if`, as: 'authenticated', claims: { sub: a.id, aal: 'aal1' } },
      { name: 'Kunde setzt accepted', sql: `${upd('accepted')}; if not found then raise exception 'zero_rows'; end if`, as: 'authenticated', claims: { sub: a.id, aal: 'aal1' } },
      // erfolgreiche Schritte bleiben bis zum Rollback bestehen: der Eigentümer-Schritt kommt zuletzt
      { name: 'fremder Kunde setzt withdrawn', sql: `${upd('withdrawn')}; if not found then raise exception 'zero_rows'; end if`, as: 'authenticated', claims: { sub: b.id, aal: 'aal1' } },
      { name: 'withdrawn (Eigentümer)', sql: upd('withdrawn') },
    ])
    expect(r['completed (Eigentümer)']).toBe('P0001: invalid_transition')
    expect(r['accepted (Eigentümer)']).toBe('P0001: invalid_transition')
    expect(r['withdrawn (Eigentümer)']).toBe('ok')
    expect(r['Kunde setzt withdrawn']).toBe('ok')
    expect(r['Kunde setzt accepted']).toMatch(/^(42501|P0001): /)
    expect(r['fremder Kunde setzt withdrawn']).toBe('P0001: zero_rows')
    expect(must(await service.from('rental_bookings').select('status').eq('id', booking).single()).status).toBe('requested')
  })

  it('service_role schreibt kein Journal (commission_entries); kein Auftrag hat Zeilen', async () => {
    const row = { partner_id: reqA, request_id: reqA, revision_id: revA, kind: 'booking', total_cents: 1, fee_rate: 0, fee_vat_rate: 0, fee_cents: 0, fee_net_cents: 0, fee_vat_cents: 0, payout_cents: 1, vat_rule: 'standard_20', price_version: 1, fee_rate_version: 1, fee_vat_rate_version: 1 } as never
    expect((await service.from('commission_entries').insert(row)).error?.code).toBe(DENIED)
    expect(must(await service.from('commission_entries').select('id').eq('request_id', reqA))).toEqual([])
  })
})

describe('Revisionen unveränderlich', () => {
  it('UPDATE, DELETE, TRUNCATE: auch der Eigentümer scheitert an revision_immutable; service_role hat kein Recht', async () => {
    const r = probes('', [
      { name: 'Preis (Eigentümer)', sql: `update public.price_revisions set total_cents = 1, low_cents = 1, high_cents = 1 where id = '${revA}'` },
      { name: 'Snapshot (Eigentümer)', sql: `update public.price_revisions set snapshot = '{"kind":"offer","reasons":["special_case"]}' where id = '${revA}'` },
      { name: 'inputs (Eigentümer)', sql: `update public.price_revisions set inputs = '{}' where id = '${revA}'` },
      { name: 'DELETE (Eigentümer)', sql: `delete from public.price_revisions where id = '${revA}'` },
      { name: 'TRUNCATE (Eigentümer)', sql: 'truncate public.price_revisions cascade' },
      { name: 'UPDATE (service_role)', sql: `update public.price_revisions set total_cents = 1 where id = '${revA}'`, as: 'service_role' },
      { name: 'DELETE (service_role)', sql: `delete from public.price_revisions where id = '${revA}'`, as: 'service_role' },
      { name: 'Ist-Preis', sql: `=(select total_cents from public.price_revisions where id = '${revA}')` },
    ])
    for (const k of ['Preis (Eigentümer)', 'Snapshot (Eigentümer)', 'inputs (Eigentümer)', 'DELETE (Eigentümer)']) expect(r[k], k).toBe('P0001: revision_immutable')
    expect(r['TRUNCATE (Eigentümer)']).toMatch(/^P0001: (revision_immutable|request_immutable)$/) // die Kaskade trifft beide Tabellen
    expect(r['UPDATE (service_role)']).toBe(NO_TABLE('price_revisions'))
    expect(r['DELETE (service_role)']).toBe(NO_TABLE('price_revisions'))
    expect(r['Ist-Preis']).toBe('= 68961')
    expect((await service.from('price_revisions').update({ total_cents: 1 }).eq('id', revA)).error?.code).toBe(DENIED)
  })

  it('INSERT: nur Revision 1 beim Absenden, Status passend zum Preis, Snapshot passend zu den Beträgen, Version veröffentlicht', async () => {
    const ins = (cols: string, vals: string) => `insert into public.price_revisions (${cols}) values (${vals})`
    const base = (request: string, over: Record<string, string> = {}) => {
      const v = { request_id: `'${request}'`, n: '1', source: `'submit'`, inputs: `'{}'`, snapshot: `'{"kind":"price","totalCents":100,"lowCents":100,"highCents":100,"lines":[]}'`, price_version: '1', total_cents: '100', low_cents: '100', high_cents: '100', ...over }
      return ins(Object.keys(v).join(', '), Object.values(v).join(', '))
    }
    const fresh = (id: string, status: string) =>
      `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline) values ('${id}', '${a.id}', gen_random_uuid(), 'move', '${status}', 1, now() + interval '14 days', now() + interval '1 day');`
    const N1 = '11111111-1111-4111-8111-111111111111'
    const N2 = '22222222-2222-4222-8222-222222222222'
    const r = probes(`${fresh(N1, 'requested')} ${fresh(N2, 'awaiting_offer')} insert into public.price_versions (version, effective_on) values (99990, '2999-01-01')`, [
      { name: 'zweite Revision n = 2 (service_role)', sql: base(reqA, { n: '2' }), as: 'service_role' },
      { name: 'zweite Revision n = 1 zur Anfrage mit Zeiger', sql: base(reqA) },
      { name: 'Quelle partner_offer', sql: base(N1, { source: `'partner_offer'` }) },
      { name: 'Quelle change_order', sql: base(N1, { source: `'change_order'` }) },
      { name: 'Status passt nicht (total gesetzt, Anfrage awaiting_offer)', sql: base(N2) },
      { name: 'Status passt nicht (kein total, Anfrage requested)', sql: base(N1, { snapshot: `'{"kind":"offer","reasons":["special_case"]}'`, total_cents: 'null', low_cents: 'null', high_cents: 'null' }) },
      { name: 'Snapshot offer, aber Beträge gesetzt', sql: base(N1, { snapshot: `'{"kind":"offer","reasons":["special_case"]}'` }) },
      { name: 'Snapshot weicht ab (Betrag)', sql: base(N1, { snapshot: `'{"kind":"price","totalCents":999,"lowCents":100,"highCents":100,"lines":[]}'` }) },
      { name: 'Spanne mit totalCents im Snapshot', sql: base(N2, { snapshot: `'{"kind":"price","totalCents":150,"lowCents":100,"highCents":200,"lines":[]}'`, total_cents: 'null', low_cents: '100', high_cents: '200' }) },
      { name: 'unveröffentlichte Version', sql: base(N1, { price_version: '99990' }) },
      { name: 'Betragsprüfung: Festpreis ohne low = total', sql: base(N1, { low_cents: '50' }) },
      { name: 'Positivkontrolle: Festpreis', sql: base(N1) },
      { name: 'Positivkontrolle: Hash gesetzt', sql: `=(select length(content_hash) from public.price_revisions where request_id = '${N1}')` },
    ])
    expect(r['zweite Revision n = 2 (service_role)']).toBe('P0001: invalid_revision')
    expect(r['zweite Revision n = 1 zur Anfrage mit Zeiger']).toBe('P0001: invalid_revision')
    expect(r['Quelle partner_offer']).toBe('P0001: invalid_revision')
    expect(r['Quelle change_order']).toBe('P0001: invalid_revision')
    expect(r['Status passt nicht (total gesetzt, Anfrage awaiting_offer)']).toBe('P0001: status_mismatch')
    expect(r['Status passt nicht (kein total, Anfrage requested)']).toBe('P0001: status_mismatch')
    expect(r['Snapshot offer, aber Beträge gesetzt']).toBe('P0001: invalid_revision')
    expect(r['Snapshot weicht ab (Betrag)']).toBe('P0001: invalid_revision')
    expect(r['Spanne mit totalCents im Snapshot']).toBe('P0001: invalid_revision')
    expect(r['unveröffentlichte Version']).toBe('P0001: version_unpublished')
    expect(r['Betragsprüfung: Festpreis ohne low = total']).toBe('P0001: invalid_revision') // Snapshot-Abgleich greift vor der Check-Regel
    expect(r['Positivkontrolle: Festpreis']).toBe('ok')
    expect(r['Positivkontrolle: Hash gesetzt']).toBe('= 64')
  })

  it('Zeiger: einmalig, nur auf Revision 1 derselben Anfrage; Frist, Termin und Bezirk unveränderlich', async () => {
    const r = probes('', [
      { name: 'Zeiger auf fremde Revision (service_role)', sql: `update public.service_requests set current_revision = '${revB}' where id = '${reqA}'`, as: 'service_role' },
      { name: 'Zeiger auf NULL', sql: `update public.service_requests set current_revision = null where id = '${reqA}'` },
      { name: 'Zeiger gleich (kein Fehler)', sql: `update public.service_requests set current_revision = '${revA}' where id = '${reqA}'`, as: 'service_role' },
      { name: 'termin_at', sql: `update public.service_requests set termin_at = termin_at + interval '1 day' where id = '${reqA}'` },
      { name: 'accept_deadline', sql: `update public.service_requests set accept_deadline = accept_deadline + interval '1 day' where id = '${reqA}'` },
      { name: 'district', sql: `update public.service_requests set district = 2 where id = '${reqA}'` },
      { name: 'Ist-Zeiger', sql: `=(select current_revision from public.service_requests where id = '${reqA}')` },
    ])
    expect(r['Zeiger auf fremde Revision (service_role)']).toBe('P0001: invalid_revision_pointer')
    expect(r['Zeiger auf NULL']).toBe('P0001: invalid_revision_pointer')
    expect(r['Zeiger gleich (kein Fehler)']).toBe('ok')
    for (const k of ['termin_at', 'accept_deadline', 'district']) expect(r[k], k).toBe('P0001: field_immutable')
    expect(r['Ist-Zeiger']).toBe(`= ${revA}`)
    expect((await service.from('service_requests').update({ current_revision: revB }).eq('id', reqA)).error).toMatchObject({ message: 'invalid_revision_pointer' })
  })

  it('service_role ändert nur den Zeiger: Adresse, Kunde, Strecke verweigert; Löschen verweigert (auch Eigentümer, nur Kaskade)', async () => {
    for (const patch of [{ from_address: 'x' }, { customer_id: b.id }, { region: 'austria' }, { preferred_date: '2030-01-01' }, { volume_m3: 3 }]) {
      expect((await service.from('service_requests').update(patch as never).eq('id', reqA)).error?.code, JSON.stringify(patch)).toBe(DENIED)
    }
    expect((await service.from('service_requests').delete().eq('id', reqA)).error?.code).toBe(DENIED)
    const r = probes('', [
      { name: 'DELETE (Eigentümer)', sql: `delete from public.service_requests where id = '${reqA}'` },
      { name: 'TRUNCATE (Eigentümer)', sql: 'truncate public.service_requests cascade' },
      { name: 'DELETE profiles (service_role)', sql: `delete from public.profiles where id = '${a.id}'`, as: 'service_role' },
    ])
    expect(r['DELETE (Eigentümer)']).toBe('P0001: request_immutable')
    expect(r['TRUNCATE (Eigentümer)']).toBe('P0001: request_immutable')
    expect(r['DELETE profiles (service_role)']).toBe(NO_TABLE('profiles'))
  })

  it('Kontolöschung räumt Anfrage, Revision, Ereignisse und Kontakte per Kaskade (Positivkontrolle)', async () => {
    const victim = await makeUser('status-victim')
    const id = await makeRequest(victim.id)
    must(await victim.db.rpc('withdraw', { p_request: id }))
    const count = () => ownerSql(`select (select count(*) from public.service_requests where id = '${id}')::int a, (select count(*) from public.price_revisions where request_id = '${id}')::int b, (select count(*) from public.status_events where request_id = '${id}')::int c, (select count(*) from public.request_contacts where request_id = '${id}')::int d`)[0]
    expect(count()).toEqual({ a: 1, b: 1, c: 1, d: 1 })
    const { error } = await service.auth.admin.deleteUser(victim.id)
    expect(error).toBeNull()
    expect(count()).toEqual({ a: 0, b: 0, c: 0, d: 0 })
  })
})

describe('status_events: nur anfügen, nur admin (aal2) liest', () => {
  it('UPDATE, DELETE, TRUNCATE: append_only; service_role und Kunde schreiben nicht', async () => {
    const id = await makeRequest(a.id)
    must(await a.db.rpc('withdraw', { p_request: id }))
    const r = probes('', [
      { name: 'UPDATE', sql: `update public.status_events set to_status = 'expired' where request_id = '${id}'` },
      { name: 'DELETE', sql: `delete from public.status_events where request_id = '${id}'` },
      { name: 'TRUNCATE', sql: 'truncate public.status_events' },
      { name: 'INSERT (service_role)', sql: `insert into public.status_events (request_id, from_status, to_status, actor_role) values ('${id}', 'requested', 'expired', 'system')`, as: 'service_role' },
      { name: 'SELECT (service_role)', sql: 'select 1 from public.status_events limit 1', as: 'service_role' },
      { name: 'INSERT (Kunde)', sql: `insert into public.status_events (request_id, from_status, to_status, actor_role) values ('${id}', 'requested', 'expired', 'customer')`, as: 'authenticated', claims: { sub: a.id, aal: 'aal2' } },
      { name: 'Ereignisse', sql: `=(select count(*) from public.status_events where request_id = '${id}')` },
    ])
    for (const k of ['UPDATE', 'DELETE', 'TRUNCATE']) expect(r[k], k).toBe('P0001: append_only')
    expect(r['INSERT (service_role)']).toBe(NO_TABLE('status_events'))
    expect(r['SELECT (service_role)']).toBe(NO_TABLE('status_events'))
    expect(r['INSERT (Kunde)']).toBe(NO_TABLE('status_events'))
    expect(r['Ereignisse']).toBe('= 1')
  })

  it('Lesen: Kunde und Partner nie, admin nur mit aal2 (Positivkontrolle)', async () => {
    const n = (who: string, aal: 'aal1' | 'aal2') => Number(asUser(who, aal, 'select count(*)::int as n from public.status_events')[0]!.n)
    expect(n(a.id, 'aal2')).toBe(0)
    expect(n(partner.id, 'aal2')).toBe(0)
    expect(n(admin.id, 'aal1')).toBe(0)
    expect(n(admin.id, 'aal2')).toBeGreaterThan(0)
    expect(must(await a.db.from('status_events').select('id'))).toEqual([])
    expect((await anon.from('status_events').select('id')).error?.code).toBe(DENIED)
  })
})

describe('Lesen: Revisionen und Kontakte', () => {
  beforeAll(() => {
    ownerSql(`update public.request_contacts set name = 'Anna', stairs_door = 'Stiege 2, Tür 5' where request_id = '${reqA}'; update public.request_contacts set name = 'Bernd' where request_id = '${reqB}'`)
  })

  it('Kunde liest nur eigene Revisionen und Kontakte, fremde 0 Zeilen (Positivkontrolle eigene), admin und Partner nichts', async () => {
    expect(must(await a.db.from('price_revisions').select('id').eq('request_id', reqA))).toHaveLength(1)
    expect(must(await a.db.from('price_revisions').select('id').eq('request_id', reqB))).toEqual([])
    expect(must(await a.db.from('request_contacts').select('name, stairs_door').eq('request_id', reqA))).toEqual([{ name: 'Anna', stairs_door: 'Stiege 2, Tür 5' }])
    expect(must(await a.db.from('request_contacts').select('name').eq('request_id', reqB))).toEqual([])
    const n = (who: string, aal: 'aal1' | 'aal2', table: string) => Number(asUser(who, aal, `select count(*)::int as n from public.${table}`)[0]!.n)
    for (const table of ['price_revisions', 'request_contacts']) {
      expect(n(admin.id, 'aal2', table), `admin aal2 ${table}`).toBe(0)
      expect(n(admin.id, 'aal1', table), `admin aal1 ${table}`).toBe(0)
      expect(n(partner.id, 'aal2', table), `partner ${table}`).toBe(0)
      expect((await anon.from(table as 'price_revisions').select('request_id')).error?.code, `anon ${table}`).toBe(DENIED)
    }
  }, 120_000) // acht Eigentümer-Abfragen über die CLI

  it('Kontakte und Revisionen: Kunde schreibt nicht; service_role fügt Kontakte nur ein (kein UPDATE/DELETE)', async () => {
    expect((await a.db.from('request_contacts').insert({ request_id: reqA, name: 'x', phone: '1', email: 'x@y.test' })).error?.code).toBe(DENIED)
    expect((await a.db.from('request_contacts').update({ name: 'neu' }).eq('request_id', reqA)).error?.code).toBe(DENIED)
    expect((await a.db.from('price_revisions').insert({ request_id: reqA, n: 1, source: 'submit', inputs: {}, snapshot: {}, price_version: 1, content_hash: 'x' })).error?.code).toBe(DENIED)
    expect((await service.from('request_contacts').update({ name: 'neu' }).eq('request_id', reqA)).error?.code).toBe(DENIED)
    expect((await service.from('request_contacts').delete().eq('request_id', reqA)).error?.code).toBe(DENIED)
    // Positivkontrolle: service_role darf einfügen; quote_save_request legt den Kontakt schon an, daher scheitert erst der Primärschlüssel (23505), nicht das Recht (42501)
    const id = await makeRequest(a.id)
    expect((await service.from('request_contacts').insert({ request_id: id, name: 'Doppelt', phone: '0660 12345', email: 'n@y.test' })).error?.code).toBe('23505')
  })
})
