# S9a Fundament: Bauplan

Quelle: `docs/S9_KONZEPT.md` Abschnitt 13 (Zeile S9a), dazu R11-2, R11-3, R11-5, R11-6 (`docs/OPEN_ISSUES.md:39-50`) und R7-5a/c/d (`OPEN_ISSUES.md:10`). Verweise auf das Konzept statt Wiederholung. Nur Plan, kein Code. Der Tab „Miete“ gehört zu S9i (`S9_KONZEPT.md:656`), nicht zu S9a.

Kürzel: H = `supabase/functions/_shared/quote/handler.ts`, M01 = `…_0001_foundation.sql`, M10 = `…_0010_quote.sql`, M11–M14 = `…_0011_photos` bis `…_0014_photo_cleanup_loud`. Migrationen: `<timestamp>_00NN_<name>.sql`, ab 0015.

## 1. Ist-Stand (belegt)

**quote**
- Einstieg `supabase/functions/quote/index.ts:22-32`. Preis H:213-237 (Anfrage), H:264-269 (Miete). Status H:246 (`needsQuote && clearance` → `inspection_requested`, sonst `requested`). Antwort `{ id, status, needsQuote, priceVersion, snapshot }` (H:80, H:316), ohne Gebühr. Jeder `HttpError` des Routings außer 503 wird heute zu `route_missing` (H:214-222).
- `quote` geokodiert nicht. Optionales Client-`postcode` `_shared/quote/parse.ts:59-71`, gespeichert `db.ts:105, 109`; die App sendet es nicht (`src/lib/quote.ts:33, 37`). Geokodierung nur in `route` (`route/handler.ts:72-74`, ungecacht; PLZ `route/provider.ts:69`).
- Zeitfenster `parse.ts:22`, Prüfung `parse.ts:95-98`, DB-Check M10:10; App `src/lib/draft.ts:14-19`. `preferredDate` ist heute optional (`parse.ts:142`). Bearbeiten: `requestId` im Body (`parse.ts:24-25, 44, 133, 138`), UPDATE-Zweig in `quote_save_request` (M10:71-87), Abbildung auf 409 `not_editable` (H:201-204).
- `quote_save_request` (M10:32-105): `service_requests` (M10:53-86), `fee_splits` delete M10:90, upsert M10:92-100. `quote_save_booking` (M10:108-143): `rental_bookings` (M10:121-129), `fee_splits` M10:136-140. Aufrufe `feeRow` H:259, H:305 über `db.ts:118, 141`; `findExisting` liest `price_snapshot`/`price_version` (`db.ts:72-91`).
- Ergebnis einer Entrümpelung ist eine Spanne mit gesetztem `totalCents` und `kind: 'price'`, `needsQuote` false (`_shared/pricing/clearance.ts:57-60`).

**fee_splits**: geschrieben nur an den drei Stellen oben; gelesen in `src/` und `supabase/functions` nirgends. Tabelle M01:196-213, Policy M01:399-402. Tests: `tests/rls/rls.test.ts:148, 197, 361-393`, `tests/rls/quote.test.ts:58, 136-150, 251-260`.

**Status und Policies**
- Enum `request_status` M01:20-22; Checks M01:127-128, Default M01:109, Rental-Check M01:175. Funktionssignaturen mit dem Enum M10:34, 41, 113.
- Grants `update(status)` an `authenticated` (M01:302-303, rental M01:382-383). Update-Policies: Kunde `requested`/`inspection_requested` → `withdrawn`, **admin ohne Beschränkung** (M01:308-316, rental M01:388-396). Foto-Policies mit Statusliste: M01:343-351, M11:25-34, 0003:27-39, 0002:24-35. Kein Übergangs-Trigger, nur `set_updated_at` (M01:233, 237).
- Tests `tests/rls/rls.test.ts:268-304` (Insert verweigert, nur `withdrawn`, Preisfelder gesperrt, fremde Anfrage, nicht wieder öffnen, keine Fotos zur zurückgezogenen, Miete nur zurückziehen).
- admin-Klauseln ohne `aal`: M01:264, 293, 306, 328, 372, 386, 402, 414 plus die Schreib-Policies (M01:274-299, 311/315, 391/395). `private.is_admin()` fehlt; Rollenprüfung über `private.my_role()` (M01:37-42).

