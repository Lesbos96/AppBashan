# legal1: Prüfbericht (Abnahme, uncommitteter Arbeitsbaum)

Zahl der Funde: hoch 2, mittel 3, niedrig 3.

## hoch

1. [hoch] src/assets/legal/agb.md:19 (Punkt 2.3) – Der Kundentext sagt, er nenne "bewusst keine Vergütung von MoveNow durch Partner, weil Kunden die Gebühr in der App nicht sehen". Das steht innerhalb von [ANWALT: …] und wird für Kunden hervorgehoben angezeigt. Es verrät, dass es eine Gebühr gibt, und widerspricht `.claude/rules/geld.md` und `ui.md` (Kunden sehen die Gebühr nirgends). – Den Satz aus der Seite nehmen. Nur neutral formulieren, z. B. "[ANWALT: Offenlegungspflichten zur Finanzierung der Plattform prüfen]". Die Begründung gehört nach docs/BEKS.md oder in die Belege-Datei.
2. [hoch] tmp/shots/shots-390-*/{agb,datenschutz,partnerbedingungen,impressum}.png (und vermutlich alle Größen) – Die Shots sind veraltet. Aufnahme 08:12, die Änderungen an Titeln (`# AGB` usw.) und `break-words` in `src/components/Bars.tsx:91` stammen von 08:14. Sichtbar in den Bildern: AGB-Titel "Allgemeine Geschäftsbedingungen für Kundinnen und Kunden" auf 4 Zeilen, das "n" von "Geschäftsbedingungen" rechts am Rand abgeschnitten (390 hell und dunkel). Partnerbedingungen genauso ("Geschäftsbedingunger"). "Datenschutzerklärung" läuft bis an die rechte Kante (Glyphenende bei x≈762 von 780). Das ist der Zustand, den der Fix beheben sollte, belegt ihn aber nicht. – `npm run t -- shots:all` neu laufen lassen und die Bilder erneut prüfen. Der aktuelle Stand ist durch die Shots nicht belegt.

## mittel

