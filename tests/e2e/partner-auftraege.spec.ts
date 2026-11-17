import type { Page } from '@playwright/test'
import { expect, test } from './backend'
import { collectErrors } from './console'
import { A2, CONTACT, fixed, job, openJobs, pgErr, RQ1, RQ2, type JobsState } from './jobs-helpers'

/*
 * Partner-Portal 2b (s9i-6b): angenommene Aufträge aus `my_jobs()`, Kontakt nur auf Antippen (`job_contact`), Start und Abschluss.
 * Backend gemockt (tests/e2e/jobs-helpers.ts). Was der Server erzwingt (Zuordnung, Zeitpunkt, Rechte, Audit), belegt tests/rls/partner-my-jobs.test.ts;
 * hier: die Oberfläche zeigt die Werte des Servers, lädt Kontakt erst auf Antippen und ordnet jede Antwort einem eigenen Text zu.
 */

const noFee = (page: Page) => expect(page.locator('body')).not.toContainText(/Plattform|Provision|Gebühr|15 ?%/)
const real = (errors: string[]) => errors.filter((e) => !e.startsWith('Failed to load resource'))
const card = (page: Page, n = 0) => page.getByRole('article').nth(n)
const dialog = (page: Page) => page.getByRole('dialog')
const angenommen = (page: Page) => page.getByRole('heading', { name: 'Angenommen', level: 2 })
const beendet = (page: Page) => page.getByRole('heading', { name: 'Beendet', level: 2 })
const open = (page: Page, init: Partial<JobsState> = {}, o = {}) => openJobs(page, init, o)

test('Liste: Status, Termin, Bezirke und Beträge kommen vom Server; keine Gebühr, keine Kontaktdaten, keine Auftrags-ID im DOM', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  await open(page, { myJobs: [job()] })
  await expect(angenommen(page)).toBeVisible()
  const c = card(page)
  await expect(c).toContainText('Umzug, Bezirk 3')
  await expect(c).toContainText('Angenommen')
  await expect(c).toContainText('Abholung in Bezirk 3, Ziel in Bezirk 10')
  await expect(c).toContainText('2. Dezember')
  await expect(c).toContainText('Vormittag')
  await expect(c).toContainText('Preis für den Kunden')
  await expect(c).toContainText('689,61 €')
  await expect(c).toContainText('Du erhältst')
  await expect(c).toContainText('610,65 €')
  const html = await page.content()
  for (const v of [CONTACT.name, CONTACT.phone, CONTACT.email, CONTACT.from_address, CONTACT.to_address, RQ1]) expect(html, `„${v}“ darf nicht im DOM stehen`).not.toContain(v)
  await noFee(page)
  expect(real(errors)).toEqual([])
})

test('Kontakt und Adresse erst nach Antippen: vorher kein Abruf und nichts im DOM, nachher im Sheet, nach dem Schließen wieder weg; jeder Abruf zählt', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { myJobs: [job()] })
  await expect(angenommen(page)).toBeVisible()
  expect(jobs.contacts).toEqual([])
  await card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' }).click()
  await expect(dialog(page)).toContainText(CONTACT.name)
  await expect(dialog(page)).toContainText(CONTACT.from_address)
  await expect(dialog(page)).toContainText(CONTACT.to_address)
  await expect(dialog(page)).toContainText(CONTACT.stairs_door)
  await expect(dialog(page).getByRole('link', { name: CONTACT.phone })).toHaveAttribute('href', 'tel:+436601234567')
  await expect(dialog(page).getByRole('link', { name: CONTACT.email })).toHaveAttribute('href', `mailto:${CONTACT.email}`)
  expect(jobs.contacts).toEqual([RQ1])
  await dialog(page).getByRole('button', { name: 'Schließen' }).last().click()
  await expect(dialog(page)).toHaveCount(0)
  const html = await page.content()
  for (const v of [CONTACT.name, CONTACT.phone, CONTACT.email, CONTACT.from_address]) expect(html, `„${v}“ nach dem Schließen`).not.toContain(v)
  await card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' }).click()
  await expect(dialog(page)).toContainText(CONTACT.name)
  expect(jobs.contacts, 'zweites Antippen = zweiter Abruf').toEqual([RQ1, RQ1])
})

