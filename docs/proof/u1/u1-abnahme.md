Modell: claude-fable-5-2
SHA256: e134f0e25c4aa2d6973e3125b38711f7e491740257a8b025febd4736dcbf3d72 .claude/hooks/guard.mjs
SHA256: c2bbaa60e25c674821d13005d70f24d74f36f83fe1b273c0af8d58469d3e16f1 .claude/hooks/session.mjs
SHA256: 36121739caa69343214a2a0fe7d0ca0f0bdcae55076a1fb9b6de9170196dcdae scripts/sys/run.mjs
SHA256: e96107c05338ba981636aa6d3651beecdb1962912542569b735dfe4aaec4ac2b scripts/sys/lib.mjs
SHA256: a237eab9f2cd551dafcef95aaa684bd9554ad0fa0a3021ce7ee9bd347fc8e151 scripts/sys/fingerabdruck.mjs
SHA256: 4eeefe7a8db994d69300c234c16a4a20bbb1ce4656cdc6f3e7a0cf6d751d750d scripts/sys/stufe.mjs
SHA256: 4d30ae158f24d310ba9ad7a399004380d603808c52bb330649f5074f1eb21c84 scripts/sys/gate-db-lib.mjs
SHA256: 58eba48c4f95f7f13c7e57738f5cee30d83eff002a48bc77ea4b15dea71427c9 scripts/sys/gate-db.mjs
SHA256: a4844cbc23365ebae28b8c0ff56c29d7fb117459f441b0075b14a15c1b542981 scripts/sys/fertig.mjs
SHA256: 1a5df45bb268133c495fb9b3d947d37028799baac1ca948c1c9bbe8d6d40d4b8 scripts/sys/bericht.mjs
SHA256: 5f9db17ce9332a9a7141951f5a88ddf1c89cd763fd938c57669b69e1c7da2c31 scripts/sys/start-schritt.mjs
SHA256: 4bd54346d3cd50b6670cf2ee0a4e4e38301ee4656b4ca6978c303abcb4fbed79 .githooks/pre-push
SHA256: 4cce80aa92a8483336c0a1c2ea99bd27dbb48dc29629144eddc2b7bbc8a3523d package.json
SHA256: 9ecca69d24529e143728428985334437c7f375e2c90ae9fa3eac3ee3969108a7 .claude/settings.json

# Abnahme u1 (Kennung u1-1411-a) · Gates und Hooks · Kontrollrunde 2

Datum: 2026-11-14. Entscheidung: abgenommen, kein hohes Finding offen. H1 und H2 sind behoben, M1 bis M15 sind behoben (M13 mit einem Rest für Beks). Drei neue mittlere Findings (M16 bis M18) betreffen spätere Schritte, nicht den Merge von u1; sie sind Auflagen mit Frist (siehe dort).

Umfang: die 14 Dateien oben nach Commit 18a841a (für `.claude/settings.json` der Entwurf `tmp/proof/u1-settings-entwurf.json`, verglichen mit der heutigen Vorgängerdatei), dazu `tests/unit/sys-guard.test.ts`, `sys-gate-db.test.ts`, `sys-fertig.test.ts`, `sys-docs-importe.test.ts`, Stellen aus `sys-run.test.ts` und `sys-stufe.test.ts`, `docs/BEKS_EINRICHTUNG.md`, `CLAUDE.md:3-8`, `docs/OPEN_ISSUES.md:5-13`, `scripts/dev-guard.mjs`, `tmp/proof/u1/runs.jsonl`, `db-antrag-1.json`, `db-push-geplant.json`. Maßstab: mein Bericht der Runde 1 und der Antrag der Runde 2.

Grenzen dieser Prüfung
- Nur Read, Grep, Glob, Write. Kein Befehl ausgeführt, kein Test gestartet, kein Hash nachgerechnet, keine Doku im Netz abgerufen. Die SHA-Zeilen sind aus dem Antrag abgeschrieben; ob die gelesenen Bytes dazu passen, belegt erst der Vergleich in `fertig`.
- `.claude/settings.local.json` nicht gelesen. Aussagen dazu, was ohne Nachfrage läuft, stützen sich nur auf den Entwurf.
- Das eingebaute advisor-Tool steht weiter in meiner Tool-Liste. Nicht benutzt, keine Subagents gestartet.
- Die Volläufe auf dem Endstand stehen noch aus: `runs.jsonl:30-31` sind check-Läufe mit `sauber: false` auf fd44b61, sie zählen nicht. Das ist Sache von `fertig`, nicht dieser Abnahme.

