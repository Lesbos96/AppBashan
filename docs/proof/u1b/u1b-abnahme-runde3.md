Modell: claude-fable-5-2
SHA256: 4c5fca52e183db559e64ddd5c330d80a8966fc1fcb7752f12c4ea70f44590823 .claude/hooks/guard.mjs
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

# Abnahme u1b, Kontrollrunde 3 (Kennung u1b-1411-a, Stand „u1b WIP 4“, Commit 51109d9)

Datum: 2026-11-14
Auftrag: prüfen, ob AM8 und AN14 bis AN21 aus Runde 2 (`tmp/proof/u1b-abnahme-runde2.md`) behoben sind und ob die Änderungen (Prüfung von Befehlsersetzungen, drei Lesarten des Innentexts) neue Lücken oder Falschalarme bei gewöhnlichen Befehlen öffnen.

Geprüfter Umfang (vollständig gelesen): `tmp/proof/u1b-abnahme-antrag-runde3.md`, `tmp/proof/u1b-abnahme-runde2.md`, `.claude/hooks/guard.mjs` (255 Zeilen), `tests/unit/sys-guard.test.ts:1-145` und `:355-430` (neuer Block), `scripts/scan-proof.mjs`. Ausschnitte: `docs/OPEN_ISSUES.md:15-30`, `docs/BEKS_EINRICHTUNG.md:29-32`, `tmp/proof/u1b/runs.jsonl:30-35`.

Hinweise zum Nachweis
- Die Hash-Zeilen oben sind unverändert aus dem Antrag übernommen und nicht nachgerechnet (kein Shell-Werkzeug). Gegenprobe: 15 der 16 Hashes sind gleich denen der Runde 2, abweichend ist nur `guard.mjs`, wie im Antrag genannt. `fertig` rechnet jeden Hash gegen die Datei nach.
- Ausgeführt habe ich nichts. Alle Aussagen zum Verhalten des Guards stammen aus dem Durchspielen der Regexe von Hand an der gelesenen Fassung; wo ich „geht durch“ schreibe, habe ich Maske, Segmente, beide Kerne und alle Regeln bis zum Ende der Schleife verfolgt.
- Das Verhalten der Runde-2-Fassung kenne ich nur aus meinem damaligen Bericht (kein `git diff`). „Rückschritt“ stützt sich auf die dort beschriebene Regel für Umgebungsvariablen.
- Jede Änderung an einer der 16 Dateien nach diesem Bericht macht die Abnahme für diese Datei ungültig.
- Das eingebaute advisor-Werkzeug ohne Parameter stand in meiner Werkzeugliste und wurde mir von der Laufumgebung nahegelegt; ich habe es wegen des Verbots in Auftrag und CLAUDE.md nicht aufgerufen. Keine `.env*` und keine `.claude/settings.local.json` gelesen. Nichts außer dieser Datei geschrieben.

## Ergebnis in einem Satz

AM8 und AN14 bis AN21 sind für alle in Runde 2 wörtlich genannten Formen behoben und gewöhnliche Befehle laufen durch; die neue Prüfung der Befehlsersetzungen hat aber zwei Erkennungslücken, durch die die übliche Form mit Anführungszeichen (`NAME="$(…)"`) bei gewöhnlichem SQL weiter durchgeht (AM9, mittel), der AM8-Fix hat einen kleinen Rückschritt bei Variablen-Präfixen erzeugt (AN22), und es gibt einen neuen Falschalarm bei Commit-Texten (AN23). Kein Finding der Stufe hoch.

## Findings hoch

Keine.

Einstufung wie in Runde 1 und 2: Der Guard ist laut eigener Doku keine Sicherheitsgrenze (`.claude/hooks/guard.mjs:2`), der Weg „Skript schreiben und mit node ausführen“ ist benannt offen (OPEN_ISSUES u1b-3). Alle Funde betreffen nur Dev; kein Lauf zählt dadurch fälschlich als Nachweis.

## Findings mittel

