// Nachtrag (S9f, Migration 0040). Rollback-Proben (`probes`), es bleibt nichts zurück. Beträge rechnen splitFee/splitChange aus @pricing.
// Nebenläufigkeit (zwei parallele Vorschläge, Annahme gegen Ablauf): tests/rls/change-orders-concurrency.test.ts.
import { describe, expect, it } from 'vitest'
import { splitChange, splitFee } from '@pricing'
import { probes, type Step } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId, P, setStatus } from '../support/partner.ts'

const RT = (() => {
  const r = currentFee()
  return { ...r, rates: { tiers: r.tiers, vatRate: r.vr }, split: (t: number) => splitFee(t, { tiers: r.tiers, vatRate: r.vr }) }
})()

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pb: newId() }
const USERS = insertUsers(Object.values(U))
// Bezirk 21: keine committete Firma (die Abdeckungsfirma lässt 17, 18 und 21 aus)
const OV = { districts: 'array[21]::smallint[]' }
const BASE = `${USERS} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)}`

const BOOKED = 68961
const rev1 = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const CUR = (req: string) => `(select current_revision from public.service_requests where id = '${req}')`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const s0 = RT.split(BOOKED)
/** Auftrag samt Revision 1 (Festpreis 68961), Bezirk 21, verteilt und von Firma a angenommen (Journal `booking`). */
const accepted = (id: string) =>
  `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
     values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 21, now() + interval '14 days', now() + interval '1 day');
   insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
     values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":${BOOKED},"lowCents":${BOOKED},"highCents":${BOOKED},"lines":[],"terms":{"x":1}}', 1, ${BOOKED}, ${BOOKED}, ${BOOKED});
   update public.service_requests set current_revision = ${rev1(id)} where id = '${id}';
   select public.distribute_request('${id}');
   select public.partner_accept('${U.pa}', ${LID(id, 'a')}, ${rev1(id)}, ${s0.payoutCents}, ${RT.vr}, ${s0.feeCents}, ${s0.feeNetCents}, ${s0.feeVatCents}, ${s0.payoutCents}, ${RT.fsv}, ${RT.vrv});`
const receipt = (req: string, key: string, n = 1) =>
  `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
     select '${req}', 'receipt', ${P(key)}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now() from generate_series(1, ${n});`
const PH = (req: string, key: string, n = 1) => `array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt' and uploaded_partner_id = ${P(key)} order by id limit ${n})`

type PO = { user?: string; aal?: string; base?: string; total?: number; photos?: string }
const propose = (req: string, o: PO = {}) =>
  `public.propose_change('${o.user ?? U.pa}', '${o.aal ?? 'aal2'}', '${req}', ${o.base ?? CUR(req)}, '{"hours":6}'::jsonb, ${o.total ?? 80000}, ${o.photos ?? PH(req, 'a')})`
/** `propose_change_replay` mit den Werten des Vorschlags `propose()`; je Feld überschreibbar. */
const replay = (req: string, o: { user?: string; req?: string; changes?: string; total?: number; photos?: string } = {}) =>
  `public.propose_change_replay('${o.user ?? U.pa}', '${o.req ?? req}', ${o.changes ?? `'{"hours":6}'::jsonb`}, ${o.total ?? 80000}, ${o.photos ?? PH(req, 'a')})`
const OPEN = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and source = 'change_order' and status = 'proposed')`
const ACC = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and source = 'change_order' and status = 'accepted' order by n desc limit 1)`

type DO = { user?: string; accept?: boolean | null; shown?: number; total?: number; prior?: number; version?: number; wrongParts?: boolean; rev?: string }
function decide(req: string, o: DO = {}): string {
  const total = o.total ?? 80000
  const c = splitChange(total, RT.rates, RT.split(o.prior ?? BOOKED))
  const [fee, vat, payout] = o.wrongParts ? [c.feeCents + 1, c.feeVatCents + 1, c.payoutCents - 1] : [c.feeCents, c.feeVatCents, c.payoutCents]
  return `public.decide_change('${o.user ?? U.cust}', ${o.rev ?? OPEN(req)}, ${o.accept === null ? 'null::boolean' : (o.accept ?? true)},${o.shown ?? total}, ${RT.vr}, ${fee}, ${c.feeNetCents}, ${vat}, ${payout}, ${o.version ?? RT.fsv}, ${RT.vrv})`
}

const count = (sql: string) => `(select count(*) from ${sql})`
const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const rows = (v: string | undefined, n: number) => expect(v, String(v)).toBe(`= ${n}`)
const ok = (v: string | undefined) => expect(v, String(v)).toBe('ok')
const named = (name: string, s: Omit<Step, 'name'>): Step => ({ name, ...s })
const svc = (name: string, sql: string): Step => ({ name, as: 'service_role', sql: `perform ${sql}` })
const noTrg = (sql: string) => `alter table public.price_revisions disable trigger user; ${sql}; alter table public.price_revisions enable trigger user`