## Findings hoch

Keine.

## Findings mittel

M16 · `scripts/sys/gate-db.mjs:62-64,78`, `scripts/sys/fertig.mjs:43-45` – Die Marke `db-push` bindet nur den Pfad, nicht den Inhalt, und der Modus `push` überschreibt die Vormerkung. Zwei Folgen. (a) Fälschlich grün: Migration wird gepusht (Marke mit Pfad), danach in der Datei geändert (etwa nach einem Fund der Abnahme), neue Freigabe für den neuen Hash; `db:push` meldet 0 offene, der rls-Lauf läuft gegen den alten Stand auf Dev, `fertig` findet Freigabe und alte Marke und lässt durch. Auf main liegt dann ein Inhalt, der nie auf Dev lief. (b) Dauerhaft blockiert: Push von zwei Migrationen, die erste wird angewendet, die zweite scheitert; beim zweiten Versuch enthält die Vormerkung nur noch die zweite, die erste bekommt nie eine Marke und kann nie wieder offen sein. – Fix: Vormerkung und Marke als Liste aus Pfad und SHA-256 zum Zeitpunkt der Gate-Prüfung; Modus `push` vereinigt mit der bestehenden Vormerkung (offene Einträge ersetzen ihren alten Hash, nicht mehr offene bleiben), Modus `marke` schreibt alle und löscht die Vormerkung; `fertig` verlangt je neuer oder geänderter Migration eine Marke mit gleichem Pfad und gleichem Hash. Tests: Änderung nach dem Push blockiert; Teil-Push ergibt nach dem zweiten Versuch Marken für beide. Frist: vor dem ersten Schritt mit einer Migration. u1 selbst hat keine Migration (`db-antrag-1.json:1`). Bis dahin gilt als Textregel: eine gepushte Migration wird nicht mehr geändert, Korrekturen kommen als neue Migration.

M17 · `.claude/hooks/guard.mjs:47-48` – Die SQL-Regel sieht nur SQL, das wörtlich im Befehl steht, und sperrt unsichtbaren Inhalt nur bei den Datei-Schaltern. Nicht gesperrt: SQL über eine Pipe (`Get-Content tmp/x.sql | supabase db query --linked`), über die Eingabe-Umleitung mit einfachem Kleiner-Zeichen, über Befehlsersetzung im Argument (`"$(cat tmp/x.sql)"`) oder über eine Variable. Die ersten beiden gelten, sofern `db query` von stdin liest; der Heredoc-Fall in `sys-guard.test.ts:43` setzt das voraus. Die `ask`-Regeln für `supabase db` fragen Beks in beiden Shells, er sieht aber den Inhalt nicht. – Fix: Positivregel statt Wortliste allein: `db query` nur mit genau einem wörtlichen SQL-Argument in Anführungszeichen (oder Heredoc), ohne Dollarzeichen, Backtick und Klammerausdruck im Argument, ohne Pipe in den Befehl und ohne Eingabe-Umleitung; die Wortliste bleibt zusätzlich. Tests für die vier Formen, je Bash und PowerShell.

M18 · `.claude/hooks/guard.mjs:28,57` – Rückschritt durch die Maskierung (Fix zu N1): Die Regeln für `db push`, `db reset`, `migration …` und `db query` prüfen den maskierten Text. Steht der Befehl in Anführungszeichen einer Hülle (`bash -c "…"`, `powershell -Command "…"`, `cmd /c "…"`, `Invoke-Expression '…'`) oder ist der Programmpfad selbst gequotet (`& "node_modules/.bin/supabase.cmd" db push`), ist er unsichtbar. In Runde 1 traf die Regel den rohen Text. Die `ask`-Regeln greifen bei diesen Formen nicht (anderer Befehlsanfang); im Auto-Modus entscheidet dann der Klassifizierer. Das Merge-Gate fängt einen so gepushten Stand ab (keine Marke), die Dev-Datenbank ist dann aber schon geändert. – Fix: Segmentgrenzen weiter aus der Maske, die Datenbank-Regeln aber auf dem rohen Segment prüfen, außer das Programm trägt nur Text (`git commit`, `git tag`, `grep`, `rg`, `echo`, `Select-String`, `Write-Output`). Tests: die fünf Formen oben verweigert, die drei Durchlass-Fälle aus `sys-guard.test.ts:118-120` bleiben grün. Frist für M17 und M18: vor dem Auto-Modus (`docs/BEKS_EINRICHTUNG.md:30-37`) und vor dem Entfall von `ask`-Regeln (`:69`).

