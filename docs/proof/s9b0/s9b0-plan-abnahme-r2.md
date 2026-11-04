# S9b-0 · Berater-Abnahme Runde 2 des Bauplans `docs/S9b_PLAN.md`

- Datum: 2026-11-04
- Geprüfter Stand: Branch `s9b0`, Commit 5f1c705 („S9b-0: Bauplan Runde 2“), `docs/S9b_PLAN.md` (356 Zeilen, vollständig gelesen). Bezug: Bericht Runde 1 `tmp/proof/s9b0-plan-abnahme.md` (Commit 248f0f3).
- Geprüft gegen: `docs/S9_KONZEPT.md` (Zeilen 240–389, 543–572, 640–659), `docs/OPEN_ISSUES.md` (Fundstellen 10, 44, 50, 131, 183, 218, 219, 226), `docs/S9a_PLAN.md` (28–55), `CLAUDE.md`, Migrationen 0015, 0016, 0017 (1–60, 134–280), 0018 (1–60 und Fundstellen), 0020 (1–30), 0021 (25–54), 0022, 0001 (Fundstellen), `tests/support/owner.ts`, `tests/support/db.ts`, `scripts/redproof-s9a4.mjs` (1–180, 475–514, Fundstellen), `tests/rls/rls.test.ts` (315–364, 440–471), `scripts/scan-proof.mjs`.
- Art: Plan-Abnahme, letzte Runde. Fehlendes Voll-SQL ist kein Finding.
- Hinweis: In der Tool-Liste dieses Beraters steht ein eingebautes `advisor`-Werkzeug ohne Parameter. Es wurde gemäß `CLAUDE.md` nicht benutzt.

## 1. Runde-1-Findings

