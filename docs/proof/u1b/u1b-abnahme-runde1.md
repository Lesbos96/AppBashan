Modell: claude-fable-5-2
SHA256: 09cb1f6d1f0f23653ebe17d066d80ac80a79b17ccb11e505810500a9715d1cb0 .claude/hooks/guard.mjs
SHA256: 184fce2c9db557e91ba2277bc92c6969eea0d6d40ea4353bdcbbd7e8454796c9 .claude/settings.json
SHA256: cc0130840e3f8232cb663d5a4769ec92e3b63f7ae6fbc609c33c5b5f1d51e8d4 package.json
SHA256: e269ef6c0e78d6255fa807cf3fba089e15f5b256eb368ad6584c7ae1896e74e7 scripts/sys/bericht.mjs
SHA256: 965267c7bede78f9ce3cefc1fb1c1b08cb02e754b77f63828811941e697fac1a scripts/sys/fertig.mjs
SHA256: c31bbd98cd877415272d7456f055e65194f6734f7890f6f2a09267ddd42bf3a4 scripts/sys/gate-db-lib.mjs
SHA256: 1b9d505e1992f9b47098e7afbb66df4cc3ea32fe8feb17ebbb428770aeb26d57 scripts/sys/gate-db.mjs
SHA256: bc7b55baccaac7ce73b60523a2f9ff5f03d5440620ed0f4344553bd9b710b829 scripts/sys/gate-loesch-lib.mjs
SHA256: 18fabc6a77b259a5f7733a343a95ea65ae70f42d318212c55008e254007748db scripts/sys/gate-loesch.mjs
SHA256: 42c0f033a187dbe2e3ab5fa65937b0cf27803ba5fc7bf2ef3877963bfe5cbe67 scripts/sys/run.mjs
SHA256: 1196d6af08a43d2df103934481dc616593d2f0a350ecd98022e2d8e213d7290f scripts/sys/stufe.mjs
SHA256: c3419930544f147d6d4e5fd13d2eb4d40e53ea4b4a4ffe58f9356ed6a81de3b5 scripts/sys/loesch-register.json
SHA256: 1f72a00bbc085ae8af2ac4b7b609b6686e00b7b141ba0f20aee9733b98a6593a tests/support/marker.ts
SHA256: 2556324e61c9c36758e5388b706c18d13c2ff4604ceca02a30ac572058de51f6 tests/support/partner.ts
SHA256: d63d73f7133fffada101e1be34e5f7d30a7ba9ab54867595f849c8180ca8dfee tests/support/sweep.ts
SHA256: 42c84e359b2240e4f68bd9feed84326212363d36ba71afea14a671f0ebc93490 docs/freigaben/u1b-loesch-freigabe-1.md

# Abnahme u1b (Kennung u1b-1411-a)

Datum: 2026-11-14
Auftrag: M16 (Marke bindet Inhalt), M17 (Guard: Pipe), M18 (Guard: verschachtelte Shells), Lösch-Gate; Umgang mit den Planfunden H1 bis H5 und M1 bis M10.

Geprüfter Umfang (vollständig gelesen): die 16 Dateien der Liste oben; dazu `scripts/sys/lib.mjs`, `scripts/sys/fingerabdruck.mjs`, `scripts/sys/fixtures/{guard-probe,m16-probe,push-main}.mjs`, `scripts/sys/fixtures/loesch/register.json`, `tests/unit/sys-guard.test.ts`, `sys-gate-loesch.test.ts`, `sys-gate-db.test.ts`, `sys-fertig.test.ts`, `tmp/proof/u1b/runs.jsonl`, `loesch-lauf.jsonl`, die Logs 008, 009, 011, 012, 016, 018, 023, 026, `tmp/proof/u1b-plan.md`, `u1b-fable-plan.md`, `u1b-ausgangslage.log`, `docs/BEKS_EINRICHTUNG.md`, `docs/OPEN_ISSUES.md` (Abschnitte u1 und u1b), `scripts/admin-call.mjs`, `scripts/live-r3.mjs`, `scripts/db-link.mjs`, `scripts/scan-proof.mjs`. Ausschnitte per Suche: Importe und Prozessaufrufe aller zwölf Registerskripte, `tests/rls/sweep.test.ts:1-45`, `tests/unit/sys-stufe.test.ts`.

Hinweise zum Nachweis
- Die Hash-Zeilen oben sind unverändert aus dem Antrag übernommen und von mir nicht nachgerechnet (kein Shell-Werkzeug). Jede Datei habe ich einmal gelesen; ich habe keinen Anlass, eine für verändert zu halten. `fertig` rechnet jeden Hash gegen die Datei nach und blockiert bei Abweichung. Drei Gegenproben auf Stimmigkeit: der Hash von `sweep.ts` steht gleich in `docs/freigaben/u1b-loesch-freigabe-1.md:2` und in allen vier Zeilen von `tmp/proof/u1b/loesch-lauf.jsonl`; der von `marker.ts` gleich in der Freigabe Zeile 3; der von `partner.ts` gleich in `scripts/sys/loesch-register.json:29`.
- Ob die Liste alle geänderten Pfade der Mindestmenge enthält, konnte ich nicht prüfen (kein `git diff`). `fertig` prüft das selbst (`scripts/sys/fertig.mjs:137`) und blockiert, wenn ein Pfad fehlt.
- Jede Änderung an einer der 16 Dateien nach diesem Bericht macht die Abnahme für diese Datei ungültig (`fertig.mjs:136`); dann ist eine neue Runde nötig.
- Das eingebaute advisor-Werkzeug ohne Parameter stand in meiner Werkzeugliste; ich habe es nicht aufgerufen. Keine `.env*` und keine `.claude/settings.local.json` gelesen. Nichts außer dieser Datei geschrieben.
- Ausgeführt habe ich nichts; alle Aussagen zum Verhalten des Guards stammen aus dem Durchspielen der Regexe von Hand.

