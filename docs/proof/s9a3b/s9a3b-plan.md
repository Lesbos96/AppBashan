# S9a-3b · Plan-Prüfung (Berater, Geld/Sicherheit/Schema)

- Datum: 2026-11-02
- Umfang: Kurzplan S9a-3b („angezeigt = gesendet“ nach akzeptiertem 409). Gelesen: `src/screens/anfrage/Zusammenfassung.tsx` (komplett), `src/lib/quote.ts` (komplett), `src/lib/draft.ts` (komplett), `docs/OPEN_ISSUES.md` 105–117, `supabase/functions/_shared/quote/handler.ts` 255–400, `supabase/functions/_shared/quote/hold.ts` (komplett). Zusätzlich für die Prüffragen: `src/screens/anfrage/Gesendet.tsx`, `src/lib/preview.ts` 34–57 und 111–115, `src/screens/Konfigurator.tsx` 220–223, `src/screens/entruempelung/Ergebnis.tsx` 73 und 151–157, `src/lib/prices.ts` 18–58, `tests/e2e/anfrage.spec.ts` 255–492, `scripts/redproof-s9a3.mjs` 20–33 und 296–330.
- Hinweis: In der Tool-Liste dieses Beraters stand ein eingebautes `advisor`-Tool ohne Parameter. Es wurde nicht benutzt.
- Stand der Dateien: Die E2E-Tests aus Planpunkt 1 stehen bereits in `tests/e2e/anfrage.spec.ts:302-368`. Der Schutz aus Planpunkt 5 steht bereits in `scripts/redproof-s9a3.mjs:27-33` und `:309-324`. `Zusammenfassung.tsx` ist noch der alte Stand (Ref `override`).

## Findings

### Hoch

**H-1 · `src/screens/anfrage/Zusammenfassung.tsx:245-251` und `:368-370`: Der Knopf „Neuen Preis übernehmen und senden“ / „Bedingungen bestätigen und senden“ sendet ohne Einwilligung, ohne gültigen Kontakt und trotz Kontowechsel.**
- Problem: `acceptChange` ruft `send(session?.user.id ?? '')` auf und prüft dabei weder `consent` noch `contactOk` noch `wait`. Der Knopf in der Karte hat kein `disabled`. Im 409-Zustand kann der Kunde den Haken bei der Einwilligung entfernen und trotzdem über die Karte senden. Wechselt in einem anderen Tab das Konto (`accountSwitched`, `:170`), ist `consent` false und die Seite zeigt den Hinweis auf das andere Konto. Die Karte sendet trotzdem: `shownId` ist dann schon die neue Sitzung, der Vergleich in `:217` greift also nicht. So entsteht eine Buchungsanfrage unter einem Konto, für das keine Einwilligung vorliegt. Damit wird genau die Sperre umgangen, die der E2E-Test „Kontowechsel in einem anderen Tab hebt die Einwilligung auf“ (`tests/e2e/anfrage.spec.ts:436-452`) für die Leiste belegt. Der Plan sperrt mit R2-N1 die Leiste im 409-Zustand. Danach ist die Karte der einzige Weg zum Senden, und dieser Weg bleibt ohne Prüfung.
- Fix: Der Karten-Knopf bekommt dieselbe Sperre wie die Leiste: `disabled={!consent || !contactOk || sending || wait > 0}`. `acceptChange` bricht zusätzlich früh ab, wenn `!consent || !contactOk` gilt (Prüfung auch in der Logik, nicht nur im Knopf). E2E dazu, je mit `calls` = 1: (1) 409, dann Haken entfernen, Kartenknopf ist disabled. (2) 409, dann Kontowechsel wie in `:436`, Kartenknopf ist disabled.

### Mittel

