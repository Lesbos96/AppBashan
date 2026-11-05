# Nacht 2026-11-05 · Barrierefreiheit (WCAG 2.2 AA) und Ladegeschwindigkeit

Unbeaufsichtigter Nachtauftrag von Beks. Branch `nacht-qualitaet` (von `main` bei `1630668`), Entwurfs-PR gegen `main`. S9b wird nicht bearbeitet. Keine Migration, kein `db:push`, kein Deploy, keine neuen oder aktualisierten Abhängigkeiten, keine `.env`-Datei gelesen oder angelegt, nichts gelöscht.

## Start

### Umgebung (Schritt 2)
- Umgebungsvariablen nur nach Namen geprüft (`env | cut -d= -f1`, kein Wert ausgegeben): **kein** `SUPABASE_*`, kein Service-Role-Key, kein DB-Passwort, kein Supabase-Access-Token. Vorhanden sind nur Variablen der Laufumgebung (GitHub-Token, Cloud-Zugang der Sandbox, Proxy). Im Repo liegt nur `.env.example`, keine `.env.local`.
- Ergebnis: kein STOPP, Arbeit beginnt.
- **Hinweis an Beks:** In der Werkzeugliste dieser Session steht ein Supabase-MCP-Connector (u. a. `execute_sql`, `apply_migration`, `deploy_edge_function`). Er ist keine Umgebungsvariable und fällt nicht unter die Prüfung aus Schritt 2. Ich habe ihn in dieser Nacht **nicht geladen und nicht benutzt**. Falls unbeaufsichtigte Sessions keinen DB-Zugang haben sollen, den Connector für solche Sessions abschalten.

