// fh1 (OFFEN n12-2 Rest, 0069): Wiederholung nach Erfolg bei den fünf App-RPCs ohne Handler: withdraw, withdraw_offer, withdraw_change, start_job,
// complete_job. Je Funktion: erster Aufruf ok, Wiederholung derselben Partei ok (200) mit genau einer Wirkung (Zähler unverändert); eine andere
// Partei, ein anderer Weg zum Zustand und fehlendes aal2 behalten den bisherigen Fehler. Rollback-Proben, es bleibt nichts zurück.
// Rot-Beweis: vor 0069 antwortet jede Wiederholung mit invalid_transition bzw. not_found (Ist-Wert: Aufruf scheitert statt ok).
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
const TERMS = `"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":6900,"termsHash":"x"}`
const AGO = "now() - interval '2 hours'"

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pa2: newId(), pb: newId() }
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${insertUsers(Object.values(U))} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}
  insert into public.partner_members (partner_id, user_id, role) values (${P('a')}, '${U.pa2}', 'owner');`

const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const count = (sql: string) => `(select count(*) from ${sql})`
const events = (req: string, to: string) => `=${count(`public.status_events where request_id = '${req}' and to_status = '${to}'`)}`
const status = (req: string) => `=(select status::text from public.service_requests where id = '${req}')`

/** Anfrage an Firma a und b verteilt (awaiting_offer); mit `by` zusätzlich von dieser Firma angenommen (eine Firma nimmt höchstens 5 offene Aufträge an). */
function request(id: string, termin: string, by?: 'a' | 'b'): string {
  const snap = `{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[],${TERMS}}`
  const open = `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');`
  if (!by) return open
  return `${open} select public.partner_accept('${by === 'a' ? U.pa : U.pb}', ${LID(id, by)}, ${rev(id)}, ${RT.s.payoutCents}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}
/** Anfrage mit Spanne (Angebot der Firma nötig, kein Festpreis): awaiting_offer, an Firma a und b verteilt. */
const OFFER = 150000
const offerRequest = (id: string) =>
  `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'awaiting_offer', 17, now() + interval '5 days', now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '{"kind":"price","lowCents":100000,"highCents":200000,"lines":[],"terms":{"x":1}}', 1, null, 100000, 200000);
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');`
const receipt = (req: string) =>
  `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
     values ('${req}', 'receipt', ${P('a')}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());`
const propose = (req: string) =>
  `select public.propose_change('${U.pa}', 'aal2', '${req}', (select current_revision from public.service_requests where id = '${req}'), '{"hours":6}'::jsonb, 80000, array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt'));`

const as = (sub: string, aal: 'aal1' | 'aal2', name: string, sql: string): Step => ({ name, as: 'authenticated', claims: { sub, aal }, sql: `perform ${sql}` })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const val = (v: string | undefined, want: string) => expect(v, String(v)).toBe(`= ${want}`)

