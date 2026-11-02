// HTTP-Handler der Edge Function `quote` (S8a): der einzige Schreiber für Anfragen und Mietanfragen.
// Alle Abhängigkeiten werden injiziert, damit Vitest ihn ohne Netz prüft (die Integrationstests nutzen die echte DB).
// Der Client liefert nur die Kundenwahl; Tarife, Strecke, Preis, Gebühr und Status entstehen hier. Logs enthalten
// nur Modus, Status, Latenz und Fehlercode: keine Nutzer-ID, keine Adressen, keine Koordinaten.
import {
  InputError,
  type OfferResult,
  type PriceResult,
  type RentalOffer,
  computeAssembly,
  computeClearance,
  computeRental,
  computeTransport,
} from '../pricing/index.ts'
import { clientIp, corsHeaders, json, readLimited } from '../http.ts'
import { computeRouteFacts, type RouteDeps } from '../route/compute.ts'
import { type Candidate, HttpError, type Point, type RouteResult, canonicalLabel } from '../route/facts.ts'
import { ProviderError } from '../route/provider.ts'
import { LIMITS as ROUTE_LIMITS, type RateCheck } from '../route/handler.ts'
import { pickCandidate } from './address.ts'
import { type VersionHold, holdAllows, matchesShown } from './hold.ts'
import { type Contact, type Place, type QuoteCall, parseQuoteCall } from './parse.ts'
import { buildSnapshot, type Snapshot } from './snapshot.ts'
import { viennaToday } from './time.ts'
import { type PriceConfigRow, TariffError, buildTariffs } from './tariffs.ts'

const MAX_BODY_BYTES = 16 * 1024
const MINUTE = 60
const DAY = 86400
/** Aufrufe je Nutzer (angemeldet, aber nicht vertrauenswürdig): verhindert Massen-Anfragen und Rechenlast. */
/** Eigenes Geocode-Kontingent von `quote`, getrennt vom Zähler der öffentlichen Function `route`: zusammen mit deren 800/Tag unter 1000/Tag des ORS-Plans. */
const GEOCODE_LIMITS = { minute: 25, day: 150, userDay: 10 } as const
const GEOCODE_TTL_SECONDS = 24 * 60 * 60
const JWT_FORM = /^[\w-]+\.[\w-]+\.[\w-]+$/
const USER_LIMITS = { minute: 6, day: 30 } as const

