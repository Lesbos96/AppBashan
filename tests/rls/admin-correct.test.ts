// T14 `admin_correct` und die Liste gemeldeter Aufträge `reported_jobs` (S9h-3, Migrationen 0049 bis 0051). Rollback-Proben, es bleibt nichts zurück.
// Art A: p_actor und p_aal stammen aus dem geprüften Token der Edge Function; die Gebühr rechnet splitFee aus @pricing.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { ownerSql, probes, type Step } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

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
const CALL_OUT = 6900
const REASON = 'Prüfung abgeschlossen, Beleg liegt vor'

const U = { adm: newId(), cust: newId(), pa: newId(), pb: newId() }
const USERS = insertUsers(Object.values(U))
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${USERS} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}`
const TERMS = `"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":${CALL_OUT},"termsHash":"x"}`
const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string, key: 'a' | 'b') => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const status = (req: string) => `(select status::text from public.service_requests where id = '${req}')`
const count = (sql: string) => `(select count(*) from ${sql})`
const journal = (req: string, where = 'true') => count(`public.commission_entries where request_id = '${req}' and ${where}`)
const sum = (req: string, col: string) => `(select coalesce(sum(${col}), 0) from public.commission_entries where request_id = '${req}')`

/** Auftrag samt Revision 1, Verteilung und Annahme durch Firma a; Termin vor 2 Stunden; optional gemeldet. */
function accepted(id: string, state: 'accepted' | 'in_progress' | 'completed', reported: boolean, termin = "now() - interval '2 hours'", by: 'a' | 'b' = 'a'): string {
  const snap = `{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[],${TERMS}}`
  const end =
    state === 'completed'
      ? `select private.set_request_status('${id}', 'in_progress', null, 'partner');
         select private.set_request_status('${id}', 'completed', null, 'partner');
         update public.assignments set ended_at = now() - interval '1 day', ended_reason = 'completed' where request_id = '${id}' and ended_at is null;`
      : state === 'in_progress'
        ? `select private.set_request_status('${id}', 'in_progress', null, 'partner');`
        : ''
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');
    select public.partner_accept('${by === 'a' ? U.pa : U.pb}', ${LID(id, by)},${rev(id)}, ${RT.s.payoutCents}, ${RT.fr}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.frv}, ${RT.vrv});
    ${end}
    ${reported ? `update public.service_requests set not_done_reported_at = now() where id = '${id}';` : ''}`
}

