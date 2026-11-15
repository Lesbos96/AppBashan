# s9k-1 Abnahme Oberfläche (R3-Teil)

Geprüft: Diff und neue Datei (Quelltext), 390 px Light und Dark (Kunde: 4 Zustände; Partner: in Prüfung), 320 px stichprobenartig (Kunde Termin-Frage Light, Sheet Dark, Abgeschlossen-Frage Dark; Partner Light). Nicht gelesen: weitere 320-Aufnahmen (gemeldet-prüfung, Sheet Light, Termin Dark, Partner Dark); Maße nur aus Testcode gesichtet, nicht ausgeführt.

## Beobachtungen (Bildsicht)
| Screen | Beobachtung |
|---|---|
| kunde-meldung-abgeschlossen-frage (L, D) | Badge „Erledigt" grau, Verlauf alle vier Punkte teal (Light) bzw. Mint (Dark), „Erledigt" fett. Frage-Karte hat nur einen einzigen vollflächigen Teal-Knopf „Nein, er hat nicht stattgefunden"; Fristtext „bis 8. Jänner um 08:00 Uhr" steht im Fließtext. Dark: Karte dunkelgrün mit Rand, Knopf Teal-Verlauf, Text weiß. |
| kunde-meldung-termin-frage (L, D) | Zwei Knöpfe: „Ja, er hat stattgefunden" primär (Teal-Verlauf), „Nein, …" tinted (hellgrau-blau, Teal-Text), klare Hierarchie. Badge „Läuft" teal gefüllt, Letzter Verlauf-Punkt „Erledigt" blass. Dark: tinted-Knopf dunkelgrün mit Mint-Text, lesbar. |
| kunde-meldung-gemeldet-pruefung (L, D) | Weiße Karte (Dark: dunkel) mit Text „Du hast gemeldet, dass der Auftrag nicht stattgefunden hat. Wir prüfen ihn und melden uns bei dir." ohne Knöpfe; Nachtrag und Stornieren fehlen, Verlauf bleibt bei „Läuft". Kein Zeitpunkt, keine Gebühr. |
| kunde-meldung-zurueckziehen-sheet (L, D) | Sheet mit Griff, Titel „Anfrage zurückziehen" zentriert, runder X-Knopf rechts, Text, primärer Teal-Knopf „Ja, zurückziehen", darunter Textknopf „Doch nicht". Dahinter Overlay, Badge „Wartet auf Angebot"; der auslösende Knopf ist nur angeschnitten hinter dem Sheet sichtbar. |
| partner-auftraege-in-pruefung (L, D) | Karte „Umzug, Bezirk 3", Badge „Läuft"; zwischen Beträgen und „Kontakt und Adresse anzeigen" steht der Hinweis „Der Kunde hat gemeldet … Wir prüfen ihn und melden uns bei dir." Es gibt keine Knöpfe Starten, Abschließen, Absagen; kein Zeitpunkt, kein Wortlaut des Kunden. |
| 320 px | Termin-Frage Light: „Nein, er hat nicht stattgefunden" bricht in zwei Zeilen um, Zeilenabstand im tinted-Knopf eng (Text nahe am Rand). Dark Abgeschlossen-Frage: zweizeiliger Primärknopf, ordentlich. Partner 320: „Kontakt und Adresse anzeigen" zweizeilig (vorbestehend). Kein Überlauf sichtbar. |

## Findings (erste Runde)

[mittel, behoben s. Nachprüfung] tmp/shots (kunde-meldung-*): Der Ruhezustand von „Anfrage zurückziehen" war in keinem Screenshot sichtbar. Fix: Aufnahme ohne Sheet ergänzen.

[mittel, behoben s. Nachprüfung] src/screens/auftrag/Termin.tsx: Ladeanzeige und Fehlerkarte für jeden live-/completed-Auftrag. Fix: beim Laden nichts, bei Fehler dezente Zeile.

[niedrig, behoben s. Nachprüfung] Hinweis „und melden uns bei dir" verspricht eine Benachrichtigung, die der Plan nicht vorsieht (Kunde und Firma).

[niedrig, offen] tests/shots/meldung.spec.ts:53: Fixture `report_until: 2026-01-08` passt nicht zu Termin 15. Dezember 2026 (Frist 7 Tage). Im Bild steht „8. Jänner" beim Termin 15. Dezember. Fix: `report_until` = Termin + 7 Tage (22. Dezember).

