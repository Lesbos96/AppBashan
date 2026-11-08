// Fotos für Partner (S9d, Migration 0035). Alles läuft als Rollback-Proben (`probes`), es bleibt nichts zurück.
// Geprüft: Wartebedingung der Verteilung, Claim und Mark (Lease, Versuche, Stale), Zugriff (Partner, Kunde, admin), Belege, Aufräumen.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { ownerSql, probes, type Step } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, P, setStatus } from '../support/partner.ts'

const TODAY = "(now() at time zone 'Europe/Vienna')::date"
const cur = (key: string, col: string) =>
  `(select ${col} from public.platform_settings where key = '${key}' and effective_from <= ${TODAY} order by effective_from desc, version desc limit 1)`
function rates() {
  const r = ownerSql(`select ${cur('fee_rate', 'value::float8')} as fr, ${cur('fee_vat_rate', 'value::float8')} as vr, ${cur('fee_rate', 'version')} as frv, ${cur('fee_vat_rate', 'version')} as vrv`)[0] as {
    fr: number
    vr: number
    frv: number
    vrv: number
  }
  return { ...r, split: (total: number) => splitFee(total, { feeRate: r.fr, vatRate: r.vr }) }
}

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pb: newId() }
const USERS = insertUsers(Object.values(U))
// Bezirk 21: keine committete Firma (die Abdeckungsfirma lässt 17, 18 und 21 aus); alles läuft im Rollback, andere Tests bleiben unberührt
const OV = { districts: 'array[21]::smallint[]' }
const BASE = `${USERS} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}`

const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
/** Auftrag samt Revision 1 (Festpreis 68961), Bezirk 21, Frist in 1 Tag. */
const request = (id: string, customer = U.cust) =>
  `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
     values ('${id}', '${customer}', gen_random_uuid(), 'move', 'requested', 21, now() + interval '14 days', now() + interval '1 day');
   insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
     values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[]}', 1, 68961, 68961, 68961);
   update public.service_requests set current_revision = ${rev(id)} where id = '${id}';`
/** Staging-Foto als Zeile von request_photos (Marker wie quote_save_request). */
const photo = (req: string) =>
  `select set_config('app.mv_photo_request', '${req}', true);
   insert into public.request_photos (request_id, storage_path) select '${req}', s.customer_id || '/' || s.client_ref || '/' || gen_random_uuid() || '.jpg' from public.service_requests s where s.id = '${req}';
   select set_config('app.mv_photo_request', '', true);`
/** Kopien im Endzustand ready für alle Fotos der Anfrage. */
const path = (p?: string) => (p ? `'${p}'` : "gen_random_uuid() || '.jpg'")
const ready = (req: string, p?: string) =>
  `insert into public.job_photos (request_id, kind, source_photo_id, status, storage_path, sha256, decided_at)
     select request_id, 'request', id, 'ready', ${path(p)}, repeat('a', 64), now() from public.request_photos where request_id = '${req}';`
const receipt = (req: string, key: string, n = 1, p?: string) =>
  `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
     select '${req}', 'receipt', ${P(key)}, 'ready', ${path(p)}, repeat('b', 64), now() from generate_series(1, ${n});`
/** Statusfunktion als plpgsql-Anweisung (ohne Semikolon am Ende). */
const setSt = (key: string, status: string) => setStatus(U.adm, key, status).replace(/^select /, 'perform ').replace(/;$/, '')
const obj = (bucket: string, name: string, age = '0 seconds') =>
  `insert into storage.objects (bucket_id, name, created_at) values ('${bucket}', '${name}', now() - interval '${age}');`
const JP = (req: string, i: number) => `(select id from public.job_photos where request_id = '${req}' order by id limit 1 offset ${i})`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const count = (sql: string) => `(select count(*) from ${sql})`
const dist = (req: string) => `select public.distribute_request('${req}');`
const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const rows = (v: string | undefined, n: number) => expect(v, String(v)).toBe(`= ${n}`)
const uid = () => crypto.randomUUID()

