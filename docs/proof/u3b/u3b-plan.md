# u3b Plan (R3, Kennung u3b-1511-a)

Fakten (Datei:Zeile)
- Guard git-Block: `.claude/hooks/guard.mjs:300-325` (Wortzerlegung `:305`, Optionsschleife `:308-312`, Leseform `:317-318`, `--no-verify` `:300`). Kern-Hülle `:21-39`, PROGRAMME `:16`.
- Berater-Zählung: `scripts/sys/bericht.mjs:31-33` zählt alle Zeilen von `tmp/proof/agents.jsonl`; geschrieben in `.claude/hooks/session.mjs:39-42` (ohne Schritt).
- DB-Gate: `scripts/sys/gate-db.mjs:75-86` (CLI-Start, Neulesen `liesListe()`, Marken); `scripts/sys/gate-db-lib.mjs:70-79` `marken()`. `fertig.mjs:60-64` verlangt Marke je neuer Migration.
- Register: `scripts/sys/loesch-register.json:30` führt `tests/support/positiv.ts` unter `ausgenommen` (nicht unter `skripte`); Muster `gate-loesch-lib.mjs:13-14` trifft `admin_set_\w+` und `update … set` im SQL-Text.
- `.gitignore`: `*.log` ignoriert `docs/proof/**/*.log`; `fertig.mjs:176-177` prüft, dass bericht.json-Kopien im Commit liegen.

Plan
1. Guard git-Block neu, positionsunabhängig (Entwurf zuerst `tmp/a/guard.mjs`):
   - Wörter: Umleitungen am Rohwort erkennen (Wort beginnt mit `[n|&]>`/`<`; allein stehender Operator nimmt das nächste Wort mit), erst dann entquoten (M5). Escapes `\x` bleiben ein Wort (`A\ B`).
   - `git` kommt in PROGRAMME (Pfad in Anführungszeichen, `git.exe`).
   - `-c`/`--config-env` irgendwo als Wort: folgendes Wort (bzw. `--config-env=`-Rest) `core.hooksPath` (ohne Groß/Klein) → sperren.
   - `config` als irgendein Wort: Schlüssel irgendwo → sperren, außer Leseform = nach Abzug der Flags (`--local --global --system --worktree --show-origin --show-scope --get --get-all -z --null`) genau `[Schlüssel]` oder `['get', Schlüssel]` (M6). Wort `core.…` mit `$`, `\` oder Backtick → sperren. Erste Position (ohne Flags und Flag-Werte `-f/--file/--blob/--default/--type`) `edit|remove-section|rename-section` oder Flag `--edit/-e/--remove-section/--rename-section` → sperren (`git config user.name edit` ist dann erlaubt).
   - `--no-verify` als Wort oder Präfix ab `--no-veri` (M7), zusätzlich die bisherige Prüfung auf dem maskierten Text.
   - Umgebung `GIT_CONFIG_COUNT|KEY_n|VALUE_n|PARAMETERS|GLOBAL|SYSTEM=` im maskierten Segment bei `git` → sperren.
   - Tests: M5, M6, M7, N11-Formen als Negativproben; Gegenproben: `git config --get-regexp …`, `--show-scope`, `-z`, `user.name edit`, `core.hooksPath 2> /dev/null`, `git -C "a b" status`.
2. Berater-Zählung: `session.mjs` stempelt jede agents.jsonl-Zeile mit `schritt` (Branch des Projektordners, sonst null); `bericht.mjs` zählt nur Zeilen mit `schritt === aktueller Schritt`. Test in `sys-session.test.ts` (git-init mit Branch) und ein Test der Zählfunktion (aus bericht.mjs herausgezogen nach `scripts/sys/lib.mjs`: `beraterZaehlung(zeilen, schritt)`).
3. Rot-Beweis `fertig`-Tests: `scripts/sys/fertig.mjs` der Fassung vor u2b (abd95cd) vorübergehend einsetzen, `npm run t -- tests/unit/sys-fertig.test.ts` → erwartet rot (7-Tage, gruen.json-Eintrag, N22, N25 …), dann wiederherstellen → grün. Logs als Nachweis nach `tmp/proof/u3b/`.
4. AM5: `gate-db.mjs` schreibt vor dem CLI-Start `{ ziel:'db-push-start', start, migrationen:[{version,pfad,sha256}] }` in `runs.jsonl`; Neulesen der Liste bis zu 3 Versuche; neuer Modus `nachtrag`: für jede Startmarke ohne Marke (Pfad+SHA) die Liste neu lesen, `marken()` anwenden, Marken schreiben (SHA muss dem der Startmarke entsprechen). Attrappe: `nachtrag --trocken --liste --dir --freigaben`. `package.json`-Skript `db:nachtrag`. `fertig` unverändert (fail closed bleibt). Test in `sys-gate-db.test.ts`.
5. positiv.ts: nicht im Register `skripte`, sondern `ausgenommen` (reine SQL-Texte/Daten, ausgeführt wird in Rollback-Proben). Frage an Fable, ob die Ausnahme bleibt. Ohne Fable-Urteil „herausnehmen“ bleibt sie.
6. OFFEN S9i3-7: Eintrag mit Auftreten-Zähler schließen (u2b, u3 ohne Auftreten); S9i3-6 bleibt.
7. Nachweis-Logs: `.gitignore` bekommt `!docs/proof/**/*.log`; Test (git check-ignore) nach `tests/unit/sys-docs-importe.test.ts`-Art oder `sys-fertig.test.ts`; Unveränderlichkeit bleibt (Guard `entscheideDatei`).

Frage an Fable (eine, gebündelt)
- Trägt der Entwurf für Punkt 1 (Lücken, Falschalarme, was bleibt als dokumentierte Grenze)? Genügen für Punkt 2 der Schritt-Stempel im Hook, für Punkt 4 Startmarke + `nachtrag`? Bleibt `tests/support/positiv.ts` unter `ausgenommen` (Punkt 5)? Ist `!docs/proof/**/*.log` unbedenklich (Punkt 7)?
