# Review paket-5 (Modus Runde, nur UI, Bildsicht)

Bilder: Kunde 320 px (Faktor 2, 640 breit), Kunde 390 px (780 breit), Partner 320 px (640 breit). Alle Light. Maße nicht aus dem Bild geschätzt.

| Bild | Beobachtung (nur per Bildsicht) |
|---|---|
| kunde-absage-320-mit-pauschale | Karte "Absage der Firma" nennt "69,00 €" fett in einer Zeile (Zahl und € zusammen). Der Text bricht davor und danach um. Unten steht "Neue Anfrage" als dunkelteal unterstrichener Textlink. Oben sitzt das graue Badge "Storniert". Das Wort Gebühr, Provision oder 15 % fehlt. |
| kunde-absage-320-ohne-pauschale-keine-folgeanfrage | Karte "Absage der Firma" sagt "Dir entstehen keine Kosten. Du kannst jederzeit eine neue Anfrage stellen." Es steht kein Betrag in der Karte. Der Link heißt "Neue Anfrage". Der Preis "689,61 €" in der Kopfkarte steht rechtsbündig fett in einer Zeile. |
| kunde-absage-320-ohne-pauschale-weitervermittelt | Text in drei Zeilen: "Wir haben deine Anfrage an andere Firmen weitergegeben." Der Link lautet hier "Zur neuen Anfrage", also anders als in der Variante ohne Folgeanfrage. Das Datum "Dienstag, 15. Dezember 2026 ·" bricht mit dem Mittelpunkt am Zeilenende. |
| kunde-absage-mit-pauschale (390) | "Die Firma macht eine Pauschale von / 69,00 € geltend." Der Betrag steht fett am Zeilenanfang und ist nicht getrennt. Der Text läuft über 4 Zeilen, nichts ist abgeschnitten. Unter der Karte bleibt etwa die Hälfte des Bildes leeres Hellgrau (Hintergrund). Das Datum bricht mit einem einzelnen "Uhr" in Zeile 2. |
| kunde-absage-ohne-pauschale-keine-folgeanfrage (390) | Zwei Zeilen Text in der Karte, der Link "Neue Anfrage" steht darunter. Die Karte ist kürzer als die Pauschale-Variante. Die Kartenränder und -radien sind gleich wie in den Nachbarkarten (Verlauf). Das einzelne "Uhr" steht wieder auf Zeile 2 des Datums. |
| kunde-absage-ohne-pauschale-weitervermittelt (390) | "Wir haben deine Anfrage an andere Firmen weitergegeben." läuft über 3 Zeilen, der Link heißt "Zur neuen Anfrage". Das Badge "Storniert" ist grau auf hellgrauem Grund. Der Preis in der Kopfkarte steht in einer Zeile. |
| partner-320-absage-betrag-geaendert | Der rote Fehlertext "Der Betrag hat sich geändert. Prüfe die Folgen neu und bestätige erneut." steht oben im Sheet. Darunter steht "Grund: Vor Ort anders als gebucht". Die weiße Karte zeigt "Pauschale inkl. USt. 80,00 €", "Gebühr 12,00 €" und "Du erhältst 68,00 €" mit rechtsbündigen fetten Beträgen, jeder in einer Zeile. "Absagen" ist blass (deaktiviert). Unter "Mit Pauschale" läuft die Option "Ohne Pauschale" hinter die Fixierleiste (Trennlinie über dem Button). Darunter stehen "Zurück" und "Doch nicht" nebeneinander. Hinter dem Sheet ist die Seite oben abgedunkelt, unterhalb des Sheets nicht. |
| partner-320-absage-fehler | Roter Hinweis "Für diesen Auftrag läuft eine Prüfung. Absagen geht gerade nicht." steht über dem Einleitungstext. Der Grund "Vor Ort anders als gebucht" ist per Radio gewählt (dunkelteal gefüllter Punkt). Der Button "Folgen prüfen" ist aktiv (dunkles Teal). Als einzige Sekundäraktion steht darunter "Doch nicht". Hinter dem Sheet ist der Titel "Partner" oben angeschnitten sichtbar. |
| partner-320-absage-grund | Grundauswahl ohne Fehler: drei weiße Pillen mit "Vor Ort anders als gebucht" (gewählt), "Kann ich nicht durchführen" und "Anderer Grund". Überschrift "Grund" fett darüber. "Folgen prüfen" ist aktiv, "Doch nicht" darunter. Die Kartenkante "Transporte Huber / Aktiv" ragt oben hinter dem Sheet hervor, das Badge "Aktiv" ist vom Griff halb verdeckt. Unter dem Sheet verläuft eine graue Linie. |
| partner-320-absage-karte-mit-pauschale | Karte "Beendet" mit Badge "Von dir storniert" (grau). Zeilen "Pauschale 69,00 €" und "Du erhältst 58,65 €" stehen je in einer Zeile. Das Badge liegt neben "Umzug, Bezirk 3". Der Knopf "Kontakt und Adresse anzeigen" ist sichtbar (hellteal), der Text bricht in 2 Zeilen. Darunter steht der Hinweis "Kontakt und Adresse bleiben nach dem Ende nur kurze Zeit sichtbar." |
| partner-320-absage-karte-ohne-pauschale | Dieselbe Karte, aber ohne Beträge. Es steht dort "Storniert, es fällt kein Betrag an." Der Kontakt-Knopf fehlt. Ersatz ist der kleine graue Text "Kontakt und Adresse sind gesperrt, weil keine Pauschale anfällt." Die Karte ist deutlich kürzer. |
| partner-320-absage-netzfehler-senden | Weiße Hinweiskarte "Wir wissen nicht, ob die Absage angekommen ist. Die Aufträge wurden neu geladen. Prüfe den Status des Auftrags." steht zwischen "Gerade gibt es keine offenen Anfragen" und "Angenommen". Die Karte hat keine Farbe und kein Icon. Die Karte "Umzug, Bezirk 3" hat das dunkelgrüne Badge "Angenommen". Sie zeigt "Preis für den Kunden 689,61 €" und "Du erhältst 586,17 €" in je einer Zeile. "Auftrag starten" ist blass, "Auftrag absagen" ist ein Textlink. |

