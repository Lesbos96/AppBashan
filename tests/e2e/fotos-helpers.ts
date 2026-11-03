import { expect, type Page } from '@playwright/test'
import { mockAuth, signInWithCode } from './auth-helpers'
import { anonymousPrices, answer, cors, fillContact, mockQuote, pickDate, price, type Reply } from './anfrage-helpers'
import { setTerminAddress } from './konfigurator-helpers'
import { fillEntruempelungBeispiel } from './dienste-helpers'

// Foto-Uploads vor dem Absenden (Zusammenfassung). Alle Aufrufe an Storage und `quote` sind abgefangen.
export const REQUEST = '7b0e7a58-6f0c-4c52-9d0c-5a1f3b9d2e11'

export type Calls = { uploads: { path: string; type: string | null; body: Buffer }[]; removedFiles: string[][] }
export type Hooks = { upload?: (n: number) => Reply }

export async function mockPhotos(page: Page, hooks: Hooks = {}): Promise<Calls> {
  const calls: Calls = { uploads: [], removedFiles: [] }
  await page.route('**/storage/v1/object/request-photos**', async (r) => {
    const method = r.request().method()
    if (method === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    if (method === 'DELETE') {
      calls.removedFiles.push((r.request().postDataJSON() as { prefixes: string[] }).prefixes)
      return r.fulfill({ status: 200, headers: cors, json: [] })
    }
    calls.uploads.push({ path: decodeURIComponent(new URL(r.request().url()).pathname.split('/object/request-photos/')[1] ?? ''), type: r.request().headers()['content-type'] ?? null, body: r.request().postDataBuffer() ?? Buffer.alloc(0) })
    const out = hooks.upload?.(calls.uploads.length) ?? {}
    if (out.delay) await new Promise((resolve) => setTimeout(resolve, out.delay))
    if (out.abort) return r.abort('failed')
    return r.fulfill({ status: out.status ?? 200, headers: cors, json: out.json ?? { Key: 'request-photos/x', Id: 'x' } })
  })
  return calls
}

export const storageError = (status: number, error: string, message: string): Reply => ({ status, json: { statusCode: String(status), error, message } })

export type SendOptions = { photo?: Buffer; reply?: (n: number) => Reply }

/** Entrümpelung mit zwei Fotos bis zur Zusammenfassung, angemeldet und Einwilligung gesetzt. Gibt die Aufrufe von `quote` zurück. */
export async function prepareSummary(page: Page, { photo, reply }: SendOptions = {}) {
  await anonymousPrices(page)
  await mockAuth(page)
  const quoteCalls = await mockQuote(page, reply ?? (() => ({ json: answer(price(117500), { id: REQUEST }) })))
  await page.goto('/entruempelung')
  await fillEntruempelungBeispiel(page, photo)
  await page.getByRole('button', { name: 'Ort & Wunschtermin' }).click()
  await setTerminAddress(page, 'Neubaugasse 12, 1070 Wien')
  await pickDate(page)
  await page.getByRole('button', { name: 'Zur Zusammenfassung' }).click()
  await fillContact(page)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Anmelden und senden' }).click()
  await signInWithCode(page)
  await expect(page).toHaveURL(/\/entruempelung\/zusammenfassung$/)
  await page.getByRole('checkbox').check()
  return quoteCalls
}

export const sendButton = (page: Page) => page.getByRole('button', { name: /^(Anfrage senden|Erneut senden)$/ })

/** Wie `prepareSummary`, dann Senden. `sent: false`, wenn die Seite auf der Zusammenfassung bleiben soll (Fehlerzustände). */
export async function sendWithPhotos(page: Page, options: SendOptions & { sent?: boolean } = {}) {
  const quoteCalls = await prepareSummary(page, options)
  await sendButton(page).click()
  if (options.sent !== false) await expect(page).toHaveURL(/\/entruempelung\/gesendet$/)
  return quoteCalls
}
