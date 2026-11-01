# S9a-2 Shots

Aufnahme durch `test-runner` (`npx playwright test tests/shots --project=shots-{390,430,1280}-{light,dark} --grep "gesendet-|auftraege"`, danach `gesendet-spanne` nach Korrektur der Erwartung erneut: 6 von 6, Exit 0; Logs `s9a2-shots.log`, `s9a2-shots2.log`). Beurteilung durch den `reviewer` (alle 18 Bilder mit Read geöffnet, Referenzen `12_Bestaetigung`, `13_Auftraege`). Maße (Breite, Abstand, Überlauf) sind „Maß nicht aus dem Bild“; `whitespace-nowrap` an den Beträgen steht in `src/screens/anfrage/Gesendet.tsx` Zeilen 44, 64, 65 und `src/screens/Auftraege.tsx` Zeile 108. `shots:all` nicht gelaufen: betroffen sind drei Screens (höchstens drei).

| Datei | Breite | Modus | Befund |
|---|---|---|---|
| gesendet-spanne.png | 390 | Light | Chip „Wartet auf Angebot“ links in blassem Teal auf hellgrauem Grund (nicht Gelb wie „Angefragt“ in der Referenz). Rechts steht klein „Richtpreis“, darunter „950 € bis 1.550 €“ fett in Teal in einer Zeile. Die Referenz zeigt den Preis dunkel und neben dem Label, hier liegt er gestapelt und in Teal. Der Kopfbereich weicht ab: Der Haken-Kreis sitzt weit oben (Mitte bei 296 px, Referenz 460 px), die Überschrift klebt direkt unter den Ringen. |
| gesendet-spanne.png | 390 | Dark | Dunkler Teal-Verlauf mit Haken-Kreis. Der Chip ist mintgrün auf dunklem Teal, der Preis „950 € bis 1.550 €“ in hellem Mint in einer Zeile. Karte mit feiner Kontur, Icon-Kachel mit Korb, Kontrast gut. Kopfabstand wie in Light. |
| gesendet-angebot.png | 390 | Light | Karte „Montage“ mit Hammer-Icon. Chip „Wartet auf Angebot“ in Teal-Tint links, rechts in Grau „Preis nach Prüfung“ in einer Zeile. Es steht keine Gebühr und keine „Besichtigung angefragt“ mehr da. Die Zeile ist niedriger als bei der Spanne, weil das Label „Richtpreis“ fehlt. |
| gesendet-angebot.png | 390 | Dark | „Montage“ mit Hammer-Icon. Mint-Chip links, rechts „Preis nach Prüfung“ in gedämpftem Grau auf dunkler Karte. Lesbar, Rand und Kachel passen zu 02_Start_Dark. |
| auftraege-liste.png | 390 | Light | Titel „Aufträge“ sitzt bei y≈130 px, die Referenz hat ihn bei y≈235 px (weniger Kopfraum). Segment „Aktiv · 3“ ist weiß, „Erledigt“ grau. Karte 1 hat den gelben Chip „Angefragt“ und „689,61 €“. Karte 2 hat den Teal-Chip „Wartet auf Angebot“ und „Preis nach Prüfung“ in Grau. Karte 3 hat „950 € bis 1.550 €“ in einer Zeile, fett und dunkel (nicht Teal wie auf der Gesendet-Seite). Das Hinweisfooter „Richtpreise sind unverbindlich…“ ist zentriert. Die Tab-Bar zeigt vier Tabs mit „Miete“ (siehe Findings). |
| auftraege-liste.png | 390 | Dark | Gleiche Struktur. Der Chip „Angefragt“ ist graubraun auf dunklem Grund (Gelb ist abgedunkelt). Teal-Chips sind mint, die Preise weiß und in einer Zeile. Aktives Segment ist ein hellerer Grauton. In der Tab-Leiste ist „Aufträge“ mint hervorgehoben, daneben steht „Miete“. |
| gesendet-spanne.png | 430 | Light | Wie bei 390, die Karte ist breiter. Der Chip steht links, „Richtpreis / 950 € bis 1.550 €“ rechtsbündig in Teal und in einer Zeile. Der Kreis ist mittig bei x≈430. Rechts bleibt viel Platz, nichts abgeschnitten. Kopfabstand wie bei 390. |
| gesendet-spanne.png | 430 | Dark | Dunkel, Preis in hellem Mint rechts, Chip in dunklem Teal mit Mint-Text. Kreis und Ringe sind zentriert, die Aktionsleiste unten ist durch eine Linie getrennt. |
| gesendet-angebot.png | 430 | Light | „Montage“, Hammer-Icon, Chip „Wartet auf Angebot“ links und „Preis nach Prüfung“ rechts in Grau. Rechtsbündig mit dem Kartenrand. |
| gesendet-angebot.png | 430 | Dark | Gleiches Layout in Dark. „Preis nach Prüfung“ ist als hellgrauer Text sichtbar, der Chip ist mint auf dunklem Teal. Buttons „Zu meinen Aufträgen“ in Teal-Verlauf, „Zur Startseite“ in Mint. |
| auftraege-liste.png | 430 | Light | Drei Karten, Chips „Angefragt“ (gelb), „Wartet auf Angebot“ (zweimal, Teal-Tint). Die Preise „689,61 €“ und „950 € bis 1.550 €“ stehen rechtsbündig in einer Zeile, „Preis nach Prüfung“ grau. Der Footer bricht nach „bestätigt“ um. Tab-Leiste mit „Miete“. |
| auftraege-liste.png | 430 | Dark | Wie 390 Dark mit breiteren Karten. Alle drei Preise in Weiß in einer Zeile, Chips lesbar. Tab „Miete“ vorhanden. |
| gesendet-spanne.png | 1280 | Light | Zentrierte Spalte ca. 750 px (Maß nicht aus dem Bild) mit Karte, Kreis oben mittig, Chip links und „950 € bis 1.550 €“ rechts in Teal in einer Zeile. Die Aktionsleiste („Zu meinen Aufträgen“) liegt im unteren Bereich der Spalte, die Ränder links und rechts sind leer. Kein Gerätemockup. |
| gesendet-spanne.png | 1280 | Dark | Gleiche zentrierte Spalte auf dunklem Grund. Der Preis ist mint, die Karte hat feine Kontur. Am unteren Ende ist die Leiste unter „Zur Startseite“ nur schwach vom Hintergrund abgesetzt (feines Rechteck erkennbar). |
| gesendet-angebot.png | 1280 | Light | Spalte mit Karte „Montage“. Chip links, „Preis nach Prüfung“ in Grau rechtsbündig am Kartenrand. Die Leiste unter dem Button hat einen helleren Streifen als der Seitenhintergrund. |
| gesendet-angebot.png | 1280 | Dark | Dunkel, Spalte zentriert. Karte „Montage“ mit Hammer-Kachel, Chip mint, „Preis nach Prüfung“ in Grau. Button in Teal-Verlauf, kein Überlauf sichtbar. |
| auftraege-liste.png | 1280 | Light | Zentrierte Spalte. Titel „Aufträge“ links in der Spalte, Segment, drei Karten. Die Umzug-Zeile steht in einer Zeile („Neubaugasse 12 → Praterstraße 30“), die Preise sind einzeilig. Der Footer ist einzeilig. Die Tab-Bar ist nur etwa 810 px breit und zentriert, mit „Miete“. |
| auftraege-liste.png | 1280 | Dark | Gleiche Struktur in Dark. Gelber Chip „Angefragt“ ist dunkelbraun, Teal-Chips sind mint. Alle Beträge in einer Zeile weiß. Aktives Segment ist ein hellerer Grauton. Tab-Bar zentriert, 4 Tabs. |

## Findings des Reviewers (Hauptsession ordnet zu, `docs/OPEN_ISSUES.md`)

- [mittel] Tab-Bar zeigt „Miete“; CLAUDE.md verlangt in Phase 1 „Start · Aufträge · Profil“ (alle Größen, Aufträge). Vorbestehend, nicht Teil von S9a-2.
- [mittel] Aufträge (390): Kopfabstand des Titels weicht von `13_Auftraege` ab (y≈130 statt ≈235). Vorbestehend.
- [mittel] Gesendet (390, 430): Haken-Kreis sitzt höher als in `12_Bestaetigung` (y≈296 statt ≈460). Vorbestehend, die Anordnung stammt aus S8b.
- [niedrig] Gesendet-Spanne: Preis teal und gestapelt unter „Richtpreis“, in Aufträge dunkel; vereinheitlichen, falls nicht gewollt.
- [niedrig] Datum ohne Jahr („Fr., 13. Nov.“) gegenüber der Referenz mit Jahr.

Reviewer-Findings hoch: 0
