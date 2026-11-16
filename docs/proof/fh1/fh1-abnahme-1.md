Modell: claude-fable-5-2
Vorgaenger: keiner

# Abnahme fh1, Runde 1 (R3)

Datum: 2026-11-16
Umfang: Arbeitsstand auf Branch `fh1` (Commit 6d70ddb plus ungespeicherte Änderungen). Vollständig gelesen: die vier Pflichtdateien, `tests/unit/photo-handlers.test.ts`, `tests/unit/outbox-handler.test.ts`, `tests/rls/auth-token-codes.test.ts`, `tests/rls/replay-rest.test.ts`, `supabase/migrations/20261116140000_0069_replay_rest.sql`, `tmp/proof/fh1/db-freigabe-1.md`, `tmp/proof/fh1/deploy.log`, `tmp/proof/fh1/runs.jsonl`, die Logs 001, 008, 009 ganz, die übrigen nach Fehlern und Exit. Dazu als Vergleich: `_shared/auth.ts`, `_shared/http.ts`, `_shared/jobs/db.ts`, `_shared/photo/db.ts`, `photo-cleanup/index.ts`, alle `index.ts` (Importzeilen), `tests/unit/accept.test.ts:140-187`, `0035:170-249`, `0036:1-72`, `scripts/setup-photo-publish.mjs`, `docs/OFFEN.md:55-88`, `docs/GOLIVE.md:69`, `docs/ARCHITECTURE.md:156-158`, `.claude/rules/geld.md`, `daten.md`, `tests.md`.

SHA256: 8ed781a92f5d1de133ed4793cc7104327f8bbb9ab65dcead59103b3152603a6f supabase/functions/_shared/jobs/handlers.ts
SHA256: 6f0783b8fbdd94687d1b343ec81cb935a699404717f232931e889e23c040f4d0 supabase/functions/_shared/photo/handlers.ts
SHA256: 59d53d406585b57c7c412e1aa629deb6fae625898c1ea9ebe3c45bd9b0c0c478 supabase/functions/outbox-send/index.ts
SHA256: 0b6640ec244d97d06e9772c470d6bd247206b1383bf3791f5011142817993c0e supabase/functions/photo-publish/index.ts

## Grenzen dieser Prüfung (vorab lesen)

- Kein Shell-Werkzeug in diesem Lauf. Die vier Hashes sind aus dem Auftrag abgeschrieben, nicht nachgerechnet; das Gate vergleicht sie mit dem Endstand.
- `git diff main` konnte ich nicht ausführen. Geprüft ist der heutige Stand der Dateien gegen Plan und Regeln, nicht der Unterschied zum Vorzustand. Was vorher dastand, kenne ich nur aus den roten Logs (001, 005 bis 007), den Kommentaren und `docs/OFFEN.md`. Die Frage „wurde eine Erwartung gelöscht oder abgeschwächt“ kann ich deshalb nur für das beantworten, was heute in den Testdateien steht (siehe Prüffrage 4).
- `npm run check:deno` steht nicht in `tmp/proof/fh1/runs.jsonl`; den genannten Lauf (EXIT 0) kann ich nicht belegen. Die Typen habe ich gelesen, nicht kompiliert. Der Volllauf `check` über das Start-Programm enthält `check:deno` (`package.json:51`) und muss es auf dem Endstand zeigen.
- Ob der Deploy vom selben Dateistand stammt wie die Hashes oben, ist aus `deploy.log` nicht ablesbar (kein Zeitstempel, keine Datei-Hashes). Wurde eine der vier Dateien nach dem Deploy noch geändert, braucht es einen neuen Deploy.

## Findings

### Hoch
Keine.

### Mittel
Keine.

### Niedrig

