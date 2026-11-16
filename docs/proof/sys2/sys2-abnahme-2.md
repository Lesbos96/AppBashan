Modell: claude-fable-5-2
Vorgaenger: tmp/proof/sys2-abnahme-1.md

# Abnahme sys2 (R3), Runde 2 (Kontrollrunde)

Datum: 2026-11-16
Stand beim Prüfen: Branch `sys2`, HEAD `aede54f` und sauberer Arbeitsbaum laut Auftrag.

Umfang: die Änderungen seit Runde 1 an `.claude/hooks/guard.mjs` (M1 bis M4) und `scripts/sys/fertig.mjs` (M5) samt Tests, Rot- und Grün-Läufen; dazu der Stand der Funde aus Runde 1. `scripts/sys/run.mjs` und die Migration 0071 tragen dieselben Hashes wie in Runde 1 (dort Zeilen 13 und 16) und sind nicht neu bewertet.

Vollständig gelesen: `.claude/hooks/guard.mjs`, `scripts/sys/fertig.mjs`, `scripts/sys/abnahme-lib.mjs`, `tests/unit/sys-guard-nachweise.test.ts`, `tests/unit/sys-fertig.test.ts`, `tmp/proof/sys2/runs.jsonl`, `tmp/proof/sys2-abnahme-1.md`, `docs/STAND.md`, die Logs 013 bis 015. Aus Log 012 Kopf, Fehlerzeilen und Schluss, aus Log 016 Kopf und Schluss. Aus `docs/OFFEN.md` die Zeilen 92 bis 97, aus `docs/ENTSCHEIDUNGEN.md` 198 und 199, aus `docs/BEKS.md` und `.claude/settings.json` nur die Treffer.

SHA256: b003b7b75e0262b18da6f8d659a7ab6b36ba8fd3d8ea48153b41ec6f5af21359 scripts/sys/run.mjs
SHA256: b36e382dd19cdb25b4836243dac55b85c7da6519a9b3b62e105a67b173a6960e scripts/sys/fertig.mjs
SHA256: a625f61d9d71c549ac1b7a673547eb2bc6d6c3669e9d93734652181f50657877 .claude/hooks/guard.mjs
SHA256: bbcee1a601d3021ff00d266616da1268ada5771b9f3ffcd7e44799531439506a supabase/migrations/20261116160000_0071_public_default.sql

Hinweis zu den Hashes: aus dem Auftrag abgeschrieben, nicht nachgerechnet (kein Shell-Werkzeug). Den Abgleich mit dem Endstand macht `fertig` (`fertig.mjs:211`).

Keine gelöschten Dateien.

## Ergebnis in Kürze

Kein hoher Fund, aus Runde 1 ist keiner offen. M5 ist behoben: der Rot-vor-Grün-Filter ist jetzt in jedem Punkt gleich streng oder strenger als in sys1, die Folge Grün mit Argument, Rot, Grün wird blockiert. M1, M2 (a bis c), M3 und M6 sind behoben, M4 zum Teil (wie angekündigt). Gegenüber `main` ist nichts gelockert.

Im neuen Guard-Teil bleiben zwei mittlere Lücken, die nicht in der Liste der bewussten Reste stehen: Klammerlisten in üblicher Schreibweise (M7) und der Ziel-Parameter in Großschreibung (M8, erst durch den Fix zu M3 entstanden). Beide gehören vor `npm run fertig` nach OFFEN sys1-4; das ist reine Doku und braucht keine neue Runde. Wird `guard.mjs` noch einmal angefasst, braucht es Runde 3.

## Stand der Funde aus Runde 1

| Fund | Stand | Beleg |
| --- | --- | --- |
| M1 Platzhalter in Zwischenordnern | behoben | `guard.mjs:123-129`, Tests `:78-81`, vorher rot (Log 012:17-20) |
| M2 Arbeitsordner | (a) bis (c) behoben, (d) offen wie angekündigt | `guard.mjs:337`, `:343-346`, Tests `:91-93`; (d) in `OFFEN.md:94` |
| M3 Ziel-Wort | behoben, neue Lücke M8 | `guard.mjs:130-147`, Tests `:82-86`, `:112-116` |
| M4 Schreibweisen im Wort | Anführungszeichen mitten im Wort und Zeichenklassen behoben; Rest in `OFFEN.md:94`; dazu N8 | `guard.mjs:124`, `:151`, Tests `:87-90` |
| M5 Rot-vor-Grün | behoben | `fertig.mjs:81-85`, Test `:214-222`, vorher rot (Log 013:18-23) |
| M6 Doku | behoben | `OFFEN.md:93-97`, `STAND.md:6-9`, `BEKS.md:17`, `ENTSCHEIDUNGEN.md:198-199` |
| N1 bis N5 | unverändert, niedrig | `OFFEN.md:93`, `:94`, `:97` |
| N6 Testfälle | behoben | 22 neue Fälle, 74 auf 96 |

