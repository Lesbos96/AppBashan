Modell: claude-fable-5-2

# Abnahme Schritt s9k-1 (R3): Meldung „nicht stattgefunden“ als Zustandsablauf, getUser nur bei abgelehntem Token

Datum: 2026-11-15
Stand laut Auftrag: Commit d625e4a (Branch s9k-1)
Umfang: Geld, Sicherheit, Schema. Die Optik hat der reviewer abgenommen und ist hier nicht geprüft.
Grundlagen: `tmp/proof/s9k-1/plan.md` (Z0 bis Z5, H1, M1 bis M3), `tmp/proof/s9k-1/db-freigabe-1.md`, `.claude/rules/geld.md`, `.claude/rules/daten.md`, `.claude/rules/tests.md`.

SHA256: d6c00a32bd9e2366e105e6d4db698bd214b60221e43ab7ffd9766b344cc3627a supabase/functions/_shared/auth.ts
SHA256: 166bc7c18f8d94f6a5fa8aa8db912c519ab16de9f86d9bf73911525753c25687 supabase/functions/_shared/jobs/db.ts
SHA256: a86ba371fb374085323da85c71c6fafe7f040059087a00db3883fbe2142c1200 supabase/functions/_shared/quote/db.ts
SHA256: 18211246b04fc497c8376590e54340f039ce96852ba7737d0e581527d792aa37 supabase/functions/_shared/database.types.ts
SHA256: 77b5c8bbb00c3d57e04034de65230100ffab2c9d60cdb60eb22944d13a6fb673 tests/support/positiv.ts
SHA256: f39adf622a4250ea766b60718cd0a8a0a22d30c8715d7149aad9b8c78c162f36 scripts/sys/loesch-register.json
SHA256: d47f3e4c97433d1d6a1b08a04593be33a57881f74960c5b8a2f2ea8bc7a886c4 supabase/migrations/20261115104122_0064_report_flow.sql

Ergebnis: abgenommen, keine hohen und keine mittleren Findings. Sechs niedrige Punkte, zwei davon sind Bedingungen, die die Hauptsession vor `npm run fertig` selbst belegen muss (N5, N6).

## Grenzen der Prüfung

- Die Hashes sind aus dem Auftrag abgeschrieben. Ich habe kein Werkzeug, um SHA-256 zu berechnen oder `git` aufzurufen. Den Abgleich mit dem Endstand macht das Gate. Dass ich dieselben Dateien gelesen habe, stütze ich auf drei Übereinstimmungen: Der Hash der Migration ist in Auftrag, DB-Freigabe (`db-freigabe-1.md:8`) und den Push-Marken (`runs.jsonl:5-6`) derselbe; der Hash von `positiv.ts` im Auftrag ist derselbe wie der gepinnte Wert in `scripts/sys/loesch-register.json:30`; der Inhalt der Migration ist Zeile für Zeile der, den die DB-Freigabe beschreibt (Stichproben unten).
- „Nur der Hash von positiv.ts geändert“ im Lösch-Register und „zwischen 5227c7e und d625e4a nur Testdateien geändert“ kann ich ohne Diff nicht bestätigen. Ich habe den Endstand gelesen, nicht die Differenz (siehe N5).
- Die Edge Functions habe ich gelesen, nicht ausgeführt. Dass eine Störung des Auth-Dienstes live zu 500 führt, ist nur im Unit-Test gemessen (ein Ausfall lässt sich gegen Dev nicht herbeiführen).
- Logs habe ich nach Kopfzeilen, Fehlern und Exit-Codes durchsucht, nicht ganz gelesen.
- Welche Fehlerobjekte die Auth-Bibliothek in welchem Fall liefert, habe ich aus Kenntnis der Bibliothek beurteilt, nicht im Quelltext der installierten Version nachgeschlagen.

## Findings

### hoch
Keine.

### mittel
Keine.

### niedrig