## Findings niedrig

N19 · `.claude/hooks/guard.mjs:61` – Der Schlüssel wird mit Groß- und Kleinschreibung verglichen, Git selbst unterscheidet nicht: `git config core.hookspath x` läuft durch. Ebenso `git config --remove-section core` und `git config --edit`. Solange `git push` unter `ask` steht, sieht Beks jeden Push; danach ist der pre-push-Hook die einzige Sperre. – Fix: Schalter `i` am Muster, die beiden Formen aufnehmen. Vor dem Entfall der `ask`-Regel für `git push`.
N20 · `.claude/hooks/guard.mjs:67-71,82` – Zwei Wege, eine Freigabe oder Abnahme ohne den Berater anzulegen: (a) Datei mit Berater-Namen außerhalb von `tmp/proof` schreiben (seit dem Fix zu N4 erlaubt), dann `cp <datei> tmp/proof/` mit Ordner als Ziel; geprüft wird nur das letzte Wort. (b) `New-Item tmp/proof/u1-abnahme.md -Value "… -ItemType Directory …"`: die Ordner-Ausnahme wird am unmaskierten Text geprüft, das letzte Wort ist dann Text. Beides ist Absicht, kein Versehen; die Modell-Zeile bleibt wie in Runde 1 gesagt Selbstauskunft, Gegenprobe ist das Hook-Protokoll im Bericht. – Fix: bei Ordner-Ziel unter `tmp/proof` den Dateinamen der Quelle prüfen; Ausnahme an der Maske prüfen.
N21 · `.claude/hooks/guard.mjs:11,42` – Wortliste ohne `comment`, `merge`, `do`, `select … into`; `supabase.cmd` und `supabase.exe` sowie ein globaler Schalter mit getrenntem Wert vor dem Unterbefehl (`--workdir x db push`) passen nicht auf das Muster. – Fix: ergänzen.
N22 · `scripts/sys/fertig.mjs:127`, `scripts/sys/lib.mjs:26-32` – Eine gelöschte Datei der Mindestmenge braucht keine Zeile. Wird `.githooks/pre-push` gelöscht, bleibt `hooksAktiv` wahr (nur der Konfigurationswert zählt), Pushes auf main laufen dann ohne Prüfung. – Fix: `hooksAktiv` verlangt zusätzlich, dass die Datei existiert; gelöschte Pfade der Mindestmenge als eigener Blockgrund.
N23 · `scripts/sys/fertig.mjs:14` – `.claude/agents/` (Modell und Werkzeuge des Beraters) fehlt in der Mindestmenge; die in M3 vorgeschlagene Liste „übrige R3-Pfade ohne Zeile“ in `bericht.md` gibt es nicht. – Fix: in u2 ergänzen.
N24 · `scripts/sys/bericht.mjs:76-78` – Schlägt der Scan fehl, bleibt ein `bericht.json` aus einem früheren Lauf mit gleichem Stand liegen; die neuen Kopien mit Treffer könnten mit committet werden. – Fix: `bericht.json` vor dem Scan entfernen.
N25 · `scripts/sys/fertig.mjs:110`, `scripts/sys/bericht.mjs:40,73` – `fertig` prüft nur `bericht.json` im Commit, nicht die dort genannten Kopien und Logs. Weil `*.log` ignoriert ist (`.gitignore:27`, N11 bewusst offen), fehlt ein vergessenes `git add -f` unbemerkt. – Fix: je Pfad aus `kopien` und `laeufe` ein `git cat-file -e HEAD:<pfad>`.
N26 · `scripts/sys/gate-db.mjs:64` – Marken liegen nur im unversionierten `tmp/proof`. Geht der Ordner verloren, ist ein Schritt mit Migration dauerhaft blockiert (die Migration wird nie wieder offen). – Fix: Rettungsweg in `docs/BEKS_EINRICHTUNG.md` (Beks trägt die Zeile von Hand nach).
N27 · Entwurf `tmp/proof/u1-settings-entwurf.json:80,92` – `Bash(rm:*)` hat als Gegenstück nur `Remove-Item`; die PowerShell-Kurzformen `rm`, `del`, `ri` fehlen. Ob Claude Code Aliase auflöst, weiß ich nicht. – Fix: optional drei Einträge.
N28 · `tests/unit/` – Kein Test für `schrittAusBericht` und `sammle` (Fix zu M6 und M7 ist nur gelesen, nicht maschinell belegt); Modus `marke` hat nur den Negativtest `sys-gate-db.test.ts:79-81`. – Fix: Test mit temporärem Git-Repo; `marke` mit Attrappe der Liste.
N29 · Entwurf `:68` – Die Sperre des Supabase-MCP hängt an der Server-Kennung. Ändert sie sich, gehen Migration und SQL über MCP am Datenbank-Gate vorbei. – Fix: Matcher des Guards um MCP-Werkzeuge erweitern und dort Schreibwerkzeuge verweigern, oder die Kennung in Schritt 5 der Einrichtung mit prüfen.

