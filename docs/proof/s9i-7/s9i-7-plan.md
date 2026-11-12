# s9i-7a Plan: Nachtrag vorschlagen und Storno durch die Firma (Planprüfung Berater)

Modell: Sonnet 5.5. Branch `s9i-7` von `main` (d54cb55). Nächste Migration 0058 (Zeitstempel nach 20261112100000).

## Fakten (selbst geprüft, Quellen in Klammern)
**3a Nachtrag.** Ein Nachtrag ist eine Zeile `price_revisions` (`source = change_order`, Status `proposed|accepted|declined|expired|withdrawn`, 0040/0041).
- Die Firma sendet KEINEN Betrag. `change-propose` (`_shared/change/handlers.ts`) nimmt `{requestId, changes, photoIds}` (nur geänderte Preisfelder, 1 bis 8 Belegfotos); der Server rechnet gebuchter Preis + Modul(neu) − Modul(alt) mit der gebuchten Preisversion (`changeTotal`), antwortet `{revisionId, totalCents}`. Es gibt keine Vorschau: der erste Aufruf legt den Nachtrag schon an.
- `propose_change` (nur `service_role`; Akteur und aal aus dem geprüften Token): Gate `change_gate` (aal2 sonst `mfa_required`; Firma `active|payment_hold` sonst `partner_not_active`; aktive Zuordnung sonst `not_found`; Status `accepted|in_progress` sonst `invalid_transition`), `revision_changed`, Quelle `partner_offer` → `change_not_allowed`, Festpreis (`not_fixed_price`), höchstens ein offener (`change_open`, Unique-Index), nur erhöhend (`change_not_increasing`), Belege: 1 bis 8, verschiedene, `kind=receipt`, `ready`, eigene Firma, dieser Auftrag (`receipt_required`). Gültigkeit `change_valid_hours`; Mail `change_proposed` an den Kunden; Audit.
- Adresse und Route sind nicht änderbar (`route_locked`); `changes` darf nur bekannte Schlüssel der gültigen Revision enthalten, nie `service` (`invalid_input`).
- Rückzug: `withdraw_change(p_revision)` direkt per RPC für authenticated (aal2, eigene Firma). Ablauf: Cron `expire_changes`. Auftragsende schließt offene Nachträge.
- Belege: Edge Function `photo-receipt` (JPEG-Body, `?request=`, aal2, aktive Zuordnung, Limit), liefert `{id}`; Pipeline verarbeitet und entfernt EXIF serverseitig. Kunde sieht Belege über `job-photo` (`requestId`).
- Kundenseite (s9i-3): Nachtrag zustimmen/ablehnen (`change-decide`, `shownTotalCents`, 409 `amount_changed`). Server fertig und getestet (`change-orders.test.ts` 7 Tests, `change-orders-concurrency`, `change-handlers.test.ts`).
- **Lücke 1 (Lesen):** Die Firma kann `price_revisions` nicht lesen (nur der Kunde hat eine Select-Policy, 0018). Sie sieht weder den Zustand ihres Nachtrags (offen, angenommen, abgelehnt, abgelaufen) noch die aktuellen Eingaben der gültigen Revision (nach einem angenommenen Nachtrag weichen sie vom Listing ab). `my_jobs()` zeigt die Summen des Journals (nach Annahme steigt der Betrag), nicht den offenen Nachtrag. → Migration 0058 nötig.
- **Lücke 2 (Betrag vor dem Senden):** Ohne Vorschau sieht die Firma den Betrag erst nach dem Anlegen. → `preview` und `shownTotalCents` in `change-propose` (Edge-Function-Änderung, keine Migration).

