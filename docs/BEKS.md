# MoveNow · Fragen an Beks

Stand 2026-11-14. Antworte im Chat mit den Nummern, zum Beispiel „1 ja, 2 nein, 3 ja“. Beantwortete Fragen werden hier gelöscht und in `docs/ENTSCHEIDUNGEN.md` eingetragen. Höchstens 15 Fragen; Weiteres steht in `docs/OFFEN.md`.

Die 15 Fragen vom 2026-11-14 sind beantwortet (ENTSCHEIDUNGEN Nr. 148 bis 162); ihre Folgearbeiten stehen in `docs/OFFEN.md`.

### 1. Soll die Sieben-Tage-Grenze für übernommene Läufe auch für `check` und `e2e` gelten?
- Worum es geht: Seit u2b übernimmt das Gate bei R3 einen grünen `rls`-Lauf aus einem früheren Schritt nur, wenn er höchstens 7 Tage alt ist, weil `rls` gegen die lebende Dev-Datenbank läuft. `check` und `e2e` laufen ohne Datenbank und hängen nur an den Dateien; für sie gilt keine Altersgrenze.
- Empfehlung: Nein, weil ein unveränderter Stand bei `check` und `e2e` dasselbe Ergebnis liefert und ein Volllauf von `e2e` rund 18 Minuten kostet.
- Bei „Ja“: Das Gate bekommt dieselbe Grenze für beide Suiten; jeder Schritt nach einer Woche Pause fährt dann alle drei Suiten voll.
- Aufwand: bei Nein keiner, bei Ja klein (R3)
- Quelle: Planprüfung u2b; OFFEN u2b-2

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
