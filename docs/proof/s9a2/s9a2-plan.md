# S9a-2 Berater-Prüfung: Diff ef189b0 und Bauplan/SQL-Entwurf 0017/0018

Datum: 2026-11-01 · Prüfer: advisor-report (Geld, Sicherheit, Schema) · nur gelesen, nichts angewandt

**Umfang**
- Teil A: `tmp/proof/s9a2-diff-ef189b0.patch` (377 Zeilen), dazu vollständig `scripts/dev-guard.mjs`, `tests/support/owner.ts`, `scripts/redproof-s9a1.mjs:1-186`, `scripts/scan-proof.mjs` (im Patch), `.env.example`.
- Teil B: `tmp/proof/s9a2-bauplan.md`, `supabase/migrations/20261101180000_0017_status_machine.sql` (279 Z.), `supabase/migrations/20261101190000_0018_revisions_contacts.sql` (326 Z.), gegen `docs/S9a_PLAN.md` Abschnitt 2 und 5, `docs/S9_KONZEPT.md` 4.1, 4.4, 4.5, 5.4, 5.10, 6, 10.1, `docs/OPEN_ISSUES.md` (R2-*, A1-*, Nachprüfung), Migrationen 0001, 0002, 0003, 0010, 0011, 0015, 0016 (0012–0014 per Suche), `_shared/quote/{handler,db,parse,snapshot}.ts`, `_shared/pricing/*` (low/high), `tests/rls/{rls,quote,uploads,settings}.test.ts` (relevante Stellen), `scripts/live-test.mjs`, `scripts/live-quote-app.mjs`, `scripts/golive-check.mjs`, `supabase/seed*.sql` (Schlüssel).
- Hinweis nach CLAUDE.md: In meiner Tool-Liste erschien ein eingebautes `advisor`-Tool ohne Parameter. Ich habe es nicht benutzt.

**Ergebnis in einem Satz:** Teil A ist korrekt und öffnet keine neue Lücke. Der SQL-Entwurf ist syntaktisch und in der Reihenfolge schlüssig (keine übersehene Enum-Abhängigkeit, keine OUT-Parameter-Kollision, Kaskade und Deferred-Trigger tragen). Den Status einer bestehenden Zeile ändert am Funktionspfad vorbei niemand außer dem Eigentümer. Offen bleiben zwei mittlere Lücken bei `service_role`: Sie darf Umfangsspalten ändern und ganze Anfragen samt `status_events` löschen.

---

## Findings

### Hoch

Keine.

### Mittel

**M-1 · `supabase/migrations/20261101180000_0017_status_machine.sql:240-242` (dazu `0001_foundation.sql:253-257`): `service_role` behält UPDATE auf allen Spalten von `service_requests`**
- Szenario: 0001 widerruft nur für `anon` und `authenticated`. Deshalb darf `service_role` per PostgREST-PATCH `customer_id`, `service`, `from_address`/`from_point`, `to_address`/`to_point`, `route`, `region`, `preferred_date`, `time_window`, `volume_m3`, `description` und `client_ref` ändern. Die Revision bleibt dabei unverändert, der Festpreis also auch. Folgen: Strecke oder Termin ändern sich ohne Zustimmung des Kunden, `preferred_date`/`time_window` passen nicht mehr zu `termin_at`, und mit `customer_id` wandert eine Anfrage samt Revision zu einem anderen Kunden (Datenschutz). Das ist Prüffrage 4: Die Lücke über `from_point`/`route`/`region` besteht. Konzept 4.4 verlangt, dass „Spalten für Preis, Umfang und Revision“ außerhalb der Funktionen gesperrt sind.
- Fix (0018, nach dem Anlegen von `current_revision`):
  ```sql
  revoke update on public.service_requests from service_role;
  grant update (current_revision) on public.service_requests to service_role;
  ```
  Ein REVOKE auf Tabellenebene entzieht auch alle Spaltenrechte, danach gilt nur das Spaltenrecht. `set_updated_at` setzt `updated_at` weiter, weil Trigger keine Spaltenrechte brauchen. `quote_save_request` setzt nur den Zeiger und läuft damit weiter. Test: `service_role` PATCH `from_address` → 42501. Positivkontrolle: `quote_save_request` setzt den Zeiger. Den Kommentar in 0017:240-241 entsprechend anpassen.