- N1 `supabase/functions/_shared/auth.ts:5` – Die Unterscheidung läuft nur über den HTTP-Status. Ein 401 oder 403, das nicht das Nutzer-Token meint, sondern den Schlüssel der Function (falsch gesetzter oder rotierter Secret Key, Antwort des Gateways vor dem Auth-Dienst), wird ebenfalls zu `null` und damit zu 401; die App meldet dann alle Nutzer ab und leert Entwürfe. Das ist ein Betriebsfehler, kein Angriffsweg, und vor s9k-1 war es genauso (jeder Fehler war 401). Die Annahme zur Antwort des Gateways ist nicht gemessen. – Fix (später, Zeile in `docs/OFFEN.md`): `null` nur, wenn der Fehler zusätzlich einen Fehlercode des Auth-Dienstes trägt, der ein Token ablehnt; ein 401 ohne solchen Code werfen. Vorher an Dev messen, welche Codes ein abgelaufenes, ein gefälschtes und ein Token nach dem Löschen liefern.
- N2 `supabase/functions/_shared/jobs/handlers.ts:120, 174, 203`, `account/handlers.ts:29`, `change/handlers.ts:133, 209`, `cancel/handlers.ts:74`, `cancel/partner.ts:88`, `admin/correct.ts:93` – Der neu geworfene Auth-Fehler landet im allgemeinen Zweig, der die ersten 200 Zeichen der Fehlermeldung ins Log schreibt. Der Text stammt jetzt vom Auth-Dienst oder vom Netzaufruf. Nach meiner Lesart enthält er weder Token noch Nutzer-ID (das Token steht nur im Kopf der Anfrage, die Nutzer-ID ist im Fehlerfall nicht bekannt), höchstens die Adresse des Projekts. Belegt ist das nicht durch einen Test: `tests/unit/auth-token.test.ts:46, 52` sammelt die Logzeilen, prüft sie aber nicht. `photo/handlers.ts:18` und `quote/handler.ts:261-262` schreiben dagegen nur feste Codes bzw. den Namen der Fehlerklasse. – Fix: in `rejectToken` einen eigenen Fehler mit festem Code (zum Beispiel `auth_unavailable`, dazu der Status) werfen statt des Originals, und im Unit-Test prüfen, dass die Logzeile das Token nicht enthält.
- N3 `supabase/migrations/20261115104122_0064_report_flow.sql:62-63` mit `tests/support/positiv.ts:234-238` – `my_report_info` hat EXECUTE auch für `service_role` (Vorgabe-Rechte des Schemas public; der Entzug nennt nur public und anon). Das Register hält den Ist-Zustand fest (Ausführung für authenticated und service_role), die Gruppe N15 wächst damit von elf auf zwölf Funktionen. Vertretbar, siehe Prüffrage 3. Steht schon in `docs/OFFEN.md:79` (s9k1-3); die Zeile nennt diese Abnahme als Quelle, ich bestätige den Punkt hiermit. – Fix: im Entzugsschritt für N15 mitnehmen, wie in OFFEN vorgesehen.
- N4 `tests/unit/auth-token.test.ts:44-58` – Der Handler-Nachweis „500 statt 401“ läuft nur über `handleDeleteAccount`. Die übrigen zwölf Wege sind durch Lesen geprüft (Prüffrage 2), nicht durch einen Test; zwei davon gehen nicht über `authed` und haben eigenen Code (`photo/handlers.ts:132-134`, `quote/handler.ts:214-215`). Verschiebt jemand später einen `authed`-Aufruf vor das `try`, merkt es kein Test. – Fix: eine Tabelle über alle Handler mit werfendem `getUser` bzw. `getUserId`, Erwartung 500 und Antworttext `internal`, mindestens für `handleJobPhoto` und `handleQuote`.
- N5 `tmp/proof/s9k-1/deploy-1.log:1` – Deployt wurde von 5227c7e, der Endstand ist d625e4a. Das ist in Ordnung, wenn d625e4a nichts unter `supabase/functions/` ändert (laut Commit-Text nur flow-live). Ich kann das nicht selbst prüfen. – Fix: Die Hauptsession belegt mit einem Diff der beiden Commits für `supabase/functions/`, dass er leer ist, und nennt das im Bericht. Ist er nicht leer: neu deployen und flow-live wiederholen.
- N6 `tmp/proof/s9k-1/runs.jsonl:23` (Lauf 22) – Der grüne flow-live-Lauf mit W6 und W7 lief auf 5227c7e mit unsauberem Arbeitsbaum (die Testdatei selbst war noch nicht committet). Kein Lauf in `runs.jsonl` trägt den Endstand d625e4a. Als Nachweis des Verhaltens der deployten Functions taugt Lauf 22; „grün“ im Sinn von `.claude/rules/tests.md` (sauberer Baum, Fingerabdruck des Endstands) ist er nicht. – Fix: die Volläufe am Ende (check, rls, e2e) auf dem committeten Endstand, wie es der Ablauf ohnehin verlangt; das Gate prüft es.

