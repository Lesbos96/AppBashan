import type { Page } from '@playwright/test'
import { price } from './anfrage-helpers'
import { mockAuth, signInWithCode } from './auth-helpers'
import { cors, expect, mockRpc, RpcFail, rest, test, type RpcReturn } from './backend'
import { collectErrors } from './console'

/*
 * Kunde im Auftrags-Detail (s9i-3): Angebot annehmen, Nachtrag entscheiden, Frage nach dem Termin, Stufen im Storno-Sheet.
 * Alle Antworten kommen aus Mocks; die Oberfläche zeigt und sendet genau die Server-Cent.
 */

const ID = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const OFFER = '2d0a3e5f-7f4c-4a9d-9c83-5e6f7a8b9c0d'
const REV = '1c9f2d4e-6e3b-4f8c-8b72-4d5e6f7a8b9c'
const PHOTO = '3e1b4f6a-8a5d-4bae-8d94-6f7a8b9c0d1e'
const OTHER_PHOTO = '4f2c5a7b-9b6e-4cbf-9ea5-7a8b9c0d1e2f'
const PAST = '2026-01-01T07:00:00Z'
const FUTURE = '2099-12-15T07:00:00Z'
const TERMS = { cancel_free_hours: 48, cancel_late_percent: 50, cancel_full_percent: 100, cancel_full_days_before: 0 }

type Offer = RpcReturn<'my_request_offers'>[number]
type Answer = { status?: number; json?: unknown; delay?: number }
type State = {
  status: string
  termin: string
  reported: string | null
  /** Der Kunde hat „durchgeführt“ bestätigt (die Meldung ist dann zu) */
  confirmed?: boolean
  /** Antwort von `my_report_info`; Standard: Meldung möglich ab Terminbeginn, solange nicht gemeldet oder bestätigt */
  canReport?: boolean
  offers: Offer[]
  change: unknown | null
  terms?: unknown
  waived?: boolean
  calls: { name: string; body: unknown }[]
  answers: Record<string, Answer[]>
  /** Statuswechsel nach einer erfolgreichen Antwort */
  after: Record<string, Partial<Pick<State, 'status' | 'reported' | 'confirmed' | 'change' | 'offers'>>>
}

const state = (over: Partial<State> = {}): State => ({ status: 'accepted', termin: FUTURE, reported: null, offers: [], change: null, calls: [], answers: {}, after: {}, ...over })
const offer = (over: Partial<Offer> = {}): Offer => ({ offer_id: OFFER, amount_cents: 72345, valid_until: '2099-12-01T10:00:00Z', status: 'sent', company_name: 'Muster Transporte', ...over })
const change = (over: object = {}) => ({
  id: REV,
  total_cents: 80000,
  valid_until: '2099-12-01T10:00:00Z',
  snapshot: price(80000, 80000, 80000, [{ key: 'booked', cents: 68961 }, { key: 'change_order', cents: 11039 }] as never),
  photos: [PHOTO],
  ...over,
})

