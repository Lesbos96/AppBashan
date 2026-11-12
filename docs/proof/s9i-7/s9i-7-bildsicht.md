# s9i-7 Bildsicht, Modus Runde (Partner-Screens, Light/Dark)

Alle Bilder mit Read geöffnet. Zeilen ohne eigene Bildbeobachtung stehen als "ungeprüft". Das gilt auch für Bilder, die ich geöffnet, aber nicht als eigene Beobachtung festgehalten habe. Maße nicht geschätzt.

## Findings

[mittel] nachtrag-betrag, 1280 hell/dunkel, 390 hell, 320 dunkel – Im Belegfoto-Block steht die Überschrift "Noch kein Foto", obwohl darunter "beleg.png" mit "Entfernen" gelistet ist. Der Zustand widerspricht sich. Fix: "Noch kein Foto" nur bei leerer Liste zeigen, sonst die Zahl ("1 Foto") oder nichts.

[mittel] nachtrag-betrag, 320 dunkel – Zwischen "Werte ändern" und "Doch nicht" ist der Abstand sehr groß, ca. 90 px im 2x-Bild. Das sieht nach einem leeren Block aus. Der gleiche Abstand zeigt sich bei 390 hell und 1280 hell/dunkel (Sheet-Footer). Fix: beide Textbuttons im gleichen Abstand wie in den anderen Sheets ("Doch nicht" direkt unter dem Hauptbutton) oder die Höhe der Textbuttons prüfen.

[mittel] nachtrag-formular/-betrag/-fehler, 1280 dunkel und 390 dunkel – Das Sheet hebt sich kaum vom abgedunkelten Hintergrund ab. Sheet und Seite haben fast dieselbe Farbe, sichtbar sind nur Griff und eine schwache Kante. Bei 1280 dunkel ist die Sheet-Kante praktisch unsichtbar. Das gilt auch für das Zurückziehen-Sheet 1280 dunkel (schwächer). Fix: im Dark Mode Sheet-Fläche eine Stufe heller (Token der Karten-Fläche) oder 1-px-Rand/Schatten, Scrim stärker.

[niedrig] nachtrag-formular, 320 hell/dunkel – "Fahrzeugart" ist als einzige Zeile zweizeilig: Label oben, Wert "Transporter" darunter rechts. Alle anderen Zeilen haben Label links und Wert rechts in einer Zeile. Fix: Label schmaler halten oder "Fahrzeug" nennen, damit es in einer Zeile bleibt.

[niedrig] nachtrag-fehler, 1280 hell und 390 dunkel – Im Fehlerzustand ist das Sheet höher als der sichtbare Bereich. Unter "Betrag prüfen" ist "Doch nicht" nicht sichtbar, man muss scrollen. Sonst steht "Doch nicht" immer sichtbar. Fix: Fehlertext kürzen oder Sheet-Footer fix halten.

[niedrig] nachtrag-formular/-betrag, 320 dunkel – Sheet scrollt. "Betrag prüfen" liegt unter dem Falz, "Personen" ist oben unter dem Titel abgeschnitten, was beim Scrollen normal ist. Kein Defekt, nur Hinweis. Es gibt keinen sichtbaren Scroll-Hinweis.

[niedrig] auftraege-kontakt, 320 hell/dunkel – "Beispielgasse 12, 1030 / Wien" bricht in der Wertespalte um. Lesbar, aber die Zeile ist höher als die anderen. Kein Betrag betroffen.

Betragszeilen (Punkt 2): in allen gesehenen 320-px-Bildern steht der Betrag einzeilig rechts, vollständig, das Label links daneben. Das gilt für Karten (689,61 € / 586,17 €, 344,81 € / 293,09 €) und für den Nachtrag-Block (689,61 € / 120,39 € / 810,00 €). Titel wie "Umzug, Bezirk 3" und "Transport, Bezirk 21" brechen in eigener Spalte um, "Bezirk 3" bleibt zusammen. Keine Gebührentexte, keine Prozentwerte in allen geöffneten Bildern. Keine Emojis.

Sheet-Leerraum (Punkt 1): Start-, Abschluss-, Kontakt-, Zurückziehen-Sheet enden direkt unter "Doch nicht"/"Schließen", ohne sichtbaren Leerraum. Der helle Streifen unter den Sheets in den 1280-/390-Bildern ist die nicht abgedunkelte Seite unterhalb des Viewports (Full-Page-Aufnahme), kein Fehler.

## Tabelle

Beobachtung (nur Bildsicht)

