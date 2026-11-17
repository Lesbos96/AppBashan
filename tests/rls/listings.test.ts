// Verteilung und Annahme (S9c, Migrationen 0030 bis 0033). Alles läuft als Rollback-Proben (`probes`), es bleibt nichts zurück.
// Beträge rechnet `splitFee` aus @pricing. Der Nebenläufigkeitstest mit committeten Fixtures steht in accept-concurrency.test.ts.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { probes, type Step } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

type Split = ReturnType<typeof splitFee>
function rates() {
  const r = currentFee()
  return { ...r, split: (total: number) => splitFee(total, { tiers: r.tiers, vatRate: r.vr }) }
}

const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pb: newId(), pc: newId(), pend: newId(), ph: newId(), pself: newId() }
const USERS = insertUsers(Object.values(U))
// Eigene Bezirke (17, 18): committete Firmen anderer Tests (Bezirke 1 bis 23 bzw. 1, 2) und Reste ändern die Empfängerzahlen nicht
const OV = { districts: 'array[17, 18]::smallint[]' }
const FIRM = {
  a: firm(U.pa, 'a', 'active', U.adm, OV),
  b: firm(U.pb, 'b', 'active', U.adm, OV),
  c: firm(U.pc, 'c', 'active', U.adm, OV),
  pend: firm(U.pend, 'pend', 'pending', U.adm, OV),
  h: firm(U.ph, 'h', 'active', U.adm, OV),
  self: firm(U.pself, 'self', 'active', U.adm, OV),
}
const BASE = (...keys: (keyof typeof FIRM)[]) => `${USERS} ${grantAdmin(U.adm)} ${keys.map((k) => FIRM[k]).join(' ')}`