- N1 · `scripts/setup-photo-publish.mjs:43` und `:55` – Kommentar und Fehlermeldung des Probeaufrufs nennen weiter „503: PUBLISH_SECRET fehlt“. Seit fh1 gibt es bei `photo-publish` kein 503 mehr; ein fehlendes Function-Secret und ein abweichendes ergeben beide 401 (`photo/handlers.ts:50`). Die Datei ist nicht Teil des Diffs, also eine übersehene Stelle. Keine Sicherheitswirkung, aber die Diagnose für Beks führt in die falsche Richtung. – Fix: Text auf „401: Function-Secret fehlt oder weicht vom Vault-Wert ab“ stellen; 503 streichen.
- N2 · `docs/GOLIVE.md:69` – „Ohne sie antwortet `outbox-send` mit 503“ stimmt nur noch für den berechtigten Aufruf ohne SMTP, Absender oder App-URL. Ohne `OUTBOX_SECRET` antwortet jeder Aufruf mit 401 (`jobs/handlers.ts:283`). Widerspruch zwischen Dokument und Code. – Fix: Satz anpassen (ohne Secret 401, mit Secret und ohne Versand 503, Zeilen bleiben `pending`); passt zu OFFEN fh1-3.
- N3 · `supabase/functions/photo-publish/index.ts:3` – „die Fotos bleiben `pending`, die Verteilung wartet“ gilt nur, wenn auch die Vault-Werte fehlen (dann bricht `photo_publish_dispatch` vor dem Claim ab, `0035:228-230`). Fehlt nur das Function-Secret, zählt jeder Cron-Lauf einen Versuch, die Function antwortet 401, und nach drei Versuchen steht das Foto auf `failed` mit `attempts_exhausted` (`0035:193-195`); die Anfrage wird dann ohne Fotos verteilt, ohne Mail. Das Verhalten ist Bestand (vor fh1 mit 503 genauso) und durch den Probeaufruf im Setup-Skript und die Runbook-Abfrage (OFFEN S9d-2) abgedeckt; ungenau ist nur der Kommentar. – Fix: bei der nächsten Änderung der Datei richtigstellen. Jetzt nicht, weil jede Änderung an einer Pflichtdatei eine neue Runde und einen Deploy kostet.
- N4 · `tests/rls/replay-rest.test.ts:117` und `:210` gegen `tmp/proof/fh1/007-…log:22,38` – Der Rot-Beweis misst nur zwei der fünf Funktionen. Jeder der zwei Tests bricht an der ersten falschen Erwartung ab: `withdraw` (Zeile 117) und `withdraw_offer` (damals Zeile 209). Die Wiederholungen von `start_job`, `complete_job` (beide Zweige) und `withdraw_change` wurden vor dem Push nie ausgewertet; für sie gibt es nur den grünen Lauf 010 und den Rumpfvergleich aus der DB-Freigabe. Das Gate verlangt je neuer Datei einen roten Lauf, der liegt vor. – Fix: keiner für diesen Schritt. Künftig je Funktion ein eigener `it` oder `expect.soft`, damit ein roter Lauf alle Wiederholungen zeigt.
- N5 · `tests/unit/outbox-handler.test.ts:28-55` – Für die zwei neuen Fälle „Zugang vor Konfiguration“ gibt es keinen roten Lauf (003 ist nur grün), und der Live-Fall in `tests/rls/auth-token-codes.test.ts:71-82` lief nur nach dem Deploy (011). Durch Lesen geprüft: Die Erwartungen messen die Reihenfolge wirklich. Stünde die 503-Prüfung vor der Secret-Prüfung, schlüge Zeile 35 fehl (503 statt 401); fehlte der Schutz gegen ein leeres Secret, schlüge Zeile 51 fehl (200 statt 401); liefe `claim` vor der 503-Antwort, schlüge Zeile 41 fehl. Kein Pflichtnachweis laut `tests.md` (kein neuer RLS-Test). – Fix: keiner nötig.
- N6 · `tests/rls/auth-token-codes.test.ts:72-82` – Der Live-Fall belegt die Umstellung nur für `outbox-send`. Dort fehlt auf Dev das Function-Secret (OFFEN S9c-3), „ohne Header“ ist also genau der Fall leeres Secret gegen leeren Wert, und 401 zeigt den neuen Stand. Bei `photo-publish` war „ohne Header“ und „falscher Header“ schon vorher 401; dass dort die neue Fassung läuft, belegt nur die Versionsliste in `deploy.log:4`. Das Log-Verhalten bei einer Auth-Störung (`photo/handlers.ts:19-22`) ist live nicht erzeugbar und nur im Unit-Test belegt. – Fix: keiner; als Grenze im Bericht nennen.
- N7 · `supabase/functions/outbox-send/index.ts:17` und `photo-publish/index.ts:16` – `SUPABASE_URL` und `SECRET_KEY` werden beim Start des Moduls verlangt, vor jeder Prüfung des Aufrufers. Fehlt eines, scheitert der Start und die Plattform antwortet jedem Aufrufer mit ihrem eigenen Fehler. Das verrät „Function defekt“, nicht den Stand des Mailversands, und ist Bestand. – Fix: keiner.
- N8 · `supabase/functions/_shared/jobs/handlers.ts:285` – `!deps.appUrl` prüft dasselbe wie `outbox-send/index.ts:29` (dort ist `send` ohne App-URL schon `null`). Doppelt, harmlos; der Unit-Test Zeile 45-47 hängt daran. – Fix: keiner.

