# Abnahme archdoku, Runde 2 (Berater: Geld, Sicherheit, Schema)

- Datum: 2026-11-06
- Geprüft: `docs/ARCHITECTURE.md` im Stand 6a8280d, vollständig gelesen. Den Diff `tmp/proof/archdoku-r2.patch` habe ich vollständig gegen meine Runde-1-Abnahme `tmp/proof/archdoku-abnahme.md` gelesen. Gegen die Migrationen in `supabase/migrations/` (0001 bis 0022) habe ich alle Funktionen, Tabellen, Views, Trigger und Schema-Rechte per Suche abgeglichen. Vollständig gelesen habe ich 0001, 0007, 0015:1-210, 0016:28-219, 0017:1-245, 0018:1-235, 0019:1-90, 0020:30-109 und 0021. Dazu `supabase/config.toml:13`, `docs/OPEN_ISSUES.md:285-296` und den Ordner `docs/proof/archdoku/`.
- Methode: Ich habe jede neu zitierte `Migration:Zeile` aufgeschlagen. Die privaten Funktionen im Endzustand habe ich aus allen Anweisungen zum Anlegen und Löschen von Funktionen abgeleitet und mit den Matrixzeilen verglichen. Die SECURITY-Art habe ich je Funktion an ihrer Kopfzeile geprüft, den Entzug für PUBLIC je Funktion an den Revoke-Anweisungen.
- Hinweis zum Prozess: In der Tool-Liste dieses Agents stand ein eingebautes `advisor`-Tool ohne Parameter. Ich habe es nicht benutzt (CLAUDE.md, Abschnitt Sessions und Modelle).

## Findings

### Hoch

Keine.

### Mittel

Keine.

### Niedrig

**R2-N1** `docs/ARCHITECTURE.md:87`
- Problem: Die Zeile führt `geo_boundaries_make_valid` mit „–“ in den Spalten anon und Kunde. Nach dem Tabellenkopf (`:73`) gilt die Spalte „EXECUTE je Rolle“. Für diese Funktion fehlt aber der Entzug für PUBLIC (0007:4-17), also haben authenticated (mit USAGE auf `private`, 0001:14) und anon formal EXECUTE. `:90` sagt das, die Zeile selbst nicht. Außerdem fehlt im Beleg die zweite Verwendung: Der Trigger `geo_districts_make_valid` ruft dieselbe Funktion (0019:63-64).
- Wirkung: keine, denn Trigger-Funktionen lassen sich nicht direkt aufrufen.
- Fix: In der Zeile „(`geo_boundaries_make_valid`: EXECUTE über PUBLIC, ohne Wirkung, s. u.)“ ergänzen und den Beleg um „0019:63-64“ erweitern.

**R2-N2** `docs/ARCHITECTURE.md:53`, `:56`
- Problem: `:48` legt jetzt fest, dass die Spalte „admin (aal2)“ nur Zusatzrechte über Kunde hinaus nennt. Zwei Zellen folgen dem noch nicht. In `:53` steht „U nur die eigene“; das ist kein Zusatzrecht, es steht schon in der Spalte Kunde. In `:56` steht „S“, obwohl die View nur veröffentlichte Versionen zeigt (0015:285-290) und ein admin dort nichts über Kunde hinaus sieht.
- Wirkung: keine, denn keine der beiden Zellen nennt ein Recht, das es nicht gibt.
- Fix: In `:53` „S alle; I U D –“ eintragen, in `:56` „–“.

**R2-N3** `docs/ARCHITECTURE.md:44`, `:100`
- Problem: Beide Stellen verweisen als Beleg für die Testabdeckung auf `docs/proof/archdoku/archdoku-abgleich.md`. Die vier bekannten Ungenauigkeiten dieser Datei (Runde 1 N8) stehen nur in `docs/OPEN_ISSUES.md:296` (NA-19). Ein Leser von #42 hält dann „Kunde-Konto ändert eigenes Angebot“ für getestet, obwohl der Test nur das Konto mit der Rolle Vermieter prüft.
- Fix: An beiden Stellen „(Korrekturen: OPEN_ISSUES NA-19)“ anfügen.

**R2-N4** `docs/OPEN_ISSUES.md:292-294`
- Problem: NA-15, NA-16 und NA-17 tragen nach 6a8280d keinen Erledigt-Vermerk. NA-17 ist vollständig behoben. Bei NA-15 und NA-16 ist der Doku-Teil erledigt; offen bleiben der fehlende Entzug in einer künftigen Migration (NA-15) und die Umstellung auf eine Übergangsfunktion (NA-16). `ARCHITECTURE.md:98` verweist zu Recht auf NA-15 und NA-16 als offene Punkte.
- Fix: NA-17 als „Erledigt in 6a8280d“ markieren, bei NA-15 und NA-16 „Doku-Teil erledigt in 6a8280d, Rest offen“ vermerken.

## Antworten auf die Prüffragen

### 1. Behebung der Runde-1-Findings

Alle acht Findings sind korrekt behoben:

