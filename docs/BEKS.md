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

Die Fragen 1 und 2 vom 2026-11-17 (rs1, Montage in Transport und Umzug; rls-Laufzeit) sind beantwortet (ENTSCHEIDUNGEN Nr. 197 und 198).

Die Frage 1 vom 2026-11-17 (bl1, Belegplätze) ist beantwortet (ENTSCHEIDUNGEN Nr. 204).

Die Frage 1 vom 2026-11-17 (web1, Ankunftsfenster in der Bestätigung) ist beantwortet (ENTSCHEIDUNGEN Nr. 206).

## Offene Fragen
1. **Brevo lehnt den API-Schlüssel ab (mail1, Stand 2026-11-18):** Die Probe-Mail an `MAIL_BETREIBER` scheitert mit HTTP 401 `unauthorized`. Bitte in Brevo prüfen: (a) `BREVO_API_KEY` ist ein API-Schlüssel (Schlüssel für die API v3, beginnt mit `xkeysib-`), kein SMTP-Schlüssel (`xsmtpsib-`); (b) unter Sicherheit → „Autorisierte IP-Adressen“ ist die Einschränkung aus oder die Adresse der Edge Functions freigegeben (die Adressen wechseln, GOLIVE 42); (c) das Konto ist aktiviert und `MAIL_FROM` ein bestätigter Absender (GOLIVE 43). Dann den Schlüssel neu setzen (`BREVO_API_KEY`, nur du) und `/schritt mail1 Fortsetzung` starten. Der Schlüssel wurde am 2026-11-18 neu gesetzt, der Lauf um 22:52 UTC scheiterte wieder mit 401 `unauthorized`: Bitte nicht nur den Schlüssel tauschen, sondern in Brevo (SMTP & API → API-Schlüssel) prüfen, dass der Schlüssel dort „aktiv“ steht und beim Einfügen kein Leerzeichen oder Zeilenumbruch mitkam. Ob der Schlüssel zu `MAIL_FROM` passt, kann nur Brevo sagen. Antwort im Chat: „erledigt“.

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
