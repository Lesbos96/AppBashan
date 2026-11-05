# Nacht 04./05.11.2026 · Aufgabe „Testabdeckung für src/“ (ohne echte Datenbank)

Branch `nacht-testabdeckung` (von `main` 1630668), Draft-PR gegen `main`. Bestehender Code bleibt unverändert; neu sind nur Testdateien unter `tests/unit/` und diese Datei.

## Start

Gemeinsamer Start aller drei Nachtaufgaben, Einzelheiten in `docs/nacht/audit.md` (Branch `nacht-audit`): Dokumente gelesen, keine Supabase-Schlüssel in den Umgebungsvariablen (nur Namen geprüft), kein `.env.local` im Repo, Supabase-MCP-Connector vorhanden, aber nicht benutzt. `npm ci` (Lockfile, nichts hinzugefügt oder aktualisiert) EXIT=0.

## Entscheidungen

| Nr. | Entscheidung | Begründung |
|---|---|---|
| T1 | Keine neue Abhängigkeit: kein `jsdom`/`happy-dom`, kein `@testing-library/react`, kein Coverage-Provider. Die Abdeckungsliste (Phase 1) ist deshalb eine Liste je exportierter Funktion, keine gemessene Zeilenabdeckung. | Verbot „Abhängigkeiten hinzufügen“. `@vitest/coverage-v8` ist nicht installiert. |
| T2 | Neue Tests als `tests/unit/*.test.ts` (nicht `.tsx`). | Das Vitest-Projekt `unit` nimmt nur `tests/unit/**/*.test.ts` (`vite.config.ts:18`); die Konfiguration bleibt unverändert. |
| T3 | Komponententests (Phase 4) rendern die Screens mit `react-dom/server` (`renderToStaticMarkup`) in Node, mit `createElement` statt JSX, Supabase per `vi.mock`, Speicher per `vi.stubGlobal`. Geprüft wird der erste Render (ohne Effekte). | Ohne DOM-Umgebung gibt es keine Interaktion; der erste Render zeigt aber Texte, Beträge, Labels und Zustände aus dem Speicher. Interaktion bleibt bei den bestehenden Playwright-E2E. |
| T4 | Bekannte Fehler aus `docs/OPEN_ISSUES.md` werden auf diesem Branch nicht behoben und nicht als roter Test eingecheckt; sie gehören zur Aufgabe „OPEN_ISSUES“ (Branch `nacht-open-issues`). Neue, bisher unbekannte Fehler: Test-Commit, dann Fix-Commit (Auftrag). | `npm run check` soll auf jedem Branch grün sein; doppelte Fixes in zwei Branches erzeugen Merge-Konflikte. |
| T5 | Einzelne Testdateien laufen beim Schreiben direkt mit `npx vitest run <datei>` in der Hauptsession; `npm run check` je Teilziel über den Subagent `test-runner` (Exit-Code im Log unter `tmp/proof/`). | `CLAUDE.md`: `check` läuft nie im Hauptkontext; ein gezielter Einzellauf ist kein `check`. |

## Phase 1 · Bestand: Module in `src/` und ihre Tests (Stand `main` 1630668)

Legende: ✓ getestet · teilw. = nur einzelne Fälle · ✗ kein Test · E2E = nur über Playwright (`tests/e2e/`).

### `src/lib/`

