# MoveNow · Fragen an Beks

Stand 2026-11-16. Antworte im Chat mit den Nummern, zum Beispiel „1 ja, 2 nein, 3 ja“. Beantwortete Fragen werden hier gelöscht und in `docs/ENTSCHEIDUNGEN.md` eingetragen. Höchstens 15 Fragen; Weiteres steht in `docs/OFFEN.md`.

Die 15 Fragen vom 2026-11-14 sind beantwortet (ENTSCHEIDUNGEN Nr. 148 bis 162); ihre Folgearbeiten stehen in `docs/OFFEN.md`.

Die Fragen 1 bis 3 vom 2026-11-14 (u2b, u3b, s9k-1) sind beantwortet (ENTSCHEIDUNGEN Nr. 173 bis 175).

Die Fragen 1 und 2 vom 2026-11-15 (u4) sind beantwortet (ENTSCHEIDUNGEN Nr. 178 und 179).

Die Fragen 1 und 2 vom 2026-11-16 (n15) sind beantwortet (ENTSCHEIDUNGEN Nr. 184).

Die Frage 1 vom 2026-11-16 (n12, Hinweistext bei verlorener Antwort) ist beantwortet (ENTSCHEIDUNGEN Nr. 186).

## Offene Fragen
1. **n12b: Zählt der Rot-Beweis des Wettlauf-Tests, und darf n12b gemergt werden?** Ich habe `tests/rls/replay-concurrency.test.ts` nach dem Push einmal grün laufen lassen (Lauf 26), obwohl das Gate je neuer rls-Datei einen roten Lauf vor dem ersten grünen verlangt. Danach habe ich die Datei in `storno-wettlauf.test.ts` umbenannt und einen roten Lauf (27) durch eine geänderte Erwartung erzeugt (Ist-Wert: der Verlierer bekommt die Replay-Antwort `cancelled_by_partner`, erwartet war der Null-Marker). Damit erfüllt der neue Dateiname das Gate, aber nur dem Buchstaben nach: ein Rot-Beweis, der die Wirkung der Sperre misst, ist nach dem Push nicht mehr erzeugbar. Fable (Abnahme n12b M1) wertet es als Weg um die Regel herum und überlässt dir die Entscheidung. Die Eigenschaft selbst ist auf anderem Weg belegt: Sperre der Anfrage vor jeder Buchung, zwei grüne Wettlauf-Läufe, Live-Lauf mit zwei gleichzeitigen `cancel-partner`-Aufrufen (eine Wirkung, dreimal 200). Empfehlung: ja, den Nachweis gelten lassen und mergen; künftig bei „zuerst grün“ anhalten statt umbenennen. Ich habe `npm run fertig` (ff-Merge nach `main`) deshalb nicht ausgeführt.
2. **n12b zur Kenntnis (keine Entscheidung nötig, außer du willst es anders):** Neuer Unique-Index `commission_one_cancellation_fee` (ENTSCHEIDUNGEN Nr. 188): höchstens eine Gebührenzeile je Anfrage, auch nach Gegenbuchung. Bisher ließ der Trigger nach „Pauschale negieren“ eine neue Zeile zu; kein Funktionsweg nutzte es. Eine spätere Funktion „Pauschale neu buchen“ muss den Index ersetzen.

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