**M-2 · `0017_status_machine.sql:155`, `0018_revisions_contacts.sql:12, 168`: `service_role` löscht ganze Anfragen und damit `status_events` und Revisionen (Prüffragen 1 und 2: „Löschen und Neuanlegen“, „Kaskade tarnen“)**
- Szenario: `service_role` hat DELETE auf `service_requests` (Default-Grant aus 0001). `DELETE … WHERE id = X` löst die Kaskade aus. `immutable_row` lässt sie zu, weil der BEFORE-DELETE-Trigger von `price_revisions`/`status_events` in der Tiefe 2 läuft. Damit verschwinden Revisionen und das Statusprotokoll. Danach kann `quote_save_request` mit derselben `client_ref` eine neue Anfrage anlegen (neue `id`). Dieselbe Kaskade erreicht `service_role` auch über `DELETE FROM profiles` (Default-Grant). Den Status einer *bestehenden* Zeile ändert das nicht. Eine Revision allein ohne ihre Anfrage zu löschen ist ebenfalls unmöglich (siehe Antwort 2). Verloren geht aber der Nachweis in `status_events`, und `immutable_row` lässt sich über den Eltern-DELETE tarnen.
- Fix (0017 oder 0018):
  ```sql
  create trigger request_delete_guard before delete on public.service_requests
  for each row execute function private.immutable_row('request_immutable');
  create trigger request_delete_guard_truncate before truncate on public.service_requests
  for each statement execute function private.immutable_row('request_immutable');
  revoke delete, truncate on public.service_requests from service_role;
  revoke delete on public.profiles from service_role;
  ```
  Die Kontolöschung über die Auth-API (`auth.users` → `profiles` → `service_requests`) läuft weiter: Sie erreicht die Anfrage in Tiefe ≥ 2, und RI-Aktionen laufen als Tabelleneigentümer. Die Tests räumen über `auth.admin.deleteUser` auf (`rls.test.ts:184-186`), das bleibt möglich. Folge für 0019 (Plan: „alte Zeilen aus S9a-2-Läufen verwerfen“): Dort muss der Eigentümer den Trigger kurz abschalten (`alter table … disable trigger request_delete_guard; delete …; enable …`). Das in 0019 vermerken. Test: `service_role` DELETE → 42501. Eigentümer-DELETE (Tiefe 1) → `P0001 request_immutable`. Positivkontrolle: `deleteUser` entfernt Anfrage, Revision und Events.

**M-3 · `tests/support/owner.ts:66-71` (OPEN_ISSUES Nachprüfung N3, „vor S9a-2 ergänzen“): `request.jwt.claims` bleibt über Schritte hinweg gesetzt**
- Szenario: `set_config(…, true)` in einem Unterblock, der committet, bleibt bis zum Ende der Transaktion gültig. Ein späterer Schritt ohne `claims` (Eigentümer oder `service_role`) sieht deshalb `auth.uid()` des vorigen Kunden. In S9a-2 ist das gefährlich, weil `withdraw` den Akteur aus `auth.uid()` nimmt: Eine Eigentümer-Probe „withdraw ohne Nutzer → not_found“ würde grün, obwohl sie als fremder Kunde liefe. Rot-Beweise wären dann wertlos.
- Fix: im Präfix jedes Schritts ohne `claims` die Claims leeren, `perform set_config('request.jwt.claims', '', true);`. Nach jedem Schritt außerdem `reset role` und die Claims leeren. Mit einem eigenen Probe-Schritt belegen („Eigentümer nach Kundenschritt: `auth.uid()` = null“).

**M-4 · `tests/support/owner.ts`, `tests/support/db.ts`, `scripts/live-*.mjs` (A1-M3, „Beginn S9a-2“): dev-guard fehlt weiter außerhalb der Rot-Beweis-Skripte**
- Szenario: Der Diff sichert nur `redproof-*.mjs` ab (Grep: dev-guard nur in `redproof-uploads.mjs:4`, `redproof-s9a1.mjs:6`). `npm run test:rls` ruft `supabase db query --linked` ohne Ref-Fixierung auf. S9a-2 bringt zwei neue löschende Skripte: `scripts/storage-reset.mjs` (es existiert noch nicht, wird in 0017:8 aber vorausgesetzt) und `redproof-s9a2.mjs`.
- Fix: Projekt `rls` bekommt ein vitest-`globalSetup`, das `scripts/dev-guard.mjs` importiert. Außerdem `import './dev-guard.mjs'` als erste Zeile in `live-test.mjs`, `live-quote-app.mjs`, `live-uploads.mjs`, `storage-reset.mjs` und `redproof-s9a2.mjs`. Die Regel in CLAUDE.md um „DB-Testläufe“ ergänzen (A1-M3).

### Niedrig

**N-1 · `0017_status_machine.sql:228, 258`: Der Marker enthält nur den Zielstatus und ist nicht an die Zeile gebunden** (Plan `S9a_PLAN.md:39`: „er enthält den Übergang (`von>nach`)“). Szenario: Eine künftige Funktion setzt `withdrawn` und ändert in derselben Transaktion versehentlich eine zweite Anfrage, das Paar ist gültig → die Änderung geht durch. Fix: Marker `p_request::text || ':withdrawn'`, der Trigger vergleicht mit `new.id::text || ':' || new.status::text` (Muster wie `app.mv_role_grant` in `0016:136`). „von“ deckt die Paarprüfung ab; die Abweichung von „von>nach“ im Plan oder Konzept vermerken.

**N-2 · `0018_revisions_contacts.sql:148-163`: `require_revision` ist SECURITY INVOKER.** Ein verzögerter Trigger läuft beim COMMIT unter der dann aktiven Rolle. Unter einer Rolle mit RLS, die die Zeile nicht sieht (künftiger SECURITY-DEFINER-Aufruf aus `authenticated`, z. B. T16), liefert `exists` false, und der Trigger lässt den Commit durch (fail open). Fix: `security definer` (fester `search_path` ist schon gesetzt).

**N-3 · `0010_quote.sql:9, 11` + `0018_revisions_contacts.sql:260-264`: `client_ref` ist nullable.** Bei NULL greift `ON CONFLICT` nie, und der Pfad „vorhandene Anfrage“ liefert eine Zeile aus lauter NULL. `requestId` entfällt, `clientRef` wird damit Pflicht. Fix in 0018: `alter table public.service_requests alter column client_ref set not null` (Tabelle leer) und am Anfang von `quote_save_request` `if p_client_ref is null then raise exception 'client_ref_required'; end if;`.

