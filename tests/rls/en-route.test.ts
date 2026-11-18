// „Unterwegs“ (mail1, Migration 0074): set_en_route, my_jobs.can_en_route/en_route_eta, Sicht des Kunden, Meldung an den Betreiber (report_new).
// Rollback-Proben (`probes`), es bleibt nichts zurück. Termine relativ zur DB-Uhr; der Wiener Tag wird bewusst an der Tagesgrenze geprüft
// (00:30 heute = erlaubt, 23:30 gestern = wrong_day), unabhängig von der Uhrzeit des Laufs.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { probes, type Step } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

const TODAY = "(now() at time zone 'Europe/Vienna')::date"
const VIENNA_MIDNIGHT = "date_trunc('day', now() at time zone 'Europe/Vienna')"
const RT = (() => {
  const r = currentFee()
  return { ...r, split: splitFee(68961, { tiers: r.tiers, vatRate: r.vr }) }
})()
const s = RT.split

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pb: newId() }
const USERS = insertUsers(Object.values(U))
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${USERS} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}`
const TERMS = '"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":6900,"termsHash":"x"}'
const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`

/** Auftrag angenommen von Firma a; `termin` ist ein SQL-Ausdruck. */
function accepted(id: string, termin: string): string {
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline, from_address, to_address, preferred_date, time_window)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day', 'Testgasse 1, 1070 Wien', 'Zielweg 2, 1100 Wien', ${TODAY}, 'morning');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[],${TERMS}}', 1, 68961, 68961, 68961);
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    insert into public.request_contacts (request_id, name, phone, email, stairs_door) values ('${id}', 'Test Kunde', '+43 660 1234567', 'k@movenow.test', 'Tür 1');
    select public.distribute_request('${id}');
    select public.partner_accept('${U.pa}', ${LID(id, 'a')}, ${rev(id)}, ${s.payoutCents}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}

const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const as = (name: string, sub: string, sql: string): Step => ({ name, as: 'authenticated', claims: A2(sub), sql })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const eta = (req: string) => `(select en_route_eta from public.service_requests where id = '${req}')`
const count = (from: string) => `=(select count(*) from ${from})`

