Modell: claude-fable-5-2

# Abnahme s9t-1 (Testreste auf Dev)

- Datum: 2026-11-13
- Stand: Commit fcc0f00, Branch `s9t-1` (WIP). Arbeitsbaum laut Status sauber, gelesen wurden die Dateien im Arbeitsbaum; `git diff` war nicht ausführbar.
- Geprüft gegen: `tmp/proof/s9t-1-plan.md`, `s9t-1-fable-plan.md` (Funde 1 bis 6), `s9t-1-fable-plan-2.md` (Änderungen 1 bis 3).
- Umfang: `tests/support/sweep.ts`, `tests/support/partner.ts`, `tests/rls/sweep.test.ts`, geänderte Teile von `job-photos.test.ts`, `listings.test.ts`, `partner-mfa.test.ts`, `partner-documents.test.ts`, `partners.test.ts`, `partner-functions-live.test.ts`; die Rot-, Grün- und Lockerungs-Logs; die drei Zählungen samt ihrer Abfragen (`tmp/s9t-1-count.sql`, `-count2.sql`, `-timing.sql`, `-kurz.sql`).
- Nur gelesen, nichts ausgeführt. Das eingebaute `advisor`-Tool ohne Parameter stand in meiner Tool-Liste und wurde nicht aufgerufen.

**Ergebnis:** Der Code ist abgenommen: alle Funde 1 bis 6 und die Änderungen 1 bis 3 sind umgesetzt, das SQL ist fehlerfrei, der Aufräumer kann keine echten Daten treffen. Geld, RLS und `supabase/` sind unberührt. Die Session ist damit aber nicht abschließbar: Für den Endstand fehlt der Grün-Beleg der geänderten Testdateien außer `sweep.test.ts` (M1), und die Doku zu s9t-1 fehlt (M2). Beides ist vor dem Abschluss und vor einem Merge nach `main` Pflicht.

## Findings

### Hoch
Keine.

### Mittel

**M1** `tmp/proof/s9t-1-gruen-d-1.log:1-11` – Kein Grün-Beleg für den Endstand von `job-photos.test.ts`, `listings.test.ts`, `partner-mfa.test.ts`, `partner-documents.test.ts`, `partners.test.ts` und `partner-functions-live.test.ts`. Das einzige Grün-Log dieser Dateien startete um 22:51, nennt in der Kopfzeile nur drei geänderte Testdateien (kein `partner.ts`, kein `sweep.ts`) und liegt nach der Änderungszeit der Dateien vor dem Plan und vor beiden Planprüfungen. Es deckt also weder `CLAIM_ALL` an `job-photos.test.ts:85`, `:134`, `:466` (Fund 5) noch die neue Standard-Kontaktadresse aus `tests/support/partner.ts:25`, die jede Firma jedes rls-Tests betrifft, noch Fund 6. Die Auflage aus beiden Planprüfungen (`test:rls` zweimal hintereinander grün, der zweite Lauf findet die Reste des ersten nur über den Marker) ist nicht belegt; `s9t-1-check-1.log` (EXIT=0, 1078 Tests) ist nur Lint, Typecheck und Unit. Nach der letzten Lockerungsprobe (00:00) gibt es auch keinen Lauf mit der wiederhergestellten `sweep.ts` mehr; dass Marker und Wächter wieder drin sind, habe ich nur gelesen (`sweep.ts:12-13`). – Fix: `test:rls` zweimal komplett mit EXIT im Log, davor und danach die Kurzzählung (`tmp/s9t-1-kurz.sql`). Erwartet: `firma@movenow.test` genau 254, Marker-Firmen aktiv 0, Wächter-Firmen 0, `echt-`-Konten 0, aktive Firmen in Bezirk 21 gleich 0.