AM9 (Rest von AM8 und AN14). `.claude/hooks/guard.mjs:83-86` mit `:136-139`, `:28`, `:40`, `:48`, `:148` – Befehlsersetzungen werden je Segment und mit einem Muster gesucht, das höchstens eine Klammerebene innerhalb der Ersetzung kennt. Zwei Fälle entgehen ihm:
  - (a) Im Text der Ersetzung stehen Klammern zwei Ebenen tief oder eine einzelne unpaarige Klammer. Gezählt wird am rohen Text, Klammern im SQL zählen also mit: `values (now())`, `coalesce(max(a), 0)`, `(select max(id) from y)` genügen. Das Muster findet dann gar keinen Treffer; die Ersetzung wird nicht geprüft.
  - (b) Die Ersetzung steht in doppelten Anführungszeichen und enthält selbst doppelte Anführungszeichen mit einem Trennzeichen darin (Semikolon, Zeilenumbruch, Pipe, `&&`). Die Maske (`:40`) kennt keine Schachtelung, der innere Text liegt für sie außerhalb; `segmente` (`:48`) schneidet mitten durch die Ersetzung, im ersten Stück fehlt die schließende Klammer, das Muster trifft nicht.
  - In beiden Fällen bleibt nur `kern`, und der löst nur die bloße Form `NAME=$(` auf (`:27`). Bei `NAME="$(…` greift die allgemeine Variablen-Regel (`:28`) und entfernt `NAME="$(programm ` samt Programmnamen, wie in Runde 2 beschrieben.
  - Von Hand durchgespielt, gehen durch:
    1. `OUT="$(supabase db query "insert into public.x (a) values (now())" --linked)"` (Fall a)
    2. `OUT="$(supabase db query "update public.x set a = 1 where id = 2; select 1" --linked)"` (Fall b; ebenso mit Zeilenumbruch im SQL)
    3. `echo $(supabase db query "delete from public.x where id = (select max(id) from public.y)" --linked)` (Fall a; der maskierte Kern beginnt mit `echo`, das in der Leseliste `:148` steht: die AN14-Form)
    4. `OUT="$(npm run check 2>&1 | grep -E "FAIL|Error")"` (Fall b)
    5. `OUT="$(psql -c "select 1; delete from public.x")"` (Fall b)
  - Richtig verweigert werden dieselben Formen ohne Schachtelung und ohne Trennzeichen (`OUT="$(supabase db query "delete from public.x" --linked)"`, `echo "$(npm run check)"`) und jede bloße Zuweisung `x=$(…)` unabhängig vom Inhalt (dort hilft `kern`).
  - Gewicht: deutlich schmaler als AM8 in Runde 2 (die häufigste Form ist zu), aber `NAME="$(…)"` ist die von Stilregeln empfohlene Bash-Schreibweise und geschachtelte Klammern sind gewöhnliches SQL. Für 1, 2, 3 und 5 gibt es keine zweite Ebene; für 4 fängt sie (Lauf zählt nicht).
  - Fix (ein kleiner Abtaster statt des Musters, etwa 20 Zeilen): in `entscheideBefehl` vor der Segment-Schleife über den ganzen Befehl laufen; ab jeder öffnenden Dollar-Klammer außerhalb einfacher Anführungszeichen die Klammern bis zur passenden schließenden zählen und dabei den Inhalt von Anführungszeichen innerhalb der Ersetzung überspringen; findet sich keine passende Klammer, den Rest des Befehls als Innentext nehmen; Backticks paarweise; jeden Innentext rekursiv prüfen. Tests: die fünf Formen oben verweigert; Gegenproben `OUT="$(supabase db query "select count(*) from public.x where a = coalesce(b, lower(c))" --linked)"` und `OUT="$(git log --format="%h;%s" -1)"` erlaubt.
  - Empfehlung: vor dem Abschluss-Commit beheben, danach Kontrollrunde nur für `guard.mjs` und den Testblock. Wird es nicht behoben: die Formen 1 bis 5 wörtlich nach u1b-6 und in `docs/BEKS_EINRICHTUNG.md` Abschnitt 3, Frist „vor dem nächsten Schritt mit Datenbankarbeit, spätestens zusammen mit AM5“; außerdem die Aussagen in `docs/OPEN_ISSUES.md:17` und `:25` einschränken (siehe AN28).

Weiter offen aus Runde 1, unverändert und mit Frist in u1b-6: AM5 und AM7 (Bewertung der Fristen wie in Runde 2).

## Findings niedrig

