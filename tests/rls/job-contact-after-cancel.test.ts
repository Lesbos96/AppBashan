// s9i-7b2 D (Migration 0060): Kontaktsperre nach Storno durch die Firma. Ohne fällige Pauschale ist job_contact sofort gesperrt; mit Pauschale gilt das
// Zugriffsfenster (partner_access_days); nach Gegenbuchung der Pauschale (admin-correct negate_fee) wieder gesperrt. Andere Beendigungen bleiben unverändert.
// Alles sind Rollback-Proben, es bleibt nichts zurück.
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
const LID = (req: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P('a')})`
const curRev = (req: string) => `(select current_revision from public.service_requests where id = '${req}')`

/** Angenommener Auftrag in 5 Tagen mit Kontaktzeile */
function accepted(id: string): string {
  const snap = `{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[],${TERMS}}`
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, now() + interval '5 days', now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    insert into public.request_contacts (request_id, name, phone, email, stairs_door) values ('${id}', 'Karl Kunde', '+43 1 234', 'karl@movenow.test', '3. Stock');
    select public.distribute_request('${id}');
    select public.partner_accept('${U.pa}', ${LID(id)}, ${rev(id)}, ${RT.s.payoutCents}, ${RT.fr}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.frv}, ${RT.vrv});`
}
const receipt = (req: string) =>
  `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
     values ('${req}', 'receipt', ${P('a')}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());`
const propose = (req: string) =>
  `select public.propose_change('${U.pa}', 'aal2', '${req}', ${curRev(req)}, '{"hours":6}'::jsonb, 80000, array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt'));`