**M2** `docs/OPEN_ISSUES.md:392`, `:582`, `docs/PROGRESS.md:10` – Zu s9t-1 steht in `docs/` nichts (Suche nach „s9t“ ohne Treffer in PROGRESS, OPEN_ISSUES, AUTOPILOT, ROADMAP), obwohl der Plan in Abschnitt 4 einen Eintrag zusagt und der Commit ein WIP ist (PROGRESS muss sagen, wo es weitergeht). Dazu drei Widersprüche zu den eigenen Zählungen:
- `OPEN_ISSUES.md:392` (S9c-7) nennt nur den Nutzer-Marker und sagt, je Lauf bleibe „eine Firma samt Nutzer“ stehen. Gezählt: `partner_members` 0, alle 254 Firmen ohne Mitglied.
- `OPEN_ISSUES.md:582` (S9i7-15) behauptet weiter, die Reste verlängerten Verteilungs- und Zähltests. Der Plan (Abschnitt 7 E) schließt das aus.
- `PROGRESS.md:10` nennt als Ursache der Waisen einen Fehler im ersten Live-Test. Nach Plan Abschnitt 1 erzeugt der Aufräumer sie bei jedem Lauf selbst (Nutzerschleife `sweep.ts:47-53`).

Fix: neuer Eintrag in OPEN_ISSUES (254 Altfirmen bleiben gesperrt stehen und sind für den Aufräumer unsichtbar; die 2 sonstigen `.test`-Konten benennen; was Nutzer hält, sind Journal und Lösch-Trigger, nicht `customer_id`, das kaskadiert), S9c-7 auf den Firmen-Marker umstellen, S9i7-15 an die Messung angleichen, PROGRESS-Eintrag mit der richtigen Ursache, dem Hinweis auf das ungültige `s9t-1-rot-sweep-3.log` und „Weiter bei“. Alte Einträge nicht umschreiben, sondern im neuen berichtigen.

### Niedrig

**N1** `tmp/proof/s9t-1-plan.md:88` – „Reste als Ursache der Dauer ausgeschlossen“ ist weiter gefasst als die Messung. `s9t-1-timing-vorher.json` misst fünf lesende Joins (1,03 bis 16,09 ms, stimmt mit dem Plan). Nicht gemessen sind die Schreibpfade, die mit den Resten wachsen: die Nutzerschleife des Aufräumers (132 scheiternde Löschversuche je Aufruf, jeder mit Kaskade) sowie `photo_claim` und die Verteilung über alle offenen Anfragen. Die 2,3 s je CLI-Aufruf stehen in keiner der drei Dateien. Für die Aussage spricht indirekt, dass `sweep.test.ts` bei gleichem Datenstand 20 s (`s9t-1-gruen-sweep-2.log`) bis 97 s (`s9t-1-lockerung-waechter-1.log`) braucht. – Fix: als „durch die Lesemessung nicht gestützt“ formulieren und im Volllauf die Dauer des DO-Blocks und eines leeren CLI-Aufrufs mitloggen.

**N2** `tests/rls/partner-documents.test.ts:25`, `:59-67` – Folge von Fund 6 (meine eigene Empfehlung): Scheitert im `afterAll` `removeFiles` und löscht `deleteUsers` danach die Konten, ist die Firma eine Waise mit Marker. Der nächste Aufräumer löscht sie samt `partner_documents` (`0024:158-159` erlaubt das mit dem Firmen-Marker), die Dateien im Bucket bleiben ohne Zeile zurück und werden vom eigenen `beforeAll` (`:49-52`, Suche über den Firmennamen) nicht mehr gefunden. Nur Dev, nur nach einem Abbruch. – Fix: in OPEN_ISSUES vermerken; kein Umbau nötig.

**N3** `tests/support/sweep.ts:51`, `:3-4`, `tests/rls/accept-concurrency.test.ts:28`, `change-orders-concurrency.test.ts:18`, `offers-concurrency.test.ts:29` – Kommentare widersprechen der Zählung: „Mitglied mit Journal, Zuordnung oder Angebot: bleibt“ und „admin hat Audit-Einträge und bleibt meist stehen“. Gezählt: 0 Mitglieder, 762 von 762 Audit-Akteuren nicht mehr in `auth.users`, alle 132 verbliebenen `pt-`-Nutzer sind Kunden mit Auftrag. Der Kopfkommentar nennt drei Bindungen, `BOUND` hat fünf. – Fix: Kommentare angleichen.

