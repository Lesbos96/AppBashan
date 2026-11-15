import type { Page } from '@playwright/test'
import { EMAIL, mockAuth, signInWithCode, type AuthCalls } from './auth-helpers'
import { cors, expect, test } from './backend'
import { collectErrors } from './console'
import { addPhotos } from './konfigurator-helpers'

/*
 * Konto löschen im Profil (s9i-4). `delete-account` ist gemockt; geprüft wird, dass die App nur nach ausdrücklicher Bestätigung
 * genau `{ confirm: true }` sendet, danach abmeldet und Fehler des Servers in Worten zeigt.
 */

type Answer = { status?: number; json?: unknown; abort?: true; delay?: number }
type State = { bodies: unknown[]; answers: Answer[] }

async function mock(page: Page, answers: Answer[]): Promise<State> {
  const state: State = { bodies: [], answers }
  await page.route('**/functions/v1/delete-account', async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    state.bodies.push(r.request().postDataJSON())
    const a = state.answers.shift() ?? { status: 500, json: { error: 'internal' } }
    if (a.delay) await new Promise((res) => setTimeout(res, a.delay))
    if (a.abort) return r.abort('failed')
    return r.fulfill({ status: a.status ?? 200, headers: cors, json: a.json ?? { deleted: true } })
  })
  return state
}

async function open(page: Page): Promise<AuthCalls> {
  const calls = await mockAuth(page)
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  await page.goto('/anmelden?next=%2Fprofil')
  await signInWithCode(page)
  await expect(page).toHaveURL(/\/profil$/)
  await expect(page.getByRole('heading', { name: 'Angemeldet' })).toBeVisible()
  return calls
}

const sheet = (page: Page) => page.getByRole('dialog', { name: 'Konto löschen' })
const confirmBox = (page: Page) => sheet(page).getByRole('checkbox', { name: 'Ich will mein Konto endgültig löschen.' })
const deleteButton = (page: Page) => sheet(page).getByRole('button', { name: 'Konto endgültig löschen' })
const noFee = (page: Page) => expect(page.locator('body')).not.toContainText(/Plattform|Provision|15 ?%|MoveNow-Gebühr/)

async function openSheet(page: Page) {
  await page.getByRole('link', { name: 'Konto löschen' }).click()
  await expect(sheet(page)).toBeVisible()
}

