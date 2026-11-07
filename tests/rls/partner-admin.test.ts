// Partner-Verwaltung (S9b-2, Migration 0024): Scope, USt.-Regel, Stammdaten, Dokumente samt Storage-Policy.
// Alles läuft als Rollback-Probe (Claim-Ebene aal1/aal2). Jede Sperre: erlaubt UND verweigert, genauer Fehlercode.
import { describe, expect, it } from 'vitest'
import { probes, type Step } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, P, register } from '../support/partner.ts'

const NO_TABLE = (t: string) => `42501: permission denied for table ${t}`
const NO_FN = (f: string) => `42501: permission denied for function ${f}`
const auth = (sub: string, aal: 'aal1' | 'aal2' = 'aal2') => ({ as: 'authenticated', claims: { sub, aal } }) as const
const TODAY = "(now() at time zone 'Europe/Vienna')::date"
/** Probe mit Schritten, die als SELECT geschrieben sind (plpgsql braucht PERFORM, kein Semikolon am Ende). */
const run = (setup: string, steps: Step[]) => probes(setup, steps.map((s) => ({ ...s, sql: s.sql.replace(/^select /, 'perform ').replace(/;\s*$/, '') })))

const U = { adm: newId(), cust: newId(), a: newId(), b: newId(), pend: newId(), sus: newId(), self: newId() }
const world = () =>
  [
    insertUsers(Object.values(U)), grantAdmin(U.adm),
    firm(U.a, 'a', 'active', U.adm), firm(U.b, 'b', 'active', U.adm), register(U.pend, 'pend', { uid: 'null', small: 'true' }),
    firm(U.sus, 'sus', 'suspended', U.adm), register(U.self, 'self'), grantAdmin(U.self),
  ].join(' ')

const adm = `'${U.adm}'`
const scope = (actor: string, partner: string, services: string, districts: string) =>
  `perform public.admin_set_partner_scope(${actor}, ${partner}, ${services}, ${districts}, null)`
const vat = (partner: string, rule: string, from: string) => `perform public.admin_set_vat_rule(${adm}, ${partner}, ${rule}, ${from}, null)`
const master = (partner: string, ...v: string[]) => `perform public.admin_set_partner_master(${adm}, ${partner}, ${v.join(', ')})`
const SV = (s: string) => `array[${s}]::public.partner_service[]`
const DI = (s: string) => `array[${s}]::smallint[]`
const row = (name: string, sql: string, expected: string, over: Partial<Step> = {}) => ({ step: { name, sql, ...over } as Step, expected })
const check = (setup: string, rows: ReturnType<typeof row>[]) => {
  const got = run(setup, rows.map((r) => r.step))
  expect(got).toEqual(Object.fromEntries(rows.map((r) => [r.step.name, r.expected])))
}

describe('Admin-Funktionen: Rechte', () => {
  // Der Aufruf: `doc` steht nur für admin_remove_partner_document, `partner` für die übrigen.
  const calls = (actor: string, partner: string, doc: string): Record<string, string> => ({
    admin_set_partner_scope: scope(actor, partner, SV("'move'"), DI('1')),
    admin_set_vat_rule: `perform public.admin_set_vat_rule(${actor}, ${partner}, 'standard_20', ${TODAY} + 30, null)`,
    admin_set_partner_master: `perform public.admin_set_partner_master(${actor}, ${partner}, 'Neuer Name', null, null, null, null, null, null, null, null)`,
    admin_remove_partner_document: `perform public.admin_remove_partner_document(${actor}, ${doc}, null)`,
  })
  const DOCA = newId()
  const DOCS = newId()
  const ins = (id: string) => `insert into public.partner_documents (id, kind) values ('${id}', 'other')`
  for (const f of Object.keys(calls('x', 'y', 'z'))) {
    it(`${f}: nur service_role mit Admin als p_actor; Kunde, null, unbekannt, eigene Firma abgelehnt`, () => {
      const c = (actor: string, partner: string, doc = 'gen_random_uuid()') => calls(actor, partner, doc)[f] ?? ''
      const rows = [
        row('Dokument Firma a', ins(DOCA), 'ok', auth(U.a)),
        row('Dokument Firma self', ins(DOCS), 'ok', auth(U.self)),
        row('authenticated (Admin-Claims)', c(adm, P('a')), NO_FN(f), auth(U.adm)),
        row('anon', c(adm, P('a')), NO_FN(f), { as: 'anon' }),
        row('Kunde als p_actor', c(`'${U.cust}'`, P('a')), '42501: not_admin', { as: 'service_role' }),
        row('p_actor null', c('null::uuid', P('a')), '42501: not_admin', { as: 'service_role' }),
        row('unbekannt', c(adm, 'gen_random_uuid()'), 'P0001: not_found', { as: 'service_role' }),
        row('Admin der eigenen Firma', c(`'${U.self}'`, P('self'), `'${DOCS}'`), 'P0001: self_approval', { as: 'service_role' }),
        row('Gegenfall Admin', c(adm, P('a'), `'${DOCA}'`), 'ok', { as: 'service_role' }),
      ]
      check(world(), rows)
    }, 120_000)
  }
})

