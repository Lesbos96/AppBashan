# Review Runde 2, s9i-7b2 Absage-UI (nur Bilder)

Mit Bildsicht ausgewertet: 44 Bilder (320 light/dark: grund, pauschale, betrag-geaendert; 390 dark: pauschale, ohne-pauschale, betrag-geaendert, fehler, karte-ohne, karte-mit; Kunde 390/320 light+dark: 12; 1280 light+dark: 14 Partner, 6 Kunde). Nicht nochmals mit Bildsicht (Tool entfernte Medien wegen Anfragelimit): 390 light partner-* (7), 390 dark partner-absage-grund, 320 ohne-pauschale/fehler/karte-* (light+dark, 10). Dort gilt Runde 1.

## Funde
- [mittel] 320 px, Sheet Schritt 2 (partner-320-absage-pauschale, light+dark): Scrollbereich zeigt nur Kopf von "Mit Pauschale" (Betraege 69,00 / 10,35 / 58,65 einzeilig, Text bei "wird nicht weitervermittelt. Du" waagrecht angeschnitten = scrollbar). "Ohne Pauschale" ist ohne Scrollen gar nicht sichtbar, kein Hinweis auf den zweiten Weg. Fix: Fussleiste bei kleinen Hoehen weiter verkleinern (z. B. "Grund aendern"/"Doch nicht" nebeneinander in einer Zeile, wie angekuendigt; im Bild stehen sie noch untereinander) oder Sheet bis 100 % Hoehe; erste Option bei <=320 px einklappen.
- [mittel] 320 px (partner-320-absage-betrag-geaendert, light+dark): schlimmer, Scrollbereich nur ca. eine halbe Karte, erste Zeile des Erklaertexts halb abgeschnitten, "Ohne Pauschale" unsichtbar, Fehlertext (rot/lachs, zweizeilig) frisst Platz. Fix wie oben; Fehlertext in den Scrollbereich oder oberhalb der Optionen.
- [niedrig] Dark, nicht gewaehlter Radio-Kreis (390, 320, 1280; auch in Grund-Gruppe) ist dunkelgrau gefuellt statt Kontur wie im Light. Fix: border-Token, keine Fuellung.
- [niedrig] Kunde 390: "Dienstag, 15. Dezember 2026 · 8 bis 11 / Uhr" einzelnes "Uhr" in neuer Zeile (Bestand). Fix: "8 bis 11 Uhr" nowrap.
- Behoben gegenueber Runde 1: Grund ist Radiogruppe, vollstaendig lesbar (320: umbrechend zweizeilig, 390/1280 einzeilig); Hauptknopf "Fuer 69,00 € absagen" einzeilig und ganz sichtbar (320 light+dark); Betraege nie umgebrochen (auch "Pauschale inkl. / USt." bricht nur im Label). Zwei schlichte Knoepfe stehen auf 320 weiterhin untereinander, nicht nebeneinander.
- Kunde: nirgends Gebuehr, 10,35 oder 58,65 (alle 12 + 6 gesehenen Kunden-Bilder). Keine Emojis, keine Platzhalter.
- Hinweis: Full-Page-Shots zeigen unter dem Sheet ungedimmten Seiteninhalt (position: fixed-Artefakt, kein Bug).

## 320 light
| Bild | Beobachtung | Befund |
|---|---|---|
| partner-320-absage-grund | Drei Radiokarten weiss auf hellgrau, erste mit schwarzem Punkt, Text zweizeilig umbrochen "Der Auftrag ist vor Ort / anders als gebucht", Teal-Knopf "Folgen pruefen", Link "Doch nicht" | ok |
| partner-320-absage-pauschale | Radio "Mit Pauschale" schwarz gefuellt, 69,00/10,35/58,65 € fett rechts einzeilig, Knopf "Fuer 69,00 € absagen" Teal einzeilig, zweite Option unsichtbar | mittel |
| partner-320-absage-betrag-geaendert | Radio leer, 80,00/12,00/68,00 €, roter Fehlertext zweizeilig ueber blassem Knopf "Absagen", nur halbe Karte sichtbar | mittel |

## 320 dark
| Bild | Beobachtung | Befund |
|---|---|---|
| partner-320-absage-grund | Radio 1 mintfarbener Punkt in hellem Ring, Radios 2/3 graue Fuellung, Knopf hellteal, Links mint | niedrig (Radio-Optik) |
| partner-320-absage-pauschale | Mint-Radio gewaehlt, Betraege weiss fett einzeilig, Knopf Teal einzeilig, "Ohne Pauschale" nicht sichtbar | mittel |
| partner-320-absage-betrag-geaendert | Radio dunkelgrau gefuellt, Fehlertext lachsrot, Knopf abgedunkelt mit graugruenem Text | mittel |

