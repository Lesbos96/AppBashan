Modell: claude-fable-5-2
SHA256: b34be34a286791e5c52eae34e42496669d7c1ccb5b8b70bd8bea46cd04b25bb6 .claude/hooks/guard.mjs
SHA256: db4d5e619ca2f72d00585333fb745fecfb3402ad4e043125d0363e43ad6c3437 .claude/settings.json
SHA256: cc0130840e3f8232cb663d5a4769ec92e3b63f7ae6fbc609c33c5b5f1d51e8d4 package.json
SHA256: e269ef6c0e78d6255fa807cf3fba089e15f5b256eb368ad6584c7ae1896e74e7 scripts/sys/bericht.mjs
SHA256: 965267c7bede78f9ce3cefc1fb1c1b08cb02e754b77f63828811941e697fac1a scripts/sys/fertig.mjs
SHA256: c31bbd98cd877415272d7456f055e65194f6734f7890f6f2a09267ddd42bf3a4 scripts/sys/gate-db-lib.mjs
SHA256: 1b9d505e1992f9b47098e7afbb66df4cc3ea32fe8feb17ebbb428770aeb26d57 scripts/sys/gate-db.mjs
SHA256: bc7b55baccaac7ce73b60523a2f9ff5f03d5440620ed0f4344553bd9b710b829 scripts/sys/gate-loesch-lib.mjs
SHA256: 7182dda3b37afdd7f3d4f08bc42ed9aabdf7f85b13b221dfd68b46bccad0e038 scripts/sys/gate-loesch.mjs
SHA256: 42c0f033a187dbe2e3ab5fa65937b0cf27803ba5fc7bf2ef3877963bfe5cbe67 scripts/sys/run.mjs
SHA256: 1196d6af08a43d2df103934481dc616593d2f0a350ecd98022e2d8e213d7290f scripts/sys/stufe.mjs
SHA256: c3419930544f147d6d4e5fd13d2eb4d40e53ea4b4a4ffe58f9356ed6a81de3b5 scripts/sys/loesch-register.json
SHA256: 1f72a00bbc085ae8af2ac4b7b609b6686e00b7b141ba0f20aee9733b98a6593a tests/support/marker.ts
SHA256: 2556324e61c9c36758e5388b706c18d13c2ff4604ceca02a30ac572058de51f6 tests/support/partner.ts
SHA256: d63d73f7133fffada101e1be34e5f7d30a7ba9ab54867595f849c8180ca8dfee tests/support/sweep.ts
SHA256: 42c84e359b2240e4f68bd9feed84326212363d36ba71afea14a671f0ebc93490 docs/freigaben/u1b-loesch-freigabe-1.md

# Abnahme u1b, Kontrollrunde (Kennung u1b-1411-a, Stand „u1b WIP 3“)

Datum: 2026-11-14
Auftrag: prüfen, ob AM1 bis AM4 und AM6 aus Runde 1 (`tmp/proof/u1b-abnahme-runde1.md`) behoben sind, ob die Änderungen neue Lücken oder Falschalarme öffnen und ob der Umgang mit den offen gelassenen Funden (`docs/OPEN_ISSUES.md`, u1b-6) vertretbar ist.

Geprüfter Umfang (vollständig gelesen): `tmp/proof/u1b-abnahme-antrag-runde2.md`, `tmp/proof/u1b-abnahme-runde1.md`, `.claude/hooks/guard.mjs`, `scripts/sys/gate-loesch.mjs`, `.claude/settings.json`, `tests/unit/sys-guard.test.ts`, `tests/unit/sys-gate-loesch.test.ts`, `scripts/sys/gate-loesch-lib.mjs`, `scripts/dev-guard.mjs`, `docs/BEKS_EINRICHTUNG.md`, `docs/OPEN_ISSUES.md:1-34`. Ausschnitte: `scripts/sys/run.mjs:1-40`, `scripts/sys/gate-db.mjs:36-49`, `package.json:51-73` (per Suche), `tmp/proof/u1b/runs.jsonl` (Läufe der Suiten per Suche), CLI-Aufrufe in `scripts/*.mjs` (per Suche).

