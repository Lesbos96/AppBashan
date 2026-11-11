import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { confirmCode, digitsOnly6, loadMfaState, MfaError, mfaErrorText, startEnrollment } from '../../src/lib/mfa'

const mfa = {
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
}
vi.mock('../../src/lib/supabase', () => ({ supabase: { auth: { mfa: new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => (mfa as Record<string, (...x: unknown[]) => unknown>)[k]!(...a) }) } } }))

const factor = (id: string, status: 'verified' | 'unverified') => ({ id, status, factor_type: 'totp', friendly_name: 'MoveNow' })
const factors = (...all: ReturnType<typeof factor>[]) => ({ data: { all, totp: all.filter((f) => f.status === 'verified') }, error: null })
const api = (status: number, code: string) => new AuthApiError('RAW_SUPABASE_TEXT', status, code)

beforeEach(() => Object.values(mfa).forEach((f) => f.mockReset()))

describe('loadMfaState: Schranke aus Token und Faktoren, nie aus Fehlern', () => {
  it('aal2 im Token: fertig, keine weitere Abfrage', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2', nextLevel: 'aal2' }, error: null })
    await expect(loadMfaState()).resolves.toEqual({ step: 'done' })
    expect(mfa.listFactors).not.toHaveBeenCalled()
  })

  it('aal1 mit verifiziertem Faktor: Code-Abfrage für genau diesen Faktor', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null })
    mfa.listFactors.mockResolvedValue(factors(factor('u1', 'unverified'), factor('v1', 'verified')))
    await expect(loadMfaState()).resolves.toEqual({ step: 'challenge', factorId: 'v1' })
  })

  it('aal1 ohne verifizierten Faktor (auch mit liegengebliebenem unverifiziertem): Einrichtung', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })
    mfa.listFactors.mockResolvedValue(factors(factor('u1', 'unverified')))
    await expect(loadMfaState()).resolves.toEqual({ step: 'enroll' })
  })

  it('ohne Sitzung (currentLevel null) und bei Fehlern wird geworfen, nie still „Einrichtung“', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: null, nextLevel: null }, error: null })
    await expect(loadMfaState()).rejects.toBeInstanceOf(MfaError)
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null })
    mfa.listFactors.mockResolvedValue({ data: null, error: api(500, 'unexpected_failure') })
    await expect(loadMfaState()).rejects.toMatchObject({ kind: 'unavailable' })
  })
})

describe('startEnrollment: liegengebliebene Einrichtung wird ersetzt', () => {
  const enrolled = { data: { id: 'f2', type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf8,QR', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://x' } }, error: null }

  it('entfernt alle unverifizierten Faktoren, dann enroll mit festem Namen und Aussteller', async () => {
    mfa.listFactors.mockResolvedValue(factors(factor('u1', 'unverified'), factor('u2', 'unverified')))
    mfa.unenroll.mockResolvedValue({ data: {}, error: null })
    mfa.enroll.mockResolvedValue(enrolled)
    await expect(startEnrollment()).resolves.toEqual({ factorId: 'f2', qr: 'data:image/svg+xml;utf8,QR', secret: 'JBSWY3DPEHPK3PXP' })
    expect(mfa.unenroll.mock.calls).toEqual([[{ factorId: 'u1' }], [{ factorId: 'u2' }]])
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'MoveNow', issuer: 'MoveNow' })
  })

  it('fasst einen verifizierten Faktor nie an: Abbruch mit insufficient_aal, kein unenroll, kein enroll', async () => {
    mfa.listFactors.mockResolvedValue(factors(factor('v1', 'verified'), factor('u1', 'unverified')))
    await expect(startEnrollment()).rejects.toMatchObject({ kind: 'insufficient_aal' })
    expect(mfa.unenroll).not.toHaveBeenCalled()
    expect(mfa.enroll).not.toHaveBeenCalled()
  })

  it('scheitert das Aufräumen, wird trotzdem eingerichtet; der Namenskonflikt ist ein normaler Fehler', async () => {
    mfa.listFactors.mockResolvedValue(factors(factor('u1', 'unverified')))
    mfa.unenroll.mockResolvedValue({ data: null, error: api(500, 'unexpected_failure') })
    mfa.enroll.mockResolvedValue({ data: null, error: api(422, 'mfa_factor_name_conflict') })
    await expect(startEnrollment()).rejects.toMatchObject({ kind: 'unavailable' })
    expect(mfa.enroll).toHaveBeenCalledTimes(1)
  })

  it('enroll bei aal1 mit Faktor des anderen Geräts: insufficient_aal', async () => {
    mfa.listFactors.mockResolvedValue(factors())
    mfa.enroll.mockResolvedValue({ data: null, error: api(403, 'insufficient_aal') })
    await expect(startEnrollment()).rejects.toMatchObject({ kind: 'insufficient_aal' })
  })

  it('unvollständige Antwort ist ein Fehler', async () => {
    mfa.listFactors.mockResolvedValue(factors())
    mfa.enroll.mockResolvedValue({ data: { id: 'f2', type: 'totp', totp: { qr_code: '', secret: '' } }, error: null })
    await expect(startEnrollment()).rejects.toMatchObject({ kind: 'unavailable' })
  })
})