## Prüffragen

### (1) Kann ein Aufruf ohne gültiges Secret etwas auslösen oder erfahren?
Nein, nach dem gelesenen Stand.

`outbox-send` (`jobs/handlers.ts:280-285`): Reihenfolge ist Methode (405), dann Aufrufer (401), dann Konfiguration (503), dann `claim` (Zeile 297). Die Bedingung in Zeile 283 lehnt zuerst ein leeres Secret der Umgebung ab und vergleicht erst danach. Leeres `OUTBOX_SECRET` mit leerem oder fehlendem Header ergibt 401; der Vergleich zweier leerer Werte wird nie erreicht. 503 `mail_not_configured` sieht nur, wer das richtige Secret hat. Bis dahin wird kein Body gelesen, keine Zeile geclaimt, nichts markiert. `index.ts:27-29` reicht ein fehlendes Secret als leeren Text und fehlenden Versand als `null` durch; es gibt dort keine eigene Antwort mehr vor dem Handler.

`photo-publish` (`photo/handlers.ts:48-50`): Methode (405), dann dieselbe Prüfung (401), erst danach Body und `begin`. Kein 503 mehr. `index.ts:18` reicht ein fehlendes Secret als leeren Text durch.

Die 401-Antwort ist in allen Fällen gleich (`unauthorized`, gleiche Kopfzeilen): fehlendes Secret, falscher Header, fehlender Header, leerer Header sind von außen nicht zu unterscheiden. 405 kommt vor 401, hängt aber nicht von der Konfiguration ab.

Zwei Reste, beide ohne praktische Wirkung:
- Bei leerem Secret entfällt das Hashen (Kurzschluss in Zeile 283 bzw. 50). Der Unterschied liegt im Mikrosekundenbereich, weit unter dem Netzrauschen. Kein Fund.
- Startfehler des Moduls (N7).

Die Functions laufen mit `verify_jwt = false` (`supabase/config.toml:436-440`); das Gateway hält niemanden ab, der Handler ist die einzige Sperre. Der Live-Lauf 011 bestätigt 401 für beide Functions ohne und mit falschem Header.

### (2) Loggt eine der drei Foto-Functions bei `AuthServiceError` Token, Nutzer-ID oder Originalmeldung?
Nein. `fail` (`photo/handlers.ts:19-22`) loggt nur `event` und `e.message`. Die Meldung baut allein der Konstruktor (`auth.ts:23`): fester Text, Status nur als Ganzzahl, Code nur, wenn er aus höchstens 40 Kleinbuchstaben und Unterstrichen besteht, sonst ein Strich. Geworfen wird der Fehler nur in `rejectToken` (`auth.ts:31`) mit Status und Code der Auth-Antwort; Token und Nutzer-ID kommen dort nicht vor. Die Antwort an den Aufrufer ist 500 `internal` ohne Einzelheiten.

Wirft `auth.getUser` etwas anderes (Netzfehler als gewöhnlicher Fehler), greift der allgemeine Zweig (`photo/handlers.ts:24`): geloggt wird die Meldung nur, wenn sie ein kurzer Bezeichner ist, sonst `internal`.

`photo-receipt`, `job-photo` und `admin-photo` gehen alle über `authed` und `fail` (Zeilen 102/119, 139/150, 168/174). Der Unit-Test verlangt je Handler exakt eine Logzeile mit genau zwei Feldern (`photo-handlers.test.ts:261`); ein zusätzliches Feld mit Nutzer-ID würde ihn brechen.

### (3) Typänderung `send: … | null`
Keine übersehene Stelle gefunden. Suche über `supabase/functions`, `tests`, `scripts`, `src`:
- Typ: `jobs/handlers.ts:233`. Verwendung: `:284-285` (lokale Konstante, nach der Prüfung nicht mehr `null`), Aufruf `:302`.
- Einziger Erzeuger im Produktcode: `outbox-send/index.ts:29`. `outboxDb` liefert `send` nicht (`jobs/db.ts:107`).
- Tests: `accept.test.ts:155`, `:179`; `photo-handlers.test.ts:289`; `outbox-handler.test.ts:20`, `:31` (`null`), `:75`, `:98`, `:119`, `:125`, `:133`. Alle übergeben eine Funktion oder `null`.

