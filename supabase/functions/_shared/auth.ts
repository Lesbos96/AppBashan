// Antwort von `auth.getUser(jwt)` mit Fehler. 401 gibt es nur, wenn Auth das Token ablehnt: Fehlercode `bad_jwt` (gefälscht, abgelaufen), `session_expired`,
// `user_not_found`, `user_banned` bei Status 400, 401 oder 403, oder der Fehlertyp „Sitzung fehlt“ (auth-js macht aus `session_not_found` nach dem Löschen
// des Kontos einen AuthSessionMissingError, Status 400, ohne Code). Das ist `null` (die Function antwortet 401).
// Alles andere ist eine Störung: auch ein 401 oder 403 ohne diese Codes, das den Schlüssel der Function oder das Gateway meint (rotierter Secret Key), 5xx,
// 429, Netz, unbekannt. Es wird `AuthServiceError` geworfen, die Handler antworten 500; ein 401 würde die App abmelden und Entwürfe leeren.
// Gemessen gegen Dev (tests/rls/auth-token-codes.test.ts): gefälscht, gelöschtes Konto, falscher Schlüssel. Nicht gemessen: abgelaufen (nicht erzeugbar),
// `session_expired`, `user_not_found`, `user_banned` (aus error-codes.ts von auth-js).
// `session_not_found` steht auch in der Liste, falls eine künftige auth-js-Version den Code statt des Typs liefert (n12b N2).
const REJECTED_CODES = new Set(['bad_jwt', 'session_expired', 'session_not_found', 'user_not_found', 'user_banned'])

/** Ein Token besteht aus Base64url-Zeichen und Punkten, nie aus Leerzeichen oder Sonderzeichen: alles andere ist abgelehnt (401), ohne Aufruf bei Auth (n12b N1). */
export const TOKEN_FORM = /^[\w.-]+$/

/**
 * Störung des Auth-Dienstes. Die Meldung (die Handler loggen `message`) enthält nur festen Text, den Status und den Code als kurzen Bezeichner
 * (Kleinbuchstaben und Unterstrich): nie Token, Nutzer-ID oder die Originalmeldung (n12b N3).
 */
export class AuthServiceError extends Error {
  constructor(
    readonly authStatus: number | undefined,
    readonly authCode: string | undefined,
  ) {
    super(`auth_service_error status=${Number.isInteger(authStatus) ? authStatus : '-'} code=${authCode !== undefined && /^[a-z_]{1,40}$/.test(authCode) ? authCode : '-'}`)
    this.name = 'AuthServiceError'
  }
}

export function rejectToken(error: { name?: string; status?: number; code?: string }): null {
  if (error.name === 'AuthSessionMissingError') return null
  if ((error.status === 400 || error.status === 401 || error.status === 403) && error.code !== undefined && REJECTED_CODES.has(error.code)) return null
  throw new AuthServiceError(error.status, error.code)
}
