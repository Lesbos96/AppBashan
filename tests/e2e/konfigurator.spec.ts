/// <reference lib="dom" />
import type { Page } from '@playwright/test'
import { expect, test } from './backend'
import { collectErrors } from './console'
import { addPhotos, clickTimes, fillUmzugBeispiel, mockRoute, setAddress } from './konfigurator-helpers'

const euro = (text: string) => new RegExp(text.replace(' €', '.€'))

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
})

async function openPriceSheet(page: Page) {
  await page.getByRole('button', { name: /alle Positionen anzeigen|Details anzeigen/ }).click()
  return page.locator('dialog[open]')
}

test('Umzug-Beispiel: 689,61 € mit allen Positionen, ohne Gebührenzeile', async ({ page }) => {
  const errors = collectErrors(page)
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  await mockRoute(page)
  await page.goto('/umzug')
  await fillUmzugBeispiel(page)

  await expect(page.getByRole('button', { name: euro('Richtpreis 689,61 €') })).toBeVisible()
  const sheet = await openPriceSheet(page)
  await expect(sheet.getByRole('heading', { name: 'Richtpreis' })).toBeVisible()
  for (const [label, amount] of [
    ['Team & Fahrzeug', '354,00 €'],
    ['Montage / Demontage', '143,61 €'],
    ['Umzugskartons', '72,00 €'],
    ['Halteverbotszone', '120,00 €'],
    ['Gesamt', '689,61 €'],
  ]) {
    await expect(sheet.locator('li', { hasText: label }).filter({ hasText: euro(amount!) }).first()).toBeVisible()
  }
  await expect(sheet.getByText('5 h × 70,80 €', { exact: false })).toBeVisible()
  // Kein Hinweis auf Gebühr oder Provision, kein Zugriff auf die Gebührentabellen
  await expect(page.locator('body')).not.toContainText(/15 ?%|Gebühr|Provision|Plattform/)
  expect(requests.filter((u) => /platform_settings|commission_entries/.test(u))).toEqual([])
  expect(errors).toEqual([])
})

test('Hauptflow nur mit der Tastatur: Adressen bestätigen, Preis, Weiter', async ({ page }) => {
  const errors = collectErrors(page)
  await mockRoute(page)
  await page.goto('/transport')
  const press = async (locator: ReturnType<Page['getByRole']>) => {
    await locator.focus()
    await page.keyboard.press('Enter')
  }
  for (const [which, text] of [
    ['Abholung', 'Neubaugasse 12, 1070 Wien'],
    ['Ziel', 'Praterstraße 30, 1020 Wien'],
  ] as const) {
    await press(page.getByRole('button', { name: new RegExp(`^${which}`) }))
    const sheet = page.locator('dialog[open]')
    const consent = sheet.getByRole('switch', { name: /Routenberechnung/ })
    if ((await consent.getAttribute('aria-checked')) === 'false') await press(consent)
    await sheet.getByLabel(/Straße, Hausnummer/).fill(text)
    await page.keyboard.press('Enter')
    await press(sheet.getByRole('button', { name: text }))
    await expect(page.locator('dialog[open]')).toHaveCount(0)
  }
  await expect(page.getByRole('button', { name: /Richtpreis .*€, alle Positionen/ })).toBeVisible()
  const next = page.getByRole('button', { name: 'Weiter' })
  await next.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/transport\/termin$/)
  expect(errors).toEqual([])
})

test('Klavier führt zum persönlichen Angebot mit Grund, nicht zu einem Preis', async ({ page }) => {
  await mockRoute(page)
  await page.goto('/transport')
  await setAddress(page, 'Abholung', 'Neubaugasse 12, 1070 Wien')
  await setAddress(page, 'Ziel', 'Praterstraße 30, 1020 Wien')
  await expect(page.getByRole('button', { name: /Richtpreis .*€/ })).toBeVisible()
  await page.getByRole('radio', { name: 'Klavier' }).focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Persönliches Angebot, Details anzeigen' })).toBeVisible()
  const sheet = await openPriceSheet(page)
  await expect(sheet.getByText('Spezialgut', { exact: false })).toBeVisible()
  await expect(sheet.getByText('Zur Orientierung für den Klaviertransport', { exact: false })).toBeVisible()
})

test('Ohne Einwilligung geht kein Request an die Routenfunktion; die Suche bleibt gesperrt', async ({ page }) => {
  const calls = await mockRoute(page)
  await page.goto('/transport')
  await page.getByRole('button', { name: /^Abholung/ }).click()
  const sheet = page.locator('dialog[open]')
  await sheet.getByLabel(/Straße, Hausnummer/).fill('Neubaugasse 12, 1070 Wien')
  await expect(sheet.getByRole('button', { name: 'Adresse suchen' })).toBeDisabled()
  await expect(sheet.getByText('Ohne deine Einwilligung können wir die Adresse nicht prüfen und die Anfrage nicht senden.')).toBeVisible()
  expect(calls).toEqual({ geocode: 0, route: 0 })
})

