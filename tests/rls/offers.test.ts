// Festangebot (S9e, Migration 0038). Rollback-Proben (`probes`), es bleibt nichts zurück. Beträge rechnet `splitFee` aus @pricing.
// Nebenläufigkeit (4 parallele Angebote, confirm gegen Annahme): tests/rls/offers-concurrency.test.ts.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { probes, type Step } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

const r0 = currentFee()
const split = (total: number) => splitFee(total, { tiers: r0.tiers, vatRate: r0.vr })

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pb: newId(), pc: newId(), ph: newId(), pend: newId() }
const USERS = insertUsers(Object.values(U))
const OV = { districts: 'array[17, 18]::smallint[]' }
const FIRM = {
  a: firm(U.pa, 'a', 'active', U.adm, OV),
  b: firm(U.pb, 'b', 'active', U.adm, OV),
  c: firm(U.pc, 'c', 'active', U.adm, OV),
  h: firm(U.ph, 'h', 'active', U.adm, OV),
  pend: firm(U.pend, 'pend', 'pending', U.adm, OV),
}
const BASE = (...keys: (keyof typeof FIRM)[]) => `${USERS} ${grantAdmin(U.adm)} ${keys.map((k) => FIRM[k]).join(' ')}`

type Req = { id: string; kind?: 'range' | 'free' | 'fixed'; termin?: string; toPoint?: boolean }
/** Auftrag samt Revision 1: range = Spanne 100000 bis 200000, free = Angebot ohne Spanne, fixed = Festpreis 68961. */
function request(o: Req): string {
  const kind = o.kind ?? 'range'
  const snap = { range: '{"kind":"price","lowCents":100000,"highCents":200000,"lines":[],"terms":{"x":1}}', free: '{"kind":"offer","lines":[]}', fixed: '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[]}' }[kind]
  const vals = { range: 'null, 100000, 200000', free: 'null, null, null', fixed: '68961, 68961, 68961' }[kind]
  const st = kind === 'fixed' ? 'requested' : 'awaiting_offer'
  const pt = o.toPoint ? 'extensions.st_setsrid(extensions.st_makepoint(16.3725, 48.2082), 4326)::extensions.geography' : 'null'
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline, to_point)
    values ('${o.id}', '${U.cust}', gen_random_uuid(), 'move', '${st}', 17, ${o.termin ?? "now() + interval '14 days'"}, now() + interval '1 day', ${pt});
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${o.id}', 1, 'submit', '{}', '${snap}', 1, ${vals});
    update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${o.id}' and n = 1) where id = '${o.id}';`
}
// Partner kennen die Auftrags-ID nicht (M2): send_offer nimmt die Listing-ID. Die Proben legen sie je Auftrag und Firma als Einstellung ab.
const KEYOF: Record<string, string> = { [U.pa]: 'a', [U.pb]: 'b', [U.pc]: 'c', [U.ph]: 'h', [U.pend]: 'pend', [U.cust]: 'a' }
const NONE = '00000000-0000-4000-8000-000000000000'
const stash = (req: string) =>
  ['a', 'b', 'c', 'h', 'pend']
    .map((k) => `select set_config('app.l_${req.replaceAll('-', '')}_${k}', coalesce((select id::text from public.job_listings where request_id = '${req}' and partner_id = nullif(current_setting('app.p_${k}', true), '')::uuid), '${NONE}'), true);`)
    .join(' ')
const SO = (u: string, req: string, amount: number) => `public.send_offer(current_setting('app.l_${req.replaceAll('-', '')}_${KEYOF[u]}')::uuid, ${amount})`
const dist = (req: string) => `select public.distribute_request('${req}'); ${stash(req)}`
const status = (req: string) => `(select status::text from public.service_requests where id = '${req}')`
const count = (sql: string) => `(select count(*) from ${sql})`
const OFF = (req: string, key: string) => `(select id from public.partner_offers where request_id = '${req}' and partner_id = ${P(key)} order by created_at desc limit 1)`
const ostat = (req: string, key: string) => `(select status::text from public.partner_offers where request_id = '${req}' and partner_id = ${P(key)} order by created_at desc limit 1)`
const send = (user: string, req: string, amount: number, aal: 'aal1' | 'aal2' = 'aal2'): Step => ({ name: '', as: 'authenticated', claims: { sub: user, aal }, sql: `perform ${SO(user, req, amount)}` })
const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const rows = (v: string | undefined, n: number) => expect(v, String(v)).toBe(`= ${n}`)
const ok = (v: string | undefined) => expect(v, String(v)).toBe('ok')
const named = (name: string, s: Omit<Step, 'name'>): Step => ({ ...s, name })
const sendAs = (name: string, user: string, req: string, amount: number, aal: 'aal1' | 'aal2' = 'aal2') => named(name, send(user, req, amount, aal))
const confirm = (user: string, req: string, key: string, o: { shown?: number; amount?: number } = {}) => {
  const amount = o.amount ?? 150000
  const sp = split(amount)
  return `public.confirm_offer('${user}', ${OFF(req, key)}, ${o.shown ?? amount}, ${r0.vr}, ${sp.feeCents}, ${sp.feeNetCents}, ${sp.feeVatCents}, ${sp.payoutCents}, ${r0.fsv}, ${r0.vrv})`
}
const suspendRaw = (key: string) =>
  `select set_config('app.mv_partner_status', ${P(key)}::text || ':active>suspended', true); update public.partners set status = 'suspended', status_reason = 'Sperre für den Test' where id = ${P(key)}; select set_config('app.mv_partner_status', '', true);`