type Req = { id: string; customer?: string; status?: string; district?: number; termin?: string; deadline?: string; total?: number | null; service?: string }
/** Auftrag samt Revision 1 und Zeiger; Standard: Festpreis 68961, Bezirk 1, Termin in 14 Tagen, Frist in 1 Tag. */
function request(o: Req): string {
  const total = o.total === undefined ? 68961 : o.total
  const snap = total === null ? '{"kind":"price","lowCents":100,"highCents":200,"lines":[]}' : `{"kind":"price","totalCents":${total},"lowCents":${total},"highCents":${total},"lines":[]}`
  const vals = total === null ? 'null, 100, 200' : `${total}, ${total}, ${total}`
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${o.id}', '${o.customer ?? U.cust}', gen_random_uuid(), '${o.service ?? 'move'}', '${o.status ?? (total === null ? 'awaiting_offer' : 'requested')}', ${o.district ?? 17}, ${o.termin ?? "now() + interval '14 days'"}, ${o.deadline ?? "now() + interval '1 day'"});
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${o.id}', 1, 'submit', '{}', '${snap}', 1, ${vals});
    update public.service_requests set current_revision = ${rev(o.id)} where id = '${o.id}';`
}
const rev = (req: string) => `(select id from public.price_revisions where request_id = '${req}' and n = 1)`
const dist = (req: string) => `select public.distribute_request('${req}');`
const LID = (req: string, key: string) => `(select id from public.job_listings where request_id = '${req}' and partner_id = ${P(key)})`
const status = (req: string) => `(select status::text from public.service_requests where id = '${req}')`
const count = (sql: string) => `(select count(*) from ${sql})`

const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const A1 = (sub: string) => ({ sub, aal: 'aal1' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const rows = (v: string | undefined, n: number) => expect(v, String(v)).toBe(`= ${n}`)

describe('Verteilung (distribute_request)', () => {
  it('Empfänger: aktive Firmen mit Kategorie und Bezirk, keine Selbstbuchung; sonst unmatched mit Outbox; zweiter Aufruf ohne Wirkung', () => {
    const [R1, R2, R3] = [newId(), newId(), newId()]
    const setup = `${BASE('a', 'b', 'pend', 'self')} ${request({ id: R1 })} ${request({ id: R2, district: 21 })} ${request({ id: R3, customer: U.pself })}`
    const steps: Step[] = [
      { name: 'verteilen', as: 'service_role', sql: `=public.distribute_request('${R1}')` },
      { name: 'Listings', sql: `=${count(`public.job_listings where request_id = '${R1}' and status = 'open'`)}` },
      { name: 'pending ohne Listing', sql: `=${count(`public.job_listings where request_id = '${R1}' and partner_id = ${P('pend')}`)}` },
      { name: 'Selbstbuchung ohne Listing', sql: `=${count(`public.job_listings where request_id = '${R3}' and partner_id = ${P('self')}`)}` },
      { name: 'Outbox je Partner', sql: `=${count(`public.outbox where kind = 'listing_new' and request_id = '${R1}'`)}` },
      { name: 'zweiter Aufruf', as: 'service_role', sql: `=public.distribute_request('${R1}')` },
      { name: 'kein Bezirk passt', as: 'service_role', sql: `=public.distribute_request('${R2}')` },
      { name: 'Status unmatched', sql: `=${status(R2)}` },
      { name: 'Outbox unmatched', sql: `=${count(`public.outbox where kind = 'request_unmatched' and request_id = '${R2}'`)}` },
      { name: 'Event unmatched', sql: `=${count(`public.status_events where request_id = '${R2}' and to_status = 'unmatched' and actor_role = 'system'`)}` },
      { name: 'nur die eigene Firma passt, Kunde ist deren Mitglied', as: 'service_role', sql: `=public.distribute_request('${R3}')` },
      { name: 'anon darf nicht', as: 'anon', sql: `perform public.distribute_request('${R1}')` },
      { name: 'authenticated darf nicht', as: 'authenticated', claims: A2(U.pa), sql: `perform public.distribute_request('${R1}')` },
    ]
    const r = probes(setup, steps)
    rows(r['verteilen'], 3) // a, b und self passen zu Kategorie und Bezirk, pending nie
    rows(r['Listings'], 3)
    rows(r['pending ohne Listing'], 0)
    rows(r['Outbox je Partner'], 3)
    rows(r['zweiter Aufruf'], 0)
    rows(r['kein Bezirk passt'], 0)
    expect(r['Status unmatched']).toBe('= unmatched')
    rows(r['Outbox unmatched'], 1)
    rows(r['Event unmatched'], 1)
    rows(r['Selbstbuchung ohne Listing'], 0)
    rows(r['nur die eigene Firma passt, Kunde ist deren Mitglied'], 2) // a und b; self ist ausgeschlossen, weil der Kunde ihr Mitglied ist
    err(r['anon darf nicht'], '42501')
    err(r['authenticated darf nicht'], '42501')
  })
})

describe('Listing-Lesen (RLS)', () => {
  it('eigene Zeilen mit aal2 und Status active; verweigert: aal1, fremde Firma, Kunde, pending, nach Frist, Spalte request_id', () => {
    const R = newId()
    const setup = `${BASE('a', 'b', 'pend')} ${request({ id: R })} ${dist(R)}`
    const steps: Step[] = [
      { name: 'a aal2', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.job_listings where partner_id in (${P('a')}, ${P('b')}, ${P('pend')}))` },
      { name: 'a sieht nur die eigene', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.job_listings where partner_id = ${P('b')})` },
      { name: 'a aal1', as: 'authenticated', claims: A1(U.pa), sql: `=(select count(*) from public.job_listings where partner_id in (${P('a')}, ${P('b')}, ${P('pend')}))` },
      { name: 'Kunde', as: 'authenticated', claims: A2(U.cust), sql: `=(select count(*) from public.job_listings where partner_id in (${P('a')}, ${P('b')}, ${P('pend')}))` },
      { name: 'pending', as: 'authenticated', claims: A2(U.pend), sql: `=(select count(*) from public.job_listings where partner_id in (${P('a')}, ${P('b')}, ${P('pend')}))` },
      { name: 'admin aal2', as: 'authenticated', claims: A2(U.adm), sql: `=(select count(*) from public.job_listings where partner_id in (${P('a')}, ${P('b')}, ${P('pend')}))` },
      { name: 'admin aal1', as: 'authenticated', claims: A1(U.adm), sql: `=(select count(*) from public.job_listings where partner_id in (${P('a')}, ${P('b')}, ${P('pend')}))` },
      { name: 'request_id gesperrt', as: 'authenticated', claims: A2(U.pa), sql: `perform request_id from public.job_listings` },
      { name: 'Spalte Bezirk lesbar', as: 'authenticated', claims: A2(U.pa), sql: `=(select district from public.job_listings limit 1)` },
      { name: 'INSERT', as: 'authenticated', claims: A2(U.pa), sql: `insert into public.job_listings (request_id, partner_id) values ('${R}', ${P('a')})` },
      { name: 'UPDATE', as: 'authenticated', claims: A2(U.pa), sql: `update public.job_listings set status = 'accepted'` },
      { name: 'Frist vorbei', sql: `update public.job_listings set accept_deadline = now() - interval '1 minute'` },
      { name: 'nach Frist', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.job_listings where partner_id in (${P('a')}, ${P('b')}, ${P('pend')}))` },
    ]
    const r = probes(setup, steps)
    rows(r['a aal2'], 1)
    rows(r['a sieht nur die eigene'], 0)
    rows(r['a aal1'], 0)
    rows(r['Kunde'], 0)
    rows(r['pending'], 0)
    rows(r['admin aal2'], 2)
    rows(r['admin aal1'], 0)
    err(r['request_id gesperrt'], '42501')
    rows(r['Spalte Bezirk lesbar'], 17)
    err(r['INSERT'], '42501')
    err(r['UPDATE'], '42501')
    rows(r['nach Frist'], 0)
  })
})

