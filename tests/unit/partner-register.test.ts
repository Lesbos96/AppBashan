import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyForm, loadPartner, PartnerError, partnerErrorText, registerPartner, statusInfo, TERMS_VERSION, toArgs, validate, type PartnerForm } from '../../src/lib/partner'

const rpc = vi.fn()
const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (...a: unknown[]) => from(...(a as [])) } }))

const valid: PartnerForm = {
  name: 'Transporte Huber GmbH',
  legalForm: 'gmbh',
  smallBusiness: false,
  uid: 'ATU12345678',
  street: 'Teststraße 1',
  postcode: '1010',
  city: 'Wien',
  contactName: 'Max Huber',
  phone: '+43 660 1234567',
  email: 'firma@beispiel.at',
  districts: [3, 1],
  terms: true,
}

beforeEach(() => {
  for (const m of [rpc, maybeSingle, eq, select, from]) m.mockClear()
})

describe('validate (Partner-Registrierung)', () => {
  it('gültige Angaben: keine Fehler', () => {
    expect(validate(valid)).toEqual({})
  })

  it('leeres Formular: jede Pflichtangabe hat einen Text', () => {
    const errors = validate(emptyForm)
    expect(Object.keys(errors).sort()).toEqual(['city', 'contactName', 'districts', 'email', 'name', 'phone', 'postcode', 'street', 'terms', 'uid'])
    for (const text of Object.values(errors)) expect(text.length).toBeGreaterThan(5)
  })

  it('Rechtsform hat einen Standardwert aus der Serverliste', () => {
    expect(['einzelunternehmen', 'eu', 'gmbh', 'og', 'kg', 'sonstige']).toContain(emptyForm.legalForm)
  })

  it.each([
    ['name', 'A'],
    ['name', 'x'.repeat(121)],
    ['street', 'S'],
    ['city', 'W'],
    ['contactName', 'M'],
    ['phone', '1234'],
    ['email', 'ohne-at'],
    ['email', '@beispiel.at'],
    ['email', 'a@'],
    ['postcode', '101'],
    ['postcode', 'abcd'],
    ['postcode', '10100'],
  ] as const)('%s = %j wird abgelehnt', (key, value) => {
    expect(validate({ ...valid, [key]: value })).toHaveProperty(key)
  })

  it('UID: Pflicht ohne Kleinunternehmer, Format ATU + 8 Ziffern, getrimmt und ohne Groß-/Kleinschreibung', () => {
    expect(validate({ ...valid, uid: '' })).toHaveProperty('uid')
    expect(validate({ ...valid, uid: 'ATU123' })).toHaveProperty('uid')
    expect(validate({ ...valid, uid: 'DE12345678' })).toHaveProperty('uid')
    expect(validate({ ...valid, uid: ' atu12345678 ' })).toEqual({})
  })

  it('Kleinunternehmer: UID darf fehlen, eine eingegebene UID muss trotzdem stimmen', () => {
    expect(validate({ ...valid, smallBusiness: true, uid: '' })).toEqual({})
    expect(validate({ ...valid, smallBusiness: true, uid: 'ATU1' })).toHaveProperty('uid')
  })

  it('Bezirke: mindestens einer, nur 1 bis 23', () => {
    expect(validate({ ...valid, districts: [] })).toHaveProperty('districts')
    expect(validate({ ...valid, districts: [0] })).toHaveProperty('districts')
    expect(validate({ ...valid, districts: [24] })).toHaveProperty('districts')
    expect(validate({ ...valid, districts: [23] })).toEqual({})
  })

  it('Partnerbedingungen müssen angehakt sein', () => {
    expect(validate({ ...valid, terms: false })).toHaveProperty('terms')
  })

  it('Fehlertexte nennen keine Gebühr', () => {
    for (const text of Object.values(validate(emptyForm))) expect(text).not.toMatch(/Gebühr|Provision|15 ?%/)
  })
})

describe('toArgs', () => {
  it('genau die zwölf p_*-Schlüssel des Servers, Entwurfsversion der Bedingungen', () => {
    const args = toArgs(valid)
    expect(Object.keys(args).sort()).toEqual(
      ['p_city', 'p_contact_email', 'p_contact_name', 'p_contact_phone', 'p_districts', 'p_legal_form', 'p_name', 'p_postcode', 'p_small_business', 'p_street', 'p_terms_version', 'p_uid'].sort(),
    )
    expect(args.p_terms_version).toBe('partner-2026-11-entwurf')
    expect(TERMS_VERSION).toBe('partner-2026-11-entwurf')
  })

  it('trimmt, schreibt die UID groß, entdoppelt und sortiert die Bezirke', () => {
    const args = toArgs({ ...valid, name: '  Transporte Huber GmbH ', uid: ' atu12345678 ', districts: [3, 1, 3, 1, 22] })
    expect(args).toMatchObject({ p_name: 'Transporte Huber GmbH', p_uid: 'ATU12345678', p_districts: [1, 3, 22], p_small_business: false })
  })

  it('leere UID wird null, p_small_business ist immer boolean', () => {
    const args = toArgs({ ...valid, smallBusiness: true, uid: '   ' })
    expect(args.p_uid).toBeNull()
    expect(args.p_small_business).toBe(true)
    expect(typeof toArgs(valid).p_small_business).toBe('boolean')
  })
})

