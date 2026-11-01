# S9a-1 Rot-Beweis

Stand 2026-11-01T21:09:31.710Z (Dev-Projekt). Je Sperre: lockern (committet), Test laufen lassen (muss rot sein), Original wiederherstellen, Test laufen lassen (muss grün sein).

## Marker-Prüfung von guard_price_version ausgeschaltet

- Test: `tests/rls/settings.test.ts` -t "veröffentlichte Preisversion ist unveränderlich"
- Erwartete Meldung in der roten Ausgabe: `flag_without_marker_owner: expected 'ok' to be 'P0001: field_immutable'` (gefunden)
- ROT: veröffentlichte Preisversion ist unveränderlich (Trigger, auch gegen service_role) Änderungen jeder Art werden verweigert, die unveröffentlichte Version bleibt änderbar
  - Kernzeile: `AssertionError: flag_without_marker: expected '42501: permission denied for schema p…' to be 'P0001: field_immutable' // Object.is equality`
  - Kernzeile: `AssertionError: flag_without_marker_owner: expected 'ok' to be 'P0001: field_immutable' // Object.is equality`
- GRÜN nach Zurücknehmen: 3 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## guard_profile_role: Tausch von profiles.id erlaubt

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `profile_id_swap: expected 'ok' to be 'P0001: field_immutable'` (gefunden)
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: profile_id_swap: expected 'ok' to be 'P0001: field_immutable' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Trigger guard_role entfernt

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `profile_id_swap: expected 'ok' to be 'P0001: field_immutable'` (gefunden)
- Erwartete Meldung in der roten Ausgabe: `role_after_update: expected '= admin' to be '= customer'` (gefunden)
- Erwartete Meldung in der roten Ausgabe: `role_insert: expected 'ok' to be 'P0001: field_immutable'` (gefunden)
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: profile_id_swap: expected 'ok' to be 'P0001: field_immutable' // Object.is equality`
  - Kernzeile: `AssertionError: role_update: expected 'ok' to be 'P0001: field_immutable' // Object.is equality`
  - Kernzeile: `AssertionError: role_after_update: expected '= admin' to be '= customer' // Object.is equality`
  - Kernzeile: `AssertionError: role_insert: expected 'ok' to be 'P0001: field_immutable' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## is_admin() ohne aal2

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `/audit_read_aal1: expected '= [1-9]\d*' to be '= 0'/` (gefunden)
- Erwartete Meldung in der roten Ausgabe: `is_admin_aal1: expected '= true' to be '= false'` (gefunden)
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: audit_read_aal1: expected '= 200' to be '= 0' // Object.is equality`
  - Kernzeile: `AssertionError: is_admin_aal1: expected '= true' to be '= false' // Object.is equality`
  - Kernzeile: `AssertionError: unpublished_admin_aal1: expected '= 1' to be '= 0' // Object.is equality`
  - Kernzeile: `AssertionError: profiles_admin_aal1: expected '= 3' to be '= 1' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## price_versions_select für alle (auch unveröffentlicht)

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `unpublished_admin_aal1: expected '= 1' to be '= 0'` (gefunden)
- Erwartete Meldung in der roten Ausgabe: `unpublished_anon: expected '= 1' to be '= 0'` (gefunden)
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: unpublished_admin_aal1: expected '= 1' to be '= 0' // Object.is equality`
  - Kernzeile: `AssertionError: unpublished_anon: expected '= 1' to be '= 0' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## profiles_select: admin ohne aal2

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `/profiles_admin_aal1: expected '= (?:[2-9]|[1-9]\d+)' to be '= 1'/` (gefunden)
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: profiles_admin_aal1: expected '= 3' to be '= 1' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Definitionen vorher/nachher

Policies, Trigger, Funktionen (md5) und Rechte sind identisch.

Ergebnis: 6 von 6 Sperren bewiesen.