**3b Storno durch die Firma.** `cancel-partner` (`_shared/cancel/partner.ts`) nimmt `{requestId, reason, photoIds}` (`reason` ∈ `scope_impossible|unavailable|other`, 0 bis 8 Belege). `cancel_by_partner` (nur `service_role`): gleiches Gate (Status `accepted|in_progress`), `under_review` nach Kundenmeldung, Grund Pflicht, ab `termin_at` nur `scope_impossible` (`too_late_for_reason`, 0048), Belege nur bei `scope_impossible` UND einem `declined|expired` Nachtrag (`call_out_not_allowed`), Belege wie oben (`receipt_required`), `amount_mismatch`/`fee_basis_changed` (Satz der Buchungszeile). Folgen: Status `cancelled_by_partner`, Zuordnung endet (`cancel_reason`), Gegenbuchung aller Journalzeilen (`cancel_reverse_all`, Provision 0), mit Belegen eine Zeile `cancellation_fee` auf die Pauschale `call_out_base` (= `min(call_out_fee_cents, Gesamtpreis)` aus dem Snapshot), ohne Belege Weitervermittlung T16 (`reissue_request`, Folgeanfrage zum gleichen Preis, Firma ausgeschlossen; nur bei Termin ≥ `reissue_min_hours`, sonst nur Mail), Qualitätszähler, Mail `partner_cancelled` / `partner_cancelled_fee` / `request_reissued`, Audit. Die Antwort enthält `callOutCents`; es gibt keine Vorschau und keinen 409-Abgleich mit dem gezeigten Betrag (nur `retry` bei Satzwechsel). Wiederholung nach verlorener Antwort: zweiter Aufruf endet `not_found` (keine aktive Zuordnung mehr) oder `invalid_transition`, nie ein zweites Storno.
- **Lücke 3:** Betrag und Folgen sind vor dem Absenden nicht abrufbar. → `preview` und `shownCallOutCents` in `cancel-partner` (409 `amount_changed`).

**3c Journal.** `my_commissions(p_month date default null)` (0042, authenticated, nur eigene Firma, aal2); `export_commissions` nur `service_role` per Skript; CSV-Modul `supabase/functions/_shared/commission/csv.ts` (Semikolon, BOM, Dezimalkomma, Wiener Zeit). Kein Server-Endpunkt für die CSV; der Client müsste sie bauen. Nicht in 7a.

**3d Status.** `pending` und `rejected`: kein Auftrag, daher kein Nachtrag und kein Storno (`not_found`/`partner_not_active`). `suspended`: `partner_not_active` bei Nachtrag und Storno (Rückzug eines offenen Nachtrags schließt der Server dann als `withdrawn`). `payment_hold`: erlaubt (wie Start, Abschluss, Kontakt). aal1: `mfa_required`.

## Abweichung vom Auftrag
Der Auftrag spricht von „Nachtrag mit Betrag“ und „Beträge aus dem Client werden serverseitig geprüft (negativ, 0, Nachkommastellen, über Grenze)“. Der Server hat kein Betragsfeld von der Firma; stattdessen: `changes` (Schlüssel und Werte über `parse*Input`, Grenzen aus `LIMITS`) und Belege. Die Betragsprüfungen gelten für `propose_change(p_total)` (nur `service_role`, vorhanden in `change-orders.test.ts`) und für `shownTotalCents`/`shownCallOutCents` (neu).

## Entwurf 7a
**Migration 0058** `my_job_changes()`: liefert der Firma je Auftrag im Zugriffsfenster die aktuelle Preisgrundlage und den letzten Nachtrag (kein Name, keine Adresse, kein Kontakt, keine Gebühr).
```sql
create function public.my_job_changes()
returns table (
  request_id uuid, service public.service_type, source text, inputs jsonb, total_cents bigint,
  change_id uuid, change_status text, change_total_cents bigint, change_valid_until timestamptz, change_decided_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare pid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not_found'; end if;
  if (select auth.jwt() ->> 'aal') is distinct from 'aal2' then raise exception 'mfa_required'; end if;
  pid := private.my_job_partner_id();
  if pid is null then raise exception 'partner_not_active'; end if;
  return query
    select a.request_id, r.service, cur.source, cur.inputs, cur.total_cents::bigint,
           ch.id, ch.status::text, ch.total_cents::bigint, ch.valid_until, ch.decided_at
    from public.assignments a
    join public.service_requests r on r.id = a.request_id
    join public.price_revisions cur on cur.id = r.current_revision
    left join lateral (
      select v.* from public.price_revisions v
      where v.request_id = a.request_id and v.source = 'change_order' and v.proposed_by = a.partner_id
      order by v.n desc limit 1
    ) ch on true
    where a.partner_id = pid and private.assignment_access(a.request_id, pid)
    order by a.request_id;
end $$;
revoke all on function public.my_job_changes() from public, anon;
grant execute on function public.my_job_changes() to authenticated;
```
`inputs` enthält nur Preis-Eingaben (Entscheidung 30, keine Freitexte); die App zeigt sie schon heute über `job_listings` (Whitelist `scopeLines`). Der letzte Nachtrag der eigenen Firma genügt (höchstens ein offener).

