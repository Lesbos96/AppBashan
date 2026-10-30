// HTTP-Handler der Edge Function `quote` (S8a): der einzige Schreiber für Anfragen und Mietanfragen.
// Alle Abhängigkeiten werden injiziert, damit Vitest ihn ohne Netz prüft (die Integrationstests nutzen die echte DB).
// Der Client liefert nur die Kundenwahl; Tarife, Strecke, Preis, Gebühr und Status entstehen hier. Logs enthalten
// nur Modus, Status, Latenz und Fehlercode: keine Nutzer-ID, keine Adressen, keine Koordinaten.
import {
  InputError,
  type FeeSplit,
  type OfferResult,
  type PriceResult,
  type RentalOffer,
  computeAssembly,
  computeClearance,
  computeRental,
  computeTransport,
  splitFee,
} from '../pricing/index.ts'
import { clientIp, corsHeaders, json, readLimited } from '../http.ts'
import { computeRouteFacts, type RouteDeps } from '../route/compute.ts'
import { HttpError, type RouteResult } from '../route/facts.ts'
import { LIMITS as ROUTE_LIMITS, type RateCheck } from '../route/handler.ts'
import { type Place, type QuoteCall, parseQuoteCall } from './parse.ts'
import { buildSnapshot, type Snapshot } from './snapshot.ts'
import { viennaToday } from './time.ts'
import { type PriceConfigRow, TariffError, buildTariffs } from './tariffs.ts'

const MAX_BODY_BYTES = 16 * 1024
const MINUTE = 60
const DAY = 86400
/** Aufrufe je Nutzer (angemeldet, aber nicht vertrauenswürdig): verhindert Massen-Anfragen und Rechenlast. */
const JWT_FORM = /^[\w-]+\.[\w-]+\.[\w-]+$/
const USER_LIMITS = { minute: 6, day: 30 } as const

export type RequestStatus = 'requested' | 'inspection_requested'
export type FeeRow = FeeSplit & { feeRate: number; vatRate: number }

export type SaveRequest = {
  customerId: string
  requestId: string | null
  clientRef: string | null
  service: 'transport' | 'move' | 'clearance' | 'assembly'
  status: RequestStatus
  inputs: unknown
  snapshot: Snapshot
  priceVersion: number
  estimateCents: number | null
  needsQuote: boolean
  from: Place | null
  to: Place | null
  route: RouteResult | null
  preferredDate: string | null
  timeWindow: string | null
  description: string | null
  volumeM3: number | null
  fee: FeeRow | null
}

export type SaveBooking = {
  customerId: string
  clientRef: string
  offerId: string
  pickupAt: string
  returnAt: string
  km: number
  cover: boolean
  extraDriver: boolean
  oneWay: boolean
  snapshot: Snapshot
  priceVersion: number
  totalCents: number
  depositCents: number
  payeeId: string | null
  fee: FeeRow
}

/** Angebot aus `rental_offers` (nur freigegebene), Geldwerte in Cent. */
export type OfferRow = RentalOffer & { id: string; providerId: string | null; providerName: string; name: string; station: string; sizeM3: number; excessCents: number; coverExcessCents: number }

export type Saved = { id: string; status: string; needsQuote: boolean; created: boolean }
/** Antwort an den Kunden: nur Kundenfelder, nie Gebühr oder Partneranteil. */
export type QuoteResponse = { id: string; status: string; needsQuote: boolean; priceVersion: number; snapshot: Snapshot }

export type QuoteDeps = {
  allowedOrigins: string[]
  /** HMAC-SHA256 mit Server-Secret, hex. */
  hmac(text: string): Promise<string>
  takeTokens(checks: RateCheck[]): Promise<boolean>
  /** Nutzer-ID zum JWT, `null` bei ungültigem Token. */
  getUserId(jwt: string): Promise<string | null>
  /** Aktuelle Version über die View `current_price_version` und deren Zeilen aus `price_config`. */
  loadPricing(): Promise<{ version: number; rows: PriceConfigRow[] }>
  /** Aktuelle Sätze über die View `current_fee_rates` (fehlend = null). */
  loadFeeRates(): Promise<{ feeRate: unknown; vatRate: unknown }>
  loadOffer(id: string): Promise<OfferRow | null>
  /** Bereits gespeicherte Anfrage zu dieser `clientRef` (idempotenter Wiederholungsaufruf). */
  findExisting(customerId: string, clientRef: string, kind: 'request' | 'rental'): Promise<QuoteResponse | null>
  saveRequest(args: SaveRequest): Promise<Saved>
  saveBooking(args: SaveBooking): Promise<Saved>
  route: RouteDeps
  /** Aktuelle Zeit in ms (Tests setzen sie fest). */
  now(): number
  log(entry: { mode: string; status: number; ms: number; code?: string }): void
}

function feeRow(totalCents: number, rates: { feeRate: unknown; vatRate: unknown }): FeeRow {
  const { feeRate, vatRate } = rates
  if (typeof feeRate !== 'number' || typeof vatRate !== 'number') throw new HttpError(500, 'fee_rates_missing')
  return { ...splitFee(totalCents, { feeRate, vatRate }), feeRate, vatRate }
}