**N-4 · `0018_revisions_contacts.sql:240`: `(s ->> 'window_start_…')::int` scheitert bei einem numerischen Wert mit Nachkommastelle** (`admin_set_setting(…, 480.0, …)` speichert `480.0`, der Check `0016:28` lässt das zu) und liefert dann 22P02 → 500 `internal`. Fix: `::numeric::int`. Für `accept_min_hours > 0`, `accept_max_hours >= accept_min_hours` und `accept_lead_share_percent` (Werte `1 … 100`) fehlen Wert-Checks in `platform_settings` (analog `0016:27-30`). Ohne sie kann ein Fehleintrag eine Frist hinter dem Termin erzeugen. Checks in 0018 ergänzen.

**N-5 · `0018_revisions_contacts.sql:224-249` vor `:251-266`: Idempotenz und `too_late`/`setting_missing` sind falsch geordnet.** Ein Wiederholungsaufruf derselben `client_ref`, der die Schwelle überschreitet, bekommt 422 `too_late` statt der gespeicherten Anfrage. Der Handler fängt den Normalfall über `findExisting` ab (`handler.ts:182-185`), offen bleibt nur das Rennen zweier paralleler Aufrufe an der Schwelle. Fix: am Funktionsanfang `select … where customer_id = p_customer and client_ref = p_client_ref`; wenn vorhanden, sofort zurückgeben. `ON CONFLICT` bleibt für das Rennen.

**N-6 · `tmp/proof/s9a2-bauplan.md:22` (Abweichung 6) trifft nicht zu:** `service_requests_select` nutzt bereits `is_admin()` (`0016:191-192`), ebenso alle übrigen Select-Policies (`0016:185-213`). Nach 0017 sind die letzten admin-Klauseln ohne `aal2` (`service_requests_update`, `rental_bookings_update`, `0001:308-316, 388-396`) weg. Fix: Text korrigieren. Die aal1-Negativtests für `status_events` und `price_revisions` gehören trotzdem in S9a-2 (A1-M2).

**N-7 · `_shared/quote/db.ts:75-85` (Plan „findExisting liest über `current_revision`“): Das PostgREST-Embedding ist mehrdeutig.** Zwischen `service_requests` und `price_revisions` gibt es zwei Fremdschlüssel (`price_revisions.request_id` und den zusammengesetzten `service_requests_current_revision`). `select('…, price_revisions(*)')` liefert deshalb PGRST201. Fix: Hinweis `price_revisions!service_requests_current_revision(snapshot, price_version, total_cents, low_cents, high_cents)`.

**N-8 · `0018_revisions_contacts.sql:36-60`: Snapshot und Betragsspalten werden nicht abgeglichen.** Ein Abbildungsfehler in TS (z. B. Spanne mit `totalCents` im Snapshot) zeigt dem Kunden einen Betrag, den die DB so nicht hält. Fix im INSERT-Trigger: `(new.snapshot->>'kind') = 'offer'` ⇔ alle drei Spalten NULL. Bei `kind = 'price'`: `(snapshot->>'lowCents')::int = low_cents` und `highCents` ebenso, und `snapshot ? 'totalCents'` genau dann, wenn `total_cents is not null`. Fehler `invalid_revision`.

**N-9 · `0017_status_machine.sql:8` und `S9a_PLAN.md:84, 103`: `scripts/storage-reset.mjs` existiert nicht; der Dump nach `tmp/backup/` fehlt im Bauplan.** Fix: Das Skript besser *nach* 0017 laufen lassen. Dann gibt es keine Zeilen mehr, die auf fehlende Dateien zeigen, und Uploads sind ohnehin gesperrt, weil keine Anfrage mehr existiert. Alternativ räumt `photo_orphans`/`photo-cleanup` (`0011:43-54`) nach einer Stunde, wenn der Vault gesetzt ist. Das Skript bekommt dev-guard (M-4). Den Dump vor `db push` in den Ablauf aufnehmen.

**N-10 · `0017_status_machine.sql:113-131`: `service_role` darf weiter Preisspalten von `rental_bookings` ändern** (`total_cents`, `price_snapshot`; Phase 2). `quote_save_booking` fügt nur ein, und das Zurückziehen läuft über `authenticated`. Fix: `revoke update, delete, truncate on public.rental_bookings from service_role` kostet nichts. Sonst die Grenze dokumentieren.

**N-11 · `0018_revisions_contacts.sql:6`: „hier schreibt niemand mehr hinein“ ist nur Konvention.** Eine strukturelle Garantie für Prüffrage 5: `revoke insert, update, delete on public.fee_splits from service_role` in 0018. Die Fixtures in `rls.test.ts:147-176` legen die Zeilen dann per Eigentümer-SQL (`ownerSql`) an.

**N-12 · Rot-Beweis „UPDATE-Revoke“ (`S9a_PLAN.md:112`): Die Wirkung wird von einer zweiten Schicht verdeckt** (wie M2 der Nachprüfung). Ohne UPDATE-Policy liefert RLS nach einem wieder erteilten `grant update(status)` nur 0 Zeilen statt eines Fehlers. Fix: Die Lockerung erteilt das Recht **und** legt eine durchlässige Policy an, oder der Eintrag wird als „Schicht“ ausgewiesen. Der Test prüft 42501 **und** den unveränderten Ist-Status als Wert-Schritt (`=`).

**N-13 · `tests/support/owner.ts:76-78`: Bei `=`-Schritten ist ein NULL-Ergebnis nicht unterscheidbar.** `set_config(…, NULL)` setzt zurück, das Ergebnis lautet dann „= “ oder „null“. Fix: `coalesce((expr)::text, '<null>')`.

