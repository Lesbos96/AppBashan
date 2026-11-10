import type { Page } from '@playwright/test'
import { price } from './anfrage-helpers'
import { mockAuth, signInWithCode } from './auth-helpers'
import { cors, expect, reply, test } from './backend'
import { collectErrors } from './console'

/*
 * Aufträge-Detail und Storno des Kunden (s9i-2). Alle Antworten kommen aus Mocks; `cancel-customer` rechnet hier nichts,
 * der Test prüft, dass die App genau den Betrag des Servers zeigt und sendet.
 */

const ID = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const row = (status: string) => ({
  id: ID,
  service: 'move',
  status,
  preferred_date: '2026-12-15',
  termin_at: '2026-12-15T07:00:00Z',
  time_window: 'morning',
  not_done_reported_at: null,
  from_address: 'Neubaugasse 12, 1070 Wien',
  to_address: 'Praterstraße 30, 1020 Wien',
  created_at: '2026-11-05T10:00:00Z',
  price_revisions: { snapshot: price(68961) },
})

type State = { status: string; calls: { body: Record<string, unknown> }[]; answers: { status?: number; json: unknown; delay?: number; abort?: true; cancels?: true }[]; urls?: string[] }

/** Anfragen: Liste und Detail antworten mit dem Status aus `state`; `cancel-customer` mit den vorbereiteten Antworten, nacheinander. */
async function mock(page: Page, state: State) {
  await page.route('**/rest/v1/service_requests**', (r) => {
    state.urls?.push(r.request().url())
    const single = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
    return reply(r, single ? row(state.status) : [row(state.status)])
  })
  await page.route('**/functions/v1/cancel-customer', async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    const body = r.request().postDataJSON() as Record<string, unknown>
    state.calls.push({ body })
    const a = state.answers.shift() ?? { status: 500, json: { error: 'internal' } }
    if (a.delay) await new Promise((res) => setTimeout(res, a.delay))
    if (a.cancels || ((a.status === undefined || a.status === 200) && body.preview === undefined)) state.status = 'cancelled_by_customer'
    if (a.abort) return r.abort('failed')
    return r.fulfill({ status: a.status ?? 200, headers: cors, json: a.json })
  })
}

async function open(page: Page) {
  await mockAuth(page)
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  await page.goto('/anmelden?next=%2Fauftraege')
  await signInWithCode(page)
  await expect(page).toHaveURL(/\/auftraege$/)
  await page.getByRole('link', { name: /Umzug/ }).click()
  await expect(page).toHaveURL(new RegExp(`/auftraege/${ID}$`))
  await expect(page.locator('main')).toHaveCount(1)
}

const CONFIRM = /^(Kostenlos|Für .+) stornieren$/
const noFee = (page: Page) => expect(page.locator('body')).not.toContainText(/Plattform|Provision|15 ?%|MoveNow-Gebühr/)

