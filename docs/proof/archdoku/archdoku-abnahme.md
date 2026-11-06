# Abnahme archdoku, Runde 1 (Berater: Geld, Sicherheit, Schema)

- Datum: 2026-11-06
- Geprüft: `docs/ARCHITECTURE.md` (Stand 3dcaf27; Rollen, Datenmodell, Statusfluss, Geldfluss, RLS- und Rechte-Matrix, Datenschutz, quote, Entscheidungen), `tmp/proof/archdoku.patch` (nur auf entfernte Aussagen durchgesehen), alle Migrationen `supabase/migrations/` 0001 bis 0022 vollständig gelesen (Endzustand), `tmp/proof/archdoku-abgleich.md`, Stichproben in `tests/rls/rls.test.ts`, `status.test.ts`, `settings.test.ts`, `quote.test.ts`, `uploads.test.ts`, Regeln in `CLAUDE.md` (Geld, Daten und Sicherheit).
- Methode: Jede Matrixzeile (Tabellen und Funktionen) gegen Grants, Policies, Trigger und `alter policy` im Endzustand abgeglichen; jede zitierte `Migration:Zeile` aufgeschlagen.
- Hinweis zum Prozess: In der Tool-Liste dieses Agents stand ein eingebautes `advisor`-Tool ohne Parameter. Es wurde nicht benutzt (CLAUDE.md, Abschnitt Sessions und Modelle).

## Findings

### Hoch

Keine.

### Mittel

**M1** `docs/ARCHITECTURE.md:95` (und Funktionstabelle `:73-87`) – Die Matrix behauptet, sie umfasse „alle … Funktionen der Schemas `public` und `private`“. Es fehlen zwölf private Trigger-Funktionen ohne SECURITY DEFINER, die die Zustandsregeln tragen: `private.append_only` (0015:30-38), `guard_price_version` (0015:93-125), `guard_profile_role` (0016:130-144), `guard_rental_status` (0017:118-129), `immutable_row` (0017:138-149), `guard_request_insert` (0017:201-212), `guard_request_status` (0017:219-236), `guard_revision_insert` (0018:36-77), `guard_request_pointer` (0018:144-162), `guard_request_fields` (0018:168-181), `guard_photo_insert` (0020:44-64, 0021:8-26), `geo_boundaries_make_valid` (0007:4-13). Ebenso fehlt die Schema-Freigabe `grant usage on schema private to authenticated` (0001:14), ohne die die Policies `private.is_admin()`/`my_role()` gar nicht aufrufen könnten. Bei `geo_boundaries_make_valid` fehlt außerdem das Entziehen von EXECUTE für PUBLIC (alle anderen haben es). Wirkung heute keine (Trigger-Funktionen lassen sich nicht direkt aufrufen, Schema `private` ist nicht exponiert), aber die falsche Vollständigkeitsaussage lädt dazu ein, eine künftige Funktion ohne Prüfung anzulegen. – Fix: Eine Zeile „`private.*` Trigger-Funktionen (SECURITY INVOKER, nur als Trigger aufrufbar)“ mit dieser Liste und den Belegen ergänzen. Dazu eine Zeile „Schema `private`: USAGE nur authenticated (0001:13-14)“. Den fehlenden Entzug bei 0007 als Hinweis aufnehmen (oder die Vollständigkeitsaussage einschränken).

**M2** `docs/ARCHITECTURE.md:62` gegen `:34` und CLAUDE.md („Annahme, Angebot, Nachtrag und Storno laufen über Funktionen mit festem Akteur je Übergang. Kein direktes UPDATE auf Status.“) – Laut Matrixzeile (korrekt nach 0001:383, 0017:114-132) storniert der Kunde eine Mietanfrage per direktem UPDATE auf `rental_bookings.status` (Spalten-Grant, Policy, Trigger). Das widerspricht der Regel in CLAUDE.md. Unter „Offen“ (`:95`) steht es nicht, und `:34` formuliert die Regel ohne Einschränkung auf `service_requests`. – Fix: In `:95` als Abweichung (4) aufnehmen: „`rental_bookings`: Zurückziehen per direktem UPDATE (Phase 2, Miete ohne Gebühr), Umstellung auf eine Übergangsfunktion mit S9b“. `:34` auf `service_requests` eingrenzen. Die Umstellung entscheidet die Session, die Miete freigibt. Bis dahin ist der Schaden durch den Trigger auf requested → withdrawn begrenzt.

