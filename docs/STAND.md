# MoveNow · Stand

Stand 2026-11-15, nach Schritt u3-1 (outbox_dispatch, Register-Nachzug). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9p-1 (Provisionsstaffel) gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung).
- Arbeitssystem: u1, u1b, u2, u2b, u3, u3b und u3-1 sind erledigt. u3: Positivzeilen-Register `tests/support/positiv.ts` (78 Funktionen mit Positivzeile, 1 in der Ausnahmeliste; eine neue Funktion ohne Eintrag macht `check` rot), `mockRpc<'name'>` bindet e2e-Mocks an `Returns`.
- u3b: Guard-git-Block positionsunabhängig neu (M5, M6, M7, N11; Falschalarme `user.name edit`, `git grep core.hooksPath` bleiben, OFFEN u3b-1); der Bericht zählt Berater nur für den eigenen Schritt (der Hook stempelt `agents.jsonl` mit dem Branch); AM5: `db-push-start` vor dem CLI-Start, dreimal Neulesen, `npm run db:nachtrag`; `npm run bericht` legt die genannten Nachweise (auch Logs) selbst in den Index (`stageNachweise`); Rot-Beweis der `fertig`-Tests nachgeholt; `tests/rls/positiv.test.ts` mit SHA unter `ausgenommen` im Lösch-Register (positiv.ts bleibt dort, Urteil Fable); S9i3-7 geschlossen.
- Beks hat die 15 Fragen vom 2026-11-14 beantwortet (`docs/ENTSCHEIDUNGEN.md` Nr. 148 bis 162); Folgearbeiten stehen in `docs/OFFEN.md`, gebaut ist davon nichts.
- u3-1: Migration 0063 entzieht `service_role` EXECUTE an `outbox_dispatch` (nur der Cron als Eigentümer; Ursache des 42501: kein USAGE auf `private`, `vault`, `net`). Register: `outbox_dispatch` als Positivzeile (`als: 'owner'`), `Ausnahme` nur noch `keine_fixture` mit `ausfuehren`; Setup `betrieb` ohne ungefiltertes `update public.outbox`; Typregeln N4, N12, M1; Cron-Beleg in `outbox.test.ts`. Neue Pins in `loesch-register.json`. Rest von u3-4 steht in OFFEN (N7, N13, N15, N18, N21).
- Datenbank Dev: 63 Migrationen, lokal = remote bis `20261115092753` (0063). Nächste Migration 0064.
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 erledigt sind.

## Nächster Schritt
**Probe s9k-1** (siehe „Danach“ 1) oder vorher ein kleiner R3-Schritt für N15 (elf `'us'`-Funktionen: EXECUTE für `service_role` entziehen, vorher die Aufrufer in den Edge Functions prüfen). Jede Änderung an `tests/support/positiv.ts` oder `tests/rls/positiv.test.ts` macht `check` rot, bis ihr Hash in `scripts/sys/loesch-register.json` nachgeführt ist (Gate-Datei, braucht Fable-Abnahme). Gelang ein Push ohne Marken: `npm run db:nachtrag`.

## Danach
1. Probe: ein R3-Schritt mit dem neuen System (Vorschlag: **s9k-1**, Meldung „nicht stattgefunden“ als ein Zustandsablauf, GOLIVE 34). Zeit und Rückfragen notieren, mit s9i-7c2 vergleichen. Danach dürfen die `ask`-Regeln für commit, merge, rm, dotenv entfallen; für `git push` fragt `docs/BEKS.md` Nr. 2.
2. Beschlossene Folgearbeiten aus den Antworten von Beks: Pauschale erst ab `termin_at` und Kontaktsperre nach jedem Storno ohne Pauschale (Migrationen, R3); zwei Sätze in `geld.md`; Abrechnung für gesperrte Firmen, Miete ausblenden, „voraussichtlich“ streichen (R1/R2 klein, in s9i-7d bündeln); Konto löschen mit Mail-Code (mit dem Mailversand); Partnerbedingungen am Server prüfen (mit den echten Texten).
3. N-12 Doppelanfrage (GOLIVE 23, R2) · Belege-Migration S9i7-12 (R3) · Mailversand (GOLIVE 35, 36) · Härtung mit Turnstile (GOLIVE 13, 18, 26) · Produktivprojekt · Hosting · Rechtstexte · Abnahme. Reihenfolge: `docs/SYSTEM_VORSCHLAG.md` Abschnitt 3 i.

## Wartet auf Beks
- `docs/BEKS.md`: 2 Fragen (7-Tage-Grenze auch für `check` und `e2e`? `ask`-Regel für `git push` behalten?).
- Einmal `/advisor off` eingeben und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`, Schritt 2 und 5). In derselben Sitzung `tmp/proof/session.json` ansehen: `felder` zeigt, ob `model` und `transcript_path` ankommen.
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Verweise im Code und in alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge überall: Auftrag, dann Firma. Wettlauftests lassen Testdaten auf Dev stehen (Angebote und Journal sind unlöschbar).
- Edge Functions deployen: noch ohne Gate, nur über die `ask`-Regel (OFFEN u1-2). Deno läuft über `npm run check:deno`.
- Vollauf `rls` 15 bis 30 Minuten (u3: 905 s und 1451 s, u2b: 1878 s): im Hintergrund starten, nie zusammen mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann den Lauf unverändert wiederholen.
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ sucht `fee` im Snapshot-Text und trifft mit etwa 1 % Wahrscheinlichkeit die Hexfolge in der zufälligen `offerId` (gleiche Art wie OFFEN S9h4-8). Bei Rot dort: Lauf wiederholen, bei zweitem Rot untersuchen.
- Commit-Texte nennen `GIT_CONFIG_COUNT=` und ähnliche Zuweisungen nicht: der Guard sperrt sie in jedem Befehl mit `git`.
