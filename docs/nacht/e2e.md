# Nachtauftrag E2E · 2026-11-05/06

Unbeaufsichtigt. Jede Entscheidung steht hier mit Begründung. Fragen an Beks am Ende unter „Fragen an Beks".

## Start

### S-1 Gelesen
CLAUDE.md, `docs/PROGRESS.md`, `docs/OPEN_ISSUES.md`, `docs/S9b_PLAN.md` (Kopf, nur zum Verständnis). S9b wird nicht bearbeitet.

### S-2 Prüfung Umgebungsvariablen (nur Namen, keine Werte)
- Ergebnis: **keine Supabase-Schlüssel.** Kein `SUPABASE_*`, kein `SERVICE_ROLE`, kein DB-Passwort, kein Supabase-Access-Token. Vorhanden sind nur Variablen der Cloud-Umgebung (GitHub-Token, `CLOUDSDK_AUTH_ACCESS_TOKEN` der Google-Cloud-CLI, AWS-Variablen des Containers, Playwright-Pfade).
- Dateien: im Repo nur `.env.example` (nicht gelesen), keine `.env.local`. Kein `~/.supabase`, kein `supabase/.temp` (kein CLI-Login, kein Projekt-Link).
- Entscheidung: weiterarbeiten, weil die Bedingung für STOPP nicht erfüllt ist.
- Hinweis: Die Session hat einen **Supabase-Connector (MCP)** in der Werkzeugliste (Migrationen, SQL, Deploy). Keine Umgebungsvariable, aber ein Zugang. Entscheidung: nie laden, nie aufrufen (Frage F-1).

### S-3 Zwei Nachtaufträge in derselben Session
- Vorher kam der Auftrag „Design" (Branch `nacht-design`, Draft-PR bekhanidrisov74-hub/movenow#5). Er ist **pausiert** (Begründung in `docs/nacht/design.md` auf dem Branch `nacht-design`): beide Aufträge im selben Arbeitsverzeichnis würden sich die Testläufe verfälschen. Der neuere Auftrag (dieser) hat Vorrang. Ist er fertig und bleibt Zeit, setze ich Design fort.

### S-4 Branch und PR
- Branch `nacht-e2e` von `main` (16306687). Die Umgebung nennt als Arbeitsbranch `claude/charming-einstein-xalm6m`; der Auftrag verlangt ausdrücklich `nacht-e2e`. Entscheidung: `nacht-e2e`.
- Draft-PR gegen `main`, nach jedem Teilziel aktualisiert, nie gemergt.

### S-5 Abweichungen von CLAUDE.md, bewusst
- **Modell:** Die Session läuft mit Opus 5.5; CLAUDE.md sieht Sonnet 5.5 vor und sagt „sag es mir und warte". Warten geht heute Nacht nicht. Entscheidung: weiterarbeiten, hier vermerkt.
- **Kein eingebautes `advisor`-Tool** in der Werkzeugliste.
- **Sessionende:** CLAUDE.md: „ein Commit beendet die Session", „ab etwa 150.000 Tokens stoppen". Der Nachtauftrag verlangt Commit und Push nach jedem Teilziel und Weiterarbeit bis zum Ende. Entscheidung: Nachtauftrag gilt. Jeder Commit ist gepusht, damit bei einem Abbruch nichts verloren geht.
- **ROADMAP/PROGRESS:** kein ROADMAP-Abschnitt; nichts abgehakt. Stand hier, am Ende eine kurze Zeile in `docs/PROGRESS.md`.
- **`npm ci`:** `node_modules` fehlte. `npm ci` installiert exakt nach `package-lock.json` und ändert weder `package.json` noch das Lockfile. Kein Hinzufügen oder Aktualisieren. Playwright ist schon als devDependency vorhanden (`@playwright/test` 1.64.1), die Ausnahme im Auftrag wird nicht gebraucht.
- **Testläufe** gehen wie in CLAUDE.md über den Agent `test-runner`, nicht im Hauptkontext.

## Ausgangslage (Lauf vor jeder Änderung, `tmp/proof/nacht-base-*.log`)
- `npm run check`: EXIT=0.
- `npm run test:e2e` mit Dummy-URL: EXIT=1, 102 von 102 rot, alle mit `browserType.launch: Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1248/...`. Ursache: In diesem Container liegt Chromium 1243, `@playwright/test` 1.64.1 erwartet 1248. Kein Fehler im Code. Lösung siehe Phase 2 (Browserpfad über Umgebungsvariable).

## Phasen

(wird fortgeschrieben)

## Fragen an Beks

- **F-1:** Die Cloud-Session hat einen Supabase-Connector (MCP) mit Schreibrechten (Migrationen, SQL, Deploy). Soll er für Nachtläufe abgeschaltet werden? Ich habe ihn nicht benutzt.
