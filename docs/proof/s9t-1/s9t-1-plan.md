# s9t-1 Plan zur Prüfung (Fable)

Sitzung: Testreste auf Dev (nur Dev `vcpbbzdyltvffvzjrzdi`). Keine Änderung unter `src/` oder `supabase/`, keine Migration, keine Änderung an Triggern oder Journal-Schutz, keine Status-Änderung an Firmen außerhalb des Testablaufs.

## 1 Ursache der verwaisten Testfirmen (Belege)
- `tests/support/sweep.ts` (Stand 7c4a53c) findet Testfirmen nur über `partner_members` JOIN `auth.users` (`pt-%@movenow.test`). `partner_members.user_id` ist `on delete cascade` (0023:42). Wird der Nutzer vor dem Aufräumen gelöscht, ist die Firma nicht mehr auffindbar: weder gesperrt noch gelöscht, und die Restzählung (`left`, gleiche Verbindung über Mitglieder) meldet 0.
- Der Aufräumer löscht selbst im zweiten Schleifenteil die `pt-`-Nutzer (Mitgliedschaft fällt weg): gebundene, gesperrte Firmen werden dadurch bei jedem Lauf zu Waisen. Das ist der Normalfall der 254 Waisen (alle `suspended`).
- Rot-Beleg: `tests/rls/sweep.test.ts` Test 1 (Nutzer zuerst löschen, dann `sweepTestResidue`): Ist `expected 'active' to be undefined`, Firma bleibt aktiv (`tmp/proof/s9t-1-rot-sweep-2.log`, EXIT=1). Test 2 und 3 (Wächter) sind schon heute grün, Lockerungsprobe folgt nach Umbau.
- Lesende Zählung Dev vor jeder Änderung: `tmp/proof/s9t-1-zaehlung-vorher.json`, `-count2-vorher.json`, `-timing-vorher.json` (Abfragen `tmp/s9t-1-count.sql`, `-count2.sql`, `-timing.sql`).

## 2 Zahlen auf Dev (vorher)
| Merkmal | Zeilen |
|---|---|
| partners gesamt | 254 |
| davon ohne Mitglied (verwaist) | 254 (alle Name „Testfirma GmbH“, alle `contact_email = firma@movenow.test`, alle `suspended`) |
| verwaist und aktiv/payment_hold | 0 |
| verwaist und gebunden (Zuordnung oder Angebot) | 254 (also 0 ungebunden) |
| davon mit Journal (Firmen) | 135, Journalzeilen an Testfirmen 320 |
| davon mit job_photos (uploaded_partner_id) | 44 Firmen (120 Zeilen `receipt ready`) |
| davon mit price_revisions.proposed_by | 41 Firmen (117 Revisionen) |
| partner_members | 0 |
| partner_documents / partner_regions / partner_categories / partner_vat_rules | 0 / 464 / 254 / 254 |
| job_listings an Testfirmen | 760 (227 accepted, 533 closed) |
| assignments | 227 (215 ohne `ended_at`) |
| partner_offers | 240 |
| auth.users | 134, davon 132 `pt-%@movenow.test`, 2 sonstige `%@movenow.test`, 0 echte |
| service_requests | 312, alle von `pt-`-Nutzern |
| pt-Nutzer ohne service_request | 0 (alle 132 hängen an Aufträgen, FK) |
| storage.objects | 0 |

Technisches Merkmal der 254 außer dem Namen: `contact_email = 'firma@movenow.test'` (Domain `.test` ist nach RFC 2606 reserviert, nie zustellbar). Der Audit-Log trägt die Firmen-IDs (762 Zeilen: `register_partner`, `approve_partner`, `set_partner_status` je 254), der Akteur (`actor_id`) existiert in `auth.users` nicht mehr (762 von 762); er taugt nicht als Marker.

## 3 FK-Kaskaden beim Löschen aus `partners` (Migrationen)
`partner_members` RESTRICT (0023:41), `partner_categories` (0023:50), `partner_regions` (0023:56), `partner_vat_rules` (0023:63), `partner_documents` (0024:126), `commission_entries` (0028:13), `assignments` (0030:57), `job_photos.uploaded_partner_id` (0035:20), `partner_offers` (0038:20), `price_revisions.proposed_by` ohne ON DELETE (= RESTRICT, 0040:11): alles RESTRICT. Nur `job_listings.partner_id` ist `on delete cascade` (0030:33).
Folge: Jede der 254 Firmen hängt an Zuordnung oder Angebot (und viele an Journal), kann nicht gelöscht werden (ON DELETE RESTRICT, Journal-Schutz) und ist bereits `suspended`.

