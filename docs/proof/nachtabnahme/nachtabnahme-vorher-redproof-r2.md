# Prüfbericht Nachtabnahme Runde 2: Sperre der Redproof-Skripte s9a3/s9a4, Shell

Datum: 2026-11-06 · Prüfer: advisor-report (Opus) · Branch `nachtabnahme`, Commit 3a078e5

## Geprüfter Umfang

- `tmp/proof/nachtabnahme-diff-r2.patch` vollständig (`git diff f29a551 HEAD -- src scripts`: `scripts/redproof-s9a3.mjs`, `scripts/redproof-s9a4.mjs`, `src/app/Shell.tsx`).
- Ist-Stand vollständig gelesen: `scripts/redproof-s9a3.mjs` (430 Zeilen), `scripts/dev-guard.mjs` (23 Zeilen), `src/app/Shell.tsx` (114 Zeilen), `scripts/redproof-s9a1.mjs` (147 Zeilen), `scripts/redproof-s9a2.mjs` (308 Zeilen), `package.json`. Von `scripts/redproof-s9a4.mjs` die Zeilen 1-40 (Einstieg, Sperre, Importe) und 680-709 (Werkzeugteil mit Selbstaufrufen); der übrige Körper ist hinter der Sperre unerreichbar und war Gegenstand von Runde 1.
- Belege: `tmp/proof/nachtabnahme-sperre-s9a3.log`, `tmp/proof/nachtabnahme-sperre-s9a4.log`.
- Querverweise: `docs/OPEN_ISSUES.md:254-268` (Abschnitt R1), `vite.config.ts` (Test-Includes), Suche über `scripts/`, `tests/`, Wurzel nach Aufrufen der Redproof-Skripte und nach lockernder SQL; Migrationen 0001, 0016, 0019 an den zitierten Stellen.
- Vorbericht: `tmp/proof/nachtabnahme-vorher-redproof.md` (Runde 1).
- Hinweis: In meiner Tool-Liste steht ein eingebautes `advisor`-Werkzeug ohne Parameter. Ich habe es nach CLAUDE.md nicht benutzt.

## Findings

### Hoch

Keine.

### Mittel

**M-5 `scripts/redproof-s9a1.mjs:6, 103, 109-146` mit `docs/OPEN_ISSUES.md:255` – redproof-s9a1 ist nicht gesperrt, lauffähig und hat dieselben Konstruktionsmängel wie H-1 und M-1**
- Problem: OPEN_ISSUES nennt die Mängel „aller Redproof-Skripte“, sperrt aber nur s9a3 und s9a4. `redproof-s9a1.mjs` hat keine Sperre und ist weiterhin lauffähig. Alle Zielobjekte existieren noch; `fee_splits` bleibt laut 0018:6 bis S9b bestehen. Es committet Lockerungen auf Dev über Autocommit je CLI-Aufruf (Zeilen 10-15). Betroffen sind:
  - Trigger werden gelöscht (Zeilen 37-42, z. B. `guard_platform_setting`, `guard_role`, `append_only`),
  - `is_admin()` ohne aal2 (Zeile 77),
  - Policies werden gelockert (Zeilen 83-85, u. a. `price_versions_select` auf „immer wahr“, `fee_splits_select` für admin ohne aal2),
  - Schreibrechte für authenticated (Zeilen 80-82).
- Wie in H-1 ist die Vorher-Basis relativ: Zeile 103 nimmt den Startzustand, Zeile 139-140 vergleicht nur Nachher mit Vorher. Wie in M-1 gibt es keinen Signal-Handler. Ein Strg+C während des vitest-Laufs (Zeile 90) lässt die Lockerung committet stehen; der `finally` in Zeile 116-118 läuft dann nicht.
- Abschwächung gegenüber s9a4:
  - Ein gescheiterter `restore` wirft aus der Schleife; das Muster aus M-2 tritt nicht auf.
  - Ein veraltetes JSON (M-3) kann nicht zugleich rot und grün liefern; Zeile 124-125 verlangen beides, der Schritt wird FEHLER.
  - Im Volllauf scheitern Reste laut: `save()` eines fehlenden Triggers wirft, ein Funktionsmuster wird nicht gefunden, ein grün-danach-Test bleibt rot.
  - Eine Kunden-Eskalation über diese Lockerungen habe ich nicht gefunden. Das Rollen-Update für authenticated ist schon per Spaltenrecht gesperrt (0001:261, nur `display_name` und `phone`).
