// n12b: Wettläufe beim Storno (echte Verbindungen, committete Fixtures wie change-orders-concurrency.test.ts).
// (1) Zweimal derselbe Storno der Firma mit Pauschale und (2) zweimal derselbe Storno des Kunden mit Stornogebühr: genau ein Erfolg, der Verlierer scheitert vor jeder
// Buchung (not_found bzw. invalid_transition) und bekommt danach über `cancel_replay` dasselbe Ergebnis (der Handler antwortet dann 200); genau eine Gebührenzeile,
// eine Audit-Zeile, eine Mail, Summen unverändert. (3) Kunde gegen Firma auf derselben Anfrage: genau ein Storno gewinnt, die Replay-Antwort gibt es nur für den Gewinner.
// Rest nach dem Lauf: Journal ist unlöschbar; Kunde, Aufträge und die beteiligte Firma (gesperrt) bleiben (OPEN_ISSUES S9c-7).
import { afterAll, describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { ownerSql, ownerSqlAsync } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId } from '../support/partner.ts'
import { sweepTestResidue } from '../support/sweep.ts'

const adm = newId()
const cust = newId()
const pa = newId()
const [P1, K1, V1] = [newId(), newId(), newId()]
const TOTAL = 68961
const CALL_OUT = 6900
const LATE = 34481 // 50 % von 68961, Termin in 30 Stunden

const startAt = (secs: number) => `select pg_sleep(greatest(0, extract(epoch from (timestamptz '${new Date(Date.now() + secs * 1000).toISOString()}' - clock_timestamp()))));`

afterAll(() => sweepTestResidue(adm, true)) // admin hat Audit-Einträge und bleibt meist stehen

