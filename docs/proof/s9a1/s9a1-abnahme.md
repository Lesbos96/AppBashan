# S9a-1 Abnahme vor dem Commit (Berater: Geld, Sicherheit, Schema)

Datum: 2026-11-01. Projekt: Dev `vcpbbzdyltvffvzjrzdi`.

**Umfang.** Gelesen und geprüft habe ich:
- die angewandten Migrationen `supabase/migrations/20261101160000_0015_versions_published.sql` (M15) und `…20261101170000_0016_settings_admin.sql` (M16), jeweils vollständig;
- die Skripte `scripts/redproof-s9a1.mjs`, `scripts/dev-guard.mjs`, `scripts/redproof-uploads.mjs` und `scripts/s9a1-verify.mjs`;
- die Tests und Hilfen `tests/rls/settings.test.ts`, `tests/support/owner.ts` und `tests/unit/seed-prod.test.ts`, dazu `tests/rls/rls.test.ts` (Ausschnitte `:85-210`, `:360-489`) und `tests/rls/quote.test.ts` (per Grep);
- `supabase/functions/_shared/quote/db.ts:1-80`, `supabase/seed.sql`, `supabase/seed.prod.sql` (Statements per Grep);
- `CLAUDE.md:76-91`, `docs/GOLIVE.md:18-33`, `docs/OPEN_ISSUES.md:1-56` (dazu Grep), `docs/S9a_PLAN.md:1-80`.

**Abgleich.** Geprüft gegen `docs/S9a_PLAN.md` Abschnitt 2 und 4, `tmp/proof/s9a1-plan.md` (Prüffragen A bis G) und `tmp/proof/s9a1-plan-nachpruefung.md`. Den Rot-Beweis `tmp/proof/s9a1-rotbeweis.md` habe ich vollständig mit Skript und Test abgeglichen, alle 23 Einträge.

**Nicht selbst ausgeführt.** Keine Abfrage gegen die DB und kein Testlauf. Die Existenz der Trigger und Policies und die `routine_privileges` stammen aus der Abfrage der Hauptsession. Die Testzahlen habe ich in den Report-Dateien unter `tmp/reports/` nachgelesen.

## Findings

### Hoch

Keine.

### Mittel

**M1 · Rot-Beweis „Marker-Prüfung“: rot aus dem falschen Grund. Das Prüfkriterium trifft den Soll-Wert, nicht den Ist-Wert.**
- Stellen: `scripts/redproof-s9a1.mjs:64`, `:116`; `tmp/proof/s9a1-rotbeweis.md:23`; `tests/rls/settings.test.ts:69`.
- Problem:
  - Ohne Marker-Prüfung läuft `guard_price_version` weiter bis `new.content_hash := private.price_version_hash(…)` (M15:119).
  - Die Trigger-Funktion ist nicht SECURITY DEFINER (M15:93-95). Als `service_role` scheitert sie daher an `42501: permission denied for schema private` (Kernzeile `:23`), nicht weil die Sperre fehlt.
  - Ob die Marker-Prüfung wirkt, beweist der Lauf damit nicht. Gegen `service_role` hält zusätzlich das Schemarecht. Den Fall, in dem nur der Marker schützt (Eigentümer, künftige SECURITY-DEFINER-Wege), testet niemand.
  - Bestanden ist der Eintrag nur, weil `isRed` (`:116`) bloß `failureMessages.includes(expect)` prüft. `field_immutable` steht als Soll-Wert in der vitest-Meldung („to be 'P0001: field_immutable'“), und das gilt für jeden Fehlschlag dieses Schritts.
  - Ähnlich beim Eintrag „Trigger guard_price_version entfernt“ (`rotbeweis.md:8-10`). Erwartet ist dort der Setup-Fehler `price_versions_published_complete`. Der eigentliche Beweis steht in der zweiten roten Zeile (`:12`, service_role-UPDATE auf v1 ohne Fehler).
  - Das verletzt Plan `:35` („aus dem richtigen Grund, mit der erwarteten Meldung“) für einen der in Plan `:72` ausdrücklich genannten Trigger.
