// Storno durch den Partner (S9h-2, Migration 0046): cancel_by_partner_basis, cancel_by_partner (T13), Weitervermittlung (T16), partner_quality.
// Alles läuft als Rollback-Proben (`probes`), es bleibt nichts zurück. Die Pauschale rechnet `splitFee` aus @pricing.
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

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pb: newId() }
const USERS = insertUsers(Object.values(U))
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${USERS} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}`

const TERMS = `"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":${CALL_OUT},"termsHash":"x"}`
const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const status = (req: string) => `(select status::text from public.service_requests where id = '${req}')`
const count = (sql: string) => `(select count(*) from ${sql})`
const journal = (req: string, where = 'true') => count(`public.commission_entries where request_id = '${req}' and ${where}`)
const feeSum = (req: string) => `(select coalesce(sum(fee_cents), 0) from public.commission_entries where request_id = '${req}')`
const follow = (req: string) => `(select id from public.service_requests where reissued_from = '${req}')`

/** Auftrag samt Revision 1 (mit Stornostufen), Verteilung und Annahme durch Firma a oder b. */
function accepted(id: string, termin: string, by: 'a' | 'b' = 'a'): string {
  const snap = `{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[],${TERMS}}`
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');
    select public.partner_accept('${by === 'a' ? U.pa : U.pb}', ${LID(id, by)},${rev(id)}, ${RT.s.payoutCents}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}
const contact = (req: string) =>
  `insert into public.request_contacts (request_id, name, phone, email) values ('${req}', 'Test Kunde', '+43 660 1234567', 'kunde@movenow.test');`
const photo = (req: string) =>
  `select set_config('app.mv_photo_request', '${req}', true);
   insert into public.request_photos (request_id, storage_path)
   select '${req}', s.customer_id::text || '/' || s.client_ref::text || '/' || gen_random_uuid() || '.jpg' from public.service_requests s where s.id = '${req}';
   select set_config('app.mv_photo_request', '', true);`
const receipt = (req: string) =>
  `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
     values ('${req}', 'receipt', ${P('a')}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());`
const curRev = (req: string) => `(select current_revision from public.service_requests where id = '${req}')`
const propose = (req: string, by = U.pa) =>
  `select public.propose_change('${by}', 'aal2', '${req}', ${curRev(req)}, '{"hours":6}'::jsonb, 80000, array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt'));`
const OPEN = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and source = 'change_order' and status = 'proposed')`
const s80 = splitChange(80000, { tiers: RT.tiers, vatRate: RT.vr }, splitFee(TOTAL, { tiers: RT.tiers, vatRate: RT.vr }))
const decide = (req: string, accept: boolean) =>
  `select public.decide_change('${U.cust}', ${OPEN(req)}, ${accept}, 80000, ${RT.vr}, ${s80.feeCents}, ${s80.feeNetCents}, ${s80.feeVatCents}, ${s80.payoutCents}, ${RT.fsv}, ${RT.vrv});`

type Over = { base?: number; version?: number; feeShift?: number; photos?: string }
/** Aufruf von cancel_by_partner; die Pauschale (Basis `base`) rechnet splitFee. `photos` ist ein SQL-Ausdruck (Standard: keine Belege). */
function cancelCall(actor: string, aal: string, req: string, reason: string | null, base: number, over: Over = {}): string {
  const s = base > 0 ? splitFee(base, { tiers: RT.tiers, vatRate: RT.vr }) : { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
  const fee = s.feeCents + (over.feeShift ?? 0)
  const rsn = reason === null ? 'null' : `'${reason}'`
  return `perform public.cancel_by_partner('${actor}', '${aal}', '${req}', ${rsn}, ${over.photos ?? 'null'}, ${over.base ?? base}, ${RT.vr}, ${fee}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${over.version ?? RT.fsv}, ${RT.vrv})`
}
const RECEIPTS = (req: string) => `array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt')`
const basisOf = (actor: string, aal: string, req: string, reason: string | null = 'other') =>
  `public.cancel_by_partner_basis('${actor}', '${aal}', '${req}', ${reason === null ? 'null' : `'${reason}'`})`

const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const val = (v: string | undefined, want: string) => expect(v, String(v)).toBe(`= ${want}`)

