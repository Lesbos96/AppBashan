# s9p-1 Bildprüfung Runde 2 (p1-1411-b), Partner-Anfragen, 390 Dark

Pfad: tmp/shots/shots-390-dark/. Alle 12 Bilder mit Read geöffnet. 320-Bilder sind 640 px breit (Viewport 320, Faktor 2), die übrigen 780 px (Viewport 390, Faktor 2). Maße nicht aus dem Bild geschätzt; Touch-Ziele (44 px) und Überlauf sind hier nicht belegt (Playwright-Messung nötig).

| Bild | Beobachtung nur mit Bildsicht |
|---|---|
| partner-320-anfragen-liste | Karte „Transport, Bezirk 3": „Preis für den Kunden 689,61 €" und darunter „Du erhältst 586,17 €", beide Beträge rechtsbündig, fett, je eine Zeile. Zweite Karte „Entrümpelung": „Preisspanne" und „500,00 € bis 900,00 €" stehen untereinander (Label oben links, Betrag rechts darunter), Betrag selbst in einer Zeile. Kein „Du erhältst" bei der Spanne. Primärbutton „Annehmen" und „Angebot abgeben" türkis mit weißer Schrift. |
| partner-320-annahme-sheet | Sheet „Anfrage annehmen": „Preis für den Kunden 689,61 €", „Du erhältst 586,17 €" (jeweils eine Zeile). Text „Mit der Annahme übernimmst du den Auftrag verbindlich zu diesem Preis." Buttons „Verbindlich annehmen" (türkis) und „Doch nicht" (türkise Schrift). Hintergrund ist abgedunkelt; die Karte dahinter ist am Sheet-Rand abgeschnitten („Antwort bis 1. Dezember um 11:00" halb sichtbar). |
| partner-320-annahme-wettlauf | Oben eigene Hinweiskarte „Diese Anfrage ist nicht mehr verfügbar. Die Liste wurde neu geladen." in heller Schrift auf dunkler Karte; darunter „Offene Anfragen" mit „Gerade gibt es keine offenen Anfragen in deinen Bezirken." in gedämpftem Grau. Keine Beträge sichtbar. |
| partner-320-angebot-eingabe-fehler | Sheet „Angebot abgeben": Feld „Dein Angebot in Euro" mit Wert „1,005", darunter „Gewünscht ist ein Preis zwischen 500,00 € und 900,00 €." (Betrag-Paar in einer Zeile) und Fehlertext in Lachsrot „Gib einen Betrag in Euro an, zum Beispiel 700,50." Button „Weiter". Kein Du-erhältst-Betrag, korrekt vor gültiger Eingabe. |
| partner-320-angebot-bestaetigung | Sheet „Angebot senden": „Dein Angebot 700,50 €"; „Du erhältst voraussichtlich" bricht um, der Betrag „595,42 €" steht rechtsbündig in der Zeile darunter (Betrag selbst nicht umgebrochen). Text „Dein Anteil kann sich bis zur Annahme ändern. Verbindlich, bis du das Angebot zurückziehst oder es abläuft." Button „Verbindlich senden". |
| partner-320-anfragen-ladefehler | Mittig „Das hat nicht geklappt" (fett, weiß), darunter grauer Text „Die Anfragen konnten nicht geladen werden. Prüfe deine Verbindung." und Button „Erneut versuchen" in türkiser Schrift auf dunkelgrünem Grund, nicht Primärfüllung. Keine Beträge. |
| partner-anfragen-liste | Karte „Transport, Bezirk 3": „Preis für den Kunden 689,61 €", „Du erhältst 586,17 €"; Titel „Transporte Huber GmbH" steht hier in einer Zeile (bei 320 in zwei). Zweite Karte: „Preisspanne 500,00 € bis 900,00 €" in einer Zeile, rechtsbündig. |
| partner-annahme-sheet | Sheet „Anfrage annehmen": „Preis für den Kunden 689,61 €", „Du erhältst 586,17 €" in einer Zeile je Betrag; „Verbindlich annehmen" türkiser Verlauf, „Doch nicht" türkise Schrift. Darunter schneidet das Sheet die Seite hart ab (Text „Monat ihres Abschlusses." halb sichtbar am Sheet-Unterrand). |
| partner-annahme-wettlauf | Hinweiskarte „Diese Anfrage ist nicht mehr verfügbar. Die Liste wurde neu geladen." in zwei Zeilen, helle Schrift, darunter „Offene Anfragen" und grauer Leertext. Keine Beträge, keine Gebührenworte. |
| partner-angebot-eingabe-fehler | Sheet „Angebot abgeben" mit „1,005" im Feld, „Gewünscht ist ein Preis zwischen 500,00 € und 900,00 €." umbricht nach „und", Betrag „900,00 €." bleibt zusammen. Fehlertext lachsrot auf dunkel, gut lesbar. Unter „Doch nicht" ist ein großer leerer dunkler Bereich bis zur abgeschnittenen Seite (Sheet-Höhe = Viewport, Full-Page-Artefakt). |
| partner-angebot-bestaetigung | Sheet „Angebot senden": „Dein Angebot 700,50 €" und „Du erhältst voraussichtlich 595,42 €" jeweils in einer Zeile (bei 390 passt es nebeneinander). Hinweis „Dein Anteil kann sich bis zur Annahme ändern." Button „Verbindlich senden". |
| partner-anfragen-ladefehler | „Das hat nicht geklappt" mittig fett, graue Beschreibung in zwei Zeilen, „Erneut versuchen" als abgedunkelte Fläche mit türkiser Schrift, mittig unter dem Text. |

