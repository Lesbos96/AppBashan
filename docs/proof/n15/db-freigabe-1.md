Modell: claude-fable-5-2

# DB-Freigabe 1 für Schritt n15

Datum: 2026-11-16
Umfang: Antrag `tmp/proof/n15/db-antrag-1.json` (eine Datei), Migration 0066 vollständig gelesen (97 Zeilen), gegen die Vorfassungen in 0064 (`delete_account`, `report_not_done`), gegen die Rechte-Anweisungen der zwölf Funktionen (0017, 0031, 0032, 0042, 0057 bis 0060, 0062, 0064, 0065), gegen die Sperrstellen (0047, 0052, 0054, 0062, 0064, Cron-Funktionen 0034 und 0043) und gegen die Aufrufer in `supabase/functions`, `scripts` und `tests/rls` geprüft. Regeln: `.claude/rules/daten.md`, `.claude/rules/geld.md`. Rot-Läufe 003 bis 009 in `tmp/proof/n15/` nur an den Fehlerstellen und an `EXIT=` gelesen.

SHA256: c2b7ab7237d0b4e8ce25e0b9fd12b9b54151b6c8540fb156d9b30cce8ce709f0 supabase/migrations/20261116022741_0066_execute_entzug.sql

Urteil: frei

Grenzen der Prüfung
- Der Hash ist aus dem Antrag abgeschrieben (Antrag und Auftrag nennen denselben Wert). Ich habe kein Werkzeug, um ihn selbst zu berechnen; den Abgleich mit der Datei macht das Gate.
- Ein Plan zu n15 liegt unter `tmp/proof/` nicht als Datei vor. Geprüft habe ich gegen die Punkte aus dem Auftrag.
- Die Rümpfe habe ich Zeile für Zeile gelesen und verglichen, nicht mit einem Diff-Programm.
- Rechte habe ich aus den Migrationen und aus den Ist-Werten der Rot-Läufe abgeleitet (003, 006: `service_role` erreicht heute den Rumpf bzw. hat EXECUTE), nicht selbst an der Datenbank abgefragt. Die Migration ist noch nicht angewendet; die grünen Läufe danach sind nicht Teil dieser Freigabe.
- Die Nebenläufigkeit habe ich aus dem Code hergeleitet (Sperren, Schnappschuss je Anweisung bei Read Committed), nicht gemessen. Den Deadlock-Fall deckt kein Test.
- Die Testdateien habe ich nur an den genannten Stellen gelesen, nicht abgenommen. Ob der Katalog-Abzug `scripts/redproof-soll.json` nach dem Push nachgezogen werden muss (zwei geänderte Rümpfe, zwölf geänderte Rechte), habe ich nicht geprüft.

## Findings

### hoch
Keine.

### mittel
Keine.

### niedrig
- N1 `supabase/migrations/20261116022741_0066_execute_entzug.sql:8-9, 23` – Neues Deadlock-Paar, das es vor 0066 nicht gab: `cancel_by_partner` ohne Pauschale hält die Anfrage (`change_gate`, 0064:188) und holt beim Einfügen der Folgeanfrage das Kundenprofil `for share` (0047:36 über 0062:814, Trigger 0052:27); `delete_account` hält das Profil und wartet jetzt auf die Anfrage. Bisher endete das Löschen bei einem laufenden Auftrag ohne Warten mit `open_requests`. Folge: 40P01 für eine Seite, in der Regel für das Löschen (wartet zuerst), möglich auch für die Absage der Firma. Nichts wird halb geschrieben, ein zweiter Versuch gelingt; `delete-account` antwortet dann 500 `internal` statt 409 (`supabase/functions/_shared/account/handlers.ts:26-30`). Das Fenster sind Millisekunden. Der Kommentar nennt die Stelle ungenau: `reissue_request` liest die Quelle ohne Sperre (0047:23), die Sperre kommt aus `change_gate`. – Fix: in OFFEN festhalten. Zeigt es sich in den Logs: entweder die Reihenfolge in `delete_account` umdrehen (erst Anfragen, dann Profil; das entspräche der Reihenfolge aller anderen Stellen) oder 40P01 in der Edge Function einmal wiederholen, beides nur mit eigenem Plan. Kommentar bei der nächsten Änderung berichtigen. Kein Grund, den Push aufzuhalten.
- N2 `supabase/migrations/20261116022741_0066_execute_entzug.sql:23` – `delete_account` sperrt jetzt alle Anfragen des Kunden vor den Prüfungen, auch wenn der Aufruf danach mit `under_review` oder `open_requests` endet. Der Aufruf wartet damit hinter jeder laufenden Transaktion auf einer dieser Anfragen (Annahme, Start, Abschluss, Nachtrag, Storno) und hält sie selbst kurz auf. Die Cron-Läufe überspringen gesperrte Zeilen (0034:164, 0043:75) und holen sie eine Minute später nach. Ein Kunde kann eine Firma damit nicht dauerhaft blockieren (jede Sperre endet mit dem Aufruf). – Fix: keiner nötig; als Folge der gewählten Reihenfolge in OFFEN bei N1 mit nennen.
- N3 `supabase/migrations/20261115104122_0064_report_flow.sql:55-58` – `my_report_info` prüft das gelöschte Profil nicht. Ein gelöschtes Konto mit noch gültigem Token bekäme „Meldung möglich“, `report_not_done` antwortet dann `not_found`. Nur lesend, nur eigene Anfrage, keine Schreibwirkung. – Fix: bei der nächsten Änderung an `my_report_info` dieselbe Prüfung ergänzen. Kein Grund, den Push aufzuhalten.