describe('set_en_route', () => {
  it('Firma meldet Ankunft in 15/30/45/60 Minuten: Server rechnet die Zeit, einmal pro Auftrag, Wiederholung ohne zweite Wirkung', () => {
    // Eine Firma nimmt höchstens 5 offene Aufträge an (partner_job_limit): R1 Grundfall, R2 anderer Tag (danach gemeldet), R3 Minuten und Aufrufer,
    // RY Termin gestern 23:30 Wien (danach gestartet), RZ Termin heute 00:30 Wien (Start nach Unterwegs).
    const [R1, R2, R3, RY, RZ] = [newId(), newId(), newId(), newId(), newId()]
    const setup = `${BASE}
      ${accepted(R1, 'now()')} ${accepted(R2, "now() + interval '3 days'")} ${accepted(R3, 'now()')}
      ${accepted(RY, `((${VIENNA_MIDNIGHT} - interval '30 minutes') at time zone 'Europe/Vienna')`)}
      ${accepted(RZ, `((${VIENNA_MIDNIGHT} + interval '30 minutes') at time zone 'Europe/Vienna')`)}`
    const steps: Step[] = [
      { name: 'Rechte', sql: `=(select has_function_privilege('authenticated', 'public.set_en_route(uuid,integer)', 'execute')::text || has_function_privilege('anon', 'public.set_en_route(uuid,integer)', 'execute')::text || has_function_privilege('public', 'public.set_en_route(uuid,integer)', 'execute')::text || has_function_privilege('service_role', 'public.set_en_route(uuid,integer)', 'execute')::text)` },
      as('my_jobs vorher', U.pa, `=(select can_en_route::text || ':' || (en_route_eta is not null)::text from public.my_jobs() where request_id = '${R1}')`),
      as('my_jobs anderer Tag', U.pa, `=(select can_en_route::text from public.my_jobs() where request_id = '${R2}')`),
      as('my_jobs gestern', U.pa, `=(select can_en_route::text from public.my_jobs() where request_id = '${RY}')`),
      as('a 30 Minuten', U.pa, `=(select public.set_en_route('${R1}', 30) = now() + interval '30 minutes')`),
      { name: 'Spalte', sql: `=(select ${eta(R1)} = now() + interval '30 minutes')` },
      { name: 'Audit', sql: count(`public.audit_log where action = 'set_en_route' and entity_id = '${R1}' and actor_id = '${U.pa}'`) },
      { name: 'Outbox', sql: `=(select recipient_kind || ':' || (recipient_id = '${U.cust}')::text || ':' || kind from public.outbox where dedupe_key = 'en_route:${R1}')` },
      as('my_jobs nachher', U.pa, `=(select can_en_route::text || ':' || (en_route_eta = now() + interval '30 minutes')::text from public.my_jobs() where request_id = '${R1}')`),
      as('Wiederholung mit 60', U.pa, `=(select public.set_en_route('${R1}', 60) = now() + interval '30 minutes')`),
      { name: 'Audit einmal', sql: count(`public.audit_log where action = 'set_en_route' and entity_id = '${R1}'`) },
      { name: 'Outbox einmal', sql: count(`public.outbox where dedupe_key = 'en_route:${R1}'`) },
      as('Kunde liest die Zeit', U.cust, `=(select en_route_eta = now() + interval '30 minutes' from public.service_requests where id = '${R1}')`),
      as('fremder Kunde sieht nichts', U.cust2, count(`public.service_requests where id = '${R1}'`)),
      as('Kunde ändert die Zeit', U.cust, `update public.service_requests set en_route_eta = now() where id = '${R1}'`),
      as('Firma ändert die Zeit direkt', U.pa, `update public.service_requests set en_route_eta = now() where id = '${R1}'`),
      // Wiener Tagesgrenze: 00:30 heute erlaubt, 23:30 gestern nicht
      as('00:30 heute', U.pa, `=(select public.set_en_route('${RZ}', 15) = now() + interval '15 minutes')`),
      as('23:30 gestern', U.pa, `perform public.set_en_route('${RY}', 15)`),
      as('in drei Tagen', U.pa, `perform public.set_en_route('${R2}', 15)`),
      // Minuten: nur 15, 30, 45, 60; null und 7 ändern nichts
      as('Minuten null', U.pa, `perform public.set_en_route('${R3}', null)`),
      as('Minuten 7', U.pa, `perform public.set_en_route('${R3}', 7)`),
      { name: 'R3 unverändert', sql: `=(select ${eta(R3)} is null)` },
      { name: 'R3 ohne Outbox', sql: count(`public.outbox where dedupe_key = 'en_route:${R3}'`) },
      // Aufrufer (R3 ohne Zeit: der Fehler kommt vor dem Replay)
      as('fremde Firma', U.pb, `perform public.set_en_route('${R3}', 15)`),
      as('Kunde als Aufrufer', U.cust, `perform public.set_en_route('${R3}', 15)`),
      { name: 'aal1', as: 'authenticated', claims: { sub: U.pa, aal: 'aal1' }, sql: `perform public.set_en_route('${R3}', 15)` },
      { name: 'anon', as: 'anon', sql: `perform public.set_en_route('${R3}', 15)` },
      { name: 'service_role', as: 'service_role', sql: `perform public.set_en_route('${R3}', 15)` },
      as('Minuten 60', U.pa, `=(select public.set_en_route('${R3}', 60) = now() + interval '60 minutes')`),
      // Status und Meldung: RY (gestern) wird gestartet, R2 (anderer Tag) vom Kunden gemeldet; beide ohne gespeicherte Zeit
      { name: 'RY gestartet', sql: `perform private.set_request_status('${RY}', 'in_progress', null, 'partner')` },
      as('schon gestartet', U.pa, `perform public.set_en_route('${RY}', 15)`),
      as('my_jobs gestartet', U.pa, `=(select can_en_route::text from public.my_jobs() where request_id = '${RY}')`),
      { name: 'R2 gemeldet', sql: `update public.service_requests set not_done_reported_at = now() where id = '${R2}'` },
      as('Kunde hat gemeldet', U.pa, `perform public.set_en_route('${R2}', 15)`),
      as('my_jobs gemeldet', U.pa, `=(select can_en_route::text from public.my_jobs() where request_id = '${R2}')`),
      // Wiederholung nach dem Start behält die Zeit
      { name: 'RZ gestartet', sql: `perform private.set_request_status('${RZ}', 'in_progress', null, 'partner')` },
      as('Wiederholung nach dem Start', U.pa, `=(select public.set_en_route('${RZ}', 45) = now() + interval '15 minutes')`),
    ]
    const r = probes(setup, steps)
    expect(r['Rechte']).toBe('= truefalsefalsefalse')
    expect(r['my_jobs vorher']).toBe('= true:false')
    expect(r['my_jobs anderer Tag']).toBe('= false')
    expect(r['my_jobs gestern']).toBe('= false')
    expect(r['a 30 Minuten']).toBe('= true')
    expect(r['Spalte']).toBe('= true')
    expect(r['Audit']).toBe('= 1')
    expect(r['Outbox']).toBe('= customer:true:en_route')
    expect(r['my_jobs nachher']).toBe('= false:true')
    expect(r['Wiederholung mit 60']).toBe('= true')
    expect(r['Audit einmal']).toBe('= 1')
    expect(r['Outbox einmal']).toBe('= 1')
    expect(r['Kunde liest die Zeit']).toBe('= true')
    expect(r['fremder Kunde sieht nichts']).toBe('= 0')
    err(r['Kunde ändert die Zeit'], '42501')
    err(r['Firma ändert die Zeit direkt'], '42501')
    expect(r['00:30 heute']).toBe('= true')
    err(r['23:30 gestern'], 'wrong_day')
    err(r['in drei Tagen'], 'wrong_day')
    err(r['Minuten null'], 'invalid_minutes')
    err(r['Minuten 7'], 'invalid_minutes')
    expect(r['R3 unverändert']).toBe('= true')
    expect(r['R3 ohne Outbox']).toBe('= 0')
    err(r['fremde Firma'], 'not_assigned')
    err(r['Kunde als Aufrufer'], 'partner_not_active')
    err(r['aal1'], 'mfa_required')
    err(r['anon'], '42501')
    err(r['service_role'], '42501')
    expect(r['Minuten 60']).toBe('= true')
    err(r['schon gestartet'], 'invalid_transition')
    expect(r['my_jobs gestartet']).toBe('= false')
    err(r['Kunde hat gemeldet'], 'under_review')
    expect(r['my_jobs gemeldet']).toBe('= false')
    expect(r['Wiederholung nach dem Start']).toBe('= true')
  })
})