describe('admin_set_partner_scope', () => {
  it('ersetzt Kategorien und Bezirke, lehnt rental und leere Mengen bei active ab', () => {
    const cats = (k: string) => `=(select string_agg(service::text, ',' order by service::text) from public.partner_categories where partner_id = ${P(k)})`
    const regs = (k: string) => `=(select string_agg(district::text, ',' order by district) from public.partner_regions where partner_id = ${P(k)})`
    const svc = { as: 'service_role' } as const
    const r = run(world(), [
      { name: 'rental', sql: scope(adm, P('a'), SV("'move','rental'"), DI('1')), ...svc },
      { name: 'active ohne Kategorie', sql: scope(adm, P('a'), SV(''), DI('1')), ...svc },
      { name: 'active ohne Bezirk', sql: scope(adm, P('a'), SV("'move'"), DI('')), ...svc },
      { name: 'null Kategorien', sql: scope(adm, P('a'), 'null::public.partner_service[]', DI('1')), ...svc },
      { name: 'null Bezirke', sql: scope(adm, P('a'), SV("'move'"), 'null::smallint[]'), ...svc },
      { name: 'Bezirk 24', sql: scope(adm, P('a'), SV("'move'"), DI('24')), ...svc },
      { name: 'Tabelle: rental direkt', sql: `insert into public.partner_categories (partner_id, service) values (${P('pend')}, 'rental')` },
      { name: 'Gegenfall Tabelle: transport direkt', sql: `insert into public.partner_categories (partner_id, service) values (${P('pend')}, 'transport')` },
      { name: 'nach Ablehnungen unverändert', sql: cats('a') + " || '/' || (select string_agg(district::text, ',' order by district) from public.partner_regions where partner_id = " + P('a') + ')', ...svc },
      { name: 'Gegenfall: ersetzen', sql: scope(adm, P('a'), SV("'transport','clearance','transport'"), DI('3,4,3')), ...svc },
      { name: 'neue Kategorien', sql: cats('a') },
      { name: 'neue Bezirke', sql: regs('a') },
      { name: 'alte Kategorie weg', sql: `=(select count(*) from public.partner_categories where partner_id = ${P('a')} and service = 'move')` },
      { name: 'pending: leer erlaubt', sql: scope(adm, P('pend'), SV(''), DI('')), ...svc },
      { name: 'pending: danach leer', sql: `=(select count(*) from public.partner_categories where partner_id = ${P('pend')}) + (select count(*) from public.partner_regions where partner_id = ${P('pend')})` },
      { name: 'Audit a', sql: `=(select count(*) from public.audit_log where action = 'set_partner_scope' and entity_id = ${P('a')}::text and actor_id = ${adm})` },
    ])
    expect(r['rental']).toBe('P0001: rental_not_enabled')
    for (const k of ['active ohne Kategorie', 'active ohne Bezirk', 'null Kategorien', 'null Bezirke']) expect(r[k], k).toBe('P0001: scope_incomplete')
    expect(r['Bezirk 24']).toMatch(/^23514:/)
    expect(r['Tabelle: rental direkt']).toMatch(/^23514:.*partner_categories_no_rental/)
    expect(r['Gegenfall Tabelle: transport direkt']).toBe('ok')
    expect(r['nach Ablehnungen unverändert']).toBe('= move/1,2')
    expect(r['Gegenfall: ersetzen']).toBe('ok')
    expect(r['neue Kategorien']).toBe('= clearance,transport')
    expect(r['neue Bezirke']).toBe('= 3,4')
    expect(r['alte Kategorie weg']).toBe('= 0')
    expect(r['pending: leer erlaubt']).toBe('ok')
    expect(r['pending: danach leer']).toBe('= 0')
    expect(r['Audit a']).toBe('= 1')
  }, 120_000)
})

