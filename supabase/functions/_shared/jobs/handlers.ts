// Edge-Function-Logik für Annahme (`accept`, Art A), Support-Kontakt (`admin-contact`) und Mailversand (`outbox-send`), S9c.
// Alle Datenzugriffe kommen über `deps` (Secret-Key-Client in index.ts, Fakes in den Unit-Tests). Das JWT prüft getUser; aal steht darin.
import { splitFee } from '../pricing/index.ts'
import { corsHeaders, json, readLimited } from '../http.ts'

/** Fehler der Datenbank-Funktionen: `code` ist die Meldung der Exception (z. B. `already_taken`). */
export class DbError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}

export type AuthUser = { id: string; aal: string }
export type Log = (entry: Record<string, unknown>) => void
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Fehlercode der Datenbank → HTTP-Status. Unbekannte Codes sind 500 ohne Details.
export const STATUS: Record<string, number> = {
  not_found: 404,
  partner_not_active: 403,
  not_responsible: 403,
  not_admin: 403,
  offer_required: 409,
  expired: 409,
  already_taken: 409,
  request_closed: 409,
  listing_declined: 409,
  revision_changed: 409,
  price_not_fixed: 409,
  payout_changed: 409,
  partner_job_limit: 409,
  fee_rate_changed: 409,
  offer_not_valid: 409,
  invalid_transition: 409,
  amount_changed: 409,
  retry: 409,
  reason_required: 422,
  mfa_required: 403,
  bad_request: 400,
  receipt_limit: 409,
  file_missing: 409,
  stale_claim: 409,
}

export async function authed(req: Request, deps: { getUser(jwt: string): Promise<AuthUser | null> }, origin: Record<string, string>, needAal2 = true) {
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const user = jwt ? await deps.getUser(jwt) : null
  if (!user) return { res: json(401, { error: 'unauthorized' }, origin) }
  if (needAal2 && user.aal !== 'aal2') return { res: json(403, { error: 'mfa_required' }, origin) }
  return { user }
}

