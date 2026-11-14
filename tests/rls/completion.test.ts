// Abschluss und Export (S9g, Migration 0042): report_not_done, complete_due (Frage und T15), export_commissions, my_commissions.
// Alles läuft als Rollback-Proben (`probes`), es bleibt nichts zurück. Beträge rechnet `splitFee` aus @pricing.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { probes, type Step } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

const RT = (() => {
  const r = currentFee()
  return { ...r, s: splitFee(68961, { tiers: r.tiers, vatRate: r.vr }) }
})()

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pb: newId() }
const USERS = insertUsers(Object.values(U))
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${USERS} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}`

const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const status = (req: string) => `(select status::text from public.service_requests where id = '${req}')`
const count = (sql: string) => `(select count(*) from ${sql})`
const ago = (interval: string) => `now() - interval '${interval}'`

/** Auftrag samt Revision 1, Verteilung und Annahme durch Firma a (Status accepted); Festpreis 68961, Bezirk 17. */
function accepted(id: string, termin: string, by: 'a' | 'b' = 'a'): string {
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[]}', 1, 68961, 68961, 68961);
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');
    select public.partner_accept('${by === 'a' ? U.pa : U.pb}', ${LID(id, by)}, ${rev(id)}, ${RT.s.payoutCents}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}

const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const val = (v: string | undefined, want: string) => expect(v, String(v)).toBe(`= ${want}`)

describe('report_not_done (Kunde meldet „hat nicht stattgefunden“)', () => {
  it('setzt nur den Zeitstempel (einmal), protokolliert; Frist, Eigentum, Status und Rechte verweigern mit Code', () => {
    const [R, RF, RW, RQ, RP, RC] = [newId(), newId(), newId(), newId(), newId(), newId()]
    const setup = `${BASE} ${accepted(RC, ago('2 hours'), 'b')} ${accepted(R, ago('2 hours'))} ${accepted(RF, "now() + interval '14 days'")} ${accepted(RW, ago('8 days'))} ${accepted(RP, ago('2 hours'))}
      insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
        values ('${RQ}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${ago('2 hours')}, now() + interval '1 day');
      insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
        values ('${RQ}', 1, 'submit', '{}', '{"kind":"price","totalCents":100,"lowCents":100,"highCents":100,"lines":[]}', 1, 100, 100, 100);
      update public.service_requests set current_revision = ${rev(RQ)} where id = '${RQ}';
      select private.set_request_status('${RP}', 'in_progress', null, 'partner');
      select private.set_request_status('${RP}', 'completed', null, 'partner');`
    const at = `(select not_done_reported_at::text from public.service_requests where id = '${R}')`
    const steps: Step[] = [
      { name: 'Kunde meldet', as: 'authenticated', claims: A1(U.cust), sql: `perform public.report_not_done('${R}')` },
      { name: 'Zeitstempel gesetzt', sql: `=(select not_done_reported_at is not null from public.service_requests where id = '${R}')` },
      { name: 'Status unverändert', sql: `=${status(R)}` },
      { name: 'Zeitpunkt 1', sql: `=${at}` },
      { name: 'zweiter Aufruf', as: 'authenticated', claims: A1(U.cust), sql: `perform public.report_not_done('${R}')` },
      { name: 'Zeitpunkt 2', sql: `=${at}` },
      { name: 'Audit einmal', sql: `=${count(`public.audit_log where action = 'report_not_done' and entity_id = '${R}' and actor_id = '${U.cust}'`)}` },
      { name: 'Bestätigung nach Meldung', as: 'authenticated', claims: A1(U.cust), sql: `perform public.complete_job('${R}')` },
      { name: 'Kunde bestätigt RC', as: 'authenticated', claims: A1(U.cust), sql: `perform public.complete_job('${RC}')` },
      { name: 'Meldung nach Bestätigung', as: 'authenticated', claims: A1(U.cust), sql: `perform public.report_not_done('${RC}')` },
      { name: 'vor dem Termin', as: 'authenticated', claims: A1(U.cust), sql: `perform public.report_not_done('${RF}')` },
      { name: 'Frist abgelaufen', as: 'authenticated', claims: A1(U.cust), sql: `perform public.report_not_done('${RW}')` },
      { name: 'noch nicht angenommen', as: 'authenticated', claims: A1(U.cust), sql: `perform public.report_not_done('${RQ}')` },
      { name: 'vom Partner abgeschlossen', as: 'authenticated', claims: A1(U.cust), sql: `perform public.report_not_done('${RP}')` },
      { name: 'Status bleibt completed', sql: `=${status(RP)}` },
      { name: 'fremder Kunde', as: 'authenticated', claims: A1(U.cust2), sql: `perform public.report_not_done('${RF}')` },
      { name: 'Partner', as: 'authenticated', claims: A2(U.pa), sql: `perform public.report_not_done('${RF}')` },
      { name: 'anon', as: 'anon', sql: `perform public.report_not_done('${RF}')` },
      { name: 'direktes UPDATE', as: 'authenticated', claims: A1(U.cust), sql: `update public.service_requests set not_done_reported_at = now() where id = '${RF}'` },
      { name: 'Kunde liest', as: 'authenticated', claims: A1(U.cust), sql: `=${count(`public.service_requests where id = '${R}' and not_done_reported_at is not null`)}` },
      { name: 'fremder Kunde liest', as: 'authenticated', claims: A1(U.cust2), sql: `=${count(`public.service_requests where id = '${R}' and not_done_reported_at is not null`)}` },
      { name: 'admin aal2 liest', as: 'authenticated', claims: A2(U.adm), sql: `=${count(`public.service_requests where id = '${R}' and not_done_reported_at is not null`)}` },
      { name: 'admin aal1 liest', as: 'authenticated', claims: A1(U.adm), sql: `=${count(`public.service_requests where id = '${R}' and not_done_reported_at is not null`)}` },
    ]
    const r = probes(setup, steps)
    expect(r['Kunde meldet']).toBe('ok')
    val(r['Zeitstempel gesetzt'], 'true')
    val(r['Status unverändert'], 'accepted')
    expect(r['zweiter Aufruf']).toBe('ok')
    expect(r['Zeitpunkt 2']).toBe(r['Zeitpunkt 1'])
    val(r['Audit einmal'], '1')
    err(r['Bestätigung nach Meldung'], 'invalid_transition')
    expect(r['Kunde bestätigt RC']).toBe('ok')
    err(r['Meldung nach Bestätigung'], 'invalid_transition')
    err(r['vor dem Termin'], 'too_early')
    err(r['Frist abgelaufen'], 'report_window_closed')
    err(r['noch nicht angenommen'], 'invalid_transition')
    expect(r['vom Partner abgeschlossen']).toBe('ok')
    val(r['Status bleibt completed'], 'completed')
    err(r['fremder Kunde'], 'not_found')
    err(r['Partner'], 'not_found')
    err(r['anon'], '42501')
    err(r['direktes UPDATE'], '42501')
    val(r['Kunde liest'], '1')
    val(r['fremder Kunde liest'], '0')
    val(r['admin aal2 liest'], '1')
    val(r['admin aal1 liest'], '0')
  })
})

describe('complete_due (Frage nach dem Termin und T15)', () => {
  it('T15 nur ohne Meldung und nach der Frist; Frage einmal je Auftrag und nur im Fenster; zweiter Lauf ohne Wirkung; nur service_role', () => {
    const [R1, R2, R3, R4, R5, R6] = [newId(), newId(), newId(), newId(), newId(), newId()]
    const setup = `${BASE} ${accepted(R1, ago('8 days'))} ${accepted(R2, ago('8 days'))} ${accepted(R3, ago('6 days'))} ${accepted(R4, "now() + interval '3 days'", 'b')} ${accepted(R5, ago('2 hours'), 'b')} ${accepted(R6, ago('2 hours'), 'b')}
      update public.service_requests set not_done_reported_at = now() - interval '7 days' where id = '${R2}';
      select private.set_request_status('${R3}', 'in_progress', null, 'partner');`
    const ob = (kind: string, req: string) => `=${count(`public.outbox where kind = '${kind}' and request_id = '${req}' and recipient_kind = 'customer' and recipient_id = '${U.cust}'`)}`
    const steps: Step[] = [
      { name: 'Kunde bestätigt R6', as: 'authenticated', claims: A1(U.cust), sql: `perform public.complete_job('${R6}')` },
      { name: 'Lauf 1', as: 'service_role', sql: `perform public.complete_due()` },
      { name: 'R1 completed', sql: `=${status(R1)}` },
      {
        name: 'R1 im Export des aktuellen Monats',
        as: 'service_role',
        sql: `=(select count(*) from public.export_commissions('${U.adm}', (now() at time zone 'Europe/Vienna')::date) where request_id = '${R1}' and kind = 'booking')`,
      },
      { name: 'R2 gemeldet bleibt offen', sql: `=${status(R2)}` },
      { name: 'R3 in_progress bleibt', sql: `=${status(R3)}` },
      { name: 'R4 Zukunft', sql: `=${status(R4)}` },
      { name: 'R5 bleibt', sql: `=${status(R5)}` },
      { name: 'R1 Ereignis system', sql: `=${count(`public.status_events where request_id = '${R1}' and to_status = 'completed' and actor_role = 'system' and actor_id is null`)}` },
      { name: 'R1 Zuordnung beendet', sql: `=(select ended_reason::text from public.assignments where request_id = '${R1}')` },
      { name: 'R2 Zuordnung aktiv', sql: `=(select ended_at is null from public.assignments where request_id = '${R2}')` },
      { name: 'R1 Mail auto', sql: ob('completion_auto', R1) },
      { name: 'R2 keine Mail auto', sql: ob('completion_auto', R2) },
      { name: 'R1 keine Frage (Fenster vorbei)', sql: ob('completion_ask', R1) },
      { name: 'R2 keine Frage (gemeldet)', sql: ob('completion_ask', R2) },
      { name: 'R3 Frage', sql: ob('completion_ask', R3) },
      { name: 'R4 keine Frage (vor Termin)', sql: ob('completion_ask', R4) },
      { name: 'R5 Frage', sql: ob('completion_ask', R5) },
      { name: 'R6 keine Frage (Kunde bestätigte)', sql: ob('completion_ask', R6) },
      { name: 'Lauf 2', as: 'service_role', sql: `perform public.complete_due()` },
      { name: 'R5 Frage weiter einmal', sql: ob('completion_ask', R5) },
      { name: 'R1 Mail auto weiter einmal', sql: ob('completion_auto', R1) },
      { name: 'R1 Ereignis weiter einmal', sql: `=${count(`public.status_events where request_id = '${R1}' and to_status = 'completed'`)}` },
      { name: 'authenticated', as: 'authenticated', claims: A2(U.adm), sql: `perform public.complete_due()` },
      { name: 'anon', as: 'anon', sql: `perform public.complete_due()` },
    ]
    const r = probes(setup, steps)
    expect(r['Kunde bestätigt R6']).toBe('ok')
    expect(r['Lauf 1']).toBe('ok')
    val(r['R1 completed'], 'completed')
    val(r['R1 im Export des aktuellen Monats'], '1')
    val(r['R2 gemeldet bleibt offen'], 'accepted')
    val(r['R3 in_progress bleibt'], 'in_progress')
    val(r['R4 Zukunft'], 'accepted')
    val(r['R5 bleibt'], 'accepted')
    val(r['R1 Ereignis system'], '1')
    val(r['R1 Zuordnung beendet'], 'completed')
    val(r['R2 Zuordnung aktiv'], 'true')
    val(r['R1 Mail auto'], '1')
    val(r['R2 keine Mail auto'], '0')
    val(r['R1 keine Frage (Fenster vorbei)'], '0')
    val(r['R2 keine Frage (gemeldet)'], '0')
    val(r['R3 Frage'], '1')
    val(r['R4 keine Frage (vor Termin)'], '0')
    val(r['R5 Frage'], '1')
    val(r['R6 keine Frage (Kunde bestätigte)'], '0')
    expect(r['Lauf 2']).toBe('ok')
    val(r['R5 Frage weiter einmal'], '1')
    val(r['R1 Mail auto weiter einmal'], '1')
    val(r['R1 Ereignis weiter einmal'], '1')
    err(r['authenticated'], '42501')
    err(r['anon'], '42501')
  })
})

describe('Abrechnungsmonat (export_commissions, my_commissions)', () => {
  it('Monat (Europe/Vienna) aus erstem Endstatus und Buchungszeitpunkt; ohne Endstatus keine Zeile; Export nur admin über service_role; Partner nur eigene Firma mit aal2', () => {
    const [R1, R2] = [newId(), newId()]
    const book = `select private.commission_book(${P('a')}, '${R1}', ${rev(R1)}, 'correction', (select id from public.commission_entries where request_id = '${R1}' and kind = 'booking'),
      -68961, ${RT.vr}, ${-RT.s.feeCents}, ${-RT.s.feeNetCents}, ${-RT.s.feeVatCents}, ${-RT.s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
    // Zeitpunkte per Eigentümer-SQL zurückdatiert (nur in dieser Transaktion, die zurückgerollt wird): Ende 30.09. 23:30 UTC = 01.10. 01:30 in Wien
    const setup = `${BASE} ${accepted(R1, ago('2 hours'))} ${accepted(R2, ago('2 hours'))}
      select private.set_request_status('${R1}', 'completed', null, 'system');
      ${book}
      alter table public.status_events disable trigger append_only;
      alter table public.commission_entries disable trigger append_only;
      update public.status_events set at = '2026-09-30 23:30:00+00' where request_id = '${R1}' and to_status = 'completed';
      update public.commission_entries set created_at = '2026-09-30 22:00:00+00' where request_id = '${R1}' and kind = 'booking';
      update public.commission_entries set created_at = '2026-11-05 10:00:00+00' where request_id = '${R1}' and kind = 'correction';
      alter table public.status_events enable trigger append_only;
      alter table public.commission_entries enable trigger append_only;
      insert into public.status_events (request_id, from_status, to_status, actor_role, at)
        values ('${R1}', 'completed', 'cancelled_by_partner', 'admin', '2026-11-10 10:00:00+00');`
    const exp = (month: string) => `=(select count(*) from public.export_commissions('${U.adm}', '${month}') where request_id in ('${R1}', '${R2}'))`
    const mine = (month: string | null) => `=(select count(*) from public.my_commissions(${month ? `'${month}'` : ''}) where request_id in ('${R1}', '${R2}'))`
    const s = RT.s
    const steps: Step[] = [
      { name: 'Oktober', as: 'service_role', sql: exp('2026-10-01') },
      { name: 'Oktober Monatsmitte', as: 'service_role', sql: exp('2026-10-17') },
      { name: 'September', as: 'service_role', sql: exp('2026-09-01') },
      { name: 'November', as: 'service_role', sql: exp('2026-11-20') },
      { name: 'Dezember', as: 'service_role', sql: exp('2026-12-01') },
      {
        name: 'Zeile Oktober',
        as: 'service_role',
        sql: `=(select kind || '|' || total_cents || '|' || fee_cents || '|' || fee_net_cents || '|' || fee_vat_cents || '|' || payout_cents || '|' || request_status || '|' || vat_rule || '|' || billing_month from public.export_commissions('${U.adm}', '2026-10-01') where request_id = '${R1}')`,
      },
      { name: 'Endzeitpunkt', as: 'service_role', sql: `=(select to_char(ended_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') from public.export_commissions('${U.adm}', '2026-10-01') where request_id = '${R1}')` },
      { name: 'Zeile November', as: 'service_role', sql: `=(select kind || '|' || total_cents || '|' || (reverses_entry_id is not null) from public.export_commissions('${U.adm}', '2026-11-01') where request_id = '${R1}')` },
      {
        name: 'Spalten',
        sql: `=(select string_agg(attname, ',' order by attnum) from pg_attribute where attrelid = 'public.commission_row'::regclass and attnum > 0 and not attisdropped)`,
      },
      { name: 'Audit', sql: `?(select count(*) from public.audit_log where action = 'export_commissions' and actor_id = '${U.adm}') >= 1` },
      { name: 'ohne Monat', as: 'service_role', sql: `perform public.export_commissions('${U.adm}', null)` },
      { name: 'kein admin', as: 'service_role', sql: `perform public.export_commissions('${U.cust}', '2026-10-01')` },
      { name: 'admin aal2 über JWT', as: 'authenticated', claims: A2(U.adm), sql: `perform public.export_commissions('${U.adm}', '2026-10-01')` },
      { name: 'anon Export', as: 'anon', sql: `perform public.export_commissions('${U.adm}', '2026-10-01')` },
      { name: 'Firma a Oktober', as: 'authenticated', claims: A2(U.pa), sql: mine('2026-10-01') },
      { name: 'Firma a November', as: 'authenticated', claims: A2(U.pa), sql: mine('2026-11-01') },
      { name: 'Firma a alle Monate', as: 'authenticated', claims: A2(U.pa), sql: mine(null) },
      { name: 'keine Dubletten bei zwei Endereignissen', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(distinct entry_id) || '/' || count(*) from public.my_commissions(null) where request_id = '${R1}')` },
      { name: 'Firma b fremd', as: 'authenticated', claims: A2(U.pb), sql: mine(null) },
      { name: 'Firma a aal1', as: 'authenticated', claims: A1(U.pa), sql: `perform public.my_commissions(null)` },
      { name: 'Kunde ohne Firma', as: 'authenticated', claims: A2(U.cust), sql: `perform public.my_commissions(null)` },
      { name: 'anon Liste', as: 'anon', sql: `perform public.my_commissions(null)` },
    ]
    const r = probes(setup, steps)
    val(r['Oktober'], '1')
    val(r['Oktober Monatsmitte'], '1')
    val(r['September'], '0')
    val(r['November'], '1')
    val(r['Dezember'], '0')
    val(r['Zeile Oktober'], `booking|68961|${s.feeCents}|${s.feeNetCents}|${s.feeVatCents}|${s.payoutCents}|completed|standard_20|2026-10-01`)
    val(r['Endzeitpunkt'], '2026-09-30 23:30')
    val(r['Zeile November'], 'correction|-68961|true')
    val(r['Spalten'], 'entry_id,request_id,partner_id,partner_name,kind,reverses_entry_id,created_at,total_cents,fee_schedule,fee_net_cents,fee_vat_cents,fee_cents,payout_cents,vat_rule,request_status,ended_at,billing_month')
    expect(r['Audit']).toBe('ok')
    err(r['ohne Monat'], 'month_required')
    err(r['kein admin'], '42501')
    err(r['admin aal2 über JWT'], '42501')
    err(r['anon Export'], '42501')
    val(r['Firma a Oktober'], '1')
    val(r['Firma a November'], '1')
    val(r['Firma a alle Monate'], '2')
    val(r['keine Dubletten bei zwei Endereignissen'], '2/2')
    val(r['Firma b fremd'], '0')
    err(r['Firma a aal1'], 'mfa_required')
    err(r['Kunde ohne Firma'], 'not_found')
    err(r['anon Liste'], '42501')
  })
})
