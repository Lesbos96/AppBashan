import type { Page } from '@playwright/test'
import { expect, test } from './backend'
import { collectErrors } from './console'
import { factor } from './mfa-helpers'
import { fixed, L1, L2, O1, openJobs, range, REV1, SENTINEL } from './jobs-helpers'

/*
 * Partner-Portal 2a (s9i-6a): offene Anfragen, Annahme, Festangebot, eigene Angebote. Backend gemockt (tests/e2e/jobs-helpers.ts).
 * Sichtbarkeit, Beträge und Wettlauf erzwingt der Server (tests/rls/partner-jobs.test.ts, accept-concurrency, offers*); hier: die Oberfläche
 * zeigt nur den Umfang, sendet genau den gezeigten Betrag und reagiert auf jede Serverantwort.
 */

const noFee = (page: Page) => expect(page.locator('body')).not.toContainText(/Plattform|Provision|Gebühr|15 ?%/)
const real = (errors: string[]) => errors.filter((e) => !e.startsWith('Failed to load resource'))
const heading = (page: Page) => page.getByRole('heading', { name: 'Offene Anfragen', level: 2 })
const card = (page: Page, n = 0) => page.getByRole('article').nth(n)
const dialog = (page: Page) => page.getByRole('dialog')

test('Liste: Umfang, Preis und Auszahlung; keine Kontaktdaten und keine Adresse im DOM, auch nicht versteckt', async ({ page }) => {
  const errors = collectErrors(page)
  const { jobs } = await openJobs(page, { listings: [fixed()] })
  await expect(heading(page)).toBeVisible()
  const c = card(page)
  await expect(c).toContainText('Bezirk 3')
  await expect(c).toContainText('Bezirk 10')
  await expect(c).toContainText('2. Dezember')
  await expect(c).toContainText('Vormittag')
  await expect(c).toContainText('Lift') // Umfang aus der Whitelist (Lift am Ziel)
  await expect(c).toContainText('689,61 €')
  await expect(c).toContainText('586,17 €')
  // Alles im DOM (Text, Attribute, versteckte Knoten): keine fremden Schlüssel aus `inputs`
  const html = await page.content()
  for (const v of Object.values(SENTINEL)) expect(html, `„${v}“ darf nicht im DOM stehen`).not.toContain(v)
  expect(html).not.toMatch(/request_id|customer_id/)
  // Spaltenliste des Abrufs: nur freigegebene Spalten
  const url = decodeURIComponent(jobs.urls.find((u) => u.includes('job_listings'))!)
  expect(url).not.toMatch(/request_id|customer|address|\*/)
  await noFee(page)
  expect(real(errors)).toEqual([])
})

test('leere Liste und Ladefehler mit erneutem Versuch', async ({ page }) => {
  // supabase-js wiederholt GET-Abrufe bei 5xx mehrfach (rund 7 s); alle Versuche scheitern lassen
  const { jobs } = await openJobs(page, { listings: [], listStatus: [500, 500, 500, 500, 500, 500] })
  await expect(page.getByText('Die Anfragen konnten nicht geladen werden')).toBeVisible({ timeout: 30_000 })
  jobs.listStatus = []
  await page.getByRole('button', { name: /Erneut|Nochmal|Wiederholen/ }).click()
  await expect(page.getByText('Gerade gibt es keine offenen Anfragen')).toBeVisible()
  expect(jobs.listingReads).toBeGreaterThanOrEqual(2)
})

test('Annahme: das Sheet nennt Preis und Auszahlung, gesendet wird genau die gezeigte Auszahlung, danach steht die Anfrage unter „Angenommen“', async ({ page }) => {
  const errors = collectErrors(page)
  const { jobs } = await openJobs(page, { listings: [fixed()] })
  await card(page).getByRole('button', { name: 'Annehmen' }).click()
  await expect(dialog(page)).toContainText('586,17 €')
  await expect(dialog(page)).toContainText('689,61 €')
  await dialog(page).getByRole('button', { name: 'Verbindlich annehmen' }).click()
  await expect(page.getByRole('heading', { name: 'Angenommen', level: 2 })).toBeVisible()
  expect(jobs.accepts).toEqual([{ listingId: L1, revisionId: REV1, shownPayoutCents: 58617 }])
  await expect(page.getByRole('button', { name: 'Annehmen' })).toHaveCount(0)
  await noFee(page)
  expect(real(errors)).toEqual([])
})

