// Edge-Function-Logik für das Storno durch den Kunden (S9h-1, Konzept 4.5 Art A, T12).
// Alle Datenzugriffe kommen über `deps` (Secret-Key-Client in index.ts, Fakes in den Unit-Tests).
// Die Stornogebühr (Betrag, den der Partner dem Kunden berechnen darf) steht in der Antwort; die Plattformgebühr verlässt die Funktion nie.
import { type FeeSplit, splitFee } from '../pricing/index.ts'
import { corsHeaders, json } from '../http.ts'
import { type AuthUser, DbError, type Log, STATUS, UUID, authed, body, preflight } from '../jobs/handlers.ts'

export type CancelBasis = {
  status: string
  totalCents: number
  feeBaseCents: number
  feeRate: number
  feeVatRate: number
  feeRateVersion: number
  feeVatRateVersion: number
}
export type CancelCall = { requestId: string; basis: CancelBasis; split: FeeSplit }
export type CancelDeps = {
  allowedOrigins: readonly string[]
  getUser(jwt: string): Promise<AuthUser | null>
  basis(userId: string, requestId: string): Promise<CancelBasis>
  cancel(userId: string, call: CancelCall): Promise<string>
  log: Log
}

// Codes, die eine Gebühr oder einen Satz verraten könnten, gehen nie an den Kunden: einmal neu laden, dann neutral `retry`.
const RETRY_CODES = new Set(['rate_mismatch', 'amount_mismatch', 'fee_basis_changed', 'booking_missing', 'vat_rule_missing', 'setting_missing'])
const ZERO: FeeSplit = { totalCents: 0, feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }

/** Storno des Kunden (T12). Kein aal2: Kunden haben keine MFA; die Datenbank prüft den Eigentümer, den Status und die Stufe. */
export async function handleCancelCustomer(req: Request, deps: CancelDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin, false)
    if (a.res) return a.res
    const b = (await body(req)) ?? {}
    const { requestId, shownFeeCents, preview } = b
    const isPreview = preview === true
    if (
      Object.keys(b).some((k) => !['requestId', 'shownFeeCents', 'preview'].includes(k)) || typeof requestId !== 'string' || !UUID.test(requestId) ||
      (preview !== undefined && !isPreview) ||
      (isPreview ? shownFeeCents !== undefined : !Number.isSafeInteger(shownFeeCents) || (shownFeeCents as number) < 0)
    ) {
      return json(400, { error: 'invalid_input' }, origin)
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const basis = await deps.basis(a.user.id, requestId)
      // Vorschau: der Betrag kommt aus derselben Stelle wie das Storno (keine zweite Stufenlogik im Client)
      if (isPreview) return json(200, { cancelFeeCents: basis.feeBaseCents }, origin)
      // Gebucht wird nur, was der Kunde gesehen hat: wechselt die Stufe, muss er neu bestätigen
      if (basis.feeBaseCents !== shownFeeCents) return json(409, { error: 'cancel_fee_changed', cancelFeeCents: basis.feeBaseCents }, origin)
      const split = basis.feeBaseCents > 0 ? splitFee(basis.feeBaseCents, { feeRate: basis.feeRate, vatRate: basis.feeVatRate }) : ZERO
      try {
        const status = await deps.cancel(a.user.id, { requestId, basis, split })
        return json(200, { status, cancelFeeCents: basis.feeBaseCents }, origin)
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
    const status = RETRY_CODES.has(code) ? 409 : code === 'under_review' ? 409 : STATUS[code]
    if (status) return json(status, { error: RETRY_CODES.has(code) ? 'retry' : code }, origin)
    deps.log({ event: 'cancel_customer_failed', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    return json(500, { error: 'internal' }, origin)
  }
}
