# Bildsicht Paket 3 (Runde, UI)

## Beobachtungen

1. 320 hell, nachtrag-karte (shots-390-light/partner-320-nachtrag-karte.png)
   - Karte "Umzug, Bezirk 3": Titel mit grünem Badge "Läuft" rechts, "Bezirk 3" in einer Zeile. Zeile "Abholung in Bezirk 3, Ziel in / Bezirk 10" bricht vor "Bezirk 10", keine verwaiste Ziffer. Zeile "Mi., 2. Dezember 2026, / Vormittag, 8 bis 11 Uhr": "11 Uhr" zusammen.
   - Betragszeilen: "Preis für den Kunden" links grau, "689,61 €" fett rechtsbündig einzeilig; "Du erhältst" links, "586,17 €" rechts einzeilig. Label steht in eigener Spalte neben dem Betrag, nicht darüber. Keine Gebühr sichtbar.
   - Knöpfe: "Auftrag abschließen" dunkelteal gefüllt mit weißer Schrift, ca. 53 CSS-px hoch; "Nachtrag vorschlagen" hellgrau-blau mit teal Text, ca. 48 px hoch, einzeilig; "Kontakt und Adresse anzeigen" gleiche Optik, zweizeilig ("Kontakt und Adresse / anzeigen"), Höhe ca. 48 px, Text zentriert, nichts abgeschnitten. Alle Knöpfe >= 44 px.
   - Kein horizontales Scrollen erkennbar, Karten haben rechts und links gleichen Rand.

2. 320 dunkel, nachtrag-karte (shots-390-dark/partner-320-nachtrag-karte.png)
   - Seite fast schwarz-petrol, Karten dunkles Petrol mit feinem Rand. Betrag "689,61 €" und "586,17 €" weiß fett, rechts, einzeilig; Labels grau links. "Bezirk 3" und "11 Uhr" ohne verwaiste Ziffer/Uhrzeit.
   - "Auftrag abschließen" teal gefüllt mit weißer Schrift (ca. 53 px); "Nachtrag vorschlagen" dunkles Petrol-Grau mit mintfarbenem Text, einzeilig, ca. 48 px; "Kontakt und Adresse / anzeigen" zweizeilig, mint, ca. 48 px. Kontrast der mintfarbenen Schrift auf dunkler Fläche gut lesbar. Disabled "Hochladen" unten blasse Schrift auf dunklem Teal (gewollt deaktiviert).

3. 390 dunkel, nachtrag-karte (shots-390-dark/partner-nachtrag-karte.png)
   - Datumszeile bricht als "Mi., 2. Dezember 2026, Vormittag, 8 bis / 11 Uhr": "11 Uhr" steht zusammen in Zeile 2, "8 bis" bleibt oben; keine verwaiste Ziffer, aber "bis" hängt am Zeilenende (niedrig, Lesefluss). "Abholung in Bezirk 3, Ziel in Bezirk 10" einzeilig.
   - Beträge "689,61 €" und "586,17 €" weiß fett, rechtsbündig bei x~568, einzeilig, Labels links grau. Knöpfe: Auftrag abschließen teal (~43 CSS-px Höhe im 390er Maßstab 1,25: Bild ~86 px), Nachtrag vorschlagen und "Kontakt und Adresse anzeigen" dunkles Grau-Petrol mit mintfarbenem Text, je einzeilig, Bildhöhe ~76 px = ca. 48 CSS-px. Titel "Transporte Huber GmbH" einzeilig neben Badge "Aktiv".

4. 1280 hell, nachtrag-karte (shots-1280-light/partner-nachtrag-karte.png)
   - Zentrierte Spalte ca. 750 Bild-px breit (x 625-1375 von 2000), links und rechts hellgrauer leerer Rand, Spalte mittig. Alle Zeilen einzeilig: "Abholung in Bezirk 3, Ziel in Bezirk 10", "Mi., 2. Dezember 2026, Vormittag, 8 bis 11 Uhr". Beträge "689,61 €"/"586,17 €" fett rechts am Kartenrand, einzeilig, Labels links grau.
   - Knöpfe über volle Kartenbreite: Auftrag abschließen dunkelteal (~85 Bild-px), Nachtrag vorschlagen und Kontakt und Adresse anzeigen hellgrau-blau mit teal Schrift (~75 Bild-px), alle einzeilig. Disabled "Hochladen" blass-teal unten, volle Breite. Nichts abgeschnitten, keine Gebühr.

