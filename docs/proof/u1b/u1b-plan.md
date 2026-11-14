# Plan u1b (Kennung u1b-1411-a): Schranken abdichten

Dateien: `.claude/hooks/guard.mjs`, `scripts/sys/{gate-db.mjs, gate-db-lib.mjs, fertig.mjs, run.mjs}`, neu `scripts/sys/{gate-loesch.mjs, gate-loesch-lib.mjs(+.d.mts), loesch-register.json, fixtures/guard-probe.mjs}`, `tests/support/sweep.ts`, `package.json` (Skript `loesch`), `tests/unit/sys-*.test.ts`.

## a) M16 Marke bindet Inhalt
- Stand: Freigabe-Prüfung in gate-db push und fertig vergleicht schon Pfad + SHA-256 der Datei. Lücke ist die Marke `db-push` in runs.jsonl: sie speichert nur Pfade; `fertig` prüft `dbPushes.some(p => p.migrationen.includes(m.pfad))`. Eine Migration, die nach dem Push geändert wurde, behält ihre Marke.
- Neu: `db-push-geplant.json` und die Marke speichern `{pfad, sha256}`. `marke` bricht ab, wenn der SHA der Datei nicht mehr dem beim Push-Gate entspricht (Änderung während des Pushs). `fertig`: Marke zählt nur bei gleichem Pfad UND gleichem SHA-256 wie die Datei im Commit. Altes Format (Zeichenketten) wird nicht mehr akzeptiert (keine Rückwärtskompatibilität).

## b) M17 Pipe
Guard liest die Trennzeichen zwischen den Segmenten mit. Verweigert wird:
- `psql` als Programm (immer; die Entwicklung nutzt es nicht).
- `supabase db query`, wenn das Segment nach einer Pipe steht, eine Eingabeumleitung `<`/`<<` hat oder Ersetzungen (`$…`, Backtick) im Argument trägt (SQL nicht prüfbar). Literales `select` bleibt erlaubt.
- ein Segment nach einer Pipe, dessen Programm eine Shell ist (`| bash`, `| sh`, `| powershell`, `| pwsh`, `| iex`): Befehl per Pipe an die Shell nicht prüfbar.

## c) M18 verschachtelte Shells
Segment mit Programm `bash|sh|zsh|dash|ksh` + `-c`/`-lc`, `powershell|pwsh` + `-Command`/`-c`/`-EncodedCommand` (Base64 UTF-16LE wird dekodiert), `cmd /c|/k`, dazu `iex`/`Invoke-Expression`/`eval "…"`: der Innentext wird entquotet und rekursiv durch dieselbe Prüfung geschickt (Tiefe höchstens 4; tiefer = verweigert). Damit gelten Testsperre, DB-Sperre, psql, Pipe-Regeln und die Lösch-Regeln auch im Innentext.