**Preise und Sätze**: `price_versions` (M01:73-78), `price_config` (M01:81-90), `platform_settings` (M01:93-100, `value numeric`). Admin-Schreib-Policies M01:274-279, 282-287, 294-299; Select `platform_settings` nur `rental_provider`/admin (M01:292-293). `current_price_version` (0004:9-14), `current_fee_rates` (M10:21-27). `publish_version`, `audit_log`, `status_events`, `booking_terms`: nicht vorhanden. Seed `supabase/seed.sql:5-86` (v1, 28 Zeilen, `fee_rate` 0.15, `fee_vat_rate` 0.20) schreibt mit `on conflict … do update`; `seed.prod.sql` ebenso. Wien-Grenze: `geo_boundaries` (M01:219-227, Slugs 0006:71-72), Import `npm run geo:import`. Bezirksgrenzen, Geocode-Cache: nicht vorhanden.

**Fotos und Absenden**: Bucket privat (M01:408-409), nur JPEG (M11:39); Pfad setzt ein Trigger (M11:13, M13:10, M12:2), Limit 8 per Trigger (M11:5-19, M13:5-9). Client `src/lib/uploads.ts:29-42`. Absenden `src/screens/anfrage/Zusammenfassung.tsx:194-200` (`buildBody` `src/lib/quote.ts:19-40` → `sendQuote` :122-138 → `queueUploads` → `finishDraft` `draft.ts:114-121`). `refFor` vergibt bei geändertem Body eine neue `clientRef` (`src/lib/quote.ts:46-61`). UI-Stellen: `src/lib/quote.ts:108-115`, `draft.ts:105`, `Gesendet.tsx:19`, `Auftraege.tsx:13, 19, 35`.

**Migrationen**: höchste `20261101150000_0014_photo_cleanup_loud.sql`.
**Dev-Zeilen** (aus Seeds und Tests abgeleitet, DB nicht abgefragt): Seed-Zeilen oben, 3 Demo-Mietangebote (`seed.sql:88-108`); Tests legen Anfragen, Buchungen, Nutzer, Versionen mit Lauf-Kennung an (`tests/support/db.ts:19`, `rls.test.ts:97-99`); `uploads.test.ts:75, 202, 210` setzen `confirmed`/`withdrawn` per `service_role`. Dev kann Zeilen mit `confirmed`/`inspection_requested`, Fotos, `fee_splits` und Test-Versionen enthalten (Rest `fee_vat_rate_<lauf>` möglich, `OPEN_ISSUES.md:36`).

## 2. Regeln für alle Teile

- **Fehlercodes.** Trigger- und Funktionsfehler: SQLSTATE `P0001`, Meldung = Code. Rechtefehler: `42501`. Tests prüfen SQLSTATE **und** Meldung. Codes: `version_published`, `version_hash_mismatch`, `fee_rate_notice`, `fee_rate_immutable`, `append_only`, `invalid_transition`, `revision_immutable`, `invalid_revision_pointer`, `field_immutable`, `setting_missing`, `not_found`. Die Session trägt sie ins Konzept ein.
- **Positivkontrolle.** Jeder „0 Zeilen“- und „verweigert“-Test hat im selben Test einen erlaubten Gegenfall.
- **Rot-Beweis** (Muster `scripts/redproof-uploads.mjs:14-40`, nicht Wegwerf-Transaktion: PostgREST-Tests sehen ungecommittete DDL nicht): Lockerung committen, den Test laufen lassen (muss rot sein, aus dem richtigen Grund, mit der erwarteten Meldung), Original wiederherstellen, Definitionen aus `pg_trigger`/`pg_policies`/`pg_proc` vergleichen. Je Teil ein Skript `scripts/redproof-s9aN.mjs` mit Bericht `tmp/proof/s9aN-redproof.json`. `scripts/redproof-uploads.mjs` wird in S9a-2 gelöscht (es stellt `inspection_requested` und `my_role()` wieder her).
- **Neue Tabellen**: RLS an, `revoke all from anon, authenticated`, gezielte Grants und Policies nach Matrix 6 (Tabelle 3 in jedem Teil). Je Tabelle ein Test erlaubt/verweigert. `revoke truncate … from service_role` auf allen unveränderlichen Tabellen (TRUNCATE umgeht Zeilen-Trigger).
- **Kein Status setzender Helfer** in Migrationen. Fixtures mit Status nur in Teil 2 über das Anlegen mit `requested`/`awaiting_offer`; alles andere entsteht erst mit S9c.
- Admin-Funktionen `admin_*`: Ausführung nur `service_role` oder Eigentümer, prüfen die Rolle von `p_actor` (Konzept 3, kein `aal`); `admin_grant_role` nur Eigentümer, ein Trigger auf `profiles.role` verlangt dazu den Marker von `admin_grant_role`. `aal2` gilt für Policies (`is_admin()`) und admin-Edge-Functions.
- **Marker** für Übergänge und Veröffentlichung: transaktionslokale Einstellung im eigenen Namensraum `app.mv_*` (nicht `request.*`, das setzt PostgREST aus Clientdaten); die Funktion setzt ihn mit `set_config(…, true)` und löscht ihn nach dem UPDATE; er enthält den Übergang (`von>nach`), nicht nur „ja“.
- Tests nutzen die Lauf-Kennung; kein dauerhafter Datenmüll.

