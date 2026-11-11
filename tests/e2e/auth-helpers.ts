import { expect, type Page } from '@playwright/test'

export const EMAIL = 'kunde@movenow.test'
export const CODE = '12345678'
export const HASH = 'abcdEFGH12345678_-xyz'

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
/** Antwort der Auth-API mit Token wie echt: `aal` und `amr` stehen im Token (aal1 nach Mail-Code, aal2 nach TOTP). */
export const makeSession = (aal: 'aal1' | 'aal2' = 'aal1', factors: object[] = []) => ({
  access_token: `${b64({ alg: 'HS256' })}.${b64({ sub: 'u-1', role: 'authenticated', aal, amr: [{ method: aal === 'aal2' ? 'totp' : 'otp', timestamp: 1 }], exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`,
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'refresh',
  user: { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', factors },
})

export type AuthMock = {
  /** Token der Anmeldung per Mail-Code oder Link; Standard aal1, ein Test mit schon bestätigtem Faktor kann aal2 setzen. */
  aal?: 'aal1' | 'aal2'
  /** Faktoren des Kontos in der Antwort der Anmeldung (`user.factors`). */
  factors?: object[]
  /** Antwort von `/otp` (Code anfordern); 200 = Mail unterwegs. */
  otp?: { status: number; code?: string } | 'offline'
  /** Antwort von `/verify` (Code oder Link prüfen). */
  verify?: { status: number; code?: string } | 'offline'
}

// Das Testprotokoll: nur Pfad und Methode, nie Body oder Header (dort stehen Code und Token).
export type AuthCalls = { otp: number; verify: number; logout: number; verifyBodies: string[] }

/** Fängt alle Aufrufe an die Auth-API ab (keine echten Mails). `RAW_SUPABASE_TEXT` darf nie in der Oberfläche stehen. */
export async function mockAuth(page: Page, mock: AuthMock = {}): Promise<AuthCalls> {
  const calls: AuthCalls = { otp: 0, verify: 0, logout: 0, verifyBodies: [] }
  const reply = (route: Parameters<Parameters<Page['route']>[1]>[0], r: NonNullable<AuthMock['otp']>, ok: object) =>
    r === 'offline'
      ? route.abort('failed')
      : r.status === 200
        ? route.fulfill({ json: ok })
        : route.fulfill({ status: r.status, json: { code: r.status, error_code: r.code, msg: 'RAW_SUPABASE_TEXT' } })
  await page.route('**/auth/v1/otp**', (route) => {
    calls.otp++
    return reply(route, mock.otp ?? { status: 200 }, {})
  })
  await page.route('**/auth/v1/verify**', (route) => {
    calls.verify++
    calls.verifyBodies.push(route.request().postData() ?? '')
    return reply(route, mock.verify ?? { status: 200 }, makeSession(mock.aal, mock.factors))
  })
  await page.route('**/auth/v1/user**', (route) => route.fulfill({ json: makeSession(mock.aal, mock.factors).user }))
  await page.route('**/auth/v1/logout**', (route) => {
    calls.logout++
    return route.fulfill({ status: 204, body: '' })
  })
  return calls
}

/** Meldet über die Oberfläche an (Code-Weg), ausgehend von der Seite `/anmelden`. */
export async function signInWithCode(page: Page) {
  await page.getByLabel('E-Mail').fill(EMAIL)
  await page.getByRole('button', { name: 'Code senden' }).click()
  await page.getByLabel('Code').fill(CODE)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page).not.toHaveURL(/\/anmelden/)
}
