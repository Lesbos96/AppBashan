import type { Page } from '@playwright/test'
import { mockAuth, signInWithCode } from './auth-helpers'
import { cors, expect, rest, test } from './backend'
import { collectErrors } from './console'

/*
 * Partner-Portal 1a (s9i-5a): Registrierung und Status der eigenen Firma unter /partner.
 * `register_partner` und die Mitgliedschaft (`partner_members`) sind gemockt; Fehlerformen wie bei PostgREST (P0001 mit `message`, 42501, 23514, 23505).
 * Geprüft wird, dass nur die zwölf p_*-Schlüssel gesendet werden, Fehler in Worten erscheinen und je Status der richtige Inhalt steht.
 */

type Firm = { id: string; name: string; status: string; status_reason: string | null }
type Answer = { status?: number; json?: unknown; abort?: true; delay?: number; firmAfter?: Firm | null }
type State = { bodies: Record<string, unknown>[]; answers: Answer[]; firm: Firm | null; loads: number; failLoads: number }

const PENDING: Firm = { id: 'p-1', name: 'Transporte Huber GmbH', status: 'pending', status_reason: null }
const pgError = (status: number, code: string, message: string) => ({ status, json: { code, message, details: null, hint: null } })
const noFee = (page: Page) => expect(page.locator('body')).not.toContainText(/Plattform|Provision|Gebühr|15 ?%/)

async function mock(page: Page, opts: { firm?: Firm | null; answers?: Answer[]; failLoads?: number } = {}): Promise<State> {
  const state: State = { bodies: [], answers: opts.answers ?? [], firm: opts.firm ?? null, loads: 0, failLoads: opts.failLoads ?? 0 }
  await page.route('**/rest/v1/partner_members**', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    state.loads++
    if (state.failLoads > 0) {
      state.failLoads--
      return r.fulfill({ status: 500, headers: cors, json: { code: 'XX000', message: 'boom' } })
    }
    return rest(r, state.firm ? [{ partners: state.firm }] : [])
  })
  await page.route('**/rest/v1/rpc/register_partner', async (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    state.bodies.push(r.request().postDataJSON() as Record<string, unknown>)
    const a = state.answers.shift() ?? { json: PENDING.id, firmAfter: PENDING }
    if (a.delay) await new Promise((res) => setTimeout(res, a.delay))
    if (a.abort) return r.abort('failed')
    if ('firmAfter' in a) state.firm = a.firmAfter ?? null
    else if (!a.status || a.status < 400) state.firm = PENDING
    return r.fulfill({ status: a.status ?? 200, headers: cors, json: a.json ?? PENDING.id })
  })
  return state
}

async function open(page: Page, path = '/partner') {
  await mockAuth(page)
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  await page.goto(`/anmelden?next=${encodeURIComponent(path)}`)
  await signInWithCode(page)
  await expect(page).toHaveURL(new RegExp(`${path}$`))
}

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true })
const district = (page: Page, n: number) => page.getByRole('checkbox', { name: `Bezirk ${n}`, exact: true })
const terms = (page: Page) => page.getByRole('checkbox', { name: /Partnerbedingungen/ })
const small = (page: Page) => page.getByRole('checkbox', { name: /Kleinunternehmer/ })
const submit = (page: Page) => page.getByRole('button', { name: 'Registrierung senden' })

const BODY = {
  p_name: 'Transporte Huber GmbH',
  p_legal_form: 'gmbh',
  p_uid: 'ATU12345678',
  p_small_business: false,
  p_street: 'Teststraße 1',
  p_postcode: '1010',
  p_city: 'Wien',
  p_contact_name: 'Max Huber',
  p_contact_phone: '+43 660 1234567',
  p_contact_email: 'firma@beispiel.at',
  p_districts: [1, 3],
  p_terms_version: 'partner-2026-11-entwurf',
}

