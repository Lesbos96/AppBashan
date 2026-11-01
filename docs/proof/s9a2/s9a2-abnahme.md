# S9a-2 Berater-Abnahme vor dem Commit (Geld, Sicherheit, Schema)

Datum: 2026-11-02 · Prüfer: advisor-report · nur gelesen; geschrieben habe ich nur diese Datei

**Geprüfter Umfang**
- Diff `tmp/proof/s9a2-diff.patch` (1560 Zeilen, vollständig gelesen). Neue Dateien vollständig: `scripts/redproof-s9a2.mjs`, `tests/rls/status.test.ts`, `tests/support/dev-guard-setup.ts`, `scripts/storage-reset.mjs`. Dazu der aktuelle Stand von `supabase/functions/_shared/quote/{handler,db,snapshot}.ts` (relevante Teile) und `tests/support/owner.ts`.
- Migrationen `20261101180000_0017_status_machine.sql` (279 Z.) und `20261101190000_0018_revisions_contacts.sql` (373 Z.), vollständig, gegen meinen Plan-Bericht `docs/proof/s9a2/s9a2-plan.md` (M-1 bis M-4, N-1 bis N-16) und gegen `docs/OPEN_ISSUES.md`, Abschnitt „S9a-2 · Abweichungen und offene Punkte“ (im Patch).
- Rot-Beweis `tmp/proof/s9a2-rotbeweis.md` und Log `tmp/proof/s9a2-redproof.log` (Abschlusszeilen), Shot-Tabelle `tmp/proof/s9a2-shots.md`. Fünf Bilder habe ich selbst geöffnet.
- Logs `tmp/proof/s9a2-{check,rls,e2e}.log`.
- Hinweis nach CLAUDE.md: In meiner Tool-Liste steht ein eingebautes `advisor`-Tool ohne Parameter. Ich habe es nicht benutzt.

**Ergebnis in einem Satz:** Die Geld- und Sicherheitslogik ist korrekt. Am Funktionspfad vorbei setzt nur der Eigentümer einen Status (dokumentierte Grenze). Revisionen sind unveränderlich, der Preis ändert sich nicht ohne Zustimmung, und `quote` schreibt strukturell kein `fee_splits` mehr. Offen sind drei mittlere Punkte: ein falsch eingestufter Rot-Beweis, mehrere neue Sperren ohne Rot-Beweis und die Entrümpelung mit `low = high`, die verbindlich gespeichert, aber als „ca.“ angezeigt wird.

---

## Findings

### Hoch

Keine.

### Mittel

**M-1 · `scripts/redproof-s9a2.mjs:219-224` (Bericht `s9a2-rotbeweis.md:151-157`): „withdraw für anon ausführbar“ ist als „Sperre“ ausgewiesen, misst aber keine Wirkung**
- Szenario: Gelockert liefert die Probe `P0001: not_found | requested`, gesperrt `42501 … | requested`. Der Ist-Wert (Status) ist in beiden Zuständen gleich. Der Aufruf ist auch gelockert nicht erfolgreich, weil `withdraw` bei `auth.uid() = null` mit `not_found` abbricht (`0017:256-258`). Nach CLAUDE.md:64 ist das kein Rot-Beweis der Sperre, nur ein anderer Fehlercode. Damit gehört der Eintrag zur Art „Schicht“. Der Bericht zählt „18 Sperren“, richtig wären 17 Sperren und 4 Schichten.
- Fix: `kind: 'Schicht'` setzen und das Label um „(Schicht: auth.uid() null → not_found)“ ergänzen. Den Lauf wiederholen und den Bericht neu erzeugen. Die alte Datei bleibt dabei unverändert, der neue Lauf kommt in eine neue Datei.