describe('Angebot senden (send_offer)', () => {
  it('Spanne und freier Betrag, Grenzen, höchstens 3 offene, eines je Partner, Frist, Rechte', () => {
    const [R, RF, RP, RS] = [newId(), newId(), newId(), newId()]
    const setup = `${BASE('a', 'b', 'c', 'h', 'pend')} ${request({ id: R })} ${request({ id: RF, kind: 'free' })} ${request({ id: RP, kind: 'fixed' })}
      ${request({ id: RS, termin: "now() + interval '10 hours'" })} ${dist(R)} ${dist(RF)} ${dist(RP)} ${dist(RS)}`
    const steps: Step[] = [
      sendAs('unter der Spanne', U.pa, R, 99999),
      sendAs('über der Spanne', U.pa, R, 200001),
      sendAs('Betrag 0', U.pa, R, 0),
      sendAs('aal1', U.pa, R, 150000, 'aal1'),
      sendAs('Kunde', U.cust, R, 150000),
      sendAs('pending', U.pend, R, 150000),
      sendAs('Festpreis-Auftrag', U.pa, RP, 150000),
      sendAs('a', U.pa, R, 150000),
      named('Status offered', { sql: `=${status(R)}` }),
      sendAs('a zweites', U.pa, R, 120000),
      // n12b: dieselbe Wiederholung nach verlorener Antwort liefert die Id des ersten Angebots, ohne neue Zeile und ohne Mail
      named('a wiederholt', { as: 'authenticated', claims: A2(U.pa), sql: `perform set_config('app.n12b_offer', ${SO(U.pa, R, 150000)}::text, true)` }),
      named('a wiederholt: gleiche Id', { sql: `=current_setting('app.n12b_offer') = ${OFF(R, 'a')}::text` }),
      named('a Angebote', { sql: `=${count(`public.partner_offers where request_id = '${R}' and partner_id = ${P('a')}`)}` }),
      named('a Mails', { sql: `=${count(`public.outbox where kind = 'offer_new' and request_id = '${R}'`)}` }),
      sendAs('b', U.pb, R, 160000),
      sendAs('c', U.pc, R, 170000),
      sendAs('vierter', U.ph, R, 180000),
      named('3 offene', { sql: `=${count(`public.partner_offers where request_id = '${R}' and status = 'sent'`)}` }),
      named('Outbox Kunde', { sql: `=${count(`public.outbox where kind = 'offer_new' and request_id = '${R}' and recipient_id = '${U.cust}'`)}` }),
      sendAs('frei 800001', U.pa, RF, 800001),
      sendAs('frei 800000', U.pa, RF, 800000),
      sendAs('kurzer Termin', U.pa, RS, 150000),
      named('valid_until = Termin', { sql: `=(select o.valid_until = r.termin_at from public.partner_offers o join public.service_requests r on r.id = o.request_id where o.request_id = '${RS}')` }),
      named('valid_until 48 h', { sql: `=(select o.valid_until between now() + interval '47 hours 59 minutes' and now() + interval '48 hours' from public.partner_offers o where o.request_id = '${R}' and o.partner_id = ${P('a')})` }),
      named('Frist', { sql: `update public.service_requests set accept_deadline = accept_deadline where id = '${R}'` }),
      named('Betrag in Cent als int', { sql: `=(select data_type from information_schema.columns where table_name = 'partner_offers' and column_name = 'amount_cents')` }),
      named('anon', { as: 'anon', sql: `perform ${SO(U.pa, R, 150000)}` }),
    ]
    const r = probes(setup, steps)
    err(r['unter der Spanne'], 'amount_out_of_range')
    err(r['über der Spanne'], 'amount_out_of_range')
    err(r['Betrag 0'], 'amount_out_of_range')
    err(r['aal1'], 'mfa_required')
    err(r['Kunde'], 'partner_not_active')
    err(r['pending'], 'partner_not_active')
    err(r['Festpreis-Auftrag'], 'invalid_transition')
    ok(r['a'])
    expect(r['Status offered']).toBe('= offered')
    err(r['a zweites'], 'offer_exists')
    ok(r['a wiederholt'])
    expect(r['a wiederholt: gleiche Id']).toBe('= true')
    rows(r['a Angebote'], 1)
    rows(r['a Mails'], 1)
    ok(r['b'])
    ok(r['c'])
    err(r['vierter'], 'offer_limit')
    rows(r['3 offene'], 3)
    rows(r['Outbox Kunde'], 3)
    err(r['frei 800001'], 'amount_out_of_range')
    ok(r['frei 800000'])
    ok(r['kurzer Termin'])
    expect(r['valid_until = Termin']).toBe('= true')
    expect(r['valid_until 48 h']).toBe('= true')
    expect(r['Betrag in Cent als int']).toBe('= integer')
    err(r['anon'], '42501')
  })

  it('fail closed: fehlender Schlüssel offer_max_cents; Frist abgelaufen; Angebot nach Ablauf des eigenen möglich', () => {
    const [RF, R] = [newId(), newId()]
    const setup = `${BASE('a')} ${request({ id: RF, kind: 'free' })} ${request({ id: R })} ${dist(RF)} ${dist(R)}`
    const steps: Step[] = [
      sendAs('erstes', U.pa, R, 150000),
      named('Ablauf', { sql: `alter table public.partner_offers disable trigger user; update public.partner_offers set valid_until = now() - interval '1 minute' where request_id = '${R}'; alter table public.partner_offers enable trigger user` }),
      sendAs('neues nach Ablauf', U.pa, R, 140000),
      named('zwei Zeilen', { sql: `=${count(`public.partner_offers where request_id = '${R}'`)}` }),
      named('Schlüssel fehlt', { sql: `update public.platform_settings set effective_from = (now() at time zone 'Europe/Vienna')::date + 30 where key = 'offer_max_cents'` }),
      sendAs('frei ohne Schlüssel', U.pa, RF, 1000),
      named('Frist vorbei', { sql: `set constraints all immediate; alter table public.service_requests disable trigger guard_request_fields; update public.service_requests set accept_deadline = now() - interval '1 minute' where id = '${R}'; alter table public.service_requests enable trigger guard_request_fields` }),
      sendAs('nach Frist', U.pa, R, 130000),
    ]
    const r = probes(setup, steps)
    ok(r['erstes'])
    ok(r['Ablauf'])
    ok(r['neues nach Ablauf'])
    rows(r['zwei Zeilen'], 2)
    ok(r['Schlüssel fehlt'])
    err(r['frei ohne Schlüssel'], 'setting_missing')
    err(r['nach Frist'], 'expired')
  })
})

