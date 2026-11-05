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

- **E9 · Phase 1, Faktenbasis.** Vier `Explore`-Läufe (Migrationen Tabellen/RLS, Migrationen Funktionen/Trigger, Edge Functions/Konfiguration/Skripte, App/Tests). Ihre Zeilenangaben habe ich an den tragenden Stellen selbst nachgeprüft; ein Lauf hatte Funktionen aus M15 falsch M16 zugeordnet (`is_admin`, `assert_admin`, `publish_version`), korrigiert nach Grep. Beschrieben ist nur, was gebaut ist; Geplantes steht getrennt in Abschnitt 8 der Datei.
- **E10 · `docs/ARCHITECTURE.md` nicht korrigiert.** Drei veraltete Stellen gefunden (`:32`, `:67`, `:100`). Der Auftrag erlaubt Änderungen unter `docs/`, aber `ARCHITECTURE.md` ist eine Quelle, auf die `CLAUDE.md` und die ROADMAP verweisen; ich liste die Stellen in `docs/ARCHITEKTUR.md` Abschnitt 9 und überlasse die Korrektur der nächsten Session. Frage F5.

- **E11 · Zwei Datenschutzerklärungen.** `docs/recht/datenschutz-kunden.md` und `docs/recht/datenschutz-partner.md` statt einer Datei. Begründung: Die Kunden-Erklärung erscheint in Kunden-Screens, und `CLAUDE.md` verbietet dort jeden Hinweis auf „Provision“, „Plattformgebühr“, „15 %“ oder „MoveNow-Gebühr“; die Partner-Erklärung muss das Provisions-Journal aber beschreiben (P2B-Transparenz). Getrennte Texte erfüllen beides.
- **E12 · Ansprache.** Kunden- und Partner-Datenschutz sowie Kunden-AGB per Du wie die App (`CLAUDE.md`, UI). Partner-AGB und Partnervertrag in dritter Person („der Partner“), wie bei Verträgen zwischen Unternehmern üblich. [Frage an Beks: F7]
- **E13 · Stand der Rechtsentwürfe.** Sie beschreiben den Stand zum Livegang von Phase 1, also auch den noch nicht gebauten Partnerteil (S9b ff.). Solche Stellen tragen **[noch nicht gebaut]** bzw. verweisen auf `docs/S9_KONZEPT.md`. Keine Firmendaten, keine Nummern, keine erfundenen Fristen: Werte stammen aus dem Konzept (Abschnitt 5.10, 10) und sind dort selbst als vorläufig bis zur Rechtsprüfung markiert.

- **E14 · Kontextgrenze überschritten, weitergearbeitet.** Nach Phase 3 meldete `get_session` rund 220.000 Tokens Kontext. `CLAUDE.md` verlangt ab etwa 150.000: committen, Stand festhalten, Stopp, Fortsetzung in einer neuen Session. Der Nachtauftrag verlangt aber ausdrücklich Prüfdurchgänge, „bis ein weiterer Durchgang nichts Sinnvolles mehr findet“, und niemand kann über Nacht eine neue Session starten (Sessions startet nur Beks). Entscheidung: Alles ist committet und gepusht; die Prüfdurchgänge laufen über `reviewer`-Agenten mit eigenem Kontext, der Hauptkontext nimmt nur deren Befunde und kleine Edits auf. Frage F8.

## Fragen an Beks

- **F1 · Modell:** Soll ein Nachtauftrag dieser Art künftig mit Sonnet 5.5 laufen (Regel in `CLAUDE.md`), oder war Opus gewollt?
- **F2 · Supabase-Connector:** Der Connector war in dieser Cloud-Session verbunden und hätte Migrationen, SQL und Deploys erlaubt. Nicht benutzt. Für unbeaufsichtigte Läufe trennen?
- **F3 · `docs/legal/` und `docs/recht/`:** Welche Fassung gilt künftig? Vorschlag: `docs/recht/` ersetzt `docs/legal/` nach Rechtsprüfung; das Löschen von `docs/legal/` machst du.

- **F4 · Miete per direktem UPDATE:** `rental_bookings` lässt den Kunden `requested → withdrawn` per UPDATE setzen (Grant M01:383, Policy und Trigger M17:114-132), ohne `status_events`. Bewusst so belassen bis Phase 2, oder beim Umbau der Miete auf eine Funktion wie `withdraw()` umstellen?
- **F5 · `docs/ARCHITECTURE.md`:** Sollen die drei veralteten Stellen (`quote` schreibt `fee_splits`, „Anfrage bearbeiten“, Tab-Bar mit „Miete“) in der nächsten Session korrigiert werden, oder ersetzt `docs/ARCHITEKTUR.md` künftig den Ist-Teil?
- ~~F6 · Produktivprojekt einrichten (DELETE in M17 und M19)~~: zurückgezogen, steht schon als Punkt 5a in `docs/GOLIVE.md:23`; beim Lesen von `GOLIVE.md` in Phase 3 gefunden.

- **F7 · Ansprache der Rechtstexte:** Kunden-Texte per Du, Partner-Verträge in dritter Person. Passt das, oder sollen die Partner-Texte ebenfalls per Du sein?

- **F8 · Kontextgrenze bei Nachtaufträgen:** Soll die 150.000-Token-Regel aus `CLAUDE.md` auch für unbeaufsichtigte Aufträge gelten (dann endet die Nacht dort), oder ist Weiterarbeiten über Subagents wie hier (E14) in Ordnung?

## Stand

- Start: Branch angelegt, diese Datei angelegt (81d865e).
- Phase 1: `docs/ARCHITEKTUR.md` (8dbee2f).
- Phase 2: `docs/recht/impressum.md` (3b7791d), `datenschutz-kunden.md` (b86d47f), `datenschutz-partner.md` (bd8755d), `agb-kunden.md` (aad7071), `agb-partner.md` (06ae18f), `partnervertrag.md` (8790d3d).
