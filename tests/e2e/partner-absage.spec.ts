import type { Page } from '@playwright/test'
import { expect, test } from './backend'
import { collectErrors } from './console'
import { change, job, openJobs, RQ1, type JobsState } from './jobs-helpers'
import { PNG_1PX } from './mfa-helpers'

/*
 * Partner-Portal 3b (s9i-7b2): Absage durch die Firma. Backend gemockt (tests/e2e/jobs-helpers.ts: `cancel-partner`, `my_jobs`, `photo-receipt`).
 * Was der Server erzwingt (Pauschale, Berechtigung, Belege, Kontaktsperre, Gebühr), belegen tests/rls/cancellation-partner*.test.ts und
 * tests/rls/job-contact-after-cancel.test.ts. Hier: Die Oberfläche zeigt die Beträge des Servers, sendet genau den gezeigten, sendet nie selbst erneut
 * und lädt nach einem Netzfehler den Status neu. Rechenbeispiel (Live-Test): Pauschale 6.900 ct, Staffel v2 → Gebühr 828 ct, Auszahlung 6.072 ct.
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

const REASON = { scope_impossible: /Vor Ort anders als gebucht/, unavailable: /nicht durchführen/, other: /Anderer Grund/ }
const reasonRadio = (d: ReturnType<typeof dialog>, r: keyof typeof REASON) => d.getByRole('radio', { name: REASON[r] })

async function startCheck(page: Page, reason?: keyof typeof REASON) {
  await card(page).getByRole('button', { name: 'Auftrag absagen' }).click()
  if (reason) await reasonRadio(dialog(page), reason).check()
  await dialog(page).getByRole('button', { name: 'Folgen prüfen' }).click()
}

test('ohne Pauschale: Vorschau 0, gesendet wird 0 ohne Belege, Kontakt danach gesperrt', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  const { jobs } = await open(page)
  await expect(card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' })).toBeVisible()
  await startCheck(page, 'unavailable')
  await expect(dialog(page)).toContainText('Der Kunde muss nichts zahlen')
  await expect(dialog(page)).not.toContainText('Pauschale inkl. USt.')
  await expect(dialog(page), 'Festpreis: Pauschale 0 allein löst den Festangebot-Satz nicht aus').not.toContainText('keinen Nachtrag')
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

test('Festangebot (Quelle partner_offer) und Pauschale 0: die Maske nennt in einer Zeile, dass es keine Pauschale gibt, und sagt keine Weitervermittlung zu', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  await open(page, { changes: [change({ source: 'partner_offer' })] })
  await startCheck(page, 'unavailable')
  await expect(dialog(page)).toContainText('Der Kunde muss nichts zahlen.')
  await expect(dialog(page).getByText('Für diese Leistung gibt es keinen Nachtrag und keine Pauschale bei Absage.', { exact: true })).toBeVisible()
  await expect(dialog(page)).not.toContainText('Weitervermittlung')
  await expect(dialog(page)).not.toContainText(/Plattform|Provision|15 ?%|MoveNow-Gebühr/)
  expect(real(errors)).toEqual([])
})

test('Preisgrundlage nicht geladen (changes leer): keine Zeile zum Festangebot, die Maske funktioniert', async ({ page }) => {
  await open(page, { changes: [] })
  await startCheck(page, 'unavailable')
  await expect(dialog(page)).toContainText('Der Kunde muss nichts zahlen')
  await expect(dialog(page)).not.toContainText('keinen Nachtrag')
  await expect(dialog(page), 'ohne Preisgrundlage sagt die Maske keine Weitervermittlung zu').not.toContainText('Weitervermittlung')
})

test('Storno durch den Kunden ohne Pauschale: Kontakt gesperrt (Nr. 154)', async ({ page }) => {
  const errors = collectErrors(page)
  await openJobs(page, { myJobs: [job({ ended_at: '2026-12-01T12:00:00+00:00', ended_reason: 'cancelled_by_customer', status: 'cancelled_by_customer', total_cents: 0 })], changes: [] })
  await expect(card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' }), 'Kundenstorno ohne Pauschale').toHaveCount(0)
  await expect(card(page)).toContainText('Kontakt und Adresse sind gesperrt')
  expect(real(errors)).toEqual([])
})

test('mit Pauschale: 69,00 € / Gebühr 8,28 € / Auszahlung 60,72 €, ein Beleg nötig, gesendet wird die gezeigte Pauschale', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  const { jobs } = await open(page)
  await startCheck(page)
  const d = dialog(page)
  await expect(d).toContainText('69,00 €')
  await expect(d).toContainText('8,28 €')
  await expect(d).toContainText('60,72 €')
  await expect(d).toContainText('Der Kunde schuldet dir 69,00 €')
  await expect(d).toContainText('außerhalb der App in Rechnung')
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
  await expect(card(page)).toContainText('60,72 €')
  await expect(card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' }), 'mit Pauschale bleibt der Kontakt').toBeVisible()
  expect(real(errors)).toEqual([])
})

test('Weg „Ohne Pauschale“ bei möglicher Pauschale: gesendet wird 0 ohne Belege; Grundwechsel verwirft die Vorschau', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page)
  await startCheck(page)
  const d = dialog(page)
  await d.getByRole('button', { name: 'Zurück' }).click()
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

test('409 amount_changed: neue Vorschau mit neuem Betrag, nichts wird automatisch erneut gesendet', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page)
  await startCheck(page)
  const d = dialog(page)
  await fee(d).check()
  await d.getByLabel('Belegfoto hinzufügen').setInputFiles(photo)
  jobs.callOut = 8000 // der Server rechnet inzwischen anders
  await d.getByRole('button', { name: 'Für 69,00 € absagen' }).click()
  await expect(d).toContainText('Der Betrag hat sich geändert')
  await expect(d).toContainText('80,00 €')
  await expect(d).toContainText('70,40 €')
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

test('409 retry: neue Vorschau, kein erneutes Senden', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { cancelAnswers: [{ status: 409, json: { error: 'retry' } }] })
  await startCheck(page, 'unavailable')
  await dialog(page).getByRole('button', { name: 'Absagen', exact: true }).click()
  await expect(dialog(page)).toContainText('Das hat nicht geklappt')
  expect(previews(jobs)).toHaveLength(2)
  await page.waitForTimeout(600)
  expect(sends(jobs)).toHaveLength(1)
})

test('Netzfehler beim Senden: kein zweiter Aufruf, die Aufträge werden neu geladen', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page)
  await page.route('**/functions/v1/cancel-partner', (r) => (r.request().postDataJSON().preview === true ? r.fallback() : r.abort('failed')))
  await startCheck(page, 'unavailable')
  const reads = jobs.jobReads
  await dialog(page).getByRole('button', { name: 'Absagen', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  // „Ergebnis unbekannt“ ist die Warnart (role=alert), eine erfolgreiche Absage die ruhige (role=status)
  await expect(page.getByRole('alert').filter({ hasText: 'Wir wissen nicht, ob die Absage angekommen ist' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Wir wissen nicht' })).toHaveCount(0)
  await expect.poll(() => jobs.jobReads).toBeGreaterThan(reads)
  await page.waitForTimeout(600)
  expect(jobs.cancels.filter((c) => c.preview !== true), 'nie erneut gesendet').toHaveLength(0)
})

// Sheet-Fuß (S9i7c1-1): der letzte Knopf liegt nach dem Scrollen ganz im Blickfeld und wird von nichts überdeckt, bei 390 und 320 px
for (const width of [390, 320]) {
  test(`Absage-Sheet ${width} px: der Absenden-Knopf ist ganz sichtbar und nicht überdeckt`, { tag: '@breit' }, async ({ page }) => {
    await page.setViewportSize({ width, height: 640 })
    await open(page)
    await startCheck(page, 'unavailable')
    const send = dialog(page).getByRole('button', { name: 'Absagen', exact: true })
    await send.scrollIntoViewIfNeeded()
    const box = (await send.boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height, 'Knopf endet im Fenster').toBeLessThanOrEqual(640)
    const covered = await send.evaluate((el) => {
      const b = el.getBoundingClientRect()
      const hit = document.elementFromPoint(b.left + b.width / 2, b.bottom - 2)
      return !(hit && el.contains(hit))
    })
    expect(covered, 'Knopf unten überdeckt').toBe(false)
  })
}

test('Doppelklick auf Absagen: ein Aufruf; während der Anfrage sind die Knöpfe gesperrt', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page)
  await startCheck(page, 'unavailable')
  await dialog(page).getByRole('button', { name: 'Absagen', exact: true }).dblclick()
  await expect(dialog(page)).toHaveCount(0)
  expect(sends(jobs)).toHaveLength(1)
})

test('not_found beim Senden (Kunde hat gleichzeitig storniert): Sheet schließt, Aufträge werden neu geladen', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { cancelAnswers: [{ status: 404, json: { error: 'not_found' } }] })
  await startCheck(page, 'unavailable')
  const reads = jobs.jobReads
  await dialog(page).getByRole('button', { name: 'Absagen', exact: true }).click()
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByRole('alert').filter({ hasText: 'Das lässt sich nicht mehr ändern' })).toBeVisible()
  await expect.poll(() => jobs.jobReads).toBeGreaterThan(reads)
})

