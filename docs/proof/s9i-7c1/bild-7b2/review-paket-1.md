# Review paket-1 (1280 px, Dark, 12 Bilder)

| Bild | Beobachtung (nur per Bildsicht) |
|---|---|
| shots-1280-dark__kunde-absage-mit-pauschale.png | Zentrierte Spalte, dunkles Petrol. Karte „Absage der Firma": Satz „Die Firma macht eine Pauschale von 69,00 € geltend…" mit fett gesetztem „69,00 €" in einer Zeile, darunter türkis unterstrichener Link „Neue Anfrage". Oben grauer Chip „Storniert", Preiszeile „689,61 €" rechtsbündig in einer Zeile. Kein Wort zu Gebühr. |
| shots-1280-dark__kunde-absage-ohne-pauschale-keine-folgeanfrage.png | Gleiche Karten. Absage-Karte hat nur „Dir entstehen keine Kosten. Du kannst jederzeit eine neue Anfrage stellen." und den Link „Neue Anfrage"; Karte ist niedriger (endet bei y≈895) als beim Fall mit Pauschale, kein Betrag. |
| shots-1280-dark__kunde-absage-ohne-pauschale-weitervermittelt.png | Text „Dir entstehen keine Kosten. Wir haben deine Anfrage an andere Firmen weitergegeben." Link heißt hier „Zur neuen Anfrage" (länger, unterstrichen, türkis), im Schwesterbild „Neue Anfrage". |
| shots-1280-dark__partner-absage-betrag-geaendert.png | Sheet „Auftrag absagen" über abgedunkeltem Hintergrund; oben korallroter Hinweis „Der Betrag hat sich geändert. Prüfe die Folgen neu und bestätige erneut." (zweizeilig). Karte: Pauschale inkl. USt. 80,00 €, Gebühr 12,00 €, Du erhältst 68,00 €, Beträge rechtsbündig in einer Zeile. Beide Radios „Mit/Ohne Pauschale" unselektiert (graue Kreise), Primärknopf „Absagen" sichtbar gedimmt (graue Schrift auf dunklem Teal). |
| shots-1280-dark__partner-absage-fehler.png | Hinweis in Koralle „Für diesen Auftrag läuft eine Prüfung. Absagen geht gerade nicht." (Umbruch lässt „nicht." allein in Zeile 2). Darunter Grundauswahl, erster Radio türkis gefüllt „Vor Ort anders als gebucht". Knopf „Folgen prüfen" voll türkis, darunter zentriert „Doch nicht". |
| shots-1280-dark__partner-absage-grund.png | Kein Fehlertext. Zeilen „Der Kunde wird informiert…", Überschrift „Grund", drei Radiokarten, erste mit türkisem Punkt. Knopf „Folgen prüfen" aktiv, „Doch nicht" zentriert darunter. Dahinter sichtbar „Angenommen"-Überschrift abgedunkelt. |
| shots-1280-dark__partner-absage-karte-mit-pauschale.png | Ohne Sheet. Karte unter „Beendet": Chip „Von dir storniert", Zeilen „Pauschale 69,00 €" und „Du erhältst 58,65 €", beide Beträge in einer Zeile, darunter sichtbarer Knopf „Kontakt und Adresse anzeigen" (dunkles Teal, türkise Schrift) und kleiner Hinweis „…nur kurze Zeit sichtbar". |
| shots-1280-dark__partner-absage-karte-ohne-pauschale.png | Karte „Von dir storniert": statt Beträgen graue Zeile „Storniert, es fällt kein Betrag an." und Hinweis „Kontakt und Adresse sind gesperrt, weil keine Pauschale anfällt." Kein Kontakt-Knopf, Karte endet bei y≈770. |
| shots-1280-dark__partner-absage-netzfehler-senden.png | Kein Sheet sichtbar. Stattdessen neutrale Karte mit Text „Wir wissen nicht, ob die Absage angekommen ist. Die Aufträge wurden neu geladen. Prüfe den Status des Auftrags." zwischen „Offene Anfragen" und „Angenommen". Auftragskarte noch „Angenommen" mit „Auftrag absagen"-Link; Beträge 689,61 € / 586,17 € einzeilig. Hinweiskarte hat keinen Fehler-/Warnakzent. |
| shots-1280-dark__partner-absage-netzfehler-vorschau.png | Sheet Schritt 1 mit korallrotem Text „Keine Verbindung. Prüfe dein Netz und versuche es erneut." einzeilig, Grundauswahl mit erstem Radio gefüllt, „Folgen prüfen" aktiv. |
| shots-1280-dark__partner-absage-ohne-pauschale.png | Sheet Schritt 2 „Grund: Kann ich nicht durchführen" klein grau, großer weißer Fließtext „Der Kunde muss nichts zahlen. Weitervermittlung…", kleiner Zusatz „Mehrere Absagen…". Knopf „Absagen" türkis aktiv, darunter nebeneinander „Zurück" und „Doch nicht". Hintergrund zeigt „689,61 €" vom Sheet-Rand angeschnitten. |
| shots-1280-dark__partner-absage-pauschale.png | Sheet Schritt 2 mit Pauschale: Karte 69,00 € / Gebühr 10,35 € / Du erhältst 58,65 €; Radio „Mit Pauschale" türkis gewählt. Abschnitt „Belegfotos" mit Karte „1 Foto wird beim Senden hochgeladen", Zeile „beleg.png … Entfernen"; Karte wird am Fußtrenner abgeschnitten. Primärknopf „Für 69,00 € absagen" einzeilig. Sheet-Oberkante überdeckt die Überschrift „Partner" (nur Buchstabenoberkanten sichtbar). |

