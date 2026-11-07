# S9b Partner und Journal: Bauplan

Stand: 2026-11-04 (Runde 2 nach Berater-Abnahme `docs/proof/s9b0/s9b0-plan-abnahme.md`). Quelle: `docs/S9_KONZEPT.md` Abschnitt 13 (Zeile S9b, `:649`), 3, 5.1, 5.2, 5.8, 5.10, 6, 9; dazu R11-1, R11-7, R7-4, N-5, N-10, A4c-N3 (`docs/OPEN_ISSUES.md:44, 50, 10, 218, 219, 226`). Format wie `docs/S9a_PLAN.md`. Nur Plan, kein Code, kein SQL zum Ausführen; das vollständige SQL kommt in die Berater-Vorprüfung des jeweiligen Teilschritts.

Entscheidungen Beks, 2026-11-04 („Alle ok, weiter“ zu den Fragen 1–8 der Gliederung): (1) Pflichtangaben der Registrierung wie in 4.1; (2) Statusmaschine wie in 4.2, `rejected` ist Endzustand; (3) `vat_rule` setzt admin bei der Freigabe, Standard `standard_20`, Registrierung nur mit Sitz AT; (4) `rental_provider` bleibt ohne Funktion, `rental` steht im Schema, wird aber bis Phase 2 abgelehnt; (5) TOTP im Dev-Dashboard aktiviert Beks vor S9b-3, Faktor-Reset durch Beks per Dashboard; (6) Dokumente wie in 5.1; (7) Partner ändern nur Kontaktdaten; (8) Satz lesen: jedes Mitglied einer Partnerfirma in jedem Status mit `aal2`, das Aufruf-Skript für admin-Edge-Functions wandert nach S9c.

**Entwurfsänderungen aus der Berater-Abnahme, die Beks bestätigt oder ändert (nicht in der Antwort vom 2026-11-04 enthalten):** (a) `vat_rule`: bis Phase 2 nehmen Datenbank und Funktionen nur `standard_20` an (`vat_rule_not_enabled`), weil `splitFee` keine andere Regel rechnet (M-6, wirkt auf Frage 3); (b) keine dauerhafte Journal-Fixture in Dev (M-9); (c) die beiden Statusfunktionen entstehen schon in S9b-1 (H-1).

Kürzel: M01 = `…_0001_foundation.sql`, M03 = `…_0003_policy_recursion.sql`, M15/M16/M17/M18/M20/M21/M22 = `…_0015_versions_published` bis `…_0022_no_self_upgrade`. Migrationen: `<timestamp>_00NN_<name>.sql` ab 0023 (`npx supabase migration new`).

## 1. Ist-Stand (belegt)

- **Rollen:** `profiles.role` (Enum `user_role`: customer, rental_provider, admin, partner; M01:18, 28-35). `private.my_role()` (M01:37-39), `private.is_admin()` = Rolle admin und JWT `aal2` (M15:10-12), `private.assert_admin(p_actor)` prüft nur die Rolle (M15:55-63). Trigger `guard_role` verlangt den Marker `app.mv_role_grant` (M16:130-147); `admin_grant_role` ist nur für den Eigentümer ausführbar (M16:165-181). `become_rental_provider` ist seit M22 gelöscht.
- **Gebühr:** `platform_settings` (key, version, value, note, effective_from) mit Trigger `guard_platform_setting` (Vorlauf, Unveränderlichkeit; M16:34-65) und View `current_fee_rates` (`security_invoker`, Gleichstand nach höchster Version; M16:69-78). Select-Policy heute: `my_role() = 'rental_provider' or is_admin()` (M16:188-189); Schreib-Policies und -Grants entfielen (M16:215-218). `booking_terms()` liefert fünf Schlüssel plus Hash, kein `fee_*` (M16:81-104).
- **Journal:** `audit_log` (nur anfügen, Select `is_admin()`, `actor_role` ∈ customer, partner, admin, system, owner; M15:19-51); `private.append_only()` (M15:30-36); `private.immutable_row` mit Ausnahme für Kaskaden (M17:138-147); `status_events` (M17:153-167). `fee_splits` existiert noch samt Policy `fee_splits_select` (M01:196-215, M16:206-207); `quote` schreibt sie seit S9a-2 nicht mehr. `price_revisions` hat `unique (id, request_id)` (M18:24).
- **Muster:** Marker an die Zeile gebunden (`<id>:<status>`, M17:229); Zählung in Policies über SECURITY DEFINER (M21:32-44); Default-EXECUTE für `anon`/`authenticated` (M18:356), deshalb `revoke all … from public, anon, authenticated` mit anschließendem gezieltem Grant (M15:249-260).
- **Tests:** Hilfen `ownerSql`, `ownerError`, `asUser(userId, 'aal1'|'aal2', …)`, `asRole`, `probes` in `tests/support/owner.ts:8-86`; `makeUser`, `deleteUsers` (Auth-API), `makeRequest` in `tests/support/db.ts:30, 44-46, 68`. `aal2` wird **nur als Claim-String** gesetzt (`owner.ts:39`). Kein `mfa.enroll`/`challenge`/`verify`, keine TOTP-Bibliothek in `package.json`. Allowlist der SECURITY-DEFINER-Funktionen: `tests/rls/rls.test.ts:450-469`. Tests zu Vermieter-Satz und `fee_splits`: `rls.test.ts:320-357`, `quote.test.ts:70, 175-184, 249, 295-297` (in der Session neu suchen).
- **Auth-Konfiguration:** `supabase/config.toml:304-306`: `[auth.mfa.totp] enroll_enabled = false`, `verify_enabled = false`; `jwt_expiry = 3600` (`:166`). Der Stand des Dev-Projekts im Dashboard ist nicht geprüft.
- **Redproof-Muster:** `scripts/redproof-s9a4.mjs`: `import './dev-guard.mjs'` zuerst (`:9`), `snapshot()` (`:31-49`), `probe()` (`:103-109`, Rollback, Ist-Wert aus temporärer Tabelle), `INNER` (`:485-494`: nur in der Probe-Transaktion geöffnete Objekte), Wiederherstellung in `runSql` (`:150-172`), `same = before === after` (`:698`). Lücke A4c-N3: `INNER` öffnet Objekte (`audit_log`, `price_revisions`, `request_contacts`), die der Snapshot nicht erfasst.
- **Konzept-Widerspruch (wird in S9b-1 im Konzept bereinigt):** `S9_KONZEPT.md:338` nennt `my_partner_id() is not null` für „alle Partner-Konten unabhängig vom Status“; `my_partner_id()` liefert aber nur bei `active` und `aal2` (5.2). Der Plan führt dafür `private.my_member_partner_id()` ein.

## 2. Regeln für alle Teile

