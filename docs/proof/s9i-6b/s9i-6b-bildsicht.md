# s9i-6b Bildsicht (Modus Runde, nur UI)

Alle 54 PNG in `tmp/proof/s9i-6b/shots/` einzeln mit Read geöffnet. Maße nicht aus dem Bild geschätzt; Überlauf bei 320 px nur nach Sicht beurteilt (kein Text abgeschnitten, keine horizontale Scrollleiste erkennbar), Pixelmaße gehören in Playwright `boundingBox()`.
Vergleich: `tmp/shots/shots-390-light/partner-anfragen-liste.png` (Karten, Chips, Beträge, Buttons im selben Stil: weiße Karte mit großem Radius, Titel fett links, Chip rechts oben, Betrag fett rechtsbündig, Primärbutton Teal-Verlauf, Sekundärbutton hellgrau mit Teal-Text).

## Findings

### hoch
Keine.

### mittel
- [mittel] `shots-390-*--partner-auftraege-kontakt|kontakt-fehler|start-sheet|abschluss-sheet|start-fehler` (alle 390/1280, Light und Dark) – Das Sheet ist deutlich höher als sein Inhalt: bei 390 px liegt der Inhalt im oberen Drittel, darunter ca. zwei Drittel leere Fläche (z. B. Kontakt-Sheet: "Schließen" bei y≈980, Sheet-Unterkante bei y≈1365; Start-Fehler: Inhalt endet bei y≈900, Sheet bis y≈1420). Bei 1280 px schwebt das 640 px breite Sheet mit leerer Unterhälfte. Fix: Sheet-Höhe am Inhalt ausrichten (kein fester min-height/h-Wert), `max-height` nur als Obergrenze. Vorher prüfen, ob die Anfragen-Sheets (Fotos, Angebot) dieselbe Höhe haben; falls ja, ist das ein bestehender Stil und nur niedrig.
- [mittel] `shots-390-*--partner-320-auftraege-liste|beendet|payment-hold` – Bei 320 px bricht die Betragszeile um: Label "Preis für den Kunden" steht allein in einer Zeile, der Betrag rechtsbündig in der Zeile darunter (z. B. 689,61 € unter dem Label, "Du erhältst" daneben bleibt einzeilig). Betrag selbst bleibt in einer Zeile (Regel erfüllt), aber die Zeilen wirken uneinheitlich. Fix: Zeile als `flex-wrap` mit `justify-between` beibehalten, aber bei Umbruch Label und Betrag linksbündig untereinander oder Label kürzen ("Kundenpreis"). Kein Blocker.

### niedrig
- [niedrig] `shots-390-*--partner-320-auftraege-beendet` – Titel "Umzug, Bezirk 3" bricht in allen drei Karten so um, dass die "3" allein in Zeile 2 steht (Chip "Vom Kunden storniert" nimmt die Breite). Fix: Titel `text-wrap: balance` oder `whitespace-nowrap` für "Bezirk N" (`Bezirk&nbsp;3`).
- [niedrig] `shots-390-*--partner-320-auftraege-liste|payment-hold` – "Kontakt und Adresse anzeigen" läuft bei 320 px zweizeilig; Button wächst mit, bleibt vollständig lesbar, Höhe ≥ 44 px (nach Sicht). Optional: Label auf "Kontakt anzeigen" kürzen.
- [niedrig] `shots-390-dark--partner-auftraege-liste` (Karte 1, "Auftrag starten") – Gesperrter Startknopf ist als gesperrt erkennbar (abgedunkelter Teal, grauer Text, kein Verlauf-Glanz), der Text ist aber sehr kontrastarm. Hinweistext darunter ("Du kannst den Auftrag ab 2. Dezember um 08:00 Uhr starten.") ist klar lesbar, deshalb ausreichend. Optional: Label-Kontrast im Dark leicht anheben.
- [niedrig] `shots-390-*--partner-auftraege-payment-hold` – Bei pausierter Firma ist "Auftrag starten" voll aktiv (Teal-Verlauf) und nicht gesperrt. Banner sagt nur "Neue Aufträge nimmst du erst nach der Klärung wieder an." Passt zur Vorgabe (pausierte Firma sieht und bearbeitet nur laufende Aufträge); bitte gegen die Spec bestätigen.
- [niedrig] Beschriftung "Pauschale" kommt in keinem Shot vor. Gesehen: "Preis für den Kunden", "Betrag nach Storno" (Vom Kunden storniert, 344,81 € / Du erhältst 293,09 €), "Storniert, es fällt kein Betrag an." (Von dir storniert). Ein Zustand mit "Pauschale" ist nicht aufgenommen; falls im Code vorhanden, Shot ergänzen.
- [niedrig] Alle Kontakt-Shots – Fixturedaten ("Erika Beispiel", "erika@beispiel.test", "Beispielgasse 12") sind Testdaten im Shot, nicht in der App; kein Befund, nur Hinweis.

