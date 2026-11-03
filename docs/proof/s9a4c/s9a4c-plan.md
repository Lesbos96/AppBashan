# Berater: Nachabnahme S9a-4b und Plan S9a-4c

- Datum: 2026-11-03
- Stand: Branch `s9a4c`, HEAD bc07497, Dev-Projekt laut Auftrag. Ich habe keinen Datenbank- und keinen git-Zugang. Dev-Fakten stammen nur aus `tmp/proof/s9a4c-acl.json`.
- Hinweis: In meiner Tool-Liste steht ein eingebautes `advisor`-Tool ohne Parameter. Laut CLAUDE.md habe ich es nicht benutzt.

## Geprüft / Nicht geprüft

**Geprüft (vollständig gelesen):**
- `tmp/proof/s9a4c-diff-4b.patch`, Code-Teil ab `:2617`: `redproof-s9a3.mjs`, `redproof-s9a4.mjs`, `photos.ts`, `uploads.ts`, `FotoUploads.tsx`, `Gesendet.tsx`, `Zusammenfassung.tsx`, `database.types.ts`, Migration 0021, E2E, RLS, Shots und Unit-Tests. Den Doku- und Log-Teil `:1-2616` habe ich nur über die Dateiliste geprüft.
- `supabase/migrations/20261102110000_0020_photo_staging.sql`, vollständig
- `supabase/migrations/20261101170000_0016_settings_admin.sql`, vollständig
- `0001_foundation.sql:1-110`; `0017_status_machine.sql:245-280`; `0018_revisions_contacts.sql:36-77`, `:136-199`
- `src/lib/quote.ts`, `src/lib/uploads.ts`, `src/lib/photos.ts`, jeweils vollständig
- `src/screens/anfrage/Zusammenfassung.tsx:160-304`
- `supabase/functions/_shared/quote/handler.ts:140-180`, `:205-254`, `:290-346`; `supabase/functions/_shared/quote/db.ts:40-164`
- `tmp/proof/s9a4c-acl.json`
- `scripts/redproof-s9a3.mjs:1-140`, `:222-243`; `scripts/redproof-s9a4.mjs:1-172`, `:225-249`, `:466-491`
- `docs/proof/s9a4b/s9a4b-abnahme.md`; `docs/proof/s9a4b/s9a4b-rotbeweis-s9a3.md:95-134`
- `docs/OPEN_ISSUES.md:120-216`; `docs/S9_KONZEPT.md:155-182`, `:284-291`
- `tests/rls/rls.test.ts:60-190`, `:425-448`; `tests/rls/settings.test.ts:1-80`, `:235-354`; `tests/rls/quote.test.ts:70-108`
- `tests/support/owner.ts` (`ownerSql`, `ownerGrantRole`); `tests/e2e/fotos-helpers.ts`, `anfrage-helpers.ts:1-50`, `dienste-helpers.ts`; `scripts/scan-proof.mjs`

**Nicht geprüft:**
- Live-Zustand von Dev über `s9a4c-acl.json` hinaus (keine DB-Abfrage möglich)
- ACL der SECURITY-INVOKER-Funktionen: Die Extraktion enthält nur DEFINER-Funktionen (siehe N-9)
- Kollation von `storage.objects.name` und tatsächliche Pläne der Zählung (N-8 verlangt dafür ein EXPLAIN)
- UI und Shots; OPEN_ISSUES `:216` Punkt (4) (Testzählung 332/364) und Punkt (5) (Seed), beide ohne Geld- oder Sicherheitsbezug
- `parse.ts` vollständig. Gelesen ist nur der Grep auf `photoIds`: v4-UUID, höchstens 50, Datenbank prüft 8.

## Findings

Neue Findings: H-1, M-3, N-8 bis N-12. Aus dem Vorbericht weiter offen: M-1, M-2, N-1 bis N-7. Die Umsetzung steht in Teil d.

### Hoch

**H-1: Selbst-Hochstufung zum Vermieter macht den Gebührensatz für jeden Kunden lesbar**
- Fundstellen:
  - `0016_settings_admin.sql:150-163`: Definition, SECURITY DEFINER
  - `0001_foundation.sql:68-69`: `grant execute … to authenticated`
  - `0016_settings_admin.sql:188-189`: `platform_settings_select` lässt `rental_provider` lesen
  - Dev: `tmp/proof/s9a4c-acl.json:40-48` zeigt `authenticated=X`
- **Problem:** Jedes angemeldete Konto ruft `become_rental_provider()` auf und ist danach `rental_provider`. Das ist dauerhaft, ohne Journal, und das Anlegen eines Kontos hat noch kein Captcha.
  - Mit dem nächsten Request liest das Konto alle Zeilen von `platform_settings`, darunter `fee_rate`, `fee_vat_rate` und `fee_notice_days`.
  - Das verletzt CLAUDE.md, Abschnitt Geld: „Kunden können die Gebühr weder sehen noch per API lesen … Kunden ohne Partner-Konto nichts“.
  - Es verletzt auch `S9_KONZEPT.md:174`: „`rental_provider` bleibt bis dahin eine Rolle ohne Oberfläche und **ohne Selbst-Hochstufung**“. Das Konzept kennt das Risiko als U9 (`:159`), plant die Entfernung aber erst in S9b.
  - Die App ruft die Funktion nicht auf. Ihre einzigen Nutzer sind Test-Setups.
  - Nebenwirkung: Das Konto kann `rental_offers` anlegen (`0001:376`). Die bleiben aber unveröffentlicht bis zur Freigabe.
- **Fix:** Migration 0022 löscht die Funktion. Die Vermieter-Rolle vergibt dann nur noch der Eigentümer über `admin_grant_role`, mit Journal. Zuerst ein Rot-Test, dann der Fix, dann der Rot-Beweis im Redproof. Details in d), Abschnitt 0022.

### Mittel

**M-3: Für die Schreibsperre von `quote_save_request` gibt es keinen Wirkungsbeweis, nur Schichten**
- Fundstellen: `scripts/redproof-s9a3.mjs:238-243`, `:225-230`; `scripts/redproof-s9a4.mjs:474-491`
- **Problem:** `quote_save_request` ist SECURITY INVOKER (`0020_photo_staging.sql:160-162`).
  - Gibt man allein ihr EXECUTE frei, hält die nächste Schicht. Das ist heute das fehlende EXECUTE auf `photo_staging_interval` (`0020:27`). Dahinter folgen RLS auf `platform_settings` (`setting_missing`, `0016:188`) und fehlende INSERT-Rechte auf vier Tabellen.
  - Kein Eintrag in beiden Skripten zeigt, dass eine dieser Sperren eine Anfrage mit selbst gewähltem Preis verhindert. Das ist ein Geldpfad.
  - Dasselbe gilt für `geocode_cache` (`:225`). Dort ist gelockert wie gesperrt keine Zeile sichtbar (0 bzw. `<null>`).
  - Die Einträge sind ehrlich als „Schicht“ benannt. Nach CLAUDE.md zählen sie aber nicht als Rot-Beweis.
- **Fix:** Die Sperre isoliert beweisen. Die inneren Schichten werden nur in der Probe-Transaktion geöffnet (Rollback), und nur die Zielsperre wird umgeschaltet. Code in Antwort c.

**M-1 und M-2 (Vorbericht):** offen, Plan in d.

### Niedrig

**N-8: Die Staging-Zählung durchsucht bei jedem Upload den ganzen Bucket**
- Fundstelle: `0021_photo_limits.sql:39` (Pattern-Vergleich mit Präfix `auth.uid()::text || '/%'`)
- **Problem:** Das Präfix ist erst zur Laufzeit bekannt, als InitPlan-Parameter. Eine Funktion mit SECURITY DEFINER wird nicht eingebettet. Der Planer kann aus einem Pattern ohne Konstante keinen Indexbereich ableiten.
  - Folge: Jede Prüfung der INSERT-Policy liest alle Objekte von `request-photos`, die Kosten wachsen also mit dem Bucket.
  - Das ist der offene „EXPLAIN“-Punkt aus OPEN_ISSUES `:131`, hier konkret.
