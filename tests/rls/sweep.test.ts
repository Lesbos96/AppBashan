// Aufräumen der Testfirmen (tests/support/sweep.ts, s9t-1): gefunden wird eine Testfirma an ihrer Markierung (Kontaktadresse), nicht an der Mitgliedschaft.
// Committete Fixtures nur in Bezirk 21 (keine Empfängerfirma anderer Tests); alles, was der Test anlegt, räumt `afterAll` selbst weg.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ownerSql } from '../support/owner.ts'
import { firm, grantAdmin, insertUsers, newId, ownerDeletePartner } from '../support/partner.ts'
import { sweepTestResidue } from '../support/sweep.ts'

const adm = newId()
const OV = { districts: 'array[21]::smallint[]' }
const firms: string[] = []
const users: string[] = []

// Alle Firmen hier sind `pending` (nie Empfänger anderer Tests) und tragen einen eigenen Namen, damit `beforeAll` Reste nach einem Abbruch findet (die Wächter-Firmen sind für den Sweep absichtlich unsichtbar)
const GUARD_FIRM = 'Sweeptest-Wächter GmbH'

/** Legt Nutzer `u` (E-Mail `mail`, sonst pt-…) und eine Firma an; Rückgabe: Firmen-ID. */
function makeFirm(u: string, over: Partial<Record<string, string>> = {}, mail?: string): string {
  users.push(u)
  const user = mail ? `insert into auth.users (id, email) values ('${u}', '${mail}');` : insertUsers([u])
  ownerSql(`begin; ${user} ${firm(u, 'f', 'pending', adm, { ...OV, name: `'${GUARD_FIRM}'`, ...over })} commit;`)
  const id = String(ownerSql(`select partner_id from public.partner_members where user_id = '${u}'`)[0]?.partner_id)
  firms.push(id)
  return id
}
const status = (id: string) => ownerSql(`select status::text as s from public.partners where id = '${id}'`)[0]?.s as string | undefined
const dropUser = (u: string) => ownerSql(`delete from auth.users where id = '${u}'`)

beforeAll(() => {
  // Reste eines abgebrochenen Laufs (der Sweep sieht diese Firmen nicht, Muster wie committedCoverFirm)
  for (const old of ownerSql(`select id from public.partners where name = '${GUARD_FIRM}'`)) ownerDeletePartner(String(old.id))
  ownerSql(`delete from auth.users where email like 'echt-%@example.org'`)
  ownerSql(`begin; ${insertUsers([adm])} ${grantAdmin(adm)} commit;`)
}, 120_000)

afterAll(() => {
  for (const id of firms) if (status(id)) ownerDeletePartner(id)
  if (users.length) ownerSql(`delete from auth.users where id in (${users.map((u) => `'${u}'`).join(',')})`)
  sweepTestResidue(adm, true)
}, 120_000)

describe('sweepTestResidue findet Testfirmen an der Markierung', () => {
  it('Firma, deren Nutzer zuerst gelöscht wurde (kein Mitglied mehr), wird aufgeräumt', () => {
    const u = newId()
    const id = makeFirm(u)
    expect(status(id)).toBe('pending')
    dropUser(u)
    expect(Number(ownerSql(`select count(*) as n from public.partner_members where partner_id = '${id}'`)[0]?.n)).toBe(0)
    sweepTestResidue(adm)
    expect(status(id)).toBeUndefined()
  }, 120_000)

  it('Firma mit einem Mitglied außerhalb der Testkonten bleibt unberührt, auch mit Markierung', () => {
    const u = newId()
    const id = makeFirm(u, {}, `echt-${u.slice(0, 8)}@example.org`)
    sweepTestResidue(adm)
    expect(status(id)).toBe('pending')
  }, 120_000)

  it('Firma ohne Mitglied mit fremder Kontaktadresse bleibt unberührt', () => {
    const u = newId()
    const id = makeFirm(u, { email: "'kontakt@beispiel.at'" })
    dropUser(u)
    sweepTestResidue(adm)
    expect(status(id)).toBe('pending')
  }, 120_000)
})
