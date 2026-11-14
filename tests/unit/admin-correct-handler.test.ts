// admin-correct (S9h-3, T14): Handler der Edge Function mit Fakes. admin braucht aal2; die Gebühr (nur mit `charge` bei einem Storno) rechnet
// splitFee mit dem eingefrorenen Satz der Buchung, die Datenbank prüft Rolle, Status, Basis und Satz.
import { describe, expect, it } from 'vitest'
import { handleAdminCorrect, type CorrectBasis, type CorrectCall, type CorrectDeps } from '../../supabase/functions/_shared/admin/correct.ts'
import { DbError } from '../../supabase/functions/_shared/jobs/handlers.ts'
import { splitFee } from '@pricing'

const REQ = '0b9f6e0e-6d52-4b7e-9d5c-3f0c2f9a1b11'
const REASON = 'Prüfung abgeschlossen, Beleg liegt vor'
const basis = (over: Partial<CorrectBasis> = {}): CorrectBasis => ({
  status: 'completed', totalCents: 68961, customerFeeBaseCents: 68961, callOutCents: 6900, feeTiers: [{ upToCents: null, bp: 1500 }], feeVatRate: 0.2, feeScheduleVersion: 1, feeVatRateVersion: 1, ...over,
})

type Fake = CorrectDeps & { calls: CorrectCall[]; basisCalls: number; logs: Record<string, unknown>[] }
function deps(over: Partial<CorrectDeps> = {}, aal = 'aal2'): Fake {
  const d: Fake = {
    calls: [] as CorrectCall[],
    basisCalls: 0,
    logs: [] as Record<string, unknown>[],
    allowedOrigins: [],
    getUser: async (jwt: string) => (jwt === 'ok' ? { id: 'u1', aal } : null),
    basis: async () => {
      d.basisCalls++
      return basis()
    },
    correct: async (_u: string, _a: string, c: CorrectCall) => {
      d.calls.push(c)
      return 'cancelled_by_customer'
    },
    log: (e: Record<string, unknown>) => void d.logs.push(e),
    ...over,
  }
  return d
}
const call = (d: CorrectDeps, body: unknown = { requestId: REQ, action: 'complete', reason: REASON }, jwt = 'ok') =>
  handleAdminCorrect(new Request('https://x.test/c', { method: 'POST', headers: jwt ? { authorization: `Bearer ${jwt}` } : {}, body: JSON.stringify(body) }), d)

