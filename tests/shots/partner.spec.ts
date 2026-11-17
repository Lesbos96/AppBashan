import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from '../e2e/backend'
import { A2, change, fixed, job, mockJobs, O1, pgErr, proposed, range, REV1, RQ2, type JobsState } from '../e2e/jobs-helpers'
import { factor, openPartner, PNG_1PX, pgError, storageError, type DocRow, type OpenOpts } from '../e2e/mfa-helpers'

const O2 = '7c6f8a91-2d3e-4f40-b12c-1d0e9f8a7b6c'
const O3 = '8d7a9ba2-3e4f-4051-a23d-2e1f0a9b8c7d'
const A3 = '0a92c3c4-5061-4273-a45f-4a3b2c1d0e9f'
const RQ3 = 'af03d4d5-6172-4384-b560-5b4c3d2e1f0a'

/*
 * Bildsicht für das Partner-Portal (s9i-5a, 5b): Registrierung, Statuskarten je Status, Einrichtung, Code-Abfrage, Dokumente.
 * Aufnahme je Shot-Projekt (Breite und Farbschema des Projekts) nach tmp/shots/<projekt>/partner-<name>.png; in den 390-Projekten zusätzlich bei 320 px
 * (`partner-320-<name>.png`, die Frage aus 5a, S9i5-3). Die Mocks liefern Platzhalter: QR und Schlüssel sind zufällig und gehören zu keinem Konto.
 */

const row = (id: string, kind: string, day: string): DocRow => ({ id, partner_id: 'p-1', kind, uploaded_at: `2026-11-${day}T10:00:00Z` })
const PDF = { name: 'gewerbe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') }

const ACTIVE: OpenOpts = { status: 'active', factors: [factor('v1', 'verified')], aal: 'aal2' }
type Ctx = Awaited<ReturnType<typeof openPartner>> & { jobs: JobsState }
type Shot = { name: string; open: OpenOpts; jobs?: Partial<JobsState>; steps?: (page: Page, ctx: Ctx) => Promise<void>; wait: (page: Page) => Promise<unknown> }

const heading = (name: string) => (page: Page) => expect(page.getByRole('heading', { name })).toBeVisible()

