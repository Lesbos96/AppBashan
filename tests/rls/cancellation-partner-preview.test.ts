// s9i-7b (Migration 0059): Storno durch die Firma, Vorschau. Die Grundlage `cancel_by_partner_basis(…, p_reason)` und `cancel_by_partner` teilen sich die
// Prüfungen; die Pauschale gibt es nur, wenn der LETZTE nicht zurückgezogene Nachtrag abgelehnt oder abgelaufen ist (nach `n`). `my_cancel_info`
// zeigt dem Kunden nur den Betrag der Pauschale. Alles läuft als Rollback-Proben, es bleibt nichts zurück.
import { describe, expect, it } from 'vitest'
import { splitChange, splitFee } from '@pricing'
import { probes, type Step } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

const RT = (() => {
  const r = currentFee()
  return { ...r, s: splitFee(68961, { tiers: r.tiers, vatRate: r.vr }) }
})()
const TOTAL = 68961
const CALL_OUT = 6900
const REASON = 'Prüfung abgeschlossen, Beleg liegt vor'

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pb: newId() }
const USERS = insertUsers(Object.values(U))
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${USERS} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}`
const TERMS = `"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":${CALL_OUT},"termsHash":"x"}`
const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P('a')})`
const status = (req: string) => `(select status::text from public.service_requests where id = '${req}')`
const count = (sql: string) => `(select count(*) from ${sql})`
const journal = (req: string, where = 'true') => count(`public.commission_entries where request_id = '${req}' and ${where}`)
const FIVE = "now() + interval '5 days'"

function accepted(id: string, termin = FIVE): string {
  const snap = `{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[],${TERMS}}`
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');
    select public.partner_accept('${U.pa}', ${LID(id)},${rev(id)}, ${RT.s.payoutCents}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}
const receipt = (req: string) =>
  `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
     values ('${req}', 'receipt', ${P('a')}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());`
const curRev = (req: string) => `(select current_revision from public.service_requests where id = '${req}')`
const propose = (req: string, total: number, hours: number) =>
  `select public.propose_change('${U.pa}', 'aal2', '${req}', ${curRev(req)}, '{"hours":${hours}}'::jsonb, ${total}, array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt'));`
const OPEN = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and source = 'change_order' and status = 'proposed')`
const decide = (req: string, accept: boolean, total: number, prior: number) => {
  const s = splitChange(total, { tiers: RT.tiers, vatRate: RT.vr }, splitFee(prior, { tiers: RT.tiers, vatRate: RT.vr }))
  return `select public.decide_change('${U.cust}', ${OPEN(req)}, ${accept}, ${total}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}
const expireOpen = (req: string) =>
  `perform set_config('app.mv_change', ${OPEN(req)}::text || ':expired', true);
   update public.price_revisions set status = 'expired', decided_at = now() where request_id = '${req}' and status = 'proposed';
   perform set_config('app.mv_change', '', true)`
const declined = (req: string) => `${receipt(req)} ${propose(req, 80000, 6)} ${decide(req, false, 80000, TOTAL)}`

const basisOf = (actor: string, aal: string, req: string, reason: string | null) =>
  `public.cancel_by_partner_basis('${actor}', '${aal}', '${req}', ${reason === null ? 'null' : `'${reason}'`})`