- **Fix:** Erst das EXPLAIN. Zeigt es einen Filter auf `name` statt einer Index Cond, auf den Bereich `[uid/, uid0)` umstellen (C-Kollation, `'0'` folgt auf `'/'`). Optionaler Teil von 0022.

**N-9: Kein Regressionstest für die Rechte der DEFINER-Funktionen**
- Fundstelle: `tests/rls/*`; die Extraktion `s9a4c-acl.json` ist ein Einzelabzug.
- **Problem:** Nichts schlägt an, wenn eine SECURITY-DEFINER-Funktion EXECUTE für `anon`/`authenticated` bekommt oder ihren festen `search_path` verliert. H-1 wäre damit früh aufgefallen.
- **Fix:** RLS-Test mit Allowlist, Code in d. Er ist vor 0022 rot und danach grün.

**N-10: Die Policy auf `platform_settings` kennt die Rolle `partner` nicht**
- Fundstelle: `0016_settings_admin.sql:188-189`
- **Problem:** CLAUDE.md verlangt: Alle Partner-Konten lesen den Gebührensatz, unabhängig vom Status. Die Policy erlaubt nur `rental_provider` und admin. In Phase 1 gibt es noch keine Partner, darum ist das heute kein Leck.
- **Fix:** In S9b mit dem Partnermodell (`partner_members`) umstellen, inklusive RLS-Test „Partner in jedem Status liest, Kunde nicht“. Eintrag in OPEN_ISSUES.

**N-11: Automatisches Aufräumen (M-2) gegen eine noch laufende Übernahme**
- Fundstellen: `0020:265-275`, `0021:60-70`
- **Problem:** Nach einer verlorenen Antwort kann die Übernahme auf dem Server theoretisch noch laufen, während die App mit neuer Ref die alten Pfade löscht. Die Delete-Policy sieht die noch nicht committete Zeile in `request_photos` nicht. Dann entsteht eine Zeile ohne Datei.
  - Das ist die bekannte Restgrenze aus OPEN_ISSUES `:122` (S9d behandelt eine fehlende Datei als `failed`). M-2 macht den Fall nur minimal häufiger: Die Transaktion dauert Millisekunden, der Kunde ändert Angaben in Sekunden.
- **Fix:** Nur dokumentieren, als Ergänzung in `:122`. Kein Code.

**N-12: Nach verlorener Antwort und geändertem Fotosatz entsteht eine zweite Anfrage**
- Fundstelle: Folge des M-1-Fixes; vgl. OPEN_ISSUES `:192` („Bewusst offen“)
- **Problem:** Die erste Anfrage behält das entfernte Foto. Vor der Annahme sehen Partner es. Der Kunde sieht beide Anfragen unter Aufträge und kann die erste zurückziehen.
- **Fix:** In OPEN_ISSUES eintragen. Später, vor Livegang: Beim Senden mit neuer Ref prüft die App zuerst, ob zur vorherigen, unbestätigten Ref schon eine Anfrage existiert (`service_requests.client_ref`, eigene Zeilen über RLS lesbar). Dann sendet sie nicht, sondern weist auf die vorhandene Anfrage hin.

## Antworten

### a) Nachabnahme S9a-4b (Diff ad1fa75..0bb621c inkl. 0021)

- **0021, Funktion:** Die Bewertung aus dem Vorbericht bestätige ich.
  - `staging_photo_count()` ist SECURITY DEFINER, `stable`, `search_path = ''`, ohne Parameter, uid nur aus `auth.uid()` (`0021:34-41`).
  - Rechte nur `authenticated` (`:43-44`). Auf Dev gilt dasselbe: `acl.json:157-165`, Eigentümer `postgres`, `search_path=""`.
  - Kein Querzugriff: Gezählt wird nur der eigene Ordner, preisgegeben nur eine Zahl.
  - Für anon ist die Zählung 0, anon hat aber ohnehin weder EXECUTE noch eine INSERT-Policy.
  - Neu ist nur N-8 (Leistung).
- **0021, Policies:**
  - INSERT (`0021:46-57`) entspricht 0020 `:79-89` plus Qualifizierung plus Zählung.
  - DELETE (`:60-70`) entspricht 0020 `:91-101` plus Qualifizierung.
  - `alter policy` lässt Rolle und Befehl unverändert. Kein Upsert möglich, weil es keine UPDATE-Policy gibt.
  - Löschen ist nur im eigenen Staging-Ordner möglich, ohne Anfrage zur Ref und ohne Zeile. Übernommene Dateien bleiben also auch für M-2 geschützt.
- **0021, Guard:** Fängt den NULL-Pfad vor NOT NULL ab (`:18`). Der Marker-Zwang bleibt (`:14-16`).
- **Geld:**
  - `photoIds` gehen nicht in Preis oder Snapshot ein (`handler.ts:321-344`). Die Gebühr kommt im Diff nicht vor.
  - Der Server rechnet weiterhin selbst. `shown` dient nur dem 409-Vergleich (`:323`).
  - Der Snapshot enthält `terms`, aber nichts zu `fee_*`.
- **quote, Fotos:**
  - Die Übernahme baut den Pfad aus `p_customer` und `p_client_ref` (`0020:266`). Eine fremde Datei kann nicht übernommen werden, ein Fehler rollt alles zurück (`:262-275`).
  - Doppelte IDs fallen per `distinct` weg (`:209`, `:265`).
  - Der Parser nimmt nur v4-UUIDs.
  - Die idempotenten Zweige im Handler (`handler.ts:239-242`, über `findExisting`) und in der Datenbank (`0020:188-192`) ignorieren `photoIds`. Das ist die Ursache von M-1, sie bleibt bestehen.
- **App (`uploads.ts`, `Zusammenfassung.tsx`):**
  - Keine Rechte-Ausweitung, kein Secret, kein öffentlicher Link. `photoUrls` signiert für 10 Minuten (`uploads.ts:74-84`).
  - Dazu bleiben M-1, M-2 und N-4 offen. Neu sind N-11 und N-12.
- **Skripte:** `live-uploads.mjs` importiert den Dev-Guard als ersten Import (`:7`), ebenso beide Redproofs. Neu ist M-3.
- **Tests:** `rls.test.ts:201/256` prüfen jetzt scharf auf `42501` (erledigt A-N7). Die Fixtures mit Alt-Pfad schalten den Trigger nur im Block aus und prüfen danach `tgenabled = O`.
- **Ergebnis a):**
  - Keine neue Rechte-Ausweitung und kein Querzugriff im 4b-Diff.
  - Kein neuer Befund zum Geld.
  - H-1 stammt nicht aus dem Diff, sondern aus der ACL in Teil b.

### b) ACL der SECURITY-DEFINER-Funktionen (`tmp/proof/s9a4c-acl.json`)

Alle 21 Funktionen haben den Eigentümer `postgres` und `proconfig = search_path=""`. Damit ist die Regel aus CLAUDE.md für DEFINER erfüllt.

| Funktion | EXECUTE (anon/auth) | Bewertung |
|---|---|---|
| `admin_create_price_version`, `admin_set_price_config`, `admin_set_setting`, `publish_version`, `verify_price_version` | nur service_role | ok. Funktionen mit `p_actor` nur aus Skripten. Aus Edge Functions ruft `quote` nur `verify_price_version` auf (`db.ts:38`), ohne `p_actor`. |
| `admin_grant_role` | nur Eigentümer | ok (`0016:179-180`) |
| **`become_rental_provider()`** | **authenticated** | **nicht zulässig (H-1)** |
| `booking_terms()` | anon, authenticated | zulässig, siehe Frage 2 |
| `private.is_admin()`, `private.my_role()` | authenticated | ok. Policies brauchen sie, sie liefern nur die eigene Rolle bzw. aal2-admin. |
| `private.staging_photo_count()` | authenticated | ok. Die INSERT-Policy braucht sie (0021). |
| `withdraw(uuid)` | authenticated | ok. Art B, Akteur aus `auth.uid()`, Compare-and-Set, Marker (`0017:249-279`). |
| übrige `private.*` (Trigger, `assert_admin`, `do_publish`, `price_version_hash`, `publish_seed_version`) | keine | ok |