**Edge Functions (Deploy, keine Migration):**
- `change-propose`: Feld `preview: true` (kein Anlegen; Gate und Rechnung wie sonst, Antwort `{totalCents, baseCents}`, `change_not_increasing` schon in der Vorschau) und `shownTotalCents` beim echten Aufruf (Abweichung → 409 `amount_changed` vor `propose`). Der Betrag kommt nie vom Client als Rechengröße, nur als Bestätigung.
- `cancel-partner`: `preview: true` (Gate über `basis`, Antwort `{callOutCents}`; mit Belegen die Pauschale, sonst 0) und `shownCallOutCents` (409 `amount_changed`).

**App:** `src/lib/partnerChange.ts` (Aufrufe, Fehlerzuordnung, Feldliste je Dienst, Beleg-Upload über `photo-receipt` mit `preparePhoto`, `withdraw_change`), `src/screens/partner/Nachtrag.tsx` (Sheet: Felder mit aktuellen Werten, Belege 1 bis 8, Vorschau → Bestätigung mit Betrag, Fehlerzuständen), `Storno.tsx` (Sheet: Grund, Folgen in Worten, bei `scope_impossible` mit abgelehntem/abgelaufenem Nachtrag optional Belege und Pauschale, Bestätigung mit Betrag), Einbindung in `PartnerAuftraege` (Knöpfe „Nachtrag vorschlagen“, „Auftrag absagen“, Nachtrag-Zustandszeile, „Zurückziehen“). Änderbare Felder: nur Zahlen, Ja/Nein und Auswahl aus den Preis-Eingaben (Transport/Umzug: `goods, crew, vehicles, vehicleType, hours, fromFloor, toFloor, fromLift, toLift, boxes, parking, packing`; Entrümpelung: `object, area, fill, lift, floor, special`; Montage: Maße je Art); verschachteltes `assembly` bleibt in 7a aus (Hinweis). Alles andere entscheidet der Server (`parse*Input`).
- Doppelklick: Sheet gesperrt (`locked`), ein Aufruf; verlorene Antwort: zweiter Versuch endet `change_open` bzw. `not_found` → App lädt neu und zeigt den Zustand (kein zweiter Nachtrag, kein zweites Storno).
- S9i6b-1: Sheet-Höhe (an Inhalt anpassen, kein Leerraum) und Betragszeile bei 320 px (Label über Betrag, kein verwaistes Wort) in `Sheet` und der Zeilenkomponente.

**Tests zuerst rot:** Unit (`change-handlers`, `cancel-partner-handler`: Vorschau, `shown*`, 409), neuer RLS-Test `partner-my-job-changes.test.ts` (Fremdfirma, aal1, Status, Fenster, kein Name/Adresse/Gebühr, Zustände des letzten Nachtrags), E2E `partner-nachtrag.spec.ts` und `partner-storno.spec.ts`, 320-px-Shots.

## Fragen an den Berater
1. Migration 0058 wie entworfen (Spalten, `inputs` der gültigen Revision für die Firma, Fenster, Attribute, Grants): freigeben oder ändern?
2. Vorschau und `shown*` in `change-propose` und `cancel-partner`: richtig so, oder genügt die Antwort nach dem Anlegen (Rückzug statt Vorschau)? Reihenfolge der Prüfungen, nichts verraten (Gebührenfreiheit), Wettlauf zwischen Vorschau und Anlegen.
3. Wiederholung nach verlorener Antwort bei Nachtrag und Storno, Belege (Wiederholung des Uploads, Waisen), Rundung (alles Integer-Cent, die App rechnet nichts).
4. Schnitt: 7a vollständig in einer Session, oder 7a in zwei Teile (Nachtrag, Storno)?
