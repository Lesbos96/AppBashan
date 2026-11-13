import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadPartnerCancel } from '../../src/lib/cancel'
import { JobError } from '../../src/lib/jobs'
import { cancelAsPartner, previewPartnerCancel } from '../../src/lib/partnerCancel'
import { contactLocked } from '../../src/lib/partnerJobs'

// s9i-7b2: Absage der Firma und Absage-Anzeige des Kunden. Der Server rechnet; hier: Aufrufkörper, Fehlerzuordnung, strenge Prüfung der Beträge.
const invoke = vi.fn()
const rpc = vi.fn()
const from = vi.fn()
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...a), functions: { invoke: (...a: unknown[]) => invoke(...a) } } }))

const R = '2d1a3b4c-7e8f-4a9b-8c7d-6e5f4a3b2c1d'
const U = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const httpError = (status: number, body: unknown) => new FunctionsHttpError({ status, json: () => Promise.resolve(body) } as unknown as Response)

beforeEach(() => {
  invoke.mockReset()
  rpc.mockReset()
  from.mockReset()
})

describe('previewPartnerCancel', () => {
  it('sendet nur Auftrag, Grund und preview; liest Pauschale und Auszahlung', async () => {
    invoke.mockResolvedValue({ data: { callOutCents: 6900, payoutCents: 5865 }, error: null })
    expect(await previewPartnerCancel(R, 'scope_impossible')).toEqual({ callOutCents: 6900, payoutCents: 5865 })
    expect(invoke).toHaveBeenCalledWith('cancel-partner', { body: { requestId: R, reason: 'scope_impossible', preview: true } })
  })

  it.each([
    ['Pauschale fehlt', { payoutCents: 0 }],
    ['negativ', { callOutCents: -1, payoutCents: 0 }],
    ['mit Nachkommastellen', { callOutCents: 1.5, payoutCents: 1 }],
    ['Auszahlung über der Pauschale', { callOutCents: 100, payoutCents: 200 }],
    ['Text statt Zahl', { callOutCents: '6900', payoutCents: '5865' }],
  ])('%s: Fehler, nie „keine Pauschale“', async (_n, data) => {
    invoke.mockResolvedValue({ data, error: null })
    await expect(previewPartnerCancel(R, 'other')).rejects.toMatchObject({ kind: 'unavailable' })
  })
})

describe('cancelAsPartner', () => {
  it('mit Pauschale: Belege und gezeigter Betrag; ohne Pauschale: keine photoIds', async () => {
    invoke.mockResolvedValue({ data: { status: 'cancelled_by_partner', callOutCents: 6900 }, error: null })
    await cancelAsPartner(R, 'scope_impossible', [U], 6900)
    expect(invoke).toHaveBeenLastCalledWith('cancel-partner', { body: { requestId: R, reason: 'scope_impossible', shownCallOutCents: 6900, photoIds: [U] } })
    await cancelAsPartner(R, 'unavailable', [U], 0)
    expect(invoke).toHaveBeenLastCalledWith('cancel-partner', { body: { requestId: R, reason: 'unavailable', shownCallOutCents: 0 } })
  })

  it('eine Antwort ohne Status ist ein Fehler', async () => {
    invoke.mockResolvedValue({ data: {}, error: null })
    await expect(cancelAsPartner(R, 'other', [], 0)).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it.each([
    [409, 'amount_changed', 'changed'],
    [409, 'call_out_not_allowed', 'no_call_out'],
    [409, 'retry', 'retry'],
    [409, 'under_review', 'under_review'],
    [409, 'too_late_for_reason', 'late_reason'],
    [422, 'receipt_required', 'receipt_missing'],
    [400, 'invalid_input', 'bad_input'],
    [409, 'invalid_transition', 'closed'],
    [404, 'not_found', 'closed'],
    [403, 'partner_not_active', 'gone'],
    [403, 'mfa_required', 'unauthorized'],
    [401, 'unauthorized', 'unauthorized'],
    [500, 'internal', 'unavailable'],
    [500, 'unbekannt', 'unavailable'],
  ])('%i %s → %s', async (status, code, kind) => {
    invoke.mockResolvedValue({ data: null, error: httpError(status, { error: code }) })
    await expect(cancelAsPartner(R, 'other', [], 0)).rejects.toMatchObject({ kind })
  })

  it('Netzfehler → offline', async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new Error('x')) })
    await expect(cancelAsPartner(R, 'other', [], 0)).rejects.toBeInstanceOf(JobError)
    await expect(cancelAsPartner(R, 'other', [], 0)).rejects.toMatchObject({ kind: 'offline' })
  })
})

describe('contactLocked', () => {
  it('nur nach Absage der Firma ohne Pauschale', () => {
    expect(contactLocked({ status: 'cancelled_by_partner', totalCents: 0 })).toBe(true)
    expect(contactLocked({ status: 'cancelled_by_partner', totalCents: 6900 })).toBe(false)
    expect(contactLocked({ status: 'cancelled_by_customer', totalCents: 0 })).toBe(false)
    expect(contactLocked({ status: 'accepted', totalCents: 0 })).toBe(false)
  })
})

describe('loadPartnerCancel (Kunde)', () => {
  const chain = (result: { data: unknown; error: unknown }) => {
    const calls: [string, unknown][] = []
    const q: Record<string, unknown> = {}
    q.select = (c: string) => (calls.push(['select', c]), q)
    q.eq = (k: string, v: unknown) => (calls.push([`eq:${k}`, v]), q)
    q.maybeSingle = () => Promise.resolve(result)
    from.mockReturnValue(q)
    return calls
  }

  it('liest die Pauschale und die Folgeanfrage über reissued_from, nur des eigenen Kunden', async () => {
    rpc.mockResolvedValue({ data: 6900, error: null })
    const calls = chain({ data: { id: U, status: 'requested' }, error: null })
    expect(await loadPartnerCancel(R, 'u-1')).toEqual({ feeCents: 6900, next: { id: U, status: 'requested' } })
    expect(rpc).toHaveBeenCalledWith('my_cancel_info', { p_request: R })
    expect(calls).toContainEqual(['eq:reissued_from', R])
    expect(calls).toContainEqual(['eq:customer_id', 'u-1'])
  })

  it('ohne Folgeanfrage: next ist null', async () => {
    rpc.mockResolvedValue({ data: 0, error: null })
    chain({ data: null, error: null })
    expect(await loadPartnerCancel(R, 'u-1')).toEqual({ feeCents: 0, next: null })
  })

  it.each([[null], [-5], [1.5], ['6900']])('Betrag %s ist ein Fehler, nie „kostenlos“', async (bad) => {
    rpc.mockResolvedValue({ data: bad, error: null })
    chain({ data: null, error: null })
    await expect(loadPartnerCancel(R, 'u-1')).rejects.toBeTruthy()
  })

  it('Fehler des Servers werden weitergegeben', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'not_found' } })
    await expect(loadPartnerCancel(R, 'u-1')).rejects.toMatchObject({ message: 'not_found' })
  })
})
