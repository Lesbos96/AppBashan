Modell: claude-fable-5-2
Vorgaenger: keiner

# Abnahme rl3, Runde 1 (R3, Kennung rl3-2011-a)

Datum: 2026-11-20
Umfang: Branch `rl3`, Commit 41d0918. Geprüft: die sieben Dateien unten, gegen `tmp/proof/rl3-plan.md`, `.claude/rules/geld.md`, `daten.md`, `tests.md`, die Migrationen 0023, 0024, 0025, 0026, 0053, 0066, `tests/support/owner.ts`, `tests/support/partner.ts`, `supabase/config.toml` (Abschnitt Auth) und die Läufe 001 bis 003 samt `runs.jsonl` unter `tmp/proof/rl3/`.
Grenzen der Prüfung: Ich habe kein Shell-Werkzeug. Die Hashes sind aus dem Auftrag abgeschrieben, nicht nachgerechnet; für die zwei Testdateien stimmen sie mit `dateiSha` in `runs.jsonl` überein. Den Diff habe ich nicht gesehen; „nur Test- und Doku-Dateien geändert“ stützt sich auf den Auftrag.

SHA256: b3a834a2e5c2fea829e9d867411c07051f4a4524c0d2d825e22027a2424bc49d tests/rls/partner-limits.test.ts
SHA256: 6792b2f0c502609ee9fa655664c9d16248fb3c264c7692e9b1e87c5cc62df81e tests/rls/partner-documents.test.ts
SHA256: 04eb1aa65ee6afe6b8d49691c60fedb78bf7ca619e57a669533e7f266af0cffa docs/ENTSCHEIDUNGEN.md
SHA256: f60ba09a7bfdaf76e9cfb416c6668e6b3e17c99e9fa869e1f0602fa79e9eae17 docs/GOLIVE.md
SHA256: f936a68083bcd73dedd958578292107703ef1866feafc05e0f749f20c2669bff docs/OFFEN.md
SHA256: 5e4baee67837e421274c0ee9f11effcfdb73b24af23eeee10ba7be75f084627b docs/BEKS.md
SHA256: ac437df91c912a02b69f428dd952f1fdd9b3f8c5b562647377a7eeb550d3e7d6 docs/STAND.md

## Ergebnis

Kein Fehler im Verhalten, kein Geld- und kein Rechtepfad berührt. Ein hoher Fund: eine bindende Auflage des Plans ist nur zum Teil erfüllt (ein fehlender Satz in der Doku). Hoch wegen der Bindung, nicht wegen der Schadenshöhe.

## Findings

### hoch

H1. `docs/ENTSCHEIDUNGEN.md:226` (ebenso `docs/OFFEN.md:43`, `docs/GOLIVE.md:94`) – Auflage 6, dritter Teil fehlt: „Konto löschen und neu anlegen für Mitglieder gesperrt (0053), verwaiste Firma schon offen (S9h4-1)“ steht in keiner der sieben Dateien (Suche nach „0053“, „role_not_allowed“, „neu anlegen“: nur die alten Einträge `GOLIVE.md:52`, `ENTSCHEIDUNGEN.md:37`). Der Satz trägt die Zahl „1 Firma je Konto“: ohne ihn bleibt offen, ob dasselbe Postfach durch Löschen und Neuanlegen weitere 50 MiB bekommt. Die Tatsache selbst stimmt (`0053_delete_account_fix.sql:14-15`, aktueller Stand `0066_execute_entzug.sql:20-21`: Mitglieder bekommen `role_not_allowed`). – Fix: in Nr. 219 einen Satz ergänzen (Sperre mit Datei:Zeile, verwaiste Firma und fehlender Löschweg offen in OFFEN S9h4-1). Kein Codeumbau.

### mittel

