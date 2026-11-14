# Plan u1 (Kennung u1-1411-a) · Gates und Hooks nach docs/SYSTEM_VORSCHLAG.md (Abschnitte 3 a bis b, 4, 6)

Quelle der Anforderungen: `tmp/proof/u1-umfang.md`. Alles in Node (ESM, `.mjs`), keine neuen Abhängigkeiten. Nichts unter `src/`, keine Migration, kein echtes `db:push`.

## Dateien
| Datei | Inhalt (Kurz) |
|---|---|
| `scripts/sys/lib.mjs` | `git(args)`, `schrittName()` (Branch, `/`→`-`), `sauber()` (porcelain leer; unverfolgte Dateien unter `docs/` zählen nicht), `sha256Datei`, `leseRuns()` (liest ALLE `tmp/proof/*/runs.jsonl`, weil auf `main` der Branchname nicht mehr der Schrittordner ist) |
| `scripts/sys/fingerabdruck.mjs` | `fingerabdruck(suite)` = SHA-256 über `git ls-files -s -- <Pfadspecs>`. check: alles außer `docs/` und `*.md`; rls: `supabase/migrations`, `supabase/functions`, `supabase/seed.sql`, `tests/rls`, `tests/support`, `vite.config.ts`, `package.json`, `package-lock.json`; e2e: `src`, `public`, `index.html`, `tests/e2e`, `playwright.config.ts`, `supabase/functions/_shared`, `package.json`, `package-lock.json` (package.json zusätzlich zum Vorschlag) |
| `scripts/sys/stufe.mjs` | `stufeAus(pfade)` → R0..R3; höchste Stufe aller Pfade, unbekannt = R3. R0 nur `docs/**`/`*.md`; R1 `src/screens|components`, Styles, `tests/e2e`, `tests/shots`; R2 `src/lib` (außer money*), `scripts/**` außer `sys`, `tests/unit` (außer `sys-*`), Build-Dateien; R3 `supabase/**` (alle Functions, da der Pfad Geld/Rechte nicht verrät), `src/lib/money*`, `tests/rls`, `tests/support`, `scripts/sys`, `.claude`, `.githooks`, `tests/unit/sys-*` |
| `scripts/sys/run.mjs` | Aufruf `npm run t -- <ziel> [args]`; Ziele `check`=`npm run check`, `e2e`=`npm run test:e2e`, `rls`=`npm run test:rls`, `shots`, `build`, Testdatei (`tests/unit/*.test.ts`→`npm test -- f`, `tests/rls/*`→`npm run test:rls -- f`, `*.spec.ts`→`npm run test:e2e -- f`), Sonderziel `cmd <prog> <args…>` (ohne Shell, für Proben). Kindprozess über `process.execPath` + `npm_execpath` bzw. direkt, **keine Shell**. Log `tmp/proof/<schritt>/NNN-<ziel>.log`, geöffnet mit Flag `wx` (Nummer zählt hoch, bei EEXIST nächste). Kopf: Kennung-frei, `Commit`, `Arbeitsbaum sauber: ja/nein`, `Befehl:` wörtlich, `Start`. Ende: `Dauer`, `EXIT=<Code des Kindprozesses>`. Hängt Zeile an `runs.jsonl` (`nr, ziel, befehl, hash, sauber, exit, sek, tests, logSha, abdruck`). Ausgabe an Claude: ≤20 Fehlerzeilen + letzte 30 Zeilen + Logpfad + `EXIT=`; endet mit dem Exit-Code des Kindes. `PROOF_ROOT` (Umgebung) nur für Tests |
| `scripts/sys/gate-db-lib.mjs` | rein: `offeneMigrationen(liste, dir)`, `parseFreigabe(text)` (`Modell:` enthält `fable`, `SHA256:` je Datei, `Urteil: frei|gesperrt`, `Offene Findings hoch: N`), `pruefePush(offen, freigaben)` → `{ok, grund[]}` |
| `scripts/sys/gate-db.mjs` | `antrag` → `db-antrag-<n>.json` (`wx`); `push` → prüft jede offene Migration gegen Freigaben in `tmp/proof/<schritt>/db-freigabe-*.md`, Exit 1 bei Mangel. Echter Modus: `dev-guard` zuerst, Liste aus `supabase migration list --linked -o json`. `--trocken --liste <json> --dir <ordner> --freigaben <ordner>`: keine DB, kein Push (Attrappe), nur Prüfung; Ausgabe „würde durchlassen“ bzw. Blockgrund |
| `scripts/sys/stufe`-CLI | `node scripts/sys/stufe.mjs` gibt Stufe gegen `main` aus |
| `scripts/sys/fertig.mjs` | rein `pruefeFertig(ctx)`; CLI sammelt Fakten. Prüft: Baum sauber; Branch ≠ main und `main` ist Vorfahr (ff); je Pflichtsuite der Stufe (R0 keine; R1 check,e2e; R2 und R3 check,e2e,rls) ein Lauf mit EXIT=0, sauber, `abdruck` = aktueller Fingerabdruck, sonst `docs/proof/gruen.json`; R3: Freigabe je neuer Migration, `tmp/proof/<schritt>-abnahme.md` (erste Zeile `Modell:` mit fable, letzte `Offene Findings hoch: 0`), je neuer `tests/rls`-Datei ein roter Lauf (EXIT≠0, Ziel = Dateipfad) mit kleinerer Nummer als der erste grüne; `bericht.json` vorhanden und `stand` = aktueller check-Fingerabdruck; `docs/STAND.md` ≤ 40 Zeilen, falls vorhanden. `--nur-pruefen` nur Prüfung; sonst `checkout main`, `merge --ff-only`, `push`. `--pre-push` liest die Ref-Zeilen von stdin und prüft nur Pushes auf `refs/heads/main` (Stufe aus `remote..local`, lokal muss HEAD sein) |
| `scripts/sys/bericht.mjs` | Kopf nach Abschnitt 5 aus Maschinenquellen → `docs/proof/<schritt>/bericht.json/.md`, kopiert genannte Logs byte-genau (`COPYFILE_EXCL`), lässt vorher `npm run scan:proof` laufen, schreibt `docs/proof/gruen.json` |
| `scripts/sys/start-schritt.mjs` | Ausgangslage: Baum sauber, `git fetch`, `main`=`origin/main`, kein vitest/playwright-Prozess, legt Branch an, gibt Stufe aus (liest `docs/STAND.md` nur falls vorhanden) |
| `.claude/hooks/guard.mjs` | nur verweigern (`permissionDecision: deny`), nie erlauben/umbauen. Regeln s. u. Reine Funktion `entscheide(eingabe)` + stdin-Wrapper |
| `.claude/hooks/session.mjs` | `SessionStart`: Modell (optional!), Quelle, Zeit → `tmp/proof/session.json`, als `additionalContext` zurück; `SubagentStart/Stop`: Zeile an `tmp/proof/agents.jsonl`; `UserPromptSubmit`: beginnt der Prompt mit `/schritt` und das protokollierte Modell enthält nicht den Wert aus `settings.json` `model` (`sonnet`), dann `decision: block`; fehlt das Modell, wird nicht geblockt (Doku: Feld optional) |
| `.githooks/pre-push` | `#!/bin/sh` → `node scripts/sys/fertig.mjs --pre-push` |
| `package.json` | `t`, `db:antrag`, `db:push` (= Gate && alter Befehl && `db:types`), `prepare` (`git config core.hooksPath .githooks`), `bericht`, `fertig`, `start-schritt`; alte Skripte bleiben |
| `.claude/settings.json` | `hooks` (PreToolUse guard, SessionStart/SubagentStart/SubagentStop/UserPromptSubmit session), neue `deny`/`ask` (s. u.) |
| `tests/unit/sys-*.test.ts` + `scripts/sys/*.d.mts` | Selbsttests, laufen in `npm run check` |