describe('confirmCode', () => {
  beforeEach(() => mfa.challenge.mockResolvedValue({ data: { id: 'ch1' }, error: null }))

  it('legt je Versuch ein neues Challenge an und sendet nur Ziffern', async () => {
    mfa.verify.mockResolvedValue({ data: { access_token: 'x' }, error: null })
    await confirmCode('f1', '123 456')
    expect(mfa.challenge).toHaveBeenCalledWith({ factorId: 'f1' })
    expect(mfa.verify).toHaveBeenCalledWith({ factorId: 'f1', challengeId: 'ch1', code: '123456' })
  })

  it('Format wird vor dem Aufruf geprüft (sechs Ziffern)', async () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34']) {
      await expect(confirmCode('f1', bad)).rejects.toMatchObject({ kind: 'invalid_code' })
    }
    expect(mfa.challenge).not.toHaveBeenCalled()
  })

  it.each([
    [api(422, 'mfa_verification_failed'), 'wrong_code'],
    [api(429, 'over_request_rate_limit'), 'rate_limited'],
    [api(403, 'insufficient_aal'), 'insufficient_aal'],
    [api(404, 'mfa_factor_not_found'), 'factor_gone'],
    [api(401, 'no_authorization'), 'unavailable'],
    [new AuthRetryableFetchError('Failed to fetch', 0), 'offline'],
    [api(500, 'unexpected_failure'), 'unavailable'],
  ])('verify-Fehler %# wird %s', async (error, kind) => {
    mfa.verify.mockResolvedValue({ data: null, error })
    await expect(confirmCode('f1', '123456')).rejects.toMatchObject({ kind })
  })

  it('Fehler schon beim Challenge wird gleich zugeordnet', async () => {
    mfa.challenge.mockResolvedValue({ data: null, error: api(404, 'mfa_factor_not_found') })
    await expect(confirmCode('f1', '123456')).rejects.toMatchObject({ kind: 'factor_gone' })
    expect(mfa.verify).not.toHaveBeenCalled()
  })
})

describe('Texte', () => {
  it('jede Fehlerart hat einen Text, der nie den Rohtext des Dienstes enthält', () => {
    for (const text of Object.values(mfaErrorText)) {
      expect(text.length).toBeGreaterThan(10)
      expect(text).not.toMatch(/RAW_SUPABASE|Gebühr|Provision|15 ?%/)
    }
  })

  it('digitsOnly6 lässt nur sechs Ziffern zu', () => {
    expect(digitsOnly6('12 34-56 78')).toBe('123456')
    expect(digitsOnly6('abc')).toBe('')
  })
})