describe('Verteilung wartet auf Fotos, Claim und Mark', () => {
  it('Wartebedingung, Claim mit Lease, Mark nur mit gültigem Versuch, Verteilung nach dem letzten Foto, Mail bei failed', () => {
    const [R0, R1] = [newId(), newId()]
    const [P0, P1] = [`${uid()}.jpg`, `${uid()}.jpg`]
    const setup = `${BASE} ${request(R0)} ${request(R1)} ${photo(R1)} ${photo(R1)}`
    const mark = (i: number, att: number, ok: boolean, path: string, err = 'null') =>
      `public.photo_publish_mark(${JP(R1, i)}, ${att}, ${ok}, ${ok ? `'${path}'` : 'null'}, ${ok ? "repeat('a', 64)" : 'null'}, ${ok ? 'null' : err})`
    const steps: Step[] = [
      { name: 'ohne Fotos', as: 'service_role', sql: `=public.distribute_request('${R0}')` },
      { name: 'mit Fotos wartet', as: 'service_role', sql: `=public.distribute_request('${R1}')` },
      { name: 'Status bleibt', sql: `=(select status::text from public.service_requests where id = '${R1}')` },
      { name: 'Nachlauf', sql: `perform public.distribute_pending()` },
      { name: 'Nachlauf ließ aus', sql: `=${count(`public.job_listings where request_id = '${R1}'`)}` },
      { name: 'Dispatch ohne Secrets', sql: `perform public.photo_publish_dispatch()` },
      { name: 'kein Versuch gezählt', sql: `=${count(`public.job_photos where request_id = '${R1}'`)}` },
      { name: 'claim', as: 'service_role', sql: `perform count(*) from public.photo_claim(50)` },
      { name: 'beide pending', sql: `=${count(`public.job_photos where request_id = '${R1}' and status = 'pending' and attempts = 1`)}` },
      { name: 'zweiter claim in der Lease', as: 'service_role', sql: `perform count(*) from public.photo_claim(50)` },
      { name: 'Versuche bleiben 1', sql: `=(select max(attempts) from public.job_photos where request_id = '${R1}')` },
      { name: 'begin', as: 'service_role', sql: `=public.photo_publish_begin(${JP(R1, 0)}, 1)` },
      { name: 'begin falscher Versuch', as: 'service_role', sql: `perform public.photo_publish_begin(${JP(R1, 0)}, 2)` },
      { name: 'Objekt anlegen', sql: obj('job-photos', P0).replace(/;$/, '') },
      { name: 'mark ohne Datei', as: 'service_role', sql: `perform ${mark(1, 1, true, P1)}` },
      { name: 'mark ready', as: 'service_role', sql: `perform ${mark(0, 1, true, P0)}` },
      { name: 'letztes Foto fehlt noch', as: 'service_role', sql: `=public.distribute_request('${R1}')` },
      { name: 'mark failed', as: 'service_role', sql: `perform ${mark(1, 1, false, '', "'decode_failed'")}` },
      { name: 'Listings nach failed', sql: `=${count(`public.job_listings where request_id = '${R1}'`)}` },
      { name: 'Mail photo_failed', sql: `=${count(`public.outbox where kind = 'photo_failed' and request_id = '${R1}'`)}` },
      { name: 'Mail listing_new', sql: `=${count(`public.outbox where kind = 'listing_new' and request_id = '${R1}'`)}` },
      { name: 'mark erneut', as: 'service_role', sql: `perform ${mark(0, 1, true, P0)}` },
      { name: 'ready ist unveränderlich', sql: `update public.job_photos set status = 'failed' where id = ${JP(R1, 0)}` },
      { name: 'löschen verboten', sql: `delete from public.job_photos where request_id = '${R1}'` },
      { name: 'claim als Konto', as: 'authenticated', claims: A2(U.pa), sql: `perform public.photo_claim(1)` },
      { name: 'claim als anon', as: 'anon', sql: `perform public.photo_claim(1)` },
    ]
    const r = probes(setup, steps)
    rows(r['ohne Fotos'], 2) // Firmen a und b
    rows(r['mit Fotos wartet'], 0)
    expect(r['Status bleibt']).toBe('= requested')
    rows(r['Nachlauf ließ aus'], 0)
    err(r['Dispatch ohne Secrets'], 'nicht eingerichtet')
    rows(r['kein Versuch gezählt'], 0)
    rows(r['beide pending'], 2)
    rows(r['Versuche bleiben 1'], 1)
    expect(r['begin']).toMatch(/^= .+\.jpg$/)
    err(r['begin falscher Versuch'], 'stale_claim')
    err(r['mark ohne Datei'], 'file_missing')
    expect(r['mark ready']).toBe('ok')
    rows(r['letztes Foto fehlt noch'], 0)
    expect(r['mark failed']).toBe('ok')
    rows(r['Listings nach failed'], 2)
    rows(r['Mail photo_failed'], 1)
    rows(r['Mail listing_new'], 2)
    err(r['mark erneut'], 'stale_claim')
    err(r['ready ist unveränderlich'], 'append_only')
    err(r['löschen verboten'], 'append_only')
    err(r['claim als Konto'], '42501')
    err(r['claim als anon'], '42501')
  })

  it('Lease läuft ab: Versuch 2 und 3, ein überholter Versuch wird abgewiesen, danach failed (attempts_exhausted) und Verteilung', () => {
    const R = newId()
    const expire = `update public.job_photos set lease_until = now() - interval '1 second' where request_id = '${R}'`
    const claim = { as: 'service_role' as const, sql: `perform count(*) from public.photo_claim(50)` }
    const att = `=(select attempts from public.job_photos where request_id = '${R}')`
    const steps: Step[] = [
      { name: 'c1', ...claim }, { name: 'a1', sql: att }, { name: 'e1', sql: expire },
      { name: 'c2', ...claim }, { name: 'a2', sql: att },
      { name: 'mark Versuch 1 überholt', as: 'service_role', sql: `perform public.photo_publish_mark(${JP(R, 0)}, 1, false, null, null, 'decode_failed')` },
      { name: 'e2', sql: expire }, { name: 'c3', ...claim }, { name: 'a3', sql: att }, { name: 'e3', sql: expire },
      { name: 'c4', ...claim },
      { name: 'Endzustand', sql: `=(select status || ':' || coalesce(error_code, '') from public.job_photos where request_id = '${R}')` },
      { name: 'Listings', sql: `=${count(`public.job_listings where request_id = '${R}'`)}` },
      { name: 'Mail', sql: `=${count(`public.outbox where kind = 'photo_failed' and request_id = '${R}'`)}` },
    ]
    const r = probes(`${BASE} ${request(R)} ${photo(R)}`, steps)
    rows(r['a1'], 1)
    rows(r['a2'], 2)
    err(r['mark Versuch 1 überholt'], 'stale_claim')
    rows(r['a3'], 3)
    expect(r['Endzustand']).toBe('= failed:attempts_exhausted')
    rows(r['Listings'], 2)
    rows(r['Mail'], 1)
  })
})

