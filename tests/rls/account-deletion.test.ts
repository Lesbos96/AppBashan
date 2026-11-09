// Konto löschen mit Anonymisierung (S9h-4, Migration 0052): delete_account, Wächter für neue Anfragen, photo_purge (Konto, Kette, Aufbewahrung).
// Das Konto bleibt als anonyme Zeile (Journal und Ereignisse verweisen darauf); Personendaten verschwinden, Beträge und Export bleiben gleich.
// Alles läuft als Rollback-Proben (`probes`), es bleibt nichts zurück.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { ownerSql, probes, type Step } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, P, regArgs } from '../support/partner.ts'

const TODAY = "(now() at time zone 'Europe/Vienna')::date"
const cur = (key: string, col: string) =>
  `(select ${col} from public.platform_settings where key = '${key}' and effective_from <= ${TODAY} order by effective_from desc, version desc limit 1)`
const RT = (() => {
  const r = ownerSql(`select ${cur('fee_rate', 'value::float8')} as fr, ${cur('fee_vat_rate', 'value::float8')} as vr, ${cur('fee_rate', 'version')} as frv, ${cur('fee_vat_rate', 'version')} as vrv`)[0] as {
    fr: number
    vr: number
    frv: number
    vrv: number
  }
  return { ...r, s: splitFee(68961, { feeRate: r.fr, vatRate: r.vr }) }
})()
const TOTAL = 68961

const U = { adm: newId(), cust: newId(), cust2: newId(), cust3: newId(), pa: newId(), ghost: newId() }
const USERS = insertUsers([U.adm, U.cust, U.cust2, U.cust3, U.pa])
const BASE = `${USERS} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, { districts: 'array[17, 18]::smallint[]' })}`

const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P('a')})`
const count = (sql: string) => `(select count(*) from ${sql})`

/** Angenommener Auftrag des Kunden `cust` (Firma a), Revision, Verteilung, Annahme, Journalzeile `booking`. */
function accepted(id: string, cust: string): string {
  const snap = `{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[]}`
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${cust}', gen_random_uuid(), 'move', 'requested', 17, now() + interval '5 days', now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');
    select public.partner_accept('${U.pa}', ${LID(id)}, ${rev(id)}, ${RT.s.payoutCents}, ${RT.fr}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.frv}, ${RT.vrv});`
}
/** Offene Anfrage ohne Annahme (Status `requested`), danach optional auf `withdrawn`. */
function plain(id: string, cust: string, withdraw = false): string {
  const snap = `{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[]}`
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${cust}', gen_random_uuid(), 'move', 'requested', 17, now() + interval '5 days', now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    ${withdraw ? `select private.set_request_status('${id}', 'withdrawn', null, 'customer');` : ''}`
}
const done = (id: string) => `select private.set_request_status('${id}', 'in_progress', null, 'partner'); select private.set_request_status('${id}', 'completed', null, 'partner');`
const contact = (id: string) =>
  `insert into public.request_contacts (request_id, name, phone, email, stairs_door) values ('${id}', 'Max Meier', '+43 660 111', 'max@meier.test', '2. Stock');`
/** Datei im Bucket und Zeile in request_photos (Trigger der Tabelle ruhen nur für diese Fixture). */
const photo = (req: string, path: string) =>
  `insert into storage.objects (bucket_id, name) select 'request-photos', '${path}' where not exists (select 1 from storage.objects where bucket_id = 'request-photos' and name = '${path}');
   insert into public.request_photos (request_id, storage_path) values ('${req}', '${path}');`
const age = (req: string, days: number) => `update public.status_events set at = now() - interval '${days} days' where request_id = '${req}';`

const R = { c: newId(), w: newId(), o: newId(), b: newId(), x: newId(), r: newId(), r2: newId() }
const { c: RC, w: RW, o: RO, b: RB, x: RX, r: RR, r2: RR2 } = R
const path = (cust: string) => `${cust}/${newId()}/a.jpg`
const PATHS = { rc: path(U.cust), copy: `${newId()}.jpg`, s: path(U.cust2), x: path(U.cust2), rr: path(U.cust3), rr2: path(U.cust3) }
const inPaths = (...p: string[]) => `name in (${p.map((x) => `'${x}'`).join(', ')})`
const purged = (...p: string[]) => `=${count(`public.photo_purge() where ${inPaths(...p)}`)}`