/** Anbieter-Aufrufe zählen gegen dieselben Zähler wie die Function `route`, sonst wäre `quote` ein zweiter, ungebremster Weg zum Anbieter. */
function limitedRoute(route: RouteDeps, req: Request, deps: QuoteDeps): RouteDeps {
  return {
    ...route,
    provider: {
      ...route.provider,
      async route(points) {
        const ipBucket = await deps.hmac(`ip|${clientIp(req)}`)
        const [ipMin, ipDay] = ROUTE_LIMITS.route.ip
        const [gMin, gDay] = ROUTE_LIMITS.route.global
        let allowed: boolean
        try {
          allowed = await deps.takeTokens([
            { bucket: `route:min:${ipBucket}`, max: ipMin, window_seconds: MINUTE },
            { bucket: `route:day:${ipBucket}`, max: ipDay, window_seconds: DAY },
            { bucket: 'route:min:global', max: gMin, window_seconds: MINUTE },
            { bucket: 'route:day:global', max: gDay, window_seconds: DAY },
          ])
        } catch {
          throw new HttpError(503, 'limiter_unavailable') // fail closed
        }
        if (!allowed) throw new HttpError(429, 'rate_limited')
        return route.provider.route(points)
      },
    },
  }
}

const restricted = (e: unknown): e is HttpError => e instanceof HttpError && e.status === 503

export async function handleQuote(req: Request, deps: QuoteDeps): Promise<Response> {
  const started = Date.now()
  const cors = corsHeaders(req, deps.allowedOrigins)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  let mode = 'unknown'
  const finish = (status: number, body: unknown, code?: string, extra: Record<string, string> = {}) => {
    deps.log({ mode, status, ms: Date.now() - started, code })
    return json(status, body, { ...cors, ...extra })
  }

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    const jwt = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1]
    // Form vorab prüfen: Müll-Tokens lösen keinen Aufruf an die Auth-API aus
    const customerId = jwt && JWT_FORM.test(jwt) ? await deps.getUserId(jwt) : null
    if (!customerId) throw new HttpError(401, 'unauthorized')

    // Eigenes Limit zuerst: es schützt Rechenlast, Datenbank und den Anbieter vor einem einzelnen Konto.
    const userBucket = await deps.hmac(`user|${customerId}`)
    let allowed: boolean
    try {
      allowed = await deps.takeTokens([
        { bucket: `quote:min:${userBucket}`, max: USER_LIMITS.minute, window_seconds: MINUTE },
        { bucket: `quote:day:${userBucket}`, max: USER_LIMITS.day, window_seconds: DAY },
      ])
    } catch {
      throw new HttpError(503, 'limiter_unavailable')
    }
    if (!allowed) throw new HttpError(429, 'rate_limited')

    let body: unknown
    try {
      body = JSON.parse(await readLimited(req, MAX_BODY_BYTES))
    } catch (e) {
      if (e instanceof HttpError) throw e
      throw new HttpError(400, 'invalid_json')
    }
    const call = parseQuoteCall(body, viennaToday(deps.now()))
    mode = call.kind
    if (call.kind === 'rental' && Date.parse(call.pickupInstant) < deps.now()) throw new InputError('pickupAt: nicht in der Vergangenheit')

    if (call.clientRef) {
      const existing = await deps.findExisting(customerId, call.clientRef, call.kind)
      if (existing) return finish(200, existing)
    }

    // Vollständiger Tarifsatz und Gebührensätze, sonst Abbruch ohne zu schreiben.
    const pricing = await deps.loadPricing()
    const tariffs = buildTariffs(pricing.rows)
    const rates = await deps.loadFeeRates()

    const response =
      call.kind === 'rental'
        ? await quoteRental(call, customerId, pricing.version, rates, deps)
        : await quoteRequest(call, customerId, pricing.version, tariffs, rates, req, deps)
    return finish(200, response)
  } catch (e) {
    if (e instanceof HttpError) return finish(e.status, { error: e.code }, e.code, e.status === 429 ? { 'Retry-After': String(MINUTE) } : {})
    if (e instanceof InputError) return finish(400, { error: 'invalid_input', message: e.message }, 'invalid_input')
    if (e instanceof TariffError) return finish(500, { error: 'tariff_incomplete' }, 'tariff_incomplete')
    // Fehler der Schreib-Funktionen: 55000 nicht bearbeitbar, P0002 nicht gefunden (auch fremde Anfragen).
    const pg = (e as { code?: unknown } | null)?.code
    if (pg === '55000') return finish(409, { error: 'not_editable' }, 'not_editable')
    if (pg === 'P0002') return finish(404, { error: 'not_found' }, 'not_found')
    const cause = typeof pg === 'string' && /^[0-9A-Z]{5}$/.test(pg) ? pg : e instanceof Error ? e.name : 'unknown'
    return finish(500, { error: 'internal' }, `internal:${cause}`)
  }
}

type RequestCall = Extract<QuoteCall, { kind: 'request' }>
type Rates = { feeRate: unknown; vatRate: unknown }

