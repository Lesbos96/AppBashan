// Edge-Function-Logik für den Nachtrag (S9f, Konzept 4.5 Art A): change-propose (Partner, aal2) und change-decide (Kunde).
// Alle Datenzugriffe kommen über `deps` (Secret-Key-Client in index.ts, Fakes in den Unit-Tests).
// Rechnen: gebuchter Preis + Modul(neue Eingaben) − Modul(alte Eingaben), beide mit der gebuchten Preisversion (Konzept 5.6). Kein Betragsfeld.
import {
  ChangeError,
  type FeeSplit,
  type FeeTier,
  InputError,
  type OfferResult,
  type PriceResult,
  type RouteFacts,
  changeTotal,
  computeAssembly,
  computeClearance,
  computeTransport,
  parseAssembly,
  parseClearanceInput,
  parseTransportInput,
  splitChange,
} from '../pricing/index.ts'
import { corsHeaders, json } from '../http.ts'
import { type AuthUser, DbError, type Log, STATUS, UUID, authed, body, preflight } from '../jobs/handlers.ts'
import { type PriceConfigRow, TariffError, buildTariffs } from '../quote/tariffs.ts'

const CHANGE_STATUS: Record<string, number> = {
  ...STATUS,
  change_not_allowed: 409,
  change_open: 409,
  change_not_increasing: 409,
  change_not_valid: 409,
  not_fixed_price: 409,
  receipt_required: 422,
  route_locked: 422,
  invalid_input: 422,
}

// propose ------------------------------------------------------------------------------------------------------------------
export type ProposeBasis = { revisionId: string; source: string; inputs: unknown; priceVersion: number; totalCents: number; service: string; route: unknown }
export type ProposeCall = { requestId: string; baseRevisionId: string; inputs: unknown; totalCents: number; photoIds: string[] }
export type ProposeDeps = {
  allowedOrigins: readonly string[]
  getUser(jwt: string): Promise<AuthUser | null>
  loadPricing(version: number): Promise<{ rows: readonly PriceConfigRow[] }>
  basis(userId: string, aal: string, requestId: string): Promise<ProposeBasis>
  propose(userId: string, aal: string, call: ProposeCall): Promise<string>
  log: Log
}

// Adresse und Route stehen nicht in den Eingaben; ein Nachtrag ändert sie nie (Konzept 5.6).
const ROUTE_KEYS = new Set(['from', 'to', 'route', 'returnTrip', 'region', 'address', 'postcode', 'point'])

function routeFacts(route: unknown): RouteFacts | null {
  if (!route || typeof route !== 'object') return null
  const r = route as Record<string, unknown>
  if (typeof r['region'] !== 'string' || typeof r['outsideKm'] !== 'number' || typeof r['driveHours'] !== 'number') return null
  return { region: r['region'] as RouteFacts['region'], outsideKm: r['outsideKm'], driveHours: r['driveHours'] }
}