- **Fehlercodes** wie S9a: Trigger- und Funktionsfehler SQLSTATE `P0001`, Meldung = Code; Rechtefehler `42501`; Unique `23505`; Check `23514`; Fremdschlüssel `23503`. Codes: `invalid_transition`, `field_immutable`, `append_only`, `not_admin` (42501), `not_found`, `already_member`, `rental_not_enabled`, `vat_rule_not_enabled`, `vat_rule_backdated`, `scope_incomplete`, `vat_rule_missing`, `partner_not_active`, `rate_mismatch`, `amount_mismatch`, `limit_reached`, `reason_required`, `self_approval`. Zuordnung zum Konzept (`S9_KONZEPT.md:252`): `rate_mismatch` entspricht `fee_rate_changed`, `amount_mismatch` entspricht `fee_basis_changed`; die Session trägt die Namen im Konzept ein. Tests prüfen SQLSTATE **und** Meldung.
- **Positivkontrolle:** jeder „0 Zeilen“- und „verweigert“-Test hat im selben Test einen erlaubten Gegenfall. Tests, die `select('*')` auf `platform_settings` nutzen, prüfen nach dem Spalten-Grant (6.2) den Fehlercode oder eine Spaltenliste, nicht `data ?? []`.
- **Rot-zuerst:** Tests entstehen vor der Migration und laufen rot.
- **Neue Tabellen:** RLS an, `revoke all from anon, authenticated`, gezielte Grants, `revoke insert, update, delete, truncate from service_role` (DML nur über Funktionen), unveränderliche Tabellen mit Trigger `append_only` einschließlich `before truncate`.
- **Funktionen:** SECURITY DEFINER mit Eigentümer `postgres` und `search_path = ''`; **`revoke all … from public, anon, authenticated, service_role`**, danach gezielter Grant (Supabase vergibt EXECUTE per Default an `anon`/`authenticated`, M18:356). Jede `admin_*`-Funktion hat `p_actor uuid` als ersten Parameter und ruft `private.assert_admin(p_actor)`; `p_actor` stammt nie aus Anfragedaten, die Funktionen sind für Nutzer-JWTs nicht ausführbar (Grant nur `service_role`; der Eigentümer in der SQL-Konsole kann sie ausführen). Keine Admin-Funktion für Nutzer-JWTs in S9b. Trigger-Funktionen: `revoke all … from public`.
- **Marker** im Namensraum `app.mv_*` (transaktionslokal, wird nach dem UPDATE gelöscht), **immer an die Zeile gebunden** wie M17:229: `app.mv_partner_status = '<partner_id>:<alt>><neu>'`, `app.mv_partner_master = '<partner_id>'`, `app.mv_partner_delete = '<partner_id>'`.
- **Kein Status setzender Helfer in Migrationen.** Test-Fixtures setzen den Status über `admin_approve_partner` und `admin_set_partner_status` (ab S9b-1 vorhanden, Aufruf als `service_role`), nicht über Marker.
- **MFA/`aal2`:** Alle Partner-Aktionen und Fach-Lesezugriffe prüfen `auth.jwt() ->> 'aal' = 'aal2'` **in Helfer, Policy oder Funktion**, nie nur in der Oberfläche oder der Edge Function. Ausnahmen mit `aal1`: Registrierung (`register_partner`, das Konto ist noch ein Kunde) und Lesen der **eigenen** Firmendaten (Firma, Mitgliedszeile, Kategorien, Bezirke, USt.-Regel, Dokument-Metadaten), damit die MFA-Einrichtung möglich ist; betroffen sind weder Satz noch Journal noch Daten Dritter. Kunden brauchen kein MFA.
- **Rolle `partner` in `profiles`:** `profiles.role` bleibt beim Kunden (`customer`); der Enum-Wert `partner` hat wie `rental_provider` keine Wirkung. Zuständigkeit folgt allein aus `partner_members`. Test: Nach `register_partner` und nach der Freigabe ist `my_role()` = `customer`.
- **Testdaten:** Lauf-Kennung im Firmennamen (`mvtest-<lauf>`). Firmen löscht nur der Eigentümer mit der Hilfe `ownerDeletePartner(id)` (`tests/support/partner.ts`): setzt `app.mv_partner_delete`, löscht USt.-Regeln, Dokument-Zeilen, Kategorien, Bezirke, Mitglieder und die Firma. Nie Firmen mit Journalzeilen. Es bleibt **keine** Testzeile im Journal zurück (7.3).
- Alle Befehle schreiben `EXIT=` ins Log (PowerShell `; "EXIT=$LASTEXITCODE"`); Nachweise nach `docs/proof/s9bN/`, vorher `npm run scan:proof`.

## 3. Schnitt

| Teil | Ziel | Migration | Berater |
|---|---|---|---|
| S9b-1 | Partnerkern: Tabellen, Statusmaschine samt `admin_approve_partner`/`admin_set_partner_status`, Helfer, RLS, Registrierung | 0023_partners | ja (Rollen, RLS, Auth) |
| S9b-2 | Scope, USt.-Regel, Stammdaten, Dokumente | 0024_partner_admin | ja |
| S9b-3 | Echte TOTP-Tests, Satz lesen (N-10), `rental_provider` ohne Leserecht | 0025_partner_fee_read | ja (Auth, Gebühr) |
| S9b-4 | Journal `commission_entries`, `fee_splits` entfällt | 0026_commission_journal | ja (Geld) |

Abhängigkeiten: S9b-2 und S9b-3 bauen auf S9b-1; **S9b-4 baut nur auf S9b-1 und S9b-2** (Firmen, Statusfunktionen, USt.-Regel) und braucht die TOTP-Vorarbeit von Beks nicht (M-9); der Helfer `my_member_partner_id()` kommt schon in 0023. Jeder Teil ist in einer Session machbar; S9b-1 und S9b-4 sind die größten (je ein Schema-Block, keine Oberfläche, keine Edge Function). S9b hat keine UI: keine `shots`, kein E2E (folgt in S9i); `reviewer` im Modus „Abnahme“. Das Kundenflow-Verhalten ändert sich in keinem Teil.

## 4. S9b-1 Partnerkern, Statusfunktionen und Registrierung

**Ziel.** Eine Firma mit Statusmaschine, vier getrennte Zuständigkeitsprüfungen, strikte RLS; ein Kunde kann eine Firma im Status `pending` beantragen, admin gibt frei und setzt den Status über zwei Funktionen, damit die Statusmaschine in diesem Teil vollständig durchlaufen und bewiesen wird. Niemand schreibt `partner_members` oder fremde Firmen.

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
  verified_at timestamptz,                                                -- setzt nur der Trigger bei pending→active; der Akteur steht im audit_log
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
- `guard_partner_insert` (BEFORE INSERT): Status nur `pending`; `verified_at`, `status_reason`, `status_changed_at`, `stripe_account_id` null; `payout_model = 'direct'`.
- `guard_partner_status` (BEFORE UPDATE): wenn sich `status` ändert, **zwei getrennte Prüfungen**: (a) das Paar steht in der Tabelle 4.2, sonst `invalid_transition`; (b) der Marker `app.mv_partner_status` ist exakt `<partner_id>:<alt>><neu>`, sonst `invalid_transition`. Bei den Paaren mit Begründungspflicht muss `status_reason` neu, nicht leer und mindestens 10 Zeichen lang sein (`reason_required`, zweite Schicht zur Funktion). Bei `pending → active` setzt der Trigger `verified_at := now()`; sonst ändert sich `verified_at` nie. `status_reason`/`status_changed_at` ändern sich nur mit einem Statuswechsel. Gleicher Status ist kein Statuswechsel.
- `guard_partner_fields` (BEFORE UPDATE): `id`, `created_at`, `country`, `terms_*`, `verified_at` unveränderlich außer wie oben (`field_immutable`); `name`, `legal_form`, `uid`, `small_business`, `address_*`, `payout_model`, `stripe_account_id` nur mit dem Marker `app.mv_partner_master = '<partner_id>'` (`field_immutable`). Frei für die Firma bleiben nur `contact_*` (Spalten-Grant).
- `guard_partner_delete` (BEFORE DELETE): ohne den Marker `app.mv_partner_delete = '<partner_id>'` verboten; `before truncate` ohne jede Ausnahme verboten. **Keine Funktion in einer Migration setzt den Lösch-Marker**, nur Eigentümer-SQL in Tests. `ON DELETE RESTRICT` des Journals (S9b-4) schützt Firmen mit Buchungen.
- `partner_vat_rules`: Trigger `append_only` für UPDATE und TRUNCATE; DELETE nur mit `app.mv_partner_delete` = `partner_id` (gleicher Marker wie bei der Firma, damit Testfirmen löschbar bleiben). `set_updated_at` auf `partners` (wie M01:231, `moddatetime`).

### 4.2 Statusmaschine der Partnerfirma (Übergänge nur über Funktionen)

| Von → Nach | Funktion | Akteur | Begründung Pflicht |
|---|---|---|---|
| (neu) → `pending` | `register_partner` | Kunde (`aal1`) | nein |
| `pending` → `active` | `admin_approve_partner` | admin | nein |
| `pending` → `rejected` | `admin_set_partner_status` | admin | ja |
| `active` → `payment_hold` / `suspended` | `admin_set_partner_status` | admin | ja |
| `payment_hold` → `active` / `suspended` | `admin_set_partner_status` | admin | ja |
| `suspended` → `active` | `admin_set_partner_status` | admin | ja |