- Was offen bleibt: Mit `--only` (Zeile 99, Bericht `s9a1-rotbeweis-nachpruefung.md`) bestätigt ein Lauf einen Rest außerhalb der Auswahl als „identisch“ und „BESTANDEN“. Das ist der falsche Nachweis aus H-1. Ein offener Rest von Zeile 77 oder 85 hebt außerdem die aal2-Pflicht für admin auf, die CLAUDE.md für das Gebührenjournal verlangt.
- Fix: `redproof-s9a1.mjs` genauso sperren wie s9a3/s9a4: direkt nach `import './dev-guard.mjs'` eine Meldung auf stderr und `process.exit(2)`, ohne Schalter. Zusätzlich `docs/OPEN_ISSUES.md:255` richtigstellen: Der Abschnitt R1 umfasst s9a1 bis s9a4, nicht nur s9a3 und s9a4. Die Alternative ist, s9a1 und s9a2 zu entfernen; der Nachweis bleibt in `docs/proof/s9a1/` bzw. `docs/proof/s9a2/`, und die Kommentarverweise `tests/rls/status.test.ts:3` und ggf. weitere müssten nachgezogen werden. Das entscheidet der Auftraggeber. Sperren genügt für diese Nachtabnahme.

### Niedrig

**N-6 `scripts/redproof-s9a2.mjs:1, 9, 87-88` – redproof-s9a2 ist nur faktisch, nicht ausdrücklich gesperrt**
Der Kopf sagt „nach 0019 nicht mehr lauffähig“. Das stimmt: Zeile 88 ruft `quote_save_request` mit den alten Parametern (u. a. `p_from_postcode`) auf, und 0019:86-90 hat diese Signatur gelöscht. Der Lauf wirft deshalb vor der ersten Lockerung (Zeile 255 ff.). Vorher legt Zeile 87 aber noch ein Wegwerf-Konto auf Dev an, das der `finally` in Zeile 283 wieder löscht. Die Sperre ergibt sich hier aus dem Zufall der Signatur; eine Migration mit wieder passender Überladung würde sie aufheben. Fix: wie M-5 ausdrücklich sperren (oder entfernen).

**N-7 `scripts/redproof-s9a4.mjs:686-706` – Werkzeugprüfungen messen nach dem Entsperren die Sperre statt der Wirkung**
Das ist ein Hinweis für R1, in der aktuellen Lage unerreichbar. Zeile 688 startet s9a4 selbst mit fiktiver Ref und erwartet Exit 2 mit „ABBRUCH“. Zeile 698 startet s9a3 und erwartet Exit 2 mit „ABBRUCH“ aus der Prüfung auf uncommittete Functions.
- Entsperrt R1 nur s9a4: Die A-N4-Prüfung meldet FEHLER, denn s9a3 endet zwar mit Exit 2, aber mit der Sperrmeldung ohne „ABBRUCH“.
- Würde die Sperrmeldung „ABBRUCH“ enthalten: Beide Prüfungen wären grün, ohne dev-guard bzw. die Git-Prüfung zu messen. Das wäre ein Rot-Beweis, der nach CLAUDE.md nicht zählt.

Fix in R1: Alle Sperren im selben Commit entfernen; die Sperrmeldung nie mit „ABBRUCH“ formulieren.

## Prüffragen

**1. Ist H-1 (und M-1..M-4) durch die Sperre entschärft?** Für s9a3 und s9a4: ja. Nicht für die Redproof-Logik insgesamt, denn s9a1 ist offen (M-5).

