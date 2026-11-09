// cancel-customer (S9h-1): Handler der Edge Function mit Fakes. Die Stornogebühr rechnet splitFee mit dem eingefrorenen Satz der Buchung;
// gebucht wird nur der Betrag, den der Kunde gesehen hat (shownFeeCents), sonst 409 cancel_fee_changed.
import { describe, expect, it } from 'vitest'
import { handleCancelCustomer, type CancelBasis, type CancelCall, type CancelDeps } from '../../supabase/functions/_shared/cancel/handlers.ts'
import { DbError } from '../../supabase/functions/_shared/jobs/handlers.ts'
import { splitFee } from '@pricing'

const REQ = '0b9f6e0e-6d52-4b7e-9d5c-3f0c2f9a1b11'
const basis = (over: Partial<CancelBasis> = {}): CancelBasis => ({
  status: 'accepted', totalCents: 68961, feeBaseCents: 34481, feeRate: 0.15, feeVatRate: 0.2, feeRateVersion: 1, feeVatRateVersion: 1, ...over,
})

type Fake = CancelDeps & { calls: CancelCall[]; basisCalls: number; logs: Record<string, unknown>[] }
function deps(over: Partial<CancelDeps> = {}, bases: CancelBasis[] = [basis()]): Fake {
  const d: Fake = {
    calls: [] as CancelCall[],
    basisCalls: 0,
    logs: [] as Record<string, unknown>[],
    allowedOrigins: [],
    getUser: async (jwt: string) => (jwt === 'ok' ? { id: 'u1', aal: 'aal1' } : null),
    basis: async () => bases[Math.min(d.basisCalls++, bases.length - 1)] as CancelBasis,
    cancel: async (_u: string, c: CancelCall) => {
      d.calls.push(c)
      return 'cancelled_by_customer'
    },
    log: (e: Record<string, unknown>) => void d.logs.push(e),
    ...over,
  }
  return d
}
const call = (d: CancelDeps, body: unknown = { requestId: REQ, shownFeeCents: 34481 }, jwt = 'ok') =>
  handleCancelCustomer(new Request('https://x.test/cancel', { method: 'POST', headers: jwt ? { authorization: `Bearer ${jwt}` } : {}, body: JSON.stringify(body) }), d)

describe('handleCancelCustomer', () => {
  it('rechnet die Stornogebühr mit dem Satz der Buchung und antwortet mit dem Betrag des Kunden (ohne Plattformgebühr)', async () => {
    const d = deps()
    const res = await call(d)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'cancelled_by_customer', cancelFeeCents: 34481 })
    expect(d.calls).toHaveLength(1)
    expect(d.calls[0]?.split).toEqual(splitFee(34481, { feeRate: 0.15, vatRate: 0.2 }))
    expect(d.calls[0]?.requestId).toBe(REQ)
  })

  it('ohne Stornogebühr: Aufteilung 0, aal1 genügt (Kunden haben keine MFA)', async () => {
    const d = deps({}, [basis({ feeBaseCents: 0 })])
    const res = await call(d, { requestId: REQ, shownFeeCents: 0 })
    expect(res.status).toBe(200)
    expect(d.calls[0]?.split).toEqual({ totalCents: 0, feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 })
    expect(await res.json()).toEqual({ status: 'cancelled_by_customer', cancelFeeCents: 0 })
  })

  it('H1: weicht die Stufe von der gezeigten Gebühr ab, wird nicht storniert: 409 cancel_fee_changed mit dem neuen Betrag des Kunden', async () => {
    const d = deps({}, [basis({ feeBaseCents: 34481 })])
    const res = await call(d, { requestId: REQ, shownFeeCents: 0 })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'cancel_fee_changed', cancelFeeCents: 34481 })
    expect(d.calls).toHaveLength(0)
  })

  it('H1: wechselt die Stufe zwischen Grundlage und Storno (amount_mismatch), wird mit der neuen Basis nicht still gebucht', async () => {
    const d = deps(
      { cancel: async () => { throw new DbError('amount_mismatch') } },
      [basis({ feeBaseCents: 0 }), basis({ feeBaseCents: 34481 })],
    )
    const res = await call(d, { requestId: REQ, shownFeeCents: 0 })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'cancel_fee_changed', cancelFeeCents: 34481 })
    expect(d.calls).toHaveLength(0)
  })

  it('Vorschau: liefert nur den Betrag des Kunden, storniert nichts', async () => {
    const d = deps()
    const res = await call(d, { requestId: REQ, preview: true })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ cancelFeeCents: 34481 })
    expect(d.calls).toHaveLength(0)
  })

  it('Satzcodes: einmal neu laden (gleiche Kundengebühr), danach neutral `retry`; kein fee_-Code geht an den Kunden', async () => {
    let n = 0
    const d = deps({
      cancel: async (_u, c) => {
        n++
        if (n === 1) throw new DbError('fee_basis_changed')
        d.calls.push(c)
        return 'cancelled_by_customer'
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

  it('Fehlercodes der Datenbank: Status, unbekannter Fehler 500 ohne Details; 401, 400, 405', async () => {
    for (const [code, status] of [['not_found', 404], ['invalid_transition', 409], ['under_review', 409], ['terms_missing', 500]] as const) {
      const d = deps({ cancel: async () => { throw new DbError(code) } })
      expect((await call(d)).status).toBe(status)
    }
    const d = deps({ cancel: async () => { throw new Error('boom secret') } })
    const res = await call(d)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('boom')
    expect(JSON.stringify(d.logs)).toContain('cancel_customer_failed')
    expect((await call(deps(), { requestId: REQ, shownFeeCents: 0 }, '')).status).toBe(401)
    for (const bad of [{ requestId: 'x', shownFeeCents: 0 }, { requestId: REQ }, { requestId: REQ, shownFeeCents: -1 }, { requestId: REQ, shownFeeCents: 1.5 }, { requestId: REQ, shownFeeCents: 0, amount: 5 }]) {
      expect((await call(deps(), bad)).status).toBe(400)
    }
    expect((await handleCancelCustomer(new Request('https://x.test/c', { method: 'GET' }), deps())).status).toBe(405)
  })
})
