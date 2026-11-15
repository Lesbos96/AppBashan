Modell: claude-fable-5-2

# Abnahme u3b, Kontrollrunde 2 (R3, Kennung u3b-1511-a)

Datum: 2026-11-15
Umfang: Nur die Kontrolle, ob H1 und M1 bis M5 aus Runde 1 (`tmp/proof/u3b-abnahme-runde1.md`) geschlossen sind und ob die Änderungen neue Lücken oder Falschalarme in üblicher Schreibweise öffnen. Vollständig neu gelesen: `.claude/hooks/guard.mjs`, `scripts/sys/gate-db.mjs`, `scripts/sys/gate-db-lib.mjs`, `scripts/sys/bericht.mjs`, `.claude/agents/advisor-report.md`, `scripts/sys/lib.mjs`, `tests/unit/sys-gate-db.test.ts`, `tmp/proof/u3b/runs.jsonl`; in Auszügen: `tests/unit/sys-guard.test.ts:495-635`, `scripts/sys/run.mjs:1-40`, `docs/OFFEN.md:1-14`, `tests/unit/positiv-register.test.ts:49-53`, `package.json:69-73`, Logs 017, 018, 019 (nur Fehlerzeilen).

Grenzen dieser Prüfung
- Kein Shell-Werkzeug: Die Hashes sind aus dem Auftrag abgeschrieben, nicht nachgerechnet. Nichts wurde ausgeführt; alle Aussagen zum Guard und zum Gate sind von Hand am Code durchgespielt. Das gilt auch für die neuen Befunde unten: Sie sind Lesebefunde, keine gemessenen.
- Nicht neu gelesen sind die fünf Dateien, deren Hash laut Auftrag gegenüber Runde 1 gleich geblieben ist (`session.mjs`, `fertig.mjs`, `modell.mjs`, `loesch-register.json`, `package.json`, dort nur die Zeilen 69 bis 73). Für sie gilt die Prüfung aus Runde 1.
- Meine laufende Sitzung hat noch den alten Wortlaut der Agent-Definition geladen; geprüft ist der Text der Datei.

SHA256: 7ec4b020456f309a7447f7a3aed5facf899a460d64c05e1fb1d5d780e3e6e61b .claude/hooks/guard.mjs
SHA256: 1ea8fa55f8b4499b723679d7ff9e1534ba1f03d4ddbe1af41c7774ff4ff4e75e .claude/hooks/session.mjs
SHA256: c77c0571938e55ca425dbf6d006d89718529dad803612b90bba4cf4ccefd3638 .claude/agents/advisor-report.md
SHA256: 1b378c57c4dd8d2013bd40319cf8afb526fe503508aa401e8a4c30e048cbf4c0 scripts/sys/bericht.mjs
SHA256: 186bc7887b68def9defdd7ccdd3fc601e30c31359ca753ebf5c6d7ebc4ff4208 scripts/sys/fertig.mjs
SHA256: 3fed89b75c3142a6e393b1be8170531acec30fef0d716384aa40aebfbf35436c scripts/sys/gate-db.mjs
SHA256: 712b1dd27325f4a9a53e9e88d45c9bb376684a9ef35d32c6c6e3944a6de65aa0 scripts/sys/gate-db-lib.mjs
SHA256: b3e3adb0353da56dbdb12cfea9ce8d08862820ce939049c43e943541b3a68540 scripts/sys/modell.mjs
SHA256: a0183fa85e426009da0746cb69c094b52cb03a07bd0c5f52c60612d47c965ed3 scripts/sys/loesch-register.json
SHA256: 37bbe1559762abeea670fe968e0d2bb7709c121c9086b8beb609d11efec3ab70 package.json

## Ergebnis in Kürze