type Over = { rate?: number; reason?: string }
/** Aufruf von admin_correct; die Gebühr (Basis `base`) rechnet splitFee. */
function call(actor: string, aal: string, req: string, action: string, cancelReason: string | null, base: number, over: Over = {}): string {
  const s = base > 0 ? splitFee(base, { feeRate: RT.fr, vatRate: RT.vr }) : { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
  const cr = cancelReason === null ? 'null' : `'${cancelReason}'`
  return `perform public.admin_correct('${actor}', '${aal}', '${req}', '${action}', '${over.reason ?? REASON}', ${cr}, ${base}, ${over.rate ?? RT.fr}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.frv}, ${RT.vrv})`
}
const basisOf = (actor: string, aal: string, req: string) => `public.admin_correct_basis('${actor}', '${aal}', '${req}')`

const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const val = (v: string | undefined, want: string) => expect(v, String(v)).toBe(`= ${want}`)

describe('Belegfoto nach admin-Storno (0055)', () => {
  it('ein Storno aus einem alten completed schreibt ein neues Statusereignis: der Beleg bleibt', () => {
    const R = newId()
    const path = `${crypto.randomUUID()}.jpg`
    const purge = `=${count(`public.photo_purge() where name = '${path}'`)}`
    const setup = `${BASE} ${accepted(R, 'completed', false)}
      insert into storage.objects (bucket_id, name) values ('job-photos', '${path}');
      insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
        values ('${R}', 'receipt', ${P('a')}, 'ready', '${path}', repeat('b', 64), now());
      alter table public.status_events disable trigger append_only;
      update public.status_events set at = now() - interval '400 days' where request_id = '${R}';
      alter table public.status_events enable trigger append_only;`
    const steps: Step[] = [
      { name: 'vor dem Storno', as: 'service_role', sql: purge },
      { name: 'Storno', as: 'service_role', sql: call(U.adm, 'aal2', R, 'cancel_partner', 'other', 0) },
      { name: 'Status', sql: `=${status(R)}` },
      { name: 'nach dem Storno', as: 'service_role', sql: purge },
    ]
    const r = probes(setup, steps)
    val(r['vor dem Storno'], '1')
    expect(r['Storno']).toBe('ok')
    val(r['Status'], 'cancelled_by_partner')
    val(r['nach dem Storno'], '0')
  })
})

describe('admin_correct (T14) und reported_jobs', () => {
  it('Liste, Verweigerungen, complete, Storno mit Gebühr, Pauschale negieren, Zuordnung, Zähler', () => {
    const [R1, R2, R3, R4, R5, R6, R7, R8] = [newId(), newId(), newId(), newId(), newId(), newId(), newId(), newId()]
    const OURS = `array['${R1}', '${R2}', '${R3}', '${R4}', '${R5}', '${R6}', '${R7}', '${R8}']::uuid[]`
    const setup = `${BASE} ${accepted(R1, 'accepted', true)} ${accepted(R2, 'in_progress', true)} ${accepted(R3, 'completed', true)} ${accepted(R4, 'accepted', false)}
      ${accepted(R5, 'completed', true)} ${accepted(R6, 'accepted', true)} ${accepted(R7, 'accepted', false)} ${accepted(R8, 'accepted', false, "now() + interval '5 days'", 'b')}
      insert into public.status_events (at, request_id, from_status, to_status, actor_role) values (now() + interval '1 minute', '${R6}', 'requested', 'accepted', 'system');`
    const listCount = `=${count(`public.reported_jobs() j where j.request_id = any (${OURS})`)}`
    const steps: Step[] = [
      // Liste vorher: R1, R2, R3, R5, R6 gemeldet
      { name: 'Liste admin', as: 'authenticated', claims: A2(U.adm), sql: listCount },
      { name: 'Liste admin aal1', as: 'authenticated', claims: A1(U.adm), sql: listCount },
      { name: 'Liste Firma', as: 'authenticated', claims: A2(U.pa), sql: listCount },
      { name: 'Liste Kunde', as: 'authenticated', claims: A2(U.cust), sql: listCount },
      { name: 'Liste anon', as: 'anon', sql: listCount },
      { name: 'Liste Zeile', as: 'authenticated', claims: A2(U.adm), sql: `=(select concat_ws(':', status, partner_name is not null, total_cents) from public.reported_jobs() where request_id = '${R2}')` },
      // Verweigerungen
      { name: 'aal1', as: 'service_role', sql: call(U.adm, 'aal1', R1, 'complete', null, 0) },
      { name: 'Firma als Akteur', as: 'service_role', sql: call(U.pa, 'aal2', R1, 'complete', null, 0) },
      { name: 'Kunde als Akteur', as: 'service_role', sql: call(U.cust, 'aal2', R1, 'complete', null, 0) },
      { name: 'Begründung zu kurz', as: 'service_role', sql: call(U.adm, 'aal2', R1, 'complete', null, 0, { reason: 'kurz' }) },
      { name: 'unbekannte Aktion', as: 'service_role', sql: call(U.adm, 'aal2', R1, 'delete_all', null, 0) },
      { name: 'authenticated', as: 'authenticated', claims: A2(U.adm), sql: call(U.adm, 'aal2', R1, 'complete', null, 0) },
      { name: 'anon', as: 'anon', sql: call(U.adm, 'aal2', R1, 'complete', null, 0) },
      { name: 'Basis authenticated', as: 'authenticated', claims: A2(U.adm), sql: `perform * from ${basisOf(U.adm, 'aal2', R1)}` },
      { name: 'Basis Firma', as: 'service_role', sql: `perform * from ${basisOf(U.pa, 'aal2', R1)}` },
      { name: 'Basis aal1', as: 'service_role', sql: `perform * from ${basisOf(U.adm, 'aal1', R1)}` },
      { name: 'Basis', as: 'service_role', sql: `=(select concat_ws(':', request_status, total_cents, customer_fee_base_cents, call_out_cents) from ${basisOf(U.adm, 'aal2', R1)})` },
      { name: 'unbekannter Auftrag', as: 'service_role', sql: call(U.adm, 'aal2', newId(), 'complete', null, 0) },
      { name: 'direktes UPDATE Status completed zu cancelled', as: 'owner', sql: `update public.service_requests set status = 'cancelled_by_partner' where id = '${R3}'` },
      { name: 'direktes UPDATE Zuordnung completed', as: 'owner', sql: `update public.assignments set ended_reason = 'cancelled_by_partner', cancel_reason = 'other' where request_id = '${R3}'` },
      { name: 'direktes UPDATE Stempel als Firma', as: 'authenticated', claims: A2(U.pa), sql: `update public.service_requests set not_done_resolved_at = now() where id = '${R1}'` },
      { name: 'unverändert', sql: `=${status(R1)} || ':' || ${status(R3)} || ':' || ${journal(R1)}` },
      // complete (R1) und Wiederholung, nicht gemeldet (R4), jüngeres Ereignis (R6)
      { name: 'complete R4 ohne Meldung', as: 'service_role', sql: call(U.adm, 'aal2', R4, 'complete', null, 0) },
      { name: 'complete R6 jüngeres Ereignis', as: 'service_role', sql: call(U.adm, 'aal2', R6, 'complete', null, 0) },
      { name: 'complete R1', as: 'service_role', sql: call(U.adm, 'aal2', R1, 'complete', null, 0) },
      { name: 'R1 Status', sql: `=${status(R1)}` },
      { name: 'R1 Zuordnung', sql: `=(select ended_reason::text from public.assignments where request_id = '${R1}')` },
      { name: 'R1 Journal unverändert', sql: `=${journal(R1)} || ':' || ${sum(R1, 'fee_cents')}` },
      { name: 'R1 Ereignis', sql: `=${count(`public.status_events where request_id = '${R1}' and to_status = 'completed' and actor_role = 'admin' and actor_id = '${U.adm}'`)}` },
      { name: 'R1 Audit', sql: `=(select detail ->> 'action' || ':' || (detail ->> 'reason') from public.audit_log where action = 'admin_correct' and entity_id = '${R1}')` },
      { name: 'R1 Stempel', sql: `=(select (not_done_resolved_at is not null)::text from public.service_requests where id = '${R1}')` },
      { name: 'complete R1 nochmal', as: 'service_role', sql: call(U.adm, 'aal2', R1, 'complete', null, 0) },
      { name: 'dismiss R1 nach Stempel', as: 'service_role', sql: call(U.adm, 'aal2', R1, 'dismiss_report', null, 0) },
      // R5: Meldung unbegründet, schon completed
      { name: 'dismiss R5', as: 'service_role', sql: call(U.adm, 'aal2', R5, 'dismiss_report', null, 0) },
      { name: 'R5 Status bleibt', sql: `=${status(R5)} || ':' || ${journal(R5)}` },
      { name: 'dismiss R2 (nicht completed)', as: 'service_role', sql: call(U.adm, 'aal2', R2, 'dismiss_report', null, 0) },
      { name: 'dismiss R4 (ohne Meldung)', as: 'service_role', sql: call(U.adm, 'aal2', R4, 'dismiss_report', null, 0) },
      // Storno für den Kunden mit Gebühr (R2, in_progress)
      { name: 'R2 falsche Basis', as: 'service_role', sql: call(U.adm, 'aal2', R2, 'cancel_customer', null, 100) },
      { name: 'R2 falscher Satz', as: 'service_role', sql: call(U.adm, 'aal2', R2, 'cancel_customer', null, TOTAL, { rate: 0.2 }) },
      { name: 'R2 cancel_customer', as: 'service_role', sql: call(U.adm, 'aal2', R2, 'cancel_customer', null, TOTAL) },
      { name: 'R2 Status', sql: `=${status(R2)}` },
      { name: 'R2 Zeilen', sql: `=${journal(R2)} || ':' || ${journal(R2, `kind = 'cancellation'`)} || ':' || ${journal(R2, `kind = 'cancellation_fee'`)}` },
      { name: 'R2 Gebührensumme', sql: `=${sum(R2, 'fee_cents')}` },
      { name: 'R2 Zuordnung', sql: `=(select ended_reason::text from public.assignments where request_id = '${R2}')` },
      { name: 'R2 Meldung erledigt', sql: `=(select (not_done_resolved_at is not null)::text from public.service_requests where id = '${R2}')` },
      { name: 'R2 Wiederholung', as: 'service_role', sql: call(U.adm, 'aal2', R2, 'cancel_customer', null, 0) },
      // M2: vor dem Termin ohne Meldung kein admin-Storno (Kunde und Firma würden nicht informiert, keine Weitervermittlung)
      { name: 'R8 cancel_customer vor dem Termin', as: 'service_role', sql: call(U.adm, 'aal2', R8, 'cancel_customer', null, 0) },
      { name: 'R8 cancel_partner vor dem Termin', as: 'service_role', sql: call(U.adm, 'aal2', R8, 'cancel_partner', 'other', 0) },
      { name: 'R8 unverändert', sql: `=${status(R8)} || ':' || ${journal(R8)}` },
      { name: 'R8 nach Meldung', sql: `update public.service_requests set not_done_reported_at = now() where id = '${R8}'` },
      { name: 'R8 cancel_customer nach Meldung', as: 'service_role', sql: call(U.adm, 'aal2', R8, 'cancel_customer', null, 0) },
      { name: 'R8 Status nach Meldung', sql: `=${status(R8)}` },
      // Storno der Firma aus completed (R3) mit Pauschale, dann negieren
      { name: 'R3 ohne Grund', as: 'service_role', sql: call(U.adm, 'aal2', R3, 'cancel_partner', null, 0) },
      { name: 'R3 ungültiger Grund', as: 'service_role', sql: call(U.adm, 'aal2', R3, 'cancel_partner', 'bogus', 0) },
      { name: 'R3 negate vor Storno', as: 'service_role', sql: call(U.adm, 'aal2', R3, 'negate_fee', null, 0) },
      { name: 'R3 cancel_partner mit Pauschale', as: 'service_role', sql: call(U.adm, 'aal2', R3, 'cancel_partner', 'scope_impossible', CALL_OUT) },
      { name: 'R3 Status', sql: `=${status(R3)}` },
      // M1: ended_at bleibt der Abschluss (kein neues Zugriffsfenster der Firma auf die Kundendaten)
      { name: 'R3 Zuordnung', sql: `=(select ended_reason::text || ':' || cancel_reason || ':' || (ended_at < now())::text from public.assignments where request_id = '${R3}')` },
      { name: 'R3 Zeilen', sql: `=${journal(R3)} || ':' || ${journal(R3, `kind = 'cancellation'`)} || ':' || ${journal(R3, `kind = 'cancellation_fee' and total_cents = ${CALL_OUT}`)}` },
      { name: 'R3 Ereignisse', sql: `=${count(`public.status_events where request_id = '${R3}' and to_status = 'cancelled_by_partner' and actor_role = 'admin'`)}` },
      { name: 'Zähler', as: 'authenticated', claims: A2(U.adm), sql: `=(select concat_ws(':', cancels, needs_review) from public.partner_quality() where partner_id = ${P('a')})` },
      { name: 'R3 negate_fee', as: 'service_role', sql: call(U.adm, 'aal2', R3, 'negate_fee', null, 0) },
      { name: 'R3 Correction', sql: `=${journal(R3, `kind = 'correction' and reverses_entry_id = (select id from public.commission_entries where request_id = '${R3}' and kind = 'cancellation_fee')`)}` },
      { name: 'R3 Summen null', sql: `=${sum(R3, 'total_cents')} || ',' || ${sum(R3, 'fee_cents')} || ',' || ${sum(R3, 'fee_net_cents')} || ',' || ${sum(R3, 'fee_vat_cents')} || ',' || ${sum(R3, 'payout_cents')}` },
      { name: 'R3 Status bleibt', sql: `=${status(R3)}` },
      { name: 'R3 negate nochmal', as: 'service_role', sql: call(U.adm, 'aal2', R3, 'negate_fee', null, 0) },
      { name: 'R3 Folgebuchung nach Correction', as: 'service_role', sql: call(U.adm, 'aal2', R3, 'cancel_customer', null, 0) },
      // negate ohne Gebühr, nicht beendet
      { name: 'negate R4 (nicht beendet)', as: 'service_role', sql: call(U.adm, 'aal2', R4, 'negate_fee', null, 0) },
      { name: 'negate R2 mit Gebühr', as: 'service_role', sql: call(U.adm, 'aal2', R2, 'negate_fee', null, 0) },
      { name: 'R2 Gebührensumme nach Correction', sql: `=${sum(R2, 'fee_cents')}` },
      // R7: Storno der Firma ohne Gebühr
      { name: 'R7 cancel_partner', as: 'service_role', sql: call(U.adm, 'aal2', R7, 'cancel_partner', 'other', 0) },
      { name: 'R7 Zähler', as: 'authenticated', claims: A2(U.adm), sql: `=(select cancels from public.partner_quality() where partner_id = ${P('a')})` },
      // Liste nachher: nur noch R6 (R1 erledigt, R2/R3 storniert, R5 verworfen)
      { name: 'Liste nachher', as: 'authenticated', claims: A2(U.adm), sql: listCount },
      { name: 'Liste nachher Zeile', as: 'authenticated', claims: A2(U.adm), sql: `=(select request_id::text from public.reported_jobs() where request_id = any (${OURS}))` },
    ]
    const r = probes(setup, steps)
    val(r['Liste admin'], '5')
    val(r['Liste admin aal1'], '0')
    val(r['Liste Firma'], '0')
    val(r['Liste Kunde'], '0')
    err(r['Liste anon'], '42501')
    val(r['Liste Zeile'], `in_progress:t:${TOTAL}`)
    err(r['aal1'], 'mfa_required')
    err(r['Firma als Akteur'], 'not_admin')
    err(r['Kunde als Akteur'], 'not_admin')
    err(r['Begründung zu kurz'], 'reason_required')
    err(r['unbekannte Aktion'], 'invalid_action')
    err(r['authenticated'], '42501')
    err(r['anon'], '42501')
    err(r['Basis authenticated'], '42501')
    err(r['Basis Firma'], 'not_admin')
    err(r['Basis aal1'], 'mfa_required')
    val(r['Basis'], `accepted:${TOTAL}:${TOTAL}:${CALL_OUT}`)
    err(r['unbekannter Auftrag'], 'not_found')
    err(r['direktes UPDATE Status completed zu cancelled'], 'invalid_transition')
    err(r['direktes UPDATE Zuordnung completed'], 'append_only')
    err(r['direktes UPDATE Stempel als Firma'], '42501')
    val(r['unverändert'], 'accepted:completed:1')

    err(r['complete R4 ohne Meldung'], 'invalid_transition')
    err(r['complete R6 jüngeres Ereignis'], 'retry')
    expect(r['complete R1']).toBe('ok')
    val(r['R1 Status'], 'completed')
    val(r['R1 Zuordnung'], 'completed')
    val(r['R1 Journal unverändert'], `1:${RT.s.feeCents}`)
    val(r['R1 Ereignis'], '1')
    val(r['R1 Audit'], `complete:${REASON}`)
    val(r['R1 Stempel'], 'true')
    err(r['complete R1 nochmal'], 'invalid_transition')
    err(r['dismiss R1 nach Stempel'], 'invalid_transition')
    expect(r['dismiss R5']).toBe('ok')
    val(r['R5 Status bleibt'], 'completed:1')
    err(r['dismiss R2 (nicht completed)'], 'invalid_transition')
    err(r['dismiss R4 (ohne Meldung)'], 'invalid_transition')

    err(r['R2 falsche Basis'], 'amount_mismatch')
    err(r['R2 falscher Satz'], 'fee_basis_changed')
    expect(r['R2 cancel_customer']).toBe('ok')
    val(r['R2 Status'], 'cancelled_by_customer')
    val(r['R2 Zeilen'], '3:1:1')
    val(r['R2 Gebührensumme'], String(RT.s.feeCents))
    val(r['R2 Zuordnung'], 'cancelled_by_customer')
    val(r['R2 Meldung erledigt'], 'true')
    err(r['R2 Wiederholung'], 'invalid_transition')
    err(r['R8 cancel_customer vor dem Termin'], 'invalid_transition')
    err(r['R8 cancel_partner vor dem Termin'], 'invalid_transition')
    val(r['R8 unverändert'], 'accepted:1')
    expect(r['R8 cancel_customer nach Meldung']).toBe('ok')
    val(r['R8 Status nach Meldung'], 'cancelled_by_customer')

    err(r['R3 ohne Grund'], 'reason_required')
    err(r['R3 ungültiger Grund'], 'reason_required')
    err(r['R3 negate vor Storno'], 'invalid_transition')
    expect(r['R3 cancel_partner mit Pauschale']).toBe('ok')
    val(r['R3 Status'], 'cancelled_by_partner')
    val(r['R3 Zuordnung'], 'cancelled_by_partner:scope_impossible:true')
    val(r['R3 Zeilen'], '3:1:1')
    val(r['R3 Ereignisse'], '1')
    val(r['Zähler'], '1:f')
    expect(r['R3 negate_fee']).toBe('ok')
    val(r['R3 Correction'], '1')
    val(r['R3 Summen null'], '0,0,0,0,0')
    val(r['R3 Status bleibt'], 'cancelled_by_partner')
    err(r['R3 negate nochmal'], 'no_fee_line')
    err(r['R3 Folgebuchung nach Correction'], 'invalid_transition')
    err(r['negate R4 (nicht beendet)'], 'invalid_transition')
    expect(r['negate R2 mit Gebühr']).toBe('ok')
    val(r['R2 Gebührensumme nach Correction'], '0')
    expect(r['R7 cancel_partner']).toBe('ok')
    val(r['R7 Zähler'], '2')
    val(r['Liste nachher'], '1')
    val(r['Liste nachher Zeile'], R6)
  })
})
