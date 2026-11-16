-- 0071 (sys2, BEKS 1): Neue Funktionen von postgres bekommen in keinem Schema mehr automatisch EXECUTE für PUBLIC.
-- Der eingebaute Default gibt jeder neuen Funktion EXECUTE für PUBLIC (und damit für anon und authenticated); 0070 nahm nur die Rollen anon, authenticated und service_role im Schema public heraus.
-- Dieses globale Revoke (ohne IN SCHEMA) entfernt PUBLIC für alle Schemas. Migrationen laufen als postgres, also trifft es genau die Funktionen, die diese Rolle künftig anlegt.
-- Bestehende Funktionen behalten ihre Rechte (ein Default wirkt nur auf neue Objekte); der Katalogauszug public und private vor und nach dem Push steht in tests/rls/public-default.test.ts.
-- Die Funktionen von supabase_admin und den Dienstrollen (auth, storage, realtime, extensions) gehören anderen Rollen und bleiben unberührt.
-- Folge: Jede neue Funktion braucht ein ausdrückliches GRANT EXECUTE für ihren echten Aufrufer (.claude/rules/daten.md); ein vergessenes revoke öffnet nichts mehr.
alter default privileges for role postgres revoke execute on functions from public;
