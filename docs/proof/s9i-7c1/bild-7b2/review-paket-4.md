# Review paket-4 (Runde, 390 px Dark, davon 3 Bilder bei 320 px)

Dateien tragen alle das Präfix `shots-390-dark__`.

| Bild | Beobachtung (nur per Bildsicht) |
|---|---|
| partner-320-absage-netzfehler-vorschau | Roter Fehlertext "Keine Verbindung. Prüfe dein Netz und versuche es erneut." steht über dem grauen Hinweistext. Die Radio "Vor Ort anders als gebucht" ist türkis gefüllt, die anderen zwei sind grau. Der Primärknopf "Folgen prüfen" ist türkis, darunter zentriert "Doch nicht". Hinter dem Sheet ist "Partner" oben abgeschnitten. Der Knopf "Kontakt und Adresse anzeigen" im Hintergrund bricht in zwei Zeilen um. |
| partner-320-absage-ohne-pauschale | Weißer Haupttext "Der Kunde muss nichts zahlen. Weitervermittlung, wenn der Termin es zulässt. Kontakt und Adresse sind danach für dich gesperrt." Darunter ein kleiner grauer Hinweis zu mehreren Absagen. "Absagen" ist ein türkiser Vollknopf, "Zurück" links und "Doch nicht" rechts in einer Zeile. |
| partner-320-absage-pauschale | Die Betragskarte zeigt "Pauschale inkl. USt. 69,00 €", "Gebühr 10,35 €" und "Du erhältst 58,65 €". Die Beträge stehen rechtsbündig fett, jeder in einer Zeile. Die Radio "Mit Pauschale" ist hell gefüllt, darunter "Ohne Pauschale". Der Hinweistext darunter ("Ohne Pauschale: Weitervermittlung, wenn der …") ist an der Oberkante der Fixierleiste halb abgeschnitten. Der Knopf lautet "Für 69,00 € absagen" auf einer Zeile. |
| partner-absage-betrag-geaendert | Roter Text "Der Betrag hat sich geändert. Prüfe die Folgen neu und bestätige erneut." über der Karte mit "80,00 €" / "12,00 €" / "68,00 €". Beide Radios sind grau, also nichts gewählt. "Absagen" ist abgedunkelt mit grauem Text, der Knopf ist deaktiviert. Der Fußhinweis ist komplett sichtbar, vier Zeilen. |
| partner-absage-fehler | Roter Text "Für diesen Auftrag läuft eine Prüfung. Absagen geht gerade nicht." steht oben im Sheet. Darunter "Grund" mit drei Radios, die erste ist türkis gefüllt. "Folgen prüfen" ist trotzdem als aktiver türkiser Knopf dargestellt. |
| partner-absage-grund | Sheet ohne Fehlerzeile, beginnt direkt mit "Der Kunde wird informiert …". Die Karte "Angenommen" lugt oben hinter dem Sheet hervor. "Folgen prüfen" ist aktiv türkis, "Doch nicht" zentriert darunter. |
| partner-absage-karte-mit-pauschale | Abschnitt "Beendet" mit der Karte "Umzug, Bezirk 3" und einem grauen Chip "Von dir storniert". Zeilen "Pauschale 69,00 €" und "Du erhältst 58,65 €", Beträge fett rechtsbündig. Der Knopf "Kontakt und Adresse anzeigen" ist sichtbar, darunter der Hinweis "… nur kurze Zeit sichtbar." |
| partner-absage-karte-ohne-pauschale | Gleiche Karte, Chip "Von dir storniert". Statt der Beträge steht grau "Storniert, es fällt kein Betrag an." Der Kontakt-Knopf fehlt. Stattdessen steht der Hinweis "Kontakt und Adresse sind gesperrt, weil keine Pauschale anfällt." |
| partner-absage-netzfehler-senden | Kein Sheet sichtbar. Zwischen "Offene Anfragen" und "Angenommen" steht eine eigene Karte mit "Wir wissen nicht, ob die Absage angekommen ist. Die Aufträge wurden neu geladen. Prüfe den Status des Auftrags." Die Auftragskarte steht weiter auf "Angenommen" mit "Preis für den Kunden 689,61 €" und "Du erhältst 586,17 €", beide Beträge in einer Zeile. |
| partner-absage-netzfehler-vorschau | Roter Text "Keine Verbindung. Prüfe dein Netz und versuche es erneut." in zwei Zeilen über dem grauen Erklärtext. Erste Radio türkis, "Folgen prüfen" türkis aktiv, "Doch nicht" darunter. |
| partner-absage-ohne-pauschale | Das Sheet sitzt weiter unten über der Karte "Umzug, Bezirk 3", die Kartenoberkante ist hinter dem Sheet teilweise sichtbar. "Grund: Kann ich nicht durchführen" in kleiner grauer Schrift. Darunter weißer Haupttext, "Absagen" ist türkiser Vollknopf, "Zurück" und "Doch nicht" nebeneinander. |
| partner-absage-pauschale | Betragskarte mit 69,00 € / 10,35 € / 58,65 €, Radio "Mit Pauschale" ist türkis gewählt. Das Label "Belegfotos" und die Karte "1 Foto wird beim Senden hochgeladen" folgen darunter. Der Dateiname "beleg.png" und "Entfernen" sind an der Fixierleiste halb abgeschnitten. Der Knopf lautet "Für 69,00 € absagen". |

