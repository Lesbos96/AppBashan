# s9i-7b2 Plan (zur Prüfung durch den Berater)

Verboten für den Berater: das eingebaute Tool `advisor` (ohne Parameter) aufrufen. Nur Read, Grep, Glob.

## Fakten (selbst nachgelesen)
- `cancel-partner` (supabase/functions/_shared/cancel/partner.ts): Body `requestId, reason, photoIds?, preview?, shownCallOutCents`; Vorschau `{callOutCents, payoutCents}` (nichts geschrieben, keine Belege, kein Betrag); echter Aufruf Antwort `{status, callOutCents}`; Pflicht: Belege vorhanden <=> shownCallOutCents > 0. Fehler: `amount_changed` 409 (gezeigter Betrag != Serverbetrag, nichts gebucht), `retry` 409 (Satz/Betrag wechselte zwischen Grundlage und Buchung), `under_review` 409, `too_late_for_reason` 409, `call_out_not_allowed` 409, `receipt_required` 422, `not_found`, `invalid_transition`, `partner_not_active`, `mfa_required`, `invalid_input` 400.
- `my_cancel_info(p_request) returns bigint`: Summe `cancellation_fee` + Gegenbuchungen in Cent, nur Kunde, nur `cancelled_by_partner`, sonst `not_found` (0059:142-156).
- Folgeanfrage: `service_requests.reissued_from` (0046:10), höchstens eine je Quelle; Kunde liest sie über die eigene RLS.
- job_contact heute (0032:57-77): aal2, `my_job_partner_id()`, `assignment_access` = Zuordnung aktiv oder `ended_at > now() - partner_access_days` (0030:87-95, 30 Tage). Nach Storno ohne Pauschale bleibt der Kontakt also 30 Tage offen.
- Pauschale fällig = Journalzeile `cancellation_fee` (nicht gegengebucht), wird nur bei `base > 0` gebucht (0059:110-113). `call_out_cents` im Audit gleicher Wert.
- Belege: `uploadReceipt` (src/lib/partnerChange.ts) + Funktion `photo-receipt` + `my_job_changes().receipt_ids` existieren und passen zu `partner_cancel_fee` (kind='receipt', ready, eigene Firma, dieser Auftrag, max 8, ohne Duplikate). Der Pauschalen-Weg ist also baubar.
- Heute zeigt die Kundenansicht (`src/lib/cancel.ts:83`, `src/screens/Auftrag.tsx`) bei `cancelled_by_partner` nur „Der Partner hat den Auftrag storniert.“

## A Berater-Tools
Frontmatter hat schon feste Listen (`Read, Grep, Glob` bzw. `+ Write`). Beide Subagents melden trotzdem das eingebaute `advisor` in ihrer Liste, auch mit `disallowedTools: advisor` (Versuch zurückgenommen). Beleg: tmp/proof/s9i-7b2-berater-tools.md. Folge: OPEN_ISSUES, in jedem Auftrag an die Berater ausdrücklich verboten. Keine Dateiänderung.

