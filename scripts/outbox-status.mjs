// Betreiber-Sicht auf die Mail-Outbox (mail2, GOLIVE 48): nur lesen, nur Zahlen, nie Adresse und nie ID. Aufruf: npm run outbox (nur Dev).
//   zeilen             Anzahl je „Empfängerart Status Fehlercode“
//   konto_pausiert     wartende Zeilen mit smtp_account: Brevo meldet einen Kontofehler (Schlüssel, Sperre, Kontingent, Rate-Limit), die Zeilen warten ohne Versuch zu verbrauchen
//   aelteste_wartende  Alter der ältesten Zeile, die noch nicht gesendet und nicht endgültig gescheitert ist
//   firmen_echte_adresse  Firmen, deren Inhaber-Konto eine Anmeldeadresse ohne reservierte Endung (.test …) hat: an sie geht auch auf Dev echte Mail
import './dev-guard.mjs'
import { execFileSync } from 'node:child_process'

const RESERVED = `'[.](test|invalid|example|localhost)$'`
const query = `select
  (select coalesce(jsonb_object_agg(k, n), '{}'::jsonb) from (select o.recipient_kind || ' ' || o.status || ' ' || coalesce(o.last_error, '-') as k, count(*) as n from public.outbox o group by 1) s) as zeilen,
  (select count(*) from public.outbox where status = 'pending' and last_error = 'smtp_account') as konto_pausiert,
  (select coalesce(floor(extract(epoch from now() - min(created_at)) / 60), 0) from public.outbox where status in ('pending', 'sending')) as aelteste_wartende_min,
  (select count(*) from public.partners p where exists (
     select 1 from public.partner_members m join auth.users u on u.id = m.user_id
     where m.partner_id = p.id and m.role = 'owner' and u.email !~* ${RESERVED})) as firmen_echte_adresse`

let out
try {
  out = execFileSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'db', 'query', '--linked', query], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
} catch (e) {
  out = e.stdout ?? ''
}
let json
try {
  json = JSON.parse(out)
} catch {
  console.error('Abfrage fehlgeschlagen (Ausgabe der CLI nicht lesbar).')
  process.exit(1)
}
if (json._tag === 'Error' || !json.rows?.[0]) {
  console.error('Abfrage fehlgeschlagen.')
  process.exit(1)
}
const r = json.rows[0]
for (const [k, v] of Object.entries(r.zeilen).sort()) console.log(`zeilen ${k}=${v}`)
console.log(`konto_pausiert=${r.konto_pausiert}`)
console.log(`aelteste_wartende_min=${r.aelteste_wartende_min}`)
console.log(`firmen_echte_adresse=${r.firmen_echte_adresse}`)
