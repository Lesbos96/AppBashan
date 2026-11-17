import type { TestInfo } from '@playwright/test'
import { price } from '../e2e/anfrage-helpers'
import { mockAuth, signInWithCode } from '../e2e/auth-helpers'
import { expect, mockRpc, reply, test } from '../e2e/backend'

/*
 * Bildsicht für das feste Ankunftsfenster beim Kunden (web1): Bestätigung nach dem Senden und Auftragsdetail.
 * Termin 15. Dezember 2099, 08:00 Uhr Wiener Zeit, Fenster bis 8:30. Aufnahme nach tmp/shots/<projekt>/kunde-ankunft-<name>.png.
 * Die Firmenkarte zeigt dieselbe Zeile in `partner.spec.ts` (auftraege-liste).
 */

const ID = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const TERMIN = '2099-12-15T07:00:00Z'
const TEXT = /Ankunft zwischen 8:00 und 8:30\sUhr/
const row = {
  id: ID,
  service: 'move',
  status: 'accepted',
  preferred_date: '2099-12-15',
  termin_at: TERMIN,
  time_window: 'morning',
  not_done_reported_at: null,
  not_done_resolved_at: null,
  cancel_fee_waived: false,
  from_address: 'Neubaugasse 12, 1070 Wien',
  to_address: 'Praterstraße 30, 1020 Wien',
  price_revisions: { snapshot: price(68961) },
}

const take = async (page: import('@playwright/test').Page, testInfo: TestInfo, name: string) => {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `tmp/shots/${testInfo.project.name}/kunde-ankunft-${name}.png`, fullPage: true })
}

test('Kunde Ankunft Auftragsdetail', async ({ page }, testInfo) => {
  await page.route('**/rest/v1/service_requests**', (r) => reply(r, (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object') ? row : [row]))
  await mockRpc(page, 'my_report_info', [{ can_report: false, report_until: null }])
  await mockRpc(page, 'my_request_offers', [])
  await mockAuth(page)
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  await page.goto(`/anmelden?next=${encodeURIComponent(`/auftraege/${ID}`)}`)
  await signInWithCode(page)
  await expect(page.getByText(TEXT)).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await take(page, testInfo, 'detail')
})

test('Kunde Ankunft Bestätigung', async ({ page }, testInfo) => {
  await page.route('**/rest/v1/service_requests**', (r) => reply(r, (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object') ? { termin_at: TERMIN } : [{ termin_at: TERMIN }]))
  await mockAuth(page)
  await page.goto('/')
  await page.evaluate(([id, snapshot]) => sessionStorage.setItem('movenow.sent', JSON.stringify({ path: 'umzug', id, status: 'requested', needsQuote: false, snapshot, shown: null, date: '2099-12-15', route: 'Neubaugasse 12 → Praterstraße 30' })), [ID, price(68961)])
  await page.goto('/umzug/gesendet')
  await expect(page.getByText(TEXT)).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await take(page, testInfo, 'bestaetigung')
})
