# Review 3, Karte "Abrechnung" (Partner-Portal), Modus Runde

Neuer Erklärtext "Dein Journal mit Buchungen, Nachträgen und Stornos als CSV. Aufträge erscheinen im Monat ihres Abschlusses." steht in allen 12 Bildern, ohne das Wort "Provision". Er ist nirgends abgeschnitten. Er bricht bei 1280 px in zwei Zeilen (Umbruch nach "CSV."), bei 390 px in drei Zeilen (nach "Nachträgen und" bzw. "Monat") und bei 320 px in drei Zeilen (nach "Buchungen," und "Stornos als CSV.").

| Bild | Beobachtung (nur per Bildsicht) |
|---|---|
| 1280-dark / abrechnung-fehler | Erklärtext grau auf dunkler Karte, zwei Zeilen. Zeile "Monat  November 2026" steht links, das Kalender-Icon sitzt rechts. Der Hinweis "Zeigt dein Browser ein Textfeld, schreibe JJJJ-MM, zum Beispiel 2026-10." steht in einer Zeile. Darunter die Fehlermeldung "Deine Anmeldung ist abgelaufen. Melde dich neu an." in Rosa/Rot, eine Zeile. Der Knopf "Journal herunterladen" ist türkis auf dunklem Grund. |
| 1280-dark / abrechnung | Gleiche Karte ohne Fehlerzeile. Der Hinweis liegt direkt über dem Knopf "Journal herunterladen" (Abstand kleiner als im Fehlerbild). Der Text ist nicht abgeschnitten. |
| 1280-light / abrechnung-fehler | Fehlermeldung in dunklem Rot (kräftiger als im Dark-Bild), weiße Karte, Knopf hellgraublau mit dunkelteal Schrift. Der Erklärtext ist grau und zweizeilig. |
| 1280-light / abrechnung | Ohne Fehler: Karte weiß, Erklärtext grau in zwei Zeilen, Hinweis und Knopf direkt untereinander. Die Spalte ist zentriert, links und rechts bleibt hellgrauer Rand frei. |
| 390-dark-320 / abrechnung-fehler | Bei 320 px bricht der Erklärtext in drei Zeilen. Der Hinweis bricht nach "schreibe" in zwei Zeilen. Die Fehlermeldung ist rosa, zweizeilig ("Deine Anmeldung ist / abgelaufen. Melde dich neu an."). "Monat  November 2026" und das Kalender-Icon passen in eine Zeile. Der Knopf ist vollständig sichtbar. Der Titel "Transporte Huber GmbH" bricht in zwei Zeilen, das Badge "Aktiv" bleibt rechts. |
| 390-dark-320 / abrechnung | Ohne Fehler: dreizeiliger Erklärtext, Hinweis zweizeilig, Knopf "Journal herunterladen" mit Teal-Schrift auf dunklem Grund. "Kontakt und Adresse anzeigen" bricht in zwei Zeilen im Knopf (anderes Element, nicht Gegenstand). Beträge "689,61 €" und "586,17 €" stehen in einer Zeile. |
| 390-dark / abrechnung-fehler | Erklärtext in drei Zeilen ("... Nachträgen und / Stornos als CSV. Aufträge erscheinen im / Monat ihres Abschlusses."). Die rosa Fehlermeldung ist zweizeilig, der Knopf bleibt ganz sichtbar. Der Monatswert "November 2026" steht links neben "Monat", das Kalender-Icon rechts. |
| 390-dark / abrechnung | Ohne Fehler: Hinweis zweizeilig ("... schreibe JJJJ-MM, / zum Beispiel 2026-10."). Der Knopf folgt mit gleichmäßigem Abstand. Kein horizontaler Überlauf sichtbar. |
| 390-light-320 / abrechnung-fehler | Fehlermeldung in dunklem Rot, zweizeilig, auf weißer Karte. Der Erklärtext ist dreizeilig grau. Der Knopf ist hellgrau mit dunkelteal Schrift. |
| 390-light-320 / abrechnung | Ohne Fehler: Erklärtext ("... Nachträgen und Stornos als CSV." in drei Zeilen) vollständig sichtbar. Hinweis zweizeilig, Knopf voll breit innerhalb der Karte. |
| 390-light / abrechnung-fehler | Fehlermeldung dunkelrot, zweizeilig, über dem Knopf. Der Erklärtext ist dreizeilig, und "Monat November 2026" steht mit dem Icon rechts auf einer Zeile. |
| 390-light / abrechnung | Ohne Fehler: dreizeiliger Erklärtext, zweizeiliger Hinweis, Knopf "Journal herunterladen" mit dunkelteal Schrift auf hellem Grund. Nichts abgeschnitten, kein Betrag in der Karte. |

## Findings

- [niedrig] Offen aus Runde 1/2, weiter sichtbar in allen 12 Bildern (Feld "Monat"): Der Monatswert "November 2026" steht links neben dem Label, das Kalender-Icon rechts. Die Referenz-Listenzeilen haben den Wert rechtsbündig. Fix: Wert rechtsbündig setzen, oder als bewusste Abweichung festhalten.
- [niedrig] Offen aus Runde 1/2, sichtbar in allen Fehlerbildern (1, 3, 5, 7, 9, 11): Die Fehlermeldung unterscheidet sich nur durch die Farbe (rosa im Dark, dunkelrot im Light). Kein Icon, kein Präfix. Fix: Icon oder Präfix ergänzen, falls die Regel "nicht nur Farbe" gilt. Die Meldung ist als Text vorhanden und lesbar.
- [niedrig] Bilder 1 und 3 (Fehlerbild, 1280 px): Hinweis und Fehlermeldung stehen eng untereinander, und der Abstand zum Knopf ist knapp. Kein Defekt.

Keine hohen oder mittleren Funde. Der neue Text kommt vor, nichts ist abgeschnitten, kein Betrag umbricht, kein horizontaler Überlauf ist sichtbar, und in der Karte steht keine Gebühr.

Gesichtet: 12 von 12
