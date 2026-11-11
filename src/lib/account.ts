import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AccountErrorKind = 'open_requests' | 'role_not_allowed' | 'unauthorized' | 'offline' | 'unavailable'

export class AccountError extends Error {
  constructor(readonly kind: AccountErrorKind) {
    super(kind)
  }
}

export const accountErrorText: Record<AccountErrorKind, string> = {
  open_requests: 'Du hast noch offene Aufträge oder Anfragen. Bestätigte Aufträge kannst du im Auftrag stornieren, Anfragen ohne Zusage laufen von selbst ab. Nach dem Termin beantwortest du im Auftrag, ob er stattgefunden hat. Danach kannst du dein Konto löschen.',
  role_not_allowed: 'Partner-Konten lassen sich nicht in der App löschen. Die Kontaktdaten findest du im Impressum.',
  unauthorized: 'Deine Anmeldung gilt nicht mehr. Hast du dein Konto gerade gelöscht, ist es gelöscht. Sonst melde dich neu an.',
  offline: 'Keine Verbindung. Prüfe dein Netz und versuche es erneut.',
  unavailable: 'Das hat nicht geklappt. Versuche es gleich noch einmal.',
}

// Fehlercode des Servers samt erwartetem Status; alles andere ist generisch.
const CODES = new Map<string, [number, AccountErrorKind]>([
  ['open_requests', [409, 'open_requests']],
  ['role_not_allowed', [403, 'role_not_allowed']],
  ['unauthorized', [401, 'unauthorized']],
])

/** Löscht das eigene Konto (`delete-account`). Nur nach ausdrücklicher Bestätigung in der Oberfläche aufrufen; Erfolg nur bei `{ deleted: true }`. */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', { body: { confirm: true } })
  if (!error) {
    if (data && typeof data === 'object' && (data as Record<string, unknown>).deleted === true) return
    throw new AccountError('unavailable')
  }
  if (error instanceof FunctionsFetchError) throw new AccountError('offline')
  if (error instanceof FunctionsHttpError) {
    const d: unknown = await error.context.json().catch(() => null)
    const code = d && typeof d === 'object' ? (d as Record<string, unknown>).error : undefined
    const hit = typeof code === 'string' ? CODES.get(code) : undefined
    if (hit && hit[0] === error.context.status) throw new AccountError(hit[1])
  }
  throw new AccountError('unavailable')
}