## 3. Schnitt

| Teil | Ziel | Migrationen | Berater |
|---|---|---|---|
| S9a-1 | Preisversionen und Sätze unveränderlich, Seed, Admin-Funktionen, `aal2`-Admin | 0015, 0016 | ja |
| S9a-2 | Statusmaschine, Revisionen, Kontakte; `quote` ohne `fee_splits`; Kunden-UI-Minimum | 0017, 0018 | ja |
| S9a-3 | `quote`-Härtung: Haltefenster, Bedingungen, Adressprüfung, Bezirk | 0019 | ja |
| S9a-4 | Fotos vor dem Absenden (Staging) | 0020 | ja |

Reihenfolge ist eine Kette (Konzept 13); der Kundenflow bleibt nach jedem Teil benutzbar.

## 4. S9a-1 Preisversionen und Einstellungen

**Ziel.** Veröffentlichte Preisversionen und Gebührensätze sind für niemanden mehr änderbar, auch nicht für admin oder `service_role` (Konzept 5.1).

**Migrationen**
- `0015_versions_published`: **zuerst** `audit_log` (nur Insert; Trigger `append_only` gegen UPDATE/DELETE; RLS: admin S mit `is_admin()`), `private.is_admin()` (Rolle admin und JWT `aal2`). Dann `price_versions.published, published_at, content_hash`, `private.price_version_hash(v)` (Konzept 5.1). Trigger auf `price_versions` und `price_config` prüft **OLD und NEW**: kein INSERT mit `published = true`; `published`, `published_at`, `content_hash` nur mit Marker von `publish_version`/interner Funktion änderbar (der Trigger setzt `published_at = now()` und berechnet den Hash selbst); UPDATE/DELETE ab `published`; INSERT/UPDATE/DELETE in `price_config`, wenn OLD oder NEW zu einer veröffentlichten Version gehört (auch Verschieben der Zeile). Funktionen: `publish_version`, `admin_create_price_version`, `admin_set_price_config` (schreiben in `audit_log`); interne `private.publish_seed_version(v)` ohne `p_actor`, nur Eigentümer, derselbe Hash (R11-2). Die Migration veröffentlicht v1, **nur wenn sie existiert** (sonst No-op). `current_price_version` filtert auf `published`. Admin-Schreib-Policies auf `price_versions`/`price_config` und die Schreib-Grants entfallen.
- `0016_settings_admin`: `platform_settings.effective_from`; `value`-Check für `window_start_*` ganzzahlig und `0 ≤ value < 1440` (Minuten nach Mitternacht Wiener Zeit: `morning` 480, `midday` 660, `afternoon` 840, `flexible` 480; die Werte „08:00 …“ in Konzept 5.10 werden so festgehalten); Trigger für `fee_rate`, `fee_vat_rate`, `fee_notice_days` (Vorlauf 30 Tage nach dem zum Eintrag geltenden Wert, UPDATE `fee_rate_immutable`, DELETE nur Zukunft; Ausnahme erste Version); `current_fee_rates` mit `effective_from`; Prüfung, dass `fee_rate` und `fee_vat_rate` vorhanden sind; Schlüssel aus 5.10; `booking_terms()` (fünf Werte plus `termsHash`, Execute `anon`, `authenticated`); `admin_set_setting`, `admin_grant_role`; Trigger auf `profiles.role`; die fünf admin-Klauseln M01:264, 293, 306, 402, 414 **und** :328, :372, :386 auf `is_admin()`; admin-Schreib-Policies auf `platform_settings` entfallen (M01:294-299). Die Partner-Select-Policy auf `fee_*` kommt mit S9b (`my_partner_id()`), bis dahin M01:292-293.
- **Seed (R7-5c):** `seed.sql` und `seed.prod.sql` je Zeile `insert … select … where not exists` für `price_versions`, `price_config`, `platform_settings` (mit `effective_from`), danach `select private.publish_seed_version(1)` (idempotent). Ein `on conflict do update/nothing` entfällt, weil die Trigger vor der Konfliktprüfung laufen. `tests/unit/seed-prod.test.ts` anpassen.

