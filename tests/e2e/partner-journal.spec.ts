import { readFileSync } from 'node:fs'
import type { Download, Page } from '@playwright/test'
import { expect, test } from './backend'
import { collectErrors } from './console'
import { openJobs, type JobsState } from './jobs-helpers'

/*
 * Partner-Portal 3c (s9i-7c1): Journal der Firma als CSV. Backend gemockt (tests/e2e/jobs-helpers.ts: `rpc/my_commissions` wie PostgREST mit Range und content-range).
 * Was der Server erzwingt (aal2, eigene Firma, keine Kundendaten, Summen), belegt tests/rls/journal-live.test.ts; die Dateiregeln tests/unit/journal-csv.test.ts.
 * Hier: Karte, Download, Dateiinhalt, genau ein Aufruf bei Doppelklick, Fehlertexte, Tastatur.
 */

const real = (errors: string[]) => errors.filter((e) => !e.startsWith('Failed to load resource'))
const REQ = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const E1 = '11111111-1111-4111-8111-111111111111'
const E2 = '22222222-2222-4222-8222-222222222222'
const base = { request_id: REQ, created_at: '2026-10-05T08:30:00+00:00', fee_rate: 0.15, billing_month: '2026-10-01', reverses_entry_id: null }
const COMMISSIONS = [
  { ...base, entry_id: E1, kind: 'booking', total_cents: 6900, fee_net_cents: 863, fee_vat_cents: 172, fee_cents: 1035, payout_cents: 5865 },
  { ...base, entry_id: E2, kind: 'cancellation', reverses_entry_id: E1, total_cents: -6900, fee_net_cents: -863, fee_vat_cents: -172, fee_cents: -1035, payout_cents: -5865 },
]
const open = (page: Page, init: Partial<JobsState> = {}) => openJobs(page, { commissions: COMMISSIONS, ...init })
const card = (page: Page) => page.getByRole('region', { name: 'Abrechnung' })
const month = (page: Page) => card(page).getByLabel('Monat')
const button = (page: Page) => card(page).getByRole('button', { name: 'Journal herunterladen' })
const text = async (d: Download) => readFileSync(await d.path())

async function pick(page: Page, m: string) {
  await month(page).fill(m)
}
async function download(page: Page, act: () => Promise<void>) {
  const [d] = await Promise.all([page.waitForEvent('download'), act()])
  return d
}

test('Karte: Überschrift, Monatsfeld mit Label und Format-Hinweis, Knopf, Hinweis auf den Abschlussmonat', async ({ page }) => {
  const errors = collectErrors(page)
  await open(page)
  await expect(card(page).getByRole('heading', { name: 'Abrechnung' })).toBeVisible()
  await expect(month(page)).toBeVisible()
  await expect(month(page)).toHaveValue(/^\d{4}-(0[1-9]|1[0-2])$/)
  await expect(card(page)).toContainText('JJJJ-MM')
  await expect(card(page)).toContainText('im Monat ihres Abschlusses')
  await expect(button(page)).toBeEnabled()
  expect(real(errors)).toEqual([])
})

test('Download: Dateiname, BOM, Kopfzeile, Zeilen mit Cent-Beträgen, ein Aufruf mit Monatsanfang, count exact und fester Spaltenliste', async ({ page }) => {
  const errors = collectErrors(page)
  const { jobs } = await open(page)
  await pick(page, '2026-10')
  const d = await download(page, () => button(page).click())
  expect(d.suggestedFilename()).toBe('movenow-journal-2026-10.csv')
  const bytes = await text(d)
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  const lines = bytes.toString('utf8').slice(1).split('\r\n')
  expect(lines[0]).toBe('Abrechnungsmonat;Buchungszeit;Auftrag;Art;Bezug;Betrag Kunde;Satz;Provision netto;USt.;Provision brutto;Auszahlung Firma;Journal-ID')
  expect(lines[1]).toBe(`2026-10;05.10.2026 10:30;${REQ};Buchung (booking);;69,00;0,15;8,63;1,72;10,35;58,65;${E1}`)
  expect(lines[2]).toBe(`2026-10;05.10.2026 10:30;${REQ};Storno-Gegenbuchung (cancellation);${E1};-69,00;0,15;-8,63;-1,72;-10,35;-58,65;${E2}`)
  expect(lines).toHaveLength(4)
  expect(jobs.journalCalls).toHaveLength(1)
  expect(jobs.journalCalls[0]).toMatchObject({ month: '2026-10-01' })
  expect(jobs.journalCalls[0]!.prefer).toContain('count=exact')
  const q = new URL(jobs.journalCalls[0]!.url).searchParams
  expect([q.get('offset'), q.get('limit'), q.get('order')]).toEqual(['0', '1000', 'created_at.asc,entry_id.asc'])
  const sel = q.get('select')
  expect(sel?.split(',').map((c) => c.trim())).toEqual(['entry_id', 'request_id', 'kind', 'reverses_entry_id', 'created_at', 'total_cents', 'fee_rate', 'fee_net_cents', 'fee_vat_cents', 'fee_cents', 'payout_cents', 'billing_month'])
  expect(bytes.toString('utf8')).not.toMatch(/partner_name|Testfirma/)
  expect(real(errors)).toEqual([])
})