describe('Vorschlag (propose_change)', () => {
  it('Erfolg mit Zeile, Frist, Outbox; verweigert: aal1, Fremde, kein Beleg, Betrag, Basis, zweiter offener, Rechte; Kunde sieht keine Gebühr', () => {
    const [R, R2] = [newId(), newId()]
    const setup = `${BASE} ${accepted(R)} ${accepted(R2)} ${receipt(R, 'a')} ${receipt(R, 'b')} ${receipt(R2, 'a')}`
    const steps: Step[] = [
      svc('aal1', propose(R, { aal: 'aal1' })),
      svc('Kunde', propose(R, { user: U.cust })),
      svc('fremde Firma', propose(R, { user: U.pb, photos: PH(R, 'b') })),
      svc('ohne Beleg', propose(R, { photos: "'{}'::uuid[]" })),
      svc('Beleg der fremden Firma', propose(R, { photos: PH(R, 'b') })),
      svc('Beleg einer anderen Anfrage', propose(R, { photos: PH(R2, 'a') })),
      svc('Beleg doppelt', propose(R, { photos: `array[(select id from public.job_photos where request_id = '${R}' and uploaded_partner_id = ${P('a')} limit 1), (select id from public.job_photos where request_id = '${R}' and uploaded_partner_id = ${P('a')} limit 1)]` })),
      svc('Betrag gleich', propose(R, { total: BOOKED })),
      svc('Betrag niedriger', propose(R, { total: BOOKED - 1 })),
      svc('Basis veraltet', propose(R, { base: 'gen_random_uuid()' })),
      named('authenticated darf nicht', { as: 'authenticated', claims: A2(U.pa), sql: `perform ${propose(R)}` }),
      named('anon darf nicht', { as: 'anon', sql: `perform ${propose(R)}` }),
      svc('Vorschlag', propose(R)),
      named('Zeile', {
        sql: `=(select concat_ws(',', status, n, source, (base_revision_id = ${rev1(R)}), (valid_until between now() + interval '1 hour 59 minutes' and now() + interval '2 hours'), price_version, cardinality(photos), total_cents, proposed_by = ${P('a')}) from public.price_revisions where id = ${OPEN(R)})`,
      }),
      named('Auftrag unverändert', { sql: `=(select concat_ws(',', status, (select n from public.price_revisions where id = current_revision)) from public.service_requests where id = '${R}')` }),
      svc('zweiter offener', propose(R, { total: 90000 })),
      // n12b: propose_change_replay liefert nach verlorener Antwort die Id des offenen Nachtrags nur bei gleichem Betrag, gleichen Eingaben und Belegen
      named('Replay', { as: 'service_role', sql: `=${replay(R)} = ${OPEN(R)}` }),
      named('Replay Belege als Menge', { as: 'service_role', sql: `=${replay(R, { photos: `array(select id from public.job_photos where request_id = '${R}' and uploaded_partner_id = ${P('a')} order by id desc)` })} = ${OPEN(R)}` }),
      named('Replay andere Firma', { as: 'service_role', sql: `=${replay(R, { user: U.pb })} is null` }),
      named('Replay Kunde', { as: 'service_role', sql: `=${replay(R, { user: U.cust })} is null` }),
      named('Replay anderer Betrag', { as: 'service_role', sql: `=${replay(R, { total: 90000 })} is null` }),
      named('Replay andere Eingabe', { as: 'service_role', sql: `=${replay(R, { changes: `'{"hours":7}'::jsonb` })} is null` }),
      named('Replay andere Belege', { as: 'service_role', sql: `=${replay(R, { photos: PH(R, 'b') })} is null` }),
      named('Replay andere Anfrage', { as: 'service_role', sql: `=${replay(R, { req: R2 })} is null` }),
      named('Replay NULL', { as: 'service_role', sql: `=public.propose_change_replay(null::uuid, '${R}', '{"hours":6}'::jsonb, 80000, ${PH(R, 'a')}) is null` }),
      // feste Ids statt der Unterabfrage auf job_photos: sonst endet die Probe schon am Leserecht der Tabelle, nicht an der Funktion
      named('Replay authenticated', { as: 'authenticated', claims: A2(U.pa), sql: `perform ${replay(R, { photos: `'{}'::uuid[]` })}` }),
      named('Replay anon', { as: 'anon', sql: `perform ${replay(R, { photos: `'{}'::uuid[]` })}` }),
      named('ein Nachtrag', { sql: `=${count(`public.price_revisions where request_id = '${R}' and source = 'change_order'`)}` }),
      named('Outbox Kunde', { sql: `=${count(`public.outbox where kind = 'change_proposed' and request_id = '${R}' and recipient_id = '${U.cust}'`)}` }),
      named('Kunde sieht den Vorschlag', { as: 'authenticated', claims: A2(U.cust), sql: `=${count(`public.price_revisions where request_id = '${R}' and source = 'change_order'`)}` }),
      named('Kunde: keine Gebühr in Spalten und Snapshot', {
        as: 'authenticated',
        claims: A2(U.cust),
        sql: `=(select count(*) from public.price_revisions v, jsonb_object_keys(to_jsonb(v)) k where v.request_id = '${R}' and k ~* 'fee|commission|payout')
          + (select count(*) from public.price_revisions v, jsonb_object_keys(v.snapshot) k where v.request_id = '${R}' and k ~* 'fee|commission|payout')`,
      }),
      named('Partner liest Revisionen nicht', { as: 'authenticated', claims: A2(U.pa), sql: `=${count(`public.price_revisions where request_id = '${R}'`)}` }),
      named('fremder Kunde sieht nichts', { as: 'authenticated', claims: A2(U.cust2), sql: `=${count(`public.price_revisions where request_id = '${R}' and source = 'change_order'`)}` }),
      named('Audit', { sql: `=${count(`public.audit_log where action = 'propose_change' and entity_id = ${OPEN(R)}::text`)}` }),
      named('Nachtrag läuft ab', { sql: noTrg(`update public.price_revisions set valid_until = now() - interval '1 minute' where id = ${OPEN(R)}`) }),
      named('Replay abgelaufen', { as: 'service_role', sql: `=${replay(R)} is null` }),
    ]
    const r = probes(setup, steps)
    err(r['aal1'], 'mfa_required')
    err(r['Kunde'], 'not_found')
    err(r['fremde Firma'], 'not_found')
    err(r['ohne Beleg'], 'receipt_required')
    err(r['Beleg der fremden Firma'], 'receipt_required')
    err(r['Beleg einer anderen Anfrage'], 'receipt_required')
    err(r['Beleg doppelt'], 'receipt_required')
    err(r['Betrag gleich'], 'change_not_increasing')
    err(r['Betrag niedriger'], 'change_not_increasing')
    err(r['Basis veraltet'], 'revision_changed')
    err(r['authenticated darf nicht'], '42501')
    err(r['anon darf nicht'], '42501')
    ok(r['Vorschlag'])
    expect(r['Zeile']).toBe('= proposed,2,change_order,t,t,1,1,80000,t')
    expect(r['Auftrag unverändert']).toBe('= accepted,1')
    err(r['zweiter offener'], 'change_open')
    expect(r['Replay']).toBe('= true')
    expect(r['Replay Belege als Menge']).toBe('= true')
    for (const k of ['andere Firma', 'Kunde', 'anderer Betrag', 'andere Eingabe', 'andere Belege', 'andere Anfrage', 'NULL']) expect(r[`Replay ${k}`], k).toBe('= true')
    err(r['Replay authenticated'], '42501')
    err(r['Replay anon'], '42501')
    expect(r['Replay abgelaufen']).toBe('= true')
    rows(r['ein Nachtrag'], 1)
    rows(r['Outbox Kunde'], 1)
    rows(r['Kunde sieht den Vorschlag'], 1)
    rows(r['Kunde: keine Gebühr in Spalten und Snapshot'], 0)
    rows(r['Partner liest Revisionen nicht'], 0)
    rows(r['fremder Kunde sieht nichts'], 0)
    rows(r['Audit'], 1)
  })

  it('Festangebot und Spanne: kein Nachtrag; Auftrag nicht angenommen; Firma suspended/payment_hold', () => {
    const [R, R2, R3] = [newId(), newId(), newId()]
    const setup = `${BASE} ${accepted(R)} ${accepted(R2)} ${accepted(R3)} ${receipt(R, 'a')} ${receipt(R2, 'a')} ${receipt(R3, 'a')}`
    const steps: Step[] = [
      named('Quelle Festangebot', { sql: noTrg(`update public.price_revisions set source = 'partner_offer' where id = ${CUR(R)}`) }),
      svc('Festangebot', propose(R)),
      named('Spanne', { sql: noTrg(`update public.price_revisions set total_cents = null, low_cents = 60000, high_cents = 70000 where id = ${CUR(R2)}`) }),
      svc('Spanne ohne Festpreis', propose(R2)),
      named('Auftrag completed', { sql: `perform private.set_request_status('${R3}', 'completed', '${U.cust}', 'customer')` }),
      svc('Auftrag abgeschlossen', propose(R3)),
    ]
    const r = probes(setup, steps)
    ok(r['Quelle Festangebot'])
    err(r['Festangebot'], 'change_not_allowed')
    ok(r['Spanne'])
    err(r['Spanne ohne Festpreis'], 'not_fixed_price')
    ok(r['Auftrag completed'])
    err(r['Auftrag abgeschlossen'], 'invalid_transition')

    const R4 = newId()
    const hold = probes(`${BASE} ${accepted(R4)} ${receipt(R4, 'a')}`, [
      named('payment_hold', { sql: `perform ${setStatus(U.adm, 'a', 'payment_hold').replace(/^select /, '').replace(/;$/, '')}` }),
      svc('Vorschlag in payment_hold', propose(R4)),
      named('suspended', { sql: `perform ${setStatus(U.adm, 'a', 'suspended', 'Sperre nach Zahlungsverzug im Test').replace(/^select /, '').replace(/;$/, '')}` }),
      svc('Vorschlag suspended', propose(R4, { total: 90000 })),
    ])
    ok(hold['payment_hold'])
    ok(hold['Vorschlag in payment_hold'])
    ok(hold['suspended'])
    err(hold['Vorschlag suspended'], 'partner_not_active')
  })

  it('Revision: kein Einfügen oder Ändern außerhalb der Funktionen; Snapshot ohne Gebühr, Bedingungen unverändert', () => {
    const R = newId()
    const ins = (over: { total?: number; snap?: string; marker?: string; n?: number; status?: string; version?: number }) =>
      `perform set_config('app.mv_change', ${over.marker ?? `'${R}:propose'`}, true);
       insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents, status, valid_until, base_revision_id, proposed_by, photos)
       values ('${R}', ${over.n ?? 2}, 'change_order', '{}',
         '${over.snap ?? `{"kind":"price","totalCents":${over.total ?? 80000},"lowCents":${over.total ?? 80000},"highCents":${over.total ?? 80000},"lines":[],"terms":{"x":1}}`}',
         ${over.version ?? 1}, ${over.total ?? 80000}, ${over.total ?? 80000}, ${over.total ?? 80000}, '${over.status ?? 'proposed'}', now() + interval '2 hours', ${rev1(R)}, ${P('a')},
         array[(select id from public.job_photos where request_id = '${R}' limit 1)])`
    const setup = `${BASE} ${accepted(R)} ${receipt(R, 'a')}`
    const steps: Step[] = [
      named('gültig mit Marker', { sql: ins({}) }),
      named('ohne Marker', { as: 'service_role', sql: ins({ marker: "''" }).replace(/^perform set_config[^;]*;/, '') }),
      named('authenticated', { as: 'authenticated', claims: A2(U.pa), sql: ins({}) }),
      named('Marker einer anderen Anfrage', { sql: ins({ marker: `'${newId()}:propose'` }) }),
      named('Betrag niedriger', { sql: ins({ total: BOOKED }) }),
      named('Snapshot mit Gebühr', { sql: ins({ snap: `{"kind":"price","totalCents":80000,"lowCents":80000,"highCents":80000,"lines":[],"terms":{"x":1},"feeCents":1}` }) }),
      named('Bedingungen geändert', { sql: ins({ snap: `{"kind":"price","totalCents":80000,"lowCents":80000,"highCents":80000,"lines":[],"terms":{"x":2}}` }) }),
      named('Status accepted beim Einfügen', { sql: ins({ status: 'accepted' }) }),
      named('n springt', { sql: ins({ n: 5 }) }),
      named('Zeile ändern: Betrag', { sql: `update public.price_revisions set total_cents = 1 where id = ${OPEN(R)}` }),
      named('Zeile ändern: Status ohne Marker', { sql: `update public.price_revisions set status = 'accepted' where id = ${OPEN(R)}` }),
      named('Zeile ändern: service_role', { as: 'service_role', sql: `update public.price_revisions set status = 'declined' where id = ${OPEN(R)}` }),
      named('Marker, aber Betrag mitgeändert', { sql: `perform set_config('app.mv_change', ${OPEN(R)}::text || ':declined', true); update public.price_revisions set status = 'declined', total_cents = 1 where id = ${OPEN(R)}` }),
      named('löschen', { sql: `delete from public.price_revisions where id = ${OPEN(R)}` }),
      named('Zeiger frei setzen', { sql: `update public.service_requests set current_revision = ${OPEN(R)} where id = '${R}'` }),
      named('Index: eine Journalzeile je Nachtrag', { sql: `=(select count(*) from pg_indexes where schemaname = 'public' and indexname = 'commission_change_once')` }),
    ]
    const r = probes(`${setup}`, steps)
    ok(r['gültig mit Marker'])
    err(r['ohne Marker'], 'invalid_revision')
    err(r['authenticated'], '42501')
    err(r['Marker einer anderen Anfrage'], 'invalid_revision')
    err(r['Betrag niedriger'], 'invalid_revision')
    err(r['Snapshot mit Gebühr'], 'invalid_revision')
    err(r['Bedingungen geändert'], 'invalid_revision')
    err(r['Status accepted beim Einfügen'], 'invalid_revision')
    err(r['n springt'], 'invalid_revision')
    err(r['Zeile ändern: Betrag'], 'revision_immutable')
    err(r['Zeile ändern: Status ohne Marker'], 'revision_immutable')
    err(r['Zeile ändern: service_role'], '42501')
    err(r['Marker, aber Betrag mitgeändert'], 'revision_immutable')
    err(r['löschen'], 'revision_immutable')
    err(r['Zeiger frei setzen'], 'invalid_revision_pointer')
    rows(r['Index: eine Journalzeile je Nachtrag'], 1)
  })
})

