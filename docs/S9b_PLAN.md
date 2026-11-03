# S9b Partner und Journal: Bauplan

Stand: 2026-11-04. Quelle: `docs/S9_KONZEPT.md` Abschnitt 13 (Zeile S9b, `:649`), 3, 5.1, 5.2, 5.8, 5.10, 6, 9; dazu R11-1, R11-7, R7-4, N-5, N-10, A4c-N3 (`docs/OPEN_ISSUES.md:44, 50, 10, 218, 219, 226`). Format wie `docs/S9a_PLAN.md`. Nur Plan, kein Code, kein SQL zum Ausführen; das vollständige SQL kommt in die Berater-Vorprüfung des jeweiligen Teilschritts.

Entscheidungen Beks, 2026-11-04 („Alle ok, weiter“ zu den Fragen 1–8 der Gliederung): (1) Pflichtangaben der Registrierung wie in 4.1; (2) Statusmaschine wie in 4.1, `rejected` ist Endzustand; (3) `vat_rule` setzt admin bei der Freigabe, Standard `standard_20`, Registrierung nur mit Sitz AT; (4) `rental_provider` bleibt ohne Funktion, `rental` steht im Schema, wird aber bis Phase 2 abgelehnt; (5) TOTP im Dev-Dashboard aktiviert Beks vor S9b-3, Faktor-Reset durch Beks per Dashboard; (6) Dokumente wie in 5.1; (7) Partner ändern nur Kontaktdaten; (8) Satz lesen: jedes Mitglied einer Partnerfirma in jedem Status mit `aal2`, das Aufruf-Skript für admin-Edge-Functions wandert nach S9c.

Kürzel: M01 = `…_0001_foundation.sql`, M03 = `…_0003_policy_recursion.sql`, M11/M17/M18/M20 = `…_0011_photos`, `…_0017_status_machine`, `…_0018_revisions_contacts`, `…_0020_photo_staging`; M15/M16 = `…_0015_versions_published`, `…_0016_settings_admin`; M22 = `…_0022_no_self_upgrade`. Migrationen: `<timestamp>_00NN_<name>.sql` ab 0023 (`npx supabase migration new`).

## 1. Ist-Stand (belegt)

- **Rollen:** `profiles.role` (Enum `user_role`: customer, rental_provider, admin, partner; M01:18, 28-35). `private.my_role()` (M01:37-39), `private.is_admin()` = Rolle admin und JWT `aal2` (M15:10-12), `private.assert_admin(p_actor)` prüft nur die Rolle (M15:55-63). Trigger `guard_role` verlangt den Marker `app.mv_role_grant` (M16:130-147); `admin_grant_role` ist nur für den Eigentümer ausführbar (M16:165-181). `become_rental_provider` ist seit M22 gelöscht.
- **Gebühr:** `platform_settings` (key, version, value, note, effective_from) mit Trigger `guard_platform_setting` (Vorlauf, Unveränderlichkeit; M16:34-65) und View `current_fee_rates` (`security_invoker`, M16:69-78). Select-Policy heute: `my_role() = 'rental_provider' or is_admin()` (M16:188-189); Schreib-Policies und -Grants entfielen (M16:215-218). `booking_terms()` liefert fünf Schlüssel plus Hash, kein `fee_*` (M16:81-104).
- **Journal:** `audit_log` (nur anfügen, Select `is_admin()`, `actor_role` ∈ customer, partner, admin, system, owner; M15:19-51); `private.append_only()` (M15:30-36); `status_events` mit Trigger (M17:153-167). `fee_splits` existiert noch samt Policy `fee_splits_select` (M01:196-215, M16:206-207); `quote` schreibt sie seit S9a-2 nicht mehr.
- **Tests:** Hilfen `ownerSql`, `ownerError`, `asUser(userId, 'aal1'|'aal2', …)`, `asRole`, `probes` in `tests/support/owner.ts:8-63`; `makeUser`, `makeRequest` in `tests/support/db.ts:30, 68`. `aal2` wird **nur als Claim-String** gesetzt (`owner.ts:39`). Kein `mfa.enroll`/`challenge`/`verify`, keine TOTP-Bibliothek in `package.json`. Testdateien unter `tests/rls/`: auth, quote-hardening, quote, route, rls, settings, status, uploads.
- **Auth-Konfiguration:** `supabase/config.toml:304-306`: `[auth.mfa.totp] enroll_enabled = false`, `verify_enabled = false`; `jwt_expiry = 3600` (`:166`). Der Stand des Dev-Projekts im Dashboard ist nicht geprüft.
- **Redproof-Muster:** `scripts/redproof-s9a4.mjs`: `import './dev-guard.mjs'` zuerst (`:9`), `snapshot()` (`:31-49`: Policies auf `request_photos`/`platform_settings`/`storage.objects`, Trigger mit `tgenabled`, Funktionen mit md5/Eigentümer/`prosecdef`/`proconfig`, Spaltendefaults, Tabellen- und Spalten-ACL, RLS-Flag), `probe()` (`:103-109`, Rollback, Ist-Wert aus temporärer Tabelle), `INNER` (`:481-495`: nur in der Probe-Transaktion geöffnete Objekte), Wiederherstellung in `runSql` (`:150-172`, Restore-SQL nach `tmp/proof/`), `same = before === after` (`:698`). Lücke A4c-N3: `INNER` öffnet Objekte (`audit_log`, `price_revisions`, `request_contacts`), die der Snapshot nicht erfasst.
- **Konzept-Widerspruch (wird in S9b-1 im Konzept bereinigt):** `S9_KONZEPT.md:338` nennt `my_partner_id() is not null` für „alle Partner-Konten unabhängig vom Status“; `my_partner_id()` liefert aber nur bei `active` und `aal2` (5.2). Der Plan führt dafür `private.my_member_partner_id()` ein.

## 2. Regeln für alle Teile

