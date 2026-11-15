Modell: claude-fable-5-2

# Abnahme u3b (R3, Kennung u3b-1511-a)

Datum: 2026-11-15
Umfang: Arbeitssystem-Nacharbeiten gegen `tmp/proof/u3b-plan.md` und die im Auftrag genannten Ratspunkte. Vollständig gelesen: die zehn Dateien unten, dazu `tests/unit/sys-guard.test.ts`, `sys-gate-db.test.ts`, `sys-session.test.ts`, `sys-fertig.test.ts`, `positiv-register.test.ts`, `.claude/rules/daten.md`, `scripts/sys/lib.mjs`, `scripts/sys/gate-loesch-lib.mjs`, `tmp/proof/u3b/runs.jsonl`; in Auszügen: `tests/support/owner.ts`, `tests/support/positiv.ts`, `tests/unit/sys-gate-loesch.test.ts`, `scripts/sys/run.mjs`, `docs/OFFEN.md`, `.gitignore`, Logs 013 und 015 (nur Fehlerzeilen).

Grenzen dieser Prüfung
- Ich habe kein Shell-Werkzeug: Die Hashes sind aus dem Auftrag abgeschrieben, nicht nachgerechnet. Nichts wurde ausgeführt; alle Aussagen zum Guard und zum Gate stammen aus dem Lesen des Codes (Durchspielen von Hand).
- Kein Vergleich mit der Vorfassung (kein `git diff`): Ob eine Lücke neu ist oder schon bestand, ist nur dort gesagt, wo es aus dem Code selbst hervorgeht.
- Eine Datei mit meinem Planrat liegt nicht unter `tmp/proof/`; geprüft ist gegen die fünf Ratspunkte, die der Auftrag nennt.
- `docs/OFFEN.md` wurde während der Prüfung geändert (u2-3 und AM5 standen beim ersten Lesen noch in den Fristen, beim zweiten nicht mehr). Die zehn Dateien unten habe ich je einmal gelesen; ändert sich eine danach, fällt das am Hash auf.

SHA256: c9b65758185313a2481fc92648af27d61dbf308329ec3ad79d0e3ac75b6feffb .claude/hooks/guard.mjs
SHA256: 1ea8fa55f8b4499b723679d7ff9e1534ba1f03d4ddbe1af41c7774ff4ff4e75e .claude/hooks/session.mjs
SHA256: 71a82816f95fdd2235701913df9d935757bce8e2a9a81236768b7467f0b6527e .claude/agents/advisor-report.md
SHA256: aadf0ec673464661367d604b122cd43d715189cd5159fb42fd2e3b5b52eb9616 scripts/sys/bericht.mjs
SHA256: 186bc7887b68def9defdd7ccdd3fc601e30c31359ca753ebf5c6d7ebc4ff4208 scripts/sys/fertig.mjs
SHA256: e75614964ed05ed0ff73682e7b6128ff3fa8fad4af425ed1c71c2b76341bc860 scripts/sys/gate-db.mjs
SHA256: a1e61a04c5fd8e096f17bd372482cec11b1e257086ae3b3d84350e7baae2ecbd scripts/sys/gate-db-lib.mjs
SHA256: b3e3adb0353da56dbdb12cfea9ce8d08862820ce939049c43e943541b3a68540 scripts/sys/modell.mjs
SHA256: a0183fa85e426009da0746cb69c094b52cb03a07bd0c5f52c60612d47c965ed3 scripts/sys/loesch-register.json
SHA256: 37bbe1559762abeea670fe968e0d2bb7709c121c9086b8beb609d11efec3ab70 package.json

## Ergebnis in Kürze

Ein hoher Fund im Datenbank-Gate (H1): Der neue Modus `nachtrag` schreibt auch in der Attrappe Marken, und zwar in einen frei wählbaren Ordner; zeigt der auf den echten Nachweisordner, entsteht aus einer handgeschriebenen Liste eine echte Marke `db-push`. Das ist mit wenigen Zeilen zu schließen. Der Guard-Block ist gegenüber dem Plan sauber umgesetzt, hat aber vier Lücken in üblicher Schreibweise (M1 bis M4), drei davon in PowerShell bzw. bei Zeilenfortsetzung. Da wegen H1 ohnehin eine zweite Runde nötig ist, empfehle ich, M1 bis M5 in derselben Runde mitzunehmen. Geld, RLS und Schema sind von diesem Schritt nicht berührt (keine Migration, keine Edge Function, kein App-Code).

