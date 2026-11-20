// rl3 (GOLIVE 26): Gesamtgrenze je Konto für `register_partner` und die Folgen, als Rollback-Probe gegen Dev.
// Die Registrierung hat keine Zählergrenze (ENTSCHEIDUNGEN Nr. 219): Spam und Speicher begrenzt die Struktur: ein Konto hat höchstens eine Firma
// (`partner_members unique (user_id)`), höchstens 23 Bezirke (PK + Check), Textfelder mit Längen-Checks, ein Audit-Eintrag je Erfolg. Jeder Fehlaufruf
// schreibt nichts (Zeilenzählung nach allen Fehlversuchen). Die Dokumentgrenzen (5 Zeilen, 10 MiB, PDF/JPEG) belegen partner-admin.test.ts und partner-documents.test.ts.
// Rot-Beweis: MV_RL3_OHNE_GRENZEN=1 lockert in der Probe (Transaktion, am Ende zurückgerollt) Bezirks-PK, Bezirks-Check und Namens-Check.
import { describe, expect, it } from 'vitest'
import { probes, type Step } from '../support/owner.ts'
import { insertUsers, newId, regArgs } from '../support/partner.ts'

const OHNE_GRENZEN = process.env.MV_RL3_OHNE_GRENZEN === '1'
const SETUP_MUTATION = OHNE_GRENZEN
  ? 'alter table public.partner_regions drop constraint partner_regions_district_check; alter table public.partner_regions drop constraint partner_regions_pkey; alter table public.partners drop constraint partners_name_check;'
  : ''

const MARK = 'rl3 Grenz'
const days = (n: number) => `(select array_agg(d::smallint) from generate_series(1, ${n}) d)`
const rep = (c: string, n: number) => `repeat('${c}', ${n})`

