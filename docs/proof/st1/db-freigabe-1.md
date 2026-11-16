Modell: claude-fable-5-2

# DB-Freigabe 1 für Schritt st1

Datum: 2026-11-16
Umfang: Antrag `tmp/proof/st1/db-antrag-1.json` (eine Datei), Migration 0065 vollständig gelesen (98 Zeilen), gegen den Plan `tmp/proof/st1-plan.md` (Teilfragen a bis d) und gegen die Vorfassungen 0059 (`call_out_eligible`), 0060 (`job_contact`, `partner_cancel_fee_due`), 0037 (`job_photo_list`), 0030 (`assignment_access`) geprüft. Regeln: `.claude/rules/daten.md`, `.claude/rules/geld.md`. Entscheidungen Nr. 148 und Nr. 154 in `docs/ENTSCHEIDUNGEN.md:154, 160` nachgelesen.

SHA256: 1b39103d8fbd42eed06f690192dd7b76174e281a09b7f18d4f81e7283fddfa07 supabase/migrations/20261115233507_0065_pauschale_ab_termin.sql

Urteil: frei

Grenzen der Prüfung
- Der Hash ist aus dem Antrag abgeschrieben. Ich habe kein Werkzeug, um ihn selbst zu berechnen; den Abgleich mit der Datei macht das Gate.
- Meine Planentscheidung liegt nicht als Datei vor (unter `tmp/proof/` gibt es nur `st1-plan.md`). Geprüft habe ich gegen die vier Punkte aus dem Auftrag (eigene Funktion `partner_data_access`, `admin_correct` unberührt, `termin_at` NOT NULL, Restpunkte). Welche Restpunkte die Entscheidung im Wortlaut nannte, kann ich nicht abgleichen; unten steht, was ich zu Teilfrage d selbst nachgeschlagen habe.
- Die Rümpfe habe ich Zeile für Zeile gelesen und verglichen, nicht mit einem Diff-Programm.
- Rechte habe ich aus den Migrationen abgeleitet, nicht an der Datenbank abgefragt (die Migration ist noch nicht angewendet).
- Die Testdateien habe ich nur nach den Rechte- und Sperrproben durchgesehen, nicht abgenommen. Mail-Vorlagen an die Firma und die App habe ich nicht geprüft.

## Findings

### hoch
Keine.

### mittel
Keine.

### niedrig
- N1 `supabase/migrations/20261115233507_0065_pauschale_ab_termin.sql:46` – `if not private.partner_data_access(...)` ließe bei einem NULL-Ergebnis durch (in plpgsql zählt NULL als falsch, der Abbruch bliebe aus). Heute kann die Funktion kein NULL liefern (siehe Prüffrage 4), und das Muster stand schon in 0060:33. Die ganze Sperre hängt aber jetzt an dieser einen Zeile. – Fix bei der nächsten Änderung an `job_contact`: `is not true` statt `not`. Kein Grund, den Push aufzuhalten.
- N2 `tests/rls/job-contact-after-cancel.test.ts:74-82, 168, 173` – Der Kundenstorno wird nachgestellt (Trigger aus, direktes UPDATE der Zuordnung, Journalzeile über `commission_book`), nicht über `cancel_by_customer` ausgelöst. Dass der echte Weg dieselben Werte schreibt, folgt nur aus dem Lesen (0062:736-741). Der Weg `admin_correct` nach Abschluss (0062:928-932 stellt `completed` auf einen Storno um) hat keine Probe für die neue Sperre. – Fix: eine Probe mit echtem kostenlosem `cancel_by_customer` (Kontakt und Fotos danach gesperrt) und eine mit `admin_correct` `cancel_customer` ohne Gebühr nach Abschluss. Kein Grund, den Push aufzuhalten.

Hinweis (kein Finding der Migration): Die Sperre wirkt auf neue Abrufe. Schon ausgestellte signierte Foto-Adressen gelten bis zu 600 Sekunden weiter (`supabase/functions/_shared/photo/db.ts:7`), und Kontaktdaten, die die Firma vor dem Storno gelesen hat, kennt sie. Das lässt sich in der Datenbank nicht ändern.

