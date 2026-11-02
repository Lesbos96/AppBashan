# S9a-3 Plan-Prüfung (Berater, advisor-report)

Datum: 2026-11-02. Modell: Opus 5.5.
Hinweis nach CLAUDE.md: In meiner Tool-Liste steht ein eingebautes `advisor`-Tool ohne Parameter. Ich habe es nicht benutzt.

**Geprüfter Umfang:** `tmp/proof/s9a3-entwurf.md` (vollständig), `supabase/migrations/20261102100000_0019_quote_hardening.sql` (192 Z., maßgeblich), `docs/S9a_PLAN.md` (vollständig, Abschnitt 6), `docs/S9_KONZEPT.md:288-301` (5.4, 5.5), `_shared/quote/{handler,parse,db,snapshot}.ts`, `_shared/route/{provider,facts,compute,handler,db}.ts`, Migrationen 0015–0018 (vollständig), dazu gezielt M01, 0006, 0009, 0011, `scripts/dev-guard.mjs`, `scripts/scan-proof.mjs`, `scripts/redproof-s9a2.mjs`, `docs/OPEN_ISSUES.md:96-100`, `docs/proof/s9a2/s9a2-plan.md:82-84`, `docs/proof/s9a2/s9a2-rotbeweis.md:87-138`, `tests/rls/status.test.ts:114-140`, `package.json:48-60`, `vite.config.ts:24`, `seed.sql:89-103`.

---

## Findings

### Hoch