test('abgemeldet: keine Zeile „Konto löschen“, der Pfad öffnet kein Sheet', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  await page.goto('/profil')
  await expect(page.getByRole('heading', { name: 'Noch kein Konto' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Konto löschen' })).toHaveCount(0)
  await page.goto('/profil/konto-loeschen')
  await expect(page.getByRole('heading', { name: 'Noch kein Konto' })).toBeVisible()
  await expect(sheet(page)).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Löschen per Tastatur: erst nach dem Häkchen, sendet genau { confirm: true }, meldet ab', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  const calls = await open(page)
  const state = await mock(page, [{ json: { deleted: true } }])
  const logouts: string[] = []
  page.on('request', (r) => r.url().includes('/auth/v1/logout') && logouts.push(r.url()))
  await page.getByRole('link', { name: 'Konto löschen' }).focus()
  await page.keyboard.press('Enter')
  await expect(sheet(page)).toBeVisible()
  await expect(sheet(page)).toContainText('nicht rückgängig')
  await expect(sheet(page)).toContainText('Offene Aufträge')
  await expect(sheet(page)).toContainText(EMAIL)
  await expect(deleteButton(page)).toBeDisabled()
  await confirmBox(page).focus()
  await page.keyboard.press('Space')
  await expect(confirmBox(page)).toBeChecked()
  await expect(deleteButton(page)).toBeEnabled()
  expect((await deleteButton(page).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  expect((await sheet(page).locator('label').filter({ hasText: 'Ich will mein Konto endgültig löschen.' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await deleteButton(page).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status').filter({ hasText: 'Dein Konto ist gelöscht.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Noch kein Konto' })).toBeVisible()
  await expect(sheet(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/profil$/)
  expect(state.bodies).toEqual([{ confirm: true }])
  expect(calls.logout).toBeGreaterThanOrEqual(1)
  // nur lokal abgemeldet; Sitzung und Entwürfe sind aus dem Speicher
  expect(logouts.length).toBeGreaterThanOrEqual(1)
  expect(logouts.every((u) => new URL(u).searchParams.get('scope') === 'local')).toBe(true)
  expect(await page.evaluate(() => ({ session: sessionStorage.length, auth: Object.keys(localStorage).filter((k) => k.startsWith('sb-')) }))).toEqual({ session: 0, auth: [] })
  await noFee(page)
  expect(errors).toEqual([])
})

test('Fotos eines Entwurfs sind nach dem Löschen nicht mehr im Speicher', { tag: '@breit' }, async ({ page }) => {
  await open(page)
  await mock(page, [{ json: { deleted: true } }])
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' })
  await nav.getByRole('link', { name: 'Start' }).click()
  await page.getByRole('link', { name: /Möbeltransport/ }).click()
  await expect(page).toHaveURL(/\/transport$/)
  await addPhotos(page, 1)
  await expect(page.getByRole('img', { name: 'Foto 1' })).toBeVisible()
  await page.goBack()
  await nav.getByRole('link', { name: 'Profil' }).click()
  await openSheet(page)
  await confirmBox(page).check()
  await deleteButton(page).click()
  await expect(page.getByRole('status').filter({ hasText: 'Dein Konto ist gelöscht.' })).toBeVisible()
  await nav.getByRole('link', { name: 'Start' }).click()
  await page.getByRole('link', { name: /Möbeltransport/ }).click()
  await expect(page.locator('input[type=file][multiple]')).toHaveCount(1)
  await expect(page.getByRole('img', { name: 'Foto 1' })).toHaveCount(0)
})

test('Schließen über Zurück: beim nächsten Öffnen kein Häkchen, Knopf gesperrt, nichts gesendet', { tag: '@breit' }, async ({ page }) => {
  await open(page)
  const state = await mock(page, [{ status: 500, json: { error: 'internal' } }])
  await openSheet(page)
  await confirmBox(page).check()
  await deleteButton(page).click()
  await expect(sheet(page).getByRole('alert')).toBeVisible()
  await page.goBack()
  await expect(sheet(page)).toHaveCount(0)
  await openSheet(page)
  await expect(confirmBox(page)).not.toBeChecked()
  await expect(deleteButton(page)).toBeDisabled()
  await expect(sheet(page).getByRole('alert')).toHaveCount(0)
  expect(state.bodies).toHaveLength(1)
})

test('409 open_requests: Weg zu den Aufträgen', { tag: '@breit' }, async ({ page }) => {
  await open(page)
  await mock(page, [{ status: 409, json: { error: 'open_requests' } }])
  await openSheet(page)
  await confirmBox(page).check()
  await deleteButton(page).click()
  const link = sheet(page).getByRole('link', { name: 'Zu den Aufträgen' })
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await link.click()
  await expect(page).toHaveURL(/\/auftraege$/)
})

test('401: Sitzung gilt nicht mehr, lokal abgemeldet, neutraler Hinweis im Profil, kein zweiter Aufruf', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  await open(page)
  const state = await mock(page, [{ status: 401, json: { error: 'unauthorized' } }])
  const logouts: string[] = []
  page.on('request', (r) => r.url().includes('/auth/v1/logout') && logouts.push(r.url()))
  await openSheet(page)
  await confirmBox(page).check()
  await deleteButton(page).click()
  await expect(page.getByRole('status').filter({ hasText: 'Deine Anmeldung gilt nicht mehr' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Noch kein Konto' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Konto löschen' })).toHaveCount(0)
  expect(state.bodies).toEqual([{ confirm: true }])
  expect(logouts.length).toBeGreaterThanOrEqual(1)
  expect(logouts.every((u) => new URL(u).searchParams.get('scope') === 'local')).toBe(true)
  expect(await page.evaluate(() => ({ session: sessionStorage.length, auth: Object.keys(localStorage).filter((k) => k.startsWith('sb-')) }))).toEqual({ session: 0, auth: [] })
  expect(errors.filter((e) => !/status of 401/.test(e))).toEqual([])
})

test('Doppelklick sendet genau einen Aufruf', { tag: '@breit' }, async ({ page }) => {
  await open(page)
  const state = await mock(page, [{ json: { deleted: true }, delay: 800 }, { json: { deleted: true } }])
  await openSheet(page)
  await confirmBox(page).check()
  await deleteButton(page).dblclick()
  await expect(page.getByRole('status').filter({ hasText: 'Dein Konto ist gelöscht.' })).toBeVisible()
  expect(state.bodies).toHaveLength(1)
})

test('„Doch nicht“ sendet nichts und bleibt angemeldet', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  const calls = await open(page)
  const state = await mock(page, [])
  await openSheet(page)
  await confirmBox(page).check()
  await sheet(page).getByRole('button', { name: 'Doch nicht' }).click()
  await expect(sheet(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/profil$/)
  await expect(page.getByRole('heading', { name: 'Angemeldet' })).toBeVisible()
  await openSheet(page)
  await expect(confirmBox(page)).not.toBeChecked()
  await expect(deleteButton(page)).toBeDisabled()
  expect(state.bodies).toEqual([])
  expect(calls.logout).toBe(0)
  expect(errors).toEqual([])
})

for (const [status, error, text] of [
  [409, 'open_requests', 'Du hast noch offene Aufträge'],
  [409, 'under_review', 'Wir prüfen ihn noch'],
  [403, 'role_not_allowed', 'Partner-Konten lassen sich nicht in der App löschen'],
  [500, 'internal', 'Das hat nicht geklappt'],
  [200, 'kein deleted', 'Das hat nicht geklappt'],
] as const) {
  test(`${status} ${error}: Text im Sheet, bleibt angemeldet`, { tag: '@breit' }, async ({ page }) => {
    const errors = collectErrors(page)
    const calls = await open(page)
    const state = await mock(page, [{ status, json: status === 200 ? { deleted: false } : { error } }])
    await openSheet(page)
    await confirmBox(page).check()
    await deleteButton(page).click()
    await expect(sheet(page).getByRole('alert')).toContainText(text)
    await expect(sheet(page)).toBeVisible()
    expect(state.bodies).toEqual([{ confirm: true }])
    expect(calls.logout).toBe(0)
    await noFee(page)
    expect(errors.filter((e) => !/status of (409|403|500)/.test(e))).toEqual([])
  })
}

test('Netzfehler: Hinweis, zweiter Versuch löscht', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  const calls = await open(page)
  const state = await mock(page, [{ abort: true }, { json: { deleted: true } }])
  await openSheet(page)
  await confirmBox(page).check()
  await deleteButton(page).click()
  await expect(sheet(page).getByRole('alert')).toContainText('Keine Verbindung')
  expect(calls.logout).toBe(0)
  await deleteButton(page).click()
  await expect(page.getByRole('status').filter({ hasText: 'Dein Konto ist gelöscht.' })).toBeVisible()
  expect(state.bodies).toEqual([{ confirm: true }, { confirm: true }])
  expect(errors.filter((e) => !/ERR_FAILED|Failed to fetch|FunctionsFetchError/.test(e))).toEqual([])
})

test('Während das Löschen läuft, schließt nichts das Sheet und der Knopf ist gesperrt', { tag: '@breit' }, async ({ page }) => {
  await open(page)
  const state = await mock(page, [{ json: { deleted: true }, delay: 1500 }])
  await openSheet(page)
  await confirmBox(page).check()
  await deleteButton(page).click()
  await expect(deleteButton(page)).toBeDisabled()
  await deleteButton(page).click({ force: true })
  await page.keyboard.press('Escape')
  await expect(sheet(page)).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Dein Konto ist gelöscht.' })).toBeVisible()
  expect(state.bodies).toHaveLength(1)
})

for (const width of [390, 430, 1280]) {
  test(`Maße bei ${width} px: kein waagerechtes Scrollen, Zeile und Knöpfe mindestens 44 px hoch`, { tag: '@breit' }, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await open(page)
    await mock(page, [])
    expect((await page.getByRole('link', { name: 'Konto löschen' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await openSheet(page)
    await confirmBox(page).check()
    for (const b of [deleteButton(page), sheet(page).getByRole('button', { name: 'Doch nicht' })]) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
