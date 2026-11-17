# MoveNow · Fragen an Beks

Stand 2026-11-17. Antworte im Chat mit den Nummern, zum Beispiel „1 ja, 2 nein, 3 ja“. Beantwortete Fragen werden hier gelöscht und in `docs/ENTSCHEIDUNGEN.md` eingetragen. Höchstens 15 Fragen; Weiteres steht in `docs/OFFEN.md`.

Die 15 Fragen vom 2026-11-14 sind beantwortet (ENTSCHEIDUNGEN Nr. 148 bis 162); ihre Folgearbeiten stehen in `docs/OFFEN.md`.

Die Fragen 1 bis 3 vom 2026-11-14 (u2b, u3b, s9k-1) sind beantwortet (ENTSCHEIDUNGEN Nr. 173 bis 175).

Die Fragen 1 und 2 vom 2026-11-15 (u4) sind beantwortet (ENTSCHEIDUNGEN Nr. 178 und 179).

Die Fragen 1 und 2 vom 2026-11-16 (n15) sind beantwortet (ENTSCHEIDUNGEN Nr. 184).

Die Frage 1 vom 2026-11-16 (n12, Hinweistext bei verlorener Antwort) ist beantwortet (ENTSCHEIDUNGEN Nr. 186).

Die Fragen 1 und 2 vom 2026-11-16 (n12b) sind beantwortet (ENTSCHEIDUNGEN Nr. 190).

Die Frage 1 vom 2026-11-16 (sys1, globaler PUBLIC-Default) ist beantwortet (ENTSCHEIDUNGEN Nr. 191).

Die Frage 2 vom 2026-11-17 (dev1, Nachwachsen der Dev-Testreste) ist beantwortet (ENTSCHEIDUNGEN Nr. 195).

Die Frage 1 vom 2026-11-17 (ui1, Texte zum Festangebot ohne Pauschale) ist beantwortet (ENTSCHEIDUNGEN Nr. 196).

## Offene Fragen
1. **Montage in Transport und Umzug (rs1, ENTSCHEIDUNGEN Nr. 152 und 196).** Nr. 152 nennt „verschachtelte Montage“ unter den Leistungen ohne Nachtrag und ohne Pauschale. Im Code ist eine Montage innerhalb von Transport oder Umzug ein normaler Festpreis: die Firma kann einen Nachtrag vorschlagen (nur nicht auf die Montagefelder, `partnerChange.ts:111`), und bei einer Absage nach Terminbeginn mit abgelehntem Nachtrag gibt es die Pauschale (`0065`). Nur in der Entrümpelung liegt die Montage im Festangebot. Der neue Satz erscheint deshalb nur bei Festangeboten (Anfrage ohne Gesamtpreis), nicht bei jeder Montage. **Empfehlung:** (a) so lassen; die Oberfläche sagt dann nie etwas Falsches. Alternative (b): Montage in Transport und Umzug soll wie Einpacken zum Festangebot werden (Preislogik, R3 mit Migration und Functions, eigener Schritt). Ja = (a).
2. **rls-Laufzeit über der Grenze (rs1, ENTSCHEIDUNGEN Nr. 195).** Der Volllauf `rls` brauchte in rj1 1922 s, in dev1 984 s (Grenze 1200 s). Die Reset-Probe vom 2026-11-17 zeigt nur 18 Testkonten, 22 Testfirmen und 64 Anfragen (Grenzen 300 und 500), und `runs.jsonl` zeigt keinen zeitgleichen Lauf. Alle Dateien liefen langsamer (kleine im Median 1,6-fach, Live-Tests bis 8-fach, zum Beispiel `partner-functions-live` 412 s gegen 88 s), die Daten erklären das nicht, ein Reset hilft nach Stand der Probe nicht. Die Ursache ist offen (Netz oder Supabase-Dienst, andere Last auf dem Rechner). Der Lauf am Ende von rs1 misst neu (Wert im Bericht). **Empfehlung:** kein Reset und kein Umbau; ein eigener kleiner Schritt (R0) vergleicht mehrere rls-Läufe zu verschiedenen Zeiten (Wanduhr je Datei) und trennt so Dienst-Latenz von Rechnerlast. Ja = Schritt einplanen; Nein = Grenze auf 2400 s anheben.

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