**N-14 · `scripts/redproof-s9a1.mjs:90` (vorbestehend): `spawnSync(…, { shell: true })` zerlegt das `-t`-Muster an Leerzeichen.** Aus `-t "audit_log nur anfügen"` wird `-t audit_log`, und die übrigen Wörter landen als Dateifilter. Der Grünlauf umfasst so andere Tests als im Bericht genannt. Fix: das Muster quoten (`JSON.stringify(pattern)`) oder `shell: false` mit `npx.cmd` unter Windows. In `redproof-s9a2.mjs` gleich richtig bauen.

**N-15 · `scripts/dev-guard.mjs:17-22`: Die Wirkung von `SUPABASE_PROJECT_ID` auf die CLI ist behauptet, nicht belegt.** Fix: ein Negativbeweis in `docs/proof/s9a2/`. `SUPABASE_PROJECT_ID=aaaaaaaaaaaaaaaaaaaa` setzen und `node node_modules/supabase/dist/supabase.js db query --linked "select 1"` direkt aufrufen: Die CLI muss die falsche Ref benutzen und scheitern, das belegt, dass die Variable greift. Danach `node scripts/redproof-s9a1.mjs --only x` mit derselben Variable → Exit 2.

**N-16 · `scripts/scan-proof.mjs:199`: Muster unabhängig von der Umgebung ergänzen.** Gemeint sind `sbp_[0-9a-f]{40}` (Access Token) und `postgres(?:ql)?://[^:\s]+:[^@\s]+@` (Verbindungs-URL mit Passwort). Dann fällt ein Treffer auch auf, wenn eine Variable einmal fehlt. Fehlt `docs/proof`, mit eigener Meldung und Exit 2 abbrechen statt mit Stacktrace.

---

## Teil A: Antwort

**Korrekt, ohne neue Lücke.** Einzeln:
- **dev-guard (M3):** Drei Refs (Umgebung, URL, Ref-Datei) müssen gleich `DEV_REF` sein, sonst Exit 2. Das gilt auch bei leeren Werten (fail closed, `dev-guard.mjs:7-16`). `SUPABASE_WORKDIR` ist gesperrt, ein abweichendes `SUPABASE_PROJECT_ID` ebenfalls. Danach wird `SUPABASE_PROJECT_ID = DEV_REF` gesetzt (`:18-22`). Die Kindprozesse erben das: `execFileSync`/`spawnSync` ohne `env`-Option nutzen `process.env`. `dotenv-cli` überschreibt vorhandene Variablen nicht, und `.env.local` definiert `SUPABASE_PROJECT_ID` nicht (`.env.example:1-13`). Die Ref-Datei wird relativ zum cwd gelesen; ein anderes cwd bricht ab (fail closed). Den Nachweis, dass die CLI die Variable tatsächlich vorrangig nutzt, liefert N-15.
- **Regex/URL-Anker (N1, N4):** `^https://([a-z0-9]+)\.supabase\.co(?:/|$)` verhindert `….supabase.co.evil`. Großbuchstaben werden abgelehnt (fail closed).
- **scan-proof:** Es deckt alle Geheimnisnamen aus `.env.example` ab (`SUPABASE_ACCESS_TOKEN`, `_DB_PASSWORD`, `_SECRET_KEY`, `CLEANUP_SECRET`, `ORS_API_KEY`), gibt nie den Wert aus und bricht ohne Variablen mit Exit 2 ab. Ergänzung: N-16.
- **owner.ts:** Der `=`-Wert-Schritt ist korrekt; `set_config` wird im Unterblock bei einem Fehler zurückgerollt. N3 ist weiter offen und wird für S9a-2 relevant (M-3), dazu der Randfall N-13.
- **redproof-s9a1.mjs:** `--only` filtert sauber; Bericht und Exit-Code beziehen sich auf die Auswahl, und der Definitionsvergleich vorher/nachher bleibt. `isRed` verlangt jetzt alle erwarteten Meldungen (`wants.every`), das schließt den „falschen Grund“ aus (A1-M1). Die Erwartungstexte passen zum Format von vitest (`<name>: expected … to be …`). M1: Die Opfer-Konten SPARE1–3 entkoppeln Fremdschlüssel und Testkunden, und `role_after_update` belegt den Ist-Wert. Vorbestehend: N-14.
- **settings.test.ts:** `expect.soft` und `flag_without_marker_owner` (Eigentümer, kein Schema-Recht als zweite Schicht) sind korrekt.

---

## Teil B: Antworten auf die sieben Prüffragen

