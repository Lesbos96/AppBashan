import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AuthErrorKind = 'invalid_email' | 'invalid_code' | 'rate_limited' | 'offline' | 'unavailable'

export class AuthError extends Error {
  constructor(readonly kind: AuthErrorKind) {
    super(kind)
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Die Länge stellt das Supabase-Projekt ein (6 bis 10 Ziffern; das Dev-Projekt sendet 8)
const CODE = /^\d{6,10}$/
const HASH = /^[\w-]{8,200}$/
// Der Link der Mail öffnet oft in einem neuen Tab: das Rücksprungziel liegt im localStorage, nur so lange wie der Code gilt (15 min).
const NEXT_KEY = 'movenow.next'
const NEXT_TTL_MS = 15 * 60 * 1000
const returnUrl =() => `${window.location.origin}/anmelden`

type ServiceError = { status?: number; code?: string }

/** Fehler, die für jede Anfrage gleich gelten: kein Netz, zu viele Versuche, Dienst gestört. */
function transient(error: ServiceError): AuthError | null {
  if (error.status === 429 || error.code === 'over_request_rate_limit' || error.code === 'over_email_send_rate_limit') return new AuthError('rate_limited')
  if (isAuthRetryableFetchError(error) && !error.status) return new AuthError('offline')
  if (!error.status || error.status >= 500) return new AuthError('unavailable')
  return null
}

// Supabase meldet falsche, abgelaufene und benutzte Codes nicht verlässlich getrennt (`otp_expired`), deshalb eine Art.
const verifyFailure = (error: ServiceError) => transient(error) ?? new AuthError('invalid_code')

const requestFailure = (error: ServiceError) =>
  transient(error) ?? new AuthError(error.code === 'email_address_invalid' ? 'invalid_email' : 'unavailable')

/**
 * Schickt eine Mail mit Link und Code. Das Konto entsteht beim Anfordern (unbestätigt); die Anmeldung gilt erst mit Code oder Link.
 * Der Link trägt einen `token_hash` und funktioniert in jedem Browser (`verifyLink`); der Code aus derselben Mail ist der Weg für die App selbst.
 */
export async function requestSignIn(email: string): Promise<void> {
  const address = email.trim()
  if (!EMAIL.test(address)) throw new AuthError('invalid_email')
  const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true, emailRedirectTo: returnUrl() } })
  if (error) throw requestFailure(error)
}

/** Nur Ziffern, höchstens 10: für das Codefeld (Einfügen mit Leerzeichen oder Bindestrichen). */
export const digitsOnly = (raw: string) => raw.replace(/\D/g, '').slice(0, 10)

/** Meldet mit dem Code aus der Mail an (Ausweichweg, wenn der Link nicht im selben Browser öffnet). */
export async function verifyCode(email: string, code: string): Promise<void> {
  const token = code.replace(/\s/g, '')
  if (!EMAIL.test(email.trim())) throw new AuthError('invalid_email')
  if (!CODE.test(token)) throw new AuthError('invalid_code')
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' })
  if (error) throw verifyFailure(error)
}

/** Meldet mit dem `token_hash` aus dem Link der Mail an (Rückkehr auf `/anmelden`). */
export async function verifyLink(tokenHash: string): Promise<void> {
  if (!HASH.test(tokenHash)) throw new AuthError('invalid_code')
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  if (error) throw verifyFailure(error)
}

// Vorbereitet für S10: wirkt erst, wenn der Apple-Anbieter im Supabase-Projekt eingerichtet ist (Apple Developer Programm).
export async function signInWithApple(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: returnUrl() } })
  if (error) throw requestFailure(error)
}

/** Meldet ab; scheitert der Dienst (kein Netz), fällt die Sitzung wenigstens auf diesem Gerät weg. Entwürfe mit Adressen verschwinden. */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) await supabase.auth.signOut({ scope: 'local' })
  try {
    sessionStorage.clear()
    localStorage.removeItem(NEXT_KEY)
  } catch {
    // Speicher gesperrt: nichts zu löschen
  }
}

/**
 * Rücksprungziel nach der Anmeldung: nur Pfade der eigenen Origin, nie `/anmelden` selbst (Schleife), sonst `/`.
 * `URL` löst `//host`, `/\host`, Schema und Steuerzeichen auf; was die Origin wechselt, fällt durch.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/'
  try {
    const url = new URL(next, window.location.origin)
    // `/.//host` wird zu `//host` aufgelöst: Router würde es als Host-Ziel lesen
    if (url.origin !== window.location.origin || url.pathname.startsWith('//') || url.pathname.startsWith('/anmelden')) return '/'
    return url.pathname + url.search + url.hash
  } catch {
    return '/'
  }
}


export function rememberNext(next: string): void {
  try {
    localStorage.setItem(NEXT_KEY, JSON.stringify({ path: safeNext(next), until: Date.now() + NEXT_TTL_MS }))
  } catch {
    // Speicher gesperrt: der Rücksprung entfällt, die Anmeldung gilt trotzdem
  }
}

/** Liefert das gemerkte Ziel einmalig (und löscht es); abgelaufen oder ungültig ergibt `/`. */
export function takeNext(): string {
  try {
    const raw = localStorage.getItem(NEXT_KEY)
    localStorage.removeItem(NEXT_KEY)
    const stored: unknown = JSON.parse(raw ?? 'null')
    if (typeof stored === 'object' && stored !== null && 'path' in stored && 'until' in stored && typeof stored.path === 'string' && typeof stored.until === 'number' && stored.until > Date.now())
      return safeNext(stored.path)
  } catch {
    // fehlender oder kaputter Eintrag
  }
  return '/'
}
