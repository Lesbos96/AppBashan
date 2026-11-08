// aal2 mit echten TOTP-Token gegen PostgREST (S9b-3). Ist TOTP im Dev-Projekt nicht aktiv (Dashboard Auth → MFA,
// config.toml enroll_enabled/verify_enabled), werden die Tests mit dem Grund übersprungen (docs/AUTOPILOT.md).
import { afterAll, describe, expect, it } from 'vitest'
import { deleteUsers, must } from '../support/db.ts'
import { ownerGrantRole, ownerSql } from '../support/owner.ts'
import { ownerDeletePartner } from '../support/partner.ts'
import { jwtAal, tryAal2User, type Aal2User } from '../support/totp.ts'

const probe = await tryAal2User('mfa-probe')
const reason = 'reason' in probe ? probe.reason : null
if (reason) console.warn(`partner-mfa: TOTP nicht nutzbar, Tests übersprungen (${reason})`)
const firms: string[] = []

afterAll(async () => {
  try {
    for (const id of firms) ownerDeletePartner(id)
  } finally {
    await deleteUsers()
  }
})

const reg = {
  p_name: `mvtest-mfa-${Date.now().toString(36)} GmbH`, p_legal_form: 'gmbh', p_uid: 'ATU12345678', p_small_business: false, p_street: 'Teststraße 1',
  p_postcode: '1010', p_city: 'Wien', p_contact_name: 'Max Test', p_contact_phone: '+43 660 1234567', p_contact_email: 'firma@movenow.test',
  p_districts: [1], p_terms_version: 'partner-2026-11-entwurf',
}

describe.skipIf(reason !== null)('aal2 mit echten Token', () => {
  const partner = 'user' in probe ? probe.user : (undefined as unknown as Aal2User)

  it('Konto ohne Faktor: aal1; nach verify: aal2', () => {
    expect(jwtAal(partner.jwt1)).toBe('aal1')
    expect(jwtAal(partner.jwt2)).toBe('aal2')
  })

  it('Partner-Mitglied: Satz nur mit aal2, Firmendaten schon mit aal1; Kunde mit aal2 ohne Firma liest keinen Satz', async () => {
    const id = must(await partner.aal1.rpc('register_partner', reg)) as unknown as string
    firms.push(id)
    expect(must(await partner.aal1.from('partners').select('id')).map((r) => r.id)).toEqual([id])
    expect(must(await partner.aal1.from('platform_settings').select('key').in('key', ['fee_rate', 'fee_vat_rate']))).toEqual([])
    const keys = must(await partner.aal2.from('platform_settings').select('key').in('key', ['fee_rate', 'fee_vat_rate'])).map((r) => r.key)
    expect(keys).toEqual(expect.arrayContaining(['fee_rate', 'fee_vat_rate']))
    expect(must(await partner.aal2.from('platform_settings').select('key').eq('key', 'fee_notice_days'))).toEqual([])
    const want = ownerSql('select fee_rate::float8 as r, fee_vat_rate::float8 as v from public.current_fee_rates')[0]
    expect(must(await partner.aal2.from('current_fee_rates').select('*').single())).toMatchObject({ fee_rate: want?.r, fee_vat_rate: want?.v })
    expect(want?.r).toBeGreaterThan(0)
    expect(must(await partner.aal1.from('current_fee_rates').select('*').single())).toMatchObject({ fee_rate: null })
    // Kunde mit echtem aal2 ohne Firma
    const cust = await tryAal2User('mfa-cust')
    if ('reason' in cust) throw new Error(cust.reason)
    expect(must(await cust.user.aal2.from('platform_settings').select('key'))).toEqual([])
    expect(must(await cust.user.aal2.from('current_fee_rates').select('*').single())).toMatchObject({ fee_rate: null })
  }, 60_000)

  it('Admin: aal1 sieht keine Firmen, aal2 schon', async () => {
    const adm = await tryAal2User('mfa-admin')
    if ('reason' in adm) throw new Error(adm.reason)
    ownerGrantRole(adm.user.id, 'admin')
    expect(must(await adm.user.aal1.from('partners').select('id'))).toEqual([])
    const firmId = firms[0]
    expect(firmId).toBeDefined()
    expect(must(await adm.user.aal1.from('partners').select('id').eq('id', firmId!))).toEqual([])
    expect(must(await adm.user.aal2.from('partners').select('id').eq('id', firmId!)).map((r) => r.id)).toEqual([firmId])
  }, 60_000)

  it('Partner-Mitglied: Dokumentzeile nur mit aal2', async () => {
    // Partner setzen nur id und kind (Spalten-Grant); partner_id und storage_path ergänzt der Trigger
    const doc = { id: crypto.randomUUID(), kind: 'other' } as never
    expect((await partner.aal1.from('partner_documents').insert(doc)).error?.code).toBe('42501')
    expect((await partner.aal2.from('partner_documents').insert(doc)).error).toBeNull()
    expect(must(await partner.aal1.from('partner_documents').select('id'))).toHaveLength(1)
  }, 60_000)
})
