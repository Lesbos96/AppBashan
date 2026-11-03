# S9a-3 Rot-Beweis

Stand 2026-11-03T18:32:58.161Z (Dev-Projekt). Teil 1 SQL: lockern (committet), Ist-Wert-Probe (Rollback) und zuständigen Test laufen lassen, Original wiederherstellen (Restore-SQL vorher nach tmp/proof/s9a3-restore-*.sql), Probe erneut. Teil 2 Redeploy (R2-N13): Quelltext lockern, quote deployen, Test muss rot werden, Datei aus dem vorher gelesenen Inhalt zurück, neu deployen, Test grün, md5 der Datei vorher und nachher gleich. Teil 3 Werkzeuge (N-15, N-16).

Format der Probe: „Ergebnis | Wert“. Ergebnis ist „ok“ oder „SQLSTATE: Meldung“; Wert ist der Zustand danach. „Schicht“: eine zweite Sperre dahinter hält, kein Beweis der ersten.

## rental_bookings: UPDATE für service_role (Schicht: guard_rental_status)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | withdrawn` (erwartet `ok | withdrawn`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table rental_bookings | requested` (erwartet `42501: permission denied for table rental_bookings | requested`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "rental_bookings: service_role darf" gelockert: 1 rot von 1 gelaufen (AssertionError: expected undefined to be '42501' // Object.is equality) ✓
- Bewertung: bestanden

## rental_bookings: UPDATE ungültiges Statuspaar (Schicht: guard_rental_status)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `P0001: invalid_transition | requested` (erwartet `P0001: invalid_transition | requested`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table rental_bookings | requested` (erwartet `42501: permission denied for table rental_bookings | requested`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## rental_bookings: DELETE für service_role (Schicht: Löschschutz)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `ok | 0` (erwartet `ok | 0`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table rental_bookings | 1` (erwartet `42501: permission denied for table rental_bookings | 1`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "rental_bookings: service_role darf" gelockert: 1 rot von 1 gelaufen (AssertionError: expected undefined to be '42501' // Object.is equality) ✓
- Bewertung: bestanden

