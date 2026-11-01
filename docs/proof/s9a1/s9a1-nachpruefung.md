# S9a-1 Nachprüfung (Berater: Geld, Sicherheit, Schema)

Datum: 2026-11-01. Stand: Commit a2eddfb plus Arbeitsbaum (nicht committet).

**Umfang (vollständig gelesen):** `tests/rls/settings.test.ts`, `tests/support/owner.ts`, `scripts/redproof-s9a1.mjs`, `scripts/dev-guard.mjs`, `tmp/proof/s9a1-rotbeweis-nachpruefung.md`, `tmp/proof/s9a1-rotbeweis.md`, `tmp/proof/s9a1-abnahme.md`, Migrationen `…_0015_versions_published.sql` (M15) und `…_0016_settings_admin.sql` (M16). Dazu Ausschnitte: `tests/support/db.ts:1-25`, `docs/GOLIVE.md:18-27`, `.env.example` (Variablennamen), `supabase/.temp/linked-project.json`, Strings im CLI-Binary `node_modules/@supabase/cli-windows-x64/bin/supabase.exe` (per Grep). Gegreppt: `supabase/**` nach `admin_grant_role`, `set_config(`, dynamischem SQL, `cron.schedule`; `supabase/functions/**` nach `SUPABASE_DB_URL`/Postgres-Clients.

**Nicht selbst ausgeführt:** kein `git diff` (kein Shell-Werkzeug), keine DB-Abfrage, kein Testlauf. Den Diff habe ich aus dem Auftrag und dem Vergleich mit der Abnahme (`s9a1-abnahme.md`, alte Zeilennummern) rekonstruiert.

**Hinweis nach CLAUDE.md:** In meiner Tool-Liste steht ein eingebautes `advisor`-Tool ohne Parameter. Ich habe es nicht benutzt.

## Findings

### Hoch

Keine.

### Mittel

**M1 · Rot-Beweis „Trigger guard_role entfernt“: die Erwartung `role_update` entsteht als Folgefehler, nicht als Wirkung.**
- Stellen: `scripts/redproof-s9a1.mjs:74`; `tests/rls/settings.test.ts:302-305`; `tmp/proof/s9a1-rotbeweis-nachpruefung.md:32, 36`.
- Problem:
  - `probes` rollt nur fehlgeschlagene Schritte zurück. Ein gelungener Schritt bleibt für alle folgenden Schritte bestehen (`owner.ts:79`).
  - Ohne Trigger gelingt `profile_id_swap` (`:302`). Das Profil des Kunden heißt danach SPARE1.
  - `role_update` (`:303`, `where id = cust.id`) trifft deshalb 0 Zeilen und meldet `'ok'`, ohne dass eine Rolle geändert wurde. Dasselbe gilt für `name_update_ok` (`:305`); dieser Schritt ist dort trivial grün.
  - Die Erwartung `role_update: expected 'ok'` ist also durch einen No-op erfüllt. Für den UPDATE-Zweig der Rollensperre (M16:135, `customer` → `admin` auf einem bestehenden Profil, der Haupt-Eskalationsweg) gibt es damit keinen sauberen Rot-Beweis.
  - Tragfähig bleibt der Eintrag über `profile_id_swap` (id-Zweig) und `role_insert` (INSERT-Zweig, Zeile mit Rolle admin entsteht).
  - Beim Eintrag „guard_profile_role: Tausch von profiles.id“ (`:70`) ist dieselbe Folge nur Beiwerk. Erwartet ist dort nur `profile_id_swap` mit Ist `'ok'`, und das ist Wirkung: Im grünen Lauf feuert der Trigger auf genau dieser Zeile. `grant_ok: not_found` belegt zusätzlich, dass die Zeile verschoben wurde. Die Zeile `role_update: expected 'ok'` im Bericht (`nachpruefung.md:21`) liest sich aber wie eine zweite gebrochene Sperre, und das ist irreführend.
