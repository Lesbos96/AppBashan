# R1 Redproof-Härtung: Abnahme Runde 2 (Berater, Geld/Sicherheit/Schema)

Datum: 2026-11-07. Branch `r1`, nicht committet. Nur gelesen, auf Dev nichts ausgeführt. Ausgangspunkt: `tmp/proof/r1-abnahme.md` (hoch 1, mittel 5, niedrig 8).

Geprüfter Umfang:
- Vollständig gelesen: `scripts/redproof-lib.mjs`, `scripts/redproof-s9a3.mjs`, `scripts/redproof-sql.mjs`, `scripts/redproof-soll.mjs`.
- Auszugsweise gelesen: `scripts/redproof-s9a4.mjs` (Z. 20-159, 500-699), `scripts/redproof-migrations.mjs` (`norm`, Policy-Vergleich), `scripts/redproof-deploy.mjs` (synchron, ja/nein), `tests/unit/redproof-lib.test.ts` (Fake-DB Z. 1-140, neue Tests Z. 586-685, Testliste).
- SQL-Listen: `tmp/proof/r1-dev-sql-s9a3.sql` und `r1-dev-sql-s9a4.sql`, alle Totmann-Zeilen gesucht, Stichproben je Restore-Art gelesen.
- Logs: `r1-check-4.log`, `r1-print-s9a3.log`, `r1-print-s9a4.log`, `r1-soll-check-2.log`, `r1-readonly-beweis.log`, `r1-verify-migrations-3.log`.

Hinweis: In meiner Werkzeugliste stand ein eingebautes `advisor`-Werkzeug ohne Parameter. Laut CLAUDE.md wird es nicht benutzt; ich habe es nicht aufgerufen.

**Zählung: hoch 0, mittel 0, niedrig 7.**

**Gesamturteil:** H-1 ist am Code geschlossen, und zwar für `withWindow`, `withDeployWindow`, `onExit` und `recover`. M-1 bis M-5 sind umgesetzt und wirken. Im neuen Code habe ich keinen Fehler gefunden, der etwas offen lassen oder ohne Restore lockern könnte. Was bleibt, sind Robustheits- und Komfortpunkte (niedrig). Etappe 3 darf nach Beks' Freigabe beginnen, mit den Startbedingungen aus Prüffrage 4.

---

## Status der Findings aus Runde 1

| Finding | Status | Beleg (selbst nachgeschlagen) |
|---|---|---|
| H-1 | geschlossen | `redproof-lib.mjs:255-257` setzt `fatal` bei FatalError; `:263-266` stellt nur her, wenn `!fatal` und das Fenster oben liegt; genutzt in `:383-385` und `:400-402`; Tests `redproof-lib.test.ts:592-612` |
| M-1 | geschlossen | `:200` ohne begin/commit, mit `set local search_path`; `:331-334` Zeitzone und Lebendigkeit, nur im Schreibmodus, vor dem Soll-Diff und vor jedem Fenster |
| M-2 | geschlossen | Druckmodus `:349-363`; Probelauf `:444-479`; aufrufbar `redproof-s9a3.mjs:290-293`, `redproof-s9a4.mjs:525-528`; Listen enthalten 84 bzw. alle Fenster mit `cron.schedule` |
| M-3 | geschlossen | Quittung `:540`; Startzählung `:327` mit `greatest(...)`; Test `:623-635` |
| M-4 | geschlossen (Etappe-3-Probe offen, siehe N-B) | `redproof-s9a3.mjs:173`; Liste `r1-dev-sql-s9a3.sql:3391` und `:3397` |
| M-5 | geschlossen | `redproof-migrations.mjs:81` behält die Operatorzeichen; `permissive` in `:210`, `:235`, `:251`; `r1-verify-migrations-3.log:1-2` gleich 266, EXIT=0 |
| N-1 | umgesetzt, Rest N-D | `:87-94` |
| N-2 | geschlossen | `redproof-soll.mjs:14-15` (auch `--source` ohne Wert → Exit 2) |
| N-4 | geschlossen | `redproof-lib.mjs:582-587`, `redproof-soll.mjs:26-28` |
| N-8 | geschlossen | `:268`, `:275` melden die Wiederherstellung nach einem Fatal; Exit 3 und die Sperre bleiben (`:276`) |
| N-3, N-5, N-6, N-7 | gehen nach OPEN_ISSUES | Bewertung in Prüffrage 4 |