- **Fehlercodes** wie S9a: Trigger- und Funktionsfehler SQLSTATE `P0001`, Meldung = Code; Rechtefehler `42501`; Unique `23505`; Check `23514`; Fremdschlüssel `23503`. Neue Codes: `invalid_transition`, `field_immutable`, `append_only`, `not_admin` (42501), `not_found`, `already_member`, `rental_not_enabled`, `scope_incomplete`, `vat_rule_missing`, `partner_not_active`, `rate_mismatch`, `amount_mismatch`, `limit_reached`, `reason_required`. Tests prüfen SQLSTATE **und** Meldung.
- **Positivkontrolle:** jeder „0 Zeilen“- und „verweigert“-Test hat im selben Test einen erlaubten Gegenfall.
- **Rot-zuerst:** Tests entstehen vor der Migration und laufen rot (Liste je Teilschritt, Abschnitt 4–7).
- **Neue Tabellen:** RLS an, `revoke all from anon, authenticated`, gezielte Grants, `revoke insert, update, delete, truncate from service_role` (DML nur über Funktionen), unveränderliche Tabellen mit Trigger `append_only` einschließlich `before truncate`.
- **Funktionen:** SECURITY DEFINER mit Eigentümer `postgres` und `search_path = ''`; `revoke all … from public`. Jede `admin_*`-Funktion hat `p_actor uuid` als ersten Parameter und ruft `private.assert_admin(p_actor)`; `p_actor` stammt nie aus Anfragedaten, die Funktionen sind für Nutzer-JWTs nicht ausführbar (Grant nur `service_role`; der Eigentümer in der SQL-Konsole kann sie ausführen). Keine Admin-Funktion für Nutzer-JWTs in S9b.
- **Marker** im Namensraum `app.mv_*` (transaktionslokal, enthält den Übergang `von>nach`, wird nach dem UPDATE gelöscht).
- **Kein Status setzender Helfer in Migrationen.** Test-Fixtures setzen Status über die Admin-Funktionen (`service_role`), nicht über Marker.
- **MFA/`aal2`:** Alle Partner-Aktionen und Fach-Lesezugriffe prüfen `auth.jwt() ->> 'aal' = 'aal2'` **in Helfer, Policy oder Funktion**, nie nur in der Oberfläche oder der Edge Function. Ausnahmen mit `aal1`: Registrierung (`register_partner`, noch ein Kunde) und Lesen der eigenen Firma samt Mitgliedszeile (damit die MFA-Einrichtung möglich ist). Kunden brauchen kein MFA.
- **Testdaten:** Lauf-Kennung im Firmennamen (`mvtest-<lauf>`); Tests räumen Firmen, Konten und Dateien selbst. Firmen löscht nur der Eigentümer (Marker, Abschnitt 4.2) und nie solche mit Journalzeilen.
- Alle Befehle schreiben `EXIT=` ins Log (PowerShell `; "EXIT=$LASTEXITCODE"`); Nachweise nach `docs/proof/s9bN/`, vorher `npm run scan:proof`.

## 3. Schnitt

| Teil | Ziel | Migration | Berater |
|---|---|---|---|
| S9b-1 | Partnerkern: Tabellen, Statusmaschine, Helfer, RLS, Registrierung | 0023_partners | ja (Rollen, RLS, Auth) |
| S9b-2 | Admin-Funktionen, Stammdaten, Dokumente | 0024_partner_admin | ja |
| S9b-3 | Echte TOTP-Tests, Satz lesen (N-10), `rental_provider` ohne Leserecht | 0025_partner_fee_read | ja (Auth, Gebühr) |
| S9b-4 | Journal `commission_entries`, `fee_splits` entfällt | 0026_commission_journal | ja (Geld) |

Reihenfolge ist eine Kette. Jeder Teil ist in einer Session machbar: S9b-1 und S9b-4 sind die größten (je ein Schema-Block, keine Oberfläche, keine Edge Function). Das Kundenflow-Verhalten ändert sich in keinem Teil. S9b hat keine UI: keine `shots`, kein E2E (folgt in S9i); `reviewer` im Modus „Abnahme“.

## 4. S9b-1 Partnerkern und Registrierung

**Ziel.** Eine Firma mit Statusmaschine, vier getrennte Zuständigkeitsprüfungen, strikte RLS; ein Kunde kann eine Firma im Status `pending` beantragen. Niemand schreibt `partner_members` oder fremde Firmen.

### 4.1 Datenmodell (Eigentümer aller Objekte: `postgres`)

Enums: `partner_status` (pending, active, payment_hold, suspended, rejected); `partner_service` (transport, move, clearance, assembly, **rental**); `partner_vat_rule` (standard_20, reverse_charge, none); `partner_role` (owner, staff).

```sql
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  legal_form text not null check (legal_form in ('einzelunternehmen','eu','gmbh','og','kg','sonstige')),
  country text not null default 'AT' check (country = 'AT'),            -- Phase 1: nur Sitz Österreich
  uid text check (uid ~ '^ATU[0-9]{8}$'),
  small_business boolean not null default false,                         -- Selbstauskunft Kleinunternehmer
  address_street text not null, address_postcode text not null check (address_postcode ~ '^[0-9]{4}$'), address_city text not null,
  contact_name text not null, contact_phone text not null, contact_email text not null,   -- Längen-Checks wie profiles
  status public.partner_status not null default 'pending',
  status_reason text, status_changed_at timestamptz,                      -- Begründung sieht der Partner (P2B Art. 4)
  payout_model text not null default 'direct' check (payout_model in ('direct','connect')),
  stripe_account_id text,                                                 -- Phase 2, nur admin_set_partner_master
  terms_version text not null, terms_accepted_at timestamptz not null,
  verified_at timestamptz, verified_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (small_business or uid is not null)                               -- UID Pflicht außer Kleinunternehmer
);
create table public.partner_members (
  partner_id uuid not null references public.partners (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.partner_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (partner_id, user_id),
  unique (user_id)                                                        -- höchstens eine Firma je Konto
);
create table public.partner_categories (partner_id uuid not null references public.partners (id) on delete restrict, service public.partner_service not null, primary key (partner_id, service));
create table public.partner_regions   (partner_id uuid not null references public.partners (id) on delete restrict, district smallint not null check (district between 1 and 23), primary key (partner_id, district));
create table public.partner_vat_rules (id bigint generated always as identity primary key, partner_id uuid not null references public.partners (id) on delete restrict,
  rule public.partner_vat_rule not null, valid_from date not null, created_at timestamptz not null default now(), unique (partner_id, valid_from));
```

Trigger (alle `search_path = ''`, Fehler `P0001`):
- `guard_partner_insert` (BEFORE INSERT): Status nur `pending`; `verified_*`, `status_reason`, `stripe_account_id` null; `payout_model = 'direct'`.
- `guard_partner_status` (BEFORE UPDATE): wenn sich `status` ändert, **zwei getrennte Prüfungen**: (a) das Paar steht in der Tabelle 4.2, sonst `invalid_transition`; (b) der Marker `app.mv_partner_status` ist `alt>neu`, sonst `invalid_transition`. Gleicher Status ist kein Statuswechsel. `status_reason`/`status_changed_at` ändern sich nur mit Statuswechsel.
- `guard_partner_fields` (BEFORE UPDATE): `id`, `created_at`, `country`, `terms_*` unveränderlich (`field_immutable`); `name`, `legal_form`, `uid`, `small_business`, `address_*`, `payout_model`, `stripe_account_id`, `verified_*` nur mit dem Marker `app.mv_partner_master` (`field_immutable`). Frei für die Firma bleiben nur `contact_*` (Spalten-Grant).
- `guard_partner_delete` (BEFORE DELETE und TRUNCATE): verboten ohne den Marker `app.mv_partner_delete` = Firmen-ID; **keine Funktion in einer Migration setzt ihn**, nur Eigentümer-SQL in Tests. `ON DELETE RESTRICT` des Journals (S9b-4) schützt Firmen mit Buchungen.
- `append_only` auf `partner_vat_rules` (UPDATE/DELETE/TRUNCATE); `set_updated_at` auf `partners` (wie M01:231).

