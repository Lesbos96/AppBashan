# MoveNow · Design- und Ablauf-Briefing

> **Wie dieses Briefing gilt (vor dem Lesen beachten)**
>
> Das Briefing unten kommt aus Claude Design. Es wird **nicht in einer einzigen Session** abgearbeitet, sondern verteilt auf die Sessions in `docs/ROADMAP.md`. Stellen, die für dieses Projekt angepasst wurden, sind mit **[MoveNow]** markiert. Alles andere gilt wie geschrieben. Bei Widerspruch gilt `CLAUDE.md`.
>
> - **Plattformgebühr:** Kunden sehen die 15 % nirgends (Abschnitte 0, 5, 8). Gespeichert wird die Gebühr in eigenen Tabellen, die Kunden nicht lesen können. Ein Partner-Portal gehört nicht zu diesem Briefing; es steht unter „Später" in der ROADMAP.
> - **Pfade:** Die Referenz liegt in `docs/reference/`, die Zugangsdaten stehen in `.env.local`.

---

Du baust die echte MoveNow-App: eine Plattform für Möbeltransport, Umzug, Entrümpelung, Montage/Demontage und Transportermiete (Start Wien, Anspruch Europa). Im Ordner docs/reference/ liegt der klickbare HTML-Prototyp MoveNow_Prototyp.html. Er ist nur Referenz für Inhalt, Ablauf und Preislogik, nicht für das Design und nicht für die Seitenstruktur. Das verbindliche Design liegt im Ordner docs/reference/design/ (siehe Abschnitt 3a).

0. Das Wichtigste vorweg
Die Präsentationsseite fliegt komplett raus. Im Prototyp steht die App in einem Smartphone-Rahmen (Notch, Statusleiste, Rand, Schatten) neben einer Intro-Spalte mit Überschrift, Navigations-Buttons, Fußnote, Quellen-Box, Businessplan-Links und „Prototyp v13"-Tag. Nichts davon darf in die App. Die App ist die Seite: kein Gerätemockup, keine Intro-Spalte, keine Erklärtexte drumherum, kein „Konzeptdemo"-Hinweis.
Design-Anspruch: Apple. Edel, ruhig, präzise, hochwertig. Es soll sich anfühlen wie eine native iOS-App von Apple selbst, nicht wie eine Website im Handyformat.
Grafiken statt Emojis und Platzhalter. Eigene, hochwertige SVG-Illustrationen und ein konsistentes Icon-Set (siehe Abschnitt 3).
Die Plattformgebühr von 15 % wird in der App nirgends erwähnt. Sie steht nur auf der Rechnung und in der Beispielabrechnung im Vermieterbereich (siehe Abschnitt 8).
Das Design ist bereits fertig gestaltet. docs/reference/design/ (Screens, Quelltext, Tokens) ist die verbindliche Vorlage, siehe Abschnitt 3a. Setze sie um, statt neu zu entwerfen.
Nutze den frontend-design-Skill (Anthropic-Designguidance für markante, bewusste Gestaltung ohne Template-Look). Lies ihn, bevor du die erste Oberfläche baust, und nutze ihn für alle Zustände, die die Design-Referenz nicht zeigt. Rangfolge bei Konflikten: zuerst die Design-Referenz, dann der Apple-Look aus Abschnitt 3, dann der Skill.
1. Rollen und Modelle
[MoveNow] Ersetzt durch `CLAUDE.md`: Die Hauptsession läuft mit Sonnet 5.5 (Effort medium), Opus 5.5 nur in S1 und auf ausdrückliche Anfrage. Haiku 5.5 übernimmt Suche (`Explore`), Prüfläufe und Screenshots (`test-runner`) und mechanische Arbeit wie die Farbumstellung der SVGs (`mech-editor`); Sonnet 5.5 prüft als `reviewer`. Nur ein editierender Agent zur selben Zeit. Jede Delegation bekommt einen vollständigen Auftrag mit Dateipfaden, Akzeptanzkriterien und den passenden Referenz-Screens aus docs/reference/design/screens/.
2. Technik

