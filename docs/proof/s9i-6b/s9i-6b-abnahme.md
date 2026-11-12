Modell: claude-fable-5-2

# Abnahme s9i-6b (Partner-Portal 2b): Geld- und Sicherheitslogik

- Datum: 2026-11-12
- Berater: `advisor-report`. Das eingebaute `advisor`-Tool (ohne Parameter) stand in meiner Tool-Liste; nicht aufgerufen (CLAUDE.md).
- Umfang (vollständig gelesen): `supabase/migrations/20261112100000_0057_my_jobs.sql`, `tests/rls/partner-my-jobs.test.ts`, `src/lib/partnerJobs.ts`, `src/screens/partner/Auftraege.tsx`, `src/screens/Partner.tsx`, `src/screens/partner/Anfragen.tsx`, `src/lib/jobs.ts`, `src/screens/auftrag/Bestaetigen.tsx`, `src/components/Sheet.tsx`, `tests/e2e/jobs-helpers.ts`, `tests/e2e/partner-auftraege.spec.ts`, `tests/unit/partner-my-jobs.test.ts` (ab Zeile 28), `tmp/proof/s9i-6b-plan.md`.
- Gegengeprüft (Abschnitte): 0023, 0018, 0019, 0028, 0030, 0032, 0040, 0041, 0043, 0046, 0048, 0050, `supabase/functions/_shared/quote/parse.ts`, `tests/support/owner.ts`, `docs/S9_KONZEPT.md`, `docs/OPEN_ISSUES.md`, Logs `tmp/proof/s9i-6b-*.log`.
- Einschränkung: `git diff 8c41d1a` konnte ich nicht ausführen (kein Bash). Die genannten Dateien habe ich im Arbeitsstand gelesen, nicht als Diff; ob weitere Dateien unter `src/` geändert sind, habe ich nicht geprüft. Nichts ausgeführt, alle Aussagen stammen aus dem Lesen von Code und Logs.

## Ergebnis

Kein hoher Befund. 0057 bleibt unverändert, eine Migration 0058 ist nicht nötig. Die Punkte der Plan-Prüfung (M1, M2, N2, Summen nach Storno, kein Audit, service_role) sind umgesetzt. Drei mittlere Befunde: `mailto:`-Parameter aus der Kunden-E-Mail (M1), Lücken im RLS-Test bei Nachtrag und Partner-Storno (M2), Rot-Beweis misst keine Sperre (M3). M1 ist eine Zeile plus Test und sollte vor dem Commit hinein.

## Findings

### hoch
Keine.

### mittel

**M1** `src/lib/partnerJobs.ts:329` – Problem: `mailHref` lässt `?`, `&`, `=`, `%`, `#`, `,` durch. Der Server tut das ebenfalls (`supabase/functions/_shared/quote/parse.ts:55`, CHECK `request_contacts_format` in `0019:83`: nur „kein @, kein Leerraum“). Ein Kunde kann als E-Mail z. B. `kunde@firma.at?subject=...&body=...&bcc=dritter%40x.at` hinterlegen; tippt die Firma den Link an, öffnet ihr Mailprogramm mit vom Kunden bestimmtem Betreff, Text und (über `%40`) weiteren Empfängern. Kein XSS (festes Präfix, React escaped den Text), aber Parameter-Injektion in die URL. `telHref` ist sauber (nur Ziffern und führendes Plus). – Fix: Zeichenmenge positiv festlegen, sonst kein Link (Text bleibt sichtbar):
`const MAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/` und `mailHref = (e) => (MAIL.test(e) ? 'mailto:' + e : null)`. Unit-Test `tests/unit/partner-my-jobs.test.ts:160-163` um die Fälle `a@b.at?subject=x`, `a@b.at?bcc=c%40d.at`, `a@b.at&body=x`, `a%40b@c.at`, `a@b.at#x`, `a,b@c.at` erweitern (alle `null`). Keine Migration; die Senke ist die App.

