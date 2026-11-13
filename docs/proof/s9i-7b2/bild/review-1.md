# Review Runde 1, s9i-7b2 Absage-UI (nur Bilder)

Geoeffnet: 62 Absage-Bilder (alle Projekte) plus Referenz partner-nachtrag-betrag.png (390 light). Einige Bilder wurden zweimal geoeffnet. Beobachtungen aus dem Bild; Masse nicht geschaetzt.

Gesamte Funde:
- [mittel] Feld "Grund" im Sheet Schritt 1 (390 und 320, light und dark): Wert wird hart abgeschnitten ("Der Auftrag ist vor Ort anders al" bei 390, "Der Auftrag ist vor Ort ." mit Rest-Punkt bei 320), kein Umbruch, keine Auslassungspunkte. Gewaehlter Grund nicht lesbar. Fix: Wert umbrechen (Zeile waechst) oder Label oben, Wert darunter; mindestens text-overflow: ellipsis.
- [mittel] 320 px, Sheet Schritt 2 (absage-pauschale, absage-betrag-geaendert; light und dark): Scrollbereich zeigt nur Kopf der ersten Option; "Ohne Pauschale" und der Erklaertext sind ohne Scrollen nicht sichtbar, bei betrag-geaendert bleibt vom Scrollbereich ca. eine halbe Karte. Fix: Fusszeile bei kleinen Hoehen kompakter (Knoepfe "Grund aendern"/"Doch nicht" in eine Zeile) oder Sheet bis 100 Prozent Hoehe, Fehlertext im Scrollbereich statt in der Fussleiste.
- [niedrig] Dark, nicht gewaehlter Radio-Kreis ist gefuellt dunkelgrau (partner-absage-pauschale/-betrag-geaendert), im Light nur Kontur; im Dark kaum von der Karte abgehoben und als "gesetzt" lesbar. Fix: Kontur wie Light (border-Token) statt Fuellung.
- [niedrig] Kunde 390/320: "Dienstag, 15. Dezember 2026 · 8 bis 11 / Uhr" bricht mit einzelnem "Uhr" in neue Zeile (Bestand, nicht Absage-Code). Fix: "8 bis 11 Uhr" nowrap.
- [niedrig] 320: Button "Fuer 69,00 EUR Pauschale absagen" umbricht auf zwei Zeilen ("Pauschale / absagen"); Betrag bleibt in einer Zeile, daher ok, aber Knopf ist hoeher als im Rest. Hinweis, kein Muss.
- Keine Funde: Kunde sieht nirgends "Gebuehr", 10,35 oder 58,65 (alle 15 Kunden-Bilder geprueft). Kein Emoji, kein Platzhalter. Betraege in allen Bildern in einer Zeile.
- Hinweis zu Full-Page-Shots: Scrim und Sheet decken nur die Viewport-Hoehe ab, darunter erscheint ungedimmter Seiteninhalt. Das ist ein Full-Page-Screenshot-Artefakt von position: fixed, kein Bug.

## Firma, 390 light
| Bild | Bildbeobachtung | Befund |
|---|---|---|
| partner-absage-grund | Dunkler Scrim ueber Seite, weisses Sheet mit grossem Rundungsradius oben, tealer Knopf "Folgen pruefen" mit Schatten, darunter Textlink "Doch nicht"; Select zeigt "Der Auftrag ist vor Ort anders al" abgeschnitten | Fund mittel (Grund abgeschnitten) |
| partner-absage-pauschale | Radio "Mit Pauschale" schwarz gefuellt, Zeilen 69,00 EUR / 10,35 EUR / 58,65 EUR fett rechtsbuendig, Knopf "Fuer 69,00 EUR Pauschale absagen" in Teal | ok |
| partner-absage-ohne-pauschale | Kein Radio, grosser dunkler Warntext "Der Kunde muss nichts zahlen..." ueber Fusstrennlinie, Knopf "Absagen" in Teal | ok |
| partner-absage-betrag-geaendert | Beide Radios leer, Zeilen 80,00 / 12,00 / 68,00 EUR, roter Text "Der Betrag hat sich geaendert. Pruefe die Folgen neu und bestaetige erneut." ueber blass-grauem (deaktiviertem) Knopf "Absagen" | ok (Text rot auf hell, lesbar) |
| partner-absage-fehler | Roter Text "Fuer diesen Auftrag laeuft eine Pruefung. Absagen geht gerade nicht." zwischen Trennlinie und aktivem Knopf "Folgen pruefen" | ok (Knopf aktiv trotz Fehler, gewollt zum Wiederholen) |
| partner-absage-karte-ohne-pauschale | Karte unter "Beendet", graue Pille "Von dir storniert", Text "Storniert, es faellt kein Betrag an." und Kleintext zur Sperre, keine Betragszeile | ok |
| partner-absage-karte-mit-pauschale | Zeilen "Pauschale 69,00 EUR" und "Du erhaeltst 58,65 EUR" fett rechts, grau-tuerkiser Knopf "Kontakt und Adresse anzeigen" | ok (keine Zeile "Gebuehr" in der Karte, unkritisch) |

