import type { Page } from '@playwright/test'
import { makeSession } from './auth-helpers'
import { expect, test } from './backend'
import { collectErrors } from './console'
import { factor, freshCode, noSecret, openPartner, PNG_1PX, pgError, storageError, type DocRow, type OpenOpts } from './mfa-helpers'

/*
 * Partner-Portal 1b (s9i-5b): MFA-Einrichtung und Code-Abfrage (TOTP), Zugangsweg nach Firmenstatus, Dokumente.
 * Auth-MFA, `partner_members`, `partner_documents` und Storage sind gemockt (tests/e2e/mfa-helpers.ts); der Mock prüft den TOTP-Code wirklich.
 * Was der Server erzwingt (Typ, Größe, aal2, fremde Firma), belegen die RLS-Tests (tests/rls/partner-documents.test.ts); hier: die Oberfläche reagiert richtig.
 */

const noFee = (page: Page) => expect(page.locator('body')).not.toContainText(/Plattform|Provision|Gebühr|15 ?%/)
// Browser meldet jede 4xx-Antwort als console.error; die Mock-Fehler sind gewollt
const real = (errors: string[]) => errors.filter((e) => !e.startsWith('Failed to load resource'))

type Opts = OpenOpts
const open = openPartner

/** Zeile der Dokumentliste nach ihrer Bezeichnung (nicht die Option im Auswahlfeld, nicht der Erklärtext). */
const entry = (page: Page, label: string) => page.locator('span', { hasText: new RegExp(`^${label}$`) })

const code = (page: Page) => page.getByLabel('Code', { exact: true })
const confirm = (page: Page) => page.getByRole('button', { name: 'Bestätigen' })
const docsHeading = (page: Page) => page.getByRole('heading', { name: 'Dokumente', level: 2 })
const start = (page: Page) => page.getByRole('button', { name: 'Einrichtung starten' })

async function box(locator: ReturnType<Page['getByRole']>) {
  const b = await locator.boundingBox()
  expect(b).not.toBeNull()
  return b!
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

test('320 px: Bezirksraster mit fünf Spalten, jedes Feld mindestens 44 px, keine Überbreite (S9i5-3)', { tag: '@breit' }, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await open(page, { noFirm: true })
  await expect(page.getByRole('heading', { name: 'Firma registrieren' })).toBeVisible()
  for (const n of [1, 5, 23]) {
    const b = await box(page.getByRole('checkbox', { name: `Bezirk ${n}`, exact: true }))
    expect(b.width, `Bezirk ${n} breit`).toBeGreaterThanOrEqual(44)
    expect(b.height, `Bezirk ${n} hoch`).toBeGreaterThanOrEqual(44)
  }
  const first = await box(page.getByRole('checkbox', { name: 'Bezirk 1', exact: true }))
  const sixth = await box(page.getByRole('checkbox', { name: 'Bezirk 6', exact: true }))
  expect(sixth.y, 'Bezirk 6 steht in der zweiten Zeile').toBeGreaterThan(first.y + 40)
  await noOverflow(page)
})

