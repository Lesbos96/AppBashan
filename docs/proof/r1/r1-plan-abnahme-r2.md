ERGEBNIS: hoch 1, mittel 3, niedrig 6

# R1 Redproof-Härtung, Etappe 1: Plan-Abnahme Runde 2 (Berater Sicherheit und Schema)

- Datum: 2026-11-07
- Geprüft: `tmp/proof/r1-plan.md` vollständig (Z. 1-133, Nachtrag Z. 90-133 gilt bei Widerspruch) gegen meinen Runde-1-Bericht `tmp/proof/r1-plan-abnahme.md`. Stichprobenweise gegengelesen: `scripts/dev-guard.mjs` (vollständig), `scripts/redproof-s9a1.mjs`, `-s9a2.mjs`, `-s9a3.mjs`, `-s9a4.mjs` (per Suche nach Lockerungsarten), `supabase/config.toml` (Abschnitte `[functions.*]`), `.gitignore`, `docs/ARCHITECTURE.md:43-92` (Matrix), `supabase/migrations/…0020_photo_staging.sql` und `supabase/seed.sql` (per Suche).
- Nicht geprüft: Code der neuen Lib (existiert noch nicht), Verhalten von pg_cron und Supabase-CLI auf Dev (nur Plan-Ebene; was davon in Etappe 2 nachzuweisen ist, steht in den Funden).
- Hinweis an Beks: In meiner Tool-Liste steht wieder ein eingebautes `advisor`-Tool ohne Parameter. Ich habe es gemäß CLAUDE.md nicht benutzt.

## Findings

### Hoch

**H-A-Rest `tmp/proof/r1-plan.md:96` – Die Migrations-Gegenprüfung läuft nur in Richtung Dev → Migration. Ein auf Dev entferntes Objekt erscheint nirgends in der Tabelle und wird Soll.**
- Problem: `:96` prüft „jede Policy …, jeden Constraint, jeden Spalten-Default und jede Trigger-Definition im Umfang“. Umfang ist der Dev-Snapshot. Was auf Dev fehlt, hat keine Zeile, also auch kein „abweichend“ oder „nicht gefunden“. Genau diese Klasse habe ich in H-A ausdrücklich genannt („fehlender Trigger, fehlender Constraint“), und genau sie erzeugen die alten Skripte, deren Reste H-1 sucht:
  - `scripts/redproof-s9a1.mjs:41` und `scripts/redproof-s9a2.mjs:84` lockern per `drop trigger`, der Restore legt den Trigger aus einer gespeicherten Definition neu an. Bricht er ab, fehlt der Trigger.
  - `scripts/redproof-s9a3.mjs:198-200` lockert per `drop constraint request_contacts_format`.
  - Die Trigger-Prüfung „alle `O`“ (`:45`) sieht einen fehlenden Trigger ebenfalls nicht.
- Die Verhaltensprobe (`:97`, `test:rls` grün) fängt nur Reste ab, deren Redproof-Schritt einen vitest-Test hatte. Schritte, deren Wirkung nur per SQL-Probe gemessen wurde, deckt sie nicht ab.
- Fix:
  1. Gegenrichtung Migration → Dev: Der Parser bildet aus `supabase/migrations` den Netto-Bestand (`create` minus späteres `drop`/`rename`) an Policies, Triggern, Constraints (auch inline in `create table`: `check`, `unique`, `references`, `primary key`), Spalten-Defaults (auch inline `default …`) und `enable/force row level security`. Jedes Objekt dieses Bestands muss auf Dev existieren. Fehlt eines, gibt es eine Zeile „fehlt auf Dev“, Exit 2.
  2. Zielliste: Alle Objekte, die die alten Skripte s9a1 bis s9a4 je gelockert haben (aus den Skripten und der Git-Historie, rund 40 Schlüssel), stehen als eigene Liste in `r1-soll-objekte.md`. Jedes muss in beiden Richtungen „gleich“ sein oder vom Berater einzeln abgenommen werden. Diese Liste ist der direkte Nachweis für H-1, der Rest der Tabelle die Breitenprüfung.
  3. Unit-Tests für den Parser mit Fixtures: späteres `alter policy` ersetzt das `create`, `drop` nach `create` ergibt „soll fehlen“, Inline-Constraint und Inline-Default, Dollar-Quote mit eigenem Tag, Policy in einem `do`-Block. Fall „gelöschter Trigger“ (Dev ohne Objekt) ergibt Exit 2.