const shots: Shot[] = [
  { name: 'registrierung', open: { noFirm: true }, wait: heading('Firma registrieren') },
  { name: 'pending-einrichtung', open: {}, wait: heading('Sicherheitscode einrichten') },
  {
    name: 'einrichtung-qr',
    open: {},
    steps: async (page) => {
      await page.getByRole('button', { name: 'Einrichtung starten' }).click()
      await expect(page.getByRole('img', { name: /QR-Code/ })).toBeVisible()
    },
    wait: heading('Sicherheitscode einrichten'),
  },
  {
    name: 'einrichtung-falscher-code',
    open: {},
    steps: async (page) => {
      await page.getByRole('button', { name: 'Einrichtung starten' }).click()
      await page.getByLabel('Code', { exact: true }).fill('000000')
      await page.getByRole('button', { name: 'Bestätigen' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
    wait: heading('Sicherheitscode einrichten'),
  },
  { name: 'code-abfrage', open: { factors: [factor('v1', 'verified')] }, wait: heading('Code eingeben') },
  {
    name: 'code-zu-viele-versuche',
    open: { factors: [factor('v1', 'verified')] },
    steps: async (page, { mfa }) => {
      mfa.verifyStatus.push(429)
      await page.getByLabel('Code', { exact: true }).fill('123456')
      await page.getByRole('button', { name: 'Bestätigen' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
    wait: heading('Code eingeben'),
  },
  {
    name: 'code-fokus',
    open: { factors: [factor('v1', 'verified')] },
    steps: async (page) => {
      await page.keyboard.press('Shift')
      await page.getByLabel('Code', { exact: true }).focus()
      await expect(page.getByLabel('Code', { exact: true })).toBeFocused()
    },
    wait: heading('Code eingeben'),
  },
  {
    name: 'dokumente-fokus',
    open: { factors: [factor('v1', 'verified')], aal: 'aal2' },
    steps: async (page) => {
      await page.keyboard.press('Shift')
      await page.getByLabel('Datei', { exact: true }).focus()
      await expect(page.getByLabel('Datei', { exact: true })).toBeFocused()
    },
    wait: heading('Dokumente'),
  },
  { name: 'dokumente-leer', open: { factors: [factor('v1', 'verified')], aal: 'aal2' }, wait: heading('Dokumente') },
  {
    name: 'dokumente-liste',
    open: { factors: [factor('v1', 'verified')], aal: 'aal2', rows: [row('d-1', 'trade_license', '05'), row('d-2', 'other', '06')], files: ['p-1/d-1'] },
    wait: heading('Dokumente'),
  },
  {
    name: 'dokumente-voll',
    open: {
      factors: [factor('v1', 'verified')],
      aal: 'aal2',
      status: 'active',
      rows: ['a', 'b', 'c', 'd', 'e'].map((x, i) => row(`d-${x}`, i === 0 ? 'trade_license' : i === 1 ? 'company_register' : 'other', `0${i + 1}`)),
      files: ['a', 'b', 'c', 'd', 'e'].map((x) => `p-1/d-${x}`),
    },
    wait: heading('Dokumente'),
  },
  {
    name: 'dokumente-upload-abgelehnt',
    open: { factors: [factor('v1', 'verified')], aal: 'aal2' },
    steps: async (page, { docs }) => {
      docs.uploadAnswers.push(storageError(415, 'mime type not supported'))
      await page.getByLabel('Datei', { exact: true }).setInputFiles(PDF)
      await page.getByRole('button', { name: 'Hochladen', exact: true }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
    wait: heading('Dokumente'),
  },
  {
    name: 'dokumente-limit',
    open: { factors: [factor('v1', 'verified')], aal: 'aal2' },
    steps: async (page, { docs }) => {
      docs.insertAnswers.push(pgError(400, 'P0001', 'limit_reached'))
      await page.getByLabel('Datei', { exact: true }).setInputFiles(PDF)
      await page.getByRole('button', { name: 'Hochladen', exact: true }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
    wait: heading('Dokumente'),
  },
  { name: 'status-active', open: { status: 'active', factors: [factor('v1', 'verified')], aal: 'aal2' }, wait: heading('Dokumente') },
  // Anfragen (s9i-6a): aktive Firma mit aal2; Platzhalter-Daten, keine echten Personen (die Mock-Inputs tragen absichtlich fremde Schlüssel, die nie erscheinen)
  { name: 'anfragen-leer', open: ACTIVE, wait: heading('Offene Anfragen') },
  { name: 'anfragen-liste', open: ACTIVE, jobs: { listings: [fixed(), range()] }, wait: heading('Offene Anfragen') },
  {
    name: 'anfragen-fotos',
    open: ACTIVE,
    jobs: { listings: [fixed()] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Fotos ansehen' }).click()
      await expect(page.getByAltText('Foto der Anfrage')).toBeVisible()
    },
    wait: heading('Offene Anfragen'),
  },
  {
    name: 'annahme-sheet',
    open: ACTIVE,
    jobs: { listings: [fixed()] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Annehmen' }).click()
      await expect(page.getByRole('button', { name: 'Verbindlich annehmen' })).toBeVisible()
    },
    wait: heading('Offene Anfragen'),
  },
  {
    name: 'annahme-wettlauf',
    open: ACTIVE,
    jobs: { listings: [fixed()], acceptAnswers: [{ status: 409, json: { error: 'already_taken' } }] },
    steps: async (page, { jobs }) => {
      await page.getByRole('button', { name: 'Annehmen' }).click()
      await page.getByRole('button', { name: 'Verbindlich annehmen' }).click()
      jobs.listings = []
      await expect(page.getByText('Diese Anfrage ist nicht mehr verfügbar')).toBeVisible()
    },
    wait: heading('Offene Anfragen'),
  },
  // Aufträge (s9i-6b): Platzhalterdaten aus tests/e2e/jobs-helpers.ts (keine echten Personen)
  {
    name: 'auftraege-liste',
    open: ACTIVE,
    jobs: { myJobs: [job(), job({ assignment_id: A2, request_id: RQ2, service: 'transport', can_start: true, district: 21, to_district: null, time_window: 'afternoon' }), job({ assignment_id: A3, request_id: RQ3, status: 'in_progress', service: 'clearance', to_district: null })] },
    wait: heading('Angenommen'),
  },
  {
    name: 'auftraege-beendet',
    open: ACTIVE,
    jobs: {
      myJobs: [
        job({ status: 'completed', ended_at: '2026-12-02T12:00:00+00:00', ended_reason: 'completed' }),
        job({ assignment_id: A2, request_id: RQ2, status: 'cancelled_by_customer', ended_at: '2026-12-01T10:00:00+00:00', ended_reason: 'cancelled_by_customer', total_cents: 34481, payout_cents: 29309 }),
        job({ assignment_id: A3, request_id: RQ3, status: 'cancelled_by_partner', ended_at: '2026-12-01T10:00:00+00:00', ended_reason: 'cancelled_by_partner', total_cents: 0, payout_cents: 0 }),
      ],
    },
    wait: heading('Beendet'),
  },
  {
    name: 'auftraege-kontakt',
    open: ACTIVE,
    jobs: { myJobs: [job()] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Kontakt und Adresse anzeigen' }).click()
      await expect(page.getByRole('dialog')).toContainText('Erika Beispiel')
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'auftraege-kontakt-fehler',
    open: ACTIVE,
    jobs: { myJobs: [job()], contactAnswers: [pgErr('not_assigned')] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Kontakt und Adresse anzeigen' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'auftraege-start-sheet',
    open: ACTIVE,
    jobs: { myJobs: [job({ can_start: true })] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Auftrag starten' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'auftraege-abschluss-sheet',
    open: ACTIVE,
    jobs: { myJobs: [job({ status: 'in_progress' })] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Auftrag abschließen' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'auftraege-start-fehler',
    open: ACTIVE,
    jobs: { myJobs: [job({ can_start: true })], startAnswers: [pgErr('too_early')] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Auftrag starten' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Auftrag starten' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  { name: 'auftraege-in-pruefung', open: ACTIVE, jobs: { myJobs: [job({ status: 'in_progress', under_review: true })], changes: [change()] }, wait: heading('Angenommen') },
  { name: 'auftraege-payment-hold', open: { ...ACTIVE, status: 'payment_hold' }, jobs: { myJobs: [job({ can_start: true })] }, wait: heading('Angenommen') },
  { name: 'auftraege-ladefehler', open: ACTIVE, jobs: { jobStatus: [500, 500] }, wait: (page) => expect(page.getByText('Die Aufträge konnten nicht geladen werden')).toBeVisible() },
  // Nachtrag (s9i-7a): Platzhalterdaten aus tests/e2e/jobs-helpers.ts
  { name: 'nachtrag-karte', open: ACTIVE, jobs: { myJobs: [job({ status: 'in_progress' })], changes: [change()] }, wait: heading('Angenommen') },
  { name: 'nachtrag-offen', open: ACTIVE, jobs: { myJobs: [job()], changes: [proposed('proposed')] }, wait: heading('Angenommen') },
  { name: 'nachtrag-abgelehnt', open: ACTIVE, jobs: { myJobs: [job()], changes: [proposed('declined')] }, wait: heading('Angenommen') },
  {
    name: 'nachtrag-formular',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [change()] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Nachtrag vorschlagen' }).click()
      await expect(page.getByRole('dialog').getByLabel('Stunden')).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'nachtrag-betrag',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [change()] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Nachtrag vorschlagen' }).click()
      await page.getByRole('dialog').getByLabel('Stunden').fill('5')
      await page.getByRole('dialog').getByRole('button', { name: 'Betrag prüfen' }).click()
      await expect(page.getByRole('dialog')).toContainText('Neuer Gesamtpreis')
      await page.getByRole('dialog').getByLabel('Belegfoto hinzufügen').setInputFiles({ name: 'beleg.png', mimeType: 'image/png', buffer: PNG_1PX })
      await expect(page.getByRole('dialog')).toContainText('beleg.png')
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'nachtrag-fehler',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [change()], previewAnswers: [{ status: 409, json: { error: 'change_not_increasing' } }] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Nachtrag vorschlagen' }).click()
      await page.getByRole('dialog').getByLabel('Stunden').fill('2')
      await page.getByRole('dialog').getByRole('button', { name: 'Betrag prüfen' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'nachtrag-zurueckziehen-sheet',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [proposed('proposed')] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Nachtrag zurückziehen' }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  // Absage (s9i-7b2): Pauschale 69,00 €, Gebühr 8,28 €, Auszahlung 60,72 € (Staffel v2)
  {
    name: 'absage-grund',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [change()] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Auftrag absagen' }).click()
      await expect(page.getByRole('dialog').getByRole('radio', { name: /Vor Ort anders als gebucht/ })).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'absage-pauschale',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [change()] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Auftrag absagen' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Folgen prüfen' }).click()
      await page.getByRole('dialog').getByRole('radio', { name: /Mit Pauschale/ }).check()
      await page.getByRole('dialog').getByLabel('Belegfoto hinzufügen').setInputFiles({ name: 'beleg.png', mimeType: 'image/png', buffer: PNG_1PX })
      await expect(page.getByRole('dialog')).toContainText('beleg.png')
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'absage-ohne-pauschale',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [change()] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Auftrag absagen' }).click()
      await page.getByRole('dialog').getByRole('radio', { name: /nicht durchführen/ }).check()
      await page.getByRole('dialog').getByRole('button', { name: 'Folgen prüfen' }).click()
      await expect(page.getByRole('dialog')).toContainText('Der Kunde muss nichts zahlen')
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'absage-betrag-geaendert',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [change()] },
    steps: async (page, ctx) => {
      await page.getByRole('button', { name: 'Auftrag absagen' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Folgen prüfen' }).click()
      await page.getByRole('dialog').getByRole('radio', { name: /Mit Pauschale/ }).check()
      await page.getByRole('dialog').getByLabel('Belegfoto hinzufügen').setInputFiles({ name: 'beleg.png', mimeType: 'image/png', buffer: PNG_1PX })
      ctx.jobs.callOut = 8000
      await page.getByRole('dialog').getByRole('button', { name: /^Für .+ absagen$/ }).click()
      await expect(page.getByRole('dialog')).toContainText('Der Betrag hat sich geändert')
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'absage-fehler',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [change()], cancelPreviewAnswers: [{ status: 409, json: { error: 'under_review' } }] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Auftrag absagen' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Folgen prüfen' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  // Journal-CSV (s9i-7c1): Karte „Abrechnung“ unter den Aufträgen, Monatsfeld, Fehlerfall
  { name: 'abrechnung', open: ACTIVE, jobs: { myJobs: [job()], changes: [change()] }, wait: heading('Angenommen') },
  {
    name: 'abrechnung-fehler',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [change()], journalAnswers: [{ status: 400, json: { code: 'P0001', message: 'mfa_required', details: null, hint: null } }] },
    steps: async (page) => {
      await page.getByRole('region', { name: 'Abrechnung' }).getByRole('button', { name: 'Journal herunterladen' }).click()
      await expect(page.getByRole('region', { name: 'Abrechnung' }).getByRole('alert')).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'absage-netzfehler-vorschau',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [change()] },
    steps: async (page) => {
      await page.route('**/functions/v1/cancel-partner', (r) => r.abort('failed'))
      await page.getByRole('button', { name: 'Auftrag absagen' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Folgen prüfen' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  {
    name: 'absage-netzfehler-senden',
    open: ACTIVE,
    jobs: { myJobs: [job()], changes: [change()] },
    steps: async (page) => {
      await page.route('**/functions/v1/cancel-partner', (r) => (r.request().postDataJSON().preview === true ? r.fallback() : r.abort('failed')))
      await page.getByRole('button', { name: 'Auftrag absagen' }).click()
      await page.getByRole('dialog').getByRole('radio', { name: /nicht durchführen/ }).check()
      await page.getByRole('dialog').getByRole('button', { name: 'Folgen prüfen' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Absagen', exact: true }).click()
      await expect(page.getByRole('alert').filter({ hasText: 'Wir wissen nicht, ob die Absage angekommen ist' })).toBeVisible()
    },
    wait: heading('Angenommen'),
  },
  { name: 'absage-karte-ohne-pauschale', open: ACTIVE, jobs: { myJobs: [job({ status: 'cancelled_by_partner', ended_at: '2026-12-01T12:00:00+00:00', ended_reason: 'cancelled_by_partner', total_cents: 0, payout_cents: 0 })] }, wait: heading('Beendet') },
  { name: 'absage-karte-mit-pauschale', open: ACTIVE, jobs: { myJobs: [job({ status: 'cancelled_by_partner', ended_at: '2026-12-01T12:00:00+00:00', ended_reason: 'cancelled_by_partner', total_cents: 6900, payout_cents: 6072 })] }, wait: heading('Beendet') },
  {
    name: 'angebot-eingabe-fehler',
    open: ACTIVE,
    jobs: { listings: [range()] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Angebot abgeben' }).click()
      await page.getByLabel('Dein Angebot in Euro').fill('1,005')
      await page.getByRole('button', { name: 'Weiter' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
    },
    wait: heading('Offene Anfragen'),
  },
  {
    name: 'angebot-bestaetigung',
    open: ACTIVE,
    jobs: { listings: [range()] },
    steps: async (page) => {
      await page.getByRole('button', { name: 'Angebot abgeben' }).click()
      await page.getByLabel('Dein Angebot in Euro').fill('700,50')
      await page.getByRole('button', { name: 'Weiter' }).click()
      await expect(page.getByRole('button', { name: 'Verbindlich senden' })).toBeVisible()
    },
    wait: heading('Offene Anfragen'),
  },
  {
    name: 'meine-angebote',
    open: ACTIVE,
    jobs: {
      listings: [range()],
      offers: [
        { id: O1, base_revision_id: range().revision_id, amount_cents: 70050, status: 'sent', valid_until: '2026-12-03T10:00:00Z' },
        { id: O2, base_revision_id: REV1, amount_cents: 55000, status: 'withdrawn', valid_until: '2026-12-02T10:00:00Z' },
        { id: O3, base_revision_id: REV1, amount_cents: 61000, status: 'superseded', valid_until: '2026-12-02T10:00:00Z' },
      ],
    },
    wait: heading('Meine Angebote'),
  },
  {
    name: 'anfragen-ladefehler',
    open: ACTIVE,
    jobs: { listStatus: [500, 500, 500, 500, 500, 500] },
    wait: (page) => expect(page.getByText('Die Anfragen konnten nicht geladen werden')).toBeVisible({ timeout: 30_000 }),
  },
  { name: 'status-payment-hold', open: { ...ACTIVE, status: 'payment_hold' }, wait: heading('Dokumente') },
  { name: 'status-rejected', open: { status: 'rejected' }, wait: heading('Transporte Huber GmbH') },
  // Gesperrt mit aal2 (s9i7d-1): Statuskarte und Abrechnung, keine Dokumente
  {
    name: 'status-suspended',
    open: { status: 'suspended', factors: [factor('v1', 'verified')], aal: 'aal2' },
    wait: async (page) => {
      await heading('Transporte Huber GmbH')(page)
      await expect(page.getByRole('region', { name: 'Abrechnung' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Dokumente' })).toHaveCount(0)
    },
  },
]

async function take(page: Page, testInfo: TestInfo, name: string) {
  // Nach Klicks steht die Seite weiter unten und die Kopfleiste klebt mitten im Vollbild: für die Aufnahme nach oben
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForFunction(() => window.scrollY === 0)
  await page.waitForTimeout(400) // Kopfleiste blendet den kleinen Titel aus
  await page.screenshot({ path: `tmp/shots/${testInfo.project.name}/partner-${name}.png`, fullPage: true })
}

for (const width of [0, 320]) {
  for (const s of shots) {
    test(`Partner ${width ? `${width} px ` : ''}${s.name}`, async ({ page }, testInfo) => {
      test.skip(width === 320 && !testInfo.project.name.startsWith('shots-390'), 'die 320-px-Aufnahmen entstehen einmal je Farbschema')
      if (width) await page.setViewportSize({ width, height: 640 })
      const jobs = await mockJobs(page, s.jobs)
      const ctx = { ...(await openPartner(page, s.open)), jobs }
      await s.wait(page)
      await s.steps?.(page, ctx)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message: 'keine Überbreite' }).toBe(true)
      await take(page, testInfo, `${width ? `${width}-` : ''}${s.name}`)
    })
  }
}