const OPEN = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and source = 'change_order' and status = 'proposed')`
const declineChange = (req: string) => {
  const s = { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
  return `${receipt(req)} ${propose(req)} select public.decide_change('${U.cust}', ${OPEN(req)}, false, 80000, ${RT.fr}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.frv}, ${RT.vrv});`
}
const RECEIPTS = (req: string) => `array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt')`
function cancelCall(req: string, reason: string, base: number, photos: string | null): string {
  const s = base > 0 ? splitFee(base, { feeRate: RT.fr, vatRate: RT.vr }) : { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
  return `perform public.cancel_by_partner('${U.pa}', 'aal2', '${req}', '${reason}', ${photos ?? 'null'}, ${base}, ${RT.fr}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.frv}, ${RT.vrv})`
}
const negate = (req: string) =>
  `perform public.admin_correct('${U.adm}', 'aal2', '${req}', 'negate_fee', '${REASON}', null, 0, ${RT.fr}, ${RT.vr}, 0, 0, 0, 0, ${RT.frv}, ${RT.vrv})`
const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const contact = (req: string) => `=(select name from public.job_contact('${req}'))`
const call = (req: string) => `perform * from public.job_contact('${req}')`
const SEEN = '= Karl Kunde'

describe('job_contact nach Storno durch die Firma (0060)', () => {
  it('ohne Pauschale sofort gesperrt, mit Pauschale im Fenster offen, nach Gegenbuchung und Fensterende gesperrt', () => {
    // höchstens 5 offene Aufträge je Firma (partner_open_jobs_max)
    const [E1, E2, E3, E4, E5] = [newId(), newId(), newId(), newId(), newId()] as const
    const setup = `${BASE} ${accepted(E1)} ${accepted(E2)} ${declineChange(E2)} ${accepted(E3)} ${accepted(E4)} ${declineChange(E4)} ${accepted(E5)} ${declineChange(E5)}`
    const steps: Step[] = [
      { name: 'E1 vorher', as: 'authenticated', claims: A2(U.pa), sql: contact(E1) },
      { name: 'E1 Storno ohne Pauschale', as: 'service_role', sql: cancelCall(E1, 'unavailable', 0, null) },
      { name: 'E1 danach', as: 'authenticated', claims: A2(U.pa), sql: call(E1) },
      { name: 'E2 Storno mit Pauschale', as: 'service_role', sql: cancelCall(E2, 'scope_impossible', CALL_OUT, RECEIPTS(E2)) },
      { name: 'E2 danach', as: 'authenticated', claims: A2(U.pa), sql: contact(E2) },
      { name: 'E2 Audit', sql: `=(select count(*) from public.audit_log where action = 'contact_read' and entity_id = '${E2}' and actor_id = '${U.pa}')` },
      { name: 'E1 Audit', sql: `=(select count(*) from public.audit_log where action = 'contact_read' and entity_id = '${E1}' and actor_id = '${U.pa}')` },
      { name: 'E3 ohne Storno', as: 'authenticated', claims: A2(U.pa), sql: contact(E3) },
      // andere Beendigung: abgeschlossen im Fenster bleibt offen
      { name: 'E3 abgeschlossen', sql: `alter table public.assignments disable trigger user; update public.assignments set ended_at = now() - interval '1 day', ended_reason = 'completed' where request_id = '${E3}'; alter table public.assignments enable trigger user` },
      { name: 'E3 danach', as: 'authenticated', claims: A2(U.pa), sql: contact(E3) },
      { name: 'E4 Storno mit Pauschale', as: 'service_role', sql: cancelCall(E4, 'scope_impossible', CALL_OUT, RECEIPTS(E4)) },
      { name: 'E4 vor Gegenbuchung', as: 'authenticated', claims: A2(U.pa), sql: contact(E4) },
      { name: 'E4 Gegenbuchung', as: 'service_role', sql: negate(E4) },
      { name: 'E4 nach Gegenbuchung', as: 'authenticated', claims: A2(U.pa), sql: call(E4) },
      { name: 'E5 Storno mit Pauschale', as: 'service_role', sql: cancelCall(E5, 'scope_impossible', CALL_OUT, RECEIPTS(E5)) },
      { name: 'E5 Ende vor 29 Tagen', sql: `alter table public.assignments disable trigger user; update public.assignments set ended_at = now() - interval '29 days' where request_id = '${E5}'; alter table public.assignments enable trigger user` },
      { name: 'E5 Tag 29', as: 'authenticated', claims: A2(U.pa), sql: contact(E5) },
      { name: 'E5 Ende vor 31 Tagen', sql: `alter table public.assignments disable trigger user; update public.assignments set ended_at = now() - interval '31 days' where request_id = '${E5}'; alter table public.assignments enable trigger user` },
      { name: 'E5 Tag 31', as: 'authenticated', claims: A2(U.pa), sql: call(E5) },
      // Wer nie zugeordnet war oder kein aal2 hat, bleibt draußen; auch mit fälliger Pauschale
      { name: 'E2 fremde Firma', as: 'authenticated', claims: A2(U.pb), sql: call(E2) },
      { name: 'E2 Kunde', as: 'authenticated', claims: A2(U.cust), sql: call(E2) },
      { name: 'E2 aal1', as: 'authenticated', claims: { sub: U.pa, aal: 'aal1' }, sql: call(E2) },
      { name: 'E2 anon', as: 'anon', sql: call(E2) },
      // Die Hilfsfunktion ist für keine Rolle aufrufbar
      { name: 'Hilfsfunktion Firma', as: 'authenticated', claims: A2(U.pa), sql: `perform private.partner_cancel_fee_due('${E2}', ${P('a')})` },
    ]
    const r = probes(setup, steps)
    expect(r['E1 vorher']).toBe(SEEN)
    expect(r['E1 Storno ohne Pauschale']).toBe('ok')
    err(r['E1 danach'], 'not_assigned')
    expect(r['E2 Storno mit Pauschale']).toBe('ok')
    expect(r['E2 danach']).toBe(SEEN)
    // E1: Sperre vor der Audit-Zeile, nur der erlaubte Abruf wird protokolliert
    expect(r['E1 Audit']).toBe('= 1')
    expect(r['E2 Audit']).toBe('= 1')
    expect(r['E3 ohne Storno']).toBe(SEEN)
    expect(r['E3 danach']).toBe(SEEN)
    expect(r['E4 vor Gegenbuchung']).toBe(SEEN)
    expect(r['E4 Gegenbuchung']).toBe('ok')
    err(r['E4 nach Gegenbuchung'], 'not_assigned')
    expect(r['E5 Tag 29']).toBe(SEEN)
    err(r['E5 Tag 31'], 'not_assigned')
    err(r['E2 fremde Firma'], 'not_assigned')
    err(r['E2 Kunde'], 'partner_not_active')
    err(r['E2 aal1'], 'mfa_required')
    err(r['E2 anon'], '42501')
    err(r['Hilfsfunktion Firma'], '42501')
  })

  it('Storno durch den Kunden bleibt unverändert: Kontakt im Fenster offen (S9i7-10 c bleibt für diese Art offen)', () => {
    const E6 = newId()
    const setup = `${BASE} ${accepted(E6)}`
    const steps: Step[] = [
      { name: 'E6 Kundenstorno', sql: `alter table public.assignments disable trigger user; update public.assignments set ended_at = now() - interval '1 day', ended_reason = 'cancelled_by_customer' where request_id = '${E6}'; alter table public.assignments enable trigger user` },
      { name: 'E6 danach', as: 'authenticated', claims: A2(U.pa), sql: contact(E6) },
    ]
    const r = probes(setup, steps)
    expect(r['E6 danach']).toBe(SEEN)
  })
})