## terms_missing: Bedingungen im Snapshot nicht mehr verlangt (Schicht: invalid_revision)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `P0001: invalid_revision | 1` (erwartet `P0001: invalid_revision | 1`) ✓
- Gesperrt/Wiederhergestellt: `P0001: terms_missing | 1` (erwartet `P0001: terms_missing | 1`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "terms_missing" gelockert: 2 rot von 2 gelaufen (AssertionError: expected { code: 'P0001', details: null, …(2) } to match object { code: 'P0001', …(1) }) ✓
- Bewertung: bestanden

## district_required: Bezirk nicht mehr verlangt (Schicht: NOT NULL der Spalte)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `23502: null value in column "district" of relation "service_requests" violates not-null constraint | 1` (erwartet `23502: null value in column "district" of relation "service_requests" violates not-null constraint | 1`) ✓
- Gesperrt/Wiederhergestellt: `P0001: district_required | 1` (erwartet `P0001: district_required | 1`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "quote_save_request: eigene Prüfungen" gelockert: 1 rot von 10 gelaufen (AssertionError: expected { code: '23502', …(3) } to match object { code: 'P0001', …(1) }) ✓
- Bewertung: bestanden

## contact_required: Kontakt nicht mehr verlangt (Schicht: NOT NULL der Spalten)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `23502: null value in column "name" of relation "request_contacts" violates not-null constraint | 1` (erwartet `23502: null value in column "name" of relation "request_contacts" violates not-null constraint | 1`) ✓
- Gesperrt/Wiederhergestellt: `P0001: contact_required | 1` (erwartet `P0001: contact_required | 1`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "quote_save_request: eigene Prüfungen" gelockert: 2 rot von 10 gelaufen (AssertionError: expected { code: '23502', …(3) } to match object { code: 'P0001', …(1) }) ✓
- Bewertung: bestanden

## confirmed_required: Bestätigung nicht mehr verlangt (Schicht: NOT NULL audit_log.detail)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `23502: null value in column "detail" of relation "audit_log" violates not-null constraint | 1/1` (erwartet `23502: null value in column "detail" of relation "audit_log" violates not-null constraint | 1/1`) ✓
- Gesperrt/Wiederhergestellt: `P0001: confirmed_required | 1/1` (erwartet `P0001: confirmed_required | 1/1`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "quote_save_request: eigene Prüfungen" gelockert: 1 rot von 10 gelaufen (AssertionError: expected { code: '23502', …(3) } to match object { code: 'P0001', …(1) }) ✓
- Bewertung: bestanden

## too_late: Mindestvorlauf nicht mehr geprüft (N-6, Test läuft gelockert)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 2` (erwartet `ok | 2`) ✓
- Gesperrt/Wiederhergestellt: `P0001: too_late | 1` (erwartet `P0001: too_late | 1`) ✓
- Test `tests/rls/quote.test.ts` -t "too_late" gelockert: 1 rot von 1 gelaufen (AssertionError: expected { status: 200, body: { …(5) } } to match object { status: 422, …(1) }) ✓
- Bewertung: bestanden

## request_contacts_format: Kontaktformat-Constraint entfernt

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 2` (erwartet `ok | 2`) ✓
- Gesperrt/Wiederhergestellt: `23514: new row for relation "request_contacts" violates check constraint "request_contacts_format" | 1` (erwartet `23514: new row for relation "request_contacts" violates check constraint "request_contacts_format" | 1`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "Kontaktformat zusätzlich in der Datenbank" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null to match object { code: '23514' }) ✓
- Bewertung: bestanden

## quote_district: Prüfung „liegt in Wien“ ausgeschaltet (Grazer Punkt)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | true` (erwartet `ok | true`) ✓
- Gesperrt/Wiederhergestellt: `ok | false` (erwartet `ok | false`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "price_version_hold und quote_district" gelockert: 1 rot von 1 gelaufen (AssertionError: expected { in_vienna: true, …(2) } to deeply equal { in_vienna: false, …(2) }) ✓
- Bewertung: bestanden

## quote_district: Bezirk aus falschem Polygon (immer 99)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 99` (erwartet `ok | 99`) ✓
- Gesperrt/Wiederhergestellt: `ok | 1` (erwartet `ok | 1`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "price_version_hold und quote_district" gelockert: 1 rot von 1 gelaufen (AssertionError: expected { in_vienna: true, …(2) } to deeply equal { in_vienna: true, …(2) }) ✓
- Bewertung: bestanden

## geo_districts: SELECT für authenticated (Schicht: RLS ohne Policy)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `ok | 23` (erwartet `ok | 23`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table geo_districts | 23` (erwartet `42501: permission denied for table geo_districts | 23`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "geocode_cache und geo_districts" gelockert: 1 rot von 1 gelaufen (AssertionError: geo_districts: expected undefined to be '42501' // Object.is equality) ✓
- Bewertung: bestanden

## geocode_cache: SELECT für authenticated (isoliert: Lese-Policy nur in der Probe)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table geocode_cache | 0` (erwartet `42501: permission denied for table geocode_cache | 0`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "geocode_cache und geo_districts" gelockert: 1 rot von 1 gelaufen (AssertionError: geocode_cache: expected undefined to be '42501' // Object.is equality) ✓
- Bewertung: bestanden

## quote_district: EXECUTE für authenticated (Schicht: kein Recht auf geo_boundaries)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `42501: permission denied for table geo_boundaries | 1` (erwartet `42501: permission denied for table geo_boundaries | 1`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for function quote_district | 1` (erwartet `42501: permission denied for function quote_district | 1`) ✓
- Test `tests/rls/quote-hardening.test.ts` -t "price_version_hold und quote_district" gelockert: 1 rot von 1 gelaufen (AssertionError: expected 'permission denied for table geo_bound…' to contain 'permission denied for function quote_…') ✓
- Bewertung: bestanden

## quote_save_request: EXECUTE für authenticated (isoliert: innere Schichten und photo_staging_interval nur in der Probe offen)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 2` (erwartet `ok | 2`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for function quote_save_request | 1` (erwartet `42501: permission denied for function quote_save_request | 1`) ✓
- Test `tests/rls/quote.test.ts` -t "Schreib-Funktionen: anon und authenticated erhalten 42501" gelockert: 1 rot von 1 gelaufen (AssertionError: quote_save_request: expected 'permission denied for function photo_…' to contain 'permission denied for function quote_…') ✓
- Bewertung: bestanden

## photo_staging_interval: EXECUTE für authenticated (isoliert: innere Schichten und quote_save_request nur in der Probe offen)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 2` (erwartet `ok | 2`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for function photo_staging_interval | 1` (erwartet `42501: permission denied for function photo_staging_interval | 1`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## S9a-1 N2: publish_version für authenticated mit nie angelegter Version 9990 (Schicht: assert_admin)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `42501: not_admin | 0` (erwartet `42501: not_admin | 0`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for function publish_version | 0` (erwartet `42501: permission denied for function publish_version | 0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## S9a-1 N3: assert_admin lässt Nicht-Admin durch

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `42501: not_admin | 0` (erwartet `42501: not_admin | 0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## S9a-1 N3: guard_price_version, INSERT-Zweig (veröffentlicht einfügen)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `P0001: field_immutable | 0` (erwartet `P0001: field_immutable | 0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## S9a-1 N3: TRUNCATE auf platform_settings für service_role (Schicht: Trigger)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `P0001: append_only | 27` (erwartet `P0001: append_only | 27`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table platform_settings | 27` (erwartet `42501: permission denied for table platform_settings | 27`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## S9a-1 N3: booking_terms liefert fee_rate

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | true` (erwartet `ok | true`) ✓
- Gesperrt/Wiederhergestellt: `ok | false` (erwartet `ok | false`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## request_delete_guard nach 0019 ausgeschaltet (Eigentümer-DELETE)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 0` (erwartet `ok | 0`) ✓
- Gesperrt/Wiederhergestellt: `P0001: request_immutable | 1` (erwartet `P0001: request_immutable | 1`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## quote: Abholung außerhalb Wiens nicht mehr geprüft (Schicht: Bezirk aus Polygon)

- Teil: Redeploy; Art: Schicht (zweite Sperre dahinter: zweite Schicht: district null → district_required, kein Beweis der ersten)
- Gelockert/Beobachtet: `1 Test(s) rot: AssertionError: expected { status: 422, …(1) } to match object { status: 422, …(1) }` (erwartet `Test rot`) ✓
- Gesperrt/Wiederhergestellt: `1 grün, 0 rot` (erwartet `Test grün`) ✓
- md5 der Datei vorher `de9fcad2e67ee549090399f0b2c0def7`, nachher `de9fcad2e67ee549090399f0b2c0def7`: gleich
- Bewertung: bestanden

## quote: gezeigter Betrag nicht mehr abgeglichen (Kundenpreis ohne Zustimmung)

- Teil: Redeploy; Art: Sperre
- Gelockert/Beobachtet: `1 Test(s) rot: AssertionError: expected { status: 200, body: { …(5) } } to match object { status: 409, body: { …(3) } }` (erwartet `Test rot`) ✓
- Gesperrt/Wiederhergestellt: `1 grün, 0 rot` (erwartet `Test grün`) ✓
- md5 der Datei vorher `de9fcad2e67ee549090399f0b2c0def7`, nachher `de9fcad2e67ee549090399f0b2c0def7`: gleich
- Bewertung: bestanden

## quote: Haltefenster nicht mehr geprüft (abgelaufene Version zählt)

- Teil: Redeploy; Art: Sperre
- Gelockert/Beobachtet: `1 Test(s) rot: AssertionError: expected 200 to be 409 // Object.is equality` (erwartet `Test rot`) ✓
- Gesperrt/Wiederhergestellt: `1 grün, 0 rot` (erwartet `Test grün`) ✓
- md5 der Datei vorher `de9fcad2e67ee549090399f0b2c0def7`, nachher `de9fcad2e67ee549090399f0b2c0def7`: gleich
- Bewertung: bestanden

## quote: Bedingungen-Hash nicht mehr abgeglichen

- Teil: Redeploy; Art: Sperre
- Gelockert/Beobachtet: `1 Test(s) rot: AssertionError: expected 200 to be 409 // Object.is equality` (erwartet `Test rot`) ✓
- Gesperrt/Wiederhergestellt: `1 grün, 0 rot` (erwartet `Test grün`) ✓
- md5 der Datei vorher `de9fcad2e67ee549090399f0b2c0def7`, nachher `de9fcad2e67ee549090399f0b2c0def7`: gleich
- Bewertung: bestanden

## quote: Client-Punkt bindet nicht mehr an den Kandidaten (Schicht: Bezirk/Wien-Prüfung)

- Teil: Redeploy; Art: Schicht (zweite Sperre dahinter: zweite Schicht: Wien-Prüfung am Kandidaten, kein Beweis der ersten)
- Gelockert/Beobachtet: `1 Test(s) rot: AssertionError: expected { status: 422, …(1) } to match object { status: 422, …(1) }` (erwartet `Test rot`) ✓
- Gesperrt/Wiederhergestellt: `1 grün, 0 rot` (erwartet `Test grün`) ✓
- md5 der Datei vorher `de9fcad2e67ee549090399f0b2c0def7`, nachher `de9fcad2e67ee549090399f0b2c0def7`: gleich
- Bewertung: bestanden

## N-15: falsche Ref in SUPABASE_PROJECT_ID erreicht Dev nicht

- Teil: Werkzeug; Art: Werkzeug
- Gelockert/Beobachtet: `falsche Ref: Exit 1` (erwartet `Exit ≠ 0`) ✓
- Gesperrt/Wiederhergestellt: `Dev-Ref: Exit 0` (erwartet `Exit 0`) ✓
- Bewertung: bestanden

## N-16: scan-proof, sauber

- Teil: Werkzeug; Art: Werkzeug
- Gelockert/Beobachtet: `Exit 0` (erwartet `Exit 0`) ✓
- Gesperrt/Wiederhergestellt: `erwartet Exit 0` (erwartet `Exit 0`) ✓
- Bewertung: bestanden

## N-16: scan-proof, Access Token

- Teil: Werkzeug; Art: Werkzeug
- Gelockert/Beobachtet: `Exit 1` (erwartet `Exit 1`) ✓
- Gesperrt/Wiederhergestellt: `erwartet Exit 1` (erwartet `Exit 1`) ✓
- Bewertung: bestanden

## N-16: scan-proof, Verbindungs-URL

- Teil: Werkzeug; Art: Werkzeug
- Gelockert/Beobachtet: `Exit 1` (erwartet `Exit 1`) ✓
- Gesperrt/Wiederhergestellt: `erwartet Exit 1` (erwartet `Exit 1`) ✓
- Bewertung: bestanden

## N-16: scan-proof, Verzeichnis fehlt

- Teil: Werkzeug; Art: Werkzeug
- Gelockert/Beobachtet: `Exit 2` (erwartet `Exit 2`) ✓
- Gesperrt/Wiederhergestellt: `erwartet Exit 2` (erwartet `Exit 2`) ✓
- Bewertung: bestanden

## Definitionen vorher/nachher (SQL-Teil)

Policies, Trigger (inkl. tgenabled), Constraints, Funktionen (md5) und Rechte sind identisch.

Ergebnis: SQL 12 Sperren und 10 Schichten, Redeploy 3 Sperren und 2 Schichten, Werkzeuge 5 bewiesen von 32.