**M-2 · `scripts/redproof-s9a2.mjs:96-237`: Neue Sperren ohne Rot-Beweis**
Diese Sperren aus 0017/0018 werden nie gelockert. Ihre Wirkung ist nur durch grüne Tests belegt. Nach Wichtigkeit:
1. **Eigentümerprüfung in `withdraw`** (`0017:263`, `s.customer_id = uid`). Das ist die zentrale Sicherheitseigenschaft der einzigen Übergangsfunktion. Lockerung: Bedingung `and s.customer_id = uid` aus dem UPDATE entfernen. Probe als Kunde B auf die Anfrage von A, Ist-Status `withdrawn`. Test `withdraw: Kunde ok` (Teil „fremd not_found“).
2. **`guard_rental_status`** (`0017:118-132`). Mein Plan, Abschnitt „Neu redproof-s9a2“, verlangte den „Rental-Trigger“. Lockerung: Trigger entfernen. Probe als Eigentümer `status = 'completed'`, Ist-Wert `completed`. Test `Miete: nur requested → withdrawn`.
3. **Snapshot-Abgleich in `guard_revision_insert`** (`0018:46-60`, N-8) und **`version_unpublished`** (`0018:68-71`). Lockerung je Muster `if false and …`. Probe: Revision mit abweichendem Snapshot bzw. Version 99990 angelegt, Zeilenzahl 1.
4. **Tiefen-Ausnahme von `immutable_row`** (`0017:142`, `> 1` → `> 0`). Die Probe ist ein direkter Eigentümer-DELETE auf `price_revisions`, Zeilenzahl 0. Das belegt, dass die Schwelle die Ausnahme auf Kaskaden begrenzt.
5. **TRUNCATE-Trigger** `append_only_truncate`, `revision_immutable_truncate`, `request_delete_guard_truncate` (`0017:167`, `0018:85, 129`). Lockerung: Trigger entfernen. Probe `truncate … cascade` als Eigentümer, Zeilenzahl 0.
6. **Select-Policies** `price_revisions_select`, `request_contacts_select`, `status_events_select` (`0018:93, 221`, `0017:174`). Lockerung: `using (true)`. Probe als fremder Kunde bzw. als admin mit aal1, sichtbare Zeilen > 0.
7. Kleinere Fälle: `revoke update, delete` auf `request_contacts`/`fee_splits` für `service_role` (nur INSERT auf `fee_splits` ist belegt), `platform_settings_accept` (`0018:136-140`), `client_ref_required`/`preferred_date_required`/`setting_missing` und die vorgezogene Idempotenz (`0018:263-274`).
- Fix: Punkte 1 bis 3 vor dem Commit ergänzen, das Muster dafür ist im Skript vorhanden. Die Punkte 4 bis 7 ergänzen oder einzeln mit Begründung in `docs/OPEN_ISSUES.md` aufnehmen (S9a-3).

**M-3 · `supabase/functions/_shared/quote/handler.ts:195-198` mit `src/lib/quote.ts:111`, `src/screens/entruempelung/Ergebnis.tsx:73, 101`: Entrümpelung mit `low = high` wird ein verbindlicher Festpreis, der Kunde sieht aber „ca. X €“**
- Szenario: Kleine Flächen landen bei beiden Sätzen am Mindestpreis (`clearance.ts:57-58`, Golden-Fall „clear Mindestpreis“). Dann ist `low = high`. `amounts()` speichert `total_cents` und den Status `requested` (Festpreis nach Konzept 5.4), den der Partner ab S9c ohne Angebot annimmt. Die App zeigt diesen Betrag ganzzahlig gerundet als „ca. 180 €“ (`priceLabel(…, estimate = true)`, Unit-Test `draft.test.ts` „ca. 180 €“), und `Ergebnis.tsx:101` sagt „Fixpreis erst nach Prüfung durch den Partner“. Der verbindliche Betrag (z. B. 180,37 €) erscheint nirgends exakt, und der Text widerspricht dem gespeicherten Status. Den Unit-Test für diesen Fall hatte ich in Plan-Antwort 7.2 verlangt; er fehlt (Grep `tests/`: kein Treffer).
- Fix: `priceLabel` zeigt jeden Snapshot mit `totalCents !== null` exakt über `formatEuro`; `estimate` gilt nur noch für die Spanne. `Ergebnis.tsx` unterscheidet „Spanne“ (Text wie bisher) von „Festpreis“. Dazu je ein Unit-Test (Handler: Entrümpelung am Mindestpreis → `totalCents` gesetzt, `requested`; Anzeige: exakter Betrag ohne „ca.“). Die Alternative wäre, Entrümpelung immer als Angebot zu speichern. Das widerspricht Konzept 5.4 und kostet die Spanne.

### Niedrig

