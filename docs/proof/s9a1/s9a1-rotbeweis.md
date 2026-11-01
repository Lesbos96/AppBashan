# S9a-1 Rot-Beweis

Stand 2026-11-01T20:01:01.730Z (Dev-Projekt). Je Sperre: lockern (committet), Test laufen lassen (muss rot sein), Original wiederherstellen, Test laufen lassen (muss grün sein).

**Überholt für sechs Sperren (Nachprüfung):** „Marker-Prüfung von guard_price_version“, „guard_profile_role: Tausch von profiles.id“, „Trigger guard_role“, „is_admin() ohne aal2“, „price_versions_select für alle“ und „profiles_select: admin ohne aal2“ gelten nur in der Fassung `s9a1-rotbeweis-nachpruefung.md`. Die Rot-Zeilen unten zeigten dort einen anderen Fehler (42501, 23503) oder nur `P0001: false`.

## Trigger guard_price_version entfernt

- Test: `tests/rls/settings.test.ts` -t "veröffentlichte Preisversion ist unveränderlich"
- Erwartete Meldung in der roten Ausgabe: `price_versions_published_complete`
- ROT: veröffentlichte Preisversion ist unveränderlich (Trigger, auch gegen service_role) Änderungen jeder Art werden verweigert, die unveröffentlichte Version bleibt änderbar
  - Kernzeile: `Error: unexpected status 400: {"message":"Failed to run sql query: ERROR:  23514: new row for relation \"price_versions\" violates check constraint \"price_versions_published_complete\"\nDETAIL:  Failing row contains (99`
- ROT: veröffentlichte Preisversion ist unveränderlich (Trigger, auch gegen service_role) über die API: authenticated und admin (aal1) verweigert (42501), service_role bekommt version_published
  - Kernzeile: `AssertionError: expected null to match object { code: 'P0001', …(1) }`
- ROT: Admin-Funktionen: nur service_role bzw. Eigentümer, nur für Rolle admin erlaubt: admin (p_actor) legt eine Konfigurationszeile in der unveröffentlichten Version an und das Journal hält es fest
  - Kernzeile: `AssertionError: expected { code: '23503', …(3) } to be null`
- GRÜN nach Zurücknehmen: 3 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Marker-Prüfung von guard_price_version ausgeschaltet

- Test: `tests/rls/settings.test.ts` -t "veröffentlichte Preisversion ist unveränderlich"
- Erwartete Meldung in der roten Ausgabe: `field_immutable`
- ROT: veröffentlichte Preisversion ist unveränderlich (Trigger, auch gegen service_role) Änderungen jeder Art werden verweigert, die unveröffentlichte Version bleibt änderbar
  - Kernzeile: `AssertionError: flag_without_marker: expected '42501: permission denied for schema p…' to be 'P0001: field_immutable' // Object.is equality`
- GRÜN nach Zurücknehmen: 3 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Trigger guard_price_config entfernt

- Test: `tests/rls/settings.test.ts` -t "veröffentlichte Preisversion ist unveränderlich"
- Erwartete Meldung in der roten Ausgabe: `version_published`
- ROT: veröffentlichte Preisversion ist unveränderlich (Trigger, auch gegen service_role) Änderungen jeder Art werden verweigert, die unveröffentlichte Version bleibt änderbar
  - Kernzeile: `AssertionError: insert_config: expected 'ok' to be 'P0001: version_published' // Object.is equality`
- GRÜN nach Zurücknehmen: 3 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Trigger guard_platform_setting entfernt

- Test: `tests/rls/settings.test.ts` -t "Gebührensätze und Einstellungen"
- Erwartete Meldung in der roten Ausgabe: `fee_rate_notice`
- ROT: Gebührensätze und Einstellungen Vorlauf, Unveränderlichkeit, Wertebereich
  - Kernzeile: `AssertionError: fee_short: expected 'ok' to be 'P0001: fee_rate_notice' // Object.is equality`
- GRÜN nach Zurücknehmen: 3 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Vorlauf-Prüfung von guard_platform_setting ausgeschaltet

- Test: `tests/rls/settings.test.ts` -t "Gebührensätze und Einstellungen"
- Erwartete Meldung in der roten Ausgabe: `fee_rate_notice`
- ROT: Gebührensätze und Einstellungen Vorlauf, Unveränderlichkeit, Wertebereich
  - Kernzeile: `AssertionError: fee_short: expected 'ok' to be 'P0001: fee_rate_notice' // Object.is equality`
- GRÜN nach Zurücknehmen: 3 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Trigger append_only entfernt

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `append_only`
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: audit_update_owner: expected 'ok' to be 'P0001: append_only' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## guard_platform_setting: OLD-Schlüssel nicht geprüft (Umbenennen)

- Test: `tests/rls/settings.test.ts` -t "Gebührensätze und Einstellungen"
- Erwartete Meldung in der roten Ausgabe: `fee_rename`
- ROT: Gebührensätze und Einstellungen Vorlauf, Unveränderlichkeit, Wertebereich
  - Kernzeile: `AssertionError: fee_rename: expected 'ok' to be 'P0001: fee_rate_immutable' // Object.is equality`