describe('register_partner: Gesamtgrenze je Konto', () => {
  it('Fehlversuche schreiben nichts, Randwerte klappen mit genau einer Firma, 23 Bezirken und einem Audit-Eintrag', () => {
    const c = newId(), cu = newId(), cl = newId()
    const call = (o: Record<string, string>) => `perform public.register_partner(${regArgs({ name: `'${MARK}probe'`, ...o })})`
    const as = (sub: string) => ({ as: 'authenticated', claims: { sub, aal: 'aal1' } }) as const

    const bad: [string, Record<string, string>, RegExp | string][] = [
      ['Bezirke 1 bis 24', { districts: days(24) }, /^23514:/],
      ['Bezirke 1 bis 23 plus Duplikat', { districts: `array_cat(${days(23)}, array[1]::smallint[])` }, /^23505:/],
      ['Bezirk doppelt', { districts: 'array[1,1]::smallint[]' }, /^23505:/],
      ['Bezirk 0', { districts: 'array[0]::smallint[]' }, /^23514:/],
      ['Bezirk NULL-Element', { districts: 'array[1, null]::smallint[]' }, /^23502:/],
      ['Bezirke NULL', { districts: 'null::smallint[]' }, 'P0001: scope_incomplete'],
      ['Kleinunternehmer NULL', { small: 'null' }, /^23502:/],
      ['Rechtsform unbekannt', { legal: "'foo'" }, /^23514:/],
      ['Name 1 Zeichen', { name: "'x'" }, /^23514:/],
      ['Name 121 Zeichen', { name: rep('n', 121) }, /^23514:/],
      ['Straße 1 Zeichen', { street: "'x'" }, /^23514:/],
      ['Straße 121 Zeichen', { street: rep('s', 121) }, /^23514:/],
      ['Ort 1 Zeichen', { city: "'x'" }, /^23514:/],
      ['Ort 81 Zeichen', { city: rep('c', 81) }, /^23514:/],
      ['Ansprechpartner 1 Zeichen', { cname: "'x'" }, /^23514:/],
      ['Ansprechpartner 101 Zeichen', { cname: rep('m', 101) }, /^23514:/],
      ['Telefon 4 Zeichen', { phone: "'1234'" }, /^23514:/],
      ['Telefon 41 Zeichen', { phone: rep('1', 41) }, /^23514:/],
      ['E-Mail 4 Zeichen', { email: "'a@bc'" }, /^23514:/],
      ['E-Mail 255 Zeichen', { email: `'a@' || ${rep('b', 253)}` }, /^23514:/],
      ['AGB-Version leer', { terms: "''" }, /^23514:/],
      ['AGB-Version 41 Zeichen', { terms: rep('v', 41) }, /^23514:/],
      ['AGB-Version mit Leerzeichen', { terms: "'a b'" }, /^23514:/],
      ['PLZ 3 Ziffern', { zip: "'123'" }, /^23514:/],
      ['PLZ 5 Ziffern', { zip: "'12345'" }, /^23514:/],
      ['UID 7 Ziffern', { uid: "'ATU1234567'" }, /^23514:/],
      ['UID 9 Ziffern', { uid: "'ATU123456789'" }, /^23514:/],
    ]
    // Zeilen, die ein Fehlversuch hinterließe: Firma (nach Namensanfang, auch ohne Mitglied), Mitglied, Bezirke, Audit
    const count = (u: string) =>
      `=(select count(*) from public.partners where name like '${MARK}%')::text || '/' || (select count(*) from public.partner_members where user_id = '${u}')::text` +
      ` || '/' || (select count(*) from public.partner_regions r join public.partners p on p.id = r.partner_id where p.name like '${MARK}%')::text` +
      ` || '/' || (select count(*) from public.audit_log where actor_id = '${u}' and action = 'register_partner')::text`
    const own = (u: string) =>
      `=(select count(*) from public.partner_members where user_id = '${u}')::text || '/' || (select count(*) from public.partner_regions r join public.partner_members m on m.partner_id = r.partner_id where m.user_id = '${u}')::text` +
      ` || '/' || (select count(*) from public.audit_log where actor_id = '${u}' and action = 'register_partner')::text`

    const steps: Step[] = [
      ...bad.map(([name, o]): Step => ({ name, sql: call(o), ...as(c) })),
      { name: 'nach den Fehlversuchen', sql: count(c) },
      // Obergrenzen aller Felder: 120/120/80/100/40/254/40 Zeichen, alle 23 Bezirke
      {
        name: 'Obergrenzen',
        sql: call({
          name: `'${MARK}' || ${rep('o', 111)}`, street: rep('s', 120), city: rep('c', 80), cname: rep('m', 100), phone: rep('1', 40),
          email: `'a@' || ${rep('b', 252)}`, terms: rep('v', 40), districts: days(23),
        }),
        ...as(cu),
      },
      { name: 'Obergrenzen Zeilen', sql: own(cu) },
      // Untergrenzen: 2/2/2/2/5/5/1 Zeichen, ein Bezirk
      {
        name: 'Untergrenzen',
        sql: call({ name: "'xy'", street: "'xy'", city: "'xy'", cname: "'xy'", phone: "'12345'", email: "'a@b.c'", terms: "'v'", districts: 'array[1]::smallint[]' }),
        ...as(cl),
      },
      { name: 'Untergrenzen Zeilen', sql: own(cl) },
    ]
    const r = probes(`${insertUsers([c, cu, cl])} ${SETUP_MUTATION}`, steps)

    for (const [name, , want] of bad) {
      if (typeof want === 'string') expect(r[name], name).toBe(want)
      else expect(r[name], name).toMatch(want)
    }
    expect(r['nach den Fehlversuchen']).toBe('= 0/0/0/0')
    expect(r['Obergrenzen']).toBe('ok')
    expect(r['Obergrenzen Zeilen']).toBe('= 1/23/1')
    expect(r['Untergrenzen']).toBe('ok')
    expect(r['Untergrenzen Zeilen']).toBe('= 1/1/1')
  }, 120_000)
})