**N4** `tmp/proof/s9t-1-lockerung-marker-1.log:1`, `s9t-1-lockerung-waechter-1.log:1`, `s9t-1-rot-claim-1.log:1` – Die Kopfzeilen sagen nicht, welche Zeile gelockert bzw. für den Rot-Lauf geändert war (nur „marker“, „waechter“, „geaendert“). Die in Runde 2 verlangten Zahlen `active` und `unbound` des ersten Aufrufs stehen in keinem Log; der Parse-Beweis ist nur indirekt (Test 1 grün heißt: DO-Block lief, und `sweep.ts:58` hätte bei fehlender Zahl geworfen). – Fix: im PROGRESS-Eintrag je Log die gelockerte Bedingung nennen; Logs nicht nachträglich ändern.

**N5** `tests/rls/sweep.test.ts:21-22` – Liefert die Abfrage keine Mitgliedschaft, landet die Zeichenkette `undefined` in `firms`; `afterAll` (`:36`) scheitert dann am ungültigen UUID und überspringt das Löschen der Konten. Der nächste `beforeAll` räumt das auf. – Fix: in `makeFirm` werfen, wenn keine ID zurückkommt.

## Prüffragen

**(1) `sweep.ts` und `partner.ts`: Funde und Änderungen umgesetzt, SQL fehlerfrei und sicher?** Ja.
- Fund 1: exakte Form als eine Konstante (`partner.ts:14`), in `sweep.ts:12` per Regex-Vergleich statt LIKE; kein Backslash, kein Hochkomma. `FIRM_MAIL` (`partner.ts:15`) erzeugt immer 8 Hex-Zeichen.
- Fund 2: `BOUND` mit allen fünf RESTRICT-Bezügen (`sweep.ts:15-17`). Auf `partners` verweisen genau elf Fremdschlüssel (Suche über alle Migrationen): fünf Kindtabellen, die der Block löscht, `job_listings` mit Kaskade (`0030:33`, kein Lösch-Trigger auf der Tabelle), fünf in `BOUND`.
- Fund 3: Restzählung liefert `active` und `unbound` (`sweep.ts:55-56`), größer 0 wirft, bei `final` Warnung (`:63-67`).
- Runde 2, Änderung 1: `coalesce(x.email, '')` im Wächter (`sweep.ts:13`). Änderung 2: `Number.isFinite` für beide Zahlen noch im `try` (`:58`). Änderung 3: siehe (2).
- SQL: Aggregat mit `filter` und korrelierter Unterabfrage ist zulässig; das Dollarzeichen im Regex beendet den DO-Block nicht. Der Lösch-Marker ist an die Firmen-ID gebunden und gilt nur in der Transaktion (`0023:194`, `:203`, `0024:158-159`). Gesperrt wird über `admin_set_partner_status` mit dem Test-admin, kein direktes UPDATE auf den Status.

**Kann der Aufräumer echte Daten treffen?** Nein, mit benannten Resten:
- Außerhalb von Dev läuft er nicht: `dev-guard` ist erster Import (`sweep.ts:6`) und globalSetup (`tests/support/dev-guard-setup.ts:3`), drei Refs müssen stimmen, die CLI-Ref wird festgelegt (`scripts/dev-guard.mjs:12-22`).
- Auf Dev braucht die Firmenschleife drei Bedingungen zugleich: exakte Marker-Adresse, nicht die Abdeckungsfirma, kein Mitglied außerhalb der Testkonten. `contact_email` ist für Partner selbst änderbar (`0023:242`) und nur schwach geprüft (`0023:26`); eine Firma mit echtem Mitglied schützt dann der Wächter (Lockerungsprobe: ohne Wächter wird sie gelöscht). Es bleibt die Firma ohne Mitglied mit Marker-Adresse; auf Dev gibt es 0 Konten außerhalb `.test`.
- Breiter als der Firmen-Marker ist die unveränderte Nutzerschleife (`sweep.ts:47`): Sie versucht jedes Konto mit dem `pt-`-Muster, auch eines, das jemand über die App auf Dev anlegt. Auf Dev hinnehmbar.
- `sweep.test.ts:30-31` löscht nach Firmenname und nach `echt-…@example.org` ohne Marker und Wächter. Reservierte Domain, eigener Testname, nur Dev: in Ordnung.
- Nicht erzwungen ist „nur ein `test:rls`-Lauf gleichzeitig“ (`sweep.ts:5`); ein zweiter Lauf verliert seine ungebundenen Firmen und Nutzer. Wie bisher, nur dokumentiert.