| Finding | Stand | Fundstelle im Plan | Kurzbegründung |
|---|---|---|---|
| H-1 Statusfunktionen fehlen in S9b-1 | erledigt | `S9b_PLAN.md:40`, `:116-118`, `:135`, `:137`, `:170` | Beide Funktionen entstehen in 0023. Matrix, Paare und Rot-Beweise sind damit in S9b-1 ausführbar. Laut Abhängigkeit braucht S9b-1 nichts über 0022 hinaus. |
| M-1 Marker nicht zeilengebunden, `verified_*` am falschen Marker | erledigt | `:29`, `:90-91`, `:70`, `:147` | Marker sind jetzt `<partner_id>:<alt>><neu>` bzw. `<partner_id>`. `verified_at` setzt nur der Trigger bei `pending → active`. Die Begründungspflicht prüft zusätzlich der Trigger. Rot-Beweis 3 misst die Zeilenbindung. |
| M-2 Löschpfad Testfirmen/admin-Konto | erledigt | `:33`, `:84-85`, `:93`, `:70`, `:140` | Löschen in `partner_vat_rules` nur mit dem Firmenmarker. `verified_by` ist entfallen, es gibt keinen FK auf das admin-Konto. Testfall vorhanden. Dateien im Bucket sind nicht abgedeckt, siehe R2-M3. |
| M-3 Dokumente: Policy/Trigger ohne Leserecht | erledigt | `:182`, `:185-187`, `:317`, `:323` | Der Trigger ist SECURITY DEFINER, `partner_document_slot` hat keinen Firmenparameter. admin kann Zeilen entfernen, das Lesen der Metadaten entspricht Konzept `:384`. Rest siehe R2-N3. |
| M-4 `commission_book` als RPC für `service_role` | erledigt | `:280`, `:290`, `:296`, `:305`, `:319` | `private.commission_book` hat keinen Grant. Test und Rot-Beweis gibt es je für `service_role` und `authenticated`. Die S9c-Pflicht ist benannt. |
| M-5 Journal-Trigger (Korrektur frei, Bezug Revision, Gleichstand) | erledigt (für `booking`, Gegenbuchungen) | `:265`, `:277-279`, `:296`, `:305` | `correction` braucht jetzt eine Bezugszeile. Gegenbuchbar sind nur `booking`, `change` und `cancellation_fee`. Bei `booking` wird gegen Revisionsbetrag, `current_revision` und den Ausdruck von `current_fee_rates` geprüft. Neue Lücke bei `change`, siehe R2-M1. |
| M-6 `vat_rule` ohne Rechenwirkung | erledigt | `:7`, `:117`, `:180`, `:267`, `:296`, `:354` | Funktionen und Journal-CHECK nehmen nur `standard_20` an. Sicherheit und Geld sind damit konsistent, siehe Antwort (5). |
| M-7 Rot-Beweise messen zweite Schicht | erledigt | `:144`, `:149`, `:153`, `:155`, `:233`, `:304-305` | Messung isoliert, Aufteilung 5a/5b/5c, 9a/9b. S9b-3 lockert über `partner_of_user()`. Formulierung 11b widersprüchlich, siehe R2-N6. |
| M-8 Abschnitt 8 unvollständig, Revoke-Regel | erledigt | `:28`, `:110`, `:120`, `:311-327` | Revoke-Regel inklusive `service_role`. Spalten-, Tabellen- und Storage-Grants sind aufgeführt, der Helfer `partner_document_slot` und `commission_book` (ohne Grant) ebenfalls. |
| M-9 Dauer-Fixture im Journal | erledigt | `:7`, `:45`, `:294`, `:309`, `:335` | Es gibt keine Dauer-Fixture, die Journal-Tests laufen im Rollback. S9b-4 hängt nicht von S9b-3 ab. |
| N-1 Snapshot/Restprüfung | teilweise | `:344-345` | Bucket-Zeilen, Spaltendefaults, View-Optionen, Schema- und Default-ACL, `tgenabled` gegen Snapshot, Auth-Konten und Faktoren sind ergänzt. Neu: Die ACL wird nur für drei Rollen verglichen, und die Bucket-Prüfung ist falsch zugeschnitten (R2-N5, R2-M3). |
| N-2 Registrierung admin, Selbstfreigabe, Wettlauf | erledigt | `:117`, `:120`, `:136` | Rolle `customer` ist Pflicht, `self_approval` greift, `unique_violation` wird zu `already_member`, Länder-Test per Eigentümer-Insert. Rest siehe R2-N1. |
| N-3 Rückwirkung als CHECK | erledigt | `:180`, `:192` | Prüfung in der Funktion mit `vat_rule_backdated`. |
| N-4 Widersprüche Plan/Konzept | teilweise | `:24`, `:31`, `:168`, `:280` | Fehlercode-Zuordnung und `aal1`-Regel sind bereinigt. AK 6 nennt Konzept `:276`, `:381`, `:422` nicht. Der Versionsparameter von `commission_book` ist weiter offen, siehe R2-N4 und R2-N9. |
| N-5 veraltete Testreferenzen, `select('*')` | erledigt | `:25`, `:218`, `:229`, `:299` | Die Stellen sind korrigiert (geprüft: `rls.test.ts:320-357`, `:324`). Doppelte Zuständigkeit siehe R2-N8. |
| N-6 N-5 aus OPEN_ISSUES | erledigt | `:138`, `:168` | Test aufgenommen, Übergabe an S9d. |
| N-7 Unit-Test Negation, admin mit echtem Token | erledigt | `:225`, `:298` | Beides vorhanden. |
| N-8 `profiles.role` | erledigt | `:32`, `:136` | Bleibt `customer`, Test vorhanden. |
| N-9 keine SQL-Neuberechnung | erledigt | `:280`, `:295`, `:300`, `:334` | Gegenrechnung mit `splitFee` in den Tests und im S9g-Export. |
| N-10 Kosten/Spam Registrierung | erledigt | `:202`, `:331` | Eintrag in `GOLIVE.md`. Die Fundstelle verweist auf `OPEN_ISSUES.md:131`, der eigentliche Captcha-Punkt steht in `:183` (R2-N9). |

## 2. Neue Findings

### Hoch

Keine.

### Mittel