5. 320 hell, nachtrag-offen (shots-390-light/partner-320-nachtrag-offen.png)
   - Zustandstext umbricht in vier Zeilen: "Dein Nachtrag liegt beim / Kunden: neuer Gesamtpreis / 810,00 € · gültig bis 1. / Dezember um 11:00 Uhr". "810,00 €" bleibt in einer Zeile. FUND: "1." steht am Zeilenende, "Dezember" in der nächsten Zeile (Datum zerrissen, verwaiste Ordnungszahl). Fix: geschütztes Leerzeichen zwischen Tag-Punkt und Monat (z. B. "1. Dezember").
   - Badge "Angenommen" (dunkelteal, weiße Schrift) neben "Umzug, Bezirk 3" ohne Umbruch. Betragszeilen 689,61 € / 586,17 € rechts einzeilig.
   - "Auftrag starten" blass-teal (deaktiviert) ca. 48 CSS-px, Hinweis darunter "Du kannst den Auftrag ab 2. Dezember um 08:00 Uhr starten." in kleiner grauer Schrift. "Nachtrag zurückziehen" hellgrau-blau mit teal Schrift, einzeilig, ca. 44-48 px; "Kontakt und Adresse / anzeigen" zweizeilig. Keine Gebühr sichtbar.

6. 320 dunkel, nachtrag-offen (shots-390-dark/partner-320-nachtrag-offen.png)
   - Gleicher Umbruch wie hell: "810,00 € · gültig bis 1. / Dezember um 11:00 Uhr" (Fund 5 gilt, "1." verwaist). Zustandstext weiß auf dunklem Petrol, gut lesbar; Betrag "810,00 €" einzeilig.
   - "Auftrag starten" deaktiviert: dunkles Teal mit gedämpftem grauem Text, deutlich blasser als aktive Knöpfe (Kontrast niedrig, aber als disabled gewollt). "Nachtrag zurückziehen" dunkles Grau-Petrol mit mintfarbener Schrift, einzeilig, ca. 44-48 px; "Kontakt und Adresse / anzeigen" zweizeilig, mint. Beträge 689,61 € und 586,17 € weiß, rechts, einzeilig. Badge "Angenommen" teal neben dem Titel.

7. 390 dunkel, nachtrag-offen (shots-390-dark/partner-nachtrag-offen.png)
   - Zustandstext in drei Zeilen: "Dein Nachtrag liegt beim Kunden: neuer / Gesamtpreis 810,00 € · gültig bis 1. / Dezember um 11:00 Uhr". Auch hier "1." am Zeilenende, "Dezember" darunter (Fund 5). "810,00 €" einzeilig. Datumszeile oben "... Vormittag, 8 bis / 11 Uhr": "11 Uhr" zusammen, "bis" am Zeilenende (niedrig).
   - Hinweis "Du kannst den Auftrag ab 2. Dezember um 08:00 Uhr / starten." lässt "starten." allein in der zweiten Zeile (verwaistes Wort, niedrig).
   - Beträge weiß fett rechts einzeilig. "Nachtrag zurückziehen" und "Kontakt und Adresse anzeigen" beide einzeilig, mint auf dunklem Grau-Petrol, ca. 48 CSS-px (Bild ~70 px bei 1,37). "Auftrag starten" deaktiviert, gedämpfter grauer Text auf dunklem Teal.

8. 1280 hell, nachtrag-offen (shots-1280-light/partner-nachtrag-offen.png)
   - Spalte mittig (x ~610-1342 von 1953), hellgrauer Rand beidseits. Zustandstext zweizeilig: "Dein Nachtrag liegt beim Kunden: neuer Gesamtpreis / 810,00 € · gültig bis 1. Dezember um 11:00 Uhr"; Datum bleibt zusammen, Betrag einzeilig. Hinweis "Du kannst den Auftrag ab 2. Dezember um 08:00 Uhr starten." einzeilig.
   - Datumszeile "Mi., 2. Dezember 2026, Vormittag, 8 bis 11 Uhr" einzeilig. Beträge 689,61 € / 586,17 € rechts einzeilig. "Auftrag starten" blass-teal (disabled), "Nachtrag zurückziehen" und "Kontakt und Adresse anzeigen" hellgrau-blau, teal Schrift, einzeilig, Höhe ~73 Bild-px (~48 CSS-px). Badge "Angenommen" dunkelteal rechts oben.

