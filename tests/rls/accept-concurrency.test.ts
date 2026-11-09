// Nebenläufigkeit der Annahme (S9c, Konzept 6.1): 10 parallele Annahmen = 1; Annahme gegen Rücknahme: genau eine gewinnt.
// Echte Wettläufe brauchen committete Fixtures und getrennte Verbindungen (je Aufruf eine CLI-Abfrage). Alle Aufrufe warten auf einen
// gemeinsamen Startzeitpunkt der Datenbankuhr. Rest nach dem Lauf: Das Journal ist unlöschbar (ON DELETE RESTRICT), die gewonnene Annahme
// bleibt mit Kunde, Auftrag, Firma und deren Nutzer stehen (AUTOPILOT.md, „Reste auf Dev“); alles andere räumt der Test auf.
import { afterAll, describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { ownerSql, ownerSqlAsync } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, ownerDeletePartner } from '../support/partner.ts'

const N = 10
const adm = newId()
const cust = newId()
const cust2 = newId()
const pu = Array.from({ length: N }, () => newId())
const R1 = newId()
const R2 = newId()

const request = (id: string, customer: string) => `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
  values ('${id}', '${customer}', gen_random_uuid(), 'move', 'requested', 1, now() + interval '14 days', now() + interval '1 day');
  insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
  values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[]}', 1, 68961, 68961, 68961);
  update public.service_requests set current_revision = (select id from public.price_revisions where request_id = '${id}' and n = 1) where id = '${id}';
  select public.distribute_request('${id}');`

const startAt = (secs: number) => `select pg_sleep(greatest(0, extract(epoch from (timestamptz '${new Date(Date.now() + secs * 1000).toISOString()}' - clock_timestamp()))));`

/**
 * Räumt Testfirmen und Testnutzer auf (E-Mail pt-*@movenow.test), auch Reste früherer Läufe: Firmen mit Zuordnung (Journal, unlöschbar)
 * werden gesperrt, damit sie nie Empfänger anderer Tests sind; alle übrigen samt Nutzer gelöscht. Nutzer einzeln, weil Kunden mit Journal bleiben.
 */
function sweep(admin: string) {
  const rows = (q: string) => ownerSql(q) as Record<string, string>[]
  try {
    const firms = rows(`select distinct p.id, p.status::text as status, (exists (select 1 from public.assignments a where a.partner_id = p.id) or exists (select 1 from public.partner_offers o where o.partner_id = p.id)) as bound
      from public.partners p join public.partner_members m on m.partner_id = p.id join auth.users u on u.id = m.user_id where u.email like 'pt-%@movenow.test' and p.name <> 'Testabdeckung GmbH'`) as unknown as { id: string; status: string; bound: boolean }[]
    for (const f of firms) {
      if (!f.bound) ownerDeletePartner(f.id)
      else if (f.status === 'active' || f.status === 'payment_hold') ownerSql(`select public.admin_set_partner_status('${admin}', '${f.id}', 'suspended', 'Testrest nach Wettlauftest ${f.id.slice(0, 8)}')`)
    }
    for (const u of rows(`select id from auth.users u where u.email like 'pt-%@movenow.test' and u.id <> '${admin}'
      and not exists (select 1 from public.partner_members m join public.partners p on p.id = m.partner_id where m.user_id = u.id and p.name = 'Testabdeckung GmbH')`)) {
      try {
        ownerSql(`delete from auth.users where id = '${u.id}'`)
      } catch {
        // Kunde oder Firmenmitglied mit Journal: bleibt (OPEN_ISSUES S9c-7)
      }
    }
  } catch (e) {
    console.warn('Aufräumen unvollständig:', (e as Error).message.slice(0, 200))
  }
}

afterAll(() => {
  sweep(adm)
  try {
    ownerSql(`delete from auth.users where id = '${adm}'`)
  } catch {
    // admin hat Audit-Einträge: bleibt
  }
})