export async function body(req: Request, max = 2048): Promise<Record<string, unknown> | null> {
  try {
    const v = JSON.parse(await readLimited(req, max))
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export const preflight = (req: Request, origin: Record<string, string>) =>
  req.method === 'OPTIONS' ? new Response(null, { status: 204, headers: origin }) : req.method !== 'POST' ? json(405, { error: 'method_not_allowed' }, origin) : null

// accept -------------------------------------------------------------------------------------------------------------------
export type AcceptBasis = { revisionId: string; totalCents: number; feeRate: number; feeVatRate: number; feeRateVersion: number; feeVatRateVersion: number }
export type AcceptCall = { listingId: string; revisionId: string; shownPayoutCents: number; basis: AcceptBasis; split: ReturnType<typeof splitFee> }
export type AcceptDeps = {
  allowedOrigins: readonly string[]
  getUser(jwt: string): Promise<AuthUser | null>
  basis(userId: string, listingId: string): Promise<AcceptBasis>
  accept(userId: string, call: AcceptCall): Promise<string>
  log: Log
}

/** Annahme eines Festpreis-Listings. Die Gebühr rechnet allein `splitFee`; ein veralteter Satz wird einmal neu geladen, dann 409. */
export async function handleAccept(req: Request, deps: AcceptDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin)
    if (a.res) return a.res
    const b = await body(req)
    const { listingId, revisionId, shownPayoutCents } = (b ?? {}) as Record<string, unknown>
    if (typeof listingId !== 'string' || !UUID.test(listingId) || typeof revisionId !== 'string' || !UUID.test(revisionId) || !Number.isSafeInteger(shownPayoutCents) || (shownPayoutCents as number) <= 0) {
      return json(400, { error: 'invalid_input' }, origin)
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const basis = await deps.basis(a.user.id, listingId)
      if (basis.revisionId !== revisionId) throw new DbError('revision_changed')
      const split = splitFee(basis.totalCents, { feeRate: basis.feeRate, vatRate: basis.feeVatRate })
      if (split.payoutCents !== shownPayoutCents) throw new DbError('payout_changed')
      try {
        const assignmentId = await deps.accept(a.user.id, { listingId, revisionId, shownPayoutCents: shownPayoutCents as number, basis, split })
        return json(200, { assignmentId }, origin)
      } catch (e) {
        // Satz oder Betrag wurde zwischen Lesen und Schreiben geändert: einmal mit frischen Werten, sonst 409.
        const code = e instanceof DbError ? e.code : ''
        if (code === 'rate_mismatch' || code === 'amount_mismatch') {
          if (attempt === 1) throw new DbError('fee_rate_changed')
          continue
        }
        throw e
      }
    }
    throw new DbError('fee_rate_changed')
  } catch (e) {
    const code = e instanceof DbError ? e.code : ''
    const status = STATUS[code]
    if (status) return json(status, { error: code }, origin)
    deps.log({ event: 'accept_failed', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    return json(500, { error: 'internal' }, origin)
  }
}

// offer-confirm --------------------------------------------------------------------------------------------------------------
export type OfferBasis = { amountCents: number; feeRate: number; feeVatRate: number; feeRateVersion: number; feeVatRateVersion: number }
export type OfferDeps = {
  allowedOrigins: readonly string[]
  getUser(jwt: string): Promise<AuthUser | null>
  basis(userId: string, offerId: string): Promise<OfferBasis>
  confirm(userId: string, offerId: string, basis: OfferBasis, split: ReturnType<typeof splitFee>): Promise<string>
  log: Log
}

// Codes, die eine Gebühr oder einen Satz verraten könnten, gehen nie an den Kunden: einmal neu laden, dann neutral `retry`.
const RETRY_CODES = new Set(['rate_mismatch', 'amount_mismatch', 'vat_rule_missing', 'setting_missing'])

/** Bestätigung eines Festangebots durch den Kunden (T5, Art A). Kein aal2: Kunden haben keine MFA; die Datenbank prüft den Eigentümer. */
export async function handleConfirmOffer(req: Request, deps: OfferDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin, false)
    if (a.res) return a.res
    const { offerId, shownAmountCents } = ((await body(req)) ?? {}) as Record<string, unknown>
    if (typeof offerId !== 'string' || !UUID.test(offerId) || !Number.isSafeInteger(shownAmountCents) || (shownAmountCents as number) <= 0) {
      return json(400, { error: 'invalid_input' }, origin)
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const basis = await deps.basis(a.user.id, offerId)
      if (basis.amountCents !== shownAmountCents) throw new DbError('amount_changed')
      const split = splitFee(basis.amountCents, { feeRate: basis.feeRate, vatRate: basis.feeVatRate })
      try {
        const result = await deps.confirm(a.user.id, offerId, basis, split)
        if (result === 'partner_not_active') return json(409, { error: 'partner_not_active' }, origin)
        return json(200, { status: 'confirmed' }, origin)
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
    // Auslastung der Firma geht nie an den Kunden: neutral „Angebot nicht verfügbar“, er wählt ein anderes
    if (code === 'partner_job_limit') return json(409, { error: 'offer_unavailable' }, origin)
    const status = RETRY_CODES.has(code) ? 409 : STATUS[code]
    if (status) return json(status, { error: RETRY_CODES.has(code) ? 'retry' : code }, origin)
    deps.log({ event: 'offer_confirm_failed', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    return json(500, { error: 'internal' }, origin)
  }
}

// admin-contact --------------------------------------------------------------------------------------------------------------
export type ContactDeps = {
  allowedOrigins: readonly string[]
  getUser(jwt: string): Promise<AuthUser | null>
  contact(adminId: string, requestId: string, reason: string): Promise<Record<string, unknown> | null>
  log: Log
}

/** Kontakt eines Auftrags für den Support: nur admin mit aal2, Begründung Pflicht, Audit-Eintrag schreibt die Datenbank-Funktion. */
export async function handleAdminContact(req: Request, deps: ContactDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin)
    if (a.res) return a.res
    const { requestId, reason } = ((await body(req)) ?? {}) as Record<string, unknown>
    if (typeof requestId !== 'string' || !UUID.test(requestId) || typeof reason !== 'string') return json(400, { error: 'invalid_input' }, origin)
    const row = await deps.contact(a.user.id, requestId, reason)
    return row ? json(200, row, origin) : json(404, { error: 'not_found' }, origin)
  } catch (e) {
    const code = e instanceof DbError ? e.code : ''
    const status = STATUS[code]
    if (status) return json(status, { error: code }, origin)
    deps.log({ event: 'admin_contact_failed', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    return json(500, { error: 'internal' }, origin)
  }
}

// outbox-send ----------------------------------------------------------------------------------------------------------------
export type OutboxRow = { id: number; kind: string; recipientKind: string; recipientId: string; partnerEmail: string | null }
export type Mail = { to: string; subject: string; text: string }
export type OutboxDeps = {
  secret: string
  claim(limit: number): Promise<OutboxRow[]>
  mark(id: number, ok: boolean, error: string | null): Promise<void>
  customerEmail(userId: string): Promise<string | null>
  send(mail: Mail): Promise<void>
  appUrl: string
  log: Log
}

// Texte ohne personenbezogene Angaben und ohne Gebühr; Details stehen in der App.
const TEXTS: Record<string, { subject: string; text: (url: string) => string }> = {
  listing_new: { subject: 'Neue Anfrage für dich', text: (u) => `Es gibt eine neue Anfrage in deinem Gebiet. Du findest sie im Partner-Bereich: ${u}` },
  request_accepted: { subject: 'Dein Auftrag wurde angenommen', text: (u) => `Ein Partner hat deine Anfrage angenommen. Alle Angaben findest du unter Aufträge: ${u}` },
  request_expired: { subject: 'Deine Anfrage ist abgelaufen', text: (u) => `Deine Anfrage wurde in der Frist nicht angenommen. Du kannst sie in der App neu senden: ${u}` },
  request_unmatched: { subject: 'Für deine Anfrage hat sich kein Partner gefunden', text: (u) => `Für Termin und Umfang hat sich leider kein Partner gefunden. Passe die Anfrage an oder sende sie neu: ${u}` },
  offer_new: { subject: 'Neues Angebot für deine Anfrage', text: (u) => `Ein Partner hat dir ein Festangebot gesendet. Du kannst es unter Aufträge ansehen und bestätigen: ${u}` },
  offer_withdrawn: { subject: 'Ein Angebot ist nicht mehr verfügbar', text: (u) => `Ein Angebot für deine Anfrage ist nicht mehr gültig. Unter Aufträge siehst du die übrigen Angebote: ${u}` },
  offer_confirmed: { subject: 'Dein Angebot wurde bestätigt', text: (u) => `Der Kunde hat dein Festangebot bestätigt. Alle Angaben findest du im Partner-Bereich: ${u}` },
  change_proposed: { subject: 'Dein Partner schlägt einen Nachtrag vor', text: (u) => `Dein Partner hat einen Mehraufwand mit Fotos vorgeschlagen. Du siehst den neuen Gesamtbetrag unter Aufträge und entscheidest dort: ${u}` },
  change_accepted: { subject: 'Dein Nachtrag wurde angenommen', text: (u) => `Der Kunde hat deinem Nachtrag zugestimmt. Alle Angaben findest du im Partner-Bereich: ${u}` },
  change_declined: { subject: 'Dein Nachtrag wurde abgelehnt', text: (u) => `Der Kunde hat den Nachtrag abgelehnt. Es gilt der gebuchte Umfang zum gebuchten Preis: ${u}` },
  change_expired: { subject: 'Dein Nachtrag ist nicht mehr gültig', text: (u) => `Der Nachtrag wurde nicht rechtzeitig entschieden oder der Auftrag ist beendet. Es gilt der gebuchte Umfang zum gebuchten Preis: ${u}` },
  change_withdrawn: { subject: 'Ein Nachtrag ist nicht mehr verfügbar', text: (u) => `Ein vorgeschlagener Nachtrag wurde zurückgezogen. Es gilt der gebuchte Umfang zum gebuchten Preis: ${u}` },
  completion_ask: { subject: 'Hat dein Auftrag stattgefunden?', text: (u) => `Der Termin ist vorbei. Bestätige unter Aufträge, dass alles stattgefunden hat, oder melde, dass es nicht stattgefunden hat. Ohne Meldung gilt der Auftrag 7 Tage nach dem Termin als durchgeführt: ${u}` },
  completion_auto: { subject: 'Dein Auftrag gilt als durchgeführt', text: (u) => `Zu diesem Auftrag ist keine Meldung eingegangen, deshalb gilt er als durchgeführt. Alle Angaben findest du unter Aufträge: ${u}` },
  photo_failed: { subject: 'Ein Foto deiner Anfrage ließ sich nicht verarbeiten', text: (u) => `Mindestens ein Foto konnte nicht verarbeitet werden. Ziehe die Anfrage zurück und sende sie mit neuen Fotos erneut: ${u}` },
}

// Zeitkonstanter Vergleich über SHA-256 beider Werte.
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const h = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  const [x, y] = await Promise.all([h(a), h(b)])
  let d = 0
  for (let i = 0; i < x.length; i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return d === 0
}

// Fehler werden auf feste Codes abgebildet: SMTP-Meldungen enthalten Empfängeradressen und gehören weder ins Log noch in die Outbox.
function safeCode(e: unknown): string {
  const msg = e instanceof Error ? e.message : ''
  if (msg === 'unknown_kind' || msg === 'no_recipient') return msg
  const rc = (e as { responseCode?: unknown } | null)?.responseCode
  if (typeof rc === 'number') return rc >= 500 ? 'smtp_rejected' : 'smtp_temp'
  return 'smtp_error'
}

/** Versand wartender Mails. Aufruf nur mit dem geheimen Header (pg_net aus outbox_dispatch); ein Fehler zählt als Versuch, nach 5 gilt `failed`. */
export async function handleOutbox(req: Request, deps: OutboxDeps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  const got = req.headers.get('x-outbox-secret') ?? ''
  if (!deps.secret || !(await sameSecret(got, deps.secret))) return json(401, { error: 'unauthorized' })
  let sent = 0
  let failed = 0
  // Markieren ist vom Versand getrennt: Ist die Mail raus und nur das Markieren scheitert, zählt das nicht als Versandfehler und es folgt keine
  // Gegenbuchung (die Zeile bleibt `sending`, nach der Lease holt sie der nächste Lauf erneut). Ein Fehler bei einer Zeile stoppt den Lauf nicht.
  const mark = async (id: number, ok: boolean, error: string | null) => {
    try {
      await deps.mark(id, ok, error)
    } catch {
      deps.log({ event: 'outbox_mark_failed', id, code: 'mark_failed' })
    }
  }
  for (const row of await deps.claim(25)) {
    try {
      const t = TEXTS[row.kind]
      const to = row.recipientKind === 'partner' ? row.partnerEmail : await deps.customerEmail(row.recipientId)
      if (!t || !to) throw new Error(!t ? 'unknown_kind' : 'no_recipient')
      await deps.send({ to, subject: t.subject, text: t.text(deps.appUrl) })
    } catch (e) {
      failed++
      const code = safeCode(e)
      deps.log({ event: 'outbox_failed', id: row.id, kind: row.kind, code })
      await mark(row.id, false, code)
      continue
    }
    sent++
    await mark(row.id, true, null)
  }
  return json(200, { sent, failed })
}