describe('handleAdminCorrect', () => {
  it('ohne Gebühr: keine Grundlage geladen, Aufteilung 0', async () => {
    const d = deps()
    for (const action of ['complete', 'negate_fee', 'dismiss_report']) {
      const res = await call(d, { requestId: REQ, action, reason: REASON })
      expect(res.status).toBe(200)
    }
    expect(d.basisCalls).toBe(0)
    expect(d.calls.map((c) => c.feeBaseCents)).toEqual([0, 0, 0])
    expect(d.calls[0]?.split.feeCents).toBe(0)
    expect(d.calls[0]?.basis).toBeNull()
  })

  it('Storno für den Kunden mit Gebühr: Basis des Kunden, Aufteilung mit dem Satz der Buchung', async () => {
    const d = deps()
    const res = await call(d, { requestId: REQ, action: 'cancel_customer', reason: REASON, charge: true, shownFeeCents: 68961 })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'cancelled_by_customer', feeBaseCents: 68961 })
    expect(d.calls[0]?.feeBaseCents).toBe(68961)
    expect(d.calls[0]?.split).toEqual(splitFee(68961, { tiers: [{ upToCents: null, bp: 1500 }], vatRate: 0.2 }))
  })

  it('Storno der Firma: Pauschale als Basis, Grund Pflicht, ohne `charge` keine Gebühr', async () => {
    const d = deps()
    expect((await call(d, { requestId: REQ, action: 'cancel_partner', reason: REASON, cancelReason: 'scope_impossible', charge: true, shownFeeCents: 6900 })).status).toBe(200)
    expect(d.calls[0]?.feeBaseCents).toBe(6900)
    expect(d.calls[0]?.cancelReason).toBe('scope_impossible')
    expect((await call(d, { requestId: REQ, action: 'cancel_partner', reason: REASON, cancelReason: 'other' })).status).toBe(200)
    expect(d.calls[1]?.feeBaseCents).toBe(0)
    expect(d.basisCalls).toBe(1)
  })

  it('Vorschau: Basis ohne Buchung; gezeigter Betrag weicht ab: 409 amount_changed, nichts gebucht', async () => {
    const d = deps()
    const res = await call(d, { requestId: REQ, action: 'cancel_customer', reason: REASON, charge: true, preview: true })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ preview: true, feeBaseCents: 68961 })
    expect(d.calls).toHaveLength(0)
    const p = await call(d, { requestId: REQ, action: 'cancel_partner', reason: REASON, cancelReason: 'other', charge: true, preview: true })
    expect(await p.json()).toEqual({ preview: true, feeBaseCents: 6900 })
    const e = await call(d, { requestId: REQ, action: 'cancel_customer', reason: REASON, charge: true, shownFeeCents: 34480 })
    expect(e.status).toBe(409)
    expect(await e.json()).toEqual({ error: 'amount_changed' })
    expect(d.calls).toHaveLength(0)
  })

  it('amount_mismatch und beim Neuladen eine andere Basis: 409 amount_changed, nichts gebucht', async () => {
    let n = 0
    const d = deps({
      basis: async () => basis({ customerFeeBaseCents: n++ === 0 ? 68961 : 34480 }),
      correct: async () => { throw new DbError('amount_mismatch') },
    })
    const res = await call(d, { requestId: REQ, action: 'cancel_customer', reason: REASON, charge: true, shownFeeCents: 68961 })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'amount_changed' })
    expect(d.calls).toHaveLength(0)
  })

  it('aal1: 403 mfa_required, nichts wird geladen', async () => {
    const d = deps({}, 'aal1')
    const res = await call(d)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'mfa_required' })
    expect(d.basisCalls + d.calls.length).toBe(0)
  })

  it('Satzcodes: einmal neu laden, danach neutral `retry` (409)', async () => {
    let n = 0
    const d = deps({
      correct: async (_u, _a, c) => {
        n++
        if (n === 1) throw new DbError('fee_basis_changed')
        d.calls.push(c)
        return 'cancelled_by_customer'
      },
    })
    expect((await call(d, { requestId: REQ, action: 'cancel_customer', reason: REASON, charge: true, shownFeeCents: 68961 })).status).toBe(200)
    expect(d.basisCalls).toBe(2)
    for (const code of ['fee_basis_changed', 'rate_mismatch', 'amount_mismatch']) {
      const e = deps({ correct: async () => { throw new DbError(code) } })
      const res = await call(e, { requestId: REQ, action: 'cancel_customer', reason: REASON, charge: true, shownFeeCents: 68961 })
      expect(res.status).toBe(409)
      expect(JSON.stringify(await res.json())).toBe('{"error":"retry"}')
      expect(e.basisCalls).toBe(2)
    }
  })

  it('Fehlercodes der Datenbank: Status; unbekannter Fehler 500 ohne Details', async () => {
    for (const [code, status] of [
      ['not_found', 404], ['not_admin', 403], ['invalid_transition', 409], ['reason_required', 422], ['no_fee_line', 409], ['retry', 409], ['terms_missing', 500],
    ] as const) {
      const d = deps({ correct: async () => { throw new DbError(code) } })
      const res = await call(d)
      expect(res.status, code).toBe(status)
      if (status !== 500) expect(await res.json()).toEqual({ error: code })
    }
    const d = deps({ correct: async () => { throw new Error('boom secret') } })
    const res = await call(d)
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('boom')
    expect(JSON.stringify(d.logs)).toContain('admin_correct_failed')
  })

  it('Eingabe: 401, 400 (Aktion, Begründung, Grund, charge, Felder), 405', async () => {
    expect((await call(deps(), { requestId: REQ, action: 'complete', reason: REASON }, '')).status).toBe(401)
    for (const bad of [
      { requestId: 'x', action: 'complete', reason: REASON },
      { requestId: REQ, action: 'bogus', reason: REASON },
      { requestId: REQ, action: 'complete' },
      { requestId: REQ, action: 'complete', reason: 'kurz' },
      { requestId: REQ, action: 'complete', reason: 'x'.repeat(301) },
      { requestId: REQ, action: 'cancel_partner', reason: REASON },
      { requestId: REQ, action: 'cancel_partner', reason: REASON, cancelReason: 'bogus' },
      { requestId: REQ, action: 'cancel_customer', reason: REASON, cancelReason: 'other' },
      { requestId: REQ, action: 'complete', reason: REASON, charge: true },
      { requestId: REQ, action: 'cancel_customer', reason: REASON, charge: 'ja' },
      { requestId: REQ, action: 'cancel_customer', reason: REASON, charge: true },
      { requestId: REQ, action: 'cancel_customer', reason: REASON, charge: true, shownFeeCents: -1 },
      { requestId: REQ, action: 'cancel_customer', reason: REASON, charge: true, shownFeeCents: 1.5 },
      { requestId: REQ, action: 'cancel_customer', reason: REASON, charge: true, shownFeeCents: 5, preview: true },
      { requestId: REQ, action: 'cancel_customer', reason: REASON, preview: true },
      { requestId: REQ, action: 'cancel_customer', reason: REASON, shownFeeCents: 5 },
      { requestId: REQ, action: 'complete', reason: REASON, amount: 5 },
    ]) {
      expect((await call(deps(), bad)).status, JSON.stringify(bad)).toBe(400)
    }
    expect((await handleAdminCorrect(new Request('https://x.test/c', { method: 'GET' }), deps())).status).toBe(405)
  })
})
