// Storno durch den Kunden (S9h-1, Migration 0044): cancel_by_customer_basis, cancel_by_customer (T12), Stornostufen aus dem Snapshot.
// Alles läuft als Rollback-Proben (`probes`), es bleibt nichts zurück. Die Stornogebühr rechnet `splitFee` aus @pricing.
import { describe, expect, it } from 'vitest'
import { splitChange, splitFee } from '@pricing'
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
const LATE = 34481 // round_half_up(68961 × 50 %)

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pb: newId() }
const USERS = insertUsers(Object.values(U))
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${USERS} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}`

const TERMS = '"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":6900,"termsHash":"x"}'
const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const status = (req: string) => `(select status::text from public.service_requests where id = '${req}')`
const count = (sql: string) => `(select count(*) from ${sql})`

/** Auftrag samt Revision 1 (mit Stornostufen), Verteilung und Annahme durch Firma a. `termin` ist ein SQL-Ausdruck. */
function accepted(id: string, termin: string, terms = true, by: 'a' | 'b' = 'a'): string {
  const snap = `{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[]${terms ? `,${TERMS}` : ''}}`
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');
    select public.partner_accept('${by === 'a' ? U.pa : U.pb}', ${LID(id, by)},${rev(id)}, ${RT.s.payoutCents}, ${RT.fr}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.frv}, ${RT.vrv});`
}

/** Aufruf von cancel_by_customer; die Stornogebühr (Basis `base`) rechnet splitFee, `over` überschreibt einzelne Argumente. */
function cancelCall(actor: string, req: string, base: number, over: { base?: number; rate?: number; feeShift?: number } = {}): string {
  const s = splitFee(base, { feeRate: RT.fr, vatRate: RT.vr })
  const fee = s.feeCents + (over.feeShift ?? 0)
  return `perform public.cancel_by_customer('${actor}', '${req}', ${over.base ?? base}, ${over.rate ?? RT.fr}, ${RT.vr}, ${fee}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.frv}, ${RT.vrv})`
}
const basisOf = (actor: string, req: string) => `public.cancel_by_customer_basis('${actor}', '${req}')`

const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const val = (v: string | undefined, want: string) => expect(v, String(v)).toBe(`= ${want}`)

const journal = (req: string, where = 'true') => count(`public.commission_entries where request_id = '${req}' and ${where}`)
const feeSum = (req: string) => `(select coalesce(sum(fee_cents), 0) from public.commission_entries where request_id = '${req}')`