**M-1 · `src/screens/anfrage/Gesendet.tsx:21-23` mit `src/screens/entruempelung/Ergebnis.tsx:154`: Falscher Hinweis „Der Preis wurde aktualisiert.“ bei jeder unveränderten Spanne (Entrümpelung). Der Fehler besteht schon jetzt; die Prüffrage 2 betrifft ihn.**
- Problem: `Ergebnis` merkt sich in `shownKey` den Mittelwert `price.totalCents` der Vorschau, auch bei einer Spanne (`shownOf` setzt dort nur in `shownFull` `totalCents: null`, `src/lib/preview.ts:111-115`). Für eine Spanne gilt in `Gesendet` `estimate = true`. Angezeigt wird also `ca. <Mittelwert>`, verglichen mit `priceLabel(snapshot).main` = `X bis Y`. Beide Texte sind verschieden, also ist `updated` true. Der Server speichert aber nur bei exakter Gleichheit mit `shown` (`handler.ts:319`). Der Hinweis ist damit für jede normal gesendete Spanne falsch, solange low und high auf verschiedene Euro runden. Hergeleitet aus dem Code; einen E2E-Test für einen Spannen-Versand gibt es nicht. Der Plan verschlimmert das nicht: Nach `rememberShown(path, null, …)` ist `shownKey` leer, und es erscheint kein Hinweis.
- Fix (langfristig, eine Quelle): `Sent` trägt statt `shownCents` den vollen `Shown` (aus `readShownFull`). `Gesendet` vergleicht Art, total, low und high strukturell mit dem Snapshot, wie `matchesShown`. Der Text „Vorher angezeigt“ kommt aus `shownLabel`. Damit entfallen `shownKey`, `readShown` und der zweite Parameter von `rememberShown`. Liegt das außerhalb von S9a-3b, kommt es als mittel in `docs/OPEN_ISSUES.md`, mit einem E2E, der zuerst rot ist (Entrümpelung mit Spanne, Server antwortet mit gleicher Spanne, kein Hinweis erwartet).

### Niedrig

**N-1 · Plan Punkt 2 / `Zusammenfassung.tsx:248`: `shown` nicht explizit an `send()` geben, nur `priceVersion` bzw. `terms`.**
- Problem: Gibt `acceptChange` `shown` explizit an `send()` und schlägt `rememberShown` still fehl (`draft.ts:117-119` schluckt Fehler), dann sendet der erste Aufruf den neuen Preis. Nach dem nächsten Render zeigt die Karte aber den alten Preis aus `readShownFull`.
- Fix: `shown` kommt immer aus `readShownFull` (Fallback in `buildBody`, `quote.ts:27`), explizit nur `priceVersion` und `terms`. Direkt nach `rememberShown` prüfen, ob `readShownFull(path)` dem angenommenen Wert entspricht. Wenn nicht, gilt der Zustand `unavailable` und es wird nichts gesendet.

**N-2 · `Zusammenfassung.tsx:245-251`: `acceptChange` braucht zusätzlich einen Wächter.**
- Problem: Heute sendet `acceptChange` ohne Übernahme, wenn `snapshot` oder `priceVersion` fehlt (`:248`, danach `:250`). Nach R2-N2 ist dieser Zustand nicht mehr erreichbar.
- Fix: Fehlen die Werte, bricht `acceptChange` ohne Senden ab (Abwehr in der Tiefe, falls sich das catch später ändert).

**N-3 · Plan Punkt 2: `acceptedVersion` liegt nur im State, der angenommene Preis aber im sessionStorage.**
- Problem: Nach Remount, Reload oder Übergabe über die Anmeldung (`stashDraft` nimmt `shownFull` mit, `draft.ts:106`) fällt `priceVersion` auf die frisch geladene aktuelle Version zurück (`prices.ts:18-22`, ohne Cache). Das ist im Normalfall dieselbe Version, die der Server im 409 genannt hat (`versionFor`, `handler.ts:265-266`). Andernfalls folgt ein weiteres 409. Das ist sicher, aber es entstehen zwei Quellen.
- Fix: Für S9a-3b so lassen und im Code kommentieren. Mit OPEN_ISSUES N-2 (Version zusammen mit `shown` merken) wird es eine Quelle. E2E: 409 → übernehmen → `abort` → Reload → die Karte zeigt 800,00 € → senden → `body.shown` = 80000, `body.priceVersion` = aktuelle Version.

**N-4 · `tests/e2e/anfrage.spec.ts:302-368`: Abdeckungslücken.**
Neben H-1 fehlen diese Tests:
- 409 `price_changed` übernehmen, danach 409 `terms_changed` übernehmen: Der letzte Body enthält beide neuen Werte (Preis aus dem Speicher, Version aus dem State, Hash aus `acceptedTerms`).
- Leiste disabled auch im Zustand `terms_changed`; `:342-350` prüft nur `price_changed`.
- Angenommene Spanne bzw. angenommenes Angebot: Die Karte zeigt „X bis Y“ bzw. „Preis nach Prüfung“, `Gesendet` zeigt keinen Hinweis.

