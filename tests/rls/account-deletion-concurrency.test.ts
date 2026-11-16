// s9k1-1 (Migration 0066): Konto löschen gegen Meldung „nicht stattgefunden“ als echter Wettlauf, getrennte Verbindungen, committete Fixtures
// (Muster change-orders-concurrency.test.ts). Sitzung A hält ihre Sperre vier Sekunden, Sitzung B setzt zwei Sekunden nach A ein und muss warten.
// Rest nach dem Lauf: Journal ist unlöschbar; Kunden (einer anonymisiert), Aufträge und die Firma bleiben (OPEN S9c-7).
import { afterAll, describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { ownerSql, ownerSqlAsync } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId } from '../support/partner.ts'
import { sweepTestResidue } from '../support/sweep.ts'

const adm = newId()
const pa = newId()
const [c1, c2] = [newId(), newId()]
const [R1, R2] = [newId(), newId()]
const BOOKED = 68961

const at = (secs: number) => `select pg_sleep(greatest(0, extract(epoch from (timestamptz '${new Date(Date.now() + secs * 1000).toISOString()}' - clock_timestamp()))));`
const asCustomer = (id: string) => `set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${id}","role":"authenticated","aal":"aal1"}', true);`

afterAll(() => sweepTestResidue(adm, true))

describe('Konto löschen gegen Meldung (s9k1-1)', () => {
  it('Meldung zuerst: die Löschung endet mit under_review; Löschung zuerst: die Meldung endet mit not_found', async () => {
    ownerSql(`begin; ${insertUsers([adm])} ${grantAdmin(adm)} commit;`)
    sweepTestResidue(adm)
    const f = currentFee()
    const s0 = splitFee(BOOKED, { tiers: f.tiers, vatRate: f.vr })
    // Bezirk 21: keine committete Abdeckungsfirma, die Anfrage bleibt bei Firma a; abgeschlossen, Termin vor zwei Stunden (Meldefenster offen)
    const job = (id: string, cust: string) => `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
      values ('${id}', '${cust}', gen_random_uuid(), 'move', 'requested', 21, now() - interval '2 hours', now() + interval '1 day');
      insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
      values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":${BOOKED},"lowCents":${BOOKED},"highCents":${BOOKED},"lines":[],"terms":{"x":1}}', 1, ${BOOKED}, ${BOOKED}, ${BOOKED});
      update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${id}' and n = 1) where id = '${id}';
      select public.distribute_request('${id}');
      select public.partner_accept('${pa}', (select id from public.job_listings where request_id = '${id}' and partner_id = current_setting('app.p_a')::uuid), (select id from public.price_revisions where request_id = '${id}' and n = 1),
        ${s0.payoutCents}, ${f.vr}, ${s0.feeCents}, ${s0.feeNetCents}, ${s0.feeVatCents}, ${s0.payoutCents}, ${f.fsv}, ${f.vrv});
      select private.set_request_status('${id}', 'in_progress', null, 'partner'); select private.set_request_status('${id}', 'completed', null, 'partner');`
    ownerSql(`begin; ${insertUsers([c1, c2, pa])} ${firm(pa, 'a', 'active', adm, { districts: 'array[21]::smallint[]' })} ${job(R1, c1)} ${job(R2, c2)} commit;`)

    const [m1, d1, d2, m2] = await Promise.all([
      // Rennen 1: A meldet und hält die Sperre auf R1, B löscht c1 und muss warten
      ownerSqlAsync(`begin; ${at(9)} ${asCustomer(c1)} select public.report_not_done('${R1}'); select pg_sleep(4); commit;`),
      ownerSqlAsync(`begin; ${at(11)} set local role service_role; select public.delete_account('${c1}'); commit;`),
      // Rennen 2: A löscht c2 und hält die Sperre auf R2, B meldet und muss warten
      ownerSqlAsync(`begin; ${at(9)} set local role service_role; select public.delete_account('${c2}'); select pg_sleep(4); commit;`),
      ownerSqlAsync(`begin; ${at(11)} ${asCustomer(c2)} select public.report_not_done('${R2}'); commit;`),
    ])

    expect('rows' in m1, JSON.stringify(m1)).toBe(true)
    expect('error' in d1 && d1.error.includes('under_review'), JSON.stringify(d1)).toBe(true)
    expect(ownerSql(`select (select deleted_at is null from public.profiles where id = '${c1}') as live, (select not_done_reported_at is not null from public.service_requests where id = '${R1}') as rep`)).toEqual([{ live: true, rep: true }])

    expect('rows' in d2, JSON.stringify(d2)).toBe(true)
    expect('error' in m2 && m2.error.includes('not_found'), JSON.stringify(m2)).toBe(true)
    expect(ownerSql(`select (select deleted_at is not null from public.profiles where id = '${c2}') as gone, (select not_done_reported_at is null from public.service_requests where id = '${R2}') as open`)).toEqual([{ gone: true, open: true }])
  }, 120_000)
})