Zu M6: Das wörtliche Ja von Beks steht jetzt als Zitat in `ENTSCHEIDUNGEN.md:198`. Den Prompt selbst kenne ich weiter nur aus zweiter Hand.

## Findings

### hoch

Keine.

### mittel

- M7 · `.claude/hooks/guard.mjs:144-151` – Klammerlisten treffen in zwei üblichen Schreibweisen nicht. (a) `mv tmp/proof{,-alt}` und `mv tmp{,2}` (gängige Kurzform für Umbenennen): das eine Wort gilt als Ziel und fällt in Zeile 146 heraus, die Quellenliste ist leer; die alte Regel (`:428-429`) trennt am Komma und sieht `tmp/proof{`, das ihr Muster nicht trifft. (b) `rm -rf tmp/{shots,proof}`: Zeile 150 trennt am Komma, bevor die Klammern entfallen, das zweite Stück ist nur noch `proof` und wird gegen die Wurzel aufgelöst; die umgekehrte Reihenfolge `tmp/{proof,shots}` trifft. Beides von Hand an den Zeilen durchgegangen, nicht ausgeführt. Keine Lockerung: beide Formen gingen schon in Runde 1 und in sys1 durch. `OFFEN.md:94` nennt nur die Kunstform `t{m,}p`, und `STAND.md:9` liest sich, als seien Klammerlisten abgedeckt. – Fix: eine Ebene Klammerlisten zu ganzen Wörtern ausschreiben (Text davor und dahinter an jede Alternative), und zwar vor der Ziel-Bestimmung; Testfälle zuerst rot. Bis dahin beide Formen wörtlich in OFFEN sys1-4 und `STAND.md:9` anpassen.

- M8 · `.claude/hooks/guard.mjs:130-133` – `zielParam` schreibt das Wort klein, bevor es mit dem kurzen Ziel-Schalter vergleicht. Der großgeschriebene Schalter von GNU mv (Ziel nicht als Ordner behandeln) hat keinen Wert, zählt hier aber als Ziel-Parameter: bei `mv -T tmp x` fällt `tmp` als vermeintlicher Wert heraus, geprüft wird nur `x`, der Befehl geht durch. In Runde 1 wurde diese Form noch verweigert (Ziel war das letzte Wort); gegenüber `main` ist es keine Lockerung, weil dort Elternordner gar nicht geschützt waren. Verwandte Reste von M3: abgekürzte lange Option (`mv --target=x tmp`) und angeklebter Wert (`mv -tx tmp`) erkennt Zeile 132 nicht, dann gilt `tmp` als letztes Wort wieder als Ziel. Von Hand durchgegangen, nicht ausgeführt. – Fix: den kurzen Schalter ohne Kleinschreibung vergleichen; jedes Präfix der langen Option ab drei Zeichen und den angeklebten Wert erkennen; sonst alle Wörter prüfen. Testfälle zuerst rot. Bis dahin in OFFEN sys1-4.

### niedrig

- N7 · `.claude/hooks/guard.mjs:345` – Die Menge der Arbeitsordner verdoppelt sich mit jedem `cd` auf ein neues relatives Ziel (jedes Ziel wird gegen jeden bisherigen Ordner aufgelöst). Übliche Befehle merken nichts (zehn Wechsel sind rund 1000 Einträge). Ab etwa 20 verschiedenen Wechseln in einem Befehl oder in einer geprüften Skriptdatei wird der Guard langsam, ab etwa 23 droht Speichermangel. Laut `.claude/settings.json:9` blockiert ein gescheiterter Hook (`onFailure` auf `block`); ob das auch bei Absturz und Zeitüberschreitung so greift, habe ich nicht geprüft. – Fix: Obergrenze (zum Beispiel 64 Einträge), darüber verweigern mit Grund „nicht prüfbar“.