async function mock(page: Page, s: State) {
  const row = () => ({
    id: ID,
    service: 'move',
    status: s.status,
    preferred_date: '2026-12-15',
    termin_at: s.termin,
    time_window: 'morning',
    not_done_reported_at: s.reported,
    cancel_fee_waived: s.waived ?? false,
    from_address: 'Neubaugasse 12, 1070 Wien',
    to_address: 'Praterstraße 30, 1020 Wien',
    created_at: '2026-11-05T10:00:00Z',
    price_revisions: { snapshot: { ...price(68961), terms: s.terms ?? TERMS } },
  })
  await page.route('**/rest/v1/service_requests**', (r) => rest(r, [row()]))
  await page.route('**/rest/v1/price_revisions**', (r) => rest(r, s.change ? [s.change] : []))
  await mockRpc(page, 'my_request_offers', () => s.offers)
  await mockRpc(page, 'my_report_info', () => {
    s.calls.push({ name: 'my_report_info', body: null })
    const a = s.answers['my_report_info']?.shift()
    if (a?.status) return new RpcFail(a.status, a.json ?? {})
    const can = s.canReport ?? (['accepted', 'in_progress', 'completed'].includes(s.status) && !s.reported && s.termin === PAST && !s.confirmed)
    return [{ can_report: can, report_until: can ? '2026-01-08T07:00:00Z' : null }]
  })
  const answer = async (name: string, body: unknown, ok: (r: Answer) => unknown) => {
    s.calls.push({ name, body })
    const a = s.answers[name]?.shift() ?? {}
    if (a.delay) await new Promise((res) => setTimeout(res, a.delay))
    if (!a.status || a.status === 200 || a.status === 204) Object.assign(s, s.after[name] ?? {})
    return ok(a)
  }
  for (const name of ['offer-confirm', 'change-decide']) {
    await page.route(`**/functions/v1/${name}`, async (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
      return answer(name, r.request().postDataJSON(), (a) => r.fulfill({ status: a.status ?? 200, headers: cors, json: a.json ?? { status: 'ok' } }))
    })
  }
  await page.route('**/functions/v1/job-photo', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    s.calls.push({ name: 'job-photo', body: r.request().postDataJSON() })
    return r.fulfill({
      headers: cors,
      json: [
        { id: PHOTO, kind: 'receipt', url: 'https://example.test/beleg-1.jpg' },
        { id: OTHER_PHOTO, kind: 'receipt', url: 'https://example.test/alt.jpg' },
      ],
    })
  })
  await page.route('https://example.test/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' }))
  for (const name of ['complete_job', 'report_not_done', 'withdraw']) {
    await page.route(`**/rest/v1/rpc/${name}**`, async (r) => {
      if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
      return answer(name, r.request().postDataJSON(), (a) => (a.status && a.status >= 400 ? r.fulfill({ status: a.status, headers: cors, json: a.json }) : r.fulfill({ status: 204, headers: cors })))
    })
  }
}

/** `done`: der Auftrag ist erledigt und steht in der Liste nur unter „Erledigt“; dann direkt zum Detail. */
async function open(page: Page, done = false) {
  await mockAuth(page)
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
  await page.goto('/anmelden?next=%2Fauftraege')
  await signInWithCode(page)
  await expect(page).toHaveURL(/\/auftraege$/)
  if (done) await page.goto(`/auftraege/${ID}`)
  else await page.getByRole('link', { name: /Umzug/ }).click()
  await expect(page).toHaveURL(new RegExp(`/auftraege/${ID}$`))
}

const noFee = (page: Page) => expect(page.locator('body')).not.toContainText(/Plattform|Provision|15 ?%|MoveNow-Gebühr/)
const body = (s: State, name: string) => s.calls.filter((c) => c.name === name).map((c) => c.body)