---

## Findings

### Hoch
Keine.

### Mittel
Keine.

### Niedrig

**N-A `scripts/redproof-lib.mjs:452`, `:455-460`: Alle Probe-Jobs feuern in derselben Minute und laufen parallel**
- Problem: Alle Jobs teilen sich `t`. pg_cron startet sie gleichzeitig, und es gibt dann drei mögliche Folgen:
  - Zwei Restores ändern dieselbe Katalogzeile, z. B. eine Grant-Zeile und ein `create or replace` derselben Funktion. Dann kommt „tuple concurrently updated“.
  - DDL auf derselben Tabelle wartet nur aufeinander. Das ist harmlos.
  - Rückt das Anlegen vieler Jobs (je CLI-Aufruf 1-4 s) über die Minutengrenze, feuern die übrigen Jobs erst in einem Jahr. Dann meldet die Schleife „kein Lauf“.
- Ein so entstandener Fehllauf wäre ein Fehlalarm. Er sperrt den Start, bis das Restore-Skript quittiert. Gefährlich ist er nicht.
- Echte Totmann-Jobs laufen nie parallel: Es gibt keine verschachtelten SQL-Fenster mit Totmann. Belegt in `redproof-s9a3.mjs:89` und `redproof-s9a4.mjs:119`; das einzige äußere Fenster ist die Cron-Pause, und die hat keinen Totmann.
- Fix: Die Jobs nacheinander anlegen und abwarten, also je Job `deadmanTime(2)` innerhalb der Schleife und erst danach den nächsten. Alternativ je Job eine Minute versetzen.

**N-B `scripts/redproof-s9a3.mjs:173` mit `redproof-lib.mjs:444-479`: Der Probelauf beweist die Purge-Wirkung nicht**
- Problem: Im Soll-Zustand verletzt keine Zeile den Constraint, der Purge löscht also 0 Zeilen. Der Probelauf belegt Syntax, Rechte und search_path des Constraint-Restores in der Cron-Sitzung. Er belegt nicht, dass eine committete verletzende Zeile eines Testkontos (`<tag>-<run>@movenow.test`) tatsächlich entfernt wird und `add constraint` danach gelingt. Genau das war das Szenario von M-4.
- Fix (Etappe 3, vor dem ersten Fenster mit diesem Constraint): Eine Probe-Transaktion macht nacheinander Folgendes:
  - verletzende Kontaktzeile für ein Konto `x-…@movenow.test` anlegen, mit gelöschtem Constraint;
  - den Restore-Text exakt wie in der Liste ausführen;
  - als Ist-Wert die Zahl der Zeilen des Kontos und die Existenz des Constraints lesen;
  - `rollback`.
  Erwartet werden 0 Zeilen und ein vorhandener Constraint.

**N-C `scripts/redproof-lib.mjs:464-467`: Die Warteschleife des Probelaufs schläft nur, solange es keine Zeile gibt**
- Problem: Steht der Lauf auf `starting` oder `running`, fragt die Schleife ohne Pause bis zu 60-mal ab und meldet danach den Status als Fehler. Bei Restores unter einer Sekunde ist das praktisch folgenlos. Bei einem langsamen Lauf, etwa einer Sperre durch N-A, entsteht aber ein falscher Fehlschlag.
- Fix: In jeder Runde schlafen, solange der Status nicht `succeeded` oder `failed` ist.