AN22 (neu, Rückschritt durch den AM8-Fix). `.claude/hooks/guard.mjs:27` – Die neue Regel entfernt `NAME=` vor jeder Befehlsersetzung, auch wenn die Ersetzung nur der Wert eines Variablen-Präfixes ist und der eigentliche Befehl dahinter steht. Der Kern beginnt dann mit dem Inhalt der Ersetzung statt mit dem Programm.
  - `FOO=$(pwd) npm run check` geht durch (Kern: `pwd) npm run check`). In Runde 2 verweigert, weil die allgemeine Variablen-Regel `FOO=$(pwd) ` als Ganzes entfernte.
  - `FOO=$(cat tmp/wert) supabase db query "delete from public.x" --linked` geht durch: der maskierte Kern beginnt mit `cat`, das in der Leseliste steht (`:148`), die SQL-Prüfung (`:150`) läuft nicht. In Runde 2 verweigert („nur als eigener Befehl“).
  - `FOO=$(cat tmp/wert) psql -c "…"` geht durch (wie schon in Runde 2). `FOO=$(pwd) supabase db push` bleibt verweigert (`:143` sucht im ganzen Kern).
  - Seltene Form, darum niedrig; sie entsteht aber direkt aus dem Fix. Fix: `NAME=` plus vollständige Ersetzung plus Leerraum zuerst als Variablen-Präfix entfernen (den Inhalt prüft die Ersetzungs-Prüfung ohnehin); die Regel aus `:27` nur anwenden, wenn die Ersetzung bis zum Segmentende reicht. Lässt sich mit dem Abtaster aus AM9 erledigen. Tests: die drei Formen verweigert, `FOO=$(pwd) npm run build` erlaubt.

AN23 (neu, Falschalarm zur sicheren Seite). `.claude/hooks/guard.mjs:84-85` – Die Heredoc-Ausnahme wirkt nur, wenn das Muster die ganze Ersetzung mit dem Heredoc als einen Treffer erfasst. Enthält der Commit-Text Klammern zwei Ebenen tief, eine einzelne schließende Klammer (Aufzählung `1)`) oder eine gerade Zahl Apostrophe um eine Klammer, scheitert der Treffer oder endet zu früh; danach werden Ersetzungen und Backtick-Paare im Text als Befehle geprüft.
  - Beispiel (durchgespielt): Commit über `"$(cat <<'EOF' … EOF)"` mit der Textzeile „Guard (Rest (AM9)) sperrt“ und danach `supabase db push` in Backticks: verweigert mit der Meldung zur Datenbank. Ebenso mit „1) …“ und `npm run check` in Backticks.
  - Betroffen sind nur Texte, die einen gesperrten Befehl oder einen Skriptpfad (`.sh`, `.ps1`: „nicht lesbar“) in Backticks oder Dollar-Klammern nennen; das kommt in diesem Repo bei Guard-Arbeit vor. Ausweg bis zum Fix: Text umstellen oder `git commit -F tmp/msg.txt`.
  - Gleiche Ursache: Heredoc-Zeilen außerhalb einer Ersetzung (jede Zeile ist ein Segment) und `grep "\$(…)" datei` bzw. maskierte Backticks in doppelten Anführungszeichen (der Backslash wird nicht beachtet).
  - Kehrseite (nur mit Absicht, Klasse AN12): bei einem Heredoc mit unzitiertem Endwort führt Bash Ersetzungen im Text aus, der Guard behandelt ihn als Text; Befehle hinter dem Heredoc-Ende innerhalb derselben Ersetzung werden nicht geprüft; zwei Apostrophe innerhalb doppelter Anführungszeichen verstecken eine dazwischenliegende Ersetzung (`:84`).
  - Fix (mit dem Abtaster aus AM9): Heredoc-Körper mit zitiertem Endwort bis zur Endwort-Zeile vor dem Abtasten entfernen, bei unzitiertem Endwort abtasten; Backslash vor Dollar oder Backtick als wörtlich behandeln. Test: Commit-Heredoc mit geschachtelten Klammern und einem gesperrten Befehl in Backticks, Exit 0.