## Findings

### hoch
Keine.

### mittel
- partner-absage-fehler: Bei dem Fehler "Absagen geht gerade nicht" bleibt "Folgen prüfen" als normaler aktiver Knopf stehen und die Grundwahl wirkt weiter bedienbar. Es ist kein Zustand erkennbar, der zum Fehler passt. Fix: Knopf deaktivieren oder "Schließen" als Hauptaktion anbieten, wenn der Fehler endgültig ist.
- partner-absage-netzfehler-senden: Die Meldung "Wir wissen nicht, ob die Absage angekommen ist" steht als freie Karte über dem Abschnitt "Angenommen", ohne Bezug zu dem betroffenen Auftrag. Bei mehreren Aufträgen ist unklar, welcher gemeint ist. Fix: Meldung in der Auftragskarte selbst anzeigen oder den Auftrag nennen ("Umzug, Bezirk 3").

### niedrig
- partner-absage-pauschale, partner-320-absage-pauschale: Der Inhalt läuft hinter der Fixierleiste ohne sichtbaren Hinweis auf weiteren Inhalt (Text und "beleg.png" halb abgeschnitten). Das ist erwartbar bei scrollendem Inhalt, aber der Hinweistext wird in der Mitte einer Zeile gekappt. Fix: Verlauf am unteren Rand des Scrollbereichs oder Scrollposition so wählen, dass keine halbe Zeile bleibt.
- partner-absage-pauschale: Das Label "Belegfotos" und der Text im Fotobereich sind gegenüber dem 24-px-Rand von "Grund" und den Karten eingerückt (Label bei ca. 48 px, Karte bei 24 px). Fix: Label auf denselben linken Rand setzen.
- partner-absage-betrag-geaendert, partner-absage-grund: Die nicht gewählten Radios sind dunkelgrau auf dunklem Karten-Hintergrund und kontrastarm. Fix: Ring in `border`-Token mit AA-tauglichem Kontrast (3:1 für UI-Elemente) prüfen.
- partner-320-absage-netzfehler-vorschau: Im Hintergrund umbricht "Kontakt und Adresse anzeigen" in zwei Zeilen. Das ist der Knopf der Auftragskarte hinter dem Sheet bei 320 px, kein Betrag, aber ein unnötiger Umbruch. Fix: `whitespace-nowrap` oder kürzere Beschriftung bei schmaler Breite.
- Hinweis zu allen Shots: Das Sheet endet in den Full-Page-Aufnahmen vor dem Seitenende, darunter ist die Seite sichtbar und nicht abgedunkelt. Das ist ein Artefakt der Full-Page-Aufnahme (Sheet fixiert auf Viewport-Höhe), kein Befund. Für Safe-Area-Prüfung am unteren Rand gilt die Messung per Playwright.

Geprüft ohne Befund: Betrag und "€" stehen in allen Bildern in einer Zeile. Die Kundenseite ist nicht Teil von paket-4, also keine Gebührenprüfung dort. Die Zeile "Gebühr" in der Partner-Maske ist bewusst vorhanden. 15 % von 69,00 € = 10,35 € und 15 % von 80,00 € = 12,00 € sind korrekt. Kein Emoji, kein Platzhaltertext.

Gesichtet: 12 von 12