## Findings

### hoch
Keine.

### mittel
- partner-absage-pauschale.png: Der Bereich „Belegfotos" wird am Fußtrenner des Sheets mitten in der Zeile „beleg.png / Entfernen" abgeschnitten; Kartenrand und eine mögliche „Foto hinzufügen"-Aktion sind nicht sichtbar, es gibt keinen Hinweis, dass der Inhalt scrollt. Fix: Scroll-Bereich im Sheet sichtbar machen (Verlauf/Schatten am Rand) oder Sheet-Höhe so wählen, dass die Foto-Karte vollständig steht. Prüfen, ob der Auswahl-Knopf für weitere Fotos erreichbar ist (per Playwright scrollen und messen; aus dem Bild nicht entscheidbar).
- partner-absage-netzfehler-senden.png: Die Meldung „Wir wissen nicht, ob die Absage angekommen ist…" steht in einer neutralen Karte ohne Warnfarbe oder Überschrift, im Sheet dagegen sind Fehler korallrot. Sie kann leicht überlesen werden. Fix: gleiche Fehlerfarbe/Akzent wie im Sheet oder Überschrift („Absage unklar") verwenden.

### niedrig
- kunde-absage-ohne-pauschale-weitervermittelt.png vs. kunde-absage-ohne-pauschale-keine-folgeanfrage.png: Link heißt „Zur neuen Anfrage" bzw. „Neue Anfrage". Fix: einheitliche Beschriftung. Touch-Ziel der unterstrichenen Links per `boundingBox()` auf 44 px prüfen (aus dem Bild nicht messbar, Links wirken als reine Textzeile).
- partner-absage-pauschale.png / betrag-geaendert.png: Die Beschriftung „Belegfotos" ist eingerückt (x≈627) gegenüber „Grund: …" und Hinweiszeilen (x≈603), unterschiedliche linke Kante im Sheet. Fix: gleiche Einrückung oder bewusst als Gruppenlabel kennzeichnen.
- partner-absage-pauschale.png: Sheet überdeckt oben die Seitenüberschrift „Partner" bis auf die Oberkanten; wirkt wie ein Rendering-Rest. Fix: Sheet-Höhe/Offset bei Full-Page-Shot prüfen (vermutlich Artefakt des Screenshots, im Viewport nicht auftretend).
- Alle Partner-Sheets bei 1280 px: Das Sheet ist breiter (≈790 px) als die zentrierte Spalte der Seite (≈750 px). Falls gewollt, ok; sonst an Spaltenbreite angleichen.
- partner-absage-betrag-geaendert.png: Deaktivierter Knopf „Absagen" hat sehr geringen Schriftkontrast (grau auf dunklem Teal). Bei Disabled zulässig; Zustand ist aber nur durch Dimmung erkennbar, ein Satz „Wähle eine Option" fehlt. Fix optional.
- Gebühr-Zeile in der Partner-Absage-Maske (10,35 € bzw. 12,00 €): bewusst, kein Fund. In den Kunden-Screens kein Gebührenhinweis, Beträge „69,00 €", „689,61 €" nirgends umgebrochen.

Gesichtet: 12 von 12