**(2) Tests.** `sweep.test.ts`: alle Firmen `pending` in Bezirk 21 mit eigenem Namen (`:14`, `:20`), Parameter `st` entfällt, Test 1 erwartet `pending` (`:45`); `beforeAll` löscht Reste nach Name, dann die `echt-`-Konten (`:30-31`); leere Liste abgesichert (`:37`). `job-photos.test.ts`: `CLAIM_ALL` (`:67`) an `:85`, `:134`, `:440`, `:456`, `:466`; die Schleife endet sicher, weil ein Aufruf ohne Treffer alle offenen Anfragen durchlaufen hat (`0037:34-41`); der neue Test (`:450-461`) stimmt mit der Sortierung nach `created_at`, `id` überein (7 fremde Anfragen füllen den ersten Aufruf mit 56 Fotos). `listings.test.ts:425-426`: auf die eigene Anfrage begrenzt, erwartet weiter `append_only` (`0030:81-82`); dass ein Rot-Beweis hier nicht möglich ist, stimmt, der Zeilen-Trigger bricht in beiden Fassungen bei der ersten Zeile ab. `FIRM_MAIL` in `partner-mfa.test.ts:25`, `partner-documents.test.ts:25`, `partners.test.ts:110`; die Mitglieder dieser Tests tragen kein `pt-`-Muster (`tests/support/db.ts:31`), ihre Firmen schützt während des Laufs der Wächter. Kommentar `partner-functions-live.test.ts:96` stimmt. Offen: Grün-Beleg, siehe M1.

**(3) Belege.**

| Datei | Ergebnis |
|---|---|
| `s9t-1-rot-sweep-2.log` | gültig: frühere Testfassung, Ist `active` statt undefined, EXIT=1 |
| `s9t-1-rot-sweep-3.log` | ungültig wie angegeben: `sweepTestResidue is not a function`, alle 3 Tests rot, misst nichts |
| `s9t-1-rot-sweep-4.log` | gültig: alter Aufräumer, Endfassung der Tests, nur Test 1 rot, Ist `pending` statt undefined, EXIT=1. Misst die Wirkung (Firma bleibt stehen) |
| `s9t-1-rot-claim-1.log` | gültig: Ist `= 0` statt `= 1` für die eigene Anfrage, EXIT=1; Variante nicht benannt (N4) |
| `s9t-1-gruen-sweep-1.log`, `-2.log` | gültig: 3 von 3, EXIT=0, Zählung davor und danach gleich (254 Altfirmen, Marker-Firmen 0, Wächter 0, `echt-` 0, `pt-`-Nutzer 132) |
| `s9t-1-gruen-d-1.log` | EXIT=0, aber Stand vor den Planprüfungen: kein Beleg für den Endstand (M1) |
| `s9t-1-lockerung-marker-1.log` | gültig: nur Test 3 rot, Ist undefined statt `pending` (Firma gelöscht), EXIT=1; Zählung davor und danach gleich, die 254 Altfirmen blieben unberührt |
| `s9t-1-lockerung-waechter-1.log` | gültig: nur Test 2 rot, Ist undefined statt `pending`, EXIT=1; Zählung gleich |

Die gelockerten Fassungen sind nicht im Commit (`sweep.ts:12-13` enthält Marker und Wächter). Dass die `pt-`-Nutzer vor und nach jedem Lauf bei 132 stehen, obwohl die Nutzerschleife jedes Mal alle versucht, ist der Ist-Beleg für „kein Nutzer löschbar“.

