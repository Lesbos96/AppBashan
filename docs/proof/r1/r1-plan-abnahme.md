ERGEBNIS: hoch 2, mittel 8, niedrig 9

# R1 Redproof-Härtung, Etappe 1: Plan-Abnahme (Berater Sicherheit und Schema)

- Datum: 2026-11-07
- Geprüft: `tmp/proof/r1-plan.md` (vollständig, Z. 1-87) gegen `scripts/redproof-s9a3.mjs` (vollständig), `scripts/redproof-s9a4.mjs` (vollständig), `scripts/dev-guard.mjs`, `docs/OPEN_ISSUES.md:254-289` (R1 und NA-1/NA-5/NA-12), `docs/ARCHITECTURE.md:43-89` (Matrix), `tmp/proof/nachtabnahme-vorher-redproof.md` (H-1, M-1), `tests/rls/uploads.test.ts:625-690`, CLAUDE.md (Dev-Guard, Sicherheit, Nachweise).
- Nicht geprüft: `live-uploads.mjs`, `setup-photo-cleanup.mjs` (nur per Suche), die Hilfen unter `tmp/proof/` (devcheck, funcbodies).
- Hinweis an Beks: In der Tool-Liste dieses Beraters stand ein eingebautes `advisor`-Tool ohne Parameter. Ich habe es gemäß CLAUDE.md nicht benutzt.

## Findings

### Hoch

**H-A `tmp/proof/r1-plan.md:42-45` (Soll-Validierung), `:46` (Neuerzeugung) – Die Soll-Datei kann einen gelockerten Zustand festschreiben. Policies, Constraints, Defaults und die Existenz von Triggern werden gegen keine unabhängige Quelle geprüft.**
- Problem: H-1 (`docs/OPEN_ISSUES.md:259`) verlangt einen Soll-Stand aus einer DB, die nur aus Migrationen gebaut ist. Der Plan erzeugt das Soll stattdessen aus Dev, also genau aus dem Zustand, dessen Sauberkeit nach den Läufen der alten Skripte offen ist. Die Ersatzprüfungen decken nur einen Teil ab:
  - Schritt 1 (md5 gegen Migrationstext) gilt nur für Funktionen.
  - Schritt 2 vergleicht „Policies mit Befehl/Rollen“ mit der Matrix. Die Matrix beschreibt Policies nur semantisch (z. B. `docs/ARCHITECTURE.md:59` „S eigene“). Eine auf `using (true)` gelockerte `request_photos_select` hätte weiter Befehl SELECT und Rolle authenticated und gälte als „gleich“.
  - Schritt 3 prüft Trigger nur auf `O`. Ein fehlender Trigger, ein fehlender Constraint (`request_contacts_format` wird von s9a3 gelöscht und neu angelegt, `scripts/redproof-s9a3.mjs:198-201`) oder ein Default `''` auf `storage_path` (`redproof-s9a4.mjs:471`) fallen nicht auf.
  - Für alle diese Objekte wird ein Rest der alten Läufe zum Soll. Danach bestätigen Start- und Endprüfung den gelockerten Zustand dauerhaft. Das ist H-1 in neuer Form, und `:46` wiederholt das Risiko bei jeder Neuerzeugung.
- Fix:
  1. Bevorzugt eine nur aus Migrationen gebaute DB als Soll-Quelle (Docker lokal oder ein temporäres EU-Projekt mit allen 22 Migrationen, Entscheidung Beks), dieselbe `SNAPSHOT_SQL`, danach Dev dagegen prüfen.
  2. Ist das nicht möglich: Für jede Policy (qual, with_check, permissive, Rollen), jeden Constraint, jeden Spalten-Default und jede Trigger-Definition im Umfang wird automatisch die letzte Fundstelle in `supabase/migrations` gesucht (`create/alter policy`, `add constraint`, `set default`, `create trigger`). Die Fundstelle wird normalisiert verglichen (Kleinschreibung, Leerraum, Klammern, Casts). Ergebnis als Tabelle „Objekt | Dev | Migration Datei:Zeile | gleich/abweichend/nicht gefunden“ nach `tmp/proof/r1-soll-objekte.md`. Jede Zeile außer „gleich“ liest der Berater vor dem Festschreiben.
  3. Unmittelbar vor der Erzeugung, auf demselben Dev-Stand: `test:rls` und `live-uploads` grün als Verhaltensprobe.
  4. Bei jeder Neuerzeugung (`:46`) wird der Diff zur eingecheckten Soll-Datei angezeigt. Jede Änderung muss einer neuen Migration zugeordnet sein, sonst STOPP.