**R2-M1 · Journal-Trigger bindet `change` und `cancellation_fee` nicht an Auftrag, Firma und Revision; Testfall widerspricht dem Konzept**
- Stellen: `docs/S9b_PLAN.md:279` (bei `change` und `cancellation_fee` werden nur Sätze, Versionen und `vat_rule` der `booking`-Zeile geprüft), `:277` (gleiche Firma nur bei Gegenbuchungen), `:295` („`change` mit negativer Differenz“ als erlaubter Fall), `:334` (Risiko 4: „die SQL-Seite prüft … Revisionsbetrag“). Konzept `S9_KONZEPT.md:307` (Nachtrag „nur erhöhend“), `:557` (`change` = Differenz der Komponenten zur Summe der bisherigen Zeilen).
- Fehlszenario: (a) Ein Fehler in der späteren Nachtragsfunktion (S9f) oder in der Edge Function bucht eine `change`-Zeile mit beliebigem Betrag. Alle Prüfungen bestehen, solange `fee_parts`/`payout_rest` stimmen. Die Provision des Auftrags entspricht dann nicht mehr dem vereinbarten Gesamtpreis, und die Zeile lässt sich nur gegenbuchen. (b) `change` oder `cancellation_fee` landen bei einer anderen Firma als die `booking`-Zeile desselben Auftrags (keine Prüfung auf gleiche `partner_id`). (c) `change` ohne vorhandene, nicht gegengebuchte `booking`-Zeile oder nach einem Storno. (d) Der Plan testet eine negative `change`-Zeile als erlaubt, das Konzept lässt nur Erhöhungen zu. Zwei gleichzeitige `change`-Buchungen sehen dieselbe Summe der Vorzeilen.
- Vorschlag: Der Trigger prüft für `change`: Es gibt eine `booking`-Zeile des Auftrags ohne Gegenbuchung, mit gleicher `partner_id`, gleichem Satz, gleichen Versionen und gleicher `vat_rule`. Die Revision ist `current_revision` mit `source = 'change_order'` und `total_cents is not null`. Es gilt `total_cents = revision.total_cents − Summe(total_cents aller bisherigen Zeilen des Auftrags)` und `total_cents > 0`. Für `cancellation_fee` zusätzlich gleiche `partner_id` wie die `booking`-Zeile. Die Prüfung läuft unter einer Sperre der Auftragszeile (`for update` in `commission_book` vor dem Insert), damit Summen nicht parallel veralten. Testfall `:295` auf „`change` mit positiver Differenz; negative → `amount_mismatch`“ umstellen. Rot-Beweis „Differenzprüfung `change` entfernen (Ist-Wert: `change` mit beliebigem Betrag gespeichert)“. Das ist keine zweite Gebührenrechnung: Geprüft wird nur der Gesamtbetrag gegen die Revision, `fee_*` bleibt bei `splitFee`.

**R2-M2 · `commission_book` prüft den Firmenstatus ohne Sperre der Partnerzeile**
- Stellen: `docs/S9b_PLAN.md:280` („`booking` nur für Firmen im Status `active`“, „`vat_rule` liest die Funktion selbst“, keine Sperre genannt), `:106` (Statusfunktionen sperren mit `for update`). Konzept `S9_KONZEPT.md:252` („prüft Mitgliedschaft und Status in derselben Transaktion unter Sperre der Partnerzeile“).
- Fehlszenario: `accept` (S9c) ruft `commission_book` auf. Die Funktion liest unter READ COMMITTED `status = 'active'`, zur selben Zeit setzt `admin_set_partner_status` die Firma auf `suspended` und schließt (ab S9c/S9e) die offenen Listings. Der Fremdschlüssel nimmt nur `FOR KEY SHARE` und blockiert das Status-UPDATE nicht. Beide committen, und es entsteht eine Buchung samt Zuordnung für eine gesperrte Firma, die die Listing-Schließung nicht mehr erfasst. Bei `vat_rule` gilt dasselbe (Phase 2).
- Vorschlag: `commission_book` liest die Partnerzeile mit `for share` (blockiert das Status-UPDATE bis zum Commit) und erst danach Status und `vat_rule`. Für `change`, `cancellation` und `cancellation_fee` zusätzlich die Auftragszeile mit `for update` (siehe R2-M1). Test „Annahme gegen Sperre parallel: genau eines gewinnt“ in S9c als Pflicht in `OPEN_ISSUES.md` eintragen. In S9b-4 genügt ein Test mit zwei Sitzungen nicht über `ownerSql`; deshalb Plan-Eintrag als Pflicht für die S9c-Nebenläufigkeitstests (Konzept `:650`).

**R2-M3 · Dateien im Bucket `partner-documents` werden nie aufgeräumt; die Restprüfung prüft den ganzen Bucket**
- Stellen: `docs/S9b_PLAN.md:33` (`ownerDeletePartner` löscht nur Zeilen), `:182` (Datei entfernt „der Eigentümer über die Storage-API“), `:194` (Tests laden tatsächlich hoch), `:345` („keine Objekte im Bucket `partner-documents`“).
- Fehlszenario: `partner-admin.test.ts` lädt Dateien hoch, und `ownerDeletePartner` entfernt danach nur die Zeilen. Die Dateien bleiben ohne Zeile dauerhaft in Dev, mit Firmendaten im Pfad. Die Restprüfung des Redproofs (es lässt die Tests laufen) findet Objekte, und AK 3 aus S9b-2 sowie die Gesamt-AK in `:309` werden rot. Sobald Beks in Dev echte Unterlagen testet, wird die Prüfung „keine Objekte“ nie mehr grün. Ohne Transaktion kann `ownerDeletePartner` außerdem halb löschen (Regeln weg, Firma bleibt), wenn die Firma noch Kinder hat.
- Vorschlag: Die Testhilfe entfernt vor dem Löschen der Zeilen die Dateien der Firma über die Storage-API (`service_role`, Präfix `{partner_id}/`) und löscht die Zeilen in genau einer Transaktion (`begin … commit`). Die Restprüfung prüft nur Objekte unter den Firmen-IDs der Redproof-Firmen (Präfix `mvtest-redproof` im Firmennamen → IDs) bzw. keine Objekte ohne Zeile in `partner_documents`.