test('Doppelklick: genau ein Aufruf und genau eine Datei; während des Ladens ist der Knopf gesperrt', async ({ page }) => {
  const { jobs } = await open(page)
  await pick(page, '2026-10')
  let downloads = 0
  page.on('download', () => downloads++)
  await button(page).dblclick()
  await expect.poll(() => downloads).toBe(1)
  await page.waitForTimeout(700)
  expect(downloads).toBe(1)
  expect(jobs.journalCalls).toHaveLength(1)
  await expect(button(page)).toBeEnabled()
})

test('Ladezustand: während der Anfrage sind Knopf und Monatsfeld gesperrt, der Knopf nennt den Zustand', async ({ page }) => {
  await open(page)
  await pick(page, '2026-10')
  // Antwort um 800 ms verzögern; `fallback` reicht an den Mock von `mockJobs` weiter
  await page.route('**/rest/v1/rpc/my_commissions**', async (r) => {
    await new Promise((res) => setTimeout(res, 800))
    await r.fallback()
  })
  const pending = page.waitForEvent('download')
  await button(page).click()
  await expect(card(page).getByRole('button', { name: 'Wird erstellt …' })).toBeDisabled()
  await expect(month(page)).toBeDisabled()
  const d = await pending
  expect(d.suggestedFilename()).toBe('movenow-journal-2026-10.csv')
  await expect(button(page)).toBeEnabled()
})

for (const status of ['pending', 'active', 'payment_hold', 'suspended', 'rejected'] as const) {
  test(`Firmenstatus ${status}: Karte ${status === 'active' || status === 'payment_hold' ? 'sichtbar' : 'nicht vorhanden, kein Aufruf'}`, async ({ page }) => {
    const { jobs } = await openJobs(page, { commissions: COMMISSIONS }, { status })
    if (status === 'pending' || status === 'active' || status === 'payment_hold') await expect(page.getByRole('heading', { name: 'Dokumente' })).toBeVisible()
    else await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
    await expect(card(page)).toHaveCount(status === 'active' || status === 'payment_hold' ? 1 : 0)
    expect(jobs.journalCalls).toEqual([])
  })
}

test('aal1: hinter der Schranke (zweiter Faktor), keine Karte', async ({ page }) => {
  const { jobs } = await openJobs(page, { commissions: COMMISSIONS }, { aal: 'aal1' })
  await expect(page.getByPlaceholder('Ziffern')).toBeVisible()
  await expect(card(page)).toHaveCount(0)
  expect(jobs.journalCalls).toEqual([])
})

test('leerer Zeitraum: Datei nur mit Kopfzeile, kein Fehler', async ({ page }) => {
  await open(page)
  await pick(page, '2026-09')
  const d = await download(page, () => button(page).click())
  expect(d.suggestedFilename()).toBe('movenow-journal-2026-09.csv')
  expect((await text(d)).toString('utf8').slice(1).split('\r\n').filter(Boolean)).toHaveLength(1)
  await expect(card(page).getByRole('alert')).toHaveCount(0)
})

test('Tastatur: Monatsfeld, Tab zum Knopf, Enter lädt herunter', async ({ page }) => {
  const { jobs } = await open(page)
  await pick(page, '2026-10')
  await month(page).focus()
  // Das Monatsfeld hat Teilfelder (Monat, Jahr, Auswahl): Tab geht weiter, bis der Knopf dran ist
  for (let i = 0; i < 6 && !(await button(page).evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
  await expect(button(page)).toBeFocused()
  const d = await download(page, () => page.keyboard.press('Enter'))
  expect(d.suggestedFilename()).toBe('movenow-journal-2026-10.csv')
  expect(jobs.journalCalls).toHaveLength(1)
})

test('Monat leer: Fehlertext ohne Aufruf', async ({ page }) => {
  const { jobs } = await open(page)
  await month(page).fill('')
  await button(page).click()
  await expect(card(page).getByRole('alert')).toContainText('Monat')
  expect(jobs.journalCalls).toEqual([])
})

for (const [name, answer, textRe] of [
  ['aal1 (mfa_required)', { status: 400, json: { code: 'P0001', message: 'mfa_required', details: null, hint: null } }, /Anmeldung ist abgelaufen/],
  ['keine Firma (not_found)', { status: 400, json: { code: 'P0001', message: 'not_found', details: null, hint: null } }, /nicht mehr verfügbar/],
  ['Serverfehler', { status: 500, json: { code: 'XX000', message: 'boom', details: null, hint: null } }, /Das hat nicht geklappt/],
  ['Netzfehler', 'abort', /Keine Verbindung/],
] as const) {
  test(`Fehler ${name}: Text im Alert, keine Datei, Knopf wieder bedienbar, zweiter Versuch klappt`, async ({ page }) => {
    const errors = collectErrors(page)
    const { jobs } = await open(page, { journalAnswers: [answer as never] })
    await pick(page, '2026-10')
    let downloads = 0
    page.on('download', () => downloads++)
    await button(page).click()
    await expect(card(page).getByRole('alert')).toContainText(textRe)
    expect(downloads).toBe(0)
    await expect(button(page)).toBeEnabled()
    const d = await download(page, () => button(page).click())
    expect(d.suggestedFilename()).toBe('movenow-journal-2026-10.csv')
    await expect(card(page).getByRole('alert')).toHaveCount(0)
    expect(jobs.journalCalls).toHaveLength(2)
    expect(real(errors).filter((e) => !/Failed to fetch|ERR_FAILED/.test(e))).toEqual([])
  })
}
