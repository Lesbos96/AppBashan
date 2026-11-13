import type { Page } from '@playwright/test'
import { expect, test } from './backend'
import { collectErrors } from './console'
import { change, job, openJobs, RQ1, type JobsState } from './jobs-helpers'
import { PNG_1PX } from './mfa-helpers'

/*
 * Partner-Portal 3b (s9i-7b2): Absage durch die Firma. Backend gemockt (tests/e2e/jobs-helpers.ts: `cancel-partner`, `my_jobs`, `photo-receipt`).
 * Was der Server erzwingt (Pauschale, Berechtigung, Belege, Kontaktsperre, Gebühr), belegen tests/rls/cancellation-partner*.test.ts und
 * tests/rls/job-contact-after-cancel.test.ts. Hier: Die Oberfläche zeigt die Beträge des Servers, sendet genau den gezeigten, sendet nie selbst erneut
 * und lädt nach einem Netzfehler den Status neu. Rechenbeispiel (Live-Test): Pauschale 6.900 ct, Satz 15 % → Gebühr 1.035 ct, Auszahlung 5.865 ct.
 */

const real = (errors: string[]) => errors.filter((e) => !e.startsWith('Failed to load resource'))
const card = (page: Page) => page.getByRole('article').first()
const dialog = (page: Page) => page.getByRole('dialog')
const open = (page: Page, init: Partial<JobsState> = {}) => openJobs(page, { myJobs: [job()], changes: [change()], ...init })
const sends = (jobs: JobsState) => jobs.cancels.filter((c) => c.preview !== true)
const previews = (jobs: JobsState) => jobs.cancels.filter((c) => c.preview === true)
const photo = { name: 'beleg.png', mimeType: 'image/png', buffer: PNG_1PX }
const fee = (d: ReturnType<typeof dialog>) => d.getByRole('radio', { name: /Mit Pauschale/ })
const free = (d: ReturnType<typeof dialog>) => d.getByRole('radio', { name: /Ohne Pauschale/ })

const REASON = { scope_impossible: /vor Ort anders als gebucht/, unavailable: /nicht durchführen/, other: /Anderer Grund/ }
const reasonRadio = (d: ReturnType<typeof dialog>, r: keyof typeof REASON) => d.getByRole('radio', { name: REASON[r] })

async function startCheck(page: Page, reason?: keyof typeof REASON) {
  await card(page).getByRole('button', { name: 'Auftrag absagen' }).click()
  if (reason) await reasonRadio(dialog(page), reason).check()
  await dialog(page).getByRole('button', { name: 'Folgen prüfen' }).click()
}