Hinweise zum Nachweis
- Die Hash-Zeilen oben sind unverändert aus dem Antrag übernommen und nicht nachgerechnet (kein Shell-Werkzeug). Gegenprobe auf Stimmigkeit: 13 der 16 Hashes sind gleich denen der Runde 1; abweichend sind genau die drei als geändert genannten Dateien (`guard.mjs`, `settings.json`, `gate-loesch.mjs`). `fertig` rechnet jeden Hash gegen die Datei nach.
- Ausgeführt habe ich nichts. Alle Aussagen zum Verhalten des Guards stammen aus dem Durchspielen der Regexe von Hand an der gelesenen Fassung.
- Das Verhalten der Runde-1-Fassung kenne ich nur aus meinem Bericht der Runde 1 (kein `git diff`). Wo ich „Rückschritt“ schreibe, stützt sich das auf meine damaligen Zeilen zu `guard.mjs:107-108` (Wortprüfung über den ganzen Befehl).
- Jede Änderung an einer der 16 Dateien nach diesem Bericht macht die Abnahme für diese Datei ungültig; dann ist eine neue Runde nötig.
- Das eingebaute advisor-Werkzeug ohne Parameter stand in meiner Werkzeugliste; ich habe es nicht aufgerufen. Keine `.env*` und keine `.claude/settings.local.json` gelesen. Nichts außer dieser Datei geschrieben (zweimal: die erste Fassung enthielt in AM8 eine in sich widersprüchliche Aufzählung, die ich vor der Abgabe berichtigt habe).

## Ergebnis in einem Satz

AM1, AM2, AM3, AM4 und AM6 sind für alle in Runde 1 genannten Formen behoben, gewöhnliche Befehle laufen bis auf einen Falschalarm (Umleitung hinter `db query`) durch; neu offen ist ein mittlerer Fund (AM8: Zuweisung mit Befehlsersetzung, in Runde 1 von mir übersehen und durch das Verschieben der SQL-Wortprüfung jetzt auch für Schreib-SQL wirksam), dazu acht niedrige. Kein Finding der Stufe hoch.

## Findings hoch

Keine.

Einstufung wie in Runde 1: Der Guard ist laut eigener Doku keine Sicherheitsgrenze (`.claude/hooks/guard.mjs:2`), der Weg „Skript schreiben und mit node ausführen“ ist benannt offen (OPEN_ISSUES u1b-3). Keiner der Funde unten lässt ein Gate ohne Freigabe durch oder einen Lauf fälschlich als Nachweis zählen; alle betreffen nur Dev.

## Findings mittel

AM8 (neu). `.claude/hooks/guard.mjs:25` mit `:117`, `:120`, `:123`, `:124` – Eine Zuweisung mit Befehlsersetzung verschluckt den Programmnamen. Die Regel für Umgebungsvariablen in `kern` (ein Wort, Gleichheitszeichen, dann alles bis zum ersten Leerzeichen) liest bei `x=$(supabase db query "…" --linked)` den Teil `x=$(supabase ` als Variablen-Präfix und entfernt ihn. Übrig bleibt `db query "…" --linked`; darauf trifft keine Regel mehr.
  - Von Hand durchgespielt, gehen durch: `x=$(supabase db query "delete from public.x" --linked)`, `out=$(npm run check 2>&1)`, `x=$(psql -c "select 1")`, `x=$(supabase db push)`.
  - Nur zufällig verweigert: `x=$(npx supabase db push)` (die Zuweisungsregel entfernt hier `x=$(npx `, übrig bleibt `supabase db push`).
  - `export X=$(…)`, `local x=$(…)`, `declare x=$(…)` gehen ebenfalls durch (das Wort davor ist keine bekannte Hülle, der Kern beginnt mit `export`).
  - Das ist die übliche Bash-Form, um eine Ausgabe aufzufangen (`OUT=$(…); echo "$OUT" | tail`), also keine seltene Schreibweise.
  - Für Tests und `db push` fängt die zweite Ebene (Lauf zählt nicht, keine Marke; erkannt, nicht verhindert). Für `psql` und Schreib-SQL über `db query` gibt es keine zweite Ebene.
  - Herkunft: `kern` ist laut Antrag seit Runde 1 unverändert; die Lücke bestand für Tests, `psql` und `db push` schon damals und ist mir entgangen. Für Schreib-SQL über `db query` ist sie neu: in Runde 1 lief die Wortprüfung über den ganzen Befehl und traf diese Form; jetzt läuft sie nur noch in Segmenten, deren Kern mit supabase beginnt (`:127-128`).
  - Folge für die Doku: `docs/OPEN_ISSUES.md:17` führt M17 als erledigt und nennt ausdrücklich „Ersetzung“; `docs/BEKS_EINRICHTUNG.md:31` spricht von „einzelnen seltenen Schreibweisen“. Für diese Form stimmt beides nicht.
  - Fix (wenige Zeilen in `kern`): Der Wert einer Präfix-Variablen darf nicht mit Dollar-Klammer oder Backtick beginnen; stattdessen `[export|local|declare|readonly ]NAME=` vor einer Befehlsersetzung als Hülle entfernen, sodass die vorhandene Regel für die öffnende Dollar-Klammer greift und das Programm vorn steht. Zusätzlich das Vorkommen von `db query` am maskierten Segment (`kahl`) feststellen statt am Kern (siehe AN14). Tests: die vier Befehle oben und `export X=$(supabase db push)` verweigert; Gegenproben `x=$(git rev-parse HEAD)`, `FOO=1 npm run build`, `x=$(supabase db query "select 1" --linked)` erlaubt.
  - Empfehlung: vor dem Abschluss-Commit beheben (danach Kontrollrunde nur für `guard.mjs`). Wird es nicht behoben, gehört die Form wörtlich nach u1b-6 und in `docs/BEKS_EINRICHTUNG.md` Abschnitt 3, mit Frist „vor dem nächsten Schritt mit Datenbankarbeit, spätestens zusammen mit AM5“.