### 4.2 Statusmaschine der Partnerfirma (Übergänge nur über Funktionen)

| Von → Nach | Funktion | Akteur | Begründung Pflicht |
|---|---|---|---|
| (neu) → `pending` | `register_partner` | Kunde (`aal1`) | nein |
| `pending` → `active` | `admin_approve_partner` (S9b-2) | admin | nein |
| `pending` → `rejected` | `admin_set_partner_status` | admin | ja |
| `active` → `payment_hold` / `suspended` | `admin_set_partner_status` | admin | ja |
| `payment_hold` → `active` / `suspended` | `admin_set_partner_status` | admin | ja |
| `suspended` → `active` | `admin_set_partner_status` | admin | ja |

Alle anderen Paare (insbesondere alles aus `rejected`, `active → pending`, `suspended → payment_hold`) sind verboten (`invalid_transition`). Die Funktionen sperren die Zeile (`select … for update`), vergleichen den Ausgangsstatus (Compare-and-Set) und setzen den Marker erst unmittelbar vor dem UPDATE. `rejected` ist Endzustand; die Mitgliedszeile bleibt, ein zweiter Antrag desselben Kontos ist wegen `unique (user_id)` nicht möglich. Das Schließen offener Listings und Angebote beim Wechsel nach `payment_hold`/`suspended` (Konzept 3) gehört zu S9c/S9e: deren Migrationen erweitern `admin_set_partner_status` in derselben Transaktion; S9b dokumentiert das als Pflicht in `OPEN_ISSUES.md`.

### 4.3 Rechte

**Helfer** (SECURITY DEFINER, `stable`, `search_path = ''`, `revoke all from public`, EXECUTE `authenticated` wie `my_role()`/`is_admin()`; Schema `private` wird von der API nicht ausgeliefert):
- `private.partner_of_user()`: Firmen-ID des Mitglieds, **jeder Status, jedes `aal`** (für Policies der eigenen Firma, Registrierung, MFA-Einrichtung).
- `private.my_member_partner_id()`: Mitglied, jeder Status, **`aal2`** (Fach-Lesezugriffe: Satz, Journal; Partner-Schreiben).
- `private.my_partner_id()`: Mitglied, Status `active`, `aal2` („darf annehmen“).
- `private.my_job_partner_id()`: Mitglied, Status `active` oder `payment_hold`, `aal2` („darf zugeordnete Aufträge abwickeln“).

**Grants und Policies**

| Tabelle | anon | Kunde ohne Firma | Mitglied `aal1` | Mitglied `aal2` | admin `aal2` | service_role |
|---|---|---|---|---|---|---|
| `partners` | – | – | S eigene Firma | S eigene; U nur `contact_*` bei Status pending/active/payment_hold | S | nur S (kein DML) |
| `partner_members` | – | – | S eigene Firma | S eigene Firma | S | nur S |
| `partner_categories`, `partner_regions`, `partner_vat_rules` | – | – | S eigene Firma | S eigene Firma | S | nur S |

Policies `partners_select`/`partner_members_select`/… `using (partner_id = (select private.partner_of_user()) or (select private.is_admin()))`; `partners_update_contact` `using/with check (id = (select private.my_member_partner_id()) and status in ('pending','active','payment_hold'))`, Spalten-Grant `update (contact_name, contact_phone, contact_email)`. Kein INSERT/UPDATE/DELETE-Grant auf `partner_members`, `partner_categories`, `partner_regions`, `partner_vat_rules` für `authenticated` (R7-4). Die Policies verwenden nur SECURITY-DEFINER-Helfer, damit keine Rekursion entsteht (M03).

**Neue EXECUTE-Freigabe an `authenticated` (Entscheidung Beks nötig, Abschnitt 8):** `public.register_partner(p_name, p_legal_form, p_uid, p_small_business, p_street, p_postcode, p_city, p_contact_name, p_contact_phone, p_contact_email, p_districts smallint[], p_terms_version text) returns uuid`. Begründung: einziger Weg zur Firma, Kunden haben kein INSERT. Ablauf: `auth.uid()` ist Pflicht (sonst 42501); prüft Eingaben (Bezirke 1–23, mindestens einer, ohne Duplikate); legt **immer eine neue** Firma `pending` samt `owner` für `auth.uid()` an und nimmt nie eine `partner_id` entgegen; zweiter Aufruf desselben Kontos → `already_member` (`23505`); schreibt `partner_regions` (Bezirke legt die Registrierungsfunktion an, R7-4) und eine `audit_log`-Zeile (`actor_role = 'customer'`, `action = 'register_partner'`). Kategorien und `vat_rule` setzt nur admin (S9b-2). Kein Grant an `anon` oder `service_role`.

**DEFINER-Allowlist (tests/rls, N-9):** neu `private.partner_of_user`, `private.my_member_partner_id`, `private.my_partner_id`, `private.my_job_partner_id` (EXECUTE authenticated, begründet oben) und `public.register_partner` (EXECUTE authenticated). Die Trigger-Funktionen `private.guard_partner_*` ohne EXECUTE. Der Test wird um diese Zeilen erweitert; jede weitere Funktion mit EXECUTE für `anon`/`authenticated` lässt ihn rot werden. `booking_terms()` bleibt unverändert.

### 4.4 Tests (Rot-zuerst, `tests/rls/partners.test.ts`; Hilfe `tests/support/partner.ts`)

