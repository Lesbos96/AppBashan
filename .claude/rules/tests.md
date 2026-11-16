---
paths:
  - "tests/**"
  - "scripts/sys/**"
  - "playwright.config.ts"
  - "vite.config.ts"
---
# Tests und Nachweise

- Tests starten nur über `npm run t -- check|e2e|rls|shots|shots:all|build|<testdatei>`. Das Programm schreibt das Log nach `tmp/proof/<schritt>/` (Commit, Sauber-Angabe, Befehl, echtes `EXIT=`, nur neu anlegen) und die Zeile in `runs.jsonl`. Ein Lauf, der anders gestartet wurde, zählt nicht. Der Guard-Hook sperrt `npm run check`, `vitest`, `playwright test` und Ähnliches direkt.
- Im Schritt nur gezielte Läufe (einzelne Testdatei, betroffene Specs). Ein Volllauf je Suite, einmal, am Ende, auf dem committeten Endstand. Volläufe von `rls` dauern 8 bis 14 Minuten: im Hintergrund starten.
- Grün heißt: Lauf mit `EXIT=0`, sauberem Arbeitsbaum (abgesehen von den Nachweisen von `npm run bericht` im Index) und Fingerabdruck des Endstands. Unveränderte Suiten übernimmt das Gate aus `docs/proof/gruen.json`; `rls` bei R3 nur, wenn dieser Lauf höchstens 7 Tage alt ist (sonst Volllauf).
- Nachweis sind Exit-Codes und Dateien, nie eine Zusammenfassung allein. Logs nie ganz lesen, nur nach Fehlern greppen.
- Ein Rot-Beweis zählt nur, wenn die fehlschlagende Prüfung die Wirkung der gelockerten Sperre misst (Ist-Wert: Zeilen sichtbar, Aufruf erfolgreich, Wert geändert), nicht nur, dass ein Schritt fehlschlägt. Bei R3 verlangt das Gate je neuer Datei unter `tests/rls/` einen roten Lauf vor dem ersten grünen, beide aus demselben Schritt und mit genau der Datei des Endstands (SHA-256 `dateiSha` in `runs.jsonl`): ein Rot, das nur durch eine später geänderte Erwartung entstand, zählt nicht. Eine Umbenennung ist eine neue Datei und braucht ihren eigenen roten Lauf unter dem neuen Pfad. Einen roten Lauf ohne Ist-Wert im Log (Absturz der CLI, Netzfehler) zählt die Abnahme nicht.
- Nachweisdateien werden nach dem Schreiben nie verändert. `npm run bericht` kopiert sie nach `docs/proof/<schritt>/` und lässt danach den Secret-Scan über `docs/proof/` laufen (Exit 0 nötig). Meldet er einen Treffer, entsteht kein neues `bericht.json`: nichts committen, kein `npm run fertig`, anhalten und Beks berichten. Keine README in `docs/proof/`; Hinweise zu Nachweisen stehen in der Bewertung.
- Freigaben und Abnahmen schreibt nur der Subagent `advisor-report`; die Hauptsession verändert sie nie.
- Integrationstests gegen Supabase laufen sequenziell und gepaced (Auth-Rate-Limits). Rollback-Proben, wo möglich; committete Testdaten räumt nur der Eigentümer-Weg (`sweep`) über das Lösch-Gate ab.
- Tests prüfen Verhalten, nicht Existenz. Kein `--update-snapshots`.
- Die Gates (`scripts/sys/**`, `.claude/hooks/**`, `.githooks/**`) werden nie abgeschwächt, um einen Lauf grün zu bekommen. Blockiert ein Gate zu Unrecht: anhalten und Beks berichten.