Entscheide dich begründet und kurz im Plan für diesen Stack (Abweichung nur mit guter Begründung):

Vite + React + TypeScript, Tailwind CSS mit eigenen Design-Tokens (CSS-Variablen), Framer Motion (oder Motion) für Federanimationen und Übergänge, React Router mit Seitenübergängen im iOS-Stil.
Mobile-first PWA (Manifest, Icons, theme-color, viewport-fit=cover, Safe-Area-Insets, Installierbarkeit). Später soll sich die App per Capacitor in den App Store bringen lassen. Baue daher nichts, was nativ nicht funktioniert.
Supabase als Backend (Postgres, Auth, Storage, Edge Functions). Siehe Abschnitt 6.
Vitest für die Preislogik, Playwright für Screenshots und End-to-End-Checks.

Layoutverhalten:

Auf dem Handy füllt die App den ganzen Bildschirm (100dvh, kein Rahmen, keine Ränder).
Ab Tablet-/Desktopbreite: kein Gerätemockup. Der Inhalt wird als saubere, zentrierte Spalte (max. ca. 520 px) auf ruhigem, hellem bzw. dunklem Hintergrund dargestellt, mit denselben Komponenten. Kein Text oder Dekor links und rechts davon. Optional ab 1024 px ein adaptives Zwei-Spalten-Layout (Navigation links, Inhalt rechts), aber nur wenn es wirklich elegant wirkt.
3. Designsprache: „Apple-Niveau"

Grundhaltung: Weniger, aber besser. Viel Weißraum, klare Hierarchie, ein Fokus pro Screen, nichts Dekoratives ohne Funktion.

Typografie

Systemschrift: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif. Kein Webfont-Zwang; Inter nur als Fallback für Nicht-Apple-Geräte.
Große Titel (Large Title, ca. 34 px, Gewicht 700, Tracking leicht negativ), Section-Header in kleinen Versalien nur sparsam, Fließtext 15–17 px, Zeilenhöhe großzügig. Tabellarische Ziffern (font-variant-numeric: tabular-nums) bei allen Preisen.
Der Large Title schrumpft beim Scrollen in die Navigationsleiste (wie iOS).

Farben (bestehende Markenidentität behalten, aber veredeln)