Keine Gebühr, kein "15 %", "Plattformgebühr", "Provision" in irgendeinem Shot sichtbar. Keine Emojis, keine Platzhaltertexte, kein "Prototyp".

## Shot-Tabelle (Datei | Beobachtung | Urteil)

Präfix je Datei: `shots-<größe>-<modus>--`. 390 = 390er Shot, 320 = `partner-320-` (aus den 390-Projekten).

| Datei | Beobachtung (nur mit Bildsicht) | Urteil |
|---|---|---|
| 390-light partner-auftraege-liste | Karte 1: Startknopf hell-türkis ausgegraut, darunter kleiner grauer Hinweis "Du kannst den Auftrag ab 2. Dezember um 08:00 Uhr starten."; Karte 2 voller dunkler Teal-Verlauf; Karte 3 Chip "Läuft" und "Auftrag abschließen"; Chips Teal mit weißer Schrift | ok |
| 390-light partner-auftraege-beendet | Chips grau auf hellgrau ("Abgeschlossen", "Vom Kunden storniert", "Von dir storniert"), Betragszeilen "689,61 €", "344,81 €" fett einzeilig; Label "Betrag nach Storno" in Karte 2; Karte 3 nur grauer Satz "Storniert, es fällt kein Betrag an." | ok |
| 390-light partner-auftraege-kontakt | Sheet auf grau abgedunkeltem Hintergrund; Telefon und E-Mail Teal und unterstrichen, rechtsbündig; Adressen fett; Zeile "Stock und Tür: 3. Stock, Tür 4"; Hinweis "Jeder Abruf wird protokolliert" | ok (Sheet zu hoch, siehe mittel) |
| 390-light partner-auftraege-kontakt-fehler | Sheet-Titel "Kontakt und Adresse", Text "Das ist nicht mehr verfügbar." in dunkler Schrift links, "Schließen" Teal mittig, große leere Fläche darunter | ok (Sheet zu hoch) |
| 390-light partner-auftraege-start-sheet | Primärbutton "Auftrag starten" Teal-Verlauf mit Schatten, darunter Teal-Textbutton "Doch nicht"; Erklärtext zweizeilig grau | ok (Sheet zu hoch) |
| 390-light partner-auftraege-abschluss-sheet | Button "Verbindlich abschließen" Teal-Verlauf, Text "Das lässt sich danach nicht mehr ändern." grau, "Doch nicht" Teal | ok (Sheet zu hoch) |
| 390-light partner-auftraege-start-fehler | Zusätzlich schwarzer Satz "Der Termin hat noch nicht begonnen." statt Primärbutton, nur "Schließen" Teal | ok |
| 390-light partner-auftraege-payment-hold | Chip "Pausiert" beige mit braunem Text, Banner dreizeilig; Auftragskarte mit aktivem "Auftrag starten"; kein Abschnitt "Offene Anfragen" | ok (siehe niedrig) |
| 390-light partner-auftraege-ladefehler | Titel "Das hat nicht geklappt" fett mittig, "Erneut versuchen" grauer Button mit Teal-Text; Abschnitt "Angenommen" fehlt | ok |
| 390-dark partner-auftraege-liste | Karten dunkelgrün mit feinem Rand, Chips mittleres Teal mit weißer Schrift; gesperrter Knopf dunkelteal mit grauem Text (kontrastarm); Aktive Knöpfe helleres Teal | ok |
| 390-dark partner-auftraege-beendet | Chips dunkelgrau mit hellgrauer Schrift, Beträge weiß fett; Kontakt-Buttons dunkel mit mintgrüner Schrift | ok |
| 390-dark partner-auftraege-kontakt | Sheet fast schwarzgrün, Telefon/E-Mail mintgrün unterstrichen, Werte weiß fett; Hintergrund dahinter stark abgedunkelt | ok (Sheet zu hoch) |
| 390-dark partner-auftraege-kontakt-fehler | Text "Das ist nicht mehr verfügbar." weiß, "Schließen" mintgrün; Schließen-Kreis oben rechts dunkelgrau mit weißem X | ok |
| 390-dark partner-auftraege-start-sheet | Button "Auftrag starten" helleres Teal-Verlauf, "Doch nicht" mintgrün | ok |
| 390-dark partner-auftraege-abschluss-sheet | "Verbindlich abschließen" Teal, Titel zentriert weiß, X-Kreis dunkelgrau | ok |
| 390-dark partner-auftraege-start-fehler | Weißer Satz "Der Termin hat noch nicht begonnen." gut lesbar, mintgrünes "Schließen" | ok |
| 390-dark partner-auftraege-payment-hold | Chip "Pausiert" dunkelgrau mit beiger Schrift, Karte mit Angenommen-Chip Teal, aktiver Startknopf | ok |
| 390-dark partner-auftraege-ladefehler | Mintgrüner Text "Erneut versuchen" auf dunklem Petrol-Button, Titel weiß | ok |
| 320-light partner-320-auftraege-liste | Firmenname "Transporte Huber GmbH" bricht auf zwei Zeilen; "Preis für den Kunden" allein, Betrag 689,61 € darunter rechts; "Du erhältst 586,17 €" bleibt einzeilig; Kontakt-Button zweizeilig | mittel (Betragszeile) |
| 320-dark partner-320-auftraege-liste | Gleiche Umbrüche; Chip "Angenommen" neben "Transport, Bezirk 21" zweizeilig; gesperrter Knopf dunkel mit grauem Text | mittel (Betragszeile) |
| 320-light partner-320-auftraege-beendet | Titel "Umzug, Bezirk / 3" mit verwaister "3", Chip "Vom Kunden storniert" daneben; "344,81 €" und "293,09 €" einzeilig | niedrig |
| 320-dark partner-320-auftraege-beendet | Dieselbe verwaiste "3", Beträge weiß fett einzeilig, Hinweis "Kontakt und Adresse bleiben nach dem Ende nur kurze Zeit sichtbar." zweizeilig | niedrig |
| 320-light partner-320-auftraege-kontakt | Zeile "Abholung" bricht: Label oben, Adresse "Beispielgasse 12, 1030 Wien" fett eine Zeile tiefer; übrige Zeilen einzeilig; Karte 1 dahinter mit blassem Kontakt-Button | ok |
| 320-dark partner-320-auftraege-kontakt | Gleicher Umbruch bei "Abholung", E-Mail mintgrün vollständig sichtbar, nichts abgeschnitten | ok |
| 320-light partner-320-auftraege-kontakt-fehler | Nur ein Satz und "Schließen", Sheet-Unterkante bei y≈950 mit grauer Linie | ok |
| 320-dark partner-320-auftraege-kontakt-fehler | Weißer Satz, mintgrünes "Schließen", Sheet dunkler als Hintergrund | ok |
| 320-light partner-320-auftraege-start-sheet | Erklärtext zweizeilig, "Auftrag starten" Primärbutton volle Breite, hinter dem Sheet Kontakt-Button zweizeilig | ok |
| 320-dark partner-320-auftraege-start-sheet | Primärbutton Teal-Verlauf, "Doch nicht" mintgrün zentriert | ok |
| 320-light partner-320-auftraege-abschluss-sheet | Titel "Auftrag abschließen" mittig neben X-Kreis ohne Überlappung | ok |
| 320-dark partner-320-auftraege-abschluss-sheet | Button-Text "Verbindlich abschließen" in einer Zeile, nicht abgeschnitten | ok |
| 320-light partner-320-auftraege-start-fehler | Satz "Der Termin hat noch nicht begonnen." füllt die Breite einzeilig bis zum Rand, kein Überlauf sichtbar | ok |
| 320-dark partner-320-auftraege-start-fehler | Gleicher Satz weiß, "Schließen" mintgrün zentriert | ok |
| 320-light partner-320-auftraege-payment-hold | Banner viertzeilig, Chip "Pausiert" beige oben rechts; "Preis für den Kunden" mit Betrag in Folgezeile | mittel (Betragszeile) |
| 320-dark partner-320-auftraege-payment-hold | Chip "Pausiert" grau-beige, Betragszeile wie Light umgebrochen, Startknopf Teal | mittel (Betragszeile) |
| 320-light partner-320-auftraege-ladefehler | Fehlertext dreizeilig mittig, "Erneut versuchen" hellgrauer Button | ok |
| 320-dark partner-320-auftraege-ladefehler | Petrol-Button mit mintgrüner Schrift, Titel weiß zentriert | ok |
| 1280-light partner-auftraege-liste | Zentrierte Spalte (ca. 535 px breit) auf hellgrauem Grund, Chips "Angenommen"/"Läuft" rechts oben, "689,61 €" rechtsbündig, Primärknöpfe über volle Kartenbreite | ok |
| 1280-dark partner-auftraege-liste | Dunkler Grund, Karten dunkelgrün, gesperrter Knopf mit grauer Schrift, Hinweistext einzeilig | ok |
| 1280-light partner-auftraege-beendet | Drei Karten mit grauen Chips, "Betrag nach Storno 344,81 €" und "Du erhältst 293,09 €", Hinweis einzeilig | ok |
| 1280-dark partner-auftraege-beendet | Chips dunkelgrau, Kontakt-Buttons petrolgrün mit mintgrüner Schrift | ok |
| 1280-light partner-auftraege-kontakt | Sheet ca. 810 px breit mittig, Ecken oben rund, unten flach abgeschnitten; Hintergrund abgedunkelt nur bis y≈1250 (Full-Page-Artefakt), unten heller Streifen | ok (Sheet zu hoch) |
| 1280-dark partner-auftraege-kontakt | Sheet kaum vom Grund abgehoben (dunkel auf dunkel), Inhalt aber klar | ok |
| 1280-light partner-auftraege-kontakt-fehler | Nur zwei Zeilen Inhalt in 750 px hohem Sheet | ok (Sheet zu hoch) |
| 1280-dark partner-auftraege-kontakt-fehler | Weißer Satz, mintgrünes "Schließen", Handle oben grau | ok |
| 1280-light partner-auftraege-start-sheet | Button "Auftrag starten" Teal über volle Sheetbreite, Sheet-Beginn bei y≈500 | ok |
| 1280-dark partner-auftraege-start-sheet | Hellere Teal-Fläche als Light, "Doch nicht" mintgrün | ok |
| 1280-light partner-auftraege-abschluss-sheet | Text "Du meldest den Auftrag als erledigt. Das lässt sich danach nicht mehr ändern." zweizeilig grau | ok |
| 1280-dark partner-auftraege-abschluss-sheet | "Verbindlich abschließen" Teal, Titel weiß | ok |
| 1280-light partner-auftraege-start-fehler | "Der Termin hat noch nicht begonnen." dunkel, kein Primärbutton | ok |
| 1280-dark partner-auftraege-start-fehler | Weiße Schrift, "Schließen" mintgrün | ok |
| 1280-light partner-auftraege-payment-hold | Banner zweizeilig, Chip "Pausiert" beige, aktiver Startknopf, Beträge einzeilig | ok |
| 1280-dark partner-auftraege-payment-hold | Chip dunkelgrau mit beiger Schrift, Beträge weiß fett | ok |
| 1280-light partner-auftraege-ladefehler | Fehlerblock zentriert, "Erneut versuchen" ca. 710 px breiter grauer Button (breiter als Karten) | ok |
| 1280-dark partner-auftraege-ladefehler | Petrolgrauer Button, mintgrüne Schrift, Titel weiß | ok |

Offene Findings hoch: 0
