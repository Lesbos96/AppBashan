// my_job_changes() (s9i-7a, Migration 0058): Preisgrundlage und letzter Nachtrag der eigenen Firma je Auftrag, ohne Personendaten und ohne Gebühr.
// Dazu die vorgezogenen Prüfungen in propose_change_basis (Berater N1). Rollback-Proben (`probes`), es bleibt nichts zurück.
// Bestehende Tests des Servers (propose_change, decide_change, Rückzug, Ablauf): change-orders.test.ts, hier nicht wiederholt.
import { describe, expect, it } from 'vitest'
import { splitChange, splitFee } from '@pricing'
import { ownerSql, probes, type Step } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

const TODAY = "(now() at time zone 'Europe/Vienna')::date"
const cur = (key: string, col: string) => `(select ${col} from public.platform_settings where key = '${key}' and effective_from <= ${TODAY} order by effective_from desc, version desc limit 1)`
const RT = (() => {
  const r = ownerSql(`select ${cur('fee_rate', 'value::float8')} as fr, ${cur('fee_vat_rate', 'value::float8')} as vr, ${cur('fee_rate', 'version')} as frv, ${cur('fee_vat_rate', 'version')} as vrv`)[0] as { fr: number; vr: number; frv: number; vrv: number }
  return { ...r, rates: { feeRate: r.fr, vatRate: r.vr }, split: (t: number) => splitFee(t, { feeRate: r.fr, vatRate: r.vr }) }
})()

const U = { adm: newId(), cust: newId(), pa: newId(), pb: newId(), ph: newId(), ps: newId(), pp: newId(), pr: newId() }
const USERS = insertUsers(Object.values(U))
const OV = { districts: 'array[17, 18]::smallint[]' }
const FIRM = {
  a: firm(U.pa, 'a', 'active', U.adm, OV),
  b: firm(U.pb, 'b', 'active', U.adm, OV),
  h: firm(U.ph, 'h', 'active', U.adm, OV),
  s: firm(U.ps, 's', 'active', U.adm, OV),
  p: firm(U.pp, 'p', 'pending', U.adm, OV),
  r: firm(U.pr, 'r', 'rejected', U.adm, OV),
}
const BASE = (...keys: (keyof typeof FIRM)[]) => `${USERS} ${grantAdmin(U.adm)} ${keys.map((k) => FIRM[k]).join(' ')}`
const hold = (key: string, to: 'payment_hold' | 'suspended') =>
  `select set_config('app.mv_partner_status', ${P(key)}::text || ':active>${to}', true); update public.partners set status = '${to}', status_reason = 'Status für den Test' where id = ${P(key)}; select set_config('app.mv_partner_status', '', true);`

const SENTINEL = { name: 'Karl Sentinel', phone: '+43 660 7654321', email: 'sentinel@movenow.test', from: 'Sentinelgasse 1, 1070 Wien', to: 'Zielweg 2, 1100 Wien' }
const SENTINEL_RE = 'Sentinel|Zielweg|7654321|movenow\\.test'