/** Füllt das Formular; Häkchen per Leertaste, wie mit der Tastatur. `uid` null = Feld leer lassen. */
async function fill(page: Page, o: { uid?: string | null; smallBusiness?: boolean; districts?: number[] } = {}) {
  await field(page, 'Firmenname').fill(BODY.p_name)
  await field(page, 'Rechtsform').selectOption('gmbh')
  if (o.smallBusiness) {
    await small(page).focus()
    await page.keyboard.press('Space')
  }
  if (o.uid !== null) await field(page, 'UID-Nummer').fill(o.uid ?? ' atu12345678 ')
  await field(page, 'Straße').fill(BODY.p_street)
  await field(page, 'PLZ').fill(BODY.p_postcode)
  await field(page, 'Ort').fill(BODY.p_city)
  await field(page, 'Kontaktperson').fill(BODY.p_contact_name)
  await field(page, 'Telefon').fill(BODY.p_contact_phone)
  await field(page, 'E-Mail').fill(BODY.p_contact_email)
  for (const n of o.districts ?? [3, 1]) {
    await district(page, n).focus()
    await page.keyboard.press('Space')
  }
  await terms(page).focus()
  await page.keyboard.press('Space')
}

test('nicht angemeldet: /partner führt zur Anmeldung und danach zurück', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  await mockAuth(page)
  await mock(page)
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  await page.goto('/partner')
  await expect(page).toHaveURL(/\/anmelden/)
  await signInWithCode(page)
  await expect(page).toHaveURL(/\/partner$/)
  await expect(page.getByRole('heading', { name: 'Partner', level: 1 })).toBeVisible()
  expect(errors).toEqual([])
})

test('Konto ohne Firma: Registrierformular mit Entwurfshinweis und Hinweis auf Endgültigkeit', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  const state = await mock(page)
  await open(page)
  await expect(page.getByRole('heading', { name: 'Firma registrieren' })).toBeVisible()
  for (const label of ['Firmenname', 'Rechtsform', 'UID-Nummer', 'Straße', 'PLZ', 'Ort', 'Kontaktperson', 'Telefon', 'E-Mail']) await expect(field(page, label)).toBeVisible()
  await expect(small(page)).not.toBeChecked()
  await expect(page.getByRole('group', { name: 'Bezirke' }).getByRole('checkbox')).toHaveCount(23)
  await expect(terms(page)).not.toBeChecked()
  await expect(page.getByText(/Entwurf/)).toBeVisible()
  await expect(page.getByText(/nicht zurückziehen/)).toBeVisible()
  await expect(page.getByText(/endgültig/)).toBeVisible()
  await expect(page.getByText(/Konto nicht mehr in der App löschen/)).toBeVisible()
  expect(state.bodies).toEqual([])
  await noFee(page)
  expect(errors).toEqual([])
})

test('Pflichtfelder: leeres Absenden zeigt je Feld einen Text, sendet nichts und setzt den Fokus auf das erste Feld', { tag: '@breit' }, async ({ page }) => {
  const state = await mock(page)
  await open(page)
  await submit(page).click()
  for (const label of ['Firmenname', 'UID-Nummer', 'Straße', 'PLZ', 'Ort', 'Kontaktperson', 'Telefon', 'E-Mail']) await expect(field(page, label), label).toHaveAttribute('aria-invalid', 'true')
  await expect(district(page, 1)).toHaveAttribute('aria-invalid', 'true')
  await expect(terms(page)).toHaveAttribute('aria-invalid', 'true')
  await expect(field(page, 'Firmenname')).toBeFocused()
  expect(state.bodies).toEqual([])
  // Ein Feld nach dem anderen: der Fehler verschwindet, sobald die Eingabe stimmt
  await field(page, 'Firmenname').fill('Transporte Huber GmbH')
  await expect(field(page, 'Firmenname')).not.toHaveAttribute('aria-invalid', 'true')
  // Format: PLZ und UID
  await field(page, 'PLZ').fill('101')
  await field(page, 'UID-Nummer').fill('ATU12')
  await expect(field(page, 'PLZ')).toHaveAttribute('aria-invalid', 'true')
  await expect(field(page, 'UID-Nummer')).toHaveAttribute('aria-invalid', 'true')
  await field(page, 'PLZ').fill('1010')
  await field(page, 'UID-Nummer').fill('atu12345678')
  await expect(field(page, 'PLZ')).not.toHaveAttribute('aria-invalid', 'true')
  await expect(field(page, 'UID-Nummer')).not.toHaveAttribute('aria-invalid', 'true')
  expect(state.bodies).toEqual([])
})

