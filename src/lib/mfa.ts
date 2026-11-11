import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { supabase } from './supabase'

/*
 * Zweiter Faktor (TOTP) für Partner-Konten. Die Schranke in der App ist nur Bedienführung; durchgesetzt wird aal2 in der Datenbank (RLS, Funktionen).
 * Verhalten des Servers (Probe gegen Dev, s9i-5b): `enroll` und `unenroll` eines verifizierten Faktors verlangen aal2, `unenroll` eines
 * unverifizierten nicht. Die App entfernt deshalb nur unverifizierte Faktoren (liegengebliebene Einrichtung) und fasst verifizierte nie an.
 */

export type MfaErrorKind = 'wrong_code' | 'invalid_code' | 'rate_limited' | 'offline' | 'insufficient_aal' | 'factor_gone' | 'unavailable'

export class MfaError extends Error {
  constructor(readonly kind: MfaErrorKind) {
    super(kind)
  }
}

export const mfaErrorText: Record<MfaErrorKind, string> = {
  wrong_code: 'Der Code stimmt nicht. Prüfe die Uhrzeit deines Geräts und versuche es erneut.',
  invalid_code: 'Gib den Code mit sechs Ziffern ein.',
  rate_limited: 'Zu viele Versuche. Warte kurz und versuche es dann noch einmal.',
  offline: 'Keine Verbindung. Prüfe dein Netz und versuche es erneut.',
  insufficient_aal: 'Für dieses Konto gibt es schon einen Faktor. Gib den Code deiner Authenticator-App ein.',
  factor_gone: 'Diese Einrichtung gibt es nicht mehr. Starte sie noch einmal.',
  unavailable: 'Das hat nicht geklappt. Versuche es gleich noch einmal.',
}

type Failure = { status?: number; code?: string }

function kindOf(error: Failure): MfaErrorKind {
  if (error.status === 429 || error.code === 'over_request_rate_limit') return 'rate_limited'
  if (error.code === 'mfa_verification_failed') return 'wrong_code'
  if (error.code === 'insufficient_aal') return 'insufficient_aal'
  if (error.code === 'mfa_factor_not_found') return 'factor_gone'
  if (isAuthRetryableFetchError(error) && !error.status) return 'offline'
  return 'unavailable'
}

/** Nur Ziffern, höchstens sechs: für das Codefeld (Einfügen mit Leerzeichen). */
export const digitsOnly6 = (raw: string) => raw.replace(/\D/g, '').slice(0, 6)

export type MfaState = { step: 'done' } | { step: 'challenge'; factorId: string } | { step: 'enroll' }

/** Wo steht die Sitzung: aal2 im Token → fertig; sonst verifizierter Faktor → Code-Abfrage; sonst Einrichtung. Fehler werfen, nie still „Einrichtung“. */
export async function loadMfaState(): Promise<MfaState> {
  const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !aal.currentLevel) throw new MfaError(error ? kindOf(error) : 'unavailable')
  if (aal.currentLevel === 'aal2') return { step: 'done' }
  const { data, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) throw new MfaError(kindOf(listError))
  const verified = data.totp[0]
  return verified ? { step: 'challenge', factorId: verified.id } : { step: 'enroll' }
}

export type Enrollment = { factorId: string; qr: string; secret: string }

/**
 * Beginnt die Einrichtung. Ein liegengebliebener unverifizierter Faktor würde den Namen blockieren (`mfa_factor_name_conflict`): er wird vorher entfernt.
 * Gibt es schon einen verifizierten, bricht die Einrichtung ab (`insufficient_aal`); die Oberfläche fragt dann den Code ab.
 * QR und Schlüssel gehören nur dem Aufrufer (Komponentenzustand): kein Speichern, kein Loggen.
 */
export async function startEnrollment(): Promise<Enrollment> {
  const { data: list, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) throw new MfaError(kindOf(listError))
  if (list.totp.length > 0) throw new MfaError('insufficient_aal')
  // Scheitert das Aufräumen, folgt trotzdem der Versuch: ein Namenskonflikt ist dann ein normaler Fehler
  for (const f of list.all.filter((x) => x.status === 'unverified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'MoveNow', issuer: 'MoveNow' })
  if (error) throw new MfaError(kindOf(error))
  if (!data.id || !data.totp.qr_code || !data.totp.secret) throw new MfaError('unavailable')
  // supabase-js setzt `data:image/svg+xml;utf-8,` vor den Rohtext des SVG; neu verpackt hängt die Darstellung nicht an dessen Zeichen (z. B. `#`)
  const svg = data.totp.qr_code.replace(/^data:image\/svg\+xml;utf-8,/, '')
  return { factorId: data.id, qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, secret: data.totp.secret }
}

/** Challenge und Bestätigung in einem Schritt (je Versuch ein neues Challenge). Danach trägt die Sitzung aal2. */
export async function confirmCode(factorId: string, raw: string): Promise<void> {
  const code = raw.replace(/\s/g, '')
  if (!/^\d{6}$/.test(code)) throw new MfaError('invalid_code')
  const challenge = await supabase.auth.mfa.challenge({ factorId })
  if (challenge.error) throw new MfaError(kindOf(challenge.error))
  const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.data.id, code })
  if (error) throw new MfaError(kindOf(error))
}