describe('Wettlauf beim Storno', () => {
  it('doppelter Storno = eine Buchung, der Verlierer erhält die Replay-Antwort; Kunde gegen Firma = ein Storno', async () => {
    ownerSql(`begin; ${insertUsers([adm])} ${grantAdmin(adm)} commit;`)
    sweepTestResidue(adm)
    const f = currentFee()
    const rates = { tiers: f.tiers, vatRate: f.vr }
    const s0 = splitFee(TOTAL, rates)
    const fee = splitFee(CALL_OUT, rates)
    const late = splitFee(LATE, rates)
    const terms = `"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":${CALL_OUT},"termsHash":"x"}`
    const rev = (id: string) => `(select id from public.price_revisions where request_id = '${id}' and n = 1)`
    // Bezirk 21: keine committete Abdeckungsfirma, eine Weitervermittlung bleibt unvermittelt
    const job = (id: string, termin: string) => `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
      values ('${id}', '${cust}', gen_random_uuid(), 'move', 'requested', 21, ${termin}, now() + interval '1 day');
      insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
      values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[],${terms}}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
      update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
      select public.distribute_request('${id}');
      select public.partner_accept('${pa}', (select id from public.job_listings where request_id = '${id}' and partner_id = current_setting('app.p_a')::uuid), ${rev(id)},
        ${s0.payoutCents}, ${f.vr}, ${s0.feeCents}, ${s0.feeNetCents}, ${s0.feeVatCents}, ${s0.payoutCents}, ${f.fsv}, ${f.vrv});`
    const receipts = (id: string) => `array(select id from public.job_photos where request_id = '${id}' and kind = 'receipt')`
    ownerSql(`begin; ${insertUsers([cust, pa])} ${firm(pa, 'a', 'active', adm, { districts: 'array[21]::smallint[]' })}
      ${job(P1, "now() - interval '2 hours'")} ${job(K1, "now() + interval '30 hours'")} ${job(V1, "now() + interval '5 days'")}
      insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
        values ('${P1}', 'receipt', current_setting('app.p_a')::uuid, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());
      select public.propose_change('${pa}', 'aal2', '${P1}', ${rev(P1)}, '{"hours":6}'::jsonb, 80000, ${receipts(P1)});
      select public.decide_change('${cust}', (select id from public.price_revisions where request_id = '${P1}' and source = 'change_order' and status = 'proposed'), false, 80000, ${f.vr}, 0, 0, 0, 0, ${f.fsv}, ${f.vrv});
      commit;`)

    const partnerCancel = (id: string, reason: string, base: number, photos: string) => {
      const s = base > 0 ? fee : { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
      return `select public.cancel_by_partner('${pa}', 'aal2', '${id}', '${reason}', ${photos}, ${base}, ${f.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${f.fsv}, ${f.vrv})`
    }
    const customerCancel = (id: string, base: number) => {
      const s = base > 0 ? late : { feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
      return `select public.cancel_by_customer('${cust}', '${id}', ${base}, ${f.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${f.fsv}, ${f.vrv})`
    }
    const race = (sql: string) => ownerSqlAsync(`begin; ${startAt(9)} set local role service_role; ${sql}; commit;`)
    const runs = await Promise.all([
      race(partnerCancel(P1, 'scope_impossible', CALL_OUT, receipts(P1))),
      race(partnerCancel(P1, 'scope_impossible', CALL_OUT, receipts(P1))),
      race(customerCancel(K1, LATE)),
      race(customerCancel(K1, LATE)),
      race(customerCancel(V1, 0)),
      race(partnerCancel(V1, 'unavailable', 0, 'null')),
    ])
    const won = (r: (typeof runs)[number]) => 'rows' in r
    const lost = (r: (typeof runs)[number]) => ('error' in r ? r.error : '')

    // (1) Firma gegen Firma
    expect(runs.slice(0, 2).filter(won), JSON.stringify(runs.slice(0, 2))).toHaveLength(1)
    expect(lost(runs.find((r, i) => i < 2 && !won(r))!)).toContain('not_found')
    // (2) Kunde gegen Kunde
    expect(runs.slice(2, 4).filter(won), JSON.stringify(runs.slice(2, 4))).toHaveLength(1)
    expect(lost(runs.find((r, i) => i >= 2 && i < 4 && !won(r))!)).toContain('invalid_transition')
    // (3) Kunde gegen Firma: genau ein Storno
    expect(runs.slice(4).filter(won), JSON.stringify(runs.slice(4))).toHaveLength(1)

    const q = (sql: string) => String(Object.values(ownerSql(sql)[0] ?? {})[0])
    const lines = (id: string, kind: string) => q(`select count(*) from public.commission_entries where request_id = '${id}' and kind = '${kind}'`)
    const audits = (id: string, action: string) => q(`select count(*) from public.audit_log where entity_id = '${id}' and action = '${action}'`)
    const mails = (id: string, kind: string) => q(`select count(*) from public.outbox where request_id = '${id}' and kind = '${kind}'`)
    const sums = (id: string) => q(`select concat_ws(',', sum(total_cents), sum(fee_cents), sum(payout_cents)) from public.commission_entries where request_id = '${id}'`)
    const replay = (actor: string, id: string, action: string, shown: number, reason: string, photos: string) =>
      q(`select coalesce(public.cancel_replay('${actor}', '${id}', '${action}', ${shown}, ${reason}, ${photos}), '<null>')`)

    expect([lines(P1, 'cancellation_fee'), audits(P1, 'cancel_by_partner'), mails(P1, 'partner_cancelled_fee'), mails(P1, 'partner_cancelled')]).toEqual(['1', '1', '1', '0'])
    expect(sums(P1)).toBe(`${CALL_OUT},${fee.feeCents},${fee.payoutCents}`)
    expect(replay(pa, P1, 'cancel_by_partner', CALL_OUT, "'scope_impossible'", receipts(P1))).toBe('cancelled_by_partner')

    expect([lines(K1, 'cancellation_fee'), audits(K1, 'cancel_by_customer')]).toEqual(['1', '1'])
    expect(sums(K1)).toBe(`${LATE},${late.feeCents},${late.payoutCents}`)
    expect(replay(cust, K1, 'cancel_by_customer', LATE, 'null', 'null')).toBe('cancelled_by_customer')

    const [vc, vp] = [audits(V1, 'cancel_by_customer'), audits(V1, 'cancel_by_partner')]
    expect([Number(vc) + Number(vp)], 'ein Storno auf V1').toEqual([1])
    const winnerIsCustomer = vc === '1'
    expect(q(`select status::text from public.service_requests where id = '${V1}'`)).toBe(winnerIsCustomer ? 'cancelled_by_customer' : 'cancelled_by_partner')
    expect(replay(cust, V1, 'cancel_by_customer', 0, 'null', 'null')).toBe(winnerIsCustomer ? 'cancelled_by_customer' : '<null>')
    expect(replay(pa, V1, 'cancel_by_partner', 0, "'unavailable'", 'null')).toBe(winnerIsCustomer ? '<null>' : 'cancelled_by_partner')
    expect(lines(V1, 'cancellation_fee')).toBe('0')
  }, 480_000)
})