**N-D `scripts/redproof-lib.mjs:88-89`: Die Lese-Sperre ist eine Verbotsliste mit bekannten Lücken**
- (a) Das Tag-Muster für Dollar-Quotes lässt keine Ziffern zu, Postgres erlaubt sie aber ab dem zweiten Zeichen. Damit werden `$dm<hex>$`-Blöcke nicht entfernt. Heute ist das folgenlos: Diese Blöcke stehen nur in `cron.schedule`, das ohnehin abgelehnt wird, und eine Fehlerkennung führt nur zu einer Ablehnung.
- (b) Selects auf beliebige volatile Funktionen gehen durch. Beispiele: öffentliche RPCs, `net.http_*` (pg_net löst HTTP-Aufrufe aus), `setval`, `pg_notify`, `lo_*`, `dblink*`.
- Bewertung: Für die heutigen Lesemodi reicht die Liste. Dort laufen nur feste Abfragen aus dem Code, und keine davon enthält ein verbotenes Wort; geprüft habe ich alle `select(`-Aufrufe in `redproof-sql.mjs:5`, `:24`, `:34`, `redproof-s9a3.mjs:107`, `redproof-s9a4.mjs:141`, `:398`, `:629` sowie SNAPSHOT/OBJECTS/Matrix. Die Prüfung arbeitet auf Wortgrenzen, deshalb treffen `created_at`, `updated_at` und `rolcreaterole` nicht, und `set_config`, `do` oder `execute` stehen in diesen Abfragen nur in Zeichenketten. Falsche Ablehnungen: keine gefunden (`r1-print-*.log`, `r1-soll-check-2.log`: EXIT=0).
- Zur Frage nach `begin transaction read only`: Die Management-API liefert bei mehreren Anweisungen nachweislich das letzte nicht-leere Ergebnis. Beleg ist das Probe-Muster im Repo: `redproof-s9a3.mjs:65` endet auf `rollback;` und wertet trotzdem `[0]?.v` des vorangehenden Selects aus, und die früheren Läufe waren damit erfolgreich. `begin transaction read only; <q>; commit;` liefert deshalb die Zeilen von `<q>` und lässt Postgres jede Schreibwirkung ablehnen, auch pg_net und `setval`.
- Fix (optional, billig): In den Modi `print` und `readonly` so senden; (a) korrigieren (`[A-Za-z_][A-Za-z0-9_]*` oder leer).

**N-E `scripts/redproof-lib.mjs:212-216`: Totmann-Job ohne Eintrag in der Markierung, wenn die Aktiv-Abfrage scheitert**
- Problem: Scheitert die Abfrage nach `cron.schedule` (Transportfehler nach 3 Versuchen), ist der Job angelegt, aber `w.deadman` nicht gesetzt. Der Fenster-Restore entfernt ihn dann nicht. Folge: Der Job feuert nach 30 min, stellt idempotent her und entfernt sich selbst. Bis dahin verweigert jeder Start mit Exit 2 (`:324-325`). Nichts bleibt offen.
- Fix: `w.deadman = jobName` und `updateMarker(w)` direkt nach `cron.schedule` setzen, die Aktiv-Prüfung danach.

**N-F `scripts/redproof-s9a3.mjs:106-109`, `scripts/redproof-s9a4.mjs:140-157`, `:365`: Der Probelauf legt die vollen Fixtures an**
- Problem: Mit `--deadman-probe` laufen Kontoanlage, Anfragen, Uploads und die Fixture-Zeilen (Trigger-Abschaltung in begin … commit), bevor der Probelauf beginnt. Gelockert wird dadurch nichts, und das Aufräumen im `finally` greift. Es entstehen aber unnötige Schreibvorgänge und Abbruchpfade.
- Fix: Den Zweig für `--deadman-probe` vor die Fixtures legen. Die Restore-Texte brauchen keine Fixture-IDs, sie lesen nur Definitionen.

