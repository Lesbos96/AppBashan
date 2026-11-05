import type { Page } from '@playwright/test'
import { answer, cors, fillContact, mockQuote, pickDate, price, type Reply } from './anfrage-helpers'
import { mockAuth, signInWithCode } from './auth-helpers'
import { expect, test } from './backend'
import { collectErrors } from './console'
import { fillKuecheBeispiel, weiter } from './dienste-helpers'
import { fillUmzugBeispiel, mockRoute, setAddress, setTerminAddress } from './konfigurator-helpers'

/*
 * Nutzerwege von der Startseite bis zur Bestätigung (docs/nacht/e2e.md, Phase 1: W2, W3, W4, W6, W7, W9).
 * Je Weg zuerst der Erfolgsfall, dann Abbruch und Fehler. Alle Antworten kommen aus der Mock-Schicht (backend.ts) und den Mocks hier;
 * Beträge von `quote` sind feste Testwerte, keine Berechnung.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('movenow.onboarded', '1'))
})

const euro = (text: string) => new RegExp(text.replace(' €', '.€'))
const DAY_15 = /^\d{4}-\d{2}-15$/
const offer = (reason: string) => answer({ kind: 'offer', reasons: [reason] }, { needsQuote: true, status: 'awaiting_offer' })

/** Zusammenfassung ist offen und ausgefüllt: einwilligen, anmelden (Code), wieder einwilligen. Danach ist „Anfrage senden“ bereit. */
async function signInFromSummary(page: Page, path: string) {
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Anmelden und senden' }).click()
  await expect(page).toHaveURL(/\/anmelden/)
  await signInWithCode(page)
  await expect(page).toHaveURL(new RegExp(`/${path}/zusammenfassung$`))
  await page.getByRole('checkbox').check()
}

/** Umzug-Beispiel über die Start-Karte bis zur Zusammenfassung (nicht angemeldet, Kontakt ausgefüllt). */
async function umzugToSummary(page: Page) {
  await page.goto('/')
  await page.getByRole('link', { name: /^Umzug/ }).click()
  await expect(page).toHaveURL(/\/umzug$/)
  await fillUmzugBeispiel(page)
  await expect(page.getByRole('button', { name: euro('Richtpreis 689,61 €') })).toBeVisible()
  await weiter(page).click()
  await expect(page).toHaveURL(/\/umzug\/termin$/)
  await expect(page.getByText('Neubaugasse 12 → Praterstraße 30')).toBeVisible()
  await expect(page.getByText('4,8 km · innerhalb Wiens')).toBeVisible()
  await pickDate(page)
  await page.getByRole('button', { name: 'Zur Zusammenfassung' }).click()
  await expect(page).toHaveURL(/\/umzug\/zusammenfassung$/)
  await fillContact(page)
}

/**
 * Möbeltransport über die Start-Karte; mit `piano` als Klavier (persönliches Angebot). Endet auf der Zusammenfassung (nicht angemeldet, Kontakt ausgefüllt).
 * Gibt den im Konfigurator angezeigten Richtpreis zurück (Text wie angezeigt und in Cent), beim Angebot `null`.
 */
async function transportToSummary(page: Page, piano: boolean): Promise<{ text: string; cents: number } | null> {
  let displayed: { text: string; cents: number } | null = null
  await page.goto('/')
  await page.getByRole('link', { name: /^Möbeltransport/ }).click()
  await expect(page).toHaveURL(/\/transport$/)
  await setAddress(page, 'Abholung', 'Neubaugasse 12, 1070 Wien')
  await setAddress(page, 'Ziel', 'Praterstraße 30, 1020 Wien')
  if (piano) {
    await page.getByRole('radio', { name: 'Klavier' }).check({ force: true })
    await expect(page.getByRole('button', { name: 'Persönliches Angebot, Details anzeigen' })).toBeVisible()
  } else {
    const button = page.getByRole('button', { name: /Richtpreis .*€, alle Positionen/ })
    await expect(button).toBeVisible()
    // aria-label „Richtpreis 1.234,56 €, alle Positionen anzeigen“ (Preis.tsx, formatEuro)
    const m = /Richtpreis (\d{1,3}(?:\.\d{3})*),(\d{2})\s€/.exec((await button.getAttribute('aria-label')) ?? '')
    expect(m, 'Richtpreis im aria-label').not.toBeNull()
    displayed = { text: `${m![1]},${m![2]} €`, cents: Number(m![1]!.replaceAll('.', '')) * 100 + Number(m![2]) }
  }
  await weiter(page).click()
  await expect(page).toHaveURL(/\/transport\/termin$/)
  await pickDate(page)
  await page.getByRole('button', { name: 'Zur Zusammenfassung' }).click()
  await expect(page).toHaveURL(/\/transport\/zusammenfassung$/)
  await fillContact(page)
  return displayed
}