## Prüffragen

1 · Runde 1 behoben?
| Nr. | Stand | Beleg |
|---|---|---|
| H1 | behoben | `gate-db-lib.mjs:13-15` (Form je Eintrag), `:17-22` (Gegenprobe Dateien gegen Liste), `sys-gate-db.test.ts:64-75` (vier Fälle, Exit 1) |
| H2 | behoben | `guard.mjs:45-49` (ganzer Befehl, Datei-Schalter), `:11` (Wortliste), `sys-guard.test.ts:39-46,53-55`. Rest: M17, M18, N21 |
| M1 | behoben | `gate-db.mjs:60-67` (Marke erst nach „0 offen“), `package.json:69`, `fertig.mjs:43-45`. Rest: M16 |
| M2 | behoben | `fertig.mjs:123` (`AM`) |
| M3 | behoben | `fertig.mjs:14,52,127`, `sys-docs-importe.test.ts:26-33`. Rest: N22, N23 |
| M4 | behoben | `bericht.mjs:12`, `fertig.mjs:60-63` |
| M5 | behoben | `bericht.mjs:76-78` (Scan vor dem Schreiben; der Scanner prüft `docs/proof`). Rest: N24 |
| M6, M7 | behoben | `fertig.mjs:96-102,110` (aus `HEAD`), `:138-146,164-165` (genau ein Bericht im Push, Stand muss passen). Rest: N25, N28 |
| M8 | behoben | `fingerabdruck.mjs:7,11,13`, `stufe.mjs:16`, `sys-docs-importe.test.ts:14-24` |
| M9 | behoben | Entwurf `:53-65` (deny), `:93-108,110,112` (ask). Rest: N27 |
| M10 | behoben | `docs/BEKS_EINRICHTUNG.md:50-56` (Version, alte Sperre, Guard lädt, Absturz-Probe, `agent_type`). Die Proben selbst liegen bei Beks |
| M11 | behoben | `run.mjs:14-19,34`, `sys-run.test.ts:41-50` |
| M12 | behoben | `guard.mjs:42,57`, `sys-guard.test.ts:47-49` |
| M13 | behoben bis auf einen Rest | `stufe.mjs:9`, Entwurf `:117`, `CLAUDE.md:8` (Klarstellung zur EXIT-Zeile). Rest: Den Auftrag „Punkt 3 a“ finde ich in keiner Datei (`tmp/proof/u1-fable-plan.md:13` sagt das Gegenteil); die Quelle gehört in den Abschlussbericht an Beks |
| M14 | behoben | `gate-db.mjs:37,41`, `tmp/proof/u1/db-antrag-1.json:1`, `runs.jsonl:29` (Marke aus echtem Lauf). Die Gegenprobe aus H1 belegt dabei die Form der echten Liste: alle 62 Dateien standen darin, sonst wäre der Lauf blockiert. Ein Exit-Code-Log dieses Laufs gibt es nicht |
| M15 | behoben | `stufe.mjs:10`, `fertig.mjs:14`, `sys-stufe.test.ts:16` |
| N1 bis N4, N6 bis N10, N12, N13, N15 | umgesetzt | `guard.mjs:28,63,68,81-82`, `run.mjs:10-12`, `fertig.mjs:131`, `stufe.mjs:25,41`, `bericht.mjs:19-25`, `gate-db.mjs:13-16`, `start-schritt.mjs:15`, `test-runner.md:3`. N1 hat M18 und N20 a hat N4 als Nebenwirkung |
| N5, N11, N14, N16 bis N18 | offen, vermerkt | `docs/OPEN_ISSUES.md:13` |

