// `must` (jobs/db.ts): ein Deadlock (40P01) hat die Funktion zurückgerollt; der Aufrufer bekommt neutral `retry` (409) statt 500, die App kann wiederholen
// (OFFEN n15-1 N7: cancel_by_partner als Opfer gegen delete_account). Alle anderen Fehler behalten die Meldung der Exception als Code.
import { describe, expect, it } from 'vitest'
import { must } from '../../supabase/functions/_shared/jobs/db.ts'
import { DbError, STATUS } from '../../supabase/functions/_shared/jobs/handlers.ts'

describe('must', () => {
  it('40P01 wird zu DbError retry, das auf 409 abgebildet ist', () => {
    expect(() => must({ data: null, error: { message: 'deadlock detected', code: '40P01' } })).toThrow(new DbError('retry'))
    expect(STATUS['retry']).toBe(409)
  })
  it('andere Fehler behalten ihre Meldung, auch mit Code; Daten kommen durch, null ist no_data', () => {
    expect(() => must({ data: null, error: { message: 'not_found', code: 'P0001' } })).toThrow(new DbError('not_found'))
    expect(() => must({ data: null, error: { message: 'serialization failure', code: '40001' } })).toThrow(new DbError('serialization failure'))
    expect(must({ data: [1], error: null })).toEqual([1])
    expect(() => must({ data: null, error: null })).toThrow(new DbError('no_data'))
  })
})