**1. Status am Funktionspfad vorbei?** Für eine **bestehende Zeile: nein** (außer Eigentümer, dokumentierte Grenze).
- `authenticated` inkl. admin mit aal1/aal2: kein UPDATE-Recht. `0017:242` entzieht auch das Spaltenrecht `update(status)` aus `0001:303`; ein REVOKE auf Tabellenebene widerruft alle Spaltenrechte. Die Policy `service_requests_update` ist entfernt (`0017:19`). Als einzige Funktion bleibt `withdraw`, mit eigenem `auth.uid()` und Compare-and-Set.
- `anon`: keine Rechte; `withdraw` ist für anon widerrufen (`0017:277`).
- `service_role`: Jede Statusänderung trifft `guard_request_status`. Gültige Paare gibt es nur nach `withdrawn`, und dafür ist der Marker `app.mv_transition` nötig. PostgREST setzt nur `request.*`, `set_config` ist nicht als RPC freigegeben, `withdraw` liefert unter `service_role` `not_found` (`auth.uid()` NULL).
- `UPDATE … FROM` und `INSERT … ON CONFLICT DO UPDATE` lösen dieselben BEFORE-UPDATE-Trigger aus und sind gesperrt.
- INSERT ist nur mit `requested`/`awaiting_offer` möglich. Über die REST-API scheitert ein direkter INSERT ohnehin am verzögerten `require_revision`: Eine PostgREST-Anfrage ist eine Transaktion, ohne Revision gibt es keinen Commit.
- TRUNCATE ist ohne CASCADE wegen der Fremdschlüssel nicht möglich, mit CASCADE fehlt das TRUNCATE-Recht auf `status_events`/`price_revisions`. Zusätzlich greifen die Truncate-Trigger, und PostgREST kennt kein TRUNCATE.
- Eine Änderung von `id` blockieren die Fremdschlüssel (NO ACTION).
- **Löschen und Neuanlegen:** möglich für `service_role` (M-2). Es entsteht eine neue `id`; `quote_save_request` vergibt die `id` selbst, eine gleiche `id` ist über API und RPC nicht wählbar. Dabei gehen `status_events` und Revisionen verloren. Eine Umgehung über andere Spalten gibt es für den Status nicht; Umfangsspalten siehe M-1.

**2. Revisionen unveränderlich? Trägt `pg_trigger_depth() > 1`?**
- UPDATE ist für alle Rollen gesperrt (Trigger ohne Tiefen-Ausnahme, `0017:141-144`), auch für `postgres`. `service_role` hat zusätzlich kein UPDATE/DELETE/TRUNCATE (`0018:76`). Der Inhalts-Hash kommt aus dem Trigger, n = 1 und `submit` sind erzwungen, eine zweite Revision scheitert an `current_revision is not null` und `unique (request_id, n)`. Unveröffentlichte Versionen werden abgelehnt (R2-M4 erledigt).
- Das Kriterium trägt für *einzelne* Revisionen. Ein DELETE auf `price_revisions` hat Tiefe 1 und wird abgelehnt. Eine Kaskade entsteht nur über den Fremdschlüssel `request_id`, also nur zusammen mit ihrer Anfrage. `service_role` kann über PostgREST weder Trigger noch Funktionen anlegen (Rollen ohne LOGIN, kein DDL über die API). Kein vorhandener Trigger führt DELETE auf `price_revisions`/`status_events` aus; die einzigen Trigger mit DML (`log_request_status`, `handle_new_user`, Foto-Trigger) fügen nur ein.
- Getarnt werden kann also nur der Eltern-DELETE (direkt oder über `profiles`), siehe M-2.
- Regel für später: Jeder neue Trigger mit DELETE muss gegen `immutable_row` geprüft werden. Das als Kommentar an `immutable_row` festhalten.

**3. Dev-Zeilen, Reihenfolge, Abhängigkeiten, Storage:** Die Reihenfolge ist vollständig.
- Gelöscht wird in der richtigen Reihenfolge: `fee_splits` vor `rental_bookings`/`service_requests`, `request_photos` vorher.
- Alle Policies, die `service_requests.status` oder `rental_bookings.status` lesen, werden vor `ALTER COLUMN TYPE` entfernt. Sonst käme „column used in a policy definition“. Geprüft habe ich `0001:308, 343, 388`, `0002:5-35`, `0003:14-39` und `0011:24-34`; 0004–0009 und 0012–0016 enthalten keine (Grep).
- Ebenfalls vorher entfernt: die Checks `inspection_needs_quote` und `rental_bookings_status_check` (Auto-Name der Inline-Prüfung `0001:175`), die Defaults und die beiden Funktionen mit dem Enum im Rückgabetyp. Die DROP-Signaturen stimmen mit `0010:146-164` überein.
- Weitere Abhängigkeiten vom Enum gibt es nicht (keine View, kein Index, keine Trigger-WHEN-Klausel, keine weitere Funktion; Grep `request_status`). Das `drop type … _old` gelingt daher.
- Plpgsql-Rümpfe mit `'inspection_requested'` gibt es außerhalb der gelöschten Funktionen nicht.
- Storage: Die Dateien bleiben liegen, bis Skript oder `photo-cleanup` sie entfernen (N-9). Neue Uploads sind unmöglich, weil keine Anfrage existiert.
- 0017 und 0018 laufen als zwei Transaktionen. Scheitert 0018, fehlen `quote_save_*` bis zur Korrektur, auf Dev vertretbar. Die neue `quote` erst nach 0018 deployen.

**4. Kundenpreis ohne Zustimmung?**
- Der Preis selbst kann sich nicht ändern: Die Revision ist unveränderlich, der Zeiger wird einmalig gesetzt (`0018:105-126`) und der Fremdschlüssel auf `(id, request_id)` verhindert fremde Revisionen. Die Preisspalten von `service_requests` entfallen (`0018:87-92`). `price_version` hängt an der Revision; eine veröffentlichte Version ist unveränderlich (0015).
- **Lücke:** Umfang und Zuordnung (`from_point`, `route`, `region`, `preferred_date`, `time_window`, `volume_m3`, `service`, `customer_id`) darf `service_role` ändern, Fix in M-1.
- Bis S9a-3 bindet `quote` außerdem nicht an die gezeigte Version (kein Haltefenster). Das ist bekannt (`S9a_PLAN.md:116, 166`).

