# rj1 Kontrollreview Runde 2 (nur Bildsicht)

## Findings

- [niedrig] partner-ablehnen-angebot-offen, 1280 Light und Dark: Der Satz "Angebot gesendet: 700,50 €, gültig bis 3. Dezember um 11:00" bricht so um, dass "11:00" allein in der zweiten Zeile steht. Der Betrag bleibt in einer Zeile, nichts ist abgeschnitten. Fix: freiwillig, "um 11:00" mit geschütztem Leerzeichen koppeln.

Der Fund aus Runde 1 ist behoben. Nach dem Hinweis fehlen "Angebot abgeben" und "Ablehnen" in der Karte der Anfrage, und "Meine Angebote" zeigt "Zurückziehen". Keine Findings mit Schwere mittel oder hoch.

## Shot-Tabelle

| Shot | Größe / Modus | Beobachtung (nur mit Bildsicht) |
|---|---|---|
| ablehnen-angebot-offen | 390 Light | Direkt unter der Firmenkarte steht eine eigene weiße Hinweiskarte: "Du hast für diese Anfrage ein Angebot offen. Zieh es zuerst zurück." Der Text bricht nach "offen." um. Danach folgt die Überschrift "Offene Anfragen". |
| ablehnen-angebot-offen | 390 Light | Die Karte "Entrümpelung, Bezirk 3" enthält als einzigen Knopf "Fotos ansehen" (grau-teal). Darunter steht in Fließtext "Angebot gesendet: 700,50 €, gültig bis 3. Dezember um 11:00". "Angebot abgeben" und "Ablehnen" fehlen. |
| ablehnen-angebot-offen | 390 Light | Unter "Meine Angebote" steht die Karte mit fettem "700,50 €", "Offen bis 3. Dezember um 11:00" und dem Knopf "Zurückziehen". Der Betrag steht in einer Zeile. Die Preisspanne "500,00 € bis 900,00 €" steht rechts in einer Zeile. |
| ablehnen-angebot-offen | 390 Dark | Die Hinweiskarte hat einen dunklen Teal-Grund mit feiner Kontur und hellem Text. Sie unterscheidet sich im Stil nicht von den anderen Karten. "Fotos ansehen" und "Zurückziehen" sind in Dark mint auf dunklem Teal und gut lesbar. Die Karte der Anfrage hat keinen Primärknopf. |
| ablehnen-angebot-offen | 1280 Light | Die Inhaltsspalte ist mittig, etwa 575 px breit (Bildpixel 1533 px breit), mit leerem Rand links und rechts. Der Hinweis steht in zwei Zeilen ("... Zieh es / zuerst zurück."). In der Anfragekarte fehlen "Angebot abgeben" und "Ablehnen". Die Karte "Meine Angebote" mit "Zurückziehen" ist vorhanden. |
| ablehnen-angebot-offen | 1280 Dark | Wie Light in Dark-Farben. Hinweiskarte, "Angebot gesendet"-Zeile und "Zurückziehen" haben ausreichend Kontrast. Der dunkle Hintergrund läuft über die ganze Breite, die Spalte steht mittig. |
| ablehnen-hinweis | 390 Light | Die Hinweiskarte zeigt "Du hast die Anfrage abgelehnt." in einer Zeile. Sie hat denselben weißen Kartenstil wie die Firmenkarte. Es gibt keine Gebührenwörter. |
| ablehnen-hinweis | 390 Light | Unter "Offene Anfragen" steht nur noch eine Karte, "Entrümpelung, Bezirk 3". Sie zeigt drei Knöpfe untereinander: "Fotos ansehen" (grau), "Angebot abgeben" (dunkler Teal-Verlauf mit Schatten, primär) und "Ablehnen" (grau). Die abgelehnte Karte ist weg. "Meine Angebote" fehlt. |
| ablehnen-hinweis | 390 Dark | Die Hinweiskarte hat einen dunklen Grund mit Kontur und hellem Text. "Angebot abgeben" ist ein Teal-Verlauf mit weißer Schrift. "Fotos ansehen" und "Ablehnen" sind dunkelgrau-teal mit mintfarbener Schrift. Die Primär- und Sekundärknöpfe sind klar unterscheidbar. |
| ablehnen-hinweis | 1280 Light | Die Spalte ist mittig, etwa 625 px breit (Bildpixel 1673 px breit). Der Hinweis steht in einer Zeile. Die Karte hat die Knöpfe "Fotos ansehen", "Angebot abgeben" und "Ablehnen" über die volle Kartenbreite, ohne Abschneiden. Die Preisspanne steht rechts in einer Zeile. |
| ablehnen-hinweis | 1280 Dark | Wie Light in Dark-Farben. Der Primärknopf hat einen sichtbaren Teal-Verlauf. Die zweite Karte hat dieselben drei Knöpfe. Es gibt keine Gebührenwörter. |

## Texte

Alle sichtbaren Texte stehen in de-AT per Du ("Zieh es zuerst zurück.", "Du hast die Anfrage abgelehnt."). Es gibt keine Gebührenwörter, keine Emojis und keinen Platzhaltertext.