test('Doppelklick sendet nur einen Aufruf', async ({ page }) => {
  const { jobs } = await openJobs(page, { listings: [fixed()] })
  await card(page).getByRole('button', { name: 'Annehmen' }).click()
  await dialog(page).getByRole('button', { name: 'Verbindlich annehmen' }).dblclick()
  await expect(page.getByRole('heading', { name: 'Angenommen', level: 2 })).toBeVisible()
  expect(jobs.accepts).toHaveLength(1)
})

test('Wettlauf: der zweite Partner bekommt eine verständliche Meldung, die Liste lädt neu und die Anfrage ist weg', async ({ page }) => {
  const { jobs } = await openJobs(page, { listings: [fixed()], acceptAnswers: [{ status: 409, json: { error: 'already_taken' } }] })
  await card(page).getByRole('button', { name: 'Annehmen' }).click()
  await dialog(page).getByRole('button', { name: 'Verbindlich annehmen' }).click()
  // Ein anderer hat gewonnen: das Listing ist nicht mehr offen
  jobs.listings = []
  await expect(page.getByText('Diese Anfrage ist nicht mehr verfügbar')).toBeVisible()
  await expect(dialog(page)).toHaveCount(0)
  await page.waitForFunction(() => document.querySelectorAll('article').length === 0)
  expect(jobs.accepts).toHaveLength(1)
  await expect(page.locator('body')).not.toContainText(/already_taken|409/)
})

test('geänderte Auszahlung: neu laden, neu bestätigen lassen, nie automatisch erneut senden', async ({ page }) => {
  const { jobs } = await openJobs(page, { listings: [fixed()], acceptAnswers: [{ status: 409, json: { error: 'payout_changed' } }] })
  await card(page).getByRole('button', { name: 'Annehmen' }).click()
  jobs.rates = { fee_rate: 0.2, fee_vat_rate: 0.2 }
  await dialog(page).getByRole('button', { name: 'Verbindlich annehmen' }).click()
  await expect(page.getByText('Deine Auszahlung hat sich geändert')).toBeVisible()
  await expect(card(page)).toContainText('551,69 €') // 689,61 − 20 % (137,92)
  expect(jobs.accepts).toHaveLength(1)
  await card(page).getByRole('button', { name: 'Annehmen' }).click()
  await dialog(page).getByRole('button', { name: 'Verbindlich annehmen' }).click()
  await expect(page.getByRole('heading', { name: 'Angenommen', level: 2 })).toBeVisible()
  expect(jobs.accepts[1]).toMatchObject({ shownPayoutCents: 55169 })
})

test('ohne Sätze keine Auszahlung und keine Annahme', async ({ page }) => {
  await openJobs(page, { listings: [fixed()], rates: { fee_rate: null, fee_vat_rate: null } })
  await expect(card(page)).toContainText('689,61 €')
  await expect(card(page)).not.toContainText('586,17')
  await expect(card(page).getByRole('button', { name: 'Annehmen' })).toBeDisabled()
})

test('Angebot: Eingabe wird geprüft, gesendet werden ganze Cent, danach steht es unter „Meine Angebote“', async ({ page }) => {
  const errors = collectErrors(page)
  const { jobs } = await openJobs(page, { listings: [range()] })
  await expect(card(page)).toContainText('500,00 €')
  await expect(card(page)).toContainText('900,00 €')
  await expect(card(page).getByRole('button', { name: 'Annehmen' })).toHaveCount(0)
  await card(page).getByRole('button', { name: 'Angebot abgeben' }).click()
  const field = dialog(page).getByLabel('Dein Angebot in Euro')
  for (const bad of ['', '0', '-5', '1,005', 'abc', '499,99', '900,01']) {
    await field.fill(bad)
    await dialog(page).getByRole('button', { name: 'Weiter' }).click()
    await expect(dialog(page).getByRole('alert')).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Verbindlich senden' })).toHaveCount(0)
  }
  await field.fill('700,50')
  await dialog(page).getByRole('button', { name: 'Weiter' }).click()
  await expect(dialog(page)).toContainText('700,50 €')
  await expect(dialog(page)).toContainText('voraussichtlich')
  await dialog(page).getByRole('button', { name: 'Verbindlich senden' }).click()
  expect(jobs.sends).toEqual([{ p_listing: L2, p_amount: 70050 }])
  const mine = page.getByRole('heading', { name: 'Meine Angebote', level: 2 })
  await expect(mine).toBeVisible()
  await expect(page.getByText('700,50 €').last()).toBeVisible()
  await noFee(page)
  expect(real(errors)).toEqual([])
})

