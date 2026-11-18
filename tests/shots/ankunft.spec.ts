import type { TestInfo } from '@playwright/test'
import { price } from '../e2e/anfrage-helpers'
import { mockAuth, signInWithCode } from '../e2e/auth-helpers'
import { expect, mockRpc, reply, test } from '../e2e/backend'

/*
 * Bildsicht für das Ankunftsfenster (ui2): gewähltes Zeitfenster im Auftragsdetail (Fenster „Vormittag“ und „Flexibel“); die Bestätigung nach dem Senden zeigt keins.
 * Aufnahme nach tmp/shots/<projekt>/kunde-ankunft-<name>.png.
 */

const ID = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const TERMIN = '2099-12-15T07:00:00Z'
const TEXT = /Ankunft zwischen 8 und 11\sUhr/
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

// „Unterwegs“ (mail1): die Zeit des Servers, Dezember = Wiener Zeit UTC+1, also 07:40 Uhr UTC = 8:40 Uhr
for (const [name, time_window, text, en_route_eta] of [['detail', 'morning', TEXT, null], ['flexibel', 'flexible', /Die Firma nennt dir die genaue Uhrzeit\./, null], ['unterwegs', 'morning', /Die Firma ist unterwegs, Ankunft ca\.\s8:40\sUhr/, '2099-12-15T07:40:00Z']] as const) {
test(`Kunde Ankunft Auftragsdetail ${name}`, async ({ page }, testInfo) => {
  const data = { ...row, time_window, en_route_eta }
  await page.route('**/rest/v1/service_requests**', (r) => reply(r, (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object') ? data : [data]))
  await mockRpc(page, 'my_report_info', [{ can_report: false, report_until: null }])
  await mockRpc(page, 'my_request_offers', [])
  await mockAuth(page)
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  await page.goto(`/anmelden?next=${encodeURIComponent(`/auftraege/${ID}`)}`)
  await signInWithCode(page)
  await expect(page.getByText(text)).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await take(page, testInfo, name)
})
}

test('Kunde Bestätigung ohne Ankunftsfenster', async ({ page }, testInfo) => {
  await mockAuth(page)
  await page.goto('/')
  await page.evaluate(([id, snapshot]) => sessionStorage.setItem('movenow.sent', JSON.stringify({ path: 'umzug', id, status: 'requested', needsQuote: false, snapshot, shown: null, date: '2099-12-15', route: 'Neubaugasse 12 → Praterstraße 30' })), [ID, price(68961)])
  await page.goto('/umzug/gesendet')
  await expect(page.getByRole('heading').first()).toBeVisible()
  await expect(page.getByText(/Ankunft/)).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await take(page, testInfo, 'bestaetigung')
})
