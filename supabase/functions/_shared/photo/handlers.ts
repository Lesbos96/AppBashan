// Edge-Function-Logik der Foto-Pipeline (S9d): `photo-publish` (Kopie je Foto), `photo-receipt` (Beleg-Upload), `job-photo` (signierte URLs
// für Partner und Kunde), `admin-photo` (Support). Alle Zugriffe kommen über `deps` (Secret-Key-Client in db.ts, Fakes in den Unit-Tests).
// Antworten enthalten nie Speicherpfade; die Pfade stehen nur in den signierten URLs (600 s).
import { AuthServiceError } from '../auth.ts'
import { corsHeaders, json, readBytesLimited } from '../http.ts'
import { HttpError } from '../route/facts.ts'
import { type AuthUser, authed, body, DbError, type Log, preflight, sameSecret, STATUS, UUID } from '../jobs/handlers.ts'
import { MAX_INPUT_BYTES, PhotoError, type Processed } from './process.ts'

export type Processor = (bytes: Uint8Array) => Promise<Processed>
type GetUser = { getUser(jwt: string): Promise<AuthUser | null> }

function fail(e: unknown, event: string, log: Log, origin: Record<string, string> = {}): Response {
  const code = e instanceof DbError ? e.code : ''
  const status = STATUS[code]
  if (status) return json(status, { error: code }, origin)
  if (e instanceof HttpError) return json(e.status, { error: e.code }, origin)
  // Störung des Auth-Dienstes (n12b-1): die Meldung ist fester Text mit Status und Code, nie Token oder Originalmeldung
  if (e instanceof AuthServiceError) {
    log({ event, code: e.message })
    return json(500, { error: 'internal' }, origin)
  }
  // nur feste Codes ins Log (`upload_failed`, `sign_failed` …); jeder andere Text könnte Pfade oder Adressen enthalten
  log({ event, code: e instanceof Error && /^[a-z_]{3,40}$/.test(e.message) ? e.message : 'internal' })
  return json(500, { error: 'internal' }, origin)
}

// photo-publish --------------------------------------------------------------------------------------------------------------
export type PublishDeps = {
  /** Leer: Function nicht eingerichtet, jeder Aufruf wird abgelehnt (401, fail closed). */
  secret: string
  /** Quelldatei des geclaimten Fotos; `DbError('stale_claim')`, wenn Versuch oder Lease nicht mehr gelten. */
  begin(jobPhotoId: string, attempt: number): Promise<string>
  /** `null`: die Datei existiert nicht. Andere Fehler (Netz, Storage) werfen und gelten als vorübergehend. */
  download(path: string): Promise<Uint8Array | null>
  process: Processor
  /** Schreibt die Kopie unter einem Zufallsnamen, ohne Überschreiben; liefert den Pfad. */
  upload(bytes: Uint8Array): Promise<string>
  mark(jobPhotoId: string, attempt: number, result: { ok: true; path: string; sha256: string } | { ok: false; error: string }): Promise<void>
  log: Log
}

/**
 * Verarbeitet ein vom Cron geclaimtes Foto. Dauerhafte Fehler (Datei fehlt, kein gültiges JPEG) markieren `failed` mit festem Code;
 * vorübergehende Fehler markieren nichts, die Lease läuft ab und der nächste Cron-Lauf versucht es erneut (höchstens 3 Versuche).
 */
export async function handlePublish(req: Request, deps: PublishDeps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })
  // Aufrufer vor der Konfiguration (u5-1): ohne Secret in der Umgebung wird jeder Aufruf abgelehnt, auch ein leerer Header
  if (!deps.secret || !(await sameSecret(req.headers.get('x-publish-secret') ?? '', deps.secret))) return json(401, { error: 'unauthorized' })
  try {
    const b = await body(req)
    const id = b?.job_photo_id
    const attempt = b?.attempt
    if (typeof id !== 'string' || !UUID.test(id) || !Number.isInteger(attempt) || (attempt as number) < 1 || (attempt as number) > 3) {
      return json(400, { error: 'invalid_input' })
    }
    const n = attempt as number
    const source = await deps.begin(id, n)
    const input = await deps.download(source)
    if (!input) {
      await deps.mark(id, n, { ok: false, error: 'source_missing' })
      deps.log({ event: 'photo_publish', jobPhoto: id, status: 'failed', code: 'source_missing' })
      return json(200, { status: 'failed' })
    }
    let out: Processed
    try {
      out = await deps.process(input)
    } catch (e) {
      if (!(e instanceof PhotoError)) throw e
      await deps.mark(id, n, { ok: false, error: e.code })
      deps.log({ event: 'photo_publish', jobPhoto: id, status: 'failed', code: e.code })
      return json(200, { status: 'failed' })
    }
    const path = await deps.upload(out.bytes)
    await deps.mark(id, n, { ok: true, path, sha256: out.sha256 })
    deps.log({ event: 'photo_publish', jobPhoto: id, status: 'ready' })
    return json(200, { status: 'ready' })
  } catch (e) {
    return fail(e, 'photo_publish_failed', deps.log)
  }
}