test('Kontakt: Zugriffsfenster vorbei und Serverfehler haben eigene Texte, ein Fehler lässt sich wiederholen', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { myJobs: [job()], contactAnswers: [pgErr('not_assigned'), { status: 500, json: { code: 'XX000', message: 'boom', details: null, hint: null } }] })
  const button = () => card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' })
  await button().click()
  await expect(dialog(page)).toContainText('Das ist nicht mehr verfügbar.')
  await expect(dialog(page).getByRole('button', { name: 'Erneut versuchen' })).toHaveCount(0)
  await dialog(page).getByRole('button', { name: 'Schließen' }).last().click()
  await button().click()
  await expect(dialog(page)).toContainText('Das hat nicht geklappt')
  await dialog(page).getByRole('button', { name: 'Erneut versuchen' }).click()
  await expect(dialog(page)).toContainText(CONTACT.name)
  expect(jobs.contacts).toHaveLength(3)
  await expect(page.locator('body')).not.toContainText(/not_assigned|P0001|boom/)
})

test('Start vor dem Termin: Knopf gesperrt mit Hinweis auf den Beginn in Wiener Zeit, kein Aufruf', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { myJobs: [job({ can_start: false })] })
  const b = card(page).getByRole('button', { name: 'Auftrag starten' })
  await expect(b).toBeDisabled()
  await expect(card(page)).toContainText(/ab 2\.\sDezember.*08:00\sUhr\sstarten/)
  await b.click({ force: true }).catch(() => undefined)
  expect(jobs.starts).toEqual([])
})

for (const status of ['accepted', 'in_progress'] as const) {
  test(`Kunde hat „nicht stattgefunden“ gemeldet (${status}): nur der Hinweis, kein Start, Abschluss, Absage, Nachtrag (S9i6b-3)`, { tag: '@breit' }, async ({ page }) => {
    await open(page, { myJobs: [job({ status, can_start: false, under_review: true })] })
    await expect(card(page).getByRole('status').filter({ hasText: 'Der Kunde hat gemeldet, dass der Auftrag nicht stattgefunden hat' })).toBeVisible()
    await expect(card(page).getByRole('button', { name: /Auftrag (starten|abschließen|absagen)/ })).toHaveCount(0)
    await expect(card(page).getByRole('button', { name: /Nachtrag/ })).toHaveCount(0)
    await noFee(page)
  })
}

test('Start und Abschluss: Bestätigung, gesendet wird nur die Auftrags-ID, Status wechselt, der Auftrag wandert nach „Beendet“', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  const { jobs } = await open(page, { myJobs: [job({ can_start: true })] })
  await card(page).getByRole('button', { name: 'Auftrag starten' }).click()
  await expect(dialog(page)).toBeVisible()
  expect(jobs.starts, 'erst die Bestätigung sendet').toEqual([])
  await dialog(page).getByRole('button', { name: 'Auftrag starten' }).click()
  await expect(card(page)).toContainText('Läuft')
  expect(jobs.starts).toEqual([RQ1])
  await expect(card(page).getByRole('button', { name: 'Auftrag starten' })).toHaveCount(0)
  await card(page).getByRole('button', { name: 'Auftrag abschließen' }).click()
  await dialog(page).getByRole('button', { name: 'Verbindlich abschließen' }).click()
  await expect(beendet(page)).toBeVisible()
  await expect(angenommen(page)).toHaveCount(0)
  await expect(card(page)).toContainText('Abgeschlossen')
  expect(jobs.completes).toEqual([RQ1])
  await expect(card(page).getByRole('button', { name: /Auftrag (starten|abschließen)/ })).toHaveCount(0)
  await expect(card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' })).toBeVisible()
  await noFee(page)
  expect(real(errors)).toEqual([])
})

test('Doppelklick auf die Bestätigung sendet nur einen Aufruf', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { myJobs: [job({ can_start: true })] })
  await card(page).getByRole('button', { name: 'Auftrag starten' }).click()
  await dialog(page).getByRole('button', { name: 'Auftrag starten' }).dblclick()
  await expect(card(page)).toContainText('Läuft')
  expect(jobs.starts).toHaveLength(1)
})

test('Fehlerantworten beim Start und beim Abschluss haben verständliche Texte, nie Servercodes', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { myJobs: [job({ can_start: true })], startAnswers: [pgErr('too_early'), pgErr('mfa_required', 401), pgErr('invalid_transition')] })
  const start = () => card(page).getByRole('button', { name: 'Auftrag starten' })
  const confirm = () => dialog(page).getByRole('button', { name: 'Auftrag starten' })
  await start().click()
  await confirm().click()
  await expect(dialog(page)).toContainText('Der Termin hat noch nicht begonnen.')
  await dialog(page).getByRole('button', { name: 'Schließen' }).last().click()
  await start().click()
  await confirm().click()
  await expect(dialog(page)).toContainText('Deine Anmeldung ist abgelaufen')
  await dialog(page).getByRole('button', { name: 'Schließen' }).last().click()
  // Zustand hat sich geändert: das Sheet schließt, der Hinweis erscheint, die Liste lädt neu
  const reads = jobs.jobReads
  jobs.myJobs = [job({ status: 'in_progress' })]
  await start().click()
  await confirm().click()
  await expect(page.getByRole('alert').filter({ hasText: 'Das lässt sich nicht mehr ändern' })).toBeVisible()
  await expect(dialog(page)).toHaveCount(0)
  await expect(card(page)).toContainText('Läuft')
  expect(jobs.jobReads).toBeGreaterThan(reads)
  jobs.completeAnswers.push(pgErr('not_assigned'))
  await card(page).getByRole('button', { name: 'Auftrag abschließen' }).click()
  await dialog(page).getByRole('button', { name: 'Verbindlich abschließen' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Das ist nicht mehr verfügbar' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/too_early|invalid_transition|not_assigned|mfa_required|P0001/)
})