3. [mittel] src/app/router.tsx:73 und src/assets/legal/partnerbedingungen.md:11,29,47,49,61,79–99 – `requireSession` prüft nur eine Sitzung, kein Partner-Konto. Jeder angemeldete Kunde erreicht /recht/partnerbedingungen und liest Provision, "Auszahlungsbetrag nach Abzug der Provision" und das Provisions-Journal. Der Text liegt außerdem per `?raw` im lazy `Recht`-Chunk, der ohne Login abrufbar ist (gemeinsam mit den Kundentexten). Eine Staffel oder Sätze stehen nicht im Text (Platzhalter [ANWALT]), das Risiko ist daher die Existenz der Gebühr, nicht ihre Höhe. – Entweder die Beks-Entscheidung "nur mit Sitzung" im Bericht ausdrücklich als Restrisiko nennen (Chunk öffentlich), oder die Partnerbedingungen in einen eigenen Chunk (`recht/partner`) legen und den Loader auf ein Partner-Konto prüfen lassen. Test ergänzen: Kunde ohne Partner-Konto wird abgewiesen.
4. [mittel] src/assets/legal/datenschutz.md:93 und :36, :96 gegen docs/legal/datenschutz-belege.md – Aussagen ohne Beleg: HeiGIT "Ort: Deutschland" und "Heidelberg Institute for Geoinformation Technology … Auftragsverarbeiter" (Belege nennen nur den Host `api.heigit.org`, kein Sitzland); Partnerbetriebe "Ort: Österreich" (keine Zeile). Belegt sind Supabase eu-west-1, Brevo EU, Turnstile-Ladezeitpunkt, 24-h-Caches, Hosting offen, keine weiteren Empfänger. Außerdem steht "Entwicklungsprojekt" als Fließtext (Zeile 93, außerhalb von [ANWALT]) in einer Kundenseite. – Je Aussage eine Belegzeile (HeiGIT-Sitz, Partner-Ort) ergänzen oder die Angabe in [ANWALT: …] verschieben. "Entwicklungsprojekt: " streichen und die Region nur in [ANWALT: …] nennen.
5. [mittel] src/assets/legal/*.md – Interne Wörter im Kundentext. Prüfung (a): keine Treffer für "OFFEN", "BEKS", "docs/", Dateipfade oder ".md". Aber: "im Projekt"/"Vorschlag aus dem Projekt" (agb.md:49,73,86,94; datenschutz.md:43,51; partnerbedingungen.md:51,99), "das Projekt hat 30 Tage entschieden" und "die Datenbank erzwingt den Vorlauf" (partnerbedingungen.md:99), "der Entwurf rechnete noch mit einem festen Satz" (partnerbedingungen.md:81), "Phase 2" (impressum.md:13, partnerbedingungen.md). Das meiste steht in [ANWALT]-Marken, ist aber auf der Seite sichtbar. – Formulierungen neutral halten ("Vorschlag:", "derzeit vorgesehen") und Interna in die Belege-Datei verschieben.

## niedrig

6. [niedrig] tests/e2e/shell.spec.ts:116–133, tests/unit/screens.test.ts:113–140 – Gut: Hinweis, Fußzeilenlink per Tastatur, kein Partnerlink in der Kunden-Fußzeile. Fehlt: Partnerbedingungen im E2E (Route ohne Sitzung leitet zur Anmeldung, mit `next` zurück; Link in Registrierung öffnet neuen Tab). Der Shot `partnerbedingungen` läuft über `/anmelden?next=…` und deckt nur das Bild ab. – Je ein Test für Loader und Registrierungslink.
7. [niedrig] src/components/Legal.tsx:93–96 – `useBack` fällt ohne Herkunft auf "Profil" zurück. Im neuen Tab der Partner-Registrierung (kein `state`) steht dann "Profil", die Seite kam aber aus der Registrierung. – Fallback im neuen Tab akzeptieren oder dort ohne Zurück-Link zeigen.
8. [niedrig] src/components/Legal.tsx:121 – Der Standard-`LegalLink` hat `min-h-11`, die Inline-Links in `Zusammenfassung.tsx:414,418` und `Mfa.tsx:86` nutzen eigene Klassen (`py-3.5` bzw. keine Höhe). Der Mfa-Link ist kein 44-px-Ziel (war schon vorher so). – Mfa: `inline-block py-3` ergänzen oder bewusst lassen.

## Prüfung (b) und (c), (d)

- (b) datenschutz.md Abschnitt 11: Belegt laut Belege-Datei: Supabase (Region, Dienste), Brevo (EU, Inhalt), Turnstile (Ladezeitpunkt, Token ohne IP), HeiGIT-Host und 24-h-Caches, Hosting offen, keine weiteren Empfänger. Unbelegt: siehe Fund 4. Die Belege sind laut ihrem Kopf für Dev geprüft, nicht für Produktion.
- (c) Fußzeilenlinks sind echte `<Link>` in `<nav aria-label="Rechtliches">`, `min-h-11` (44 px laut Klasse, nicht gemessen). Fokus sichtbar über das globale `a:focus-visible` (`src/theme.css:239`), kein eigener Stil nötig.
- (d) Router: Pfade `recht/impressum|agb|partnerbedingungen|datenschutz` passen zu Profil-Liste, Fußzeile, Zusammenfassung (`/recht/agb`, `/recht/datenschutz`), Mfa und Registrierung. Alte Pfade `/profil/datenschutz` und `/profil/impressum` sind entfernt, kein Rest im Diff.

## Shot-Zeilen (nur sichtbare Beobachtungen, keine Maße)

| Shot | Beobachtung |
|---|---|
| 390 hell start | Unter dem Satz "Richtpreis ohne Konto…" steht eine zentrierte Zeile "Impressum AGB Datenschutz" in Teal, unterstrichen, mit sichtbarem Abstand (ca. 50 px im 2x-Bild) zur Tab-Bar. |
| 390 dunkel start | Links in hellem Mint auf dunklem Grund, lesbar. Die Zeile sitzt zwischen Fließtext und Tab-Bar, nichts überlappt. |
| 390 hell profil | Liste "Info" hat 4 Zeilen: Wie rechnet MoveNow?, Impressum, AGB, Datenschutz. Die drei Rechtszeilen haben graue Kacheln, "Datenschutz" mit Schloss, die anderen mit Dokument-Symbol. |
| 390 hell anmelden-email | Fußzeile direkt unter dem "Code senden"-Knopf (ca. 40 px darunter), darunter leere Fläche. Links Teal, unterstrichen. |
| 390 hell datenschutz | Nur als 65×2000-Verkleinerung gelesen (Bild 780×24032). Hinweisband oben und Karte erkennbar, Details nicht lesbar. Titel zeigt "Datenschutzerklärung" (veralteter Stand). Ungeprüft im Detail, siehe Fund 2. |
| 390 dunkel datenschutz (Ausschnitt oben) | Hinweisband: heller Rahmen, cremefarbener Text auf grau-grünem Grund, gut lesbar. [ANWALT]-Marken: cremefarbener Text auf etwas hellerem dunklem Hintergrund, lesbar. Titel "Datenschutzerklärung" reicht bis kurz vor den rechten Rand. |
| 390 hell impressum | Titel "Impressum" einzeilig. Hinweisband beige mit braunem Rand und braunem Text. Tabelle gestapelt: fette Bezeichnung, darunter die [ANWALT]-Marke (braun auf beige), Trennlinien dazwischen. Lesbar, nichts abgeschnitten. |
| 390 dunkel impressum | Nur als verkleinertes Gesamtbild gesehen (Bild 780×7876), Struktur wie hell. Details ungeprüft. |
| 390 hell agb | Titel auf 4 Zeilen, rechts bei "Geschäftsbedingungen" das "n" abgeschnitten. Hinweisband darunter vollständig. [ANWALT]-Marken braun auf beige, umbrechen sauber mit Rundung. |
| 390 dunkel agb | Gleiche Titelabschneidung wie hell. Marken cremefarben auf dunkelgrünem Grund, Text der Karte grau, lesbar. |
| 390 hell partnerbedingungen | Nur als verkleinertes Gesamtbild gesehen (Bild 780×25388), Details ungeprüft. |
| 390 dunkel partnerbedingungen (oben) | Titel auf 3 Zeilen, "Geschäftsbedingunger" rechts abgeschnitten. Fettdruck für "Leistungen", "Gesamtpreis", "Provision" sichtbar. Hinweisband wie oben. |
| 390 hell datenschutz Abschnitt 11 (Ausschnitt) | Tabelle als gestapelte Blöcke je Empfänger (Supabase, Brevo, Cloudflare, HeiGIT). Kleine Beschriftung "Aufgabe:", "Ort:", "Stand:" vor dem Wert, [ANWALT] braun auf beige. Kein Überlauf nach rechts erkennbar. |
| 1280 hell start | Inhalt als zentrierte Spalte (ca. 625–1375 von 2000 Bildpixeln), Fußzeile mittig unter dem Text, Tab-Bar auf Spaltenbreite. Keine Fußzeile am Fensterrand. |
| 1280 dunkel, 430, 768 (alle Seiten), 1280 hell/dunkel der Rechtsseiten, anmelden-email dunkel, profil dunkel | Nicht einzeln geöffnet. Ungeprüft. Nach neuer Aufnahme (Fund 2) mit prüfen. |

Maße (44 px, Überlauf) nicht per Bild geschätzt. E2E-Test `Alle Seiten: … kein horizontaler Überlauf` (tests/e2e/shell.spec.ts:99–107) deckt Datenschutz, Impressum, AGB ab, nicht Partnerbedingungen.