9. 320 hell, nachtrag-abgelehnt (shots-390-light/partner-320-nachtrag-abgelehnt.png)
   - Hinweis in kleiner grauer Schrift: "Der Kunde hat deinen Nachtrag / abgelehnt. Es gilt der bisherige Preis." zweizeilig, ohne verwaistes Wort, keine Gebühr. Darunter "Nachtrag vorschlagen" hellgrau-blau mit teal Schrift, einzeilig, Bildhöhe ~66 px bei Faktor 1,43 = ca. 46 CSS-px.
   - "Kontakt und Adresse / anzeigen" zweizeilig, gleiche Optik. Beträge 689,61 € und 586,17 € rechts, einzeilig. "Auftrag starten" blass-teal (disabled) mit weißer Schrift, Hinweis "Du kannst den Auftrag ab 2. Dezember / um 08:00 Uhr starten." Badge "Angenommen" neben "Umzug, Bezirk 3" ohne Umbruch.

10. 320 dunkel, nachtrag-abgelehnt (shots-390-dark/partner-320-nachtrag-abgelehnt.png)
   - Hinweis "Der Kunde hat deinen Nachtrag / abgelehnt. Es gilt der bisherige Preis." hellgrau auf dunklem Petrol, zweizeilig, lesbar. "Nachtrag vorschlagen" mint auf dunklem Grau-Petrol, einzeilig, ca. 46 CSS-px; "Kontakt und Adresse / anzeigen" zweizeilig, mint. Beträge 689,61 € und 586,17 € weiß, rechts, einzeilig.
   - "Auftrag starten" deaktiviert: dunkles Teal, gedämpfter grauer Text. Badge "Angenommen" teal neben dem Titel, kein Umbruch.

11. 390 dunkel, nachtrag-abgelehnt (shots-390-dark/partner-nachtrag-abgelehnt.png)
   - Hinweis "Der Kunde hat deinen Nachtrag abgelehnt. Es gilt der / bisherige Preis." Zweizeilig, zweite Zeile nur "bisherige Preis." (zwei Wörter, akzeptabel). Hinweis "Du kannst den Auftrag ab 2. Dezember um 08:00 Uhr / starten." lässt "starten." allein in Zeile 2 (verwaistes Wort, niedrig).
   - Datumszeile "... Vormittag, 8 bis / 11 Uhr": "11 Uhr" zusammen, "bis" bleibt am Zeilenende (niedrig). Beträge weiß rechts einzeilig. "Nachtrag vorschlagen" und "Kontakt und Adresse anzeigen" je einzeilig, mint auf Grau-Petrol, Bildhöhe ~70 px bei 1,34 = ca. 48 CSS-px.

12. 1280 hell, nachtrag-abgelehnt (shots-1280-light/partner-nachtrag-abgelehnt.png)
   - Spalte mittig (x ~614-1350 von 1965), grauer Rand beidseits. Hinweis "Der Kunde hat deinen Nachtrag abgelehnt. Es gilt der bisherige Preis." einzeilig in kleiner grauer Schrift unter "Du kannst den Auftrag ab 2. Dezember um 08:00 Uhr starten." (ebenfalls einzeilig). Keine Gebühr.
   - Knöpfe "Nachtrag vorschlagen" und "Kontakt und Adresse anzeigen" hellgrau-blau, teal Schrift, einzeilig, Bildhöhe ~73 px = ca. 48 CSS-px. Beträge 689,61 € / 586,17 € rechtsbündig einzeilig, Datumszeile einzeilig. "Auftrag starten" blass-teal disabled.

## Lücken
Keine; alle 12 Bilder wurden geöffnet und sind oben beschrieben ("media removed" trat nicht auf).

## Findings
- [mittel] Zustandszeile Nachtrag offen (390 und 320, hell und dunkel; Bilder 5, 6, 7) – "gültig bis 1." steht am Zeilenende, "Dezember" in der nächsten Zeile; das Datum zerreißt – geschütztes Leerzeichen zwischen Tag und Monat (z. B. "1. Dezember") im Nachtrag-Zustandstext.
- [niedrig] Hinweis "Du kannst den Auftrag ab 2. Dezember um 08:00 Uhr starten." (390 dunkel, offen und abgelehnt; Bilder 7, 11) – "starten." steht allein in Zeile 2 – "um 08:00 Uhr starten." oder "Uhr starten." per geschütztem Leerzeichen koppeln, oder Text kürzen.
- [niedrig] Datumszeile (390 dunkel; Bilder 3, 7, 11) – "11 Uhr" steht jetzt zusammen, aber "8 bis" bleibt oben am Zeilenende – "8 bis 11 Uhr" ganz mit geschützten Leerzeichen koppeln.
- Beträge einzeilig rechts, Label in eigener Spalte, Knopfhöhen >= 44 px, keine Gebührenhinweise, Dark-Kontrast der mintfarbenen Knopfschrift ausreichend, 1280 px zentrierte Spalte ohne Überlauf: ohne Befund.

Findings hoch: 0, mittel: 1, niedrig: 2
Ungeprüfte Zeilen: 0