**H-B `tmp/proof/r1-plan.md:63` (Teil 2 Redeploy), `:22` (Restore-Pfad), `:30` (Markierung als SQL) – Die einzige Lockerung außerhalb von SQL entzieht sich Markierung und Soll. Der gelockerte Handler bleibt nach einem harten Abbruch im Arbeitsbaum und deployt auf Dev.**
- Problem: Teil 2 schreibt den gelockerten Quelltext in den Arbeitsbaum (`scripts/redproof-s9a3.mjs:344`) und deployt ihn. Bei Kill, Tool-Timeout oder Stromausfall (`:22` nennt das selbst „nicht abfangbar“) passiert Folgendes:
  - (a) Die Offen-Markierung ist ausführbares SQL für `db query -f`. Sie kann weder die Datei zurückschreiben noch neu deployen.
  - (b) Das Soll sieht den deployten Code nicht. Weder s9a4 noch `--check` noch `test:rls` schlagen sicher an: Die Live-Proben in s9a4 erfassen etwa das Haltefenster und `pickCandidate` nicht.
  - (c) `supabase/functions/_shared/quote/handler.ts` bleibt mit `if (false) throw …` geändert. Der nächste s9a3-Start meldet nur „uncommittete Änderungen … Erst committen oder verwerfen“ (`redproof-s9a3.mjs:34`). Damit bietet die Meldung genau den Weg an, über den eine abgeschaltete Preis- oder Zustimmungsprüfung nach main und später in die Produktion gelangt.
- Fix:
  1. Den Arbeitsbaum nie verändern. Der Lib-Schritt kopiert `supabase/functions` in ein temporäres Verzeichnis, lockert dort und deployt mit ausdrücklicher Dev-Ref (`functions deploy quote --project-ref <Dev-Ref> --use-api`, Arbeitsverzeichnis der Kopie). Vorher prüft er, dass die Ref der Kopie gleich `DEV_REF` ist.
  2. Die Markierung bekommt einen Typ (`sql` | `deploy`). Ein Restore vom Typ `deploy` heißt: Deploy aus dem sauberen HEAD-Baum. Ausführen darf ihn nur ein Restore-Skript mit Dev-Guard (siehe M-1).
  3. Jeder Start (s9a3, s9a4, `redproof-soll --check`) prüft, dass `git status --porcelain -- supabase/functions` leer ist. Die Meldung bietet „committen“ nicht an.
  4. Den Deploy-Stand von `quote` vor und nach Teil 2 feststellen (Q3).

### Mittel

**M-1 `tmp/proof/r1-plan.md:22`, `:30` – Der Restore von Hand läuft ohne Dev-Guard.** `npx supabase db query --linked -f <Markierung>` nimmt das gerade verlinkte Projekt. Ist der Checkout später für GOLIVE mit einem anderen Projekt verlinkt, läuft `create or replace function` mit Dev-Definitionen dort. Fix: `node scripts/redproof-restore.mjs <Markierung>`. Erster Import ist `dev-guard.mjs`. Das Skript führt die Markierungen in LIFO-Reihenfolge aus (M-2), prüft danach gegen das Soll und löscht erst dann. Die Startmeldung nennt nur diesen Befehl.

**M-2 `tmp/proof/r1-plan.md:22` („das Restore-SQL des aktiven Fensters“) und `:34` – Verschachtelte Fenster haben keine Reihenfolge.** Während s9a4 ist die Cron-Pause ein äußeres Fenster, das Schrittfenster ein inneres. Restauriert der Exit-Handler nur das innere, bleibt der Job pausiert (unkritisch). Restauriert er nach Dateizeit, kommt die Cron-Pause zuerst: Der Job läuft dann wieder, während `photo_orphans` noch gelockert ist. Scheitert danach der innere Restore, löscht der Lauf um :23 echte Dev-Dateien (M-4 der Nachtabnahme). Fix:
- Fensterstapel strikt LIFO.
- Die Cron-Wiederaufnahme erst nach einer Soll-Prüfung, die bis auf die Cron-Zeile vollständig gleich ist.
- Scheitert ein innerer Restore, bleibt der Job pausiert (Fatal, Exit 3).
- Die Startmeldung druckt mehrere Markierungen in LIFO-Reihenfolge.
- Unit-Test: Signal bei zwei offenen Fenstern ergibt die Reihenfolge innen, dann außen. Scheitert innen, wird außen nicht ausgeführt.