## Findings hoch

- **H1** · `scripts/sys/gate-db.mjs:51`, `:63-67`, `:78-79` – Der Nachtrag schreibt auch mit `--trocken` Marken, nach `<--freigaben>/runs.jsonl`. Die Liste kommt dann aus der Datei `--liste`, nicht von Dev. Mit `--freigaben tmp/proof/<schritt>` (dort liegt die echte Startmarke) entsteht so eine echte Marke `db-push` für eine Migration, deren Anwendung niemand belegt hat; `fertig` liest sie (`lib.mjs:38-52` nimmt jede `runs.jsonl` unter `tmp/proof/*/`). Der Guard lässt den Aufruf durch (kein Registerskript, keine Umleitung). Vor u3b schrieb die Attrappe keine Marken; der Kopfkommentar `:6` sagt weiterhin „nur die Prüfung“. Der naheliegende Fall ist kein Betrug, sondern Hilfsbereitschaft: Push gelungen, Liste bleibt unlesbar, `db:nachtrag` scheitert an derselben Liste, die Aufrufzeile `:23` bietet die Attrappe an. Damit fehlt genau der „positive Beleg“, den der Nachtrag haben soll. – Fix: In der Attrappe nie in den echten Nachweisordner schreiben: bei `--trocken` abbrechen (Exit 2), wenn `--freigaben` aufgelöst unter `tmp/proof` liegt (Vergleich aufgelöst und ohne Groß/Klein, wie `entscheideDatei`); Test dazu in `sys-gate-db.test.ts` (Attrappe mit Ordner unter `tmp/proof` → Exit 2, keine Zeile geschrieben). Kopfkommentar anpassen.

## Findings mittel