- Fix:
  - (a) Neuer Probe-Schritt als Eigentümer, `{ name: 'flag_without_marker_owner', sql: "update public.price_versions set published = true where version = 9995" }`, erwartet `P0001: field_immutable`. Die Marker-Lockerung erwartet dann diesen Schritt mit Ist `'ok'`.
  - (b) `isRed` gegen Schritt **und** Ist-Wert prüfen, z. B. `expect: "flag_without_marker_owner: expected 'ok'"`. Beim Trigger-Drop von `guard_price_version` als Erwartung `expected null to match object { code: 'P0001'` (API-Test) nehmen.
  - (c) Rot-Beweis erneut laufen lassen und den Bericht ersetzen.

**M2 · Die aal2-Umstellung der meisten admin-Klauseln ist ungetestet und nicht rot bewiesen.**
- Stellen: `…_0016_settings_admin.sql:188-213`; Plan `docs/S9a_PLAN.md:70`.
- Problem:
  - Der Plan verlangt: „admin (`aal1`) liest fremde Anfragen/Buchungen/Fotos → 0 Zeilen, Positivkontrolle … (`aal2`)“.
  - Es gibt aal1/aal2-Proben nur für diese Stellen:
    - `fee_splits` (`rls.test.ts:384-389`);
    - `profiles`, `audit_log` und `price_versions` (`settings.test.ts:279-291`);
    - `is_admin()` selbst.
  - Ohne Test und ohne Lockerung bleiben:
    - `service_requests_select`, `request_photos_select`, `rental_offers_select`, `rental_bookings_select`;
    - `request_photos_objects_select` (Storage);
    - der admin-Teil von `platform_settings_select`;
    - `price_config_select_admin`.
  - Ein späteres Zurückdrehen auf `my_role() = 'admin'` fiele nicht auf.
  - Die Migration selbst ist korrekt: Alle Klauseln rufen `(select private.is_admin())`, alle Policies gelten `to authenticated` (M01:263-412), Execute für `authenticated` gibt M15:15.
- Fix:
  - In `settings.test.ts` eine Probe mit Setup als Eigentümer anlegen (im Rollback): eine Anfrage des Kunden, eine `request_photos`-Zeile, eine Mietbuchung, ein `storage.objects`-Eintrag im Ordner des Kunden.
  - Je Tabelle `asA(…, adm.id, 'aal1', '?(select count(*) = 0 …)')` und `asA(…, 'aal2', '?(… >= 1)')`.
  - Je Klausel ein `policyToggle` im Rot-Beweis (admin ohne aal2).

**M3 · dev-guard deckt nicht alle Wege ab, die gegen das verlinkte Projekt schreiben oder löschen.**
- Stellen: `tests/support/owner.ts:11`, `scripts/live-uploads.mjs:61, 154-197`, `scripts/redproof-s9a1.mjs:90`; Regel `CLAUDE.md:87`.
- Problem:
  - (a) `owner.ts` schickt Eigentümer-SQL per `db query --linked`. Dazu gehören dauerhafte `admin_grant_role`-Aufrufe und damit unlöschbare `audit_log`-Zeilen.
  - (b) `live-uploads.mjs` macht ein UPDATE auf `storage.objects` über `--linked` und löscht Anfragen, Dateien und Nutzer.
  - Beide haben keinen Guard. Nach GOLIVE Schritt 5 (`docs/GOLIVE.md:20`) zeigt der Link des Checkouts auf Produktion. Ein `npm run test:rls` mischt dann die Dev-API (`.env.local`) mit Eigentümer-SQL auf Produktion.
  - Heute ist die Wirkung dort gering: Dev-Nutzer-IDs fehlen in Produktion, und die Proben rollen zurück. Ab S9a-2 entstehen Fixtures aber per Eigentümer-SQL.
  - (c) Die Kindprozesse des Rot-Beweises laden fest `.env.local` (`:90`). Geprüft hat der Guard aber die Umgebung des Elternprozesses. Startet man mit einer anderen Env-Datei, laufen die Tests gegen eine ungeprüfte URL.
  - `live-test.mjs`, `live-auth.mjs` und `live-quote-app.mjs` löschen nur selbst angelegte Nutzer über die API (`.env`-URL). Das Risiko ist dort niedrig, die Regel gilt dem Wortlaut nach aber auch für sie.