## Prüffragen

1. `job_contact` gleich der Vorfassung bis auf die gewollte Änderung: ja. 0065:34-54 gegen 0060:21-46: Signatur, Rückgabetabelle, Sprache, `security definer`, `search_path = ''`, Deklarationen und die Prüfungen Anmeldung, aal2, Firma (0065:42-45 = 0060:29-32) gleich. 0065:46 ersetzt 0060:33-38 (Fenster plus Sperre nur nach Firmenstorno) durch den einen Aufruf. Fehlercode bleibt `not_assigned`, die Prüfung steht weiter vor der Audit-Zeile. Audit-Zeile und Abfrage (0065:47-52 = 0060:39-44) gleich. Für den Firmenstorno ist das Ergebnis dasselbe wie vorher; neu gesperrt ist nur der Kundenstorno ohne Pauschale.
2. `job_photo_list` gleich der Vorfassung bis auf die gewollte Änderung: ja. 0065:57-98 gegen 0037:73-114: Signatur mit Vorgabewerten, Rückgabetabelle, `stable`, `security definer`, `search_path = ''`, Deklarationen, Zweig `open` (0065:76-80 = 0037:92-96) und Kundenzweig (0065:89-96 = 0037:105-112) gleich. Geändert ist nur 0065:81 (`partner_data_access` statt `assignment_access`, gleiche Argumente). 0037 ist die jüngste Vorfassung (davor nur 0035:330).
3. Rechte: in Ordnung.
   - `private.partner_data_access` (neu): Ausführung für alle, anon und authenticated entzogen (0065:31), wie `partner_cancel_fee_due` (0060:18). Im Schema `private` gibt es keine Vorgabe-Rechte (keine solche Anweisung in den Migrationen), und Nutzung des Schemas hat nur authenticated (0001:13-14). Aufrufer sind nur die beiden Definer-Funktionen; in keiner Policy verwendet, also braucht keine Rolle das Recht. Probe vorhanden (`tests/rls/job-contact-after-cancel.test.ts:128, 160`).
   - `private.call_out_eligible`: `create or replace` mit gleicher Signatur und gleichem Rückgabetyp behält den Entzug aus 0059:16.
   - `public.job_contact`: behält 0060:48-49 (authenticated, nicht anon). `public.job_photo_list`: behält 0035:416-426 (nur service_role).
   - Alle vier Funktionen `security definer` mit `search_path = ''`; alle Objekte mit Schema genannt (`public`, `private`, `auth`, `storage`). `private.assignment_access` bleibt unverändert (0030:87-98).
4. NULL-Sicherheit: in Ordnung.
   - `call_out_eligible` (0065:13-17): drei Glieder, keines kann NULL sein (`is not distinct from`, zweimal `coalesce(..., false)`). Grund NULL, unbekannte Anfrage, Termin in der Zukunft: false. `termin_at` ist NOT NULL (0018:114, keine spätere Lockerung), das `coalesce` fängt also nur die fehlende Anfrage. Die Aufrufer prüfen mit `is true` und `is not true` (0059:40, 0062:766).
   - `partner_data_access` (0065:24-28): `assignment_access` ist ein `exists` (nie NULL, bei NULL-Argumenten false), das innere `exists` ebenso, `partner_cancel_fee_due` ist ein Aggregat ohne Gruppe mit `coalesce` (0060:10, immer genau eine Zeile, nie NULL). Fehlt die Einstellung `partner_access_days`, bricht `setting_num` ab (fail closed). In `job_photo_list` fiele ein NULL in den Zweig `not_found`; in `job_contact` siehe N1.
   - Grenze: `termin_at <= now()` passt zu den Nachbarn (`now() >= termin_at` in 0059:28 und 0062:692, 722). Genau zum Terminbeginn gilt „ab Termin“ überall gleich.