**Dev-Zeilen.** v1 wird veröffentlicht und gehasht; unveröffentlichte Test-Versionen bleiben änderbar. `platform_settings` v1 bekommt `effective_from = 2026-10-28` (Seed-Datum). **Rückweg:** Transaktion je Datei; nach Erfolg gibt es keinen Rückweg (Trigger gewollt), Korrekturen als Folge-Migration. Neues Projekt oder `db reset`: Migrationen laufen auf leeren Tabellen (No-op), der Seed legt v1 an und veröffentlicht sie.

**Functions.** `_shared/quote/db.ts`: Hash-Prüfung vor dem Rechnen (Prüffunktion nur `service_role`, `version_hash_mismatch`), `current_fee_rates` mit der neuen Spalte.
**UI/Screens.** Keine.

**Tests** (neu `tests/rls/settings.test.ts`)
- DB-Test: Hash kanonisch (Sortierung, `value::text`), Gleichheit mit `publish_version`. Unit: Vorlauf-Formel, Minutenwert → `termin_at`.
- Erlaubt: `admin_set_setting` mit Vorlauf 30 Tage (`service_role`); `admin_set_price_config` auf unveröffentlichter Version.
- Verweigert (je mit Gegenfall): admin-JWT schreibt `price_versions`/`price_config`/`platform_settings` → 42501; `publish_version`/`admin_*` per RPC als `authenticated` → 42501; `service_role` UPDATE/DELETE veröffentlichte Version → `P0001 version_published`; `service_role` INSERT `price_config` in veröffentlichte Version → `version_published`; `service_role` UPDATE `published false→true` ohne Marker → `field_immutable`; INSERT mit `published = true` → `field_immutable`; Verschieben einer `price_config`-Zeile in eine veröffentlichte Version → `version_published`; `fee_rate` direkt per `service_role`-INSERT mit zu kurzem Vorlauf → `fee_rate_notice`; UPDATE einer `fee_*`-Zeile → `fee_rate_immutable`; geänderter Inhalt bei gleichem Hash → `version_hash_mismatch`; `audit_log` UPDATE/DELETE → `append_only`; TRUNCATE als `service_role` → 42501; `profiles.role` per `service_role` ohne Marker → `field_immutable`; `booking_terms()` liefert kein `fee_*`; admin (`aal1`) liest fremde Anfragen/Buchungen/Fotos → 0 Zeilen, Positivkontrolle per Eigentümer-SQL mit gesetzten Claims (`aal2`).
- Anpassungen: `rls.test.ts:383-385` (admin `aal1` → 0 Zeilen), `rls.test.ts:409-429` (`price_config` als admin-JWT → 42501; positiv `admin_set_price_config` per `service_role`), `quote.test.ts:184-188` (Satzschlüssel unveränderlich), `quote.test.ts:179-191` (`fee_rates_missing` nur noch als Unit-Test mit gestubbtem `loadFeeRates`), `rls.test.ts:397-446` bleibt mit unveröffentlichter Testversion nur dort, wo kein admin-Schreiben nötig ist.
- Rot-Beweis `scripts/redproof-s9a1.mjs`: je Trigger (`published`-Marker, Config-Sperre, Fee-Vorlauf, `append_only`), `is_admin()`-Klausel und Revoke einzeln lockern.

**Abnahme** (alle Exit 0): `npm run check`; `npm run test:rls`; `node scripts/redproof-s9a1.mjs`; Seed zweimal nacheinander einspielen (`npm run db:push`), danach `current_price_version` = 1 mit gesetztem `content_hash` (`node scripts/s9a1-verify.mjs`); `npm run db:types`; `npm run build`.

**Berater: ja** (Geld, Schema, RLS). Frage: Trigger, Marker, `is_admin()`, Seed-Weg und Admin-Funktionen lückenlos gegen `service_role` und admin? (0015, 0016, Seeds).
**Vorübergehend nicht funktionsfähig.** Preise ändert admin nur per Funktion über die Konsole; Partner lesen den Satz noch nicht. Dev: vertretbar, es gibt keine Partner.

## 5. S9a-2 Status, Revisionen, Kontakte, `fee_splits` raus

**Ziel.** Status ändert sich nur über Funktionen (Konzept 4.4); der Preis liegt in `price_revisions`. `quote` schreibt keine `fee_splits` mehr.