**N-1 · `tests/shots/shots.spec.ts:339` (Shot `gesendet-umzug`): Der Mock zeigt einen unmöglichen Zustand, und die Zeile fehlt in der Shot-Tabelle.** Gespeichert ist Festpreis 689,61 € mit `status: 'awaiting_offer'`, `needsQuote: true`. Selbst geöffnet (`tmp/shots/shots-390-light/gesendet-umzug.png`): Chip „Wartet auf Angebot“, „Wir melden uns mit einem Angebot“ und daneben der Festpreis. Der Server erzeugt das nie (`parseQuote`, `src/lib/quote.ts:231`). Die Referenz `12_Bestaetigung` zeigt „Angefragt“. Fix: `status: 'requested', needsQuote: false`, neu aufnehmen und die Zeile in die Tabelle aufnehmen.

**N-2 · `scripts/live-uploads.mjs:159` und `scripts/live-quote-app.mjs:72, 109`: Die Live-Skripte sind veraltet und würden FAIL melden.** `live-uploads`: Das DELETE der Anfragen ist entfernt, die Prüfung „Anfrage gelöscht: Foto-Zeilen sind mit weg“ und `deletedRequestPaths` (Waisen-Erwartung, `:158`) setzen es aber voraus. `live-quote-app`: Entrümpelung erwartet `c.lowCents <= c.totalCents` (jetzt `undefined`), und der Vergleich Vorschau gegen Server läuft über `totalCents`. Fix: In Fall 6 nur die Kontolöschung prüfen, Waisen nur aus gelöschten Konten erwarten. Bei der Entrümpelung `totalCents` fehlt, Spanne `low < high`, `status = 'awaiting_offer'` (wie im Plan-Abschnitt „Anpassungen“).

**N-3 · `tests/support/owner.ts:70` (M-3): Der Fix ist korrekt, der verlangte Beleg fehlt.** Es gibt keine Probe „Eigentümer nach Kundenschritt: `auth.uid()` = null“ (Grep `auth.uid()` in `tests/`: nur der Kommentar). Auch die Eigentümer-Probe „withdraw ohne Login → `not_found`“ fehlt; anon endet schon bei 42501. Fix: zwei Schritte in `status.test.ts` ergänzen (Wert-Schritt `=(select auth.uid())` nach einem Kundenschritt erwartet `= <null>`; `perform public.withdraw(…)` als Eigentümer erwartet `P0001: not_found`).

**N-4 · `tests/rls/status.test.ts`, R2-N9: Die Check-Regel `price_revisions_amounts` (`0018:26-30`) wird nie selbst ausgelöst.** Die einzige Probe dazu (`:190`) scheitert schon am Snapshot-Abgleich. Fix: Probe mit stimmigem Snapshot, aber ungültigen Beträgen, z. B. `kind price`, `lowCents 200`, `highCents 100`, kein `totalCents`, Anfrage `awaiting_offer`. Erwartet wird `23514`.

**N-5 · `tests/unit/draft.test.ts:222`: veralteter Fall `409 not_editable`.** Bearbeiten gibt es nicht mehr. Nach der globalen Regel (keine Altpfade) entfernen.

**N-6 · `scripts/redproof-s9a2.mjs:232-237`: „too_late“ verweist auf `tests/rls/quote.test.ts`, der Test wurde aber gelockert nicht ausgeführt.** Der Bericht formuliert „belegt“. Fix: `tests: 'Termin näher als accept_min_hours', testFile: 'tests/rls/quote.test.ts'` setzen; das Skript kann das schon (`:245`).

**N-7 · `docs/OPEN_ISSUES.md` (Patch Z. 11), N-10: Die Begründung der Ablehnung trägt nicht.** Eine zweite Schicht lässt sich als „Schicht“ ausweisen, und der Trigger-Beweis läuft als Eigentümer, wäre also gar nicht verdeckt. Bleibt die Ablehnung, dann mit der richtigen Begründung: Phase 2, keine Miet-Annahme vor S13. Dazu die Lücke ausdrücklich nennen (`service_role` darf `total_cents`/`price_snapshot` von `rental_bookings` ändern) und vor der Freigabe der Miete schließen.

