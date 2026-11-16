// Datenbank-Anbindung von change-propose und change-decide (S9f). Läuft mit dem Secret Key (service_role); die SQL-Funktionen prüfen Akteur,
// Firma, Status und Satz selbst. `p_actor` und aal stammen aus dem geprüften JWT, nie aus dem Body.
import type { FeeTier } from '../pricing/index.ts'
import { getUser, must, type Db } from '../jobs/db.ts'
import { DbError } from '../jobs/handlers.ts'
import type { DecideDeps, ProposeDeps } from './handlers.ts'

export const proposeDb = (db: Db): Pick<ProposeDeps, 'getUser' | 'loadPricing' | 'basis' | 'propose' | 'replay'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async replay(userId, requestId, changes, shownTotalCents, photoIds) {
    const r = await db.rpc('propose_change_replay', { p_actor: userId, p_request: requestId, p_changes: changes as never, p_shown_total: shownTotalCents, p_photos: photoIds })
    if (r.error) throw new DbError(r.error.message)
    return r.data
  },
  async loadPricing(version) {
    // Hash der gebuchten Version vor dem Rechnen prüfen: bei Abweichung Abbruch (500), nichts wird gespeichert.
    const verified = await db.rpc('verify_price_version', { p_version: version })
    if (verified.error) throw new DbError(verified.error.message)
    return { rows: must(await db.from('price_config').select('key, value, unit').eq('version', version)) }
  },
  async basis(userId, aal, requestId) {
    const row = must(await db.rpc('propose_change_basis', { p_actor: userId, p_aal: aal, p_request: requestId }))[0]
    if (!row) throw new DbError('not_found')
    return {
      revisionId: row.revision_id,
      source: row.source,
      inputs: row.inputs,
      priceVersion: row.price_version,
      totalCents: Number(row.total_cents),
      service: row.service,
      route: row.route,
    }
  },
  async propose(userId, aal, c) {
    return must(
      await db.rpc('propose_change', {
        p_actor: userId,
        p_aal: aal,
        p_request: c.requestId,
        p_base: c.baseRevisionId,
        p_inputs: c.inputs as never,
        p_total: c.totalCents,
        p_photos: c.photoIds,
      }),
    )
  },
})

export const decideDb = (db: Db): Pick<DecideDeps, 'getUser' | 'basis' | 'decide'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async basis(userId, revisionId) {
    const row = must(await db.rpc('decide_change_basis', { p_actor: userId, p_revision: revisionId }))[0]
    if (!row) throw new DbError('not_found')
    return {
      status: row.status,
      totalCents: Number(row.total_cents),
      feeTiers: row.fee_tiers as unknown as FeeTier[],
      feeVatRate: Number(row.fee_vat_rate),
      feeScheduleVersion: row.fee_schedule_version,
      feeVatRateVersion: row.fee_vat_rate_version,
      priorTotal: Number(row.prior_total),
      priorFee: Number(row.prior_fee),
      priorNet: Number(row.prior_net),
      priorVat: Number(row.prior_vat),
      priorPayout: Number(row.prior_payout),
    }
  },
  async decide(userId, c) {
    return must(
      await db.rpc('decide_change', {
        p_actor: userId,
        p_revision: c.revisionId,
        p_accept: c.accept,
        p_shown_total: c.shownTotalCents,
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
