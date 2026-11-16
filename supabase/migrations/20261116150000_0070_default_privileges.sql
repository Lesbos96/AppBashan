-- 0070 (sys1, n15-2): Neue Funktionen im Schema public bekommen nicht mehr automatisch EXECUTE für anon, authenticated und service_role.
-- Bisher gab der Default (pg_default_acl: postgres, public, Funktionen) jeder neuen Funktion alle drei Rechte; ein `drop` plus `create` einer gelockten Funktion stellte
-- service_role EXECUTE wieder her (0066, OFFEN n15-2). Jetzt gilt: jede neue Funktion braucht ein ausdrückliches GRANT nur für ihren echten Aufrufer (.claude/rules/daten.md).
-- Bestehende Funktionen behalten ihre Rechte (ein Default wirkt nur auf neue Objekte); der Katalogauszug vor und nach dem Push steht im Test tests/rls/default-privileges.test.ts.
-- Nicht Teil: der globale PUBLIC-Default (EXECUTE für PUBLIC auf jede neue Funktion in jedem Schema) bleibt; ein schemagebundenes Revoke kann ihn nicht entfernen,
-- ein globales wirkte auf private und alle anderen Schemas (OFFEN sys1-1, Frage in docs/BEKS.md). Deshalb schreibt die Regel für neue Funktionen `revoke all … from public` vor.
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, service_role;