## Prüffragen

1. `delete_account` gleich 0064 bis auf den Zusatz: ja. Kopf, `security definer`, `search_path = ''` und Deklaration gleich (0066:10-14 = 0064:278-282). 0066:16-22 = 0064:284-290 (Prüfungen `not_found`, schon gelöscht, `role_not_allowed`). Neu ist nur 0066:23. 0066:24-65 = 0064:291-332 (`under_review` vor `open_requests`, Anonymisierung von Anfragen, Kontakten, Profil, Auth-Tabellen, Audit-Zeile), Wort für Wort gelesen, einschließlich der Ersatzwerte der Kontakte und der Spaltenliste von `auth.users`. 0064 ist die jüngste Vorfassung (0065 ändert die Funktion nicht).
2. `report_not_done` gleich 0064 bis auf den Zusatz: ja. 0066:72-82 = 0064:25-35, neu nur 0066:83, 0066:84-89 = 0064:36-41. Der Zusatz steht nach der Sperre und vor `report_gate`; damit kommt bei gelöschtem Konto `not_found` auch dann, wenn die Anfrage schon gemeldet ist (sonst stille Rückkehr). Der Fehlercode ist derselbe wie bei fremder oder unbekannter Anfrage, es entsteht kein Unterschied, an dem ein Aufrufer etwas ablesen könnte.
3. Revoke-Signaturen: alle zwölf stimmen mit der jeweils jüngsten Definition überein, keine Überladungen, keine spätere Löschung ohne Neuanlage. `decline_listing(uuid)` 0038:434 · `withdraw(uuid)` 0017:249 · `my_jobs()` 0064:123 · `my_report_info(uuid)` 0064:46 · `my_job_partner(uuid)` 0032:80 · `job_contact(uuid)` 0065:34 · `start_job(uuid)` 0064:67 · `report_not_done(uuid)` 0066:72 · `complete_job(uuid)` 0064:90 · `my_job_changes()` 0058:6 · `my_cancel_info(uuid)` 0059:142 · `my_commissions(date)` 0062:1008. Passt eine Signatur nicht, scheitert die ganze Migration (nichts halb angewendet).
   - Der Entzug wirkt: bei allen zwölf ist PUBLIC schon entzogen (0017:278, 0031:249, 0032:112, 0042:149, 0058:49, 0059:158, 0060:48, 0062:1023, 0064:62, 0064:171), `service_role` hatte das Recht nur als eigenen Eintrag aus den Vorgabe-Rechten der Plattform (in den Migrationen steht keine solche Anweisung). `authenticated` behält sein Recht; `create or replace` behält die Rechte von `report_not_done`.
   - `delete_account` steht zu Recht nicht in der Liste: nur `service_role` (0052:85-86), Aufrufer ist die Edge Function.
   - Vollständigkeit: Der Katalog-Test verglich alle Funktionen in `public` mit dem Register und meldete genau diese zwölf (Log 006, Zeilen 32-43). Derselbe Test fängt künftig eine Neuanlage per `drop` und `create`, die das Recht über die Vorgabe wieder vergäbe (`tests/rls/positiv.test.ts:91-116`).
4. Aufrufer als `service_role`: keine gefunden.
   - Edge Functions: alle RPC-Aufrufe in `supabase/functions` durchgesehen; keiner der zwölf Namen kommt vor (nur in `database.types.ts` und in einem Kommentar). `delete_account` ruft `_shared/account/db.ts:10`, Signatur unverändert.
   - Skripte: kein Aufruf (einziger Treffer ist ein Katalogeintrag in `scripts/redproof-soll.json:2120`).
   - SQL: keine Funktion ruft eine der zwölf auf; Cron ruft `expire_requests`, `complete_due` und andere, nicht `complete_job` (0043:78 setzt den Status direkt). Eigentümer-Wege sind vom Entzug nicht berührt.
   - Tests: zwei Proben rufen als `service_role` und erwarten jetzt 42501 (`tests/rls/partner-my-jobs.test.ts:102, 121`, `tests/rls/partner-my-job-changes.test.ts:97, 116`). Weitere Aufrufe der zwölf als `service_role` gibt es in `tests/` nicht.