**Frage 1: Ist `become_rental_provider()` für authenticated in Phase 1 zulässig?**
- **Entscheidung: Nein.** In 0022 wird die Funktion gelöscht (`drop function`), ein bloßes Revoke reicht nicht.
- Begründung:
  - Sie ist der Weg aus H-1 zum Gebührensatz.
  - Das Konzept verlangt für Phase 1 ausdrücklich „ohne Selbst-Hochstufung“ (`S9_KONZEPT.md:174`) und streicht die Funktion ohnehin (`:286`).
  - Die App ruft sie nicht auf.
  - Globale Regel: veraltete Pfade entfernen, nicht stilllegen.
  - Ein EXECUTE für `service_role` wäre wertlos. Dort ist `auth.uid()` NULL, der Aufruf ändert also nichts.
- Die Tests brauchen kein erweitertes Recht. Sie nehmen den vorhandenen Eigentümer-Weg `ownerGrantRole(id, 'rental_provider')` (`tests/support/owner.ts:35-36`, ruft `admin_grant_role` mit Journal). Den nutzen sie für admin schon heute (`rls.test.ts:103`).

**Frage 2: Ist `booking_terms()` für anon zulässig?**
- **Entscheidung: Ja.**
  - Die Schlüsselliste ist fest, es gibt keinen Parameter (`0016:85`). Die Funktion liefert nur die fünf Stornowerte und `termsHash`, kein `fee_*`, keine Personendaten.
  - Der Test prüft die exakte Schlüsselmenge und das Fehlen von `fee_rate`/`fee_vat` für anon und Kunde (`settings.test.ts:249-262`).
  - Das Konzept verlangt EXECUTE für anon und authenticated (`S9_KONZEPT.md:291`).
  - SECURITY DEFINER ist nötig, weil RLS `platform_settings` sonst vor anon verbirgt.
  - Aufrufer sind die App (`src/lib/quote.ts:183`) und `quote` als service_role (`db.ts:50`).
- Die Regel für später, abgesichert durch den genannten Test: Jeder neue Schlüssel in der Liste ist eine Freigabe an anon.

**Weitere Funktionen:** Sonst gibt es kein unerwartetes EXECUTE und keinen fehlenden `search_path`. Einschränkung: Die Extraktion enthält nur DEFINER-Funktionen (N-9).

### c) `redproof-s9a3.mjs:225` und `:238`

**Ist `quote_save_request` SECURITY DEFINER?** Nein. Laut Definition ist sie `language plpgsql` / `security invoker` / `set search_path = ''` (`0020_photo_staging.sql:160-162`). Auf Dev steht sie folgerichtig nicht in der DEFINER-Liste `s9a4c-acl.json`.

**Bewertung `:238`:**
- Die Messung ist eine gültige Schicht-Beobachtung, aber kein Wirkungsbeweis:
  - Der Wert bleibt in beiden Zuständen `| 1`.
  - Rot wird der Test nur, weil sich die Fehlermeldung ändert.
- Eine „eigentliche Sperre in `quote_save_request`“ gibt es nicht, weil die Funktion keine Rollenprüfung enthält. Die Sperre sind das entzogene EXECUTE (`0020:289-298`) und, wegen INVOKER, die Rechte des Aufrufers.
- **Beide EXECUTE-Rechte gemeinsam zu lockern reicht nicht.** Dahinter hält zuerst RLS auf `platform_settings`: `photo_staging_interval()` ist ebenfalls INVOKER und findet keinen Wert. Das ergäbe `P0001: setting_missing | 1`, also genau den Wert vor 0020.
- Danach folgen weitere Schichten:
  - kein INSERT auf `service_requests` (`0001:302` nur SELECT)
  - kein INSERT auf `price_revisions` (`0018:89`), `request_contacts` (`0018:216`) und `audit_log` (`0015:46`)
  - kein UPDATE auf `current_revision` (`0017:243`)

**Bewertung `:225`:**
- Gelockert und gesperrt ist für den Kunden keine Zeile sichtbar (0 bzw. `<null>`), es bleibt also eine Schicht (RLS ohne Policy).
- Die Abweichung `<null>` entsteht nur, weil `set_config` im Fehlerfall zurückgerollt wird. Sie ist kein Ist-Wert der Sperre.

**Umbau (isolierter Wirkungsbeweis):**
- Die inneren Schichten werden nur in der Probe-Transaktion geöffnet: im `setup` der Probe, das immer mit Rollback endet. Auf Dev wird davon nichts committet.
- Umgeschaltet wird, wie bisher committet, allein die Zielsperre.
- Gelockert entsteht dann eine Anfrage, der Ist-Wert geht von 1 auf 2. Gesperrt bleibt es bei 1 mit dem 42501 der Zielsperre.
- Je ein Eintrag für `quote_save_request` und für `photo_staging_interval`. Die Art ist „Sperre“, keine Kombination: Die übrigen Schichten sind neutralisiert, es wird genau eine Sperre gemessen.

`scripts/redproof-s9a3.mjs`: `:224-230` und `:237-243` ersetzen durch

```js
  // Isoliert (M-3, Berater S9a-4c): innere Schichten nur in der Probe-Transaktion offen (Rollback), umgeschaltet wird allein die Zielsperre.
  // geocode_cache: eigene Testzeile, Lese-Policy nur in der Probe; Wert = Zeilen aus Kundensicht (Startwert 0, bleibt bei Fehler 0).
  const gcKey = `redproof:${randomUUID()}`
  add({
    ...grantToggle('geocode_cache: SELECT für authenticated (isoliert: Lese-Policy nur in der Probe)', 'grant select on public.geocode_cache to authenticated', 'revoke select on public.geocode_cache from authenticated'),
    tests: 'geocode_cache und geo_districts', testFile: 'tests/rls/quote-hardening.test.ts',
    probe: () => probe({
      setup: `insert into public.geocode_cache (key, value, expires_at) values (${q1(gcKey)}, '[]', now() + interval '1 hour'); create policy redproof_gc on public.geocode_cache for select to authenticated using (true); select set_config('app.probe_val', '0', true)`,
      stmt: `perform set_config('app.probe_val', (select count(*) from public.geocode_cache where key = ${q1(gcKey)})::text, true)`,
      value: `current_setting('app.probe_val', true)`, role: 'authenticated', claims: custClaims,
    }),
    loose: 'ok | 1', locked: '42501: permission denied for table geocode_cache | 0',
  })
```

