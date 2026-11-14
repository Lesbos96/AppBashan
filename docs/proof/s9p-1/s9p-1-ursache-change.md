# s9p-1 · Ursache change-orders.test.ts „eingefrorener Satz nach Satzwechsel“ (Kennung p1-1411-b)

Fehler: `Error: unexpected status 400 … 42601: syntax error at or near ";"` aus `tests/support/owner.ts:35` (Test `change-orders.test.ts:399`, `probes`).

Ursache 1 (Test-Setup): Der Setup-Schritt „Satzwechsel“ (`change-orders.test.ts:389`) endete mit `;`, `probes` hängt selbst eins an → `;;`. Kein Fachfehler. Behoben: Semikolon entfernt.
Ursache 2 (Test-Assertion, hinter dem ersten Fehler verdeckt): Der Schritt hieß `change-Zeile trägt die eingefrorene Version`, die Prüfung las noch `r['change-Zeile trägt den eingefrorenen Satz']` (undefined). Behoben: Schlüssel angeglichen.

Test prüft nach der Vorgabe: Version 99 (10 %) wird als neue geltende Version angelegt, `decide_change` mit Version 99 → `fee_basis_changed`; mit der Version des Auftrags → `accepted`; die `change`-Zeile trägt `fee_schedule_version = RT.fsv` (Version des Auftrags). Ergebnis `s9p-1-gezielt-4.log` EXIT=0 (7 Tests).
Keine Migration, kein Edge-Fix.
