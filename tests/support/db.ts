// Hilfen für die Integrationstests gegen das Dev-Projekt (npm run test:rls): Clients, Testnutzer, Aufräumen.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../supabase/functions/_shared/database.types.ts'
import { CONTACT, TERMS } from './quote.ts'

export type Db = SupabaseClient<Database>

export function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} fehlt. Tests über npm run test:rls starten.`)
  return value
}

export const client = (key: string): Db => createClient<Database>(env('NEXT_PUBLIC_SUPABASE_URL'), key, { auth: { persistSession: false, autoRefreshToken: false } })
export const service = client(env('SUPABASE_SECRET_KEY'))
export const anon = client(env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))

/** Dummy-Token von Cloudflare: Mit dem Turnstile-Testsecret (Dev) gilt jedes Token als gültig. Im Produktivprojekt scheitert es (gewollt). */
export const CAPTCHA_TEST_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX'

/** Gepaced wegen der Auth-Rate-Limits. */
export const pause = () => new Promise((resolve) => setTimeout(resolve, 400))
export const run = Date.now().toString(36)

export const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error || r.data == null) throw r.error ?? new Error('keine Daten')
  return r.data
}

export type TestUser = { id: string; db: Db; jwt: string }
const created: string[] = []

export async function makeUser(tag: string): Promise<TestUser> {
  const email = `${tag}-${run}@movenow.test`
  const password = `${crypto.randomUUID()}Aa1!`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  created.push(data.user.id)
  await pause()
  const db = client(env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'))
  const signIn = await db.auth.signInWithPassword({ email, password, options: { captchaToken: CAPTCHA_TEST_TOKEN } })
  if (signIn.error) throw signIn.error
  await pause()
  return { id: data.user.id, db, jwt: signIn.data.session.access_token }
}

export async function deleteUsers(): Promise<void> {
  for (const id of created.splice(0)) await service.auth.admin.deleteUser(id)
}

/** PostgREST-Fehlercode eines verweigerten Zugriffs (Rechte widerrufen): nicht „leeres Ergebnis", sondern 42501. */
export const DENIED = '42501'

/** Argumente von `quote_save_request` für eine gültige Anfrage (Preis 689,61 €, Bezirk 1); `over` überschreibt einzelne. */
export async function requestArgs(customerId: string, over: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  const { version } = must(await service.from('current_price_version').select('version').single())
  const day = new Date(Date.now() + 14 * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })
  return {
    p_customer: customerId, p_client_ref: crypto.randomUUID(), p_service: 'move', p_inputs: {},
    p_snapshot: { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961, lines: [{ key: 'a', cents: 68961 }], terms: TERMS },
    p_price_version: version, p_total: 68961, p_low: 68961, p_high: 68961,
    p_from_address: null, p_from_lon: null, p_from_lat: null,
    p_to_address: null, p_to_lon: null, p_to_lat: null,
    p_route: null, p_region: null, p_district: 1, p_preferred_date: day, p_time_window: null, p_description: null, p_volume: null,
    p_contact: CONTACT, p_confirmed: { shown: { kind: 'price', totalCents: 68961, lowCents: 68961, highCents: 68961 }, termsHash: TERMS.termsHash },
    ...over,
  }
}

/** Legt eine Anfrage über dieselbe SQL-Funktion an wie `quote` (der einzige Weg; direkte Inserts gibt es nicht mehr). Gibt die id zurück. */
export async function makeRequest(customerId: string, over: Record<string, unknown> = {}): Promise<string> {
  const rows = must(await service.rpc('quote_save_request', (await requestArgs(customerId, over)) as never)) as unknown as { id: string }[]
  return rows[0]!.id
}
