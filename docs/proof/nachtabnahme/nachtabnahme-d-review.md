# Nachtabnahme D: Bildreview shots:all (Lauf 3)

Modus Abnahme, nur UI-Screens. Geprüft: Branch nachtabnahme, HEAD 086663f. Log: tmp/proof/nachtabnahme-d-shots-all-3.log (536 bestanden).

## Auswahlkriterium und Grenzen
- Zeitkriterium (LastWriteTime ab Logstart minus 25 min) konnte ich nicht anwenden: Mein Werkzeugrahmen erlaubt Bash nur für git, ein Dateizeit-Listing war nicht möglich. Ersatz: Die Glob-Reihenfolge nach Änderungszeit zeigt die fotos-* Dateien des Laufs zuoberst, und alle gelesenen Dateien haben die Inhalte des aktuellen Stands (3-Tab-Bar, Phase 1). Ob eine einzelne Datei älter ist, ist ungeprüft.
- Maße (Breiten, Abstände, Überlauf, Touch-Ziele) nicht gemessen; kein Playwright erlaubt. Alle Aussagen unten sind Bildbeobachtungen.
- Nicht geöffnet (ungeprüft): willkommen-*, anmelden-*, entruempelung-*, montage-*, termin-*, preise, datenschutz, impressum, Zustände zusammenfassung-fehler-*. Nur ein Teil der geänderten Screens ist damit abgedeckt.
- Geänderte Dateien seit 1630668 (git diff --stat): Shell.tsx, router.tsx, Bars.tsx, Controls.tsx, Sheet.tsx, States.tsx, Surfaces.tsx, Onboarding, Anmelden, Konfigurator, Zusammenfassung, Gesendet, Fotos, Preis, Strecke u. a. Seitenwechsel mit inert/aria-hidden und Fokus sind im Standbild nicht sichtbar (nicht beurteilbar). Ladezustände des Lazy Loading haben keinen eigenen Shot; ungeprüft.
- Nacht-Reviewer-Dateien: docs/nacht/*.md und tmp/proof/*review*.md (s8b*) beurteilen keine Screenshots der Nacht per Bildsicht. docs/nacht/e2e.md erwähnt nur Shot-Läufe (Exit-Codes), docs/nacht/open-issues.md Zeile 9 überspringt den Referenzabgleich der Umzug-Zusammenfassung ausdrücklich. Kein Abgleich möglich.

## Beobachtungen je Screen
| Screen / Größe | Bildbeobachtung | Urteil |
|---|---|---|
| start 390 light | Tab-Bar zeigt drei Einträge Start (aktiv, Teal gefüllt), Aufträge, Profil; kein Miete. Wien,AT-Chip oben rechts ohne Chevron, direkt am oberen Rand (y ca. 10 px bei Faktor 2 gegenüber ca. 118 in Ref 01) | Tab-Regel erfüllt; Abweichung Kopfabstand/Chevron (niedrig) |
| start 390 dark | Hero dunkelteal mit Route, Karten in dunklem Teal mit Rand, Möbel-Illustrationen in Holz-/Pappbraun und Beige, Lampe weiß; deckt sich mit Ref 02 bis auf Kopfabstand und fehlenden Chevron | ok |
| start 430 light | Route-Endpunkt (Ring) liegt unmittelbar am Punkt hinter „bewegen." und berührt ihn fast; im 390er Bild liegt er klar darüber | niedrig, Deko-Überlappung |
| start 1280 dark | Inhalt als zentrierte Spalte (ca. 750 px im Skalierungsbild), seitlich leerer dunkler Grund; Tab-Bar-Linie ist breiter als die Spalte (Linie reicht über Karten hinaus) | niedrig |
| miete 390 light | Seite „Transporter mieten“ mit Pappkarton-Illustration, Text „Dieser Bereich ist noch nicht verfügbar / Er kommt in einem der nächsten Schritte.“; kein Zurück-Pfeil, in der Tab-Bar ist kein Eintrag aktiv | mittel (Platzhaltertext, Sackgasse) |
| auftraege-liste 390 dark | Drei Karten, Beträge „689,61 €“ und „950 € bis 1.550 €“ in einer Zeile, Teal-Chips „Wartet auf Angebot“; rechts an den Karten fehlen die Chevrons der Ref 13; Tab Aufträge Teal gefüllt | Beträge ok; Chevron-Abweichung niedrig |
| auftraege 1280 light | Leerzustand: Karton-Illustration in Pappfarben mit Teal-Pin, „Noch keine Aufträge“, Button „Service wählen“; Tab Aufträge hervorgehoben; Titel linksbündig an der Spaltenkante (x ca. 625 von 2000) | ok |
| profil 390 light | Karten mit Avatar „Noch kein Konto“, Teal-Button, Zeilen Darstellung/Region ohne Chevron (Ref 16 hat Chevrons), Zeile Mitteilungen fehlt, Text „Version 0.1.0“; keine Gebühr, kein 15 % | niedrig, Phase-1-Auslassungen ok |
| transport-fotos 390 light | „Fotos 8 von 8“, acht gleich braune Fixture-Kacheln mit schwarzem x, Kamera/Galerie-Kacheln blass grau; Fußleiste „Noch kein Richtpreis / Strecke fehlt“, Weiter-Button blass Teal (deaktiviert) | ok |
| fotos-typ-abgelehnt 430 dark | Roter Hinweis unter dem Fotofeld: „HEIC-Fotos gehen hier nicht. Stelle die Kamera auf „Maximale Kompatibilität“ oder wähle ein JPEG, PNG oder WebP.“, lesbar auf dunklem Grund, zwei Kacheln, Zähler „2 von 8“ | ok (HEIC-Hinweis sichtbar) |
| zusammenfassung-umzug 430 light | „Richtpreis 689,61 €“ fett in einer Zeile mit Zusatz „Inklusive 20 % USt.“; Stornotext nennt nur 50 %/100 % und „Anfahrtspauschale: 69,00 €“, keine MoveNow-Gebühr; Teal-Button „Anfrage senden“ in fixierter Leiste, Tab-Bar ausgeblendet | ok |
| gesendet-umzug 390 dark | Teal-Kreis mit Haken, „Anfrage gesendet.“, Karte mit Chip „Angefragt“ (beige auf dunkel) und „Richtpreis 689,61 €“ in Mint, Buttons „Zu meinen Aufträgen“ und „Zur Startseite“; keine Tab-Bar | ok |

## Findings
- [mittel] Screen miete (390/430/1280) und Start-Karte „Transporter mieten“ – Karte führt in eine Seite mit Platzhaltertext „Dieser Bereich ist noch nicht verfügbar … nächsten Schritte“, ohne Zurück und ohne aktiven Tab (Verstoß gegen „keine Platzhaltertexte“). Fix: Start-Karte in Phase 1 ausblenden oder deaktivieren, oder Zurück-Navigation und neutralen Text ergänzen; Entscheidung bei Beks.
- [niedrig] Start (alle Größen) – Wien,AT-Chip ohne Chevron und mit kleinem Kopfabstand statt dem Abstand von Ref 01/02. Fix: bewusst entscheiden (PWA ohne Statusleiste) und im Designvergleich vermerken.
- [niedrig] auftraege-liste, profil – Chevrons der Ref 13/16 fehlen an Listenzeilen und Einstellungszeilen. Fix: Chevron nur zeigen, wo die Zeile navigiert; für Detailzeilen ergänzen, sobald Detail gebaut.
- [niedrig] start 430 light – Route-Endpunkt berührt Punkt hinter „bewegen.“. Fix: Position des Endpunkts im Hero bei Breiten über 390 an Textende koppeln oder fixieren.
- [niedrig] start 1280 – Tab-Bar-Rahmen breiter als die zentrierte Spalte. Fix: Breite der Leiste auf Spaltenbreite begrenzen oder bewusst belassen.

Keine Befunde zu: Gebühr/15 % in Kunden-Screens (in den geöffneten Bildern nicht vorhanden), Beträge umgebrochen, Emojis, Prototyp-Texte, einfarbig Teal-Illustrationen.

Offene Findings hoch: 0