Alle anderen Paare (insbesondere alles aus `rejected`, `active → pending`, `suspended → payment_hold`) sind verboten (`invalid_transition`). Die Funktionen sperren die Zeile (`select … for update`), vergleichen den Ausgangsstatus (Compare-and-Set) und setzen den Marker erst unmittelbar vor dem UPDATE dieser einen Firma. `rejected` ist Endzustand; die Mitgliedszeile bleibt, ein zweiter Antrag desselben Kontos ist wegen `unique (user_id)` nicht möglich. Das Schließen offener Listings und Angebote beim Wechsel nach `payment_hold`/`suspended` (Konzept 3) gehört zu S9c/S9e: deren Migrationen erweitern `admin_set_partner_status` in derselben Transaktion; S9b dokumentiert das als Pflicht in `OPEN_ISSUES.md`.

### 4.3 Rechte und Funktionen

**Helfer** (SECURITY DEFINER, `stable`, `search_path = ''`, `revoke all from public, anon`, EXECUTE `authenticated` wie `my_role()`/`is_admin()`; Schema `private` wird von der API nicht ausgeliefert, `anon` hat keine USAGE darauf, M01:13-14):
- `private.partner_of_user()`: Firmen-ID des Mitglieds, **jeder Status, jedes `aal`** (Policies der eigenen Firma, Registrierung, MFA-Einrichtung).
- `private.my_member_partner_id()`: Mitglied, jeder Status, **`aal2`** (Fach-Lesezugriffe: Satz, Journal; Partner-Schreiben).
- `private.my_partner_id()`: Mitglied, Status `active`, `aal2` („darf annehmen“).
- `private.my_job_partner_id()`: Mitglied, Status `active` oder `payment_hold`, `aal2` („darf zugeordnete Aufträge abwickeln“).

**Statusfunktionen** (SECURITY DEFINER, `search_path = ''`, `revoke all … from public, anon, authenticated, service_role`, `grant execute … to service_role`; jede schreibt `audit_log` mit `actor_role = 'admin'` und `p_actor`; `p_actor` nie aus Anfragedaten):
- `admin_approve_partner(p_actor, p_partner, p_services partner_service[], p_vat_rule partner_vat_rule, p_note text)`: `pending → active`. Verlangt mindestens eine Kategorie, mindestens einen Bezirk, ein Mitglied; lehnt `rental` ab (`rental_not_enabled`, bis Phase 2) und jede `p_vat_rule` ≠ `standard_20` (`vat_rule_not_enabled`, bis Phase 2, M-6); lehnt einen `p_actor` ab, der Mitglied der Firma ist (`self_approval`, N-2). Schreibt `partner_categories` und `partner_vat_rules` (`valid_from` = heute Wien).
- `admin_set_partner_status(p_actor, p_partner, p_status, p_reason)`: alle Übergänge der Tabelle 4.2 außer der Freigabe; `p_reason` Pflicht (mindestens 10 Zeichen, `reason_required`); setzt `status_reason`, `status_changed_at`. Der Partner liest die Begründung der eigenen Firma (Art. 4 P2B).

**Registrierung:** `public.register_partner(p_name, p_legal_form, p_uid, p_small_business, p_street, p_postcode, p_city, p_contact_name, p_contact_phone, p_contact_email, p_districts smallint[], p_terms_version text) returns uuid` (SECURITY DEFINER, `search_path = ''`, `revoke all … from public, anon, service_role`, `grant execute … to authenticated`; **neue EXECUTE-Freigabe, Entscheidung Beks nötig**, Abschnitt 8). Ablauf: `auth.uid()` ist Pflicht (sonst 42501); `private.my_role() = 'customer'` (admin- und andere Rollen-Konten dürfen keine Firma beantragen; `profiles.role` ändert sich nie); Eingaben prüfen (Bezirke 1–23, mindestens einer, ohne Duplikate); legt **immer eine neue** Firma `pending` samt `owner` für `auth.uid()` an und nimmt nie eine `partner_id` entgegen; fängt `unique_violation` auf `partner_members.user_id` ab und wirft `already_member` (auch beim Wettlauf zweier Aufrufe); schreibt `partner_regions` (Bezirke legt die Registrierungsfunktion an, R7-4) und eine `audit_log`-Zeile (`actor_role = 'customer'`, `action = 'register_partner'`). Kategorien und `vat_rule` setzt nur admin. `terms_version` wird als Text gespeichert, nur das Format geprüft (Offen, Abschnitt 11).

**Grants und Policies** (Spalte „Mitglied `aal1`/`aal2`“: Mitglied der **eigenen** Firma):

| Tabelle | anon | Kunde ohne Firma | Mitglied `aal1` | Mitglied `aal2` | admin `aal2` | service_role |
|---|---|---|---|---|---|---|
| `partners` | – | – | S eigene Firma | S eigene; U nur `contact_*` bei Status pending/active/payment_hold | S | nur S (kein DML) |
| `partner_members`, `partner_categories`, `partner_regions`, `partner_vat_rules` | – | – | S eigene Firma | S eigene Firma | S | nur S |

Policies `…_select` `using (partner_id = (select private.partner_of_user()) or (select private.is_admin()))` (bei `partners`: `id = …`); `partners_update_contact` `using/with check (id = (select private.my_member_partner_id()) and status in ('pending','active','payment_hold'))`, Spalten-Grant `update (contact_name, contact_phone, contact_email)`. Kein INSERT/UPDATE/DELETE-Grant auf `partner_members`, `partner_categories`, `partner_regions`, `partner_vat_rules` für `authenticated` (R7-4). Die Policies verwenden nur SECURITY-DEFINER-Helfer, damit keine Rekursion entsteht (M03).

**DEFINER-Allowlist (`tests/rls/rls.test.ts:450-469`):** neu die vier Helfer und `public.register_partner` (EXECUTE `authenticated`, begründet in Abschnitt 8) sowie `admin_approve_partner` und `admin_set_partner_status` (nur `service_role`). Die Trigger-Funktionen `private.guard_partner_*` ohne EXECUTE. `booking_terms()` bleibt unverändert.

### 4.4 Tests (Rot-zuerst, `tests/rls/partners.test.ts`; Hilfe `tests/support/partner.ts`)

- Helfer-Matrix: {Nichtmitglied, Mitglied} × {pending, active, payment_hold, suspended, rejected} × {`aal1`, `aal2`} für alle vier Helfer (Claim-Ebene über `asUser`; Ist-Wert = ID oder NULL). Erwartung: `my_partner_id` nur active+`aal2`; `my_job_partner_id` active/payment_hold+`aal2`; `my_member_partner_id` jeder Status mit `aal2`; `partner_of_user` jeder Status, jedes `aal`. Status über die zwei Funktionen.
- `register_partner`: erlaubt (Kunde `aal1`) mit Gegenfall; ohne Anmeldung → 42501; `anon` → 42501; admin-Konto → 42501/`not_admin`-Variante des Rollenchecks; zweiter Aufruf → `already_member`; **zwei parallele Aufrufe** → genau eine Firma, der zweite `already_member`; Bezirk 0 oder 24 → 23514; keine Bezirke → `scope_incomplete`; nach dem Aufruf und nach der Freigabe ist `my_role()` = `customer`. UID fehlt ohne Kleinunternehmer → 23514; `country` ≠ AT ist über die Funktion nicht erreichbar, der Check wird mit Eigentümer-Insert geprüft.
- Statusfunktionen: jedes der sieben gültigen Paare ok (Gegenfälle); jedes verbotene Paar → `invalid_transition` (Paar ohne Marker und ungültiges Paar mit Marker getrennt); zweite Freigabe → `invalid_transition`; ohne Begründung → `reason_required` (Funktion und Trigger getrennt); `rental`/`vat_rule` ≠ `standard_20` → `rental_not_enabled`/`vat_rule_not_enabled`; Freigabe ohne Bezirk/Kategorie → `scope_incomplete`; `p_actor` = Mitglied der Firma → `self_approval`; `p_actor` = Kunde oder null → `not_admin`; als `authenticated`/`anon` → 42501; je Aufruf genau eine `audit_log`-Zeile; **Marker an die Zeile gebunden**: ein UPDATE einer zweiten Firma in derselben Transaktion mit gesetztem Marker → `invalid_transition`; INSERT mit Status `active` → `invalid_transition`; DELETE ohne Marker → `field_immutable`; TRUNCATE → `field_immutable`/`append_only`; `unique (user_id)` → 23505.
- RLS: Mitglied A liest Firma/Mitglieder/Kategorien/Bezirke B → 0 Zeilen (Positivkontrolle eigene); Kunde ohne Firma sieht nichts; `anon` → 42501; **N-5 aus OPEN_ISSUES:** aktiver Partner (`aal2`) liest `request_photos` und Objekte in `request-photos` → 0 Zeilen (Konzept 6.1).
- Rechte: Mitglied ändert `name`/`status`/`uid`/`verified_at` → 42501 (Spalten-Grant); ändert `contact_phone` → ok; `partner_members` INSERT/UPDATE/DELETE (`partner_id`, `role`) → 42501; Kategorie einfügen → 42501; Mitglied mit `aal1` ändert Kontakt → 0 Zeilen (Policy); `partner_vat_rules` UPDATE → `append_only`.
- Löschen: `ownerDeletePartner` entfernt eine **freigegebene** Testfirma samt USt.-Regel, Kategorien und Bezirken; das admin-Testkonto lässt sich anschließend über `deleteUsers` löschen (kein `verified_by`, kein Fremdschlüssel auf das admin-Konto).