### Niedrig

**R2-N1 · Selbstverwaltung eines admin, der zugleich Mitglied ist, nur bei der Freigabe gesperrt**
- Stellen: `:117` (`self_approval` nur in `admin_approve_partner`), `:118`, `:179-182`; `0016_settings_admin.sql:166-176` (`admin_grant_role` kann später einem Mitglied die Rolle admin geben).
- Fehlszenario: Ein Konto registriert als Kunde eine Firma und bekommt später vom Eigentümer die Rolle admin. Dann kann es mit sich selbst als `p_actor` die eigene Sperre aufheben (`suspended → active`) und Scope oder Stammdaten der eigenen Firma ändern. Die Hürde ist hoch, weil nur der Eigentümer admin vergibt.
- Vorschlag: Die `self_approval`-Prüfung kommt in alle sechs `admin_*`-Partnerfunktionen (Code z. B. `self_approval` oder `self_admin`). Alternativ verweigert `admin_grant_role` die Rolle admin für Mitglieder. Ein Test je Funktion.

**R2-N2 · `active` ohne Scope erreichbar; der Trigger unterscheidet Freigabe und Statuswechsel nicht**
- Stellen: `:90` (Paar und Marker), `:118` (`admin_set_partner_status` „außer der Freigabe“), `:179` (Scope nur „bei Status `active`“ je mindestens eins).
- Fehlszenario: admin leert den Scope einer `suspended`-Firma und setzt sie mit `admin_set_partner_status` auf `active`. Die Firma ist dann aktiv ohne Kategorie und Bezirk. Ein Fehler in `admin_set_partner_status` könnte außerdem `pending → active` setzen (Paar gültig, Marker gültig), ohne Scope, ohne USt.-Regel und ohne `self_approval`. Dabei entsteht kein Geldleck: Die Buchung scheitert an `vat_rule_missing`.
- Vorschlag: Der Trigger prüft beim Ziel `active`, dass es mindestens eine Kategorie, einen Bezirk und eine gültige USt.-Regel gibt (`scope_incomplete` bzw. `vat_rule_missing`). Alternativ prüft `admin_set_partner_status` den Scope beim Ziel `active`, und der Marker der Freigabe bekommt ein eigenes Kennzeichen (z. B. `<id>:pending>active:approve`), das nur `admin_approve_partner` setzt.

**R2-N3 · `partner_document_slot` prüft den Firmenstatus nicht**
- Stelle: `:186` (Firma und `aal2`, kein Status), `:185` (Status nur in der Insert-Policy der Tabelle).
- Fehlszenario: Eine Firma legt als `pending` Zeilen an, wird `rejected` oder `suspended` und lädt danach noch Dateien in diese Plätze hoch.
- Vorschlag: Der Helfer verlangt Status `pending`, `active` oder `payment_hold` wie die Tabellen-Policy. Ein Test „abgelehnte Firma lädt in vorhandenen Platz → 42501“.

**R2-N4 · Schnittstelle von `commission_book` passt nicht zum Text und zum Konzept**
- Stellen: `:280` (Signatur ohne `p_fee_rate_version`/`p_fee_vat_rate_version`; Text: „übergibt die Beträge **und** die Satzversionen“; `p_partner` als Parameter; `vat_rule` „gültige Regel zum Buchungstag“ für alle Arten), `:261`, `:277`, `:279`; `0016_settings_admin.sql:69-78` (`current_fee_rates` liefert keine Versionen); Konzept `S9_KONZEPT.md:252` (`partner_id` wird abgeleitet; für N2, T12, T13, T14 werden Satz und `vat_rule` aus der `booking`-Zeile gelesen).
- Fehlszenario: Die Session muss raten, woher die Versionsspalten kommen. Holt die Funktion sie selbst, prüft der Trigger nur die Werte. Das ist sicher, aber nicht das, was Konzept und Plantext sagen. Liest sie für `change`, `cancellation` und `cancellation_fee` die heute gültige `vat_rule`, scheitert in Phase 2 jede Buchung nach einem Regelwechsel am Trigger (`:277`, `:279`). Die Edge Function kann keine Versionen übergeben, weil die View keine liefert.
- Vorschlag: Eine der beiden Varianten festlegen. (a) Die Versionen sind Parameter, der Trigger vergleicht sie, und `current_fee_rates` bekommt `fee_rate_version`/`fee_vat_rate_version` (Spalten-Grant prüfen). (b) Die Funktion leitet die Versionen selbst ab, und Plan und Konzept sagen das. Für alle Arten außer `booking` liest `commission_book` Satz, Versionen und `vat_rule` aus der `booking`-Zeile. `p_partner` bleibt bis S9c; die S9c-Pflicht lautet „`partner_id` aus `assignments` ableiten, nicht als Parameter prüfen“.

