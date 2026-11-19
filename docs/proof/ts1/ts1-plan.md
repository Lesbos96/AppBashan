# ts1 · Plan und Auflagen der Planprüfung (advisor, claude-fable-5-2)

Kennung: ts1-1911-a · Stufe R3 · Effort laut Transkript: high (`"effort":"high"`, `"perTurnEffort":"high"`).

## Plan (A bis E, freigegeben mit Änderungen)
A. Function `route`: `_shared/turnstile.ts` (siteverify, Timeout 5 s, ohne remoteip), Token im Body-Feld `captcha`, Reihenfolge Methode → apikey → Body/JSON → Modus/Eingaben → Captcha → Zähler. Fehlt/leer/zu lang/ungültig: 403 `captcha_failed` ohne Wirkung; Prüfung scheitert: 503 `captcha_unavailable` (fail closed). Secret `TURNSTILE_SECRET_KEY`. Deploy `route` und `quote` (quote lädt route/handler.ts).
B. Frontend: `src/lib/turnstile.ts` + `CaptchaHost` (ein Widget, interaction-only, Warteschlange, frisches Token je Aufruf), Aufrufer `requestSignIn` und `route.ts`.
C. Auth-Captcha: Dashboard-Schalter und Secret setzt Beks; Testhelfer senden vorher das Dummy-Token.
D. Tests: Unit (Handler, siteverify, Client, auth), e2e mit Stub, rls/Live `tests/rls/captcha-live.test.ts`, Screenshots 390/1280.
E. Doku: GOLIVE, ENTSCHEIDUNGEN, STAND, OFFEN, BEKS.

## Auflagen 1 bis 9 (bindend)
1. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` wird erst committet, wenn Beks' wörtliches Ja vorliegt (Schritt-Prompt oder Antwort in BEKS.md). Der Prompt von ts1 nennt die Variable ausdrücklich („Site-Key aus Env, in .env.example eintragen“); der Satz in `daten.md:20` bleibt eine Regel von Beks (BEKS Frage 1).
2. Reihenfolge Auth: alle `signInWithPassword`-Stellen und alle `route`-Aufrufer in `tests/` und `scripts/` senden das Token, BEVOR der Dashboard-Schalter umgelegt und `route` deployt wird. Danach sind andere Branches und Worktrees bei rls/Live rot, bis sie auf ts1 rebasen: in STAND vermerken.
3. Siteverify: `invalid-input-response` und `timeout-or-duplicate` → 403; `missing-input-secret`, `invalid-input-secret`, `bad-request`, `internal-error`, Nicht-JSON, Timeout → 503. Geloggt wird nur der Code, nie Token, Secret oder IP.
4. Client `auth.ts`: `captcha_failed` am `error.code` erkennen, vor `transient()`; kein automatischer Wiederholversuch; Skript-Ladefehler ergibt offline/network, nicht captcha.
5. Widget: `getCaptchaToken()` strikt nacheinander, eigenes Timeout, kein Token-Cache, Reset nach jeder Ausgabe; Skript lädt erst bei der Nutzeraktion (Absenden, nach Einwilligung), nie beim Mount. Interaktionsfall per Tastatur bedienbar, Fokus, Light und Dark, Sprache de, nicht unter der Aktionsleiste.
6. Secret nur als Function-Secret und im Auth-Dashboard; Testsecret-Wert nicht in Code, Tests oder `docs/proof` (Unit-Tests mit Platzhalter, `scan:proof` nicht anfassen). `config.toml` bekommt `[auth.captcha]` mit `env(...)`, Name in `.env.example` ohne Werte.
7. Schutz vor Testschlüsseln in Produktion: GOLIVE-Nachweis für 13 und 18 = `route` und `signInWithOtp` mit dem Dummy-Token müssen im Produktivprojekt scheitern. `golive-check`/`scan-dist` schlägt bei einem Test-Site-Key im Build fehl; Erweiterung nur additiv, sonst als OFFEN.
8. GOLIVE 13 und 18 nicht abhaken (nur „Code gebaut, Nachweis mit Testschlüssel“). GOLIVE 26 bleibt offen, mit BEKS-Frage, ob Punkt 18 dafür reicht. Neu in GOLIVE: Hostnamen für Capacitor-WebView, CSP beim Hosting, Hinweistext zu Turnstile bei der Einwilligung (Rechtsfrage § 165 TKG, keine Textänderung ohne Beks).
9. Nach dem Deploy von `route` und `quote` den vollen rls-Lauf fahren (Geldweg `quote` grün), nicht nur `captcha-live.test.ts`. Body mit 2048-Zeichen-Token plus 200-Zeichen-Adresse bleibt unter 4096 Byte (Unit-Fall, gebaut).

Risiken: (a) Garbage-Tokens lösen unbegrenzt Siteverify-Aufrufe aus (bewusst akzeptiert, OFFEN). (b) Live prüfen: Status und Code von Auth bei fehlendem Token; `verifyOtp`, Refresh und MFA laufen ohne Token weiter. (c) Parallele geocode-/route-Aufrufe und „Erneut senden“ bekommen je ein eigenes Token (e2e mit Stub). Mit dem Always-pass-Secret ist „ungültiges Token → 403“ nur per Unit-Test beweisbar: im Bericht so benennen.

Gemessen in ts1 (Abweichung vom Plan): Ein Auth-Fehler mit Status 500 verliert im Client den Code (AuthRetryableFetchError); `captcha_failed` kommt als 400/422 an (Messprobe mit gemockter Antwort).