## Ergebnis in einem Satz

Die drei Aufträge M16, M17, M18 und das Lösch-Gate sind in der Kernlogik richtig gebaut (geschlossen im Fehlerfall, Freigaben nur aus dem Commit, Marke bindet Pfad und Inhalt, gewöhnliche Befehle laufen ohne Falschalarm durch); offen bleiben sieben mittlere Funde, davon vier Lücken des Guards in gewöhnlicher Schreibweise, die die Doku heute als „erledigt“ führt. Kein Finding der Stufe hoch.

## Findings hoch

Keine.

Begründung der Einstufung: Der Guard ist laut eigener Doku keine Sicherheitsgrenze (`.claude/hooks/guard.mjs:2`), der Weg „Skript schreiben, mit node ausführen“ ist ausdrücklich offen (OPEN_ISSUES u1b-3). Die Lücken unten geben einer Session keine Fähigkeit, die sie über diesen Weg nicht schon hat, und betreffen nur Dev. M17 und M18 waren in der u1-Abnahme mittel; ihre Reste stufe ich gleich ein. Die Gates selbst (gate-db, gate-loesch, fertig) habe ich auf einen Weg geprüft, der ohne Freigabe durchlässt oder einen Lauf fälschlich als Nachweis zählt, und keinen gefunden.

## Findings mittel

AM1. `.claude/hooks/guard.mjs:73` und `:136` – Skriptdateien werden nur in der kürzesten Schreibweise gelesen. `skriptDatei` bekommt das rohe Segment (nicht den Kern ohne Hüllen) und erlaubt nach dem Shell-Namen nur Optionen ohne Wert. Durch gehen damit ungeprüft:
  - `powershell -NoProfile -ExecutionPolicy Bypass -File tmp/x.ps1` (die übliche Windows-Form; „Bypass“ ist ein Optionswert, das Muster bricht ab),
  - `npx dotenv -e .env.local -- bash tmp/x.sh`, `FOO=1 bash tmp/x.sh`, `time ./x.sh` (Hülle vor der Shell),
  - `& "C:\Ordner mit Leerzeichen\x.ps1"` (Pfad mit Leerzeichen), `cmd /c call x.bat`, `bash tmp/x` (ohne Endung).
  Folge: `npm run check`, `supabase db query` mit Datei oder ein Registerskript in einer solchen Datei laufen am Guard vorbei. Für Tests und Migrationen fängt es die zweite Ebene (Lauf zählt nicht, keine Marke), für direktes SQL und Registerskripte nicht. Das ist der Rest meines Planfunds H4.
  Fix: `skriptDatei` auf den Kern anwenden (nach `kern()`), nach dem Shell-Namen alle Wörter durchgehen (Anführungszeichen als ein Wort lesen) und das erste nehmen, das auf eine Skript-Endung endet; bei `bash|sh|zsh|dash|ksh|source|.` zusätzlich das erste Wort, das keine Option ist, auch ohne Endung; `call` und `start` als Hülle entfernen. Tests für jede Form oben ergänzen (`tests/unit/sys-guard.test.ts:233` deckt nur die Kurzformen).

AM2. `.claude/hooks/guard.mjs:122-125` – `db query` mit Dateiinhalt als PowerShell-Ausdruck geht durch: `supabase db query --linked (Get-Content tmp/x.sql -Raw)`. Kein Sperrwort im Befehl, kein `<`, kein Dollarzeichen, keine Pipe. In PowerShell ist das die naheliegende Ausweichform, wenn Pipe und `-f` verweigert wurden; die Meldung verspricht aber „nur ein wörtliches select als Argument“. Ebenso offen: `cat x.sql | xargs supabase db query --linked` (das Segment beginnt nicht mit supabase).
  Fix: Erlaubtform statt Sperrzeichen. Nach `db query` dürfen im maskierten Text nur Optionen (auch mit Wert, z. B. `-o json`) und genau ein Argument in Anführungszeichen stehen; alles andere (Klammern, `@`, bloßes Wort) wird verweigert. Kommt `db query` in einem Segment vor, das nicht mit supabase beginnt, ebenfalls verweigern. Tests: die zwei Befehle oben, Gegenprobe `supabase db query "select 1" --linked -o json`.

AM3. `.claude/hooks/guard.mjs:97-98` – Direktaufruf eines Registerskripts wird nicht erkannt, wenn vor dem Pfad eine Option mit Wert steht oder der Pfad in Anführungszeichen steht:
  - `node --env-file .env.local scripts/storage-reset.mjs` (Ziel ist dann der Optionswert),
  - `node -r dotenv/config scripts/storage-reset.mjs`,
  - `node "scripts/storage-reset.mjs"` (das Ziel endet auf ein Anführungszeichen, `endsWith` trifft nicht).
  Die zwölf `.mjs`-Registerskripte haben keine Selbstprüfung (nur `sweep.ts`, Suche nach dem Aufruf in `scripts/`: kein Treffer); hier ist der Guard die einzige Sperre.
  Fix: Anführungszeichen entfernen und als Ziel das erste Wort nach dem Interpreter nehmen, das auf `.mjs|.js|.cjs|.ts|.mts` endet (statt „erstes Wort, das keine Option ist“). Tests für die drei Formen; die Gegenproben `node tmp/hash.mjs scripts/storage-reset.mjs` (`sys-guard.test.ts:298-299`) bleiben damit grün.