test('Registrieren per Tastatur: genau die zwölf Schlüssel, danach Status „In Prüfung“', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  const state = await mock(page)
  await open(page)
  await fill(page)
  await submit(page).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Transporte Huber GmbH' })).toBeVisible()
  await expect(page.getByText('In Prüfung', { exact: true })).toBeVisible()
  await expect(field(page, 'Firmenname')).toHaveCount(0)
  // das Formular ist weg, der Fokus liegt auf der Statuskarte statt auf body
  await expect(page.getByRole('heading', { name: 'Transporte Huber GmbH' })).toBeFocused()
  expect(state.bodies).toEqual([BODY])
  await noFee(page)
  expect(errors).toEqual([])
})

test('Kleinunternehmer ohne UID: p_uid null, p_small_business true', { tag: '@breit' }, async ({ page }) => {
  const state = await mock(page)
  await open(page)
  await fill(page, { smallBusiness: true, uid: null })
  await submit(page).click()
  await expect(page.getByText('In Prüfung', { exact: true })).toBeVisible()
  expect(state.bodies).toEqual([{ ...BODY, p_uid: null, p_small_business: true }])
})

test('Doppelklick sendet genau einen Aufruf', { tag: '@breit' }, async ({ page }) => {
  const state = await mock(page, { answers: [{ json: PENDING.id, firmAfter: PENDING, delay: 800 }] })
  await open(page)
  await fill(page)
  await submit(page).dblclick()
  await expect(page.getByText('In Prüfung', { exact: true })).toBeVisible()
  expect(state.bodies).toHaveLength(1)
})

test('already_member (zweites Gerät, Firma existiert schon): lädt den Status neu, kein Fehler', { tag: '@breit' }, async ({ page }) => {
  const state = await mock(page, { answers: [{ ...pgError(400, 'P0001', 'already_member'), firmAfter: { ...PENDING, status: 'rejected', status_reason: 'Unterlagen unvollständig' } }] })
  await open(page)
  await expect(field(page, 'Firmenname')).toBeVisible()
  await fill(page)
  await submit(page).click()
  await expect(page.getByText('Abgelehnt', { exact: true })).toBeVisible()
  await expect(page.getByText('Unterlagen unvollständig')).toBeVisible()
  expect(state.bodies).toHaveLength(1)
  expect(state.loads).toBeGreaterThanOrEqual(2)
})

for (const [name, answer, text] of [
  ['not_customer', pgError(403, '42501', 'not_customer'), 'Mit diesem Konto kannst du dich nicht als Partner registrieren'],
  ['not_authenticated', pgError(403, '42501', 'not_authenticated'), 'Melde dich neu an'],
  ['JWT abgelaufen', pgError(401, 'PGRST301', 'JWT expired'), 'Melde dich neu an'],
  ['scope_incomplete', pgError(400, 'P0001', 'scope_incomplete'), 'Prüfe die Angaben'],
  ['Check 23514', pgError(400, '23514', 'new row violates check constraint'), 'Prüfe die Angaben'],
  ['Unique 23505', pgError(409, '23505', 'duplicate key'), 'Prüfe die Angaben'],
  ['500', pgError(500, 'XX000', 'boom'), 'Das hat nicht geklappt'],
] as const) {
  test(`Serverfehler ${name}: Text im Formular, Angaben bleiben, zweiter Versuch möglich`, { tag: '@breit' }, async ({ page }) => {
    const errors = collectErrors(page)
    const state = await mock(page, { answers: [answer] })
    await open(page)
    await fill(page)
    await submit(page).click()
    await expect(page.getByRole('alert').filter({ hasText: text })).toBeVisible()
    await expect(field(page, 'Firmenname')).toHaveValue(BODY.p_name)
    await expect(submit(page)).toBeEnabled()
    await noFee(page)
    await submit(page).click()
    await expect(page.getByText('In Prüfung', { exact: true })).toBeVisible()
    expect(state.bodies).toEqual([BODY, BODY])
    expect(errors.filter((e) => !/status of (400|401|403|409|500)/.test(e))).toEqual([])
  })
}

