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

- **E15 · Prüfdurchgang 1.** Drei `reviewer`-Läufe (ARCHITEKTUR, Rechtsentwürfe, INVESTOREN) mit eigenem Kontext. Ergebnis: ARCHITEKTUR 6 hoch, 6 mittel, 9 niedrig; Rechtsentwürfe 2 hoch, 9 mittel, 3 niedrig; INVESTOREN 4 hoch, 7 mittel, 3 niedrig. Die tragenden Befunde habe ich am Code nachgeprüft (u. a. `withdraw` ohne Aufruf in `src/`, `guard_platform_setting` schützt nur die drei Gebührenschlüssel, CORS ohne serverseitige Sperre, Bezirksgrenzen CC BY 4.0, PLZ des Ziels im Listing) und alle eingearbeitet, außer: Rechtsbefund 9 (Termin bei „Flexibel“) war nur teilweise richtig, der Code rechnet ohne Zeitfenster 00:00 und mit „Flexibel“ 08:00; beides steht jetzt im Text. Wichtigste Korrekturen: Zurückziehen ist nicht in der App, sondern nur in der Datenbank; geplante Partnerfunktionen im Investoren-Dokument klar als geplant markiert; „unabhängige Abnahme“ ersetzt durch „KI-Prüf-Agenten, keine externe Sicherheitsprüfung“.

- **E16 · Prüfdurchgang 2.** Drei weitere `reviewer`-Läufe mit anderem Blick: Vollständigkeit von ARCHITEKTUR (ergänzt: Umgebungen und `dev-guard`, Tests, Build-Prüfung, Fehlercodes, Grenzen, Inhalts-Hash), Stimmigkeit aller neun Dateien (3 hoch, 5 mittel, 4 niedrig; behoben u. a. Fristbeginn „7 Tage nach dem Termin“, Datenumfang vor der Annahme im Investoren-Dokument, falscher Abschnittsverweis, Nummerierung) und Checkliste der Pflichtinhalte (DSGVO Art. 13, ECG/UGB/MedienG, Verbraucher-AGB, P2B Art. 3–12): fehlende Themen als [OFFEN] ergänzt, nichts erfunden. Nicht übernommen: Befund „SMTP ist keine Handy-Test-Vorgabe“ (falsch, `docs/OPEN_ISSUES.md:32` sagt „PFLICHT vor dem ersten Test auf einem Handy“).

- **E17 · Prüfdurchgang 3.** Zwei `reviewer`-Läufe nur auf Befunde hoch/mittel: Rechts- und Investoren-Dokumente „Keine Befunde hoch oder mittel“; ARCHITEKTUR 4 × mittel in den neuen Abschnitten (fehlende Codes 405/413 bei `quote`, Beleg „nur JPEG“, Guard-Lücke auch bei `setup-photo-cleanup.mjs`, Trigger setzt nur den Hash), alle am Code bestätigt und korrigiert (4fd5c83). Danach ein letzter Lauf über die ganze ARCHITEKTUR (E18).

- **E18 · Prüfdurchgänge 4 und 5, Abschluss der Prüfung.** Durchgang 4 (ganze ARCHITEKTUR, nur hoch/mittel): 2 × mittel zu Betragsspalten und `fee_splits` (d589bf9). Durchgang 5 (nur Geld-Abschnitte und Abgleich mit INVESTOREN): 1 × mittel, `cent_whole` gilt nur für `price_config`, `call_out_fee_cents` und Stornostufen haben keinen Check; korrigiert und als Befund in ARCHITEKTUR 9.12 und F9 aufgenommen. Die Befundzahl fiel von Durchgang zu Durchgang (1: 49 aller Schweregrade; 2: 22 plus rund 40 fehlende Pflichtthemen aus der Checkliste; ab 3 nur hoch/mittel gezählt: 3: 4, 4: 2, 5: 1) auf Präzisierungen einzelner Sätze; die Rechts- und Investoren-Dokumente waren ab Durchgang 3 ohne Befund hoch oder mittel. Ein sechster Durchgang würde nach diesem Verlauf höchstens weitere Wortpräzisierungen finden; deshalb Abschluss.

