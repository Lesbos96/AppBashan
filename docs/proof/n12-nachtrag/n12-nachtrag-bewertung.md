# Bewertung n12-nachtrag (Ergänzung zu n12, Kennung n12-1611-a)

Nur lesende Messungen am 2026-11-16, Antwort auf die Bitte von Beks nach dem Bericht n12. Uhrzeiten UTC (lokal = +1 Stunde).

## Merge
`n12` war beim Aufruf schon auf `main` und `origin/main` (`0e6b661`): `npm run fertig` macht den ff-Merge und den Push selbst. Ein weiterer Merge war nicht nötig.

## 1. Migration 0067
- `sha256sum supabase/migrations/20261116120000_0067_accept_replay.sql`: `2787c9d7e5266d9d4a3755e8ed27b8c91e67ce66a6ebcedd79c35f683565119c` (gleich der Marke `db-push` in `tmp/proof/n12/runs.jsonl` und der Abnahme).
- `npx supabase migration list`: in jeder Zeile `local` = `remote`, die letzte ist `20261116120000` (0067). Keine Zeile fehlt auf einer Seite.

## 2. `functions list` und Reihenfolge Deploy, Läufe
Stand der Liste (Name, Version, `updated_at`):

| Function | Version | zuletzt deployt |
|---|---|---|
| accept | 7 | 2026-11-16 06:56:06 (n12) |
| route | 7 | 2026-11-08 (früher) |
| quote | 94 | 2026-11-16 02:40:37 (n15) |
| photo-cleanup | 2 | 2026-11-08 |
| admin-contact | 3 | 2026-11-16 02:40:37 |
| outbox-send | 9 | 2026-11-09 15:46:01 |
| photo-publish | 2 | 2026-11-08 14:15 |
| photo-receipt | 4 | 2026-11-16 02:40:37 |
| job-photo | 4 | 2026-11-16 02:40:37 |
| admin-photo | 4 | 2026-11-16 02:40:37 |
| offer-confirm | 8 | 2026-11-16 02:40:37 |
| change-propose | 9 | 2026-11-16 02:40:37 |
| change-decide | 9 | 2026-11-16 02:40:37 |
| cancel-customer | 8 | 2026-11-16 02:40:37 |
| cancel-partner | 8 | 2026-11-16 02:40:37 |
| admin-correct | 7 | 2026-11-16 02:40:37 |
| delete-account | 4 | 2026-11-16 02:40:37 |

Alle 17 ACTIVE, `verify_jwt` false.

Reihenfolge (Quelle `tmp/proof/n12/runs.jsonl`, `functions list`):
- 06:55:27 `db-push` (0067) → 06:56:06 Deploy `accept` Version 7 → 06:56:20 `flow-live.test.ts` Lauf 011 (EXIT=0, 143 s).
- rls-Volllauf Lauf 022: Start 07:35:18, rot (Transportfehler der Management-API, 1396,3 s); Lauf 023: Start 07:58:46, EXIT=0, 379 Tests, 1179,7 s, Ende etwa 08:18:26. Beide liegen nach dem Deploy (Abstand 39 und 62 Minuten).
- `tmp/proof/n12/023-rls.log` Zeile 311: `✓ |rls| tests/rls/auth-token-codes.test.ts (1 test) 10054ms`. Der Live-Smoke (13 Functions × gefälschter Token und Token eines gelöschten Kontos, je 401) lief also im Volllauf nach dem Deploy von `accept` und war grün. Er bestätigt nur das 401 der 13 Functions, nicht, dass jede Function den Repo-Stand der geänderten Dateien enthält.

## 3. Neue OFFEN-Zeile n12-5
Gesamt laden 14 von 17 Functions die geänderten Dateien (`_shared/jobs/handlers.ts` oder `db.ts`, direkt oder über `_shared/{cancel,account,admin,change,photo}`); deployt ist nur `accept`. Nicht betroffen: `route`, `quote`, `photo-cleanup`. Das Verhalten der 13 anderen ist unverändert (geändert sind nur `AcceptDeps`, `handleAccept`, `acceptDb`, die allein `accept` benutzt; `database.types.ts` ist nur Typ), aber deployter Stand und Repo weichen ab. In der Zeile steht die Liste; eingetragen in `docs/OFFEN.md`.

## 4. Entscheidung von Beks
BEKS Frage 1 (Hinweistext „Deine Anfrage ist schon angekommen …“): ja, so lassen. Eingetragen als ENTSCHEIDUNGEN Nr. 186, Frage aus `docs/BEKS.md` gelöscht.