5. Sperrreihenfolge: trägt.
   - Meldung zuerst: `report_not_done` hält die Anfrage, `delete_account` hält das Profil und wartet in 0066:23. Nach dem Commit der Meldung sieht die nächste Anweisung (neuer Schnappschuss) die Meldung: `under_review`, nichts gelöscht.
   - Löschung zuerst: `report_not_done` wartet in 0066:81, bekommt nach dem Commit die aktuelle Zeile und sieht in 0066:83 das gelöschte Profil: `not_found`, keine Meldung.
   - Dazwischen: Hält die Meldung die Anfrage schon, kann die Löschung nicht vor ihr committen. Das Lesen des Profils ohne Sperre in 0066:83 ist deshalb sicher.
   - Die Meldung selbst erzeugt keinen Zyklus: `audit_log.actor_id` hat keinen Fremdschlüssel (0015:22), das UPDATE ändert `customer_id` nicht, die Update-Trigger auf `service_requests` sperren kein Profil.
   - Neue Anfragen können der Sperre nicht entgehen: der Insert-Trigger wartet auf das Profil (0052:27), wie bisher.
   - Zyklus mit der Weitervermittlung: siehe N1. Der Kommentar nennt das Ergebnis richtig (40P01 für eine Seite, nichts halb gelöscht), die Stelle der Sperre ungenau. Andere Stellen, die erst eine Anfrage und dann das Kundenprofil sperren, habe ich nicht gefunden (`for share` auf Profile nur 0052:27 und 0054:29; Fremdschlüssel auf Profile nur bei `service_requests.customer_id` und den Miet-Tabellen, 0001:107, 146, 174, 200).
   - `order by r.id` gibt zwei gleichzeitigen Löschungen dieselbe Reihenfolge; die zweite kehrt nach dem Warten auf das Profil ohnehin still zurück (0066:19).
6. Fehlercodes: unverändert. `delete_account`: `not_found`, `role_not_allowed`, `under_review`, `open_requests` in derselben Reihenfolge; die Edge Function kennt sie (`_shared/jobs/handlers.ts:19, 43, 49, 50`). `report_not_done`: kein neuer Code, `not_found` jetzt auch für gelöschte Konten. Neu möglich ist nur 40P01 (N1), als 500 ohne Einzelheiten.
7. Geld und Kundendaten: nicht berührt. Keine Tabelle, keine Spalte, keine Policy, kein Trigger, keine Daten, kein Seed, kein Secret. Keine Betragsrechnung, kein Journalzugriff. Der Entzug nimmt Rechte weg und gibt keine; kein neuer Leseweg auf Gebühr oder Journal für Kunden. `my_cancel_info` und `my_commissions` bleiben für `authenticated` wie bisher. Beide Rümpfe `security definer` mit `search_path = ''`, alle Objekte mit Schema genannt.
8. Rot-Läufe auf dem Stand davor (Commit d53a9f1, alle `EXIT=1`, 009 `EXIT=0`): Die Ist-Werte messen die Wirkung.
   - 003: `service_role` erreicht den Rumpf von `decline_listing` (Geschäftsfehler statt 42501).
   - 004: Melden nach der Löschung endet mit „ok“ statt `not_found`.
   - 005: Die Löschung läuft neben der wartenden Meldung durch (Rückgabe statt `under_review`). Der Lauf bricht bei der ersten Erwartung ab; den zweiten Wettlauf belegt rot nur 004 (ohne Gleichzeitigkeit).
   - 006: Katalog zeigt bei genau zwölf Funktionen EXECUTE für `authenticated` und `service_role`, Register verlangt nur `authenticated`.
   - 007, 008: `service_role` erreicht den Rumpf von `my_jobs` und `my_job_changes`.
   - 009 gehört nicht zur Migration.
   - Der Wettlauf-Test arbeitet mit festen Wartezeiten (Abstand zwei Sekunden, Sperre vier Sekunden, `tests/rls/account-deletion-concurrency.test.ts:17, 42-46`); das reicht für den Beleg, ein langsamer Lauf könnte ihn kippen.