- **M1** · `.claude/hooks/guard.mjs:249-250` – `gitGrund` erkennt git nur an den Rohwörtern des Segments, nicht am Kern. Klebt git an einer Hülle, greift der ganze Block nicht: `$o=git push --no-verify`, `$null=git -c core.hooksPath=x push` (PowerShell-Zuweisung ohne Leerzeichen), `@git push --no-verify` (cmd), `&{git push --no-verify}`. `kern` liefert in allen Fällen `git …`, wird hier aber nicht gefragt. – Fix: git gilt als vorhanden, wenn ein Rohwort passt oder das erste Wort von `k` git ist; Negativproben dazu.
- **M2** · `.claude/hooks/guard.mjs:241` – `gitUmgebung` verlangt das Gleichheitszeichen direkt hinter dem Namen. Die übliche PowerShell-Form mit Leerzeichen geht durch: `$env:GIT_CONFIG_COUNT = 1; $env:GIT_CONFIG_KEY_0 = 'core.hooksPath'; $env:GIT_CONFIG_VALUE_0 = 'x'; git push` (die Segmente mit dem Schlüssel enthalten kein git, also greift auch `gitGrund` nicht). Der Test deckt nur die Form ohne Leerzeichen (`sys-guard.test.ts:530`). – Fix: Leerraum vor `=` zulassen, dazu `Set-Item env:GIT_CONFIG_…`; Negativprobe.
- **M3** · `.claude/hooks/guard.mjs:253-256` (mit `:37` und `:230-231`) – Die Leseform ist die einzige Erlaubnis mit dem Schlüssel und wird am gekürzten Kern geprüft. Zwei Schreibformen gelten dadurch als Lesen: `git config core.hooksPath }` (Bash nimmt `}` als Wert, `kern` schneidet es ab) und `git config core.hooksPath <(true)` bzw. `>(true)` (Prozess-Ersetzung wird als Umleitung verworfen, Bash übergibt aber einen Pfad als Wert). Beide setzen den Hook-Pfad auf ein nicht vorhandenes Ziel. – Fix: Leseform nur, wenn das Segment nicht auf `)` oder `}` endet und kein Rohwort mit `<(` oder `>(` beginnt; Negativproben.
- **M4** · `.claude/hooks/guard.mjs:106`, `:266` – Zeilenfortsetzung teilt einen Befehl in zwei Segmente: `git push \` + Zeilenumbruch + `--no-verify` (Bash), dasselbe mit Backtick (PowerShell) oder `^` (cmd), ebenso `git -c \` + Umbruch + `core.hooksPath=x push`. Das zweite Segment enthält kein git. Die Grenze gilt für alle Regeln des Guards (`npm run \` + Umbruch + `check`), sie bestand vermutlich schon; für einen Block, der „positionsunabhängig“ heißt, ist sie die sichtbarste Rest-Lücke. – Fix: als zusätzliche Lesart prüfen (wie `innentext` mit mehreren Texten): den Befehl mit zusammengezogenen Fortsetzungen noch einmal durch `entscheideBefehl`. Nicht ersetzen, nur zusätzlich, weil `cd C:\x\` + Umbruch + `npm run check` in PowerShell zwei Befehle bleibt.
- **M5** · `scripts/sys/gate-db-lib.mjs:73-78`, `scripts/sys/gate-db.mjs:81` – Eine überholte Startmarke bleibt für immer „ohne Marke“: Push 1 (SHA A) scheitert, Datei wird korrigiert (SHA B), Push 2 läuft durch und markiert B. Jeder spätere `nachtrag` meldet für A „Inhalt hat sich seit der Freigabe geändert“ und endet mit Exit 1; `db:types` läuft dann nicht nach (`package.json:70`). Es entsteht keine falsche Marke (fail closed), aber das Gate blockiert zu Unrecht. – Fix: je Pfad zählt nur der Eintrag der jüngsten Startmarke; Einträge, deren Pfad eine spätere Marke `db-push` hat, entfallen. Test: Startmarke A, Startmarke B, Marke B → nichts offen.

## Findings niedrig

- **N1** · `.claude/hooks/guard.mjs:256`, `:259`, `:225` – Verschleierte Schlüssel und Programmnamen gehen durch: `git config $'core.hooksPath' x`, `git config core.{hooksPath,x}`, `git -c core.hooks$P=x push` (die Regel „nicht prüfbar“ gilt nur mit dem Wort `config`), `g\it push --no-verify` (`istGit` entfernt nur Anführungszeichen). Absichtliche Formen, gleiche Klasse wie die dokumentierte Grenze `"$K"`. – Fix: die Regel `:259` für jedes git-Segment und zusätzlich für `{`; Schlüsselmuster ohne Anker auf Wörtern ohne Leerraum; sonst in OFFEN u3b-1 als Grenze nennen (auch `git send-pack`, das den pre-push-Hook nicht startet).
- **N2** · `.claude/hooks/guard.mjs:238-242` – `GIT_CONFIG_GLOBAL` und `GIT_CONFIG_SYSTEM` fehlen gegenüber dem Plan; die Begründung im Kommentar stimmt (lokale Konfiguration gewinnt), die Abweichung steht aber nicht im Auftrag. Die Bedingung „irgendein Wort ist git“ ist entbehrlich. – Fix: Abweichung im Bericht nennen; Bedingung kann bleiben.
- **N3** · `.claude/agents/advisor-report.md:23` – „bei DB- und Lösch-Freigaben den Hash aus dem Antrag“: Das Lösch-Gate kennt keinen Antrag (`scripts/sys/gate-loesch.mjs` enthält das Wort nicht). OFFEN u2-3 verlangte „bei Abnahmen und Lösch-Freigaben aus dem Auftrag, bei DB-Freigaben aus dem Antrag“; umgesetzt ist nur die Urteilszeile, der Eintrag ist aber schon aus `docs/OFFEN.md` entfernt. – Fix: Wortlaut vervollständigen oder den Rest als OFFEN-Eintrag behalten.
- **N4** · `tests/unit/positiv-register.test.ts:51` – Das Muster erfasst nicht jede Form, die eine Transaktion beendet: `abort`, `rollback work`, `rollback transaction`, `rollback` am Textende ohne Semikolon, `end work`, `prepare transaction`. Wirksam wäre das nur im Setup-Text, den `tests/support/owner.ts:113` direkt hinter `begin;` klebt (Schritte laufen im DO-Block, dort scheitert Transaktionssteuerung ohnehin). – Fix: Muster um diese Formen erweitern.
- **N5** · `scripts/sys/gate-db.mjs:103-109`, `:34` – Die drei Leseversuche folgen ohne Pause und sind ungetestet; `liesListe` hat kein Zeitlimit. – Fix: kurze Pause zwischen den Versuchen, `timeout` am Aufruf.
- **N6** · `scripts/sys/modell.mjs:24`, `scripts/sys/bericht.mjs:31`, `.claude/hooks/session.mjs:21` – Die Zählfunktion heißt `beraterDesSchritts` und liegt in `modell.mjs` statt wie geplant in `lib.mjs` (unbedenklich). `bericht.mjs:31` parst jede Zeile ohne Fangnetz: eine beschädigte Zeile bricht den Bericht ab. Im Detached-Zustand stempelt der Hook `null`, `schrittName()` liefert `detached`. Für u3b selbst zählt der Bericht zu wenig: Aufrufe vor der Hook-Änderung tragen keinen Stempel. – Fix: Zeilen wie in `lib.mjs:45-49` tolerant lesen; den Hinweis zur Unterzählung in die Bewertung schreiben.
- **N7** · `scripts/sys/bericht.mjs:52-64` – Die Logs des Rot-Beweises (013, 015, 016) sind Läufe einzelner Testdateien und werden nicht von selbst kopiert. – Fix: beim Bericht ausdrücklich nennen (`npm run bericht -- tmp/proof/u3b/013-…log …`).
- **N8** · `.claude/hooks/guard.mjs:246-247`, `docs/OFFEN.md:8` – Weitere Falschalarme fehlen in der Liste: `git grep -- --no-verify`, `git log -S core.hooksPath`, `git commit -e -m config`, eine Commit-Nachricht mit `GIT_CONFIG_COUNT=1`. – Fix: in OFFEN u3b-1 ergänzen.

## Prüffragen und Schwerpunkte

**Guard, git-Block (`gitGrund`, `gitWoerter`, `gitUmgebung`).** Die fünf Ratspunkte sind umgesetzt: Schlüssel und `--no-verify` zählen an jeder Stelle des Segments (`:251`, `:256`), Präfixe ab neun Zeichen sind gesperrt, Umleitungen werden am Rohwort erkannt und erst danach entquotet (`:230-231`), `GIT_CONFIG_*` wird über den ganzen Befehl gesucht (`:268`). Die Wortzerlegung hält `A\ B`, `"a\"b"` und `">x"` richtig zusammen. Lücken: M1 bis M4, N1. Die Falschalarm-Gegenproben (`sys-guard.test.ts:577-596`) habe ich gegen den Code durchgespielt; sie passen, auch `--get-regexp "^core\."`, `2> /dev/null`, `git -C ">d" status`, `git switch -c u3b`. `git config user.name edit` und `git -C x config core.hooksPath` bleiben gesperrt und sind als Negativproben belegt (`:538-539`); das weicht vom Plan ab, ist aber die sichere Richtung und im Code dokumentiert.

**`git` in PROGRAMME, Folgen für `kern`.** Pfad, Endung und Anführungszeichen entfallen jetzt auch vor git. Betroffen sind die Regeln mit `^git\s+…` im Block zu `docs/freigaben` (`:352-353`) und die Umbenenn-Regel (`:365`): Beide gelten nun auch für `"C:\…\git.exe"`, in beide Richtungen (Lesen erlaubt, `git mv`/`rm` gesperrt). Keine Lockerung gefunden. Die Kehrseite ist M1: `gitGrund` nutzt diese Normalisierung für die Erkennung nicht.

**`gate-db.mjs`, fail closed.** Die Startmarke entsteht erst nach `pruefePush` (`:90-91`, `:99`) und nie im Trockenlauf des Push (`:92-95`); sie enthält also nur freigegebene Migrationen. Das Neulesen fängt jeden Fehler von Liste, Vollständigkeitsprobe und Hash (`:103-109`); ohne lesbare Liste gibt es keine Marke und Exit 1 (`:110`). `fertig` ignoriert Startmarken (kein `nr`, `fertig.mjs:113`, `:132`), `run.mjs:52` zählt nach Logdateien. Der Nachtrag trägt als `start` den Zeitpunkt des Nachtrags, ein rls-Lauf davor zählt also nicht (`fertig.mjs:19`, `:33`). Das ist in Ordnung. Offen: H1 (Attrappe), M5 (überholte Startmarke), N5.

**Vertrauensgrenze von `nachtragMarken`.** Die Funktion vertraut drei Dingen: der Startmarke (gleicher Schutz wie die Marken selbst, gleiche Datei), der Liste und dem jetzigen SHA der Datei. Im echten Modus ist das tragfähig: Die Liste kommt nach dem Dev-Guard von Dev, ihre Form prüft `offeneMigrationen` vorab (`gate-db.mjs:47`), und `fertig` verlangt die Freigabe für den Endstand unabhängig davon. Eine Fälschung der Startmarke ist nicht leichter als eine der Marke. Die Grenze bricht nur dort, wo die Liste nicht von Dev kommt und das Ziel trotzdem echt sein kann: H1. Restannahme, die bleibt: Der einzige Push-Weg ist das Gate; wer die Datei ändert, am Gate vorbei pusht und zurückändert, bekäme eine Marke. Das setzt eine Guard-Umgehung voraus und ist hinnehmbar.

**Stempel `schritt` im Hook.** Genügt. `agents.jsonl` ist gegen Write und Umleitung geschützt, an der Zahl hängt kein Gate. Der Test mit `git init -b` und ohne Git ist aussagekräftig. Einschränkungen: N6.

**`stageNachweise` (Abweichung a).** Einverstanden, und enger als die `.gitignore`-Ausnahme: Es kommen nur Pfade in den Index, die `kopiere` unter `docs/proof/<schritt>/` angelegt hat, dazu `bericht.json`, `bericht.md` und `gruen.json` (`bericht.mjs:130`); der Scan läuft davor (`:97`) und bricht bei einem Treffer ab, bevor etwas gestaged wird. Fehlt eine Datei, wirft git. `fertig` prüft weiter, dass alles im Commit liegt (`fertig.mjs:184`, `:86`). `.gitignore:27` ist unverändert. Der Test prüft Wirkung (ungenanntes Log bleibt draußen).

**Abweichung b (`advisor-report.md:23`).** Die Urteilszeile steht jetzt wörtlich da und passt zu `parseFreigabe` (`gate-db-lib.mjs:42`, `:48`). Rest: N3.

**`positiv.ts` unter `ausgenommen`.** Bleibt. `tests/rls/positiv.test.ts` ist mit SHA gepinnt (`loesch-register.json:31`); `sys-gate-loesch.test.ts:129-133` prüft den SHA jeder Ausnahme, also auch außerhalb der gescannten Ordner. Der Rollback-Test ist da (N4 zum Muster).

**Rot-Beweis der `fertig`-Tests (Plan 3).** Lauf 13: sieben rote Tests, jeder mit Ist-Wert „Gate liefert keinen Grund“ (7-Tage-Grenze, Übernahme nach db-push, alter Lauf, `gruen.json`, N22, N23, N25); Lauf 16 grün. Das misst die Wirkung der gelockerten Sperre. Welche Fassung eingesetzt war, konnte ich nicht prüfen. Lauf 15 (rot, `stageNachweise` fehlt) und 16 belegen die neue Funktion.

**Plan-Abgleich.** 1 umgesetzt mit Abweichungen (N2, `user.name edit`), Lücken M1 bis M4. 2 umgesetzt (N6). 3 belegt. 4 umgesetzt, H1 und M5 offen. 5 umgesetzt. 6: S9i3-7 steht nicht mehr in `docs/OFFEN.md`. 7 durch Abweichung a ersetzt. Die Läufe in `runs.jsonl` sind alle mit unsauberem Baum auf dem Commit von u3 gefahren; die Volläufe auf dem Endstand stehen noch aus.

**Geld, Sicherheit der App, Schema.** Nicht berührt. Keine Secrets in den geprüften Dateien, keine `.env`-Datei gelesen.

## Stichproben

- `.claude/hooks/guard.mjs:16` – `git` in PROGRAMME: ja.
- `.claude/hooks/guard.mjs:224-234` – `git config core.hooksPath ">x"` → Wort `>x` bleibt, zwei Wörter nach Abzug der Flags, gesperrt: stimmt.
- `.claude/hooks/guard.mjs:251` – `git push --no-veri` (neun Zeichen) gesperrt, `git log --grep="--no-verify"` frei: stimmt.
- `.claude/hooks/guard.mjs:254-255` – `git config --show-scope --get core.hooksPath` frei, `git config get core.hooksPath x` gesperrt: stimmt.
- `.claude/hooks/guard.mjs:249-250` – `$o=git push --no-verify`: Rohwort `$o=git`, kein git erkannt, frei: Lücke (M1).
- `.claude/hooks/guard.mjs:241` – `$env:GIT_CONFIG_COUNT = 1; git push`: kein Treffer, frei: Lücke (M2).
- `.claude/hooks/guard.mjs:37`, `:253` – `git config core.hooksPath }`: Kern ohne `}`, Leseform, frei: Lücke (M3).
- `.claude/hooks/guard.mjs:106` – `git push \` + Umbruch + `--no-verify`: zwei Segmente, frei: Lücke (M4).
- `.claude/hooks/guard.mjs:352-353` – `"C:\Program Files\Git\cmd\git.exe" mv a docs/freigaben/b` → Kern `git mv …`, gesperrt: stimmt.
- `.claude/hooks/session.mjs:19-25`, `:52` – Stempel aus `git branch --show-current` im Projektordner, Fehler ergibt `null`: stimmt.
- `scripts/sys/modell.mjs:24-28` – zählt nur `SubagentStart` mit gleichem `schritt`: stimmt.
- `scripts/sys/gate-db.mjs:90-99` – Startmarke nach `pruefePush`, nicht im Trockenlauf des Push: stimmt.
- `scripts/sys/gate-db.mjs:51`, `:63`, `:78-79` – Nachtrag schreibt mit `--trocken` nach `<--freigaben>/runs.jsonl`: Lücke (H1).
- `scripts/sys/gate-db-lib.mjs:82-105` – Marke nur bei `remote` in der Liste und gleichem SHA, sonst Grund oder stumm offen: stimmt.
- `scripts/sys/gate-db-lib.mjs:73-78` – Startmarke A bleibt offen, wenn später B markiert wird: Befund (M5).
- `scripts/sys/fertig.mjs:104-107`, `scripts/sys/bericht.mjs:97`, `:130` – Scan vor dem Stagen, nur genannte Pfade: stimmt.
- `scripts/sys/fertig.mjs:113`, `:132` – Startmarken zählen weder als Lauf noch als Marke: stimmt.
- `scripts/sys/loesch-register.json:30-31`, `tests/unit/sys-gate-loesch.test.ts:129-133` – beide Einträge mit SHA, Test prüft jeden: stimmt.
- `package.json:70` – `db:nachtrag` zieht `db:types` nach: stimmt.
- `.claude/rules/daten.md:31` – Nachtrag beschrieben, „nur bei unverändertem SHA-256“: passt zum Code.
- `tmp/proof/u3b/013-tests_unit_sys-fertig.test.ts.log:27-137` – sieben Fehlschläge mit Ist-Wert: stimmt.
- `scripts/sys/gate-loesch.mjs` – Suche nach „antrag“: kein Treffer (N3).

Offene Findings hoch: 1
