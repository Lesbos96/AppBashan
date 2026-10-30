import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('../../src/lib/supabase', () => ({ supabase: { auth } }))

import { AuthError, requestSignIn, signInWithApple, verifyCode, verifyLink } from '../../src/lib/auth.ts'

beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: 'https://app.test' } })
  for (const fn of Object.values(auth)) fn.mockReset().mockResolvedValue({ error: null })
})

const kind = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof AuthError ? e.kind : 'other'))

describe('Anmeldung per E-Mail-Link und Code', () => {
  it('requestSignIn: Mail mit Rückkehr auf /anmelden, Konto entsteht erst jetzt', async () => {
    await requestSignIn('  kunde@example.at ')
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'kunde@example.at', options: { shouldCreateUser: true, emailRedirectTo: 'https://app.test/anmelden' } })
  })

  it('ungültige Adresse wird nicht gesendet', async () => {
    expect(await kind(requestSignIn('kein-at'))).toBe('invalid_email')
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('Fehler des Dienstes: 429 → rate_limited, sonst unavailable', async () => {
    auth.signInWithOtp.mockResolvedValueOnce({ error: { status: 429 } })
    expect(await kind(requestSignIn('a@b.at'))).toBe('rate_limited')
    auth.signInWithOtp.mockResolvedValueOnce({ error: { status: 500 } })
    expect(await kind(requestSignIn('a@b.at'))).toBe('unavailable')
  })

  it('verifyCode: 6 bis 10 Ziffern (Leerzeichen erlaubt), Typ email', async () => {
    await verifyCode('a@b.at', '123 456')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'a@b.at', token: '123456', type: 'email' })
    expect(await kind(verifyCode('a@b.at', '12345'))).toBe('invalid_code')
    expect(await kind(verifyCode('a@b.at', 'abcdef'))).toBe('invalid_code')
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1)
  })

  it('falscher Code → invalid_code, Dienst gestört → unavailable', async () => {
    auth.verifyOtp.mockResolvedValueOnce({ error: { status: 403 } })
    expect(await kind(verifyCode('a@b.at', '123456'))).toBe('invalid_code')
    auth.verifyOtp.mockResolvedValueOnce({ error: { status: 503 } })
    expect(await kind(verifyCode('a@b.at', '123456'))).toBe('unavailable')
  })

  it('verifyLink: token_hash aus dem Link, Typ email', async () => {
    await verifyLink('abc123_DEF-456')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc123_DEF-456', type: 'email' })
    expect(await kind(verifyLink('x'))).toBe('invalid_code')
    expect(await kind(verifyLink('<script>alert(1)</script>'))).toBe('invalid_code')
  })

  it('Apple-Anmeldung vorbereitet: OAuth mit Rückkehr auf /anmelden', async () => {
    await signInWithApple()
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'apple', options: { redirectTo: 'https://app.test/anmelden' } })
  })
})