## 4 Ergebnis für Teil C (Aufräumen der vorhandenen Reste)
**Es gibt kein Lösch-Skript.** Gelöscht wird auf Dev nichts: 0 der 254 Firmen sind ungebunden, 0 sind aktiv, 0 `pt`-Nutzer sind ohne Auftrag. Es wird nichts gesperrt (alle bereits `suspended`). Alle 254 Firmen, 320 Journalzeilen, 227 Zuordnungen, 240 Angebote, 760 Listings, 132 Nutzer, 312 Aufträge bleiben und werden nur gezählt und berichtet. Ein Löschen der Kind-Zeilen einzelner gesperrter Firmen (Regionen, Kategorien, USt.-Regeln, Listings) wäre eine halbe Löschung ohne Nutzen und wird nicht gemacht. Die Zahlen nachher werden nach den Volläufen erneut gezählt (nur Zuwachs durch den Lauf erwartet: je Lauf neue `pt-`-Nutzer, Aufträge, gebundene gesperrte Firmen aus den Live- und Wettlauftests, wie bisher).
Der Teil C verbleibt damit als Zählung (Anlage) und Eintrag in OPEN_ISSUES (Dev-Reste bleiben; vor dem Start frisches Projekt oder Dev neu aufsetzen, Beks).

## 5 Neue Markierung (Teil B, ohne Migration)
Kontaktadresse der Testfirma `pt-firma-<8 Zeichen Lauf-ID>@movenow.test`, gesetzt als Standard in `regArgs` (`tests/support/partner.ts`), `FIRM_MAIL_LIKE = 'pt-firma-%@movenow.test'`. Der Name „Testfirma GmbH“ ist kein Marker. Zusätzlich gilt ein Wächter: eine Firma gilt nur als Testfirma, wenn sie kein Mitglied hat, dessen E-Mail nicht `pt-%@movenow.test` ist.
Warum echte Daten sie nicht tragen können: .test ist nach RFC 2606 nicht zustellbar (eine echte Firma mit dieser Adresse bekäme nie Mails, die Plattform braucht die Adresse für Anfragen und Rechnungen), der Wächter schützt zusätzlich jede Firma, in der ein echtes Konto Mitglied ist. Restrisiko, das bleibt: eine echte Firma ohne Mitglied mit einer selbst gewählten Adresse im Muster `pt-firma-*@movenow.test` (Mitglied wäre vorher gelöscht). Die Sweeps laufen nur gegen Dev (`dev-guard`), nie gegen Produktion. Bitte bewerten.
Die alten 254 haben die Adresse `firma@movenow.test` und werden vom neuen Sweep nicht erfasst (sie sind alle gesperrt, es gibt nichts zu tun).

## 6 Der neue Aufräumer (VOLLER SQL-Text der Löschlogik, `tests/support/sweep.ts`)
Es ist derselbe DO-Block wie bisher, nur die Auswahl der Firmen ändert sich (Marker statt Mitgliedschaft). Der SQL-Text, wie er an Dev geschickt wird (`${COVER}` = `Testabdeckung GmbH`, `${admin}` = ID des Test-admin, `${final}` true/false):