test.describe('Angebote', () => {
  const offered = () => state({ status: 'offered', offers: [offer(), offer({ offer_id: REV, company_name: 'Zweite Firma', amount_cents: 72000 }), offer({ offer_id: OTHER_PHOTO, status: 'confirmed' })], after: { 'offer-confirm': { status: 'accepted', offers: [] } } })

  test('Liste zeigt Firma, Betrag in einer Zeile und Frist; Annahme per Tastatur sendet genau den Betrag', async ({ page }) => {
    const errors = collectErrors(page)
    const s = offered()
    await mock(page, s)
    await open(page)
    const money = page.getByText(/^723,45.€$/)
    await expect(money).toBeVisible()
    expect(await money.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap')
    await expect(page.getByText('Muster Transporte').first()).toBeVisible()
    await expect(page.getByText('Zweite Firma')).toBeVisible()
    await expect(page.getByText(/Gültig bis/)).toHaveCount(2)
    await noFee(page)
    await page.getByRole('button', { name: 'Angebot von Muster Transporte annehmen' }).focus()
    await page.keyboard.press('Enter')
    const sheet = page.getByRole('dialog', { name: 'Angebot annehmen' })
    const confirm = sheet.getByRole('button', { name: /^Für 723,45.€ annehmen$/ })
    expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await confirm.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Angebote', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Verlauf' }).getByRole('listitem').nth(1)).toHaveAttribute('aria-current', 'step')
    expect(body(s, 'offer-confirm')).toEqual([{ offerId: OFFER, shownAmountCents: 72345 }])
    expect(errors).toEqual([])
  })

  test('Betrag hat sich geändert: Hinweis, neue Liste, nichts wird still gebucht', async ({ page }) => {
    const s = offered()
    s.answers['offer-confirm'] = [{ status: 409, json: { error: 'amount_changed' } }]
    await mock(page, s)
    await open(page)
    await page.getByRole('button', { name: 'Angebot von Muster Transporte annehmen' }).click()
    s.offers = [offer({ amount_cents: 70000 })]
    await page.getByRole('dialog', { name: 'Angebot annehmen' }).getByRole('button', { name: /annehmen$/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Der Preis hat sich geändert' })).toBeVisible()
    await expect(page.getByText(/^700,00.€$/).first()).toBeVisible()
    expect(s.status).toBe('offered')
    expect(body(s, 'offer-confirm')).toHaveLength(1)
  })

  test('Angebot nicht mehr verfügbar: neutraler Hinweis ohne Firmenstatus', async ({ page }) => {
    const s = offered()
    s.answers['offer-confirm'] = [{ status: 409, json: { error: 'offer_unavailable' } }]
    await mock(page, s)
    await open(page)
    await page.getByRole('button', { name: 'Angebot von Muster Transporte annehmen' }).click()
    await page.getByRole('dialog', { name: 'Angebot annehmen' }).getByRole('button', { name: /annehmen$/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'nicht mehr verfügbar' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/gesperrt|suspended|Auslastung/)
  })

  test('Netzfehler: Fehlertext im Sheet, zweiter Versuch klappt, Doppelklick sendet einmal', async ({ page }) => {
    const s = offered()
    s.answers['offer-confirm'] = [{ status: 500, json: { error: 'internal' }, delay: 300 }]
    await mock(page, s)
    await open(page)
    await page.getByRole('button', { name: 'Angebot von Muster Transporte annehmen' }).click()
    const sheet = page.getByRole('dialog', { name: 'Angebot annehmen' })
    const confirm = sheet.getByRole('button', { name: /annehmen$/ })
    await confirm.dblclick()
    await expect(sheet.getByRole('alert')).toContainText('Das hat nicht geklappt')
    expect(body(s, 'offer-confirm')).toHaveLength(1)
    await sheet.getByRole('button', { name: /annehmen$/ }).click()
    await expect(page.getByText('Angebote', { exact: true })).toHaveCount(0)
    expect(body(s, 'offer-confirm')).toHaveLength(2)
  })

  test('kein gültiges Angebot: Hinweis statt Liste', async ({ page }) => {
    await mock(page, state({ status: 'offered', offers: [] }))
    await open(page)
    await expect(page.getByText('Gerade liegt kein gültiges Angebot vor.')).toBeVisible()
  })
})

test.describe('Nachtrag', () => {
  const withChange = (over: Partial<State> = {}) => state({ change: change(), after: { 'change-decide': { change: null } }, ...over })

  test('zeigt Mehraufwand, neuen Gesamtpreis und nur die Belege dieses Nachtrags; Zustimmen sendet genau den Gesamtpreis', async ({ page }) => {
    const errors = collectErrors(page)
    const s = withChange()
    await mock(page, s)
    await open(page)
    await expect(page.getByRole('heading', { level: 2, name: 'Nachtrag zum Preis' })).toBeVisible()
    await expect(page.getByText(/^110,39.€$/)).toBeVisible()
    const total = page.getByText(/^800,00.€$/).first()
    await expect(total).toBeVisible()
    expect(await total.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe('nowrap')
    await expect(page.getByRole('img', { name: /^Beleg/ })).toHaveCount(1)
    await expect(page.getByRole('img', { name: 'Beleg 1' })).toHaveAttribute('src', 'https://example.test/beleg-1.jpg')
    await noFee(page)
    await page.getByRole('button', { name: 'Zustimmen' }).focus()
    await page.keyboard.press('Enter')
    const sheet = page.getByRole('dialog', { name: 'Nachtrag zustimmen' })
    const confirm = sheet.getByRole('button', { name: /^Für 800,00.€ zustimmen$/ })
    await confirm.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Nachtrag zum Preis' })).toHaveCount(0)
    expect(body(s, 'change-decide')).toEqual([{ revisionId: REV, decision: 'accept', shownTotalCents: 80000 }])
    expect(errors).toEqual([])
  })

  test('Ablehnen sendet keinen Betrag', async ({ page }) => {
    const s = withChange()
    await mock(page, s)
    await open(page)
    await page.getByRole('button', { name: 'Ablehnen' }).click()
    await page.getByRole('dialog', { name: 'Nachtrag ablehnen' }).getByRole('button', { name: 'Ablehnen' }).click()
    await expect(page.getByRole('heading', { name: 'Nachtrag zum Preis' })).toHaveCount(0)
    expect(body(s, 'change-decide')).toEqual([{ revisionId: REV, decision: 'decline' }])
  })

  test('Gesamtpreis hat sich geändert: Hinweis und neuer Betrag, erneute Bestätigung nötig', async ({ page }) => {
    const s = withChange()
    s.answers['change-decide'] = [{ status: 409, json: { error: 'amount_changed' } }]
    await mock(page, s)
    await open(page)
    await page.getByRole('button', { name: 'Zustimmen' }).click()
    s.change = change({ total_cents: 85000, snapshot: price(85000, 85000, 85000, [{ key: 'booked', cents: 68961 }, { key: 'change_order', cents: 16039 }] as never) })
    await page.getByRole('dialog', { name: 'Nachtrag zustimmen' }).getByRole('button', { name: /zustimmen$/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Der Preis hat sich geändert' })).toBeVisible()
    await expect(page.getByText(/^850,00.€$/).first()).toBeVisible()
    expect(body(s, 'change-decide')).toHaveLength(1)
  })

  test('Belege nicht ladbar: Entscheidung bleibt möglich', async ({ page }) => {
    const s = withChange()
    await mock(page, s)
    await page.route('**/functions/v1/job-photo', (r) => (r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ status: 500, headers: cors, json: { error: 'internal' } })))
    await open(page)
    await expect(page.getByText('Die Fotos konnten nicht geladen werden.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zustimmen' })).toBeEnabled()
  })

  test('kein offener Nachtrag: keine Karte', async ({ page }) => {
    await mock(page, state())
    await open(page)
    await expect(page.getByRole('heading', { name: 'Nachtrag zum Preis' })).toHaveCount(0)
  })

  test('Abfrage: eigene Anfrage, nur offene Nachträge, feste Spalten', async ({ page }) => {
    const urls: string[] = []
    const s = withChange()
    await mock(page, s)
    page.on('request', (r) => r.url().includes('/rest/v1/price_revisions') && urls.push(decodeURIComponent(r.url())))
    await open(page)
    await expect(page.getByRole('heading', { name: 'Nachtrag zum Preis' })).toBeVisible()
    const u = urls[0]!
    expect(u).toContain(`request_id=eq.${ID}`)
    expect(u).toContain('source=eq.change_order')
    expect(u).toContain('status=eq.proposed')
    expect(u).not.toContain('select=*')
    expect(u).not.toMatch(/proposed_by|decided_by|fee|commission|inputs/)
  })
})

test.describe('Anfrage zurückziehen', () => {
  const withdrawn = (over: Partial<State> = {}) => state({ status: 'awaiting_offer', after: { withdraw: { status: 'withdrawn' } }, ...over })

  test('Bestätigung per Tastatur, ein Aufruf mit der Anfrage, danach Endzustand ohne Knopf', async ({ page }) => {
    const errors = collectErrors(page)
    const s = withdrawn()
    await mock(page, s)
    await open(page)
    expect((await page.getByRole('button', { name: 'Anfrage zurückziehen' }).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.getByRole('button', { name: 'Anfrage zurückziehen' }).focus()
    await page.keyboard.press('Enter')
    const confirm = page.getByRole('dialog', { name: 'Anfrage zurückziehen' }).getByRole('button', { name: 'Ja, zurückziehen' })
    expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    expect(body(s, 'withdraw'), 'erst die Bestätigung sendet').toEqual([])
    await confirm.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText('Du hast die Anfrage zurückgezogen.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Anfrage zurückziehen' })).toHaveCount(0)
    expect(body(s, 'withdraw')).toEqual([{ p_request: ID }])
    await noFee(page)
    expect(errors).toEqual([])
  })

  test('Angebote da (offered): auch hier möglich; Server lehnt ab: Hinweis und neu geladen', async ({ page }) => {
    const s = withdrawn({ status: 'offered', offers: [offer()] })
    s.answers['withdraw'] = [{ status: 400, json: { message: 'invalid_transition' } }]
    await mock(page, s)
    await open(page)
    await page.getByRole('button', { name: 'Anfrage zurückziehen' }).click()
    await page.getByRole('dialog', { name: 'Anfrage zurückziehen' }).getByRole('button', { name: 'Ja, zurückziehen' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'lässt sich nicht mehr ändern' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('nach der Zusage (accepted) gibt es keinen Knopf', async ({ page }) => {
    await mock(page, state())
    await open(page)
    await expect(page.getByRole('button', { name: 'Anfrage zurückziehen' })).toHaveCount(0)
  })
})

test.describe('Frage nach dem Termin', () => {
  const started = (over: Partial<State> = {}) => state({ termin: PAST, after: { complete_job: { status: 'completed', confirmed: true }, report_not_done: { reported: '2026-01-02T08:00:00Z' } }, ...over })

  test('vor Terminbeginn gibt es keine Frage, aber den Storno-Knopf mit Stufen in Worten', async ({ page }) => {
    await mock(page, state())
    await open(page)
    await expect(page.getByRole('heading', { name: 'Hat der Auftrag stattgefunden?' })).toHaveCount(0)
    await page.route('**/functions/v1/cancel-customer', (r) => (r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ headers: cors, json: { cancelFeeCents: 34481 } })))
    await page.getByRole('button', { name: 'Stornieren' }).click()
    const sheet = page.getByRole('dialog', { name: 'Auftrag stornieren' })
    await expect(sheet.getByText('Kostenlos stornieren kannst du bis 48 Stunden vor dem Termin.')).toBeVisible()
    await expect(sheet.getByText(/Danach werden 50 % des Preises berechnet, ab dem Tag des Termins 100 %/)).toBeVisible()
    await expect(sheet.getByText('Die Stornokosten stellt dir der Partner in Rechnung.')).toBeVisible()
  })

  test('Storno-Sheet ohne Bedingungen im Snapshot: kein Stufentext, Betrag bleibt', async ({ page }) => {
    await mock(page, state({ terms: { cancel_free_hours: 'x' } }))
    await page.route('**/functions/v1/cancel-customer', (r) => (r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ headers: cors, json: { cancelFeeCents: 0 } })))
    await open(page)
    await page.getByRole('button', { name: 'Stornieren' }).click()
    const sheet = page.getByRole('dialog', { name: 'Auftrag stornieren' })
    await expect(sheet.getByText('Kostenlos', { exact: true })).toBeVisible()
    await expect(sheet.getByText(/Stunden vor dem Termin/)).toHaveCount(0)
  })

  test('Folgeanfrage (Storno kostenlos): Betrag „Kostenlos“, kein Stufentext', async ({ page }) => {
    await mock(page, state({ waived: true }))
    await page.route('**/functions/v1/cancel-customer', (r) => (r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ headers: cors, json: { cancelFeeCents: 0 } })))
    await open(page)
    await page.getByRole('button', { name: 'Stornieren' }).click()
    const sheet = page.getByRole('dialog', { name: 'Auftrag stornieren' })
    await expect(sheet.getByText('Kostenlos', { exact: true })).toBeVisible()
    await expect(sheet.getByText(/Stunden vor dem Termin/)).toHaveCount(0)
  })

  test('gemeldet, Termin noch in der Zukunft: kein Storno-Knopf', async ({ page }) => {
    await mock(page, state({ reported: '2026-01-02T08:00:00Z' }))
    await open(page)
    await expect(page.getByRole('status').filter({ hasText: /Wir prüfen ihn/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stornieren' })).toHaveCount(0)
  })

  test('Fehler im Sheet, schließen und neu öffnen: Fehler ist weg, Aktion geht', async ({ page }) => {
    const s = started()
    s.answers['complete_job'] = [{ status: 500, json: { message: 'retry' } }]
    await mock(page, s)
    await open(page)
    await page.getByRole('button', { name: 'Ja, er hat stattgefunden' }).click()
    const sheet = page.getByRole('dialog', { name: 'Auftrag bestätigen' })
    await sheet.getByRole('button', { name: 'Ja, bestätigen' }).click()
    await expect(sheet.getByRole('alert')).toBeVisible()
    await sheet.getByRole('button', { name: 'Doch nicht' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'Ja, er hat stattgefunden' }).click()
    await expect(page.getByRole('dialog', { name: 'Auftrag bestätigen' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Auftrag bestätigen' }).getByRole('alert')).toHaveCount(0)
    await page.getByRole('dialog', { name: 'Auftrag bestätigen' }).getByRole('button', { name: 'Ja, bestätigen' }).click()
    await expect(page.getByRole('heading', { name: 'Hat der Auftrag stattgefunden?' })).toHaveCount(0)
  })

  test('nach Terminbeginn: Frage statt Storno-Knopf', async ({ page }) => {
    await mock(page, started())
    await open(page)
    await expect(page.getByRole('heading', { name: 'Hat der Auftrag stattgefunden?' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stornieren' })).toHaveCount(0)
  })

  test('„Ja“: Bestätigung per Tastatur, Auftrag ist erledigt', async ({ page }) => {
    const errors = collectErrors(page)
    const s = started()
    await mock(page, s)
    await open(page)
    await page.getByRole('button', { name: 'Ja, er hat stattgefunden' }).focus()
    await page.keyboard.press('Enter')
    const sheet = page.getByRole('dialog', { name: 'Auftrag bestätigen' })
    await expect(sheet.getByText(/nicht mehr als „nicht stattgefunden“ melden/)).toBeVisible()
    const confirm = sheet.getByRole('button', { name: 'Ja, bestätigen' })
    expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await confirm.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('heading', { name: 'Hat der Auftrag stattgefunden?' })).toHaveCount(0)
    await expect(page.getByRole('list', { name: 'Verlauf' }).getByRole('listitem').nth(3)).toHaveAttribute('aria-current', 'step')
    expect(body(s, 'complete_job')).toEqual([{ p_request: ID }])
    expect(errors).toEqual([])
  })

  test('„Nein“: Meldung, danach Hinweis „Wir prüfen“ und keine Frage mehr', async ({ page }) => {
    const s = started()
    await mock(page, s)
    await open(page)
    await page.getByRole('button', { name: 'Nein, er hat nicht stattgefunden' }).click()
    await page.getByRole('dialog', { name: 'Nicht stattgefunden' }).getByRole('button', { name: 'Meldung senden' }).click()
    await expect(page.getByRole('status').filter({ hasText: /Wir prüfen ihn/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Hat der Auftrag stattgefunden?' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Stornieren' })).toHaveCount(0)
    expect(body(s, 'report_not_done')).toEqual([{ p_request: ID }])
    await noFee(page)
  })

  test('schon gemeldet: nur der Hinweis', async ({ page }) => {
    await mock(page, started({ reported: '2026-01-02T08:00:00Z' }))
    await open(page)
    await expect(page.getByRole('status').filter({ hasText: /Wir prüfen ihn/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ja, er hat stattgefunden' })).toHaveCount(0)
  })

  test('Server lehnt ab (invalid_transition): Sheet schließt, Hinweis, Detail lädt neu', async ({ page }) => {
    const s = started()
    s.answers['complete_job'] = [{ status: 400, json: { message: 'invalid_transition' } }]
    await mock(page, s)
    await open(page)
    await page.getByRole('button', { name: 'Ja, er hat stattgefunden' }).click()
    await page.getByRole('dialog', { name: 'Auftrag bestätigen' }).getByRole('button', { name: 'Ja, bestätigen' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'lässt sich nicht mehr ändern' })).toBeVisible()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('Firma hat abgeschlossen: nur „Nein“ mit Frist, Meldung per Tastatur, danach Hinweis (S9i3-1)', async ({ page }) => {
    const errors = collectErrors(page)
    const s = started({ status: 'completed' })
    await mock(page, s)
    await open(page, true)
    await expect(page.getByRole('heading', { name: 'Hat der Auftrag stattgefunden?' })).toBeVisible()
    await expect(page.getByText(/Die Firma hat den Auftrag als erledigt gemeldet/)).toBeVisible()
    await expect(page.getByText(/Du kannst das bis 8\. Jänner um 08:00 Uhr melden/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ja, er hat stattgefunden' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Nein, er hat nicht stattgefunden' }).focus()
    await page.keyboard.press('Enter')
    const confirm = page.getByRole('dialog', { name: 'Nicht stattgefunden' }).getByRole('button', { name: 'Meldung senden' })
    expect((await confirm.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await confirm.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: /Wir prüfen ihn/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Hat der Auftrag stattgefunden?' })).toHaveCount(0)
    expect(body(s, 'report_not_done')).toEqual([{ p_request: ID }])
    expect(errors).toEqual([])
  })

  test('Server sagt „keine Meldung mehr“ (Frist vorbei, bestätigt): keine Frage, auch nicht „Ja“', async ({ page }) => {
    await mock(page, started({ status: 'completed', canReport: false }))
    await open(page, true)
    await expect(page.getByText('Erledigt', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Hat der Auftrag stattgefunden?' })).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: /Wir prüfen ihn/ })).toHaveCount(0)
  })

  test('Signal nicht ladbar: Fehler mit „Erneut versuchen“, kein Rückfall auf die Geräteuhr', async ({ page }) => {
    const s = started()
    // zwei Antworten: React ruft den Effekt im Dev-Modus doppelt auf, die erste Antwort wird dabei verworfen
    s.answers['my_report_info'] = [{ status: 500, json: { message: 'x' } }, { status: 500, json: { message: 'x' } }]
    await mock(page, s)
    await open(page)
    await expect(page.getByRole('alert').filter({ hasText: 'Die Frage zum Termin konnte nicht geladen werden' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ja, er hat stattgefunden' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Erneut versuchen' }).click()
    await expect(page.getByRole('button', { name: 'Ja, er hat stattgefunden' })).toBeVisible()
  })

  test('gemeldet (Prüfung): kein Nachtrag mehr zur Entscheidung', async ({ page }) => {
    await mock(page, state({ status: 'in_progress', termin: PAST, reported: '2026-01-02T08:00:00Z', change: change() }))
    await open(page)
    await expect(page.getByRole('status').filter({ hasText: /Wir prüfen ihn/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nachtrag zum Preis' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Zustimmen' })).toHaveCount(0)
  })

  test('Meldefrist abgelaufen: eigener Text', async ({ page }) => {
    const s = started()
    s.answers['report_not_done'] = [{ status: 400, json: { message: 'report_window_closed' } }]
    await mock(page, s)
    await open(page)
    await page.getByRole('button', { name: 'Nein, er hat nicht stattgefunden' }).click()
    await page.getByRole('dialog', { name: 'Nicht stattgefunden' }).getByRole('button', { name: 'Meldung senden' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Die Frist für diese Meldung ist abgelaufen' })).toBeVisible()
  })
})

for (const width of [390, 430, 1280]) {
  test(`Maße bei ${width} px: kein waagerechtes Scrollen, Knöpfe mindestens 44 px hoch`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mock(page, state({ termin: PAST, change: change() }))
    await open(page)
    await expect(page.getByRole('button', { name: 'Zustimmen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ja, er hat stattgefunden' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    for (const name of ['Zustimmen', 'Ablehnen', 'Ja, er hat stattgefunden', 'Nein, er hat nicht stattgefunden']) {
      expect((await page.getByRole('button', { name }).boundingBox())!.height, name).toBeGreaterThanOrEqual(44)
    }
  })

  test(`Angebote bei ${width} px: lange Firmennamen laufen nicht über, Beträge in einer Zeile`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await mock(page, state({ status: 'offered', offers: [offer({ company_name: 'Sehr langer Firmenname Transport Umzug und Logistik Gesellschaft m.b.H. Wien' })] }))
    await open(page)
    await expect(page.getByRole('button', { name: /annehmen$/ })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const m = await page.getByText(/^723,45.€$/).boundingBox()
    expect(m!.height).toBeLessThan(30)
  })
}
