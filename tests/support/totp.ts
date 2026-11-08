// Echte TOTP-Sitzungen gegen Dev (S9b-3): Konto anlegen, Faktor einrichten, Code erzeugen, bestätigen -> Token mit aal2.
// Ist TOTP im Projekt nicht aktiv (Dashboard Auth → MFA), liefert `tryAal2User` den Grund statt eines Nutzers; die Tests überspringen dann.
import { createClient } from '@supabase/supabase-js'
import * as OTPAuth from 'otpauth'
import { deleteUsers, env, makeUser, pause, type Db, type TestUser } from './db.ts'

export type Aal2User = { id: string; aal1: Db; aal2: Db; jwt1: string; jwt2: string }

/** Client, der PostgREST mit genau diesem Token anspricht (der aal1-Token bleibt neben der aal2-Sitzung gültig). */
export const withToken = (jwt: string): Db =>
  createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  }) as unknown as Db

export const jwtAal = (jwt: string): string => (JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString()) as { aal: string }).aal

export async function tryAal2User(tag: string): Promise<{ user: Aal2User } | { reason: string }> {
  const base: TestUser = await makeUser(tag)
  const enroll = await base.db.auth.mfa.enroll({ factorType: 'totp', friendlyName: tag })
  if (enroll.error) {
    // Nur „TOTP im Projekt abgeschaltet“ überspringt die Tests; jeder andere Fehler (Rate-Limit, Regression) bricht sie ab.
    if (enroll.error.code !== 'mfa_totp_enroll_not_enabled') throw enroll.error
    await deleteUsers()
    return { reason: `${enroll.error.code}: ${enroll.error.message}` }
  }
  await pause()
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(enroll.data.totp.secret) })
  for (let attempt = 0; attempt < 2; attempt++) {
    const challenge = await base.db.auth.mfa.challenge({ factorId: enroll.data.id })
    if (challenge.error) throw challenge.error
    const verify = await base.db.auth.mfa.verify({ factorId: enroll.data.id, challengeId: challenge.data.id, code: totp.generate() })
    await pause()
    if (!verify.error) {
      return { user: { id: base.id, aal1: withToken(base.jwt), aal2: withToken(verify.data.access_token), jwt1: base.jwt, jwt2: verify.data.access_token } }
    }
    if (verify.error.code === 'mfa_totp_verify_not_enabled') {
      await deleteUsers()
      return { reason: `${verify.error.code}: ${verify.error.message}` }
    }
    if (attempt === 1) throw verify.error
  }
  return { reason: 'unerreichbar' }
}
