import { expect, test, type Page } from '@playwright/test'
import { EMAIL, HASH, mockAuth, signInWithCode } from './auth-helpers'
import { anonymousPrices, answer, cors, mockQuote, price, toSummary, UUID } from './anfrage-helpers'
import { collectErrors } from './console'

// Der Browser meldet gemockte Fehlerantworten selbst als Konsolenfehler; die App fängt sie ab.
const failed = /status of [45]\d\d|ERR_FAILED/
const send = (page: Page) => page.getByRole('button', { name: /^(Anfrage senden|Erneut senden)$/ })

/** Zusammenfassung mit Anmeldung über den Code-Weg; danach steht die Seite wieder auf der Zusammenfassung. */
async function signedInSummary(page: Page) {
  await anonymousPrices(page)
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

test('Hauptfluss per Tastatur: Termin, Zusammenfassung, Senden, Bestätigung, Aufträge', async ({ page }) => {
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

test('Termin: Tastatur wählt Tag und Zeitfenster, ohne Tag geht es nicht weiter', async ({ page }) => {
  await page.goto('/montage')
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByLabel('Adresse').fill('Neubaugasse 12, 1070 Wien')
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
  await expect(page.getByText('Vormittag')).toBeVisible()
})

test('Doppeltipp auf „Anfrage senden“ ergibt genau einen Aufruf, mit dem Token der angezeigten Sitzung', async ({ page }) => {
  const calls = await mockQuote(page, () => ({ json: answer(price(77040)), delay: 700 }))
  await signedInSummary(page)
  await send(page).dblclick()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(1)
  expect(calls[0]!.authorization).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/)
  const body = calls[0]!.body
  expect(body['clientRef']).toMatch(UUID)
  // Der Aufruf kennt nur die Kundenwahl
  expect(Object.keys(body).sort()).toEqual(['clientRef', 'from', 'inputs', 'preferredDate', 'service', 'timeWindow'])
  expect(JSON.stringify(body)).not.toMatch(/cents|fee|price|total|status/i)
})

test('Fehler 400: Hinweis am Feld statt Servermeldung, Senden gesperrt, Link zur Korrektur', async ({ page }) => {
  await mockQuote(page, () => ({ status: 400, json: { error: 'invalid_input', message: 'preferredDate: SERVERTEXT' } }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByRole('alert')).toContainText('Das Wunschdatum geht nicht')
  await expect(page.getByText('SERVERTEXT')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Erneut senden' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Angaben ändern' }).click()
  await expect(page).toHaveURL(/\/montage\/termin$/)
})

test('Fehler 401 bei noch gesetzter Sitzung: Neu anmelden meldet lokal ab, führt zur Anmeldung (keine Schleife), der Entwurf bleibt', async ({ page }) => {
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

test('Fehler 429: Wartehinweis, kein automatischer zweiter Aufruf', async ({ page }) => {
  const calls = await mockQuote(page, () => ({ status: 429, json: { error: 'rate_limited' } }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByRole('alert')).toContainText('zu viele Anfragen')
  await expect(page.getByRole('button', { name: /^Bitte warten/ })).toBeDisabled()
  await page.waitForTimeout(1500)
  expect(calls).toHaveLength(1)
})

test('Fehler 500 und offline: erneuter Versuch per Knopf mit derselben clientRef, nie ein Preis', async ({ page }) => {
  const calls = await mockQuote(page, (n) => (n === 1 ? { status: 500, json: { error: 'internal' } } : n === 2 ? { abort: true } : { json: answer(price(77040)) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByRole('alert')).toContainText('Das hat nicht geklappt')
  await expect(page.locator('main')).not.toContainText('770,40')
  await page.getByRole('button', { name: 'Erneut senden' }).click()
  await expect(page.getByRole('alert')).toContainText('Keine Verbindung')
  await page.getByRole('button', { name: 'Erneut senden' }).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  expect(calls).toHaveLength(3)
  expect(new Set(calls.map((c) => c.body['clientRef'])).size).toBe(1)
})

test('Geänderte Eingaben nach einem Fehler bekommen eine neue clientRef', async ({ page }) => {
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

test('Angebot nötig: kein Preis, Text „Wir melden uns mit einem Angebot“', async ({ page }) => {
  await mockQuote(page, () => ({ json: answer({ kind: 'offer', reasons: ['route_missing'] }, { needsQuote: true }) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  await expect(page.getByText('Wir melden uns mit einem Angebot')).toBeVisible()
  await expect(page.getByText('Preis nach Prüfung')).toBeVisible()
  await expect(page.locator('main', { hasText: 'Anfrage gesendet.' })).not.toContainText('Richtpreis')
})

test('Spanne (Entrümpelung) erscheint als Schätzpreis in ganzen Euro, Festpreis mit Cent', async ({ page }) => {
  await page.goto('/')
  await page.evaluate((snapshot) => sessionStorage.setItem('movenow.sent', JSON.stringify({ path: 'entruempelung', id: 'x', status: 'requested', needsQuote: false, snapshot, date: '2026-11-13', route: 'Neubaugasse 12' })), price(117500, 95000, 155000, [{ key: 'clearance', cents: 117500 }]))
  await page.goto('/entruempelung/gesendet')
  await expect(page.getByText('ca. 1.175 €')).toBeVisible()
  await expect(page.getByText('950 € bis 1.550 €')).toBeVisible()
})

test('Unplausible Antwort (Zeilensumme falsch): gespeichert, aber kein Preis', async ({ page }) => {
  await mockQuote(page, () => ({ json: answer({ ...price(77040), lines: [{ key: 'assembly', cents: 1 }] }) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page.getByText('Preis siehe Aufträge')).toBeVisible()
  await expect(page.locator('main', { hasText: 'Anfrage gesendet.' })).not.toContainText('770,40')
})

test('Kontowechsel zwischen Anzeige und Senden: es wird nichts gesendet', async ({ page }) => {
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

test('„Anderes Konto“ meldet nur diese Sitzung ab und der Entwurf bleibt', async ({ page }) => {
  await signedInSummary(page)
  await page.getByRole('button', { name: 'Anderes Konto' }).click()
  await expect(page).toHaveURL(/\/anmelden$/)
  await signInWithCode(page)
  await expect(page).toHaveURL(/\/montage\/zusammenfassung$/)
  await expect(page.getByText('Neubaugasse 12, 1070 Wien')).toBeVisible()
})

test('Ohne Anmeldung: Hinweis auf das Konto, Weg über die Anmeldung, nichts wird gesendet', async ({ page }) => {
  const calls = await mockQuote(page, () => ({ json: answer(price(77040)) }))
  await mockAuth(page)
  await toSummary(page)
  await expect(page.getByText('legst du jetzt ein Konto an')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Anfrage senden' })).toHaveCount(0)
  expect(calls).toHaveLength(0)
})

test('Magic-Link in neuem Tab: der Entwurf kommt über die Übergabe mit', async ({ page, context }) => {
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

test('Aufträge: nur eigene Anfragen (Filter und Spalten), Chips und Preise', async ({ page }) => {
  await mockAuth(page)
  const urls: string[] = []
  await page.route('**/rest/v1/service_requests**', (r) => {
    urls.push(r.request().url())
    return r.fulfill({
      headers: cors,
      json: [
        { id: 'a', service: 'move', status: 'requested', preferred_date: '2026-11-13', from_address: 'Neubaugasse 12, 1070 Wien', to_address: 'Praterstraße 30, 1020 Wien', price_snapshot: price(68961), created_at: '2026-10-31T10:00:00Z' },
        { id: 'b', service: 'clearance', status: 'inspection_requested', preferred_date: '2026-11-18', from_address: 'Keller', to_address: null, price_snapshot: { kind: 'offer', reasons: ['special_case'] }, created_at: '2026-10-30T10:00:00Z' },
        { id: 'c', service: 'assembly', status: 'completed', preferred_date: null, from_address: null, to_address: null, price_snapshot: price(77040), created_at: '2026-10-01T10:00:00Z' },
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

test('Die App liest nie fee_splits oder Einstellungen und keine Antwort enthält Gebührenfelder', async ({ page }) => {
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
  expect(requested.filter((u) => /fee_splits|platform_settings|current_fee_rates/.test(u))).toEqual([])
  expect(keys.length).toBeGreaterThan(0)
  expect(keys.filter((k) => /fee|payout|platform|share|anteil|vat/i.test(k))).toEqual([])
})

test('Kontowechsel in einem anderen Tab hebt die Einwilligung auf', async ({ page, context }) => {
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

test('Zusammenfassung: kein Preis vor dem Senden, Links und Knöpfe mindestens 44 px', async ({ page }) => {
  await signedInSummary(page)
  // Im Seitenübergang stehen kurz zwei main: erst auf das Ende warten, dann gilt die Prüfung der einen Seite.
  await expect(page.locator('main')).toHaveCount(1)
  await expect(page.locator('main')).not.toContainText('€')
  for (const target of [page.getByRole('link', { name: 'AGB' }), page.getByRole('link', { name: 'Datenschutz' }), page.getByRole('button', { name: 'Anderes Konto' })]) {
    expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  }
})

test('Serverpreis weicht von der Vorschau ab: sichtbarer Hinweis mit dem alten Betrag', async ({ page }) => {
  // Küche-Beispiel: Vorschau 770,40 €; der Server antwortet mit 790,00 €
  await mockQuote(page, () => ({ json: answer(price(79000)) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  const hint = page.getByRole('status').filter({ hasText: 'Der Preis wurde aktualisiert.' })
  await expect(hint).toContainText('Vorher angezeigt: 770,40 €')
  await expect(page.locator('main').getByText('790,00 €')).toBeVisible()
})

test('Serverpreis gleich der Vorschau: kein Hinweis', async ({ page }) => {
  await mockQuote(page, () => ({ json: answer(price(77040)) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  await expect(page.locator('main').getByText('770,40 €')).toBeVisible()
  await expect(page.getByText('Der Preis wurde aktualisiert.')).toHaveCount(0)
})

test('Vorschau mit Preis, Server verlangt ein Angebot: Hinweis statt stillem Wechsel', async ({ page }) => {
  await mockQuote(page, () => ({ json: answer({ kind: 'offer', reasons: ['route_missing'] }, { needsQuote: true }) }))
  await signedInSummary(page)
  await send(page).click()
  await expect(page).toHaveURL(/\/montage\/gesendet$/)
  await expect(page.getByRole('status').filter({ hasText: 'Der Preis wurde aktualisiert.' })).toContainText('Vorher angezeigt: 770,40 €')
})