**N-8 · `tmp/proof/s9a2-shots.md:7, 11, 19, 23`: Maße sind aus dem Bild geschätzt** („Mitte bei 296 px, Referenz 460 px“, „y≈130 statt ≈235“, „ca. 750 px“, „etwa 810 px“). CLAUDE.md:59 erlaubt Abstände und Breiten nur per `boundingBox()`/`getComputedStyle`. `shots:all` (768 px fehlt in der Tabelle, obwohl Bilder in `tmp/shots/shots-768-*` liegen) ist laut Kopf nicht gelaufen; CLAUDE.md:60 verlangt es vor dem Commit einer UI-Session. Fix: Maße per Playwright messen oder streichen; `shots:all` laufen lassen, der Reviewer prüft auch 768.

**N-9 · M-4 Rest: Die CLAUDE.md-Regel ist nicht um „DB-Testläufe“ ergänzt,** und dass `SUPABASE_PROJECT_ID` aus dem vitest-`globalSetup` bis zu den Workern und zu `ownerSql` (`execFileSync` ohne `env`) durchgereicht wird, ist nicht belegt. Das hängt mit dem offenen N-15 zusammen. Fix: Im Negativbeweis zu N-15 zusätzlich `npm run test:rls` mit falscher Ref → Abbruch vor dem ersten Test (Exit ≠ 0) zeigen.

**N-10 · Testzahlen-Begründung:** Der RLS-Abschnitt „Anfrage bearbeiten“ hatte nicht 5, sondern 8 Tests: drei `it` plus `it.each` mit fünf Status (siehe Patch Z. 883-927). Nur damit geht die Rechnung auf, siehe Prüffrage 5. Die Logs enthalten keine Exit-Codes, nur die Zusammenfassungszeilen. Den Exit-Code künftig in den Log schreiben (z. B. `; echo EXIT=$?`).

---

## Antworten auf die Prüffragen

### 1. Diff: Geld- und Sicherheitslogik

- **`handler.ts`**: Der Gebührenpfad ist vollständig entfernt (`feeRow`, `loadFeeRates`, `splitFee`-Import, `payeeId`). `quote` liest `current_fee_rates` nicht mehr. Die Antwort enthält weder Gebühr noch Vermieter. Der Status wird nicht mehr in TS bestimmt; `amounts()` (`:195-198`) bildet die Preisart nach Konzept 5.4 ab, die DB leitet den Status daraus ab. Fehlerabbildung über SQLSTATE **und** Meldung (`:186-187`), wie im Plan verlangt. Korrekt, Ausnahme M-3.
- **`db.ts`**: `findExisting` nutzt den Hinweis `!service_requests_current_revision` (N-7 erledigt). Eine fehlende Revision führt zum Abbruch (500), nie zu einer Antwort ohne Preis. Die RPC-Argumente passen exakt zur Signatur in `0018:234-241`. Korrekt.
- **`parse.ts`**: `requestId` → 400, `clientRef` und `preferredDate` sind Pflicht, `timeWindow` kommt nur aus der festen Liste. Damit gibt es zu jedem Fenster einen `window_start_*`-Schlüssel (`seed.sql:109-112`); `setting_missing` entsteht nicht durch Eingaben. Korrekt.
- **`snapshot.ts`**: `totalCents` nur bei `low = high`. Das ist konsistent mit `amounts()` und mit dem DB-Abgleich (`0018:51-57`). Miete hat `low = high = total` (`rental.ts:85`). Korrekt.
- **App (`src/lib/quote.ts`, `Auftraege.tsx`, `Gesendet.tsx`)**: Der Kunde liest den Snapshot über die eigene Revision (RLS `price_revisions_select`). Dort steht keine Gebühr. Die Spanne zeigt nur low/high. Die Prüfung `needsQuote` ⇔ (Angebot oder Spanne) ist richtig. Angezeigt wird kein Gebührentext. Ausnahme M-3.
- **Tests/Skripte**: `makeRequest` und die Fixtures laufen über `quote_save_request`, `fee_splits`-Fixtures per `ownerSql` (N-11). `withdraw` ersetzt alle Status-PATCHes. `storage-reset.mjs` hat dev-guard als ersten Import und prüft, dass nichts übrig ist (Exit 1). `dev-guard-setup.ts` als `globalSetup` des Projekts `rls` (`vite.config.ts`). Veraltet sind nur die Live-Skripte (N-2).

### 2. Migrationen

