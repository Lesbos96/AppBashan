# R1 Redproof-Härtung: Abnahme Runde 1 (Berater, Geld/Sicherheit/Schema)

Datum: 2026-11-07. Branch `r1`, nicht committet. Nur gelesen, auf Dev nichts ausgeführt.

Geprüfter Umfang (vollständig gelesen): `scripts/redproof-lib.mjs`, `redproof-migrations.mjs`, `redproof-sql.mjs`, `redproof-deploy.mjs`, `redproof-restore.mjs`, `redproof-cleanup.mjs`, `redproof-soll.mjs`, `redproof-s9a3.mjs`, `redproof-s9a4.mjs`, `live-uploads.mjs`, `dev-guard.mjs`, `dev-ref.mjs`, `tmp/r1/deploy-state.mjs`, Plan `tmp/proof/r1-plan.md` mit Nachtrag 1 und 2. Auszugsweise gelesen: `tmp/proof/r1-dev-sql-s9a3.sql` und `r1-dev-sql-s9a4.sql` (alle Restore-Arten: Grant/Revoke, Trigger, Funktion, Policy, Constraint mit Purge, Default, Objekt anlegen/löschen, Cron), `r1-soll-objekte.md`, `r1-deploy-state.log`, `tests/unit/redproof-lib.test.ts` (Testliste, LIFO-Tests), `redproof-migrations.test.ts` (Testliste), dazu Migrationen 0016, 0017, 0018, 0019 (Trigger und Constraint von `request_contacts`), `tests/rls/quote-hardening.test.ts`, `tests/support/db.ts`.

Hinweis: In meiner Werkzeugliste stand ein eingebautes `advisor`-Werkzeug ohne Parameter. Laut CLAUDE.md wird es nicht benutzt; ich habe es nicht aufgerufen.

**Zählung: hoch 1, mittel 5, niedrig 8.**
**Gesamturteil:** Der Kern ist sorgfältig gebaut (Soll-Snapshot, Probe-Transaktion, Marker, Sperre, Exit-Handler, Deploy aus einer Commit-Kopie, Lesemodi). Etappe 3 darf aber erst nach dem Fix von H-1 starten: Im normalen Ablauf hebt der äußere Restore die Cron-Pause auch dann auf, wenn der innere Restore gescheitert ist. Die Totmann-Funde M-1 bis M-3 müssen vor dem ersten Totmann-Probelauf behoben sein.

---

## Findings

### Hoch

**H-1 `scripts/redproof-lib.mjs:314-317` mit `:210-222`: LIFO bricht im normalen Ablauf, die Cron-Pause wird über einer offenen Lockerung aufgehoben**
- Problem: `withWindow` ruft im `finally` immer `finishWindow(w)` auf. `finishWindow` prüft weder, ob `w` das oberste Fenster ist, noch ob schon ein Fatal vorliegt. Ablauf: In s9a4 läuft ein inneres Fenster (z. B. `photo_orphans`) unter dem Cron-Fenster aus `cronPause` (`:366-370`). Der innere Restore scheitert dreimal, `FatalError` wird im inneren `finally` geworfen, das Fenster bleibt auf dem Stapel. Der Fehler steigt durch `runSql` in das `finally` des äußeren Cron-Fensters. Dort sendet `restoreVerified` das Restore `cron.alter_job(..., active := true)`. Die Soll-Prüfung schlägt danach zwar fehl (die innere Lockerung ist noch offen), aber der Job ist da schon wieder aktiv. Um :23 läuft dann der echte `photo_cleanup()` gegen die gelockerte `photo_orphans()` und löscht übernommene Dateien auf Dev, also genau das Risiko M-4/M-2 aus dem Plan. Dazu ersetzt die äußere Fatal-Meldung die innere, sodass das Label des eigentlich gescheiterten Fensters in der Ausgabe fehlt.
- Testlücke: `tests/unit/redproof-lib.test.ts:289-299` prüft nur den Signalpfad (`onExit` bricht nach dem ersten Fehler ab, `:227`), nicht die `finally`-Kette.
- Fix: (a) In `finishWindow` den Merker `fatal = true` setzen, bevor ein `FatalError` geworfen wird. (b) Im `finally` von `withWindow`/`withDeployWindow` nur wiederherstellen, wenn `!fatal && stack[stack.length - 1] === w`. Sonst nichts senden und den ursprünglichen Fehler weiterreichen. (c) Unit-Test für den Normalpfad: inneres Fenster mit `failRestore`, keine Signale. Erwartet: `RESUME_JOB` 0-mal gesendet, Exit 3, die Meldung nennt das innere Label, beide Markierungen bleiben.

