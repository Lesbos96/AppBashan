# MoveNow · Fragen an Beks

Stand 2026-11-20 (nach legal1). Antworte im Chat mit den Nummern, zum Beispiel „1 ja, 2 nein, 3 ja“. Beantwortete Fragen werden hier gelöscht und in `docs/ENTSCHEIDUNGEN.md` eingetragen. Höchstens 15 Fragen; Weiteres steht in `docs/OFFEN.md`.

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

Die Frage 1 vom 2026-11-18 (mail1, Brevo-Schlüssel) ist erledigt: Beks hat Schlüssel und IP-Sperre in Brevo gerichtet, die Probe-Mail wurde am 2026-11-19 angenommen (Ablauf in `docs/STAND.md`).

Die Frage 1 vom 2026-11-19 (mail1, Empfängeradresse der Firma) ist beantwortet (ENTSCHEIDUNGEN Nr. 214).

Die Frage 1 vom 2026-11-19 (mail2, Altersgrenze für Mails nach langem Brevo-Ausfall) ist beantwortet (ENTSCHEIDUNGEN Nr. 215).

Die Frage 1 vom 2026-11-19 (ts1, Turnstile Site Key in `daten.md`) ist beantwortet (ENTSCHEIDUNGEN Nr. 216).

Die Einrichtung von Turnstile auf Dev (ts1: `.env.local`, Function-Secret, Auth-Captcha) ist erledigt und gemessen (Passwort-Anmeldung und Mail-Anforderung ohne Token: 400 `captcha_failed`).

Die Frage 1 vom 2026-11-19 (ts1, genügt GOLIVE 18 für die Partner-Registrierung) ist beantwortet (ENTSCHEIDUNGEN Nr. 217).

Die Frage 1 vom 2026-11-20 (rl3, GOLIVE 26 ohne Zählergrenze) ist beantwortet (ENTSCHEIDUNGEN Nr. 220).

## Offene Fragen
1. **legal1, Partnerbedingungen: wer darf sie lesen?** Die Partnerbedingungen nennen die Provision, Kunden sehen sie nirgends (`geld.md`). Gebaut ist: Seite nur mit Anmeldung (`/recht/partnerbedingungen`, eigener Chunk), Link nur in der Partner-Registrierung, nicht in der Fußzeile und nicht im Profil. Restrisiko: Jede angemeldete Person, auch eine Kundin, kann die Adresse aufrufen; der Text nennt keine Prozentsätze, nur dass es eine Provision gibt. Die P2B-Verordnung verlangt, dass Geschäftskunden ihre Bedingungen auch vor Vertragsschluss leicht finden; ob eine Anmeldung dafür genügt, klärt der Anwalt. Empfehlung: **so lassen, bis der Anwalt antwortet;** danach entweder öffentlich ohne Prozentsätze (die Staffel zeigt nur die App den Partnern) oder die Sperre bleibt.
2. **legal1, Datenschutz für Partnerbetriebe: eigene Seite?** Die App zeigt eine Datenschutzerklärung (Kundentext). Der Entwurf für Partnerbetriebe (`docs/legal/entwurf/datenschutz-partner.md`, Stand vor dem Partnerteil, veraltet) und der Partnervertrag (`partnervertrag.md`) sind keine Seiten. Empfehlung: **ja, eigene Seite `/recht/datenschutz-partner`, verlinkt in der Registrierung, sobald der Anwalt den Text hat;** bis dahin steht in der Kunden-Erklärung ein `[ANWALT]`-Hinweis. Ohne deine Antwort bleibt es dabei.

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
