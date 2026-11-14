Modell: claude-fable-5-2
Entscheidung: ja mit Änderungen. Die Teile a, b, c und e tragen; Teil d (Lösch-Gate) braucht H1 bis H5 vor dem Bau.
Begründung: Die Freigabe bindet bisher nur den Text einer Datei, nicht das, was sie löscht, und der Freigabeort liegt außerhalb aller Gates. Im Guard fehlen die zwei Umgehungswege, die dieses Repo selbst schon benutzt hat: Skriptdateien und Statusfunktionen per `select`. Alle Aussagen stammen aus dem Lesen der Dateien; ausgeführt habe ich nichts, Git-Stände konnte ich nicht prüfen.

**Findings hoch**
- H1 – `C:\Users\gesch\Music\MoveNow\tests\support\sweep.ts:9,13-14,69-70` – Die Löschbedingung kommt aus `FIRM_MAIL_RE` und `COVER_FIRM` in `C:\Users\gesch\Music\MoveNow\tests\support\partner.ts:14,60`. Wer dort das Muster weitet, löscht mehr, ohne dass sich der SHA von sweep.ts ändert. `admin` wird in Zeile 64 und 69 ungeprüft ins SQL gesetzt, und Zeile 69-72 löscht Nutzer ohne Obergrenze (mit Cascade).
  - Fix: Marker in eine eigene `tests/support/marker.ts` legen und die Freigabe an sweep.ts plus marker.ts binden.
  - Fix: Ein Unit-Test prüft, dass sweep.ts nur die erwarteten relativen Importe hat. Dasselbe gilt je Registerskript über ein Feld `abhaengig` (z. B. `redproof-lib.mjs`, `redproof-sql.mjs`).
  - Fix: `admin` als UUID prüfen und eine Obergrenze wie in Zeile 32 setzen.
- H2 – `C:\Users\gesch\Music\MoveNow\.claude\hooks\guard.mjs:11,47-48` – `supabase db query "select public.admin_set_partner_status(...)"` und `do $$ ... $$` enthalten kein Sperrwort und gehen durch. Der Plan nennt diese Sperre „besteht“.
  - Fix: Die Liste um `do|merge|execute|perform|into|set|reset|lock|refresh|vacuum|comment|prepare` ergänzen.
  - Fix: Funktionsaufrufe `admin_\w+(`, `set_config(`, `setval(`, `cron.`, `net.`, `pg_terminate|pg_cancel`, `lo_`, `dblink` sperren.
  - Dauerhaft sauber wäre eine Nur-Lese-DB-Rolle für Abfragen; das gehört als Eintrag nach OPEN_ISSUES, nicht in u1b.
- H3 – `C:\Users\gesch\Music\MoveNow\scripts\sys\stufe.mjs:17`, `C:\Users\gesch\Music\MoveNow\scripts\sys\lib.mjs:22`, `C:\Users\gesch\Music\MoveNow\scripts\sys\fertig.mjs:14` – `docs/freigaben/` ist R0, unverfolgte Dateien unter docs/ zählen als „sauber“, und der Ordner fehlt in MUSS_ABNAHME. Eine Freigabe im Arbeitsbaum gilt also ohne Commit, ohne Stufe und ohne Abnahme.
  - Fix: Die Freigabe zählt nur aus dem Commit (`git show HEAD:&lt;pfad&gt;`, wie bericht.json in fertig.mjs:110).
  - Fix: Regel `^docs\/freigaben\/` als R3 vor `^docs\/` setzen und den Ordner in MUSS_ABNAHME aufnehmen.
  - Fix: `fertig` blockt M und D in diesem Ordner; `Edit(./docs/freigaben/**)` kommt in die deny-Liste.
- H4 – `C:\Users\gesch\Music\MoveNow\.claude\hooks\guard.mjs:50-73` – Teil c prüft nur Inline-Shells. Skriptdateien bleiben offen (`bash x.sh`, `./x.sh`, `. x.sh`, `pwsh -File x.ps1`, `.\x.ps1`, `cmd /c x.bat`). Genau so liefen frühere Läufe: `C:\Users\gesch\Music\MoveNow\tmp\cron-wait.sh:3` (`db query -f`) und `C:\Users\gesch\Music\MoveNow\tmp\proof\s9i-6-vollaeufe.ps1:1` (`npm run check`).
  - Fix: Der Guard liest die Skriptdatei und schickt den Inhalt durch dieselbe Prüfung; nicht lesbar heißt verweigert.