Betriebshinweis (kein Finding, steht in `docs/BEKS.md:22-24` und OFFEN): Z2 und Z4 enden nur durch admin. Mit M1 wartet auch die Kontolöschung darauf.

## Prüffragen

### 1. Migration unverändert gegenüber der Freigabe
Ja, soweit ohne Hash-Werkzeug feststellbar. Der Hash im Auftrag ist derselbe wie in `db-freigabe-1.md:8` und in beiden Push-Marken (`runs.jsonl:5` Start, `:6` Push). Der gelesene Inhalt (335 Zeilen) stimmt mit den Zeilenangaben der Freigabe überein: `report_gate` 7-20, Entzug 22, `report_not_done` 25-43, `my_report_info` 46-63, `start_job` Zeile 83, `complete_job` Zeile 111, `my_jobs` 122-172 (Spalte 141, 156-157), `change_gate` Zeile 196, `decide_change` Zeile 241, `delete_account` 291-296. Den verbindlichen Abgleich macht das Gate über die SHA256-Zeile oben.

### 2. Edge: abgelehntes Token gegen Störung
- `rejectToken` (`_shared/auth.ts:4-7`): Status 400, 401, 403 ergibt `null`, alles andere (auch fehlender Status und 0) wirft das Original. Entspricht H1. Die Prüfung „ist ein Auth-Fehler“ aus H1 fehlt als eigene Zeile; sie ist entbehrlich, weil die Bibliothek nur Auth-Fehler im Fehlerfeld zurückgibt und alles andere selbst wirft (landet dann ebenfalls im `catch` der Handler).
- `getUser` (`_shared/jobs/db.ts:17-27`) und `getUserId` (`_shared/quote/db.ts:28-31`) nutzen beide dieselbe Funktion. Es gibt keinen dritten Aufruf der Token-Prüfung (Suche über `supabase/functions`: nur diese zwei Stellen; `jobs/db.ts:122` ist das Nachschlagen der Kundenadresse im Mailversand, kein Token).
- Jeder Aufrufer übersetzt den geworfenen Fehler in 500 mit dem Antworttext `internal`, nirgends entsteht 401 oder 200:
  - `authed` (`jobs/handlers.ts:53-59`) fängt nichts, der Fehler läuft durch. Alle zehn `authed`-Aufrufe stehen in einem `try`: `jobs/handlers.ts:90, 144, 193`; `account/handlers.ts:19`; `change/handlers.ts:92, 171`; `cancel/handlers.ts:37`; `cancel/partner.ts:42`; `photo/handlers.ts:96, 161`; `admin/correct.ts:52`.
  - Die `catch`-Blöcke lesen den Code nur aus `DbError` (bzw. `ChangeError`); ein Auth-Fehler ist keines von beiden, der Code ist leer, die Statustabelle liefert nichts, es folgt 500 `internal` (`jobs/handlers.ts:116-122, 168-176, 199-205`; `account/handlers.ts:25-31`; `change/handlers.ts:124-135, 205-211`; `cancel/handlers.ts:70-76`; `cancel/partner.ts:84-90`; `admin/correct.ts:89-95`). Die Wiederholschleifen (`RETRY_CODES`) liegen hinter `authed` und greifen nicht.
  - `handleJobPhoto` ruft `getUser` selbst auf, innerhalb des `try` (`photo/handlers.ts:131-134`); `fail` (`:12-20`) antwortet 500 `internal` und schreibt nur den festen Code `internal` ins Log.
  - `handleQuote` ruft `getUserId` innerhalb des `try` auf (`quote/handler.ts:210-215`). Der Fehler ist weder `HttpError` noch `Conflict`, `InputError`, `TariffError`; der Code eines Auth-Fehlers passt nicht auf das Muster der Datenbankcodes und ist nicht `P0001`; Ergebnis 500 `internal` (`:257-262`).
- Log: kein Token und keine Nutzer-ID an den festen Stellen. `quote` schreibt Modus, Status, Dauer und `internal:` mit dem Namen der Fehlerklasse (`quote/handler.ts:206, 261-262`), die Foto-Wege den Code `internal`. Die übrigen neun Handler schreiben die gekürzte Fehlermeldung des Auth-Dienstes; siehe N2 (niedrig, nicht gemessen).
- Antworten enthalten in keinem Fall Details des Fehlers.

