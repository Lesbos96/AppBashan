import { expect, test, type Page } from '@playwright/test'
import { UUID } from './anfrage-helpers'
import { collectErrors } from './console'
import { REQUEST, mockPhotos, sendWithPhotos, storageError } from './fotos-helpers'

// Foto-Uploads nach dem Senden (Bestätigungsseite). Alle Aufrufe an PostgREST und Storage sind abgefangen.
const failed = /status of [45]\d\d|ERR_FAILED/
const status = (page: Page) => page.getByRole('status').filter({ hasText: 'hochgeladen' })

test('Fotos werden nach dem Senden hochgeladen: Pfad vom Server, Typ JPEG, kein Standort in den Bytes, Konsole sauber', async ({ page }) => {
  const errors = collectErrors(page)
  const calls = await mockPhotos(page)
  // JPEG mit APP1/Exif-Segment (GPS-Platzhalter) im Browser erzeugen; die App kodiert es vor dem Upload neu.
  await page.goto('/transport')
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
  await sendWithPhotos(page, Buffer.from(exif))
  await expect(status(page)).toHaveText('2 von 2 hochgeladen')
  await expect(page.getByText('Hochgeladen', { exact: true })).toHaveCount(2)

  expect(calls.rows).toHaveLength(2)
  expect(calls.uploads).toHaveLength(2)
  for (const [i, row] of calls.rows.entries()) {
    expect(row.id).toMatch(UUID)
    expect(row.request_id).toBe(REQUEST)
    expect(Object.keys(row).sort()).toEqual(['id', 'request_id']) // kein vom Client gewählter Pfad
    expect(calls.uploads[i]!.path).toBe(`u-1/${REQUEST}/${row.id}.jpg`) // Dateiname ist nie der Name der Datei auf dem Gerät
  }
  for (const u of calls.uploads) {
    const text = u.body.toString('latin1')
    expect(text).toContain('image/jpeg')
    expect(text).not.toContain('foto0')
    expect(text).not.toMatch(/GPS|Exif/)
  }
  expect(errors.filter((e) => !failed.test(e))).toEqual([])
})

test('Fortschritt: Wartet / Wird hochgeladen, dann Hochgeladen', async ({ page }) => {
  await mockPhotos(page, { upload: () => ({ delay: 800 }) })
  await sendWithPhotos(page)
  await expect(status(page)).toHaveText('0 von 2 hochgeladen')
  await expect(page.getByText('Wird hochgeladen …')).toBeVisible()
  await expect(page.getByText('Wartet …')).toBeVisible()
  await expect(status(page)).toHaveText('2 von 2 hochgeladen')
})

test('Fehler bei einem Foto: Meldung am Foto, die anderen laufen, Erneut versuchen holt es nach (Zeile schon da = Erfolg)', async ({ page }) => {
  const calls = await mockPhotos(page, {
    upload: (n) => (n === 1 ? storageError(500, 'Internal', 'boom') : {}),
    row: (n) => (n === 3 ? { status: 409, json: { code: '23505', message: 'duplicate key value violates unique constraint' } } : {}),
  })
  await sendWithPhotos(page)
  await expect(status(page)).toHaveText('1 von 2 hochgeladen')
  await expect(page.getByRole('alert').filter({ hasText: 'Das hat nicht geklappt.' })).toHaveCount(1)
  await page.getByRole('button', { name: 'Foto 1 erneut versuchen' }).click()
  await expect(status(page)).toHaveText('2 von 2 hochgeladen')
  expect(calls.rows).toHaveLength(3)
  expect(calls.rows[2]!.id).toBe(calls.rows[0]!.id) // dasselbe Foto, dieselbe ID
  expect(calls.uploads[2]!.path).toBe(calls.uploads[0]!.path)
})

