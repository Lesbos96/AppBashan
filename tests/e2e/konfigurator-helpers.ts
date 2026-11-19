import { expect, type Page } from '@playwright/test'
import { mockCaptcha, type CaptchaMode } from './captcha-helpers'

// FESTE BEISPIELANTWORT für `route`: Sie stammt aus keiner echten Berechnung und sagt nichts über echte Kilometer.
// Die Edge Function ist noch nicht live getestet (OPEN_ISSUES „S5b"); alle Tests und Screenshots laufen gegen diese Fixture.
export const routeFixture = {
  region: 'vienna',
  outsideKm: 0,
  driveHours: 0.2,
  distanceKm: 4.8,
  totalKm: 9.6,
  geometry: [
    [16.352, 48.2],
    [16.36, 48.206],
    [16.371, 48.208],
    [16.384, 48.214],
    [16.396, 48.217],
  ],
}

const candidates: Record<string, object> = {
  Neubaugasse: { label: 'Neubaugasse 12, 1070 Wien', lat: 48.2, lon: 16.352, postcode: '1070', country: 'AT', layer: 'address', street: 'Neubaugasse', housenumber: '12', locality: 'Wien' },
  Praterstraße: { label: 'Praterstraße 30, 1020 Wien', lat: 48.217, lon: 16.396, postcode: '1020', country: 'AT', layer: 'address', street: 'Praterstraße', housenumber: '30', locality: 'Wien' },
  Kärntner: { label: 'Kärntner Straße, 1010 Wien', lat: 48.205, lon: 16.37, postcode: '1010', country: 'AT', layer: 'street', street: 'Kärntner Straße', housenumber: null, locality: 'Wien' },
}

type Mock = { routeStatus?: number; calls?: { geocode: number; route: number }; captcha?: CaptchaMode; tokens?: string[]; geocodeStatus?: number }

/**
 * Fängt `route` ab (auch die CORS-Vorabfrage) und zählt die Aufrufe. Mit `routeStatus` antwortet der Modus „route" mit diesem Fehlercode,
 * mit `geocodeStatus` die Adresssuche. `tokens` sammelt die Captcha-Tokens der Aufrufe; `captcha` bestimmt das Verhalten des Turnstile-Stubs.
 */
export async function mockRoute(page: Page, mock: Mock = {}) {
  const calls = mock.calls ?? { geocode: 0, route: 0 }
  await mockCaptcha(page, mock.captcha)
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }
  await page.route('**/functions/v1/route', async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    const body = r.request().postDataJSON() as { mode: 'geocode' | 'route'; q?: string; captcha?: string }
    calls[body.mode]++
    mock.tokens?.push(String(body.captcha))
    if (body.mode === 'geocode' && mock.geocodeStatus) return r.fulfill({ status: mock.geocodeStatus, headers: cors, json: { error: 'captcha_failed' } })
    if (body.mode === 'geocode') {
      const hit = Object.entries(candidates).find(([k]) => body.q?.includes(k))
      return r.fulfill({ status: 200, headers: cors, json: { candidates: hit ? [hit[1]] : [] } })
    }
    if (mock.routeStatus) return r.fulfill({ status: mock.routeStatus, headers: cors, json: { error: 'rate_limited' } })
    return r.fulfill({ status: 200, headers: cors, json: routeFixture })
  })
  return calls
}

/** Adresse über das Sheet suchen und den Treffer bestätigen (mit Einwilligung). */
export async function setAddress(page: Page, which: 'Abholung' | 'Ziel', text: string) {
  await page.getByRole('button', { name: new RegExp(`^${which}`) }).click()
  const sheet = page.locator('dialog[open]')
  const consent = sheet.getByRole('switch', { name: /Routenberechnung/ })
  if ((await consent.getAttribute('aria-checked')) === 'false') await consent.click()
  await sheet.getByLabel(/Straße, Hausnummer/).fill(text)
  await sheet.getByRole('button', { name: 'Adresse suchen' }).click()
  await sheet.getByRole('button', { name: text }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
}

/** Adresse im Termin-Schritt (Entrümpelung, Montage): Suche mit Einwilligung, Treffer bestätigen. */
export async function setTerminAddress(page: Page, text: string) {
  await mockRoute(page)
  await page.getByRole('button', { name: /^Adresse/ }).click()
  const sheet = page.locator('dialog[open]')
  const consent = sheet.getByRole('switch', { name: /Routenberechnung/ })
  if ((await consent.getAttribute('aria-checked')) === 'false') await consent.click()
  await sheet.getByLabel(/Straße, Hausnummer/).fill(text)
  await sheet.getByRole('button', { name: 'Adresse suchen' }).click()
  await sheet.getByRole('button', { name: text }).click()
  await expect(page.locator('dialog[open]')).toHaveCount(0)
}

export async function clickTimes(page: Page, name: string, times: number) {
  const button = page.getByRole('button', { name })
  for (let i = 0; i < times; i++) await button.click()
}

/** Umzug-Beispiel aus dem README: 3 Personen, 1 Fahrzeug, 5 h, Wien, Montage 3 lfm, 20 Kartons, 1 Halteverbot = 689,61 €. Erwartet die Seite /umzug. */
export async function fillUmzugBeispiel(page: Page) {
  await clickTimes(page, 'Mehr Personen', 1)
  await clickTimes(page, 'Dauer erhöhen', 4)
  await page.getByRole('switch', { name: 'Montage oder Demontage dazubuchen' }).click()
  await page.getByRole('button', { name: /^Standardmöbel/ }).click()
  await clickTimes(page, 'Laufmeter erhöhen', 2)
  await page.getByRole('button', { name: 'Schließen' }).click()
  await clickTimes(page, 'Mehr Kartons', 20)
  await clickTimes(page, 'Mehr Halteverbotszonen', 1)
  await setAddress(page, 'Abholung', 'Neubaugasse 12, 1070 Wien')
  await setAddress(page, 'Ziel', 'Praterstraße 30, 1020 Wien')
}

/** Kleines gültiges JPEG, im Browser erzeugt. */
export async function makeJpeg(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#b08d57'
    ctx.fillRect(0, 0, 64, 64)
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg')!)
    return Array.from(new Uint8Array(await blob.arrayBuffer()))
  })
  return Buffer.from(bytes)
}

export async function addPhotos(page: Page, count: number, photo?: Buffer) {
  const buffer = photo ?? (await makeJpeg(page))
  await page.locator('input[type=file][multiple]').setInputFiles(Array.from({ length: count }, (_, i) => ({ name: `foto${i}.jpg`, mimeType: 'image/jpeg', buffer })))
}
