import type { Page, TestInfo } from '@playwright/test'
import { price } from '../e2e/anfrage-helpers'
import { mockAuth, signInWithCode } from '../e2e/auth-helpers'
import { expect, mockRpc, reply, test } from '../e2e/backend'

/*
 * Bildsicht für die Absage der Firma beim Kunden (s9i-7b2): mit Pauschale, ohne Pauschale mit Folgeanfrage, ohne Folgeanfrage.
 * Aufnahme je Shot-Projekt nach tmp/shots/<projekt>/kunde-absage-<name>.png; in den 390-Projekten zusätzlich bei 320 px. Platzhalterdaten aus den Mocks.
 */

const ID = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const NEXT = '5a4d6e7f-0b1c-4d2e-9f0a-9b8c7d6e5f4a'
const row = {
  id: ID,
  service: 'move',
  status: 'cancelled_by_partner',
  preferred_date: '2026-12-15',
  termin_at: '2026-12-15T07:00:00Z',
  time_window: 'morning',
  not_done_reported_at: null,
  cancel_fee_waived: false,
  from_address: 'Neubaugasse 12, 1070 Wien',
  to_address: 'Praterstraße 30, 1020 Wien',
  created_at: '2026-11-05T10:00:00Z',
  price_revisions: { snapshot: price(68961) },
}
const shots = [
  { name: 'mit-pauschale', fee: 6900, next: null },
  { name: 'ohne-pauschale-weitervermittelt', fee: 0, next: { id: NEXT, status: 'requested' } },
  { name: 'ohne-pauschale-keine-folgeanfrage', fee: 0, next: null },
]

async function take(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `tmp/shots/${testInfo.project.name}/kunde-absage-${name}.png`, fullPage: true })
}

for (const width of [0, 320]) {
  for (const s of shots) {
    test(`Kunde Absage ${width ? `${width} px ` : ''}${s.name}`, async ({ page }, testInfo) => {
      test.skip(width === 320 && !testInfo.project.name.startsWith('shots-390'), 'die 320-px-Aufnahmen entstehen einmal je Farbschema')
      if (width) await page.setViewportSize({ width, height: 640 })
      await page.route('**/rest/v1/service_requests**', (r) => {
        const single = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
        if (r.request().url().includes('reissued_from=eq.')) return reply(r, single ? s.next : s.next ? [s.next] : [])
        return reply(r, single ? row : [row])
      })
      await mockRpc(page, 'my_cancel_info', s.fee)
      await mockAuth(page)
      await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
      await page.goto(`/anmelden?next=${encodeURIComponent(`/auftraege/${ID}`)}`)
      await signInWithCode(page)
      await expect(page.getByRole('region', { name: 'Absage der Firma' })).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message: 'keine Überbreite' }).toBe(true)
      await take(page, testInfo, `${width ? `${width}-` : ''}${s.name}`)
    })
  }
}