### 3. Tests als Nachweis
- Rot-Beweis `tests/rls/report-flow.test.ts`: Läufe 1 und 2 vor dem Push (10:40 UTC, Push 10:49 UTC, `runs.jsonl:1-2, 5-6`), beide Exit 1. Lauf 2 misst die Wirkung der fehlenden Sperre: Ist-Wert `ok` beim Abschluss durch die Firma in Z2 (`002-…log:22`), und beim Löschen kam `open_requests` statt `under_review` (`002-…log:42`). Das ist ein Rot-Beweis im Sinn der Regel (Aufruf erfolgreich), nicht nur ein fehlgeschlagener Schritt. Nach dem Push: Lauf 5 rot wegen einer falschen Erwartung im Test selbst (`005-…log:22`, Start-Signal einer Kontrollzeile), Lauf 6 grün (2 von 2).
- Inhalt der Datei: Sperren in Z2 für Start, Abschluss, Nachtrag stellen und annehmen, Ablehnen bleibt möglich (`report-flow.test.ts:69-77, 98-106`), je mit Kontrolle ohne Meldung (`:73-74, 102-103`) und unverändertem Status (`:70, 72`); `my_report_info` in allen Zuständen (`:78-87, 107-116`), fremder Kunde, Firma, anon (`:88-90, 117-119`); N2 der DB-Freigabe ist umgesetzt (`:91, 120`). Die Probe misst wirklich das Ausführungsrecht der privaten Funktion: authenticated hat SELECT auf die ganze Tabelle (`0001_foundation.sql:302`) und Nutzung des Schemas, der Fehler 42501 kann also nur von der Funktion kommen. M1 mit Z2, Z4, entschiedener Meldung und Z3 ohne Meldung (`:128-149`).
- `tests/unit/auth-token.test.ts`: Lauf 3 rot mit Ist-Werten (`null` statt Wurf, 401 statt 500; `003-…log:24, 45, 66`), Lauf 4 grün (5 von 5). Fälle: 401, 403, 400 nach gelöschter Sitzung gegen 500, 429, 503, Netz (Status 0) und unbekannt (`:11-22`), für beide Funktionen. Lücke siehe N4.
- `tests/rls/flow-live.test.ts` W6, W7 (`:391-430`): gegen die deployten Functions, Lauf 22 Exit 0, 19 von 19. W6 belegt 409 `under_review` aus `change-propose` über die Function (`:407`), die Sperre von `complete_job` (`:406`), das Boolean in `my_jobs` (`:408`) und dass sich am Auftrag nichts ändert (`:409`). W7 belegt Z3 nach Z4 (`:413-424`) und `not_found` für beide Firmen (`:426-429`). Die neuen Aufträge sind aus der Journal-Erwartung herausgenommen (`:386-387`), die Summenprüfung für W1 bis W5 bleibt unberührt. Zum Stand des Laufs siehe N6.
- `tests/support/positiv.ts`, `my_report_info` mit Ausführung für authenticated und service_role: vertretbar. Gründe: (a) Das Register beschreibt den Ist-Zustand, und der Katalogtest schlägt an, wenn Register und Datenbank abweichen (Lauf 7 rot genau dort, `007-…log:62-63`, Lauf 8 grün); ein geschönter Eintrag wäre falsch. (b) service_role hat keine Nutzer-ID, die Funktion endet in `not_found` (`0064:54`); service_role liest die Tabelle ohnehin an RLS vorbei, es entsteht also kein neuer Lesezugriff. (c) Keine Edge Function ruft `my_report_info` oder `my_jobs` auf (Suche über `supabase/functions` ohne Treffer), der spätere Entzug bricht nichts. (d) Der Punkt ist als s9k1-3 in `docs/OFFEN.md:79` an N15 gebunden. `my_jobs` hatte dieselben Rechte schon in 0057; neu ist dort nur die Spalte (`positiv.ts:226-233`).
- `scripts/sys/loesch-register.json:30`: der gepinnte Hash von `positiv.ts` ist der Wert aus dem Auftrag. Der Grund des Eintrags gilt weiter: die neuen Registerzeilen sind ein lesender Aufruf und eine Spaltenliste. Dass sonst nichts im Register geändert wurde, habe ich nicht per Diff geprüft (Grenzen). Der bekannte Punkt N21 (Wortlaut des Grundes) aus `docs/OFFEN.md:135` ist bei dieser Änderung des Eintrags nicht mit erledigt worden; er bleibt dort offen, kein neues Finding.

