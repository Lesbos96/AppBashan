# Abnahme-Antrag u1b (Kennung u1b-1411-a), Stand Commit u1b (zwei WIP-Commits auf 85251f9)

Auftrag: M16 (Marke bindet Inhalt), M17 (Guard: Pipe), M18 (Guard: verschachtelte Shells), Lösch-Gate. Plan und deine Planprüfung: `tmp/proof/u1b-plan.md`, `tmp/proof/u1b-fable-plan.md` (H1 bis H5, M1 bis M10). Lösch-Freigabe 1: `tmp/proof/u1b/loesch-freigabe-1.md` (frei, hoch 0), übernommen als `docs/freigaben/u1b-loesch-freigabe-1.md`.

## Umgang mit deinen Funden der Planprüfung
- H1: `tests/support/marker.ts` angelegt (FIRM_MAIL_RE, COVER_FIRM), im Register an `sweep.ts` gebunden (`scripts/sys/loesch-register.json`), Unit-Test prüft die Importe von sweep.ts und die Bindung je Registerskript; `admin` per UUID geprüft, Obergrenze 1000 im DO-Block.
- H2: SQL-Wortliste erweitert (do, merge, execute, perform, into, set, reset, lock, refresh, vacuum, comment, prepare) und Funktionsaufrufe (`admin_*(`, `set_config(`, `setval(`, pg_terminate/cancel, dblink, lo_, cron., net.). Nur-Lese-Rolle: OPEN_ISSUES u1b-3, nicht gebaut.
- H3: Freigaben zählen nur aus HEAD (`freigabenAusGit`), `docs/freigaben/` ist R3 (`stufe.mjs`) und in `MUSS_ABNAHME`, `fertig` blockiert M und D in diesem Ordner. Eine deny-Regel `Edit(./docs/freigaben/**)` habe ich NICHT in settings.json gesetzt: der Guard verweigert dort jedes Schreiben (Write/Edit immer, Bash außer Lesebefehlen); geschrieben wird nur durch `npm run loesch -- uebernehme` (kopiert den Bericht aus tmp/proof, prüft Register, Hash, Modell, Urteil), weil `cp` in docs/ per `Edit(./docs/proof/**)`-Regel ohnehin vom Werkzeug verweigert wird.
- H4: Guard liest Skriptdateien (`bash x.sh`, `./x.sh`, `. x.sh`, `source`, `pwsh -File x.ps1`, `cmd /c x.bat`) und prüft den Inhalt rekursiv; nicht lesbar heißt verweigert.
- H5: Register-Scan nach Mustern einschließlich `dev-guard`-Import und `method: 'POST'` (findet admin-call.mjs); `tests/support/` in MUSS_ABNAHME; Massen-Lint für `tests/rls` NICHT gebaut (OPEN_ISSUES u1b-2, Reichweite ehrlich benannt).
- M1/Frage 4: `gate-db push` startet die CLI selbst, liest danach die Liste neu und schreibt je angewendeter Migration `{pfad, sha256}`; `marke` und `db-push-geplant.json` entfallen.
- M2: Gate-Optionen nur vor dem Skriptpfad, `run.mjs cmd` erlaubt gate-loesch nur mit `--trocken` an erster Stelle, `--register/--freigaben` nur mit `--trocken`.
- M3: `pruefePush` prüft alle Freigaben zu Pfad und SHA.
- M4: `| node` (bare), `node -p`, `deno eval`, `tsx -e`, einzelnes `&`, Präfixe (Klammern, then, do, else, exec, env, nohup, sudo, `$(`), Programmpfade (`node_modules/.bin/vitest`, `npm.cmd`, `run-script`) behandelt.
- M5: Sperrliste erweitert (storage rm/cp/mv, functions delete, secrets unset, backups restore, branches delete/pause, projects delete, `--db-url`); Erlaubtliste: OPEN_ISSUES u1b-3, nicht gebaut.
- M6 umgesetzt (loeschFreigabe vor dem try). M7: Matcher `mcp__.*` in settings.json, Guard verweigert MCP-Werkzeuge mit Namen execute_sql, apply_migration, reset_branch, restore_project, delete_branch, merge_branch, deploy_edge_function; `npm run loesch` in der ask-Liste. M8: umgekehrte Regel für docs/freigaben (Pfad nur in Anführungszeichen zählt bei schreibenden Programmen und Umleitungen). M9: `-EncodedCommand` flach verweigert, Innentext grob entquotet, Programm am Basisnamen (`bash.exe`, `cmd.exe`). M10: Register/package.json nicht lesbar → nur `node`/`npm run`-Aufrufe verweigert.
- Zu den Findings M1, M2, N1 bis N8 deiner Lösch-Freigabe: `sweep.ts` bleibt unverändert (die Freigabe gilt für den heutigen Hash; Änderung braucht eine neue Freigabe); M3 (owner.ts mit Hash unter `ausgenommen`) umgesetzt; der Rest als nächster Anlass vermerkt.
- Bekannte Abweichungen: Beim Lösch-Gate melden die Registerskripte noch keine `LOESCH-ZAHL`-Zeilen; CLAUDE.md unverändert (u2).