M1. `tests/rls/partner-limits.test.ts:5,12,86-90` – Der rote Lauf belegt nur einen der drei gelockerten Constraints. Im Lauf 001 gelingt der erste Fehlfall („Bezirke 1 bis 24“, Ist-Wert `ok`), damit ist das Konto `c` Mitglied; alle späteren Aufrufe desselben Kontos enden mit `already_member`, und der Test bricht an der ersten Erwartung ab. Die Wirkung von Bezirks-PK und Namens-Check ist im Log nicht sichtbar, die Zeilenzählung `= 0/0/0/0` war nie rot zu sehen (abgeleitet wäre sie `1/1/24/1`). Der Rot-Beweis zählt (Ist-Wert „Aufruf erfolgreich“ für den Bezirks-Check), der Kopfkommentar und Nr. 219 sagen aber mehr, als das Log zeigt. – Fix, eine der zwei: (a) je gelockertem Constraint ein eigenes Konto und weiche Erwartungen, damit alle Ist-Werte samt Zählung im roten Log stehen (neue Datei-Prüfsumme, also neuer roter und grüner Lauf); (b) Testdatei unverändert lassen und in Nr. 219 festhalten, dass der rote Lauf nur den Bezirks-Check zeigt.

M2. `tests/rls/partner-documents.test.ts:156` – Die Prüfung der signierten Upload-URL verlangt nur „Fehler nicht null“. Jeder Fehler (Netz, falscher Aufruf, Endpunkt aus) hielte sie grün; ein Gegenfall fehlt, der zeigt, dass der Endpunkt für dieses Konto überhaupt antwortet. – Fix: Status prüfen wie in Zeile 105 (403) und `data` null; dazu der Gegenfall auf einem eigenen freien Platz mit festgehaltenem Ist-Wert (siehe N5). Ändert die Prüfsumme, Lauf 003 wiederholen.

M3. `docs/GOLIVE.md:94` (Punkt 53) und `docs/ENTSCHEIDUNGEN.md:226` – „Bremse ist die Kontenanlage (Captcha, Mail, Auth-Limits)“: Die Mail bremst nur, wenn das Produktivprojekt die E-Mail-Bestätigung verlangt. `supabase/config.toml:223,228` hat lokal Anmeldung per E-Mail an und Bestätigung aus; die Projekte stellen das im Dashboard ein, belegt ist der Wert nicht. Ohne Bestätigung liefert eine direkte Passwort-Registrierung eine Sitzung ohne Postfach, dann bleibt nur das Captcha und die Grenze je IP (`config.toml:208`, lokal 30 je 5 Minuten). Einen GOLIVE-Punkt dazu habe ich nicht gefunden. – Fix: Punkt 53 um den Prüfwert „E-Mail-Bestätigung an, Ist-Wert notiert“ ergänzen; in Nr. 219 „Mail“ an diese Bedingung knüpfen.

### niedrig

N1. `docs/STAND.md:23` und `docs/GOLIVE.md:65` – Die Listen, wann `booking_open` geöffnet wird (Rechtsklärung, Punkt 34, 46 bis 48), nennen Punkt 26 nicht, während `STAND.md:7`, `GOLIVE.md:59`, `BEKS.md:42` und Nr. 219 ihn bis zur Bestätigung als offen führen. Dazu: Der Schalter sperrt nur Anfragen und Mietbuchungen; Registrierung und Uploads sind ab Livegang der App erreichbar, unabhängig vom Schalter. – Fix: `STAND.md:23` um „GOLIVE 26 (BEKS Frage 1)“ ergänzen.

N2. `tests/rls/partner-limits.test.ts:28-29` – „Bezirk doppelt“ und „Bezirk 0“ gibt es schon in `tests/rls/partners.test.ts:57,60` (Auflage 3: nichts doppeln). Hier Teil der Zählung, darum hinnehmbar. – Fix: beim nächsten Anfassen streichen oder so lassen.

N3. `tests/rls/partner-limits.test.ts:65,90` – Auflage 3 nennt Zählung vorher und nachher; gezählt wird nur nachher. In der Sache erfüllt: Die Konten entstehen in derselben Transaktion, und die absolute Null nachher ist strenger als ein Delta (ein Altbestand mit dem Namensanfang färbte den Test rot, nicht grün). – Kein Fix nötig.

N4. `docs/ENTSCHEIDUNGEN.md:226` – „Captcha seit ts1, Nr. 217“: ts1 ist Nr. 216, Nr. 217 ist die Entscheidung „Punkt 18 genügt“. – Fix: „Nr. 216, 217“.

