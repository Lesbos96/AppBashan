import { expect, test, PRICE_ROWS, TERMS } from './backend'

// Selbsttest der Mock-Schicht: Sperre für ungemockte Aufrufe und Daten aus supabase/seed.sql.

const BLOCKED = ['https://e2e.supabase.invalid/rest/v1/request_contacts', 'https://abcdefghijklmnop.supabase.co/functions/v1/quote']

test('Ungemockte Aufrufe werden abgebrochen und gemeldet, auch an einen echten Supabase-Host', async ({ page, backend }) => {
  await page.goto('/profil')
  const results = await page.evaluate((urls) => Promise.all(urls.map((u) => fetch(u).then(() => 'erreicht', () => 'abgebrochen'))), BLOCKED)
  expect(results).toEqual(['abgebrochen', 'abgebrochen'])
  expect([...backend.unmocked].sort()).toEqual(BLOCKED.map((u) => `GET ${u}`).sort())
  // Hier erwartet: nicht dem Test anlasten (die Fixture prüft am Ende auf eine leere Liste)
  backend.unmocked.length = 0
})

test('Tarife und Bedingungen kommen aus seed.sql: 28 Zeilen, Bedingungen mit gültigem Hash', async ({ page }) => {
  expect(PRICE_ROWS).toHaveLength(28)
  expect(TERMS.termsHash).toMatch(/^[0-9a-f]{64}$/)
  const loaded: string[] = []
  page.on('response', (r) => {
    if (/\/rest\/v1\/(current_price_version|price_config)/.test(r.url())) loaded.push(`${r.status()} ${new URL(r.url()).pathname}`)
  })
  await page.goto('/profil/preise')
  await expect(page.getByRole('dialog', { name: 'Wie rechnet MoveNow?' })).toContainText('55,75 € je Stunde')
  // Im Dev-Modus lädt React StrictMode doppelt; maßgeblich ist, dass jeder Aufruf mit 200 aus der Schicht kam.
  expect(new Set(loaded)).toEqual(new Set(['200 /rest/v1/current_price_version', '200 /rest/v1/price_config']))
})

// Rot-Beweis der Fixture (nur mit E2E_REDPROOF=1): ein ungemockter Aufruf ohne Aufräumen muss den Test scheitern lassen
// („Aufruf ohne Mock: …“). Ohne die Variable übersprungen.
test('Rot-Beweis: ungemockter Aufruf lässt den Test scheitern', async ({ page }) => {
  test.skip(!process.env.E2E_REDPROOF, 'nur mit E2E_REDPROOF=1')
  await page.goto('/profil')
  await page.evaluate((url) => fetch(url).catch(() => null), BLOCKED[0]!)
})
