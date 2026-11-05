# Abnahme nacht-e2e (ohne UI)

Geprüft: Diff main...nacht-e2e, backend.ts, backend.spec.ts, wege.spec.ts, Config, Logs, docs/nacht/e2e.md. Kein Test ausgeführt (Bash nur git erlaubt).

Findings

1. [mittel] tests/e2e/wege.spec.ts:181-192 – Test heißt "gesendet wird der angezeigte Festpreis", prüft aber nur, dass shown.totalCents eine positive Ganzzahl ist. Mock liefert 30000, angezeigter Preis wird nie gelesen. Fix: Preis aus dem Richtpreis-Button der Seite lesen (oder Klavier-frei Beispiel mit bekanntem Wert) und gegen shown.totalCents (Cent) vergleichen; Gesendet-Seite auf denselben Betrag prüfen.
2. [mittel] docs/nacht/e2e.md:80 – Doku sagt, der Aufruf enthalte "Strecke"; wege.spec.ts:105-110 prüft service, from, to, preferredDate, shown, contact, keine Strecke. Fix: Strecke im Body prüfen (Feld laut quote-Aufruf) oder Doku korrigieren.
3. [niedrig] wege.spec.ts:81 – Gebührenprüfung nur im Request-Body. Kunden-Screens (Zusammenfassung, Gesendet, Aufträge) werden nicht auf "Plattformgebühr|Provision|MoveNow-Gebühr|15 %" geprüft. Fix: expect(page.locator('main')).not.toContainText(...) auf Zusammenfassung und Gesendet.
4. [niedrig] backend.ts:67 – Sperre deckt nur http/https. WebSocket (ws/wss, Realtime) wird nicht abgefangen. Die App nutzt aktuell kein Realtime/Service Worker (Grep leer), also kein akutes Loch. Fix: Konfig serviceWorkers: 'block' setzen und Kommentar, dass ws nicht gesperrt ist; oder page.routeWebSocket ergänzen.
5. [niedrig] backend.spec.ts:9-10 – Ergebnis "abgebrochen" für *.invalid und eine erfundene .supabase.co-Domain würde auch ohne Sperre (DNS-Fehler/kein Netz) eintreten; diskriminierend ist nur die Prüfung auf backend.unmocked (Zeile 11). Fix: Kommentar oder Ergebnisprüfung streichen, damit niemand sie für den Beweis hält.
6. [niedrig] docs/proof/nacht-e2e/nacht-e2e-r2-rotbeweis.log – nennt backend.spec.ts:30, Datei hat den Test jetzt in Zeile 31. Beweis selbst gültig (misst den Ist-Wert: ungemockter GET landet in unmocked, Test scheitert mit Meldung, Screenshot angelegt). Fix: Hinweis in docs/PROGRESS.md (Nachweisdateien nicht ändern).
7. [niedrig] wege.spec.ts:122-139 – Abbruch-Test W2 benutzt Stepper-Links, kein echtes Zurück (Browser/Zurück-Knopf); "calls toHaveLength(0)" ohne Warten ist als Negativprüfung schwach. Fix: einmal page.goBack() ergänzen, vor der Negativprüfung auf stabilen Zustand warten (oneMain).
8. [niedrig] backend.ts:29-33 / docs – Annahme Seed = Dev-DB ist haltbar (Migration 0015/0016 ändern Tarife nur über admin_*-Funktionen, kein Insert in price_config außer Seed); Risiko nur, wenn jemand per Admin Version 2 anlegt. Die Erwartung "55,75 € je Stunde" kommt aus dem Seed. Kein Fix nötig; im Doc als Annahme genannt.
9. [niedrig] docs/nacht/e2e.md:93,95 – F-4: test:e2e läuft jetzt auch auf 1280 px; "Handy"-Projekt ohne isMobile/hasTouch ist offen benannt. Kein Fehler.

Punkt 1 (Umgehung): Kein Service Worker, kein Realtime/WebSocket im Code (Grep), keine eigenen newContext in Tests, alle Muster hostunabhängig, Sperre ist als erste (niedrigste Priorität) registriert, Mocks und Seiten-Routen gehen vor, fallback() reicht korrekt durch. reuseExistingServer mit echter URL erreicht nichts (Origin != App wird abgebrochen). rest()/reply() bildet .single() (Accept vnd.pgrst.object) und Array-Antworten wie prices.ts/quote.ts/Auftraege.tsx lesen korrekt ab; .order/.eq werden ignoriert, was für den Seed unschädlich ist.
Punkt 2: Regex identisch zu scripts/s9a1-verify.mjs, 28-Zeilen-Check, platform_settings-Werte stimmen mit seed.sql (cancel_free_hours 48, call_out_fee_cents 6900). fee_rate wird nicht gelesen oder ausgeliefert.
Punkt 5: Keine Migrationen geändert, keine Dateien gelöscht, keine neuen Abhängigkeiten, kein .env gelesen, Platzhalter-Key ist kein Secret, kein fester Gebührensatz im App-Code.
Punkt 4: Lücken W1 bis W10, F wie in Phase 1 genannt geschlossen bis auf W4 Abbruch/Fehler (als bestehend verwiesen) und W8/W10 (unverändert).
