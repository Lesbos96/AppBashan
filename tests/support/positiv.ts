// Positivzeilen-Register (u3, SYSTEM_VORSCHLAG 3 d): je öffentlicher SQL-Funktion ein Aufruf mit erlaubtem Akteur, der in einer Rollback-Probe
// mindestens eine Zeile samt Spaltentypen (Tabellenfunktionen), einen Wert vom erwarteten Typ oder einen Aufruf ohne Fehler (void) liefert.
// Nur Daten und SQL-Text, kein Datenbankzugriff: der Unit-Test lädt diese Datei, `tests/rls/positiv.test.ts` führt sie aus.
// Typbindung (tsc, also `check`): REGISTER und AUSNAHMEN decken zusammen genau `keyof Database['public']['Functions']` ab, die Spaltenmenge einer
// Tabellenfunktion ist an `Returns` gebunden, die Typkategorie je Spalte ebenso; Funktionen mit `p_actor` laufen nur als service_role.
import type { Database } from '../../supabase/functions/_shared/database.types.ts'
import { firm, grantAdmin, insertUsers, newId, P, regArgs, register } from './partner.ts'

type Fns = Database['public']['Functions']
export type Name = keyof Fns
type Ret<N extends Name> = Fns[N]['Returns']
type RowOf<N extends Name> = Ret<N> extends readonly (infer R)[] ? R : never
type Json = Database['public']['Functions']['booking_terms']['Returns']

/** pg-Typname (`pg_type.typname`; Enums als `enum`). */
export type Pg = 'bool' | 'int2' | 'int4' | 'int8' | 'numeric' | 'float8' | 'text' | 'uuid' | 'date' | 'timestamptz' | 'interval' | 'jsonb' | 'enum' | '_text' | '_uuid'
type PgFor<T> = [NonNullable<Json>] extends [T]
  ? 'jsonb'
  : [T] extends [boolean]
    ? 'bool'
    : [T] extends [number]
      ? 'int2' | 'int4' | 'int8' | 'numeric' | 'float8'
      : [T] extends [string[]]
        ? '_text' | '_uuid'
        : [T] extends [string]
          ? 'text' | 'uuid' | 'date' | 'timestamptz' | 'interval' | 'enum'
          : never

export type Welt = 'angebot' | 'auftrag' | 'verwaltung' | 'betrieb'
/** Wer EXECUTE hat (a = anon, u = authenticated, s = service_role; leer = nur der Eigentümer), exakt wie im Katalog. */
export type Exec = '' | 's' | 'u' | 'us' | 'a' | 'aus'

type Akteur = { als: 'authenticated'; user: string; aal: 'aal1' | 'aal2' } | { als: 'anon' } | { als: 'service_role' } | { als: 'owner' }
type NurService = { als: 'service_role' }
type WerFuer<N extends Name> = [Fns[N]['Args']] extends [never] ? Akteur : 'p_actor' extends keyof Fns[N]['Args'] ? NurService : keyof Fns[N]['Args'] & ('p_customer' | 'p_user') extends never ? Akteur : NurService | { als: 'owner' }
type Ergebnis<N extends Name> = [Ret<N>] extends [undefined]
  ? { ergebnis: 'void' }
  : Ret<N> extends readonly unknown[]
    ? { ergebnis: 'zeilen'; spalten: { [C in keyof RowOf<N>]-?: C extends `${string}_cents` | 'prior_fee' | 'prior_net' | 'prior_payout' | 'prior_total' | 'prior_vat' ? 'int4' | 'int8' : PgFor<NonNullable<RowOf<N>[C]>> } }
    : { ergebnis: 'wert'; typ: PgFor<NonNullable<Ret<N>>> }

export type Eintrag<N extends Name> = WerFuer<N> &
  Ergebnis<N> & {
    welt: Welt
    ausfuehren: Exec
    /** SQL-Ausdruck des Aufrufs, z. B. `public.send_offer(…)`. */
    aufruf: (c: Ctx) => string
    /** SQL als Eigentümer unmittelbar davor (Zustand herstellen). */
    vorher?: (c: Ctx) => string
    /** Fremde Konten rufen dasselbe auf: Ergebnis 0 Zeilen oder ein Fehler, nie eine Zeile (Spalten mit Beträgen, Listen, Kontakte). */
    gegen?: { user: string; aal: 'aal1' | 'aal2' }[]
  }

/** Funktion ohne Fixture: `ausfuehren` steht wie im Register, der Katalogtest prüft es auch hier. */
export type Ausnahme = { ausfuehren: Exec; grund: string }

/** Beträge einer Gebühr in Cent (so liefert `splitFee`). */
export type Split = { feeCents: number; feeNetCents: number; feeVatCents: number; payoutCents: number }
/** Werte, die nur die Datenbank kennt (geltende Gebühr) und die der Test aus `currentFee()` und `splitFee` bildet. */
export type Ctx = { vr: number; fsv: number; vrv: number; s: Split; offer: Split; change: Split; zero: Split }

// ---------- Akteure und Bausteine ----------