**5. `fee_splits` und Anpassungen:**
- SQL: Die neuen `quote_save_request`/`quote_save_booking` (`0018:195-306`) berühren `fee_splits` nicht, und kein Trigger schreibt dorthin.
- TS: `feeRow`, `FeeRow`, `loadFeeRates`, der Import von `splitFee` und `type RequestStatus` (`handler.ts:15, 33-34, 54, 72, 92, 104-108, 190, 259, 305`) sowie `fee()` in `db.ts:16-23, 121, 144` entfallen. Damit liest `quote` auch `current_fee_rates` nicht mehr.
- Strukturell garantiert ist das erst mit N-11.
- Die nötigen Anpassungen stehen im eigenen Abschnitt unten.

**6. Wer liest was:**

| Tabelle | Kunde | admin (aal2) | admin aal1 | service_role | anon |
|---|---|---|---|---|---|
| `price_revisions` | S eigene (Policy über `service_requests`, deren RLS gilt mit) | – (R2-N10, bewusst; Matrix 6 sagt S) | – | I, S; kein U/D/TRUNCATE | – |
| `request_contacts` | S eigene | – (nur künftig `admin-contact`, Matrix 6) | – | I, S; kein U/D/TRUNCATE | – |
| `status_events` | – (R2-N10, bewusst bis zur View mit `security_invoker`) | S über `is_admin()` | 0 Zeilen | keine Rechte (Schreiben über SECURITY-DEFINER-Trigger) | – |

`aal2` ist überall dort verlangt, wo admin liest. Für den Kunden auf die eigenen Zeilen ist `aal2` nicht nötig. Spalte „Akteur-ID“: Matrix 6 verlangt für die künftige Kunden-View keinen Grant auf `actor_id`, das betrifft erst S9i. Tests: aal1-admin → 0 Zeilen auf `status_events` mit Positivkontrolle aal2. Kunde fremde Revision und fremder Kontakt → 0, mit Positivkontrolle eigene. `service_role` UPDATE/DELETE auf `price_revisions` → 42501 (Recht) und als Eigentümer → `P0001 revision_immutable` (Trigger), getrennt ausgewiesen (M2-Regel).

**7. Abweichungen 1–6 und Idempotenz:**
1. **Freigegeben.** SQL rechnet `termin_at`, `accept_deadline` und `too_late` mit `now()` der DB, eine einzige Quelle; die Formel stimmt mit Konzept 10.1 überein. Wegen `hours ≥ accept_min_hours` und Anteil < 100 % liegt die Frist nie hinter dem Termin, wenn N-4 die Werte begrenzt. Auflagen: Konzept 5.10 verlangt `termin_at` auch im Snapshot. In S9a-3 schreibt deshalb die SQL-Funktion den Wert in den Snapshot (`p_snapshot || jsonb_build_object('terminAt', termin)`), keine zweite Rechnung in TS. Die Unit-Tests „Minutenwert → termin_at“ und Sommer-/Winterzeit werden DB-Proben: je Fenster, der letzte Sonntag im März und im Oktober, ohne Fenster 00:00.
2. **Freigegeben.** `needs_quote` ist aus `status = 'awaiting_offer'` ableitbar, ein Doppelbestand entfällt. Hinweis: Eine Entrümpelung mit `low = high` (beide Sätze am Mindestpreis, `clearance.ts:57-58`) wird nach der Abbildung ein Festpreis `requested`. Das ist konsistent mit Konzept 5.4 (`low = high` ist keine Spanne), braucht aber einen eigenen Unit-Test.
3. **Freigegeben.** Strenger als der Plan. S9f braucht dann einen eigenen Trigger für die Nachtragsfelder statt `immutable_row`.
4. **Freigegeben**, mit N-2.
5. **Freigegeben** (fail closed).
6. **Gegenstandslos**, die Begründung stimmt nicht (N-6).

**Idempotenz:** `ON CONFLICT DO NOTHING` mit BEFORE-INSERT-Triggern ist unkritisch. `guard_request_insert` läuft auch bei einem Konflikt, wirft aber nicht, weil der Status gültig ist. Für die übersprungene Zeile wird kein AFTER-Trigger und damit kein verzögerter `require_revision` eingereiht. Bei gleicher `client_ref` wartet der zweite Aufruf auf den Commit des ersten, findet dann den Konflikt und liest mit neuem Snapshot (READ COMMITTED) die fertige Zeile samt Zeiger. Rollt der erste zurück, legt der zweite an. Offen sind N-3 (`client_ref` NULL) und N-5 (Reihenfolge `too_late`).

**Weitere Prüfpunkte aus dem Auftrag**
- *OUT-Parameter (`id`, `status`, `needs_quote`, `created`):* nirgends unqualifiziert in SQL-Anweisungen; Konflikt-Ziel `(customer_id, client_ref)`, `returning q.*`, `st.`/`pr.`/`q.`-Aliase. Keine Mehrdeutigkeit.
- *FK-Reihenfolge:* `price_revisions` entsteht vor dem zusammengesetzten Fremdschlüssel, `unique (id, request_id)` existiert. Der Kreis Anfrage ↔ Revision geht beim Löschen auf: Die Kaskade löscht die Revision, die NO-ACTION-Prüfung sieht die bereits gelöschte Anfrage.
- *Triggerreihenfolge (BEFORE UPDATE, alphabetisch):* `guard_request_fields` → `guard_request_pointer` → `guard_request_status` → `set_updated_at`. Keiner ändert eine Spalte, die ein späterer prüft. Die Fremdschlüsselprüfung läuft danach (AFTER).
- *Deferred:* nur `require_revision`; `SET CONSTRAINTS … IMMEDIATE` macht es nur strenger.
- *Storage-Policies:* neu mit `requested`/`awaiting_offer`, inhaltlich wie 0003/0002, ohne admin-Klausel.