AN24 (Rest AN17 a). `.claude/hooks/guard.mjs:135` mit `:143`, `:147` – Der maskierte Kern sieht ein Programm in Anführungszeichen nicht (der Name ist durch Unterstriche ersetzt). Die Regeln für Tests, `psql`, Shells und Interpreter laufen am rohen Kern und greifen; die Regeln für die Supabase-CLI laufen am maskierten Kern und greifen nicht: `& "C:\Tools\supabase.exe" db push` und `"supabase" db query "delete from public.x" --linked` gehen durch. Außerdem wirkt `:24` nur am Segmentanfang: ein Variablen-Präfix vor einem zitierten Programmpfad mit Leerzeichen wird nicht aufgelöst. Ungewöhnliche Formen (die CLI läuft hier über `npx`). Fix: den zitierten Programmnamen vor dem Maskieren auflösen (maskierten Kern aus dem rohen Kern bilden) und die Ersetzung aus `:24` in die Schleife ziehen; Tests.

AN25 (Rest AN18). `.claude/hooks/guard.mjs:123` – (i) Ein Optionswort mit Gleichheitszeichen und Skript-Endung zählt als Ziel: `node --import=./tmp/x.mjs scripts/storage-reset.mjs` geht durch. (ii) Vorgeladene Module werden ausgeführt, aber übersprungen: `node --import ./scripts/storage-reset.mjs tmp/x.mjs` geht durch. Fix: Wörter mit führendem Bindestrich sind nie das Ziel; die Werte der Vorlade-Optionen (beide Schreibweisen) zusätzlich gegen das Register prüfen; Tests.

AN26 (Rest AN20, Befehlsebene). `.claude/hooks/guard.mjs:212-219` – Die fünf Formen aus Runde 2 sind zu; offen bleibt:
  - (i) Das Ziel ist nicht das letzte Wort: `Move-Item x tmp/proof/u1b/loesch-freigabe-2.md -Force`, `cp x tmp/proof/u1b/loesch-freigabe-2.md 2>&1`, `Rename-Item tmp/proof/u1b/entwurf.md -NewName loesch-freigabe-2.md -Force`. Bei `Copy-Item -LiteralPath x -Destination tmp/proof/u1b/loesch-freigabe-2.md` nimmt `:213` das Wort nach `-LiteralPath`, also die Quelle.
  - (ii) Ordner als Ziel, Name aus der Quelle: `cp tmp/x/loesch-freigabe-2.md tmp/proof/u1b/` (als u1-Fund schon in `docs/OPEN_ISSUES.md:19` geführt).
  - (iii) `:215` vergleicht weiter mit Beachtung der Schreibweise und unaufgelöst: `Set-Content TMP\Proof\u1b\loesch-freigabe-2.md -Value x` und eine Umleitung nach `tmp//proof/…` gehen durch; `norm` (`:58`) löst `tmp/./proof` nicht auf (der Antrag schreibt „aufgelöst“).
  - Setzt Absicht und einen gefälschten Berichtskopf voraus, darum niedrig. Fix: alle Wörter ohne führenden Bindestrich prüfen (bei Ordner-Ziel auch den Dateinamen der Quelle), `-NewName` aufnehmen, `-LiteralPath` nur bei Schreibbefehlen als Ziel werten, `:215` ohne Beachtung der Schreibweise, `/./` und doppelte Schrägstriche zusammenziehen. Sonst zu „AN20 Rest“ in u1b-6.

AN27 (kleine Falschalarme zur sicheren Seite, Fix freigestellt).
  - `.claude/hooks/guard.mjs:35`, `:152-153` – Zuweisung mit Backticks statt Dollar-Klammer um ein erlaubtes `db query` mit select: verweigert, weil der schließende Backtick als Ersetzung im Argument zählt. Ebenso PowerShell `… --linked 2>$null`.
  - `.claude/hooks/guard.mjs:151` – Die Wortliste läuft über das rohe Segment; seit Umleitungen erlaubt sind, treffen auch Zielnamen und Variablennamen: `supabase db query "select 1" --linked > tmp/update.json` und `set=$(supabase db query "select 1" --linked)` werden verweigert.
  - `.claude/hooks/guard.mjs:219` – `cd docs/proof/u1b && cp ../../../tmp/proof/u1b-abnahme.md u1b-abnahme.md` wird verweigert (Berater-Name ohne Verzeichnis); mit Zielpfad oder über `npm run bericht` kein Problem.
  - Unverändert: `bash -c 'supabase db query "select 1" --linked'` wird über die Lesart „alles entquotet“ verweigert („nicht prüfbar“).