```js
  // quote_save_request ist SECURITY INVOKER (0020:161): ohne diese Öffnung hielte immer die nächste Schicht.
  const STAGING = 'public.photo_staging_interval()'
  const INNER = [
    'create policy redproof_ps on public.platform_settings for select to authenticated using (true)',
    'grant insert on public.service_requests, public.price_revisions, public.request_contacts, public.audit_log to authenticated',
    'grant update (current_revision) on public.service_requests to authenticated',
    'create policy redproof_sr_i on public.service_requests for insert to authenticated with check (true)',
    'create policy redproof_sr_u on public.service_requests for update to authenticated using (true) with check (true)',
    'create policy redproof_pr_i on public.price_revisions for insert to authenticated with check (true)',
    'create policy redproof_rc_i on public.request_contacts for insert to authenticated with check (true)',
    'create policy redproof_al_i on public.audit_log for insert to authenticated with check (true)',
  ].join('; ')
  add({
    ...grantToggle('quote_save_request: EXECUTE für authenticated (isoliert: innere Schichten und photo_staging_interval nur in der Probe offen)', `grant execute on function ${SAVE} to authenticated`, `revoke execute on function ${SAVE} from authenticated`),
    tests: 'Schreib-Funktionen: anon und authenticated erhalten 42501', testFile: 'tests/rls/quote.test.ts',
    probe: () => probe({ setup: `${INNER}; grant execute on function ${STAGING} to authenticated`, stmt: `perform ${callSql()}`, value: reqCount, role: 'authenticated', claims: custClaims }),
    loose: 'ok | 2', locked: '42501: permission denied for function quote_save_request | 1',
  })
  add({
    ...grantToggle('photo_staging_interval: EXECUTE für authenticated (isoliert: innere Schichten und quote_save_request nur in der Probe offen)', `grant execute on function ${STAGING} to authenticated`, `revoke execute on function ${STAGING} from authenticated`),
    tests: null,
    probe: () => probe({ setup: `${INNER}; grant execute on function ${SAVE} to authenticated`, stmt: `perform ${callSql()}`, value: reqCount, role: 'authenticated', claims: custClaims }),
    loose: 'ok | 2', locked: '42501: permission denied for function photo_staging_interval | 1',
  })
```

- In `redproof-s9a4.mjs` die Einträge `:474-491` genauso umbauen:
  - mit `claims(A)` und dem Zähler für A; heute ist der Wert 3, gelockert also `ok | 4`
  - das `photo_orphans`-Paar bleibt als Schicht
  - die Lockerung ersetzt das Label aus N-3
- Erwartete Werte werden vor dem Lauf festgelegt (siehe oben).
- Zeigt die gelockerte Probe statt `ok` einen weiteren Fehler (42501 oder P0001), ist das eine innere Schicht, die ich nicht gefunden habe. Dann:
  - die Schicht zu `INNER` hinzufügen
  - die Erwartungswerte unverändert lassen
  - den Fund in `PROGRESS.md` vermerken
  - die Nachweisdatei nicht anfassen
- Die Probe läuft als `authenticated` mit den Claims des Testkunden. `p_customer` ist dessen uid. Damit greifen auch die SELECT-Policies auf `service_requests` und `price_revisions` für `returning`.

### d) Plan S9a-4c

**Reihenfolge (Rot zuerst):**
1. Rot-Tests Sicherheit, vor 0022, gegen Dev:
   - neuer RLS-Test „kein Selbst-Upgrade“ (`rls.test.ts`)
   - Allowlist-Test (N-9)
   - Beide müssen rot sein. Ist-Wert: Der Kunde liest 2 Gebührenschlüssel, bzw. die Liste enthält `become_rental_provider():authenticated`.
   - Log mit EXIT in `tmp/proof/`
2. Test-Setups umstellen: `rls.test.ts:101-102`, `quote.test.ts:87` auf `ownerGrantRole`. Die Tests `rls.test.ts:175-178`, `:444-447` und `settings.test.ts:349-353` ersetzen. Die Suite muss sonst grün bleiben.
3. Vorab-Abfragen auf Dev, Log nach `tmp/proof/`:
   - `select role, count(*) from public.profiles group by role` (welche `rental_provider` gibt es außerhalb von Tests?)
   - EXPLAIN der Zählung für N-8, als `authenticated` mit Claims
4. Migration 0022 auf Dev pushen, `db:types`, RLS-Suite grün, die Tests aus Schritt 1 grün.
5. Redproof `s9a4`:
   - Snapshot erweitern (N-6 und `become_rental_provider` in der Liste)
   - neuer Eintrag für 0022
   - N-1, N-2, N-3 umsetzen; M-3 nach c umbauen
   - Lauf mit EXIT=0
   - danach `redproof-s9a3` mit dem Umbau aus c
6. Rot-Tests App, vor dem Code:
   - Unit-Tests `refBody` (M-1) und Staging-Stand (M-2)
   - E2E „verlorene Antwort, Foto entfernt“
   - 422-E2E auf neue `clientRef` umstellen
   - Lauf: muss rot sein
7. Code M-1, M-2, N-4 umsetzen. Dann `check`, `test:e2e` und `test:rls` grün.
8. Doku: OPEN_ISSUES (N-5, N-7, N-10, N-11, N-12; H-1/M-1/M-2/M-3 erledigt), `ARCHITECTURE.md:6` (Rolle `rental_provider` nur über den Eigentümer), `S9_KONZEPT.md:286` (Funktion entfällt schon in S9a-4c).
9. Abnahme durch den Berater: 0022, Redproof-Berichte, `uploads.ts`, `quote.ts`, `Zusammenfassung.tsx`.

**Akzeptanzkriterien:**
- **AK1 (H-1):** Rot-Log vor 0022 mit Ist-Wert. Danach:
  - RPC-Fehler für den Kunden
  - Rolle bleibt `customer`
  - `platform_settings` aus Kundensicht `[]`
  - Redproof-Eintrag gelockert `ok | 2`, gesperrt `42883 … does not exist | 0`, Test gelockert rot
- **AK2 (N-9):** Die Allowlist ist exakt die Liste unten. Alle DEFINER-Funktionen haben `search_path=""` und den Eigentümer `postgres`.
- **AK3 (M-3):** Vier isolierte Einträge (2 in `s9a3`, 2 in `s9a4`) und ein isolierter `geocode_cache`-Eintrag:
  - gelockert `ok | n+1` bzw. `ok | 1`
  - gesperrt mit dem 42501 der Zielsperre
  - Snapshot vorher gleich nachher
- **AK4 (M-1):** Gleicher Entwurf mit gleichem Fotosatz ergibt dieselbe Ref, die Reihenfolge spielt keine Rolle. Ein Foto weniger oder neue IDs ergeben eine neue Ref. Die E2E-Assertions laut Entwurf unten. Der Offline-Text lautet „Keine Verbindung. Die Fotos sind noch nicht hochgeladen.“
- **AK5 (M-2):**
  - Ref-Wechsel im selben Konto: zuerst `remove` mit genau den alten Pfaden, dann Upload
  - Kontowechsel: kein `remove` mit der neuen Sitzung, aber `discardStaging` vor „Anderes Konto“
  - nach Erfolg kein `remove` beim nächsten Entwurf
- **AK6 (N-4):** Verlässt der Kunde die Seite während des Sendens, ist der Fotospeicher nach dem Erfolg leer.
- **AK7:** Jeder Lauf mit EXIT im Log; `scan:proof` mit Exit 0 vor dem Kopieren nach `docs/proof/s9a4c/`.

#### Migration 0022 (vollständig)

Datei: `supabase/migrations/20261103120000_0022_no_self_upgrade.sql`. Abschnitt 2 nur, wenn das EXPLAIN aus Schritt 3 den Befund N-8 bestätigt.

```sql
-- 0022 Kein Selbst-Upgrade zur Vermieter-Rolle in Phase 1 (S9a-4c, Berater H-1; S9_KONZEPT 3: „ohne Selbst-Hochstufung“),
-- Staging-Zählung über einen Indexbereich (Berater N-8).

-- 1. become_rental_provider entfällt: jedes Konto konnte sich damit zum rental_provider machen und über platform_settings_select
--    den Gebührensatz lesen. Die Vermieter-Rolle setzt nur noch der Datenbank-Eigentümer (admin_grant_role, mit Journal).
--    Phase 2 / S9b führt Vermieter als Partner der Kategorie rental ein.
drop function public.become_rental_provider();

-- 2. Zählung der eigenen, nicht übernommenen Staging-Dateien: Bereich [uid/, uid0) in C-Kollation statt Pattern-Vergleich
--    ('0' folgt auf '/'); der Präfix ist erst zur Laufzeit bekannt, ein Bereich mit Parametern nutzt den Index (bucket_id, name).
--    create or replace behält Eigentümer und Rechte (nur authenticated).
create or replace function private.staging_photo_count() returns bigint
language sql stable security definer set search_path = ''
as $$
  select count(*) from storage.objects o
  where o.bucket_id = 'request-photos'
    and o.name >= ((select auth.uid())::text || '/') collate "C"
    and o.name < ((select auth.uid())::text || '0') collate "C"
    and not exists (select 1 from public.request_photos p where p.storage_path = o.name)
$$;
```

