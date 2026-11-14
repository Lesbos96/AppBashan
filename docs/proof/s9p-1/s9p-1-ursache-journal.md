# s9p-1 · Ursache journal.test.ts (Kennung p1-1411-b)

Fehler: Positivkontrolle `change` → `P0001: amount_mismatch` (Testfälle „change: nur erhöhend …“, „Revisionen: …“).

Schicht, die wirft: SQL-Trigger `private.guard_commission_insert`, Migration 0062, Zeilen 298–304 (`supabase/migrations/20261114100000_0062_fee_schedule.sql`).
- Erwartet: `new.total_cents = rev.total_cents − js.total` (Differenz) und `js.fee + new.fee_cents = fee_cents(Version, Gesamt nach)`, also Provision(Gesamt nach) − Provision(Gesamt vor): bei 68961 → 80000 = 9000 − 7896 = 1104.
- Erhalten: Zeile mit Gebühr 1325 = 12 % auf die Differenz 11039 allein (`RT.split(80000 − 68961)` in `journal.test.ts:218` und `:280`).

Befund: Keine Schicht rechnet falsch. Trigger und Edge (`splitChange`, `supabase/functions/_shared/pricing/change.ts:32`) folgen der Vorgabe. Die Testerwartung war veraltet (Staffel auf die Differenz statt Differenz der Provisionen). Kein 0063, kein Edge-Fix nötig.

Korrektur: Erwartung an die Vorgabe angepasst, nicht an den Ist-Wert: `diff = splitChange(80000, rates, s)`; dazu feste Zahlen aus der Vorgabe (`[7896, 1104, 9935]`), damit Test und Server nicht beide dieselbe falsche Funktion benutzen. Ergebnis `s9p-1-gezielt-5.log` (nur diese Datei).