**Migration 0017_status_machine** (Reihenfolge)
1. Dev-Daten verwerfen (`fee_splits`, `request_photos`, `rental_bookings`, `service_requests`); Storage-Dateien von `request-photos` vorher per Skript über die Storage-API (`scripts/storage-reset.mjs`, wiederholbar), nicht per SQL.
2. Abhängige Objekte droppen: die Policies M01:308-316, 343-351, M11:25-34, 0003:27-39, 0002:24-35, M01:388-396; `quote_save_request`, `quote_save_booking`.
3. Enum tauschen (alt umbenennen, neu anlegen, Spalten mit `status::text::…`, Default, alt droppen): ohne `inspection_requested`, `confirmed`; mit `awaiting_offer, offered, accepted, declined, unmatched, cancelled_by_customer, cancelled_by_partner`. Checks `inspection_needs_quote` und M01:175 entfallen.
4. Foto-Policies neu mit `status in ('requested','awaiting_offer')` und **ohne admin-Klausel** (der alte Foto-Weg bleibt bis S9a-4 benutzbar); `rental_bookings`-Update nur für den Kunden (`requested → withdrawn`).
5. `status_events` (nur anfügen: Trigger `append_only`; Spalten inkl. Akteur-Rolle, R7-5a); AFTER-UPDATE-Trigger schreibt sie. BEFORE-UPDATE-Trigger auf `service_requests`: Paar **und** Marker als zwei getrennte Prüfungen (`invalid_transition`), keine Rollen-Ausnahme; BEFORE-INSERT nur `requested`/`awaiting_offer`. `revoke update` auf `service_requests`, Kunden- und admin-Update-Policy entfallen. RPC `withdraw` (T2; Marker, Compare-and-Set). **`rental_bookings`:** kleiner BEFORE-UPDATE-Trigger ohne Rollen-Ausnahme, nur `requested → withdrawn` zulässig (Konzept 4.6 sagt „bleibt wie M01:175“; der Plan folgt Abschnitt 13, weil das Enum den alten Wert nicht mehr kennt).

**Migration 0018_revisions_contacts**: `price_revisions` (Spalten und Checks nach 5.4, `unique (request_id, n)`, `content_hash`; Trigger `revision_immutable`: Update nur der Nachtragsfelder (ab S9f), DELETE nur durch die Kaskade der Anfrage; Fremdschlüssel `service_requests.current_revision` zusammengesetzt auf `(id, request_id)`, `NO ACTION`; Zeiger-Trigger `invalid_revision_pointer`); `service_requests`: `current_revision, accept_deadline, termin_at, district`, Trigger `field_immutable` für `termin_at`, `accept_deadline`, `district` nach dem INSERT; `estimate_cents`, `price_snapshot`, `inputs`, `price_version` entfallen; `request_contacts` (Name, Telefon, E-Mail, **Stiege/Tür**, R11-6); `quote_save_request` neu (Revision 1 und Zeiger in einer Transaktion, `accept_deadline` aus `now()` der Datenbank, Status nach Abbildung unten, **kein UPDATE-Zweig**, kein `fee_splits`), `quote_save_booking` ohne `fee_splits`. `fee_splits` bleibt als Tabelle bis S9b.

**RLS neuer Tabellen**

| Tabelle | Kunde | admin | service_role |
|---|---|---|---|
| `price_revisions` | S eigene Aufträge | – (Auswertung später) | I, kein U/D außer Kaskade |
| `request_contacts` | S eigene | kein freies S (nur `admin-contact`, S9c) | I/S |
| `status_events` | kein Zugriff | S mit `is_admin()` | nur Trigger/Funktionen |
| `audit_log` | – | S mit `is_admin()` | I |

**Abbildung Preisart → Status/Revision (Konzept 4.1, 5.4)**: `kind = price`, `low = high` → `requested`, `total = low = high`. `kind = price`, `low < high` (Spanne, z. B. Entrümpelung) → `awaiting_offer`, `total` NULL, `low/high` gesetzt. `kind = offer` → `awaiting_offer`, alle drei NULL. Der Snapshot trägt für die Spanne kein verbindliches `totalCents`.

**Dev-Zeilen.** Alle `service_requests`, `rental_bookings`, `fee_splits`, `request_photos` werden gelöscht (Konzept 4.1); gilt in jeder Umgebung, in Prod bewusst (dort gibt es noch keine). Seed-Mietangebote bleiben. **Rückweg:** Dump der Dev-Daten vorher nach `tmp/backup/` (nicht committen); die Löschung ist endgültig; Transaktion pro Datei, Storage-Skript wiederholbar.

