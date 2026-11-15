import type { Page } from '@playwright/test'
import { expect, test } from './backend'
import { EMAIL, HASH, mockAuth, signInWithCode } from './auth-helpers'
import { anonymousPrices, answer, cors, mockQuote, price, range, toSummary, UUID } from './anfrage-helpers'
import { collectErrors } from './console'
import { setTerminAddress } from './konfigurator-helpers'

// Der Browser meldet gemockte Fehlerantworten selbst als Konsolenfehler; die App fängt sie ab.
const failed = /status of [45]\d\d|ERR_FAILED/
const send = (page: Page) => page.getByRole('button', { name: /^(Anfrage senden|Erneut senden)$/ })

/** Zusammenfassung mit Anmeldung über den Code-Weg; danach steht die Seite wieder auf der Zusammenfassung. */
async function signedInSummary(page: Page, before?: (page: Page) => Promise<void>) {
  await anonymousPrices(page)
  await before?.(page)
  await mockAuth(page)
  await toSummary(page)
  // Die Einwilligung ist nicht vorbelegt: ohne Haken geht weder das Anmelden noch das Senden
  await expect(page.getByRole('button', { name: 'Anmelden und senden' })).toBeDisabled()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Anmelden und senden' }).click()
  await expect(page).toHaveURL(/\/anmelden$/)
  await signInWithCode(page)
  await expect(page).toHaveURL(/\/montage\/zusammenfassung$/)
  await expect(send(page)).toBeDisabled()
  await page.getByRole('checkbox').check()
  await expect(send(page)).toBeEnabled()
}

test('Hauptfluss per Tastatur: Termin, Zusammenfassung, Senden, Bestätigung, Aufträge', { tag: '@breit' }, async ({ page }) => {
  const errors = collectErrors(page)
  const calls = await mockQuote(page, () => ({ json: answer(price(77040)) }))
  await signedInSummary(page)
  await expect(page.getByText('Anfrage als')).toContainText(EMAIL)
  await send(page).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(1)
  await expect(page.getByRole('heading', { name: 'Anfrage gesendet.' })).toBeVisible()
  await expect(page.locator('main', { hasText: 'Anfrage gesendet.' }).getByText('770,40 €')).toBeVisible()
  await expect(page.getByText(/Gebühr|Provision|15 ?%/)).toHaveCount(0)
  expect(errors.filter((e) => !failed.test(e))).toEqual([])
})