- Fix:
  - Den Tausch auf ein eigenes Konto legen: SPARE3 in `auth.users` mit Profil (`customer`), Schritt `update … set id = SPARE1 where id = SPARE3`. Kunde und Folgeschritte bleiben dann unberührt. Alternativ `profile_id_swap` ans Ende der Liste stellen.
  - Nach `role_update` einen Wertschritt einfügen, z. B. `role_after_update`, `=(select role::text from public.profiles where id = cust.id)`, erwartet `= customer`. Der Rot-Beweis erwartet dann `role_after_update: expected '= admin'`.
  - Eine eigene Lockerung für den UPDATE-Zweig: `patchFn` mit `"or (tg_op = 'UPDATE' and new.role is distinct from old.role)"` → `''`, Erwartung `role_after_update: expected '= admin'`.

**M2 · 17 der 23 Rot-Beweis-Einträge prüfen weiter nur Schritt oder Soll, nicht die Wirkung. Sechs davon zeigen im Bericht nachweislich keine Wirkung.**
- Stellen: `scripts/redproof-s9a1.mjs:63, 65-69, 71-73, 75-76, 78-82, 85`; Prüfung `:121-124`; `tmp/proof/s9a1-rotbeweis.md:10, 124, 133, 169, 180, 189`; Behauptung „23 von 23“ in `rotbeweis.md:224` und `docs/PROGRESS.md:161`.
- Problem:
  - Fix M1(b) der Abnahme („Schritt **und** Ist-Wert“) ist nur bei den sechs neuen Einträgen umgesetzt.
  - Die übrigen Erwartungen (`'version_published'`, `'fee_rate_notice'`, `'append_only'`, `'fee_rename'`, `'audit_truncate_owner'`, `"to be '42501'"`, `'42501'`, `'to deeply equal'` usw.) erfüllt jeder Fehlschlag des Schritts, auch mit fremdem Ist-Wert.
  - Gemessen am Maßstab (Wirkung, nicht anderer Fehler) erfüllen den Beweis heute nicht:
    - `:63` guard_price_version entfernt. Erwartet ist der Setup-Fehler 23514 (`rotbeweis.md:12`). Die Wirkung steht nur in der Nebenzeile `:14` (UPDATE von service_role auf v1 ohne Fehler). Offen seit Abnahme M1.
    - `:75` audit_log-Grants und `:76` TRUNCATE price_config. Ist ist `P0001: append_only` (`:124`, `:133`): Die zweite Sperre (Trigger) greift, es entsteht keine Wirkung.
    - `:80` publish_version für authenticated. Ist ist `P0001` (`not_found`, `:169`): Die Funktion lief, bewirkt hat sie nichts. Der harte `expect` in `settings.test.ts:141` bricht vor `admin_create_price_version` ab. Dort wäre die Wirkung sichtbar (Kunden-JWT legt mit `p_actor = adm.id` eine Version an).
    - `:81` platform_settings- und `:82` price_config-Grants. Ist ist `undefined` (`:180`, `:189`). Das UPDATE läuft ohne Fehler, ändert wegen RLS ohne UPDATE-Policy aber 0 Zeilen (M16:215-217, M15:264-269).
  - Bei `:75`, `:76`, `:81` und `:82` ist eine Wirkung grundsätzlich unmöglich, solange die zweite Schicht steht. Ein Fehler der Sperren ist das nicht, nur eine falsche Bezeichnung als „bewiesen“.