Der Fall „Preis ohne Snapshot“ (`:354`) ist schon gegen den heutigen Code grün (`Zusammenfassung.tsx:234`). Er ist ein Regressionstest, kein Rot-Beweis. Das im Nachweis so benennen.

**N-5 · `scripts/redproof-s9a3.mjs:30`: Die Prüfung auf uncommittete Änderungen umfasst nur `handler.ts`.**
- Problem: `functions deploy quote` (`:306`) lädt alle Dateien der Function hoch, also auch `_shared/quote/*`, `hold.ts` und die Snapshot-Module. Uncommittete Änderungen dort landen ungeprüft auf Dev und bleiben nach dem `finally` dort.
- Fix: `git status --porcelain -- supabase/functions` muss leer sein, sonst Exit 2. Planpunkt 5 ist sonst schon umgesetzt (`:27-33`, `:309-324`). Der Plan sollte nur noch dieses Delta nennen. Ein Fehler beim Deploy im `finally` wird als Ausnahme geworfen und ist damit laut genug.

## Beantwortung der Prüffragen

**(1) Gilt „angezeigt = gesendet“ in allen Pfaden?** Für den Betrag ja, wenn N-1 umgesetzt ist. Für das Senden selbst erst mit H-1.

| Pfad | Anzeige | Body | Ergebnis |
|---|---|---|---|
| Preis übernommen, dann Folgefehler | Karte aus `readShownFull` (`Zusammenfassung.tsx:193`, `:275`) | `shown` aus `readShownFull` (`quote.ts:27`), Version aus dem State | gleich |
| Angebots-Snapshot | „Preis nach Prüfung“ (`quote.ts:191`) | `{kind:'offer', reasons}` in Server-Reihenfolge (`quote.ts:207`). `matchesShown` vergleicht die Reihenfolge (`hold.ts:26`) | gleich; `shownKey` wird gelöscht, kein Hinweis |
| Spanne (total null) | `X bis Y` in ganzen Euro | low und high in Cent | gleich bis auf die Rundung der Anzeige (R2-N3, bekannt, nicht verbindlich). Der zweite Parameter von `rememberShown` muss `snapshot.totalCents` sein, also null |
| Remount/Reload nach Annahme | angenommener Preis aus dem Speicher; Bedingungen frisch geladen | Preis aus dem Speicher; Hash aus derselben `terms`-Quelle wie die Anzeige; Version frisch geladen | Betrag und Bedingungen gleich; die Version kann zu einem weiteren 409 führen (N-3), sicher |
| Zweites 409 nach Annahme | zweite Karte; die nicht betroffene Karte zeigt den angenommenen Wert | `acceptChange` läuft aus dem neuesten Render, der State ist gesetzt | gleich (Test fehlt, N-4) |
| Zurück in den Konfigurator | „Weiter“ überschreibt `shownFull` mit der Vorschau (`Konfigurator.tsx:221`) | Vorschau | gleich. Zurück ohne „Weiter“: die Eingaben sind neu, der angenommene Preis bleibt, der Server lehnt mit 409 ab (`handler.ts:319`). Der Server speichert nur, wenn der Betrag der neuen Eingaben dem angezeigten gleicht |

Bedingung für alle Pfade: Anzeige und Body lesen dieselbe Quelle zur Render- bzw. Sendezeit. `sessionStorage` gilt je Tab, und `restoreDraft` schreibt nur fehlende Schlüssel (`draft.ts:215`). Zwischen Render und Klick ändert sich `shownFull` also nicht.

**(2) clientRef und `shownKey`.** `refFor` setzt `priceVersion` 0, `termsHash` '' und `shown` null (`Zusammenfassung.tsx:227`). Damit bleibt die Ref über `rememberShown` und die State-Werte hinweg gleich, und eine Änderung am Kontakt erzeugt korrekt eine neue Ref. Ein Sonderfall ist richtig behandelt: Wurde der erste Aufruf gespeichert, ging aber die Antwort verloren, liefert der Server nach der Annahme mit derselben Ref die gespeicherte Antwort (`handler.ts:393-397`). Das ist der früher gezeigte und bestätigte Preis. `Gesendet` meldet dann richtig „Vorher angezeigt: <angenommener Preis>“. Nach einer Annahme erzeugt der geänderte `shownKey` keinen falschen Hinweis: Beim Festpreis sind beide Beträge gleich; bei Spanne und Angebot ist der Schlüssel leer. Unabhängig vom Plan erzeugt der normale Spannen-Pfad aber schon heute einen falschen Hinweis (M-1).