`accept.test.ts` ist unverändert und grün (004): das bisherige Verhalten des Versands ist erhalten. Den Compiler-Lauf selbst habe ich nicht (siehe Grenzen).

### (4) Passen die Tests auf das Verhalten? Wurde etwas abgeschwächt?
Die heutigen Tests passen und sind streng:
- `photo-handlers.test.ts:61-75`: ohne Secret in der Umgebung 401 für richtigen Wert, leeren Header und fehlenden Header, mit Prüfung des Antworttexts und dass kein Schritt lief; mit Secret weiter 401 für falsch und fehlend. Die Umstellung 503 → 401 ist die Vorgabe u5-1 und eine Verschärfung (vorher erfuhr jeder Aufrufer den Einrichtungsstand). Der Fall leerer Header ist neu.
- `photo-handlers.test.ts:249-277`: je Handler 500, `internal`, exakt die feste Logzeile.
- `outbox-handler.test.ts:28-55`: siehe N5.
- `replay-rest.test.ts`: je Funktion erste Wirkung, Wiederholung, Zähler (Ereignis, Audit, Outbox, Zuordnung, Angebote), fremde Partei, anderes Mitglied, aal1, anderer Weg zum Zustand. Deckt sich mit der Migration (`0069:30-34`, `:59-63`, `:84-87`, `:93-98`, `:126-127`, `:150-154`).

Rot-Beweise:
- 001 (EXIT 1): 503 statt 401 bei fehlendem Secret und `internal` statt des festen Texts. Beides sind Ist-Werte des alten Verhaltens, nicht bloß ein Abbruch. Gültig. Danach 002 grün (19 von 19).
- 005 bis 007 (EXIT 1): `invalid_transition` statt Erfolg bei der Wiederholung von `withdraw` und `withdraw_offer`. Gültig, aber nur für diese zwei (N4).
- 008 und 009 (nach dem Push, EXIT 1): Fehler im Testaufbau, nicht in der Migration. 008: die Firma konnte die Id der Nachtragsrevision nicht lesen (`not_found` beim ersten Rückzug, Zeile 220); 009: Zugriff auf eine Hilfsfunktion vor ihrer Definition. Behoben im Aufbau (`replay-rest.test.ts:166-169`, Id als Einstellung im Setup). Die Erwartungen für den Nachtrag stehen unverändert streng da (`:221-230`: Erfolg, Status, genau ein Audit, genau eine Outbox-Zeile, Fremde und anderes Mitglied mit Fehler). Der Hash der Migration ist in Antrag, Freigabe und beiden Push-Marken derselbe (`runs.jsonl:8-9`), sie wurde zwischen Rot und Grün nicht geändert.
- 010, 011 grün (EXIT 0).

Abschwächung: In den heutigen Dateien finde ich keine Erwartung, die schwächer ist als das Verhalten verlangt. Ob gegenüber `main` eine Erwartung entfernt wurde, kann ich ohne Diff nicht ausschließen. Indizien dagegen: 001 lief mit den neuen Tests gegen den alten Code und zeigte genau die zwei erwarteten Fehler bei 17 bestandenen; `accept.test.ts` ist unverändert. Wer es sicher haben will, zählt im Diff der drei geänderten Testdateien die entfernten `expect`-Zeilen; außer der 503-Zeile bei `photo-publish` darf keine fehlen.

### (5) Deploy-Menge gegen Importgraph
Stimmt. Geändert sind `_shared/jobs/handlers.ts` und `_shared/photo/handlers.ts` sowie zwei `index.ts`. Importeure, selbst nachgeschlagen:
- direkt `jobs/handlers.ts`: `accept`, `admin-contact`, `offer-confirm`, `outbox-send`.
- über `_shared/account` (`handlers.ts:4`, `db.ts:3`): `delete-account`.
- über `_shared/admin` (`correct.ts:6`, `db.ts:5`): `admin-correct`.
- über `_shared/cancel` (`handlers.ts:6`, `partner.ts:7`, `db.ts:5`): `cancel-customer`, `cancel-partner`.
- über `_shared/change` (`handlers.ts:22`, `db.ts:5`): `change-propose`, `change-decide`.
- über `_shared/photo` (`handlers.ts:7`, `db.ts:4`): `photo-publish`, `photo-receipt`, `job-photo`, `admin-photo`.