AM4. `scripts/sys/gate-loesch.mjs:24` gegen `.claude/hooks/guard.mjs:12` und `:177-185` – Das Gate nimmt Freigabe-Dateien an, die der Guard nicht schützt.
  - `uebernehme` akzeptiert jeden Dateinamen, der auf die Freigabe-Endung passt, auch mit Vorsilbe (z. B. `tmp/proof/u1b/vor-loesch-freigabe-2.md`). Der Guard schützt nur Namen, die mit dem Freigabe-Präfix beginnen. Die Hauptsession kann eine solche Datei mit dem gewöhnlichen Write-Werkzeug anlegen; `uebernehme` kopiert sie nach `docs/freigaben/u1b-vor-loesch-freigabe-2.md`, und `scripts/sys/gate-loesch-lib.mjs:17` zählt sie nach dem Commit als Freigabe. Die Zusicherung „Freigaben schreibt nur advisor-report“ gilt damit für das Lösch-Gate nicht, auch ohne den offenen Skript-Weg.
  - `entscheideDatei` vergleicht Pfade ohne Normalisierung und mit Beachtung der Groß- und Kleinschreibung. Unter Windows trifft `…\TMP\Proof\u1b-abnahme.md`, `…\Docs\Freigaben\x.md` oder `…\tmp\.\proof\…` dieselbe Datei, aber keine der Regeln in Zeile 179 bis 183 (betrifft auch Abnahme, DB-Freigabe, Läufe, `.git`).
  Fix: (a) Zeile 24 auf genau `tmp/proof/<ordner>/loesch-freigabe-<Zahl>.md` einschränken (Dateiname beginnt mit dem Präfix), Test „Vorsilbe: Exit 2“. (b) In `entscheideDatei` den Pfad mit `path.resolve` auflösen und in Kleinbuchstaben vergleichen. (c) Zusätzlich `Edit(./docs/freigaben/**)` in die deny-Liste von `.claude/settings.json` (stört `uebernehme` nicht, das kopiert in einem Node-Prozess); das war Teil von H3 und kostet nichts.

AM5. `scripts/sys/gate-db.mjs:75-86` – Geht nach einem gelungenen Push das Neulesen der Liste schief (Netz, Zeitlimit des Werkzeugs, Abbruch des Gate-Prozesses während die CLI läuft), ist die Migration angewendet, aber ohne Marke. Ein zweites `npm run db:push` findet nichts Offenes und schreibt nichts; `fertig` verlangt die Marke (`fertig.mjs:45`) und blockiert dann dauerhaft. Geschlossen im Fehlerfall, aber ohne Rettungsweg außer Handarbeit von Beks an `runs.jsonl`. Der echte Push-Zweig (Zeile 74 bis 86) ist bisher nur über die reine Funktion `marken` getestet, nie gegen die CLI gelaufen.
  Fix: Vor dem Start der CLI eine Zeile `{ziel:'db-push-start', migrationen:[{pfad, sha256, version}]}` in `runs.jsonl` schreiben. Zu Beginn jedes `push` abgleichen: für jede begonnene Migration ohne Marke, die die Liste jetzt als angewendet zeigt und deren Datei noch den vermerkten SHA-256 hat, die Marke nachtragen. Das Neulesen nach dem Push zwei- bis dreimal wiederholen. Test in der Attrappe: „Start-Zeile ohne Marke, Liste zeigt angewendet: Marke wird nachgetragen; SHA weicht ab: keine Marke“.

AM6. `scripts/sys/gate-loesch.mjs:7-13` und `:65` – Das Lösch-Gate prüft die Projekt-Ref nicht selbst. `gate-db.mjs:43` lädt `dev-guard` vor jedem echten Zugriff, `gate-loesch.mjs` nicht; es verlässt sich auf das gestartete Skript. Vier Registerskripte laden `dev-guard` nicht (`admin-call`, `live-auth`, `setup-photo-cleanup`, `setup-photo-publish`; OPEN_ISSUES u1b-1 nennt das). Heute ohne Wirkung, weil keines der zwölf Skripte eine Freigabe hat; mit der ersten Freigabe hinge die Regel „nur Dev“ allein am Inhalt des Skripts.
  Fix: in `gate-loesch.mjs` vor dem `spawn` (nicht bei `--trocken`, nicht bei `uebernehme`) `await import('../dev-guard.mjs')`, wie in `gate-db.mjs:43`.