### Niedrig

**N1** `docs/ARCHITECTURE.md:34` – „ohne Ausnahme für … Eigentümer (0017)“ widerspricht 0017:6 und `:91` (der Datenbank-Eigentümer kann Marker setzen oder Trigger abschalten). – Fix: „ohne Rollen-Ausnahme im Trigger; Grenze Datenbank-Eigentümer siehe RLS-Matrix“.

**N2** `docs/ARCHITECTURE.md:63` – `fee_splits` liest der Zahlungsempfänger ohne aal2 (0016:206-207). CLAUDE.md verlangt für das Gebühren-Journal aal2. Folgenlos, weil die Tabelle leer ist und niemand schreiben kann (0017:13, 0018:133). – Fix: In `:95` vermerken, dass `fee_splits` mit S9b-4 entfällt und `commission_entries` die aal2-Regel bekommt.

**N3** `docs/ARCHITECTURE.md:147` (Entscheidung 1) – „Preis und Gebühr sind nicht fälschbar“: Seit 0018 rechnet `quote` keine Gebühr. – Fix: „Preis ist nicht fälschbar; eine Gebühr entsteht erst bei der Annahme (S9b-4)“.

**N4** `docs/ARCHITECTURE.md:102` – „Konto löschen: kaskadiert auf … Mietanfragen“. Für ein Vermieter-Konto, auf dessen Angebote Mietanfragen verweisen, scheitert die Löschung: `rental_offers.provider_id … on delete cascade` (0001:146), aber `rental_bookings.offer_id` ohne ON DELETE (0001:173), also Fehler 23503. – Fix: Grenze nennen (Vermieter-Konto mit Mietanfragen nicht löschbar, Entscheidung mit Phase 2).

**N5** `docs/ARCHITECTURE.md:44`, `:97` – Verweis auf `docs/proof/archdoku/archdoku-abgleich.md`. Die Datei gibt es noch nicht (nur `tmp/proof/archdoku-abgleich.md`). – Fix: vor dem Commit nach dem Secret-Scan byte-genau kopieren, sonst zeigt der Verweis ins Leere.

**N6** `docs/ARCHITECTURE.md:59-67` – Die Spalte „admin (aal2)“ ist uneinheitlich. Teils bedeutet „–“ „nichts über Kunde hinaus“ (`:59`, `:64`), teils steht „nur wie Kunde“ (`:66`). `:61` nennt „I U D –“, obwohl ein admin eigene Angebote wie jeder Kunde ändern kann (0001:378-379). – Fix: Einmal in `:47-48` festlegen, dass die admin-Spalte nur Zusatzrechte nennt, und `:66` angleichen.

**N7** `docs/ARCHITECTURE.md:103` – „vor Annahme nur PLZ/Bezirk“: Die PLZ-Spalten entfielen in 0019:13-16, die DB hält nur `district`. – Fix: „Bezirk (PLZ nur, falls die RPC sie aus der Adresse ableitet)“.