test('Grund-Auswahl: vor dem Termin drei Gründe, ab Beginn des Termins nur „vor Ort anders als gebucht“', { tag: '@breit' }, async ({ page }) => {
  await open(page)
  await card(page).getByRole('button', { name: 'Auftrag absagen' }).click()
  await expect(dialog(page).getByRole('radio')).toHaveCount(3)
  await expect(reasonRadio(dialog(page), 'scope_impossible'), 'Standard').toBeChecked()
})

test('Grund-Auswahl ab Termin', { tag: '@breit' }, async ({ page }) => {
  await open(page, { myJobs: [job({ can_start: true })] })
  await card(page).getByRole('button', { name: 'Auftrag absagen' }).click()
  await expect(dialog(page).getByRole('radio')).toHaveCount(1)
  await expect(reasonRadio(dialog(page), 'scope_impossible')).toBeChecked()
  await expect(dialog(page)).toContainText('Der Termin hat begonnen')
})

test('too_late_for_reason vom Server: zurück zur Auswahl mit Hinweis', { tag: '@breit' }, async ({ page }) => {
  await open(page, { cancelPreviewAnswers: [{ status: 409, json: { error: 'too_late_for_reason' } }] })
  await startCheck(page, 'unavailable')
  await expect(dialog(page)).toContainText('Der Termin hat schon begonnen')
  await expect(reasonRadio(dialog(page), 'scope_impossible')).toBeChecked()
})