## guard.mjs, Regeln (Matcher `Bash|PowerShell|Write|Edit`, Exec-Form, `onFailure: block`)
1. Testbefehle am Start-Programm vorbei: je Kommando-Segment (Trennung an `; && || | Zeilenumbruch`, führendes `&`, `cd x &&` ignoriert) `npm [run] check|test|test:*|shots*`, `npx vitest`, `vitest`, `playwright test`, `dotenv … -- vitest|playwright` → deny mit Ersatzbefehl `npm run t -- <ziel>`. `npm run t` selbst, `npm run build` erlaubt.
2. `supabase db push`, `migration repair`, `db reset` direkt → deny (nur `npm run db:push`). `supabase functions deploy` bleibt **unverändert `ask`** (es gibt kein `fn:deploy`-Skript; Abweichung vom Vorschlag, in OPEN_ISSUES).
3. `supabase db query` mit `insert|update|delete|truncate|drop|alter` (außer Aufruf aus `tests/` oder `scripts/`) → deny.
4. `--no-verify`, `core.hooksPath` im Befehl → deny.
5. Umleitung (`>`, `>>`, `Out-File`, `Set-Content`, `Add-Content`, `tee`) nach `tmp/proof` oder `docs/proof` → deny.
6. Write/Edit auf `*db-freigabe-*` nur mit `agent_type == advisor-report`; Write/Edit auf vorhandene Datei unter `docs/proof/` → deny.
7. `python -` (stdin) → deny (Memory-Regel).

