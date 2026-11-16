// s9i-7b2 D (Migration 0060) und st1 (Migration 0065, Nr. 148 und 154): Sperre von Kontakt (job_contact) und Fotos (job_photo_list) nach einem Storno.
// Nach jedem Storno ohne Pauschale (Firma oder Kunde) sind beide sofort gesperrt; mit fälliger Pauschale gilt das Zugriffsfenster (partner_access_days);
// nach Gegenbuchung der Pauschale (admin-correct negate_fee) wieder gesperrt. Abgeschlossene Aufträge bleiben im Fenster offen.
// Alles sind Rollback-Proben, es bleibt nichts zurück.
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
const REASON = 'Prüfung abgeschlossen, Beleg liegt vor'
const FIVE = "now() + interval '5 days'"
// Nr. 148: die Pauschale der Firma gibt es erst ab Terminbeginn
const PAST = "now() - interval '2 hours'"

const U = { adm: newId(), cust: newId(), pa: newId(), pb: newId() }
const USERS = insertUsers(Object.values(U))
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${USERS} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}`
const TERMS = `"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":${CALL_OUT},"termsHash":"x"}`
const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P('a')})`
const curRev = (req: string) => `(select current_revision from public.service_requests where id = '${req}')`

/** Angenommener Auftrag mit Kontaktzeile; Termin in 5 Tagen oder (für Fälle mit Pauschale) vor 2 Stunden begonnen */
function accepted(id: string, termin = FIVE): string {
  const snap = `{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[],${TERMS}}`
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    insert into public.request_contacts (request_id, name, phone, email, stairs_door) values ('${id}', 'Karl Kunde', '+43 1 234', 'karl@movenow.test', '3. Stock');
    select public.distribute_request('${id}');
    select public.partner_accept('${U.pa}', ${LID(id)}, ${rev(id)}, ${RT.s.payoutCents}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}
const receipt = (req: string) =>
  `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
     values ('${req}', 'receipt', ${P('a')}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());`
/** Objekte im Bucket zu allen Belegen der Aufträge (job_photo_list liefert nur Dateien, die es gibt, 0037) */
const objects = (...reqs: string[]) =>
  `insert into storage.objects (bucket_id, name) select 'job-photos', j.storage_path from public.job_photos j
     where j.kind = 'receipt' and j.request_id in (${reqs.map((r) => `'${r}'`).join(', ')});`
const propose = (req: string) =>
  `select public.propose_change('${U.pa}', 'aal2', '${req}', ${curRev(req)}, '{"hours":6}'::jsonb, 80000, array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt'));`
const OPEN = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and source = 'change_order' and status = 'proposed')`
const declineChange = (req: string) => {
  const s = { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
  return `${receipt(req)} ${propose(req)} select public.decide_change('${U.cust}', ${OPEN(req)}, false, 80000, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}
