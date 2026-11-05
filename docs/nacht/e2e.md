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

### Phase 1 · Nutzerwege und Abdeckung (Stand vor dieser Nacht)

Quellen: `src/app/router.tsx`, `tests/e2e/*.spec.ts` (101 Tests in 8 Dateien), `tests/shots/shots.spec.ts`.

**Befund 1 (wichtig): Die bisherige Suite ist nicht vollständig gemockt.** Tarife (`current_price_version`, `price_config`) und Bedingungen (`rpc/booking_terms`) kommen aus dem echten Dev-Projekt: Viele Tests mocken sie gar nicht (z. B. `konfigurator.spec.ts` „Umzug-Beispiel 689,61 €", `shell.spec.ts` „Info-Sheet zeigt Tarife aus der Datenbank"), und `anonymousPrices` (`tests/e2e/anfrage-helpers.ts:68`) reicht sie per `route.continue()` ausdrücklich ans Netz durch. Ohne `.env.local` startet die App gar nicht (`supabaseUrl is required`). Jeder andere ungemockte Aufruf ginge ebenfalls ans Dev-Projekt.

**Befund 2:** Ohne Supabase-Mock-Schicht scheitert in diesem Container jeder Test schon am Browserstart (Chromium 1243 vorhanden, Playwright 1.64.1 erwartet 1248). Kein Fehler im Code.

| Nr. | Nutzerweg | Schritte | Abdeckung vorher | Lücke |
|---|---|---|---|---|
| W1 | Erster Start | Onboarding 3 Seiten oder Überspringen → Start | `shell.spec.ts` | – |
| W2 | Kunde bucht **Umzug** | Start → Karte → Konfigurator (Team, Dauer, Montage, Kartons, Halteverbot, Abholung/Ziel mit Einwilligung) → Preis-Sheet → Weiter → Termin (Strecke, Kalender) → Zusammenfassung (Kontakt, Einwilligung) → Anmelden und senden → Code → Senden → Gesendet → Aufträge | nur Konfigurator und Preis (`konfigurator.spec.ts`) | **Termin, Zusammenfassung, Senden, Gesendet nie getestet**; Abbruch (Zurück behält Angaben), Fehler 503 |
| W3 | Kunde bucht **Möbeltransport** | wie W2, plus Transportgut (Klavier → persönliches Angebot) | Konfigurator bis `/transport/termin` | **Senden nie getestet**, weder mit Preis noch als Angebot; Abbruch der Anmeldung |
| W4 | Kunde bucht **Entrümpelung** | Wizard 6 Schritte → Ergebnis (Spanne) → Ort & Wunschtermin (Adresssuche, Zeitfenster) → Zusammenfassung → Senden | gut (`dienste.spec.ts`, `fotos.spec.ts` inkl. Senden mit Fotos) | Besichtigung (Gewerbe) bis zum Senden |
| W5 | Kunde bucht **Montage** | Standard oder Küche → Termin → Zusammenfassung → Senden | sehr gut (`anfrage.spec.ts`, 30 Tests: 400, 401, 409, 422, 429, 500, offline, Kontowechsel …) | – |
| W6 | **Transportermiete** | Start-Karte „Transporter mieten" oder Tab „Miete" → Platzhalter „noch nicht verfügbar" | nur Tab (`shell.spec.ts`) | Weg über die Start-Karte, kein Backend-Aufruf. Miete selbst ist laut CLAUDE.md Phase 2 und nicht gebaut |
| W7 | **Partner / Vermieter** | Profil → „Für Vermieter" → Platzhalter | keine | Platzhalter-Test. Partner-Portal ist nicht gebaut (S9b ff., Freigabe nötig); nichts weiter testbar (Frage F-2) |
| W8 | Anmelden, Abmelden | Code-Weg, Link-Weg, Fehler | sehr gut (`anmelden.spec.ts`) | – |
| W9 | Aufträge | Liste, leer, Filter | Liste und leer | **Ladefehler mit „Erneut versuchen"** |
| W10 | Profil, Info-Sheet, Datenschutz, Impressum | – | `shell.spec.ts` | – |
| F | Fehlerfälle quer | unbekannte Seite, offline, Routenfehler, `quote`-Fehler, Auth-Fehler, Foto-Fehler | gut | Tarife nicht ladbar im Konfigurator |

Entscheidung: Phase 3 schließt die fett markierten Lücken in einer neuen Datei `tests/e2e/wege.spec.ts` (je Weg Erfolg, dann Abbruch, dann Fehler). Bestehende Tests bleiben inhaltlich unverändert; sie bekommen nur die Mock-Schicht (Phase 2).

### Phase 2 · Mock-Schicht (`tests/e2e/backend.ts`)

