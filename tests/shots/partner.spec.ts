import type { Page, TestInfo } from '@playwright/test'
import { expect, test } from '../e2e/backend'
import { factor, openPartner, pgError, storageError, type DocRow, type OpenOpts } from '../e2e/mfa-helpers'

/*
 * Bildsicht für das Partner-Portal (s9i-5a, 5b): Registrierung, Statuskarten je Status, Einrichtung, Code-Abfrage, Dokumente.
 * Aufnahme je Shot-Projekt (Breite und Farbschema des Projekts) nach tmp/shots/<projekt>/partner-<name>.png; in den 390-Projekten zusätzlich bei 320 px
 * (`partner-320-<name>.png`, die Frage aus 5a, S9i5-3). Die Mocks liefern Platzhalter: QR und Schlüssel sind zufällig und gehören zu keinem Konto.
 */

const row = (id: string, kind: string, day: string): DocRow => ({ id, partner_id: 'p-1', kind, uploaded_at: `2026-11-${day}T10:00:00Z` })
const PDF = { name: 'gewerbe.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') }

type Shot = { name: string; open: OpenOpts; steps?: (page: Page, ctx: Awaited<ReturnType<typeof openPartner>>) => Promise<void>; wait: (page: Page) => Promise<unknown> }

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
  { name: 'status-rejected', open: { status: 'rejected' }, wait: heading('Transporte Huber GmbH') },
  { name: 'status-suspended', open: { status: 'suspended' }, wait: heading('Transporte Huber GmbH') },
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
      const ctx = await openPartner(page, s.open)
      await s.wait(page)
      await s.steps?.(page, ctx)
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), { message: 'keine Überbreite' }).toBe(true)
      await take(page, testInfo, `${width ? `${width}-` : ''}${s.name}`)
    })
  }
}