### 4.5 Rot-Beweise (`scripts/redproof-s9b.mjs --only s9b-1`, Ist-Wert nach M-3)

Je Sperre einzeln lockern, committen, den Test laufen lassen (rot, richtige Meldung), Original wiederherstellen, Definitionen vergleichen. **Zweischichtige Sperren werden isoliert gemessen** wie `redproof-s9a4.mjs:481-495`: Die innere Schicht wird nur in der Probe-Transaktion geöffnet, umgeschaltet wird allein die Zielsperre; sonst Ausweis als „Schicht“.
1. Paar-Prüfung entfernen (Marker-Prüfung in der Probe geöffnet) → Ist-Wert: `update partners set status='rejected'` aus `active` gelingt, Zeile zurückgelesen = `rejected`.
2. Marker-Prüfung entfernen (Paar gültig) → Ist-Wert: Statuswechsel ohne Marker geht durch.
3. Marker nicht an die Firma gebunden (Marker ohne ID) → Ist-Wert: zweite Firma wird in derselben Transaktion gesperrt (Status zurückgelesen).
4. Begründungs-Prüfung im Trigger entfernen (Funktionsprüfung in der Probe geöffnet) → Ist-Wert: Statuswechsel ohne Grund gespeichert.
5a/5b/5c. **`aal2`-Klausel einzeln** in `my_partner_id`, `my_job_partner_id`, `my_member_partner_id` entfernen → Ist-Wert: mit Claim `aal1` liefert der Helfer die Firmen-ID.
6. Statusklausel in `my_partner_id` entfernen → Ist-Wert: Firma `payment_hold` liefert die ID; 6b. Statusklausel in `my_job_partner_id` entfernen → Ist-Wert: Firma `suspended` liefert die ID.
7. Select-Policy `partners_select` auf `true` → Ist-Wert: Fremdkonto sieht N Firmen statt 0; 7b. dasselbe für `partner_members`.
8. `partners_update_contact` ohne `aal2`/Statusfilter → Ist-Wert: Mitglied `aal1` ändert den Kontakt (Zeile zurückgelesen).
9a. Spalten-Grant auf `name` erweitern (`guard_partner_fields` in der Probe abgeschaltet) → Ist-Wert: UPDATE gelingt, Name zurückgelesen geändert. 9b. `guard_partner_fields` (Stammdaten-Marker) abschalten bei geöffnetem Grant → Ist-Wert: Mitglied ändert `name`.
10. `revoke … from service_role` zurücknehmen (Trigger in der Probe abgeschaltet) → Ist-Wert: `insert into partners` als `service_role` gelingt.
11. INSERT-Grant **und** eine offene INSERT-Policy auf `partner_members` (beides nur in der Probe) → Ist-Wert: Fremdes Mitglied lässt sich in eine aktive Firma eintragen (Zeile vorhanden); 11b. nur die Policy-Sperre (Grant offen) → Ist-Wert: kein Eintrag, Ausweis „Schicht“.
12. `guard_partner_delete` abschalten → Ist-Wert: DELETE ohne Marker entfernt die Zeile.
13. `register_partner` ohne `my_role`-Prüfung → Ist-Wert: admin-Konto legt Firma an; ohne `unique_violation`-Behandlung entfällt (Testabdeckung).
14. `admin_*`: `assert_admin`-Aufruf je Funktion entfernen → Ist-Wert: Aufruf mit Kunden-`p_actor` ändert die Firma; `revoke … from authenticated` zurücknehmen → Ist-Wert: Aufruf als Nutzer-JWT erfolgreich.
Ohne eigenen Rot-Beweis, als Testabdeckung in `OPEN_ISSUES.md` geführt: `guard_partner_insert`, unveränderliche Felder `id`/`country`/`terms_*`, `unique (user_id)`, `country = 'AT'`, Bezirksprüfung, TRUNCATE-Sperre, Select-Policies der Kategorien/Bezirke/USt.-Regeln. Bericht `tmp/proof/s9b-1-rotbeweis.md`.

### 4.6 Akzeptanzkriterien (alle Exit 0, Befehl → Nachweis)

1. `npm run check` → `tmp/proof/s9b-1-check.log`.
2. `npm run test:rls` → `tmp/proof/s9b-1-rls.log` (inkl. Allowlist-Test).
3. `node scripts/redproof-s9b.mjs --only s9b-1` → `tmp/proof/s9b-1-rotbeweis.md` (alle aufgeführten Sperren rot mit Ist-Wert, Restprüfung grün).
4. `npx dotenv -e .env.local -- npx supabase migration list --linked` → lokal = remote bis 0023.
5. `npm run db:types`; `npm run build`; `npm run scan:proof`.
6. Konzept und Doku per Edit bereinigt: `S9_KONZEPT.md:338` (`my_member_partner_id`), `:649` (Aufruf-Skript nach S9c), `:281`/`:382` (Partner ändert nur Kontaktdaten), `:382`/`:383` (fünf bzw. sechs Admin-Funktionen für Partner, `partner_vat_rules` auch über `admin_set_vat_rule`), `:384` (Dokument-Metadaten, 5.1); `ARCHITECTURE.md` Abschnitt Partner (Zeilen vorher prüfen); `OPEN_ISSUES.md`: R7-4 erledigt, N-5 an S9d, Listing-Schließung für S9c/S9e.
**Berater-Vorprüfung:** Schema, Helfer, Trigger, Statusfunktionen, `register_partner` (0023). Frage: Querzugriff zwischen Firmen, Selbstzuweisung, Rekursion, lückenlose Statusmaschine?
**Abhängigkeit:** keine über 0022 hinaus. **Vorübergehend nicht funktionsfähig:** nichts; die Freigabe läuft ab diesem Teil über die Funktionen (Eigentümer oder `service_role`).

## 5. S9b-2 Scope, USt.-Regel, Stammdaten, Dokumente

**Ziel.** admin pflegt Kategorien, Bezirke, USt.-Regel und Stammdaten ausschließlich über Funktionen (R11-1, R11-7); Unterlagen liegen in einem privaten Bucket.

### 5.1 Objekte

**Funktionen** (Regeln wie 4.3: SECURITY DEFINER, `service_role`-Grant, `assert_admin`, `audit_log`, Zeile mit `for update` gesperrt):
- `admin_set_partner_scope(p_actor, p_partner, p_services partner_service[], p_districts smallint[], p_note)`: ersetzt Kategorien und Bezirke (Löschen und Einfügen in einer Transaktion); `rental` abgelehnt; bei Status `active` je mindestens eins.
- `admin_set_vat_rule(p_actor, p_partner, p_rule, p_valid_from, p_note)`: neue Zeile; nur `standard_20` (`vat_rule_not_enabled`, bis Phase 2); `p_valid_from >= heute Wien`, sonst `vat_rule_backdated` (P0001, in der Funktion geprüft, **kein CHECK** mit `current_date`).
- `admin_set_partner_master(p_actor, p_partner, p_name, p_legal_form, p_uid, p_small_business, p_street, p_postcode, p_city, p_stripe_account_id, p_note)`: `null` = unverändert; setzt den Marker `app.mv_partner_master = '<partner_id>'` unmittelbar vor dem UPDATE (R11-7); ändert nie `verified_at`.
- `admin_remove_partner_document(p_actor, p_document, p_note)`: löscht eine Dokument-Zeile (gibt einen Platz frei, z. B. nach abgebrochenem Upload); die Datei im Bucket entfernt der Eigentümer über die Storage-API (kein SQL).