H1 ist geschlossen, M1 bis M5 sind in der Form geschlossen, in der Runde 1 sie beschrieben hat. Kein hoher Fund. Ein mittlerer Rest (M6): Die Erkennung „git klebt an einer Hülle“ ist nur in `gitGrund` nachgezogen, nicht in `gitUmgebung`; der Weg über `GIT_CONFIG_*` bleibt deshalb in üblicher Schreibweise offen, sobald git in einer Ersetzung oder Zuweisung steht. Diese Lücke bestand schon in Runde 1; dort habe ich die Bedingung unter N2 für unschädlich gehalten, das war falsch. Dazu fünf niedrige Punkte: ein neuer Falschalarm (Leseform in Klammern), zwei Grenzen der zusammengezogenen Lesart, zwei Reste an der H1-Sperre und an M5. Die zusätzliche Lesart in `entscheideBefehl` ist rein additiv (die Zeilen einzeln bleiben geprüft) und kann nichts freigeben, was vorher gesperrt war.

## Findings hoch

Keine.

## Findings mittel

- **M6** · `.claude/hooks/guard.mjs:243` – `gitUmgebung` sperrt nur, wenn irgendein Rohwort des ganzen Befehls git ist. Steht git in einer Ersetzung, hinter einer Zuweisung oder in Klammern, ist kein Rohwort git, und der Kern wird hier (anders als in `:251`) nicht gefragt. Durchgespielt: `export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=x; out=$(git push 2>&1)` (Rohwort `out=$(git`; die Ersetzung wird als eigener Befehl geprüft, enthält aber die Umgebung nicht; die Segmente mit dem Schlüssel enthalten kein git) geht durch. Ebenso `$env:GIT_CONFIG_COUNT = 1; $env:GIT_CONFIG_KEY_0 = 'core.hooksPath'; $env:GIT_CONFIG_VALUE_0 = 'x'; $o=git push` und dieselbe Kette mit `(git push)` am Ende. `out=$(git push 2>&1)` und `$o=git push` sind übliche Schreibweisen. Die zweite Ebene greift hier nicht: Der Hook-Pfad aus der Umgebung umgeht den pre-push-Hook, und `hooksAktiv` liest nur die gespeicherte Konfiguration. – Fix: die git-Bedingung in `:243` streichen (die Namen mit `=` bzw. `env:` genügen; die Variablen haben im Projekt keinen erlaubten Zweck). Negativproben: die drei Formen oben. Die Gegenprobe `rg GIT_CONFIG_COUNT .claude` (ohne `=`) bleibt frei; neu gesperrt wäre nur ein Befehl ohne git, der einen der Namen mit `=` enthält (in OFFEN u3b-1 bei den Falschalarmen ergänzen).

## Findings niedrig