- Danach `npm run db:types`: `become_rental_provider` verschwindet aus `database.types.ts`.
- Abschnitt 2 muss nach dem Push im EXPLAIN eine Index Cond auf `name` zeigen. Sonst Abschnitt 2 per Folgemigration zurück auf 0021.
- Das Muster `and not exists (select 1 from public.request_photos p where p.storage_path = o.name)` bleibt wörtlich erhalten, der Redproof-Eintrag `redproof-s9a4.mjs:438` findet es also weiter.

#### Tests zu 0022 und N-9

`tests/rls/rls.test.ts`:
- `:100-102`: `ownerGrantRole(provider.id, 'rental_provider'); ownerGrantRole(otherProvider.id, 'rental_provider')`
- `:175-178`: Den Teil „wird nicht Vermieter“ streichen (den deckt der neue Test ab), den Foto-Teil behalten.
- `:444-447` ersetzen durch:

```ts
  it('kein Selbst-Upgrade: Kunde wird nicht Vermieter und liest keinen Gebührensatz', async () => {
    // Die RPC gibt es seit 0022 nicht mehr; der Name steht deshalb nicht in den generierten Typen.
    expect((await a.db.rpc('become_rental_provider' as never)).error).not.toBeNull()
    expect(must(await service.from('profiles').select('role').eq('id', a.id).single()).role).toBe('customer')
    expect(must(await a.db.from('platform_settings').select('key'))).toEqual([])
  })

  it('SECURITY DEFINER: Eigentümer postgres, fester search_path, EXECUTE für anon/authenticated nur laut Liste', () => {
    const rows = ownerSql(`select p.oid::regprocedure::text as fn, pg_get_userbyid(p.proowner) as owner,
        coalesce(array_to_string(p.proconfig, ','), '') as cfg,
        has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'private') and p.prosecdef order by 1`)
    for (const r of rows) {
      expect.soft(r.owner, String(r.fn)).toBe('postgres')
      expect.soft(r.cfg, String(r.fn)).toBe('search_path=""')
    }
    const open = rows
      .filter((r) => r.anon === true || r.auth === true)
      .map((r) => `${r.fn}:${[r.anon === true && 'anon', r.auth === true && 'authenticated'].filter(Boolean).join('+')}`)
    expect(open).toEqual([
      'booking_terms():anon+authenticated',
      'private.is_admin():authenticated',
      'private.my_role():authenticated',
      'private.staging_photo_count():authenticated',
      'withdraw(uuid):authenticated',
    ])
  })
```

- Falls `ownerSql` die Booleans als Text liefert: im ersten Lauf gegen das Format aus `owner.ts` prüfen und den Vergleich entsprechend anpassen. Der Inhalt der Liste bleibt.
- Die Sortierung ist die der Datenbank (`order by 1`). Weicht sie ab, die Liste sortieren, nicht den Inhalt ändern.
- `tests/rls/quote.test.ts:87`: `ownerGrantRole(landlord.id, 'rental_provider')`, Import aus `../support/owner.ts`.
- `tests/rls/settings.test.ts:349-353`: Löschen. Der Weg über den Eigentümer ist in `grant_ok`/`grant_audit_ok` (`:310-312`) bereits belegt, der Fall „kein Selbst-Upgrade“ in `rls.test.ts`.

#### Redproof `s9a4` (Snapshot und neue Einträge)

- **Snapshot `:37-39` (N-6 und 0022):**

```js
  select 'function', p.oid::regprocedure || ' ' || md5(pg_get_functiondef(p.oid)) || ' ' || coalesce(p.proacl::text, '') || ' ' || p.proowner::regrole::text || ' ' || p.prosecdef::text || ' ' || coalesce(p.proconfig::text, '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'private' and p.proname in ('guard_photo_insert', 'immutable_row', 'assert_admin', 'guard_price_version', 'staging_photo_count', 'my_role', 'is_admin'))
       or (n.nspname = 'public' and p.proname in ('quote_save_request', 'photo_orphans', 'photo_cleanup', 'photo_staging_interval', 'booking_terms', 'publish_version', 'admin_set_setting', 'become_rental_provider', 'admin_grant_role'))
```

- **Neuer Eintrag 0022** (Wiederherstellung = löschen; vorher und nachher fehlt die Funktion, der Snapshot erkennt Reste):

```js
  // 0022: Selbst-Upgrade. Gelockert = Funktion und Recht aus 0001/0016 wieder da; Wert = Gebührenschlüssel aus Kundensicht (Startwert 0).
  const anonDb = mkClient(PUB)
  let brpOn = false
  const rpcReady = async () => {
    // PostgREST lädt das Schema nach DDL neu; erst dann sieht der zuständige Test den Zustand
    for (let i = 0; i < 20; i++) {
      const missing = (await anonDb.rpc('become_rental_provider')).error?.code === 'PGRST202'
      if (missing !== brpOn) return
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error('PostgREST-Schema nicht nachgeladen')
  }
  const BRP = `create function public.become_rental_provider() returns public.user_role
language plpgsql security definer set search_path = ''
as $f$
declare
  uid uuid := (select auth.uid());
  r public.user_role;
begin
  perform set_config('app.mv_role_grant', uid::text || ':rental_provider', true);
  update public.profiles set role = 'rental_provider' where id = uid and role = 'customer';
  perform set_config('app.mv_role_grant', '', true);
  select role into r from public.profiles where id = uid;
  return r;
end
$f$;
revoke all on function public.become_rental_provider() from public, anon;
grant execute on function public.become_rental_provider() to authenticated;
notify pgrst, 'reload schema'`
  add({
    label: 'become_rental_provider entfernt (0022): Kunde stuft sich selbst hoch und liest den Gebührensatz', kind: 'Sperre', save: () => null,
    apply: () => { sql(BRP); brpOn = true },
    restore: () => { sql(`drop function public.become_rental_provider(); notify pgrst, 'reload schema'`); brpOn = false },
    tests: 'kein Selbst-Upgrade', testFile: 'tests/rls/rls.test.ts',
    probe: async () => {
      await rpcReady()
      return probe({
        setup: `select set_config('app.probe_val', '0', true)`,
        stmt: `perform public.become_rental_provider(); perform set_config('app.probe_val', (select count(distinct key) from public.platform_settings where key in ('fee_rate', 'fee_vat_rate'))::text, true)`,
        value: `current_setting('app.probe_val', true)`, role: 'authenticated', claims: claims(A),
      })
    },
    loose: 'ok | 2', locked: '42883: function public.become_rental_provider() does not exist | 0',
  })
```

- **Ablauf:** `runSql` ruft `apply` ohne `await` auf. Das passt, weil `apply` synchron ist. `probe` wird vor `testRun` mit `await` ausgeführt, `rpcReady` sorgt also vorher für den Schema-Stand.
- **N-1:** Der Eintrag `:438` bekommt `kind: 'Verfügbarkeit'`. Das Ergebnis zählt diese Art getrennt; im Bericht erscheint `count('SQL', 'Verfügbarkeit')`.
- **N-2:** Die Lockerungsausdrücke der Storage-INSERT-Einträge (`:351-362`, `:416`/`:437` A-M2-Insert) bekommen ` and (select private.staging_photo_count()) < 40` angehängt. Ausgenommen ist der Eintrag, der genau diese Bedingung lockert (`:437`).
- **N-3:** entfällt durch den Umbau aus c (neue Labels).