### Mittel

**M-1 `scripts/redproof-lib.mjs:177`: Der Totmann-Befehl hängt am Ausführungsmodus von pg_cron und am search_path der Cron-Sitzung**
- (a) Der Befehl enthält `begin; …; commit;`. Im Background-Worker-Modus von pg_cron (`cron.use_background_workers = on`) lehnt die Ausführung meines Wissens Transaktionsbefehle ab (hier nicht verifiziert). Dann scheitert jeder Totmann. Im libpq-Modus funktioniert es.
- (b) Die Restore-Texte stammen aus `pg_get_functiondef` bzw. `pg_policies.qual` der Management-API-Sitzung und sind deshalb unqualifiziert. Beispiele: `tmp/proof/r1-dev-sql-s9a4.sql:1757-1759` (`FROM service_requests r` im Policy-Restore) und `r1-dev-sql-s9a3.sql:26-27` (`service_type`, `region`, `request_status` in der Signatur und in `RETURNS TABLE`). In der Cron-Sitzung lösen sie sich nur auf, wenn `public` im search_path der Rolle steht.
- (c) Der Zeitausdruck (`:176`) wird in UTC gerechnet. Ist `cron.timezone` nicht GMT/UTC, feuert der Job zur falschen Stunde oder erst ein Jahr später. Dann greift die Zeitsperre, der Lauf gilt als failed, und M-3 sperrt alle Starts.
- Fix: Den Befehl ohne explizites `begin`/`commit` bauen. Ein mehrteiliger Befehlsstring läuft in beiden Modi als eine Transaktion, ein Fehler in der Zeitsperre oder im Restore bricht den Rest einschließlich `unschedule` ab, die Wirkung bleibt also gleich. Vorne `set search_path = "$user", public, extensions;` voranstellen. Vor dem ersten Fenster lesend prüfen und im Bericht nennen: `current_setting('cron.timezone')` ist GMT oder UTC, `current_setting('cron.use_background_workers', true)`, pg_cron lebt (ein `succeeded`-Lauf von `route-cleanup` in den letzten 65 min). Weicht etwas ab, Abbruch mit Exit 2.

**M-2 Kein Code für den Totmann-Probelauf; im Druckmodus fehlen die tatsächlich gesendeten Texte (`scripts/redproof-lib.mjs:294`, `:362-365`; `r1-dev-sql-*.sql`)**
- Problem: In `r1-dev-sql-s9a3.sql` und `-s9a4.sql` gibt es 0 Treffer für `cron.schedule`. `withWindow` druckt im Modus `print` nur den rohen Lockerungs- und Restore-Text. Es fehlen die Fenster-Probe (`begin; <Lockerung>; <Snapshot>; rollback;`), die gewrappten Commit- und Restore-Texte (`wrapTx`), der Totmann-Befehl und das `unschedule`. Nachtrag 2 (M-A) verlangt aber, dass `cron.schedule`/`unschedule` und der Probelauf je Restore-Art in der SQL-Liste für Beks stehen. Einen Modus für den Probelauf gibt es nicht. Eine Suche in `scripts/` nach Trocken- oder Probelauf findet nur `--dry-run` in `redproof-cleanup.mjs`. Der für Etappe 3 geplante Probelauf lässt sich damit weder aus dem Code noch aus der Liste ableiten.
- Fix: Der Druckmodus gibt je Fenster genau die Zeichenketten aus, die `send()` bekäme: Probe, `wrapTx(loosen)`, `cron.schedule` mit Platzhalter für die Zeit, `wrapTx(restore)`, `unschedule`. Dazu ein eigener Probelauf-Modus, der im Soll-Zustand je Restore-Art (Grant/Revoke, Trigger, Funktion, Policy auf public und auf storage.objects, Constraint mit Purge, Default, Drop if exists) einen Totmann mit genau dem Aufbau aus `planDeadman` auf +2 min legt, auf `succeeded` wartet, prüft, dass der Job sich selbst entfernt hat, und die Soll-Gleichheit bestätigt. Das idempotente Restore auf dem Soll-Zustand ist harmlos.