describe('Rechte und Unveränderlichkeit', () => {
  it('Kunde sieht nur Firmenname, Betrag, Frist; keine Direktzugriffe; Angebote unveränderlich; Revision nur aus gültigem Angebot', () => {
    const R = newId()
    const setup = `${BASE('a', 'b')} ${request({ id: R })} ${dist(R)}
      select set_config('request.jwt.claims', '{"sub":"${U.pa}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select ${SO(U.pa, R, 150000)}; reset role;`
    const steps: Step[] = [
      named('Kunde sieht', { as: 'authenticated', claims: A2(U.cust), sql: `=${count(`public.my_request_offers('${R}')`)}` }),
      named('Spalten', { as: 'authenticated', claims: A2(U.cust), sql: `=(select string_agg(k, ',' order by k) from jsonb_object_keys((select to_jsonb(o) from public.my_request_offers('${R}') o limit 1)) k)` }),
      named('anderer Kunde', { as: 'authenticated', claims: A2(U.cust2), sql: `=${count(`public.my_request_offers('${R}')`)}` }),
      named('Partner über RPC', { as: 'authenticated', claims: A2(U.pa), sql: `=${count(`public.my_request_offers('${R}')`)}` }),
      named('Kunde Direktzugriff', { as: 'authenticated', claims: A2(U.cust), sql: `=${count('public.partner_offers')}` }),
      named('Partner eigene', { as: 'authenticated', claims: A2(U.pa), sql: `=${count('public.partner_offers')}` }),
      named('Partner fremde', { as: 'authenticated', claims: A2(U.pb), sql: `=${count('public.partner_offers')}` }),
      named('Partner aal1', { as: 'authenticated', claims: A1(U.pa), sql: `=${count('public.partner_offers')}` }),
      named('request_id gesperrt', { as: 'authenticated', claims: A2(U.pa), sql: `perform request_id from public.partner_offers` }),
      named('Betrag lesbar', { as: 'authenticated', claims: A2(U.pa), sql: `=(select amount_cents from public.partner_offers limit 1)` }),
      named('INSERT', { as: 'authenticated', claims: A2(U.pa), sql: `insert into public.partner_offers (request_id, partner_id) values ('${R}', ${P('a')})` }),
      named('UPDATE authenticated', { as: 'authenticated', claims: A2(U.pa), sql: `update public.partner_offers set amount_cents = 1` }),
      named('UPDATE service_role', { as: 'service_role', sql: `update public.partner_offers set amount_cents = 1` }),
      named('UPDATE Eigentümer Betrag', { sql: `update public.partner_offers set amount_cents = 1` }),
      named('UPDATE Eigentümer Frist', { sql: `update public.partner_offers set valid_until = valid_until + interval '1 day'` }),
      named('DELETE Eigentümer', { sql: `delete from public.partner_offers` }),
      named('Revision ohne Angebot', { sql: `insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents) values ('${R}', 2, 'partner_offer', '{}', '{"kind":"price","totalCents":120000,"lowCents":120000,"highCents":120000}', 1, 120000, 120000, 120000)` }),
      named('Revision falscher Betrag', { sql: `insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents) values ('${R}', 2, 'partner_offer', '{}', '{"kind":"price","totalCents":150001,"lowCents":150001,"highCents":150001}', 1, 150001, 150001, 150001)` }),
      named('Zeiger frei', { sql: `update public.service_requests set current_revision = null where id = '${R}'` }),
    ]
    const r = probes(setup, steps)
    rows(r['Kunde sieht'], 1)
    expect(r['Spalten']).toBe('= amount_cents,company_name,offer_id,status,valid_until')
    rows(r['anderer Kunde'], 0)
    rows(r['Partner über RPC'], 0)
    rows(r['Kunde Direktzugriff'], 0)
    rows(r['Partner eigene'], 1)
    rows(r['Partner fremde'], 0)
    rows(r['Partner aal1'], 0)
    err(r['request_id gesperrt'], '42501')
    rows(r['Betrag lesbar'], 150000)
    err(r['INSERT'], '42501')
    err(r['UPDATE authenticated'], '42501')
    err(r['UPDATE service_role'], '42501')
    err(r['UPDATE Eigentümer Betrag'], 'offer_immutable')
    err(r['UPDATE Eigentümer Frist'], 'offer_immutable')
    err(r['DELETE Eigentümer'], 'offer_immutable')
    err(r['Revision ohne Angebot'], 'invalid_revision')
    err(r['Revision falscher Betrag'], 'invalid_revision')
    err(r['Zeiger frei'], 'invalid_revision_pointer')
  })
})