9. Edge Functions: Signaturen und Rückgabetypen bleiben gleich, aus der Migration folgt kein Zwang zum Neu-Deploy (`daten.md`, Datenbank-Weg, letzter Punkt).

## Stichproben (selbst nachgeschlagen)

- `tmp/proof/n15/db-antrag-1.json:3-4` – eine Datei, Hash wie im Auftrag. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:278-334` – Vorfassung `delete_account`; gleich bis auf 0066:23. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:25-43` – Vorfassung `report_not_done`; gleich bis auf 0066:83. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:7-20` – `report_gate` liefert bei schon gemeldeter Anfrage den stillen Rückweg; deshalb steht der Zusatz davor. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:188` – `change_gate` sperrt die Anfrage; Grundlage für N1.
- `supabase/migrations/20261109190000_0047_s9h2_abnahme.sql:23, 36-40` – `reissue_request` liest ohne Sperre und fügt die Folgeanfrage ein. Grundlage für N1.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:789, 813-814` – `cancel_by_partner`: Sperre über `change_gate`, Weitervermittlung nur ohne Pauschale. Der Zyklus trifft also keine Buchung einer Pauschale.
- `supabase/migrations/20261110100000_0052_account_deletion.sql:14-33` – Insert-Trigger mit `for share` auf das Profil. In Ordnung.
- `supabase/migrations/20261110100000_0052_account_deletion.sql:85-86` – `delete_account` nur `service_role`; keine spätere Rechte-Anweisung. In Ordnung.
- `supabase/migrations/20261110120000_0054_s9h4_abnahme.sql:23-40` – zweiter Trigger mit `for share` (Firmenmitglied), hält keine Anfrage. In Ordnung.
- `supabase/migrations/20261101160000_0015_versions_published.sql:19-28` – `audit_log` ohne Fremdschlüssel auf Profile. In Ordnung.
- `supabase/migrations/20261108170000_0034_s9c_abnahme.sql:161-164` – `expire_requests` mit `for update skip locked`. In Ordnung.
- `supabase/migrations/20261109150000_0043_s9g_abnahme.sql:72-78` – `complete_due` mit `for update skip locked`, ruft `complete_job` nicht. In Ordnung.
- `supabase/migrations/20261101180000_0017_status_machine.sql:249, 278-279` – `withdraw(uuid)`, einzige Definition, PUBLIC und anon entzogen. In Ordnung.
- `supabase/migrations/20261108150000_0032_job_flow.sql:80, 112-113` – `my_job_partner(uuid)` und Rechte der vier Funktionen. In Ordnung.
- `supabase/migrations/20261109140000_0042_completion.sql:149-150` – Rechte von `report_not_done`. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:952, 1008, 1023-1024` – `my_commissions(date)` neu angelegt, Rechte neu gesetzt. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:122-123, 171-172` – `my_jobs()` neu angelegt, Rechte neu gesetzt. In Ordnung.
- `supabase/functions/_shared/account/db.ts:10` – einziger Aufruf von `delete_account`, Signatur passt. In Ordnung.
- `supabase/functions/_shared/account/handlers.ts:26-30` – unbekannter Fehler: 500 `internal`, Log mit gekürzter Meldung. Grundlage für N1.
- `supabase/functions/_shared/jobs/handlers.ts:19, 43, 49, 50` – Statuszuordnung der vier Codes. In Ordnung.
- `tests/rls/execute-entzug.test.ts:8-22` – zwölf Aufrufe als `service_role` (42501 erwartet) und als Eigentümer (kein 42501). In Ordnung (nur Vorhandensein geprüft).
- `tests/rls/report-flow.test.ts:152-166` – Melden nach Löschung: `not_found`, keine Meldung gesetzt, Gegenprobe ohne Löschung. In Ordnung.
- `tests/rls/account-deletion-concurrency.test.ts:40-55` – beide Wettläufe mit getrennten Verbindungen, Endzustand geprüft. In Ordnung.
- `tests/rls/positiv.test.ts:91-116` – Katalog gegen Register für alle Funktionen in `public`. In Ordnung.
- `tests/rls/partner-my-jobs.test.ts:121`, `tests/rls/partner-my-job-changes.test.ts:116` – Erwartung 42501 für `service_role`. In Ordnung.
- `tmp/proof/n15/003` bis `008` (Fehlerstellen), `tmp/proof/n15/runs.jsonl:3-9` – sechs Läufe rot mit den Ist-Werten aus Prüffrage 8, 009 grün. In Ordnung.
- `docs/OFFEN.md:84, 87` – s9k1-3 (`my_report_info` mitnehmen) ist in der Liste der zwölf enthalten. In Ordnung.

Offene Findings hoch: 0