- **ESM-Reihenfolge:** Importdeklarationen werden in ESM gehoben. In beiden Dateien werden deshalb alle Importe vor dem Modulkörper ausgewertet, auch die, die textlich hinter `process.exit(2)` stehen (s9a3:13-18, s9a4:12-15).
  - Das sind `node:child_process`, `node:fs`, `node:crypto`, `node:os`, `node:path` und `@supabase/supabase-js`. Keiner davon macht beim Laden eine Netz- oder DB-Aktion; supabase-js definiert nur Module, ein Client entsteht erst in s9a3:65 bzw. im Körper von s9a4.
  - Danach läuft der Körper: Die erste Anweisung ist die Sperrmeldung, die zweite `process.exit(2)` (s9a3:11-12, s9a4:10-11). `process.exit` ist synchron, und davor gibt es keine ausstehenden Promises oder Timer.
  - Erst dahinter liegen alle Dev-Aktionen: s9a3 Git-Prüfung Zeile 33, Client Zeile 65, `run()` Zeile 402; s9a4 die Trigger-Startabfrage im Diff-Hunk um Zeile 727 und `run()`. Sie sind unerreichbar.
  - Top-Level-`await` steht ebenfalls erst hinter der Sperre.
- **dev-guard.mjs:** Keine DB-Aktion, bestätigt. Er liest Umgebungsvariablen und die lokale Datei `supabase/.temp/project-ref` (Zeilen 7-11), endet bei Abweichung selbst mit Exit 2 (Zeilen 13-21) und setzt sonst `SUPABASE_PROJECT_ID` (Zeile 22). Es gibt keinen Import eines Clients und keinen Prozessstart.
- **Belege:** Beide Logs zeigen die Sperrmeldung und `EXIT=2`. Eine „ABBRUCH“-Zeile des dev-guard fehlt; der Guard hat also mit Dev-Umgebung durchgelassen, und die Sperre selbst hat beendet. Das ist die richtige Wirkungsmessung.
- **Umgehungswege:**
  - Kein Schalter: Vor `process.exit` gibt es weder eine Bedingung noch eine Umgebungsvariable.
  - Keine anderen Einstiegspunkte: Beide Dateien exportieren nichts, und kein anderes Modul importiert sie (Suche über das Repo außer `docs/`, `tmp/` und `node_modules/`).
  - package.json: Kein npm-Skript ruft ein Redproof-Skript auf (`package.json:40-65`).
  - Tests und CI: Unter `tests/` stehen nur Kommentarverweise (`tests/rls/uploads.test.ts:3`, `tests/rls/quote-hardening.test.ts:4`, `tests/rls/status.test.ts:3`). Die vitest-Includes erfassen `scripts/` nicht (`vite.config.ts:18, 23`). Ein `.github/` gibt es nicht.
  - Gegenseitige Aufrufe: s9a4 startet s9a4 und s9a3 nur im Werkzeugteil (s9a4:688, 698); das liegt hinter der eigenen Sperre, und beide Ziele sind ohnehin gesperrt.
- **Andere Skripte mit derselben Logik:** Lockernde SQL (Policy ändern, Trigger aus oder löschen, Grants, `create or replace function`) steht in genau vier Dateien: s9a1, s9a2, s9a3, s9a4. Die übrigen Skripte mit Prozessstarts (`db-seed-dev`, `live-uploads`, `live-r3`, `setup-photo-cleanup`, `db-link`) enthalten keine solche SQL.
  - s9a1 ist offen und hat die Mängel aus H-1 und M-1, abgeschwächt (siehe M-5).
  - s9a2 bricht faktisch vor der ersten Lockerung ab (N-6).
  - M-4 (photo_orphans) betrifft nur s9a4 und ist mit dessen Sperre entschärft.
- **Ergebnis:** H-1 sowie M-1 bis M-4 sind für die Dateien, auf die sie sich beziehen, entschärft und bleiben als Konstruktionsmängel in R1 offen (`docs/OPEN_ISSUES.md:259-263`). Das ist bewusst entschieden. Die gleiche Mängelklasse lebt in s9a1 weiter; ich stufe sie als mittel ein (M-5), nicht als hoch, weil ein Volllauf laut scheitert und ich keinen Weg zur Rechte-Ausweitung für Kunden gefunden habe.

**2. Shell.tsx weiterhin ohne Befund?** Ja. Der Ist-Stand (114 Zeilen) ist inhaltlich identisch mit dem in Runde 1 geprüften Stand. Die Zeilenbezüge aus Runde 1 stimmen weiterhin: `useIsPresent`, `inert` und `aria-hidden` in Zeilen 31-36, die Fokusführung in Zeilen 70-95, die TabBar außerhalb von `Page` in Zeile 109. Der Shell-Teil des Diffs (Patch-Zeilen 129-190) deckt sich mit der Datei. Weiterhin kein Befund hoch oder mittel; N-5 bleibt ohne Handlungsbedarf. Geld- oder Sicherheitslogik ist nicht berührt.

