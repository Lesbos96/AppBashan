# S9a-3 Rot-Beweis

Stand 2026-11-02T17:47:50.657Z (Dev-Projekt). Teil 1 SQL: lockern (committet), Ist-Wert-Probe (Rollback) und zuständigen Test laufen lassen, Original wiederherstellen (Restore-SQL vorher nach tmp/proof/s9a3-restore-*.sql), Probe erneut. Teil 2 Redeploy (R2-N13): Quelltext lockern, quote deployen, Test muss rot werden, Datei aus dem vorher gelesenen Inhalt zurück, neu deployen, Test grün, md5 der Datei vorher und nachher gleich. Teil 3 Werkzeuge (N-15, N-16).

Format der Probe: „Ergebnis | Wert“. Ergebnis ist „ok“ oder „SQLSTATE: Meldung“; Wert ist der Zustand danach. „Schicht“: eine zweite Sperre dahinter hält, kein Beweis der ersten.

## quote: Abholung außerhalb Wiens nicht mehr geprüft (Schicht: Bezirk aus Polygon)

- Teil: Redeploy; Art: Schicht (zweite Sperre dahinter: zweite Schicht: district null → district_required, kein Beweis der ersten)
- Gelockert/Beobachtet: `1 Test(s) rot: AssertionError: expected { status: 422, …(1) } to match object { status: 422, …(1) }` (erwartet `Test rot`) ✓
- Gesperrt/Wiederhergestellt: `1 grün, 0 rot` (erwartet `Test grün`) ✓
- md5 der Datei vorher `ae71b0da5eaa26204ebaa24ecbcdf5bc`, nachher `ae71b0da5eaa26204ebaa24ecbcdf5bc`: gleich
- Bewertung: bestanden

## quote: gezeigter Betrag nicht mehr abgeglichen (Kundenpreis ohne Zustimmung)

- Teil: Redeploy; Art: Sperre
- Gelockert/Beobachtet: `1 Test(s) rot: AssertionError: expected { status: 200, body: { …(5) } } to match object { status: 409, body: { …(3) } }` (erwartet `Test rot`) ✓
- Gesperrt/Wiederhergestellt: `1 grün, 0 rot` (erwartet `Test grün`) ✓
- md5 der Datei vorher `ae71b0da5eaa26204ebaa24ecbcdf5bc`, nachher `ae71b0da5eaa26204ebaa24ecbcdf5bc`: gleich
- Bewertung: bestanden

## quote: Haltefenster nicht mehr geprüft (abgelaufene Version zählt)

- Teil: Redeploy; Art: Sperre
- Gelockert/Beobachtet: `1 Test(s) rot: AssertionError: expected 200 to be 409 // Object.is equality` (erwartet `Test rot`) ✓
- Gesperrt/Wiederhergestellt: `1 grün, 0 rot` (erwartet `Test grün`) ✓
- md5 der Datei vorher `ae71b0da5eaa26204ebaa24ecbcdf5bc`, nachher `ae71b0da5eaa26204ebaa24ecbcdf5bc`: gleich
- Bewertung: bestanden

## quote: Bedingungen-Hash nicht mehr abgeglichen

- Teil: Redeploy; Art: Sperre
- Gelockert/Beobachtet: `1 Test(s) rot: AssertionError: expected 200 to be 409 // Object.is equality` (erwartet `Test rot`) ✓
- Gesperrt/Wiederhergestellt: `1 grün, 0 rot` (erwartet `Test grün`) ✓
- md5 der Datei vorher `ae71b0da5eaa26204ebaa24ecbcdf5bc`, nachher `ae71b0da5eaa26204ebaa24ecbcdf5bc`: gleich
- Bewertung: bestanden

## quote: Client-Punkt bindet nicht mehr an den Kandidaten (Schicht: Bezirk/Wien-Prüfung)

- Teil: Redeploy; Art: Schicht (zweite Sperre dahinter: zweite Schicht: Wien-Prüfung am Kandidaten, kein Beweis der ersten)
- Gelockert/Beobachtet: `1 Test(s) rot: AssertionError: expected { status: 422, …(1) } to match object { status: 422, …(1) }` (erwartet `Test rot`) ✓
- Gesperrt/Wiederhergestellt: `1 grün, 0 rot` (erwartet `Test grün`) ✓
- md5 der Datei vorher `ae71b0da5eaa26204ebaa24ecbcdf5bc`, nachher `ae71b0da5eaa26204ebaa24ecbcdf5bc`: gleich
- Bewertung: bestanden

## Definitionen vorher/nachher (SQL-Teil)

Policies, Trigger (inkl. tgenabled), Constraints, Funktionen (md5) und Rechte sind identisch.

Ergebnis: SQL 0 Sperren und 0 Schichten, Redeploy 3 Sperren und 2 Schichten, Werkzeuge 0 bewiesen von 5.