## Firma, 390 dark
| Bild | Bildbeobachtung | Befund |
|---|---|---|
| partner-absage-grund | Sheet fast schwarz-teal, Titel weiss, Knopf mit hellerem Teal-Verlauf, Link "Doch nicht" hellmint; Grund-Wert wieder abgeschnitten "...anders al" | Fund mittel (siehe oben) |
| partner-absage-pauschale | Radio gewaehlt: mint Punkt in hellem Ring; ungewaehlter Kreis dunkelgrau gefuellt; Betraege weiss fett | niedrig (Radio-Optik) |
| partner-absage-ohne-pauschale | Warntext weiss auf dunklem Sheet, Knopf "Absagen" Teal, Links mint | ok |
| partner-absage-betrag-geaendert | Fehlertext in hellem Rot/Lachs auf dunklem Grund, Knopf "Absagen" abgedunkelt mit graugruenem Text; 80,00/12,00/68,00 EUR | ok |
| partner-absage-fehler | Lachsroter Text unter Trennlinie, Knopf "Folgen pruefen" hellteal | ok |
| partner-absage-karte-ohne-pauschale | Dunkle Karte, graue Pille "Von dir storniert", grauer Hinweistext lesbar | ok |
| partner-absage-karte-mit-pauschale | 69,00 EUR / 58,65 EUR weiss fett, Knopf mint auf dunkel-tuerkis | ok |

## Firma, 320 light
| Bild | Bildbeobachtung | Befund |
|---|---|---|
| partner-320-absage-grund | Select-Wert "Der Auftrag ist vor Ort ." mit abgeschnittenem Rest und Pfeil; "Transporte Huber GmbH" umbricht auf zwei Zeilen | Fund mittel (Grund) |
| partner-320-absage-pauschale | "Pauschale inkl. / USt." zweizeilig, Betraege 69,00/10,35/58,65 EUR je einzeilig; nur Kopf der ersten Option sichtbar, Text darunter angeschnitten ("App in Rechnung. Die Anfrage" halb abgeschnitten); Knopf zweizeilig | Fund mittel (Scrollbereich klein) |
| partner-320-absage-ohne-pauschale | Warntext fuenfzeilig, Knoepfe "Absagen", "Grund aendern", "Doch nicht" alle sichtbar | ok |
| partner-320-absage-betrag-geaendert | Roter Fehlertext zweizeilig, Option 1 nur bis "Der Kunde schuldet dir die" sichtbar, Knopf blass | Fund mittel (Scrollbereich klein) |
| partner-320-absage-fehler | Roter Text, Knopf "Folgen pruefen" aktiv, "Doch nicht" sichtbar | ok |
| partner-320-absage-karte-ohne-pauschale | "Umzug, Bezirk 3" zweizeilig neben Pille "Von dir storniert", Text umbricht sauber | ok |
| partner-320-absage-karte-mit-pauschale | Betraege 69,00 / 58,65 EUR einzeilig; Knopf "Kontakt und Adresse anzeigen" zweizeilig zentriert | ok |

## Firma, 320 dark
| Bild | Bildbeobachtung | Befund |
|---|---|---|
| partner-320-absage-grund | Dunkles Sheet, Grund-Wert abgeschnitten, mint Links | Fund mittel (Grund) |
| partner-320-absage-pauschale | Radio mint gewaehlt, 69,00/10,35/58,65 EUR weiss einzeilig, Knopf zweizeilig, Text darunter angeschnitten | Fund mittel (Scrollbereich) |
| partner-320-absage-ohne-pauschale | Warntext weiss, Knopf Teal, beide Links mint | ok |
| partner-320-absage-betrag-geaendert | Lachsroter Fehlertext, abgedunkelter Knopf, 80,00/12,00/68,00 EUR | Fund mittel (Scrollbereich) |
| partner-320-absage-fehler | Lachsrot unter Trennlinie, Knopf aktiv | ok |
| partner-320-absage-karte-ohne-pauschale | Dunkle Karte, Pille graugrau, Text umbricht | ok |
| partner-320-absage-karte-mit-pauschale | 69,00 / 58,65 EUR weiss, Knopf mint zweizeilig | ok |