- Entscheidung zu Prüffrage 3 steht unten: in der Fassung des Nachtrags hoch, mit Fix 1 bis 3 mittel.

### Mittel

**M-A `tmp/proof/r1-plan.md:110` (M-4b) – Der Totmannschalter ist kein sicherer Einmal-Job. Seine Wirkung ist auf Dev nicht nachgewiesen.**
- Probleme:
  - pg_cron kennt keinen einmaligen Zeitpunkt. Ein Ausdruck aus Minute, Stunde, Tag und Monat feuert jedes Jahr. In einem Befehl aus mehreren Anweisungen bricht ein Fehler alle folgenden ab. Scheitert also der Restore (z. B. 23514, siehe N-1), läuft `cron.unschedule` nie. Der Job bleibt und spielt in einem Jahr eine dann veraltete Funktions- oder Policy-Definition zurück, auch über neuere Migrationen hinweg.
  - „`select cron.unschedule(jobid)` für sich selbst“: Die eigene jobid kennt der Befehl zum Zeitpunkt von `cron.schedule` nicht.
  - Der Zeitpunkt „Timeout + Puffer“ ist kürzer als ein Fenster. Ein Fenster umfasst Commit, Snapshot nach M-8, vitest bis zum Timeout, Beenden des Baums, bis zu 3 Restore-Versuche und die Soll-Prüfung. Feuert der Job vor dem regulären Restore, sperrt er mitten im Test. Das ist sicher (der Test wird grün, Ergebnis FEHLER), kostet aber Läufe. Die Lib muss danach einen schon entfernten Job als „erledigt“ werten statt als Ausnahme.
  - Wer schreibt: Der Job läuft als `cron.job.username`, also als die Rolle, die `supabase db query --linked` nutzt. Ob diese Rolle im pg_cron-Worker alle Restore-Arten darf (`alter policy` auf `storage.objects`, `grant/revoke`, `create or replace function`, `enable trigger`), und ob `begin; …; commit;` im Cron-Befehl läuft (Modus libpq oder Background-Worker), ist nicht belegt.
  - Der Plan nimmt `cron.schedule`/`cron.unschedule` für die Totmann-Jobs nicht in die SQL-Liste für Beks auf (`:77` (iv) nennt nur `cron.alter_job`).
- Reihenfolge zur Cron-Pause ist richtig: Der Totmann stellt nur das innere Fenster wieder her, `photo-cleanup` bleibt pausiert. Der nächste Start bricht ab, `redproof-restore.mjs` arbeitet LIFO. Das ist sicher.
- Fix:
  1. Befehlsaufbau: zuerst eine Zeitsperre (`do`-Block, der mit Fehler abbricht, wenn `now()` mehr als 1 Stunde nach dem geplanten Zeitpunkt liegt), dann `begin; <Restore>; commit;`, dann `select cron.unschedule(jobid) from cron.job where jobname = '<Name>'` (nach Name, ohne Fehler, wenn der Job fehlt). Den Zeitpunkt in der DB aus `now()` berechnen, in der Zeitzone von pg_cron. Den Text in ein Dollar-Quote-Tag mit Zufallsanteil setzen und vorher prüfen, dass das Tag im Restore-Text nicht vorkommt.
  2. Frist = größte Fensterdauer (Summe oben) plus Puffer, als Konstante aus denselben Werten wie die Timeouts.
  3. Vor dem Commit der Lockerung: Job angelegt und aktiv, gelesen aus `cron.job`, sonst kein Commit. Nach dem regulären Restore: Warten, bis kein Lauf des Jobs `running` ist, dann entfernen und prüfen, dass keine Zeile mehr da ist. Erst dann darf das nächste Fenster starten, sonst Fatal.
  4. Startprüfung zusätzlich: fehlgeschlagene Läufe von `redproof-restore-%` in `cron.job_run_details` seit dem letzten sauberen Lauf führen zu Exit 2.
  5. Etappe 2, Trockenlauf je Restore-Text im Soll-Zustand: Die Restores sind idempotent, ein Lauf im gesperrten Zustand ändert also nichts. Den echten Restore-Text als Totmann einplanen, feuern lassen, danach `status = succeeded`, Job entfernt, Soll unverändert. Das belegt Rolle, Rechte und `begin/commit` im Worker, bevor eine einzige Lockerung committet wird. Schlägt der Trockenlauf für eine Restore-Art fehl, entfällt der Totmann dafür und der Plan sagt das.
  6. `cron.schedule`/`cron.unschedule` der Totmann-Jobs und der Trockenlauf kommen in die SQL-Liste (iv).

