# Review S8b-1 Fixes (Runde, gestagter Diff)
Geprüft: src/screens/Anmelden.tsx, tests/e2e/anmelden.spec.ts. Keine Screenshots, nur Code.

Findings
- [mittel] tests/e2e/anmelden.spec.ts:157 und :166 - Fix 2 (Anleitung im Fehlerzustand weg) ist nicht getestet; die Tests prüfen nur den Alert. Fix: nach dem Fehler `await expect(page.getByText('Tippe auf')).toHaveCount(0)` bzw. im Sitzungsfall `schon als` auf count 0 prüfen.
- [niedrig] src/screens/Anmelden.tsx:152-153 - Zähler ist ein statischer <p> ohne Status-Rolle; Screenreader erfahren den Zustand nur beim Navigieren, die Sekundentakt-Änderung bewusst nicht anzusagen ist richtig (kein aria-live je Sekunde). Fix optional: Text ohne Live-Region lassen, aber beim Ende des Zählers nichts ansagen ist akzeptabel; kein Muss.
- [niedrig] src/screens/Anmelden.tsx:155 - Nach Tipp auf "Code erneut senden" wird der Knopf (cooldown > 0) ausgehängt, der Fokus fällt auf body (zuvor bei disabled ähnlich). Fix optional: Fokus auf das Code-Feld setzen.

Bestätigt
- Touch-Ziel: min-h-11 = 44 px, zentriert; Zähler tabular-nums, Zahl und "s" in einer Zeile, text-secondary-Token, keine Emojis.
- Korrektheit: Während Cooldown kein klickbarer Knopf, danach "Code erneut senden" mit disabled={busy}. Entspricht dem Test.
- Login-CSRF: Zweig `error ? null : session ? ...` zeigt bei Sitzung ohne Fehler weiter die "schon als ... angemeldet"-Anleitung, "Trotzdem mit dem Link anmelden" und "Abbrechen" bleiben unverändert; Test Zeile 62-71 deckt das ab. Im Fehlerfall bleibt der Weg "Neuen Code anfordern" und role="alert" erhalten.
- Keine Gebühr-, Geld- oder Sicherheitsänderung.
