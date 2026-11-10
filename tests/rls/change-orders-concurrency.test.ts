// Nebenläufigkeit des Nachtrags (S9f): zwei Vorschläge = einer; doppelte Annahme = eine Journalzeile; Annahme gegen Rückzug = ein Ergebnis.
// Echte Wettläufe brauchen committete Fixtures und getrennte Verbindungen (wie offers-concurrency.test.ts).
// Rest nach dem Lauf: Journal ist unlöschbar; Kunde, Aufträge, Nachträge und die beteiligte Firma (gesperrt) bleiben (OPEN_ISSUES S9c-7).
import { afterAll, describe, expect, it } from 'vitest'
import { splitChange, splitFee } from '@pricing'
import { ownerSql, ownerSqlAsync } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId } from '../support/partner.ts'
import { sweepTestResidue } from '../support/sweep.ts'

const adm = newId()
const cust = newId()
const pa = newId()
const [RA, RB, RC] = [newId(), newId(), newId()]
const BOOKED = 68961

const startAt = (secs: number) => `select pg_sleep(greatest(0, extract(epoch from (timestamptz '${new Date(Date.now() + secs * 1000).toISOString()}' - clock_timestamp()))));`

afterAll(() => sweepTestResidue(adm, true)) // admin hat Audit-Einträge und bleibt meist stehen