**Dokumente:** Tabelle `partner_documents` (`id uuid pk`, `partner_id` FK restrict, `kind` ∈ trade_license, company_register, other, `storage_path text unique not null`, `uploaded_at`); privater Bucket `partner-documents` (10 MB, PDF und JPEG; der Bucket prüft nur den Header, die Dateien gehen nie an Dritte, EXIF ist ohne Belang). Muster wie M20/M21 (Zählung und Pfadprüfung über SECURITY DEFINER, weil Policies sonst mit den Rechten des Partners lesen):
- Insert in die Tabelle durch den Partner nur (`id`, `kind`), Policy `partner_id = my_member_partner_id()` und Status pending/active/payment_hold; BEFORE-INSERT-Trigger `guard_document_insert` ist **SECURITY DEFINER**, setzt `partner_id` aus `my_member_partner_id()` und den Pfad `{partner_id}/{id}`, zählt unter Advisory-Lock höchstens 5 Zeilen je Firma (`limit_reached`).
- Neuer Helfer `private.partner_document_slot(p_name text) returns boolean` (SECURITY DEFINER, `stable`, `search_path = ''`; Firma und `aal2` aus `auth.uid()`/`auth.jwt()`, **keine** Firmen-ID als Parameter): wahr, wenn für den Pfad eine eigene Zeile existiert. Die Storage-Insert-Policy ruft ihn (EXECUTE `authenticated`, Abschnitt 8).
- **Lesen:** Der Partner liest die Metadaten der eigenen Firma (Spalten-Grant `select (id, kind, uploaded_at)`, Policy `partner_id = partner_of_user()`, `aal1` genügt; entspricht `S9_KONZEPT.md:384`), nicht den Pfad, nicht die Datei. admin liest Tabelle und `storage.objects` (`is_admin()`). Der Partner löscht nichts (kein UPDATE/DELETE-Grant). Löschfrist (90 Tage nach Ablehnung, Rechtsfrage) und Anonymisierung folgen mit S9h.

### 5.2 Tests (Rot-zuerst, `tests/rls/partner-admin.test.ts`)

- Je Funktion erlaubt (`service_role`, `p_actor` = admin-Konto) und verweigert: `authenticated`/`anon` → 42501; `p_actor` = Kunde oder `null` → `not_admin` (42501); unbekannte Firma → `not_found`.
- Scope: `rental` → `rental_not_enabled`; ohne Kategorie/Bezirk bei `active` → `scope_incomplete`; Ersetzen zeigt neue Mengen, alte weg. USt.-Regel: ≠ `standard_20` → `vat_rule_not_enabled`; Datum in der Vergangenheit → `vat_rule_backdated`; zweite Regel gleicher Tag → 23505.
- Stammdaten: Partner ändert `name`/`uid` → 42501; `admin_set_partner_master` ändert → ok, Zeile zurückgelesen, `verified_at` unverändert; direktes `update` als `service_role` → 42501; Audit je Aufruf genau eine Zeile.
- Dokumente: eigene Firma legt Zeile an und lädt hoch (Gegenfall, `aal2`; Upload tatsächlich möglich, nicht nur 42501), fremder Pfad → 42501, sechste Zeile → `limit_reached`, nach `admin_remove_partner_document` wieder möglich, `aal1` → 42501/0 Zeilen, Partner liest Metadaten der eigenen Firma (ohne `storage_path`: `select *` → 42501), liest Datei → 0 Zeilen, fremde Metadaten → 0 Zeilen, admin liest, Kunde ohne Firma → 42501.

### 5.3 Rot-Beweise (`--only s9b-2`)

`rental`-Prüfung entfernen (Ist-Wert: Kategorie `rental` gespeichert); `standard_20`-Prüfung entfernen (Ist-Wert: Regel `none` gespeichert); `vat_rule_backdated` entfernen (Ist-Wert: Regel in der Vergangenheit gespeichert); Stammdaten-Marker in `admin_set_partner_master` weglassen (Ist-Wert: Aufruf scheitert, Ausweis „Schicht“) und `guard_partner_fields` isoliert (aus 4.5, Nr. 9b); Storage-Insert-Policy lockern (Ist-Wert: Upload in fremden Pfad gelingt); `partner_document_slot` auf `true` (Ist-Wert: Upload ohne eigene Zeile gelingt); Limit-Trigger (Ist-Wert: sechste Zeile vorhanden); Select-Policy Dokumente (Ist-Wert: Partner liest N fremde Zeilen); Spalten-Grant erweitern (Ist-Wert: Partner liest `storage_path`). Ohne Rot-Beweis (Testabdeckung): `scope_incomplete`, Ableitung von `partner_id` und Pfad im Dokumenten-Trigger.

### 5.4 Akzeptanzkriterien

`npm run check`, `npm run test:rls`, `node scripts/redproof-s9b.mjs --only s9b-2` (→ `tmp/proof/s9b-2-rotbeweis.md`), `migration list` (lokal = remote bis 0024), `db:types`, `build`, `scan:proof`; `OPEN_ISSUES.md`: R11-1, R11-7 erledigt; `GOLIVE.md`: Dokumenten-Bucket, Faktor-Reset, Captcha/Rate-Limit für die offene Registrierung (Kosten und Spam durch Anträge und Uploads, vgl. `OPEN_ISSUES.md:131`). **Berater-Vorprüfung:** die vier Funktionen, Bucket-Policies, `partner_document_slot` (0024). **Abhängigkeit:** S9b-1.

## 6. S9b-3 MFA, Satz lesen

**Ziel.** `aal2` ist mit echten TOTP-Token gegen Dev bewiesen; Partner-Konten lesen den Gebührensatz, Kunden nicht (N-10); `rental_provider` verliert sein Leserecht.

### 6.1 MFA

- **Vorarbeit (Beks):** TOTP im Dev-Dashboard aktivieren (Auth → MFA), `config.toml:305-306` auf `true` setzen (nur die Datei, **kein** `supabase config push`, der die ganze `config.toml` schiebt). Produktiv: `GOLIVE.md`-Punkt. Faktor-Reset: Beks per Dashboard nach Identitätsprüfung (verlorene Faktoren; Supabase-TOTP kennt keine Wiederherstellungscodes).
- **Bibliothek (nicht installieren, Freigabe in der Plan-Vorprüfung):** `otpauth` als `devDependency` (Base32-Secret aus `mfa.enroll` und TOTP-Erzeugung; Node-Stdlib hat kein Base32; nur Tests, nicht im App-Bundle). Alternative: `node:crypto` plus eigener Base32-Decoder, nur wenn `otpauth` abgelehnt wird.
- **Testhilfe `tests/support/totp.ts`:** `makeAal2User(tag)`: `makeUser` (Passwort, `aal1`) → `supabase.auth.mfa.enroll({ factorType: 'totp' })` → Code aus `totp.secret` (30 s, aktuelles Fenster) → `mfa.challenge` und `mfa.verify` → Sitzung mit `aal=aal2` → Client mit dem neuen Access-Token. Sequenziell, mit Pause (Auth-Rate-Limits); Faktoren verschwinden mit dem Konto.
- **Durchsetzung nur in der Datenbank:** Helfer, Policies und Funktionen aus 4–5 prüfen `aal2` selbst; S9b enthält keine Edge Function. Admin: `is_admin()` verlangt `aal2` (M15); `admin_*`-Funktionen laufen nur über `service_role`/Eigentümer.

### 6.2 Satz lesen (N-10) und `rental_provider`