export type SaveRequest = {
  customerId: string
  clientRef: string
  service: 'transport' | 'move' | 'clearance' | 'assembly'
  inputs: unknown
  snapshot: Snapshot
  priceVersion: number
  /** Festpreis: total = low = high; Spanne: total null; Angebot: alle null (die Datenbank leitet den Status daraus ab). */
  totalCents: number | null
  lowCents: number | null
  highCents: number | null
  /** Geprüfte Adressen: kanonisches Label und Koordinaten des Kandidaten, nie der Client-Wert. */
  from: Place | null
  to: Place | null
  route: RouteResult | null
  region: 'vienna' | 'austria' | 'international' | null
  district: number
  contact: Contact
  /** Beleg für das Journal: was der Kunde bestätigt hat (Betrag bzw. Art, Bedingungen-Hash). */
  confirmed: Record<string, unknown>
  preferredDate: string
  timeWindow: string | null
  description: string | null
  volumeM3: number | null
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
  /** Aktuelle Version über die View `current_price_version`. */
  currentVersion(): Promise<number>
  /** Zeilen aus `price_config` der Version (Hash geprüft). */
  loadPricing(version: number): Promise<{ version: number; rows: PriceConfigRow[] }>
  /** Zustand einer Version für das Haltefenster; `null`: unbekannt oder unveröffentlicht. */
  loadHold(version: number): Promise<VersionHold | null>
  /** `booking_terms()`: Stornostufen, Anfahrtspauschale, `termsHash`. */
  loadTerms(): Promise<Record<string, unknown>>
  geocodeCache: { get(key: string): Promise<Candidate[] | null>; set(key: string, value: Candidate[], ttlSeconds: number): Promise<void> }
  /** Land und Bezirk am geprüften Punkt (Polygone in der DB). */
  district(lon: number, lat: number): Promise<{ inVienna: boolean; inAustria: boolean; district: number | null }>
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

/** 409 mit Inhalt: der Kunde bestätigt Preis bzw. Bedingungen neu; gespeichert wurde nichts. */
class Conflict extends Error {
  constructor(readonly body: Record<string, unknown>) {
    super(String(body['error']))
  }
}

/** Codes der Schreib-Funktion (P0001), die der Kunde bzw. die App versteht; `terms_missing`/`confirmed_required` sind Fehler des Servers selbst. */
const WRITE_ERRORS: Record<string, number> = {
  too_late: 422,
  district_required: 422,
  contact_required: 422,
  preferred_date_required: 400,
  terms_missing: 500,
  confirmed_required: 500,
}

const normalize =(label: string) => label.trim().toLowerCase().replace(/\s+/g, ' ')

/** Geocodiert das Label serverseitig (Cache, eigenes Kontingent) und liefert den Kandidaten, der dem Client-Punkt entspricht. */
async function verifyAddress(place: Place | null, customerId: string, deps: QuoteDeps): Promise<Candidate> {
  if (!place?.point) throw new HttpError(422, 'address_point_required')
  const key = await deps.hmac(['geocode', deps.route.provider.id, normalize(place.label)].join('|'))
  let candidates = await deps.geocodeCache.get(key)
  if (!candidates) {
    const userBucket = await deps.hmac(`user|${customerId}`)
    let allowed: boolean
    try {
      allowed = await deps.takeTokens([
        { bucket: 'qgeo:min:global', max: GEOCODE_LIMITS.minute, window_seconds: MINUTE },
        { bucket: 'qgeo:day:global', max: GEOCODE_LIMITS.day, window_seconds: DAY },
        { bucket: `qgeo:day:${userBucket}`, max: GEOCODE_LIMITS.userDay, window_seconds: DAY },
      ])
    } catch {
      throw new HttpError(503, 'limiter_unavailable')
    }
    if (!allowed) throw new HttpError(429, 'rate_limited')
    try {
      candidates = await deps.route.provider.geocode(place.label)
    } catch (e) {
      if (e instanceof ProviderError) throw new HttpError(503, 'provider_unavailable')
      throw e
    }
    await deps.geocodeCache.set(key, candidates, GEOCODE_TTL_SECONDS)
  }
  return pickCandidate(candidates, place.point)
}

const placeOf = (c: Candidate): Place => ({ label: canonicalLabel(c), point: { lat: c.lat, lon: c.lon } })

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

    const response = call.kind === 'rental' ? await quoteRental(call, customerId, deps) : await quoteRequest(call, customerId, req, deps)
    return finish(200, response)
  } catch (e) {
    if (e instanceof HttpError) return finish(e.status, { error: e.code }, e.code, e.status === 429 ? { 'Retry-After': String(MINUTE) } : {})
    if (e instanceof Conflict) return finish(409, e.body, String(e.body['error']))
    if (e instanceof InputError) return finish(400, { error: 'invalid_input', message: e.message }, 'invalid_input')
    if (e instanceof TariffError) return finish(500, { error: 'tariff_incomplete' }, 'tariff_incomplete')
    // Fehler der Schreib-Funktion: P0001 mit dem Code als Meldung (too_late: Termin zu nah, setting_missing: Einstellung fehlt).
    const { code: pg, message } = (e ?? {}) as { code?: unknown; message?: unknown }
    const mapped = pg === 'P0001' && typeof message === 'string' ? WRITE_ERRORS[message] : undefined
    if (mapped && typeof message === 'string') return finish(mapped, { error: message }, message)
    if ((pg === 'P0001' && message === 'setting_missing') || (e instanceof Error && e.message === 'setting_missing')) return finish(500, { error: 'setting_missing' }, 'setting_missing')
    const cause = typeof pg === 'string' && /^[0-9A-Z]{5}$/.test(pg) ? pg : e instanceof Error ? e.name : 'unknown'
    return finish(500, { error: 'internal' }, `internal:${cause}`)
  }
}

type RequestCall = Extract<QuoteCall, { kind: 'request' }>
/** Preisart → Spalten der Revision (Konzept 5.4): Festpreis total = low = high, Spanne total null, Angebot alles null. */
function amounts(r: PriceResult | OfferResult) {
  if (r.kind === 'offer') return { totalCents: null, lowCents: null, highCents: null }
  return { totalCents: r.lowCents === r.highCents ? r.totalCents : null, lowCents: r.lowCents, highCents: r.highCents }
}