Besonders geprüft: Maskierung und Segmentierung in `guard.mjs` (M18, N20), Lesen von `core.hooksPath` (`:61-65` richtig, Rest N19), Marken in `fertig.mjs` (M16), Mindestmenge (N22, N23), Berichtsermittlung im Push und Lesen aus `HEAD` (richtig), die drei Modi von `gate-db.mjs` (Aufrufprüfung `:19` richtig, `marke` nie als Attrappe, Attrappe-Optionen nie ohne `--trocken`).

2 · Entwurf der Berechtigungen: vollständig gespiegelt. Jeder Bash-Eintrag aus `deny` und `ask` hat ein PowerShell-Gegenstück, bis auf `sed` (in PowerShell kein Befehl) und `rm` (N27). Kein Eintrag der Vorgängerdatei fehlt (`.claude/settings.json:6-62` gegen Entwurf `:20-52,72-92`). JSON wohlgeformt, keine Zeilenenden mit Wagenrücklauf. `ask` für `Edit(./CLAUDE.md)` und `Edit(./package.json)` ist da. Syntax: `Tool(präfix:*)`, `Edit(./pfad/**)`, `Agent(Name)`, `mcp__<server>` entsprechen der mir bekannten Form; die Doku habe ich wie in Runde 1 nicht abrufen können. `args`, `onFailure` und `Agent(claude)` kann ich weiter nicht belegen; dafür stehen die Proben in Schritt 5.

3 · Regressionen und Ablauf
- Der Ablauf „Volläufe, `npm run bericht`, Docs-Commit, `npm run fertig`“ ist schlüssig. Der check-Fingerabdruck schließt `docs` und alle `.md` aus (`fingerabdruck.mjs:4,11`); der Docs-Commit ändert ihn nicht, solange er nur `docs/` enthält (Ausnahme `tokens.json`). Läufe zählen über den Fingerabdruck, nicht über den Commit-Hash; die Kopfzeile des Logs wird gegen den Hash des Laufs geprüft (`fertig.mjs:82`). `bericht` braucht zum Zeitpunkt des Aufrufs: sauberer Baum, gültige Läufe, Abnahme mit allen Zeilen der Mindestmenge. Danach schreibt es nur unter `docs/`, der Baum bleibt sauber.
- Für u1 selbst: Der Entwurf muss vor den Volläufen unverändert nach `.claude/settings.json` und in den Commit, sonst blockiert `fertig` zu Recht (Hash der Abnahme passt nicht zur Vorgängerdatei). Die Datei liegt im check-Fingerabdruck, die Läufe gehören also danach.
- Bericht fehlt im Commit, Gate im Bericht nicht bestanden, Marke fehlt bei nie gepushter Migration: blockiert zu Recht, die Meldung nennt den Weg.
- Zu Unrecht dauerhaft blockiert: Teil-Push (M16 b), Verlust von `tmp/proof` (N26), umbenannte oder geänderte Altmigration (nie wieder offen; gewollt, die Meldung „Push gescheitert“ passt dann nicht). Der Weg nach einem Block im pre-push steht jetzt in `docs/BEKS_EINRICHTUNG.md:64-65`.
- pre-push: mehr als ein neuer Bericht im Push blockiert; das kann wegen `start-schritt.mjs:12` nicht regulär entstehen. Ist der Remote-Stand lokal unbekannt, endet der Hook mit Fehler (fail-closed).

4 · Eigene Findings: M16 a ist ein fälschliches Grün, M16 b ein dauerhaftes Blockieren, M17 und M18 sind Umgehungen der Datenbank-Schranke auf Dev. Keines ist hoch: M16 ist enger als M1 und M2 der Runde 1 (der neue Inhalt braucht weiter eine Freigabe mit passendem Hash) und betrifft u1 nicht; M17 und M18 brauchen eine unübliche Schreibweise, laufen über eine Nachfrage an Beks oder werden vom Merge-Gate abgefangen. Alles Übrige ist niedrig.

