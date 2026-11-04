# S9b-0 · Berater-Abnahme des Bauplans `docs/S9b_PLAN.md`

- Datum: 2026-11-04
- Geprüfter Stand: Branch `s9b0`, Commit 248f0f3 („S9b-0: Bauplan Entwurf“), Datei `docs/S9b_PLAN.md` (334 Zeilen, vollständig gelesen)
- Geprüft gegen: `docs/S9_KONZEPT.md` (3, 4.4, 4.5, 5.1–5.10, 6, 6.1, 9, 10.4, 11, 13, 14), `docs/OPEN_ISSUES.md` (Zeilen 10, 39–50, 210–231), `docs/S9a_PLAN.md` (Regeln und Schnitt), `CLAUDE.md`, Migrationen 0001, 0003, 0015, 0016, 0017, 0018, 0020, 0021, 0022, `tests/support/owner.ts`, `tests/support/db.ts`, `scripts/redproof-s9a4.mjs` (Teile), `tests/rls/rls.test.ts` (Teile), `supabase/functions/_shared/pricing/fee.ts`, `supabase/config.toml` (Teile)
- Art: Plan-Abnahme. Fehlendes Voll-SQL ist kein Finding; bewertet werden Entwurfsentscheidungen.
- Hinweis: In der Tool-Liste dieses Beraters steht ein eingebautes `advisor`-Werkzeug ohne Parameter. Es wurde gemäß `CLAUDE.md` nicht benutzt.

## Findings

### Hoch

**H-1 · S9b-1 kann die Status, die seine eigenen Tests und Rot-Beweise brauchen, nicht herstellen (Plan nicht umsetzbar)**
- Stellen: `docs/S9b_PLAN.md:27` (Fixtures setzen Status nur über die Admin-Funktionen, nicht über Marker), `:133` (in S9b-1 Status nur über die Registrierung, weitere erst mit S9b-2), dagegen `:128` (Helfer-Matrix über alle fünf Status), `:138` (Rot-Beweis 1 „aus active“), `:141` (Rot-Beweis 4 „Firma payment_hold“), `:145` (Rot-Beweis 8 „aktive Firma“), `:132` (jedes verbotene Paar), `:153` (AK 3 „alle Sperren rot“), `:158` (Abhängigkeit „keine über 0022 hinaus“). `admin_approve_partner` und `admin_set_partner_status` entstehen erst in S9b-2 (`:167-168`).
- Problem: In S9b-1 gibt es nur Firmen im Status `pending`. Die Matrix aus 4.4 und die Rot-Beweise 1, 4 und 8 sind ohne einen zweiten Weg zum Status nicht ausführbar. Der einzige andere Weg (Eigentümer setzt den Marker) ist nach `:27` verboten. Die Session müsste vom Plan abweichen oder AK 2 und 3 rot lassen.
- Fehlszenario: Die Session baut 0023, die Helfer-Matrix läuft nur für `pending`. `my_partner_id` mit fehlender Statusklausel (Rot-Beweis 4) bleibt unbewiesen. Bis S9b-2 steht eine Statusmaschine, deren Übergänge nie gelaufen sind.
- Fix (Vorschlag, bevorzugt): `admin_approve_partner` und `admin_set_partner_status` mit Compare-and-Set, Begründungspflicht und Audit nach S9b-1 (0023) ziehen. Sie gehören zur Statusmaschine, die Prüffrage der Vorprüfung (`:157`) lautet ohnehin „lückenlose Statusmaschine“. S9b-2 behält `admin_set_partner_scope`, `admin_set_vat_rule`, `admin_set_partner_master` und die Dokumente. Ersatzweise: Regel `:27` für S9b-1 so fassen, dass Eigentümer-SQL den Marker nur in `probes`-Transaktionen mit Rollback setzt; die Matrix läuft in S9b-2 noch einmal über die Funktionen.

### Mittel

**M-1 · Status- und Stammdaten-Marker sind nicht an die Zeile gebunden; `verified_*` hängt am falschen Marker**
- Stellen: Plan `:26`, `:86` (Marker `app.mv_partner_status` = `alt>neu`), `:87` (`app.mv_partner_master` ohne Inhalt, gilt auch für `verified_*`), `:167` (Freigabe setzt `verified_at/by`, ohne Angabe eines Markers). Bestehendes Muster: `0017_status_machine.sql:229` (Marker = `<id>:<status>`, Kommentar `:5` „bindet an die Zeile“), `0016_settings_admin.sql:136` (`<user>:<rolle>`). Der Lösch-Marker im Plan ist dagegen an die Firma gebunden (`:88`).
- Problem: Ein Marker ohne Firmen-ID lässt in derselben Transaktion jede weitere Firma mit demselben Paar durch. S9c und S9e erweitern `admin_set_partner_status` laut `:102` um weitere Schreibvorgänge in derselben Transaktion. `verified_at/by` lassen sich über den Stammdaten-Marker ändern. Damit kann der Weg über `admin_set_partner_master` eine Prüfung vortäuschen oder tilgen, und es ist offen, wie die Freigabe `verified_*` überhaupt setzen darf.
- Fehlszenario: Eine spätere Erweiterung aktualisiert in `admin_set_partner_status` eine zweite Firma (z. B. per Join-Update), solange der Marker `active>suspended` noch gesetzt ist. Die zweite Firma wird ohne eigene Prüfung und ohne Audit gesperrt.
- Fix: `app.mv_partner_status = '<partner_id>:<alt>><neu>'`, `app.mv_partner_master = '<partner_id>'`. `verified_at/by` ändern sich nur beim Übergang `pending>active`, dann setzt sie der Trigger selbst (`verified_at := now()`), nie über den Stammdaten-Marker. Zusätzlich im Trigger: Bei den Paaren mit Begründungspflicht (Tabelle 4.2) muss `status_reason` neu und nicht leer sein (zweite Schicht zur Funktionsprüfung `:168`).

