# Review paket-3 (Modus Runde, Dark; Bildsicht)

Alle 12 Bilder mit Read geöffnet. Die Bilder `-320-` sind bei 320 px aufgenommen (640 px breit); die übrigen bei 390 px (780 px breit).

| Bild | Beobachtung (nur per Bildsicht) |
|---|---|
| kunde-absage-320-mit-pauschale | Karte „Absage der Firma“: „69,00 €“ steht fett in einer Zeile mitten im Satz „Die Firma macht eine Pauschale von 69,00 € geltend.“ Der Link „Neue Anfrage“ ist türkis unterstrichen. Kein Wort zu Gebühr oder Provision. Preiszeile „689,61 €“ steht rechtsbündig in einer Zeile. |
| kunde-absage-320-ohne-pauschale-keine-folgeanfrage | Text „Dir entstehen keine Kosten. Du kannst jederzeit eine neue Anfrage stellen.“, darunter türkiser Link „Neue Anfrage“. Das Statuschip „Storniert“ ist grau auf dunkelgrau. Kein Betrag in der Absage-Karte. |
| kunde-absage-320-ohne-pauschale-weitervermittelt | Text „… Wir haben deine Anfrage an andere Firmen weitergegeben.“ mit Link „Zur neuen Anfrage“. Der Linktext unterscheidet sich vom Bild ohne Weitervermittlung („Neue Anfrage“), passt zum Zustand. |
| kunde-absage-mit-pauschale | 390 px: Der Satz bricht anders um als bei 320 px („Pauschale von / 69,00 € geltend.“). „69,00 €“ bleibt zusammen und fett. Unter der Karte ist viel leerer dunkler Raum (Full-Page-Höhe 844). Im Datum steht „Uhr“ allein in der zweiten Zeile. |
| kunde-absage-ohne-pauschale-keine-folgeanfrage | Zweizeiliger Text, danach Link „Neue Anfrage“. Die Karte ist kürzer als im Pauschale-Bild, Abstand Text zu Link gleich groß. Kontrast heller Text auf dunkelblaugrüner Karte gut lesbar. |
| kunde-absage-ohne-pauschale-weitervermittelt | Dreizeiliger Text („… weitergegeben.“ mit „weitergegeben.“ allein in der dritten Zeile), Link „Zur neuen Anfrage“. Karte etwas höher als im Bild ohne Weitervermittlung. |
| partner-320-absage-betrag-geaendert | Roter (lachsfarbener) Fehlertext „Der Betrag hat sich geändert. Prüfe die Folgen neu und bestätige erneut.“ oben im Sheet. Karte mit „Pauschale inkl. USt. 80,00 € / Gebühr 12,00 € / Du erhältst 68,00 €“, die Beträge stehen rechtsbündig in einer Zeile. Beide Radios sind leer (Auswahl zurückgesetzt). Der Knopf „Absagen“ ist ausgegraut. Darunter „Zurück“ links und „Doch nicht“ rechts. Die Option „Ohne Pauschale“ ist an der Fixierleiste abgeschnitten (Titel sichtbar, Beschreibung weg). |
| partner-320-absage-fehler | Roter Fehlertext „Für diesen Auftrag läuft eine Prüfung. Absagen geht gerade nicht.“ steht über dem Erklärtext. Radio „Vor Ort anders als gebucht“ ist türkis gefüllt, die anderen zwei sind grau. „Folgen prüfen“ ist als türkiser Verlaufsknopf aktiv, nur „Doch nicht“ darunter. Die Überschrift „Partner“ ragt halb abgedunkelt über die Sheet-Oberkante. |
| partner-320-absage-grund | Grundauswahl mit drei Zeilen (je 44 px+ hoch), erste markiert. Der Knopf „Folgen prüfen“ ist aktiv und die Zeile „Doch nicht“ ist zentriert. Kein Fehlertext. Die Karte „Transporte Huber“ ist hinter dem Sheet angeschnitten sichtbar. |
| partner-320-absage-karte-mit-pauschale | Karte „Beendet“, Chip „Von dir storniert“, Zeilen „Pauschale 69,00 €“ und „Du erhältst 58,65 €“, beide Beträge fett in einer Zeile. Der Knopf „Kontakt und Adresse anzeigen“ ist sichtbar (zweizeilig umgebrochen) mit Hinweis „… nur kurze Zeit sichtbar“. |
| partner-320-absage-karte-ohne-pauschale | Karte „Beendet“, grauer Text „Storniert, es fällt kein Betrag an.“ und „Kontakt und Adresse sind gesperrt, weil keine Pauschale anfällt.“ Der Kontakt-Knopf ist ausgeblendet. Es gibt keine Betragszeilen. |
| partner-320-absage-netzfehler-senden | Neutrale Hinweiskarte (keine rote Farbe) „Wir wissen nicht, ob die Absage angekommen ist. Die Aufträge wurden neu geladen. Prüfe den Status des Auftrags.“ zwischen „Offene Anfragen“ und „Angenommen“. Die Auftragskarte ist noch „Angenommen“ mit Link „Auftrag absagen“. „Preis für den Kunden 689,61 €“ und „Du erhältst 586,17 €“ stehen in einer Zeile. Der Knopf „Auftrag starten“ ist ausgegraut. |