describe('Entscheidung des Kunden (decide_change)', () => {
  const s80 = RT.split(80000)

  it('Annahme: Zeiger, Journal (Summe = splitFee(neu), Satz der Buchung), Doppelklick, Gegenentscheidung; verweigert: Fremde, Betrag, Satz, Komponenten, Rechte', () => {
    const R = newId()
    const setup = `${BASE} ${accepted(R)} ${receipt(R, 'a')} select ${propose(R)};`
    const steps: Step[] = [
      svc('fremder Kunde', decide(R, { user: U.cust2 })),
      svc('Partner', decide(R, { user: U.pa })),
      svc('Betrag anders', decide(R, { shown: 79999 })),
      svc('falsche Version', decide(R, { version: RT.fsv + 1 })),
      svc('Komponenten falsch', decide(R, { wrongParts: true })),
      named('authenticated darf nicht', { as: 'authenticated', claims: A2(U.cust), sql: `perform ${decide(R)}` }),
      named('anon darf nicht', { as: 'anon', sql: `perform ${decide(R)}` }),
      named('nichts gebucht bis hier', { sql: `=${count(`public.commission_entries where request_id = '${R}' and kind = 'change'`)}` }),
      named('Annahme', { as: 'service_role', sql: `=${decide(R)}` }),
      named('Revision', { sql: `=(select concat_ws(',', status, decided_by = '${U.cust}', decided_at is not null) from public.price_revisions where request_id = '${R}' and n = 2)` }),
      named('Zeiger', { sql: `=(select concat_ws(',', v.n, v.source, v.total_cents, s.status) from public.service_requests s join public.price_revisions v on v.id = s.current_revision where s.id = '${R}')` }),
      named('Journal: change-Zeilen', { sql: `=${count(`public.commission_entries where request_id = '${R}' and kind = 'change'`)}` }),
      named('Journal: Summe Gebühr', { sql: `=(select sum(fee_cents) from public.commission_entries where request_id = '${R}')` }),
      named('Journal: Summe Gesamt', { sql: `=(select sum(total_cents) from public.commission_entries where request_id = '${R}')` }),
      named('Journal: Summe Auszahlung', { sql: `=(select sum(payout_cents) from public.commission_entries where request_id = '${R}')` }),
      named('Journal: Summe Netto', { sql: `=(select sum(fee_net_cents) from public.commission_entries where request_id = '${R}')` }),
      named('Journal: Satz der change-Zeile = Satz der Buchung', {
        sql: `=(select count(*) from public.commission_entries c join public.commission_entries b on b.request_id = c.request_id and b.kind = 'booking'
          where c.request_id = '${R}' and c.kind = 'change' and (c.fee_vat_rate, c.fee_schedule_version, c.fee_vat_rate_version, c.vat_rule) = (b.fee_vat_rate, b.fee_schedule_version, b.fee_vat_rate_version, b.vat_rule))`,
      }),
      named('Doppelklick', { as: 'service_role', sql: `=${decide(R, { rev: ACC(R) })}` }),
      named('nach Doppelklick weiter eine Zeile', { sql: `=${count(`public.commission_entries where request_id = '${R}' and kind = 'change'`)}` }),
      svc('Gegenentscheidung', decide(R, { rev: ACC(R), accept: false })),
      named('Outbox Partner', { sql: `=${count(`public.outbox where kind = 'change_accepted' and request_id = '${R}' and recipient_id = ${P('a')}`)}` }),
      named('Audit', { sql: `=${count(`public.audit_log where action = 'decide_change' and entity_id = ${ACC(R)}::text`)}` }),
      named('Kunde sieht Gebühr nicht', { as: 'authenticated', claims: A2(U.cust), sql: `=${count(`public.commission_entries`)}` }),
    ]
    const r = probes(setup, steps)
    err(r['fremder Kunde'], 'not_found')
    err(r['Partner'], 'not_found')
    err(r['Betrag anders'], 'shown_total_mismatch')
    err(r['falsche Version'], 'fee_basis_changed')
    err(r['Komponenten falsch'], 'amount_mismatch')
    err(r['authenticated darf nicht'], '42501')
    err(r['anon darf nicht'], '42501')
    rows(r['nichts gebucht bis hier'], 0)
    expect(r['Annahme']).toBe('= accepted')
    expect(r['Revision']).toBe('= accepted,t,t')
    expect(r['Zeiger']).toBe('= 2,change_order,80000,accepted')
    rows(r['Journal: change-Zeilen'], 1)
    rows(r['Journal: Summe Gebühr'], s80.feeCents)
    rows(r['Journal: Summe Gesamt'], 80000)
    rows(r['Journal: Summe Auszahlung'], s80.payoutCents)
    rows(r['Journal: Summe Netto'], s80.feeNetCents)
    rows(r['Journal: Satz der change-Zeile = Satz der Buchung'], 1)
    expect(r['Doppelklick']).toBe('= accepted')
    rows(r['nach Doppelklick weiter eine Zeile'], 1)
    err(r['Gegenentscheidung'], 'invalid_transition')
    rows(r['Outbox Partner'], 1)
    rows(r['Audit'], 1)
    rows(r['Kunde sieht Gebühr nicht'], 0)
  })

  it('Ablehnung bucht nichts; danach neuer Vorschlag; Kette: zwei angenommene Nachträge ergeben splitFee(letzter Preis)', () => {
    const R = newId()
    const setup = `${BASE} ${accepted(R)} ${receipt(R, 'a')} select ${propose(R)};`
    const s90 = RT.split(90000)
    const steps: Step[] = [
      named('Ablehnung', { as: 'service_role', sql: `=${decide(R, { accept: false })}` }),
      named('Revision declined', { sql: `=(select status::text from public.price_revisions where request_id = '${R}' and n = 2)` }),
      named('Zeiger unverändert', { sql: `=(select n from public.price_revisions where id = (select current_revision from public.service_requests where id = '${R}'))` }),
      named('kein change-Eintrag', { sql: `=${count(`public.commission_entries where request_id = '${R}' and kind = 'change'`)}` }),
      named('Outbox declined', { sql: `=${count(`public.outbox where kind = 'change_declined' and request_id = '${R}' and recipient_id = ${P('a')}`)}` }),
      svc('neuer Vorschlag', propose(R)),
      named('neues n', { sql: `=(select n from public.price_revisions where id = ${OPEN(R)})` }),
      named('Annahme zweiter Vorschlag', { as: 'service_role', sql: `=${decide(R)}` }),
      named('Zeiger auf n 3', { sql: `=(select n from public.price_revisions where id = (select current_revision from public.service_requests where id = '${R}'))` }),
      svc('dritter Vorschlag auf Basis des Nachtrags', propose(R, { total: 90000 })),
      named('Annahme dritter', { as: 'service_role', sql: `=${decide(R, { total: 90000, prior: 80000 })}` }),
      named('Zeiger auf n 4', { sql: `=(select n from public.price_revisions where id = (select current_revision from public.service_requests where id = '${R}'))` }),
      named('Kette: Summe Gebühr', { sql: `=(select sum(fee_cents) from public.commission_entries where request_id = '${R}')` }),
      named('Kette: Summe Gesamt', { sql: `=(select sum(total_cents) from public.commission_entries where request_id = '${R}')` }),
      named('Kette: Summe Auszahlung', { sql: `=(select sum(payout_cents) from public.commission_entries where request_id = '${R}')` }),
      named('Kette: Zeilen', { sql: `=${count(`public.commission_entries where request_id = '${R}'`)}` }),
    ]
    const r = probes(setup, steps)
    expect(r['Ablehnung']).toBe('= declined')
    expect(r['Revision declined']).toBe('= declined')
    rows(r['Zeiger unverändert'], 1)
    rows(r['kein change-Eintrag'], 0)
    rows(r['Outbox declined'], 1)
    ok(r['neuer Vorschlag'])
    rows(r['neues n'], 3)
    expect(r['Annahme zweiter Vorschlag']).toBe('= accepted')
    rows(r['Zeiger auf n 3'], 3)
    ok(r['dritter Vorschlag auf Basis des Nachtrags'])
    expect(r['Annahme dritter']).toBe('= accepted')
    rows(r['Zeiger auf n 4'], 4)
    rows(r['Kette: Summe Gebühr'], s90.feeCents)
    rows(r['Kette: Summe Gesamt'], 90000)
    rows(r['Kette: Summe Auszahlung'], s90.payoutCents)
    rows(r['Kette: Zeilen'], 3)
  })
})

