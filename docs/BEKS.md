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

## Zuerst: Einrichtung für ts1 (Turnstile auf Dev), drei Mini-Schritte von Beks
ts1 steht, bis diese Schritte erledigt sind. Danach `/schritt ts1` mit dem Wort „Fortsetzung“ starten. Die Cloudflare-Testschlüssel („Always passes“) stehen auf der Seite https://developers.cloudflare.com/turnstile/troubleshooting/testing/ (Site Key und Secret Key; kein echtes Konto nötig). Das Secret steht nur in diesen drei Orten, nie im Chat oder in Dateien des Repos.
1. In `.env.local` zwei Zeilen ergänzen: `NEXT_PUBLIC_TURNSTILE_SITE_KEY=` mit dem Site Key „Always passes“ und `TURNSTILE_SECRET_KEY=` mit dem Secret Key „Always passes“ (die Namen stehen in `.env.example`). Prüfen mit `npm run env:check` (zeigt nur Namen).
2. Supabase-Dashboard, Dev-Projekt: Edge Functions → Secrets → neues Secret `TURNSTILE_SECRET_KEY` mit demselben Secret-Wert.
3. Supabase-Dashboard, Dev-Projekt: Authentication → Attack Protection (bzw. Sign In / Providers → Bot and Abuse Protection) → „Enable CAPTCHA protection“ einschalten, Anbieter „Cloudflare Turnstile“, Secret dasselbe wie in Schritt 1, speichern. Folge: Die lokale App meldet auf Dev erst mit dem neuen Stand von ts1 wieder an; die Test- und Live-Skripte senden schon das Dummy-Token.

## Offene Fragen
1. **Darf der Satz in `.claude/rules/daten.md` erweitert werden (ts1, Stand 2026-11-19)?** Dort steht heute: in der App nur Variablen mit `NEXT_PUBLIC_`-Präfix, „und davon nur URL und Publishable Key“. ts1 fügt `NEXT_PUBLIC_TURNSTILE_SITE_KEY` hinzu (der Site Key ist öffentlich wie der Publishable Key; Ihr Auftrag nannte die Variable ausdrücklich). Die Regel selbst ändert nur Beks. Empfehlung: den Satz so ändern: „… davon nur URL, Publishable Key und der Turnstile Site Key.“ Antwort im Chat: „1 ja“ (dann ändert Beks die Zeile) oder „1 nein“ (dann wird die Variable in ts1 wieder entfernt).

## Hinweise
- Der Satz „rls läuft gegen die lebende Dev-Datenbank“ gilt, weil Dev Testreste behält und sich ändert; `e2e` nutzt Mocks (OFFEN S9i7c2-4).
- Zwei Bestätigungen stehen nur in `docs/OFFEN.md`: Obergrenze für Nachträge je Auftrag und Stunde (S9i7-4) und eine einzige USt.-Regel für alle Firmen bis Phase 2 (S9b0-B).
