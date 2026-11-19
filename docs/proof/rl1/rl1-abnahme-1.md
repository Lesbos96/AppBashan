Modell: claude-fable-5-2
Vorgaenger: keiner

# Abnahme rl1 (R3), Runde 1

Datum: 2026-11-19 · Commit 1523beb (Branch rl1, Arbeitsbaum laut Startstatus sauber) · Prüfer: advisor-report

Umfang: Rate-Limit für `photo-receipt` gegen die Auflagen in `tmp/proof/rl1-plan.md`, `.claude/rules/daten.md` und `.claude/rules/geld.md`. Vollständig gelesen: beide Pflichtdateien, `_shared/photo/db.ts`, `_shared/route/db.ts`, `_shared/route/hmac.ts`, Migrationen 0006 und 0008 (Zähler), 0073 Zeilen 1 bis 53 (Tor, `photo_receipt_add`), `tests/unit/photo-handlers.test.ts`, die Blöcke W1-Beleg und Limit in `tests/rls/flow-live.test.ts`, `tmp/proof/rl1/runs.jsonl`, Köpfe und Fehlerzeilen der Logs 006 und 007. Abschnittsweise: `jobs/handlers.ts` (authed, preflight, STATUS), `http.ts` (readBytesLimited), `src/lib/partnerChange.ts`, `src/lib/jobs.ts`, `Nachtrag.tsx`, `Absage.tsx`, OFFEN, ENTSCHEIDUNGEN 217, ARCHITECTURE 84, 96, 158, 195.

SHA256: 4bef895db48b1750fc61c5725bbd6e99b1d73ff9ad2624594281fb263b80fec6 supabase/functions/_shared/photo/handlers.ts
SHA256: 8399b02b1ca339add4e51835f5b74bb3404ddf86d9b32efd7120f93445bf7cf8 supabase/functions/photo-receipt/index.ts

Hinweis zu den Hashes: aus dem Auftrag abgeschrieben, nicht selbst nachgerechnet (dieser Agent hat kein Shell-Werkzeug; eine Suche nach beiden Werten unter `tmp/` und `docs/` ergab keinen Treffer). Geprüft wurde der Inhalt beider Dateien im Arbeitsbaum bei HEAD 1523beb; das Gate vergleicht die Hashes mit dem Endstand.

## Ergebnis

Die Auflagen 1 bis 6 des Plans sind im Code umgesetzt. Keine Geld- oder Sicherheitslücke gefunden. Ein mittlerer Fund am Live-Test (nicht deterministisch, falsches Rot möglich), vier niedrige.

## Findings

### hoch

Keine.

### mittel

- M1 · `tests/rls/flow-live.test.ts:554-563` – Der Block ist nicht deterministisch und kann fälschlich rot werden. Die Schleife endet beim ersten 429, egal welcher Zähler greift. Läuft sie innerhalb einer UTC-Minute, greift der Minuten-Zähler beim 21. Aufruf; der Anfrage-Zähler steht dann bei 20 von 24. Zwischen diesem 429 und dem gültigen JPEG liegen eine Uhrzeit-Abfrage über die CLI (`:560`) und das Kodieren (`:561`). Wechselt in dieser Zeit die Minute, ist der Minuten-Zähler frisch, der Anfrage-Zähler lässt den Aufruf zu, die Function antwortet 200, es entstehen Zeile und Objekt, und `:563` schlägt fehl, obwohl die Function richtig arbeitet. Der grüne Lauf 007 ging den anderen Weg: 429 nach 25 Aufrufen ist der Anfrage-Zähler (25 > 24), die Schleife lag über der Minutengrenze 20:21:00 (Log 007: Start 20:15:26, Dauer 349 s, letzter Test 20 s). Welcher Zähler live belegt ist, hängt damit von der Startsekunde ab; live belegt ist derzeit nur der Anfrage-Zähler. – Fix: Schleife fortsetzen, bis 24 Aufrufe 422 geliefert haben (Anfrage-Zähler erschöpft, gilt bis zum Ende des UTC-Tags); bei einem 429 davor bis zur nächsten Minute warten und weitermachen; erst dann das gültige JPEG senden. Dann ist das 429 des JPEG unabhängig von der Minute, und ein Lauf, der in einer Minute beginnt, belegt beide Zähler. Obergrenze bleibt unter 45 Aufrufen (24 durchgelassene plus höchstens wenige abgelehnte).