Primär: tiefes Petrol/Teal, ausgehend von 
#075C61, mit Abstufungen 
#03464B, 
#073E46, 
#102F35. Dazu eine Akzentfarbe für Highlights (z. B. ein feines Mint 
#8FD6CF oder warmes Champagner 
#E9DFC9), sparsam eingesetzt.
Neutrale Flächen: iOS-Systemgrau-Logik (
#F2F4F4 Hintergrund, Weiß für Karten, 1-px-Haarlinien in rgba(16,47,53,.08)).
Vollständiger Dark Mode (prefers-color-scheme) mit eigenen, sorgfältig abgestimmten Tokens, keine bloße Invertierung. Elevation im Dark Mode über hellere Flächen statt Schatten.
Kontraste mindestens WCAG AA.

Materialien und Tiefe

Echte Glas-Optik: Navigationsleiste, Tab-Bar und Sheets mit backdrop-filter: blur(24px) saturate(180%) und halbtransparenter Fläche. Inhalt scheint beim Scrollen dezent durch.
Weiche, mehrschichtige Schatten (zwei bis drei Ebenen, sehr geringe Deckkraft), keine harten Rahmen.
Kontinuierliche Eckenrundung (Apple „Squircle"-Anmutung): Karten 20–24 px, Buttons 14–16 px, Sheets oben 28–32 px. Wo möglich corner-shape: squircle bzw. SVG-/Clip-Path-Fallback.

Komponenten (iOS-Muster statt Web-Muster)

Tab-Bar unten (Start · Miete · Aufträge · Profil) mit Glas-Hintergrund, Safe-Area-Abstand, aktivem Zustand über gefülltes Icon plus Farbe.
Bottom Sheets mit Griff, Detents (halb/voll), Drag-to-Dismiss und Hintergrund-Dimmen, für Auswahl, Datum, Details und „Wie rechnet MoveNow?".
Inset Grouped Lists (gruppierte Listen mit Trennlinien) für Einstellungen, Zusammenfassung und Preispositionen.
Segmented Controls statt Dropdowns, wo es 2–4 Optionen gibt. Native-ähnliche Stepper für Mengen, native <input type="date"> bzw. ein eigener Datumswähler im iOS-Stil.
Primärbutton: volle Breite, 54 px hoch, Teal-Gradient, weicher Schatten, Press-Effekt (Scale 0.98 mit Feder). Sekundärbuttons als „tinted"/„plain".
Haptik-Anmutung: kurze Scale- und Opacity-Reaktionen bei jedem Tap; navigator.vibrate nur dezent und nur wo verfügbar.
Mindestgröße aller Touch-Ziele 44 × 44 px.

Bewegung

Federanimationen (stiffness ~300, damping ~30) statt linearer Easings. Seitenwechsel als Push/Pop mit leichtem Parallax, Sheets mit Drag-Physik.
Gestaffeltes Einblenden von Listen (30–50 ms Versatz), Preis-Zähler, die beim Ändern sanft hochzählen, Fortschrittsbalken mit Feder.
Respektiere prefers-reduced-motion (dann nur Fades).
Keine Animation darf die Eingabe blockieren oder ruckeln. Ziel: 60 fps auf einem mittleren Android-Gerät.

Grafiken und Illustrationen (hier soll es hochwertig wirken)

Keine Emojis, keine Stockfoto-Platzhalter, keine kaputten Bilder.
Eigenes Icon-Set als SVG-Komponenten (konsistent: 24-px-Raster, 1.6-px-Strich, runde Enden, passend zu SF Symbols in Stil und Gewicht; in „Outline" und „Filled" für aktive Zustände). SF Symbols selbst dürfen nicht verwendet werden, zeichne ähnliche eigene.
Hero-Illustrationen für Start und die vier Services: reduzierte, elegante Vektorszenen in natürlichen Materialfarben (Kraftkarton, Eiche, Stoff, weißer Lack, weißer Transporter mit Spiegel, Felgen und Firmenbeschriftung), Teal nur als Marken-Akzent. Realistische Proportionen und Details, weiche Kontaktschatten. Keine einfarbigen Teal-Grafiken, keine Fantasie-Objekte, keine Cartoon- oder generische KI-Optik. Vorlage sind die Illustrationen in docs/reference/design/.
Hintergründe: ruhige Mesh-Gradients in Teal (bewusst dunkel und tief) mit leichter Körnung, im Hero der Startseite sehr langsam bewegt.
Routen-Grafik: eine animierte, feine Linie von A nach B mit Punkten und Entfernungsangabe bei der Streckenberechnung (SVG-Pfad mit stroke-dashoffset-Animation). Auf einer echten Karte nur, wenn sie sauber eingebunden und stilistisch passend ist (dezentes, entsättigtes Kartenthema, kein knallbuntes Standard-Tile).
Leere Zustände („Noch keine Aufträge") mit kleiner, liebevoller Illustration statt nacktem Text.
App-Icon, Splash-Screen und Favicon in allen nötigen Größen als hochwertiges Logo (das ↗-Zeichen aus dem Prototyp veredelt, im Teal-Gradient mit feinem Innenlicht).
Alle Grafiken in Light und Dark Mode stimmig, SVG sauber optimiert (SVGO), keine Rasterbilder, wo Vektor reicht.

Tonalität der Texte: deutsch, ruhig, präzise, per Du, kurz. Keine Marketing-Floskeln, keine Ausrufezeichen-Flut. Rechtliche und methodische Hinweise gehören in Info-Sheets, nicht in den Hauptfluss.

3a. Design-Referenz (verbindlich)

Unter docs/reference/design/ liegt das fertige Design der App:

screens/*.png: So soll es aussehen. 19 Screens, 390 px breit, 2-fache Auflösung, lange Screens in voller Scroll-Länge. 00_Fundament zeigt App-Icon, Farben, Typo, Icon-Set und Komponenten.
html/*.html: Quelltext jedes Screens mit den exakten Werten und allen Icons und Illustrationen als SVG. Im Browser ansehen, die Screens sind untereinander verlinkt.
tokens.json: Farben Light/Dark, Radien, Schatten, Typo-Skala, Layout-Maße, Bewegung.
README.md: Screen-Liste, Regeln und fünf nachgerechnete Preisbeispiele als Testfälle.

So arbeitest du damit:

Werte übernehmen statt schätzen. tokens.json wird zu CSS-Variablen und zum Tailwind-Theme. Inline-Styles aus den HTML-Dateien nicht kopieren, sondern als Komponenten mit Tokens nachbauen.
Icons und Illustrationen als SVG-Komponenten extrahieren: Pfade unverändert, Farben über Tokens, damit Light und Dark funktionieren. Die Dark-Varianten der Service-Illustrationen stehen in 02_Start_Dark.html. App-Icon, Favicon und Splash aus 00_Fundament ableiten.
Adressen, Daten, Fahrzeuge und Preise in den Screens sind Beispieldaten. Echte Werte kommen aus der Preislogik und aus Supabase. Die Foto-Kacheln sind Platzhalter für echte Nutzerfotos.
Dark Mode ist für Start und Tokens ausgearbeitet. Alle anderen Screens nach demselben Muster ableiten.
Nicht gestaltete Zustände (Onboarding-Seiten 2 und 3, übrige Wizard-Schritte, Standardmöbel-Montage, Zeitfenster bei Entrümpelung und Montage, „Persönliches Angebot", Fehler, Laden, offline) im selben Stil ergänzen.
Rangfolge bei Konflikten: Für die Optik gilt die Referenz vor Abschnitt 3. Für Inhalt und Ablauf gilt dieses Briefing, für Preise der Prototyp-Code (Abschnitt 5). Was ein statischer Screen nicht zeigen kann (schrumpfender Large Title, Sheet-Detents, Drag-to-Dismiss, Animationen), baust du trotzdem nach Abschnitt 3.

4. Screens und Ablauf

Übernimm Inhalt und Logik des Prototyps und setze die Screens so um, wie sie in docs/reference/design/ gestaltet sind. Wo die Referenz einen Zustand nicht zeigt, gestalte ihn im selben Stil:

Start: Large Title, Hero mit Illustration („Mehr bewegen. Weniger Aufwand."), vier Service-Karten (Möbeltransport, Umzug, Entrümpelung, Montage & Demontage), prominente Karte „Transporter mieten". Region „Wien, AT" dezent in der Navigationsleiste.
Möbeltransport und Umzug (Konfigurator): Transportgut (Möbel/Kartons, Klavier, Flügel, Tresor), Beschreibung, Volumen, Fotos (Kamera und Galerie, bis zu 8 Fotos à 10 MB, Vorschau, Entfernen), Team und Fahrzeuge, Stockwerke und Lift, Dauer, Adressen mit automatischer Streckenberechnung, Zusatzleistungen (Montage, Kartons, Halteverbot, Einpackservice). Live-Preis als fixierte Preiskarte am unteren Rand, die beim Ändern sanft aktualisiert und per Tap als Sheet mit allen Positionen aufklappt.
Entrümpelung: Der 6-Schritte-Wizard aus dem Prototyp (Objektart → Fläche → Füllgrad → Zugang → Zusatz → Fotos → Ergebnis) mit großem, ruhigem Fortschrittsindikator, je einer Frage pro Screen. Sonderfälle (Gewerbe, stark belastete Räume, besondere Abfälle) führen zu „Besichtigung anfragen" statt Pauschalpreis.
Montage & Demontage: Standardmöbel nach Laufmetern, Küchen nach Unter-/Ober-/Hochschränken.
Transporter mieten: Fahrzeugkarten (Illustration, m³, Tagespreis, Freikilometer), Zeitraum, Kilometer, Rückgabeort, Schutzpaket, Zusatzfahrer, Preisaufschlüsselung, Kaution separat ausgewiesen.
Vermieterbereich: Fahrzeuge und Tarife anlegen und bearbeiten (alle Felder aus offerFields im Prototyp), mit Beispielabrechnung und Plattformgebühr. Erreichbar über Profil → „Für Vermieter", nicht als lose Textlink-Ecke.
Ort & Termin → Zusammenfassung → Bestätigung: Zusammenfassung als gruppierte Liste, Preiskarte, Einwilligung, großer Erfolgsscreen mit animiertem Häkchen.
Aufträge: Liste der Anfragen mit Status-Chips; Detailansicht mit Timeline.
Profil: Konto, Einstellungen, „Wie rechnet MoveNow?" (hier landet die komplette Wiener Preisbasis mit Quellenlinks aus der Quellen-Box des Prototyps, als sauberes Info-Sheet, nicht mehr auf der Startseite, ohne die Plattformgebühr), Datenschutz, Impressum/AGB als Platzhalter.

Onboarding: maximal 2–3 elegante Screens beim ersten Start oder direkt Start ohne Hürde. Kein Zwang zur Registrierung, bevor ein Preis angezeigt wird. Konto erst bei Absenden einer Anfrage.

5. Preislogik: exakt portieren, testen, nicht verändern

Extrahiere die Berechnung aus dem Prototyp in ein reines, UI-freies TypeScript-Modul ([MoveNow] `supabase/functions/_shared/pricing/`, in der App über den Alias `@pricing`) mit Vitest-Tests für jede Formel und jeden Randfall. Relevante Regeln (im Prototyp nachprüfen, bei Abweichung gilt der Prototypcode, und melde mir die Abweichung):

Teamstundensatz brutto: 1 Person 48 €, 2 Personen 55,75 €, 3 Personen 70,80 €, 4 Personen 100,80 €, jede weitere Person +24 €; jedes Zusatzfahrzeug +18 €/h. Mindestdauer: Transport 2 h, Umzug 3 h.
Österreich außerhalb Wiens: Fernfahrzeit × Stundensatz + außerhalb gefahrene km × 1,08 € × Fahrzeuge. Umzug über Landesgrenze: kein Pauschalpreis, „Persönliches Angebot".
Montage Standardmöbel: 47,87 € je Laufmeter, mindestens 2 lfm; Küche: 72 € Basis + 144 €/lfm unten + 48 €/lfm oben + 204 €/lfm Hochschrank.
Kartons 3,60 € je Stück, Halteverbotszone 120 € je Adresse.
Entrümpelung: 75 €/m³ (Spanne 60–100), Mindestpreis 180 €, Etagenzuschlag ohne Lift 25 € je Etage ab dem 2. Stock, Fläche → Volumen mit Faktoren 0,12 / 0,25 / 0,45 m³ je m².
„Persönliches Angebot" statt Preis bei: Spezialgut (Klavier, Flügel, Tresor), Groß-LKW, Einpackservice, mehr Fahrzeuge als Personen, internationale Umzüge, Gewerbe, stark belastete Räume, besondere Abfälle, ungeprüfte Route.
Plattformgebühr: 15 % vom Gesamtpreis, inkl. USt.; Aufteilung netto/USt. (20 %) und Betrag an den Leistungspartner gemäß platform(); Cent-Rundung wie cents(). Die Berechnung bleibt im Modul und im Preis-Snapshot, angezeigt wird sie nur auf der Rechnung und in der Vermieter-Abrechnung. Die Gebührenhinweise des Prototyps (feeHTML) werden nicht übernommen. [MoveNow] Gebührenaufteilung und Gebührensatz liegen in eigenen Tabellen, die Kunden nicht lesen können, nicht im Kunden-Snapshot.
Miete: 24-Stunden-Tage aufgerundet, Freikilometer je Tag, Mehrkilometer, Schutzpaket und Zusatzfahrer pro Tag, Einweg- und Bereitstellungsgebühr einmalig, Kaution separat und erstattbar.

Dokumentiere in einem kurzen docs/PRICING.md, welche Werte Stichproben-Richtwerte sind, damit sie später über Supabase konfigurierbar werden.

Routenberechnung: Der Prototyp nutzt die öffentlichen Demo-Dienste Nominatim und OSRM direkt aus dem Browser. Diese sind für Produktivbetrieb nicht geeignet (Nutzungsbedingungen, Rate-Limits, keine Autocomplete-Abfragen). Lege deshalb eine Supabase Edge Function als Proxy mit Caching und Rate-Limiting an, kapsle den Geocoding-/Routing-Anbieter hinter einem Interface (leicht austauschbar) und behalte die Einwilligungsabfrage, die Adressbestätigung durch den Nutzer und die Wien-Stadtgrenzen-Logik (Außer-Wien-Anteil) bei. Keine geschätzten Kilometer, wenn die Route nicht berechnet werden konnte.

6. Supabase
Schema und Migrationen unter /supabase/migrations/: profiles, service_requests (Typ, Status, Konfiguration als JSONB, Preisberechnung als JSONB-Snapshot, Adressen, Termin), request_photos (Storage-Bucket, privat), rental_offers (Vermieter-Tarife), rental_bookings, price_config (versionierte Tarifwerte). [MoveNow] Die Tabellennamen gelten wie hier. Ergänzt werden platform_settings (Gebührensatz, für Kunden nicht lesbar), fee_splits (Gebührenaufteilung, für Kunden nicht lesbar) und geo_boundaries (Wiener Stadtgrenze). Das Schema im Detail steht in docs/ARCHITECTURE.md.
Row Level Security auf jeder Tabelle, Policies so eng wie möglich (Nutzer sehen nur eigene Anfragen, Vermieter nur eigene Angebote). Schreibe Tests oder zumindest SQL-Prüfungen für die Policies.
Auth: E-Mail-Magic-Link, vorbereitet für „Mit Apple anmelden". Konto erst beim Absenden. [MoveNow] Dieselbe Mail enthält zusätzlich einen Code, den man in der App eingeben kann. Das ist der Ausweichweg für die spätere Capacitor-App, falls der Link dort nicht direkt in die App führt.
Keine echten Zahlungen in dieser Phase. Anfragen werden als „angefragt" gespeichert, die UI sagt klar, dass der Partner bestätigt. Der Preis in der Anfrage ist ein Snapshot mit Versionsnummer der Tarife.
Secrets nie im Frontend. [MoveNow] .env.example und .gitignore liegen bereits im Projekt; die Werte stehen in .env.local.
7. Arbeitsweise: Loops mit Prüfung, nicht „einmal bauen"

Schritt A: Plan. [MoveNow] Ersetzt durch S1 in docs/ROADMAP.md, Ergebnis ist docs/ARCHITECTURE.md statt PLAN.md. Große Referenzdateien werden nicht komplett gelesen; `Explore` holt die nötigen Stellen.

Schritt B: Fundament. [MoveNow] Verteilt auf S1 (Projekt-Setup), S3a (Tokens, Icons, Illustrationen), S3b (Basiskomponenten) und S4 (App-Shell ohne Prototyp-Wrapper).

Schritt C: Feature-Loop, pro Screen und Service ([MoveNow] innerhalb der jeweiligen Session aus docs/ROADMAP.md):

Bauen ([MoveNow] in der Hauptsession, mechanische Teile über `mech-editor`).
Prüfen ([MoveNow] über `test-runner`): in jeder Loop-Runde Screenshots bei 390×844 in Light und Dark; vor dem Commit der Session einmal bei 390×844, 430×932, 768×1024 und 1280×800, jeweils Light und Dark; Konsole auf Fehler prüfen; Tastatur- und Touch-Bedienung per E2E-Test durchklicken.
Bewerten ([MoveNow] durch den `reviewer`-Subagent, nicht im Hauptkontext): Leg den 390-px-Screenshot neben den passenden Referenz-Screen aus docs/reference/design/screens/ (bei langen Screens als Full-Page-Screenshot) und vergleiche Abstände, Typo, Farben, Radien, Icons und Illustrationen. Prüfe danach gegen die Checkliste in Schritt D. Benenne konkret jede Abweichung von der Referenz und alles, was nicht Apple-Niveau hat.
Fixen und zurück zu 2. Wiederhole höchstens 5 Runden pro Screen. Ist danach noch etwas rot, dokumentiere es in docs/OPEN_ISSUES.md und gehe weiter.

Schritt D: Abnahme-Checkliste (alles muss grün sein):

Kein Gerätemockup, keine Statusleisten-Attrappe, keine Intro-Spalte, kein „Prototyp"/„Konzeptdemo"-Text irgendwo (per Suche im Code und im Screenshot verifizieren).
Jeder gestaltete Screen entspricht seinem Referenz-Screen aus docs/reference/design/screens/. Bewusste Abweichungen sind in docs/OPEN_ISSUES.md begründet.
Kein Hinweis auf die 15 % Plattformgebühr außerhalb von Rechnung und Vermieter-Abrechnung (per Suche nach „15 %", „Plattformgebühr", „Provision" und „MoveNow-Gebühr" im Code und im Screenshot verifizieren).
Kein horizontales Scrollen, nichts abgeschnitten, Safe Areas korrekt (Notch, Home-Indikator), Tastatur verdeckt keine Eingabefelder.
Alle Touch-Ziele ≥ 44 px, Fokus-Ringe sichtbar, Kontrast AA, Lighthouse Accessibility ≥ 95, Performance ≥ 90 (mobil).
Light und Dark Mode vollständig und stimmig, keine harten Weißflächen im Dark Mode.
Keine Emojis, keine fehlenden Bilder, keine Platzhaltertexte wie „Lorem" oder „TODO".
Vitest: Preislogik vollständig grün, Typecheck und Lint ohne Fehler, Build erfolgreich.
Jeder Preis in der UI stimmt mit dem Modul überein (Stichproben durch einen Haiku-Subagent: 10 Szenarien per Playwright, Vergleich mit Testwerten, darunter die fünf Preisbeispiele aus docs/reference/design/README.md).
Reduced-Motion-Variante funktioniert.

Schritt E: Politur-Loop ([MoveNow] Teil von S10). Gehe die ganze App wie ein Apple-Designer durch: Abstände auf 4-/8-px-Raster, optische Ausrichtung, Typohierarchie, Animationsdauer, Konsistenz der Icons, Qualität der Illustrationen. Höchstens 3 globale Runden; eine Runde = Screenshots aller Screens → Mängelliste → Fixes.

Schritt F: Übergabe ([MoveNow] Teil von S10). README.md (Setup, Start, Tests, Supabase-Einrichtung), Screenshots aller Hauptscreens in /docs/screens/, kurze Liste der offenen Punkte.

8. Harte Regeln
Nichts aus dem Prototyp-Wrapper übernehmen (siehe Abschnitt 0).
Keine Apple-Marken, -Logos oder -Assets verwenden; nur der Stil ist Vorbild.
Die Plattformgebühr (15 %) erscheint für Kunden nirgends in der UI: nicht im Konfigurator, nicht im Preis-Sheet, nicht in Zusammenfassung, Bestätigung, Aufträgen oder Info-Sheets. Nur auf der Rechnung und in der Vermieter-Abrechnung.
Keine echten Zahlungen, keine echten Buchungsbestätigungen, keine erfundenen Verfügbarkeiten. Preise sind Richtwerte, die UI sagt das klar, aber dezent.
Bei Unklarheit zuerst entscheiden, kurz begründen und weitermachen; nur bei Entscheidungen, die sich nicht mehr rückgängig machen lassen oder Geld/Recht betreffen, nachfragen.
[MoveNow] Ein Commit mit klarer Nachricht am Ende jeder Session; danach beginnt eine neue Session (siehe CLAUDE.md).