N5. `supabase/migrations/20261107110000_0024_partner_admin.sql:204-205` – Nicht gemessen: die signierte Upload-URL für einen eigenen freien Platz. Nach meinem Kenntnisstand der Plattform (im Repo nicht belegt) prüft Storage die INSERT-Policy beim Ausstellen, nicht beim Hochladen, und die URL gilt zwei Stunden. Folgen, falls das zutrifft: aal2 und Firmenstatus gelten zum Zeitpunkt des Ausstellens; gibt admin in dieser Zeit eine Zeile ohne Datei frei, kann ein Objekt ohne Zeile entstehen (ein Platz mehr, nur nach Admin-Handlung); mit Upsert-Option wäre ein zweites Hochladen auf denselben Pfad denkbar. Die Grenze von 10 MiB je Objekt und die Typen bleiben. – Fix: nach OFFEN rl3-1 als zu messender Punkt; kein Bau in rl3.

N6. `tmp/proof/rl3/runs.jsonl:1-3` – Alle drei Läufe stammen von Commit 59fac66 mit unsauberem Baum (gezielte Läufe vor dem Commit, zulässig). Pflichtläufe auf dem Endstand stehen dort noch nicht; das prüft das Gate.

## Prüffragen

1. Auflagen des Plans.
   - Auflage 1 (Gateway-Satz): erfüllt. Kein Satz in den sieben Dateien behauptet eine Grenze der Plattform; Wortlaut wie verlangt in `ENTSCHEIDUNGEN.md:226`, `GOLIVE.md:94`, `OFFEN.md:43` (mit Empfehlung „erst bei Bedarf, dann global“), `STAND.md:6`.
   - Auflage 2 (GOLIVE 26): erfüllt. `GOLIVE.md:59` nennt „durch Strukturgrenzen erledigt, Zählergrenze bewusst nicht gebaut“, Bestätigung offen; Frage in `BEKS.md:42` mit Empfehlung; `STAND.md:7,30`. Rest: N1.
   - Auflage 3 (Test mit Zählung, Rot-Beweis): erfüllt, mit M1, N2, N3.
   - Auflage 4 (kein Überspringen): erfüllt. Lauf 003: 10 Tests, alle einzeln als bestanden gelistet, „10 passed (10)“, kein Treffer für „skipped“ oder die Warnung „übersprungen“, Exit 0.
   - Auflage 5 (Zahlen mit Datei:Zeile, kein Umbau): erfüllt. Kein Client- oder Rechteumbau in den geprüften Dateien.
   - Auflage 6: Gesamtwirkung, Admin-Zyklus, GOLIVE-Prüfpunkt und signierte URL vorhanden; der Teil zu Konto löschen und verwaister Firma fehlt (H1).

2. `partner-limits.test.ts`. Ja, der Test misst die Wirkung: `= 0/0/0/0` (Firma nach Namensanfang, Mitglied, Bezirke, Audit) nach 27 Fehlversuchen, `= 1/23/1` und `= 1/1/1` an den Rändern (Zeilen 90-94). Die erwarteten Fehler stimmen mit 0023 überein: 23514 für Check-Verstöße (Zeilen 16-32, 57), 23505 für das Duplikat (PK Zeile 58, außerhalb des Blocks, der `already_member` daraus macht, Zeilen 275-285), 23502 für das NULL-Element und `small_business` null, `P0001: scope_incomplete` für NULL-Feld (Zeile 274). Randwerte passen zu den Grenzen (120/120/80/100/40/254/40 und 2/2/2/2/5/5/1). Die Mutation läuft in der zurückgerollten Transaktion (`tests/support/owner.ts:113`), der Dev-Guard greift über `vite.config.ts:29`. Roter Lauf: Schalter im Kopf und in `runs.jsonl`, keine Argumente, Exit 1, Ist-Wert `ok`; grüner Lauf ohne Schalter und Argumente, Exit 0; beide `dateiSha` gleich dem Hash oben, rot vor grün. Einschränkung: M1.

3. `partner-documents.test.ts`. Die Ergänzung ist richtig platziert (Pfad ohne Zeile, aal2-Token) und läuft grün; die Aussage ist schwach belegt (M2). Lauf 003 wie unter Auflage 4.