## Findings

### hoch
Keine.

### mittel
- partner-320-absage-netzfehler-senden: Der Netzfehler-Hinweis ist eine neutrale weiße Karte ohne Fehlerfarbe, ohne Icon und ohne Bezug zum Auftrag. Er steht oberhalb von "Angenommen", und der betroffene Auftrag steht weiter unten. Bei längeren Listen liegt er außerhalb des Bildschirms. Fix: Hinweis am betroffenen Auftrag platzieren oder in Fehlerfarbe wie im Sheet absetzen, und prüfen, ob er sichtbar bleibt (nicht verdeckt).
- partner-320-absage-betrag-geaendert: Bei 320 px zeigt der Sheet-Inhalt nach Fehler, Grund und Betragskarte nur noch "Mit Pauschale" ganz und "Ohne Pauschale" angeschnitten unter der Fixierleiste. Der Button "Absagen" ist deaktiviert, ohne dass die Ursache (keine Wahl) sichtbar ist. Es gibt keinen Hinweis, dass der Inhalt scrollt. Fix: Fehlerzeile und Grundzeile kompakter halten oder Fehler im Scrollbereich ankern, damit beide Optionen ohne Scrollen sichtbar sind.

### niedrig
- kunde-absage-ohne-pauschale-keine-folgeanfrage und -weitervermittelt (320 und 390): Die Linktexte unterscheiden sich ("Neue Anfrage" / "Zur neuen Anfrage"). Der Link ist ein reiner Textlink; ob die Fläche 44 px erreicht, ist per Bild nicht prüfbar. Fix: per `boundingBox()` messen, Beschriftung vereinheitlichen.
- kunde-absage-* (390 und 320): Im Datum "Dienstag, 15. Dezember 2026 · 8 bis 11 Uhr" steht bei 390 px ein einzelnes "Uhr" in Zeile 2, bei 320 px der Mittelpunkt am Zeilenende. Fix: nicht trennbares Leerzeichen zwischen "11" und "Uhr", Umbruch vor "·" statt danach (nur Schönheit).
- kunde-absage-*: "Verlauf" und "Absage der Firma" sagen beide inhaltlich "Die Firma hat abgesagt". Doppelung, kein Fehler.
- partner-320-absage-betrag-geaendert und -grund: Backdrop ist im Full-Page-Shot nur im Viewport abgedunkelt, darunter nicht (Aufnahmeartefakt, kein Produktfehler). Am Sheet-Fuß erscheint in -grund eine graue Linie. Prüfen, ob sie echt ist.

Positiv geprüft (kein Befund): Beträge brechen in keinem der 12 Bilder um. Auf Kunden-Screens kommt weder "Gebühr" noch "Provision" noch "15 %" vor. Die Zeile "Gebühr 12,00 €" erscheint nur in der Partner-Maske (bewusst, laut Auftrag kein Fund). Die Rechnungen stimmen (80 - 12 = 68; 69 x 0,85 = 58,65; 689,61 x 0,85 = 586,17). Es gibt keine Emojis und keine Platzhaltertexte.

Gesichtet: 12 von 12