**M-B `tmp/proof/r1-plan.md:101-104` (H-B) – Kopie und Download beim Deploy sind unvollständig festgelegt. Zwei Wege verändern trotzdem den Arbeitsbaum oder lesen geheime Dateien.**
- Probleme:
  - `:101` „kopiert `supabase/functions`“ aus dem Arbeitsbaum. Das erfasst auch ignorierte, nicht versionierte Dateien. `.gitignore:5` führt `supabase/functions/.env`. Eine Dateikopie liest sie (CLAUDE.md verbietet das auch über Skripte) und legt sie unter `tmp/` ab.
  - `config.toml` „soweit der Deploy sie braucht“: `supabase/config.toml:421-422` setzt für `quote` `verify_jwt = false`. Ohne `config.toml` sucht die CLI aufwärts und findet die Datei des Repos (dann deployt sie den ungelockerten Arbeitsbaum, der Test wird nicht rot), oder sie deployt mit Standard `verify_jwt = true`. Beides verfälscht den Lauf.
  - „Ref der Kopie und `DEV_REF` identisch“: `supabase/.temp/` ist ignoriert (`.gitignore:21`). Eine Kopie aus `git archive` hat keine Ref-Datei, die Prüfung ist so nicht definiert. Die eigentliche Bindung ist `--project-ref` zusammen mit `SUPABASE_PROJECT_ID`, das `dev-guard.mjs:22` für Kindprozesse setzt. Zugleich bricht der Guard ab, sobald `SUPABASE_WORKDIR` gesetzt ist (`dev-guard.mjs:18`). Die Kopie darf also nur über `cwd` des Kindprozesses gewählt werden.
  - `:104` „`supabase functions download quote`“ schreibt in das Verzeichnis `supabase/functions/quote` des Arbeitsverzeichnisses. Im Repo ausgeführt, überschreibt es den Arbeitsbaum, nach einem Abbruch sogar mit dem gelockerten Stand. Genau das sollte H-B ausschließen.
  - `deploy`-Restore „aus frischem `git archive HEAD`“: HEAD kann sich zwischen Abbruch und Restore ändern (Beks committet). Dann wird ein anderer Stand deployt als der, der vorher auf Dev lag und geprüft wurde.
- Fix:
  1. Die Kopie für den gelockerten Deploy wie für den Restore nur über `git archive <commit> -- supabase/functions supabase/config.toml`, entpackt in ein neues Verzeichnis unter `tmp/`. Nie eine Dateikopie aus dem Arbeitsbaum. `config.toml` ist Pflicht. Den Deploy-Befehl mit `cwd` = Kopie starten, `--project-ref` aus der exportierten Konstante von `dev-guard.mjs` (nicht neu getippt), dazu die Umgebung des Guards. Vorher prüfen, dass in der Kopie kein `supabase/.temp` liegt. Die Ref-Gleichheit aus `:101` durch diese Prüfung ersetzen.
  2. Die Markierung vom Typ `deploy` speichert die Commit-ID, die vor Teil 2 als „Dev = HEAD“ belegt wurde. Der Restore deployt genau diesen Commit, nicht das aktuelle HEAD.
  3. `functions download` nur mit `cwd` in einem eigenen leeren Verzeichnis unter `tmp/`. Danach prüfen, dass `git status --porcelain -- supabase` leer ist.
  4. Vor und nach Teil 2 zusätzlich die Einstellungen der Function prüfen (`verify_jwt`, Entrypoint) über `functions list` bzw. die Management-API, Werte im Bericht.
  5. Die gelockerte Kopie nach dem Restore löschen. Ihr Verzeichnisname enthält „gelockert“.