5. Keine Schreibwirkung: ja. Die Migration enthält drei `create or replace function`, ein `create function` und einen Rechteentzug. Keine Tabelle, keine Spalte, keine Policy, kein Trigger, keine Daten, kein Seed, kein Secret. `call_out_eligible` und `partner_data_access` sind `stable` und lesen nur. `job_contact` schreibt wie bisher nur die Audit-Zeile, und nur bei erlaubtem Abruf. Keine neue Sperre, keine neue Sperrreihenfolge.
6. Teilfrage a (eigene Funktion): umgesetzt wie geplant. `assignment_access` bleibt für die Listing-Policy (0038:232), `my_jobs` (0064:166) und `my_job_changes` (0058:44) unverändert; diese drei liefern weder Name, Adresse, Kontakt noch Fotopfade (0064:124-142, 0058:7-19). Wahrheitstabelle: laufend oder abgeschlossen = Fenster; Storno mit Pauschale = Fenster; Storno ohne Pauschale = gesperrt.
7. Teilfrage b (`admin_correct` unberührt): richtig. Die Migration ändert die Funktion nicht. Sie braucht es auch nicht: Der Admin-Storno setzt `ended_reason` auf den Storno-Wert, auch nach Abschluss (0062:928-932), und bucht die Gebührenzeile auf dieselbe Firma (0062:874, 937-940). Ohne Gebühr ist der Zugriff damit sofort gesperrt, mit Gebühr gilt das Fenster ab dem ursprünglichen Ende, nach `negate_fee` (0062:893-901) ist er gesperrt. Das entspricht Nr. 154. `admin_correct` nutzt `call_out_base` direkt (0062:916); Nr. 148 hält trotzdem, weil der Admin-Storno erst ab Termin oder nach einer Meldung möglich ist (0062:907) und die Meldung selbst erst ab Termin (0064:16).
8. Teilfrage c (`termin_at`): siehe 4. Mehr als `termin_at <= now()` mit `coalesce` braucht es nicht.
9. Teilfrage d (weitere Lesewege der Firma nach Storno ohne Pauschale): keiner gefunden. Kontakt liest außer `job_contact` nur `admin_contact` (0032:108); die Policy auf `request_contacts` lässt nur den Kunden zu (0018:221-224), die auf `service_requests` nur Kunde und admin (0001:305-306). `job_photos` ist für Konten nicht lesbar (0035:64-66), der Bucket der Kopien hat keine Policy für angemeldete Nutzer, signiert wird nur nach `job_photo_list` (`supabase/functions/_shared/photo/db.ts:66-70`). Rest: der Hinweis oben (schon ausgestellte Adressen, schon Gelesenes).
10. Geld: Vor dem Termin ist die Grundlage 0 (0062:766), ein Aufruf mit Belegen endet in der Datenbank in `call_out_not_allowed` (0059:40) und in der Edge Function schon vorher in 409 ohne Buchung (`supabase/functions/_shared/cancel/partner.ts:69-70`). Wechselt die Zeit zwischen Vorschau und Buchung über den Terminbeginn, scheitert der Abgleich des Betrags (0062:793), nichts wird gebucht. Beträge, Rundung und Staffel sind nicht berührt; keine neue Sicht auf die Gebühr für Kunden (`my_cancel_info` unverändert).
11. Edge Functions: Signaturen und Rückgabetypen bleiben gleich, aus der Migration folgt kein Zwang zum Neu-Deploy (`daten.md`, Datenbank-Weg, letzter Punkt).

## Stichproben (selbst nachgeschlagen)