test('Detail: Status, Verlauf, Termin, Adressen und Preis', async ({ page }) => {
  const errors = collectErrors(page)
  await mock(page, { status: 'accepted', calls: [], answers: [] })
  await open(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Auftrag' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'Umzug' })).toBeVisible()
  await expect(page.getByText('Bestätigt', { exact: true }).first()).toBeVisible()
  const steps = page.getByRole('list', { name: 'Verlauf' }).getByRole('listitem')
  await expect(steps).toHaveText([/Angefragt/, /Bestätigt/, /Läuft/, /Erledigt/])
  await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step')
  await expect(page.getByText('Neubaugasse 12, 1070 Wien')).toBeVisible()
  await expect(page.getByText('Praterstraße 30, 1020 Wien')).toBeVisible()
  const money = page.getByText(/689,61.€/)
  await expect(money.first()).toBeVisible()
  expect((await money.first().evaluate((el) => getComputedStyle(el).whiteSpace))).toBe('nowrap')
  await noFee(page)
  expect(errors).toEqual([])
})

test('Storno kostenlos: Vorschau, Bestätigung per Tastatur, Detail zeigt danach den Endzustand', async ({ page }) => {
  const errors = collectErrors(page)
  const state: State = { status: 'accepted', calls: [], answers: [{ json: { cancelFeeCents: 0 } }, { json: { status: 'cancelled_by_customer', cancelFeeCents: 0 } }] }
  await mock(page, state)
  await open(page)
  await page.getByRole('button', { name: 'Stornieren' }).focus()
  await page.keyboard.press('Enter')
  const sheet = page.getByRole('dialog', { name: 'Auftrag stornieren' })
  await expect(sheet.getByText('Kostenlos', { exact: true })).toBeVisible()
  await noFee(page)
  const confirm = sheet.getByRole('button', { name: CONFIRM })
  expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await confirm.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Du hast den Auftrag storniert.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stornieren' })).toHaveCount(0)
  expect(state.calls.map((c) => c.body)).toEqual([{ requestId: ID, preview: true }, { requestId: ID, shownFeeCents: 0 }])
  expect(errors).toEqual([])
})

test('Storno mit Kosten: der Betrag der Vorschau wird gezeigt und genau so gesendet', async ({ page }) => {
  const state: State = { status: 'accepted', calls: [], answers: [{ json: { cancelFeeCents: 34481 } }, { json: { status: 'cancelled_by_customer', cancelFeeCents: 34481 } }] }
  await mock(page, state)
  await open(page)
  await page.getByRole('button', { name: 'Stornieren' }).click()
  const sheet = page.getByRole('dialog', { name: 'Auftrag stornieren' })
  const money = sheet.getByText(/^344,81.€$/)
  await expect(money).toBeVisible()
  expect(await money.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap')
  await noFee(page)
  await sheet.getByRole('button', { name: CONFIRM }).click()
  await expect(page.getByText('Du hast den Auftrag storniert.')).toBeVisible()
  expect(state.calls[1]!.body).toEqual({ requestId: ID, shownFeeCents: 34481 })
})

test('Stufe wechselt zwischen Vorschau und Bestätigung: neuer Betrag, nichts wird still gebucht', async ({ page }) => {
  const state: State = {
    status: 'accepted',
    calls: [],
    answers: [{ json: { cancelFeeCents: 0 } }, { status: 409, json: { error: 'cancel_fee_changed', cancelFeeCents: 34481 } }, { json: { status: 'cancelled_by_customer', cancelFeeCents: 34481 } }],
  }
  await mock(page, state)
  await open(page)
  await page.getByRole('button', { name: 'Stornieren' }).click()
  const sheet = page.getByRole('dialog', { name: 'Auftrag stornieren' })
  await sheet.getByRole('button', { name: CONFIRM }).click()
  await expect(sheet.getByText(/^344,81.€$/)).toBeVisible()
  await expect(sheet.getByText('Die Stornokosten haben sich geändert.')).toBeVisible()
  expect(state.status).toBe('accepted')
  await sheet.getByRole('button', { name: CONFIRM }).click()
  await expect(page.getByText('Du hast den Auftrag storniert.')).toBeVisible()
  expect(state.calls.map((c) => c.body.shownFeeCents)).toEqual([undefined, 0, 34481])
})

test('zu spät: Hinweis auf „Nicht stattgefunden“, Auftrag bleibt', async ({ page }) => {
  const state: State = { status: 'accepted', calls: [], answers: [{ status: 409, json: { error: 'too_late_use_report_not_done' } }] }
  await mock(page, state)
  await open(page)
  await page.getByRole('button', { name: 'Stornieren' }).click()
  await expect(page.getByRole('dialog', { name: 'Auftrag stornieren' }).getByRole('alert')).toContainText('Der Termin hat schon begonnen')
  await expect(page.getByRole('button', { name: CONFIRM })).toHaveCount(0)
  expect(state.status).toBe('accepted')
})

test('Netzfehler bei der Vorschau: Fehlertext, erneut versuchen möglich', async ({ page }) => {
  await mock(page, { status: 'accepted', calls: [], answers: [{ status: 500, json: { error: 'internal' } }, { json: { cancelFeeCents: 0 } }] })
  await open(page)
  await page.getByRole('button', { name: 'Stornieren' }).click()
  const sheet = page.getByRole('dialog', { name: 'Auftrag stornieren' })
  await expect(sheet.getByRole('alert')).toBeVisible()
  await sheet.getByRole('button', { name: 'Erneut versuchen' }).click()
  await expect(sheet.getByText('Kostenlos', { exact: true })).toBeVisible()
})

test('Storno nur bei „Bestätigt“: andere Status haben keinen Knopf', async ({ page }) => {
  await mock(page, { status: 'requested', calls: [], answers: [] })
  await open(page)
  await expect(page.getByRole('list', { name: 'Verlauf' }).getByRole('listitem').first()).toHaveAttribute('aria-current', 'step')
  await expect(page.getByRole('button', { name: 'Stornieren' })).toHaveCount(0)
})

for (const width of [390, 430, 1280]) {
  test(`Maße bei ${width} px: kein waagerechtes Scrollen, Storno-Knopf mindestens 44 px hoch`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mock(page, { status: 'accepted', calls: [], answers: [] })
    await open(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect((await page.getByRole('button', { name: 'Stornieren' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  })
}

test('Abfrage des Details: eigene Nutzer-ID und feste Spaltenliste', async ({ page }) => {
  const state: State = { status: 'accepted', calls: [], answers: [], urls: [] }
  await mock(page, state)
  await open(page)
  const detail = decodeURIComponent(state.urls!.find((u) => /[?&]id=eq\./.test(u))!)
  expect(detail).toContain(`id=eq.${ID}`)
  expect(detail).toContain('customer_id=eq.u-1')
  expect(detail).not.toContain('select=*')
  expect(detail).not.toMatch(/fee|commission|inputs/i)
})

test('Beschriftung nennt den Betrag und wechselt mit ihm', async ({ page }) => {
  const state: State = { status: 'accepted', calls: [], answers: [{ json: { cancelFeeCents: 0 } }, { status: 409, json: { error: 'cancel_fee_changed', cancelFeeCents: 34481 } }] }
  await mock(page, state)
  await open(page)
  await page.getByRole('button', { name: 'Stornieren' }).click()
  const sheet = page.getByRole('dialog', { name: 'Auftrag stornieren' })
  await expect(sheet.getByRole('button', { name: 'Kostenlos stornieren' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Kostenlos stornieren' }).click()
  await expect(sheet.getByRole('button', { name: /^Für 344,81.€ stornieren$/ })).toBeVisible()
  await expect(sheet.getByRole('alert')).toContainText('Die Stornokosten haben sich geändert')
})

test('Während die Buchung läuft, schließt nichts das Sheet', async ({ page }) => {
  const state: State = { status: 'accepted', calls: [], answers: [{ json: { cancelFeeCents: 0 } }, { delay: 1500, json: { status: 'cancelled_by_customer', cancelFeeCents: 0 } }] }
  await mock(page, state)
  await open(page)
  await page.getByRole('button', { name: 'Stornieren' }).click()
  const sheet = page.getByRole('dialog', { name: 'Auftrag stornieren' })
  await sheet.getByRole('button', { name: CONFIRM }).click()
  await expect(sheet.getByRole('button', { name: 'Doch nicht' })).toBeDisabled()
  await expect(sheet.getByRole('button', { name: 'Schließen', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeVisible()
  await expect(page.getByText('Du hast den Auftrag storniert.')).toBeVisible()
})

test('Antwort verloren, Server hat gebucht: zweiter Versuch gleicht das Detail an', async ({ page }) => {
  const state: State = {
    status: 'accepted',
    calls: [],
    answers: [{ json: { cancelFeeCents: 0 } }, { abort: true, cancels: true, json: {} }, { status: 409, json: { error: 'invalid_transition' } }],
  }
  await mock(page, state)
  await open(page)
  await page.getByRole('button', { name: 'Stornieren' }).click()
  const sheet = page.getByRole('dialog', { name: 'Auftrag stornieren' })
  await sheet.getByRole('button', { name: CONFIRM }).click()
  await expect(sheet.getByRole('alert')).toContainText('Keine Verbindung')
  await sheet.getByRole('button', { name: CONFIRM }).click()
  await expect(page.getByText('Du hast den Auftrag storniert.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Stornieren' })).toHaveCount(0)
})