const SETUP = `${BASE}
  update public.profiles set display_name = 'Max Meier', phone = '+43 660 111' where id = '${U.cust}';
  update auth.users set phone = '436601110000', raw_user_meta_data = '{"name":"Max Meier"}' where id = '${U.cust}';
  insert into auth.identities (provider_id, user_id, identity_data, provider) values ('${U.cust}', '${U.cust}', '{"email":"max@meier.test"}', 'email');
  insert into auth.sessions (id, user_id) values (gen_random_uuid(), '${U.cust}');
  update auth.users set email_change = 'neu@meier.test', phone_change = '436601119999', confirmation_token = 'tok1', recovery_token = 'tok2',
    email_change_token_new = 'tok3', email_change_token_current = 'tok4', phone_change_token = 'tok5', reauthentication_token = 'tok6' where id = '${U.cust}';
  insert into auth.audit_log_entries (instance_id, id, payload, created_at)
    values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), '{"actor_id":"${U.cust}","actor_username":"max@meier.test"}', now());
  ${accepted(RC, U.cust)} ${done(RC)} ${plain(RW, U.cust, true)}
  ${accepted(RO, U.cust2)} ${plain(RB, U.cust2, true)} ${plain(RX, U.cust2, true)}
  ${accepted(RR, U.cust3)} ${done(RR)} ${accepted(RR2, U.cust3)} ${done(RR2)}
  update public.service_requests set from_address = 'Teststraße 1, 1010 Wien', to_address = 'Zielweg 2, 1170 Wien',
    from_point = extensions.st_setsrid(extensions.st_makepoint(16.37, 48.21), 4326)::extensions.geography,
    to_point = extensions.st_setsrid(extensions.st_makepoint(16.30, 48.23), 4326)::extensions.geography,
    route = '{"km":5}', description = 'Bitte klingeln bei Meier' where customer_id = '${U.cust}';
  ${contact(RC)} ${contact(RW)} ${contact(RO)}
  alter table public.request_photos disable trigger user;
  ${photo(RC, PATHS.rc)} ${photo(RO, PATHS.s)} ${photo(RB, PATHS.s)} ${photo(RX, PATHS.x)} ${photo(RR, PATHS.rr)} ${photo(RR2, PATHS.rr2)}
  alter table public.request_photos enable trigger user;
  insert into storage.objects (bucket_id, name) values ('job-photos', '${PATHS.copy}');
  insert into public.job_photos (request_id, kind, source_photo_id, storage_path, sha256, status, decided_at)
    values ('${RC}', 'request', (select id from public.request_photos where request_id = '${RC}'), '${PATHS.copy}', repeat('a', 64), 'ready', now());
  alter table public.status_events disable trigger append_only;
  ${age(RR, 91)} ${age(RR2, 89)}
  alter table public.status_events enable trigger append_only;`

const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const val = (v: string | undefined, want: string) => expect(v, String(v)).toBe(`= ${want}`)
const del = (u: string) => `perform public.delete_account('${u}')`
const MONTH = TODAY
const journalMd5 = `(select md5(string_agg(t::text, '|' order by t.entry_id)) from private.commission_rows(null, null) t where t.request_id = '${RC}')`
const eventsMd5 = `(select md5(string_agg(e::text, '|' order by e.id)) from public.status_events e join public.service_requests r on r.id = e.request_id where r.customer_id = '${U.cust}')`
const exportSum = `(select count(*) || '|' || sum(total_cents) || '|' || sum(fee_cents) || '|' || sum(fee_net_cents) || '|' || sum(payout_cents) from public.export_commissions('${U.adm}', ${MONTH}) where request_id = '${RC}')`

