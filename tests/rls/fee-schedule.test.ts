// Provisionsstaffel (s9p-1, Migration 0062): Tabellen fee_schedules/fee_schedule_tiers lesen nur Firmenmitglieder (jeder Status, aal2) und admin (aal2),
// niemand schreibt (auch service_role nicht), Zeilen sind unveränderlich. Die Vorschau payout_preview rechnet der Server (Firmenmitglied, aal2).
// Rollback-Proben mit aal als Claim.
import { describe, expect, it } from 'vitest'
import { tierFee } from '@pricing'
import { probes, type Step } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId, STATUSES } from '../support/partner.ts'

// Erwartungswerte der Vorgabe (Basis, Provision) je Version; Rundung: .4 ab, genau .5 und .9 auf
const V2_VEC = [
  [0, 0], [30000, 3600], [50000, 6000], [50001, 6000], [68961, 7896], [76041, 8604], [80000, 9000], [100000, 11000], [100001, 11000],
  [150000, 14500], [300000, 25000], [6900, 828], [50004, 6000], [50005, 6001], [50009, 6001], [100050, 11004],
] as const
const V1_VEC = [[68961, 10344], [7080, 1062], [76041, 11406], [6900, 1035], [10, 2], [68970, 10346]] as const
// Kreuztest SQL gegen @pricing: Grenzen ±1 und 20 feste Pseudo-Zufallsbeträge (lineare Kongruenz, reproduzierbar)
const CROSS = [49999, 50000, 50001, 99999, 100000, 100001, 1, 2, ...Array.from({ length: 20 }, (_, i) => 1 + ((i + 1) * 7919 * 104729) % 400000)]

const NO_TABLE = (t: string) => `42501: permission denied for table ${t}`
const N = (t: string) => `=(select count(*) from public.${t})`
const auth = (sub: string, aal: 'aal1' | 'aal2' = 'aal2') => ({ as: 'authenticated', claims: { sub, aal } }) as const

const U = { adm: newId(), cust: newId(), rp: newId(), pending: newId(), active: newId(), payment_hold: newId(), suspended: newId(), rejected: newId() }
const TABLES = ['fee_schedules', 'fee_schedule_tiers'] as const