export const U = { adm: newId(), cust: newId(), cust2: newId(), pa: newId(), pb: newId(), pc: newId(), pn: newId(), pr: newId() }
export const USERS = Object.values(U)
const OV = { districts: 'array[17, 18]::smallint[]' }
const BASE = `${insertUsers(USERS)} ${grantAdmin(U.adm)} ${firm(U.pa, 'a', 'active', U.adm, OV)} ${firm(U.pb, 'b', 'active', U.adm, OV)} ${firm(U.pc, 'c', 'active', U.adm, OV)}`

export const R = {
  o1: newId(), o2: newId(), o3: newId(), o4: newId(), o5: newId(), o6: newId(), q0: newId(), j1: newId(), j2: newId(), j3: newId(), j4: newId(), j5: newId(),
  c1: newId(), c2: newId(), c3: newId(), f1: newId(), f2: newId(),
}
const DOC = newId()
const [PO, PW, PRC, PMK] = [`${newId()}.jpg`, `${newId()}.jpg`, `${newId()}.jpg`, `${newId()}.jpg`] as const

const TERMS = '"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":0,"call_out_fee_cents":6900,"termsHash":"x"}'
const rev1 = (r: string) => `(select id from public.price_revisions where request_id = '${r}' and n = 1)`
const LID = (r: string, key: string) => `(select id from public.job_listings where request_id = '${r}' and partner_id = ${P(key)})`
const OFF = (r: string, key: string) => `(select id from public.partner_offers where request_id = '${r}' and partner_id = ${P(key)} order by created_at desc limit 1)`
const CUR = (r: string) => `(select current_revision from public.service_requests where id = '${r}')`
const OPEN = (r: string) => `(select id from public.price_revisions where request_id = '${r}' and source = 'change_order' and status = 'proposed')`
const RECEIPTS = (r: string) => `array(select id from public.job_photos where request_id = '${r}' and kind = 'receipt')`
const JP = (r: string, i: number) => `(select id from public.job_photos where request_id = '${r}' order by id limit 1 offset ${i})`
const ago = (i: string) => `now() - interval '${i}'`
const later = (i: string) => `now() + interval '${i}'`
const today = `(now() at time zone 'Europe/Vienna')::date`
const REASON = 'Begründung für den Test'
const asUser = (user: string, aal: 'aal1' | 'aal2', sql: string) =>
  `select set_config('request.jwt.claims', '{"sub":"${user}","role":"authenticated","aal":"${aal}"}', true); ${sql} select set_config('request.jwt.claims', '', true);`

/** Auftrag mit Revision 1 (range = Spanne 1.000 bis 2.000 €, awaiting_offer; fixed = Festpreis 689,61 € mit Stornostufen, requested), Kontakt, Bezirk 17. */
function req(id: string, kind: 'range' | 'fixed', termin = later('14 days')): string {
  const fixed = kind === 'fixed'
  const snap = fixed
    ? `{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[],${TERMS}}`
    : '{"kind":"price","lowCents":100000,"highCents":200000,"lines":[],"terms":{"x":1}}'
  const vals = fixed ? '68961, 68961, 68961' : 'null, 100000, 200000'
  return `insert into public.service_requests (id, customer_id, client_ref, service, status, district, termin_at, accept_deadline)
    values ('${id}', '${U.cust}', gen_random_uuid(), 'move', '${fixed ? 'requested' : 'awaiting_offer'}', 17, ${termin}, now() + interval '1 day');
    insert into public.price_revisions (request_id, n, source, inputs, snapshot, price_version, total_cents, low_cents, high_cents)
    values ('${id}', 1, 'submit', '{}', '${snap}', 1, ${vals});
    update public.service_requests set current_revision = ${rev1(id)} where id = '${id}';
    insert into public.request_contacts (request_id, name, phone, email) values ('${id}', 'Test Kunde', '+43 660 1234567', 'kunde@movenow.test');`
}
const dist = (id: string) => `select public.distribute_request('${id}');`
const accept = (c: Ctx, id: string, key: 'a' | 'b' = 'a') =>
  `select public.partner_accept('${key === 'a' ? U.pa : U.pb}', ${LID(id, key)}, ${rev1(id)}, ${c.s.payoutCents}, ${c.vr}, ${c.s.feeCents}, ${c.s.feeNetCents}, ${c.s.feeVatCents}, ${c.s.payoutCents}, ${c.fsv}, ${c.vrv});`
