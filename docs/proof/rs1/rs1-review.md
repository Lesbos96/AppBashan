# rs1 Review (R2, Commit 852b1e9)

## hoch
Keine.

## mittel
Keine.

## niedrig
- [niedrig] src/lib/partnerJobs.ts:179 und src/screens/auftrag/Angebote.tsx:9 – `.replace(' um ', ' um ')` sieht im Quelltext wie ein No-op aus (nur das zweite Leerzeichen ist U+00A0; Bytes geprüft). Der Quelltext lässt sich leicht versehentlich normalisieren (Editor, Formatter). Fix: `' um '` schreiben. Zusätzlich liegt die Logik doppelt vor (viennaTime und `until`): `until` durch `viennaTime` ersetzen.
- [niedrig] tests/e2e: Das geschützte Leerzeichen prüft nur partner-anfragen.spec.ts:177 (Firma, „Antwort bis“). Für die Kundenseite („Gültig bis … um …“ in Angebote.tsx) fehlt eine Prüfung. Fix: in auftrag-aktionen.spec.ts `toContainText('um 11:00')` ergänzen.
- [niedrig] Screenshots 390 und 1280: In den Sheet-Aufnahmen deckt der Scrim nur die Viewport-Höhe ab, darunter steht die Seite ungedimmt. Das sieht nach Full-Page-Artefakt aus, nicht nach einem App-Fehler. Ohne Fix, nur zur Kenntnis.

## Geprüft
- Spec: Der Prüfsatz erscheint nur bei Festangebot (Anfragekarte `totalCents === null`; AngebotSheet wird nur dort gerendert, Zeile 202). Absage-Maske: eine Zeile ohne Prüfsatz, nur bei Pauschale 0. Bei `fixedOffer` entfällt die Weitervermittlungszusage. Ohne `change` bleibt `fixedOffer` false, die Zeile entfällt. Passt zur Spec.
- Kunde: „Alle Angebote ablehnen“ mit Bestätigungs-Sheet, `reject_offers` mit `{p_request}`, Erfolgshinweis, `cancel.ts`-Text, Fokus per `focusOnMount` (Ref-Funktion außerhalb der Komponente, stabil, `tabIndex={-1}`). Die RPC existiert (0038, 0072 mit Replay-Schutz) und ist nur für `authenticated` freigegeben.
- Gebühr: Keine Gebühr, Provision oder Prozentsätze im Diff, keine Staffelwerte im App-Code. Beträge laufen über `formatEuro` bzw. `whitespace-nowrap`. Keine Emojis, keine Platzhaltertexte.
- Screens (390 Light und Dark, 1280 Light): kunde-meldung-angebote, -ablehnen-sheet, partner-festangebot-sheet, partner-absage-festangebot, partner-meine-angebote, partner-ablehnen-hinweis.
  - Beträge stehen in einer Zeile, kein horizontales Scrollen, nichts abgeschnitten.
  - Der Knopf „Alle Angebote ablehnen“ ist als Textknopf unter den Angeboten klar abgesetzt, Höhe ca. 48 px bei Faktor 2 und damit ≥ 44 pt.
  - Dark-Variante konsistent mit den Dark-Tokens. Auf dem Desktop bleibt die Spalte zentriert.
  - Der Prüfsatz steht in text-subhead/secondary, der Umbruch ist sauber.
  - Die Sätze „Du hast die Anfrage abgelehnt.“ (Partner) und „Du hast alle Angebote abgelehnt.“ (Kunde) sind getrennt und korrekt.
- Nicht geprüft: 430 und 768 px (nur stichprobenartig nicht geöffnet); keine Läufe gestartet.
