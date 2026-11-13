# Review 3 (Runde, UI, s9i-7b2 Absage), 12 Bilder geöffnet

| Bild | Beobachtung (nur per Bildsicht) | Befund |
|---|---|---|
| 320 light partner-320-absage-pauschale | Betragskarte oben vollständig (69,00 / 10,35 / 58,65 €, je einzeilig); "Mit Pauschale" gewählt (dunkler Punkt), Text bis "nötig." abgeschnitten am Fußleistenrand; "Ohne Pauschale" nicht sichtbar. Hauptknopf "Für 69,00 € absagen" einzeilig, vollständig. "Grund ändern" bricht auf zwei Zeilen, "Doch nicht" einzeilig, vertikal ungleich | Fund hoch (zweiter Weg unsichtbar), Fund niedrig (Umbruch Grund ändern) |
| 320 light betrag-geaendert | 80,00 / 12,00 / 68,00 € unversehrt. Rotes Fehlerband in der Fußleiste frisst den Scrollbereich: "Mit Pauschale" nur halb sichtbar, Radio leer (ungewählt), "Ohne Pauschale" nicht sichtbar. Knopf "Absagen" ausgegraut, einzeilig | Fund hoch (gleiche Ursache), Umbruch "Grund ändern" wie oben |
| 390 light partner-absage-pauschale | Beide Karten "Mit Pauschale" (gewählt) und "Ohne Pauschale" vollständig sichtbar; Knopf "Für 69,00 € absagen" einzeilig; "Grund ändern" und "Doch nicht" nebeneinander auf einer Zeile. Beträge 69,00 / 10,35 / 58,65 € ganz | ok |
| 320 dark partner-320-absage-pauschale | Wie Light: Betragskarte mit hellen Zahlen ok, nur "Mit Pauschale" (hellteal Punkt) sichtbar, unten angeschnitten; Hauptknopf einzeilig; "Grund ändern" zweizeilig | Fund hoch (Ohne Pauschale unsichtbar), niedrig (Umbruch) |
| 320 dark betrag-geaendert | 80,00 / 12,00 / 68,00 € ok; rotes (helles) Fehlerband deckt Radiotext ab, Radio grau/leer, "Absagen" gedämpft | Fund hoch (wie Light) |
| 390 dark partner-absage-pauschale | Beide Radiokarten sichtbar, "Mit Pauschale" mit hellem Punkt, Beträge ganz, Hauptknopf einzeilig, beide schlichten Knöpfe nebeneinander in Teal | ok |
| 320 light partner-320-absage-grund | Drei Gründe, dritter ("Anderer Grund") ganz sichtbar; "Folgen prüfen" und "Doch nicht" untereinander einzeilig | ok |
| 320 light partner-320-absage-ohne-pauschale | Schritt "ohne": Text "Der Kunde muss nichts zahlen ..." vollständig, Knopf "Absagen" einzeilig; "Grund ändern" bricht zweizeilig | Fund niedrig (Umbruch) |
| 1280 light partner-absage-pauschale | Sheet als zentrierte schmale Spalte (ca. 790 px bei Faktor 2), beide Radiokarten, Beträge ganz, Knöpfe nebeneinander; Hintergrund grau nur im oberen Viewport-Bereich (Full-Page-Artefakt, Dokumente unten ungedimmt) | ok (Artefakt der Full-Page-Aufnahme, kein Fund) |
| 1280 dark partner-absage-pauschale | Gleiches Layout, dunkle Karten, Teal-Akzente, Beträge ganz; "Ohne Pauschale" Punkt grau | ok |
| 390 light partner-absage-karte-mit-pauschale | Karte "Umzug, Bezirk 3" mit Chip "Von dir storniert", Zeilen Pauschale 69,00 € und Du erhältst 58,65 € je einzeilig rechtsbündig; keine Gebühr-Zeile | ok |
| 390 dark partner-320-absage-fehler | Schritt 1, rotes helles Fehlerband "Für diesen Auftrag läuft eine Prüfung ...": lesbar, dritter Grund fast ganz verdeckt, "Folgen prüfen" einzeilig, "Doch nicht" einzeilig | Fund mittel (Fehlerband verdeckt Liste, nur zweite Karte komplett) |

## Funde
- [hoch] Absage-Sheet bei 320 px, Schritt 2 (pauschale, betrag-geaendert, light und dark): "Ohne Pauschale" nicht sichtbar, "Mit Pauschale" angeschnitten. Fußleiste (Knopf + zwei Links + ggf. Fehlerband) belegt rund 45 % der Höhe. Fix: bei schmaler Breite Fußleiste kompakter (Fehlerband in den Scrollbereich oberhalb der Karten verlegen), "Grund ändern" einzeilig, und/oder Radiokarten als kompakte Zeile mit kürzerem Text; Bildziel: beide Karten ohne Scrollen sichtbar oder zumindest Anschnitt der zweiten Karte als Scrollhinweis.
- [niedrig] 320 px: "Grund ändern" bricht auf zwei Zeilen und liegt höher/niedriger als "Doch nicht". Fix: `white-space: nowrap`, kleinere Schrift oder Spalten `auto 1fr`.
- [mittel] 320 px, Fehlerband in der Fußleiste (fehler, betrag-geaendert): Band schiebt die Fußleiste hoch und verdeckt Inhalt. Fix: Fehlertext oben im Scrollbereich, nicht in der Fußleiste.