**M-3 `scripts/redproof-lib.mjs:280`: Ein fehlgeschlagener Totmann-Lauf sperrt alle künftigen Starts**
- Problem: Die Startbedingung zählt fehlgeschlagene Totmann-Läufe seit dem letzten erfolgreichen. Aufgehoben wird sie nur durch einen späteren erfolgreichen Totmann-Lauf. `recover()` (`:400-433`) quittiert nichts, obwohl die Startmeldung auf das Restore-Skript verweist. Ein gescheiterter Probelauf in Etappe 3, ausdrücklich als möglich eingeplant, oder ein ausgelöster Zeitwächter würde deshalb jeden weiteren Lauf mit Exit 2 blockieren, ohne Ausweg im Code.
- Fix: `recover()` schreibt nach bestätigter Soll-Gleichheit eine Quittung mit DB-Zeitstempel, z. B. `tmp/proof/redproof-totmann-quittung.json`. `start()` zählt nur Fehlläufe nach dem späteren der beiden Zeitpunkte (letzter Erfolg, Quittung). Unit-Test dazu.

**M-4 `scripts/redproof-s9a3.mjs:173`: Der Purge vor `add constraint request_contacts_format` erfasst die falschen Konten**
- Problem: Der Purge löscht nur verletzende Kontaktzeilen von Konten `redproof-%`. Die Probe des Skripts wird aber zurückgerollt. Eine committete verletzende Zeile entsteht nur im vitest-Lauf, und zwar mit dem Testnutzer der Testdatei (`tests/rls/quote-hardening.test.ts:235`, `:256`; E-Mail `<tag>-<run>@movenow.test`, `tests/support/db.ts:31`).
- Normalpfad: `afterAll` löscht das Konto, die Kaskade ist erlaubt (`immutable_row` lässt DELETE bei Triggertiefe > 1 durch, Migration 0017 Z. 142). Das ist in Ordnung.
- Abbruchpfad (Zeitlimit mit `killTree`, Signal oder Totmann nach Prozesstod): `afterAll` läuft nicht, die Zeile bleibt, und `add constraint` scheitert mit 23514. Der Restore endet in Fatal, der Totmann scheitert genauso. Der Constraint bleibt also gerade in dem Fall entfernt, für den der Totmann gedacht ist.
- `request_contacts` hat keinen Lösch-Trigger (Migration 0018 Z. 206-221), der Purge selbst würde also nicht blockiert.
- Fix: Purge über die verletzenden Zeilen aller Testkonten `%@movenow.test` (nur Dev). In Etappe 3 mit einer committeten verletzenden Zeile eines Kontos, das nicht `redproof-%` heißt, als Probe-Transaktion vorab prüfen.

**M-5 `scripts/redproof-migrations.mjs:80`, `:208`, `:233`, `:249`: Die Gegenprüfung ist bei Policies und Constraints schwächer als im Plan**
- `norm()` entfernt nicht nur Klammern, sondern alle Zeichen außer `a-z0-9_.<>=!+-*/'%`, also auch `~ | & ? @ # ^ ,`. Dadurch werden etwa `?&` und `?|` gleich, ebenso `x ~ 'a'` und `x 'a'`. Vorrangänderungen bei `and`/`or`/`not` gelten ohne Klammern ohnehin als gleich (bekannte Grenze).
- Der Plan H-A verlangt den Vergleich von `permissive`. Weder `OBJECTS_SQL` (`:208`) noch `migText`/`migNorm` (`:233`, `:249`) enthalten das Flag.
- Fix (billig): Operatorzeichen in `norm` behalten. Postgres schreibt nur LIKE und `= ANY` um, und das ist schon abgebildet. `permissive` vergleichen; die Migrationen enthalten kein `as restrictive` (Suche ergab 0 Treffer), Soll ist also überall PERMISSIVE. Die Vorranggrenze ausdrücklich in `r1-soll-objekte.md` benennen. Bewertung: siehe Prüffrage 1.

### Niedrig

**N-1 `scripts/redproof-lib.mjs:71-72`: Die Lesesperre prüft nur das erste Schlüsselwort**
- `isSelect` lässt `select cron.schedule(...)`, Selects auf schreibende Funktionen und schreibende CTEs (`with … delete … returning`) durch. `stripSql` entfernt `--` auch innerhalb von Zeichenketten, was ein `;` verdecken kann. In den Modi ohne Lauf habe ich keinen erreichbaren Pfad gefunden, der so etwas sendet (siehe Prüffrage 5).
- Fix: In den Modi `print` und `readonly` jede Anfrage als `begin transaction read only; <q>; commit;` senden. Postgres lehnt dann jede Schreibwirkung ab, auch `cron.schedule`.