describe('cancel_by_customer (T12)', () => {
  it('Stufen frei, 50 %, 100 %, waived: Basis, Gegenbuchung aller Zeilen, Gebührenzeile, Folgen', () => {
    const [RF, RL, RT2, RW, RQ, RD, RN] = [newId(), newId(), newId(), newId(), newId(), newId(), newId()]
    const setup = `${BASE} ${accepted(RF, "now() + interval '5 days'")} ${accepted(RL, "now() + interval '24 hours'")} ${accepted(RT2, 'now()')} ${accepted(RW, 'now()')} ${accepted(RD, "now() + interval '5 days'", true, 'b')} ${accepted(RN, "now() + interval '5 days'", false, 'b')}
      select set_config('app.l_rl', ${LID(RL, 'a')}::text, true);
      update public.service_requests set cancel_fee_waived = true where id = '${RW}';
      select private.set_request_status('${RT2}', 'in_progress', null, 'partner');
      select private.set_request_status('${RD}', 'in_progress', null, 'partner');
      select private.set_request_status('${RD}', 'completed', null, 'partner');
      insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
        values ('${RQ}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, now() + interval '5 days', now() + interval '1 day');
      insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
        values ('${RQ}', 1, 'submit', '{}', '{"kind":"price","totalCents":100,"lowCents":100,"highCents":100,"lines":[],${TERMS}}', 1, 100, 100, 100);
      update public.service_requests set current_revision = ${rev(RQ)} where id = '${RQ}';`
    const base = (req: string) => `=(select fee_base_cents from ${basisOf(U.cust, req)})`
    const cnt = (kind: string, req: string) => `=${journal(req, `kind = '${kind}'`)}`
    const steps: Step[] = [
      // Basis je Stufe
      { name: 'Basis frei', as: 'service_role', sql: base(RF) },
      { name: 'Basis 50 %', as: 'service_role', sql: base(RL) },
      { name: 'Basis Termintag', as: 'service_role', sql: base(RT2) },
      { name: 'Basis waived', as: 'service_role', sql: base(RW) },
      { name: 'Basis Summe', as: 'service_role', sql: `=(select total_cents from ${basisOf(U.cust, RL)})` },
      { name: 'Basis ohne Stornostufen', as: 'service_role', sql: `perform * from ${basisOf(U.cust, RN)}` },
      { name: 'Basis fremder Kunde', as: 'service_role', sql: `perform * from ${basisOf(U.cust2, RL)}` },
      { name: 'Basis Partner', as: 'service_role', sql: `perform * from ${basisOf(U.pa, RL)}` },
      { name: 'Basis admin', as: 'service_role', sql: `perform * from ${basisOf(U.adm, RL)}` },
      { name: 'Basis noch nicht angenommen', as: 'service_role', sql: `perform * from ${basisOf(U.cust, RQ)}` },
      { name: 'Basis abgeschlossen', as: 'service_role', sql: `perform * from ${basisOf(U.cust, RD)}` },
      // Verweigerungen auf RL, danach bleibt alles unverändert
      { name: 'falsche Basis', as: 'service_role', sql: cancelCall(U.cust, RL, LATE - 1) },
      { name: 'Basis ohne Gebühr bei 50 %', as: 'service_role', sql: cancelCall(U.cust, RL, 0) },
      { name: 'Basis aus fremder Stufe', as: 'service_role', sql: cancelCall(U.cust, RL, TOTAL) },
      { name: 'falsche Aufteilung', as: 'service_role', sql: cancelCall(U.cust, RL, LATE, { feeShift: 5 }) },
      { name: 'falscher Satz', as: 'service_role', sql: cancelCall(U.cust, RL, LATE, { rate: 0.2 }) },
      { name: 'fremder Kunde', as: 'service_role', sql: cancelCall(U.cust2, RL, LATE) },
      { name: 'Partner als Akteur', as: 'service_role', sql: cancelCall(U.pa, RL, LATE) },
      { name: 'noch nicht angenommen', as: 'service_role', sql: cancelCall(U.cust, RQ, 0) },
      { name: 'abgeschlossen', as: 'service_role', sql: cancelCall(U.cust, RD, 0) },
      { name: 'Stornostufen fehlen', as: 'service_role', sql: cancelCall(U.cust, RN, 0) },
      { name: 'authenticated', as: 'authenticated', claims: A1(U.cust), sql: cancelCall(U.cust, RL, LATE) },
      { name: 'authenticated Basis', as: 'authenticated', claims: A1(U.cust), sql: `perform * from ${basisOf(U.cust, RL)}` },
      { name: 'anon', as: 'anon', sql: cancelCall(U.cust, RL, LATE) },
      { name: 'direktes UPDATE des Status', as: 'authenticated', claims: A1(U.cust), sql: `update public.service_requests set status = 'cancelled_by_customer' where id = '${RL}'` },
      { name: 'RL unverändert', sql: `=${status(RL)} || ':' || ${journal(RL)}` },
      // Erfolg RF (kostenlos): Gegenbuchung, keine Gebührenzeile
      { name: 'Storno RF', as: 'service_role', sql: cancelCall(U.cust, RF, 0) },
      { name: 'RF Status', sql: `=${status(RF)}` },
      { name: 'RF Gegenbuchung', sql: cnt('cancellation', RF) },
      { name: 'RF keine Gebührenzeile', sql: cnt('cancellation_fee', RF) },
      { name: 'RF Gebührensumme 0', sql: `=${feeSum(RF)}` },
      { name: 'RF Gegenbuchung verweist auf booking', sql: `=${journal(RF, `kind = 'cancellation' and reverses_entry_id = (select id from public.commission_entries where request_id = '${RF}' and kind = 'booking')`)}` },
      { name: 'RF Zuordnung', sql: `=(select ended_reason::text from public.assignments where request_id = '${RF}')` },
      { name: 'RF Ereignis', sql: `=${count(`public.status_events where request_id = '${RF}' and to_status = 'cancelled_by_customer' and actor_role = 'customer' and actor_id = '${U.cust}'`)}` },
      { name: 'RF Audit', sql: `=${count(`public.audit_log where action = 'cancel_by_customer' and entity_id = '${RF}' and actor_id = '${U.cust}'`)}` },
      { name: 'RF Mail an die Firma', sql: `=${count(`public.outbox where kind = 'request_cancelled' and request_id = '${RF}' and recipient_kind = 'partner' and recipient_id = ${P('a')}`)}` },
      { name: 'RF keine Mail an den Kunden', sql: `=${count(`public.outbox where kind = 'request_cancelled' and request_id = '${RF}' and recipient_kind = 'customer'`)}` },
      { name: 'RF Wiederholung', as: 'service_role', sql: cancelCall(U.cust, RF, 0) },
      { name: 'RF Basis nach Storno', as: 'service_role', sql: `perform * from ${basisOf(U.cust, RF)}` },
      // Erfolg RL (50 %)
      { name: 'Storno RL', as: 'service_role', sql: cancelCall(U.cust, RL, LATE) },
      { name: 'RL Status', sql: `=${status(RL)}` },
      { name: 'RL Gebührenzeile', sql: cnt('cancellation_fee', RL) },
      { name: 'RL Gebührenzeile Basis', sql: `=(select total_cents from public.commission_entries where request_id = '${RL}' and kind = 'cancellation_fee')` },
      { name: 'RL Gebührenzeile ohne Verweis', sql: `=(select reverses_entry_id is null from public.commission_entries where request_id = '${RL}' and kind = 'cancellation_fee')` },
      { name: 'RL Gebührensumme', sql: `=${feeSum(RL)}` },
      { name: 'RL Auszahlungssumme', sql: `=(select sum(payout_cents) from public.commission_entries where request_id = '${RL}')` },
      { name: 'RL Firma liest 3 Zeilen', as: 'authenticated', claims: A2(U.pa), sql: `=${journal(RL)}` },
      { name: 'RL Firma sieht Listing weiter', as: 'authenticated', claims: A2(U.pa), sql: `=${count(`public.job_listings where id = current_setting('app.l_rl')::uuid`)}` },
      { name: 'RL Kunde liest kein Journal', as: 'authenticated', claims: A1(U.cust), sql: `=${journal(RL)}` },
      { name: 'RL fremde Firma liest nichts', as: 'authenticated', claims: A2(U.pb), sql: `=${journal(RL)}` },
      // Erfolg RT2 (in_progress, Termintag, 100 %) und RW (waived trotz Termintag)
      { name: 'Storno RT2', as: 'service_role', sql: cancelCall(U.cust, RT2, TOTAL) },
      { name: 'RT2 Status', sql: `=${status(RT2)}` },
      { name: 'RT2 Gebührenzeile Basis', sql: `=(select total_cents from public.commission_entries where request_id = '${RT2}' and kind = 'cancellation_fee')` },
      { name: 'RT2 Gebührensumme', sql: `=${feeSum(RT2)}` },
      { name: 'Storno RW', as: 'service_role', sql: cancelCall(U.cust, RW, 0) },
      { name: 'RW keine Gebührenzeile', sql: cnt('cancellation_fee', RW) },
      { name: 'RW Gebührensumme', sql: `=${feeSum(RW)}` },
    ]
    const r = probes(setup, steps)
    val(r['Basis frei'], '0')
    val(r['Basis 50 %'], String(LATE))
    val(r['Basis Termintag'], String(TOTAL))
    val(r['Basis waived'], '0')
    val(r['Basis Summe'], String(TOTAL))
    err(r['Basis ohne Stornostufen'], 'terms_missing')
    err(r['Basis fremder Kunde'], 'not_found')
    err(r['Basis Partner'], 'not_found')
    err(r['Basis admin'], 'not_found')
    err(r['Basis noch nicht angenommen'], 'invalid_transition')
    err(r['Basis abgeschlossen'], 'invalid_transition')
    err(r['falsche Basis'], 'amount_mismatch')
    err(r['Basis ohne Gebühr bei 50 %'], 'amount_mismatch')
    err(r['Basis aus fremder Stufe'], 'amount_mismatch')
    err(r['falsche Aufteilung'], 'amount_mismatch')
    err(r['falscher Satz'], 'fee_basis_changed')
    err(r['fremder Kunde'], 'not_found')
    err(r['Partner als Akteur'], 'not_found')
    err(r['noch nicht angenommen'], 'invalid_transition')
    err(r['abgeschlossen'], 'invalid_transition')
    err(r['Stornostufen fehlen'], 'terms_missing')
    err(r['authenticated'], '42501')
    err(r['authenticated Basis'], '42501')
    err(r['anon'], '42501')
    err(r['direktes UPDATE des Status'], '42501')
    val(r['RL unverändert'], 'accepted:1')

    expect(r['Storno RF']).toBe('ok')
    val(r['RF Status'], 'cancelled_by_customer')
    val(r['RF Gegenbuchung'], '1')
    val(r['RF keine Gebührenzeile'], '0')
    val(r['RF Gebührensumme 0'], '0')
    val(r['RF Gegenbuchung verweist auf booking'], '1')
    val(r['RF Zuordnung'], 'cancelled_by_customer')
    val(r['RF Ereignis'], '1')
    val(r['RF Audit'], '1')
    val(r['RF Mail an die Firma'], '1')
    val(r['RF keine Mail an den Kunden'], '0')
    err(r['RF Wiederholung'], 'invalid_transition')
    err(r['RF Basis nach Storno'], 'invalid_transition')

    expect(r['Storno RL']).toBe('ok')
    val(r['RL Status'], 'cancelled_by_customer')
    val(r['RL Gebührenzeile'], '1')
    val(r['RL Gebührenzeile Basis'], String(LATE))
    val(r['RL Gebührenzeile ohne Verweis'], 'true')
    const lateFee = splitFee(LATE, { feeRate: RT.fr, vatRate: RT.vr })
    val(r['RL Gebührensumme'], String(lateFee.feeCents))
    val(r['RL Auszahlungssumme'], String(lateFee.payoutCents))
    val(r['RL Firma liest 3 Zeilen'], '3')
    val(r['RL Firma sieht Listing weiter'], '1')
    val(r['RL Kunde liest kein Journal'], '0')
    val(r['RL fremde Firma liest nichts'], '0')

    expect(r['Storno RT2']).toBe('ok')
    val(r['RT2 Status'], 'cancelled_by_customer')
    val(r['RT2 Gebührenzeile Basis'], String(TOTAL))
    val(r['RT2 Gebührensumme'], String(splitFee(TOTAL, { feeRate: RT.fr, vatRate: RT.vr }).feeCents))
    expect(r['Storno RW']).toBe('ok')
    val(r['RW keine Gebührenzeile'], '0')
    val(r['RW Gebührensumme'], '0')
  })
})

