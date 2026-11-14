Modell: claude-fable-5-2

# Nachtragsprüfung Migration 0061 (Kennung 7c2-1311-c)

Datum: 2026-11-13
Branch: `s9i-7c2`, Stand 6394a49
Umfang: `supabase/migrations/20261113110000_0061_accept_basis_cast.sql` (ganz), Vorgänger 0031:85-109 und 242-247, 0034:24-49, 0038:262-277 und 359-384, `tests/rls/listings.test.ts:1-237`, `tests/rls/rls.test.ts:484-507`, `tests/support/owner.ts` (ganz), `supabase/functions/_shared/jobs/db.ts` (ganz), `supabase/functions/_shared/jobs/handlers.ts:18-123`, beide 0061-Logs, `tmp/proof/s9i-7c2-migration-ende.log`.

**Ergebnis: 0061 ist inhaltlich abgenommen.** Die Migration entspricht Auflage 1 aus `tmp/proof/s9i-7c2-fable-fund-1.md`. Kein Fund der Schwere hoch. Zwei Punkte der Schwere mittel betreffen Verfahren und fehlende Nachweise, nicht das SQL.

Grenzen der Prüfung: Ich habe nur Lese- und Suchwerkzeuge, keinen Zugriff auf die Dev-Datenbank und keine Shell. Den Vergleich der beiden Fassungen habe ich Zeile für Zeile am gelesenen Text gemacht, nicht mit einem Byte-Vergleich. Den Zustand der Funktion auf Dev (Rumpf, ACL) habe ich nicht abgefragt; die Aussagen zu den Rechten folgen aus den Migrationen.

## Findings

### hoch

Keine.

### mittel

**M1 – Verfahren: Push und Branch-Commit vor Prüfung des vollen SQL**
- `supabase/migrations/20261113110000_0061_accept_basis_cast.sql:4-29` – Die Migration lief per `db:push` auf Dev und liegt in Commit 6394a49, bevor mir das volle SQL vorlag. Auflage 8 des Fund-Berichts verlangte die Abnahme von 0061 und Test vor dem Commit.
- Einordnung: Auflage 3 desselben Berichts setzte den Push für das Grün-Log voraus, und Auflage 1 legte den Inhalt fest. Der Schaden ist null: nur Dev, nur `create or replace` einer lesenden Funktion, Inhalt wie verlangt, Branch nicht gemergt.
- Fix: Mit diesem Nachtrag ist die Prüfung des SQL nachgeholt. Künftig geht das volle SQL jeder Migration, die eine SECURITY-DEFINER-Funktion anlegt oder ersetzt, vor `db:push` an den Berater. Der Vorfall gehört in `docs/PROGRESS.md` und in den Bericht an Beks. Kein Merge nach main vor M2.

**M2 – Nachweise nach dem Push fehlen (Auflage 6)**
- `tmp/proof/s9i-7c2-migration-ende.log:1` – Die Datei nennt 60 Einträge und als letzte Migration 20261113100000, also den Stand vor 0061. Im Ordner liegen 61 Migrationen. Eine Liste mit 0061 (61 Einträge, lokal gleich remote) gibt es nicht.
- `tmp/proof/s9i-7c2-0061-gruen.log:2-4` – Der Grün-Lauf deckt nur `listings.test.ts` ab. Der Rechte-Test `tests/rls/rls.test.ts:494-498` ist nach 0061 nicht belegt, ebenso wenig `db:types` ohne Diff, `test:rls` komplett und `check`.
- Folge: Dass `anon` und `authenticated` die Funktion auf Dev nicht aufrufen können, ist aus den Migrationen hergeleitet, aber nach 0061 nicht gemessen.
- Fix: Migrationsliste neu aufnehmen, `db:types` (erwartet: kein Diff, `database.types.ts:1857` bleibt `number`), `test:rls` komplett, `check`. Jeder Lauf schreibt in eine neue Datei mit `EXIT=`. Vorher kein Merge.

### niedrig

**N1 – Positivfall läuft als Eigentümer, nicht als service_role**
- `tests/rls/listings.test.ts:187` – Der Schritt „Basis“ hat kein `as`, `probes` nimmt dann den Eigentümer (`tests/support/owner.ts:95`). Auflage 2 verlangte den Aufruf als service_role.
- Einordnung: Das EXECUTE-Recht für service_role ist trotzdem gemessen. Die Schritte in `listings.test.ts:188-189` laufen als service_role und erreichen den Rumpf (`not_found`, `offer_required`); ohne Recht käme 42501. Der Rumpf läuft als SECURITY DEFINER in beiden Fällen mit denselben Rechten.
- Fix: `as: 'service_role'` am Schritt „Basis“ ergänzen. Liest service_role die Unterabfragen auf `price_revisions` nicht, kommen die IDs wie in Zeile 199 per `set_config` aus dem Setup.

**N2 – Ein Sammel-Boolean statt Einzelwerten**
- `tests/rls/listings.test.ts:187` – Weicht später ein Feld ab, meldet der Test nur „= false“ und nicht, welches. Die Wirkung ist gemessen, die Diagnose ist schwächer.
- Fix (kann warten): Zeile als Text zurückgeben und mit dem erwarteten Text vergleichen.

