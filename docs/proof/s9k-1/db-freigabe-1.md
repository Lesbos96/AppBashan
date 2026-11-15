Modell: claude-fable-5-2

# DB-Freigabe 1 für Schritt s9k-1

Datum: 2026-11-15
Umfang: Antrag `tmp/proof/s9k-1/db-antrag-1.json` (eine Datei), Migration 0064 vollständig gelesen (335 Zeilen), gegen den Plan `tmp/proof/s9k-1/plan.md` (mit Planentscheidung H1, M1 bis M3) und gegen die Vorfassungen in `supabase/migrations` geprüft. Regeln: `.claude/rules/daten.md`, `.claude/rules/geld.md`.

SHA256: d47f3e4c97433d1d6a1b08a04593be33a57881f74960c5b8a2f2ea8bc7a886c4 supabase/migrations/20261115104122_0064_report_flow.sql

Urteil: frei

Grenzen der Prüfung
- Der Hash ist aus dem Antrag abgeschrieben. Ich habe kein Werkzeug, um ihn selbst zu berechnen; den Abgleich mit der Datei macht das Gate.
- Die Rümpfe habe ich Zeile für Zeile gelesen und verglichen, nicht mit einem Diff-Programm. Ein maschineller Funktionsdiff (wie bei s9p-1) liegt für diesen Schritt nicht vor.
- Rechte habe ich aus den Migrationen abgeleitet, nicht an der Datenbank abgefragt (die Migration ist noch nicht angewendet).
- Die Testdatei `tests/rls/report-flow.test.ts` habe ich nur nach den Rechte- und Sperrproben durchsucht, nicht abgenommen.

## Findings

### hoch
Keine.

### mittel
Keine.

### niedrig
- N1 `supabase/migrations/20261115104122_0064_report_flow.sql:291-296` (mit 25-43) – Die Löschsperre M1 lässt sich in der Reihenfolge umgehen: `delete_account` sperrt nur das Profil, nicht die Anfragen, und `report_not_done` prüft `profiles.deleted_at` nicht. Zwei Wege: (a) Wettlauf, Meldung committet zwischen Prüfung und Löschen; (b) erst löschen, dann mit dem noch gültigen Zugriffstoken (läuft erst ab, PostgREST kennt gelöschte Sitzungen nicht) eine abgeschlossene Anfrage im Fenster melden. Ergebnis: offene Meldung (Z4) zu einem gelöschten Konto, die nur admin beendet. Kein Geld bewegt sich von selbst, und vor 0064 war Löschen in Z4 ganz erlaubt, also keine Verschlechterung. – Fix in einem späteren Schritt (Zeile in `docs/OFFEN.md`): `delete_account` sperrt vor den Prüfungen die eigenen Anfragen `for update` (Reihenfolge Profil, dann Anfragen), und `report_not_done` wirft `not_found`, wenn das Profil gelöscht ist (Lesen nach der Anfragesperre, ohne eigene Profilsperre, sonst droht ein Deadlock).
- N2 `supabase/migrations/20261115104122_0064_report_flow.sql:22` – Dass `authenticated` `private.report_gate` nicht direkt aufrufen kann, folgt nur aus dem Muster (Schema `private` hat für `authenticated` Nutzung, 0001:12-14; Ausführung für alle entzogen; keine Vorgabe-Rechte für `private` in den Migrationen). Die RLS-Datei prüft anon gegen `my_report_info` (`tests/rls/report-flow.test.ts:117`), aber keinen Direktaufruf der privaten Funktion. – Fix: eine Probe „authenticated ruft `private.report_gate` → 42501“ in derselben Testdatei. Kein Grund, den Push aufzuhalten.

Hinweis für den Betrieb (kein Finding der Migration, steht schon in der Planentscheidung): Z2 und Z4 enden nur durch admin, ohne Oberfläche und ohne Benachrichtigung. Mit M1 wartet auch das Löschen des Kontos darauf. Für die Löschfrist nach DSGVO braucht es einen festen Ablauf (`docs/BEKS.md`, `docs/GOLIVE.md`).

## Prüffragen