**Status am Funktionspfad vorbei?** Nein, außer durch den Eigentümer (dokumentierte Grenze, `0017:6`).
- `anon` und `authenticated`, auch admin mit aal1/aal2, Partner und Kunde: kein UPDATE-Recht (`0017:243`, Tabellen-REVOKE entzieht auch das Spaltenrecht aus 0001). Test `status.test.ts:37-54` belegt 42501 für alle Rollen und den Ist-Status `requested`.
- `service_role`: nur noch `update (current_revision)` (`0018:122-123`). Der Status scheitert zuerst am Recht (42501). Der Trigger mit Paar **und** zeilengebundenem Marker (`0017:226-231`, N-1 erledigt) kommt erst danach, ohne Rollen-Ausnahme.
- Der Marker ist über PostgREST nicht setzbar, und `withdraw` liefert ohne `auth.uid()` `not_found`.
- INSERT nur mit `requested`/`awaiting_offer`. Ohne Revision wird beim Commit verworfen (`require_revision`, jetzt SECURITY DEFINER, N-2 erledigt).
- `withdraw` arbeitet als Compare-and-Set mit fester Rolle `customer` und Akteur aus `auth.uid()` und räumt die Marker danach auf (Test `:104-112`).

**Revisionen unveränderlich?** Ja.
- UPDATE ist für alle gesperrt, auch für `postgres`. DELETE geht nur als Kaskade, TRUNCATE nie. `service_role` hat kein U/D/T (`0018:83-91`).
- Der Zeiger wird einmal gesetzt, nur auf n = 1/`submit` derselben Anfrage (`0018:144-165`), und ist danach unveränderlich.
- Frist, Termin und Bezirk sind unveränderlich (`0018:168-184`). Der Hash kommt aus dem Trigger.
- Löschen der Anfrage: `request_delete_guard` plus Revokes (M-2 erledigt). Es bleibt nur die Kaskade über die Kontolöschung (Positivkontrolle `status.test.ts:242-252`).

**Kundenpreis ohne Zustimmung?** Nein.
- Die Preisspalten von `service_requests` sind entfallen. Die Revision ist unveränderlich, der Zeiger einmalig.
- Umfang, Adressen, Kunde und Strecke darf `service_role` nicht mehr ändern (M-1 erledigt, Test `:227-231`, Rot-Beweis „UPDATE auf alle Spalten“).
- Bekannt bis S9a-3: keine Bindung an die gezeigte Version. Siehe außerdem M-3, dort geht es um die Anzeige, nicht um eine Änderung.

**`fee_splits`?** Strukturell garantiert.
- `quote_save_*` berühren die Tabelle nicht (`0018:234-354`), kein Trigger schreibt dorthin.
- `service_role` hat kein INSERT/UPDATE/DELETE/TRUNCATE (`0018:133`, N-11 erledigt). Belegt per Test `status.test.ts:142-146`, `quote.test.ts` „keine fee_splits-Zeile“ und Rot-Beweis „INSERT auf fee_splits“.

**Plan-Findings:**

| Finding | Stand |
|---|---|
| M-1 | erledigt (`0018:122-123`), Test und Rot-Beweis |
| M-2 | erledigt (`0018:124-130`); Hinweis für 0019 in OPEN_ISSUES (5) |
| M-3 | erledigt (`owner.ts:70`), Beleg fehlt (N-3) |
| M-4 | erledigt für `live-*.mjs`, `storage-reset.mjs`, `redproof-s9a2.mjs`, `globalSetup`; CLAUDE.md-Zusatz fehlt (N-9) |
| N-1 | erledigt (`0017:229, 259`), Test „Marker einer anderen Anfrage“ |
| N-2 | erledigt (`0018:188`) |
| N-3 | erledigt (`0018:111, 263-265`) |
| N-4 | erledigt (`::numeric::int` `0018:288`, Checks `0018:136-140`). Ein Check `max ≥ min` ist zeilenübergreifend nicht möglich, aber auch unnötig: `greatest(min, …) ≤ hours` gilt, weil `hours ≥ min` vorher erzwungen ist (`0018:291-297`) |
| N-5 | erledigt (`0018:266-271`) |
| N-6 | gegenstandslos; OPEN_ISSUES (7) richtig formuliert |
| N-7 | erledigt (`db.ts:67`, `Auftraege.tsx` COLUMNS) |
| N-8 | erledigt (`0018:46-60`), Tests `:186-188`, Rot-Beweis fehlt (M-2.3) |
| N-9 | erledigt (`storage-reset.mjs`, läuft nach 0017) |
| N-10 | bewusst abgelehnt, Begründung korrigieren (N-7 dieses Berichts) |
| N-11 | erledigt (`0018:133`) |
| N-12 | erledigt (Grant **und** durchlässige Policy, `redproof-s9a2.mjs:116`) |
| N-13 | erledigt (`owner.ts:78`) |
| N-14 | erledigt (`JSON.stringify(pattern)`, `redproof-s9a2.mjs:247`) |
| N-15, N-16 | offen in OPEN_ISSUES, S9a-3 zugeordnet |

