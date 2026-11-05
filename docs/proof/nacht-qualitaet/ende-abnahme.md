# Abnahme Nacht "Barrierefreiheit und Ladegeschwindigkeit" (Branch nacht-qualitaet, 1630668..HEAD)

Geprüft: Diff `src` und `tests`, Nachtdatei, Shots in Bildsicht. Maße nicht geschätzt, Tests nicht neu gelaufen (Logs unter `tmp/proof/` nicht geprüft).

## Punkt 1: Spec und Regeln
- `supabase/`, Migrationen, `package.json` und Lockfile: im Diff unberührt. Keine Supabase-Aufrufe neu (`requireSession` ist unverändert im Verhalten, nur in der Datei verschoben). Keine Geld-Logik geändert, `formatEuro` bleibt die einzige Formatierung; die neue Statusmeldung in `Preis.tsx` nutzt `formatEuro`.
- Keine Gebühr, "15 %" oder "Provision" im Diff. Keine Drittanbieter. Texte per Du und kurz.
- Preisleiste: Beträge bleiben `truncate whitespace-nowrap`. Text ohne Betrag bricht um. Das passt zu CLAUDE.md.
- Tab-Bar: `Shell.tsx:8-13` zeigt weiter "Miete" (vier Tabs), CLAUDE.md verlangt Start, Aufträge, Profil. Stammt nicht aus der Nacht (A20, bekannt), steht auch im Profil-Shot.
- `prefers-reduced-motion`: nicht angefasst, die neuen Elemente haben keine Animation.

## Findings

### hoch
Keine.

### mittel
- [mittel] `src/screens/anfrage/Zusammenfassung.tsx:356-365` (A21, Commit 000b165) - Der Hinweis erscheint unter der ganzen Kontaktliste, nicht am Feld. Wer das Telefonfeld verlässt, steht schon im nächsten Feld, und der Hinweis liegt unter der fixierten Aktionsleiste. Im 390-px-Shot `hinweis-zusammenfassung-telefon.png` ist er nicht zu sehen: Telefon zeigt "12", Mailadresse hat den Fokus, und nichts Rotes ist im Bild. Im 1280-Shot ist er ebenfalls nicht zu sehen. Nur im 430-Shot steht die rote Zeile "Prüfe die Telefonnummer, sie braucht mindestens 5 Ziffern." sichtbar. Sehende Nutzer auf kleinen Phones bemerken den Hinweis nicht, und die Live-Region sagt ihn nur Bildschirmlesern an. Fix: den Hinweis als zweite Zeile direkt im `li` des Feldes darstellen (`Field` bekommt `error`), oder beim Erscheinen `scrollIntoView({block:'nearest'})` bei vorhandenem `scroll-padding-bottom`. Den 390- und 1280-Shot so aufnehmen, dass der Hinweis im Bild ist; als Beleg taugen sie so nicht.
- [mittel] Shot `shots-390-light/hinweis-zusammenfassung-telefon.png` (oben im Bild) - Die Rücksprung-Zeile "Termin" überlagert die große Überschrift "Zusammenfassung" (Text liegt übereinander). Bei 430 sitzt derselbe Zustand sauber, und `zusammenfassung-angemeldet` bei 390 ebenfalls. Vermutlich ein Scroll-Artefakt (die Seite scrollte beim Fokus auf die Mailadresse) mit schon halb eingeblendeter Kopfleiste, aber bei 390 nicht belegt. Prüfen, ob die Überlagerung in der Kopfleiste (halbtransparente Leiste über der großen Überschrift) auch im echten Scrollen auftritt. Falls ja, ist es ein sichtbarer Fehler, falls nur ein Aufnahmezustand, den Shot nach dem Scroll-Ende aufnehmen.

