Modell: claude-fable-5-2
SHA256: 176a40d37776fee563fe09af70c2ae11053628137cef14e3a0804577a8d971f1 .claude/hooks/guard.mjs
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

# Abnahme u1b, Kontrollrunde 4 (Kennung u1b-1411-a, Stand „u1b WIP 5“, Commit c9ec7c8)

Datum: 2026-11-14
Auftrag: prüfen, ob AM9, AN22, AN23 und AN25 aus Runde 3 (`tmp/proof/u1b-abnahme-runde3.md`) behoben sind und ob der Abtaster samt Heredoc-Entfernung neue Lücken oder Falschalarme bei gewöhnlichen Befehlen öffnet.

Geprüfter Umfang (vollständig gelesen): `tmp/proof/u1b-abnahme-antrag-runde4.md`, `tmp/proof/u1b-abnahme-runde3.md`, `.claude/hooks/guard.mjs` (309 Zeilen), `tests/unit/sys-guard.test.ts:1-466` (ganz, der neue Block ist `:421-455`), `scripts/sys/loesch-register.json`, `scripts/scan-proof.mjs`. Ausschnitte: `docs/OPEN_ISSUES.md:14-30`, `docs/BEKS_EINRICHTUNG.md:27-33`, `tmp/proof/u1b/runs.jsonl:30-37`.

Hinweise zum Nachweis
- Die Hash-Zeilen oben sind unverändert aus dem Antrag übernommen und nicht nachgerechnet (kein Shell-Werkzeug). Gegenproben: 15 der 16 Hashes sind gleich denen der Runde 3, abweichend ist nur `guard.mjs`, wie im Antrag genannt; der Hash von `tests/support/partner.ts` steht gleichlautend in `scripts/sys/loesch-register.json:29`. `fertig` rechnet jeden Hash gegen die Datei nach.
- Ausgeführt habe ich nichts. Alle Aussagen zum Verhalten des Guards stammen aus dem Durchspielen von Abtaster, Heredoc-Entfernung, Maske, Segmenten, beiden Kernen und allen Regeln von Hand an der gelesenen Fassung. „Geht durch“ heißt: bis zum Ende der Segment-Schleife verfolgt.
- Ich nehme an, dass die gelesene Fassung der Commit c9ec7c8 ist (der Git-Stand zu Beginn zeigte nur eine unversionierte Doku-Datei). Der `check` Nr. 37 lief auf genau diesem Commit.
- Jede Änderung an einer der 16 Dateien nach diesem Bericht macht die Abnahme für diese Datei ungültig. Doku-Nachträge in `docs/OPEN_ISSUES.md` und `docs/BEKS_EINRICHTUNG.md` berühren die Liste nicht.
- Das eingebaute advisor-Werkzeug ohne Parameter stand in meiner Werkzeugliste und wurde mir von der Laufumgebung nahegelegt; ich habe es wegen des Verbots in Auftrag und CLAUDE.md nicht aufgerufen. Keine `.env*` und keine `.claude/settings.local.json` gelesen. Nichts außer dieser Datei geschrieben.

## Ergebnis in einem Satz

AM9, AN23 und AN25 sind behoben, AN22 für alle in Runde 3 genannten Formen; der Abtaster öffnet keine neue Lücke und die gewöhnlichen Befehle aus dem Antrag laufen durch; die Heredoc-Entfernung ist etwas breiter als nötig (AN31, niedrig), von AN22 bleibt ein schmaler Rest (AN29, AN30, niedrig), und beim vollständigen Neulesen habe ich eine ältere, nicht durch Runde 4 entstandene Lücke gefunden: ein Befehl, der nicht am Segmentanfang steht (PowerShell-Zuweisung `$x = befehl`, `if befehl; then`), wird von den verankerten Regeln nicht gesehen (AM10, mittel). Kein Finding der Stufe hoch.

## Findings hoch

Keine.