/**
 * Antwort der Auftragsliste (Spalten wie `Auftraege.tsx`). Solange `failure.reply` gesetzt ist, scheitert jeder Aufruf:
 * Im Dev-Modus lädt React StrictMode doppelt und verwirft das erste Ergebnis, ein „nur der erste Aufruf scheitert" käme nie an.
 */
async function mockOrders(page: Page, rows: object[], failure: { reply?: Reply } = {}) {
  await page.route('**/rest/v1/service_requests**', (r) =>
    failure.reply ? r.fulfill({ status: failure.reply.status ?? 200, headers: cors, json: failure.reply.json }) : r.fulfill({ headers: cors, json: rows }),
  )
}

const noFeeKeys = (body: unknown) => expect(JSON.stringify(body)).not.toMatch(/fee|commission|provision|platform/i)
/** Kunden-Screens nennen die Gebühr nirgends (CLAUDE.md, UI); gleiches Muster wie `konfigurator.spec.ts`. */
const noFeeText = (page: Page) => expect(page.locator('main')).not.toContainText(/15 ?%|Gebühr|Provision|Plattform/)

/** Seitenübergang abgeschlossen: Während die alte Seite ausblendet, stehen kurz zwei `main` im DOM (Shell, AnimatePresence). */
const oneMain = (page: Page) => expect(page.locator('main')).toHaveCount(1)