**N8** `tmp/proof/archdoku-abgleich.md` – Ungenauigkeiten:
- Zeile 30 (#19): Der Beleg R:332-334 enthält nur den Positivfall. Die Verweigerung steht in R:321-326 und R:447.
- Zeile 53 (#42): „erlaubt ja“ für ein Kunde-Konto mit eigenem Angebot. R:300-308 prüft nur das Konto mit der Rolle Vermieter. Das widerspricht L9 („nicht getestet“).
- Zeile 110 (#94): Dort steht `price_version_hold` als private SECURITY-DEFINER-Hilfe. Die Funktion liegt aber in `public`, ist SECURITY INVOKER und EXECUTE hat nur service_role (0019:35-38, 208, 215).
- Zeile 134 (L19): „`revoke all … from public`“ gilt nicht für `private.geo_boundaries_make_valid` (0007:4-17).

Fix: die vier Stellen korrigieren. Die Lückenbewertung ändert sich dadurch nicht.

## Antworten auf die Prüffragen

1. **Matrixzeilen gegen den Endzustand:** Alle Rechteangaben der Tabellen- und Funktionszeilen stimmen mit dem Endzustand überein. Alle zitierten `Migration:Zeile` sind korrekt (Liste unten). Die geforderten Stichproben (platform_settings, service_requests, rental_offers, rental_bookings, request_photos, Storage, price_revisions, status_events, audit_log, withdraw, booking_terms, current_fee_rates) sind ohne Abweichung. Falsche Zeilennummern: keine. Nur die Spaltensemantik bei admin ist uneinheitlich (N6).
2. **Pfad mit mehr Rechten als im Endzustand:** Keiner. Beide Richtungen geprüft: admin ohne aal2 = Kunde (0015:10-12; alle 0001-Policies mit Admin-Bezug über die Rolle wurden in 0015, 0016, 0017 und 0020 ersetzt oder entfernt), kein Schreibrecht von admin auf Tabellen, keine Lesepolicy für fremde Fotos oder Ordner (0020:40-41, 103-104), partner ohne Recht über Kunde hinaus, `become_rental_provider` entfernt (0022:7). Die Doku nennt auch die Restrechte korrekt: Kunde ändert eigene, auch freigegebene Angebote; service_role ändert Nicht-Gebührenschlüssel direkt.
3. **Vollständigkeit:** Alle 18 Tabellen, beide Views, alle öffentlichen Funktionen und alle privaten SECURITY-DEFINER-Funktionen sowie die Storage-Policies und der Bucket sind enthalten. Es fehlen die zwölf privaten Trigger-Funktionen und die Schema-Freigabe auf `private` (M1).
4. **Widerspruch zu CLAUDE.md:** Direktes Status-UPDATE bei Mietanfragen, nicht als offen geführt (M2). `fee_splits` ohne aal2 (N2, folgenlos). Partner lesen den Gebührensatz nicht (in `:95` (1) korrekt als offen geführt). Geldregeln (Integer-Cent, Server rechnet, kein Satz im Client, Kunde liest weder Satz noch Aufteilung, Rundung wie `platform()`) sind in `:37-40` und der Matrix korrekt beschrieben und durch die Migrationen gedeckt.
5. **Abgleich, Lücken und Testbelege:** 27 Belege stichprobenhaft gegen `tests/rls/` geprüft, 25 ohne Abweichung. Die Lücken L1 bis L19 sind sachlich korrekt (Policy- und Grant-Belege stimmen). Ungenau sind die Belege #19 und #42, die Objektnennung in #94 und die Aussage in L19 (N8).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| 0001:253-261, 266-267 | profiles: Entzug, Grant S und U (display_name, phone), Update-Policy nur eigene, wie Matrix `:53` |
| 0016:130-147 | guard_role sperrt Rolle und id ohne Marker, wie `:6`, `:53` |
| 0018:125 | Entzug von DELETE auf profiles für service_role, wie `:53` |
| 0015:93-130, 270-271, 276-279 | price_versions: Trigger, Entzug der Schreibrechte, Lesen nur veröffentlicht bzw. admin mit aal2, wie `:54` |
| 0015:134-159, 280-283 | price_config: Trigger (auch beim Verschieben), Policies, wie `:55` |
| 0005:2-3; 0015:285-290 | current_price_version: Grants, `published`-Filter, security_invoker, wie `:56` |
| 0001:290; 0016:34-66, 107-126, 188-189, 215-218 | platform_settings: Grant S; Gebührenschlüssel-Trigger; admin_set_setting; Policy rental_provider oder is_admin; Schreib-Policies und Grants entfernt, wie `:57` |
| 0015:271 | TRUNCATE auf platform_settings für service_role entzogen, wie `:57` |
| 0001:302; 0016:191-192; 0017:214-215, 238-243 | service_requests: nur S für Kunde, admin mit aal2, INSERT-Trigger, Entzug von UPDATE, wie `:58` |
| 0018:122-130, 144-165, 200-202 | service_role nur U (current_revision), D/TRUNCATE entzogen und Trigger, Zeiger, Revision beim Commit, wie `:58` |
| 0020:36-41, 44-73; 0021:8-26 | request_photos: nur S eigene, admin-Klausel weg, Marker-Trigger, photo_immutable, wie `:59` |
| 0011:39; 0020:79-104; 0021:34-70; 0022:12-20 | Storage: nur JPEG, Staging-Policies, SELECT ohne admin, Kontingent 40 über SD-Zählung, wie `:60` |
| 0001:146, 355-379; 0016:200-201 | rental_offers: anon nur approved, INSERT nur Rolle rental_provider, UPDATE nur eigene ohne Rollenprüfung, wie `:61` |
| 0001:382-383; 0017:61-62, 114-132; 0019:5 | rental_bookings: U (status) nur requested → withdrawn, Check, Trigger, service_role ohne U/D/TRUNCATE, wie `:62` |
| 0001:399; 0016:206-207; 0017:13; 0018:133 | fee_splits: Lesen nur payee/admin, leer, Schreibrechte entzogen, wie `:63` |
| 0015:19-51 | audit_log: append_only, Grants, Policy is_admin, wie `:64` |
| 0017:153-197 | status_events: alle Rechte auch für service_role entzogen, SELECT admin aal2, Schreiben nur per SD-Trigger, wie `:65` |
| 0018:10-97 | price_revisions: Guard nur n = 1 und `submit`, immutable, SELECT nur eigene (kein admin), wie `:66` |
| 0018:206-225; 0019:82-83 | request_contacts: nur S eigene, kein admin, Format-Check, wie `:67` |
| 0001:251-257; 0006:22-24; 0019:25-26, 65-66 | Geo- und Cache-Tabellen: RLS ohne Policy, Entzug für anon und authenticated, wie `:68` |
| 0010:26-27; 0016:69-78 | current_fee_rates: nur authenticated, security_invoker, größtes effective_from, wie `:69` und `:168` |
| 0016:81-104 | booking_terms: SD, fünf Schlüssel ohne `fee_*`, EXECUTE für anon, authenticated und service_role, wie `:75` |
| 0017:249-279 | withdraw: SD, Akteur aus `auth.uid()`, Compare-and-Set, Entzug für PUBLIC und anon, wie `:76` |
| 0015:10-15; 0001:37-42 | is_admin und my_role: EXECUTE nur authenticated, wie `:77` |
| 0015:184-260; 0016:166-181 | Admin-Funktionen: EXECUTE nur service_role; admin_grant_role auch für service_role entzogen, wie `:79-81` |
| 0015:55-204; 0016:34-61; 0017:179-193; 0018:187-198; 0001:44-53 | private SD-Funktionen vollständig gelistet, alle mit Entzug für PUBLIC, wie `:82` |
| 0018:368-373; 0019:208-216; 0020:27-28, 289-298; 0011:53-54, 79-80; 0006:84-89; 0009:12-13 | Service-Funktionen: EXECUTE nur service_role, wie `:83-86` |
| 0022:7 | become_rental_provider entfernt, wie `:87`, `:163` |
| 0015:112, 173; 0016:136, 170; 0017:229, 259; 0020:50, 264 | Marker: Prüf- und Setzstellen wie `:91` |
| 0007:4-17 | geo_boundaries_make_valid: SECURITY INVOKER, ohne Entzug für PUBLIC, nicht in der Matrix (M1) |
| 0001:146, 173 | Kaskade Vermieter → Angebote; FK von Mietanfragen ohne ON DELETE (N4) |
| tests/rls/rls.test.ts:93 | service_role legt eine unveröffentlichte Version an (Standardrechte), wie `:49` |
| tests/rls/rls.test.ts:332-334 | nur Positivfall Vermieter (N8, #19) |
| tests/rls/rls.test.ts:300-308 | nur das Konto mit der Rolle Vermieter geprüft (N8, #42) |
| tests/rls/rls.test.ts:450-470 | Allowlist der fünf SD-Funktionen, wie `:89` |
| tests/rls/status.test.ts:38-55 | admin aal2, Kunde, service_role: kein Status-UPDATE, wie Abgleich #27 |
| tests/rls/status.test.ts:115-141 | Miete nur requested → withdrawn, auch für den Eigentümer, wie Abgleich #48 |
| tests/rls/status.test.ts:143-147 | service_role 42501 auf fee_splits, wie Abgleich #55 |
| tests/rls/status.test.ts:255-302 | status_events, price_revisions, request_contacts wie Abgleich #60-66 |
| tests/rls/status.test.ts:228-241 | service_role nur Zeiger; DELETE profiles verweigert, wie Abgleich #7, #30 |
| tests/rls/settings.test.ts:111-117, 127-157, 173-247, 279-312 | wie Abgleich #5, #6, #9, #10, #21, #23, #57, #58, #81-83 |
| tests/rls/quote.test.ts:280-298 | quote_save_* 42501 bzw. 23503; current_fee_rates NULL / Satz / 42501, wie Abgleich #75, #84, #85 |
| tests/rls/uploads.test.ts:503-543 | request_photos I/U/D für Kunde und anon 42501, wie Abgleich #32 |
| tests/rls/uploads.test.ts:702-737 | 41. Staging-Datei verweigert, wie Abgleich #35 |

Offene Findings hoch: 0
