# Review s9i-7d (R1, Bildsicht)

## Findings
- [niedrig] tests/e2e/jobs-helpers.ts (JobsState-Initialisierung, `feeExtra: 0,payoutFails`) und tests/e2e/shell.spec.ts:101 (`['/','/auftraege'`): fehlende Leerzeichen. Fix: ergänzen.
- [niedrig] tests/unit/screens.test.ts:120: rendert weiter `Folgt` unter `/miete`, obwohl die Route entfernt ist. Fix: Pfad ändern oder Zeile streichen.
- [niedrig] src/theme.css:43, :95: `--gradient-rent-card` ungenutzt. Kein Handlungsdruck (Phase 2).
- [niedrig] Shots: kein Screenshot für `suspended` (Statuskarte + Abrechnung, ohne Dokumente). Verhalten (3) ist nur per E2E belegt. Fix: Shot `partner-status-suspended` ergänzen.
- [niedrig] 390 `partner-angebot-bestaetigung.png`: unterhalb des Sheets (ab y≈1125 im Bild) ist der Inhalt nicht abgedunkelt, oben schon. Wirkt als Full-Page-Artefakt (fixiertes Overlay deckt nur den Viewport); nicht Teil dieser Änderung.

Keine hohen oder mittleren Findings.

## 1 Spec / Regeln
(1) Start-Karte und Route /miete weg (router.tsx, Start.tsx, ungenutzter Link-Import entfernt); Tab-Bar hat drei Tabs wie ui.md. (2) Label „Du erhältst“ im Angebotssheet; Test prüft `not.toContainText('voraussichtlich')`. (3) ACCESS enthält suspended; Anfragen nur active, Aufträge nur active/payment_hold, Abrechnung active/payment_hold/suspended, Dokumente nicht bei suspended; MfaGate davor. Passt zum Test. Nichts aus „Später“ gebaut.

## 2 Sicherheit
Keine neuen Tabellen, Migrationen oder Secrets. Kunden-Screens im Diff ohne Gebühr; `noFee`-Regex in auftrag-absage.spec.ts auf 8,28|60,72 umgestellt.

## 3 Geld
Nachgerechnet (Staffel v2, einmal gerundet): 68.961 ct → 6.000 + 1.896,1 = 7.896 → Auszahlung 61.065 (610,65 €) ok. 6.900 ct → 828 → 6.072 ok. 70.050 ct → 8.005 → 62.045 (620,45 €) ok, wie im Shot. 8.000 ct → 960 → 7.040 ok. `staffelFee` steht nur in tests/e2e/backend.ts (Mock). In src/ keine Satz- oder Stufenkonstanten. Altwerte v1 (586,17 / 58,65 / 10,35 / „v1 15 %“) bleiben nur in Unit-Tests und im Journal-Mock als Fixture-Daten mit expliziter v1-Staffel, keine Rechnung. Gebühr nur im Partner-Dialog.

## 4 Tests
Neue und angepasste Tests prüfen Verhalten: Start ohne Karte, /miete → „Seite nicht gefunden“; suspended → Statuskarte, Abrechnung, keine Dokumente; Journal-Matrix je Status; Angebot ohne „voraussichtlich“; Auszahlungen aus der Staffel; payout_changed über `feeExtra`. Ausgeführt habe ich keine Tests.

## 5 Bildsicht (390 px gegen 01_Start_Light.png; 1280 Stichprobe)
| Screen | Beobachtung aus dem Bild |
|---|---|
| start light 390 | Nach der 2x2-Reihe (Unterkante y≈1405) folgt direkt der graue Fußtext „Richtpreis ohne Konto…“; die teal Mietkarte mit weißem Transporter der Referenz (y 1545–1750) fehlt wie beabsichtigt. Tab-Bar nur Start (teal), Aufträge, Profil. Illustrationen in Sofa-Beige, Karton-Braun, Container-Graugrün, Schrank-Weiß mit Teal-Bohrer wie Referenz. Abweichung zur Referenz: Ortschip „Wien, AT“ ohne Chevron und bei y≈44 statt 152 – bestand vorher, nicht Teil des Schritts. |
| start dark 390 | Hintergrund nachtblau, Kacheln dunkelgrün mit Rand, Hero-Karte Teal-Verlauf; Container gedecktes Grün, Sofa hell; Tab Start mint, Rest grau; keine Mietkarte. |
| start light 1280 | Inhalt als zentrierte Spalte (x≈625–1375 von 2000), Rand grau leer; Tab-Bar auf Spaltenbreite mit drei Einträgen; keine Mietkarte. |
| angebot-bestaetigung light 390 | Sheet „Angebot senden“: „Dein Angebot 700,50 €“ und „Du erhältst 620,45 €“ fett rechtsbündig, je eine Zeile; Label ohne „voraussichtlich“; Hinweistext grau; Button „Verbindlich senden“ Teal-Verlauf. Kein Wort Gebühr/Provision. |
| angebot-bestaetigung dark 390 | gleiche Zeilen weiß auf dunklem Sheet; Button hellteal-Verlauf; „Doch nicht“ mint; 620,45 € einzeilig. |
| absage-pauschale light 390 | Rechenkarte: 69,00 € / Gebühr 8,28 € / Du erhältst 60,72 € rechts fett, Zahl samt € einzeilig; Radio „Mit Pauschale“ teal gefüllt, „Ohne Pauschale“ leer; Button „Für 69,00 € absagen“. |
| absage-pauschale dark 390 | Radio „Mit Pauschale“ mint, „Ohne“ grauer Punkt; Karte dunkel mit Rand; Beträge weiß einzeilig; Button teal. |
| absage-pauschale dark 1280 | Sheet in zentrierter Spalte (x≈500–1180 von 1680); 69,00 / 8,28 / 60,72 einzeilig, Radio mint; Abrechnung und Dokumente darunter in derselben Spalte. |
| absage-karte-mit-pauschale light 390 | Karte „Umzug, Bezirk 3“, graues Badge „Von dir storniert“, „Pauschale 69,00 €“ und „Du erhältst 60,72 €“ fett rechts; darunter Kontaktknopf; Abrechnung und Dokumente folgen. |
| absage-karte-mit-pauschale dark 390 | gleiche Werte weiß auf dunklen Karten; Badge grau auf dunkel; Journal-Knopf mint auf dunkelgrün. |
| abrechnung light 390 | Statuskarte mit dunkelteal Badge „Aktiv“; Auftragskarte „Preis für den Kunden 689,61 €“ und „Du erhältst 610,65 €“ einzeilig; „Auftrag starten“ ausgegraut; Karte „Abrechnung“ mit Monatsfeld „November 2026“ und Knopf „Journal herunterladen“. |
| abrechnung dark 390 | gleiche Struktur; Beträge weiß; Knöpfe dunkelgrün mit mintfarbener Schrift; Dokumente-Karte darunter. |

Alle Shots zeigen Firmenstatus „Aktiv“; der suspended-Pfad ist bildlich nicht belegt. Keine Emojis, keine Platzhalter- oder Prototyptexte, keine Gebühr auf Kundenscreens. Breiten und Überlauf nicht per boundingBox gemessen; im Bild kein Hinweis darauf.