## Firma, 1280 (Spalte zentriert, schmal)
| Bild | Bildbeobachtung | Befund |
|---|---|---|
| light/partner-absage-grund | Sheet als zentrierte schmale Spalte (nicht vollbreit), Grund-Wert voll lesbar "Der Auftrag ist vor Ort anders als gebucht" | ok |
| light/partner-absage-pauschale | Beide Optionen komplett sichtbar, radio schwarz, 69,00/10,35/58,65 EUR | ok |
| light/partner-absage-ohne-pauschale | Warntext, Knopf Teal in Spalte | ok |
| light/partner-absage-betrag-geaendert | Rote Meldung, Knopf blass | ok |
| light/partner-absage-fehler | Rote Meldung unter Select | ok |
| light/partner-absage-karte-ohne-pauschale | Karte in zentrierter Spalte mit Pille "Von dir storniert" | ok |
| light/partner-absage-karte-mit-pauschale | 69,00/58,65 EUR in Spalte, Knopf breit | ok |
| dark/partner-absage-grund | Dunkles Sheet in Spalte, Select voll lesbar | ok |
| dark/partner-absage-pauschale | Mint-Radio, ungewaehlter Kreis grau gefuellt | niedrig |
| dark/partner-absage-ohne-pauschale | Weisser Warntext, Teal-Knopf | ok |
| dark/partner-absage-betrag-geaendert | Lachsrote Meldung, abgedunkelter Knopf | ok |
| dark/partner-absage-fehler | Lachsrote Meldung | ok |
| dark/partner-absage-karte-ohne-pauschale | Karte in Spalte, grauer Hinweistext | ok |
| dark/partner-absage-karte-mit-pauschale | 69,00/58,65 EUR, mint Knopf | ok |

## Kunde
| Bild | Bildbeobachtung | Befund |
|---|---|---|
| 390 light kunde-absage-mit-pauschale | Text "Die Firma macht eine Pauschale von **69,00 EUR** geltend...", Betrag fett einzeilig, Link "Neue Anfrage" teal unterstrichen; Karte oben Preis 689,61 EUR; weder 10,35 noch 58,65 noch "Gebuehr" | ok |
| 390 light ...ohne-pauschale-weitervermittelt | "Dir entstehen keine Kosten. Wir haben deine Anfrage an andere Firmen weitergegeben." + Link "Zur neuen Anfrage"; kein Betrag ausser Preis oben | ok |
| 390 light ...ohne-pauschale-keine-folgeanfrage | "Dir entstehen keine Kosten. Du kannst jederzeit eine neue Anfrage stellen." + "Neue Anfrage" | ok |
| 390 dark mit-pauschale | Weisser Text auf dunkler Karte, 69,00 EUR fett, Link mint | ok |
| 390 dark weitervermittelt | Link "Zur neuen Anfrage" mint unterstrichen, keine Gebuehr | ok |
| 390 dark keine-folgeanfrage | wie Spec-Text, Link mint | ok |
| 320 light mit-pauschale | Text sechszeilig, "69,00 EUR" fett einzeilig, Karte endet ohne Abschneiden; Pille "Storniert" rechts | ok |
| 320 light weitervermittelt | Text umbricht, Link sichtbar, 689,61 EUR einzeilig | ok |
| 320 light keine-folgeanfrage | Text und Link sichtbar | ok |
| 320 dark mit-pauschale | Dunkle Karten, 69,00 EUR einzeilig | ok |
| 320 dark weitervermittelt | Text und mint Link vollstaendig | ok |
| 320 dark keine-folgeanfrage | Text und mint Link vollstaendig | ok |
| 1280 light mit-pauschale | Schmale zentrierte Spalte, 69,00 EUR fett, grosse leere Flaeche rechts/links | ok |
| 1280 light weitervermittelt | Spalte, Link unterstrichen teal | ok |
| 1280 light keine-folgeanfrage | Spalte, "Neue Anfrage" | ok |
| 1280 dark mit-pauschale | Spalte, 69,00 EUR fett, mint Link | ok |
| 1280 dark weitervermittelt | Spalte, mint Link | ok |
| 1280 dark keine-folgeanfrage | Spalte, mint Link | ok |