### 4. Deploy
- Die Liste ist vollständig. Importe der 17 `index.ts` unter `supabase/functions/`:
  - mit Aufrufweg zu `getUser`: accept, offer-confirm, admin-contact (`jobs/db.ts`), change-propose, change-decide (`change/db.ts`), cancel-customer, cancel-partner (`cancel/db.ts`), admin-correct (`admin/db.ts`), delete-account (`account/db.ts`), photo-receipt, job-photo, admin-photo (`photo/db.ts`);
  - mit `getUserId`: quote (`quote/db.ts`).
  Das sind die 13 deployten Functions (`deploy-1.log:3-29`, alle Exit 0).
  - Nicht deployt und richtig so: route und photo-cleanup importieren keins der geänderten Module. outbox-send (`jobs/db.ts`, nur `outboxDb`) und photo-publish (`photo/db.ts`, nur `publishDb`) binden das geänderte Modul ein, prüfen aber kein Nutzer-Token (geheimer Kopf, `jobs/handlers.ts:267-268`, `photo/handlers.ts:43-44`); ihr Verhalten ist unverändert.
- Ziel ist Dev: die Ref im Log ist die aus `scripts/dev-ref.mjs:2`. Das Log enthält keine Schlüssel.
- Smoke ohne Token 13 mal 401 (`deploy-1.log:31-43`), danach flow-live grün (Lauf 22). Die Regel „Functions im selben Schritt neu deployen“ aus `daten.md` ist erfüllt. Offen: N5 (Stand des Deploys gegen den Endstand).

### 5. Datenschutz und Geld
- Firma: `my_jobs` trägt neu nur das Boolean `under_review` (`0064:141, 157`; Typen `database.types.ts:1849`), keinen Zeitpunkt, keinen Text, keine Kundendaten. Geldspalten wie bisher nur Gesamt und Auszahlung der eigenen Firma (`0064:138-139, 161-165`). Die App liest genau dieses Boolean (`src/lib/partnerJobs.ts:256, 272`).
- Kunde: `my_report_info` liefert zwei Spalten, „melden möglich“ und Fristende (`0064:46, 58`; `database.types.ts:1852-1858`), kein Betrag. Die App liest nur diese zwei Werte (`src/lib/jobs.ts:191-198`). Die Frist selbst (`completion_days`) wird nicht herausgegeben, nur der Zeitpunkt.
- Keine neue Gebührensicht: keine Tabellenrechte, keine Policy, keine Spalte geändert; `decide_change` gibt weiter nur den Ergebnistext zurück. Der neue Fehlercode `under_review` (409) verrät weder Satz noch Betrag. Kein Rechenweg des Geldes ist berührt (`splitFee`, `splitChange` unverändert im Aufruf, `jobs/handlers.ts:100, 153`, `change/handlers.ts:190`).
- Kundentexte zu `under_review` ohne Gebührenbegriff (`src/lib/jobs.ts:68`, `src/lib/account.ts:14`, `src/lib/cancel.ts:21`).

### Weitere Prüfung gegen den Plan
- Akteur je Übergang: Start und Abschluss durch die Firma nur mit aktiver Zuordnung und aal2, Meldung nur durch den Eigentümer; die Sperre in Z2 steht nach der Zuordnungsprüfung, fremde Firmen erfahren nichts über die Meldung (`0064:80-83, 108-111`).
- Nebenläufigkeit Meldung gegen Abschluss: beide sperren die Auftragszeile (`0064:34, 100`). Gewinnt die Meldung, sieht der Abschluss sie nach dem Warten und bricht ab; gewinnt der Abschluss, bleibt die Meldung im Fenster möglich (Z3 nach Z4). Kein Zustand außerhalb der Tabelle im Plan.
- Missbrauch durch Kunden: Eine Meldung ab Terminbeginn sperrt die Firma bis zur Entscheidung von admin. Das ist die beschlossene Wirkung (Planentscheidung, Betriebshinweis), kein Finding dieser Abnahme. Missbrauch durch die Firma (schnell abschließen, um der Meldung zuvorzukommen) ist mit Z3 geschlossen.
- N1 der DB-Freigabe steht als s9k1-1 in `docs/OFFEN.md:77`, vollständig mit beiden Wegen und dem Fix.
- Keine Secrets, keine Seed-Daten in der Migration, alle Definer-Funktionen mit festem Suchpfad (`0064:8, 26, 47, 68, 91, 143, 177, 208, 279`).

## Stichproben (selbst nachgeschlagen)

