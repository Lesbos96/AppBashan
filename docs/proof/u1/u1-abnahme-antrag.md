# Abnahme-Antrag u1, Kontrollrunde 2 (Kennung u1-1411-a)

Geprüft wird der Stand nach Commit 18a841a plus der Entwurf der Berechtigungen. Dein Bericht von Runde 1 liegt unverändert als `tmp/proof/u1-abnahme-runde1.md`; du schreibst den neuen Bericht nach `tmp/proof/u1-abnahme.md` (überschreibt die Datei der Runde 1, die gesichert ist). Dein Bericht muss diese Zeilen unverändert enthalten (je geprüfter Datei eine; die Hashes stammen aus `sha256sum`, du kannst sie nicht selbst berechnen; `fertig` vergleicht sie später mit dem Stand und verlangt für jede geänderte Datei der Mindestmenge eine Zeile):

SHA256: e134f0e25c4aa2d6973e3125b38711f7e491740257a8b025febd4736dcbf3d72 .claude/hooks/guard.mjs
SHA256: c2bbaa60e25c674821d13005d70f24d74f36f83fe1b273c0af8d58469d3e16f1 .claude/hooks/session.mjs
SHA256: 36121739caa69343214a2a0fe7d0ca0f0bdcae55076a1fb9b6de9170196dcdae scripts/sys/run.mjs
SHA256: e96107c05338ba981636aa6d3651beecdb1962912542569b735dfe4aaec4ac2b scripts/sys/lib.mjs
SHA256: a237eab9f2cd551dafcef95aaa684bd9554ad0fa0a3021ce7ee9bd347fc8e151 scripts/sys/fingerabdruck.mjs
SHA256: 4eeefe7a8db994d69300c234c16a4a20bbb1ce4656cdc6f3e7a0cf6d751d750d scripts/sys/stufe.mjs
SHA256: 4d30ae158f24d310ba9ad7a399004380d603808c52bb330649f5074f1eb21c84 scripts/sys/gate-db-lib.mjs
SHA256: 58eba48c4f95f7f13c7e57738f5cee30d83eff002a48bc77ea4b15dea71427c9 scripts/sys/gate-db.mjs
SHA256: a4844cbc23365ebae28b8c0ff56c29d7fb117459f441b0075b14a15c1b542981 scripts/sys/fertig.mjs
SHA256: 1a5df45bb268133c495fb9b3d947d37028799baac1ca948c1c9bbe8d6d40d4b8 scripts/sys/bericht.mjs
SHA256: 5f9db17ce9332a9a7141951f5a88ddf1c89cd763fd938c57669b69e1c7da2c31 scripts/sys/start-schritt.mjs
SHA256: 4bd54346d3cd50b6670cf2ee0a4e4e38301ee4656b4ca6978c303abcb4fbed79 .githooks/pre-push
SHA256: 4cce80aa92a8483336c0a1c2ea99bd27dbb48dc29629144eddc2b7bbc8a3523d package.json
SHA256: 9ecca69d24529e143728428985334437c7f375e2c90ae9fa3eac3ee3969108a7 .claude/settings.json

Hinweis: `.claude/settings.json` steht noch nicht an seinem Ort; lies den Entwurf `tmp/proof/u1-settings-entwurf.json` (byte-identisch zu dem Hash oben; er wird nach deiner Abnahme unverändert nach `.claude/settings.json` geschrieben). Die heutige Datei dort ist die Vorgängerversion.