- **M1**, behoben. `:87` listet die zwölf Trigger-Funktionen. Alle zwölf sind SECURITY INVOKER: 0015:31, 94; 0016:131; 0017:119, 139, 202, 220; 0018:37, 145, 169; 0021:9; 0007:6. Alle Belege stimmen: 0015:30-38 und 93-125; 0016:130-144; 0017:118-149 und 201-236; 0018:36-77 und 144-181; 0020:44-64; 0021:8-26; 0007:4-13. `:90` beschreibt die Schema-Freigabe korrekt: 0001:13 entzieht PUBLIC alle Rechte auf `private`, 0001:14 gibt USAGE nur an authenticated. Auch der fehlende Entzug bei `geo_boundaries_make_valid` stimmt: Die Migration 0007:4-17 enthält keine Revoke-Anweisung, und keine spätere Migration ergänzt sie (Suche über alle Revoke-Anweisungen auf `private`-Funktionen). „Nicht von der Data API ausgeliefert“ deckt `supabase/config.toml:13` (exponiert sind nur `public` und `graphql_public`). Die Vollständigkeitsaussage in `:98` ist jetzt richtig. Restunschärfe siehe R2-N1.
- **M2**, behoben. `:34` grenzt die Regel auf `service_requests` ein und verweist auf Abweichung (4). `:98` (4) stimmt: Spalten-Grant 0001:383, Policy 0017:114-116, Trigger-Funktion und Trigger 0017:118-132. NA-16 existiert (`OPEN_ISSUES.md:293`).
- **N1**, behoben. `:34` lautet jetzt „ohne Rollen-Ausnahme im Trigger (Grenze: der Datenbank-Eigentümer …)“ und passt damit zu 0017:6 und `:94`.
- **N2**, behoben. `:98` (5) nennt 0016:206-207 korrekt: Die Policy prüft nur `payee_id` oder `is_admin()`, ein aal2 des Zahlungsempfängers verlangt sie nicht. NA-18 existiert.
- **N3**, behoben (`:150`).
- **N4**, behoben (`:105`). 0001:173 hat für `offer_id` kein ON DELETE. Die übrigen Kaskaden habe ich nachgeprüft:
  - `profiles`: 0001:29.
  - Anfragen: 0001:107. `request_delete_guard` lässt eine Kaskade in Trigger-Tiefe über 1 zu (0017:142, 0018:127-130).
  - Mietanfragen des Kunden: 0001:174.
  - Fotos: 0001:135 mit `photo_immutable` (0020:70).
  - Revisionen, Ereignisse und Kontakte: 0018:12, 0017:156, 0018:207.
- **N6**, behoben. Die Spaltensemantik ist in `:48` festgelegt, `:66` ist angeglichen, und `:61` steht jetzt im Einklang mit `:48`. Zwei Restzellen siehe R2-N2.
- **N7**, behoben (`:106`). 0019:13-16 entfernt die PLZ-Spalten.
- **N5**, ebenfalls erledigt: `docs/proof/archdoku/archdoku-abgleich.md` existiert jetzt.
- **N8** ist korrekt als NA-19 geführt. Der Verweis aus `ARCHITECTURE.md` fehlt, siehe R2-N3.

### 2. Vollständigkeit

Die Matrix ist vollständig. Abgleich gegen alle Anweisungen zum Anlegen und Löschen in 0001 bis 0022:

- **Tabellen (18):** profiles, price_versions, price_config, platform_settings, service_requests, request_photos, rental_offers, rental_bookings, fee_splits, geo_boundaries (0001); route_cache, route_rate_limits (0006); audit_log (0015); status_events (0017); price_revisions, request_contacts (0018); geocode_cache, geo_districts (0019). Alle 18 stehen in `:53-68`.
- **Views (2):** current_price_version, current_fee_rates. Beide stehen in `:56` und `:69`. Weitere Views gibt es nicht.
- **Private Funktionen im Endzustand (24):** `photo_count` entfiel mit 0011:36, `request_photos_before_insert` mit 0020:33-34.
  - SECURITY DEFINER (12), alle in `:77`, `:78` und `:82`: my_role, handle_new_user, is_admin, assert_admin, price_version_hash, guard_price_config, do_publish, publish_seed_version, log_request_status, guard_platform_setting, require_revision, staging_photo_count.
  - SECURITY INVOKER (12), alle in `:87`. Die Liste ist vollständig, es gibt keine weitere private Funktion ohne SECURITY DEFINER.
- **Öffentliche Funktionen:** Alle 19 im Endzustand stehen in `:75-86`. Dazu kommt `become_rental_provider` als entfallen (`:88`, 0022:7).
- **Weitere Objekte:**
  - Die Trigger `set_updated_at` (0001:231-238) rufen `extensions.moddatetime`. Diese Funktion gehört zur Erweiterung im Schema `extensions`, nicht zu `public` oder `private`, und muss nicht in die Matrix.
  - Die Schema-Freigabe auf `private` steht in `:90`.
  - Storage, also der Bucket und die Policies für SELECT, INSERT und DELETE, steht in `:60`. Eine UPDATE-Policy gibt es nicht.

### 3. Mehr Rechte als im Endzustand, neue Widersprüche zu CLAUDE.md