Weiter offen aus Runde 1, unverändert und mit Frist in u1b-6: AM5 (`scripts/sys/gate-db.mjs:75-86`, Marke nach gelungenem Push ohne Rettungsweg) und AM7 (`scripts/sys/gate-loesch-lib.mjs:13-14`, Register-Scan ohne CLI-Aufrufe, `scripts/redproof-soll.json` nicht gebunden). Bewertung der Fristen siehe Antworten.

## Findings niedrig

AN14 (neu, Rückschritt gegenüber Runde 1). `.claude/hooks/guard.mjs:125` und `:127` – Die Liste der „Lesebefehle“, hinter denen ein unmaskiertes `db query` ohne jede Prüfung stehen darf, enthält zwei Programme, die ausführen (`npm`, `node`), und Lesebefehle mit Befehlsersetzung werden nicht unterschieden. Durch gehen damit auch mit Schreib-SQL: `echo $(supabase db query "delete from public.x" --linked)` (auch mit Backticks), `node --no-warnings node_modules/supabase/dist/supabase.js db query "delete …" --linked` (die Hüllen-Regel in `:30` greift nur ohne Option vor dem Pfad), `npm x supabase db query "…"`. Ungewöhnliche Formen, gleiche Klasse wie AN1; `npm run t -- cmd …` ist nicht betroffen (`scripts/sys/run.mjs:14-20`, feste Liste). Fix: `npm` und `node` aus der Liste nehmen oder wie supabase durch die SQL-Prüfung schicken; in Segmenten mit Lesebefehl verweigern, wenn der maskierte Text eine Dollar-Klammer oder einen Backtick enthält; Tests für die drei Formen.

AN15 (neu, Falschalarm zur sicheren Seite). `.claude/hooks/guard.mjs:134-140` – Die Erlaubtform kennt keine Umleitung. `supabase db query "select 1" --linked 2>&1`, `… 2>&1 | tail -5`, `… --linked > tmp/out.json` werden mit „Argumente nicht prüfbar“ verweigert, weil `2>&1` bzw. `>` weder Option noch Argument in Anführungszeichen ist. Das ist eine gewöhnliche Form; die Session kommt mit Weglassen der Umleitung oder einer Pipe weiter. Ursache ist mein Fix-Vorschlag aus Runde 1 (AM2). Fix: Umleitungs-Wörter (optional Ziffer, `>` oder `>>`, optional `&` mit Ziffer) samt folgendem Pfadwort vor der Schleife entfernen; die Sperre für `tmp/proof` und `docs/proof` in `:186` bleibt davon unberührt. Tests als Gegenprobe.