- Helfer-Matrix: {Nichtmitglied, Mitglied} × {pending, active, payment_hold, suspended, rejected} × {`aal1`, `aal2`} für alle vier Helfer (Claim-Ebene über `asUser`; Ist-Wert = zurückgegebene ID oder NULL). Erwartung: `my_partner_id` nur active+`aal2`; `my_job_partner_id` active/payment_hold+`aal2`; `my_member_partner_id` jeder Status mit `aal2`; `partner_of_user` jeder Status, jedes `aal`.
- `register_partner`: erlaubt (Kunde `aal1`) mit Gegenfall; ohne Anmeldung → 42501; zweiter Aufruf → `already_member`/23505; Bezirk 0 oder 24 → 23514; keine Bezirke → `scope_incomplete`; `country` ≠ AT, UID ohne Kleinunternehmer fehlend → 23514.
- RLS: Mitglied A liest Firma B / Mitglieder B / Kategorien B → 0 Zeilen (Positivkontrolle eigene); Kunde ohne Firma sieht nichts; `anon` → 42501.
- Rechte: Mitglied ändert `name`/`status`/`uid` → 42501 (Spalten-Grant); ändert `contact_phone` → ok; `partner_members` INSERT/UPDATE/DELETE (`partner_id`, `role`) → 42501; Kategorie einfügen → 42501; Mitglied mit `aal1` ändert Kontakt → 0 Zeilen (Policy).
- Statusmaschine: jedes verbotene Paar → `invalid_transition` (Paar ohne Marker, ungültiges Paar mit Marker getrennt); INSERT mit Status `active` → `invalid_transition`; DELETE ohne Marker → `field_immutable`; `service_role`-DML → 42501; `unique (user_id)` → 23505.
- Fixtures: Status nur über Registrierung; weitere Status erst mit S9b-2.

### 4.5 Rot-Beweise (`scripts/redproof-s9b.mjs --only s9b-1`, Ist-Wert nach M-3)

Je Sperre einzeln lockern, committen, den Test laufen lassen (rot, richtige Meldung), Original wiederherstellen, Definitionen vergleichen:
1. Paar-Prüfung entfernen → Ist-Wert: `update partners set status='rejected'` aus `active` gelingt, Zeile zurückgelesen = `rejected`.
2. Marker-Prüfung entfernen → Ist-Wert: gültiges Paar ohne Marker geht durch.
3. `aal2`-Klausel in `my_partner_id`/`my_job_partner_id`/`my_member_partner_id` entfernen → Ist-Wert: mit Claim `aal1` liefert der Helfer die Firmen-ID.
4. Statusklausel in `my_partner_id` entfernen → Ist-Wert: Firma `payment_hold` liefert die ID.
5. Select-Policy `partners_select` auf `true` lockern → Ist-Wert: Fremdkonto sieht N Firmen statt 0.
6. Spalten-Grant erweitern (`name`) → Ist-Wert: UPDATE gelingt, Name zurückgelesen geändert.
7. `revoke … from service_role` zurücknehmen → Ist-Wert: `insert into partners` als `service_role` gelingt.
8. Grant `insert` auf `partner_members` → Ist-Wert: Fremdes Mitglied lässt sich in aktive Firma eintragen (Zeile vorhanden).
9. `guard_partner_delete` abschalten → Ist-Wert: DELETE ohne Marker entfernt die Zeile.
Schichten (eine zweite Sperre greift) werden als „Schicht“ getrennt ausgewiesen (Methode M-3). Bericht `tmp/proof/s9b-1-rotbeweis.md`.

### 4.6 Akzeptanzkriterien (alle Exit 0, Befehl → Nachweis)

1. `npm run check` → `tmp/proof/s9b-1-check.log`.
2. `npm run test:rls` → `tmp/proof/s9b-1-rls.log` (inkl. Allowlist-Test).
3. `node scripts/redproof-s9b.mjs --only s9b-1` → `tmp/proof/s9b-1-rotbeweis.md` (alle Sperren rot, Restprüfung grün).
4. `npx dotenv -e .env.local -- npx supabase migration list --linked` → lokal = remote bis 0023.
5. `npm run db:types`; `npm run build`; `npm run scan:proof`.
6. Konzept-Bereinigung (`S9_KONZEPT.md:338` `my_member_partner_id`, `:649` Aufruf-Skript nach S9c) und `ARCHITECTURE.md`-Abschnitt Partner per Edit; `OPEN_ISSUES.md`: R7-4 erledigt.
**Berater-Vorprüfung:** Schema, Helfer, Trigger, `register_partner` (0023). Frage: Querzugriff zwischen Firmen, Selbstzuweisung, Rekursion, lückenlose Statusmaschine?
**Abhängigkeit:** keine über 0022 hinaus. **Vorübergehend nicht funktionsfähig:** Firmen bleiben `pending` bis S9b-2.

## 5. S9b-2 Admin-Funktionen und Dokumente

**Ziel.** admin prüft, gibt frei, sperrt und pflegt Firmendaten ausschließlich über Funktionen (R11-1, R11-7); Unterlagen liegen in einem privaten Bucket.

### 5.1 Objekte

**Funktionen** (alle SECURITY DEFINER, `search_path = ''`, `revoke all from public, anon, authenticated`, `grant execute to service_role` wie `admin_set_setting`; jede schreibt `audit_log` mit `actor_role = 'admin'` und `p_actor`; die Zeile der Firma wird mit `for update` gesperrt):
- `admin_approve_partner(p_actor, p_partner, p_services partner_service[], p_vat_rule partner_vat_rule, p_note text)`: `pending → active`; verlangt mindestens eine Kategorie, mindestens einen Bezirk, ein Mitglied; lehnt `rental` ab (`rental_not_enabled`, bis Phase 2); schreibt `partner_categories`, `partner_vat_rules` (`valid_from = heute Wien`), `verified_at/by`.
- `admin_set_partner_status(p_actor, p_partner, p_status, p_reason)`: alle Übergänge der Tabelle 4.2 außer Freigabe; `p_reason` Pflicht (mindestens 10 Zeichen, `reason_required`); setzt `status_reason`, `status_changed_at`.
- `admin_set_partner_scope(p_actor, p_partner, p_services, p_districts, p_note)`: ersetzt Kategorien und Bezirke (Löschen und Einfügen in einer Transaktion); `rental` abgelehnt; bei Status `active` je mindestens eins.
- `admin_set_vat_rule(p_actor, p_partner, p_rule, p_valid_from, p_note)`: neue Zeile, `p_valid_from >= heute`, keine rückwirkende Änderung.
- `admin_set_partner_master(p_actor, p_partner, p_name, p_legal_form, p_uid, p_small_business, p_street, p_postcode, p_city, p_stripe_account_id, p_note)`: `null` = unverändert; setzt den Marker `app.mv_partner_master` (R11-7).

