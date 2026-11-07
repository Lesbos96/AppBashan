# Abnahme R1 Etappe 3, Fix-Schleife 1 (advisor-report)

Datum: 2026-11-07. Umfang: `tmp/proof/r1-e3-fix1.diff` (redproof-deploy.mjs, redproof-lib.mjs, redproof-restore.mjs), `tests/unit/redproof-deploy.test.ts`, `tests/unit/redproof-lib.test.ts` Abschnitt „Restore von Hand". Nur gelesen. Hinweis: In der Tool-Liste dieses Subagents stand ein eingebautes advisor-Tool ohne Parameter; nicht benutzt.

## Findings

### hoch
- **H1** `scripts/redproof-deploy.mjs:83-84` – `settingsMatch` erwartet von `functions list -o json` ein Array und setzt sonst `[]`. Die CLI 2.122.0 liefert in dieser Umgebung aber ein Objekt mit Schlüssel `functions` (Beleg: `tmp/proof/r1-quote-info-vorher.txt:1`, Ausgabe von `info()` = gleicher Befehl ohne `-o`). Dann ist `fn` immer undefined, `deployMatches` immer falsch: Restore deployt jedes Mal und endet trotzdem mit FatalError, die Deploy-Markierung aus dem E3-Abbruch lässt sich nie quittieren. Sicherheitsseitig fail-closed, aber der Fix wirkt nicht. Die Unit-Tests (`redproof-deploy.test.ts:78-89`) mocken nur Arrays und decken das nicht auf. – Fix: einmal lesend `functions list -o json` gegen Dev aufnehmen (nach `tmp/`), die echte Form als Fixture in den Test übernehmen, im Code beide Formen annehmen (Array oder `.functions`); jede andere Form als Fehler werfen, nicht stillschweigend als leere Liste behandeln.

### mittel
- **M1** `scripts/redproof-deploy.mjs:64-77, 80-88` – Der Abgleich ist einseitig: `matches` prüft nur, ob jede geladene Datei unter `supabase/functions` im Commit gleich vorliegt. Nicht geprüft werden Einstiegspunkt und Import-Map. Ein Deploy unter dem Slug quote, der nur aus unveränderten Commit-Dateien besteht, aber einen anderen Einstiegspunkt hat (z. B. `photo-cleanup/index.ts`, ebenfalls verify_jwt false), würde quittiert. Dateien, die der Download außerhalb von `supabase/functions` ablegt, werden ignoriert (Zeile 67). Mit den fünf Lockerungen aus `redproof-s9a3.mjs:299-303` (nur Textersatz in handler.ts) ist das nicht erreichbar, die Quittung behauptet aber „Dev = Commit“. – Fix: in `settingsMatch` zusätzlich prüfen, dass `entrypoint_path` auf `/supabase/functions/quote/index.ts` endet und `import_map === false` ist, solange config.toml für quote nichts anderes setzt (beide Felder stehen in der list-Ausgabe, Beleg wie H1). In `matches` das ganze Download-Verzeichnis durchlaufen, Dateien außerhalb von `supabase/functions` als Abweichung zählen und `quote/index.ts` als Pflichtdatei verlangen.
- **M2** `scripts/redproof-lib.mjs:531` – Wirft die lesende Vorprüfung (Download scheitert, Function fehlt oder ist nicht ACTIVE, JSON nicht lesbar, Netz), bricht recover ohne Deploy mit Exit 1 ab. Gerade die Zustände, die einen Deploy brauchen, sind damit nicht reparierbar. Fail-closed, Markierung bleibt. – Fix: nur die Vorprüfung in try/catch fassen, Fehler = „passt nicht“ → deployen; die Nachprüfung (Zeile 532) bleibt streng. Dazu ein Test, in dem die erste `deployMatches`-Abfrage wirft.

