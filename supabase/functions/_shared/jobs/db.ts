// Datenbank-Anbindung der Functions accept, admin-contact und outbox-send (S9c). Läuft mit dem Secret Key (service_role);
// die SQL-Funktionen prüfen Akteur, Firma und Status selbst. Fehler der Funktionen kommen als DbError mit dem Code der Exception.
import type { FeeTier } from '../pricing/index.ts'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../database.types.ts'
import { rejectToken } from '../auth.ts'
import { type AcceptDeps, type AuthUser, type ContactDeps, DbError, type OfferDeps, type OutboxDeps } from './handlers.ts'

export type Db = SupabaseClient<Database>
// 40P01: die Datenbank hat diesen Aufruf als Opfer eines Deadlocks zurückgerollt, nichts ist geschrieben: neutral `retry` (409), die App kann wiederholen.
export const must = <T>(r: { data: T; error: { message: string; code?: string } | null }): NonNullable<T> => {
  if (r.error) throw new DbError(r.error.code === '40P01' ? 'retry' : r.error.message)
  if (r.data == null) throw new DbError('no_data')
  return r.data
}

/** Prüft das JWT bei Supabase Auth und liest aal aus der geprüften Nutzlast. */
export async function getUser(db: Db, jwt: string): Promise<AuthUser | null> {
  const { data, error } = await db.auth.getUser(jwt)
  if (error) return rejectToken(error)
  if (!data.user) return null
  try {
    const payload = JSON.parse(atob((jwt.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))) as { aal?: string }
    return { id: data.user.id, aal: String(payload.aal ?? '') }
  } catch {
    return null
  }
}

export const acceptDb = (db: Db): Pick<AcceptDeps, 'getUser' | 'basis' | 'accept' | 'replay'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async replay(userId, listingId, revisionId, shownPayoutCents) {
    const r = await db.rpc('partner_accept_replay', { p_actor: userId, p_listing: listingId, p_revision: revisionId, p_shown_payout: shownPayoutCents })
    if (r.error) throw new DbError(r.error.message)
    return r.data
  },
  async basis(userId, listingId) {
    const row = must(await db.rpc('partner_accept_basis', { p_actor: userId, p_listing: listingId }))[0]
    if (!row) throw new DbError('not_found')
    return {
      revisionId: row.revision_id,
      totalCents: Number(row.total_cents),
      feeTiers: row.fee_tiers as unknown as FeeTier[],
      feeVatRate: Number(row.fee_vat_rate),
      feeScheduleVersion: row.fee_schedule_version,
      feeVatRateVersion: row.fee_vat_rate_version,
    }
  },
  async accept(userId, c) {
    return must(
      await db.rpc('partner_accept', {
        p_actor: userId,
        p_listing: c.listingId,
        p_revision: c.revisionId,
        p_shown_payout: c.shownPayoutCents,
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

export const offerDb = (db: Db): Pick<OfferDeps, 'getUser' | 'basis' | 'confirm'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async basis(userId, offerId) {
    const row = must(await db.rpc('confirm_offer_basis', { p_actor: userId, p_offer: offerId }))[0]
    if (!row) throw new DbError('not_found')
    return {
      amountCents: Number(row.amount_cents),
      feeTiers: row.fee_tiers as unknown as FeeTier[],
      feeVatRate: Number(row.fee_vat_rate),
      feeScheduleVersion: row.fee_schedule_version,
      feeVatRateVersion: row.fee_vat_rate_version,
    }
  },
  async confirm(userId, offerId, b, split) {
    return must(
      await db.rpc('confirm_offer', {
        p_actor: userId,
        p_offer: offerId,
        p_shown_amount: b.amountCents,
        p_fee_vat_rate: b.feeVatRate,
        p_fee: split.feeCents,
        p_fee_net: split.feeNetCents,
        p_fee_vat: split.feeVatCents,
        p_payout: split.payoutCents,
        p_fee_schedule_version: b.feeScheduleVersion,
        p_fee_vat_rate_version: b.feeVatRateVersion,
      }),
    )
  },
})

export const contactDb =(db: Db): Pick<ContactDeps, 'getUser' | 'contact'> => ({
  getUser: (jwt) => getUser(db, jwt),
  async contact(adminId, requestId, reason) {
    const rows = must(await db.rpc('admin_contact', { p_actor: adminId, p_request: requestId, p_reason: reason }))
    return rows[0] ?? null
  },
})

export const outboxDb = (db: Db): Pick<OutboxDeps, 'claim' | 'mark' | 'customerEmail' | 'requestCustomerEmail' | 'completionDays'> => ({
  // geltender Wert von completion_days (Wiener Datum, höchste Version); fehlt er: setting_missing, nie ein Standardwert
  async completionDays() {
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })
    const rows = must(
      await db.from('platform_settings').select('value').eq('key', 'completion_days').lte('effective_from', today)
        .order('effective_from', { ascending: false }).order('version', { ascending: false }).limit(1),
    )
    const v = Number(rows[0]?.value)
    if (!Number.isInteger(v) || v < 1) throw new DbError('setting_missing')
    return v
  },
  async claim(limit) {
    const rows = must(await db.rpc('outbox_claim', { p_limit: limit }))
    return rows.map((r) => ({ id: Number(r.id), kind: r.kind, recipientKind: r.recipient_kind, recipientId: r.recipient_id, requestId: r.request_id, partnerEmail: r.partner_email }))
  },
  async mark(id, ok, error) {
    const { error: e } = await db.rpc('outbox_mark', { p_id: id, p_ok: ok, p_error: error as never })
    if (e) throw new DbError(e.message)
  },
  async customerEmail(userId) {
    const { data } = await db.auth.admin.getUserById(userId)
    return data.user?.email ?? null
  },
  async requestCustomerEmail(requestId) {
    const rows = must(await db.from('service_requests').select('customer_id').eq('id', requestId).limit(1))
    const customer = rows[0]?.customer_id
    if (!customer) return null
    const { data } = await db.auth.admin.getUserById(customer)
    return data.user?.email ?? null
  },
})