/** Version, mit der gerechnet wird: die gezeigte, solange das Haltefenster sie trägt, sonst die aktuelle (dann folgt 409 price_changed). */
async function versionFor(shown: number, deps: QuoteDeps): Promise<number> {
  return holdAllows(await deps.loadHold(shown), deps.now()) ? shown : await deps.currentVersion()
}

async function quoteRequest(call: RequestCall, customerId: string, req: Request, deps: QuoteDeps): Promise<QuoteResponse> {
  // Bedingungen: der Kunde bestätigt genau die Werte, die gespeichert werden.
  const terms = await deps.loadTerms()
  if (terms['termsHash'] !== call.termsHash) throw new Conflict({ error: 'terms_changed', terms })
  const priceVersion = await versionFor(call.priceVersion, deps)
  // Vollständiger Tarifsatz, sonst Abbruch ohne zu schreiben.
  const tariffs = buildTariffs((await deps.loadPricing(priceVersion)).rows)

  // Adressen nur über den serverseitig geprüften Kandidaten; der Client-Punkt bindet nie (Konzept 5.5).
  const fromCandidate = await verifyAddress(call.from, customerId, deps)
  const pickup = await deps.district(fromCandidate.lon, fromCandidate.lat)
  if (!pickup.inVienna) throw new HttpError(422, 'pickup_outside_vienna')
  if (pickup.district === null) throw new HttpError(422, 'district_required')
  const from = placeOf(fromCandidate)
  let to: Place | null = null
  if (call.service === 'transport' || call.service === 'move') {
    const toCandidate = await verifyAddress(call.to, customerId, deps)
    if (!(await deps.district(toCandidate.lon, toCandidate.lat)).inAustria) throw new HttpError(422, 'offer_not_bookable')
    to = placeOf(toCandidate)
  }

  // Strecke nur aus den geprüften Punkten über `route`. Nur `no_route` macht die Anfrage zum Angebot (`route_missing`);
  // Ausfall und Limit des Anbieters brechen ab (503/429), nichts wird gespeichert.
  let route: RouteResult | null = null
  if (to) {
    try {
      route = await computeRouteFacts(limitedRoute(deps.route, req, deps), from.point as Point, to.point as Point, call.returnTrip)
    } catch (e) {
      if (!(e instanceof HttpError)) throw e
      if (e.status === 502) throw new HttpError(503, 'provider_unavailable')
      if (!(e.status === 422 && e.code === 'no_route')) throw e
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

  const snapshot = { ...buildSnapshot(call.service, result), terms }
  // Nur was der Kunde sah wird gespeichert: andere Version oder anderer Betrag (auch bei gleicher Version, z. B. Strecke) → 409.
  if (priceVersion !== call.priceVersion || !matchesShown(snapshot, call.shown)) throw new Conflict({ error: 'price_changed', priceVersion, snapshot })
  const saved = await deps.saveRequest({
    customerId,
    clientRef: call.clientRef,
    service: call.service,
    inputs: call.inputs,
    snapshot,
    priceVersion,
    ...amounts(result),
    from,
    to,
    route,
    region: route?.region ?? null,
    district: pickup.district,
    contact: call.contact,
    confirmed: { shown: call.shown, termsHash: call.termsHash },
    preferredDate: call.preferredDate,
    timeWindow: call.timeWindow,
    description: call.description,
    volumeM3: call.volumeM3,
  })
  return answer(saved, priceVersion, snapshot, call.clientRef, customerId, 'request', deps)
}

async function quoteRental(call: Extract<QuoteCall, { kind: 'rental' }>, customerId: string, deps: QuoteDeps): Promise<QuoteResponse> {
  // Miete ohne Haltefenster: nur die aktuelle Version, nur der gezeigte Betrag.
  const priceVersion = await deps.currentVersion()
  if (priceVersion !== call.priceVersion) throw new Conflict({ error: 'price_changed', priceVersion })
  buildTariffs((await deps.loadPricing(priceVersion)).rows)
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
  if (result.totalCents !== call.shownTotalCents) throw new Conflict({ error: 'price_changed', priceVersion, snapshot })
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