Rechenprobe aus den Bildern: 689,61 € mit 586,17 € (Differenz 103,44 €, 15,0 %) und 700,50 € mit 595,42 € (Differenz 105,08 €, 15,0 %, Staffel-Satz bzw. Rundung passt zu Server-Mock). Die App zeigt nur den Betrag, keine Quote.

Textprüfung in allen 12 Bildern: kein „15 %", „Provision", „Plattformgebühr", „Gebühr" oder „MoveNow-Gebühr" sichtbar. Keine Emojis, keine Platzhaltertexte, kein „Prototyp". Format „1.175,00 €"-Stil (Komma, nachgestelltes €) durchgehend; kein Tausenderfall im Bild. Du-Ansprache durchgehend.

Kontrast auf Dunkel: weiße/helle Primärtexte, türkise Linktexte (Doch nicht, Fotos ansehen, Journal herunterladen) und Lachsrot-Fehler sind klar lesbar. Gedämpftes Grau (Beschreibungen, „1 × Transporter, 2 Personen") sichtlich schwächer, aber lesbar; nicht per Messung als AA belegt. „Hochladen" (deaktiviert, graue Schrift auf dunklem Türkis) ist sehr schwach, als deaktiviert ausgenommen.

## Funde

- [niedrig] partner-320-angebot-bestaetigung: „Du erhältst voraussichtlich" bricht um und der Betrag steht in eigener Zeile rechtsbündig darunter; Betrag bleibt ganz, wirkt aber uneinheitlich gegenüber der Zeile „Dein Angebot". Fix: Label kürzer oder Zeile bei schmaler Breite bewusst als Block (Label oben, Betrag links/rechts) setzen.
- [niedrig] partner-320-anfragen-liste: „Preisspanne" und Betrag stehen bei 320 px untereinander, bei 390 nebeneinander; Betrag bricht nicht um. Kein Fehler, nur Hinweis.
- [niedrig] Sheet-Shots (annahme-sheet, angebot-*): Sheet endet hart, Seite dahinter ist am Sheet-Rand abgeschnitten bzw. großer leerer Bereich bei Eingabe-Fehler. Wahrscheinlich Full-Page-Artefakt des Screenshots, kein Nutzerfehler; Prüfung per Viewport-Shot.
- [niedrig] Kontrast gedämpftes Grau und deaktivierter Button nicht per Messung belegt; Touch-Ziele ≥ 44 px (Doch nicht, Erneut versuchen) nicht im Bild messbar, per boundingBox() zu prüfen.

Keine Funde bei Gebührenhinweis, Betragsumbruch (kein Betrag zerbrochen), Betrag-Konsistenz Karte zu Sheet (689,61 € / 586,17 € in beiden gleich).

Funde hoch: 0, mittel: 0