**N-2 `scripts/redproof-soll.mjs:13-14`, `:17`: Ein falscher `--source`-Wert umgeht den Dev-Guard**
- Jeder Wert außer `dev` (Tippfehler, oder `--source` ohne Wert, dann wird er `true`) überspringt den Dev-Guard, fragt aber trotzdem mit `--linked` ab. Mit `--write` entstünde eine Soll-Datei aus einem ungeprüften Projekt. Auf Dev wird nicht geschrieben.
- Fix: Nur `dev|local` zulassen, sonst Exit 2.

**N-3 `scripts/redproof-lib.mjs:372-383`: `waitCleanupIdle` schläft synchron**
- Gewartet wird mit `Atomics.wait`, bis zu 400 × 15 s. Solange laufen keine Signal-Handler. Wer dann hart beendet, lässt die Cron-Pause offen, und dieses Fenster hat absichtlich keinen Totmann. Folge ist nur, dass das Aufräumen auf Dev bis zum Restore von Hand pausiert; das ist sicher, aber unbequem.
- Fix: asynchron warten (`await` mit Timer).

**N-4 `scripts/redproof-lib.mjs:470-473`: Fehlermeldungen enthalten den ganzen SQL-Text**
- Die Meldung von `execFileSync` enthält die Kommandozeile mit dem vollständigen SQL, also Funktions- und Policy-Texte. Bei Fixture- und Probe-Fehlern landet sie ungekürzt in der Ausgabe (`runMain`, `:447`). Das widerspricht der Regel „Laufzeitausgabe nur Art und Name“. Geheimnisse sind nicht betroffen: Das Token steht in der Umgebung, nicht in den Argumenten.
- Fix: Nur die erste Zeile der CLI-Fehlermeldung samt SQLSTATE weitergeben.

**N-5 `scripts/redproof-s9a3.mjs:306`, `:330`; `scripts/redproof-deploy.mjs:69-75`: Deploy-Einstellungen werden nicht automatisch verglichen**
- `verify_jwt`, `entrypoint_path` und `import_map` werden vor und nach Teil 2 nur in Dateien geschrieben, nicht verglichen. `matches()` vergleicht nur in einer Richtung (geladene Dateien gegen den Commit). Das reicht, weil das Bundle alle importierten Dateien enthält.
- Fix: Die drei Felder für `quote` vor und nach Teil 2 automatisch vergleichen, bei Abweichung FEHLER.

**N-6 `scripts/redproof-s9a4.mjs:634-644`: Werkzeugprüfung schreibt in den Arbeitsbaum**
- Die Werkzeugprüfung A-N4 legt eine Hilfsdatei unter `supabase/functions/` des Arbeitsbaums an. Das ist ungefährlich: Bleibt sie liegen, verweigert der nächste Start mit Exit 2. Es weicht aber von „Arbeitsbaum nie verändert“ ab.
- Fix: in PROGRESS als bewusste Ausnahme vermerken, oder die Prüfung gegen einen temporären `git worktree` laufen lassen.

**N-7 `scripts/redproof-lib.mjs:297-311`: Abgeleitete statt deklarierte Fensterschlüssel**
- Das weicht vom Plan M-8 ab; Bewertung siehe Prüffrage 9.
- Fix (optional): Plausibilitätsprüfung, dass der Objektname jedes abgeleiteten Schlüssels im Lockerungstext vorkommt. Der Reviewer liest das Fensterprotokoll im Bericht Zeile für Zeile.

**N-8 `scripts/redproof-lib.mjs:223-232` mit `runMain` `:446-451`: Nach einem Fatal versucht der Exit-Handler den Restore erneut**
- Nach einem Fatal im normalen Ablauf versucht `onExit` beim Prozessende den Restore der noch gestapelten Fenster erneut, bis zu 3 weitere Versuche. Gelingt das, bleibt trotzdem Exit 3, Markierung und Sperre sind aber weg. Das ist harmlos bis nützlich, passt aber nicht zu „Fatal: kein weiterer Versuch“, und die Meldung bleibt irreführend.
- Fix: Mit dem Fix zu H-1 entscheiden, ob der Exit-Handler nach einem Fatal überhaupt noch wiederherstellt; das Ergebnis in der Ausgabe eindeutig melden.