## Was seit Runde 1 geändert wurde (Zuordnung zu deinen Findings, zum Nachprüfen)
- H1: `gate-db-lib.mjs` (Eintragsform, Gegenprobe Dateien ↔ Liste), neue Tests in `tests/unit/sys-gate-db.test.ts`.
- H2: `guard.mjs` (Regel für `db query` im ganzen Befehl, Wortliste erweitert, `--file/-f`, Schalter vor dem Unterbefehl, `migration up|down|squash`), Tests in `sys-guard.test.ts`.
- M1: `gate-db.mjs` (Modus `marke`, `db-push-geplant.json`), `package.json` (`db:push` = Gate, Push, Marke, Typen), `fertig.mjs` (je neuer/geänderter Migration eine Marke mit Pfad).
- M2: `fertig.mjs` (`AM`). M3: `MUSS_ABNAHME` und `abnahmeFehlt` in `fertig.mjs`. M4: `bericht.mjs` (R3-Prüfungen an), `fertig.mjs` (`berichtGate`). M5: `bericht.mjs` (Scan vor dem Schreiben). M6/M7: Bericht aus dem Commit (`git show HEAD:`), `schrittAusBericht(von, …)` verlangt genau einen neuen/geänderten Bericht im Push. M8: `DOCS_IMPORTE` in `fingerabdruck.mjs`, Regel in `stufe.mjs`, Selbsttest `tests/unit/sys-docs-importe.test.ts`. M9, M13: Entwurf (PowerShell-Spiegel, `Edit(./CLAUDE.md)` in ask), `stufe.mjs` (CLAUDE.md und package.json = R3). M10: `docs/BEKS_EINRICHTUNG.md` Schritt 5. M11: feste Liste für `cmd` in `run.mjs`. M12: `guard.mjs`. M14: echter Lauf gegen Dev (nur lesend): `gate-db.mjs` nutzt `--output-format json` (`-o json` liefert eine Tabelle), `npm run db:antrag` lief mit Exit 0, Ergebnis `[]` (0 offene), danach `push` und `marke` ohne offene Migrationen: Exit 0. M15: `stufe.mjs`.
- Niedrig: N1 bis N4, N6 bis N10, N12, N13, N15 umgesetzt. Nicht umgesetzt, bewusst: N5 (Schreibweisen am Guard vorbei zählen nur wertlose Läufe), N11 (die versuchte `.gitignore`-Ausnahme hätte 100+ alte, absichtlich unversionierte Logs sichtbar gemacht und wurde zurückgenommen; der Bericht-Schritt nutzt `git add -f`, wie frühere Sessions), N14 (u2), N16, N17, N18 (als offen in `docs/OPEN_ISSUES.md` nachzutragen).
- M13 (CLAUDE.md): Der Abschnitt „Arbeitssystem“ ist ausdrücklich vom Auftrag der Session verlangt (Auftrag u1-1411-a, Punkt 3 a: „CLAUDE.md: Ganz oben ein kurzer Abschnitt ‚Arbeitssystem‘ …, ÜBERGANGSREGEL …“). Das widerspricht deiner Planauflage 10; der Auftrag von Beks geht vor. Der Text enthält jetzt die Klarstellung zu „Exit-Code per echo ins Log“.

## Zu prüfen
1. Sind H1, H2 und M1 bis M15 behoben, ohne neue Lücken? Besonders prüfen: `guard.mjs` neu (Maskierung, Segmentierung, Lesen von `core.hooksPath`), `fertig.mjs` neu (Marken, Mindestmenge, Berichtsermittlung im Push, Lesen aus `HEAD`), `gate-db.mjs` (drei Modi).
2. Ist der Entwurf der Berechtigungen jetzt vollständig (PowerShell-Spiegel)? Syntax gegen die Doku wie in Runde 1.
3. Regressionen: Kann `fertig`/pre-push zu Unrecht blockieren (z. B. Bericht im Commit fehlt, Marke fehlt bei Migrationen ohne Push)? Ist der Ablauf „Volläufe → `npm run bericht` → Docs-Commit (`git add -f` für Logs) → `npm run fertig`“ in sich schlüssig (Bericht wird aus `HEAD` gelesen; docs-Commit ändert den check-Fingerabdruck nicht)?
4. Eigene Findings in Runde 2 bitte nur, wenn sie ein fälschliches „grün“, eine echte Umgehung der drei Schranken oder ein dauerhaftes Blockieren betreffen; sonst niedrig.

## Bericht
Schreibe ausschließlich `tmp/proof/u1-abnahme.md`. Erste Zeile `Modell: <deine ID>`; danach die 14 SHA256-Zeilen oben unverändert; danach Findings nach Schwere mit `Datei:Zeile – Problem – Fix`, Antworten auf 1 bis 4, Stichproben. Die Phrase der Schlusszeile darf nur einmal vorkommen, als letzte Zeile: `Offene Findings hoch: N`; schreibe sie in Findings und Fließtext nie am Zeilenanfang. Das eingebaute advisor-Tool nutzt du nicht, du startest keine Subagents, du liest keine `.claude/settings.local.json`. Antwort an die Hauptsession: Pfad und `Offene Findings hoch: N`, sonst nichts.