**N-G Nachweis der pg_cron-Vorbedingungen auf Dev fehlt als Datei**
- Problem: Die Angabe „tz GMT, use_background_workers off, 3 Läufe“ steht in keinem Log unter `tmp/` (Suche nach GMT/background: nur der Unit-Test in `r1-check-4-rot.log:119`). Der Lesemodus führt diese Prüfung nicht aus (`:329`). Sicher ist das trotzdem, weil `start()` im Schreibmodus vor dem ersten Fenster abbricht.
- Fix: Die Logzeile `pg_cron: Zeitzone …` (`:334`) aus dem ersten Schreiblauf in Etappe 3, also dem Probelauf, als Nachweis sichern.

---

## Prüffragen

### 1. Ist H-1 wirklich zu, auch für withDeployWindow und onExit/recover (LIFO)?
Ja.
- **Normalpfad:** `finishWindow` setzt bei jedem FatalError `fatal = true` (`:255-257`). Das gilt für die Restore-Wiederholung (`:241`), für `removeDeadman` (`:226`) und für den Deploy-Restore (`:249`). `closeWindow` (`:263-266`) stellt nur her, wenn kein Fatal vorliegt und `w` oben auf dem Stapel liegt.
  - Ein innerer Fatal lässt das äußere Fenster also unberührt.
  - Ein innerer Nicht-Fatal-Fehler im Restore (Transportfehler beim `unschedule`) lässt das innere Fenster auf dem Stapel. Dann greift die Bedingung „oben liegt“, und das äußere Fenster wird ebenfalls nicht wiederhergestellt.
  - Die Fehlermeldung des inneren Fensters bleibt erhalten, weil das äußere `closeWindow` nichts wirft. Das prüft der Test (`test.ts:599`).
- **withDeployWindow:** Es nutzt dasselbe `closeWindow` (`:400-402`). Deploy und Verify laufen synchron (`redproof-deploy.mjs:5`, `:20`, `execFileSync`), `verify()` ist also kein Promise.
- **onExit (`:267-278`):** Der Handler arbeitet den Stapel von oben ab und bricht beim ersten Fehler ab. Nach einem Fatal im Normalpfad versucht er das oberste, also gescheiterte Fenster erneut. Erst wenn das gelingt, kommt das äußere dran. Die LIFO-Reihenfolge bleibt damit gewahrt. Exit 3 und die Sperre bleiben, die Meldung sagt das (`:275-276`).
- **recover (`:521-535`):** Sortiert nach `nr` absteigend. Ein Fehler wirft sofort, die äußeren Fenster bleiben unberührt. Totmann-Reste werden erst nach allen Fenstern entfernt.
- **Tests:** Normalpfad ohne Signal mit `RESUME_JOB` 0-mal und 2 verbleibenden Markierungen (`test.ts:592-603`); StepError mit Reihenfolge innen, dann außen (`:604-612`). Ein eigener Test für onExit nach einem Fatal fehlt. Die Logik ist aber klein, und ich habe sie am Code nachvollzogen.

### 2. Neuer Code auf neue Fehler
- **deadmanCommand (`:200`):**
  - `set local` greift in beiden Ausführungsarten. Im libpq-Modus führt pg_cron einen Befehl aus mehreren Anweisungen als impliziten Transaktionsblock aus, dort wirkt `SET LOCAL` ohne Warnung. Im Background-Worker-Modus läuft der ganze String in einer Transaktion; `SET LOCAL` warnt dort höchstens und wirkt bis zum Commit.
  - `"$user"` steht innerhalb des äußeren `$dm<hex>$`-Quotes. Dieses Quote endet nur an genau diesem Tag. Auf oberster Ebene ist `"$user"` ein gequoteter Bezeichner, kein Dollar-Quote. Die Übergabe an die CLI geht über `execFileSync` ohne Shell, die Anführungszeichen bleiben also erhalten.
  - Ein Fehler in der Zeitsperre oder im Restore bricht die implizite Transaktion samt Selbst-Entfernung ab. Das ist gewollt.