**M2** `tests/rls/partner-my-jobs.test.ts:76-129` – Problem: Die Beträge sind nur für Buchung und Kunden-Storno (0 und 50 %) festgenagelt. Es fehlen genau die Wege, bei denen die Summe aus mehreren Zeilen oder mehreren Aufträgen entsteht:
1. Nachtrag: nach `decide_change` auf 80000 muss `my_jobs()` `80000` und `splitFee(80000).payoutCents` liefern (der Trigger erzwingt die kumulierte Rechnung, `0040:276-282`; gebucht wird das Delta, `0041:113`). Ein offener oder abgelehnter Nachtrag ändert nichts.
2. Storno durch die Firma: ohne Belege Summe `0:0`, mit Pauschale `6900` und deren Auszahlung (`0048:49-55`); die UI-Beschriftung „Pauschale“ hängt daran und ist bisher nur gegen einen Mock geprüft.
3. Weitervermittlung (`0048:61-65`, neue Auftrags-ID): Firma A sieht die Folgeanfrage nicht (auch nicht nach Annahme durch B), Firma B sieht nach Annahme nur die Folgeanfrage mit vollem Betrag und nie die Quelle; `job_contact` von B auf die Quelle endet mit `not_assigned`.
Die Logik ist nach meinem Lesen richtig (eine Buchung je Auftrag `0028:42`, Journalzeilen immer mit der Firma der Zuordnung, Ausschluss `0046:218-227`); es fehlt der Test, der eine spätere Änderung an der Summe (z. B. Filter auf `kind`) auffängt. – Fix: einen vierten Testfall ergänzen; die Hilfen gibt es schon (`tests/rls/change-orders.test.ts:47-58` `propose`/`decide`, `tests/rls/cancellation-partner.test.ts:35,72` `follow`/`cancel_by_partner`). Erwartungen als `lineOf(...)`-Zeilen und Zeilenzahlen je Firma.

**M3** `tmp/proof/s9i-6b-rot-rls.log:14,28-48` – Problem: Der Rot-Lauf scheitert an „Funktion existiert nicht“ (42883) und im ersten Test an einem Setup-Fehler (`invalid_transition` aus `guard_request_insert`). Das belegt, dass der Test die Funktion braucht, nicht, dass er eine Sperre misst (CLAUDE.md: Rot-Beweis zählt nur mit Ist-Wert der gelockerten Sperre). – Fix: ein Rot-Lauf mit gelockerter Sperre ohne Migration: im `setup` der Probe (läuft als Eigentümer in `begin … rollback`, DDL ist transaktional) `create or replace function public.my_jobs()` in einer Variante ohne `private.assignment_access(...)` in Zeile 46 bzw. mit `my_member_partner_id()` statt `my_job_partner_id()` in Zeile 31; erwartet rot mit Ist-Wert `= 6` statt `= 5` („a Anzahl“) bzw. sichtbaren Zeilen für `suspended`. Log nach `tmp/proof/`, die Variante nicht committen. Bis dahin in PROGRESS nicht als Rot-Beweis der Sperren führen.

### niedrig

**N1** `tests/rls/partner-my-jobs.test.ts:97-102,137` – Problem: Die Verweigerungen laufen als `perform * from public.my_jobs()`; bei gelockerter Sperre wäre der Ist-Wert nur `ok`, nicht die Zeilenzahl. Zulässig („Aufruf erfolgreich“), aber schwächer als nötig, vor allem bei `suspended` (hat einen Auftrag) und `a aal1` (hat fünf). – Fix: diese beiden als `=(select count(*) from public.my_jobs())`; Erwartung bleibt die Fehlermeldung.

**N2** `tests/rls/partner-my-jobs.test.ts` (fehlend) – Problem: `correction` und T14 sind nicht abgedeckt: `negate_fee` nach Storno mit Stufe ergibt `0:0` (`0050:64-72`); admin-Storno aus `completed` ändert Status und `ended_reason`, `ended_at` bleibt (`0050:99-103`), der Auftrag fällt also nicht neu ins Zugriffsfenster. – Fix: zwei Zeilen im neuen Testfall aus M2 (Hilfen in `tests/rls/admin-correct.test.ts`).