describe('admin_set_vat_rule', () => {
  it('nur standard_20, nicht rückdatiert, eine Regel je Tag', () => {
    const svc = { as: 'service_role' } as const
    const r = run(world(), [
      { name: 'reverse_charge', sql: vat(P('a'), "'reverse_charge'", `${TODAY} + 1`), ...svc },
      { name: 'none', sql: vat(P('a'), "'none'", `${TODAY} + 1`), ...svc },
      { name: 'gestern', sql: vat(P('a'), "'standard_20'", `${TODAY} - 1`), ...svc },
      { name: 'ohne Datum', sql: vat(P('a'), "'standard_20'", 'null::date'), ...svc },
      { name: 'zweite Regel gleicher Tag', sql: vat(P('a'), "'standard_20'", TODAY), ...svc },
      { name: 'nach Ablehnungen eine Regel', sql: `=(select count(*) from public.partner_vat_rules where partner_id = ${P('a')})` },
      { name: 'Gegenfall: künftiges Datum', sql: vat(P('a'), "'standard_20'", `${TODAY} + 30`), ...svc },
      { name: 'zwei Regeln', sql: `=(select count(*) from public.partner_vat_rules where partner_id = ${P('a')})` },
      { name: 'Gegenfall: heute (Grenze), Firma ohne Regel', sql: vat(P('pend'), "'standard_20'", TODAY), ...svc },
      { name: 'Audit a', sql: `=(select count(*) from public.audit_log where action = 'set_vat_rule' and entity_id = ${P('a')}::text)` },
      { name: 'Tabelle: none direkt', sql: `insert into public.partner_vat_rules (partner_id, rule, valid_from) values (${P('a')}, 'none', ${TODAY} + 9)` },
      { name: 'Gegenfall Tabelle: standard_20 direkt', sql: `insert into public.partner_vat_rules (partner_id, rule, valid_from) values (${P('a')}, 'standard_20', ${TODAY} + 9)` },
      { name: 'direkter Insert service_role', sql: `insert into public.partner_vat_rules (partner_id, rule, valid_from) values (${P('a')}, 'standard_20', ${TODAY} + 5)`, ...svc },
      { name: 'direkter Insert Mitglied', sql: `insert into public.partner_vat_rules (partner_id, rule, valid_from) values (${P('a')}, 'standard_20', ${TODAY} + 5)`, ...auth(U.a) },
      { name: 'Update Eigentümer', sql: `update public.partner_vat_rules set valid_from = valid_from + 1 where partner_id = ${P('a')}` },
    ])
    expect(r['reverse_charge']).toBe('P0001: vat_rule_not_enabled')
    expect(r['none']).toBe('P0001: vat_rule_not_enabled')
    expect(r['gestern']).toBe('P0001: vat_rule_backdated')
    expect(r['ohne Datum']).toBe('P0001: vat_rule_backdated')
    expect(r['zweite Regel gleicher Tag']).toMatch(/^23505:/)
    expect(r['nach Ablehnungen eine Regel']).toBe('= 1')
    expect(r['Gegenfall: künftiges Datum']).toBe('ok')
    expect(r['zwei Regeln']).toBe('= 2')
    expect(r['Gegenfall: heute (Grenze), Firma ohne Regel']).toBe('ok')
    expect(r['Audit a']).toBe('= 1')
    expect(r['Tabelle: none direkt']).toMatch(/^23514:.*partner_vat_rules_phase1/)
    expect(r['Gegenfall Tabelle: standard_20 direkt']).toBe('ok')
    expect(r['direkter Insert service_role']).toBe(NO_TABLE('partner_vat_rules'))
    expect(r['direkter Insert Mitglied']).toBe(NO_TABLE('partner_vat_rules'))
    expect(r['Update Eigentümer']).toBe('P0001: append_only')
  }, 120_000)
})