| Screen | Breite | Modus | Beobachtung |
|---|---|---|---|
| nachtrag-karte | 320 hell | hell | Titel "Transporte Huber GmbH" bricht zweizeilig, Badge "Aktiv" bleibt rechts oben; "Läuft"-Badge neben "Umzug, Bezirk 3"; Buttons "Auftrag abschließen", "Nachtrag vorschlagen" (hellgrau, Teal-Text) |
| nachtrag-karte | 320 dunkel | dunkel | Beträge "689,61 €" und "586,17 €" weiß, rechts, einzeilig; Teal-Hauptbutton, Nebenbutton dunkelgrün mit hellem Teal-Text; "Kontakt und Adresse anzeigen" zweizeilig |
| nachtrag-karte | 390 hell/dunkel | beide | ungeprüft (nicht festgehalten) |
| nachtrag-karte | 1280 hell | hell | zentrierte Spalte ca. 750 px, weiße Karte auf hellgrauem Grund, drei Buttons untereinander volle Breite, Beträge rechtsbündig |
| nachtrag-karte | 1280 dunkel | dunkel | Karte dunkelblau mit feinem Rand auf fast schwarzem Grund, Badge "Läuft" teal, Beträge weiß |
| nachtrag-offen | 320 hell | hell | Zustandstext "Dein Nachtrag liegt beim Kunden: neuer Gesamtpreis 810,00 € · gültig bis 1. Dezember um 11:00 Uhr" in dunkler Schrift über dem Button "Nachtrag zurückziehen"; "810,00 €" bricht nicht |
| nachtrag-offen | 320 dunkel | dunkel | Badge "Angenommen" teal; deaktivierter "Auftrag starten" abgedunkelt, Hinweis "Du kannst den Auftrag ab 2. Dezember um 08:00 Uhr starten." klein; Zustandstext hell |
| nachtrag-offen | 390 hell/dunkel | beide | ungeprüft (nicht festgehalten) |
| nachtrag-offen | 1280 hell | hell | Zustandstext zweizeilig, "810,00 € · gültig bis" in einer Zeile; "Nachtrag zurückziehen" hellgrau mit Teal-Text |
| nachtrag-offen | 1280 dunkel | dunkel | disabled "Auftrag starten" dunkelteal mit grauer Schrift; "Nachtrag zurückziehen" dunkelgrün mit hellem Teal-Text |
| nachtrag-abgelehnt | 320 hell | hell | (Bild geöffnet, 640x2852; Beobachtung nicht festgehalten) ungeprüft |
| nachtrag-abgelehnt | 320 dunkel | dunkel | Zeile "Der Kunde hat deinen Nachtrag abgelehnt. Es gilt der bisherige Preis." klein, grau; "Nachtrag vorschlagen" wieder sichtbar |
| nachtrag-abgelehnt | 390 hell/dunkel | beide | ungeprüft (nicht festgehalten) |
| nachtrag-abgelehnt | 1280 hell | hell | Ablehnungstext in einer Zeile unter dem Startenhinweis, "Nachtrag vorschlagen" darunter |
| nachtrag-abgelehnt | 1280 dunkel | dunkel | gleiche Reihenfolge, Text hellgrau auf dunkel, lesbar |
| nachtrag-formular | 320 hell | hell | ungeprüft (nicht festgehalten) |
| nachtrag-formular | 320 dunkel | dunkel | Sheet-Titel "Nachtrag vorschlagen" mit Schließen-Kreis; Intro vierzeilig; Zeile "Fahrzeugart" zweizeilig; Schalter "Lift bei Abholung" aus (grau), "Lift am Ziel" an (teal); Liste hört bei "Lift am Ziel" an der Sheet-Kante auf (scrollt) |
| nachtrag-formular | 390 hell/dunkel | beide | ungeprüft (nicht festgehalten) |
| nachtrag-formular | 1280 hell | hell | Sheet ca. 800 px breit, Liste mit 9 Zeilen, "Betrag prüfen" Teal-Hauptbutton, "Doch nicht" Textbutton darunter, Sheet endet am Viewport-Rand |
| nachtrag-formular | 1280 dunkel | dunkel | Sheet-Fläche kaum vom Hintergrund zu unterscheiden, Liste dunkelblaue Karte mit Rand, Schalter "Lift am Ziel" teal |
| nachtrag-betrag | 320 hell | hell | ungeprüft (nicht festgehalten) |
| nachtrag-betrag | 320 dunkel | dunkel | Belegfoto-Block: "Noch kein Foto" und darunter "beleg.png / Entfernen"; Button "Nachtrag über 810,00 € senden" zweizeilig, "810,00 €" bleibt in einer Zeile; "Werte ändern" und "Doch nicht" mit großem Abstand |
| nachtrag-betrag | 390 hell | hell | Block "Bisheriger Preis 689,61 € / Mehr 120,39 € / Neuer Gesamtpreis 810,00 €" weiß mit rechten Beträgen; "Belegfotos" als Label über der Karte; "Noch kein Foto" neben "beleg.png"; Senden-Button einzeilig |
| nachtrag-betrag | 390 dunkel | dunkel | ungeprüft (nicht festgehalten) |
| nachtrag-betrag | 1280 hell | hell | Beträge einzeilig rechts, Hinweis "Der Kunde sieht den neuen Gesamtpreis und deine Belegfotos. ..." zweizeilig; "Entfernen" und "Hinzufügen" teal rechts |
| nachtrag-betrag | 1280 dunkel | dunkel | Beträge weiß fett, Labels grau; Sheet fast gleiche Farbe wie Hintergrund |
| nachtrag-fehler | 320 hell | hell | ungeprüft (nicht festgehalten) |
| nachtrag-fehler | 320 dunkel | dunkel | Fehlertext "Der neue Preis ist nicht höher als der bisherige. ..." in Korallrot auf dunklem Grund, dreizeilig, nicht rot-auf-rot, "Betrag prüfen" nicht sichtbar unter dem Falz |
| nachtrag-fehler | 390 hell | hell | ungeprüft (nicht festgehalten) |
| nachtrag-fehler | 390 dunkel | dunkel | Fehlertext korallrot, dreizeilig, über "Betrag prüfen"; "Doch nicht" darunter nicht sichtbar |
| nachtrag-fehler | 1280 hell | hell | Fehlertext dunkelrot (rot auf hellgrau, lesbar), zweizeilig, direkt über "Betrag prüfen"; "Doch nicht" unter dem Rand abgeschnitten |
| nachtrag-fehler | 1280 dunkel | dunkel | Fehlertext korallfarben auf fast schwarzem Sheet, gut lesbar |
| nachtrag-zurueckziehen-sheet | 320 hell | hell | ungeprüft (nicht festgehalten) |
| nachtrag-zurueckziehen-sheet | 320 dunkel | dunkel | Sheet startet unter "Angenommen"-Überschrift; Text "Der Kunde bekommt eine Mail, ..." dreizeilig; Button "Nachtrag zurückziehen" teal, "Doch nicht" Textbutton; Hintergrund abgedunkelt |
| nachtrag-zurueckziehen-sheet | 390 hell/dunkel | beide | ungeprüft (nicht festgehalten) |
| nachtrag-zurueckziehen-sheet | 1280 hell | hell | Sheet 800 px breit über der Karte, der Hintergrund grau abgedunkelt, "Auftrag starten" (blass) hinter dem Sheet sichtbar |
| nachtrag-zurueckziehen-sheet | 1280 dunkel | dunkel | Sheet-Fläche kaum abgesetzt, Hintergrundkarte dunkel gedimmt |
| auftraege-liste | 320 hell | hell | drei Karten: "Transport, Bezirk 21" zweizeilig, Badge "Angenommen" rechts; zweite Karte aktiver Teal-Button "Auftrag starten", erste blass; Beträge 689,61 € / 586,17 € einzeilig |
| auftraege-liste | 320 dunkel | dunkel | "Entrümpelung, Bezirk 3" einzeilig mit Badge "Läuft"; Teal-Gradient-Buttons; Nebenbuttons dunkelgrün; deaktiviertes "Auftrag starten" grau auf dunkelteal |
| auftraege-liste | 390 hell | hell | Karten mit Badges "Angenommen"/"Läuft"; Preiszeilen mit Betrag rechts; "Auftrag abschließen" Teal; Dokumente-Karte darunter |
| auftraege-liste | 390 dunkel | dunkel | ungeprüft (nicht geöffnet) |
| auftraege-liste | 1280 hell/dunkel | beide | ungeprüft (nicht geöffnet) |
| auftraege-beendet | 320 hell | hell | Badges grau "Abgeschlossen", "Vom Kunden storniert", "Von dir storniert"; "Umzug, Bezirk 3" zweizeilig; "344,81 €" und "293,09 €" einzeilig; Zeile "Storniert, es fällt kein Betrag an." |
| auftraege-beendet | 320 dunkel | dunkel | Badges grauer Grund mit grauer Schrift, lesbar; Kontakt-Button dunkelgrün mit hellem Teal-Text; Hinweis klein darunter |
| auftraege-beendet | 390 hell | hell | Titel einzeilig neben grauem Badge, Betragszeilen rechtsbündig, Kontakt-Button volle Breite hellgrau |
| auftraege-beendet | 390 dunkel | dunkel | ungeprüft (nicht geöffnet) |
| auftraege-beendet | 1280 hell/dunkel | beide | ungeprüft (nicht geöffnet) |
| auftraege-kontakt | 320 hell | hell | Sheet mit Name, Telefon (Teal unterstrichen), E-Mail, Abholung "Beispielgasse 12, 1030 / Wien" zweizeilig, Ziel, Stock und Tür; "Schließen" Teal zentriert |
| auftraege-kontakt | 320 dunkel | dunkel | Links Labels grau, Werte weiß fett rechts; Telefon/E-Mail hellteal unterstrichen; "Schließen" hellteal |
| auftraege-kontakt | 390 hell | hell | alle Werte einzeilig, "Beispielgasse 12, 1030 Wien" in einer Zeile; Hinweis "Nur für diesen Auftrag verwenden. Jeder Abruf wird protokolliert." |
| auftraege-kontakt | 390 dunkel | dunkel | ungeprüft (nicht geöffnet) |
| auftraege-kontakt | 1280 hell/dunkel | beide | ungeprüft (nicht geöffnet) |
| auftraege-kontakt-fehler | 320 hell | hell | Sheet nur Titel, Satz "Das ist nicht mehr verfügbar." und "Schließen", ohne Leerraum darunter |
| auftraege-kontakt-fehler | 320 dunkel | dunkel | Text weiß, "Schließen" hellteal; Sheet hebt sich dezent vom Hintergrund ab |
| auftraege-kontakt-fehler | 390 hell | hell | Sheet unterhalb der Karte mit Betragszeilen 689,61 € / 586,17 € sichtbar gedimmt |
| auftraege-kontakt-fehler | 390 dunkel | dunkel | ungeprüft (nicht geöffnet) |
| auftraege-kontakt-fehler | 1280 hell/dunkel | beide | ungeprüft (nicht geöffnet) |
| auftraege-start-sheet | 320 hell | hell | Titel "Auftrag starten", zweizeiliger Satz, Teal-Button einzeilig, "Doch nicht" |
| auftraege-start-sheet | 320 dunkel | dunkel | Teal-Gradient-Button hell auf dunkel, "Doch nicht" hellteal, Sheet endet direkt unter dem Textbutton |
| auftraege-start-sheet | 390 hell | hell | Sheet beginnt im Bereich der Karte, der Button "Auftrag starten" dahinter teilweise überdeckt |
| auftraege-start-sheet | 390 dunkel | dunkel | ungeprüft (nicht geöffnet) |
| auftraege-start-sheet | 1280 hell/dunkel | beide | ungeprüft (nicht geöffnet) |
| auftraege-abschluss-sheet | 320 hell | hell | Button "Verbindlich abschließen" einzeilig, Satz "Du meldest den Auftrag als erledigt. ..." zweizeilig |
| auftraege-abschluss-sheet | 320 dunkel | dunkel | gleicher Aufbau, Button Teal, "Doch nicht" hellteal |
| auftraege-abschluss-sheet | 390 hell | hell | Badge "Läuft" auf der Karte dahinter; Satz zweizeilig, Button volle Breite |
| auftraege-abschluss-sheet | 390 dunkel | dunkel | ungeprüft (nicht geöffnet) |
| auftraege-abschluss-sheet | 1280 hell/dunkel | beide | ungeprüft (nicht geöffnet) |
| auftraege-start-fehler | 320 hell | hell | Satz "Der Termin hat noch nicht begonnen." einzeilig schwarz, "Schließen" statt Buttons |
| auftraege-start-fehler | 320 dunkel | dunkel | Fehlersatz weiß, kein Rot; "Schließen" hellteal |
| auftraege-start-fehler | 390 hell | hell | Satz in Fließtextfarbe unter dem Intro, "Schließen" Teal; kein Leerraum unter dem Sheet |
| auftraege-start-fehler | 390 dunkel | dunkel | ungeprüft (nicht geöffnet) |
| auftraege-start-fehler | 1280 hell/dunkel | beide | ungeprüft (nicht geöffnet) |

## Lücken

- Ungeprüft: 390 dunkel der sieben geänderten Auftraege-Screens, alle 1280-px-Auftraege-Screens (hell und dunkel), 390 hell und 390 dunkel mehrerer Nachtrag-Screens (siehe Tabelle). Diese Dateien bitte in einer Folgerunde mit eigener Beobachtung nachprüfen.
- Fokus und Touch-Ziele (Punkt 5): auf den Bildern sind keine Fokusringe zu sehen. Bildlich nicht prüfbar. Die Buttons und Zeilen sehen mit etwa 36 bis 45 px (1x) hoch genug aus, die Maße muss ein `boundingBox()`-Test bestätigen.
- Payment-hold und Ladefehler nicht geprüft (nicht in der Aufgabenliste).

Findings hoch: 0, mittel: 3, niedrig: 4