describe('registerPartner', () => {
  it('ruft register_partner mit den Argumenten und gibt die ID zurück', async () => {
    rpc.mockResolvedValue({ data: 'p-1', error: null, status: 200 })
    const args = toArgs(valid)
    await expect(registerPartner(args)).resolves.toBe('p-1')
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('register_partner', args)
  })

  it('Erfolg nur mit einer ID als Antwort', async () => {
    rpc.mockResolvedValue({ data: null, error: null, status: 200 })
    await expect(registerPartner(toArgs(valid))).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it.each([
    ['P0001', 'already_member', 400, 'already_member'],
    ['42501', 'not_customer', 403, 'not_customer'],
    ['42501', 'not_authenticated', 403, 'not_authenticated'],
    ['PGRST301', 'JWT expired', 401, 'not_authenticated'],
    ['P0001', 'scope_incomplete', 400, 'invalid_input'],
    ['23514', 'new row for relation "partners" violates check constraint', 400, 'invalid_input'],
    ['23505', 'duplicate key value violates unique constraint', 409, 'invalid_input'],
    ['XX000', 'etwas anderes', 500, 'unavailable'],
    ['P0001', 'unbekannter_code', 400, 'unavailable'],
  ])('Server %s %s (%i) wird %s', async (code, message, status, kind) => {
    rpc.mockResolvedValue({ data: null, error: { code, message, details: null, hint: null }, status })
    await expect(registerPartner(toArgs(valid))).rejects.toMatchObject({ kind })
  })

  it('Netzfehler (Status 0) ist offline', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '', message: 'TypeError: Failed to fetch', details: '', hint: '' }, status: 0 })
    await expect(registerPartner(toArgs(valid))).rejects.toMatchObject({ kind: 'offline' })
  })

  it('jede Fehlerart ist ein PartnerError mit eigenem Text ohne Gebührenhinweis', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'already_member' }, status: 400 })
    await expect(registerPartner(toArgs(valid))).rejects.toBeInstanceOf(PartnerError)
    expect(new Set(Object.values(partnerErrorText)).size).toBe(Object.keys(partnerErrorText).length)
    for (const text of Object.values(partnerErrorText)) {
      expect(text.length).toBeGreaterThan(10)
      expect(text).not.toMatch(/Gebühr|Provision|15 ?%/)
    }
    expect(partnerErrorText.not_customer).not.toBe(partnerErrorText.not_authenticated)
  })
})

describe('loadPartner', () => {
  it('liest die eigene Firma über die Mitgliedschaft des Kontos', async () => {
    const row = { id: 'p-1', name: 'Huber GmbH', status: 'pending', status_reason: null }
    maybeSingle.mockResolvedValue({ data: { partners: row }, error: null })
    await expect(loadPartner('u-1')).resolves.toEqual(row)
    expect(from).toHaveBeenCalledWith('partner_members')
    expect(select).toHaveBeenCalledWith('partners(id, name, status, status_reason)')
    expect(eq).toHaveBeenCalledWith('user_id', 'u-1')
  })

  it('ohne Mitgliedschaft: null', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expect(loadPartner('u-1')).resolves.toBeNull()
  })

  it('Lesefehler wird geworfen (kein stilles „keine Firma“, sonst käme das Registrierformular)', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(loadPartner('u-1')).rejects.toBeTruthy()
  })
})

describe('statusInfo', () => {
  it('jeder Status hat Titel und Text, ohne Geld- oder Gebührentext', () => {
    for (const s of ['pending', 'active', 'payment_hold', 'suspended', 'rejected'] as const) {
      const info = statusInfo[s]
      expect(info.label.length).toBeGreaterThan(2)
      expect(info.text.length).toBeGreaterThan(10)
      expect(`${info.label} ${info.text}`).not.toMatch(/Gebühr|Provision|15 ?%|€/)
    }
    expect(statusInfo.pending.label).toBe('In Prüfung')
    expect(statusInfo.active.label).toBe('Aktiv')
  })
})