**N3** `docs/OPEN_ISSUES.md:564` (S9i6b-2) – Problem: Der Eintrag stammt aus meiner Plan-Prüfung (N3) und ist sachlich überholt: 0050 setzt `ended_at = coalesce(ended_at, now())` (`0050:100`) und der Trigger verlangt unverändertes `ended_at` (`0050:13-16`). T14 öffnet kein neues Zugriffsfenster. – Fix: Eintrag als „erledigt durch 0050 (M1 der S9h-3-Abnahme)“ schließen.

**N4** `src/lib/jobs.ts:70` – Problem: `asKind` schlägt weiter ungeschützt nach (S9i6-9 K1); `acceptListing` und `loadPhotos` laufen darüber (`partnerJobs.ts:209,228`). Ein Fehlercode wie `constructor` ergäbe einen leeren Hinweis. In 6b laufen ohnehin Volläufe. – Fix: `Object.hasOwn(codes, code) ? codes[code] : undefined`.

**N5** `src/lib/partnerJobs.ts:212-213` – Problem: Der Gewinner-Retry belegt den Erfolg weiter über das Listing (bleibt bis 30 Tage `accepted`, auch nach Storno), nicht über die Zuordnung (S9i6-9 K5, für 6b vorgesehen). `my_jobs()` liefert `listing_id`, `loadJobs` verwirft es (`partnerJobs.ts:266-282`). Folge nur kosmetisch, die Auftragsliste zeigt danach den wahren Stand. – Fix: `listingId` in `Job` aufnehmen und in `acceptListing` `loadJobs()` prüfen (`j.listingId === l.id && !j.ended`).

**N6** `src/screens/partner/Auftraege.tsx:62` – Problem: Ein stilles Neuladen lässt die Liste bei jedem Fehler stehen, auch bei `partner_not_active` oder `mfa_required` (Firma inzwischen gesperrt, zweiter Faktor weg). Die Liste enthält keine Personendaten und jede Aktion prüft der Server; die Anzeige bleibt aber dauerhaft veraltet, und `recheck` der Schranke wird nicht gerufen (wie S9i6-3). – Fix: in `fetchJobs` bei `error.message` aus diesen beiden Codes immer auf `error` wechseln (Liste verwerfen); optional `onDenied` wie bei `Dokumente` (`Partner.tsx:76`).

**N7** `src/lib/partnerJobs.ts:301-304`, `tests/unit/partner-my-jobs.test.ts:119-124` – Problem: Der Zweig `offline` wird real kaum erreicht (supabase-js liefert Netzfehler als `error`, nicht als Ausnahme), der Unit-Test prüft diesen unwirklichen Weg (wie S9i6-2). Wirkung: Text „Das hat nicht geklappt“ statt „Keine Verbindung“, beide wiederholbar. – Fix: Hinweis, kein Blocker; sauber wäre `error.message` mit „Failed to fetch“ auf `offline` abzubilden und so zu testen.

**N8** `src/lib/partnerJobs.ts:324-327` – Problem: `+43 (0) 660 …` wird zu `+430660…` (falsche Nummer); der Server erlaubt Klammern. Kein Sicherheitsproblem. – Fix: vor dem Säubern `(0)` nach einer Ländervorwahl entfernen, Testfall ergänzen.

**N9** `tests/rls/partner-my-jobs.test.ts:38-44,85,93` – Problem (Test-Schärfungen): die Kennzeichen-Probe deckt `description` und `inputs` nicht ab (beide ohne Kennzeichen angelegt); `provolatile` ist nicht festgenagelt (als `stable` kann die Funktion gar nicht schreiben, das macht „kein Audit“ strukturell sicher); `to_district` wird nie mit Wert geprüft. Der 60-s-Takt (`Auftraege.tsx:82`) hat keinen E2E-Test, nur der Fokus-Weg (`partner-auftraege.spec.ts:203-210`). – Fix: Kennzeichen in `description` und `inputs` setzen; `provolatile` in „Sicherheitsattribute“ aufnehmen (`s`); Takt mit `page.clock` prüfen.

