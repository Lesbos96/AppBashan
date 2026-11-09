// Edge-Function-Logik für admin-correct (S9h-3, Konzept 4.4 T14, 4.5 Art A): Statuskorrektur und Pauschale negieren durch admin (aal2).
// Alle Datenzugriffe kommen über `deps` (Secret-Key-Client in index.ts, Fakes in den Unit-Tests). Die Datenbank prüft die Rolle admin,
// Status, Basis und Satz; die Aufteilung einer Gebührenzeile (nur bei einem Storno mit `charge`) rechnet splitFee mit dem Satz der Buchung.
import { type FeeSplit, splitFee } from '../pricing/index.ts'
import { corsHeaders, json } from '../http.ts'
import { type AuthUser, DbError, type Log, STATUS, UUID, authed, body, preflight } from '../jobs/handlers.ts'

export type CorrectBasis = {
  status: string
  totalCents: number
  customerFeeBaseCents: number
  callOutCents: number
  feeRate: number
  feeVatRate: number
  feeRateVersion: number
  feeVatRateVersion: number
}
export type CorrectCall = {
  requestId: string
  action: string
  reason: string
  cancelReason: string | null
  feeBaseCents: number
  split: FeeSplit
  basis: CorrectBasis | null
}
export type CorrectDeps = {
  allowedOrigins: readonly string[]
  getUser(jwt: string): Promise<AuthUser | null>
  basis(userId: string, aal: string, requestId: string): Promise<CorrectBasis>
  correct(userId: string, aal: string, call: CorrectCall): Promise<string>
  log: Log
}

const ACTIONS = new Set(['complete', 'cancel_customer', 'cancel_partner', 'negate_fee', 'dismiss_report'])
const CANCELS = new Set(['cancel_customer', 'cancel_partner'])
const REASONS = new Set(['scope_impossible', 'unavailable', 'other'])
// Satz oder Betrag wechselten zwischen Grundlage und Buchung: einmal neu laden, dann neutral `retry`.
const RETRY_CODES = new Set(['rate_mismatch', 'amount_mismatch', 'fee_basis_changed', 'booking_missing', 'vat_rule_missing', 'setting_missing'])
const ZERO: FeeSplit = { totalCents: 0, feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }

/**
 * T14 für admin (aal2). Eine Gebühr fällt nur mit `charge` bei `cancel_customer` (Stornobasis) oder `cancel_partner` (Pauschale) an.
 * Wie bei cancel-customer: erst `preview: true` (liefert `feeBaseCents`, bucht nichts), dann `shownFeeCents` mit dem gezeigten Betrag;
 * weicht die neu berechnete Basis ab, folgt 409 `amount_changed`, nie eine stille Buchung eines anderen Betrags.
 */
export async function handleAdminCorrect(req: Request, deps: CorrectDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin)
    if (a.res) return a.res
    const b = (await body(req)) ?? {}
    const { requestId, action, reason, cancelReason = null, charge = false, preview = false, shownFeeCents = null } = b
    const text = typeof reason === 'string' ? reason.trim() : ''
    if (
      Object.keys(b).some((k) => !['requestId', 'action', 'reason', 'cancelReason', 'charge', 'preview', 'shownFeeCents'].includes(k)) ||
      typeof requestId !== 'string' || !UUID.test(requestId) ||
      typeof action !== 'string' || !ACTIONS.has(action) ||
      text.length < 10 || text.length > 300 ||
      typeof charge !== 'boolean' || (charge && !CANCELS.has(action)) ||
      typeof preview !== 'boolean' || (preview && !charge) ||
      // mit Gebühr ist der gezeigte Betrag Pflicht (außer in der Vorschau); ohne Gebühr gibt es keinen
      (charge && !preview ? !Number.isSafeInteger(shownFeeCents) || (shownFeeCents as number) < 0 : shownFeeCents !== null) ||
      (action === 'cancel_partner' ? typeof cancelReason !== 'string' || !REASONS.has(cancelReason) : cancelReason !== null)
    ) {
      return json(400, { error: 'invalid_input' }, origin)
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const basis = charge ? await deps.basis(a.user.id, a.user.aal, requestId) : null
      const feeBaseCents = basis ? (action === 'cancel_customer' ? basis.customerFeeBaseCents : basis.callOutCents) : 0
      if (preview) return json(200, { preview: true, feeBaseCents }, origin)
      if (charge && feeBaseCents !== shownFeeCents) throw new DbError('amount_changed')
      const split = basis && feeBaseCents > 0 ? splitFee(feeBaseCents, { feeRate: basis.feeRate, vatRate: basis.feeVatRate }) : ZERO
      try {
        const status = await deps.correct(a.user.id, a.user.aal, { requestId, action, reason: text, cancelReason: cancelReason as string | null, feeBaseCents, split, basis })
        return json(200, { status, feeBaseCents }, origin)
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
    deps.log({ event: 'admin_correct_failed', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    return json(500, { error: 'internal' }, origin)
  }
}
