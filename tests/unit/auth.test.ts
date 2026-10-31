import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('../../src/lib/supabase', () => ({ supabase: { auth } }))

import { AuthRetryableFetchError } from '@supabase/supabase-js'
import { AuthError, digitsOnly, rememberNext, requestSignIn, safeNext, signInWithApple, takeNext, verifyCode, verifyLink } from '../../src/lib/auth.ts'

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

  it('Code-Länge: 5 und 11 Ziffern, Buchstaben und Mischformen werden nicht gesendet', async () => {
    for (const bad of ['12345', '12345678901', 'abcdefgh', '1234ab78', '12-34-56', '']) expect(await kind(verifyCode('a@b.at', bad))).toBe('invalid_code')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
    for (const good of ['123456', '12345678', '1234567890', ' 1234 5678 ']) expect(await kind(verifyCode('a@b.at', good))).toBeNull()
    expect(auth.verifyOtp).toHaveBeenCalledTimes(4)
  })

  it('digitsOnly: Einfügen filtert auf höchstens 10 Ziffern', () => {
    expect(digitsOnly('12 34-56\n78')).toBe('12345678')
    expect(digitsOnly('abc')).toBe('')
    expect(digitsOnly('123456789012')).toBe('1234567890')
  })

  it('Fehler nach Code: 429, offline, Dienst gestört, Eingabefehler', async () => {
    auth.verifyOtp.mockResolvedValueOnce({ error: { status: 429, code: 'over_request_rate_limit' } })
    expect(await kind(verifyCode('a@b.at', '12345678'))).toBe('rate_limited')
    auth.verifyOtp.mockResolvedValueOnce({ error: { status: 403, code: 'otp_expired' } })
    expect(await kind(verifyCode('a@b.at', '12345678'))).toBe('invalid_code')
    auth.verifyOtp.mockResolvedValueOnce({ error: new AuthRetryableFetchError('Failed to fetch', 0) })
    expect(await kind(verifyCode('a@b.at', '12345678'))).toBe('offline')
    auth.verifyOtp.mockResolvedValueOnce({ error: new AuthRetryableFetchError('x', 502) })
    expect(await kind(verifyCode('a@b.at', '12345678'))).toBe('unavailable')
    auth.signInWithOtp.mockResolvedValueOnce({ error: { status: 400, code: 'email_address_invalid' } })
    expect(await kind(requestSignIn('a@b.at'))).toBe('invalid_email')
    auth.signInWithOtp.mockResolvedValueOnce({ error: { status: 429, code: 'over_email_send_rate_limit' } })
    expect(await kind(requestSignIn('a@b.at'))).toBe('rate_limited')
  })

  it('Fehlertext enthält nie Token oder Dienstmeldung', async () => {
    auth.verifyOtp.mockResolvedValueOnce({ error: { status: 403, code: 'otp_expired', message: 'Token abc12345 has expired' } })
    const e = await verifyLink('abc12345xyz').catch((x: unknown) => x)
    expect(e).toBeInstanceOf(AuthError)
    expect(String((e as AuthError).message)).not.toContain('abc12345')
  })

  it('Apple-Anmeldung vorbereitet: OAuth mit Rückkehr auf /anmelden', async () => {
    await signInWithApple()
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'apple', options: { redirectTo: 'https://app.test/anmelden' } })
  })
})

describe('Rücksprung nach der Anmeldung', () => {
  it('safeNext: nur interne Pfade', () => {
    expect(safeNext('/auftraege')).toBe('/auftraege')
    expect(safeNext('/profil?x=1#a')).toBe('/profil?x=1#a')
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', '/\t/evil.com', 'javascript:alert(1)', 'evil.com', '', null, undefined, '/anmelden', '/anmelden?next=/', 'data:text/html,x', '/.//evil.com', '/a/..//evil.com']) expect(safeNext(bad)).toBe('/')
    expect(safeNext('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com') // bleibt ein Pfad auf der eigenen Origin
  })

  it('rememberNext/takeNext: einmalig, 15 Minuten, nur gültige Ziele', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
    vi.useFakeTimers()
    rememberNext('/auftraege')
    expect(takeNext()).toBe('/auftraege')
    expect(takeNext()).toBe('/')
    rememberNext('//evil.com')
    expect(takeNext()).toBe('/')
    rememberNext('/profil')
    vi.advanceTimersByTime(15 * 60 * 1000 + 1)
    expect(takeNext()).toBe('/')
    store.set('movenow.next', '{"path":"https://evil.com","until":9999999999999}')
    expect(takeNext()).toBe('/')
    vi.useRealTimers()
  })
})
