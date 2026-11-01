import { expect, test, type Page } from '@playwright/test'
import { CODE, EMAIL, HASH, mockAuth, signInWithCode, type AuthMock } from './auth-helpers'
import { collectErrors } from './console'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
})

const noRawText = (page: Page) => expect(page.locator('body')).not.toContainText('RAW_SUPABASE_TEXT')

test('Code-Weg per Tastatur: Schutz leitet um, Anmeldung führt zurück, Neuladen behält die Sitzung, Abmelden', async ({ page }) => {
  const errors = collectErrors(page)
  const calls = await mockAuth(page)
  await page.route('**/rest/v1/service_requests**', (r) => r.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: [] }))
  await page.goto('/auftraege')
  await expect(page).toHaveURL(/\/anmelden$/) // Rücksprungziel steht nicht mehr in der URL
  await expect(page.getByRole('heading', { name: 'Anmelden', level: 1 })).toBeVisible()
  await expect(page.getByText('Apple')).toHaveCount(0)

  await page.getByLabel('E-Mail').fill(EMAIL)
  await page.keyboard.press('Enter')
  await expect(page.getByLabel('Code')).toBeVisible()
  expect(calls.otp).toBe(1)
  // Einfügen mit Leerzeichen, Bindestrichen und Buchstaben: nur Ziffern bleiben
  await page.getByLabel('Code').fill('1234 56-78 ab')
  await expect(page.getByLabel('Code')).toHaveValue(CODE)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/auftraege$/)
  await expect(page.getByRole('heading', { name: 'Noch keine Aufträge' })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Noch keine Aufträge' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Profil' }).click()
  await expect(page.getByText(EMAIL)).toBeVisible()
  await page.getByRole('button', { name: 'Abmelden' }).press('Enter')
  await expect(page.getByRole('heading', { name: 'Noch kein Konto' })).toBeVisible()
  expect(calls.logout).toBe(1)
  await page.goto('/auftraege')
  await expect(page).toHaveURL(/\/anmelden$/)
  expect(errors).toEqual([])
})

test('Link-Weg: Token verschwindet sofort aus der URL, Prüfung erst nach Tipp, danach E-Mail sichtbar', async ({ page }) => {
  const errors = collectErrors(page)
  const calls = await mockAuth(page)
  await page.goto(`/anmelden#token_hash=${HASH}&type=email`)
  await expect(page).toHaveURL(/\/anmelden$/)
  expect(page.url()).not.toContain(HASH)
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeVisible()
  expect(calls.verify).toBe(0)

  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page.getByText(`angemeldet als ${EMAIL}`)).toBeVisible()
  expect(calls.verify).toBe(1)
  expect(calls.verifyBodies[0]).toContain(HASH)
  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(errors).toEqual([])
})

test('Link bei bestehender Sitzung meldet nicht ohne Tipp in einem anderen Konto an', async ({ page }) => {
  const calls = await mockAuth(page)
  await page.goto('/anmelden')
  await signInWithCode(page)
  expect(calls.verify).toBe(1)
  await page.goto(`/anmelden#token_hash=${HASH}&type=email`)
  await expect(page.getByText(`schon als ${EMAIL} angemeldet`)).toBeVisible()
  expect(calls.verify).toBe(1)
  await page.getByRole('button', { name: 'Abbrechen' }).click()
  expect(calls.verify).toBe(1)
})

test('Rücksprung überlebt einen neuen Tab (Link aus dem Mailprogramm)', async ({ page, context }) => {
  const calls = await mockAuth(page)
  await page.goto('/auftraege')
  await page.getByLabel('E-Mail').fill(EMAIL)
  await page.getByRole('button', { name: 'Code senden' }).click()
  await expect(page.getByLabel('Code')).toBeVisible()
  const tab = await context.newPage()
  await mockAuth(tab)
  await tab.goto(`/anmelden#token_hash=${HASH}&type=email`)
  await tab.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await tab.getByRole('button', { name: 'Weiter' }).click()
  await expect(tab).toHaveURL(/\/auftraege$/)
  expect(calls.otp).toBe(1)
})

for (const target of ['//evil.com', 'https://evil.com', 'javascript:alert(1)', '/\\evil.com']) {
  test(`Offene Weiterleitung verworfen: ${target}`, async ({ page }) => {
    await mockAuth(page)
    await page.goto(`/anmelden?next=${encodeURIComponent(target)}`)
    await signInWithCode(page)
    await expect(page).toHaveURL('http://localhost:5173/')
  })
}

