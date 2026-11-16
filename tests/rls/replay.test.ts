// n12b (OFFEN n12-2): Wiederholung nach Erfolg beim Storno. Teil 1 misst, ob ein zweiter gleicher Aufruf eine zweite Journalzeile (Pauschale, Stornogebühr)
// erzeugt: Nein, der zweite Aufruf scheitert vor jeder Buchung (Partner: not_found, die Zuordnung ist beendet; Kunde: invalid_transition); dazu sperrt 0068
// eine zweite `cancellation_fee`-Zeile je Anfrage hart (Unique-Index).
// Teil 2: `cancel_replay` liefert der Partei, die den Erfolg selbst hatte, den Status, wenn Betrag (bei der Firma auch Grund und Belege) zum ersten Aufruf
// passen, sonst null (nur service_role, nur lesend, kein Betrag nach außen). Rollback-Proben, es bleibt nichts zurück.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { probes, type Step } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

const RT = (() => {
  const r = currentFee()
  return { ...r, s: splitFee(68961, { tiers: r.tiers, vatRate: r.vr }) }
})()
const TOTAL = 68961
const CALL_OUT = 6900
const FEE = splitFee(CALL_OUT, { tiers: RT.tiers, vatRate: RT.vr })
const LATE = 34481 // round_half_up(68961 × 50 %), Termin in 30 Stunden

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pa2: newId(), pb: newId() }
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${insertUsers(Object.values(U))} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}
  insert into public.partner_members (partner_id, user_id, role) values (${P('a')}, '${U.pa2}', 'owner');`

const TERMS = `"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":${CALL_OUT},"termsHash":"x"}`
const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const count = (sql: string) => `(select count(*) from ${sql})`
const journal = (req: string, where = 'true') => count(`public.commission_entries where request_id = '${req}' and ${where}`)

/** Annahme durch Firma a (Standard) oder b: eine Firma nimmt nur wenige Aufträge gleichzeitig an (`partner_job_limit`). */
function accepted(id: string, termin: string, by: 'a' | 'b' = 'a'): string {
  const snap = `{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[],${TERMS}}`
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');
    select public.partner_accept('${by === 'a' ? U.pa : U.pb}', ${LID(id, by)}, ${rev(id)}, ${RT.s.payoutCents}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}
const receipt = (req: string) =>
  `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
     values ('${req}', 'receipt', ${P('a')}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());`
const propose = (req: string) =>
  `select public.propose_change('${U.pa}', 'aal2', '${req}', (select current_revision from public.service_requests where id = '${req}'), '{"hours":6}'::jsonb, 80000, array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt'));`
const decline = (req: string) =>
  `select public.decide_change('${U.cust}', (select id from public.price_revisions where request_id = '${req}' and source = 'change_order' and status = 'proposed'), false, 80000, ${RT.vr}, 0, 0, 0, 0, ${RT.fsv}, ${RT.vrv});`
const RECEIPTS = (req: string) => `array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt')`

function partnerCancel(actor: string, req: string, reason: string, base: number, photos = 'null'): string {
  const s = base > 0 ? splitFee(base, { tiers: RT.tiers, vatRate: RT.vr }) : { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
  return `perform public.cancel_by_partner('${actor}', 'aal2', '${req}', '${reason}', ${photos}, ${base}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.fsv}, ${RT.vrv})`
}
function customerCancel(actor: string, req: string, base: number): string {
  const s = base > 0 ? splitFee(base, { tiers: RT.tiers, vatRate: RT.vr }) : { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
  return `perform public.cancel_by_customer('${actor}', '${req}', ${base}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.fsv}, ${RT.vrv})`
}
/** `cancel_replay(Akteur, Anfrage, Aktion, gezeigter Betrag, Grund, Belege)`; Grund und Belege als SQL-Ausdruck (null beim Kunden). */
const replay = (actor: string | null, req: string, action: string, shown: number | null, reason = 'null', photos = 'null') =>
  `public.cancel_replay(${actor ? `'${actor}'` : 'null::uuid'}, '${req}', '${action}', ${shown === null ? 'null::bigint' : shown}, ${reason}, ${photos})`
const CP = 'cancel_by_partner'
const CC = 'cancel_by_customer'
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const val = (v: string | undefined, want: string) => expect(v, String(v)).toBe(`= ${want}`)
const svc = (name: string, sql: string): Step => ({ name, as: 'service_role', sql: `=${sql}` })

describe('Wiederholung des Stornos nach Erfolg', () => {
  it('zweiter Aufruf bucht nie ein zweites Mal; cancel_replay antwortet nur der eigenen Partei bei gleichem Betrag, Grund und gleichen Belegen', () => {
    const [S1, S2, C1, C2, C3, S3, A4] = [newId(), newId(), newId(), newId(), newId(), newId(), newId()]
    const FIVE = "now() + interval '5 days'"
    const LATE_T = "now() + interval '30 hours'"
    const AGO = "now() - interval '2 hours'"
    const setup = `${BASE} ${accepted(S1, AGO)} ${receipt(S1)} ${propose(S1)} ${decline(S1)} ${accepted(S2, FIVE)} ${accepted(S3, FIVE)}
      ${accepted(C1, LATE_T, 'b')} ${accepted(C2, FIVE, 'b')} ${accepted(C3, FIVE, 'b')} ${accepted(A4, AGO, 'b')}`
    const A = (sub: string) => ({ sub, aal: 'aal2' as const })
    const steps: Step[] = [
      // Messung Partner mit Pauschale
      { name: 'S1 Storno mit Pauschale', as: 'service_role', sql: partnerCancel(U.pa, S1, 'scope_impossible', CALL_OUT, RECEIPTS(S1)) },
      { name: 'S1 Wiederholung', as: 'service_role', sql: partnerCancel(U.pa, S1, 'scope_impossible', CALL_OUT, RECEIPTS(S1)) },
      { name: 'S1 Basis nach Storno', as: 'service_role', sql: `perform * from public.cancel_by_partner_basis('${U.pa}', 'aal2', '${S1}', 'scope_impossible')` },
      { name: 'S1 Pauschalenzeilen', sql: `=${journal(S1, `kind = 'cancellation_fee'`)}` },
      { name: 'S1 Zeilen', sql: `=${journal(S1)}` },
      { name: 'S1 Gebührensumme', sql: `=(select coalesce(sum(fee_cents), 0) from public.commission_entries where request_id = '${S1}')` },
      { name: 'S1 Audit', sql: `=${count(`public.audit_log where action = 'cancel_by_partner' and entity_id = '${S1}'`)}` },
      // Messung Kunde mit Stornogebühr
      { name: 'C1 Storno mit Gebühr', as: 'service_role', sql: customerCancel(U.cust, C1, LATE) },
      { name: 'C1 Wiederholung', as: 'service_role', sql: customerCancel(U.cust, C1, LATE) },
      { name: 'C1 Gebührenzeilen', sql: `=${journal(C1, `kind = 'cancellation_fee'`)}` },
      { name: 'C1 Zeilen', sql: `=${journal(C1)}` },
      // cancel_replay Firma
      svc('S1 Replay Firma', replay(U.pa, S1, CP, CALL_OUT, "'scope_impossible'", RECEIPTS(S1))),
      svc('S1 Replay Belege in anderer Reihenfolge', replay(U.pa, S1, CP, CALL_OUT, "'scope_impossible'", `array(select id from public.job_photos where request_id = '${S1}' and kind = 'receipt' order by id desc)`)),
      svc('S1 Replay anderer Betrag', replay(U.pa, S1, CP, CALL_OUT - 1, "'scope_impossible'", RECEIPTS(S1))),
      svc('S1 Replay Betrag 0', replay(U.pa, S1, CP, 0, "'scope_impossible'", RECEIPTS(S1))),
      svc('S1 Replay anderer Grund', replay(U.pa, S1, CP, CALL_OUT, "'other'", RECEIPTS(S1))),
      svc('S1 Replay ohne Belege', replay(U.pa, S1, CP, CALL_OUT, "'scope_impossible'", 'null')),
      svc('S1 Replay andere Firma', replay(U.pb, S1, CP, CALL_OUT, "'scope_impossible'", RECEIPTS(S1))),
      svc('S1 Replay Mitglied derselben Firma', replay(U.pa2, S1, CP, CALL_OUT, "'scope_impossible'", RECEIPTS(S1))),
      svc('S1 Replay Kunde', replay(U.cust, S1, CP, CALL_OUT, "'scope_impossible'", RECEIPTS(S1))),
      svc('S1 Replay falsche Aktion', replay(U.pa, S1, CC, CALL_OUT)),
      svc('S1 Replay unbekannte Aktion', replay(U.pa, S1, 'bogus', CALL_OUT, "'scope_impossible'", RECEIPTS(S1))),
      svc('S1 Replay NULL-Akteur', replay(null, S1, CP, CALL_OUT, "'scope_impossible'", RECEIPTS(S1))),
      svc('S1 Replay NULL-Betrag', replay(U.pa, S1, CP, null, "'scope_impossible'", RECEIPTS(S1))),
      // cancel_replay Kunde
      svc('C1 Replay Kunde', replay(U.cust, C1, CC, LATE)),
      svc('C1 Replay anderer Betrag', replay(U.cust, C1, CC, LATE - 1)),
      svc('C1 Replay Betrag 0', replay(U.cust, C1, CC, 0)),
      svc('C1 Replay fremder Kunde', replay(U.cust2, C1, CC, LATE)),
      svc('C1 Replay Firma', replay(U.pa, C1, CC, LATE)),
      svc('C1 Replay falsche Aktion', replay(U.cust, C1, CP, LATE, "'other'")),
      // ohne Gebühr: Betrag 0 gehört dazu, ein anderer nicht
      { name: 'S2 Storno ohne Pauschale', as: 'service_role', sql: partnerCancel(U.pa, S2, 'unavailable', 0) },
      svc('S2 Replay', replay(U.pa, S2, CP, 0, "'unavailable'")),
      svc('S2 Replay Betrag 1', replay(U.pa, S2, CP, 1, "'unavailable'")),
      { name: 'C2 Storno ohne Gebühr', as: 'service_role', sql: customerCancel(U.cust, C2, 0) },
      svc('C2 Replay', replay(U.cust, C2, CC, 0)),
      svc('C2 Replay Betrag 1', replay(U.cust, C2, CC, 1)),
      // nicht storniert: nichts
      svc('S3 Replay vor dem Storno', replay(U.pa, S3, CP, 0, "'other'")),
      svc('C3 Replay vor dem Storno', replay(U.cust, C3, CC, 0)),
      // Storno durch admin ist keine Wiederholung des Kunden
      { name: 'A4 admin storniert', as: 'service_role', sql: `perform public.admin_correct('${U.adm}', 'aal2', '${A4}', 'cancel_customer', 'Begründung für den Test', null, 0, ${RT.vr}, 0, 0, 0, 0, ${RT.fsv}, ${RT.vrv})` },
      svc('A4 Replay Kunde', replay(U.cust, A4, CC, 0)),
      // nach negate_fee stimmt das Journal nicht mehr mit dem Audit überein
      { name: 'S1 negate_fee', as: 'service_role', sql: `perform public.admin_correct('${U.adm}', 'aal2', '${S1}', 'negate_fee', 'Begründung für den Test', null, 0, ${RT.vr}, 0, 0, 0, 0, ${RT.fsv}, ${RT.vrv})` },
      svc('S1 Replay nach negate_fee', replay(U.pa, S1, CP, CALL_OUT, "'scope_impossible'", RECEIPTS(S1))),
      // Nach der Gegenbuchung lässt der Trigger eine neue Gebührenzeile durch; nur der Index (0068) hält sie auf: höchstens eine Pauschale je Anfrage, auch nach negate_fee.
      // Vor dem Push meldet der Schritt „ok“ (Zeile geschrieben): das ist der Ist-Wert des Rot-Beweises.
      { name: 'S1 neue Pauschale nach negate_fee', sql: `perform private.commission_book(${P('a')}, '${S1}', (select current_revision from public.service_requests where id = '${S1}'), 'cancellation_fee', null, ${CALL_OUT}, ${RT.vr}, ${FEE.feeCents}, ${FEE.feeNetCents}, ${FEE.feeVatCents}, ${FEE.payoutCents}, ${RT.fsv}, ${RT.vrv})` },
      // Rechte
      { name: 'authenticated', as: 'authenticated', claims: A(U.cust), sql: `perform ${replay(U.cust, C1, CC, LATE)}` },
      { name: 'anon', as: 'anon', sql: `perform ${replay(U.cust, C1, CC, LATE)}` },
      // ausgetretenes Mitglied (zuletzt: die Probe löscht die Mitgliedschaft)
      { name: 'Firma a verliert Mitglied pa', sql: `delete from public.partner_members where user_id = '${U.pa}'` },
      svc('S2 Replay ausgetretenes Mitglied', replay(U.pa, S2, CP, 0, "'unavailable'")),
    ]
    const r = probes(setup, steps)
    expect(r['S1 Storno mit Pauschale']).toBe('ok')
    err(r['S1 Wiederholung'], 'not_found')
    err(r['S1 Basis nach Storno'], 'not_found')
    val(r['S1 Pauschalenzeilen'], '1')
    val(r['S1 Zeilen'], '3')
    val(r['S1 Gebührensumme'], String(splitFee(CALL_OUT, { tiers: RT.tiers, vatRate: RT.vr }).feeCents))
    val(r['S1 Audit'], '1')
    expect(r['C1 Storno mit Gebühr']).toBe('ok')
    err(r['C1 Wiederholung'], 'invalid_transition')
    val(r['C1 Gebührenzeilen'], '1')
    val(r['C1 Zeilen'], '3')

    val(r['S1 Replay Firma'], 'cancelled_by_partner')
    val(r['S1 Replay Belege in anderer Reihenfolge'], 'cancelled_by_partner')
    for (const k of ['anderer Betrag', 'Betrag 0', 'anderer Grund', 'ohne Belege', 'andere Firma', 'Mitglied derselben Firma', 'Kunde', 'falsche Aktion', 'unbekannte Aktion', 'NULL-Akteur', 'NULL-Betrag']) {
      val(r[`S1 Replay ${k}`], '<null>')
    }
    val(r['C1 Replay Kunde'], 'cancelled_by_customer')
    for (const k of ['anderer Betrag', 'Betrag 0', 'fremder Kunde', 'Firma', 'falsche Aktion']) val(r[`C1 Replay ${k}`], '<null>')
    expect(r['S2 Storno ohne Pauschale']).toBe('ok')
    val(r['S2 Replay'], 'cancelled_by_partner')
    val(r['S2 Replay Betrag 1'], '<null>')
    expect(r['C2 Storno ohne Gebühr']).toBe('ok')
    val(r['C2 Replay'], 'cancelled_by_customer')
    val(r['C2 Replay Betrag 1'], '<null>')
    val(r['S3 Replay vor dem Storno'], '<null>')
    val(r['C3 Replay vor dem Storno'], '<null>')
    expect(r['A4 admin storniert']).toBe('ok')
    val(r['A4 Replay Kunde'], '<null>')
    expect(r['S1 negate_fee']).toBe('ok')
    val(r['S1 Replay nach negate_fee'], '<null>')
    err(r['S1 neue Pauschale nach negate_fee'], 'commission_one_cancellation_fee') // 23505, Unique-Index aus 0068
    err(r['authenticated'], '42501')
    err(r['anon'], '42501')
    val(r['S2 Replay ausgetretenes Mitglied'], '<null>')
  })
})