### niedrig

- N1 · `supabase/functions/_shared/photo/handlers.ts:118` mit `src/lib/jobs.ts:73` – 429 unterscheidet Minuten- und Tagesgrenze nicht; der Text sagt „Warte etwas“. Greift die Anfrage- oder Konto-Tagesgrenze, hilft Warten erst nach 00:00 UTC. Betroffen wäre eine Firma vor Ort, die einen Beleg für Nachtrag oder Pauschale braucht, aber nur nach 24 eigenen Aufrufen auf diese Anfrage am selben Tag. – Fix: jetzt keiner; in OFFEN rl1-2 ergänzen (eigener Code für die Tagesgrenze, falls die Zahlen nach dem Start Treffer zeigen).
- N2 · `docs/ARCHITECTURE.md:96`, `:158`, `:195` – Zeile 96 sagt, `take_rate_tokens` und `route_rate_limits` nutze nur `route`; Zeile 158 beschreibt `photo-receipt` ohne Zähler; die Secret-Liste nennt die Pflicht von `RATE_LIMIT_SECRET` für `photo-receipt` nicht. Widerspruch zu `handlers.ts:136-142` und `photo-receipt/index.ts:21-22`. ENTSCHEIDUNGEN 217, STAND und OFFEN sind stimmig. – Fix: die drei Stellen nachziehen (Verweis auf `RECEIPT_LIMITS`, keine Zahlen doppelt).
- N3 · `tests/unit/photo-handlers.test.ts:243-250` – Der 503-Fall deckt nur den Ausfall des ersten Zähler-Aufrufs. Der Ausfall des zweiten (nach dem Tor) ist ungetestet; der Code ist derselbe (`take`, `handlers.ts:110-119`), das Verhalten also richtig, aber nicht festgehalten. – Fix: ein Fall, in dem der zweite Aufruf wirft: 503, Aufrufe nur Zähler, Tor, Zähler, festes Log.
- N4 · `supabase/functions/_shared/photo/handlers.ts:136-137` mit `0073_belege.sql:24` und `:28` – Restrisiko, kein Fehler von rl1: das Tor sperrt die Zeile der Anfrage, bevor es die Zuordnung prüft. Ein fremdes Partner-Konto mit aal2 kann die Sperre einer fremden Anfrage weiter auslösen, jetzt höchstens 20-mal je Minute und Konto, jeweils für die Dauer einer kurzen Transaktion. Konten ohne Firma erreichen die Sperre nicht (`0073:22-23`). – Fix: keiner in rl1; falls je nötig, Zuordnung vor der Sperre prüfen (Migration).

## Prüffragen