[niedrig, offen] 320 px, Termin-Frage Light: zweizeiliger tinted-Knopf mit engem Zeilenabstand. Höhe ≥ 44 px der neuen Knöpfe ist nicht per `boundingBox` gemessen (nur `scrollWidth`, meldung.spec.ts:66). Fix: Höhe per boundingBox in `meldung.spec.ts` messen, Zeilenabstand mehrzeiliger Button-Beschriftung prüfen.

[niedrig, offen] src/screens/partner/Auftraege.tsx: „Kontakt und Adresse anzeigen" bleibt in Prüfung nutzbar. Vorbestehendes Verhalten; Entscheidung dokumentieren (BEKS) oder bei `underReview` ausblenden.

## Quelltext
- Auftrag.tsx: Nachtrag und Cancel nur ohne Meldung; Termin nur über `my_report_info`, nie über die Geräteuhr; Hinweis nur bei `R && !S`. Stimmt mit dem Plan überein.
- `started` / `terminStarted` bleiben in Gebrauch (Cancel-Zeile), keine toten Importe oder Props gefunden.
- Keine Gebühr-/Provisionstexte, keine Emojis, Beträge in einer Zeile (689,61 € auf allen Aufnahmen).
- Fristformat in Termin.tsx (`replace(',', ' um')`) ist ICU-abhängig; Ausgabe im Bild korrekt.

## Nachprüfung (Commit 5227c7e)

| Bild | Beobachtung |
|---|---|
| kunde-meldung-zurueckziehen-ruhe (390, Light) | Unter der Verlauf-Karte steht ein breiter, flacher Knopf „Anfrage zurückziehen" in blassem Grau-Blau mit dunkelteal Text, ohne Schatten und ohne Teal-Füllung; er wirkt klar zweitrangig. Badge „Wartet auf Angebot", Verlauf: nur „Angefragt" teal und fett, die übrigen drei Punkte blass. |
| kunde-meldung-zurueckziehen-ruhe (390, Dark) | Knopf dunkelgrün (etwas heller als die Karte) mit Mint-Text, ohne Verlauf, Kontrast gut lesbar; Seite sonst dunkelblau-grün, Punkt „Angefragt" mint. |
| kunde-meldung-320-zurueckziehen-ruhe (Light) | Gleicher Knopf auf voller Kartenbreite, Text einzeilig, nichts abgeschnitten; Datum bricht vor „8 bis 11 Uhr" um, Preis „689,61 €" in einer Zeile. |
| kunde-meldung-320-zurueckziehen-ruhe (Dark) | Knopf dunkel mit Mint-Text einzeilig und lesbar; Rand der Karten sichtbar, Preis in einer Zeile. |
| kunde-meldung-termin-frage (390, Light) | Unverändert: „Ja, er hat stattgefunden" primär mit Teal-Verlauf, „Nein, er hat nicht stattgefunden" tinted darunter; Fristtext noch „bis 8. Jänner um 08:00 Uhr" (Fixture, s. offenes Finding). |
| kunde-meldung-gemeldet-pruefung (390, Dark) | Hinweiskarte zweizeilig: „Du hast gemeldet, dass der Auftrag nicht stattgefunden hat. Wir prüfen ihn." Der Satz „und melden uns bei dir" ist weg, Karte entsprechend niedriger, kein Knopf. |
| partner-auftraege-in-pruefung (390, Light) | Hinweis lautet jetzt „Der Kunde hat gemeldet, dass der Auftrag nicht stattgefunden hat. Wir prüfen ihn." (drei Zeilen, letzte Zeile „prüfen ihn."); kein Start-, Abschließen-, Absage-Knopf, „Kontakt und Adresse anzeigen" bleibt (offenes niedriges Finding). |

Quelltext Termin.tsx: Laden liefert `null`; bei Fehler eine Karte mit `role="alert"`, dezentem Text und „Erneut versuchen" (Plain-Knopf), kein Rückfall auf die Geräteuhr. Per E2E belegt laut Auftrag, hier nicht ausgeführt. M1, M2 und Hinweistext sind behoben.

Offene Findings hoch: 0
