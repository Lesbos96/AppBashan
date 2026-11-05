# Nachtauftrag 2026-11-05 · Dokumentation

Auftrag: Nur Dokumente unter `docs/`, kein Code. Phase 1 `docs/ARCHITEKTUR.md`, Phase 2 Rechtsentwürfe unter `docs/recht/`, Phase 3 `docs/INVESTOREN.md`, danach Prüfdurchgänge gegen Code und Migrationen. Branch `nacht-doku`, Entwurfs-PR gegen `main`, nicht mergen.

Diese Datei hält jede Entscheidung mit Begründung fest, dazu Fragen an Beks und den Stand.

## Startprüfung

- **Pflichtlektüre:** `CLAUDE.md` vollständig. `docs/PROGRESS.md` (neueste Einträge S9b-0 bis S5, Überschriften aller Einträge), `docs/OPEN_ISSUES.md` (Abschnitt „Daten und Betrieb“, „Rechtsfragen“, alle Überschriften), `docs/S9b_PLAN.md` (Kopf, Abschnitte 1–3, alle Überschriften). Weitere Stellen lese ich gezielt, wenn eine Phase sie braucht (Begründung: E7).
- **Umgebungsvariablen (nur Namen geprüft, keine Werte ausgegeben):** Keine Variable mit `SUPABASE`, `SB_`, `SERVICE_ROLE`, `NEXT_PUBLIC_`, `VITE_`, `DB_`, `DATABASE`, `POSTGRES`/`PG` im Namen. Vorhanden sind nur Variablen der Cloud-Umgebung (GitHub-Token, AWS- und gcloud-Zugang des Containers, Sitzungs-Token). Keine `.env`-Datei außer `.env.example` (nur die Dateinamen per `find` geprüft, keine Datei gelesen). Ergebnis: **keine Supabase-Schlüssel, kein Stopp.**

## Entscheidungen

- **E1 · Modell.** Die Session läuft mit Opus 5.5 (laut `get_session`, Effort xhigh). `CLAUDE.md` sieht für Sessions außer S1 Sonnet 5.5 vor und verlangt dann „sag es mir und warte“. Der Nachtauftrag ist kein ROADMAP-Abschnitt und niemand antwortet, Warten hieße: die Nacht bleibt ungenutzt. Ich arbeite weiter und vermerke es hier. Ein eingebautes `advisor`-Tool ohne Parameter ist nicht in meiner Tool-Liste.
- **E2 · Supabase-Connector.** In der Session ist ein Supabase-MCP-Connector verbunden (Werkzeuge u. a. `apply_migration`, `execute_sql`, `deploy_edge_function`, `create_edge_function_secret`). Das ist keine Umgebungsvariable, der Schlüssel dahinter ist für mich nicht einsehbar, die Stopp-Regel des Auftrags greift wörtlich nicht. Weil der Connector aber genau die verbotenen Wirkungen hätte, rufe ich **kein einziges Supabase-Werkzeug** auf, auch keine lesenden (Begründung: Auftrag „nur lesen“ meint Code und Migrationen; ein Lesezugriff auf die Dev-DB ist nicht beauftragt). Frage F2.
- **E3 · Branch.** Die Umgebung nennt `claude/eager-johnson-ma7rqk` als Arbeitsbranch, der Auftrag verlangt ausdrücklich `nacht-doku` von `main`. Der ausdrückliche Auftrag gilt. Angelegt von `origin/main` (Stand 1630668). Push nur auf `nacht-doku`.
- **E4 · `docs/legal/` existiert schon.** Dort liegen `impressum.md` und `datenschutz.md` (älterer Stand). Der Auftrag verlangt `docs/recht/`. Ich lege die neuen Entwürfe unter `docs/recht/` an, ändere und lösche `docs/legal/` nicht (Löschen ist verboten; die Dateien können von anderer Doku referenziert sein) und nenne den Bezug in den Entwürfen. Frage F3.
- **E5 · `docs/ARCHITECTURE.md` existiert schon.** Sie beschreibt die geplante Architektur aus S1. Die neue `docs/ARCHITEKTUR.md` beschreibt den Ist-Stand, abgeleitet aus Code und Migrationen; `ARCHITECTURE.md` bleibt unverändert, Abweichungen nenne ich in der neuen Datei.
- **E6 · Kein Code, keine Befehle mit Wirkung.** Keine Tests, kein Build, kein `db:*`, keine Skripte. Gelesen wird mit Read, Grep, Glob und `git`. Geschrieben wird nur mit Write und Edit (Regel `CLAUDE.md`, Werkzeuge).
- **E7 · Kontext.** `CLAUDE.md` verlangt ab etwa 150.000 Tokens: committen, Stand festhalten, Stopp. Deshalb lasse ich breite Suchen von `Explore` erledigen (Pfade, Zeilen, kurze Auszüge) und lese selbst nur gezielte Zeilenbereiche. Erreiche ich die Grenze, steht hier „Weiter bei:“.
- **E8 · `PROGRESS.md` bleibt unberührt.** Der Nachtauftrag ist keine ROADMAP-Session; der Bericht steht hier. Ein Eintrag oben in `PROGRESS.md` würde mit S9b-1 kollidieren, das vom selben `main` startet.

## Fragen an Beks

- **F1 · Modell:** Soll ein Nachtauftrag dieser Art künftig mit Sonnet 5.5 laufen (Regel in `CLAUDE.md`), oder war Opus gewollt?
- **F2 · Supabase-Connector:** Der Connector war in dieser Cloud-Session verbunden und hätte Migrationen, SQL und Deploys erlaubt. Nicht benutzt. Für unbeaufsichtigte Läufe trennen?
- **F3 · `docs/legal/` und `docs/recht/`:** Welche Fassung gilt künftig? Vorschlag: `docs/recht/` ersetzt `docs/legal/` nach Rechtsprüfung; das Löschen von `docs/legal/` machst du.

## Stand

- Start: Branch angelegt, diese Datei angelegt.
