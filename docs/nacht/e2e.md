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

### Phase 3 · Wege-Tests (`tests/e2e/wege.spec.ts`)

| Weg | Erfolg | Abbruch | Fehler |
|---|---|---|---|
| W2 Umzug | Start-Karte → Konfigurator (689,61 €) → Termin (Strecke 4,8 km) → Zusammenfassung → Anmeldung → Senden → Gesendet → Aufträge; Aufruf enthält Strecke (bestätigte Adressen mit Punkten, Rückfahrt), Tag, Kontakt und genau den angezeigten Preis, keine Gebührenfelder; Zusammenfassung und Bestätigung ohne Gebührentext | Zurück in der App und im Browser aus Zusammenfassung und Termin: Tag ausgewählt, Preis 689,61 €, Kontakt bleibt, kein Aufruf | 503 (Adressprüfung): Meldung, Entwurf bleibt, „Erneut senden" mit derselben `clientRef` |
| W3 Möbeltransport | Klavier → persönliches Angebot → Gesendet ohne Preis („Wartet auf Angebot"), `shown` = Angebot; zweiter Test mit Festpreis: der im Konfigurator angezeigte Betrag (aus dem `aria-label`) wird gesendet und bestätigt | Zurück aus der Anmeldung: Angaben bleiben, kein Code angefordert, nichts gesendet | Tarife nicht ladbar: Fehlerzustand im Konfigurator, „Erneut versuchen" |
| W4 Entrümpelung | Besichtigung (Gewerbe) bis Gesendet, `shown` = Angebot | (bestehend: „Ändern" im Ergebnis) | (bestehend: Foto- und `quote`-Fehler) |
| W6 Miete | Start-Karte → Platzhalter, kein Aufruf an `rest`/`functions`/`auth`/`storage`, kein Senden-Knopf | – | – |
| W7 Vermieter | Profil → Platzhalter → Zurück zum Profil | – | – |
| W9 Aufträge | (bestehend) | – | Liste nicht ladbar: Fehlerzustand, „Erneut versuchen" zeigt die Liste |

Gefundene Testfallen (keine App-Fehler), mit Begründung gelöst:
- **Zwei `main` im Seitenübergang:** Während die alte Seite ausblendet (AnimatePresence in `Shell.tsx`), stehen Texte doppelt im DOM; strikte Locators scheitern. Lösung wie in `anfrage.spec.ts`: nach jeder Navigation auf genau ein `main` warten (`oneMain`).
- **React StrictMode lädt im Dev-Modus doppelt** und verwirft das erste Ergebnis: Ein Mock „nur der erste Aufruf scheitert" erreicht die Oberfläche nie. Lösung: der Fehler bleibt, bis der Test ihn abschaltet, dann „Erneut versuchen".
- **Beobachtung (nicht behoben, kein realistischer Nutzerfall):** `/anmelden?next=…` ersetzt beim Öffnen die eigene URL (`navigate('/anmelden', { replace: true })`, `Anmelden.tsx:52-56`). Springt man zurück, bevor dieser Effekt gelaufen ist (in Playwright wenige Millisekunden nach dem Öffnen), ersetzt er den Eintrag, auf den zurückgesprungen wurde: Die URL bleibt `/anmelden`. Ein Mensch tippt nicht so schnell; der Test wartet deshalb auf `/anmelden$`. Nicht geändert, weil die Anmeldung sicherheitsgeprüft ist (Login-CSRF, Berater S8b-1) und der Fall praktisch nicht vorkommt (Frage F-3).

### Phase 4 · Handy und Desktop
- Neues Projekt `e2e-desktop` (1280×800, Faktor 1) neben `e2e` (390×844, Faktor 2, wie die Referenz). `npm run test:e2e` läuft jetzt mit beiden; `npm run test:e2e:mobile` nur Handy (für schnelle Runden). Entscheidung: beide im Standardbefehl, weil der Auftrag beide Größen verlangt; die Laufzeit verdoppelt sich etwa (Frage F-4).
- Screenshot und Trace bei Fehlschlag waren schon gesetzt (`screenshot: 'only-on-failure'`, `trace: 'retain-on-failure'`, Ablage `tmp/playwright/`) und gelten für beide Projekte. Belegt durch den Rot-Beweis der Mock-Schicht (Runde 2): Screenshot `tmp/playwright/e2e-backend-Rot-Beweis-…/test-failed-1.png`.
- Das Handy-Projekt bleibt „Desktop Chrome mit 390 px" (ohne `isMobile`/`hasTouch`), wie bisher und wie die Shots. Echte Touch-Emulation hätte das Verhalten von 102 bestehenden Tests verändert; nicht ohne Freigabe (Frage F-4).

### Selbstprüfung (Reviewer, Abnahme ohne UI, `tmp/proof/nacht-e2e-review.md`)
Ergebnis: hoch 0, mittel 2, niedrig 5. Alle umgesetzt:
- M: Transport-Festpreis prüfte nur „> 0" → jetzt angezeigter Betrag = gesendetes `shown` = bestätigter Betrag (der Mock antwortet mit dem gesendeten Preis).
- M: Doku sagte „Strecke im Aufruf", der Test prüfte sie nicht → Punkte beider Adressen und `returnTrip` geprüft.
- N: Gebührentext in Kunden-Screens → `noFeeText` auf Zusammenfassung und Bestätigung (Umzug).
- N: Service Worker an der Mock-Schicht vorbei → `serviceWorkers: 'block'` in `playwright.config.ts` (die App registriert heute keinen; WebSockets nutzt sie nicht).
- N: `backend.spec.ts` „abgebrochen" träte auch ohne Sperre ein (DNS) → Kommentar; beweisend ist die Meldung in `unmocked`.
- N: Abbruch W2 ohne echtes Browser-Zurück → zweimal `page.goBack()` ergänzt, vor der Negativprüfung `oneMain`.
- N: `docs/proof/nacht-e2e/nacht-e2e-r2-rotbeweis.log` nennt `backend.spec.ts:30`; durch spätere Kommentarzeilen steht der Test heute in Zeile 32. Das Log bleibt unverändert (Nachweise werden nicht geändert).

Eigener Fund: Die Shots nutzen jetzt dieselbe Mock-Schicht, liefen in dieser Nacht aber noch nicht → eigener Lauf: `npm run shots` EXIT=0, 134 von 134 (67 Light, 67 Dark), keine Konsolenfehler, kein ungemockter Aufruf (`docs/proof/nacht-e2e/nacht-e2e-shots.log`). Screenshots brauchen damit ebenfalls kein Supabase.

### Nachdurchgang (alle Phasen erneut)
- **Phase 1:** Eine Lücke gefunden: Der Fehlerzustand der Zusammenfassung („Die Angaben konnten nicht geladen werden", wenn Tarife oder Bedingungen fehlen) hatte keinen Test → ergänzt (`wege.spec.ts`, „F Fehlerfälle quer"). Der erste Lauf (Runde 6) war in einzelnen Wiederholungen rot: Der Test tippte nach dem Seitenübergang zu früh auf das Radio „Küche" (`force` wartet nicht auf Stillstand). Fix: auf URL, genau ein `main` und die vollständig sichtbare Überschrift warten; danach 60 von 60 je Projekt bei fünffacher Wiederholung (Runde 7). Das rote Log liegt bei den Nachweisen (`nacht-e2e-r6-wege.log`).
- **Phase 2:** Sperre deckt http und https; Service Worker blockiert; WebSockets nutzt die App nicht; ein wiederverwendeter Dev-Server ist abgedeckt (hostunabhängige Muster). Nichts weiter.
- **Phase 3:** Jeder Weg aus Phase 1 hat Erfolg, Abbruch und Fehler, soweit der Weg gebaut ist. Montage (W5) und Anmeldung (W8) waren schon dicht und bekamen nichts dazu, um keine Doppeltests zu bauen.
- **Phase 4:** beide Projekte in jedem Abschlusslauf.
- **Dritter Durchgang:** keine weitere sinnvolle Lücke. Ende.

### Echte Fehler in der App
Keiner gefunden, deshalb kein Fix-Commit. Die Beobachtung zur Anmeldung (sehr schnelles Zurück, oben unter Phase 3) ist kein realistischer Nutzerfall und als Frage F-3 notiert.

## Ergebnis

### Commits auf `nacht-e2e`
| Commit | Inhalt |
|---|---|
| dd0eafc | Start: Prüfung, Nachtdatei |
| a2044d8 | Phase 1: Nutzerwege und Abdeckung |
| 67d9a1e | Phase 2: Mock-Schicht, Fixture, alle Specs und Shots darauf, `playwright.config.ts`, Wege-Entwurf |
| 0b10cc5 | Phase 2: Selbsttest und Rot-Beweis der Mock-Schicht, Doku |
| 9ec286e | Phase 3: Wege-Tests warten auf den Seitenübergang, Fehler-Mock für StrictMode |
| 59eec7c | Phase 4: Projekt `e2e-desktop`, `test:e2e` mit beiden Größen, `test:e2e:mobile` |
| ec04015 | Doku Phase 3 und 4 |
| a83cb4f | Nachweise Runde 1, 2, 4 |
| 046fb61 | Review-Funde umgesetzt |
| fb955bc | Nachdurchgang: Fehlerzustand der Zusammenfassung |
| 00bef27 | Nachdurchgang: Test wartet auf das Ende des Übergangs |
| (dieser) | Abschluss: Nachweise Runde 7, Shots, Review; Nachtdatei; PROGRESS |

### Testergebnisse (Abschluss, Runde 7, `docs/proof/nacht-e2e/`)
- `npm run check`: EXIT=0, 368 Unit-Tests.
- `wege.spec.ts`, fünffach wiederholt, Handy und Desktop: EXIT=0, je Projekt 60 von 60.
- `npm run test:e2e` (Handy und Desktop): EXIT=0, je Projekt 116 bestanden, 1 übersprungen (Rot-Beweis, nur mit `E2E_REDPROOF=1`); 11,2 Minuten in diesem Container. Vorher: 102 Tests, nur Handy, Tarife aus dem Dev-Projekt.
- Rot-Beweis der Mock-Schicht (Runde 2): EXIT=1 wie erwartet, Meldung „Aufruf ohne Mock" mit der URL, Fehler-Screenshot erzeugt.
- `npm run shots`: EXIT=0, 134 von 134.
- `npm run scan:proof`: EXIT=0, 104 Dateien, 0 Treffer.
- Nicht gelaufen (nicht nötig, kein `src/`, kein `supabase/` geändert): `build`, `test:rls`, `shots:all`.

### Empfehlung: übernehmen
1. **`tests/e2e/backend.ts` mit Fixture und die Importänderungen** (wichtigste Änderung): Die Suite hängt nicht mehr vom Dev-Projekt ab, läuft ohne `.env.local` und kann kein echtes Backend mehr erreichen. Voraussetzung für E2E in CI.
2. **`tests/e2e/wege.spec.ts`** (12 Tests): schließt die Lücken Umzug und Möbeltransport bis zum Senden, Platzhalter Miete und Vermieter, Ladefehler von Aufträgen, Konfigurator und Zusammenfassung.
3. **`tests/e2e/backend.spec.ts`** (Selbsttest, Rot-Beweis per Variable).
4. **`playwright.config.ts`:** `webServer.env`, `serviceWorkers: 'block'`, `PW_CHROMIUM_PATH`, Projekt `e2e-desktop`.
5. **`package.json`:** `test:e2e` mit beiden Größen nur, wenn die doppelte Laufzeit passt (F-4); sonst `test:e2e` wie vorher und Desktop als eigener Befehl.
- Danach kann der pausierte Design-Auftrag (bekhanidrisov74-hub/movenow#5) seine Vorher-Shots ohne Supabase aufnehmen; auf `nacht-design` fehlt diese Mock-Schicht noch.

## Fragen an Beks

- **F-1:** Die Cloud-Session hat einen Supabase-Connector (MCP) mit Schreibrechten (Migrationen, SQL, Deploy). Soll er für Nachtläufe abgeschaltet werden? Ich habe ihn nicht benutzt.
- **F-3:** Soll `/anmelden` das Entfernen von `?next=` robust gegen sehr schnelles Zurück machen (z. B. `rememberNext` und `replaceState` vor dem ersten Render statt im Effekt)? Betrifft die sicherheitsgeprüfte Anmeldung, deshalb nicht in der Nacht geändert.
- **F-4:** `npm run test:e2e` läuft jetzt auf Handy und Desktop (etwa doppelte Laufzeit). Lieber Desktop nur im Abschluss einer Session (`test:e2e:mobile` in den Runden)? Und soll das Handy-Projekt echte Touch-Emulation (`isMobile`, `hasTouch`) bekommen?
- **F-2:** Partner-Wege (Angebot annehmen, Auftrag sehen) gibt es in der App noch nicht (Partner-Portal ab S9b, nur nach Freigabe). Die Suite testet nur den Platzhalter „Für Vermieter". Sollen E2E-Tests für das Partner-Portal gleich mit S9b-Teilschritten entstehen?