**M-2 · Löschpfad für Testfirmen und Testkonten trägt nicht**
- Stellen: Plan `:80-81` (`partner_vat_rules` mit `on delete restrict`), `:89` (`append_only` auf `partner_vat_rules` inklusive DELETE), `:88` und `:313` (Testfirmen ohne Journal löscht der Eigentümer über den Marker), `:66` (`verified_by … on delete set null`), `:87` (`verified_*` nur mit Marker). Testhilfe `tests/support/db.ts:44-46` (`deleteUsers` löscht Konten über die Auth-API).
- Problem: (a) Jede freigegebene Firma hat eine Zeile in `partner_vat_rules`. Die Zeile ist ausnahmslos unlöschbar, und der Fremdschlüssel verhindert dann das Löschen der Firma, auch mit Marker. Testfirmen aus S9b-2 bis S9b-4 bleiben dauerhaft in Dev. (b) Löscht `deleteUsers` das Test-admin-Konto, löst `on delete set null` ein UPDATE auf `partners.verified_by` aus. `guard_partner_fields` lehnt es ohne Marker ab (`field_immutable`). Das Aufräumen scheitert, und in Produktion ließe sich ein admin-Konto nach der ersten Freigabe nicht mehr löschen.
- Fix: `append_only` auf `partner_vat_rules` mit genau einer Ausnahme, nämlich DELETE, wenn `app.mv_partner_delete` = `partner_id` (gleicher Marker wie bei der Firma). Alternativ Fremdschlüssel mit Kaskade und `immutable_row` (Tiefe > 1) wie in `0017_status_machine.sql:138-147`. `verified_by` ohne Fremdschlüssel speichern (wie `audit_log.actor_id`, `0015_versions_published.sql:22`). Testfall: Der Eigentümer löscht eine freigegebene Testfirma samt Regel, Kategorien und Bezirken; das admin-Testkonto lässt sich löschen.

**M-3 · Partner-Dokumente: Policy und Limit-Trigger lesen eine Tabelle, die der Partner nicht lesen darf**
- Stellen: Plan `:173` (Storage-Insert nur in eingetragene Pfade, Lesen der Tabelle nur admin, Limit 5 unter Advisory-Lock, Trigger setzt `partner_id` und Pfad), `:175` („Neue EXECUTE-Freigaben: keine“). Muster: `0021_photo_limits.sql:32-44` (Zählung über SECURITY DEFINER, weil eine Policy sonst mit den Rechten des Aufrufers liest).
- Problem: Unterabfragen in Storage-Policies und in Trigger-Funktionen ohne SECURITY DEFINER laufen mit den Rechten des Partners. Ohne SELECT-Grant und Policy auf `partner_documents` endet die Prüfung „Pfad ist eingetragen“ mit 42501 oder findet keine Zeile. Der Upload ist dann nie möglich, ebenso die Zählung im Trigger. Die Lösung braucht einen SECURITY-DEFINER-Helfer mit EXECUTE für `authenticated`, und das widerspricht `:175`. Außerdem belegt eine Zeile ohne Datei (Upload abgebrochen) ihren Platz dauerhaft: Der Partner kann nicht löschen, admin hat keine Funktion dafür. Nach fünf Fehlversuchen kommt nur noch `limit_reached`.
- Widerspruch zum Konzept: `S9_KONZEPT.md:384` (Partner „S eigene Metadaten“) gegen Plan `:173` (Partner liest nicht).
- Fix: `private.partner_document_slot(p_name text) returns boolean` (SECURITY DEFINER, `search_path = ''`, Firma und `aal2` aus `auth.uid()`/`auth.jwt()`, keine Firmen-ID als Parameter). Der Insert-Trigger wird SECURITY DEFINER. Beides kommt in die Allowlist und in Abschnitt 8. Das Limit zählt nur Zeilen mit vorhandenem Objekt, oder admin bekommt eine Funktion zum Entfernen verwaister Zeilen. Zum Metadaten-Lesen eine Entscheidung treffen und das Konzept angleichen.

**M-4 · `commission_book` als eigenständige RPC für `service_role` erlaubt Buchungen ohne Vertrag**
- Stellen: Plan `:266` (`public.commission_book`, EXECUTE `service_role`, Zuordnungsprüfung erst mit S9c), `:301`. Konzept `S9_KONZEPT.md:252`: Die eine SQL-Funktion des Übergangs schreibt Compare-and-Set, Revision und Journal in einer Transaktion; `partner_id` wird abgeleitet, nie übernommen.
- Problem: Bis S9c prüft nichts, ob der Auftrag angenommen ist oder ob die Firma zugeordnet ist. Jeder Codepfad mit dem Secret-Key, jede Edge Function und jedes Skript kann für eine beliebige aktive Firma auf einen beliebigen Auftrag eine `booking`-Zeile buchen, auch auf einen Auftrag im Status `requested`. Das ist eine Provisionsforderung ohne Vertrag. Der Unique-Index `:258` sperrt danach die echte Buchung dieses Auftrags. Eine fehlerhafte Zeile lässt sich nur gegenbuchen, nie entfernen.
- Fix: `private.commission_book(...)` ohne EXECUTE-Grant an irgendeine Rolle (nur Eigentümer). Die Übergangsfunktionen ab S9c laufen als `postgres` und rufen sie auf; die Journal-Tests laufen ohnehin als Eigentümer im Rollback (`:280`). Der Rot-Beweis „Grant an authenticated“ wird zu „EXECUTE an `service_role` bzw. `authenticated`“ (Aufruf erfolgreich, Zeile vorhanden). Die Pflichtzeile für S9c (Zuordnung und Auftragsstatus `accepted` in derselben Transaktion) bleibt wie in `:266` beschrieben.

