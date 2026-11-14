Modell: claude-fable-5-2

# s9p-1 Planprüfung Provisionsstaffel (Kennung p1-1411-a) – Bericht zu Vorlage 2 (Nachprüfung)

- Datum: 2026-11-14
- Geprüft (vollständig gelesen): `supabase/migrations/20261114100000_0062_fee_schedule.sql` (1056 Zeilen, Stand nach den Auflagen), `tmp/proof/s9p-1-funktionsdiff.log` (329 Zeilen), `tmp/proof/s9p-1-fable-vorlage-2.md`, mein Bericht `tmp/proof/s9p-1-fable-plan.md`, `tmp/proof/s9p-1-sql-hash-2.txt`.
- Gegengelesen (Ausschnitte): Migrationen 0015, 0016, 0018, 0023, 0027, 0028, 0038, 0046, 0047; `scripts/scan-proof.mjs`; Suche über `src/`, `supabase/functions/`, `tests/`, `scripts/` nach Lesern von `platform_settings`, `current_fee_rates` und den Satzspalten.
- Hash: Den SHA-256 habe ich nicht selbst gerechnet (kein Shell-Werkzeug). Der Wert in der Vorlage stimmt mit `tmp/proof/s9p-1-sql-hash-2.txt:1` überein. Die Freigabe gilt für den Text, den ich heute gelesen habe; die Hauptsession prüft vor dem Push, dass die Datei noch genau diesen Hash hat.
- Nicht geprüft: Edge Functions, Client, CSV, Tests (folgen laut Plan). Das eingebaute advisor-Tool wurde nicht aufgerufen.

Ergebnis in einem Satz: Alle sieben Auflagen (H1, M1–M3, N1–N3) stehen richtig und vollständig im SQL-Text, keine davon öffnet eine neue Lücke, die Erwartungswerte gelten unverändert; offen bleiben nur niedrige Punkte ohne Änderungszwang am SQL.

## Findings

### Hoch

Keine. H1 ist geschlossen (siehe Prüffrage 1).

### Mittel

Keine. M1, M2, M3 sind geschlossen.

### Niedrig

**N4 (unverändert, akzeptiert)** `0062:571` – Liefert `current_fee_schedule()` null, scheitert `send_offer` mit einer NOT-NULL-Verletzung statt `setting_missing`. Kann mit Version 1 (gültig seit 2026-10-28, `0062:42`) nicht eintreten. Kein Änderungszwang.

**N5 (unverändert, Doku-Schritt)** `docs/S9_KONZEPT.md` 9.1–9.3 und der Abschnitt „Geld“ in CLAUDE.md beschreiben noch den flachen Satz. Konzept im Doku-Schritt nachziehen; CLAUDE.md ändert nur Beks.

