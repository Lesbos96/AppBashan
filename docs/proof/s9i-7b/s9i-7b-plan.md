# s9i-7b Plan: Storno durch die Firma, Funktionstests, Dev = main (Entwurf zur Planprüfung)

Basis: main 3f23e25, Branch s9i-7b, Migrationen bis 0058, 0059 = `20261112120000_0059_partner_cancel_preview.sql`. Belege der Fakten: Explore-Bericht, Kerndateien selbst gelesen (0048, 0047, 0046:272-452, 0040:303-325, 0041:183-199, 0030:87-95, partner.ts, change/handlers.ts:84-135).

## A) Storno-Ablauftabelle

| Wirkung | heute (Datei:Zeile) | geplant | Test |
|---|---|---|---|
| Status, Rollen inkl. payment_hold | `private.change_gate` 0040:303-325: aal2 (`mfa_required`), Mitglied, Firma `active` oder `payment_hold` (sonst `partner_not_active`), aktive Zuordnung (sonst `not_found`), Status `accepted`/`in_progress` (sonst `invalid_transition`). Edge: aal2 nochmals in `authed` (jobs/handlers.ts:56) | unverändert; Vorschau nutzt dasselbe Tor | live: 401, Kunde, fremde Firma, aal1, pending/rejected/suspended |
| Arbeitsbeginn-Tor | Konzept T13 (S9_KONZEPT:236) erlaubt `accepted`/`in_progress`; ab `termin_at` nur Grund `scope_impossible` (0048:27) | unverändert (das Konzept schweigt nicht; ein „nur vor Arbeitsbeginn“ würde Konzept 10.3 vor Ort aushebeln). FRAGE 1 | bestehende Tests cancellation-partner |
| Auftrag, Zuschlag | `set_request_status(... cancelled_by_partner)` 0048:49, Zuordnung endet 0048:50; Festangebot (`partner_offer`) ohne Weitervermittlung 0046:399 | unverändert | bestehend |
| Kundenbetrag | Journal komplett negiert (0048:51, 0046:272-288); Kunde schuldet nur eine evtl. Pauschale, außerhalb der App (S9_KONZEPT:600) | unverändert; Vorschau nennt es der Firma in Worten; Kunde sieht Betrag über neue `my_cancel_info` | rls: my_cancel_info |
| Partneranteil | Gegenbuchung 0 (0048:51) | unverändert | bestehend |
| Gebühr | Bei Pauschale: `cancellation_fee` mit Satz der Buchungszeile 0048:52-54, `splitFee` in der Edge Function | Vorschau zeigt der Firma Pauschale, Gebühr und Auszahlung (nur Firma, nie Kunde) | unit |
| Pauschale: Grundlage | `call_out_base` 0046:362-377: `call_out_fee_cents` aus Snapshot der gültigen Revision, höchstens Gesamtpreis, sonst `terms_missing`; Grund + Nachtrag + Belege nur in `cancel_by_partner` 0048:28-40; Grundlage 0047:62-79 ruft `call_out_base` immer auf (auch ohne Berechtigung) | gemeinsame Prüffunktionen für Grundlage und Storno (M1); `callOutCents` nur bei Berechtigung | rls Matrix |
| Pauschale: Berechtigung | 0048:30: IRGENDEIN `declined`/`expired` Nachtrag (M4) | verschärft: kein offener Nachtrag und der LETZTE entschiedene (accepted/declined/expired, nach `decided_at`) ist declined/expired; withdrawn zählt nicht | rls Matrix |
| Pauschale: Betragsabgleich | `p_fee_base = base` sonst `amount_mismatch` 0048:41; Edge-Schleife ohne gezeigten Betrag (M2, partner.ts:49-55) | `shownCallOutCents` Pflicht, nach JEDEM `basis` verglichen, Abweichung 409 `amount_changed`, nichts angelegt | unit, live |
| Journal | append-only 0028:47-50, einmalige Gegenbuchung `commission_one_reversal` 0028:43 | unverändert | bestehend |
| Offene Nachträge | Trigger `close_changes` 0041:183-199 setzt `proposed` → `expired` bei Statusende + Outbox | unverändert; Pauschale nur ohne offenen Nachtrag (sonst könnte die Firma den Nachtrag selbst „ablaufen“ lassen) | rls |
| Angenommene Nachträge | `cancel_reverse_all` bucht je `change`-Zeile die Negation 0046:279-286 | unverändert | bestehend |
| Belege | Beleg-IDs im Audit 0048:57-59; 8er-Grenze 0048:33; Prüfung Art, `ready`, Firma, Auftrag 0048:35-36 | Vorschau OHNE `photoIds` (M3); unverändert im echten Aufruf | live |
| job_contact danach | `assignment_access` 0030:87-95: bis `partner_access_days` (30) nach Ende; Konzept 5.5 (S9_KONZEPT:349, 405, 469) ist Entscheidung Beks | unverändert. FRAGE 1: bei Storno ohne Pauschale schließen? | – |
| Kunde: Anzeige | cancel.ts:82-83 nur „Der Partner hat den Auftrag storniert.“, kein Grund, keine Folgeanfrage, keine Pauschale | `my_cancel_info(request)` (Pauschale, Folgeanfrage); Text: nichts zu zahlen / Pauschale (Widerspruch möglich) / neue Anfrage | e2e, Bildsicht |
| Benachrichtigung | Outbox `request_reissued`/`partner_cancelled_fee`/`partner_cancelled` 0048:66-72 | unverändert, Mailversand → OPEN_ISSUES | – |
| Weitervermittlung | nur bei `base = 0` 0048:61, Quelle nicht Festangebot, Termin ≥ reissue_min_hours 0047:25-29 | unverändert, keine Vorhersage in der Vorschau (Text neutral) | bestehend |
| Audit | 0048:57-59 | unverändert | bestehend |
| Zweiter Aufruf nach verlorener Antwort | Zuordnung beendet → `change_gate` `not_found` (0040:319); Gegenbuchung/Folgeanfrage/Outbox zusätzlich unique (0028:43, 0046:11, `dedupe_key`) | unverändert; Oberfläche behandelt `not_found`/`invalid_transition` nach dem Senden als „bereits storniert“ und lädt neu | live: zwei Aufrufe, eine Wirkung |