describe('Zugriff auf Kopien (job_photo_list)', () => {
  it('Partner vor der Annahme nur Fotos, Kunde nur Belege; verweigert: aal1, fremdes Listing, fremder Kunde, Argumente, suspended, nach Frist', () => {
    const R = newId()
    // Listing-IDs als Einstellung: Konten dürfen request_id (Spalte der Suche über LID) nicht lesen
    const ids = `select set_config('app.l_a', ${LID(R, 'a')}::text, true); select set_config('app.l_b', ${LID(R, 'b')}::text, true);`
    const setup = `${BASE} ${request(R)} ${photo(R)} ${ready(R)} ${receipt(R, 'a')} ${dist(R)} ${ids}`
    const seen = (key: string) => `=${count(`public.job_listings where id = current_setting('app.l_${key}')::uuid`)}`
    const list = (who: string, aal: string, listing: string, req = 'null') => `public.job_photo_list('${who}', '${aal}', ${listing}, ${req})`
    const steps: Step[] = [
      { name: 'a Listing', as: 'service_role', sql: `=(select count(*) from ${list(U.pa, 'aal2', LID(R, 'a'))})` },
      { name: 'a Art', as: 'service_role', sql: `=(select kind from ${list(U.pa, 'aal2', LID(R, 'a'))})` },
      { name: 'RLS Listing sichtbar', as: 'authenticated', claims: A2(U.pa), sql: seen('a') },
      { name: 'a aal1', as: 'service_role', sql: `perform * from ${list(U.pa, 'aal1', LID(R, 'a'))}` },
      { name: 'a fremdes Listing', as: 'service_role', sql: `perform * from ${list(U.pa, 'aal2', LID(R, 'b'))}` },
      { name: 'Kunde Belege', as: 'service_role', sql: `=(select count(*) from ${list(U.cust, 'aal1', 'null', `'${R}'`)})` },
      { name: 'Kunde Art', as: 'service_role', sql: `=(select kind from ${list(U.cust, 'aal1', 'null', `'${R}'`)})` },
      { name: 'fremder Kunde', as: 'service_role', sql: `perform * from ${list(U.cust2, 'aal1', 'null', `'${R}'`)}` },
      { name: 'Partner über Anfrage', as: 'service_role', sql: `perform * from ${list(U.pa, 'aal2', 'null', `'${R}'`)}` },
      { name: 'ohne Argument', as: 'service_role', sql: `perform * from ${list(U.pa, 'aal2', 'null')}` },
      { name: 'Konto darf nicht', as: 'authenticated', claims: A2(U.pa), sql: `perform * from ${list(U.pa, 'aal2', LID(R, 'a'))}` },
      { name: 'Frist b', sql: `update public.job_listings set accept_deadline = now() - interval '1 minute' where id = ${LID(R, 'b')}` },
      { name: 'b nach Frist', as: 'service_role', sql: `perform * from ${list(U.pb, 'aal2', LID(R, 'b'))}` },
      { name: 'RLS b nach Frist', as: 'authenticated', claims: A2(U.pb), sql: seen('b') },
      { name: 'a suspended', sql: setSt('a', 'suspended') },
      { name: 'a nach suspended', as: 'service_role', sql: `perform * from ${list(U.pa, 'aal2', LID(R, 'a'))}` },
      { name: 'RLS a nach suspended', as: 'authenticated', claims: A2(U.pa), sql: seen('a') },
    ]
    const r = probes(setup, steps)
    rows(r['a Listing'], 1)
    expect(r['a Art']).toBe('= request')
    rows(r['RLS Listing sichtbar'], 1)
    err(r['a aal1'], 'mfa_required')
    err(r['a fremdes Listing'], 'not_found')
    rows(r['Kunde Belege'], 1)
    expect(r['Kunde Art']).toBe('= receipt')
    err(r['fremder Kunde'], 'not_found')
    err(r['Partner über Anfrage'], 'not_found')
    err(r['ohne Argument'], 'bad_request')
    err(r['Konto darf nicht'], '42501')
    expect(r['Frist b']).toBe('ok')
    err(r['b nach Frist'], 'not_found')
    rows(r['RLS b nach Frist'], 0)
    err(r['a nach suspended'], 'not_found')
    rows(r['RLS a nach suspended'], 0)
  })

  it('nach der Annahme Fotos und Belege (auch payment_hold), Belege nur mit Zuordnung, aal2, Limit 8; Zugriff endet nach 30 Tagen', () => {
    const R = newId()
    const s = rates().split(68961)
    const RT = rates()
    const accept = `select public.partner_accept('${U.pa}', ${LID(R, 'a')}, ${rev(R)}, ${s.payoutCents}, ${RT.fr}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.frv}, ${RT.vrv});`
    const [PR, PX] = [`${uid()}.jpg`, `${uid()}.jpg`]
    const setup = `${BASE} ${request(R)} ${photo(R)} ${ready(R)} ${dist(R)}`
    const list = `public.job_photo_list('${U.pa}', 'aal2', ${LID(R, 'a')}, null)`
    const all: Step[] = [
      { name: 'Annahme', as: 'service_role', sql: accept.replace(/^select /, 'perform ').replace(/;$/, '') },
      { name: 'Foto nach Annahme', as: 'service_role', sql: `=(select count(*) from ${list})` },
      { name: 'Beleg prüfen', as: 'service_role', sql: `perform public.photo_receipt_check('${U.pa}', 'aal2', '${R}')` },
      { name: 'Beleg aal1', as: 'service_role', sql: `perform public.photo_receipt_check('${U.pa}', 'aal1', '${R}')` },
      { name: 'Beleg fremde Firma', as: 'service_role', sql: `perform public.photo_receipt_check('${U.pb}', 'aal2', '${R}')` },
      { name: 'Beleg Kunde', as: 'service_role', sql: `perform public.photo_receipt_check('${U.cust}', 'aal2', '${R}')` },
      { name: 'Objekt', sql: obj('job-photos', PR).replace(/;$/, '') },
      { name: 'Beleg ohne Datei', as: 'service_role', sql: `perform public.photo_receipt_add('${U.pa}', 'aal2', '${R}', '${PX}', repeat('b', 64))` },
      { name: 'Beleg anfügen', as: 'service_role', sql: `perform public.photo_receipt_add('${U.pa}', 'aal2', '${R}', '${PR}', repeat('b', 64))` },
      { name: 'Foto und Beleg', as: 'service_role', sql: `=(select count(*) from ${list})` },
      { name: 'sieben Belege mehr', sql: receipt(R, 'a', 7).replace(/;$/, '') },
      { name: 'Limit 8', as: 'service_role', sql: `perform public.photo_receipt_check('${U.pa}', 'aal2', '${R}')` },
      { name: 'Kunde sieht Belege', as: 'service_role', sql: `=(select count(*) from public.job_photo_list('${U.cust}', 'aal1', null, '${R}'))` },
      { name: 'b nach Annahme', as: 'service_role', sql: `perform * from public.job_photo_list('${U.pb}', 'aal2', ${LID(R, 'b')}, null)` },
      { name: 'payment_hold', sql: setSt('a', 'payment_hold') },
      { name: 'payment_hold liest', as: 'service_role', sql: `=(select count(*) from ${list})` },
      { name: 'payment_hold lädt hoch', as: 'service_role', sql: `perform public.photo_receipt_check('${U.pa}', 'aal2', '${R}')` },
      { name: 'Zugriffsende', sql: `update public.assignments set ended_at = now() - interval '31 days', ended_reason = 'completed' where request_id = '${R}'` },
      { name: 'nach 30 Tagen', as: 'service_role', sql: `perform * from ${list}` },
      { name: 'Beleg ohne aktive Zuordnung', as: 'service_role', sql: `perform public.photo_receipt_check('${U.pa}', 'aal2', '${R}')` },
    ]
    const r = probes(setup, all)
    expect(r['Annahme']).toBe('ok')
    rows(r['Foto nach Annahme'], 1)
    expect(r['Beleg prüfen']).toBe('ok')
    err(r['Beleg aal1'], 'mfa_required')
    err(r['Beleg fremde Firma'], 'not_found')
    err(r['Beleg Kunde'], 'not_found')
    err(r['Beleg ohne Datei'], 'file_missing')
    expect(r['Beleg anfügen']).toBe('ok')
    rows(r['Foto und Beleg'], 2)
    err(r['Limit 8'], 'receipt_limit')
    rows(r['Kunde sieht Belege'], 8)
    err(r['b nach Annahme'], 'not_found')
    rows(r['payment_hold liest'], 9)
    err(r['payment_hold lädt hoch'], 'receipt_limit') // das Limit (8 erreicht) kommt nach der Statusprüfung: payment_hold passt durch
    err(r['nach 30 Tagen'], 'not_found')
    err(r['Beleg ohne aktive Zuordnung'], 'not_found')
  })
})