test('Netzfehler in der Vorschau darf wiederholt werden; gesendet wird dabei nichts', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page)
  let failed = false
  await page.route('**/functions/v1/cancel-partner', (r) => {
    if (!failed && r.request().postDataJSON().preview === true) {
      failed = true
      return r.abort('failed')
    }
    return r.fallback()
  })
  await startCheck(page)
  await expect(dialog(page)).toContainText('Keine Verbindung')
  await dialog(page).getByRole('button', { name: 'Folgen prüfen' }).click()
  await expect(dialog(page)).toContainText('69,00 €')
  expect(sends(jobs)).toEqual([])
})

test('too_late_for_reason beim Senden: zurück zur Auswahl, kein erneutes Senden', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { cancelAnswers: [{ status: 409, json: { error: 'too_late_for_reason' } }] })
  await startCheck(page, 'unavailable')
  await dialog(page).getByRole('button', { name: 'Absagen', exact: true }).click()
  await expect(dialog(page)).toContainText('Der Termin hat schon begonnen')
  await expect(dialog(page).getByRole('button', { name: 'Folgen prüfen' })).toBeVisible()
  await expect(reasonRadio(dialog(page), 'scope_impossible')).toBeChecked()
  await page.waitForTimeout(500)
  expect(sends(jobs)).toHaveLength(1)
})

test('320 px: Betrag, beide Wege und die Knöpfe sind erreichbar, nichts läuft über', { tag: '@breit' }, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await open(page)
  await startCheck(page)
  const d = dialog(page)
  await expect(d).toContainText('69,00 €')
  // beide Wege stehen ohne Scrollen über der Fußleiste, nichts wird verdeckt (Bildsicht s9i-7b2; toBeInViewport ignoriert die Überdeckung, darum Maße)
  const foot = await d.getByRole('button', { name: 'Absagen', exact: true }).boundingBox()
  const optB = await d.locator('label', { hasText: 'Ohne Pauschale' }).boundingBox()
  expect((optB?.y ?? 0) + (optB?.height ?? 0), '„Ohne Pauschale“ endet über der Fußleiste').toBeLessThanOrEqual((foot?.y ?? 0) - 8)
  const [a, b] = await Promise.all([d.getByRole('button', { name: 'Zurück' }).boundingBox(), d.getByRole('button', { name: 'Doch nicht' }).boundingBox()])
  expect(a?.y, 'die zwei schlichten Knöpfe stehen nebeneinander').toBe(b?.y)
  expect(a?.height, 'Zurück bleibt einzeilig').toBeLessThanOrEqual(48)
  await fee(d).check()
  const send = d.getByRole('button', { name: 'Für 69,00 € absagen' })
  const box = await send.boundingBox()
  expect(box?.height, 'Knopf bleibt einzeilig (Höhe unter 60 px)').toBeLessThan(60)
  expect((box?.y ?? 0) + (box?.height ?? 0), 'Knopf liegt im Fenster').toBeLessThanOrEqual(640)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const money = await d.getByText('69,00 €').first().evaluate((el) => getComputedStyle(el).whiteSpace)
  expect(money).toBe('nowrap')
})

test('Tastatur: Hauptweg ohne Maus', { tag: '@breit' }, async ({ page }) => {
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