**Dokumente:** Tabelle `partner_documents` (`id uuid pk`, `partner_id` FK restrict, `kind` ∈ trade_license, company_register, other, `storage_path text unique not null`, `uploaded_at`); privater Bucket `partner-documents` (10 MB, PDF und JPEG; der Bucket prüft nur den Header, die Dateien gehen nie an Dritte, EXIF ist ohne Belang). Muster wie M11/M20: Insert-Zeile nur (`id`, `kind`), Trigger setzt `partner_id` aus `my_member_partner_id()` und den Pfad `{partner_id}/{id}`; höchstens 5 Zeilen je Firma unter Advisory-Lock (`limit_reached`); Storage-Insert nur in eingetragene Pfade der eigenen Firma, Status pending/active/payment_hold, `aal2`. Lesen nur admin (`is_admin()`, `storage.objects` und Tabelle); der Partner liest und löscht nicht. `partner_documents` ist `append_only` für `authenticated` (kein UPDATE/DELETE-Grant). Löschfrist (90 Tage nach Ablehnung, Rechtsfrage) und Anonymisierung folgen mit S9h.

**Neue EXECUTE-Freigaben an `anon`/`authenticated`:** keine. Allowlist-Test: fünf `admin_*`-Funktionen nur `service_role`.

### 5.2 Tests (Rot-zuerst, `tests/rls/partner-admin.test.ts`)

- Je Funktion erlaubt (`service_role`, `p_actor` = admin-Konto) und verweigert: `authenticated`/`anon` → 42501; `p_actor` = Kunde oder `null` → `not_admin` (42501); unbekannte Firma → `not_found`.
- Statuspfade alle über die Funktionen (gültig: 7 Paare; ungültig: `rejected → active`, `suspended → payment_hold`, `active → pending` → `invalid_transition`); ohne Begründung → `reason_required`; zweite Freigabe → `invalid_transition`.
- `rental` in Freigabe und Scope → `rental_not_enabled`; Freigabe ohne Bezirk/Kategorie → `scope_incomplete`.
- `admin_set_vat_rule` mit Datum in der Vergangenheit → 23514; zweite Regel gleicher Tag → 23505; `partner_vat_rules` UPDATE → `append_only`.
- Stammdaten: Partner ändert `name`/`uid` → 42501; `admin_set_partner_master` ändert → ok, Zeile zurückgelesen; direktes `update` als `service_role` → 42501.
- Audit: je Aufruf genau eine Zeile mit `p_actor`, Aktion, Details.
- Dokumente: eigene Firma lädt hoch (Gegenfall, `aal2`), fremder Pfad → 42501, sechstes → `limit_reached`, `aal1` → 0 Zeilen/42501, Partner liest Datei → 0 Zeilen, admin liest, Kunde ohne Firma → 42501.

### 5.3 Rot-Beweise (`--only s9b-2`)

`assert_admin`-Aufruf je Funktion entfernen (Ist-Wert: Aufruf mit Kunden-`p_actor` ändert die Firma); `revoke … from authenticated` zurücknehmen (Ist-Wert: Aufruf als Nutzer-JWT erfolgreich); `rental`-Prüfung entfernen (Ist-Wert: Kategorie `rental` gespeichert); Begründungs-Prüfung (Ist-Wert: Statuswechsel ohne Grund); `valid_from`-Check (Ist-Wert: Regel in der Vergangenheit gespeichert); Bucket-Policy (Ist-Wert: Upload in fremden Pfad gelingt); Limit-Trigger (Ist-Wert: sechste Zeile vorhanden); Select-Policy Dokumente (Ist-Wert: Partner liest Zeilen).

### 5.4 Akzeptanzkriterien

`npm run check`, `npm run test:rls`, `node scripts/redproof-s9b.mjs --only s9b-2` (→ `tmp/proof/s9b-2-rotbeweis.md`), `migration list` (lokal = remote bis 0024), `db:types`, `build`, `scan:proof`; `OPEN_ISSUES.md`: R11-1, R11-7 erledigt, Eintrag „Schließen offener Listings/Angebote“ für S9c/S9e; `GOLIVE.md`: Dokumenten-Bucket und Faktor-Reset. **Berater-Vorprüfung:** die fünf Funktionen, Bucket-Policies (0024). **Abhängigkeit:** S9b-1.

## 6. S9b-3 MFA, Satz lesen

**Ziel.** `aal2` ist mit echten TOTP-Token gegen Dev bewiesen; Partner-Konten lesen den Gebührensatz, Kunden nicht (N-10); `rental_provider` verliert sein Leserecht.

### 6.1 MFA

- **Vorarbeit (Beks):** TOTP im Dev-Dashboard aktivieren (Auth → MFA), `config.toml:305-306` auf `true` setzen (nur die Datei, **kein** `supabase config push`, der die ganze `config.toml` schiebt). Produktiv: `GOLIVE.md`-Punkt. Faktor-Reset: Beks per Dashboard nach Identitätsprüfung (verlorene Faktoren; Supabase-TOTP kennt keine Wiederherstellungscodes).
- **Bibliothek (nicht installieren, Freigabe in der Plan-Vorprüfung):** `otpauth` als `devDependency` (Base32-Secret aus `mfa.enroll` und TOTP-Erzeugung; Node-Stdlib hat kein Base32). Alternative: `node:crypto` plus eigener Base32-Decoder, nur wenn `otpauth` abgelehnt wird.
- **Testhilfe `tests/support/totp.ts`:** `makeAal2User(tag)`: `makeUser` (Passwort, `aal1`) → `supabase.auth.mfa.enroll({ factorType: 'totp' })` → Code aus `totp.secret` (30 s, aktuelles Fenster) → `mfa.challenge` und `mfa.verify` → Sitzung mit `aal=aal2` → Client mit dem neuen Access-Token. Sequenziell, mit Pause (Auth-Rate-Limits); Faktoren verschwinden mit dem Konto.
- **Durchsetzung nur in der Datenbank:** Helfer, Policies und Funktionen aus 4–5 prüfen `aal2` selbst; S9b enthält keine Edge Function. Admin: `is_admin()` verlangt `aal2` (M15); `admin_*`-Funktionen laufen nur über `service_role`/Eigentümer.

### 6.2 Satz lesen (N-10) und `rental_provider`

- `alter policy platform_settings_select` auf: `(select private.is_admin()) or (key in ('fee_rate','fee_vat_rate') and (select private.my_member_partner_id()) is not null)`. Gilt für alle Zeilen dieser Schlüssel, **auch künftige** (P2B: angekündigter Satz). `rental_provider` kommt in der Policy nicht mehr vor; die Rolle bleibt im Enum ohne Funktion.
- **Spalten-Grant:** `revoke select … from authenticated; grant select (key, version, value, effective_from)` (die Spalte `note` bleibt intern; `current_fee_rates` nutzt nur diese Spalten). In der Session zuerst die Spalten von `platform_settings` aus `information_schema` lesen und die Notizen der `fee_*`-Zeilen prüfen; bestehende Tests, die als admin `note` lesen, ziehen auf Eigentümer-SQL um.
- Kunde ohne Firma und `anon`: kein `fee_*` per API (View liefert NULL-Spalten, Tabelle 0 Zeilen); `booking_terms()` bekommt **keinen** neuen Schlüssel.
- Keine neue SECURITY-DEFINER-Funktion, keine neue EXECUTE-Freigabe.

