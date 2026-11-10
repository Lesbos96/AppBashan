// Nebenläufigkeit der Festangebote (S9e, Konzept 6.1): 4 parallele Angebote = 3; zwei Bestätigungen = eine; Bestätigung gegen Sperre
// der Firma ohne Deadlock. Echte Wettläufe brauchen committete Fixtures und getrennte Verbindungen (wie accept-concurrency.test.ts).
// Rest nach dem Lauf: Journal und Angebote sind unlöschbar; Kunden, Aufträge und beteiligte Firmen (gesperrt) bleiben (OPEN_ISSUES S9c-7).
import { afterAll, describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { ownerSql, ownerSqlAsync } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId } from '../support/partner.ts'
import { sweepTestResidue } from '../support/sweep.ts'

const adm = newId()
const cust = newId()
const pu = Array.from({ length: 5 }, () => newId()) // w0 bis w3: Angebote auf RA/RB; w4: Angebot auf RC, wird dort gesperrt
const [RA, RB, RC] = [newId(), newId(), newId()]

const request = (id: string) => `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
  values ('${id}', '${cust}', gen_random_uuid(), 'move', 'awaiting_offer', 1, now() + interval '14 days', now() + interval '1 day');
  insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values ('${id}', 1, 'submit', '{}', '{"kind":"price","lowCents":100000,"highCents":200000,"lines":[]}', 1, null, 100000, 200000);
  update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${id}' and n = 1) where id = '${id}';
  select public.distribute_request('${id}');`

const startAt = (secs: number) => `select pg_sleep(greatest(0, extract(epoch from (timestamptz '${new Date(Date.now() + secs * 1000).toISOString()}' - clock_timestamp()))));`
const asPartner = (u: string) => `set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${u}","role":"authenticated","aal":"aal2"}', true);`
// Partner kennen die Auftrags-ID nicht: send_offer nimmt die Listing-ID, die hier als Eigentümer vor dem Rollenwechsel nachgeschlagen wird.
const listingOf = (u: string, req: string) =>
  `select set_config('app.l', (select l.id::text from public.job_listings l join public.partner_members m on m.partner_id = l.partner_id where l.request_id = '${req}' and m.user_id = '${u}'), true);`
const sendOffer = (u: string, req: string, amount: number) => `${listingOf(u, req)} ${asPartner(u)} select public.send_offer(current_setting('app.l')::uuid, ${amount}); reset role;`

afterAll(() => sweepTestResidue(adm, true)) // admin hat Audit-Einträge und bleibt meist stehen

