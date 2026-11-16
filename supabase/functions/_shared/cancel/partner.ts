// Edge-Function-Logik für das Storno durch den Partner (S9h-2, Konzept 4.5 Art A, T13, 10.3; s9i-7b: Vorschau und gezeigter Betrag).
// Alle Datenzugriffe kommen über `deps` (Secret-Key-Client in index.ts, Fakes in den Unit-Tests).
// Die Pauschale (call_out_fee_cents, höchstens der Gesamtpreis) fällt nur mit Belegfotos an; die Datenbank prüft Grund, Nachtrag und Belege.
// Ohne `preview` ist `shownCallOutCents` Pflicht: der Aufrufer bestätigt nur den vorher gezeigten Betrag, abweichend 409 `amount_changed` ohne Buchung.
import { type FeeSplit, type FeeTier, splitFee } from '../pricing/index.ts'
import { corsHeaders, json } from '../http.ts'
import { type AuthUser, DbError, type Log, STATUS, UUID, authed, body, preflight } from '../jobs/handlers.ts'

export type PartnerBasis = {
  status: string
  totalCents: number
  callOutCents: number
  feeTiers: FeeTier[]
  feeVatRate: number
  feeScheduleVersion: number
  feeVatRateVersion: number
}
export type PartnerCall = { requestId: string; reason: string; photoIds: string[]; basis: PartnerBasis; feeBaseCents: number; split: FeeSplit }
export type PartnerDeps = {
  allowedOrigins: readonly string[]
  getUser(jwt: string): Promise<AuthUser | null>
  basis(userId: string, aal: string, requestId: string, reason: string): Promise<PartnerBasis>
  cancel(userId: string, aal: string, call: PartnerCall): Promise<string>
  /** Der Status, wenn `userId` (Mitglied der Firma) diese Anfrage selbst abgesagt hat und Betrag, Grund und Belege zum ersten Aufruf passen, sonst null. */
  replay(userId: string, requestId: string, reason: string, photoIds: string[], shownCallOutCents: number): Promise<string | null>
  log: Log
}

const REASONS = new Set(['scope_impossible', 'unavailable', 'other'])
// Satz oder Betrag wechselten zwischen Grundlage und Buchung: einmal neu laden, dann neutral `retry`.
const RETRY_CODES = new Set(['rate_mismatch', 'amount_mismatch', 'fee_basis_changed', 'booking_missing', 'vat_rule_missing', 'setting_missing'])
const ZERO: FeeSplit = { totalCents: 0, feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }
const splitOf = (cents: number, b: PartnerBasis): FeeSplit => (cents > 0 ? splitFee(cents, { tiers: b.feeTiers, vatRate: b.feeVatRate }) : ZERO)

/**
 * Storno des Partners (T13); aal2 Pflicht. Mit `preview: true` kommen Pauschale und Auszahlung der Firma (nichts wird geschrieben, keine Belege, kein Betrag).
 * Sonst fällt die Pauschale mit Belegfotos an (nur bei scope_impossible nach abgelehntem oder abgelaufenem Nachtrag); Belege und gezeigter Betrag gehören zusammen.
 */
export async function handleCancelPartner(req: Request, deps: PartnerDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin)
    if (a.res) return a.res
    const b = (await body(req)) ?? {}
    const { requestId, reason, preview, shownCallOutCents } = b
    const photoIds = b['photoIds']
    const isPreview = preview === true
    const modeOk =
      preview === undefined || typeof preview === 'boolean'
        ? isPreview
          ? photoIds === undefined && shownCallOutCents === undefined
          : (photoIds === undefined || (Array.isArray(photoIds) && photoIds.length <= 8 && photoIds.every((p) => typeof p === 'string' && UUID.test(p)))) &&
            typeof shownCallOutCents === 'number' && Number.isSafeInteger(shownCallOutCents) && shownCallOutCents >= 0 &&
            ((photoIds ?? []) as unknown[]).length > 0 === shownCallOutCents > 0
        : false
    if (
      Object.keys(b).some((k) => !['requestId', 'reason', 'photoIds', 'preview', 'shownCallOutCents'].includes(k)) ||
      typeof requestId !== 'string' || !UUID.test(requestId) || typeof reason !== 'string' || !REASONS.has(reason) || !modeOk
    ) {
      return json(400, { error: 'invalid_input' }, origin)
    }
    if (isPreview) {
      const basis = await deps.basis(a.user.id, a.user.aal, requestId, reason)
      return json(200, { callOutCents: basis.callOutCents, payoutCents: splitOf(basis.callOutCents, basis).payoutCents }, origin)
    }
    const ids = (photoIds ?? []) as string[]
    const run = async (): Promise<Response> => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const basis = await deps.basis(a.user.id, a.user.aal, requestId, reason)
        const feeBaseCents = ids.length > 0 ? basis.callOutCents : 0
        if (feeBaseCents !== shownCallOutCents) throw new DbError('amount_changed')
        try {
          const status = await deps.cancel(a.user.id, a.user.aal, { requestId, reason, photoIds: ids, basis, feeBaseCents, split: splitOf(feeBaseCents, basis) })
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
    }
    try {
      return await run()
    } catch (e) {
      // Wiederholung nach verlorener Antwort (n12b): nach der eigenen Absage ist die Zuordnung beendet, das Tor meldet `not_found`. Hat diese Person die Anfrage selbst abgesagt
      // (Betrag, Grund und Belege wie beim ersten Aufruf), kommt dasselbe Ergebnis, sonst bleibt es beim Fehler. `invalid_transition` kann nach der eigenen Absage nicht kommen.
      if (!(e instanceof DbError) || e.code !== 'not_found') throw e
      const status = await deps.replay(a.user.id, requestId, reason, ids, shownCallOutCents as number)
      if (!status) throw e
      return json(200, { status, callOutCents: shownCallOutCents }, origin)
    }
  } catch (e) {
    const code = e instanceof DbError ? e.code : ''
    const status = RETRY_CODES.has(code) ? 409 : code === 'amount_changed' ? 409 : STATUS[code]
    if (status) return json(status, { error: RETRY_CODES.has(code) ? 'retry' : code }, origin)
    deps.log({ event: 'cancel_partner_failed', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    return json(500, { error: 'internal' }, origin)
  }
}