- **Mehr Rechte:** Keine Stelle beschreibt für Kunde, Partner oder Admin-JWT mehr Rechte als der Endzustand. Die neuen Sätze habe ich einzeln geprüft:
  - `:34`: Direktes UPDATE nur bei `rental_bookings`, begrenzt auf requested → withdrawn (0017:114-132).
  - `:48`: Ein admin hat als Eigentümer nur Kundenrechte. Der Satz gibt keine Schreibrechte für admin zurück.
  - `:87` und `:90`: Trigger-Funktionen sind nicht direkt aufrufbar; anon hat kein USAGE auf `private`.
  - `:98` und `:105`: Diese Sätze beschreiben nur Einschränkungen.
- **CLAUDE.md:** Die Änderungen erzeugen keine neuen Widersprüche zu CLAUDE.md. Die zwei bekannten Abweichungen sind jetzt offen geführt:
  - (4): Storno von Mietanfragen per direktem UPDATE.
  - (5): `fee_splits` ohne aal2.
- **Geldaussagen:** Sie bleiben korrekt (`:37-40`, `:150`). Seit 0018 rechnet `quote` keine Gebühr, kein Satz steht im Client, und Kunden lesen weder Satz noch Aufteilung (`:57`, `:69`).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| 0001:12-14 | Schema `private` angelegt, PUBLIC entzogen, USAGE nur authenticated, wie `:90` |
| 0001:173 | `offer_id` ohne ON DELETE, wie `:105` |
| 0001:29, 107, 135, 174 | Kaskaden Profil, Anfragen, Fotos, Mietanfragen des Kunden, wie `:105` |
| 0001:231-238 | `set_updated_at` ruft `extensions.moddatetime`, nicht in `private`, keine Matrixzeile nötig |
| 0001:383 | `grant update (status)` auf rental_bookings für authenticated, wie `:98` (4) |
| 0007:4-17 | SECURITY INVOKER (Zeile 6), keine Revoke-Anweisung, wie `:90` und `:98` (6) |
| 0015:30-38 | append_only ohne SECURITY DEFINER, Entzug Zeile 38, wie `:87` |
| 0015:93-125 | guard_price_version ohne SECURITY DEFINER, Entzug Zeile 125, wie `:87` |
| 0015:134-135 | guard_price_config ist SECURITY DEFINER, korrekt in `:82` statt `:87` |
| 0016:34-35, 61 | guard_platform_setting ist SECURITY DEFINER mit Entzug, korrekt in `:82` |
| 0016:130-144 | guard_profile_role ohne SECURITY DEFINER, Entzug Zeile 144, wie `:87` |
| 0016:206-207 | fee_splits-Policy ohne aal2-Bedingung für payee, wie `:98` (5) |
| 0017:6 | Grenze Datenbank-Eigentümer, wie `:34` und `:94` |
| 0017:114-132 | Policy requested → withdrawn, Trigger guard_rental_status, wie `:62` und `:98` (4) |
| 0017:138-149 | immutable_row ohne SECURITY DEFINER, Entzug Zeile 149, wie `:87` |
| 0017:179-180 | log_request_status ist SECURITY DEFINER, korrekt in `:82` |
| 0017:201-236 | guard_request_insert und guard_request_status ohne SECURITY DEFINER, Entzug Zeilen 212 und 236, wie `:87` |
| 0018:36-77 | guard_revision_insert ohne SECURITY DEFINER, Entzug Zeile 77, wie `:87` |
| 0018:127-130 | request_delete_guard über immutable_row, Kaskade erlaubt, wie `:58` und `:105` |
| 0018:144-181 | guard_request_pointer und guard_request_fields ohne SECURITY DEFINER, Entzug Zeilen 162 und 181, wie `:87` |
| 0018:187-198 | require_revision ist SECURITY DEFINER, korrekt in `:82` |
| 0019:13-16 | PLZ-Spalten entfallen, district Pflicht, wie `:106` |
| 0019:63-64 | geo_districts_make_valid ruft private.geo_boundaries_make_valid, fehlt im Beleg `:87` (R2-N1) |
| 0020:33-34 | request_photos_before_insert entfernt, zu Recht nicht in der Matrix |
| 0020:44-64 | guard_photo_insert ohne SECURITY DEFINER, Entzug Zeile 64, wie `:87` |
| 0021:8-26 | guard_photo_insert per Ersetzen (Rechte bleiben erhalten), ohne SECURITY DEFINER, wie `:87` |
| 0021:34-44 | staging_photo_count ist SECURITY DEFINER, Entzug für PUBLIC und anon, EXECUTE authenticated, wie `:78` |
| 0011:36 | photo_count entfernt, zu Recht nicht in der Matrix |
| supabase/config.toml:13 | API-Schemas nur `public` und `graphql_public`, wie `:90` |
| docs/proof/archdoku/ | archdoku-abgleich.md vorhanden (N5 erledigt) |
| docs/OPEN_ISSUES.md:292-296 | NA-15, NA-16, NA-18, NA-19 vorhanden; Erledigt-Vermerke fehlen (R2-N4) |

Offene Findings hoch: 0