**3. Neue Findings durch den Diff:**
- Die Sperrzeilen selbst bringen keinen Befund; sie sind korrekt und ohne Umgehung.
- Die weiteren Diff-Teile in s9a4 sind unerreichbar und waren schon Gegenstand von Runde 1 (H-1, M-1, M-2, N-2 bis N-4). Gemeint sind die Wiederholung in `sql()`, `restoreFailed`, das Trigger-Netz und das schrittweise Aufräumen.
- Neu aus der Umfeldprüfung: M-5 (mittel, `scripts/redproof-s9a1.mjs`, `docs/OPEN_ISSUES.md:255`), N-6 (niedrig, `scripts/redproof-s9a2.mjs`) und N-7 (niedrig, Hinweis für R1, `scripts/redproof-s9a4.mjs:686-706`).

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| scripts/redproof-s9a3.mjs:10-12 | dev-guard-Import, dann Sperrmeldung und `process.exit(2)`, ohne Bedingung |
| scripts/redproof-s9a3.mjs:13-18 | Importe nach der Sperre: nur Node-Builtins und supabase-js, beim Laden ohne I/O |
| scripts/redproof-s9a3.mjs:33, 65, 402 | Erste Git-Prüfung, Client und Lauf liegen hinter der Sperre |
| scripts/redproof-s9a4.mjs:9-11 | Wie s9a3, ohne Schalter |
| scripts/redproof-s9a4.mjs:12-15 | Importe ohne Nebenwirkung |
| scripts/redproof-s9a4.mjs:688, 698 | Selbstaufruf und Aufruf von s9a3 nur im Werkzeugteil hinter der Sperre |
| scripts/dev-guard.mjs:4-22 | Nur Umgebungsvariablen und lokale Datei lesen, Exit 2 oder `SUPABASE_PROJECT_ID` setzen; keine DB-Aktion |
| tmp/proof/nachtabnahme-sperre-s9a3.log:1-2 | Sperrmeldung, `EXIT=2`, keine Guard-Meldung |
| tmp/proof/nachtabnahme-sperre-s9a4.log:1-2 | Sperrmeldung, `EXIT=2`, keine Guard-Meldung |
| package.json:40-65 | Kein npm-Skript ruft redproof-* auf |
| vite.config.ts:18, 23 | vitest erfasst nur `tests/unit` und `tests/rls` |
| scripts/redproof-s9a1.mjs:6-15 | Keine Sperre; Autocommit je CLI-Aufruf |
| scripts/redproof-s9a1.mjs:77, 83-85 | Lockerungen: is_admin ohne aal2 und Policies, darunter fee_splits für admin ohne aal2 |
| scripts/redproof-s9a1.mjs:103, 139-140 | Vorher-Basis relativ zum Startzustand |
| scripts/redproof-s9a1.mjs:109-119 | `finally` je Schritt, kein Signal-Handler; ein gescheiterter `restore` wirft aus der Schleife |
| scripts/redproof-s9a1.mjs:124-125 | Rot- und Grün-Bedingung zugleich verlangt, M-3 so abgeschwächt |
| scripts/redproof-s9a2.mjs:87-88 | Konto anlegen, dann RPC mit alter Signatur; Abbruch vor jeder Lockerung |
| supabase/migrations/…0019_quote_hardening.sql:86-90 | Alte Signatur von `quote_save_request` (mit PLZ-Parametern) gelöscht |
| supabase/migrations/…0018_revisions_contacts.sql:6 | `fee_splits` bleibt bis S9b, Zielobjekt von s9a1 existiert |
| supabase/migrations/…0001_foundation.sql:261 | authenticated darf in `profiles` nur `display_name` und `phone` ändern |
| docs/OPEN_ISSUES.md:255 | „aller Redproof-Skripte“, aber nur s9a3 und s9a4 genannt und gesperrt |
| src/app/Shell.tsx:31-36, 70-95, 109 | Unverändert gegenüber Runde 1, ohne Befund |

Offene Findings hoch: 0
