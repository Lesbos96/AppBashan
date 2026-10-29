# MoveNow · Fortschritt

Je Session 3–5 Zeilen: Datum, Session, was fertig ist, offene Punkte, Entscheidungen.
Wird eine Session wegen der Kontextgröße unterbrochen, steht hier „Weiter bei:" mit der genauen Stelle. Die nächste Session setzt dort fort.

## 2026-10-29 · S2 · Preis-Engine · abgeschlossen
- Modul `supabase/functions/_shared/pricing/` (Transport/Umzug, Entrümpelung, Montage, Miete, `splitFee`, `parse*Input`), 81 Unit-Tests grün: 5 README-Beispiele centgenau, 60 Golden-Fälle aus dem Prototyp (`npm run fixtures:pricing`)
- Entscheidungen (advisor): Gebühr in Ganzzahl half-up statt Float; Zeilen per Largest-Remainder; Serverfakten (`RouteFacts`, `RentalOffer`) getrennt von der Kundenwahl. Abweichungen in `docs/PRICING.md`
- Für S8a: `parse*Input` verwirft unbekannte Schlüssel; `quote` speichert nur geprüfte Felder. `splitFee` bleibt in `@pricing` (Vermieter-Abrechnung S9 braucht sie)
- Offen: DB-Check `price_config.value >= 0` und Seed-Test `rate_low ≤ rate ≤ rate_high` (S3a/OPEN_ISSUES)

## 2026-10-29 · S1 · Fundament und Architektur · abgeschlossen
- Gerüst (Vite 8, React 19, Router 8, Tailwind 4, Motion, Vitest 5, Playwright, ESLint 10, TypeScript 6.0), Skripte, `@pricing`-Alias, Supabase verlinkt, Migrationen 0001–0003 und Seed eingespielt, `docs/ARCHITECTURE.md`
- Anfragen und Mietanfragen schreibt nur die Edge Function `quote` (S8a); Kunden haben nur `update(status)` → withdrawn. Rechte über Spalten-Grants plus RLS. Fotos: erst Eintrag in `request_photos`, dann Upload (Policies ohne Selbstbezug, 42P17).
- App-Variablen mit Präfix `NEXT_PUBLIC_` (Vite `envPrefix`, Entscheidung Beks), passend zur vorhandenen `.env.local`. Repo: github.com/bekhanidrisov74-hub/movenow (privat).
- Offen: Löschfristen und Freigabe geänderter Angebote (Entscheidung); Quellen ohne Einzelnachweis (OPEN_ISSUES.md)

<!-- Beispiel:
## 2026-10-30 · S1 · abgeschlossen
- Gerüst, Migration 0001, RLS-Tests (12/12) grün
- Offen: Partner-Gebietsmodell (PLZ-Liste vs. Bezirke) – Entscheidung Beks

## 2026-11-02 · S6 · unterbrochen
- Konfigurator und Routengrafik fertig, Preis-Sheet offen
- Weiter bei: Preis-Sheet wie 05, danach E2E Umzug-Beispiel
-->
