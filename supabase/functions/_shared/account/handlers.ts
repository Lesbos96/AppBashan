// Edge-Function-Logik für „Konto löschen“ (S9h-4). Die Nutzer-ID kommt aus dem geprüften JWT, nie aus dem Body; ohne ausdrückliche
// Bestätigung (`{ "confirm": true }`) geschieht nichts. Die Datenbank prüft Rolle und offene Anfragen und anonymisiert (delete_account).
import { corsHeaders, json } from '../http.ts'
import { type AuthUser, DbError, type Log, STATUS, authed, body, preflight } from '../jobs/handlers.ts'

export type DeleteAccountDeps = {
  allowedOrigins: readonly string[]
  getUser(jwt: string): Promise<AuthUser | null>
  remove(userId: string): Promise<void>
  log: Log
}

/** Kein aal2: Kunden haben keine MFA. Gesperrt wird in der Datenbank (offene Anfrage 409, Rolle 403). */
export async function handleDeleteAccount(req: Request, deps: DeleteAccountDeps): Promise<Response> {
  const origin = corsHeaders(req, deps.allowedOrigins)
  const early = preflight(req, origin)
  if (early) return early
  try {
    const a = await authed(req, deps, origin, false)
    if (a.res) return a.res
    const b = await body(req)
    if (!b || Object.keys(b).length !== 1 || b['confirm'] !== true) return json(400, { error: 'invalid_input' }, origin)
    await deps.remove(a.user.id)
    return json(200, { deleted: true }, origin)
  } catch (e) {
    const code = e instanceof DbError ? e.code : ''
    const status = STATUS[code]
    if (status) return json(status, { error: code }, origin)
    deps.log({ event: 'delete_account_failed', message: e instanceof Error ? e.message.slice(0, 200) : 'unknown' })
    return json(500, { error: 'internal' }, origin)
  }
}
