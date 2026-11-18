# ui2 Abnahme (R2)

Keine hohen Findings. Sicherheit/Geld: Diff berührt keine DB, keine Beträge, keine Gebühr in Kunden-Screens.

## mittel
- tests/e2e/partner-auftraege.spec.ts, tests/e2e/partner-absage.spec.ts – Die neue Hinweis-Position (am Auftrag statt oben, src/screens/partner/Auftraege.tsx:134-141, 236-240) hat keinen Test; die neuen Fälle prüfen nur die Ankunftszeile. Die ergänzte Absage-Zeile "Weitervermittlung…" testet unveränderten Code (Absage.tsx:197), nicht ui2. Fix: ein e2e-Fall, der nach einer Aktion den Hinweis (role status/alert) innerhalb der richtigen Karte erwartet, nicht in der anderen.
- src/screens/partner/Auftraege.tsx:134-141 – Der Hinweis hängt an `notice.id === j.id`. Verschwindet der Auftrag nach der Aktion aus beiden Listen (live/over), entfällt auch der Hinweis, vorher stand er oben immer. Das gilt besonders für Warn-Hinweise ("Ergebnis unbekannt, neu laden"). Nicht im Lauf beobachtet. Fix: prüfen, ob jeder Aktionsweg den Auftrag in "Beendet" behält. Sonst Fallback-Hinweis oben, wenn die id in keiner Liste vorkommt.

## niedrig
- src/lib/arrival.ts:3 – Fensterzeiten 8/11/14/18 stehen hier zusätzlich zu den Labels in `windows` (Auftrag.tsx, "8 bis 11 Uhr"). Doppelte Quelle. Fix: eine Tabelle, Label und Ankunftstext daraus ableiten.
- src/screens/Auftrag.tsx:86 / kunde-ankunft-detail.png – Die Karte zeigt "… · 8 bis 11 Uhr" und direkt darunter "Ankunft zwischen 8 und 11 Uhr". Das ist dieselbe Angabe zweimal (Firmenkarte genauso). Beim Zielverhalten (Fenster = Kundenwahl) inhaltlich gewollt, wirkt aber redundant. Fix: Entscheidung bei Beks, oder die Zeile nur zeigen, wenn sie etwas Neues sagt.
- src/lib/arrival.ts:7 – Template-String ohne Platzhalter (Backticks), Stil.
- tests/shots/ankunft.spec.ts – Einrückung der for-Schleife fehlt (Test-Block nicht eingerückt). Prüfen, ob die Konstante `TERMIN` noch genutzt wird (Bestätigung nutzt sie nicht mehr), sonst Lint-Warnung.
- Button.tsx: `disabled:opacity-60` – im Bild sichtbar heller als vorher geplant ("Auftrag starten" gedämpftes Teal), ok; deaktivierte Elemente sind vom Kontrast ausgenommen.

## Screens (Bildsicht, Beobachtung je Bild)
- kunde-ankunft-detail (390 light): Zeile "Ankunft zwischen 8 und 11 Uhr" in grauem Secondary-Text unter dem zweizeiligen Datum "…2099 · 8 bis / 11 Uhr", über den Adressen; "11 Uhr" ist durch NBSP zusammengehalten; "689,61 €" rechts in einer Zeile.
- kunde-ankunft-flexibel: statt Fenster grauer Satz "Die Firma nennt dir die genaue Uhrzeit." an derselben Stelle; Kopf "ganzer Tag ab 8 Uhr"; kein "Ankunft zwischen".
- kunde-ankunft-bestaetigung: Titel "Anfrage gesendet." dunkelteal, Karte Umzug mit "Di., 15. Dez. · Neubaugasse 12 → Praterstraße 30", beige Chip "Angefragt", "Richtpreis 689,61 €" in Teal; keine Ankunftszeile mehr; keine Gebühr.
- partner-auftraege-liste (390 light): in jeder der drei Karten graue Zeile "Ankunft zwischen 8 und 11 / 14 und 18 Uhr" zwischen Datum und "Preis für den Kunden"; "Du erhältst 610,65 €" rechtsbündig in einer Zeile; "Auftrag starten" (Karte 1) hell/gedämpft, in Karte 2 und 3 kräftiges Teal; kein Hinweis-Kasten oben mehr.
- partner-320-auftraege-liste: Zeile "Ankunft zwischen 8 und 11 Uhr" bleibt in einer Zeile; "689,61 €" und "610,65 €" umbrechen nicht; Titel "Transporte Huber GmbH" und "Kontakt und Adresse anzeigen" umbrechen auf zwei Zeilen, nichts abgeschnitten, kein horizontales Scrollen sichtbar.
- partner-absage-pauschale (390 dark): Sheet mit hellerem Rand (border-text/30), Gebührenzeile "Gebühr 8,28 €" (nur Firma, erlaubt), Radio "Mit Pauschale" in hellem Mint gewählt, Fußleiste "Für 69,00 € absagen" in Teal. Die Fußleiste überdeckt in der Vollseitenaufnahme den Text darunter ("belec.png / Entfernen" angeschnitten) – Aufnahmeartefakt der fixierten Leiste bei fullPage, kein Layoutfehler.
- partner-320-absage-pauschale: dasselbe, Textzeile "Ohne Pauschale: Weitervermittlung…" wird von der Fußleiste verdeckt (Artefakt); Beträge in einer Zeile.
- Nicht einzeln geöffnet: 430/768/1280, Light-Pendants der Dark-Bilder; nur 390 light, 390 dark (Absage), 320 gelesen. Vergleich mit Referenz-Screens ist nur sinngemäß möglich, da für Ankunft/Absage keine Referenz existiert.