4. Doku. Zahlen und Stellen in Nr. 219 stimmen: `partner_members unique (user_id)` 0023:46; Bezirke 0023:55-59; Längen-Checks 0023:16-32; 5 Zeilen unter Advisory-Lock 0026:16-17; Bucket 10485760 Byte, PDF und JPEG, INSERT-Policy 0024:201-205 (kein UPDATE- und kein DELETE-Recht für Nutzer in allen Migrationen, SELECT erweitert in 0025:5-6); `admin_remove_partner_document` löscht nur die Zeile 0024:102-120; `src/lib/partner.ts:122`, `src/lib/partnerDocs.ts:83,105`; `tests/rls/partner-admin.test.ts:223-232`; `take_rate_tokens` nur für `service_role` (0006:87). 5 × 10 MiB = 50 MiB je Firma, und ein Konto hat höchstens eine Firma. Zwischen GOLIVE 26/53, OFFEN rl3-1, BEKS Frage 1 und STAND kein Widerspruch in Zahlen oder Status; Reste: N1, N4.

5. Übersehene Wirkungen. Geld: keine (kein Betrag, keine Gebühr, kein Journal berührt). Sicherheit: M3 (Mail als Bremse hängt an der E-Mail-Bestätigung im Produktivprojekt), N5 (signierte Upload-URL für den eigenen freien Platz ungemessen), N1 (Registrierung ist unabhängig von `booking_open` erreichbar). Die Sperre gegen Löschen und Neuanlegen besteht, ist nur nicht dokumentiert (H1). Größenordnung zur Einordnung, mit lokalen Werten und ohne Bestätigungspflicht: 30 Registrierungen je 5 Minuten und IP wären 360 Konten und 18 GiB je Stunde, jeweils nach Captcha und TOTP-Einrichtung; mit Bestätigungspflicht begrenzt die Mail-Rate.

## Stichproben

- `supabase/migrations/20261107100000_0023_partners.sql:16-32` – Längen- und Formatgrenzen wie in Test und Doku. Stimmt.
- `...0023_partners.sql:46` – `unique (user_id)`. Stimmt.
- `...0023_partners.sql:55-59` – Check 1 bis 23, PK (Firma, Bezirk). Stimmt.
- `...0023_partners.sql:272-288` – Reihenfolge der Inserts, `already_member` nur für Firma und Mitglied, Audit zuletzt. Stimmt mit den erwarteten SQLSTATE.
- `...0024_partner_admin.sql:201-205` – Bucket und INSERT-Policy. Stimmt.
- `...0024_partner_admin.sql:102-120` – Admin entfernt nur die Zeile. Stimmt.
- `...0026_document_slot_taken.sql:16-19` – Lock, Grenze 5, `slot_taken`. Stimmt.
- `...0066_execute_entzug.sql:20-21` – Mitglieder können das Konto nicht löschen. Stimmt, in rl3 nicht dokumentiert (H1).
- `tests/support/owner.ts:92-115` – je Schritt ein Savepoint, Fehler als „SQLSTATE: Meldung“, Rollback am Ende. Stimmt; Erfolge bleiben bis zum Rollback bestehen (Grund für M1).
- `tests/support/partner.ts:19-25` – Reihenfolge der Argumente in `regArgs` passt zur Funktion. Stimmt.
- `tmp/proof/rl3/001-…log:1-5,22,50` – Schalter gesetzt, Ist-Wert `ok`, Exit 1. Stimmt.
- `tmp/proof/rl3/002-…log:1-5,20,28` – ohne Schalter, 1 bestanden, Exit 0. Stimmt.
- `tmp/proof/rl3/003-…log:15-29,37` – 10 bestanden, nichts übersprungen, Exit 0. Stimmt.
- `tmp/proof/rl3/runs.jsonl:1-3` – `dateiSha` gleich den Hashes des Auftrags. Stimmt.
- `tests/rls/partners.test.ts:57,60` – Doppelung zweier Fälle (N2).
- `supabase/config.toml:208,223,228` – lokale Auth-Werte (M3).
- `docs/GOLIVE.md:59,94`, `docs/OFFEN.md:43`, `docs/BEKS.md:42`, `docs/STAND.md:5-7,23,27,30` – Zahlen und Status untereinander gleich; Liste in `STAND.md:23` ohne Punkt 26 (N1).

Offene Findings hoch: 1