Das sind 14, genau die Liste in `deploy.log:2`. Nicht betroffen: `photo-cleanup` (importiert nur die Typen der Datenbank, `index.ts:5-6`), `quote` und `route` (nur `_shared/route`, `_shared/quote`; keine Datei dort importiert aus `jobs`, `photo`, `account`, `admin`, `cancel` oder `change`). Die Migration 0069 ändert keine Basis einer Function (keine ruft die fünf RPCs auf), daraus folgt kein weiterer Deploy.

## Geld, Sicherheit, Schema im Überblick
- Geld: Kein Betrag, keine Rundung, kein Gebührenweg geändert. `splitFee` bleibt die einzige Rechenstelle in `accept` und `offer-confirm` (`jobs/handlers.ts:105`, `:167`). Mailtexte ohne Gebühr; die Tests prüfen das weiter (`outbox-handler.test.ts:101`, `:124`, `:138`).
- Sicherheit: keine Rechte-Ausweitung, kein Secret im Code oder Log, Akteur je Übergang unverändert aus `auth.uid()`. Logs der Outbox weiter nur mit festen Codes.
- Schema: 0069 unverändert gegenüber der Freigabe (gleicher Hash in `runs.jsonl:8-9` und `db-freigabe-1.md:9`); Urteil der Freigabe gilt weiter. Deren niedrige Funde stehen in OFFEN fh1-2.

## Stichproben
- `jobs/handlers.ts:281-285` – 405, 401, 503 in dieser Reihenfolge; `claim` erst `:297`. Passt zum Plan.
- `jobs/handlers.ts:262-268` – Vergleich über SHA-256 beider Werte, feste Länge. In Ordnung.
- `photo/handlers.ts:48-50` – Secret-Prüfung vor dem Lesen des Bodys (`:52`). In Ordnung.
- `photo/handlers.ts:13-26` – Reihenfolge DbError, HttpError, AuthServiceError, sonst fester Code. In Ordnung.
- `auth.ts:18-32` – Meldung nur aus Status und gefiltertem Code. In Ordnung.
- `outbox-send/index.ts:18-29` – fehlender Versand ergibt `null`, keine frühe Antwort. In Ordnung.
- `photo-publish/index.ts:18` – fehlendes Secret als leerer Text. In Ordnung; Kommentar Zeile 3 ungenau (N3).
- `jobs/db.ts:18-28` – `getUser` gibt Fehler nur über `rejectToken` weiter. In Ordnung.
- `0036_outbox_harden.sql:58-72` – `outbox_dispatch` sendet nur mit beiden Vault-Werten; bei 503 bleibt die Zeile `pending` mit unverändertem Zähler, weil `outbox_claim` nicht lief. In Ordnung.
- `0035_job_photos.sql:171-238` – Claim zählt den Versuch vor dem Aufruf; Quelle für N3.
- `scripts/setup-photo-publish.mjs:43`, `:55` – überholter Hinweis auf 503 (N1).
- `docs/GOLIVE.md:69` – überholter Satz zu 503 (N2).
- `docs/ARCHITECTURE.md:156`, `:158` – nennen keinen Status für die zwei Functions; kein Widerspruch.
- `docs/OFFEN.md:59` (fh1-3), `:83` (n12-2), `:84` (fh1-2), `:88` (n12b-1, M2 erledigt) – decken sich mit dem Stand.
- `tests/unit/accept.test.ts:161-170` – unverändert, verlangt weiter 401 ohne und mit falschem Secret. Grün in 004.
- `tmp/proof/fh1/001-…log:22`, `:48-49` – Ist-Werte 503 und `internal`. Gültiger Rot-Beweis.
- `tmp/proof/fh1/007-…log:22`, `:38` – `invalid_transition` statt Erfolg. Gültig für zwei Funktionen (N4).
- `tmp/proof/fh1/008-…log:22-30`, `009-…log:22-26` – Fehler im Testaufbau, siehe Prüffrage 4.
- `tmp/proof/fh1/runs.jsonl:8-9` – Hash der Migration gleich dem der Freigabe.
- `tmp/proof/fh1/deploy.log:2-4` – 14 Functions, deckt sich mit dem Importgraphen; 17 aktiv, `verify_jwt` aus wie `config.toml:418-467`.

Offene Findings hoch: 0