- Fix:
  - Alle Erwartungen auf die Form `"<schritt>: expected '<Ist>'"` umstellen, z. B. `:65` `"update_config: expected 'ok'"`, `:66`/`:67` `"fee_short: expected 'ok'"`, `:68` `"audit_update_owner: expected 'ok'"`, `:71-73` `"…_truncate_owner: expected 'ok'"`, `:78` `"verify_mismatch: expected 'ok'"`, `:79` `"expected undefined to be '42501'"`, `:85` `"expected [ …"`, `:63` `"expected null to match object { code: 'P0001'"`.
  - `:80`: In der Schleife `settings.test.ts:139-143` `expect.soft` verwenden und `publish_version` auf eine nie angelegte Version stellen (Abnahme N2). Erwartung `"admin_create_price_version: expected undefined to be '42501'"`.
  - `:75`, `:76`, `:81` und `:82` im Skript als eigene Art „Schicht“ führen: Erwartung ist der genaue Fehlerwechsel (z. B. `"audit_update_service: expected 'P0001: append_only'"`). Im Bericht getrennt ausweisen („Schicht erkannt, Wirkung nur bei Wegfall beider Schichten“), nicht als Wirkungsbeweis zählen. Die Gegenprobe dazu liefert der Trigger-Lauf: Ohne Trigger hält dort der Grant allein (Schritt `audit_update_service` grün).
  - `rotbeweis.md` neu erzeugen und `PROGRESS.md:161` danach richtig formulieren.

**M3 · dev-guard: Die Supabase-CLI nimmt die Ref bevorzugt aus `SUPABASE_PROJECT_ID`, und diese Quelle prüft der Guard nicht. Außerdem prüft er nur einmal.**
- Stellen: `scripts/dev-guard.mjs:7-12`; Aufrufer `scripts/redproof-s9a1.mjs:10-12, 90`; `tests/support/owner.ts:11`.
- Beleg aus dem CLI-Binary (`supabase.exe`, String-Grep):
  - „a linked project ref (SUPABASE_PROJECT_ID, else supabase/.temp/project-ref …)“;
  - „checked SUPABASE_PROJECT_ID, supabase/.temp/linked-project.json, supabase/.temp/project-ref“;
  - die Umgebungsvariable `SUPABASE_WORKDIR` bestimmt das Arbeitsverzeichnis, aus dem `supabase/.temp/project-ref` gelesen wird.
- Problem:
  - (a) Ist `SUPABASE_PROJECT_ID` gesetzt (Shell-Profil, CI, künftige Env-Datei), zielt `db query --linked` auf dieses Projekt. Der Guard sieht dabei Dev-Werte in `SUPABASE_PROJECT_REF`, in der URL und in der Ref-Datei und lässt den Lauf zu.
  - (b) Mit `SUPABASE_WORKDIR` liest die CLI eine andere Ref-Datei als der Guard, der relativ zum cwd liest.
  - (c) TOCTOU: Der Guard prüft einmal beim Start. Der Rot-Beweis ruft die CLI aber minutenlang immer wieder auf, auch aus den vitest-Kindprozessen über `owner.ts`. Ein `db:link` in einem zweiten Terminal leitet die späteren Lockerungen auf ein anderes Projekt um.
  - Im Repo ist `SUPABASE_PROJECT_ID` heute nirgends gesetzt (Grep, `.env.example`). Das Risiko ist also gering, die Folge aber hoch: committete Lockerungen auf Produktion.
- Fix: im Guard nach den bestehenden Prüfungen
  - abbrechen, wenn `SUPABASE_PROJECT_ID` gesetzt und ungleich `DEV_REF` ist oder wenn `SUPABASE_WORKDIR` gesetzt ist;
  - danach `process.env.SUPABASE_PROJECT_ID = DEV_REF` setzen. Damit sind alle CLI-Aufrufe des Prozesses und seiner Kinder auf Dev festgelegt, die CLI liest die Variable vor der Ref-Datei. Das schließt auch (c).

### Niedrig

**N1 · Der Regex der profiles-Lockerung übersieht 10 bis 19 Zeilen.**
- Stelle: `scripts/redproof-s9a1.mjs:84`.
- `'= [2-9]\d*'` passt nicht auf „= 12“. Das wirkt in die sichere Richtung: Der Beweis scheitert fälschlich, besteht aber nie fälschlich.
- Fix: `/profiles_admin_aal1: expected '= (?:[2-9]|[1-9]\d+)' to be '= 1'/`.

