// Provisionsjournal commission_entries (S9b-4, Migration 0028). Journalzeilen sind unlöschbar (append_only, ON DELETE RESTRICT):
// jede Prüfung läuft als Rollback-Probe, es bleibt nichts zurück. Beträge rechnet `splitFee` aus @pricing, nie der Test selbst.
import { describe, expect, it } from 'vitest'
import { negateSplit, splitFee } from '@pricing'
import { ownerSql, probes, type Step } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

type Split = ReturnType<typeof splitFee>
type Kind = 'booking' | 'change' | 'cancellation' | 'cancellation_fee' | 'correction'
type Book = {
  p: string // Firmenschlüssel (app.p_<p>)
  req: string
  kind?: Kind
  rev?: string // SQL-Ausdruck der Revision, sonst Revision 1
  of?: string | null // Schlüssel der gegengebuchten Zeile (app.e_<of>)
  s: Split
  fr?: number | null // undefined = aktueller Satz, null = leer (die Funktion nimmt ihn aus der booking-Zeile)
  vr?: number | null
  frv?: number | null
  vrv?: number | null
  save?: string
}

const TODAY = "(now() at time zone 'Europe/Vienna')::date"
function rates() {
  const cur = (key: string, col: string) =>
    `(select ${col} from public.platform_settings where key = '${key}' and effective_from <= ${TODAY} order by effective_from desc, version desc limit 1)`
  const r = ownerSql(
    `select ${cur('fee_rate', 'value::float8')} as fr, ${cur('fee_vat_rate', 'value::float8')} as vr, ${cur('fee_rate', 'version')} as frv, ${cur('fee_vat_rate', 'version')} as vrv`,
  )[0] as { fr: number; vr: number; frv: number; vrv: number }
  return { ...r, split: (total: number) => splitFee(total, { feeRate: r.fr, vatRate: r.vr }) }
}
type Rates = ReturnType<typeof rates>

const U = { adm: newId(), cust: newId(), pa: newId(), pb: newId(), pend: newId(), ph: newId() }
const USERS = insertUsers(Object.values(U))
const FIRM = {
  a: firm(U.pa, 'a', 'active', U.adm),
  b: firm(U.pb, 'b', 'active', U.adm),
  pend: firm(U.pend, 'pend', 'pending', U.adm),
  h: firm(U.ph, 'h', 'active', U.adm),
}
const BASE = (...keys: (keyof typeof FIRM)[]) => `${USERS} ${grantAdmin(U.adm)} ${keys.map((k) => FIRM[k]).join(' ')}`
const statusCall = (key: string, status: string) => `public.admin_set_partner_status('${U.adm}', ${P(key)}, '${status}', 'Begründung für den Test ${status}')`
const neg = (s: Split): Split => negateSplit(s)

const rev1 = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const rev2 = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 2)`

/** Auftrag samt Revision 1 (Festpreis, oder Spanne mit total = null) und gesetztem Zeiger. */
function request(id: string, total: number | null = 68961): string {
  const snap = total === null ? '{"kind":"price","lowCents":100,"highCents":200,"lines":[]}' : `{"kind":"price","totalCents":${total},"lowCents":${total},"highCents":${total},"lines":[]}`
  const vals = total === null ? 'null, 100, 200' : `${total}, ${total}, ${total}`
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', '${total === null ? 'awaiting_offer' : 'requested'}', 1, now() + interval '14 days', now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${vals});
    update public.service_requests set current_revision = ${rev1(id)} where id = '${id}';`
}

/** Änderungs-Revision n = 2 (die Trigger für Revisionen und Zeiger öffnen erst S9h: hier nur im Rollback abgeschaltet). */
const changeOrder = (id: string, total: number) =>
  `set constraints all immediate; alter table public.price_revisions disable trigger guard_revision_insert; alter table public.service_requests disable trigger guard_request_pointer;
   insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, content_hash, total_cents, low_cents, high_cents)
   values ('${id}', 2, 'change_order', '{}', '{"kind":"price","totalCents":${total},"lowCents":${total},"highCents":${total},"lines":[]}', 1, repeat('a', 64), ${total}, ${total}, ${total});
   update public.service_requests set current_revision = ${rev2(id)} where id = '${id}';`

