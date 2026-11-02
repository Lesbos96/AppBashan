# S9a-4 Rot-Beweis

Stand 2026-11-02T20:31:30.505Z (Dev-Projekt). Teil 1 SQL und Storage: lockern (committet), Ist-Wert-Probe (Rollback bzw. Storage-API), zuständigen Test laufen lassen, aus den vorher gelesenen Definitionen wiederherstellen (Restore-SQL vorher nach tmp/proof/s9a4-restore-*.sql), Probe erneut. Teil 2 Live-Probe (R2-N13): Aufrufe gegen die deployte Function `quote` mit Testnutzer-JWT, keine Quelltext-Mutation. Teil 3 Werkzeuge (M-3, A-N4).

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
- Gelockert/Beobachtet: `ok | 3` (erwartet `ok | 3`) ✓
- Gesperrt/Wiederhergestellt: `P0001: setting_missing | 2` (erwartet `P0001: setting_missing | 2`) ✓
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
- Gelockert/Beobachtet: `P0001: photo_immutable | 6b6b9649-97a5-40c3-ae32-a89053a85629` (erwartet `P0001: photo_immutable | 6b6b9649-97a5-40c3-ae32-a89053a85629`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table request_photos | 6b6b9649-97a5-40c3-ae32-a89053a85629` (erwartet `42501: permission denied for table request_photos | 6b6b9649-97a5-40c3-ae32-a89053a85629`) ✓
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
- Gelockert/Beobachtet: `ok | 6b6b9649-97a5-40c3-ae32-a89053a85629` (erwartet `ok | 6b6b9649-97a5-40c3-ae32-a89053a85629`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for table request_photos | 6b6b9649-97a5-40c3-ae32-a89053a85629` (erwartet `42501: permission denied for table request_photos | 6b6b9649-97a5-40c3-ae32-a89053a85629`) ✓
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
- Test `tests/rls/uploads.test.ts` -t "falsche Pfadform" gelockert: 1 rot von 1 gelaufen (AssertionError: a377eec2-9f45-44b8-979d-21223e0b6f17/0c1f9b43-8df1-42cd-8a73-07628dacf1bf/e5e401d6-a7c4-4ac6-9e2f-92a5ea980e3a.png: expected null not to be null) ✓
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

## photo_orphans: übernommene Dateien nicht mehr ausgenommen

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1/1` (erwartet `ok | 1/1`) ✓
- Gesperrt/Wiederhergestellt: `ok | 0/1` (erwartet `ok | 0/1`) ✓
- Test `tests/rls/uploads.test.ts` -t "Waisen-Liste: nur" gelockert: 1 rot von 1 gelaufen (AssertionError: expected [ …(2) ] to not include 'b4ea097c-c243-4798-a897-4bd4c12a4b7a/…') ✓
- Bewertung: bestanden

## photo_orphans: Ablauf nicht mehr beachtet (frisches Staging-Foto wird gelistet)

- Teil: SQL; Art: Sperre
- Gelockert/Beobachtet: `ok | 1/1` (erwartet `ok | 1/1`) ✓
- Gesperrt/Wiederhergestellt: `ok | 0/1` (erwartet `ok | 0/1`) ✓
- Test `tests/rls/uploads.test.ts` -t "Waisen-Liste: nur" gelockert: 1 rot von 1 gelaufen (AssertionError: expected [ …(23) ] to not include 'e96032a6-a669-4c3e-8d53-90b1af946c29/…') ✓
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

## photo_staging_interval: EXECUTE für authenticated (Schicht: RLS auf platform_settings)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `P0001: setting_missing | 1` (erwartet `P0001: setting_missing | 1`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for function photo_staging_interval | 1` (erwartet `42501: permission denied for function photo_staging_interval | 1`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## quote_save_request: EXECUTE für authenticated (Schicht: RLS auf platform_settings)

- Teil: SQL; Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert/Beobachtet: `42501: permission denied for function photo_staging_interval | 2` (erwartet `42501: permission denied for function photo_staging_interval | 2`) ✓
- Gesperrt/Wiederhergestellt: `42501: permission denied for function quote_save_request | 2` (erwartet `42501: permission denied for function quote_save_request | 2`) ✓
- Test: keiner (Wirkung durch die Probe belegt)
- Bewertung: bestanden

## Live-Probe quote: photoIds kein Array → 400 invalid_input (neue Version deployt)

- Teil: Live; Art: Sperre
- Gelockert/Beobachtet: `400 invalid_input` (erwartet `400 invalid_input`) ✓
- Gesperrt/Wiederhergestellt: `400 invalid_input` (erwartet `400 invalid_input`) ✓
- Bewertung: bestanden

## Live-Probe quote: fremde Foto-ID → 422 photo_missing, keine Anfrage gespeichert

- Teil: Live; Art: Sperre
- Gelockert/Beobachtet: `422 photo_missing / Anfragen 0` (erwartet `422 photo_missing / Anfragen 0`) ✓
- Gesperrt/Wiederhergestellt: `422 photo_missing / Anfragen 0` (erwartet `422 photo_missing / Anfragen 0`) ✓
- Bewertung: bestanden

## Live-Probe quote: 9 Fotos → 422 too_many_photos

- Teil: Live; Art: Sperre
- Gelockert/Beobachtet: `422 too_many_photos / Anfragen 0` (erwartet `422 too_many_photos / Anfragen 0`) ✓
- Gesperrt/Wiederhergestellt: `422 too_many_photos / Anfragen 0` (erwartet `422 too_many_photos / Anfragen 0`) ✓
- Bewertung: bestanden

## Live-Probe quote: eigenes Staging-Foto (Kunden-Upload) → 200 und Zeile in request_photos

- Teil: Live; Art: Sperre
- Gelockert/Beobachtet: `200 / Zeilen ["ae18ca19-53f9-4ce6-b2a4-3df55bd6f016/77f9dff6-5031-4777-b971-a2bc677ec4b5/2288b1a6-33fe-4158-bd31-862a573dcd44.jpg"]` (erwartet `200 / Zeilen ["ae18ca19-53f9-4ce6-b2a4-3df55bd6f016/77f9dff6-5031-4777-b971-a2bc677ec4b5/2288b1a6-33fe-4158-bd31-862a573dcd44.jpg"]`) ✓
- Gesperrt/Wiederhergestellt: `200 / Zeilen ["ae18ca19-53f9-4ce6-b2a4-3df55bd6f016/77f9dff6-5031-4777-b971-a2bc677ec4b5/2288b1a6-33fe-4158-bd31-862a573dcd44.jpg"]` (erwartet `200 / Zeilen ["ae18ca19-53f9-4ce6-b2a4-3df55bd6f016/77f9dff6-5031-4777-b971-a2bc677ec4b5/2288b1a6-33fe-4158-bd31-862a573dcd44.jpg"]`) ✓
- Bewertung: bestanden

## Live-Probe quote: Wiederholung derselben clientRef: dieselbe Anfrage, keine weitere Zeile

- Teil: Live; Art: Sperre
- Gelockert/Beobachtet: `200 / gleich true / Zeilen 1` (erwartet `200 / gleich true / Zeilen 1`) ✓
- Gesperrt/Wiederhergestellt: `200 / gleich true / Zeilen 1` (erwartet `200 / gleich true / Zeilen 1`) ✓
- Bewertung: bestanden

## Live-Probe quote: nach dem Absenden: Hinzufügen/Löschen/Ersetzen verweigert, Datei unverändert

- Teil: Live; Art: Sperre
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

## A-N4: redproof-s9a3 mit uncommitteter Datei unter supabase/functions → Exit 2 „ABBRUCH“ (Baum war schon unsauber: Wirkung der Hilfsdatei nicht getrennt)

- Teil: Werkzeug; Art: Werkzeug
- Gelockert/Beobachtet: `Exit 2, ABBRUCH, Hilfsdatei entfernt, Baum wie vorher` (erwartet `Exit 2, ABBRUCH, Hilfsdatei entfernt, Baum wie vorher`) ✓
- Gesperrt/Wiederhergestellt: `Exit 2, ABBRUCH, Hilfsdatei entfernt, Baum wie vorher` (erwartet `Exit 2, ABBRUCH, Hilfsdatei entfernt, Baum wie vorher`) ✓
- Bewertung: bestanden

## Definitionen vorher/nachher (SQL-Teil)

Policies, Trigger (inkl. tgenabled), Funktionen (md5, Rechte) und Tabellenrechte sind identisch.

Ergebnis: SQL 25 Sperren und 14 Schichten, Live 6, Werkzeuge 3, bestanden von 48 Prüfungen.