**N2 · Marker-Beweis: `'ok'` zeigt die Wirkung nur mittelbar.**
- Stelle: `tests/rls/settings.test.ts:80, 100`.
- Tragfähig ist der Beweis, weil die Zeile 9995 sicher existiert; im grünen Lauf feuert der Trigger auf ihr. Unmittelbar wäre ein Folge-Wertschritt `=(select published from public.price_versions where version = 9995)`, erwartet `= false`; rot ergäbe er `= true`. Optional.

**N3 · JWT-Claims gelten in den Probes auch für spätere Schritte.**
- Stelle: `tests/support/owner.ts:67-71`.
- `request.jwt.claims` wird mit `is_local = true` gesetzt und bleibt nach einem gelungenen Schritt für alle Folgeschritte stehen, auch für `anon`- und `service_role`-Schritte (z. B. `unpublished_anon` nach `unpublished_admin_aal1`).
- Heute ohne Folge: Die anon-Policies hängen nicht an `uid`, und service_role umgeht RLS. Ab S9a-2 (mehr Policies mit `auth.uid()`) kann das Ergebnisse verfälschen.
- Fix: Für Schritte ohne `claims` im Prefix `perform set_config('request.jwt.claims', '', true);` setzen.

**N4 · Die URL-Prüfung im Guard ist nicht verankert.**
- Stelle: `scripts/dev-guard.mjs:9`.
- `https://<dev-ref>.supabase.co.example.org` oder `…supabase.com` gälte als Dev. Versehentlich trifft das kaum zu, eine Produktions-URL hat eine andere Ref.
- Fix: `new URL(url).hostname === `${DEV_REF}.supabase.co``.

**N5 · `admin_grant_role`: Der Rechtebeleg über `information_schema.routine_privileges` ist schwächer als nötig.**
- Die View zeigt nur Rechte, an denen die abfragende Rolle als Grantor oder Grantee beteiligt ist. Vererbte Rechte über Rollenmitgliedschaft zeigt sie nicht.
- Fix: einen Wertschritt in `settings.test.ts` als Eigentümer, `=(select string_agg(rolname, ',' order by rolname) from pg_roles where not rolsuper and has_function_privilege(oid, 'public.admin_grant_role(uuid, public.user_role)', 'execute'))`, erwartet `= postgres`. Das erfasst PUBLIC, Mitgliedschaften, `authenticator`, `dashboard_user` und alle `supabase_*`-Rollen ohne Superuser.

## Prüffragen

**A) Geänderte Tests: korrekt, mit M1 und N3.**
- `expectAll` mit `expect.soft` (`settings.test.ts:31-37`) zeigt alle Abweichungen eines Laufs. Erst dadurch werden die Rot-Berichte mit mehreren Kernzeilen aussagekräftig. Die harten `toMatch` in `:204-208` bleiben hart, betroffen ist dort aber nur die Lesbarkeit.
- `flag_without_marker_owner` (`:80`, erwartet `:100`): Er steht als letzter Schritt, damit wirkt kein vorheriger Erfolg hinein.
  - Grün: Der Eigentümer hat keinen Marker, `app.mv_publish` ist nach dem Setup `''` (M15:175), `publish_by_customer` und `publish_empty` brechen vor `set_config` ab (M15:170-172, 188). Ergebnis `field_immutable` (M15:112-116).
  - Rot: Der Trigger rechnet den Hash als Eigentümer, die Version ist ohne `do_publish` veröffentlicht.
- SPARE1/SPARE2 (`:270-275`): Ein Konto in `auth.users` ohne Profil erfüllt den Fremdschlüssel. `profile_id_swap` scheitert im grünen Lauf damit nur noch am Trigger, nicht mehr mit 23503 wie in `rotbeweis.md:79`, und rot zeigt `'ok'`. `role_insert` auf SPARE2 erzeugt rot eine admin-Zeile, das ist Wirkung.
  - Fremdschlüssel auf `profiles.id` haben kein `on update cascade` (M01:107, 146, 174, 200). Der Tausch gelingt nur, weil der Testkunde keine Anfragen hat. Mit SPARE3 nach M1 entfällt diese Abhängigkeit.
