// admin-correct (S9h-3, Abnahme H1): die RPC bekommt immer alle 15 Parameter, nie `undefined` (PostgREST findet die Funktion sonst nicht;
// JSON lässt undefined-Schlüssel weg). Fehlende Werte gehen als null oder 0 hinaus.
import { describe, expect, it } from 'vitest'
import { adminCorrectDb } from '../../supabase/functions/_shared/admin/db.ts'
import type { CorrectCall } from '../../supabase/functions/_shared/admin/correct.ts'
import type { Db } from '../../supabase/functions/_shared/jobs/db.ts'

const REQ = '0b9f6e0e-6d52-4b7e-9d5c-3f0c2f9a1b11'
const ZERO = { totalCents: 0, feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
const basis = { status: 'completed', totalCents: 68961, customerFeeBaseCents: 68961, callOutCents: 6900, feeRate: 0.15, feeVatRate: 0.2, feeRateVersion: 1, feeVatRateVersion: 1 }
const base: Omit<CorrectCall, 'action' | 'cancelReason' | 'basis' | 'feeBaseCents' | 'split'> = { requestId: REQ, reason: 'Prüfung abgeschlossen' }

async function sent(c: CorrectCall): Promise<Record<string, unknown>> {
  let args: Record<string, unknown> = {}
  const db = { rpc: async (_n: string, a: Record<string, unknown>) => ((args = a), { data: 'completed', error: null }) } as unknown as Db
  await adminCorrectDb(db).correct('u1', 'aal2', c)
  return args
}

describe('adminCorrectDb.correct', () => {
  it('ohne Gebühr: alle 15 Schlüssel, kein undefined, Grund null', async () => {
    const a = await sent({ ...base, action: 'complete', cancelReason: null, basis: null, feeBaseCents: 0, split: ZERO })
    expect(Object.keys(a)).toHaveLength(15)
    expect(Object.values(a).some((v) => v === undefined)).toBe(false)
    expect(a['p_cancel_reason']).toBeNull()
    expect(a['p_actor']).toBe('u1')
    expect(a['p_aal']).toBe('aal2')
  })

  it('mit Gebühr: Satz und Versionen aus der Grundlage, Grund durchgereicht', async () => {
    const a = await sent({ ...base, action: 'cancel_partner', cancelReason: 'scope_impossible', basis, feeBaseCents: 6900, split: { totalCents: 6900, feeCents: 1035, feeNetCents: 863, feeVatCents: 172, payoutCents: 5865 } })
    expect(Object.keys(a)).toHaveLength(15)
    expect(a).toMatchObject({ p_cancel_reason: 'scope_impossible', p_fee_base: 6900, p_fee_rate: 0.15, p_fee_vat_rate: 0.2, p_fee: 1035, p_fee_rate_version: 1, p_fee_vat_rate_version: 1 })
  })
})
