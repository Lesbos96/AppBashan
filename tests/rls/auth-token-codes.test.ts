// s9k1-4: Messung gegen Dev mit der echten supabase-js-Version: welche Antwort `auth.getUser(jwt)` bei gefälschtem Token, nach der Kontolöschung
// und bei falschem Schlüssel der Function liefert, und was `rejectToken` daraus macht. Ein abgelaufenes Token lässt sich ohne Signierschlüssel
// nicht erzeugen: für GoTrue gilt es wie ein gefälschtes (bad_jwt, 403; Annahme, nicht gemessen). Die Messwerte stehen in den Erwartungen.
import { afterAll, describe, expect, it } from 'vitest'
import { AuthServiceError, rejectToken } from '../../supabase/functions/_shared/auth.ts'
import { client, deleteUsers, makeUser, service } from '../support/db.ts'

afterAll(deleteUsers)

type Seen = { name?: string; status?: number; code?: string }
const seen = (e: unknown): Seen => {
  const { name, status, code } = (e ?? {}) as Seen
  return { name, status, code }
}
const verdict = (e: unknown): 'null' | 'throws' => {
  try {
    return rejectToken(e as Seen) === null ? 'null' : 'throws'
  } catch (x) {
    expect(x).toBeInstanceOf(AuthServiceError)
    return 'throws'
  }
}

describe('auth.getUser: Antworten auf ein Token (Messung)', () => {
  it('gültiges Token: kein Fehler; gefälscht: 403 bad_jwt → 401; gelöschtes Konto: Sitzung fehlt → 401; falscher Schlüssel: Störung → 500', async () => {
    const u = await makeUser('n15-token')
    const ok = await service.auth.getUser(u.jwt)
    expect(ok.error, JSON.stringify(seen(ok.error))).toBeNull()

    const [h, p, s] = u.jwt.split('.')
    const forged = `${h}.${p}.${s!.slice(0, -4)}AAAA`
    const f = await service.auth.getUser(forged)
    expect(seen(f.error), 'gefälscht').toEqual({ name: 'AuthApiError', status: 403, code: 'bad_jwt' })
    expect(verdict(f.error)).toBe('null')

    const bad = await client('kein-gueltiger-schluessel').auth.getUser(u.jwt)
    expect(bad.error, 'falscher Schlüssel: Fehler erwartet').not.toBeNull()
    expect(seen(bad.error), 'falscher Schlüssel').toMatchObject({ status: 401 })
    expect(verdict(bad.error), JSON.stringify(seen(bad.error))).toBe('throws')

    expect((await service.rpc('delete_account', { p_user: u.id })).error).toBeNull()
    const gone = await service.auth.getUser(u.jwt)
    expect(gone.error, 'nach der Löschung: Fehler erwartet').not.toBeNull()
    expect(seen(gone.error), 'gelöschtes Konto').toEqual({ name: 'AuthSessionMissingError', status: 400, code: undefined })
    expect(verdict(gone.error)).toBe('null')
  }, 60_000)
})