**M-5 · Journal-Trigger: Korrekturen und Gegenbuchungen frei, Buchungsbetrag ohne Bezug zur Revision**
- Stellen: Plan `:255` (`reverses_shape` erlaubt `correction` ohne `reverses_entry_id`), `:256`, `:262`, `:265` (Negationsprüfung nur bei `cancellation`, keine Prüfung der Art der gegengebuchten Zeile, keine Betragsprüfung bei `booking`). Konzept `S9_KONZEPT.md:324` („Korrekturen nur als Gegenbuchung“), `:562-564`, `0018_revisions_contacts.sql:19, 26-30` (`price_revisions.total_cents`).
- Problem: (a) Eine `correction` ohne Bezugszeile bucht beliebige Beträge mit beliebigem Vorzeichen (für `correction` gilt kein `non_negative`). (b) Eine `cancellation` darf eine `cancellation` oder `correction` gegenbuchen. Damit lebt eine stornierte Provision wieder auf, und der Unique-Index `:259` verhindert das nicht, weil die Bezugszeile jeweils neu ist. (c) `booking.total_cents` muss nicht dem Festpreis der Revision entsprechen. Eine Buchung auf 1 Cent oder auf das Zehnfache besteht alle Prüfungen. Ein solcher Abgleich ist keine zweite Gebührenrechnung im Sinne von Konzept 9.1. (d) Für „geltender Satz“ fehlt die Regel bei Gleichstand (`0016_settings_admin.sql:69-78`: höchste Version).
- Fix: Für `correction` ist `reverses_entry_id` Pflicht, und die Zeile ist eine exakte Negation wie bei `cancellation`. Gegenbuchbar sind nur `booking`, `change` und `cancellation_fee`. Bei `booking`: Die Revision hat `total_cents is not null`, `total_cents` der Zeile ist gleich `price_revisions.total_cents`, und die Revision ist `current_revision` des Auftrags. Bei `cancellation_fee`: `0 ≤ total_cents ≤` Gesamtpreis der `current_revision`. Den Satz mit genau dem Ausdruck von `current_fee_rates` bestimmen. Je ein Test mit Rot-Beweis.

**M-6 · `vat_rule` ohne Rechenwirkung: Journal inkonsistent oder Buchung unmöglich**
- Stellen: Plan `:49`, `:167`, `:170`, `:248`, `:265`. `supabase/functions/_shared/pricing/fee.ts:17-25` (`splitFee` kennt nur `vatRate`, keine Regel). Konzept `S9_KONZEPT.md:272`, `:620` (Frage Recht 9 und Steuerberatung offen). Entscheidung Beks: Phase 1 nur Sitz AT.
- Problem: admin kann `reverse_charge` oder `none` setzen. Rechnet die Edge Function trotzdem mit 20 %, steht `vat_rule = none` neben `fee_vat_cents > 0`. Gibt sie `vatRate = 0` weiter, lehnt der Trigger mit `rate_mismatch` ab, und die Firma kann nie gebucht werden. Beides wird erst in S9c sichtbar und ist dann im Journal unumkehrbar.
- Fix: In Phase 1 nehmen `admin_approve_partner` und `admin_set_vat_rule` nur `standard_20` an (Code z. B. `vat_rule_not_enabled`, analog zu `rental`). Der Journal-Trigger verlangt bis Phase 2 `vat_rule = 'standard_20'`. Das Enum bleibt. Eintrag in `OPEN_ISSUES.md` mit Frage 14 und Frage Recht 9.

**M-7 · Rot-Beweise mit falscher Erwartung: eine zweite Schicht greift (Methode M-3)**
- Stellen: Plan `:143` (Rot-Beweis 6: Spalten-Grant um `name` erweitern, erwartet „Name geändert“; `guard_partner_fields` `:87` lehnt ohne Marker mit `field_immutable` ab). `:145` (Rot-Beweis 8: INSERT-Grant auf `partner_members`; es gibt keine INSERT-Policy, RLS lehnt ab, und die „aktive Firma“ fehlt nach H-1). `:289` (S9b-4: `revoke … from service_role` zurücknehmen, erwartet „DELETE entfernt die Zeile“; der Trigger `append_only` `:264` lehnt ab). `:140` (Rot-Beweis 3: drei Helfer in einer Lockerung). `:223` („`aal2`-Klausel der Policy“: die geplante Policy `:208` enthält keine, die Klausel steckt im Helfer).
- Problem: Diese Beweise messen den Fehler der zweiten Schicht, nicht die Wirkung der gelockerten Sperre. Nach `CLAUDE.md` zählen sie nicht als Rot-Beweis. AK 3 aus S9b-1 und die Gesamt-AK aus S9b-4 wären nicht erfüllbar oder würden falsch als „rot“ gewertet.
- Fix: Isoliert messen wie `redproof-s9a4.mjs:481-495`: Die innere Schicht wird nur in der Probe-Transaktion geöffnet (Trigger aus bzw. INSERT-Policy), umgeschaltet wird allein die Zielsperre. Alternativ als „Schicht“ ausweisen und einen isolierten Sperre-Beweis ergänzen. Rot-Beweis 3 in drei Lockerungen teilen. In S9b-3 die Policy lockern, indem `my_member_partner_id()` durch `partner_of_user()` ersetzt wird.

