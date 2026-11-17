# ui1-review (Kennung ui1-1711-a)

Findings
- [mittel] tmp/shots/shots-390-dark/partner-absage-pauschale.png – Bild zeigt: Sheet-Fläche endet mit abgeschnittener Zeile "beleg.png / Entfernen" bei ca. y=848 (Anzeige), darunter liegen Knopf "Für 69,00 € absagen" (Teal-Verlauf) und "Zurück / Doch nicht" auf dem Seitenhintergrund, unmittelbar darunter die ungedimmte Seite (Abrechnung, Dokumente in voller Helligkeit); kein Scrim sichtbar. Wahrscheinlich Fullpage-Artefakt (fixed-Sheet in verlängertem Viewport), aber so nicht als Sheet-Fuß beurteilbar. Fix: Aufnahme mit Viewport-Screenshot (nicht fullPage) oder boundingBox des Dialogs und des Knopfes im Test belegen (der neue 390/320-Test deckt genau das ab, nur nicht im Bild).
- [niedrig] tests/e2e/backend.ts:31 – staffelFee im Mock enthält feste Sätze und Grenzen (0.12/0.1/0.07, 50000/100000). Erlaubt (Testcode), aber der neue Unit-Test prüft nur die vier geld.md-Beispiele (36/90/145/250 €, von mir nachgerechnet, stimmen). Keine Grenzfälle (50000, 50001, 100000, 100001, Rundung .5). Fix: Fälle ergänzen.
- [niedrig] src/screens/partner/Auftraege.tsx:146 – Warnhinweis hat Rand und Rot, aber kein Symbol; Bedeutung nur über Farbe plus Text (Text trägt sie, daher akzeptabel). Optional Icon aus der Icon-Bibliothek.
- [niedrig] tests/e2e: kein Test, dass bei Erfolg der ruhige Hinweis KEINEN roten Rand hat (nur Rolle geprüft). Rolle genügt als Verhalten; Rand nur im Shot sichtbar.

Kunden-Screens
- Keine Verhaltensänderung: src/screens/Auftrag.tsx:51 `done = (n?: string)` ignoriert das zweite Argument von Bestaetigen (TS erlaubt weniger Parameter); Kundenhinweis bleibt role=alert (Zeile 70) wie bisher. Angebote.tsx, Nachtrag.tsx, Termin.tsx, Zurueckziehen.tsx reichen onDone unverändert durch. Partner Anfragen.tsx:105,179,235,261 ebenfalls Signatur mit einem Argument, Warnart dort nicht unterschieden (Hinweis bleibt wie vorher; bei Anfragen kein Folgebedarf, optional Konsistenz).
- Geld/Gebühr: Diff berührt keine Beträge; in Kunden-Dateien keine Gebühr neu. "Gebühr 8,28 €" im Partner-Sheet (12 % von 69,00 €, korrekt) nur Firma, erlaubt.

Bildzeilen (je eigene Beobachtung)
- 390 hell partner-absage-netzfehler-senden: Hinweiskasten zwischen "Offene Anfragen"-Text und Abschnitt "Angenommen", Rand rot (#B3261E-nah) mit Radius wie Karten, Text rot, Fläche weiß, vier Zeilen "Wir wissen nicht, ob die Absage angekommen ist. … Prüfe den Status des Auftrags." vollständig, nichts abgeschnitten.
- 390 dunkel gleicher Screen: Rand und Text in hellerem Lachsrot auf dunkler Kartenfläche, lesbar; Textfarbe passt zur Dark-Regel (aufgehellt, nicht das Hell-Rot).
- 390 dunkel: Statuschip "Angenommen" und "Aktiv" teal mit weißer Schrift, unverändert; Betragszeilen "689,61 €" / "610,65 €" je in einer Zeile, rechtsbündig.
- 1280 hell: Spalte mittig (ca. 488–1073 von 1561 Anzeigebreite), Hinweis nimmt volle Spaltenbreite, Text bricht auf drei Zeilen, Rot wie bei 390.
- 390 hell partner-status-suspended: Chip "Gesperrt" beige mit braunem Text, Karte mit zweizeiligem Text "Deine Firma ist gesperrt. Neue Aufträge sind nicht möglich.", darunter Abschnitt "Abrechnung" mit Monatsfeld und Knopf "Journal herunterladen" (hellgrau-blau, Teal-Schrift); keine Überschrift "Dokumente" – wie gefordert. Unterhalb ca. 40 % leere Fläche (normal).
- 390 dunkel suspended: Chip dunkelgrau mit beigem Text, Karten dunkel mit feinem Rand, Knopf dunkelteal mit hellteal Schrift, natives Kalendersymbol weiß; Seitenhintergrund dunkel durchgehend.
- Monatsfeld: natives Kalendersymbol schwarz (hell) bzw. weiß (dunkel), nicht tokenbasiert; unkritisch.
- Referenz: für Partnerscreens gibt es kein Referenzbild; Karten, Radien, Schatten und Typografie entsprechen dem Stil von 13_Auftraege (Grouped-List-Karten). Maße wurden nicht aus dem Bild geschätzt.

Geprüft: Diff, ui.md, geld.md, Kundensignaturen, Tests (Rolle alert/status, Sheet-Fuß per boundingBox/elementFromPoint, Mock-Staffel), 4 Bildpaare. Nicht ausgeführt: Testläufe.
