# a21b Review (Modus Runde, nur UI): Hinweis unter Telefonfeld, Zusammenfassung

Alle sechs Bilder und die Vergleichsreferenz `tmp/shots/shots-390-light/zusammenfassung-angemeldet.png` wurden mit Read geöffnet. Maße wurden nicht geschätzt. Die Aussagen unten sind reine Bildbeobachtungen.

| Bild | Bildbeobachtung |
|---|---|
| 390 light | Roter Text "Prüfe die Telefonnummer, sie braucht mindestens 5 / Ziffern." steht direkt unter "Telefon / 12" im weißen Kontakt-Card. Er beginnt linksbündig auf der x-Linie der Labels (Name, Telefon, Mailadresse). Er läuft über zwei Zeilen, das Wort "Ziffern." steht allein in Zeile 2. Zwischen Hinweis und der Mailadresse-Zeile (Fokusrahmen Teal) liegt sichtbar Luft. Die Trennlinie zwischen Name und Telefon ist da, zwischen Telefon und Hinweis ist keine. Der Hinweis gehört optisch zur Telefon-Zeile. Er liegt weit unter der Kopfleiste und über der Aktionsleiste, nichts wird überlagert oder abgeschnitten. |
| 390 dark | Gleiche Position und Umbruch. Die Farbe ist ein helles Lachsrot auf dunklem Card, gut lesbar. Das Rot ist heller als im Light-Bild, wie bei einem Dark-Token. Der Fokusrahmen ist hell-mint. Das Card hat die dunkle Fläche und einen feinen Rand wie die anderen Cards. Der Hinweis ist nicht abgeschnitten. |
| 430 light | Der Hinweis passt in eine Zeile ("... mindestens 5 Ziffern."), rot, links bündig mit "Telefon". Er steht unter "Telefon 12" und über dem umrahmten Mailadresse-Feld. Die Seite ist hier an den Anfang gescrollt, großer Titel "Zusammenfassung" sichtbar. Der Hinweis ist nicht verdeckt. Unten läuft Text ("Kostenlos stornieren ...") durch die halbtransparente Aktionsleiste, das ist unabhängig vom Hinweis. |
| 430 dark | Wie 430 light in der Anordnung. Der Hinweis ist Lachsrot auf dunklem Grund, einzeilig und lesbar. Der Fokusrahmen ist mint. Unter der Aktionsleiste scheint dieselbe Textspur durch. |
| 1280 light | Die Spalte ist zentriert (ca. 625–1375 von 2000 Bildpixeln). Der Hinweis steht einzeilig, rot, linksbündig unter "Telefon 12", mit Abstand zur Fokuszeile. Er ist nicht abgeschnitten. In der Kopfleiste rechts (bei ca. x=1310, y=22) ist ein sehr blasser Geistertext zu erkennen, der nicht zum Hinweis gehört. |
| 1280 dark | Wie 1280 light. Hinweis in hellem Rot auf dunklem Card, einzeilig, deutlich lesbar. Dieselbe schwache Geisterspur wie im Light-Bild bei x≈1310 am oberen Rand. Der Fokusrahmen ist mint. |

Vergleich mit `zusammenfassung-angemeldet.png` (ruhige Optik): Das Card hat dort vier gleich hohe Zeilen mit Trennlinien. Mit dem Hinweis wird die Telefon-Zeile um eine Textzeile höher. Das fügt sich ein, der Rhythmus bleibt ruhig.

## Findings

- [niedrig] Zusammenfassung 390 px (light und dark) – Der Hinweis bricht um und lässt "Ziffern." allein in Zeile 2 stehen (Witwe), bei 430/1280 passt er in eine Zeile. Fix: Text kürzen (z. B. "Mindestens 5 Ziffern.") oder `text-wrap: balance`/`pretty` auf dem Hinweis setzen.
- [niedrig] Zusammenfassung, Telefon-Zeile – Zwischen Telefon-Zeile und Hinweis steht keine Trennlinie, das ist gewollt und ordnet den Hinweis richtig zu. Die Trennlinie nach dem Hinweis ist wegen des Fokusrahmens im Bild nicht beurteilbar. Fix: Prüfen, ob die Linie im Zustand ohne Fokus unter dem Hinweis steht (nicht blockierend, falls ja).
- [niedrig] Aktionsleiste (430 und 1280, beide Themes) – Inhalt scheint durch die Leiste und über die Kopfleiste rechts durch. Das ist nicht neu und betrifft den Hinweis nicht. Fix: nur beobachten, nicht in dieser Runde.

Keine hohen oder mittleren Findings. Der Hinweis ist in allen sechs Bildern sichtbar, eindeutig dem Telefonfeld zugeordnet, in Light und Dark lesbar, nicht abgeschnitten und nicht überlagert.