- N8 · `.claude/hooks/guard.mjs:184`, `:151` – M4 ist für Anführungszeichen am Wortanfang nicht behoben: `rm -rf "tm"p` und `rm -rf "tmp/pro"of` zerlegt `woerter` in zwei Wörter (`tm` und `p`), keines trifft. In Bash ist es ein Wort. Die Tests decken nur Anführungszeichen mitten im Wort (`:87-88`). Kunstform, nicht ausgeführt. – Fix: Wörter wie in `GIT_WORT` (`:267`) bilden, dann die Anführungszeichen entfernen; bis dahin OFFEN.

- N9 · `.claude/hooks/guard.mjs:139-140` – Umleitungen: (a) angeklebt ohne Leerzeichen (`rm -rf tmp>/dev/null`) bleibt ein Wort und trifft nicht, auch nicht in der alten Regel (`rm -rf tmp/proof>/dev/null`); bestand schon vorher. (b) Ein Umleitungszeichen in Anführungszeichen als eigenes Wort (`rm -rf '>' tmp`) gilt als Umleitung und nimmt das nächste Wort mit; neu seit dem Fix zu M3, reine Kunstform. – Fix: Umleitungen am Rohwort erkennen (wie `gitWoerter`, `:273-274`) und ein Wort am ersten Umleitungszeichen außerhalb von Anführungszeichen abschneiden; bis dahin OFFEN.

- N10 · `.claude/hooks/guard.mjs:149`, `:428` – Ein PowerShell-Parameter mit Doppelpunkt und Wert in einem Wort (`Remove-Item -Path:tmp -Recurse`, `Remove-Item -LiteralPath:tmp\proof\sys2-abnahme-1.md`) fällt als Option heraus, in der neuen und in der alten Regel. Bestand schon in sys1. – Fix: bei Wörtern mit Bindestrich vorn und Doppelpunkt oder Gleichheitszeichen den Wert prüfen; bis dahin OFFEN.

