Modell: claude-fable-5-2

# DB-Freigabe sys1, Runde 1

Datum: 2026-11-16
Antrag: tmp/proof/sys1/db-antrag-1.json (eine Migration)
Umfang: `supabase/migrations/20261116150000_0070_default_privileges.sql` vollständig (7 Zeilen, eine Anweisung); dazu `tests/rls/default-privileges.test.ts`, das Log `tmp/proof/sys1/008-tests_rls_default-privileges.test.ts.log`, `tests/support/owner.ts`, die Regel `.claude/rules/daten.md:22`, alle `create function` in den Migrationen 0066 bis 0069, in `tests/` und in `scripts/`.

SHA256: 0291d11ddd48710fefa0d175bcfaa1a1ca96700f64b2b4b339fc6038b1c7772c supabase/migrations/20261116150000_0070_default_privileges.sql

Urteil: frei

Zum Hash: aus dem Antrag abgeschrieben, nicht selbst berechnet (in diesem Lauf stand kein Shell-Werkzeug zur Verfügung, also kein sha256sum). Das Gate vergleicht ihn beim Push mit der Datei.

Zur Datenbank: Ich habe keinen Zugriff auf Dev. Aussagen über den Katalog stützen sich auf das Log 008 und auf das dokumentierte Verhalten von Postgres, nicht auf eine eigene Abfrage. Der Vergleich des Katalogauszugs nach dem Push steht noch aus und ist Bedingung für den Schritt (siehe N2), nicht Teil dieser Freigabe.

## Findings

### Hoch
Keine.

### Mittel
- M1 · `supabase/migrations/20261116150000_0070_default_privileges.sql:6` – Der Kommentar verweist auf „OFFEN sys1-1“ und eine „Frage in docs/BEKS.md“. Beides gibt es im Arbeitsstand nicht: Die Suche nach `sys1-1` im ganzen Repo trifft nur diese Zeile (und eine fremde Kennung in `docs/SYSTEM_VORSCHLAG.md:3`); `docs/BEKS.md` enthält weder `sys1` noch `0070` noch den Begriff Default-Privilegien. Der Rest, den die Migration offen lässt (globaler PUBLIC-Default), ist damit nirgends festgehalten und Beks nicht gefragt. – Fix: Migration nicht anfassen (Hash). Vor `npm run fertig` den Eintrag sys1-1 in `docs/OFFEN.md` und die Frage in `docs/BEKS.md` anlegen. Blockiert den Push nicht.

### Niedrig
- N1 · `supabase/migrations/20261116150000_0070_default_privileges.sql:5-7` – Die Migration schließt allein nichts: Eine neue Funktion ohne `revoke all … from public` bleibt über PUBLIC für alle drei Rollen ausführbar. Wirksam wird sie erst zusammen mit der Regel `.claude/rules/daten.md:22`. Das ist im Kommentar offen gesagt und so gewollt; den vergessenen Fall fängt der Katalogtest `tests/rls/positiv.test.ts:91-95` (er misst mit `has_function_privilege`, also einschließlich PUBLIC). – Kein Fix.
- N2 · `tmp/proof/sys1/008-tests_rls_default-privileges.test.ts.log:1-2`, `:14` – Der Vorher-Wert (259 Zeilen, Hash 822ff108…ccef) stammt aus einem Lauf mit unsauberem Arbeitsbaum auf Commit eaaef3c. Als Rot-Beweis genügt er (Ist-Wert `= true` statt `= false`, `:26-29`; drei Rollen im Default, `:42-52`). Der Beleg „bestehende Rechte unberührt“ entsteht erst nach dem Push. – Fix: nach `db:push` die Testdatei gezielt laufen lassen; verlangt sind `EXIT=0`, 259 Zeilen und derselbe Hash. Weicht einer der drei Werte ab: anhalten und Beks berichten, nicht nachbessern.
- N3 · `tests/rls/default-privileges.test.ts:25-32` – Der dritte Test liest nur den schemagebundenen Eintrag (postgres, public). Ein globaler Eintrag für postgres mit denselben Rollen bliebe dort unsichtbar. Die Wirkung misst aber der zweite Test (`:17-23`), der dann rot bliebe. – Kein Fix.
- N4 · `docs/STAND.md:13` – „ein `drop` plus `create` gibt `service_role` EXECUTE zurück (OFFEN n15-2)“ ist nach dem Push falsch; außerdem gibt es in `docs/OFFEN.md` keinen Eintrag mit der Kennung n15-2 (der Text hängt ohne eigene Kennung am Ende von n12b-1, `docs/OFFEN.md:92`). – Fix: nach dem Push STAND und OFFEN nachziehen.

## Prüffragen