describe('Nebenläufigkeit des Nachtrags', () => {
  it('zwei Vorschläge = einer; doppelte Annahme = eine Journalzeile; Annahme gegen Rückzug = genau ein Ergebnis', async () => {
    ownerSql(`begin; ${insertUsers([adm])} ${grantAdmin(adm)} commit;`)
    sweepTestResidue(adm)
    const f = ownerSql(`select (select value::float8 from public.platform_settings where key = 'fee_rate' and effective_from <= (now() at time zone 'Europe/Vienna')::date order by effective_from desc, version desc limit 1) as fr,
      (select value::float8 from public.platform_settings where key = 'fee_vat_rate' and effective_from <= (now() at time zone 'Europe/Vienna')::date order by effective_from desc, version desc limit 1) as vr,
      (select version from public.platform_settings where key = 'fee_rate' and effective_from <= (now() at time zone 'Europe/Vienna')::date order by effective_from desc, version desc limit 1) as frv,
      (select version from public.platform_settings where key = 'fee_vat_rate' and effective_from <= (now() at time zone 'Europe/Vienna')::date order by effective_from desc, version desc limit 1) as vrv`)[0] as { fr: number; vr: number; frv: number; vrv: number }
    const rates = { feeRate: f.fr, vatRate: f.vr }
    const s0 = splitFee(BOOKED, rates)
    // Bezirk 21: keine committete Abdeckungsfirma, die Anfrage bleibt bei Firma a
    const job = (id: string) => `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
      values ('${id}', '${cust}', gen_random_uuid(), 'move', 'requested', 21, now() + interval '14 days', now() + interval '1 day');
      insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
      values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":${BOOKED},"lowCents":${BOOKED},"highCents":${BOOKED},"lines":[],"terms":{"x":1}}', 1, ${BOOKED}, ${BOOKED}, ${BOOKED});
      update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${id}' and n = 1) where id = '${id}';
      select public.distribute_request('${id}');
      select public.partner_accept('${pa}', (select id from public.job_listings where request_id = '${id}' and partner_id = current_setting('app.p_a')::uuid), (select id from public.price_revisions where request_id = '${id}' and n = 1),
        ${s0.payoutCents}, ${f.fr}, ${f.vr}, ${s0.feeCents}, ${s0.feeNetCents}, ${s0.feeVatCents}, ${s0.payoutCents}, ${f.frv}, ${f.vrv});
      insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
      values ('${id}', 'receipt', current_setting('app.p_a')::uuid, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());`
    const photos = (id: string) => `array(select id from public.job_photos where request_id = '${id}' and kind = 'receipt')`
    const propose = (id: string, total: number) => `public.propose_change('${pa}', 'aal2', '${id}', (select current_revision from public.service_requests where id = '${id}'), '{}'::jsonb, ${total}, ${photos(id)})`
    const c80 = splitChange(80000, rates, s0)
    // Die Revisions-ID steht vor dem Rennen fest: als Unterabfrage im Aufruf käme sie leer an (not_found), sobald der andere Aufruf schon angenommen hat
    const decide = (rev: string) =>
      `public.decide_change('${cust}', '${rev}', true, 80000, ${f.fr}, ${f.vr}, ${c80.feeCents}, ${c80.feeNetCents}, ${c80.feeVatCents}, ${c80.payoutCents}, ${f.frv}, ${f.vrv})`

    ownerSql(`begin; ${insertUsers([cust, pa])} ${firm(pa, 'a', 'active', adm, { districts: 'array[21]::smallint[]' })} ${job(RA)} ${job(RB)} ${job(RC)}
      select ${propose(RB, 80000)}; select ${propose(RC, 80000)}; commit;`)

    // Partner dürfen Revisionen nicht lesen: die ID für den Rückzug kommt vorab als Eigentümer
    const proposedOf = (id: string) => String(ownerSql(`select id from public.price_revisions where request_id = '${id}' and status = 'proposed'`)[0]?.id)
    const [rbId, rcId] = [proposedOf(RB), proposedOf(RC)]
    const runs = await Promise.all([
      // Rennen 1: zwei Vorschläge auf RA
      ownerSqlAsync(`begin; ${startAt(9)} set local role service_role; select ${propose(RA, 80000)}; commit;`),
      ownerSqlAsync(`begin; ${startAt(9)} set local role service_role; select ${propose(RA, 90000)}; commit;`),
      // Rennen 2: doppelte Annahme auf RB
      ownerSqlAsync(`begin; ${startAt(9)} set local role service_role; select ${decide(rbId)}; commit;`),
      ownerSqlAsync(`begin; ${startAt(9)} set local role service_role; select ${decide(rbId)}; commit;`),
      // Rennen 3: Annahme gegen Rückzug auf RC
      ownerSqlAsync(`begin; ${startAt(9)} set local role service_role; select ${decide(rcId)}; commit;`),
      ownerSqlAsync(`begin; ${startAt(9)} set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${pa}","role":"authenticated","aal":"aal2"}', true);
        select public.withdraw_change('${rcId}'); commit;`),
    ])

    // Rennen 1: genau ein Vorschlag, der andere bekommt change_open
    const props = runs.slice(0, 2)
    expect(props.filter((r) => 'rows' in r), JSON.stringify(props)).toHaveLength(1)
    const lost = props.find((r): r is { error: string } => 'error' in r)
    expect(lost?.error.includes('change_open'), lost?.error).toBe(true)

    // Rennen 2: beide Aufrufe ergeben accepted, eine Journalzeile
    for (const r of runs.slice(2, 4)) expect('rows' in r && JSON.stringify(r.rows).includes('accepted'), JSON.stringify(r)).toBe(true)

    // Rennen 3: genau ein Ergebnis; Annahme und Rückzug schließen sich aus
    const [acc, wd] = [runs[4], runs[5]]
    const accOk = !!acc && 'rows' in acc
    const wdOk = !!wd && 'rows' in wd
    expect(accOk !== wdOk, JSON.stringify([acc, wd])).toBe(true)
    if (!accOk) expect((acc as { error: string }).error.includes('invalid_transition') || (acc as { error: string }).error.includes('change_not_valid'), JSON.stringify(acc)).toBe(true)
    if (!wdOk) expect((wd as { error: string }).error.includes('invalid_transition'), JSON.stringify(wd)).toBe(true)

    const st = ownerSql(`select
      (select count(*) from public.price_revisions where request_id = '${RA}' and status = 'proposed') as pa,
      (select count(*) from public.commission_entries where request_id = '${RB}' and kind = 'change') as jb,
      (select sum(fee_cents) from public.commission_entries where request_id = '${RB}') as fb,
      (select status from public.price_revisions where request_id = '${RC}' and n = 2) as sc,
      (select count(*) from public.commission_entries where request_id = '${RC}' and kind = 'change') as jc`)[0] as Record<string, string | number>
    expect(Number(st.pa)).toBe(1)
    expect([Number(st.jb), Number(st.fb)]).toEqual([1, splitFee(80000, rates).feeCents])
    expect([st.sc, Number(st.jc)]).toEqual(accOk ? ['accepted', 1] : ['withdrawn', 0])
  }, 480_000)
})
