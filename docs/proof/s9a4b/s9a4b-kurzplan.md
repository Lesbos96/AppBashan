# S9a-4b Kurzplan (Eingabe für den Berater)

Vorarbeit: Dev-Ref vcpbbzdyltvffvzjrzdi bestätigt, HEAD = origin/main = ad1fa75, Baum sauber, Migrationen 0001–0020 lokal = remote, Ports frei.
A-N6 (`tmp/proof/s9a4b-n6.log`, Leseabfrage, Exit 0): Constraint `platform_settings_staging`, beide Storage-Policies (Insert/Delete/Select), `request_photos_select`, drei Trigger, Rechte (authenticated nur SELECT, service_role INSERT/SELECT) entsprechen 0020. Default von `storage_path` auf Dev ist `''` (0012; 0020 entfernt ihn nicht, Hand-SQL aus 4a hat ihn nur wiederhergestellt) = Replay der Dateien. 0 Zeilen in request_photos. Funktionskörper nur als md5 gelesen (ohne lokale DB kein Abgleich mit der Datei möglich).

## Umfang und Teilungsvorschlag
Der Auftrag (Z1–Z6 plus A-M1/A-M2/A-N1–N10 plus Offenes aus S9a-3: Kartensperre-Rot-Beweis, Plan-M-1 `Gesendet`, `Confirmed.shown`, M-4, N-4/N-5) ist für eine Session zu groß (App-Umbau mit Shots, drei Rot-Beweis-Skripte, vier Testdateien, Doku). Vorschlag:

- **S9a-4b-1 (Ablauf Ende zu Ende):** Z2 (Migration 0021, Typen neu, A-N7 Asserts auf 42501, A-N8), Z1 (`uploads.ts`, `Zusammenfassung.tsx`, `FotoUploads.tsx`, Texte, Hinweis), Z3 (`live-uploads.mjs`), RLS-Tests für 0021, Rot-Beweis 0021 in `redproof-s9a4.mjs`, E2E Tastatur, Shots. Der Default muss zusammen mit der App fallen (sonst bricht der Typcheck von `uploads.ts`).
- **S9a-4b-2 (Werkzeuge, Nachweise, Doku):** Z4 Rest (`redproof-s9a3.mjs` auf neue Signatur, A-M2 Wirkungsbeweis Zeilen-Bedingung inkl. Zählung), Z5 (R2-N13), A-N5 (Tests/Beweise Wertecheck, `photo_cleanup`, NULL, Karenz), A-N1/N2/N3/N4/N9, Z6 (ARCHITECTURE, Konzept, Plan), Kartensperre-Rot-Beweis, ROADMAP „S9a fertig“. Kaum UI, keine Shots.
- Nicht in Z1–Z6, aber „für 4b“ in OPEN_ISSUES: Plan-M-1 (`Gesendet`-Hinweis), `Confirmed.shown`, N-2 Version nach 409, M-4, N-4/N-5. Vorschlag: 4b-2 oder eine eigene Session; Entscheidung bei Beks.

## Z1 (in 4b-1)
- `uploads.ts`: Upload nach `{uid}/{client_ref}/{crypto.randomUUID()}.jpg`, `upsert: false`, vor `sendQuote`; keine Zeile in `request_photos`, kein Löschen nach dem Absenden. `Photo.id` = Dateiname-UUID. Löschen nur vor dem Absenden (Staging, eigene Datei erlaubt).
- `quote`-Body: `photoIds` aus den erfolgreich hochgeladenen Fotos. Eigene Texte: 422 `photo_missing` (Foto fehlt, bitte neu hinzufügen), `photo_expired` (zu alt, bitte neu hochladen), `too_many_photos` (höchstens 8). Bei missing/expired Wiederholung mit derselben `clientRef`.
- Hinweis vor dem Senden: „Fotos lassen sich nach dem Senden nicht mehr ändern.“ Nach dem Senden keine Foto-Bearbeitung (`FotoUploads` ohne Entfernen/Erneut).
- Tests: Unit (`uploads.test.ts`), E2E (Tastatur Hauptflow, die drei 422, Hinweis), Shots Foto-Schritt/Zusammenfassung/Fehler bei 390/430/1280 × Light/Dark.

## Z2: Migration 0021 (`supabase/migrations/20261102120000_0021_photo_limits.sql`, vollständig im Repo-Entwurf)
1. `alter table public.request_photos alter column storage_path drop default;` (NOT NULL bleibt: Insert ohne Pfad → 23502).
2. Insert-Policy: zusätzlich `count(eigene Objekte im Bucket ohne request_photos-Zeile) < 40`. Zahl 40 = fünf Anfragen à 8 Fotos; übernommene Dateien zählen nicht (sonst wäre ein Konto nach 40 gesendeten Fotos für immer gesperrt). Weiche Grenze (Parallel-Uploads können überschreiten), Kostenschutz. Der Zähler läuft als Aufrufer: eigene Objekte über `request_photos_objects_select`, eigene Zeilen über `request_photos_select`.
3. Delete-Policy: nur `objects.name` qualifiziert (A-N8).
Fragen an den Berater: (a) 40 angemessen? (b) Zähler in der Policy statt eigener Funktion/Trigger: Rechte, Rekursion, Snapshot-Verhalten, Last (LIKE auf `name` mit Prefix)? (c) Verhalten bei 41. Upload: 403/42501 wie jede andere Ablehnung, die App muss das als „zu viele Fotos“ lesen oder pauschal als Fehler zeigen? (d) Ist das Entfernen des Defaults sauber (kein anderer Insert-Pfad, `quote_save_request` setzt den Pfad immer)?

## RLS-Tests für 0021 (erlaubt UND verweigert, genauer Fehler)
- 40 Uploads (Fixture als Eigentümer in `storage.objects`, nicht 40 HTTP-Uploads) → Upload Nr. 41 per Storage-API → verweigert (403/42501); Nr. 40 ok. Übernommene Dateien zählen nicht (Zeile in `request_photos` → wieder ok). Löschen einer eigenen Staging-Datei gibt Platz frei. Fremdes Konto unberührt.
- Insert in `request_photos` ohne `storage_path` (Eigentümer, Marker gesetzt) → 23502; die zwei Asserts in `rls.test.ts:202/256` auf `42501`.

## Rot-Beweis 0021 (`redproof-s9a4.mjs`)
- Zählbedingung lockern → 41. Upload gelingt (Ist-Wert: Objektzahl 41); wieder gesperrt → 0 neue Objekte.
- Default wiederherstellen → Insert ohne Pfad gelingt bis zum Trigger (23514/`photo_insert_forbidden`, Schicht) bzw. ohne Trigger Zeile mit `''` (Ist-Wert), gesperrt → 23502.

## Reihenfolge, Risiken
Plan → Berater → „weiter“ → 0021 pushen (`npm run db:push`, `migration list`) → Typen → App → Tests → Rot-Beweis → Shots (test-runner/reviewer) → Abnahme → Commit/Push. Risiko: `drop default` bricht den Typcheck von altem Code; beides in einer Session. Risiko: Policy-Unterabfrage auf `storage.objects` unter RLS (Rekursion?) → durch RLS-Test belegt.
