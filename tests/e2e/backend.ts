import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test as base, expect, type BrowserContext, type Route } from '@playwright/test'

/*
 * Gemocktes Backend für E2E und Shots: kein Aufruf verlässt den Browser.
 * - Unterste Schicht: jeder Aufruf an einen fremden Host (alles außer der App selbst), den kein Mock beantwortet,
 *   wird abgebrochen und gemeldet; die Fixture lässt den Test dann scheitern.
 * - Darüber Standardantworten für die öffentlichen Lesezugriffe (Tarife, Bedingungen) und eine leere Auftragsliste.
 * - Tests legen ihre eigenen Mocks mit `page.route` an (Auth, `route`, `quote`, Storage, Auftragsliste);
 *   Seiten-Routen gehen vor Kontext-Routen, `route.fallback()` reicht an diese Schicht weiter.
 * Die Muster sind hostunabhängig (`**\/rest/v1/…`): auch ein wiederverwendeter Dev-Server mit echter URL erreicht nichts.
 */

// Tarife und Bedingungen wie in supabase/seed.sql (Version 1). Der Seed ist die Quelle, keine Kopie der Werte im Test.
const seed = readFileSync(new URL('../../supabase/seed.sql', import.meta.url), 'utf8')

const version = /values \((\d+), '(\d{4}-\d{2}-\d{2})'/.exec(seed)
if (!version) throw new Error('seed.sql: price_versions nicht gefunden')
export const PRICE_VERSION = { version: Number(version[1]), effective_on: version[2]! }

const ROW = /\(1, '([\w.]+)', ([\d.]+), '([^']+)',\s*'((?:[^']|'')*)',\s*'(\[(?:[^']|'')*\])',\s*'(\d{4}-\d{2}-\d{2})'\)/gs
export const PRICE_ROWS = [...seed.matchAll(ROW)]
  .map((m) => ({ key: m[1]!, value: Number(m[2]), unit: m[3]!, label: m[4]!.replaceAll("''", "'"), sources: JSON.parse(m[5]!.replaceAll("''", "'")) as unknown, researched_at: m[6]! }))
  .sort((a, b) => a.key.localeCompare(b.key))
// Dieselbe Zahl prüft scripts/s9a1-verify.mjs gegen die Dev-Datenbank; ändert sich der Seed, soll das hier laut scheitern.
if (PRICE_ROWS.length !== 28) throw new Error(`seed.sql: ${PRICE_ROWS.length} Tarifzeilen gelesen, erwartet 28`)

const setting = (key: string) => {
  const m = new RegExp(`\\('${key}', 1, (\\d+),`).exec(seed)
  if (!m) throw new Error(`seed.sql: ${key} nicht gefunden`)
  return Number(m[1])
}
const termValues = {
  cancel_free_hours: setting('cancel_free_hours'),
  cancel_late_percent: setting('cancel_late_percent'),
  cancel_full_percent: setting('cancel_full_percent'),
  cancel_full_days_before: setting('cancel_full_days_before'),
  call_out_fee_cents: setting('call_out_fee_cents'),
}
/** Antwort von `booking_terms()`: fünf Werte und ein Hash im Format des Servers (64 Hex-Zeichen); der Mock rechnet ihn über die Werte. */
export const TERMS = { ...termValues, termsHash: createHash('sha256').update(JSON.stringify(termValues)).digest('hex') }

export const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS' }

/** JSON-Antwort samt CORS; die Vorabfrage (OPTIONS) bekommt 204. */
export function reply(route: Route, json: unknown) {
  if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  return route.fulfill({ headers: cors, json })
}

/** Tabellen-Antwort im Format von PostgREST: `.single()` schickt `Accept: application/vnd.pgrst.object+json` und erwartet ein Objekt. */
export function rest(route: Route, rows: unknown[]) {
  const single = (route.request().headers()['accept'] ?? '').includes('vnd.pgrst.object')
  return reply(route, single ? rows[0] : rows)
}

export type Backend = {
  /** Aufrufe an fremde Hosts ohne Mock (Methode und URL); muss am Testende leer sein. */
  unmocked: string[]
}

/** Legt die Schichten auf den Browser-Kontext (gilt auch für weitere Tabs desselben Tests). */
export async function installBackend(context: BrowserContext, appOrigin: string): Promise<Backend> {
  const backend: Backend = { unmocked: [] }
  await context.route(
    (url) => (url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== appOrigin,
    (route) => {
      backend.unmocked.push(`${route.request().method()} ${route.request().url()}`)
      return route.abort('blockedbyclient')
    },
  )
  await context.route('**/rest/v1/current_price_version**', (r) => rest(r, [PRICE_VERSION]))
  await context.route('**/rest/v1/price_config**', (r) => {
    const wanted = /[?&]version=eq\.(\d+)/.exec(r.request().url())?.[1]
    return rest(r, wanted === undefined || Number(wanted) === PRICE_VERSION.version ? PRICE_ROWS : [])
  })
  // Eine Funktion mit jsonb-Ergebnis liefert PostgREST als einzelnes Objekt.
  await context.route('**/rest/v1/rpc/booking_terms**', (r) => reply(r, TERMS))
  // Ohne eigenen Mock hat das Konto keine Anfragen.
  await context.route('**/rest/v1/service_requests**', (r) => rest(r, []))
  return backend
}

/** `test` mit gemocktem Backend; jede Spec importiert `test` und `expect` von hier statt aus `@playwright/test`. */
export const test = base.extend<{ backend: Backend }>({
  backend: [
    async ({ context, baseURL }, use) => {
      const backend = await installBackend(context, new URL(baseURL!).origin)
      await use(backend)
      expect(backend.unmocked, 'Aufruf ohne Mock: E2E-Tests erreichen nie ein echtes Backend').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