test('Fehler beim Code: eigener Text statt Dienstmeldung, Erneut senden erst nach Countdown', async ({ page }) => {
  const mock: AuthMock = { verify: { status: 403, code: 'otp_expired' } }
  await mockAuth(page, mock)
  await page.goto('/anmelden')
  await page.getByLabel('E-Mail').fill(EMAIL)
  await page.getByRole('button', { name: 'Code senden' }).click()
  await expect(page.getByText(/Erneut senden in \d+ s/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Code erneut senden' })).toHaveCount(0)
  await page.getByLabel('Code').fill('1234567')
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Der Code stimmt nicht oder ist abgelaufen')
  await noRawText(page)
  await page.getByLabel('Code').fill('12345')
  await expect(page.getByRole('button', { name: 'Anmelden', exact: true })).toBeDisabled()
})

const verifyErrors: [string, AuthMock['verify'], string][] = [
  ['zu viele Versuche', { status: 429, code: 'over_request_rate_limit' }, 'Zu viele Versuche'],
  ['offline', 'offline', 'Du bist offline'],
  ['Dienst gestört', { status: 500 }, 'Das hat nicht geklappt'],
]
for (const [name, verify, message] of verifyErrors) {
  test(`Fehler beim Prüfen: ${name}`, async ({ page }) => {
    await mockAuth(page, { verify })
    await page.goto('/anmelden')
    await page.getByLabel('E-Mail').fill(EMAIL)
    await page.getByRole('button', { name: 'Code senden' }).click()
    await page.getByLabel('Code').fill(CODE)
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(message)
    await noRawText(page)
  })
}

test('Fehler beim Anfordern: Adresse, 429, offline', async ({ page }) => {
  await mockAuth(page, { otp: { status: 400, code: 'email_address_invalid' } })
  await page.goto('/anmelden')
  await page.getByLabel('E-Mail').fill('nicht-gut')
  await page.getByRole('button', { name: 'Code senden' }).click()
  await expect(page.getByRole('alert')).toContainText('Prüfe die E-Mail-Adresse')
  await page.getByLabel('E-Mail').fill(EMAIL)
  await page.getByRole('button', { name: 'Code senden' }).click()
  await expect(page.getByRole('alert')).toContainText('Prüfe die E-Mail-Adresse')
  await page.unrouteAll()
  await mockAuth(page, { otp: { status: 429, code: 'over_email_send_rate_limit' } })
  await page.getByRole('button', { name: 'Code senden' }).click()
  await expect(page.getByRole('alert')).toContainText('Zu viele Versuche')
  await page.unrouteAll()
  await mockAuth(page, { otp: 'offline' })
  await page.getByRole('button', { name: 'Code senden' }).click()
  await expect(page.getByRole('alert')).toContainText('Du bist offline')
  await noRawText(page)
})

test('Abgelaufener oder benutzter Link: eigener Text und Weg zum neuen Code', async ({ page }) => {
  await mockAuth(page, { verify: { status: 403, code: 'otp_expired' } })
  await page.goto(`/anmelden#token_hash=${HASH}&type=email`)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Der Link ist abgelaufen')
  await expect(page.getByText('Tippe auf')).toHaveCount(0)
  await noRawText(page)
  await page.getByRole('button', { name: 'Neuen Code anfordern' }).click()
  await expect(page.getByLabel('E-Mail')).toBeVisible()
})

test('Standard-Link von Supabase mit Fehler im Fragment zeigt denselben Text', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/anmelden#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
  await expect(page.getByRole('alert')).toContainText('Der Link ist abgelaufen')
  expect(page.url()).not.toContain('error')
})

test('Präparierter Link mit fremder Sitzung im Fragment wird nicht übernommen (Login-CSRF)', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/profil#access_token=a.b.c&refresh_token=r&expires_in=3600&token_type=bearer')
  await expect(page.getByRole('heading', { name: 'Noch kein Konto' })).toBeVisible()
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('sb-')))).toEqual([])

  // Bei bestehender Sitzung bleibt das Konto unverändert
  await page.goto('/anmelden')
  await signInWithCode(page)
  await page.goto('/profil#access_token=a.b.c&refresh_token=r&expires_in=3600&token_type=bearer')
  await expect(page.getByText(EMAIL)).toBeVisible()
})
