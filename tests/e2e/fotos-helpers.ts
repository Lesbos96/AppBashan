import { expect, type Page } from '@playwright/test'
import { mockAuth, signInWithCode } from './auth-helpers'
import { anonymousPrices, answer, cors, mockQuote, pickDate, price, type Reply } from './anfrage-helpers'
import { fillEntruempelungBeispiel } from './dienste-helpers'

// Foto-Uploads nach dem Senden (Bestätigungsseite). Alle Aufrufe an PostgREST und Storage sind abgefangen.
export const REQUEST = '7b0e7a58-6f0c-4c52-9d0c-5a1f3b9d2e11'

export type Calls = { rows: { id: string; request_id: string }[]; uploads: { path: string; type: string | null; body: Buffer }[]; removedRows: number; removedFiles: string[][] }
export type Hooks = { row?: (n: number) => Reply; upload?: (n: number) => Reply }

export async function mockPhotos(page: Page, hooks: Hooks = {}): Promise<Calls> {
  const calls: Calls = { rows: [], uploads: [], removedRows: 0, removedFiles: [] }
  await page.route('**/rest/v1/request_photos**', async (r) => {
    const method = r.request().method()
    if (method === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    if (method === 'DELETE') {
      calls.removedRows++
      return r.fulfill({ status: 204, headers: cors })
    }
    calls.rows.push(r.request().postDataJSON() as { id: string; request_id: string })
    const out = hooks.row?.(calls.rows.length) ?? {}
    if (out.abort) return r.abort('failed')
    return r.fulfill({ status: out.status ?? 201, headers: cors, json: out.json })
  })
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

/** Entrümpelung mit zwei Fotos bis zum Absenden; `photo` ist die Bilddatei (Standard: ein kleines JPEG). */
export async function sendWithPhotos(page: Page, photo?: Buffer) {
  await anonymousPrices(page)
  await mockAuth(page)
  await mockQuote(page, () => ({ json: answer(price(117500), { id: REQUEST }) }))
  await page.goto('/entruempelung')
  await fillEntruempelungBeispiel(page, photo)
  await page.getByRole('button', { name: 'Ort & Wunschtermin' }).click()
  await page.getByLabel('Adresse').fill('Neubaugasse 12, 1070 Wien')
  await pickDate(page)
  await page.getByRole('button', { name: 'Zur Zusammenfassung' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Anmelden und senden' }).click()
  await signInWithCode(page)
  await expect(page).toHaveURL(/\/entruempelung\/zusammenfassung$/)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /^(Anfrage senden|Erneut senden)$/ }).click()
  await expect(page).toHaveURL(/\/entruempelung\/gesendet$/)
}

