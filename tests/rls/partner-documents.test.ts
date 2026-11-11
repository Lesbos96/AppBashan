// S2-M2 (s9i-5b): Dokumenten-Upload mit echten aal2-Token über die echte Storage-API (nicht nur als SQL-Nachbildung wie in partner-admin.test.ts).
// Dort belegt: Policies, Spaltenrechte, Limit 5, Append-only. Hier: Ist-Wert im Bucket (Objekt liegt / liegt nicht), Typ und Größe, fremde Firma, Kunde.
// Ist TOTP im Dev-Projekt nicht aktiv, werden die Tests mit dem Grund übersprungen (wie partner-mfa.test.ts).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteUsers, makeUser, must, run, service } from '../support/db.ts'
import { ownerGrantRole, ownerSql } from '../support/owner.ts'
import { ownerDeletePartner } from '../support/partner.ts'
import { tryAal2User, withToken, type Aal2User } from '../support/totp.ts'

const BUCKET = 'partner-documents'
const PDF = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' })
// kleinste Bytefolge mit JPEG-Kopf; der Bucket prüft den Content-Type, nicht den Inhalt
const JPEG = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])], { type: 'image/jpeg' })

const probe = await tryAal2User('doc-a')
const reason = 'reason' in probe ? probe.reason : null
if (reason) console.warn(`partner-documents: TOTP nicht nutzbar, Tests übersprungen (${reason})`)

const reg = (name: string) => ({
  p_name: name, p_legal_form: 'gmbh', p_uid: 'ATU12345678', p_small_business: false, p_street: 'Teststraße 1', p_postcode: '1010', p_city: 'Wien',
  p_contact_name: 'Max Test', p_contact_phone: '+43 660 1234567', p_contact_email: 'firma@movenow.test', p_districts: [1], p_terms_version: 'partner-2026-11-entwurf',
})
const PREFIX = 'mvtest-docs-'
const firms: string[] = []
const exists = async (path: string) => {
  const dir = path.split('/')[0]!
  const { data, error } = await service.storage.from(BUCKET).list(dir, { limit: 50 })
  if (error) throw error
  return (data ?? []).some((o) => o.name === path.split('/')[1])
}
const removeFiles = async (partnerId: string) => {
  const { data } = await service.storage.from(BUCKET).list(partnerId, { limit: 100 })
  if (data?.length) await service.storage.from(BUCKET).remove(data.map((o) => `${partnerId}/${o.name}`))
}
const code = (e: { code?: string } | null) => e?.code ?? (e as { statusCode?: string } | null)?.statusCode ?? 'ok'

// Reste eines abgebrochenen Laufs (Firmen mit diesem Namensanfang) samt Dateien entfernen
beforeAll(async () => {
  for (const old of ownerSql(`select id from public.partners where name like '${PREFIX}%'`)) {
    await removeFiles(String(old.id))
    ownerDeletePartner(String(old.id))
  }
}, 120_000)

afterAll(async () => {
  try {
    for (const id of firms) {
      await removeFiles(id)
      ownerDeletePartner(id)
    }
  } finally {
    await deleteUsers()
  }
}, 120_000)