**M-8 · Rechte-Zusammenfassung (Abschnitt 8) unvollständig, obwohl Beks danach freigibt**
- Stellen: Plan `:295-305`, `:25` (nur `revoke all … from public`), `:120` (UPDATE `contact_*`), `:116-118` (SELECT-Grants), `:173` (Insert in `partner_documents`, Storage-Policies). Beleg für Default-Rechte: `0018_revisions_contacts.sql:356` („Supabase vergibt Execute per Default an anon und authenticated“).
- Problem: Es fehlen: UPDATE (`contact_name`, `contact_phone`, `contact_email`) auf `partners` für `authenticated`; SELECT auf `partners`, `partner_members`, `partner_categories`, `partner_regions` und `partner_vat_rules`; INSERT (`id`, `kind`) auf `partner_documents` samt Policy; die Storage-Policies für `partner-documents` (Insert Partner, Select admin); der Helfer aus M-3. Für `register_partner` reicht `revoke … from public` nicht. Ohne ausdrückliches `revoke … from anon, service_role` hat `anon` nach den Default-Rechten EXECUTE, und das widerspricht `:122`. Der Allowlist-Test fängt das zwar ab, die Regel in `:25` ist aber falsch formuliert.
- Fix: Abschnitt 8 um diese Zeilen ergänzen, jeweils mit Begründung. Regel `:25` auf `revoke all … from public, anon, authenticated` (bzw. zusätzlich `service_role`) mit anschließend gezieltem Grant umstellen, wie in `0015_versions_published.sql:249-260`.

**M-9 · Dauer-Fixture im Journal (Berater-Prüfpunkt `:284`): nicht freigegeben**
- Stellen: Plan `:284`, `:293` (Abhängigkeit S9b-4 von S9b-3), `:330`. `S9a_PLAN.md:40` („kein dauerhafter Datenmüll“). Konzept `S9_KONZEPT.md:298` (`assignments`), Plan `:266` (Zuordnungsprüfung als Pflicht für S9c).
- Problem: Die committete `booking`-Zeile hängt an einem Auftrag im Status `requested` ohne Zuordnung. Sie verletzt die Invarianten, die S9c einführt (Zuordnung, `accepted`). Der Fristjob (T7) setzt den Auftrag später auf `expired`, und dann gibt es eine Provision auf einem Auftrag ohne Vertrag. Die Prüfungen von `export_commissions` (S9g) laufen auf diese Daten. Kundenkonto und Auftrag sind dauerhaft unlöschbar. Der Zusatznutzen ist gering: Der Beweis, dass `aal2` mit echtem Token über `my_member_partner_id()` wirkt, entsteht schon in S9b-3 an `platform_settings` (committete Seed-Zeilen) und an `partners` (löschbar nach M-2).
- Entscheidung: Keine Dauer-Fixture. Die Journal-RLS wird auf Claim-Ebene im Rollback geprüft (`asUser`/`probes`, `tests/support/owner.ts:39-42, 63-86`); die Echt-Token-Prüfung bleibt beim Helfer in S9b-3. Damit hängt S9b-4 nur noch von S9b-1 und S9b-2 ab, nicht mehr von der Vorarbeit für TOTP.

### Niedrig

**N-1 · Lücken im Snapshot und in der Restprüfung des Redproofs (Lehre A4c-N3)**
- Stellen: Plan `:322-323`. Bestehendes Skript `scripts/redproof-s9a4.mjs:41` erfasst Spaltendefaults; in der Liste `:322` fehlen sie.
- Es fehlen: Zeilen in `storage.buckets` (`public`, `file_size_limit`, `allowed_mime_types`; Bucket aus S9b-2), Spaltendefaults, View-Definitionen samt `reloptions` (`security_invoker` von `current_fee_rates`), Schema-ACL (`private`) und `pg_default_acl`. In der Restprüfung `tgenabled` gegen den Snapshot vergleichen statt fest gegen `'O'`. Ergänzen: übrig gebliebene Auth-Testkonten und MFA-Faktoren mit Redproof-Präfix sowie Objekte im Bucket `partner-documents`.

**N-2 · `register_partner` für admin- und Vermieter-Konten; Selbstfreigabe; Meldung bei Wettlauf**
- Stellen: Plan `:122`, `:129`, `:167`.
- Ein admin-Konto kann eine Firma beantragen und sie mit sich selbst als `p_actor` freigeben. Fix: `register_partner` verlangt `my_role() = 'customer'`, und `admin_approve_partner` lehnt einen `p_actor` ab, der Mitglied der Firma ist. Laufen zwei Aufrufe parallel, meldet die Unique-Verletzung den Namen des Constraints statt `already_member`; die Funktion muss `unique_violation` abfangen und als `already_member` neu werfen. Der Test „`country` ≠ AT“ (`:129`) ist über `register_partner` nicht möglich, weil die Funktion keinen Länder-Parameter hat; er wird ein Eigentümer-Insert.

