// Edge-Function-Logik für das Storno durch den Partner (S9h-2, Konzept 4.5 Art A, T13, 10.3).
// Alle Datenzugriffe kommen über `deps` (Secret-Key-Client in index.ts, Fakes in den Unit-Tests).
// Die Pauschale (call_out_fee_cents, höchstens der Gesamtpreis) fällt nur mit Belegfotos an; die Datenbank prüft Grund, Nachtrag und Belege.
import { type FeeSplit, splitFee } from '../pricing/index.ts'
import { corsHeaders, json } from '../http.ts'
import { type AuthUser, DbError, type Log, STATUS, UUID, authed, body, preflight } from '../jobs/handlers.ts'

export type PartnerBasis = {
  status: string
  totalCents: number
  callOutCents: number
  feeRate: number
  feeVatRate: number
  feeRateVersion: number
  feeVatRateVersion: number
}
export type PartnerCall = { requestId: string; reason: string; photoIds: string[]; basis: PartnerBasis; feeBaseCents: number; split: FeeSplit }
export type PartnerDeps = {
  allowedOrigins: readonly string[]
  getUser(jwt: string): Promise<AuthUser | null>
  basis(userId: string, aal: string, requestId: string): Promise<PartnerBasis>
  cancel(userId: string, aal: string, call: PartnerCall): Promise<string>
  log: Log
}

const REASONS = new Set(['scope_impossible', 'unavailable', 'other'])
// Satz oder Betrag wechselten zwischen Grundlage und Buchung: einmal neu laden, dann neutral `retry`.
const RETRY_CODES = new Set(['rate_mismatch', 'amount_mismatch', 'fee_basis_changed', 'booking_missing', 'vat_rule_missing', 'setting_missing'])
const ZERO: FeeSplit = { totalCents: 0, feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }

/** Storno des Partners (T13); aal2 Pflicht. Mit Belegfotos fällt die Pauschale an (nur bei scope_impossible nach abgelehntem Nachtrag). */
export async function handleCancelPartner(req: Request, deps: PartnerDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin)
    if (a.res) return a.res
    const b = (await body(req)) ?? {}
    const { requestId, reason } = b
    const photoIds = b['photoIds'] ?? []
    if (
      Object.keys(b).some((k) => !['requestId', 'reason', 'photoIds'].includes(k)) || typeof requestId !== 'string' || !UUID.test(requestId) ||
      typeof reason !== 'string' || !REASONS.has(reason) ||
      !Array.isArray(photoIds) || photoIds.length > 8 || !photoIds.every((p) => typeof p === 'string' && UUID.test(p))
    ) {
      return json(400, { error: 'invalid_input' }, origin)
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const basis = await deps.basis(a.user.id, a.user.aal, requestId)
      const feeBaseCents = photoIds.length > 0 ? basis.callOutCents : 0
      const split = feeBaseCents > 0 ? splitFee(feeBaseCents, { feeRate: basis.feeRate, vatRate: basis.feeVatRate }) : ZERO
      try {
        const status = await deps.cancel(a.user.id, a.user.aal, { requestId, reason, photoIds: photoIds as string[], basis, feeBaseCents, split })
        return json(200, { status, callOutCents: feeBaseCents }, origin)
      } catch (e) {
        const code = e instanceof DbError ? e.code : ''
        if (RETRY_CODES.has(code)) {
          if (attempt === 1) throw new DbError('retry')
          continue
        }
        throw e
      }
    }
    throw new DbError('retry')
  } catch (e) {
    const code = e instanceof DbError ? e.code : ''
    const status = RETRY_CODES.has(code) ? 409 : STATUS[code]
    if (status) return json(status, { error: RETRY_CODES.has(code) ? 'retry' : code }, origin)
    deps.log({ event: 'cancel_partner_failed', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    return json(500, { error: 'internal' }, origin)
  }
}