AM7. `scripts/sys/gate-loesch-lib.mjs:13-14`, `scripts/sys/loesch-register.json:10-12`, `tests/unit/sys-gate-loesch.test.ts:144-148` – Der Register-Scan und die Bindung decken zwei Arten von Abhängigkeit nicht ab.
  - Skripte, die die Supabase-CLI starten, findet das Muster nicht (Planfund H5 nannte `supabase.js` als Merkmal): `scripts/live-r3.mjs:9` führt `db query -f` gegen Dev aus und lädt `dev-guard` nicht, `scripts/db-link.mjs:9` verlinkt das Projekt. Beide stehen weder unter `skripte` noch unter `ausgenommen`; `node scripts/live-r3.mjs` ist für den Guard ein gewöhnlicher Aufruf. (`live-r3.mjs` baut sein SQL selbst, die Linie kommt aber ungeprüft aus `tmp/proof/ors.json` in einen Dollar-Quote-Block.)
  - Der Import-Test sieht nur `import`-Anweisungen. `scripts/redproof-restore.mjs:20`, `redproof-s9a3.mjs:26` und `redproof-s9a4.mjs:23` lesen `scripts/redproof-soll.json`; die Datei bestimmt, auf welchen Stand zurückgeschrieben wird, ist aber an keines der drei Skripte gebunden. Eine Änderung dort bräuchte keine neue Freigabe (nur einen Commit, `scripts/redproof-lib.mjs:312`). Gleiche Klasse wie H1.
  Fix: Muster um den CLI-Aufruf (`supabase.js`) erweitern; `live-r3.mjs` und `db-link.mjs` mit Grund und SHA-256 unter `ausgenommen` eintragen oder `live-r3.mjs` als Registerskript führen (oder löschen, falls es nicht mehr gebraucht wird); im Vollständigkeits-Test auch die gebundenen Dateien als bekannt zählen (`redproof-deploy.mjs` trifft das neue Muster). `scripts/redproof-soll.json` an die drei Redproof-Skripte binden. Spätestens vor der ersten Freigabe eines Redproof-Skripts.

Zu AM1 bis AM3 gehört die Doku: `docs/OPEN_ISSUES.md:17-18` führt M17 und M18 als „erledigt“, `docs/BEKS_EINRICHTUNG.md:30-31` gibt den Auto-Modus damit frei. Entweder die drei Funde beheben (jeweils wenige Zeilen, dann neue Abnahme-Runde für `guard.mjs`) oder die offenen Formen wörtlich in u1b-3 aufnehmen und in BEKS_EINRICHTUNG Abschnitt 3 nennen. Meine Empfehlung: AM1 bis AM4 vor dem Abschluss-Commit beheben, AM5 vor der ersten echten Migration, AM6 und AM7 vor der ersten Freigabe eines `.mjs`-Registerskripts.

## Findings niedrig

AN1. `.claude/hooks/guard.mjs:54`, `:115`, `:121` – Weitere Schreibweisen am Guard vorbei: globale CLI-Optionen mit Wert vor dem Unterbefehl (`supabase --workdir . db push`), Paket mit Version (`npx supabase@2 db push`), `npx -y vitest run`, `npm run -s check`, `node node_modules/vitest/vitest.mjs run`, `dotenv -c -- psql`. Bei Tests und `db push` fängt die zweite Ebene. Fix: im Muster für supabase Optionen mit Wert und `@version` zulassen; Test- und psql-Regel wie die `db push`-Regel unverankert am maskierten Kern prüfen.

AN2. `.claude/hooks/guard.mjs:45` – Geschweifte Klammern trennen nicht: `1..3 | % { npm run check }`, `foreach ($i in 1..3) { npm run check }`, `if ($x) { psql … }` gehen durch (die Bash-Form mit `do … done` wird erkannt). Fix: `{` und `}` außerhalb von Anführungszeichen als Trenner behandeln.

AN3. `.claude/hooks/guard.mjs:126`, `:129` – Inline-Code in anderer Form: `node --input-type=module -e "…"` (Option davor), `node <<'EOF'`, `echo x | node --input-type=module`, `python -c`. Gleichwertig zum offenen Skript-Weg; Fix nur, wenn die Regel „kein Inline-JavaScript“ ernst gemeint bleibt: `-e|-p|--eval|--print` an beliebiger Stelle vor dem ersten Skriptpfad und `<<` hinter einem Interpreter verweigern.

AN4. Falschalarme, alle zur sicheren Seite, keiner trifft einen der gewöhnlichen Befehle:
  - `.claude/hooks/guard.mjs:14` – Lesen von `cron.job` oder `cron.job_run_details` per `db query` wird verweigert (Schema-Präfix gesperrt). Fix: nur die schreibenden Funktionen sperren (planen, entplanen, ändern, HTTP-Aufrufe).
  - `:63` – `powershell -Command "dotenv -e .env.local -- node x"` wird als EncodedCommand verweigert, weil irgendwo ein `-e` mit Leerzeichen steht. Fix: nur vor `-Command`/`-File` suchen.
  - `:73` – `npm.cmd run build` oder `source ~/.x.sh` enden mit „Skriptdatei nicht lesbar“.
  - `:107-108` – das Sperrwort wird im ganzen Befehl gesucht: `supabase db query "select 1" --linked && git commit -m "update …"` wird verweigert. Fix: nur im Segment mit `db query` suchen (Zeilenumbrüche innerhalb von Anführungszeichen bleiben wegen der Maske im Segment).
  - `:158-164` – `cd docs/freigaben`, `find docs/freigaben`, `certutil -hashfile docs\freigaben\…` werden verweigert.
  - `:37` – Commit-Text im Heredoc mit ungerader Zahl gerader Anführungszeichen: der Rest des Textes wird zeilenweise als Befehl gelesen; eine Zeile, die mit einem gesperrten Programm beginnt oder den Freigaben-Ordner nennt, verweigert den Commit. Abhilfe für die Session: typografische Anführungszeichen im Commit-Text.