#### M-1: `clientRef` hängt am Fotosatz

**Entscheidung: Foto-IDs, nicht Inhalts-Hashes.**
- Der Server kennt nur IDs:
  - Er übernimmt genau `p_photo_ids` oder nichts (`0020:265-275`).
  - Mit IDs in der Ref gilt deshalb die Invariante „eine gespeicherte Anfrage zur Ref hat genau diese IDs“. Damit gilt auch „angezeigt = gesendet“, auch im idempotenten Zweig.
  - Ein späterer serverseitiger Abgleich vergleicht dieselben IDs.
- Mit Hashes könnten unter derselben Ref andere IDs stehen. Fall: Foto entfernt und dieselbe Datei wieder gewählt, oder `renewPhotoIds`. Nach einer verlorenen Antwort scheitert der Upload in den Ordner mit Anfrage dann dauerhaft mit `denied` (403).
- Außerdem sind Hashes asynchron (bis zu 8 × 10 MB je Senden) und nicht sicher stabil: Die Canvas-Kodierung ist nicht garantiert deterministisch.
- `renewPhotoIds` nach einem 422 `photo_missing`/`photo_expired` ergibt eine neue Ref. Das ist harmlos, denn der 422 ist eine sichere Antwort: Gespeichert wurde nichts.
- Verlorene Antwort und unveränderte Fotos: dieselbe Ref. Die Pfade liegen im Staging-Stand, es gibt keinen Upload, `quote` liefert die gespeicherte Anfrage. Das ist richtig.
- Verlorene Antwort und geänderte Fotos: neue Ref, also eine zweite Anfrage. Das gilt bei Hashes genauso und entspricht der geänderten Angabe aus S8b-2 (N-12).

`src/lib/quote.ts`, neu nach `refFor`:

```ts
/**
 * Inhalt, aus dem die `clientRef` entsteht: der Entwurf ohne die bestätigten Angaben (nach einem 409 bleibt die Ref) und der Fotosatz
 * (sortierte IDs). Ein anderer Fotosatz ist ein neuer Versuch: die gespeicherte Anfrage einer Ref hat genau diese Fotos (`quote_save_request`
 * übernimmt `p_photo_ids` ganz oder gar nicht, der idempotente Zweig liefert die vorhandene Anfrage).
 */
export function refBody(body: Body, photoIds: readonly string[]): Body {
  return { ...body, priceVersion: 0, termsHash: '', shown: null, photoIds: [...photoIds].sort() }
}
```

`src/lib/uploads.ts:14`:

```ts
  offline: 'Keine Verbindung. Die Fotos sind noch nicht hochgeladen.',
```

`tests/unit/draft.test.ts`, neuer Fall im `refFor`-Block (Import um `refBody` ergänzen):

```ts
  it('clientRef hängt am Fotosatz: gleiche IDs in anderer Reihenfolge = gleiche Ref, ein Foto weniger = neue Ref, Bestätigtes zählt nicht', () => {
    const P1 = 'a0b1c2d3-0000-4000-8000-000000000001'
    const P2 = 'a0b1c2d3-0000-4000-8000-000000000002'
    const body = { service: 'clearance', preferredDate: '2026-11-15' }
    const a = refFor('entruempelung', refBody(body, [P1, P2]))
    expect(refFor('entruempelung', refBody(body, [P2, P1]))).toBe(a)
    expect(refFor('entruempelung', refBody({ ...body, priceVersion: 7, termsHash: 'x', shown: { kind: 'offer' } }, [P1, P2]))).toBe(a)
    expect(refFor('entruempelung', refBody(body, [P2]))).not.toBe(a)
  })
```

#### M-2: Staging-Stand je Konto und Ref

`src/lib/uploads.ts`: Zeilen `:29-71` ersetzen. `uploadPhoto` wird intern, `failureText` wie oben.

```ts
/** Staging-Pfad `{user}/{clientRef}/{id}.jpg`: die Datenbank prüft ihn in den Storage-Policies und beim Übernehmen durch `quote`. */
const stagingPath = (userId: string, clientRef: string, photo: Photo) => `${userId}/${clientRef}/${photo.id}.jpg`

/**
 * Staging-Stand dieser Sitzung: Konto, Ref und die Pfade, die dort liegen. Dieselbe Ref lädt nichts doppelt hoch. Wechselt die Ref
 * (geänderte Angaben oder Fotos), werden vorher die alten Dateien entfernt; sonst zählen sie bis zum Aufräumen gegen das Kontingent (0021).
 */
type Staged = { userId: string; clientRef: string; paths: Set<string> }
let staged: Staged | null = null

/** Löschen erlaubt die Delete-Policy (0021) nur im eigenen Ordner ohne Anfrage zur Ref: übernommene Fotos bleiben. Fehler sind egal, den Rest räumt photo_cleanup auf. */
async function removePaths(db: Db, paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    await db.storage.from(BUCKET).remove(paths)
  } catch {
    // siehe oben
  }
}

async function stagingFor(db: Db, userId: string, clientRef: string): Promise<Staged> {
  if (staged && staged.userId === userId && staged.clientRef === clientRef) return staged
  const old = staged
  staged = { userId, clientRef, paths: new Set() }
  // Anderes Konto: dessen Ordner ist für diese Sitzung gesperrt; „Anderes Konto“ räumt vorher mit `discardStaging` auf.
  if (old && old.userId === userId) await removePaths(db, [...old.paths])
  return staged
}

/** Ein Foto ins Staging, ohne Upsert (es gibt keine Update-Policy). „Gibt es schon“ zählt als Erfolg: dieselbe ID ist dieselbe Datei. */
async function uploadPhoto(db: Db, s: Staged, photo: Photo): Promise<UploadFailure | null> {
  if (photo.blob.size > MAX_BYTES) return 'too_big'
  const path = stagingPath(s.userId, s.clientRef, photo)
  if (s.paths.has(path)) return null
  const upload = await db.storage.from(BUCKET).upload(path, photo.blob, { contentType: 'image/jpeg', upsert: false })
  const status = upload.error ? (upload.error as { statusCode?: string }).statusCode : undefined
  if (!upload.error || status === '409' || /already exists/i.test(upload.error.message)) {
    s.paths.add(path)
    return null
  }
  if (status === '413') return 'too_big'
  if (status === '403' || /row-level security/i.test(upload.error.message)) return 'denied'
  return isOffline(upload.error) ? 'offline' : 'failed'
}

/** Alle Fotos nacheinander; der erste Fehler bricht ab, `onDone` meldet die Zahl der Fotos, die liegen. */
export async function uploadAll(db: Db, userId: string, clientRef: string, photos: readonly Photo[], onDone: (n: number) => void): Promise<UploadFailure | null> {
  const s = await stagingFor(db, userId, clientRef)
  let done = 0
  for (const photo of photos) {
    const failure = await uploadPhoto(db, s, photo)
    if (failure) return failure
    onDone(++done)
  }
  return null
}

/** Entfernt die Dateien des aktuellen Stands: nach `photo_missing`/`photo_expired` und vor „Anderes Konto“ (noch mit der alten Sitzung). */
export async function discardStaging(db: Db): Promise<void> {
  const old = staged
  staged = null
  if (old) await removePaths(db, [...old.paths])
}

/** Nach dem Absenden: die Dateien gehören zur Anfrage, der nächste Entwurf beginnt ohne Stand. */
export function forgetStaging(): void {
  staged = null
}
```

`src/screens/anfrage/Zusammenfassung.tsx` (M-1, M-2, N-4):

