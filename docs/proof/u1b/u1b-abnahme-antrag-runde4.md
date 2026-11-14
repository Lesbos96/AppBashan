# Abnahme-Antrag u1b, Kontrollrunde 4 (Kennung u1b-1411-a, Commit „u1b WIP 5“ auf dem Branch u1b)

Runde 3: `tmp/proof/u1b-abnahme-runde3.md` (hoch 0; mittel AM9; niedrig AN22 bis AN28). Geändert seit Runde 3 ist nur `.claude/hooks/guard.mjs` (dazu `tests/unit/sys-guard.test.ts`, Doku). Die übrigen 15 Dateien der Liste sind byte-gleich zur Runde 3.

Behoben in `guard.mjs` (nach deinem Fix-Vorschlag):
- AM9/AN22/AN23: Ein Abtaster `abtasten()` läuft über den ganzen Befehl vor der Segmentierung (Modi top, dq, sub): beachtet Backslash, einfache und doppelte Anführungszeichen mit Schachtelung, `$(…)` mit Klammerzählung, Backtick-Paare; jede Ersetzung (auch geschachtelte) wird rekursiv als eigener Befehl geprüft; eine nicht geschlossene Ersetzung reicht bis zum Ende. Heredoc-Körper mit zitiertem Endwort bei `cat` werden vor allem anderen entfernt (`ohneHeredoc`), die alte Muster-Ausnahme `cat <<` entfällt. `kern` entfernt eine führende Zuweisung `NAME=Wert` (Wort, `"…"`, `'…'`, `$(…)`, Backtick; auch mit export/local/declare/readonly/typeset) mit derselben Abtastung (`zuweisung`), bei `FOO=$(pwd) npm run check` bleibt der Befehl dahinter.
- AN25: Wörter mit führendem Bindestrich sind nie das Ziel eines Interpreters; die Werte von `--import`, `-r`, `--require`, `--loader`, `--experimental-loader` (mit Leerzeichen und mit `=`) werden ebenfalls gegen das Register geprüft.
- Nicht behoben, in OPEN_ISSUES u1b-6: AN24, AN26, AN27, AN28 und der Rest aus Runde 1 und 2 (AM5, AM7, AN1 bis AN7, AN10 bis AN13).

## Zu prüfen
`.claude/hooks/guard.mjs` vollständig neu lesen; besonders `abtasten`, `ohneHeredoc`, `zuweisung`, `kern`, den Anfang von `entscheideBefehl` (Ersetzungen vor der Segmentierung, `befehl` = Text ohne Heredoc-Körper), `loeschDirekt`. Prüfe Umgehungen und Falschalarme im Kopf, vor allem: Commit-Nachrichten (`git commit -m "…"` mit und ohne Heredoc, mit Klammern, Backticks, `$(`), `$((…))`, `grep "\$(…)"`, PowerShell-Skriptblöcke `{ … }` und `$_`, Befehle mit Anführungszeichen in Anführungszeichen. Tests: `tests/unit/sys-guard.test.ts` (neuer Block „u1b Abnahme Runde 3 …“). Läufe: `tmp/proof/u1b/runs.jsonl` (e2e Nr. 32 und rls Nr. 33 auf WIP 3, beide EXIT=0; ein check auf dem Endstand folgt nach dieser Runde).

SHA256-Zeilen für den Bericht (alle 16 Zeilen müssen in `tmp/proof/u1b-abnahme.md` stehen):

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
