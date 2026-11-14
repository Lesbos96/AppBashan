import type { Page } from '@playwright/test'
import { price } from './anfrage-helpers'
import { mockAuth, signInWithCode } from './auth-helpers'
import { expect, mockRpc, reply, test, type RpcReturn } from './backend'
import { collectErrors } from './console'

/*
 * Absage der Firma aus Sicht des Kunden (s9i-7b2). Antworten aus Mocks: `my_cancel_info` (Pauschale in Cent) und die Folgeanfrage über `reissued_from`.
 * Der Test prüft, dass die App genau den Betrag des Servers zeigt, nie die Gebühr, und je Fall den richtigen Weg anbietet.
 * Was der Server liefert (nur der Kunde, nur bei Firmen-Absage, Summe mit Gegenbuchungen), belegt tests/rls/cancellation-partner-preview.test.ts.
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

type State = { fee: number | null; next: { id: string; status: string } | null; info: Record<string, unknown>[]; urls: string[] }

async function open(page: Page, init: Partial<State>) {
  const state: State = { fee: 0, next: null, info: [], urls: [], ...init }
  await page.route('**/rest/v1/service_requests**', (r) => {
    const url = r.request().url()
    state.urls.push(url)
    const single = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
    if (url.includes('reissued_from=eq.')) return reply(r, single ? state.next : state.next ? [state.next] : [])
    return reply(r, single ? row : [row])
  })
  await mockRpc(page, 'my_cancel_info', (args) => {
    state.info.push(args)
    // null liefert der Server nie; ein Test prüft absichtlich, wie die App einen unlesbaren Betrag zeigt
    return state.fee as RpcReturn<'my_cancel_info'>
  })
  await mockAuth(page)
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  await page.goto(`/anmelden?next=${encodeURIComponent(`/auftraege/${ID}`)}`)
  await signInWithCode(page)
  await expect(page).toHaveURL(new RegExp(`/auftraege/${ID}$`))
  return state
}

const noFee = (page: Page) => expect(page.locator('body')).not.toContainText(/Gebühr|Plattform|Provision|15 ?%|10,35|58,65/)
const absage = (page: Page) => page.getByRole('region', { name: 'Absage der Firma' })

test('mit Pauschale: Betrag des Servers, außerhalb der App in Rechnung, keine Weitervermittlung, nie die Gebühr', async ({ page }) => {
  const errors = collectErrors(page)
  const state = await open(page, { fee: 6900 })
  await expect(page.getByText('Die Firma hat den Auftrag abgesagt.')).toBeVisible()
  await expect(absage(page)).toContainText('Die Firma macht eine Pauschale von 69,00 € geltend.')
  await expect(absage(page)).toContainText('außerhalb der App in Rechnung')
  await expect(absage(page)).toContainText('Wir vermitteln diese Anfrage nicht weiter')
  await expect(absage(page)).not.toContainText('Dir entstehen keine Kosten')
  const money = absage(page).getByText('69,00 €')
  expect(await money.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap')
  await expect(absage(page).getByRole('link', { name: 'Neue Anfrage' })).toHaveAttribute('href', '/')
  expect(state.info.length).toBeGreaterThan(0)
  expect(state.info.every((b) => b.p_request === ID && Object.keys(b).length === 1)).toBe(true)
  await noFee(page)
  expect(errors).toEqual([])
})

test('ohne Pauschale, Folgeanfrage läuft: weitervermittelt, Link zur neuen Anfrage', async ({ page }) => {
  const state = await open(page, { fee: 0, next: { id: NEXT, status: 'requested' } })
  await expect(absage(page)).toContainText('Dir entstehen keine Kosten. Wir haben deine Anfrage an andere Firmen weitergegeben.')
  await expect(absage(page).getByRole('link', { name: 'Zur neuen Anfrage' })).toHaveAttribute('href', `/auftraege/${NEXT}`)
  const q = state.urls.find((u) => u.includes('reissued_from=eq.'))
  expect(q).toContain(`reissued_from=eq.${ID}`)
  expect(q).toContain('customer_id=eq.')
  await noFee(page)
})

test('ohne Pauschale, Folgeanfrage ohne Treffer (unmatched): keine andere Firma, neue Anfrage', async ({ page }) => {
  await open(page, { fee: 0, next: { id: NEXT, status: 'unmatched' } })
  await expect(absage(page)).toContainText('Wir haben leider keine andere Firma gefunden')
  await expect(absage(page)).not.toContainText('an andere Firmen weitergegeben')
  await expect(absage(page).getByRole('link', { name: 'Neue Anfrage' })).toHaveAttribute('href', '/')
  await noFee(page)
})

test('ohne Pauschale, keine Folgeanfrage: nur „Dir entstehen keine Kosten“ und neue Anfrage, kein Satz über andere Firmen', async ({ page }) => {
  await open(page, { fee: 0, next: null })
  await expect(absage(page)).toContainText('Dir entstehen keine Kosten. Du kannst jederzeit eine neue Anfrage stellen.')
  await expect(absage(page)).not.toContainText('andere Firma')
  await expect(absage(page).getByRole('link', { name: 'Neue Anfrage' })).toBeVisible()
  await noFee(page)
})

test('Betrag nicht lesbar: Fehler mit „Erneut versuchen“, nie „keine Kosten“', async ({ page }) => {
  await open(page, { fee: null })
  await expect(page.getByText('Die Einzelheiten zur Absage konnten nicht geladen werden')).toBeVisible()
  await expect(page.getByText('Dir entstehen keine Kosten')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible()
})