**N-3 · Rückwirkungsprüfung der USt.-Regel als CHECK**
- Stelle: Plan `:170`, `:182` (erwartet 23514).
- Ein CHECK mit `current_date` ist nicht immutable und scheitert bei Dump und Restore an älteren Zeilen. Fix: Prüfung in der Funktion bzw. im Trigger mit eigenem Code (z. B. `vat_rule_backdated`, P0001).

**N-4 · Widersprüche zwischen Plan und Konzept, die AK 6 nicht vollständig bereinigt**
- Plan `:156` nennt nur `S9_KONZEPT.md:338` und `:649`. Ebenfalls anzugleichen: `:281` und `:382` („Partner ändert Stammdaten“ gegen die Entscheidung „nur Kontaktdaten“; admin schreibt laut `:382` nur über zwei Funktionen, der Plan hat fünf); `:383` (`partner_vat_rules` nur über `admin_approve_partner`, der Plan hat zusätzlich `admin_set_vat_rule`); `:384` (siehe M-3).
- Innerhalb des Plans: Regel `:28` nennt als Ausnahmen mit `aal1` nur „eigene Firma samt Mitgliedszeile“, die Tabelle `:118` gibt mit `aal1` auch Kategorien, Bezirke und USt.-Regeln frei. Das ist sachlich harmlos, aber eine der beiden Stellen muss angepasst werden.
- Fehlercodes: Plan `rate_mismatch` gegen Konzept `fee_rate_changed`/`fee_basis_changed` (`S9_KONZEPT.md:252`); die Zuordnung festhalten. Laut Konzept übergibt die Edge Function „Satz und Satzversion“, `commission_book` (`:266`) hat aber keinen Versionsparameter. Das ist eine Entscheidung, die dokumentiert werden muss.

**N-5 · Veraltete Testreferenzen; Tests mit `select('*')`**
- Plan `:219` und `:285` verweisen auf `tests/rls/rls.test.ts:360-395`, dort stehen aber die `price_config`-Tests (`rls.test.ts:360`). Die Tests zum Vermieter-Satz und zu `fee_splits` stehen in `rls.test.ts:320-357` und `quote.test.ts:70, 175-184, 249, 295-297`.
- Nach dem Spalten-Grant scheitert `select('*')` auf `platform_settings` mit 42501. `rls.test.ts:324` (`.data ?? []`) besteht dann aus dem falschen Grund. Solche Stellen müssen den Fehlercode bzw. eine Spaltenliste prüfen.

**N-6 · N-5 aus OPEN_ISSUES zitiert, aber nicht behandelt**
- Plan `:3` nennt `OPEN_ISSUES.md:218` (N-5), der Plan enthält dazu nichts. Fix: Test „aktiver Partner (`aal2`) liest `request_photos` und Objekte in `request-photos` → 0 Zeilen“ (Konzept 6.1, Direktzugriff Partner) in S9b-1 aufnehmen. N-5 in `OPEN_ISSUES.md` an S9d übergeben.

**N-7 · Testumfang aus Konzept 13 (S9b) unvollständig**
- `S9_KONZEPT.md:649` verlangt einen Unit-Test „Gegenbuchung = Negation als reine Funktion“ und MFA für admin. Im Plan fehlt beides. Fix: Unit-Test ergänzen; in `:216` einen admin-Fall mit echtem Token aufnehmen (`aal1` → 0 Zeilen auf `partners`, `aal2` → Zeilen).

**N-8 · Rolle `partner` in `profiles` ohne Festlegung**
- Plan `:11`, `0001_foundation.sql:18`. Der Plan legt nicht fest, ob die Registrierung `profiles.role` ändert. Fix: Festhalten, dass `profiles.role` beim Kunden bleibt und der Wert `partner` keine Wirkung hat (wie `rental_provider`). Test: Nach `register_partner` ist `my_role()` = `customer`.

**N-9 · Geldrisiko 4 (`:312`): Entscheidung zur SQL-Neuberechnung**
- Entscheidung: Keine SQL-Neuberechnung der Gebühr (Konzept `S9_KONZEPT.md:248, :547`: `splitFee` bleibt die einzige Stelle). Ausgleich: In `journal.test.ts` jede Testzeile mit `splitFee` aus `@pricing` gegenrechnen. Den Export in S9g (TS-Seite) rechnet jede `booking`-Zeile mit `splitFee` nach und meldet Abweichungen. Den Abgleich mit dem Revisionsbetrag deckt M-5 (c) ab. Die benannte Grenze bei kompromittiertem Secret-Key bleibt bestehen.

**N-10 · Kosten und Spam über offene Registrierung**
- Plan `:309`, `:173`. Jedes Kundenkonto kann eine `pending`-Firma anlegen und mit `aal2` 5 × 10 MB hochladen. Eintrag in `GOLIVE.md` beim Captcha-Punkt (vgl. `OPEN_ISSUES.md:131`).

## Antworten auf die Prüffragen