describe('cancel_by_partner (T13) und Weitervermittlung (T16)', () => {
  it('Gegenbuchung, Zuordnung, Zähler, Folgeanfrage mit Kopien und Ausschluss, Mails', () => {
    const [R1, R2, R3, R4, R5, R6, R7] = [newId(), newId(), newId(), newId(), newId(), newId(), newId()]
    const FIVE = "now() + interval '5 days'"
    const setup = `${BASE} ${accepted(R7, "now() + interval '30 hours'")} ${accepted(R1, FIVE)} ${accepted(R2, FIVE)} ${contact(R2)} ${photo(R2)} ${accepted(R3, "now() + interval '12 hours'")}
      ${accepted(R4, FIVE)} ${receipt(R4)} ${propose(R4)} ${decide(R4, true)} ${accepted(R5, FIVE, 'b')} ${accepted(R6, FIVE, 'b')}
      select private.set_request_status('${R6}', 'in_progress', null, 'partner');`
    const steps: Step[] = [
      // Grundlage und Verweigerungen
      // s9i-7b (M1): ohne abgelehnten Nachtrag gibt die Grundlage keine Pauschale an (vorher immer call_out_fee_cents)
      { name: 'Basis', as: 'service_role', sql: `=(select call_out_cents from ${basisOf(U.pa, 'aal2', R1, 'scope_impossible')})` },
      { name: 'Basis aal1', as: 'service_role', sql: `perform * from ${basisOf(U.pa, 'aal1', R1)}` },
      { name: 'Basis fremde Firma', as: 'service_role', sql: `perform * from ${basisOf(U.pb, 'aal2', R1)}` },
      { name: 'Basis Kunde', as: 'service_role', sql: `perform * from ${basisOf(U.cust, 'aal2', R1)}` },
      { name: 'ohne Grund', as: 'service_role', sql: cancelCall(U.pa, 'aal2', R1, null, 0) },
      { name: 'unbekannter Grund', as: 'service_role', sql: cancelCall(U.pa, 'aal2', R1, 'bogus', 0) },
      { name: 'aal1', as: 'service_role', sql: cancelCall(U.pa, 'aal1', R1, 'other', 0) },
      { name: 'fremde Firma', as: 'service_role', sql: cancelCall(U.pb, 'aal2', R1, 'other', 0) },
      { name: 'Kunde als Akteur', as: 'service_role', sql: cancelCall(U.cust, 'aal2', R1, 'other', 0) },
      { name: 'Basis ohne Beleg', as: 'service_role', sql: cancelCall(U.pa, 'aal2', R1, 'other', 100) },
      { name: 'Beleg bei anderem Grund', as: 'service_role', sql: cancelCall(U.pa, 'aal2', R4, 'unavailable', CALL_OUT, { photos: RECEIPTS(R4) }) },
      { name: 'falsche Version', as: 'service_role', sql: cancelCall(U.pa, 'aal2', R1, 'other', 0, { version: RT.fsv + 1 }) },
      { name: 'authenticated', as: 'authenticated', claims: A2(U.pa), sql: cancelCall(U.pa, 'aal2', R1, 'other', 0) },
      { name: 'anon', as: 'anon', sql: cancelCall(U.pa, 'aal2', R1, 'other', 0) },
      { name: 'direktes UPDATE des Status', as: 'authenticated', claims: A2(U.pa), sql: `update public.service_requests set status = 'cancelled_by_partner' where id = '${R1}'` },
      { name: 'R1 unverändert', sql: `=${status(R1)} || ':' || ${journal(R1)}` },
      // Erfolg R1: Termin in 5 Tagen, keine Fotos
      { name: 'Storno R1', as: 'service_role', sql: cancelCall(U.pa, 'aal2', R1, 'unavailable', 0) },
      { name: 'R1 Status', sql: `=${status(R1)}` },
      { name: 'R1 Zeilen', sql: `=${journal(R1)}` },
      { name: 'R1 Gegenbuchung', sql: `=${journal(R1, `kind = 'cancellation' and reverses_entry_id = (select id from public.commission_entries where request_id = '${R1}' and kind = 'booking')`)}` },
      { name: 'R1 Gebührensumme', sql: `=${feeSum(R1)}` },
      { name: 'R1 Zuordnung', sql: `=(select ended_reason::text || ':' || cancel_reason from public.assignments where request_id = '${R1}')` },
      { name: 'R1 Ereignis', sql: `=${count(`public.status_events where request_id = '${R1}' and to_status = 'cancelled_by_partner' and actor_role = 'partner' and actor_id = '${U.pa}'`)}` },
      { name: 'R1 Audit', sql: `=${count(`public.audit_log where action = 'cancel_by_partner' and entity_id = '${R1}' and actor_id = '${U.pa}'`)}` },
      { name: 'R1 Wiederholung', as: 'service_role', sql: cancelCall(U.pa, 'aal2', R1, 'unavailable', 0) },
      // T16: Folgeanfrage zu R1
      { name: 'R1 Folgeanfragen', sql: `=${count(`public.service_requests where reissued_from = '${R1}'`)}` },
      { name: 'R1 Folge Status', sql: `=(select status::text || ':' || cancel_fee_waived::text || ':' || (termin_at = (select termin_at from public.service_requests where id = '${R1}'))::text || ':' || (district = 17)::text from public.service_requests where reissued_from = '${R1}')` },
      { name: 'R1 Folge Revision', sql: `=(select concat_ws(':', v.n, v.source, v.total_cents, v.price_version = o.price_version, v.content_hash = o.content_hash, v.copied_from_revision_id = o.id, v.snapshot = o.snapshot, v.inputs = o.inputs) from public.price_revisions v join public.price_revisions o on o.request_id = '${R1}' and o.n = 1 where v.request_id = ${follow(R1)})` },
      { name: 'R1 Folge Zeiger', sql: `=(select (current_revision = (select id from public.price_revisions where request_id = s.id and n = 1))::text from public.service_requests s where s.reissued_from = '${R1}')` },
      { name: 'R1 Folge Frist', sql: `=(select (accept_deadline > now() and accept_deadline <= termin_at)::text from public.service_requests where reissued_from = '${R1}')` },
      { name: 'R1 Listing für b', sql: `=${count(`public.job_listings where request_id = ${follow(R1)} and partner_id = ${P('b')}`)}` },
      { name: 'R1 kein Listing für a', sql: `=${count(`public.job_listings where request_id = ${follow(R1)} and partner_id = ${P('a')}`)}` },
      { name: 'R1 Mail Folge', sql: `=${count(`public.outbox where kind = 'request_reissued' and recipient_kind = 'customer' and recipient_id = '${U.cust}' and request_id = ${follow(R1)}`)}` },
      { name: 'R1 keine Mail ohne Folge', sql: `=${count(`public.outbox where kind = 'partner_cancelled' and request_id = '${R1}'`)}` },
      { name: 'R1 Folge noch nicht angenommen: kein Kundenstorno', as: 'service_role', sql: `perform * from public.cancel_by_customer_basis('${U.cust}', ${follow(R1)})` },
      { name: 'R1 Folge Kunde liest', as: 'authenticated', claims: A1(U.cust), sql: `=${count(`public.service_requests where reissued_from = '${R1}'`)}` },
      { name: 'R1 Folge fremder Kunde', as: 'authenticated', claims: A1(U.cust2), sql: `=${count(`public.service_requests where reissued_from = '${R1}'`)}` },
      // R2: Kontakt und Fotos werden übernommen, die Verteilung wartet auf die Pipeline
      { name: 'Storno R2', as: 'service_role', sql: cancelCall(U.pa, 'aal2', R2, 'other', 0) },
      { name: 'R2 Kontakt kopiert', sql: `=${count(`public.request_contacts where request_id = ${follow(R2)} and email = 'kunde@movenow.test'`)}` },
      { name: 'R2 Foto kopiert', sql: `=${count(`public.request_photos n join public.request_photos o on o.storage_path = n.storage_path and o.request_id = '${R2}' where n.request_id = ${follow(R2)}`)}` },
      { name: 'R2 Folge wartet auf Fotos', sql: `=${count(`public.job_listings where request_id = ${follow(R2)}`)} || ':' || (select status::text from public.service_requests where id = ${follow(R2)})` },
      { name: 'R2 Original-Fotos bleiben', sql: `=${count(`public.request_photos where request_id = '${R2}'`)}` },
      // R3: Termin in 12 Stunden: keine Weitervermittlung
      { name: 'Storno R3', as: 'service_role', sql: cancelCall(U.pa, 'aal2', R3, 'other', 0) },
      { name: 'R3 keine Folge', sql: `=${count(`public.service_requests where reissued_from = '${R3}'`)}` },
      { name: 'R3 Mail', sql: `=${count(`public.outbox where kind = 'partner_cancelled' and recipient_kind = 'customer' and request_id = '${R3}'`)}` },
      // R4: angenommener Nachtrag, beide Zeilen gegengebucht, Folgeanfrage zum Nachtragspreis
      { name: 'Storno R4', as: 'service_role', sql: cancelCall(U.pa, 'aal2', R4, 'other', 0) },
      { name: 'R4 Gegenbuchungen', sql: `=${journal(R4, `kind = 'cancellation'`)}` },
      { name: 'R4 Summen', sql: `=(select concat_ws(',', sum(total_cents), sum(fee_cents), sum(fee_net_cents), sum(fee_vat_cents), sum(payout_cents)) from public.commission_entries where request_id = '${R4}')` },
      { name: 'R4 Folge Betrag', sql: `=(select concat_ws(':', v.total_cents, v.source, v.n, v.copied_from_revision_id = (select current_revision from public.service_requests where id = '${R4}')) from public.price_revisions v where v.request_id = ${follow(R4)})` },
      // R5 (Firma b) und R6 (in_progress, Firma a): Ausschluss je stornierender Firma
      { name: 'Storno R5', as: 'service_role', sql: cancelCall(U.pb, 'aal2', R5, 'other', 0) },
      { name: 'R5 Listing für a', sql: `=${count(`public.job_listings where request_id = ${follow(R5)} and partner_id = ${P('a')}`)}` },
      { name: 'R5 kein Listing für b', sql: `=${count(`public.job_listings where request_id = ${follow(R5)} and partner_id = ${P('b')}`)}` },
      { name: 'Storno R6 in_progress', as: 'service_role', sql: cancelCall(U.pb, 'aal2', R6, 'other', 0) },
      { name: 'R6 Status', sql: `=${status(R6)}` },
      // R7: Termin in 30 Stunden (ohne Waiver wären 50 % fällig); Folgeanfrage, Annahme durch b, dann kostenloses Kundenstorno (cancel_fee_waived)
      { name: 'Storno R7', as: 'service_role', sql: cancelCall(U.pa, 'aal2', R7, 'other', 0) },
      { name: 'R7 Folge angenommen', as: 'service_role', sql: `perform public.partner_accept('${U.pb}', (select id from public.job_listings where request_id = ${follow(R7)} and partner_id = ${P('b')}), (select id from public.price_revisions where request_id = ${follow(R7)} and n = 1), ${RT.s.payoutCents}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.fsv}, ${RT.vrv})` },
      { name: 'R7 Kundenstorno frei', as: 'service_role', sql: `=(select fee_base_cents from public.cancel_by_customer_basis('${U.cust}', ${follow(R7)}))` },
      // Qualitätszähler: Firma a hat R1, R2, R3, R4, R7 storniert, Firma b nur R5 und R6
      { name: 'Zähler admin', as: 'authenticated', claims: A2(U.adm), sql: `=(select concat_ws(':', cancels, needs_review) from public.partner_quality() where partner_id = ${P('a')})` },
      { name: 'Zähler Firma b unter Schwelle', as: 'authenticated', claims: A2(U.adm), sql: `=(select concat_ws(':', cancels, needs_review) from public.partner_quality() where partner_id = ${P('b')})` },
      { name: 'Zähler Firma liest nichts', as: 'authenticated', claims: A2(U.pa), sql: `=${count('public.partner_quality()')}` },
      { name: 'Zähler Kunde liest nichts', as: 'authenticated', claims: A1(U.cust), sql: `=${count('public.partner_quality()')}` },
      { name: 'Zähler anon', as: 'anon', sql: `perform * from public.partner_quality()` },
    ]
    const r = probes(setup, steps)
    val(r['Basis'], '0')
    err(r['Basis aal1'], 'mfa_required')
    err(r['Basis fremde Firma'], 'not_found')
    err(r['Basis Kunde'], 'not_found')
    err(r['ohne Grund'], 'reason_required')
    err(r['unbekannter Grund'], 'reason_required')
    err(r['aal1'], 'mfa_required')
    err(r['fremde Firma'], 'not_found')
    err(r['Kunde als Akteur'], 'not_found')
    err(r['Basis ohne Beleg'], 'amount_mismatch')
    err(r['Beleg bei anderem Grund'], 'call_out_not_allowed')
    err(r['falsche Version'], 'fee_basis_changed')
    err(r['authenticated'], '42501')
    err(r['anon'], '42501')
    err(r['direktes UPDATE des Status'], '42501')
    val(r['R1 unverändert'], 'accepted:1')

    expect(r['Storno R1']).toBe('ok')
    val(r['R1 Status'], 'cancelled_by_partner')
    val(r['R1 Zeilen'], '2')
    val(r['R1 Gegenbuchung'], '1')
    val(r['R1 Gebührensumme'], '0')
    val(r['R1 Zuordnung'], 'cancelled_by_partner:unavailable')
    val(r['R1 Ereignis'], '1')
    val(r['R1 Audit'], '1')
    err(r['R1 Wiederholung'], 'not_found')
    val(r['R1 Folgeanfragen'], '1')
    val(r['R1 Folge Status'], 'requested:true:true:true')
    val(r['R1 Folge Revision'], `1:submit:${TOTAL}:t:t:t:t:t`) // concat_ws schreibt boolean als t/f
    val(r['R1 Folge Zeiger'], 'true')
    val(r['R1 Folge Frist'], 'true')
    val(r['R1 Listing für b'], '1')
    val(r['R1 kein Listing für a'], '0')
    val(r['R1 Mail Folge'], '1')
    val(r['R1 keine Mail ohne Folge'], '0')
    err(r['R1 Folge noch nicht angenommen: kein Kundenstorno'], 'invalid_transition')
    val(r['R1 Folge Kunde liest'], '1')
    val(r['R1 Folge fremder Kunde'], '0')

    expect(r['Storno R2']).toBe('ok')
    val(r['R2 Kontakt kopiert'], '1')
    val(r['R2 Foto kopiert'], '1')
    val(r['R2 Folge wartet auf Fotos'], '0:requested')
    val(r['R2 Original-Fotos bleiben'], '1')

    expect(r['Storno R3']).toBe('ok')
    val(r['R3 keine Folge'], '0')
    val(r['R3 Mail'], '1')

    expect(r['Storno R4']).toBe('ok')
    val(r['R4 Gegenbuchungen'], '2')
    val(r['R4 Summen'], '0,0,0,0,0')
    val(r['R4 Folge Betrag'], '80000:submit:1:t')

    expect(r['Storno R5']).toBe('ok')
    val(r['R5 Listing für a'], '1')
    val(r['R5 kein Listing für b'], '0')
    expect(r['Storno R6 in_progress']).toBe('ok')
    val(r['R6 Status'], 'cancelled_by_partner')

    expect(r['Storno R7']).toBe('ok')
    expect(r['R7 Folge angenommen']).toBe('ok')
    val(r['R7 Kundenstorno frei'], '0')
    val(r['Zähler admin'], '5:t')
    val(r['Zähler Firma b unter Schwelle'], '2:f')
    val(r['Zähler Firma liest nichts'], '0')
    val(r['Zähler Kunde liest nichts'], '0')
    err(r['Zähler anon'], '42501')
  })

  it('scope_impossible: Pauschale nur mit Beleg nach abgelehntem Nachtrag, keine Weitervermittlung', () => {
    const [S1, S2, S3, S5, S6, S7] = [newId(), newId(), newId(), newId(), newId(), newId()]
    const FIVE = "now() + interval '5 days'"
    const setup = `${BASE} ${accepted(S6, "now() - interval '2 hours'", 'b')} ${accepted(S7, FIVE)} ${accepted(S1, "now() - interval '2 hours'")} ${receipt(S1)} ${propose(S1)} ${decide(S1, false)}
      ${accepted(S2, "now() - interval '2 hours'")} ${receipt(S2)} ${accepted(S3, FIVE)}
      ${accepted(S5, "now() - interval '2 hours'")} ${receipt(S5)} ${propose(S5)} ${decide(S5, false)}
      insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
        values ('${S5}', 'receipt', ${P('b')}, 'ready', gen_random_uuid() || '.jpg', repeat('c', 64), now());`
    const steps: Step[] = [
      { name: 'ohne abgelehnten Nachtrag', as: 'service_role', sql: cancelCall(U.pa, 'aal2', S2, 'scope_impossible', CALL_OUT, { photos: RECEIPTS(S2) }) },
      { name: 'fremde Belege', as: 'service_role', sql: cancelCall(U.pa, 'aal2', S5, 'scope_impossible', CALL_OUT, { photos: `array(select id from public.job_photos where request_id = '${S5}' and uploaded_partner_id = ${P('b')})` }) },
      { name: 'Belege anderer Auftrag', as: 'service_role', sql: cancelCall(U.pa, 'aal2', S1, 'scope_impossible', CALL_OUT, { photos: RECEIPTS(S2) }) },
      { name: 'zu viele Belege', as: 'service_role', sql: cancelCall(U.pa, 'aal2', S1, 'scope_impossible', CALL_OUT, { photos: `array(select id from public.job_photos where request_id = '${S1}' and kind = 'receipt') || array(select id from public.job_photos where request_id = '${S1}' and kind = 'receipt')` }) },
      { name: 'falsche Pauschale', as: 'service_role', sql: cancelCall(U.pa, 'aal2', S1, 'scope_impossible', CALL_OUT - 1, { photos: RECEIPTS(S1) }) },
      { name: 'Pauschale ohne Gebührenzeile bei Beleg', as: 'service_role', sql: cancelCall(U.pa, 'aal2', S1, 'scope_impossible', 0, { photos: RECEIPTS(S1) }) },
      { name: 'S1 unverändert', sql: `=${status(S1)} || ':' || ${journal(S1)}` },
      { name: 'Storno S1 mit Pauschale', as: 'service_role', sql: cancelCall(U.pa, 'aal2', S1, 'scope_impossible', CALL_OUT, { photos: RECEIPTS(S1) }) },
      { name: 'S1 Status', sql: `=${status(S1)}` },
      { name: 'S1 Pauschale', sql: `=(select concat_ws(':', total_cents, reverses_entry_id is null, revision_id = (select current_revision from public.service_requests where id = '${S1}')) from public.commission_entries where request_id = '${S1}' and kind = 'cancellation_fee')` },
      { name: 'S1 Gebührensumme', sql: `=${feeSum(S1)}` },
      { name: 'S1 Auszahlungssumme', sql: `=(select sum(payout_cents) from public.commission_entries where request_id = '${S1}')` },
      { name: 'S1 Zeilen', sql: `=${journal(S1)}` },
      { name: 'S1 keine Folge', sql: `=${count(`public.service_requests where reissued_from = '${S1}'`)}` },
      { name: 'S1 Mail mit Pauschale', sql: `=${count(`public.outbox where kind = 'partner_cancelled_fee' and recipient_kind = 'customer' and request_id = '${S1}'`)} || ':' || ${count(`public.outbox where kind = 'partner_cancelled' and request_id = '${S1}'`)}` },
      { name: 'S1 Audit mit Belegen', sql: `=(select jsonb_array_length(detail -> 'photos') from public.audit_log where action = 'cancel_by_partner' and entity_id = '${S1}')` },
      { name: 'S1 Zuordnung', sql: `=(select cancel_reason from public.assignments where request_id = '${S1}')` },
      { name: 'S1 Firma sieht Pauschale', as: 'authenticated', claims: A2(U.pa), sql: `=${journal(S1, `kind = 'cancellation_fee'`)}` },
      { name: 'S1 Kunde sieht kein Journal', as: 'authenticated', claims: A1(U.cust), sql: `=${journal(S1)}` },
      // scope_impossible ohne Beleg (S9h2-2, Beks): kostenlos, trotzdem Weitervermittlung, zählt im Qualitätszähler
      { name: 'Storno S3 ohne Beleg', as: 'service_role', sql: cancelCall(U.pa, 'aal2', S3, 'scope_impossible', 0) },
      { name: 'S3 Gebührensumme', sql: `=${feeSum(S3)}` },
      { name: 'S3 keine Pauschale', sql: `=${journal(S3, `kind = 'cancellation_fee'`)}` },
      { name: 'S3 Folge', sql: `=${count(`public.service_requests where reissued_from = '${S3}' and status = 'requested' and cancel_fee_waived`)}` },
      { name: 'S3 Mails', sql: `=${count(`public.outbox where kind = 'request_reissued' and recipient_id = '${U.cust}' and request_id = ${follow(S3)}`)} || ':' || ${count(`public.outbox where kind in ('partner_cancelled', 'partner_cancelled_fee') and request_id = '${S3}'`)}` },
      { name: 'S3 Zähler', sql: `=(select ended_reason::text || ':' || cancel_reason from public.assignments where request_id = '${S3}')` },
      // M2: nach der Meldung „nicht stattgefunden“ entscheidet admin, der Partner kann nicht zuvorkommen
      { name: 'S6 Meldung', sql: `update public.service_requests set not_done_reported_at = now() where id = '${S6}'` },
      { name: 'S6 Basis', as: 'service_role', sql: `perform * from ${basisOf(U.pb, 'aal2', S6)}` },
      { name: 'S6 Storno', as: 'service_role', sql: cancelCall(U.pb, 'aal2', S6, 'other', 0) },
      { name: 'S6 unverändert', sql: `=${status(S6)} || ':' || ${journal(S6)}` },
      // N4: findet die Folgeanfrage sofort niemanden, kommt nur die Absage (plus request_unmatched der Folgeanfrage)
      { name: 'Firma b gesperrt', sql: `perform public.admin_set_partner_status('${U.adm}', ${P('b')}, 'suspended', 'Grund für den Test der Weitervermittlung')` },
      { name: 'Storno S7', as: 'service_role', sql: cancelCall(U.pa, 'aal2', S7, 'other', 0) },
      { name: 'S7 Folge unmatched', sql: `=(select status::text from public.service_requests where reissued_from = '${S7}')` },
      { name: 'S7 Mails', sql: `=${count(`public.outbox where kind = 'partner_cancelled' and request_id = '${S7}'`)} || ':' || ${count(`public.outbox where kind = 'request_reissued' and request_id = ${follow(S7)}`)} || ':' || ${count(`public.outbox where kind = 'request_unmatched' and request_id = (select id from public.service_requests where reissued_from = '${S7}')`)}` },
    ]
    const r = probes(setup, steps)
    err(r['ohne abgelehnten Nachtrag'], 'call_out_not_allowed')
    err(r['fremde Belege'], 'receipt_required')
    err(r['Belege anderer Auftrag'], 'receipt_required')
    err(r['zu viele Belege'], 'receipt_required')
    err(r['falsche Pauschale'], 'amount_mismatch')
    err(r['Pauschale ohne Gebührenzeile bei Beleg'], 'amount_mismatch')
    val(r['S1 unverändert'], 'accepted:1')
    expect(r['Storno S1 mit Pauschale']).toBe('ok')
    val(r['S1 Status'], 'cancelled_by_partner')
    val(r['S1 Pauschale'], `${CALL_OUT}:t:t`)
    const fee = splitFee(CALL_OUT, { tiers: RT.tiers, vatRate: RT.vr })
    val(r['S1 Gebührensumme'], String(fee.feeCents))
    val(r['S1 Auszahlungssumme'], String(fee.payoutCents))
    val(r['S1 Zeilen'], '3')
    val(r['S1 keine Folge'], '0')
    val(r['S1 Mail mit Pauschale'], '1:0')
    val(r['S1 Audit mit Belegen'], '1')
    val(r['S1 Zuordnung'], 'scope_impossible')
    val(r['S1 Firma sieht Pauschale'], '1')
    val(r['S1 Kunde sieht kein Journal'], '0')
    val(r['S3 Folge'], '1')
    val(r['S3 Mails'], '1:0')
    val(r['S3 Zähler'], 'cancelled_by_partner:scope_impossible')
    err(r['S6 Basis'], 'under_review')
    err(r['S6 Storno'], 'under_review')
    val(r['S6 unverändert'], 'accepted:1')
    expect(r['Firma b gesperrt']).toBe('ok')
    expect(r['Storno S7']).toBe('ok')
    val(r['S7 Folge unmatched'], 'unmatched')
    val(r['S7 Mails'], '1:0:1')
    expect(r['Storno S3 ohne Beleg']).toBe('ok')
    val(r['S3 Gebührensumme'], '0')
    val(r['S3 keine Pauschale'], '0')
  })

  // bl1 (OFFEN rs1-1): die Oberfläche sagt der Firma bei jedem Festangebot „kein Nachtrag und keine Pauschale bei Absage“ (ENTSCHEIDUNGEN Nr. 196, geld.md: die
  // Pauschale gibt es nur nach einem abgelehnten Nachtrag). Erwartung aus der Vorgabe, nicht aus dem Ist-Wert der Funktionen.
  it('Festangebot (partner_offer) nach Terminbeginn: scope_impossible ohne Pauschale, auch mit Belegen; kein Nachtrag', () => {
    const [F1] = [newId()]
    const setup = `${BASE} ${accepted(F1, "now() - interval '2 hours'")} ${receipt(F1)}`
    const noTrg = (sql: string) => `alter table public.price_revisions disable trigger user; ${sql}; alter table public.price_revisions enable trigger user`
    const steps: Step[] = [
      { name: 'Quelle Festangebot', sql: noTrg(`update public.price_revisions set source = 'partner_offer' where id = ${curRev(F1)}`) },
      { name: 'Basis ohne Pauschale', as: 'service_role', sql: `=(select call_out_cents from ${basisOf(U.pa, 'aal2', F1, 'scope_impossible')})` },
      { name: 'Nachtrag', as: 'service_role', sql: `perform public.propose_change('${U.pa}', 'aal2', '${F1}', ${curRev(F1)}, '{"hours":6}'::jsonb, 80000, ${RECEIPTS(F1)})` },
      { name: 'Nachtragsgrundlage', as: 'service_role', sql: `perform * from public.propose_change_basis('${U.pa}', 'aal2', '${F1}')` },
      { name: 'Pauschale mit Belegen', as: 'service_role', sql: cancelCall(U.pa, 'aal2', F1, 'scope_impossible', CALL_OUT, { photos: RECEIPTS(F1) }) },
      { name: 'unverändert', sql: `=${status(F1)} || ':' || ${journal(F1)}` },
      { name: 'Absage', as: 'service_role', sql: cancelCall(U.pa, 'aal2', F1, 'scope_impossible', 0) },
      { name: 'Status', sql: `=${status(F1)}` },
      { name: 'keine Pauschale', sql: `=${journal(F1, `kind = 'cancellation_fee'`)}` },
      { name: 'Gebührensumme', sql: `=${feeSum(F1)}` },
    ]
    const r = probes(setup, steps)
    expect(r['Quelle Festangebot']).toBe('ok')
    val(r['Basis ohne Pauschale'], '0')
    err(r['Nachtrag'], 'change_not_allowed')
    err(r['Nachtragsgrundlage'], 'change_not_allowed')
    err(r['Pauschale mit Belegen'], 'call_out_not_allowed')
    val(r['unverändert'], 'accepted:1')
    expect(r['Absage']).toBe('ok')
    val(r['Status'], 'cancelled_by_partner')
    val(r['keine Pauschale'], '0')
    val(r['Gebührensumme'], '0')
  })

  it('ab Terminbeginn nur scope_impossible (S9h2-3, Beks), sonst too_late_for_reason', () => {
    const [L1, L3, L4] = [newId(), newId(), newId()]
    const setup = `${BASE} ${accepted(L1, "now() - interval '2 hours'")} ${accepted(L3, "now() + interval '1 hour'")}
      ${accepted(L4, "now() - interval '2 hours'")}
      select private.set_request_status('${L4}', 'in_progress', null, 'partner');`
    const steps: Step[] = [
      { name: 'L1 other', as: 'service_role', sql: cancelCall(U.pa, 'aal2', L1, 'other', 0) },
      { name: 'L1 unavailable', as: 'service_role', sql: cancelCall(U.pa, 'aal2', L1, 'unavailable', 0) },
      { name: 'L1 ungültiger Grund zuerst', as: 'service_role', sql: cancelCall(U.pa, 'aal2', L1, 'bogus', 0) },
      { name: 'L1 unverändert', sql: `=${status(L1)} || ':' || ${journal(L1)}` },
      { name: 'L1 scope_impossible', as: 'service_role', sql: cancelCall(U.pa, 'aal2', L1, 'scope_impossible', 0) },
      { name: 'L1 Status', sql: `=${status(L1)}` },
      { name: 'L1 keine Folge (Termin vorbei)', sql: `=${count(`public.service_requests where reissued_from = '${L1}'`)}` },
      { name: 'L1 Mail', sql: `=${count(`public.outbox where kind = 'partner_cancelled' and request_id = '${L1}'`)}` },
      { name: 'L4 in_progress other', as: 'service_role', sql: cancelCall(U.pa, 'aal2', L4, 'other', 0) },
      { name: 'L4 unverändert', sql: `=${status(L4)}` },
      { name: 'L3 vor Terminbeginn other', as: 'service_role', sql: cancelCall(U.pa, 'aal2', L3, 'other', 0) },
      { name: 'L3 Status', sql: `=${status(L3)}` },
    ]
    const r = probes(setup, steps)
    err(r['L1 other'], 'too_late_for_reason')
    err(r['L1 unavailable'], 'too_late_for_reason')
    err(r['L1 ungültiger Grund zuerst'], 'reason_required')
    val(r['L1 unverändert'], 'accepted:1')
    expect(r['L1 scope_impossible']).toBe('ok')
    val(r['L1 Status'], 'cancelled_by_partner')
    val(r['L1 keine Folge (Termin vorbei)'], '0')
    val(r['L1 Mail'], '1')
    err(r['L4 in_progress other'], 'too_late_for_reason')
    val(r['L4 unverändert'], 'in_progress')
    expect(r['L3 vor Terminbeginn other']).toBe('ok')
    val(r['L3 Status'], 'cancelled_by_partner')
  })
})