Einstufung wie in den Runden 1 bis 3: Der Guard ist laut eigener Doku keine Sicherheitsgrenze (`.claude/hooks/guard.mjs:2`), der Weg „Skript schreiben und mit node ausführen“ ist benannt offen (OPEN_ISSUES u1b-3). Alle Funde betreffen nur Dev; kein Lauf zählt dadurch fälschlich als Nachweis (direkt gestartete Tests stehen nicht in `runs.jsonl`).

## Findings mittel

AM10 (neu gefunden, nicht durch Runde 4 entstanden; besteht seit u1). `.claude/hooks/guard.mjs:28` mit `:194`, `:200`, `:164-165`, `:127-131`, `:144` – Die Regeln für Tests, `psql`, Shell-Hüllen, Skriptdateien und Registerskripte sind am Anfang des Kerns verankert. `kern` entfernt davor nur Bash-Zuweisungen (`:26`, `:82-91`) und die Wörter aus `:28`. Zwei gewöhnliche Schreibweisen fehlen:
  - (a) PowerShell-Zuweisung. `zuweisung` verlangt ein Wortzeichen am Anfang, `$name = ` wird nicht entfernt. Durchgespielt, gehen durch: `$out = npm run check 2>&1`, `$o = node scripts/storage-reset.mjs`, `$o = npm run admin:call`, `$o = psql -c "…"`, `$o = bash -c "npm run check"`.
  - (b) Bedingung einer Bash-Verzweigung oder Schleife. `if`, `while`, `until` stehen nicht in `:28` (dort nur `then`, `do`, `else`, `elif`). Gehen durch: `if npm run check; then echo ok; fi`, `while ! npm run check; do sleep 5; done`, `if node scripts/storage-reset.mjs; then …`.
  - Richtig verweigert werden in beiden Formen `supabase db push` (`:197` sucht unverankert) und `supabase db query` (`:202`, „nur als eigener Befehl“).
  - Gewicht: PowerShell ist auf diesem Rechner die Haupt-Shell, `$out = befehl` ist dort die übliche Form, um Ausgabe aufzufangen (das Gegenstück zu AM8). Für Tests fängt die zweite Ebene (der Lauf zählt nicht). Für Registerskripte gibt es keine zweite Ebene: das Lösch-Gate wird übergangen, es bleibt nur der `dev-guard` im Skript (fehlt laut u1b-1 bei vier Skripten). Darum mittel, nicht hoch: nur Dev, kein falscher Nachweis.
  - Fix (zwei Zeilen in der Schleife von `kern`): eine führende PowerShell-Zuweisung entfernen (Dollarzeichen, Name mit optionalem Bereich wie `env:` oder `script:`, optional `+`, Gleichheitszeichen; dazu ein führender Typ in eckigen Klammern wie `[void]`), und `if|while|until` in die Wortliste `:28` aufnehmen. Tests: die acht Formen oben verweigert; Gegenproben `$x = git rev-parse HEAD`, `$n = (Get-Content a.txt).Count`, `if git diff --quiet; then echo sauber; fi`, `$env:FOO = "1"` erlaubt.
  - Entscheidung: kein Hindernis für den Abschluss von u1b. Als AM10 mit beiden Formen wörtlich nach u1b-6; Frist: vor u3, vor dem Entfall einer `ask`-Regel und vor der ersten Freigabe eines weiteren Registerskripts, spätestens zusammen mit AM5. `docs/BEKS_EINRICHTUNG.md:31` nennt die Grenzen des Guards „einzelne seltene Schreibweisen“; `$x = befehl` ist in PowerShell nicht selten, der Satz muss die beiden Formen nennen, solange AM10 offen ist (der Auto-Modus ist dort schon gesetzt). Wer stattdessen jetzt behebt, braucht eine Kontrolle nur für diese zwei Zeilen und ihre Tests.

Weiter offen aus Runde 1, unverändert und mit Frist in u1b-6: AM5 und AM7.

## Findings niedrig