const BOOKED = 68961
const INPUTS = '{"service":"move","crew":2,"hours":5}'
/** `jsonb::text` sortiert die Schlüssel nach Länge, dann alphabetisch, und schreibt „: “ und „, “. */
const JB = (crew: number, hours: number) => `{"crew": ${crew}, "hours": ${hours}, "service": "move"}`
const rev1 = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const CUR = (req: string) => `(select current_revision from public.service_requests where id = '${req}')`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const s0 = RT.split(BOOKED)
/** Festpreis 689,61 €, Eingaben `INPUTS`, Bezirk 17, Kontakt und Adressen (Sentinel); verteilt und von `key` angenommen. */
const accepted = (id: string, key: keyof typeof FIRM, user: string, termin = "now() + interval '14 days'") =>
  `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline, from_address, to_address)
     values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day', '${SENTINEL.from}', '${SENTINEL.to}');
   insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
     values ('${id}', 1, 'submit', '${INPUTS}', '{"kind":"price","totalCents":${BOOKED},"lowCents":${BOOKED},"highCents":${BOOKED},"lines":[],"terms":{"x":1}}', 1, ${BOOKED}, ${BOOKED}, ${BOOKED});
   update public.service_requests set current_revision = ${rev1(id)} where id = '${id}';
   insert into public.request_contacts (request_id, name, phone, email) values ('${id}', '${SENTINEL.name}', '${SENTINEL.phone}', '${SENTINEL.email}');
   select public.distribute_request('${id}');
   select public.partner_accept('${user}', ${LID(id, key)}, ${rev1(id)}, ${s0.payoutCents}, ${RT.fr}, ${RT.vr}, ${s0.feeCents}, ${s0.feeNetCents}, ${s0.feeVatCents}, ${s0.payoutCents}, ${RT.frv}, ${RT.vrv});`
const receipt = (req: string, key: string, n = 1) =>
  `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
     select '${req}', 'receipt', ${P(key)}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now() from generate_series(1, ${n});`
const PH = (req: string, key: string) => `array(select id from public.job_photos where request_id = '${req}' and kind = 'receipt' and uploaded_partner_id = ${P(key)} order by id)`
const propose = (req: string, total = 80000, inputs = '{"service":"move","crew":2,"hours":6}') =>
  `public.propose_change('${U.pa}', 'aal2', '${req}', ${CUR(req)}, '${inputs}'::jsonb, ${total}, ${PH(req, 'a')})`