---

## Prüffragen

1. **Parser-Lücken:**
   - Dollar-Quotes mit eigenem Tag: in Ordnung (`redproof-migrations.mjs:21-27`).
   - do-Blöcke: werden zerlegt (`:182-185`). DDL in `if`-Zweigen gilt als unbedingt, dynamisches `execute` wird nicht erkannt. Die einzige do-Anweisung (Migration 0016 Z. 7-19) enthält keine DDL; in Ordnung.
   - Inline-Constraints und -Defaults: in Ordnung (`:85-114`). Postgres-Kürzung auf 63 Zeichen und unbenannte Tabellen-Checks erscheinen als „nicht gefunden“ bzw. `unresolved`, fallen also auf. Laut `r1-soll-objekte.md` Z. 6: 0 nicht ableitbar.
   - rename: nur Warnung, kein Nachziehen (`:134`, `:159`); fällt als „fehlt auf Dev“ auf, Warnungen: 0.
   - drop (auch drop column und drop table): in Ordnung.
   - `alter … add constraint`: in Ordnung. Unbenanntes `add check/unique/primary key` wird nicht erfasst, fiele aber als „nicht gefunden“ auf.
   - `create or replace`: in Ordnung. Überladungen gleicher Stelligkeit kollidieren (Schlüssel `name/args`), das fiele als abweichend auf.
   - Ergebnis: Alle Lücken außer Vorrang und Operatoren wirken in die sichere Richtung (Zeile nicht „gleich“).
   - Risiko der norm-Grenze: Alle 43 Funktionskörper sind „roh gleich“ (`r1-soll-objekte.md` Z. 51-92), das ist stark. Bei Policies und Constraints bleibt ein Restrisiko für Änderungen nur im Vorrang oder nur am Operator; keine der bekannten Lockerungen aus s9a1 bis s9a4 ist so gebaut, sie fügen Tokens ein oder entfernen sie. Als Gegenprüfung reicht das zusammen mit den grünen Läufen von `test:rls` und `live-uploads` auf demselben Stand. Die billigen Verbesserungen aus M-5 (Operatoren, permissive) sollten vor dem Festschreiben nachgezogen werden.
   - ACLs und Funktionsattribute (security definer, search_path, ACL) prüft der Parser nicht, sondern der Matrix-Abgleich. Das entspricht dem Plan.

2. **Totmann:** Finding M-1, M-2, M-3. Korrekt sind: Zufalls-Tag mit Kollisionsprüfung und Ausschluss von `$g$` (`:172-174`); Zeitsperre (`:177`); Selbstentfernung nach Name; Job wird vor dem Commit gelesen und muss aktiv sein (`:179-180`); Entfernen erst nach verifiziertem Restore, mit Warten auf `running` (`:184-193`); Abbruch, wenn beim Start Totmann-Jobs vorhanden sind (`:278-279`); Frist 30 min gegenüber höchstens etwa 15 min Fensterdauer; keine Totmann-Verschachtelung, das Cron-Fenster hat absichtlich keinen. Nicht ausreichend vorab geprüft sind Ausführungsmodus, Zeitzone, Lebendigkeit von pg_cron und search_path. Der geplante Probelauf ist richtig, braucht aber Code (M-2) und einen Ausweg bei Fehlschlag (M-3). Wirkt der Totmann nicht, wird dadurch nichts gelockert; es bleibt nur der Schutz durch Markierung und Restore von Hand.

3. **Deploy-Kopie:** in Ordnung.
   - Die Kopie entsteht nur aus `git ls-tree`/`git show <commit>` (`redproof-deploy.mjs:21-22`, `:35-49`), in `os.tmpdir()` außerhalb des Repos, geprüft in `:30-31`.
   - Deploy und Download laufen mit `cwd` = Kopie bzw. leerem Verzeichnis außerhalb des Repos, `--project-ref` = DEV_REF, Umgebungsvariable `SUPABASE_PROJECT_ID` = DEV_REF (`:20`, `:32`, `:51-62`). Kein Schreibzugriff unter `supabase/` des Repos.
   - Stand-Prüfung per Download vor Teil 2 mit STOPP (`redproof-s9a3.mjs:307-310`); belegt in `r1-deploy-state.log` (27 Dateien gleich, EXIT=0).
   - Marker mit Commit (`redproof-lib.mjs:160`); Restore aus dem gespeicherten Commit mit anschließendem Abgleich (`redproof-restore.mjs:15-19`, `redproof-lib.mjs:418-421`).
   - Abweichung vom Plan: Die Kopie liegt außerhalb von `tmp/` und nicht unter `tmp/gelockert-<id>/` (wegen der Aufwärtssuche der CLI). Das ist sinnvoll und im Dateikopf begründet.
   - Rest: N-5.