### 3. Rot-Beweis

- **Ist-Wert:** 20 von 21 Einträgen messen die Wirkung im Sinne von CLAUDE.md:64. Gelockert erscheinen Status (`accepted`/`withdrawn`), Zeilenzahl (`1`, `2`, `0`, `3`) oder der geänderte Wert (`x`, `<null>`, `true`). Gesperrt erscheinen der genaue Fehler und der unveränderte Wert. Die Definitionen vorher und nachher sind identisch (`s9a2-redproof.log:84-85`, „REDPROOF BESTANDEN“). Abweichung: „withdraw für anon“ (M-1).
- **Schichten:** „DELETE auf service_requests“ (dahinter `request_delete_guard`), „UPDATE auf price_revisions“ (`revision_immutable`) und „quote_save_request für authenticated“ (RLS auf `platform_settings` → `setting_missing`) sind ehrlich ausgewiesen; die erste Schicht ist dort jeweils durch einen eigenen Sperr-Eintrag belegt. Nicht ehrlich ist nur M-1.
- **Neue Sperren ohne Beweis:** Liste in M-2. Am wichtigsten sind die Eigentümerprüfung von `withdraw`, `guard_rental_status` und der Snapshot-Abgleich samt `version_unpublished`.

### 4. Shot-Tabelle

- Alle 18 Zeilen enthalten Beobachtungen, die nur mit Bildsicht möglich sind (Chipfarbe, Preistext und -farbe, Icon, Tab „Miete“).
- Selbst geöffnet und verglichen:
  - `shots-390-light/gesendet-spanne.png`: blasser Teal-Chip „Wartet auf Angebot“, rechts „Richtpreis“ und darunter „950 € bis 1.550 €“ in Teal. Stimmt mit Zeile 7 überein.
  - `shots-390-light/auftraege-liste.png`: gelber Chip „Angefragt“ mit „689,61 €“, „Preis nach Prüfung“ grau, Spanne dunkel und fett, Tab-Leiste mit „Miete“. Stimmt mit Zeile 11 überein.
  - `shots-430-dark/gesendet-angebot.png`: „Montage“ mit Hammer, Mint-Chip, „Preis nach Prüfung“ grau, Buttons Teal und Mint. Stimmt mit Zeile 16 überein.
  - `shots-1280-light/auftraege-liste.png`: zentrierte Spalte, Umzug-Zeile einzeilig, Footer einzeilig, Tab-Leiste mit vier Tabs. Stimmt mit Zeile 23 überein.
  - Zusätzlich `shots-390-light/gesendet-umzug.png`: Diesen Shot hat der Diff geändert, er fehlt aber in der Tabelle und zeigt einen unmöglichen Zustand (N-1).
- Mängel: Maße aus dem Bild geschätzt, `shots:all` fehlt (N-8).

### 5. Testzahlen

