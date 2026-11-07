// Partnerkern (S9b-1, Migration 0023): Helfer, Statusmaschine, Registrierung, RLS. Jede Sperre: erlaubt UND verweigert, genauer Fehler.
// Alles läuft als Rollback-Probe (Claim-Ebene aal1/aal2, echte TOTP-Token folgen in S9b-3); nur der Wettlauf-Test committet eine Firma und löscht sie wieder.
import { afterAll, describe, expect, it } from 'vitest'
import { anon, DENIED, deleteUsers, makeRequest, makeUser, run as runTag, service } from '../support/db.ts'
import { probes, type Step } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, ownerDeletePartner, P, register, regArgs, setStatus, approve, STATUSES, type PStatus } from '../support/partner.ts'

afterAll(async () => {
  await deleteUsers()
})

const NO_TABLE = (t: string) => `42501: permission denied for table ${t}`
const NO_FN = (f: string) => `42501: permission denied for function ${f}`
const ST = (key: string) => `=(select status::text from public.partners where id = ${P(key)})`
const auth = (sub: string, aal: 'aal1' | 'aal2' = 'aal2') => ({ as: 'authenticated', claims: { sub, aal } }) as const
/** Probe mit Schritten, die als SELECT geschrieben sind (plpgsql braucht PERFORM, kein Semikolon am Ende). */
const run = (setup: string, steps: Step[]) => probes(setup,steps.map((s) => ({ ...s, sql: s.sql.replace(/^select /, 'perform ').replace(/;\s*$/, '') })))

const U = { adm: newId(), cust: newId(), self: newId(), b: newId(), pending: newId(), active: newId(), payment_hold: newId(), suspended: newId(), rejected: newId() }
const world = () =>
  `${insertUsers(Object.values(U))} ${grantAdmin(U.adm)} ${STATUSES.map((s) => firm(U[s], s, s, U.adm)).join(' ')} ${firm(U.b, 'b', 'active', U.adm)}`

describe('Helfer', () => {
  it('Matrix: Firma in jedem Status × aal1/aal2 × Mitglied/Nichtmitglied', () => {
    const rules: Record<string, (s: PStatus, aal: string) => boolean> = {
      partner_of_user: () => true,
      my_member_partner_id: (_s, aal) => aal === 'aal2',
      my_partner_id: (s, aal) => aal === 'aal2' && s === 'active',
      my_job_partner_id: (s, aal) => aal === 'aal2' && (s === 'active' || s === 'payment_hold'),
    }
    // je Status eine Abfrage (die Befehlszeile der CLI ist auf Windows begrenzt)
    for (const s of STATUSES) {
      const steps: Step[] = []
      const want: Record<string, string> = {}
      for (const aal of ['aal1', 'aal2'] as const) {
        for (const [h, fn] of Object.entries(rules)) {
          steps.push({ name: `${h} Mitglied ${aal}`, sql: `=coalesce(private.${h}() = ${P(s)}, false)`, ...auth(U[s], aal) })
          want[`${h} Mitglied ${aal}`] = `= ${fn(s, aal)}`
          steps.push({ name: `${h} Nichtmitglied ${aal}`, sql: `=coalesce(private.${h}() = ${P(s)}, false)`, ...auth(U.cust, aal) })
          want[`${h} Nichtmitglied ${aal}`] = '= false'
        }
      }
      expect(run(`${insertUsers([U.adm, U.cust, U[s]])} ${grantAdmin(U.adm)} ${firm(U[s], s, s, U.adm)}`, steps), s).toEqual(want)
    }
  }, 120_000)
})

