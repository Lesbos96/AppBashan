# Review Runde 2, Karte Abrechnung (Partner-Portal)

| Bild | Beobachtung (nur per Bildsicht) |
|---|---|
| shots-1280-dark__partner-abrechnung-fehler | Spalte mittig (ca. 615 px breit im 1643-px-Anzeigebild) auf dunklem Petrol-Grund. Unter dem Feld "Monat  November 2026" steht der graue Hinweis "Zeigt dein Browser ein Textfeld, schreibe JJJJ-MM, zum Beispiel 2026-10." in einer Zeile. Darunter die Meldung "Deine Anmeldung ist abgelaufen. Melde dich neu an." in hellem Rot/Lachs, danach der Knopf "Journal herunterladen" (Mint-Text auf dunklem Teal). Nichts abgeschnitten. |
| shots-1280-dark__partner-abrechnung | Gleiche Karte ohne Fehler: Hinweis direkt über dem Knopf, kein roter Text. Der Kalender-Icon rechts im Monatsfeld ist hell, der Wert "November 2026" steht direkt neben dem Label "Monat", nicht rechts. |
| shots-1280-light__partner-abrechnung-fehler | Heller grauer Grund, weiße Karte. Fehlermeldung in dunklem Rot (kräftiger als im Dark-Bild), Hinweis grau, Knopf hellgrau-blau mit dunkelteal Schrift "Journal herunterladen". |
| shots-1280-light__partner-abrechnung | Weiße Karte, Hinweis "Zeigt dein Browser ein Textfeld, schreibe JJJJ-MM, zum Beispiel 2026-10." in einer Zeile, Kalender-Icon schwarz. Kein roter Text. Knopf und Hinweis haben kleinen Abstand (Hinweis liegt knapp über dem Knopf). |
| shots-390-dark__partner-320-abrechnung-fehler | 320 px: Erklärtext vierzeilig, Hinweis in zwei Zeilen ("... schreibe / JJJJ-MM, zum Beispiel 2026-10."), Fehlermeldung zweizeilig in Lachsrot ("Deine Anmeldung ist / abgelaufen. Melde dich neu an."), Knopf volle Breite, Text nicht abgeschnitten. Kein seitlicher Überlauf sichtbar. |
| shots-390-dark__partner-320-abrechnung | 320 px ohne Fehler: Hinweis zweizeilig, Knopf "Journal herunterladen" direkt darunter in einer Zeile. Das Kalender-Icon sitzt am rechten Kartenrand, innerhalb der Karte. |
| shots-390-dark__partner-abrechnung-fehler | 390 px dunkel: Erklärtext dreizeilig, Hinweis zweizeilig ("... JJJJ-MM, / zum Beispiel 2026-10."), rote Meldung ("Deine Anmeldung ist abgelaufen. Melde / dich neu an.") in Lachsrot, bricht umgebrochen, nichts abgeschnitten. |
| shots-390-dark__partner-abrechnung | 390 px dunkel: Hinweis zweizeilig in dezentem Grau, kleiner als der Erklärtext; Knopf mit Mint-Schrift auf dunklem Teal-Grau, Karte endet mit gleichmäßigem Innenabstand unter dem Knopf. |
| shots-390-light__partner-320-abrechnung-fehler | 320 px hell: Fehlermeldung zweizeilig in dunklem Rot auf Weiß, Hinweis darüber grau; der Knopf darunter hellgrau-blau. Der Knopf "Kontakt und Adresse anzeigen" weiter oben bricht in zwei Zeilen (andere Karte, nicht Gegenstand). |
| shots-390-light__partner-320-abrechnung | 320 px hell: Monatsfeld "Monat  November 2026" mit schwarzem Kalender-Icon rechts, Hinweis zweizeilig, keine Meldung. Alles innerhalb der weißen Karte. |
| shots-390-light__partner-abrechnung-fehler | 390 px hell: Meldung in kräftigem Rot, zweizeilig, deutlich vom grauen Hinweis darüber abgesetzt; kein Symbol vor der Meldung, nur Farbe. |
| shots-390-light__partner-abrechnung | 390 px hell: Hinweis "Zeigt dein Browser ein Textfeld, schreibe JJJJ-MM, zum Beispiel 2026-10." zweizeilig, Knopf "Journal herunterladen" hellgrau-blau mit dunkelteal Schrift, ausreichend hoch (optisch ca. so hoch wie die anderen Knöpfe). |

## Findings

- [niedrig] `src/screens/partner/Abrechnung.tsx`, Monatsfeld – der Wert "November 2026" steht links direkt neben dem Label "Monat" statt rechtsbündig wie "Gewerbeberechtigung" und "Auswählen" in der Liste darunter (alle 12 Bilder). Fix: Wert rechtsbündig ausrichten (`text-right`/`justify-end`), falls der Stil der Zeilenfelder gewollt ist; sonst als bewusste Abweichung stehen lassen. Unverändert gegenüber Runde 1.
- [niedrig] Fehlermeldung (Bilder *-fehler) – nur durch Farbe abgesetzt, kein Symbol und kein Präfix. Fix: `role="alert"` ist für Screenreader ausreichend; für Farbfehlsichtige optional ein kleines Symbol aus der Icon-Sammlung. Unverändert gegenüber Runde 1; Text selbst ("Deine Anmeldung ist abgelaufen...") macht den Fehler eindeutig.
- Behoben: Hinweistext passt jetzt zum nativen Feld, er nennt das Textfeld nur für Browser ohne Monatsauswahl (alle Bilder zeigen den neuen Wortlaut "Zeigt dein Browser ein Textfeld, schreibe JJJJ-MM, zum Beispiel 2026-10.").
- Keine Findings zu Abschneiden, Überlauf, Dark Mode oder Gebühr in der Karte. Das Wort "Provision" im Erklärtext steht in der Partner-Ansicht (erlaubt, nicht Kunden-Screen). Touch-Ziel-Höhe und Kontrast (AA) nicht aus dem Bild geschätzt; dafür boundingBox/getComputedStyle nötig.

Gesichtet: 12 von 12