**(1) Rechteausweitung und Querzugriff.** Im Entwurf gibt es keine Selbstzuweisung: kein Grant auf `partner_members` (`:120`), `register_partner` legt immer eine neue Firma an und nimmt keine `partner_id` an (`:122`), dazu `unique (user_id)` (`:76`). Rekursion entsteht nicht: Alle Policies gehen über SECURITY-DEFINER-Helfer, und diese lesen `partner_members` als Eigentümer (Muster `0003_policy_recursion.sql:1-12`). Querzugriff zwischen Firmen verhindert `partner_id = partner_of_user()` mit Positivkontrolle (`:130`). Der Spalten-Grant beschränkt auf `contact_*`, der Trigger ist die zweite Schicht (`:87`). `anon` erreicht nichts: kein Grant, keine USAGE auf `private` (`0001_foundation.sql:13-14`). Die Storage-Policies sind im Ansatz richtig (Bucket-gebunden, nur eingetragene Pfade, `aal2`), aber so nicht funktionsfähig (M-3). Offene Punkte: Selbstfreigabe durch admin (N-2), eine RPC für `service_role` als Buchungsweg ohne Vertrag (M-4), ein Marker ohne Zeilenbindung (M-1).

**(2) Gebühr und Journal für Kunden und nicht freigegebene Partner.** Ein Kunde ohne Firma liest `platform_settings` mit 0 Zeilen, `current_fee_rates` mit NULL (security_invoker, `0016_settings_admin.sql:69`), `booking_terms()` ohne `fee_*` (`0016_settings_admin.sql:85`), `commission_entries` mit 0 Zeilen und kann `commission_book` nicht ausführen. `fee_splits` entfällt (`:268`). Ein nicht freigegebener Partner (`pending`, `suspended`, `rejected`) liest mit `aal2` den Satz. Das ist die Entscheidung von Beks und deckt sich mit `CLAUDE.md` („alle Partner-Konten unabhängig vom Status“). Folge, in `:309` benannt: Jeder Kunde kann sich durch Registrierung und TOTP Lesezugriff auf den Satz verschaffen. Fremde Journalzeilen sind nicht lesbar (Firmenbedingung im Helfer). Geschrieben wird nur über die Funktion. Offen: M-4, M-5 und M-9 (Integrität des Journals) sowie N-5 (Tests, die nach dem Spalten-Grant aus dem falschen Grund grün sind). Der Spalten-Grant ohne `note` und `created_at` ist richtig; `current_fee_rates` braucht nur `key`, `version`, `value` und `effective_from` (`0016_settings_admin.sql:71-78`).

**(3) `aal2` serverseitig.** Die Helfer prüfen das Claim selbst (`:108-110`). Policies für Schreiben, Satz und Journal nutzen `my_member_partner_id()` (`:120`, `:208`, `:276`), admin läuft über `is_admin()` (`0015_versions_published.sql:10-12`). Die Admin-Funktionen sind nur über `service_role` und den Eigentümer erreichbar, mit `p_actor` und ohne `aal`. Das ist die dokumentierte Grenze aus `S9_KONZEPT.md:181, :252`. Ausnahmen mit `aal1`: `register_partner` (das Konto ist noch Kunde) und das Lesen der eigenen Firma (MFA-Einrichtung). Beides ist vertretbar, denn betroffen sind nur eigene Firmendaten, kein Satz, kein Journal, keine Daten Dritter. Die Erweiterung auf Kategorien, Bezirke und USt.-Regeln mit `aal1` ist harmlos, muss aber in Regel `:28` stehen (N-4). Grenze: Ein `aal2`-Token gilt bis `jwt_expiry` 3600 s (`supabase/config.toml:166`), benannt in `:310`.

**(4) Statusmaschine.** Die sieben Paare sind vollständig im Sinne der Entscheidungen. Alles andere ist verboten, `rejected` ist Endzustand (`:93-102`). Die getrennten Prüfungen Paar und Marker sowie Compare-and-Set unter `for update` sind richtig. INSERT ist nur als `pending` erlaubt (`:85`). DELETE und TRUNCATE sind gesperrt (`:88`). Zusammenspiel mit `unique (user_id)`: Ein abgelehntes Konto kann keinen zweiten Antrag stellen. Das ist gewollt, und die Mitgliedszeile bleibt. Lücken: Der Marker ist nicht an die Zeile gebunden, `verified_*` hängt am falschen Marker, und die Begründungspflicht steht nur in der Funktion (M-1). Testfirmen lassen sich nicht löschen (M-2). In S9b-1 ist die Statusmaschine nicht durchlaufbar (H-1). TRUNCATE muss ohne Ausnahme gesperrt sein; ein Marker passt dort nicht, weil es keine Zeile gibt.

**(5) Teilschnitt.** Vier Teile, als Kette, ohne UI, jeweils in einer Session machbar. S9b-1 ist mit dem neuen Redproof-Skript der größte Teil. Nötige Änderungen: Die beiden Statusfunktionen gehören nach S9b-1 (H-1). S9b-4 hängt nach M-9 nur noch von S9b-1 und S9b-2 ab, sodass die TOTP-Vorarbeit von Beks das Journal (Voraussetzung für S9c) nicht blockiert. Für `otpauth` als `devDependency` gibt es aus Sicht von Sicherheit und Geld keine Einwände: nur für Tests, nicht im App-Bundle.

