// my_jobs() (s9i-6b, Migration 0057): die zugeordneten Aufträge der eigenen Firma, Spaltenliste festgenagelt, keine Personendaten.
// Rollback-Proben (`probes`), es bleibt nichts zurück. Termine sind Zeitpunkte relativ zur DB-Uhr (-2 Stunden, +14 Tage); entschieden wird
// nur per `now() >= termin_at`, kein Kalendertag-Vergleich, daher keine Tagesgrenze zu beachten.
import { describe, expect, it } from 'vitest'
import { splitChange, splitFee } from '@pricing'
import { probes, type Step } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

const TODAY = "(now() at time zone 'Europe/Vienna')::date"
const RT = (() => {
  const r = currentFee()
  return { ...r, split: splitFee(68961, { tiers: r.tiers, vatRate: r.vr }) }
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

// Kennzeichen, die nie im Ergebnis von my_jobs() stehen dürfen
const SENTINEL = { name: 'Karl Sentinel', phone: '+43 660 7654321', email: 'sentinel@movenow.test', door: 'Tür Sentinel 9', from: 'Sentinelgasse 1, 1070 Wien', to: 'Zielweg 2, 1100 Wien' }
const SENTINEL_RE = 'Sentinel|Zielweg|7654321|movenow\\.test'

const TERMS = '"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":6900,"termsHash":"x"}'

/** Festpreis 689,61 €, Bezirk 17, Standard: Termin in 14 Tagen. Mit Kontakt und Adressen (Sentinel). */
function request(id: string, termin = "now() + interval '14 days'"): string {
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline, from_address, to_address, preferred_date, time_window)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'requested', 17, ${termin}, now() + interval '1 day', '${SENTINEL.from}', '${SENTINEL.to}', ${TODAY}, 'morning');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[],${TERMS}}', 1, 68961, 68961, 68961);
    update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
    insert into public.request_contacts (request_id, name, phone, email, stairs_door) values ('${id}', '${SENTINEL.name}', '${SENTINEL.phone}', '${SENTINEL.email}', '${SENTINEL.door}');`
}
const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const s = RT.split
const LATE = 34481 // Stornobasis 50 % von 68961 (cancellation.test.ts)
const LATE_SPLIT = splitFee(LATE, { tiers: RT.tiers, vatRate: RT.vr })
/** Auftrag anlegen, an alle aktiven Firmen verteilen, `key` nimmt an. */
const accepted = (id: string, key: keyof typeof FIRM, user: string, termin?: string) =>
  `${request(id, termin)} select public.distribute_request('${id}');
   select public.partner_accept('${user}', ${LID(id, key)}, ${rev(id)}, ${s.payoutCents}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
/** Angenommen, gestartet, abgeschlossen; die Zuordnung endete vor `ago` (Eigentümer-Update, solange `ended_at` noch leer ist). */
const ended = (id: string, key: keyof typeof FIRM, user: string, ago: string) =>
  `${accepted(id, key, user)} select private.set_request_status('${id}', 'in_progress', null, 'partner'); select private.set_request_status('${id}', 'completed', null, 'partner');
   update public.assignments set ended_at = now() - interval '${ago}', ended_reason = 'completed' where request_id = '${id}';`
/** Storno durch den Kunden (T12) mit Stornobasis `base` (Stufe aus den Bedingungen im Snapshot), ausgeführt vom Eigentümer. */
const cancelled = (id: string, base: number) => {
  const c = splitFee(base, { tiers: RT.tiers, vatRate: RT.vr })
  return `select public.cancel_by_customer('${U.cust}', '${id}', ${base}, ${RT.vr}, ${c.feeCents}, ${c.feeNetCents}, ${c.feeVatCents}, ${c.payoutCents}, ${RT.fsv}, ${RT.vrv});`
}

const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const as = (name: string, sub: string, sql: string): Step => ({ name, as: 'authenticated', claims: A2(sub), sql })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const rowsOf = (v: string | undefined, n: number) => expect(v, String(v)).toBe(`= ${n}`)

const COLUMNS =
  'TABLE(assignment_id uuid, request_id uuid, listing_id uuid, status request_status, termin_at timestamp with time zone, accepted_at timestamp with time zone, ended_at timestamp with time zone, ended_reason assignment_end, district smallint, to_district smallint, service service_type, preferred_date date, time_window text, total_cents bigint, payout_cents bigint, can_start boolean, under_review boolean, en_route_eta timestamp with time zone, can_en_route boolean)'
const lineOf = (where: string) =>
  `=(select string_agg(status::text || ':' || can_start::text || ':' || coalesce(total_cents::text, '-') || ':' || coalesce(payout_cents::text, '-') || ':' || (ended_at is not null)::text, ',' order by termin_at, request_id) from public.my_jobs() where ${where})`

describe('my_jobs(): Zuordnung, Firmenstatus, Zugriffsfenster', () => {
  it('Firma A sieht nur eigene Aufträge im Zugriffsfenster mit Beträgen aus dem Journal; B, aal1, Kunde, pending, rejected, anon nichts', () => {
    const [R1, R2, RO, RN, RB, RC0, RC1] = [newId(), newId(), newId(), newId(), newId(), newId(), newId()]
    const setup = `${BASE('a', 'b', 'p', 'r')} ${accepted(R1, 'a', U.pa, "now() - interval '2 hours'")} ${accepted(R2, 'a', U.pa)} ${accepted(RB, 'b', U.pb)}
      ${ended(RO, 'a', U.pa, '40 days')} ${ended(RN, 'a', U.pa, '5 days')}
      ${accepted(RC0, 'a', U.pa, "now() + interval '5 days'")} ${cancelled(RC0, 0)} ${accepted(RC1, 'a', U.pa, "now() + interval '24 hours'")} ${cancelled(RC1, LATE)}`
    const steps: Step[] = [
      { name: 'Ergebnisspalten', sql: `=(select pg_get_function_result('public.my_jobs()'::regprocedure))` },
      { name: 'Rechte', sql: `=(select has_function_privilege('authenticated', 'public.my_jobs()', 'execute')::text || has_function_privilege('anon', 'public.my_jobs()', 'execute')::text || has_function_privilege('public', 'public.my_jobs()', 'execute')::text)` },
      { name: 'Sicherheitsattribute', sql: `=(select prosecdef::text || ',' || coalesce(array_to_string(proconfig, ';'), '') from pg_proc where oid = 'public.my_jobs()'::regprocedure)` },
      as('a Anzahl', U.pa, `=(select count(*) from public.my_jobs())`),
      as('a Aufträge', U.pa, lineOf(`request_id in ('${R1}', '${R2}')`)),
      as('a Fenster', U.pa, `=(select string_agg(request_id::text, ',' order by request_id) from public.my_jobs() where request_id in ('${RO}', '${RN}'))`),
      as('a beendet im Fenster', U.pa, lineOf(`request_id = '${RN}'`)),
      // Summen des Journals nach Storno: kostenlos 0, mit Stufe nur die Stornobasis und deren Auszahlung (nicht der Kundenpreis)
      as('a Storno kostenlos', U.pa, lineOf(`request_id = '${RC0}'`)),
      as('a Storno 50 %', U.pa, lineOf(`request_id = '${RC1}'`)),
      as('a Listing und Bezirk', U.pa, `=(select listing_id is not null and district = 17 and preferred_date is not null and time_window = 'morning' from public.my_jobs() where request_id = '${R1}')`),
      { name: 'Audit vorher', sql: `=(select count(*) from public.audit_log where action = 'contact_read')` },
      as('b Anzahl', U.pb, `=(select count(*) from public.my_jobs())`),
      as('b sieht A nicht', U.pb, `=(select count(*) from public.my_jobs() where request_id in ('${R1}', '${R2}', '${RO}', '${RN}'))`),
      { name: 'a aal1', as: 'authenticated', claims: A1(U.pa), sql: `=(select count(*) from public.my_jobs())` },
      as('Kunde', U.cust, `perform * from public.my_jobs()`),
      as('pending', U.pp, `perform * from public.my_jobs()`),
      as('rejected', U.pr, `perform * from public.my_jobs()`),
      { name: 'anon', as: 'anon', sql: `perform * from public.my_jobs()` },
      { name: 'service_role', as: 'service_role', sql: `perform * from public.my_jobs()` },
      { name: 'Audit nachher', sql: `=(select count(*) from public.audit_log where action = 'contact_read')` },
      as('keine Personendaten', U.pa, `=(select count(*) from public.my_jobs() j where to_jsonb(j)::text ~* '${SENTINEL_RE}')`),
      // Kontrolle: die Kennzeichen gibt es wirklich (der Eigentümer sieht sie), „0“ oben misst also die Spaltenliste
      { name: 'Kennzeichen vorhanden', sql: `=(select count(*) from public.request_contacts c join public.service_requests r on r.id = c.request_id where r.id = '${R1}' and c.name = '${SENTINEL.name}' and r.from_address = '${SENTINEL.from}')` },
    ]
    const r = probes(setup, steps)
    expect(r['Ergebnisspalten']).toBe(`= ${COLUMNS}`)
    expect(r['Rechte']).toBe('= truefalsefalse')
    expect(r['Sicherheitsattribute']).toBe('= true,search_path=""')
    // proconfig steht als `search_path=""` (leerer Pfad)
    rowsOf(r['a Anzahl'], 5) // R1, R2, RN, RC0, RC1; RO liegt außerhalb des Zugriffsfensters (30 Tage)
    expect(r['a Aufträge']).toBe(`= accepted:true:68961:${s.payoutCents}:false,accepted:false:68961:${s.payoutCents}:false`)
    expect(r['a Fenster']).toBe(`= ${RN}`)
    expect(r['a beendet im Fenster']).toBe(`= completed:false:68961:${s.payoutCents}:true`)
    expect(r['a Storno kostenlos']).toBe('= cancelled_by_customer:false:0:0:true')
    expect(r['a Storno 50 %']).toBe(`= cancelled_by_customer:false:${LATE}:${LATE_SPLIT.payoutCents}:true`)
    expect(r['a Listing und Bezirk']).toBe('= true')
    expect(r['Audit nachher'], 'my_jobs() schreibt keine Audit-Zeile').toBe(r['Audit vorher'])
    err(r['service_role'], '42501') // n15: EXECUTE für service_role entzogen (0066)
    rowsOf(r['b Anzahl'], 1)
    rowsOf(r['b sieht A nicht'], 0)
    err(r['a aal1'], 'mfa_required')
    for (const n of ['Kunde', 'pending', 'rejected']) err(r[n], 'partner_not_active')
    err(r['anon'], '42501')
    rowsOf(r['keine Personendaten'], 0)
    rowsOf(r['Kennzeichen vorhanden'], 1)
  })

  it('payment_hold sieht bereits angenommene Aufträge, suspended nichts', () => {
    const [RH, RS] = [newId(), newId()]
    const setup = `${BASE('a', 'h', 's')} ${accepted(RH, 'h', U.ph)} ${accepted(RS, 's', U.ps)} ${hold('h', 'payment_hold')} ${hold('s', 'suspended')}`
    const steps: Step[] = [
      as('payment_hold', U.ph, `=(select count(*) from public.my_jobs() where request_id = '${RH}')`),
      as('payment_hold fremd', U.ph, `=(select count(*) from public.my_jobs() where request_id = '${RS}')`),
      as('suspended', U.ps, `=(select count(*) from public.my_jobs())`),
      as('a', U.pa, `=(select count(*) from public.my_jobs())`),
    ]
    const r = probes(setup, steps)
    rowsOf(r['payment_hold'], 1)
    rowsOf(r['payment_hold fremd'], 0)
    err(r['suspended'], 'partner_not_active')
    rowsOf(r['a'], 0)
  })
})

describe('Beträge nach einem Nachtrag', () => {
  it('ein offener oder abgelehnter Nachtrag ändert die Summen nicht, ein angenommener hebt sie auf Gesamtpreis und Gesamtauszahlung', () => {
    const [R, RD] = [newId(), newId()]
    const rates = { tiers: RT.tiers, vatRate: RT.vr }
    const NEW_TOTAL = 80000
    const c = splitChange(NEW_TOTAL, rates, splitFee(68961, rates))
    const whole = splitFee(NEW_TOTAL, rates)
    const receipt = (id: string) =>
      `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at) values ('${id}', 'receipt', ${P('a')}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());`
    const propose = (id: string) =>
      `perform public.propose_change('${U.pa}', 'aal2', '${id}', (select current_revision from public.service_requests where id = '${id}'), '{"hours":6}'::jsonb, ${NEW_TOTAL}, array(select id from public.job_photos where request_id = '${id}' and kind = 'receipt'))`
    const open = (id: string) => `(select id from public.price_revisions where request_id = '${id}' and source = 'change_order' and status = 'proposed')`
    const decide = (id: string, yes: boolean) =>
      `perform public.decide_change('${U.cust}', ${open(id)}, ${yes}, ${NEW_TOTAL}, ${RT.vr}, ${c.feeCents}, ${c.feeNetCents}, ${c.feeVatCents}, ${c.payoutCents}, ${RT.fsv}, ${RT.vrv})`
    const setup = `${BASE('a')} ${accepted(R, 'a', U.pa)} ${accepted(RD, 'a', U.pa)} ${receipt(R)} ${receipt(RD)}`
    const was = `= accepted:false:68961:${s.payoutCents}:false`
    const steps: Step[] = [
      { name: 'vorher', as: 'authenticated', claims: A2(U.pa), sql: lineOf(`request_id = '${R}'`) },
      { name: 'Vorschlag R', as: 'service_role', sql: propose(R) },
      { name: 'Vorschlag RD', as: 'service_role', sql: propose(RD) },
      { name: 'offen', as: 'authenticated', claims: A2(U.pa), sql: lineOf(`request_id in ('${R}', '${RD}')`) },
      { name: 'Annahme', as: 'service_role', sql: decide(R, true) },
      { name: 'Ablehnung', as: 'service_role', sql: decide(RD, false) },
      { name: 'angenommen', as: 'authenticated', claims: A2(U.pa), sql: lineOf(`request_id = '${R}'`) },
      { name: 'abgelehnt', as: 'authenticated', claims: A2(U.pa), sql: lineOf(`request_id = '${RD}'`) },
      // Kontrolle: das Journal trägt zwei Zeilen (Buchung und Differenz); die Summe ist also wirklich eine Summe
      { name: 'Journalzeilen R', sql: `=(select count(*) from public.commission_entries where request_id = '${R}')` },
    ]
    const r = probes(setup, steps)
    expect(r['vorher']).toBe(was)
    expect(r['offen']).toBe(`${was},${was.slice(2)}`)
    expect(r['Annahme'], String(r['Annahme'])).toBe('ok')
    expect(r['angenommen']).toBe(`= accepted:false:${NEW_TOTAL}:${whole.payoutCents}:false`)
    expect(r['abgelehnt']).toBe(was)
    rowsOf(r['Journalzeilen R'], 2)
  })
})

describe('Kontakt, Start und Abschluss', () => {
  it('job_contact schreibt je Aufruf eine Audit-Zeile; Start vor dem Termin abgelehnt, Abschluss nur aus in_progress; my_jobs folgt dem Status', () => {
    const [R, RF] = [newId(), newId()]
    const setup = `${BASE('a', 'b')} ${accepted(R, 'a', U.pa, "now() - interval '2 hours'")} ${accepted(RF, 'a', U.pa)}`
    const audit = `=(select count(*) from public.audit_log where action = 'contact_read' and entity_id = '${R}')`
    const steps: Step[] = [
      { name: 'Audit vorher', sql: audit },
      as('Kontakt 1', U.pa, `=(select name || '|' || phone || '|' || from_address from public.job_contact('${R}'))`),
      as('Kontakt 2', U.pa, `perform * from public.job_contact('${R}')`),
      { name: 'Audit nachher', sql: audit },
      as('Kontakt fremde Firma', U.pb, `perform * from public.job_contact('${R}')`),
      { name: 'Audit unverändert', sql: audit },
      as('start vor Termin', U.pa, `perform public.start_job('${RF}')`),
      as('abschluss aus accepted', U.pa, `perform public.complete_job('${R}')`),
      as('vorher', U.pa, lineOf(`request_id = '${R}'`)),
      as('start', U.pa, `perform public.start_job('${R}')`),
      as('läuft', U.pa, lineOf(`request_id = '${R}'`)),
      as('start doppelt', U.pa, `perform public.start_job('${R}')`),
      as('abschluss', U.pa, `perform public.complete_job('${R}')`),
      as('beendet', U.pa, lineOf(`request_id = '${R}'`)),
      as('abschluss doppelt', U.pa, `perform public.complete_job('${R}')`),
      as('start nach Abschluss', U.pa, `perform public.start_job('${R}')`),
      as('Zukunft unberührt', U.pa, lineOf(`request_id = '${RF}'`)),
    ]
    const r = probes(setup, steps)
    rowsOf(r['Audit vorher'], 0)
    expect(r['Kontakt 1']).toBe(`= ${SENTINEL.name}|${SENTINEL.phone}|${SENTINEL.from}`)
    rowsOf(r['Audit nachher'], 2)
    err(r['Kontakt fremde Firma'], 'not_assigned')
    rowsOf(r['Audit unverändert'], 2)
    err(r['start vor Termin'], 'too_early')
    err(r['abschluss aus accepted'], 'invalid_transition')
    expect(r['vorher']).toBe(`= accepted:true:68961:${s.payoutCents}:false`)
    expect(r['start']).toBe('ok')
    expect(r['läuft']).toBe(`= in_progress:false:68961:${s.payoutCents}:false`)
    expect(r['start doppelt']).toBe('ok') // fh1 (0069): Wiederholung derselben Person nach Erfolg ist ok, ohne Wirkung (tests/rls/replay-rest.test.ts)
    expect(r['abschluss']).toBe('ok')
    expect(r['beendet']).toBe(`= completed:false:68961:${s.payoutCents}:true`)
    expect(r['abschluss doppelt']).toBe('ok') // fh1 (0069), wie start doppelt
    err(r['start nach Abschluss'], 'not_assigned')
    expect(r['Zukunft unberührt']).toBe(`= accepted:false:68961:${s.payoutCents}:false`)
  })
})