function journal(RT: Rates) {
  const num = (v: number | null | undefined, d: number) => (v === undefined ? String(d) : v === null ? 'null' : String(v))
  const call = (b: Book) =>
    `private.commission_book(${P(b.p)}, '${b.req}', ${b.rev ?? rev1(b.req)}, '${b.kind ?? 'booking'}', ${b.of ? `current_setting('app.e_${b.of}')::uuid` : 'null'}, ${b.s.totalCents}, ${num(b.fr, RT.fr)}, ${num(b.vr, RT.vr)}, ${b.s.feeCents}, ${b.s.feeNetCents}, ${b.s.feeVatCents}, ${b.s.payoutCents}, ${num(b.frv, RT.frv)}, ${num(b.vrv, RT.vrv)})`
  const put = (b: Book) => `set_config('app.e_${b.save ?? 'tmp'}', ${call(b)}::text, true)`
  return {
    /** Schritt (plpgsql) */
    step: (b: Book) => `perform ${put(b)}`,
    /** Setup (SQL) */
    setup: (b: Book) => `select ${put(b)};`,
    /** Schritt, der nur aufruft (ohne ID abzulegen), z. B. für Rechteprüfungen */
    call: (b: Book) => `perform ${call(b)}`,
  }
}

const P0001 = (v: string | undefined, msg: string) => expect(v).toBe(`P0001: ${msg}`)
const check = (v: string | undefined, code: string, part: string) => expect(v?.startsWith(`${code}: `) && v.includes(part), `${part}: ${v}`).toBe(true)
const direct = (RT: Rates, s: Split, o: Record<string, string> = {}) => {
  const v = { p: P('a'), req: '', rev: '', kind: "'booking'", of: 'null', t: s.totalCents, fee: s.feeCents, net: s.feeNetCents, vat: s.feeVatCents, pay: s.payoutCents, rule: "'standard_20'", ...o }
  return `insert into public.commission_entries (partner_id, request_id, revision_id, kind, reverses_entry_id, total_cents, fee_cents, fee_net_cents, fee_vat_cents, payout_cents, fee_rate, fee_vat_rate, vat_rule, price_version, fee_rate_version, fee_vat_rate_version)
    values (${v.p}, '${v.req}', ${v.rev}, ${v.kind}, ${v.of}, ${v.t}, ${v.fee}, ${v.net}, ${v.vat}, ${v.pay}, ${RT.fr}, ${RT.vr}, ${v.rule}, 1, ${RT.frv}, ${RT.vrv})`
}

function deleteFirm(key: string): string {
  const id = P(key)
  return `perform set_config('app.mv_partner_delete', ${id}::text, true);
    delete from public.partner_documents where partner_id = ${id}; delete from public.partner_vat_rules where partner_id = ${id};
    delete from public.partner_regions where partner_id = ${id}; delete from public.partner_categories where partner_id = ${id};
    delete from public.partner_members where partner_id = ${id}; delete from public.partners where id = ${id}`
}