AN28 (Tests, Nachweis, Doku).
  - `tests/unit/sys-guard.test.ts:363-395` – Es fehlen die Formen aus AM9 (Anführungszeichen um die Ersetzung, geschachtelte Klammern, Trennzeichen im inneren Text), AN22, AN24 bis AN26. Die Heredoc-Gegenprobe (`:389`) hat nur paarige Klammern einer Ebene und belegt den Fall aus AN23 nicht.
  - `tmp/proof/u1b/runs.jsonl:35` – Die Guard-Tests liefen als Einzeldatei (225 bestanden, EXIT 0) auf dem Hash von WIP 3 mit unsauberem Baum. Auf dem Endstand 51109d9 gibt es noch keinen Lauf; e2e Nr. 32 und rls Nr. 33 (beide EXIT 0, sauber, stabil) gehören zu WIP 3. Ob `fertig` sie für den Endstand annimmt, entscheidet `fertig`; der im Antrag angekündigte `check` steht aus.
  - `docs/OPEN_ISSUES.md:25` – „`x=$(…)` und andere Befehlsersetzungen werden als eigene Befehle geprüft“ ist ohne Einschränkung zu weit (AM9); `:17` (M17 „erledigt“ samt „Ersetzung“) und `docs/BEKS_EINRICHTUNG.md:31` („einzelne seltene Schreibweisen“) ebenso, solange AM9 offen ist. In u1b-6 nachzutragen: AM9 und AN22 bis AN27, soweit nicht behoben.

Aus Runde 1 weiter offen und in u1b-6 geführt: AN1 bis AN7, AN10 bis AN13.

## Antworten auf die Prüffragen

**Ist AM8 behoben?** Für alle Formen meines Berichts ja. Durchgespielt:
- `x=$(supabase db query "delete from public.x" --linked)`: `:27` entfernt `x=`, `:29` die Dollar-Klammer, `:35` die schließende Klammer; beide Kerne beginnen mit supabase, die Wortliste trifft `delete` (`:151`). Zusätzlich verweigert schon die Rekursion über die Ersetzung (`:136-139`).
- `out=$(npm run check 2>&1)`, `x=$(psql -c "select 1")`, `x=$(supabase db push)`, `export X=$(supabase db push)`, `local x=$(npx vitest run)`: verweigert über Kern und über Rekursion. `declare -r x=$(…)` (Option vor dem Namen): nur über die Rekursion, verweigert.
- Gegenproben `x=$(git rev-parse HEAD)`, `FOO=1 npm run build`, `x=$(supabase db query "select 1" --linked)`, auch mit `npx`, mit `2>&1` in der Klammer und mit `| tail -1` in der Klammer: erlaubt. Die umschließende Ersetzung zählt in `:152` nicht als Ersetzung im Argument; eine zweite im Argument (`"$(cat x.sql)"`) wird weiter verweigert.
- Reste: AM9 (Anführungszeichen um die Ersetzung), AN22 (Präfix-Variable).