**N10** `src/screens/partner/Auftraege.tsx:177-178` – Hinweis für Beks, keine Änderung nötig: Der Knopf „Kontakt und Adresse anzeigen“ steht auch bei stornierten Aufträgen ohne Betrag und bei von der Firma selbst stornierten (30 Tage). Das entspricht der Entscheidung (`docs/S9_KONZEPT.md:469`, Fenster auch nach Storno), jeder Abruf wird protokolliert. Wer es enger will, blendet den Knopf bei Storno ohne Betrag aus; der Server bliebe gleich.

**N11** `tmp/proof/s9i-6b-e2e-gezielt-1.log:227,234`, `tmp/proof/s9i-6b-e2e-gezielt-2.log:46-47` – Problem (Nachweisstand): Lauf 1 hat 38 bestanden und 5 rot (EXIT=1), Lauf 2 nur 36 bestanden (EXIT=0); die Auswahl stimmt also nicht überein, und `tests/e2e/partner-auftraege.spec.ts` ist seit dem WIP-Commit geändert. `check` liegt nur als „vor“ vor. – Fix: nach M1/M2 die Abschlussläufe (`check`, `test:e2e`, RLS) vollständig mit EXIT=0 aufnehmen.

**N12** `src/lib/partnerJobs.ts:272` – Problem: `ended: r.ended_at !== null` wertet ein fehlendes Feld als „beendet“. Fällt auf die sichere Seite (kein Startknopf), ist aber keine strenge Prüfung. – Fix: `r.ended_at === null ? false : when(r.ended_at) ? true : Zeile verwerfen`.

## Prüffragen

**(1) 0057: alles umgesetzt? 0058 nötig?**
Umgesetzt, 0058 nicht nötig.
- SQL entspricht dem Plan: Prüfungen in der Reihenfolge von `start_job`/`job_contact` (`0057:29-32` gegen `0032:12-15,65-68`), SECURITY DEFINER mit leerem `search_path`, alle Spalten qualifiziert (keine Kollision mit den OUT-Namen), Summen nur aus Zeilen von `request_id` und `partner_id` der Zuordnung (`0057:41-45`), Filter `0057:46`, Rechte `0057:51-52`. Ob der Stand auf Dev byte-gleich ist, kann ich nicht sehen; der Test nagelt dort Spaltenliste, Rechte und Attribute.
- M1 Beschriftung nach Storno: `Auftraege.tsx:138-148` („Betrag nach Storno“, „Pauschale“, bei 0 „Storniert, es fällt kein Betrag an.“), E2E `partner-auftraege.spec.ts:143-165`.
- M2 Neuladen: Fokus, `visibilitychange` und 60 s nur solange ein angenommener Auftrag wartet und der Tab sichtbar ist (`Auftraege.tsx:77-88`).
- N2 null-Beträge: `partnerJobs.ts:257,278-279`, `Auftraege.tsx:139`, Unit `:61-69`, E2E `:167-171`.
- Tests Summen nach Storno: `partner-my-jobs.test.ts:91-92,117-118`. Kein Audit: `:94,103,120`. service_role `not_found`: `:102,121`.
- Nebenläufigkeit: `stable`, keine Schreibzugriffe, keine Sperren; `can_start` und Status sind eine Momentaufnahme, der Server entscheidet bei `start_job` neu (`0032:16-21`, `for update`).

**(2) RLS-Test: Lücken? Misst jede Prüfung die Wirkung?**
- Lücken: Nachtrag, Partner-Storno mit und ohne Pauschale, Firma B nach Weitervermittlung (M2); `correction` und T14 (N2).
- Wirkung: Die positiven Proben messen Zeilen und Werte (`a Anzahl = 5` mit RO außerhalb des Fensters, `b Anzahl = 1` neben `b sieht A nicht = 0`, Kennzeichen-Probe mit Gegenkontrolle `:104-106`, Audit-Zähler vorher/nachher, Statusfolge `:162-170`). Die Verweigerungen messen Fehlermeldungen; bei gelockerter Sperre käme `ok` statt einer Zahl (N1). Der vorhandene Rot-Lauf misst keine Sperre (M3).
- Hinweis zur Doppelsicherung: `a.partner_id = pid` und `assignment_access(a.request_id, pid)` überlappen (beide binden an die eigene Firma), ebenso die aal-Prüfung in Zeile 30 und in `my_job_partner_id()`. Ein Rot-Beweis muss deshalb die Fensterprüfung bzw. den Helfer lockern, nicht eine der doppelten Zeilen.

