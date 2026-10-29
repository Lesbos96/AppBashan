// HTTP-Handler der Edge Function `route` (S5). Alle Abhängigkeiten werden injiziert, damit Vitest ihn ohne
// Netz und DB prüft. Logs enthalten nur Modus, Status, Latenz und Fehlercode: keine Adressen, Koordinaten, IPs.
import { computeRouteFacts, type RouteDeps } from './compute.ts'
import { HttpError, parseGeocode, parseRoute } from './facts.ts'
import { ProviderError } from './provider.ts'

export type RateCheck = { bucket: string; max: number; window_seconds: number }
export type HandlerDeps = RouteDeps & {
  publishableKey: string
  allowedOrigins: string[]
  takeTokens(checks: RateCheck[]): Promise<boolean>
  log(entry: { mode: string; status: number; ms: number; code?: string }): void
}

const MAX_BODY_BYTES = 4096
const MINUTE = 60
const DAY = 86400
// Je Modus: pro IP und global. Global bleibt unter dem Kontingent des ORS-Plans (Directions 2000/Tag, Geocode 1000/Tag, je ca. 80 %).
// ponytail: feste Konstanten, bei Planwechsel hier anpassen.
const LIMITS = {
  geocode: { ip: [30, 300], global: [35, 800] },
  route: { ip: [20, 200], global: [35, 1600] },
} as const

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })

export async function handleRoute(req: Request, deps: HandlerDeps): Promise<Response> {
  const started = Date.now()
  const origin = req.headers.get('origin')
  const cors: Record<string, string> = {
    Vary: 'Origin',
    ...(origin && deps.allowedOrigins.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'apikey, content-type, authorization, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
      : {}),
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  let mode = 'unknown'
  const finish = (status: number, body: unknown, code?: string, extra: Record<string, string> = {}) => {
    deps.log({ mode, status, ms: Date.now() - started, code })
    return json(status, body, { ...cors, ...extra })
  }

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed')
    // Nur ein Missbrauchsfilter, kein Schutz: der Publishable Key ist öffentlich. Schutz bietet das globale Limit.
    if (req.headers.get('apikey') !== deps.publishableKey) throw new HttpError(401, 'unauthorized')

    if (Number(req.headers.get('content-length')) > MAX_BODY_BYTES) throw new HttpError(413, 'body_too_large')
    const text = await req.text()
    if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw new HttpError(413, 'body_too_large')
    let body: { mode?: unknown } | null
    try {
      body = JSON.parse(text)
    } catch {
      throw new HttpError(400, 'invalid_json')
    }
    if (body?.mode !== 'geocode' && body?.mode !== 'route') throw new HttpError(400, 'invalid_mode')
    const kind = body.mode
    mode = kind
    // Eingaben vor dem Zähler prüfen: ungültige Anfragen verbrauchen kein Kontingent des Anbieters.
    const input = kind === 'geocode' ? parseGeocode(body) : parseRoute(body)

    // Client-IP von der Plattform: cf-connecting-ip, sonst das letzte x-forwarded-for-Element (das erste kann der Client selbst setzen).
    // Ohne beides teilen sich alle den Bucket „unknown" (streng, aber sicher). Verhalten nach dem Deploy prüfen (docs/OPEN_ISSUES.md).
    const ip = req.headers.get('cf-connecting-ip')?.trim() || req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown'
    const ipBucket = await deps.hmac(`ip|${ip}`)
    const [ipMin, ipDay] = LIMITS[kind].ip
    const [gMin, gDay] = LIMITS[kind].global
    let allowed: boolean
    try {
      allowed = await deps.takeTokens([
        { bucket: `${mode}:min:${ipBucket}`, max: ipMin, window_seconds: MINUTE },
        { bucket: `${mode}:day:${ipBucket}`, max: ipDay, window_seconds: DAY },
        { bucket: `${mode}:min:global`, max: gMin, window_seconds: MINUTE },
        { bucket: `${mode}:day:global`, max: gDay, window_seconds: DAY },
      ])
    } catch {
      throw new HttpError(503, 'limiter_unavailable') // fail closed
    }
    if (!allowed) throw new HttpError(429, 'rate_limited')

    if (mode === 'geocode') {
      try {
        const candidates = await deps.provider.geocode((input as { q: string }).q)
        return finish(200, { candidates })
      } catch (e) {
        if (e instanceof ProviderError) throw new HttpError(502, 'provider_unavailable')
        throw e
      }
    }
    const { from, to, returnTrip } = input as ReturnType<typeof parseRoute>
    return finish(200, await computeRouteFacts(deps, from, to, returnTrip))
  } catch (e) {
    if (e instanceof HttpError) return finish(e.status, { error: e.code }, e.code, e.status === 429 ? { 'Retry-After': String(MINUTE) } : {})
    // Unerwartet (z. B. fehlende Grenze in der DB): nie einen Standardwert liefern. Geloggt wird nur der PG-Code bzw. Fehlername, nie die Meldung.
    const pg = (e as { code?: unknown } | null)?.code
    const cause = typeof pg === 'string' && /^[0-9A-Z]{5}$/.test(pg) ? pg : e instanceof Error ? e.name : 'unknown'
    return finish(500, { error: 'internal' }, `internal:${cause}`)
  }
}
