// cancel-partner (S9h-2): Handler der Edge Function mit Fakes. Partner brauchen aal2; die Pauschale (call_out_fee_cents, höchstens der Gesamtpreis)
// rechnet splitFee mit dem eingefrorenen Satz der Buchung, sie fällt nur mit Belegfotos an. Die Datenbank prüft Grund, Nachtrag und Belege.
import { describe, expect, it } from 'vitest'
import { handleCancelPartner, type PartnerBasis, type PartnerCall, type PartnerDeps } from '../../supabase/functions/_shared/cancel/partner.ts'
import { DbError } from '../../supabase/functions/_shared/jobs/handlers.ts'
import { splitFee } from '@pricing'

const REQ = '0b9f6e0e-6d52-4b7e-9d5c-3f0c2f9a1b11'
const PHOTO = '5d0c1a2e-8f3b-4c4d-9e6f-7a8b9c0d1e2f'
const basis = (over: Partial<PartnerBasis> = {}): PartnerBasis => ({
  status: 'accepted', totalCents: 68961, callOutCents: 6900, feeRate: 0.15, feeVatRate: 0.2, feeRateVersion: 1, feeVatRateVersion: 1, ...over,
})

type Fake = PartnerDeps & { calls: PartnerCall[]; basisCalls: number; aals: string[]; logs: Record<string, unknown>[] }
function deps(over: Partial<PartnerDeps> = {}, aal = 'aal2'): Fake {
  const d: Fake = {
    calls: [] as PartnerCall[],
    basisCalls: 0,
    aals: [] as string[],
    logs: [] as Record<string, unknown>[],
    allowedOrigins: [],
    getUser: async (jwt: string) => (jwt === 'ok' ? { id: 'u1', aal } : null),
    basis: async (_u: string, a: string) => {
      d.basisCalls++
      d.aals.push(a)
      return basis()
    },
    cancel: async (_u: string, _a: string, c: PartnerCall) => {
      d.calls.push(c)
      return 'cancelled_by_partner'
    },
    log: (e: Record<string, unknown>) => void d.logs.push(e),
    ...over,
  }
  return d
}
const call = (d: PartnerDeps, body: unknown = { requestId: REQ, reason: 'unavailable' }, jwt = 'ok') =>
  handleCancelPartner(new Request('https://x.test/cancel', { method: 'POST', headers: jwt ? { authorization: `Bearer ${jwt}` } : {}, body: JSON.stringify(body) }), d)

describe('handleCancelPartner', () => {
  it('ohne Belege: keine Pauschale, Aufteilung 0', async () => {
    const d = deps()
    const res = await call(d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'cancelled_by_partner', callOutCents: 0 })
    expect(d.calls[0]).toMatchObject({ requestId: REQ, reason: 'unavailable', photoIds: [], feeBaseCents: 0 })
    expect(d.calls[0]?.split).toEqual({ totalCents: 0, feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 })
    expect(d.aals).toEqual(['aal2'])
  })

  it('mit Belegen: Pauschale aus der Grundlage, Aufteilung mit dem Satz der Buchung', async () => {
    const d = deps()
    const res = await call(d, { requestId: REQ, reason: 'scope_impossible', photoIds: [PHOTO] })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'cancelled_by_partner', callOutCents: 6900 })
    expect(d.calls[0]?.feeBaseCents).toBe(6900)
    expect(d.calls[0]?.split).toEqual(splitFee(6900, { feeRate: 0.15, vatRate: 0.2 }))
    expect(d.calls[0]?.photoIds).toEqual([PHOTO])
  })

  it('Pauschale 0 in den Bedingungen: keine Gebührenzeile, Aufteilung 0', async () => {
    const d = deps({ basis: async () => basis({ callOutCents: 0 }) })
    expect((await call(d, { requestId: REQ, reason: 'scope_impossible', photoIds: [PHOTO] })).status).toBe(200)
    expect(d.calls[0]?.feeBaseCents).toBe(0)
    expect(d.calls[0]?.split.feeCents).toBe(0)
  })

  it('aal1: 403 mfa_required, nichts wird geladen', async () => {
    const d = deps({}, 'aal1')
    const res = await call(d)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'mfa_required' })
    expect(d.basisCalls).toBe(0)
  })

  it('Satzcodes: einmal neu laden, danach neutral `retry` (409)', async () => {
    let n = 0
    const d = deps({
      cancel: async (_u, _a, c) => {
        n++
        if (n === 1) throw new DbError('fee_basis_changed')
        d.calls.push(c)
        return 'cancelled_by_partner'
      },
    })
    expect((await call(d)).status).toBe(200)
    expect(d.basisCalls).toBe(2)
    for (const code of ['fee_basis_changed', 'rate_mismatch', 'amount_mismatch']) {
      const e = deps({ cancel: async () => { throw new DbError(code) } })
      const res = await call(e)
      expect(res.status).toBe(409)
      expect(JSON.stringify(await res.json())).toBe('{"error":"retry"}')
      expect(e.basisCalls).toBe(2)
    }
  })

  it('Fehlercodes der Datenbank: Status; unbekannter Fehler 500 ohne Details', async () => {
    for (const [code, status] of [
      ['not_found', 404], ['invalid_transition', 409], ['partner_not_active', 403], ['reason_required', 422],
      ['call_out_not_allowed', 409], ['receipt_required', 422], ['too_late_for_reason', 409], ['terms_missing', 500],
    ] as const) {
      const d = deps({ cancel: async () => { throw new DbError(code) } })
      const res = await call(d)
      expect(res.status, code).toBe(status)
      if (status !== 500) expect(await res.json()).toEqual({ error: code })
    }
    const d = deps({ cancel: async () => { throw new Error('boom secret') } })
    const res = await call(d)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('boom')
    expect(JSON.stringify(d.logs)).toContain('cancel_partner_failed')
  })

  it('Eingabe: 401, 400 (Grund, Belege, Felder), 405', async () => {
    expect((await call(deps(), { requestId: REQ, reason: 'other' }, '')).status).toBe(401)
    for (const bad of [
      { requestId: 'x', reason: 'other' },
      { requestId: REQ },
      { requestId: REQ, reason: 'bogus' },
      { requestId: REQ, reason: 'other', photoIds: 'x' },
      { requestId: REQ, reason: 'other', photoIds: ['x'] },
      { requestId: REQ, reason: 'other', photoIds: Array(9).fill(PHOTO) },
      { requestId: REQ, reason: 'other', amount: 5 },
    ]) {
      expect((await call(deps(), bad)).status).toBe(400)
    }
    expect((await handleCancelPartner(new Request('https://x.test/c', { method: 'GET' }), deps())).status).toBe(405)
  })
})