### (1) Nur künftige Funktionen in public, bestehende Rechte unberührt
Ja, nach Postgres-Semantik; der Messwert nach dem Push steht aus (N2).
- `alter default privileges` ändert nur `pg_default_acl`. Die ACL bestehender Objekte (`pg_proc.proacl`) fasst die Anweisung nicht an; Standardrechte greifen ausschließlich beim Anlegen eines Objekts.
- Eingegrenzt auf die anlegende Rolle postgres, das Schema public und den Objekttyp Funktionen (umfasst auch Prozeduren). Das Schema private, Tabellen, Sequenzen und die Standardrechte anderer Rollen bleiben, wie sie sind.
- Ein schemagebundenes Revoke kann nur entfernen, was schemagebunden vergeben wurde. Dass die drei Rechte genau dort liegen, zeigt das Log (`008:42-52`: der Eintrag postgres/public/Funktionen nennt anon, authenticated, service_role). Die Anweisung trifft also die Quelle.
- postgres ist die richtige Rolle: Der Katalogauszug verlangt als Eigentümer aller Funktionen in public und private allein postgres und war grün (`default-privileges.test.ts:44`, `008:21`); Migrationen legen Funktionen also als postgres an.
- Der Auszug taugt als Beleg: je Funktion (mit Signatur), Eigentümer, Empfänger und Recht, für public und private, auch bei leerer ACL (`default-privileges.test.ts:35-40`).
- Geldwege: keine bestehende Funktion verliert ein Recht, also kein 42501 und kein Neu-Deploy von Edge Functions aus dieser Migration.

### (2) Verlässt sich etwas auf den Default?
Nein.
- Migrationen ab 0066: neu angelegt werden nur `partner_accept_replay` (`0067:7`), `cancel_replay` (`0068:12`) und `propose_change_replay` (`0068:60`). Alle drei entziehen ausdrücklich public, anon, authenticated und service_role und vergeben danach nur service_role (`0067:22-23`, `0068:57-58`, `0068:79-80`). 0066 und 0069 enthalten nur `create or replace` (Rechte bleiben).
- Alle Migrationen bis 0069 sind auf Dev angewendet und laufen bei einem Neuaufbau vor 0070; sie sehen den alten Default, das Ergebnis ist dasselbe wie auf Dev.
- Geplante Migrationen: keine Datei nach 0070 im Ordner; `docs/STAND.md:6` nennt 0070 als nächste.
- `tests/rls/*.test.ts`: Nur `default-privileges.test.ts:19` legt eine Funktion in public an, und genau diese prüft den neuen Zustand. Keine andere Rollback-Probe legt eine Funktion an.
- `scripts/redproof-s9a4.mjs:484-500` legt im gelockerten Zustand `become_rental_provider` neu an, mit eigenem Entzug und eigenem `grant execute … to authenticated` (`:498-499`); die Probe läuft als authenticated (`:511`). Sie braucht den Default nicht. Einziger Unterschied nach 0070: service_role hat im gelockerten Zustand kein EXECUTE mehr, was die Probe nicht misst.
- Bestehende Katalogtests (`tests/rls/positiv.test.ts:91-95`, `tests/rls/rls.test.ts:441`) lesen nur Rechte bestehender Funktionen und ändern sich nicht.

### (3) Idempotent, ohne Datenwirkung
Ja.
- Ein zweiter Lauf entzieht nichts mehr und endet ohne Fehler.
- Geändert wird eine Katalogzeile. Keine Tabelle, keine Zeile, keine Policy, keine Funktion, kein Trigger; keine Sperre auf Nutzertabellen; kein Seed.
- Generierte Typen ändern sich nicht (`db:types` läuft trotzdem mit, ohne Unterschied).
- Die Anweisung ist transaktional; scheitert sie, bleibt der alte Stand.

Geld: nicht berührt (keine Beträge, keine Gebühr, kein Journal). Sicherheit: reine Verschärfung, keine Rechte-Ausweitung, kein neuer Weg für Kunden oder Partner.

## Stichproben
- `supabase/migrations/20261116150000_0070_default_privileges.sql:7` – eine Anweisung, Rolle postgres, Schema public, nur Funktionen, nur die drei Rollen.
- `tmp/proof/sys1/db-antrag-1.json:3-4` – eine Datei, Hash wie oben.
- `tmp/proof/sys1/008-…log:14` – 259 Zeilen, Hash 822ff1083212d26f0908c44f282ee31a91925bb27f36b74b3a294e669166ccef (stimmt mit dem Auftrag überein).
- `tmp/proof/sys1/008-…log:18` – `current_user` ist postgres auf dem Weg `supabase db query --linked` (`tests/support/owner.ts:24`).
- `tmp/proof/sys1/008-…log:26-29` – vor dem Push `= true` für anon trotz `revoke all … from public`: der Rot-Beweis misst die Wirkung.
- `tmp/proof/sys1/008-…log:74` – `EXIT=1`.
- `tests/rls/default-privileges.test.ts:17-23` – Probe in Rollback (`tests/support/owner.ts:113`), es bleibt keine Funktion zurück.
- `supabase/migrations/20261029214421_0006_route_infra.sql:84-89` – das Muster aus der Regel stimmt (Entzug, dann Recht nur für service_role).
- `.claude/rules/daten.md:22` – Regel passt zur Migration; der Entzug für anon und authenticated ist dort nach 0070 doppelt, aber unschädlich.
- `docs/OFFEN.md:92` – Herkunft des Schritts (Planprüfung n15) samt der Warnung, alle Migrationen zu prüfen; mit Prüffrage 2 erledigt.

Offene Findings hoch: 0
