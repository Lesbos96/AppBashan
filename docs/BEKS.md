# MoveNow · Fragen an Beks

Stand 2026-11-19 (nach mail2). Antworte im Chat mit den Nummern, zum Beispiel „1 ja, 2 nein, 3 ja“. Beantwortete Fragen werden hier gelöscht und in `docs/ENTSCHEIDUNGEN.md` eingetragen. Höchstens 15 Fragen; Weiteres steht in `docs/OFFEN.md`.

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

## Zuerst: Auth-Captcha auf Dev wirkt noch nicht (ts1), ein Mini-Schritt von Beks
Stand 2026-11-19: Die Function `route` verlangt das Token und läuft (deployt, Secret steht). Die Anmeldung dagegen verlangt auf Dev noch keins: Eine Passwort-Anmeldung und `signInWithOtp` ohne Token kommen ohne `captcha_failed` durch (Messung: unbekannter Nutzer ergibt `invalid_credentials`, die Adresse wird geprüft statt das Token). Das Dashboard-Captcha ist also nicht scharf, oder es ist im falschen Projekt gesetzt. Bitte im **Dev-Projekt** (Ref `vcpbbzdyltvffvzjrzdi`) prüfen: Authentication → Attack Protection (bzw. Sign In / Providers → Bot and Abuse Protection) → „Enable CAPTCHA protection“ ist **an**, Anbieter **Cloudflare Turnstile**, Secret ist der „Always passes“-Wert, **Save** gedrückt (das Feld meldet sonst „unsaved changes“). Danach `/schritt ts1 Fortsetzung`; ts1 wiederholt dann `captcha-live` und läuft bis zum Bericht weiter.

## Offene Fragen
1. **Genügt GOLIVE 18 (Captcha am Anmeldeweg) für die offene Partner-Registrierung (GOLIVE 26, ts1, Stand 2026-11-19)?** `register_partner` und die Dokument-Uploads laufen nur mit Konto; ein Konto entsteht nur über die Anmeldung, die seit ts1 das Captcha trägt. Rate-Limit und Dokumentgrenzen fehlen weiter. Empfehlung: ja, Punkt 26 auf die Rate-Limit- und Upload-Grenzen verengen (kein eigenes Captcha am Formular). Antwort im Chat: „1 ja“ oder „1 nein“ (dann bekommt das Formular ein eigenes Token, eigener Schritt).

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
