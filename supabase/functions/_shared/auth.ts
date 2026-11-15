// Antwort von `auth.getUser(jwt)` mit Fehler: Auth lehnt ein Token mit 400, 401 oder 403 ab (auch „session_not_found“ nach dem Löschen des
// Kontos, Status 400). Das ist `null` (die Function antwortet 401). Alles andere (5xx, 429, Netz, unbekannt) ist eine Störung des Dienstes:
// werfen, die Handler antworten 500. Ein 401 würde die App abmelden und Entwürfe leeren.
export function rejectToken(error: { status?: number }): null {
  if (error.status === 400 || error.status === 401 || error.status === 403) return null
  throw error
}