- Fix:
  - Guard als `globalSetup` des vitest-Projekts `rls` (oder als erster Import von `tests/support/db.ts` und `owner.ts`).
  - `import './dev-guard.mjs'` als erste Zeile in `live-uploads.mjs`, `live-test.mjs`, `live-auth.mjs` und `live-quote-app.mjs`.
  - In `redproof-s9a1.mjs:90` und `redproof-uploads.mjs:26` vitest ohne erneutes `dotenv -e .env.local` mit `env: process.env` starten.
  - `CLAUDE.md:87` um „und DB-Testläufe“ ergänzen.

### Niedrig

**N1 · Scheitert die Wiederherstellung, bleibt die Lockerung auf Dev, und die gesicherte Definition ist verloren.**
- Stelle: `scripts/redproof-s9a1.mjs:106-114`, `:125-133`.
- `saved` liegt nur im Speicher. Wirft `restore` (z. B. bei einem CLI- oder Netzfehler), bricht die Schleife ab. Das äußere `finally` meldet „weichen ab“, stellt aber nichts wieder her.
- Fix: Vor `apply` das Restore-SQL nach `tmp/proof/s9a1-restore.sql` schreiben, `restore` mit einem Wiederholungsversuch ausführen und bei Fehlschlag die Datei nennen (Exit 1).

**N2 · Die `publish_version`-Lockerung kann dauerhaft veröffentlichen.**
- Stellen: `scripts/redproof-s9a1.mjs:80`, `tests/rls/settings.test.ts:125-127`, Beleg `rotbeweis.md:167` (P0001: Die Funktion lief für den Kunden-JWT mit `p_actor = adm.id`).
- Hätte `TEST_VERSION` (9998) in diesem Moment Konfigurationszeilen (die legt der Test `:155` an), würde ein Kunde sie committet veröffentlichen. Danach wäre sie unlöschbar, und `cleanup` scheiterte an `version_published`.
- Heute sicher, weil `-t "ruft keine Admin-Funktion auf"` nur `it.each` laufen lässt und `beforeAll` 9998 löscht. Das ist aber fragil.
- Fix: `calls()` auf eine nie angelegte Version umstellen (z. B. 9990, auch für `admin_create_price_version`). `cleanup` räumt 9990 mit auf.

**N3 · Einige Sperren haben keine eigene Lockerung.**
- `assert_admin` (M15:55-63, Schritte `publish_by_customer`/`set_customer`);
- der INSERT-Zweig von `guard_price_version` (M15:97-101, `insert_published`), weil der Trigger-Drop schon im Setup scheitert;
- `revoke truncate … platform_settings from service_role` (M15:271, Schritt `truncate`);
- `booking_terms` ohne `fee_*` (M16:81-104).
- Fix: je ein `patchFn` bzw. `grantToggle`, mit Erwartung „Schritt + Ist“ wie in M1.

**N4 · N-neu-4 offen (Konzept und Plan beschreiben den alten Hash).**
- Stellen: `docs/S9_KONZEPT.md:270` (`value::text`, `extensions.digest`), `docs/S9a_PLAN.md:68` („`value::text`“).
- M15:76-89 hasht jsonb über Version, `effective_on` und sechs Felder je Zeile mit `sha256()`.
- Fix: Wortlaut angleichen, sonst in `OPEN_ISSUES.md` eintragen.

**N5 · N-neu-5 offen (Seed-Abgleich ohne `label`/`sources`/`researched_at`).**
- Stellen: `scripts/s9a1-verify.mjs:19-21`; `tmp/proof/s9a1-precheck.txt:1` nennt die verglichenen Felder nicht.
- Meine Stichprobe in `tmp/proof/s9a1-dev-v1-before.json:203-236`: `rental.reference`, `team_rate.1`, `.2` und `.3` haben Label, Quellen und Datum gleich `seed.sql:13-24, 74-78`.
- Die Werte sind gesichert, die Texte von v1 sind eingefroren.
- Fix: Abgleich auf alle Hash-Felder erweitern (aus `s9a1-dev-v1-before.json` oder per Query), sonst in `OPEN_ISSUES.md` eintragen.

**N6 · Der Prüfweg in GOLIVE prüft weder Veröffentlichung noch vollständige Einstellungen.**
- Stelle: `docs/GOLIVE.md:21`.
- Der Seed-Befund ist korrekt vermerkt. Nach dem Prod-Seed fehlen aber diese Prüfungen:
  - v1 `published` mit `content_hash` und `verify_price_version(1)`; ohne das endet `quote` mit 500;
  - alle 27 `platform_settings`, darunter `fee_notice_days`, `cancel_*` und `call_out_fee_cents`; ohne sie liefert `booking_terms` `setting_missing`, und `fee_rate`-Änderungen ebenso.