- GRÜN nach Zurücknehmen: 3 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## guard_profile_role: Tausch von profiles.id erlaubt

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `profile_id_swap`
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: profile_id_swap: expected '23503: insert or update on table "pro…' to be 'P0001: field_immutable' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Trigger append_only_truncate entfernt

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `audit_truncate_owner`
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: audit_truncate_owner: expected 'ok' to be 'P0001: append_only' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Trigger guard_platform_setting_truncate entfernt

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `settings_truncate_owner`
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: settings_truncate_owner: expected 'ok' to be 'P0001: append_only' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Trigger guard_price_config_truncate entfernt

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `config_truncate_owner`
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: config_truncate_owner: expected 'ok' to be 'P0001: append_only' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Trigger guard_role entfernt

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `field_immutable`
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: profile_id_swap: expected '23503: insert or update on table "pro…' to be 'P0001: field_immutable' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## audit_log: UPDATE/DELETE/TRUNCATE für service_role erlaubt

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `audit_update_service`
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: audit_update_service: expected 'P0001: append_only' to be '42501: permission denied for table au…' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## TRUNCATE price_config für service_role erlaubt

- Test: `tests/rls/settings.test.ts` -t "veröffentlichte Preisversion ist unveränderlich"
- Erwartete Meldung in der roten Ausgabe: `truncate_config`
- ROT: veröffentlichte Preisversion ist unveränderlich (Trigger, auch gegen service_role) Änderungen jeder Art werden verweigert, die unveröffentlichte Version bleibt änderbar
  - Kernzeile: `AssertionError: truncate_config: expected 'P0001: append_only' to be '42501: permission denied for table pr…' // Object.is equality`
- GRÜN nach Zurücknehmen: 3 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## is_admin() ohne aal2

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `audit_read_aal1`
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: audit_read_aal1: expected 'P0001: false' to be 'ok' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## verify_price_version ohne Hash-Vergleich

- Test: `tests/rls/settings.test.ts` -t "veröffentlichte Preisversion ist unveränderlich"
- Erwartete Meldung in der roten Ausgabe: `version_hash_mismatch`
- ROT: veröffentlichte Preisversion ist unveränderlich (Trigger, auch gegen service_role) Änderungen jeder Art werden verweigert, die unveröffentlichte Version bleibt änderbar
  - Kernzeile: `AssertionError: verify_mismatch: expected 'ok' to be 'P0001: version_hash_mismatch' // Object.is equality`
- GRÜN nach Zurücknehmen: 3 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## admin_grant_role für service_role ausführbar

- Test: `tests/rls/settings.test.ts` -t "admin_grant_role ist auch für service_role gesperrt"
- Erwartete Meldung in der roten Ausgabe: `to be '42501'`
- ROT: Admin-Funktionen: nur service_role bzw. Eigentümer, nur für Rolle admin admin_grant_role ist auch für service_role gesperrt; die anderen erreicht service_role (Gegenfall)
  - Kernzeile: `AssertionError: expected undefined to be '42501' // Object.is equality`
- GRÜN nach Zurücknehmen: 1 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## publish_version für authenticated ausführbar

- Test: `tests/rls/settings.test.ts` -t "ruft keine Admin-Funktion auf"
- Erwartete Meldung in der roten Ausgabe: `to be '42501'`
- ROT: Admin-Funktionen: nur service_role bzw. Eigentümer, nur für Rolle admin customer ruft keine Admin-Funktion auf (42501)
  - Kernzeile: `AssertionError: publish_version: expected 'P0001' to be '42501' // Object.is equality`
- ROT: Admin-Funktionen: nur service_role bzw. Eigentümer, nur für Rolle admin admin ruft keine Admin-Funktion auf (42501)
  - Kernzeile: `AssertionError: publish_version: expected 'P0001' to be '42501' // Object.is equality`
- GRÜN nach Zurücknehmen: 3 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## platform_settings: Schreib-Grants für authenticated

- Test: `tests/rls/settings.test.ts` -t "Schreiben über die API"
- Erwartete Meldung in der roten Ausgabe: `42501`
- ROT: Gebührensätze und Einstellungen Schreiben über die API: admin (aal1) und Kunde verweigert (42501), keine Schreib-Grants
  - Kernzeile: `AssertionError: expected undefined to be '42501' // Object.is equality`
- GRÜN nach Zurücknehmen: 1 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## price_config: Schreib-Grants für authenticated

- Test: `tests/rls/settings.test.ts` -t "über die API: authenticated und admin"
- Erwartete Meldung in der roten Ausgabe: `42501`
- ROT: veröffentlichte Preisversion ist unveränderlich (Trigger, auch gegen service_role) über die API: authenticated und admin (aal1) verweigert (42501), service_role bekommt version_published
  - Kernzeile: `AssertionError: expected undefined to be '42501' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## price_versions_select für alle (auch unveröffentlicht)

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `unpublished_admin_aal1`
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: unpublished_admin_aal1: expected 'P0001: false' to be 'ok' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## profiles_select: admin ohne aal2

- Test: `tests/rls/settings.test.ts` -t "audit_log nur anfügen"
- Erwartete Meldung in der roten Ausgabe: `profiles_admin_aal1`
- ROT: audit_log, Rollen, aal2-Admin audit_log nur anfügen; Lesen nur admin mit aal2; profiles.role nur mit Marker
  - Kernzeile: `AssertionError: profiles_admin_aal1: expected 'P0001: false' to be 'ok' // Object.is equality`
- GRÜN nach Zurücknehmen: 2 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## fee_splits_select: admin ohne aal2

- Test: `tests/rls/rls.test.ts` -t "admin liest Aufteilungen nur mit aal2"
- Erwartete Meldung in der roten Ausgabe: `to deeply equal`
- ROT: Gebühren admin liest Aufteilungen nur mit aal2
  - Kernzeile: `AssertionError: expected [ …(2) ] to deeply equal []`
- GRÜN nach Zurücknehmen: 4 Tests bestanden, 0 rot (Exit 0)
- Bewertung: bestanden

## Definitionen vorher/nachher

Policies, Trigger, Funktionen (md5) und Rechte sind identisch.

Ergebnis: 23 von 23 Sperren bewiesen.