### 6.3 Tests (Rot-zuerst, `tests/rls/partner-mfa.test.ts`)

- Echte Token: Konto ohne Faktor → JWT `aal1`; nach `verify` → `aal2` (Ist-Wert aus `auth.jwt()` per `select`).
- Matrix aus 4.4/5.2 **noch einmal mit echtem Token gegen PostgREST** (nicht nur Claim): Mitglied `aal1` → Fachobjekte 0 Zeilen/42501; `aal2` → erlaubt; Firma in jedem Status liest den Satz (pending, active, payment_hold, suspended, rejected) mit `aal2`, mit `aal1` 0 Zeilen.
- Verweigert (je mit Gegenfall): Kunde mit `aal2` ohne Firma liest `fee_rate` → 0 Zeilen; Partner liest `fee_notice_days`/`cancel_*` → 0 Zeilen; `rental_provider` (per `ownerGrantRole` gesetzt) liest `fee_rate` → 0 Zeilen; `anon` → 42501; `note` lesen → 42501; Partner schreibt `platform_settings` → 42501; `current_fee_rates` für Kunden liefert NULL.
- Kein `fee_*` in Kundenantworten: `booking_terms()`-Schlüssel gleich der Liste der fünf; `quote`-Antwort ohne Gebühr (bestehender Test bleibt grün).
- Ersatz `quote.test.ts:307-311` und `rls.test.ts:360-395` (Vermieter liest Satz): umgestellt auf Partner-Konten.

### 6.4 Rot-Beweise (`--only s9b-3`)

`aal2`-Klausel der Policy entfernen (Ist-Wert: Mitglied `aal1` liest `fee_rate`-Zeile); Schlüsselfilter entfernen (Ist-Wert: Partner liest `fee_notice_days`); `rental_provider` wieder aufnehmen (Ist-Wert: Rolle liest `fee_rate`); Spalten-Grant erweitern (Ist-Wert: `note` lesbar); Mitgliedsprüfung auf `true` (Ist-Wert: Kunde liest `fee_rate`). Zusätzlich echter Token-Beweis: gelockerte `aal2`-Klausel liefert Zeilen an ein `aal1`-Token.

### 6.5 Akzeptanzkriterien

`npm run check`, `npm run test:rls` (echte TOTP-Tests grün gegen Dev), `node scripts/redproof-s9b.mjs --only s9b-3` (→ `tmp/proof/s9b-3-rotbeweis.md`), `migration list` (bis 0025), `db:types`, `build`, `scan:proof`; `GOLIVE.md` (TOTP produktiv, Reset-Prozess), `OPEN_ISSUES.md` (N-10 erledigt). **Berater-Vorprüfung:** Policy, Spalten-Grant, `config.toml`, Testhilfe. **Abhängigkeit:** S9b-1, S9b-2; Beks hat TOTP im Dev-Projekt aktiviert und die Bibliothek freigegeben. Ohne diese Vorarbeit startet S9b-3 nicht.

## 7. S9b-4 Journal

**Ziel.** Provisionen werden unveränderlich gebucht, Kunden lesen sie nie; `fee_splits` entfällt (Konzept 5.8, 9.2–9.6).

### 7.1 Datenmodell

Enum `commission_kind` (booking, change, cancellation, cancellation_fee, correction).

```sql
create table public.commission_entries (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id) on delete restrict,
  request_id uuid not null references public.service_requests (id) on delete restrict,
  revision_id uuid not null,
  foreign key (revision_id, request_id) references public.price_revisions (id, request_id) on delete restrict,  -- in der Session gegen 0018 prüfen
  kind public.commission_kind not null,
  reverses_entry_id uuid references public.commission_entries (id) on delete restrict,
  total_cents bigint not null, fee_cents bigint not null, fee_net_cents bigint not null, fee_vat_cents bigint not null, payout_cents bigint not null,  -- ganze Cent
  fee_rate numeric(6,5) not null check (fee_rate between 0 and 1), fee_vat_rate numeric(6,5) not null check (fee_vat_rate between 0 and 1),
  vat_rule public.partner_vat_rule not null,
  payment_flow text not null default 'invoice_transfer' check (payment_flow in ('invoice_transfer','connect_fee')),
  price_version int not null references public.price_versions (version),           -- Preisversion der Revision
  fee_rate_version int not null, fee_vat_rate_version int not null,                -- Versionen der platform_settings-Zeilen
  created_at timestamptz not null default now(),
  constraint fee_parts check (fee_net_cents + fee_vat_cents = fee_cents),
  constraint payout_rest check (payout_cents = total_cents - fee_cents),
  constraint reverses_shape check ((kind = 'cancellation') = (reverses_entry_id is not null) or kind = 'correction'),
  constraint non_negative_kinds check (kind not in ('booking','cancellation_fee') or (total_cents >= 0 and fee_cents >= 0 and fee_net_cents >= 0 and fee_vat_cents >= 0 and payout_cents >= 0))
);
create unique index commission_one_booking  on public.commission_entries (request_id) where kind = 'booking';
create unique index commission_one_reversal on public.commission_entries (reverses_entry_id) where reverses_entry_id is not null;
```

`non_negative` und `total_cents >= 0` gelten **nicht** für `change`, `cancellation`, `correction` (Konzept 5.8/9.6).

