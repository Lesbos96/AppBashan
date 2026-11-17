// rj1 (OFFEN n12-2 + S9i6-5, 0072): Wiederholung nach Erfolg bei decline_listing (Firma) und reject_offers (Kunde). Je Funktion: erster Aufruf ok,
// Wiederholung derselben Partei ok (200) mit genau einer Wirkung (Status, Statusereignisse, Outbox gezählt, Zähler unverändert); fremder Aufrufer,
// fehlendes aal2 und jeder andere Weg zum Zustand behalten den bisherigen Fehler. Rollback-Proben, es bleibt nichts zurück.
// Rot-Beweis: vor 0072 antwortet jede Wiederholung mit invalid_transition (Ist-Wert: Aufruf scheitert statt ok).
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
const OFFER = 150000

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pb: newId() }
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${insertUsers(Object.values(U))} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}`

const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const count = (sql: string) => `(select count(*) from ${sql})`
const status = (req: string) => `=(select status::text from public.service_requests where id = '${req}')`
const events = (req: string, to?: string) => `=${count(`public.status_events where request_id = '${req}'${to ? ` and to_status = '${to}'` : ''}`)}`
const listings = (req: string, st: string) => `=${count(`public.job_listings where request_id = '${req}' and status = '${st}'`)}`
const offers = (req: string, st: string) => `=${count(`public.partner_offers where request_id = '${req}' and status = '${st}'`)}`

/** Festpreis-Anfrage an Firma a und b verteilt (requested); mit `by` von dieser Firma angenommen (die andere Listing wird geschlossen, eine Firma nimmt höchstens 5 offene Aufträge an). */
function request(id: string, by?: 'a' | 'b'): string {
  const snap = `{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[],${TERMS}}`
  const open = `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, now() + interval '5 days', now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');`
  if (!by) return open
  return `${open} select public.partner_accept('${by === 'a' ? U.pa : U.pb}', ${LID(id, by)}, ${rev(id)}, ${RT.s.payoutCents}, ${RT.vr}, ${RT.s.feeCents}, ${RT.s.feeNetCents}, ${RT.s.feeVatCents}, ${RT.s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}
/** Anfrage mit Spanne (Angebot der Firma nötig): awaiting_offer, an Firma a und b verteilt. */
const offerRequest = (id: string) =>
  `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'awaiting_offer', 17, now() + interval '5 days', now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '{"kind":"price","lowCents":100000,"highCents":200000,"lines":[],"terms":{"x":1}}', 1, null, 100000, 200000);
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    select public.distribute_request('${id}');`
// Partner lesen job_listings nicht direkt: die Listing-IDs liegen als Einstellung bereit (wie in offers.test.ts)
const stash = (req: string, key: 'a' | 'b') => `select set_config('app.l_${req.replaceAll('-', '')}_${key}', ${LID(req, key)}::text, true);`
const lid = (req: string, key: 'a' | 'b') => `current_setting('app.l_${req.replaceAll('-', '')}_${key}')::uuid`

/** Alles, was eine Wiederholung nicht verändern darf: gesamte Ereignisse, Outbox und Audit der Anfrage, `decided_at` der Listings und Angebote, Status. */
const snap = (req: string) =>
  `=(select concat_ws('|', (select count(*) from public.status_events where request_id = '${req}'), (select count(*) from public.outbox where request_id = '${req}'),
    (select count(*) from public.audit_log where entity_id = '${req}'), (select string_agg(decided_at::text, ',' order by id) from public.job_listings where request_id = '${req}'),
    (select string_agg(coalesce(decided_at::text, '-'), ',' order by id) from public.partner_offers where request_id = '${req}'),
    (select status::text from public.service_requests where id = '${req}')))`
// Die Probe läuft in einer Transaktion (now() ist konstant): ohne Zurückdatieren würde ein neu gesetztes `decided_at` nicht auffallen
const backdate = (req: string, nr: number): Step => ({
  name: `${req} decided_at zurückdatiert ${nr}`,
  sql: `update public.job_listings set decided_at = now() - interval '1 day' where request_id = '${req}' and decided_at is not null;
    update public.partner_offers set decided_at = now() - interval '1 day' where request_id = '${req}' and decided_at is not null`,
})

const as = (sub: string, aal: 'aal1' | 'aal2', name: string, sql: string): Step => ({ name, as: 'authenticated', claims: { sub, aal }, sql: `perform ${sql}` })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const val = (v: string | undefined, want: string) => expect(v, String(v)).toBe(`= ${want}`)

describe('Wiederholung nach Erfolg: decline_listing', () => {
  it('Wiederholung der Firma ist ok mit einer Wirkung (unmatched, Ereignis, Outbox je einmal); Fremde, aal1 und andere Wege behalten den Fehler', () => {
    const [D1, D2, D3, D4, D5] = [newId(), newId(), newId(), newId(), newId()]
    const setup = `${BASE} ${request(D1)} ${request(D2)} ${request(D3, 'a')} ${offerRequest(D4)} ${request(D5)}
      ${[D1, D2, D3, D4, D5].map((q) => `${stash(q, 'a')} ${stash(q, 'b')}`).join(' ')}`
    const dec = (u: string, aal: 'aal1' | 'aal2', name: string, req: string, key: 'a' | 'b') => as(u, aal, name, `public.decline_listing(${lid(req, key)})`)
    const steps: Step[] = [
      // D1: beide Firmen lehnen ab, jede wiederholt
      dec(U.pa, 'aal1', 'D1 aal1', D1, 'a'),
      dec(U.cust, 'aal2', 'D1 Kunde', D1, 'a'),
      dec(U.pb, 'aal2', 'D1 fremde Firma', D1, 'a'),
      dec(U.pa, 'aal2', 'D1 a lehnt ab', D1, 'a'),
      backdate(D1, 1),
      { name: 'D1 Zustand ohne T8 vorher', sql: snap(D1) },
      dec(U.pa, 'aal2', 'D1 a Wiederholung', D1, 'a'),
      { name: 'D1 Zustand ohne T8 nachher', sql: snap(D1) },
      { name: 'D1 Status nach a', sql: status(D1) },
      { name: 'D1 unmatched nach a', sql: events(D1, 'unmatched') },
      dec(U.pb, 'aal2', 'D1 b lehnt ab', D1, 'b'),
      { name: 'D1 Status', sql: status(D1) },
      backdate(D1, 2),
      { name: 'D1 Zustand mit T8 vorher', sql: snap(D1) },
      dec(U.pb, 'aal2', 'D1 b Wiederholung', D1, 'b'),
      dec(U.pa, 'aal2', 'D1 a Wiederholung nach unmatched', D1, 'a'),
      { name: 'D1 Zustand mit T8 nachher', sql: snap(D1) },
      { name: 'D1 Status danach', sql: status(D1) },
      { name: 'D1 unmatched', sql: events(D1, 'unmatched') },
      { name: 'D1 Outbox unmatched', sql: `=${count(`public.outbox where request_id = '${D1}' and kind = 'request_unmatched'`)}` },
      { name: 'D1 Listings abgelehnt', sql: listings(D1, 'declined') },
      dec(U.pa, 'aal1', 'D1 Wiederholung aal1', D1, 'a'),
      dec(U.pb, 'aal2', 'D1 fremde Firma danach', D1, 'a'),
      dec(U.cust, 'aal2', 'D1 Kunde danach', D1, 'a'),
      // D2: der Kunde hat zurückgezogen, die Listings sind geschlossen (nicht abgelehnt)
      as(U.cust, 'aal1', 'D2 Kunde zieht zurück', `public.withdraw('${D2}')`),
      dec(U.pa, 'aal2', 'D2 a nach Rückzug', D2, 'a'),
      { name: 'D2 Listings abgelehnt', sql: listings(D2, 'declined') },
      // D3: a hat angenommen, die Listing von b ist geschlossen
      dec(U.pa, 'aal2', 'D3 a angenommen', D3, 'a'), // Listing accepted, nicht declined
      dec(U.pb, 'aal2', 'D3 b geschlossen', D3, 'b'),
      { name: 'D3 Status', sql: status(D3) },
      // D4: gesendetes Angebot sperrt das Ablehnen, die andere Firma kann ablehnen
      as(U.pa, 'aal2', 'D4 Angebot', `public.send_offer(${lid(D4, 'a')}, ${OFFER})`),
      dec(U.pa, 'aal2', 'D4 a mit Angebot', D4, 'a'),
      dec(U.pb, 'aal2', 'D4 b lehnt ab', D4, 'b'),
      dec(U.pb, 'aal2', 'D4 b Wiederholung', D4, 'b'),
      { name: 'D4 Status', sql: status(D4) },
      { name: 'D4 Listings abgelehnt', sql: listings(D4, 'declined') },
      { name: 'D4 Angebote offen', sql: offers(D4, 'sent') },
      // D5: der Replay liegt hinter der Firmenprüfung: nach der Sperrung der Firma ist die Wiederholung nicht mehr möglich
      dec(U.pa, 'aal2', 'D5 a lehnt ab', D5, 'a'),
      { name: 'D5 Firma gesperrt', as: 'service_role', sql: `perform public.admin_set_partner_status('${U.adm}', ${P('a')}, 'suspended', 'Sperrung im Test rj1 nach Ablehnung')` },
      dec(U.pa, 'aal2', 'D5 Wiederholung gesperrte Firma', D5, 'a'),
    ]
    const r = probes(setup, steps)
    err(r['D1 aal1'], 'mfa_required')
    err(r['D1 Kunde'], 'partner_not_active')
    err(r['D1 fremde Firma'], 'not_found')
    expect(r['D1 a lehnt ab']).toBe('ok')
    expect(r['D1 a Wiederholung'], 'decline_listing Wiederholung vor unmatched').toBe('ok')
    val(r['D1 Status nach a'], 'requested')
    val(r['D1 unmatched nach a'], '0')
    expect(r['D1 b lehnt ab']).toBe('ok')
    val(r['D1 Status'], 'unmatched')
    expect(r['D1 b Wiederholung'], 'decline_listing Wiederholung nach unmatched').toBe('ok')
    expect(r['D1 a Wiederholung nach unmatched']).toBe('ok')
    expect(r['D1 Zustand ohne T8 nachher'], 'Wiederholung ohne T8 ändert nichts').toBe(r['D1 Zustand ohne T8 vorher'])
    expect(r['D1 Zustand mit T8 nachher'], 'Wiederholung nach T8 ändert nichts').toBe(r['D1 Zustand mit T8 vorher'])
    val(r['D1 Status danach'], 'unmatched')
    val(r['D1 unmatched'], '1')
    val(r['D1 Outbox unmatched'], '1')
    val(r['D1 Listings abgelehnt'], '2')
    err(r['D1 Wiederholung aal1'], 'mfa_required')
    err(r['D1 fremde Firma danach'], 'not_found')
    err(r['D1 Kunde danach'], 'partner_not_active')
    expect(r['D2 Kunde zieht zurück']).toBe('ok')
    err(r['D2 a nach Rückzug'], 'invalid_transition')
    val(r['D2 Listings abgelehnt'], '0')
    err(r['D3 a angenommen'], 'invalid_transition')
    err(r['D3 b geschlossen'], 'invalid_transition')
    val(r['D3 Status'], 'accepted')
    expect(r['D4 Angebot']).toBe('ok')
    err(r['D4 a mit Angebot'], 'offer_exists')
    expect(r['D4 b lehnt ab']).toBe('ok')
    expect(r['D4 b Wiederholung']).toBe('ok')
    val(r['D4 Status'], 'offered')
    val(r['D4 Listings abgelehnt'], '1')
    val(r['D4 Angebote offen'], '1')
    expect(r['D5 a lehnt ab']).toBe('ok')
    expect(r['D5 Firma gesperrt']).toBe('ok')
    err(r['D5 Wiederholung gesperrte Firma'], 'partner_not_active')
  })
})

describe('Wiederholung nach Erfolg: reject_offers', () => {
  it('Wiederholung des Kunden ist ok mit einer Wirkung; fremde Konten und andere Wege behalten den Fehler', () => {
    const [R1, R2, R3, R4, R5] = [newId(), newId(), newId(), newId(), newId()]
    const setup = `${BASE} ${offerRequest(R1)} ${offerRequest(R2)} ${offerRequest(R3)} ${offerRequest(R4)} ${offerRequest(R5)}
      ${[R1, R3, R4, R5].map((q) => `${stash(q, 'a')} ${stash(q, 'b')}`).join(' ')}`
    const rej = (u: string, name: string, req: string) => as(u, 'aal1', name, `public.reject_offers('${req}')`)
    const steps: Step[] = [
      // R1: zwei Angebote, der Kunde lehnt alle ab und wiederholt
      as(U.pa, 'aal2', 'R1 Angebot a', `public.send_offer(${lid(R1, 'a')}, ${OFFER})`),
      as(U.pb, 'aal2', 'R1 Angebot b', `public.send_offer(${lid(R1, 'b')}, ${OFFER + 1000})`),
      { name: 'R1 Status offered', sql: status(R1) },
      rej(U.cust2, 'R1 fremder Kunde', R1),
      rej(U.pa, 'R1 Firma', R1),
      rej(U.cust, 'R1 reject', R1),
      { name: 'R1 Status', sql: status(R1) },
      backdate(R1, 1),
      { name: 'R1 Zustand vorher', sql: snap(R1) },
      rej(U.cust, 'R1 Wiederholung', R1),
      { name: 'R1 Zustand nachher', sql: snap(R1) },
      { name: 'R1 Status danach', sql: status(R1) },
      { name: 'R1 declined', sql: events(R1, 'declined') },
      { name: 'R1 Angebote abgelehnt', sql: offers(R1, 'rejected') },
      rej(U.cust2, 'R1 fremder Kunde danach', R1),
      rej(U.pa, 'R1 Firma danach', R1),
      // R2: kein Angebot, Status awaiting_offer: weiter invalid_transition
      rej(U.cust, 'R2 ohne Angebot', R2),
      { name: 'R2 declined', sql: events(R2, 'declined') },
      // R3: der Kunde hat zurückgezogen (withdrawn): kein Replay von declined
      as(U.pa, 'aal2', 'R3 Angebot', `public.send_offer(${lid(R3, 'a')}, ${OFFER})`),
      as(U.cust, 'aal1', 'R3 Kunde zieht zurück', `public.withdraw('${R3}')`),
      rej(U.cust, 'R3 nach Rückzug', R3),
      { name: 'R3 declined', sql: events(R3, 'declined') },
      // R4 und R5: `declined` auf anderem Weg (andere Person, Systemakteur) ist kein Beweis der Partei: der Akteur des Ereignisses entscheidet
      as(U.pa, 'aal2', 'R4 Angebot', `public.send_offer(${lid(R4, 'a')}, ${OFFER})`),
      { name: 'R4 declined durch andere Person', sql: `perform private.set_request_status('${R4}', 'declined', '${U.cust2}', 'customer')` },
      rej(U.cust, 'R4 Kunde', R4),
      as(U.pa, 'aal2', 'R5 Angebot', `public.send_offer(${lid(R5, 'a')}, ${OFFER})`),
      { name: 'R5 declined durch System', sql: `perform private.set_request_status('${R5}', 'declined', null, 'system')` },
      rej(U.cust, 'R5 Kunde', R5),
    ]
    const r = probes(setup, steps)
    expect(r['R1 Angebot a']).toBe('ok')
    expect(r['R1 Angebot b']).toBe('ok')
    val(r['R1 Status offered'], 'offered')
    err(r['R1 fremder Kunde'], 'not_found')
    err(r['R1 Firma'], 'not_found')
    expect(r['R1 reject']).toBe('ok')
    val(r['R1 Status'], 'declined')
    expect(r['R1 Wiederholung'], 'reject_offers Wiederholung').toBe('ok')
    val(r['R1 Status danach'], 'declined')
    val(r['R1 declined'], '1')
    expect(r['R1 Zustand nachher'], 'Wiederholung ändert nichts').toBe(r['R1 Zustand vorher'])
    val(r['R1 Angebote abgelehnt'], '2')
    err(r['R1 fremder Kunde danach'], 'not_found')
    err(r['R1 Firma danach'], 'not_found')
    err(r['R2 ohne Angebot'], 'invalid_transition')
    val(r['R2 declined'], '0')
    expect(r['R3 Kunde zieht zurück']).toBe('ok')
    err(r['R3 nach Rückzug'], 'invalid_transition')
    val(r['R3 declined'], '0')
    expect(r['R4 Angebot']).toBe('ok')
    expect(r['R4 declined durch andere Person']).toBe('ok')
    err(r['R4 Kunde'], 'invalid_transition')
    expect(r['R5 Angebot']).toBe('ok')
    expect(r['R5 declined durch System']).toBe('ok')
    err(r['R5 Kunde'], 'invalid_transition')
  })

  // bl1 (OFFEN rj1-2, Muster 0066:83): ein gelöschtes Konto mit noch gültigem Token (PostgREST kennt gelöschte Sitzungen nicht) bekommt weder ok bei der Wiederholung noch eine Wirkung
  it('nach dem Löschen des Kontos: not_found bei Wiederholung und bei erstem Aufruf, keine Wirkung', () => {
    const [R1, R2] = [newId(), newId()]
    const setup = `${BASE} ${offerRequest(R1)} ${offerRequest(R2)} ${[R1, R2].map((q) => stash(q, 'a')).join(' ')}`
    const rej = (name: string, req: string) => as(U.cust, 'aal1', name, `public.reject_offers('${req}')`)
    const steps: Step[] = [
      as(U.pa, 'aal2', 'R1 Angebot', `public.send_offer(${lid(R1, 'a')}, ${OFFER})`),
      as(U.pa, 'aal2', 'R2 Angebot', `public.send_offer(${lid(R2, 'a')}, ${OFFER})`),
      rej('R1 reject', R1),
      // delete_account verweigert Konten mit offener Anfrage (open_requests): der Zustand „gelöscht“ ist hier das Profil mit deleted_at (so liest ihn auch 0066:83)
      { name: 'löschen', sql: `update public.profiles set deleted_at = now() where id = '${U.cust}'` },
      backdate(R2, 1),
      { name: 'R1 Zustand vorher', sql: snap(R1) },
      { name: 'R2 Zustand vorher', sql: snap(R2) },
      rej('R1 Wiederholung nach Löschung', R1),
      rej('R2 reject nach Löschung', R2),
      { name: 'R1 Zustand nachher', sql: snap(R1) },
      { name: 'R2 Zustand nachher', sql: snap(R2) },
    ]
    const r = probes(setup, steps)
    expect(r['R1 Angebot']).toBe('ok')
    expect(r['R2 Angebot']).toBe('ok')
    expect(r['R1 reject']).toBe('ok')
    expect(r['löschen']).toBe('ok')
    err(r['R1 Wiederholung nach Löschung'], 'not_found')
    err(r['R2 reject nach Löschung'], 'not_found')
    expect(r['R1 Zustand nachher']).toBe(r['R1 Zustand vorher'])
    expect(r['R2 Zustand nachher']).toBe(r['R2 Zustand vorher'])
  })
})
