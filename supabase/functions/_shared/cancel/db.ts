// Datenbank-Anbindung von cancel-customer (S9h-1). Läuft mit dem Secret Key (service_role); die SQL-Funktionen prüfen Kunde, Status, Stufe und
// Satz selbst. `p_actor` stammt aus dem geprüften JWT, nie aus dem Body.
import type { FeeTier } from '../pricing/index.ts'
import { getUser, must, type Db } from '../jobs/db.ts'
import { DbError } from '../jobs/handlers.ts'
import type { CancelDeps } from './handlers.ts'
import type { PartnerDeps } from './partner.ts'

export const cancelPartnerDb = (db: Db): Pick<PartnerDeps, 'getUser' | 'basis' | 'cancel' | 'replay'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async replay(userId, requestId, reason, photoIds, shown) {
    const r = await db.rpc('cancel_replay', { p_actor: userId, p_request: requestId, p_action: 'cancel_by_partner', p_shown: shown, p_reason: reason, p_photos: photoIds })
    if (r.error) throw new DbError(r.error.message)
    return r.data
  },
  async basis(userId, aal, requestId, reason) {
    const row = must(await db.rpc('cancel_by_partner_basis', { p_actor: userId, p_aal: aal, p_request: requestId, p_reason: reason }))[0]
    if (!row) throw new DbError('not_found')
    return {
      status: row.request_status,
      totalCents: Number(row.total_cents),
      callOutCents: Number(row.call_out_cents),
      feeTiers: row.fee_tiers as unknown as FeeTier[],
      feeVatRate: Number(row.fee_vat_rate),
      feeScheduleVersion: row.fee_schedule_version,
      feeVatRateVersion: row.fee_vat_rate_version,
    }
  },
  async cancel(userId, aal, c) {
    return must(
      await db.rpc('cancel_by_partner', {
        p_actor: userId,
        p_aal: aal,
        p_request: c.requestId,
        p_reason: c.reason,
        p_photos: c.photoIds,
        p_fee_base: c.feeBaseCents,
        p_fee_vat_rate: c.basis.feeVatRate,
        p_fee: c.split.feeCents,
        p_fee_net: c.split.feeNetCents,
        p_fee_vat: c.split.feeVatCents,
        p_payout: c.split.payoutCents,
        p_fee_schedule_version: c.basis.feeScheduleVersion,
        p_fee_vat_rate_version: c.basis.feeVatRateVersion,
      }),
    )
  },
})

export const cancelDb = (db: Db): Pick<CancelDeps, 'getUser' | 'basis' | 'cancel' | 'replay'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async replay(userId, requestId, shown) {
    // Grund und Belege gelten nur beim Storno der Firma; die Funktion ignoriert sie beim Kunden
    const r = await db.rpc('cancel_replay', { p_actor: userId, p_request: requestId, p_action: 'cancel_by_customer', p_shown: shown, p_reason: '', p_photos: [] })
    if (r.error) throw new DbError(r.error.message)
    return r.data
  },
  async basis(userId, requestId) {
    const row = must(await db.rpc('cancel_by_customer_basis', { p_actor: userId, p_request: requestId }))[0]
    if (!row) throw new DbError('not_found')
    return {
      status: row.request_status,
      totalCents: Number(row.total_cents),
      feeBaseCents: Number(row.fee_base_cents),
      feeTiers: row.fee_tiers as unknown as FeeTier[],
      feeVatRate: Number(row.fee_vat_rate),
      feeScheduleVersion: row.fee_schedule_version,
      feeVatRateVersion: row.fee_vat_rate_version,
    }
  },
  async cancel(userId, c) {
    return must(
      await db.rpc('cancel_by_customer', {
        p_actor: userId,
        p_request: c.requestId,
        p_fee_base: c.shownFeeCents,
        p_fee_vat_rate: c.basis.feeVatRate,
        p_fee: c.split.feeCents,
        p_fee_net: c.split.feeNetCents,
        p_fee_vat: c.split.feeVatCents,
        p_payout: c.split.payoutCents,
        p_fee_schedule_version: c.basis.feeScheduleVersion,
        p_fee_vat_rate_version: c.basis.feeVatRateVersion,
      }),
    )
  },
})