- **Trigger** `append_only` (UPDATE, DELETE, TRUNCATE) ohne Ausnahme, auch für `service_role`; `revoke update, delete, truncate … from service_role`. Grenze: Der Eigentümer kann Trigger abschalten (Konzept R3); die Restprüfung des Redproofs erfasst `tgenabled`.
- **Trigger `guard_commission_insert`** (BEFORE INSERT, unabhängig von der Funktion): bei `cancellation` jeder Betrag exakt die Negation der gegengebuchten Zeile, gleiche Firma, gleicher Auftrag, gleiche Sätze und `vat_rule` (`amount_mismatch`); bei `booking` entsprechen `fee_rate`/`fee_vat_rate` den zum Buchungszeitpunkt geltenden Zeilen von `platform_settings` (größtes `effective_from ≤ heute Wien`) und `fee_rate_version`/`fee_vat_rate_version` deren Versionen (`rate_mismatch`); bei `change`, `cancellation_fee`, `correction` Sätze und Versionen der `booking`-Zeile desselben Auftrags (Konzept 9.3: eingefrorener Satz); `price_version` stimmt mit der Revision überein.
- **Schreiben nur über** `public.commission_book(p_partner, p_request, p_revision, p_kind, p_reverses, p_total, p_fee_rate, p_fee_vat_rate, p_fee, p_fee_net, p_fee_vat, p_payout) returns uuid`: SECURITY DEFINER, `search_path = ''`, `revoke all from public, anon, authenticated`, `grant execute to service_role`. Die Edge Function (S9c ff.) rechnet mit `splitFee`; die SQL-Seite rechnet **nicht** neu, sondern prüft nur die Identitäten (CHECKs, Trigger) und die Sätze (`splitFee` bleibt die einzige Stelle, Konzept 9.1). Die Funktion liest die `vat_rule` selbst (gültige Regel zum Buchungstag aus `partner_vat_rules`, sonst `vat_rule_missing`), lehnt `booking` für Firmen ≠ `active` ab (`partner_not_active`) und lässt die übrigen Arten für jede Firma außer `pending`/`rejected` zu. Die Prüfung „Firma ist dem Auftrag zugeordnet“ kommt mit `assignments` in S9c (dort Pflichtzeile in der Migration; S9b dokumentiert sie in `OPEN_ISSUES.md`).
- **Bezug auf Version:** `price_version`, `revision_id`, `fee_rate_version`, `fee_vat_rate_version` je Zeile.
- `fee_splits`: `drop table public.fee_splits` samt Policy (vorher in Migrationen, `supabase/functions` und `src/` nach Resten suchen); `ARCHITECTURE.md`-Zeilen 21, 32, 51 und Konzept 2.1/9.6 nachziehen.

### 7.2 RLS

| Tabelle | anon | Kunde | Mitglied `aal1` | Mitglied `aal2` (eigene Firma, jeder Status) | Mitglied fremde Firma | admin `aal2` | service_role |
|---|---|---|---|---|---|---|---|
| `commission_entries` | – | – (kein Grant, keine Policy) | 0 Zeilen | S | 0 Zeilen | S | nur über `commission_book` (kein DML) |

Policy `commission_entries_select` `using (partner_id = (select private.my_member_partner_id()) or (select private.is_admin()))`; Grant `select` an `authenticated`; kein INSERT/UPDATE/DELETE-Grant. **Neue EXECUTE-Freigaben an `anon`/`authenticated`:** keine; `commission_book` nur `service_role`. Allowlist-Test aktualisiert. Ein Kunde sieht Gebühr und Journal weder per Tabelle noch per View noch per Funktion.

### 7.3 Tests (Rot-zuerst, `tests/rls/journal.test.ts`)

- **Journal-Zeilen werden nie committet** (`ON DELETE RESTRICT` und `append_only` machen sie unlöschbar): alle Insert-Tests laufen als Eigentümer-SQL in einer Transaktion mit Rollback (`probes`/`asUser`).
- Erlaubt (Gegenfall): `booking` mit gültigen Werten; `change` mit negativer Differenz; `cancellation` als exakte Negation; `cancellation_fee`.
- Verweigert: Summe falsch → 23514 (`fee_parts`/`payout_rest`); zweite `booking` je Auftrag → 23505; zweite Gegenbuchung → 23505; `cancellation` ohne `reverses_entry_id` → 23514; Negation um 1 Cent falsch → `amount_mismatch`; Satz ≠ aktueller Satz → `rate_mismatch`; Rate abweichend bei `change` → `rate_mismatch`; Firma `pending` → `partner_not_active`; keine `vat_rule` → `vat_rule_missing`; UPDATE/DELETE/TRUNCATE → `append_only`/42501 auch als `service_role`; Aufruf von `commission_book` als `authenticated`/`anon` → 42501; Löschen einer Firma oder eines Auftrags mit Zeile → 23503; Bruchteil-Cent nicht darstellbar (Typ `bigint`).
- Lesen: Mitglied B sieht Zeilen von A → 0; Kunde → 0; Mitglied `aal1` → 0; admin `aal1` → 0, `aal2` → sieht; Gegenfall eigene Firma `aal2`.
- **PostgREST mit echtem Token (Positivkontrolle ohne commit-Anhäufung):** eine einmal angelegte Dauer-Fixture (Firma `mvtest-fixture` im Status active, ein Kundenkonto mit Auftrag, eine Journalzeile; idempotenter Eigentümer-SQL-Schritt in `tests/support/partner.ts`, Firma und Auftrag tragen das Präfix, nie gelöscht). Pro Lauf wird ein frischer `aal2`-Nutzer per Eigentümer-SQL als Mitglied der Fixture-Firma eingetragen und danach entfernt. Eine Journalzeile, ein Kundenkonto und ein Auftrag bleiben dauerhaft in Dev (benannte Ausnahme, kein Rückweg; **Berater-Prüfpunkt**).
- Ersatz der `fee_splits`-Tests (`rls.test.ts:360-395`, `quote.test.ts:58, 136-150, 251-260`, Stellen in der Session neu suchen).

### 7.4 Rot-Beweise (`--only s9b-4`)

`append_only`-Trigger abschalten (Ist-Wert: UPDATE ändert `total_cents`, zurückgelesen); `revoke update/delete/truncate … from service_role` zurücknehmen (Ist-Wert: DELETE als `service_role` entfernt die Zeile); Select-Policy auf `true` (Ist-Wert: Kunde sieht N Zeilen); Firmenbedingung (Ist-Wert: Fremdfirma sieht Zeilen); `aal2`-Klausel (Ist-Wert: Mitglied `aal1` sieht Zeilen); `fee_parts`/`payout_rest` (Ist-Wert: falsche Summe gespeichert); Unique-Indizes (Ist-Wert: zweite Gegenbuchung vorhanden); Negationsprüfung (Ist-Wert: Betrag ≠ −Original gespeichert); Satzprüfung (Ist-Wert: Zeile mit falschem Satz vorhanden); Grant `commission_book` an `authenticated` (Ist-Wert: Aufruf als Nutzer-JWT erfolgreich). Alle Probes laufen in Rollback-Transaktionen.

### 7.5 Akzeptanzkriterien

`npm run check`, `npm run test:rls`, `node scripts/redproof-s9b.mjs` **gesamt** (alle Teile, Restprüfung grün → `tmp/proof/s9b-rotbeweis.md`), `migration list` (bis 0026), `db:types`, `build`, `scan:proof`; `ARCHITECTURE.md`, `S9_KONZEPT.md` (2.1, 9.6 Stand), `OPEN_ISSUES.md` (A4c-N3 erledigt; Pflichtzeilen für S9c: Zuordnung, Listing-Schließung), `PROGRESS.md`, `GOLIVE.md`. **Berater-Abnahme** (Geld und Sicherheit): nur die Dateien mit Geld- und Sicherheitslogik (0026, `commission_book`, Journal-Tests). **Abhängigkeit:** S9b-1 (Firmen), S9b-3 (`my_member_partner_id`, echte Token).

