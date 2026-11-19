# mail1 Review: Unterwegs mit Ankunftszeit (UI)

Geprüft: Diff UI-Teil, Screenshots 390 hell/dunkel, 320 (Partner, hell/dunkel), 1280 hell (Sheet). 430/768 nicht einzeln geöffnet.

## Hoch
Keine.

## Mittel
Keine.

## Niedrig
- [niedrig] src/screens/Auftrag.tsx:87 – `new Date(r.en_route_eta)` ohne Prüfung. Bei ungültigem String ergibt `enRouteText` „NaN:undefined“. Partner-Seite validiert über `when()`. Fix: Wert vor Anzeige auf gültiges Datum prüfen, sonst Zeile weglassen.
- [niedrig] tmp/shots/shots-390-light/kunde-ankunft-unterwegs.png – Kundenzeile „Die Firma ist unterwegs, Ankunft / ca. 8:40 Uhr“ bricht hinter „Ankunft“. Das geschützte Leerzeichen funktioniert (ca. 8:40 Uhr bleibt zusammen), die Zeile steht aber direkt unter „Ankunft zwischen 8 und 11 Uhr“, zwei Ankunftsangaben untereinander. Fix (optional): Fensterzeile ausblenden, sobald eine genaue Zeit vorliegt (`live && arrival && !r.en_route_eta`).
- [niedrig] src/components/Controls.tsx:25,32 – Segmented ist 36 px hoch, Segment 32 px, 13-px-Text. Klickfläche per ::before 44 px, passt zur 44-px-Regel. Lesbar in allen Shots (hell: weißes Segment, dunkel: grauer Block, Kontrast gut; 320 px ohne Abschneiden). Kein Fix nötig.
- [niedrig] tmp/shots/shots-1280-light/partner-auftraege-unterwegs-sheet.png – Sheet ist breiter (ca. 488–1157 px im Bild) als die zentrierte Spalte (514–1130). Liegt am gemeinsamen Sheet-Bauteil, nicht an dieser Änderung. Fix: nur beobachten.

## Geprüft ohne Befund
- Texte: Du-Form bei der Firma („Du bist unterwegs“, „Verspätest du dich, rufst du ihn an.“, Fehler „Unterwegs kannst du nur am Tag des Termins melden.“). Beim Kunden „Die Firma ist unterwegs, Ankunft ca. 8:40 Uhr“ mit NBSP nach „ca.“ und vor „Uhr“ (src/lib/arrival.ts:10). Keine Gebühr, Provision oder „15 %“ in Kunden-Screens und -Query (`en_route_eta` einziges neues Feld).
- Sheet: Titel „Unterwegs“, Knopf „Kunde benachrichtigen“, „Doch nicht“ sichtbar (hell, dunkel, 320, 1280). Standard 30 Min.
- Knopf „Unterwegs“ (tinted, über 44 px) nur bei `canEnRoute`, verschwindet nach Meldung (gemeldet-Shots 390/320). Karten-Layout konsistent mit „Auftrag starten“ und „Auftrag absagen“.
- Beträge einzeilig auch bei 320 px; 320-Dunkel gemeldet: „Du bist unterwegs, Ankunft ca. 8:40 Uhr“ bricht sauber auf zwei Zeilen, kein Überlauf.
- Kein neuer Status; Anzeige nur bei `accepted` und nicht beendet (src/screens/partner/Auftraege.tsx:240, src/screens/Auftrag.tsx:87). Keine Emojis, keine Platzhaltertexte.
- Nicht Teil dieser Prüfung: Server-Funktion `set_en_route`, RLS, Mails, Tests.
- Sheet mitten auf der Seite in den Vollseiten-Shots: bekanntes Artefakt, nicht gewertet.

Offene Findings hoch: 0