describe('Version des Angebots (s9p-1, Fable M2)', () => {
  it('Angebot erbt die beim Senden geltende Version: nach einem Versionswechsel gilt für alte Angebote die alte, für neue die neue; Version unveränderlich', () => {
    const [R, R2] = [newId(), newId()]
    const V99: FeeTierLike[] = [{ upToCents: null, bp: 1000 }]
    const sp99 = splitFee(150000, { tiers: V99, vatRate: r0.vr })
    const confirmV = (req: string, key: string, sp: ReturnType<typeof split>, fsv: number) =>
      `public.confirm_offer('${U.cust}', ${OFF(req, key)}, 150000, ${r0.vr}, ${sp.feeCents}, ${sp.feeNetCents}, ${sp.feeVatCents}, ${sp.payoutCents}, ${fsv}, ${r0.vrv})`
    const today = "(now() at time zone 'Europe/Vienna')::date"
    const setup = `${BASE('a', 'b', 'c')} ${request({ id: R })} ${request({ id: R2 })} ${dist(R)} ${dist(R2)}
      select set_config('request.jwt.claims', '{"sub":"${U.pa}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select ${SO(U.pa, R, 150000)}; reset role;
      select set_config('request.jwt.claims', '{"sub":"${U.pb}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select ${SO(U.pb, R, 160000)}; reset role;`
    const steps: Step[] = [
      named('Version gespeichert', { sql: `=(select fee_schedule_version from public.partner_offers where id = ${OFF(R, 'a')})` }),
      named('Versionswechsel', {
        sql: `insert into public.fee_schedules (version, valid_from, label) values (99, ${today}, 'test'); insert into public.fee_schedule_tiers (version, tier, up_to_cents, rate_bp) values (99, 1, null, 1000)`,
      }),
      named('Geltende Version', { sql: '=private.current_fee_schedule()' }),
      named('Basis alt: Version und Stufen des Angebots', { as: 'service_role', sql: `=(select fee_schedule_version || '/' || (fee_tiers = '${JSON.stringify(r0.tiers)}'::jsonb) from public.confirm_offer_basis('${U.cust}', ${OFF(R, 'a')}))` }),
      named('confirm mit geltender Version 99', { as: 'service_role', sql: `perform ${confirmV(R, 'a', split(150000), 99)}` }),
      named('confirm mit Angebotsversion', { as: 'service_role', sql: `=${confirmV(R, 'a', split(150000), r0.fsv)}` }),
      named('Journal alt: Version und Gebühr', { sql: `=(select fee_schedule_version || '/' || fee_cents from public.commission_entries where request_id = '${R}' and kind = 'booking')` }),
      named('Version ändern beim Statuswechsel', { sql: `update public.partner_offers set status = 'withdrawn', fee_schedule_version = 99 where id = ${OFF(R, 'b')}` }),
      sendAs('neues Angebot nach dem Wechsel', U.pc, R2, 150000),
      named('Version neu', { sql: `=(select fee_schedule_version from public.partner_offers where id = ${OFF(R2, 'c')})` }),
      named('confirm neu mit Version 2', { as: 'service_role', sql: `perform ${confirmV(R2, 'c', split(150000), r0.fsv)}` }),
      named('confirm neu mit Version 99', { as: 'service_role', sql: `=${confirmV(R2, 'c', sp99, 99)}` }),
      named('Journal neu: Version und Gebühr', { sql: `=(select fee_schedule_version || '/' || fee_cents from public.commission_entries where request_id = '${R2}' and kind = 'booking')` }),
    ]
    const r = probes(setup, steps)
    expect(r['Version gespeichert']).toBe(`= ${r0.fsv}`)
    ok(r['Versionswechsel'])
    expect(r['Geltende Version']).toBe('= 99')
    expect(r['Basis alt: Version und Stufen des Angebots']).toBe(`= ${r0.fsv}/true`)
    err(r['confirm mit geltender Version 99'], 'rate_mismatch')
    expect(r['confirm mit Angebotsversion']).toBe('= confirmed')
    expect(r['Journal alt: Version und Gebühr']).toBe(`= ${r0.fsv}/${split(150000).feeCents}`)
    err(r['Version ändern beim Statuswechsel'], 'offer_immutable')
    ok(r['neues Angebot nach dem Wechsel'])
    expect(r['Version neu']).toBe('= 99')
    err(r['confirm neu mit Version 2'], 'rate_mismatch')
    expect(r['confirm neu mit Version 99']).toBe('= confirmed')
    expect(r['Journal neu: Version und Gebühr']).toBe(`= 99/${sp99.feeCents}`)
    expect(sp99.feeCents).toBe(15000) // 10 % flach auf 150000 (Gegenprobe: Version 2 ergäbe 14500)
  })
})

type FeeTierLike = { upToCents: number | null; bp: number }

