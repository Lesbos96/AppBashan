// aal2 mit echten TOTP-Token gegen PostgREST (S9b-3). Ist TOTP im Dev-Projekt nicht aktiv (Dashboard Auth → MFA,
// config.toml enroll_enabled/verify_enabled), werden die Tests mit dem Grund übersprungen (docs/AUTOPILOT.md).
import { afterAll, describe, expect, it } from 'vitest'
import { deleteUsers, must } from '../support/db.ts'
import { ownerGrantRole, ownerSql } from '../support/owner.ts'
import { FIRM_MAIL, ownerDeletePartner } from '../support/partner.ts'
import { jwtAal, tryAal2User, type Aal2User } from '../support/totp.ts'

const probe = await tryAal2User('mfa-probe')
const reason = 'reason' in probe ? probe.reason : null
if (reason) console.warn(`partner-mfa: TOTP nicht nutzbar, Tests übersprungen (${reason})`)
const firms: string[] = []
let adminId = ''

afterAll(async () => {
  try {
    for (const id of firms) ownerDeletePartner(id)
  } finally {
    await deleteUsers()
  }
})

const reg = {
  p_name: `mvtest-mfa-${Date.now().toString(36)} GmbH`, p_legal_form: 'gmbh', p_uid: 'ATU12345678', p_small_business: false, p_street: 'Teststraße 1',
  p_postcode: '1010', p_city: 'Wien', p_contact_name: 'Max Test', p_contact_phone: '+43 660 1234567', p_contact_email: FIRM_MAIL,
  p_districts: [1], p_terms_version: 'partner-2026-11-entwurf',
}

describe.skipIf(reason !== null)('aal2 mit echten Token', () => {
  const partner = 'user' in probe ? probe.user : (undefined as unknown as Aal2User)

  it('Konto ohne Faktor: aal1; nach verify: aal2', () => {
    expect(jwtAal(partner.jwt1)).toBe('aal1')
    expect(jwtAal(partner.jwt2)).toBe('aal2')
  })

  it('Partner-Mitglied: Staffel und USt.-Satz nur mit aal2, Firmendaten schon mit aal1; Kunde mit aal2 ohne Firma liest nichts', async () => {
    const id = must(await partner.aal1.rpc('register_partner', reg)) as unknown as string
    firms.push(id)
    expect(must(await partner.aal1.from('partners').select('id')).map((r) => r.id)).toEqual([id])
    // platform_settings: nur fee_vat_rate; der alte Satz fee_rate bleibt als Historie unsichtbar
    expect(must(await partner.aal1.from('platform_settings').select('key').in('key', ['fee_rate', 'fee_vat_rate']))).toEqual([])
    const keys = must(await partner.aal2.from('platform_settings').select('key').in('key', ['fee_rate', 'fee_vat_rate'])).map((r) => r.key)
    expect(new Set(keys)).toEqual(new Set(['fee_vat_rate']))
    expect(must(await partner.aal2.from('platform_settings').select('key').eq('key', 'fee_notice_days'))).toEqual([])
    // Staffel: aal2 ja, aal1 nein
    expect(must(await partner.aal2.from('fee_schedules').select('version')).length).toBeGreaterThan(0)
    expect(must(await partner.aal1.from('fee_schedules').select('version'))).toEqual([])
    // Vorschau „Du erhältst“ nur mit aal2
    const pay = await partner.aal2.rpc('payout_preview', { p_total: 100000 } as never)
    expect(pay.error).toBeNull()
    expect(Number(pay.data)).toBeGreaterThan(0)
    expect(Number(pay.data)).toBeLessThanOrEqual(100000)
    expect((await partner.aal1.rpc('payout_preview', { p_total: 100000 } as never)).error?.message).toBe('mfa_required')
    // Kunde mit echtem aal2 ohne Firma
    const cust = await tryAal2User('mfa-cust')
    if ('reason' in cust) throw new Error(cust.reason)
    expect(must(await cust.user.aal2.from('platform_settings').select('key'))).toEqual([])
    expect(must(await cust.user.aal2.from('fee_schedules').select('version'))).toEqual([])
    expect((await cust.user.aal2.rpc('payout_preview', { p_total: 100000 } as never)).error?.message).toBe('not_found')
  }, 60_000)

  it('Admin: aal1 sieht keine Firmen, aal2 schon', async () => {
    const adm = await tryAal2User('mfa-admin')
    if ('reason' in adm) throw new Error(adm.reason)
    ownerGrantRole(adm.user.id, 'admin')
    adminId = adm.user.id
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

  // S3-N6: Policy partners_update_contact (aal2 und Status pending/active/payment_hold). Zuletzt, weil der Test die Firma ablehnt.
  it('Partner-Mitglied: Kontakt ändern nur mit aal2, nur die drei Kontaktspalten, nicht nach Status rejected', async () => {
    const id = firms[0]!
    const contact = () => ownerSql(`select contact_name, contact_phone, contact_email, name, status::text as status from public.partners where id = '${id}'`)[0]
    const before = contact()
    const upd = (db: Aal2User['aal1'], patch: Record<string, string>) => db.from('partners').update(patch as never).eq('id', id).select('id')

    // aal1: die Policy blendet die Zeile aus, kein Fehler, keine betroffene Zeile, Wert unverändert
    const a1 = await upd(partner.aal1, { contact_name: 'Nur aal1' })
    expect(a1.error).toBeNull()
    expect(a1.data).toEqual([])
    expect(contact()).toEqual(before)

    // aal2: erlaubt, geändert wird genau die Spalte
    const a2 = await upd(partner.aal2, { contact_name: 'Mit aal2' })
    expect(a2.data?.map((r) => r.id)).toEqual([id])
    expect(contact()).toEqual({ ...before, contact_name: 'Mit aal2' })

    // Spalten ohne Grant: Name, Status, USt-IdNr. bleiben der Firma verwehrt (auch mit aal2)
    const forbidden: Record<string, string>[] = [{ name: 'Umbenannt' }, { status: 'active' }, { uid: 'ATU99999999' }]
    for (const patch of forbidden) {
      expect((await upd(partner.aal2, patch)).error?.code, JSON.stringify(patch)).toBe('42501')
    }
    expect(contact()).toEqual({ ...before, contact_name: 'Mit aal2' })

    // nach Ablehnung ist die Policy zu: aal2 ändert nichts mehr
    expect(adminId).not.toBe('')
    ownerSql(`select public.admin_set_partner_status('${adminId}', '${id}', 'rejected', 'Ablehnung im Test der Kontaktpolicy')`)
    const rejected = await upd(partner.aal2, { contact_name: 'Nach Ablehnung' })
    expect(rejected.error).toBeNull()
    expect(rejected.data).toEqual([])
    expect(contact()?.contact_name).toBe('Mit aal2')
  }, 60_000)
})
