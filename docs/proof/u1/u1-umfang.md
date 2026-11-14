# Umfang Schritt 1 (u1) laut docs/SYSTEM_VORSCHLAG.md, Kennung u1-1411-a

Hinweis: Der Auftrag nennt „Abschnitt 6“ als Umstellungsplan. Abschnitt 6 enthält die Tabelle mit Modell/Effort; der Inhalt von u1 steht in Abschnitt 3 j. Beide Stellen wörtlich:

## Abschnitt 6, Zeile 489 (Modell, Effort, Fable)
| u1 Gates und Hooks | Sonnet 5.5 | hoch | wie R3, weil die Gates künftig Geld und Rechte schützen | 1 Session | Abnahme `gate-db.mjs`, `guard.mjs`, `fertig.mjs` (1 Aufruf) |

Zeile 495: „Reihenfolge fest: u0 → u1 → u2 → u3 → Probe. u1 läuft noch nach den alten Regeln mit einem kurzen Prompt, der auf dieses Dokument verweist. Ab u2 gilt `/schritt`.“

## Abschnitt 3 j, Zeile 305 und 306
| **u0** | Beks, 15 Minuten | `~/.claude/settings.json`: `env.CLAUDE_CODE_DISABLE_ADVISOR_TOOL`, `defaultMode: auto`; `/advisor off`; eine Zeile in `trim-output.js`; `/usage` notieren | `/advisor` ist nicht mehr verfügbar; Modus-Wähler zeigt Auto |
| **u1** | Session | `scripts/sys/*`, `.claude/hooks/*`, `.githooks/pre-push`, npm-Skripte, `settings.json` (a1 bis a7). Jedes Gate mit Selbsttest: Es muss nachweislich sperren (Hash geändert, EXIT gefälscht, Log vorhanden). Die alten npm-Skripte bleiben. | `check` grün; je Gate ein Rot-Beweis mit Ist-Wert; Fable-Abnahme von `gate-db` und `guard` |

Zeile 312: „u1 ändert Einstellungen und Hooks; das erlaubst du im Prompt von u1 ausdrücklich.“ (Der Prompt u1-1411-a erlaubt Änderungen nur im Repo, Außerhalb nur als Anleitung.)

## Bestandteile (a1 bis a7, Abschnitt 3 a und Abschnitt 4)
- a1 Test-Start-Programm `scripts/sys/run.mjs` (+ `fingerabdruck.mjs`)
- a2 Datenbank-Gate `scripts/sys/gate-db.mjs` (`db:antrag`, `db:push` über das Gate)
- a3 Bericht `scripts/sys/bericht.mjs`
- a4 Merge-Gate `scripts/sys/fertig.mjs` + `.githooks/pre-push` (+ `stufe.mjs`)
- a5 Wächter-Hook `.claude/hooks/guard.mjs`
- a6 Sitzungsprotokoll `.claude/hooks/session.mjs`
- a7 feste Berechtigungen in `.claude/settings.json`
- Abschnitt 4 nennt zusätzlich `scripts/sys/start-schritt.mjs`, `tests/unit/sys-*.test.ts`, npm-Skripte. NICHT in u1 (laut Vorschlag u2): Skill `/schritt`, `.claude/rules/*`, `docs/STAND.md`, `BEKS.md`, `OFFEN.md`, Archiv, Löschen von `test-runner`. NICHT u3/u4: Positivzeilen-Register, Laufzeiten.
- Ausdrücklich nicht im Repo änderbar (Auftrag Abschnitt 7): u0 (Benutzer-Einstellungen, `trim-output.js`) → Anleitung in docs/BEKS_EINRICHTUNG.md.