**Sind AN14 bis AN21 behoben?**
- AN14: ja für die drei Formen. `echo $(supabase db query "delete from public.x" --linked)` und die Backtick-Form: Rekursion verweigert. `node --no-warnings …/supabase.js db query "delete …"`: `:33` setzt supabase an den Anfang, Wortliste trifft. `npm x supabase db query …` und node mit Optionswert vor dem Pfad: erstes Wort nicht mehr in der Leseliste, verweigert. Rest mit geschachtelten Klammern: AM9 Nr. 3.
- AN15: ja. `2>&1` trennt nicht (`:48`), `:158` entfernt `2>&1`, `> datei`, `>> datei`, `&> datei` vor der Argumentprüfung; ein Argument lässt sich dahinter nicht verstecken, weil Wortliste und die Prüfung auf `<` und Ersetzung am ganzen Segment laufen. Umleitung nach `tmp/proof` oder `docs/proof` verweigert weiter `:215`.
- AN16: ja. `bash /c/Users/x/tmp/lauf` und `source /tmp/x`: `:98` nimmt das erste Wort ohne Bindestrich, die Datei wird gelesen.
- AN17: ja für die genannten Formen. (a) `& "C:\Program Files\Git\bin\bash.exe" x.sh`, mit `-c "…"`, und `npm.cmd run check` im zitierten Pfad: `:24` setzt den Programmnamen ein. (b) `powershell -Command "& 'C:\mit leer\x.ps1'"` über die Lesart „außen entquotet“, `cmd /c "C:\mit leer\x.bat"` über die Lesart „unverändert“: der Pfad bleibt ein Wort und wird gelesen. Rest: AN24.
- AN18: ja für die genannten Formen (`--import ./tmp/x.mjs`, `-r ./tmp/x.js` vor dem Registerskript: verweigert; `node tmp/hash.mjs scripts/storage-reset.mjs` bleibt erlaubt). Rest: AN25.
- AN19: ja. `-ftmp/x.sql`, `-f tmp/x.sql`, `--file`, `--file=`: verweigert (`:151`). Lange Optionen mit f (`--format`) und `-e` aus der dotenv-Hülle treffen nicht.
- AN20 (Befehlsebene): ja für die fünf Formen (`mv` nach `cd`, `Rename-Item`, andere Schreibweise, `-Destination … -Force`, `git mv`). Rest: AN26.
- AN21: der erste Punkt ja (`tests/unit/sys-guard.test.ts:405-418`: harmlose Skripte in vier Formen Exit 0, vier schädliche Exit 2; der Inhalt entscheidet, also wird die richtige Datei gelesen). Test für die Dev-Prüfung des Lösch-Gates und Läufe auf dem Endstand: weiter offen (AN10, AN28).

**Öffnen die Änderungen neue Lücken?**
- Prüfung der Befehlsersetzungen: Sie fügt nur Verweigerungen hinzu, öffnet für sich also nichts. Neu geöffnet hat die Begleitänderung in `kern` (`:27`) die Präfix-Form (AN22). Die Erkennung selbst ist unvollständig (AM9); diese Formen gingen auch in Runde 2 durch.
- Drei Lesarten des Innentexts: keine neue Lücke (jede Lesart kann nur verweigern). Durchgespielt an `bash -c "ls"`, `bash -c "npm run t -- check"`, `cmd /c "npm run build"`, `powershell -Command "& { npm run check }"` (verweigert), `powershell -NoProfile -Command "& 'C:\mit leer\x.ps1' -Arg 1"` (Datei wird gelesen), `bash -c "bash 'mit leer/x.sh'"` (gelesen).
- Rekursionstiefe: Ersetzungen und Lesarten teilen sich die Grenze von 4 (`:130`); bei den gewöhnlichen Formen wird sie nicht erreicht. Das Muster in `:85` hat getrennte Alternativen, kein Laufzeitrisiko.