describe('Wiederholung nach Erfolg: withdraw, start_job, complete_job', () => {
  it('Wiederholung derselben Partei ist ok mit einer Wirkung; Fremde, andere Wege und aal1 behalten den Fehler', () => {
    const [W1, W2, ST1, ST2, CP1, CC1] = [newId(), newId(), newId(), newId(), newId(), newId()]
    const setup = `${BASE} ${request(W1, "now() + interval '5 days'")} ${request(W2, "now() + interval '5 days'", 'b')} ${request(ST1, AGO, 'a')} ${request(ST2, AGO, 'b')}
      ${request(CP1, AGO, 'a')} ${request(CC1, AGO, 'a')}`
    const steps: Step[] = [
      // withdraw (Kunde)
      as(U.cust2, 'aal1', 'W1 fremder Kunde', `public.withdraw('${W1}')`),
      as(U.pa, 'aal2', 'W1 Firma', `public.withdraw('${W1}')`),
      as(U.cust, 'aal1', 'W1 withdraw', `public.withdraw('${W1}')`),
      as(U.cust, 'aal1', 'W1 Wiederholung', `public.withdraw('${W1}')`),
      { name: 'W1 Status', sql: status(W1) },
      { name: 'W1 Ereignisse', sql: events(W1, 'withdrawn') },
      as(U.cust2, 'aal1', 'W1 fremder Kunde danach', `public.withdraw('${W1}')`),
      as(U.cust, 'aal1', 'W2 angenommen: nicht mehr zurückziehbar', `public.withdraw('${W2}')`),
      as(U.cust, 'aal1', 'W2 Wiederholung', `public.withdraw('${W2}')`),
      // start_job
      as(U.pa, 'aal1', 'ST1 aal1', `public.start_job('${ST1}')`),
      as(U.pb, 'aal2', 'ST1 fremde Firma', `public.start_job('${ST1}')`),
      as(U.pa, 'aal2', 'ST1 start', `public.start_job('${ST1}')`),
      as(U.pa, 'aal2', 'ST1 Wiederholung', `public.start_job('${ST1}')`),
      { name: 'ST1 Ereignisse', sql: events(ST1, 'in_progress') },
      as(U.pa2, 'aal2', 'ST1 anderes Mitglied', `public.start_job('${ST1}')`),
      as(U.pb, 'aal2', 'ST1 fremde Firma danach', `public.start_job('${ST1}')`),
      as(U.pa, 'aal1', 'ST1 Wiederholung aal1', `public.start_job('${ST1}')`),
      as(U.cust, 'aal1', 'ST1 Kunde meldet', `public.report_not_done('${ST1}')`),
      as(U.pa, 'aal2', 'ST1 Wiederholung nach Meldung', `public.start_job('${ST1}')`),
      { name: 'ST1 Status', sql: status(ST1) },
      { name: 'ST1 Ereignisse nach Meldung', sql: events(ST1, 'in_progress') },
      // Meldung vor dem ersten Start: weiter under_review
      as(U.cust, 'aal1', 'ST2 Kunde meldet', `public.report_not_done('${ST2}')`),
      as(U.pb, 'aal2', 'ST2 start nach Meldung', `public.start_job('${ST2}')`),
      // complete_job durch die Firma
      as(U.pa, 'aal2', 'CP1 start', `public.start_job('${CP1}')`),
      as(U.pa, 'aal1', 'CP1 aal1', `public.complete_job('${CP1}')`),
      as(U.pa, 'aal2', 'CP1 complete', `public.complete_job('${CP1}')`),
      as(U.pa, 'aal2', 'CP1 Wiederholung', `public.complete_job('${CP1}')`),
      { name: 'CP1 Status', sql: status(CP1) },
      { name: 'CP1 Ereignisse', sql: events(CP1, 'completed') },
      { name: 'CP1 Zuordnungen beendet', sql: `=${count(`public.assignments where request_id = '${CP1}' and ended_reason = 'completed'`)}` },
      as(U.pa2, 'aal2', 'CP1 anderes Mitglied', `public.complete_job('${CP1}')`),
      as(U.pb, 'aal2', 'CP1 fremde Firma', `public.complete_job('${CP1}')`),
      as(U.cust, 'aal1', 'CP1 Kunde nach Abschluss der Firma', `public.complete_job('${CP1}')`),
      as(U.pa, 'aal1', 'CP1 Wiederholung aal1', `public.complete_job('${CP1}')`),
      // complete_job durch den Kunden
      as(U.cust, 'aal1', 'CC1 complete', `public.complete_job('${CC1}')`),
      as(U.cust, 'aal1', 'CC1 Wiederholung', `public.complete_job('${CC1}')`),
      { name: 'CC1 Status', sql: status(CC1) },
      { name: 'CC1 Ereignisse', sql: events(CC1, 'completed') },
      as(U.cust2, 'aal1', 'CC1 fremder Kunde', `public.complete_job('${CC1}')`),
      as(U.pa, 'aal2', 'CC1 Firma nach Abschluss des Kunden', `public.complete_job('${CC1}')`),
    ]
    const r = probes(setup, steps)
    err(r['W1 fremder Kunde'], 'not_found')
    err(r['W1 Firma'], 'not_found')
    expect(r['W1 withdraw']).toBe('ok')
    expect(r['W1 Wiederholung'], 'withdraw Wiederholung').toBe('ok')
    val(r['W1 Status'], 'withdrawn')
    val(r['W1 Ereignisse'], '1')
    err(r['W1 fremder Kunde danach'], 'not_found')
    err(r['W2 angenommen: nicht mehr zurückziehbar'], 'invalid_transition')
    err(r['W2 Wiederholung'], 'invalid_transition')

    err(r['ST1 aal1'], 'mfa_required')
    err(r['ST1 fremde Firma'], 'not_assigned')
    expect(r['ST1 start']).toBe('ok')
    expect(r['ST1 Wiederholung'], 'start_job Wiederholung').toBe('ok')
    val(r['ST1 Ereignisse'], '1')
    err(r['ST1 anderes Mitglied'], 'invalid_transition')
    err(r['ST1 fremde Firma danach'], 'not_assigned')
    err(r['ST1 Wiederholung aal1'], 'mfa_required')
    expect(r['ST1 Kunde meldet']).toBe('ok')
    expect(r['ST1 Wiederholung nach Meldung'], 'start_job Wiederholung nach Meldung').toBe('ok')
    val(r['ST1 Status'], 'in_progress')
    val(r['ST1 Ereignisse nach Meldung'], '1')
    expect(r['ST2 Kunde meldet']).toBe('ok')
    err(r['ST2 start nach Meldung'], 'under_review')

    expect(r['CP1 start']).toBe('ok')
    err(r['CP1 aal1'], 'mfa_required')
    expect(r['CP1 complete']).toBe('ok')
    expect(r['CP1 Wiederholung'], 'complete_job (Firma) Wiederholung').toBe('ok')
    val(r['CP1 Status'], 'completed')
    val(r['CP1 Ereignisse'], '1')
    val(r['CP1 Zuordnungen beendet'], '1')
    err(r['CP1 anderes Mitglied'], 'not_found')
    err(r['CP1 fremde Firma'], 'not_found')
    err(r['CP1 Kunde nach Abschluss der Firma'], 'invalid_transition')
    err(r['CP1 Wiederholung aal1'], 'mfa_required')

    expect(r['CC1 complete']).toBe('ok')
    expect(r['CC1 Wiederholung'], 'complete_job (Kunde) Wiederholung').toBe('ok')
    val(r['CC1 Status'], 'completed')
    val(r['CC1 Ereignisse'], '1')
    err(r['CC1 fremder Kunde'], 'mfa_required') // kein Eigentümer: der Partnerzweig verlangt aal2
    err(r['CC1 Firma nach Abschluss des Kunden'], 'not_found')
  })
})