1. Rümpfe unverändert bis auf die dokumentierte Änderung: ja.
   - `start_job` (0064:67-88) gegen 0032:4-24: gleich, plus Zeile 83 (Meldung → `under_review`) nach der Zuordnungsprüfung, vor der Statusprüfung. Fremde Firmen bekommen weiter `not_assigned`, erfahren also nichts über die Meldung.
   - `complete_job` (0064:90-118) gegen 0043:4-31: gleich, plus Zeile 111 im Partnerzweig, vor der Statusprüfung (wie M3 verlangt). Kundenzweig unverändert.
   - `report_not_done` (0064:25-43) gegen 0043:33-54: die fünf Prüfungen sind durch den Aufruf von `report_gate` ersetzt, Sperre, Update und Audit-Zeile gleich.
   - `my_jobs` (0064:123-169) gegen 0057:5-49: gleich, plus Spalte `under_review` (Zeile 141, 157) und Zusatz in `can_start` (Zeile 156).
   - `private.change_gate` (0064:176-199) gegen 0040:303-325: gleich, plus Zeile 196 nach der Statusprüfung.
   - `decide_change` (0064:203-274) gegen 0062:606-676: gleich (Signatur, Parameternamen, Deklarationen, alle Zeilen), plus Zeile 241 nach dem Ablehnen-Zweig. Idempotente Rückgaben, `change_not_valid` und `invalid_transition` kommen weiter zuerst; Ablehnen bleibt in Z2 möglich.
   - `delete_account` (0064:278-334) gegen 0054:42-92: gleich, plus Block 291-296 vor `open_requests`.
   - Vorlagen sind jeweils die jüngste Fassung: keine spätere Definition von `start_job` (nur 0032), `complete_job` (0043), `report_not_done` (0043), `my_jobs` (0057), `change_gate` (0040), `decide_change` (0062), `delete_account` (0054 nach 0053).
2. `report_gate`-Reihenfolge und Verhalten von `report_not_done`: unverändert. Reihenfolge Status, schon gemeldet, Kundenbestätigung, `too_early`, `report_window_closed` (0064:11-17) wie 0043:43-49. „Schon gemeldet“ kehrt still zurück (Zeile 37), alle anderen Gründe werden mit demselben Text geworfen (Zeile 38). `r.id` statt `p_request` ist derselbe Wert. Die Zeile wird vor dem Aufruf `for update` gelesen; der Aufruf aus der nicht-stabilen Funktion sieht die nach der Sperre committeten Statusereignisse, die Abgrenzung zu einer gleichzeitigen Bestätigung (`complete_job` sperrt dieselbe Zeile) bleibt also wie bisher.
3. `my_jobs` gibt der Firma nur das Boolean: ja. Neue Spalte `under_review boolean` (R gesetzt und S leer), kein Zeitpunkt, kein Text, keine Kundendaten; Geldspalten wie bisher nur `total_cents` und `payout_cents` der eigenen Firma. `can_start` nutzt „R leer“ statt „nicht under_review“ (Planwortlaut): gleichwertig, weil S nur zusammen mit einem Endstatus gesetzt wird (0062:881-891, 926-935), und deckungsgleich mit der Sperre in `start_job`.
4. `my_report_info` nur für den Eigentümer: ja. `customer_id = uid`, sonst `not_found` (auch für Firmen und fremde Kunden, kein Unterschied zu „gibt es nicht“). anon ohne EXECUTE (Zeile 62), ohne Anmeldung zusätzlich `not_found`. Rückgabe nur `can_report` und `report_until` (null, wenn nicht meldbar); keine Sperre, nur lesend.
5. Rechte: `private.report_gate` für alle entzogen (Zeile 22), nur der Eigentümer der aufrufenden Definer-Funktionen führt sie aus. `private.change_gate` behält den Entzug aus 0040:327 (create or replace). `my_jobs` (neu angelegt) und `my_report_info`: Entzug für alle und anon, Ausführung für authenticated (Zeilen 62-63, 171-172, wie 0057:51-52). `decide_change` (0062:1042-1043, nur service_role), `delete_account` (0052:85-86, nur service_role), `start_job` und `complete_job` (0032:112-113), `report_not_done` (0042:149-150) behalten ihre Rechte, weil Signatur und Rückgabetyp gleich bleiben. service_role behält bei `my_jobs` und `my_report_info` die Ausführung aus den Vorgabe-Rechten des Schemas public; ohne Nutzer-ID enden beide in `not_found`.
6. Sperrreihenfolge: unverändert. `change_gate` Auftrag `for update` (Zeile 188), dann Firma `for share` (Zeile 190); `decide_change` Auftrag, Firma, Revision (Zeilen 223-225); `delete_account` nur das Profil; `report_gate` und `my_report_info` sperren nichts. Keine neue Sperre, keine neue Reihenfolge.
7. Keine Gebührensicht für Kunden: ja. `my_report_info` und `report_not_done` geben kein Geld zurück, `decide_change` weiter nur den Text des Ergebnisses; keine Rechte an Tabellen, kein RLS und keine Spalte geändert.