describe('register_partner', () => {
  it('erlaubt für Kunden, verweigert sonst, Eingaben geprüft, Rolle bleibt customer', () => {
    const c1 = newId(), c2 = newId(), c3 = newId(), adm = newId()
    const call = (o: Record<string, string> = {}) => `perform public.register_partner(${regArgs(o)})`
    const r = run(`${insertUsers([c1, c2, c3, adm])} ${grantAdmin(adm)}`, [
      { name: 'ohne Anmeldung', sql: call(), as: 'authenticated' },
      { name: 'anon', sql: call(), as: 'anon' },
      { name: 'service_role', sql: call(), as: 'service_role' },
      { name: 'admin-Konto', sql: call(), ...auth(adm, 'aal1') },
      { name: 'Bezirk 0', sql: call({ districts: 'array[0]::smallint[]' }), ...auth(c1, 'aal1') },
      { name: 'Bezirk 24', sql: call({ districts: 'array[24]::smallint[]' }), ...auth(c1, 'aal1') },
      { name: 'keine Bezirke', sql: call({ districts: 'array[]::smallint[]' }), ...auth(c1, 'aal1') },
      { name: 'Bezirk doppelt', sql: call({ districts: 'array[1,1]::smallint[]' }), ...auth(c1, 'aal1') },
      { name: 'UID fehlt ohne Kleinunternehmer', sql: call({ uid: 'null' }), ...auth(c1, 'aal1') },
      { name: 'UID falsches Format', sql: call({ uid: "'ATU123'" }), ...auth(c1, 'aal1') },
      { name: 'PLZ falsch', sql: call({ zip: "'abc'" }), ...auth(c1, 'aal1') },
      { name: 'Nach Fehlversuchen keine Firma', sql: '=(select count(*) from public.partner_members)' },
      { name: 'Gegenfall: Kunde registriert', sql: call(), ...auth(c1, 'aal1') },
      { name: 'zweiter Aufruf', sql: call(), ...auth(c1, 'aal1') },
      { name: 'Gegenfall: Kleinunternehmer ohne UID', sql: call({ uid: 'null', small: 'true' }), ...auth(c2, 'aal2') },
      { name: 'Rolle bleibt customer', sql: `=(select role::text from public.profiles where id = '${c1}')` },
      { name: 'Firma pending, Mitglied owner', sql: `=(select p.status::text || '/' || m.role::text from public.partners p join public.partner_members m on m.partner_id = p.id where m.user_id = '${c1}')` },
      { name: 'Bezirke angelegt', sql: `=(select count(*) from public.partner_regions r join public.partner_members m on m.partner_id = r.partner_id where m.user_id = '${c1}')` },
      { name: 'Audit', sql: `=(select actor_role || '/' || action from public.audit_log where actor_id = '${c1}' and action = 'register_partner')` },
      { name: 'country ≠ AT nur per Eigentümer-Insert, Check greift', sql: `insert into public.partners (name, legal_form, country, small_business, address_street, address_postcode, address_city, contact_name, contact_phone, contact_email, terms_version, terms_accepted_at) values ('Xx', 'gmbh', 'DE', true, 'Str 1', '1010', 'Wien', 'Max', '12345', 'a@b.at', '1', now())` },
    ])
    expect(r['ohne Anmeldung']).toBe('42501: not_authenticated')
    expect(r['anon']).toBe(NO_FN('register_partner'))
    expect(r['service_role']).toBe(NO_FN('register_partner'))
    expect(r['admin-Konto']).toBe('42501: not_customer')
    for (const k of ['Bezirk 0', 'Bezirk 24', 'UID fehlt ohne Kleinunternehmer', 'UID falsches Format', 'PLZ falsch']) expect(r[k], k).toMatch(/^23514:/)
    expect(r['keine Bezirke']).toBe('P0001: scope_incomplete')
    expect(r['Bezirk doppelt']).toMatch(/^23505:/)
    expect(r['Nach Fehlversuchen keine Firma']).toBe('= 0')
    expect(r['Gegenfall: Kunde registriert']).toBe('ok')
    expect(r['zweiter Aufruf']).toBe('P0001: already_member')
    expect(r['Gegenfall: Kleinunternehmer ohne UID']).toBe('ok')
    expect(r['Rolle bleibt customer']).toBe('= customer')
    expect(r['Firma pending, Mitglied owner']).toBe('= pending/owner')
    expect(r['Bezirke angelegt']).toBe('= 2')
    expect(r['Audit']).toBe('= customer/register_partner')
    expect(r['country ≠ AT nur per Eigentümer-Insert, Check greift']).toMatch(/^23514:/)
  })

  it('zwei parallele Aufrufe: genau eine Firma, der zweite already_member; aal1 sieht die eigene Firma, ändert aber nur mit aal2', async () => {
    const u = await makeUser('par')
    const args = { p_name: `mvtest-${runTag} Wettlauf GmbH`, p_legal_form: 'gmbh', p_uid: 'ATU12345678', p_small_business: false, p_street: 'Teststraße 1', p_postcode: '1010', p_city: 'Wien', p_contact_name: 'Max Test', p_contact_phone: '+43 660 1234567', p_contact_email: 'firma@movenow.test', p_districts: [1], p_terms_version: '2026-11' }
    const calls = await Promise.all([u.db.rpc('register_partner' as never, args as never), u.db.rpc('register_partner' as never, args as never)])
    const ok = calls.filter((c) => !c.error)
    const bad = calls.filter((c) => c.error)
    // auch bei rotem Lauf aufräumen: alle Firmen dieses Kontos löschen
    const made = ((await service.from('partner_members' as never).select('partner_id').eq('user_id' as never, u.id as never)).data ?? []) as unknown as { partner_id: string }[]
    const id = ok[0]?.data as unknown as string
    try {
      expect(ok).toHaveLength(1)
      expect(bad).toHaveLength(1)
      expect(bad[0]!.error!.message).toContain('already_member')
      const own = await u.db.from('partners' as never).select('id, status')
      expect(own.data).toEqual([{ id, status: 'pending' }])
      expect(((await u.db.from('partners' as never).update({ name: 'X' } as never).eq('id', id)) as { error: { code: string } }).error.code).toBe(DENIED)
      // aal1: die Policy verlangt aal2, die Zeile bleibt unverändert
      await u.db.from('partners' as never).update({ contact_phone: '+43 1 999' } as never).eq('id', id)
      const row = await service.from('partners' as never).select('contact_phone').eq('id', id).single()
      expect((row.data as unknown as { contact_phone: string }).contact_phone).toBe('+43 660 1234567')
    } finally {
      for (const m of made) ownerDeletePartner(m.partner_id)
    }
  })
})