## Findings

### hoch
Keine.

### mittel
- partner-320-absage-betrag-geaendert: Bei 320 px bleibt im Sheet nur Platz für etwa 1,5 Optionen. Fehlertext, Grundzeile und Betragskarte nehmen den Raum, und die Fixierleiste hat drei Zeilen (Absagen, Zurück, Doch nicht). „Ohne Pauschale“ ist abgeschnitten, ohne sichtbaren Hinweis auf Scrollen. Fix: Fixierleiste kompakter (Zurück und Doch nicht in eine Zeile ist schon so, evtl. Knopfhöhe verkleinern) oder Fehlertext und Grundzeile kürzen. Alternativ einen Scroll-Hinweis (Verlauf/Schatten am Rand des Bereichs) ergänzen.

### niedrig
- partner-320-absage-fehler: Der Fehler „Absagen geht gerade nicht“ erscheint, während „Folgen prüfen“ weiter aktiv ist und der Erklärtext „Was das für ihn und für dich bedeutet, siehst du im nächsten Schritt“ steht. Das ist widersprüchlich. Fix: Erklärtext im Fehlerzustand ausblenden oder den Knopf deaktivieren.
- partner-320-absage-fehler und -grund: Die Überschrift „Partner“ und die Karte schauen angeschnitten über die Sheet-Oberkante. Das ist Full-Page-Aufnahme mit fixem Sheet, vermutlich ein Screenshot-Artefakt. Prüfen, ob das Sheet im echten Viewport (Höhe 640) auch den Raum darüber so zeigt.
- partner-320-absage-netzfehler-senden: Der Hinweis hat keinen Fehler- oder Warnton (Rahmen und Fläche wie normale Karte) und der Text bricht früh um (rechter Rand etwa 60 px leer). Fix: Warnfarbe oder Icon, volle Zeilenbreite.
- kunde-absage-320-*: Im Datum steht „·“ am Zeilenende (320 px) und bei 390 px „Uhr“ allein in der zweiten Zeile. Fix: „8 bis 11 Uhr“ mit geschützten Leerzeichen zusammenhalten, Datum und Zeit in zwei Zeilen.
- partner-320-absage-karte-mit-pauschale: Bei „Kontakt und Adresse anzeigen“ bricht die Beschriftung auf zwei Zeilen um (bei 320 px), die Zeilenhöhe im Knopf ist locker. Kein Fehler, nur optisch.

Hinweis: Die Zeile „Gebühr 12,00 €“ im Partner-Sheet ist laut Auftrag bewusst, kein Fund. Keine Gebühr, Provision oder 15 % in den Kunden-Screens sichtbar.

Gesichtet: 12 von 12