### niedrig
- [niedrig] `Zusammenfassung.tsx:206-210` - Der Hinweis entsteht beim Blur und schiebt alles darunter um etwa eine Zeile nach unten. Tippt jemand direkt aus einem ungültigen Feld auf Einwilligung oder Link darunter, verschiebt sich das Ziel zwischen Antippen und Loslassen; der Tipp kann daneben landen. Wird mit dem Fix oben (Hinweis im Feld) kleiner, aber nicht null. Reservierte Höhe wäre die Alternative.
- [niedrig] `Shell.tsx:49-74` (A5) - Fokus auf `h1` nach jedem Wechsel, auch bei Tab-Leisten-Wechsel und Browser-Zurück. Der Code ist in sich stimmig (Observer wird beim nächsten Wechsel und nach 5 s getrennt, `before`-Vergleich schützt vor Wegziehen, Titel liegen am statischen Handle). Randfall: zeigt die neue Seite ihre `h1` nie (Seiten ohne `h1`), wartet der Observer 5 s und tut nichts; unkritisch. Folge für Tastaturnutzer ist F6. Keine Änderung nötig, Entscheidung bei Beks.
- [niedrig] `router.tsx:86` (P2) - Nach 1,5 s laden alle 9 Chunks gleichzeitig; das konkurriert mit dem ersten Tarifabruf und verbraucht mobile Daten ohne Nutzer-Absicht. Vorschlag: `requestIdleCallback` (mit Fallback) und bei `navigator.connection?.saveData` überspringen. Offline im ersten Fenster: Fehlerseite statt Flow, in der Nachtdatei dokumentiert.
- [niedrig] `tests/e2e/barrierefreiheit.spec.ts:265-276` - Hartkodierter Betrag "95,74 €" hängt an den Tarifdaten, nicht an einer Regel. Ändert sich `price_config` oder der lokale Tarif-Ersatz, wird der Test rot, ohne dass die Statusmeldung kaputt ist. Besser: Anfangsbetrag aus dem aria-label des Knopfs lesen und mit der Meldung vergleichen.
- [niedrig] `barrierefreiheit.spec.ts:258` und `:415` - Feste `waitForTimeout` (2200 ms, 300 ms). Der erste Test prüft "bleibt gleich" und besteht auch, wenn die Wartezeit nie zählt (der Rot-Beweis im Log mildert das). Der zweite ist ein Negativ-Test, der bei schnellerem Observer trivial grün wird. Besser mit `expect.poll`-Fenster bzw. Zählerstand "Noch N s" prüfen (N muss sich ändern, Alert-Text nicht).
- [niedrig] `barrierefreiheit.spec.ts:23-37,44-60` - `tabTo` bricht nach 40 Tabs ohne Fehler ab und misst dann irgendein fokussiertes Element. Die Hell/Dunkel-Rahmentests bestehen damit auch, wenn das Zielelement nie erreicht wurde. Fix: nach der Schleife prüfen, dass das Label passt, sonst `throw`.
- [niedrig] `barrierefreiheit.spec.ts:218-222` (erster Aufruf, Fokus bleibt auf body) - Schutztest, prüft aber nur `document.body`; zeigt eine Seite nach Redirect später den Fokus, fiele es nicht auf. Akzeptabel.
- [niedrig] Nachtdatei, Kopfzeile Test-Zahl: "30 neue Tests" und Tabelle (26, später mehr) nicht einheitlich; die Schleifen (Hell/Dunkel) zählen doppelt. Nur Doku.

## Punkt 2: Korrektheit im Detail
- Shell: Fokus, Observer, Titel stimmig. Titel-Effekt hängt an `handle.title` (nicht an `nav`), deshalb stimmt der Titel auch bei Profil/Info-Sheet. Fehlerseite setzt ihren Titel selbst.
- Router: `handle` statisch, Loader `requireSession` läuft parallel zu `lazy`, Redirect vor dem Wechsel; Vorladen fängt Fehler ab. Kein Fund.
- Preis.tsx: `role="status"` mit `sr-only` im `ActionBar`; kein doppeltes Ansagen, weil der Knopf-Name nur beim Fokus gelesen wird. Mindesthöhe 54 px: Ruhezustand unverändert (Shot Montage 430: Leiste unverändert, "95,74 €" in einer Zeile).
- Fotos/Onboarding: Live-Regionen melden beim ersten Anzeigen nichts; im Onboarding umschließt die Region den `AnimatePresence`-Wechsel, die Ansage kommt mit dem neuen Inhalt. Kein Fund.
- Zusammenfassung Wartezeit: `role="alert"` nur noch am Meldungstext; die Zählung steht ausserhalb. Korrekt.

## Punkt 3: Tests
Die Tests decken A1 bis A15 und A21 bis A23 ab und prüfen überwiegend Verhalten (Fokusziel, Kontrastwerte, Zugänglichkeitsnamen, Live-Region-Inhalt). Rein strukturelle Tests: A9 (Name beginnt mit Kamera), A22 (`autocomplete`-Attribut), A23 (`aria-valuetext`) prüfen Attribute, was dort die eigentliche Änderung ist. Lücken: A6 ohne Rot-Beweis (vermerkt), A8 ohne Rot-Beweis, A13/A14 prüfen Region-Struktur, nicht die Ansage selbst (mit Playwright nicht messbar). Mängel siehe niedrig oben.

## Punkt 4: Shots (Bildsicht)