const RECEIPTS = (req: string) => `array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt')`
function cancelCall(req: string, reason: string, base: number, photos: string | null): string {
  const s = base > 0 ? splitFee(base, { tiers: RT.tiers, vatRate: RT.vr }) : { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
  return `perform public.cancel_by_partner('${U.pa}', 'aal2', '${req}', '${reason}', ${photos ?? 'null'}, ${base}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.fsv}, ${RT.vrv})`
}
const negate = (req: string) =>
  `perform public.admin_correct('${U.adm}', 'aal2', '${req}', 'negate_fee', '${REASON}', null, 0, ${RT.vr}, 0, 0, 0, 0, ${RT.fsv}, ${RT.vrv})`
const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const contact = (req: string) => `=(select name from public.job_contact('${req}'))`
const call = (req: string) => `perform * from public.job_contact('${req}')`
/** Fotos der Firma a über das Listing (Edge Function job-photo ruft dies als service_role) */
const photos = (req: string) => `=(select count(*) from public.job_photo_list('${U.pa}', 'aal2', ${LID(req)}, null))`
const photosCall = (req: string) => `perform * from public.job_photo_list('${U.pa}', 'aal2', ${LID(req)}, null)`
const SEEN = '= Karl Kunde'
const ONE = '= 1'
/** Zuordnung endet durch den Kunden (Rollback-Probe: der Trigger der Zuordnung wird ausgeschaltet), vor `ago` */
const endByCustomer = (req: string, ago: string) =>
  `alter table public.assignments disable trigger user; update public.assignments set ended_at = now() - interval '${ago}', ended_reason = 'cancelled_by_customer' where request_id = '${req}'; alter table public.assignments enable trigger user`
const setEnded = (req: string, ago: string) =>
  `alter table public.assignments disable trigger user; update public.assignments set ended_at = now() - interval '${ago}' where request_id = '${req}'; alter table public.assignments enable trigger user`
/** Pauschale des Kundenstorno: Zeile `cancellation_fee` im Journal wie cancel_by_customer (0062:738) */
const customerFee = (req: string) => {
  const s = splitFee(CALL_OUT, { tiers: RT.tiers, vatRate: RT.vr })
  // die Pauschale folgt erst nach den Gegenbuchungen der Buchung (Trigger des Journals, 0029:92)
  return `perform private.cancel_reverse_all(${P('a')}, '${req}'); perform private.commission_book(${P('a')}, '${req}', ${curRev(req)}, 'cancellation_fee', null, ${CALL_OUT}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.fsv}, ${RT.vrv})`
}

describe('Kontakt und Fotos nach Storno durch die Firma (0060, 0065)', () => {
  it('ohne Pauschale sofort gesperrt, mit Pauschale im Fenster offen, nach Gegenbuchung und Fensterende gesperrt; Pauschale erst ab Termin', () => {
    // höchstens 5 offene Aufträge je Firma (partner_open_jobs_max)
    const [E1, E2, E3, E4, E5] = [newId(), newId(), newId(), newId(), newId()] as const
    const setup = `${BASE} ${accepted(E1)} ${declineChange(E1)} ${accepted(E2, PAST)} ${declineChange(E2)} ${accepted(E3)} ${receipt(E3)} ${accepted(E4, PAST)} ${declineChange(E4)} ${accepted(E5, PAST)} ${declineChange(E5)}
      ${objects(E1, E2, E3, E4, E5)}`
    const steps: Step[] = [
      { name: 'E1 vorher', as: 'authenticated', claims: A2(U.pa), sql: contact(E1) },
      { name: 'E1 Fotos vorher', as: 'service_role', sql: photos(E1) },
      // Nr. 148: vor dem Termin keine Pauschale, auch nicht mit Beleg; die Absage ohne Pauschale geht
      { name: 'E1 Storno mit Pauschale vor Termin', as: 'service_role', sql: cancelCall(E1, 'scope_impossible', CALL_OUT, RECEIPTS(E1)) },
      { name: 'E1 Storno ohne Pauschale', as: 'service_role', sql: cancelCall(E1, 'unavailable', 0, null) },
      { name: 'E1 danach', as: 'authenticated', claims: A2(U.pa), sql: call(E1) },
      { name: 'E1 Fotos danach', as: 'service_role', sql: photosCall(E1) },
      { name: 'E2 Storno mit Pauschale', as: 'service_role', sql: cancelCall(E2, 'scope_impossible', CALL_OUT, RECEIPTS(E2)) },
      { name: 'E2 danach', as: 'authenticated', claims: A2(U.pa), sql: contact(E2) },
      { name: 'E2 Fotos danach', as: 'service_role', sql: photos(E2) },
      { name: 'E2 Audit', sql: `=(select count(*) from public.audit_log where action = 'contact_read' and entity_id = '${E2}' and actor_id = '${U.pa}')` },
      { name: 'E1 Audit', sql: `=(select count(*) from public.audit_log where action = 'contact_read' and entity_id = '${E1}' and actor_id = '${U.pa}')` },
      { name: 'E3 ohne Storno', as: 'authenticated', claims: A2(U.pa), sql: contact(E3) },
      // andere Beendigung: abgeschlossen im Fenster bleibt offen
      { name: 'E3 abgeschlossen', sql: `alter table public.assignments disable trigger user; update public.assignments set ended_at = now() - interval '1 day', ended_reason = 'completed' where request_id = '${E3}'; alter table public.assignments enable trigger user` },
      { name: 'E3 danach', as: 'authenticated', claims: A2(U.pa), sql: contact(E3) },
      { name: 'E3 Fotos danach', as: 'service_role', sql: photos(E3) },
      { name: 'E4 Storno mit Pauschale', as: 'service_role', sql: cancelCall(E4, 'scope_impossible', CALL_OUT, RECEIPTS(E4)) },
      { name: 'E4 vor Gegenbuchung', as: 'authenticated', claims: A2(U.pa), sql: contact(E4) },
      { name: 'E4 Fotos vor Gegenbuchung', as: 'service_role', sql: photos(E4) },
      { name: 'E4 Gegenbuchung', as: 'service_role', sql: negate(E4) },
      { name: 'E4 nach Gegenbuchung', as: 'authenticated', claims: A2(U.pa), sql: call(E4) },
      { name: 'E4 Fotos nach Gegenbuchung', as: 'service_role', sql: photosCall(E4) },
      { name: 'E5 Storno mit Pauschale', as: 'service_role', sql: cancelCall(E5, 'scope_impossible', CALL_OUT, RECEIPTS(E5)) },
      { name: 'E5 Ende vor 29 Tagen', sql: setEnded(E5, '29 days') },
      { name: 'E5 Tag 29', as: 'authenticated', claims: A2(U.pa), sql: contact(E5) },
      { name: 'E5 Fotos Tag 29', as: 'service_role', sql: photos(E5) },
      { name: 'E5 Ende vor 31 Tagen', sql: setEnded(E5, '31 days') },
      { name: 'E5 Tag 31', as: 'authenticated', claims: A2(U.pa), sql: call(E5) },
      { name: 'E5 Fotos Tag 31', as: 'service_role', sql: photosCall(E5) },
      // Wer nie zugeordnet war oder kein aal2 hat, bleibt draußen; auch mit fälliger Pauschale
      { name: 'E2 fremde Firma', as: 'authenticated', claims: A2(U.pb), sql: call(E2) },
      { name: 'E2 Kunde', as: 'authenticated', claims: A2(U.cust), sql: call(E2) },
      { name: 'E2 aal1', as: 'authenticated', claims: { sub: U.pa, aal: 'aal1' }, sql: call(E2) },
      { name: 'E2 anon', as: 'anon', sql: call(E2) },
      // Die Hilfsfunktionen sind für keine Rolle aufrufbar
      { name: 'Hilfsfunktion Firma', as: 'authenticated', claims: A2(U.pa), sql: `perform private.partner_cancel_fee_due('${E2}', ${P('a')})` },
      { name: 'Zugriffsfunktion Firma', as: 'authenticated', claims: A2(U.pa), sql: `perform private.partner_data_access('${E2}', ${P('a')})` },
    ]
    const r = probes(setup, steps)
    expect(r['E1 vorher']).toBe(SEEN)
    expect(r['E1 Fotos vorher']).toBe(ONE)
    err(r['E1 Storno mit Pauschale vor Termin'], 'call_out_not_allowed')
    expect(r['E1 Storno ohne Pauschale']).toBe('ok')
    err(r['E1 danach'], 'not_assigned')
    err(r['E1 Fotos danach'], 'not_found')
    expect(r['E2 Storno mit Pauschale']).toBe('ok')
    expect(r['E2 danach']).toBe(SEEN)
    expect(r['E2 Fotos danach']).toBe(ONE)
    // E1: Sperre vor der Audit-Zeile, nur der erlaubte Abruf wird protokolliert
    expect(r['E1 Audit']).toBe('= 1')
    expect(r['E2 Audit']).toBe('= 1')
    expect(r['E3 ohne Storno']).toBe(SEEN)
    expect(r['E3 danach']).toBe(SEEN)
    expect(r['E3 Fotos danach']).toBe(ONE)
    expect(r['E4 vor Gegenbuchung']).toBe(SEEN)
    expect(r['E4 Fotos vor Gegenbuchung']).toBe(ONE)
    expect(r['E4 Gegenbuchung']).toBe('ok')
    err(r['E4 nach Gegenbuchung'], 'not_assigned')
    err(r['E4 Fotos nach Gegenbuchung'], 'not_found')
    expect(r['E5 Tag 29']).toBe(SEEN)
    expect(r['E5 Fotos Tag 29']).toBe(ONE)
    err(r['E5 Tag 31'], 'not_assigned')
    err(r['E5 Fotos Tag 31'], 'not_found')
    err(r['E2 fremde Firma'], 'not_assigned')
    err(r['E2 Kunde'], 'partner_not_active')
    err(r['E2 aal1'], 'mfa_required')
    err(r['E2 anon'], '42501')
    err(r['Hilfsfunktion Firma'], '42501')
    err(r['Zugriffsfunktion Firma'], '42501')
  })

  it('Storno durch den Kunden: ohne Pauschale sofort gesperrt (Nr. 154), mit Pauschale im Fenster offen und danach gesperrt', () => {
    const [K1, K2, K3] = [newId(), newId(), newId()]
    const setup = `${BASE} ${accepted(K1)} ${receipt(K1)} ${accepted(K2)} ${receipt(K2)} ${accepted(K3)} ${receipt(K3)} ${objects(K1, K2, K3)}`
    const steps: Step[] = [
      { name: 'K1 vorher', as: 'authenticated', claims: A2(U.pa), sql: contact(K1) },
      // echter Weg: Termin in 5 Tagen, kostenlose Stufe, Basis 0
      { name: 'K1 Kundenstorno kostenlos', as: 'service_role', sql: `perform public.cancel_by_customer('${U.cust}', '${K1}', 0, ${RT.vr}, 0, 0, 0, 0, ${RT.fsv}, ${RT.vrv})` },
      { name: 'K1 danach', as: 'authenticated', claims: A2(U.pa), sql: call(K1) },
      { name: 'K1 Fotos danach', as: 'service_role', sql: photosCall(K1) },
      // Nr. 154 betrifft nur Kontakt und Fotos: der Auftrag bleibt in my_jobs sichtbar
      { name: 'K1 my_jobs bleibt', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.my_jobs() where request_id = '${K1}')` },
      { name: 'K2 Kundenstorno mit Pauschale', sql: `${endByCustomer(K2, '1 day')}; ${customerFee(K2)}` },
      { name: 'K2 danach', as: 'authenticated', claims: A2(U.pa), sql: contact(K2) },
      { name: 'K2 Fotos danach', as: 'service_role', sql: photos(K2) },
      { name: 'K2 Ende vor 31 Tagen', sql: setEnded(K2, '31 days') },
      { name: 'K2 Tag 31', as: 'authenticated', claims: A2(U.pa), sql: call(K2) },
      { name: 'K2 Fotos Tag 31', as: 'service_role', sql: photosCall(K2) },
      // ohne Zuordnung durch den Kunden bleibt der Kontakt offen: laufender Auftrag
      { name: 'K3 laufend', as: 'authenticated', claims: A2(U.pa), sql: contact(K3) },
      { name: 'K3 Fotos laufend', as: 'service_role', sql: photos(K3) },
    ]
    const r = probes(setup, steps)
    expect(r['K1 vorher']).toBe(SEEN)
    expect(r['K1 Kundenstorno kostenlos']).toBe('ok')
    err(r['K1 danach'], 'not_assigned')
    err(r['K1 Fotos danach'], 'not_found')
    expect(r['K1 my_jobs bleibt']).toBe(ONE)
    expect(r['K2 Kundenstorno mit Pauschale']).toBe('ok')
    expect(r['K2 danach']).toBe(SEEN)
    expect(r['K2 Fotos danach']).toBe(ONE)
    err(r['K2 Tag 31'], 'not_assigned')
    err(r['K2 Fotos Tag 31'], 'not_found')
    expect(r['K3 laufend']).toBe(SEEN)
    expect(r['K3 Fotos laufend']).toBe(ONE)
  })
})