describe('Bestätigung (confirm_offer)', () => {
  const sp = split(150000)
  it('Erfolg: Revision, Zeiger, Journal, Zuordnung, Listings, Ereignis, Audit, Outbox; ohne Gebühr im Snapshot; doppelt = einmal', () => {
    const R = newId()
    const setup = `${BASE('a', 'b', 'c')} ${request({ id: R })} ${dist(R)}
      select set_config('request.jwt.claims', '{"sub":"${U.pa}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select ${SO(U.pa, R, 150000)}; reset role;
      select set_config('request.jwt.claims', '{"sub":"${U.pb}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select ${SO(U.pb, R, 160000)}; reset role;`
    const steps: Step[] = [
      named('Basis', { as: 'service_role', sql: `=(select amount_cents || '/' || (fee_tiers = '${JSON.stringify(r0.tiers)}'::jsonb) from public.confirm_offer_basis('${U.cust}', ${OFF(R, 'a')}))` }),
      named('Basis fremd', { as: 'service_role', sql: `perform public.confirm_offer_basis('${U.cust2}', ${OFF(R, 'a')})` }),
      named('Partner als Akteur', { as: 'service_role', sql: `perform ${confirm(U.pa, R, 'a')}` }),
      named('anderer Kunde', { as: 'service_role', sql: `perform ${confirm(U.cust2, R, 'a')}` }),
      named('Betrag abweichend', { as: 'service_role', sql: `perform ${confirm(U.cust, R, 'a', { shown: 149999 })}` }),
      named('authenticated darf nicht', { as: 'authenticated', claims: A2(U.cust), sql: `perform ${confirm(U.cust, R, 'a')}` }),
      named('bestätigen', { as: 'service_role', sql: `=${confirm(U.cust, R, 'a')}` }),
      named('Status', { sql: `=${status(R)}` }),
      named('Angebot a', { sql: `=${ostat(R, 'a')}` }),
      named('Angebot b', { sql: `=${ostat(R, 'b')}` }),
      named('Revision', { sql: `=(select n || '/' || source || '/' || total_cents || '/' || low_cents || '/' || high_cents from public.price_revisions where request_id = '${R}' and n = 2)` }),
      named('Zeiger', { sql: `=(select v.n from public.service_requests s join public.price_revisions v on v.id = s.current_revision where s.id = '${R}')` }),
      named('Snapshot ohne Gebühr', { sql: `=(select (snapshot::text ~* 'fee|provision|payout') from public.price_revisions where request_id = '${R}' and n = 2)` }),
      named('Snapshot Art', { sql: `=(select snapshot ->> 'kind' || '/' || (snapshot ->> 'offerId' = ${OFF(R, 'a')}::text) from public.price_revisions where request_id = '${R}' and n = 2)` }),
      named('Zuordnung', { sql: `=${count(`public.assignments where request_id = '${R}' and partner_id = ${P('a')} and ended_at is null`)}` }),
      named('Listing a', { sql: `=(select status::text from public.job_listings where request_id = '${R}' and partner_id = ${P('a')})` }),
      named('Listing b', { sql: `=(select status::text from public.job_listings where request_id = '${R}' and partner_id = ${P('b')})` }),
      named('Journal', { sql: `=(select total_cents || '/' || fee_cents || '/' || payout_cents from public.commission_entries where request_id = '${R}' and kind = 'booking' and partner_id = ${P('a')})` }),
      named('Ereignis', { sql: `=${count(`public.status_events where request_id = '${R}' and from_status = 'offered' and to_status = 'accepted' and actor_role = 'customer' and actor_id = '${U.cust}'`)}` }),
      named('Audit', { sql: `=${count(`public.audit_log where action = 'confirm_offer' and entity_id = ${OFF(R, 'a')}::text`)}` }),
      named('Outbox Gewinner', { sql: `=${count(`public.outbox where kind = 'offer_confirmed' and request_id = '${R}' and recipient_id = ${P('a')}`)}` }),
      named('Gewinner sieht Listing', { as: 'authenticated', claims: A2(U.pa), sql: `=${count(`public.job_listings where status = 'accepted'`)}` }),
      named('doppelt', { as: 'service_role', sql: `=${confirm(U.cust, R, 'a')}` }),
      named('Revisionen', { sql: `=${count(`public.price_revisions where request_id = '${R}'`)}` }),
      named('Journalzeilen', { sql: `=${count(`public.commission_entries where request_id = '${R}'`)}` }),
      named('überholtes Angebot', { as: 'service_role', sql: `perform ${confirm(U.cust, R, 'b', { amount: 160000 })}` }),
    ]
    const r = probes(setup, steps)
    expect(r['Basis']).toBe(`= 150000/true`)
    err(r['Basis fremd'], 'not_found')
    err(r['Partner als Akteur'], 'not_found')
    err(r['anderer Kunde'], 'not_found')
    err(r['Betrag abweichend'], 'amount_mismatch')
    err(r['authenticated darf nicht'], '42501')
    expect(r['bestätigen']).toBe('= confirmed')
    expect(r['Status']).toBe('= accepted')
    expect(r['Angebot a']).toBe('= confirmed')
    expect(r['Angebot b']).toBe('= superseded')
    expect(r['Revision']).toBe('= 2/partner_offer/150000/150000/150000')
    expect(r['Zeiger']).toBe('= 2')
    expect(r['Snapshot ohne Gebühr']).toBe('= false')
    expect(r['Snapshot Art']).toBe('= price/true')
    rows(r['Zuordnung'], 1)
    expect(r['Listing a']).toBe('= accepted')
    expect(r['Listing b']).toBe('= closed')
    expect(r['Journal']).toBe(`= 150000/${sp.feeCents}/${sp.payoutCents}`)
    rows(r['Ereignis'], 1)
    rows(r['Audit'], 1)
    rows(r['Outbox Gewinner'], 1)
    rows(r['Gewinner sieht Listing'], 1)
    expect(r['doppelt']).toBe('= confirmed')
    rows(r['Revisionen'], 2)
    rows(r['Journalzeilen'], 1)
    err(r['überholtes Angebot'], 'offer_not_valid')
  })

  it('Firma nicht aktiv: Angebot withdrawn mit Outbox, Antwort partner_not_active, T4b; letztes Angebot → awaiting_offer; Frist vorbei → expired', () => {
    const [R1, R2, R3] = [newId(), newId(), newId()]
    const as = (u: string, r: string, a: number) => `select set_config('request.jwt.claims', '{"sub":"${u}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select ${SO(u, r, a)}; reset role;`
    const setup = `${BASE('a', 'b', 'c')} ${request({ id: R1 })} ${request({ id: R2 })} ${request({ id: R3 })} ${dist(R1)} ${dist(R2)} ${dist(R3)}
      ${as(U.pa, R1, 150000)} ${as(U.pb, R1, 160000)} ${as(U.pa, R2, 150000)} ${as(U.pa, R3, 150000)} ${suspendRaw('a')}`
    const steps: Step[] = [
      named('bestätigen a (R1)', { as: 'service_role', sql: `=${confirm(U.cust, R1, 'a')}` }),
      named('Angebot a', { sql: `=${ostat(R1, 'a')}` }),
      named('Status bleibt offered (b gültig)', { sql: `=${status(R1)}` }),
      named('Outbox', { sql: `=${count(`public.outbox where kind = 'offer_withdrawn' and request_id = '${R1}' and recipient_id = '${U.cust}'`)}` }),
      named('keine Zuordnung', { sql: `=${count(`public.assignments where request_id = '${R1}'`)}` }),
      named('keine Journalzeile', { sql: `=${count(`public.commission_entries where request_id = '${R1}'`)}` }),
      named('bestätigen a (R2, letztes)', { as: 'service_role', sql: `=${confirm(U.cust, R2, 'a')}` }),
      named('R2 Status', { sql: `=${status(R2)}` }),
      named('Frist R3', { sql: `set constraints all immediate; alter table public.service_requests disable trigger guard_request_fields; update public.service_requests set accept_deadline = now() - interval '1 minute' where id = '${R3}'; alter table public.service_requests enable trigger guard_request_fields` }),
      named('bestätigen a (R3)', { as: 'service_role', sql: `=${confirm(U.cust, R3, 'a')}` }),
      named('R3 Status', { sql: `=${status(R3)}` }),
      named('R3 Outbox', { sql: `=${count(`public.outbox where kind = 'request_expired' and request_id = '${R3}'`)}` }),
      named('b bestätigen danach', { as: 'service_role', sql: `=${confirm(U.cust, R1, 'b', { amount: 160000 })}` }),
    ]
    const r = probes(setup, steps)
    expect(r['bestätigen a (R1)']).toBe('= partner_not_active')
    expect(r['Angebot a']).toBe('= withdrawn')
    expect(r['Status bleibt offered (b gültig)']).toBe('= offered')
    rows(r['Outbox'], 1)
    rows(r['keine Zuordnung'], 0)
    rows(r['keine Journalzeile'], 0)
    expect(r['bestätigen a (R2, letztes)']).toBe('= partner_not_active')
    expect(r['R2 Status']).toBe('= awaiting_offer')
    expect(r['bestätigen a (R3)']).toBe('= partner_not_active')
    expect(r['R3 Status']).toBe('= expired')
    rows(r['R3 Outbox'], 1)
    expect(r['b bestätigen danach']).toBe('= confirmed')
  })

  it('Limit offener Aufträge gilt auch bei der Bestätigung; Angebot bleibt gültig', () => {
    const [R1, R2] = [newId(), newId()]
    const s = split(68961)
    const setup = `${BASE('a')} ${request({ id: R1, kind: 'fixed' })} ${request({ id: R2 })} ${dist(R1)} ${dist(R2)}
      select set_config('request.jwt.claims', '{"sub":"${U.pa}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select ${SO(U.pa, R2, 150000)}; reset role;
      update public.platform_settings set value = 1 where key = 'partner_open_jobs_max';`
    const lid = `(select id from public.job_listings where request_id = '${R1}' and partner_id = ${P('a')})`
    const steps: Step[] = [
      named('Annahme', { as: 'service_role', sql: `perform public.partner_accept('${U.pa}', ${lid}, (select current_revision from public.service_requests where id = '${R1}'), ${s.payoutCents}, ${r0.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${r0.fsv}, ${r0.vrv})` }),
      named('bestätigen', { as: 'service_role', sql: `perform ${confirm(U.cust, R2, 'a')}` }),
      named('Angebot', { sql: `=${ostat(R2, 'a')}` }),
      named('Status', { sql: `=${status(R2)}` }),
    ]
    const r = probes(setup, steps)
    ok(r['Annahme'])
    err(r['bestätigen'], 'partner_job_limit')
    expect(r['Angebot']).toBe('= sent')
    expect(r['Status']).toBe('= offered')
  })

  it('fehlende USt.-Regel: Bestätigung bricht ab, nichts gebucht', () => {
    const R = newId()
    const setup = `${BASE('a')} ${request({ id: R })} ${dist(R)}
      select set_config('request.jwt.claims', '{"sub":"${U.pa}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select ${SO(U.pa, R, 150000)}; reset role;
      alter table public.partner_vat_rules disable trigger user; delete from public.partner_vat_rules where partner_id = ${P('a')}; alter table public.partner_vat_rules enable trigger user;`
    const steps: Step[] = [
      named('bestätigen', { as: 'service_role', sql: `perform ${confirm(U.cust, R, 'a')}` }),
      named('Status', { sql: `=${status(R)}` }),
    ]
    const r = probes(setup, steps)
    err(r['bestätigen'], 'vat_rule_missing')
    expect(r['Status']).toBe('= offered')
  })
})

