# S9a-4 Rot-Beweis

Stand 2026-11-03T19:31:22.294Z (Dev-Projekt). Teil 1 SQL und Storage: lockern (committet), Ist-Wert-Probe (Rollback bzw. Storage-API), zuständigen Test laufen lassen, aus den vorher gelesenen Definitionen wiederherstellen (Restore-SQL vorher nach tmp/proof/s9a4-restore-*.sql), Probe erneut. Teil 2 Live-Probe (R2-N13): Aufrufe gegen die deployte Function `quote` mit Testnutzer-JWT, keine Quelltext-Mutation. Teil 3 Werkzeuge (M-3, A-N4).

Format der Probe: „Ergebnis | Wert“. Ergebnis ist „ok“ oder „SQLSTATE: Meldung“; Wert ist der Zustand danach. „Schicht“: eine zweite Sperre dahinter hält, kein Beweis der ersten.

## photo_missing: Existenz der Datei nicht mehr verlangt (Schicht: fehlende Datei gilt als abgelaufen, N-3)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `P0001: photo_expired | 0/0` (erwartet `P0001: photo_expired | 0/0`) ✓
- Gesperrt/Wiederhergestellt: `P0001: photo_missing | 0/0` (erwartet `P0001: photo_missing | 0/0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## photo_missing und NULL-Zeitstempel nicht mehr geprüft: Foto-ID aus fremdem Ordner wird übernommen

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1/1` (erwartet `ok | 1/1`) ✓
- Gesperrt/Wiederhergestellt: `P0001: photo_missing | 0/0` (erwartet `P0001: photo_missing | 0/0`) ✓
- Test `tests/rls/uploads.test.ts` -t "fremde Foto-ID" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null to match object { code: 'P0001', …(1) }) ✓
- Bewertung: bestanden

## photo_expired: Ablaufprüfung entfernt (abgelaufenes Foto wird übernommen)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1/1` (erwartet `ok | 1/1`) ✓
- Gesperrt/Wiederhergestellt: `P0001: photo_expired | 0/0` (erwartet `P0001: photo_expired | 0/0`) ✓
- Test `tests/rls/uploads.test.ts` -t "abgelaufenes Staging" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null to match object { code: 'P0001', …(1) }) ✓
- Bewertung: bestanden

