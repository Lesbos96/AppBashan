# S9a-2 Rot-Beweis

Stand 2026-11-01T23:10:37.051Z (Dev-Projekt). Je Sperre: lockern (committet), Ist-Wert-Probe (Rollback) und zuständigen Test laufen lassen, Original wiederherstellen, Probe erneut. Gelockert muss die WIRKUNG eintreten (Statuswert, Zeilenzahl, geänderter Wert), wiederhergestellt der genaue Fehler bei unverändertem Wert.

Format der Probe: „Ergebnis | Wert“. Ergebnis ist „ok“ oder „SQLSTATE: Meldung“; Wert ist der Zustand danach (z. B. Status, Zeilenzahl).

## Paar-Prüfung von guard_request_status ausgeschaltet

- Art: Sperre
- Gelockert: `ok | accepted` (erwartet `ok | accepted`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: invalid_transition | requested` (erwartet `P0001: invalid_transition | requested`) ✓
- Test `tests/rls/status.test.ts` -t "Trigger gilt auch für den Eigentümer" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## Marker-Prüfung von guard_request_status ausgeschaltet

- Art: Sperre
- Gelockert: `ok | withdrawn` (erwartet `ok | withdrawn`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: invalid_transition | requested` (erwartet `P0001: invalid_transition | requested`) ✓
- Test `tests/rls/status.test.ts` -t "Trigger gilt auch für den Eigentümer" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## Trigger guard_request_insert entfernt

- Art: Sperre
- Gelockert: `ok | 1` (erwartet `ok | 1`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: invalid_transition | 0` (erwartet `P0001: invalid_transition | 0`) ✓
- Test `tests/rls/status.test.ts` -t "INSERT: nur requested" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## UPDATE-Recht auf status für authenticated (mit durchlässiger Policy und Marker, damit die Wirkung sichtbar wird)

- Art: Sperre
- Gelockert: `ok | withdrawn` (erwartet `ok | withdrawn`) ✓ Wirkung eingetreten
- Gesperrt: `42501: permission denied for table service_requests | requested` (erwartet `42501: permission denied for table service_requests | requested`) ✓
- Test `tests/rls/status.test.ts` -t "direktes Status-UPDATE" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## Trigger revision_immutable entfernt

- Art: Sperre
- Gelockert: `ok | 1` (erwartet `ok | 1`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: revision_immutable | <null>` (erwartet `P0001: revision_immutable | <null>`) ✓
- Test `tests/rls/status.test.ts` -t "UPDATE, DELETE, TRUNCATE: auch der Eigentümer" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## n/Quelle/Zeiger-Prüfung von guard_revision_insert ausgeschaltet

- Art: Sperre
- Gelockert: `ok | 2` (erwartet `ok | 2`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: invalid_revision | 1` (erwartet `P0001: invalid_revision | 1`) ✓
- Test `tests/rls/status.test.ts` -t "INSERT: nur Revision 1" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## status_mismatch-Prüfung von guard_revision_insert ausgeschaltet

- Art: Sperre
- Gelockert: `ok | 1` (erwartet `ok | 1`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: status_mismatch | 0` (erwartet `P0001: status_mismatch | 0`) ✓
- Test `tests/rls/status.test.ts` -t "INSERT: nur Revision 1" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## Trigger guard_request_pointer entfernt

- Art: Sperre
- Gelockert: `ok | <null>` (erwartet `ok | <null>`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: invalid_revision_pointer | 9549a6e3-323e-4b2d-968f-69b7fcacbdc8` (erwartet `P0001: invalid_revision_pointer | 9549a6e3-323e-4b2d-968f-69b7fcacbdc8`) ✓
- Test `tests/rls/status.test.ts` -t "Zeiger: einmalig" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## Trigger guard_request_fields entfernt

- Art: Sperre
- Gelockert: `ok | true` (erwartet `ok | true`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: field_immutable | false` (erwartet `P0001: field_immutable | false`) ✓
- Test `tests/rls/status.test.ts` -t "Zeiger: einmalig" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## Trigger require_revision entfernt

- Art: Sperre
- Gelockert: `ok | 1` (erwartet `ok | 1`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: revision_missing | 0` (erwartet `P0001: revision_missing | 0`) ✓
- Test `tests/rls/status.test.ts` -t "INSERT: nur requested" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## Trigger request_delete_guard entfernt

- Art: Sperre
- Gelockert: `ok | 0` (erwartet `ok | 0`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: request_immutable | 1` (erwartet `P0001: request_immutable | 1`) ✓
- Test `tests/rls/status.test.ts` -t "service_role ändert nur den Zeiger" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## Trigger append_only auf status_events entfernt

- Art: Sperre
- Gelockert: `ok | 0` (erwartet `ok | 0`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: append_only | 1` (erwartet `P0001: append_only | 1`) ✓
- Test `tests/rls/status.test.ts` -t "UPDATE, DELETE, TRUNCATE: append_only" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## service_role: UPDATE auf alle Spalten von service_requests

- Art: Sperre
- Gelockert: `ok | x` (erwartet `ok | x`) ✓ Wirkung eingetreten
- Gesperrt: `42501: permission denied for table service_requests | <null>` (erwartet `42501: permission denied for table service_requests | <null>`) ✓
- Test `tests/rls/status.test.ts` -t "service_role ändert nur den Zeiger" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## service_role: INSERT auf status_events

- Art: Sperre
- Gelockert: `ok | 1` (erwartet `ok | 1`) ✓ Wirkung eingetreten
- Gesperrt: `42501: permission denied for table status_events | 0` (erwartet `42501: permission denied for table status_events | 0`) ✓
- Test `tests/rls/status.test.ts` -t "UPDATE, DELETE, TRUNCATE: append_only" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## service_role: INSERT auf fee_splits

- Art: Sperre
- Gelockert: `ok | 1` (erwartet `ok | 1`) ✓ Wirkung eingetreten
- Gesperrt: `42501: permission denied for table fee_splits | 0` (erwartet `42501: permission denied for table fee_splits | 0`) ✓
- Test `tests/rls/status.test.ts` -t "service_role schreibt keine Gebührenzeile mehr" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## service_role: DELETE auf profiles (Kaskade löscht die Anfragen)

- Art: Sperre
- Gelockert: `ok | 0` (erwartet `ok | 0`) ✓ Wirkung eingetreten
- Gesperrt: `42501: permission denied for table profiles | 1` (erwartet `42501: permission denied for table profiles | 1`) ✓
- Test `tests/rls/status.test.ts` -t "service_role ändert nur den Zeiger" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## service_role: DELETE auf service_requests (Schicht: request_delete_guard)

- Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert: `P0001: request_immutable | 1` (erwartet `P0001: request_immutable | 1`) ✓ Wirkung eingetreten
- Gesperrt: `42501: permission denied for table service_requests | 1` (erwartet `42501: permission denied for table service_requests | 1`) ✓
- Test `tests/rls/status.test.ts` -t "service_role ändert nur den Zeiger" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## service_role: UPDATE auf price_revisions (Schicht: revision_immutable)

- Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert: `P0001: revision_immutable | <null>` (erwartet `P0001: revision_immutable | <null>`) ✓ Wirkung eingetreten
- Gesperrt: `42501: permission denied for table price_revisions | <null>` (erwartet `42501: permission denied for table price_revisions | <null>`) ✓
- Test `tests/rls/status.test.ts` -t "UPDATE, DELETE, TRUNCATE: auch der Eigentümer" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## withdraw für anon ausführbar

- Art: Sperre
- Gelockert: `P0001: not_found | requested` (erwartet `P0001: not_found | requested`) ✓ Wirkung eingetreten
- Gesperrt: `42501: permission denied for function withdraw | requested` (erwartet `42501: permission denied for function withdraw | requested`) ✓
- Test `tests/rls/status.test.ts` -t "withdraw: Kunde ok" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## quote_save_request für authenticated ausführbar (Schicht: RLS auf platform_settings, kein INSERT-Recht)

- Art: Schicht (zweite Sperre dahinter, kein Beweis der ersten)
- Gelockert: `P0001: setting_missing | 2` (erwartet `P0001: setting_missing | 2`) ✓ Wirkung eingetreten
- Gesperrt: `42501: permission denied for function quote_save_request | 2` (erwartet `42501: permission denied for function quote_save_request | 2`) ✓
- Test `tests/rls/status.test.ts` -t "Schreib-Funktionen: anon und authenticated erhalten 42501" im gelockerten Zustand: 1 rot ✓
- Bewertung: bestanden

## too_late-Prüfung von quote_save_request ausgeschaltet

- Art: Sperre
- Gelockert: `ok | 3` (erwartet `ok | 3`) ✓ Wirkung eingetreten
- Gesperrt: `P0001: too_late | 2` (erwartet `P0001: too_late | 2`) ✓
- Test: kein eigener Vitest-Test (Wirkung durch die Probe und tests/rls/quote.test.ts „too_late“ belegt)
- Bewertung: bestanden

## Definitionen vorher/nachher

Policies, Trigger, Funktionen (md5) und Rechte sind identisch.

Ergebnis: 18 Sperren und 3 Schichten bewiesen von 21.
