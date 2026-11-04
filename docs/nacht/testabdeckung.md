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

(wird je Teilziel ergänzt)