describe('Nebenläufigkeit', () => {
  it(`${N} parallele Annahmen = 1; Annahme gegen Rücknahme = genau eine`, async () => {
    // erst Admin anlegen und Reste früherer Läufe sperren/löschen, dann die Fixtures dieses Laufs
    ownerSql(`begin; ${insertUsers([adm])} ${grantAdmin(adm)} commit;`)
    sweep(adm)
    const setup = `begin; ${insertUsers([cust, cust2, ...pu])}
      ${pu.map((u, i) => firm(u, `w${i}`, 'active', adm)).join(' ')}
      ${request(R1, cust)} ${request(R2, cust2)} commit;`
    ownerSql(setup)
    const fee = ownerSql(`select value::float8 as v from public.platform_settings where key = 'fee_rate' order by effective_from desc, version desc limit 1`)[0] as { v: number }
    const vat = ownerSql(`select value::float8 as v from public.platform_settings where key = 'fee_vat_rate' order by effective_from desc, version desc limit 1`)[0] as { v: number }
    const vers = ownerSql(`select (select version from public.platform_settings where key = 'fee_rate' order by effective_from desc, version desc limit 1) as a, (select version from public.platform_settings where key = 'fee_vat_rate' order by effective_from desc, version desc limit 1) as b`)[0] as { a: number; b: number }
    const s = splitFee(68961, { feeRate: fee.v, vatRate: vat.v })
    const lid = (req: string, i: number) =>
      `(select l.id from public.job_listings l join public.partner_members m on m.partner_id = l.partner_id where l.request_id = '${req}' and m.user_id = '${pu[i]}')`
    const accept = (req: string, i: number) =>
      `${startAt(9)} set local role service_role; select public.partner_accept('${pu[i]}', ${lid(req, i)}, (select id from public.price_revisions where request_id = '${req}' and n = 1), ${s.payoutCents}, ${fee.v}, ${vat.v}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${vers.a}, ${vers.b});`

    // Wettlauf 1: 10 Firmen, ein Auftrag. Wettlauf 2: Firma 0 nimmt R2 an, während der Kunde zurückzieht.
    const withdraw = `${startAt(9)} set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${cust2}","role":"authenticated","aal":"aal1"}', true); select public.withdraw('${R2}');`
    const runs = await Promise.all([
      ...pu.map((_, i) => ownerSqlAsync(`begin; ${accept(R1, i)} commit;`)),
      ownerSqlAsync(`begin; ${accept(R2, 0)} commit;`),
      ownerSqlAsync(`begin; ${withdraw} commit;`),
    ])
    const first = runs.slice(0, N)
    const wins = first.filter((r) => 'rows' in r)
    const msgs = first.filter((r): r is { error: string } => 'error' in r).map((r) => r.error)
    expect(wins, JSON.stringify(first)).toHaveLength(1)
    expect(msgs).toHaveLength(N - 1)
    expect(msgs.every((m) => m.includes('already_taken')), msgs.join(' | ')).toBe(true)

    const acc2 = runs[N] ?? { error: 'fehlt' }
    const wd2 = runs[N + 1] ?? { error: 'fehlt' }
    expect(['rows' in acc2, 'rows' in wd2].filter(Boolean), JSON.stringify([acc2, wd2])).toHaveLength(1)
    const lost = 'error' in acc2 ? acc2.error : (wd2 as { error: string }).error
    expect(lost.includes('request_closed') || lost.includes('invalid_transition'), lost).toBe(true)

    const state = ownerSql(`select
      (select count(*) from public.assignments where request_id = '${R1}') as a1,
      (select count(*) from public.commission_entries where request_id = '${R1}' and kind = 'booking') as j1,
      (select status::text from public.service_requests where id = '${R1}') as s1,
      (select count(*) from public.job_listings where request_id = '${R1}' and status = 'accepted') as l1,
      (select count(*) from public.assignments where request_id = '${R2}') + (select count(*) from public.commission_entries where request_id = '${R2}') as x2,
      (select status::text from public.service_requests where id = '${R2}') as s2`)[0] as Record<string, string | number>
    expect([Number(state.a1), Number(state.j1), state.s1, Number(state.l1)]).toEqual([1, 1, 'accepted', 1])
    // R2: entweder angenommen (Zuordnung und Journal je 1) oder zurückgezogen (nichts)
    expect(state.s2 === 'accepted' ? Number(state.x2) === 2 : state.s2 === 'withdrawn' && Number(state.x2) === 0, JSON.stringify(state)).toBe(true)
  }, 480_000)
})
