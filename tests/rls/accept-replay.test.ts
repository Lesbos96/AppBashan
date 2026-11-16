// n12 (N-12, GOLIVE 23): Wiederholung der Annahme nach verlorener Antwort. `partner_accept_replay` liefert der Firma, die das Listing selbst
// angenommen hat, dieselbe assignmentId (keine zweite Zeile, keine zweite Buchung); in allen anderen Fällen null (die Function bleibt bei 409).
// Alles läuft in einer Rollback-Transaktion (`probes`): kein Rest auf Dev.
import { describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { currentFee } from '../support/fee.ts'
import { probes } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId } from '../support/partner.ts'

const [adm, cust, pa, pb] = [newId(), newId(), newId(), newId()]
const R = newId()

describe('Annahme: Wiederholung nach verlorener Antwort', () => {
  it('gleiche Firma, gleiche Revision, gleiche Auszahlung: dieselbe assignmentId, je eine Zeile; sonst null', () => {
    const f = currentFee()
    const s = splitFee(68961, { tiers: f.tiers, vatRate: f.vr })
    const setup = `${insertUsers([adm, cust, pa, pb])} ${grantAdmin(adm)} ${firm(pa, 'a', 'active', adm)} ${firm(pb, 'b', 'active', adm)}
      insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
        values ('${R}', '${cust}', gen_random_uuid(), 'move', 'requested', 1, now() + interval '14 days', now() + interval '1 day');
      insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
        values ('${R}', 1, 'submit', '{}', '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[]}', 1, 68961, 68961, 68961);
      update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${R}' and n = 1) where id = '${R}';
      select public.distribute_request('${R}');`
    const rev = `(select id from public.price_revisions where request_id = '${R}' and n = 1)`
    const lid = (key: string) => `(select id from public.job_listings where request_id = '${R}' and partner_id = current_setting('app.p_${key}')::uuid)`
    const replay = (actor: string, listing: string, revision = rev, payout = s.payoutCents) =>
      `public.partner_accept_replay(${actor}, ${listing}, ${revision}, ${payout})`
    const a = `'${pa}'`
    const sr = 'service_role' as const
    const counts = `(select count(*) from public.assignments where request_id = '${R}') || '/' ||
      (select count(*) from public.commission_entries where request_id = '${R}' and kind = 'booking') || '/' ||
      (select count(*) from public.outbox where dedupe_key = 'request_accepted:${R}')`

    const r = probes(setup, [
      { name: 'vor der Annahme', sql: `= ${replay(a, lid('a'))}`, as: sr },
      {
        name: 'Annahme',
        sql: `perform set_config('app.aid', public.partner_accept('${pa}', ${lid('a')}, ${rev}, ${s.payoutCents}, ${f.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${f.fsv}, ${f.vrv})::text, true)`,
        as: sr,
      },
      { name: 'Wiederholung 1', sql: `? ${replay(a, lid('a'))} = current_setting('app.aid')::uuid`, as: sr },
      { name: 'Wiederholung 2', sql: `? ${replay(a, lid('a'))} = current_setting('app.aid')::uuid`, as: sr },
      { name: 'je eine Zeile', sql: `= ${counts}` },
      { name: 'andere Firma, eigenes Listing', sql: `= ${replay(`'${pb}'`, lid('b'))}`, as: sr },
      { name: 'andere Firma, fremdes Listing', sql: `= ${replay(`'${pb}'`, lid('a'))}`, as: sr },
      { name: 'Kunde als Akteur', sql: `= ${replay(`'${cust}'`, lid('a'))}`, as: sr },
      { name: 'Akteur null', sql: `= ${replay('null::uuid', lid('a'))}`, as: sr },
      { name: 'andere Revision', sql: `= ${replay(a, lid('a'), 'gen_random_uuid()')}`, as: sr },
      { name: 'andere Auszahlung', sql: `= ${replay(a, lid('a'), rev, s.payoutCents + 1)}`, as: sr },
      { name: 'Zuordnung beenden', sql: `update public.assignments set ended_at = now(), ended_reason = 'cancelled_by_customer' where request_id = '${R}'` },
      { name: 'nach beendeter Zuordnung', sql: `= ${replay(a, lid('a'))}`, as: sr },
      { name: 'ohne Recht (authenticated)', sql: `perform ${replay(a, lid('a'))}`, as: 'authenticated' },
    ])
    const NULLV = '= <null>'
    expect(r['vor der Annahme'], JSON.stringify(r)).toBe(NULLV)
    expect(r['Annahme'], JSON.stringify(r)).toBe('ok')
    expect(r['Wiederholung 1'], JSON.stringify(r)).toBe('ok')
    expect(r['Wiederholung 2'], JSON.stringify(r)).toBe('ok')
    expect(r['je eine Zeile']).toBe('= 1/1/1')
    expect(r['Zuordnung beenden'], JSON.stringify(r)).toBe('ok')
    for (const k of ['andere Firma, eigenes Listing', 'andere Firma, fremdes Listing', 'Kunde als Akteur', 'Akteur null', 'andere Revision', 'andere Auszahlung', 'nach beendeter Zuordnung']) {
      expect(r[k], k).toBe(NULLV)
    }
    expect(r['ohne Recht (authenticated)']).toMatch(/^42501/)
  }, 120_000)
})
