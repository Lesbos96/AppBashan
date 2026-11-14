# Abnahme-Antrag u1b, Kontrollrunde (Kennung u1b-1411-a, Commit „u1b WIP 3“ auf dem Branch u1b)

Runde 1: `tmp/proof/u1b-abnahme-runde1.md` (hoch 0, mittel AM1 bis AM7, niedrig AN1 bis AN13). Behoben in WIP 3:
- AM1: `skriptDatei` arbeitet auf dem Kern (nach `kern()`), liest Wörter mit Anführungszeichen als ein Wort, nimmt nach dem Shell-Namen das erste Wort mit Skript-Endung (`.sh .ps1 .bat .cmd`), bei bash/sh/zsh/dash/ksh/source/`.` auch das erste Wort ohne Option und Endung; `call` wird übersprungen (`.claude/hooks/guard.mjs`).
- AM2: `db query` nur als eigener Befehl (außer hinter Lesebefehlen wie echo/grep/cat); danach Erlaubtform: nur Optionen (Wert nur direkt nach einer Option, nur `[\w.:-]+`) und höchstens ein Argument in Anführungszeichen; Wortprüfung des SQL nur im Segment mit `db query` (statt im ganzen Befehl; Heredoc und `<` sind ohnehin verweigert).
- AM3: Ziel eines Interpreters = erstes Wort mit Skript-Endung (`.mjs .cjs .js .mts .ts`), Anführungszeichen entfernt; Optionen mit Wert werden übersprungen.
- AM4: (a) `uebernehme` verlangt den Dateinamen `loesch-freigabe-<…>.md` am Anfang des Namens (`scripts/sys/gate-loesch.mjs`); (b) `entscheideDatei` löst den Pfad mit `path.resolve` auf und vergleicht kleingeschrieben; (c) `Edit(./docs/freigaben/**)` steht in der deny-Liste (`.claude/settings.json`).
- AM6: `gate-loesch.mjs` lädt vor dem Start des Skripts `../dev-guard.mjs` (nicht bei `--trocken`, nicht bei `uebernehme`).
- AN8 (Name der entfallenen Plan-Datei aus der Skriptdatei-Liste gestrichen), AN9 (Doku berichtigt).
- Nicht behoben, als Fristen in `docs/OPEN_ISSUES.md` u1b-6: AM5 (vor der ersten echten Migration), AM7 (vor der ersten Freigabe eines `.mjs`-Registerskripts), AN1 bis AN7, AN10 bis AN13, Funde M1/M2/N1 bis N8 der Lösch-Freigabe (brauchen eine neue Freigabe von sweep.ts).

## Zu prüfen
Nur die drei geänderten Dateien samt Tests und Doku: `.claude/hooks/guard.mjs` (vollständig neu lesen: Regexe der neuen `skriptDatei`, `woerter`, des `db query`-Blocks, `loeschDirekt`, `entscheideDatei`; Falschalarme bei gewöhnlichen Befehlen; ob das Verschieben der SQL-Wortprüfung ins Segment eine Lücke öffnet), `scripts/sys/gate-loesch.mjs`, `.claude/settings.json`; Tests `tests/unit/sys-guard.test.ts` (neue Blöcke „Skriptdateien mit Optionswerten …“ und „u1b Abnahme AM2/AM3/AM4“) und `tests/unit/sys-gate-loesch.test.ts`; `docs/OPEN_ISSUES.md` Abschnitt u1b-6 und `docs/BEKS_EINRICHTUNG.md` Abschnitt 3. Die übrigen 13 Dateien sind seit Runde 1 byte-gleich (Hashes unten gleich der Runde 1).

SHA256-Zeilen für den Bericht (alle 16 Zeilen müssen in `tmp/proof/u1b-abnahme.md` stehen):

SHA256: b34be34a286791e5c52eae34e42496669d7c1ccb5b8b70bd8bea46cd04b25bb6 .claude/hooks/guard.mjs
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