AN5. `.claude/hooks/guard.mjs:162` – Steht der Freigaben-Pfad in Anführungszeichen, zählt nur die Liste der schreibenden Programme; `Rename-Item "docs/freigaben/a" b`, `ren`, `sed -i`, `dd of=` fehlen. Geringe Wirkung: Umbenennen und Ändern blockiert `fertig` (`fertig.mjs:65`, `:126`), und es zählt nur der Commit. Fix: Liste ergänzen oder bei Pfad in Anführungszeichen dieselbe Leser-Liste verlangen.

AN6. `scripts/sys/gate-loesch.mjs:31-32` – `uebernehme` lehnt einen Bericht mit Urteil „gesperrt“ ab. Damit lässt sich eine einmal erteilte Freigabe für denselben SHA-256 nie widerrufen (Freigaben sind unveränderlich, `gate-db-lib.mjs:52-63` würde ein „gesperrt“ beachten, es kommt aber nie in den Ordner). Ausweg heute: das Skript ändern. Fix: bei `uebernehme` Register, Hash und Modell prüfen, das Urteil nicht.

AN7. `scripts/sys/gate-loesch.mjs:77` mit `scripts/sys/bericht.mjs:49` – Die Argumente des Skripts stehen im Lauf-Log, das Log wird nach `docs/proof` kopiert und committet. Bei `scripts/admin-call.mjs:7` ist das Argument der ganze JSON-Körper (Auftrags-ID, Freitext der Begründung). Das Token steht nicht darin (Umgebung, `admin-call.mjs:8`). Fix: je Registerskript festlegen, welche Argumente ins Log dürfen, sonst nur Anzahl und SHA-256 der Argumente.

AN8. `.claude/hooks/guard.mjs:11` – Der Name der entfallenen Plan-Datei des alten Push-Ablaufs steht noch in der Liste der Skriptdateien. Fix: streichen.

AN9. Doku:
  - `docs/OPEN_ISSUES.md:6` nennt „13 Ausnahmen“; `scripts/sys/loesch-register.json:18-31` hat 14 (seit `owner.ts` dazukam).
  - `docs/OPEN_ISSUES.md:24` (u1b-3): „nur Selbstprüfung der Registerskripte und fertig/pre-push fangen es“ stimmt so nicht. Eine Selbstprüfung hat nur `sweep.ts`; ein Skript unter `tmp/`, das auf Dev löscht, fängt nichts. Fix: Satz berichtigen.
  - `docs/BEKS_EINRICHTUNG.md:30` verweist auf diese Abnahme als Beleg für „M17 und M18 behoben“; siehe AM1 bis AM3.

AN10. Testlücken:
  - `tests/unit/sys-gate-loesch.test.ts:56-58` – `uebernehme` ist nur mit Aufruffehlern getestet, nicht: Datei außerhalb des Registers, falscher Hash, vorhandenes Ziel (kein Überschreiben), Erfolg.
  - `scripts/sys/fertig.mjs:110-145` (`sammle`) und `gate-loesch-lib.mjs:26-29` (`freigabenAusGit`) haben keinen Test; der Fall „Freigabe nur im Arbeitsbaum, nicht im Commit“ aus der Planprüfung ist nur durch die Bauweise gedeckt (`git show HEAD:…`), nicht durch einen Lauf.
  - `scripts/sys/gate-db.mjs:74-86` siehe AM5.

AN11. `scripts/sys/fingerabdruck.mjs:12` – `docs/freigaben` gehört nicht zum Fingerabdruck der rls-Suite, obwohl ihr Ergebnis davon abhängt (`sweep.ts:34`, `:55`). Tragbar, weil Freigaben nur hinzukommen können (AN6) und eine fehlende Freigabe den Lauf rot macht, nie fälschlich grün. Bei Umsetzung von AN6 den Ordner in den Fingerabdruck aufnehmen.

AN12. `.claude/hooks/guard.mjs:37` – Maskierung kennt keine Escapes: `echo \" ; <befehl> ; echo \"` versteckt einen Befehl, ein Zeilenende mit Backslash zerteilt einen. Bewusste Verschleierung, gleiche Klasse wie der offene Skript-Weg; nur festgehalten.

AN13. `.claude/hooks/guard.mjs:150` – `git -c "core.hooksPath=x" push` (Schlüssel in Anführungszeichen) und die Kleinschreibung des Schlüssels gehen durch. Bestand aus u1 (dort N19), `fertig` prüft den Hook-Pfad (`fertig.mjs:34`).

## Antworten auf die Prüffragen