---

## Hilfreiche Tests/Skripte, die angepasst werden müssen

**Fixtures (Grundsatz):** Über die REST-API kann niemand mehr eine Anfrage anlegen, weil der verzögerte `require_revision` jede INSERT-Transaktion ohne Revision verwirft. Alle Fixtures laufen daher über `service.rpc('quote_save_request', …)` mit einem Datum von mindestens heute + 2 Tagen und `p_total` bzw. `p_low`/`p_high`. In Eigentümer-Proben genügt `quote_save_request` im Setup, weil das Rollback den verzögerten Trigger nie erreicht. Status außer `requested`/`awaiting_offer` entsteht nur über `withdraw` (Kunde), sonst gar nicht (`S9a_PLAN.md:37`).

- `tests/rls/rls.test.ts:69-76, 113-114` (`requestRow` mit `price_snapshot`/`estimate_cents`, direkter INSERT) → RPC. `:276-277` (`'confirmed'` ist kein Enum-Wert mehr: 22P02, also aus falschem Grund rot; `estimate_cents` gibt es nicht mehr: PGRST204) → `status: 'accepted'` erwartet 42501, `current_revision`-PATCH erwartet 42501. `:282-291` → `rpc('withdraw')`, PATCH erwartet 42501, Ist-Status als Wert. `:294-298` bleibt (Status `withdrawn`). `:301` → `'accepted'` statt `'confirmed'`. `:147-176` (fee_splits-Fixture) → über `ownerSql`, wenn N-11 umgesetzt ist.
- `tests/rls/uploads.test.ts:19-23` (`newRequest` mit Status) → RPC. `:75, :210` (`confirmed` per `service_role`) → geschlossene Anfrage per `withdraw` des Kunden. `:202` (`withdrawn` per `service_role`) → `withdraw`. Neu: Upload zu `awaiting_offer` erlaubt.
- `tests/rls/quote.test.ts:58, 136-151` (fee_splits centgenau) → „keine fee_splits-Zeile“ plus Revision mit `total = low = high = 68961` und gesetztem Zeiger. `:102-115` (Zeilenfelder `estimate_cents`, `needs_quote`, `price_snapshot`, `price_version`) → aus `price_revisions` über `current_revision`. `:153-158` (`inspection_requested`) → `awaiting_offer`, Revision alle NULL. `:161-163` (Entrümpelung `totalCents`) → Spanne ohne `totalCents`, `awaiting_offer`. `:166-177` Idempotenz bleibt, zusätzlich genau eine Revision. `:188-229` (Bearbeiten) entfällt, ersetzt durch „Body mit `requestId` → 400“. `:231-266` (Miete-Splits) → keine fee_splits-Zeile. `:272-299` (alte RPC-Signaturen, Positivkontrolle 23503) → neue Signatur mit gültigem Datum; sonst kommt `preferred_date_required`/`too_late` vor dem Fremdschlüssel. `:307-315` (`estimate_cents`-PATCH → PGRST204; Zurückziehen per PATCH) → Spalten der neuen Sperre, Zurückziehen per `withdraw`. Neu: `too_late` 422, `setting_missing` 500 (nur Unit), 23514 bei inkonsistenten Beträgen per `service_role` (R2-N9).
- `tests/rls/settings.test.ts`: unverändert. Für neue Proben das Muster `expectAll` mit `expect.soft` übernehmen.
- Neu `tests/rls/status.test.ts` (oder in `rls.test.ts`) mit allen Proben aus `S9a_PLAN.md:109`, ergänzt um: `service_role` PATCH Umfangsspalte → 42501 (M-1); DELETE `service_requests` als `service_role` → 42501 und als Eigentümer → `request_immutable` (M-2); Revision n = 2 → `invalid_revision`; Status/Preis-Mismatch → `status_mismatch`; unveröffentlichte Version → `version_unpublished`; Zeiger auf NULL zurück → `invalid_revision_pointer`; Eigentümer-UPDATE von `status_events` → `append_only`; `service_role` INSERT `status_events` → 42501; aal1-admin `status_events` → 0; `withdraw` ohne Login → `not_found`; `status_events`-Zeile mit `actor_role = 'customer'` und `actor_id` nach `withdraw` (Wert-Schritt); Kontolöschung räumt Anfrage, Revision und Events (Positivkontrolle für `pg_trigger_depth`).
- `tests/support/owner.ts`: M-3, N-13. `tests/support/db.ts`: dev-guard (M-4).
- `tests/unit/quote.test.ts:120-140, 371, 491-505` (`confirmed`, `inspection_requested`, `requestId`, 55000) → neue Abbildung, `requestId` → 400, Fehlercodes `too_late`/`setting_missing` über Meldung **und** SQLSTATE P0001 (nicht nur `code`; `handler.ts:202-206`). `tests/unit/draft.test.ts:218` (`not_editable`) entfällt.
- `tests/e2e/anfrage.spec.ts:226-228`, `tests/shots/shots.spec.ts:363, 376-378` (Mock mit `inspection_requested`/`price_snapshot`) → neue Status, Preis/Spanne aus der Revision.
- `scripts/live-test.mjs:77` („genau eine Gebührenaufteilung“) → „keine fee_splits-Zeile, genau eine Revision, Zeiger gesetzt“; `:105` Text an `awaiting_offer` anpassen; dev-guard (M-4).
- `scripts/live-quote-app.mjs:108` (Entrümpelung `kind = price` mit `totalCents`) → Spanne ohne `totalCents`, Status `awaiting_offer`, `needsQuote = true`; `:184-185` (≥ 3 fee_splits) → 0 Zeilen; `:199-200` Aufräum-Prüfung zusätzlich `price_revisions`/`status_events` = 0 nach `deleteUser`; dev-guard.
- `scripts/live-uploads.mjs:42` (direkter INSERT) → `quote` oder RPC; dev-guard.
- `scripts/golive-check.mjs:57` → Liste um `price_revisions`, `status_events`, `request_contacts`, `audit_log` erweitern (anonym 0 Zeilen oder 401/403).
- `scripts/redproof-uploads.mjs` löschen (Plan; stellt `inspection_requested` wieder her, `:45-47`).
- Neu `scripts/redproof-s9a2.mjs`: dev-guard; Snapshot zusätzlich über `service_requests`, `price_revisions`, `status_events`, `request_contacts`, `rental_bookings`, `storage.objects`. Lockerungen einzeln: Paarprüfung, Marker, INSERT-Trigger, UPDATE-Revoke (N-12), `revision_immutable` (UPDATE und Tiefen-Ausnahme `> 0`), `guard_revision_insert` (n, Status, Version), Zeiger-Trigger, `guard_request_fields`, `require_revision`, Rental-Trigger, Grant `status_events` an `service_role`, M-1-Revoke und M-2-Trigger. Erwartungen als „Schritt: expected Ist“ (M2), Muster gequotet (N-14).
- Neu `scripts/storage-reset.mjs` (oder bewusst entfallen lassen, N-9) mit dev-guard.
- `npm run db:types`, danach `supabase/functions/_shared/database.types.ts` und die App-Typen.

