# MoveNow · Design-Referenz

Verbindliche Vorlage für Optik, Layout, Icons und Illustrationen der MoveNow-App.
Stand: 29.10.2026. Gehört nach `/reference/design/` im Projekt.

## Inhalt

| Ordner / Datei | Wofür |
| --- | --- |
| `screens/*.png` | So soll es aussehen. Gerendert mit 2-facher Auflösung, Breite 390 px. Lange Screens zeigen die ganze Scroll-Länge. |
| `html/*.html` | Quelltext jedes Screens mit den exakten Werten: Farben, Abstände, Radien, Schatten, Typo sowie alle Icons und Illustrationen als SVG. Im Browser öffnen, die Links zwischen den Screens funktionieren. |
| `tokens.json` | Alle Design-Tokens für Light und Dark, Radien, Schatten, Typo-Skala, Layout-Maße, Bewegung. |

## Screens

| Datei | Screen |
| --- | --- |
| 00_Fundament | App-Icon (Light, Dark, Favicon), Farben, Typo, Icon-Set (Outline und Filled), Komponenten |
| 01_Start_Light / 02_Start_Dark | Start mit Hero, vier Service-Karten, Transporter-Karte, Tab-Bar |
| 03_Onboarding | Onboarding, Seite 1 von 3 |
| 04_Umzug_Konfigurator | Möbeltransport und Umzug: Transportgut, Fotos, Team, Stockwerke, Strecke mit Routengrafik, Zusatzleistungen, fixierte Preiskarte |
| 05_Preis_Sheet | Bottom Sheet mit allen Preispositionen |
| 06_Entruempelung_Wizard | Wizard-Schritt 3 von 6 (Füllgrad) mit Illustrationen je Option |
| 07_Entruempelung_Ergebnis | Preisrahmen mit Spannen-Grafik und Positionen |
| 08_Montage_Kueche | Montage, Küche nach Unter-, Ober- und Hochschränken |
| 09_Transporter_Miete | Fahrzeugkarten, Zeitraum, Kilometer, Rückgabe, Extras, Aufschlüsselung, Kaution |
| 10_Ort_Termin | Kalender im iOS-Stil, Strecke, Dauer |
| 11_Zusammenfassung | Gruppierte Liste, Preiskarte, Einwilligung, Konto-Hinweis |
| 12_Bestaetigung | Erfolgsscreen mit animiertem Häkchen |
| 13_Auftraege / 14_Auftrag_Detail / 15_Auftraege_leer | Liste mit Status-Chips, Detail mit Timeline, leerer Zustand |
| 16_Profil / 17_Wie_rechnet_MoveNow / 18_Fuer_Vermieter | Profil ohne Konto-Zwang, Info-Sheet zur Preisbasis mit Quellen, Vermieterbereich mit allen Tarif-Feldern |

## Regeln für die Umsetzung

1. **Rangfolge:** Für die Optik gilt diese Referenz vor Abschnitt 3 des Briefings. Für Inhalt und Ablauf gilt das Briefing, für Preise der Prototyp-Code.
2. **Werte übernehmen, nicht schätzen:** Maße, Farben und Schatten aus `html/` und `tokens.json` übernehmen. Inline-Styles werden zu Tailwind-Klassen auf Basis der Tokens (CSS-Variablen), nicht 1:1 kopiert.
3. **Icons und Illustrationen** als SVG-Komponenten aus den HTML-Dateien extrahieren, z. B. `src/assets/icons/` und `src/assets/illustrations/`. Pfade unverändert lassen. Dark-Varianten der Service-Illustrationen stehen in `02_Start_Dark.html`.
4. **Bildstil:** Illustrationen zeigen echte Materialien in natürlichen Farben: Kraftkarton, Eiche, Stoff, weißer Lack, ein weißer Transporter mit Spiegel, Felgen und Firmenbeschriftung. Teal ist nur Marken-Akzent (Logo, Kissen, Akkuschrauber). Keine einfarbigen Teal-Grafiken, keine Fantasie-Objekte. Die Palette steht in `tokens.json` unter `illustration`.
5. **Plattformgebühr:** Die 15 % erscheinen in der App nirgends, weder in Konfiguratoren, Preis-Sheet, Zusammenfassung noch im Info-Sheet. Sie stehen nur auf der Rechnung und in der Beispielabrechnung im Vermieterbereich.
6. **Beispieldaten:** Adressen, Daten, Fahrzeuge und Preise in den Screens sind Beispiele. Die Preise sind mit der Prototyp-Logik berechnet und eignen sich als Testfälle für das Preismodul (die Gebührenwerte nur für Rechnung und Abrechnung, nicht für die UI):
   - Umzug, 3 Personen, 1 Fahrzeug, 5 h, Wien, Montage 3 lfm, 20 Kartons, 1 Halteverbot: 689,61 € (Gebühr 103,44 €, netto 86,20 €, USt. 17,24 €, Partner 586,17 €)
   - Entrümpelung, Wohnung 60 m², normal, 3. Stock ohne Lift: 1.175,00 € (Spanne 950 bis 1.550 €, Gebühr 176,25 €)
   - Küche, 3,2 / 2,4 / 0,6 lfm: 770,40 €
   - Cargo Van, 2 Tage, 350 km, Schutzpaket: 276,00 € (Gebühr 41,40 €), Kaution 500,00 € separat
   - Vermieter-Beispiel, 99 € für 1 Tag: Gebühr 14,85 € (netto 12,38 €, USt. 2,47 €), an Vermieter 84,15 €
7. **Foto-Kacheln** im Konfigurator und im Auftragsdetail sind gezeichnete Platzhalter für Nutzerfotos. In der App stehen dort die echten Vorschaubilder.
8. **Dark Mode** ist für Start und Tokens ausgearbeitet. Alle anderen Screens nach demselben Muster ableiten: Grund `#071B1F`, Karten `#0F272B`, Akzent Mint, keine Schatten.
9. **Nicht gestaltete Zustände** (weitere Onboarding-Seiten, übrige Wizard-Schritte, Standardmöbel-Montage, Zeitfenster bei Entrümpelung und Montage, Persönliches Angebot, Fehler- und Ladezustände) in derselben Sprache ergänzen und in die Screenshot-Prüfung aufnehmen.
10. **Ablauf ohne Tab-Bar:** In Buchungsflows (Konfigurator, Wizard, Termin, Zusammenfassung, Vermieter) ist die Tab-Bar ausgeblendet, unten steht die fixierte Aktionsleiste.