AN29 (Rest AN22 und AM9 b). `.claude/hooks/guard.mjs:94`, `:102` – `segmente` trennt weiter an der Maske ohne Schachtelung: Trennzeichen innerhalb einer Ersetzung (oder in Anführungszeichen innerhalb einer Ersetzung) schneiden das Segment. Der Inhalt der Ersetzung wird seit dem Abtaster vollständig geprüft; ungeprüft bleibt, was im selben einfachen Befehl hinter der schließenden Klammer steht, also der Befehl nach einem Variablen-Präfix. Im ersten Stück läuft `zuweisung` bis zum Ende (Kern leer), das zweite Stück beginnt mit dem Rest der Ersetzung.
  - Durchgespielt, gehen durch: `FOO=$(cat tmp/wert | head -1) npm run check`; `FOO="$(echo "a;b")" npm run check`; `FOO=$(cat tmp/wert | grep x) supabase db query "delete from public.x" --linked` (das zweite Stück beginnt mit `grep`, das in der Leseliste `:202` steht, die SQL-Prüfung `:204` läuft nicht).
  - Mit `| head -1)` vor `supabase db query` wird verweigert (nicht in der Leseliste), `supabase db push` immer (`:197`).
  - Seltene Form (Präfix-Variable, deren Wert eine Ersetzung mit Pipe oder Semikolon ist); schmaler als AN22 in Runde 3. Fix: die Maske für `segmente` aus dem Abtaster bilden (Inneres von Anführungszeichen, Dollar-Klammern und Backticks maskieren), dann trennen nur Zeichen der obersten Ebene. Tests: die drei Formen verweigert, `FOO=$(cat tmp/wert | head -1) npm run build` erlaubt.

AN30 (Rest AN22). `.claude/hooks/guard.mjs:86-89` – `zuweisung` nimmt als Wert genau ein Teilstück (eine Ersetzung, ein Paar Anführungszeichen oder ein Wort bis zum Leerraum). Setzt sich der Wert danach fort oder enthält das Wort Anführungszeichen mit Leerzeichen, beginnt der Kern mit dem Rest des Werts: `DIR=$(pwd)/tmp npm run check`, `FOO="a b"c npm run check`, `FOO=a"b c" npm run check`, `FOO=a\ b npm run check` gehen durch (Kern z. B. `/tmp npm run check`). Fix: in `zuweisung` über die Teilstücke laufen, bis Leerraum außerhalb von Anführungszeichen und Ersetzungen kommt (Dollar-Klammer per Abtaster, doppelte Anführungszeichen per Abtaster, einfache und Backticks per `hinter`, Backslash überspringt ein Zeichen). Tests: die vier Formen verweigert, `DIR=$(pwd)/tmp npm run build` erlaubt.

AN31 (neu durch Runde 4). `.claude/hooks/guard.mjs:79` – Die Heredoc-Entfernung greift breiter als die Commit-Form, für die sie gedacht ist: Es genügt das Wort `cat` irgendwo in der Zeile vor dem Heredoc-Zeichen, und hinter dem Endwort darf beliebiger Text stehen (Umleitung, Pipe, weiterer Befehl). In Runde 3 wurden die Körperzeilen in diesen Formen als Befehle geprüft.
  - (i) Schreiben und Ausführen in einem Befehl: `cat <<'EOF' > tmp/x.sh`, Körper mit gesperrtem Befehl, danach `bash tmp/x.sh`. Der Guard liest die Datei, wie sie vor dem Befehl auf der Platte liegt: fehlt sie, wird verweigert (gut); liegt dort eine harmlose ältere Fassung, geht der Befehl durch.
  - (ii) Pipe an ein Programm, das die Pipe-Regel `:223` nicht kennt (`xargs`, `node --input-type=module`): der Körper ist ungeprüft. Pipe an Shells, `node`, `psql`, `supabase db query` wird weiter verweigert (durchgespielt: `cat <<'EOF' | bash`, `| sh -s`, `| psql`, `| supabase db query --linked`).
  - (iii) Das Heredoc gehört einem anderen Programm derselben Zeile (`cat a; sh -s <<'EOF'`): wird nur zufällig verweigert, weil `skriptDatei` das Heredoc-Wort als Dateinamen nimmt („nicht lesbar“).
  - Umleitungen in der Kopfzeile bleiben geprüft (`cat <<'EOF' > tmp/proof/…` und `> docs/freigaben/…` werden verweigert), Text hinter dem Endwort ebenfalls. Der Guard beendet den Körper nie später als Bash (durchgespielt für eingerücktes Endwort und Leerraum dahinter).
  - Setzt Absicht oder eine vorhandene gleichnamige Datei voraus, darum niedrig. Fix: den Körper nur entfernen, wenn `cat` an Befehlsposition steht (Textanfang, nach öffnender Dollar-Klammer, Backtick oder Trennzeichen) und die Kopfzeile nach dem Endwort endet; alle anderen Formen wie in Runde 3 zeilenweise prüfen. Tests: (i) und `cat <<'EOF' | xargs -L1 npm run` mit Körper `check` verweigert; die Commit-Gegenprobe `tests/unit/sys-guard.test.ts:451` bleibt erlaubt.