describe('Provisionsstaffel: Lesen, Schreibsperre, Vorschau', () => {
  it('Mitglied jeder Firma (aal2) und admin lesen; aal1, Kunde, rental_provider, anon nicht; niemand schreibt; Zeilen unveränderlich', () => {
    const setup = [insertUsers(Object.values(U)), grantAdmin(U.adm), `select public.admin_grant_role('${U.rp}', 'rental_provider');`, ...STATUSES.map((s) => firm(U[s], s, s, U.adm))].join(' ')
    const steps: Step[] = []
    for (const t of TABLES) {
      steps.push({ name: `${t} owner`, sql: N(t) })
      for (const s of STATUSES) {
        steps.push({ name: `${t} ${s} aal2`, sql: N(t), ...auth(U[s]) }, { name: `${t} ${s} aal1`, sql: N(t), ...auth(U[s], 'aal1') })
      }
      steps.push(
        { name: `${t} Kunde`, sql: N(t), ...auth(U.cust) },
        { name: `${t} rental_provider`, sql: N(t), ...auth(U.rp) },
        { name: `${t} admin aal2`, sql: N(t), ...auth(U.adm) },
        { name: `${t} admin aal1`, sql: N(t), ...auth(U.adm, 'aal1') },
        { name: `${t} anon`, sql: `perform 1 from public.${t}`, as: 'anon' },
        // Schreibsperre: kein INSERT/UPDATE/DELETE für irgendeine API-Rolle (Fable H1), auch nicht service_role
        { name: `${t} service_role select`, sql: N(t), as: 'service_role' },
        { name: `${t} service_role delete`, sql: `delete from public.${t}`, as: 'service_role' },
        { name: `${t} Mitglied delete`, sql: `delete from public.${t}`, ...auth(U.active) },
        { name: `${t} admin delete`, sql: `delete from public.${t}`, ...auth(U.adm) },
      )
    }
    steps.push(
      { name: 'service_role insert Version', sql: "insert into public.fee_schedules (version, valid_from, label) values (99, date '2999-01-01', 'x')", as: 'service_role' },
      { name: 'service_role insert Stufe', sql: 'insert into public.fee_schedule_tiers (version, tier, up_to_cents, rate_bp) values (1, 9, null, 1)', as: 'service_role' },
      { name: 'Mitglied insert Version', sql: "insert into public.fee_schedules (version, valid_from, label) values (99, date '2999-01-01', 'x')", ...auth(U.active) },
      { name: 'Mitglied update Stufe', sql: 'update public.fee_schedule_tiers set rate_bp = 0', ...auth(U.active) },
      { name: 'Eigentümer update Version', sql: "update public.fee_schedules set label = 'x' where version = 1" },
      { name: 'Eigentümer delete Stufe', sql: 'delete from public.fee_schedule_tiers where version = 1' },
      { name: 'Eigentümer truncate', sql: 'truncate public.fee_schedules cascade' },
      { name: 'Eigentümer zweite offene Stufe', sql: 'insert into public.fee_schedule_tiers (version, tier, up_to_cents, rate_bp) values (1, 2, null, 100)' },
      // Version 1 bleibt die 15-%-Staffel, Version 2 die 12/10/7-Staffel
      { name: 'Stufen v1', sql: "=(select string_agg(coalesce(up_to_cents::text, 'offen') || ':' || rate_bp, ',' order by tier) from public.fee_schedule_tiers where version = 1)" },
      { name: 'Stufen v2', sql: "=(select string_agg(coalesce(up_to_cents::text, 'offen') || ':' || rate_bp, ',' order by tier) from public.fee_schedule_tiers where version = 2)" },
      { name: 'Geltende Version', sql: '=private.current_fee_schedule()' },
      // fee_cents: Summe der Stufenanteile, einmal half-up
      ...V2_VEC.map(([base, fee]): Step => ({ name: `fee_cents v2 ${base}`, sql: `?private.fee_cents(2, ${base}) = ${fee}` })),
      ...V1_VEC.map(([base, fee]): Step => ({ name: `fee_cents v1 ${base}`, sql: `?private.fee_cents(1, ${base}) = ${fee}` })),
      // Kreuztest (Fable M3): die bindende SQL-Rechnung und tierFee aus @pricing liefern für Grenzen ±1 und feste Pseudo-Zufallsbeträge dasselbe
      ...CROSS.map((x): Step => ({ name: `Vorschau ${x}`, sql: `=public.payout_preview(${x})`, ...auth(U.active) })),
      { name: 'fee_cents unbekannte Version', sql: 'perform private.fee_cents(99, 100)' },
      { name: 'fee_cents negativ', sql: 'perform private.fee_cents(2, -1)' },
      // Vorschau: nur Firmenmitglieder mit aal2, der Server rechnet
      ...STATUSES.map((s): Step => ({ name: `Vorschau ${s} aal2`, sql: '=public.payout_preview(150000)', ...auth(U[s]) })),
      { name: 'Vorschau Mitglied aal1', sql: 'perform public.payout_preview(150000)', ...auth(U.active, 'aal1') },
      { name: 'Vorschau Kunde', sql: 'perform public.payout_preview(150000)', ...auth(U.cust) },
      { name: 'Vorschau rental_provider', sql: 'perform public.payout_preview(150000)', ...auth(U.rp) },
      { name: 'Vorschau admin ohne Firma', sql: 'perform public.payout_preview(150000)', ...auth(U.adm) },
      { name: 'Vorschau anon', sql: 'perform public.payout_preview(150000)', as: 'anon' },
      { name: 'Vorschau service_role', sql: 'perform public.payout_preview(150000)', as: 'service_role' },
      { name: 'Vorschau negativ', sql: 'perform public.payout_preview(-1)', ...auth(U.active) },
      { name: 'Vorschau null', sql: 'perform public.payout_preview(null)', ...auth(U.active) },
      { name: 'Vorschau 0', sql: '=public.payout_preview(0)', ...auth(U.active) },
    )
    const r = probes(setup, steps)
    for (const t of TABLES) {
      const all = r[`${t} owner`]
      expect(all, `${t} owner`).toMatch(/^= \d+$/) // sonst steht hier die Datenbankmeldung (z. B. „42P01: relation … does not exist“)
      expect(Number(all?.slice(2)), t).toBeGreaterThanOrEqual(2)
      for (const s of STATUSES) {
        expect(r[`${t} ${s} aal2`], `${t} ${s} aal2`).toBe(all)
        expect(r[`${t} ${s} aal1`], `${t} ${s} aal1`).toBe('= 0')
      }
      for (const k of ['Kunde', 'rental_provider', 'admin aal1']) expect(r[`${t} ${k}`], `${t} ${k}`).toBe('= 0')
      expect(r[`${t} admin aal2`], `${t} admin aal2`).toBe(all)
      expect(r[`${t} anon`], `${t} anon`).toBe(NO_TABLE(t))
      expect(r[`${t} service_role select`], `${t} service_role select`).toBe(all)
      // delete: ohne Schreibrecht 42501 (service_role, Mitglied, admin)
      for (const k of ['service_role delete', 'Mitglied delete', 'admin delete']) expect(r[`${t} ${k}`], `${t} ${k}`).toBe(NO_TABLE(t))
    }
    for (const k of ['service_role insert Version', 'Mitglied insert Version']) expect(r[k], k).toBe(NO_TABLE('fee_schedules'))
    for (const k of ['service_role insert Stufe', 'Mitglied update Stufe']) expect(r[k], k).toBe(NO_TABLE('fee_schedule_tiers'))
    // Eigentümer: Unveränderlichkeit und genau eine offene Stufe (Ist-Meldungen im Log der Session)
    for (const k of ['Eigentümer update Version', 'Eigentümer delete Stufe', 'Eigentümer truncate']) expect(r[k], k).toMatch(/^P0001: /)
    expect(r['Eigentümer zweite offene Stufe']).toMatch(/^23505: /)
    expect(r['Stufen v1']).toBe('= offen:1500')
    expect(r['Stufen v2']).toBe('= 50000:1200,100000:1000,offen:700')
    expect(r['Geltende Version']).toBe('= 2')
    for (const [base] of V2_VEC) expect(r[`fee_cents v2 ${base}`], `v2 ${base}`).toBe('ok')
    for (const [base] of V1_VEC) expect(r[`fee_cents v1 ${base}`], `v1 ${base}`).toBe('ok')
    const tiers = currentFee().tiers
    for (const x of CROSS) expect(r[`Vorschau ${x}`], `Vorschau ${x}`).toBe(`= ${x - tierFee(x, tiers)}`)
    expect(r['fee_cents unbekannte Version']).toBe('P0001: setting_missing')
    expect(r['fee_cents negativ']).toBe('P0001: amount_mismatch')
    for (const s of STATUSES) expect(r[`Vorschau ${s} aal2`], `Vorschau ${s}`).toBe('= 135500')
    expect(r['Vorschau Mitglied aal1']).toBe('P0001: mfa_required')
    for (const k of ['Vorschau Kunde', 'Vorschau rental_provider', 'Vorschau admin ohne Firma']) expect(r[k], k).toBe('P0001: not_found')
    for (const k of ['Vorschau anon', 'Vorschau service_role']) expect(r[k], k).toMatch(/^42501: permission denied for function payout_preview/)
    for (const k of ['Vorschau negativ', 'Vorschau null']) expect(r[k], k).toBe('P0001: invalid_input')
    expect(r['Vorschau 0']).toBe('= 0')
  }, 180_000)
})
