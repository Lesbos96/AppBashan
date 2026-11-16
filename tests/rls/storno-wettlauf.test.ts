// sys1 (n12b-2, Entscheidung Nr. 190): Wettlauf beim Storno ohne Gebühr, echte parallele Verbindungen auf committeten Fixtures.
// Je Anfrage rufen zwei Verbindungen zum selben Zeitpunkt dieselbe Stornofunktion auf (Kunde: cancel_by_customer, Firma: cancel_by_partner). Die Sperre der Anfrage
// (`for update`, bei der Firma in private.change_gate) sorgt dafür, dass genau eine gewinnt und der Verlierer scheitert, bevor er etwas bucht: ein Audit-Eintrag.
// Ohne Gebühr gibt es keinen Unique-Index, der einen zweiten Erfolg stoppt (commission_one_cancellation_fee greift nur bei Gebühr); guard_request_status lässt den
// gleichen Status durch: ohne Sperre gewinnen beide.
// Negativkontrolle (Rot-Beweis): MV_WETTLAUF_OHNE_SPERRE=1 lässt dieselbe Datei gegen eine Kopie der Funktionen ohne Sperre laufen (tests/support/race-copy.ts,
// Schema race_ctl); Erwartung dort wie sonst, also rot mit zwei Erfolgen und zwei Audit-Einträgen im Log. Der Normallauf prüft nur die echten Funktionen.
// Rest nach dem Lauf: Journal ist unlöschbar; Kunde, Aufträge und die beteiligte Firma (gesperrt) bleiben (OPEN_ISSUES S9c-7).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { splitFee } from '@pricing'
import { ownerSql, ownerSqlAsync } from '../support/owner.ts'
import { currentFee } from '../support/fee.ts'
import { firm, grantAdmin, insertUsers, newId } from '../support/partner.ts'
import { KOPIE, entferneKopien, legeKopienAn } from '../support/race-copy.ts'
import { sweepTestResidue } from '../support/sweep.ts'

const OHNE_SPERRE = process.env.MV_WETTLAUF_OHNE_SPERRE === '1'
const adm = newId()
const cust = newId()
const pa = newId()
const [KUNDE, FIRMA] = [newId(), newId()]
const TOTAL = 68961

const startAt = (secs: number) => `select pg_sleep(greatest(0, extract(epoch from (timestamptz '${new Date(Date.now() + secs * 1000).toISOString()}' - clock_timestamp()))));`

beforeAll(() => (OHNE_SPERRE ? legeKopienAn() : entferneKopien()))
afterAll(() => {
  entferneKopien()
  sweepTestResidue(adm, true) // admin hat Audit-Einträge und bleibt meist stehen
})

describe('Wettlauf beim Storno (ohne Gebühr)', () => {
  it(`doppelter Storno = ein Erfolg, ein Audit-Eintrag (Ziel: ${OHNE_SPERRE ? 'Kopie ohne Sperre' : 'echte Funktionen'})`, async () => {
    ownerSql(`begin; ${insertUsers([adm])} ${grantAdmin(adm)} commit;`)
    sweepTestResidue(adm)
    const f = currentFee()
    const s0 = splitFee(TOTAL, { tiers: f.tiers, vatRate: f.vr })
    const terms = `"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":6900,"termsHash":"x"}`
    const rev = (id: string) => `(select id from public.price_revisions where request_id = '${id}' and n = 1)`
    // Bezirk 21: keine committete Abdeckungsfirma, eine Weitervermittlung bleibt unvermittelt
    const job = (id: string) => `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
      values ('${id}', '${cust}', gen_random_uuid(), 'move', 'requested', 21, now() + interval '5 days', now() + interval '1 day');
      insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
      values ('${id}', 1, 'submit', '{}', '{"kind":"price","totalCents":${TOTAL},"lowCents":${TOTAL},"highCents":${TOTAL},"lines":[],${terms}}', 1, ${TOTAL}, ${TOTAL}, ${TOTAL});
      update public.service_requests set current_revision = ${rev(id)} where id = '${id}';
      select public.distribute_request('${id}');
      select public.partner_accept('${pa}', (select id from public.job_listings where request_id = '${id}' and partner_id = current_setting('app.p_a')::uuid), ${rev(id)},
        ${s0.payoutCents}, ${f.vr}, ${s0.feeCents}, ${s0.feeNetCents}, ${s0.feeVatCents}, ${s0.payoutCents}, ${f.fsv}, ${f.vrv});`
    ownerSql(`begin; ${insertUsers([cust, pa])} ${firm(pa, 'a', 'active', adm, { districts: 'array[21]::smallint[]' })} ${job(KUNDE)} ${job(FIRMA)} commit;`)

    const kunde = OHNE_SPERRE ? KOPIE.kunde : 'public.cancel_by_customer'
    const firmaFn = OHNE_SPERRE ? KOPIE.firma : 'public.cancel_by_partner'
    const noFee = '0, 0, 0, 0' // fee, fee_net, fee_vat, payout
    const customerCancel = `select ${kunde}('${cust}', '${KUNDE}', 0, ${f.vr}, ${noFee}, ${f.fsv}, ${f.vrv})`
    const partnerCancel = `select ${firmaFn}('${pa}', 'aal2', '${FIRMA}', 'unavailable', null, 0, ${f.vr}, ${noFee}, ${f.fsv}, ${f.vrv})`
    // als Eigentümer (die Funktionen prüfen ihren Akteur selbst); beide Seiten gleich, damit Kopie und Original vergleichbar sind
    const race = (sql: string) => ownerSqlAsync(`begin; ${startAt(9)} ${sql}; commit;`)
    const runs = await Promise.all([race(customerCancel), race(customerCancel), race(partnerCancel), race(partnerCancel)])
    const won = (r: (typeof runs)[number]) => 'rows' in r
    const lost = (r: (typeof runs)[number]) => ('error' in r ? r.error : '')
    const q = (sql: string) => String(Object.values(ownerSql(sql)[0] ?? {})[0])
    const audits = (id: string, action: string) => Number(q(`select count(*) from public.audit_log where entity_id = '${id}' and action = '${action}'`))
    const ist = {
      ziel: OHNE_SPERRE ? 'Kopie ohne Sperre' : 'echte Funktionen',
      kundeErfolge: runs.slice(0, 2).filter(won).length,
      kundeAudit: audits(KUNDE, 'cancel_by_customer'),
      firmaErfolge: runs.slice(2).filter(won).length,
      firmaAudit: audits(FIRMA, 'cancel_by_partner'),
    }
    console.log(`Wettlauf Ist-Werte: ${JSON.stringify(ist)}`)

    // Kunde gegen Kunde: genau ein Erfolg, der Verlierer scheitert vor jeder Buchung
    expect(ist.kundeErfolge, `Erfolge Kunde: ${JSON.stringify(runs.slice(0, 2))}`).toBe(1)
    expect(ist.kundeAudit, 'Audit-Einträge Kunde').toBe(1)
    expect(lost(runs.slice(0, 2).find((r) => !won(r))!)).toContain('invalid_transition')
    // Firma gegen Firma: nach dem Storno ist die Zuordnung beendet, der Verlierer scheitert mit not_found
    expect(ist.firmaErfolge, `Erfolge Firma: ${JSON.stringify(runs.slice(2))}`).toBe(1)
    expect(ist.firmaAudit, 'Audit-Einträge Firma').toBe(1)
    expect(lost(runs.slice(2).find((r) => !won(r))!)).toContain('not_found')
  }, 240_000)
})