4. **Restore LIFO, Sperre, Marker, Exit-Codes, Signale, Wiederholungen:** Finding H-1 (LIFO im normalen Ablauf). In Ordnung sind:
   - LIFO im Signalpfad (`:225-228`) und in `recover()` (`:413-427`).
   - Sperre mit `wx` und PID-Prüfung (`:268-275`, `:405-412`).
   - Marker mit fsync vor dem Commit (`:154-163`, `:303`).
   - Exit-Codes 0/1/2/3/130 (`runMain` `:439-453`). Das Setzen von `exitCode` im Exit-Handler wirkt auch nach `process.exit(130)`.
   - Synchroner Restore im Exit-Handler (`execFileSync`, `Atomics.wait`).
   - Signale SIGINT/SIGTERM/SIGHUP/SIGBREAK (`:234`).
   - Wiederholungen: Bei Transportfehler werden nur Selects und Probe-Transaktionen wiederholt (`:137-140`). Lockerung (`:309`), Fixture (`:247-251`) und Restore-Text werden nie blind wiederholt; der Restore wird erst nach einer Zustandslesung erneut gesendet (`:196-208`). Die als Select eingestuften Cron-Aufrufe (`cron.schedule` mit gleichem Namen, `unschedule`) sind bei Wiederholung idempotent; in Ordnung.

5. **Kein Schreibzugriff ohne Lauf:** in Ordnung, mit N-1/N-2 als Härtung.
   - `--check`, `--verify-migrations` und `--write` von `redproof-soll` senden nur `SNAPSHOT_SQL`, `OBJECTS_SQL`, die Matrix-Abfrage und `version()`. `--write` schreibt nur lokal.
   - `--print-sql`: `send()` lehnt im Modus `print` alles außer Selects ab (`:136`). `probe`, `fixture`, `withWindow`, `withDeployWindow` und `cronPause` zeichnen nur auf (`:249`, `:255`, `:294`, `:323`, `:362-365`). In s9a3 und s9a4 gibt es im Druckmodus keine Konten, Uploads oder RPCs (Platzhalter, `redproof-s9a4.mjs:53`, `:61`, `:139`); asynchrone Proben und vitest laufen nur im Fensterrumpf, der im Druckmodus nicht ausgeführt wird.
   - `--soll` (readonly): `main` endet direkt nach der lesenden Startprüfung (`redproof-s9a3.mjs:372`, `redproof-s9a4.mjs:651`), ohne Sperre.
   - `tmp/r1/deploy-state.mjs`: nur Download und Funktionsliste.
   - Pfade, die schreiben könnten: Im Code keiner erreichbar. Theoretisch die Lücken der Lesesperre (N-1) und `redproof-soll` mit falschem `--source` (N-2, nur lesend gegen ein ungeprüftes Projekt).

6. **PLATTFORMOBJEKTE:** in Ordnung.
   - Genau zwei benannte Einträge mit Art, vollem Namen, vollständiger Definition und Begründung (`redproof-migrations.mjs:260-271`).
   - Greifen nur, wenn das Objekt nicht in den Migrationen steht. Abgleich exakt nach Art und Name, Definition nach Zusammenfassen der Leerzeichen zeichengleich, sonst „abweichend“ (`:283-284`). Fehlen auf Dev wird „fehlt auf Dev“ (`:300`).
   - Kein Schema-Platzhalter. Der Unit-Test prüft die Namensliste (`tests/unit/redproof-migrations.test.ts:83-84`).