## Migration 0059 (voller Text)

```sql
-- s9i-7b: Storno durch die Firma. Gemeinsame Prüfung für Grundlage und Storno (M1), strengere Pauschale-Berechtigung (M4),
-- Grundlage mit Grund und Berechtigung, my_cancel_info für den Kunden.

create function private.call_out_eligible(p_request uuid, p_reason text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_reason = 'scope_impossible'
    and not exists (select 1 from public.price_revisions v where v.request_id = p_request and v.source = 'change_order' and v.status = 'proposed')
    and coalesce((select v.status in ('declined', 'expired') from public.price_revisions v
                  where v.request_id = p_request and v.source = 'change_order' and v.status in ('accepted', 'declined', 'expired')
                  order by v.decided_at desc, v.id desc limit 1), false)
$$;
revoke all on function private.call_out_eligible(uuid, text) from public;

create function private.partner_cancel_check(p_request uuid, p_reason text) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  r public.service_requests;
begin
  select * into r from public.service_requests s where s.id = p_request;
  if r.not_done_reported_at is not null then raise exception 'under_review'; end if;
  if p_reason is null or p_reason not in ('scope_impossible', 'unavailable', 'other') then raise exception 'reason_required'; end if;
  if r.termin_at is not null and now() >= r.termin_at and p_reason <> 'scope_impossible' then raise exception 'too_late_for_reason'; end if;
end
$$;
revoke all on function private.partner_cancel_check(uuid, text) from public;

-- Pauschale für den echten Aufruf: ohne Belege 0; mit Belegen nur bei Berechtigung und gültigen Belegen
create function private.partner_cancel_fee(p_partner uuid, p_request uuid, p_reason text, p_photos uuid[]) returns bigint
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_photos is null or cardinality(p_photos) = 0 then return 0; end if;
  if not private.call_out_eligible(p_request, p_reason) then raise exception 'call_out_not_allowed'; end if;
  if cardinality(p_photos) > 8
     or (select count(distinct x) from unnest(p_photos) x) <> cardinality(p_photos)
     or (select count(*) from public.job_photos j
         where j.id = any (p_photos) and j.kind = 'receipt' and j.status = 'ready' and j.uploaded_partner_id = p_partner and j.request_id = p_request) <> cardinality(p_photos) then
    raise exception 'receipt_required';
  end if;
  return private.call_out_base(p_request);
end
$$;
revoke all on function private.partner_cancel_fee(uuid, uuid, text, uuid[]) from public;

drop function public.cancel_by_partner_basis(uuid, text, uuid);
create function public.cancel_by_partner_basis(p_actor uuid, p_aal text, p_request uuid, p_reason text)
returns table (request_status text, revision_id uuid, total_cents bigint, call_out_cents bigint, fee_rate numeric, fee_vat_rate numeric, fee_rate_version int, fee_vat_rate_version int)
language plpgsql security definer set search_path = ''
as $$
declare
  r public.service_requests;
  bk public.commission_entries;
  c bigint := 0;
begin
  perform private.change_gate(p_actor, p_aal, p_request);
  perform private.partner_cancel_check(p_request, p_reason);
  select * into r from public.service_requests s where s.id = p_request;
  select * into bk from public.commission_entries e where e.request_id = p_request and e.kind = 'booking';
  if not found then raise exception 'booking_missing'; end if;
  if private.call_out_eligible(p_request, p_reason) then c := private.call_out_base(p_request); end if;
  return query
    select r.status::text, r.current_revision, (select v.total_cents::bigint from public.price_revisions v where v.id = r.current_revision),
           c, bk.fee_rate, bk.fee_vat_rate, bk.fee_rate_version, bk.fee_vat_rate_version;
end
$$;
revoke all on function public.cancel_by_partner_basis(uuid, text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.cancel_by_partner_basis(uuid, text, uuid, text) to service_role;

-- cancel_by_partner: Signatur, Attribute, Grants und Wirkung wie 0048; nur Zeilen 26-40 (Prüfungen) ersetzt durch die gemeinsamen Funktionen
create or replace function public.cancel_by_partner(
  p_actor uuid, p_aal text, p_request uuid, p_reason text, p_photos uuid[], p_fee_base bigint,
  p_fee_rate numeric, p_fee_vat_rate numeric, p_fee bigint, p_fee_net bigint, p_fee_vat bigint, p_payout bigint,
  p_fee_rate_version int, p_fee_vat_rate_version int
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  pid uuid;
  r public.service_requests;
  bk public.commission_entries;
  base bigint;
  nid uuid;
begin
  pid := private.change_gate(p_actor, p_aal, p_request);
  select * into r from public.service_requests s where s.id = p_request;
  perform private.partner_cancel_check(p_request, p_reason);
  base := private.partner_cancel_fee(pid, p_request, p_reason, p_photos);
  -- ab hier Zeile für Zeile 0048:41-73
  ...
end
$$;
-- Grants wie 0048:77-80 (revoke all ... from public, anon, authenticated, service_role; grant execute to service_role)

-- Kunde: Pauschale (nur der Betrag, nie die Gebühr) und Folgeanfrage
create function public.my_cancel_info(p_request uuid)
returns table (call_out_cents bigint, followup_id uuid)
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not exists (select 1 from public.service_requests s where s.id = p_request and s.customer_id = uid and s.status = 'cancelled_by_partner') then
    raise exception 'not_found';
  end if;
  return query
    select coalesce((select sum(e.total_cents)::bigint from public.commission_entries e
                     where e.request_id = p_request
                       and (e.kind = 'cancellation_fee'
                            or (e.kind = 'correction' and e.reverses_entry_id in
                                (select f.id from public.commission_entries f where f.request_id = p_request and f.kind = 'cancellation_fee')))), 0),
           (select f.id from public.service_requests f where f.reissued_from = p_request);
end
$$;
revoke all on function public.my_cancel_info(uuid) from public, anon;
grant execute on function public.my_cancel_info(uuid) to authenticated;
```
(Der Rest von `cancel_by_partner` wird im Bau wörtlich aus 0048:41-73 übernommen; unverändert.)