**M-3 `tmp/proof/r1-plan.md:23`, `:6`/`:56` (Test 7) – Unter Windows trifft „eigenes vitest-Kind beenden“ nur den Wrapper.** Heute läuft vitest über `npx … shell: true` (`redproof-s9a3.mjs:320`, `redproof-s9a4.mjs:585`). `child.kill()` beendet unter Windows nur `cmd.exe`/npx, vitest läuft gegen Dev weiter: parallel zum nächsten Fenster, mit eigenen Konten und ohne Aufräumen. Auch der Exit-Handler restauriert, während das vitest-Kind noch schreibt. Fix:
- vitest direkt starten (`process.execPath` mit dem vitest-Einstieg aus `node_modules`, `shell: false`), damit die PID der vitest-Prozess ist.
- Bei Timeout und im Exit-Handler den Baum synchron beenden (`taskkill /PID <pid> /T /F`, unter POSIX die Prozessgruppe), erst danach restaurieren.
- Unit-Test mit Fake-`spawn`: Die Reihenfolge ist „Baum beenden, dann Restore“.

**M-4 `tmp/proof/r1-plan.md:22`, `:71-75` – Der wahrscheinlichste Abbruchweg ist ein harter Kill. Danach bleibt eine Lockerung bis zum nächsten Start offen.**
- Ein Volllauf von s9a4 dauert weit über 10 min (vitest je Schritt, Live-Pausen von 62 s). Läuft er im Vordergrund des Bash-Tools, beendet ihn der Tool-Timeout hart. Esc beziehungsweise eine Unterbrechung der Session beendet auch Hintergrundprozesse hart.
- Unter Windows gibt es außerdem diese Grenzen: SIGTERM von außen ist `TerminateProcess` und nicht abfangbar. Beim Schließen der Konsole (SIGHUP) beendet Windows den Prozess nach etwa 10 s, also oft vor dem Ende von Restore und Soll-Prüfung über die Management-API.
- Die Markierung erkennt den Zustand erst beim nächsten Start. Bis dahin bleibt Dev gelockert (z. B. Fotozeilen fremd lesbar).
- Fix:
  - (a) `:71` legt fest, dass Etappe-3-Läufe nur im Hintergrund mit Log laufen (`run_in_background`) oder in einem Terminal von Beks, nie im Vordergrund des Tools.
  - (b) Empfohlen als serverseitiger Totmannschalter: Vor jedem committeten Fenster plant die Lib einen einmaligen pg_cron-Job `redproof-restore-<id>`, der das Restore-SQL nach Timeout plus Puffer ausführt und sich danach selbst entfernt. Nach einem verifizierten Restore entfernt die Lib den Job. Die Soll-Prüfung ignoriert nur Jobs mit diesem Präfix, solange ein Fenster offen ist. Beim Start ist jeder solche Job ein Abbruchgrund.
  - (c) Der Exit-Handler fängt Ausnahmen ab (`try/catch`). Bei Fehler bleibt die Markierung liegen, eine klare Meldung folgt, danach Exit 3.

**M-5 `tmp/proof/r1-plan.md:65`, Q6 – Mit `--soll <pfad>` wird ein gelockerter Zustand zum Original.** Zeigt die Datei auf einen gelockerten Stand, besteht die Startprüfung. `:31` liest dann die „Originaldefinition im Soll-geprüften Zustand“, also die Lockerung. Der Restore stellt den gelockerten Stand wieder her, und der Bericht meldet „gleich Soll“. Fix: Ein abweichender Soll-Pfad ist nur in einem Modus erlaubt, der nie schreibt: Startprüfung, Exit vor dem ersten Lockern, der Executor lässt nur Selects zu. Für den Sabotage-Nachweis genügt das, denn er soll den Abbruch zeigen. Läufe mit Schreibzugriff verlangen die kanonische Datei `scripts/redproof-soll.json` ohne Änderung gegenüber HEAD (`git diff --quiet HEAD -- scripts/redproof-soll.json`). Pfad und md5 der Datei stehen im Bericht.