describe('Annahme (partner_accept)', () => {
  const RT = rates()
  const s = RT.split(68961)
  const acc = (user: string, req: string, key: string, o: { rev?: string; shown?: number; split?: Split } = {}) => {
    const sp = o.split ?? s
    return `public.partner_accept('${user}', ${LID(req, key)}, ${o.rev ?? rev(req)}, ${o.shown ?? sp.payoutCents}, ${RT.vr}, ${sp.feeCents}, ${sp.feeNetCents}, ${sp.feeVatCents}, ${sp.payoutCents}, ${RT.fsv}, ${RT.vrv})`
  }

  it('Erfolg: Status, Zuordnung, Listings, Journal, Ereignis, Outbox in einer Transaktion; verweigert: zweite Annahme, Revision, Auszahlung, Firmenstatus, fremdes Listing', () => {
    const [R, RW] = [newId(), newId()]
    const setup = `${BASE('a', 'b', 'h', 'pend')} ${request({ id: R })} ${request({ id: RW, total: null })} ${dist(R)} ${dist(RW)}`
    const steps: Step[] = [
      { name: 'fremdes Listing', as: 'service_role', sql: `perform ${acc(U.pb, R, 'a')}` },
      { name: 'Revision geändert', as: 'service_role', sql: `perform ${acc(U.pa, R, 'a', { rev: 'gen_random_uuid()' })}` },
      { name: 'Auszahlung geändert', as: 'service_role', sql: `perform ${acc(U.pa, R, 'a', { shown: s.payoutCents + 1 })}` },
      { name: 'payment_hold', sql: `perform public.admin_set_partner_status('${U.adm}', ${P('a')}, 'payment_hold', 'Begründung für den Test')` },
      { name: 'Firma payment_hold', as: 'service_role', sql: `perform ${acc(U.pa, R, 'a')}` },
      { name: 'wieder aktiv', sql: `perform public.admin_set_partner_status('${U.adm}', ${P('a')}, 'active', 'Wiedereröffnung nach Prüfung')` },
      { name: 'Spanne ohne Festpreis', as: 'service_role', sql: `perform ${acc(U.pa, RW, 'a')}` },
      { name: 'authenticated darf nicht', as: 'authenticated', claims: A2(U.pa), sql: `perform ${acc(U.pa, R, 'a')}` },
      { name: 'Annahme', as: 'service_role', sql: `perform ${acc(U.pa, R, 'a')}` },
      { name: 'Status', sql: `=${status(R)}` },
      { name: 'Zuordnung', sql: `=${count(`public.assignments where request_id = '${R}' and partner_id = ${P('a')} and ended_at is null`)}` },
      { name: 'Listing a', sql: `=(select status::text from public.job_listings where request_id = '${R}' and partner_id = ${P('a')})` },
      { name: 'Listing b', sql: `=(select status::text from public.job_listings where request_id = '${R}' and partner_id = ${P('b')})` },
      { name: 'Journal', sql: `=(select fee_cents || '/' || payout_cents from public.commission_entries where request_id = '${R}' and kind = 'booking' and partner_id = ${P('a')})` },
      { name: 'Ereignis', sql: `=${count(`public.status_events where request_id = '${R}' and to_status = 'accepted' and actor_role = 'partner' and actor_id = '${U.pa}'`)}` },
      { name: 'Outbox Kunde', sql: `=${count(`public.outbox where kind = 'request_accepted' and request_id = '${R}' and recipient_id = '${U.cust}'`)}` },
      { name: 'zweite Annahme', as: 'service_role', sql: `perform ${acc(U.pb, R, 'b')}` },
      { name: 'zweite Annahme gleiche Firma', as: 'service_role', sql: `perform ${acc(U.pa, R, 'a')}` },
    ]
    const r = probes(setup, steps)
    err(r['fremdes Listing'], 'not_found')
    err(r['Revision geändert'], 'revision_changed')
    err(r['Auszahlung geändert'], 'payout_changed')
    err(r['Firma payment_hold'], 'partner_not_active')
    expect(r['wieder aktiv'], String(r['wieder aktiv'])).toBe('ok')
    err(r['Spanne ohne Festpreis'], 'offer_required')
    err(r['authenticated darf nicht'], '42501')
    expect(r['Annahme']).toBe('ok')
    expect(r['Status']).toBe('= accepted')
    rows(r['Zuordnung'], 1)
    expect(r['Listing a']).toBe('= accepted')
    expect(r['Listing b']).toBe('= closed')
    expect(r['Journal']).toBe(`= ${s.feeCents}/${s.payoutCents}`)
    rows(r['Ereignis'], 1)
    rows(r['Outbox Kunde'], 1)
    err(r['zweite Annahme'], 'already_taken')
    err(r['zweite Annahme gleiche Firma'], 'already_taken')
  })

  // s9i-7c2 (S9i7c2-1): die Edge Function `accept` ruft diese Basis auf; bis 0060 warf sie 42804 (integer statt bigint), kein Test rief sie funktional auf
  it('Basis für die Edge Function accept: genau eine Zeile mit Revision, Festpreis, Satz und Versionen; fremde Firma not_found; ohne Festpreis offer_required', () => {
    const [R, RW] = [newId(), newId()]
    const setup = `${BASE('a', 'b')} ${request({ id: R })} ${request({ id: RW, total: null })} ${dist(R)} ${dist(RW)}`
    const basis = (user: string, req: string, key: string) => `public.partner_accept_basis('${user}', ${LID(req, key)})`
    const steps: Step[] = [
      { name: 'Basis', sql: `=(select (count(*) = 1 and bool_and(revision_id = ${rev(R)}) and min(total_cents) = 68961 and bool_and(fee_tiers = '${JSON.stringify(RT.tiers)}'::jsonb) and min(fee_vat_rate) = ${RT.vr}::numeric and min(fee_schedule_version) = ${RT.fsv} and min(fee_vat_rate_version) = ${RT.vrv})::text from ${basis(U.pa, R, 'a')})` },
      { name: 'fremde Firma', as: 'service_role', sql: `perform ${basis(U.pb, R, 'a')}` },
      { name: 'ohne Festpreis', as: 'service_role', sql: `perform ${basis(U.pa, RW, 'a')}` },
    ]
    const r = probes(setup, steps)
    expect(r['Basis'], String(r['Basis'])).toBe('= true')
    err(r['fremde Firma'], 'not_found')
    err(r['ohne Festpreis'], 'offer_required')
  })

  it('Zuständigkeit gilt bei der Annahme und beim Lesen (Abnahme H1): Scope entzogen → Listing unsichtbar, Annahme verweigert, keine Zuordnung', () => {
    const R = newId()
    const setup = `${BASE('a', 'b')} ${request({ id: R })} ${dist(R)} select set_config('app.l_a', ${LID(R, 'a')}::text, true);`
    const steps: Step[] = [
      { name: 'vorher sichtbar', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.job_listings where id = current_setting('app.l_a')::uuid)` },
      { name: 'Scope ohne move', sql: `perform public.admin_set_partner_scope('${U.adm}', ${P('a')}, array['transport']::public.partner_service[], array[17, 18]::smallint[])` },
      { name: 'nachher unsichtbar', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.job_listings where id = current_setting('app.l_a')::uuid)` },
      { name: 'Annahme', as: 'service_role', sql: `perform ${acc(U.pa, R, 'a')}` },
      { name: 'Zuordnungen', sql: `=${count(`public.assignments where request_id = '${R}'`)}` },
      { name: 'Journal', sql: `=${count(`public.commission_entries where request_id = '${R}'`)}` },
      { name: 'Status', sql: `=${status(R)}` },
      { name: 'Basis verweigert nicht, Annahme der zuständigen Firma geht', as: 'service_role', sql: `perform ${acc(U.pb, R, 'b')}` },
    ]
    const r = probes(setup, steps)
    rows(r['vorher sichtbar'], 1)
    expect(r['Scope ohne move']).toBe('ok')
    rows(r['nachher unsichtbar'], 0)
    err(r['Annahme'], 'not_responsible')
    rows(r['Zuordnungen'], 0)
    rows(r['Journal'], 0)
    expect(r['Status']).toBe('= requested')
    expect(r['Basis verweigert nicht, Annahme der zuständigen Firma geht']).toBe('ok')
  })

  it('Frist (Cron noch nicht gelaufen), Limit offener Aufträge, pending-Firma', () => {
    const [R1, R2, RX] = [newId(), newId(), newId()]
    const setup = `${BASE('a', 'pend')} ${request({ id: R1 })} ${request({ id: R2 })} ${request({ id: RX, deadline: "now() - interval '1 minute'" })} ${dist(R1)} ${dist(R2)} ${dist(RX)}`
    const steps: Step[] = [
      { name: 'nach Fristende', as: 'service_role', sql: `perform ${acc(U.pa, RX, 'a')}` },
      { name: 'Limit 1', sql: `update public.platform_settings set value = 1 where key = 'partner_open_jobs_max'` },
      { name: 'erste', as: 'service_role', sql: `perform ${acc(U.pa, R1, 'a')}` },
      { name: 'zweite über Limit', as: 'service_role', sql: `perform ${acc(U.pa, R2, 'a')}` },
      { name: 'Annahme pending', as: 'service_role', sql: `perform public.partner_accept('${U.pend}', gen_random_uuid(), gen_random_uuid(), 1, 0.2, 1, 1, 0, 1, 1, 1)` },
    ]
    const r = probes(setup, steps)
    err(r['nach Fristende'], 'expired')
    expect(r['erste']).toBe('ok')
    err(r['zweite über Limit'], 'partner_job_limit')
    err(r['Annahme pending'], 'not_found')
  })
})

