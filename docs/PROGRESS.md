# MoveNow · Fortschritt

Je Session 3–5 Zeilen: Datum, Session, was fertig ist, offene Punkte, Entscheidungen.
Wird eine Session wegen der Kontextgröße unterbrochen, steht hier „Weiter bei:" mit der genauen Stelle. Die nächste Session setzt dort fort.

## 2026-10-29 · S1 · Fundament und Architektur · abgeschlossen bis auf env:check
- Gerüst (Vite 8, React 19, Router 8, Tailwind 4, Motion, Vitest 5, Playwright, ESLint 10, TypeScript 6.0), Skripte, `@pricing`-Alias, Supabase verlinkt, Migrationen 0001–0003 und Seed eingespielt, `docs/ARCHITECTURE.md`
- Anfragen und Mietanfragen schreibt nur die Edge Function `quote` (S8); Kunden haben nur `update(status)` → withdrawn. Rechte über Spalten-Grants plus RLS. Fotos: erst Eintrag in `request_photos`, dann Upload (Policies ohne Selbstbezug, 42P17).
- Nachweise: check 0 (1/1), build 0, test:e2e 0 (1/1), RLS 35/35 mit Exit 0. Der RLS-Lauf hat die zwei App-Variablen nur im Prozess umbenannt, weil `.env.local` sie noch als `NEXT_PUBLIC_…` führt.
- Offen: Umbenennung in `.env.local` durch Beks, danach `npm run env:check` und `npm run test:rls` (ROADMAP-Punkt env:check); Löschfristen und Freigabe geänderter Angebote (Entscheidung); Quellen ohne Einzelnachweis (OPEN_ISSUES.md)

<!-- Beispiel:
## 2026-10-30 · S1 · abgeschlossen
- Gerüst, Migration 0001, RLS-Tests (12/12) grün
- Offen: Partner-Gebietsmodell (PLZ-Liste vs. Bezirke) – Entscheidung Beks

## 2026-11-02 · S6 · unterbrochen
- Konfigurator und Routengrafik fertig, Preis-Sheet offen
- Weiter bei: Preis-Sheet wie 05, danach E2E Umzug-Beispiel
-->
