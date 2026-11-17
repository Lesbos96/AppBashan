// Setzt die Testdaten auf Dev zurück (dev1, Lösch-Gate): Testnutzer, ihre Anfragen samt Journal, Testfirmen. Nur Dev (Dev-Guard), nur über `npm run loesch`.
//   npm run loesch -- scripts/dev-testdaten-zuruecksetzen.mjs probe
//   npm run loesch -- scripts/dev-testdaten-zuruecksetzen.mjs loeschen <nutzer> <anfragen> <journal> <firmen> <kopien>   (Zahlen der Probe)
// Eine Transaktion, ein CLI-Aufruf, `probe` und `loeschen` laufen mit demselben SQL-Text, nur das Schlusswort (rollback oder commit) unterscheidet sie.
// Die Append-only-Sperren bleiben unverändert: nur im Replica-Fenster (set local, nur diese Transaktion) werden die Journalzeilen der Testanfragen gelöscht
// und deren Revisionskopien (copied_from_revision_id) leer gesetzt; danach gilt wieder origin und die Kaskade der Konten läuft mit allen Triggern.
// Kein Fehlerfang: jeder Fehler rollt alles zurück. audit_log bleibt unberührt.
import './dev-guard.mjs'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { COVER_FIRM, FIRM_MAIL_RE } from '../tests/support/marker.ts'
import { ownerSql } from '../tests/support/owner.ts'

const [modus, ...zahlen] = process.argv.slice(2)
const loeschen = modus === 'loeschen'
if (!(modus === 'probe' && zahlen.length === 0) && !(loeschen && zahlen.length === 5 && zahlen.every((z) => /^\d{1,6}$/.test(z)))) {
  console.error('Aufruf: probe | loeschen <nutzer> <anfragen> <journal> <firmen> <kopien>')
  process.exit(2)
}
const alive = (pid) => { try { process.kill(pid, 0); return true } catch (e) { return e.code === 'EPERM' } }
if (existsSync('tmp/proof/lauf.lock') && alive(JSON.parse(readFileSync('tmp/proof/lauf.lock', 'utf8')).pid)) {
  console.error('Ein Testlauf ist aktiv (tmp/proof/lauf.lock): kein Zurücksetzen.')
  process.exit(2)
}

// Testnutzer: pt-*, live-up-* und die per delete_account anonymisierten (E-Mail leer, deleted_at in auth.users und Profil gesetzt)
const NUTZER = `select u.id from auth.users u where u.email like 'pt-%@movenow.test' or u.email like 'live-up-%@movenow.test'
  or (u.email is null and u.deleted_at is not null and exists (select 1 from public.profiles p where p.id = u.id and p.deleted_at is not null))`
// Testfirmen: Marker-Adresse (nicht die Abdeckungsfirma) oder die Altfirmen vor dem Marker; Mitglieder nur Testnutzer
const FIRMEN = `select p.id from public.partners p
  where ((p.contact_email ~ '${FIRM_MAIL_RE}' and p.name <> '${COVER_FIRM}') or (p.contact_email = 'firma@movenow.test' and p.name = 'Testfirma GmbH'))
  and not exists (select 1 from public.partner_members m where m.partner_id = p.id and m.user_id not in (select id from tu))`

const F8 = `concat_ws('/', (select count(*) from public.fee_schedules), (select count(*) from public.fee_schedule_tiers), (select count(*) from public.price_versions),
  (select count(*) from public.price_config), (select count(*) from public.platform_settings), (select count(*) from public.rental_offers),
  (select count(*) from public.geo_boundaries), (select count(*) from public.geo_districts))`

const erwartung = loeschen
  ? `if (n_u, n_r, n_j, n_f, n_c) is distinct from (${zahlen.join(', ')}) then raise exception 'Zahlen weichen von der Probe ab: % % % % %', n_u, n_r, n_j, n_f, n_c; end if;`
  : ''