describe('Rückzug, Ablauf, Auftragsende, Firma gesperrt', () => {
  it('Rückzug nur durch die vorschlagende Firma; Ablauf per expire_changes; Entscheidung nach Frist; Auftragsende schließt; Firma suspended: withdrawn', () => {
    const [R, R2, R3] = [newId(), newId(), newId()]
    // Partner dürfen Revisionen nicht lesen: die Rückzug-Schritte laufen als authenticated und nehmen die ID aus einer Einstellung
    const stash = (req: string) => `select set_config('app.o_${req.replaceAll('-', '')}', ${OPEN(req)}::text, true);`
    const setup = `${BASE} ${accepted(R)} ${accepted(R2)} ${accepted(R3)} ${receipt(R, 'a')} ${receipt(R2, 'a')} ${receipt(R3, 'a')} select ${propose(R)}; select ${propose(R2)}; select ${propose(R3)}; ${stash(R)}`
    const wd = (req: string) => `public.withdraw_change(current_setting('app.o_${req.replaceAll('-', '')}')::uuid)`
    const past = (req: string) => noTrg(`update public.price_revisions set valid_until = now() - interval '1 minute' where id = ${OPEN(req)}`)
    const steps: Step[] = [
      named('Rückzug aal1', { as: 'authenticated', claims: A1(U.pa), sql: `perform ${wd(R)}` }),
      named('Rückzug fremde Firma', { as: 'authenticated', claims: A2(U.pb), sql: `perform ${wd(R)}` }),
      named('Rückzug Kunde', { as: 'authenticated', claims: A2(U.cust), sql: `perform ${wd(R)}` }),
      named('anon', { as: 'anon', sql: `perform ${wd(R)}` }),
      named('Rückzug', { as: 'authenticated', claims: A2(U.pa), sql: `perform ${wd(R)}` }),
      named('Status withdrawn', { sql: `=(select status::text from public.price_revisions where request_id = '${R}' and n = 2)` }),
      named('Outbox withdrawn', { sql: `=${count(`public.outbox where kind = 'change_withdrawn' and request_id = '${R}' and recipient_id = '${U.cust}'`)}` }),
      named('zweiter Rückzug', { as: 'authenticated', claims: A2(U.pa), sql: `perform ${wd(R)}` }),
      svc('Entscheidung nach Rückzug', decide(R, { rev: `(select id from public.price_revisions where request_id = '${R}' and n = 2)` })),
      named('Frist vorbei', { sql: past(R2) }),
      svc('Entscheidung nach Frist', decide(R2)),
      named('expire_changes authenticated', { as: 'authenticated', claims: A2(U.pa), sql: `perform public.expire_changes()` }),
      named('expire_changes', { as: 'service_role', sql: `=public.expire_changes()` }),
      named('Status expired', { sql: `=(select status::text from public.price_revisions where request_id = '${R2}' and n = 2)` }),
      named('Outbox expired', { sql: `=${count(`public.outbox where kind = 'change_expired' and request_id = '${R2}' and recipient_id = ${P('a')}`)}` }),
      named('Auftrag completed', { sql: `perform private.set_request_status('${R3}', 'completed', '${U.cust}', 'customer')` }),
      named('Nachtrag durch Auftragsende expired', { sql: `=(select status::text from public.price_revisions where request_id = '${R3}' and n = 2)` }),
      named('Outbox Auftragsende', { sql: `=${count(`public.outbox where kind = 'change_expired' and request_id = '${R3}'`)}` }),
    ]
    const r = probes(setup, steps)
    err(r['Rückzug aal1'], 'mfa_required')
    err(r['Rückzug fremde Firma'], 'not_found')
    err(r['Rückzug Kunde'], 'not_found')
    err(r['anon'], '42501')
    ok(r['Rückzug'])
    expect(r['Status withdrawn']).toBe('= withdrawn')
    rows(r['Outbox withdrawn'], 1)
    err(r['zweiter Rückzug'], 'invalid_transition')
    err(r['Entscheidung nach Rückzug'], 'invalid_transition')
    ok(r['Frist vorbei'])
    err(r['Entscheidung nach Frist'], 'change_not_valid')
    err(r['expire_changes authenticated'], '42501')
    rows(r['expire_changes'], 1)
    expect(r['Status expired']).toBe('= expired')
    rows(r['Outbox expired'], 1)
    ok(r['Auftrag completed'])
    expect(r['Nachtrag durch Auftragsende expired']).toBe('= expired')
    rows(r['Outbox Auftragsende'], 1)

    const R4 = newId()
    const sus = probes(`${BASE} ${accepted(R4)} ${receipt(R4, 'a')} select ${propose(R4)};`, [
      named('Firma suspended', { sql: `perform ${setStatus(U.adm, 'a', 'suspended', 'Sperre nach Zahlungsverzug im Test').replace(/^select /, '').replace(/;$/, '')}` }),
      named('Annahme bei gesperrter Firma', { as: 'service_role', sql: `=${decide(R4)}` }),
      named('Nachtrag withdrawn', { sql: `=(select status::text from public.price_revisions where request_id = '${R4}' and n = 2)` }),
      named('kein change-Eintrag', { sql: `=${count(`public.commission_entries where request_id = '${R4}' and kind = 'change'`)}` }),
    ])
    expect(sus['Annahme bei gesperrter Firma']).toBe('= partner_not_active')
    expect(sus['Nachtrag withdrawn']).toBe('= withdrawn')
    rows(sus['kein change-Eintrag'], 0)
  })
})