test('Storno: ohne Betrag, mit Stufe und mit Pauschale; keine falsche Beschriftung „Preis für den Kunden“', { tag: '@breit' }, async ({ page }) => {
  await open(page, {
    myJobs: [
      job({ status: 'cancelled_by_customer', ended_at: '2026-12-01T10:00:00+00:00', ended_reason: 'cancelled_by_customer', total_cents: 0, payout_cents: 0 }),
      job({ assignment_id: A2, request_id: RQ2, status: 'cancelled_by_customer', ended_at: '2026-12-01T10:00:00+00:00', ended_reason: 'cancelled_by_customer', total_cents: 34481, payout_cents: 29309 }),
      job({ assignment_id: '0a92c3c4-5061-4273-a45f-4a3b2c1d0e9f', request_id: 'af03d4d5-6172-4384-b560-5b4c3d2e1f0a', status: 'cancelled_by_partner', ended_at: '2026-12-01T10:00:00+00:00', ended_reason: 'cancelled_by_partner', total_cents: 6900, payout_cents: 6072 }),
    ],
  })
  await expect(beendet(page)).toBeVisible()
  await expect(angenommen(page)).toHaveCount(0)
  await expect(card(page, 0)).toContainText('Vom Kunden storniert')
  await expect(card(page, 0)).toContainText('Storniert, es fällt kein Betrag an.')
  await expect(card(page, 0)).not.toContainText(/€|Du erhältst/)
  await expect(card(page, 1)).toContainText('Betrag nach Storno')
  await expect(card(page, 1)).toContainText('344,81 €')
  await expect(card(page, 1)).toContainText('293,09 €')
  await expect(card(page, 2)).toContainText('Von dir storniert')
  await expect(card(page, 2)).toContainText('Pauschale')
  await expect(card(page, 2)).toContainText('69,00 €')
  await expect(page.locator('body')).not.toContainText('Preis für den Kunden')
  await expect(page.getByRole('button', { name: /Auftrag (starten|abschließen)/ })).toHaveCount(0)
  await noFee(page)
})

test('Beträge nicht lesbar: der Auftrag bleibt sichtbar, es erscheint kein Betrag (nie 0 €)', { tag: '@breit' }, async ({ page }) => {
  await open(page, { myJobs: [job({ total_cents: null, payout_cents: null })] })
  await expect(card(page)).toContainText('Umzug, Bezirk 3')
  await expect(card(page)).not.toContainText(/€|Du erhältst|Preis für den Kunden/)
})

test('pausierte Firma (payment_hold) sieht ihre angenommenen Aufträge, aber keine offenen Anfragen; pending ruft nichts ab', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { myJobs: [job({ can_start: true })] }, { status: 'payment_hold' })
  await expect(angenommen(page)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Offene Anfragen' })).toHaveCount(0)
  expect(jobs.listingReads).toBe(0)
  await expect(card(page).getByRole('button', { name: 'Auftrag starten' })).toBeEnabled()
})

test('pending: weder Aufträge noch Anfragen werden abgerufen', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { myJobs: [job()] }, { status: 'pending' })
  await expect(page.getByRole('heading', { name: 'Dokumente' })).toBeVisible()
  expect(jobs.jobReads).toBe(0)
  expect(jobs.listingReads).toBe(0)
  await expect(page.getByRole('article')).toHaveCount(0)
})

test('Ladefehler mit erneutem Versuch; ein Fehler beim Neuladen im Hintergrund lässt die Anzeige stehen', { tag: '@breit' }, async ({ page }) => {
  // zwei Fehler: React StrictMode (Entwicklungsbuild) ruft beim Start zweimal ab, der erste Abruf gilt nicht mehr
  const { jobs } = await open(page, { myJobs: [job()], jobStatus: [500, 500] })
  await expect(page.getByText('Die Aufträge konnten nicht geladen werden')).toBeVisible()
  await page.getByRole('button', { name: /Erneut|Nochmal|Wiederholen/ }).click()
  await expect(card(page)).toContainText('Umzug, Bezirk 3')
  jobs.jobStatus.push(500)
  const reads = jobs.jobReads
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect.poll(() => jobs.jobReads).toBeGreaterThan(reads)
  await expect(card(page)).toContainText('Umzug, Bezirk 3')
  await expect(page.getByText('Die Aufträge konnten nicht geladen werden')).toHaveCount(0)
})