AN16 (neu, Rest AM1). `.claude/hooks/guard.mjs:80` – Bei der Bash-Familie zählt als Skript ohne Endung das erste Wort, das nicht mit Bindestrich oder Schrägstrich beginnt. Ein absoluter Pfad ohne Endung (`bash /c/Users/x/tmp/lauf`, `source /tmp/x`) wird damit übersprungen und nicht gelesen. Der Ausschluss des Schrägstrichs ist nur für cmd-Optionen nötig, cmd nimmt an diesem Zweig aber nicht teil. Fix: im Ausweichzweig nur den Bindestrich ausschließen.

AN17 (neu, Rest AM1). `.claude/hooks/guard.mjs:33` und `:57` – Zwei Formen mit Leerzeichen im Pfad bleiben offen: (a) Programmpfad in Anführungszeichen mit Leerzeichen (`& "C:\Program Files\Git\bin\bash.exe" x.sh`, ebenso mit `-c "…"` oder `npm.cmd run check`): `kern` erkennt das Programm nicht, weder Skriptdatei noch Innentext noch Testsperre greifen. (b) Skriptpfad mit Leerzeichen innerhalb einer verschachtelten Shell (`powershell -Command "& 'C:\mit leer\x.ps1'"`, `cmd /c "C:\mit leer\x.bat"`): `grob` entfernt die Anführungszeichen, der Pfad zerfällt in zwei Wörter. Fix: in `kern` den Programmnamen auch aus einem ersten Wort in Anführungszeichen lesen; in `grob` nur die äußere Ebene entquoten oder vor dem Entfernen Wörter bilden.

AN18 (neu, Rest AM3). `.claude/hooks/guard.mjs:104` – Ziel ist das erste Wort mit Skript-Endung. Trägt ein Optionswert selbst eine solche Endung, zählt er als Ziel: `node --import ./tmp/x.mjs scripts/storage-reset.mjs`, `node -r ./tmp/x.js scripts/storage-reset.mjs` gehen durch. Seltene Form. Fix: das Wort nach `-r`, `--require`, `--import`, `--loader`, `--experimental-loader`, `--env-file`, `-C`, `--conditions` (ohne Gleichheitszeichen) überspringen; Test dazu.

AN19 (Bestand, in Runde 1 nicht genannt). `.claude/hooks/guard.mjs:128` – Die Datei-Option wird nur mit Leerzeichen oder Gleichheitszeichen dahinter erkannt. Die angehängte Kurzform (`-ftmp/x.sql`) gilt in der Erlaubtform als gewöhnliche Option und geht durch. Fix: jedes Kurzoptions-Wort verweigern, das den Buchstaben f enthält.

AN20 (Rest AM4, Befehlsebene). `.claude/hooks/guard.mjs:186`, `:189` – AM4 ist für die Schreibwerkzeuge behoben; die Regeln für Shell-Befehle vergleichen weiter mit Beachtung der Groß- und Kleinschreibung, nur das letzte Wort und ohne Umbenennen. Damit entsteht eine Datei mit Berater-Namen ohne Skript: `cd tmp/proof/u1b && mv entwurf.md loesch-freigabe-2.md`, `Rename-Item tmp/proof/u1b/entwurf.md loesch-freigabe-2.md`, `cp x tmp/proof/u1b/Loesch-Freigabe-2.md` (unter Windows dieselbe Datei wie die kleingeschriebene), `Copy-Item x -Destination tmp/proof/u1b/loesch-freigabe-2.md -Force`. `uebernehme` nimmt sie an (`scripts/sys/gate-loesch.mjs:24-35` prüft Inhalt und Hash, nicht den Verfasser); dasselbe gilt für `tmp/proof/<schritt>-abnahme.md`. Setzt Absicht voraus (gefälschter Berichtskopf), darum niedrig; gleiche Klasse wie AN5 und u1-N20. Fix: in `:189` alle Wörter prüfen, kleingeschrieben, `ren`, `rename-item`, `git mv` aufnehmen und Berater-Namen auch ohne Ordner im Wort verweigern. In `entscheideDatei` (`:197`) bleiben Windows-Sonderformen offen (Kurzname des Freigaben-Ordners, Punkt oder Leerzeichen am Namensende, Datenstrom-Anhang); nur festgehalten.

