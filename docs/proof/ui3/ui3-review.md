# ui3 Abnahme (Reviewer)

Keine hohen Findings.

## Findings
- [mittel] tests/e2e, tests/unit: kein Test, dass die LegalFooter auf Konfigurator, Montage, Entruempelung (Wizard, Ergebnis), Termin und Auftragsdetail erscheint und nicht unter der Aktionsleiste liegt (nur shell.spec.ts prueft die Fusszeile an anderer Stelle). Fix: ein E2E mit getByRole('navigation', {name:'Rechtliches'}) je Screen plus boundingBox-Vergleich gegen die Aktionsleiste bei 320 px.
- [mittel] src/components/Surfaces.tsx:176 (StepRow flex-wrap): kein Test fuer das 320-px-Verhalten (Wert und Pille ueberlagern sich nicht). Fix: E2E bei 320 px, boundingBox von output und Pille ueberschneiden sich nicht, kein horizontaler Ueberlauf.
- [niedrig] src/screens/Auftrag.tsx:71 (320 px angefragt und flexibel, 390 px flexibel): Der Umbruch setzt den Mittelpunkt "·" ans Zeilenende ("Dienstag, 15. Dezember 2026 ·" / "8 bis 11 Uhr"). Fix: Trenner per geschuetztem Leerzeichen an die folgende Angabe koppeln oder das Fenster in eine eigene Zeile legen.
- [niedrig] src/assets/legal/datenschutz.md 14d: "angewandte Saetze und ihre Versionen" deutet Satzstufen an. Kein Wort Provision/Gebuehr/Prozent, kein Pfad (per grep geprueft), aber fuer eine oeffentliche Seite besser "angewandte Regeln" oder streichen.
- [niedrig] datenschutz 14d/14e: "Zugriff endet 30 Tage nach Abschluss oder Storno" und "7 Jahre": nur plausibel, mit Ist-Stand (Migration) und [ANWALT] abgleichen.

## Punkte 1-4
- Auftrag.tsx: Fensterzeile nur einmal. Laufender Auftrag: Fenster nur in "Ankunft zwischen ..."; Flexibel: "ganzer Tag ab 8 Uhr" plus Hinweis; angefragt: Fenster in der Datumszeile. Entspricht Nr. 205/206. E2E-Faelle pruefen Verhalten (toHaveCount 0 / sichtbar).
- arrival.ts ist einzige Quelle (WINDOWS, Object.hasOwn gegen Prototyp-Keys); Duplikat in partnerJobs.ts entfernt; Anfragen.tsx und Auftraege.tsx importieren daraus. Unit-Test deckt Werte, NBSP, null, toString/constructor ab.
- Datenschutz Abschnitt 14: kein Hinweis auf Provision, Gebuehr oder Prozentsaetze; keine Dateipfade. Keine Geld-, RLS- oder Migrationsaenderung im Diff.
- Mfa-Impressum-Link: min-h-11, Test auf >= 44 px ergaenzt. LegalLink-Standard in der Fusszeile hat min-h-11.

## Shots (Bildsicht; Masse nicht aus dem Bild)
| Shot | Beobachtung |
|---|---|
| 320 auftrag-angenommen-fenster | Unter "Dienstag, 15. Dezember 2026" steht grau und klein "Ankunft zwischen 8 und 11 Uhr" in einer Zeile, kein zweites Fenster; "689,61 €" rechts fett einzeilig; Fusszeile (Impressum AGB Datenschutz, Teal, unterstrichen) unter der Stornieren-Taste, nichts abgeschnitten. |
| 320 auftrag-angenommen-flexibel | "ganzer Tag ab 8 Uhr" ungebrochen als zweite Titelzeile hinter hängendem "·"; darunter grau "Die Firma nennt dir die genaue Uhrzeit." in zwei Zeilen; keine Ankunftszeile. |
| 320 auftrag-angefragt | Chip "Angefragt" beige mit braunem Text; Datumszeile bricht vor "8 bis 11 Uhr", "·" bleibt am Zeilenende; Taste "Anfrage zurückziehen" graut��rkis, Fusszeile darunter sichtbar. |
| 320 auftrag-unterwegs | "Ankunft zwischen 14 und 18 Uhr" grau klein ueber der fetten Zeile "Die Firma ist unterwegs, Ankunft ca. 14:40 Uhr"; keine doppelte Fensterzeile; Fusszeile frei. |
| 320 partner-mfa-code | "Transporte Huber GmbH" bricht auf zwei Zeilen, Chip "In Prüfung" rechts oben unbeschnitten; Code-Feld mit "1 2 3 4 5 6" rechts; "Impressum" unterstrichen in eigener Zeile unter dem Hinweistext, buendig links. |
| 320 entruempelung-zusatz | Zeile "Möbelbreite gesamt": "2 lfm" rechts oben, Stepper-Pille eine Zeile tiefer links; "Montage / Demontage" bricht dreizeilig neben dem Teal-Icon, Schalter rechts unbeschnitten; Fusszeile mittig mit sichtbarem Abstand ueber der Leiste "Unverbindlich · ohne Kontaktdaten / Weiter". |
| 320 umzug-beispiel | "Abholung/Stockwerk": "Erdgeschoss" rechts, Pille darunter; "Personen 3 − +" und "Fahrzeuge" einzeilig; kleine Fusszeile unter Abschnitt 5, vor der Leiste "689,61 €". |
| 320 transport | Adressfelder mit Chevron, Karte mit Hinweis "Ohne Einwilligung bleibt die Strecke ungeprüft.", Fusszeile vor Leiste "Noch kein Richtpreis / Strecke fehlt", Weiter blass (deaktiviert). |
| 390 light auftrag-angenommen-flexibel | Datumszeile bricht nach "2026 ·", "ganzer Tag ab 8 Uhr" geschlossen in Zeile 2; Hinweis grau einzeilig; Fusszeile zentriert. |
| 390 dark auftrag-angenommen-fenster | Dunkelgruene Karte mit feiner Kontur, weisser Titel, graue Ankunftszeile gut lesbar, Fusszeile mint unterstrichen; Chip "Bestätigt" Teal mit weisser Schrift. |
| 390 light entruempelung-ergebnis | Fusszeile unter "Wie kommt der Richtwert zustande?" mit grossem Abstand ueber der Aktionsleiste "Ort & Wunschtermin"; "1.125,00 €" einzeilig. |
| 390 light termin-umzug | Fusszeile unter der Karte "Di., 15. Dez. · ca. 5 Stunden", frei ueber der Leiste "Zur Zusammenfassung". |
| 390 dark partner-mfa-code | Hinweistext grau auf Dunkel lesbar, "Impressum" mint unterstrichen, Chip "In Prüfung" mint auf Dunkelgruen, Firmenname einzeilig. |
| 390 light montage-standard | "Möbelbreite gesamt": "2 lfm" und Pille in einer Zeile (keine Regression), Fusszeile mittig darunter, Leiste "95,74 €" unveraendert, Illustration in Materialfarben. |
| 1280 light auftrag-angefragt | Zentrierte Spalte, Fenster in der Datumszeile einzeilig ("… 2026 · 8 bis 11 Uhr"), Chip beige, Fusszeile zentriert unter der Taste. |

Nicht geoeffnet (Zeitrahmen): uebrige 390/1280-Shots, 1280-dark, 320 termin/gesendet/ergebnis/montage. Keine Gebuehr, keine Emojis, kein Prototyp-Text in den geoeffneten Bildern.