## Edge Function `cancel-partner` (partner.ts)
Body: `requestId`, `reason`, `photoIds`, `preview` (boolean), `shownCallOutCents`. Vorschau: `photoIds` und `shownCallOutCents` verboten. Echt: `shownCallOutCents` Pflicht (sichere Ganzzahl ≥ 0), `photoIds` darf leer sein (dann muss `shownCallOutCents` 0 sein, sonst `amount_changed`). Vorschau-Antwort `{ callOutCents, callOutEligible, feeCents, payoutCents }` (Gebühr nur für die Firma), schreibt nichts. Schleife: `basis` mit Grund, `feeBase = photoIds.length > 0 ? basis.callOutCents : 0`, Vergleich mit `shownCallOutCents` in jedem Durchlauf, Abweichung 409 `amount_changed`. Ohne Berechtigung liefert die Grundlage 0; mit Belegen aber ohne Berechtigung kommt `call_out_not_allowed` aus `partner_cancel_fee`.

## Oberfläche
Partner: Sheet „Auftrag absagen“ (Grund, Vorschau mit Folgen in Worten, Pauschale-Schalter nur bei `callOutEligible`, Belege aus den vorhandenen `receipt_ids`/Upload nach gezeigtem Betrag, Bestätigung mit dem gezeigten Betrag; bei `amount_changed` neu laden, nie automatisch senden; bei `not_found`/`invalid_transition` nach Senden „bereits abgesagt“). Kunde: Absage-Block in `Auftrag.tsx` mit `my_cancel_info`.