type Priced = { inputs: unknown; price: PriceResult | OfferResult }
function priced(service: string, raw: unknown, tariffs: ReturnType<typeof buildTariffs>, route: RouteFacts | null): Priced {
  switch (service) {
    case 'transport':
    case 'move': {
      const inputs = parseTransportInput(raw)
      return { inputs, price: computeTransport(tariffs, inputs, route) }
    }
    case 'clearance': {
      const inputs = parseClearanceInput(raw)
      return { inputs, price: computeClearance(tariffs, inputs) }
    }
    case 'assembly': {
      const inputs = parseAssembly(raw)
      return { inputs, price: computeAssembly(tariffs, inputs) }
    }
    default:
      throw new DbError('change_not_allowed')
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/**
 * Nachtrag vorschlagen (N1). Der Partner nennt nur geänderte Preisfelder und Belegfotos; den Betrag rechnet allein das Preismodul.
 * `preview: true` rechnet und prüft das Tor, legt aber nichts an (keine Mail, kein offener Platz, keine Belege); Belege und gezeigter Betrag sind dann verboten.
 * Ohne Vorschau ist `shownTotalCents` Pflicht: der Aufrufer bestätigt nur den vorher gezeigten Betrag, abweichend 409 `amount_changed` ohne Anlegen.
 */
export async function handleProposeChange(req: Request, deps: ProposeDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin)
    if (a.res) return a.res
    const b = (await body(req, 8192)) ?? {}
    const { requestId, changes, photoIds, preview, shownTotalCents } = b
    const extra = Object.keys(b).some((k) => !['requestId', 'changes', 'photoIds', 'preview', 'shownTotalCents'].includes(k))
    const isPreview = preview === true
    const modeOk =
      preview === undefined || typeof preview === 'boolean'
        ? isPreview
          ? photoIds === undefined && shownTotalCents === undefined
          : Array.isArray(photoIds) && photoIds.length >= 1 && photoIds.length <= 8 && photoIds.every((p) => typeof p === 'string' && UUID.test(p)) &&
            Number.isSafeInteger(shownTotalCents) && (shownTotalCents as number) > 0
        : false
    if (extra || typeof requestId !== 'string' || !UUID.test(requestId) || !isRecord(changes) || !modeOk) {
      return json(400, { error: 'invalid_input' }, origin)
    }
    if (Object.keys(changes).some((k) => ROUTE_KEYS.has(k))) return json(422, { error: 'route_locked' }, origin)
    const basis = await deps.basis(a.user.id, a.user.aal, requestId)
    if (basis.source === 'partner_offer') throw new DbError('change_not_allowed')
    if (!isRecord(basis.inputs)) throw new DbError('invalid_input')
    const known = new Set(Object.keys(basis.inputs))
    if (Object.keys(changes).some((k) => !known.has(k) || k === 'service')) return json(400, { error: 'invalid_input' }, origin)
    // Beide Rechnungen mit der gebuchten Version; unvollständiger Tarif: Abbruch (kein Standardwert).
    const tariffs = buildTariffs((await deps.loadPricing(basis.priceVersion)).rows)
    const route = routeFacts(basis.route)
    const before = priced(basis.service, basis.inputs, tariffs, route)
    const after = priced(basis.service, { ...basis.inputs, ...changes }, tariffs, route)
    const totalCents = changeTotal(basis.totalCents, after.price, before.price)
    if (isPreview) return json(200, { totalCents, baseCents: basis.totalCents }, origin)
    if (totalCents !== shownTotalCents) throw new DbError('amount_changed')
    const revisionId = await deps.propose(a.user.id, a.user.aal, { requestId, baseRevisionId: basis.revisionId, inputs: after.inputs, totalCents, photoIds: photoIds as string[] })
    return json(200, { revisionId, totalCents }, origin)
  } catch (e) {
    if (e instanceof InputError) return json(422, { error: 'invalid_input' }, origin)
    if (e instanceof TariffError) {
      deps.log({ event: 'change_tariff_incomplete', message: e.message.slice(0, 200) })
      return json(500, { error: 'tariff_incomplete' }, origin)
    }
    const code = e instanceof DbError || e instanceof ChangeError ? e.code : ''
    const status = CHANGE_STATUS[code]
    if (status) return json(status, { error: code }, origin)
    deps.log({ event: 'change_propose_failed', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    return json(500, { error: 'internal' }, origin)
  }
}

// decide -------------------------------------------------------------------------------------------------------------------
export type DecideBasis = {
  status: string
  totalCents: number
  feeTiers: FeeTier[]
  feeVatRate: number
  feeScheduleVersion: number
  feeVatRateVersion: number
  priorTotal: number
  priorFee: number
  priorNet: number
  priorVat: number
  priorPayout: number
}
export type DecideCall = { revisionId: string; accept: boolean; shownTotalCents: number; basis: DecideBasis; split: FeeSplit }
export type DecideDeps = {
  allowedOrigins: readonly string[]
  getUser(jwt: string): Promise<AuthUser | null>
  basis(userId: string, revisionId: string): Promise<DecideBasis>
  decide(userId: string, call: DecideCall): Promise<string>
  log: Log
}

// Codes, die eine Gebühr oder einen Satz verraten könnten, gehen nie an den Kunden: einmal neu laden, dann neutral `retry`.
const RETRY_CODES = new Set(['rate_mismatch', 'amount_mismatch', 'fee_basis_changed', 'shown_total_mismatch', 'vat_rule_missing', 'setting_missing'])
const ZERO: FeeSplit = { totalCents: 0, feeCents: 0, feeNetCents: 0, feeVatCents: 0, payoutCents: 0 }

/** Entscheidung des Kunden über einen Nachtrag (N2). Kein aal2: Kunden haben keine MFA; die Datenbank prüft den Eigentümer. */
export async function handleDecideChange(req: Request, deps: DecideDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin, false)
    if (a.res) return a.res
    const b = (await body(req)) ?? {}
    const { revisionId, decision, shownTotalCents } = b
    const accept = decision === 'accept'
    const extra = Object.keys(b).some((k) => !['revisionId', 'decision', 'shownTotalCents'].includes(k))
    if (
      extra || typeof revisionId !== 'string' || !UUID.test(revisionId) || (decision !== 'accept' && decision !== 'decline') ||
      (accept && (!Number.isSafeInteger(shownTotalCents) || (shownTotalCents as number) <= 0))
    ) {
      return json(400, { error: 'invalid_input' }, origin)
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const basis = await deps.basis(a.user.id, revisionId)
      // Wiederholung derselben Entscheidung (Doppelklick): schon erledigt, nichts mehr zu tun
      if ((basis.status === 'accepted' && accept) || (basis.status === 'declined' && !accept)) return json(200, { status: basis.status }, origin)
      if (basis.status !== 'proposed') throw new DbError(basis.status === 'expired' ? 'change_not_valid' : 'invalid_transition')
      if (accept && basis.totalCents !== shownTotalCents) throw new DbError('amount_changed')
      const prior: FeeSplit = { totalCents: basis.priorTotal, feeCents: basis.priorFee, feeNetCents: basis.priorNet, feeVatCents: basis.priorVat, payoutCents: basis.priorPayout }
      const split = accept ? splitChange(basis.totalCents, { tiers: basis.feeTiers, vatRate: basis.feeVatRate }, prior) : ZERO
      try {
        const result = await deps.decide(a.user.id, { revisionId, accept, shownTotalCents: accept ? (shownTotalCents as number) : 0, basis, split })
        if (result === 'partner_not_active') return json(409, { error: 'partner_not_active' }, origin)
        return json(200, { status: result }, origin)
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
    const status = RETRY_CODES.has(code) ? 409 : CHANGE_STATUS[code]
    if (status) return json(status, { error: RETRY_CODES.has(code) ? 'retry' : code }, origin)
    deps.log({ event: 'change_decide_failed', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    return json(500, { error: 'internal' }, origin)
  }
}
