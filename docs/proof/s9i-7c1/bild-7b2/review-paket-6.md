# Review paket-6 (Modus Runde, nur UI, Light)

| Bild | Beobachtung (nur per Bildsicht) |
|---|---|
| 320-absage-netzfehler-vorschau | Roter Fehlertext "Keine Verbindung. Prüfe dein Netz und versuche es erneut." steht über dem grauen Erklärtext, gerade zwei Zeilen, nichts abgeschnitten. "Vor Ort anders als gebucht" hat gefüllten Teal-Radio, die zwei anderen leere Ringe. Teal-Knopf "Folgen prüfen" und Textknopf "Doch nicht" mittig unter der Trennlinie. Hinter dem Sheet bricht der Knopf "Kontakt und Adresse anzeigen" auf zwei Zeilen um. |
| 320-absage-ohne-pauschale | Sheet zeigt "Grund: Kann ich nicht durchführen" als kleine graue Zeile, darunter großer dunkler Text "Der Kunde muss nichts zahlen. Weitervermittlung ..." in vier Zeilen, dann kleiner grauer Hinweis zur Prüfung. Fixierleiste: Teal-Knopf "Absagen", darunter "Zurück" links und "Doch nicht" rechts, beide Teal. |
| 320-absage-pauschale | Karte oben mit Zeilen "Pauschale inkl. USt. 69,00 €", "Gebühr 10,35 €", "Du erhältst 58,65 €"; jeder Betrag in einer Zeile, rechtsbündig, fett. Der Radio "Mit Pauschale" wirkt hier schwarz statt Teal. Der Hinweistext "Ohne Pauschale: Weitervermittlung, wenn der ..." wird am Rand der Fixierleiste angeschnitten (scrollbarer Inhalt). Knopf "Für 69,00 € absagen" in einer Zeile. |
| absage-betrag-geaendert | Roter Fehler "Der Betrag hat sich geändert. Prüfe die Folgen neu und bestätige erneut." über der Karte mit 80,00 € / Gebühr 12,00 € / Du erhältst 68,00 €. Beide Radios leer, Knopf "Absagen" blass-teal (deaktiviert). Der Hinweistext steht vollständig über der Trennlinie. |
| absage-fehler | Roter Text "Für diesen Auftrag läuft eine Prüfung. Absagen geht gerade nicht." im Sheet-Kopf. Dazu die Grundauswahl mit drei weißen Karten, die erste mit Teal-Radio. "Folgen prüfen" aktiv in Teal. |
| absage-grund | Kein Fehlertext. "Der Kunde wird informiert ..." steht direkt unter dem Titel, "Grund" als fetter Zwischentitel, drei weiße Radio-Karten. Unter dem Sheet verläuft eine dunkle durchgehende Linie am Sheet-Ende (Screenshot-Rand, Scrim endet). |
| absage-karte-mit-pauschale | Karte "Umzug, Bezirk 3" mit grauem Badge "Von dir storniert". Zeilen "Pauschale 69,00 €" und "Du erhältst 58,65 €", keine Gebührenzeile. Knopf "Kontakt und Adresse anzeigen" hellgrau-teal mit Teal-Text, darunter Hinweis zur kurzen Sichtbarkeit. |
| absage-karte-ohne-pauschale | Gleiche Karte, Text "Storniert, es fällt kein Betrag an." in Grau. Kein Kontakt-Knopf, stattdessen Hinweis "Kontakt und Adresse sind gesperrt, weil keine Pauschale anfällt." Kein Betrag in der Karte. |
| absage-netzfehler-senden | Sheet geschlossen. Weiße Meldungskarte "Wir wissen nicht, ob die Absage angekommen ist. Die Aufträge wurden neu geladen. Prüfe den Status des Auftrags." vor "Angenommen". Karte zeigt "689,61 €" und "586,17 €", jeweils in einer Zeile. |
| absage-netzfehler-vorschau | Roter Text "Keine Verbindung. Prüfe dein Netz und versuche es erneut." in zwei Zeilen, darunter die Grundauswahl. Sheet liegt auf abgedunkeltem Hintergrund. |
| absage-ohne-pauschale | Grund-Zeile klein grau, Text "Der Kunde muss nichts zahlen ..." groß. Knopf "Absagen" Teal. Hinter dem Sheet sitzt die Karte "Angenommen" mit Teal-Badge, ihre Datumszeile wird vom Sheet angeschnitten (normal). |
| absage-pauschale | Karte mit Pauschale/Gebühr/Du erhältst, Radio "Mit Pauschale" in Teal gefüllt. Darunter "Belegfotos" und "1 Foto wird beim Senden hochgeladen"; die Zeile "beleg.png / Entfernen" wird von der Fixierleiste angeschnitten (scrollbar). Knopf "Für 69,00 € absagen" in Teal. |

## Findings

hoch
- Keine.

mittel
- Keine.

niedrig
- 320-absage-pauschale: Radio "Mit Pauschale" wirkt schwarz mit Ring statt Teal (390 px: Teal). Wahrscheinlich Fokus-/Auswahlstil oder Skalierung; Farbe prüfen und angleichen.
- 320-absage-pauschale, absage-pauschale: Der Inhalt scrollt unter der Fixierleiste, die Hinweiszeile bzw. die Foto-Zeile ("beleg.png / Entfernen") wird angeschnitten. Das ist Scrollinhalt und kein Fehler, aber im Screenshot nicht ohne Scrollen prüfbar. Beim Fotozustand zusätzlich ein Bild mit ans Ende gescrolltem Sheet aufnehmen.
- 320-absage-netzfehler-vorschau: Hintergrundkarte zeigt "Kontakt und Adresse anzeigen" zweizeilig bei 320 px. Außerhalb dieser Änderung, kosmetisch.
- Alle 320-Bilder: Das Scrim endet bei Full-Page-Aufnahmen am Sheet-Ende, darunter ist die Seite hell. Das ist ein Artefakt der Aufnahme, kein Layoutfehler.
- Die Absage-Karte beim Kunden (mit/ohne Pauschale) ist in den 12 Bildern von paket-6 nicht enthalten. Dazu keine Aussage möglich.
- Zeile "Gebühr" in der Partner-Absage-Maske ist sichtbar. Das ist bewusst so entschieden und kein Fund. In den Karten steht nirgends "Gebühr".
- Dark Mode: nicht Teil von paket-6, nicht geprüft.

Gesichtet: 12 von 12
