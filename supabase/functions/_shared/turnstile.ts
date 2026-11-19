// Prüft ein Cloudflare-Turnstile-Token serverseitig (siteverify). Das Secret steht nur als Function-Secret, nie im Code oder im Log.
// Ohne remoteip: Die IP geht nicht an Cloudflare (Datensparsamkeit; der Site Key ist an die Domain gebunden).
// Keine Prüfung von hostname oder action (ts1, ENTSCHEIDUNGEN): Die Testschlüssel liefern feste Werte, der Domain-Schutz liegt im Site Key.

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Fehler auf unserer Seite oder bei Cloudflare (nicht das Token des Kunden): Die Handler antworten 503. `code` ist ein kurzer Bezeichner, nie Token oder Secret. */
export class TurnstileError extends Error {
  constructor(readonly code: string) {
    super(`turnstile_error code=${code}`)
    this.name = 'TurnstileError'
  }
}

// Fehlercodes laut Cloudflare, die das Token betreffen. Alles andere (fehlendes oder falsches Secret, bad-request, internal-error, unbekannt) ist unser Fehler.
const TOKEN_REJECTED = new Set(['invalid-input-response', 'timeout-or-duplicate', 'missing-input-response'])
const KNOWN_FAILURES = new Set(['missing-input-secret', 'invalid-input-secret', 'bad-request', 'internal-error'])

/** `true` gültig, `false` Token abgelehnt; wirft `TurnstileError`, wenn die Prüfung selbst scheitert (Netz, Timeout, 5xx, Nicht-JSON, Secret falsch). */
export async function verifyTurnstile(token: string, secret: string, fetchImpl: typeof fetch = fetch, timeoutMs = 5000): Promise<boolean> {
  let res: Response
  try {
    res = await fetchImpl(SITEVERIFY, { method: 'POST', body: new URLSearchParams({ secret, response: token }), signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    throw new TurnstileError('unreachable')
  }
  if (!res.ok) throw new TurnstileError('http_error')
  let body: { success?: unknown; 'error-codes'?: unknown }
  try {
    body = await res.json()
  } catch {
    throw new TurnstileError('not_json')
  }
  if (body?.success === true) return true
  const codes = Array.isArray(body?.['error-codes']) ? body['error-codes'].filter((c): c is string => typeof c === 'string') : []
  if (body?.success === false && codes.length > 0 && codes.every((c) => TOKEN_REJECTED.has(c))) return false
  throw new TurnstileError(codes.find((c) => KNOWN_FAILURES.has(c)) ?? 'unknown')
}