**Falschalarme bei gewöhnlichen Befehlen?** Bei den genannten Formen keiner, mit der Einschränkung AN23. Durchgespielt:
- `git commit -m "$(cat <<'EOF' … EOF)"` mit paarigen Klammern einer Ebene, auch mit `x=$(supabase db push)`, `npm run check` und einem Registerskript im Text: erlaubt (ein Treffer, beginnt mit dem Heredoc, gefiltert). Mit geschachtelten oder unpaarigen Klammern und einem gesperrten Befehl in Backticks oder Dollar-Klammern: verweigert (AN23).
- `git commit -m "… $(date +%F) …"`: erlaubt. Ein gesperrter Befehl in Dollar-Klammern oder Backticks innerhalb doppelter Anführungszeichen wird verweigert; das ist richtig, Bash würde ihn ausführen. In einfachen Anführungszeichen: erlaubt.
- `grep -rn "delete from" tests/support`, `grep -n 'x=$(supabase' datei`, `rg "supabase db query" .claude`, `grep -rn supabase db query docs`: erlaubt. `grep "\$(supabase db push)" datei` in doppelten Anführungszeichen: verweigert (AN23).
- `npm run t -- check`, `npm run t -- check 2>&1 | tail -20`, `npm run t -- tests/unit/sys-guard.test.ts`, `npm run build`, `npm run db:push`: erlaubt.
- `cp tmp/proof/u1b/001-check.log docs/proof/u1b/001-check.log`, `cp tmp/proof/u1b-abnahme.md docs/proof/u1b/u1b-abnahme.md`, `mv tmp/proof/u1b-abnahme.md tmp/proof/u1b-abnahme-runde2.md`, `mv a.txt b.txt`, `Copy-Item a b -Force`: erlaubt.
- `Get-Content docs/PROGRESS.md -Tail 20`, `Get-Content tmp/proof/u1b/runs.jsonl | Select-Object -Last 3`, `"$($x.Count) Zeilen"`, `"EXIT=$LASTEXITCODE"`, PowerShell-Zeilenfortsetzung mit einem Backtick je Zeile: erlaubt.
- `node tmp/x.mjs`, `node tmp/x.mjs "$(git rev-parse HEAD)"`, `node tmp/hash.mjs scripts/storage-reset.mjs`: erlaubt.
- `supabase db query "select …" --linked`, mit `npx`, mit `-o json`, mit `2>&1`, mit `> tmp/out.json`, mit `| tail -5`, mit einfachen Anführungszeichen im SQL (`interval '1 day'`), mit `created_at` im SQL, als `x=$(…)` und als `x="$(…)"`: erlaubt. Ausnahmen siehe AN27.
- Befehle mit Backticks in Anführungszeichen: in einfachen erlaubt; in doppelten wird der Inhalt wie ein Befehl geprüft (harmloser Inhalt erlaubt, gesperrter verweigert, Skriptpfad mit `.sh` oder `.ps1` wird gelesen bzw. „nicht lesbar“). Für Bash ist das richtig. Im PowerShell-Werkzeug ist der Backtick ein Escape-Zeichen; zwei davon um einen gesperrten Befehl in einer Zeile ergeben dort einen Falschalarm, die Form ist aber in PowerShell ohnehin fehlerhaft.

**Ist der Umgang mit den offenen Funden vertretbar?** Ja, wie in Runde 2 bewertet; u1b-6 führt AM5, AM7, AN1 bis AN7, AN10 bis AN13 und den Rest von AN20 mit Frist. Nachzutragen sind AM9 und AN22 bis AN27 dieses Berichts, soweit nicht behoben, und die drei Doku-Stellen aus AN28.

