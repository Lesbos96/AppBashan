# s9i-7 Bildsicht Kontrolle (Runde, Partner-Screens)

Hinweis zur Belastbarkeit: Die erste Lesebatch (nachtrag-betrag in allen sechs Varianten, 320/390 nachtrag-formular hell, 390 nachtrag-formular dunkel/zurueckziehen dunkel, auftraege-start-sheet dunkel, auftraege-kontakt dunkel, 390 dunkel auftraege-*, 1280 hell auftraege-liste) wurde vom System als "media removed" zurückgegeben. Dazu habe ich keine Beobachtung. Diese Zeilen stehen unter "Lücken", nicht als geprüft. M1 ist damit NICHT bestätigt.

## Findings

[mittel] nachtrag-fehler, 320 hell – Sheet endet direkt unter dem Fehlertext "Der neue Preis ist nicht höher als der bisherige ..." (y ca. 925 im Bild). "Betrag prüfen" und "Doch nicht" sind nicht sichtbar; darunter die gedimmte Seite mit "Nachtrag vorschlagen". Die Liste ist im Sheet gescrollt ("Personen" oben abgeschnitten). Fix: Footer (Hauptknopf, Textknopf) im Sheet fixieren, nur die Liste scrollt.

[niedrig] nachtrag-fehler, 390 hell und dunkel – "Betrag prüfen" ist sichtbar, "Doch nicht" fehlt unter dem Knopf, das Sheet endet am Knopf (y ca. 1300). Fix wie oben (fixierter Footer).

[niedrig] nachtrag-zurueckziehen-sheet, 390 hell – Unter "Doch nicht" liegt am Sheet-Ende eine durchgehende graue Linie über die volle Breite (y ca. 1228), dahinter die helle, nicht gedimmte Seite. Wirkt wie ein harter Schnitt, kein Fehler im Sheet selbst. Fix: Full-Page-Artefakt ignorieren oder Scrim auf die ganze Seitenhöhe ziehen.

[niedrig] nachtrag-karte/-offen/-abgelehnt, 390 hell/dunkel – "Mi., 2. Dezember 2026, Vormittag, 8 bis / 11 Uhr": "11 Uhr" steht verwaist in der zweiten Zeile. Fix: "8 bis 11 Uhr" mit nowrap/geschütztem Leerzeichen.

[niedrig] nachtrag-offen/-abgelehnt, 320 hell – "Kontakt und Adresse anzeigen" bricht im Button zweizeilig, "Nachtrag zurückziehen" nicht; Buttons haben dadurch unterschiedliche Höhe. Fix: kürzerer Text oder min-height und kleinerer Zeilenabstand.

[niedrig] M3 Dark Mode, 1280 dunkel (kontakt-fehler, start-fehler, abschluss, nachtrag-formular, nachtrag-zurueckziehen) – Trennlinie sitzt als feine Rundkante an der Sheet-Oberkante (z. B. kontakt-fehler: y ca. 970, direkt über dem Griff, folgt dem Eckenradius). Wirkung: Die Oberkante ist als schwacher Strich erkennbar, aber Sheet-Fläche und gedimmte Seite haben fast dieselbe Farbe; an den Seiten und unten ist keine Kante zu sehen. Das Sheet bleibt nur über Text und Linie lesbar. Besser als vorher, aber nicht deutlich. Fix: Sheet-Fläche eine Stufe heller (Karten-Token) oder Linie kontrastreicher.

## Tabelle