**(6) Rot-Beweise und Snapshot.** Die meisten geplanten Beweise messen Ist-Werte (zurückgelesener Status, gesehene Zeilen, gespeicherte Zeile). Drei erwarten aber eine Wirkung, die eine zweite Schicht verhindert, und zwei sind ungenau zugeschnitten (M-7). Der globale Snapshot über `public`, `private` und `storage` mit Abbruch bei nicht erfassten Objekten behebt A4c-N3 im Kern. Es fehlen Bucket-Zeilen, Spaltendefaults, View-Optionen sowie Schema- und Default-ACLs; die Restprüfung muss Auth-Testkonten und -Faktoren sowie Dateien umfassen (N-1).
Sperren ohne Rot-Beweis im Plan:
- S9b-1: `guard_partner_insert` (Status, `verified_*`, `payout_model`); unveränderliche Felder in `guard_partner_fields` (`id`, `country`, `terms_*`); Policy `partners_update_contact` (`aal2` und Statusfilter); Select-Policies auf `partner_members`, `partner_categories`, `partner_regions` und `partner_vat_rules` (gelockert wird nur `partners_select`); `unique (user_id)`; `register_partner` (Prüfung von `auth.uid()`, Bezirksprüfung, kein EXECUTE für `anon`); Statusklausel in `my_job_partner_id`; Firmenbedingung in `partner_of_user`; `append_only` auf `partner_vat_rules`; `country = 'AT'`; TRUNCATE-Sperre.
- S9b-2: Stammdaten-Marker in `guard_partner_fields` (R11-7); `scope_incomplete`; Compare-and-Set der Statusfunktionen; Ableitung von `partner_id` und Pfad im Dokumenten-Trigger; Dokument-Insert mit `aal1`.
- S9b-3: Schreibverbot auf `platform_settings`; `anon` → 42501.
- S9b-4: `commission_one_booking`; `reverses_shape`; `non_negative_kinds`; Prüfung des eingefrorenen Satzes bei `change` und `cancellation_fee`; `vat_rule_missing`; `partner_not_active`; Abgleich von `price_version`; TRUNCATE-Trigger.
Davon sollten mindestens die Statusklausel in `my_job_partner_id`, die Select-Policy auf `partner_members`, `partners_update_contact`, der Stammdaten-Marker, `commission_one_booking` und die Prüfung des eingefrorenen Satzes einen isolierten Rot-Beweis bekommen. Der Rest kann als Testabdeckung ohne Rot-Beweis in `OPEN_ISSUES.md` stehen.

**Zusatz: Journal-Entwurf.** Beträge `bigint` in ganzen Cent mit `fee_parts`/`payout_rest` (`:246`, `:253-254`). Das ist richtig, und die Identitäten gelten auch für Differenzzeilen (9.3). Nur anfügen, auch für `service_role` (Trigger und Revoke, `:264`); die Eigentümer-Grenze ist benannt. Bezug auf Preis- und Gebührenversion je Zeile ist vorhanden (`:250-251`, `:267`). Der zusammengesetzte Fremdschlüssel auf die Revision ist gegen 0018 geprüft (`0018_revisions_contacts.sql:24` `unique (id, request_id)`). Negation nur bei `cancellation`, mit Lücken (M-5). Satzquelle ist `platform_settings` zum Buchungstag bzw. die eingefrorene `booking`-Zeile. Das ist richtig, die Regel bei Gleichstand fehlt (M-5 d). Die `vat_rule` ist ungeklärt (M-6).