## B) Echte Funktionstests (tests/rls/edge-functions-live.test.ts, Dev, echte aal2-Tokens, markierte Testdaten)
change-propose, change-decide, cancel-partner: 401 ohne JWT; fremde Firma, Kunde, aal1 abgelehnt; pending/rejected/suspended → `partner_not_active`; 409 bei abweichendem gezeigten Betrag ohne Anlegen; zweiter Aufruf = eine Wirkung. Deploy: change-decide, cancel-partner (und change-propose bleibt Version 4, `functions list` neu).

## Rot-Ursachen
SQL-Tests: 4-Argument-Grundlage fehlt, `my_cancel_info` fehlt, Matrix liefert für „declined, dann accepted“ eine Pauschale. Unit: Schlüsselliste lehnt `preview`/`shownCallOutCents` ab (400), keine Vergleichsprüfung. Live: cancel-partner (alte Version) kennt weder Vorschau noch Betragsabgleich.

## Fragen an den Berater
1. Arbeitsbeginn-Tor und job_contact: dem Konzept folgen (Tor wie T13, Kontakt 30 Tage nach Storno) oder bei Storno ohne Pauschale enger?
2. M4-Verschärfung (offener Nachtrag sperrt, letzter entschiedener muss declined/expired sein) richtig?
3. `my_cancel_info` zeigt dem Kunden die Pauschale (Summe `total_cents` von `cancellation_fee` plus Korrekturen), nie die Gebühr. Zulässig nach „Kunden sehen die Gebühr nirgends“?
4. S9i7-1/S9i7-2 (Belege idempotent über sha256, „mindestens ein Beleg ohne angenommenen Nachtrag“) in 0059 oder nach OPEN_ISSUES? Mein Vorschlag: nicht in 0059, weil es kein Tor der Pauschale ist (Belege hängen nicht an Nachträgen).
5. Teilung: eine Session (A, B, C) oder 7b1 = B + C zuerst?
6. SQL oben: Fehler in Attributen, Rechten, Reihenfolge der Prüfungen, `stable` bei Funktionen mit `raise`?
7. Vorschau zeigt der Firma Gebühr und Auszahlung der Pauschale: ok (Partner darf den Satz kennen)?