## 390 dark (Firma)
| Bild | Beobachtung | Befund |
|---|---|---|
| partner-absage-pauschale | Beide Optionen sichtbar, Mint-Radio gewaehlt, 69,00/10,35/58,65 € weiss fett, Knopf "Fuer 69,00 € absagen" einzeilig Teal, "Grund aendern"/"Doch nicht" mint untereinander | ok (Radio 2 grau gefuellt: niedrig) |
| partner-absage-ohne-pauschale | Grosser weisser Warntext, Hinweis klein grau, Knopf "Absagen" Teal | ok |
| partner-absage-betrag-geaendert | 80,00/12,00/68,00 €, "Ohne Pauschale" angeschnitten sichtbar, lachsroter Fehlertext, Knopf gedimmt | ok |
| partner-absage-fehler | Drei Grund-Radios, erste mint, lachsroter Text zweizeilig, Knopf "Folgen pruefen" aktiv | ok |
| partner-absage-karte-ohne-pauschale | Karte mit grauer Pille "Von dir storniert", Text "Storniert, es faellt kein Betrag an.", keine Betragszeile | ok |
| partner-absage-karte-mit-pauschale | 69,00 € / 58,65 € weiss fett rechts, mintfarbener Knopf auf dunkel-tuerkis "Kontakt und Adresse anzeigen" | ok |

## 1280 (zentrierte schmale Spalte)
| Bild | Beobachtung | Befund |
|---|---|---|
| light partner-grund | Sheet zentriert, Radio 1 dunkelteal gefuellt, alle Gruende einzeilig | ok |
| light partner-pauschale | Beide Optionen komplett, schwarzes Radio, Knopf Teal einzeilig | ok |
| light partner-ohne-pauschale | Warntext schwarz, Teal-Knopf in Spalte | ok |
| light partner-betrag-geaendert | Roter Fehlertext, blasser Knopf, 80/12/68 € | ok |
| light partner-fehler | Roter Text einzeilig+Rest, Knopf aktiv | ok |
| light partner-karte-ohne | Weisse Karte, graue Pille, Text grau | ok |
| light partner-karte-mit | 69,00/58,65 € rechts, hellgrauer Knopf mit Teal-Text | ok |
| dark partner-grund | Mint-Radio, graue Kreise 2/3 | niedrig |
| dark partner-pauschale | Mint-Radio, grauer Kreis Option 2, Betraege weiss | niedrig |
| dark partner-ohne-pauschale | Weisser Warntext auf dunklem Sheet | ok |
| dark partner-betrag-geaendert | Beide Kreise grau gefuellt, lachsroter Text | niedrig |
| dark partner-fehler | Lachsroter Text, Knopf Teal | ok |
| dark partner-karte-ohne | Dunkle Karte, graue Pille | ok |
| dark partner-karte-mit | 69,00/58,65 € weiss, mint Knopf | ok |

## Kunde (390 und 320, light+dark; 1280 light+dark)
| Bild | Beobachtung | Befund |
|---|---|---|
| 390 light mit-pauschale | "69,00 €" fett einzeilig im Text, Link "Neue Anfrage" teal unterstrichen, Preis 689,61 € | ok (Uhr-Umbruch: niedrig) |
| 390 light weitervermittelt | "Dir entstehen keine Kosten..." + Link "Zur neuen Anfrage" teal | ok |
| 390 light keine-folgeanfrage | zweizeiliger Text, Link "Neue Anfrage" teal | ok |
| 390 dark mit-pauschale | Weisser Text, Link mint, Karten dunkelteal mit feinem Rand | ok |
| 390 dark weitervermittelt | Link mint unterstrichen | ok |
| 390 dark keine-folgeanfrage | Link mint unterstrichen | ok |
| 320 light mit-pauschale | Sechszeiliger Text, "69,00 €" fett einzeilig, Karte endet sauber | ok |
| 320 light weitervermittelt | Dreizeiliger Text, Link teal | ok |
| 320 light keine-folgeanfrage | Dreizeiliger Text, Link teal | ok |
| 320 dark mit-pauschale | Weisser Text, "69,00 €" fett | ok |
| 320 dark weitervermittelt | Link mint | ok |
| 320 dark keine-folgeanfrage | Link mint | ok |
| 1280 light mit-pauschale | Spalte zentriert, "69,00 €" fett, grosse leere Rander | ok |
| 1280 light weitervermittelt | Spalte, Link teal | ok |
| 1280 light keine-folgeanfrage | Spalte, Link teal | ok |
| 1280 dark mit-pauschale | Spalte, "69,00 €" fett, Link mint | ok |
| 1280 dark weitervermittelt | Spalte, Link mint | ok |
| 1280 dark keine-folgeanfrage | Spalte, Link mint | ok |
