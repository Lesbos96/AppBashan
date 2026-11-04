# Nacht 04./05.11.2026 · Aufgabe „Audit“ (nur lesen)

Branch `nacht-audit` (von `main` 1630668), Draft-PR gegen `main`. Ergebnis: `docs/AUDIT_NACHT.md`. Geändert werden nur diese beiden Dateien.

## Start

- **Gelesen:** `CLAUDE.md`, `docs/PROGRESS.md` (Kopf, letzte Sessions), `docs/OPEN_ISSUES.md` (ganz), `docs/S9b_PLAN.md` (Kopf und Ist-Stand, nur zum Verständnis; S9b wird nicht bearbeitet).
- **Umgebungsvariablen (nur Namen geprüft, `env | cut -d= -f1`):** keine Supabase-Schlüssel (kein `SERVICE_ROLE`, `SECRET_KEY`, DB-Passwort, `SUPABASE_ACCESS_TOKEN`, `NEXT_PUBLIC_SUPABASE_*`). Vorhanden sind nur Variablen der Cloud-Umgebung (GitHub-, AWS-, gcloud-Token des Containers). Im Repo liegt nur `.env.example`, kein `.env.local`. → kein STOPP.
- **Hinweis für Beks:** In der Werkzeugliste dieser Session steht ein Supabase-MCP-Connector (`mcp__Supabase__*`: `execute_sql`, `apply_migration`, `deploy_edge_function` u. a.). Das ist keine Umgebungsvariable, gibt aber Datenbankzugriff. Ich habe ihn in dieser Nacht nicht geladen und nicht benutzt. Frage 1 unten.

## Entscheidungen

| Nr. | Entscheidung | Begründung |
|---|---|---|
| E1 | Der Auftrag enthält drei Aufgaben (Audit, Testabdeckung, OPEN_ISSUES). Ich bearbeite alle drei nacheinander, je mit eigenem Branch (`nacht-audit`, `nacht-testabdeckung`, `nacht-open-issues`), eigenem Draft-PR und eigener Nachtdatei. | Drei `AUFGABE`-Blöcke, „Branch nacht-<aufgabe>“ und „docs/nacht/<aufgabe>.md“ sind je Aufgabe formuliert. Getrennte Branches verhindern, dass die Nur-Lesen-Regel des Audits oder „Bestehender Code bleibt unverändert“ der Testaufgabe mit den Code-Änderungen der OPEN_ISSUES-Aufgabe kollidiert. |
| E2 | Reihenfolge: Audit zuerst. | Das Audit ändert nichts und liefert Funde, die die beiden anderen Aufgaben nutzen (Testlücken, erledigte OPEN_ISSUES). |
| E3 | Modell: Die Session läuft mit Opus 5.5, `CLAUDE.md` sieht Sonnet 5.5 vor. Ich arbeite trotzdem weiter. | „Niemand beantwortet Rückfragen. Entscheide selbst.“ Die Session wurde so gestartet; ein Warten bis morgen hätte die Nacht ungenutzt gelassen. Ein eingebautes `advisor`-Tool ohne Parameter steht nicht in meiner Werkzeugliste. |
| E4 | Kontextgrenze 150.000 Tokens: Ich stoppe dort nicht, sondern committe nach jedem Teilziel und halte den Stand in dieser Datei fest; der Kontext wird automatisch zusammengefasst. | Der Nachtauftrag verlangt ausdrücklich Weiterarbeit bis kein Durchgang mehr etwas findet und Push nach jedem Teilziel „falls die Session endet“. `PROGRESS.md` ändere ich nicht (Audit: nur zwei Dateien erlaubt). |
| E5 | Das Audit prüft den Stand von `main` (1630668). Die lesenden Subagents arbeiten auf einer abgekoppelten Arbeitskopie von `main` (`git worktree add --detach`, außerhalb des Repos), damit spätere Änderungen der anderen Aufgaben das Audit nicht verfälschen. | Ein Audit braucht einen festen Stand. |
| E6 | Funde der Subagents prüfe ich vor der Übernahme selbst an der genannten Datei und Zeile. Nicht bestätigte Funde kommen nicht in den Bericht oder stehen als „nicht bestätigt“ dort. | Subagents liefern Fehler im selben Ton wie Treffer. |

## Fragen an Beks

1. Soll der Supabase-MCP-Connector in Nachtsessions überhaupt in der Werkzeugliste stehen? Er gibt Schreibzugriff auf Datenbank und Functions, unabhängig von Umgebungsvariablen. Die Prüfung in Schritt 2 des Nachtauftrags erfasst ihn nicht.

## Verlauf

(wird je Phase ergänzt)
