import type { Page } from '@playwright/test'
import { expect, test } from './backend'
import { collectErrors } from './console'
import { A2, CH1, change, job, openJobs, proposed, RC1, RQ1, RQ2, type ChangeRow, type JobsState } from './jobs-helpers'
import { PNG_1PX } from './mfa-helpers'

/*
 * Partner-Portal 3a (s9i-7a): Nachtrag vorschlagen. Backend gemockt (tests/e2e/jobs-helpers.ts: `my_job_changes`, `change-propose`, `photo-receipt`,
 * `withdraw_change`). Was der Server erzwingt (Tor, Festpreis, erhöhend, Belege, Rechnen mit der gebuchten Version, Rechte), belegen
 * tests/rls/change-orders.test.ts, tests/rls/partner-my-job-changes.test.ts und tests/unit/change-handlers.test.ts. Hier: Die Oberfläche zeigt den Betrag
 * des Servers, sendet genau ihn, legt nie zweimal an und ordnet jede Antwort einem eigenen Text zu.
 */

const real = (errors: string[]) => errors.filter((e) => !e.startsWith('Failed to load resource'))
const noFee = (page: Page) => expect(page.locator('body')).not.toContainText(/Plattform|Provision|Gebühr|15 ?%/)
const card = (page: Page, n = 0) => page.getByRole('article').nth(n)
const dialog = (page: Page) => page.getByRole('dialog')
const propose = (page: Page) => card(page).getByRole('button', { name: 'Nachtrag vorschlagen' })
const open = (page: Page, init: Partial<JobsState> = {}) => openJobs(page, { myJobs: [job()], changes: [change()], ...init })
const sends = (jobs: JobsState) => jobs.proposals.filter((p) => p.preview !== true)
const previews = (jobs: JobsState) => jobs.proposals.filter((p) => p.preview === true)
const A3 = '11111111-1111-4111-8111-111111111113'
const A4 = '11111111-1111-4111-8111-111111111114'
const RQ3 = '22222222-2222-4222-8222-222222222223'
const RQ4 = '22222222-2222-4222-8222-222222222224'
const photo = { name: 'beleg.png', mimeType: 'image/png', buffer: PNG_1PX }

/** Höhe des offenen Sheets und seines Inhalts (nur Maße, per getBoundingClientRect) */
const measureSheet = (page: Page) =>
  dialog(page).evaluate((d) => {
    const sheet = d.querySelector('div.fixed') as HTMLElement
    const content = sheet.querySelector('div.overflow-y-auto > div') as HTMLElement
    return { sheet: sheet.getBoundingClientRect().height, content: content.getBoundingClientRect().height, view: window.innerHeight }
  })

/** Stunden auf 5 ändern und den Betrag prüfen */
async function checkHours(page: Page, hours = '5') {
  await propose(page).click()
  await dialog(page).getByLabel('Stunden').fill(hours)
  await dialog(page).getByRole('button', { name: 'Betrag prüfen' }).click()
}

test('Hauptweg: Werte ändern, Betrag vom Server ansehen, Beleg wählen, senden; gesendet wird genau der gezeigte Betrag', async ({ page }) => {
  const errors = collectErrors(page)
  const { jobs } = await open(page)
  await expect(card(page)).toContainText('Umzug, Bezirk 3')
  await checkHours(page)
  // Vorschau: nur geänderte Felder, kein Betrag vom Gerät, nichts angelegt, keine Fotos hochgeladen
  await expect(dialog(page)).toContainText('Neuer Gesamtpreis')
  await expect(dialog(page)).toContainText('689,61 €')
  await expect(dialog(page)).toContainText('120,39 €')
  await expect(dialog(page)).toContainText('810,00 €')
  expect(previews(jobs)).toEqual([{ requestId: RQ1, changes: { hours: 5 }, preview: true }])
  expect(sends(jobs), 'die Vorschau legt nichts an').toEqual([])
  expect(jobs.receipts).toEqual([])
  const send = dialog(page).getByRole('button', { name: /Nachtrag über 810,00 € senden/ })
  await expect(send, 'ohne Foto kein Senden').toBeDisabled()
  await dialog(page).getByLabel('Belegfoto hinzufügen').setInputFiles(photo)
  await expect(dialog(page)).toContainText('beleg.png')
  await expect(dialog(page)).toContainText('1 Foto wird beim Senden hochgeladen')
  await expect(dialog(page), 'ein gewähltes Foto widerspricht „Noch kein Foto“').not.toContainText('Noch kein Foto')
  await expect(send).toBeEnabled()
  await send.click()
  await expect(dialog(page)).toHaveCount(0)
  expect(jobs.receipts).toHaveLength(1)
  expect(jobs.receipts[0]).toMatchObject({ request: RQ1, type: 'image/jpeg' })
  expect(jobs.receipts[0]?.bytes).toBeGreaterThan(100)
  expect(sends(jobs)).toHaveLength(1)
  expect(sends(jobs)[0]).toMatchObject({ requestId: RQ1, changes: { hours: 5 }, shownTotalCents: 81000 })
  expect(Object.keys(sends(jobs)[0] ?? {}).sort(), 'kein Betragsfeld außer der Bestätigung').toEqual(['changes', 'photoIds', 'requestId', 'shownTotalCents'])
  expect((sends(jobs)[0]?.photoIds as string[]).length).toBe(1)
  await expect(page.getByRole('status').filter({ hasText: 'Dein Nachtrag liegt beim Kunden' })).toBeVisible()
  await expect(card(page)).toContainText('neuer Gesamtpreis 810,00 €')
  await expect(card(page).getByRole('button', { name: 'Nachtrag zurückziehen' })).toBeVisible()
  await expect(propose(page), 'solange einer offen ist, gibt es keinen zweiten').toHaveCount(0)
  await noFee(page)
  expect(real(errors)).toEqual([])
})