1. Reihenfolge in `handleReceipt`: erfüllt. `handlers.ts:131` Token und aal2, `:134` UUID, `:135-136` Zähler 1 (Konto je Minute), `:137` Tor, `:139-142` Zähler 2 (`receiptreq:day` vor `receipt:day`), erst `:143` liest den Body. 429 und 503 entstehen in `take` (`:110-119`) als `HttpError` und verlassen die Funktion vor Lesen, Verarbeiten, Upload und `add`; `fail` (`:18`) antwortet nur mit Status und festem Code und loggt bei `HttpError` nichts. Eimer: nur HMAC (`:135`, `:140`), Präfixe `receipt:` und `receiptreq:` kollidieren nicht mit denen von `route` (`route/handler.ts:78-81`). Kein Eimer, kein Konto, keine Anfrage-ID in Antwort oder Log. 503 loggt den festen Eintrag (`:115`), die Fehlermeldung des Zählers wird verworfen (`catch` ohne Bindung, `:114`). Fail closed: Zähler wirft → 503; `hmac` wirft → 500 ohne Wirkung; Secret fehlt → die Function startet nicht.
2. `photo-receipt/index.ts`: erfüllt. `:21` `env('RATE_LIMIT_SECRET')` wirft beim Start, wenn die Variable fehlt oder leer ist (`:12-16`); `:22` `routeDb(db).takeTokens` ruft `take_rate_tokens` (`route/db.ts:34-38`) mit dem Secret-Key-Client. Rechte: `0006:84` entzieht public, anon, authenticated; `0006:87` gibt nur service_role; 0008 ist `create or replace` (Rechte bleiben), bricht beim ersten überschrittenen Zähler ab (`0008:20-22`). Keine neue SQL-Funktion, also kein Eintrag in `positiv.ts` und keine Migration nötig. Kein Secret im Log (`:24` loggt nur das Ereignisobjekt).
3. Dedupe und Grenzen: erfüllt. `photo_receipt_add` und das Tor sind unverändert (keine Migration im Commit; `0073:36-53`), `receiptDb` (`photo/db.ts:52-62`) ebenso. `RECEIPT_LIMITS = { userMinute: 20, requestDay: 24, userDay: 300 }` exportiert (`handlers.ts:92`), Begründung im Kommentar (`:86-91`), deckungsgleich mit ENTSCHEIDUNGEN 217. Jede Wiederholung zählt, das Budget trägt sie (8 Belege, Dedupe erst nach dem Verarbeiten).
4. Tests: Das Verhalten ist belegt, mit der Einschränkung aus M1.
   - Unit (`photo-handlers.test.ts:203-294`): Reihenfolge, Eimer als Hash und Grenzen aus der Konstante (`:207-216`); Minuten-429 ohne Tor, ohne Lesen, ohne Log (`:225-232`); Tages-429 nach dem Tor ohne process, upload, add (`:234-241`); 503 mit festem Log, die Meldung des Fehlers erscheint nicht (`:243-250`); Tor-Fehler verbraucht nur den Minuten-Zähler (`:252-256`); Anfrage-429 lässt den Konto-Tageszähler unberührt (`:258-264`); ungültige Eingabe und fehlendes Token verbrauchen nichts (`:266-271`); 8 Belege plus Wiederholung plus 2 abgelehnte Dateien liegen im Budget (`:273-293`). Die Zähl-Attrappe (`:140-153`) entspricht `0008:14-24` (jeder Aufruf zählt, Abbruch beim ersten überschrittenen). Auflage 2 vollständig. Rot vor Grün: Läufe 1 und 2 rot (8 bzw. 2 Fehler), Lauf 4 grün (28/28).
   - Live rot (Log 006): `Argumente: []`, `Schalter: []`, EXIT=1, 1 von 20 rot; Ist-Wert in Zeile 49: nach 45 Aufrufen Status 422 statt 429. Das misst die Wirkung der fehlenden Sperre (der 45. Aufruf wurde gelesen und verarbeitet), nicht nur einen Abbruch. Der Rot-Beweis zählt.
   - Live grün (Log 007): EXIT=0, 20/20, ohne Argumente und Schalter; `tmp/reports/flow-live-ist.txt:33`: 429 nach 25 Aufrufen, gültiges JPEG 429, Belegzeilen 0 → 0, neue Objekte 0. `dateiSha` in Lauf 6 und 7 gleich. 429 ohne Wirkung ist belegt: Zeilenzahl unverändert (`flow-live.test.ts:564`), kein neues Objekt seit Beginn (`:565-566`); Positivkontrolle im selben Block: vor der Grenze liefert derselbe Aufruf 422 `not_jpeg`, das Tor lässt Firma a für W5 also durch.
   - Wiederholung nicht fälschlich blockiert: live im selben grünen Lauf mit aktivem Zähler (`flow-live.test.ts:208-214`: gleiche Datei zweimal, 200 mit derselben Id, eine Zeile) und als Budgetrechnung im Unit-Test (`:273-293`).
   - Fremde Firma live: `flow-live.test.ts:203` 404 (verbraucht nur den eigenen Minuten-Zähler). Konten je Lauf neu: `tests/support/db.ts:23` und `:34` (Lauf-Kennung in der Adresse), `totp.ts:26`.
   - Client (Auflage 6): `partnerChange.ts:33` bildet `rate_limited` ab, `jobs.ts:101` zählt es nicht zu den wiederholbaren Fehlern, `Nachtrag.tsx:107-113` und `Absage.tsx:150-156` laden nacheinander und brechen beim Fehler ab; `partner-change.test.ts:143` deckt `rate_limited` und `limiter_unavailable`.
   - Hinweis zu den Nachweisen: Läufe 4 und 7 liefen bei Commit 189c380 mit geändertem Arbeitsbaum (`runs.jsonl`, `sauber: false`), also vor 1523beb. Die Pflichtläufe auf dem committeten Endstand stehen in `runs.jsonl` noch nicht; sie sind Sache des Gates vor `fertig`. Ob die deployte Fassung dem Commit entspricht, kann dieser Agent nicht prüfen (STAND nennt v17).
