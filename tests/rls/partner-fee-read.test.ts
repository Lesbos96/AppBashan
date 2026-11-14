// Gebührensatz lesen (Migration 0027, N-10, s9p-1 Migration 0062): Mitglieder jeder Partnerfirma (jeder Status, aal2) lesen nur fee_vat_rate
// aus platform_settings; der alte Satz fee_rate ist für sie unsichtbar, sonst niemand außer admin (aal2). Die Staffel steht in fee_schedules
// (tests/rls/fee-schedule.test.ts). Rollback-Proben mit aal als Claim; echte Token in partner-mfa.test.ts.
import { describe, expect, it } from 'vitest'
import { probes, type Step } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, STATUSES } from '../support/partner.ts'

const NO_TABLE = '42501: permission denied for table platform_settings'
const FEE = "key = 'fee_vat_rate'"
const N = (where: string) => `=(select count(*) from public.platform_settings where ${where})`
const auth = (sub: string, aal: 'aal1' | 'aal2' = 'aal2') => ({ as: 'authenticated', claims: { sub, aal } }) as const

const U = { adm: newId(), cust: newId(), rp: newId(), pending: newId(), active: newId(), payment_hold: newId(), suspended: newId(), rejected: newId() }

describe('Gebührensatz lesen', () => {
  it('Mitglied jeder Firma mit aal2 liest den Satz; aal1, Kunde, rental_provider, anon nicht; note und Schreiben verweigert', () => {
    const setup = [
      insertUsers(Object.values(U)), grantAdmin(U.adm), `select public.admin_grant_role('${U.rp}', 'rental_provider');`,
      ...STATUSES.map((s) => firm(U[s], s, s, U.adm)),
      // angekündigter Satz (P2B): künftige Zeile, im Rollback
      `insert into public.platform_settings (key, version, value, effective_from) values ('fee_rate', 99, 0.16, (now() at time zone 'Europe/Vienna')::date + 400);`,
    ].join(' ')
    const FUTURE = N("key = 'fee_rate' and effective_from > (now() at time zone 'Europe/Vienna')::date")
    const steps: Step[] = [
      { name: 'owner_fee', sql: N(FEE) },
      { name: 'owner_other', sql: N(`not (${FEE})`) },
      ...STATUSES.flatMap((s): Step[] => [
        { name: `${s} aal2`, sql: N(FEE), ...auth(U[s]) },
        { name: `${s} aal1`, sql: N(FEE), ...auth(U[s], 'aal1') },
      ]),
      ...STATUSES.map((s): Step => ({ name: `künftige Zeile ${s} aal2`, sql: FUTURE, ...auth(U[s]) })),
      { name: 'künftige Zeile Mitglied aal1', sql: FUTURE, ...auth(U.active, 'aal1') },
      { name: 'künftige Zeile Kunde', sql: FUTURE, ...auth(U.cust) },
      { name: 'künftige Zeile rental_provider', sql: FUTURE, ...auth(U.rp) },
      { name: 'Mitglied: andere Schlüssel', sql: N(`not (${FEE})`), ...auth(U.active) },
      { name: 'Kunde ohne Firma aal2', sql: N(FEE), ...auth(U.cust) },
      { name: 'rental_provider aal2', sql: N(FEE), ...auth(U.rp) },
      { name: 'anon', sql: 'perform key from public.platform_settings', as: 'anon' },
      { name: 'Mitglied: note', sql: 'perform note from public.platform_settings', ...auth(U.active) },
      { name: 'Mitglied: select *', sql: 'perform * from public.platform_settings', ...auth(U.active) },
      { name: 'admin aal2: note', sql: 'perform note from public.platform_settings', ...auth(U.adm) },
      { name: 'Gegenfall: Spaltenliste', sql: 'perform key, version, value, effective_from from public.platform_settings', ...auth(U.active) },
      { name: 'Mitglied: insert', sql: "insert into public.platform_settings (key, version, value, effective_from) values ('fee_rate', 99, 0, date '2999-01-01')", ...auth(U.active) },
      { name: 'Mitglied: update', sql: "update public.platform_settings set value = 0 where key = 'fee_rate'", ...auth(U.active) },
      { name: 'Mitglied: delete', sql: "delete from public.platform_settings where key = 'fee_rate'", ...auth(U.active) },
      { name: 'admin aal2 liest alles', sql: N('true'), ...auth(U.adm) },
      { name: 'owner_all', sql: N('true') },
      { name: 'admin aal1', sql: N('true'), ...auth(U.adm, 'aal1') },
    ]
    const r = probes(setup, steps)
    const fee = r['owner_fee']
    expect(Number(fee?.slice(2))).toBeGreaterThanOrEqual(1)
    expect(Number(r['owner_other']?.slice(2))).toBeGreaterThan(0)
    for (const s of STATUSES) {
      expect(r[`${s} aal2`], `${s} aal2`).toBe(fee)
      expect(r[`${s} aal1`], `${s} aal1`).toBe('= 0')
    }
    // fee_rate (Historie) liest kein Mitglied, auch nicht die künftige Zeile
    for (const s of STATUSES) expect(r[`künftige Zeile ${s} aal2`], `künftige Zeile ${s}`).toBe('= 0')
    for (const k of ['künftige Zeile Mitglied aal1', 'künftige Zeile Kunde', 'künftige Zeile rental_provider']) expect(r[k], k).toBe('= 0')
    expect(r['Mitglied: andere Schlüssel']).toBe('= 0')
    expect(r['Kunde ohne Firma aal2']).toBe('= 0')
    expect(r['rental_provider aal2']).toBe('= 0')
    for (const k of ['anon', 'Mitglied: note', 'Mitglied: select *', 'admin aal2: note', 'Mitglied: insert', 'Mitglied: update', 'Mitglied: delete']) expect(r[k], k).toBe(NO_TABLE)
    expect(r['Gegenfall: Spaltenliste']).toBe('ok')
    expect(r['admin aal2 liest alles']).toBe(r['owner_all'])
    expect(r['admin aal1']).toBe('= 0')
  }, 180_000)
})
