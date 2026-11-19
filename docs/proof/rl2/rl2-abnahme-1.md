Modell: claude-fable-5-2
Vorgaenger: keiner

# rl2 Abnahme Runde 1: Rate-Limit `job-photo`

Datum: 2026-11-19 · Branch `rl2` · Kennung rl2-1911-a · Arbeitsbaum uncommittet (Stand der Pflichtdateien laut Auftrag)

SHA256: 1d787794fe8694d23e1ee186b9db87bbcbc70d5c46c64931f444eb339ca63e8d supabase/functions/_shared/photo/handlers.ts
SHA256: 461d238ffedd5a13457b4fb3395fd76049fae1a59b93447d7a428971c5e64941 supabase/functions/job-photo/index.ts

Zu den Hashes: Ich habe kein Werkzeug zum Rechnen. Beide Zeilen sind vom Auftraggeber geliefert und abgeschrieben, nicht nachgerechnet. Geprüft habe ich den Inhalt, den ich zum Zeitpunkt der Abnahme gelesen habe; das Gate vergleicht die Hashes mit dem Endstand.

Zum Maßstab: Der Wortlaut meiner Auflagen 1 bis 8 aus der Planprüfung liegt in keiner Datei vor (`tmp/proof/rl2-plan.md` enthält nur Plan und Frage). Geprüft ist gegen den Plan und gegen die Auflagen, wie der Auftrag sie wiedergibt.

