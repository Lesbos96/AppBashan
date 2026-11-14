# Abnahme-Antrag u1b, Kontrollrunde 3 (Kennung u1b-1411-a, Commit „u1b WIP 4“ auf dem Branch u1b)

Runde 2: `tmp/proof/u1b-abnahme-runde2.md` (hoch 0; mittel AM8; niedrig AN14 bis AN21). Geändert seit Runde 2 ist nur `.claude/hooks/guard.mjs` (und `tests/unit/sys-guard.test.ts`, Doku). Die übrigen 15 Dateien der Liste sind byte-gleich zur Runde 2.

Behoben in `guard.mjs`:
- AM8: `kern` entfernt eine Zuweisung vor einer Befehlsersetzung (`x=$(…)`, auch mit export/local/declare/readonly/typeset); zusätzlich prüft `ersetzungen()` jede Befehlsersetzung `$(…)` und `` `…` `` (außerhalb einfacher Anführungszeichen, auch in doppelten) rekursiv als eigenen Befehl; ein Heredoc (`cat <<`) bleibt Text (Commit-Nachrichten). Für `db query` zählt die umschließende Ersetzung selbst nicht als „Ersetzung im Argument“.
- AN14: `npm` und `node` stehen nicht mehr in der Lesebefehl-Liste hinter `db query`; `kern` erkennt `node [Optionen] …/supabase.js`.
- AN15: Umleitungen der Ausgabe (`2>&1`, `> datei`, `>> datei`) gehören nicht zu den Argumenten von `db query`.
- AN16: Fallback für bash/sh/source: erstes Wort ohne Bindestrich (nicht mehr: ohne Schrägstrich).
- AN17: (a) `kern` liest Programmpfade in Anführungszeichen mit Leerzeichen; (b) `innentext` liefert drei Lesarten (außen entquotet, unverändert, alles entquotet), alle werden geprüft.
- AN18: Optionswerte von `-r`, `--require`, `--import`, `--loader`, `--experimental-loader`, `--env-file`, `-C`, `--conditions` zählen nicht als Skriptziel.
- AN19: jede Kurzoption mit f (`-ftmp/x.sql`) und `--file` am maskierten Segment verweigert.
- AN20 (Befehlsebene): Ziel = Wort nach `-Destination`/`-LiteralPath`, sonst letztes Wort, aufgelöst/kleingeschrieben; `ren`, `rename-item`, `git mv` zählen als Schreibbefehl; Berater-Namen auch ohne Verzeichnis im Ziel (nach `cd`).
- AN21: Tests ergänzt (Gegenproben der Skriptformen mit harmlosen Dateien, absolute Pfade ohne Endung, Pfade mit Leerzeichen in Hüllen).
- Nicht behoben, in OPEN_ISSUES u1b-6 mit Fristen: AM5, AM7, AN1 bis AN7, AN10 bis AN13, Rest von AN4 und AN5 und AN20 (Windows-Sonderformen), die Funde der Lösch-Freigabe.

## Zu prüfen
`.claude/hooks/guard.mjs` vollständig neu lesen; besonders: `kern`, `ersetzungen` (Falschalarme bei Commit-Nachrichten mit `$(`; Heredoc), `innentext` mit drei Lesarten, der `db query`-Block, die Schreibregel am Ende; `tests/unit/sys-guard.test.ts` (neuer Block „u1b Abnahme Runde 2: Befehlsersetzung, Umleitungen, Skriptpfade“). Läufe: `tmp/proof/u1b/runs.jsonl` (e2e Nr. 32 und rls Nr. 33 auf WIP 3, beide EXIT=0, sauber, stabil; ein check auf dem Endstand folgt nach dieser Runde).

SHA256-Zeilen für den Bericht (alle 16 Zeilen müssen in `tmp/proof/u1b-abnahme.md` stehen):

SHA256: 4c5fca52e183db559e64ddd5c330d80a8966fc1fcb7752f12c4ea70f44590823 .claude/hooks/guard.mjs
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