- **Start-Vorbedingungen (`:331-334`):**
  - Sie laufen nur im Schreibmodus und vor dem Soll-Diff, also vor jedem Fenster und vor dem Probelauf.
  - Steht `cron.timezone` auf null, wird die Bedingung durchgelassen. Das ist vertretbar, weil der pg_cron-Standard GMT ist.
  - Lebendigkeit: mindestens ein erfolgreicher Lauf eines beliebigen Jobs in 65 min. Das reicht.
  - Den Background-Worker-Modus melden die Vorbedingungen nur. Das ist nach dem obigen Punkt in Ordnung.
- **deadmanProbe (`:444-479`):**
  - Wartezeit: bis zu 60 × 10 s für den ersten Lauf, das reicht. Lücke: N-C.
  - Parallele Jobs mit gleicher Zeit: N-A.
  - Aufräumen im `finally` über `removeDeadman` je Job, Fehler werden geschluckt. In Ordnung, weil der nächste Start verbliebene Totmann-Jobs mit Exit 2 meldet (`:324-325`) und Fehlläufe über M-3 sperren.
  - Soll-Diff nach dem Probelauf ignoriert nur die Totmann-Cron-Zeilen. Richtig.
  - Fatal oder StepError: Ein gescheiterter Job ist ein StepError (Exit 1). Weicht der Soll danach ab, ist das ein FatalError (Exit 3). Das setzt `fatal` nicht, es gibt aber auch keine Fenster. `runMain` setzt Exit 3, `finish()` gibt die Sperre frei, und der nächste Start bricht am Soll-Diff ab. Sicher.
  - Auswahl je Restore-Art: `restoreKinds` (`:72-85`) deckt alle Arten aus Plan M-2 ab. s9a3 liefert Recht, Funktion, Constraint und Trigger; s9a4 liefert Funktion, Policy auf public und auf storage, drop if exists, Default und Recht. Die Art `cron` (`cron.alter_job`) kommt nur in der Cron-Pause ohne Totmann vor und braucht keinen Probelauf. Scheitert dort die Lockerung, ist nichts gelockert; scheitert der Restore, bleibt der Job pausiert, also die sichere Richtung.
  - Lock und Startprüfung laufen, weil der Probelauf über `runMain` im Schreibmodus kommt (`redproof-s9a3.mjs:383`, `:417`).
- **isSelect:** keine falschen Ablehnungen in den Skripten. Spalten wie `created_at` und `updated_at` treffen wegen der Wortgrenzen nicht, `do`, `call` und `create` kommen als Bezeichner nicht vor, und `set_config` steht in den Lese-Selects nur in Probe-Texten, die nicht über `isSelect` laufen. Grenzen und Empfehlung: N-D.
- **Weitere Nebenwirkung:** `planDeadman` und `removeDeadman` werden nicht mehr als Select eingestuft und deshalb bei Transportfehlern nicht wiederholt. Das ist sicherer als vorher; der Restfall ist N-E.

### 3. SQL-Listen (Totmann-Zeilen mit cron.schedule)
- Keine Syntax- oder Typfehler gefunden.
- Aufbau aller Totmann-Zeilen:
  1. `cron.schedule(name, '<MI HH DD MM *>', $<tag>$ … $<tag>$)`, also die Variante mit drei Argumenten und Namen;
  2. `set local search_path = "$user", public, extensions;`
  3. `do $g$ … $g$;` mit der Zeitsperre `'<ts>'::timestamptz + interval '1 hour'`;
  4. Restore ohne abschließendes `;`, durch `; ` angehängt;
  5. `select cron.unschedule(jobid) from cron.job where jobname = …`.