const OPEN = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and source = 'change_order' and status = 'proposed')`
function decide(req: string, accept: boolean, total = 80000): string {
  const c = splitChange(total, RT.rates, RT.split(BOOKED))
  return `public.decide_change('${U.cust}', ${OPEN(req)}, ${accept}, ${accept ? total : 0}, ${RT.fr}, ${RT.vr}, ${c.feeCents}, ${c.feeNetCents}, ${c.feeVatCents}, ${c.payoutCents}, ${RT.frv}, ${RT.vrv})`
}

const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const as = (name: string, sub: string, sql: string): Step => ({ name, as: 'authenticated', claims: A2(sub), sql })
const svc = (name: string, sql: string): Step => ({ name, as: 'service_role', sql: `perform ${sql}` })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const rowsOf = (v: string | undefined, n: number) => expect(v, String(v)).toBe(`= ${n}`)
const noTrg = (sql: string) => `alter table public.price_revisions disable trigger user; ${sql}; alter table public.price_revisions enable trigger user`

const COLUMNS =
  'TABLE(request_id uuid, service service_type, source text, inputs jsonb, total_cents bigint, change_id uuid, change_status text, change_total_cents bigint, change_valid_until timestamp with time zone, change_decided_at timestamp with time zone, receipt_ids uuid[])'
const lineOf = (req: string) =>
  `=(select concat_ws('|', service, source, inputs::text, total_cents, coalesce(change_status, '-'), coalesce(change_total_cents::text, '-'), (change_valid_until is not null)::text, (change_decided_at is not null)::text, cardinality(receipt_ids)) from public.my_job_changes() where request_id = '${req}')`

describe('my_job_changes(): Zuordnung, Firmenstatus, Fenster, Spaltenliste', () => {
  it('A sieht Grundlage und Beleg-IDs des eigenen Auftrags; B, aal1, Kunde, pending, rejected, anon nicht; keine Personendaten, keine Gebühr', () => {
    const [R, RB, RO] = [newId(), newId(), newId()]
    const setup = `${BASE('a', 'b', 'p', 'r')} ${accepted(R, 'a', U.pa)} ${accepted(RB, 'b', U.pb)} ${accepted(RO, 'a', U.pa)}
      ${receipt(R, 'a', 2)} ${receipt(RB, 'b')}
      update public.assignments set ended_at = now() - interval '40 days', ended_reason = 'completed' where request_id = '${RO}'`
    const steps: Step[] = [
      { name: 'Ergebnisspalten', sql: `=(select pg_get_function_result('public.my_job_changes()'::regprocedure))` },
      { name: 'Rechte', sql: `=(select has_function_privilege('authenticated', 'public.my_job_changes()', 'execute')::text || has_function_privilege('anon', 'public.my_job_changes()', 'execute')::text || has_function_privilege('public', 'public.my_job_changes()', 'execute')::text)` },
      { name: 'Sicherheitsattribute', sql: `=(select prosecdef::text || ',' || coalesce(array_to_string(proconfig, ';'), '') from pg_proc where oid = 'public.my_job_changes()'::regprocedure)` },
      as('a Auftrag', U.pa, lineOf(R)),
      as('a Anzahl', U.pa, `=(select count(*) from public.my_job_changes())`),
      as('a Fenster', U.pa, `=(select count(*) from public.my_job_changes() where request_id = '${RO}')`),
      as('b Anzahl', U.pb, `=(select count(*) from public.my_job_changes())`),
      as('b sieht A nicht', U.pb, `=(select count(*) from public.my_job_changes() where request_id in ('${R}', '${RO}'))`),
      as('b Belege', U.pb, `=(select cardinality(receipt_ids) from public.my_job_changes() where request_id = '${RB}')`),
      { name: 'a aal1', as: 'authenticated', claims: A1(U.pa), sql: `perform * from public.my_job_changes()` },
      as('Kunde', U.cust, `perform * from public.my_job_changes()`),
      as('pending', U.pp, `perform * from public.my_job_changes()`),
      as('rejected', U.pr, `perform * from public.my_job_changes()`),
      { name: 'anon', as: 'anon', sql: `perform * from public.my_job_changes()` },
      { name: 'service_role', as: 'service_role', sql: `perform * from public.my_job_changes()` },
      as('keine Personendaten', U.pa, `=(select count(*) from public.my_job_changes() j where to_jsonb(j)::text ~* '${SENTINEL_RE}')`),
      as('keine Gebühr', U.pa, `=(select count(*) from public.my_job_changes() j, jsonb_object_keys(to_jsonb(j)) k where k ~* 'fee|commission|payout')`),
      { name: 'Kennzeichen vorhanden', sql: `=(select count(*) from public.request_contacts c join public.service_requests r on r.id = c.request_id where r.id = '${R}' and c.name = '${SENTINEL.name}' and r.from_address = '${SENTINEL.from}')` },
    ]
    const r = probes(setup, steps)
    expect(r['Ergebnisspalten']).toBe(`= ${COLUMNS}`)
    expect(r['Rechte']).toBe('= truefalsefalse')
    expect(r['Sicherheitsattribute']).toBe('= true,search_path=""')
    expect(r['a Auftrag']).toBe(`= move|submit|${JB(2, 5)}|${BOOKED}|-|-|false|false|2`)
    rowsOf(r['a Anzahl'], 1) // RO liegt außerhalb des Zugriffsfensters
    rowsOf(r['a Fenster'], 0)
    rowsOf(r['b Anzahl'], 1)
    rowsOf(r['b sieht A nicht'], 0)
    rowsOf(r['b Belege'], 1)
    err(r['a aal1'], 'mfa_required')
    for (const n of ['Kunde', 'pending', 'rejected']) err(r[n], 'partner_not_active')
    err(r['anon'], '42501')
    err(r['service_role'], 'not_found')
    rowsOf(r['keine Personendaten'], 0)
    rowsOf(r['keine Gebühr'], 0)
    rowsOf(r['Kennzeichen vorhanden'], 1)
  })

  it('payment_hold sieht seine Aufträge, suspended nichts', () => {
    const [RH, RS] = [newId(), newId()]
    const setup = `${BASE('a', 'h', 's')} ${accepted(RH, 'h', U.ph)} ${accepted(RS, 's', U.ps)} ${hold('h', 'payment_hold')} ${hold('s', 'suspended')}`
    const r = probes(setup, [
      as('payment_hold', U.ph, `=(select count(*) from public.my_job_changes() where request_id = '${RH}')`),
      as('payment_hold fremd', U.ph, `=(select count(*) from public.my_job_changes() where request_id = '${RS}')`),
      as('suspended', U.ps, `perform * from public.my_job_changes()`),
    ])
    rowsOf(r['payment_hold'], 1)
    rowsOf(r['payment_hold fremd'], 0)
    err(r['suspended'], 'partner_not_active')
  })
})

describe('my_job_changes(): Zustände des letzten Nachtrags', () => {
  it('offen, abgelehnt, neuer offener, angenommen: Zustand, Betrag, Eingaben der gültigen Revision', () => {
    const [R] = [newId()]
    const setup = `${BASE('a', 'b')} ${accepted(R, 'a', U.pa)} ${receipt(R, 'a')}`
    const r = probes(setup, [
      svc('Vorschlag', propose(R)),
      as('offen', U.pa, lineOf(R)),
      svc('Ablehnung', decide(R, false)),
      as('abgelehnt', U.pa, lineOf(R)),
      svc('zweiter Vorschlag', propose(R, 90000, '{"service":"move","crew":3,"hours":6}')),
      as('neuer offener', U.pa, lineOf(R)),
      svc('Annahme', decide(R, true, 90000)),
      as('angenommen', U.pa, lineOf(R)),
      as('b sieht nichts', U.pb, `=(select count(*) from public.my_job_changes())`),
    ])
    const base = (crew: number, hours: number, total: number, source: string, change: string) => `= move|${source}|${JB(crew, hours)}|${total}|${change}`
    expect(r['offen']).toBe(base(2, 5, BOOKED, 'submit', 'proposed|80000|true|false|1'))
    expect(r['abgelehnt']).toBe(base(2, 5, BOOKED, 'submit', 'declined|80000|true|true|1'))
    expect(r['neuer offener']).toBe(base(2, 5, BOOKED, 'submit', 'proposed|90000|true|false|1'))
    expect(r['angenommen']).toBe(base(3, 6, 90000, 'change_order', 'accepted|90000|true|true|1'))
    rowsOf(r['b sieht nichts'], 0)
  })
})

describe('propose_change_basis: Prüfungen vor der Vorschau (Berater N1)', () => {
  it('Festangebot, Spanne und offener Nachtrag scheitern schon in der Grundlage', () => {
    const [R, R2, R3] = [newId(), newId(), newId()]
    const setup = `${BASE('a')} ${accepted(R, 'a', U.pa)} ${accepted(R2, 'a', U.pa)} ${accepted(R3, 'a', U.pa)} ${receipt(R3, 'a')}`
    const basis = (req: string) => `perform * from public.propose_change_basis('${U.pa}', 'aal2', '${req}')`
    const r = probes(setup, [
      { name: 'Grundlage ok', as: 'service_role', sql: basis(R) },
      { name: 'Quelle Festangebot', sql: noTrg(`update public.price_revisions set source = 'partner_offer' where id = ${CUR(R)}`) },
      { name: 'Festangebot', as: 'service_role', sql: basis(R) },
      { name: 'Spanne', sql: noTrg(`update public.price_revisions set total_cents = null, low_cents = 60000, high_cents = 70000 where id = ${CUR(R2)}`) },
      { name: 'Spanne ohne Festpreis', as: 'service_role', sql: basis(R2) },
      svc('Vorschlag', propose(R3)),
      { name: 'offener Nachtrag', as: 'service_role', sql: basis(R3) },
    ])
    expect(r['Grundlage ok']).toBe('ok')
    err(r['Festangebot'], 'change_not_allowed')
    err(r['Spanne ohne Festpreis'], 'not_fixed_price')
    err(r['offener Nachtrag'], 'change_open')
  })
})