| Modul | Export | Unit-Test vorher | Notiz |
|---|---|---|---|
| `money.ts` | `formatEuro`, `formatEuroRounded` | ✓ `money.test.ts` (+ Deno-Gleichlauf `money-deno.ts`) | |
| `auth.ts` | `requestSignIn`, `verifyCode`, `verifyLink`, `signInWithApple`, `digitsOnly`, `safeNext`, `rememberNext`, `takeNext` | ✓ `auth.test.ts` | `signOut`, `leaveAccount` ✗ (nur E2E) |
| `draft.ts` | `stashDraft`, `restoreDraft`, `purgeHandover`, `finishDraft`, `rememberShown`, `readShown`, `readSent`, `viennaToday`, `draftKeys` | ✓ `draft.test.ts` | `readContact`, `writeContact`, `readTermin` (Prüfung), `clearSent`, `readShownFull` (nur indirekt) ✗; `useTermin` Hook ✗ |
| `quote.ts` | `buildBody`, `refBody`, `refFor`, `parseSnapshot`, `priceLabel`, `shownLabel`, `termsText`, `sendQuote` | ✓/teilw. `draft.test.ts` | `parseTerms`, `loadTerms`, `shownFromSnapshot`, `invalidText`, `invalidTarget`, `rejectedText`, `errorText` ✗; `sendQuote`: 401/429/503/409/422/400 nur teilw. |
| `flow.ts` | `readFlow`, `readClearanceFlow`, `readMontageFlow`, `toAssembly`, Anfangswerte | ✗ (nur `initialFlow` als Testeingabe) | Prüfung gespeicherter Zustände (Typen, Aufzählungen, Grenzen) ungetestet |
| `preview.ts` | `previewTransport`, `lineText`, `offerReasonText` | ✓ `preview.test.ts` | `previewClearance`, `previewAssembly`, `shownOf`, `toTariffs`, `minHours`, `hoursText`, `floorText`, `lmText`, `assemblyText`, `clearanceLineText`, `clearanceFields` ✗ |
| `prices.ts` | `loadPrices` (mit `parseSources`), `useLoad` | ✗ | `parseSources` filtert Links auf `https://` (Sicherheitsrelevanz: kein `javascript:`-Link im Info-Sheet) |
| `route.ts` | `geocode`, `route`, `RouteError`, `routeErrorText` | ✗ | Fehlerabbildung 429/HTTP/Netz ungetestet |
| `routeResult.ts` | `isRouteResult` | ✓ `photos.test.ts:28-38` | |
| `photos.ts` | `preparePhoto`, `MAX_PHOTOS`, `MAX_BYTES` | teilw. `photos.test.ts` | HEIC, Grenze genau 10 MB, `clearPhotos`, `renewPhotoIds`, `getPhotos` ✗; `usePhotos` Hook ✗ |
| `uploads.ts` | `uploadAll`, `discardStaging`, `forgetStaging`, Fehlerabbildung | ✓ `uploads.test.ts` | `photoUrls` ✗, Texte `failureText`/`photoRejectedText` ✗ |
| `onboarding.ts` | `hasOnboarded`, `finishOnboarding` | ✗ | Speicher wirft (privates Fenster) |
| `online.ts`, `session.tsx`, `supabase.ts`, `motion.ts` | Hooks, Kontext, Client, Konstante | ✗ | Hooks ohne DOM nicht sinnvoll; `supabase.ts` nur Konfiguration (`detectSessionInUrl: false` ist per E2E belegt) |

### `src/screens/`, `src/components/`, `src/app/`

| Datei | Test vorher | Notiz |
|---|---|---|
| `screens/anfrage/format.ts` (`utc`, `dayText`, `shortDayText`, `longDay`) | ✗ | reine Logik |
| `screens/entruempelung/options.ts` (`objects`, `fills`, `objectOf`) | ✗ | reine Daten |
| `screens/konfigurator/useRouteCalc.ts` | E2E | Hook |
| `Start`, `Profil`, `PreiseSheet`, `Onboarding`, `Anmelden`, `Auftraege`, `Konfigurator`, `Montage`, `Seiten`, `anfrage/*`, `entruempelung/*`, `konfigurator/*` | E2E (`anfrage.spec.ts` 33, `anmelden.spec.ts` 11, `konfigurator.spec.ts` 11, `fotos.spec.ts` 12, `dienste.spec.ts` 9, `shell.spec.ts` 10, `smoke.spec.ts` 2) und Shots | keine Komponententests |
| `components/*` | E2E `komponenten.spec.ts` (Galerie `/dev/fundament`) | |
| `app/Shell.tsx`, `app/router.tsx` | E2E `shell.spec.ts` | |

## Verlauf

| Teilziel | Commit | Ergebnis |
|---|---|---|
| Phase 1 Bestandsliste | 6e7435f | diese Datei |
| Phase 2 `flow.ts` (gespeicherter Zustand, Grenzen aus `LIMITS`) | dcf9236 (Test, rot), 92a466a (Fix) | **echter Fehler:** Bruchzahlen bei Feldern, die das Preismodul mit `int()` liest (`crew`, `vehicles`, Stockwerke, Kartons, Halteverbot, Entrümpelung `floor`), wurden aus dem sessionStorage übernommen; die Vorschau blieb im Fehlerzustand und jeder Stepper-Schritt behielt den Bruch. Vor dem Fix 7 Fälle rot, danach grün. Fix: `whole()` in `flow.ts`. |
| Phase 2 reine Logik (`quote`, `prices`, `route`, `onboarding`, `preview`, `format`, `options`) | 9dfa301 | `quote-helpers.test.ts` (17), `client-lib.test.ts` (16), `preview-helpers.test.ts` (10). Bemerkenswert: `loadPrices` filtert Quellen-Links auf `https://` (kein `javascript:`-Link im Info-Sheet) – jetzt per Test belegt. |
| Phase 3 Fotos/Uploads | 548d9bb (Test, rot), 186aef5 (Fix) | **echter Fehler:** HEIC-Datei ohne MIME-Typ (Chrome unter Windows) bekam „Das ist kein Bild.“ statt der HEIC-Meldung, weil der Namens-Check erst nach der Typprüfung lief. Der bestehende Testfall dafür endete mit `if (!type) return` und prüfte nichts. Vor dem Fix 3 Fälle rot. Fix: HEIC-Prüfung zuerst; `return` im alten Test entfernt. E2E `fotos.spec.ts:191` (HEIC mit Typ) und `konfigurator.spec.ts:162` („kein Bild“ für `.txt`) bleiben gültig. |
| Phase 3 Entwurfsspeicher | 765f127 | `draft-extra.test.ts` (27): Kontakt, Termin, `readShownFull` (keine Zusatzfelder wie `feeCents` übernommen), `readSent`, gesperrter Speicher. |
| Phase 4 Komponententests | 6a53368 | `screens.test.ts` (24): Start, Onboarding, Profil, Datenschutz, Impressum, Folgt, Anmelden (Token aus dem Fragment nie im Markup), Aufträge (keine Abfrage ohne Sitzung), Gesendet (Festpreis, Abweichung, Angebot, unlesbarer Snapshot, fremder Pfad). Je Screen die Regeln aus `CLAUDE.md`: keine Gebühr/Prototyp-Texte, Beträge nur mit geschütztem Leerzeichen, Felder mit Label, Knöpfe/Links mit Namen. Gegenprobe: die Regel-Prüfung schlägt bei sechs absichtlich falschen Markups an. Gemockt: Supabase, Sitzung, `Illustration` (matchMedia ohne Server-Snapshot) und `Sheet` (liest `window.innerHeight` im Render). |