- H5 – Plan d, Register-Scan – Die Verbliste findet `C:\Users\gesch\Music\MoveNow\scripts\admin-call.mjs:16` nicht (Statusänderung über `fetch` POST an admin-correct, ohne dev-guard). `tests/rls/` wird gar nicht gescannt: Eine neue Testdatei mit `ownerSql('truncate ...')` läuft über `npm run t -- tests/rls/x.test.ts` an allem vorbei.
  - Fix: Zusätzlich nach Fähigkeit scannen: Import von dev-guard, Secret- oder Token-Variablen, `supabase.js`, `ownerSql`, `service`, `fetch` mit Authorization.
  - Fix: In `tests/rls` einen Massen-Lint einführen (`truncate`, `delete from` ohne `where`, `.delete()` ohne Gleichheitsfilter, `emptyBucket`) mit benannter Ausnahmeliste.
  - Fix: `tests/support/` in MUSS_ABNAHME aufnehmen und die Reichweite im Plan ehrlich benennen: Das Gate deckt Muster- und Massenlöschung ab, nicht jeden Test.

**Findings mittel**
- M1 – `C:\Users\gesch\Music\MoveNow\scripts\sys\gate-db.mjs:62,78` – `geplant` wird überschrieben. Wendet die CLI nur einen Teil an (das habe ich nicht geprüft, ich gehe von einer Transaktion je Migration aus), verliert die erste Migration ihre Marke und `fertig` blockt dauerhaft. Fix siehe Frage 4.
- M2 – `C:\Users\gesch\Music\MoveNow\scripts\sys\run.mjs:17` – Das Muster `includes('--trocken')` ist für gate-loesch unsicher, weil dort Skriptargumente durchgereicht werden. Fix: Gate-Optionen nur vor dem Skriptpfad, in run.mjs `s[1] === '--trocken'`, und `--freigaben`/`--register` nur mit `--trocken` (sonst Exit 2).
- M3 – `C:\Users\gesch\Music\MoveNow\scripts\sys\gate-db-lib.mjs:54` – `find` nimmt den ersten Treffer. Bei dauerhaft liegenden Freigaben muss „gesperrt“ für denselben Pfad und SHA gewinnen. Fix: alle Treffer prüfen.
- M4 – Teil b – Interpreter fehlen: `| node`, `node &lt;&lt;EOF`, `node -p`, `deno eval`, `tsx -e`, `python -c` (nur `node -e` ist gesperrt). Ebenso fehlen ein einzelnes `&amp;` als Trenner und die Präfixe `(`, `{`, `then`, `do`, `exec`, `env`, `$(`, Backtick. Pfadformen wie `node_modules/.bin/vitest`, `npm run-script`, `npm.cmd` und `"npm"` gehen auch durch.
- M5 – Supabase-CLI – Erlaubtliste statt Sperrliste: nur `migration list|new`, `gen types` und lesendes `db query`. Sonst bleiben `storage rm`, `functions delete`, `secrets unset`, `backups restore` und `--db-url` offen.
- M6 – `C:\Users\gesch\Music\MoveNow\tests\support\sweep.ts:48,81-83` – `loeschFreigabe` muss vor dem `try` stehen, sonst schluckt `final` den Fehler als Warnung.
- M7 – `C:\Users\gesch\Music\MoveNow\.claude\settings.json:7,68` – Der Hook-Matcher kennt keine MCP-Werkzeuge, die Sperre hängt an einer Server-ID. Fix: Matcher um `mcp__.*` erweitern und Namen wie `execute_sql` und `apply_migration` verweigern. `npm run loesch` gehört in die ask-Liste.
- M8 – `C:\Users\gesch\Music\MoveNow\.claude\hooks\guard.mjs:67` – Das Ziel ist das letzte Wort; `cp -t`, `Copy-Item -Destination`, ein angehängtes `2&gt;&amp;1`, `robocopy` und `git mv` treffen es nicht. Fix für `docs/freigaben`: umkehren. Jedes Segment mit diesem Pfad wird verweigert, außer genau der cp-Form und Leseprogrammen.
- M9 – Teil c – `-EncodedCommand` flach verweigern statt dekodieren. Den Innentext grob entquoten (alle Anführungszeichen und Escapes entfernen, neu prüfen) statt genau zu parsen. Shell-Programm am Basisnamen erkennen (`bash.exe`, Pfad in Anführungszeichen, `-lc`, `-Com`, `cmd /d /s /c`).
- M10 – Der Guard liest künftig Register und package.json. Bei kaputtem JSON darf nur der betroffene Aufruf (`node`, `npm run`) verweigert werden, nicht jeder Befehl.