- Je Art gelesen:
  - Recht: `r1-dev-sql-s9a3.sql:56`, `:76`.
  - Constraint mit Purge, drop if exists, add: `:3391-3393`.
  - Trigger: `r1-dev-sql-s9a4.sql:2595`, `:2661`.
  - Policy auf public, mehrzeilig: `:2697-2699`, mit unqualifiziertem `service_requests`; das löst der search_path auf.
  - Policy auf storage.objects: `:2722`.
  - drop policy if exists auf storage: `:2887`.
  - Default: `:3142`.
  - drop function plus notify: `:3399`.
  - Zwei Funktionen in einem Restore: `:2109-2131`, dazwischen ein `;` nach dem schließenden `$function$`.
- Der Tag `$<tag>$` ist in der Liste ein Platzhalter. Echt ist er `$dm<8 hex>$`, ein gültiger Dollar-Quote-Tag, und `freeTag` (`:202-207`) schließt Kollisionen und `$g$` im Restore aus.
- Nicht gegen Postgres gelaufen und deshalb Pflicht im Probelauf: die Rechte der Cron-Rolle für `alter policy … on storage.objects` und der search_path der Cron-Sitzung. Beides deckt der Probelauf ab, die Purge-Wirkung deckt er nicht ab (N-B).

### 4. Gesamturteil: Darf Etappe 3 beginnen?
Ja, nach Beks' Freigabe. Startbedingungen:
1. Zuerst `--deadman-probe` für s9a3 und für s9a4, beides mit Exit 0. Jede Art erscheint mit „succeeded, Job entfernt“, danach ist Dev gleich Soll. Die Logzeile `pg_cron: Zeitzone …` wird gesichert (N-G). Wer N-A und N-C vorher nicht behebt, rechnet mit möglichen Fehlalarmen; die Abhilfe ist dann `node scripts/redproof-restore.mjs` (Quittung) und ein neuer Probelauf.
2. Die Purge-Probe aus N-B, bevor das Constraint-Fenster committet läuft.
3. Erst danach Fensterläufe.

Bewertung der nicht umgesetzten Punkte vor Etappe 3:
- **N-3** (synchrones Warten): weder hoch noch mittel. Schlimmster Fall ist eine pausierte Cron-Pause ohne Totmann, also Aufräumen bis zum Restore von Hand. Das ist die sichere Richtung.
- **N-5** (Deploy-Einstellungen nicht automatisch verglichen): weder hoch noch mittel. Die Dateien werden geschrieben, und der Reviewer vergleicht sie. Der Bundle-Abgleich deckt den Code ab.
- **N-6** (Hilfsdatei im Arbeitsbaum): niedrig, bewusste Ausnahme. Bleibt sie liegen, verweigert der nächste Start mit Exit 2.
- **N-7** (abgeleitete Fensterschlüssel): niedrig. Die volle Soll-Prüfung nach jedem Restore verhindert verbliebene Lockerungen. Der Reviewer liest das Fensterprotokoll.

