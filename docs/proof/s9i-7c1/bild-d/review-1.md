# Review 1: Karte "Abrechnung" im Partner-Portal (Modus Runde, nur UI)

| Bild | Beobachtung (nur per Bildsicht) |
|---|---|
| shots-1280-dark__partner-abrechnung-fehler.png | Spalte mittig (ca. 515 bis 1130 von 1643 px Anzeigebreite), Seite links und rechts dunkelgrün leer. Meldung "Deine Anmeldung ist abgelaufen. Melde dich neu an." steht in Lachsrot zwischen Format-Hinweis und Knopf, gut lesbar auf dem dunklen Kartengrund. Kalender-Symbol rechts in der Monatszeile ist weiß. |
| shots-1280-dark__partner-abrechnung.png | Gleiche Karte ohne Meldung. Zwischen dem grauen Format-Hinweis und dem Knopf "Journal herunterladen" (türkiser Text auf dunkelgrauem Tint) bleibt nur ein kleiner Abstand. Die Karte endet ca. 20 px über der Karte "Dokumente". |
| shots-1280-light__partner-abrechnung-fehler.png | Meldung in dunklem Rot auf Weiß, deutlich abgesetzt. Knopf hellgrau-blauer Tint mit dunkeltürkisem Text, wie "Nachtrag vorschlagen" darüber. Seitenhintergrund hellgrau, Karte weiß mit großem Radius. |
| shots-1280-light__partner-abrechnung.png | Zeile "Monat  November 2026" mit schwarzem Kalender-Symbol am rechten Kartenrand. Der Wert steht direkt hinter dem Label, nicht rechts bündig wie "Gewerbeberechtigung" und "Auswählen" in der Karte "Dokumente". |
| shots-390-dark__partner-320-abrechnung-fehler.png | Bei 320 px bricht die Meldung in zwei Zeilen ("Deine Anmeldung ist / abgelaufen. Melde dich neu an."), nichts ist abgeschnitten. Der Erklärtext läuft über vier Zeilen. Knopf bleibt volle Breite. |
| shots-390-dark__partner-320-abrechnung.png | Erklärtext umbricht sauber in vier Zeilen, Monatsfeld "November 2026" in Weiß mit weißem Kalender-Symbol, kein Rand rechts abgeschnitten. Unterhalb folgt die Karte "Dokumente" mit sichtbarem Abstand. Format-Hinweis passt in eine Zeile. |
| shots-390-dark__partner-abrechnung-fehler.png | Meldung in Lachsrot, zwei Zeilen ("... Melde / dich neu an."), steht zwischen Hinweis und Knopf mit etwa einer Zeilenhöhe Luft. Knopf "Journal herunterladen" mittig, Tint heller als der Kartengrund. |
| shots-390-dark__partner-abrechnung.png | Karte hat dunkelgrünen Grund mit feiner Kontur wie die Karte "Angenommen". "Abrechnung" steht als fette Überschrift außerhalb der Karte, linksbündig mit "Angenommen". Kalender-Symbol ist hell, Monatswert gut lesbar (Farbschema greift). |
| shots-390-light__partner-320-abrechnung-fehler.png | Rote Meldung in zwei Zeilen auf Weiß, Kontrast hoch. Der Knopf liegt danach auf eigener Zeile, Karte endet mit gleichmäßigem Innenabstand unter dem Knopf. |
| shots-390-light__partner-320-abrechnung.png | Monatszeile mit schwarzem Kalender-Symbol rechts, Wert in Schwarz. Erklärtext in Mittelgrau, vier Zeilen, bricht nach "Provision" bzw. "im". Knopf in hellem Blaugrau, Text dunkeltürkis. |
| shots-390-light__partner-abrechnung-fehler.png | Die Meldung ("Deine Anmeldung ist abgelaufen. Melde / dich neu an.") hat dieselbe Schriftgröße wie der Erklärtext und kein Symbol oder keine Fläche. Sie ist nur durch die Farbe abgesetzt. |
| shots-390-light__partner-abrechnung.png | Karte weiß auf hellgrauem Grund, Abstand zur Karte "Angenommen" darüber ca. 30 px (Überschrift dazwischen), zur Karte "Dokumente" darunter ca. 20 px. Seitenende zeigt unten den Knopf "Hochladen", keine Tab-Bar oder Leiste überdeckt etwas. |

## Findings

### hoch
- Keine.

### mittel
- shots-*__partner-abrechnung*.png (alle 8 Bilder der Karte): Der Hinweis "Format JJJJ-MM, zum Beispiel 2026-10." passt nicht zum sichtbaren Feld. Das native Monatsfeld zeigt "November 2026", der Nutzer tippt kein JJJJ-MM. Fix: Hinweis streichen oder durch einen passenden Satz ersetzen (zum Beispiel "Wähle den Monat, für den du das Journal brauchst.").

### niedrig
- Alle Bilder: Der Monatswert steht direkt hinter dem Label "Monat" (links), obwohl `text-right` gesetzt ist. Die Zeilen in "Dokumente" (Art, Datei) stehen rechtsbündig. Fix: Wert mit `ml-auto` oder `text-right` plus `[&::-webkit-datetime-edit]:...` rechtsbündig ausrichten, oder bewusst linksbündig lassen und in der Zeile konsistent halten.
- Fehlerbilder (1280 und 390, Light und Dark): Fehlermeldung ist nur über die Farbe abgesetzt (gleiche Größe wie Erklärtext, keine Fläche, kein Symbol). Fix: Schrift `text-subhead` mit `font-medium` oder eine dezente Fläche, damit sie nicht nur an der Farbe erkennbar ist (WCAG 1.4.1). Kontrast der Farbe selbst ist in Light und Dark ausreichend.
- Fehlerbilder: Zwischen Meldung und Knopf liegt nur der Standardabstand (`gap-3`), die Meldung hängt visuell am Format-Hinweis. Optional: Meldung direkt über dem Knopf mit etwas mehr Abstand zum Hinweis.
- 320 px (alle 4 Bilder): Kein Überlauf und nichts abgeschnitten. Der Erklärtext braucht vier Zeilen, das ist akzeptabel.

Maße (Touch-Ziele, Überlauf) wurden nicht aus dem Bild geschätzt. Dafür gilt `min-h-11` und `min-h-12` im Quelltext (`src/screens/partner/Abrechnung.tsx`) und der Nachweis per `boundingBox()` im Test.

Gesichtet: 12 von 12
