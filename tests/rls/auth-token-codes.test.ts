// n12 (OFFEN n15-3): Messung gegen Dev mit der echten supabase-js-Version: welche Antwort `auth.getUser(jwt)` bei gefälschtem Token, nach der Kontolöschung
// und bei falschem Schlüssel der Function liefert, und was `rejectToken` daraus macht. Ein abgelaufenes Token lässt sich ohne Signierschlüssel
// nicht erzeugen: für GoTrue gilt es wie ein gefälschtes (bad_jwt, 403; Annahme, nicht gemessen). Die Messwerte stehen in den Erwartungen.
import { afterAll, describe, expect, it } from 'vitest'
import { AuthServiceError, rejectToken } from '../../supabase/functions/_shared/auth.ts'
import { client, deleteUsers, env, makeUser, service } from '../support/db.ts'

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
    expect(seen(bad.error).status, 'falscher Schlüssel: Status').toBe(401)
    expect(seen(bad.error).code, 'falscher Schlüssel: kein Fehlercode (sonst wäre er ein abgelehntes Token)').toBeUndefined()
    expect(verdict(bad.error), JSON.stringify(seen(bad.error))).toBe('throws')

    expect((await service.rpc('delete_account', { p_user: u.id })).error).toBeNull()
    const gone = await service.auth.getUser(u.jwt)
    expect(gone.error, 'nach der Löschung: Fehler erwartet').not.toBeNull()
    expect(seen(gone.error), 'gelöschtes Konto').toEqual({ name: 'AuthSessionMissingError', status: 400, code: undefined })
    expect(verdict(gone.error)).toBe('null')

    // Live-Smoke gegen die deployten Functions: gefälschtes Token und Token eines gelöschten Kontos ergeben 401, nie 500
    const FUNCTIONS = ['accept', 'offer-confirm', 'admin-contact', 'delete-account', 'cancel-customer', 'cancel-partner', 'change-propose', 'change-decide', 'admin-correct', 'photo-receipt', 'admin-photo', 'job-photo', 'quote']
    for (const [how, token] of [['gefälscht', forged], ['gelöscht', u.jwt]] as const) {
      for (const name of FUNCTIONS) {
        const res = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}/functions/v1/${name}`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, apikey: env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), 'content-type': 'application/json' },
          body: '{}',
        })
        expect(res.status, `${name} (${how})`).toBe(401)
        expect(await res.json(), `${name} (${how}) Text`).toEqual({ error: 'unauthorized' }) // n12b N5: wirklich die Antwort für ein abgelehntes Token
      }
    }
    // n12b N1: ein Authorization-Wert mit Leerzeichen oder Sonderzeichen ist kein Token: 401 ohne Aufruf bei Auth (vorher 500, Auth-Störung im Log).
    for (const name of FUNCTIONS) {
      const res = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}/functions/v1/${name}`, {
        method: 'POST',
        headers: { authorization: 'Bearer a b', apikey: env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), 'content-type': 'application/json' },
        body: '{}',
      })
      expect(res.status, `${name} (Leerzeichen)`).toBe(401)
      expect(await res.json(), `${name} (Leerzeichen) Text`).toEqual({ error: 'unauthorized' })
    }
    // fh1 (u5-1): die zwei Cron-Functions prüfen den Aufrufer (Header mit Secret) vor der Konfiguration: ohne oder mit falschem Header 401, nie 503
    for (const [name, header] of [['outbox-send', 'x-outbox-secret'], ['photo-publish', 'x-publish-secret']] as const) {
      for (const [how, headers] of [['ohne Header', {}], ['falscher Header', { [header]: 'falsch' }]] as const) {
        const res = await fetch(`${env('NEXT_PUBLIC_SUPABASE_URL')}/functions/v1/${name}`, {
          method: 'POST',
          headers: { apikey: env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), 'content-type': 'application/json', ...headers },
          body: '{}',
        })
        expect(res.status, `${name} (${how})`).toBe(401)
        expect(await res.json(), `${name} (${how}) Text`).toEqual({ error: 'unauthorized' })
      }
    }
  }, 120_000)
})