**Zusatz: Allowlist (Abschnitt 8).** Die neuen EXECUTE-Freigaben an `authenticated` (vier Helfer, `register_partner`) sind begründet und passen zum bestehenden Test (`tests/rls/rls.test.ts:450-469`). Abschnitt 8 ist aber nicht vollständig (M-8), und der Dokumentenweg braucht einen weiteren Helfer (M-3). Der Allowlist-Test erfasst nur SECURITY-DEFINER-Funktionen (`rls.test.ts:455`). Für die geplanten Trigger-Funktionen ohne DEFINER reicht `revoke … from public`.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `supabase/migrations/20261029141616_0001_foundation.sql:18` | Enum `user_role` mit customer, rental_provider, admin, partner: stimmt mit Plan `:11` überein |
| `…_0001_foundation.sql:37-39` | `my_role()` SECURITY DEFINER, `search_path = ''`: stimmt |
| `…_0001_foundation.sql:13-14` | `private` ohne USAGE für `anon`: bestätigt |
| `…_0001_foundation.sql:196-215` | `fee_splits` samt Index: stimmt mit Plan `:13` überein |
| `…_0001_foundation.sql:231` | `set_updated_at` mit `moddatetime`: stimmt mit Plan `:89` überein |
| `…_0015_versions_published.sql:10-12` | `is_admin()` = Rolle admin und `aal2`: stimmt |
| `…_0015_versions_published.sql:19-51` | `audit_log`, `append_only`, Revoke `service_role`, Select `is_admin()`; `actor_role` enthält `customer` (für `register_partner` zulässig) |
| `…_0015_versions_published.sql:55-63` | `assert_admin` prüft nur die Rolle: stimmt |
| `…_0016_settings_admin.sql:34-65`, `:69-78` | Trigger auf Gebührenschlüssel und View `current_fee_rates` mit Gleichstand nach Version: stimmt; die Gleichstandsregel fehlt im Plan (M-5 d) |
| `…_0016_settings_admin.sql:81-104` | `booking_terms()`, fünf Schlüssel plus Hash: stimmt |
| `…_0016_settings_admin.sql:130-147`, `:165-181` | `guard_profile_role` mit Marker `<id>:<rolle>`; `admin_grant_role` für `service_role` widerrufen (`:179-180`): stimmt |
| `…_0016_settings_admin.sql:188-189`, `:215-218` | Select-Policy `rental_provider` oder admin; Schreib-Policies und -Grants entfernt: stimmt |
| `…_0017_status_machine.sql:229` | Marker an die Zeile gebunden (`<id>:<status>`): Grundlage für M-1 |
| `…_0017_status_machine.sql:138-147` | `immutable_row` mit Ausnahme für die Kaskade (Tiefe > 1): Muster für M-2 |
| `…_0017_status_machine.sql:153-167` | `status_events` nur anfügen: stimmt mit Plan `:13` überein |
| `…_0018_revisions_contacts.sql:24` | `unique (id, request_id)` vorhanden: Fremdschlüssel aus Plan `:243` ist umsetzbar |
| `…_0018_revisions_contacts.sql:133` | `fee_splits` ohne DML für `service_role`: stimmt mit „quote schreibt nicht mehr“ überein |
| `…_0018_revisions_contacts.sql:356` | Kommentar zu den Default-EXECUTE-Rechten: Grundlage für M-8 |
| `…_0021_photo_limits.sql:32-44` | Zählung in einer Policy über SECURITY DEFINER: Muster für M-3 |
| `…_0022_no_self_upgrade.sql:7` | `become_rental_provider` gelöscht: stimmt mit Plan `:11` überein |
| `…_0010_quote.sql:26-27` | `current_fee_rates`: SELECT nur für `authenticated`, `anon` widerrufen: bestätigt |
| `supabase/config.toml:166`, `:304-306` | `jwt_expiry = 3600`; TOTP-Einschreibung und -Prüfung aus: stimmt mit Plan `:15` überein |
| `supabase/functions/_shared/pricing/fee.ts:17-25` | `splitFee` ohne `vat_rule`, half-up, wirft bei negativem Gesamtpreis: Grundlage für M-6 |
| `tests/support/owner.ts:39-42` | `asUser` setzt `aal` nur als Claim: stimmt mit Plan `:14` überein |
| `tests/support/db.ts:30`, `:44-46`, `:68` | `makeUser`, `deleteUsers` (Auth-API), `makeRequest`: Grundlage für M-2 (b) |
| `scripts/redproof-s9a4.mjs:9`, `:31-49`, `:104-109`, `:485-494`, `:150-172`, `:698` | Dev-Guard, Snapshot (mit Spaltendefaults `:41`), `probe` mit Rollback, `INNER`, `runSql`, Vergleich `same`: Zeilenangaben im Plan stimmen (INNER genau `:485-494`) |
| `tests/rls/rls.test.ts:360` | `describe('price_config')`, nicht „Vermieter liest Satz“: Plan `:219` veraltet (N-5) |
| `tests/rls/rls.test.ts:320-357` | Gebühren- und `fee_splits`-Tests: richtige Ersatzstelle |
| `tests/rls/rls.test.ts:450-469` | Allowlist nur für SECURITY DEFINER, fünf Einträge: stimmt |
| `docs/OPEN_ISSUES.md:10, 44, 50, 218, 219, 226` | R7-4, R11-1, R11-7, N-5, N-10, A4c-N3 an den im Plan genannten Zeilen: stimmt |
| `docs/S9_KONZEPT.md:338` | `my_partner_id() is not null` für alle Status: Widerspruch richtig erkannt (Plan `:17`) |
| `docs/S9_KONZEPT.md:252` | Journal in derselben Transaktion wie der Übergang; Satz und Satzversion von der Edge Function: Grundlage für M-4 und N-4 |
| `docs/S9_KONZEPT.md:384` | Partner „S eigene Metadaten“ bei Dokumenten: Widerspruch zu Plan `:173` (M-3) |

## Geprüft / Nicht geprüft

- **Vollständig gelesen:** `docs/S9b_PLAN.md`; Migrationen 0001, 0003, 0015, 0016, 0017, 0018, 0020, 0021, 0022; `tests/support/owner.ts`; `tests/support/db.ts`; `supabase/functions/_shared/pricing/fee.ts`; `scripts/scan-proof.mjs`.
- **Abschnittsweise gelesen:** `docs/S9_KONZEPT.md` Zeilen 168–453 und 543–717 (3, 4, 5, 6, 6.1, 9–14); `docs/OPEN_ISSUES.md` Zeilen 10, 39–50, 210–231; `docs/S9a_PLAN.md` Zeilen 31–52 und Überschriften; `scripts/redproof-s9a4.mjs` Zeilen 1–200 und 475–584; `tests/rls/rls.test.ts` Zeilen 355–399 und 440–471 sowie Fundstellen; `tests/rls/quote.test.ts` nur Fundstellen; `supabase/config.toml` nur Fundstellen.
- **Nicht geprüft:** Migrationen 0002, 0004–0014, 0019 (Storage-Policies dort nur aus 0001/0017/0020/0021 nachvollzogen); `docs/ARCHITECTURE.md` (die Zeilenangaben 21, 32, 51 im Plan `:268` sind nicht verifiziert); `S9_KONZEPT.md` Abschnitte 1, 2, 7, 8; der tatsächliche Zustand des Dev-Projekts (Katalog, Dashboard-Einstellung MFA, vorhandene Daten), da kein Datenbankzugriff erfolgte; die Supabase-Dokumentation zu `mfa.enroll`/`verify` und `otpauth`; die PostgreSQL-Reihenfolge von RLS-WITH-CHECK und NOT NULL beim Insert mit Trigger (für die Fehlercodes in `:185` relevant, nur aus dem Gedächtnis beurteilt).

Offene Findings hoch: 1