describe('Direktzugriff, admin-photo, Aufräumen', () => {
  it('Konten (auch admin, aal2) ohne Zugriff auf job_photos und beide Buckets; admin_photo protokolliert; photo_purge nach Kriterien', () => {
    const R = newId()
    const [PC, PO, PY, PB] = [`${uid()}.jpg`, `${uid()}.jpg`, `${uid()}.jpg`, `${uid()}.jpg`]
    const setup = `${BASE} ${request(R)} ${photo(R)} ${ready(R, PC)} ${receipt(R, 'a', 1, PB)}
      ${obj('job-photos', PC)} ${obj('job-photos', PB)} ${obj('job-photos', PO, '2 hours')} ${obj('job-photos', PY)}
      insert into storage.objects (bucket_id, name) select 'request-photos', storage_path from public.request_photos where request_id = '${R}';`
    const sql = (as: Step['as'], claims: Step['claims'], name: string, s: string): Step => ({ name, as, claims, sql: s })
    const purge = (name: string) => `=(select count(*) from public.photo_purge() where name = '${name}')`
    const steps: Step[] = [
      sql('authenticated', A2(U.pa), 'Partner liest job_photos', 'perform 1 from public.job_photos'),
      sql('authenticated', A2(U.pa), 'Partner liest job-photos', `=(select count(*) from storage.objects where bucket_id = 'job-photos')`),
      sql('authenticated', A2(U.pa), 'Partner liest Originale', `=(select count(*) from storage.objects where bucket_id = 'request-photos')`),
      sql('authenticated', A2(U.pa), 'Partner schreibt', `insert into storage.objects (bucket_id, name) values ('job-photos', '${uid()}.jpg')`),
      sql('authenticated', A2(U.adm), 'admin liest job_photos', 'perform 1 from public.job_photos'),
      sql('authenticated', A2(U.adm), 'admin liest job-photos', `=(select count(*) from storage.objects where bucket_id = 'job-photos')`),
      sql('authenticated', A2(U.adm), 'admin liest Originale', `=(select count(*) from storage.objects where bucket_id = 'request-photos')`),
      sql('service_role', undefined, 'admin_photo', `=(select count(*) from public.admin_photo('${U.adm}', '${R}', 'Begründung für den Test'))`),
      sql(undefined, undefined, 'Audit', `=${count(`public.audit_log where action = 'admin_photo_read' and entity_id = '${R}'`)}`),
      sql('service_role', undefined, 'admin_photo ohne Grund', `perform * from public.admin_photo('${U.adm}', '${R}', 'kurz')`),
      sql('service_role', undefined, 'admin_photo kein admin', `perform * from public.admin_photo('${U.cust}', '${R}', 'Begründung für den Test')`),
      sql('authenticated', A2(U.adm), 'admin_photo als Konto', `perform * from public.admin_photo('${U.adm}', '${R}', 'Begründung für den Test')`),
      sql('service_role', undefined, 'Waise nach 1 h', purge(PO)),
      sql('service_role', undefined, 'junge Waise', purge(PY)),
      sql('service_role', undefined, 'offene Anfrage: Kopie', purge(PC)),
      sql(undefined, undefined, 'zurückziehen', `perform private.set_request_status('${R}', 'withdrawn', '${U.cust}', 'customer')`),
      sql('service_role', undefined, 'zurückgezogen: Kopie', purge(PC)),
      sql('service_role', undefined, 'zurückgezogen: Beleg bleibt', purge(PB)),
      sql('service_role', undefined, 'zurückgezogen: Original', `=(select count(*) from public.photo_purge() where bucket_id = 'request-photos' and name in (select storage_path from public.request_photos where request_id = '${R}'))`),
      sql('authenticated', A2(U.pa), 'purge als Konto', 'perform * from public.photo_purge()'),
    ]
    const r = probes(setup, steps)
    err(r['Partner liest job_photos'], '42501')
    rows(r['Partner liest job-photos'], 0)
    rows(r['Partner liest Originale'], 0)
    err(r['Partner schreibt'], '42501')
    err(r['admin liest job_photos'], '42501')
    rows(r['admin liest job-photos'], 0)
    rows(r['admin liest Originale'], 0)
    rows(r['admin_photo'], 3) // Original, Kopie, Beleg
    rows(r['Audit'], 1)
    err(r['admin_photo ohne Grund'], 'reason_required')
    expect(r['admin_photo kein admin'], String(r['admin_photo kein admin'])).not.toBe('ok')
    err(r['admin_photo als Konto'], '42501')
    rows(r['Waise nach 1 h'], 1)
    rows(r['junge Waise'], 0)
    rows(r['offene Anfrage: Kopie'], 0)
    rows(r['zurückgezogen: Kopie'], 1)
    rows(r['zurückgezogen: Beleg bleibt'], 0)
    rows(r['zurückgezogen: Original'], 1)
    err(r['purge als Konto'], '42501')
  })
})