7. **Erzeugte SQL-Texte:**
   - Beim Lesen keine Syntax- oder Typfehler gefunden in: Grant/Revoke, `enable/disable trigger`, `create or replace function` (mehrere durch `;\n` getrennt), `alter policy` mit Postgres-Deparse, Constraint-Restore (Purge, `drop if exists`, `add`), `drop default`, `drop function if exists` plus `notify`, `cron.alter_job(<jobid>, active := …)`, Fixture mit `begin … commit`, Probe-Transaktionen (leere Anweisungen `; ;` sind zulässig).
   - Das Muster „Mehrfachanweisung, es zählt das letzte Ergebnis“ (Probe mit `rollback`) und Commits über die Management-API sind aus den früheren Läufen belegt (`tmp/r1/s9a4.orig.mjs:123`, `:423`, `docs/proof/s9a4c`).
   - Wahrscheinliche Fehler stecken nur im Totmann-Befehl (M-1a: `begin`/`commit` im Background-Worker-Modus; M-1b: unqualifizierte Namen im search_path der Cron-Sitzung).
   - Inhaltlicher Fehler im Restore: Der Purge erfasst die falschen Konten (M-4).
   - Nie gegen Postgres gelaufen und am riskantesten: der Totmann-Befehl, `cron.alter_job` (erstmals benutzt; Eigentümer des Jobs muss die API-Rolle sein) und der Constraint-Restore mit Purge. Diese drei gehören in den Probelauf (M-2).

8. **Sicherheit:**
   - Keine Geheimnisse in Markern (Label, Restore-SQL, Commit), Sperre (PID), Berichten oder Logs. Der Wert von `CLEANUP_SECRET` wird nie ausgegeben, Kontoschlüssel und Token nur aus der Umgebung. Rest: N-4 (SQL-Text, kein Geheimnis).
   - Dev-Guard steht als erster Import in s9a3 (Z. 12), s9a4 (Z. 12), `redproof-restore` (Z. 4), `redproof-cleanup` (Z. 4), `live-uploads` (Z. 7) und `deploy-state` (Z. 2). In `redproof-soll` wird er bedingt geladen (Z. 14; lesend, siehe N-2). Der Guard verlangt alle drei Refs gleich DEV_REF, sperrt `SUPABASE_WORKDIR` und setzt `SUPABASE_PROJECT_ID`.
   - Löschpfade: `redproof-cleanup` nur `redproof-…@movenow.test` älter als N min, mit Sperre und Marker als Abbruchgrund (Z. 14-15). Bei ungültigem Wert für die Minuten ergibt der Vergleich NaN, gelöscht wird nichts. Der Constraint-Purge wird von keinem Unveränderlichkeits-Trigger blockiert (`request_contacts` hat keinen), erfasst aber die falschen Konten (M-4).
   - NA-1 in `live-uploads.mjs:71-86`: in Ordnung. Genau 409 mit `terms_changed` bzw. `price_changed` plus Snapshot, nach beiden Aufrufen keine Anfrage zur clientRef, sonst FAIL mit Rückgabe; schlägt die Abfrage fehl, wird das als Fehler gewertet.

9. **Abgeleitete Fensterschlüssel:** Die Abweichung ist vertretbar. Für die Sicherheit entscheidend ist die volle Soll-Prüfung nach jedem Restore (nur die Schlüssel der äußeren Fenster werden ignoriert) und am Ende. Die verhindert verbliebene Lockerungen unabhängig von deklarierten Schlüsseln. Die Ableitung garantiert dazu, dass Probe und Commit dieselbe Wirkung haben, und Lockerungen ohne Wirkung werden abgelehnt (`:300`). Verloren geht nur die Erkennung unbeabsichtigter Nebenwirkungen innerhalb des Snapshots, also die Zuordnung des Rot-Beweises. Ausgleich: Das Fensterprotokoll nennt die Schlüssel je Schritt (`redproof-s9a3.mjs:401-402`, `redproof-s9a4.mjs:684-685`). Der Reviewer prüft je Fenster, dass genau das beabsichtigte Objekt erscheint (bei `combine` zwei). Optional die Plausibilitätsprüfung aus N-7.