describe('admin_set_partner_master', () => {
  it('Stammdaten nur über die Funktion, verified_at unverändert, Audit ohne Stripe-Konto', () => {
    const svc = { as: 'service_role' } as const
    const upd = (set: string) => `update public.partners set ${set} where id = ${P('a')}`
    const r = run(world(), [
      { name: 'Partner ändert name', sql: upd("name = 'Hack'"), ...auth(U.a) },
      { name: 'Partner ändert uid', sql: upd("uid = 'ATU11111111'"), ...auth(U.a) },
      { name: 'Partner ändert stripe_account_id', sql: upd("stripe_account_id = 'acct_x'"), ...auth(U.a) },
      { name: 'Partner ändert status', sql: upd("status = 'suspended'"), ...auth(U.a) },
      { name: 'service_role direkt', sql: upd("name = 'Hack'"), ...svc },
      { name: 'Eigentümer ohne Marker', sql: upd("name = 'Hack'") },
      { name: 'Gegenfall: Partner ändert Kontakt', sql: upd("contact_name = 'Neuer Kontakt'"), ...auth(U.a) },
      { name: 'Kontakt gespeichert', sql: `=(select contact_name from public.partners where id = ${P('a')})` },
      { name: 'verified_at merken', sql: `perform set_config('app.v0', (select verified_at::text from public.partners where id = ${P('a')}), true)` },
      { name: 'Gegenfall: Admin ändert alles', sql: master(P('a'), "'Umbenannt GmbH'", "'og'", "'ATU87654321'", 'false', "'Neue Gasse 5'", "'1020'", "'Wien'", "'acct_test123'", "'n'"), ...svc },
      { name: 'Stammdaten gespeichert', sql: `=(select concat_ws('/', name, legal_form, uid, address_street, address_postcode, address_city, stripe_account_id) from public.partners where id = ${P('a')})` },
      { name: 'verified_at unverändert', sql: `=(select (verified_at::text = current_setting('app.v0'))::text from public.partners where id = ${P('a')})` },
      { name: 'alles null: unverändert', sql: master(P('a'), ...Array(8).fill('null'), "'nur Notiz'"), ...svc },
      { name: 'Name danach gleich', sql: `=(select name from public.partners where id = ${P('a')})` },
      { name: 'Marker nach dem Aufruf gelöscht', sql: upd("name = 'Hack'") },
      { name: 'Audit je Aufruf eine Zeile', sql: `=(select count(*) from public.audit_log where action = 'set_partner_master' and entity_id = ${P('a')}::text)` },
      { name: 'Audit ohne Stripe-Konto', sql: `=(select (bool_or(detail::text like '%acct_test123%'))::text from public.audit_log where action = 'set_partner_master' and entity_id = ${P('a')}::text)` },
      { name: 'UID falsches Format', sql: master(P('a'), 'null', 'null', "'ATU1'", ...Array(5).fill('null'), 'null'), ...svc },
      { name: 'Name zu kurz', sql: master(P('a'), "'X'", ...Array(7).fill('null'), 'null'), ...svc },
      { name: 'Kleinunternehmer ohne UID aufheben', sql: master(P('pend'), 'null', 'null', 'null', 'false', ...Array(4).fill('null'), 'null'), ...svc },
    ])
    for (const k of ['Partner ändert name', 'Partner ändert uid', 'Partner ändert stripe_account_id', 'Partner ändert status', 'service_role direkt']) expect(r[k], k).toBe(NO_TABLE('partners'))
    expect(r['Eigentümer ohne Marker']).toBe('P0001: field_immutable')
    expect(r['Gegenfall: Partner ändert Kontakt']).toBe('ok')
    expect(r['Kontakt gespeichert']).toBe('= Neuer Kontakt')
    expect(r['Gegenfall: Admin ändert alles']).toBe('ok')
    expect(r['Stammdaten gespeichert']).toBe('= Umbenannt GmbH/og/ATU87654321/Neue Gasse 5/1020/Wien/acct_test123')
    expect(r['verified_at unverändert']).toBe('= true')
    expect(r['alles null: unverändert']).toBe('ok')
    expect(r['Name danach gleich']).toBe('= Umbenannt GmbH')
    expect(r['Marker nach dem Aufruf gelöscht']).toBe('P0001: field_immutable')
    expect(r['Audit je Aufruf eine Zeile']).toBe('= 2')
    expect(r['Audit ohne Stripe-Konto']).toBe('= false')
    for (const k of ['UID falsches Format', 'Name zu kurz', 'Kleinunternehmer ohne UID aufheben']) expect(r[k], k).toMatch(/^23514:/)
  }, 120_000)
})