## 8. Rechte-Zusammenfassung (Freigabe durch Beks)

| Objekt | Grant | Begründung |
|---|---|---|
| `public.register_partner` | EXECUTE `authenticated` (**neu, Entscheidung nötig**) | einziger Weg zur Firma; Kunden haben kein INSERT; prüft `auth.uid()`, Bezirke, `unique (user_id)` |
| `private.partner_of_user`, `my_member_partner_id`, `my_partner_id`, `my_job_partner_id` | EXECUTE `authenticated` | von RLS-Ausdrücken im Aufrufer-Kontext ausgewertet, Muster wie `my_role()`/`is_admin()`; Schema `private` nicht über die API erreichbar |
| `public.admin_*` (fünf), `public.commission_book` | EXECUTE nur `service_role` | kein Grant an `anon`/`authenticated`; `p_actor` nie aus Anfragedaten |
| `private.guard_*`-Trigger-Funktionen | keine | nur Trigger |
| `platform_settings` Select | Spalten-Grant (key, version, value, effective_from) an `authenticated` | Partner lesen nur `fee_rate`/`fee_vat_rate`; `note` bleibt intern |
| `commission_entries` | `select` an `authenticated` (Policy: eigene Firma `aal2` oder admin `aal2`) | Journal; kein DML |
| `booking_terms()` | unverändert (EXECUTE `anon`, `authenticated`, `service_role`) | **kein neuer Schlüssel** |

## 9. Risiken

1. **Offene Registrierung:** Jeder Kunde kann eine Firma beantragen und sieht ab `pending` mit `aal2` den Satz. Gewollt (P2B-Transparenz, `CLAUDE.md`); Gegenmaßnahmen: `aal2` fürs Lesen, ein Antrag je Konto, Freigabe nur durch admin. Der Satz steht außerdem in den Partnerbedingungen (Rechtsfrage 4).
2. **Token-Laufzeit:** Ein `aal2`-Token lebt bis `jwt_expiry` (3600 s). Status- und Sperrwechsel wirken sofort (Helfer lesen live), ein entfernter Faktor erst nach Ablauf.
3. **Rekursion/Querzugriff:** Policies auf `partner_members` nur über SECURITY-DEFINER-Helfer (M03); Tests „Firma A liest B“ mit Positivkontrolle.
4. **Geld:** `commission_book` vertraut dem Betrag der Edge Function bis auf Identitäten, Negation und Sätze; ein kompromittierter `service_role`-Schlüssel kann falsche Beträge buchen (Grenze benannt, Gegenbuchung statt Änderung). Der Berater entscheidet, ob eine SQL-Neuberechnung (Konzept 9.1) nötig ist.
5. **Unlöschbare Testdaten:** `RESTRICT` plus `append_only`; Journal-Tests in Rollback, eine Dauer-Fixture in Dev (7.3). Testfirmen ohne Journalzeile löscht der Eigentümer über den Marker `app.mv_partner_delete`.
6. **TOTP gegen Dev:** Auth-Rate-Limits (sequenziell, Pausen), Dev-Dashboard-Einstellung unbekannt (Vorarbeit Beks), neue Abhängigkeit (`otpauth`) braucht Freigabe.
7. **Dokumente:** Header-Prüfung des Buckets statt Byte-Prüfung; vertretbar, weil nur admin liest. Löschfrist und Anonymisierung S9h.
8. **P2B:** 30 Tage Vorlauf für Satzänderungen erzwingt die Datenbank (M16); Partner sehen künftige Sätze (6.2); Sperren tragen eine Begründung im Datensatz (Art. 4). Rechtsfragen 4 und 9 (USt.) bleiben offen.
9. **`staff` und Mehrfach-Mitglieder:** nur im Datenmodell (Phase 2); Phase 1 legt nur `owner` an.

## 10. Rot-Beweis-Skript `scripts/redproof-s9b.mjs`

- Erster Import `./dev-guard.mjs`; `--only s9b-N` für einen Teil, ohne Argument alle Teile nacheinander.
- **Snapshot (Lehre A4c-N3):** (a) Gesamtkatalog der Schemata `public`, `private` und `storage` (Policies auf allen Tabellen, Tabellen- und Spalten-ACL für `anon`, `authenticated`, `service_role`, RLS-Flag, Trigger mit `tgenabled`, Funktionen mit md5, Eigentümer, `prosecdef`, `proconfig`, `proacl`, Enum-Werte, Constraints, Indizes); (b) die Vereinigung der Objekte, die jede Lockerung in ihrer Deklaration (`touches: [...]`) nennt; das Skript bricht ab, wenn `INNER` ein Objekt öffnet, das nicht im Snapshot steht.
- **Restprüfung am Ende:** keine Policy mit Präfix `redproof_`, `snapshot_vorher === snapshot_nachher` (vor und nach dem Aufräumen), keine zusätzlichen Rechte gegenüber vorher (ACL-Vergleich), alle Trigger `tgenabled = 'O'`, keine Zeilen mit Präfix `mvtest-redproof` (Ausnahme: Dauer-Fixture), kein Restore-SQL ungenutzt in `tmp/proof/`.
- Jede Lockerung: Restore-SQL **vor** dem Lockern nach `tmp/proof/s9b-restore-<n>.sql`, Wiederherstellung im `finally`; Messung des Ist-Werts vor und nach (M-3); „Sperre“ und „Schicht“ getrennt gezählt.
- Neben dem Negativbeweis der Dev-Guard (Exit 2, `ABBRUCH`) mit fiktiver `SUPABASE_PROJECT_ID`.

## 11. Offen

- Text und gültige Version der **Partnerbedingungen** (`terms_version` wird als Text gespeichert, nur das Format geprüft; die Liste gültiger Versionen steht aus).
- Löschpfad für Testfirmen (Marker `app.mv_partner_delete`) und die Dauer-Fixture: Berater-Prüfpunkt in S9b-1 und S9b-4.
- Schließen offener Listings/Angebote beim Statuswechsel, Zuordnungsprüfung im Journal: Pflicht für S9c/S9e.
- Aufruf-Skript für admin-Edge-Functions: S9c.
- Nach der letzten Abnahme ändert sich diese Datei nicht mehr; verbleibende Findings mittel/niedrig stehen mit Teilschritt in `docs/OPEN_ISSUES.md`.
