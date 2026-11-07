// SQL-Bausteine für die Partner-Tests (S9b). Alles läuft in `probes(setup, steps)`: eine Transaktion mit Rollback, keine Firma bleibt zurück.
// Nutzer sind Zeilen in auth.users mit selbst erzeugten UUIDs (das Profil legt der Trigger an); Firmen-IDs stehen in app.p_<schlüssel>.
import { ownerSql } from './owner.ts'

export const STATUSES = ['pending', 'active', 'payment_hold', 'suspended', 'rejected'] as const
export type PStatus = (typeof STATUSES)[number]

export const newId = () => crypto.randomUUID()

export const insertUsers = (ids: string[]) =>
  ids.map((id) => `insert into auth.users (id, email) values ('${id}', 'pt-${id.slice(0, 8)}@movenow.test');`).join(' ')

export const P = (key: string) => `current_setting('app.p_${key}')::uuid`

export const regArgs = (o: Partial<Record<string, string>> = {}) => {
  const a = {
    name: "'Testfirma GmbH'", legal: "'gmbh'", uid: "'ATU12345678'", small: 'false', street: "'Teststraße 1'", zip: "'1010'", city: "'Wien'",
    cname: "'Max Test'", phone: "'+43 660 1234567'", email: "'firma@movenow.test'", districts: 'array[1,2]::smallint[]', terms: "'partner-2026-11-entwurf'", ...o,
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
export function firm(user: string, key: string, status: PStatus, admin: string): string {
  const r = register(user, key)
  switch (status) {
    case 'pending': return r
    case 'active': return `${r} ${approve(admin, key)}`
    case 'payment_hold': return `${r} ${approve(admin, key)} ${setStatus(admin, key, 'payment_hold')}`
    case 'suspended': return `${r} ${approve(admin, key)} ${setStatus(admin, key, 'suspended')}`
    case 'rejected': return `${r} ${setStatus(admin, key, 'rejected')}`
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
