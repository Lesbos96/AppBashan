# mail2: Faktenliste und Plan (Kennung mail2-1911-a)

## Fakten (Datei:Zeile, geprüft)
- `supabase/functions/_shared/jobs/db.ts:133-136` `customerEmail`: `const { data } = await db.auth.admin.getUserById(userId); return data.user?.email ?? null`. Der Fehler wird nicht gelesen. Gleiches Muster in `requestCustomerEmail` (`db.ts:141-142`, nur mit Dev-Schutz genutzt).
- Echte Fehlerform live belegt (Probe 2026-11-19, gelöscht): `getUserById` einer Zufalls-ID und von 25 von 25 geprüften Dev-Altzeilen: `AuthApiError`, `status 404`, `code 'user_not_found'`.
- Dev vorher (Outbox, `pending` mit `last_error = no_recipient`): Kunde 205, Firma 251. Übrige: Kunde sent 358, Firma sent 542, Betreiber sent 14, Betreiber failed (expired) 3.
- `handlers.ts:321-325`: Empfänger: `partner` → `row.partnerEmail`, `operator` → `deps.operatorEmail`, sonst `await deps.customerEmail(row.recipientId)`; fehlt er: `throw new Error('no_recipient')`.
- `handlers.ts:289-294` `safeCode`; `handlers.ts:344-354` Fehlerzweig: `failed++`, `mark(id, false, code)`, weiter mit der nächsten Zeile. Es gibt keinen Lauf-Abbruch. `brevo.ts:41`: `permanent` = 4xx außer 429, `status` im `MailError`.
- `handlers.ts:318`: `deps.claim(25)`; `outbox_claim` (0075:14-32) erhöht `attempts` für alle 25 Zeilen schon beim Holen (`status = 'sending'`).
- `0075:40-53` `outbox_mark`: `failed` nur bei `expired` oder `attempts >= 5`; sonst `pending`. CHECK `outbox_last_error_code` (0075:36-38) enthält bereits `no_recipient` (seit 0036), aber kein Code für Kontofehler.
- `0075:6-12` `private.outbox_is_due`: `attempts < 5 and ((pending and (attempts = 0 or claimed_at is null or claimed_at < now() - 15 min × 4^(attempts-1))) or (sending and Lease abgelaufen))`. Cron `outbox-dispatch` jede Minute (0033:25), ruft `outbox_dispatch` (0075:55-69), das die Function nur aufruft, wenn eine Zeile fällig ist.
- `outbox_claim` joined `partners.contact_email` als `partner_email` (0075:29-30). Rechte: 0031:244-247 revoke von public/anon/authenticated, grant nur `service_role`; `create or replace` (0034, 0036, 0075) behält sie. Register `tests/support/positiv.ts:458-462` (Spalten inkl. `partner_email`) und `:464` (`outbox_mark`).
- Inhaber-Konto: `public.partner_members (partner_id, user_id, role partner_role default 'owner', created_at, PK (partner_id, user_id), unique (user_id))`, `0023:40-47`; `register_partner` legt `owner` an (`0023:281`). Rollen: `owner`, `staff` (`0023:12`). `contact_email` bleibt `not null` für die Anzeige (`0023:26`).
- `scripts/setup-outbox.mjs:43-58`: Vorprüfung gegen „echte Adresse wartet“ nutzt für Firmen `p.contact_email`.
- `tests/rls/en-route.test.ts:137-153`: Fälligkeits-Test (`neu`, `alt` mit `claimed_at null`, 14/16 Min., 59/61 Min., 15/17 h, Lease 9/11 Min., 5 Versuche, erledigt).

## Plan
**Migration 0076 (`mail2`)**
1. `drop function public.outbox_claim(int)`, neu anlegen: Rückgabe `partner_email text` entfällt, dafür `owner_id uuid` (Inhaber-Konto der Firma, nur bei `recipient_kind = 'partner'`): `(select m.user_id from public.partner_members m where m.partner_id = u.recipient_id and m.role = 'owner' order by m.created_at, m.user_id limit 1)`. Sonst unverändert (0075). Danach `grant execute on function public.outbox_claim(int) to service_role` (einziger Aufrufer; nach drop plus create ist das Pflicht, `daten.md`). Kein weiterer Grant. Register `positiv.ts` anpassen.
2. CHECK `outbox_last_error_code` um `smtp_account` erweitern (`no_recipient` steht schon darin).
3. `create or replace public.outbox_mark` (Rechte bleiben):
   - `no_recipient` → sofort `failed`, `claimed_at null`, ohne weitere Versuche (wie `expired`).
   - `smtp_account` und nicht `p_ok` → `pending`, `attempts = greatest(attempts - 1, 0)` (der Versuch zählt nicht), `claimed_at = now()`, `last_error = 'smtp_account'`.
   - sonst unverändert (0075).
4. `create or replace private.outbox_is_due`: Fälligkeit `pending and (claimed_at is null or claimed_at < now() - 15 min × 4^greatest(attempts - 1, 0))`. Die Klausel `attempts = 0` (immer fällig) entfällt: neue Zeilen haben `claimed_at null`, zurückgegebene Zeilen warten 15 Minuten. Bestehender Fälligkeits-Test bleibt gültig.

