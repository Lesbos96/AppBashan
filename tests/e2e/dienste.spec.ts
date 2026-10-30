/// <reference lib="dom" />
import { expect, test } from '@playwright/test'
import { collectErrors } from './console'
import { fillEntruempelungBeispiel, fillKuecheBeispiel, weiter } from './dienste-helpers'
import { clickTimes } from './konfigurator-helpers'

const noFee = /15 ?%|Gebühr|Provision|Plattform/

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
})

test('Entrümpelung-Beispiel: 1.175,00 € mit Spanne 950–1.550 €, ohne Gebührenzeile', async ({ page }) => {
  const errors = collectErrors(page)
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/entruempelung')
  await fillEntruempelungBeispiel(page)

  await expect(page).toHaveURL(/\/entruempelung\/ergebnis$/)
  await expect(page.getByRole('heading', { name: 'Dein erster Preisrahmen.' })).toBeVisible()
  const range = page.getByRole('region', { name: 'Richtwert' })
  await expect(range.getByText('ca. 1.175,00 €')).toBeVisible()
  await expect(range.getByText('950,00 €')).toBeVisible()
  await expect(range.getByText('1.550,00 €')).toBeVisible()
  await expect(page.getByText('≈ 15 m³ · 2 Fotos')).toBeVisible()
  await expect(page.getByText('3. Stock, ohne Lift')).toBeVisible()
  for (const [label, detail, amount] of [
    ['Räumung & Entsorgung', '15 m³ × 75,00', '1.125,00'],
    ['Etagenzuschlag', '2 Etagen ohne Lift × 25,00', '50,00'],
    ['Gesamt', '', '1.175,00'],
  ] as const) {
    const row = page.locator('li', { hasText: label }).filter({ hasText: new RegExp(`${amount.replace('.', '\\.')}.€`) })
    await expect(row.first()).toBeVisible()
    if (detail) await expect(row.first()).toContainText(detail)
  }
  await expect(page.locator('body')).not.toContainText(noFee)
  expect(requests.filter((u) => /platform_settings|fee_splits/.test(u))).toEqual([])
  expect(errors).toEqual([])
})

test('Entrümpelung nur mit der Tastatur: alle Schritte bis zum Ergebnis', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/entruempelung')
  const press = async (locator: ReturnType<typeof page.getByRole>) => {
    await locator.focus()
    await page.keyboard.press('Enter')
  }
  await expect(weiter(page)).toBeDisabled()
  await page.getByRole('radio', { name: /^Haus/ }).focus()
  await page.keyboard.press('Enter')
  for (let step = 1; step < 6; step++) await press(weiter(page))
  await expect(page.getByRole('heading', { name: 'Zeig uns, was weg soll.' })).toBeVisible()
  await press(page.getByRole('button', { name: 'Richtwert anzeigen' }))
  await expect(page).toHaveURL(/\/entruempelung\/ergebnis$/)
  await expect(page.getByRole('region', { name: 'Richtwert' })).toContainText('ca. ')
  expect(errors).toEqual([])
})

test('Mindestpreis: kleine Fläche rechnet mit dem Mindestpreis', async ({ page }) => {
  await page.goto('/entruempelung')
  await page.getByRole('radio', { name: /^Keller/ }).click()
  await weiter(page).click()
  await page.getByLabel(/Zu räumende Fläche/).fill('5')
  await weiter(page).click()
  await page.getByRole('radio', { name: /^Wenig gefüllt/ }).click()
  for (let step = 3; step < 6; step++) await weiter(page).click()
  await page.getByRole('button', { name: 'Richtwert anzeigen' }).click()
  await expect(page.getByText('Mindestpreis')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Richtwert' }).getByText('ca. 180,00 €')).toBeVisible()
})

test('Gewerbe und Sonderabfall führen zur Besichtigung statt zu einem Preis', async ({ page }) => {
  await page.goto('/entruempelung')
  await page.getByRole('radio', { name: /^Gewerbe/ }).click()
  for (let step = 1; step < 6; step++) await weiter(page).click()
  await page.getByRole('button', { name: 'Richtwert anzeigen' }).click()
  await expect(page.getByRole('heading', { name: 'Wir schauen genauer hin.' })).toBeVisible()
  await expect(page.getByText('Gewerbe: Das prüft ein Partner persönlich.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Besichtigung anfragen' })).toBeVisible()
  await expect(page.getByText(/ca\. \d/)).toHaveCount(0)

  // Wohnung mit besonderen Abfällen: ebenfalls Besichtigung
  await page.getByRole('link', { name: 'Ändern' }).click()
  await page.getByRole('radio', { name: /^Wohnung/ }).click()
  for (let step = 1; step < 5; step++) await weiter(page).click()
  await page.getByRole('switch', { name: 'Besondere Abfälle oder unbekannte Materialien' }).click()
  await weiter(page).click()
  await page.getByRole('button', { name: 'Richtwert anzeigen' }).click()
  await expect(page.getByText('Sonderfall: Das prüft ein Partner persönlich.')).toBeVisible()
})

test('Ergebnis ohne Angaben führt zurück zum Wizard', async ({ page }) => {
  await page.goto('/entruempelung/ergebnis')
  await expect(page).toHaveURL(/\/entruempelung$/)
})

test('Küche-Beispiel: 770,40 € mit Grundbetrag, ohne Gebührenzeile', async ({ page }) => {
  const errors = collectErrors(page)
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await page.goto('/montage')
  await fillKuecheBeispiel(page)
  await expect(page.getByRole('button', { name: /Richtpreis 770,40.€/ })).toBeVisible()
  await page.getByRole('button', { name: /alle Positionen anzeigen/ }).click()
  const sheet = page.locator('dialog[open]')
  await expect(sheet.locator('li', { hasText: 'Montage / Demontage' }).filter({ hasText: /770,40.€/ }).first()).toBeVisible()
  await expect(sheet.getByText('Grundbetrag 72,00', { exact: false })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(noFee)
  expect(requests.filter((u) => /platform_settings|fee_splits/.test(u))).toEqual([])
  expect(errors).toEqual([])
})

test('Standardmontage: Mindestmenge 2 lfm, Weiter per Tastatur', async ({ page }) => {
  await page.goto('/montage')
  await expect(page.getByRole('button', { name: /Richtpreis 95,74.€/ })).toBeVisible()
  await clickTimes(page, 'Laufmeter erhöhen', 2)
  await expect(page.getByRole('button', { name: /Richtpreis 143,61.€/ })).toBeVisible()
  const next = weiter(page)
  await next.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/montage\/termin$/)
})

test('Kaputter gespeicherter Zustand: Entrümpelung startet leer, Montage zeigt den Fehlerzustand', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('movenow.flow.clearance', JSON.stringify({ step: 4, object: 'flat', area: 99999, fill: 'normal', floor: 0, lift: true, special: false, assembly: false, draft: { kind: 'standard', lm: 2, upper: 0, tall: 0 }, description: '' }))
    sessionStorage.setItem('movenow.flow.montage', '{"draft":{"kind":"kitchen","lm":-5,"upper":0,"tall":0}}')
  })
  await page.goto('/entruempelung')
  await expect(page.getByRole('heading', { name: 'Was soll geräumt werden?' })).toBeVisible()
  await expect(weiter(page)).toBeDisabled()
  await page.goto('/montage')
  // Ungültige Menge wird verworfen: Standardmontage mit Mindestmenge
  await expect(page.getByRole('button', { name: /Richtpreis 95,74.€/ })).toBeVisible()
})