- Fix: Als Prüfweg `npx dotenv -e <prod-env> -- node scripts/s9a1-verify.mjs` ergänzen. Das Skript ist nur lesend und vergleicht mit `seed.sql`; dessen Tarif-Statements sind laut `seed-prod.test.ts:40-42` identisch mit `seed.prod.sql`.

**N7 · `OPEN_ISSUES.md` ist veraltet.**
- `:36` (Test benennt `fee_vat_rate` um): Der Test ist entfernt (`quote.test.ts:184`), Umbenennen endet jetzt mit `fee_rate_immutable` (M16:42-46). Als erledigt markieren.
- `:8` und `:14` („überschreibt Tarife und Gebührensatz“, „Upserts“): Der Seed nutzt jetzt `where not exists` (`seed.sql:8, 80, 114`) und überschreibt nichts mehr. Text anpassen.

**N8 · Plan-Abweichungen sind nicht vermerkt.**
- `docs/S9a_PLAN.md:35`: Der Bericht soll `s9aN-redproof.json` heißen, geschrieben wird `tmp/proof/s9a1-rotbeweis.md`.
- `:74`: Seed zweimal „per `npm run db:push`“, tatsächlich per `db query -f` (R2-M5, GOLIVE:21).
- `:68`: Der Unit-Test „Vorlauf-Formel, Minutenwert → `termin_at`“ fehlt; `termin_at` entsteht erst in S9a-3.
- Fix: Plan anpassen oder in `OPEN_ISSUES.md` eintragen.

**N9 · Journal-Genauigkeit bei Rollen.**
- `admin_grant_role` schreibt `actor_role = 'owner'`, ohne den Aufrufer zu prüfen (M16:174-175). Im Rot-Beweis (`:79`) entstand so auf Dev eine unlöschbare Zeile `owner`, die `service_role` ausgelöst hat.
- `become_rental_provider` wechselt die Rolle ohne Journalzeile (M16:150-163).
- `create_price_version`-Zeilen aus Tests tragen keine Lauf-Kennung (M15:214, vgl. R2-N12).
- Fix (Folge-Migration in S9a-2, optional): In `admin_grant_role` abbrechen, wenn `nullif(current_setting('request.jwt.claims', true), '')` gesetzt ist, also der Aufruf über die API kam. Den Rollenwechsel in `become_rental_provider` journalisieren. Sonst die Punkte in `OPEN_ISSUES.md` eintragen.

## Prüffragen aus dem Auftrag

**(1) Rot-Beweis-Methode: erfüllt, mit den Einschränkungen M1, N1, N2 und N3.**
- **Committet auf Dev.** Jede Lockerung ist ein eigener `supabase db query --linked`-Aufruf ohne Transaktionsklammer (`redproof-s9a1.mjs:10-15`; DROP `:39`, Funktions-Patch `:48`, GRANT `:53`, ALTER POLICY `:58`). Der Guard läuft vorher (`:6`).
- **Wiederherstellung im inneren `finally`** (`:111-114`). Die Quellen:
  - Trigger: `pg_get_triggerdef` (`:32`, `:41`);
  - Funktionen: `pg_get_functiondef` (`:45`);
  - Policies: `pg_policies.qual`/`with_check` (`:33`, `:57-59`).
  - Alles wird vor `apply` gelesen (`:106`).
  - Nur `grantToggle` stellt aus festem Text wieder her (`:52-54`). Der Schnappschuss erfasst die ACLs aber über `proacl`/`relacl` (`:24`, `:28`), damit ist das abgesichert.
- **Schnappschuss vorher und nachher** (`:98`, `:127`): Policies der sechs Tabellen und von `storage.objects`, Trigger der fünf Tabellen, md5 und ACL der 18 Funktionen, Tabellen-ACLs. Er deckt alles ab, was das Skript ändert. Ergebnis laut Bericht identisch, 23 von 23 (`rotbeweis.md:220-222`).
- **Cleanup** nach jeder Lockerung und im äußeren `finally` (`:101-103`, `:113`, `:126`): Versionen 9997/9998 und `offers_open_max` > v1. Die Reste-Freiheit danach habe ich nicht selbst abgefragt.
- **Existenz der Trigger und Policies** (Abfrage der Hauptsession) gegen die Migrationen geprüft, vollständig:
  - Trigger `guard_role` (M16:146), `guard_price_version` und `_truncate` (M15:127, 129), `guard_price_config` und `_truncate` (M15:156, 158), `guard_platform_setting` und `_truncate` (M16:63, 65), `append_only` und `_truncate` (M15:40, 42);
  - Policies `price_versions_select`/`_admin` und `price_config_select`/`_admin` (M15:276-283), `audit_log_select` (M15:50), dazu die acht per ALTER umgestellten (M16:185-213).