test.describe('W2 Umzug', () => {
  test('Erfolg: Start-Karte bis Bestätigung und Aufträge, gesendet wird genau der angezeigte Preis', async ({ page }) => {
    const errors = collectErrors(page)
    await mockRoute(page)
    await mockAuth(page)
    const calls = await mockQuote(page, () => ({ json: answer(price(68961)) }))
    await umzugToSummary(page)
    await oneMain(page)
    await expect(page.getByText('Einfache Strecke')).toBeVisible()
    await expect(page.getByText(euro('689,61 €')).first()).toBeVisible()
    await noFeeText(page)
    await signInFromSummary(page, 'umzug')
    await page.getByRole('button', { name: 'Anfrage senden' }).click()

    await expect(page).toHaveURL(/\/umzug\/gesendet$/)
    await oneMain(page)
    await expect(page.getByRole('heading', { name: 'Anfrage gesendet.' })).toBeVisible()
    await expect(page.getByText('Angefragt')).toBeVisible()
    await expect(page.getByText(euro('689,61 €'))).toBeVisible()
    await noFeeText(page)
    expect(calls).toHaveLength(1)
    const body = calls[0]!.body as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- Aufruf-JSON
    expect(body.service).toBe('move')
    // Strecke: bestätigte Adressen mit den Punkten aus der Suche (mockRoute) und die Rückfahrt (Standard an)
    expect(body.from).toEqual({ label: 'Neubaugasse 12, 1070 Wien', point: { lat: 48.2, lon: 16.352 } })
    expect(body.to).toEqual({ label: 'Praterstraße 30, 1020 Wien', point: { lat: 48.217, lon: 16.396 } })
    expect(body.returnTrip).toBe(true)
    expect(body.preferredDate).toMatch(DAY_15)
    expect(body.shown).toEqual({ kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961 })
    expect(body.contact).toMatchObject({ name: 'Anna Muster', phone: '+43 660 1234567', email: 'anna@movenow.test' })
    noFeeKeys(body)

    await mockOrders(page, [{ id: 'a', service: 'move', status: 'requested', preferred_date: body.preferredDate, from_address: body.from.label, to_address: body.to.label, price_revisions: { snapshot: price(68961) }, created_at: '2026-11-05T10:00:00Z' }])
    await page.getByRole('link', { name: 'Zu meinen Aufträgen' }).first().click()
    await expect(page).toHaveURL(/\/auftraege$/)
    await oneMain(page)
    await expect(page.getByText('Aktiv · 1')).toBeVisible()
    await expect(page.getByText('Neubaugasse 12 → Praterstraße 30', { exact: false })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('Abbruch: Zurück aus Zusammenfassung und Termin behält Tag und Preis, gesendet wird nichts', async ({ page }) => {
    await mockRoute(page)
    const calls = await mockQuote(page, () => ({ json: answer(price(68961)) }))
    await umzugToSummary(page)
    // Zurück in der App (Leiste oben)
    await page.getByRole('link', { name: 'Termin', exact: true }).click()
    await expect(page).toHaveURL(/\/umzug\/termin$/)
    await oneMain(page)
    await expect(page.getByRole('button', { name: /, 15\. .*ausgewählt/ })).toBeVisible()
    // Zurück im Browser: wieder die Zusammenfassung mit dem Kontakt, dann der erste Termin-Eintrag
    await page.goBack()
    await expect(page).toHaveURL(/\/umzug\/zusammenfassung$/)
    await oneMain(page)
    await expect(page.getByLabel('Name')).toHaveValue('Anna Muster')
    await page.goBack()
    await expect(page).toHaveURL(/\/umzug\/termin$/)
    await oneMain(page)
    await expect(page.getByRole('button', { name: /, 15\. .*ausgewählt/ })).toBeVisible()
    await page.getByRole('link', { name: 'Umzug' }).first().click()
    await expect(page).toHaveURL(/\/umzug$/)
    await oneMain(page)
    await expect(page.getByRole('button', { name: euro('Richtpreis 689,61 €') })).toBeVisible()
    // Wieder vor: Kontakt ist noch da
    await weiter(page).click()
    await page.getByRole('button', { name: 'Zur Zusammenfassung' }).click()
    await expect(page).toHaveURL(/\/umzug\/zusammenfassung$/)
    await oneMain(page)
    await expect(page.getByLabel('Name')).toHaveValue('Anna Muster')
    expect(calls).toHaveLength(0)
  })

  test('Fehler 503 (Adressprüfung nicht erreichbar): Meldung, Entwurf bleibt, erneutes Senden mit derselben clientRef', async ({ page }) => {
    await mockRoute(page)
    await mockAuth(page)
    const calls = await mockQuote(page, (n) => (n === 1 ? { status: 503, json: { error: 'provider_unavailable' } } : { json: answer(price(68961)) }))
    await umzugToSummary(page)
    await signInFromSummary(page, 'umzug')
    await page.getByRole('button', { name: 'Anfrage senden' }).click()
    await expect(page.getByRole('alert')).toContainText('Die Adressprüfung ist gerade nicht erreichbar')
    await expect(page).toHaveURL(/\/umzug\/zusammenfassung$/)
    await expect(page.getByLabel('Name')).toHaveValue('Anna Muster')
    await page.getByRole('button', { name: 'Erneut senden' }).click()
    await expect(page).toHaveURL(/\/umzug\/gesendet$/)
    expect(calls).toHaveLength(2)
    expect(calls[1]!.body.clientRef).toBe(calls[0]!.body.clientRef)
  })
})

test.describe('W3 Möbeltransport', () => {
  test('Erfolg: Klavier wird als persönliches Angebot gesendet, Bestätigung ohne Preis', async ({ page }) => {
    const errors = collectErrors(page)
    await mockRoute(page)
    await mockAuth(page)
    const calls = await mockQuote(page, () => ({ json: offer('special_goods') }))
    await transportToSummary(page, true)
    await expect(page.getByText('Preis nach Prüfung').first()).toBeVisible()
    await signInFromSummary(page, 'transport')
    await page.getByRole('button', { name: 'Anfrage senden' }).click()

    await expect(page).toHaveURL(/\/transport\/gesendet$/)
    await oneMain(page)
    await expect(page.getByText('Wir melden uns mit einem Angebot', { exact: false })).toBeVisible()
    await expect(page.getByText('Wartet auf Angebot')).toBeVisible()
    await expect(page.getByText(/\d,\d\d.€/)).toHaveCount(0)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.body.service).toBe('transport')
    expect(calls[0]!.body.shown).toEqual({ kind: 'offer', reasons: ['special_goods'] })
    noFeeKeys(calls[0]!.body)
    expect(errors).toEqual([])
  })

  test('Erfolg mit Richtpreis: der im Konfigurator angezeigte Betrag wird gesendet und bestätigt', async ({ page }) => {
    await mockRoute(page)
    await mockAuth(page)
    // Der Server bestätigt in diesem Mock genau den gesendeten Preis (wie `quote` bei gleichem Ergebnis)
    const calls = await mockQuote(page, (n) => {
      const shown = calls[n - 1]!.body.shown as { totalCents: number }
      return { json: answer(price(shown.totalCents)) }
    })
    const displayed = await transportToSummary(page, false)
    expect(displayed).not.toBeNull()
    await signInFromSummary(page, 'transport')
    await page.getByRole('button', { name: 'Anfrage senden' }).click()
    await expect(page).toHaveURL(/\/transport\/gesendet$/)
    await oneMain(page)
    expect(calls[0]!.body.shown).toEqual({ kind: 'price', totalCents: displayed!.cents, lowCents: displayed!.cents, highCents: displayed!.cents })
    await expect(page.getByText(euro(displayed!.text))).toBeVisible()
    await expect(page.getByText('Der Preis wurde aktualisiert.')).toHaveCount(0)
  })

  test('Abbruch der Anmeldung: Zurück führt zur Zusammenfassung, Angaben bleiben, nichts gesendet, kein Code angefordert', async ({ page }) => {
    await mockRoute(page)
    const auth = await mockAuth(page)
    const calls = await mockQuote(page, () => ({ json: answer(price(30000)) }))
    await transportToSummary(page, false)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Anmelden und senden' }).click()
    // Erst wenn die Anmeldung `?next=` aus der URL genommen hat (replace), steht sie im Verlauf; wie ein Mensch erst dann zurück
    await expect(page).toHaveURL(/\/anmelden$/)
    await oneMain(page)
    await page.goBack()
    await expect(page).toHaveURL(/\/transport\/zusammenfassung$/)
    await oneMain(page)
    await expect(page.getByLabel('Name')).toHaveValue('Anna Muster')
    await expect(page.getByLabel('Telefon')).toHaveValue('+43 660 1234567')
    expect(calls).toHaveLength(0)
    expect(auth.otp).toBe(0)
  })

  test('Fehler: Tarife nicht ladbar, Konfigurator zeigt den Fehlerzustand, „Erneut versuchen“ lädt', async ({ page }) => {
    // 400 statt Abbruch: postgrest-js wiederholt Netzwerkfehler und 5xx mit Wartezeit
    await page.route(/current_price_version/, (r) => r.fulfill({ status: 400, headers: cors, json: { message: 'Test' } }))
    await page.goto('/transport')
    await expect(page.getByRole('alert')).toContainText('Die Preise konnten nicht geladen werden')
    await expect(page.getByRole('button', { name: 'Weiter' })).toHaveCount(0)
    await page.unroute(/current_price_version/)
    await page.getByRole('button', { name: 'Erneut versuchen' }).click()
    await expect(page.getByRole('heading', { name: 'Was muss mit?' })).toBeVisible()
  })
})

test.describe('W4 Entrümpelung', () => {
  test('Besichtigung (Gewerbe): Anfrage ohne Preis bis zur Bestätigung', async ({ page }) => {
    await mockAuth(page)
    const calls = await mockQuote(page, () => ({ json: offer('commercial') }))
    await page.goto('/')
    await page.getByRole('link', { name: /^Entrümpelung/ }).click()
    await page.getByRole('radio', { name: /^Gewerbe/ }).click()
    for (let step = 1; step < 6; step++) await weiter(page).click()
    await page.getByRole('button', { name: 'Richtwert anzeigen' }).click()
    await expect(page.getByRole('heading', { name: 'Wir schauen genauer hin.' })).toBeVisible()
    await page.getByRole('button', { name: 'Besichtigung anfragen' }).click()
    await expect(page).toHaveURL(/\/entruempelung\/termin$/)
    await setTerminAddress(page, 'Neubaugasse 12, 1070 Wien')
    await pickDate(page)
    await page.getByRole('button', { name: 'Zur Zusammenfassung' }).click()
    await fillContact(page)
    await signInFromSummary(page, 'entruempelung')
    await page.getByRole('button', { name: 'Anfrage senden' }).click()
    await expect(page).toHaveURL(/\/entruempelung\/gesendet$/)
    await expect(page.getByText('Wir melden uns mit einem Angebot', { exact: false })).toBeVisible()
    expect(calls[0]!.body.service).toBe('clearance')
    expect(calls[0]!.body.shown).toEqual({ kind: 'offer', reasons: ['commercial'] })
  })
})

test.describe('W6 Transportermiete und W7 Vermieter (noch nicht gebaut)', () => {
  test('Start-Karte „Transporter mieten“ führt zum Platzhalter, ohne Aufruf ans Backend', async ({ page }) => {
    const backendCalls: string[] = []
    page.on('request', (r) => {
      if (/\/(rest|functions|auth|storage)\/v1\//.test(r.url())) backendCalls.push(r.url())
    })
    await page.goto('/')
    await page.getByRole('link', { name: /Transporter mieten/ }).click()
    await expect(page).toHaveURL(/\/miete$/)
    await expect(page.getByRole('heading', { name: 'Transporter mieten', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dieser Bereich ist noch nicht verfügbar' })).toBeVisible()
    await expect(page.getByRole('button', { name: /senden|buchen|anfragen/i })).toHaveCount(0)
    expect(backendCalls).toEqual([])
  })

  test('Profil → „Für Vermieter“ zeigt den Platzhalter, Zurück führt zum Profil', async ({ page }) => {
    await page.goto('/profil')
    await page.getByRole('link', { name: /Für Vermieter/ }).click()
    await expect(page).toHaveURL(/\/profil\/vermieter$/)
    await expect(page.getByRole('heading', { name: 'Für Vermieter', level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dieser Bereich ist noch nicht verfügbar' })).toBeVisible()
    await page.getByRole('link', { name: 'Profil' }).first().click()
    await expect(page).toHaveURL(/\/profil$/)
  })
})

test.describe('F Fehlerfälle quer', () => {
  test('Zusammenfassung: Bedingungen nicht ladbar, Fehlerzustand ohne Senden-Knopf, „Erneut versuchen“ zeigt die Zusammenfassung', async ({ page }) => {
    const calls = await mockQuote(page, () => ({ json: answer(price(77040)) }))
    // Bis der Test es abschaltet: StrictMode lädt im Dev-Modus doppelt (siehe mockOrders)
    let failing = true
    await page.route(/\/rest\/v1\/rpc\/booking_terms/, (r) => (failing ? r.fulfill({ status: 400, headers: cors, json: { message: 'Test' } }) : r.fallback()))
    await page.goto('/')
    await page.getByRole('link', { name: /^Montage/ }).click()
    // Die Seite fährt noch herein; `fillKuecheBeispiel` tippt das Radio mit `force`, das wartet nicht auf Stillstand
    await expect(page).toHaveURL(/\/montage$/)
    await oneMain(page)
    await expect(page.locator('main h1')).toBeInViewport({ ratio: 1 })
    await fillKuecheBeispiel(page)
    await weiter(page).click()
    await setTerminAddress(page, 'Neubaugasse 12, 1070 Wien')
    await pickDate(page)
    await page.getByRole('button', { name: 'Zur Zusammenfassung' }).click()
    await expect(page).toHaveURL(/\/montage\/zusammenfassung$/)
    await oneMain(page)
    await expect(page.getByRole('alert')).toContainText('Die Angaben konnten nicht geladen werden')
    await expect(page.getByRole('button', { name: /senden/ })).toHaveCount(0)
    failing = false
    await page.getByRole('button', { name: 'Erneut versuchen' }).click()
    await expect(page.getByLabel('Name')).toBeVisible()
    await expect(page.getByText(euro('770,40 €')).first()).toBeVisible()
    expect(calls).toHaveLength(0)
  })
})

test.describe('W9 Aufträge', () => {
  test('Fehler: Liste nicht ladbar, Fehlerzustand, „Erneut versuchen“ zeigt die Aufträge', async ({ page }) => {
    await mockAuth(page)
    // 400 statt Abbruch: postgrest-js wiederholt Netzwerkfehler und 5xx mit Wartezeit
    const failure: { reply?: Reply } = { reply: { status: 400, json: { message: 'Test' } } }
    await mockOrders(page, [{ id: 'a', service: 'assembly', status: 'requested', preferred_date: '2026-12-15', from_address: 'Neubaugasse 12, 1070 Wien', to_address: null, price_revisions: { snapshot: price(77040) }, created_at: '2026-11-05T10:00:00Z' }], failure)
    await page.goto('/anmelden?next=%2Fauftraege')
    await signInWithCode(page)
    await expect(page).toHaveURL(/\/auftraege$/)
    await expect(page.getByRole('alert')).toContainText('Die Aufträge konnten nicht geladen werden')
    delete failure.reply
    await page.getByRole('button', { name: 'Erneut versuchen' }).click()
    await expect(page.getByText('Aktiv · 1')).toBeVisible()
    await expect(page.getByText(euro('770,40 €'))).toBeVisible()
  })
})