test('Doppelklick auf Senden: ein Foto, ein Nachtrag', async ({ page }) => {
  const { jobs } = await open(page)
  await checkHours(page)
  await dialog(page).getByLabel('Belegfoto hinzufügen').setInputFiles(photo)
  await dialog(page).getByRole('button', { name: /Nachtrag über 810,00 € senden/ }).dblclick()
  await expect(dialog(page)).toHaveCount(0)
  expect(jobs.receipts).toHaveLength(1)
  expect(sends(jobs)).toHaveLength(1)
})

test('Tastatur: Hauptweg nur mit Tastatur', async ({ page }) => {
  const { jobs } = await open(page)
  await propose(page).focus()
  await page.keyboard.press('Enter')
  await dialog(page).getByLabel('Stunden').focus()
  await page.keyboard.press('Control+A')
  await page.keyboard.type('5')
  await dialog(page).getByRole('button', { name: 'Betrag prüfen' }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toContainText('810,00 €')
  await dialog(page).getByLabel('Belegfoto hinzufügen').setInputFiles(photo)
  await dialog(page).getByRole('button', { name: /Nachtrag über 810,00 € senden/ }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toHaveCount(0)
  expect(sends(jobs)).toHaveLength(1)
  await expect(card(page).getByRole('button', { name: 'Nachtrag zurückziehen' })).toBeVisible()
})

test('Kein Nachtrag möglich: Festangebot, offener Nachtrag, Entrümpelung, keine Grundlage, beendet', async ({ page }) => {
  await open(page, {
    myJobs: [job(), job({ assignment_id: A2, request_id: RQ2 }), job({ assignment_id: A3, request_id: RQ3, service: 'clearance' }), job({ assignment_id: A4, request_id: RQ4 })],
    changes: [
      change({ source: 'partner_offer' }),
      proposed('proposed', { request_id: RQ2 }),
      change({ request_id: RQ3, service: 'clearance', inputs: { object: 'flat', area: 30, fill: 'normal', lift: false, floor: 1, special: false, assembly: null } }),
    ],
  })
  await expect(page.getByRole('article')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Nachtrag vorschlagen' }), 'Festangebot, offener Nachtrag, Entrümpelung, ohne Grundlage').toHaveCount(0)
})

test('Läuft und beendet: Knopf nur bei laufenden Aufträgen (angenommen, läuft)', async ({ page }) => {
  await open(page, {
    myJobs: [job({ status: 'in_progress' }), job({ assignment_id: A2, request_id: RQ2, status: 'completed', ended_at: '2026-12-02T12:00:00+00:00', ended_reason: 'completed' })],
    changes: [change(), change({ request_id: RQ2 })],
  })
  await expect(card(page, 0).getByRole('button', { name: 'Nachtrag vorschlagen' })).toBeVisible()
  await expect(card(page, 1).getByRole('button', { name: 'Nachtrag vorschlagen' })).toHaveCount(0)
})

const STATES: [NonNullable<ChangeRow['change_status']>, string][] = [
  ['declined', 'Der Kunde hat deinen Nachtrag abgelehnt. Es gilt der bisherige Preis.'],
  ['expired', 'Dein Nachtrag ist abgelaufen. Es gilt der bisherige Preis.'],
  ['accepted', 'Der Kunde hat deinen Nachtrag angenommen.'],
  ['withdrawn', 'Du hast deinen Nachtrag zurückgezogen.'],
]
for (const [status, text] of STATES) {
  test(`Zustand des letzten Nachtrags „${status}“: eigener Text, danach darf ein neuer folgen`, async ({ page }) => {
    await open(page, { changes: [proposed(status)] })
    await expect(card(page)).toContainText(text)
    await expect(propose(page)).toBeVisible()
  })
}

test('Betrag ändert sich: 409 → neuer Betrag aus der Vorschau, neu bestätigen; das Foto wird nicht zweimal hochgeladen', async ({ page }) => {
  const { jobs } = await open(page, {
    previewAnswers: [
      { status: 200, json: { totalCents: 81000, baseCents: 68961 } },
      { status: 200, json: { totalCents: 85000, baseCents: 68961 } },
    ],
    proposeAnswers: [{ status: 409, json: { error: 'amount_changed' } }],
  })
  await checkHours(page)
  await dialog(page).getByLabel('Belegfoto hinzufügen').setInputFiles(photo)
  await dialog(page).getByRole('button', { name: /Nachtrag über 810,00 € senden/ }).click()
  await expect(dialog(page)).toContainText('Der Preis hat sich geändert')
  await expect(dialog(page)).toContainText('850,00 €')
  const again = dialog(page).getByRole('button', { name: /Nachtrag über 850,00 € senden/ })
  await expect(again).toBeEnabled()
  expect(sends(jobs), 'nach 409 wird nie automatisch neu gesendet').toHaveLength(1)
  jobs.serverTotal = 85000
  await again.click()
  await expect(dialog(page)).toHaveCount(0)
  expect(jobs.receipts, 'das Foto liegt schon beim Server').toHaveLength(1)
  expect(sends(jobs)).toHaveLength(2)
  expect(sends(jobs)[1]).toMatchObject({ shownTotalCents: 85000 })
  expect(sends(jobs)[1]?.photoIds).toEqual(sends(jobs)[0]?.photoIds)
})

test('Fehler der Vorschau: nicht erhöhend, ungültige Werte, kein Nachtrag möglich, Netz; jeder mit eigenem Text', async ({ page }) => {
  const { jobs } = await open(page, {
    previewAnswers: [
      { status: 409, json: { error: 'change_not_increasing' } },
      { status: 422, json: { error: 'invalid_input' } },
      { status: 500, json: { error: 'internal' } },
    ],
  })
  await checkHours(page, '2')
  await expect(dialog(page)).toContainText('Der neue Preis ist nicht höher als der bisherige')
  await dialog(page).getByLabel('Stunden').fill('4')
  await dialog(page).getByRole('button', { name: 'Betrag prüfen' }).click()
  await expect(dialog(page)).toContainText('Prüfe deine Angaben')
  await dialog(page).getByRole('button', { name: 'Betrag prüfen' }).click()
  await expect(dialog(page)).toContainText('Das hat nicht geklappt')
  await expect(dialog(page)).not.toContainText(/internal|invalid_input|change_not_increasing/)
  expect(sends(jobs)).toEqual([])
})

test('Eingaben: ohne Änderung, ungültige Zahl und Wert außerhalb der Grenze werden vor dem Aufruf abgelehnt', async ({ page }) => {
  const { jobs } = await open(page)
  await propose(page).click()
  await dialog(page).getByRole('button', { name: 'Betrag prüfen' }).click()
  await expect(dialog(page)).toContainText('Ändere mindestens einen Wert.')
  await dialog(page).getByLabel('Personen').fill('2,5')
  await dialog(page).getByRole('button', { name: 'Betrag prüfen' }).click()
  await expect(dialog(page)).toContainText('Personen: Gib eine ganze Zahl ein.')
  await dialog(page).getByLabel('Personen').fill('9')
  await dialog(page).getByRole('button', { name: 'Betrag prüfen' }).click()
  await expect(dialog(page)).toContainText('Personen: Erlaubt sind 1 bis 8.')
  await dialog(page).getByLabel('Personen').fill('2')
  await dialog(page).getByLabel('Stunden').fill('abc')
  await dialog(page).getByRole('button', { name: 'Betrag prüfen' }).click()
  await expect(dialog(page)).toContainText('Stunden: Gib eine Zahl ein.')
  expect(jobs.proposals).toEqual([])
})

test('Belege: vorhandene werden wiederverwendet (kein Upload), ein gewähltes Foto lässt sich entfernen', async ({ page }) => {
  const { jobs } = await open(page, { changes: [proposed('declined')] })
  await checkHours(page)
  await expect(dialog(page)).toContainText('1 Foto schon hochgeladen')
  const send = dialog(page).getByRole('button', { name: /Nachtrag über 810,00 € senden/ })
  await expect(send, 'ein vorhandener Beleg genügt').toBeEnabled()
  await dialog(page).getByLabel('Belegfoto hinzufügen').setInputFiles(photo)
  await dialog(page).getByRole('button', { name: 'Foto entfernen: beleg.png' }).click()
  await send.click()
  await expect(dialog(page)).toHaveCount(0)
  expect(jobs.receipts).toEqual([])
  expect(sends(jobs)[0]?.photoIds).toEqual([RC1])
})

test('Belege: Höchstzahl 8 je Auftrag (sieben vorhandene, nur eines kommt dazu)', async ({ page }) => {
  const seven = Array.from({ length: 7 }, (_, i) => `d4e5f6a7-b8c9-4d0e-9f1a-${String(i).padStart(12, '0')}`)
  await open(page, { changes: [proposed('declined', { receipt_ids: seven })] })
  await checkHours(page)
  await dialog(page).getByLabel('Belegfoto hinzufügen').setInputFiles([photo, { ...photo, name: 'zwei.png' }])
  await expect(dialog(page)).toContainText('beleg.png')
  await expect(dialog(page)).not.toContainText('zwei.png')
  await expect(dialog(page)).toContainText('Höchstzahl erreicht')
})

test('Foto abgelehnt und Fehler beim Anlegen: eigene Texte, bereits hochgeladene Fotos bleiben, kein zweiter Nachtrag', async ({ page }) => {
  const { jobs } = await open(page, {
    receiptAnswers: [{ status: 422, json: { error: 'not_jpeg' } }],
    proposeAnswers: [{ status: 409, json: { error: 'receipt_limit' } }],
  })
  await checkHours(page)
  await dialog(page).getByLabel('Belegfoto hinzufügen').setInputFiles(photo)
  const send = dialog(page).getByRole('button', { name: /Nachtrag über 810,00 € senden/ })
  await send.click()
  await expect(dialog(page)).toContainText('Dieses Foto lässt sich nicht verwenden')
  expect(sends(jobs)).toEqual([])
  await dialog(page).getByRole('button', { name: 'Foto entfernen: beleg.png' }).click()
  await dialog(page).getByLabel('Belegfoto hinzufügen').setInputFiles({ ...photo, name: 'zwei.png' })
  await send.click()
  await expect(dialog(page)).toContainText('höchste Zahl an Belegfotos')
  expect(sends(jobs)).toHaveLength(1)
  expect(jobs.receipts).toHaveLength(2)
})

test('Schon offen (zweites Gerät, verlorene Antwort): 409 schließt, lädt neu und zeigt den vorhandenen Nachtrag, kein zweiter', async ({ page }) => {
  const { jobs } = await open(page, { proposeAnswers: [{ status: 409, json: { error: 'change_open' } }] })
  await checkHours(page)
  await dialog(page).getByLabel('Belegfoto hinzufügen').setInputFiles(photo)
  // Der Server kennt den Nachtrag schon (anderes Gerät); die nächste Abfrage liefert ihn
  jobs.changes = [proposed('proposed')]
  await dialog(page).getByRole('button', { name: /Nachtrag über 810,00 € senden/ }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'liegt schon ein Nachtrag vor' })).toBeVisible()
  await expect(card(page)).toContainText('neuer Gesamtpreis 810,00 €')
  expect(sends(jobs)).toHaveLength(1)
})

test('Zurückziehen: Bestätigung, ein Aufruf mit der Nachtrag-ID, danach „zurückgezogen“ und ein neuer darf folgen', async ({ page }) => {
  const { jobs } = await open(page, { changes: [proposed('proposed')] })
  await card(page).getByRole('button', { name: 'Nachtrag zurückziehen' }).click()
  expect(jobs.withdrawnChanges, 'erst die Bestätigung sendet').toEqual([])
  await dialog(page).getByRole('button', { name: 'Nachtrag zurückziehen' }).click()
  await expect(dialog(page)).toHaveCount(0)
  expect(jobs.withdrawnChanges).toEqual([CH1])
  await expect(card(page)).toContainText('Du hast deinen Nachtrag zurückgezogen.')
  await expect(propose(page)).toBeVisible()
})

test('Sheet-Höhe folgt dem Inhalt (S9i6b-1): kein Leerraum unter dem kurzen Zurückziehen-Sheet, Nachtrag-Sheet wächst beim zweiten Schritt', async ({ page }) => {
  const { jobs } = await open(page, { changes: [proposed('proposed')] })
  await card(page).getByRole('button', { name: 'Nachtrag zurückziehen' }).click()
  const measure = () => measureSheet(page)
  await expect.poll(async () => (await measure()).sheet).toBeGreaterThan(100)
  const m = await measure()
  // Griff, Titelleiste und Abstand unten brauchen zusammen höchstens 68 + 48 px über dem Inhalt
  expect(m.sheet, JSON.stringify(m)).toBeLessThanOrEqual(m.content + 116)
  expect(m.sheet, JSON.stringify(m)).toBeLessThan(m.view * 0.6)
  await dialog(page).getByRole('button', { name: 'Doch nicht' }).click()
  expect(jobs.withdrawnChanges).toEqual([])
})

test('Nachtrag-Sheet wächst mit dem Inhalt: zweiter Schritt ohne Leerraum', async ({ page }) => {
  await open(page)
  const measure = () => measureSheet(page)
  await propose(page).click()
  await expect.poll(async () => (await measure()).sheet).toBeGreaterThan(100)
  const first = await measure()
  await dialog(page).getByLabel('Stunden').fill('5')
  await dialog(page).getByRole('button', { name: 'Betrag prüfen' }).click()
  await expect(dialog(page)).toContainText('810,00 €')
  await expect.poll(async () => (await measure()).content).not.toBe(first.content)
  const second = await measure()
  expect(second.sheet, JSON.stringify({ first, second })).toBeLessThanOrEqual(second.content + 116)
})

test('Bei 320 px: Betragszeilen und Sheet vollständig sichtbar (S9i6b-1), kein waagerechtes Scrollen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await open(page)
  // Karte: Betrag steht in einer Zeile und im Fenster
  const amount = card(page).locator('span.tabular-nums', { hasText: '689,61 €' })
  const box = await amount.boundingBox()
  expect(box && box.x >= 0 && box.x + box.width <= 320, JSON.stringify(box)).toBe(true)
  expect(box && box.height < 30, `Betrag bricht um: ${JSON.stringify(box)}`).toBe(true)
  await checkHours(page)
  const total = dialog(page).locator('span.tabular-nums', { hasText: '810,00 €' }).first()
  await expect(total).toBeVisible()
  const t = await total.boundingBox()
  expect(t && t.x >= 0 && t.x + t.width <= 320 && t.height < 30, JSON.stringify(t)).toBe(true)
  const sendBox = await dialog(page).getByRole('button', { name: /Nachtrag über 810,00 € senden/ }).boundingBox()
  expect(sendBox && sendBox.x >= 0 && sendBox.x + sendBox.width <= 320, JSON.stringify(sendBox)).toBe(true)
  // Aktion bleibt erreichbar: Senden und „Doch nicht“ liegen im sichtbaren Bereich (Fußleiste klebt unten, nur der Inhalt scrollt)
  expect(sendBox && sendBox.y + sendBox.height <= 640, JSON.stringify(sendBox)).toBe(true)
  const cancelBox = await dialog(page).getByRole('button', { name: 'Doch nicht' }).boundingBox()
  expect(cancelBox && cancelBox.y + cancelBox.height <= 640, JSON.stringify(cancelBox)).toBe(true)
  // Formular mit Fehlertext: Betrag prüfen und Fehler im sichtbaren Bereich
  await dialog(page).getByRole('button', { name: 'Werte ändern' }).click()
  await dialog(page).getByLabel('Stunden').fill('3')
  await dialog(page).getByRole('button', { name: 'Betrag prüfen' }).click()
  await expect(dialog(page).getByRole('alert')).toContainText('Ändere mindestens einen Wert.')
  const check = await dialog(page).getByRole('button', { name: 'Betrag prüfen' }).boundingBox()
  expect(check && check.y + check.height <= 640, JSON.stringify(check)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(await dialog(page).evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true)
})