## d) Lösch-Gate
- Register `scripts/sys/loesch-register.json`: `skripte` (versionierte Skripte, die auf Dev löschen oder Status ändern) und `ausgenommen` (Pfad → Grund). Ein Unit-Test scannt `scripts/*.{mjs,ts}` (nicht sys/) und `tests/support/*.ts` nach Lösch-/Statusmustern (delete from, truncate, `.delete()` ohne Argument, `).remove(`, deleteUser, update … set, `.update(`, admin_set_*) und schlägt fehl, wenn ein Treffer weder in `skripte` noch in `ausgenommen` steht (neue Skripte fallen automatisch auf).
- Freigabe = Bericht von advisor-report (Format wie db-freigabe: Modell Fable, je Datei eine Zeile `SHA256: <hash> <pfad>`, `Urteil: frei`, `Offene Findings hoch: 0`), entsteht in `tmp/proof/<schritt>/loesch-freigabe-N.md`, wird per `cp` nach `docs/freigaben/` (versioniert) übernommen, damit sie Schritte überdauert. Gleiche Prüfung wie DB (`pruefePush`, Pfad + SHA).
- Festgelegter Befehl: `npm run loesch -- <skript.mjs> [Argumente]` (dotenv-Hülle wie db:push). `gate-loesch.mjs` prüft: Skript im Register, Freigabe mit aktuellem SHA, sonst Exit 1. Dann startet es das Skript als Kindprozess (env `MV_LOESCH_LAUF=<uuid>`), reicht die Ausgabe durch, liest Zeilen `LOESCH-ZAHL <name>=<n>`, schreibt `tmp/proof/<schritt>/loesch-lauf.jsonl` (Lauf-ID, Pfad, SHA, Argumente, Start, EXIT, Zahlen). `--trocken --freigaben <ordner> --register <json>` nur prüfen (Attrappe wie bei gate-db).
- `tests/support/sweep.ts` (Modul, läuft in `npm run t`): beide exportierten Funktionen rufen am Anfang `loeschFreigabe(import.meta.url)` (hasht die eigene Datei, sucht die Freigabe in `docs/freigaben/`, wirft sonst) und am Ende `loeschLog(…)` (Lauf-ID je Prozess, Zahlen: aktive/ungebundene Testfirmen, gelöschte Belegobjekte) in dieselbe jsonl. Geänderte sweep.ts ohne neue Freigabe: der rls-Lauf bricht ab.
- Guard: verweigert direkten Aufruf registrierter Skripte (`node scripts/x.mjs`, `deno`/`tsx`/`npx` mit Pfad, `npm run <alias>`, wenn das Skript in package.json auf ein Registerskript zeigt), `psql`, `supabase db query` mit schreibendem SQL (besteht). `cp` nach `docs/freigaben/` nur aus `tmp/proof/**/loesch-freigabe-N.md` und nur auf eine neue Datei; Write/Edit dorthin immer verweigert; `loesch-lauf.jsonl` Skriptdatei, `loesch-freigabe-*` Beraterdatei.
- `fertig`: Ist eine Registerdatei im Diff geändert, braucht ihr aktueller SHA eine Freigabe in `docs/freigaben/` (zweite Ebene für die .mjs-Skripte); `loesch-register.json` kommt in MUSS_ABNAHME.
- `run.mjs cmd`: erlaubt zusätzlich `gate-loesch.mjs … --trocken` (Proben).
- Freigabe jetzt nur für `tests/support/sweep.ts` (Auftrag). Die übrigen Registerskripte (live-*, redproof-*, storage-reset, setup-photo-*) brauchen bei erster Nutzung eine Freigabe: Fehlermeldung nennt Pfad und SHA.

## e) Proof-Lücke
`tmp/proof/u1/039-e2e.log` (rot, ERR_NO_BUFFER_SPACE) nach `docs/proof/u1/` kopieren (cp), OPEN_ISSUES S9i3-7 ergänzen.

## Tests (npm run check) und Proben (docs/proof/u1b/u1b-probe-<name>-N.log)
- Unit: sys-guard (neu: psql, Pipe Bash/PowerShell, bash -c, sh -c, powershell -Command, -EncodedCommand, cmd /c, Rekursion Test- und DB-Befehl, Lösch-Direktaufruf, docs/freigaben-Schutz; Gegenproben: `grep psql docs/x.md`, `git commit -m "delete psql"`, `echo "delete from x"`, `cat a | grep delete`), sys-gate-db (Marke mit SHA, Änderung nach Push), sys-fertig (Marke Pfad+SHA, Lösch-Registerdatei ohne Freigabe), neu sys-gate-loesch (Gate ohne Freigabe / geänderte Datei / passende Freigabe / Register-Vollständigkeit / sweep-Selbstprüfung).
- Proben als echte Läufe über `npm run t -- cmd node scripts/sys/fixtures/…`: Guard-Probe (feste Befehlsliste, Exit = Guard-Exit), Gate-Probe `--trocken`.

## Fragen an Fable
1. Ist das Register mit Vollständigkeits-Scan der richtige Zuschnitt für „jedes versionierte Skript, das auf Dev löscht oder Status ändert“? Dürfen die Test-Fixtures in `tests/support/` (partner.ts, db.ts, quote-rls.ts: löschen nur selbst angelegte Testdaten) unter `ausgenommen` stehen, sweep.ts aber nicht?
2. Reicht die Selbstprüfung in sweep.ts (Hash der eigenen Datei gegen `docs/freigaben/`) für den Testablauf, oder fehlt ein Bindeglied zu `npm run t`?
3. Freigabeort `docs/freigaben/` (versioniert, nur per cp aus der Beraterdatei): Gegenargumente? Was kann ein böswilliger oder fehlerhafter Hauptlauf noch am Gate vorbeischreiben (Umgehungswege, die wir im Guard schließen sollten, ohne ihn zur Sicherheitsgrenze zu erklären)?
4. M16: genügt die Bindung in `fertig` und `marke`, oder muss `db:push` selbst den SHA-Vergleich zwischen Gate und CLI erzwingen (TOCTOU zwischen `gate-db push` und `supabase db push`)?
5. Falschalarm-Risiko der Pipe-/Shell-Regeln (alles hinter `|` mit Shell-Programm verweigert, `db query` mit `<` oder `$`): akzeptabel?