**Functions.** H:246 (Abbildung oben), H:259/H:305 (`feeRow` entfällt), `db.ts:72-146` (`findExisting` liest aus Revision, `p_fee_*` entfallen, `p_request` entfällt), `parse.ts` (`requestId` aus Parser, Typ, `KEYS` entfernt; `preferredDate` Pflicht, R7-5d), H:201-204 (55000/`not_editable` entfällt). Fehlt ein Einstellungswert (`window_start_*`, `call_out_fee_cents`, `cancel_*`): 500 `setting_missing`, nichts gespeichert.
**UI.** `src/lib/quote.ts:108-115`, `draft.ts:105` (`awaiting_offer`), `Gesendet.tsx:19` (ohne Besichtigung, Spanne anzeigen), `Auftraege.tsx:13, 19, 35` (Preis oder Spanne aus der Revision, Texte der neuen Status), „Anfrage bearbeiten“ entfernt, `errorText.unavailable` („nicht verloren“, `src/lib/quote.ts:151`) bei 409/422/503 nicht verwenden. Screens: Gesendet, Aufträge (390 px Light/Dark).

**Tests**
- Erlaubt/Verweigert: `withdraw` aus `requested` ok; `withdraw` einer zurückgezogenen → `invalid_transition`; `withdraw` fremder Anfrage → `not_found`; admin-UPDATE `status` → 42501; Kunde UPDATE `status` → 42501; **gültiges** Paar durch `service_role` ohne Marker → `invalid_transition`; **ungültiges** Paar mit Marker → `invalid_transition` (Paar und Marker getrennt rot beweisbar); INSERT mit Status `accepted` → `invalid_transition`; Rental `requested → completed` per `service_role` → `invalid_transition`; UPDATE `price_revisions` (Snapshot, Preis, `inputs`) → `revision_immutable`; DELETE einer Revision → `revision_immutable`; zweite Revision 1 → `23505`; `current_revision` auf fremde Revision → `invalid_revision_pointer`; UPDATE `termin_at`/`accept_deadline`/`district` → `field_immutable`; Body mit `requestId` → 400; Kunde liest fremde Revision/Kontakte → 0 Zeilen (Positivkontrolle eigene); Foto-Upload zu `awaiting_offer`-Anfrage erlaubt; `status_events` UPDATE → `append_only`.
- Anpassungen: `rls.test.ts:268-304` (Zurückziehen nur über `withdraw`; Z. 300 neuer Status, Z. 302 bleibt), `rls.test.ts:112-113, 276`, `uploads.test.ts:23, 75, 202, 210`, `quote.test.ts:102, 109-114, 133, 136-151, 153, 157, 194-235, 241-262, 313-321` (Insert mit `price_snapshot` gibt dann PGRST204 statt 42501; Test auf die neue Sperre umstellen).
- Unit: Abbildung Preisart → Status, Aufträge-Liste, Gesendet. E2E: Anfrage senden → Aufträge zeigt Preis/Spanne aus der Revision; Hauptflow per Tastatur.
- Rot-Beweis `scripts/redproof-s9a2.mjs`: Paar-Prüfung, Marker-Prüfung, INSERT-Trigger, UPDATE-Revoke, Revisions-Trigger, Zeiger-Trigger, Rental-Trigger je einzeln.

**Abnahme** (Exit 0): `npm run check`; `npm run test:rls`; `npm run test:e2e`; `npm run shots` + `reviewer` (Runde); `node scripts/redproof-s9a2.mjs`; `npm run build`.
**Berater: ja.** Frage: Setzt nach 0017/0018 irgendeine Rolle einen Status am Funktionspfad vorbei, und ist die Datenlöschung/Enum-Tausch sauber? (0017, 0018, `quote_save_request`).
**Vorübergehend nicht funktionsfähig.** Keine Gebühr gespeichert (Journal erst S9b); kein Haltefenster (S9a-3); nichts annehmbar (S9c). Dev: vertretbar, Verträge entstehen erst mit S9c.

## 6. S9a-3 `quote`-Härtung und Bezirk

**Ziel.** Der Kunde zahlt nur, was er sah (Haltefenster, Bedingungen), und die Adresse samt Bezirk wird serverseitig geprüft (Konzept 5.4, 5.5, 5.10).

**Migration 0019_quote_hardening**: `geo_districts` (23 Bezirke, Import-Skript analog `scripts/import-boundaries.mjs`, Quelle bestimmt die Session), Bezirk per `ST_Covers` (wie 0006:79-80, Grenzpunkt-Test); Geocode-Cache (HMAC-Schlüssel, TTL, stündliche Bereinigung wie 0009) mit eigenem globalen Kontingent für `quote`; Spalten `from_postcode`/`to_postcode` entfallen (R11-5); `quote_save_request` erneut geändert (ohne PLZ, mit `district`, `termin_at`, Kontakten, `content_hash`); `price_confirmed`-Eintrag in `audit_log` in derselben Transaktion. Alte Zeilen aus S9a-2-Läufen werden in 0019 verworfen (Spalten `district`, `termin_at` `NOT NULL`).

