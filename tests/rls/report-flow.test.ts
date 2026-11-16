// s9k-1 (Migration 0064): Meldung „nicht stattgefunden“ als ein Zustandsablauf. Rollback-Proben, es bleibt nichts zurück.
// Z1 Frage, Z2 gemeldet (Prüfung, Status accepted/in_progress), Z3 abgeschlossen mit offenem Meldefenster, Z4 abgeschlossen und gemeldet.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { probes, type Step } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

const RT = (() => {
  const r = currentFee()
  return { ...r, s: splitFee(68961, { tiers: r.tiers, vatRate: r.vr }) }
})()

const U = { adm: newId(), cust: newId(), cust2: newId(), cd1: newId(), cd2: newId(), cd3: newId(), cd4: newId(), pa: newId(), pb: newId(), pc: newId() }
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${insertUsers(Object.values(U))} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)} ${firm(U.pc, 'c', 'active', U.adm, OV)}`

const TERMS = '"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":6900,"termsHash":"x"}'
const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const status = (req: string) => `(select status::text from public.service_requests where id = '${req}')`
const ago = (interval: string) => `now() - interval '${interval}'`
const later = (interval: string) => `now() + interval '${interval}'`
const KEY_USER = { a: U.pa, b: U.pb, c: U.pc } as const
type Key = keyof typeof KEY_USER

/** Auftrag samt Revision 1, Verteilung und Annahme durch die Firma (Status accepted); Festpreis 68961, Bezirk 17. */
function accepted(id: string, termin: string, key: Key, customer = U.cust): string {
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${customer}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[],${TERMS}}', 1, 68961, 68961, 68961);
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');
    select public.partner_accept('${KEY_USER[key]}', ${LID(id, key)}, ${rev(id)}, ${RT.s.payoutCents}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}
const inProgress = (id: string) => `select private.set_request_status('${id}', 'in_progress', null, 'partner');`
const completed = (id: string) => `${inProgress(id)} select private.set_request_status('${id}', 'completed', null, 'partner');`
const reported = (id: string, resolved = false) =>
  `update public.service_requests set not_done_reported_at = now() - interval '1 hour'${resolved ? ', not_done_resolved_at = now()' : ''} where id = '${id}';`

const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const val = (v: string | undefined, want: string) => expect(v, String(v)).toBe(`= ${want}`)
const info = (req: string) => `(select can_report::text || ':' || (report_until is not null)::text from public.my_report_info('${req}'))`

describe('Z2 sperrt die Firma, my_report_info und my_jobs tragen das Signal (S9i3-1, S9i6b-3)', () => {
  it('Firma: kein Start, kein Abschluss, kein Nachtrag bei offener Meldung; Kunde: Signal je Zustand; Firma sieht nur ein Boolean', () => {
    const [Z1, Z0p, Z2a, Z2b, Z0f, Z3, Z3c, Z3w, Z2c, Z0q] = [newId(), newId(), newId(), newId(), newId(), newId(), newId(), newId(), newId(), newId()]
    const setup = `${BASE}
      ${accepted(Z1, ago('2 hours'), 'a')} ${inProgress(Z1)}
      ${accepted(Z0p, ago('2 hours'), 'a')}
      ${accepted(Z2a, ago('2 hours'), 'a')} ${inProgress(Z2a)} ${reported(Z2a)}
      ${accepted(Z2b, ago('2 hours'), 'a')} ${reported(Z2b)}
      ${accepted(Z0f, later('14 days'), 'a')}
      ${accepted(Z3, ago('2 hours'), 'b')} ${completed(Z3)}
      ${accepted(Z3c, ago('2 hours'), 'b')}
      ${accepted(Z3w, ago('8 days'), 'b')} ${completed(Z3w)}
      ${accepted(Z2c, ago('2 hours'), 'c')} ${inProgress(Z2c)}
      ${accepted(Z0q, ago('2 hours'), 'c')}
      insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
        values ('${Z2c}', 'receipt', ${P('c')}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());
      select public.propose_change('${U.pc}', 'aal2', '${Z2c}', (select current_revision from public.service_requests where id = '${Z2c}'), '{"hours":6}'::jsonb, 80000,
        array(select id from public.job_photos where request_id = '${Z2c}' and kind = 'receipt'));
      ${reported(Z2c)}`
    const open = `(select id from public.price_revisions where request_id = '${Z2c}' and source = 'change_order' and status = 'proposed')`
    const steps: Step[] = [
      { name: 'Firma schließt Z2a ab', as: 'authenticated', claims: A2(U.pa), sql: `perform public.complete_job('${Z2a}')` },
      { name: 'Z2a bleibt in_progress', sql: `=${status(Z2a)}` },
      { name: 'Firma startet Z2b', as: 'authenticated', claims: A2(U.pa), sql: `perform public.start_job('${Z2b}')` },
      { name: 'Z2b bleibt accepted', sql: `=${status(Z2b)}` },
      { name: 'Firma startet Z0p (Kontrolle)', as: 'authenticated', claims: A2(U.pa), sql: `perform public.start_job('${Z0p}')` },
      { name: 'Firma schließt Z1 ab (Kontrolle)', as: 'authenticated', claims: A2(U.pa), sql: `perform public.complete_job('${Z1}')` },
      { name: 'Nachtrag in Z2 stellen', as: 'service_role', sql: `perform public.propose_change_basis('${U.pa}', 'aal2', '${Z2a}')` },
      { name: 'Nachtrag in Z2 annehmen', as: 'service_role', sql: `perform public.decide_change('${U.cust}', ${open}, true, 80000, ${RT.vr}, 1, 1, 0, 1, ${RT.fsv}, ${RT.vrv})` },
      { name: 'Nachtrag in Z2 ablehnen', as: 'service_role', sql: `perform public.decide_change('${U.cust}', ${open}, false, null, null, null, null, null, null, null, null)` },
      { name: 'Kunde: Z1 offen', as: 'authenticated', claims: A1(U.cust), sql: `=${info(Z1)}` },
      { name: 'Kunde: Z3 offen', as: 'authenticated', claims: A1(U.cust), sql: `=${info(Z3)}` },
      { name: 'Kunde: vor dem Termin zu', as: 'authenticated', claims: A1(U.cust), sql: `=${info(Z0f)}` },
      { name: 'Kunde: Frist vorbei zu', as: 'authenticated', claims: A1(U.cust), sql: `=${info(Z3w)}` },
      { name: 'Kunde: gemeldet zu', as: 'authenticated', claims: A1(U.cust), sql: `=${info(Z2a)}` },
      { name: 'Kunde bestätigt Z3c', as: 'authenticated', claims: A1(U.cust), sql: `perform public.complete_job('${Z3c}')` },
      { name: 'Kunde: nach Bestätigung zu', as: 'authenticated', claims: A1(U.cust), sql: `=${info(Z3c)}` },
      { name: 'Kunde: Frist erst im Fenster', as: 'authenticated', claims: A1(U.cust), sql: `=(select report_until > now() from public.my_report_info('${Z3}'))` },
      { name: 'Kunde meldet Z3 (nach completed)', as: 'authenticated', claims: A1(U.cust), sql: `perform public.report_not_done('${Z3}')` },
      { name: 'Kunde: Z3 danach zu', as: 'authenticated', claims: A1(U.cust), sql: `=${info(Z3)}` },
      { name: 'fremder Kunde', as: 'authenticated', claims: A1(U.cust2), sql: `perform public.my_report_info('${Z3}')` },
      { name: 'Firma ruft my_report_info', as: 'authenticated', claims: A2(U.pa), sql: `perform public.my_report_info('${Z3}')` },
      { name: 'anon', as: 'anon', sql: `perform public.my_report_info('${Z3}')` },
      { name: 'authenticated ruft report_gate', as: 'authenticated', claims: A1(U.cust), sql: `perform private.report_gate((select s from public.service_requests s where s.id = '${Z3}'))` },
      { name: 'Firma: Z2a in Prüfung', as: 'authenticated', claims: A2(U.pa), sql: `=(select under_review::text from public.my_jobs() where request_id = '${Z2a}')` },
      { name: 'Firma: Z2b in Prüfung, kein Start', as: 'authenticated', claims: A2(U.pa), sql: `=(select under_review::text || ':' || can_start::text from public.my_jobs() where request_id = '${Z2b}')` },
      { name: 'Firma: Z0q keine Prüfung, Start möglich', as: 'authenticated', claims: A2(U.pc), sql: `=(select under_review::text || ':' || can_start::text from public.my_jobs() where request_id = '${Z0q}')` },
      { name: 'Firma: Z3 nach Meldung in Prüfung', as: 'authenticated', claims: A2(U.pb), sql: `=(select under_review::text from public.my_jobs() where request_id = '${Z3}')` },
    ]
    const r = probes(setup, steps)
    err(r['Firma schließt Z2a ab'], 'under_review')
    val(r['Z2a bleibt in_progress'], 'in_progress')
    err(r['Firma startet Z2b'], 'under_review')
    val(r['Z2b bleibt accepted'], 'accepted')
    expect(r['Firma startet Z0p (Kontrolle)']).toBe('ok')
    expect(r['Firma schließt Z1 ab (Kontrolle)']).toBe('ok')
    err(r['Nachtrag in Z2 stellen'], 'under_review')
    err(r['Nachtrag in Z2 annehmen'], 'under_review')
    expect(r['Nachtrag in Z2 ablehnen']).toBe('ok')
    val(r['Kunde: Z1 offen'], 'true:true')
    val(r['Kunde: Z3 offen'], 'true:true')
    val(r['Kunde: vor dem Termin zu'], 'false:false')
    val(r['Kunde: Frist vorbei zu'], 'false:false')
    val(r['Kunde: gemeldet zu'], 'false:false')
    expect(r['Kunde bestätigt Z3c']).toBe('ok')
    val(r['Kunde: nach Bestätigung zu'], 'false:false')
    val(r['Kunde: Frist erst im Fenster'], 'true')
    expect(r['Kunde meldet Z3 (nach completed)']).toBe('ok')
    val(r['Kunde: Z3 danach zu'], 'false:false')
    err(r['fremder Kunde'], 'not_found')
    err(r['Firma ruft my_report_info'], 'not_found')
    err(r['anon'], '42501')
    err(r['authenticated ruft report_gate'], '42501')
    val(r['Firma: Z2a in Prüfung'], 'true')
    val(r['Firma: Z2b in Prüfung, kein Start'], 'true:false')
    val(r['Firma: Z0q keine Prüfung, Start möglich'], 'false:true')
    val(r['Firma: Z3 nach Meldung in Prüfung'], 'true')
  })
})

describe('Konto löschen bei offener Meldung (M1)', () => {
  it('offene Meldung (Z2, Z4) sperrt mit under_review, nach der Entscheidung und ohne Meldung geht das Löschen', () => {
    const [Z2d, Z4, Z4b, Z3d] = [newId(), newId(), newId(), newId()]
    const setup = `${BASE}
      ${accepted(Z2d, ago('2 hours'), 'a', U.cd1)} ${reported(Z2d)}
      ${accepted(Z4, ago('2 hours'), 'b', U.cd2)} ${completed(Z4)} ${reported(Z4)}
      ${accepted(Z4b, ago('2 hours'), 'c', U.cd3)} ${completed(Z4b)} ${reported(Z4b, true)}
      ${accepted(Z3d, ago('2 hours'), 'c', U.cd4)} ${completed(Z3d)}`
    const steps: Step[] = [
      { name: 'Z2 löschen', as: 'service_role', sql: `perform public.delete_account('${U.cd1}')` },
      { name: 'Z4 löschen', as: 'service_role', sql: `perform public.delete_account('${U.cd2}')` },
      { name: 'Z4 entschieden löschen', as: 'service_role', sql: `perform public.delete_account('${U.cd3}')` },
      { name: 'Z3 ohne Meldung löschen', as: 'service_role', sql: `perform public.delete_account('${U.cd4}')` },
      { name: 'Z4 bleibt unangetastet', sql: `=(select deleted_at is null from public.profiles where id = '${U.cd2}')` },
    ]
    const r = probes(setup, steps)
    err(r['Z2 löschen'], 'under_review')
    err(r['Z4 löschen'], 'under_review')
    expect(r['Z4 entschieden löschen']).toBe('ok')
    expect(r['Z3 ohne Meldung löschen']).toBe('ok')
    val(r['Z4 bleibt unangetastet'], 'true')
  })

  // s9k1-1 (b): Melden mit noch gültigem Token nach der Löschung (PostgREST kennt gelöschte Sitzungen nicht) ergäbe eine offene Meldung zu einem gelöschten Konto.
  it('nach dem Löschen: report_not_done wirft not_found, die Meldung wird nicht gesetzt', () => {
    const [Z3e, Z3f] = [newId(), newId()]
    const setup = `${BASE} ${accepted(Z3e, ago('2 hours'), 'a', U.cd1)} ${completed(Z3e)} ${accepted(Z3f, ago('2 hours'), 'b', U.cd2)} ${completed(Z3f)}`
    const steps: Step[] = [
      { name: 'löschen', as: 'service_role', sql: `perform public.delete_account('${U.cd1}')` },
      { name: 'melden nach Löschung', as: 'authenticated', claims: A1(U.cd1), sql: `perform public.report_not_done('${Z3e}')` },
      { name: 'keine Meldung', sql: `=(select not_done_reported_at is null from public.service_requests where id = '${Z3e}')` },
      { name: 'ohne Löschung geht Melden', as: 'authenticated', claims: A1(U.cd2), sql: `perform public.report_not_done('${Z3f}')` },
    ]
    const r = probes(setup, steps)
    expect(r['löschen']).toBe('ok')
    err(r['melden nach Löschung'], 'not_found')
    val(r['keine Meldung'], 'true')
    expect(r['ohne Löschung geht Melden']).toBe('ok')
  })
})
