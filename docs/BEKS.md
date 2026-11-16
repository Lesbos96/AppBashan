# MoveNow · Fragen an Beks

Stand 2026-11-16. Antworte im Chat mit den Nummern, zum Beispiel „1 ja, 2 nein, 3 ja“. Beantwortete Fragen werden hier gelöscht und in `docs/ENTSCHEIDUNGEN.md` eingetragen. Höchstens 15 Fragen; Weiteres steht in `docs/OFFEN.md`.

Die 15 Fragen vom 2026-11-14 sind beantwortet (ENTSCHEIDUNGEN Nr. 148 bis 162); ihre Folgearbeiten stehen in `docs/OFFEN.md`.

Die Fragen 1 bis 3 vom 2026-11-14 (u2b, u3b, s9k-1) sind beantwortet (ENTSCHEIDUNGEN Nr. 173 bis 175).

Die Fragen 1 und 2 vom 2026-11-15 (u4) sind beantwortet (ENTSCHEIDUNGEN Nr. 178 und 179).

## Offene Fragen (n15, 2026-11-16)
1. **Kontakt der Firma während einer offenen Kundenmeldung (OFFEN s9k1-2).** Meldet der Kunde „nicht stattgefunden“, ist der Auftrag in Prüfung (Start, Abschluss, Nachtrag, Absage der Firma sind gesperrt). „Kontakt und Adresse anzeigen“ bleibt für die Firma offen (der Aufruf wird protokolliert). Soll der Kontakt bis zur Entscheidung von admin gesperrt werden? **Empfehlung: nein, nicht sperren.** Die Firma kennt Name und Adresse seit der Annahme, der Zugriff steht im Protokoll, und sie braucht den Kontakt, um die Meldung mit dem Kunden zu klären; eine Sperre träfe auch den Fall, dass der Kunde sich irrt. Mit der Entscheidung „nicht stattgefunden“ (Storno ohne Pauschale) sperrt Migration 0065 Kontakt und Fotos ohnehin sofort. Eine Sperre nur während der Prüfung wäre eine kleine Migration (`private.partner_data_access`) mit Wirkung auf Nr. 148 und 154. Antwort „ja“ oder „nein“.
2. **n15 hält am Gate „roter Lauf vor dem ersten grünen“ an (`fertig.mjs:75-78`, Abnahme M1).** Die neue Datei `tests/rls/auth-token-codes.test.ts` misst gegen Dev, was `auth.getUser` bei gefälschtem Token, falschem Function-Schlüssel und gelöschtem Konto antwortet, und prüft den Live-Smoke (13 Functions, 26 Aufrufe, alle 401). Ihr erster Lauf war grün, weil ich `auth.ts` vor dem Test geändert hatte; das Zurücksetzen für einen Rot-Lauf hat das Werkzeug-Gate abgelehnt, ich habe es nicht umgangen. Den Rot-vor-Grün-Beweis für `auth.ts` selbst liefert `tests/unit/auth-token.test.ts` (Lauf 002 rot, 015 grün); die Abnahme (hoch 0) nennt die Lücke als mittleren Fund. Wie weiter? **Empfehlung: du gibst diese eine Messdatei im Gate frei** (eine Ausnahme in `scripts/sys`, das ich nie selbst lockere; `docs/BEKS_EINRICHTUNG.md` Abschnitt 6 kennt dafür keinen fertigen Weg), dann lasse ich `fertig` laufen. Alternative: du entscheidest, dass die Datei aus dem Schritt fällt (Beleg bliebe in den Läufen 009 und 017); dann entfällt die Live-Prüfung im Volllauf.

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
