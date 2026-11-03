import { expect, test, type Page } from '@playwright/test'
import { UUID, answer, price } from './anfrage-helpers'
import { collectErrors } from './console'
import { mockPhotos, prepareSummary, REQUEST, sendButton, sendWithPhotos, storageError } from './fotos-helpers'

// Foto-Uploads vor dem Absenden (Zusammenfassung): Staging {user}/{clientRef}/{id}.jpg, dann `quote` mit `photoIds`.
// Alle Aufrufe an Storage und `quote` sind abgefangen.
const failed = /status of [45]\d\d|ERR_FAILED/
const status = (page: Page) => page.getByRole('status').filter({ hasText: 'hochgeladen' })
const rejected = (code: string) => ({ status: 422, json: { error: code } })
const accepted = () => ({ json: answer(price(117500), { id: REQUEST }) })
const ids = (body: Record<string, unknown>) => body.photoIds as string[]

test('Fotos gehen vor dem Absenden ins Staging: Pfad {user}/{clientRef}/{id}.jpg, Typ JPEG, kein Standort in den Bytes, photoIds im Aufruf, Konsole sauber', async ({ page }) => {
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
  let uploadsAtQuote = -1
  const quoteCalls = await sendWithPhotos(page, {
    photo: Buffer.from(exif),
    reply: () => {
      uploadsAtQuote = calls.uploads.length
      return accepted()
    },
  })
  expect(uploadsAtQuote).toBe(2) // beide Fotos liegen, bevor `quote` aufgerufen wird
  expect(quoteCalls).toHaveLength(1)
  const body = quoteCalls[0]!.body
  expect(ids(body)).toHaveLength(2)
  for (const [i, id] of ids(body).entries()) {
    expect(id).toMatch(UUID) // Version 4, wie parse.ts verlangt
    expect(calls.uploads[i]!.path).toBe(`u-1/${body.clientRef}/${id}.jpg`) // Dateiname ist nie der Name der Datei auf dem Gerät
  }
  for (const u of calls.uploads) {
    const text = u.body.toString('latin1')
    expect(text).toContain('image/jpeg')
    expect(text).not.toContain('foto0')
    expect(text).not.toMatch(/GPS|Exif/)
  }
  // nach dem Absenden keine Foto-Bearbeitung in der App
  await expect(page.getByRole('button', { name: /Foto \d entfernen|erneut versuchen/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Fotos' })).toHaveCount(0)
  expect(errors.filter((e) => !failed.test(e))).toEqual([])
})

test('Hinweis vor dem Senden: Fotos lassen sich danach nicht mehr ändern; die Fotos sind zu sehen', async ({ page }) => {
  await mockPhotos(page)
  await prepareSummary(page)
  await expect(page.getByRole('heading', { name: 'Fotos' })).toBeVisible()
  await expect(page.getByRole('img', { name: /^Foto / })).toHaveCount(2)
  await expect(page.getByText('Nach dem Senden lassen sich die Fotos nicht mehr ändern.')).toBeVisible()
})

test('Hauptflow per Tastatur: Einwilligung mit Leertaste, Senden mit Enter, Fotos im Staging', async ({ page }) => {
  const calls = await mockPhotos(page)
  await prepareSummary(page)
  const checkbox = page.getByRole('checkbox')
  await checkbox.uncheck()
  await checkbox.focus()
  await page.keyboard.press('Space')
  await expect(checkbox).toBeChecked()
  await sendButton(page).focus()
  await expect(sendButton(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/entruempelung\/gesendet$/)
  expect(calls.uploads).toHaveLength(2)
})

test('Fortschritt: x von 2 hochgeladen, dann gesendet', async ({ page }) => {
  await mockPhotos(page, { upload: () => ({ delay: 800 }) })
  await sendWithPhotos(page, { sent: false })
  await expect(status(page)).toHaveText('0 von 2 hochgeladen')
  await expect(status(page)).toHaveText('1 von 2 hochgeladen')
  await expect(page).toHaveURL(/\/entruempelung\/gesendet$/)
})

test('Fehler beim Hochladen: Meldung, `quote` wird nicht aufgerufen, Erneut senden holt nach und sendet', async ({ page }) => {
  const calls = await mockPhotos(page, { upload: (n) => (n === 1 ? storageError(500, 'Internal', 'boom') : {}) })
  const quoteCalls = await sendWithPhotos(page, { sent: false })
  await expect(page.getByRole('alert').filter({ hasText: 'Die Fotos konnten nicht hochgeladen werden.' })).toBeVisible()
  expect(quoteCalls).toHaveLength(0)
  await sendButton(page).click()
  await expect(page).toHaveURL(/\/entruempelung\/gesendet$/)
  expect(calls.uploads).toHaveLength(3) // Foto 1 zweimal (erst Fehler), Foto 2 einmal
  expect(calls.uploads[1]!.path).toBe(calls.uploads[0]!.path) // dieselbe Datei, dieselbe ID
  expect(quoteCalls).toHaveLength(1)
  expect(ids(quoteCalls[0]!.body)).toHaveLength(2)
})

test('Maße der Zusammenfassung mit Fotos und Fehlerkarte: kein Überlauf, quadratische Vorschau, Senden-Knopf ≥ 44 px, Karte im Bild', async ({ page }) => {
  await mockPhotos(page, { upload: () => storageError(500, 'Internal', 'boom') })
  await sendWithPhotos(page, { sent: false })
  const alert = page.getByRole('alert').filter({ hasText: 'Die Fotos konnten nicht hochgeladen werden.' })
  await expect(alert).toBeVisible()
  const width = page.viewportSize()!.width
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
  for (const img of await page.getByRole('img', { name: /^Foto / }).all()) {
    const box = (await img.boundingBox())!
    expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
  }
  const card = (await alert.boundingBox())!
  expect(card.x).toBeGreaterThanOrEqual(0)
  expect(card.x + card.width).toBeLessThanOrEqual(width)
  expect((await sendButton(page).boundingBox())!.height).toBeGreaterThanOrEqual(44)
})

test.describe('Fehlertexte beim Hochladen', () => {
  for (const [name, reply, text] of [
    ['offline', { abort: true } as const, 'Keine Verbindung.'],
    ['403 (Kontingent oder Policy)', storageError(403, 'Unauthorized', 'new row violates row-level security policy'), 'Die Fotos lassen sich gerade nicht hochladen.'],
    ['413 (zu groß)', storageError(413, 'Payload too large', 'The object exceeded the maximum allowed size'), 'Ein Foto ist zu groß.'],
  ] as const) {
    test(name, async ({ page }) => {
      await mockPhotos(page, { upload: () => reply })
      const quoteCalls = await sendWithPhotos(page, { sent: false })
      await expect(page.getByRole('alert').filter({ hasText: text })).toBeVisible()
      await expect(sendButton(page)).toHaveText('Erneut senden')
      expect(quoteCalls).toHaveLength(0)
    })
  }
})

test.describe('422 der Fotos: neuer Name beim erneuten Senden, alte Staging-Dateien werden entfernt', () => {
  for (const [code, text] of [
    ['photo_missing', 'Ein Foto ist nicht angekommen.'],
    ['photo_expired', 'Die Fotos lagen zu lange bereit.'],
  ] as const) {
    test(code, async ({ page }) => {
      const calls = await mockPhotos(page)
      const quoteCalls = await sendWithPhotos(page, { reply: (n) => (n === 1 ? rejected(code) : accepted()), sent: false })
      await expect(page.getByRole('alert').filter({ hasText: text })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Angaben ändern' })).toHaveCount(0)
      const first = ids(quoteCalls[0]!.body)
      await expect.poll(() => calls.removedFiles).toEqual([first.map((id) => `u-1/${quoteCalls[0]!.body.clientRef}/${id}.jpg`)])
      await sendButton(page).click()
      await expect(page).toHaveURL(/\/entruempelung\/gesendet$/)
      expect(quoteCalls[1]!.body.clientRef).toBe(quoteCalls[0]!.body.clientRef) // dieselbe Anfrage
      const second = ids(quoteCalls[1]!.body)
      expect(second).toHaveLength(2)
      expect(second.filter((id) => first.includes(id))).toEqual([]) // neue Dateinamen
      expect(calls.uploads).toHaveLength(4)
    })
  }
})

test('422 too_many_photos: eigener Text, Weg zurück zu den Angaben', async ({ page }) => {
  await mockPhotos(page)
  await sendWithPhotos(page, { reply: () => rejected('too_many_photos'), sent: false })
  await expect(page.getByRole('alert').filter({ hasText: 'Mehr als 8 Fotos gehen nicht.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Angaben ändern' })).toBeVisible()
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