## B Storno-Sheet der Firma (src/screens/partner/Absage.tsx, src/lib/partnerCancel.ts)
Einstieg: Knopf „Auftrag absagen“ in der Karte (accepted/in_progress, nicht beendet).
Schritt 1 Grund (SelectField): `scope_impossible` „Der Auftrag ist vor Ort anders als gebucht“, `unavailable` „Ich kann den Auftrag nicht durchführen“, `other` „Anderer Grund“. Hat der Termin begonnen (`j.canStart` oder Status `in_progress`, DB-Uhr-Momentaufnahme aus my_jobs), nur der erste; der Server entscheidet (`too_late_for_reason` → zurück zu Schritt 1 mit Hinweis). Knopf „Folgen prüfen“ → Vorschau.
Schritt 2 Vorschau (Server): Zeilen nur aus der Antwort: Pauschale = callOutCents, Du erhältst = payoutCents, Gebühr = Pauschale − Auszahlung (Differenz, kein eigener Satz in der App; nur in der Partner-Oberfläche).
- callOutCents = 0: Text: „Der Kunde muss nichts zahlen. Seine Anfrage geht an andere Firmen. Kontakt und Adresse sind danach für dich gesperrt. Mehrere Absagen in kurzer Zeit lösen eine Prüfung deiner Firma aus.“ Knopf „Absagen“ (shown 0, keine Belege).
- callOutCents > 0: zwei Möglichkeiten (Radio): (A) „Mit Pauschale“: Zeilen Pauschale inkl. USt. 69,00 € · Gebühr 10,35 € · Du erhältst 58,65 €; „Der Kunde schuldet dir die Pauschale von 69,00 €. Du stellst sie ihm außerhalb der App in Rechnung. Die Anfrage wird nicht weitervermittelt. Kontakt und Adresse bleiben dir kurze Zeit sichtbar. Dafür brauchst du mindestens ein Belegfoto.“ + Belegfotos (gleiche Komponente wie im Nachtrag, vorhandene `receiptIds` + Upload nach der Vorschau, Menge statt Liste). Knopf „Für 69,00 € Pauschale absagen“ (gesperrt ohne ≥1 Beleg). (B) „Ohne Pauschale“: wie der Fall 0. Ohne Auswahl kein Absende-Knopf.
Rechenbeispiel Live-Test: Auftrag 689,61 €, Satz 15 %, USt. auf Gebühr 20 %, Pauschale 6.900 ct → Gebühr round(6900×0,15)=1.035 (netto 863, USt. 172), Auszahlung 5.865. Anzeige: 69,00 € / 10,35 € / 58,65 €. Der Kunde schuldet 69,00 €, nie die Gebühr.
Bestätigung: sendet `shownCallOutCents` = Betrag der letzten Vorschau (A) bzw. 0 (B, ohne photoIds).
Ablauf der Fehler:
- 409 `amount_changed` (→ Fehlerart `changed`) und `call_out_not_allowed`: neue Vorschau holen, Hinweis „Der Betrag hat sich geändert. Prüfe ihn neu.“, Auswahl zurückgesetzt, NIE automatisch senden.
- 409 `retry`: nichts gebucht; Hinweis „Das hat nicht geklappt“, Knopf „Neu prüfen“ (= Vorschau, kein Senden).
- Netzfehler oder unbekannter Fehler (500) beim Senden: Ergebnis unbekannt → NICHT erneut senden; Sheet schließt, `my_jobs` lädt neu, Hinweis „Keine Verbindung. Prüfe unten, ob der Auftrag abgesagt ist.“ (Status zeigt die Wahrheit, S9i7-11). Gilt auch für den Wiederholungsversuch nach verlorener Antwort.
- `not_found`/`invalid_transition` (S9i7-11: auch gleichzeitiger Kunden-Storno): Sheet schließt, Neuladen, Hinweis „Der Auftrag hat sich geändert. Die Ansicht wurde neu geladen.“
- `partner_not_active`/`mfa_required`/401: Sheet schließt, Neuladen.
- `under_review`, `receipt_required`, `invalid_input`: Text im Sheet, Sheet bleibt.
Während der Anfrage: Knöpfe gesperrt, Sheet `locked`, `running`-Ref gegen Doppelklick (wie NachtragSheet).
Erfolg: Sheet schließt, Hinweis „Du hast den Auftrag abgesagt. Der Kunde ist informiert.“ (mit Pauschale: „… Die Pauschale stellst du dem Kunden außerhalb der App in Rechnung.“), Neuladen. Zweiter Aufruf nach Erfolg: der Server antwortet `invalid_transition`/`not_found` → der Neuladen-Zweig, nichts doppelt gebucht (Server: Compare-and-Set im Tor).
Belege-Upload-Komponente aus Nachtrag.tsx herausgelöst (`BelegFotos`), von beiden Sheets genutzt.