Aufbau, jeweils mit Begründung:
- **Fixture auf Kontext-Ebene** (`test` mit automatischer Fixture `backend`), nicht auf Seiten-Ebene: gilt auch für weitere Tabs (`context.newPage()` in `anfrage.spec.ts`, Magic-Link-Test), und `page.unrouteAll()` in `anmelden.spec.ts` entfernt sie nicht. Seiten-Routen der Tests gehen vor, `route.fallback()` reicht an die Schicht weiter.
- **Unterste Schicht: Sperre.** Jeder Aufruf an einen Host außer der App selbst, den kein Mock beantwortet, wird mit `blockedbyclient` abgebrochen und gemeldet; am Testende prüft die Fixture, dass die Liste leer ist. So kann auch ein wiederverwendeter Dev-Server (`reuseExistingServer: true`, z. B. Beks' `npm run dev` mit echter `.env.local`) nichts erreichen: alle Muster sind hostunabhängig (`**/rest/v1/…`).
- **Standardantworten** nur für öffentliche Lesezugriffe: `current_price_version`, `price_config` (28 Zeilen), `rpc/booking_terms` (fünf Werte plus Hash), dazu eine leere Auftragsliste. Die Werte liest der Test **direkt aus `supabase/seed.sql`** (dieselbe Regex wie `scripts/s9a1-verify.mjs`), damit es keine zweite Kopie der Tarife gibt. Ändert sich das Seed-Format, bricht der Testlauf laut ab (Anzahl 28 geprüft). Der `termsHash` ist ein SHA-256 über die fünf Werte im Format des Servers, nicht der echte Server-Hash (der Mock von `quote` prüft ihn nicht).
- **Nicht** in der Schicht: Auth, `route`, `quote`, Storage. Die Tests mocken sie wie bisher selbst (`mockAuth`, `mockRoute`, `mockQuote`, `mockPhotos`), weil sie Aufrufe zählen und Fehler gezielt einspielen. Fehlt ein Mock, greift die Sperre.
- **`anonymousPrices`** (`anfrage-helpers.ts`) reicht jetzt per `fallback()` an die Schicht statt per `continue()` ans Netz.
- **`playwright.config.ts`:** `webServer.env` setzt `NEXT_PUBLIC_SUPABASE_URL=https://e2e.supabase.invalid` und einen Platzhalter-Key (`.invalid` löst nie auf, RFC 2606); Umgebungsvariablen gehen in Vite vor `.env.local`. Ohne `.env.local` startete die App vorher gar nicht. `PW_CHROMIUM_PATH` (nur wenn gesetzt) nimmt ein vorinstalliertes Chromium; in diesem Container nötig, auf Beks' Rechner ohne Wirkung.
- **Shots** (`tests/shots/shots.spec.ts`) nutzen dieselbe Fixture: Screenshots brauchen damit ebenfalls kein Supabase mehr.
- Ein Testtitel geändert: `shell.spec.ts` „Info-Sheet zeigt Tarife aus der Datenbank" → „… (Mock aus seed.sql)", weil der alte Titel nicht mehr stimmt. Erwartungen unverändert.
- Selbsttest `tests/e2e/backend.spec.ts`: Sperre greift auch für einen echten `*.supabase.co`-Host (Ist-Wert: Aufruf abgebrochen und gemeldet), Tarife kommen mit 200 aus der Schicht. Rot-Beweis der Fixture nur mit `E2E_REDPROOF=1` (sonst übersprungen): ein ungemockter Aufruf ohne Aufräumen muss den Test scheitern lassen. Weil der Auftrag das Löschen von Dateien verbietet, liegt der Rot-Beweis als übersprungener Test in der Datei statt als Wegwerf-Datei.

Ergebnis Runde 1 (bestehende Suite, nur Mock-Schicht): `npm run check` EXIT=0 (368 Unit-Tests), `npm run test:e2e` EXIT=0, 102 von 102, **keine Meldung „Aufruf ohne Mock"**: die bestehenden Tests brauchten außer Tarifen und Bedingungen nichts vom echten Backend (`tmp/proof/nacht-e2e-r1-*.log`).

## Fragen an Beks

- **F-1:** Die Cloud-Session hat einen Supabase-Connector (MCP) mit Schreibrechten (Migrationen, SQL, Deploy). Soll er für Nachtläufe abgeschaltet werden? Ich habe ihn nicht benutzt.
- **F-2:** Partner-Wege (Angebot annehmen, Auftrag sehen) gibt es in der App noch nicht (Partner-Portal ab S9b, nur nach Freigabe). Die Suite testet nur den Platzhalter „Für Vermieter". Sollen E2E-Tests für das Partner-Portal gleich mit S9b-Teilschritten entstehen?