**RLS neuer Tabellen**: `geo_districts` und Geocode-Cache nur `service_role`; `authenticated`/`anon` kein Zugriff; Test 42501.

**Functions** (`quote`, `route`): `shownTotalCents` (bei Spanne `low`/`high`, bei Angebot Art und Gründe, R8-4), `priceVersion`, `termsHash` Pflicht (sonst 400); Haltefenster 30 Minuten; unveröffentlichte oder künftige Version → 409 `price_changed`; 409 `terms_changed`; Stornostufen und `call_out_fee_cents` in den Snapshot; 422 `too_late`, `offer_not_bookable`, `district_required`, `address_point_required`, `address_mismatch`, `address_imprecise`; nur `no_route` führt zu `route_missing` (H:214-222 umbauen), Ausfall/Limit ergibt 503/429; `termin_at` aus `window_start_*` (Minuten, Wiener Zeit); Kontakte nach `request_contacts`; Client-`postcode` entfällt (`parse.ts:59-71`), Rückfallfeld „Wiener PLZ“ als eigener Schlüssel nur bei PLZ `null`/Sonder-PLZ. `route`: `Candidate` um `layer`, Straße, Hausnummer, `canonicalLabel(candidate)` (`facts.ts:7`, `provider.ts:30, 69`). `OPEN_ISSUES.md:37` und die Testzeile in Konzept 6.1 nachziehen (R11-5).
**UI/Screens.** Absenden mit den drei Feldern (`Zusammenfassung.tsx:194-200`); Texte für 409/422/503/429; Adresssuche mit Einwilligung und Bestätigung für Entrümpelung und Montage; Hinweis bei Abholung außerhalb Wiens; Gründe-Texte der Vorschau; Kontaktfelder mit Hinweistext (Frage Recht 10). Screens: Zusammenfassung, Adressschritte aller vier Dienste, Fehlerzustände (390 px Light/Dark). `refFor` (`src/lib/quote.ts:46-61`): die `clientRef` bleibt bei 409 stabil (nichts gespeichert), damit die Fotos aus S9a-4 zuordenbar bleiben.

**Tests**
- Unit: Haltefenster (Grenze 30 min), `termin_at` je Fenster inkl. Sommer-/Winterzeit, `canonicalLabel`, Bezirk aus dem Polygon (Sonder-PLZ spielen keine Rolle), Rundung, `splitFee` unverändert.
- Integration: Version 31 min ersetzt → 409 `price_changed`; innerhalb 30 min → akzeptiert (Gegenfall); gleiche Version, anderer Betrag (Strecke geändert) → 409 `price_changed`, keine Zeile; falscher `termsHash` → 409 `terms_changed`; fehlendes Feld → 400; Punkt ohne Hausnummer → 422 `address_imprecise`; Abholung außerhalb Wiens → 422 `pickup_outside_vienna` (auch mit manipulierten Koordinaten oder Client-`postcode`); Wiener Punkt ohne Bezirk im Polygon → 422 `district_required`; kein Rückfallfeld (Entscheidung Beks, 02.11.2026); Punkt auf der Bezirksgrenze → Bezirk gefunden; Termin < `accept_min_hours` → 422 `too_late`; Auslandsziel → 422 `offer_not_bookable`; Geocoder-/Routing-Ausfall → 503/429, Zeilenanzahl unverändert; `audit_log` enthält `price_confirmed`.
- E2E: Preis ändert sich zwischen Vorschau und Absenden (Dialog, neuer Preis nur nach Zustimmung).
- Rot-Beweis `scripts/redproof-s9a3.mjs`: Haltefenster-Prüfung, Hausnummer-Ebene, Versionsvergleich je einzeln (Kopie der Function deployen, Test rot, Original zurück).

**Abnahme** (Exit 0): `npm run check`; `npm run test:rls`; `npm run test:e2e`; `npm run shots`; `node scripts/redproof-s9a3.mjs`; `npm run build`; `reviewer` Runde.
**Berater: ja.** Frage: Kann sich ein Kundenpreis ohne Zustimmung ändern, und ist jeder Ausfall fail closed? (`quote/handler.ts`, `db.ts`, 0019).
**Vorübergehend nicht funktionsfähig.** Fotos hängen noch am alten Weg (nach dem Absenden); der funktioniert mit den Revisionen aus S9a-2 weiter.

## 7. S9a-4 Fotos vor dem Absenden

**Ziel.** Fotos liegen im Staging-Pfad `{uid}/{client_ref}/`, `quote` übernimmt sie in derselben Transaktion; danach gibt es kein Hinzufügen/Löschen (Konzept 7.1).