- **test:rls danach:** `tmp/reports/vitest-rls.json` zeigt 114/114 mit Start 20:15:29 UTC. Der letzte vitest-Lauf des Rot-Beweises startete um 20:14:24 UTC (`tmp/reports/redproof-s9a1.json`). Der grüne Lauf kam also danach.
- **v1 unverändert:** `verify_price_version(1)` ist in diesem Lauf grün (`settings.test.ts:146`).

**(3) `p_actor` aus Request-Daten: nein.**
- Grep über `supabase/functions/**`: `p_actor` steht nur in `_shared/database.types.ts:641-693` (generierte Typen).
- Der einzige neue RPC ist `verify_price_version` ohne Akteur (`_shared/quote/db.ts:42`).
- Die Regel steht in `CLAUDE.md:88` unter „Daten und Sicherheit“.

**(5) dev-guard: korrekt, Abdeckung lückenhaft (M3).**
- `scripts/dev-guard.mjs:7-16` prüft drei Quellen: `SUPABASE_PROJECT_REF`, die Ref aus `NEXT_PUBLIC_SUPABASE_URL` und `supabase/.temp/project-ref`.
- Fail closed: Eine fehlende Quelle ergibt `''`, das ist ungleich der Dev-Ref. Das gilt auch bei falschem cwd.
- Abbruch mit `process.exit(2)` auf Modulebene.
- Erster Import in `redproof-s9a1.mjs:6` und `redproof-uploads.mjs:4`. Nach ESM-Semantik wird `dev-guard.mjs` vollständig ausgewertet, bevor der Rumpf des importierenden Moduls läuft. Die übrigen Importe sind Built-ins ohne Seiteneffekte. Vor dem Guard läuft also keine DB-Aktion.
- Lücken: siehe M3.
- Die Regel steht in `CLAUDE.md:87`.
- Ohne Guard und zu Recht: `s9a1-verify.mjs`, `golive-check.mjs`, `import-boundaries.mjs`, `db-link.mjs` (nur lesend oder für Produktion bestimmt). Für `setup-photo-cleanup.mjs` verlangt GOLIVE:33 eine eigene Ref-Prüfung.

**(6) `public.admin_grant_role`: richtig gesperrt, getestet, notwendig.**
- **Rechte.** M16:166-177. Der Revoke trifft `public`, `anon`, `authenticated` und `service_role` (M16:179-180); es gibt keinen Grant. Damit ist nur der Eigentümer berechtigt; das deckt sich mit dem Befund der Hauptsession (`routine_privileges` nur `postgres`/EXECUTE).
- **Tests:**
  - anon, Kunde und admin-JWT: 42501 mit „permission denied for function admin_grant_role“ (`settings.test.ts:130-139`);
  - `service_role`: 42501 mit genau dieser Meldung, Rolle bleibt `customer` (`:142-145`, `:152`);
  - Eigentümer: `grant_not_found`, `grant_ok`, `grant_audit_ok` (`actor_role = 'owner'`, `detail = {"role": "rental_provider"}`) und `grant_effect_ok` (`:296-299`, `:328-331`).
- **Rot-Beweis:** Mit Grant an `service_role` wird der Test rot (`rotbeweis.md:153-160`).
- **Notwendigkeit:**
  - `guard_role` (M16:130-147) verweigert jeden Rollenwechsel ohne Marker `id:rolle`.
  - Marker setzen nur SECURITY-DEFINER-Funktionen. PostgREST kann `app.*` nicht setzen, `set_config` liegt in `pg_catalog` und ist nicht ausgeliefert.
  - `become_rental_provider` erlaubt nur `customer` → `rental_provider` für das eigene Konto.
  - admin- und partner-Konten (Tests: `owner.ts:35-36`; erster Admin: `GOLIVE.md:23`) brauchen deshalb einen eigenen Weg. Eine Variante für `service_role` würde jedem mit dem Secret Key erlauben, Admins anzulegen. Eigentümer-only mit Journal ist die engste Lösung.
  - Rest: N9.

