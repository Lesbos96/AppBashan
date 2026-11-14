# Bildprüfung s9p-1, Kennung p1-1411-b, Modus Runde, 1280 px Light und Dark

Alle 12 Bilder mit Read geöffnet. Maße nicht aus dem Bild geschätzt. Gebühr-Wörter ("15 %", "Provision", "Plattformgebühr", "Gebühr") in keinem der 12 Bilder zu sehen.

| Bild | Beobachtung (nur mit Bildsicht) |
|---|---|
| light/partner-anfragen-liste | Karte "Transport, Bezirk 3": "Preis für den Kunden" 689,61 € (fett, rechtsbündig), darunter "Du erhältst" 586,17 €, beide Betrag und € in einer Zeile. Zweite Karte "Entrümpelung, Bezirk 3" zeigt statt Beträgen "Preisspanne 500,00 € bis 900,00 €" in einer Zeile, Button "Angebot abgeben" (dunkelteal, weiße Schrift). Spalte zentriert, weiße Karten auf hellgrauem Grund. |
| light/partner-annahme-sheet | Sheet "Anfrage annehmen": Zeilen "Preis für den Kunden" 689,61 € und "Du erhältst" 586,17 € (jeweils eine Zeile), Hinweis "Mit der Annahme übernimmst du den Auftrag verbindlich zu diesem Preis.", Button "Verbindlich annehmen" und Textlink "Doch nicht". Das Sheet endet bei etwa 55 % der Bildhöhe, darunter ist die Seite nicht abgedunkelt (Full-Page-Artefakt des fixierten Overlays). |
| light/partner-annahme-wettlauf | Oberhalb der Liste weiße Hinweiskarte "Diese Anfrage ist nicht mehr verfügbar. Die Liste wurde neu geladen."; darunter "Offene Anfragen" mit Leertext "Gerade gibt es keine offenen Anfragen in deinen Bezirken." Keine Beträge sichtbar. |
| light/partner-angebot-eingabe-fehler | Sheet "Angebot abgeben": Feld mit Label "Dein Angebot in Euro" und Wert "1,005" rechts, Hilfstext "Gewünscht ist ein Preis zwischen 500,00 € und 900,00 €." in Grau, Fehler in Rot "Gib einen Betrag in Euro an, zum Beispiel 700,50." Unter "Doch nicht" ist ca. ein Viertel des Sheets leer (große Leerfläche). Kein "Du erhältst" sichtbar (korrekt, da ungültig). |
| light/partner-angebot-bestaetigung | Sheet "Angebot senden": "Dein Angebot" 700,50 €, "Du erhältst voraussichtlich" 595,42 €, beide in einer Zeile; Hinweis "Dein Anteil kann sich bis zur Annahme ändern. Verbindlich, bis du das Angebot zurückziehst oder es abläuft."; Button "Verbindlich senden". Kein Gebührenhinweis. |
| light/partner-anfragen-ladefehler | Zentrierter Fehlerblock "Das hat nicht geklappt" / "Die Anfragen konnten nicht geladen werden. Prüfe deine Verbindung." mit Button "Erneut versuchen" (graugrüner Hintergrund, etwas dunkler als der Button "Journal herunterladen" darunter). Die Überschrift "Offene Anfragen" fehlt in diesem Zustand. |
| dark/partner-anfragen-liste | Dunkelteal-Grund, Karte 1: "Preis für den Kunden" 689,61 € und "Du erhältst" 586,17 € in weißer Fett-Schrift, je eine Zeile; Karte 2 "Preisspanne 500,00 € bis 900,00 €" in einer Zeile. Buttons "Fotos ansehen" mit mintgrüner Schrift auf dunklem Grund, "Annehmen" teal mit Verlauf. Karten nur durch feine Kontur vom Grund abgesetzt. |
| dark/partner-annahme-sheet | Sheet "Anfrage annehmen" mit 689,61 € / "Du erhältst" 586,17 € in Weiß, einzeilig; "Verbindlich annehmen" hellteal. Sheet-Fläche fast gleich dunkel wie der abgedunkelte Hintergrund, nur eine dünne Kontur und der Griff trennen es ab. Unterhalb des Sheets nicht abgedunkelter Seitenteil (Full-Page-Artefakt). |
| dark/partner-annahme-wettlauf | Hinweiskarte "Diese Anfrage ist nicht mehr verfügbar. Die Liste wurde neu geladen." in Weiß auf dunkler Karte; "Gerade gibt es keine offenen Anfragen in deinen Bezirken." in gedämpftem Grau-Grün. |
| dark/partner-angebot-eingabe-fehler | Fehlertext "Gib einen Betrag in Euro an, zum Beispiel 700,50." in Lachsrot auf dunklem Grund (gut lesbar); Feldwert "1,005"; "Weiter" hellteal. Sheet unten ca. ein Viertel leer. |
| dark/partner-angebot-bestaetigung | "Dein Angebot" 700,50 € und "Du erhältst voraussichtlich" 595,42 € in Weiß, einzeilig; Button "Verbindlich senden" teal, Link "Doch nicht" mint. Das Sheet ist nur an der Kontur erkennbar. |
| dark/partner-anfragen-ladefehler | "Das hat nicht geklappt" in Weiß, Button "Erneut versuchen" mit mintgrüner Schrift auf dunklem Grund, etwas dunkler als "Journal herunterladen". Keine Überschrift "Offene Anfragen". |

## Funde

- [niedrig] Alle vier Sheet-Bilder (Light und Dark): Das Sheet endet bei etwa halber Bildhöhe, darunter ist die Seite nicht abgedunkelt. Das ist ein Artefakt des Full-Page-Screenshots mit fixiertem Overlay, kein App-Fehler. Für die Abnahme Sheet-Shots im Viewport (nicht Full-Page) aufnehmen.
- [niedrig] dark/partner-annahme-sheet, dark/partner-angebot-bestaetigung: Das Sheet hebt sich kaum vom abgedunkelten Hintergrund ab (nahezu gleiche Fläche, nur dünne Kontur). Fix: Sheet-Fläche im Dark-Theme eine Stufe heller (Token für erhöhte Fläche) oder stärkere Kontur.
- [niedrig] partner-angebot-eingabe-fehler (beide): Etwa ein Viertel des Sheets unter "Doch nicht" ist leer. Fix: Sheet-Höhe am Inhalt ausrichten (nicht Mindesthöhe der Bestätigungsansicht).
- [niedrig] partner-anfragen-ladefehler (beide): Überschrift "Offene Anfragen" fehlt im Fehlerzustand, während "Abrechnung" sichtbar bleibt; der Button "Erneut versuchen" nutzt einen anderen Grauton als "Journal herunterladen". Fix: Überschrift behalten, Sekundärbutton-Token angleichen.
- [niedrig] partner-anfragen-liste/Wettlauf (Light): Deaktivierter Button "Hochladen" mit weißer Schrift auf blassem Teal hat sichtbar niedrigen Kontrast. Für deaktivierte Elemente zulässig, aber Kontrast per getComputedStyle bestätigen, falls AA auch dort gefordert wird.
- Keine Funde zu Geld: 586,17 von 689,61 € und 595,42 von 700,50 € stimmen mit dem Mock überein (Server-Wert, App zeigt nur). Kein Betrag umgebrochen, keine Emojis, keine Platzhaltertexte, kein "Prototyp"-Text, keine Gebühr sichtbar.

Funde hoch: 0, mittel: 0