- N11 · `.claude/hooks/guard.mjs:343-344` – Ordnerwechsel, die die Liste nicht erkennt: `cd..` und `cd\` ohne Leerzeichen (PowerShell und cmd), `cd` ohne Ziel, `cd /c` (ein Buchstabe nach dem Schrägstrich gilt als Schalter). Danach wird nur gegen die Wurzel aufgelöst. – Fix: in OFFEN zu den Resten.

- N12 · `.claude/hooks/guard.mjs:153-157` – Neuer Fehlalarm durch die Ordner-Menge: nach einem `cd` wird jedes Wort auch gegen die Wurzel geprüft, `cd dist && rm -rf *` wird deshalb verweigert (in Runde 1 erlaubt). Gewollt (fail closed, mein Vorschlag aus M2), aber kein Test hält es fest, und die Liste der Fehlalarme in `OFFEN.md:94` nennt es nicht. `cd dist && rm *.map` und `cd tmp && rm -rf shots` bleiben erlaubt. – Fix: in OFFEN nennen.

- N13 · `tests/unit/sys-guard-nachweise.test.ts:78-93` – Lücken der Tests, ohne Wirkung auf das Urteil: kein Fall für `popd` und `cd -` (derselbe Mechanismus wie `:92`), keiner für `Rename-Item -NewName x tmp`, keiner für `git rm --cached x` (erlaubt, von Hand geprüft). – Fix: mit M7 und M8 ergänzen.

- N14 · `tmp/proof/sys2/runs.jsonl:14-21` – Die Läufe 12 bis 19 liefen auf Commit `5caead2` mit unsauberem Baum, also vor dem Commit `aede54f`. Als Rot- und Grün-Beleg der Tests reicht das; dass der committete Stand derselbe ist, belegt erst der Pflichtlauf `check` auf dem Endstand. – Fix: keiner.

## Prüffragen

**(a) Gate nirgends gelockert; `fertig.mjs` gegen M5.**

- `fertig.mjs:81`: die Menge der Läufe ist die von sys1 (Schritt, gültiges Log, Hash der Endfassung), ohne Bedingung an Argumente oder Schalter. `:82`: das erste Grün ist das erste mit Exit 0 in dieser Menge, gleich mit welchen Argumenten, Schaltern oder unter welchem Pfad. `:83`: das Rot braucht zusätzlich leere Argumente und das Feld `schalter`. `:84`: zusätzlich ein Grün nach dem Rot ohne Argumente und ohne Schalter. `:85` blockiert, wenn eines fehlt. Jede Folge, die jetzt durchgeht, ging auch in sys1 durch; die Bedingungen sind nur dazugekommen.
- Grün mit Argument (Nr. 1), Rot (Nr. 2), Grün (Nr. 3): erstes Grün ist Nr. 1, ein Rot davor gibt es nicht, blockiert. Mit Schalter statt Argument ebenso. Test `sys-fertig.test.ts:216-217`; der Fall war vor dem Fix rot mit Ist-Wert (Log 013:23, leere Grundliste statt Blockiergrund).
- Rot, dann nur Grün mit Argument: blockiert (`:219`). Rot, Grün mit Argument, zählendes Grün: gültig (`:221`).
- Für diesen Schritt: Lauf 9 rot, Lauf 10 grün, beide ohne Argumente und Schalter, gleicher Dateihash (`runs.jsonl:9`, `:12`); kein weiterer Lauf mit diesem Hash.
- Eine Randbemerkung, kein Fund: ein Grün fällt weiter aus der Menge, wenn sein Log nicht gültig ist. Seit dem neuen Kopf gilt das für Läufe ohne das Feld `schalter`. Betroffen sind nur die Läufe 1 und 2 dieses Schritts, beide ohne Dateihash (`runs.jsonl:1-2`); künftige Schritte haben das Feld immer.
- `gueltigerLauf` (`:33-34`) und `kopfPasst` (`:119-129`) lesen sich wie in Runde 1 beschrieben; der Zeilenversatz hinter dem Block ist durchgehend plus 1.
- Guard: die alte Regel steht unverändert vor der neuen (`:427-431`, dann `:432`). Die Ordner-Menge (`:337`, `:343-346`) fließt nur in `trifftProof`, die Wurzel bleibt immer darin, es fällt nie ein Ordner weg. Kein neues `return null`, kein neues `continue` im Segment-Durchlauf. Die entfernten Umleitungswörter und die Ziel-Parameter wirken nur im neuen Teil.
- Gegenüber Runde 1 gehen zwei Formen neu durch (M8 mit dem großgeschriebenen Schalter, N9 b). Gegenüber `main` keine.
- Grenze: kein Git-Werkzeug, kein Diff gelesen. Dass nur die vier genannten Dateien geändert wurden, ist die Angabe der Hauptsession.

**(b) `trifftSegmente`, `trifftProof`, `absolut`, Ordner-Menge: Umgehungen und Fehlalarme.**

- `trifftSegmente` (`:126-129`): vergleicht die ersten höchstens sieben Segmente mit dem aufgelösten Pfad von `tmp/proof`. Elternordner (weniger Segmente, alle passen), `tmp/proof` selbst und alles darunter treffen; ein Platzhalter gilt je Segment und überschreitet keinen Schrägstrich. Durchgegangen: `tmp/*/*.log`, `tmp/pro*/x`, `*/proof`, `*/*/sys2`, `t*`, `tm[p]`, `C:\` treffen; `tmp/*.png`, `tmp/p*.png`, `*.log`, `*/*.md`, `tmp/proof-alt`, `/tmp/x`, ein Pfad im Benutzerordner außerhalb des Projekts treffen nicht.
- `segRegex` (`:124`): alle Sonderzeichen außer Stern und Fragezeichen werden maskiert, ein ungültiger Ausdruck kann nicht entstehen; eine verneinte Zeichenklasse trifft zu viel (fail closed).
- Ausnahme `lauf.lock` (`:156`): nur der genaue Pfad; `cd tmp/proof && rm lauf.lock` erlaubt, `tmp/proof/sys2/lauf.lock` und `lauf.loc?` verweigert.
- Übliche Befehle, von Hand geprüft, alle erlaubt: `rm -rf tmp/shots`, `rm node_modules`, `rm -rf node_modules dist`, `mv x.png .`, `mv x.png . 2>/dev/null`, `rm tmp/*.png`, `git rm --cached x` (das Wort `rm` hinter `git` wird als Pfad mitgeprüft, harmlos), `git mv a.md ..`, `rm -rf tmp/svg tmp/shots`, `rd /s /q dist`, `Remove-Item tmp\shots\* -Recurse`, `mv a b 2>&1`, `cd tmp && rm -rf shots`.
- Fehlalarme: `cd dist && rm -rf *` (N12, neu), `rm tmp/*/a.png` (gewollt, M1), `git rm -r --cached .` (N4 aus Runde 1).
- Umgehungen über die Liste der bewussten Reste hinaus: M7, M8, N8 bis N11. Weiter offen wie angekündigt und in `OFFEN.md:94`: Backslash und Backtick, Tilde, Variablen, früheres `cd`, Pipe-Eingabe, `find`, verschachtelte Shells, anderer Programmname, `git -C`.
- Laufzeit der Ordner-Menge: N7.

**(c) Decken die Tests M1 bis M5?**

- M1: vier Fälle verweigert (`:78-81`), Gegenprobe erlaubt (`:117`). Ja.
- M2: Unterschale (`:91`), gescheitertes `cd` (`:92`), `Push-Location` (`:93`), erlaubt nach `cd` (`:109-110`). Ja für (a) bis (c); `popd` nur mittelbar (N13); (d) bewusst offen.
- M3: vier Formen verweigert (`:82-85`), fünf erlaubt (`:112-116`). Ja für die Formen aus Runde 1; die Lücke M8 hat keinen Fall.
- M4: zwei Fälle zu Anführungszeichen, zwei zu Zeichenklassen (`:87-90`). Ja für das Behobene; N8 hat keinen Fall.
- M5: vier Aussagen (`:216-221`), darunter die Gegenprobe. Ja.
- Rot-Beweis: Log 012 zeigt 16 rote Fälle mit Ist-Wert (15-mal Exit 0 statt 2, einmal Exit 2 statt 0 für `mv x.png . 2>/dev/null`). Von den 16 neuen Verweigert-Fällen war einer schon vorher grün (`Move-Item tmp -Destination x`, in Runde 1 so festgehalten), von den sechs neuen Erlaubt-Fällen fünf; das passt. Log 013 zeigt den einen roten Fall an der ersten Aussage; die zweite (Schalter) lief wegen des Abbruchs nicht einzeln rot, folgt aber derselben Zeile des alten Filters.
- Grün: Log 014 mit 96 von 96, Log 015 mit 50 von 50, Log 016 mit 403 von 403, je `EXIT=0`; dazu `runs.jsonl:19-21` (sys-run 19, gate-loesch 49, abnahme 18, je Exit 0).

**Geld, Sicherheit der App, Schema.** Seit Runde 1 nicht berührt; die Bewertung der Migration 0071 aus Runde 1 gilt (gleicher Hash).

## Grenzen dieser Prüfung

- Kein Shell- und kein Git-Werkzeug: Hashes nicht nachgerechnet, kein Diff gelesen, der Guard nicht ausgeführt. M7, M8 und N7 bis N12 sind am Quelltext von Hand nachvollzogen; ein Testfall (rot zuerst) ist die Gegenprobe.
- Das Verhalten der Umgebung bei Absturz oder Zeitüberschreitung des Hooks (N7) kenne ich nur aus dem Eintrag in `.claude/settings.json:9`.
- Die Pflichtläufe `check`, `e2e`, `rls` auf dem Endstand stehen noch nicht in `runs.jsonl`; sie sind nicht Teil dieser Abnahme. Jede Änderung an einer der vier genannten Dateien danach braucht Runde 3.

## Stichproben

| Stelle | Ergebnis |
| --- | --- |
| `.claude/hooks/guard.mjs:122` | Auflösen gegen jeden Arbeitsordner, Git-Bash-Laufwerk, klein: in Ordnung |
| `.claude/hooks/guard.mjs:124` | Zeichenklasse wie Fragezeichen, übrige Sonderzeichen maskiert |
| `.claude/hooks/guard.mjs:126-129` | segmentweise, höchstens sieben Segmente; M1 behoben |
| `.claude/hooks/guard.mjs:130-133` | Ziel-Parameter mit Abkürzung und Trennzeichen; Kleinschreibung trifft den wertlosen Großbuchstaben-Schalter (M8) |
| `.claude/hooks/guard.mjs:139-140` | Umleitung samt Ziel entfernt; Erkennung nach dem Entfernen der Anführungszeichen (N9) |
| `.claude/hooks/guard.mjs:144-147` | Quellen ohne Ziel-Parameter und Wert, sonst ohne letztes Wort; ein einzelnes Wort mit Klammerliste fällt ganz heraus (M7) |
| `.claude/hooks/guard.mjs:149-152` | Optionen verworfen, am Komma getrennt, dann Klammern und Anführungszeichen entfernt (M7 b, N10) |
| `.claude/hooks/guard.mjs:153-157` | jedes Wort gegen jeden Ordner; Ausnahme nur der genaue Pfad von `lauf.lock` |
| `.claude/hooks/guard.mjs:184` | Wort-Zerlegung trennt ein Anführungszeichen am Wortanfang vom Rest (N8) |
| `.claude/hooks/guard.mjs:337` | Menge beginnt mit der Wurzel, nichts wird entfernt |
| `.claude/hooks/guard.mjs:343-346` | sechs Befehle für den Ordnerwechsel, Ziel gegen jeden bisherigen Ordner (N7, N11) |
| `.claude/hooks/guard.mjs:427-432` | alte Regel unverändert vor der neuen, beide verweigern nur |
| `.claude/hooks/guard.mjs:459-463` | Fehler im Guard verweigert |
| `.claude/settings.json:9` | Hook mit `onFailure` auf `block` |
| `scripts/sys/fertig.mjs:33-34` | Pflichtlauf: leere Argumente, leere Schalter, fehlendes Feld zählt nicht |
| `scripts/sys/fertig.mjs:81-82` | Menge und erstes Grün ohne Bedingung an Argumente und Schalter |
| `scripts/sys/fertig.mjs:83-85` | Rot ohne Argumente vor dem ersten Grün, zählendes Grün danach, beide Pflicht |
| `scripts/sys/fertig.mjs:119-129` | fünf Kopfzeilen genau, Feld `schalter` Pflicht |
| `scripts/sys/fertig.mjs:211-212` | Hash-Vergleich und Mindestmenge der Abnahme |
| `scripts/sys/abnahme-lib.mjs:19-23` | Runden lückenlos ab 1, genau eine Vorgänger-Zeile je Runde |
| `tests/unit/sys-fertig.test.ts:207-213` | Fälle aus Runde 1 unverändert streng |
| `tests/unit/sys-fertig.test.ts:214-222` | neuer Fall zu M5, vier Aussagen |
| `tests/unit/sys-guard-nachweise.test.ts:78-93` | 16 neue Fälle verweigert |
| `tests/unit/sys-guard-nachweise.test.ts:112-117` | sechs neue Fälle erlaubt |
| `tmp/proof/sys2/012-…log:1-5`, `:15`, `:17-32`, `:51`, `:70-71`, `:98` | Commit `5caead2`, ohne Argumente und Schalter, 16 von 96 rot mit Ist-Wert, `EXIT=1` |
| `tmp/proof/sys2/013-…log:1-5`, `:18`, `:23`, `:50` | ein Fall rot, leere Grundliste statt Blockiergrund, `EXIT=1` |
| `tmp/proof/sys2/014-…log:17`, `:24` | 96 von 96, `EXIT=0` |
| `tmp/proof/sys2/015-…log:17`, `:24` | 50 von 50, `EXIT=0` |
| `tmp/proof/sys2/016-…log:17`, `:24` | 403 von 403, `EXIT=0` |
| `tmp/proof/sys2/runs.jsonl:9`, `:12` | Rot und Grün der neuen rls-Datei, gleicher Dateihash, ohne Argumente und Schalter |
| `tmp/proof/sys2/runs.jsonl:14-21` | Läufe 12 bis 19, Nummern wie im Auftrag, unsauberer Baum auf `5caead2` (N14) |
| `tmp/proof/sys2-abnahme-1.md:13-16` | Hashes von `run.mjs` und Migration gleich, von `fertig.mjs` und `guard.mjs` verschieden |
| `docs/OFFEN.md:93-94` | Reste zu sys1-3 und sys1-4 eingetragen; M7, M8, N8 bis N12 fehlen noch |
| `docs/OFFEN.md:95-97` | Funde der DB-Freigabe als sys2-1 bis sys2-3 |
| `docs/STAND.md:6-9` | 71 Migrationen, nächste 0072, Schalter im Log-Kopf; Zeile 9 zu Klammerlisten zu weit gefasst (M7) |
| `docs/BEKS.md:17` | Frage 1 beantwortet, Verweis auf Nr. 191 |
| `docs/ENTSCHEIDUNGEN.md:198-199` | Nr. 191 mit wörtlichem Zitat, Nr. 192 nennt die Kontrollrunde |

Offene Findings hoch: 0