describe('Ablehnen und Fristen', () => {
  it('decline_listing: eigene Zeile, letzte Ablehnung → unmatched mit Outbox; aal1, fremde, pending, geschlossen verweigert', () => {
    const R = newId()
    // authenticated liest request_id nicht: die Listing-IDs liegen vorab in Einstellungen
    const setup = `${BASE('a', 'b', 'pend')} ${request({ id: R })} ${dist(R)} select set_config('app.l_a', ${LID(R, 'a')}::text, true), set_config('app.l_b', ${LID(R, 'b')}::text, true);`
    const dec = (key: string) => `perform public.decline_listing(current_setting('app.l_${key}')::uuid)`
    const steps: Step[] = [
      { name: 'aal1', as: 'authenticated', claims: A1(U.pa), sql: dec('a') },
      { name: 'pending', as: 'authenticated', claims: A2(U.pend), sql: dec('a') },
      { name: 'fremdes', as: 'authenticated', claims: A2(U.pb), sql: dec('a') },
      { name: 'anon', as: 'anon', sql: dec('a') },
      { name: 'a lehnt ab', as: 'authenticated', claims: A2(U.pa), sql: dec('a') },
      { name: 'Status bleibt', sql: `=${status(R)}` },
      { name: 'nochmal', as: 'authenticated', claims: A2(U.pa), sql: dec('a') },
      { name: 'b lehnt ab', as: 'authenticated', claims: A2(U.pb), sql: dec('b') },
      { name: 'Status', sql: `=${status(R)}` },
      { name: 'Outbox', sql: `=${count(`public.outbox where kind = 'request_unmatched' and request_id = '${R}'`)}` },
    ]
    const r = probes(setup, steps)
    err(r['aal1'], 'mfa_required')
    err(r['pending'], 'partner_not_active')
    err(r['fremdes'], 'not_found')
    err(r['anon'], '42501')
    expect(r['a lehnt ab']).toBe('ok')
    expect(r['Status bleibt']).toBe('= requested')
    expect(r['nochmal']).toBe('ok') // rj1 (0072): Wiederholung der Firma nach Erfolg ist ok, ohne Wirkung (tests/rls/replay-ablehnen.test.ts)
    expect(r['b lehnt ab']).toBe('ok')
    expect(r['Status']).toBe('= unmatched')
    rows(r['Outbox'], 1)
  })

  it('expire_requests: nur abgelaufene requested/awaiting_offer; Listings geschlossen, Outbox, Ereignis; Annahme danach: expired', () => {
    const [R1, R2, R3] = [newId(), newId(), newId()]
    const setup = `${BASE('a')} ${request({ id: R1, deadline: "now() - interval '1 minute'" })} ${request({ id: R2 })} ${request({ id: R3, total: null, deadline: "now() - interval '1 minute'" })} ${dist(R1)} ${dist(R2)} ${dist(R3)}`
    const steps: Step[] = [
      { name: 'Lauf', as: 'service_role', sql: `=public.expire_requests()` },
      { name: 'R1', sql: `=${status(R1)}` },
      { name: 'R2', sql: `=${status(R2)}` },
      { name: 'R3', sql: `=${status(R3)}` },
      { name: 'Listing R1', sql: `=(select status::text from public.job_listings where request_id = '${R1}' and partner_id = ${P('a')})` },
      { name: 'Outbox', sql: `=${count(`public.outbox where kind = 'request_expired' and request_id in ('${R1}', '${R2}', '${R3}')`)}` },
      { name: 'Ereignis', sql: `=${count(`public.status_events where to_status = 'expired' and actor_role = 'system' and request_id in ('${R1}', '${R2}', '${R3}')`)}` },
      { name: 'zweiter Lauf', as: 'service_role', sql: `=public.expire_requests()` },
      { name: 'authenticated', as: 'authenticated', claims: A2(U.pa), sql: `perform public.expire_requests()` },
    ]
    const r = probes(setup, steps)
    expect(Number(String(r['Lauf']).slice(2)), String(r['Lauf'])).toBeGreaterThanOrEqual(2) // außer R1 und R3 laufen womöglich fremde, schon abgelaufene Aufträge mit ab
    expect(r['R1']).toBe('= expired')
    expect(r['R2']).toBe('= requested')
    expect(r['R3']).toBe('= expired')
    expect(r['Listing R1']).toBe('= closed')
    rows(r['Outbox'], 2)
    rows(r['Ereignis'], 2)
    rows(r['zweiter Lauf'], 0)
    err(r['authenticated'], '42501')
  })

  it('Zurückziehen schließt die Listings; direktes UPDATE auf den Status bleibt verweigert', () => {
    const R = newId()
    const setup = `${BASE('a')} ${request({ id: R })} ${dist(R)}`
    const steps: Step[] = [
      { name: 'withdraw', as: 'authenticated', claims: A1(U.cust), sql: `perform public.withdraw('${R}')` },
      { name: 'Listing', sql: `=(select status::text from public.job_listings where request_id = '${R}' and partner_id = ${P('a')})` },
      { name: 'UPDATE', as: 'authenticated', claims: A1(U.cust), sql: `update public.service_requests set status = 'accepted' where id = '${R}'` },
      { name: 'service_role UPDATE', as: 'service_role', sql: `update public.service_requests set status = 'completed' where id = '${R}'` },
    ]
    const r = probes(setup, steps)
    expect(r['withdraw']).toBe('ok')
    expect(r['Listing']).toBe('= closed')
    err(r['UPDATE'], '42501')
    expect(r['service_role UPDATE']).not.toBe('ok')
  })
})

