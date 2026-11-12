// SQL-Bausteine für die Partner-Tests (S9b). Alles läuft in `probes(setup, steps)`: eine Transaktion mit Rollback, keine Firma bleibt zurück.
// Nutzer sind Zeilen in auth.users mit selbst erzeugten UUIDs (das Profil legt der Trigger an); Firmen-IDs stehen in app.p_<schlüssel>.
import { ownerSql } from './owner.ts'

export const STATUSES = ['pending', 'active', 'payment_hold', 'suspended', 'rejected'] as const
export type PStatus = (typeof STATUSES)[number]

export const newId = () => crypto.randomUUID()

/**
 * Marker der Testfirmen: ihre Kontaktadresse. Die Domain .test ist reserviert (RFC 2606) und nie zustellbar, `pt-firma-` und die Lauf-ID
 * hängen nur Tests an. `sweepTestResidue` findet Testfirmen daran und nicht an der Mitgliedschaft (die geht mit dem Nutzer verloren).
 */
export const FIRM_MAIL_RE = '^pt-firma-[0-9a-f]{8}@movenow[.]test$' // PostgreSQL-Regex; [.] statt \. (Template-Literal)
export const FIRM_MAIL = `pt-firma-${crypto.randomUUID().slice(0, 8)}@movenow.test`

export const insertUsers = (ids: string[]) =>
  ids.map((id) => `insert into auth.users (id, email) values ('${id}', 'pt-${id.slice(0, 8)}@movenow.test');`).join(' ')

export const P = (key: string) => `current_setting('app.p_${key}')::uuid`

export const regArgs = (o: Partial<Record<string, string>> = {}) => {
  const a = {
    name: "'Testfirma GmbH'", legal: "'gmbh'", uid: "'ATU12345678'", small: 'false', street: "'Teststraße 1'", zip: "'1010'", city: "'Wien'",
    cname: "'Max Test'", phone: "'+43 660 1234567'", email: `'${FIRM_MAIL}'`, districts: 'array[1,2]::smallint[]', terms: "'partner-2026-11-entwurf'", ...o,
  }
  return `${a.name}, ${a.legal}, ${a.uid}, ${a.small}, ${a.street}, ${a.zip}, ${a.city}, ${a.cname}, ${a.phone}, ${a.email}, ${a.districts}, ${a.terms}`
}

const claims = (sub: string, aal: 'aal1' | 'aal2') => `select set_config('request.jwt.claims', '{"sub":"${sub}","role":"authenticated","aal":"${aal}"}', true);`

export const grantAdmin = (id: string) => `select public.admin_grant_role('${id}', 'admin');`

/** Registriert eine Firma als Nutzer `user` (aal1) und legt ihre ID unter app.p_<key> ab. */
export const register = (user: string, key: string, over: Partial<Record<string, string>> = {}) =>
  `${claims(user, 'aal1')} select set_config('app.p_${key}', public.register_partner(${regArgs(over)})::text, true);`

export const approve = (admin: string, key: string) =>
  `select public.admin_approve_partner('${admin}', ${P(key)}, array['move']::public.partner_service[], 'standard_20', null);`

export const setStatus = (admin: string, key: string, status: string, reason = 'Begründung für den Test') =>
  `select public.admin_set_partner_status('${admin}', ${P(key)}, '${status}', '${reason}');`

/** Firma `key` des Nutzers `user` im gewünschten Status (über die zwei Funktionen, wie im Betrieb). */
export function firm(user: string, key: string, status: PStatus, admin: string, over: Partial<Record<string, string>> = {}): string {
  const r = register(user, key, over)
  switch (status) {
    case 'pending': return r
    case 'active': return `${r} ${approve(admin, key)}`
    case 'payment_hold': return `${r} ${approve(admin, key)} ${setStatus(admin, key, 'payment_hold')}`
    case 'suspended': return `${r} ${approve(admin, key)} ${setStatus(admin, key, 'suspended')}`
    case 'rejected': return `${r} ${setStatus(admin, key, 'rejected')}`
  }
}

/**
 * Committete, aktive Testfirma für alle Leistungen und Bezirke: Anfragen der quote-Tests bleiben `requested`/`awaiting_offer`, statt
 * sofort `unmatched` zu werden (S9c: `quote` verteilt beim Speichern). Rückgabe: Aufräumfunktion (Firma ohne Zuordnung, löschbar).
 */
export const COVER_FIRM = 'Testabdeckung GmbH'

export function committedCoverFirm(): () => void {
  // Reste eines abgebrochenen Laufs entfernen (Name ist eindeutig), dann neu anlegen
  for (const old of ownerSql(`select id from public.partners where name = '${COVER_FIRM}'`)) ownerDeletePartner(String(old.id))
  const [adm, u] = [newId(), newId()]
  // Bezirke 17, 18 und 21 bleiben frei: tests/rls/listings.test.ts prüft dort Empfänger und „kein Partner passt“
  const all = `array[${Array.from({ length: 23 }, (_, i) => i + 1).filter((d) => ![17, 18, 21].includes(d)).join(',')}]::smallint[]`
  ownerSql(`begin; ${insertUsers([adm, u])} ${grantAdmin(adm)} ${register(u, 'cover', { districts: all, name: `'${COVER_FIRM}'` })}
    select public.admin_approve_partner('${adm}', ${P('cover')}, array['transport','move','clearance','assembly']::public.partner_service[], 'standard_20', null); commit;`)
  const pid = String(ownerSql(`select partner_id from public.partner_members where user_id = '${u}'`)[0]?.partner_id)
  return () => {
    ownerDeletePartner(pid)
    ownerSql(`delete from auth.users where id in ('${adm}', '${u}')`)
  }
}

/** Löscht eine committete Testfirma (nur Eigentümer, Marker an die Firma gebunden). Keine Firma mit Journalzeilen. */
export function ownerDeletePartner(id: string) {
  ownerSql(
    `begin; select set_config('app.mv_partner_delete', '${id}', true);
     delete from public.partner_documents where partner_id = '${id}';
     delete from public.partner_vat_rules where partner_id = '${id}'; delete from public.partner_regions where partner_id = '${id}';
     delete from public.partner_categories where partner_id = '${id}'; delete from public.partner_members where partner_id = '${id}';
     delete from public.partners where id = '${id}'; commit`,
  )
}
