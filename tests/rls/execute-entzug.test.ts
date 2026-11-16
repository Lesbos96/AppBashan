// n15 (Migration 0066, OFFEN N15/s9k1-3): zwölf Funktionen mit auth.uid()-Logik haben kein EXECUTE mehr für service_role.
// Der Aufruf scheitert vor dem Rumpf mit 42501; Eigentümer und authenticated laufen weiter (Letzteres belegen die Register-Proben in positiv.test.ts).
// Rollback-Proben, es bleibt nichts zurück.
import { describe, expect, it } from 'vitest'
import { probes, type Step } from '../support/owner.ts'

const ID = "'00000000-0000-0000-0000-000000000001'"
const CALLS = [
  `public.decline_listing(${ID})`, `public.withdraw(${ID})`, 'public.my_jobs()', `public.my_report_info(${ID})`, `public.my_job_partner(${ID})`,
  `public.job_contact(${ID})`, `public.start_job(${ID})`, `public.report_not_done(${ID})`, `public.complete_job(${ID})`, 'public.my_job_changes()',
  `public.my_cancel_info(${ID})`, 'public.my_commissions()',
]
const asService = (c: string): Step => ({ name: `service_role ${c}`, as: 'service_role', sql: `perform * from ${c}` })
const asOwner = (c: string): Step => ({ name: `Eigentümer ${c}`, sql: `perform * from ${c}` })

describe('EXECUTE-Entzug für service_role (N15, s9k1-3)', () => {
  it('service_role: 42501 bei allen zwölf; der Eigentümer erreicht den Rumpf (Geschäftsfehler, nie 42501)', () => {
    const r = probes('', [...CALLS.map(asService), ...CALLS.map(asOwner)])
    for (const c of CALLS) {
      expect(r[`service_role ${c}`]?.startsWith('42501'), `service_role ${c}: ${r[`service_role ${c}`]}`).toBe(true)
      expect(r[`Eigentümer ${c}`]?.startsWith('42501'), `Eigentümer ${c}: ${r[`Eigentümer ${c}`]}`).toBe(false)
    }
  })
})
