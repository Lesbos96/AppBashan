// Datenbank-Anbindung von admin-correct (S9h-3). Läuft mit dem Secret Key (service_role); die SQL-Funktionen prüfen Rolle admin, aal2, Status,
// Basis und Satz selbst. `p_actor` stammt aus dem geprüften JWT, nie aus dem Body.
import type { FeeTier } from '../pricing/index.ts'
import { getUser, must, type Db } from '../jobs/db.ts'
import { DbError } from '../jobs/handlers.ts'
import type { CorrectDeps } from './correct.ts'

export const adminCorrectDb = (db: Db): Pick<CorrectDeps, 'getUser' | 'basis' | 'correct'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async basis(userId, aal, requestId) {
    const row = must(await db.rpc('admin_correct_basis', { p_actor: userId, p_aal: aal, p_request: requestId }))[0]
    if (!row) throw new DbError('not_found')
    return {
      status: row.request_status,
      totalCents: Number(row.total_cents),
      customerFeeBaseCents: Number(row.customer_fee_base_cents),
      callOutCents: Number(row.call_out_cents),
      feeTiers: row.fee_tiers as unknown as FeeTier[],
      feeVatRate: Number(row.fee_vat_rate),
      feeScheduleVersion: row.fee_schedule_version,
      feeVatRateVersion: row.fee_vat_rate_version,
    }
  },
  async correct(userId, aal, c) {
    return must(
      await db.rpc('admin_correct', {
        p_actor: userId,
        p_aal: aal,
        p_request: c.requestId,
        p_action: c.action,
        p_reason: c.reason,
        // null = kein Grund (nur cancel_partner braucht einen); die erzeugten Typen kennen keine optionalen Parameter in der Mitte
        p_cancel_reason: c.cancelReason as string,
        p_fee_base: c.feeBaseCents,
        // ohne Gebühr (feeBaseCents 0) ignoriert die Funktion Satz und Versionen
        p_fee_vat_rate: c.basis?.feeVatRate ?? 0,
        p_fee: c.split.feeCents,
        p_fee_net: c.split.feeNetCents,
        p_fee_vat: c.split.feeVatCents,
        p_payout: c.split.payoutCents,
        p_fee_schedule_version: c.basis?.feeScheduleVersion ?? 0,
        p_fee_vat_rate_version: c.basis?.feeVatRateVersion ?? 0,
      }),
    )
  },
})