- Laut Log: `check` 12 Dateien / 342 Tests bestanden (`s9a2-check.log:41-42`; Lint, Typecheck und Deno-Check sind vorher durchgelaufen). `test:rls` 7 Dateien / 124 Tests (`s9a2-rls.log:116-117`). `test:e2e` 83 bestanden (`s9a2-e2e.log:95`). Exit-Codes stehen nicht in den Logs (N-10). Die Zusammenfassungen zeigen aber keinen Fehlschlag.
- **Unit 342 → 342, plausibel.** Weggefallen in `quote.test.ts`: „fehlender Gebührensatz“ (ersetzt durch „quote kennt keine Gebühr“), „Umzug-Beispiel Gebühr“ (ersetzt durch „Entrümpelung (Spanne)“), die Zeile „Entrümpelung“ im `it.each` (−1), „Bearbeiten: requestId“ (ersetzt, dazu neu „preferredDate ist Pflicht“, +1). `55000/P0002` wurde zu `too_late/setting_missing` (2 → 2). Netto 0.
- **RLS 114 → 124, plausibel mit 8 statt 5.** `status.test.ts` bringt +16. In `quote.test.ts` entfallen 8 Bearbeiten-Tests, neu sind „Frist und Termin“ und „too_late“ (+2). Ergebnis 114 + 16 − 8 + 2 = 124. Mit 5 weggefallenen Tests ergäbe sich 127 (N-10).
- **E2E 82 → 83, plausibel:** +1 „Fehler 422 (Termin zu nah)“.

---

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `0017:226-231` | Paar, dann Marker `id:status`, keine Rollen-Ausnahme |
| `0017:243` | REVOKE UPDATE von authenticated (Tabelle, entzieht Spaltenrecht) |
| `0017:256-267` | `withdraw`: not_found ohne uid, Compare-and-Set, Marker geleert |
| `0017:142` | Tiefen-Ausnahme `> 1`; ohne Rot-Beweis (M-2.4) |
| `0018:46-60` | Abgleich Snapshot ↔ Beträge (N-8) |
| `0018:91, 122-125, 133` | Revokes für service_role: Revision U/D/T, Anfrage nur `current_revision`, kein D/T, profiles kein D, fee_splits kein Schreiben |
| `0018:127-130` | `request_delete_guard` + Truncate-Variante |
| `0018:188` | `require_revision` SECURITY DEFINER |
| `0018:263-271` | client_ref Pflicht, Idempotenz vor too_late |
| `0018:288-297` | `::numeric::int`; Frist ≤ Termin, weil `hours ≥ min` |
| `0016:27-28` | `window_start_*` ganzzahlig 0–1439 |
| `seed.sql:109-112` | alle vier Fenster-Schlüssel inkl. `flexible` |
| `handler.ts:186-187` | Abbildung über `P0001` + Meldung |
| `handler.ts:195-198` | `low = high` → Festpreis (M-3) |
| `db.ts:67, 73-75` | Embedding-Hinweis, Abbruch ohne Revision |
| `snapshot.ts:25` | `totalCents` nur bei `low = high` |
| `clearance.ts:57-60`, `rental.ts:85` | `low = high` bei Entrümpelung möglich; Miete immer `low = high` |
| `src/lib/quote.ts:111` | Festpreis bei `estimate` als „ca.“ gerundet (M-3) |
| `src/screens/entruempelung/Ergebnis.tsx:101` | „Fixpreis erst nach Prüfung“ (M-3) |
| `redproof-s9a2.mjs:219-224` | anon-withdraw: Wert unverändert, als „Sperre“ geführt (M-1) |
| `redproof-s9a2.mjs:116` | N-12: Grant + durchlässige Policy |
| `redproof-s9a2.mjs:247` | Muster gequotet (N-14) |
| `s9a2-redproof.log:84-85` | Definitionen identisch, BESTANDEN |
| `status.test.ts:37-54` | alle Rollen 42501, Ist-Status `requested` |
| `status.test.ts:97-101` | fremd `not_found`, anon 42501 |
| `status.test.ts:242-252` | Kaskade über `deleteUser` räumt 4 Tabellen |
| `owner.ts:70, 78` | Claims geleert; `<null>` statt leer |
| `live-uploads.mjs:158-159` | Prüfung setzt entferntes DELETE voraus (N-2) |
| `live-quote-app.mjs:72, 109` | erwartet `totalCents` bei Entrümpelung (N-2) |
| `draft.test.ts:222` | veralteter Fall 409 `not_editable` (N-5) |
| `shots.spec.ts:339` + Bild `shots-390-light/gesendet-umzug.png` | Festpreis mit „Wartet auf Angebot“ (N-1) |
| `CLAUDE.md:59-60, 64` | Regeln Maße, `shots:all`, Rot-Beweis |
| `s9a2-check.log:41-42`, `s9a2-rls.log:116-117`, `s9a2-e2e.log:95` | 342 / 124 / 83 bestanden |

Offene Findings hoch: 0