describe.skipIf(reason !== null)('Partner-Dokumente mit echten aal2-Token', () => {
  const a = 'user' in probe ? probe.user : (undefined as unknown as Aal2User)
  let b: Aal2User
  let aFirm = ''
  let bFirm = ''
  const docs: Record<string, string> = {}
  const insert = (db: Aal2User['aal1'], id: string, kind = 'other') => db.from('partner_documents').insert({ id, kind } as never).select('id')
  const up = (jwt: string, path: string, blob: Blob) => withToken(jwt).storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false })

  beforeAll(async () => {
    const other = await tryAal2User('doc-b')
    if ('reason' in other) throw new Error(other.reason)
    b = other.user
    aFirm = must(await a.aal1.rpc('register_partner', reg(`${PREFIX}${run} A GmbH`))) as unknown as string
    firms.push(aFirm)
    bFirm = must(await b.aal1.rpc('register_partner', reg(`${PREFIX}${run} B GmbH`))) as unknown as string
    firms.push(bFirm)
  }, 120_000)

  it('Zeile nur mit aal2; Upload mit aal1 scheitert (Objekt liegt nicht), mit aal2 auf dieselbe Zeile klappt (Objekt liegt)', async () => {
    docs.pdf = crypto.randomUUID()
    expect(code((await insert(a.aal1, docs.pdf, 'trade_license')).error)).toBe('42501')
    const row = await insert(a.aal2, docs.pdf, 'trade_license')
    expect(row.error).toBeNull()
    const path = `${aFirm}/${docs.pdf}`

    const denied = await up(a.jwt1, path, PDF)
    expect(denied.error, 'aal1-Upload muss scheitern').not.toBeNull()
    expect(await exists(path)).toBe(false)

    const ok = await up(a.jwt2, path, PDF)
    expect(ok.error).toBeNull()
    expect(await exists(path)).toBe(true)
  }, 60_000)

  it('JPEG ist erlaubt; ein zweiter Upload auf den belegten Pfad scheitert und lässt die Datei stehen', async () => {
    docs.jpeg = crypto.randomUUID()
    expect((await insert(a.aal2, docs.jpeg, 'company_register')).error).toBeNull()
    const path = `${aFirm}/${docs.jpeg}`
    expect((await up(a.jwt2, path, JPEG)).error).toBeNull()
    const again = await up(a.jwt2, path, PDF)
    expect(again.error, 'ohne Upsert darf der Pfad nicht überschrieben werden').not.toBeNull()
    const { data } = await service.storage.from(BUCKET).download(path)
    expect(data?.type).toBe('image/jpeg')
  }, 60_000)

  it('falscher Typ wird vom Server abgelehnt (Objekt liegt nicht); Erneut-Hochladen auf dieselbe Zeile mit JPEG klappt', async () => {
    docs.png = crypto.randomUUID()
    expect((await insert(a.aal2, docs.png)).error).toBeNull()
    const path = `${aFirm}/${docs.png}`
    const bad = await up(a.jwt2, path, new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }))
    expect(bad.error).not.toBeNull()
    expect(String((bad.error as { statusCode?: string }).statusCode)).toBe('415')
    expect(await exists(path)).toBe(false)
    expect((await up(a.jwt2, path, JPEG)).error).toBeNull()
    expect(await exists(path)).toBe(true)
  }, 60_000)

  it('über 10 MB wird vom Server abgelehnt (Objekt liegt nicht); eine kleine PDF auf dieselbe Zeile klappt', async () => {
    docs.big = crypto.randomUUID()
    expect((await insert(a.aal2, docs.big)).error).toBeNull()
    const path = `${aFirm}/${docs.big}`
    const bytes = new Uint8Array(10 * 1024 * 1024 + 1)
    bytes.set(new TextEncoder().encode('%PDF-'))
    const big = await up(a.jwt2, path, new Blob([bytes], { type: 'application/pdf' }))
    expect(big.error).not.toBeNull()
    expect(String((big.error as { statusCode?: string }).statusCode)).toBe('413')
    expect(await exists(path)).toBe(false)
    expect((await up(a.jwt2, path, PDF)).error).toBeNull()
    expect(await exists(path)).toBe(true)
  }, 120_000)

  it('Pfad ohne eigene Zeile wird verweigert (Objekt liegt nicht)', async () => {
    const path = `${aFirm}/${crypto.randomUUID()}`
    expect((await up(a.jwt2, path, PDF)).error).not.toBeNull()
    expect(await exists(path)).toBe(false)
  }, 60_000)

  it('Lesen: Firma A sieht mit aal2 ihre vier Dateien, mit aal1 keine; Metadaten mit aal1 und aal2', async () => {
    const list = (jwt: string, dir: string) => withToken(jwt).storage.from(BUCKET).list(dir, { limit: 50 })
    expect((must(await list(a.jwt2, aFirm))).map((o) => o.name).sort()).toEqual([docs.pdf, docs.jpeg, docs.png, docs.big].sort())
    expect(must(await list(a.jwt1, aFirm))).toEqual([])
    expect(must(await a.aal1.from('partner_documents').select('id')).length).toBe(4)
    expect(must(await a.aal2.from('partner_documents').select('id')).length).toBe(4)
  }, 60_000)

  it('Firma B: sieht, liest und beschreibt nichts von A; auch nicht über eine eigene Zeile', async () => {
    const own = crypto.randomUUID()
    expect((await insert(b.aal2, own)).error).toBeNull()
    expect(must(await b.aal2.from('partner_documents').select('id')).map((r) => r.id)).toEqual([own])
    expect(must(await withToken(b.jwt2).storage.from(BUCKET).list(aFirm, { limit: 50 }))).toEqual([])
    expect((await withToken(b.jwt2).storage.from(BUCKET).download(`${aFirm}/${docs.pdf}`)).error).not.toBeNull()
    // fremde partner_id in der Zeile: kein Spaltenrecht
    expect(code((await b.aal2.from('partner_documents').insert({ id: crypto.randomUUID(), kind: 'other', partner_id: aFirm } as never)).error)).toBe('42501')
    // eigene Zeile, aber Pfad der Firma A
    const foreign = `${aFirm}/${own}`
    expect((await up(b.jwt2, foreign, PDF)).error).not.toBeNull()
    expect(await exists(foreign)).toBe(false)
    // eigener Pfad klappt (Gegenfall)
    expect((await up(b.jwt2, `${bFirm}/${own}`, PDF)).error).toBeNull()
    // A überschreibt oder liest nichts von B
    expect(must(await withToken(a.jwt2).storage.from(BUCKET).list(bFirm, { limit: 50 }))).toEqual([])
    expect((await up(a.jwt2, `${bFirm}/${own}`, JPEG)).error).not.toBeNull()
  }, 60_000)

  it('Kunde ohne Firmenmitgliedschaft (auch mit echtem aal2): keine Zeile, kein Upload, keine Liste', async () => {
    const cust = await tryAal2User('doc-cust')
    if ('reason' in cust) throw new Error(cust.reason)
    expect(code((await insert(cust.user.aal2, crypto.randomUUID())).error)).toBe('42501')
    expect(must(await cust.user.aal2.from('partner_documents').select('id'))).toEqual([])
    expect((await up(cust.user.jwt2, `${aFirm}/${docs.pdf}`, PDF)).error).not.toBeNull()
    expect(must(await withToken(cust.user.jwt2).storage.from(BUCKET).list(aFirm, { limit: 50 }))).toEqual([])
    const plain = await makeUser('doc-plain')
    expect((await up(plain.jwt, `${aFirm}/${crypto.randomUUID()}`, PDF)).error).not.toBeNull()
  }, 90_000)

  it('Admin gibt den Platz frei: die Datei im Bucket sperrt die ID (slot_taken), nach dem Entfernen der Datei klappt sie wieder (0026)', async () => {
    const adm = await makeUser('doc-admin')
    ownerGrantRole(adm.id, 'admin')
    const rm = await service.rpc('admin_remove_partner_document', { p_actor: adm.id, p_document: docs.jpeg!, p_note: 'Test s9i-5b' })
    expect(rm.error).toBeNull()
    expect(must(await a.aal2.from('partner_documents').select('id')).length).toBe(3)
    const blocked = await insert(a.aal2, docs.jpeg!)
    expect(blocked.error?.message).toBe('slot_taken')
    await service.storage.from(BUCKET).remove([`${aFirm}/${docs.jpeg}`])
    expect((await insert(a.aal2, docs.jpeg!)).error).toBeNull()
  }, 90_000)
})
