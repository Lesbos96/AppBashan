// s9k-1 (S9i4-3): 401 gibt es nur für ein abgelehntes Token (Auth antwortet 400, 401 oder 403, auch „session_not_found“ nach dem Löschen
// des Kontos). Jede andere Antwort des Auth-Dienstes ist eine Störung: werfen, die Handler machen daraus 500, die App meldet nicht ab.
import { describe, expect, it } from 'vitest'
import { handleDeleteAccount } from '../../supabase/functions/_shared/account/handlers.ts'
import { getUser, type Db } from '../../supabase/functions/_shared/jobs/db.ts'
import { quoteDb } from '../../supabase/functions/_shared/quote/db.ts'

const jwt = `h.${btoa(JSON.stringify({ aal: 'aal2' }))}.s`
const authDb = (r: { data: { user: { id: string } | null }; error: { status?: number; name?: string } | null }) => ({ auth: { getUser: async () => r } }) as unknown as Db

const REJECTED = [
  { name: 'AuthApiError', status: 401 },
  { name: 'AuthApiError', status: 403 },
  { name: 'AuthSessionMissingError', status: 400 },
]
const FAULTS = [
  { name: 'AuthApiError', status: 500 },
  { name: 'AuthApiError', status: 429 },
  { name: 'AuthRetryableFetchError', status: 503 },
  { name: 'AuthRetryableFetchError', status: 0 },
  { name: 'AuthUnknownError', status: undefined },
]

describe('getUser (jobs/db.ts)', () => {
  it('gültiges Token: Nutzer und aal aus dem Token', async () => {
    await expect(getUser(authDb({ data: { user: { id: 'u1' } }, error: null }), jwt)).resolves.toEqual({ id: 'u1', aal: 'aal2' })
  })
  it('abgelehntes Token (400, 401, 403): null', async () => {
    for (const error of REJECTED) await expect(getUser(authDb({ data: { user: null }, error }), jwt), `${error.name} ${error.status}`).resolves.toBeNull()
  })
  it('Störung des Auth-Dienstes (5xx, 429, Netz, unbekannt): wirft statt null', async () => {
    for (const error of FAULTS) await expect(getUser(authDb({ data: { user: null }, error }), jwt), `${error.name} ${error.status}`).rejects.toBe(error)
  })
})

describe('quote getUserId', () => {
  it('gültig, abgelehnt und Störung wie getUser', async () => {
    await expect(quoteDb(authDb({ data: { user: { id: 'u1' } }, error: null })).getUserId(jwt)).resolves.toBe('u1')
    for (const error of REJECTED) await expect(quoteDb(authDb({ data: { user: null }, error })).getUserId(jwt), `${error.name} ${error.status}`).resolves.toBeNull()
    for (const error of FAULTS) await expect(quoteDb(authDb({ data: { user: null }, error })).getUserId(jwt), `${error.name} ${error.status}`).rejects.toBe(error)
  })
})

describe('Handler bei gestörtem Auth-Dienst', () => {
  it('delete-account: 500 `internal`, nichts gelöscht (kein 401, das die App abmeldet)', async () => {
    const logs: Record<string, unknown>[] = []
    const removed: string[] = []
    const d = {
      allowedOrigins: [],
      getUser: (j: string) => getUser(authDb({ data: { user: null }, error: FAULTS[2]! }), j),
      remove: async (u: string) => void removed.push(u),
      log: (e: Record<string, unknown>) => void logs.push(e),
    }
    const res = await handleDeleteAccount(new Request('https://x.test/d', { method: 'POST', headers: { authorization: `Bearer ${jwt}` }, body: JSON.stringify({ confirm: true }) }), d)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal' })
    expect(removed).toEqual([])
  })
})