test('Treffer ohne Hausnummer sind nicht wählbar', async ({ page }) => {
  await mockRoute(page)
  await page.goto('/transport')
  await page.getByRole('button', { name: /^Abholung/ }).click()
  const sheet = page.locator('dialog[open]')
  await sheet.getByRole('switch', { name: /Routenberechnung/ }).click()
  await sheet.getByLabel(/Straße, Hausnummer/).fill('Kärntner Straße')
  await sheet.getByRole('button', { name: 'Adresse suchen' }).click()
  await expect(sheet.getByText('Bitte gib auch die Hausnummer an.')).toBeVisible()
  await expect(sheet.getByRole('button', { name: /Kärntner Straße, 1010 Wien/ })).toHaveCount(0)
})

for (const status of [429, 500]) {
  test(`Routenfunktion antwortet ${status}: verständliche Meldung, keine Kilometer, kein Preis`, async ({ page }) => {
    await mockRoute(page, { routeStatus: status })
    await page.goto('/umzug')
    await setAddress(page, 'Abholung', 'Neubaugasse 12, 1070 Wien')
    await setAddress(page, 'Ziel', 'Praterstraße 30, 1020 Wien')
    await expect(page.getByRole('alert').filter({ hasText: status === 429 ? 'zu viele Anfragen' : 'nicht erreichbar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Strecke fehlt, Details anzeigen' })).toBeVisible()
    await expect(page.getByText('einfache Strecke')).toHaveCount(0)
    await expect(page.getByText('Richtpreis ·', { exact: false })).toHaveCount(0)
  })
}

test('Funktion nicht erreichbar bei der Suche: Fehlermeldung statt Treffer', async ({ page }) => {
  await page.route('**/functions/v1/route', (r) => r.abort())
  await page.goto('/transport')
  await page.getByRole('button', { name: /^Abholung/ }).click()
  const sheet = page.locator('dialog[open]')
  await sheet.getByRole('switch', { name: /Routenberechnung/ }).click()
  await sheet.getByLabel(/Straße, Hausnummer/).fill('Neubaugasse 12, 1070 Wien')
  await sheet.getByRole('button', { name: 'Adresse suchen' }).click()
  await expect(sheet.getByRole('alert')).toContainText('Keine Verbindung')
})

test('Fotos: Standort-EXIF ist nach der Aufbereitung entfernt, Entfernen und Limit funktionieren', async ({ page }) => {
  await page.goto('/transport')
  // JPEG mit APP1/Exif-Segment (GPS-Platzhalter) im Browser erzeugen
  const exif = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    c.getContext('2d')!.fillRect(0, 0, 64, 64)
    const jpeg = new Uint8Array(await (await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg')!)).arrayBuffer())
    const payload = new TextEncoder().encode('Exif\0\0MM\0*GPS:48.2,16.37')
    const seg = new Uint8Array([0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload])
    return Array.from(new Uint8Array([...jpeg.slice(0, 2), ...seg, ...jpeg.slice(2)]))
  })
  expect(Buffer.from(exif).includes('GPS:48.2')).toBe(true)
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'sofa.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(exif) })
  await expect(page.getByRole('img', { name: 'Foto 1' })).toBeVisible()
  await expect(page.getByText('1 von 8')).toBeVisible()
  const out = await page.evaluate(async () => {
    const src = document.querySelector<HTMLImageElement>('img[alt="Foto 1"]')!.src
    return Array.from(new Uint8Array(await (await fetch(src)).arrayBuffer()))
  })
  const text = Buffer.from(out).toString('latin1')
  expect(text.includes('GPS:')).toBe(false)
  expect(text.includes('Exif')).toBe(false)

  await page.getByRole('button', { name: 'Foto 1 entfernen' }).click()
  await expect(page.getByRole('img', { name: 'Foto 1' })).toHaveCount(0)
  // Ungültige Datei wird abgelehnt
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
  await expect(page.getByText('Das ist kein Bild.')).toBeVisible()
})

test('Änderung von Adresse oder Rückfahrt verwirft die Route', async ({ page }) => {
  const calls = await mockRoute(page)
  await page.goto('/transport')
  await setAddress(page, 'Abholung', 'Neubaugasse 12, 1070 Wien')
  await setAddress(page, 'Ziel', 'Praterstraße 30, 1020 Wien')
  await expect(page.getByText('4,8 km')).toBeVisible()
  expect(calls.route).toBe(1)
  await page.getByRole('switch', { name: 'Rückfahrt berücksichtigen' }).click()
  await expect(page.getByText('4,8 km')).toBeVisible()
  expect(calls.route).toBe(2)
  await clickTimes(page, 'Mehr Personen', 1)
  expect(calls.route).toBe(2)
})

test('Mehr als 8 Fotos werden abgelehnt, 8 bleiben', async ({ page }) => {
  await page.goto('/transport')
  await addPhotos(page, 9)
  await expect(page.getByText('8 von 8')).toBeVisible()
  await expect(page.getByText('Mehr als 8 Fotos gehen nicht.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Foto aufnehmen' })).toBeDisabled()
  await page.getByRole('button', { name: 'Foto 8 entfernen' }).click()
  await expect(page.getByText('7 von 8')).toBeVisible()
})

test('Kaputter gespeicherter Zustand wird verworfen, der Konfigurator lädt leer', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('movenow.flow.transport', JSON.stringify({ crew: 99, route: {}, from: 5, hours: {}, goods: 'x' })))
  await page.goto('/transport')
  await expect(page.getByRole('heading', { name: 'Was muss mit?' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mehr Personen' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Möbel' })).toBeChecked()
})
