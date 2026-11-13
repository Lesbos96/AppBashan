# Review paket-2 (1280 px, Light, Modus Runde)

| Bild | Beobachtung (nur per Bildsicht) |
|---|---|
| shots-1280-light__kunde-absage-mit-pauschale.png | Dritte Karte "Absage der Firma": Text "Die Firma macht eine Pauschale von **69,00 €** geltend ...", Betrag fett und in einer Zeile. "Neue Anfrage" als unterstrichener Teal-Link unter dem Text. Statuspille "Storniert" grau oben rechts in der ersten Karte, Preis "689,61 €" rechts in einer Zeile. Kein Wort zu Gebühr. |
| shots-1280-light__kunde-absage-ohne-pauschale-keine-folgeanfrage.png | Karte "Absage der Firma": "Dir entstehen keine Kosten. Du kannst jederzeit eine neue Anfrage stellen." Link heißt "Neue Anfrage", Karte ist kürzer (endet bei y≈897) als in der Pauschalen-Variante. |
| shots-1280-light__kunde-absage-ohne-pauschale-weitervermittelt.png | Gleiche Karte, Text "Dir entstehen keine Kosten. Wir haben deine Anfrage an andere Firmen weitergegeben." Link hier "Zur neuen Anfrage" (anderes Label als im Bild davor). |
| shots-1280-light__partner-absage-betrag-geaendert.png | Sheet "Auftrag absagen" mit roter Meldung "Der Betrag hat sich geändert. Prüfe die Folgen neu und bestätige erneut." oben. Beide Radiokarten ("Mit Pauschale", "Ohne Pauschale") sind unausgewählt, "Absagen" ist blassteal (deaktiviert). Betragskarte 80,00 / Gebühr 12,00 / Du erhältst 68,00, alle Beträge rechtsbündig und einzeilig. |
| shots-1280-light__partner-absage-fehler.png | Sheet im Grund-Schritt mit roter Meldung "Für diesen Auftrag läuft eine Prüfung. Absagen geht gerade nicht." Darunter weiter grauer Satz "Der Kunde wird informiert ..." und aktiver dunkelteal Knopf "Folgen prüfen"; "Vor Ort anders als gebucht" mit gefülltem Teal-Radio. Überschrift "Grund" fett vor den drei Karten. |
| shots-1280-light__partner-absage-grund.png | Sheet ohne Fehlerzeile, Radio "Vor Ort anders als gebucht" gewählt (dunkler Teal-Punkt), zwei weitere leere Kreise. "Folgen prüfen" dunkelteal, "Doch nicht" als Teal-Textlink mittig darunter. Dünne Linie unten am Sheet-Rand (y≈1215). |
| shots-1280-light__partner-absage-karte-mit-pauschale.png | Karte "Beendet", Pille "Von dir storniert". Zeilen "Pauschale 69,00 €" und "Du erhältst 58,65 €", Beträge rechtsbündig einzeilig. Knopf "Kontakt und Adresse anzeigen" (hellgrau, Teal-Text) sichtbar, darunter Hinweis "bleiben nach dem Ende nur kurze Zeit sichtbar". |
| shots-1280-light__partner-absage-karte-ohne-pauschale.png | Karte "Beendet": Text "Storniert, es fällt kein Betrag an." in Grau, darunter kleiner Hinweis "Kontakt und Adresse sind gesperrt ...". Kein Kontakt-Knopf, kein Betrag. |
| shots-1280-light__partner-absage-netzfehler-senden.png | Sheet geschlossen. Zwischen "Offene Anfragen" und "Angenommen" eine weiße Hinweiskarte "Wir wissen nicht, ob die Absage angekommen ist. Die Aufträge wurden neu geladen. Prüfe den Status des Auftrags." in Schwarz (nicht rot). Auftragskarte weiter "Angenommen" mit 689,61 € / 586,17 €, "Auftrag absagen" als Textlink. |
| shots-1280-light__partner-absage-netzfehler-vorschau.png | Sheet im Grund-Schritt, rote Zeile "Keine Verbindung. Prüfe dein Netz und versuche es erneut." in einer Zeile, "Folgen prüfen" aktiv dunkelteal. |
| shots-1280-light__partner-absage-ohne-pauschale.png | Bestätigungs-Schritt: "Grund: Kann ich nicht durchführen", Text "Der Kunde muss nichts zahlen. Weitervermittlung, wenn der Termin es zulässt ...", Knopf "Absagen" aktiv dunkelteal, darunter "Zurück" links und "Doch nicht" rechts. Dahinter die abgedunkelte Karte, "689,61 €" noch einzeilig. |
| shots-1280-light__partner-absage-pauschale.png | Schritt mit gewähltem "Mit Pauschale" (gefüllter Radio), Betragskarte 69,00 / 10,35 / 58,65, Zeile "1 Foto wird beim Senden hochgeladen", Datei "beleg.png" mit "Entfernen" wird unten von der Fixierleiste angeschnitten. Knopf "Für 69,00 € absagen" mit Betrag in einer Zeile. |

## Findings

**hoch**
- Keine.

**mittel**
- partner-absage-pauschale: Zeile "beleg.png / Entfernen" wird am unteren Rand des Scrollbereichs von der Trennlinie der Fixierleiste angeschnitten. Prüfen, ob der Bereich scrollt und der Inhalt unten Luft (Padding) hat; im Screenshot wirkt "Entfernen" abgeschnitten. Fix: Scrollbereich mit padding-bottom, im Test nach unten scrollen und erneut aufnehmen.
- partner-absage-fehler: Rote Meldung "Absagen geht gerade nicht" steht neben dem unveränderten Satz "Der Kunde wird informiert ..." und einem aktiven Knopf "Folgen prüfen". Der Text passt nicht zum Zustand (nichts wird abgesagt, der Kunde wird nicht informiert). Fix: Bei diesem Fehler den Informiert-Satz ausblenden oder den Knopf deaktivieren.

**niedrig**
- Alle 1280-Sheet-Bilder: Das Abdunkeln endet bei y≈1217, darunter ist die Seite (Dokumente) unabgedunkelt, und das Sheet endet dort hart. Wahrscheinlich Full-Page-Screenshot-Artefakt (Overlay in Viewport-Höhe); bei Bedarf Aufnahme im Viewport statt Full-Page.
- kunde-absage-ohne-pauschale-keine-folgeanfrage und -weitervermittelt: Link heißt einmal "Neue Anfrage", einmal "Zur neuen Anfrage". Fix: ein Label.
- partner-absage-netzfehler-senden: Hinweiskarte in normalem Schwarz, Fehler anderswo in Rot. Einheitlichkeit prüfen, kein Fehler, da es ein Hinweis ist.
- Zeile "Gebühr" in der Partner-Maske ist bewusst (Beks entscheidet später), kein Fund. In Kunden-Bildern kein Gebührenbezug sichtbar.

Gesichtet: 12 von 12