**Falschalarme bei gewöhnlichen Befehlen?** Keine gefunden. Von Hand durchgespielt:
- `git commit -m "$(cat <<'EOF' … EOF)"`: der ganze Text liegt in einem Anführungszeichen-Paar und wird maskiert; Sperrwörter, Trennzeichen, `--no-verify` und der Freigaben-Pfad im Text zählen nicht (Regeln in `guard.mjs:149`, `:150`, `:158-164` prüfen den maskierten Text bzw. nur schreibende Programme). Einschränkung siehe AN4 (ungerade Zahl gerader Anführungszeichen).
- `grep -rn "delete from" tests/support`, `grep "x; supabase db push" docs/a.md`, `Get-Content docs/PROGRESS.md | Select-String psql`, `Get-Content docs/freigaben/x.md`, `cat a | grep delete`: durchgelassen (Programm am Segmentanfang ist kein gesperrtes; die `db push`-Regel prüft den maskierten Text).
- `npm run t -- check`, `npm run t -- tests/unit/x.test.ts`, `npm run t -- cmd node scripts/sys/gate-db.mjs push --trocken …`, `npm run db:push`, `npm run db:antrag`, `npm run bericht`, `npm run build`, `npm run lint`, `npm run db:seed:dev`, `npm run geo:districts`: durchgelassen.
- `cp tmp/proof/u1b/001.log docs/proof/u1b/001.log`: der Guard lässt es durch, die deny-Regel `Edit(./docs/proof/**)` verweigert es danach (OPEN_ISSUES u1b-5, stimmt mit `bericht.mjs:49-61` überein).
- `for f in tmp/proof/u1b/*.log; do tail -3 "$f"; done`, `sleep 5 && npm run t -- e2e`, `node --version`, `node tmp/x.mjs`, `2>&1` (kein Trenner dank Rückschau in `guard.mjs:45`): durchgelassen.

**Umgehungswege des Guards?** Ja, in gewöhnlicher Schreibweise: AM1 (Skriptdatei mit Optionswert oder Hülle), AM2 (Dateiinhalt als PowerShell-Ausdruck), AM3 (Registerskript mit Optionswert oder in Anführungszeichen), dazu AN1 bis AN3. Die im Antrag genannten Formen (Pipe an psql, Shell und Interpreter; `bash -c`, `powershell -Command`, `cmd /c`, `eval`, `iex`, EncodedCommand; `bash x.sh`, `pwsh -File x.ps1`; Programmpfade; Präfixe) sind geschlossen und durch Tests und die Proben 015 bis 020 und 026 belegt.

**Reihenfolge der Prüfungen im Guard?** Stimmig. Die SQL-Wortprüfung läuft vor der Segmentierung über den ganzen Befehl (fängt Mehrfachanweisungen und Heredoc), Test- und DB-Sperre vor der Rekursion, Skriptdatei nur, wenn kein Innentext vorliegt (`cmd /c x.bat` läuft über die Rekursion), Tiefe über 4 wird verweigert, ein Absturz verweigert (`guard.mjs:197-201`, `settings.json:9`).

**gate-db push: Reihenfolge, Exit-Codes, Marken bei Teil-Push, TOCTOU?** In Ordnung, mit AM5.
- Reihenfolge: Dev-Prüfung, Liste, Hash je offener Migration, Freigaben prüfen, CLI starten, Liste neu lesen, Marken, Exit (`gate-db.mjs:43-86`).
- Teil-Push: Marke nur für Migrationen, die vorher offen waren und danach nicht mehr (`gate-db-lib.mjs:72`), mit dem vor dem Push freigegebenen SHA-256; die gescheiterte bleibt offen und bekommt beim zweiten Versuch ihre eigene Zeile. Der Exit ist der der CLI (`:86`), bei Fehler läuft `db:types` nicht (`package.json:69`).
- TOCTOU: Ändert sich die Datei zwischen Hash und CLI, gibt es keine Marke und einen Grund (`gate-db-lib.mjs:73-74`), `fertig` blockiert. Die geänderte Fassung läge dann ungeprüft auf Dev; das wird erkannt, nicht verhindert, für Dev tragbar.
- Zeit der Marke ist das Ende des Pushs (`:83`); ein rls-Lauf zählt nur, wenn er danach startete (`fertig.mjs:19-22`).
- Attrappen-Optionen nur mit `--trocken` (`:20`), der Modus `marke` ist weg (Test `sys-gate-db.test.ts:79-82`).

**Lösch-Gate?** Kernlogik in Ordnung: Register genau nach Pfad, Freigabe aus HEAD für Skript und alle gebundenen Dateien, jeder Treffer muss Fable, „frei“ und 0 sein, Optionen nur vor dem Skriptpfad, `--register`/`--freigaben` nur mit `--trocken`, Pfad ohne `..`, Kopie nie überschreibend. Offen: AM4 (Dateiname), AM6 (Dev-Prüfung), AM7 (Register), AN6, AN7. Die Sperr-Probe 009 misst die Wirkung: `marker.ts` geändert, `sweep.ts` unverändert, alle drei Tests brechen in `loeschFreigabe` ab, `loesch-lauf.jsonl` hat keine Zeile für Lauf 9.

**fertig, stufe, bericht?** In Ordnung.
- `docs/freigaben/` ist R3 und steht vor der allgemeinen docs-Regel (`stufe.mjs:16-18`, Test `sys-stufe.test.ts:18-19`), gehört zur Mindestmenge (`fertig.mjs:15`), geänderte und gelöschte Dateien dort blockieren (`:65`, `:126`; wegen `--no-renames` zählt Umbenennen als Löschen).
- Zweite Ebene: geänderte Register- und gebundene Dateien brauchen eine Freigabe aus HEAD für den neuen SHA-256 (`:64`, `:122-125`).
- Marke zählt nur bei gleichem Pfad und SHA-256, altes Format nicht (`:45`, Test `sys-fertig.test.ts:86-91`).
- `bericht.mjs:49-55` kopiert Lösch-Freigaben, Lauf-Log und Proben; `cmd`-Läufe erfüllen keine Suite (`fertig.mjs:22`, Test `:70-72`).
- `run.mjs:14-20`: `cmd` lässt vom Lösch-Gate nur die Trockenform durch (Option an erster Stelle), vom DB-Gate nur mit `--trocken`, `fertig` nur mit `--nur-pruefen`. Nebenwirkung ohne Gewicht: `gate-db.mjs antrag --trocken` schreibt eine Antragsdatei in den als `--freigaben` genannten Ordner.