**Antworten**
1. Der Zuschnitt stimmt, aber der Scan nach Verben reicht nicht (H5). `partner.ts`, `db.ts`, `quote-rls.ts` und `owner.ts` dürfen unter `ausgenommen` stehen, weil sie über selbst angelegte IDs oder die Lauf-ID löschen. Bedingung: Jeder Eintrag trägt Grund und SHA-256, damit eine Änderung den Unit-Test rot macht. sweep.ts bleibt Registerskript, weil es über ein Muster quer durch alle Läufe löscht.
2. Die Selbstprüfung reicht nicht. Es fehlen drei Dinge:
   - die Bindung der Abhängigkeiten (H1);
   - das Bindeglied zum Startprogramm: `run.mjs` setzt `MV_LAUF=&lt;schritt&gt;/&lt;nr&gt;`, `loeschFreigabe` verlangt die Variable, `loeschLog` schreibt sie mit;
   - ein fester `PROOF_ROOT` für das Log und ein Zwischenspeicher je Prozess.
3. `docs/freigaben/` geht nur mit H3; sonst wäre `scripts/sys/freigaben/` der bessere Ort. Dateiname mit Schritt, z. B. `&lt;schritt&gt;-loesch-freigabe-N.md`. Der allgemeine Rest „Datei schreiben, dann ausführen“ (`node tmp/x.mjs`) ist im Guard nicht schließbar; dagegen hilft nur die Freigabe aus HEAD (Commit ist ask) und die Selbstprüfung als erste Zeile jedes Registerskripts. Umgehungswege siehe H2, H4, M4, M5, M7, M8.
4. Ja, erzwingen, aber durch Zusammenlegen: `gate-db push` prüft, startet die CLI selbst, hasht danach neu und liest die Liste neu. Es schreibt die Marke `{pfad, sha256}` je tatsächlich angewendeter Migration, auch bei CLI-Fehler. Der Modus `marke` und `db-push-geplant.json` entfallen. Ein abweichender SHA gibt keine Marke und eine Meldung mit Rettungsweg.
5. Akzeptabel, mit zwei Feinheiten. `&lt;` nur am maskierten Text prüfen, sonst schlägt `where a &lt; 3` falsch an. `$` nur außerhalb einfacher Anführungszeichen prüfen.

**Zusätzliche Testfälle**
- Guard verweigert:
  - `bash tmp/x.sh` und `pwsh -File tmp/x.ps1`, jeweils mit gesperrtem Inhalt;
  - `sleep 1 &amp; npm run check`, `if true; then npm run check; fi`, `(npm run check)`, `eval npm run check`;
  - `bash -c "bash -c \"npm run check\""`, `cmd /d /s /c "echo a &amp; npm run check"`;
  - `node_modules/.bin/vitest run`, `echo x | node`;
  - `supabase db query "select public.admin_set_partner_status('a','b','suspended','x')"`, `supabase db query "do $$ begin null; end $$"`, `supabase storage rm`;
  - `node SCRIPTS/Storage-Reset.mjs`, `cd scripts &amp;&amp; node storage-reset.mjs`;
  - `cp -t docs/freigaben x`, `git mv a docs/freigaben/b`.
- Guard lässt durch: `supabase db query "select 1 where 2 &lt; 3" --linked`, `bash -c "ls"`, Write auf `scripts/sys/fixtures/**/loesch-freigabe-1.md`.
- Gate und Lib:
  - marker.ts geändert, sweep.ts unverändert: sweep wirft;
  - Freigabe nur im Arbeitsbaum, nicht in HEAD: wirft;
  - `final=true` ohne Freigabe: wirft, `ownerSql` wird nicht aufgerufen;
  - `admin` keine UUID: wirft;
  - „gesperrt“ neben „frei“ für denselben SHA: blockiert;
  - ausgenommene Datei mit neuem SHA: Register-Test rot;
  - `--register` ohne `--trocken`: Exit 2;
  - `gate-loesch.mjs skript.mjs --trocken` über `cmd`: abgelehnt.
- DB und fertig:
  - Teil-Push in der Attrappe (1 angewendet, 2 gescheitert, 2 korrigiert): beide Marken vorhanden;
  - Migration nach dem Push geändert: blockiert; zurückgeändert: gültig;
  - Marke im alten Format: zählt nicht;
  - Commit nur mit `docs/freigaben`: R3.

**Risiken, die die Hauptsession testen muss**
- `import.meta.url` und die Pfadform unter vitest auf Windows, in einem echten rls-Lauf.
- CRLF gegen LF beim Hash der Arbeitsdatei.
- Ob im Diff gegen origin/main Migrationen mit Marken im alten Format liegen; die wären dauerhaft blockiert.
- Ob der Push genau einen bericht.json enthält, falls u1 noch nicht auf main liegt (`C:\Users\gesch\Music\MoveNow\scripts\sys\fertig.mjs:143`).
- Vor dem cp in Teil e: `npm run scan:proof` mit Exit 0.
- In der Dateiliste des Plans fehlen `stufe.mjs`, `fertig.d.mts`, `.claude/settings.json` und `tests/support/marker.ts`.

Offene Findings hoch: 5