```sql
do $sweep$
declare f record; u record;
begin
  for f in select p.id, p.status::text as st,
      (exists (select 1 from public.assignments a where a.partner_id = p.id) or exists (select 1 from public.partner_offers o where o.partner_id = p.id)) as bound
    from public.partners p where p.contact_email like 'pt-firma-%@movenow.test' and p.name <> '${COVER}'
      and not exists (select 1 from public.partner_members m join auth.users x on x.id = m.user_id where m.partner_id = p.id and x.email not like 'pt-%@movenow.test') loop
    begin
      if not f.bound then
        perform set_config('app.mv_partner_delete', f.id::text, true);
        delete from public.partner_documents where partner_id = f.id;
        delete from public.partner_vat_rules where partner_id = f.id;
        delete from public.partner_regions where partner_id = f.id;
        delete from public.partner_categories where partner_id = f.id;
        delete from public.partner_members where partner_id = f.id;
        delete from public.partners where id = f.id;
      elsif f.st in ('active', 'payment_hold') then
        perform public.admin_set_partner_status('${admin}', f.id, 'suspended', 'Testrest nach Wettlauftest ' || left(f.id::text, 8));
      end if;
    exception when others then raise warning 'sweep firm %: %', f.id, sqlerrm;
    end;
  end loop;
  for u in select id from auth.users x where x.email like 'pt-%@movenow.test' and (${final} or x.id <> '${admin}')
    and not exists (select 1 from public.partner_members m join public.partners p on p.id = m.partner_id where m.user_id = x.id and p.name = '${COVER}') loop
    begin
      delete from auth.users where id = u.id;
    exception when others then null; -- Kunde oder Mitglied mit Journal, Zuordnung oder Angebot: bleibt
    end;
  end loop;
end $sweep$;
select count(*) as n from public.partners p where <gleiche Firmenauswahl> and p.status in ('active', 'payment_hold');
```
Unverändert zum Stand 7c4a53c: Reihenfolge der Kind-Löschungen, Marker `app.mv_partner_delete`, Fehlerblock je Firma, Nutzerschleife, Abbruch bei aktiven Resten. Neu: Firmenauswahl (Marker + Wächter), die Restzählung nutzt dieselbe Auswahl, kein `distinct` mehr nötig.
Die ausgeführten Statements: nur in Testläufen von `npm run test:rls` (Dateien mit Wettlauf und Live-Tests und das neue `sweep.test.ts`) und nur gegen Dev. Sie treffen nur Firmen mit der neuen Marker-Adresse (die es heute auf Dev nicht gibt) und `pt-`-Nutzer wie bisher.

## 7 Weitere Änderungen (Tests, Doku)
- D: `tests/rls/job-photos.test.ts` (`photo_claim(50)` liefert höchstens 50 je Aufruf und beginnt bei der ältesten offenen Anfrage: fremde Reste verschieben das Ergebnis; jetzt bis zur leeren Antwort; neuer Test mit 64 fremden Fotos davor, Rot-Log `tmp/proof/s9t-1-rot-claim-1.log`), `tests/rls/listings.test.ts` (DELETE und UPDATE auf `assignments` jetzt mit `where request_id = '${R}'`; ein Rot-Beweis ist nicht möglich, weil der Trigger `append_only` schon bei der ersten Zeile abbricht, egal wie viele Zeilen es gibt).
- F: `docs/OPEN_ISSUES.md` (S9i7-1, S9i7-3: Belege-Migration S9i7-12, nicht 0059; S9i7-15 Messarten), `docs/S9_KONZEPT.md:239` Bedingung 3 nach S9h2-2.
- E (Dauer von rls): gemessen auf Dev: Abfragen über die Reste kosten 1 bis 16 ms im Server (`s9t-1-timing-vorher.json`); ein CLI-Aufruf (`select 1`) kostet 2,3 s Wanduhr. Die Reste sind damit als Ursache der Dauer ausgeschlossen (je Testaufruf ein CLI-Aufruf; Zeilenzahlen der Reste im 1000er-Bereich). Dauer je Datei und Messarten kommen aus den Volläufen.

## 8 Fragen an Fable
1. Ist die Marker-Auswahl (Adresse `pt-firma-*@movenow.test` + Wächter „kein Mitglied außerhalb pt-Testkonten“) sicher genug, dass der Aufräumer nie eine echte Firma löscht oder sperrt? Wenn nicht: welche zweite Bedingung ohne Migration?
2. Stimmt dir, dass auf Dev nichts gelöscht werden darf und kein Aufräum-Skript nötig ist (Abschnitt 4)? Gibt es eine löschbare Teilmenge, die ich übersehen habe?
3. Ist der SQL-Text in Abschnitt 6 so freigegeben (Reihenfolge, `set_config` mit Marker, Ausnahmeblock)?
4. Rot-Test 3 (Wächter, fremde Kontaktadresse) und Test 2 (Mitglied echtes Konto): taugen sie als Lockerungsprobe nach Entscheidung 85 (Wächter bzw. Marker entfernen, Test muss rot werden)?