**Umgang mit den Planfunden?**
- H1: umgesetzt (`marker.ts:8`, `:11`; Register Zeile 3; `sweep.ts:56`, `:62-65`; Tests `sys-gate-loesch.test.ts:144-148`, `:159-166`). Rest: AM7 (Abhängigkeiten ohne Import).
- H2: umgesetzt (`guard.mjs:13-14`, Tests `sys-guard.test.ts:165-168`); Wortliste bleibt Wortliste (u1b-3, ehrlich benannt).
- H3: umgesetzt bis auf die deny-Regel; die Begründung im Antrag trägt nur halb (AM4 c).
- H4: teilweise (AM1).
- H5: teilweise; `dev-guard`-Import und POST sind im Muster, der CLI-Aufruf nicht (AM7); der fehlende Massen-Lint steht ehrlich in u1b-2.
- M1, M2, M3, M6, M7, M9, M10: umgesetzt (Stichproben unten). M4: umgesetzt bis auf AN1 bis AN3. M5: Sperrliste erweitert, Erlaubtliste offen und benannt. M8: umgesetzt, Rest AN5.
- Funde der Lösch-Freigabe: M3 (`owner.ts` mit Hash unter `ausgenommen`) umgesetzt (Register Zeile 28); M1, M2, N1 bis N8 bleiben offen und sind an die nächste Freigabe von `sweep.ts` gebunden, das ist in Ordnung.

**Konsistenz Register, Freigabe, Tests, Doku?** Bis auf AN9 stimmig. Register: 13 Einträge unter `skripte` (12 Skripte und `sweep.ts`), 14 Ausnahmen mit Grund und Hash. Die Aliase `admin:call`, `setup:photo-cleanup`, `setup:photo-publish` (`package.json:64`, `:66-67`) findet der Guard über den Skripttext (`guard.mjs:82`); `docs/BEKS_EINRICHTUNG.md:73` und OPEN_ISSUES u1b-1 nennen dieselben drei. `npm run loesch` steht in der ask-Liste (`settings.json:111-112`), der Matcher umfasst MCP-Werkzeuge (`:7`).

**Geld, RLS, Schema?** Von u1b nicht berührt (keine Migration, keine Function, kein App-Code in der Liste; `db-antrag-1.json` laut Ausgangslage 0 offene Migrationen).