**M-6 `tmp/proof/r1-plan.md:33`, Q4 – Das rote Ergebnis wird nicht der Lockerung zugeordnet.**
- Verlangt ist nur: „jeder fehlgeschlagene `fullName` passt aufs Muster“. Ein Test, der wegen Auth-Rate-Limit, Netzfehler, Timeout oder eines fehlgeschlagenen `beforeAll` rot wird, zählt damit als Rot-Beweis. Das verstößt gegen CLAUDE.md (die fehlschlagende Prüfung muss die Wirkung messen).
- Zudem werden nur die fehlgeschlagenen Tests auf das Muster geprüft, nicht alle gelaufenen. `tests/rls/uploads.test.ts:668-672` ruft im `beforeAll` von „Aufräumen“ das echte `photo_cleanup` auf. Ein zu breites `-t` im `photo_orphans`-Fenster löscht über die Edge Function echte Dev-Dateien, an der Cron-Pause vorbei.
- Fix:
  - (a) Alle gelaufenen Tests (passed und failed) müssen aufs Muster passen, sonst FEHLER vor der Bewertung.
  - (b) Die erste Zeile der Fehlermeldung muss ein Assertion-Fehler sein. Bei Mustern für Netz, Timeout, Rate-Limit oder Hook ist der Schritt FEHLER, nicht rot.
  - (c) Der Abschluss-`test:rls` (`:75`) wird per JSON abgeglichen: Jeder im Redproof rote `fullName` steht dort als passed. Das ersetzt den grünen Nachlauf je Schritt (Q4).
  - (d) Für Schritte mit `photo_orphans` verlangt die Lib zusätzlich, dass kein gelaufener Test aus „Aufräumen“ stammt.

**M-7 `tmp/proof/r1-plan.md:34` – „kein Lauf `running` in `cron.job_run_details`“ heißt nicht, dass das Aufräumen fertig ist.** `photo_cleanup()` stellt nur eine Anfrage `net.http_post` in die Warteschlange. Der Cron-Lauf ist sofort `succeeded`, die Edge Function ruft `photo_orphans()` erst Sekunden bis Minuten später auf. Fix: Vor dem ersten Fenster mit `photo_orphans` zusätzlich prüfen, dass `net.http_request_queue` leer ist. Außerdem muss seit dem letzten `end_time` des Jobs mindestens das Function-Timeout plus Puffer vergangen sein. Alternativ alle Schritte mit `photo_orphans` außerhalb von :20 bis :35 starten, als zweite Sicherung zur Pause.

**M-8 `tmp/proof/r1-plan.md:21`, Q7 – Im committeten Fenster wird nicht gemessen, ob die Lockerung wirkt.** Die SQL-Probe läuft in der Rollback-Transaktion. Im committeten Fenster gibt es dann nur noch den Test. Ob der Commit angekommen ist und genau diese Lockerung bewirkt (und nichts anderes), wird nicht festgestellt. Fix: Nach dem Commit und vor dem Test einen Snapshot ziehen. Der Diff gegen das Soll muss genau die erwarteten Schlüssel nennen (Art und Name, je Schritt deklariert), sonst Restore und FEHLER. Der Bericht nennt je Schritt den Hash des Lockerungstexts in Probe und Commit. Beide müssen gleich sein.

### Niedrig

**N-1 `tmp/proof/r1-plan.md:19`, `:30` – Ein Restore ist nicht überall idempotent und mehrteilige Restores laufen nicht atomar.** `alter table … add constraint` scheitert, wenn der Constraint schon existiert (nach einem Abbruch vor der Lockerung). Restores mit mehreren Anweisungen (zwei Policies in `combine`, zwei Funktionen in `patchFns`, `redproof-s9a4.mjs:159-164`, `:130-143`) laufen heute einzeln. Fix: Constraint-Restore als `drop constraint if exists …; add constraint …`. Jeder Restore-Text in `begin; …; commit;`. Unit-Test: Ein Restore zweimal hintereinander gesendet bringt beide Male Soll-Gleichheit.