describe('delete_account (S9h-4)', () => {
  it('verweigert, löscht, anonymisiert; Journal, Ereignisse und Export bleiben gleich', () => {
    const steps: Step[] = [
      { name: 'Kontakt vorher', as: 'authenticated', claims: A2(U.pa), sql: `=(select name from public.job_contact('${RC}'))` },
      { name: 'Journal merken', sql: `perform set_config('app.pre_journal', ${journalMd5}, true)` },
      { name: 'Ereignisse merken', sql: `perform set_config('app.pre_events', ${eventsMd5}, true)` },
      { name: 'Export merken', as: 'service_role', sql: `perform set_config('app.pre_export', ${exportSum}, true)` },
      { name: 'Export hat Zeilen', sql: `?current_setting('app.pre_export') like '1|%'` },
      { name: 'Purge vorher', as: 'service_role', sql: purged(PATHS.rc, PATHS.copy) },
      // Verweigerungen
      { name: 'anon', as: 'anon', sql: del(U.cust) },
      { name: 'authenticated (eigene ID)', as: 'authenticated', claims: A1(U.cust), sql: del(U.cust) },
      { name: 'admin', as: 'service_role', sql: del(U.adm) },
      { name: 'Partner', as: 'service_role', sql: del(U.pa) },
      { name: 'unbekannt', as: 'service_role', sql: del(U.ghost) },
      { name: 'ohne ID', as: 'service_role', sql: `perform public.delete_account(null)` },
      { name: 'offene Anfrage', as: 'service_role', sql: del(U.cust2) },
      { name: 'cust2 unverändert', sql: `=(select (name = 'Max Meier')::text || (select (deleted_at is null)::text from public.profiles where id = '${U.cust2}') from public.request_contacts where request_id = '${RO}')` },
      { name: 'cust unverändert', sql: `=(select (deleted_at is null)::text from public.profiles where id = '${U.cust}')` },
      // Erfolg
      { name: 'Löschen', as: 'service_role', sql: del(U.cust) },
      { name: 'Wiederholung', as: 'service_role', sql: del(U.cust) },
      { name: 'Profil', sql: `=(select (display_name is null and phone is null and deleted_at is not null)::text from public.profiles where id = '${U.cust}')` },
      { name: 'Auth-Zeile', sql: `=(select (email is null and phone is null and encrypted_password is null and raw_user_meta_data = '{}'::jsonb and deleted_at is not null and banned_until is not null)::text from auth.users where id = '${U.cust}')` },
      {
        name: 'Auth-Änderungen und Token',
        sql: `=(select (email_change = '' and phone_change = '' and confirmation_token = '' and recovery_token = '' and email_change_token_new = '' and email_change_token_current = '' and phone_change_token = '' and reauthentication_token = '')::text from auth.users where id = '${U.cust}')`,
      },
      { name: 'Auth-Audit', sql: `=${count(`auth.audit_log_entries where payload ->> 'actor_id' = '${U.cust}'`)}` },
      { name: 'Profil nach Löschung ändern', as: 'authenticated', claims: A1(U.cust), sql: `update public.profiles set display_name = 'Neu' where id = '${U.cust}'` },
      { name: 'Firma nach Löschung anlegen', as: 'authenticated', claims: A1(U.cust), sql: `perform public.register_partner(${regArgs()})` },
      { name: 'Identitäten', sql: `=${count(`auth.identities where user_id = '${U.cust}'`)}` },
      { name: 'Sitzungen', sql: `=${count(`auth.sessions where user_id = '${U.cust}'`)}` },
      { name: 'Anfragen bleiben', sql: `=${count(`public.service_requests where customer_id = '${U.cust}'`)}` },
      {
        name: 'Anfragen ohne Personendaten',
        sql: `=${count(`public.service_requests where customer_id = '${U.cust}' and (from_address is not null or to_address is not null or from_point is not null or to_point is not null or route is not null or description is not null)`)}`,
      },
      { name: 'Bezirk bleibt', sql: `=(select district from public.service_requests where id = '${RC}')` },
      {
        name: 'Kontakte',
        sql: `=(select string_agg(distinct c.name || '|' || c.phone || '|' || c.email || '|' || coalesce(c.stairs_door, '-'), ',') from public.request_contacts c join public.service_requests r on r.id = c.request_id where r.customer_id = '${U.cust}')`,
      },
      { name: 'Partner liest Kontakt', as: 'authenticated', claims: A2(U.pa), sql: `=(select name || '|' || coalesce(from_address, '-') || '|' || coalesce(to_address, '-') from public.job_contact('${RC}'))` },
      { name: 'admin_contact', as: 'service_role', sql: `=(select name || '|' || phone || '|' || email from public.admin_contact('${U.adm}', '${RC}', 'Begründung für den Test'))` },
      { name: 'Journal gleich', sql: `?${journalMd5} = current_setting('app.pre_journal')` },
      { name: 'Ereignisse gleich', sql: `?${eventsMd5} = current_setting('app.pre_events')` },
      { name: 'Export gleich', as: 'service_role', sql: `?${exportSum} = current_setting('app.pre_export')` },
      { name: 'Audit', sql: `=${count(`public.audit_log where action = 'delete_account' and entity_id = '${U.cust}' and actor_id = '${U.cust}'`)}` },
      {
        name: 'neue Anfrage nach Löschung',
        sql: `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
          values (gen_random_uuid(), '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, now() + interval '5 days', now() + interval '1 day')`,
      },
      { name: 'neue Anfrage anderer Kunde', sql: `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
          values (gen_random_uuid(), '${U.cust3}', gen_random_uuid(), 'move', 'requested', 17, now() + interval '5 days', now() + interval '1 day')` },
      { name: 'Purge nachher', as: 'service_role', sql: purged(PATHS.rc, PATHS.copy) },
    ]
    const r = probes(SETUP, steps)
    val(r['Kontakt vorher'], 'Max Meier')
    expect(r['Journal merken']).toBe('ok')
    expect(r['Ereignisse merken']).toBe('ok')
    expect(r['Export merken']).toBe('ok')
    expect(r['Export hat Zeilen']).toBe('ok')
    val(r['Purge vorher'], '0')
    for (const k of ['anon', 'authenticated (eigene ID)']) err(r[k], '42501')
    err(r['admin'], 'role_not_allowed')
    err(r['Partner'], 'role_not_allowed')
    err(r['unbekannt'], 'not_found')
    err(r['ohne ID'], 'not_found')
    err(r['offene Anfrage'], 'open_requests')
    val(r['cust2 unverändert'], 'truetrue')
    val(r['cust unverändert'], 'true')
    expect(r['Löschen']).toBe('ok')
    expect(r['Wiederholung']).toBe('ok')
    val(r['Profil'], 'true')
    val(r['Auth-Zeile'], 'true')
    val(r['Auth-Änderungen und Token'], 'true')
    val(r['Auth-Audit'], '0')
    err(r['Profil nach Löschung ändern'], 'account_deleted')
    err(r['Firma nach Löschung anlegen'], 'account_deleted')
    val(r['Identitäten'], '0')
    val(r['Sitzungen'], '0')
    val(r['Anfragen bleiben'], '2')
    val(r['Anfragen ohne Personendaten'], '0')
    val(r['Bezirk bleibt'], '17')
    val(r['Kontakte'], 'Gelöschtes Konto|00000|geloescht@deleted.invalid|-')
    val(r['Partner liest Kontakt'], 'Gelöschtes Konto|-|-')
    val(r['admin_contact'], 'Gelöschtes Konto|00000|geloescht@deleted.invalid')
    for (const k of ['Journal gleich', 'Ereignisse gleich', 'Export gleich']) expect(r[k], k).toBe('ok')
    val(r['Audit'], '1')
    err(r['neue Anfrage nach Löschung'], 'account_deleted')
    expect(r['neue Anfrage anderer Kunde']).toBe('ok')
    val(r['Purge nachher'], '2')
  })

  it('Sperre: jeder offene Status verhindert das Löschen, jeder Endstatus nicht', () => {
    const open = ['requested', 'awaiting_offer', 'offered', 'accepted', 'in_progress']
    const final = ['completed', 'withdrawn', 'expired', 'declined', 'unmatched', 'cancelled_by_customer', 'cancelled_by_partner']
    const users = Object.fromEntries([...open, ...final].map((s) => [s, newId()]))
    const setup = `${BASE} ${insertUsers(Object.values(users))}
      alter table public.service_requests disable trigger user;
      ${[...open, ...final]
        .map(
          (s) => `insert into public.service_requests (customer_id, client_ref, service, status, district, termin_at, accept_deadline)
            values ('${users[s]}', gen_random_uuid(), 'move', '${s}', 17, now() + interval '5 days', now() + interval '1 day');`,
        )
        .join('\n')}
      alter table public.service_requests enable trigger user;`
    const steps: Step[] = [...open, ...final].map((s) => ({ name: s, as: 'service_role', sql: del(users[s] as string) }))
    const r = probes(setup, steps)
    for (const s of open) err(r[s], 'open_requests')
    for (const s of final) expect(r[s], s).toBe('ok')
  })
})