**Migration 0020_photo_staging**: Storage-Policies Insert/Delete nur im Staging-Pfad, solange es zu `client_ref` keine Anfrage gibt (ersetzt die Foto-Policies aus S9a-2); Trigger M11/M13 entfällt; `request_photos` ohne I/U/D für `authenticated`; `request_photos_select` und `request_photos_objects_select` ohne admin-Klausel; `photo_orphans`/`photo_cleanup` mit `photo_staging_hours` (M11:43-51). Die Übernahme-Prüfung (Pfad, Anzahl ≤ 8, Existenz in `storage.objects`) läuft in der SQL-Funktion in derselben Transaktion, weil PostgREST `storage` nicht ausliefert; ein Upload parallel zu `quote` erzeugt höchstens eine Waise, die `photo_cleanup` entfernt.
**Dev-Zeilen.** Keine `request_photos` (S9a-2); Staging-Reste räumt `photo_cleanup`. **Rückweg:** Folge-Migration; alte Policies erst im selben Skript ersetzt.

**Functions.** `quote`: Pfad setzen, 422 `too_many_photos`, 422 `photo_missing`, Übernahme als `request_photos`.
**UI/Screens.** `src/lib/uploads.ts:29-42` lädt nach der Anmeldung in den Staging-Pfad, **vor** `sendQuote`; `Zusammenfassung.tsx:194-200` ruft `quote` erst danach; Entwurf hält Fotos lokal bis zur Anmeldung. Screens: Fotoschritt, Zusammenfassung (Fortschritt, Fehler).

**Tests** (`tests/rls/uploads.test.ts:48-245` umbauen)
- Staging eigener Ordner erlaubt (Gegenfall); fremder Ordner → 42501; Ordner mit vorhandener Anfrage zu `client_ref` → 42501; Direkt-INSERT `request_photos` → 42501; Staging fremd lesen → 0 Zeilen (Positivkontrolle eigene); 9 Dateien → 422 `too_many_photos`; Datei fehlt → 422 `photo_missing`.
- E2E: Fotos vor dem Absenden, Tastatur; 409 `price_changed` → Zustimmung → Anfrage hat alle Fotos (gleiche `clientRef`).
- Rot-Beweis `scripts/redproof-s9a4.mjs`: Fremdordner-Bedingung **und** Bedingung „keine Anfrage zu `client_ref`“ einzeln lockern.

**Abnahme** (Exit 0): `npm run check`; `npm run test:rls`; `npm run test:e2e`; `npm run shots:all`; `node scripts/redproof-s9a4.mjs`; `npm run build`; `reviewer` Abnahme, Konsole fehlerfrei.
**Berater: ja.** Frage: Staging-Policies und Übernahme ohne Querzugriff? (0020, `quote`).
**Vorübergehend nicht funktionsfähig.** Nichts; S9a ist abgeschlossen. EXIF entfernt weiter der Client.

## 8. Risiken

1. Storage-Dateien lassen sich nicht per SQL löschen: Skript über die Storage-API vor 0017.
2. `aal2`-Positivtests: Eigentümer-SQL mit gesetzten Claims, nicht über die API.
3. Quelle der Bezirksgrenzen offen (Konzept 5.5: Empfehlung Polygon, kein Rückfallfeld; Frage 29 gilt bis zu Beks' Antwort).
4. `request_contacts` braucht Name, Telefon, E-Mail beim Absenden; die App erhebt heute nur die E-Mail der Anmeldung: Felder und Hinweistext (Frage Recht 10) sind UI-Teil von S9a-3, nur Pflichtfelder.
5. Partner-Lesezugriff auf `fee_*` (alle Partner-Konten) kommt mit S9b; Tests `quote.test.ts:307-311`, `rls.test.ts:360-395` bleiben bis dahin.
6. Der Konzept-Widerspruch 4.6 (`:260`) gegen Abschnitt 13 (`:648`) zum Rental-Check wird in S9a-2 im Konzept bereinigt.
7. Zwischen S9a-2 und S9a-3 gibt es kein Haltefenster; vertretbar, bis S9c kann niemand annehmen.

## 9. Offen

Nach Runde 2 gibt es keine weitere Runde. Verbleibende Findings mittel/niedrig stehen mit Einstufung und Teilschritt-Zuordnung (S9a-1 bis S9a-4) in `docs/OPEN_ISSUES.md`; die zuständige Session arbeitet sie vor ihrer Plan-Freigabe ein. Der Plan ändert sich nach der letzten Abnahme nicht mehr (Abnahmestand = Commit-Stand).
