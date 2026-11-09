// delete-account (S9h-4): Handler der Edge Function mit Fakes. Die Nutzer-ID kommt aus dem geprüften JWT, nie aus dem Body;
// ohne ausdrückliche Bestätigung wird nichts gelöscht; die Sperrgründe der Datenbank erreichen den Kunden als feste Codes.
import { describe, expect, it } from 'vitest'
import { handleDeleteAccount, type DeleteAccountDeps } from '../../supabase/functions/_shared/account/handlers.ts'
import { DbError } from '../../supabase/functions/_shared/jobs/handlers.ts'
import { accountDb } from '../../supabase/functions/_shared/account/db.ts'
import type { Db } from '../../supabase/functions/_shared/jobs/db.ts'

describe('accountDb.remove', () => {
  const fake = (r: { data: unknown; error: { message: string } | null }) => {
    const calls: unknown[] = []
    const db = { rpc: async (name: string, args: unknown) => (calls.push([name, args]), r) } as unknown as Db
    return { db, calls }
  }
  it('void-Antwort (data = null, kein Fehler) ist ein Erfolg, die ID geht als p_user', async () => {
    const f = fake({ data: null, error: null })
    await expect(accountDb(f.db).remove('u1')).resolves.toBeUndefined()
    expect(f.calls).toEqual([['delete_account', { p_user: 'u1' }]])
  })
  it('Fehlercode der Datenbank kommt als DbError an', async () => {
    await expect(accountDb(fake({ data: null, error: { message: 'open_requests' } }).db).remove('u1')).rejects.toEqual(new DbError('open_requests'))
  })
})

type Fake = DeleteAccountDeps & { removed: string[]; logs: Record<string, unknown>[] }
function deps(over: Partial<DeleteAccountDeps> = {}): Fake {
  const d: Fake = {
    removed: [] as string[],
    logs: [] as Record<string, unknown>[],
    allowedOrigins: [],
    getUser: async (jwt: string) => (jwt === 'ok' ? { id: 'u1', aal: 'aal1' } : null),
    remove: async (userId: string) => void d.removed.push(userId),
    log: (e: Record<string, unknown>) => void d.logs.push(e),
    ...over,
  }
  return d
}
const call = (d: DeleteAccountDeps, body: unknown = { confirm: true }, jwt = 'ok', method = 'POST') =>
  handleDeleteAccount(new Request('https://x.test/delete', { method, headers: jwt ? { authorization: `Bearer ${jwt}` } : {}, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) }), d)

describe('handleDeleteAccount', () => {
  it('löscht das Konto des JWT (aal1 genügt, Kunden haben keine MFA)', async () => {
    const d = deps()
    const res = await call(d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true })
    expect(d.removed).toEqual(['u1'])
  })

  it('ohne gültiges JWT: 401, nichts gelöscht', async () => {
    const d = deps()
    expect((await call(d, { confirm: true }, '')).status).toBe(401)
    expect((await call(d, { confirm: true }, 'bad')).status).toBe(401)
    expect(d.removed).toEqual([])
  })

  it('ohne Bestätigung oder mit fremden Feldern: 400, nichts gelöscht (die ID kommt nie aus dem Body)', async () => {
    const d = deps()
    for (const b of [{}, { confirm: false }, { confirm: 'true' }, { confirm: true, userId: 'u2' }, [], 'x']) {
      expect((await call(d, b)).status, JSON.stringify(b)).toBe(400)
    }
    expect(d.removed).toEqual([])
  })

  it('andere Methode als POST: 405', async () => {
    const d = deps()
    expect((await call(d, undefined, 'ok', 'GET')).status).toBe(405)
    expect(d.removed).toEqual([])
  })

  it('Sperrgründe der Datenbank: offene Anfrage 409, Rolle 403, unbekannt 404', async () => {
    for (const [code, status] of [['open_requests', 409], ['role_not_allowed', 403], ['not_found', 404]] as const) {
      const d = deps({ remove: async () => { throw new DbError(code) } })
      const res = await call(d)
      expect(res.status).toBe(status)
      expect(await res.json()).toEqual({ error: code })
    }
  })

  it('unbekannter Fehler: 500 ohne Details, Log ohne Nutzer-ID', async () => {
    const d = deps({ remove: async () => { throw new Error('boom secret') } })
    const res = await call(d)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'internal' })
    expect(JSON.stringify(d.logs)).not.toContain('u1')
  })
})