**N3 – Grün-Log ohne Testnamen**
- `tmp/proof/s9i-7c2-0061-gruen.log:2-4` – Das Log enthält nur Summen. Dass der neue Test dabei ist, folgt aus der Zahl: 14 bestanden, das Rot-Log nennt für dieselbe Datei 1 fehlgeschlagen und 13 übersprungen (`tmp/proof/s9i-7c2-0061-rot.log:9`).
- Fix: Kein Eingriff in die Datei. Der Volllauf aus M2 nennt die Testnamen (Reporter mit Namen).

**N4 – Lauf ohne Exit-Code (außerhalb des Auftrags, für die Abnahme)**
- `docs/proof/s9i-7c2/s9i-7c2-flow-run-4.log:24-25` – Die Suche nach einer `EXIT=`-Zeile hat in dieser Datei keinen Treffer, nur die Summen. Ich habe die Datei nicht ganz gelesen.
- Fix: Datei nicht ändern. Der abschließende Lauf von `flow-live` schreibt in eine neue Datei mit `EXIT=`.

## Prüffragen

### 1. Wortgleichheit mit 0038:359-384

Bestätigt. Zuordnung der Zeilen:

| 0038 | 0061 | Ergebnis |
|---|---|---|
| 359-381 | 4-26 | gleich |
| 382 | 27 | geändert |
| 383-384 | 28-29 | gleich |

Zeilen-Diff:

```
0038:382  -  return query select rev.id, rev.total_cents, f.fee_rate, f.fee_vat_rate, f.fee_rate_version, f.fee_vat_rate_version;
0061:27   +  return query select rev.id, rev.total_cents::bigint, f.fee_rate, f.fee_vat_rate, f.fee_rate_version, f.fee_vat_rate_version;
```

Sonst nur: 0061:1-2 neuer Kopfkommentar, 0061:3 Leerzeile; der Abschnittskommentar 0038:358 ist nicht übernommen. Signatur, Rückgabetabelle, `stable`, `security definer` und `search_path` sind gleich (0038:359-361, 0061:4-6). Die Datei enthält kein `drop`, kein `grant`, kein `revoke`, keine Spaltenänderung und keinen Seed.

### 2. Rechte

- 0031:242-244 entzieht alles für `public`, `anon` und `authenticated`. 0031:245-247 gibt EXECUTE nur an service_role.
- 0034:24, 0038:359 und 0061:4 sind `create or replace` mit gleicher Argumentliste und gleicher Rückgabetabelle. Das ersetzt den Rumpf und behält Eigentümer und ACL.
- In `supabase/` nennen nur 0031, 0034, 0038 und 0061 die Funktion. Es gibt kein `drop function` für sie, kein `alter default privileges` und kein Sammel-Grant auf alle Funktionen eines Schemas.
- 0061 ändert an den Rechten nichts. `anon` und `authenticated` können die Funktion nicht aufrufen, auch nicht über den RPC-Pfad der API.
- SECURITY DEFINER mit `set search_path = ''`: 0061:6. Alle Namen sind voll qualifiziert: `public.job_listings`, `public.service_requests`, `public.price_revisions` (0061:9-11, 14, 18, 24), `public.partner_members` (0061:15), `private.in_scope` (0061:23), `private.current_fee` (0061:26). `now()` kommt aus `pg_catalog`.
- `private.current_fee` ist ebenfalls SECURITY DEFINER mit leerem `search_path` (0038:263) und für `public` entzogen (0038:277). Unverändert.
- Gemessen wird das in `tests/rls/rls.test.ts:486` und `494-498`. Der Lauf nach 0061 fehlt (M2).

### 3. Geld und Sicherheit

- **Cast:** `price_revisions.total_cents` ist `int` (0018:19) und bei Festpreis größer null (0018:27). `int` nach `bigint` ist verlustfrei, es wird nicht gerundet. Null fängt 0061:25 vorher ab.
- **App-Seite:** `db.ts:33` wandelt mit `Number()`. Der Wertebereich von `int` liegt weit unter der sicheren Ganzzahlgrenze von JavaScript.
- **Rechenweg:** Die Aufteilung rechnet weiter allein `splitFee` (`handlers.ts:100`) mit dem Satz aus der Basis. `partner_accept` prüft Satz und Beträge erneut. Daran ändert 0061 nichts.
- **Kein neuer Lesepfad.** Die Funktion ruft nur service_role auf. `p_actor` stammt in der Edge Function aus dem geprüften Token (`db.ts:15-24`, `handlers.ts:98`), aal2 ist Pflicht (`handlers.ts:53-58`, `90`).
- **Fremde Firma:** Ein Listing einer anderen Firma und ein nicht vorhandenes Listing liefern dasselbe `not_found` (0061:15-17). Es gibt kein Orakel zum Aufzählen.
- **Antwort der Function:** `accept` gibt weder Gesamtpreis noch Gebühr zurück, nur `assignmentId` oder einen Fehlercode (`handlers.ts:104`, `119`, `121`).
- **Kunden:** Kunden ohne Partner-Konto scheitern an der Mitgliedsprüfung. Die Gebühr bleibt für sie unlesbar.
- **Neu ist nur:** Der Erfolgsweg der Annahme läuft jetzt wirklich durch. Die Sperren dahinter (Revision, Auszahlung, Firmenstatus, Limit, Zuständigkeit) liegen in `partner_accept` und sind in `listings.test.ts:138-236` getestet.