test('Termin: Tastatur wählt Tag und Zeitfenster, ohne Tag geht es nicht weiter', { tag: '@breit' }, async ({ page }) => {
  await page.goto('/montage')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await setTerminAddress(page, 'Neubaugasse 12, 1070 Wien')
  await expect(page.getByRole('button', { name: 'Zur Zusammenfassung' })).toBeDisabled()
  await page.getByRole('button', { name: 'Nächster Monat' }).focus()
  await page.keyboard.press('Enter')
  const day = page.getByRole('button', { name: /, 15\. / })
  await day.focus()
  await page.keyboard.press('Enter')
  await expect(day).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('radio', { name: 'Vormittag' }).press('Space')
  await expect(page.getByRole('radio', { name: 'Vormittag' })).toBeChecked()
  await page.getByRole('button', { name: 'Zur Zusammenfassung' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/montage\/zusammenfassung$/)
  // Beim Seitenübergang steht die Termin-Seite kurz noch im DOM (Shell, AnimatePresence): die neue Seite ist die letzte
  await expect(page.getByText('Vormittag').last()).toBeVisible()
})

test('Doppeltipp auf „Anfrage senden“ ergibt genau einen Aufruf, mit dem Token der angezeigten Sitzung', { tag: '@breit' }, async ({ page }) => {
  const calls = await mockQuote(page, () => ({ json: answer(price(77040)), delay: 700 }))
  await signedInSummary(page)
  await send(page).dblclick()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(1)
  expect(calls[0]!.authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/)
  const body = calls[0]!.body
  expect(body['clientRef']).toMatch(UUID)
  // Der Aufruf kennt nur die Kundenwahl und das, was der Kunde bestätigt hat (Version, Bedingungen, gezeigter Preis, Kontakt)
  expect(Object.keys(body).sort()).toEqual(['clientRef', 'contact', 'from', 'inputs', 'photoIds', 'preferredDate', 'priceVersion', 'service', 'shown', 'termsHash', 'timeWindow'])
  expect(body['photoIds']).toEqual([]) // ohne Fotos eine leere Liste
  expect(body['shown']).toMatchObject({ kind: 'price', totalCents: 77040 })
  expect(body['contact']).toEqual({ name: 'Anna Muster', phone: '+43 660 1234567', email: 'anna@movenow.test' })
  const { shown: _shown, priceVersion: _version, ...rest } = body
  void _shown
  void _version
  expect(JSON.stringify(rest)).not.toMatch(/cents|fee|price|total|status/i)
})

test('Während des Sendens ist „Anderes Konto“ gesperrt (OPEN_ISSUES A4c-N1)', { tag: '@breit' }, async ({ page }) => {
  const calls = await mockQuote(page, () => ({ json: answer(price(77040)), delay: 1500 }))
  await signedInSummary(page)
  await send(page).click()
  const other = page.getByRole('button', { name: 'Anderes Konto' })
  await expect(other).toBeDisabled()
  await other.click({ force: true })
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(1)
})

test('Fehler 400: Hinweis am Feld statt Servermeldung, Senden gesperrt, Link zur Korrektur', { tag: '@breit' }, async ({ page }) => {
  await mockQuote(page, () => ({ status: 400, json: { error: 'invalid_input', message: 'preferredDate: SERVERTEXT' } }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByRole('alert')).toContainText('Das Wunschdatum geht nicht')
  await expect(page.getByText('SERVERTEXT')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Erneut senden' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Angaben ändern' }).click()
  await expect(page).toHaveURL(/\/montage\/termin$/)
})

test('Fehler 422 (Termin zu nah): Hinweis zum Datum, Link zur Korrektur, kein Verlust-Versprechen', { tag: '@breit' }, async ({ page }) => {
  await mockQuote(page, () => ({ status: 422, json: { error: 'too_late' } }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByRole('alert')).toContainText('Das Wunschdatum geht nicht')
  await expect(page.getByRole('alert')).not.toContainText('nicht verloren')
  await page.getByRole('link', { name: 'Angaben ändern' }).click()
  await expect(page).toHaveURL(/\/montage\/termin$/)
})

test('Fehler 401 bei noch gesetzter Sitzung: Neu anmelden meldet lokal ab, führt zur Anmeldung (keine Schleife), der Entwurf bleibt', { tag: '@breit' }, async ({ page }) => {
  await mockQuote(page, () => ({ status: 401, json: { error: 'unauthorized' } }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByRole('alert')).toContainText('Anmeldung ist abgelaufen')
  await page.getByRole('button', { name: 'Neu anmelden' }).click()
  await expect(page).toHaveURL(/\/anmelden$/)
  await signInWithCode(page)
  await expect(page).toHaveURL(/\/montage\/zusammenfassung$/)
  await expect(page.getByText('Neubaugasse 12, 1070 Wien')).toBeVisible()
})

test('Fehler 429: Wartehinweis, kein automatischer zweiter Aufruf', { tag: '@breit' }, async ({ page }) => {
  const calls = await mockQuote(page, () => ({ status: 429, json: { error: 'rate_limited' } }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByRole('alert')).toContainText('zu viele Anfragen')
  await expect(page.getByRole('button', { name: /^Bitte warten/ })).toBeDisabled()
  await page.waitForTimeout(1500)
  expect(calls).toHaveLength(1)
})

test('Fehler 500 und offline: erneuter Versuch per Knopf mit derselben clientRef, nie ein Serverpreis', { tag: '@breit' }, async ({ page }) => {
  const calls = await mockQuote(page, (n) => (n === 1 ? { status: 500, json: { error: 'internal' } } : n === 2 ? { abort: true } : { json: answer(price(77040)) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByRole('alert')).toContainText('Das hat nicht geklappt')
  // die Seite zeigt weiter nur den gemerkten Richtpreis, keinen Preis aus einer Serverantwort
  await expect(page.getByRole('alert')).not.toContainText('€')
  await page.getByRole('button', { name: 'Erneut senden' }).click()
  await expect(page.getByRole('alert')).toContainText('Keine Verbindung')
  await page.getByRole('button', { name: 'Erneut senden' }).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(3)
  expect(new Set(calls.map((c) => c.body['clientRef'])).size).toBe(1)
})

test('Geänderte Eingaben nach einem Fehler bekommen eine neue clientRef', { tag: '@breit' }, async ({ page }) => {
  const calls = await mockQuote(page, (n) => (n === 1 ? { status: 500, json: { error: 'internal' } } : { json: answer(price(77040)) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page.getByRole('link', { name: /Termin/ }).first().click()
  await page.getByText('Nachmittag', { exact: true }).click()
  await page.getByRole('button', { name: 'Zur Zusammenfassung' }).click()
  await page.getByRole('checkbox').check()
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(2)
  expect(calls[1]!.body['clientRef']).not.toBe(calls[0]!.body['clientRef'])
  expect(calls[1]!.body['timeWindow']).toBe('afternoon')
})

test('Angebot nötig: kein Preis, Text „Wir melden uns mit einem Angebot“', { tag: '@breit' }, async ({ page }) => {
  await mockQuote(page, () => ({ json: answer({ kind: 'offer', reasons: ['route_missing'] }, { needsQuote: true }) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  await expect(page.getByText('Wir melden uns mit einem Angebot')).toBeVisible()
  await expect(page.getByText('Preis nach Prüfung')).toBeVisible()
  await expect(page.locator('main', { hasText: 'Anfrage gesendet.' })).not.toContainText('Richtpreis')
})

test('Spanne (Entrümpelung) erscheint als Schätzpreis in ganzen Euro, Festpreis mit Cent', { tag: '@breit' }, async ({ page }) => {
  await page.goto('/')
  await page.evaluate((snapshot) => sessionStorage.setItem('movenow.sent', JSON.stringify({ path: 'entruempelung', id: 'x', status: 'awaiting_offer', needsQuote: true, snapshot, date: '2026-11-13', route: 'Neubaugasse 12' })), range(95000, 155000, 117500))
  await page.goto('/entruempelung/gesendet')
  await expect(page.getByText('950 € bis 1.550 €')).toBeVisible()
})

test('Unplausible Antwort (Zeilensumme falsch): gespeichert, aber kein Preis', { tag: '@breit' }, async ({ page }) => {
  await mockQuote(page, () => ({ json: answer({ ...price(77040), lines: [{ key: 'assembly', cents: 1 }] }) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByText('Preis siehe Aufträge')).toBeVisible()
  await expect(page.locator('main', { hasText: 'Anfrage gesendet.' })).not.toContainText('770,40')
})

test('Kontowechsel zwischen Anzeige und Senden: es wird nichts gesendet', { tag: '@breit' }, async ({ page }) => {
  const calls = await mockQuote(page, () => ({ json: answer(price(77040)) }))
  await signedInSummary(page)
  await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))!
    const session = JSON.parse(localStorage.getItem(key)!)
    session.user.id = 'u-fremd'
    localStorage.setItem(key, JSON.stringify(session))
  })
  await send(page).click()
  await expect(page.getByRole('alert')).toContainText('anderen Konto')
  expect(calls).toHaveLength(0)
})

test('„Anderes Konto“ meldet nur diese Sitzung ab und der Entwurf bleibt', { tag: '@breit' }, async ({ page }) => {
  await signedInSummary(page)
  await page.getByRole('button', { name: 'Anderes Konto' }).click()
  await expect(page).toHaveURL(/\/anmelden$/)
  await signInWithCode(page)
  await expect(page).toHaveURL(/\/montage\/zusammenfassung$/)
  await expect(page.getByText('Neubaugasse 12, 1070 Wien')).toBeVisible()
})

test('Ohne Anmeldung: Hinweis auf das Konto, Weg über die Anmeldung, nichts wird gesendet', { tag: '@breit' }, async ({ page }) => {
  const calls = await mockQuote(page, () => ({ json: answer(price(77040)) }))
  await mockAuth(page)
  await toSummary(page)
  await expect(page.getByText('legst du jetzt ein Konto an')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Anfrage senden' })).toHaveCount(0)
  expect(calls).toHaveLength(0)
})

test('Magic-Link in neuem Tab: der Entwurf kommt über die Übergabe mit', { tag: '@breit' }, async ({ page, context }) => {
  await anonymousPrices(page)
  await mockAuth(page)
  await toSummary(page)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Anmelden und senden' }).click()
  await expect(page).toHaveURL(/\/anmelden$/)
  // Der Link öffnet in einem anderen Browser: der ursprüngliche Tab ist weg, der Speicher des Geräts bleibt
  await page.close()
  const tab = await context.newPage()
  await anonymousPrices(tab)
  await mockAuth(tab)
  await tab.goto(`/anmelden#token_hash=${HASH}&type=email`)
  await tab.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await tab.getByRole('button', { name: 'Weiter' }).click()
  await expect(tab).toHaveURL(/\/montage\/zusammenfassung$/)
  await expect(tab.getByText('Neubaugasse 12, 1070 Wien')).toBeVisible()
  await expect(tab.getByText('Anfrage als')).toContainText(EMAIL)
  await expect(tab.getByRole('checkbox')).not.toBeChecked()
  expect(await tab.evaluate(() => localStorage.getItem('movenow.handover'))).toBeNull()
})

test('Zusammenfassung zeigt Preis und Bedingungen; gesendet werden genau dieser Betrag und dieser Hash', { tag: '@breit' }, async ({ page }) => {
  const terms = { cancel_free_hours: 24, cancel_late_percent: 30, cancel_full_percent: 90, cancel_full_days_before: 2, call_out_fee_cents: 2500, termsHash: 'c'.repeat(64) }
  const calls = await mockQuote(page, () => ({ json: answer(price(77040)) }))
  await signedInSummary(page, async (p) => {
    await p.route(/\/rest\/v1\/rpc\/booking_terms/, (r) => r.fulfill({ headers: cors, json: terms }))
  })
  const main = page.locator('main')
  await expect(main.getByText('Richtpreis', { exact: true })).toBeVisible()
  await expect(main.getByText(/^770,40\s€$/)).toBeVisible()
  await expect(main.getByText('Kostenlos stornieren kannst du bis 24 Stunden vor dem Termin.')).toBeVisible()
  await expect(main.getByText('Danach werden 30 % des Preises berechnet, ab 2 Tagen vor dem Termin 90 %.')).toBeVisible()
  await expect(main.getByText(/^Anfahrtspauschale:/)).toContainText(/25,00\s€/)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(1)
  expect(calls[0]!.body['shown']).toEqual({ kind: 'price', totalCents: 77040, lowCents: 77040, highCents: 77040 })
  expect(calls[0]!.body['termsHash']).toBe('c'.repeat(64))
})

test('Buchung zu: Hinweis sichtbar über der Leiste, Knopf gesperrt, kein Aufruf von quote (390, 430, 1280 px)', { tag: '@breit' }, async ({ page, backend }) => {
  backend.bookingOpen = false
  const calls = await mockQuote(page, () => ({ json: answer(price(77040)) }))
  await anonymousPrices(page)
  await mockAuth(page)
  await toSummary(page)
  const notice = page.getByTestId('booking-closed')
  const button = page.getByRole('button', { name: 'Anfrage senden' })
  for (const [width, height] of [[390, 844], [430, 932], [1280, 800]] as const) {
    await page.setViewportSize({ width, height })
    await expect(notice).toBeVisible()
    await expect(notice).toHaveText('Anfragen sind noch nicht freigeschaltet. Dein Entwurf bleibt erhalten.')
    await expect(button).toBeDisabled()
    const n = (await notice.boundingBox())!
    const b = (await button.boundingBox())!
    expect(n.y + n.height, `Hinweis über dem Knopf bei ${width} px`).toBeLessThanOrEqual(b.y)
  }
  expect(calls).toHaveLength(0)
})

test('ohne gemerkten Preis führt die Zusammenfassung zurück zum Preis-Schritt, gesendet wird nichts', { tag: '@breit' }, async ({ page }) => {
  const calls = await mockQuote(page, () => ({ json: answer(price(77040)) }))
  await anonymousPrices(page)
  await toSummary(page)
  await page.evaluate(() => sessionStorage.removeItem('movenow.shownfull.montage'))
  await page.reload()
  await expect(page).toHaveURL(/\/montage$/)
  expect(calls).toHaveLength(0)
})

test('409 price_changed: Dialog mit neuem Preis, gesendet wird erst nach Zustimmung, clientRef bleibt gleich', { tag: '@breit' }, async ({ page }) => {
  const calls = await mockQuote(page, (n) => (n === 1 ? { status: 409, json: { error: 'price_changed', priceVersion: 2, snapshot: price(80000) } } : { json: answer(price(80000)) }))
  await signedInSummary(page)
  await send(page).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Der Preis wurde aktualisiert.')
  await expect(alert).toContainText(/800,00\s€/)
  // ohne Zustimmung geht nichts weiter: kein zweiter Aufruf, keine Bestätigungsseite
  await page.waitForTimeout(500)
  expect(calls).toHaveLength(1)
  await expect(page).toHaveURL(/\/montage\/zusammenfassung$/)
  await page.getByRole('button', { name: 'Neuen Preis übernehmen und senden' }).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(2)
  expect(calls[1]!.body['clientRef']).toBe(calls[0]!.body['clientRef'])
  expect(calls[1]!.body['priceVersion']).toBe(2)
  expect(calls[1]!.body['shown']).toEqual({ kind: 'price', totalCents: 80000, lowCents: 80000, highCents: 80000 })
})

test('409 terms_changed: neue Bedingungen werden bestätigt, termsHash und clientRef passen', { tag: '@breit' }, async ({ page }) => {
  const terms = { cancel_free_hours: 24, cancel_late_percent: 50, cancel_full_percent: 100, cancel_full_days_before: 1, call_out_fee_cents: 0, termsHash: 'b'.repeat(64) }
  const calls = await mockQuote(page, (n) => (n === 1 ? { status: 409, json: { error: 'terms_changed', terms } } : { json: answer(price(77040)) }))
  await signedInSummary(page)
  await send(page).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Die Bedingungen wurden aktualisiert.')
  await expect(alert).toContainText('Kostenlos stornieren kannst du bis 24 Stunden vor dem Termin.')
  await expect(alert).toContainText('Danach werden 50 % des Preises berechnet, ab einem Tag vor dem Termin 100 %.')
  await page.waitForTimeout(500)
  expect(calls).toHaveLength(1)
  await expect(page).toHaveURL(/\/montage\/zusammenfassung$/)
  await page.getByRole('button', { name: 'Bedingungen bestätigen und senden' }).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(2)
  expect(calls[1]!.body['termsHash']).toBe('b'.repeat(64))
  expect(calls[1]!.body['clientRef']).toBe(calls[0]!.body['clientRef'])
})

test('409 price_changed, dann Folgefehler: die Karte zeigt den übernommenen Preis, „Erneut senden“ sendet genau ihn', { tag: '@breit' }, async ({ page }) => {
  const calls = await mockQuote(page, (n) => (n === 1 ? { status: 409, json: { error: 'price_changed', priceVersion: 2, snapshot: price(80000) } } : n === 2 ? { abort: true } : { json: answer(price(80000)) }))
  await signedInSummary(page)
  await send(page).click()
  await page.getByRole('button', { name: 'Neuen Preis übernehmen und senden' }).click()
  await expect(page.getByRole('alert')).toContainText('Keine Verbindung')
  const main = page.locator('main')
  await expect(main.getByText('Richtpreis', { exact: true })).toBeVisible()
  await expect(main.getByText(/^800,00\s€$/)).toBeVisible()
  await expect(main.getByText(/^770,40\s€$/)).toHaveCount(0)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(3)
  expect(calls[2]!.body['shown']).toEqual({ kind: 'price', totalCents: 80000, lowCents: 80000, highCents: 80000 })
  expect(calls[2]!.body['priceVersion']).toBe(2)
  expect(calls[2]!.body['clientRef']).toBe(calls[0]!.body['clientRef'])
})

test('409 terms_changed, dann Folgefehler: „Stornierung“ zeigt die übernommenen Stufen, „Erneut senden“ sendet deren Hash', { tag: '@breit' }, async ({ page }) => {
  const old = { cancel_free_hours: 48, cancel_late_percent: 20, cancel_full_percent: 80, cancel_full_days_before: 3, call_out_fee_cents: 0, termsHash: 'a'.repeat(64) }
  const next = { cancel_free_hours: 24, cancel_late_percent: 50, cancel_full_percent: 100, cancel_full_days_before: 1, call_out_fee_cents: 0, termsHash: 'b'.repeat(64) }
  const calls = await mockQuote(page, (n) => (n === 1 ? { status: 409, json: { error: 'terms_changed', terms: next } } : n === 2 ? { abort: true } : { json: answer(price(77040)) }))
  await signedInSummary(page, async (p) => {
    await p.route(/\/rest\/v1\/rpc\/booking_terms/, (r) => r.fulfill({ headers: cors, json: old }))
  })
  const main = page.locator('main')
  await expect(main.getByText('Kostenlos stornieren kannst du bis 48 Stunden vor dem Termin.')).toBeVisible()
  await send(page).click()
  await page.getByRole('button', { name: 'Bedingungen bestätigen und senden' }).click()
  await expect(page.getByRole('alert')).toContainText('Keine Verbindung')
  await expect(main.getByText('Kostenlos stornieren kannst du bis 24 Stunden vor dem Termin.')).toBeVisible()
  await expect(main.getByText('Danach werden 50 % des Preises berechnet, ab einem Tag vor dem Termin 100 %.')).toBeVisible()
  await expect(main.getByText(/bis 48 Stunden/)).toHaveCount(0)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(3)
  expect(calls[2]!.body['termsHash']).toBe('b'.repeat(64))
  expect(calls[2]!.body['clientRef']).toBe(calls[0]!.body['clientRef'])
})

test('409 price_changed: im Dialog ist die Aktionsleiste gesperrt, gesendet wird nur über die Karte', { tag: '@breit' }, async ({ page }) => {
  const calls = await mockQuote(page, (n) => (n === 1 ? { status: 409, json: { error: 'price_changed', priceVersion: 2, snapshot: price(80000) } } : { json: answer(price(80000)) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByRole('alert')).toContainText('Der Preis wurde aktualisiert.')
  await expect(send(page)).toBeDisabled()
  await page.waitForTimeout(500)
  expect(calls).toHaveLength(1)
})

test('409 terms_changed: Leiste gesperrt; ohne Einwilligung oder nach Kontowechsel ist auch der Karten-Knopf gesperrt', { tag: '@breit' }, async ({ page, context }) => {
  const terms = { cancel_free_hours: 24, cancel_late_percent: 50, cancel_full_percent: 100, cancel_full_days_before: 1, call_out_fee_cents: 0, termsHash: 'b'.repeat(64) }
  const calls = await mockQuote(page, () => ({ status: 409, json: { error: 'terms_changed', terms } }))
  await signedInSummary(page)
  await send(page).click()
  const accept = page.getByRole('button', { name: 'Bedingungen bestätigen und senden' })
  await expect(accept).toBeEnabled()
  await expect(send(page)).toBeDisabled()
  await page.getByRole('checkbox').uncheck()
  await expect(accept).toBeDisabled()
  await page.getByRole('checkbox').check()
  await expect(accept).toBeEnabled()
  const other = await context.newPage()
  await other.goto('/')
  await other.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))!
    const session = JSON.parse(localStorage.getItem(key)!)
    session.user.id = 'u-fremd'
    localStorage.setItem(key, JSON.stringify(session))
    new BroadcastChannel(key).postMessage({ event: 'SIGNED_IN', session })
  })
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await expect(accept).toBeDisabled()
  expect(calls).toHaveLength(1)
})

const incomplete: [string, object][] = [
  ['Preis ohne Preisversion', { error: 'price_changed', snapshot: price(80000) }],
  ['Preis ohne Snapshot', { error: 'price_changed', priceVersion: 2 }],
  ['Bedingungen ohne terms', { error: 'terms_changed' }],
  ['Bedingungen unlesbar', { error: 'terms_changed', terms: { termsHash: 'b'.repeat(64) } }],
]
for (const [name, json] of incomplete) {
  test(`409 unvollständig (${name}): wie nicht verfügbar behandelt, kein zweiter Aufruf`, { tag: '@breit' }, async ({ page }) => {
    const calls = await mockQuote(page, () => ({ status: 409, json }))
    await signedInSummary(page)
    await send(page).click()
    await expect(page.getByRole('alert')).toContainText('Das hat nicht geklappt.')
    await expect(page.getByRole('button', { name: /übernehmen und senden|bestätigen und senden/ })).toHaveCount(0)
    await page.waitForTimeout(500)
    expect(calls).toHaveLength(1)
  })
}

test('422 pickup_outside_vienna: klare Meldung, Link zu den Angaben', { tag: '@breit' }, async ({ page }) => {
  await mockQuote(page, () => ({ status: 422, json: { error: 'pickup_outside_vienna' } }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByRole('alert')).toContainText('Abholung außerhalb Wiens ist noch nicht buchbar.')
  await expect(page.getByRole('link', { name: 'Angaben ändern' })).toBeVisible()
})

test('Aufträge: nur eigene Anfragen (Filter und Spalten), Chips und Preise', { tag: '@breit' }, async ({ page }) => {
  await mockAuth(page)
  const urls: string[] = []
  await page.route('**/rest/v1/service_requests**', (r) => {
    urls.push(r.request().url())
    return r.fulfill({
      headers: cors,
      json: [
        { id: 'a', service: 'move', status: 'requested', preferred_date: '2026-11-13', from_address: 'Neubaugasse 12, 1070 Wien', to_address: 'Praterstraße 30, 1020 Wien', price_revisions: { snapshot: price(68961) }, created_at: '2026-10-31T10:00:00Z' },
        { id: 'b', service: 'clearance', status: 'awaiting_offer', preferred_date: '2026-11-18', from_address: 'Keller', to_address: null, price_revisions: { snapshot: { kind: 'offer', reasons: ['special_case'] } }, created_at: '2026-10-30T10:00:00Z' },
        { id: 'c', service: 'assembly', status: 'completed', preferred_date: null, from_address: null, to_address: null, price_revisions: { snapshot: price(77040) }, created_at: '2026-10-01T10:00:00Z' },
      ],
    })
  })
  await page.goto('/anmelden')
  await signInWithCode(page)
  await page.goto('/auftraege')
  await expect(page.getByText('Aktiv · 2')).toBeVisible()
  await expect(page.getByText('689,61 €')).toBeVisible()
  await expect(page.getByText('Preis nach Prüfung')).toBeVisible()
  await expect(page.getByText('Fr., 13. Nov. · Neubaugasse 12 → Praterstraße 30')).toBeVisible()
  await page.getByRole('radio', { name: /Erledigt/ }).check({ force: true })
  await expect(page.getByText('770,40 €')).toBeVisible()
  const url = new URL(urls[0]!)
  expect(url.searchParams.get('customer_id')).toBe('eq.u-1')
  expect(url.searchParams.get('select')).not.toContain('*')
  expect(url.searchParams.get('select')).not.toMatch(/fee|inputs/)
})

test('Die App liest nie das Journal oder Einstellungen und keine Antwort enthält Gebührenfelder', { tag: '@breit' }, async ({ page }) => {
  const requested: string[] = []
  const keys: string[] = []
  page.on('request', (r) => requested.push(r.url()))
  page.on('response', async (r) => {
    if (!/supabase|functions\/v1|rest\/v1/.test(r.url())) return
    const json: unknown = await r.json().catch(() => null)
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk)
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) {
        keys.push(k)
        walk(x)
      }
    }
    walk(json)
  })
  await page.route('**/rest/v1/service_requests**', (r) => r.fulfill({ headers: cors, json: [] }))
  await mockQuote(page, () => ({ json: answer(price(77040)) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  await page.goto('/auftraege')
  await page.getByText('Noch keine Aufträge').or(page.getByText(/Aktiv ·/)).waitFor()
  expect(requested.filter((u) => /commission_entries|platform_settings|fee_schedules|payout_preview/.test(u))).toEqual([])
  expect(keys.length).toBeGreaterThan(0)
  // call_out_fee_cents ist die Anfahrtspauschale aus den Bedingungen, keine Plattformgebühr
  expect(keys.filter((k) => k !== 'call_out_fee_cents' && /fee|payout|platform|share|anteil|vat/i.test(k))).toEqual([])
})

test('Kontowechsel in einem anderen Tab hebt die Einwilligung auf', { tag: '@breit' }, async ({ page, context }) => {
  const calls = await mockQuote(page, () => ({ json: answer(price(77040)) }))
  await signedInSummary(page)
  const other = await context.newPage()
  await other.goto('/')
  await other.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k))!
    const session = JSON.parse(localStorage.getItem(key)!)
    session.user.id = 'u-fremd'
    localStorage.setItem(key, JSON.stringify(session))
    // Der Auth-Client meldet Sitzungswechsel anderer Tabs über einen BroadcastChannel mit dem Namen des Speicherschlüssels.
    new BroadcastChannel(key).postMessage({ event: 'SIGNED_IN', session })
  })
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await expect(send(page)).toBeDisabled()
  expect(calls).toHaveLength(0)
})

test('Zusammenfassung: Richtpreis ohne Gebührenhinweis vor dem Senden, Links und Knöpfe mindestens 44 px', { tag: '@breit' }, async ({ page }) => {
  await signedInSummary(page)
  // Im Seitenübergang stehen kurz zwei main: erst auf das Ende warten, dann gilt die Prüfung der einen Seite.
  await expect(page.locator('main')).toHaveCount(1)
  await expect(page.locator('main')).toContainText(/Richtpreis\s*770,40\s€/)
  await expect(page.locator('main')).not.toContainText(/Gebühr|Provision|15 ?%/)
  for (const target of [page.getByRole('link', { name: 'AGB' }), page.getByRole('link', { name: 'Datenschutz' }), page.getByRole('button', { name: 'Anderes Konto' })]) {
    expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
})

test('Serverpreis weicht von der Vorschau ab: sichtbarer Hinweis mit dem alten Betrag', { tag: '@breit' }, async ({ page }) => {
  // Küche-Beispiel: Vorschau 770,40 €; der Server antwortet mit 790,00 €
  await mockQuote(page, () => ({ json: answer(price(79000)) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  const hint = page.getByRole('status').filter({ hasText: 'Der Preis wurde aktualisiert.' })
  await expect(hint).toContainText('Vorher angezeigt: 770,40 €')
  await expect(page.locator('main').getByText('790,00 €')).toBeVisible()
})

test('Serverpreis gleich der Vorschau: kein Hinweis', { tag: '@breit' }, async ({ page }) => {
  await mockQuote(page, () => ({ json: answer(price(77040)) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  await expect(page.locator('main')).toHaveCount(1)
  await expect(page.locator('main').getByText('770,40 €')).toBeVisible()
  await expect(page.getByText('Der Preis wurde aktualisiert.')).toHaveCount(0)
})

test('Vorschau mit Preis, Server verlangt ein Angebot: Hinweis statt stillem Wechsel', { tag: '@breit' }, async ({ page }) => {
  await mockQuote(page, () => ({ json: answer({ kind: 'offer', reasons: ['route_missing'] }, { needsQuote: true }) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  await expect(page.getByRole('status').filter({ hasText: 'Der Preis wurde aktualisiert.' })).toContainText('Vorher angezeigt: 770,40 €')
})
