import type { Page, TestInfo } from '@playwright/test'
import { price } from '../e2e/anfrage-helpers'
import { mockAuth, signInWithCode } from '../e2e/auth-helpers'
import { expect, mockRpc, reply, test, type RpcReturn } from '../e2e/backend'

/*
 * Bildsicht für die Meldung „nicht stattgefunden“ und das Zurückziehen beim Kunden (s9k-1): Frage nach dem Abschluss der Firma,
 * gemeldet (Prüfung), Frage nach dem Terminbeginn, Zurückziehen-Sheet. Aufnahme je Shot-Projekt nach tmp/shots/<projekt>/kunde-meldung-<name>.png;
 * in den 390-Projekten zusätzlich bei 320 px. Platzhalterdaten aus den Mocks.
 */

const ID = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const row = (over: object) => ({
  id: ID,
  service: 'move',
  status: 'accepted',
  preferred_date: '2026-12-15',
  termin_at: '2026-01-01T07:00:00Z',
  time_window: 'morning',
  not_done_reported_at: null,
  not_done_resolved_at: null,
  cancel_fee_waived: false,
  from_address: 'Neubaugasse 12, 1070 Wien',
  to_address: 'Praterstraße 30, 1020 Wien',
  created_at: '2026-11-05T10:00:00Z',
  price_revisions: { snapshot: price(68961) },
  ...over,
})

type Shot = { name: string; row: object; canReport: boolean; region: string | null; open?: string; offers?: RpcReturn<'my_request_offers'> }
// rs1: Kunde mit zwei Festangeboten, „Alle Angebote ablehnen“ (Knopf und Sheet)
const OFFERS: RpcReturn<'my_request_offers'> = [
  { offer_id: '2d0a3e5f-7f4c-4a9d-9c83-5e6f7a8b9c0d', amount_cents: 72345, valid_until: '2099-12-01T10:00:00Z', status: 'sent', company_name: 'Muster Transporte' },
  { offer_id: '1c9f2d4e-6e3b-4f8c-8b72-4d5e6f7a8b9c', amount_cents: 72000, valid_until: '2099-12-02T10:00:00Z', status: 'sent', company_name: 'Zweite Firma' },
]
const shots: Shot[] = [
  { name: 'angebote', row: row({ status: 'offered', termin_at: '2099-12-15T07:00:00Z' }), canReport: false, region: null, offers: OFFERS },
  { name: 'angebote-ablehnen-sheet', row: row({ status: 'offered', termin_at: '2099-12-15T07:00:00Z' }), canReport: false, region: null, offers: OFFERS, open: 'Alle Angebote ablehnen' },
  { name: 'abgeschlossen-frage', row: row({ status: 'completed' }), canReport: true, region: 'Hat der Auftrag stattgefunden?' },
  { name: 'termin-frage', row: row({ status: 'in_progress' }), canReport: true, region: 'Hat der Auftrag stattgefunden?' },
  { name: 'gemeldet-pruefung', row: row({ status: 'in_progress', not_done_reported_at: '2026-01-02T08:00:00Z' }), canReport: false, region: null },
  { name: 'zurueckziehen-ruhe', row: row({ status: 'awaiting_offer', termin_at: '2099-12-15T07:00:00Z' }), canReport: false, region: null },
  { name: 'zurueckziehen-sheet', row: row({ status: 'awaiting_offer', termin_at: '2099-12-15T07:00:00Z' }), canReport: false, region: null, open: 'Anfrage zurückziehen' },
]

async function take(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `tmp/shots/${testInfo.project.name}/kunde-meldung-${name}.png`, fullPage: true })
}

for (const width of [0, 320]) {
  for (const s of shots) {
    test(`Kunde Meldung ${width ? `${width} px ` : ''}${s.name}`, async ({ page }, testInfo) => {
      test.skip(width === 320 && !testInfo.project.name.startsWith('shots-390'), 'die 320-px-Aufnahmen entstehen einmal je Farbschema')
      if (width) await page.setViewportSize({ width, height: 640 })
      await page.route('**/rest/v1/service_requests**', (r) => {
        const single = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
        return reply(r, single ? s.row : [s.row])
      })
      await mockRpc(page, 'my_report_info', [{ can_report: s.canReport, report_until: s.canReport ? '2026-01-08T07:00:00Z' : null }])
      await mockRpc(page, 'my_request_offers', s.offers ?? [])
      await mockAuth(page)
      await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
      await page.goto(`/anmelden?next=${encodeURIComponent(`/auftraege/${ID}`)}`)
      await signInWithCode(page)
      if (s.region) await expect(page.getByRole('region', { name: s.region })).toBeVisible()
      else await expect(page.getByRole('heading', { name: 'Auftrag', level: 1 })).toBeVisible()
      if (s.open) {
        await page.getByRole('button', { name: s.open }).click()
        await expect(page.getByRole('dialog', { name: s.open })).toBeVisible()
      }
      if (s.name === 'gemeldet-pruefung') await expect(page.getByRole('status').filter({ hasText: 'Wir prüfen ihn' })).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message: 'keine Überbreite' }).toBe(true)
      await take(page, testInfo, `${width ? `${width}-` : ''}${s.name}`)
    })
  }
}