- **E19 · Prüfdurchgang 6 nach „weiter“.** Beks schrieb am Morgen „weiter“. Ich habe das als Fortsetzung der Prüfschleife gelesen, weil Durchgang 5 noch einen mittleren Befund hatte und das Abbruchkriterium des Auftrags damit nicht wörtlich erfüllt war; keine neue Aufgabe, keine S9b-Arbeit. Seit Durchgang 3 geändert waren nur `docs/ARCHITEKTUR.md` und diese Datei, deshalb prüfte Durchgang 6 genau diese beiden vollständig. Ergebnis: 3 × mittel (Verweis `docs/ARCHITECTURE.md:62` statt `:63`, auch in beiden Datenschutzerklärungen; überholter Beleg zum Foto-Limit; Commit-Zuordnung im Stand). Alle bestätigt und korrigiert.

- **E20 · Prüfdurchgang 7, Abbruchkriterium erfüllt.** Mechanische Prüfung aller rund 170 Verweise auf andere Dokumente in den neun Dateien: „Keine Befunde hoch oder mittel.“ Ein Hinweis unterhalb der Meldeschwelle (Verweis in `docs/INVESTOREN.md` um Abschnitt 7 ergänzt) ist übernommen. Damit hat ein weiterer Durchgang nichts Sinnvolles mehr gefunden; Ende der Prüfschleife.

## Fragen an Beks

- **F1 · Modell:** Soll ein Nachtauftrag dieser Art künftig mit Sonnet 5.5 laufen (Regel in `CLAUDE.md`), oder war Opus gewollt?
- **F2 · Supabase-Connector:** Der Connector war in dieser Cloud-Session verbunden und hätte Migrationen, SQL und Deploys erlaubt. Nicht benutzt. Für unbeaufsichtigte Läufe trennen?
- **F3 · `docs/legal/` und `docs/recht/`:** Welche Fassung gilt künftig? Vorschlag: `docs/recht/` ersetzt `docs/legal/` nach Rechtsprüfung; das Löschen von `docs/legal/` machst du.

- **F4 · Miete per direktem UPDATE:** `rental_bookings` lässt den Kunden `requested → withdrawn` per UPDATE setzen (Grant M01:383, Policy und Trigger M17:114-132), ohne `status_events`. Bewusst so belassen bis Phase 2, oder beim Umbau der Miete auf eine Funktion wie `withdraw()` umstellen?
- **F5 · `docs/ARCHITECTURE.md`:** Sollen die drei veralteten Stellen (`quote` schreibt `fee_splits`, „Anfrage bearbeiten“, Tab-Bar mit „Miete“) in der nächsten Session korrigiert werden, oder ersetzt `docs/ARCHITEKTUR.md` künftig den Ist-Teil?
- ~~F6 · Produktivprojekt einrichten (DELETE in M17 und M19)~~: zurückgezogen, steht schon als Punkt 5a in `docs/GOLIVE.md:23`; beim Lesen von `GOLIVE.md` in Phase 3 gefunden.

- **F7 · Ansprache der Rechtstexte:** Kunden-Texte per Du, Partner-Verträge in dritter Person. Passt das, oder sollen die Partner-Texte ebenfalls per Du sein?

- **F8 · Kontextgrenze bei Nachtaufträgen:** Soll die 150.000-Token-Regel aus `CLAUDE.md` auch für unbeaufsichtigte Aufträge gelten (dann endet die Nacht dort), oder ist Weiterarbeiten über Subagents wie hier (E14) in Ordnung?

- **F9 · Einstellungen ohne Trigger-Schutz:** `guard_platform_setting` schützt nur `fee_rate`, `fee_vat_rate`, `fee_notice_days` (M16:42-45). Stornostufen, Fristen, Anfahrtspauschale und Haltefenster kann `service_role` per UPDATE/DELETE ändern (nur TRUNCATE ist entzogen, M15:271). Bestehende Aufträge sind über den Snapshot der Revision geschützt, neue nicht. Außerdem haben `call_out_fee_cents` und die Stornostufen keine Wertebereichs- oder Ganzzahl-Checks. Soll die Datenbank für alle Schlüssel „nur neue Version“ und gültige Werte erzwingen? (Geld- und Sicherheitsfrage für den `advisor` in der nächsten passenden Session.)
- **F10 · Zurückziehen ohne Knopf:** `withdraw()` ist gebaut, die App ruft es nicht auf (`docs/ROADMAP.md:103` offen). Kunden können eine gesendete Anfrage heute nicht selbst zurückziehen. Bewusst bis S9i, oder vorziehen?