**Was vor `fertig` noch fehlt (kein Finding)?** In `runs.jsonl` gibt es für den Endstand keinen Lauf von check, e2e und rls mit kanonischem Befehl (letzter check-Lauf Nr. 7 auf dem Ausgangs-Commit, Baum nicht sauber). `fertig` verlangt sie.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `.claude/hooks/guard.mjs:37`, `:45` | Maske längengleich, Trenner am maskierten Text, `2>&1` kein Trenner: in Ordnung (AN12) |
| `.claude/hooks/guard.mjs:62-66` | Innentext für Bash-Familie, PowerShell (Optionen mit Wert vor `-Command`), cmd, eval, iex; EncodedCommand flach verweigert: in Ordnung (AN4 zum `-e`) |
| `.claude/hooks/guard.mjs:73`, `:136` | Skriptdatei nur Kurzform, am rohen Segment: AM1 |
| `.claude/hooks/guard.mjs:97-98` | Ziel = erstes Wort ohne Bindestrich, Anführungszeichen bleiben: AM3 |
| `.claude/hooks/guard.mjs:107-108` | Wortprüfung über den ganzen Befehl, `-f`/`--file` verweigert: in Ordnung (AN4) |
| `.claude/hooks/guard.mjs:118` | `db push|reset`, `migration repair|up|down|squash`, Storage, Functions, Secrets, Backups, Branches, Projekte, DB-URL: in Ordnung (AN1) |
| `.claude/hooks/guard.mjs:122-125` | Pipe, `<` am maskierten Text, Dollarzeichen außerhalb einfacher Anführungszeichen: wie in der Planprüfung verlangt; Klammerausdruck fehlt: AM2 |
| `.claude/hooks/guard.mjs:158-164` | Umgekehrte Regel für den Freigaben-Ordner, Umleitung auch in Anführungszeichen: in Ordnung (AN5) |
| `.claude/hooks/guard.mjs:177-185` | Write/Edit auf den Freigaben-Ordner immer verweigert, auch für den Berater; Pfadvergleich ohne Normalisierung: AM4 |
| `.claude/hooks/guard.mjs:189` | MCP-Datenbankwerkzeuge am Namen verweigert: in Ordnung |
| `.claude/settings.json:7`, `:9`, `:68-69`, `:111-112` | Matcher, Blockieren bei Hook-Fehler, deny für MCP-Server und `docs/proof`, ask für `npm run loesch`: in Ordnung |
| `package.json:68-70` | `db:antrag`, `db:push` (Gate startet die CLI, danach Typen), `loesch`: in Ordnung |
| `scripts/sys/gate-db.mjs:20` | Attrappe nur mit `--trocken` und allen drei Optionen: in Ordnung |
| `scripts/sys/gate-db.mjs:43`, `:75`, `:78`, `:83`, `:86` | Dev-Prüfung, CLI mit `--linked --yes`, Neulesen, Marke anhängen, Exit der CLI: in Ordnung (AM5) |
| `scripts/sys/gate-db-lib.mjs:16-22` | Gegenprobe Datei gegen Liste, wirft bei unvollständiger Liste: in Ordnung |
| `scripts/sys/gate-db-lib.mjs:52-63` | alle Freigaben zu Pfad und SHA-256 geprüft: in Ordnung |
| `scripts/sys/gate-db-lib.mjs:68-77` | Marke nur bei unverändertem SHA-256: in Ordnung |
| `scripts/sys/gate-loesch.mjs:24`, `:27-35` | Quelle nur unter `tmp/proof`, ohne `..`; Register, Hash, Modell, Urteil geprüft; Kopie mit Ausschluss-Flag; Dateiname zu weit: AM4 |
| `scripts/sys/gate-loesch.mjs:42-51` | Optionen nur vor dem Pfad, nur `.mjs`, ohne `..`: in Ordnung |
| `scripts/sys/gate-loesch.mjs:53-56`, `:65` | Register, Freigaben aus HEAD, dann Start; keine Dev-Prüfung: AM6 |
| `scripts/sys/gate-loesch-lib.mjs:17`, `:26-29` | Freigaben nur aus `git ls-tree`/`git show` auf HEAD: in Ordnung |
| `scripts/sys/gate-loesch-lib.mjs:37-44` | Laufbindung, Register, alle gebundenen Dateien, wirft: in Ordnung |
| `scripts/sys/loesch-register.json:3`, `:10-12`, `:28-29` | `marker.ts` gebunden, Redproof-Bindungen ohne Soll-Datei (AM7), `owner.ts` und `partner.ts` mit Hash |
| `scripts/sys/fertig.mjs:15` | Mindestmenge enthält Register, `tests/support/`, `docs/freigaben/`: in Ordnung |
| `scripts/sys/fertig.mjs:43-48`, `:64-65` | Freigabe und Marke je Migration, Lösch-Gate zweite Ebene, Freigaben unveränderlich: in Ordnung |
| `scripts/sys/run.mjs:14-20`, `:35`, `:74` | feste Liste für `cmd`, Laufkennung in der Umgebung: in Ordnung |
| `scripts/sys/stufe.mjs:15-18` | `tests/support` und `docs/freigaben` R3 vor der docs-Regel: in Ordnung |
| `scripts/sys/bericht.mjs:19-25`, `:49-55`, `:88-90` | nie überschreiben, Lösch-Nachweise und Proben kopiert, Scan vor dem Schreiben: in Ordnung |
| `tests/support/sweep.ts:9`, `:34`, `:55-56` | Guard erster Import, Freigabeprüfung zuerst und vor dem `try`, UUID-Prüfung: unverändert zur Freigabe 1 |
| `tests/support/marker.ts:8`, `:11` | Muster verankert, Name der Abdeckungsfirma: unverändert zur Freigabe 1 |
| `tests/support/partner.ts:3`, `:12`, `:59` | importiert `COVER_FIRM` aus `marker.ts`, erzeugt passende Adresse: in Ordnung |
| `docs/freigaben/u1b-loesch-freigabe-1.md:1-4`, `:122` | Modell, zwei Hash-Zeilen, Urteil frei, hoch 0: Form stimmt, Hashes gleich dem Antrag |
| `tmp/proof/u1b/008-…sweep.test.ts.log:2`, `:20`, `:28` | Baum sauber, 3 bestanden, EXIT=0 |
| `tmp/proof/u1b/009-…sweep.test.ts.log:2`, `:22`, `:90` | Baum nicht sauber (Marker geändert), Abbruch im Lösch-Gate, EXIT=1; keine Logzeile in `loesch-lauf.jsonl` |
| `tmp/proof/u1b/011-cmd.log:9-12`, `012-cmd.log:8-12` | geändert vor der Marke: keine Marke; geändert nach dem Push: Merge-Gate blockiert zweifach |
| `tmp/proof/u1b/016-cmd.log`, `018-cmd.log`, `026-cmd.log` | 4, 11 und 9 Befehle verweigert, je mit passender Meldung |
| `tmp/proof/u1b/023-cmd.log:7` | gebundene Datei geändert: blockiert mit Pfad und Hash |
| `tmp/proof/u1b/runs.jsonl:13-14`, `:21-25` | Trockenläufe beider Gates: je rot und grün wie erwartet |
| `scripts/admin-call.mjs:7-8`, `:16-20` | Token aus der Umgebung, Körper als Argument: AN7; kein `dev-guard`: AM6 |
| `scripts/live-r3.mjs:7-9`, `scripts/db-link.mjs:9` | CLI-Aufruf ohne Registereintrag: AM7 |
| `scripts/redproof-restore.mjs:20`, `scripts/redproof-lib.mjs:312` | Soll-Datei gelesen, nur gegen HEAD geprüft, nicht gebunden: AM7 |
| `docs/OPEN_ISSUES.md:6`, `:17-18`, `:24` | Zahl der Ausnahmen, „erledigt“, Satz zur Selbstprüfung: AN9 |
| `docs/BEKS_EINRICHTUNG.md:30-31`, `:72-73` | Auto-Modus-Vermerk (AN9), Lösch-Gate und ask-Regel stimmen mit Code und Einstellungen überein |

Offene Findings hoch: 0
