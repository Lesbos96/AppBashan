import { expect, type Page } from '@playwright/test'
import { fillKuecheBeispiel } from './dienste-helpers'
import { setTerminAddress } from './konfigurator-helpers'

export const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' }

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export const price = (totalCents: number, lowCents = totalCents, highCents = totalCents, lines = [{ key: 'assembly', cents: totalCents }]) => ({ kind: 'price', totalCents, lowCents, highCents, lines })

/** Spanne ohne verbindlichen Gesamtpreis (Entrümpelung): nur low und high, die Zeilensumme liegt dazwischen. */
export const range = (lowCents: number, highCents: number, sum: number) => ({ kind: 'price', lowCents, highCents, lines: [{ key: 'clearance', cents: sum }] })

/** Gültige Antwort von `quote`; die Werte sind Testwerte, keine Berechnung. */
export const answer = (snapshot: object, over: object = {}) => ({
  id: '7b0e7a58-6f0c-4c52-9d0c-5a1f3b9d2e11',
  status: 'requested',
  needsQuote: false,
  priceVersion: 1,
  snapshot,
  ...over,
})

export type QuoteCall = { body: Record<string, unknown>; authorization: string | null }
export type Reply = { status?: number; json?: unknown; delay?: number; abort?: true }

/** Fängt `quote` ab (auch die CORS-Vorabfrage) und zeichnet jeden Aufruf auf. `reply` bekommt die laufende Nummer (ab 1). */
export async function mockQuote(page: Page, reply: (n: number) => Reply) {
  const calls: QuoteCall[] = []
  await page.route('**/functions/v1/quote', async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    calls.push({ body: r.request().postDataJSON() as Record<string, unknown>, authorization: r.request().headers()['authorization'] ?? null })
    const out = reply(calls.length)
    if (out.delay) await new Promise((resolve) => setTimeout(resolve, out.delay))
    if (out.abort) return r.abort('failed')
    return r.fulfill({ status: out.status ?? 200, headers: cors, json: out.json })
  })
  return calls
}

/** Wählt im Kalender den 15. des nächsten Monats (immer ein gültiger Tag ab heute). */
export async function pickDate(page: Page) {
  await page.getByRole('button', { name: 'Nächster Monat' }).click()
  await page.getByRole('button', { name: /, 15\. / }).click()
}

/** Montage-Küche bis zur Zusammenfassung (ohne Anmeldung). */
export async function toSummary(page: Page) {
  await page.goto('/montage')
  await fillKuecheBeispiel(page)
  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page).toHaveURL(/\/montage\/termin$/)
  await setTerminAddress(page, 'Neubaugasse 12, 1070 Wien')
  await pickDate(page)
  await page.getByRole('button', { name: 'Zur Zusammenfassung' }).click()
  await expect(page).toHaveURL(/\/montage\/zusammenfassung$/)
  await fillContact(page)
}

/** Kontaktfelder der Zusammenfassung (Pflicht vor dem Senden). */
export async function fillContact(page: Page) {
  await page.getByLabel('Name').fill('Anna Muster')
  await page.getByLabel('Telefon').fill('+43 660 1234567')
  await page.getByLabel('Mailadresse').fill('anna@movenow.test')
}

/** Nach der gemockten Anmeldung trägt der Client ein Test-JWT; die öffentlichen Tarife lädt der Test daher ohne Authorization (wie anonym). */
export async function anonymousPrices(page: Page) {
  await page.route(/\/rest\/v1\/(current_price_version|price_config|rpc\/booking_terms)/, (r) => {
    const { authorization: _unused, ...headers } = r.request().headers()
    void _unused
    return r.continue({ headers })
  })
}