describe('Nebenläufigkeit der Festangebote', () => {
  it('4 parallele Angebote = 3; zwei Bestätigungen = eine; Bestätigung gegen Firmensperre ohne Deadlock', async () => {
    ownerSql(`begin; ${insertUsers([adm])} ${grantAdmin(adm)} commit;`)
    sweepTestResidue(adm)
    ownerSql(`begin; ${insertUsers([cust, ...pu])} ${pu.map((u, i) => firm(u, `w${i}`, 'active', adm)).join(' ')}
      ${request(RA)} ${request(RB)} ${request(RC)}
      ${sendOffer(pu[0]!, RB, 150000)} ${sendOffer(pu[1]!, RB, 160000)} ${sendOffer(pu[4]!, RC, 170000)} commit;`)
    const f = ownerSql(`select (select value::float8 from public.platform_settings where key = 'fee_rate' order by effective_from desc, version desc limit 1) as fr,
      (select value::float8 from public.platform_settings where key = 'fee_vat_rate' order by effective_from desc, version desc limit 1) as vr,
      (select version from public.platform_settings where key = 'fee_rate' order by effective_from desc, version desc limit 1) as frv,
      (select version from public.platform_settings where key = 'fee_vat_rate' order by effective_from desc, version desc limit 1) as vrv`)[0] as { fr: number; vr: number; frv: number; vrv: number }
    const offerOf = (req: string, i: number) =>
      `(select o.id from public.partner_offers o join public.partner_members m on m.partner_id = o.partner_id where o.request_id = '${req}' and m.user_id = '${pu[i]}')`
    const confirm = (req: string, i: number, amount: number) => {
      const s = splitFee(amount, { feeRate: f.fr, vatRate: f.vr })
      return `${startAt(9)} set local role service_role; select public.confirm_offer('${cust}', ${offerOf(req, i)}, ${amount}, ${f.fr}, ${f.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${f.frv}, ${f.vrv});`
    }
    const suspend = `${startAt(9)} set local role service_role; select public.admin_set_partner_status('${adm}', (select partner_id from public.partner_members where user_id = '${pu[4]}'), 'suspended', 'Wettlauf Sperre gegen Bestätigung');`

    const runs = await Promise.all([
      ...pu.slice(0, 4).map((u, i) => ownerSqlAsync(`begin; ${listingOf(u, RA)} ${startAt(9)} ${asPartner(u)} select public.send_offer(current_setting('app.l')::uuid, ${120000 + i * 1000}); commit;`)),
      ownerSqlAsync(`begin; ${confirm(RB, 0, 150000)} commit;`),
      ownerSqlAsync(`begin; ${confirm(RB, 1, 160000)} commit;`),
      ownerSqlAsync(`begin; ${confirm(RC, 4, 170000)} commit;`),
      ownerSqlAsync(`begin; ${suspend} commit;`),
    ])

    // Rennen 1: genau 3 gewinnen, 1 bekommt offer_limit
    const sends = runs.slice(0, 4)
    const lost = sends.filter((r): r is { error: string } => 'error' in r)
    expect(sends.filter((r) => 'rows' in r), JSON.stringify(sends)).toHaveLength(3)
    expect(lost.map((r) => r.error).every((m) => m.includes('offer_limit')), lost.map((r) => r.error).join(' | ')).toBe(true)

    // Rennen 2: eine Bestätigung gewinnt, die andere sieht ein überholtes Angebot
    const [c1, c2] = [runs[4], runs[5]]
    expect([c1, c2].filter((r) => r && 'rows' in r), JSON.stringify([c1, c2])).toHaveLength(1)
    const loser = c1 && 'error' in c1 ? c1.error : (c2 as { error: string }).error
    expect(loser.includes('offer_not_valid') || loser.includes('invalid_transition'), loser).toBe(true)

    // Rennen 3: kein Deadlock, kein Serialisierungsfehler; die Sperre gelingt immer; die Bestätigung gelingt oder sieht das schon
    // zurückgezogene Angebot (offer_not_valid)
    expect(runs[7] && 'error' in runs[7] ? runs[7].error : 'ok', JSON.stringify(runs[7])).toBe('ok')
    const c3 = runs[6]
    expect(c3 && 'error' in c3 ? c3.error.includes('offer_not_valid') : true, JSON.stringify(c3)).toBe(true)

    const st = ownerSql(`select
      (select count(*) from public.partner_offers where request_id = '${RA}' and status = 'sent') as sa,
      (select count(*) from public.assignments where request_id = '${RB}') as ab,
      (select count(*) from public.commission_entries where request_id = '${RB}' and kind = 'booking') as jb,
      (select count(*) from public.partner_offers where request_id = '${RB}' and status = 'confirmed') as cb,
      (select status::text from public.service_requests where id = '${RC}') as sc,
      (select count(*) from public.assignments where request_id = '${RC}') as ac,
      (select count(*) from public.commission_entries where request_id = '${RC}' and kind = 'booking') as jc,
      (select status::text from public.partner_offers where request_id = '${RC}') as oc`)[0] as Record<string, string | number>
    expect([Number(st.sa), Number(st.ab), Number(st.jb), Number(st.cb)]).toEqual([3, 1, 1, 1])
    // RC: bestätigt (Zuordnung und Journal je 1, Angebot confirmed) oder von der Sperre zurückgezogen (nichts gebucht, Status awaiting_offer)
    const done = st.sc === 'accepted' && Number(st.ac) === 1 && Number(st.jc) === 1 && st.oc === 'confirmed'
    const back = st.sc === 'awaiting_offer' && Number(st.ac) === 0 && Number(st.jc) === 0 && st.oc === 'withdrawn'
    expect(done || back, JSON.stringify(st)).toBe(true)
  }, 480_000)
})