// S9h-1 Abnahme (M1, M2): Nachtrag und Storno, offener Nachtrag, Firma in payment_hold, Meldung „nicht stattgefunden“
describe('cancel_by_customer: Nachtrag, Firma-Status, Prüfung', () => {
  const s80 = splitChange(80000, { feeRate: RT.fr, vatRate: RT.vr }, splitFee(TOTAL, { feeRate: RT.fr, vatRate: RT.vr }))
  const receipt = (req: string) =>
    `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
       values ('${req}', 'receipt', ${P('a')}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());`
  const cur = (req: string) => `(select current_revision from public.service_requests where id = '${req}')`
  const propose = (req: string) =>
    `select public.propose_change('${U.pa}', 'aal2', '${req}', ${cur(req)}, '{"hours":6}'::jsonb, 80000, array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt'));`
  const OPEN = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and source = 'change_order' and status = 'proposed')`
  const decide = (req: string) =>
    `select public.decide_change('${U.cust}', ${OPEN(req)}, true, 80000, ${RT.fr}, ${RT.vr}, ${s80.feeCents}, ${s80.feeNetCents}, ${s80.feeVatCents}, ${s80.payoutCents}, ${RT.frv}, ${RT.vrv});`
  const withChange = (req: string, termin: string) => `${accepted(req, termin)} ${receipt(req)} ${propose(req)} ${decide(req)}`

  it('angenommener Nachtrag: beide Zeilen gegengebucht (je mit eigener Revision), Gebühr auf den neuen Gesamtpreis; offener Nachtrag endet', () => {
    const [RC, RC2, RO] = [newId(), newId(), newId()]
    const setup = `${BASE} ${withChange(RC, "now() + interval '5 days'")} ${withChange(RC2, 'now()')} ${accepted(RO, "now() + interval '5 days'")} ${receipt(RO)} ${propose(RO)}`
    const revStatus = (req: string) => `=(select status from public.price_revisions where request_id = '${req}' and source = 'change_order')`
    const steps: Step[] = [
      { name: 'Basis nach Nachtrag', as: 'service_role', sql: `=(select total_cents from ${basisOf(U.cust, RC2)})` },
      { name: 'Basis Termintag mit Nachtrag', as: 'service_role', sql: `=(select fee_base_cents from ${basisOf(U.cust, RC2)})` },
      { name: 'Storno RC frei', as: 'service_role', sql: cancelCall(U.cust, RC, 0) },
      { name: 'RC Zeilen', sql: `=${journal(RC)}` },
      { name: 'RC Gegenbuchungen', sql: `=${journal(RC, `kind = 'cancellation'`)}` },
      { name: 'RC Gegenbuchung mit eigener Revision', sql: `=(select count(*) from public.commission_entries c where c.request_id = '${RC}' and c.kind = 'cancellation' and c.revision_id = (select o.revision_id from public.commission_entries o where o.id = c.reverses_entry_id))` },
      { name: 'RC Summen', sql: `=(select concat_ws(',', sum(total_cents), sum(fee_cents), sum(fee_net_cents), sum(fee_vat_cents), sum(payout_cents)) from public.commission_entries where request_id = '${RC}')` },
      { name: 'Storno RC2 Termintag', as: 'service_role', sql: cancelCall(U.cust, RC2, 80000) },
      { name: 'RC2 Gebührenzeile Basis', sql: `=(select total_cents from public.commission_entries where request_id = '${RC2}' and kind = 'cancellation_fee')` },
      { name: 'RC2 Gebührensumme', sql: `=(select sum(fee_cents) from public.commission_entries where request_id = '${RC2}')` },
      { name: 'RO Nachtrag vorher', sql: revStatus(RO) },
      { name: 'Storno RO', as: 'service_role', sql: cancelCall(U.cust, RO, 0) },
      { name: 'RO Nachtrag nachher', sql: revStatus(RO) },
      { name: 'RO Mail Nachtrag abgelaufen', sql: `=${count(`public.outbox where kind = 'change_expired' and request_id = '${RO}'`)}` },
      { name: 'RO Zeilen', sql: `=${journal(RO)}` },
    ]
    const r = probes(setup, steps)
    val(r['Basis nach Nachtrag'], '80000')
    val(r['Basis Termintag mit Nachtrag'], '80000')
    expect(r['Storno RC frei']).toBe('ok')
    val(r['RC Zeilen'], '4')
    val(r['RC Gegenbuchungen'], '2')
    val(r['RC Gegenbuchung mit eigener Revision'], '2')
    val(r['RC Summen'], '0,0,0,0,0')
    expect(r['Storno RC2 Termintag']).toBe('ok')
    val(r['RC2 Gebührenzeile Basis'], '80000')
    val(r['RC2 Gebührensumme'], String(splitFee(80000, { feeRate: RT.fr, vatRate: RT.vr }).feeCents))
    val(r['RO Nachtrag vorher'], 'proposed')
    expect(r['Storno RO']).toBe('ok')
    val(r['RO Nachtrag nachher'], 'expired')
    val(r['RO Mail Nachtrag abgelaufen'], '1')
    val(r['RO Zeilen'], '2')
  })

  it('Firma in payment_hold oder suspended: Storno gelingt; nach „nicht stattgefunden“ verweigert (under_review)', () => {
    const [RH, RS, RU] = [newId(), newId(), newId()]
    const hold = (st: string) => `perform public.admin_set_partner_status('${U.adm}', ${P('b')}, '${st}', 'Grund ${st} im Storno-Test')`
    const setup = `${BASE} ${accepted(RH, "now() + interval '5 days'", true, 'b')} ${accepted(RS, "now() + interval '5 days'", true, 'b')} ${accepted(RU, "now() - interval '2 hours'")}
      update public.service_requests set not_done_reported_at = now() where id = '${RU}';`
    const steps: Step[] = [
      { name: 'Firma payment_hold', sql: hold('payment_hold') },
      { name: 'Storno RH', as: 'service_role', sql: cancelCall(U.cust, RH, 0) },
      { name: 'RH Status', sql: `=${status(RH)}` },
      { name: 'Firma suspended', sql: hold('suspended') },
      { name: 'Storno RS', as: 'service_role', sql: cancelCall(U.cust, RS, 0) },
      { name: 'RS Status', sql: `=${status(RS)}` },
      { name: 'RS Gegenbuchung', sql: `=${journal(RS, `kind = 'cancellation'`)}` },
      { name: 'Basis RU', as: 'service_role', sql: `perform * from ${basisOf(U.cust, RU)}` },
      { name: 'Storno RU', as: 'service_role', sql: cancelCall(U.cust, RU, TOTAL) },
      { name: 'RU unverändert', sql: `=${status(RU)} || ':' || ${journal(RU)}` },
    ]
    const r = probes(setup, steps)
    expect(r['Firma payment_hold']).toBe('ok')
    expect(r['Storno RH']).toBe('ok')
    val(r['RH Status'], 'cancelled_by_customer')
    expect(r['Firma suspended']).toBe('ok')
    expect(r['Storno RS']).toBe('ok')
    val(r['RS Status'], 'cancelled_by_customer')
    val(r['RS Gegenbuchung'], '1')
    err(r['Basis RU'], 'under_review')
    err(r['Storno RU'], 'under_review')
    val(r['RU unverändert'], 'accepted:1')
  })

  it('Wertebereich der Stornoschlüssel: Prozent 0 bis 100, ganze Stunden und Tage (N1)', () => {
    const ins = (key: string, v: string) =>
      `insert into public.platform_settings (key, version, value, effective_from) values ('${key}', 99, ${v}, '2099-01-01')`
    const steps: Step[] = [
      { name: 'Prozent 101', sql: ins('cancel_late_percent', '101') },
      { name: 'Prozent -1', sql: ins('cancel_full_percent', '-1') },
      { name: 'Stunden 1.5', sql: ins('cancel_free_hours', '1.5') },
      { name: 'Tage 1.5', sql: ins('cancel_full_days_before', '1.5') },
      { name: 'Tage -1', sql: ins('cancel_full_days_before', '-1') },
      { name: 'gültig', sql: ins('cancel_late_percent', '40') },
    ]
    const r = probes('select 1', steps)
    for (const k of ['Prozent 101', 'Prozent -1', 'Stunden 1.5', 'Tage 1.5', 'Tage -1']) err(r[k], '23514')
    expect(r['gültig']).toBe('ok')
  })
})