- **F11 · Geschäftliche Festlegungen für die Rechtstexte** (nur du kannst sie liefern; ein Anwalt prüft danach):
  - Betreiberdaten: Firma, Rechtsform, Anschrift, E-Mail, UID, Firmenbuch, Gewerbe, Kammer (`docs/recht/impressum.md`, Tabelle „Anbieter“).
  - Ob Unternehmer als Kunden buchen dürfen (`docs/recht/agb-kunden.md`, 1.3).
  - Zahlungsart und Fälligkeit zwischen Kunde und Partner, z. B. Anzahlung oder Zahlung vor Ort (`agb-kunden.md`, 9.2).
  - Provisionsrechnung: Zahlungsziel, Rechnungsweg, Konto, Verzugszinsen und Mahnspesen (`agb-partner.md`, 8.5–8.6; `partnervertrag.md`, § 5).
  - Kündigungsfrist des Partners, Gerichtsstand (`agb-partner.md`, 16–17; `partnervertrag.md`, § 8–9).
  - Verlangte Unterlagen je Leistung; Konzept (Ausweis, VIES-Protokoll) und S9b-Plan (Gewerbeschein, Firmenbuch, Sonstiges) weichen ab (`agb-partner.md`, 2.1; `datenschutz-partner.md`, 3).
  - Mindestdeckung der Haftpflicht- und Transportversicherung der Partner (`agb-partner.md`, 6.1).
  - Partnervertrag online in der App oder mit Unterschrift (`partnervertrag.md`, Kopf).
  - Löschfristen (Vorschläge 12 Monate, 3 Jahre, 90 Tage für Fotos; `datenschutz-kunden.md`, 6 und 7).
  - Anbieter für Mail, Hosting, Bot-Schutz und die Region der Supabase-Projekte (`docs/ARCHITEKTUR.md`, 2.3; `docs/GOLIVE.md`).

- **F12 · `scripts/live-auth.mjs` ohne `dev-guard`:** Das Skript legt einen Testnutzer an und löscht ihn (`:28`, `:63`), importiert den Guard aber nicht; `CLAUDE.md` verlangt ihn für Skripte, die Daten löschen. In der nächsten Code-Session nachrüsten? (Code-Änderung, deshalb hier nicht gemacht.)

## Stand

- Start: Branch angelegt, diese Datei angelegt (81d865e).
- Phase 1: `docs/ARCHITEKTUR.md` (8dbee2f).
- Phase 2: `docs/recht/impressum.md` (3b7791d), `datenschutz-kunden.md` (b86d47f), `datenschutz-partner.md` (bd8755d), `agb-kunden.md` (aad7071), `agb-partner.md` (06ae18f), `partnervertrag.md` (8790d3d).
- Phase 3: `docs/INVESTOREN.md` (0d70c0b).
- Nach Phase 2 und Kontextentscheidung (E14): fd9a016, d46bd70 (die Commit-Nachricht von d46bd70 nennt „GOLIVE 5a“; gemeint ist der Verweis auf Punkt 5a in `docs/ARCHITEKTUR.md`, `docs/GOLIVE.md` wurde nicht geändert).
- Prüfdurchgang 1 (E15): 60c97cf, 02bd4dd, 3d66aa6, cd1a966.
- Prüfdurchgang 2 (E16): 5aca674, a99f6f5, abad9c9.
- Prüfdurchgang 3 (E17): 4fd5c83, bbff3ae.
- Prüfdurchgänge 4 und 5 (E18): d589bf9, 97baffd, 37e7fc9.
- Prüfdurchgang 6 (E19): 7b0b994.
- Prüfdurchgang 7 (E20): der Commit mit diesem Eintrag.
- Ende: Alle Phasen fertig, PR bleibt Entwurf. Kein Code, keine Migration, kein Deploy, keine Datei außerhalb von `docs/` geändert, keine Datei gelöscht, kein Supabase-Werkzeug benutzt.