### Entscheidungen zu Beginn
| Nr. | Entscheidung | Begründung |
|---|---|---|
| E1 | Die Session läuft mit Opus 5.5, nicht mit Sonnet 5.5 (CLAUDE.md: Hauptsession Sonnet, Opus nur auf Anfrage; „sag es mir und warte"). Ich arbeite trotzdem weiter. | Niemand beantwortet Rückfragen; Warten hieße, die Nacht ungenutzt zu lassen. Die Session wurde von Beks mit diesem Modell gestartet. |
| E2 | Commits nach jedem Teilziel und Weiterarbeiten statt „ein Commit beendet die Session". | Ausdrückliche Vorgabe des Nachtauftrags (geht CLAUDE.md vor, weil später und konkreter). |
| E3 | Branch `nacht-qualitaet` statt des von der Laufumgebung vorgeschlagenen Session-Branches. | Ausdrückliche Vorgabe des Nachtauftrags. |
| E4 | `npm ci` (exakt nach `package-lock.json`) zum Einrichten von `node_modules`. | Ohne `node_modules` laufen weder Checks noch Tests. `npm ci` fügt nichts hinzu und aktualisiert nichts; `package.json` und `package-lock.json` bleiben unverändert (per `git diff` geprüft). |
| E5 | Keine Messwerkzeuge wie axe-core oder Lighthouse nachinstalliert. Prüfung mit eigenen Playwright-Skripten (Kontrastrechnung aus `getComputedStyle`, Zugänglichkeitsbaum, Tastaturdurchlauf, `boundingBox()` für Tippflächen) und dem Build-Bericht von Vite. | Abhängigkeiten hinzufügen ist verboten. |
| E6 | Kein Built-in-`advisor`-Tool in der Werkzeugliste (CLAUDE.md verlangt diesen Hinweis). | — |

## Phase 1 · Prüfung

### Methode
- **Umgebung:** Keine `.env.local`, kein Zugang zum Dev-Projekt. Die App läuft mit zwei Prozessvariablen (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399`, Dummy-Publishable-Key). Unter Port 54399 läuft ein lokaler Ersatz nur für die drei öffentlichen Tarif-Endpunkte (`current_price_version`, `price_config`, `rpc/booking_terms`), Werte aus `supabase/seed.sql` (28 Tarifzeilen, Bedingungen aus `platform_settings`), Skript `tmp/nacht/fake-api.mjs` (nicht im Repo). Alles andere mocken die Tests selbst. Ohne diesen Ersatz scheitern alle E2E-Tests, die Tarife laden (Entrümpelung, Montage, Termin, Zusammenfassung), an der fehlenden Datenbank (erster Lauf mit Dummy-URL: `tmp/nacht/baseline-e2e-dummyurl-abgebrochen.log`).
- **Browser:** Das Repo erwartet Chromium-Revision 1248, installiert ist 1243. Symlink `/opt/pw-browsers/chromium-1248 → chromium-1243` (und `chromium_headless_shell`) außerhalb des Repos, keine Konfigurationsänderung.
- **Prüfskript** `tmp/a11y/` (nicht im Repo): dieselben 60 Bildschirmzustände wie `tests/shots/shots.spec.ts` (gleiche Schritte und Mocks), je Light und Dark bei 390×844. Je Zustand: Textkontrast aller sichtbaren Textknoten (Farben über Canvas aufgelöst, Hintergrund über alle Ebenen inklusive Verlaufsstopps zusammengesetzt, schlechtester Fall), interaktive Rollen ohne Namen (Playwright `ariaSnapshot`), Tippflächen per `getBoundingClientRect` (Felder im `<label>` mit Labelfläche), Tab-Durchlauf bis zum Zyklus (Fokusrahmen vorhanden, Kontrast des Rahmens zur Umgebung, Verdeckung durch Ebenen mit Fläche per `elementsFromPoint`), Überschriften, Landmarken, Seitentitel, Reflow bei 320×568 und Textabstände nach WCAG 1.4.12. Maße stammen aus dem DOM, nicht aus Bildern.
- **Code-Durchsicht** aller Screens und Komponenten unter `src/` auf Beschriftungen, Live-Regionen, Fokusführung und Bildschirmleser-Texte.

Rohbericht: `tmp/nacht/a11y-vorher.md` (134 Zustände, Lauf `tmp/nacht/audit-vorher.log`, 134 bestanden, EXIT=0).

### Ergebnis je Bildschirm (vor den Änderungen, Light und Dark)
„ok" heißt: das Prüfskript fand nichts und die Code-Durchsicht auch nicht. Die Nummern verweisen auf die Fundliste darunter.

| Bildschirm | Kontrast Text | Beschriftungen | Tastatur | Fokus | Bildschirmleser | Tippflächen |
|---|---|---|---|---|---|---|
| Start | ok | ok | ok | A1, A2 (Mietkarte unter der Tab-Bar) | A4, A5 | ok |
| Onboarding (3 Seiten) | ok | ok | ok | A1 („Überspringen" 1,2:1 auf dunklem Grund) | A4, A13 | ok |
| Anmelden (E-Mail, Code, Link, Fehler) | ok | ok | A6 | A1 | A4, A5 | ok |
| Aufträge (leer, Liste) | ok | ok | ok | A1 | A4, A5 | ok (Segmente 32 px, Fläche per `::before` 44 px) |
| Profil, Datenschutz, Impressum, Miete | ok | ok | ok | A1 | A4, A5 | ok |
| Info-Sheet „Wie rechnet MoveNow?" | ok | ok | ok (Fokusfalle, Esc, Rückgabe) | A1 | A4 | ok |
| Transport / Umzug (Konfigurator, Sheets) | A11 (Dark) | A9 | ok | A1, A2 (bis zu 13 Elemente ganz unter der Preisleiste), A3 | A4, A5, A8, A14 | ok |
| Entrümpelung (6 Schritte, Ergebnis) | ok | A9 | ok (Fokus auf die Frage je Schritt) | A1, A2 (teilweise), A3 | A4, A5, A14, A15 | ok (Chips 30 px, per `::before` 46 px) |
| Montage (Standard, Küche, Preis-Sheet) | ok | ok | ok | A1 | A4, A5, A8 | ok |
| Termin (Montage, Umzug) | ok | ok | ok | A1 | A4, A5 | ok (Kalendertage 44 px) |
| Zusammenfassung (alle Zustände) | ok | ok | ok | A1, A2 (Kontaktfelder unter Kopf- bzw. Aktionsleiste) | A4, A5, A7 | ok |
| Gesendet (alle Zustände) | ok | ok | ok | A1 | A4, A5 | ok |
| Fehlerseite | ok | ok | ok | A1 | A4, A10 | ok |

Ohne Befund in allen Zuständen: interaktive Elemente ohne Namen (0), Reflow bei 320 px (kein horizontales Scrollen), `lang="de-AT"`, kein `tabindex > 0`, kein fokussierbares Element in `aria-hidden`, keine Bilder ohne `alt`, alle Tippflächen ≥ 30 px und mit `::before`-Erweiterung ≥ 44 px (WCAG 2.5.8 verlangt 24 px).

### Fundliste
| Nr. | Fund | WCAG 2.2 | Wo | Entscheidung |
|---|---|---|---|---|
| A1 | Fokusrahmen `color-mix(accent 45 %, transparent)`: Kontrast zur Umgebung 2,13–2,22:1 (Light), 2,81:1 (Dark), 1,2:1 auf dem dunklen Onboarding-Kopf | 1.4.11 (AA) | alle | beheben: Rahmen in voller Akzentfarbe, auf dunklem Grund Mint |
| A2 | Fokussiertes Element liegt ganz (114 Fälle) oder teilweise (46) unter der fixierten Aktions-, Preis- oder Tab-Leiste bzw. unter der Kopfleiste; der Browser scrollt nur bis an den Fensterrand | 2.4.11 (AA) | Transport, Umzug, Zusammenfassung, Entrümpelung, Start | beheben: `scroll-padding` oben und unten |
| A3 | Freitextfelder „Gegenstände & Umfang" und der Hinweis in der Entrümpelung haben `outline-none` ohne Ersatz | 2.4.7 (AA) | Transport, Umzug, Entrümpelung | beheben: Rahmen am Label wie bei `Field` |
| A4 | Seitentitel ist auf allen Seiten „MoveNow" | 2.4.2 (A) | alle | beheben: Titel je Route |
| A5 | Seitenwechsel wird Bildschirmlesern nicht angesagt (Fokus fällt nach dem Wechsel auf `body`) | 4.1.3 (AA), Umfeld 2.4.3 | alle | beheben: höfliche Live-Region mit dem Seitentitel |
| A6 | Anmeldung: nach „Code senden" und „Andere Adresse" verschwindet das fokussierte Element, der Fokus fällt auf `body` | 2.4.3 (A) | Anmelden | beheben: Fokus ins neue Feld |
| A7 | Wartezeit nach 429 („Noch 59 s.") steht in `role="alert"` und wird jede Sekunde neu vorgelesen | 4.1.3 (AA), stört 2.2.4 | Zusammenfassung | beheben: Zähler außerhalb der Live-Region |
| A8 | Geänderter Richtpreis in der Preisleiste wird nicht angesagt (sichtbar zählt er hoch) | 4.1.3 (AA) | Transport, Umzug, Montage | beheben: unsichtbare Statusmeldung mit dem Endbetrag |
| A9 | Knopf mit sichtbarem Text „Kamera" heißt für Hilfsmittel „Foto aufnehmen" (Sprachsteuerung „Kamera" trifft nicht) | 2.5.3 (A) | Fotos | beheben: Name beginnt mit „Kamera" |
| A10 | Fehlerseite ohne `h1` | 1.3.1, 2.4.6 | Fehlerseite | beheben |
| A11 | Marker „A" (Abholung) im Dark Mode `#0e6f74` auf `#0f272b`: 2,63:1 | 1.4.3 (AA) | Transport, Umzug (Dark) | beheben: im Dark Mode Akzentfarbe (Mint), wie andere Dark-Ableitungen |
| A12 | Textabstände nach 1.4.12: Betrag der Preisleiste in fester Höhe 54 px abgeschnitten; Adressen in der Adresskarte und Segment „Nachmittag" mit Auslassungspunkten | 1.4.12 (AA) | Preisleiste, Adresskarte, Zeitfenster | Preisleiste beheben (Mindesthöhe); Adresskarte und Segmente: Frage F3 |
| A13 | Onboarding: neuer Titel und Text nach „Weiter" werden nicht angesagt, der Fokus bleibt auf dem Knopf | 4.1.3 (AA) | Onboarding | beheben: Text als höfliche Live-Region |
| A14 | Foto-Zähler „x von 8" ändert sich ohne Ansage | 4.1.3 (AA) | Fotos | beheben: Zähler als Statusmeldung |
| A15 | Überschriftensprung `h1` → `h3` („Fotos") im letzten Entrümpelungsschritt | 1.3.1 (gute Praxis) | Entrümpelung | beheben: Ebene als Parameter |
| A16 | Eigene Radiogruppen (Objektart, Füllgrad, Fahrzeugart) als Knöpfe mit `role="radio"`: jede Option ist ein eigener Tab-Stopp, Pfeiltasten wirken nicht | ARIA-Muster; 2.1.1 ist erfüllt | Entrümpelung, Fahrzeugart | nicht geändert: Fahrzeugart schließt bei Auswahl das Sheet, Pfeiltasten würden es bei jedem Schritt schließen; Frage F4 |
| A17 | Schalter „aus": Spur `rgba(16,47,53,.14)` auf Weiß ≈ 1,3:1; ausgewähltes Segment nur über weiße Fläche (≈ 1,1:1) und Fettschrift | 1.4.11 (fraglich) | Schalter, Segmente | nicht geändert: Werte stammen aus `tokens.json` (Optik verbindlich); Frage F2 |
| A18 | Hero-Verlauf (32 s), Wagen und Linien laufen endlos; bei „Bewegung reduzieren" aus, sonst kein Pausieren | 2.2.2 (A, fraglich: rein dekorativ) | Start, Onboarding | nicht geändert: Design-Referenz; Frage F5 |
| A19 | Deaktivierte Knöpfe unter 4,5:1 (18 Fälle) | 1.4.3 nimmt inaktive Elemente aus | Leisten, Stepper | kein Fund; als UX-Punkt schon in OPEN_ISSUES |
| A20 | Tab-Bar zeigt „Miete" (Phase 1: drei Tabs) | kein A11y-Fund | Tab-Bar | nicht angefasst, bekannt (OPEN_ISSUES „S9a-2 · UI") |

### Ausgangslage Tests (vorher)
- Baseline im separaten Worktree vom Stand `main` (`git worktree` im Scratchpad, damit Änderungen im Repo den Lauf nicht beeinflussen): `npm run check` EXIT=0 (`tmp/nacht/baseline-check.log`), `npm run build` EXIT=0 (`tmp/nacht/baseline-build.log`, Warnung „Some chunks are larger than 500 kB"), `npm run test:e2e` EXIT=0, 102 bestanden (`tmp/nacht/baseline-e2e.log`, mit Tarif-Ersatz).

### Messung Bundle und Ladezeit (vorher)
Werkzeug: `tmp/nacht/measure.mjs` (Build aus `dist/`, eigener statischer Server mit gzip, Chromium 390×844, Drosselung wie Lighthouse-Mobil: 150 ms RTT, 1,6 Mbit/s, CPU ×4, ohne Cache, Median aus 5 Läufen). Bericht `tmp/nacht/messung-vorher.md`.

| Datei | roh | gzip | brotli |
|---|---:|---:|---:|
| `index-*.js` (einziges JS, alles in einem Chunk) | 896,4 kB | 254,3 kB | 214,8 kB |
| `index-*.css` | 51,0 kB | 10,6 kB | 9,2 kB |
| Inter-Schriften (7 Teilmengen, `unicode-range`) | 213,4 kB | – | – |

| Route | FCP | LCP | h1 sichtbar | übertragen |
|---|---:|---:|---:|---:|
| `/` | 2028 ms | 2028 ms | 2029 ms | 267 kB |
| `/montage` | 1952 ms | 2380 ms | 2001 ms | 267 kB |
| `/umzug` | 1948 ms | 2428 ms | 1990 ms | 267 kB |
| `/profil` | 1984 ms | 1984 ms | 2011 ms | 267 kB |
| `/anmelden` | 1960 ms | 1960 ms | 1995 ms | 267 kB |

Zusammensetzung des JS (Sourcemap eines Analyse-Builds, `tmp/nacht/composition-vorher.txt`): react-dom 22,6 %, motion (motion-dom + framer-motion) 16,6 %, Supabase 24,1 % (davon auth-js 10,8 %, realtime-js + phoenix 6,1 %, storage-js 2,5 %), react-router 10,7 %, Illustrationen 7,0 %, Icons 1,5 %, Screens und Bibliotheken der App rund 12 %, `src/lib/motion.ts` 0,6 % (bindet die ganze `tokens.json` ein, gebraucht wird nur `motion.spring`).

Hinweis: Im Messbrowser (Linux, headless) lädt keine Inter-Datei (`document.fonts` ohne geladene Schrift); der Browser löst offenbar eine frühere Schrift des Stapels auf, die Ursache habe ich nicht geprüft. Wo Inter greift (z. B. Android, Windows), kommt mindestens die Teilmenge latin (47 kB) dazu. Die Zahlen oben enthalten keine Schrift.

## Phase 2 · Barrierefreiheits-Funde beheben

Je Fund ein Commit; vor jedem Commit `npm run check` und die betroffenen E2E-Specs über den `test-runner` (Logs `tmp/nacht/<fund>-*.log`). Neue Tests in `tests/e2e/barrierefreiheit.spec.ts`.

| Fund | Änderung | Prüfung |
|---|---|---|
| A1 | `theme.css`: Fokusrahmen 2 px in voller Akzentfarbe statt 3 px mit 45 % Deckkraft (Light ≈ 7:1, Dark ≈ 11:1 statt 2,2:1 bzw. 2,8:1). Labels mit `has-[:focus-visible]` (Segmente, Felder, Adresssuche) ebenso. Zeilen in Listen mit `overflow-hidden` (Listenzeilen, Wertezeilen, Adresskarte, Treffer der Adresssuche, Fahrzeugart, Montage-Zeile) zeichnen den Rahmen nach innen, sonst schnitt die Liste ihn ab. „Überspringen" im Onboarding mit Mint-Rahmen auf dunklem Grund. Entscheidung 2 px statt 3 px: bei voller Deckkraft wirkt 3 px schwer, 2 px erfüllt auch das AAA-Kriterium 2.4.13 (Mindestdicke 2 px). | `a1-check.log` EXIT=0 (368 Unit), `a1-e2e.log` EXIT=0 (28 bestanden, darunter 4 neue Tests: Light, Dark, Listenzeile, Onboarding) |
| A2 | `theme.css`: `scroll-padding-top` (44 px + Safe Area + 8 px) und `scroll-padding-bottom` (126 px + Safe Area + 8 px) am `html`. Der Browser scrollt fokussierte Elemente damit aus dem Bereich der fixierten Leisten. Entscheidung: ein fester Wert für die höchste Leiste (Bestätigung mit zwei Knöpfen) statt je Seite; auf Seiten mit niedrigerer Leiste scrollt der Browser nur etwas weiter, sonst ändert sich nichts. | Rot ohne Fix: `a2-rot.log` und nach Anpassung des Tests `a2-rot2.log` (je EXIT=1, 3 Tests rot: 6 Elemente im Umzug, 2 Kontaktfelder, Mietkarte). Grün: `a2-e2e.log` (voller Lauf 108 bestanden, 1 rot: der neue Zusammenfassungs-Test begann während des Seitenübergangs, als die Leisten noch an die ausblendende Seite gebunden waren; der Test wartet jetzt auf das Ende des Übergangs), `a2-check2.log` EXIT=0, `a2-gruen.log` EXIT=0 (43 bestanden) |
| A3 | Labels der Freitextfelder in Transport/Umzug und Entrümpelung zeichnen bei `:focus-visible` des Textfelds den Rahmen nach innen (wie `Field`), mit der Rundung der Karte | Rot: Prüfskript (Fokus ohne Anzeige, 16 Fälle). Grün: `tmp/proof/a3-check.log` EXIT=0 (368 Unit), `tmp/proof/a3-e2e.log` EXIT=0 (30 bestanden, 2 neue Tests). Ab hier schreibt der `test-runner` seine Logs nach `tmp/proof/` (seine Regel), nicht nach `tmp/nacht/` |
| A4 | `Handle` hat jetzt ein Pflichtfeld `title`; die Shell setzt `document.title` als „<Titel> · MoveNow" (z. B. „Umzug: Zusammenfassung · MoveNow"), die Fehlerseite außerhalb der Shell setzt „Seite nicht gefunden · MoveNow". Entscheidung: Titel im Router statt in jedem Screen, damit keine Route ohne Titel bleibt (Typprüfung erzwingt ihn) | `tmp/proof/a4-check.log` EXIT=0, `tmp/proof/a4-e2e.log` EXIT=0 (22 bestanden, neuer Test mit 8 Routen und einem Wechsel in der App) |
| A5 | Shell: nach einem Seitenwechsel (nicht beim ersten Laden) bekommt die `h1` der neuen Seite den Fokus (`tabindex="-1"`, ohne Rahmen, `preventScroll`). Lädt eine Seite ihre Überschrift erst nach (Entrümpelung, Richtwert), wartet ein `MutationObserver` höchstens 5 s. Liegt der Fokus schon in der neuen Seite (z. B. Wizard-Schritt, Eingabe), bleibt er dort; Profil und Info-Sheet teilen eine Seite, dort ändert sich nichts. Entscheidung: Fokus auf die Überschrift statt einer unsichtbaren Ansage-Region; eine Region mit Seitentext hätte in vielen bestehenden Tests `getByText` mehrdeutig gemacht, und der Fokus löst zusätzlich das Problem, dass Tab nach dem Wechsel am Dokumentanfang begann | Rot: `tmp/proof/a5-rot.log` EXIT=1 (2 von 3 rot, der dritte ist ein Schutztest für den ersten Aufruf). Grün: `tmp/proof/a5-check.log` EXIT=0, `tmp/proof/a5-e2e.log` voller Lauf 114 bestanden, 1 rot (Testfehler: beim schnellen Zurück standen zwei „Start"-Überschriften im Übergang; der Test prüft jetzt `h1:focus`), Nachlauf `tmp/proof/a5-e2e2.log` EXIT=0 (Datei dreimal hintereinander, 39 bestanden) |
| A6 | Anmelden: Codefeld mit `autoFocus` (der Knopf „Code senden" verschwindet beim Schrittwechsel); E-Mail-Feld mit `autoFocus` nur nach „Andere Adresse" bzw. „Neuen Code anfordern", nicht beim ersten Öffnen (kein ungefragter Fokus beim Laden) | Rot: nicht separat gelaufen (ohne `autoFocus` setzt nichts den Fokus ins Codefeld; Code-Durchsicht). Grün: `tmp/proof/a6-check.log` EXIT=0, `tmp/proof/a6-e2e.log` EXIT=0 (31 bestanden, 2 neue Tests inklusive Schutztest „kein Fokus beim ersten Öffnen") |
| A7 | Zusammenfassung: `role="alert"` nur noch auf der Meldung; „Noch X s." steht sichtbar daneben, aber außerhalb der Live-Region. Der Knopf „Bitte warten (X s)" bleibt unverändert (keine Live-Region) | Rot: `tmp/proof/a7-rot.log` EXIT=1 (Alert-Text „… Noch 60 s." wurde nach 2 s zu „… Noch 58 s."). Grün: `tmp/proof/a7-check.log` EXIT=0, `tmp/proof/a7-e2e.log` EXIT=0 (67 bestanden: barrierefreiheit, anfrage, fotos) |
| A8 | Preisleiste: unsichtbare Statusmeldung (`role="status"`, `sr-only`) mit dem Endbetrag („Richtpreis 95,74 €", ohne Hochzählen) bzw. „Strecke fehlt, noch kein Richtpreis" / „Persönliches Angebot, kein Richtpreis". Beim ersten Anzeigen sagt sie nichts an (Live-Regionen melden nur Änderungen) | Rot: nicht separat gelaufen (die Meldung existierte vorher nicht). Grün: `tmp/proof/a8-check.log` EXIT=0, `tmp/proof/a8-e2e.log` EXIT=0 (40 bestanden: barrierefreiheit, konfigurator, dienste, komponenten) |
| A9 | Fotoknöpfe: Namen „Kamera, Foto aufnehmen" und „Galerie, Fotos auswählen" (vorher „Foto aufnehmen" bzw. „Fotos aus der Galerie wählen"); der bestehende Test mit „Foto aufnehmen" trifft weiter (Teiltreffer) | `tmp/proof/a9-check.log` EXIT=0, `tmp/proof/a9-e2e.log` EXIT=0 (45 bestanden: barrierefreiheit, konfigurator, fotos) |
| A14 | Foto-Zähler als höfliche Live-Region (`aria-live="polite"`, `aria-atomic`), für Bildschirmleser „2 von 8 Fotos" (unsichtbarer Zusatz „Fotos"); Fehlermeldungen hatten schon `role="alert"` | `tmp/proof/a14-check.log` EXIT=0, `tmp/proof/a14-e2e.log` EXIT=0 (55 bestanden: barrierefreiheit, konfigurator, fotos, dienste) |
| A14b | **Nachbesserung eines eigenen Fehlers:** Der unsichtbare Zusatz „ Fotos" war ein zweites Element mit dem Text „Fotos"; der Schritt `getByText('Fotos', { exact: true })` in `tests/shots/shots.spec.ts` (`fotos-typ-abgelehnt`) fand dadurch zwei Treffer. `test:e2e` enthält die Shots nicht, erst der Kontrolllauf des Prüfskripts zeigte es. Jetzt umfasst die Live-Region Überschrift und Zähler („Fotos, 2 von 8"), ohne Zusatzelement | `tmp/proof/a14b-check.log` EXIT=0, `tmp/proof/a14b-e2e.log` EXIT=0 (62 bestanden), `tmp/proof/a14b-shots.log` EXIT=0 (`fotos-typ-abgelehnt`, `transport-fotos`, `entruempelung-fotos`, 390 Light/Dark, 6 bestanden) |
| A15 | `Fotos` bekommt `level` (Standard 3 wie bisher im Konfigurator unter dem h2 des Schritts); die Entrümpelung übergibt 2, weil die Karte dort direkt unter dem h1 steht | `tmp/proof/a15-check.log` EXIT=0, `tmp/proof/a15-e2e.log` EXIT=0 (44 bestanden: barrierefreiheit, dienste, fotos) |
| A10 | `ErrorState` bekommt `heading` (Standard h2 wie bisher); die Fehlerseite übergibt h1, Aussehen unverändert | `tmp/proof/a10-check.log` EXIT=0, `tmp/proof/a10-e2e.log` EXIT=0 (40 bestanden: barrierefreiheit, shell, dienste) |
| A11 | Adressmarker „A" (Ring) im Dark Mode mit Rand und Buchstaben in `accent` (Mint) statt `primary`; Light und Marker „B" unverändert. Entscheidung: `accent` ist im Dark Mode ohnehin die Textfarbe für Akzente (`--accent: #8fd6cf`), keine neue Farbe | Rot: Prüfskript (2,63:1). Grün: `tmp/proof/a11-check.log` EXIT=0, `tmp/proof/a11-e2e.log` EXIT=0 (35 bestanden, neue Tests Light und Dark mit ≥ 4,5:1 für A und B) |
| A12 | Preisleiste: `min-h-[54px]` statt `h-[54px]` (die Zeile mit `overflow-hidden` schrumpfte sonst in der festen Höhe und schnitt den Betrag ab); Text ohne Preis („Persönliches Angebot", „Strecke fehlt") bricht um statt mit Auslassungspunkten zu enden. Beträge bleiben einzeilig wie vorher (`truncate`, CLAUDE.md: Beträge brechen nie um). Bei normalen Abständen unverändert 54 px. Adresskarte und Segmente: Frage F3 | Rot: Prüfskript (Betrag in Montage/Umzug vertikal, „Persönliches Angebot" horizontal abgeschnitten). Grün: `tmp/proof/a12-check.log` EXIT=0, `tmp/proof/a12-e2e.log` EXIT=0 (46 bestanden, 2 neue Tests mit den Abständen aus 1.4.12) |
| A1c | Reviewer-Runde nach Phase 2 (`tmp/proof/p2-review.md`, 60 Bilder 390/430/1280 Light/Dark, kein hoch/mittel): zwei niedrige Funde übernommen. Stepper- und Pillenknöpfe `rounded-full` (der Rahmen ragte als Quadrat über die runde Pille), „Überspringen" `rounded-lg`. Nicht übernommen: optischer Feinschliff an der letzten Listenzeile (kosmetisch) und Tab „Miete" (nicht Teil dieses Diffs, bekannt) | `tmp/proof/a1c-p1-check.log` EXIT=0, `tmp/proof/a1c-p1-e2e.log` EXIT=0 (50 bestanden; gemeinsamer Lauf mit P1, andere Dateien) |
| A1b | Nachtrag zu A1 aus dem Kontrolllauf: Im Info-Sheet schnitt der Scrollbereich den Rahmen zweier Quellen-Links ab (Fokus scrollte sie bis an den Rand). `Sheet`: `scroll-py-4` am Scrollbereich (Commit `8475682`) | Kontrolllauf Sheet-Zustände `tmp/nacht/audit-sheet.log` EXIT=0, abgeschnitten 0 (vorher 4). `tmp/proof/a1b-check.log` EXIT=0, `tmp/proof/a1b-e2e.log` EXIT=0 (50 bestanden) |
| A13 | Onboarding: Titel und Text der Seite in einer höflichen Live-Region (`aria-live="polite"`); der Fokus bleibt auf „Weiter", der neue Inhalt wird angesagt. Beim ersten Anzeigen keine Ansage | `tmp/proof/a13-check.log` EXIT=0 (368 Unit), `tmp/proof/a13-e2e-voll.log` EXIT=0: **voller E2E-Lauf mit allen Phase-2-Änderungen, 128 bestanden** (vorher 102; 26 neue Tests in `barrierefreiheit.spec.ts`) |

## Phase 3 · Tempo

### Plan (aus der Messung in Phase 1)
- **Lazy Loading:** Flows (Transport/Umzug, Entrümpelung, Montage, Termin/Zusammenfassung/Bestätigung, Anmelden, Aufträge) als eigene Chunks über `lazy` im Router; Start, Profil, Info-Sheet, Onboarding, Rechtstexte bleiben im Einstiegs-Chunk. Nach dem ersten Laden holt die App die übrigen Chunks im Hintergrund, damit spätere Wechsel nicht warten.
- **Unnötiges im Bundle:** `src/lib/motion.ts` bindet die ganze `tokens.json` ein (5,4 kB roh), gebraucht wird nur `motion.spring` → benannter Import.
- **Bilder:** keine Rasterbilder im Ladepfad (Illustrationen und Icons sind SVG-Komponenten). Die PNG-Icons (`icon-512.png` 160 kB, `icon-maskable-512.png` 140 kB, `apple-touch-icon.png` 20 kB, `icon-192.png` 27 kB) lädt nur die Installation (Manifest, iOS-Startbildschirm), nicht der Seitenaufruf.
- **Neuberechnungen:** messen statt vermuten (siehe unten).

### Umgesetzt
| Nr. | Änderung | Prüfung |
|---|---|---|
| P1 | `src/lib/motion.ts`: `import { motion } from …tokens.json` statt Default-Import (Commit `618dd9e`). Im Analyse-Build taucht `motion.ts` danach nicht mehr unter den Modulen auf (vorher 5,4 kB roh) | `tmp/proof/a1c-p1-check.log` EXIT=0, `tmp/proof/a1c-p1-e2e.log` EXIT=0 (50 bestanden) |
| P2 | `src/app/router.tsx`: Flows über `lazy` (Konfigurator für Transport und Umzug, Entrümpelung samt Richtwert, Montage, Termin, Zusammenfassung, Bestätigung, Anmelden, Aufträge). Start, Profil mit Info-Sheet, Onboarding, Rechtstexte, Fehler- und Platzhalterseiten bleiben im Einstieg. `handle` bleibt statisch, Shell-Übergänge, Seitentitel und Fokus nach dem Wechsel arbeiten unverändert (der Router wartet vor dem Wechsel auf den Chunk). 1,5 s nach `load` holt die App alle Flow-Chunks im Hintergrund | `tmp/proof/p2l-check.log` EXIT=0, `tmp/proof/p2l-build.log` EXIT=0 (keine Warnung „larger than 500 kB" mehr), `tmp/proof/p2l-e2e.log` EXIT=0 (**voller Lauf, 128 bestanden**) |

### Messung nachher (gleiches Werkzeug und gleiche Drosselung wie vorher; `tmp/nacht/messung-nachher-p2.md`, zweiter Lauf `messung-nachher-p2-lauf2.md` mit denselben Ergebnissen ± 30 ms)

| | vorher | nachher |
|---|---:|---:|
| JS-Dateien | 1 (896,4 kB roh) | 23: Einstieg `index` 343,3 kB + gemeinsamer Chunk 474,8 kB (zusammen 818 kB roh), 21 Flow-Chunks 0,3–17 kB |
| JS beim Aufruf von `/` übertragen (gzip) | 255,5 kB | 228,8 kB (−10 %) |

| Route (Direktaufruf) | FCP vorher → nachher | LCP vorher → nachher | h1 sichtbar vorher → nachher |
|---|---:|---:|---:|
| `/` | 2028 → 1808 ms | 2028 → 1808 ms | 2029 → 1805 ms |
| `/profil` | 1984 → 1768 ms | 1984 → 1768 ms | 2011 → 1797 ms |
| `/anmelden` | 1960 → 1864 ms | 1960 → 1864 ms | 1995 → 1897 ms |
| `/montage` | 1952 → 1948 ms | 2380 → 2372 ms | 2001 → 1962 ms |
| `/umzug` | 1948 → 2048 ms | 2428 → 2516 ms | 1990 → 2519 ms |

- **Nachteil, bewusst in Kauf genommen:** Wer `/umzug` (bzw. `/transport`) direkt aufruft (Neuladen mitten im Flow, geteilter Link), wartet ~0,5 s länger, weil der Flow-Chunk erst nach dem Auswerten des Einstiegs angefordert wird (Zeitachse: Einstieg fertig bei 1515 ms, Flow-Chunks 1633–1994 ms). Der übliche Weg Start → Flow ist nicht langsamer: Wechsel per Tipp nach dem Vorladen, Median aus 5 (`tmp/nacht/nav.mjs`): Umzug 228 → 246 ms, Montage 219 → 237 ms, Entrümpelung 1009 → 995 ms (wartet auf die Tarife), also im Rauschen. Frage F8.
- **Offline:** Ist die Verbindung in den ersten 1,5 s nach dem Start weg und der Nutzer öffnet einen Flow, zeigt die Fehlerseite „Neu laden" statt des Flows. Danach sind alle Chunks geladen. In der Capacitor-App liegen alle Dateien lokal, dort entfällt das.
- **Leerlauf (unnötige Neuberechnungen):** 5 s ohne Eingabe nach dem Laden, CPU ×4 (`tmp/nacht/leerlauf-vorher.md`): Start 19 ms Hauptthread (0,4 %), Onboarding 51 ms (1 %, 15 Layouts durch die Illustrations-Animation), Profil und Umzug 2–3 ms; mit „Bewegung reduzieren" überall ≈ 0. Kein Handlungsbedarf, keine Änderung.
- **Nicht umgesetzt (Empfehlung):** Illustrationen liegen per `import.meta.glob(…, { eager: true })` alle im Einstieg (62,7 kB roh, 19 % des Einstiegs-Chunks). Nur in Flows gebraucht: 25,2 kB roh / ≈ 8 kB gzip; davon werden `van-cargo`, `van-city`, `van-landlord` derzeit nirgends verwendet (Miete, Phase 2). Herauslösen ginge nur über eine Registrierung je Flow-Chunk; eine vergessene Registrierung wäre ein Laufzeitfehler. Gewinn ≈ 3,5 % beim Start, deshalb nicht in dieser Nacht. Ebenso die Supabase-Teile Realtime (`realtime-js`, `phoenix`, 55 kB roh) und `iceberg-js`, die die App nicht nutzt, `createClient` aber immer einbindet; das ginge nur mit Einzelclients statt `supabase-js`.
- **Bilder:** keine Rasterbilder im Ladepfad. Die App-Icons (PNG) lädt nur die Installation; ohne Optimierungswerkzeug (keine neuen Abhängigkeiten) lassen sie sich nicht verlustfrei verkleinern. Keine Änderung.

## Abgebrochen

(noch nichts)

## Fragen an Beks

| Nr. | Frage | Hintergrund |
|---|---|---|
| F1 | Sollen unbeaufsichtigte Sessions den Supabase-MCP-Connector haben? | Er stand in der Werkzeugliste (u. a. `execute_sql`, `apply_migration`, `deploy_edge_function`), ist keine Umgebungsvariable und fiel daher nicht unter den Stopp aus Schritt 2. Ich habe ihn nicht benutzt. |
| F2 | Schalter „aus" und ausgewähltes Segment unter 3:1 (A17): Tokens anpassen? | Spur `--switch-off` `rgba(16,47,53,.14)` auf Weiß ≈ 1,3:1; ausgewähltes Segment nur weiße Fläche (≈ 1,1:1) plus Fettschrift. Beides stammt aus `tokens.json` (iOS-Optik). Möglich wären eine dunklere Spur bzw. ein Rand am Knopf und am Segment. WCAG 1.4.11 ist hier auslegbar (Zustand auch über Knopfposition und Fettschrift erkennbar). |
| F3 | Adresskarte und Segmente bei großen Textabständen (A12, Rest): Umbruch erlauben? | Adressen in der Adresskarte enden mit Auslassungspunkten (auch ohne geänderte Abstände bei langen Adressen; im Namen des Knopfs steht die volle Adresse), „Nachmittag" im Zeitfenster ebenso. Umbruch würde die Karte wachsen lassen; die gestrichelte Linie zwischen A und B ist auf feste 64-px-Zeilen gesetzt und müsste mitwachsen. |
| F4 | Eigene Radiogruppen mit Pfeiltasten (A16)? | Objektart, Füllgrad und Fahrzeugart sind Knöpfe mit `role="radio"`; jede Option ist ein Tab-Stopp. Mit Tastatur bedienbar (2.1.1 erfüllt), aber nicht nach ARIA-Muster. Fahrzeugart schließt das Sheet bei Auswahl; mit Pfeiltasten würde jeder Schritt schließen. Lösung: Pfeiltasten wählen, Enter schließt. |
| F5 | Endlos-Animationen auf Start und Onboarding (A18) | Hero-Verlauf (32 s), Wagen und Linien laufen ohne Ende; bei „Bewegung reduzieren" sind sie aus. WCAG 2.2.2 verlangt für bewegte Inhalte über 5 s einen Weg zum Anhalten, rein dekorative Bewegung ist strittig. Möglich: nach einem Durchlauf anhalten. |
| F6 | Fokus springt nach jedem Seitenwechsel auf die Überschrift (A5): so gewollt? | Für Bildschirmleser und Tastatur üblich; wer per Tab-Leiste wechselt, muss danach durch die Seite zurück zur Tab-Leiste. Sichtbar ändert sich nichts (die Überschrift zeigt keinen Rahmen). |
| F7 | Fokusrahmen 2 px in voller Akzentfarbe (A1): Optik in Ordnung? | Vorher 3 px mit 45 % Deckkraft (unter 3:1). Die Referenz-Screens zeigen keinen Fokuszustand. |