describe('Abwicklung (start_job, complete_job, job_contact, my_job_partner)', () => {
  const RT = rates()
  const s = RT.split(68961)
  const accept = (req: string) =>
    `select public.partner_accept('${U.pa}', ${LID(req, 'a')}, ${rev(req)}, ${s.payoutCents}, ${RT.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${RT.fsv}, ${RT.vrv});`
  const past = "now() - interval '2 hours'"

  it('start und complete: Akteur, Zeitpunkt, Zuordnung; Zuordnung endet mit completed', () => {
    const [R, RF] = [newId(), newId()]
    const setup = `${BASE('a', 'b')} ${request({ id: R, termin: past })} ${request({ id: RF })} ${dist(R)} ${dist(RF)} ${accept(R)} ${accept(RF)}`
    const steps: Step[] = [
      { name: 'start aal1', as: 'authenticated', claims: A1(U.pa), sql: `perform public.start_job('${R}')` },
      { name: 'start fremde Firma', as: 'authenticated', claims: A2(U.pb), sql: `perform public.start_job('${R}')` },
      { name: 'start Kunde', as: 'authenticated', claims: A2(U.cust), sql: `perform public.start_job('${R}')` },
      { name: 'start vor Termin', as: 'authenticated', claims: A2(U.pa), sql: `perform public.start_job('${RF}')` },
      { name: 'complete Partner aus accepted', as: 'authenticated', claims: A2(U.pa), sql: `perform public.complete_job('${R}')` },
      { name: 'complete Kunde vor Termin', as: 'authenticated', claims: A1(U.cust), sql: `perform public.complete_job('${RF}')` },
      { name: 'complete Fremder', as: 'authenticated', claims: A2(U.cust2), sql: `perform public.complete_job('${R}')` },
      { name: 'start', as: 'authenticated', claims: A2(U.pa), sql: `perform public.start_job('${R}')` },
      { name: 'Status in_progress', sql: `=${status(R)}` },
      { name: 'complete Partner', as: 'authenticated', claims: A2(U.pa), sql: `perform public.complete_job('${R}')` },
      { name: 'Status completed', sql: `=${status(R)}` },
      { name: 'Zuordnung beendet', sql: `=(select ended_reason::text from public.assignments where request_id = '${R}')` },
    ]
    const r = probes(setup, steps)
    err(r['start aal1'], 'mfa_required')
    err(r['start fremde Firma'], 'not_assigned')
    err(r['start Kunde'], 'partner_not_active')
    err(r['start vor Termin'], 'too_early')
    err(r['complete Partner aus accepted'], 'invalid_transition')
    err(r['complete Kunde vor Termin'], 'invalid_transition')
    err(r['complete Fremder'], 'not_found')
    expect(r['start']).toBe('ok')
    expect(r['Status in_progress']).toBe('= in_progress')
    expect(r['complete Partner']).toBe('ok')
    expect(r['Status completed']).toBe('= completed')
    expect(r['Zuordnung beendet']).toBe('= completed')
  })

  it('Kunde bestätigt „durchgeführt“ ab Termin auch aus accepted', () => {
    const R = newId()
    const setup = `${BASE('a')} ${request({ id: R, termin: past })} ${dist(R)} ${accept(R)}`
    const steps: Step[] = [
      { name: 'Kunde', as: 'authenticated', claims: A1(U.cust), sql: `perform public.complete_job('${R}')` },
      { name: 'Status', sql: `=${status(R)}` },
      { name: 'Ereignis', sql: `=${count(`public.status_events where request_id = '${R}' and to_status = 'completed' and actor_role = 'customer'`)}` },
    ]
    const r = probes(setup, steps)
    expect(r['Kunde']).toBe('ok')
    expect(r['Status']).toBe('= completed')
    rows(r['Ereignis'], 1)
  })

  it('job_contact: nur zugeordnet, aal2, protokolliert, bis partner_access_days nach Ende; my_job_partner für den Kunden', () => {
    const R = newId()
    const setup = `${BASE('a', 'b', 'pend')} ${request({ id: R, termin: past })} ${dist(R)} ${accept(R)}
      insert into public.request_contacts (request_id, name, phone, email, stairs_door) values ('${R}', 'Karl Kunde', '+43 1 234', 'karl@movenow.test', '3. Stock');`
    const contact = `select name || '|' || stairs_door from public.job_contact('${R}')`
    const steps: Step[] = [
      { name: 'my_job_partner Kunde', as: 'authenticated', claims: A1(U.cust), sql: `=(select name from public.my_job_partner('${R}'))` },
      { name: 'my_job_partner Fremder', as: 'authenticated', claims: A1(U.cust2), sql: `perform public.my_job_partner('${R}')` },
      { name: 'my_job_partner anon', as: 'anon', sql: `perform public.my_job_partner('${R}')` },
      { name: 'Kontakt', as: 'authenticated', claims: A2(U.pa), sql: `=(${contact})` },
      { name: 'Kontakt aal1', as: 'authenticated', claims: A1(U.pa), sql: `perform * from public.job_contact('${R}')` },
      { name: 'Kontakt fremde Firma', as: 'authenticated', claims: A2(U.pb), sql: `perform * from public.job_contact('${R}')` },
      { name: 'Kontakt pending', as: 'authenticated', claims: A2(U.pend), sql: `perform * from public.job_contact('${R}')` },
      { name: 'Kontakt Kunde', as: 'authenticated', claims: A2(U.cust), sql: `perform * from public.job_contact('${R}')` },
      { name: 'Direktzugriff Kontakt', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.request_contacts)` },
      { name: 'Protokoll', sql: `=${count(`public.audit_log where action = 'contact_read' and entity_id = '${R}' and actor_id = '${U.pa}'`)}` },
      { name: 'Ende vor 29 Tagen', sql: `alter table public.assignments disable trigger user; update public.assignments set ended_at = now() - interval '29 days', ended_reason = 'completed' where request_id = '${R}'; alter table public.assignments enable trigger user` },
      { name: 'Tag 29', as: 'authenticated', claims: A2(U.pa), sql: `=(${contact})` },
      { name: 'Ende vor 31 Tagen', sql: `alter table public.assignments disable trigger user; update public.assignments set ended_at = now() - interval '31 days' where request_id = '${R}'; alter table public.assignments enable trigger user` },
      { name: 'Tag 31', as: 'authenticated', claims: A2(U.pa), sql: `perform * from public.job_contact('${R}')` },
      { name: 'my_job_partner nach completed', as: 'authenticated', claims: A1(U.cust), sql: `=(select name from public.my_job_partner('${R}'))` },
    ]
    const r = probes(setup, steps)
    expect(r['my_job_partner Kunde']).toBe('= Testfirma GmbH')
    err(r['my_job_partner Fremder'], 'not_assigned')
    err(r['my_job_partner anon'], '42501')
    expect(r['Kontakt']).toBe('= Karl Kunde|3. Stock')
    err(r['Kontakt aal1'], 'mfa_required')
    err(r['Kontakt fremde Firma'], 'not_assigned')
    err(r['Kontakt pending'], 'partner_not_active')
    err(r['Kontakt Kunde'], 'partner_not_active')
    rows(r['Direktzugriff Kontakt'], 0)
    rows(r['Protokoll'], 1)
    expect(r['Tag 29']).toBe('= Karl Kunde|3. Stock')
    err(r['Tag 31'], 'not_assigned')
    expect(r['my_job_partner nach completed']).toBe('= Testfirma GmbH')
  })

  it('admin_contact: nur admin (p_actor), Begründung Pflicht, Audit; authenticated verweigert', () => {
    const R = newId()
    const setup = `${BASE('a')} ${request({ id: R })} insert into public.request_contacts (request_id, name, phone, email) values ('${R}', 'Karl Kunde', '+43 1 234', 'karl@movenow.test');`
    const call = (actor: string, reason: string) => `select name from public.admin_contact('${actor}', '${R}', '${reason}')`
    const steps: Step[] = [
      { name: 'admin', as: 'service_role', sql: `=(${call(U.adm, 'Supportfall 4711 laut Kunde')})` },
      { name: 'kein admin', as: 'service_role', sql: `perform * from public.admin_contact('${U.cust}', '${R}', 'Supportfall 4711 laut Kunde')` },
      { name: 'ohne Begründung', as: 'service_role', sql: `perform * from public.admin_contact('${U.adm}', '${R}', 'kurz')` },
      { name: 'authenticated', as: 'authenticated', claims: A2(U.adm), sql: `perform * from public.admin_contact('${U.adm}', '${R}', 'Supportfall 4711 laut Kunde')` },
      { name: 'Protokoll', sql: `=${count(`public.audit_log where action = 'admin_contact_read' and entity_id = '${R}' and actor_id = '${U.adm}'`)}` },
      { name: 'freies SELECT admin', as: 'authenticated', claims: A2(U.adm), sql: `=(select count(*) from public.request_contacts)` },
    ]
    const r = probes(setup, steps)
    expect(r['admin']).toBe('= Karl Kunde')
    err(r['kein admin'], 'not_admin')
    err(r['ohne Begründung'], 'reason_required')
    err(r['authenticated'], '42501')
    rows(r['Protokoll'], 1)
    rows(r['freies SELECT admin'], 0)
  })
})

describe('Outbox und Zuordnung: Rechte', () => {
  it('Kunde und Partner lesen weder outbox noch fremde assignments; assignments nur Select; admin liest outbox', () => {
    const R = newId()
    const setup = `${BASE('a')} ${request({ id: R })} ${dist(R)} insert into public.assignments (request_id, partner_id) values ('${R}', ${P('a')});`
    const steps: Step[] = [
      { name: 'Kunde outbox', as: 'authenticated', claims: A2(U.cust), sql: `=(select count(*) from public.outbox)` },
      { name: 'Partner outbox', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.outbox)` },
      { name: 'admin outbox', as: 'authenticated', claims: A2(U.adm), sql: `=(select count(*) from public.outbox)` },
      { name: 'Kunde eigene Zuordnung', as: 'authenticated', claims: A1(U.cust), sql: `=(select count(*) from public.assignments)` },
      { name: 'anderer Kunde', as: 'authenticated', claims: A1(U.cust2), sql: `=(select count(*) from public.assignments)` },
      { name: 'Firma', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.assignments)` },
      { name: 'Firma aal1', as: 'authenticated', claims: A1(U.pa), sql: `=(select count(*) from public.assignments)` },
      { name: 'INSERT', as: 'authenticated', claims: A2(U.pa), sql: `insert into public.assignments (request_id, partner_id) values ('${R}', ${P('a')})` },
      { name: 'service_role INSERT', as: 'service_role', sql: `insert into public.assignments (request_id, partner_id) values ('${R}', ${P('a')})` },
      { name: 'zweite aktive Zuordnung', sql: `insert into public.assignments (request_id, partner_id) values ('${R}', ${P('a')})` },
      { name: 'DELETE', sql: `delete from public.assignments where request_id = '${R}'` },
      { name: 'UPDATE Firma', sql: `update public.assignments set accepted_at = now() - interval '1 day' where request_id = '${R}'` },
    ]
    const r = probes(setup, steps)
    rows(r['Kunde outbox'], 0)
    rows(r['Partner outbox'], 0)
    expect(Number(String(r['admin outbox']).slice(2))).toBeGreaterThan(0)
    rows(r['Kunde eigene Zuordnung'], 1)
    rows(r['anderer Kunde'], 0)
    rows(r['Firma'], 1)
    rows(r['Firma aal1'], 0)
    err(r['INSERT'], '42501')
    err(r['service_role INSERT'], '42501')
    err(r['zweite aktive Zuordnung'], '23505')
    err(r['DELETE'], 'append_only')
    err(r['UPDATE Firma'], 'append_only')
  })
})