describe('photo_purge (S9h-4: Konto, Kette S9h2-1, Aufbewahrung S9d-6)', () => {
  it('Konto, Kette, Aufbewahrung, fehlende Einstellung', () => {
    const steps: Step[] = [
      { name: 'withdrawn allein', as: 'service_role', sql: purged(PATHS.x) },
      { name: 'Kette: Quelle offen, Folgeanfrage zurückgezogen', as: 'service_role', sql: purged(PATHS.s) },
      { name: 'Aufbewahrung 91 Tage', as: 'service_role', sql: purged(PATHS.rr) },
      { name: 'Aufbewahrung 89 Tage', as: 'service_role', sql: purged(PATHS.rr2) },
      { name: 'Konto nicht gelöscht', as: 'service_role', sql: purged(PATHS.rc, PATHS.copy) },
      { name: 'Löschen', as: 'service_role', sql: del(U.cust) },
      { name: 'Konto gelöscht', as: 'service_role', sql: purged(PATHS.rc, PATHS.copy) },
      { name: 'Kette bleibt', as: 'service_role', sql: purged(PATHS.s) },
      { name: 'Quelle endet, Kette löschbar', sql: `perform private.set_request_status('${RO}', 'in_progress', null, 'partner'); perform private.set_request_status('${RO}', 'completed', null, 'partner')` },
      { name: 'Kette nach Ende nicht vor der Frist', as: 'service_role', sql: purged(PATHS.s) },
      { name: 'Quelle gealtert', sql: `alter table public.status_events disable trigger append_only; ${age(RO, 91)} alter table public.status_events enable trigger append_only` },
      { name: 'Kette nach Frist', as: 'service_role', sql: purged(PATHS.s) },
      { name: 'Einstellung entfernen', sql: `delete from public.platform_settings where key = 'photo_retention_days'` },
      { name: 'ohne Einstellung', as: 'service_role', sql: `perform public.photo_purge()` },
    ]
    const r = probes(SETUP, steps)
    val(r['withdrawn allein'], '1')
    val(r['Kette: Quelle offen, Folgeanfrage zurückgezogen'], '0')
    val(r['Aufbewahrung 91 Tage'], '1')
    val(r['Aufbewahrung 89 Tage'], '0')
    val(r['Konto nicht gelöscht'], '0')
    expect(r['Löschen']).toBe('ok')
    val(r['Konto gelöscht'], '2')
    val(r['Kette bleibt'], '0')
    expect(r['Quelle endet, Kette löschbar']).toBe('ok')
    val(r['Kette nach Ende nicht vor der Frist'], '0')
    expect(r['Quelle gealtert']).toBe('ok')
    val(r['Kette nach Frist'], '1')
    expect(r['Einstellung entfernen']).toBe('ok')
    err(r['ohne Einstellung'], 'setting_missing')
  })
})