AN32 (PowerShell-Werkzeug, teils neu). `.claude/hooks/guard.mjs:51`, `:62-65`, `:79`, `:293` – `entscheideBefehl` bekommt den Werkzeugnamen nicht; der Abtaster wendet Bash-Regeln auch im PowerShell-Werkzeug an (Backslash macht das nächste Zeichen wörtlich, Backtick öffnet eine Ersetzung). In PowerShell ist der Backtick das Escape-Zeichen und der Backslash ein gewöhnliches Zeichen.
  - Falschalarme zur sicheren Seite: ein einzelner Backtick (Escape wie Zeilenumbruch oder Anführungszeichen) lässt den Rest des Befehls als eigenen Befehl mit verschobener Zeichen-Paarung prüfen (neu: in Runde 3 zählten nur Paare); zwei Backtick-Escapes um einen gesperrten Befehl (`"… `"npm run check`" …"`) werden verweigert; ein Here-String `@'…'@` mit einem Apostroph im Text wird wie bisher zeilenweise geprüft (die Heredoc-Entfernung kennt nur die Bash-Form). Ausweg: einfache Anführungszeichen, `git commit -F tmp/msg.txt`.
  - Lücke nur mit unwahrscheinlicher Form: eine Zeichenkette in doppelten Anführungszeichen, die auf Backslash endet (`"C:\x\"`), verschiebt die Paarung des Abtasters; steht danach in einer zweiten Zeichenkette eine Ersetzung zwischen zwei Apostrophen, sieht er sie nicht (durchgespielt: `Get-ChildItem "C:\x\" ; Write-Host "it's $(npm run check) it's"` geht durch). Klasse AN12.
  - Fix (späterer Schritt, mit AN2): den Werkzeugnamen durchreichen; im PowerShell-Modus Backtick als Escape, Backslash wörtlich, Körper von `@'…'@` entfernen. Die PowerShell-Zeilenfortsetzung, `$_`, `$($x.Count)`, Skriptblöcke und `"EXIT=$LASTEXITCODE"` laufen schon jetzt durch.

AN33 (nicht durch Runde 4 entstanden). `.claude/hooks/guard.mjs:58` – Die Prozess-Ersetzung der Bash (Kleiner- oder Größer-Zeichen direkt vor der Klammer) wird nicht abgetastet: `cat <(supabase db query "delete from public.x" --linked)` geht durch (der Kern beginnt mit `cat`, Leseliste `:202`), ebenso `diff <(npm run check 2>&1) tmp/alt.txt`. Seltene Form. Fix: beide Formen im Abtaster wie die Dollar-Klammer behandeln (nicht innerhalb doppelter Anführungszeichen); Tests.

AN34 (Tests, Nachweis, Doku).
  - `tests/unit/sys-guard.test.ts:421-455` – Der neue Block deckt alle Formen aus AM9, AN22, AN23 und AN25 der Runde 3 (15 Verweigerungen, 10 Gegenproben); alle 25 Erwartungen stimmen mit dem von Hand verfolgten Verhalten überein. Es fehlen Fälle für AM10 und AN29 bis AN33, soweit sie behoben werden.
  - `tmp/proof/u1b/runs.jsonl:37` – Der im Antrag angekündigte `check` liegt vor: Commit c9ec7c8, Baum sauber, stabil, EXIT 0, 1668 bestanden. Damit ist der Punkt „kein Lauf auf dem Endstand“ aus AN28 für `check` erledigt. e2e Nr. 32 und rls Nr. 33 gehören weiter zu WIP 3 (364ea21); ob `fertig` sie für den Endstand annimmt, entscheidet `fertig`.
  - `docs/OPEN_ISSUES.md:25` – „behoben: AM9, AN22, AN23, AN25“ trifft für die genannten Formen zu; nachzutragen sind AM10 und AN29 bis AN33. `docs/OPEN_ISSUES.md:28` führt unter AN27 die Zuweisung mit Backticks um `db query` als offen; sie ist durch den Abtaster mit erledigt, ebenso `set=$(supabase db query "select 1" --linked)` (der Kern des äußeren Segments ist leer, der Innentext wird für sich geprüft). Offen von AN27 bleiben `2>$null`, Zielnamen mit Sperrwort in der Umleitung, `cd docs/proof/u1b && cp …` und `bash -c '…'` um ein erlaubtes `db query`.
  - `docs/BEKS_EINRICHTUNG.md:31` – siehe AM10.

Aus den Runden 1 bis 3 weiter offen und in u1b-6 geführt: AN1 bis AN7, AN10 bis AN13, AN24, AN26, AN27 (Rest), AN28 (Tests für AN24 bis AN26).

## Antworten auf die Prüffragen

**Ist AM9 behoben?** Ja. Alle fünf Formen meines Berichts durchgespielt:
- `OUT="$(supabase db query "insert into public.x (a) values (now())" --linked)"`: der Abtaster geht von oben in die doppelten Anführungszeichen, von dort in die Ersetzung, überspringt darin das innere Zitat samt Klammern und schließt an der richtigen Klammer (`:54-61`, `:66-72`). Der Innentext ist der vollständige Befehl; als eigener Befehl geprüft trifft die Wortliste `insert` (`:205`). Verweigert.
- Dieselbe Form mit `update …; select 1` und mit Zeilenumbruch im SQL: der Innentext bleibt ein Segment (die Maske des Innentexts kennt das Zitat), Wortliste trifft. Verweigert.
- `echo $(supabase db query "delete … (select max(id) from public.y)" --linked)`: Klammern im Zitat zählen nicht, Innentext vollständig, verweigert.
- `OUT="$(npm run check 2>&1 | grep -E "FAIL|Error")"`: Innentext hat zwei Segmente, das erste beginnt mit `npm run check`. Verweigert.
- `OUT="$(psql -c "select 1; delete from public.x")"`: Innentext beginnt mit `psql`. Verweigert.
- Zusätzlich: geschachtelte Ersetzung in Zitat in Ersetzung (`:431`) und nicht geschlossene Ersetzung (`:432`): verweigert. Gegenproben `OUT="$(supabase db query "select count(*) … coalesce(b, lower(c))" --linked)"` und `OUT="$(git log --format="%h;%s" -1)"`: erlaubt (bei der zweiten schneidet `segmente` zwar weiter durch das Zitat, beide Stücke sind harmlos).

**Ist AN22 behoben?** Für die drei Formen der Runde 3 ja: `FOO=$(pwd) npm run check`, `FOO=$(cat tmp/wert) supabase db query "delete …" --linked` und `FOO=$(cat tmp/wert) psql -c "…"` werden verweigert; `zuweisung` entfernt Name und vollständige Ersetzung, der Kern beginnt mit dem Programm (`:82-91`). `FOO=$(pwd) npm run build`, `x="a b"`, `export X=1`, `x=$(( 1 + 2 ))` erlaubt. Rest: AN29 (Trennzeichen in der Ersetzung), AN30 (Wert setzt sich fort).

**Ist AN23 behoben?** Ja. Der Körper eines `cat`-Heredocs mit zitiertem Endwort wird vor Abtaster und Segmentierung entfernt (`:79`, `:182`); die Commit-Form mit geschachtelten Klammern, `1)` und gesperrten Befehlen in Backticks (`:451`) ist erlaubt. Die drei Kehrseiten aus Runde 3 sind zu: Heredoc mit unzitiertem Endwort wird abgetastet (Ersetzungen im Text werden geprüft, wie Bash sie ausführt); ein Befehl hinter dem Endwort innerhalb derselben Ersetzung bleibt stehen und wird geprüft; Apostrophe innerhalb doppelter Anführungszeichen schützen nicht mehr (`:53`). `grep "\$(supabase db push)" datei` und maskierte Backticks: erlaubt (`:51`). Unverändert und zur sicheren Seite: Heredocs an anderen Programmen als `cat` (`git commit -F - <<'EOF'`) werden zeilenweise geprüft. Neue Kehrseite: AN31.

**Ist AN25 behoben?** Ja. `node --import=./tmp/x.mjs scripts/storage-reset.mjs`: das Optionswort ist nie das Ziel (`:174`), Ziel ist das Registerskript, verweigert. `node --import ./scripts/storage-reset.mjs tmp/x.mjs`: der Wert der Vorlade-Option wird mitgeprüft (`:172-175`), verweigert; ebenso mit Gleichheitszeichen und nach `cd scripts` über den Dateinamen. `node tmp/hash.mjs scripts/storage-reset.mjs` und `node --max-old-space-size=4096 tmp/hash.mjs scripts/storage-reset.mjs` bleiben erlaubt.

**Öffnet der Abtaster neue Lücken?** Nein. Er liefert nur Innentexte, die zusätzlich geprüft werden; er kann nur verweigern. Die Segment-Prüfung läuft unverändert daneben. Geprüft habe ich: Endlosschleife (jeder Zweig rückt vor, auch Backslash am Textende), Tiefe (Innentexte teilen sich die Grenze 4 mit den Shell-Lesarten; fünf Ebenen geschachtelter Ersetzungen werden als „nicht prüfbar“ verweigert, bei vier Ebenen bleibt die Zahl der Prüfungen klein), `$((…))` (Innentext ist der Klammerausdruck, harmlos), einfache Anführungszeichen innerhalb einer Ersetzung in doppelten Anführungszeichen (schützen dort wieder, wie in Bash). Die Begleitänderung in `kern` (`zuweisung`) öffnet nichts, was in Runde 3 zu war: ein vollständig verbrauchter Wert ergibt einen leeren Kern, sein Inhalt steht in der Liste der Innentexte. Einzige Verschlechterung gegenüber Runde 3: AN31 (Heredoc-Entfernung) und die PowerShell-Sonderform in AN32.

**Falschalarme bei gewöhnlichen Befehlen?** Bei den Formen aus dem Antrag keiner. Durchgespielt, erlaubt:
- `git commit -m "u1b: Guard (Rest (AM9)) und 1) Liste"`, `git commit -m "update (a) und $(date)"`, `git commit -m 'x=$(npm run check) im Text'`, `git commit -m "Fix: x=\$(…) und \`npm run check\`"`, `git commit -m "Text mit 'einfachen' und \"doppelten\" Zeichen"`, Commit über `"$(cat <<'EOF' … EOF` und Klammer in der Folgezeile, auch mit `&& git push` dahinter, auch mit eingerücktem Endwort.
- Richtig verweigert, weil Bash es ausführen würde: `git commit -m "… $(npm run check) …"`, ein gesperrter Befehl in Backticks innerhalb doppelter Anführungszeichen, dieselben in einem Heredoc mit unzitiertem Endwort.
- `echo "kosten: $(( 1 + 2 ))"`, `x=$(( 1 + 2 ))`, `echo $((2+3))`.
- `grep -n "\$(" .claude/hooks/guard.mjs`, `rg -n "abtasten\(|ohneHeredoc" .claude/hooks/guard.mjs`, `grep -n 'x=$(supabase' datei`, `awk '{print $1}' f`, `sed "s/(a)/b/" f`, `find . -name "*.md" -exec grep -l x {} \;`.
- PowerShell: `Get-ChildItem tmp | ForEach-Object { $_.Name }`, `Get-ChildItem | Where-Object { $_.Name -match '(a|b)' }`, `"$($x.Count) Zeilen"`, `"Zeilen: $((Get-Content "a b.txt").Count)"`, `$h = @{ a = 1; b = 2 }`, `Get-Content tmp/proof/u1b/runs.jsonl | Select-Object -Last 3`, Zeilenfortsetzung mit Backtick, Commit über `@'…'@` ohne Apostroph im Text.
- Anführungszeichen in Anführungszeichen: `OUT="$(git status --porcelain | wc -l)"`, `test "$(git rev-parse --abbrev-ref HEAD)" = "u1b" && echo ok`, `echo "$(git log -1 --format='%s (%h)')"`, `node tmp/x.mjs "a \"b\" c"`, `bash -c "echo $(date)"`, `for f in $(git ls-files '*.md'); do wc -l "$f"; done`.
- `npm run t -- check 2>&1 | tail -20`, `x=$(git log -1 --format=%s | head -c 50); echo "$x"`, `supabase db query "select 1" --linked` in allen Formen der Runde 3, jetzt auch als Zuweisung mit Backticks.
- Bekannte Falschalarme zur sicheren Seite: AN27 (Rest), AN32, Heredoc an anderen Programmen als `cat`, und wie bisher ein Trennzeichen mit gesperrtem Befehl dahinter in einem Zitat innerhalb einer Ersetzung in doppelten Anführungszeichen (`"$(printf "a; npm run check b")"`: die Maske kennt keine Schachtelung, AN29).

**Ist der Umgang mit den offenen Funden vertretbar?** Ja. u1b-6 führt AM5, AM7 und die niedrigen Funde mit Frist. Nachzutragen: AM10 (mit Frist wie oben) und AN29 bis AN33; die Aussage zu AN27 und der Satz in `docs/BEKS_EINRICHTUNG.md:31` sind anzupassen. Diese Nachträge ändern keine der 16 Dateien. Der Abschluss von u1b ist damit freigegeben; `guard.mjs` darf danach nicht mehr geändert werden, sonst gilt die Abnahme für diese Datei nicht.

**Geld, RLS, Schema?** Von der Kontrollrunde nicht berührt (keine Migration, keine Function, kein App-Code).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `.claude/hooks/guard.mjs:26` | `kern` ruft `zuweisung` je Durchlauf zuerst, bis zu vier Präfixe: AN22 für die genannten Formen behoben |
| `.claude/hooks/guard.mjs:28` | Wortliste ohne `if`, `while`, `until`: AM10 b |
| `.claude/hooks/guard.mjs:45-76` | Abtaster mit drei Modi; Backslash, einfache Anführungszeichen nur außerhalb doppelter, Rekursion für Zitat und Dollar-Klammer, Backtick-Paar, Klammerzählung nur im Modus der Ersetzung, offene Ersetzung bis zum Ende: AM9 behoben, jeder Zweig rückt vor |
| `.claude/hooks/guard.mjs:58` | nur Dollar-Klammer und Backtick, keine Prozess-Ersetzung: AN33 |
| `.claude/hooks/guard.mjs:60` | Innentext ohne die schließende Klammer, tiefere Ebenen flach angehängt: in Ordnung |
| `.claude/hooks/guard.mjs:79` | Heredoc-Körper bei `cat` mit zitiertem Endwort entfernt, Kopfzeile und Text nach dem Endwort bleiben: AN23 behoben; `cat` als bloßes Wort und Rest der Kopfzeile beliebig: AN31 |
| `.claude/hooks/guard.mjs:82-91` | `zuweisung` verlangt Wortzeichen am Anfang (AM10 a), nimmt ein Teilstück als Wert (AN30) |
| `.claude/hooks/guard.mjs:94`, `:102` | Maske und Trenner unverändert ohne Schachtelung: AN29 |
| `.claude/hooks/guard.mjs:172-175` | Vorlade-Werte in beiden Schreibweisen gegen das Register, Wörter mit Bindestrich nie Ziel: AN25 behoben |
| `.claude/hooks/guard.mjs:182-188` | Heredoc-Entfernung zuerst, dann alle Innentexte rekursiv mit Tiefe, leere übersprungen, erste Verweigerung gilt: in Ordnung |
| `.claude/hooks/guard.mjs:194`, `:200` | Tests und `psql` am Kernanfang verankert: Ursache von AM10 |
| `.claude/hooks/guard.mjs:197`, `:202` | `db push` unverankert, `db query` mit Leseliste: fangen AM10 für die Supabase-CLI ab; `grep`, `cat` in der Leseliste (AN29, AN33) |
| `.claude/hooks/guard.mjs:206-207` | die umschließende Ersetzung zählt nicht, weitere Ersetzung oder Variable im Argument verweigert: in Ordnung, auch bei Präfix-Variable |
| `.claude/hooks/guard.mjs:223` | Pipe an Shell oder Interpreter: fängt `cat <<'EOF' | bash` nach der Heredoc-Entfernung |
| `.claude/hooks/guard.mjs:235-245` | Skriptdatei wird zum Zeitpunkt des Hooks gelesen, fehlend heißt verweigert: AN31 i |
| `.claude/hooks/guard.mjs:269`, `:262` | Umleitung nach `tmp/proof`, `docs/proof`, `docs/freigaben` in der Heredoc-Kopfzeile bleibt verweigert |
| `.claude/hooks/guard.mjs:293` | Werkzeugname wird nicht an die Befehlsprüfung gereicht: AN32 |
| `tests/unit/sys-guard.test.ts:422-440` | 15 Verweigerungen (fünf AM9-Formen, Schachtelung, offene Ersetzung, drei AN22-Formen, zwei AN25-Formen): passen zum Code |
| `tests/unit/sys-guard.test.ts:441-454` | 10 Gegenproben (SQL mit geschachtelten Klammern, Format-Zitat mit Semikolon, Arithmetik, maskierte Ersetzung, Commit-Heredoc mit geschachtelten Klammern und Backticks): passen zum Code |
| `tests/unit/sys-guard.test.ts:389`, `:392` | ältere Gegenproben (Commit-Heredoc, `bash -c "echo $(date)"`) bleiben mit der neuen Fassung gültig |
| `tests/unit/sys-guard.test.ts:15-142`, `:144-360` | kein Fall mit PowerShell-Zuweisung oder `if befehl`: AM10 ungetestet |
| `scripts/sys/loesch-register.json:15` | `scripts/storage-reset.mjs` steht im Register: die AN25-Tests prüfen das Richtige |
| `scripts/sys/loesch-register.json:29` | Hash von `partner.ts` gleich dem der Hash-Zeile oben |
| `tmp/proof/u1b/runs.jsonl:36` | Guard-Tests 250 bestanden, EXIT 0, Commit 51109d9, Baum nicht sauber |
| `tmp/proof/u1b/runs.jsonl:37` | `check` auf c9ec7c8, sauber, stabil, EXIT 0, 1668 bestanden |
| `tmp/proof/u1b/runs.jsonl:32-33` | e2e 734 und rls 360 bestanden, je EXIT 0, sauber, Commit 364ea21 (WIP 3) |
| `docs/OPEN_ISSUES.md:25` | AM9, AN22, AN23, AN25 als behoben geführt: trifft für die genannten Formen zu |
| `docs/OPEN_ISSUES.md:28` | AN24, AN26, AN27, AN28 mit Formen geführt; AN27 teils erledigt, AM10 und AN29 bis AN33 fehlen noch |
| `docs/BEKS_EINRICHTUNG.md:31` | „einzelne seltene Schreibweisen“: für AM10 a zu schwach |
| `scripts/scan-proof.mjs:7-12`, `:19` | vier Muster für Schlüssel-, Token- und Verbindungsformate sowie Wertvergleich mit Umgebungsvariablen: dieser Bericht enthält nichts davon |

Offene Findings hoch: 0
