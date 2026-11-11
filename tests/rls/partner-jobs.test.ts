// Partner-Portal 2a (s9i-6a): was ein Partner vor dem Zuschlag lesen und senden darf. Ergänzt listings.test.ts (Lesen, Annahme), offers.test.ts
// (Grenzen, Limits) und accept-/offers-concurrency (Wettläufe); hier: exakte Spaltenliste, Beträge als Rohwerte, fremde Angebote, Firmenstatus, Sätze.
// Rollback-Proben (`probes`), es bleibt nichts zurück. Zeit-Fixtures stehen nur in Fristen relativ zur DB-Uhr (kein Termintag-Vergleich in dieser Datei).
import { describe, expect, it } from 'vitest'
import { probes, type Step } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, P } from '../support/partner.ts'

const U = { adm: newId(), cust: newId(), pa: newId(), pb: newId(), ph: newId(), ps: newId() }
const USERS = insertUsers(Object.values(U))
const OV = { districts: 'array[17, 18]::smallint[]' }
const FIRM = {
  a: firm(U.pa, 'a', 'active', U.adm, OV),
  b: firm(U.pb, 'b', 'active', U.adm, OV),
  h: firm(U.ph, 'h', 'active', U.adm, OV),
  s: firm(U.ps, 's', 'active', U.adm, OV),
}
const BASE = (...keys: (keyof typeof FIRM)[]) => `${USERS} ${grantAdmin(U.adm)} ${keys.map((k) => FIRM[k]).join(' ')}`
const hold = (key: string, to: 'payment_hold' | 'suspended') =>
  `select set_config('app.mv_partner_status', ${P(key)}::text || ':active>${to}', true); update public.partners set status = '${to}', status_reason = 'Probe' where id = ${P(key)}; select set_config('app.mv_partner_status', '', true);`