5. Geld und Sicherheit: keine Lücke gefunden.
   - Geld: kein Betrag, keine Gebühr, kein Journal berührt. Die Antwort enthält nur die Foto-Id oder einen festen Code.
   - Verbrauch durch fremde Konten: Der Anfrage-Zähler steht nach dem Tor; ihn erreichen nur Konten der Firma mit aktiver Zuordnung, aal2 und Status `accepted` oder `in_progress` (`0073:20-31`). Fremde Konten verbrauchen nur ihren eigenen Minuten-Zähler (Unit `:252-256`, live `:203`).
   - DoS gegen eine fremde Firma: nicht möglich über die Zähler. Eine abgebende Firma kann das Budget nicht an die Nachfolgerin vererben: nach der Absage ist die Anfrage `cancelled_by_partner`, die Weitervermittlung läuft über eine Folgeanfrage mit neuer Id (`0062:801-814`), also neuem Eimer. Rest: N4 (kurze Zeilensperre, jetzt begrenzt).
   - Umgehung vor dem Zähler: Vor Zähler 1 liegen nur Token-Prüfung, aal2 und UUID; keiner dieser Pfade liest den Body, sperrt eine Zeile oder schreibt. Aufrufe ohne gültiges Token, mit aal1 oder ohne gültige Anfrage-Id zählen nicht; sie kosten je Aufruf höchstens die Token-Prüfung, wie bei jeder anderen Function (kein Thema von rl1).
   - Mehrere Konten einer Firma: je Konto 20 je Minute und 300 je Tag, gemeinsam 24 je Anfrage und Tag; ein Konto gehört zu genau einer Firma (`0023:46`). Überschreitet ein Konto seine Tagesgrenze, zählt der Aufruf trotzdem beim Anfrage-Zähler mit (Reihenfolge); das trifft nur die eigene Firma.
   - Speicher und Rechenzeit: höchstens 24 verarbeitete Aufrufe je Anfrage und Tag; Objekte ohne Zeile räumt `photo-cleanup` nach 1 h ab (unverändert). Zeilen der Zähler löscht der tägliche Lauf nach 2 Tagen (`0006:93-98`).
   - Nebenläufigkeit: Der Zähler ist ein Upsert je Eimer und Fenster (`0008:16-19`), gleichzeitige Aufrufe zählen korrekt. Feste Fenster erlauben an der Grenze kurz das Doppelte (OFFEN rl1-2).

## Stichproben