test.describe('Einrichtung', { tag: '@breit' }, () => {
  test('ohne Faktor: Karte „In Prüfung“ und Einrichtung; vor dem Klick entsteht kein Faktor; keine Dokumente', async ({ page }) => {
    const errors = collectErrors(page)
    const { mfa } = await open(page)
    await expect(page.getByRole('heading', { name: 'Transporte Huber GmbH' })).toBeVisible()
    await expect(page.getByText('In Prüfung', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Sicherheitscode einrichten' })).toBeVisible()
    await expect(start(page)).toBeVisible()
    await expect(docsHeading(page)).toHaveCount(0)
    expect(mfa.log).toEqual([])
    await noFee(page)
    expect(real(errors)).toEqual([])
  })

  test('QR und Schlüssel erscheinen, falscher Code wird abgelehnt, richtiger führt zu den Dokumenten und gilt nach dem Neuladen weiter', async ({ page }) => {
    const errors = collectErrors(page)
    const seen: string[] = []
    page.on('console', (m) => seen.push(m.text()))
    const { mfa } = await open(page)
    await start(page).click()
    const qr = page.getByRole('img', { name: /QR-Code/ })
    await expect(qr).toBeVisible()
    expect(await qr.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
    // das Bild lädt wirklich (ein kaputtes Bild mit fester Größe wäre auch „sichtbar“)
    expect(await qr.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    const secret = mfa.lastSecret
    expect(secret).toMatch(/^[A-Z2-7]{20,}$/)
    await expect(page.getByText(secret, { exact: true })).toBeVisible()
    expect(mfa.log).toEqual(['enroll'])

    // falscher Code: Fehlertext in Worten, kein Rohtext, Einrichtung bleibt
    const right = await freshCode(secret)
    const wrong = right === '000000' ? '111111' : '000000'
    await code(page).fill(wrong)
    await confirm(page).click()
    await expect(page.getByRole('alert')).toContainText('Der Code stimmt nicht')
    await expect(page.locator('body')).not.toContainText('RAW_SUPABASE_TEXT')
    await expect(docsHeading(page)).toHaveCount(0)
    expect(mfa.log.at(-1)).toMatch(/^verify:.*:fail$/)

    // richtiger Code (Leerzeichen werden toleriert)
    await code(page).fill(`${right.slice(0, 3)} ${right.slice(3)}`)
    await confirm(page).click()
    await expect(docsHeading(page)).toBeVisible()
    expect(mfa.factors.map((f) => f.status)).toEqual(['verified'])
    await expect(page.getByRole('img', { name: /QR-Code/ })).toHaveCount(0)
    await expect(page.getByText(secret)).toHaveCount(0)
    await noSecret(page, secret)

    // aal2 steckt im Token: nach dem Neuladen keine erneute Abfrage
    await page.reload()
    await expect(docsHeading(page)).toBeVisible()
    await expect(code(page)).toHaveCount(0)
    expect(mfa.log.filter((l) => l === 'enroll')).toHaveLength(1)
    expect(seen.join('\n'), 'der Schlüssel darf nie in die Konsole').not.toContain(secret)
    expect(real(errors)).toEqual([])
  })

  test('abgebrochene Einrichtung: der liegengebliebene Faktor wird ersetzt, der neue Versuch klappt (auch nach Neuladen mitten drin)', async ({ page }) => {
    const { mfa } = await open(page, { factors: [factor('old', 'unverified')] })
    await start(page).click()
    await expect(page.getByRole('img', { name: /QR-Code/ })).toBeVisible()
    expect(mfa.log.slice(0, 2)).toEqual(['unenroll:old', 'enroll'])
    // Seite verlassen, ohne zu bestätigen, dann noch einmal von vorn
    await page.reload()
    await start(page).click()
    await expect(page.getByRole('img', { name: /QR-Code/ })).toBeVisible()
    expect(mfa.log.filter((l) => l === 'enroll')).toHaveLength(2)
    expect(mfa.factors).toHaveLength(1)
    await code(page).fill(await freshCode(mfa.lastSecret))
    await confirm(page).click()
    await expect(docsHeading(page)).toBeVisible()
  })

  test('Zu viele Versuche und kein Netz bekommen eigene Texte; der Code bleibt im Feld', async ({ page }) => {
    const { mfa } = await open(page)
    await start(page).click()
    await expect(page.getByRole('img', { name: /QR-Code/ })).toBeVisible()
    await code(page).fill('123456')
    mfa.verifyStatus.push(429)
    await confirm(page).click()
    await expect(page.getByRole('alert')).toContainText('Zu viele Versuche')
    await expect(code(page)).toHaveValue('123456')
    await code(page).fill('12345')
    await confirm(page).click()
    await expect(page.getByRole('alert')).toContainText('sechs Ziffern')
    await page.route('**/auth/v1/factors/**', (r) => r.abort('failed'))
    await code(page).fill('123456')
    await confirm(page).click()
    await expect(page.getByRole('alert')).toContainText('Keine Verbindung')
  })

  test('Tastatur: Einrichtung ohne Maus (Tab zum Knopf, Code tippen, Enter)', async ({ page }) => {
    const { mfa } = await open(page)
    await start(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('img', { name: /QR-Code/ })).toBeVisible()
    await code(page).focus()
    await page.keyboard.type(await freshCode(mfa.lastSecret))
    await page.keyboard.press('Enter')
    await expect(docsHeading(page)).toBeVisible()
  })
})

test.describe('Anmeldung mit Faktor', { tag: '@breit' }, () => {
  test('aal1 mit verifiziertem Faktor: Code-Abfrage statt Einrichtung; falscher Code, dann richtiger Code führt zu den Dokumenten', async ({ page }) => {
    const errors = collectErrors(page)
    const f = factor('v1', 'verified')
    const { mfa } = await open(page, { factors: [f] })
    await expect(page.getByRole('heading', { name: 'Code eingeben' })).toBeVisible()
    await expect(start(page)).toHaveCount(0)
    await expect(docsHeading(page)).toHaveCount(0)
    // Geräteverlust: Hinweis mit Weg zu uns (Impressum), keine App-Funktion zum Zurücksetzen
    const help = page.getByRole('link', { name: /Impressum/ })
    await expect(help).toBeVisible()
    await expect(page.getByText(/Gerät verloren/)).toBeVisible()
    await expect(page.getByRole('button', { name: /zurücksetzen|entfernen|löschen/i })).toHaveCount(0)

    const right = await freshCode(f.secret)
    await code(page).fill(right === '000000' ? '111111' : '000000')
    await confirm(page).click()
    await expect(page.getByRole('alert')).toContainText('Der Code stimmt nicht')
    await expect(docsHeading(page)).toHaveCount(0)

    await code(page).fill(right)
    await confirm(page).click()
    await expect(docsHeading(page)).toBeVisible()
    expect(mfa.log).not.toContain('enroll')
    expect(mfa.log.filter((l) => l.startsWith('challenge'))).toHaveLength(2)
    expect(mfa.log.some((l) => l.startsWith('unenroll'))).toBe(false)
    await noFee(page)
    expect(real(errors)).toEqual([])
  })

  test('verifizierter Faktor bleibt unangetastet, auch wenn ein unverifizierter daneben liegt', async ({ page }) => {
    const { mfa } = await open(page, { factors: [factor('v1', 'verified'), factor('u1', 'unverified', 'Anderes Gerät')] })
    await expect(page.getByRole('heading', { name: 'Code eingeben' })).toBeVisible()
    expect(mfa.log).toEqual([])
    expect(mfa.factors.map((f) => f.id)).toEqual(['v1', 'u1'])
  })

  test('Faktor des anderen Geräts bei der Einrichtung (insufficient_aal): Hinweis statt Absturz', async ({ page }) => {
    // Konto hat unterdessen einen Faktor bekommen: Sitzung zeigt noch „keiner“, der Server verweigert den Enroll
    const { mfa } = await open(page)
    mfa.factors.push(factor('v9', 'verified', 'Zweites Gerät'))
    await start(page).click()
    await expect(page.getByRole('heading', { name: 'Code eingeben' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Authenticator-App')
    expect(mfa.log).not.toContain('unenroll:v9')
  })

  test('Tastatur: Code tippen und mit Enter bestätigen, Touch-Ziele und Breite', async ({ page }) => {
    const f = factor('v1', 'verified')
    await open(page, { factors: [f] })
    await expect(code(page)).toBeVisible()
    expect((await box(code(page))).height).toBeGreaterThanOrEqual(44)
    expect((await box(confirm(page))).height).toBeGreaterThanOrEqual(44)
    await noOverflow(page)
    await code(page).focus()
    await page.keyboard.type(await freshCode(f.secret))
    await page.keyboard.press('Enter')
    await expect(docsHeading(page)).toBeVisible()
  })

  test('Codefeld: Ziffern-Tastatur und Autofill für Einmalcodes', async ({ page }) => {
    await open(page, { factors: [factor('v1', 'verified')] })
    await expect(code(page)).toHaveAttribute('inputmode', 'numeric')
    await expect(code(page)).toHaveAttribute('autocomplete', 'one-time-code')
  })
})

test.describe('Zugang je Firmenstatus', { tag: '@breit' }, () => {
  for (const status of ['rejected', 'suspended'] as const) {
    test(`${status} mit aal2: nur die Statuskarte, keine Abfrage, keine Dokumente`, async ({ page }) => {
      const f = factor('v1', 'verified')
      const { mfa } = await open(page, { status, factors: [f], aal: 'aal2' })
      await expect(page.getByRole('heading', { name: 'Transporte Huber GmbH' })).toBeVisible()
      await expect(page.getByText(status === 'rejected' ? 'Abgelehnt' : 'Gesperrt', { exact: true })).toBeVisible()
      await expect(docsHeading(page)).toHaveCount(0)
      await expect(code(page)).toHaveCount(0)
      await expect(start(page)).toHaveCount(0)
      expect(mfa.log).toEqual([])
    })
  }

  test('rejected ohne Faktor (aal1): ebenfalls nur die Karte, keine Einrichtung', async ({ page }) => {
    await open(page, { status: 'rejected' })
    await expect(page.getByText('Abgelehnt', { exact: true })).toBeVisible()
    await expect(page.getByText('Unterlagen unvollständig')).toBeVisible()
    await expect(start(page)).toHaveCount(0)
    await expect(docsHeading(page)).toHaveCount(0)
  })

  for (const status of ['pending', 'active', 'payment_hold'] as const) {
    test(`${status} mit aal2: Karte und Dokumente`, async ({ page }) => {
      await open(page, { status, factors: [factor('v1', 'verified')], aal: 'aal2' })
      await expect(page.getByRole('heading', { name: 'Transporte Huber GmbH' })).toBeVisible()
      await expect(docsHeading(page)).toBeVisible()
    })
  }

  test('pending mit aal1 und Faktor: Karte bleibt sichtbar, Dokumente erst nach dem Code', async ({ page }) => {
    await open(page, { factors: [factor('v1', 'verified')] })
    await expect(page.getByText('In Prüfung', { exact: true })).toBeVisible()
    await expect(docsHeading(page)).toHaveCount(0)
  })
})

test.describe('Dokumente', { tag: '@breit' }, () => {
  const ready = (o: Opts = {}) => ({ factors: [factor('v1', 'verified')], aal: 'aal2' as const, ...o })
  const row = (id: string, kind: string, day = '01'): DocRow => ({ id, partner_id: 'p-1', kind, uploaded_at: `2026-11-${day}T10:00:00Z` })
  const pick = async (page: Page, kind: string, file: { name: string; mimeType: string; buffer: Buffer }) => {
    await page.getByLabel('Art', { exact: true }).selectOption(kind)
    await page.getByLabel('Datei', { exact: true }).setInputFiles(file)
  }
  const send = (page: Page) => page.getByRole('button', { name: 'Hochladen', exact: true })
  const pdf = (size = 20) => ({ name: 'gewerbe.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(size)]) })

  test('leere Liste; Hochladen bleibt gesperrt, bis eine Datei gewählt ist; Hinweis auf Grenzen', async ({ page }) => {
    const errors = collectErrors(page)
    await open(page, ready())
    await expect(page.getByText('Noch keine Dokumente.')).toBeVisible()
    await expect(send(page)).toBeDisabled()
    await expect(page.getByText(/höchstens 5 Dokumente/)).toBeVisible()
    await expect(page.getByText(/nicht selbst löschen/)).toBeVisible()
    await noFee(page)
    expect(real(errors)).toEqual([])
  })

  test('PDF hochladen: Zeile mit id und kind, dann Datei auf {firma}/{id} mit application/pdf, Liste zeigt „Hochgeladen“', async ({ page }) => {
    const errors = collectErrors(page)
    const { docs } = await open(page, ready())
    await pick(page, 'trade_license', pdf())
    await expect(send(page)).toBeEnabled()
    await send(page).click()
    await expect(page.getByRole('status').filter({ hasText: 'Dokument hochgeladen' })).toBeVisible()
    expect(docs.inserts).toHaveLength(1)
    expect(Object.keys(docs.inserts[0]!).sort()).toEqual(['id', 'kind'])
    expect(docs.inserts[0]!.kind).toBe('trade_license')
    const id = String(docs.inserts[0]!.id)
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(docs.uploads).toHaveLength(1)
    expect(docs.uploads[0]).toMatchObject({ path: `p-1/${id}`, contentType: 'application/pdf' })
    expect(docs.uploads[0]!.head).toEqual([0x25, 0x50, 0x44, 0x46]) // %PDF
    await expect(entry(page, 'Gewerbeberechtigung')).toBeVisible()
    await expect(page.getByText(/Hochgeladen am/)).toBeVisible()
    await expect(page.getByText('Datei fehlt')).toHaveCount(0)
    await noFee(page)
    expect(real(errors)).toEqual([])
  })

  test('Bild: wird als JPEG hochgeladen (EXIF und Original fallen weg), nie als PNG', async ({ page }) => {
    const { docs } = await open(page, ready())
    await pick(page, 'company_register', { name: 'auszug.png', mimeType: 'image/png', buffer: PNG_1PX })
    await send(page).click()
    await expect(entry(page, 'Firmenbuchauszug')).toBeVisible()
    expect(docs.uploads).toHaveLength(1)
    expect(docs.uploads[0]!.contentType).toBe('image/jpeg')
    expect(docs.uploads[0]!.head.slice(0, 3)).toEqual([0xff, 0xd8, 0xff])
  })

  test('unerlaubter Typ und zu große Datei: Text in Worten, es entsteht weder Zeile noch Upload', async ({ page }) => {
    const { docs } = await open(page, ready())
    await pick(page, 'other', { name: 'brief.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') })
    await send(page).click()
    await expect(page.getByRole('alert')).toContainText('PDF oder ein Foto')
    await pick(page, 'other', { name: 'foto.heic', mimeType: 'image/heic', buffer: Buffer.from('x') })
    await send(page).click()
    await expect(page.getByRole('alert')).toContainText('HEIC')
    await pick(page, 'other', { name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('kein pdf') })
    await send(page).click()
    await expect(page.getByRole('alert')).toContainText('PDF oder ein Foto')
    await pick(page, 'other', { name: 'gross.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(10 * 1024 * 1024)]) })
    await send(page).click()
    await expect(page.getByRole('alert')).toContainText('10 MB')
    expect(docs.inserts).toEqual([])
    expect(docs.uploads).toEqual([])
  })

  test('Server lehnt den Upload ab (415): die Zeile bleibt, „Datei fehlt“ mit „Erneut hochladen“ auf dieselbe id, ohne neue Zeile', async ({ page }) => {
    const { docs } = await open(page, ready())
    docs.uploadAnswers.push(storageError(415, 'mime type application/pdf is not supported'))
    await pick(page, 'trade_license', pdf())
    await send(page).click()
    await expect(page.getByRole('alert')).toContainText('PDF oder ein Foto')
    await expect(page.getByRole('alert')).toContainText('Erneut hochladen')
    await expect(page.getByText('Datei fehlt')).toBeVisible()
    const id = String(docs.inserts[0]!.id)
    expect(docs.files.size).toBe(0)
    // Die Auswahl ist leer: ein zweiter Klick auf „Hochladen“ würde einen weiteren (unlöschbaren) Platz verbrauchen
    await expect(send(page)).toBeDisabled()
    expect(docs.inserts).toHaveLength(1)

    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /Datei erneut hochladen: Gewerbeberechtigung/ }).click()
    await (await chooser).setFiles(pdf(40))
    await expect(page.getByText(/Hochgeladen am/)).toBeVisible()
    await expect(page.getByText('Datei fehlt')).toHaveCount(0)
    expect(docs.inserts).toHaveLength(1)
    expect(docs.uploads.map((u) => u.path)).toEqual([`p-1/${id}`, `p-1/${id}`])
  })

  test('verwaiste Zeile aus einer früheren Sitzung: „Datei fehlt“ ohne Datum der Datei, Erneut-Hochladen klappt per Tastatur', async ({ page }) => {
    const { docs } = await open(page, ready({ rows: [row('d-1', 'other', '05'), row('d-2', 'trade_license', '06')], files: ['p-1/d-2'] }))
    await expect(page.getByText('Datei fehlt')).toHaveCount(1)
    await expect(page.getByText(/Hochgeladen am 06\.11\.2026/)).toBeVisible()
    const retry = page.getByRole('button', { name: /Datei erneut hochladen: Sonstiges/ })
    await retry.focus()
    const chooser = page.waitForEvent('filechooser')
    await page.keyboard.press('Enter')
    await (await chooser).setFiles(pdf())
    await expect(page.getByText('Datei fehlt')).toHaveCount(0)
    expect(docs.uploads.map((u) => u.path)).toEqual(['p-1/d-1'])
    expect(docs.inserts).toEqual([])
  })

  test('fünf Dokumente: Hochladen gesperrt mit Erklärung', async ({ page }) => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((x, i) => row(`d-${x}`, 'other', `0${i + 1}`))
    await open(page, ready({ rows, files: rows.map((r) => `p-1/${r.id}`) }))
    await expect(page.getByText(/Maximum erreicht/)).toBeVisible()
    await expect(page.getByLabel('Datei', { exact: true })).toBeDisabled()
    await expect(send(page)).toBeDisabled()
  })

  test('Server meldet limit_reached und partner_not_active: eigene Texte, kein Upload', async ({ page }) => {
    const { docs } = await open(page, ready())
    docs.insertAnswers.push(pgError(400, 'P0001', 'limit_reached'), pgError(400, 'P0001', 'partner_not_active'))
    await pick(page, 'other', pdf())
    await send(page).click()
    await expect(page.getByRole('alert')).toContainText('höchstens 5')
    await send(page).click()
    await expect(page.getByRole('alert')).toContainText('nicht mehr freigeschaltet')
    expect(docs.uploads).toEqual([])
  })

  test('42501 trotz aal2: allgemeiner Fehler, keine Schleife zurück in die Abfrage', async ({ page }) => {
    const { docs, mfa } = await open(page, ready())
    docs.insertAnswers.push(pgError(403, '42501', 'not_partner_member'))
    await pick(page, 'other', pdf())
    await send(page).click()
    await expect(page.getByRole('alert')).toContainText('Das hat nicht geklappt')
    await expect(docsHeading(page)).toBeVisible()
    await expect(code(page)).toHaveCount(0)
    expect(mfa.log).toEqual([])
  })

  test('kein Netz beim Hochladen: Text „Keine Verbindung“, Zeile bleibt zum Wiederholen', async ({ page }) => {
    const { docs } = await open(page, ready())
    await page.route('**/storage/v1/object/partner-documents/**', (r) => (r.request().method() === 'OPTIONS' ? r.fallback() : r.abort('failed')))
    await pick(page, 'other', pdf())
    await send(page).click()
    await expect(page.getByRole('alert')).toContainText('Keine Verbindung')
    expect(docs.inserts).toHaveLength(1)
    // wie beim abgelehnten Upload: nur noch der Weg über „Erneut hochladen“, keine zweite Zeile
    await expect(send(page)).toBeDisabled()
    await expect(page.getByText('Datei fehlt')).toBeVisible()
  })

  test('Netz weg beim Hochladen und beim Neuladen der Liste: Formular gesperrt, keine zweite Zeile, nach „Erneut versuchen“ lädt „Erneut hochladen“ auf dieselbe id', async ({ page }) => {
    const { docs } = await open(page, ready())
    let blockList = false
    await page.route('**/rest/v1/partner_documents**', (r) => (blockList && r.request().method() === 'GET' ? r.abort('failed') : r.fallback()))
    await page.route('**/storage/v1/object/partner-documents/**', (r) => (blockList && r.request().method() !== 'OPTIONS' ? r.abort('failed') : r.fallback()))
    await page.route('**/storage/v1/object/list/**', (r) => (blockList ? r.abort('failed') : r.fallback()))
    await pick(page, 'trade_license', pdf())
    blockList = true
    await send(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Erneut hochladen' })).toBeVisible()
    // supabase-js wiederholt GET-Abrufe bei Netzfehlern mit Pausen (rund 7 s), erst danach steht der Fehlerzustand
    await expect(page.getByText('konnten nicht geladen werden')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByLabel('Datei', { exact: true })).toBeDisabled()
    await expect(page.getByLabel('Art', { exact: true })).toBeDisabled()
    await expect(send(page)).toBeDisabled()
    expect(docs.inserts).toHaveLength(1)
    blockList = false
    await page.getByRole('button', { name: 'Erneut versuchen' }).click()
    await expect(page.getByText('Datei fehlt')).toBeVisible()
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: /Datei erneut hochladen: Gewerbeberechtigung/ }).click()
    await (await chooser).setFiles(pdf())
    await expect(page.getByText(/Hochgeladen am/)).toBeVisible()
    expect(docs.inserts).toHaveLength(1)
    expect(docs.uploads.map((u) => u.path).every((p) => p === `p-1/${String(docs.inserts[0]!.id)}`)).toBe(true)
  })

  test('verweigert und die Sitzung steht nur noch auf aal1: zurück zur Code-Abfrage, keine Einrichtung', async ({ page }) => {
    const { docs, mfa } = await open(page, ready())
    // gespeichertes Token auf aal1 setzen (abgelaufene Stufe), die Seite liest es beim nächsten Aufruf
    const aal1 = makeSession('aal1').access_token
    await page.evaluate((token) => {
      const key = Object.keys(localStorage).find((k) => /auth-token$/.test(k))!
      const s = JSON.parse(localStorage.getItem(key)!)
      s.access_token = token
      localStorage.setItem(key, JSON.stringify(s))
    }, aal1)
    docs.insertAnswers.push(pgError(403, '42501', 'not_partner_member'))
    await pick(page, 'other', pdf())
    await send(page).click()
    await expect(page.getByRole('heading', { name: 'Code eingeben' })).toBeVisible()
    await expect(docsHeading(page)).toHaveCount(0)
    expect(mfa.log).not.toContain('enroll')
  })

  test('Maße: Touch-Ziele mindestens 44 px, keine Überbreite, Konsole leer, Tastatur bis zum Absenden', async ({ page }) => {
    const errors = collectErrors(page)
    const { docs } = await open(page, ready({ rows: [row('d-1', 'other')] }))
    for (const l of [page.getByLabel('Art', { exact: true }), page.getByRole('button', { name: /Datei erneut hochladen/ }), send(page)]) {
      expect((await box(l)).height).toBeGreaterThanOrEqual(44)
    }
    await noOverflow(page)
    await page.getByLabel('Art', { exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Datei', { exact: true })).toBeFocused()
    await page.getByLabel('Datei', { exact: true }).setInputFiles(pdf())
    await send(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: 'Dokument hochgeladen' })).toBeVisible()
    expect(docs.uploads).toHaveLength(1)
    expect(real(errors)).toEqual([])
  })
})