AN21 (Tests).
  - `tests/unit/sys-guard.test.ts:236-254` – Der AM1-Block hat nur Verweigerungen. Jede der acht Formen wäre auch dann verweigert, wenn der Guard die falsche Datei suchte („nicht lesbar“ verweigert ebenfalls). Es fehlt die Gegenprobe, dass ein harmloses Skript in denselben Formen durchgeht (`powershell -NoProfile -ExecutionPolicy Bypass -File gut.ps1`, `& "mit leer\gut.ps1"`, `bash gut`, `cmd /c call gut.bat`: Exit 0). Nach meinem Durchspielen stimmt die Logik; der Test belegt es nicht.
  - `scripts/sys/gate-loesch.mjs:62` – Für die Dev-Prüfung (AM6) gibt es keinen Test; der echte Startzweig ist weiter ungetestet (AN10).
  - `tmp/proof/u1b/runs.jsonl:29-31` – Die neuen Testblöcke liefen als Einzeldateien (194 und 48 bestanden, Baum nicht sauber, Commit WIP 2). Ein Lauf von check, e2e und rls auf dem Endstand fehlt weiter; `fertig` verlangt ihn.

Aus Runde 1 weiter offen und in u1b-6 geführt: AN1 bis AN7, AN10 bis AN13. Erledigt: AN8 (`guard.mjs:11`, Name gestrichen), AN9 (`docs/OPEN_ISSUES.md:6` nennt 14 Ausnahmen, `:24` berichtigt). Nebenbei erledigt aus AN4: `npm.cmd run build` endet nicht mehr mit „nicht lesbar“ (Skriptdatei wird am Kern gelesen), und ein Sperrwort im Commit-Text hinter `db query` verweigert nicht mehr (Test `sys-guard.test.ts:270`).

## Antworten auf die Prüffragen

**Sind AM1 bis AM4 und AM6 behoben?** Ja, für alle Formen aus Runde 1. Von Hand durchgespielt:

- AM1 (`guard.mjs:71-81`, Aufruf `:155`):
  - `powershell -NoProfile -ExecutionPolicy Bypass -File tmp/x.ps1`: kein Innentext (die EncodedCommand-Regel in `:63` trifft `-ExecutionPolicy` nicht, weil nach dem e kein Leerzeichen folgt), Wörter nach dem Shell-Namen, erstes mit Endung ist `tmp/x.ps1`: Inhalt wird gelesen.
  - `npx dotenv -e .env.local -- bash tmp/x.sh`, `FOO=1 bash tmp/x.sh`, `time ./x.sh`: `kern` entfernt die Hüllen, danach wie die Kurzform.
  - `& "C:\Ordner mit Leerzeichen\x.ps1"`: das `&` trennt, das Segment ist ein Wort in Anführungszeichen mit Endung: gelesen.
  - `cmd /c call x.bat`: Innentext `call x.bat`, in der Rekursion entfernt `kern` das `call`, `x.bat` wird gelesen.
  - `bash tmp/x`: Ausweichzweig, erstes Wort ohne Option: gelesen.
  - Reste: AN16, AN17.
- AM2 (`guard.mjs:124-143`):
  - `supabase db query --linked (Get-Content tmp/x.sql -Raw)`: das Wort mit der öffnenden Klammer ist weder Option noch Zitat noch erlaubter Optionswert: verweigert.
  - `cat x.sql | xargs supabase db query --linked`: Segment beginnt mit xargs: verweigert („nur als eigener Befehl“).
  - `@tmp/x.sql`, bloßes Wort, zwei Zitate: verweigert.
  - Gegenproben `"select 1" --linked -o json` und `--linked -o json "select …"`: erlaubt.
  - Reste: AM8, AN14, AN15, AN19.
- AM3 (`guard.mjs:104`): `node --env-file .env.local scripts/storage-reset.mjs`, `node -r dotenv/config scripts/storage-reset.mjs`, `node "scripts/storage-reset.mjs"`, `node 'scripts/admin-call.mjs'`: Ziel ist jeweils das Registerskript: verweigert. `node tmp/hash.mjs scripts/storage-reset.mjs` bleibt erlaubt. Rest: AN18.
- AM4:
  - (a) `scripts/sys/gate-loesch.mjs:24`: der Dateiname muss direkt nach einem Schrägstrich mit dem Freigabe-Präfix beginnen; `tmp/proof/u1b/vor-loesch-freigabe-2.md` ergibt Exit 2 (Test `sys-gate-loesch.test.ts:59`). Jeder Name, den die Regel annimmt, fällt unter die Berater-Regel des Guards (`guard.mjs:12`, `:201`).
  - (b) `guard.mjs:197`: Pfad aufgelöst, Schrägstriche vereinheitlicht, kleingeschrieben; alle fünf Regeln vergleichen an dieser Form (Test `sys-guard.test.ts:283-287` mit fünf Schreibweisen).
  - (c) `.claude/settings.json:70`: deny-Regel für den Freigaben-Ordner vorhanden; `uebernehme` kopiert im Node-Prozess und ist nicht betroffen.
  - Rest auf Befehlsebene: AN20.