const sql = `begin;
set local statement_timeout = '600s';
create temp table tu on commit drop as ${NUTZER};
create temp table tr on commit drop as select s.id from public.service_requests s join tu on tu.id = s.customer_id;
create temp table tf on commit drop as ${FIRMEN};
create temp table zahl (k text primary key, n bigint) on commit drop;
do $reset$
declare
  n_u bigint; n_r bigint; n_j bigint; n_f bigint; n_c bigint; v bigint; w bigint; f record; f8 text := ${F8}; grenze timestamptz := now() - interval '15 minutes';
begin
  select count(*) into n_u from tu;
  select count(*) into n_r from tr;
  select count(*) into n_f from tf;
  select count(*) into n_j from public.commission_entries where request_id in (select id from tr);
  select count(*) into n_c from public.price_revisions where request_id in (select id from tr) and copied_from_revision_id is not null;
  ${erwartung}
  if n_u > 1000 or n_f > 1000 then raise exception 'mehr als 1000 Testnutzer (%) oder Testfirmen (%): nichts gelöscht', n_u, n_f; end if;
  if exists (select 1 from public.partners where name = '${COVER_FIRM}') then raise exception 'Abdeckungsfirma vorhanden: ein Testlauf ist aktiv oder abgebrochen'; end if;
  if exists (select 1 from public.profiles p join tu on tu.id = p.id where p.role <> 'customer') then raise exception 'ein Testnutzer hat nicht die Rolle customer'; end if;
  if exists (select 1 from public.partner_members m join tu on tu.id = m.user_id where m.partner_id not in (select id from tf)) then raise exception 'Testnutzer ist Mitglied einer Nicht-Testfirma'; end if;
  if exists (select 1 from public.commission_entries c where c.request_id in (select id from tr) and c.partner_id not in (select id from tf)) then raise exception 'Journalzeile einer Nicht-Testfirma'; end if;
  if exists (select 1 from public.commission_entries c where c.reverses_entry_id in (select id from public.commission_entries where request_id in (select id from tr)) and c.request_id not in (select id from tr)) then raise exception 'Gegenbuchung außerhalb der Testanfragen'; end if;
  if exists (select 1 from public.service_requests where id in (select id from tr) and created_at > grenze)
    or exists (select 1 from public.commission_entries where request_id in (select id from tr) and created_at > grenze) then raise exception 'Anfrage oder Journalzeile jünger als 15 Minuten: ein Testlauf könnte aktiv sein'; end if;
  if exists (select 1 from storage.objects where bucket_id in ('request-photos', 'job-photos', 'partner-documents')) then raise exception 'Dateien in den Buckets: erst klären'; end if;

  set local session_replication_role = replica;
  delete from public.commission_entries where request_id in (select id from tr);
  get diagnostics v = row_count;
  update public.price_revisions set copied_from_revision_id = null where request_id in (select id from tr) and copied_from_revision_id is not null;
  get diagnostics w = row_count;
  set local session_replication_role = origin;
  if current_setting('session_replication_role') <> 'origin' then raise exception 'session_replication_role nicht zurückgesetzt'; end if;
  if v <> n_j or w <> n_c then raise exception 'Journal % von %, Kopien % von %', v, n_j, w, n_c; end if;
  if exists (select 1 from public.commission_entries where reverses_entry_id is not null and reverses_entry_id not in (select id from public.commission_entries)) then raise exception 'Gegenbuchung ohne Ursprung'; end if;

  delete from auth.users where id in (select id from tu);
  get diagnostics v = row_count;
  if v <> n_u then raise exception 'Nutzer % von %', v, n_u; end if;

  for f in select id from tf order by id loop
    perform set_config('app.mv_partner_delete', f.id::text, true);
    delete from public.partner_documents where partner_id = f.id;
    delete from public.partner_vat_rules where partner_id = f.id;
    delete from public.partner_regions where partner_id = f.id;
    delete from public.partner_categories where partner_id = f.id;
    delete from public.partner_members where partner_id = f.id;
    delete from public.partners where id = f.id;
  end loop;

  if (select count(*) from (${NUTZER}) x) <> 0 then raise exception 'Testnutzer übrig'; end if;
  if (select count(*) from (${FIRMEN}) x) <> 0 then raise exception 'Testfirmen übrig'; end if;
  if exists (select 1 from public.service_requests s where not exists (select 1 from public.profiles p where p.id = s.customer_id)) then raise exception 'Anfrage ohne Profil'; end if;
  if exists (select 1 from public.profiles p where not exists (select 1 from auth.users u where u.id = p.id)) then raise exception 'Profil ohne Konto'; end if;
  if ${F8} <> f8 then raise exception 'Stamm- oder Seed-Daten verändert'; end if;

  insert into zahl values ('nutzer', n_u), ('anfragen', n_r), ('journal', n_j), ('firmen', n_f), ('kopien', n_c);
  insert into zahl select 'bleibt_' || t, c from (values ('nutzer', (select count(*) from auth.users)), ('anfragen', (select count(*) from public.service_requests)),
    ('firmen', (select count(*) from public.partners)), ('journal', (select count(*) from public.commission_entries)), ('audit', (select count(*) from public.audit_log))) a(t, c);
end $reset$;
select k, n from zahl order by k;
${loeschen ? 'commit' : 'rollback'};`

if (loeschen) {
  const dir = 'tmp/dev1-sicherung'
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const sicherung = {
    nutzer: ownerSql(`select id, email from auth.users where id in (${NUTZER})`),
    anfragen: ownerSql(`select id from public.service_requests where customer_id in (${NUTZER})`),
    journal: ownerSql(`select to_jsonb(c) as z from public.commission_entries c where request_id in (select id from public.service_requests where customer_id in (${NUTZER}))`),
  }
  writeFileSync(`${dir}/${stamp}.json`, JSON.stringify(sicherung))
  console.log(`Sicherung: ${dir}/${stamp}.json (${sicherung.nutzer.length} Nutzer, ${sicherung.anfragen.length} Anfragen, ${sicherung.journal.length} Journalzeilen)`)
}

const rows = ownerSql(sql)
for (const r of rows) console.log(`LOESCH-ZAHL ${r.k}=${r.n}`)
const aktiv = Number(ownerSql(`select count(*) as n from pg_trigger where tgname = 'append_only' and tgenabled = 'O' and tgrelid in ('public.commission_entries'::regclass, 'public.audit_log'::regclass)`)[0]?.n)
console.log(`LOESCH-ZAHL appendOnlyAktiv=${aktiv}`)
console.log(loeschen ? 'Gelöscht (commit).' : 'Probe (rollback), nichts verändert.')
if (aktiv !== 2) process.exit(1)