- Wertschritte `=` (`owner.ts:72-78`): `set_config('app.probe_val', (expr)::text, true)`, das Ergebnis ist `'= ' || current_setting(...)`.
  - Rot zeigt jetzt die sichtbaren Daten (`= 177`, `= 2`, `= 1`, `= true`), kein `P0001: false` mehr.
  - Der Wert kann nicht aus einem früheren Schritt durchsickern: Er wird in jedem `=`-Schritt neu gesetzt, und bei einem Fehler rollt der Savepoint ihn zurück.
- `audit_read_aal1 = 0` ist aussagekräftig, weil im selben Lauf mindestens zwei Journalzeilen existieren: Setup `admin_create_price_version` (M15:213) und `audit_insert_ok`.

**B) Neue Rot-Beweise (`s9a1-rotbeweis-nachpruefung.md`).**

| Eintrag | Ist im Rot | Wirkung? |
|---|---|---|
| Marker (`:5-13`) | `flag_without_marker_owner: 'ok'` | ja (Veröffentlichung ohne Marker gelingt), Einschränkung (1) siehe unten |
| id-Tausch (`:15-26`) | `profile_id_swap: 'ok'` | ja; `role_update` und `grant_*` sind Beiwerk |
| guard_role entfernt (`:28-42`) | swap `'ok'`, `role_insert` `'ok'`, `role_update` `'ok'` | swap und insert: ja; `role_update`: nein, No-op auf 0 Zeilen (M1) |
| is_admin ohne aal2 (`:44-55`) | `audit_read_aal1 = 177`, `is_admin_aal1 = true` | ja (fremde Journalzeilen sichtbar) |
| price_versions_select (`:57-66`) | aal1 und anon `= 1` | ja (unveröffentlichte Version sichtbar) |
| profiles_select (`:68-75`) | `= 2` statt `= 1` | ja (fremdes Profil sichtbar) |

- **(1) Marker.** Die 42501 für service_role ist ehrlich als Nebensperre benannt (`settings.test.ts:78-79`). Sie ist aber zufällig: Die Trigger-Funktion ist nicht SECURITY DEFINER (M15:93-95), und service_role hat kein USAGE auf `private`.
  - Bekommt service_role später USAGE auf `private`, hängt der service_role-Weg allein am Marker. Diesen Fall deckt der Eigentümer-Schritt ab, denn der Trigger läuft dort mit vollem Recht.
  - Der Beweis zählt. Der Eigentümer ist zwar kein Angreifer (er kann Trigger abschalten), der Schritt prüft aber genau die Logik, die jeden künftigen SECURITY-DEFINER-Weg schützt.
- **(2) Folgefehler nach dem id-Tausch.** Beim id-Tausch-Eintrag sind sie Beiwerk. Beim guard_role-Eintrag machen sie die Erwartung `role_update` unsauber (M1).
- **(3) Regexe und Strings.** Die sechs neuen Erwartungen verlangen Schritt und Ist. Sie sind eindeutig: Kein Schrittname ist Präfix eines anderen, z. B. erfüllt `flag_without_marker:` nicht `flag_without_marker_owner:`. Die vitest-Kürzung langer Strings (`…`) kann nur Fehlalarme erzeugen, keine falschen Treffer. Ausnahmen: `role_update` (M1) und der Bereich in `:84` (N1). Die 17 alten Einträge siehe M2.
- Die Definitionen vor und nach dem Lauf sind laut Bericht identisch (`nachpruefung.md:79`).

**C) dev-guard (Punkt 1a).**
- Richtig:
  - Fail closed: Eine fehlende Variable oder Datei ergibt `''` und damit einen Abbruch. Das ist gewollt; ein falsches cwd fällt ebenfalls auf.
  - Exit 2 auf Modulebene, als erster Import (`redproof-s9a1.mjs:6`). Nach ESM-Reihenfolge läuft vorher nur `node:`-Code ohne Seiteneffekt.
  - Die Kindprozesse erben `process.env`. dotenv-cli überschreibt gesetzte Variablen ohne `-o` nicht, die geprüften Werte gelten also auch in vitest (Abnahme-Punkt M3 c ist damit weitgehend entschärft).
