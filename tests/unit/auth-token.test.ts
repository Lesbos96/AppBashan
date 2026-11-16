// s9k1-4/-5: 401 gibt es nur für ein abgelehntes Token. `rejectToken` erkennt es am Fehlercode (nicht am Status allein) oder am Fehlertyp
// „Sitzung fehlt“ (auth-js macht aus session_not_found einen AuthSessionMissingError, Status 400, ohne Code). Alles andere, auch ein 401 oder 403
// des Gateways bei rotiertem Function-Schlüssel, ist eine Störung: `AuthServiceError` mit festem Text (nie Token oder Originalmeldung), die
// Handler antworten 500 und die App meldet nicht ab. Gemessene Codes gegen Dev: tests/rls/auth-token-codes.test.ts.
import { describe, expect, it } from 'vitest'
import { AuthServiceError, rejectToken } from '../../supabase/functions/_shared/auth.ts'
import { handleDeleteAccount } from '../../supabase/functions/_shared/account/handlers.ts'
import { handleCancelCustomer } from '../../supabase/functions/_shared/cancel/handlers.ts'
import { handleCancelPartner } from '../../supabase/functions/_shared/cancel/partner.ts'
import { handleDecideChange, handleProposeChange } from '../../supabase/functions/_shared/change/handlers.ts'
import { handleAdminCorrect } from '../../supabase/functions/_shared/admin/correct.ts'
import { handleAccept, handleAdminContact, handleConfirmOffer } from '../../supabase/functions/_shared/jobs/handlers.ts'
import { handleAdminPhoto, handleJobPhoto, handleReceipt } from '../../supabase/functions/_shared/photo/handlers.ts'
import { handleQuote } from '../../supabase/functions/_shared/quote/handler.ts'
import { getUser, type Db } from '../../supabase/functions/_shared/jobs/db.ts'
import { quoteDb } from '../../supabase/functions/_shared/quote/db.ts'

type AuthErr = { name?: string; status?: number; code?: string; message?: string }
const jwt = `h.${btoa(JSON.stringify({ aal: 'aal2' })).replaceAll('=', '')}.s`
const authDb = (r: { data: { user: { id: string } | null }; error: AuthErr | null }) => ({ auth: { getUser: async () => r } }) as unknown as Db

const REJECTED: AuthErr[] = [
  { name: 'AuthApiError', status: 403, code: 'bad_jwt' },
  { name: 'AuthApiError', status: 401, code: 'bad_jwt' },
  { name: 'AuthApiError', status: 401, code: 'session_expired' },
  { name: 'AuthApiError', status: 403, code: 'user_not_found' },
  { name: 'AuthApiError', status: 403, code: 'user_banned' },
  { name: 'AuthSessionMissingError', status: 400 },
]
const FAULTS: AuthErr[] = [
  { name: 'AuthApiError', status: 401 }, // Gateway: falscher oder rotierter Schlüssel der Function, ohne Code
  { name: 'AuthApiError', status: 403, code: 'unexpected_failure' },
  { name: 'AuthApiError', status: 400, code: 'validation_failed' },
  { name: 'AuthApiError', status: 500, code: 'unexpected_failure' },
  { name: 'AuthApiError', status: 429, code: 'over_request_rate_limit' },
  { name: 'AuthRetryableFetchError', status: 503 },
  { name: 'AuthRetryableFetchError', status: 0 },
  { name: 'AuthUnknownError', status: undefined },
]
const label = (e: AuthErr) => `${e.name} ${e.status} ${e.code ?? '-'}`

