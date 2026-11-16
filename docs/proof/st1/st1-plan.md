# st1 Plan (R3), Kennung st1-1611-a

## Auftrag
Migration 0065: ENTSCHEIDUNGEN Nr. 148 (Pauschale erst ab Termin) und Nr. 154 (Kontakt und Fotos nach Storno ohne Pauschale sofort gesperrt, auch nach kostenlosem Kundenstorno). Sätze in `.claude/rules/geld.md` (Nr. 149, 150).

## Fakten
- `private.call_out_eligible(p_request, p_reason)`: `supabase/migrations/20261112120000_0059_partner_cancel_preview.sql:7-14`: Grund `scope_impossible` und letzter nicht zurückgezogener Nachtrag `declined`/`expired`. Kein Zeitbezug. Aufrufer: `private.partner_cancel_fee` (0059:35-49, Belege 1 bis 8, sonst `call_out_not_allowed`) und `private.cancel_by_partner_basis` (0062:766, `call_out_cents`). `admin_correct_basis` (0062:847) nutzt `call_out_base` direkt, nicht `call_out_eligible` (Admin entscheidet, bleibt).
- Zeitgrenze des Storno durch die Firma: `partner_cancel_check` 0059:28 (ab `termin_at` nur `scope_impossible`). Kundenstorno ist nur vor `termin_at` möglich (0062:692, 722).
- Kontaktsperre heute: `public.job_contact` (0060:21-46): `assignment_access` (Fenster `partner_access_days`, 0030:87-95) und nur bei `ended_reason = 'cancelled_by_partner'` zusätzlich `private.partner_cancel_fee_due` (0060:7-16, Summe `cancellation_fee` samt Gegenbuchungen > 0).
- Fotos der Firma: einziger Weg `public.job_photo_list` (0037:73-114, Zweig `accepted` Zeile 97 mit `assignment_access`); die Tabelle `job_photos` ist nur für `service_role` lesbar (0035:64-66), Bucket privat. `my_jobs` (0064:166), `my_job_changes` (0058:44) und die `job_listings`-Policy (0038:232) nutzen `assignment_access` und bleiben unverändert (Beks: Kontakt und Fotos).
- Aufräumen der Kopien nach Zugriffsende bleibt `partner_access_days` (0054:98): keine Änderung.
- Edge Functions: keine Änderung (Funktionen behalten ihre Signaturen, `database.types.ts` unverändert); kein Deploy nötig, Live-Aufruf über `flow-live`.
- OFFEN M4: der einzige Treffer mit „M4“ ist `u3-3` (Mocks, `booking_terms`-Typ von Hand): kein Bezug zu 0065, bleibt offen. Die Abnahme-M4 von s9i-7c2 (Kontakt nach kostenlosem Kundenstorno) ist Nr. 154 selbst und wird gebaut.

## Plan
1. `call_out_eligible`: zusätzlich `termin_at <= now()` (NULL oder Zukunft: false). Vor Terminbeginn gibt die Vorschau 0, Belege bei Aufruf ergeben `call_out_not_allowed`, die Firma sagt ohne Pauschale ab.
2. Neue private Funktion `private.partner_data_access(request, partner)` = `assignment_access` und nicht (Zuordnung endete mit `cancelled_by_customer` oder `cancelled_by_partner` und `not partner_cancel_fee_due`). `job_contact` (ohne eigene Sperre) und `job_photo_list` (Zweig `accepted`) rufen sie auf. Rechte wie `partner_cancel_fee_due`: Entzug für public, anon, authenticated.
3. Tests zuerst rot: `job-contact-after-cancel` (Kundenstorno kostenlos: Kontakt und Fotos gesperrt; Kundenstorno mit Pauschale: Kontakt und Fotos im Fenster, danach nach 31 Tagen gesperrt; Firmenstorno ohne Pauschale: Fotos gesperrt; Pauschale vor Termin: `call_out_not_allowed`, Vorschau 0), `cancellation-partner-preview` (E1 vor Termin 0, Pauschalen-Fälle E2/E5/E7/S1 mit Termin in der Vergangenheit), `cancellation-partner` (S1 mit Termin in der Vergangenheit).
4. Push (`db:antrag`, Freigabe `advisor-report`, `db:push`), `flow-live` und die Zielläufe grün, Volläufe check/e2e/rls.
5. Texte: zwei Sätze in `geld.md`; `STAND.md` 13 auf 17 Functions; ENTSCHEIDUNGEN, BEKS, OFFEN, ROADMAP.

## Frage an den Berater (eine)
Plan prüfen auf Geld- und Sicherheitsrisiko: (a) Ist `partner_data_access` als eigene Funktion statt Änderung an `assignment_access` richtig (Listing, `my_jobs`, Nachträge behalten das Fenster)? (b) Muss `admin_correct` (`cancel_partner`/`cancel_customer` nach Abschluss, ohne Gebühr, 0050:101) mit der neuen Sperre rechnen? (c) Reicht `termin_at <= now()` oder braucht der Fall `termin_at is null` mehr? (d) Fehlt eine Stelle, an der die Firma nach Storno ohne Pauschale noch Kontakt oder Fotos lesen kann?