**R2-N5 · Snapshot vergleicht Tabellen- und Spalten-ACL nur für drei Rollen**
- Stelle: `:344` („Tabellen- und Spalten-ACL für `anon`, `authenticated`, `service_role`“). Das Vorbild vergleicht die vollständige ACL (`scripts/redproof-s9a4.mjs:43`, `:45`).
- Fehlszenario: Eine Lockerung oder eine fehlerhafte Wiederherstellung hinterlässt einen Grant an `PUBLIC` oder an eine andere Rolle. Der Vergleich bleibt grün.
- Vorschlag: `relacl`/`attacl` vollständig als Text vergleichen, dazu `relforcerowsecurity` sowie Spaltentyp und `NOT NULL` je Spalte der neuen Tabellen.

**R2-N6 · Rot-Beweise: Formulierung 11b widersprüchlich, Satzprüfung der `booking`-Zeile ohne Rot-Beweis**
- Stellen: `:155` (11b „nur die Policy-Sperre (Grant offen) → kein Eintrag“: Bei offenem Grant und gelockerter Policy entstünde ein Eintrag), `:305` (Rot-Beweise S9b-4 ohne die Satz- und Versionsprüfung bei `booking`, die auch nicht in der Liste „ohne Rot-Beweis“ steht), `:278`.
- Vorschlag: 11b umformulieren: „nur die Policy lockern, Grant bleibt widerrufen → kein Eintrag, 42501, Ausweis Schicht“. In 7.4 ergänzen: „Satzprüfung `booking` entfernen (Ist-Wert: `booking` mit Satz ≠ `current_fee_rates` gespeichert)“, isoliert bei korrektem Revisionsbetrag. `cancellation_fee`-Obergrenze und `self_approval` entweder mit Rot-Beweis oder in der Liste „ohne Rot-Beweis“ führen.

**R2-N7 · Allowlist-Test erfasst `service_role` nicht**
- Stellen: `:131` (`admin_*` „nur `service_role`“ in der Allowlist), `:290` (`commission_book` ohne Grant). Test `tests/rls/rls.test.ts:453`, `:461-463` (nur `anon`/`authenticated`).
- Fehlszenario: Die `admin_*`-Funktionen erscheinen nie in der Liste. Ein versehentlicher Grant von `commission_book` an `service_role` fiele nur im Einzeltest `:296` auf, nicht in der Allowlist.
- Vorschlag: Den Allowlist-Test um die Spalte `service_role` erweitern und die erwartete Liste mit `service_role`-Einträgen festschreiben (`commission_book` ohne jede Rolle).

**R2-N8 · Reihenfolge S9b-3/S9b-4 und doppelte Testzuständigkeit**
- Stellen: `:42-43` (0025 für S9b-3, 0026 für S9b-4), `:45`, `:237` (S9b-4 kann vor S9b-3 laufen), `:309` („bis 0026“), `:229` und `:299` (beide ersetzen `rls.test.ts:320-357` und dieselben `quote.test.ts`-Stellen).
- Fehlszenario: Läuft S9b-4 zuerst, trägt seine Migration den früheren Zeitstempel. Die Nummern 0025/0026 sind dann vertauscht, und S9b-3 müsste eine Migration vor einer bereits gepushten einsortieren. Beide Teile bauen dieselben Tests um.
- Vorschlag: Nummer und Name erst beim Anlegen vergeben (die nächste freie). AK: „lokal = remote bis zur eigenen Migration“. Die Tests zu `fee_splits` gehören zu S9b-4, die Tests zum Vermieter-Satz zu S9b-3.