// höchstens 5 offene Aufträge je Firma (partner_open_jobs_max): die Aufträge, an denen Firma a nichts tun muss, nimmt Firma b an
const accepted = (c: Ctx, id: string, termin = later('14 days'), key: 'a' | 'b' = 'a') => `${req(id, 'fixed', termin)} ${dist(id)} ${accept(c, id, key)}`
const offer = (user: string, key: string, r: string, cents: number) => asUser(user, 'aal2', `select public.send_offer(${LID(r, key)}, ${cents});`)
// Partner lesen `request_id` von job_listings und partner_offers nicht: ihre Aufrufe bekommen die IDs aus Einstellungen (vom Eigentümer gesetzt)
const keep = (name: string, sql: string) => `select set_config('app.${name}', (${sql})::text, true);`
const LS = (name: string) => `current_setting('app.${name}')::uuid`
const keepListing = (name: string, r: string, key: string) => keep(name, `select id from public.job_listings where request_id = '${r}' and partner_id = ${P(key)}`)
const keepOffer = (name: string, r: string, key: string) => keep(name, `select id from public.partner_offers where request_id = '${r}' and partner_id = ${P(key)} order by created_at desc limit 1`)
const receipt = (r: string) =>
  `insert into public.job_photos (request_id, kind, uploaded_partner_id, status, storage_path, sha256, decided_at)
     values ('${r}', 'receipt', ${P('a')}, 'ready', gen_random_uuid() || '.jpg', repeat('b', 64), now());`
const proposeSql = (r: string) => `public.propose_change('${U.pa}', 'aal2', '${r}', ${CUR(r)}, '{"hours":6}'::jsonb, 80000, ${RECEIPTS(r)})`
const photo = (r: string) =>
  `select set_config('app.mv_photo_request', '${r}', true);
   insert into public.request_photos (request_id, storage_path) select '${r}', s.customer_id::text || '/' || s.client_ref::text || '/' || gen_random_uuid() || '.jpg' from public.service_requests s where s.id = '${r}';
   select set_config('app.mv_photo_request', '', true);`
const objectsFor = (r: string, kind: string) =>
  `insert into storage.objects (bucket_id, name) select 'job-photos', j.storage_path from public.job_photos j where j.request_id = '${r}' and j.kind = '${kind}'
     and not exists (select 1 from storage.objects o where o.bucket_id = 'job-photos' and o.name = j.storage_path);`
const readyPhotos = (r: string) =>
  `insert into public.job_photos (request_id, kind, source_photo_id, status, storage_path, sha256, decided_at)
     select request_id, 'request', id, 'ready', gen_random_uuid() || '.jpg', repeat('a', 64), now() from public.request_photos where request_id = '${r}';
   ${objectsFor(r, 'request')}`
const obj = (name: string, age = '0 seconds') => `insert into storage.objects (bucket_id, name, created_at) values ('job-photos', '${name}', now() - interval '${age}');`
const outboxRow = (key: string) =>
  `insert into public.outbox (kind, recipient_kind, recipient_id, dedupe_key, status, attempts) values ('listing_new', 'partner', gen_random_uuid(), 'o36:${key}', 'pending', 0);
   select set_config('app.o36_${key}', (select id::text from public.outbox where dedupe_key = 'o36:${key}'), true);`
const CLAIM_ALL = 'perform count(*) from public.photo_claim(50)'

export const SETUP: Record<Welt, (c: Ctx) => string> = {
  angebot: () => `${BASE}
    ${req(R.o1, 'range')} ${dist(R.o1)} ${keepListing('l_o1_a', R.o1, 'a')}
    ${req(R.o2, 'range')} ${dist(R.o2)} ${offer(U.pa, 'a', R.o2, 150000)} ${offer(U.pb, 'b', R.o2, 160000)}
    ${req(R.o3, 'range')} ${dist(R.o3)} ${offer(U.pb, 'b', R.o3, 150000)} ${keepOffer('o_o3_b', R.o3, 'b')}
    ${req(R.o4, 'range')} ${dist(R.o4)} ${keepListing('l_o4_c', R.o4, 'c')}
    ${req(R.o5, 'range')}
    ${req(R.o6, 'range')} ${dist(R.o6)}`,
  auftrag: (c) => `${BASE}
    ${req(R.q0, 'fixed')} ${dist(R.q0)}
    ${accepted(c, R.j1, ago('2 hours'))} ${accepted(c, R.j2, ago('2 hours'), 'b')} ${accepted(c, R.j3, ago('2 hours'), 'b')}
    ${accepted(c, R.j4)} ${receipt(R.j4)} ${accepted(c, R.j5)} ${receipt(R.j5)} select ${proposeSql(R.j5)}; ${keep('r_j5', `select id from public.price_revisions where request_id = '${R.j5}' and source = 'change_order' and status = 'proposed'`)}
    ${accepted(c, R.c1, later('5 days'), 'b')} ${accepted(c, R.c2, later('5 days'))} ${accepted(c, R.c3, ago('2 hours'), 'b')}`,
  verwaltung: () => `${BASE}
    ${register(U.pn, 'n')}
    ${asUser(U.pa, 'aal2', `insert into public.partner_documents (id, kind) values ('${DOC}', 'other');`)}
    select public.admin_create_price_version('${U.adm}', 9996, date '2999-01-01', 'probe');
    select public.admin_set_price_config('${U.adm}', 9996, 'a', 1, 'cent', 'a');
    select public.publish_version('${U.adm}', 9996);
    select public.admin_create_price_version('${U.adm}', 9995, date '2999-01-01', 'probe');
    select public.admin_set_price_config('${U.adm}', 9995, 'k', 1, 'cent', 'k');`,
  betrieb: (c) => `${BASE}
    ${outboxRow('a')}
    ${req(R.f1, 'fixed')} ${photo(R.f1)} ${readyPhotos(R.f1)} ${dist(R.f1)} ${accept(c, R.f1)}
    ${req(R.f2, 'fixed')} ${photo(R.f2)} ${photo(R.f2)} ${dist(R.f2)}
    insert into storage.objects (bucket_id, name, created_at) values ('request-photos', '${PO}', now() - interval '30 days');
    ${obj(PW, '2 hours')}`,
}