describe('rejectToken', () => {
  it('abgelehntes Token (Code oder Sitzung fehlt): null', () => {
    for (const e of REJECTED) expect(rejectToken(e), label(e)).toBeNull()
  })
  it('alles andere (Gateway 401 ohne Code, 5xx, 429, Netz, unbekannt): wirft AuthServiceError mit Status und Code', () => {
    for (const e of FAULTS) {
      let thrown: unknown
      try {
        rejectToken(e)
      } catch (x) {
        thrown = x
      }
      expect(thrown, label(e)).toBeInstanceOf(AuthServiceError)
      expect(thrown, label(e)).toMatchObject({ authStatus: e.status, authCode: e.code })
    }
  })
  it('der geworfene Fehler enthält weder Token noch Originalmeldung', () => {
    const secret = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1In0.c2lnbmF0dXI'
    let thrown: Error | undefined
    try {
      rejectToken({ name: 'AuthApiError', status: 500, code: 'unexpected_failure', message: `invalid JWT ${secret}` } as AuthErr)
    } catch (x) {
      thrown = x as Error
    }
    expect(thrown).toBeInstanceOf(AuthServiceError)
    expect(`${thrown?.message} ${thrown?.stack?.split('\n')[0]} ${JSON.stringify(thrown)}`).not.toContain(secret)
    expect(thrown && 'cause' in thrown).toBe(false)
  })
})

describe('getUser (jobs/db.ts) und quote getUserId', () => {
  it('gültiges Token: Nutzer und aal aus dem Token', async () => {
    await expect(getUser(authDb({ data: { user: { id: 'u1' } }, error: null }), jwt)).resolves.toEqual({ id: 'u1', aal: 'aal2' })
    await expect(quoteDb(authDb({ data: { user: { id: 'u1' } }, error: null })).getUserId(jwt)).resolves.toBe('u1')
  })
  it('abgelehnt: null, Störung: AuthServiceError', async () => {
    for (const error of REJECTED) {
      await expect(getUser(authDb({ data: { user: null }, error }), jwt), label(error)).resolves.toBeNull()
      await expect(quoteDb(authDb({ data: { user: null }, error })).getUserId(jwt), label(error)).resolves.toBeNull()
    }
    for (const error of FAULTS) {
      await expect(getUser(authDb({ data: { user: null }, error }), jwt), label(error)).rejects.toBeInstanceOf(AuthServiceError)
      await expect(quoteDb(authDb({ data: { user: null }, error })).getUserId(jwt), label(error)).rejects.toBeInstanceOf(AuthServiceError)
    }
  })
})

// Tabelle: jeder Handler, der ein Token prüft. Bei einer Störung des Auth-Dienstes 500 (nie 401, das die App abmeldet), nichts ausgeführt,
// und die Logzeile enthält weder das Token noch die Originalmeldung des Auth-Dienstes.
const SECRET = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1In0.c2lnbmF0dXI'
const HANDLERS: [string, (req: Request, d: never) => Promise<Response>, 'getUser' | 'getUserId'][] = [
  ['delete-account', handleDeleteAccount as never, 'getUser'],
  ['cancel-customer', handleCancelCustomer as never, 'getUser'],
  ['cancel-partner', handleCancelPartner as never, 'getUser'],
  ['change-propose', handleProposeChange as never, 'getUser'],
  ['change-decide', handleDecideChange as never, 'getUser'],
  ['admin-correct', handleAdminCorrect as never, 'getUser'],
  ['accept', handleAccept as never, 'getUser'],
  ['offer-confirm', handleConfirmOffer as never, 'getUser'],
  ['admin-contact', handleAdminContact as never, 'getUser'],
  ['photo-receipt', handleReceipt as never, 'getUser'],
  ['admin-photo', handleAdminPhoto as never, 'getUser'],
  ['job-photo', handleJobPhoto as never, 'getUser'],
  ['quote', handleQuote as never, 'getUserId'],
]

describe('Handler bei gestörtem Auth-Dienst', () => {
  for (const [name, handler, dep] of HANDLERS) {
    it(`${name}: 500, kein Token im Log`, async () => {
      const logs: unknown[] = []
      const fault = Object.assign(new Error(`fetch failed for ${SECRET}`), { name: 'AuthRetryableFetchError', status: 503 }) // wie auth-js: echter Error, Meldung mit Token
      const d = {
        allowedOrigins: [],
        [dep]: async () => rejectToken(fault),
        log: (e: unknown) => void logs.push(e),
      }
      const req = new Request('https://x.test/f', { method: 'POST', headers: { authorization: `Bearer ${SECRET}` }, body: JSON.stringify({ confirm: true }) })
      const res = await handler(req, d as never)
      expect(res.status).toBe(500)
      expect(JSON.stringify(logs)).not.toContain(SECRET)
    })
  }
})
