# Abnahme-Antrag u1 (Kennung u1-1411-a)

Geprüft wird der Stand nach Commit fd44b61 plus der Entwurf der Berechtigungen. Dein Bericht muss diese Zeilen unverändert enthalten (je geprüfter Datei eine, `fertig` vergleicht den Hash mit dem späteren Stand; die Hashes stammen aus `sha256sum`, du kannst sie nicht selbst berechnen):

SHA256: e8a8b88687166534bc49421c5b160182e4338fd041e31cda55f2cc405ef5073f .claude/hooks/guard.mjs
SHA256: c2bbaa60e25c674821d13005d70f24d74f36f83fe1b273c0af8d58469d3e16f1 .claude/hooks/session.mjs
SHA256: 8a843c484c140d6bcad8bdb5935c6d19971f9e36a8c6aeebf0c7ef7b61b5a8c1 scripts/sys/run.mjs
SHA256: e96107c05338ba981636aa6d3651beecdb1962912542569b735dfe4aaec4ac2b scripts/sys/lib.mjs
SHA256: caa2aefb45edb787a5ea3f2feb10322d83481c319059e57b95d9b112d71c1640 scripts/sys/fingerabdruck.mjs
SHA256: 1244266484ea4fc8e816cd5c29daef3ed7e8d7718551cf936eafbb982195f640 scripts/sys/stufe.mjs
SHA256: b6226579020b2209d69729311f48adee8af91563af0dac2ca5457bf74e7316fe scripts/sys/gate-db-lib.mjs
SHA256: 989276cd56dc21baad7de9563a42989c1d279f7c033a9b04e62643252cf9db34 scripts/sys/gate-db.mjs
SHA256: af5785be45a475e29c6fe50659f4c3c56d5c8edbec3f34a7c97475f5f7d33c95 scripts/sys/fertig.mjs
SHA256: 38555f57d8c0532e731e915f7b3a2d3c4fe075f9d62dbce4b0c391e84149c10f scripts/sys/bericht.mjs
SHA256: 72d715cef4c01610e0975a50a36aa079f35aeaff5dd4d04a34c4fdf3a9b1d47f scripts/sys/start-schritt.mjs
SHA256: 4bd54346d3cd50b6670cf2ee0a4e4e38301ee4656b4ca6978c303abcb4fbed79 .githooks/pre-push
SHA256: d29055f69c5966db6b33a76903db7d32e6df9241638ac4f0ee27b39f9d881921 package.json
SHA256: 88ef95815c26aa91f5f796d688978a8bf8902e158725ad72728afedcff688aad .claude/settings.json

Hinweis: Der Inhalt von `.claude/settings.json` steht noch nicht an seinem Ort; lies den Entwurf `tmp/proof/u1-settings-entwurf.json` (byte-identisch zu dem Hash oben, wird nach deiner Abnahme unverändert nach `.claude/settings.json` geschrieben). Die heutige Datei `.claude/settings.json` ist die Vorgängerversion.

## Zu prüfen
Dateien siehe oben, dazu `tests/unit/sys-*.test.ts` (Selbsttests), `scripts/sys/fixtures/`, `CLAUDE.md` (Abschnitt „Arbeitssystem“), `.claude/agents/test-runner.md`.
Maßstab: `tmp/proof/u1-fable-plan.md` (deine Auflagen 1 bis 10 aus der Planprüfung), `docs/SYSTEM_VORSCHLAG.md` Abschnitte 3 a, 3 b, 4, 7, und `tmp/proof/u1-plan.md`.

## Prüffragen
1. Auflagen 1 bis 10: je Auflage umgesetzt / nicht umgesetzt mit `Datei:Zeile`.
2. Wie lässt sich jede der drei Schranken noch umgehen (Test-Startprogramm und Läufe in `runs.jsonl`; Datenbank-Gate; Merge-Gate samt pre-push)? Nur Umgehungen, die in der üblichen Arbeitsweise einer Session plausibel sind oder ein fehlerhaftes „grün“ erzeugen.
3. Kann `fertig`/`pre-push` fälschlich grün melden (Fingerabdrücke, Stufenberechnung, `gruen.json` aus origin/main, Schritt-Ermittlung nach dem Merge, Abnahme-Bindung an Hashes, rls nach db-push)? Kann es zu Unrecht blockieren und die Arbeit stoppen?
4. `guard.mjs`: Fehlalarme gegen normale Befehle, Lücken gegen die Regeln im Plan, Verhalten bei Absturz.
5. `.claude/settings.json` (Entwurf): Syntax der Regeln gegen die Doku (code.claude.com/docs/en/permissions und /hooks), `Agent(...)`-, `mcp__`-, `Edit(...)`-Regeln, Hook-Felder (`args`, `onFailure`), Wirkung der `ask`-Regeln.
6. Sind die in `gate-db`/`fertig` erkannten Fehlerfälle fail-closed?

## Bericht
Schreibe ausschließlich `tmp/proof/u1-abnahme.md`. Erste Zeile `Modell: <deine ID>`; danach die 14 SHA256-Zeilen oben unverändert; Findings nach Schwere (hoch, mittel, niedrig) mit `Datei:Zeile – Problem – Fix`; Antworten auf die Prüffragen; Stichproben. Die Phrase der Schlusszeile darf nur einmal vorkommen, nämlich als letzte Zeile: `Offene Findings hoch: N`. Schreibe sie in Findings und Fließtext nie am Zeilenanfang. Das eingebaute advisor-Tool nutzt du nicht, du startest keine Subagents. Antwort an die Hauptsession: Pfad und `Offene Findings hoch: N`, sonst nichts.