## Zu prüfen
Gegen den Auftrag und diese Liste: Logik und Umgehungswege in `.claude/hooks/guard.mjs` (Reihenfolge der Prüfungen, Regexe, Rekursion, Falschalarme bei gewöhnlichen Befehlen wie `git commit -m "…"`, `grep`, `npm run t -- …`), `scripts/sys/gate-db.mjs` und `gate-db-lib.mjs` (Marken, Teil-Push, TOCTOU), `fertig.mjs`/`stufe.mjs`/`bericht.mjs`, das Lösch-Gate (`gate-loesch.mjs`, `gate-loesch-lib.mjs`, Register), `.claude/settings.json` und `package.json`. Lies auch die Tests `tests/unit/sys-guard.test.ts`, `sys-gate-loesch.test.ts`, `sys-gate-db.test.ts`, `sys-fertig.test.ts` und die Proben-Logs unter `tmp/proof/u1b/` (cmd-Läufe 010 bis 027, Aufräum-Test 008, Sperr-Probe 009) auf Lücken.

Die SHA256-Zeilen für den Bericht (genau diese Dateien müssen in `tmp/proof/u1b-abnahme.md` mit je einer Zeile `SHA256: <hash> <pfad>` stehen; Hashes unverändert übernehmen, sofern du die Dateien für unverändert hältst):

SHA256: 09cb1f6d1f0f23653ebe17d066d80ac80a79b17ccb11e505810500a9715d1cb0 .claude/hooks/guard.mjs
SHA256: 184fce2c9db557e91ba2277bc92c6969eea0d6d40ea4353bdcbbd7e8454796c9 .claude/settings.json
SHA256: cc0130840e3f8232cb663d5a4769ec92e3b63f7ae6fbc609c33c5b5f1d51e8d4 package.json
SHA256: e269ef6c0e78d6255fa807cf3fba089e15f5b256eb368ad6584c7ae1896e74e7 scripts/sys/bericht.mjs
SHA256: 965267c7bede78f9ce3cefc1fb1c1b08cb02e754b77f63828811941e697fac1a scripts/sys/fertig.mjs
SHA256: c31bbd98cd877415272d7456f055e65194f6734f7890f6f2a09267ddd42bf3a4 scripts/sys/gate-db-lib.mjs
SHA256: 1b9d505e1992f9b47098e7afbb66df4cc3ea32fe8feb17ebbb428770aeb26d57 scripts/sys/gate-db.mjs
SHA256: bc7b55baccaac7ce73b60523a2f9ff5f03d5440620ed0f4344553bd9b710b829 scripts/sys/gate-loesch-lib.mjs
SHA256: 18fabc6a77b259a5f7733a343a95ea65ae70f42d318212c55008e254007748db scripts/sys/gate-loesch.mjs
SHA256: 42c0f033a187dbe2e3ab5fa65937b0cf27803ba5fc7bf2ef3877963bfe5cbe67 scripts/sys/run.mjs
SHA256: 1196d6af08a43d2df103934481dc616593d2f0a350ecd98022e2d8e213d7290f scripts/sys/stufe.mjs
SHA256: c3419930544f147d6d4e5fd13d2eb4d40e53ea4b4a4ffe58f9356ed6a81de3b5 scripts/sys/loesch-register.json
SHA256: 1f72a00bbc085ae8af2ac4b7b609b6686e00b7b141ba0f20aee9733b98a6593a tests/support/marker.ts
SHA256: 2556324e61c9c36758e5388b706c18d13c2ff4604ceca02a30ac572058de51f6 tests/support/partner.ts
SHA256: d63d73f7133fffada101e1be34e5f7d30a7ba9ab54867595f849c8180ca8dfee tests/support/sweep.ts
SHA256: 42c84e359b2240e4f68bd9feed84326212363d36ba71afea14a671f0ebc93490 docs/freigaben/u1b-loesch-freigabe-1.md