- AM6 (`gate-loesch.mjs:62`): `dev-guard` wird nach der Freigabeprüfung und nach dem Trocken-Ausgang, vor dem `spawn` geladen; `uebernehme` endet vorher (`:37`). `npm run loesch` läuft über dotenv (`package.json:70`), `dev-guard` prüft drei Quellen der Ref und setzt die Projekt-Kennung für Kindprozesse (`scripts/dev-guard.mjs:7-22`); die Umgebung des Kindes wird danach gebildet (`gate-loesch.mjs:66`). Gleiche Bauweise wie `gate-db.mjs:43`.

**Öffnen die Änderungen neue Lücken?** Ja, eine mit Gewicht: AM8 zusammen mit AN14. Die Wortprüfung für Schreib-SQL hängt jetzt an zwei Bedingungen (`db query` im Kern erkannt, Kern beginnt mit supabase); beide lassen sich durch eine gewöhnliche Zuweisung bzw. durch `echo`, `node`, `npm` vor dem Aufruf verfehlen. Sonst nicht: Mehrfachanweisungen und Zeilenumbrüche in Anführungszeichen bleiben wegen der Maske im selben Segment und werden am rohen Segment geprüft (`:128`); Heredoc und Datei-Umleitung verweigert `:130` am maskierten Text; Pipe an supabase verweigert `:130` über den Trenner. Geschachtelte, mit Backslash maskierte Anführungszeichen habe ich an vier Mustern durchgespielt: ein wirksames Schreib-Statement bleibt jeweils im maskierten Teil desselben Segments (bewusste Verschleierung bleibt AN12).

**Falschalarme bei gewöhnlichen Befehlen?** Einer (AN15). Durchgespielt:
- `git commit -m "$(cat <<'EOF' … EOF)"`: ein maskiertes Wort, erstes Wort `git`, keine Skriptdatei, kein Interpreter; Text mit Sperrwörtern, `db query`, `--no-verify` oder dem Freigaben-Pfad zählt nicht. Einschränkung unverändert AN4 (ungerade Zahl gerader Anführungszeichen im Text).
- `grep -rn "delete from" tests/support`, `grep -n x scripts/foo.sh`, `cat tmp/x.ps1`, `ls *.ps1`, `chmod +x tmp/x.sh`: durchgelassen (Skript-Endung zählt nur am ersten Wort oder hinter einem Shell-Namen).
- `npm run t -- check`, `npm run t -- tests/unit/x.test.ts`, `npm run build`, `npm run db:push`, `npm run loesch -- uebernehme tmp/proof/u1b/loesch-freigabe-1.md`: durchgelassen.
- `cp tmp/proof/u1b/001-check.log docs/proof/u1b/001-check.log`: Guard lässt durch (danach greift die deny-Regel, OPEN_ISSUES u1b-5).
- `Get-Content docs/PROGRESS.md`, `Get-Content docs/freigaben/x.md`, `Get-Content x | Select-String psql`: durchgelassen.
- `node tmp/x.mjs`, `node --version`, `node tmp/hash.mjs scripts/storage-reset.mjs`, `node --max-old-space-size=4096 tmp/hash.mjs …`: durchgelassen.
- `supabase db query "select …" --linked`, mit `npx`, mit `dotenv -e … --`, mit `-o json`, mit mehrzeiligem SQL in Anführungszeichen, mit `| head` dahinter, mit `; echo EXIT=$?` dahinter: durchgelassen. Mit `2>&1` oder `> datei` im selben Segment: verweigert (AN15). `$r = supabase db query "select 1" --linked` in PowerShell: verweigert („nur als eigener Befehl“), zur sicheren Seite.
- `echo supabase db query`, `grep -rn supabase db query docs`: durchgelassen.

