import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type AuthErrorKind = 'invalid_email' | 'invalid_code' | 'rate_limited' | 'unavailable'

export class AuthError extends Error {
  constructor(readonly kind: AuthErrorKind) {
    super(kind)
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Die Länge stellt das Supabase-Projekt ein (6 bis 10 Ziffern; das Dev-Projekt sendet 8)
const CODE = /^\d{6,10}$/
const HASH = /^[\w-]{8,200}$/
const returnUrl = () => `${window.location.origin}/anmelden`

const failure = (status: number | undefined): AuthError => new AuthError(status === 429 ? 'rate_limited' : 'unavailable')

/**
 * Schickt eine Mail mit Link und Code. Das Konto entsteht erst mit der ersten Anmeldung (beim Absenden einer Anfrage).
 * Der Link trägt einen `token_hash` und funktioniert in jedem Browser (`verifyLink`); der Code aus derselben Mail ist der Weg für die App selbst.
 */
export async function requestSignIn(email: string): Promise<void> {
  const address = email.trim()
  if (!EMAIL.test(address)) throw new AuthError('invalid_email')
  const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true, emailRedirectTo: returnUrl() } })
  if (error) throw failure(error.status)
}

/** Meldet mit dem Code aus der Mail an (Ausweichweg, wenn der Link nicht im selben Browser öffnet). */
export async function verifyCode(email: string, code: string): Promise<void> {
  const token = code.replace(/\s/g, '')
  if (!EMAIL.test(email.trim())) throw new AuthError('invalid_email')
  if (!CODE.test(token)) throw new AuthError('invalid_code')
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'email' })
  if (error) throw error.status === 429 ? failure(429) : new AuthError(error.status && error.status >= 500 ? 'unavailable' : 'invalid_code')
}

/** Meldet mit dem `token_hash` aus dem Link der Mail an (Rückkehr auf `/anmelden`). */
export async function verifyLink(tokenHash: string): Promise<void> {
  if (!HASH.test(tokenHash)) throw new AuthError('invalid_code')
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
  if (error) throw error.status === 429 ? failure(429) : new AuthError(error.status && error.status >= 500 ? 'unavailable' : 'invalid_code')
}

// Vorbereitet für S10: wirkt erst, wenn der Apple-Anbieter im Supabase-Projekt eingerichtet ist (Apple Developer Programm).
export async function signInWithApple(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: returnUrl() } })
  if (error) throw failure(error.status)
}

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut()
  if (error) throw failure(error.status)
}

/** Aktuelle Sitzung: `undefined` solange sie noch geladen wird, `null` ohne Anmeldung. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    // meldet sofort den gespeicherten Zustand (INITIAL_SESSION) und danach jede Änderung
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}