**(3) App**
- Kontakt nur auf Antippen: `loadContact` wird nur aus `open()` gerufen (`Auftraege.tsx:200-209`), der Zustand lebt nur in `Kontakt`, `close` setzt ihn auf `null`, das Sheet rendert die Daten nur bei `ready` (`:233`). Kein Abruf im Hintergrund, kein Speicher, kein Log. Der Knopf ist gesperrt, solange das Sheet offen ist (`:217`), ein Zähler verwirft überholte Antworten (`:198-213`). E2E prüft vorher, nachher und die Zahl der Abrufe (`partner-auftraege.spec.ts:40-59`). In Ordnung.
- Beträge nur vom Server: `Auftraege.tsx` importiert weder `splitFee` noch `payoutCents` noch `loadRates`; `splitFee` bleibt auf offene Listings beschränkt (`Anfragen.tsx:101`, Vorschau, der Server vergleicht bei der Annahme). In Ordnung.
- Keine Gebühr, kein Prozent: keine solche Zeichenkette in `Auftraege.tsx`; die Differenz zwischen „Preis für den Kunden“ und „Du erhältst“ ist für die Firma gewollt sichtbar. Kunden erreichen die Liste nicht (`Partner.tsx:74-75`, Server: `partner_not_active`).
- XSS/URL: kein XSS; `tel:` sauber; `mailto:` mit Parameter-Injektion (M1).
- Neuladen (`seq`): nur die jüngste Antwort gilt, Unmount und `reloadKey` entwerten laufende Abrufe (`Auftraege.tsx:53-76`); eine Antwort von vor einer Aktion kann die Antwort danach nicht überschreiben. Kein Befund außer N6 (veraltete Liste bei Rechtefehlern).
- Fehlerzuordnung: eigene Schlüssel per `Object.hasOwn` (`partnerJobs.ts:44,300`), Tabelle `:287-294` passt zu den Codes aus `0032`/`0043`; `not_assigned` ist abweichend vom Plan `gone` statt `closed`, beides lädt neu. Offen: N4 (`asKind`), N7 (`offline`).

**(4) Übriger Diff**
`Anfragen.tsx`: der Abschnitt „Angenommen“ ist entfernt, `onChange` stößt das Neuladen der Aufträge an; keine neue Geldlogik. `Partner.tsx`: Aufträge für `active` und `payment_hold`, Anfragen nur `active`, beides hinter der aal2-Schranke; `pending` ruft nichts ab. `jobs-helpers.ts`: nur Mocks mit erfundenen Platzhaltern, keine Secrets. `supabase/`: nur 0057. Kein Befund außer den oben genannten.

## Stichproben