- Umgehungen: `SUPABASE_PROJECT_ID`, `SUPABASE_WORKDIR` und die einmalige Prüfung (M3). `linked-project.json` ist nur ein Metadaten-Cache; auf Dev enthält er die Dev-Ref. Dazu kommt die unverankerte URL-Prüfung (N4).
- Der fehlende Guard in `owner.ts`/`db.ts` ist als A1-M3 in `docs/OPEN_ISSUES.md:81` für S9a-2 eingeplant. Mit dem Pinning aus M3 wäre der Rot-Beweis-Weg schon jetzt geschlossen.

**D) `admin_grant_role` (Punkt 1b).**
- **SQL** (M16:165-181):
  - Der Marker passt genau zu `p_user:p_role` (M16:170, 136).
  - Bei `not_found` rollt die Ausnahme den lokalen GUC mit zurück.
  - Revoke von `public`, `anon`, `authenticated` und `service_role` (M16:179-180), kein Grant. Damit gelten auch die Supabase-Default-Privileges nicht, die neue Funktionen an anon, authenticated und service_role vergeben.
- **aal2-Test:** Das Argument reicht. EXECUTE wird gegen die Datenbankrolle geprüft, bevor der Funktionsrumpf läuft. Jeder Nutzer-JWT läuft als `authenticated`, gleich ob mit aal1 oder aal2: `aal` ist nur ein Claim in `request.jwt.claims`, den `role`-Claim setzt GoTrue, und der Nutzer kann ihn nicht ändern.
  - Den Fall „admin-JWT aal1“ testet `settings.test.ts:137-144` bereits.
  - Ein aal2-Test über die API (echte MFA) brächte keinen Mehrwert. Wer Gürtel und Hosenträger will: `asA('grant_aal2', adm.id, 'aal2', "perform public.admin_grant_role('<cust>', 'admin')")`, erwartet `42501: permission denied for function admin_grant_role`, kostet einen Probe-Schritt.
- **Indirekte Wege: keine gefunden.**
  - Keine andere Funktion ruft `admin_grant_role` auf (Grep `supabase/**`: nur Definition, Revoke und generierte Typen).
  - Kein dynamisches SQL (`execute`) in den Migrationen.
  - Den Marker `app.mv_role_grant` setzen nur `admin_grant_role` und `become_rental_provider`. Letztere setzt fest `uid:rental_provider` (M16:157).
  - PostgREST kann keine `app.*`-GUCs setzen, `set_config` liegt in `pg_catalog` und ist nicht ausgeliefert.
  - Keine Edge Function öffnet eine direkte Postgres-Verbindung (Grep `SUPABASE_DB_URL`, Postgres-Clients: keine Treffer).
  - Die Cron-Jobs rufen nur feste Funktionen auf (M06:93, M09:16, M11:82).
  - `supabase_admin` ist Superuser und Plattform-intern; das ist kein Angriffsweg über die App.
  - `dashboard_user` und Rollenmitgliedschaften erfasst `routine_privileges` nicht verlässlich: siehe N5 mit `has_function_privilege`.