**Weitere Punkte aus dem Auftrag**
- **GOLIVE-Ergänzung** (`docs/GOLIVE.md:21`): Der Befund „Updating seed hash, `platform_settings` nicht gefüllt, Weg über `db query -f`, zweimal eingespielt“ ist sachlich vermerkt. Der Prüfweg ist unvollständig (N6).
- **quote-Diff** (`_shared/quote/db.ts:38-46`):
  - `verify_price_version` läuft vor dem Laden der Zeilen, ein Fehler wird geworfen. Es wird nichts gerechnet und nichts gespeichert.
  - `current_price_version` filtert auf `published` (M15:285-290).
  - Zwischen Prüfung und Laden liegt keine Lücke, weil veröffentlichte Versionen unveränderlich sind. Ändern könnte sie nur der Eigentümer, und das wäre Manipulation.
  - Kein Gebührensatz ist im Code fest verdrahtet, `loadFeeRates` liest die View.
- **Seeds:**
  - `seed.sql` und `seed.prod.sql` haben je Tabelle ein Statement mit `where not exists`, danach `publish_seed_version(1)` (`seed.sql:5-116`; `seed.prod.sql:5-116`).
  - `seed-prod.test.ts:12, 40-42` erzwingt Gleichheit.
  - Die Werte bestehen die Checks aus M16:28-30: 0.15 und 0.20 mit Skala 2, 30 ≥ 15, Fenster 480/660/840/480.
  - Auf einer leeren DB sind die drei Gebührenschlüssel jeweils erste Zeile, der Trigger lässt sie also durch.
- **Testzahlen** (Report-Dateien): `tmp/reports/vitest-unit.json` 342/342, 0 rot; `tmp/reports/vitest-rls.json` 114/114, 0 rot; `tmp/reports/playwright.json` expected 82, unexpected 0, flaky 0. Die Exit-Codes selbst stehen nicht in Dateien.
- **In `docs/OPEN_ISSUES.md` nachzutragen:**
  - N-neu-4 (N4) und N-neu-5 (N5), falls nicht direkt behoben;
  - M1 bis M3, falls die Session nicht vor dem Commit nachbessert (Empfehlung: M1 und M2 vor dem Commit, M3 spätestens zu Beginn von S9a-2);
  - N1 bis N3 und N6 bis N9;
  - die Erledigung von `:36` sowie die Korrektur von `:8` und `:14`.

**Prüffragen A bis G aus `tmp/proof/s9a1-plan.md`, Stand angewandt**
- **A (Versionen unveränderlich):** Ja.
  - Abgedeckt sind: veröffentlicht → UPDATE/DELETE, INSERT mit Flag, Flag ohne Marker, Verschieben von Konfigurationszeilen in OLD und NEW, `FOR SHARE` gegen `FOR UPDATE` (M15:93-159, 163-180).
  - TRUNCATE ist jetzt auch für den Eigentümer per Trigger gesperrt (M15:42-43, 129-130, 158-159).
- **B (Gebührenschlüssel):** H1 ist behoben, das Umbenennen prüft OLD und NEW (M16:42-46). Test `fee_rename` (`settings.test.ts:182, 213`), eigene Lockerung `:69` rot aus dem richtigen Grund (`rotbeweis.md:68`). Wertchecks M16:29-30.
- **C (Admin-Funktionen):**
  - Revoke und Grant wie geplant (M15:249-260; M16:179-181).
  - `is_admin()` mit `coalesce` (M15:12).
  - Umgestellte Klauseln M16:185-213; Tests fehlen teilweise (M2).
- **D (`audit_log`):**
  - Nur anfügen, auch beim TRUNCATE durch den Eigentümer (M15:40-43).
  - `service_role` ohne UPDATE/DELETE/TRUNCATE (M15:47).
  - Lesen nur `is_admin()` (M15:50-51).
  - Getestet in `settings.test.ts:270-282`.