- **N9** · `.claude/hooks/guard.mjs:251`, `:257` – Neuer Falschalarm aus M1 und M3 zusammen: die Leseform in runden Klammern am Segmentanfang. `(git config core.hooksPath)`, `$h = (git config core.hooksPath)` und `if ((git config core.hooksPath) -ne '.githooks') { npm run prepare }` waren vorher frei (kein Rohwort git, `gitGrund` gab null zurück); jetzt erkennt der Kern git, `kernGekuerzt` verneint die Leseform, und das Wort `core.hooksPath)` trifft die Schlüsselregel. Aus M3 allein: `(cd x && git config core.hooksPath)` und `x=$(cd y && git config core.hooksPath)` (das zweite Segment endet auf `)`). Die Stücke selbst prüft `klammerStuecke` weiterhin richtig. Fail closed, der Ausweg ist die Form ohne Klammern (`$h = git config core.hooksPath` bleibt frei, `sys-guard.test.ts:584`). – Fix: in OFFEN u3b-1 bei den Falschalarmen nennen; wer es lockern will: die Kern-Erkennung in `:251` nur gelten lassen, wenn `blankiere(seg)` keine runde Klammer enthält (solche Segmente prüft `:279-285` Stück für Stück). Ich empfehle die Dokumentation, nicht die Lockerung.
- **N10** · `.claude/hooks/guard.mjs:272` – Die Zusammenziehung setzt ein Leerzeichen. Bash und cmd fügen ohne Leerzeichen zusammen; eine Fortsetzung mitten im Wort geht deshalb in beiden Lesarten durch: `git push --no-ver\` + Umbruch + `ify` (einzeln: Wort mit acht Zeichen, unter der Neun-Zeichen-Schwelle; zusammengezogen: `--no-ver ify`), ebenso `git -c core.hooks\` + Umbruch + `Path=x push`. Absichtliche Form, gleiche Klasse wie `g\it` in OFFEN u3b-1. – Fix: eine dritte Lesart mit Ersatz durch nichts (gleiche Stelle, gleiche Rekursion) oder die Form in OFFEN u3b-1 bei den Grenzen nennen.
- **N11** · `.claude/hooks/guard.mjs:272` – Die Lesart zieht auch dort zusammen, wo das Zeichen keine Fortsetzung ist: schließender Backtick am Zeilenende, `HEAD^` am Zeilenende, PowerShell-Pfad mit `\` am Zeilenende. Ein Falschalarm entsteht nur, wenn die Folgezeile etwas enthält, das an jeder Stelle zählt (Schlüssel `core.hooksPath` in einem git-Segment, ein Pfad unter `docs/freigaben` hinter einem Nicht-Leser), z. B. `git reset --soft HEAD^` + Umbruch + `git config core.hooksPath`. Bei einer mehrzeiligen Commit-Nachricht in doppelten Anführungszeichen verschiebt ein Backtick am Zeilenende die Paarung der Backticks; der Rest der Nachricht wird dann zeilenweise als Befehl gelesen (eine Folgezeile, die mit `npm run check` beginnt, sperrt). Nachrichten über `cat <<'EOF'` und in einfachen Anführungszeichen sind nicht betroffen (`:269` läuft vor `:272`; einfache Anführungszeichen bleiben undurchsichtig). Die Gegenproben `git log \` + Umbruch und `cd C:\x\` + Umbruch + `npm run build` (`sys-guard.test.ts:612-613`) passen zum Code. – Fix: in OFFEN u3b-1 bei den Falschalarmen nennen.
- **N12** · `scripts/sys/gate-db.mjs:30-31` – Die H1-Sperre vergleicht Textpfade, aufgelöst gegen das Arbeitsverzeichnis. Nicht erfasst: ein Verweis (Junction, Symlink) von außen auf `tmp/proof/<schritt>`; ein Aufruf aus einem anderen Arbeitsverzeichnis (Worktree) mit dem absoluten Pfad des Hauptordners (dann zeigt auch `PROOF_ROOT` woandershin); nach meiner Lesart von `path.resolve` auch die Langpfad-Schreibweise mit Präfix und 8.3-Kurznamen. Alles absichtliche Formen nach einer klaren Absage, gleiche Klasse wie „ein Node-Skript kann überall schreiben“; der naheliegende Fall aus Runde 1 ist zu. – Fix: beide Seiten zusätzlich mit `realpathSync.native` vergleichen, wenn das Ziel existiert (im gefährlichen Fall existiert es, dort liegt die Startmarke), und die Wurzel am Ort des Skripts verankern statt am Arbeitsverzeichnis. Sonst als Grenze in OFFEN.
- **N13** · `scripts/sys/gate-db-lib.mjs:76-77` – „Jüngste Startmarke“ ist nach Pfad geschlüsselt. Wird eine Migration nach einem gescheiterten Push bei gleicher Version umbenannt, bleibt der alte Pfad offen; ist die Version dann angewendet, meldet jeder Nachtrag „Datei nicht lesbar“ und endet mit Exit 1 (Marken der übrigen Migrationen werden vorher geschrieben, nur `db:types` läuft nicht nach, `package.json:70`). Keine falsche Marke. – Fix: nach `version` schlüsseln statt nach `pfad` (eine Version wird nur einmal angewendet); Test: Startmarke (v, p1, A), Startmarke (v, p2, B), Marke (p2, B) → nichts offen.

## Stand der Punkte aus Runde 1

- **H1 geschlossen.** `gate-db.mjs:30-34` bricht in der Attrappe mit Exit 2 ab, bevor irgendetwas gelesen oder geschrieben wird, wenn `--freigaben` aufgelöst und kleingeschrieben `tmp/proof` oder ein Ordner darunter ist (`tmp/proofx` bleibt richtig frei). Die Option wird an beiden Stellen über dieselbe Funktion gelesen (`:31`, `:60`), eine doppelte Angabe kann die Prüfung also nicht von der Verwendung trennen; die Form mit `=` scheitert schon an `:22`. Der Kopfkommentar stimmt (`:6-7`). Der Test (`sys-gate-db.test.ts:137-147`) prüft vier Pfadformen mal drei Modi auf Exit 2 und dass der Ordner nicht entsteht. Rot-Beweis: Lauf 18 mit Ist-Wert „Exit 0 statt 2“ für `antrag tmp/proof/_attrappe-test` (die Attrappe hat also wirklich in den Nachweisordner geschrieben), Lauf 19 rot am Rest dieses Ordners, Lauf 20 grün. Der Ordner und Anträge direkt unter `tmp/proof` sind nicht mehr vorhanden (Suche ohne Treffer); eine Marke konnte dabei nicht entstehen (`antrag` schreibt nur den Antrag). Kein Aufrufer im Projekt braucht die Attrappe mit einem Ordner unter `tmp/proof` (Suche in `.claude`, `docs`, `tests`, `scripts`). Rest: N12.
- **M1 geschlossen für `gitGrund`** (`guard.mjs:251`): `$o=git push --no-verify`, `$null=git -c core.hooksPath=x push`, `@git push --no-verify`, `&{git push --no-verify}` ergeben den Kern `git …` und laufen in die Regeln. Das Und der beiden Verneinungen ist richtig herum. Nicht nachgezogen in `gitUmgebung`: M6. Weiter offen, absichtliche Formen ohne Leerraum: git direkt hinter `{` in einer anderen Hülle als `&` oder `(` (`%{git push --no-verify}`, `try{git push --no-verify}catch{}`); mit Leerraum (`{ git … }`) greift die Rohwort-Erkennung. Zu N1 in OFFEN u3b-1 stellen.
- **M2 geschlossen** (`guard.mjs:242`): Leerraum vor `=` und jede Form mit `env:` vor dem Namen (also auch `$env:NAME += …` und `${env:NAME}`). Nicht erfasst: `Env:\NAME` mit Backslash und `[Environment]::SetEnvironmentVariable(…)`; absichtliche Formen, zu den Grenzen in OFFEN u3b-1. Neuer Falschalarm in derselben Klasse wie der schon genannte: eine Commit-Nachricht mit `NAME = 1` oder `env:NAME` neben git.
- **M3 geschlossen** (`guard.mjs:257-258`): `}` und `)` am Segmentende sowie Wörter, die mit einer Prozess-Ersetzung beginnen, verneinen die Leseform. Der Kern kürzt nur am Ende (`:37`), also bleibt ein `}` vor einer Umleitung als Wort erhalten und zählt (`git config core.hooksPath } 2>/dev/null` → zwei Wörter, gesperrt). Ein leerer Wert `""` zählt als Wort (gesperrt). Nebenwirkung: N9.
- **M4 geschlossen für die übliche Schreibweise** (`guard.mjs:270-276`): Fortsetzung mit `\`, Backtick und `^`, auch mit Leerraum vor dem Umbruch und mit CRLF; gilt ebenso für Innentexte verschachtelter Shells und für Skriptdateien (jeder Aufruf mit `stueck = false`). Die Rekursion endet (jeder Schritt entfernt mindestens einen Umbruch). Die Lesart ist zusätzlich: Sie kann nur sperren, und danach läuft die Prüfung der Zeilen einzeln unverändert. Rest: N10, N11.
- **M5 geschlossen** (`gate-db-lib.mjs:73-79`): je Pfad die letzte Startmarke in Dateireihenfolge, davon nur die ohne Marke mit gleichem Pfad und SHA. Durchgespielt: A scheitert, B markiert → nichts offen; A angewendet aber unmarkiert, Datei danach geändert, zweiter Push → keine neue Startmarke für diesen Pfad (nicht mehr offen), A bleibt, der Nachtrag meldet die Abweichung (fail closed, richtig); Teil-Push mit späterer Korrektur der zweiten Migration → nichts offen. Eine falsche Marke kann daraus nicht entstehen: Eine jüngere Startmarke für einen Pfad gibt es nur, wenn die Version beim zweiten Push noch offen war, auf Dev also der spätere Inhalt liegt. Rot-Beweis: Lauf 18 mit Ist-Wert (ein offener Eintrag statt keinem). Rest: N13.
- **N2 bis N8, nur Stichprobe:** N3 umgesetzt (`advisor-report.md:23`, Wortlaut passt zu `parseFreigabe`). N5 umgesetzt (`gate-db.mjs:43` Zeitlimit, `:112-119` Pause; die Versuche bleiben ungetestet). N6 umgesetzt (`bericht.mjs:31`, ebenso `gate-db.mjs:81`). N4 erweitert (`positiv-register.test.ts:51`); nicht erfasst bleibt `rollback` am Textende ohne Semikolon. N1, N2, N8 stehen in `docs/OFFEN.md:8`. Zu N2 siehe M6: Die Entscheidung zu `GLOBAL` und `SYSTEM` ist in Ordnung, die git-Bedingung in derselben Funktion nicht.

## Prüffragen

**Zusammenziehung in `entscheideBefehl`: neue Lücken?** Nein. Die Lesart wird nur zurückgegeben, wenn sie sperrt (`:274-275`); `ohneHeredoc` läuft vorher, Heredoc-Körper mit zitiertem Endwort sind also schon entfernt. Dass die zusammengezogene Fassung in der Rekursion noch einmal durch `ohneHeredoc` läuft, kann höchstens diese zusätzliche Lesart verkürzen, nie die ursprüngliche.

**Zusammenziehung: Falschalarme in üblicher Schreibweise?** Für die üblichen mehrzeiligen Befehle (Fortsetzung mit `\` in Bash, Backtick in PowerShell, Commit über Heredoc, `npm run bericht -- a \` + Umbruch + `b`) keine gefunden; die Zusammenziehung ist dort die richtige Lesart. Die Fälle, in denen das Zeichen keine Fortsetzung ist, stehen unter N11.

**Kern-Prüfung in `gitGrund`: neue Lücken oder Falschalarme?** Keine Lücke (die Bedingung erweitert nur). Ein Falschalarm: N9. Die Wörter `w` stammen weiter aus dem rohen Segment; bei geklebtem git ist das erste Wort die Hülle (`$o=git`), was die Regeln nicht stört, weil keine von ihnen die Position des Wortes git braucht.

**`unmarkierteStarts`.** Siehe M5 oben; fail closed bleibt erhalten, kein Weg zu einer Marke ohne Beleg. Rest N13.

**Rot-Läufe.** Lauf 17: genau die 14 neuen Proben rot (vier zu M1, zwei zu M2, drei zu M3, fünf zu M4), Ist-Wert „Exit 0 statt 2“ (der Guard ließ durch), `EXIT=1`; Lauf 21 grün mit 400 Tests. Lauf 18 und 19 siehe H1 und M5; Lauf 20 grün. Alle Läufe in `runs.jsonl` ab 17 stehen auf dem Commit 84bea13 mit unsauberem Baum; die Volläufe auf dem Endstand stehen noch aus und sind nicht Teil dieser Prüfung.

**Geld, Sicherheit der App, Schema.** Nicht berührt. Keine Secrets in den geprüften Dateien, keine `.env`-Datei gelesen.

## Stichproben

- `scripts/sys/gate-db.mjs:30-34` – `tmp/proof`, `TMP\Proof\x`, `./tmp/../tmp/proof/x` ergeben nach Auflösung denselben Anfang, Exit 2 vor jedem Schreiben: stimmt.
- `scripts/sys/gate-db.mjs:60`, `:72-76` – Ziel der Attrappe ist derselbe Optionswert, der geprüft wurde: stimmt.
- `scripts/sys/gate-db.mjs:43`, `:112-119` – Zeitlimit 120 s, drei Versuche mit 3 s Pause: stimmt.
- `scripts/sys/run.mjs:17`, `:35` – Proben starten die Attrappe aus dem Projektordner, die Sperre gilt dort: stimmt.
- `scripts/sys/gate-db-lib.mjs:76-78` – Startmarke A, Startmarke B, Marke B → leer; ohne Marke bleibt B offen, nicht A: stimmt (Test `sys-gate-db.test.ts:132-136`).
- `scripts/sys/gate-db-lib.mjs:76` – Schlüssel ist der Pfad, nicht die Version: Befund (N13).
- `.claude/hooks/guard.mjs:251` – `$o=git push --no-verify`: Kern `git push --no-verify`, gesperrt: stimmt.
- `.claude/hooks/guard.mjs:251`, `:257-259` – `(git config core.hooksPath)`: Kern beginnt mit git, Segment endet auf `)`, Wort `core.hooksPath)` trifft: gesperrt, vorher frei: Befund (N9).
- `.claude/hooks/guard.mjs:251`, `:257-259` – `if ((git config core.hooksPath) -ne '.githooks') { npm run prepare }`: Kern `git config core.hooksPath) -ne …`, Segment endet auf `}`: gesperrt, vorher frei: Befund (N9).
- `.claude/hooks/guard.mjs:242-243` – `$env:GIT_CONFIG_COUNT = 1; …; git push`: Treffer und Rohwort git, gesperrt: stimmt.
- `.claude/hooks/guard.mjs:243` – `export GIT_CONFIG_COUNT=1 …; out=$(git push 2>&1)`: Treffer, aber kein Rohwort git, frei: Lücke (M6).
- `.claude/hooks/guard.mjs:257` – `git config core.hooksPath }`, `… <(true)`, `… >(true)`: keine Leseform, gesperrt: stimmt.
- `.claude/hooks/guard.mjs:37`, `:254-255` – `git config core.hooksPath } 2>/dev/null`: `}` bleibt Wort, zwei Wörter, gesperrt: stimmt.
- `.claude/hooks/guard.mjs:272` – `git push \` + Umbruch + `--no-verify`, `git -c \` + Umbruch + `core.hooksPath=x push`, `npm run \` + Umbruch + `check`: zusammengezogen gesperrt: stimmt.
- `.claude/hooks/guard.mjs:272` – `git push --no-ver\` + Umbruch + `ify`: `--no-ver ify`, frei: Grenze (N10).
- `.claude/hooks/guard.mjs:269-276` – Commit über `cat <<'EOF'`: Körper entfernt, keine Zusammenziehung, keine Rekursion: stimmt.
- `.claude/hooks/guard.mjs:374` – Kopieren einer `runs.jsonl` nach `tmp/proof` bleibt gesperrt (Umweg um die H1-Sperre): stimmt.
- `scripts/sys/bericht.mjs:31` – beschädigte Zeile wird übersprungen: stimmt.
- `.claude/agents/advisor-report.md:23` – Auftrag bzw. Antrag getrennt, Urteilszeile wörtlich: stimmt.
- `docs/OFFEN.md:8` – u3b-1 nennt die Falschalarme und Grenzen aus N1, N2, N8: stimmt; N9 bis N11 und die Reste zu M1 und M2 fehlen dort noch.
- `tmp/proof/u3b/017-tests_unit_sys-guard.test.ts.log:13-56`, `:83` – 14 rote Proben, Ist-Wert Exit 0, `EXIT=1`: stimmt.
- `tmp/proof/u3b/018-tests_unit_sys-gate-db.test.ts.log:20-47` – M5 und H1 rot mit Ist-Wert: stimmt.

Offene Findings hoch: 0