describe('Wiederholung nach Erfolg: withdraw_offer, withdraw_change', () => {
  it('Wiederholung ist ok ohne zweite Wirkung; Angebote und Nachträge, die ein anderer Weg beendete, behalten invalid_transition', () => {
    const [O1, O2, CH1, CH2] = [newId(), newId(), newId(), newId()]
    // Partner lesen job_listings nicht direkt: die Listing-IDs liegen als Einstellung bereit (wie in offers.test.ts)
    const stash = (req: string, key: string) => `select set_config('app.l_${key}', ${LID(req, 'a')}::text, true);`
    // die Revision des Nachtrags liest der Partner nicht direkt: die ID liegt als Einstellung bereit (Sicht des Eigentümers im Setup)
    const cid = (req: string) => `current_setting('app.c_${req.replaceAll('-', '')}')::uuid`
    const stashChange = (req: string) => `select set_config('app.c_${req.replaceAll('-', '')}', (select id::text from public.price_revisions where request_id = '${req}' and source = 'change_order'), true);`
    const setup = `${BASE} ${offerRequest(O1)} ${offerRequest(O2)} ${stash(O1, 'o1')} ${stash(O2, 'o2')} ${request(CH1, AGO, 'a')} ${receipt(CH1)} ${propose(CH1)}
      ${request(CH2, AGO, 'a')} ${receipt(CH2)} ${propose(CH2)} ${stashChange(CH1)} ${stashChange(CH2)}`
    const offers = (req: string, where: string) => `=${count(`public.partner_offers where request_id = '${req}' and ${where}`)}`
    const steps: Step[] = [
      // withdraw_offer
      as(U.pa, 'aal2', 'O1 Angebot', `set_config('app.o1', public.send_offer(current_setting('app.l_o1')::uuid, ${OFFER})::text, true)`),
      as(U.pa, 'aal2', 'O2 Angebot', `set_config('app.o2', public.send_offer(current_setting('app.l_o2')::uuid, ${OFFER})::text, true)`),
      as(U.pa, 'aal1', 'O1 aal1', `public.withdraw_offer(current_setting('app.o1')::uuid)`),
      as(U.pb, 'aal2', 'O1 fremde Firma', `public.withdraw_offer(current_setting('app.o1')::uuid)`),
      as(U.pa, 'aal2', 'O1 zurückgezogen', `public.withdraw_offer(current_setting('app.o1')::uuid)`),
      as(U.pa, 'aal2', 'O1 Wiederholung', `public.withdraw_offer(current_setting('app.o1')::uuid)`),
      { name: 'O1 zurückgezogen gezählt', sql: offers(O1, `status = 'withdrawn' and end_reason = 'partner_withdrawn'`) },
      { name: 'O1 Angebote', sql: offers(O1, 'true') },
      as(U.pb, 'aal2', 'O1 fremde Firma danach', `public.withdraw_offer(current_setting('app.o1')::uuid)`),
      as(U.pa, 'aal1', 'O1 Wiederholung aal1', `public.withdraw_offer(current_setting('app.o1')::uuid)`),
      // gleiche Firma, anderes Mitglied: die Firma ist die Partei (kein Akteur gespeichert, wie send_offer in 0068)
      as(U.pa2, 'aal2', 'O1 anderes Mitglied', `public.withdraw_offer(current_setting('app.o1')::uuid)`),
      // ein Angebot, das ein anderer Weg beendete, ist kein Rückzug der Firma
      { name: 'O2 beendet durch anderen Weg', sql: `update public.partner_offers set status = 'withdrawn', end_reason = 'partner_status', decided_at = now() where id = current_setting('app.o2')::uuid` },
      as(U.pa, 'aal2', 'O2 Rückzug', `public.withdraw_offer(current_setting('app.o2')::uuid)`),
      // withdraw_change
      as(U.pa, 'aal1', 'CH1 aal1', `public.withdraw_change(${cid(CH1)})`),
      as(U.pb, 'aal2', 'CH1 fremde Firma', `public.withdraw_change(${cid(CH1)})`),
      as(U.pa, 'aal2', 'CH1 zurückgezogen', `public.withdraw_change(${cid(CH1)})`),
      as(U.pa, 'aal2', 'CH1 Wiederholung', `public.withdraw_change(${cid(CH1)})`),
      { name: 'CH1 Status', sql: `=(select status::text from public.price_revisions where id = ${cid(CH1)})` },
      { name: 'CH1 Audit', sql: `=${count(`public.audit_log where action = 'withdraw_change' and entity_id = ${cid(CH1)}::text`)}` },
      { name: 'CH1 Outbox', sql: `=${count(`public.outbox where request_id = '${CH1}' and kind = 'change_withdrawn'`)}` },
      as(U.pb, 'aal2', 'CH1 fremde Firma danach', `public.withdraw_change(${cid(CH1)})`),
      as(U.pa, 'aal1', 'CH1 Wiederholung aal1', `public.withdraw_change(${cid(CH1)})`),
      // ein anderes Mitglied derselben Firma hat nicht zurückgezogen (der Audit trägt den Akteur)
      as(U.pa2, 'aal2', 'CH1 anderes Mitglied', `public.withdraw_change(${cid(CH1)})`),
      // ein Nachtrag, den ein anderer Weg auf withdrawn setzte, ohne Audit der Firma
      { name: 'CH2 anderer Weg', sql: `perform set_config('app.mv_change', ${cid(CH2)}::text || ':withdrawn', true); update public.price_revisions set status = 'withdrawn', decided_at = now() where id = ${cid(CH2)}; perform set_config('app.mv_change', '', true)` },
      as(U.pa, 'aal2', 'CH2 Rückzug', `public.withdraw_change(${cid(CH2)})`),
    ]
    const r = probes(setup, steps)
    expect(r['O1 Angebot']).toBe('ok')
    expect(r['O2 Angebot']).toBe('ok')
    err(r['O1 aal1'], 'mfa_required')
    err(r['O1 fremde Firma'], 'not_found')
    expect(r['O1 zurückgezogen']).toBe('ok')
    expect(r['O1 Wiederholung'], 'withdraw_offer Wiederholung').toBe('ok')
    val(r['O1 zurückgezogen gezählt'], '1')
    val(r['O1 Angebote'], '1')
    err(r['O1 fremde Firma danach'], 'not_found')
    err(r['O1 Wiederholung aal1'], 'mfa_required')
    expect(r['O1 anderes Mitglied'], 'ein Mitglied der Firma als Partei').toBe('ok')
    expect(r['O2 beendet durch anderen Weg']).toBe('ok')
    err(r['O2 Rückzug'], 'invalid_transition')

    err(r['CH1 aal1'], 'mfa_required')
    err(r['CH1 fremde Firma'], 'not_found')
    expect(r['CH1 zurückgezogen']).toBe('ok')
    expect(r['CH1 Wiederholung'], 'withdraw_change Wiederholung').toBe('ok')
    val(r['CH1 Status'], 'withdrawn')
    val(r['CH1 Audit'], '1')
    val(r['CH1 Outbox'], '1')
    err(r['CH1 fremde Firma danach'], 'not_found')
    err(r['CH1 Wiederholung aal1'], 'mfa_required')
    err(r['CH1 anderes Mitglied'], 'invalid_transition')
    expect(r['CH2 anderer Weg']).toBe('ok')
    err(r['CH2 Rückzug'], 'invalid_transition')
  })
})