| Datei:Zeile | Ergebnis |
|---|---|
| `supabase/migrations/20261112100000_0057_my_jobs.sql:24` | plpgsql, stable, security definer, `search_path = ''` |
| `…0057_my_jobs.sql:29-32` | `not_found`, `mfa_required`, `partner_not_active` in der Reihenfolge von 0032 |
| `…0057_my_jobs.sql:41-46` | Summen und Filter an Firma und Auftrag der Zuordnung gebunden |
| `…0057_my_jobs.sql:51-52` | `revoke` von public und anon, `grant` nur authenticated |
| `…0023_partners.sql:46` | `unique (user_id)`: ein Konto, eine Firma; `my_job_partner_id()` ist eindeutig |
| `…0023_partners.sql:97-102` | `active` oder `payment_hold`, aal2 |
| `…0030_job_listings.sql:48` | `unique (request_id, partner_id)`: der LEFT JOIN vervielfacht nicht |
| `…0030_job_listings.sql:87-95` | Fenster: aktiv oder `ended_at` jünger als `partner_access_days` |
| `…0018_revisions_contacts.sql:114` | `termin_at not null`: `can_start` ist nie NULL |
| `…0028_commission_journal.sql:42` | eine `booking`-Zeile je Auftrag |
| `…0041_s9f_abnahme.sql:113` | `change` bucht das Delta für `rev.proposed_by` |
| `…0040_change_orders.sql:276-282` | kumulierte Gebühr und Auszahlung = Rechnung auf den neuen Gesamtpreis |
| `…0046_cancel_by_partner.sql:272-288` | Gegenbuchung als exakte Negation je Zeile |
| `…0048_partner_cancel_rules.sql:49-65` | Storno der Firma: Gegenbuchung, Pauschale nur mit Belegen, sonst Folgeanfrage mit neuer ID |
| `…0050_s9h3_abnahme.sql:99-103` | T14 lässt `ended_at` beendeter Zuordnungen stehen (widerlegt OPEN_ISSUES S9i6b-2) |
| `…0032_job_flow.sql:69-71` | `job_contact`: Fensterprüfung, dann Audit-Zeile je Aufruf |
| `…0019_quote_hardening.sql:83` | E-Mail-CHECK erlaubt `?`, `&`, `%` (Grundlage M1) |
| `supabase/functions/_shared/quote/parse.ts:55-56` | dieselben Muster in der Edge Function |
| `src/lib/partnerJobs.ts:256-257` | Bezirk 1 bis 23, Cent ganzzahlig und nicht negativ, sonst `null` |
| `src/lib/partnerJobs.ts:265` | Zeile entfällt bei ungültiger ID, Status, Leistung, Termin, `can_start` |
| `src/lib/partnerJobs.ts:316-321` | Kontakt nur bei genau einer vollständigen Zeile |
| `src/lib/partnerJobs.ts:324-329` | `tel:` sauber, `mailto:` zu weit (M1) |
| `src/screens/partner/Auftraege.tsx:53-64` | `seq` verwirft überholte Antworten |
| `src/screens/partner/Auftraege.tsx:138-148` | Beschriftung nach Storno, kein Betrag bei `null` |
| `src/screens/partner/Auftraege.tsx:196-237` | Kontakt erst nach Antippen, beim Schließen verworfen |
| `src/screens/Partner.tsx:69-75` | Schranke aal2, Aufträge für `active`/`payment_hold`, Anfragen nur `active` |
| `src/lib/jobs.ts:70` | `asKind` ohne `Object.hasOwn` (N4) |
| `tests/rls/partner-my-jobs.test.ts:83-85,109-111` | Spaltenliste, Rechte, Attribute festgenagelt |
| `tests/rls/partner-my-jobs.test.ts:113-118` | Zeilenzahl, Fenster, Summen nach Storno |
| `tests/rls/partner-my-jobs.test.ts:131-145` | `payment_hold` sieht eigene, `suspended` Fehler |
| `tests/rls/partner-my-jobs.test.ts:173-188` | Audit +2, fremde Firma `not_assigned`, Statusfolge |
| `tests/rls/rls.test.ts:459` | `my_jobs()` in der Liste der für authenticated offenen Funktionen |
| `tests/unit/partner-my-jobs.test.ts:160-163` | `mailHref`-Fälle ohne `?`, `&`, `%` |
| `tests/e2e/partner-auftraege.spec.ts:35,55` | Kontakt und Auftrags-ID nie im DOM, nach dem Schließen wieder weg |
| `tmp/proof/s9i-6b-rls-gezielt.log:6,10` | 3 bestanden, EXIT=0 |
| `tmp/proof/s9i-6b-rot-rls.log:28-48` | rot nur wegen fehlender Funktion (M3) |
| `tmp/proof/s9i-6b-e2e-gezielt-1.log:227,234` | 5 rot, EXIT=1 |
| `tmp/proof/s9i-6b-e2e-gezielt-2.log:46-47` | 36 bestanden, EXIT=0 |
| `docs/S9_KONZEPT.md:469` | Zugriffsfenster gilt auch nach Storno (Entscheidung Beks) |

Offene Findings hoch: 0
