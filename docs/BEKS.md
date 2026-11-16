# MoveNow · Fragen an Beks

Stand 2026-11-16. Antworte im Chat mit den Nummern, zum Beispiel „1 ja, 2 nein, 3 ja“. Beantwortete Fragen werden hier gelöscht und in `docs/ENTSCHEIDUNGEN.md` eingetragen. Höchstens 15 Fragen; Weiteres steht in `docs/OFFEN.md`.

Die 15 Fragen vom 2026-11-14 sind beantwortet (ENTSCHEIDUNGEN Nr. 148 bis 162); ihre Folgearbeiten stehen in `docs/OFFEN.md`.

Die Fragen 1 bis 3 vom 2026-11-14 (u2b, u3b, s9k-1) sind beantwortet (ENTSCHEIDUNGEN Nr. 173 bis 175).

Die Fragen 1 und 2 vom 2026-11-15 (u4) sind beantwortet (ENTSCHEIDUNGEN Nr. 178 und 179).

Die Fragen 1 und 2 vom 2026-11-16 (n15) sind beantwortet (ENTSCHEIDUNGEN Nr. 184).

## Offene Fragen
1. **Hinweistext bei verlorener Antwort (n12, nicht blockierend):** Ändert der Kunde nach einer verlorenen Antwort seine Anfrage, und die erste ist schon gespeichert, zeigt die Zusammenfassung statt zu senden: „Deine Anfrage ist schon angekommen, nur die Bestätigung ging verloren. Willst du etwas ändern, ziehe sie unter Aufträge zurück und sende dann neu.“ mit dem Link „Anfrage ansehen“ (`src/screens/anfrage/Zusammenfassung.tsx`, `existsText`). Passt der Text, oder soll er anders klingen? Empfehlung: so lassen, er sagt, was passiert ist und was der Kunde tun kann, und nennt weder Gebühr noch Technik.

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