- **Erster Admin:** per Eigentümer-SQL im Dashboard (`docs/GOLIVE.md:23`), in Tests über `owner.ts:35-36`. Das ist konsistent.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `tests/rls/settings.test.ts:31-37` | `expect.soft` für Werte und Schlüsselmenge: stimmt |
| `tests/rls/settings.test.ts:80, 100` | Eigentümer-Schritt als letzter, erwartet `field_immutable`: stimmt |
| `tests/rls/settings.test.ts:270-275` | SPARE1/2 in `auth.users`, Profile gelöscht: stimmt |
| `tests/rls/settings.test.ts:290-301, 322-333` | Wertschritte mit Sollwerten `= 0`, `= false`, `= 1`: stimmt |
| `tests/rls/settings.test.ts:302-305` | Tausch vor `role_update`/`name_update_ok` auf demselben Kunden: Folgewirkung (M1) |
| `tests/rls/settings.test.ts:139-143` | harter `expect` in der Schleife, bricht beim ersten Aufruf ab (M2, `:80`) |
| `tests/support/owner.ts:72-79` | `=`-Modus über `app.probe_val`; Erfolg bleibt im Savepoint bestehen: stimmt |
| `tests/support/owner.ts:67-71` | Claims werden für Folgeschritte nicht zurückgesetzt (N3) |
| `scripts/redproof-s9a1.mjs:64, 70, 77, 83` | Erwartung „Schritt: expected Ist“: stimmt |
| `scripts/redproof-s9a1.mjs:74` | `role_update` als Erwartung, nur durch einen No-op erfüllt (M1) |
| `scripts/redproof-s9a1.mjs:84` | `[2-9]\d*` (N1) |
| `scripts/redproof-s9a1.mjs:63, 65-69, 71-73, 75-76, 78-82, 85` | nur Name oder Soll (M2) |
| `scripts/redproof-s9a1.mjs:121-124` | `includes`/`RegExp.test` über alle Fehlermeldungen: stimmt |
| `scripts/dev-guard.mjs:7-16` | drei Quellen, fail closed, Exit 2; ohne `SUPABASE_PROJECT_ID`/`SUPABASE_WORKDIR` (M3) |
| `scripts/dev-guard.mjs:9` | URL-Regex ohne Anker (N4) |
| `node_modules/@supabase/cli-windows-x64/bin/supabase.exe` (Strings) | „SUPABASE_PROJECT_ID, else supabase/.temp/project-ref“; `SUPABASE_WORKDIR` liest die Umgebung (M3) |
| `supabase/.temp/linked-project.json:1` | Ref `vcpbbzdyltvffvzjrzdi` (Dev): stimmt |
| `.env.example:3-9` | kein `SUPABASE_PROJECT_ID`: stimmt |
| `…_0015_versions_published.sql:93-95, 119` | Trigger ohne SECURITY DEFINER, ruft `private.price_version_hash`: Ursache der 42501 für service_role |
| `…_0015_versions_published.sql:112-117` | Marker-Bedingung, auf die der Patch `:64` passt: stimmt |
| `…_0016_settings_admin.sql:134-139` | id-Zweig und Rollen-Zweig getrennt; die Patches `:70` und M1 passen |
| `…_0016_settings_admin.sql:165-181` | Revoke inklusive `service_role`, kein Grant, Marker exakt: stimmt |
| `…_0016_settings_admin.sql:215-218` | keine Schreib-Policies auf platform_settings: Grant-Lockerung `:81` ergibt nur einen No-op (M2) |
| `…_0001_foundation.sql:107, 146, 174, 200` | Fremdschlüssel auf `profiles.id` ohne `on update cascade` |
| `supabase/**` Grep `admin_grant_role`, `set_config(`, `execute` | kein indirekter Aufrufer, Marker nur M16:157, 170: stimmt |
| `supabase/functions/**` Grep `SUPABASE_DB_URL`/Postgres-Client | keine Treffer |
| `tmp/proof/s9a1-rotbeweis-nachpruefung.md:8-75` | sechs Einträge, Ist-Werte wie in Tabelle B |
| `tmp/proof/s9a1-rotbeweis.md:10, 124, 133, 169, 180, 189` | Setup-Fehler, zweite Schicht oder No-op statt Wirkung (M2) |
| `docs/OPEN_ISSUES.md:81` | A1-M3 (Guard in Tests) für S9a-2 eingetragen |
| `docs/GOLIVE.md:23` | erster Admin per Eigentümer-SQL: stimmt |

Offene Findings hoch: 0