describe('Ablehnen, Zurückziehen, Ablauf', () => {
  it('reject_offers (T6), withdraw_offer (T4b), Rückzug des Kunden (T2), Eigentümer und Status geprüft', () => {
    const [R1, R2, R3] = [newId(), newId(), newId()]
    const as = (u: string, r: string, a: number) => `select set_config('request.jwt.claims', '{"sub":"${u}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select ${SO(u, r, a)}; reset role;`
    const setup = `${BASE('a', 'b')} ${request({ id: R1 })} ${request({ id: R2 })} ${request({ id: R3 })} ${dist(R1)} ${dist(R2)} ${dist(R3)}
      ${as(U.pa, R1, 150000)} ${as(U.pb, R1, 160000)} ${as(U.pa, R2, 150000)} ${as(U.pb, R2, 160000)} ${as(U.pa, R3, 150000)}`
    const steps: Step[] = [
      named('reject fremder Kunde', { as: 'authenticated', claims: A2(U.cust2), sql: `perform public.reject_offers('${R1}')` }),
      named('reject Partner', { as: 'authenticated', claims: A2(U.pa), sql: `perform public.reject_offers('${R1}')` }),
      named('reject', { as: 'authenticated', claims: A2(U.cust), sql: `perform public.reject_offers('${R1}')` }),
      named('R1 Status', { sql: `=${status(R1)}` }),
      named('R1 Angebote', { sql: `=${count(`public.partner_offers where request_id = '${R1}' and status = 'rejected'`)}` }),
      named('reject nochmal', { as: 'authenticated', claims: A2(U.cust), sql: `perform public.reject_offers('${R1}')` }),
      // Angebots-IDs als Eigentümer ablegen: partner_offers.request_id ist für Konten gesperrt
      named('Angebots-IDs', { sql: `perform set_config('app.o_a', ${OFF(R2, 'a')}::text, true), set_config('app.o_b', ${OFF(R2, 'b')}::text, true)` }),
      named('withdraw fremdes', { as: 'authenticated', claims: A2(U.pb), sql: `perform public.withdraw_offer(current_setting('app.o_a')::uuid)` }),
      named('withdraw a', { as: 'authenticated', claims: A2(U.pa), sql: `perform public.withdraw_offer(current_setting('app.o_a')::uuid)` }),
      named('R2 offered (b gültig)', { sql: `=${status(R2)}` }),
      named('withdraw b', { as: 'authenticated', claims: A2(U.pb), sql: `perform public.withdraw_offer(current_setting('app.o_b')::uuid)` }),
      named('R2 awaiting_offer', { sql: `=${status(R2)}` }),
      named('withdraw nochmal', { as: 'authenticated', claims: A2(U.pb), sql: `perform public.withdraw_offer(current_setting('app.o_b')::uuid)` }),
      named('Kunde zieht zurück', { as: 'authenticated', claims: A2(U.cust), sql: `perform public.withdraw('${R3}')` }),
      named('R3 Angebote offen', { sql: `=${count(`public.partner_offers where request_id = '${R3}' and status = 'sent'`)}` }),
      named('R3 Angebot rejected', { sql: `=${ostat(R3, 'a')}` }),
    ]
    const r = probes(setup, steps)
    err(r['reject fremder Kunde'], 'not_found')
    err(r['reject Partner'], 'not_found')
    ok(r['reject'])
    expect(r['R1 Status']).toBe('= declined')
    rows(r['R1 Angebote'], 2)
    ok(r['reject nochmal']) // rj1 (0072): Wiederholung des Kunden nach Erfolg ist ok, ohne Wirkung (tests/rls/replay-ablehnen.test.ts)
    err(r['withdraw fremdes'], 'not_found')
    ok(r['withdraw a'])
    expect(r['R2 offered (b gültig)']).toBe('= offered')
    ok(r['withdraw b'])
    expect(r['R2 awaiting_offer']).toBe('= awaiting_offer')
    ok(r['withdraw nochmal']) // fh1 (0069): Wiederholung der Firma nach Erfolg ist ok, ohne Wirkung (tests/rls/replay-rest.test.ts)
    ok(r['Kunde zieht zurück'])
    rows(r['R3 Angebote offen'], 0)
    expect(r['R3 Angebot rejected']).toBe('= rejected')
  })

  it('Cron expire_offers: abgelaufene Angebote → T4b (Frist läuft) bzw. T7 (Frist vorbei); gültiges Angebot hält den Status', () => {
    const [R1, R2, R3] = [newId(), newId(), newId()]
    const as = (u: string, r: string, a: number) => `select set_config('request.jwt.claims', '{"sub":"${u}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select ${SO(u, r, a)}; reset role;`
    const setup = `${BASE('a', 'b')} ${request({ id: R1 })} ${request({ id: R2 })} ${request({ id: R3 })} ${dist(R1)} ${dist(R2)} ${dist(R3)}
      ${as(U.pa, R1, 150000)} ${as(U.pa, R2, 150000)} ${as(U.pa, R3, 150000)} ${as(U.pb, R3, 160000)}`
    const expireOffer = (r: string, k: string) => `update public.partner_offers set valid_until = now() - interval '1 minute' where request_id = '${r}' and partner_id = ${P(k)}`
    const steps: Step[] = [
      named('Ablauf R1, R2, R3 a', { sql: `alter table public.partner_offers disable trigger user; ${expireOffer(R1, 'a')}; ${expireOffer(R2, 'a')}; ${expireOffer(R3, 'a')}; alter table public.partner_offers enable trigger user` }),
      named('Frist R2', { sql: `set constraints all immediate; alter table public.service_requests disable trigger guard_request_fields; update public.service_requests set accept_deadline = now() - interval '1 minute' where id = '${R2}'; alter table public.service_requests enable trigger guard_request_fields` }),
      named('Cron', { as: 'service_role', sql: `perform public.expire_offers()` }),
      named('R1 awaiting_offer', { sql: `=${status(R1)}` }),
      named('R1 Angebot', { sql: `=${ostat(R1, 'a')}` }),
      named('R2 expired', { sql: `=${status(R2)}` }),
      named('R2 Outbox', { sql: `=${count(`public.outbox where kind = 'request_expired' and request_id = '${R2}'`)}` }),
      named('R3 bleibt offered', { sql: `=${status(R3)}` }),
      named('R3 a expired, b sent', { sql: `=${ostat(R3, 'a')} || '/' || ${ostat(R3, 'b')}` }),
      named('anon darf nicht', { as: 'anon', sql: `perform public.expire_offers()` }),
      named('authenticated darf nicht', { as: 'authenticated', claims: A2(U.cust), sql: `perform public.expire_offers()` }),
    ]
    const r = probes(setup, steps)
    ok(r['Cron'])
    expect(r['R1 awaiting_offer']).toBe('= awaiting_offer')
    expect(r['R1 Angebot']).toBe('= expired')
    expect(r['R2 expired']).toBe('= expired')
    rows(r['R2 Outbox'], 1)
    expect(r['R3 bleibt offered']).toBe('= offered')
    expect(r['R3 a expired, b sent']).toBe('= expired/sent')
    err(r['anon darf nicht'], '42501')
    err(r['authenticated darf nicht'], '42501')
  })
})