**Geld, RLS, Schema?** Von der Kontrollrunde nicht berührt (keine Migration, keine Function, kein App-Code).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `.claude/hooks/guard.mjs:24` | Programmpfad in Anführungszeichen mit Leerzeichen wird am Segmentanfang aufgelöst: AN17 a behoben (AN24) |
| `.claude/hooks/guard.mjs:27` | `NAME=` vor Dollar-Klammer oder Backtick entfernt, auch mit export, local, declare, readonly, typeset: AM8 behoben; entfernt auch bei Präfix-Variablen (AN22) |
| `.claude/hooks/guard.mjs:28` | allgemeine Variablen-Regel unverändert; schluckt bei `NAME="$(programm ` weiter den Programmnamen (AM9) |
| `.claude/hooks/guard.mjs:33` | node mit Optionen vor dem CLI-Pfad wird zu supabase: AN14 behoben; Option mit getrenntem Wert fällt über die Leseliste auf „nur als eigener Befehl“ |
| `.claude/hooks/guard.mjs:40`, `:48` | Maske ohne Schachtelung, Trenner am maskierten Text, `2>&1` trennt nicht: Ursache von AM9 b |
| `.claude/hooks/guard.mjs:63-66`, `:79` | drei Lesarten (außen entquotet, unverändert, alles entquotet): AN17 b behoben, keine neue Lücke |
| `.claude/hooks/guard.mjs:84-85` | einfache Anführungszeichen entfernt, Muster mit einer Klammerebene, Heredoc-Filter am Anfang des Treffers: AM9 a, AN23 |
| `.claude/hooks/guard.mjs:96-98` | Ausweichzweig der Bash-Familie schließt nur den Bindestrich aus: AN16 behoben |
| `.claude/hooks/guard.mjs:123` | Wert nach acht Optionen wird übersprungen: AN18 behoben; Schreibweise mit Gleichheitszeichen und Vorlade-Ziel offen (AN25) |
| `.claude/hooks/guard.mjs:135-139` | maskierter Kern, Rekursion über Ersetzungen je Segment mit Tiefe: in Ordnung bis auf AM9, AN24 |
| `.claude/hooks/guard.mjs:140-146` | Testsperre und `psql` am rohen Kern (verankert), `db push` am maskierten Kern (unverankert): unverändert |
| `.claude/hooks/guard.mjs:148` | Leseliste ohne npm und node: AN14 behoben; `echo`, `cat`, `git` bleiben (AM9 Nr. 3, AN22) |
| `.claude/hooks/guard.mjs:151` | Wortliste am rohen Segment, Datei-Option auch angehängt: AN19 behoben; trifft auch Umleitungsziele (AN27) |
| `.claude/hooks/guard.mjs:152-153` | umschließende Ersetzung zählt nicht, weitere Ersetzung im Argument verweigert: in Ordnung |
| `.claude/hooks/guard.mjs:158` | Ausgabe-Umleitungen aus den Argumenten entfernt: AN15 behoben, kein Versteck für ein Argument |
| `.claude/hooks/guard.mjs:173-180` | alle Lesarten rekursiv, erste Verweigerung gilt: in Ordnung |
| `.claude/hooks/guard.mjs:212-214` | Ziel nach `-Destination` oder `-LiteralPath`, sonst letztes Wort, kleingeschrieben, nicht aufgelöst: AN26 |
| `.claude/hooks/guard.mjs:215` | Umleitung und Schreibbefehle nach `tmp/proof` und `docs/proof`, mit Beachtung der Schreibweise: AN26 iii |
| `.claude/hooks/guard.mjs:219` | Umbenennen aufgenommen, Berater-Name ohne Verzeichnis verweigert: AN20 für die genannten Formen behoben |
| `.claude/hooks/guard.mjs:226-234` | Schreibwerkzeuge: unverändert gegenüber Runde 2 |
| `tests/unit/sys-guard.test.ts:363-379` | 13 Verweigerungen, decken AM8, AN14, AN17 a, AN18, AN19: passen zum Code |
| `tests/unit/sys-guard.test.ts:380-395` | 12 Gegenproben (Zuweisung mit select, Umleitungen, Heredoc-Commit, `cp` nach `docs/proof`): passen zum Code; Heredoc nur mit paarigen Klammern einer Ebene (AN23) |
| `tests/unit/sys-guard.test.ts:396-404` | fünf Formen zu Berater-Dateien: passen zum Code (AN26 fehlt) |
| `tests/unit/sys-guard.test.ts:405-418` | Gegenproben mit harmlosen Skripten, absolute Pfade ohne Endung, Pfade mit Leerzeichen: AN21 erster Punkt erledigt |
| `tests/unit/sys-guard.test.ts:111-134` | Bestandsliste „lässt durch“ (u. a. Commit-Text mit Sperrwörtern, `cp` nach `docs/proof`, `echo ok > tmp/out.txt`): bleibt mit der neuen Fassung gültig |
| `tmp/proof/u1b/runs.jsonl:32-33` | e2e 734 bestanden, rls 360 bestanden, je EXIT 0, sauber, stabil, Hash von WIP 3 |
| `tmp/proof/u1b/runs.jsonl:30`, `:35` | Guard-Tests 194, danach 225 bestanden (31 neue Fälle, stimmt mit dem neuen Block überein), Baum nicht sauber, Hash von WIP 3 |
| `docs/OPEN_ISSUES.md:17`, `:25` | M17 „erledigt“ samt „Ersetzung“, AM8 „behoben“ ohne Einschränkung: zu weit, solange AM9 offen ist |
| `docs/OPEN_ISSUES.md:26-28` | AM5, AM7 und die niedrigen Funde der Runde 1 mit Frist, „AN20 Rest“ nur für die Schreibwerkzeuge: AN26 nachtragen |
| `docs/BEKS_EINRICHTUNG.md:31` | „einzelne seltene Schreibweisen“: trifft für AM9 nicht zu |
| `scripts/scan-proof.mjs:7-12`, `:19` | vier Muster für Schlüssel-, Token- und Verbindungsformate sowie Wertvergleich mit Umgebungsvariablen: dieser Bericht enthält nichts davon |

Offene Findings hoch: 0