test('Verweigert der Server beim Neuladen (Firma inzwischen gesperrt), verschwindet die Liste (Abnahme N6)', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { myJobs: [job()] })
  await expect(card(page)).toContainText('Umzug, Bezirk 3')
  jobs.jobStatus.push(403)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByText('Die Aufträge konnten nicht geladen werden')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Auftrag starten' })).toHaveCount(0)
})

test('Rückkehr in den Tab lädt neu: ist der Termin inzwischen erreicht, wird „Auftrag starten“ frei (Entscheidung der Serveruhr, nicht der Geräteuhr)', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { myJobs: [job({ can_start: false })] })
  await expect(card(page).getByRole('button', { name: 'Auftrag starten' })).toBeDisabled()
  jobs.myJobs = [job({ can_start: true })]
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(card(page).getByRole('button', { name: 'Auftrag starten' })).toBeEnabled()
  await expect(card(page)).not.toContainText('starten.')
})

test('Annahme in den Anfragen lädt die Aufträge nach: der neue Auftrag erscheint unter „Angenommen“ mit den Beträgen des Servers', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { listings: [fixed()] })
  await page.getByRole('button', { name: 'Annehmen' }).click()
  await dialog(page).getByRole('button', { name: 'Verbindlich annehmen' }).click()
  await expect(angenommen(page)).toBeVisible()
  await expect(card(page)).toContainText('689,61 €')
  await expect(card(page)).toContainText('610,65 €')
  expect(jobs.accepts).toHaveLength(1)
})

test('Tastatur: Start, Abschluss und Kontakt ohne Maus; Escape schließt das Sheet ohne Aufruf', { tag: '@breit' }, async ({ page }) => {
  const { jobs } = await open(page, { myJobs: [job({ can_start: true })] })
  await card(page).getByRole('button', { name: 'Auftrag starten' }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  expect(jobs.starts).toEqual([])
  await card(page).getByRole('button', { name: 'Auftrag starten' }).focus()
  await page.keyboard.press('Enter')
  const ok = dialog(page).getByRole('button', { name: 'Auftrag starten' })
  await ok.focus()
  await page.keyboard.press('Enter')
  await expect(card(page)).toContainText('Läuft')
  await card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toContainText(CONTACT.name)
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await card(page).getByRole('button', { name: 'Auftrag abschließen' }).focus()
  await page.keyboard.press('Enter')
  const done = dialog(page).getByRole('button', { name: 'Verbindlich abschließen' })
  await done.focus()
  await page.keyboard.press('Enter')
  await expect(beendet(page)).toBeVisible()
  expect(jobs.starts).toEqual([RQ1])
  expect(jobs.completes).toEqual([RQ1])
})

test('Maße: Knöpfe mindestens 44 px, Beträge brechen nie um, keine Überbreite (320, 390, 1280 px)', { tag: '@breit' }, async ({ page }) => {
  await open(page, { myJobs: [job({ can_start: true }), job({ assignment_id: A2, request_id: RQ2, status: 'in_progress' })] })
  await expect(angenommen(page)).toBeVisible()
  for (const w of [320, 390, 1280]) {
    await page.setViewportSize({ width: w, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Überbreite bei ${w}`).toBe(true)
    for (const name of ['Auftrag starten', 'Auftrag abschließen', 'Kontakt und Adresse anzeigen']) {
      const b = await page.getByRole('button', { name }).first().boundingBox()
      expect(b!.height, `${name} bei ${w}`).toBeGreaterThanOrEqual(44)
    }
    const amount = page.getByText('689,61 €').first()
    const lh = await amount.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight))
    const b = await amount.boundingBox()
    expect(b!.height, `Betrag einzeilig bei ${w}`).toBeLessThanOrEqual(lh * 1.5)
    expect(await amount.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap')
  }
})

test('320 × 640 px: im Kontakt-Sheet ist „Schließen“ erreichbar', { tag: '@breit' }, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await open(page, { myJobs: [job()] })
  await card(page).getByRole('button', { name: 'Kontakt und Adresse anzeigen' }).click()
  await expect(dialog(page)).toContainText(CONTACT.name)
  const b = dialog(page).getByRole('button', { name: 'Schließen' }).last()
  await b.scrollIntoViewIfNeeded()
  const box = await b.boundingBox()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(640)
  expect(box!.height).toBeGreaterThanOrEqual(44)
})