describe('Abnahme S9f (0041)', () => {
  it('p_accept NULL; Rückzug ohne decided_by und mit Audit; Ablauf trifft nur offene Nachträge (mit Audit); Annahme bei payment_hold; eingefrorener Satz nach Satzwechsel; System-Rückzug mit Audit und Mail', () => {
    const [R, R2, R3, R4, R5] = [newId(), newId(), newId(), newId(), newId()]
    const all = [R, R2, R3, R4, R5]
    const stash = (req: string) => `select set_config('app.o_${req.replaceAll('-', '')}', ${OPEN(req)}::text, true);`
    const setup = `${BASE} ${all.map(accepted).join(' ')} ${all.map((q) => receipt(q, 'a')).join(' ')} ${all.map((q) => `select ${propose(q)};`).join(' ')} ${stash(R3)}`
    const hold = (reason: string, status: string) => `perform ${setStatus(U.adm, 'a', status, reason).replace(/^select /, '').replace(/;$/, '')}`
    const past = (id: string) => noTrg(`update public.price_revisions set valid_until = now() - interval '1 minute' where id = ${id}`)
    const today = "(now() at time zone 'Europe/Vienna')::date"
    const steps: Step[] = [
      svc('accept NULL', decide(R, { accept: null })),
      named('Rückzug R3', { as: 'authenticated', claims: A2(U.pa), sql: `perform public.withdraw_change(current_setting('app.o_${R3.replaceAll('-', '')}')::uuid)` }),
      named('decided_by leer', { sql: `=(select decided_by is null from public.price_revisions where request_id = '${R3}' and n = 2)` }),
      named('Audit Rückzug', { sql: `=${count(`public.audit_log where action = 'withdraw_change' and actor_role = 'partner' and actor_id = '${U.pa}' and detail ->> 'request_id' = '${R3}'`)}` }),
      named('R5 Frist vorbei', { sql: past(OPEN(R5)) }),
      named('expire_changes: nur R5', { as: 'service_role', sql: `=public.expire_changes()` }),
      named('Audit Ablauf', { sql: `=${count(`public.audit_log where action = 'expire_change' and actor_role = 'system' and detail ->> 'request_id' = '${R5}'`)}` }),
      named('payment_hold', { sql: hold('Zahlungssperre im Test', 'payment_hold') }),
      named('Annahme bei payment_hold', { as: 'service_role', sql: `=${decide(R)}` }),
      named('angenommenen Nachtrag rückdatieren', { sql: past(ACC(R)) }),
      named('expire_changes: Angenommenes bleibt', { as: 'service_role', sql: `=public.expire_changes()` }),
      named('keine Ablauf-Mail für den angenommenen', { sql: `=${count(`public.outbox where kind = 'change_expired' and request_id = '${R}'`)}` }),
      named('Satzwechsel', {
        sql: `insert into public.fee_schedules (version, valid_from, label) values (99, ${today}, 'test'); insert into public.fee_schedule_tiers (version, tier, up_to_cents, rate_bp) values (99, 1, null, 1000)`,
      }),
      svc('neue Version abgelehnt', decide(R2, { version: 99 })),
      named('Satz der Buchung gilt', { as: 'service_role', sql: `=${decide(R2)}` }),
      named('change-Zeile trägt die eingefrorene Version', { sql: `=(select fee_schedule_version = ${RT.fsv} from public.commission_entries where request_id = '${R2}' and kind = 'change')` }),
      named('suspended', { sql: hold('Sperre nach Zahlungsverzug im Test', 'suspended') }),
      named('System-Rückzug', { as: 'service_role', sql: `=${decide(R4)}` }),
      named('Audit System-Rückzug', { sql: `=${count(`public.audit_log where action = 'withdraw_change' and actor_role = 'system' and detail ->> 'request_id' = '${R4}'`)}` }),
      named('Mail an den Kunden', { sql: `=${count(`public.outbox where kind = 'change_withdrawn' and request_id = '${R4}' and recipient_id = '${U.cust}'`)}` }),
    ]
    const r = probes(setup, steps)
    err(r['accept NULL'], 'invalid_input')
    ok(r['Rückzug R3'])
    expect(r['decided_by leer']).toBe('= true')
    rows(r['Audit Rückzug'], 1)
    ok(r['R5 Frist vorbei'])
    rows(r['expire_changes: nur R5'], 1)
    rows(r['Audit Ablauf'], 1)
    ok(r['payment_hold'])
    expect(r['Annahme bei payment_hold']).toBe('= accepted')
    ok(r['angenommenen Nachtrag rückdatieren'])
    rows(r['expire_changes: Angenommenes bleibt'], 0)
    rows(r['keine Ablauf-Mail für den angenommenen'], 0)
    ok(r['Satzwechsel'])
    err(r['neue Version abgelehnt'], 'fee_basis_changed')
    expect(r['Satz der Buchung gilt']).toBe('= accepted')
    expect(r['change-Zeile trägt die eingefrorene Version']).toBe('= true')
    ok(r['suspended'])
    expect(r['System-Rückzug']).toBe('= partner_not_active')
    rows(r['Audit System-Rückzug'], 1)
    rows(r['Mail an den Kunden'], 1)
  })
})