describe('Statusmaschine', () => {
  it('Funktionen: alle gültigen Paare, Zustand zurückgelesen, genau ein Audit je Aufruf', () => {
    const [x, y] = [newId(), newId()]
    const a = U.adm
    const r = run(`${insertUsers([a, x, y])} ${grantAdmin(a)} ${register(x, 'f1')} ${register(y, 'f2')}`, [
      { name: 'pending → active', sql: approve(a, 'f1').replace(/;$/, '') },
      { name: 'active', sql: ST('f1') },
      { name: 'verified_at gesetzt', sql: `=(select verified_at is not null from public.partners where id = ${P('f1')})` },
      { name: 'Audit Freigabe', sql: `=(select count(*) from public.audit_log where entity = 'partner' and entity_id = ${P('f1')}::text and action = 'approve_partner' and actor_role = 'admin' and actor_id = '${a}')` },
      { name: 'active → payment_hold', sql: setStatus(a, 'f1', 'payment_hold', 'Zahlung ausstehend seit Wochen').replace(/;$/, '') },
      { name: 'payment_hold → active', sql: setStatus(a, 'f1', 'active', 'Zahlung ist eingegangen').replace(/;$/, '') },
      { name: 'active → suspended', sql: setStatus(a, 'f1', 'suspended', 'Verstoß gegen die Bedingungen').replace(/;$/, '') },
      { name: 'suspended → active', sql: setStatus(a, 'f1', 'active', 'Klärung abgeschlossen, wieder frei').replace(/;$/, '') },
      { name: 'active → payment_hold (2)', sql: setStatus(a, 'f1', 'payment_hold', 'Erneut Zahlungsverzug festgestellt').replace(/;$/, '') },
      { name: 'payment_hold → suspended', sql: setStatus(a, 'f1', 'suspended', 'Zahlung blieb dauerhaft aus').replace(/;$/, '') },
      { name: 'Endstatus f1', sql: ST('f1') },
      { name: 'Begründung gespeichert', sql: `=(select status_reason from public.partners where id = ${P('f1')})` },
      { name: 'pending → rejected', sql: setStatus(a, 'f2', 'rejected', 'Unterlagen unvollständig').replace(/;$/, '') },
      { name: 'Endstatus f2', sql: ST('f2') },
      { name: 'Audit Statuswechsel f1 = 6', sql: `=(select count(*) from public.audit_log where entity = 'partner' and entity_id = ${P('f1')}::text and action = 'set_partner_status')` },
    ])
    expect(r['pending → active']).toBe('ok')
    expect(r['active']).toBe('= active')
    expect(r['verified_at gesetzt']).toBe('= true')
    expect(r['Audit Freigabe']).toBe('= 1')
    for (const k of ['active → payment_hold', 'payment_hold → active', 'active → suspended', 'suspended → active', 'active → payment_hold (2)', 'payment_hold → suspended', 'pending → rejected']) expect(r[k], k).toBe('ok')
    expect(r['Endstatus f1']).toBe('= suspended')
    expect(r['Begründung gespeichert']).toBe('= Zahlung blieb dauerhaft aus')
    expect(r['Endstatus f2']).toBe('= rejected')
    expect(r['Audit Statuswechsel f1 = 6']).toBe('= 6')
  })

  it('Funktionen: verbotene Paare, Begründung, Umfang, Akteur, Rechte', () => {
    const m = newId() // Mitglied und zugleich admin: self_approval
    const noScope = newId(), noMember = newId(), noCat = newId()
    const mkSetup = `${world()} ${insertUsers([m, noScope, noMember, noCat])} ${register(m, 'self')} ${grantAdmin(m)}
      ${register(noScope, 'ns')} delete from public.partner_regions where partner_id = ${P('ns')};
      ${register(noMember, 'nm')} delete from public.partner_members where partner_id = ${P('nm')};
      ${register(noCat, 'nc')}`
    const a = U.adm
    const set = (key: string, status: string, reason: string | null = 'Begründung für den Test') =>
      `select public.admin_set_partner_status('${a}', ${P(key)}, '${status}', ${reason === null ? 'null' : `'${reason}'`})`
    const appr = (key: string, services = "array['move']::public.partner_service[]", vat = "'standard_20'", actor = a) =>
      `select public.admin_approve_partner('${actor}', ${P(key)}, ${services}, ${vat}, null)`
    const steps: Step[] = []
    const forbidden: [string, string][] = [
      ['rejected', 'active'], ['rejected', 'pending'], ['rejected', 'payment_hold'], ['rejected', 'suspended'],
      ['active', 'pending'], ['active', 'rejected'], ['active', 'active'], ['suspended', 'payment_hold'], ['suspended', 'pending'], ['suspended', 'rejected'],
      ['pending', 'payment_hold'], ['pending', 'suspended'], ['pending', 'active'], ['payment_hold', 'pending'], ['payment_hold', 'rejected'],
    ]
    for (const [from, to] of forbidden) steps.push({ name: `${from} → ${to}`, sql: set(from, to) })
    steps.push(
      { name: 'zweite Freigabe', sql: appr('active') },
      { name: 'ohne Begründung (null)', sql: set('active', 'suspended', null) },
      { name: 'Begründung zu kurz', sql: set('active', 'suspended', 'kurz') },
      { name: 'rental', sql: appr('pending', "array['rental']::public.partner_service[]") },
      { name: 'leere Kategorien', sql: appr('pending', 'array[]::public.partner_service[]') },
      { name: 'vat none', sql: appr('pending', undefined, "'none'") },
      { name: 'vat reverse_charge', sql: appr('pending', undefined, "'reverse_charge'") },
      { name: 'ohne Bezirk', sql: appr('ns') },
      { name: 'ohne Mitglied', sql: appr('nm') },
      { name: 'self_approval Freigabe', sql: appr('self', undefined, undefined, m) },
      { name: 'self_approval Status', sql: `select public.admin_set_partner_status('${m}', ${P('self')}, 'rejected', 'Selbstablehnung ist verboten')` },
      { name: 'Akteur Kunde', sql: appr('pending', undefined, undefined, U.cust) },
      { name: 'Akteur null', sql: `select public.admin_approve_partner(null, ${P('pending')}, array['move']::public.partner_service[], 'standard_20', null)` },
      { name: 'Akteur Kunde (Status)', sql: `select public.admin_set_partner_status('${U.cust}', ${P('active')}, 'suspended', 'Begründung für den Test')` },
      { name: 'unbekannte Firma', sql: `select public.admin_approve_partner('${a}', gen_random_uuid(), array['move']::public.partner_service[], 'standard_20', null)` },
      { name: 'unbekannte Firma (Status)', sql: `select public.admin_set_partner_status('${a}', gen_random_uuid(), 'suspended', 'Begründung für den Test')` },
      { name: 'authenticated', sql: appr('pending'), ...auth(U.adm) },
      { name: 'authenticated (Status)', sql: set('active', 'suspended'), ...auth(U.adm) },
      { name: 'anon', sql: appr('pending'), as: 'anon' },
      { name: 'anon (Status)', sql: set('active', 'suspended'), as: 'anon' },
      { name: 'Gegenfall: service_role gibt frei', sql: appr('pending'), as: 'service_role' },
      { name: 'Gegenfall: service_role sperrt', sql: set('active', 'suspended'), as: 'service_role' },
      { name: 'nach den Fehlversuchen: active', sql: ST('b') },
      { name: 'Audit: Fehlversuche schreiben nichts (Sperren active)', sql: `=(select count(*) from public.audit_log where action = 'set_partner_status' and entity_id = ${P('active')}::text and detail ->> 'to' = 'suspended')` },
      { name: 'Audit: Fehlversuche schreiben nichts (Freigabe pending)', sql: `=(select count(*) from public.audit_log where action = 'approve_partner' and entity_id = ${P('pending')}::text)` },
    )
    const r = run(mkSetup, steps)
    for (const [from, to] of forbidden) expect(r[`${from} → ${to}`], `${from} → ${to}`).toBe('P0001: invalid_transition')
    expect(r['zweite Freigabe']).toBe('P0001: invalid_transition')
    expect(r['ohne Begründung (null)']).toBe('P0001: reason_required')
    expect(r['Begründung zu kurz']).toBe('P0001: reason_required')
    expect(r['rental']).toBe('P0001: rental_not_enabled')
    expect(r['leere Kategorien']).toBe('P0001: scope_incomplete')
    expect(r['vat none']).toBe('P0001: vat_rule_not_enabled')
    expect(r['vat reverse_charge']).toBe('P0001: vat_rule_not_enabled')
    expect(r['ohne Bezirk']).toBe('P0001: scope_incomplete')
    expect(r['ohne Mitglied']).toBe('P0001: scope_incomplete')
    expect(r['self_approval Freigabe']).toBe('P0001: self_approval')
    expect(r['self_approval Status']).toBe('P0001: self_approval')
    for (const k of ['Akteur Kunde', 'Akteur null', 'Akteur Kunde (Status)']) expect(r[k], k).toBe('42501: not_admin')
    expect(r['unbekannte Firma']).toBe('P0001: not_found')
    expect(r['unbekannte Firma (Status)']).toBe('P0001: not_found')
    expect(r['authenticated']).toBe(NO_FN('admin_approve_partner'))
    expect(r['authenticated (Status)']).toBe(NO_FN('admin_set_partner_status'))
    expect(r['anon']).toBe(NO_FN('admin_approve_partner'))
    expect(r['anon (Status)']).toBe(NO_FN('admin_set_partner_status'))
    expect(r['Gegenfall: service_role gibt frei']).toBe('ok')
    expect(r['Gegenfall: service_role sperrt']).toBe('ok')
    expect(r['nach den Fehlversuchen: active']).toBe('= active')
    expect(r['Audit: Fehlversuche schreiben nichts (Sperren active)']).toBe('= 1')
    expect(r['Audit: Fehlversuche schreiben nichts (Freigabe pending)']).toBe('= 1')
  })

  it('Trigger gilt auch für den Eigentümer: Paar und Marker getrennt, Marker an die Zeile gebunden', () => {
    const set = (marker: string) => `perform set_config('app.mv_partner_status', ${marker}, true);`
    const upd = (key: string, to: string, reason = 'lange genug begründet') =>
      `update public.partners set status = '${to}', status_reason = '${reason}' where id = ${P(key)}`
    const idOf = (key: string) => `${P(key)}::text`
    const r = run(world(), [
      { name: 'gültiges Paar ohne Marker', sql: upd('active', 'suspended') },
      { name: 'Marker einer anderen Firma', sql: `${set(`${idOf('b')} || ':active>suspended'`)} ${upd('active', 'suspended')}` },
      { name: 'Marker mit anderem Ziel', sql: `${set(`${idOf('active')} || ':active>payment_hold'`)} ${upd('active', 'suspended')}` },
      { name: 'Marker ohne Firmen-ID', sql: `${set("':active>suspended'")} ${upd('active', 'suspended')}` },
      { name: 'ungültiges Paar mit Marker', sql: `${set(`${idOf('rejected')} || ':rejected>active'`)} ${upd('rejected', 'active')}` },
      { name: 'Marker ok, aber Begründung fehlt', sql: `${set(`${idOf('active')} || ':active>suspended'`)} update public.partners set status = 'suspended' where id = ${P('active')}` },
      { name: 'Marker ok, Begründung zu kurz', sql: `${set(`${idOf('active')} || ':active>suspended'`)} ${upd('active', 'suspended', 'kurz')}` },
      { name: 'Marker ok, Begründung unverändert', sql: `${set(`${idOf('payment_hold')} || ':payment_hold>active'`)} ${upd('payment_hold', 'active', 'Begründung für den Test')}` },
      { name: 'zwei Firmen, ein Marker', sql: `${set(`${idOf('active')} || ':active>suspended'`)} update public.partners set status = 'suspended', status_reason = 'lange genug begründet' where id in (${P('active')}, ${P('b')})` },
      { name: 'Statuswechsel misslungen: active', sql: ST('active') },
      { name: 'Statuswechsel misslungen: b active', sql: ST('b') },
      { name: 'Gegenfall: Paar, Marker, Begründung', sql: `${set(`${idOf('active')} || ':active>suspended'`)} ${upd('active', 'suspended')}` },
      { name: 'Gegenfall: Zustand', sql: ST('active') },
      { name: 'Begründung ohne Statuswechsel', sql: `update public.partners set status_reason = 'heimlich geändert, aber lang' where id = ${P('b')}` },
      { name: 'verified_at ohne Statuswechsel', sql: `update public.partners set verified_at = now() - interval '1 day' where id = ${P('b')}` },
      { name: 'INSERT mit Status active', sql: `insert into public.partners (name, legal_form, small_business, address_street, address_postcode, address_city, contact_name, contact_phone, contact_email, terms_version, terms_accepted_at, status) values ('Xx', 'gmbh', true, 'Str 1', '1010', 'Wien', 'Max', '12345', 'a@b.at', '1', now(), 'active')` },
      { name: 'INSERT mit verified_at', sql: `insert into public.partners (name, legal_form, small_business, address_street, address_postcode, address_city, contact_name, contact_phone, contact_email, terms_version, terms_accepted_at, verified_at) values ('Xx', 'gmbh', true, 'Str 1', '1010', 'Wien', 'Max', '12345', 'a@b.at', '1', now(), now())` },
      { name: 'DELETE ohne Marker', sql: `delete from public.partners where id = ${P('pending')}` },
      { name: 'DELETE mit Marker einer anderen Firma', sql: `perform set_config('app.mv_partner_delete', ${idOf('b')}, true); delete from public.partners where id = ${P('pending')}` },
      { name: 'TRUNCATE', sql: 'truncate public.partners cascade' },
      { name: 'zweites Mitglied desselben Kontos', sql: `insert into public.partner_members (partner_id, user_id) values (${P('b')}, '${U.active}')` },
      { name: 'USt.-Regel UPDATE', sql: `update public.partner_vat_rules set rule = 'none' where partner_id = ${P('b')}` },
      { name: 'USt.-Regel DELETE ohne Marker', sql: `delete from public.partner_vat_rules where partner_id = ${P('b')}` },
      { name: 'USt.-Regel TRUNCATE', sql: 'truncate public.partner_vat_rules' },
      { name: 'unveränderlich: terms_version', sql: `update public.partners set terms_version = 'neu' where id = ${P('b')}` },
      { name: 'Stammdaten ohne Marker', sql: `update public.partners set name = 'Neuer Name' where id = ${P('b')}` },
      { name: 'Stammdaten mit Marker der Firma', sql: `perform set_config('app.mv_partner_master', ${idOf('b')}, true); update public.partners set name = 'Neuer Name' where id = ${P('b')}` },
      { name: 'Stammdaten mit Marker einer anderen Firma', sql: `perform set_config('app.mv_partner_master', ${idOf('active')}, true); update public.partners set name = 'Noch ein Name' where id = ${P('b')}` },
    ])
    for (const k of ['gültiges Paar ohne Marker', 'Marker einer anderen Firma', 'Marker mit anderem Ziel', 'Marker ohne Firmen-ID', 'ungültiges Paar mit Marker', 'zwei Firmen, ein Marker', 'INSERT mit Status active'])
      expect(r[k], k).toBe('P0001: invalid_transition')
    for (const k of ['Marker ok, aber Begründung fehlt', 'Marker ok, Begründung zu kurz', 'Marker ok, Begründung unverändert']) expect(r[k], k).toBe('P0001: reason_required')
    expect(r['Statuswechsel misslungen: active']).toBe('= active')
    expect(r['Statuswechsel misslungen: b active']).toBe('= active')
    expect(r['Gegenfall: Paar, Marker, Begründung']).toBe('ok')
    expect(r['Gegenfall: Zustand']).toBe('= suspended')
    for (const k of ['Begründung ohne Statuswechsel', 'verified_at ohne Statuswechsel', 'INSERT mit verified_at', 'DELETE ohne Marker', 'DELETE mit Marker einer anderen Firma', 'TRUNCATE', 'unveränderlich: terms_version', 'Stammdaten ohne Marker', 'Stammdaten mit Marker einer anderen Firma'])
      expect(r[k], k).toBe('P0001: field_immutable')
    expect(r['zweites Mitglied desselben Kontos']).toMatch(/^23505:/)
    expect(r['USt.-Regel UPDATE']).toBe('P0001: append_only')
    expect(r['USt.-Regel DELETE ohne Marker']).toBe('P0001: field_immutable')
    expect(r['USt.-Regel TRUNCATE']).toBe('P0001: append_only')
    expect(r['Stammdaten mit Marker der Firma']).toBe('ok')
  })

  it('Löschen: eine freigegebene Testfirma samt USt.-Regel, Kategorien und Bezirken lässt sich nur mit Marker entfernen; danach auch das admin-Konto', () => {
    const x = newId()
    const del = (key: string) =>
      `perform set_config('app.mv_partner_delete', ${P(key)}::text, true); delete from public.partner_vat_rules where partner_id = ${P(key)}; delete from public.partner_regions where partner_id = ${P(key)}; delete from public.partner_categories where partner_id = ${P(key)}; delete from public.partner_members where partner_id = ${P(key)}; delete from public.partners where id = ${P(key)}`
    const r = run(`${insertUsers([U.adm, x])} ${grantAdmin(U.adm)} ${firm(x, 'f', 'active', U.adm)}`, [
      { name: 'Firma da', sql: '=(select count(*) from public.partners where id = ' + P('f') + ')' },
      { name: 'Admin-Konto löschen, solange die Firma besteht', sql: `delete from auth.users where id = '${U.adm}'` },
      { name: 'Firma löschen', sql: del('f') },
      { name: 'Firma weg', sql: '=(select count(*) from public.partners where id = ' + P('f') + ')' },
      { name: 'Reste weg', sql: `=(select count(*) from public.partner_vat_rules where partner_id = ${P('f')}) + (select count(*) from public.partner_categories where partner_id = ${P('f')})` },
    ])
    expect(r['Firma da']).toBe('= 1')
    expect(r['Admin-Konto löschen, solange die Firma besteht']).toBe('ok')
    expect(r['Firma löschen']).toBe('ok')
    expect(r['Firma weg']).toBe('= 0')
    expect(r['Reste weg']).toBe('= 0')
  })

  it('Freigabe verlangt im Trigger Kategorie, Bezirk, Mitglied und USt.-Regel (Eigentümer-Weg)', () => {
    const x = newId()
    const set = (key: string) => `perform set_config('app.mv_partner_status', ${P(key)}::text || ':pending>active', true); update public.partners set status = 'active' where id = ${P(key)}`
    const r = run(`${insertUsers([x])} ${register(x, 'f')}`, [
      { name: 'ohne Kategorie', sql: set('f') },
      { name: 'Kategorie, ohne USt.-Regel', sql: `insert into public.partner_categories (partner_id, service) values (${P('f')}, 'move'); ${set('f')}` },
      { name: 'Gegenfall: mit USt.-Regel', sql: `insert into public.partner_categories (partner_id, service) values (${P('f')}, 'move'); insert into public.partner_vat_rules (partner_id, rule, valid_from) values (${P('f')}, 'standard_20', (now() at time zone 'Europe/Vienna')::date); ${set('f')}` },
      { name: 'Zustand', sql: ST('f') },
    ])
    expect(r['ohne Kategorie']).toBe('P0001: scope_incomplete')
    expect(r['Kategorie, ohne USt.-Regel']).toBe('P0001: vat_rule_missing')
    expect(r['Gegenfall: mit USt.-Regel']).toBe('ok')
    expect(r['Zustand']).toBe('= active')
  })
})