| Screen | Breite | Modus | Beobachtung (nur Bildsicht) |
|---|---|---|---|
| nachtrag-formular | 1280 | dunkel | Sheet-Oberkante als feine Rundlinie über dem Griff (y ca. 100), Sheet-Fläche fast schwarzblau wie die Seite; Liste mit 9 Zeilen, "Lift am Ziel" teal, "Lift bei Abholung" grau; "Fahrzeugart" einzeilig mit "Transporter" rechts |
| nachtrag-zurueckziehen-sheet | 1280 | dunkel | Sheet mit feiner Oberkante bei y ca. 815, Titel "Nachtrag zurückziehen", Teal-Hauptknopf, "Doch nicht" hellteal direkt darunter ohne großen Abstand (ca. 50 px), Sheet endet unter dem Textknopf |
| nachtrag-zurueckziehen-sheet | 390 | hell | Sheet beginnt bei y ca. 810, Teal-Knopf, "Doch nicht" zentriert darunter, graue Linie am unteren Sheet-Rand |
| nachtrag-zurueckziehen-sheet | 320 | hell | Seitenkopf "Transporte Huber GmbH" zweizeilig, Sheet startet bei y ca. 480, "Doch nicht" unter dem Teal-Knopf, graue Linie am Sheetende |
| nachtrag-karte | 390 | hell | Badge "Läuft" teal rechts, "689,61 €" und "586,17 €" fett rechts einzeilig, Teal-Hauptknopf "Auftrag abschließen", zwei hellgraue Nebenknöpfe; "11 Uhr" verwaist |
| nachtrag-karte | 390 | dunkel | Karte dunkelblau mit feinem Rand, Beträge weiß, Nebenknöpfe dunkelgrün mit hellteal Text, Hauptknopf Teal-Verlauf |
| nachtrag-offen | 390 | hell | Badge "Angenommen", "Auftrag starten" blassgrün/deaktiviert, Zustandstext "Dein Nachtrag liegt beim Kunden: neuer Gesamtpreis 810,00 € · gültig bis 1. / Dezember um 11:00 Uhr", "810,00 €" in einer Zeile |
| nachtrag-offen | 390 | dunkel | "Auftrag starten" dunkelteal mit grauem Text, Zustandstext weiß, "Nachtrag zurückziehen" dunkelgrün mit hellteal Text |
| nachtrag-abgelehnt | 390 | hell | Satz "Der Kunde hat deinen Nachtrag abgelehnt. Es gilt der bisherige Preis." klein grau zweizeilig unter dem Startenhinweis, "Nachtrag vorschlagen" wieder sichtbar |
| nachtrag-abgelehnt | 390 | dunkel | gleicher Satz hellgrau auf dunkler Karte, Nebenknöpfe dunkelgrün mit hellteal Text |
| nachtrag-fehler | 390 | hell | Fehlertext dunkelrot dreizeilig auf hellem Sheet über Teal-Knopf "Betrag prüfen"; Schalter "Lift am Ziel" teal, kein "Doch nicht" sichtbar |
| nachtrag-fehler | 390 | dunkel | Fehlertext korallrot auf dunklem Sheet, "Betrag prüfen" Teal-Verlauf, Sheet-Rand als dünne Linie sichtbar, kein "Doch nicht" |
| nachtrag-fehler | 320 | hell | Liste im Sheet gescrollt ("Personen" angeschnitten), "Fahrzeugart" zweizeilig (Label oben, "Transporter" darunter rechts), Fehlertext rot dreizeilig, Sheet endet ohne Knopf |
| nachtrag-zurueckziehen-sheet | 320 | hell | siehe oben |
| nachtrag-offen | 320 | hell | "Umzug, Bezirk 3" mit Badge "Angenommen" in einer Zeile, "Preis für den Kunden 689,61 €" einzeilig, Zustandstext vierzeilig mit "810,00 €" ungebrochen; "Kontakt und Adresse / anzeigen" zweizeilig |
| nachtrag-abgelehnt | 320 | hell | Ablehnungstext zweizeilig, "Nachtrag vorschlagen" einzeilig, "Kontakt und Adresse / anzeigen" zweizeilig, keine Gebührentexte |
| auftraege-liste | 1280 | dunkel | zentrierte Spalte ca. 530 px (Bild x 445 bis 980), drei Karten "Umzug, Bezirk 3" / "Transport, Bezirk 21" / "Entrümpelung, Bezirk 3", Beträge 689,61 € / 586,17 € rechts, erste Karte Hauptknopf deaktiviert dunkelteal, zweite und dritte Teal-Verlauf |
| auftraege-beendet | 1280 | hell | Badges grau "Abgeschlossen", "Vom Kunden storniert", "Von dir storniert", Beträge 689,61/586,17 und 344,81/293,09 rechts einzeilig, Zeile "Storniert, es fällt kein Betrag an." |
| auftraege-beendet | 1280 | dunkel | dunkelblaue Karten mit feinem Rand, graue Badges mit hellgrauem Text, Kontakt-Knöpfe dunkelgrün mit hellteal Text |
| auftraege-kontakt | 1280 | hell | Sheet ca. 810 px (1x ca. 405) breit, Name/Telefon (Teal unterstrichen)/E-Mail/Abholung "Beispielgasse 12, 1030 Wien" einzeilig/Ziel/Stock; "Schließen" teal zentriert; hellerer Streifen unter dem Viewport = nicht gedimmte Seite |
| auftraege-kontakt | 1280 | dunkel | Sheet-Fläche kaum von der Seite zu unterscheiden, feine Oberkante, Werte weiß fett, Telefon/E-Mail hellteal unterstrichen |
| auftraege-start-sheet | 1280 | hell | Sheet beginnt bei y ca. 832, überdeckt den Karten-Hauptknopf teilweise, Teal-Knopf "Auftrag starten", "Doch nicht" darunter |
| auftraege-start-sheet | 1280 | dunkel | Teal-Verlauf-Knopf, "Doch nicht" hellteal, Sheet-Kante nur als feine Linie sichtbar, Seite dahinter dunkel gedimmt |
| auftraege-abschluss-sheet | 1280 | hell | Badge "Läuft" auf der Karte dahinter, Sheet "Auftrag abschließen", Satz zweizeilig, Teal-Knopf "Verbindlich abschließen" einzeilig |
| auftraege-abschluss-sheet | 1280 | dunkel | gleicher Aufbau, Knopf Teal-Verlauf, "Doch nicht" hellteal, Sheet-Fläche kaum abgesetzt |
| auftraege-start-fehler | 1280 | hell | Satz "Der Termin hat noch nicht begonnen." in dunkler Fließtextfarbe unter dem Intro, nur "Schließen" statt Knöpfen, Sheet beginnt bei y ca. 883 |
| auftraege-start-fehler | 1280 | dunkel | Fehlersatz weiß (nicht rot), "Schließen" hellteal |
| auftraege-kontakt-fehler | 1280 | hell | Sheet nur mit "Das ist nicht mehr verfügbar." und "Schließen", dahinter Karte mit deaktiviertem "Auftrag starten" (blass grün) und Hinweis zum Start ab 08:00 Uhr |
| auftraege-kontakt-fehler | 1280 | dunkel | gleicher Aufbau, Text weiß, feine Sheet-Oberkante, Karte dahinter dunkel gedimmt |