**M-C `tmp/proof/r1-plan.md:107` (M-1), `:119` (N-3), `:110` (M-4b) – `redproof-restore.mjs` ist der einzige Weg von Hand, aber in vier Punkten offen.**
- Probleme:
  - Sperrdatei: Nach einem harten Abbruch bleibt `tmp/proof/redproof.lock` liegen (`:119`), jeder Start endet mit Exit 2. Der Plan sagt nicht, wer sie entfernt. Läuft der ursprüngliche Prozess noch im Hintergrund (M-4a), würde ein Restore parallel zum laufenden Redproof arbeiten.
  - Totmann-Jobs: Der Start bricht bei jedem `redproof-restore-%`-Job ab und verweist auf das Restore-Skript (`:110`). `:107` sagt aber nicht, dass das Skript diese Jobs entfernt.
  - Aufruf: „`redproof-restore.mjs <Markierung>` … führt alle Markierungen LIFO aus“. Ein Argument und „alle“ passen nicht zusammen. Wird nur die äußere Markierung (Cron-Pause) übergeben, liefe sie vor der inneren.
  - Schreibender Lauf ohne Bindung ans kanonische Soll: M-5 verlangt sie nur für die Redproof-Läufe.
- Fix: Das Skript arbeitet ohne Argument (oder verweigert, wenn das Argument nicht die oberste Markierung ist). Es legt die Sperre selbst an. Liegt schon eine vor, liest es die darin gespeicherte PID und bricht ab, solange der Prozess lebt. Ist er tot, übernimmt es die Sperre. Es verlangt das kanonische Soll ohne Änderung gegenüber HEAD (wie M-5) und einen sauberen Stand von `supabase/functions` (H-B 3). Es arbeitet die Markierungen LIFO ab, die Cron-Wiederaufnahme erst nach Soll-Gleichheit bis auf die Cron-Zeile (M-2), `deploy` aus der gespeicherten Commit-ID (M-B 2). Danach entfernt es die Totmann-Jobs (wie M-A 3), prüft gegen das Soll, löscht die Markierungen und zuletzt die Sperre. Die Reihenfolge der Markierungen ergibt sich aus einer laufenden Nummer im Dateinamen, nicht aus der Dateizeit. Unit-Tests: zwei Markierungen ergeben innen, dann außen; lebende PID in der Sperre ergibt Abbruch ohne Executor-Aufruf.

### Niedrig

**N-1 `tmp/proof/r1-plan.md:118` (N-2) – Auf dem Abbruchweg scheitert der Constraint-Restore planmäßig.** „Testkonten werden vor dem Restore gelöscht“ geht nur im normalen Ablauf. Der Exit-Handler arbeitet synchron (N-9 der Runde 1), der Totmann nur mit SQL. Hat vitest im Fenster von `request_contacts_format` eine verletzende Zeile committet, scheitern beide mit 23514. Fix: Den Fall im Plan nennen. Entweder enthält der Restore-Text dieses Schritts vor dem `add constraint` ein Löschen genau der verletzenden Zeilen von `redproof-%`-Konten (nur wenn keine Sperre der Tabelle das verhindert; in Etappe 2 per Probe-Transaktion prüfen), oder der Fall endet bewusst in Fatal und der Totmann entfällt für diesen Schritt.

**N-2 `tmp/proof/r1-plan.md:97` – „Jede Änderung muss einer neuen Migration zugeordnet sein“ hat kein prüfbares Kriterium.** Fix: Die Zuordnung gilt als belegt, wenn die letzte Fundstelle des geänderten Schlüssels in einer Migration liegt, die neuer ist als der `migrations`-Stand im Kopf der eingecheckten Soll-Datei. Sonst Exit 2.