- `supabase/functions/_shared/auth.ts:4-7` – nur 400, 401, 403 ergibt `null`, sonst Wurf. In Ordnung.
- `supabase/functions/_shared/jobs/db.ts:17-20` – Fehler geht an `rejectToken`, kein eigenes Verschlucken. In Ordnung.
- `supabase/functions/_shared/quote/db.ts:28-31` – gleiches Muster. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:53-59` – `authed` ohne `try`, 401 nur bei `null`. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:116-122` – unbekannter Fehler ergibt 500 `internal`. In Ordnung; Logtext siehe N2.
- `supabase/functions/_shared/account/handlers.ts:18-31` – `authed` im `try`, 500 `internal`. In Ordnung.
- `supabase/functions/_shared/change/handlers.ts:91-93, 124-135, 170-172, 205-211` – beide Handler. In Ordnung.
- `supabase/functions/_shared/cancel/handlers.ts:36-38, 70-76` und `cancel/partner.ts:41-43, 84-90` – In Ordnung.
- `supabase/functions/_shared/photo/handlers.ts:12-20, 131-134` – eigener Weg von `handleJobPhoto`, fester Logcode. In Ordnung.
- `supabase/functions/_shared/admin/correct.ts:51-53, 89-95` – In Ordnung.
- `supabase/functions/_shared/quote/handler.ts:210-215, 251-262` – 500 `internal`, Log nur Klassenname. In Ordnung.
- `supabase/functions/_shared/jobs/handlers.ts:43` – `under_review` ergibt 409. In Ordnung.
- `supabase/functions/*/index.ts` (17 Dateien, Importzeilen) – Deploy-Liste vollständig. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:11-17, 22` – Reihenfolge der Sperrgründe, Entzug. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:83, 111, 196, 241, 291-296` – die fünf Sperrzeilen an den Stellen der Freigabe. In Ordnung.
- `supabase/migrations/20261115104122_0064_report_flow.sql:156-157` – `can_start` und `under_review`. In Ordnung.
- `supabase/migrations/20261029141616_0001_foundation.sql:302` – SELECT auf die ganze Tabelle für authenticated; die Probe zu `report_gate` misst die Funktion. In Ordnung.
- `supabase/functions/_shared/database.types.ts:1830-1858` – Typen passen zur Migration. In Ordnung.
- `tests/rls/report-flow.test.ts:69-77, 91, 98-106, 120` – Sperrproben und N2-Probe. In Ordnung.
- `tests/unit/auth-token.test.ts:11-22, 44-58` – Fälle und Handler-Test. In Ordnung, Lücke N4.
- `tests/rls/flow-live.test.ts:386-387, 396-429` – W6, W7, Journal-Erwartung abgegrenzt. In Ordnung.
- `tests/support/positiv.ts:226-238` – Registerzeilen `my_jobs` und `my_report_info`. In Ordnung, siehe N3.
- `scripts/sys/loesch-register.json:30` – gepinnter Hash wie im Auftrag. In Ordnung.
- `tmp/proof/s9k-1/runs.jsonl:1-8` – Reihenfolge rot, Push, grün. In Ordnung.
- `tmp/proof/s9k-1/002-tests_rls_report-flow.test.ts.log:22, 42` – Ist-Werte des Rot-Beweises. In Ordnung.
- `tmp/proof/s9k-1/003-tests_unit_auth-token.test.ts.log:24, 45, 66` – Ist-Werte Unit. In Ordnung.
- `tmp/proof/s9k-1/007-tests_rls_completion.test.ts.log:62-63` – einziger Fehler im Katalogtest des Registers, danach Lauf 8 grün. In Ordnung.
- `tmp/proof/s9k-1/022-tests_rls_flow-live.test.ts.log:1-2, 31-33, 48` – Commit 5227c7e, Baum nicht sauber, W6 und W7 grün, Exit 0. Siehe N6.
- `tmp/proof/s9k-1/deploy-1.log:1-44` – 13 Functions, Exit 0, Smoke 401. In Ordnung, siehe N5.
- `tmp/proof/s9k-1/loesch-lauf.jsonl:1-3` – Aufräumen nur im Lauf 22 über `sweep.ts`, Endzahlen 0. In Ordnung.
- `docs/OFFEN.md:77, 79, 135` – s9k1-1 (N1 der Freigabe), s9k1-3, N15. In Ordnung.
- `docs/BEKS.md:22-24` – Betriebshinweis zu Z2 und Z4 vorhanden. In Ordnung.
- `src/lib/jobs.ts:191-198`, `src/lib/partnerJobs.ts:256, 272` – die App liest nur die freigegebenen Felder. In Ordnung.
- `scripts/dev-ref.mjs:2` – Ref des Deploys ist Dev. In Ordnung.

Offene Findings hoch: 0
