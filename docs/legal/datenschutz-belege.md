# Datenschutz: Belege der Empfänger (legal1)

Zu `src/assets/legal/datenschutz.md`, Abschnitte 5, 9a und 11. Stand 2026-11-20, Entwicklungsprojekt. Die Seite selbst nennt keine Dateipfade; hier stehen die Belege. Die Belege des früheren Entwurfs (`docs/legal/entwurf/datenschutz-kunden.md`, Abschnitt 14) stammen aus dem Stand Migrationen 0001 bis 0022 und sind nicht neu geprüft; vor der Anwaltsprüfung gegen den gebauten Stand abgleichen.

| Empfänger | Aussage im Text | Beleg |
|---|---|---|
| Supabase | Region Dev: eu-west-1 (Irland) | `supabase/.temp/pooler-url:1` (Host `aws-0-eu-west-1.pooler.supabase.com`) |
| Supabase | Produktionsregion nicht belegt; Ziel EU | `docs/GOLIVE.md:16` (Punkt 1, offen) |
| Supabase | Dienste: Auth, Postgres, Storage, Edge Functions | `docs/ARCHITECTURE.md:3`, `:146`, `:200`; Auth-Captcha `supabase/config.toml:214-219` |
| Brevo | Mails über die HTTP-API; gesendet werden Empfängeradresse, Betreff, reiner Text, Absender „MoveNow“ | `supabase/functions/_shared/jobs/brevo.ts:16`, `:29` |
| Brevo | EU, AVV offen, Tracking aus | `docs/ENTSCHEIDUNGEN.md:214` (Nr. 207); `docs/GOLIVE.md:80` (Punkt 44), `:87` |
| Brevo | Versandweg der Anmelde-Mail (Code und Link) nicht belegt: `config.toml` hat keinen aktiven SMTP-Block, die Einstellung liegt im gehosteten Projekt | `supabase/config.toml:238-246` (auskommentiert) |
| Cloudflare Turnstile | Browser lädt das Skript erst nach der Nutzeraktion, nie beim Start | `src/lib/turnstile.ts:4`, `:6` |
| Cloudflare Turnstile | Server prüft das Token bei Cloudflare ohne IP-Adresse | `supabase/functions/_shared/turnstile.ts:1-2`, `:5` |
| Cloudflare Turnstile | schützt Anmeldung (`signInWithOtp`) und `route` | `src/lib/turnstile.ts:1` |
| Cloudflare Turnstile | Rechtsfrage § 165 TKG, IP-Weitergabe durch Supabase Auth nicht gemessen | `docs/GOLIVE.md:92` (Punkt 51) |
| HeiGIT (openrouteservice) | Adresssuche und Route über `api.heigit.org` | `supabase/functions/_shared/route/provider.ts:23-24` |
| HeiGIT | Cache der Route 24 Stunden | `supabase/functions/_shared/route/compute.ts:7` |
| HeiGIT | Cache der Adressvorschläge 24 Stunden | `supabase/functions/_shared/quote/handler.ts:33` |
| HeiGIT | Übermittlung erst nach Einwilligung | `src/lib/route.ts:43` |
| HeiGIT, Partnerbetriebe | Sitz (Deutschland bzw. Österreich) und die Rolle als Auftragsverarbeiter sind im Repo nicht belegt; im Text als `[ANWALT]` markiert | `src/assets/legal/datenschutz.md`, Abschnitt 11 |
| Hosting | nicht festgelegt | `docs/GOLIVE.md:54` |
| keine weiteren | keine externen Schriften, Analyse, Kartenkacheln | `index.html:10-17`; Suche in `src/` und `supabase/functions/` ohne weitere Hosts |