## Geprüfter Umfang
- Vollständig gelesen: `supabase/functions/_shared/photo/handlers.ts`, `supabase/functions/job-photo/index.ts`, `supabase/functions/photo-receipt/index.ts` (Muster), `tests/unit/photo-handlers.test.ts`, `tmp/proof/rl2-plan.md`, `tmp/proof/rl2/runs.jsonl`, `.claude/rules/geld.md`, `.claude/rules/daten.md`.
- Abschnittsweise: `tests/rls/flow-live.test.ts` (1-152, 196-220, 536-610), `supabase/functions/_shared/jobs/handlers.ts` (`authed`, `body`, `preflight`, `STATUS`), `_shared/route/db.ts`, `_shared/route/handler.ts`, `_shared/quote/handler.ts` (Eimernamen), `_shared/photo/db.ts`, Migrationen 0006 (Tabelle, Rechte), 0008 (`take_rate_tokens`), 0065 (`job_photo_list`), `src/lib/jobs.ts`, `src/lib/partnerJobs.ts`, `src/lib/prices.ts` (`useLoad`), `src/screens/auftrag/Nachtrag.tsx`, `src/screens/partner/Anfragen.tsx`, `tests/rls/auth-token-codes.test.ts`, Doku ENTSCHEIDUNGEN Nr. 217/218, OFFEN rl2-1 und rl1-2, ARCHITECTURE Zeile 158, GOLIVE 9 und 26, STAND, Logs 001 bis 008 (nur Kopf, Fehler, Ergebnis).
- Nicht geprüft: der deployte Stand auf Dev (kein Zugriff), `git diff` gegen den Vorstand (kein Werkzeug; „photo-receipt unverändert" ist aus dem Code, den Zeilenangaben des Plans und den grünen Unit-Fällen hergeleitet).

## Urteil
Der Code der beiden Pflichtdateien erfüllt Plan und Auflagen. Kein hoher Fund. Offen sind der grüne Live-Lauf nach dem Deploy (M1) und zwei Doku-Punkte (M2, M3).

## Findings

### hoch
Keine.

### mittel
- **M1** `tests/rls/flow-live.test.ts:602-607` – Der Live-Beleg der Wirkung fehlt noch. Der einzige Live-Lauf (008) ist der rote gegen den alten Deploy; er bricht in Zeile 602 ab. Die Zeilen 603 bis 607 (Antwort genau `{error:'rate_limited'}`, höchstens zwei Fenster, Gegenprobe mit Firma a) sind nie gelaufen. Ob die Gegenprobe 200 mit URL liefert, ist nur aus dem Code hergeleitet: Firma a steht dann auf `payment_hold`, W1 ist abgeschlossen; `job_photo_list` lässt das zu (0065:81), sofern `partner_data_access` nach dem Abschluss noch gilt. – Fix: die vier Functions deployen, die `photo/handlers.ts` laden (`job-photo`, `photo-receipt`, `photo-publish`, `admin-photo`), 401-Smoke, dann `npm run t -- tests/rls/flow-live.test.ts` grün, ohne Argumente und Schalter, mit der Ist-Zeile „job-photo-Limit". Muss dafür die Testdatei oder eine Pflichtdatei geändert werden, ist eine Runde 2 nötig.
- **M2** `docs/ENTSCHEIDUNGEN.md:225` – Nr. 218 sagt im Text „keine neue Entscheidung von Beks", die Spalte Status nennt aber „Beks". Technische Festlegungen tragen sonst „technisch (Fable)" (Zeile 206). So gälte die Grenze 60 und der Verzicht auf Tages- und Auftragszähler später als Entscheidung von Beks, die nur mit seinem wörtlichen Ja änderbar ist. – Fix: Status auf „technisch (Fable)".
- **M3** `docs/STAND.md:7`, `docs/STAND.md:20` – STAND nennt weiter „Offen: OFFEN rl1-1 (`job-photo` ohne Zähler)" und `job-photo` v17; der Eintrag rl1-1 ist aus OFFEN entfernt, der Verweis läuft ins Leere. Der Plan (Punkt 7) verlangt STAND. – Fix: nach dem Deploy Versionen und offene Punkte (rl2-1, rl1-2) nachziehen.

### niedrig
- **N1** `supabase/functions/_shared/photo/handlers.ts:112` – `take` hat den Ereignisnamen als Vorgabewert `photo_receipt_limiter`. Ein dritter Aufrufer, der ihn vergisst, loggt still unter dem Namen von `photo-receipt`. Heute ohne Wirkung, alle drei Aufrufe sind richtig (138, 141, 192). – Fix bei der nächsten Änderung der Datei: Parameter zur Pflicht machen.
- **N2** `tests/unit/photo-handlers.test.ts:360-420` – Kein Fall hält fest, dass OPTIONS und andere Methoden den Zähler nicht verbrauchen. Die Reihenfolge preflight vor Zähler steht nur im Code (`handlers.ts:185-192`). – Fix: eine Zusicherung `taken` leer nach OPTIONS und GET.
- **N3** `tests/rls/flow-live.test.ts:594-604` – Der Test braucht mehr als einen Aufruf je Sekunde, sonst entsteht kein Fenster mit 61 Aufrufen und er wird fälschlich rot (nie fälschlich grün). Gemessen im roten Lauf: 201 Aufrufe in 61,7 s. Er belegt live nur, dass ein Konto-Zähler greift und zwischen 60 und 120 liegt; die genaue Grenze belegen die Unit-Fälle. Kann so bleiben.
- **N4** `src/lib/jobs.ts:73`, `src/lib/jobs.ts:97` – Der Text zu `rate_limited` spricht von Fotos und hängt an der gemeinsamen Tabelle des Kunden. Bekommt später eine andere Kunden-Function einen Zähler (OFFEN S9i7-4), passt der Text nicht mehr. Heute liefert nur `job-photo` diesen Code an diese Tabelle. – Beim Bau von S9i7-4 mitprüfen.

## Prüffragen aus dem Auftrag
1. **Reihenfolge preflight, authed, take, body, Eingabeprüfung, photos:** erfüllt. `handlers.ts:184-199`: CORS-Kopf 184, preflight 185-186, `authed` ohne aal2 189-190, Zähler 192, Body 193, Eingabeprüfung 194-197, `photos` 199. `authed` liest den Body nicht (`jobs/handlers.ts:55-61`).
2. **Eimer getrennt:** erfüllt. `jobphoto:min:<HMAC('user|id')>` (192) gegen `receipt:min:` (138). Der HMAC-Wert ist derselbe, der Präfix trennt. Kein anderer Aufrufer nutzt den Präfix (`route/handler.ts:78-81`, `quote/handler.ts:131-134, 178-180, 222-223`). Ansehen verbraucht nie das Upload-Budget; ein fremdes Konto kann den Zähler eines anderen nicht verbrauchen (Schlüssel ist die Konto-ID aus dem geprüften Token, Unit-Fall Zeile 405-409).
3. **Genau ein Check (60, 60 s):** erfüllt. Ein Aufruf mit einem Eintrag, `JOB_PHOTO_LIMITS = { userMinute: 60 }` (170), `MINUTE = 60` (93). Unit-Fall Zeile 364-370 prüft Liste, Grenze und Fenster genau.
4. **`take` geteilt, `photo-receipt` unverändert:** erfüllt. Eine Funktion (112-121), `photo-receipt` ruft ohne Namen (138, 141) und loggt weiter `photo_receipt_limiter`; die rl1-Fälle (Zeile 244-261) sind im grünen Lauf 004 enthalten (35 bestanden).
5. **429/503 mit CORS-Kopf, ohne Body-Lesen, ohne `photos`:** erfüllt. `take` wirft `HttpError`, `fail` antwortet mit `origin` (18, 201). Unit-Fälle Zeile 372-394: Kopf gesetzt, `bodyUsed` falsch, `photos` nicht aufgerufen. 429 ohne Log, Antwort nur `{error}`.
6. **Festes Log:** erfüllt. `{ event: 'job_photo_limiter', code: 'limiter_unavailable' }`, kein Eimer, kein Konto, keine Fehlermeldung (117); der Unit-Fall wirft eine Meldung mit ID und Eimer und prüft das Log auf Gleichheit (Zeile 385-393).
7. **`index.ts` wie `photo-receipt`:** erfüllt. `job-photo/index.ts:20-23` entspricht `photo-receipt/index.ts:21-24` (`hmacHex(env('RATE_LIMIT_SECRET'))`, `routeDb(db).takeTokens`); fehlt das Secret, startet die Function nicht (fail closed). `verify_jwt` bleibt aus (`config.toml:446-447`), das Token prüft die Function. GOLIVE 9 nennt `job-photo` (`docs/GOLIVE.md:33`).
8. **Keine Migration:** erfüllt. Jüngste Migration ist 0076 (mail2). `take_rate_tokens` zählt atomar (`insert … on conflict do update`, 0008:16-19), EXECUTE nur für `service_role` (0006:84-87), Tabelle mit RLS ohne Policies und ohne Rechte für `anon`/`authenticated` (0006:23-24), Aufräumen nach 2 Tagen (0009:9).
9. **Unit-Tests „job-photo Rate-Limit":** sechs Fälle, alle messen Verhalten (Reihenfolge, Eimer, 429, 503, Zählen bei 400/404, kein Zählen bei 401, Konto aus dem Token, Grenze 60/61 mit dem Zählmodell von 0008). Lücke N2.
10. **Live-Test (letzter Block):** Aufbau richtig. Positivkontrolle mit URL (589-591), Schleife bricht bei jeder Antwort außer 200/429 ab, Obergrenze 120 passt zu festen Fenstern, Gegenprobe mit anderem Konto. Abweichung vom Plan (Kunde von W1 statt Partner mit Listing von W5 als Hauptweg) ist in Ordnung: der Kundenweg braucht kein aal2, die Gegenprobe deckt den Partnerweg. Letzter Block der Datei, erschöpft nur den Zähler des Testkunden. Grüner Lauf fehlt (M1).
11. **ENTSCHEIDUNGEN Nr. 218:** inhaltlich richtig (Reihenfolge, Eimer, Grenze, Codes, Client-Angaben gegen `jobs.ts:73, 97, 102` und `partnerJobs.ts:41` geprüft; die Aussage „Konto-Tageszähler ohne Migration möglich" berichtigt Punkt 2 des Plans zu Recht). Statusspalte falsch (M2).
12. **OFFEN rl2-1:** richtig. Bis zu 120 an der Minutengrenze stimmt für feste Fenster; Tabelle `route_rate_limits` stimmt; beide Screens zeigen bei jedem Fehler ihren festen Hinweis (`Nachtrag.tsx:13`, `Anfragen.tsx:346-349`). rl1-1 ist aus OFFEN entfernt.
13. **Nachweise:** Rot 001 bis 003 und Grün 004 bis 007 auf demselben Commit, ohne Argumente und Schalter. Die roten Unit-Läufe zeigen Ist-Werte (200 statt 429 und 503, Aufrufe ohne Zähler, `unavailable` statt `rate_limited`). Der rote Live-Lauf 008 zählt: ohne Argumente und Schalter, Ist-Wert „kein 429 nach 201 Aufrufen", alle 201 Aufrufe 200, die übrigen 20 Tests bestanden. `dateiSha` von Lauf 008 konnte ich nicht gegen die Testdatei nachrechnen.

Geld: nicht berührt. Kein Betrag, keine Gebühr, kein Journalweg; der neue Text enthält keinen Gebührenhinweis (`jobs-client.test.ts:217`).

Restrisiko außerhalb des Schritts: Aufrufe ohne gültiges Token zählen nicht (gewollt), jeder wohlgeformte Token löst aber weiter `getUser` aus. Das gilt für alle Functions mit JWT und ist kein Fund dieses Schritts. Ein Konto kostet höchstens 60 Aufrufe je Minute (je ein Zähler-Aufruf, eine Abfrage, eine Signatur).

## Stichproben
| Datei:Zeile | Ergebnis |
|---|---|
| `supabase/functions/_shared/photo/handlers.ts:112-121` | `take`: 503 mit festem Log bei Ausfall, 429 bei `false`; Ereignisname als Parameter |
| `supabase/functions/_shared/photo/handlers.ts:137-144` | `photo-receipt`: Aufrufe ohne Ereignisname, Eimer und Grenzen wie rl1 |
| `supabase/functions/_shared/photo/handlers.ts:170` | `JOB_PHOTO_LIMITS = { userMinute: 60 }` |
| `supabase/functions/_shared/photo/handlers.ts:184-199` | Reihenfolge wie verlangt, ein Zähler-Aufruf |
| `supabase/functions/_shared/photo/handlers.ts:14-18` | `fail` gibt `HttpError` mit `origin` zurück, ohne Log |
| `supabase/functions/job-photo/index.ts:20-23` | `hmac`, `takeTokens` wie `photo-receipt/index.ts:21-24` |
| `supabase/functions/_shared/jobs/handlers.ts:55-61` | `authed`: 401 vor allem anderen, liest keinen Body |
| `supabase/functions/_shared/jobs/handlers.ts:72-73` | `preflight`: OPTIONS 204, andere Methoden 405, vor `authed` |
| `supabase/functions/_shared/route/db.ts:34-38` | `takeTokens` wirft bei Fehler, liefert sonst den Wahrheitswert |
| `supabase/migrations/20261029215750_0008_rate_limit_stop_early.sql:14-24` | zählt atomar, `false` ab Treffer über `max`, feste Fenster |
| `supabase/migrations/20261029214421_0006_route_infra.sql:23-24, 84-87` | RLS an, keine Rechte für App-Rollen, EXECUTE nur `service_role` |
| `supabase/migrations/20261115233507_0065_pauschale_ab_termin.sql:81, 90-95` | Partner `payment_hold` zugelassen; Kunde nur eigene Anfrage, nur Belege |
| `tests/unit/photo-handlers.test.ts:364-420` | sechs Fälle, Verhalten statt Existenz |
| `tests/unit/photo-handlers.test.ts:244-261` | rl1-Fälle prüfen weiter `photo_receipt_limiter` |
| `tests/rls/flow-live.test.ts:583-609` | Aufbau richtig, grün noch nicht gelaufen |
| `tests/rls/auth-token-codes.test.ts:49-69` | ruft `job-photo` nur mit abgelehnten Tokens (401 vor dem Zähler) |
| `src/lib/jobs.ts:73, 97, 102` | Text ohne „hochgeladen", Code zugeordnet, `retryable` ohne `rate_limited` |
| `src/lib/partnerJobs.ts:41, 216` | Code zugeordnet, `loadPhotos` nutzt die Partner-Tabelle |
| `src/lib/prices.ts:46-66` | `useLoad` lädt einmal je Einbau, keine Schleife |
| `src/screens/auftrag/Nachtrag.tsx:13` | fester Hinweis bei jedem Fehler |
| `src/screens/partner/Anfragen.tsx:322-349` | Laden nur auf Klick, fester Hinweis |
| `docs/ENTSCHEIDUNGEN.md:225` | Inhalt richtig, Status falsch (M2) |
| `docs/OFFEN.md:42` | rl2-1 richtig |
| `docs/ARCHITECTURE.md:158` | Zähler von `job-photo` richtig beschrieben |
| `docs/GOLIVE.md:33, 59` | Secret für `job-photo` genannt; Punkt 26 nennt rl2 |
| `docs/STAND.md:7, 20` | veraltet (M3) |
| `tmp/proof/rl2/001-…log:26-124` | sechs rote Fälle mit Ist-Werten, `EXIT=1` |
| `tmp/proof/rl2/004-…log:17-24` | 35 bestanden, `EXIT=0` |
| `tmp/proof/rl2/002-…log:22`, `003-…log:22` | rot: `unavailable` statt `rate_limited` |
| `tmp/proof/rl2/008-…log:1-5, 45-72` | rot ohne Argumente und Schalter, „kein 429 nach 201 Aufrufen", `EXIT=1` |
| `tmp/proof/rl2/runs.jsonl:8` | Lauf 008 mit `dateiSha`, 1 rot, 20 bestanden |

Offene Findings hoch: 0