- `supabase/functions/_shared/photo/handlers.ts:131-143` – Reihenfolge Token, UUID, Zähler 1, Tor, Zähler 2, Lesen: stimmt.
- `supabase/functions/_shared/photo/handlers.ts:110-119` – 503 mit festem Log, Fehlertext verworfen; 429 ohne Log: stimmt.
- `supabase/functions/_shared/photo/handlers.ts:14-27` – `fail` gibt bei `HttpError` nur Status und Code zurück, kein Log: stimmt.
- `supabase/functions/_shared/photo/handlers.ts:92` – Konstante exportiert, Werte 20, 24, 300: stimmt.
- `supabase/functions/photo-receipt/index.ts:12-22` – Secret Pflicht, `takeTokens` aus `routeDb`: stimmt.
- `supabase/functions/_shared/route/db.ts:34-38` – RPC `take_rate_tokens`, Fehler wird geworfen: stimmt.
- `supabase/functions/_shared/route/hmac.ts:2-9` – HMAC-SHA256 hex: stimmt.
- `supabase/migrations/20261029214421_0006_route_infra.sql:84-87` – EXECUTE nur service_role: stimmt.
- `supabase/migrations/20261029215750_0008_rate_limit_stop_early.sql:14-24` – zählt vor dem Vergleich, Abbruch beim ersten überschrittenen Zähler: stimmt.
- `supabase/migrations/20261117190247_0073_belege.sql:20-31` – Tor: Firma, Sperre, Status der Firma, aktive Zuordnung, Status der Anfrage; Sperre vor der Zuordnungsprüfung (N4).
- `supabase/migrations/20261117190247_0073_belege.sql:43-51` – Dedupe vor Limit 8, unberührt: stimmt.
- `supabase/migrations/20261107100000_0023_partners.sql:46` – ein Konto, eine Firma: stimmt.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:801-814` – Absage beendet die Anfrage, Folgeanfrage mit neuer Id: stimmt.
- `supabase/functions/_shared/jobs/handlers.ts:55-61` – 401 und 403 vor jedem Zähler, ohne Lesen des Bodys: stimmt.
- `supabase/functions/_shared/http.ts:23-24` – Größenprüfung erst beim Lesen, also nach den Zählern: stimmt.
- `tests/unit/photo-handlers.test.ts:140-153` – Attrappe wie 0008: stimmt.
- `tests/unit/photo-handlers.test.ts:225-264` – Auflage 2 (drei Fälle): vorhanden und aussagekräftig.
- `tests/rls/flow-live.test.ts:546-568` – letzter Block der Datei, höchstens 45 Aufrufe, Zeilen und Objekte geprüft: stimmt; nicht deterministisch (M1).
- `tests/rls/flow-live.test.ts:208-214` – Wiederholung live 200 mit derselben Id: stimmt.
- `tmp/proof/rl1/006-tests_rls_flow-live.test.ts.log:4-5, 49, 84` – ohne Argumente und Schalter, Ist-Wert 422 nach 45 Aufrufen, EXIT=1: stimmt.
- `tmp/proof/rl1/007-tests_rls_flow-live.test.ts.log:4-5, 41, 52` – ohne Argumente und Schalter, Block grün, EXIT=0: stimmt.
- `tmp/proof/rl1/runs.jsonl:6-7` – gleicher `dateiSha` für Rot und Grün; beide bei 189c380 mit geändertem Arbeitsbaum.
- `tmp/reports/flow-live-ist.txt:33` – 429 nach 25 Aufrufen, 0 → 0 Zeilen, 0 Objekte: stimmt.
- `src/lib/jobs.ts:101` und `src/screens/partner/Nachtrag.tsx:107-113` – keine automatische Wiederholung bei 429: stimmt.
- `docs/OFFEN.md:42-43` – rl1-1 (`job-photo`) mit Empfehlung, rl1-2 vorhanden: stimmt.
- `docs/ARCHITECTURE.md:96, 158` – nicht nachgezogen (N2).

Offene Findings hoch: 0