## settings.json (a7)
- neu `deny`: `Agent(general-purpose)`, `Agent(claude)`, `mcp__d7859db5-7e7e-4e6b-a9d5-ae276b32608a`, `Edit(./docs/proof/**)`.
- neu `ask`: `Bash(npm run prod:*)`, `Edit(./scripts/sys/**)`, `Edit(./.githooks/**)`, `Edit(./package.json)`. (Doku: `.claude/` ist geschützter Pfad, im Auto-Modus entscheidet dort aber der Klassifizierer, es fragt nicht; darum zusätzlich `ask` auf `.claude/hooks/**` und `.claude/settings.json`.)
- **Übergang**: bestehende `ask`-Einträge für commit/merge/push/rm/dotenv bleiben, bis die Gates im Alltag belegt sind (Auftrag: keine Lücke). Wegfall wird in docs/BEKS_EINRICHTUNG.md als späterer Schritt beschrieben.

## Testplan
Unit (in `check`): `sys-stufe` (Tabelle + unbekannt = R3), `sys-fingerabdruck` (gleiche Eingabe gleicher Hash, geänderte Datei ändert Hash; docs-Änderung ändert check-Hash nicht), `sys-gate-db` (keine Freigabe → blockiert; anderer SHA → blockiert; `gesperrt` → blockiert; passende → ok), `sys-guard` (je Regel Deny- und Allow-Fälle, per Kindprozess mit stdin-JSON), `sys-run` (roter Befehl → EXIT≠0 im Log und im Prozess-Exit; zweiter Lauf überschreibt nicht; Kopf enthält Hash, Sauber, Befehl), `sys-fertig` (reine Funktion: ohne Lauf blockiert; Lauf mit falschem Fingerabdruck blockiert; R3 ohne Freigabe/Abnahme/Rot blockiert; alles da → ok), `sys-session` (Modell-Mismatch blockt).
Negativproben (Logs über `run.mjs cmd`, Kopien als `u1-probe-<name>-N.log`): Test-Startprogramm (roter Befehl, zweiter Lauf), db-Gate (Attrappe: ohne Freigabe / falscher SHA / passend), Merge-Gate (`fertig --nur-pruefen` ohne grüne Läufe), Hook `trim-output.js` (echter Lauf mit rotem Befehl in Bash und PowerShell).
Volläufe check, e2e, rls auf dem Endstand über `npm run t`.

## Entscheidungen, zu denen ich Ihr Urteil will
1. Übergang: Testumgehungs-Sperre im Guard sofort aktiv (Meldung nennt den Ersatzbefehl), alte `ask`-Regeln bleiben. Richtig, oder Sperre erst ab u2?
2. Lookup aller `tmp/proof/*/runs.jsonl` nach Fingerabdruck statt nur des Branch-Ordners: tragfähig? Fälschbar durch eine handgeschriebene Zeile; Gegenmaßnahme `logSha` gegen die Logdatei.
3. Freigabe-Bindung nur an SHA-256 der Dateibytes im Arbeitsbaum; Modell-Zeile ist Selbstauskunft. Reicht für u1?
4. Fehlt etwas Wesentliches, das ein Schutz-Skript umgehbar macht (z. B. `npm run t -- cmd` als Hintertür, `onFailure: block` bei Guard-Absturz = Aussperrung)?