**N-2 `scripts/redproof-s9a3.mjs:198-205` – Ein Check-Constraint lässt sich nicht wiederherstellen, wenn im Fenster verletzende Zeilen committet wurden.** Ein gelockerter vitest-Lauf kann eine Zeile `kein-mail` committen. `add constraint` scheitert dann mit 23514. Der Fatal-Pfad fängt das ab, die Ursache ist aber nicht benannt. Fix: Die Fatal-Meldung nennt den SQLSTATE. Der Schritt dokumentiert, dass die Testkonten vor dem Restore gelöscht werden.

**N-3 `tmp/proof/r1-plan.md:26`, `:72` – Nichts schließt parallele Läufe technisch aus.** „Nie parallel“ steht nur im Text. Fix: Sperrdatei `tmp/proof/redproof.lock`, exklusiv angelegt (Flag `wx`) und im Exit-Handler gelöscht. Liegt sie beim Start vor, Exit 2.

**N-4 `tmp/proof/r1-plan.md:77` (v) – Fixture-SQL mit Trigger-Abschaltung fehlt in der Liste.** `legacyRows` (`redproof-s9a4.mjs:423`) committet in einer Transaktion `disable trigger guard_photo_insert`, Insert und `enable`. Das Muster ist atomar, steht aber weder in (iii) noch in (v). Fix: In die SQL-Liste für Beks aufnehmen. Die Lib stellt sicher, dass solche Texte genau einmal gesendet werden (kein Retry) und `begin … commit` enthalten.

**N-5 `tmp/proof/r1-plan.md:66` – `--print-sql` hängt an einer Schalterabfrage.** Fix: Im Modus Print bekommt die Lib einen Executor, der jede Anweisung außer reinen Selects mit Fehler ablehnt. Unit-Test: `--print-sql` mit Fake-Executor sendet nur Selects. Das Skript `redproof-soll.mjs` importiert ebenfalls den Dev-Guard (bei `--source dev`).

**N-6 `tmp/proof/r1-plan.md:35`, `:63` – Die Werkzeugprüfungen messen weiter einen Meldungstext.** Die A-N4-Prüfung erwartet heute „ABBRUCH“ im Text (`redproof-s9a4.mjs:689`, `:700`), die Git-Prüfung druckt dieses Wort (`redproof-s9a3.mjs:34`). `:35` sagt, nur der Dev-Guard druckt es. Fix: A-N4 und M-3 messen die Wirkung (Exit 2 und 0 Aufrufe des Executors, kein Konto `redproof-%` neu, keine Markierung), nicht den Text. Die Meldung der Git-Prüfung wird angepasst (siehe H-B).

**N-7 `tmp/proof/r1-plan.md:31` gegen `:54` – Widerspruch.** `:31` erlaubt bis zu 3 Restore-Versuche mit vorherigem Lesen des Zustands, Test 5 (`:54`) verlangt „sofort Fatal“. Fix: Test 5 auf „nach dem letzten Versuch, der vom Soll abweicht“ ändern (Test 9 deckt die Wiederholung schon ab).

**N-8 `tmp/proof/r1-plan.md:41`, `:44` – Der Snapshot erfasst nur einen Teil der Tabellen.** 12 Tabellen sind im Snapshot, die Matrix hat 18 Zeilen (`docs/ARCHITECTURE.md:53-69`: `price_config`, `rental_offers`, `fee_splits`, `geo_boundaries`, `route_cache`, `route_rate_limits` und die Views fehlen). Schritt 2 kann diese Matrixzeilen nicht abgleichen. Fix: alle Tabellen und Views in `public` (Erweiterung siehe Q1).

**N-9 `tmp/proof/r1-plan.md:22` – Der Exit-Handler kann nicht asynchron aufräumen.** Konten über die Auth-Admin-API, Storage-Dateien und Fixture-Zeilen bleiben nach einem Signal zurück. Die Warnung beim Start (`:41`) zeigt das an. Fix: Die Warnung nennt Anzahl und ältestes Datum. Ein kleines Aufräumskript mit Dev-Guard löscht `redproof-%`-Konten älter als 1 Stunde.

## Antworten auf Q1 bis Q7