```tsx
import { type Terms, QuoteError, buildBody, errorText, invalidTarget, invalidText, priceLabel, refBody, refFor, rejectedText, sendQuote, shownFromSnapshot, shownLabel, termsText } from '../../lib/quote'
import { type UploadFailure, discardStaging, failureText, forgetStaging, photoRejectedText, uploadAll } from '../../lib/uploads'

  // statt :183-189
  const sentRef = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (sentRef.current) clearPhotos(photoKey)
    }
  }, [photoKey])

  // otherAccount (:218-222)
  const otherAccount = async () => {
    stashDraft(path)
    // noch mit der alten Sitzung: deren Staging-Dateien zählen sonst bis zum Aufräumen gegen ihr Kontingent
    await discardStaging(supabase)
    await leaveAccount()
    void navigate(`/anmelden?next=${encodeURIComponent(`/${path}/zusammenfassung`)}`)
  }

  // in send(): `let staged …` (:230) entfällt; :245-258 ersetzen durch
      const toSend = getPhotos(photoKey)
      const photoIds = toSend.map((p) => p.id)
      // clientRef: Entwurf ohne die bestätigten Angaben (nach einem 409 bleibt sie) und mit dem Fotosatz (anderer Satz = neuer Versuch)
      const clientRef = refFor(path, refBody(body, photoIds))
      // Fotos zuerst ins Staging {user}/{clientRef}/{id}.jpg; ein Ref-Wechsel entfernt vorher die Dateien der alten Ref (uploads.ts)
      const failure = await uploadAll(supabase, live.user.id, clientRef, toSend, setUploaded)
      if (failure) {
        setStatus({ kind: 'photos', failure })
        return
      }
      const quote = await sendQuote({ ...body, photoIds }, clientRef, live.access_token)
      forgetStaging()
      sentRef.current = true // geleert wird beim Verlassen: ein Re-Render vor der Navigation fände den Entwurf schon gelöscht
      if (!mounted.current) clearPhotos(photoKey) // Seite während des Sendens verlassen: der Cleanup lief schon (N-4)
      finishDraft(path, { path, id: quote.id, status: quote.status, needsQuote: quote.needsQuote, snapshot: quote.snapshot, shownCents: readShown(path), date: termin.date, route: summary!.route })
      void navigate(`/${path}/gesendet`, { replace: true })

  // catch (:262-266)
      if (error.kind === 'rejected' && reuploadCodes.includes(error.code ?? '')) {
        await discardStaging(supabase)
        renewPhotoIds(photoKey) // neue IDs = neue clientRef; gespeichert wurde nichts
      }
```

`tests/unit/uploads.test.ts`:
- `fakeDb` um ein gemeinsames Protokoll `log` erweitern (`upload:<path>`, `remove:<paths>`).
- Die `it.each`-Fälle von `uploadPhoto` laufen über `uploadAll` mit einem Foto.
- `beforeEach(() => forgetStaging())`.
- Neue Fälle:

```ts
describe('Staging-Stand (M-2)', () => {
  const none = () => undefined
  it('Ref-Wechsel im selben Konto: erst die Dateien der alten Ref entfernen, dann hochladen', async () => {
    const { db, calls } = fakeDb()
    await uploadAll(db, 'u', 'ref-1', [photo(P1), photo(P2)], none)
    await uploadAll(db, 'u', 'ref-2', [photo(P2)], none)
    expect(calls.log).toEqual([`upload:u/ref-1/${P1}.jpg`, `upload:u/ref-1/${P2}.jpg`, `remove:u/ref-1/${P1}.jpg,u/ref-1/${P2}.jpg`, `upload:u/ref-2/${P2}.jpg`])
  })
  it('gleiche Ref: nichts entfernt, nichts doppelt', async () => {
    const { db, calls } = fakeDb()
    await uploadAll(db, 'u', 'ref-1', [photo(P1)], none)
    await uploadAll(db, 'u', 'ref-1', [photo(P1), photo(P2)], none)
    expect(calls.log).toEqual([`upload:u/ref-1/${P1}.jpg`, `upload:u/ref-1/${P2}.jpg`])
  })
  it('Kontowechsel: alte Dateien nicht mit der neuen Sitzung löschen', async () => {
    const { db, calls } = fakeDb()
    await uploadAll(db, 'u1', 'ref-1', [photo(P1)], none)
    await uploadAll(db, 'u2', 'ref-1', [photo(P1)], none)
    expect(calls.remove).toEqual([])
    expect(calls.upload.map((c) => c.path)).toEqual([`u1/ref-1/${P1}.jpg`, `u2/ref-1/${P1}.jpg`])
  })
  it('nach dem Absenden (forgetStaging): der nächste Entwurf entfernt nichts', async () => {
    const { db, calls } = fakeDb()
    await uploadAll(db, 'u', 'ref-1', [photo(P1)], none)
    forgetStaging()
    await uploadAll(db, 'u', 'ref-2', [photo(P2)], none)
    expect(calls.remove).toEqual([])
  })
  it('discardStaging entfernt den aktuellen Stand; danach wird dasselbe Foto neu hochgeladen', async () => {
    const { db, calls } = fakeDb()
    await uploadAll(db, 'u', 'ref-1', [photo(P1)], none)
    await discardStaging(db)
    expect(calls.remove).toEqual([[`u/ref-1/${P1}.jpg`]])
    await uploadAll(db, 'u', 'ref-1', [photo(P1)], none)
    expect(calls.upload).toHaveLength(2)
  })
})
```

`tests/e2e/fotos.spec.ts`:
- Neuer Test (M-1 und M-2 zusammen).
- Die Navigation zurück zum Foto-Schritt läuft über die App, ein Neuladen würde die Fotos verwerfen.
- Beschriftung bzw. Rolle von „Ändern“ beim Bauen prüfen. Belegt ist nur, dass es den Weg Ergebnis → Ändern → Wizard gibt (OPEN_ISSUES `:197`).

```ts
test('Verlorene Antwort, dann Foto entfernt: neue clientRef, photoIds = angezeigte Fotos, alte Staging-Dateien entfernt', async ({ page }) => {
  const calls = await mockPhotos(page)
  const quoteCalls = await sendWithPhotos(page, { reply: (n) => (n === 1 ? { abort: true } : accepted()), sent: false })
  await expect(page.getByRole('alert').filter({ hasText: 'Keine Verbindung.' })).toBeVisible()
  const first = quoteCalls[0]!.body
  const [id1, id2] = ids(first)
  await page.goBack() // Termin
  await page.goBack() // Ergebnis
  await page.getByRole('link', { name: 'Ändern' }).click()
  await page.getByRole('button', { name: 'Foto 1 entfernen' }).click()
  await expect(page.getByText('1 von 8')).toBeVisible()
  await page.getByRole('button', { name: 'Richtwert anzeigen' }).click()
  await page.getByRole('button', { name: 'Ort & Wunschtermin' }).click()
  await page.getByRole('button', { name: 'Zur Zusammenfassung' }).click()
  await page.getByRole('checkbox').check()
  await expect(page.getByRole('img', { name: /^Foto / })).toHaveCount(1)
  await sendButton(page).click()
  await expect(page).toHaveURL(/\/entruempelung\/gesendet$/)
  const second = quoteCalls[1]!.body
  expect(second.clientRef).not.toBe(first.clientRef)
  expect(ids(second)).toEqual([id2]) // genau das angezeigte Foto
  expect(calls.uploads.at(-1)!.path).toBe(`u-1/${second.clientRef}/${id2}.jpg`)
  expect(calls.removedFiles).toEqual([[`u-1/${first.clientRef}/${id1}.jpg`, `u-1/${first.clientRef}/${id2}.jpg`]])
})
```

- Bestehende 422-Tests (`photo_missing`/`photo_expired`, Diff `:3657`): `toBe` wird zu `not.toBe` (neue IDs = neue Ref). Die übrigen Assertions bleiben: Entfernen direkt nach dem 422, neue Dateinamen, 4 Uploads.
- N-4, optional als E2E: `quote` mit `delay`, während des Sendens `page.goBack()`. Nach der Antwort zeigt der Foto-Schritt `0 von 8`.