**(4) Zählungen gegen den Plan.** Alle Zahlen aus Abschnitt 2 stimmen mit den JSON-Dateien überein: 254 Firmen, alle ohne Mitglied, alle `suspended`, alle gebunden (0 ungebunden, auch mit Journal, Belegen und Nachträgen gerechnet), 135 mit Journal (320 Zeilen), 44 mit Belegen (120), 41 mit Nachträgen (117), 760 Listings (227/533), 227 Zuordnungen (215 offen), 240 Angebote, 134 Konten (132/2/0), 312 Aufträge, 0 `pt-`-Nutzer ohne Auftrag, 762 Audit-Zeilen ohne Akteur. „Nichts löschbar“ und „alle gebunden und gesperrt“ sind belegt. „Kein Lösch-Skript“: die vier Abfragedateien unter `tmp/` lesen nur (die Zeitmessung endet absichtlich mit einem Abbruch), unter `scripts/` gibt es keine s9t-Datei. Nicht gedeckt: die Aussage zur Dauer (N1).

## Stichproben

| Stelle | Ergebnis |
|---|---|
| `tests/support/sweep.ts:6` | `dev-guard` ist erster Import |
| `tests/support/sweep.ts:12-13` | Marker als Regex, Abdeckungsfirma ausgenommen, Wächter mit `coalesce` |
| `tests/support/sweep.ts:15-17` | fünf Bindungen, decken sich mit `0030:57`, `0038:20`, `0028:13`, `0035:20`, `0040:11` |
| `tests/support/sweep.ts:55-58` | zwei Zahlen, `isFinite`-Prüfung im `try` |
| `tests/support/partner.ts:14-15`, `:25` | Konstante und Standardadresse in `regArgs` |
| `supabase/migrations/…0023_partners.sql:26` | `contact_email` nur Länge und einfaches LIKE |
| `…0023_partners.sql:41-42` | `partner_id` RESTRICT, `user_id` Kaskade: Ursache der Waisen bestätigt |
| `…0023_partners.sql:194`, `:203`, `:218`, `:227` | Löschen nur mit Marker gleich Firmen-ID |
| `…0023_partners.sql:242` | Partner dürfen `contact_email` selbst ändern |
| `…0024_partner_admin.sql:158-159`, `:185` | Dokumentzeilen mit Firmen-Marker löschbar |
| `…0030_job_listings.sql:33`, `:81-82` | Listings kaskadieren; Zuordnungen per Zeilen-Trigger unlöschbar |
| `…0037_s9d_abnahme.sql:34-41` | Obergrenze 50, Abbruch an der Anfragegrenze, Sortierung `created_at`, `id` |
| `…0039_s9e_abnahme.sql:157-187` | Statusfunktion prüft admin, sperrt Aufträge, kein direktes UPDATE im Aufräumer |
| `scripts/dev-guard.mjs:12-22` | Abbruch bei abweichender Ref, CLI-Ref festgelegt |
| `vite.config.ts:28-29` | globalSetup und `fileParallelism: false` |
| `tests/support/db.ts:31` | Live-Konten heißen `<tag>-<lauf>@movenow.test`, nur Tags mit `pt-` trifft der Aufräumer |
| `tests/rls/sweep.test.ts:28-39` | Aufräumen vor und nach dem Lauf, Reihenfolge Firmen vor Konten |
| `tests/rls/job-photos.test.ts:67`, `:85`, `:134`, `:466` | `CLAIM_ALL` an allen Stellen aus Fund 5 |
| `tests/rls/listings.test.ts:425-426` | auf die eigene Anfrage begrenzt |
| `tmp/s9t-1-kurz.sql:5` | „ungebunden gesamt“ prüft drei von fünf Bindungen: strenger als nötig, Ergebnis 0 gilt damit auch für fünf |
| `tmp/s9t-1-timing.sql:5-15` | nur lesend, Abbruch am Ende |
| `tmp/proof/s9t-1-kurz-nach-lock-marker.json` | Werte gleich der Kopfzeile im Log |
| `docs/OPEN_ISSUES.md:392`, `:582`, `docs/PROGRESS.md:10` | nicht an s9t-1 angeglichen (M2) |

Offene Findings hoch: 0