**N-3 `tmp/proof/r1-plan.md:96` gegen `:18` – Der Objektbericht braucht den Ausdruckstext.** `:18` verbietet Policy- und Funktionstext in der Ausgabe. Für eine Zeile „abweichend“ muss der Berater aber beide normalisierten Ausdrücke sehen. Postgres schreibt Ausdrücke um (`in (…)` wird `= ANY (ARRAY[…])`, `(select auth.uid())` bekommt `AS uid`), daher wird es viele solche Zeilen geben. Fix: Die Regel aus `:18` gilt für die Laufzeitausgabe der Lib. `r1-soll-objekte.md` enthält bei jeder Zeile außer „gleich“ beide Ausdrücke. Die Texte stehen ohnehin in den Migrationen im Repo, enthalten also kein Geheimnis.

**N-4 `tmp/proof/r1-plan.md:133` – Die Unit-Tests für die neuen Teile fehlen in der Liste.** Genannt sind M-2, M-3, M-4, M-5, M-8, N-1, N-3, N-5. Es fehlen: Totmann (Aufbau des Befehls, Entfernen, Job schon weg gilt als erledigt), Deploy aus der Kopie (kein Schreibzugriff unter `supabase/`, `cwd` = Kopie, Ref aus dem Guard), `redproof-restore.mjs` (M-C), Parser für `--verify-migrations` (H-A-Rest 3). Zudem ist „Unverändert:“ in `:133` missverständlich, gemeint ist „bleibt im Plan“. Fix: Die Liste ergänzen und das Wort ersetzen.

**N-5 `tmp/proof/r1-plan.md:128` (Q1) – Trigger außerhalb von `public` fehlen im Snapshot.** Der Trigger auf `auth.users`, der `handle_new_user` aufruft (`docs/ARCHITECTURE.md:82`), und die Trigger auf `storage.objects` sind nicht erfasst. Fix: Trigger aller Tabellen in `public` sowie die auf `auth.users` und `storage.objects` aufnehmen, mit `tgenabled` und Definition.

**N-6 `tmp/proof/r1-plan.md:125` (N-9) – `redproof-cleanup.mjs` kann Fixtures eines laufenden Laufs löschen.** Ein Volllauf von s9a4 dauert über eine Stunde, Konten älter als 1 Stunde können also noch in Gebrauch sein. Fix: Das Skript bricht ab, solange eine Sperre mit lebender PID oder eine Markierung vorliegt.

## Prüffrage 1: Stand der Runde-1-Funde

| Fund | Stand | Begründung |
|---|---|---|
| H-A | teilweise | Fix 2 bis 4 übernommen (`:96-97`). Es fehlt die Gegenrichtung für entfernte Objekte (H-A-Rest). |
| H-B | weitgehend | Arbeitsbaum unverändert, Typ `deploy`, Git-Prüfung ohne Angebot zum Committen, Deploy-Stand vorher und nachher, Teil 2 entfällt notfalls. Offen: Kopierweg, `config.toml`, Ort des Downloads, Commit-ID (M-B). |
| M-1 | teilweise | Skript mit Guard vorhanden. Sperre, Totmann-Jobs und Aufruf offen (M-C). |
| M-2 | behoben | LIFO, Wiederaufnahme der Cron-Pause erst nach Soll-Gleichheit, Fatal lässt den Job pausiert, Unit-Test (`:108`). |
| M-3 | behoben | Direkter Start, Baum beenden vor dem Restore, Unit-Test (`:109`). |
| M-4 | teilweise | (a) und (c) behoben. (b) Totmann mit Lücken (M-A). |
| M-5 | behoben | Abweichendes Soll nur lesend, sonst kanonisch und unverändert (`:111`). Für das Restore-Skript ergänzen (M-C). |
| M-6 | behoben | (a) bis (d) übernommen (`:112`). |
| M-7 | behoben | Warteschlange, Frist und Sperrminuten (`:113`). Der Wert wird in Etappe 2 bestimmt. |
| M-8 | behoben | Diff mit genau den deklarierten Schlüsseln, sha256 in Probe und Commit (`:114`). |
| N-1 | behoben | `begin … commit`, Constraint per `drop if exists` und `add`, Unit-Test (`:117`). |
| N-2 | teilweise | SQLSTATE behoben. Löschen der Testkonten geht nur im normalen Ablauf (N-1 hier). |
| N-3 | teilweise | Sperrdatei vorhanden. Eine übrig gebliebene Sperre nach hartem Abbruch ist ungeregelt (M-C). |
| N-4 bis N-8 | behoben | `:120-124`. |
| N-9 | behoben, mit Zusatz | Warnung und Aufräumskript. Schutz vor laufendem Lauf fehlt (N-6 hier). |
| Q1 | behoben, mit Zusatz | Umfang erweitert (`:128`). Trigger auf `auth.users` und `storage.objects` fehlen (N-5 hier). |
| Q2 | behoben | `:129`. |
| Q3 | wie H-B | M-B. |
| Q4 bis Q7 | behoben | Über M-6, M-2/M-3/M-4c, M-5, M-8. |