/** Spanne 1000,00 bis 2000,00 € (range) bzw. Angebot ohne Spanne (free), Status awaiting_offer, Frist in einem Tag. */
function request(id: string, kind: 'range' | 'free'): string {
  const vals = kind === 'range' ? 'null, 100000, 200000' : 'null, null, null'
  const snap = kind === 'range' ? '{"kind":"price","lowCents":100000,"highCents":200000,"lines":[]}' : '{"kind":"offer","lines":[]}'
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', 'awaiting_offer', 17, now() + interval '14 days', now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${vals});
    update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${id}' and n = 1) where id = '${id}';
    select public.distribute_request('${id}');`
}
// Die Listing-ID legt der Eigentümer je Auftrag und Firma als Einstellung ab (Partner kennen die Auftrags-ID nicht, `request_id` ist gesperrt).
const stash = (id: string, ...keys: string[]) => keys.map((k) => `select set_config('app.l_${k}', (select id::text from public.job_listings where request_id = '${id}' and partner_id = ${P(k)}), true);`).join(' ')
const LID = (k: string) => `current_setting('app.l_${k}')::uuid`
const A2 = (sub: string) => ({ sub, aal: 'aal2' as const })
const err = (v: string | undefined, part: string) => expect(v?.includes(part), `${part}: ${v}`).toBe(true)
const rows = (v: string | undefined, n: number) => expect(v, String(v)).toBe(`= ${n}`)
/** „Keine Zeilen“ darf als 0 oder als verweigert (42501) ausfallen; Hauptsache, nichts wird geliefert. */
const none = (v: string | undefined) => expect(v === '= 0' || v?.includes('42501'), String(v)).toBe(true)

describe('Sichtbarkeit vor dem Zuschlag', () => {
  it('Spaltenliste von job_listings ist exakt festgelegt; Partner lesen weder Anfrage noch Kontakt noch Kontaktfunktion', () => {
    const R = newId()
    const setup = `${BASE('a')} ${request(R, 'range')} ${stash(R, 'a')}`
    const cols = (role: string) => `=(select coalesce(string_agg(attname, ',' order by attname), '') from pg_attribute where attrelid = 'public.job_listings'::regclass and attnum > 0 and not attisdropped and has_column_privilege('${role}', attrelid, attnum, 'select'))`
    const steps: Step[] = [
      { name: 'Spalten authenticated', sql: cols('authenticated') },
      { name: 'Spalten anon', sql: cols('anon') },
      { name: 'a sieht das Listing', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.job_listings)` },
      { name: 'service_requests', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.service_requests)` },
      { name: 'request_contacts', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.request_contacts)` },
      { name: 'job_contact vor Zuschlag', as: 'authenticated', claims: A2(U.pa), sql: `perform * from public.job_contact('${R}')` },
      { name: 'price_revisions', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.price_revisions)` },
      { name: 'Fotos', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.job_photos)` },
    ]
    const r = probes(setup, steps)
    expect(r['Spalten authenticated']).toBe('= accept_deadline,created_at,decided_at,district,high_cents,id,inputs,low_cents,partner_id,preferred_date,revision_id,service,status,time_window,to_district,total_cents,volume_m3')
    expect(r['Spalten anon']).toBe('= ')
    rows(r['a sieht das Listing'], 1)
    none(r['service_requests'])
    none(r['request_contacts'])
    err(r['job_contact vor Zuschlag'], 'not_assigned')
    none(r['price_revisions'])
    none(r['Fotos'])
  })

  it('Sätze: Partner lesen fee_rate und fee_vat_rate über current_fee_rates, Kunden nichts; Angebotsgrenze bleibt verborgen', () => {
    const setup = `${BASE('a')}`
    const steps: Step[] = [
      { name: 'Partner Satz', as: 'authenticated', claims: A2(U.pa), sql: `=(select fee_rate is not null and fee_vat_rate is not null from public.current_fee_rates)` },
      { name: 'Kunde Satz', as: 'authenticated', claims: A2(U.cust), sql: `=(select coalesce(bool_or(fee_rate is not null or fee_vat_rate is not null), false) from public.current_fee_rates)` },
      { name: 'Kunde Einstellungen', as: 'authenticated', claims: A2(U.cust), sql: `=(select count(*) from public.platform_settings)` },
      { name: 'Partner offer_max_cents', as: 'authenticated', claims: A2(U.pa), sql: `=(select count(*) from public.platform_settings where key not in ('fee_rate', 'fee_vat_rate'))` },
      { name: 'Partner Spalte note', as: 'authenticated', claims: A2(U.pa), sql: `perform note from public.platform_settings` },
    ]
    const r = probes(setup, steps)
    expect(r['Partner Satz']).toBe('= true')
    expect(r['Kunde Satz']).toBe('= false')
    none(r['Kunde Einstellungen'])
    none(r['Partner offer_max_cents'])
    err(r['Partner Spalte note'], '42501')
  })
})

describe('Beträge des Clients (send_offer)', () => {
  it('nur ganze Cent als int: Nachkommastellen, bigint und Text erreichen die Funktion nie; 0, negativ und absurd hoch scheitern; es entsteht keine Zeile', () => {
    const [R, RF] = [newId(), newId()]
    const setup = `${BASE('a', 'b')} ${request(R, 'range')} ${request(RF, 'free')} ${stash(R, 'a')} ${stash(RF, 'b')}`
    const so = (key: string, amount: string) => `perform public.send_offer(${LID(key)}, ${amount})`
    const as = (name: string, sub: string, sql: string): Step => ({ name, as: 'authenticated', claims: A2(sub), sql })
    const steps: Step[] = [
      as('1,005 als numeric', U.pa, so('a', '150000.5::numeric')),
      as('1.005 als Literal', U.pa, so('a', '1000.05')),
      as('bigint', U.pa, so('a', '3000000000::bigint')),
      as('Text', U.pa, so('a', "'abc'")),
      as('Text mit Komma', U.pa, so('a', "'1000,5'")),
      as('null', U.pa, so('a', 'null::int')),
      as('0', U.pa, so('a', '0')),
      as('negativ', U.pa, so('a', '-1')),
      as('max int in Spanne', U.pa, so('a', '2147483647')),
      as('unter der Spanne', U.pa, so('a', '99999')),
      as('über der Spanne', U.pa, so('a', '200001')),
      as('frei: absurd hoch', U.pb, so('b', '2147483647')),
      as('frei: über offer_max_cents', U.pb, so('b', '800001')),
      { name: 'keine Zeile entstanden', sql: `=(select count(*) from public.partner_offers where partner_id in (${P('a')}, ${P('b')}))` },
      { name: 'Status unverändert', sql: `=(select count(*) from public.service_requests where status = 'awaiting_offer' and id in ('${R}', '${RF}'))` },
      as('Grenze unten', U.pa, so('a', '100000')),
      { name: 'eine Zeile, ganze Cent', sql: `=(select amount_cents from public.partner_offers where partner_id = ${P('a')})` },
    ]
    const r = probes(setup, steps)
    for (const n of ['1,005 als numeric', '1.005 als Literal', 'bigint']) err(r[n], '42883') // keine Funktion mit diesem Argumenttyp
    for (const n of ['Text', 'Text mit Komma']) err(r[n], '22P02') // kein gültiger Integer
    for (const n of ['null', '0', 'negativ', 'max int in Spanne', 'unter der Spanne', 'über der Spanne', 'frei: absurd hoch', 'frei: über offer_max_cents']) err(r[n], 'amount_out_of_range')
    rows(r['keine Zeile entstanden'], 0)
    rows(r['Status unverändert'], 2)
    expect(r['Grenze unten']).toBe('ok')
    rows(r['eine Zeile, ganze Cent'], 100000)
  })
})