describe('RLS und Rechte', () => {
  const tables = ['partners', 'partner_members', 'partner_categories', 'partner_regions', 'partner_vat_rules']
  // Mindestzahl Zeilen für admin/service_role: sechs Firmen der Welt (zwei Bezirke je Firma, Kategorie und USt.-Regel nur bei den vier freigegebenen)
  const MIN: Record<string, number> = { partners: 6, partner_members: 6, partner_categories: 4, partner_regions: 12, partner_vat_rules: 4 }

  it('Mitglied sieht nur die eigene Firma (aal1 und aal2), Kunde ohne Firma nichts, admin nur mit aal2, anon wird verweigert', () => {
    const steps: Step[] = []
    for (const t of tables) {
      for (const aal of ['aal1', 'aal2'] as const) {
        steps.push({ name: `${t} Mitglied ${aal}`, sql: `=(select count(*) from public.${t})`, ...auth(U.active, aal) })
        steps.push({ name: `${t} fremde Firma ${aal}`, sql: `=(select count(*) from public.${t} where ${t === 'partners' ? 'id' : 'partner_id'} = ${P('b')})`, ...auth(U.active, aal) })
      }
      steps.push({ name: `${t} Kunde`, sql: `=(select count(*) from public.${t})`, ...auth(U.cust, 'aal2') })
      steps.push({ name: `${t} admin aal2`, sql: `=(select count(*) >= ${MIN[t]} from public.${t})`, ...auth(U.adm, 'aal2') })
      steps.push({ name: `${t} admin aal1`, sql: `=(select count(*) from public.${t})`, ...auth(U.adm, 'aal1') })
      steps.push({ name: `${t} anon`, sql: `select count(*) from public.${t}`, as: 'anon' })
      steps.push({ name: `${t} service_role liest`, sql: `=(select count(*) >= ${MIN[t]} from public.${t})`, as: 'service_role' })
    }
    steps.push({ name: 'abgelehnte Firma liest die Begründung', sql: '=(select status_reason from public.partners)', ...auth(U.rejected, 'aal1') })
    const r = run(world(), steps)
    for (const t of tables) {
      for (const aal of ['aal1', 'aal2']) {
        expect(r[`${t} Mitglied ${aal}`], `${t} ${aal}`).toBe(t === 'partner_regions' ? '= 2' : '= 1') // register_partner legt zwei Bezirke an
        expect(r[`${t} fremde Firma ${aal}`], `${t} fremd ${aal}`).toBe('= 0')
      }
      expect(r[`${t} Kunde`]).toBe('= 0')
      expect(r[`${t} admin aal2`]).toBe('= true')
      expect(r[`${t} admin aal1`]).toBe('= 0')
      expect(r[`${t} anon`]).toBe(NO_TABLE(t))
      expect(r[`${t} service_role liest`]).toBe('= true')
    }
    expect(r['abgelehnte Firma liest die Begründung']).toBe('= Begründung für den Test')
  })

  it('Schreibrechte: Mitglied ändert nur Kontaktdaten (aal2, aktiver Status), service_role und authenticated haben kein DML', () => {
    const sets = (col: string, val: string) => `update public.partners set ${col} = ${val} where id = ${P('active')}`
    const steps: Step[] = [
      ...(['name', 'legal_form', 'uid', 'status', 'verified_at', 'payout_model', 'stripe_account_id', 'status_reason'] as const).map((c): Step => ({
        name: `Mitglied ändert ${c}`,
        sql: sets(c, c === 'verified_at' ? 'now()' : c === 'status' ? "'suspended'" : c === 'legal_form' ? "'og'" : c === 'payout_model' ? "'connect'" : "'xxxxxxxxxxxx'"),
        ...auth(U.active),
      })),
      { name: 'Kontakt aal2 aktiv', sql: sets('contact_phone', "'+43 1 111'"), ...auth(U.active) },
      { name: 'Kontakt gelesen', sql: `=(select contact_phone from public.partners where id = ${P('active')})` },
      { name: 'Kontakt aal1', sql: `update public.partners set contact_phone = '+43 1 222' where id = ${P('active')}`, ...auth(U.active, 'aal1') },
      { name: 'Kontakt aal1 gelesen', sql: `=(select contact_phone from public.partners where id = ${P('active')})` },
      { name: 'Kontakt payment_hold', sql: `update public.partners set contact_phone = '+43 1 333' where id = ${P('payment_hold')}`, ...auth(U.payment_hold) },
      { name: 'Kontakt payment_hold gelesen', sql: `=(select contact_phone from public.partners where id = ${P('payment_hold')})` },
      { name: 'Kontakt suspended', sql: `update public.partners set contact_phone = '+43 1 444' where id = ${P('suspended')}`, ...auth(U.suspended) },
      { name: 'Kontakt suspended gelesen', sql: `=(select contact_phone from public.partners where id = ${P('suspended')})` },
      { name: 'Kontakt rejected', sql: `update public.partners set contact_phone = '+43 1 555' where id = ${P('rejected')}`, ...auth(U.rejected) },
      { name: 'Kontakt rejected gelesen', sql: `=(select contact_phone from public.partners where id = ${P('rejected')})` },
      { name: 'Kontakt fremde Firma', sql: `update public.partners set contact_phone = '+43 1 666' where id = ${P('b')}`, ...auth(U.active) },
      { name: 'Kontakt fremde Firma gelesen', sql: `=(select contact_phone from public.partners where id = ${P('b')})` },
      { name: 'Kunde ändert Kontakt', sql: `update public.partners set contact_phone = '+43 1 777' where id = ${P('b')}`, ...auth(U.cust) },
      { name: 'Kunde: fremde Firma gelesen', sql: `=(select contact_phone from public.partners where id = ${P('b')})` },
      { name: 'Kunde insert', sql: `insert into public.partners (name) values ('x')`, ...auth(U.cust) },
      { name: 'Mitglied insert Firma', sql: `insert into public.partners (name) values ('x')`, ...auth(U.active) },
      { name: 'Mitglied delete Firma', sql: `delete from public.partners where id = ${P('active')}`, ...auth(U.active) },
      { name: 'service_role update Firma', sql: sets('name', "'x'"), as: 'service_role' },
      { name: 'service_role insert Firma', sql: `insert into public.partners (name) values ('x')`, as: 'service_role' },
      { name: 'service_role delete Firma', sql: `delete from public.partners where id = ${P('active')}`, as: 'service_role' },
      { name: 'anon update Firma', sql: sets('contact_phone', "'1'"), as: 'anon' },
    ]
    for (const t of tables.slice(1)) {
      steps.push(
        { name: `${t} insert Mitglied`, sql: `insert into public.${t} (partner_id) values (${P('active')})`, ...auth(U.active) },
        { name: `${t} delete Mitglied`, sql: `delete from public.${t} where partner_id = ${P('active')}`, ...auth(U.active) },
        { name: `${t} update Mitglied`, sql: `update public.${t} set partner_id = partner_id where partner_id = ${P('active')}`, ...auth(U.active) },
        { name: `${t} insert service_role`, sql: `insert into public.${t} (partner_id) values (${P('active')})`, as: 'service_role' },
        { name: `${t} delete service_role`, sql: `delete from public.${t} where partner_id = ${P('active')}`, as: 'service_role' },
      )
    }
    const r = run(world(), steps)
    for (const c of ['name', 'legal_form', 'uid', 'status', 'verified_at', 'payout_model', 'stripe_account_id', 'status_reason']) expect(r[`Mitglied ändert ${c}`], c).toBe(NO_TABLE('partners'))
    expect(r['Kontakt aal2 aktiv']).toBe('ok')
    expect(r['Kontakt gelesen']).toBe('= +43 1 111')
    expect(r['Kontakt aal1 gelesen']).toBe('= +43 1 111')
    expect(r['Kontakt payment_hold gelesen']).toBe('= +43 1 333')
    for (const k of ['suspended', 'rejected']) expect(r[`Kontakt ${k} gelesen`], k).toBe('= +43 660 1234567')
    expect(r['Kontakt fremde Firma gelesen']).toBe('= +43 660 1234567')
    // Kunde ohne Firma: Spalten-Grant vorhanden, die Policy filtert alle Zeilen weg (kein Fehler, keine Änderung)
    expect(r['Kunde ändert Kontakt']).toBe('ok')
    expect(r['Kunde: fremde Firma gelesen']).toBe('= +43 660 1234567')
    for (const k of ['Kunde insert', 'Mitglied insert Firma', 'Mitglied delete Firma', 'service_role update Firma', 'service_role insert Firma', 'service_role delete Firma', 'anon update Firma'])
      expect(r[k], k).toBe(NO_TABLE('partners'))
    for (const t of tables.slice(1)) {
      for (const k of ['insert Mitglied', 'delete Mitglied', 'update Mitglied', 'insert service_role', 'delete service_role']) expect(r[`${t} ${k}`], `${t} ${k}`).toBe(NO_TABLE(t))
    }
  })

  it('Rolle bleibt customer, auch nach der Freigabe; echte Clients: anon und Kunde ohne Firma', async () => {
    const r = run(world(), [{ name: 'Rolle nach Freigabe', sql: '=private.my_role()::text', ...auth(U.active) }])
    expect(r['Rolle nach Freigabe']).toBe('= customer')
    const c = await makeUser('part-nofirm')
    expect((await anon.from('partners' as never).select('id')).error?.code).toBe(DENIED)
    const reg = { p_name: 'Xx GmbH', p_legal_form: 'gmbh', p_uid: 'ATU12345678', p_small_business: false, p_street: 'Str 1', p_postcode: '1010', p_city: 'Wien', p_contact_name: 'Max', p_contact_phone: '12345', p_contact_email: 'a@b.at', p_districts: [1], p_terms_version: '1' }
    const appr = { p_actor: newId(), p_partner: newId(), p_services: ['move'], p_vat_rule: 'standard_20', p_note: null }
    const stat = { p_actor: newId(), p_partner: newId(), p_status: 'suspended', p_reason: 'Begründung für den Test' }
    expect((await anon.rpc('register_partner' as never, reg as never)).error?.code).toBe(DENIED)
    expect((await anon.rpc('admin_approve_partner' as never, appr as never)).error?.code).toBe(DENIED)
    expect((await c.db.rpc('admin_approve_partner' as never, appr as never)).error?.code).toBe(DENIED)
    expect((await c.db.rpc('admin_set_partner_status' as never, stat as never)).error?.code).toBe(DENIED)
    expect((await service.rpc('register_partner' as never, reg as never)).error?.code).toBe(DENIED)
    expect(await c.db.from('partners' as never).select('id')).toMatchObject({ data: [], error: null })
    expect((await c.db.from('partner_members' as never).insert({ partner_id: newId(), user_id: c.id } as never)).error?.code).toBe(DENIED)
  })

  it('N-5: aktiver Partner (aal2) liest weder Anfragen noch Fotos noch Dateien im Bucket request-photos', async () => {
    const cu = await makeUser('part-photos')
    const req = await makeRequest(cu.id)
    // der Pfad beginnt mit Kunde und client_ref der Anfrage (Trigger guard_photo_insert)
    const real = run(
      `${world()} select set_config('app.mv_photo_request', '${req}', true);
       insert into public.request_photos (request_id, storage_path) select s.id, s.customer_id || '/' || s.client_ref || '/' || gen_random_uuid() || '.jpg' from public.service_requests s where s.id = '${req}';
       insert into storage.objects (bucket_id, name) select 'request-photos', storage_path from public.request_photos where request_id = '${req}'`,
      [
        { name: 'Kunde: Anfrage', sql: '=(select count(*) from public.service_requests)', ...auth(cu.id, 'aal1') },
        { name: 'Kunde: Foto', sql: '=(select count(*) from public.request_photos)', ...auth(cu.id, 'aal1') },
        { name: 'Kunde: Datei', sql: "=(select count(*) from storage.objects where bucket_id = 'request-photos')", ...auth(cu.id, 'aal1') },
        { name: 'Partner aal2: Anfrage', sql: '=(select count(*) from public.service_requests)', ...auth(U.active) },
        { name: 'Partner aal2: Foto', sql: '=(select count(*) from public.request_photos)', ...auth(U.active) },
        { name: 'Partner aal2: Datei', sql: "=(select count(*) from storage.objects where bucket_id = 'request-photos')", ...auth(U.active) },
        { name: 'Partner payment_hold: Foto', sql: '=(select count(*) from public.request_photos)', ...auth(U.payment_hold) },
      ],
    )
    expect(real['Kunde: Anfrage']).toBe('= 1')
    expect(real['Kunde: Foto']).toBe('= 1')
    expect(real['Kunde: Datei']).toBe('= 1')
    for (const k of ['Partner aal2: Anfrage', 'Partner aal2: Foto', 'Partner aal2: Datei', 'Partner payment_hold: Foto']) expect(real[k], k).toBe('= 0')
  })
})
