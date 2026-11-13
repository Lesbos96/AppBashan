# Fable-Planprüfung s9i-7b2, Runde 1 (Antwort des Subagents advisor, wörtlich)

Modell: claude-fable-5-2

**Entscheidung: ja mit Änderungen.** Oberfläche (B, C) ist freigegeben; Migration 0060 ist fachlich korrekt, braucht aber vor `db:push` ein ausdrückliches Ja von Beks.

**Begründung:** 0060 ändert eine Entscheidung von Beks (01.11.: 30 Tage Zugriff auch nach Storno, `docs/S9_KONZEPT.md:469`, `:678`, `:405`). `docs/OPEN_ISSUES.md:577` führt S9i7-10 (c) als „Frage an Beks, nicht gebaut", und der Umfang laut `docs/PROGRESS.md:14` ist nur Oberfläche. Das SQL selbst stimmt: Summe wie `my_cancel_info`, Gegenbuchung exakt negiert und höchstens eine je Zeile (0028:43, :84), leerer `search_path`, Sperre vor der Audit-Zeile, gleicher Fehlercode. Die Beträge stimmen mit `supabase/functions/_shared/pricing/fee.ts:22-24` überein (6.900 → 1.035 / 863 / 172 / 5.865); die Differenz ist exakt die Gebühr, der Kunde bekommt nur die Summe.

**Änderungen am Plan**
1. **0060 nur mit Beks' Ja.** Ohne Ja: Migration, den Satz „Kontakt und Adresse sind danach für dich gesperrt" und den rls-Test streichen. Mit Ja: `S9_KONZEPT.md` an :405, :469, :516, :678 nachziehen.
2. **Kundentext 0 ct ohne Folgeanfrage ist falsch.** „Keine andere Firma gefunden" stimmt nur bei `unmatched`. Ohne Folgeanfrage (nach `negate_fee`, Termin zu nah, Festangebot; 0047:25-29) nur: „Dir entstehen keine Kosten. Du kannst jederzeit eine neue Anfrage stellen."
3. **Kundentext > 0 ct:** Nebensatz „weil der Auftrag vor Ort nicht wie gebucht möglich war" streichen. `admin_correct cancel_partner` bucht die Pauschale bei jedem Grund (0050:86-88).
4. **Toter Kontakt-Knopf:** `src/lib/partnerJobs.ts:292` bildet `not_assigned` auf `gone` ab, nicht auf `closed`. `src/screens/partner/Auftraege.tsx:249-250` zeigt Knopf und „kurze Zeit sichtbar" weiter. Beides ausblenden bei `endedReason = cancelled_by_partner` und `totalCents = 0` aus `my_jobs`; prüfen, dass `gone` hier nicht wegnavigiert.
5. **Vorschau gilt nur für ihren Grund:** Jede Änderung des Grunds verwirft Vorschau, Auswahl und gezeigten Betrag. Ein Netzfehler in der Vorschau darf wiederholt werden, nur das Senden nie.
6. **Fragen D:**
   - (1) `job_contact` reicht: `my_jobs` (0057) hat keine Kontaktfelder, 0058 ergab keinen Treffer auf contact/address; die Foto-Pfade 0035/0037 habe ich nicht gelesen, das stützt sich auf die Regel „Fotos schon vor Annahme sichtbar".
   - (2) Ja, gewollt: der Zweck entfällt, und es passt zu `my_cancel_info` = 0. Setzt Punkt 2 voraus.
   - (3) Ja, ein Code, kein Orakel; die Oberfläche nach Punkt 4.

**Risiken und Testlücken**
- **rls:** Im vorhandenen `tests/rls/job-contact-after-cancel.test.ts` fehlt die geplante Kontrolle `completed` im Fenster. Zusätzlich fehlen `cancelled_by_customer` im Fenster, `admin_correct cancel_partner` mit und ohne Pauschale sowie Firma B auf der Folgeanfrage (erlaubt) gegen Firma A (verweigert).
- **e2e Firma:** Weg B bei Pauschale > 0 sendet `shownCallOutCents: 0` ohne `photoIds`; Grundwechsel erzwingt eine neue Vorschau; `retry` sendet nicht selbst; Doppelklick ergibt genau einen Sendeaufruf; Kontakt-Knopf fehlt nach Absage ohne Pauschale.
- **e2e Kunde:** Fall 0 ct ohne Folgeanfrage; im DOM weder 10,35 noch 58,65, „Gebühr" oder „Provision".
- **Bestehende Tests:** Per Suche ruft kein rls-Test `job_contact` nach einem Firmen-Storno auf; `tests/rls/listings.test.ts:350-370` und `tests/rls/account-deletion.test.ts` trotzdem im Lauf bestätigen.

---
Hinweis der Hauptsession (nicht Teil der Antwort): Das Ja von Beks zu 0060 liegt im Auftrag der Session (Umfang D, „Entscheidung zur Durchsicht" = vom Auftraggeber so entschieden, zur Durchsicht vorgelegt). Berater hat den Auftragstext nicht gesehen. Umsetzung: Entscheidung 104 in AUTOPILOT mit diesem Wortlaut; S9_KONZEPT nachziehen.