test.describe('Serverantworten beim Angebot', () => {
  for (const [code, text] of [
    ['offer_exists', 'Du hast für diese Anfrage schon ein Angebot'],
    ['offer_limit', 'schon so viele Angebote'],
    ['amount_out_of_range', 'Der Betrag liegt nicht im erlaubten Bereich'],
    ['vat_rule_missing', 'Steuerangabe'],
  ] as const) {
    test(`${code}`, async ({ page }) => {
      await openJobs(page, { listings: [range()], sendAnswers: [{ status: 400, json: { code: 'P0001', message: code, details: null, hint: null } }] })
      await card(page).getByRole('button', { name: 'Angebot abgeben' }).click()
      await dialog(page).getByLabel('Dein Angebot in Euro').fill('700')
      await dialog(page).getByRole('button', { name: 'Weiter' }).click()
      await dialog(page).getByRole('button', { name: 'Verbindlich senden' }).click()
      await expect(page.getByText(text)).toBeVisible()
      await expect(page.locator('body')).not.toContainText(code)
    })
  }
})

test('Angebot zurückziehen: Bestätigung, dann Status „Zurückgezogen“', async ({ page }) => {
  const { jobs } = await openJobs(page, { listings: [range()], offers: [{ id: O1, base_revision_id: range().revision_id, amount_cents: 70050, status: 'sent', valid_until: '2026-12-03T10:00:00Z' }] })
  await expect(card(page)).toContainText('Angebot gesendet')
  await expect(card(page).getByRole('button', { name: 'Angebot abgeben' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Zurückziehen' }).click()
  await dialog(page).getByRole('button', { name: 'Angebot zurückziehen' }).click()
  await expect(page.getByText('Zurückgezogen')).toBeVisible()
  expect(jobs.withdraws).toEqual([{ p_offer: O1 }])
})

test('Fotos: erst auf Wunsch, nur Kopien vom Server, kein Download', async ({ page }) => {
  const { jobs } = await openJobs(page, { listings: [fixed()] })
  expect(jobs.photoCalls).toEqual([])
  await card(page).getByRole('button', { name: 'Fotos ansehen' }).click()
  await expect(card(page).locator('img')).toHaveCount(1)
  expect(jobs.photoCalls).toEqual([{ listingId: L1 }])
  expect(await card(page).locator('a[download], a[href]').count()).toBe(0)
})

/** Kein einziger Abruf von Anfragen, Angeboten oder Sätzen. */
const noJobReads = (jobs: { listingReads: number; offerReads: number; rateReads: number }) => expect([jobs.listingReads, jobs.offerReads, jobs.rateReads]).toEqual([0, 0, 0])

// Der positive Anker steht hinter der Schranke (Dokumente) bzw. an ihr; erst danach zählt „kein Abruf“ (Abnahme s9i-6a M3)
for (const [status, anchor] of [
  ['pending', 'Dokumente'],
  ['payment_hold', 'Dokumente'],
  ['suspended', 'Transporte Huber GmbH'],
  ['rejected', 'Transporte Huber GmbH'],
] as const) {
  test(`Status ${status}: keine Anfragen und kein Abruf der Liste`, async ({ page }) => {
    const { jobs } = await openJobs(page, { listings: [fixed()] }, { status, aal: 'aal2', factors: [factor('f-1', 'verified')] })
    await expect(page.getByRole('heading', { name: anchor, level: 2 })).toBeVisible()
    await page.waitForLoadState('networkidle')
    noJobReads(jobs) // zuerst die Zähler (Abnahme-Kontrolle K3): ein Abruf ohne sichtbare Überschrift würde hier rot
    await expect(heading(page)).toHaveCount(0)
    await expect(page.getByRole('article')).toHaveCount(0)
  })
}

test('aal1: erst die Abfrage des zweiten Faktors, kein Abruf der Liste', async ({ page }) => {
  const { jobs } = await openJobs(page, { listings: [fixed()] }, { aal: 'aal1', factors: [factor('f-1', 'verified')] })
  await expect(page.getByRole('heading', { name: 'Code eingeben' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  noJobReads(jobs)
  await expect(heading(page)).toHaveCount(0)
})

test('aktive Firma mit aal2: alle drei Abrufe finden statt (Gegenprobe zu den Zustandstests)', async ({ page }) => {
  const { jobs } = await openJobs(page, { listings: [fixed()] })
  await expect(heading(page)).toBeVisible()
  expect(jobs.listingReads).toBeGreaterThanOrEqual(1)
  expect(jobs.offerReads).toBeGreaterThanOrEqual(1)
  expect(jobs.rateReads).toBeGreaterThanOrEqual(1)
})

test('Gewinner-Retry: ging die Antwort der Annahme verloren, zeigt der zweite Versuch „Angenommen“ und nicht „nicht mehr verfügbar“ (Abnahme M1)', async ({ page }) => {
  const { jobs } = await openJobs(page, { listings: [fixed()], acceptAnswers: [{ status: 409, json: { error: 'already_taken' } }] })
  await card(page).getByRole('button', { name: 'Annehmen' }).click()
  // die erste Annahme hat serverseitig gegriffen, nur die Antwort ging verloren: das Listing der Firma steht auf accepted
  jobs.listings = [fixed({ status: 'accepted' })]
  await dialog(page).getByRole('button', { name: 'Verbindlich annehmen' }).click()
  await expect(page.getByRole('heading', { name: 'Angenommen', level: 2 })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('nicht mehr verfügbar')
  expect(jobs.accepts).toHaveLength(1)
})

test('angenommene Anfrage zeigt keine Beträge (Abnahme H1: gilt die Journalzeile, nicht die Momentaufnahme)', async ({ page }) => {
  await openJobs(page, { listings: [fixed({ status: 'accepted' })] })
  await expect(page.getByRole('heading', { name: 'Angenommen', level: 2 })).toBeVisible()
  await expect(card(page)).toContainText('Zuschlag')
  await expect(card(page)).not.toContainText(/€|Du erhältst|Preis/)
})

test('Tastatur: Annahme ohne Maus, Fokus im Sheet, Escape schließt', async ({ page }) => {
  const { jobs } = await openJobs(page, { listings: [fixed()] })
  await card(page).getByRole('button', { name: 'Annehmen' }).focus()
  await page.keyboard.press('Enter')
  await expect(dialog(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  expect(jobs.accepts).toHaveLength(0)
  await card(page).getByRole('button', { name: 'Annehmen' }).focus()
  await page.keyboard.press('Enter')
  const ok = dialog(page).getByRole('button', { name: 'Verbindlich annehmen' })
  await ok.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Angenommen', level: 2 })).toBeVisible()
  expect(jobs.accepts).toHaveLength(1)
})

test('320 × 640 px: im Bestätigungs-Sheet des Angebots sind beide Knöpfe erreichbar (Bildsicht s9i-6a, mittel 4)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await openJobs(page, { listings: [range()] })
  await card(page).getByRole('button', { name: 'Angebot abgeben' }).click()
  await dialog(page).getByLabel('Dein Angebot in Euro').fill('700,50')
  await dialog(page).getByRole('button', { name: 'Weiter' }).click()
  for (const name of ['Verbindlich senden', 'Doch nicht']) {
    const b = dialog(page).getByRole('button', { name })
    await b.scrollIntoViewIfNeeded()
    const box = await b.boundingBox()
    expect(box!.y, `${name} oben`).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height, `${name} unten`).toBeLessThanOrEqual(640)
    expect(box!.height, `${name} hoch`).toBeGreaterThanOrEqual(44)
  }
})

test('Maße: Knöpfe mindestens 44 px, Beträge brechen nie um, keine Überbreite (320, 390, 1280 px)', async ({ page }) => {
  await openJobs(page, { listings: [fixed(), range({ id: L2 })] })
  for (const w of [320, 390, 1280]) {
    await page.setViewportSize({ width: w, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Überbreite bei ${w}`).toBe(true)
    for (const name of ['Annehmen', 'Angebot abgeben', 'Fotos ansehen']) {
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