**Ist der Umgang mit den offenen Funden vertretbar?** Ja, mit drei Anmerkungen.
- AM5 („vor der ersten echten Migration“): vertretbar. Der Fehlerfall ist geschlossen (blockiert, nie fälschlich grün), heute ist keine Migration offen. Die Frist ist nur Text; damit sie nicht untergeht, sollte sie in `docs/AUTOPILOT.md` bei „WEITER MIT“ bzw. im Plan des ersten Schritts mit Migration stehen.
- AM7 („vor der ersten Freigabe eines `.mjs`-Registerskripts“): vertretbar für die Bindung von `redproof-soll.json`, weil die Freigabe ohnehin über den Berater läuft; der Freigabe-Antrag muss AM7 dann als Vorbedingung nennen. Der Teil zu `scripts/live-r3.mjs` (führt `db query -f` gegen Dev aus, ohne `dev-guard`, nicht im Register; `scripts/live-r3.mjs:9`) hängt nicht an diesem Anlass: das Skript ist heute mit `node scripts/live-r3.mjs` am Gate vorbei startbar. Die Frist stammt aus meiner Empfehlung der Runde 1 und bleibt tragbar (bestehendes, versioniertes Skript, nur Dev); sauberer wäre, den Registereintrag oder das Löschen des Skripts in den nächsten R3-Schritt zu ziehen.
- Niedrige Funde und die Funde der Lösch-Freigabe 1 (an die nächste Freigabe von `sweep.ts` gebunden): in Ordnung, u1b-6 führt alle Nummern aus Runde 1 (AM5, AM7, AN1 bis AN7, AN10 bis AN13; AN11 bei AN6).
- Nachzutragen in u1b-6: AM8 und AN14 bis AN21 dieses Berichts (sofern nicht behoben); `docs/BEKS_EINRICHTUNG.md:31` nennt die Grenzen dann zutreffend, wenn AM8 behoben oder dort wörtlich genannt ist.

**Doku der drei Dateien?** `docs/OPEN_ISSUES.md:25-29` und `docs/BEKS_EINRICHTUNG.md:30-31`, `:72-73` stimmen mit Code, Einstellungen und Tests überein, bis auf die Aussage zu M17 (AM8). Der Verweis auf `docs/proof/u1b/u1b-abnahme-runde1.md` setzt voraus, dass `npm run bericht` die Runde-1-Datei mitkopiert (Schrittdateien `tmp/proof/u1b-*`, u1b-5).