Auflagen aus dieser Abnahme
1. M16 vor dem ersten Schritt mit Migration; bis dahin die Textregel aus M16.
2. M17, M18, N19 vor dem Auto-Modus und vor dem Entfall von `ask`-Regeln.
3. M16 bis M18 und N19 bis N29 in `docs/OPEN_ISSUES.md` eintragen. Werden sie noch in u1 behoben, ändern sich Hashes; dann ist eine dritte Runde nötig.
4. Die Herkunft des Abschnitts „Arbeitssystem“ in `CLAUDE.md` im Abschlussbericht an Beks nennen (M13).

## Stichproben

- `guard.mjs:45-49` mit `supabase db query "select 1;\ndelete from public.x" --linked` von Hand: Maske behält `db query`, Schreibwort im rohen Text, verweigert.
- `guard.mjs:47-48` mit `Get-Content tmp/x.sql | supabase db query --linked`: kein Schreibwort, kein Datei-Schalter, läuft durch (M17).
- `guard.mjs:28,57` mit `bash -c "npx supabase db push --linked"`: Inhalt maskiert, läuft durch (M18).
- `guard.mjs:61` mit `git config core.hookspath x`: kein Treffer, läuft durch (N19). Mit `git -c core.hooksPath=x push`: verweigert.
- `guard.mjs:67,71` mit `cp tmp/u1-abnahme.md tmp/proof/`: letztes Wort ist der Ordner, läuft durch (N20 a).
- `guard.mjs:54` mit `npm run t -- check` und `npm run check:deno`: laufen durch; mit `npm run test:e2e:mobile`: verweigert.
- `gate-db-lib.mjs:13,20` gegen die echten Dateinamen (`supabase/migrations/20261114100000_0062_fee_schedule.sql`): Version ist die 14-stellige Zahl vor dem ersten Unterstrich, passt zu `local`.
- `gate-db.mjs:19`: `marke --trocken` und Attrappe-Optionen ohne `--trocken` enden mit Exit 2 (`sys-gate-db.test.ts:61-63,76-81`).
- `gate-db.mjs:78`: Vormerkung wird überschrieben, nicht vereinigt (M16 b).
- `fertig.mjs:44` gegen `gate-db.mjs:78`: Pfadform gleich (`supabase/migrations/<datei>`, Schrägstriche vorwärts), kein Hash im Vergleich (M16 a).
- `fertig.mjs:127`: gelöschte Datei fällt durch `existsSync` aus der Mindestmenge (N22).
- `fertig.mjs:14` gegen `scripts/sys/*` und `.claude/hooks/*` (Glob): 9 Skripte, 2 Hooks, dazu pre-push, `package.json`, `settings.json` ergeben genau die 14 Zeilen oben; `.d.mts` und `fixtures/` gehören nicht dazu.
- `run.mjs:14-19`: `fertig.mjs` nur mit `--nur-pruefen` und ohne `--pre-push`, `gate-db.mjs` nur mit `--trocken`, Pfad wörtlich verglichen (Backslash-Schreibweise fällt durch).
- `scripts/dev-guard.mjs:7-22`: prüft Umgebung, URL und verlinkte Ref gegen die Dev-Ref und legt die Ref für Kindprozesse fest; `gate-db.mjs:36` lädt es vor der Liste.
- `scripts/scan-proof.mjs:14`: Standardordner ist `docs/proof`, der Scan in `bericht.mjs:77` trifft also die Kopien.
- `runs.jsonl:29`: Marke `db-push` mit leerer Liste aus dem echten Lauf; `runs.jsonl:30-31`: check rot, dann grün mit 1432 Tests, beide nicht sauber.
- `.git/config:8`: `hooksPath = .githooks`. `scripts/sys/fixtures/push-main.mjs:4`: weiter nur `--dry-run`.
- Zeilenenden: kein Wagenrücklauf in `scripts/sys/`, `.claude/hooks/`, `package.json` und im Entwurf (Grep), N17 trifft den heutigen Stand nicht.
- Kein Secret, kein Schlüssel und keine Verbindungsadresse in den geprüften Dateien; Geldlogik ist nicht berührt.

Offene Findings hoch: 0
