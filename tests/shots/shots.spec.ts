import { expect, test, type Page } from '@playwright/test'
import { addPhotos, fillUmzugBeispiel, mockRoute, setAddress } from '../e2e/konfigurator-helpers'

// Wächst mit jedem Screen ab S3. `onboarded: false` startet wie beim ersten Besuch.
const routes: { name: string; path: string; onboarded?: false; mock?: { routeStatus?: number }; expectedError?: RegExp; sheet?: true; fit?: false; ready?: (page: Page) => Promise<unknown>; steps?: (page: Page) => Promise<unknown> }[] = [
  { name: 'start', path: '/' },
  { name: 'willkommen-1', path: '/willkommen', onboarded: false },
  {
    name: 'willkommen-2',
    path: '/willkommen',
    onboarded: false,
    steps: async (page) => {
      await page.getByRole('button', { name: 'Weiter' }).click()
      await expect(page.getByRole('heading', { name: 'Dein Richtpreis. Sofort.' })).toBeVisible()
    },
  },
  {
    name: 'willkommen-3',
    path: '/willkommen',
    onboarded: false,
    steps: async (page) => {
      await page.getByRole('button', { name: 'Weiter' }).click()
      await page.getByRole('button', { name: 'Weiter' }).click()
      await expect(page.getByRole('heading', { name: 'Ein Partner bestätigt.' })).toBeVisible()
    },
  },
  { name: 'auftraege', path: '/auftraege' },
  { name: 'profil', path: '/profil' },
  { name: 'preise', path: '/profil/preise', fit: false, ready: (page) => expect(page.getByText('Montage & Demontage')).toBeVisible() },
  { name: 'datenschutz', path: '/profil/datenschutz' },
  { name: 'impressum', path: '/profil/impressum' },
  { name: 'miete', path: '/miete' },
  // `route` ist gemockt (feste Beispielantwort): keine Aussage über echte Kilometer
  { name: 'transport', path: '/transport', mock: {}, ready: (page) => expect(page.getByRole('heading', { name: 'Was muss mit?' })).toBeVisible() },
  {
    name: 'transport-fotos',
    path: '/transport',
    mock: {},
    steps: async (page) => {
      await addPhotos(page, 8)
      await expect(page.getByText('8 von 8')).toBeVisible()
    },
  },
  { name: 'umzug-beispiel', path: '/umzug', mock: {}, steps: fillUmzugBeispiel },
  {
    name: 'umzug-preis',
    path: '/umzug',
    mock: {},
    fit: false,
    sheet: true,
    steps: async (page) => {
      await fillUmzugBeispiel(page)
      await page.getByRole('button', { name: /alle Positionen anzeigen/ }).click()
      await expect(page.locator('dialog[open]').getByText('Gesamt')).toBeVisible()
    },
  },
  {
    name: 'umzug-angebot',
    path: '/umzug',
    mock: {},
    fit: false,
    sheet: true,
    steps: async (page) => {
      await setAddress(page, 'Abholung', 'Neubaugasse 12, 1070 Wien')
      await setAddress(page, 'Ziel', 'Praterstraße 30, 1020 Wien')
      await page.getByRole('radio', { name: 'Klavier' }).check({ force: true })
      await page.getByRole('button', { name: /Details anzeigen/ }).click()
      await expect(page.locator('dialog[open]').getByText('Spezialgut', { exact: false })).toBeVisible()
    },
  },
  {
    name: 'umzug-adresse',
    path: '/umzug',
    mock: {},
    fit: false,
    sheet: true,
    steps: async (page) => {
      await page.getByRole('button', { name: /^Abholung/ }).click()
      const sheet = page.locator('dialog[open]')
      await sheet.getByRole('switch', { name: /Routenberechnung/ }).click()
      await sheet.getByLabel(/Straße, Hausnummer/).fill('Neubaugasse 12, 1070 Wien')
      await sheet.getByRole('button', { name: 'Adresse suchen' }).click()
      await expect(sheet.getByRole('button', { name: 'Neubaugasse 12, 1070 Wien' })).toBeVisible()
    },
  },
  {
    name: 'umzug-routenfehler',
    path: '/umzug',
    mock: { routeStatus: 500 },
    // Der Browser meldet die gemockte 500er-Antwort selbst als Konsolenfehler; die App fängt sie ab.
    expectedError: /status of 500/,
    steps: async (page) => {
      await setAddress(page, 'Abholung', 'Neubaugasse 12, 1070 Wien')
      await setAddress(page, 'Ziel', 'Praterstraße 30, 1020 Wien')
      await expect(page.getByRole('alert').filter({ hasText: 'nicht erreichbar' })).toBeVisible()
    },
  },
  { name: 'fehler', path: '/gibt-es-nicht' },
  { name: 'fundament', path: '/dev/fundament', fit: false },
]

for (const { name, path, onboarded, mock, expectedError, sheet, fit, ready, steps } of routes) {
  test(name, async ({ page }, testInfo) => {
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('pageerror', (e) => errors.push(e.message))
    if (onboarded !== false) await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
    if (mock) await mockRoute(page, mock)
    await page.goto(path, { waitUntil: 'networkidle' })
    await ready?.(page)
    await steps?.(page)
    await page.waitForTimeout(700)
    // Fixierte Leisten sitzen sonst mitten im Full-Page-Bild: Fenster auf Seitenhöhe bringen, dann liegen sie unten.
    if (fit !== false) {
      const height = await page.evaluate<number>('document.documentElement.scrollHeight')
      await page.setViewportSize({ width: page.viewportSize()!.width, height })
      await page.waitForTimeout(300)
    }
    await page.screenshot({ path: `tmp/shots/${testInfo.project.name}/${name}.png`, fullPage: sheet !== true })
    expect(errors.filter((e) => !expectedError?.test(e))).toEqual([])
  })
}