- `alter policy platform_settings_select` auf: `(select private.is_admin()) or (key in ('fee_rate','fee_vat_rate') and (select private.my_member_partner_id()) is not null)`. Gilt für alle Zeilen dieser Schlüssel, **auch künftige** (P2B: angekündigter Satz). `rental_provider` kommt in der Policy nicht mehr vor; die Rolle bleibt im Enum ohne Funktion.
- **Spalten-Grant:** `revoke select … from authenticated; grant select (key, version, value, effective_from)` (die Spalte `note` bleibt intern; `current_fee_rates` nutzt nur diese Spalten, M16:71-78). In der Session zuerst die Spalten von `platform_settings` aus `information_schema` lesen und die Notizen der `fee_*`-Zeilen prüfen; Tests, die `select('*')` oder `note` als admin lesen, ziehen auf Eigentümer-SQL oder eine Spaltenliste um (nicht `data ?? []`, `rls.test.ts:324`).
- Kunde ohne Firma und `anon`: kein `fee_*` per API (View liefert NULL-Spalten, Tabelle 0 Zeilen); `booking_terms()` bekommt **keinen** neuen Schlüssel.
- Keine neue SECURITY-DEFINER-Funktion, keine neue EXECUTE-Freigabe.

### 6.3 Tests (Rot-zuerst, `tests/rls/partner-mfa.test.ts`)

- Echte Token: Konto ohne Faktor → JWT `aal1`; nach `verify` → `aal2` (Ist-Wert aus `auth.jwt()` per `select`).
- Matrix aus 4.4 und 5.2 **noch einmal mit echtem Token gegen PostgREST**: Mitglied `aal1` → Fachobjekte 0 Zeilen/42501; `aal2` → erlaubt. **Admin mit echtem Token:** `aal1` → 0 Zeilen auf `partners`, `aal2` → Zeilen.
- Satz: Firma in jedem Status (pending, active, payment_hold, suspended, rejected) liest `fee_rate`/`fee_vat_rate` mit `aal2`, mit `aal1` 0 Zeilen.
- Verweigert (je mit Gegenfall): Kunde mit `aal2` ohne Firma liest `fee_rate` → 0 Zeilen; Partner liest `fee_notice_days`/`cancel_*` → 0 Zeilen; `rental_provider` (per `ownerGrantRole`) liest `fee_rate` → 0 Zeilen; `anon` → 42501; `note` lesen → 42501; Partner schreibt `platform_settings` → 42501; `current_fee_rates` für Kunden liefert NULL.
- Kein `fee_*` in Kundenantworten: `booking_terms()`-Schlüssel gleich der Liste der fünf; `quote`-Antwort ohne Gebühr (bestehender Test bleibt grün).
- Ersatz der Tests zu Vermieter-Satz und `fee_splits`: `rls.test.ts:320-357` und `quote.test.ts:70, 175-184, 249, 295-297` (nicht `rls.test.ts:360-395`, das sind die `price_config`-Tests), umgestellt auf Partner-Konten.

### 6.4 Rot-Beweise (`--only s9b-3`)

Policy lockern, indem `my_member_partner_id()` durch `partner_of_user()` ersetzt wird (Ist-Wert: Mitglied `aal1` liest die `fee_rate`-Zeile; zusätzlich mit echtem `aal1`-Token); Schlüsselfilter entfernen (Ist-Wert: Partner liest `fee_notice_days`); `rental_provider` wieder aufnehmen (Ist-Wert: Rolle liest `fee_rate`); Spalten-Grant erweitern (Ist-Wert: `note` lesbar); Mitgliedsprüfung auf `true` (Ist-Wert: Kunde liest `fee_rate`). Ohne Rot-Beweis: Schreibverbot auf `platform_settings` (Schicht aus M16), `anon` → 42501.

### 6.5 Akzeptanzkriterien