## Prüffrage 2: Neue Lücken durch den Nachtrag

- **pg_cron-Totmann:** Lücken siehe M-A. Fail-open ist nur der Fall „Job bleibt nach gescheitertem Restore stehen und feuert ein Jahr später mit veralteter Definition“. Die übrigen Fälle sperren früher als geplant oder fallen auf die Markierung zurück, sind also sicher.
  - Schreibrechte: nicht belegt, daher der Trockenlauf im Soll-Zustand (M-A 5).
  - Reihenfolge zur Cron-Pause: richtig.
  - Feuert der Job vor dem regulären Restore, wird der Test grün und der Schritt FEHLER. Die Lib muss den schon entfernten Job tolerieren und einen noch laufenden abwarten.
- **Deploy aus der Kopie:**
  - Auth: Das Zugangstoken der CLI hängt nicht vom Arbeitsverzeichnis ab. Kein Fund, solange keine Umgebung ausgegeben wird.
  - Ref-Bindung: über `--project-ref` und `SUPABASE_PROJECT_ID` aus dem Guard tragfähig. Die „Ref der Kopie“ ist nicht definiert (M-B).
  - Windows: `cwd` statt `SUPABASE_WORKDIR` ist Pflicht, weil der Guard sonst abbricht. `git archive` mit `tar` gibt es unter Windows 11. Ein übrig gebliebenes Verzeichnis unter `tmp/` ist ignoriert und ungefährlich, muss aber eindeutig benannt sein.
  - Neue Lücken: Dateikopie mit `.env`, `config.toml` optional, `functions download` im Arbeitsbaum (M-B).
- **Migrations-Gegenprüfung:**
  - Für Funktionen belastbar, weil `prosrc` wörtlich gespeichert wird.
  - Für Policies, Constraints, Defaults und Trigger nur in eine Richtung (H-A-Rest). Wegen der Umschreibung durch Postgres wird es viele Zeilen „abweichend“ geben, die von Hand zu lesen sind (N-3).
  - ACL, Spalten-ACL und Funktionsrechte prüft nur die Matrix (`docs/ARCHITECTURE.md:51-88`). Sie ist aus den Migrationen abgeleitet, also unabhängig von Dev, und fein genug (Spalten-Grants in Klammern, `service_role` je Tabelle). „Standard“ bei `service_role` (`:49`, `:68`) heißt alle Rechte. Dort kann ein Rest-Grant nichts hinzufügen.
  - `platform_settings`-Schlüssel kommen aus `supabase/seed.sql:108` ff. Ein fehlender Schlüssel (Rest von `redproof-s9a4.mjs:221`) wirkt fail-closed (`…0020_photo_staging.sql:6`). Kein eigener Fund, aber ein Abgleich gegen die Seed-Schlüssel kostet wenig.
- **`redproof-restore.mjs`:** siehe M-C.

## Prüffrage 3: Bleibt H-A hoch?

Entscheidung: **In der Fassung des Nachtrags hoch. Mit dem Gegenvorschlag mittel.** Eine reine Migrations-DB ist dann nicht nötig.

