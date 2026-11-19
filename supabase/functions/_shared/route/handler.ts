// HTTP-Handler der Edge Function `route` (S5). Alle Abhängigkeiten werden injiziert, damit Vitest ihn ohne
// Netz und DB prüft. Logs enthalten nur Modus, Status, Latenz und Fehlercode: keine Adressen, Koordinaten, IPs.
import { clientIp, corsHeaders, json, readLimited } from '../http.ts'
import { computeRouteFacts, type RouteDeps } from './compute.ts'
import { HttpError, canonicalLabel, parseGeocode, parseRoute } from './facts.ts'
import { ProviderError } from './provider.ts'
import { TurnstileError } from '../turnstile.ts'

export type RateCheck = { bucket: string; max: number; window_seconds: number }
export type HandlerDeps = RouteDeps & {
  publishableKey: string
  allowedOrigins: string[]
  takeTokens(checks: RateCheck[]): Promise<boolean>
  /** `true` gültig, `false` abgelehnt; wirft, wenn die Prüfung selbst scheitert (Cloudflare nicht erreichbar, Secret falsch). */
  verifyCaptcha(token: string): Promise<boolean>
  log(entry: { mode: string; status: number; ms: number; code?: string }): void
}

const MAX_BODY_BYTES = 4096
const MAX_CAPTCHA_CHARS = 2048 // Obergrenze eines Turnstile-Tokens laut Cloudflare
const MINUTE = 60
const DAY = 86400
// Je Modus: pro IP und global. Global bleibt unter dem Kontingent des ORS-Plans (Directions 2000/Tag, Geocode 1000/Tag, je ca. 80 %).
// ponytail: feste Konstanten, bei Planwechsel hier anpassen.
export const LIMITS = {
  geocode: { ip: [10, 80], global: [35, 800] },
  route: { ip: [10, 160], global: [35, 1600] },
} as const

export async function handleRoute(req: Request, deps: HandlerDeps): Promise<Response> {
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
    // Nur ein Missbrauchsfilter, kein Schutz: der Publishable Key ist öffentlich. Schutz bietet das globale Limit.
    if (req.headers.get('apikey') !== deps.publishableKey) throw new HttpError(401, 'unauthorized')

    const text = await readLimited(req, MAX_BODY_BYTES)
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

    // Captcha vor dem Zähler: Aufrufe ohne gültiges Token verbrauchen weder das IP-Limit noch das globale Kontingent des Anbieters. Ein Token gilt einmal.
    const captcha = (body as { captcha?: unknown }).captcha
    if (typeof captcha !== 'string' || captcha.length === 0 || captcha.length > MAX_CAPTCHA_CHARS) throw new HttpError(403, 'captcha_failed')
    let human: boolean
    try {
      human = await deps.verifyCaptcha(captcha)
    } catch (e) {
      // Geloggt wird nur der Bezeichner aus unserem eigenen Fehlertyp, nie die Meldung (Secret, Token). Fail closed.
      return finish(503, { error: 'captcha_unavailable' }, e instanceof TurnstileError ? `captcha_unavailable:${e.code}` : 'captcha_unavailable')
    }
    if (!human) throw new HttpError(403, 'captcha_failed')

    const ip = clientIp(req)
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
        return finish(200, { candidates: candidates.map((c) => ({ ...c, label: canonicalLabel(c) })) })
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
