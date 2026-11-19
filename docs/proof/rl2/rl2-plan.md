# rl2 Plan: Rate-Limit für job-photo (OFFEN rl1-1), Kennung rl2-1911-a

## Fakten (Datei:Zeile)
- `supabase/functions/_shared/photo/handlers.ts:169-188` `handleJobPhoto`: `authed(req, deps, origin, false)` (175, ohne aal2), Body lesen (178), Eingabeprüfung 179-183, `deps.photos` (184). Kein Zähler.
- `supabase/functions/job-photo/index.ts:18`: Deps = `jobPhotoDb(db)`, `allowedOrigins`, `log`; kein `hmac`/`takeTokens`, kein `RATE_LIMIT_SECRET`.
- Muster `photo-receipt/index.ts:19-24`: `hmacHex(env('RATE_LIMIT_SECRET'))`, `routeDb(db).takeTokens`. `handlers.ts:92` `RECEIPT_LIMITS`, `:110-119` `take` (503 `limiter_unavailable` + festes Log, 429 `rate_limited`), `:135-136` Konto-Minute vor dem Tor mit Bucket `receipt:min:<hmac('user|id')>`.
- Zuordnungsprüfung steckt in der SQL-Funktion `job_photo_list` (`photo/db.ts:68`): ein RPC prüft und liest. Ein Zähler „nach der Zuordnungsprüfung" wäre nur mit Migration (Prüfung getrennt) möglich; Auftrag verlangt „ohne Migration".
- Bestehende Grenzen: höchstens 8 Belege je Auftrag (`receipt_limit`, `photo_receipt_check`), höchstens 8 Bilder je Anfrage (daten.md). `job-photo` liest nur und signiert URLs (600 s); keine Zeile, kein Upload.
- Aufrufweg: Kunde `src/lib/jobs.ts:174-175` (`loadReceipts`, Nachtrag.tsx:11 beim Öffnen; jeder Fehler → fester Hinweistext, kein Retry), Partner `src/lib/partnerJobs.ts:214-215` (`loadPhotos`, Anfragen.tsx:322-328 nur auf Klick, Fehler → Fehlerzustand). Beide über `invoke` (`jobs.ts:106-115`); Codes der Server-Antwort ordnen `CODES` (`jobs.ts:82`, `partnerJobs.ts:19`) zu: `rate_limited` fehlt dort, ein 429 wird heute `unavailable` (retryable, Knopf „Erneut versuchen"). `retryable` (`jobs.ts:101`) enthält `rate_limited` nicht. Text `jobs.ts:73` sagt „hochgeladen" (falsch für Ansicht).
- Dev hat `RATE_LIMIT_SECRET` (rl1, GOLIVE 9); `take_rate_tokens` besteht (route, quote, photo-receipt).

## Entwurf
1. `JOB_PHOTO_LIMITS = { userMinute: 60 } as const` in `handlers.ts`; ein Zähler `jobphoto:min:<hmac('user|<id>')>`, Fenster 60 s, **nach** `authed` und **vor** Lesen des Bodys und der Datenbank. Überschreitung 429 `rate_limited`, Zähler fällt aus 503 `limiter_unavailable` (fail closed, eigenes festes Log `job_photo_limiter`). `take` wird für beide Functions geteilt (Parameter Ereignisname).
2. Keine weiteren Zähler. Begründung: lesend ohne Wirkung außer Signieren; die Minutengrenze beschränkt jedes Konto auf höchstens 60 Aufrufe/Min; Tages- oder Auftragszähler würden die Zuordnungsprüfung (SQL) nach dem Zähler verlangen (Migration) und echte Nutzer (Fotos mehrerer Anfragen nacheinander) ohne Gewinn treffen. 60: die App ruft je Ansicht einmal auf, also ≥ 1 Aufruf/Sekunde.
3. `job-photo/index.ts`: `hmac` und `takeTokens` wie photo-receipt; die Function braucht jetzt `RATE_LIMIT_SECRET` (fehlt es, startet sie nicht).
4. Client: `rate_limited: 'rate_limited'` in beide `CODES`; Text `jobErrorText.rate_limited` allgemein („Gerade sind zu viele Fotos unterwegs. Warte etwas und versuche es dann noch einmal."); keine automatische Wiederholung (nicht `retryable`).
5. Tests rot zuerst: Unit `photo-handlers.test.ts` (Reihenfolge Zähler vor Datenbank, Bucket und Grenze, 429 ohne `photos`-Aufruf, 503 mit festem Log ohne Leck, Konto-getrennt), Client `jobs-client.test.ts`/Partner-Test (429 → `rate_limited`), live: neuer letzter Block in `tests/rls/flow-live.test.ts` (Positivkontrolle 200 mit Partnerkonto pa und Listing von W5, dann Aufrufe bis 429 (höchstens 200, unabhängig von der Startsekunde), Antwort genau `{error:'rate_limited'}` ohne URL; Gegenprobe: anderes Konto bleibt 200).
6. Deploy: `job-photo`, `photo-receipt`, `photo-publish`, `admin-photo` (laden `photo/handlers.ts`); Smoke 401, `functions list`.
7. Doku: ENTSCHEIDUNGEN, STAND, OFFEN (rl1-1 schließen), GOLIVE 26.

## Frage an advisor
Trägt der Entwurf (ein Zähler Konto/Minute 60, vor Body und Datenbank, 503 bei Ausfall des Zählers auch auf diesem Lesepfad, keine weiteren Zähler und keine Migration) das Ziel „Pflicht vor booking_open"? Zählt jeder Aufruf (auch ungültige Eingabe und fremde ID), und ist 60 als Grenze vertretbar? Fehlt eine Auflage?