describe('Dokumente', () => {
  const D = Array.from({ length: 8 }, () => newId()) as [string, string, string, string, string, string, string, string]
  const ins = (id: string) => `insert into public.partner_documents (id, kind) values ('${id}', 'trade_license')`
  const path = (key: string, id: string) => `${P(key)}::text || '/${id}'`
  const up = (p: string) => `insert into storage.objects (bucket_id, name) values ('partner-documents', ${p})`
  /** Wie die Storage-API: Insert mit RETURNING (verlangt in Postgres auch die Select-Policy der neuen Zeile). */
  const upR = (p: string) => `declare _x uuid; begin insert into storage.objects (bucket_id, name) values ('partner-documents', ${p}) returning id into _x; end`
  const cnt = (where = 'true') => `=(select count(id) from public.partner_documents where ${where})`
  const RLS_OBJ = '42501: new row violates row-level security policy for table "objects"'
  /** Schritte mit leerer Erwartung laufen mit, ihr Ergebnis bleibt offen (die Folgeprüfung zählt); `re:` am Anfang = regulärer Ausdruck. */
  const verify = (setup: string, rows: ReturnType<typeof row>[]) => {
    const got = run(setup, rows.map((r) => r.step))
    for (const r of rows) {
      if (r.expected === '') continue
      if (r.expected.startsWith('re:')) expect(got[r.step.name], r.step.name).toMatch(new RegExp(r.expected.slice(3)))
      else expect(got[r.step.name], r.step.name).toBe(r.expected)
    }
  }

  it('Zeile, Upload, Limit, Lesen, Unveränderlichkeit', () => {
    const own = [D[1], D[2], D[3]]
    const rows = [
      row('Bucket privat, 10 MB, PDF und JPEG', "=(select public::text || '/' || file_size_limit::text || '/' || array_to_string(allowed_mime_types, ',') from storage.buckets where id = 'partner-documents')", '= false/10485760/application/pdf,image/jpeg'),
      row('Gegenfall: eigene Firma legt Zeile an', ins(D[0]), 'ok', auth(U.a)),
      row('partner_id und Pfad vom Server', `=(select (partner_id = ${P('a')} and storage_path = ${P('a')}::text || '/' || id::text)::text from public.partner_documents where id = '${D[0]}')`, '= true'),
      row('Firma b legt Zeile an', ins(D[7]), 'ok', auth(U.b)),
      row('Gegenfall: Upload auf eigenen Pfad', up(path('a', D[0])), 'ok', auth(U.a)),
      row('Datei liegt im Bucket', `=(select count(*) from storage.objects where bucket_id = 'partner-documents' and name = ${path('a', D[0])})`, '= 1'),
      row('Upload ohne eigene Zeile', up(path('a', newId())), RLS_OBJ, auth(U.a)),
      row('Upload in Pfad der Firma b ohne Zeile', up(path('b', newId())), RLS_OBJ, auth(U.a)),
      row('Upload auf die Zeile der Firma b', up(path('b', D[7])), RLS_OBJ, auth(U.a)),
      row('Upload anderer Bucket', `insert into storage.objects (bucket_id, name) values ('request-photos', ${path('a', D[0])})`, RLS_OBJ, auth(U.a)),
      row('Zeile mit aal1', ins(newId()), '42501: not_partner_member', auth(U.a, 'aal1')),
      row('Zeile als Kunde ohne Firma', ins(newId()), '42501: not_partner_member', auth(U.cust)),
      row('Zeile als anon', ins(newId()), NO_TABLE('partner_documents'), { as: 'anon' }),
      row('Zeile als service_role', ins(newId()), NO_TABLE('partner_documents'), { as: 'service_role' }),
      row('Zeile gesperrter Firma', ins(newId()), 'P0001: partner_not_active', auth(U.sus)),
      row('Zeile mit fremder partner_id', `insert into public.partner_documents (id, kind, partner_id) values ('${newId()}', 'other', ${P('b')})`, NO_TABLE('partner_documents'), auth(U.a)),
      ...own.map((id, i) => row(`Gegenfall: Zeile ${i + 2}`, ins(id), 'ok', auth(U.a))),
      row('Mehrzeilen-Insert über der Grenze', `insert into public.partner_documents (id, kind) values ('${D[4]}', 'other'), ('${D[5]}', 'other')`, 'P0001: limit_reached', auth(U.a)),
      row('Zählung bleibt 4', cnt(`partner_id = ${P('a')}`), '= 4'),
      row('Gegenfall: Zeile 5', ins(D[4]), 'ok', auth(U.a)),
      row('Upload mit aal1 auf eigene Zeile', up(path('a', D[1])), RLS_OBJ, auth(U.a, 'aal1')),
      row('Gegenfall: Upload mit aal2 auf dieselbe Zeile (RETURNING)', upR(path('a', D[1])), 'ok', auth(U.a)),
      row('sechste Zeile', ins(D[5]), 'P0001: limit_reached', auth(U.a)),
      row('Gegenfall: Firma b hat eigenes Kontingent', ins(newId()), 'ok', auth(U.b)),
      row('Admin entfernt Zeile', `perform public.admin_remove_partner_document(${adm}, '${D[0]}', 'Test')`, 'ok', { as: 'service_role' }),
      row('Audit entfernen', `=(select count(*) from public.audit_log where action = 'remove_partner_document' and entity_id = ${P('a')}::text and actor_id = ${adm} and detail ->> 'document' = '${D[0]}' and detail ->> 'path' = ${path('a', D[0])})`, '= 1'),
      row('entfernte ID wiederverwendet (Datei liegt noch im Bucket)', ins(D[0]), 'P0001: slot_taken', auth(U.a)),
      row('keine neue Zeile zur entfernten ID', cnt(`id = '${D[0]}'`), '= 0'),
      row('Gegenfall: danach wieder möglich', ins(D[5]), 'ok', auth(U.a)),
      row('Zeile ist weg', cnt(`id = '${D[0]}'`), '= 0'),
      row('Entfernen: unbekanntes Dokument', `perform public.admin_remove_partner_document(${adm}, '${newId()}', null)`, 'P0001: not_found', { as: 'service_role' }),
    ]
    verify(world(), rows)
  }, 180_000)

  it('Firmenstatus, Upsert und Pfadvarianten beim Upload', () => {
    const asMember = (sub: string) => `select set_config('request.jwt.claims', '{"sub":"${sub}","role":"authenticated","aal":"aal2"}', true);`
    const [DP, DR, DB] = [newId(), newId(), newId()]
    const setup = [
      world(), asMember(U.a), `${ins(D[0])}; ${ins(D[2])};`, asMember(U.b), `${ins(D[6])}; ${ins(D[7])}; ${ins(DB)};`,
      asMember(U.pend), `${ins(DP)}; ${ins(DR)};`, `${up(path('a', D[0]))};`,
    ].join(' ')
    const setStatus = (key: string, status: string) => `perform public.admin_set_partner_status(${adm}, ${P(key)}, '${status}', 'Begründung für ${status}')`
    const rows = [
      row('Gegenfall: Firma active lädt hoch', up(path('b', D[7])), 'ok', auth(U.b)),
      row('Gegenfall: Firma pending lädt hoch', up(path('pend', DP)), 'ok', auth(U.pend)),
      row('Upsert auf die eigene Datei', `insert into storage.objects (bucket_id, name) values ('partner-documents', ${path('a', D[0])}) on conflict (bucket_id, name collate "C") where archived_at is null do update set metadata = '{}'::jsonb`, 're:^42501:', auth(U.a)),
      row('Datei nach dem Upsert unverändert', `=(select count(*) from storage.objects where bucket_id = 'partner-documents' and name = ${path('a', D[0])} and metadata is null)`, '= 1'),
      row('Großschreibung', up(`upper(${path('a', D[2])})`), RLS_OBJ, auth(U.a)),
      row('Unterordner', up(`${path('a', D[2])} || '/x'`), RLS_OBJ, auth(U.a)),
      row('Gegenfall: exakter Pfad', up(path('a', D[2])), 'ok', auth(U.a)),
      row('Firma b wird zahlungsgesperrt', setStatus('b', 'payment_hold'), 'ok', { as: 'service_role' }),
      row('Gegenfall: payment_hold lädt hoch', up(path('b', D[6])), 'ok', auth(U.b)),
      row('Firma b wird gesperrt', setStatus('b', 'suspended'), 'ok', { as: 'service_role' }),
      row('gesperrte Firma lädt in vorhandenen Platz', up(path('b', DB)), RLS_OBJ, auth(U.b)),
      row('Firma pend wird abgelehnt', setStatus('pend', 'rejected'), 'ok', { as: 'service_role' }),
      row('abgelehnte Firma lädt in vorhandenen Platz', up(path('pend', DR)), RLS_OBJ, auth(U.pend)),
    ]
    verify(setup, rows)
  }, 180_000)

  it('Lesen, Unveränderlichkeit, Storage-Lesen', () => {
    // Zustand wie nach dem ersten Test (Firma a: fünf Zeilen, Firma b: zwei, Datei zu D[0]); die Befehlszeile der CLI ist auf Windows begrenzt
    const asMember = (sub: string) => `select set_config('request.jwt.claims', '{"sub":"${sub}","role":"authenticated","aal":"aal2"}', true);`
    const setup = [
      world(), asMember(U.a), ...D.slice(0, 5).map((id) => `${ins(id)};`), asMember(U.b), `${ins(D[6])}; ${ins(D[7])};`,
      `${up(path('a', D[0]))};`,
    ].join(' ')
    const rows = [
      row('Partner liest eigene Metadaten (aal1)', cnt(), '= 5', auth(U.a, 'aal1')),
      row('fremde Metadaten', cnt(`partner_id = ${P('a')}`), '= 0', auth(U.b)),
      row('select * verweigert', 'perform * from public.partner_documents', NO_TABLE('partner_documents'), auth(U.a)),
      row('storage_path verweigert', 'perform storage_path from public.partner_documents', NO_TABLE('partner_documents'), auth(U.a)),
      row('Gegenfall: Spaltenliste', 'perform id, partner_id, kind, uploaded_at from public.partner_documents', 'ok', auth(U.a)),
      row('Kunde ohne Firma liest 0 Zeilen', cnt(), '= 0', auth(U.cust)),
      row('anon liest nicht', cnt(), NO_TABLE('partner_documents'), { as: 'anon' }),
      row('admin aal2 liest alle', cnt(), '= 7', auth(U.adm)),
      row('admin aal1 liest 0', cnt(), '= 0', auth(U.adm, 'aal1')),
      row('Partner ändert Zeile', "update public.partner_documents set kind = 'other'", NO_TABLE('partner_documents'), auth(U.a)),
      row('Partner löscht Zeile', 'delete from public.partner_documents', NO_TABLE('partner_documents'), auth(U.a)),
      row('service_role löscht Zeile', 'delete from public.partner_documents', NO_TABLE('partner_documents'), { as: 'service_role' }),
      row('Eigentümer ändert Zeile', "update public.partner_documents set kind = 'other'", 'P0001: append_only'),
      row('Eigentümer löscht ohne Marker', 'delete from public.partner_documents', 'P0001: field_immutable'),
      row('Eigentümer TRUNCATE', 'truncate public.partner_documents', 'P0001: append_only'),
      // Lesen der eigenen Datei ist nötig, weil die Storage-API den Upload mit RETURNING ausführt (Select-Policy der neuen Zeile, 0025)
      row('Partner liest die eigene Datei (aal2)', "=(select count(*) from storage.objects where bucket_id = 'partner-documents')", '= 1', auth(U.a)),
      row('Partner mit aal1 liest keine Datei', "=(select count(*) from storage.objects where bucket_id = 'partner-documents')", '= 0', auth(U.a, 'aal1')),
      row('fremde Firma liest die Datei nicht', "=(select count(*) from storage.objects where bucket_id = 'partner-documents')", '= 0', auth(U.b)),
      row('Kunde ohne Firma liest keine Datei', "=(select count(*) from storage.objects where bucket_id = 'partner-documents')", '= 0', auth(U.cust)),
      row('Gegenfall: admin liest die Datei', "=(select count(*) from storage.objects where bucket_id = 'partner-documents')", '= 1', auth(U.adm)),
      row('admin mit aal1 liest keine Datei', "=(select count(*) from storage.objects where bucket_id = 'partner-documents')", '= 0', auth(U.adm, 'aal1')),
      row('Partner löscht Datei (Ergebnis offen)', "delete from storage.objects where bucket_id = 'partner-documents'", '', auth(U.a)),
      row('Partner benennt Datei um (Ergebnis offen)', "update storage.objects set name = name || 'x' where bucket_id = 'partner-documents'", '', auth(U.a)),
      row('Datei unverändert', `=(select count(*) from storage.objects where bucket_id = 'partner-documents' and name = ${path('a', D[0])})`, '= 1'),
    ]
    verify(setup, rows)
  }, 180_000)
})
