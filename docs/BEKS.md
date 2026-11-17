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

## Offene Fragen
1. **Texte zum Festangebot ohne Pauschale (ui1, GOLIVE 32, ENTSCHEIDUNGEN Nr. 152).** Entrümpelung, verschachtelte Montage, Einpacken, Sonderware und Großer Lkw sind buchbar, ohne Nachtrag und ohne Pauschale beim Storno. Die Oberfläche sagt das nirgends: die Absage-Maske der Firma (`Absage.tsx`) zeigt bei Pauschale 0 nur „Der Kunde muss nichts zahlen“, die Firma erfährt vor der Annahme nicht, dass bei diesen Leistungen weder Nachtrag noch Pauschale möglich sind. Eine fachliche Vorgabe für Wortlaut und Ort fehlt, ui1 hat nichts eingebaut. **Empfehlung:** (a) in der Anfragekarte und im Annahme-Sheet bei diesen Leistungen ein Satz „Für diese Leistung gibt es keinen Nachtrag und keine Pauschale bei Absage. Prüfe den Umfang vor deiner Annahme.“; (b) die Absage-Maske bei Festangebot nennt dasselbe in einer Zeile; (c) die AGB nennen die Regel im selben Wortlaut (Rechtsprüfung, GOLIVE 33). Ja = ein R1-Schritt baut (a) und (b); anderer Wortlaut oder Ort bitte nennen.

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