| Shot | Größe/Modus | Bildbeobachtung |
|---|---|---|
| hinweis-zusammenfassung-telefon | 390 Light | Telefon "12", Fokus mit teal Rahmen und markierter Mailadresse; kein roter Hinweis im Bild (unter Aktionsleiste); oben liegen "Termin" und "Zusammenfassung" übereinander. Fund. |
| hinweis-zusammenfassung-telefon | 430 Light | Rote Zeile "Prüfe die Telefonnummer, sie braucht mindestens 5 Ziffern." in der Fußnoten-Schrift unter der Liste, darunter der graue Satz "Der Partner bekommt ...". Stil passt (Fließtextgrösse wie Fußnote, Rot wie Fehlertexte). |
| hinweis-zusammenfassung-telefon | 1280 Light | Spalte mittig (ca. 750 px breit), Telefon "12", Mailadresse mit Rahmen und markiertem Text; Hinweis unter der Aktionsleiste, nicht sichtbar. Oben schimmert die Überschrift "Zusammenfassung" als Geisterschrift hinter der Kopfleiste. |
| fokus-zusammenfassung-feld | 390 Light | Stiege / Tür mit 2-px-Rahmen in dunklem Teal, innen, an den unteren Ecken der Karte gerundet; Kopfleiste oben mit "Termin" und Titel; Rahmen nicht abgeschnitten. |
| zusammenfassung-angemeldet | 390 Light | "Anfrage senden" in Teal-Verlauf unten, kein roter Hinweis, vier Kontaktzeilen mit "optional" bei Stiege / Tür; Seite wie vor der Nacht. |
| zusammenfassung-angemeldet | 768 Light | Spalte zentriert (ca. 690 px), links und rechts graue Fläche, Aktionsleiste auf Spaltenbreite, "Anfrage senden" fest unten; nichts abgeschnitten. |
| zusammenfassung-angemeldet | 1280 Dark | Dunkle Spalte (Hintergrund fast schwarz-grün), Karten etwas heller, Haken mint, "Anfrage senden" in Teal; Links "AGB" und "Datenschutz" in Mint. |
| umzug-beispiel | 390 Dark | Marker "A" im Ring mit mintfarbenem Rand (Fix A11), Marker "B" gefüllt teal; "Richtpreis · inkl. USt. ^ 689,61 €" in einer Zeile; Schalter an in Teal, aus in dunklem Grau; nichts horizontal abgeschnitten. |
| montage-standard | 430 Light | "95,74 €" in einer Zeile in der Preisleiste, "Weiter" Teal-Knopf rechts; Segment "Standardmöbel" weiß auf grauem Grund; Illustration mit Materialfarben (Holz, Weiß, Teal-Bohrer). |
| willkommen-1 | 768 Dark | Zentrierte Spalte (ca. 1000 px bei Faktor 2), Teal-Verlauf mit Transporter und braunen Kartons, "Überspringen" oben rechts hell auf dunklem Teal, "Weiter"-Knopf unten Teal; Titel "Alles für deinen Move. In einer App." |
| fehler | 1280 Light | Offener brauner Karton mit Pin, Titel "Seite nicht gefunden" fett, Untertitel grau, Knopf "Zum Start" Teal, mittig; kein Gebührentext, keine Tab-Bar. |
| entruempelung-fotos | 768 Light | "Fotos" als Kartenüberschrift, "0 von 8" rechts, zwei Tonflächen "Kamera" und "Galerie" mit Teal-Icons; "Richtwert anzeigen" unten über volle Spaltenbreite; Fortschritt "Schritt 6 von 6 100 %". |
| fokus-profil-listenzeile | 390 Light | Zeile "Datenschutz" mit 2-px-Teal-Rahmen innen, geht bis zu den Karten-Rändern, nicht abgeschnitten; Tab-Bar unten mit vier Tabs inklusive "Miete". |

Nicht angesehen: restliche Größen/Modi der übrigen genannten Screens (nur je eine Größe pro Screen), die Fokus-Shots 430/1280 und `fokus-onboarding-ueberspringen`; Einschränkung: Rückschlüsse nur aus den oben gelisteten Bildern.

## Empfehlung
- Übernehmen: alle Commits ausser dem A21-Hinweis (000b165) in jetziger Form. Dazu gehören A1 bis A15 (inkl. A1b, A1c, A5b, A14b), A22, A23, P1 (618dd9e) und P2 (3a0a339) (P2 nur, wenn Beks F8 akzeptiert: Direktaufruf von `/umzug` etwa 0,5 s langsamer).
- A21 (000b165) überarbeiten, bevor es übernommen wird: Hinweis am Feld statt unter der Liste, und den 390- und 1280-Shot mit sichtbarem Hinweis neu aufnehmen. Pflichtfeld-Attribute (`aria-required`) und `aria-describedby`-Verknüpfung können bleiben.
- Offene Entscheidungen bei Beks: F2, F3, F4, F5, F6, F7, F8, F9; der "Miete"-Tab bleibt ausserhalb dieses Diffs.