Weiter geprüft
- Alle Definer-Funktionen mit `search_path = ''`, alle Objekte mit Schema genannt. Keine Seed-Daten, keine Secrets.
- Aufrufer von `change_gate` in der gültigen Fassung: `propose_change_basis` (0058:61), `propose_change` (0041:17), `cancel_by_partner_basis` (0062:761), `cancel_by_partner` (0062:789). Für die Absage ändert sich der Fehlercode nicht (`partner_cancel_check` warf `under_review` schon direkt nach dem Gate, 0059:26); neu gesperrt ist der Nachtrag. Kein lesender Weg der Firma läuft über das Gate (`my_job_changes` 0058:6-47 nicht).
- Z2 hat einen Ausgang: admin `complete` oder Storno (0062:881-887, 903-935); Z4: `dismiss_report` oder Storno (0062:889-891). Danach ist S gesetzt, `under_review` in `my_jobs` falsch und das Konto löschbar.
- Fehlercode `under_review` ist in den Edge Functions auf 409 gelegt (`supabase/functions/_shared/jobs/handlers.ts:43`). Signaturen der Art-A-Funktionen bleiben gleich, aus der Migration folgt kein Zwang zum Neu-Deploy.
- `drop function public.my_jobs()` (Zeile 122): kein anderes Datenbankobjekt hängt daran (Suche in `supabase/`: nur 0057 und die erzeugten Typen).

## Stichproben (selbst nachgeschlagen)

- `supabase/migrations/20261108150000_0032_job_flow.sql:4-24` – `start_job` Vorfassung, Rumpf gleich bis auf 0064:83. In Ordnung.
- `supabase/migrations/20261108150000_0032_job_flow.sql:112-113` – Rechte `start_job`, `complete_job` (authenticated, nicht anon). In Ordnung.
- `supabase/migrations/20261109150000_0043_s9g_abnahme.sql:4-31` – `complete_job` Vorfassung. In Ordnung.
- `supabase/migrations/20261109150000_0043_s9g_abnahme.sql:43-49` – Reihenfolge der Meldeprüfungen, gleich 0064:11-17. In Ordnung.
- `supabase/migrations/20261109140000_0042_completion.sql:149-150` – Rechte `report_not_done`. In Ordnung.
- `supabase/migrations/20261112100000_0057_my_jobs.sql:5-52` – `my_jobs` Vorfassung und Rechte. In Ordnung.
- `supabase/migrations/20261109120000_0040_change_orders.sql:303-327` – `change_gate` Vorfassung, Sperrreihenfolge, Entzug. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:606-676` – `decide_change` Vorfassung. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:1042-1043` – Rechte `decide_change` (nur service_role). In Ordnung.
- `supabase/migrations/20261110120000_0054_s9h4_abnahme.sql:42-92` – `delete_account` Vorfassung. In Ordnung.
- `supabase/migrations/20261110100000_0052_account_deletion.sql:85-86` – Rechte `delete_account` (nur service_role). In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:881-891, 926-935` – S wird nur mit Endstatus gesetzt. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:761-762, 789-791` – Absage: Gate, danach `partner_cancel_check`. In Ordnung.
- `supabase/migrations/20261112120000_0059_partner_cancel_preview.sql:19-30` – `partner_cancel_check` wirft `under_review` zuerst. In Ordnung.
- `supabase/migrations/20261112110000_0058_my_job_changes.sql:54-71` – `propose_change_basis` ruft das Gate zuerst. In Ordnung.
- `supabase/migrations/20261029141616_0001_foundation.sql:12-14` – Schema `private`: für alle entzogen, Nutzung nur authenticated. In Ordnung.
- `supabase/migrations/20261109210000_0049_admin_correct.sql:13` – Check „entschieden nur, wenn gemeldet“. In Ordnung.
- `supabase/migrations/20261110120000_0054_s9h4_abnahme.sql:7-21` – Sperre gelöschter Profile gilt nur für `profiles`, nicht für die Meldung. Grundlage für N1.
- `supabase/functions/_shared/jobs/handlers.ts:43` – `under_review` → 409. In Ordnung.
- `tests/rls/report-flow.test.ts:89, 117` – anon gegen `my_report_info` erwartet 42501. In Ordnung.
- `tests/rls/report-flow.test.ts:96-103, 141-142` – Proben für Start, Abschluss, Nachtrag und Löschen in Z2 und Z4 vorhanden. In Ordnung (nur Vorhandensein geprüft).

Offene Findings hoch: 0