test('ohne Pauschale: Vorschau 0, gesendet wird 0 ohne Belege, Kontakt danach gesperrt', async ({ page }) => {
  const errors = collectErrors(page)
  const { jobs } = await open(page)
  await expect(card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' })).toBeVisible()
  await startCheck(page, 'unavailable')
  await expect(dialog(page)).toContainText('Der Kunde muss nichts zahlen')
  await expect(dialog(page)).not.toContainText('Pauschale inkl. USt.')
  expect(previews(jobs)).toEqual([{ requestId: RQ1, reason: 'unavailable', preview: true }])
  expect(sends(jobs), 'die Vorschau bucht nichts').toEqual([])
  await dialog(page).getByRole('button', { name: 'Absagen', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  expect(sends(jobs)).toEqual([{ requestId: RQ1, reason: 'unavailable', shownCallOutCents: 0 }])
  expect(jobs.receipts).toEqual([])
  await expect(page.getByRole('status').filter({ hasText: 'Du hast den Auftrag abgesagt. Der Kunde ist informiert.' })).toBeVisible()
  await expect(card(page)).toContainText('Von dir storniert')
  await expect(card(page)).toContainText('Storniert, es fällt kein Betrag an.')
  await expect(card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' }), 'Kontaktsperre ohne Pauschale').toHaveCount(0)
  await expect(card(page)).toContainText('Kontakt und Adresse sind gesperrt')
  expect(real(errors)).toEqual([])
})

test('mit Pauschale: 69,00 € / Gebühr 10,35 € / Auszahlung 58,65 €, ein Beleg nötig, gesendet wird die gezeigte Pauschale', async ({ page }) => {
  const errors = collectErrors(page)
  const { jobs } = await open(page)
  await startCheck(page)
  const d = dialog(page)
  await expect(d).toContainText('69,00 €')
  await expect(d).toContainText('10,35 €')
  await expect(d).toContainText('58,65 €')
  await expect(d).toContainText('Du stellst sie ihm außerhalb der App in Rechnung')
  await expect(d.getByRole('button', { name: 'Absagen', exact: true }), 'ohne Auswahl kein Absenden').toBeDisabled()
  await fee(d).check()
  const send = d.getByRole('button', { name: 'Für 69,00 € absagen' })
  await expect(send, 'ohne Beleg kein Absenden').toBeDisabled()
  await d.getByLabel('Belegfoto hinzufügen').setInputFiles(photo)
  await expect(send).toBeEnabled()
  await send.click()
  await expect(d).toHaveCount(0)
  expect(jobs.receipts).toHaveLength(1)
  expect(jobs.receipts[0]).toMatchObject({ request: RQ1, type: 'image/jpeg' })
  expect(sends(jobs)).toHaveLength(1)
  expect(sends(jobs)[0]).toMatchObject({ requestId: RQ1, reason: 'scope_impossible', shownCallOutCents: 6900 })
  expect((sends(jobs)[0]?.photoIds as string[]).length).toBe(1)
  await expect(page.getByRole('status').filter({ hasText: 'außerhalb der App in Rechnung' })).toBeVisible()
  await expect(card(page)).toContainText('Von dir storniert')
  await expect(card(page)).toContainText('69,00 €')
  await expect(card(page)).toContainText('58,65 €')
  await expect(card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' }), 'mit Pauschale bleibt der Kontakt').toBeVisible()
  expect(real(errors)).toEqual([])
})

test('Weg „Ohne Pauschale“ bei möglicher Pauschale: gesendet wird 0 ohne Belege; Grundwechsel verwirft die Vorschau', async ({ page }) => {
  const { jobs } = await open(page)
  await startCheck(page)
  const d = dialog(page)
  await d.getByRole('button', { name: 'Grund ändern' }).click()
  await reasonRadio(d, 'other').check()
  // der neue Grund braucht eine neue Vorschau: kein Absenden ohne sie
  await expect(d.getByRole('button', { name: 'Folgen prüfen' })).toBeVisible()
  await reasonRadio(d, 'scope_impossible').check()
  await d.getByRole('button', { name: 'Folgen prüfen' }).click()
  expect(previews(jobs)).toHaveLength(2)
  await free(d).check()
  await d.getByRole('button', { name: 'Absagen', exact: true }).click()
  await expect(d).toHaveCount(0)
  expect(sends(jobs)).toEqual([{ requestId: RQ1, reason: 'scope_impossible', shownCallOutCents: 0 }])
  expect(jobs.receipts).toEqual([])
})

test('409 amount_changed: neue Vorschau mit neuem Betrag, nichts wird automatisch erneut gesendet', async ({ page }) => {
  const { jobs } = await open(page)
  await startCheck(page)
  const d = dialog(page)
  await fee(d).check()
  await d.getByLabel('Belegfoto hinzufügen').setInputFiles(photo)
  jobs.callOut = 8000 // der Server rechnet inzwischen anders
  await d.getByRole('button', { name: 'Für 69,00 € absagen' }).click()
  await expect(d).toContainText('Der Betrag hat sich geändert')
  await expect(d).toContainText('80,00 €')
  await expect(d).toContainText('68,00 €')
  expect(sends(jobs), 'genau ein Sendeversuch').toHaveLength(1)
  expect(previews(jobs)).toHaveLength(2)
  await page.waitForTimeout(600)
  expect(sends(jobs), 'auch später kein zweiter Versuch').toHaveLength(1)
  await expect(fee(d), 'die Auswahl gilt nicht mehr').not.toBeChecked()
  await expect(d.getByRole('button', { name: 'Absagen', exact: true })).toBeDisabled()
  // erst die ausdrückliche Bestätigung des neuen Betrags sendet
  await fee(d).check()
  await d.getByRole('button', { name: 'Für 80,00 € absagen' }).click()
  await expect(d).toHaveCount(0)
  expect(sends(jobs)).toHaveLength(2)
  expect(sends(jobs)[1]).toMatchObject({ shownCallOutCents: 8000 })
  expect(jobs.receipts, 'der Beleg wird nicht noch einmal hochgeladen').toHaveLength(1)
})

test('409 retry: neue Vorschau, kein erneutes Senden', async ({ page }) => {
  const { jobs } = await open(page, { cancelAnswers: [{ status: 409, json: { error: 'retry' } }] })
  await startCheck(page, 'unavailable')
  await dialog(page).getByRole('button', { name: 'Absagen', exact: true }).click()
  await expect(dialog(page)).toContainText('Das hat nicht geklappt')
  expect(previews(jobs)).toHaveLength(2)
  await page.waitForTimeout(600)
  expect(sends(jobs)).toHaveLength(1)
})

test('Netzfehler beim Senden: kein zweiter Aufruf, die Aufträge werden neu geladen', async ({ page }) => {
  const { jobs } = await open(page)
  await page.route('**/functions/v1/cancel-partner', (r) => (r.request().postDataJSON().preview === true ? r.fallback() : r.abort('failed')))
  await startCheck(page, 'unavailable')
  const reads = jobs.jobReads
  await dialog(page).getByRole('button', { name: 'Absagen', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Wir wissen nicht, ob die Absage angekommen ist' })).toBeVisible()
  await expect.poll(() => jobs.jobReads).toBeGreaterThan(reads)
  await page.waitForTimeout(600)
  expect(jobs.cancels.filter((c) => c.preview !== true), 'nie erneut gesendet').toHaveLength(0)
})

test('Doppelklick auf Absagen: ein Aufruf; während der Anfrage sind die Knöpfe gesperrt', async ({ page }) => {
  const { jobs } = await open(page)
  await startCheck(page, 'unavailable')
  await dialog(page).getByRole('button', { name: 'Absagen', exact: true }).dblclick()
  await expect(dialog(page)).toHaveCount(0)
  expect(sends(jobs)).toHaveLength(1)
})

test('not_found beim Senden (Kunde hat gleichzeitig storniert): Sheet schließt, Aufträge werden neu geladen', async ({ page }) => {
  const { jobs } = await open(page, { cancelAnswers: [{ status: 404, json: { error: 'not_found' } }] })
  await startCheck(page, 'unavailable')
  const reads = jobs.jobReads
  await dialog(page).getByRole('button', { name: 'Absagen', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Das lässt sich nicht mehr ändern' })).toBeVisible()
  await expect.poll(() => jobs.jobReads).toBeGreaterThan(reads)
})

test('Grund-Auswahl: vor dem Termin drei Gründe, ab Beginn des Termins nur „vor Ort anders als gebucht“', async ({ page }) => {
  await open(page)
  await card(page).getByRole('button', { name: 'Auftrag absagen' }).click()
  await expect(dialog(page).getByRole('radio')).toHaveCount(3)
  await expect(reasonRadio(dialog(page), 'scope_impossible'), 'Standard').toBeChecked()
})

test('Grund-Auswahl ab Termin', async ({ page }) => {
  await open(page, { myJobs: [job({ can_start: true })] })
  await card(page).getByRole('button', { name: 'Auftrag absagen' }).click()
  await expect(dialog(page).getByRole('radio')).toHaveCount(1)
  await expect(reasonRadio(dialog(page), 'scope_impossible')).toBeChecked()
  await expect(dialog(page)).toContainText('Der Termin hat begonnen')
})

test('too_late_for_reason vom Server: zurück zur Auswahl mit Hinweis', async ({ page }) => {
  await open(page, { cancelPreviewAnswers: [{ status: 409, json: { error: 'too_late_for_reason' } }] })
  await startCheck(page, 'unavailable')
  await expect(dialog(page)).toContainText('Der Termin hat schon begonnen')
  await expect(reasonRadio(dialog(page), 'scope_impossible')).toBeChecked()
})

test('320 px: Betrag, beide Wege und die Knöpfe sind erreichbar, nichts läuft über', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await open(page)
  await startCheck(page)
  const d = dialog(page)
  await expect(d).toContainText('69,00 €')
  await fee(d).check()
  await free(d).scrollIntoViewIfNeeded()
  await expect(free(d)).toBeInViewport()
  const send = d.getByRole('button', { name: 'Für 69,00 € absagen' })
  const box = await send.boundingBox()
  expect(box?.height, 'Knopf bleibt einzeilig (Höhe unter 60 px)').toBeLessThan(60)
  expect((box?.y ?? 0) + (box?.height ?? 0), 'Knopf liegt im Fenster').toBeLessThanOrEqual(640)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const money = await d.getByText('69,00 €').first().evaluate((el) => getComputedStyle(el).whiteSpace)
  expect(money).toBe('nowrap')
})

test('Tastatur: Hauptweg ohne Maus', async ({ page }) => {
  const { jobs } = await open(page)
  await card(page).getByRole('button', { name: 'Auftrag absagen' }).focus()
  await page.keyboard.press('Enter')
  await dialog(page).getByRole('button', { name: 'Folgen prüfen' }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toContainText('69,00 €')
  await free(dialog(page)).focus()
  await page.keyboard.press('Space')
  await dialog(page).getByRole('button', { name: 'Absagen', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toHaveCount(0)
  expect(sends(jobs)).toHaveLength(1)
  await expect(card(page)).toContainText('Von dir storniert')
})
