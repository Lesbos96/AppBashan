# Abgleich RLS-Matrix mit tests/rls/ (Stand 9485f88 + archdoku, Endzustand nach 0022)

Quelle der Zeilen: `docs/ARCHITECTURE.md`, Abschnitt „RLS- und Rechte-Matrix". Tests: `tests/rls/*.test.ts` (acht Dateien).
Lesart: **ja** = der Test prüft das Recht, **–** = nicht geprüft. „erlaubt" = Positivkontrolle des Rechts (die Rolle darf wirklich), „verweigert" = die Rolle bekommt 42501, 0 Zeilen oder den Trigger-Code. Eine Zeile gilt nur dann als belegt, wenn beides **ja** ist (oder eines davon „n. a." ist, weil es das Recht nicht gibt, z. B. kein Grant).
Kürzel: R = `rls.test.ts`, S = `status.test.ts`, E = `settings.test.ts`, Q = `quote.test.ts`, H = `quote-hardening.test.ts`, U = `uploads.test.ts`, T = `route.test.ts`, A = `auth.test.ts`.
Grant-Ebene: Ein 42501 für `authenticated` gilt unabhängig vom JWT-Claim aal; ein Test mit admin (aal1) belegt deshalb die Verweigerung eines fehlenden Grants auch für admin (aal2). Fehlt nur die Policy (Grant vorhanden), belegt aal1 nichts für aal2; solche Zeilen stehen unter Lücken.

## Tabellen

| # | Objekt / Recht | Rolle | erlaubt | verweigert | Beleg | Lücke |
|---|---|---|---|---|---|---|
| 1 | profiles: S eigene | Kunde | ja | ja (fremde) | R:219-221, 437-441 | |
| 2 | profiles: U (display_name, phone) eigene | Kunde | ja | ja (fremde 0 Zeilen, `role` gesperrt) | R:222-224, 429-441 | |
| 3 | profiles: I, D | Kunde | n. a. | – | – | L1 |
| 4 | profiles: S | anon | n. a. | ja | R:167-173, A:57 | |
| 5 | profiles: S alle | admin aal2 | ja | ja (aal1: 1 Zeile) | E:302-303 | |
| 6 | profiles: `role`, `id` nur mit Marker | service_role | ja (Gegenfall `name_update_ok`, `grant_ok`) | ja | E:304-312 | |
| 7 | profiles: D entzogen | service_role | n. a. | ja | S:236, 240 | |
| 8 | price_versions: S veröffentlichte | anon, Kunde | ja | ja (unveröffentlichte unsichtbar) | R:414-419, E:300-301 | |
| 9 | price_versions: S alle | admin aal2 | ja | ja (aal1: 0) | E:298-299 | |
| 10 | price_versions: I U | Kunde, admin aal1 | n. a. | ja | E:111-117 | |
| 11 | price_versions: D | Kunde, anon, Vermieter, admin | n. a. | – | – | L2 |
| 12 | price_versions: I U D auf unveröffentlicht / gesperrt auf veröffentlicht, TRUNCATE entzogen | service_role | ja | ja | R:93, E:51-109, 119-123 | |
| 13 | price_config: S veröffentlichte Versionen | anon, Kunde | ja | – (Zeilen einer unveröffentlichten Version nicht geprüft) | R:161, 398, 407 | L3 |
| 14 | price_config: S alle | admin aal2 | – | – | – | L3 |
| 15 | price_config: I U D | Kunde, Vermieter, anon, admin aal1 | n. a. | ja | R:368-375 | |
| 16 | price_config: Schreiben nur über `admin_set_price_config` | service_role | ja | ja (p_actor Kunde: not_admin; veröffentlicht: version_published) | R:377-394, E:59-65 | |
| 17 | current_price_version: S | anon, Kunde | ja | n. a. | R:414-419 | |
| 18 | platform_settings: 0 Zeilen | anon, Kunde | n. a. | ja | R:167-173, 321-326, 447, Q:294-296 | |
| 19 | platform_settings: S alle Zeilen | rental_provider | ja | ja (fremde Konten ohne Rolle: 0) | R:332-334 | |
| 20 | platform_settings: S | admin aal2 | – | – | – | L4 |
| 21 | platform_settings: I U D | Kunde, admin aal1, rental_provider (I U) | n. a. | ja (D nur Kunde und admin) | E:240-247, R:336-341 | |
| 22 | platform_settings: S | partner | – | – | – | L5 |
| 23 | platform_settings: Gebührenschlüssel-Trigger, andere Schlüssel frei, TRUNCATE entzogen | service_role | ja (`*_ok`) | ja | E:173-238 | |
| 24 | service_requests: S eigene | Kunde | ja | ja (fremde) | R:181-185 | |
| 25 | service_requests: S | anon | n. a. | ja | R:167-173 | |
| 26 | service_requests: S alle | admin aal2 | – | – | – | L6 |
| 27 | service_requests: U, I | Kunde, partner, admin aal1/aal2, anon | n. a. | ja | R:229-238, S:38-55, 86, Q:300-305 | |
| 28 | service_requests: D | Kunde | n. a. | – | – | L7 |
| 29 | service_requests: `withdraw()` eigene / fremde / zweimal / anon | Kunde | ja | ja | R:241-250, S:89-103 | |
| 30 | service_requests: U nur `current_revision`; D, TRUNCATE gesperrt; INSERT-Status; Revision beim Commit | service_role | ja (Zeiger, INSERT über `quote_save_request`) | ja | S:78-87, 210-241 | |
| 31 | request_photos: S eigene | Kunde | ja | ja (fremde 0 Zeilen) | R:187-189, U:257-285 | |
| 32 | request_photos: I U D | Kunde, anon | n. a. | ja | U:503-543, R:202, 256 | |
| 33 | request_photos: S fremde | admin aal2, partner | – | – | – | L8 |
| 34 | request_photos: I nur im Funktionsaufruf, U D gesperrt, TRUNCATE, Kaskade | service_role, Eigentümer | ja (Übernahme, Kaskade) | ja | U:257-357, 545-629 | |
| 35 | Storage: I im eigenen Staging-Ordner, S eigener Ordner, D eigenes Staging-Foto | Kunde | ja | ja (fremder Ordner, falsche Form, Überschreiben, Verschieben, fremdes Löschen, nach dem Absenden, 41. Datei) | U:99-250, 450-500, 702-737, R:190-211 | |
| 36 | Storage: S, I, D | anon | n. a. | ja | U:121-134, 152-206, R:175-177 | |
| 37 | Storage: S fremder Ordner | admin aal2 | – | – | – | L8 |
| 38 | Storage: Bucket privat, 10 MB, nur JPEG | – | ja | ja (413, 415) | U:100-120, 224-255 | |
| 39 | rental_offers: S approved | anon | ja | ja (nur approved) | R:160-165 | |
| 40 | rental_offers: S approved, eigene | Kunde | ja | ja (fremde pending unsichtbar) | R:310-317 | |
| 41 | rental_offers: I eigene (pending, kein Demo) | rental_provider | ja | ja (status, is_demo gesperrt; Kunde ohne Rolle) | R:269-297 | |
| 42 | rental_offers: U eigene | Kunde-Konto mit eigenem Angebot, rental_provider | ja | ja (fremde, Demo) | R:300-308 | L9 |
| 43 | rental_offers: I U D | anon | n. a. | – | – | L10 |
| 44 | rental_offers: D | alle | n. a. | – | – | L10 |
| 45 | rental_offers: S alle | admin aal2 | – | – | – | L11 |
| 46 | rental_offers: S I U D (Standard) | service_role | ja | n. a. | R:136, Q:253-262 | |
| 47 | rental_bookings: S eigene | Kunde | ja | ja (fremde) | R:213-217 | |
| 48 | rental_bookings: U (status) nur requested → withdrawn | Kunde | ja | ja (anderer Status, fremder Kunde, Trigger, Eigentümer) | R:259-263, S:115-141 | |
| 49 | rental_bookings: I | Kunde | n. a. | ja | R:229-232 | |
| 50 | rental_bookings: S alle; U nicht | admin aal2 | – | – | – | L12 |
| 51 | rental_bookings: I; U D TRUNCATE entzogen | service_role | ja | ja | H:291-299, S:115-122 | |
| 52 | fee_splits: S mit payee_id = ich | rental_provider | ja | ja (anderer Vermieter) | R:328-333 | |
| 53 | fee_splits: S | Kunde, anon | n. a. | ja | R:321-326 | |
| 54 | fee_splits: S alle | admin aal2 | ja | ja (aal1: 0) | R:343-348 | |
| 55 | fee_splits: I | Vermieter, admin aal1, service_role | n. a. | ja | R:350-357, S:143-147 | |
| 56 | fee_splits: U, D | alle | n. a. | – (nur INSERT getestet) | – | L13 |
| 57 | audit_log: S | admin aal2 | ja | ja (aal1, Kunde, anon) | E:289-294 | |
| 58 | audit_log: U D TRUNCATE gesperrt, I erlaubt | service_role, Eigentümer | ja (`audit_insert_ok`) | ja | E:281-289, 314-327 | |
| 59 | audit_log: I U D | Kunde | n. a. | – | – | L14 |
| 60 | status_events: S | admin aal2 | ja | ja (aal1, Kunde, partner, anon) | S:275-283 | |
| 61 | status_events: kein Recht, nur anfügen | service_role, Eigentümer, Kunde | ja (Trigger schreibt, S:89-95) | ja | S:255-273 | |
| 62 | price_revisions: S eigene | Kunde | ja | ja (fremde, admin aal2/aal1, partner, anon) | S:291-302 | |
| 63 | price_revisions: I | Kunde | n. a. | ja | S:308 | |
| 64 | price_revisions: U D | Kunde | n. a. | – | – | L15 |
| 65 | price_revisions: I nur Revision 1 submit; U D TRUNCATE gesperrt | service_role, Eigentümer | ja | ja | S:151-208 | |
| 66 | request_contacts: S eigene | Kunde | ja | ja (fremde, admin, partner, anon) | S:294-302 | |
| 67 | request_contacts: I U | Kunde | n. a. | ja | S:306-307 | |
| 68 | request_contacts: D | Kunde | n. a. | – | – | L16 |
| 69 | request_contacts: I erlaubt, U D entzogen | service_role | ja | ja | S:309-313 | |
| 70 | geo_boundaries, route_cache, route_rate_limits: S I | anon, Kunde | n. a. | ja | T:56-67 | |
| 71 | geo_boundaries, route_cache, route_rate_limits: S I | service_role | ja | n. a. | T:69-77 | |
| 72 | geocode_cache, geo_districts: S I | anon, Kunde | n. a. | ja | H:264-272 | |
| 73 | geocode_cache, geo_districts: S | service_role | ja | n. a. | H:273-274 | |
| 74 | geo_boundaries … geocode_cache: S | admin aal2 | n. a. | – (Grant-Ebene: durch Kunde-Test mitbelegt) | T:56-67, H:264-272 | |
| 75 | current_fee_rates: NULL / Satz / 42501 | Kunde / rental_provider / anon | ja | ja | Q:294-298 | |
| 76 | current_fee_rates: S mit Satz | admin aal2 | – | n. a. | – | L4 |

## Funktionen (EXECUTE)

| # | Funktion | Rolle | erlaubt | verweigert | Beleg | Lücke |
|---|---|---|---|---|---|---|
| 77 | booking_terms | anon, Kunde | ja | n. a. (offen, ohne `fee_*`) | E:249-262 | |
| 78 | withdraw | Kunde | ja | ja (anon 42501) | S:89-103 | |
| 79 | withdraw | service_role | – | – | – | L17 |
| 80 | is_admin, my_role, staging_photo_count | Kunde | ja (Policies, Kontingent) | n. a. | R:450-470, U:707-737 | |
| 81 | publish_version, admin_create_price_version, admin_set_price_config, admin_set_setting, verify_price_version | anon, Kunde, admin aal1 | n. a. | ja (42501 `for function`) | E:127-144 | |
| 82 | dieselben | service_role | ja (alle bis auf `publish_version`: dort nur der Fehlerpfad `version_published`) | ja (p_actor Kunde: not_admin) | E:121, 146-157, 197; R:377-386 | L18 |
| 83 | admin_grant_role | alle inkl. service_role | n. a. (Eigentümer: `grant_ok`) | ja | E:146-149, 309-312 | |
| 84 | quote_save_request, quote_save_booking | anon, Kunde | n. a. | ja | Q:280-288 | |
| 85 | dieselben | service_role | ja | n. a. | Q:289-291, H:301-303 | |
| 86 | take_rate_tokens, route_geo_facts, route_cleanup | anon, Kunde | n. a. | ja | T:64-66 | |
| 87 | dieselben | service_role | ja | n. a. | T:75-76, 166-178 | |
| 88 | photo_orphans, photo_cleanup, photo_staging_interval | anon, Kunde | n. a. | ja | U:632-648 | |
| 89 | dieselben | service_role | ja | n. a. | U:641, 415-448, 674-682 | |
| 90 | price_version_hold, quote_district | anon, Kunde | n. a. | ja | H:277-285 | |
| 91 | dieselben | service_role | ja | n. a. | H:286-288 | |
| 92 | SECURITY-DEFINER-Allowlist (Eigentümer, search_path, EXECUTE-Liste) | anon, Kunde | ja | ja | R:450-470 | |
| 93 | become_rental_provider entfernt | Kunde | n. a. | ja | R:443-448 | |
| 94 | private-SD-Hilfen ohne EXECUTE (assert_admin, price_version_hold …) | Kunde | n. a. | nur über die Allowlist (R:460-469); nicht-SD private Funktionen ungeprüft | R:450-470 | L19 |

## Lücken (nur aufgelistet, keine Tests geschrieben)

| ID | Lücke | Wirkung, wenn die Sperre fehlte | Schwere |
|---|---|---|---|
| L1 | profiles: INSERT und DELETE für Kunde nicht geprüft (kein Grant, kein Test) | Konto-Profile anlegen oder löschen | niedrig (Grant fehlt, 0001:253-261) |
| L2 | price_versions: DELETE für Kunde, anon, Vermieter, admin nicht geprüft (INSERT/UPDATE nur Kunde und admin aal1) | Tarifversion löschen | niedrig (Grant 0015:270 entzogen, Trigger sperrt veröffentlichte) |
| L3 | price_config: Sichtbarkeit unveröffentlichter Zeilen für anon und Kunde sowie Lesen aller Zeilen für admin aal2 ungeprüft (nur `price_versions` ist geprüft) | unveröffentlichte Tarife sichtbar | mittel (Policy 0015:280-283) |
| L4 | admin aal2 liest `platform_settings` und `current_fee_rates` mit Satz: nicht geprüft; admin aal1 ebenso | Positivfall der Matrix unbelegt | niedrig |
| L5 | partner liest `platform_settings` nicht: ungeprüft (Abweichung von CLAUDE.md, die alle Partner-Konten den Satz lesen lässt, ist als offen in der Matrix vermerkt) | – | niedrig |
| L6 | admin aal2 liest `service_requests` aller Kunden: Positivfall ungeprüft | Matrixzeile „S alle" unbelegt | niedrig |
| L7 | service_requests: DELETE für Kunde ungeprüft | Anfragen löschen | niedrig (kein Grant; Trigger `request_delete_guard`) |
| L8 | request_photos und Storage: admin aal2 und partner lesen fremde Fotos nicht: ungeprüft (die admin-Klausel wurde in 0020 entfernt) | GPS-/Hausfotos für admin sichtbar | mittel (CLAUDE.md: Partner sehen Fotos erst nach Prüfung; Policy 0020:40-41, 103-104) |
| L9 | rental_offers: UPDATE durch Konto ohne Rolle rental_provider an eigenem (auch freigegebenem) Angebot: Verhalten in der Matrix beschrieben (0001:378-379), nicht getestet | frühere Vermieter ändern freigegebene Angebote | niedrig (Entscheidung 18) |
| L10 | rental_offers: INSERT/UPDATE für anon, DELETE für alle ungeprüft | Angebote anlegen/löschen | niedrig (kein Grant) |
| L11 | rental_offers: admin aal2 liest alle Angebote: ungeprüft | – | niedrig |
| L12 | rental_bookings: admin aal2 liest alle (S) und darf nicht ändern (U): beides ungeprüft; genau die Zeile aus NA-10 | Admin-JWT mit Status-Update | mittel (Policy 0017:114-116; der Trigger `guard_rental_status` begrenzt den Schaden auf requested → withdrawn) |
| L13 | fee_splits: UPDATE und DELETE (service_role, Kunde, Vermieter, admin) ungeprüft; nur INSERT | Aufteilung verändern | niedrig (0018:133 entzogen; Tabelle leer) |
| L14 | audit_log: INSERT durch authenticated ungeprüft | Journal fälschen | mittel (Grant entzogen 0015:46; Test fehlt) |
| L15 | price_revisions: UPDATE, DELETE durch Kunde ungeprüft | Preisbeleg ändern | niedrig (Grant fehlt; Trigger sperrt auch den Eigentümer) |
| L16 | request_contacts: DELETE durch Kunde ungeprüft | Kontakt löschen | niedrig |
| L17 | withdraw: Aufruf mit service_role ungeprüft (Funktion verlangt `auth.uid()`) | – | niedrig |
| L18 | publish_version: erfolgreicher Aufruf durch service_role nur als Transaktion mit Rollback in E:48 bzw. Fehlerpfad E:66; kein API-Gegenfall | – | niedrig |
| L19 | private-Funktionen, die nicht SECURITY DEFINER sind (Trigger-Funktionen), tauchen in der Allowlist-Abfrage nicht auf | Aufruf von `guard_*` durch Konten | niedrig (Schema `private` nicht exponiert; `revoke all … from public`) |

Offen in der Matrix (nicht in den Migrationen belegbar, siehe ARCHITECTURE.md): Partner-Lesen des Gebührensatzes, Plattform-Standardrechte von service_role, Frist von `geocode_cache`.