- **Q1 (Soll-Umfang): Nein, nicht ausreichend. Änderung:**
  - (a) Policies, Constraints, Defaults und Trigger-Definitionen werden gegen die Migrationen oder eine nur aus Migrationen gebaute DB geprüft (H-A).
  - (b) Den Umfang ergänzen um:
    - alle Tabellen in `public`: `relrowsecurity` und `relforcerowsecurity`, ACL, Spalten-ACL, Policies mit `permissive`, Rollen, qual und with_check;
    - Views: md5 der Definition, `reloptions` (security_invoker), ACL;
    - die ACL der Sequenzen;
    - die Schema-ACL von `public`, `private` und `storage` sowie `pg_default_acl`;
    - `storage.buckets` (public, file_size_limit, allowed_mime_types);
    - die Attribute der Rollen anon, authenticated und service_role (vor allem `rolbypassrls`) und deren Einträge in `pg_auth_members`;
    - `pg_event_trigger`;
    - Extensions (Name, Version, Schema).
  - (c) Der Generator verweigert das Schreiben auch bei einem inaktiven Cron-Job und bei einem Objekt mit dem Präfix `redproof`.
- **Q2 (Cron-Pause für die ganze Dauer): Ja, das ist richtig.** Der Soll-Eintrag reicht, damit eine vergessene Pause beim Start auffällt, solange die Startprüfung nichts ignoriert (bitte so festschreiben: `ignore` nur in der Schrittprüfung während der eigenen Pause). Ergänzungen:
  - LIFO-Restore und Wiederaufnahme erst nach vollständiger Soll-Gleichheit (M-2);
  - Warten auf pg_net und die Edge Function statt nur auf `job_run_details` (M-7);
  - alle gelaufenen Tests passen aufs Muster, weil das `beforeAll` von „Aufräumen“ den Job direkt anstößt (M-6).
- **Q3 (Redeploy-Teil): Teil 2 bleibt, aber nur mit Änderung.** „Grüner Test + md5 der Datei + sauberer Baum“ genügt nicht, weil der Arbeitsbaum selbst gelockert wird und der Deploy-Stand keinen Soll-Wert hat (H-B). Nötig sind:
  - Deploy aus einer temporären Kopie mit ausdrücklicher Dev-Ref;
  - eine Markierung vom Typ `deploy` mit einem Restore-Skript mit Dev-Guard;
  - der Deploy-Stand vorher und nachher, je nach CLI-Version über `functions download quote` (md5 gegen HEAD) oder über die Management-API (Version, `updated_at`, Bundle-Hash). Weicht Dev vorher von HEAD ab, STOPP vor Teil 2.

  Lässt sich das in R1 nicht umsetzen, entfällt Teil 2 und kommt als offener Punkt nach OPEN_ISSUES. Das Ändern des Arbeitsbaums behält der Plan in keinem Fall.
- **Q4 (kein grüner Nachlauf je Schritt): Akzeptiert, mit Bedingungen aus M-6.** Fehlerart klassifizieren (nur Assertion zählt), alle gelaufenen Tests passen aufs Muster, und der Abschluss-`test:rls` zeigt jeden im Redproof roten `fullName` als passed (per JSON abgeglichen). Die doppelte Laufzeit ist dann nicht nötig.
- **Q5 (vitest-Kind beenden, `process.on('exit')` als einziger Restore-Pfad): Es gibt Lücken.** Die Struktur aus einem einzigen Exit-Handler mit synchronem `execFileSync` ist richtig. Es fehlen:
  - das Beenden des vitest-Baums statt nur des Wrappers, vor dem Restore (M-3);
  - der LIFO-Stapel (M-2);
  - `try/catch` im Handler (M-4c).

  Bekannte Grenzen unter Windows, im Plan zu nennen:
  - SIGTERM von außen ist nicht abfangbar.
  - SIGHUP beim Schließen der Konsole hat etwa 10 s.
  - Strg+C erreicht die ganze Konsolengruppe, also auch den laufenden CLI-Aufruf (Ausgang auf dem Server unbekannt, daher braucht es die idempotenten Restores aus N-1). Ein zweites Strg+C bricht die Restore-Aufrufe im Handler ab.
  - Tool-Timeout oder Esc beenden hart.

  Deshalb Läufe nur im Hintergrund oder im Terminal von Beks, dazu der Totmannschalter (M-4).