**R2-N9 · Verweise und Konzept-Bereinigung unvollständig**
- `:3` verweist auf `docs/proof/s9b0/s9b0-plan-abnahme.md`; die Datei gibt es noch nicht (der Bericht liegt unter `tmp/proof/`). Beim Abschluss kopieren oder den Verweis anpassen.
- AK 6 (`:168`) lässt aus: Konzept `S9_KONZEPT.md:276` („der Partner ändert nur Stammdaten“), `:422` (Testmatrix: „Mitglied ändert Stammdaten“ als erlaubt), `:381` (`commission_entries` für `service_role` „I“; der Plan hat kein DML und keinen Funktionszugriff) und die Spalte `service_role` „alle“ in `:382-384`, `:386` (der Plan hat „nur S“).
- `:202` verweist für den Captcha-Punkt auf `OPEN_ISSUES.md:131`; der Punkt steht in `:183`.

## 3. Antworten auf die Prüffragen

**(1) Rechteausweitung oder Querzugriff zwischen Partnerfirmen, Kunden und anon?** Im Entwurf nicht.
- Selbstzuweisung ist ausgeschlossen: kein Grant auf `partner_members` (`:129`), `register_partner` legt immer eine neue Firma an und nimmt keine `partner_id` an (`:120`), dazu `unique (user_id)` (`:80`).
- Querzugriff verhindern die Policies über `partner_of_user()`/`my_member_partner_id()` (`:129`, `:290`). Der Dokumentenhelfer hat keinen Firmenparameter (`:186`).
- `anon` hat keinen Grant und keine USAGE auf `private` (`0001_foundation.sql:14` vergibt USAGE nur an `authenticated`). `register_partner` und die Helfer sind für `anon` widerrufen (`:110`, `:120`).
- Die Rolle `partner` in `profiles` bleibt ohne Wirkung (`:32`).
- Die `admin_*`-Funktionen sind nur über `service_role` oder den Eigentümer erreichbar, `p_actor` wird gegen die Rolle geprüft (`0015_versions_published.sql:55-63`).
- Rest: Ein admin, der zugleich Mitglied ist, kann die eigene Firma verwalten (R2-N1, niedrig). Eine abgelehnte Firma kann in vorhandene Plätze hochladen (R2-N3, niedrig).

**(2) Kann ein Kunde oder ein nicht freigegebener Partner die Gebühr oder fremde Journalzeilen lesen oder schreiben?**
- Ein Kunde ohne Firma kann es nicht. `platform_settings` liefert 0 Zeilen (Policy `:217`, Mitgliedschaft und `aal2` nötig), `current_fee_rates` ist `security_invoker` (`0016_settings_admin.sql:69`) und liefert NULL. `booking_terms()` hat keine `fee_*`-Schlüssel (`0016_settings_admin.sql:85`), `commission_entries` liefert 0 Zeilen (`:290`), und `commission_book` hat keinen Grant (`:280`).
- Ein nicht freigegebener Partner (`pending`, `suspended`, `rejected`) liest mit `aal2` den Satz. Das entspricht der Entscheidung von Beks und `CLAUDE.md`, die Folge ist in Risiko 1 benannt (`:331`). `note` bleibt per Spalten-Grant intern (`:218`).
- Fremde Journalzeilen liest niemand, die Firmenbedingung steckt im Helfer. Schreiben kann außer dem Eigentümer niemand.
- Offen für die Integrität (nicht für die Lesbarkeit): R2-M1 und R2-M2.

**(3) Ist `aal2` überall serverseitig erzwungen?**
- Ja, in den Helfern `my_member_partner_id`, `my_partner_id` und `my_job_partner_id` (`:112-114`), über diese in den Policies für Kontakt-Update, Satz, Journal und Dokument-Insert (`:129`, `:185`, `:217`, `:290`), im Storage-Helfer (`:186`) und für admin über `is_admin()` (`0015_versions_published.sql:10-12`). Die Rot-Beweise 5a–5c entfernen die Klausel je Helfer einzeln (`:149`).
- In S9b-3 wird das mit echten TOTP-Token gegen PostgREST bewiesen (`:224-226`).
- Ausnahmen mit `aal1` sind nur `register_partner` und das Lesen eigener Firmendaten (`:31`), ohne Satz, Journal oder Daten Dritter.
- Die `admin_*`-Funktionen haben kein `aal`, weil sie nur über `service_role` oder den Eigentümer laufen. Das ist die dokumentierte Grenze (Konzept `:252`).
- Grenze: Ein Token bleibt bis zu 3600 s gültig (`:332`).

**(4) Ist die Statusmaschine lückenlos?** Ja.
- Es gibt sieben Paare, alle anderen sind verboten, `rejected` ist Endzustand (`:97-106`).
- Paar und Marker werden getrennt geprüft, der Marker ist an die Zeile gebunden, Compare-and-Set läuft unter `for update` (`:90`, `:106`).
- Die Begründung prüfen Funktion und Trigger, `verified_at` setzt nur der Trigger (`:90`). INSERT ist nur als `pending` möglich (`:89`), DELETE nur mit dem zeilengebundenen Marker, TRUNCATE gar nicht (`:92`).
- Alle Übergänge sind in S9b-1 durchlaufbar (`:137`).
- Härtungen, niedrig: Das Ziel `active` prüft weder Scope noch USt.-Regel, und der Trigger unterscheidet die Freigabe nicht vom einfachen Statuswechsel (R2-N2).

