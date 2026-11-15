# MoveNow · Stand

Stand 2026-11-15, nach Schritt u3 (Testlücke Mocks ↔ Datenbank). Diese Datei schreibt jeder Schritt am Ende neu (höchstens 40 Zeilen).

## Wo wir stehen
- Phase 1 ist bis s9p-1 (Provisionsstaffel) gebaut und auf `main`: Kunde (Anfrage, Angebote, Nachtrag, Storno, Konto löschen) und Partner (Registrierung, MFA, Anfragen, Aufträge, Nachtrag, Absage, Abrechnung).
- Arbeitssystem: u1, u1b, u2, u2b und u3 sind erledigt. u3: Positivzeilen-Register `tests/support/positiv.ts` (Aufbau und Aufrufe in `tests/rls/positiv.test.ts`, Abgleich mit `database.types.ts` in `tests/unit/positiv-register.test.ts`): 77 öffentliche Funktionen haben eine Positivzeile mit erlaubtem Akteur, Spaltentypen und exakter EXECUTE-Menge, 2 stehen in der Ausnahmeliste (`quote_save_booking`: Miete; `outbox_dispatch`: toter Grant, OFFEN u3-1). Eine neue Funktion ohne Eintrag macht `check` rot. `mockRpc<'name'>` (`tests/e2e/backend.ts`) bindet e2e-Mocks an `Returns`. `plpgsql_check` ist auf Dev verfügbar (2.8), nicht eingeschaltet (OFFEN u3-2).
- Beks hat die 15 Fragen vom 2026-11-14 beantwortet (`docs/ENTSCHEIDUNGEN.md` Nr. 148 bis 162); Folgearbeiten stehen in `docs/OFFEN.md`, gebaut ist davon nichts.
- Datenbank Dev: 62 Migrationen, lokal = remote bis `20261114100000` (0062). Nächste Migration 0063.
- Buchungsschalter `booking_open`: in Produktion aus, bis Rechtsklärung und GOLIVE 34 erledigt sind.

## Nächster Schritt
**u3b** (R3 klein, Sonnet 5.5, Effort hoch; OFFEN „u3b“): u2b-3 (git-Block im Guard positionsunabhängig), `agents.jsonl` je Schritt zählen, Rot-Beweis für die `fertig`-Tests. Vor dem Entfall der `ask`-Regeln für `git push` und `git commit`, spätestens vor dem Probe-Schritt s9k-1.

Danach oder daneben, je ein eigener R3-Schritt:
- **u3-1 + u3-4** (Migration 0063 und Register-Nachzug): EXECUTE für `service_role` an `outbox_dispatch` (und die elf `'us'`-Funktionen, N15) entziehen, Ausnahme streichen, Funde N1, N3 bis N8, N11 bis N13 aus `docs/OFFEN.md` u3-4. Einzuplanen: **u1b-6/AM5** vor der ersten echten Migration; jede Änderung an `tests/support/positiv.ts` macht `check` rot, bis ihr Hash in `scripts/sys/loesch-register.json` nachgeführt ist (Gate-Datei, braucht Fable-Abnahme); N18: `payout_preview` und `my_cancel_info` zusätzlich in `NieAusnahme`/Pflichtliste des Unit-Tests; N19: ein roter Lauf für den Geldtest (`total_cents: 'numeric'` setzen).

## Danach
1. Probe: ein R3-Schritt mit dem neuen System (Vorschlag: **s9k-1**, Meldung „nicht stattgefunden“ als ein Zustandsablauf, GOLIVE 34). Zeit und Rückfragen notieren, mit s9i-7c2 vergleichen. Danach dürfen die `ask`-Regeln für commit, merge, push, rm, dotenv entfallen.
2. Beschlossene Folgearbeiten aus den Antworten von Beks: Pauschale erst ab `termin_at` und Kontaktsperre nach jedem Storno ohne Pauschale (Migrationen, R3); zwei Sätze in `geld.md`; Abrechnung für gesperrte Firmen, Miete ausblenden, „voraussichtlich“ streichen (R1/R2 klein, in s9i-7d bündeln); Konto löschen mit Mail-Code (mit dem Mailversand); Partnerbedingungen am Server prüfen (mit den echten Texten).
3. N-12 Doppelanfrage (GOLIVE 23, R2) · Belege-Migration S9i7-12 (R3) · Mailversand (GOLIVE 35, 36) · Härtung mit Turnstile (GOLIVE 13, 18, 26) · Produktivprojekt · Hosting · Rechtstexte · Abnahme. Reihenfolge: `docs/SYSTEM_VORSCHLAG.md` Abschnitt 3 i.

## Wartet auf Beks
- `docs/BEKS.md`: 1 Frage (7-Tage-Grenze auch für `check` und `e2e`?).
- Einmal `/advisor off` eingeben und in einer neuen Session prüfen, dass kein Tool `advisor` mehr in der Liste steht (`docs/BEKS_EINRICHTUNG.md`, Schritt 2 und 5). In derselben Sitzung `tmp/proof/session.json` ansehen: `felder` zeigt, ob `model` und `transcript_path` ankommen.
- Rechtstexte, Mail-Anbieter, ORS-Vertrag, Hosting, Turnstile-Konto, Produktivprojekt (`docs/GOLIVE.md`).

## Hinweise, die jede Session braucht
- Verweise im Code und in alten Nachweisen auf `docs/OPEN_ISSUES.md`, `PROGRESS.md`, `AUTOPILOT.md` meinen `docs/archiv/`.
- Sperrreihenfolge überall: Auftrag, dann Firma. Wettlauftests lassen Testdaten auf Dev stehen (Angebote und Journal sind unlöschbar).
- Edge Functions deployen: noch ohne Gate, nur über die `ask`-Regel (OFFEN u1-2). Deno läuft über `npm run check:deno`.
- Vollauf `rls` 15 bis 30 Minuten (u3: 905 s und 1451 s, u2b: 1878 s): im Hintergrund starten, nie zusammen mit anderen Läufen; die Supabase-CLI stürzt gelegentlich ab (Bun-Crash in `ownerSql`), dann den Lauf unverändert wiederholen.
- Bekannter Flake: `tests/rls/offers.test.ts` „Snapshot ohne Gebühr“ sucht `fee` im Snapshot-Text und trifft mit etwa 1 % Wahrscheinlichkeit die Hexfolge in der zufälligen `offerId` (u3 Lauf 1 rot, unveränderte Wiederholung grün; gleiche Art wie OFFEN S9h4-8). Bei Rot dort: Lauf wiederholen, bei zweitem Rot untersuchen.