async function quoteRequest(call: RequestCall, customerId: string, priceVersion: number, tariffs: ReturnType<typeof buildTariffs>, rates: Rates, req: Request, deps: QuoteDeps): Promise<QuoteResponse> {
  // Strecke nur aus Koordinaten über `route`. Scheitert der Anbieter oder greift ein Limit, wird die Anfrage ein Angebot
  // (`route_missing`, kein Preis, keine Gebühr); der Ausfall des Limiters (503) und alle übrigen Fehler brechen ab.
  let route: RouteResult | null = null
  if ((call.service === 'transport' || call.service === 'move') && call.from?.point && call.to?.point) {
    try {
      route = await computeRouteFacts(limitedRoute(deps.route, req, deps), call.from.point, call.to.point, call.returnTrip)
    } catch (e) {
      if (!(e instanceof HttpError) || restricted(e)) throw e
    }
  }

  let result: PriceResult | OfferResult
  switch (call.service) {
    case 'transport':
    case 'move':
      result = computeTransport(tariffs, call.inputs, route && { region: route.region, outsideKm: route.outsideKm, driveHours: route.driveHours })
      break
    case 'clearance':
      result = computeClearance(tariffs, call.inputs)
      break
    case 'assembly':
      result = computeAssembly(tariffs, call.inputs)
      break
  }

  const needsQuote = result.kind === 'offer'
  const snapshot = buildSnapshot(call.service, result)
  const saved = await deps.saveRequest({
    customerId,
    requestId: call.requestId,
    clientRef: call.clientRef,
    service: call.service,
    status: needsQuote && call.service === 'clearance' ? 'inspection_requested' : 'requested',
    inputs: call.inputs,
    snapshot,
    priceVersion,
    estimateCents: result.kind === 'price' ? result.totalCents : null,
    needsQuote,
    from: call.from,
    to: call.to,
    route,
    preferredDate: call.preferredDate,
    timeWindow: call.timeWindow,
    description: call.description,
    volumeM3: call.volumeM3,
    fee: result.kind === 'price' ? feeRow(result.totalCents, rates) : null,
  })
  return answer(saved, priceVersion, snapshot, call.clientRef, customerId, 'request', deps)
}

async function quoteRental(call: Extract<QuoteCall, { kind: 'rental' }>, customerId: string, priceVersion: number, rates: Rates, deps: QuoteDeps): Promise<QuoteResponse> {
  const offer = await deps.loadOffer(call.offerId)
  if (!offer) throw new HttpError(404, 'offer_not_found')
  // nur die Tarifwerte: computeRental prüft jedes Feld des Angebots
  const { dailyCents, kmPerDay, extraKmCents, coverDailyCents, driverDailyCents, bookingFeeCents, oneWayCents, depositCents } = offer
  const result = computeRental({ dailyCents, kmPerDay, extraKmCents, coverDailyCents, driverDailyCents, bookingFeeCents, oneWayCents, depositCents }, call.input)
  const snapshot: Snapshot = {
    ...buildSnapshot('rental', result),
    // Kopie der Angebotswerte, damit der Preis später nachvollziehbar bleibt (nie Vermieter-ID, nie Gebühr)
    offer: {
      name: offer.name,
      station: offer.station,
      providerName: offer.providerName,
      sizeM3: offer.sizeM3,
      dailyCents: offer.dailyCents,
      kmPerDay: offer.kmPerDay,
      extraKmCents: offer.extraKmCents,
      coverDailyCents: offer.coverDailyCents,
      excessCents: offer.excessCents,
      coverExcessCents: offer.coverExcessCents,
      driverDailyCents: offer.driverDailyCents,
      bookingFeeCents: offer.bookingFeeCents,
      oneWayCents: offer.oneWayCents,
      depositCents: offer.depositCents,
    },
  }
  const saved = await deps.saveBooking({
    customerId,
    clientRef: call.clientRef,
    offerId: offer.id,
    pickupAt: call.pickupInstant,
    returnAt: call.returnInstant,
    km: call.input.km,
    cover: call.input.cover,
    extraDriver: call.input.driver,
    oneWay: call.input.oneWay,
    snapshot,
    priceVersion,
    totalCents: result.totalCents,
    depositCents: result.depositCents,
    payeeId: offer.providerId,
    fee: feeRow(result.totalCents, rates),
  })
  return answer(saved, priceVersion, snapshot, call.clientRef, customerId, 'rental', deps)
}

/** Neu angelegt oder bearbeitet: die eigene Berechnung. Parallel schneller gewesener Aufruf (`created` false): dessen gespeicherte Antwort. */
async function answer(saved: Saved, priceVersion: number, snapshot: Snapshot, clientRef: string | null, customerId: string, kind: 'request' | 'rental', deps: QuoteDeps): Promise<QuoteResponse> {
  if (!saved.created && clientRef) {
    const existing = await deps.findExisting(customerId, clientRef, kind)
    if (existing) return existing
  }
  return { id: saved.id, status: saved.status, needsQuote: saved.needsQuote, priceVersion, snapshot }
}
