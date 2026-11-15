---
paths:
  - "supabase/**"
  - "scripts/**"
  - "src/**"
  - "index.html"
  - "public/**"
  - "tests/rls/**"
  - "tests/support/**"
  - "vite.config.ts"
  - "playwright.config.ts"
  - "package.json"
  - ".env.example"
---
# Daten und Sicherheit

- RLS auf jeder Tabelle. Kein `using (true)` auf personenbezogenen Daten. Views mit `security_invoker = true`. SECURITY-DEFINER-Funktionen mit festem `search_path`.
- Skripte, die Sperren lockern oder Daten löschen, brechen ab, wenn die Ref nicht die Dev-Ref ist (`scripts/dev-guard.mjs` als erster Import). Für Claude starten sie nur über `npm run loesch -- <skript.mjs>` mit Fable-Freigabe (Register `scripts/sys/loesch-register.json`; `tests/support/sweep.ts` läuft im Testlauf und prüft dieselbe Freigabe selbst; Freigaben übernimmt `npm run loesch -- uebernehme <bericht>`, sie zählen erst aus dem Commit).
- Admin-Funktionen mit p_actor laufen nur über service_role aus Skripten; p_actor darf nie aus Anfragedaten stammen. Eine Admin-Function für Nutzer-JWTs muss aal2 serverseitig prüfen und p_actor aus dem geprüften Token nehmen.
- Neue Supabase-Schlüssel (publishable / secret). Der Secret-Key nur in Edge Functions, nie in der App, nie in Logs. In der App nur Variablen mit `NEXT_PUBLIC_`-Präfix (Vite `envPrefix`), und davon nur URL und Publishable Key.
- `.env*` (außer `.env.example`) nie lesen, ausgeben oder committen, auch nicht über Skripte, `node -e` oder andere Umwege. Werte gehen nur über die npm-Skripte (dotenv-cli) an Befehle. Ein blockierter Tool-Aufruf ist endgültig.
- Annahme, Angebot, Nachtrag und Storno laufen über Funktionen mit festem Akteur je Übergang (`docs/S9_KONZEPT.md`, Abschnitt 4.4). Kein direktes UPDATE auf Status.
- Partner-Portal (Phase 1, S9a ff.): Partner sehen vor Annahme ihres Angebots nur PLZ/Bezirk, Umfang und Fotos. Keine Hausnummer, kein Name, keine Kontaktdaten.
- Fotos: privater Bucket, signierte URLs, höchstens 8 Bilder à 10 MB, EXIF-Daten (Standort) vor dem Upload entfernen.
- Seed-Daten nur in `supabase/seed.sql`, nie in Migrationen.
- Keine Google Fonts oder andere Drittanbieter-Fonts vom CDN (DSGVO). Inter als Fallback, falls nötig, selbst hosten.

## Datenbank-Weg
- Neue Migration: `npx supabase migration new <name>`. Auf Dev nur über `npm run db:antrag` → Freigabe durch `advisor-report` (`db-freigabe-<n>.md`, SHA-256 je Datei, `Urteil: frei`) → `npm run db:push` (zieht `db:types` nach).
- Direkte `supabase db push`, `migration repair` und die Supabase-Connector-Werkzeuge sind gesperrt.
- Gelang der Push, aber nicht das Schreiben der Marken (`fertig` blockiert dann): `npm run db:nachtrag` holt sie aus der Startmarke `db-push-start` nach (nur bei unverändertem SHA-256).
- Edge Functions nach einer Migration, die ihre Basis ändert, im selben Schritt neu deployen (dazwischen scheitern die Geldwege, fail closed).