`npm run check`, `npm run test:rls` (echte TOTP-Tests grün gegen Dev), `node scripts/redproof-s9b.mjs --only s9b-3` (→ `tmp/proof/s9b-3-rotbeweis.md`), `migration list` (bis 0025), `db:types`, `build`, `scan:proof`; `GOLIVE.md` (TOTP produktiv, Reset-Prozess), `OPEN_ISSUES.md` (N-10 erledigt). **Berater-Vorprüfung:** Policy, Spalten-Grant, `config.toml`, Testhilfe. **Abhängigkeit:** S9b-1; Beks hat TOTP im Dev-Projekt aktiviert und die Bibliothek freigegeben. Ohne diese Vorarbeit startet S9b-3 nicht (S9b-4 ist davon unabhängig).

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
  foreign key (revision_id, request_id) references public.price_revisions (id, request_id) on delete restrict,   -- M18:24 unique (id, request_id)
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
  constraint reverses_shape check ((kind in ('cancellation','correction')) = (reverses_entry_id is not null)),
  constraint non_negative_kinds check (kind not in ('booking','cancellation_fee') or (total_cents >= 0 and fee_cents >= 0 and fee_net_cents >= 0 and fee_vat_cents >= 0 and payout_cents >= 0)),
  constraint vat_rule_phase1 check (vat_rule = 'standard_20')                       -- bis Phase 2 (M-6), Constraint wird dann ersetzt
);
create unique index commission_one_booking  on public.commission_entries (request_id) where kind = 'booking';
create unique index commission_one_reversal on public.commission_entries (reverses_entry_id) where reverses_entry_id is not null;
```

`non_negative` und `total_cents >= 0` gelten **nicht** für `change`, `cancellation`, `correction` (Konzept 5.8/9.6).

- **Trigger** `append_only` (UPDATE, DELETE, TRUNCATE) ohne Ausnahme, auch für `service_role`; `revoke update, delete, truncate … from service_role`. Grenze: Der Eigentümer kann Trigger abschalten (Konzept R3); die Restprüfung des Redproofs vergleicht `tgenabled` gegen den Snapshot.
- **Trigger `guard_commission_insert`** (BEFORE INSERT, unabhängig von der Funktion):
  - `cancellation` und `correction`: jeder Betrag exakt die Negation der gegengebuchten Zeile; gegenbuchbar sind **nur** `booking`, `change` und `cancellation_fee` (nie `cancellation`/`correction`); gleiche Firma, gleicher Auftrag, gleiche Sätze, Versionen und `vat_rule` (`amount_mismatch`).
  - `booking`: die Revision hat `total_cents is not null`, `total_cents` der Zeile ist gleich `price_revisions.total_cents`, die Revision ist `current_revision` des Auftrags, `price_version` stimmt mit der Revision überein (`amount_mismatch`); `fee_rate`/`fee_vat_rate` entsprechen den zum Buchungszeitpunkt geltenden `platform_settings`-Zeilen, bestimmt mit **genau dem Ausdruck von `current_fee_rates`** (größtes `effective_from ≤ heute Wien`, bei Gleichstand höchste Version; M16:69-78), samt `fee_rate_version`/`fee_vat_rate_version` (`rate_mismatch`).
  - `change`, `cancellation_fee`: Sätze, Versionen, `vat_rule` der `booking`-Zeile desselben Auftrags (Konzept 9.3: eingefrorener Satz, `rate_mismatch`); `cancellation_fee`: `0 ≤ total_cents ≤` Gesamtpreis der `current_revision` (`amount_mismatch`).
- **Schreiben nur über** `private.commission_book(p_partner, p_request, p_revision, p_kind, p_reverses, p_total, p_fee_rate, p_fee_vat_rate, p_fee, p_fee_net, p_fee_vat, p_payout) returns uuid`: SECURITY DEFINER, `search_path = ''`, **`revoke all … from public, anon, authenticated, service_role` und kein Grant an irgendeine Rolle** (M-4): Nur Eigentümer-Funktionen rufen sie auf, ab S9c die Übergangsfunktionen (`accept`, `confirm_offer`, …), die als `postgres` laufen und in derselben Transaktion Compare-and-Set, Revision und Journal schreiben (Konzept 4.5, `:252`). Die Edge Function rechnet mit `splitFee` (`@pricing`) und übergibt die Beträge **und** die Satzversionen an die Übergangsfunktion; die SQL-Seite rechnet die Gebühr **nicht** neu (`splitFee` bleibt die einzige Stelle, Konzept 9.1), sondern prüft Identitäten (CHECKs), Sätze und Versionen (Trigger). `vat_rule` liest die Funktion selbst (gültige Regel zum Buchungstag aus `partner_vat_rules`, sonst `vat_rule_missing`); `booking` nur für Firmen im Status `active` (`partner_not_active`), die übrigen Arten für jede Firma außer `pending`/`rejected`. **Pflicht in der S9c-Migration (Eintrag in `OPEN_ISSUES.md`):** Zuordnung der Firma zum Auftrag (`assignments`) und Auftragsstatus `accepted` in derselben Transaktion; bis dahin ruft nichts außer Eigentümer-Tests die Funktion auf.
- **Bezug auf Version:** `price_version`, `revision_id`, `fee_rate_version`, `fee_vat_rate_version` je Zeile.
- `fee_splits`: `drop table public.fee_splits` samt Policy (vorher in Migrationen, `supabase/functions` und `src/` nach Resten suchen); Doku-Zeilen in `ARCHITECTURE.md` und `S9_KONZEPT.md` 2.1/9.6 nachziehen (Zeilen vorher prüfen).

### 7.2 RLS

| Tabelle | anon | Kunde | Mitglied `aal1` | Mitglied `aal2` (eigene Firma, jeder Status) | Mitglied fremde Firma | admin `aal2` | service_role |
|---|---|---|---|---|---|---|---|
| `commission_entries` | – | – (kein Grant, keine Policy) | 0 Zeilen | S | 0 Zeilen | S | kein DML, kein Funktionszugriff |

Policy `commission_entries_select` `using (partner_id = (select private.my_member_partner_id()) or (select private.is_admin()))`; Grant `select` an `authenticated`; kein INSERT/UPDATE/DELETE-Grant. **Neue EXECUTE-Freigaben an `anon`/`authenticated`:** keine; `private.commission_book` hat gar keinen Grant. Allowlist-Test aktualisiert. Ein Kunde sieht Gebühr und Journal weder per Tabelle noch per View noch per Funktion.

### 7.3 Tests (Rot-zuerst, `tests/rls/journal.test.ts`; Unit-Test `tests/unit/commission.test.ts`)

- **Journal-Zeilen werden nie committet** (`ON DELETE RESTRICT` und `append_only` machen sie unlöschbar): alle Journal-Tests, auch die Lese-RLS, laufen als Eigentümer-SQL in einer Transaktion mit Rollback (`probes`/`asUser`, Claim-Ebene). **Keine Dauer-Fixture**; die Echt-Token-Prüfung von `aal2` über `my_member_partner_id()` liegt in S9b-3. Firmen, die das Journal berührt haben, entstehen nur in Rollback-Transaktionen.
- Erlaubt (Gegenfall): `booking` mit gültigen Werten (jede Testzeile mit `splitFee` aus `@pricing` gegengerechnet); `change` mit negativer Differenz; `cancellation` und `correction` als exakte Negation; `cancellation_fee`.
- Verweigert: Summe falsch → 23514 (`fee_parts`/`payout_rest`); Betrag ≠ Revisionsbetrag oder Revision ≠ `current_revision` → `amount_mismatch`; zweite `booking` je Auftrag → 23505; zweite Gegenbuchung → 23505; `cancellation`/`correction` ohne `reverses_entry_id` → 23514; Gegenbuchung einer `cancellation` oder `correction` → `amount_mismatch`; Negation um 1 Cent falsch → `amount_mismatch`; Satz ≠ aktueller Satz → `rate_mismatch`; Satz bei Gleichstand zweier Zeilen = höhere Version; Rate abweichend bei `change` → `rate_mismatch`; `cancellation_fee` über Gesamtpreis → `amount_mismatch`; `vat_rule` ≠ `standard_20` → 23514; Firma `pending` → `partner_not_active`; keine `vat_rule` → `vat_rule_missing`; UPDATE/DELETE/TRUNCATE → `append_only`/42501 auch als `service_role`; Aufruf von `commission_book` als `authenticated`/`anon`/`service_role` → 42501; Löschen einer Firma oder eines Auftrags mit Zeile → 23503.
- Lesen (Claim-Ebene): Mitglied B sieht Zeilen von A → 0; Kunde → 0; Mitglied `aal1` → 0; admin `aal1` → 0, `aal2` → sieht; Gegenfall eigene Firma `aal2`.
- Unit (reine Funktion): „Gegenbuchung = Negation“ (jede Betragsspalte exakt −x, Summe über Buchung und Gegenbuchung = 0).
- Ersatz der `fee_splits`- und Vermieter-Satz-Tests (`rls.test.ts:320-357`, `quote.test.ts:70, 175-184, 249, 295-297`, Stellen neu suchen).
- S9g rechnet jede `booking`-Zeile im Export mit `splitFee` nach und meldet Abweichungen (Eintrag in `OPEN_ISSUES.md`).

### 7.4 Rot-Beweise (`--only s9b-4`)

Alle Probes laufen in Rollback-Transaktionen; zweischichtige Sperren isoliert (die innere Schicht nur in der Probe geöffnet).
`append_only`-Trigger abschalten (Ist-Wert: UPDATE ändert `total_cents`, zurückgelesen); `revoke update/delete/truncate … from service_role` zurücknehmen bei abgeschaltetem Trigger (Ist-Wert: DELETE als `service_role` entfernt die Zeile); Select-Policy auf `true` (Ist-Wert: Kunde sieht N Zeilen); Firmenbedingung (Ist-Wert: Fremdfirma sieht Zeilen); `aal2`-Klausel durch `partner_of_user()` ersetzen (Ist-Wert: Mitglied `aal1` sieht Zeilen); `commission_one_booking` entfernen (Ist-Wert: zweite `booking` vorhanden); `commission_one_reversal` (Ist-Wert: zweite Gegenbuchung vorhanden); Negationsprüfung (Ist-Wert: Betrag ≠ −Original gespeichert); Satzprüfung `change`/`cancellation_fee` (Ist-Wert: Zeile mit falschem Satz vorhanden); Revisionsbetrag-Prüfung (Ist-Wert: `booking` über 1 Cent gespeichert); Gegenbuchungsart (Ist-Wert: Gegenbuchung einer `cancellation` gespeichert); `fee_parts`/`payout_rest` (Ist-Wert: falsche Summe gespeichert); Grant `execute` auf `commission_book` an `service_role` bzw. `authenticated` (Ist-Wert: Aufruf erfolgreich, Zeile vorhanden). Ohne Rot-Beweis (Testabdeckung): `non_negative_kinds`, `vat_rule_phase1`, `vat_rule_missing`, `partner_not_active`, TRUNCATE-Trigger.

### 7.5 Akzeptanzkriterien

`npm run check`, `npm run test:rls`, `node scripts/redproof-s9b.mjs` **gesamt** (alle Teile, Restprüfung grün → `tmp/proof/s9b-rotbeweis.md`), `migration list` (bis 0026), `db:types`, `build`, `scan:proof`; `ARCHITECTURE.md`, `S9_KONZEPT.md` (2.1, 9.6 Stand), `OPEN_ISSUES.md` (A4c-N3 erledigt; Pflichtzeilen für S9c: Zuordnung und Auftragsstatus in `commission_book`, Listing-Schließung; S9g: Nachrechnen mit `splitFee`; `vat_rule`-Phase-2-Eintrag mit Frage 14 und Frage Recht 9), `PROGRESS.md`, `GOLIVE.md`. **Berater-Abnahme** (Geld und Sicherheit): nur die Dateien mit Geld- und Sicherheitslogik (0026, `commission_book`, Journal-Tests). **Abhängigkeit:** S9b-1 und S9b-2 (Firmen, Statusfunktionen, USt.-Regel); nicht S9b-3.

## 8. Rechte-Zusammenfassung (Freigabe durch Beks)

| Objekt | Grant | Begründung |
|---|---|---|
| `public.register_partner` | EXECUTE `authenticated` (**neu, Entscheidung nötig**); `revoke all … from public, anon, service_role` | einziger Weg zur Firma; Kunden haben kein INSERT; prüft `auth.uid()`, Rolle `customer`, Bezirke, `unique (user_id)` |
| `private.partner_of_user`, `my_member_partner_id`, `my_partner_id`, `my_job_partner_id` | EXECUTE `authenticated` | von RLS-Ausdrücken im Aufrufer-Kontext ausgewertet, Muster wie `my_role()`/`is_admin()`; Schema `private` nicht über die API erreichbar |
| `private.partner_document_slot(p_name)` | EXECUTE `authenticated` (S9b-2) | von der Storage-Insert-Policy im Aufrufer-Kontext ausgewertet; liest `partner_documents` als Eigentümer |
| `public.admin_approve_partner`, `admin_set_partner_status` (S9b-1); `admin_set_partner_scope`, `admin_set_vat_rule`, `admin_set_partner_master`, `admin_remove_partner_document` (S9b-2) | EXECUTE nur `service_role` | kein Grant an `anon`/`authenticated`; `p_actor` nie aus Anfragedaten |
| `private.commission_book` | **kein Grant** (nur Eigentümer-Funktionen) | verhindert Buchungen ohne Vertrag (M-4) |
| Trigger-Funktionen `private.guard_*` (inkl. `guard_document_insert`, SECURITY DEFINER) | keine | nur Trigger |
| `partners` | `select` (eigene Firma) und `update (contact_name, contact_phone, contact_email)` an `authenticated`, Policy `partners_update_contact` | Kontaktpflege durch die Firma; Statusfilter und `aal2` |
| `partner_members`, `partner_categories`, `partner_regions`, `partner_vat_rules` | `select` an `authenticated`, Policy eigene Firma (`partner_of_user()`), admin `is_admin()` | MFA-Einrichtung mit `aal1`, eigene Daten |
| `partner_documents` | `insert (id, kind)` (Policy: eigene Firma, `aal2`, Status pending/active/payment_hold) und `select (id, kind, uploaded_at)` (Policy eigene Firma) an `authenticated` | Upload-Zeile und Metadaten; kein Pfad, kein UPDATE/DELETE |
| Storage `partner-documents` | Insert Partner (nur über `partner_document_slot`), Select nur admin (`is_admin()`) | Dateien gehen nie an Dritte |
| `platform_settings` Select | Spalten-Grant (key, version, value, effective_from) an `authenticated`; Policy fee-Schlüssel für Mitglieder (`aal2`) und admin | Partner lesen nur `fee_rate`/`fee_vat_rate`; `note` bleibt intern |
| `commission_entries` | `select` an `authenticated` (Policy: eigene Firma `aal2` oder admin `aal2`) | Journal; kein DML |
| `booking_terms()` | unverändert (EXECUTE `anon`, `authenticated`, `service_role`) | **kein neuer Schlüssel** |

## 9. Risiken

1. **Offene Registrierung:** Jeder Kunde kann eine Firma beantragen und sieht ab `pending` mit `aal2` den Satz; mit `aal2` kann er außerdem 5 × 10 MB hochladen (Kosten, Spam). Gewollt (P2B-Transparenz, `CLAUDE.md`); Gegenmaßnahmen: `aal2` fürs Lesen und Hochladen, ein Antrag je Konto, Freigabe nur durch admin; Captcha/Rate-Limit im `GOLIVE.md`.
2. **Token-Laufzeit:** Ein `aal2`-Token lebt bis `jwt_expiry` (3600 s). Status- und Sperrwechsel wirken sofort (Helfer lesen live), ein entfernter Faktor erst nach Ablauf.
3. **Rekursion/Querzugriff/Marker:** Policies auf `partner_members` nur über SECURITY-DEFINER-Helfer (M03); Marker an die Zeile gebunden (M17:229), damit spätere Erweiterungen von `admin_set_partner_status` (S9c/S9e) keine zweite Firma durchwinken; Tests „Firma A liest B“ mit Positivkontrolle.
4. **Geld:** `splitFee` bleibt die einzige Stelle, die rechnet; die SQL-Seite prüft Identitäten, Negation, Revisionsbetrag, Sätze und Versionen, rechnet aber nicht neu (Berater N-9). Ein kompromittierter Secret-Key kann über die späteren Übergangsfunktionen nur innerhalb dieser Prüfungen buchen; `commission_book` hat keinen Grant. Journalzeilen sind nur gegenbuchbar.
5. **Unlöschbare Testdaten:** `RESTRICT` plus `append_only`; Journal-Tests laufen vollständig in Rollback, **keine Dauer-Fixture**. Firmen ohne Journalzeile (auch freigegebene) löscht der Eigentümer über `ownerDeletePartner`.
6. **TOTP gegen Dev:** Auth-Rate-Limits (sequenziell, Pausen), Dev-Dashboard-Einstellung unbekannt (Vorarbeit Beks), neue Abhängigkeit (`otpauth`) braucht Freigabe. Betrifft S9b-3, nicht S9b-4.
7. **Dokumente:** Header-Prüfung des Buckets statt Byte-Prüfung; vertretbar, weil nur admin liest. Löschfrist und Anonymisierung S9h.
8. **P2B:** 30 Tage Vorlauf für Satzänderungen erzwingt die Datenbank (M16); Partner sehen künftige Sätze (6.2); Sperren tragen eine Begründung im Datensatz (Art. 4). Rechtsfragen 4 und 9 (USt.) bleiben offen; `vat_rule` ist bis Phase 2 auf `standard_20` begrenzt.
9. **`staff` und Mehrfach-Mitglieder:** nur im Datenmodell (Phase 2); Phase 1 legt nur `owner` an.

## 10. Rot-Beweis-Skript `scripts/redproof-s9b.mjs`

- Erster Import `./dev-guard.mjs`; `--only s9b-N` für einen Teil, ohne Argument alle Teile nacheinander.
- **Snapshot (Lehre A4c-N3):** (a) Gesamtkatalog der Schemata `public`, `private` und `storage`: Policies auf allen Tabellen, Tabellen- und Spalten-ACL für `anon`, `authenticated`, `service_role`, RLS-Flag, Trigger mit `tgenabled`, Funktionen mit md5, Eigentümer, `prosecdef`, `proconfig`, `proacl`, Enum-Werte, Constraints, Indizes, **Spaltendefaults, View-Definitionen samt `reloptions` (`security_invoker`), Schema-ACL (`private`), `pg_default_acl`, Zeilen in `storage.buckets` (`public`, `file_size_limit`, `allowed_mime_types`)**; (b) die Vereinigung der Objekte, die jede Lockerung in ihrer Deklaration (`touches: [...]`) nennt; das Skript bricht ab, wenn `INNER` ein Objekt öffnet, das nicht im Snapshot steht.
- **Restprüfung am Ende:** keine Policy mit Präfix `redproof_`, `snapshot_vorher === snapshot_nachher` (vor und nach dem Aufräumen), keine zusätzlichen Rechte gegenüber vorher (ACL-Vergleich), `tgenabled` je Trigger gleich dem Snapshot (nicht fest `'O'`), keine Zeilen mit Präfix `mvtest-redproof`, **keine übrig gebliebenen Auth-Testkonten und MFA-Faktoren mit Redproof-Präfix, keine Objekte im Bucket `partner-documents`**, kein Restore-SQL ungenutzt in `tmp/proof/`.
- Jede Lockerung: Restore-SQL **vor** dem Lockern nach `tmp/proof/s9b-restore-<n>.sql`, Wiederherstellung im `finally`; Messung des Ist-Werts vor und nach (M-3); „Sperre“ und „Schicht“ getrennt gezählt.
- Dazu der Negativbeweis des Dev-Guards (Exit 2, `ABBRUCH`) mit fiktiver `SUPABASE_PROJECT_ID`.

## 11. Offen

- Text und gültige Version der **Partnerbedingungen** (`terms_version` wird als Text gespeichert, nur das Format geprüft; die Liste gültiger Versionen steht aus). Auf Dev gilt bis zur Rechtsklärung der Platzhalter `partner-2026-11-entwurf` (Beks, 2026-11-07).
- Schließen offener Listings/Angebote beim Statuswechsel, Zuordnungs- und Statusprüfung im Journal: Pflicht für S9c/S9e.
- Aufruf-Skript für admin-Edge-Functions: S9c.
- `vat_rule` `reverse_charge`/`none`: Phase 2, mit Frage 14 und Frage Recht 9.
- Nach der letzten Abnahme ändert sich diese Datei nicht mehr; verbleibende Findings mittel/niedrig stehen mit Teilschritt in `docs/OPEN_ISSUES.md`.