// Eine Definition, wann eine Zeile fällig ist (Abnahme 0074, N1): outbox_claim holt nur fällige Zeilen, und der Cron ruft die Function nur auf, wenn eine fällig ist
// (sonst leere Aufrufe bis zu 16 Stunden lang, solange eine Zeile im Wiederholungs-Abstand wartet).
describe('Outbox: fällige Zeilen (0075)', () => {
  const row = (key: string, status: string, attempts: number, claimedAgo: string | null) =>
    `insert into public.outbox (kind, recipient_kind, recipient_id, dedupe_key, status, attempts, claimed_at)
       values ('listing_new', 'partner', gen_random_uuid(), 'due:${key}', '${status}', ${attempts}, ${claimedAgo ? `now() - interval '${claimedAgo}'` : 'null'});`
  const due = (key: string) => `=(select private.outbox_is_due(o) from public.outbox o where o.dedupe_key = 'due:${key}')`
  it('neu, nach Ablauf des Abstands 15 Min. × 4^(Versuche − 1) und nach der Lease fällig; im Abstand, in der Lease, fünfte Versuche und erledigte Zeilen nicht', () => {
    const rows = [
      ['neu', 'pending', 0, null], ['alt', 'pending', 3, null], ['w1', 'pending', 1, '14 minutes'], ['f1', 'pending', 1, '16 minutes'], ['w2', 'pending', 2, '59 minutes'], ['f2', 'pending', 2, '61 minutes'],
      ['w4', 'pending', 4, '15 hours'], ['f4', 'pending', 4, '17 hours'], ['l1', 'sending', 1, '9 minutes'], ['l2', 'sending', 1, '11 minutes'], ['v5', 'pending', 5, '99 hours'], ['ok', 'sent', 1, '99 hours'],
    ] as const
    const r = probes(
      `update public.outbox set status = 'sent' where status in ('pending', 'sending'); ${rows.map(([k, s, a, c]) => row(k, s, a, c)).join(' ')}`,
      rows.map(([k]): Step => ({ name: k, sql: due(k) })),
    )
    const soll = { neu: true, alt: true, w1: false, f1: true, w2: false, f2: true, w4: false, f4: true, l1: false, l2: true, v5: false, ok: false }
    expect(Object.fromEntries(rows.map(([k]) => [k, r[k]]))).toEqual(Object.fromEntries(Object.entries(soll).map(([k, v]) => [k, `= ${v}`])))
  })
})

describe('report_not_done: Mail an den Betreiber', () => {
  it('die Meldung legt genau eine Outbox-Zeile für den Betreiber an (ohne Empfänger-ID), eine Wiederholung keine zweite', () => {
    const R = newId()
    const setup = `${BASE} ${accepted(R, "now() - interval '2 hours'")}`
    const r = probes(setup, [
      as('Kunde meldet', U.cust, `perform public.report_not_done('${R}')`),
      { name: 'Zeile', sql: `=(select recipient_kind || ':' || (recipient_id is null)::text || ':' || (request_id = '${R}')::text || ':' || kind from public.outbox where dedupe_key = 'report_new:${R}')` },
      as('zweiter Aufruf', U.cust, `perform public.report_not_done('${R}')`),
      { name: 'weiterhin eine', sql: count(`public.outbox where kind = 'report_new' and request_id = '${R}'`) },
      { name: 'Operator mit Empfänger-ID verboten', sql: `insert into public.outbox (kind, recipient_kind, recipient_id, dedupe_key) values ('report_new', 'operator', gen_random_uuid(), 'x:1')` },
      { name: 'Kunde ohne Empfänger-ID verboten', sql: `insert into public.outbox (kind, recipient_kind, recipient_id, dedupe_key) values ('en_route', 'customer', null, 'x:2')` },
    ])
    expect(r['Kunde meldet']).toBe('ok')
    expect(r['Zeile']).toBe('= operator:true:true:report_new')
    expect(r['zweiter Aufruf']).toBe('ok')
    expect(r['weiterhin eine']).toBe('= 1')
    err(r['Operator mit Empfänger-ID verboten'], '23514')
    err(r['Kunde ohne Empfänger-ID verboten'], '23514')
  })
})