**Edge Function (alle Functions laden `_shared/jobs/*`: accept, admin-contact, offer-confirm, outbox-send und weitere laut STAND)**
- `db.ts`: ein Helfer `accountEmail(db, userId)` für `customerEmail` (umbenannt `accountEmail`) und `requestCustomerEmail`: Fehler `status === 404 && code === 'user_not_found'` → `null` (`no_recipient`); jeder andere Fehler → `throw` (`DbError`, normaler Fehlversuch mit Wiederholung); sonst `data.user?.email ?? null`. `claim` liefert `ownerId` statt `partnerEmail`.
- `handlers.ts`: `partner` → `row.ownerId ? await deps.accountEmail(row.ownerId) : null`. `contact_email` wird nirgends mehr zum Senden gelesen.
- Kontofehler (Brevo 401, 403, 429): der Lauf bricht ab; die Zeile und alle noch nicht versuchten Zeilen des Laufs gehen mit `mark(id, false, 'smtp_account')` zurück (Versuch nicht verbraucht, 15 Minuten Pause, danach genau ein neuer Versuch). `failed` zählt sie nicht; die Antwort trägt `paused: n` und wie bisher `provider`; Log `outbox_account_error` (Status, Kürzel; nie Adresse). Alle anderen Fehler wie bisher.
- Betreiber-Sicht: Log und Antwort (Function-Logs), dazu neues Skript `scripts/outbox-status.mjs` (`npm run outbox`, nur lesen, über dotenv-cli, Dev-Ref geprüft): Zeilen je Status und Code, Anzahl `smtp_account`, älteste wartende Zeile. Gleiches Skript liefert „vorher/nachher“ für die Altzeilen.
- `scripts/setup-outbox.mjs:43-58` (Vorprüfung): Firmen-Adresse aus dem Inhaber-Konto (`auth.users` über `partner_members`) statt `contact_email`.

**Tests (rot zuerst)**
- Unit `outbox-handler.test.ts`: 401/403/429 brechen ab, markieren alle verbleibenden Zeilen `smtp_account`, ein Versand an die Zeile davor bleibt `sent`, keine Adresse im Log, `failed` 0, `paused` n; 4xx sonst und 5xx wie bisher; Firma über `ownerId` und `accountEmail`; kein Inhaber → `no_recipient`; Lesefehler von `accountEmail` → `smtp_error` mit Wiederholung, nur `null` → `no_recipient`.
- Unit neue Datei für `outboxDb.accountEmail` mit Stub-`Db` (404 `user_not_found`, 500, 429, Netzfehler, Erfolg).
- rls `tests/rls/outbox.test.ts`: `no_recipient` → `failed:1:no_recipient` ohne `claimed_at`; `smtp_account` → `pending` mit `attempts − 1`, `claimed_at` gesetzt, nicht fällig, nach 16 Minuten fällig; `outbox_claim` gibt `owner_id` des Inhabers (nicht `contact_email`); Firma ohne Inhaber → `owner_id null`; weiterhin kein Zugriff für authenticated/anon; Register `positiv.ts`.
- Live nach Deploy (`flow-live` W6 bleibt grün; Altzeilen schließt der Cron ab: Anzahl vorher 205/251 (Kunde/Firma), nachher aus `npm run outbox`). Ein echter Brevo-Kontofehler lässt sich in Dev nicht auslösen, ohne den Schlüssel zu ändern (und `DEV_MAIL_GUARD` überspringt Testadressen vor dem Versand): belegt durch Unit- und rls-Tests, nicht live (wird im Bericht gesagt).

**Rest in GOLIVE 48 mit Begründung (neues externes Konto oder Entscheidung nötig):** Alarm per Mail/Pager bei `smtp_account` (Brevo selbst fällt bei Kontofehler aus; braucht Monitoring-Konto), Dokumentierter Weg „erneut senden“ für `failed` (Entscheidung Beks, wann), Kontingent des Brevo-Plans gegen die Menge an Firmen-Mails je Anfrage (Plan, Beks).

## Frage an Fable (eine, gebündelt)
Trägt dieser Plan für Geld und Sicherheit? Konkret: (a) Rechte: `drop`+`create` von `outbox_claim` mit `grant execute … to service_role` als einzigem Grant, Inhaber über `partner_members.role = 'owner'` (deterministisch bei mehreren). (b) Kontofehler-Weg: Rückgabe über `outbox_mark('smtp_account')` mit Versuchszähler − 1 und 15 Minuten Pause, 429 eingeschlossen, ohne neue Funktion. Gibt es einen Weg, auf dem Zeilen dadurch endlos kreisen, still verloren gehen oder ein Betreiber-Mail-Fehlversand entsteht? (c) `no_recipient` nur bei 404 `user_not_found`, jeder andere Lesefehler wiederholt. (d) Ist die Mail an die Anmeldeadresse des Inhaber-Kontos (statt `contact_email`) im Dev-Schutz (`.test`-Endungen) und in `setup-outbox.mjs` sauber abgedeckt? Nenne Auflagen, wenn nötig, und „anhalten“ nur, wenn der Plan so nicht gebaut werden darf.
