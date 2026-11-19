// ts1: Turnstile live gegen das Dev-Projekt (npm run test:rls). Voraussetzung (Beks, docs/GOLIVE.md 13 und 18): Function `route` deployt mit dem Function-Secret
// TURNSTILE_SECRET_KEY = Cloudflare-Testsecret („immer gültig“) und im Auth-Dashboard Captcha an (Cloudflare Turnstile, derselbe Testsecret).
// Mit dem Always-pass-Testsecret gilt jedes nicht leere Token als gültig: „von Cloudflare abgelehntes Token → 403“ beweist hier nur der Unit-Test
// (tests/unit/route.test.ts, tests/unit/turnstile.test.ts), nicht dieser Lauf. Dieser Lauf belegt: fehlendes Token → 403 ohne Wirkung, Dummy-Token → Weg offen,
// Auth verlangt am Passwort- und Mail-Weg ein Token, verifyOtp und Sitzungserneuerung laufen ohne Token weiter.
import { afterAll, describe, expect, it } from 'vitest'
import { CAPTCHA_TEST_TOKEN, deleteUsers, env, makeUser, pause, run, service } from '../support/db.ts'
import { createClient } from '@supabase/supabase-js'

const url = env('NEXT_PUBLIC_SUPABASE_URL')
const publishableKey = env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')

const callRoute = (body: object) =>
  fetch(`${url}/functions/v1/route`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: publishableKey }, body: JSON.stringify(body) })

/** Summe aller Zähler des Modus (alle Buckets und Fenster): ein abgelehnter Aufruf darf nichts verbrauchen. */
async function hits(mode: 'geocode' | 'route'): Promise<number> {
  const { data, error } = await service.from('route_rate_limits').select('hits').like('bucket', `${mode}:%`)
  if (error) throw error
  return data.reduce((sum, row) => sum + row.hits, 0)
}

const q = 'Stephansplatz 1, 1010 Wien'
const authClient = () => createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })

afterAll(deleteUsers)

describe('route: Turnstile-Token', () => {
  it('ohne gültiges Token: 403 captcha_failed, ohne Wirkung auf Zähler und Anbieter', async () => {
    const before = await hits('geocode')
    for (const captcha of [undefined, '', 'x'.repeat(2049), 5]) {
      const res = await callRoute({ mode: 'geocode', q, captcha })
      expect(res.status, `Token ${typeof captcha}`).toBe(403)
      expect(await res.json()).toEqual({ error: 'captcha_failed' })
    }
    expect(await hits('geocode')).toBe(before)
  })

  it('mit Dummy-Token (Testsecret): der Weg ist offen und verbraucht genau einen Zählerschritt je Fenster', async () => {
    const before = await hits('geocode')
    const res = await callRoute({ mode: 'geocode', q, captcha: CAPTCHA_TEST_TOKEN })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { candidates?: unknown }
    expect(Array.isArray(body.candidates)).toBe(true)
    expect(await hits('geocode')).toBeGreaterThan(before) // Positivkontrolle: die Messung sieht Zähler, die ohne Token fehlten
  })

  it('ungültige Eingabe bleibt 400 und verlangt noch kein Token (Prüfung der Eingabe zuerst)', async () => {
    expect((await callRoute({ mode: 'x' })).status).toBe(400)
  })
})

describe('Auth: Captcha am Anmeldeweg', () => {
  const email = `captcha-${run}@movenow.test`
  const password = `${crypto.randomUUID()}Aa1!`
  let userId = ''

  it('Passwort-Anmeldung und Mail-Anforderung ohne Token: abgelehnt mit captcha_failed; mit Token klappt die Anmeldung', async () => {
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true })
    if (created.error) throw created.error
    userId = created.data.user.id
    await pause()

    const noToken = await authClient().auth.signInWithPassword({ email, password })
    expect(noToken.error?.code, `Status ${noToken.error?.status}`).toBe('captcha_failed')
    await pause()
    const otp = await authClient().auth.signInWithOtp({ email: `captcha-otp-${run}@movenow.test`, options: { shouldCreateUser: true } })
    expect(otp.error?.code, `Status ${otp.error?.status}`).toBe('captcha_failed')
    await pause()

    const withToken = await authClient().auth.signInWithPassword({ email, password, options: { captchaToken: CAPTCHA_TEST_TOKEN } })
    expect(withToken.error).toBeNull()
    expect(withToken.data.session?.access_token).toBeTruthy()
  })

  it('Code-Prüfung (verifyOtp) und Sitzungserneuerung brauchen kein Token', async () => {
    const link = await service.auth.admin.generateLink({ type: 'magiclink', email })
    if (link.error) throw link.error
    await pause()
    const client = authClient()
    const verified = await client.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: 'email' })
    expect(verified.error).toBeNull()
    await pause()
    const refreshed = await client.auth.refreshSession()
    expect(refreshed.error).toBeNull()
    expect(refreshed.data.session?.access_token).toBeTruthy()
    await service.auth.admin.deleteUser(userId)
  })

  it('Testnutzer der Suite melden sich mit dem Dummy-Token an (Hilfsfunktion makeUser)', async () => {
    const user = await makeUser('captcha-hilfe')
    expect(user.jwt.length).toBeGreaterThan(20)
  })
})