describe('Provisionsjournal', () => {
  it('booking: Revisionsbetrag, Satz, Firmenstatus, Summen, einmalig je Auftrag, nur anfügen', () => {
    const RT = rates()
    const J = journal(RT)
    const s = RT.split(68961)
    const R = { r1: newId(), r2: newId(), rr: newId(), r3: newId(), r4: newId() }
    const steps: Step[] = [
      { name: 'Firma pending', sql: J.step({ p: 'pend', req: R.r1, s }) },
      { name: 'Firma payment_hold', sql: `perform ${statusCall('h', 'payment_hold')}; ${J.step({ p: 'h', req: R.r1, s })}` },
      { name: 'Betrag ≠ Revisionsbetrag', sql: J.step({ p: 'a', req: R.r1, s: RT.split(68962) }) },
      { name: 'Revision eines anderen Auftrags', sql: J.step({ p: 'a', req: R.r1, rev: rev1(R.r2), s }) },
      { name: 'Spanne ohne Gesamtpreis', sql: J.step({ p: 'a', req: R.rr, s }) },
      { name: 'Satz falsch', sql: J.step({ p: 'a', req: R.r1, s, fr: 0.16 }) },
      { name: 'USt.-Satz falsch', sql: J.step({ p: 'a', req: R.r1, s, vr: 0.19 }) },
      { name: 'Version falsch', sql: J.step({ p: 'a', req: R.r1, s, frv: RT.frv + 1 }) },
      { name: 'USt.-Version falsch', sql: J.step({ p: 'a', req: R.r1, s, vrv: RT.vrv + 1 }) },
      { name: 'Satz leer', sql: J.step({ p: 'a', req: R.r1, s, fr: null }) },
      { name: 'Gebührenteile ≠ Gebühr', sql: J.step({ p: 'a', req: R.r1, s: { ...s, feeVatCents: s.feeVatCents + 1 } }) },
      { name: 'Auszahlung ≠ Gesamtpreis − Gebühr', sql: J.step({ p: 'a', req: R.r1, s: { ...s, payoutCents: s.payoutCents + 1 } }) },
      { name: 'Gebühr 1 Cent daneben', sql: J.step({ p: 'a', req: R.r1, s: { ...s, feeCents: s.feeCents + 1, feeNetCents: s.feeNetCents + 1, payoutCents: s.payoutCents - 1 } }) },
      { name: 'Netto und USt. vertauscht', sql: J.step({ p: 'a', req: R.r1, s: { ...s, feeNetCents: s.feeVatCents, feeVatCents: s.feeNetCents } }) },
      { name: 'Gebühr 0', sql: J.step({ p: 'a', req: R.r1, s: { ...s, feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: s.totalCents } }) },
      { name: 'USt.-Regel außerhalb Phase 1', sql: direct(RT, s, { req: R.r3, rev: rev1(R.r3), rule: "'reverse_charge'" }) },
      { name: 'Positivkontrolle direkt', sql: direct(RT, s, { req: R.r3, rev: rev1(R.r3) }) },
      { name: 'zweite Zeile je Auftrag direkt', sql: direct(RT, s, { req: R.r3, rev: rev1(R.r3) }) },
      { name: 'Positivkontrolle booking', sql: J.step({ p: 'a', req: R.r1, s, save: 'b1' }) },
      { name: 'Zeile gelesen', sql: `=(select total_cents || '/' || fee_cents || '/' || payout_cents || '/' || vat_rule || '/' || fee_rate_version from public.commission_entries where id = current_setting('app.e_b1')::uuid)` },
      { name: 'zweite booking', sql: J.step({ p: 'a', req: R.r1, s }) },
      { name: 'UPDATE (Eigentümer)', sql: "update public.commission_entries set total_cents = total_cents + 1 where id = current_setting('app.e_b1')::uuid" },
      { name: 'DELETE (Eigentümer)', sql: "delete from public.commission_entries where id = current_setting('app.e_b1')::uuid" },
      { name: 'TRUNCATE (Eigentümer)', sql: 'truncate public.commission_entries' },
      { name: 'UPDATE (service_role)', sql: 'update public.commission_entries set total_cents = 1', as: 'service_role' },
      { name: 'DELETE (service_role)', sql: 'delete from public.commission_entries', as: 'service_role' },
      { name: 'TRUNCATE (service_role)', sql: 'truncate public.commission_entries', as: 'service_role' },
      { name: 'INSERT (service_role)', sql: direct(RT, s, { req: R.r4, rev: rev1(R.r4) }), as: 'service_role' },
      { name: 'Ist-Zeilen', sql: `=(select count(*) from public.commission_entries where request_id in (select id from public.service_requests where customer_id = '${U.cust}'))` },
      { name: 'Firma löschen', sql: deleteFirm('a') },
      { name: 'Kunde löschen', sql: `delete from auth.users where id = '${U.cust}'` },
      { name: 'ohne gültige USt.-Regel', sql: `alter table public.partner_vat_rules disable trigger append_only; update public.partner_vat_rules set valid_from = valid_from + 5 where partner_id = ${P('a')}; ${J.step({ p: 'a', req: R.r4, s })}` },
    ]
    const r = probes(
      `${BASE('a', 'pend', 'h')} ${request(R.r1)} ${request(R.r2)} ${request(R.rr, null)} ${request(R.r3)} ${request(R.r4)}`,
      steps,
    )
    P0001(r['Firma pending'], 'partner_not_active')
    P0001(r['Firma payment_hold'], 'partner_not_active')
    for (const k of ['Betrag ≠ Revisionsbetrag', 'Revision eines anderen Auftrags', 'Spanne ohne Gesamtpreis']) P0001(r[k], 'amount_mismatch')
    for (const k of ['Satz falsch', 'USt.-Satz falsch', 'Version falsch', 'USt.-Version falsch', 'Satz leer']) P0001(r[k], 'rate_mismatch')
    for (const k of ['Gebühr 1 Cent daneben', 'Netto und USt. vertauscht', 'Gebühr 0']) P0001(r[k], 'amount_mismatch')
    check(r['Gebührenteile ≠ Gebühr'], '23514', '"fee_parts"')
    check(r['Auszahlung ≠ Gesamtpreis − Gebühr'], '23514', '"payout_rest"')
    check(r['USt.-Regel außerhalb Phase 1'], '23514', '"vat_rule_phase1"')
    expect(r['Positivkontrolle direkt']).toBe('ok')
    check(r['zweite Zeile je Auftrag direkt'], '23505', '"commission_one_booking"')
    expect(r['Positivkontrolle booking']).toBe('ok')
    expect(r['Zeile gelesen']).toBe(`= ${s.totalCents}/${s.feeCents}/${s.payoutCents}/standard_20/${RT.frv}`)
    check(r['zweite booking'], '23505', '"commission_one_booking"')
    for (const k of ['UPDATE (Eigentümer)', 'DELETE (Eigentümer)', 'TRUNCATE (Eigentümer)']) P0001(r[k], 'append_only')
    for (const k of ['UPDATE (service_role)', 'DELETE (service_role)', 'TRUNCATE (service_role)', 'INSERT (service_role)']) check(r[k], '42501', 'permission denied')
    expect(r['Ist-Zeilen']).toBe('= 2')
    check(r['Firma löschen'], '23503', 'commission_entries')
    check(r['Kunde löschen'], '23503', 'commission_entries')
    P0001(r['ohne gültige USt.-Regel'], 'vat_rule_missing')
  }, 240_000)

  it('Gegenbuchungen: exakte Negation, nur booking, change und cancellation_fee, einmalig; Summe 0', () => {
    const RT = rates()
    const J = journal(RT)
    const s = RT.split(68961)
    const fee = RT.split(5000)
    const R = { r1: newId(), r2: newId(), r3: newId() }
    const s0 = neg(s)
    const steps: Step[] = [
      { name: 'ohne gegengebuchte Zeile', sql: J.step({ p: 'a', req: R.r1, kind: 'cancellation', of: null, s: s0 }) },
      { name: 'nicht negiert', sql: J.step({ p: 'a', req: R.r1, kind: 'cancellation', of: 'b1', s }) },
      { name: 'um 1 Cent falsch', sql: J.step({ p: 'a', req: R.r1, kind: 'cancellation', of: 'b1', s: { ...s0, feeCents: s0.feeCents + 1 } }) },
      { name: 'Auszahlung um 1 Cent falsch', sql: J.step({ p: 'a', req: R.r1, kind: 'cancellation', of: 'b1', s: { ...s0, payoutCents: s0.payoutCents - 1 } }) },
      { name: 'andere Firma', sql: J.step({ p: 'b', req: R.r1, kind: 'cancellation', of: 'b1', s: s0 }) },
      { name: 'Firma pending', sql: J.step({ p: 'pend', req: R.r1, kind: 'cancellation', of: 'b1', s: s0 }) },
      { name: 'anderer Auftrag', sql: J.step({ p: 'a', req: R.r2, kind: 'cancellation', of: 'b1', s: s0 }) },
      { name: 'anderer Satz', sql: J.step({ p: 'a', req: R.r1, kind: 'cancellation', of: 'b1', s: s0, fr: 0.16 }) },
      { name: 'andere Version', sql: J.step({ p: 'a', req: R.r1, kind: 'cancellation', of: 'b1', s: s0, frv: RT.frv + 1 }) },
      { name: 'Stornogebühr bei lebender booking', sql: J.step({ p: 'a', req: R.r1, kind: 'cancellation_fee', s: fee }) },
      { name: 'Positivkontrolle cancellation', sql: J.step({ p: 'a', req: R.r1, kind: 'cancellation', of: 'b1', s: s0, save: 'c1' }) },
      { name: 'Summe über Buchung und Gegenbuchung', sql: `=(select sum(total_cents) + sum(fee_cents) + sum(fee_net_cents) + sum(fee_vat_cents) + sum(payout_cents) from public.commission_entries where request_id = '${R.r1}')` },
      { name: 'zweite Gegenbuchung', sql: J.step({ p: 'a', req: R.r1, kind: 'correction', of: 'b1', s: s0 }) },
      { name: 'Gegenbuchung einer Gegenbuchung', sql: J.step({ p: 'a', req: R.r1, kind: 'correction', of: 'c1', s }) },
      { name: 'correction der Stornogebühr (leere Sätze aus der booking-Zeile)', sql: J.step({ p: 'a', req: R.r2, kind: 'correction', of: 'f2', s: neg(fee), fr: null, vr: null, frv: null, vrv: null, save: 'k2' }) },
      { name: 'Sätze der correction', sql: `=(select fee_rate::float8 || '/' || fee_rate_version from public.commission_entries where id = current_setting('app.e_k2')::uuid)` },
      { name: 'booking mit Gegenbuchungsverweis', sql: direct(RT, s, { req: R.r3, rev: rev1(R.r3), of: "current_setting('app.e_b1')::uuid" }) },
      { name: 'negativer Betrag bei booking ohne Prüfung durch den Trigger', sql: `alter table public.commission_entries disable trigger guard_commission_insert; ${direct(RT, { totalCents: -1, feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: -1 }, { req: R.r3, rev: rev1(R.r3) })}` },
    ]
    const r = probes(
      `${BASE('a', 'b', 'pend')} ${request(R.r1)} ${request(R.r2)} ${request(R.r3)}
       ${J.setup({ p: 'a', req: R.r1, s, save: 'b1' })} ${J.setup({ p: 'a', req: R.r2, s, save: 'b2' })}
       ${J.setup({ p: 'a', req: R.r2, kind: 'cancellation', of: 'b2', s: s0 })}
       ${J.setup({ p: 'a', req: R.r2, kind: 'cancellation_fee', s: fee, save: 'f2' })}`,
      steps,
    )
    check(r['ohne gegengebuchte Zeile'], '23514', '"reverses_shape"')
    for (const k of ['nicht negiert', 'um 1 Cent falsch', 'Auszahlung um 1 Cent falsch', 'anderer Auftrag', 'Gegenbuchung einer Gegenbuchung']) P0001(r[k], 'amount_mismatch')
    P0001(r['andere Firma'], 'partner_mismatch')
    P0001(r['Firma pending'], 'partner_not_active')
    P0001(r['anderer Satz'], 'rate_mismatch')
    P0001(r['andere Version'], 'rate_mismatch')
    expect(r['Positivkontrolle cancellation']).toBe('ok')
    expect(r['Summe über Buchung und Gegenbuchung']).toBe('= 0')
    check(r['zweite Gegenbuchung'], '23505', '"commission_one_reversal"')
    expect(r['correction der Stornogebühr (leere Sätze aus der booking-Zeile)']).toBe('ok')
    expect(r['Sätze der correction']).toBe(`= ${RT.fr}/${RT.frv}`)
    P0001(r['Stornogebühr bei lebender booking'], 'amount_mismatch')
    check(r['booking mit Gegenbuchungsverweis'], '23514', '"reverses_shape"')
    check(r['negativer Betrag bei booking ohne Prüfung durch den Trigger'], '23514', '"non_negative_kinds"')
  }, 240_000)

  it('change: nur erhöhend, Differenz zur aktuellen Revision; cancellation_fee bis zum Gesamtpreis; Satz aus der booking-Zeile', () => {
    const RT = rates()
    const J = journal(RT)
    const s = RT.split(68961)
    const R = { r3: newId(), r4: newId(), r5: newId(), r6: newId(), rn: newId() }
    const diff = RT.split(80000 - 68961)
    const same = { fr: null, vr: null, frv: null, vrv: null } as const // leere Sätze: nur Gegenbuchungen dürfen sie weglassen
    const steps: Step[] = [
      { name: 'change mit leerem Satz', sql: J.step({ p: 'a', req: R.r3, kind: 'change', rev: rev2(R.r3), s: diff, ...same }) },
      { name: 'Stornogebühr mit leerem Satz', sql: J.step({ p: 'a', req: R.r5, kind: 'cancellation_fee', s: RT.split(5000), ...same }) },
      { name: 'Stornogebühr bei lebender booking', sql: J.step({ p: 'a', req: R.r3, kind: 'cancellation_fee', rev: rev2(R.r3), s: RT.split(5000) }) },
      { name: 'Stornogebühr 0', sql: J.step({ p: 'a', req: R.r5, kind: 'cancellation_fee', s: RT.split(0) }) },
      { name: 'Gebühr 1 Cent daneben', sql: J.step({ p: 'a', req: R.r5, kind: 'cancellation_fee', s: { ...RT.split(5000), feeCents: RT.split(5000).feeCents + 1, feeNetCents: RT.split(5000).feeNetCents + 1, payoutCents: RT.split(5000).payoutCents - 1 } }) },
      { name: 'Betrag ≠ Differenz', sql: J.step({ p: 'a', req: R.r3, kind: 'change', rev: rev2(R.r3), s: RT.split(11038) }) },
      { name: 'Revision 1 statt der aktuellen', sql: J.step({ p: 'a', req: R.r3, kind: 'change', rev: rev1(R.r3), s: diff }) },
      { name: 'andere Firma', sql: J.step({ p: 'b', req: R.r3, kind: 'change', rev: rev2(R.r3), s: diff }) },
      { name: 'Firma pending', sql: J.step({ p: 'pend', req: R.r3, kind: 'change', rev: rev2(R.r3), s: diff }) },
      { name: 'anderer Satz', sql: J.step({ p: 'a', req: R.r3, kind: 'change', rev: rev2(R.r3), s: diff, fr: 0.16 }) },
      { name: 'Positivkontrolle change', sql: J.step({ p: 'a', req: R.r3, kind: 'change', rev: rev2(R.r3), s: diff, save: 'ch3' }) },
      { name: 'Satz der change-Zeile', sql: `=(select fee_rate::float8 || '/' || fee_rate_version || '/' || vat_rule from public.commission_entries where id = current_setting('app.e_ch3')::uuid)` },
      { name: 'zweite change ohne neue Differenz', sql: J.step({ p: 'a', req: R.r3, kind: 'change', rev: rev2(R.r3), s: diff }) },
      { name: 'Gegenbuchung der change', sql: J.step({ p: 'a', req: R.r3, kind: 'correction', rev: rev2(R.r3), of: 'ch3', s: neg(diff) }) },
      { name: 'negative Differenz', sql: J.step({ p: 'a', req: R.r4, kind: 'change', rev: rev2(R.r4), s: neg(RT.split(8961)) }) },
      { name: 'change ohne booking', sql: J.step({ p: 'a', req: R.rn, kind: 'change', s: RT.split(1) }) },
      { name: 'cancellation_fee ohne booking', sql: J.step({ p: 'a', req: R.rn, kind: 'cancellation_fee', s: RT.split(1) }) },
      { name: 'change nach Storno der booking', sql: J.step({ p: 'a', req: R.r5, kind: 'change', s: RT.split(1) }) },
      { name: 'Stornogebühr über Gesamtpreis', sql: J.step({ p: 'a', req: R.r5, kind: 'cancellation_fee', s: RT.split(68962) }) },
      { name: 'Stornogebühr negativ', sql: J.step({ p: 'a', req: R.r5, kind: 'cancellation_fee', s: neg(RT.split(1)) }) },
      { name: 'Stornogebühr andere Firma', sql: J.step({ p: 'b', req: R.r5, kind: 'cancellation_fee', s: RT.split(5000) }) },
      { name: 'Stornogebühr Firma pending', sql: J.step({ p: 'pend', req: R.r5, kind: 'cancellation_fee', s: RT.split(5000) }) },
      { name: 'Stornogebühr anderer Satz', sql: J.step({ p: 'a', req: R.r5, kind: 'cancellation_fee', s: RT.split(5000), fr: 0.16 }) },
      { name: 'Stornogebühr genau Gesamtpreis (nach Storno der booking)', sql: J.step({ p: 'a', req: R.r5, kind: 'cancellation_fee', s, save: 'f5' }) },
      { name: 'zweite Stornogebühr', sql: J.step({ p: 'a', req: R.r5, kind: 'cancellation_fee', s: RT.split(5000) }) },
      { name: 'Gegenbuchung der ersten, dann neue Stornogebühr', sql: `${J.step({ p: 'a', req: R.r5, kind: 'correction', of: 'f5', s: neg(s), ...same })}; ${J.step({ p: 'a', req: R.r5, kind: 'cancellation_fee', s: RT.split(5000) })}` },
      { name: 'Stornogebühr Firma payment_hold', sql: J.step({ p: 'h', req: R.r6, kind: 'cancellation_fee', s: RT.split(5000) }) },
    ]
    const r = probes(
      `${BASE('a', 'b', 'pend', 'h')} ${request(R.r3)} ${request(R.r4)} ${request(R.r5)} ${request(R.r6)} ${request(R.rn)}
       ${J.setup({ p: 'a', req: R.r3, s })} ${J.setup({ p: 'a', req: R.r4, s })} ${J.setup({ p: 'a', req: R.r5, s, save: 'b5' })}
       ${J.setup({ p: 'a', req: R.r5, kind: 'cancellation', of: 'b5', s: neg(s) })} ${J.setup({ p: 'h', req: R.r6, s, save: 'b6' })}
       ${J.setup({ p: 'h', req: R.r6, kind: 'cancellation', of: 'b6', s: neg(s) })} select ${statusCall('h', 'payment_hold')};
       ${changeOrder(R.r3, 80000)} ${changeOrder(R.r4, 60000)}`,
      steps,
    )
    for (const k of ['Betrag ≠ Differenz', 'Revision 1 statt der aktuellen', 'zweite change ohne neue Differenz', 'negative Differenz', 'Stornogebühr über Gesamtpreis', 'Stornogebühr negativ', 'Stornogebühr bei lebender booking', 'Stornogebühr 0', 'Gebühr 1 Cent daneben', 'zweite Stornogebühr']) P0001(r[k], 'amount_mismatch')
    P0001(r['change mit leerem Satz'], 'rate_mismatch')
    P0001(r['Stornogebühr mit leerem Satz'], 'rate_mismatch')
    expect(r['Gegenbuchung der ersten, dann neue Stornogebühr']).toBe('ok')
    P0001(r['andere Firma'], 'partner_mismatch')
    P0001(r['Stornogebühr andere Firma'], 'partner_mismatch')
    P0001(r['Firma pending'], 'partner_not_active')
    P0001(r['Stornogebühr Firma pending'], 'partner_not_active')
    P0001(r['anderer Satz'], 'rate_mismatch')
    P0001(r['Stornogebühr anderer Satz'], 'rate_mismatch')
    for (const k of ['change ohne booking', 'cancellation_fee ohne booking', 'change nach Storno der booking']) P0001(r[k], 'booking_missing')
    expect(r['Positivkontrolle change']).toBe('ok')
    expect(r['Satz der change-Zeile']).toBe(`= ${RT.fr}/${RT.frv}/standard_20`)
    expect(r['Gegenbuchung der change']).toBe('ok')
    expect(r['Stornogebühr genau Gesamtpreis (nach Storno der booking)']).toBe('ok')
    expect(r['Stornogebühr Firma payment_hold']).toBe('ok')
  }, 240_000)

  it('Sätze: höchste Version bei gleichem Datum, künftige Zeilen zählen nicht; current_fee_rates nennt die Versionen', () => {
    const RT = rates()
    const J = journal(RT)
    const R = { r1: newId() }
    const ins = (version: number, value: number, from: string) => `insert into public.platform_settings (key, version, value, effective_from) values ('fee_rate', ${version}, ${value}, ${from});`
    const sAt = (rate: number) => splitFee(68961, { feeRate: rate, vatRate: RT.vr })
    const steps: Step[] = [
      { name: 'Ist-Versionen in der View', sql: "=(select fee_rate_version || '/' || fee_vat_rate_version from public.current_fee_rates)" },
      { name: 'älterer Satz', sql: J.step({ p: 'a', req: R.r1, s: RT.split(68961) }) },
      { name: 'niedrigere Version bei Gleichstand', sql: J.step({ p: 'a', req: R.r1, s: sAt(0.16), fr: 0.16, frv: 98 }) },
      { name: 'künftige Zeile', sql: J.step({ p: 'a', req: R.r1, s: sAt(0.3), fr: 0.3, frv: 100 }) },
      { name: 'richtige Version', sql: J.step({ p: 'a', req: R.r1, s: sAt(0.17), fr: 0.17, frv: 99 }) },
    ]
    const r = probes(
      `${BASE('a')} ${request(R.r1)} alter table public.platform_settings disable trigger guard_platform_setting;
       ${ins(98, 0.16, TODAY)} ${ins(99, 0.17, TODAY)} ${ins(100, 0.3, `${TODAY} + 400`)}`,
      steps,
    )
    expect(r['Ist-Versionen in der View']).toBe(`= 99/${RT.vrv}`)
    for (const k of ['älterer Satz', 'niedrigere Version bei Gleichstand', 'künftige Zeile']) P0001(r[k], 'rate_mismatch')
    expect(r['richtige Version']).toBe('ok')
  }, 240_000)

  it('Lesen: eigene Firma mit aal2 (jeder Status) und admin mit aal2; sonst nichts; kein Schreibrecht; commission_book ohne Aufruf', () => {
    const RT = rates()
    const J = journal(RT)
    const s = RT.split(68961)
    const R = { r1: newId(), r2: newId(), r3: newId() }
    const auth = (sub: string, aal: 'aal1' | 'aal2' = 'aal2') => ({ as: 'authenticated', claims: { sub, aal } }) as const
    // nur die Firmen dieser Probe zählen: committete Reste anderer Tests (Wettlauftest, unlöschbares Journal) bleiben außen vor
    const N = (name: string, who: ReturnType<typeof auth>): Step => ({
      name,
      sql: `=(select count(*) from public.commission_entries where partner_id in (${P('a')}, ${P('b')}, ${P('pend')}, ${P('h')}))`,
      ...who,
    })
    const steps: Step[] = [
      N('Mitglied A aal2', auth(U.pa)),
      N('Mitglied A aal1', auth(U.pa, 'aal1')),
      N('Mitglied B aal2', auth(U.pb)),
      N('Firma pending aal2', auth(U.pend)),
      { name: 'Firma payment_hold aal2 (eigene Zeile)', sql: '=(select count(*) from public.commission_entries)', ...auth(U.ph) },
      N('Kunde aal2', auth(U.cust)),
      N('Kunde aal1', auth(U.cust, 'aal1')),
      N('admin aal2', auth(U.adm)),
      N('admin aal1', auth(U.adm, 'aal1')),
      { name: 'anon', sql: 'perform id from public.commission_entries', as: 'anon' },
      { name: 'Gebühr der eigenen Firma', sql: '=(select fee_cents from public.commission_entries)', ...auth(U.pa) },
      { name: 'Mitglied A: insert', sql: direct(RT, s, { req: R.r3, rev: rev1(R.r3) }), ...auth(U.pa) },
      { name: 'Mitglied A: update', sql: 'update public.commission_entries set total_cents = 1', ...auth(U.pa) },
      { name: 'Mitglied A: delete', sql: 'delete from public.commission_entries', ...auth(U.pa) },
      { name: 'admin aal2: update', sql: 'update public.commission_entries set total_cents = 1', ...auth(U.adm) },
      { name: 'service_role liest', sql: `=(select count(*) from public.commission_entries where request_id in (select id from public.service_requests where customer_id = '${U.cust}'))`, as: 'service_role' },
      { name: 'commission_book (authenticated)', sql: J.call({ p: 'a', req: R.r3, s }), ...auth(U.adm) },
      { name: 'commission_book (anon)', sql: J.call({ p: 'a', req: R.r3, s }), as: 'anon' },
      { name: 'commission_book (service_role)', sql: J.call({ p: 'a', req: R.r3, s }), as: 'service_role' },
      { name: 'commission_book (Eigentümer, Gegenkontrolle)', sql: J.call({ p: 'a', req: R.r3, s }) },
    ]
    const r = probes(
      `${BASE('a', 'b', 'pend', 'h')} ${request(R.r1)} ${request(R.r2)} ${request(R.r3)} ${J.setup({ p: 'a', req: R.r1, s })} ${J.setup({ p: 'h', req: R.r2, s })} select ${statusCall('h', 'payment_hold')};`,
      steps,
    )
    expect(r['Mitglied A aal2']).toBe('= 1')
    expect(r['Firma payment_hold aal2 (eigene Zeile)']).toBe('= 1')
    for (const k of ['Mitglied A aal1', 'Mitglied B aal2', 'Firma pending aal2', 'Kunde aal2', 'Kunde aal1', 'admin aal1']) expect(r[k], k).toBe('= 0')
    expect(r['admin aal2']).toBe('= 2')
    check(r['anon'], '42501', 'permission denied')
    expect(r['Gebühr der eigenen Firma']).toBe(`= ${s.feeCents}`)
    for (const k of ['Mitglied A: insert', 'Mitglied A: update', 'Mitglied A: delete', 'admin aal2: update']) check(r[k], '42501', 'permission denied')
    expect(r['service_role liest']).toBe('= 2')
    for (const k of ['commission_book (authenticated)', 'commission_book (anon)', 'commission_book (service_role)']) check(r[k], '42501', 'permission denied')
    expect(r['commission_book (Eigentümer, Gegenkontrolle)']).toBe('ok')
  }, 240_000)
})