- **Q6 (`--soll`): Nein, nicht unproblematisch. Änderung wie M-5:** Ein abweichender Soll-Pfad ist nur ohne Schreibzugriff erlaubt. Läufe mit Schreibzugriff verlangen die kanonische Datei ohne Änderung gegenüber HEAD, md5 im Bericht.
- **Q7 (Rollback-Probe und committeter Test als ein Beweis): Ja, mit Änderung (M-8).** Derselbe Lockerungstext (Hash in Probe und Commit identisch, im Bericht). Nach dem Commit und vor dem Test belegt der Snapshot-Diff gegen das Soll genau die erwarteten Schlüssel. Danach der Test mit den Bedingungen aus M-6 und die Ist-Wert-Probe im gesperrten Zustand nach dem Restore.

## Weitere Prüfpunkte aus dem Auftrag

- Dev-Guard: `scripts/dev-guard.mjs:10` liest die Ref-Datei relativ zum Arbeitsverzeichnis. Bei anderem Verzeichnis ist sie leer, also Abbruch (sicher). `:18-22` legt die Ref auch für Kindprozesse fest. Lücken sind der Restore von Hand ohne Guard (M-1) und `--print-sql`/`--soll` (N-5, M-5).
- Produktion: Ein direkter Weg nach Produktion besteht nur über einen Commit des gelockerten Handlers (H-B) und über den Restore von Hand nach neuem `supabase link` (M-1).
- Rot-Beweis ohne Messung der Wirkung: rote Tests aus fremder Ursache (M-6), committetes Fenster ohne Wirkungsmessung (M-8).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `docs/OPEN_ISSUES.md:259` | H-1 verlangt einen Soll-Stand aus einer nur aus Migrationen gebauten DB. Der Plan weicht ab (H-A). |
| `docs/ARCHITECTURE.md:59` | `request_photos` nur semantisch („S eigene“), kein Policy-Ausdruck: Matrixabgleich erkennt `using (true)` nicht. |
| `tmp/proof/r1-plan.md:44` | Abgleich „Policies mit Befehl/Rollen“, ohne qual/with_check. Bestätigt. |
| `scripts/redproof-s9a3.mjs:344` | `writeFileSync` des gelockerten Handlers in den Arbeitsbaum. Bestätigt. |
| `scripts/redproof-s9a3.mjs:34` | Abbruchmeldung bietet „Erst committen“ an. Bestätigt. |
| `scripts/redproof-s9a3.mjs:198-201` | Constraint-Lockerung als Drop, Restore als Add (nicht idempotent, N-1/N-2). |
| `scripts/redproof-s9a3.mjs:320`, `scripts/redproof-s9a4.mjs:585` | vitest über `npx` mit `shell: true` (M-3). |
| `scripts/redproof-s9a4.mjs:170` | Alte Cron-Regel: Minute 27-50 nur beim Schrittstart geprüft (Anlass M-4 der Nachtabnahme). |
| `scripts/redproof-s9a4.mjs:423` | `legacyRows` committet Trigger-Abschaltung, Insert und Einschalten in einer Transaktion (N-4). |
| `scripts/redproof-s9a4.mjs:689`, `:700` | Werkzeugprüfungen messen den Text „ABBRUCH“ (N-6). |
| `scripts/redproof-s9a4.mjs:159-164` | `combine` restauriert zwei Policies in zwei Aufrufen, nicht atomar (N-1). |
| `tests/rls/uploads.test.ts:630` | Kommentar: Waisen-Tests stoßen den Aufräumjob nie an. Stimmt für „Waisenliste“. |
| `tests/rls/uploads.test.ts:668-672` | `beforeAll` von „Aufräumen“ ruft `photo_cleanup` (M-6d). |
| `scripts/dev-guard.mjs:10`, `:18-22` | Relativer Pfad fail closed. Ref für Kindprozesse festgelegt. |
| `tmp/proof/r1-plan.md:31` gegen `:54` | Widerspruch Retry gegen „sofort Fatal“ (N-7). |
| `supabase/functions/_shared/quote/handler.ts` (Importe `../pricing/index.ts`) | Preismodul liegt unter `supabase/functions`, die Git-Prüfung erfasst es. Kein Fund. |

Offene Findings hoch: 2