## Betragszeilen, Bezirk, Gebühren (Punkt 2)

In allen geöffneten und gesehenen Bildern (390 hell, 1280 hell/dunkel, 320 hell) steht der Betrag rechts in einer Zeile mit "€", Label links: 689,61 €, 586,17 €, 810,00 €, 344,81 €, 293,09 €. "Bezirk 3" bleibt zusammen (z. B. 320 offen: "Abholung in Bezirk 3, Ziel in / Bezirk 10" bricht vor "Bezirk 10", nicht in der Ziffer). Keine Gebührentexte, keine Prozentwerte, keine Emojis in den gesehenen Bildern.

## Lücken (ungeprüft, ohne eigene Bildbeobachtung)

- nachtrag-betrag: 320 hell, 320 dunkel, 390 hell, 390 dunkel, 1280 hell, 1280 dunkel (M1 und M2 damit nicht bestätigt).
- nachtrag-formular: 320 hell, 320 dunkel (320-px-Fahrzeugart nur in 320 fehler hell gesehen), 390 hell, 390 dunkel.
- nachtrag-zurueckziehen-sheet 390 dunkel; auftraege-start-sheet 390 dunkel; auftraege-kontakt 390 dunkel.
- auftraege-liste, -beendet, -kontakt-fehler, -abschluss-sheet, -start-fehler jeweils 390 dunkel; auftraege-liste 1280 hell.
- nachtrag-karte/-offen/-abgelehnt/-fehler/-zurueckziehen 1280 hell und dunkel (nicht erneut geöffnet, bereits im ersten Bericht).
- auftraege-payment-hold, -ladefehler (alle Größen) nicht geöffnet.
- Fokus und Touch-Ziele bildlich nicht prüfbar.

Findings hoch: 0, mittel: 1, niedrig: 5
Ungeprüfte Zeilen: ca. 40 (siehe Lücken)