- Begründung hoch: Der Zweck von H-1 ist, Reste der alten Läufe zu finden. Ein Teil dieser Reste besteht aus entfernten Objekten (Trigger-Drops in s9a1 und s9a2, Constraint-Drop in s9a3). Genau diese Klasse sieht die einseitige Prüfung nicht, und die Trigger-Prüfung auf `O` ebenso wenig. Die Verhaltensprobe deckt sie nur ab, wenn der Schritt damals einen vitest-Test hatte.
- Gegenvorschlag (H-A-Rest, Fix 1 bis 3): Netto-Bestand aus den Migrationen in beiden Richtungen, Zielliste aller von s9a1 bis s9a4 berührten Schlüssel, Unit-Tests für den Parser. Zusammen mit dem md5-Abgleich der Funktionen, dem Matrixabgleich für Rechte und `test:rls`/`live-uploads` als Verhaltensprobe ist jede Lockerungsart der alten Skripte durch eine Quelle geprüft, die nicht Dev ist.
- Restrisiko mittel: Ein von den Migrationen abweichender Dev-Zustand, den kein altes Skript erzeugt hat und der normalisiert gleich aussieht. Er bleibt als H-1-Rest in OPEN_ISSUES. Vor GOLIVE schließt ihn ein Snapshot-Vergleich gegen das frisch aus Migrationen aufgebaute Produktionsprojekt (dieselbe `SNAPSHOT_SQL`, nur lesend), ohne zusätzliches Projekt.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `tmp/proof/r1-plan.md:96` | Prüfung nur für Objekte „im Umfang“ (Dev-Snapshot), keine Gegenrichtung. Bestätigt (H-A-Rest). |
| `tmp/proof/r1-plan.md:101` | Kopie aus `supabase/functions` des Arbeitsbaums, `config.toml` nur „soweit nötig“. Bestätigt (M-B). |
| `tmp/proof/r1-plan.md:104` | `functions download` ohne Angabe des Arbeitsverzeichnisses. Bestätigt (M-B). |
| `tmp/proof/r1-plan.md:107` | Ein Argument, aber „alle Markierungen“. Bestätigt (M-C). |
| `tmp/proof/r1-plan.md:110` | Selbstentfernung über die eigene jobid, Frist „Timeout + Puffer“. Bestätigt (M-A). |
| `tmp/proof/r1-plan.md:77` | (iv) nennt nur `cron.alter_job`, keine Totmann-Jobs. Bestätigt (M-A 6). |
| `scripts/redproof-s9a1.mjs:41`, `scripts/redproof-s9a2.mjs:84` | Lockerung per `drop trigger`. Bestätigt. |
| `scripts/redproof-s9a3.mjs:198-200` | Lockerung per `drop constraint request_contacts_format`. Bestätigt. |
| `scripts/redproof-s9a3.mjs:336`, `:344` | Heute: Deploy ohne `--project-ref`, gelockerter Handler wird in den Arbeitsbaum geschrieben. Der Plan löst das ab. |
| `scripts/redproof-s9a4.mjs:221` | Löscht den Schlüssel `photo_staging_hours` (in der Probe-Transaktion). Ein Rest wäre fail-closed. |
| `scripts/redproof-s9a4.mjs:471`, `:562` | Default und Funktion `become_rental_provider` als Zusatzobjekte. Die Prüfung Dev → Migration erfasst sie als „nicht gefunden“. Kein Fund. |
| `scripts/dev-guard.mjs:18`, `:22` | `SUPABASE_WORKDIR` führt zum Abbruch, `SUPABASE_PROJECT_ID` wird für Kinder auf Dev gesetzt. Grundlage für M-B 1. |
| `supabase/config.toml:421-422` | `[functions.quote]` mit `verify_jwt = false`. Bestätigt (M-B). |
| `.gitignore:5`, `:14`, `:21` | `supabase/functions/.env`, `tmp/` und `supabase/.temp/` sind ignoriert. Bestätigt (M-B). |
| `supabase/seed.sql:108` | `photo_staging_hours` kommt aus dem Seed, nicht aus einer Migration. |
| `supabase/migrations/…0020_photo_staging.sql:6` | Fehlender Schlüssel ergibt `setting_missing` (fail closed). |
| `docs/ARCHITECTURE.md:49`, `:68` | `service_role` „Standard“ = alle Rechte. Ein Rest-Grant dort ändert nichts. |
| `docs/ARCHITECTURE.md:82` | `handle_new_user` als Trigger-Funktion. Ihr Trigger auf `auth.users` fehlt im Umfang (N-5). |

Offene Findings hoch: 1