**(5) Ist der Teilschnitt sinnvoll (max. 4, je eine Session)?**
- Ja, vier Teile, jeweils eine Session. S9b-1 ist der größte Teil (Schema, drei Funktionen, Helfer-Matrix mit 80 Fällen, das neue Redproof-Skript mit erweitertem Snapshot). Die Session sollte das Gerüst aus `scripts/redproof-s9a4.mjs` übernehmen, statt es neu zu schreiben. S9b-4 ist unabhängig von der TOTP-Vorarbeit.
- Zu den drei Entwurfsänderungen, die Beks bestätigen soll:
  - (a) `vat_rule` nur `standard_20`: Für Geld und Sicherheit richtig, weil `splitFee` keine Regel kennt. Das Journal bleibt damit konsistent, und der CHECK lässt sich in Phase 2 ersetzen.
  - (b) Keine Dauer-Fixture: richtig. Es bleiben keine unlöschbaren Provisionszeilen ohne Vertrag zurück, und der Echt-Token-Beweis liegt beim Helfer.
  - (c) Statusfunktionen in S9b-1: nötig, sonst wäre S9b-1 nicht beweisbar (H-1).
- Die Reihenfolge der Migrationsnummern siehe R2-N8.

**(6) Messen die geplanten Rot-Beweise Ist-Werte, und deckt der Snapshot alles ab, was `INNER` öffnet, inklusive Restprüfung?**
- Ja, mit Ausnahmen. Alle Beweise nennen einen zurückgelesenen Ist-Wert (Status, Zeile, Name, Zeilenzahl, Aufrufergebnis). Zweischichtige Sperren werden isoliert gemessen wie `redproof-s9a4.mjs:481-495`.
- Der Snapshot umfasst die ganzen Schemata `public`, `private` und `storage`. Das Skript bricht ab, wenn `INNER` ein nicht erfasstes Objekt öffnet (`:344`). Damit ist A4c-N3 behoben.
- Lücken:
  - Die ACL wird nur für drei Rollen verglichen (R2-N5).
  - Die Bucket-Restprüfung ist so nicht erfüllbar (R2-M3).
  - Die Formulierung von 11b ist widersprüchlich, und der Satzprüfung der `booking`-Zeile fehlt ein Rot-Beweis (R2-N6).
  - Zu R2-M1 fehlt ein Beweis, er kommt mit dem Fix.

