// Journal-Download der Firma (s9i-7c1): Aufruf von my_commissions, Prüfungen vor der Datei, Fehlerarten.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JobError, jobErrorText } from '../../src/lib/jobs'
import { MONTH, journalName, loadJournalCsv } from '../../src/lib/partnerJournal'

const calls: { rpc: unknown[]; select: unknown[]; order: unknown[][]; range: [number, number][] } = { rpc: [], select: [], order: [], range: [] }
let answer: (from: number, to: number) => { data: unknown; error: unknown; count: number | null } | Promise<never>
const builder: Record<string, unknown> = {
  select: (...a: unknown[]) => ((calls.select = a), builder),
  order: (...a: unknown[]) => (calls.order.push(a), builder),
  range: (from: number, to: number) => {
    calls.range.push([from, to])
    return Promise.resolve().then(() => answer(from, to))
  },
}
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => ((calls.rpc = a), builder) } }))

const REQ = '0b8f1c3e-5d2a-4e7b-9a61-3c4d5e6f7a8b'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const row = (n: number, over: Record<string, unknown> = {}) => ({
  entry_id: id(n), request_id: REQ, kind: 'booking', reverses_entry_id: null, created_at: '2026-10-05T08:30:00+00:00', total_cents: 6900, fee_schedule: 'v1 15 %',
  fee_net_cents: 863, fee_vat_cents: 172, fee_cents: 1035, payout_cents: 5865, billing_month: '2026-10-01', ...over,
})
const COLUMNS = 'entry_id, request_id, kind, reverses_entry_id, created_at, total_cents, fee_schedule, fee_net_cents, fee_vat_cents, fee_cents, payout_cents, billing_month'

beforeEach(() => {
  calls.rpc = []
  calls.select = []
  calls.order = []
  calls.range = []
  answer = () => ({ data: [], error: null, count: 0 })
})

describe('Monat und Dateiname', () => {
  it('JJJJ-MM mit Monat 01 bis 12', () => {
    for (const ok of ['2026-01', '2026-12', '1999-10']) expect(MONTH.test(ok)).toBe(true)
    for (const bad of ['2026-13', '2026-00', '2026-1', '26-10', '2026-10-01', '', ' 2026-10', '2026-10\n']) expect(MONTH.test(bad)).toBe(false)
  })
  it('Dateiname enthält nur den Monat', () => {
    expect(journalName('2026-10')).toBe('movenow-journal-2026-10.csv')
  })
})

describe('loadJournalCsv', () => {
  it('ungültiger Zeitraum: Fehlerart period, kein Aufruf', async () => {
    for (const bad of ['2026-13', '', '2026-10-01', 'abc']) await expect(loadJournalCsv(bad)).rejects.toMatchObject({ kind: 'period' })
    expect(calls.rpc).toEqual([])
    expect(jobErrorText.period).toMatch(/Monat/)
  })

  it('ruft my_commissions mit Monatsanfang, count exact, genau den 12 Spalten und fester Sortierung', async () => {
    answer = () => ({ data: [row(1)], error: null, count: 1 })
    const { name, csv } = await loadJournalCsv('2026-10')
    expect(calls.rpc).toEqual(['my_commissions', { p_month: '2026-10-01' }, { count: 'exact' }])
    expect(calls.select).toEqual([COLUMNS])
    expect(calls.order).toEqual([['created_at'], ['entry_id']])
    expect(name).toBe('movenow-journal-2026-10.csv')
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('leerer Zeitraum: Datei nur mit Kopfzeile, kein Fehler', async () => {
    const { csv } = await loadJournalCsv('2026-10')
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(1)
  })

  it('mehr als 1000 Zeilen: zwei Seiten, alle Zeilen in der Datei', async () => {
    const all = Array.from({ length: 1001 }, (_, i) => row(i + 1))
    answer = (from, to) => ({ data: all.slice(from, to + 1), error: null, count: 1001 })
    const { csv } = await loadJournalCsv('2026-10')
    expect(calls.range).toEqual([[0, 999], [1000, 1999]])
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(1002)
  })

  it('genau 1000 Zeilen: ein Aufruf', async () => {
    const all = Array.from({ length: 1000 }, (_, i) => row(i + 1))
    answer = (from, to) => ({ data: all.slice(from, to + 1), error: null, count: 1000 })
    const { csv } = await loadJournalCsv('2026-10')
    expect(calls.range).toEqual([[0, 999]])
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(1001)
  })

  it('Zeile über die Seitengrenze doppelt (Zähler wuchs zwischen den Seiten): keine Datei', async () => {
    const all = Array.from({ length: 1001 }, (_, i) => row(i + 1))
    answer = (from) => ({ data: from === 0 ? all.slice(0, 1000) : [all[0]], error: null, count: 1001 })
    await expect(loadJournalCsv('2026-10')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it.each([
    ['Zeilenzahl weicht vom count ab', () => ({ data: [row(1)], error: null, count: 2 })],
    ['doppelte Journal-ID', () => ({ data: [row(1), row(1)], error: null, count: 2 })],
    ['Zeile aus anderem Monat', () => ({ data: [row(1, { billing_month: '2026-11-01' })], error: null, count: 1 })],
    ['count fehlt', () => ({ data: [row(1)], error: null, count: null })],
    ['unbekannte Art', () => ({ data: [row(1, { kind: 'refund' })], error: null, count: 1 })],
    ['Betrag kein Integer', () => ({ data: [row(1, { total_cents: 69.5 })], error: null, count: 1 })],
    ['keine Liste', () => ({ data: { a: 1 }, error: null, count: 1 })],
  ])('%s: keine Datei, Fehlerart unavailable', async (_n, a) => {
    answer = a as typeof answer
    await expect(loadJournalCsv('2026-10')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it.each([
    ['aal1', { code: 'P0001', message: 'mfa_required' }, 'unauthorized'],
    ['abgelaufenes Token', { code: 'PGRST301', message: 'JWT expired' }, 'unauthorized'],
    ['anon ohne Recht', { code: '42501', message: 'permission denied for function my_commissions' }, 'unauthorized'],
    ['keine Firma', { code: 'P0001', message: 'not_found' }, 'gone'],
    ['Netzfehler (postgrest-js liefert Code leer)', { code: '', message: 'TypeError: Failed to fetch' }, 'offline'],
    ['irgendein Datenbankfehler', { code: 'XX000', message: 'boom' }, 'unavailable'],
  ])('Fehler %s wird %s', async (_n, error, kind) => {
    answer = () => ({ data: null, error, count: null })
    await expect(loadJournalCsv('2026-10')).rejects.toMatchObject({ kind })
  })

  it('geworfener Netzfehler ist offline', async () => {
    answer = () => Promise.reject(new TypeError('fetch failed'))
    await expect(loadJournalCsv('2026-10')).rejects.toBeInstanceOf(JobError)
    await expect(loadJournalCsv('2026-10')).rejects.toMatchObject({ kind: 'offline' })
  })
})