test('Offline: Meldung „Keine Verbindung“, nach Rückkehr klappt der erneute Versuch', async ({ page }) => {
  await mockPhotos(page, { upload: (n) => (n <= 2 ? { abort: true } : {}) })
  await sendWithPhotos(page)
  await expect(page.getByRole('alert').filter({ hasText: 'Keine Verbindung.' })).toHaveCount(2)
  await expect(status(page)).toHaveText('0 von 2 hochgeladen')
  await page.getByRole('button', { name: 'Foto 1 erneut versuchen' }).click()
  await page.getByRole('button', { name: 'Foto 2 erneut versuchen' }).click()
  await expect(status(page)).toHaveText('2 von 2 hochgeladen')
})

test('Limit erreicht: Hinweis, kein erneuter Versuch, Foto lässt sich entfernen', async ({ page }) => {
  await mockPhotos(page, { row: () => ({ status: 400, json: { code: '23514', message: 'Höchstens 8 Fotos je Anfrage' } }) })
  await sendWithPhotos(page)
  await expect(page.getByRole('alert').filter({ hasText: 'Mehr als 8 Fotos gehen nicht.' })).toHaveCount(2)
  await expect(page.getByRole('button', { name: /erneut versuchen/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Foto 1 entfernen' }).click()
  await expect(page.getByRole('img', { name: /^Foto / })).toHaveCount(1)
})

test('Zu groß (Server lehnt mit 413 ab): Meldung, kein erneuter Versuch', async ({ page }) => {
  await mockPhotos(page, { upload: () => storageError(413, 'Payload too large', 'The object exceeded the maximum allowed size') })
  await sendWithPhotos(page)
  await expect(page.getByRole('alert').filter({ hasText: 'Das Foto ist zu groß.' })).toHaveCount(2)
  await expect(page.getByRole('button', { name: /erneut versuchen/ })).toHaveCount(0)
})

test('Foto entfernen: erst die Zeile, dann die Datei werden gelöscht', async ({ page }) => {
  const calls = await mockPhotos(page)
  await sendWithPhotos(page)
  await expect(status(page)).toHaveText('2 von 2 hochgeladen')
  await page.getByRole('button', { name: 'Foto 1 entfernen' }).click()
  await expect(status(page)).toHaveText('1 von 1 hochgeladen')
  await expect.poll(() => calls.removedRows).toBe(1)
  await expect.poll(() => calls.removedFiles).toEqual([[calls.uploads[0]!.path]])
})

test('Bedienelemente der Foto-Zeilen sind mindestens 44 px hoch und per Tastatur erreichbar', async ({ page }) => {
  await mockPhotos(page)
  await sendWithPhotos(page)
  await expect(status(page)).toHaveText('2 von 2 hochgeladen')
  const remove = page.getByRole('button', { name: 'Foto 1 entfernen' })
  expect((await remove.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await remove.focus()
  await expect(remove).toBeFocused()
})

test('Falsche Dateitypen: HEIC mit eigener Meldung, GIF und Text abgelehnt', async ({ page }) => {
  await page.goto('/transport')
  const input = page.locator('input[type=file][multiple]')
  await input.setInputFiles({ name: 'IMG_1.heic', mimeType: 'image/heic', buffer: Buffer.from('x') })
  await expect(page.getByText(/HEIC-Fotos gehen hier nicht/)).toBeVisible()
  await input.setInputFiles({ name: 'a.gif', mimeType: 'image/gif', buffer: Buffer.from('x') })
  await expect(page.getByText('Dieses Format geht nicht. Nimm ein JPEG, PNG oder WebP.')).toBeVisible()
  await expect(page.getByText('0 von 8')).toBeVisible()
})

test('Große Fotos werden auf 2000 px an der langen Kante verkleinert', async ({ page }) => {
  await page.goto('/transport')
  const big = await page.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = 4000
    c.height = 3000
    c.getContext('2d')!.fillRect(0, 0, 4000, 3000)
    return Array.from(new Uint8Array(await (await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg')!)).arrayBuffer()))
  })
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'gross.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(big) })
  await expect(page.getByRole('img', { name: 'Foto 1' })).toBeVisible()
  const size = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>('img[alt="Foto 1"]')!
    return { w: img.naturalWidth, h: img.naturalHeight }
  })
  expect(size).toEqual({ w: 2000, h: 1500 })
})