- **E (Seed-Weg):** Er ist idempotent. Auf dem Dev-Bestand ändert er nichts an v1 und `fee_*`, er ergänzt die neuen Schlüssel. Auf einer leeren DB legt er an und veröffentlicht. M2 aus Runde 1 ist durch den DO-Block M16:7-19 und den Precheck erledigt.
- **F (Tests und Skripte):**
  - `redproof-uploads.mjs:44` stellt `is_admin()` wieder her (M3 aus Runde 1).
  - `database.types.ts` ist neu erzeugt (`verify_price_version` `:781`).
  - Der Umbenennungs- und der id-Tausch-Test sind vorhanden.
- **G (Sonstiges):** Kein Syntax- oder Semantikfehler gefunden. Aus Runde 2 sind M-neu-1, N-neu-1, N-neu-2 und N-neu-3 behoben (Stellen in den Stichproben unten).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `…_0015_versions_published.sql:12` | `coalesce(my_role() = 'admin' and aal = 'aal2', false)`: stimmt |
| `…_0015_versions_published.sql:93-95, 119` | Trigger-Funktion ohne SECURITY DEFINER, ruft `private.price_version_hash`: Ursache der 42501 in M1 |
| `…_0015_versions_published.sql:112-117` | Marker = Version, Flag true, `effective_on`/`note` gleich: stimmt |
| `…_0015_versions_published.sql:134-152` | OLD und NEW, `for share`, SECURITY DEFINER: stimmt |
| `…_0015_versions_published.sql:249-260` | Revoke public/anon/authenticated, Grant `service_role`: stimmt |
| `…_0015_versions_published.sql:271` | Revoke TRUNCATE auf drei Tabellen für `service_role`; keine eigene Lockerung (N3) |
| `…_0016_settings_admin.sql:42-46` | OLD- und NEW-Prüfung der Gebührenschlüssel: H1 behoben |
| `…_0016_settings_admin.sql:134, 146` | `id`-Tausch verboten, Trigger ohne `of role`: stimmt |
| `…_0016_settings_admin.sql:166-180` | `admin_grant_role` Revoke inklusive `service_role`, kein Grant: stimmt |
| `…_0016_settings_admin.sql:174-175` | `actor_role 'owner'` ohne Prüfung des Aufrufers (N9) |
| `…_0016_settings_admin.sql:191-213` | Klauseln auf `is_admin()`; nur fee_splits, profiles und audit/price_versions getestet (M2) |
| `…_0001_foundation.sql:263, 305, 322, 368, 385, 401, 411` | alle betroffenen Policies `to authenticated`: `is_admin()` ausführbar |
| `scripts/redproof-s9a1.mjs:6` | `import './dev-guard.mjs'` als erste Zeile: stimmt |
| `scripts/redproof-s9a1.mjs:77` | Muster `and (select auth.jwt() ->> 'aal') = 'aal2'` steht wörtlich in M15:12: M-neu-1 behoben |
| `scripts/redproof-s9a1.mjs:69-70` | eigene Lockerungen für OLD-Schlüssel und id-Tausch: N-neu-1 behoben |
| `scripts/redproof-s9a1.mjs:4` | Regel zu Fee-Proben im Kopf: N-neu-2 behoben |
| `scripts/redproof-s9a1.mjs:71-73` + `settings.test.ts:275-277` | TRUNCATE durch den Eigentümer getestet und rot bewiesen: N-neu-3 behoben |
| `scripts/redproof-s9a1.mjs:116` | `includes(expect)` trifft den Soll-Wert (M1) |
| `scripts/redproof-s9a1.mjs:106-114` | Restore im inneren `finally`, `saved` nur im Speicher (N1) |
| `scripts/redproof-s9a1.mjs:90` | Kindprozesse fest mit `.env.local` (M3 c) |
| `scripts/dev-guard.mjs:7-16` | drei Quellen, fail closed, Exit 2: stimmt |
| `scripts/redproof-uploads.mjs:4, 44` | Guard zuerst, Wiederherstellung mit `is_admin()`: stimmt |
| `scripts/live-uploads.mjs:61, 154-197` | `--linked`-UPDATE und Löschungen ohne Guard (M3) |
| `tests/support/owner.ts:11, 35-36` | Eigentümer-SQL über `--linked`, `admin_grant_role` committet, ohne Guard (M3) |
| Rot-Beweis „Marker-Prüfung“: `redproof:64` / `settings:69, 96` / `rotbeweis:23` | Lockerung passt, Test passt, Meldung 42501 Schema statt `'ok'`: **falscher Grund** (M1) |
| Rot-Beweis „guard_price_config entfernt“: `redproof:65` / `settings:59, 86` / `rotbeweis:32` | `insert_config` `'ok'` statt `version_published`: richtig |
| Rot-Beweis „OLD-Schlüssel“: `redproof:69` / `settings:182, 213` / `rotbeweis:68` | Muster wörtlich in M16:42, `fee_rename` `'ok'`: richtig |
| Rot-Beweis „id-Tausch“: `redproof:70` / `settings:292, 324` / `rotbeweis:77` | Muster wörtlich in M16:134, 23503 (FK) statt `field_immutable`: richtig |
| Rot-Beweis „append_only_truncate“: `redproof:71` / `settings:275, 307` / `rotbeweis:86` | Eigentümer-TRUNCATE `'ok'` im Rollback: richtig |
| Rot-Beweis „audit_log-Grants“: `redproof:75` / `settings:272, 304` / `rotbeweis:122` | `append_only` statt 42501, die Grant-Ebene fehlt: richtig |
| Rot-Beweis „is_admin ohne aal2“: `redproof:77` / `settings:280, 312` / `rotbeweis:140` | aal1 sieht Zeilen (`'P0001: false'`): richtig |
| Rot-Beweis „verify ohne Hash“: `redproof:78` / `settings:76, 102` / `rotbeweis:149` | Muster wörtlich in M15:245, `verify_mismatch` `'ok'`: richtig |
| Rot-Beweis „admin_grant_role service_role“: `redproof:79` / `settings:143-144` / `rotbeweis:158` | `undefined` statt 42501, Grant wirkte (Journalzeile, N9): richtig |
| Rot-Beweis „publish_version authenticated“: `redproof:80` / `settings:133-139` / `rotbeweis:167` | P0001 statt 42501, die Funktion lief für den Kunden: richtig, fragil (N2) |
| Rot-Beweis „fee_splits ohne aal2“: `redproof:85` / `rls.test.ts:384-389` / `rotbeweis:214` | admin aal1 sieht 2 Zeilen: richtig |
| Rot-Beweis „guard_price_version entfernt“: `redproof:63` / `rotbeweis:8-12` | Erwartung ist der Setup-Fehler, der Beweis steht in der zweiten roten Zeile (M1) |
| `tmp/proof/s9a1-rotbeweis.md:220-222` | Definitionen identisch, 23 von 23 |
| `tmp/reports/redproof-s9a1.json` / `vitest-rls.json` (startTime) | letzter Rot-Lauf 20:14:24 UTC, grüner Gesamtlauf 20:15:29 UTC mit 114/114 |
| `tmp/reports/vitest-unit.json`, `playwright.json` | 342/342; 82 expected, 0 unexpected |
| `tests/rls/settings.test.ts:142-152, 296-299` | `admin_grant_role`: service_role 42501 mit Meldung, Eigentümer mit Journal `owner`: stimmt |
| `supabase/functions/_shared/quote/db.ts:42-44` | `verify_price_version` vor dem Laden, Fehler wird geworfen: stimmt |
| `supabase/functions/**` (Grep `p_actor`) | nur `database.types.ts`: stimmt |
| `CLAUDE.md:87-88` | Guard-Regel und `p_actor`-Regel unter „Daten und Sicherheit“: vorhanden |
| `docs/GOLIVE.md:21` | Seed-Befund vermerkt; Prüfweg ohne `published`/Hash/27 Einstellungen (N6) |
| `docs/OPEN_ISSUES.md:8, 14, 36` | veraltet (N7) |
| `docs/S9_KONZEPT.md:270`, `docs/S9a_PLAN.md:68` | alter Hash-Text (N4) |
| `scripts/s9a1-verify.mjs:19-21` | nur `key/value/unit` (N5) |
| `tmp/proof/s9a1-dev-v1-before.json:203-236` vs. `supabase/seed.sql:13-24, 74-78` | Label, Quellen und Datum gleich (Stichprobe 4 Zeilen) |
| `supabase/seed.sql:83-116`, `tests/unit/seed-prod.test.ts:12, 40-42` | `where not exists`, `publish_seed_version(1)`, Prod gleich Dev: stimmt |
| `docs/S9a_PLAN.md:35, 70, 74` | Berichtsname, aal1-Lesetests, Seed-Weg weichen ab (N8, M2) |

Offene Findings hoch: 0