// photo-receipt --------------------------------------------------------------------------------------------------------------
export type ReceiptDeps = GetUser & {
  allowedOrigins: readonly string[]
  /** Torprüfung vor dem Lesen des Bodys (aal2, aktive Zuordnung, Firma, Limit); wirft `DbError`. */
  check(userId: string, aal: string, requestId: string): Promise<void>
  process: Processor
  upload(bytes: Uint8Array): Promise<string>
  /** Legt die Zeile an und prüft das Tor erneut unter Sperre; liefert die Foto-ID. */
  add(userId: string, aal: string, requestId: string, path: string, sha256: string): Promise<string>
  log: Log
}

/** Beleg-Foto des Partners: JPEG als Body, `?request=<id>`. Nur JWT mit aal2; die Zuordnung prüft die Datenbank, nie der Aufrufer. */
export async function handleReceipt(req: Request, deps: ReceiptDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin)
    if (a.res) return a.res
    const requestId = new URL(req.url).searchParams.get('request') ?? ''
    if (!UUID.test(requestId)) return json(400, { error: 'invalid_input' }, origin)
    await deps.check(a.user.id, a.user.aal, requestId)
    const input = await readBytesLimited(req, MAX_INPUT_BYTES)
    let out: Processed
    try {
      out = await deps.process(input)
    } catch (e) {
      if (e instanceof PhotoError) return json(422, { error: e.code }, origin)
      throw e
    }
    const path = await deps.upload(out.bytes)
    const id = await deps.add(a.user.id, a.user.aal, requestId, path, out.sha256)
    return json(200, { id }, origin)
  } catch (e) {
    return fail(e, 'photo_receipt_failed', deps.log, origin)
  }
}

// job-photo ------------------------------------------------------------------------------------------------------------------
export type PhotoLink = { id: string; kind: string; url: string }
export type JobPhotoDeps = GetUser & {
  allowedOrigins: readonly string[]
  /** Genau eines von beiden: Listing (Partner) oder Anfrage (Kunde). Liefert signierte URLs ohne Pfad; wirft `DbError`. */
  photos(userId: string, aal: string, target: { listingId: string } | { requestId: string }): Promise<PhotoLink[]>
  log: Log
}

/** Fotos eines Listings (Partner, aal2 prüft die Datenbank) oder Belege der eigenen Anfrage (Kunde). */
export async function handleJobPhoto(req: Request, deps: JobPhotoDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    // dieselbe Prüfung wie überall (Form des Tokens, 401), ohne aal2: Kunde und Partner rufen auf, die Datenbank prüft den Rest
    const a = await authed(req, deps, origin, false)
    if (a.res) return a.res
    const user = a.user
    const { listingId, requestId } = ((await body(req)) ?? {}) as Record<string, unknown>
    const ok = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
    if (ok(listingId) === ok(requestId) || (listingId !== undefined && !ok(listingId)) || (requestId !== undefined && !ok(requestId))) {
      return json(400, { error: 'invalid_input' }, origin)
    }
    const target = ok(listingId) ? { listingId } : { requestId: requestId as string }
    return json(200, await deps.photos(user.id, user.aal, target), origin)
  } catch (e) {
    return fail(e, 'job_photo_failed', deps.log, origin)
  }
}

// admin-photo ----------------------------------------------------------------------------------------------------------------
export type AdminPhotoDeps = GetUser & {
  allowedOrigins: readonly string[]
  /** Schreibt den Audit-Eintrag (Datenbank-Funktion) und liefert signierte URLs je Bucket; wirft `DbError`. */
  photos(adminId: string, requestId: string, reason: string): Promise<{ bucket: string; url: string }[]>
  log: Log
}

/** Alle Fotos einer Anfrage für den Support: nur admin mit aal2, Begründung Pflicht (die Datenbank-Funktion schreibt den `audit_log`). */
export async function handleAdminPhoto(req: Request, deps: AdminPhotoDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin)
    if (a.res) return a.res
    const { requestId, reason } = ((await body(req)) ?? {}) as Record<string, unknown>
    if (typeof requestId !== 'string' || !UUID.test(requestId) || typeof reason !== 'string') return json(400, { error: 'invalid_input' }, origin)
    return json(200, await deps.photos(a.user.id, requestId, reason), origin)
  } catch (e) {
    return fail(e, 'admin_photo_failed', deps.log, origin)
  }
}