**N6 (unverändert, Hinweis an Beks)** `0062:43` – Version 2 gilt ohne Ankündigungsfrist (reine Senkung, Beks' Vorgabe). Für künftige Versionen ist der Vorlauf Prüfpunkt der jeweiligen Migration.

**N7 (neu, Hinweis)** `0062:570-571` mit `0038:51-56` – Der Journal-Guard vertraut jetzt der Version des Angebots (`0062:271-272`). Diese Version setzt nur `send_offer`; ein Einfüge-Trigger auf `partner_offers`, der sie gegen die geltende Version prüft, existiert nicht (es gibt nur Guards für UPDATE, DELETE, TRUNCATE). Über die API nicht ausnutzbar: kein DML-Grant für irgendeine Rolle (`0038:60-61`), `send_offer` ist die einzige Schreibstelle. Betroffen wäre nur Eigentümer-SQL, das ohnehin Trigger abschalten kann. Fix nur, falls gewünscht: Before-Insert-Prüfung `new.fee_schedule_version = private.current_fee_schedule()`. Kein Änderungszwang, keine Auflage.

**N8 (neu, Betrieb)** `0062:136-144` – „Abbruch ohne Änderung“ gilt nur, wenn die Datei als eine Transaktion eingespielt wird. Die Supabase-CLI tut das je Migrationsdatei nach meinem Wissen; im Repo ist das nicht nachprüfbar. Fix (ohne SQL): vor dem Push die Zählung `fee_rate <> 0.15` als Log nach `tmp/proof/` (Auflage aus M1 bleibt); sollte der Push mit `fee_rate_not_flat` abbrechen, per Abfrage belegen, dass `public.fee_schedules` nicht existiert, bevor neu eingespielt wird.

## Prüffragen

### (1) Jede Änderung richtig und vollständig, keine neue Lücke

**H1 – geschlossen.** `0062:31` entzieht anon, authenticated und service_role alle Rechte, `0062:32` gibt nur SELECT zurück; ein INSERT-Grant steht nirgends mehr in der Datei. Kommentar `0062:9` und `0062:33` passen. Die Stufenmenge einer Version ist damit für jeden API-Schlüssel unveränderlich: kein INSERT (Grant), kein UPDATE/DELETE/TRUNCATE (Grant und Trigger `0062:24-27`). Schreiben kann nur der Eigentümer (Migration, Testhilfe).

**M1 – geschlossen.** Der Block `0062:137-143` steht vor `0062:144` (Löschen der Spalten) und nach dem Anlegen der neuen Spalte. `fee_rate` ist `numeric(6,5) not null` (`0028:23`), der Vergleich kennt also keinen NULL-Fall, und 0.15 gegen 0.15000 vergleicht numerisch gleich. Leere Datenbank (`db reset`, Seeds laufen erst danach): `count(*)` ergibt 0, kein Abbruch, die Migration läuft durch. Meldung mit Anzahl, ein Platzhalter, ein Argument: korrekt. Der Fremdschlüssel der neuen Spalten (`0062:132`, `:134`) findet Version 1, weil `0062:41-43` vorher einfügt.

**M2 – geschlossen.** `0062:269-276`:
- Reihenfolge in `confirm_offer`: Revision mit `offerId` wird bei `0062:496-498` angelegt, der Zeiger bei `:500` gesetzt, das Angebot bei `:505` auf `confirmed`, gebucht wird erst bei `:510`. Der Guard läuft in derselben Transaktion als SECURITY DEFINER (`0062:221`) und sieht den neuen Status; RLS steht nicht im Weg.
- Revisionen anderer Herkunft: Der Zugriff auf `rev.snapshot ->> 'offerId'` steht nur im Zweig `rev.source = 'partner_offer'` (`0062:270`). Für `submit` und `change_order` wird der Ausdruck nie ausgewertet, dort gilt `private.current_fee_schedule()` (`:274`).
- Umwandlung in uuid: gefahrlos, weil `guard_revision_insert` für jede Revision dieser Herkunft das uuid-Format und ein gesendetes Angebot desselben Auftrags erzwingt (`0046:199-207`). Fehlt der Schlüssel doch, ergibt die Abfrage keine Zeile, `ev` bleibt null und `:276` wirft `rate_mismatch` (fail closed). Dasselbe bei fremder Firma, fremdem Auftrag oder nicht bestätigtem Angebot.
- Weitervermittlung nach Partner-Storno: kein Konflikt. `reissue_request` gibt bei einem Festangebot auf (`0047:26`) und legt sonst eine Revision mit Herkunft `submit` an (`0047:41-42`); der Kopierzweig schließt Festangebote zusätzlich aus (`0046:163`). Die Folgeanfrage läuft also immer über den Zweig „geltende Version“, passend zu `partner_accept` (`0062:416-420`).
- Die Prüfungen in den Funktionen sind geblieben: `partner_accept` gegen `current_fee()` (`0062:416-420`), `confirm_offer` gegen die Version des Angebots (`0062:486-490`). Guard und Funktion nutzen dieselbe Quelle (`current_fee_schedule()`), `now()` ist je Transaktion fest; ein Versionswechsel zwischen Grundlage und Ausführung endet in `rate_mismatch`, nicht in einer falschen Buchung.
- Doppelte Buchung bleibt ausgeschlossen (`0028:42`, eindeutiger Index je Auftrag).

**M3 – geschlossen.** `0062:147-158` ist Zeile für Zeile der Rumpf aus `0038:36-47`, ergänzt um `fee_schedule_version` in beiden Zeilenlisten (`:152`, `:153`). Sprache, `search_path` und fehlendes SECURITY DEFINER wie vorher; `create or replace` lässt Trigger (`0038:51-52`) und Rechte (`0038:49`) bestehen. Eine spätere Definition der Funktion gibt es in keiner anderen Migration (Suche). `ADD COLUMN` mit Vorgabe (`0062:132`) löst den Update-Trigger nicht aus.

**N1 – geschlossen.** `0062:63-75`: Stufe nach der offenen wirft (`:64`), Grenze nicht größer als die vorige wirft (`:69`), keine offene Stufe wirft (`:75`); das deckt auch „Version fehlt“ und `p_version` null ab (keine Zeilen). Gegenbuchungen rufen `fee_cents` nicht auf (`0062:238-257`), ein Storno bliebe also auch bei kaputter Stufenmenge möglich; nur neue Gebührenzeilen scheitern. Das ist die richtige Richtung.

**N2 – geschlossen.** `0062:118-121`: Reihenfolge Konto, aal2 (`mfa_required`), Mitgliedschaft, Eingabe; gleich wie `my_commissions` (`0062:1014-1017`). Ein Kunde mit aal1 erhält `mfa_required`, mit aal2 `not_found`; beides verrät nichts. Rechte `0062:125-126` unverändert richtig.

**N3 – geschlossen.** `0062:161-165` ersetzt die Bedingung aus `0027:8-12`; Partner lesen nur noch `fee_vat_rate`, admin (aal2, `0015:10-12`) alles, Kunden nichts. Der Spalten-Grant aus `0027:5-6` bleibt. In `src/` liest nichts `platform_settings` direkt (Suche; der Dist-Scan verbietet es ohnehin), die Edge Functions lesen mit dem Secret-Key (`supabase/functions/_shared/jobs/db.ts:105`) und sind von der Policy nicht betroffen. Die Zeile `fee_rate` bleibt unangetastet.

Keine neue Lücke gefunden. Einzige neue Beobachtungen: N7 und N8 (beide niedrig).

### (2) Erwartungswerte mit der geänderten `fee_cents`

Gelten unverändert. Für gültige Stufenmengen rechnet die Schleife wie vorher; neu sind nur die drei Abbruchbedingungen. Von Hand nachgerechnet (s = Summe Anteil × bp, Ergebnis = (2s + 10000) div 20000):

| Version | Basis | s | Provision |
|---|---|---|---|
| 2 | 30000 | 36.000.000 | 3600 |
| 2 | 50000 | 60.000.000 | 6000 |
| 2 | 50001 | 60.001.000 | 6000 |
| 2 | 68961 | 78.961.000 | 7896 |
| 2 | 76041 | 86.041.000 | 8604 |
| 2 | 80000 | 90.000.000 | 9000 |
| 2 | 100000 | 110.000.000 | 11000 |
| 2 | 100001 | 110.000.700 | 11000 |
| 2 | 150000 | 145.000.000 | 14500 |
| 2 | 300000 | 250.000.000 | 25000 |
| 2 | 6900 | 8.280.000 | 828 |
| 1 | 68961 | 103.441.500 | 10344 |
| 1 | 7080 | 10.620.000 | 1062 |
| 1 | 6900 | 10.350.000 | 1035 |

Bei 6900 (Version 2) sind die Anteile der Stufen 2 und 3 negativ und werden übersprungen (`0062:73`); bei 100000 ist der Anteil der offenen Stufe 0. Basis 0 ergibt 0. Nachtrag weiterhin 8604 − 7896 = 708.

### (3) Sonst nichts Neues

- Der Funktionsdiff (`tmp/proof/s9p-1-funktionsdiff.log:276-328`) zeigt für `guard_commission_insert` genau den M2-Block zusätzlich; die übrigen 14 Abschnitte entsprechen dem Stand, den ich in Vorlage 1 geprüft habe. `guard_partner_offer` steht nicht im Log; ich habe sie selbst gegen `0038:36-47` verglichen (siehe M3).
- Signaturen und Grants am Dateiende (`0062:1029-1055`) passen zu den Parameterlisten der neu definierten Funktionen (ein numeric weniger als vorher).
- Keine Anweisung in der Datei verhindert das Einspielen in einer Transaktion.

## Auflagen für die Folgeschritte (kein SQL)

- Aus Bericht 1 unverändert: TS-`splitFee` mit denselben Vektoren und derselben Fail-closed-Regel wie N1; Kreuztest TS gegen `payout_preview`; `fee_tiers` nie in eine Antwort an Kunden; RLS-Tests für beide neuen Tabellen und `payout_preview` (Kunde, anon, Firmenkonto aal1 und aal2 je Status, service_role ohne INSERT/UPDATE/DELETE) mit Rot-Beweis und Ist-Wert; Migration und Edge Functions je Umgebung zusammen ausrollen.
- Neu zu N3: Test, dass ein Firmenkonto mit aal2 von `fee_rate` 0 Zeilen und von `fee_vat_rate` 1 Zeile liest; Rot-Beweis misst die sichtbaren Zeilen bei zurückgestellter Policy.
- Neu zu M2: Test, dass eine `booking`-Zeile mit vorhandener, aber nicht zulässiger Version am Guard scheitert (einmal Herkunft `submit` mit Version 1, einmal Festangebot mit einer anderen Version als der des Angebots); Rot-Beweis misst, dass die Zeile bei gelockertem Guard entsteht.
- Neu zu M3: Test, dass ein Statuswechsel aus `sent`, der zugleich `fee_schedule_version` ändert, mit `offer_immutable` scheitert.
- Tests, die das alte Verhalten festschreiben, werden nach dem Einspielen rot und müssen im Testschritt umgestellt werden, unter anderem `tests/rls/partner-mfa.test.ts:41-53`, `tests/rls/partner-fee-read.test.ts:34-52`, `tests/rls/partner-jobs.test.ts:69-75`, `tests/rls/settings.test.ts:202`, `tests/rls/quote.test.ts:293-295`, `tests/rls/journal.test.ts:312-331`, dazu die Mocks `tests/e2e/backend.ts:91` und `tests/e2e/jobs-helpers.ts:246`.
- `scripts/scan-dist.mjs:2` und `:8`: Die Ausnahme für die entfallene View streichen und prüfen, ob die beiden neuen Tabellennamen in das Muster für Gebührentabellen gehören (der Client soll nur `payout_preview` aufrufen).
- Dev vor dem Push: Zählung nach N8; falls Zeilen mit anderem Satz existieren, Bereinigung nur über den Eigentümer-Weg mit `scripts/dev-guard.mjs`.

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `0062:31-33` | nur SELECT für authenticated und service_role, kein INSERT (H1 erfüllt) |
| `0062:24-27`, `0015:30-36` | append-only für Zeilen und TRUNCATE auf beiden Tabellen |
| `0062:137-144`, `0028:23` | Prüfung vor dem Löschen; Spalte NOT NULL, leere Tabelle ergibt 0 |
| `0062:41-48` vor `0062:132-135` | Version 1 existiert, bevor der Fremdschlüssel geprüft wird |
| `0062:269-276` | Version aus bestätigtem Angebot, sonst geltende; null führt zu `rate_mismatch` |
| `0062:496-510` | `offerId` im Snapshot, Status `confirmed` (`:505`) vor der Buchung (`:510`) |
| `0046:199-207` | Revision aus Angebot nur mit uuid-förmigem `offerId` und gesendetem Angebot desselben Auftrags |
| `0047:26`, `0047:41-42`, `0046:163` | Folgeanfrage nie aus Festangebot, Herkunft immer `submit` |
| `0018:14`, `0046:121` | genau drei Herkünfte: submit, partner_offer, change_order |
| `0062:416-420`, `0062:486-490` | Prüfungen in `partner_accept` und `confirm_offer` weiter vorhanden |
| `0062:147-158` gegen `0038:36-47` | identisch bis auf die neue Spalte in beiden Listen |
| `0038:51-56`, `0038:60-61` | kein Insert-Trigger auf Angeboten, kein DML-Grant (N7) |
| `0062:63-76` mit 14 Beträgen | alle Erwartungswerte bestätigt |
| `0062:118-121` gegen `0062:1014-1017` | gleiche Reihenfolge und Meldungen |
| `0062:161-165` gegen `0027:8-12` | nur noch `fee_vat_rate` für Partner, Spalten-Grant `0027:5-6` bleibt |
| `0023:81-86`, `0015:10-12` | Mitglieds- und Admin-Helfer verlangen aal2 |
| `0028:42` | höchstens eine `booking`-Zeile je Auftrag |
| `supabase/functions/_shared/jobs/db.ts:105` | einziger direkter Leser von `platform_settings` in den Functions, Schlüssel `completion_days`, Secret-Key |
| `tmp/proof/s9p-1-funktionsdiff.log:300-309` | M2-Block im Diff wie im SQL |
| `tmp/proof/s9p-1-sql-hash-2.txt:1` | gleicher Wert wie in der Vorlage; nicht nachgerechnet |
| `scripts/scan-proof.mjs` | gelesen; der Bericht enthält nichts, was eines der vier Muster (Secret-Key, JWT, Access Token, Verbindungsadresse mit Passwort) trifft |

Freigabe SQL SHA-256 1786631c064d0c10fd92cf24ab17d07cecc238dc8793eb3987070ecf8db8e334
Offene Findings hoch: 0