### niedrig
- **N1** `scripts/redproof-deploy.mjs:85` – Regex auf config.toml: Sie trifft auch auskommentierte Zeilen (die erste passende Zeile im Abschnitt gewinnt) und bricht bei jedem `[` im Abschnitt ab (z. B. Array-Wert); fehlt verify_jwt, kommt undefined zurück statt des CLI-Standards true. Meist fail-closed. Falsch quittiert wird nur, wenn ein auskommentiertes „false“ vor einem echten „true“ steht. – Fix: Kommentarzeilen vorher entfernen, Zeilenanker `^verify_jwt` mit Flag m, fehlender Wert = true.
- **N2** `scripts/redproof-s9a3.mjs:312, 323, 327` – Die Prüfung vor Teil 2 und das `verify` des Fensters vergleichen nur Dateien, die Restore jetzt zusätzlich Einstellungen. Das ist uneinheitlich (die Lockerungen ändern config.toml nicht, also kein akutes Loch). – Fix: dieselbe Funktion wie in restore.mjs:19 verwenden.
- **N3** `tests/unit/redproof-deploy.test.ts:69-75` – Der Test fängt die konkrete Klasse (content_path-Ziel fehlt in der Kopie) an HEAD. Andere Dateiverweise, die die CLI beim Laden auflösen könnte (`import_map`, `entrypoint`, `static_files`, `sql_paths`), erfasst er nicht; derzeit ist in config.toml nur content_path aktiv (geprüft: `supabase/config.toml:431, 435`; `sql_paths` Zeile 72 liest der Deploy nicht). Die Regex verlangt doppelte Anführungszeichen und `./`; durch `refs.length > 0` wird sie nicht stumm leer. – Fix (optional): alle nicht auskommentierten String-Werte mit `./` am Anfang aus config.toml sammeln und gegen `gitList` prüfen.
- **N4** Secrets der Function liegen außerhalb von Deploy und Abgleich. Die Lockerungen berühren sie nicht. Zu dokumentieren: Die Deploy-Markierung deckt nur Code, verify_jwt und Status ab.
- **N5** Rest aus der Zeit vor dem Fix: `isAlive` prüft nur die Eltern-PID. Ein verwaister CLI-Kindprozess könnte einen gelockerten Deploy nach der Quittung noch abschließen. Nur zur Kenntnis.

## Prüffragen
1. **Falsche Quittung trotz Lockerung?** Für die fünf definierten Lockerungen nein: Sie ändern `_shared/quote/handler.ts`, der Download enthält die Datei, der Vergleich ohne CR schlägt an. Das Entfernen aller CR kann keine Lockerung verdecken. Theoretisch quittiert würde ein anders zusammengesetzter Deploy aus Commit-Dateien (M1). Einstellungen werden derzeit wegen H1 gar nicht positiv erkannt (fail-closed).
2. **Lücken in settingsMatch?** Ja: Form der JSON-Antwort (H1), Einstiegspunkt und Import-Map fehlen (M1), Regex (N1), Secrets nicht abgedeckt (N4).
3. **Fangen die Tests die Fehlerklasse?** Für content_path ja, mit echtem git an HEAD (N3 für den Rest). Die recover-Tests prüfen Quittung ohne Deploy, genau einen Deploy und Fatal mit bleibender Markierung. Nicht geprüft werden die Verknüpfung in restore.mjs:19, eine werfende Vorprüfung (M2) und die echte Form der CLI-Ausgabe (H1).

## Stichproben (selbst nachgeschlagen)
| Datei:Zeile | Ergebnis |
|---|---|
| scripts/redproof-deploy.mjs:12 | templates in PATHS, ok |
| scripts/redproof-deploy.mjs:84 | nur Array angenommen, H1 |
| tmp/proof/r1-quote-info-vorher.txt:1 | Objekt mit Schlüssel `functions`, Felder entrypoint_path und import_map vorhanden |
| scripts/redproof-deploy.mjs:67 | nur supabase/functions durchlaufen, M1 |
| scripts/redproof-lib.mjs:531-532 | Vorprüfung ohne try, Nachprüfung streng, M2 |
| scripts/redproof-restore.mjs:19 | matches und settingsMatch verknüpft, ok |
| supabase/config.toml:421-422 | quote verify_jwt false, Regex trifft |
| supabase/config.toml:431, 435 | content_path auf supabase/templates, durch PATHS gedeckt |
| scripts/redproof-s9a3.mjs:299-303 | Lockerungen nur in handler.ts |
| supabase/functions (alle Importe) | nur relative Pfade innerhalb supabase/functions, keine Import-Map-Datei |
| tests/unit/redproof-lib.test.ts:581-612 | drei Fälle abgedeckt, keine werfende Vorprüfung |

Offene Findings hoch: 1