## too_many_photos: Zählung in der Funktion (Schicht: Trigger guard_photo_insert)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `P0001: too_many_photos | 0/0` (erwartet `P0001: too_many_photos | 0/0`) ✓
- Gesperrt/Wiederhergestellt: `P0001: too_many_photos | 0/0` (erwartet `P0001: too_many_photos | 0/0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## too_many_photos: Zählung im Trigger (Schicht: Funktion)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `P0001: too_many_photos | 0/0` (erwartet `P0001: too_many_photos | 0/0`) ✓
- Gesperrt/Wiederhergestellt: `P0001: too_many_photos | 0/0` (erwartet `P0001: too_many_photos | 0/0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## too_many_photos: Funktion und Trigger gelockert → 9 Fotos

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1/9` (erwartet `ok | 1/9`) ✓
- Gesperrt/Wiederhergestellt: `P0001: too_many_photos | 0/0` (erwartet `P0001: too_many_photos | 0/0`) ✓
- Test `tests/rls/uploads.test.ts` -t "Grenze: 8 Fotos" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null to match object { code: 'P0001', …(1) }) ✓
- Bewertung: bestanden

## photo_staging_hours fehlt: photo_staging_interval liefert Ersatzwert statt Fehler

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 0` (erwartet `ok | 0`) ✓
- Gesperrt/Wiederhergestellt: `P0001: setting_missing | 0` (erwartet `P0001: setting_missing | 0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## photo_staging_hours fehlt: Absenden speichert trotzdem

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 4` (erwartet `ok | 4`) ✓
- Gesperrt/Wiederhergestellt: `P0001: setting_missing | 3` (erwartet `P0001: setting_missing | 3`) ✓
- Test `tests/rls/uploads.test.ts` -t "photo_staging_hours fehlt" gelockert: 1 rot von 1 gelaufen (AssertionError: expected 'P0001: invalid_revision' to be 'P0001: setting_missing' // Object.is equality) ✓
- Bewertung: bestanden

## photo_staging_hours fehlt: Waisenliste läuft weiter

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 0` (erwartet `ok | 0`) ✓
- Gesperrt/Wiederhergestellt: `P0001: setting_missing | 0` (erwartet `P0001: setting_missing | 0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## guard_photo_insert ausgeschaltet (Einfügen am Funktionspfad vorbei)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `P0001: photo_insert_forbidden | 0` (erwartet `P0001: photo_insert_forbidden | 0`) ✓
- Test `tests/rls/uploads.test.ts` -t "Trigger auch" gelockert: 1 rot von 1 gelaufen (AssertionError: expected { …(6) } to deeply equal { …(6) }) ✓
- Bewertung: bestanden

## guard_photo_insert: Marker nicht mehr verlangt

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `P0001: photo_insert_forbidden | 0` (erwartet `P0001: photo_insert_forbidden | 0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## guard_photo_insert: Pfadpräfix der Anfrage nicht mehr verlangt (fremder Ordner mit Marker)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `P0001: photo_insert_forbidden | 0` (erwartet `P0001: photo_insert_forbidden | 0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## request_photos: INSERT für authenticated (Schicht: keine Insert-Policy)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `P0001: photo_insert_forbidden | 0` (erwartet `P0001: photo_insert_forbidden | 0`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table request_photos | 0` (erwartet `42501: permission denied for table request_photos | 0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## photo_immutable ausgeschaltet: UPDATE (Umhängen auf andere Anfrage)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | true` (erwartet `ok | true`) ✓
- Gesperrt/Wiederhergestellt: `P0001: photo_immutable | false` (erwartet `P0001: photo_immutable | false`) ✓
- Test `tests/rls/uploads.test.ts` -t "photo_immutable" gelockert: 1 rot von 1 gelaufen (AssertionError: expected { 'umhängen': 'ok', …(5) } to deeply equal { …(6) }) ✓
- Bewertung: bestanden

## photo_immutable ausgeschaltet: DELETE (Foto der Anfrage löschen)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 0` (erwartet `ok | 0`) ✓
- Gesperrt/Wiederhergestellt: `P0001: photo_immutable | 1` (erwartet `P0001: photo_immutable | 1`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## photo_immutable_truncate ausgeschaltet: TRUNCATE

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | false` (erwartet `ok | false`) ✓
- Gesperrt/Wiederhergestellt: `P0001: photo_immutable | true` (erwartet `P0001: photo_immutable | true`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## request_photos: UPDATE für service_role (Schicht: Trigger photo_immutable)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `P0001: photo_immutable | 68e4e9d3-4497-4620-88c6-2374a57ee3b6` (erwartet `P0001: photo_immutable | 68e4e9d3-4497-4620-88c6-2374a57ee3b6`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table request_photos | 68e4e9d3-4497-4620-88c6-2374a57ee3b6` (erwartet `42501: permission denied for table request_photos | 68e4e9d3-4497-4620-88c6-2374a57ee3b6`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## request_photos: DELETE für service_role (Schicht: Trigger photo_immutable)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `P0001: photo_immutable | 1` (erwartet `P0001: photo_immutable | 1`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table request_photos | 1` (erwartet `42501: permission denied for table request_photos | 1`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## request_photos: TRUNCATE für service_role (Schicht: Trigger photo_immutable)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `P0001: photo_immutable | true` (erwartet `P0001: photo_immutable | true`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table request_photos | true` (erwartet `42501: permission denied for table request_photos | true`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## request_photos: UPDATE für authenticated (Schicht: keine Policy, 0 Zeilen betroffen)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `ok | 68e4e9d3-4497-4620-88c6-2374a57ee3b6` (erwartet `ok | 68e4e9d3-4497-4620-88c6-2374a57ee3b6`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table request_photos | 68e4e9d3-4497-4620-88c6-2374a57ee3b6` (erwartet `42501: permission denied for table request_photos | 68e4e9d3-4497-4620-88c6-2374a57ee3b6`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## request_photos: DELETE für authenticated (Schicht: keine Policy, 0 Zeilen betroffen)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table request_photos | 1` (erwartet `42501: permission denied for table request_photos | 1`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## request_photos_select: jeder liest (fremde Fotos)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `ok | 0` (erwartet `ok | 0`) ✓
- Test `tests/rls/uploads.test.ts` -t "frische Fotos werden atomar" gelockert: 1 rot von 1 gelaufen (AssertionError: expected [ …(2) ] to deeply equal []) ✓
- Bewertung: bestanden

## request_photos_select: admin-Klausel wieder da (admin aal2 liest fremde Fotos)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `ok | 0` (erwartet `ok | 0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## request_photos_objects_select: admin-Klausel wieder da (admin aal2 liest fremde Datei)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `ok | 0` (erwartet `ok | 0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## request_photos_objects_select: Ordner-Bedingung entfernt (fremde Datei lesen)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `ok | 0` (erwartet `ok | 0`) ✓
- Test `tests/rls/uploads.test.ts` -t "fremder Nutzer liest" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null not to be null) ✓
- Bewertung: bestanden

## Storage-INSERT: Fremdordner-Bedingung entfernt (Datei in Ordner eines anderen)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `42501: new row violates row-level security policy for table "objects" | 0` (erwartet `42501: new row violates row-level security policy for table "objects" | 0`) ✓
- Test `tests/rls/uploads.test.ts` -t "fremder Ordner" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null to match object { statusCode: '403', …(1) }) ✓
- Bewertung: bestanden

## Storage-INSERT: Bedingung „keine Anfrage zu client_ref“ entfernt (Hinzufügen nach dem Absenden)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `42501: new row violates row-level security policy for table "objects" | 0` (erwartet `42501: new row violates row-level security policy for table "objects" | 0`) ✓
- Test `tests/rls/uploads.test.ts` -t "in den Ordner" gelockert: 1 rot von 2 gelaufen (AssertionError: expected null to match object { statusCode: '403', …(1) }) ✓
- Bewertung: bestanden

## Storage-INSERT: Pfadform nicht mehr geprüft

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `42501: new row violates row-level security policy for table "objects" | 0` (erwartet `42501: new row violates row-level security policy for table "objects" | 0`) ✓
- Test `tests/rls/uploads.test.ts` -t "falsche Pfadform" gelockert: 1 rot von 1 gelaufen (AssertionError: 9d8c214a-e818-4315-96cf-83c76942ff9a/a750d3ac-9feb-4464-bf16-d29014a9eadc/6f852af1-5b64-417a-b94d-379b11f108a4.png: expected null not to be null) ✓
- Bewertung: bestanden

## Storage-DELETE: Fremdordner-Bedingung entfernt, dazu SELECT-Sicht geöffnet (fremdes Staging-Foto löschen)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `entfernt 1 | Datei weg` (erwartet `entfernt 1 | Datei weg`) ✓
- Gesperrt/Wiederhergestellt: `entfernt 0 | Datei da` (erwartet `entfernt 0 | Datei da`) ✓
- Test `tests/rls/uploads.test.ts` -t "fremder Nutzer liest" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null not to be null) ✓
- Bewertung: bestanden

## Storage-DELETE: Bedingung „keine Anfrage zu client_ref“ entfernt (Löschen nach dem Absenden)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `entfernt 1 | Datei weg` (erwartet `entfernt 1 | Datei weg`) ✓
- Gesperrt/Wiederhergestellt: `entfernt 0 | Datei da` (erwartet `entfernt 0 | Datei da`) ✓
- Test `tests/rls/uploads.test.ts` -t "nicht genannten Datei" gelockert: 1 rot von 1 gelaufen (AssertionError: expected [ { …(14) } ] to deeply equal []) ✓
- Bewertung: bestanden

## Storage-DELETE: Zeilen-Bedingung entfernt (Schicht: client_ref-Bedingung; schützt Alt-Objekte nur über die Zeile)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `entfernt 0 | Datei da` (erwartet `entfernt 0 | Datei da`) ✓
- Gesperrt/Wiederhergestellt: `entfernt 0 | Datei da` (erwartet `entfernt 0 | Datei da`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## Storage-DELETE: client_ref-Bedingung entfernt (Schicht: Zeilen-Bedingung)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `entfernt 0 | Datei da` (erwartet `entfernt 0 | Datei da`) ✓
- Gesperrt/Wiederhergestellt: `entfernt 0 | Datei da` (erwartet `entfernt 0 | Datei da`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## Storage: UPDATE-Policy für Eigentümer vorhanden (Ersetzen/Verschieben nach dem Absenden)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | verschoben` (erwartet `ok | verschoben`) ✓
- Gesperrt/Wiederhergestellt: `Fehler | unverändert` (erwartet `Fehler | unverändert`) ✓
- Test `tests/rls/uploads.test.ts` -t "Ersetzen und Verschieben" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null not to be null) ✓
- Bewertung: bestanden

## Storage-DELETE: Zeilen-Bedingung entfernt (Alt-Pfad, A-M2: hier hält allein die Zeile)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `entfernt 1 | Datei weg` (erwartet `entfernt 1 | Datei weg`) ✓
- Gesperrt/Wiederhergestellt: `entfernt 0 | Datei da` (erwartet `entfernt 0 | Datei da`) ✓
- Test `tests/rls/uploads.test.ts` -t "Zeilen-Bedingung (Alt-Pfad" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null not to be null) ✓
- Bewertung: bestanden

## Storage-INSERT: Zeilen-Bedingung entfernt (Alt-Pfad, A-M2: Name einer übernommenen Datei)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `403 | 0` (erwartet `403 | 0`) ✓
- Test `tests/rls/uploads.test.ts` -t "Zeilen-Bedingung (Alt-Pfad" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null not to be null) ✓
- Bewertung: bestanden

## Storage-INSERT: Mengengrenze (40) entfernt (41. Datei eines Kontos)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 41` (erwartet `ok | 41`) ✓
- Gesperrt/Wiederhergestellt: `403 | 40` (erwartet `403 | 40`) ✓
- Test `tests/rls/uploads.test.ts` -t "bis zur Grenze erlaubt" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null to match object { statusCode: '403', …(1) }) ✓
- Bewertung: bestanden

## staging_photo_count: übernommene Dateien zählen mit (Aussperr-Schutz: 40 Dateien, davon eine übernommen)

- Teil: SQL; Art: Verfügbarkeit
- Gelockert/Beobachtet: `403 | 40` (erwartet `403 | 40`) ✓
- Gesperrt/Wiederhergestellt: `ok | 41` (erwartet `ok | 41`) ✓
- Test `tests/rls/uploads.test.ts` -t "bis zur Grenze erlaubt" gelockert: 1 rot von 1 gelaufen (AssertionError: expected StorageApiError: new row violates row-lev… { …(5) } to be null) ✓
- Bewertung: bestanden

## guard_photo_insert: NULL-Pfad nicht mehr abgefangen (Schicht: NOT NULL der Spalte, Marker gesetzt)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `23502: null value in column "storage_path" of relation "request_photos" violates not-null constraint | 0` (erwartet `23502: null value in column "storage_path" of relation "request_photos" violates not-null constraint | 0`) ✓
- Gesperrt/Wiederhergestellt: `P0001: photo_insert_forbidden | 0` (erwartet `P0001: photo_insert_forbidden | 0`) ✓
- Test `tests/rls/uploads.test.ts` -t "ohne storage_path" gelockert: 1 rot von 1 gelaufen (AssertionError: expected { …(2) } to deeply equal { …(2) }) ✓
- Bewertung: bestanden

## storage_path: Default '' wiederhergestellt (Schicht: NOT NULL; der Trigger ist im Probe-Ablauf aus, Rollback)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `23502: null value in column "storage_path" of relation "request_photos" violates not-null constraint | 0` (erwartet `23502: null value in column "storage_path" of relation "request_photos" violates not-null constraint | 0`) ✓
- Test `tests/rls/uploads.test.ts` -t "kein Default mehr" gelockert: 1 rot von 1 gelaufen (AssertionError: expected [ { column_default: '\'\'::text' } ] to deeply equal [ { column_default: null } ]) ✓
- Bewertung: bestanden

## photo_orphans: übernommene Dateien nicht mehr ausgenommen

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1/1` (erwartet `ok | 1/1`) ✓
- Gesperrt/Wiederhergestellt: `ok | 0/1` (erwartet `ok | 0/1`) ✓
- Test `tests/rls/uploads.test.ts` -t "Waisen-Liste: nur" gelockert: 1 rot von 1 gelaufen (AssertionError: expected [ …(2) ] to not include '2d1ef342-4b8a-47ac-a5b4-7b3ac5584154/…') ✓
- Bewertung: bestanden

## photo_orphans: Ablauf nicht mehr beachtet (frisches Staging-Foto wird gelistet)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1/1` (erwartet `ok | 1/1`) ✓
- Gesperrt/Wiederhergestellt: `ok | 0/1` (erwartet `ok | 0/1`) ✓
- Test `tests/rls/uploads.test.ts` -t "Waisen-Liste: nur" gelockert: 1 rot von 1 gelaufen (AssertionError: expected [ …(118) ] to not include '4620b028-ccf1-4ce6-aee0-cc49ed6d26eb/…') ✓
- Bewertung: bestanden

## photo_orphans: Karenz von einer Stunde entfernt (Datei knapp über der Übernahmegrenze wird gelistet)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1` (erwartet `ok | 1`) ✓
- Gesperrt/Wiederhergestellt: `ok | 0` (erwartet `ok | 0`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## photo_orphans: EXECUTE für authenticated (Schicht: kein Recht auf photo_staging_interval)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `42501: permission denied for function photo_staging_interval | 1` (erwartet `42501: permission denied for function photo_staging_interval | 1`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for function photo_orphans | 1` (erwartet `42501: permission denied for function photo_orphans | 1`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## quote_save_request: EXECUTE für authenticated (isoliert: innere Schichten und photo_staging_interval nur in der Probe offen)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 4` (erwartet `ok | 4`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for function quote_save_request | 3` (erwartet `42501: permission denied for function quote_save_request | 3`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## photo_staging_interval: EXECUTE für authenticated (isoliert: innere Schichten und quote_save_request nur in der Probe offen)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 4` (erwartet `ok | 4`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for function photo_staging_interval | 3` (erwartet `42501: permission denied for function photo_staging_interval | 3`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## become_rental_provider entfernt (0022): Kunde stuft sich selbst hoch und liest den Gebührensatz

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 2` (erwartet `ok | 2`) ✓
- Gesperrt/Wiederhergestellt: `42883: function public.become_rental_provider() does not exist | 0` (erwartet `42883: function public.become_rental_provider() does not exist | 0`) ✓
- Test `tests/rls/rls.test.ts` -t "kein Selbst-Upgrade" gelockert: 1 rot von 1 gelaufen (AssertionError: expected null not to be null) ✓
- Bewertung: bestanden

## Beobachtung quote (deployt): photoIds kein Array → 400 invalid_input (neue Version deployt)

- Teil: Live; Art: Beobachtung
- Gelockert/Beobachtet: `400 invalid_input` (erwartet `400 invalid_input`) ✓
- Gesperrt/Wiederhergestellt: `400 invalid_input` (erwartet `400 invalid_input`) ✓
- Bewertung: bestanden

## Beobachtung quote (deployt): fremde Foto-ID → 422 photo_missing, keine Anfrage gespeichert

- Teil: Live; Art: Beobachtung
- Gelockert/Beobachtet: `422 photo_missing / Anfragen 0` (erwartet `422 photo_missing / Anfragen 0`) ✓
- Gesperrt/Wiederhergestellt: `422 photo_missing / Anfragen 0` (erwartet `422 photo_missing / Anfragen 0`) ✓
- Bewertung: bestanden

## Beobachtung quote (deployt): 9 Fotos → 422 too_many_photos

- Teil: Live; Art: Beobachtung
- Gelockert/Beobachtet: `422 too_many_photos / Anfragen 0` (erwartet `422 too_many_photos / Anfragen 0`) ✓
- Gesperrt/Wiederhergestellt: `422 too_many_photos / Anfragen 0` (erwartet `422 too_many_photos / Anfragen 0`) ✓
- Bewertung: bestanden

## Beobachtung quote (deployt): eigenes Staging-Foto (Kunden-Upload) → 200 und Zeile in request_photos

- Teil: Live; Art: Beobachtung
- Gelockert/Beobachtet: `200 / Zeilen ["dd4af4f7-4e80-4f98-b23b-b201b7b0fe0a/14014239-fe9a-4e21-bb79-3bf2a114fabe/bbbdef86-2f1c-4b12-8825-6fa857b512f8.jpg"]` (erwartet `200 / Zeilen ["dd4af4f7-4e80-4f98-b23b-b201b7b0fe0a/14014239-fe9a-4e21-bb79-3bf2a114fabe/bbbdef86-2f1c-4b12-8825-6fa857b512f8.jpg"]`) ✓
- Gesperrt/Wiederhergestellt: `200 / Zeilen ["dd4af4f7-4e80-4f98-b23b-b201b7b0fe0a/14014239-fe9a-4e21-bb79-3bf2a114fabe/bbbdef86-2f1c-4b12-8825-6fa857b512f8.jpg"]` (erwartet `200 / Zeilen ["dd4af4f7-4e80-4f98-b23b-b201b7b0fe0a/14014239-fe9a-4e21-bb79-3bf2a114fabe/bbbdef86-2f1c-4b12-8825-6fa857b512f8.jpg"]`) ✓
- Bewertung: bestanden

## Beobachtung quote (deployt): Wiederholung derselben clientRef: dieselbe Anfrage, keine weitere Zeile

- Teil: Live; Art: Beobachtung
- Gelockert/Beobachtet: `200 / gleich true / Zeilen 1` (erwartet `200 / gleich true / Zeilen 1`) ✓
- Gesperrt/Wiederhergestellt: `200 / gleich true / Zeilen 1` (erwartet `200 / gleich true / Zeilen 1`) ✓
- Bewertung: bestanden

## Beobachtung quote (deployt): falscher termsHash → 409 terms_changed, keine Anfrage

- Teil: Live; Art: Beobachtung
- Gelockert/Beobachtet: `409 terms_changed / Anfragen 0` (erwartet `409 terms_changed / Anfragen 0`) ✓
- Gesperrt/Wiederhergestellt: `409 terms_changed / Anfragen 0` (erwartet `409 terms_changed / Anfragen 0`) ✓
- Bewertung: bestanden

## Beobachtung quote (deployt): falsches shown → 409 price_changed, keine Anfrage

- Teil: Live; Art: Beobachtung
- Gelockert/Beobachtet: `409 price_changed / Anfragen 0` (erwartet `409 price_changed / Anfragen 0`) ✓
- Gesperrt/Wiederhergestellt: `409 price_changed / Anfragen 0` (erwartet `409 price_changed / Anfragen 0`) ✓
- Bewertung: bestanden

## Beobachtung quote (deployt): nach dem Absenden: Hinzufügen/Löschen/Ersetzen verweigert, Datei unverändert

- Teil: Live; Art: Beobachtung
- Gelockert/Beobachtet: `hinzufügen 403 / löschen 0 / ersetzen 403 / Datei da` (erwartet `hinzufügen 403 / löschen 0 / ersetzen 403 / Datei da`) ✓
- Gesperrt/Wiederhergestellt: `hinzufügen 403 / löschen 0 / ersetzen 403 / Datei da` (erwartet `hinzufügen 403 / löschen 0 / ersetzen 403 / Datei da`) ✓
- Bewertung: bestanden

## M-3: dev-guard mit fiktiver SUPABASE_PROJECT_ID → Exit 2 „ABBRUCH“

- Teil: Werkzeug; Art: Werkzeug
- Gelockert/Beobachtet: `Exit 2, ABBRUCH` (erwartet `Exit 2, ABBRUCH`) ✓
- Gesperrt/Wiederhergestellt: `Exit 2, ABBRUCH` (erwartet `Exit 2, ABBRUCH`) ✓
- Bewertung: bestanden

## M-3: CLI mit fiktiver Ref scheitert und nennt die fiktive Ref

- Teil: Werkzeug; Art: Werkzeug
- Gelockert/Beobachtet: `Exit ≠0, Ref genannt` (erwartet `Exit ≠0, Ref genannt`) ✓
- Gesperrt/Wiederhergestellt: `Exit ≠0, Ref genannt` (erwartet `Exit ≠0, Ref genannt`) ✓
- Bewertung: bestanden

## A-N4: redproof-s9a3 mit uncommitteter Datei unter supabase/functions → Exit 2 „ABBRUCH“

- Teil: Werkzeug; Art: Werkzeug
- Gelockert/Beobachtet: `Exit 2, ABBRUCH, Hilfsdatei entfernt, Baum wie vorher` (erwartet `Exit 2, ABBRUCH, Hilfsdatei entfernt, Baum wie vorher`) ✓
- Gesperrt/Wiederhergestellt: `Exit 2, ABBRUCH, Hilfsdatei entfernt, Baum wie vorher` (erwartet `Exit 2, ABBRUCH, Hilfsdatei entfernt, Baum wie vorher`) ✓
- Bewertung: bestanden

## Definitionen vorher/nachher (SQL-Teil)

Policies, Trigger (inkl. tgenabled), Funktionen (md5, Rechte) und Tabellenrechte sind identisch.

Ergebnis: SQL 31 Sperren und 14 Schichten, 1 Verfügbarkeit, Beobachtungen 8, Werkzeuge 3, bestanden von 57 Prüfungen.