const callOut = (req: string, reason: string | null) => `=(select call_out_cents from ${basisOf(U.pa, 'aal2', req, reason)})`
const RECEIPTS = (req: string) => `array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt')`
function cancelCall(req: string, reason: string, base: number, photos: string | null): string {
  const s = base > 0 ? splitFee(base, { tiers: RT.tiers, vatRate: RT.vr }) : { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
  return `perform public.cancel_by_partner('${U.pa}', 'aal2', '${req}', '${reason}', ${photos ?? 'null'}, ${base}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.fsv}, ${RT.vrv})`
}
const negate = (req: string) =>
  `perform public.admin_correct('${U.adm}', 'aal2', '${req}', 'negate_fee', '${REASON}', null, 0, ${RT.vr}, 0, 0, 0, 0, ${RT.fsv}, ${RT.vrv})`
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const val = (v: string | undefined, want: string) => expect(v, String(v)).toBe(`= ${want}`)
const snapshot = (req: string) =>
  `=${status(req)} || ':' || ${journal(req)} || ':' || ${count(`public.outbox where request_id = '${req}'`)} || ':' || ${count(`public.audit_log where entity_id = '${req}'`)} || ':' || ${count(`public.price_revisions where request_id = '${req}'`)}`

describe('Storno durch die Firma: Vorschau, Pauschale-Berechtigung, my_cancel_info (0059)', () => {
  it('Berechtigung der Pauschale nach dem letzten nicht zurückgezogenen Nachtrag', () => {
    // höchstens 5 offene Aufträge je Firma (partner_open_jobs_max): zwei Ansätze mit je 5
    const [E0, E1, E2, E3, E4, E5, E6, E7, B1, B2] = [newId(), newId(), newId(), newId(), newId(), newId(), newId(), newId(), newId(), newId()] as const
    const setup = `${BASE} ${accepted(E0)} ${accepted(E1)} ${declined(E1)} ${accepted(E2)} ${receipt(E2)} ${propose(E2, 80000, 6)}
      ${accepted(E3)} ${receipt(E3)} ${propose(E3, 80000, 6)} ${decide(E3, true, 80000, TOTAL)}
      ${accepted(E4)} ${declined(E4)} ${propose(E4, 80000, 7)} ${decide(E4, true, 80000, TOTAL)}`
    const setup2 = `${BASE} ${accepted(E5)} ${receipt(E5)} ${propose(E5, 80000, 6)} ${decide(E5, true, 80000, TOTAL)} ${propose(E5, 90000, 8)} ${decide(E5, false, 90000, 80000)}
      ${accepted(E6)} ${declined(E6)} ${propose(E6, 80000, 7)}
      ${accepted(E7)} ${declined(E7)} ${propose(E7, 80000, 7)}
      ${accepted(B1)} ${accepted(B2, "now() - interval '2 hours'")} update public.service_requests set not_done_reported_at = now() where id = '${B1}';`
    const steps2: Step[] = [
      // die Firma sieht Revisionen nicht per RLS: die ID des offenen Nachtrags vorher als Eigentümer ablegen
      { name: 'E7 offene ID', sql: `perform set_config('app.e7', ${OPEN(E7)}::text, true)` },
      { name: 'E7 zurückgezogen', as: 'authenticated', claims: { sub: U.pa, aal: 'aal2' }, sql: `perform public.withdraw_change(current_setting('app.e7')::uuid)` },
      { name: 'E5 angenommen dann abgelehnt', as: 'service_role', sql: callOut(E5, 'scope_impossible') },
      { name: 'E6 abgelehnt dann offen', as: 'service_role', sql: callOut(E6, 'scope_impossible') },
      { name: 'E7 abgelehnt, zurückgezogen', as: 'service_role', sql: callOut(E7, 'scope_impossible') },
      // „angenommen, dann abgelehnt“: die Pauschale ist berechtigt; Gebührenzeile auf der gültigen Revision, Summen über das Journal
      { name: 'E5 echt mit Pauschale', as: 'service_role', sql: cancelCall(E5, 'scope_impossible', CALL_OUT, RECEIPTS(E5)) },
      { name: 'E5 Gebührenzeile', sql: `=(select concat_ws(':', total_cents, revision_id = (select current_revision from public.service_requests where id = '${E5}')) from public.commission_entries where request_id = '${E5}' and kind = 'cancellation_fee')` },
      { name: 'E5 Summe', sql: `=(select sum(total_cents) from public.commission_entries where request_id = '${E5}')` },
      { name: 'E6 echt mit Belegen', as: 'service_role', sql: cancelCall(E6, 'scope_impossible', CALL_OUT, RECEIPTS(E6)) },
      { name: 'E6 unverändert', sql: `=${status(E6)} || ':' || ${journal(E6)}` },
      // Prüfreihenfolge der Grundlage = Storno: Meldung, Grund, Zeitgrenze
      { name: 'B1 gemeldet', as: 'service_role', sql: `perform * from ${basisOf(U.pa, 'aal2', B1, 'scope_impossible')}` },
      { name: 'B2 zu spät', as: 'service_role', sql: `perform * from ${basisOf(U.pa, 'aal2', B2, 'other')}` },
      { name: 'B2 vor Ort', as: 'service_role', sql: `perform * from ${basisOf(U.pa, 'aal2', B2, 'scope_impossible')}` },
      { name: 'Grund fehlt', as: 'service_role', sql: `perform * from ${basisOf(U.pa, 'aal2', E6, null)}` },
      { name: 'Grund unbekannt', as: 'service_role', sql: `perform * from ${basisOf(U.pa, 'aal2', E6, 'bogus')}` },
    ]
    const r2 = probes(setup2, steps2)
    expect(r2['E7 zurückgezogen']).toBe('ok')
    val(r2['E5 angenommen dann abgelehnt'], String(CALL_OUT))
    val(r2['E6 abgelehnt dann offen'], '0')
    val(r2['E7 abgelehnt, zurückgezogen'], String(CALL_OUT))
    expect(r2['E5 echt mit Pauschale']).toBe('ok')
    val(r2['E5 Gebührenzeile'], `${CALL_OUT}:t`)
    val(r2['E5 Summe'], String(CALL_OUT))
    err(r2['E6 echt mit Belegen'], 'call_out_not_allowed')
    val(r2['E6 unverändert'], 'accepted:1')
    err(r2['B1 gemeldet'], 'under_review')
    err(r2['B2 zu spät'], 'too_late_for_reason')
    expect(r2['B2 vor Ort']).toBe('ok')
    err(r2['Grund fehlt'], 'reason_required')
    err(r2['Grund unbekannt'], 'reason_required')

    const steps: Step[] = [
      { name: 'E2 abgelaufen', sql: expireOpen(E2) },
      { name: 'E0 kein Nachtrag', as: 'service_role', sql: callOut(E0, 'scope_impossible') },
      { name: 'E1 abgelehnt', as: 'service_role', sql: callOut(E1, 'scope_impossible') },
      { name: 'E1 anderer Grund', as: 'service_role', sql: callOut(E1, 'unavailable') },
      { name: 'E2 abgelaufen Basis', as: 'service_role', sql: callOut(E2, 'scope_impossible') },
      { name: 'E3 angenommen', as: 'service_role', sql: callOut(E3, 'scope_impossible') },
      { name: 'E4 abgelehnt dann angenommen', as: 'service_role', sql: callOut(E4, 'scope_impossible') },
      // der echte Aufruf folgt derselben Berechtigung (Belege vorhanden, Betrag stimmt)
      { name: 'E4 echt mit Belegen', as: 'service_role', sql: cancelCall(E4, 'scope_impossible', CALL_OUT, RECEIPTS(E4)) },
      { name: 'E1 echt mit anderem Grund', as: 'service_role', sql: cancelCall(E1, 'unavailable', CALL_OUT, RECEIPTS(E1)) },
      { name: 'E4 unverändert', sql: `=${status(E4)} || ':' || ${journal(E4)}` },
      // Rechte und alte Signatur
      { name: 'Basis authenticated', as: 'authenticated', claims: { sub: U.pa, aal: 'aal2' }, sql: `perform * from ${basisOf(U.pa, 'aal2', E1, 'other')}` },
      { name: 'Basis anon', as: 'anon', sql: `perform * from ${basisOf(U.pa, 'aal2', E1, 'other')}` },
      { name: 'Basis aal1', as: 'service_role', sql: `perform * from ${basisOf(U.pa, 'aal1', E1, 'other')}` },
      { name: 'Basis fremde Firma', as: 'service_role', sql: `perform * from ${basisOf(U.pb, 'aal2', E1, 'other')}` },
      { name: 'Basis Kunde', as: 'service_role', sql: `perform * from ${basisOf(U.cust, 'aal2', E1, 'other')}` },
      { name: 'alte Grundlage entfernt', as: 'service_role', sql: `perform * from public.cancel_by_partner_basis('${U.pa}', 'aal2', '${E1}')` },
      { name: 'private Prüffunktionen', as: 'service_role', sql: `perform private.call_out_eligible('${E1}', 'scope_impossible')` },
      // NULL-Sicherheit (Planfund M2): Grund NULL ist nie berechtigt
      { name: 'eligible mit NULL', sql: `=private.call_out_eligible('${E1}', null)` },
      { name: 'Pauschale mit NULL-Grund', sql: `perform private.partner_cancel_fee(${P('a')}, '${E1}', null, ${RECEIPTS(E1)})` },
      // Firma in payment_hold darf wie bisher (geteiltes Tor)
      { name: 'Firma payment_hold', sql: `perform public.admin_set_partner_status('${U.adm}', ${P('a')}, 'payment_hold', 'Zahlungsverzug für den Test')` },
      { name: 'Basis payment_hold', as: 'service_role', sql: callOut(E1, 'scope_impossible') },
    ]
    const r = probes(setup, steps)
    expect(r['E2 abgelaufen']).toBe('ok')
    val(r['E0 kein Nachtrag'], '0')
    val(r['E1 abgelehnt'], String(CALL_OUT))
    val(r['E1 anderer Grund'], '0')
    val(r['E2 abgelaufen Basis'], String(CALL_OUT))
    val(r['E3 angenommen'], '0')
    val(r['E4 abgelehnt dann angenommen'], '0')
    err(r['E4 echt mit Belegen'], 'call_out_not_allowed')
    err(r['E1 echt mit anderem Grund'], 'call_out_not_allowed')
    val(r['E4 unverändert'], 'accepted:2')
    err(r['Basis authenticated'], '42501')
    err(r['Basis anon'], '42501')
    err(r['Basis aal1'], 'mfa_required')
    err(r['Basis fremde Firma'], 'not_found')
    err(r['Basis Kunde'], 'not_found')
    err(r['alte Grundlage entfernt'], '42883')
    err(r['private Prüffunktionen'], '42501')
    val(r['eligible mit NULL'], 'false')
    err(r['Pauschale mit NULL-Grund'], 'call_out_not_allowed')
    expect(r['Firma payment_hold']).toBe('ok')
    val(r['Basis payment_hold'], String(CALL_OUT))
  })

  it('Vorschau schreibt nichts: Status, Journal, Outbox, Audit und Revisionen bleiben gleich', () => {
    const [V1] = [newId()]
    const setup = `${BASE} ${accepted(V1)} ${declined(V1)}`
    const steps: Step[] = [
      { name: 'vorher', sql: snapshot(V1) },
      { name: 'Vorschau', as: 'service_role', sql: `perform * from ${basisOf(U.pa, 'aal2', V1, 'scope_impossible')}` },
      { name: 'Vorschau Fehler', as: 'service_role', sql: `perform * from ${basisOf(U.pa, 'aal2', V1, 'bogus')}` },
      { name: 'nachher', sql: snapshot(V1) },
    ]
    const r = probes(setup, steps)
    expect(r['Vorschau']).toBe('ok')
    err(r['Vorschau Fehler'], 'reason_required')
    expect(r['nachher']).toBe(r['vorher'])
  })

  it('my_cancel_info: nur der Kunde, nur nach Firmen-Storno, nur der Betrag der Pauschale', () => {
    const [S1, S2, S3] = [newId(), newId(), newId()]
    const setup = `${BASE} ${accepted(S1)} ${declined(S1)} ${accepted(S2)} ${accepted(S3)}`
    const info = (req: string) => `=public.my_cancel_info('${req}')`
    const steps: Step[] = [
      { name: 'Info vor Storno', as: 'authenticated', claims: A1(U.cust), sql: info(S1) },
      { name: 'Storno S1 mit Pauschale', as: 'service_role', sql: cancelCall(S1, 'scope_impossible', CALL_OUT, RECEIPTS(S1)) },
      { name: 'Storno S2 ohne Pauschale', as: 'service_role', sql: cancelCall(S2, 'unavailable', 0, null) },
      { name: 'Info S1', as: 'authenticated', claims: A1(U.cust), sql: info(S1) },
      { name: 'Info S2', as: 'authenticated', claims: A1(U.cust), sql: info(S2) },
      { name: 'Info fremder Kunde', as: 'authenticated', claims: A1(U.cust2), sql: info(S1) },
      { name: 'Info Firma', as: 'authenticated', claims: { sub: U.pa, aal: 'aal2' }, sql: info(S1) },
      { name: 'Info admin', as: 'authenticated', claims: { sub: U.adm, aal: 'aal2' }, sql: info(S1) },
      { name: 'Info anon', as: 'anon', sql: info(S1) },
      { name: 'Info angenommener Auftrag', as: 'authenticated', claims: A1(U.cust), sql: info(S3) },
      { name: 'Ergebnistyp', sql: `=pg_get_function_result('public.my_cancel_info(uuid)'::regprocedure)` },
      { name: 'Journal bleibt dem Kunden verborgen', as: 'authenticated', claims: A1(U.cust), sql: `=${journal(S1)}` },
      { name: 'negate_fee', as: 'service_role', sql: negate(S1) },
      { name: 'Info nach negate_fee', as: 'authenticated', claims: A1(U.cust), sql: info(S1) },
    ]
    const r = probes(setup, steps)
    err(r['Info vor Storno'], 'not_found')
    expect(r['Storno S1 mit Pauschale']).toBe('ok')
    expect(r['Storno S2 ohne Pauschale']).toBe('ok')
    val(r['Info S1'], String(CALL_OUT))
    val(r['Info S2'], '0')
    err(r['Info fremder Kunde'], 'not_found')
    err(r['Info Firma'], 'not_found')
    err(r['Info admin'], 'not_found')
    err(r['Info anon'], '42501')
    err(r['Info angenommener Auftrag'], 'not_found')
    val(r['Ergebnistyp'], 'bigint')
    val(r['Journal bleibt dem Kunden verborgen'], '0')
    expect(r['negate_fee']).toBe('ok')
    val(r['Info nach negate_fee'], '0')
  })
})