---

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| scripts/redproof-lib.mjs:244-261 | `finishWindow` setzt `fatal` bei FatalError, `splice` erst nach Erfolg: in Ordnung |
| scripts/redproof-lib.mjs:263-266 | `closeWindow`: nur ohne Fatal und nur das oberste Fenster: H-1 zu |
| scripts/redproof-lib.mjs:383-385, 400-402 | beide Fenstertypen nutzen `closeWindow`: in Ordnung |
| scripts/redproof-lib.mjs:267-278 | onExit von oben nach unten, Abbruch beim ersten Fehler, Meldung nach einem Fatal, Exit 3 bleibt: in Ordnung |
| scripts/redproof-lib.mjs:521-535 | recover sortiert nach `nr` absteigend, wirft beim ersten Fehler: in Ordnung |
| scripts/redproof-lib.mjs:200 | Totmann-Befehl ohne begin/commit, `set local search_path`: in Ordnung |
| scripts/redproof-lib.mjs:201 | Zeitausdruck in UTC, Zeitstempel mit Offset: in Ordnung (Zeitzone geprüft in :332) |
| scripts/redproof-lib.mjs:212-216 | Job-Name erst nach der Aktiv-Prüfung in der Markierung: N-E |
| scripts/redproof-lib.mjs:327 | Fehlläufe nach `greatest(letzter Erfolg, Quittung)`: M-3 zu |
| scripts/redproof-lib.mjs:331-334 | Zeitzone und Lebendigkeit, nur im Schreibmodus, vor dem Soll-Diff: M-1 zu |
| scripts/redproof-lib.mjs:349-363 | Druckmodus mit Probe, Totmann, wrapTx-Lockerung, wrapTx-Restore, unschedule: M-2 zu |
| scripts/redproof-lib.mjs:452-460 | alle Probe-Jobs mit derselben Zeit: N-A |
| scripts/redproof-lib.mjs:464-467 | Schlafen nur ohne Zeile: N-C |
| scripts/redproof-lib.mjs:473-478 | Soll-Diff nach dem Probelauf, Aufräumen im finally: in Ordnung |
| scripts/redproof-lib.mjs:88-94 | Zeichenketten vor Kommentaren entfernt; Tag-Muster ohne Ziffern; Verbotsliste: N-D |
| scripts/redproof-lib.mjs:582-587 | Fehlermeldung ohne SQL-Text: N-4 zu |
| scripts/redproof-s9a3.mjs:173 | Purge über alle `%@movenow.test`-Konten: M-4 zu |
| scripts/redproof-s9a3.mjs:106-109, 290-293 | Probelauf erst nach den Fixtures: N-F |
| scripts/redproof-s9a3.mjs:89 / redproof-s9a4.mjs:119 | einziger Aufruf von `withWindow` je Skript, keine verschachtelten Totmann-Fenster |
| scripts/redproof-s9a4.mjs:525-528, 532 | Probelauf vor der Cron-Pause, Ende ohne Lockerung |
| scripts/redproof-sql.mjs:32-38 | Constraint-Restore mit Purge-Funktion: Syntax in Ordnung |
| scripts/redproof-soll.mjs:14-16, 21 | `--source` nur dev oder local, isSelect vor jedem Senden: N-2 zu |
| scripts/redproof-migrations.mjs:81, 210, 251 | Operatorzeichen bleiben, `permissive` wird verglichen: M-5 zu |
| tests/unit/redproof-lib.test.ts:592-603 | Normalpfad, innerer Fatal: `RESUME_JOB` 0-mal, 2 Markierungen bleiben |
| tests/unit/redproof-lib.test.ts:604-612 | StepError: Reihenfolge PAUSE, LOOSEN, RESTORE, RESUME |
| tests/unit/redproof-lib.test.ts:636-658 | Probelauf: Auswahl je Art, Befehle ohne `begin;`, Aufräumen bei Fehlschlag |
| tmp/proof/r1-dev-sql-s9a3.sql:56, 3391-3393 | Totmann-Zeilen für Recht und Constraint: Syntax in Ordnung |
| tmp/proof/r1-dev-sql-s9a4.sql:2595, 2697-2699, 2722, 2887, 3142, 3399 | Totmann-Zeilen für Trigger, Policy (public/storage), drop if exists, Default, drop function: in Ordnung |
| tmp/proof/r1-dev-sql-s9a4.sql:2109-2131 | zwei Funktionsdefinitionen im Restore, korrekt getrennt |
| tmp/proof/r1-check-4.log:55-61 | 26 Dateien, 634 Tests, EXIT=0 |
| tmp/proof/r1-readonly-beweis.log:1-12 | falsche Soll-Datei → EXIT=2, richtige → EXIT=0, für beide Skripte |
| tmp/proof/r1-verify-migrations-3.log:1-2 | gleich 266, EXIT=0 |
| tmp/ (Suche nach GMT bzw. background in *.log) | kein Dev-Nachweis der pg_cron-Einstellungen: N-G |

Offene Findings hoch: 0
