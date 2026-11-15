# MoveNow · Stand

Stand 2026-11-15, nach Schritt s9k-1 (Meldung „nicht stattgefunden“ als Zustandsablauf, Probe im neuen System). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9k-1 gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Zurückziehen, Meldung „nicht stattgefunden“, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung).
- s9k-1 (Migration 0064): Z2 (Kundenmeldung offen, Status accepted/in_progress) sperrt am Server Start, Abschluss, Absage und Nachtrag der Firma sowie die Nachtrag-Annahme des Kunden; die Firma sieht nur `under_review` in `my_jobs()`. `my_report_info(p_request)` (Meldung möglich, Frist) trägt die Frage nach dem Termin in allen drei Status (auch nach dem Abschluss der Firma). `delete_account` hält bei offener Meldung an (`under_review`). `report_not_done` unverändert (Sperrgrund in `private.report_gate`). App: „Anfrage zurückziehen“ über `withdraw`.
- `getUser` und `quote` `getUserId`: `null` (401) nur bei 400/401/403, sonst werfen (500), `supabase/functions/_shared/auth.ts`. 13 Functions deployt (Log `docs/proof/s9k-1/deploy-1.log`), Smoke 401, `flow-live` mit W6 und W7 grün.
- GOLIVE 34 ist gebaut; offen nur der Betrieb der Meldungen: Z2 und Z4 enden nur durch admin (`reported_jobs`, kein Bildschirm, keine Mail): `docs/BEKS.md` Nr. 3.
- Arbeitssystem: u1 bis u3-1 und s9k-1 erledigt. Positivzeilen-Register `tests/support/positiv.ts` (79 Funktionen mit Positivzeile): eine neue Funktion ohne Eintrag macht `check` rot; jede Änderung an dieser Datei oder an `tests/rls/positiv.test.ts` verlangt den neuen Hash in `scripts/sys/loesch-register.json` (Gate-Datei, Fable-Abnahme).
- Beks hat die 15 Fragen vom 2026-11-14 beantwortet (ENTSCHEIDUNGEN Nr. 148 bis 162); gebaut ist davon noch nichts (Folgearbeiten in `docs/OFFEN.md`).
- Datenbank Dev: 64 Migrationen, lokal = remote bis `20261115104122` (0064). Nächste Migration 0065.
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 (Betrieb) erledigt sind.

## Nächster Schritt
Kein Selbstläufer: Beks entscheidet zuerst über `docs/BEKS.md` (Nr. 1 und 2 aus u2b/u3b, neu Nr. 3: wer prüft Kundenmeldungen). Danach, in dieser Reihenfolge nach Wert:
1. Kleiner R3-Schritt N15 (zwölf `'us'`-Funktionen inkl. `my_report_info`: EXECUTE für `service_role` entziehen, vorher Aufrufer in den Edge Functions prüfen) zusammen mit s9k1-1 (Löschen gegen Meldung sperren).
2. Beschlossene Folgearbeiten aus den Antworten (Pauschale erst ab `termin_at`, Kontaktsperre nach jedem Storno ohne Pauschale: Migrationen, R3; zwei Sätze in `geld.md`).
3. N-12 Doppelanfrage (GOLIVE 23, R2) · Belege-Migration S9i7-12 (R3) · Mailversand (GOLIVE 35, 36) · Härtung mit Turnstile · Produktivprojekt · Hosting · Rechtstexte · Abnahme. Reihenfolge: `docs/SYSTEM_VORSCHLAG.md` Abschnitt 3 i.
Nach der Probe dürfen die `ask`-Regeln für commit, merge, rm, dotenv entfallen (Beks bestätigt); für `git push` fragt `docs/BEKS.md` Nr. 2.

## Wartet auf Beks
- `docs/BEKS.md`: 3 Fragen (7-Tage-Grenze auch für `check` und `e2e`? `ask`-Regel für `git push` behalten? Wer prüft `reported_jobs`, bis wann?).
- Einmal `/advisor off` und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`); `tmp/proof/session.json` `felder` ansehen.
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Verweise im Code und in alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge überall: Auftrag, dann Firma. Wettlauftests lassen Testdaten auf Dev stehen (Angebote und Journal sind unlöschbar; `flow-live` W6/W7 legen je einen Auftrag mit Journal an).
- Edge Functions deployen: noch ohne Gate, nur über die `ask`-Regel (OFFEN u1-2); Deploy-Log schreibt die Hauptsession mit Write (Heredoc nach `tmp/proof` sperrt der Guard). Deno: `npm run check:deno`.
- Vollauf `rls` 15 bis 30 Minuten: im Hintergrund, nie zusammen mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann unverändert wiederholen.
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ trifft mit etwa 1 % die Hexfolge `fee` in der `offerId` (OFFEN S9h4-8). Bei Rot dort: Lauf wiederholen.
- E2E-Mocks im Dev-Modus: React ruft Effekte doppelt auf; ein einmaliger Fehlerzustand braucht zwei Mock-Antworten (siehe `tests/e2e/auftrag-aktionen.spec.ts`, „Signal nicht ladbar“).
- Commit-Texte nennen `GIT_CONFIG_COUNT=` und ähnliche Zuweisungen nicht: der Guard sperrt sie in jedem Befehl mit `git`.