- `supabase/migrations/20261112120000_0059_partner_cancel_preview.sql:7-16` – `call_out_eligible` Vorfassung und Entzug; 0065:13, 15-17 gleich, neu nur Zeile 14. In Ordnung.
- `supabase/migrations/20261112120000_0059_partner_cancel_preview.sql:28, 40` – Zeitgrenze der Gründe und `call_out_not_allowed`. In Ordnung.
- `supabase/migrations/20261113100000_0060_job_contact_after_cancel.sql:7-18` – `partner_cancel_fee_due`, nie NULL, Entzug für alle Rollen. In Ordnung.
- `supabase/migrations/20261113100000_0060_job_contact_after_cancel.sql:21-49` – `job_contact` Vorfassung und Rechte. In Ordnung.
- `supabase/migrations/20261108200000_0037_s9d_abnahme.sql:73-114` – `job_photo_list` Vorfassung. In Ordnung.
- `supabase/migrations/20261108180000_0035_job_photos.sql:64-66, 416-426` – `job_photos` nicht lesbar für Konten; `job_photo_list` nur service_role. In Ordnung.
- `supabase/migrations/20261108130000_0030_job_listings.sql:5` – Enum-Werte `cancelled_by_customer`, `cancelled_by_partner` vorhanden. In Ordnung.
- `supabase/migrations/20261108130000_0030_job_listings.sql:64` – höchstens eine aktive Zuordnung je Auftrag. In Ordnung.
- `supabase/migrations/20261108130000_0030_job_listings.sql:87-98` – `assignment_access` unverändert, einzige Definition. In Ordnung.
- `supabase/migrations/20261029141616_0001_foundation.sql:12-14` – Schema `private`: für alle entzogen, Nutzung nur authenticated. In Ordnung.
- `supabase/migrations/20261101190000_0018_revisions_contacts.sql:114` – `termin_at timestamptz not null`. In Ordnung.
- `supabase/migrations/20261101190000_0018_revisions_contacts.sql:216-224` – `request_contacts` nur für den Kunden lesbar. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:736-741` – Kundenstorno: `ended_reason`, Gebührenzeile `cancellation_fee` auf die Firma nur bei Basis > 0. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:766, 792-793` – Grundlage und Abgleich des Betrags beim Firmenstorno. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:329-345` – `cancel_reverse_all` bucht nur `booking` und `change` zurück, die Summe der Pauschale bleibt unberührt. In Ordnung.
- `supabase/migrations/20261114100000_0062_fee_schedule.sql:893-901, 907, 916, 928-940` – `admin_correct`: Gegenbuchung, Zeitgrenze, Basis, Umstellen der Zuordnung, Gebührenzeile. In Ordnung, Grundlage für Prüffrage 7 und N2.
- `supabase/migrations/20261115104122_0064_report_flow.sql:124-142, 166` – `my_jobs` ohne Kundendaten, weiter `assignment_access`. In Ordnung.
- `supabase/migrations/20261112110000_0058_my_job_changes.sql:7-19, 44` – keine Kontakt- oder Pfadspalte, weiter `assignment_access`. In Ordnung.
- `supabase/functions/_shared/photo/db.ts:7, 66-70` – Signatur nur nach `job_photo_list`, Dauer 600 Sekunden. Grundlage für den Hinweis.
- `supabase/functions/_shared/cancel/partner.ts:52-54, 69-70` – Belege und gezeigter Betrag gehören zusammen; Grundlage 0 mit Belegen endet ohne Buchung. In Ordnung.
- `tests/rls/job-contact-after-cancel.test.ts:94, 133` – Pauschale vor dem Termin erwartet `call_out_not_allowed`. In Ordnung (nur Vorhandensein geprüft).
- `tests/rls/job-contact-after-cancel.test.ts:127-128, 159-160` – Direktaufruf beider privaten Funktionen als authenticated erwartet 42501. In Ordnung.
- `tests/rls/job-contact-after-cancel.test.ts:168-178, 186-193` – Kundenstorno kostenlos gesperrt, mit Pauschale im Fenster, danach gesperrt (nachgestellt, siehe N2).
- `tests/rls/cancellation-partner-preview.test.ts:129-130, 146, 148, 175` – Proben vor und ab Termin, NULL-Grund, Direktaufruf als service_role erwartet 42501. In Ordnung (nur Vorhandensein geprüft).
- `docs/ENTSCHEIDUNGEN.md:154, 160` – Nr. 148 und Nr. 154 im Wortlaut; die Migration setzt beide um. In Ordnung.

Offene Findings hoch: 0