**(3) Speichert der Server einen Preis, den der Kunde nicht gesehen hat?** Nein. Der Server speichert nur bei gleicher Version und exakt gleichem `shown` (`handler.ts:319`). `shown` stammt nach dem Plan immer aus der Quelle der Anzeige. Bei einem Replay über die clientRef liefert der Server den früher gezeigten Preis; den Unterschied meldet `Gesendet`. Die Rundung der Spanne ist bekannt (R2-N3). Offen ist allein H-1: Der Preis wurde gesehen, aber über die Karte ohne Einwilligung bzw. unter einem anderen Konto gesendet.

**(4) Sonstige Lücken.** H-1 (Sperre des Kartenknopfs), N-1 (`shown` nicht doppelt führen), N-2 (Wächter in `acceptChange`), N-4 (Tests), N-5 (Umfang der Prüfung im Redproof-Skript). M-1 entweder in diese Session nehmen oder in OPEN_ISSUES eintragen.

## Stichproben (selbst nachgeschlagen)

| Datei:Zeile | Ergebnis |
|---|---|
| `src/screens/anfrage/Zusammenfassung.tsx:174` | `override` als Ref, löst keinen Render aus (Ursache von R2-M1), bestätigt |
| `src/screens/anfrage/Zusammenfassung.tsx:193-195` | Preiskarte aus `readShownFull`, Stornierung aus `terms` (nicht aus override), bestätigt |
| `src/screens/anfrage/Zusammenfassung.tsx:221` | Body nimmt `override.current.*`, die Anzeige nicht: Abweichung bestätigt |
| `src/screens/anfrage/Zusammenfassung.tsx:227` | `refFor` ohne priceVersion, termsHash und shown: die Ref bleibt stabil |
| `src/screens/anfrage/Zusammenfassung.tsx:234` | nur `price_changed` ohne Snapshot wird `unavailable`, ohne priceVersion nicht (R2-N2) |
| `src/screens/anfrage/Zusammenfassung.tsx:245-251`, `:368` | `acceptChange` und Kartenknopf ohne Prüfung von consent und contactOk (H-1) |
| `src/screens/anfrage/Zusammenfassung.tsx:400` | Leiste mit consent und contactOk gesperrt, im 409-Zustand aber aktiv (R2-N1) |
| `src/lib/quote.ts:27` | `confirmed.shown ?? readShownFull(path)`: der Fallback trägt die Plan-Variante |
| `src/lib/quote.ts:151-152` | 409 liefert `priceVersion` bzw. `terms` als undefined, wenn sie fehlen oder unlesbar sind; `snapshot` wird null bei unlesbarem Snapshot |
| `src/lib/quote.ts:206-208` | `shownFromSnapshot` übernimmt die Gründe in Server-Reihenfolge, total null bei Spanne |
| `src/lib/draft.ts:112-120` | `rememberShown` löscht `shownKey` bei null und schluckt Speicherfehler (N-1) |
| `src/lib/draft.ts:106` | `shownFullKey` gehört zu `draftKeys`, wird also über die Anmeldung übergeben und von `finishDraft` gelöscht |
| `supabase/functions/_shared/quote/handler.ts:272` | Bedingungen werden vor dem Preis geprüft: ein zweites 409 nach der Annahme ist möglich |
| `supabase/functions/_shared/quote/handler.ts:265-266` | Haltefenster: die gezeigte Version oder die aktuelle |
| `supabase/functions/_shared/quote/handler.ts:319` | Speichern nur bei gleicher Version und `matchesShown` |
| `supabase/functions/_shared/quote/hold.ts:23-35` | exakter Vergleich ohne Toleranz, Gründe nach Reihenfolge |
| `src/screens/anfrage/Gesendet.tsx:21-23` | Vergleich als Text: `ca. Mittelwert` gegen `X bis Y` (M-1) |
| `src/screens/entruempelung/Ergebnis.tsx:154` | `shownKey` = Mittelwert auch bei Spanne (M-1) |
| `src/lib/prices.ts:18-22` | `loadPrices` ohne Cache: nach einem Remount gilt die aktuelle Version (N-3) |
| `tests/e2e/anfrage.spec.ts:302-368` | Plan-E2E (a)–(d) vorhanden; „Preis ohne Snapshot“ ist schon grün (N-4) |
| `scripts/redproof-s9a3.mjs:30`, `:306` | Prüfung nur für handler.ts, Deploy der ganzen Function (N-5) |

Offene Findings hoch: 1