**H-1 · Abweichung 1 (Bezirk nur aus Kandidaten-PLZ, kein Polygon, kein Rückfallfeld): widerspricht einer Entscheidung von Beks und dem freigegebenen Plan.** `0019:48-60` gegen `S9_KONZEPT.md:297` („[Entschieden (Beks, 01.11.2026), Frage 29] … Rückfallfeld … die Entscheidung 29 gilt bis zu Beks' Antwort unverändert“) und `S9a_PLAN.md:122` (`geo_districts` in 0019, „Quelle bestimmt die Session“), `S9a_PLAN.md:131` (Tests „Rückfall-PLZ passt nicht zum Bezirk“, „Punkt auf der Bezirksgrenze → Bezirk gefunden“).
- Der Grund im Entwurf („Download ohne Freigabe“) trägt nicht. Die Quellenwahl hat der Plan der Session ausdrücklich übertragen (`S9a_PLAN.md:122`), und `geo:import` holt die Stadtgrenze schon heute so.
- Auch fachlich ist die Abweichung die schwächste Variante. Wiener Postleitzahlen decken sich nicht überall exakt mit den Bezirksgrenzen, und bei Sonder-PLZ (1300, 1400 UNO-City) oder einer fehlenden `postalcode` kann der Kunde gar nicht buchen. Maßgeblich ist aber der Bezirk der Abholadresse (`S9_KONZEPT.md:279`), und darauf baut `partner_regions` (S9b/S9c). Dauerhaft gedacht ist nur das Polygon.
- **Fix:** 0019 nicht anwenden, bevor Beks geantwortet hat. Eine gebündelte Frage an Beks:
  - (a) Empfehlung des Beraters: Bezirk nur aus dem Polygon (Stadt Wien OGD „Bezirksgrenzen“, CC BY 4.0, Quellenangabe nötig), ohne Rückfallfeld, PLZ ohne Bedeutung.
  - (b) Planstand: PLZ des Kandidaten plus Rückfallfeld, das gegen das Polygon geprüft wird.
  - Beides braucht `geo_districts` in 0019, die Variante des Entwurfs keine von beiden. Hausnummernprüfung, Haltefenster, Kontakte und Journal hängen davon nicht ab und können weitergebaut werden. Die Schnittstelle `quote_district(lon, lat, …)` bleibt bestehen.

**H-2 · Haltefenster lässt künftige oder nie gültige Versionen zu.** `0019:31-44`, `holdAllows` laut Entwurf Z. 19.
- `replaced_at` ist das Minimum über alle veröffentlichten Versionen mit höherer Nummer. Für eine Version, die noch gar nicht gilt (`effective_on` in der Zukunft), gibt es eine solche Nachfolgerin, sobald eine höhere Version veröffentlicht ist, deren Beginn in der Zukunft oder weniger als 30 Minuten zurück liegt. Dann gilt `now < replaced_at + hold` und `holdAllows` lässt die Version zu.
- Beispiel: v2 gilt ab 1.12., v3 ab heute 10:00. Um 10:10 nimmt `quote` einen Preis nach v2 an, obwohl v2 nie gegolten hat. Ein Kunde kann die künftige `price_config` lesen (`0015:280-281`, Policy nur auf `published`) und mit eigenem `shown` gezielt einen günstigeren künftigen Tarif binden.
- Das verletzt `S9a_PLAN.md:126` („unveröffentlichte oder künftige Version → 409 `price_changed`“).
- **Fix:** In `price_version_hold` zusätzlich eine Spalte `started boolean` zurückgeben: `greatest(v.effective_on::timestamp at time zone 'Europe/Vienna', v.published_at) <= now()`. `holdAllows` verlangt `started` und dazu (`is_current` oder `now < replaced_at + hold`). Unit-Test für beide Fälle (künftige Version mit höherer Nachfolgerin; Version, deren Nachfolgerin früher beginnt). Eintrag im Rot-Beweis „Versionsvergleich“.

**H-3 · Stornostufen und Anfahrtspauschale fehlen im Snapshot.** Im Entwurf steht nur der Hash-Vergleich (Z. 13). `snapshot.ts:17-31` schreibt keine Bedingungen. Der Plan verlangt sie aber: `S9a_PLAN.md:126` („Stornostufen und `call_out_fee_cents` in den Snapshot“), `S9_KONZEPT.md:291` (Revision 1 trägt die fünf Werte; `cancel_by_customer` und die Pauschale rechnen nur mit ihnen, nie mit dem aktuellen Stand), `OPEN_ISSUES.md:98` („dort bleiben `cancel_*`/`call_out_fee_cents` (Snapshot, `termsHash`)“). Ohne die Werte fehlt später die Grundlage für die Stornogebühr. Ihr Betrag hinge dann vom aktuellen Stand der Einstellungen ab, nicht von dem, was der Kunde bestätigt hat.
- **Fix:**
  - `snapshot.terms = { cancel_free_hours, cancel_late_percent, cancel_full_percent, cancel_full_days_before, call_out_fee_cents, termsHash }`. Die Werte stammen aus **demselben** `booking_terms()`-Aufruf, der mit dem gesendeten `termsHash` verglichen wurde, und werden nicht erneut gelesen (sonst entsteht eine TOCTOU-Lücke).
  - In `quote_save_request` prüfen, dass `p_snapshot -> 'terms'` alle sechs Schlüssel hat, sonst `raise exception 'terms_missing'`, damit eine Revision ohne Bedingungen gar nicht entsteht.
  - Integrationstest: Revision 1 enthält die Werte, und `termsHash` passt zu `booking_terms()`.

### Mittel

**M-1 · `0019:171-172` – Im Journaleintrag `price_confirmed` fehlt der Inhalts-Hash der Version.** `S9_KONZEPT.md:270` verlangt, dass der Hash „in jede Revision und in den Audit-Eintrag der Preisbestätigung“ geschrieben wird. – Fix: `p_confirmed || jsonb_build_object('priceVersion', p_price_version, 'contentHash', (select pr.content_hash from public.price_revisions pr where pr.id = rev))`.

**M-2 · Das Geocode-Kontingent `qgeo` lässt sich mit wenigen Konten leeren.** Rechnung: `handler.ts:29` erlaubt je Konto 30 Aufrufe am Tag, jeder Aufruf geokodiert bis zu 2 Adressen. Bei wechselnden Labels gibt es keinen Cache-Treffer, also 60 Anbieteraufrufe je Konto. Gegen 150 am Tag global reichen damit 3 Magic-Link-Konten, und `quote` antwortet für alle Kunden bis Mitternacht mit 429. Das eigene Kontingent sollte gerade verhindern, dass Buchungen stillstehen (`S9_KONZEPT.md:297`, R9-6). – Fix: zusätzlich ein Bucket `qgeo:day:<userHmac>` (z. B. 10 am Tag) und `qgeo` nur bei einem Cache-Fehltreffer zählen. Den Restwert mit dem ORS-Plan in `OPEN_ISSUES.md:19` festhalten.

**M-3 · Der Miete-Zweig von `quote` hat weiterhin keinen Abgleich mit `shown`.** `handler.ts:246-288`: Der Preis wird mit den aktuellen Angebotswerten gerechnet und ohne Vergleich gespeichert. Laut `OPEN_ISSUES.md:100` zeigt die Tab-Bar „Miete“ noch, der Weg ist also erreichbar. – Fix: denselben `shown`-Vergleich (`totalCents`) für die Miete einbauen, oder den Zweig in Phase 1 mit 404 `not_available` schließen. Das entscheidet die Hauptsession, beides ist vertretbar. Ohne Fix bleibt hier ein Weg, auf dem sich der Preis ohne Zustimmung ändert.

**M-4 · `package.json:59` – `db:push` läuft ohne Dev-Guard, 0019 löscht aber alle Anfragen** (`0019:8-10`), in jedem verlinkten Projekt. CLAUDE.md verlangt den Abbruch bei falscher Ref für Skripte, die Daten löschen. – Fix: 0019 nur über einen geschützten Aufruf anwenden (`node scripts/dev-guard.mjs && npm run db:push` mit Exit 2 bei falscher Ref, im Bericht festhalten). Löschen nur `where district is null`: alle Zeilen aus S9a-2 haben keinen Bezirk (0018:299-307), die Wirkung ist heute dieselbe, die Absicht steht dann aber im Code. In GOLIVE ergänzen, dass 0017/0019 in Prod nur auf leeren Tabellen laufen dürfen.

**M-5 · Der Nachweis zum Löschschutz nach 0019 ist nicht aussagekräftig.** `tgenabled = 'O'` allein ist kein Wirkungsnachweis, und eine Löschprobe auf der dann **leeren** Tabelle ist immer grün, weil der Trigger nie feuert. – Fix: `tgenabled` für `request_delete_guard` **und** `request_delete_guard_truncate` abfragen. Zusätzlich eine Probe als Eigentümer in einer Transaktion mit Rollback: eine Anfrage über `quote_save_request` anlegen, `delete` ausführen, erwartet `P0001: request_immutable | 1`.

**M-6 · N-15 und N-16 sind weiter offen** (Antworten auf die Prüffragen 4 und 5 unten). Für Abnahmeberichte, die committet werden, gilt das als Sicherheitsrisiko.

### Niedrig

- **N-1 · `0019:39-41`** – Für `price_hold_minutes` gibt es keinen Wertecheck. admin könnte das Fenster mit z. B. 100000 praktisch unbegrenzt machen. Fix: `check (key <> 'price_hold_minutes' or (value = trunc(value) and value between 0 and 120))` wie `0018:136-140`. Fehlt der Wert (`null`), soll `holdAllows` bei einer nicht aktuellen Version `setting_missing` (500) liefern statt 409.
- **N-2 · `0019:172`, `0015:27`** – Ist `p_confirmed` null, wird `detail` null und der Insert scheitert mit 23502, nach außen 500 `internal`. Fix: `if p_confirmed is null or jsonb_typeof(p_confirmed) <> 'object' then raise exception 'confirmed_required'`.
- **N-3 · `handler.ts:184-189`** – Für `district_required`, `contact_required`, `preferred_date_required` und `terms_missing` gibt es keine Abbildung, sie enden als 500. Fix: 422 bzw. 400 abbilden. `contact` und `shown` in `parse.ts` mit denselben Grenzen und Mustern wie `0018:208-211` und `0019:64` prüfen (ganze Zahlen, `reasons` begrenzt), sonst wird 23514 zu 500.
- **N-4 · Entwurf Z. 27-28** – Reihenfolge der Kandidatenwahl: zuerst nach Ebene `address`/`venue` mit Hausnummer filtern, dann den nächsten innerhalb von 50 m nehmen. Sonst kann ein Straßenkandidat davor zu einem falschen `address_imprecise` führen. Außerdem `place == null` (nicht nur `point == null`) als 422 `address_point_required` behandeln (heute übersprungen, `handler.ts:204`).
- **N-5 · Prüfreihenfolge** – Ändern sich Bedingungen und Preis zugleich, sieht der Kunde zwei Dialoge nacheinander. Fix (optional): beide in einer 409-Antwort zurückgeben. Bei einer erlaubten alten Version mit Betragsabweichung den Snapshot der **aktuellen** Version liefern. Bei `kind: offer` auch `pianoGuideCents` vergleichen (`snapshot.ts:19`).
- **N-6** – Nach 0019 brechen Aufrufe mit der alten Signatur: `tests/support/db.ts:58-59`, `tests/rls/quote.test.ts:145, 256-257`, `scripts/live-uploads.mjs:47`, `scripts/redproof-s9a2.mjs:52, 90, 226, 233`. Fix: Tests und Live-Skripte anpassen. `redproof-s9a2.mjs` im Kopf als „Stand 0018, nach 0019 nicht mehr lauffähig“ kennzeichnen (Nachweis bleibt `docs/proof/s9a2/`). `scripts/redproof-uploads.mjs` gibt es noch, obwohl er laut `S9a_PLAN.md:35` in S9a-2 gelöscht werden sollte (er stellt die alten Policies wieder her). Fix: löschen.
- **N-7** – `scripts/golive-check.mjs:57`: `geocode_cache` in die Liste „anonym keine Zeilen“ aufnehmen. Plan `S9a_PLAN.md:124`: RLS-Test 42501 für `geocode_cache`.
- **N-8** – Dateien im Bucket: Die kaskadierte Löschung entfernt `request_photos`-Zeilen, die Dateien bleiben liegen. `photo_cleanup` (`0011:41-82`) räumt sie nach 1 h, aber nur, wenn die Vault-Werte gesetzt sind (`0014`). Fix: vor 0019 wie bei 0017 `scripts/storage-reset.mjs` ausführen.
- **N-9** – Abweichung 2 (`pickup_outside_vienna`) ist vertretbar. Die Testzeile `S9a_PLAN.md:131` („Abholung außerhalb Wiens → `district_required`“) und die Konzepttexte nachziehen.
- **N-10 · `0019:64`** – Das Telefonmuster akzeptiert z. B. „.....“. Fix (optional): mindestens 5 Ziffern verlangen (`phone ~ '([0-9][^0-9]*){5}'`).

---

## Prüffragen

**1. Kann sich ein Kundenpreis ohne Zustimmung ändern? – Lücke (H-2, H-3, M-3), sonst Nein.**
- Vergleich mit `shown`: Der Plan verlangt Gleichheit von Art, `total`, `low` und `high` ohne Toleranz. Gerundet wird in beiden Fällen mit demselben `@pricing` auf ganze Cent, daher gibt es keine Rundungsdifferenz. Gespeichert wird der vom Server berechnete Betrag, der dann gleich `shown` ist. `guard_revision_insert` prüft Snapshot gegen Spalten (`0018:47-60`). Bei einer Spanne gilt `totalCents = null` und es werden `low`/`high` verglichen, beim Angebot Art und Gründe in derselben Reihenfolge. Das ist ausreichend.
- `replaced_at` mit Minimum und `greatest` passt zur View `current_price_version` (`0015:285-290`: veröffentlicht, `effective_on ≤ heute`, höchste Nummer). Lücke: künftige Versionen (H-2).
- Idempotenz: `findExisting` vor allen Prüfungen (`handler.ts:166-169`) liefert nur die schon gespeicherte, damals bestätigte Revision zurück, also keinen neuen Preis. Das ist korrekt. Die App muss den zurückgegebenen Snapshot anzeigen, nicht die lokale Vorschau. `clientRef` bleibt bei 409 stabil, und weil nichts gespeichert wurde, gibt es auch keinen Treffer.
- Bedingungen: Hash-Vergleich ja. Die Werte fehlen aber in der Revision (H-3).
- Miete: kein Vergleich (M-3).

**2. Lässt sich die Adress- oder Bezirksprüfung umgehen? – Nein**, wenn der Entwurf so umgesetzt wird. Mit Hinweisen:
- Koordinaten: binden nur über den Kandidaten innerhalb von 50 m. Route, Region und Bezirk werden aus den Kandidatenpunkten berechnet (Entwurf Z. 29), der Clientpunkt bestimmt den Preis nicht.
- PLZ: kommt nur vom Anbieter (`provider.ts:69`). `parse.ts:65-68` muss das Client-`postcode` verwerfen, Test „manipuliertes `postcode` ignoriert“.
- Label: Gespeichert wird `canonicalLabel(candidate)`, nie der Freitext.
- Cache vergiften: nicht möglich. Nur `service_role` schreibt (`0019:25-26`). Der Wert stammt nur vom Anbieter, der Schlüssel ist ein HMAC mit Server-Secret. Die Normalisierung darf verschiedene Hausnummern nicht zusammenlegen (Unit-Test).
- Mehrere Kandidaten: siehe N-4. `venue` ohne Hausnummer wird abgelehnt (strenger als `S9_KONZEPT.md:297`, gut).
- `quote_district` und `price_version_hold` sind nur für `service_role` ausführbar (`0019:179-187`).
- Restrisiko: Der Bezirk aus der PLZ ist fachlich ungenau (H-1).

**3. Ist das Abschalten von `request_delete_guard` nur in der Migrations-Transaktion sicher? – Ja.**
- `ALTER TABLE … DISABLE/ENABLE TRIGGER` ist transaktional. Scheitert ein späterer Schritt, wird alles einschließlich des Löschens zurückgerollt, der Fehlerfall ist also sicher. Den Trigger kann nur der Eigentümer abschalten.
- Kaskaden:
  - `price_revisions` (`0018:12`, cascade): `revision_immutable` lässt die Löschung zu, weil `pg_trigger_depth() > 1` (`0017:142-145`).
  - `status_events` (`0017:156`): ebenso.
  - `request_contacts` (`0018:207`): kein Trigger.
  - `request_photos` (M01:135): nur ein Insert-Trigger (`0011:18`).
  - `fee_splits.service_request_id` (M01:198): cascade, ohne Delete-Trigger. Die Revokes für `service_role` wirken auf die Kaskade nicht, weil RI als Eigentümer läuft.
  - `rental_bookings`: kein Fremdschlüssel auf `service_requests`.
  - Der zyklische Fremdschlüssel `current_revision` (NO ACTION, `0018:116-117`) bleibt erfüllt, weil die verweisende Zeile im selben Statement gelöscht wird.
- Empirisch belegt: `docs/proof/s9a2/s9a2-rotbeweis.md:87-90` (Löschen bei abgeschaltetem Trigger ergibt `ok | 0`, inklusive Kaskade der Revision) und `:127-130` (Kaskade über `profiles`).
- `tgenabled` allein reicht als Beleg nicht (M-5). Dateien im Bucket siehe N-8, Schutz bei falscher Ref siehe M-4.

**4. N-15: Ist der Dev-Guard wirksam? – Ja für die Prüfung selbst, Lücke beim Nachweis.**
- `dev-guard.mjs:7-16` verlangt, dass alle drei Quellen gleich der Dev-Ref sind. Eine fehlende Quelle zählt als falsch, es wird also sicher abgebrochen. Die Datei `project-ref` wird relativ zum Arbeitsverzeichnis gelesen; fehlt sie, ergibt das ebenfalls Abbruch.
- `:18-22` sperrt `SUPABASE_WORKDIR` und eine abweichende `SUPABASE_PROJECT_ID` und vererbt die Dev-Ref an Kindprozesse. dotenv-cli überschreibt gesetzte Variablen nicht.
- Die Tests laden den Guard über `vite.config.ts:24` (`dev-guard-setup.ts`).
- Nicht geschützt: `db:push` (M-4) und jede Verbindung über eine DB-URL, die heute kein Skript nutzt.
- Für einen gültigen Negativbeweis (Wirkung, nicht nur „Exit ≠ 0“) fehlen:
  - (a) Die CLI direkt mit `SUPABASE_PROJECT_ID=<20 Zeichen, fiktiv>` aufrufen: Die Fehlermeldung muss die **fiktive Ref** nennen (oder 404/403 des Management-API für genau diese Ref). Positivkontrolle mit `SUPABASE_PROJECT_ID=<Dev>`: `select 1` liefert 1. Ein Fehler ohne Bezug zur Ref (Token, Netz) beweist nichts.
  - (b) Ein geschütztes Skript (`redproof-s9a1.mjs --only x`) mit der fiktiven Variable: Exit 2 mit „ABBRUCH“. Dazu messen, dass keine DB-Aktion lief, z. B. Anzahl der Auth-Nutzer mit Präfix `redproof-` vorher und nachher gleich.
  - (c) Jede Quelle einzeln falsch: `SUPABASE_PROJECT_REF`, URL, `SUPABASE_WORKDIR`; `project-ref` über ein temporäres Arbeitsverzeichnis mit eigener Datei, ohne die echte Datei anzufassen. Je Fall Exit 2.
  - (d) N-9 aus `s9a2-abnahme.md:61`: `npm run test:rls` mit fiktiver Ref bricht vor dem ersten Test ab.

**5. N-16: Findet `scan-proof` Access Token und Verbindungs-URL? – Nein, nur abhängig von der Umgebung.**
- `scan-proof.mjs:7` kennt nur `sb_secret_` und JWT. `sbp_…` fällt nur über den Wertvergleich auf, und nur wenn `SUPABASE_ACCESS_TOKEN` gesetzt ist. Eine Verbindungs-URL fällt nur auf, wenn das Passwort unverändert als `SUPABASE_DB_PASSWORD` in der Umgebung steht. Ein URL-kodiertes Passwort mit Sonderzeichen und eine URL in einer Variable, deren Name nicht zum Filter passt (`DATABASE_URL`, `:8`), findet der Scan nicht.
- `:17` endet ohne `docs/proof` mit einem Stacktrace.
- Fix:
  - Muster `sbp_[A-Za-z0-9_]{20,}` (deckt auch `sbp_[0-9a-f]{40}` ab) und `postgres(?:ql)?://[^\s:/@]+:[^\s@]+@`.
  - `existsSync('docs/proof')`, sonst eigene Meldung und Exit 2.
  - Optional ein Verzeichnis als Argument, damit der Rot-Beweis mit einer Datei mit fiktiven Werten unter `tmp/` laufen kann (erwartet Exit 1, je Muster ein Treffer), ohne `docs/proof` zu verunreinigen.

**6. Ist Abweichung 1 vertretbar? – Nein, Beks fragen (H-1).** Die Session muss nicht als Ganzes anhalten. Vor dem Anwenden von 0019 braucht es aber die Antwort, damit `geo_districts` in 0019 landet und keine Folgemigration nötig wird. Wenn Beks nicht antwortet, gilt der Planstand (b), nicht der Entwurf.

**7. Bricht der Revoke auf `rental_bookings` einen vorhandenen Weg? – Nein.**
- `quote_save_booking` (`0018:338-352`) nutzt nur INSERT … `ON CONFLICT DO NOTHING` mit RETURNING und SELECT. `DO NOTHING` braucht kein UPDATE-Recht.
- Der Kunde zieht über `authenticated` zurück (`0017:114-116`), das ist nicht betroffen.
- Tests schreiben als `service_role` nur per Insert (`rls.test.ts:136-137`, `status.test.ts:117-120`) und prüfen den Trigger als Eigentümer (`status.test.ts:122-135`).
- Die Kontolöschung kaskadiert als Eigentümer.
- Im Rot-Beweis den Revoke als eigene Schicht ausweisen. Probe als `service_role`: `update … set status='withdrawn'` ergibt `42501`, gelockert `ok`.

---

## SQL-Prüfung 0019

| Punkt | Ergebnis |
|---|---|
| Alte Signatur `0019:67-71` gegen `0018:234-242` | stimmt (23 Argumente, Reihenfolge und Typen gleich) |
| Neue Signatur `0019:73-82` gegen Revoke/Grant `0019:181-192` | stimmt (24 Argumente) |
| `drop column from_postcode/to_postcode` | sicher. Spalten-Checks M01:116, 119 entfallen mit. Keine View, kein Index, keine Policy verweist darauf (Grep über `supabase/`). Die alte Funktion (PL/pgSQL, ohne Abhängigkeitsverfolgung) wird im selben Lauf gelöscht. `db:types` neu erzeugen |
| `ST_Covers(geometry, geometry)` | richtig: `geo_boundaries.geom` ist `geometry(multipolygon, 4326)` (M01:222). Slugs `vienna`/`austria` wie `0006:71-72`. Fehlt eine Grenze, liefert die Abfrage keine Zeile (fail closed, das TS muss „keine Zeile“ als 500 behandeln) |
| `search_path = ''`, voll qualifiziert | ja, in allen drei Funktionen, `extensions.`-Präfix wie `0006` |
| Rechte | `security invoker`. `service_role` hat Insert auf `audit_log` (`0015:47` widerruft nur U/D/T), auf `request_contacts` (`0018:218` ebenso), auf `price_revisions` und `service_requests` sowie Update auf `current_revision` (`0018:123`). `actor_role 'customer'` ist zulässig (`0015:23`) |
| Typen | `greatest(timestamptz, timestamptz)` und `hold_minutes numeric` passen. `substr(...)::smallint` nur nach Regex-Treffer. Regex mit `\s` in Klammern ist in PG-ARE erlaubt |
| Reihenfolge | Revoke → Löschen → Spalten → Cache → Funktionen → Check `request_contacts` (Tabelle dann leer) → Funktion neu. Korrekt |
| `cron.schedule('geocode-cleanup', …)` | korrekt, gleicher Mechanismus wie `0009:16` |
| `geocode_cache` | RLS an, keine Policy, `anon`/`authenticated` widerrufen. Der Wert enthält Kandidatenadressen im Klartext (öffentliche Geodaten ohne Nutzerbezug, TTL 24 h): vertretbar |

---

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `0018:234-242` / `0019:67-71` | alte Signatur identisch ✓ |
| `0019:73-82` / `0019:181-192` | 24 Argumente in Funktion, Revoke und Grant gleich ✓ |
| `0019:37-38` | Minimum über die Nachfolgerinnen, aber kein Test „Version hat begonnen“ ✗ (H-2) |
| `0015:285-290` | `current_price_version`: veröffentlicht, `effective_on ≤ heute`, höchste Nummer ✓ |
| `0015:280-281` | `price_config` künftiger veröffentlichter Versionen öffentlich lesbar (Grundlage für H-2) |
| `0016:81-101` | `booking_terms()`: fünf Werte plus `termsHash`, ohne `fee_*` ✓ |
| `snapshot.ts:17-31` | keine Bedingungen im Snapshot ✗ (H-3) |
| `S9_KONZEPT.md:291`, `S9a_PLAN.md:126`, `OPEN_ISSUES.md:98` | Bedingungen im Snapshot verlangt ✓ (Beleg für H-3) |
| `S9_KONZEPT.md:297`, `S9a_PLAN.md:122, 131` | Rückfallfeld (Beks 29) und `geo_districts` verlangt ✗ gegen Abweichung 1 (H-1) |
| `0015:270` (Konzept 5.1) | Hash im Journal der Preisbestätigung verlangt; `0019:172` ohne ✗ (M-1) |
| `0015:23, 27, 47` | `customer` zulässig, `detail` not null, Insert für `service_role` ✓ / N-2 |
| `M01:222` | `geom` ist `geometry(multipolygon,4326)` ✓ |
| `0006:71-72` | Slugs `vienna`, `austria` ✓ |
| `M01:116, 119` | einzige Abhängigkeiten der PLZ-Spalten, entfallen mit ✓ |
| `M01:135, 198`; `0017:156`; `0018:12, 207` | alle Verweise auf `service_requests` mit `on delete cascade` ✓ |
| `0017:142-145` | `immutable_row` lässt DELETE ab Tiefe > 1 zu ✓ |
| `docs/proof/s9a2/s9a2-rotbeweis.md:87-90, 127-130` | Löschen und Kaskade empirisch `ok | 0` ✓ |
| `0011:18, 41-82` | `request_photos` nur mit Insert-Trigger; Dateien räumt `photo_cleanup` (N-8) |
| `0018:338-352` | `quote_save_booking` nur Insert/`DO NOTHING`/Select ✓ (Frage 7) |
| `tests/rls/status.test.ts:114-139` | Miet-Trigger als Eigentümer geprüft, `service_role` nur Insert ✓ |
| `handler.ts:166-169` | `findExisting` vor allen Prüfungen ✓ |
| `handler.ts:207-209` | Routingfehler werden verschluckt (Entwurf behebt das) ✓ |
| `handler.ts:29`; `route/handler.ts:22` | 6/30 je Konto; Geocode global 800 → Rechnung zu M-2 |
| `handler.ts:246-288` | Miete ohne `shown`-Vergleich ✗ (M-3) |
| `db.ts:30-36` | `loadPricing` prüft nur die aktuelle Version; der Entwurf braucht eine Variante mit Versionsparameter (Z. 21) ✓ vermerkt |
| `parse.ts:59-71` | Client-`postcode` wird heute angenommen; muss entfallen ✓ vermerkt |
| `provider.ts:69` | `Candidate` ohne `layer`/`housenumber` (Entwurf ergänzt) ✓ |
| `dev-guard.mjs:7-22` | drei Quellen, schließt bei Fehlen ab, setzt `SUPABASE_PROJECT_ID` ✓ |
| `vite.config.ts:24` | Tests laden den Guard ✓ |
| `package.json:59` | `db:push` ohne Guard ✗ (M-4) |
| `scan-proof.mjs:7, 17` | keine Muster für `sbp_`/`postgres://`; Stacktrace ohne Ordner ✗ (N-16) |
| `seed.sql:89` | `price_hold_minutes` = 30 ✓ |
| `scripts/redproof-uploads.mjs` | existiert noch entgegen `S9a_PLAN.md:35` ✗ (N-6) |

Offene Findings hoch: 3