**Zu M-2, Kontowechsel und Delete-Policy:**
- Gleiches Konto, neue Ref:
  - Gab es zur alten Ref keine Anfrage, darf gelöscht werden (`0021:60-70`).
  - Gibt es eine (verlorene Antwort), verweigert die Policy. Storage liefert dann eine leere Liste ohne Fehler, die übernommenen Fotos bleiben.
- Anderes Konto: Die neue Sitzung darf den alten Ordner nicht löschen, weil `foldername[1] = auth.uid()` gilt. Darum löscht `stagingFor` dort nichts, und „Anderes Konto“ räumt vorher mit der alten Sitzung auf.
  - Ein Wechsel in einem anderen Tab bleibt offen, dort räumt `photo_cleanup` auf.
- **Serverseitig ist nichts nötig.** Die Grenze bleibt weich, wie in OPEN_ISSUES `:131` dokumentiert.
- Erwogen und verworfen: In `staging_photo_count` nur nicht abgelaufene Dateien zählen. Das bringt höchstens eine Stunde Karenz und koppelt die Zählung an `photo_staging_interval`.
- Restgrenze siehe N-11.

#### Niedrige Findings N-1 bis N-7 (Vorbericht) und die neuen

| Punkt | In 4c | Nach OPEN_ISSUES |
|---|---|---|
| N-1 Art „Verfügbarkeit“ | ja (Redproof) | – |
| N-2 Zählbedingung in den Lockerungen | ja (Redproof) | – |
| N-3 Label | ja, ersetzt durch den Umbau aus c | – |
| N-4 `clearPhotos` nach Verlassen | ja (Mount-Ref, Code oben) | – |
| N-5 Partnerzugriff nur über `request_photos` | Mit M-1 und M-2 weitgehend erledigt (Foto entfernt → neue Ref → alte Datei gelöscht) | Regel für S9b: nie Ordnerlisten |
| N-6 Snapshot mit Eigentümer, `prosecdef`, `proconfig` | ja (Code oben) | – |
| N-7 Darstellung R2-N13 | ja (nur Doku) | – |
| N-8 Indexbereich der Zählung | ja, wenn das EXPLAIN es bestätigt | sonst Ergebnis vermerken |
| N-9 Allowlist DEFINER | ja | Erweiterung auf INVOKER-Funktionen, optional |
| N-10 `partner` in der Policy | – | S9b |
| N-11 Lösch-Wettlauf | – | Ergänzung in `:122` |
| N-12 Doppelanfrage nach verlorener Antwort | – | vor Livegang (Prüfung der unbestätigten Ref) |

Aus OPEN_ISSUES `:132`:
- A-N4 (Negativbeweis Exit 2 bei sauberem Baum) ist jetzt möglich, weil der Baum sauber ist, und kostet wenig. In 4c mitnehmen.
- Die übrigen Punkte aus `:132` gehören nicht zu diesem Plan.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `0020_photo_staging.sql:160-162` | `security invoker`, `search_path = ''` (c) |
| `0020_photo_staging.sql:27-28` | EXECUTE auf `photo_staging_interval` nur für service_role |
| `0020_photo_staging.sql:188-192` | idempotenter Zweig ignoriert `p_photo_ids` (M-1) |
| `0020_photo_staging.sql:265-275` | Pfad aus `p_customer`/`p_client_ref`, Fehler rollt alles zurück, ok |
| `0020_photo_staging.sql:289-298` | Rechte auf `quote_save_request` nur service_role, ok |
| `0021_photo_limits.sql:34-44` | DEFINER, `search_path=''`, uid aus `auth.uid()`, nur authenticated, ok |
| `0021_photo_limits.sql:39` | Pattern-Vergleich mit Laufzeit-Präfix (N-8) |
| `0021_photo_limits.sql:60-70` | Delete nur ohne Anfrage zur Ref und ohne Zeile, ok (M-2 sicher) |
| `0001_foundation.sql:68-69` | `become_rental_provider` EXECUTE für authenticated (H-1) |
| `0016_settings_admin.sql:150-163` | DEFINER, wandelt das eigene Konto in `rental_provider` um (H-1) |
| `0016_settings_admin.sql:188-189` | `platform_settings` lesbar für `rental_provider`, nicht für `partner` (H-1, N-10) |
| `0016_settings_admin.sql:81-104` | `booking_terms`: feste Liste, ohne `fee_*`, anon/authenticated, ok |
| `0016_settings_admin.sql:166-180` | `admin_grant_role` nur Eigentümer, mit Journal, ok |
| `0017_status_machine.sql:249-279` | `withdraw`: Akteur aus `auth.uid()`, CAS, ok |
| `0018_revisions_contacts.sql:89`, `:216`; `0015:46`; `0001:302`; `0017:243` | innere Schichten (kein INSERT/UPDATE für authenticated), Grundlage des Umbaus in c |
| `0018_revisions_contacts.sql:61-72`, `:144-160` | Trigger prüfen Status, Version und Zeiger ohne Rollenprüfung; die isolierte Probe kann gelingen |
| `s9a4c-acl.json:40-48` | Dev: `become_rental_provider` authenticated=X (H-1) |
| `s9a4c-acl.json:49-57` | Dev: `booking_terms` anon=X (Frage 2, zulässig) |
| `s9a4c-acl.json` (alle 21) | Eigentümer `postgres`, `search_path=""`, ok |
| `S9_KONZEPT.md:174` | „ohne Selbst-Hochstufung“ in Phase 1 (H-1) |
| `S9_KONZEPT.md:291` | `booking_terms` für anon vorgesehen, ok |
| `redproof-s9a3.mjs:238-243` | Wert in beiden Zuständen 1: Schicht, kein Wirkungsbeweis (M-3) |
| `redproof-s9a3.mjs:225-230` | 0 bzw. `<null>`: Schicht (M-3) |
| `redproof-s9a4.mjs:474-491` | dieselben Schichten (M-3, N-3) |
| `redproof-s9a4.mjs:104-109` | `value` läuft nach `reset role` als Eigentümer; Kundensicht nur über `set_config` (Entwurf 0022 berücksichtigt das) |
| `redproof-s9a4.mjs:150-164` | `apply` ohne `await`, `probe` mit `await` vor `testRun` (Entwurf 0022 berücksichtigt das) |
| `src/lib/quote.ts:54-69` | Ref aus dem Körper ohne Fotos (M-1) |
| `src/lib/uploads.ts:14` | Offline-Text behauptet „nicht gesendet“ (M-1) |
| `src/lib/uploads.ts:33` | globale Menge ohne Konto- und Ref-Wechsel (M-2) |
| `Zusammenfassung.tsx:184-189`, `:256` | Leeren nur im Unmount-Cleanup (N-4) |
| `Zusammenfassung.tsx:218-222` | „Anderes Konto“ ohne Aufräumen (M-2) |
| `handler.ts:239-242` | `findExisting` vor jeder Fotoprüfung (M-1, Server) |
| `handler.ts:321-344` | Snapshot vom Server, `photoIds` ohne Preiswirkung, ok |
| `db.ts:38`, `:50` | Edge ruft `verify_price_version` und `booking_terms` ohne `p_actor`, ok |
| `tests/rls/settings.test.ts:249-262` | `booking_terms`: exakte Schlüssel, kein `fee_*`, ok |
| `tests/rls/rls.test.ts:101-102`, `:445-446`; `quote.test.ts:87`; `settings.test.ts:349-353` | Nutzer von `become_rental_provider`, Umstellung auf `ownerGrantRole` |
| `tests/support/owner.ts:35-36` | `ownerGrantRole` über `admin_grant_role` (Eigentümer), ok |

Offene Findings hoch: 1