---

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| scripts/redproof-lib.mjs:314-317 | `finally` ruft immer `finishWindow(w)` auf, ohne Prüfung auf oberstes Fenster oder Fatal: H-1 |
| scripts/redproof-lib.mjs:210-222 | `finishWindow` ohne LIFO-Prüfung; `splice` erst nach Erfolg, Fenster bleibt bei Fatal gestapelt: H-1 |
| scripts/redproof-lib.mjs:223-232 | Signalpfad bricht nach dem ersten Fehler ab, korrekt LIFO |
| tests/unit/redproof-lib.test.ts:289-299 | Test für gescheiterten inneren Restore nur über Signal, nicht über die `finally`-Kette |
| scripts/redproof-lib.mjs:176-178 | Zeitausdruck in UTC, Befehl mit `begin`/`commit`, Tag in Dollar-Quotes: M-1 |
| scripts/redproof-lib.mjs:280 | Fehllauf-Prüfung ohne Quittung: M-3 |
| scripts/redproof-lib.mjs:72-73 | `isSelect` nur über das erste Schlüsselwort; `isProbeSql` verlangt `begin … rollback` ohne `commit`: N-1 |
| scripts/redproof-lib.mjs:136-144 | Modussperre vor dem Senden; Wiederholung nur bei Select/Probe und Transportfehler: in Ordnung |
| scripts/redproof-lib.mjs:297-311 | Probe leitet Schlüssel ab, Commit-Diff muss gleich sein: in Ordnung (Prüffrage 9) |
| scripts/redproof-lib.mjs:362-370 | Druckmodus der Cron-Pause; Pause vor `waitCleanupIdle` committet: in Ordnung |
| scripts/redproof-lib.mjs:413-427 | `recover()` sortiert nach `nr` absteigend, ignoriert die Schlüssel der äußeren Fenster: in Ordnung |
| scripts/redproof-lib.mjs:470-473 | Fehlermeldung enthält die Kommandozeile samt SQL: N-4 |
| scripts/redproof-migrations.mjs:80 | Zeichenfilter entfernt Klammern und Operatorzeichen: M-5 |
| scripts/redproof-migrations.mjs:208 | Policy-Text ohne `permissive`: M-5 |
| scripts/redproof-migrations.mjs:260-300 | Zwei benannte Plattformobjekte, exakter Definitionsvergleich: in Ordnung |
| scripts/redproof-sql.mjs:32-38 | Constraint-Restore: Purge, `drop if exists`, `add`: Syntax in Ordnung |
| scripts/redproof-s9a3.mjs:173 | Purge nur für `redproof-%`: M-4 |
| tests/support/db.ts:31 | Testkonten `<tag>-<run>@movenow.test`, nicht `redproof-%`: bestätigt M-4 |
| tests/rls/quote-hardening.test.ts:235, 256 | Gelockerter Test committet die ungültige Kontaktzeile über den Testnutzer: bestätigt M-4 |
| supabase/migrations/20261101180000_0017_status_machine.sql:142 | `immutable_row` lässt Kaskaden-DELETE zu: Normalpfad von M-4 in Ordnung |
| supabase/migrations/20261101190000_0018_revisions_contacts.sql:206-221 | `request_contacts` ohne Lösch-Trigger: Purge nicht blockiert |
| tmp/proof/r1-dev-sql-s9a4.sql:1757-1759 | Policy-Restore mit unqualifiziertem `service_requests`: M-1b |
| tmp/proof/r1-dev-sql-s9a3.sql:26-27 | Funktionsdefinition mit unqualifizierten Typen: M-1b |
| tmp/proof/r1-dev-sql-s9a3.sql:2012-2014 | Constraint-Restore syntaktisch in Ordnung |
| tmp/proof/r1-dev-sql-*.sql (Suche nach `cron.schedule`) | 0 Treffer: M-2 |
| scripts/redproof-deploy.mjs:20-62 | Kopie aus `git show`, außerhalb des Repos, `cwd` = Kopie, Ref fest: in Ordnung |
| tmp/proof/r1-deploy-state.log:1-3 | Dev-Stand von quote gleich b9b22b8, 27 Dateien, EXIT=0 |
| scripts/redproof-soll.mjs:13-14 | Guard nur bei `source === 'dev'`: N-2 |
| scripts/redproof-s9a4.mjs:634-644 | Hilfsdatei unter `supabase/functions` im Arbeitsbaum: N-6 |
| scripts/live-uploads.mjs:71-86 | NA-1 vollständig umgesetzt |
| scripts/dev-guard.mjs:7-22 | Drei Refs gleich DEV_REF, `SUPABASE_WORKDIR` gesperrt, `SUPABASE_PROJECT_ID` gesetzt: in Ordnung |
| scripts/redproof-cleanup.mjs:14-15 | Abbruch bei lebender Sperre oder Marker: in Ordnung |
| tmp/proof/r1-soll-objekte.md:5-6, 51-92 | 266 gleich, 0 nicht ableitbar, alle Funktionen „roh gleich“ |

Offene Findings hoch: 1
