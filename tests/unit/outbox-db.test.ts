// Konto-Adresse für die Outbox (mail2, GOLIVE 46 und 47): nur „Konto gibt es nicht“ (404 user_not_found, live belegt) ist ein Ergebnis und wird zu no_recipient;
// jeder andere Lesefehler wirft und ist ein normaler Fehlversuch mit Wiederholung. Die Fehlerform ist die echte Klasse der Auth-Bibliothek.
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { type Db, outboxDb } from '../../supabase/functions/_shared/jobs/db.ts'

const auth = (result: unknown, calls: string[] = []) =>
  ({
    auth: {
      admin: {
        getUserById: async (id: string) => {
          calls.push(id)
          if (result instanceof Error) throw result
          return result
        },
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [{ customer_id: 'c1' }], error: null }) }) }) }),
  }) as unknown as Db

const fehler = (status: number, code: string) => ({ data: { user: null }, error: new AuthApiError('x', status, code) })

describe('outboxDb.accountEmail', () => {
  it('liefert die Anmeldeadresse; ein Konto ohne Adresse und ein fehlendes Konto (404 user_not_found) ergeben null', async () => {
    const calls: string[] = []
    expect(await outboxDb(auth({ data: { user: { email: 'a@example.com' } }, error: null }, calls)).accountEmail('u1')).toBe('a@example.com')
    expect(calls).toEqual(['u1'])
    expect(await outboxDb(auth({ data: { user: {} }, error: null })).accountEmail('u1')).toBeNull()
    expect(await outboxDb(auth(fehler(404, 'user_not_found'))).accountEmail('u1')).toBeNull()
  })

  it.each([
    ['500 unexpected_failure', fehler(500, 'unexpected_failure')],
    ['429 Rate-Limit', fehler(429, 'over_request_rate_limit')],
    ['503', fehler(503, 'unexpected_failure')],
    ['404 mit anderem Code (kein „Konto fehlt“)', fehler(404, 'not_found')],
    ['401 (Schlüssel)', fehler(401, 'bad_jwt')],
    ['Netz (Fehlerobjekt der Bibliothek)', { data: { user: null }, error: new AuthRetryableFetchError('x', 0) }],
    ['Ausnahme beim Aufruf', new TypeError('fetch failed')],
  ])('Lesefehler %s wirft (Wiederholung), nie null', async (_name, result) => {
    await expect(outboxDb(auth(result)).accountEmail('u1')).rejects.toThrow()
  })

  it('requestCustomerEmail: dieselbe Regel (404 user_not_found → null, sonst Fehler)', async () => {
    expect(await outboxDb(auth({ data: { user: { email: 'k@example.com' } }, error: null })).requestCustomerEmail('r1')).toBe('k@example.com')
    expect(await outboxDb(auth(fehler(404, 'user_not_found'))).requestCustomerEmail('r1')).toBeNull()
    await expect(outboxDb(auth(fehler(500, 'unexpected_failure'))).requestCustomerEmail('r1')).rejects.toThrow()
  })
})
