import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('../../src/lib/supabase', () => ({ supabase: { auth } }))
const clearAllPhotos = vi.hoisted(() => vi.fn())
vi.mock('../../src/lib/photos', () => ({ clearAllPhotos }))
// Das Widget gibt es im Unit-Test nicht: nur `getCaptchaToken` ist ersetzt, `CaptchaError` bleibt die echte Klasse.
const getCaptchaToken = vi.hoisted(() => vi.fn())
vi.mock('../../src/lib/turnstile', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../src/lib/turnstile')>()), getCaptchaToken }))

import { AuthRetryableFetchError } from '@supabase/supabase-js'
import { CaptchaError } from '../../src/lib/turnstile.ts'
import { AuthError, digitsOnly, rememberNext, requestSignIn, safeNext, signInWithApple, signOut, takeNext, verifyCode, verifyLink } from '../../src/lib/auth.ts'

describe('Abmelden (s9i-4)', () => {
  beforeEach(() => clearAllPhotos.mockReset())

  it('Standard: global abmelden, Fotos im Speicher leeren', async () => {
    auth.signOut.mockReset().mockResolvedValue({ error: null })
    await signOut()
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(auth.signOut).toHaveBeenCalledWith()
    expect(clearAllPhotos).toHaveBeenCalledTimes(1)
  })

  it('nach dem Löschen nur lokal (Sitzungen sind am Server schon weg), Fotos leeren', async () => {
    auth.signOut.mockReset().mockResolvedValue({ error: null })
    await signOut('local')
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(clearAllPhotos).toHaveBeenCalledTimes(1)
  })
})

beforeEach(() => {
  vi.stubGlobal('window', { location: { origin: 'https://app.test' } })
  for (const fn of Object.values(auth)) fn.mockReset().mockResolvedValue({ error: null })
  let n = 0
  getCaptchaToken.mockReset().mockImplementation(async () => `cap-${++n}`)
})

const kind = async (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof AuthError ? e.kind : 'other'))

describe('Anmeldung per E-Mail-Link und Code', () => {
  it('requestSignIn: Mail mit Rückkehr auf /anmelden, Konto entsteht erst jetzt', async () => {
    await requestSignIn('  kunde@example.at ')
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'kunde@example.at', options: { shouldCreateUser: true, emailRedirectTo: 'https://app.test/anmelden', captchaToken: 'cap-1' } })
  })

  it('ungültige Adresse wird nicht gesendet und verbraucht keine Prüfung', async () => {
    expect(await kind(requestSignIn('kein-at'))).toBe('invalid_email')
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
    expect(getCaptchaToken).not.toHaveBeenCalled()
  })

  it('jede Anforderung (auch „erneut senden“) holt ein eigenes Token', async () => {
    await requestSignIn('a@b.at')
    await requestSignIn('a@b.at')
    expect(auth.signInWithOtp.mock.calls.map((c) => (c[0] as { options: { captchaToken: string } }).options.captchaToken)).toEqual(['cap-1', 'cap-2'])
  })

  it('Captcha: Fehler der Prüfung vor der Anfrage, ohne Aufruf bei Auth', async () => {
    getCaptchaToken.mockRejectedValueOnce(new CaptchaError('offline'))
    expect(await kind(requestSignIn('a@b.at'))).toBe('offline')
    getCaptchaToken.mockRejectedValueOnce(new CaptchaError('failed'))
    expect(await kind(requestSignIn('a@b.at'))).toBe('captcha')
    getCaptchaToken.mockRejectedValueOnce(new CaptchaError('unavailable'))
    expect(await kind(requestSignIn('a@b.at'))).toBe('unavailable')
    getCaptchaToken.mockRejectedValueOnce(new Error('unerwartet'))
    expect(await kind(requestSignIn('a@b.at'))).toBe('unavailable')
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('Captcha: abgelehntes Token (captcha_failed) heißt captcha, nie unavailable; kein Wiederholversuch', async () => {
    for (const status of [400, 422]) {
      auth.signInWithOtp.mockResolvedValueOnce({ error: { status, code: 'captcha_failed' } })
      expect(await kind(requestSignIn('a@b.at'))).toBe('captcha')
    }
    expect(auth.signInWithOtp).toHaveBeenCalledTimes(2)
    expect(getCaptchaToken).toHaveBeenCalledTimes(2)
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
  it.each([
    'https://evil.com', '//evil.com', '/\\evil.com', '\\/evil.com', '/\t/evil.com', '/a\nb', '/a\rb', 'javascript:alert(1)', 'data:', 'data:text/html,x', 'evil.com', '',
    null, undefined, '/anmelden', '/anmelden?next=/', '/.//evil.com', '/a/..//evil.com', '/%2e%2e//evil.com', '/.\\/evil.com', ' /x', '/anmelden/', '/Anmelden', '/%61nmelden', '/%zz', '/%E0%A4%A',
    '/a\x7fb', '/a\x00b', '/\\/evil.com', '/x/../anmelden', '/%2e%2e/anmelden', '/anmelden%2F', '/anmelden#x', '/ANMELDEN',
  ])('safeNext verwirft %j', (bad) => {
    expect(safeNext(bad)).toBe('/')
  })

  // bleiben Pfade auf der eigenen Origin, keine Host-Ziele
  it.each(['/auftraege', '/profil?x=1#a', '/profil/a?x=1&y=2#b', '/%2F%2Fevil.com', '/%5Cevil.com', '/?//evil.com', '/#//evil.com'])('safeNext lässt %j unverändert', (ok) => {
    expect(safeNext(ok)).toBe(ok)
  })

  it('safeNext kodiert Fullwidth-Schrägstrich', () => {
    expect(safeNext('/／evil.com')).toBe('/%EF%BC%8Fevil.com')
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
    for (const raw of ['{', '{"path":5,"until":9999999999999}', '{"path":"/profil"}']) {
      store.set('movenow.next', raw)
      expect(takeNext(), raw).toBe('/')
    }
    vi.useRealTimers()
  })
})
