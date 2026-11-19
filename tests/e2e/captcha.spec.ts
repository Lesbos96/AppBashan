import type { Page } from '@playwright/test'
import { expect, test } from './backend'
import { mockAuth, EMAIL } from './auth-helpers'
import { captchaState } from './captcha-helpers'
import { collectErrors } from './console'
import { mockRoute } from './konfigurator-helpers'

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
})

const tokenOf = (body: string) => (JSON.parse(body) as { gotrue_meta_security?: { captcha_token?: string } }).gotrue_meta_security?.captcha_token
// Die Karte ist nur als offenes Modal sichtbar; im Ruhezustand ist das Element geschlossen (ein Punkt ohne Wirkung) und zählt nicht als Dialog.
const openCard = (page: Page) => page.locator('dialog[open][aria-label="Sicherheitsprüfung"]')
const sendCode = async (page: Page) => {
  await page.getByLabel('E-Mail').fill(EMAIL)
  await page.getByRole('button', { name: 'Code senden' }).click()
}
const consent = async (page: Page) => {
  await page.getByRole('button', { name: /^Abholung/ }).click()
  const sheet = page.locator('dialog[open]')
  await sheet.getByRole('switch', { name: /Routenberechnung/ }).click()
  return sheet
}

test.describe('Anmeldung', () => {
  test('Skript lädt erst beim Absenden; jede Anforderung trägt ein eigenes Token', async ({ page }) => {
    const errors = collectErrors(page)
    const calls = await mockAuth(page)
    await page.goto('/anmelden')
    await expect(page.getByLabel('E-Mail')).toBeVisible()
    expect((await captchaState(page)).loads).toBe(0)
    await expect(page.getByRole('dialog')).toHaveCount(0) // der ruhende Host ist kein Dialog für Screenreader und Rollen-Abfragen (101 e2e-Tests zählen Dialoge)

    await sendCode(page)
    await expect(page.getByLabel('Code')).toBeVisible()
    expect(tokenOf(calls.otpBodies[0]!)).toBe('stub-token-1')
    expect((await captchaState(page)).sitekeys).toEqual(['e2e-site-key-platzhalter'])

    // Andere Adresse, neue Anforderung: nie dasselbe Token (Tokens gelten einmal)
    await page.getByRole('button', { name: 'Andere Adresse' }).click()
    await sendCode(page)
    await expect(page.getByLabel('Code')).toBeVisible()
    expect(tokenOf(calls.otpBodies[1]!)).toBe('stub-token-2')
    const state = await captchaState(page)
    expect(state.loads).toBe(1)
    expect(state.resets).toBe(2)
    expect(errors).toEqual([])
  })

  test('Cloudflare scheitert: ruhiger Text, keine Anfrage an Auth, danach geht es wieder', async ({ page }) => {
    const calls = await mockAuth(page, { captcha: 'error' })
    await page.goto('/anmelden')
    await sendCode(page)
    await expect(page.getByRole('alert')).toContainText('Die Sicherheitsprüfung hat nicht geklappt')
    expect(calls.otp).toBe(0)
    await expect(page.getByRole('button', { name: 'Code senden' })).toBeEnabled()
  })

  test('Auth lehnt das Token ab (captcha_failed): Text der Sicherheitsprüfung, nicht „Das hat nicht geklappt“', async ({ page }) => {
    await mockAuth(page, { otp: { status: 400, code: 'captcha_failed' } })
    await page.goto('/anmelden')
    await sendCode(page)
    await expect(page.getByRole('alert')).toContainText('Die Sicherheitsprüfung hat nicht geklappt')
    await expect(page.locator('body')).not.toContainText('RAW_SUPABASE_TEXT')
  })

  test('Cloudflare verlangt eine Eingabe: Karte mit Fokus, nur mit der Tastatur bedienbar, danach weiter', async ({ page }) => {
    const calls = await mockAuth(page, { captcha: 'interactive' })
    await page.goto('/anmelden')
    await page.getByLabel('E-Mail').fill(EMAIL)
    await page.getByLabel('E-Mail').press('Enter')
    const card = openCard(page)
    await expect(card).toBeVisible()
    await expect(card.getByText('Kurze Sicherheitsprüfung')).toBeVisible()
    const human = card.getByRole('button', { name: 'Ich bin ein Mensch' })
    await human.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByLabel('Code')).toBeVisible()
    await expect(card).toBeHidden()
    expect(tokenOf(calls.otpBodies[0]!)).toBe('stub-token-1')
  })

  test('Esc bricht die Prüfung ab: Text, keine Anfrage, Fokus zurück im Formular', async ({ page }) => {
    const calls = await mockAuth(page, { captcha: 'interactive' })
    await page.goto('/anmelden')
    await page.getByLabel('E-Mail').fill(EMAIL)
    await page.getByLabel('E-Mail').press('Enter')
    await expect(openCard(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(openCard(page)).toBeHidden()
    await expect(page.getByRole('alert')).toContainText('Die Sicherheitsprüfung hat nicht geklappt')
    expect(calls.otp).toBe(0)
    await expect(page.getByLabel('E-Mail')).toBeFocused()
  })
})

test.describe('Adresssuche (route)', () => {
  test('Skript lädt erst nach der Einwilligung; jede Suche trägt ein eigenes Token', async ({ page }) => {
    const errors = collectErrors(page)
    const tokens: string[] = []
    await mockRoute(page, { tokens })
    await page.goto('/transport')
    const sheet = await page.getByRole('button', { name: /^Abholung/ }).click().then(() => page.locator('dialog[open]'))
    expect((await captchaState(page)).loads).toBe(0)
    await sheet.getByRole('switch', { name: /Routenberechnung/ }).click()
    expect((await captchaState(page)).loads).toBe(0)

    for (const text of ['Neubaugasse 12, 1070 Wien', 'Praterstraße 30, 1020 Wien']) {
      await sheet.getByLabel(/Straße, Hausnummer/).fill(text)
      await sheet.getByRole('button', { name: 'Adresse suchen' }).click()
      await expect(sheet.getByRole('button', { name: text })).toBeVisible()
    }
    expect(tokens).toEqual(['stub-token-1', 'stub-token-2'])
    expect((await captchaState(page)).loads).toBe(1)
    expect(errors).toEqual([])
  })

  test('Server lehnt ab (403): Text der Sicherheitsprüfung statt „nicht erreichbar“', async ({ page }) => {
    await mockRoute(page, { geocodeStatus: 403 })
    await page.goto('/transport')
    const sheet = await consent(page)
    await sheet.getByLabel(/Straße, Hausnummer/).fill('Neubaugasse 12, 1070 Wien')
    await sheet.getByRole('button', { name: 'Adresse suchen' }).click()
    await expect(sheet.getByRole('alert')).toContainText('Die Sicherheitsprüfung hat nicht geklappt')
  })

  test('Eingabe verlangt: die Karte liegt über dem offenen Sheet und ist bedienbar', async ({ page }) => {
    await mockRoute(page, { captcha: 'interactive' })
    await page.goto('/transport')
    const sheet = await consent(page)
    await sheet.getByLabel(/Straße, Hausnummer/).fill('Neubaugasse 12, 1070 Wien')
    await sheet.getByRole('button', { name: 'Adresse suchen' }).click()
    const card = openCard(page)
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Ich bin ein Mensch' }).click() // echter Klick: nicht vom Sheet verdeckt oder gesperrt
    await expect(sheet.getByRole('button', { name: 'Neubaugasse 12, 1070 Wien' })).toBeVisible()
    await expect(card).toBeHidden()
  })

  test('Skript nicht ladbar (offline): Hinweis „Keine Verbindung“', async ({ page }) => {
    await mockRoute(page)
    await page.route('https://challenges.cloudflare.com/**', (r) => r.abort('failed'))
    await page.goto('/transport')
    const sheet = await consent(page)
    await sheet.getByLabel(/Straße, Hausnummer/).fill('Neubaugasse 12, 1070 Wien')
    await sheet.getByRole('button', { name: 'Adresse suchen' }).click()
    await expect(sheet.getByRole('alert')).toContainText('Keine Verbindung')
  })
})