## C Absage beim Kunden (src/lib/cancel.ts, src/screens/auftrag/Absage.tsx)
Nur bei Status `cancelled_by_partner`; lädt `my_cancel_info(id)` (bigint → Zahl, unlesbar = Fehler, nie „kostenlos“) und die Folgeanfrage (`reissued_from = id`, Filter customer_id, id+status). Endtext im Verlauf: „Die Firma hat den Auftrag abgesagt.“ Karte „Absage der Firma“:
- 0 ct, Folgeanfrage nicht `unmatched`: „Dir entstehen keine Kosten. Wir haben deine Anfrage an andere Firmen weitergegeben.“ + Link „Zur neuen Anfrage“ (/auftraege/<id>).
- 0 ct, Folgeanfrage `unmatched` oder keine: „Dir entstehen keine Kosten. Wir haben leider keine andere Firma gefunden. Du kannst jederzeit eine neue Anfrage stellen.“ + Link „Neue Anfrage“ (/).
- > 0 ct: „Die Firma macht eine Pauschale von 69,00 € geltend, weil der Auftrag vor Ort nicht wie gebucht möglich war. Die Firma stellt sie dir außerhalb der App in Rechnung. Wir vermitteln diese Anfrage nicht weiter.“ + Link „Neue Anfrage“.
Die Gebühr kommt nie vor; die Summe stammt aus `my_cancel_info`. Ladefehler: neutraler Text mit „Erneut versuchen“.
Alle Pauschalen-Texte vorläufig bis zur Rechtsprüfung (S9_KONZEPT:361): Code-Kommentar + GOLIVE-Eintrag. Offen: ein Widerspruchsweg (Support-Kontakt) existiert in der App noch nicht, kein erfundener Text.

## D Migration 0060 (VOLLER SQL-Text: supabase/migrations/20261113100000_0060_job_contact_after_cancel.sql, beigefügt)
Siehe Datei. Kern: neue private Funktion `partner_cancel_fee_due(request, partner)` (security definer, nötig wegen RLS auf commission_entries; search_path leer; REVOKE von public, anon, authenticated; nur aus job_contact aufgerufen), `job_contact` per `create or replace` mit unverändertem Körper plus: existiert für die Firma eine Zuordnung mit `ended_reason = 'cancelled_by_partner'` und ist keine Pauschale fällig → `not_assigned`, vor der Audit-Zeile. REVOKE public, anon; GRANT authenticated (wie 0032). `assignment_access` unverändert (Fotos, Listings, my_jobs, siehe OPEN_ISSUES).
Fragen an den Berater: (1) Ist die Sperre nur in job_contact ausreichend oder müssen Fotos-Lesen (0035/0037) und `my_jobs` mit? (2) Nach admin-correct `negate_fee` (Pauschale gegengebucht) wird der Kontakt sofort gesperrt: gewollt? (3) Ein Fehlercode `not_assigned` reicht (UI: „closed“)?

## Testliste (zuerst rot)
- rls `tests/rls/job-contact-after-cancel.test.ts`: Storno ohne Pauschale (Grund unavailable): job_contact verweigert (`not_assigned`), aber sofort nach dem Storno; Storno mit Pauschale (Nachtrag abgelehnt + Belege): erlaubt, Audit-Zeile; nach Ablauf des Fensters (ended_at vor 31 Tagen): verweigert; nach `negate_fee`: verweigert; nicht stornierter Auftrag: erlaubt (Kontrolle); fremde Firma, Kunde (partner_not_active), anon (permission denied), aal1 (`mfa_required`): abgelehnt; Abschluss `completed` im Fenster weiterhin erlaubt (andere Beendigung unverändert).
- unit `tests/unit/partner-cancel.test.ts`: Code→Fehlerart, Vorschau-Antwort unlesbar → Fehler, Body (nur photoIds wenn >0).
- e2e `tests/e2e/partner-absage.spec.ts`: Vorschau 0 / >0 mit Beträgen 69,00 / 10,35 / 58,65; Bestätigung sendet gezeigten Betrag; 409 amount_changed zeigt neue Vorschau ohne zweiten Sendeaufruf (Zähler); Netzfehler lädt Status neu ohne zweiten Sendeaufruf; Grund-Auswahl ab Termin nur scope_impossible; Knopf gesperrt während Anfrage; not_found lädt neu; Tastaturbedienung.
- e2e `tests/e2e/auftrag-absage.spec.ts`: Kunde mit Pauschale / ohne (Folgeanfrage, unmatched, keine); keine Gebühr im DOM.
- Rotläufe: tmp/proof/s9i-7b2-rot-*.log; Lockerungsprobe: Sperre in job_contact entfernen → Test „Storno ohne Pauschale verweigert“ muss rot werden mit Ist-Wert (Zeilen sichtbar).