## 4. Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `supabase/migrations/20261101170000_0016_settings_admin.sql:69-78` | `current_fee_rates` liefert Wert und `effective_from`, keine Version: Grundlage für R2-N4 |
| `…_0016_settings_admin.sql:130-147`, `:165-181` | Rollen-Marker `<id>:<rolle>`; `admin_grant_role` vergibt jede Rolle, auch an Mitglieder: Grundlage für R2-N1 |
| `…_0016_settings_admin.sql:188-189`, `:206-207` | Satz-Policy über `rental_provider`, `fee_splits_select` über `payee_id`: stimmt mit Plan `:14-15` überein |
| `…_0001_foundation.sql:93-100` | Spalten von `platform_settings`: key, version, value, note, created_at (dazu `effective_from` aus 0016:23): Spalten-Grant `:218` lässt note und created_at weg, die View braucht sie nicht |
| `…_0001_foundation.sql:14` | USAGE auf `private` nur für `authenticated`: stimmt |
| `…_0015_versions_published.sql:10-12`, `:19-51`, `:55-63` | `is_admin()` mit `aal2`; `audit_log` mit `actor_role` customer/admin; `assert_admin` nur Rolle: stimmt mit Plan `:13`, `:15` überein |
| `…_0017_status_machine.sql:219-234` | Paar-, dann Markerprüfung, Marker `<id>:<status>`: Muster für Plan `:90` |
| `…_0017_status_machine.sql:138-147` | `immutable_row` mit Kaskaden-Ausnahme: stimmt |
| `…_0018_revisions_contacts.sql:10-31` | `price_revisions.total_cents int`, `unique (id, request_id)` (`:24`), FK mit Kaskade auf den Auftrag: der zusammengesetzte FK aus Plan `:253` ist umsetzbar, RESTRICT stoppt die Kaskade |
| `…_0018_revisions_contacts.sql:356` | Kommentar zu den Default-EXECUTE-Rechten: Grundlage für die Regel `:28` |
| `…_0020_photo_staging.sql:7-28` | `photo_staging_interval` als INVOKER nur für `service_role`: vom Spalten-Grant auf `platform_settings` nicht betroffen |
| `…_0021_photo_limits.sql:32-44` | Zählung über SECURITY DEFINER, uid aus `auth.uid()`: Muster für `partner_document_slot` `:186` |
| `…_0022_no_self_upgrade.sql:7` | `become_rental_provider` gelöscht: stimmt |
| `tests/rls/rls.test.ts:320-357`, `:324` | Gebühren- und `fee_splits`-Tests, `select('*')` mit `data ?? []`: Plan `:25`, `:229` stimmen |
| `tests/rls/rls.test.ts:450-469` | Allowlist prüft nur `anon`/`authenticated`: Grundlage für R2-N7 |
| `tests/support/owner.ts:39-42`, `:63-86` | `asUser`/`probes` mit Rollback und Claim-`aal`: trägt die Journal-Tests im Rollback (`:294`) |
| `tests/support/db.ts:30`, `:44-46` | `makeUser` committet Konten, `deleteUsers` über die Auth-API: Kaskade auf `partner_members` (`:76`) passt |
| `scripts/redproof-s9a4.mjs:43`, `:45` | vollständige `relacl`/`attacl`: Grundlage für R2-N5 |
| `scripts/redproof-s9a4.mjs:104-109`, `:150-172`, `:485-494` | `probe` mit Rollback, Restore im `finally`, `INNER`: Plan `:19`, `:346` stimmen |
| `docs/S9_KONZEPT.md:252` | Sperre der Partnerzeile, `partner_id` abgeleitet, eingefrorener Satz aus der `booking`-Zeile: Grundlage für R2-M2, R2-N4 |
| `docs/S9_KONZEPT.md:307`, `:557` | Nachtrag nur erhöhend; `change` = Differenz zur Summe der Vorzeilen: Grundlage für R2-M1 |
| `docs/S9_KONZEPT.md:276`, `:381`, `:382`, `:422` | „Partner ändert Stammdaten“, `service_role` „I“ bzw. „alle“: nicht in AK 6 (R2-N9) |
| `docs/OPEN_ISSUES.md:131`, `:183` | Der Captcha-Punkt steht in `:183`: R2-N9 |
| `docs/proof/s9b0/` | existiert nicht (Glob leer): R2-N9 |

## 5. Geprüft / Nicht geprüft

- **Vollständig gelesen:** `docs/S9b_PLAN.md`; der Runde-1-Bericht; Migrationen 0015, 0016, 0022; `tests/support/owner.ts`; `tests/support/db.ts`; `scripts/scan-proof.mjs`.
- **Abschnittsweise gelesen:** Migration 0017 (1–60, 134–280), 0018 (1–60 und Fundstellen zu Grants, `current_revision`, `fee_splits`), 0020 (1–30), 0021 (25–54), 0001 (Fundstellen zu `platform_settings`, `private`, `fee_splits`); `docs/S9_KONZEPT.md` 240–389, 543–572, 640–659 und Fundstellen zu T14/10.3; `docs/OPEN_ISSUES.md` an den genannten Zeilen; `docs/S9a_PLAN.md` 28–55; `scripts/redproof-s9a4.mjs` 1–180, 475–514 und Fundstellen; `tests/rls/rls.test.ts` 315–364, 440–471.
- **Nicht geprüft:** Migrationen 0002–0014 und 0019 (in dieser Runde nicht erneut gelesen; 0003 kenne ich aus Runde 1); `docs/ARCHITECTURE.md`; `tests/rls/quote.test.ts` (Zeilenangaben `:70, 175-184, 249, 295-297` nicht erneut geprüft); `supabase/config.toml` (Zeilen aus Runde 1 übernommen); der tatsächliche Zustand des Dev-Projekts (kein Datenbankzugriff); das Verhalten der Storage-API beim Upload ohne SELECT-Policy (der Plan verlangt dafür einen echten Upload-Test `:194`, das genügt); die Feuerreihenfolge der BEFORE-Trigger auf `partners` (alphabetisch: Die Feldprüfung läuft vor der Statusprüfung, die `verified_at` setzt; beides ist mit dem Plantext vereinbar, die Vorprüfung von 0023 muss es am Voll-SQL bestätigen); die Supabase-Dokumentation zu `mfa.enroll`/`verify` und `otpauth`.

Offene Findings hoch: 0