// ---------- Register ----------

/** Nie Ausnahme (Auflage 5 der Planprüfung u3): Geld-, Zuschlags-, Rechte- und Kontaktwege. */
export const NIE_AUSNAHME = [
  'partner_accept', 'partner_accept_basis', 'confirm_offer', 'confirm_offer_basis', 'decide_change', 'decide_change_basis', 'propose_change', 'propose_change_basis',
  'cancel_by_customer', 'cancel_by_customer_basis', 'cancel_by_partner', 'cancel_by_partner_basis', 'admin_correct', 'admin_correct_basis', 'send_offer',
  'payout_preview', 'my_cancel_info', 'my_commissions', 'export_commissions', 'my_jobs', 'my_job_changes', 'my_request_offers', 'quote_save_request', 'start_job', 'complete_job',
  'job_contact', 'register_partner', 'admin_approve_partner', 'admin_set_partner_status', 'admin_grant_role',
] as const satisfies readonly Name[] // ein Tippfehler oder eine entfernte Funktion ist ein Typfehler (check)
type NieAusnahme = (typeof NIE_AUSNAHME)[number]

export const AUSNAHMEN = {
  quote_save_booking: {
    ausfuehren: 's',
    grund: 'Miete gehört zu Phase 2 (docs/ROADMAP.md); es gibt kein Angebot der Vermieter und keine Fixture. Erreichbar nur über `quote` (service_role), endet ohne Zeilen am Fremdschlüssel.',
  },
} as const satisfies Partial<Record<Exclude<Name, NieAusnahme>, Ausnahme>>

const fee = (c: Ctx, s: Split) => `${c.vr}, ${s.feeCents}, ${s.feeNetCents}, ${s.feeVatCents}, ${s.payoutCents}, ${c.fsv}, ${c.vrv}`
const cust = { als: 'authenticated', user: U.cust, aal: 'aal1' } as const
const partnerA = { als: 'authenticated', user: U.pa, aal: 'aal2' } as const
const admin2 = { als: 'authenticated', user: U.adm, aal: 'aal2' } as const
const fremd: { user: string; aal: 'aal1' | 'aal2' }[] = [{ user: U.cust2, aal: 'aal2' }] // Konto ohne Firma und ohne Auftrag
const fremdeFirma = { user: U.pb, aal: 'aal2' } as const // aktive Partner-Firma ohne Bezug zum Auftrag