### 4. Test

Ja, der Test misst die Wirkung.

- `listings.test.ts:187` verlangt genau eine Zeile mit der Revision des Auftrags, `total_cents = 68961`, Satz und USt.-Satz aus `platform_settings` und beiden Versionen. Die Erwartungswerte kommen unabhängig aus `rates()` (`listings.test.ts:10-20`).
- `listings.test.ts:188` und `193`: fremde Firma liefert `not_found`. `listings.test.ts:189` und `194`: Auftrag ohne Festpreis liefert `offer_required`.
- Rot-Log: `tmp/proof/s9i-7c2-0061-rot.log:4-7` zeigt als Ist-Wert `42804: structure of query does not match function result type` gegen erwartet „= true“, `EXIT=1` (Zeile 10). Das ist der Fehler selbst, nicht nur ein fehlgeschlagener Schritt. Laut Kopfzeile lief er vor der Migration.
- Grün-Log: `tmp/proof/s9i-7c2-0061-gruen.log:2-4`, 14 von 14, `EXIT=0`.
- Beide Logs liegen auch unter `docs/proof/s9i-7c2/`.
- Schwächen: N1, N2, N3.

## Stand der Auflagen aus dem Fund-Bericht (soweit hier geprüft)

| Auflage | Stand |
|---|---|
| 1 Inhalt 0061 | erfüllt |
| 2 Test | erfüllt bis auf N1 |
| 3 Rot vor Push, Grün danach, Logs in `docs/proof` | erfüllt |
| 5 DIAG-Zeile entfernt | erfüllt (kein Treffer in `tests/`) |
| 6 Volläufe nach dem Push | offen (M2) |
| 7 Doku | nur `docs/ARCHITECTURE.md:149` gesehen (0061 genannt), Rest nicht geprüft |
| 8 Abnahme vor dem Commit | verletzt (M1), SQL-Teil hiermit nachgeholt |

## Stichproben

| Datei:Zeile | Ergebnis |
|---|---|
| `supabase/migrations/20261113110000_0061_accept_basis_cast.sql:4-29` | Rumpf wie 0038 bis auf Zeile 27 |
| `supabase/migrations/20261109100000_0038_partner_offers.sql:382` | Rückgabe ohne Cast (Vorgänger) |
| `supabase/migrations/20261108140000_0031_distribute_accept.sql:242-247` | alles entzogen für `public`, `anon`, `authenticated`; EXECUTE nur service_role |
| `supabase/migrations/20261108170000_0034_s9c_abnahme.sql:24-26` | `create or replace`, gleiche Signatur, kein Grant |
| `supabase/migrations/20261109100000_0038_partner_offers.sql:262-277` | `current_fee`: DEFINER, leerer `search_path`, für `public` entzogen, wirft `setting_missing` |
| `supabase/migrations/20261101190000_0018_revisions_contacts.sql:19` | `total_cents int` |
| `supabase/migrations/20261101190000_0018_revisions_contacts.sql:27` | Festpreis größer null |
| `supabase/` (Suche nach Sammel-Grants und Default-Rechten) | kein Treffer |
| `supabase/migrations/` (Suche nach `drop function` der Annahme-Funktionen) | kein Treffer |
| `tests/rls/listings.test.ts:182-195` | Wirkung gemessen, Positivfall als Eigentümer |
| `tests/support/owner.ts:95-100` | ohne `as` läuft der Schritt als Eigentümer |
| `tests/rls/rls.test.ts:486, 494-498` | Rechte-Test nennt `partner_accept_basis(uuid,uuid)` als nur service_role |
| `supabase/functions/_shared/jobs/db.ts:29-38` | Aufruf mit `p_actor` aus dem Nutzerobjekt, `Number()` auf Betrag und Sätzen |
| `supabase/functions/_shared/jobs/handlers.ts:90-104` | aal2, Basis, `splitFee`, Antwort nur `assignmentId` |
| `supabase/functions/_shared/database.types.ts:1849-1859` | `total_cents: number`, passt zu `bigint` |
| `tmp/proof/s9i-7c2-0061-rot.log:4-10` | 42804 als Ist-Wert, `EXIT=1` |
| `tmp/proof/s9i-7c2-0061-gruen.log:2-4` | 14 bestanden, `EXIT=0` |
| `tmp/proof/s9i-7c2-migration-ende.log:1` | 60 Einträge, Stand vor 0061 |
| `docs/proof/s9i-7c2/s9i-7c2-flow-run-4.log:24-25` | 14 bestanden, keine `EXIT=`-Zeile gefunden |
| `docs/ARCHITECTURE.md:149` | 0061 mit Cast vermerkt |

Offene Findings hoch: 0