describe('admin_set_partner_status und Zuständigkeit (S9c-2, S9c-12)', () => {
  it('Sperre schließt Listings, zieht Angebote zurück, wendet T4b/T8 mit Outbox an', () => {
    const [R1, R2] = [newId(), newId()]
    const as = (u: string, r: string, a: number) => `select set_config('request.jwt.claims', '{"sub":"${u}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select ${SO(u, r, a)}; reset role;`
    const decl = (u: string, r: string, k: string) =>
      `select set_config('app.l', (select id::text from public.job_listings where request_id = '${r}' and partner_id = ${P(k)}), true); select set_config('request.jwt.claims', '{"sub":"${u}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select public.decline_listing(current_setting('app.l')::uuid); reset role;`
    const setup = `${BASE('a', 'b', 'c')} ${request({ id: R1 })} ${request({ id: R2 })} ${dist(R1)} ${dist(R2)}
      ${as(U.pa, R1, 150000)} ${as(U.pa, R2, 150000)} ${decl(U.pb, R2, 'b')} ${decl(U.pc, R2, 'c')}`
    const steps: Step[] = [
      named('Listing-ID a', { sql: `perform set_config('app.la', (select id::text from public.job_listings where request_id = '${R1}' and partner_id = ${P('a')}), true)` }),
      named('a mit Angebot lehnt nicht ab', { as: 'authenticated', claims: A2(U.pa), sql: `perform public.decline_listing(current_setting('app.la')::uuid)` }),
      named('sperren', { sql: `perform public.admin_set_partner_status('${U.adm}', ${P('a')}, 'suspended', 'Sperre wegen Prüfung')` }),
      named('Listings a', { sql: `=${count(`public.job_listings where partner_id = ${P('a')} and status = 'open'`)}` }),
      named('Angebote a', { sql: `=${count(`public.partner_offers where partner_id = ${P('a')} and status = 'sent'`)}` }),
      named('R1: b, c live → awaiting_offer', { sql: `=${status(R1)}` }),
      named('R2: kein Listing → unmatched', { sql: `=${status(R2)}` }),
      named('R2 Outbox', { sql: `=${count(`public.outbox where kind = 'request_unmatched' and request_id = '${R2}'`)}` }),
      named('Angebot-Outbox', { sql: `=${count(`public.outbox where kind = 'offer_withdrawn' and recipient_id = '${U.cust}'`)}` }),
    ]
    const r = probes(setup, steps)
    err(r['a mit Angebot lehnt nicht ab'], 'offer_exists')
    ok(r['sperren'])
    rows(r['Listings a'], 0)
    rows(r['Angebote a'], 0)
    expect(r['R1: b, c live → awaiting_offer']).toBe('= awaiting_offer')
    expect(r['R2: kein Listing → unmatched']).toBe('= unmatched')
    rows(r['R2 Outbox'], 1)
    rows(r['Angebot-Outbox'], 2)
  })

  it('Listing außerhalb der Zuständigkeit zählt nicht als offen (T8); Ziel-Bezirk im Listing', () => {
    const [R, RT] = [newId(), newId()]
    const decl = (u: string, k: string) =>
      `select set_config('app.l', (select id::text from public.job_listings where request_id = '${R}' and partner_id = ${P(k)}), true); select set_config('request.jwt.claims', '{"sub":"${u}","role":"authenticated","aal":"aal2"}', true); set local role authenticated; select public.decline_listing(current_setting('app.l')::uuid); reset role;`
    const setup = `${BASE('a', 'b', 'c')} ${request({ id: R, kind: 'fixed' })} ${request({ id: RT, kind: 'fixed', toPoint: true })} ${dist(R)} ${dist(RT)}
      select public.admin_set_partner_scope('${U.adm}', ${P('a')}, array['transport']::public.partner_service[], array[17, 18]::smallint[]);
      ${decl(U.pb, 'b')} ${decl(U.pc, 'c')}`
    const steps: Step[] = [
      named('Status', { sql: `=${status(R)}` }),
      named('Ziel-Bezirk', { sql: `=(select to_district from public.job_listings where request_id = '${RT}' and partner_id = ${P('a')})` }),
      named('ohne Ziel', { sql: `=(select to_district is null from public.job_listings where request_id = '${R}' and partner_id = ${P('b')})` }),
      named('Spalte lesbar', { as: 'authenticated', claims: A2(U.pb), sql: `=(select count(to_district) from public.job_listings)` }),
    ]
    const r = probes(setup, steps)
    expect(r['Status']).toBe('= unmatched')
    expect(r['Ziel-Bezirk']).toBe('= 1')
    expect(r['ohne Ziel']).toBe('= true')
    expect(r['Spalte lesbar']).toBe('= 1') // Firma b sieht nur das offene Listing RT (a ist dort nicht mehr zuständig), to_district steht in der Spaltenliste
  })
})