export const REGISTER: { [N in Exclude<Name, keyof typeof AUSNAHMEN>]: Eintrag<N> } = {
  // ----- Welt angebot: Anfragen mit Listings, Angebote, Bestätigung -----
  send_offer: { ...partnerA, welt: 'angebot', ausfuehren: 'u', ergebnis: 'wert', typ: 'uuid', aufruf: () => `public.send_offer(${LS('l_o1_a')}, 150000)` },
  my_request_offers: {
    ...cust, welt: 'angebot', ausfuehren: 'u', ergebnis: 'zeilen', gegen: fremd,
    spalten: { amount_cents: 'int4', company_name: 'text', offer_id: 'uuid', status: 'enum', valid_until: 'timestamptz' },
    aufruf: () => `public.my_request_offers('${R.o1}')`,
  },
  confirm_offer_basis: {
    als: 'service_role', welt: 'angebot', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { amount_cents: 'int8', fee_schedule_version: 'int4', fee_tiers: 'jsonb', fee_vat_rate: 'numeric', fee_vat_rate_version: 'int4' },
    aufruf: () => `public.confirm_offer_basis('${U.cust}', ${OFF(R.o1, 'a')})`,
  },
  confirm_offer: {
    als: 'service_role', welt: 'angebot', ausfuehren: 's', ergebnis: 'wert', typ: 'text',
    aufruf: (c) => `public.confirm_offer('${U.cust}', ${OFF(R.o1, 'a')}, 150000, ${c.vr}, ${c.offer.feeCents}, ${c.offer.feeNetCents}, ${c.offer.feeVatCents}, ${c.offer.payoutCents}, ${c.fsv}, ${c.vrv})`,
  },
  reject_offers: { ...cust, welt: 'angebot', ausfuehren: 'u', ergebnis: 'void', aufruf: () => `public.reject_offers('${R.o2}')` },
  withdraw_offer: { als: 'authenticated', user: U.pb, aal: 'aal2', welt: 'angebot', ausfuehren: 'u', ergebnis: 'void', aufruf: () => `public.withdraw_offer(${LS('o_o3_b')})` },
  decline_listing: { als: 'authenticated', user: U.pc, aal: 'aal2', welt: 'angebot', ausfuehren: 'us', ergebnis: 'void', aufruf: () => `public.decline_listing(${LS('l_o4_c')})` },
  withdraw: { ...cust, welt: 'angebot', ausfuehren: 'us', ergebnis: 'wert', typ: 'enum', aufruf: () => `public.withdraw('${R.o6}')` },
  // Gegenzeilen zu payout_preview und my_cancel_info (Gebühr nur für Partner lesbar): fee-schedule.test.ts:71, 112 und cancellation-partner-preview.test.ts:186.
  payout_preview: { ...partnerA, welt: 'angebot', ausfuehren: 'u', ergebnis: 'wert', typ: 'int8', aufruf: () => 'public.payout_preview(150000)' },
  distribute_request: { als: 'service_role', welt: 'angebot', ausfuehren: 's', ergebnis: 'wert', typ: 'int4', aufruf: () => `public.distribute_request('${R.o5}')` },

  // ----- Welt auftrag: Annahme, laufende Aufträge, Nachtrag, Storno, Korrektur, Journal -----
  partner_accept_basis: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { fee_schedule_version: 'int4', fee_tiers: 'jsonb', fee_vat_rate: 'numeric', fee_vat_rate_version: 'int4', revision_id: 'uuid', total_cents: 'int8' },
    aufruf: () => `public.partner_accept_basis('${U.pa}', ${LID(R.q0, 'a')})`,
  },
  partner_accept: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'wert', typ: 'uuid',
    aufruf: (c) => `public.partner_accept('${U.pa}', ${LID(R.q0, 'a')}, ${rev1(R.q0)}, ${c.s.payoutCents}, ${fee(c, c.s)})`,
  },
  my_jobs: {
    ...partnerA, welt: 'auftrag', ausfuehren: 'us', ergebnis: 'zeilen', gegen: fremd,
    spalten: {
      accepted_at: 'timestamptz', assignment_id: 'uuid', can_start: 'bool', district: 'int2', ended_at: 'timestamptz', ended_reason: 'enum', listing_id: 'uuid', payout_cents: 'int8',
      preferred_date: 'date', request_id: 'uuid', service: 'enum', status: 'enum', termin_at: 'timestamptz', time_window: 'text', to_district: 'int2', total_cents: 'int8',
    },
    aufruf: () => 'public.my_jobs()',
  },
  my_job_partner: {
    ...cust, welt: 'auftrag', ausfuehren: 'us', ergebnis: 'zeilen', gegen: fremd,
    spalten: { contact_email: 'text', contact_name: 'text', contact_phone: 'text', name: 'text' },
    aufruf: () => `public.my_job_partner('${R.j1}')`,
  },
  job_contact: {
    ...partnerA, welt: 'auftrag', ausfuehren: 'us', ergebnis: 'zeilen', gegen: [...fremd, fremdeFirma],
    spalten: { email: 'text', from_address: 'text', name: 'text', phone: 'text', preferred_date: 'date', stairs_door: 'text', time_window: 'text', to_address: 'text' },
    aufruf: () => `public.job_contact('${R.j1}')`,
  },
  start_job: { ...partnerA, welt: 'auftrag', ausfuehren: 'us', ergebnis: 'void', aufruf: () => `public.start_job('${R.j1}')` },
  report_not_done: { ...cust, welt: 'auftrag', ausfuehren: 'us', ergebnis: 'void', aufruf: () => `public.report_not_done('${R.j2}')` },
  reported_jobs: {
    ...admin2, welt: 'auftrag', ausfuehren: 'u', ergebnis: 'zeilen', gegen: fremd,
    spalten: { not_done_reported_at: 'timestamptz', partner_id: 'uuid', partner_name: 'text', request_id: 'uuid', status: 'text', termin_at: 'timestamptz', total_cents: 'int8' },
    aufruf: () => 'public.reported_jobs()',
  },
  complete_job: { ...cust, welt: 'auftrag', ausfuehren: 'us', ergebnis: 'void', aufruf: () => `public.complete_job('${R.j3}')` },
  propose_change_basis: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { high_cents: 'int8', inputs: 'jsonb', low_cents: 'int8', price_version: 'int4', revision_id: 'uuid', route: 'jsonb', service: 'text', source: 'text', total_cents: 'int8' },
    aufruf: () => `public.propose_change_basis('${U.pa}', 'aal2', '${R.j4}')`,
  },
  propose_change: { als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'wert', typ: 'uuid', aufruf: () => proposeSql(R.j4) },
  my_job_changes: {
    ...partnerA, welt: 'auftrag', ausfuehren: 'us', ergebnis: 'zeilen', gegen: fremd,
    spalten: {
      change_decided_at: 'timestamptz', change_id: 'uuid', change_status: 'text', change_total_cents: 'int8', change_valid_until: 'timestamptz', inputs: 'jsonb', receipt_ids: '_uuid',
      request_id: 'uuid', service: 'enum', source: 'text', total_cents: 'int8',
    },
    aufruf: () => 'public.my_job_changes()',
  },
  decide_change_basis: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: {
      fee_schedule_version: 'int4', fee_tiers: 'jsonb', fee_vat_rate: 'numeric', fee_vat_rate_version: 'int4', prior_fee: 'int8', prior_net: 'int8', prior_payout: 'int8', prior_total: 'int8',
      prior_vat: 'int8', status: 'text', total_cents: 'int8',
    },
    aufruf: () => `public.decide_change_basis('${U.cust}', ${OPEN(R.j4)})`,
  },
  decide_change: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'wert', typ: 'text',
    aufruf: (c) => `public.decide_change('${U.cust}', ${OPEN(R.j4)}, true, 80000, ${fee(c, c.change)})`,
  },
  withdraw_change: { ...partnerA, welt: 'auftrag', ausfuehren: 'u', ergebnis: 'void', aufruf: () => `public.withdraw_change(${LS('r_j5')})` },
  cancel_by_customer_basis: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { fee_base_cents: 'int8', fee_schedule_version: 'int4', fee_tiers: 'jsonb', fee_vat_rate: 'numeric', fee_vat_rate_version: 'int4', request_status: 'text', revision_id: 'uuid', total_cents: 'int8' },
    aufruf: () => `public.cancel_by_customer_basis('${U.cust}', '${R.c1}')`,
  },
  cancel_by_customer: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'wert', typ: 'text',
    aufruf: (c) => `public.cancel_by_customer('${U.cust}', '${R.c1}', 0, ${fee(c, c.zero)})`,
  },
  cancel_by_partner_basis: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { call_out_cents: 'int8', fee_schedule_version: 'int4', fee_tiers: 'jsonb', fee_vat_rate: 'numeric', fee_vat_rate_version: 'int4', request_status: 'text', revision_id: 'uuid', total_cents: 'int8' },
    aufruf: () => `public.cancel_by_partner_basis('${U.pa}', 'aal2', '${R.c2}', 'other')`,
  },
  cancel_by_partner: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'wert', typ: 'text',
    aufruf: (c) => `public.cancel_by_partner('${U.pa}', 'aal2', '${R.c2}', 'other', null, 0, ${fee(c, c.zero)})`,
  },
  // die Absage-Karte des Kunden: Pauschale aus dem Journal, erst nach der Absage der Firma (c2)
  my_cancel_info: { ...cust, welt: 'auftrag', ausfuehren: 'us', ergebnis: 'wert', typ: 'int8', aufruf: () => `public.my_cancel_info('${R.c2}')` },
  partner_quality: {
    ...admin2, welt: 'auftrag', ausfuehren: 'u', ergebnis: 'zeilen', gegen: fremd,
    spalten: { cancels: 'int8', last_cancel_at: 'timestamptz', needs_review: 'bool', partner_id: 'uuid' },
    aufruf: () => 'public.partner_quality()',
  },
  admin_correct_basis: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: {
      call_out_cents: 'int8', customer_fee_base_cents: 'int8', fee_schedule_version: 'int4', fee_tiers: 'jsonb', fee_vat_rate: 'numeric', fee_vat_rate_version: 'int4', request_status: 'text',
      revision_id: 'uuid', total_cents: 'int8',
    },
    aufruf: () => `public.admin_correct_basis('${U.adm}', 'aal2', '${R.c3}')`,
  },
  admin_correct: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'wert', typ: 'text',
    aufruf: (c) => `public.admin_correct('${U.adm}', 'aal2', '${R.c3}', 'cancel_partner', '${REASON}', 'other', 0, ${fee(c, c.zero)})`,
  },
  my_commissions: {
    ...partnerA, welt: 'auftrag', ausfuehren: 'us', ergebnis: 'zeilen', gegen: fremd,
    spalten: {
      entry_id: 'uuid', request_id: 'uuid', partner_id: 'uuid', partner_name: 'text', kind: 'enum', reverses_entry_id: 'uuid', created_at: 'timestamptz', total_cents: 'int8', fee_schedule: 'text',
      fee_net_cents: 'int8', fee_vat_cents: 'int8', fee_cents: 'int8', payout_cents: 'int8', vat_rule: 'enum', request_status: 'enum', ended_at: 'timestamptz', billing_month: 'date',
    },
    aufruf: () => 'public.my_commissions(null)',
  },
  export_commissions: {
    als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: {
      entry_id: 'uuid', request_id: 'uuid', partner_id: 'uuid', partner_name: 'text', kind: 'enum', reverses_entry_id: 'uuid', created_at: 'timestamptz', total_cents: 'int8', fee_schedule: 'text',
      fee_net_cents: 'int8', fee_vat_cents: 'int8', fee_cents: 'int8', payout_cents: 'int8', vat_rule: 'enum', request_status: 'enum', ended_at: 'timestamptz', billing_month: 'date',
    },
    aufruf: () => `public.export_commissions('${U.adm}', ${today})`,
  },
  delete_account: { als: 'service_role', welt: 'auftrag', ausfuehren: 's', ergebnis: 'void', aufruf: () => `public.delete_account('${U.cust2}')` },

  // ----- Welt verwaltung: Partner, Preisversionen, Einstellungen, öffentliche Lesefunktionen -----
  register_partner: { als: 'authenticated', user: U.pr, aal: 'aal1', welt: 'verwaltung', ausfuehren: 'u', ergebnis: 'wert', typ: 'uuid', aufruf: () => `public.register_partner(${regArgs()})` },
  admin_approve_partner: {
    als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'void',
    aufruf: () => `public.admin_approve_partner('${U.adm}', ${P('n')}, array['move']::public.partner_service[], 'standard_20', null)`,
  },
  admin_set_partner_status: { als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'void', aufruf: () => `public.admin_set_partner_status('${U.adm}', ${P('n')}, 'suspended', '${REASON}')` },
  admin_set_partner_scope: {
    als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'void',
    aufruf: () => `public.admin_set_partner_scope('${U.adm}', ${P('n')}, array['move']::public.partner_service[], array[17, 18]::smallint[], null)`,
  },
  admin_set_partner_master: {
    als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'void',
    aufruf: () => `public.admin_set_partner_master('${U.adm}', ${P('n')}, 'Testfirma GmbH', 'gmbh', 'ATU12345678', false, 'Teststraße 1', '1010', 'Wien', null, null)`,
  },
  admin_set_vat_rule: {
    als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'void',
    aufruf: () => `public.admin_set_vat_rule('${U.adm}', ${P('n')}, 'standard_20', ${today} + 1, null)`,
  },
  admin_remove_partner_document: { als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'void', aufruf: () => `public.admin_remove_partner_document('${U.adm}', '${DOC}', null)` },
  admin_grant_role: { als: 'owner', welt: 'verwaltung', ausfuehren: '', ergebnis: 'void', aufruf: () => `public.admin_grant_role('${U.cust2}', 'customer')` },
  admin_create_price_version: { als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'void', aufruf: () => `public.admin_create_price_version('${U.adm}', 9994, date '2999-01-01', 'probe')` },
  admin_set_price_config: { als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'void', aufruf: () => `public.admin_set_price_config('${U.adm}', 9995, 'j', 1, 'cent', 'j')` },
  publish_version: { als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'wert', typ: 'text', aufruf: () => `public.publish_version('${U.adm}', 9995)` },
  verify_price_version: { als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'void', aufruf: () => 'public.verify_price_version(9996)' },
  price_version_hold: {
    als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { hold_minutes: 'numeric', is_current: 'bool', replaced_at: 'timestamptz', started: 'bool' },
    aufruf: () => 'public.price_version_hold(1)',
  },
  admin_set_setting: { als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'void', aufruf: () => `public.admin_set_setting('${U.adm}', 'cancel_free_hours', 24, ${today} + 60, null)` },
  booking_open: { als: 'anon', welt: 'verwaltung', ausfuehren: 'aus', ergebnis: 'wert', typ: 'bool', aufruf: () => 'public.booking_open()' },
  booking_terms: { als: 'anon', welt: 'verwaltung', ausfuehren: 'aus', ergebnis: 'wert', typ: 'jsonb', aufruf: () => 'public.booking_terms()' },
  quote_district: {
    als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { district: 'int2', in_austria: 'bool', in_vienna: 'bool' },
    aufruf: () => 'public.quote_district(16.3731, 48.2086)',
  },
  route_geo_facts: {
    als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { from_in_austria: 'bool', outside_km: 'float8', to_in_austria: 'bool' },
    aufruf: () => `public.route_geo_facts('{"type":"LineString","coordinates":[[16.3731,48.2086],[15.4395,47.0707]]}', 48.2086, 16.3731, 47.0707, 15.4395)`,
  },
  take_rate_tokens: { als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'wert', typ: 'bool', aufruf: () => `public.take_rate_tokens('[]'::jsonb)` },
  quote_save_request: {
    als: 'service_role', welt: 'verwaltung', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { created: 'bool', id: 'uuid', needs_quote: 'bool', status: 'enum' },
    aufruf: () => {
      const snap = `'{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961,"lines":[{"key":"a","cents":68961}],"terms":{"cancel_free_hours":48,"cancel_late_percent":50,"cancel_full_percent":100,"cancel_full_days_before":1,"call_out_fee_cents":0,"termsHash":"${'a'.repeat(64)}"}}'::jsonb`
      const confirmed = `'{"shown":{"kind":"price","totalCents":68961,"lowCents":68961,"highCents":68961},"termsHash":"${'a'.repeat(64)}"}'::jsonb`
      const [t, f, j] = ['null::text', 'null::double precision', 'null::jsonb']
      return `public.quote_save_request(p_customer => '${U.cust}'::uuid, p_client_ref => gen_random_uuid(), p_service => 'move'::public.service_type, p_inputs => '{}'::jsonb, p_snapshot => ${snap},
        p_price_version => (select version from public.current_price_version), p_total => 68961, p_low => 68961, p_high => 68961, p_from_address => ${t}, p_from_lon => ${f}, p_from_lat => ${f},
        p_to_address => ${t}, p_to_lon => ${f}, p_to_lat => ${f}, p_route => ${j}, p_region => null::public.region, p_district => 1::smallint, p_preferred_date => ${today} + 14, p_time_window => ${t},
        p_description => ${t}, p_volume => null::numeric, p_contact => '{"name":"Test Kunde","phone":"+43 660 1234567","email":"kunde@movenow.test","stairsDoor":null}'::jsonb, p_confirmed => ${confirmed})`
    },
  },

  // ----- Welt betrieb: Fotos, Postausgang, Cron-Funktionen -----
  admin_contact: {
    als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { email: 'text', name: 'text', phone: 'text', stairs_door: 'text' },
    aufruf: () => `public.admin_contact('${U.adm}', '${R.f1}', '${REASON}')`,
  },
  admin_photo: {
    als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { bucket_id: 'text', storage_path: 'text' },
    aufruf: () => `public.admin_photo('${U.adm}', '${R.f1}', '${REASON}')`,
  },
  job_photo_list: {
    als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { id: 'uuid', kind: 'text', storage_path: 'text' },
    aufruf: () => `public.job_photo_list('${U.pa}', 'aal2', ${LID(R.f1, 'a')}, null)`,
  },
  photo_receipt_check: { als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'void', aufruf: () => `public.photo_receipt_check('${U.pa}', 'aal2', '${R.f1}')` },
  photo_receipt_add: {
    als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'wert', typ: 'uuid',
    vorher: () => obj(PRC),
    aufruf: () => `public.photo_receipt_add('${U.pa}', 'aal2', '${R.f1}', '${PRC}', repeat('b', 64))`,
  },
  photo_claim: {
    als: 'owner', welt: 'betrieb', ausfuehren: '', ergebnis: 'zeilen',
    spalten: { attempt: 'int4', job_photo_id: 'uuid' },
    aufruf: () => 'public.photo_claim(50)',
  },
  photo_publish_begin: {
    als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'wert', typ: 'text',
    vorher: () => CLAIM_ALL,
    aufruf: () => `public.photo_publish_begin(${JP(R.f2, 0)}, 1)`,
  },
  photo_publish_mark: {
    als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'void',
    vorher: () => obj(PMK),
    aufruf: () => `public.photo_publish_mark(${JP(R.f2, 1)}, 1, true, '${PMK}', repeat('a', 64), null)`,
  },
  photo_purge: {
    als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { bucket_id: 'text', name: 'text' },
    aufruf: () => 'public.photo_purge()',
  },
  photo_orphans: { als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'zeilen', spalten: { name: 'text' }, aufruf: () => 'public.photo_orphans()' },
  photo_staging_interval: { als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'wert', typ: 'interval', aufruf: () => 'public.photo_staging_interval()' },
  photo_cleanup: { als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'void', aufruf: () => 'public.photo_cleanup()' },
  photo_publish_dispatch: { als: 'owner', welt: 'betrieb', ausfuehren: '', ergebnis: 'wert', typ: 'int4', aufruf: () => 'public.photo_publish_dispatch()' },
  outbox_claim: {
    als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'zeilen',
    spalten: { id: 'int8', kind: 'text', partner_email: 'text', recipient_id: 'uuid', recipient_kind: 'text', request_id: 'uuid' },
    aufruf: () => 'public.outbox_claim(5)',
  },
  // void: mit fünf oder mehr fremden offenen Zeilen auf Dev bleibt 'a' ungeclaimt und mark ist ein Leeraufruf; die Wirkung belegt outbox.test.ts.
  outbox_mark: { als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'void', aufruf: () => `public.outbox_mark(current_setting('app.o36_a')::bigint, true, null)` },
  // Nur der Cron (Eigentümer) ruft sie auf (0063); service_role hat kein EXECUTE und kein Recht auf private, vault, net.
  outbox_dispatch: { als: 'owner', welt: 'betrieb', ausfuehren: '', ergebnis: 'void', aufruf: () => 'public.outbox_dispatch()' },
  route_cleanup: { als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'void', aufruf: () => 'public.route_cleanup()' },
  complete_due: { als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'wert', typ: 'int4', aufruf: () => 'public.complete_due()' },
  expire_changes: { als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'wert', typ: 'int4', aufruf: () => 'public.expire_changes()' },
  expire_offers: { als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'wert', typ: 'int4', aufruf: () => 'public.expire_offers()' },
  expire_requests: { als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'wert', typ: 'int4', aufruf: () => 'public.expire_requests()' },
  distribute_pending: { als: 'service_role', welt: 'betrieb', ausfuehren: 's', ergebnis: 'wert', typ: 'int4', aufruf: () => 'public.distribute_pending()' },
}