---

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `scripts/dev-guard.mjs:7-22` | drei Refs, WORKDIR-Sperre, PROJECT_ID fixiert; fail closed bei leer |
| `.env.example:6-13` | alle Geheimnisnamen vom Filter in `scan-proof.mjs:200` erfasst |
| `tests/support/owner.ts:66-71` | Claims werden für Schritte ohne `claims` nicht geleert (N3 offen → M-3) |
| `scripts/redproof-s9a1.mjs:90` | `shell: true` zerlegt das `-t`-Muster (N-14) |
| `0001_foundation.sql:253-257` | REVOKE nur für anon/authenticated → `service_role` behält DML (M-1, M-2) |
| `0001_foundation.sql:175` | Inline-Check, Auto-Name `rental_bookings_status_check` passt zu `0017:39` |
| `0001_foundation.sql:303, 383` | Spaltenrechte `update(status)`; `0017:242` entzieht das für `service_requests`, Miete bleibt (gewollt) |
| `0002:5-35`, `0003:14-39`, `0011:24-34` | Policy-Namen = DROPs in `0017:20-23` |
| `0010:9-11` | `client_ref` nullable, Unique `(customer_id, client_ref)` (N-3) |
| `0010:32-41, 108-113` | DROP-Signaturen in `0017:27-35` stimmen exakt |
| `0015:47` / `0018:76, 179` | Revoke-Muster für unveränderliche Tabellen konsistent |
| `0016:185-213` | alle admin-Select-Policies schon auf `is_admin()` (N-6) |
| `0016:136` | Marker-Muster `id:wert` als Vorlage für N-1 |
| `0018:195-275` | keine unqualifizierte Referenz auf OUT-Parameter; Konflikt-Ziel ohne Namensgleichheit |
| `0018:240` | `::int` auf jsonb-Zahl (N-4) |
| `handler.ts:182-185` | `findExisting` vor der Berechnung (mildert N-5) |
| `handler.ts:202-206` | Fehlerabbildung nur über `code`; P0001-Meldungen brauchen eigene Zuordnung |
| `db.ts:16-23, 121, 144` | `fee()`-Argumente, entfallen |
| `parse.ts:133, 138, 142` | `requestId` optional, `clientRef` daran gekoppelt, `preferredDate` optional |
| `snapshot.ts:22-29` | Preis-Snapshot führt `totalCents` auch bei Spanne (Plan: entfernen; N-8) |
| `clearance.ts:57-60` | `low = high` am Mindestpreis möglich (Hinweis zu Abweichung 2) |
| `seed.sql:90-92, 109-112` | `accept_*`- und `window_start_*`-Schlüssel vorhanden |
| `rls.test.ts:113-114` | direkter INSERT, scheitert künftig an `require_revision` |
| `quote.test.ts:297` | Positivkontrolle 23503 kippt auf `preferred_date_required` |
| `uploads.test.ts:23, 75, 202, 210` | Status per `service_role`, künftig unmöglich bzw. per `withdraw` |
| `live-test.mjs:77`, `live-quote-app.mjs:108, 184-185`, `golive-check.mjs:57` | wie im Abschnitt Anpassungen |
| `S9_KONZEPT.md:220, 225, 256` | Paar-Trigger ohne Rollen-Ausnahme; T2 aus `requested`/`awaiting_offer`/`offered` = `0017:225` |
| `S9_KONZEPT.md:590` | Formel der Annahmefrist = `0018:246-249` |
| `S9a_PLAN.md:39` | Marker „von>nach“ verlangt (N-1) |

Offene Findings hoch: 0