**Prüfläufe (test-runner, Logs in `tmp/proof/`):** `nacht-tests-check-1.log` (Stand 186aef5) `npm run check` EXIT=0, 471 Tests; `nacht-tests-check-2.log` (Stand 6a53368) `npm run check` EXIT=0, 522 Tests (vorher auf `main`: 368 laut `PROGRESS.md`); `nacht-tests-build-2.log` `npm run build` mit Dummy-Werten für URL und Publishable Key (kein `.env.local`) EXIT=0. E2E nicht gelaufen: an den Screens ändern die beiden Fixes nur Validierung bzw. Meldungsreihenfolge, und die betroffenen E2E-Fälle sind oben nachgeschlagen.

**Grenzen der Komponententests:** Erster Render ohne Effekte. Screens, die erst nach dem Laden der Tarife etwas zeigen (Konfigurator, Entrümpelung, Montage, Zusammenfassung), zeigen dort nur den Ladezustand; sie bleiben bei den E2E. Bekannte Fehler aus `OPEN_ISSUES.md` (z. B. Plan-M-1, „Vorher angezeigt“ bei Spannen) sind hier bewusst nicht getestet (T4), sie gehören zur Aufgabe „OPEN_ISSUES“.

**Nachdurchgang (WEITERMACHEN):** Reviewer-Abnahme des ganzen Diffs (`tmp/proof/nacht-tests-review.md`): kein „hoch“; beide Fixes korrekt und minimal (Dezimalfelder `hours`, `assemblyLm`, `area`, `upper`, `tall` bleiben Bruchzahlen; HEIC-Erkennung trifft nur `image/hei[cf]` bzw. `.heic`/`.heif`). Umgesetzt in cb24272: Regel-Prüfung der Screens prüft Gebührenwörter auch in `aria-label`/`title`/`placeholder`/`alt` (mittel), `€` am Textanfang, `for=` nur an `<label>`; drei neue Gegenproben; Profil mit offenem Info-Sheet als eigener Fall (mittel; zeigt im ersten Render nur den Ladezustand); Testnamen präzisiert; `createImageBitmap` im 10-MB-Fall ausdrücklich gestubbt; `rejectedText`-Schlüssel geprüft; `vi.unstubAllGlobals()` nach jedem Test. Zeitzonen: `preview-helpers.test.ts` unter `TZ=Pacific/Auckland` und `TZ=America/Los_Angeles` je EXIT=0 (`tmp/proof/nacht-tests-tz-*.log`). Nicht umgesetzt: Hinweis des Reviewers, der Fall „Angebot nötig“ in `screens.test.ts` halte Plan-M-1 fest – das trifft nicht zu (Plan-M-1 betrifft Spannen; der Hinweis bei Angebot ist gewolltes Verhalten „nie still“), der Fall bricht aber beim Zusammenführen mit `nacht-open-issues`, weil dort `shownCents` entfällt (siehe unten).

**Hinweis zum Zusammenführen:** Die Aufgabe „OPEN_ISSUES“ (Branch `nacht-open-issues`) ändert `Sent` in `src/lib/draft.ts`, falls Plan-M-1 dort umgesetzt ist. Dann müssen `draft-extra.test.ts` („Bestätigung (sent)“) und `screens.test.ts` („Bestätigung nach dem Senden“) beim Zusammenführen auf das neue Feld umgestellt werden; Einzelheiten in `docs/nacht/open-issues.md`.