**Geld, RLS, Schema?** Von der Kontrollrunde nicht berührt (keine Migration, keine Function, kein App-Code).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `.claude/hooks/guard.mjs:11` | Liste der Skriptdateien ohne den entfallenen Plan-Dateinamen: AN8 erledigt |
| `.claude/hooks/guard.mjs:25` | Variablen-Präfix schluckt `NAME=$(programm `: AM8 |
| `.claude/hooks/guard.mjs:27`, `:30`, `:33` | `call` als Hülle, CLI über node ohne Option davor, Programmname ohne Verzeichnis und Endung: in Ordnung (AN14, AN17) |
| `.claude/hooks/guard.mjs:45` | Trenner am maskierten Text, `2>&1` trennt nicht: unverändert in Ordnung |
| `.claude/hooks/guard.mjs:63-64` | EncodedCommand-Regel trifft `-ExecutionPolicy` und `-File` nicht; `-Command` mit Optionswerten: in Ordnung |
| `.claude/hooks/guard.mjs:71` | Wörter: Anführungszeichen als ein Wort, Zeichen entfernt: in Ordnung |
| `.claude/hooks/guard.mjs:75-81` | Skriptdatei am Kern, erstes Wort mit Endung, Ausweichzweig für die Bash-Familie: AM1 behoben (AN16) |
| `.claude/hooks/guard.mjs:104-105` | Ziel = erstes Wort mit Skript-Endung, normalisiert: AM3 behoben (AN18) |
| `.claude/hooks/guard.mjs:124-125` | `db query` am Kern erkannt, Liste mit `npm` und `node`: AN14 |
| `.claude/hooks/guard.mjs:127-130` | Wortprüfung am rohen Segment, Datei-Option, Pipe, `<`, Ersetzung: in Ordnung für Segmente, die mit supabase beginnen (AM8, AN19) |
| `.claude/hooks/guard.mjs:132-142` | Erlaubtform: Option, Optionswert ohne Sonderzeichen, höchstens ein Zitat: AM2 behoben (AN15) |
| `.claude/hooks/guard.mjs:155-165` | Skriptdatei nur ohne Innentext, nicht lesbar heißt verweigert, Rekursion mit Tiefe: in Ordnung |
| `.claude/hooks/guard.mjs:186`, `:189` | Befehlsregeln für Nachweise unverändert, nur letztes Wort, Schreibweise beachtet: AN20 |
| `.claude/hooks/guard.mjs:196-204` | Pfad aufgelöst und kleingeschrieben, fünf Regeln: AM4 b behoben |
| `.claude/settings.json:7`, `:9`, `:69-70`, `:112-113` | Matcher, Blockieren bei Hook-Fehler, deny für `docs/proof` und den Freigaben-Ordner, ask für `npm run loesch`: AM4 c behoben |
| `scripts/sys/gate-loesch.mjs:24` | Quelle nur unter `tmp/proof`, ohne `..`, Dateiname beginnt mit dem Freigabe-Präfix: AM4 a behoben |
| `scripts/sys/gate-loesch.mjs:27-35` | Register, Hash, Modell, Urteil; Kopie ohne Überschreiben: unverändert in Ordnung (AN6, AN20) |
| `scripts/sys/gate-loesch.mjs:53-66` | Register, Freigaben aus HEAD, Trocken-Ausgang, Dev-Prüfung, dann Start: AM6 behoben |
| `scripts/sys/gate-loesch-lib.mjs:17`, `:26-29` | Freigaben nur aus dem Commit, Namensmuster passt zu den Kopien von `uebernehme`: in Ordnung |
| `scripts/dev-guard.mjs:7-22` | drei Ref-Quellen, Abbruch mit Exit 2, Projekt-Kennung für Kindprozesse: in Ordnung |
| `scripts/sys/gate-db.mjs:43` | gleiche Bauweise wie im Lösch-Gate: in Ordnung |
| `scripts/sys/run.mjs:14-20`, `:35` | `cmd` nur mit fester Liste: AN14 betrifft das Start-Programm nicht |
| `package.json:64`, `:66-70` | Aliase der Registerskripte, `db:push`, `loesch` über dotenv: in Ordnung |
| `tests/unit/sys-guard.test.ts:236-254` | acht AM1-Formen verweigert, keine Gegenprobe: AN21 |
| `tests/unit/sys-guard.test.ts:258-274` | fünf AM2-Verweigerungen, vier Gegenproben: in Ordnung; Umleitung und Zuweisung fehlen (AN15, AM8) |
| `tests/unit/sys-guard.test.ts:275-287` | vier AM3-Formen, fünf Pfad-Schreibweisen: in Ordnung |
| `tests/unit/sys-guard.test.ts:348-351` | Gegenproben für Skripte, die ein Registerskript nur als Argument nennen: bleiben mit der neuen Ziel-Regel gültig |
| `tests/unit/sys-gate-loesch.test.ts:57-60` | `uebernehme`: außerhalb, mit `..`, mit Vorsilbe, andere Endung, je Exit 2: in Ordnung |
| `tmp/proof/u1b/runs.jsonl:29-31` | Guard-Tests einmal rot (1 von 194), dann 194 bestanden; Lösch-Gate 48 bestanden; je EXIT im Lauf vermerkt, Baum nicht sauber |
| `docs/OPEN_ISSUES.md:6`, `:24` | 14 Ausnahmen, Satz zur Selbstprüfung berichtigt: AN9 erledigt |
| `docs/OPEN_ISSUES.md:17` | M17 „erledigt“ samt „Ersetzung“: stimmt für die Zuweisungsform nicht (AM8) |
| `docs/OPEN_ISSUES.md:25-29` | u1b-6 führt alle offenen Nummern der Runde 1 mit Frist: in Ordnung |
| `docs/BEKS_EINRICHTUNG.md:30-31`, `:73` | Auto-Modus-Vermerk mit Verweis auf u1b-3 und u1b-6, Ablauf der Freigabe: stimmig bis auf AM8 |
| `scripts/live-r3.mjs:9` | CLI-Aufruf mit Datei gegen Dev, nicht im Register: AM7 weiter offen |

Offene Findings hoch: 0