describe('Fremde Angebote und Firmenstatus', () => {
  it('Firma B liest, ändert und zieht Angebote von A nicht zurück; der Kunde liest die Tabelle nicht; payment_hold und suspended bieten nicht und sehen keine Listings', () => {
    const R = newId()
    const setup = `${BASE('a', 'b', 'h', 's')} ${request(R, 'range')} ${stash(R, 'a', 'h', 's')}`
    const as = (name: string, sub: string, sql: string): Step => ({ name, as: 'authenticated', claims: A2(sub), sql })
    const steps: Step[] = [
      as('a sendet', U.pa, `perform public.send_offer(${LID('a')}, 150000)`),
      as('a liest das eigene', U.pa, `=(select count(*) from public.partner_offers)`),
      as('b liest fremde', U.pb, `=(select count(*) from public.partner_offers)`),
      as('Kunde liest die Tabelle', U.cust, `=(select count(*) from public.partner_offers)`),
      as('b zieht fremdes zurück', U.pb, `perform public.withdraw_offer((select id from public.partner_offers))`),
      { name: 'Angebot von a merken', sql: `perform set_config('app.o_a', (select id::text from public.partner_offers where partner_id = ${P('a')}), true)` },
      as('b zieht a zurück per ID', U.pb, `perform public.withdraw_offer(current_setting('app.o_a')::uuid)`),
      as('b ändert den Betrag', U.pb, `update public.partner_offers set amount_cents = 1`),
      as('a ändert den Betrag', U.pa, `update public.partner_offers set amount_cents = 1`),
      as('a löscht', U.pa, `delete from public.partner_offers`),
      { name: 'Status wird payment_hold', sql: hold('h', 'payment_hold') },
      { name: 'Status wird suspended', sql: hold('s', 'suspended') },
      as('payment_hold sendet', U.ph, `perform public.send_offer(${LID('h')}, 150000)`),
      as('suspended sendet', U.ps, `perform public.send_offer(${LID('s')}, 150000)`),
      as('payment_hold sieht Listings', U.ph, `=(select count(*) from public.job_listings)`),
      as('suspended sieht Listings', U.ps, `=(select count(*) from public.job_listings)`),
    ]
    const r = probes(setup, steps)
    expect(r['a sendet']).toBe('ok')
    rows(r['a liest das eigene'], 1)
    none(r['b liest fremde'])
    none(r['Kunde liest die Tabelle'])
    err(r['b zieht fremdes zurück'], 'not_found')
    err(r['b zieht a zurück per ID'], 'not_found')
    err(r['b ändert den Betrag'], '42501')
    err(r['a ändert den Betrag'], '42501')
    err(r['a löscht'], '42501')
    err(r['payment_hold sendet'], 'partner_not_active')
    err(r['suspended sendet'], 'partner_not_active')
    none(r['payment_hold sieht Listings'])
    none(r['suspended sieht Listings'])
  })
})