test('Netzfehler: Hinweis „Keine Verbindung“, zweiter Versuch klappt', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  const state = await mock(page, { answers: [{ abort: true }] })
  await open(page)
  await fill(page)
  await submit(page).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Keine Verbindung' })).toBeVisible()
  await submit(page).click()
  await expect(page.getByText('In Prüfung', { exact: true })).toBeVisible()
  expect(state.bodies).toHaveLength(2)
  expect(errors.filter((e) => !/ERR_FAILED|Failed to fetch|FetchError/.test(e))).toEqual([])
})

for (const [status, label, reason, text] of [
  ['pending', 'In Prüfung', null, 'Wir prüfen deine Angaben'],
  ['active', 'Aktiv', null, 'Deine Firma ist freigeschaltet'],
  ['payment_hold', 'Pausiert', 'Zahlung offen, bitte melden', 'vorübergehend pausiert'],
  ['suspended', 'Gesperrt', 'Mehrfach nicht erschienen', 'Deine Firma ist gesperrt'],
  ['rejected', 'Abgelehnt', 'Unterlagen unvollständig', 'Deine Registrierung wurde abgelehnt'],
  ['rejected', 'Abgelehnt', null, 'Deine Registrierung wurde abgelehnt'],
] as const) {
  test(`Status ${status}${reason ? ' mit Begründung' : ''}: ${label}`, { tag: '@breit' }, async ({ page }) => {
    const errors = collectErrors(page)
    await mock(page, { firm: { id: 'p-9', name: 'Möbel Müller KG', status, status_reason: reason } })
    await open(page)
    await expect(page.getByRole('heading', { name: 'Möbel Müller KG' })).toBeVisible()
    await expect(page.getByText(label, { exact: true })).toBeVisible()
    await expect(page.getByText(text)).toBeVisible()
    if (reason) await expect(page.getByText(reason)).toBeVisible()
    else await expect(page.getByText(/Begründung/)).toHaveCount(0)
    await expect(field(page, 'Firmenname')).toHaveCount(0)
    await expect(submit(page)).toHaveCount(0)
    await noFee(page)
    expect(errors).toEqual([])
  })
}

test('Lesefehler beim Laden: Fehlerzustand mit „Erneut versuchen“, kein Registrierformular', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  // Der Lesefehler gilt bis zum Klick, nicht für eine feste Zahl Aufrufe (der Entwicklungs-Build startet Effekte doppelt)
  const state = await mock(page, { firm: PENDING, failLoads: 1000 })
  await open(page)
  await expect(page.getByRole('alert')).toContainText('Das hat nicht geklappt')
  await expect(field(page, 'Firmenname')).toHaveCount(0)
  state.failLoads = 0
  await page.getByRole('button', { name: 'Erneut versuchen' }).click()
  await expect(page.getByRole('heading', { name: 'Transporte Huber GmbH' })).toBeVisible()
  expect(errors.filter((e) => !/status of 500/.test(e))).toEqual([])
})

test('Profil: Zeile „Als Partner arbeiten“ führt zu /partner', { tag: '@breit' }, async ({ page }) => {
  await mock(page)
  await open(page, '/profil')
  await page.getByRole('link', { name: /Als Partner arbeiten/ }).click()
  await expect(page).toHaveURL(/\/partner$/)
  await expect(page.getByRole('heading', { name: 'Firma registrieren' })).toBeVisible()
})

for (const width of [390, 430, 1280]) {
  test(`Maße bei ${width} px: kein waagerechtes Scrollen, Felder, Bezirke und Knopf mindestens 44 px`, { tag: '@breit' }, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mock(page)
    await open(page)
    await expect(field(page, 'Firmenname')).toBeVisible()
    for (const label of ['Firmenname', 'UID-Nummer', 'Straße', 'PLZ', 'Ort', 'Kontaktperson', 'Telefon', 'E-Mail']) {
      expect((await page.locator('label').filter({ has: field(page, label) }).boundingBox())!.height, label).toBeGreaterThanOrEqual(44)
    }
    expect((await page.locator('label').filter({ has: field(page, 'Rechtsform') }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    for (const n of [1, 12, 23]) {
      const box = (await page.locator('label').filter({ has: district(page, n) }).boundingBox())!
      expect(Math.min(box.width, box.height), `Bezirk ${n}`).toBeGreaterThanOrEqual(44)
    }
    for (const row of [small(page), terms(page)]) expect((await page.locator('label').filter({ has: row }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect((await submit(page).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
